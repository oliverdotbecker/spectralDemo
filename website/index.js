const electronDaemon = require('electron').remote.require('./index.js');

//AS7262 settings
const channelCount = 6;
const channelNames = ["Violett","Blau","Gr&uuml;n","Gelb","Orange","Red"];
const channelColors = ["#310080","blue","green","yellow","orange","red"];
const channelWavelengths = [450,500,550,570,600,650]; //nm

var height = 0;

var barsContainer = null;
var currMaxDisplay = null;
var valueContainer = null;
var comInput = null;
var currTempDisplay = null;

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

                //var xyz = convertSpectrumToXYZ(measures);

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
    for(var wI = 0; wI < channelWavelengths.length; wI++)
    {

    }
}