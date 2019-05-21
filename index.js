const serialPort = require('serialport');
const electron = require('electron');
const {app, BrowserWindow} = electron;
const globalShortcut = electron.globalShortcut;

var devFlag = false;

process.argv.forEach(function (val, index, array) {
    if(val == "dev")
    {
        devFlag = true;
    }
});

var serialPath = "COM3";
var activeSerialPort = null;
var lastCommand = "";
var measures = null;
if(devFlag)
{
    measures = [2000,5,3,4,3,10];
}
var temp = 0;
var receivedData = "";

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
            if(receivedData.search("OK") != -1 || receivedData.search("ERROR") != -1)
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
                if(lastCommand.search("ATTEMP") != -1 && receivedData.search(",") == -1)
                {
                    temp = receivedData.split(" ")[0];
                }
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

initSerialCommunication();
sendSerialData("ATLED0=0\n");
setTimeout(() => {
    sendSerialData("ATLED0=100\n");
},500);
setTimeout(() => {
    sendSerialData("ATLED1=0\n");
},250);
var dataInterval = setInterval(() => {
    sendSerialData("ATCDATA\n");
},500);
var tempInterval = setInterval(() => {
    sendSerialData("ATTEMP\n");
},5020);

app.on('ready', () => {
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
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
})

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
    activeSerialPort.close();
    measures = [];
    serialPath = path;
    clearInterval(dataInterval);
    clearInterval(tempInterval);
    initSerialCommunication();
    dataInterval = setInterval(() => {
        sendSerialData("ATCDATA\n");
    },500);
    tempInterval = setInterval(() => {
        sendSerialData("ATTEMP\n");
    },5020);
}

exports.getSerialPath = function()
{
    return serialPath;
}