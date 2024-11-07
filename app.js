//const {Builder, By, Key, until} = require('D:\\workspaces\\node\\jandi\\node_modules\\selenium-webdriver');
require('dotenv').config();

const fs = require('fs');
const path = require ('path');

let isWin = process.platform === "win32";
const pwd = process.cwd();
const workspace = process.env.JANDI_WORKSPACE || '';
const webdriver = path.join(workspace, 'selenium-webdriver');
const username = process.env.JANDI_USERNAME || 'root';
const password = process.env.JANDI_PASSWORD || '';
const ignore_topics = process.env.JANDI_IGNORE_TOPICS.split(',') || '';
const ignore_chats  = process.env.JANDI_IGNORE_CHATS.split(',') || '';
const headless = process.env.JANDI_HEADLESS || 'false';
const NUM_PAGEUP = 5;
const MAX_RETRY  = 5;
const SLEEP_MINOR = 100;
const SLEEP_MAJOR = 1000;
let _messages = {}; 


const {Builder, By, Key, until} = require(webdriver);
const chrome = require((isWin)? webdriver + '\\chrome': webdriver + '/chrome');

const download = path.join (workspace, 'download');
const output   = path.join (workspace, 'output');

if (!fs.existsSync(download)) { fs.mkdirSync(download, { recursive: true }); }
if (!fs.existsSync(output))   { fs.mkdirSync(output,   { recursive: true }); }

options   = new chrome.Options();
options.addArguments((headless=='true')? 'headless':'head');
options.addArguments('disable-gpu');
options.setUserPreferences( {'download.default_directory': download, "profile.default_content_setting_values.automatic_downloads" : 1} );

const driver = new Builder()
.forBrowser("chrome")
.setChromeOptions(options)
.build();

function sortOnKeys(dict) {
    var sorted = [], tempDict = {};
    for(var key in dict) { sorted[sorted.length] = key; }
    sorted.sort();

    for(var i = 0; i < sorted.length; i++) { tempDict[sorted[i]] = dict[sorted[i]]; }
    return tempDict;
}
async function pressPagUpKey (count=5) {
    let actions = driver.findElement (By.css ("body"))
    for (var i = 0; i < count; i++) { await actions.sendKeys(Key.PAGE_UP); await driver.sleep (SLEEP_MINOR); }
}

function dict2json (f, d) {
    fs.writeFileSync(f, JSON.stringify (Object.values(d), null, 2));
}

function dict2text (f, d) {
    for (const [key, value] of Object.entries(d)) {
        console.log(key, value);
      }
    fs.writeFileSync(f, JSON.stringify (Object.values(d), null, 2));
}
async function topicRoomEntrance (topicId, topicNm) {
    _messages = {}; 
    await driver.findElement (By.id (topicId)).click()

    for (let retry = 0; retry < MAX_RETRY; retry++) {
        if (retry > 0) await driver.sleep (SLEEP_MAJOR); 
        let messages = await driver.findElements (By.className("_message present"));
        let messageN = messages.length;  

        for (var i = 0, prev = ""; i < messages.length; i++) {
            let id = await messages[i].getAttribute("id");
            if (id == '') { id = await messages[i].findElement (By.className("_systemMsgDate")).getAttribute("data-id"); id =  Number(id) * 10; } // system message  
            else { id = Number(id) * 10 + 1; }

            if (id in _messages) continue;

            retry   = 0;
            updated = true; 

            let _sys = false;
            let msg  = '';
            let time = '';
            let name = '';

            try { msg  = await messages[i].findElement (By.className("msg-item")).getText(); } 
            catch (e) { 
                try { msg  = await messages[i].findElement (By.className("info-title")).getText(); }
                catch (e) { _sys = true; }
            }

            if (_sys) {
                msg = await messages[i].findElement (By.className("msg-system")).getText();
                _messages[id] = { 'type': 'sys', 'name': '', 'time': '', 'msg': msg};
                continue;
            }
            try { name = await messages[i].findElement (By.className("member-names")).getText(); } catch (e) { name = prev; }
            try { time = await messages[i].findElement (By.className("fn-time-stamp")).getAttribute("tooltip"); } catch (e) {}

            files = await messages[i].findElements (By.className("file-type-wrap"));
            for (var j = 0; j < files.length; j++) {
                let file = await files[j].findElement (By.className("info-title")).getText();

                const dir = path.resolve(path.join(download, file));
                
                exists = await fs.existsSync(dir);
                if (exists) {  await fs.unlinkSync(dir); }
                
                
                let downloadBtn = await files[j].findElement (By.className("ui-icon icon-ic-download fn-12"));
                driver.executeScript("arguments[0].click();", downloadBtn);
            }
            prev = name; 
            _messages[id] = { 'type': 'msg', 'name': name, 'time': time, 'msg': msg};
        }
        await pressPagUpKey (NUM_PAGEUP);      
    }
    _messages = sortOnKeys(_messages);
    
    fs.writeFileSync(path.join(output, topicNm + '.json'), JSON.stringify (Object.values(_messages), null, 2));
    dict2json (path.join(output, topicNm + '.json'), _messages);
    dict2text (path.join(output, topicNm + '.txt' ), _messages);


    await driver.sleep (SLEEP_MAJOR); 
}

async function topicRoom () {
    var resultRooms  = await driver.findElements(By.className("lnb-list-item _topicItem"));
    let ncount = resultRooms.length;

    for (var i = 0; i < ncount; i++) {
        var resultRooms  = await driver.findElements(By.className("lnb-list-item _topicItem")); // re-init 'StaleElementReferenceError'

        let topicId = await resultRooms[i].getAttribute("id");
        let topicNm = await resultRooms[i].findElement (By.className ("lnb-item-name")).getText();
        let ignore = false;
        for (var j = 0; j < ignore_topics.length; j++) {
            if (topicNm.indexOf(ignore_topics[j].trim(), 0) >= 0) ignore = true;
        }
        if (ignore == false) { await topicRoomEntrance (topicId, topicNm); }
    }
}

async function dmRoom () {
    let resultRooms  = await driver.findElements(By.className("lnb-list-item _dmItem"));
    let ncount = resultRooms.length;

    for (var i = 0; i < ncount; i++) {
        let resultRooms  = await driver.findElements(By.className("lnb-list-item _dmItem")); // re-init for 'StaleElementReferenceError'
        let topicId = await resultRooms[i].getAttribute("id");
        let topicNm = await resultRooms[i].findElement (By.className ("member-names")).getText();
        let ignore = false;
        for (var j = 0; j < ignore_chats.length; j++) {
            if (topicNm.indexOf(ignore_chats[j].trim(), 0) >= 0) ignore = true;
        }
        if (ignore == false) { await topicRoomEntrance (topicId, topicNm); }
    }    
}

async function jandi () {
    try {
        await driver.get('https://www.jandi.com/landing/kr/signin');
        const usernameField = await driver.findElement(By.name('email'));
        const passwordField = await driver.findElement(By.name('nocheck'));
        const loginButton   = await driver.findElement(By.css('button[type="submit"]'));

        await usernameField.sendKeys(username);
        await passwordField.sendKeys(password);
        await loginButton.click();
        await driver.wait(until.elementLocated(By.css('li.as-belong')), 3000);
        
        const joinButton   = await driver.findElement(By.css('button.btn.btn-blue'));
        await joinButton.click();
        await driver.wait(until.elementLocated(By.css('div.lnb-top')), 3000);
        await topicRoom ();
        await dmRoom ();
    } finally {
    }
}

jandi ();