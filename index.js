const serialPort = require('serialport');
const electron = require('electron');
const {app, BrowserWindow, Menu} = electron;
const globalShortcut = electron.globalShortcut;
const fs = require('fs');

var devFlag = false;

process.argv.forEach(function (val, index, array) {
    if(val == "dev")
    {
        devFlag = true;
    }
});

//electron
app.on('ready', () => {
    win = new BrowserWindow({
        x: 5,
        y: 5,
        width: 1200,
        height: 900,
        frame: true,
        icon: "cie.ico",
        title: "Spectral Demo"
    });

    var pagePath = 'file://' + __dirname + '/website/index.html';
    //win.webContents.openDevTools();
    win.loadURL(pagePath);

    var ret = globalShortcut.register('ctrl+shift+c', function() {
        win.webContents.openDevTools();
        setTimeout(() => {
            win.devToolsWebContents.executeJavaScript('DevToolsAPI.enterInspectElementMode()');
        },1000);
    });
    var ret = globalShortcut.register('ctrl+alt+s', function() {
        win.webContents.toggleDevTools();
    });
    
    const menuTemplate = [
        {
            label: 'App',
            submenu: [
                {role: 'reload', label: 'Reset App'},
                {type: 'separator'},
                {role: 'resetzoom'},
                {role: 'zoomin'},
                {role: 'zoomout'},
                {type: 'separator'},
                {role: 'togglefullscreen'},
                {type: 'separator'},
                {role: 'close'}
            ]
        },
        {
            label:'Data',
            submenu: [
                {
                    label: 'Export',
                    click: (menuItem, browserWindow, event) => {
                        win.webContents.executeJavaScript('doExport("data");');
                    }
                },
                {
                    label: 'Export Emitters',
                    click: (menuItem, browserWindow, event) => {
                        win.webContents.executeJavaScript('doExport("emitters");');
                    }
                }
            ]
        }
    ]

    if(devFlag == true)
    {
        menuTemplate.push({
            label: "Developer",
            submenu: [
                {role: 'toggledevtools'}
            ]
        })
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))
});

//Sensor and serial stuff
var activeSensor = "7262";
var serialPath = "COM3";
var activeSerialPort = null;
var lastCommand = "";
var measures = null;
if(devFlag)
{
    measures = [2000,6000,3,200,3,10];
}
var temp = 0;
var receivedData = "";
var tempInterval = null;
var dataInterval = null;

function initSerialCommunication(startup)
{
    if(serialPath)
    {
        activeSerialPort = new serialPort(serialPath, {
            baudRate: 115200
        });

        attachSerialListeners();
    }
    else
    {
        if(startup)
        {
            setTimeout(() => {
                initSerialCommunication();
            }, 500);
        }
        else
        {
            console.error("Failed to init serial interface. Path not defined.");
        }
    }
}

function attachSerialListeners()
{
    if(activeSerialPort)
    {
        activeSerialPort.on('data', function (data) {
            //console.log(data+"");
            receivedData += (data+"");
            if(receivedData.search("OK") != -1)
            {
                if(lastCommand.search("ATDATA") != -1 || lastCommand.search("ATCDATA") != -1)
                {
                    measures = receivedData.split(",");
                    if(measures.length == 6)
                    {
                        measures[5] = measures[5].split(" ")[1];
                        //console.log(measures);
                    }
                }
                if(lastCommand.search("ATXYZC") != -1)
                {
                    measures = receivedData.split(",");
                    if(measures.length == 3)
                    {
                        measures[2] = measures[2].split(" ")[1];
                        //console.log(measures);
                    }
                }
                if(lastCommand.search("ATTEMP") != -1 && receivedData.search(",") == -1)
                {
                    temp = receivedData.split(" ")[0];
                }
                receivedData = "";
            }
            else if(receivedData.search("ERROR") != -1)
            {
                console.error("Command: "+lastCommand.substr(0,lastCommand.length-1)+" failed.");
                receivedData = "";
            }
        });
        activeSerialPort.on('error', function (data) {
            console.log('Error:', data);
            win.webContents.executeJavaScript('portFail();');
        });
    }
}

function sendSerialData(data)
{
    if(activeSerialPort)
    {
        activeSerialPort.write(data, function(err) {
            if (err)
            {
                win.webContents.executeJavaScript('portFail();');
                return console.log('Error on write: ', err.message);
            }
            lastCommand = data;
        });
    }
}

var serialPorts = "[]";
exports.getAvailableSerialPorts = function(query)
{
    if(query)
    {
        return serialPort.list().then(ports => {
            serialPorts = JSON.stringify(ports);
        });
    }
    return serialPorts;
}

serialPort.list().then(ports => {
    if(ports.length > 0)
    {
        serialPath = ports[0].comName;
    }
    initSerialCommunication();
    sendSerialData("ATLED0=0\n");
    setTimeout(() => {
        sendSerialData("ATLED0=100\n");
    },510);
    setTimeout(() => {
        sendSerialData("ATLED1=0\n");
    },200);
    var dataInterval = setInterval(() => {
        sendSerialData("ATCDATA\n");
    },250);
    var tempInterval = setInterval(() => {
        sendSerialData("ATTEMP\n");
    },5020);
});

exports.getMeasures = function()
{
    if(measures.length == 6)
    {
        return JSON.stringify(measures);
    }
}

exports.getTemp = function()
{
    return JSON.stringify(temp);
}

exports.sendCommand = function(command)
{
    sendSerialData(command+"\n");
}

exports.setSerialPath = function(path)
{
    measures = [];
    serialPath = path;
    clearInterval(dataInterval);
    clearInterval(tempInterval);
    try
    {
        activeSerialPort.close();
    }
    catch(e)
    {

    }
    finally
    {
        activeSerialPort = null;
    }
    if(path != "No Port")
    {
        if(!activeSerialPort)
        {
            initSerialCommunication();
        }
        sendSerialData("ATLED0=100\n");
        setTimeout(() => {
            sendSerialData("ATLED1=0\n");
        },100);
        if(activeSensor == "7261")
        {
            setTimeout(() => {
                sendSerialData("ATTCSMD=2\n");
            },250);
            dataInterval = setInterval(() => {
                sendSerialData("ATDATA\n");
            },500);
            tempInterval = setInterval(() => {
                sendSerialData("ATTEMP\n");
            },5020);
        }
        else
        {
            dataInterval = setInterval(() => {
                sendSerialData("ATCDATA\n");
            },250);
            tempInterval = setInterval(() => {
                sendSerialData("ATTEMP\n");
            },5020);
        }
    }
}

exports.setSensor = function(sensor)
{
    measures = [];
    activeSensor = sensor;
    if(dataInterval)
    {
        clearInterval(dataInterval);
    }
    if(tempInterval)
    {
        clearInterval(tempInterval);
    }
    if(!activeSerialPort)
    {
        initSerialCommunication();
    }
    sendSerialData("ATLED0=100\n");
    setTimeout(() => {
        sendSerialData("ATLED1=0\n");
    },100);
    if(activeSensor == "7261")
    {
        setTimeout(() => {
            sendSerialData("ATTCSMD=2\n");
        },250);
        dataInterval = setInterval(() => {
            sendSerialData("ATDATA\n");
        },500);
        tempInterval = setInterval(() => {
            sendSerialData("ATTEMP\n");
        },5020);
    }
    else
    {
        dataInterval = setInterval(() => {
            sendSerialData("ATCDATA\n");
        },250);
        tempInterval = setInterval(() => {
            sendSerialData("ATTEMP\n");
        },5020);
    }
}

exports.getSerialPath = function()
{
    return serialPath;
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Data Im-/Export ////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

exports.exportSavedData = function(data)
{
    var date = new Date().toJSON();
    var filename = __dirname+'/export'+date.replace(/:/g,"-").replace("T","_").replace("Z","")+'.json';
    fs.writeFileSync(filename,data,'utf8');
    return filename;
}

exports.exportEmitters = function(data,filename)
{
    var filename = __dirname+'/'+filename;
    fs.writeFileSync(filename,data,'utf8');
    return filename;
}

exports.importEmitters = function(filename)
{
    var retData = null;
    var filename = __dirname+'/'+filename;
    if(fs.existsSync(filename))
    {
        retData = fs.readFileSync(filename,'utf8');
    }
    return retData;
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Artnet /////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

var value = 0;
var artnetOptions = {
    host: '2.255.255.255',
    refresh: 900,
    sendAll:true
}
var artnet = require('artnet')(artnetOptions);

exports.sendArtnet = function(channels)
{
    for(var i = 0; i < channels.length; i++)
    {
        channels[i] = parseInt(channels[i]);
        channels[i] = channels[i]*2.55;
    }
    artnet.set(1, channels);
}