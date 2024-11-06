//const {Builder, By, Key, until} = require('D:\\workspaces\\node\\jandi\\node_modules\\selenium-webdriver');
require('dotenv').config();

let isWin = process.platform === "win32";
const pwd = process.cwd();
const webdriver = (isWin)? pwd + '\\node_modules\\selenium-webdriver' : pwd + '/node_modulws/selenium-webdriver';
const username = process.env.JANDI_USERNAME || 'root';
const password = process.env.JANDI_PASSWORD || '';
const ignore_topics = process.env.JANDI_IGNORE_TOPICS.split(',') || '';
const ignore_chats  = process.env.JANDI_IGNORE_CHATS.split(',') || '';
const download = process.env.JANDI_DOWNLOAD || '';
const headless = process.env.JANDI_HEADLESS || 'false';
const NUM_PAGEUP = 5;
const MAX_RETRY  = 5;
const SLEEP_MINOR = 100;
const SLEEP_MAJOR = 1000;
let _messages = {}; 


const {Builder, By, Key, until} = require(webdriver);
const chrome = require((isWin)? webdriver + '\\chrome': webdriver + '/chrome');


/////////////////////////////////////////////
// Download path create
const fs = require('fs');
const path = require ('path');

if (!fs.existsSync(download)){
    fs.mkdirSync(download, { recursive: true });
}
console.log(download)

options   = new chrome.Options();
//options.addArguments('headless'); // note: without dashes
options.addArguments((headless=='true')? 'headless':'head');
//options.addArguments('headless');
options.addArguments('disable-gpu');
options.setUserPreferences( {'download.default_directory': download, "profile.default_content_setting_values.automatic_downloads" : 1} );

console.log (options)

const driver = new Builder()
.forBrowser("chrome")
.setChromeOptions(options)
.build();


function sortOnKeys(dict) {
    var sorted = [];
    for(var key in dict) {
        sorted[sorted.length] = key;
    }
    sorted.sort();

    var tempDict = {};
    for(var i = 0; i < sorted.length; i++) {
        tempDict[sorted[i]] = dict[sorted[i]];
    }

    return tempDict;
}
async function loopPageUpKey (count=5) {
    let actions = driver.findElement (By.css ("body"))

    for (var i = 0; i < count; i++) {
        await actions.sendKeys(Key.PAGE_UP);
        await driver.sleep (SLEEP_MINOR);            
    }
}

async function topicRoomEntrance (topicId, topicNm) {
    _messages = {}; 
    console.log(topicId.split("-")[1] + ':' + topicNm.trim());
    await driver.findElement (By.id (topicId)).click()

    for (let retry = 0; retry < MAX_RETRY; retry++) {
        if (retry > 0) await driver.sleep (SLEEP_MAJOR); 
        let messages = await driver.findElements (By.className("_message present"));
        let messageN = messages.length;  //messages = messages.reverse()
        console.log('[retry]', retry, '[messages.length]', messageN, '[_messages.length]', Object.keys(_messages).length);

        for (var i = 0, prev = ""; i < messages.length; i++) {
            let id = await messages[i].getAttribute("id");

            ///////////////////////////////////////////////////////
            // check duplicated message
            if (id == '') { id = await messages[i].findElement (By.className("_systemMsgDate")).getAttribute("data-id"); id =  Number(id) * 10; } // system message  
            else { id = Number(id) * 10 + 1; }

            if (id in _messages) continue;

            retry   = 0;
            updated = true; 

            let _sys = false;
            let msg  = '';
            let time = '';
            let name = '';

            //try { msg  = await messages[i].findElement (By.className("msg-text-box")).getText(); } catch (e) { _sys = true; }
            try { msg  = await messages[i].findElement (By.className("msg-item")).getText(); } 
            catch (e) { 
                try { msg  = await messages[i].findElement (By.className("info-title")).getText(); }
                catch (e) { _sys = true; }
            }

            if (_sys) {
                msg = await messages[i].findElement (By.className("msg-system")).getText();
                console.log (id, msg);
                console.log ();
                console.log ();
                _messages[id] = { 'name': '', 'time': '', 'msg': msg};
                continue;
            }
            try { name = await messages[i].findElement (By.className("member-names")).getText(); } catch (e) { name = prev; }
            try { time = await messages[i].findElement (By.className("fn-time-stamp")).getAttribute("tooltip"); } catch (e) {}

            //console.log (id)
            console.log ();
            console.log ();
            console.log (name, '(' + time + ')');
            console.log ();
            console.log (msg);
            
            files = await messages[i].findElements (By.className("file-type-wrap"));
            for (var j = 0; j < files.length; j++) {
                let file = await files[j].findElement (By.className("info-title")).getText();
                console.log ('[+]', file);
                //let downloadBtn = await files[j].findElement (By.className("download-btn _fileOriginDownload"));

                const dir = path.resolve(path.join(download, file));
                
                exists = await fs.existsSync(dir);
                if (exists) {  await fs.unlinkSync(dir); }
                
                
                let downloadBtn = await files[j].findElement (By.className("ui-icon icon-ic-download fn-12"));
                //await downloadBtn.sendKeys (Key.ENTER);
                //await downloadBtn.click();
                driver.executeScript("arguments[0].click();", downloadBtn);
            }
            prev = name; 
            //let msg   = await messages[i].findElement (By.className("msg-text-box")).getAttribute("textContent"); 
            
            console.log ();

            _messages[id] = { 'name': name, 'time': time, 'msg': msg};
        }
        await loopPageUpKey (NUM_PAGEUP);      
    }
    //_messages = sortOnKeys(_messages);
    //console.log (_messages);
    await driver.sleep (SLEEP_MAJOR); 

    //const messages = driver.findElement (By.id ("msgs_container"))
    //let deltaY = (await messages.getRect()).y
    //console.log ('deltaY:'+deltaY);
    //await driver.actions().scroll(0, deltaY, 0, deltaY).perform()
    //driver.executeScript("arguments[0].scrollIntoView(false);", messages);
}

async function topicRoom () {
    //////////////////////////////////////////////////////////////////////////////////////
    // Topic Room

    var resultRooms  = await driver.findElements(By.className("lnb-list-item _topicItem"));
    console.log('[resultTopicRooms.length]', resultRooms.length)
    console.log (ignore_topics);

    let ncount = resultRooms.length;

    //for (var i = 0; i < resultRooms.length; i++) {
    for (var i = 0; i < ncount; i++) {
        var resultRooms  = await driver.findElements(By.className("lnb-list-item _topicItem")); // re-init 'StaleElementReferenceError'

        let topicId = await resultRooms[i].getAttribute("id");
        //let topicNm = await resultRooms[i].findElement (By.className ("lnb-item-name")).getAttribute("textContent");
        let topicNm = await resultRooms[i].findElement (By.className ("lnb-item-name")).getText();
        let ignore = false;
        for (var j = 0; j < ignore_topics.length; j++) {
            if (topicNm.indexOf(ignore_topics[j].trim(), 0) >= 0) ignore = true;
        }
        if (ignore == false) { await topicRoomEntrance (topicId, topicNm); }
    }
    console.log ('-----------------------------------------------') 
}

async function dmRoom () {
    //////////////////////////////////////////////////////////////////////////////////////
    // DM Room

    let resultRooms  = await driver.findElements(By.className("lnb-list-item _dmItem"));
    console.log('[resultRooms.length]', resultRooms.length)
    console.log (ignore_chats);

    let ncount = resultRooms.length;

    //for (var i = 0; i < resultDmRooms.length; i++) {
    for (var i = 0; i < ncount; i++) {
        let resultRooms  = await driver.findElements(By.className("lnb-list-item _dmItem")); // re-init 'StaleElementReferenceError'
        let topicId = await resultRooms[i].getAttribute("id");
        //var topicNm = await resultDmRooms[i].findElement (By.className ("member-names")).getAttribute("textContent");
        let topicNm = await resultRooms[i].findElement (By.className ("member-names")).getText();
        let ignore = false;
        for (var j = 0; j < ignore_chats.length; j++) {
            if (topicNm.indexOf(ignore_chats[j].trim(), 0) >= 0) ignore = true;
        }
        console.log (topicId, topicNm);
        //continue;
        if (ignore == false) { await topicRoomEntrance (topicId, topicNm); }
    }    
    console.log ('-----------------------------------------------') 


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
        console.log ("JANDI: login success")
        
        const joinButton   = await driver.findElement(By.css('button.btn.btn-blue'));
        console.log ("JANDI: team join page entrance")
        await joinButton.click();

        await driver.wait(until.elementLocated(By.css('div.lnb-top')), 3000);
        console.log ("JANDI: main pannel entrance success")

        await topicRoom ();
        await dmRoom ();

        //await driver.findElement(By.name('q')).sendKeys('You did it!!', Key.RETURN);
        //await driver.wait(until.titleIs('You did it!! - Google Search'), 1000);
    } finally {
        //await driver.quit();
    }
}

jandi ();