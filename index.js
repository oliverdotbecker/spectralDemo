const serialPort = require('serialport');
const electron = require('electron');
const {app, BrowserWindow} = electron;
const globalShortcut = electron.globalShortcut;

var serialPath = "COM3";
var activeSerialPort = null;
var lastCommand = "";
var measures = [0,0,0,0,0,0];

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
            //console.log('Data:', data);
            console.log(data+"");
            if(lastCommand.search("ATDATA") != -1)
            {
                data = data+"";
                measures = data.split(",");
                if(measures.length == 6)
                {
                    measures[5] = measures[5].split(" ")[1];
                    console.log(measures);
                }
            }
            //handleReceivedData(data);
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
            if (err) {
            return console.log('Error on write: ', err.message)
            }
            lastCommand = data;
            //console.log('message written');
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
    sendSerialData("ATDATA\n");
},500);

app.on('ready', () => {
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        frame: true,
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
    initSerialCommunication();
    dataInterval = setInterval(() => {
        sendSerialData("ATDATA\n");
    },500);
}

exports.getSerialPath = function()
{
    return serialPath;
}