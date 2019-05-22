const electronDaemon = require('electron').remote.require('./index.js');

//AS7262 settings
const channelCount = 6;
const channelNames = ["Violett","Blau","Gr&uuml;n","Gelb","Orange","Red"];
const channelColors = ["#310080","blue","green","yellow","orange","red"];
const channelWavelengths = [450,500,550,570,600,650]; //nm
//CIE 1931 tristimulus values from:
//https://wisotop.de/Anhang-Tristimulus-Werte.php

const tristimulusX = [0.3362,0.0049,0.4334,0.7621,1.0622,0.2835];
const tristimulusY = [0.0380,0.3230,0.9950,0.9520,0.6310,0.1070];
const tristimulusZ = [1.7721,0.2720,0.0087,0.0021,0.0008,0.0000];

const maxSpectrumVal = 65536;

var height = 0;

var barsContainer = null;
var currMaxDisplay = null;
var valueContainer = null;
var comInput = null;
var currTempDisplay = null;
var currXYZDisplay = null;

function init()
{
    console.log("Init");
    setInterval(() => {
        var measures = electronDaemon.getMeasures();
        if(measures)
        {
            console.log(measures);
            measures = JSON.parse(measures);
    
            if(barsContainer)
            {
                var box = barsContainer.getBoundingClientRect();
                height = box.height;
                var currMax = 0;
                for(var i = 0; i < measures.length; i++)
                {
                    currMax = Math.max(parseInt(measures[i]),currMax);
                }
                if(parseInt(currMax) < 10)
                {
                    currMax = 10;
                }
                currMaxDisplay.innerHTML = currMax;

                valueContainer.innerHTML = "";

                for(var i = 0; i < channelCount; i++)
                {
                    barsContainer.childNodes[i].style.height = (parseInt(measures[i])/currMax)*height+"px";
                    valueContainer.innerHTML += "<label>"+measures[i]+"</label>";
                }

                convertSpectrumToXYZ(measures);

                comInput.style.color = "";
            }
        }
    },500);

    setInterval(() => {
        var currentTemp = electronDaemon.getTemp();
        currTempDisplay.innerHTML = JSON.parse(currentTemp)+" &deg;C";
    },5100);

    barsContainer = document.getElementById('bars');
    valueContainer = document.getElementById('values');
    currMaxDisplay = document.getElementById('currentMax');
    currTempDisplay = document.getElementById('currentTemp');
    currXYZDisplay = document.getElementById('currentXYZ');
    var namesContainer = document.getElementById('names');

    for(var i = 0; i < channelCount; i++)
    {
        var newBar = document.createElement('div');
        newBar.className = "bar"
        newBar.title = channelNames[i];
        newBar.style.backgroundColor = channelColors[i];
        barsContainer.appendChild(newBar);

        var newLabel = document.createElement('label');
        newLabel.innerHTML = channelNames[i];
        namesContainer.appendChild(newLabel);
    }
    
    var commandInput = document.getElementById('commandInput');
    commandInput.onkeydown = function(event)
    {
        if(event.keyCode == 13)
        {
            var input = event.currentTarget;
            if(input)
            {
                electronDaemon.sendCommand(input.value);
            }
        }
    }
    
    comInput = document.getElementById('comInput');
    comInput.value = electronDaemon.getSerialPath();
    comInput.onkeydown = function(event)
    {
        if(event.keyCode == 13)
        {
            var input = event.currentTarget;
            if(input)
            {
                electronDaemon.setSerialPath(input.value);
            }
        }
    }

    var ckLED = document.getElementById('ckLED');
    ckLED.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            if(input.checked)
            {
                electronDaemon.sendCommand("ATLED1=100");
            }
            else
            {
                electronDaemon.sendCommand("ATLED1=0");
            }
        }
    }
}

function portFail()
{
    comInput.style.color = "red";
}

function convertSpectrumToXYZ(spectralData)
{
    var X = 0;
    var Y = 0;
    var Z = 0;
    for(var wI = 0; wI < channelWavelengths.length; wI++)
    {
        X += tristimulusX[wI]*(spectralData[wI]/maxSpectrumVal);
        Y += tristimulusY[wI]*(spectralData[wI]/maxSpectrumVal);
        Z += tristimulusZ[wI]*(spectralData[wI]/maxSpectrumVal);
    }
    console.log(X+" "+Y+" "+Z);
    if(currXYZDisplay)
    {
        currXYZDisplay.innerHTML = round(X,4)+" "+round(Y,4)+" "+round(Z,4);
    }
    //return [X,Y,Z];
}

function round(number,digits)
{
    number = number*Math.pow(10,digits);
    number = Math.round(number);
    number = number/Math.pow(10,digits);
    return number;
}