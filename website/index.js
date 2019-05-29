const electronDaemon = require('electron').remote.require('./index.js');

//AS7261 settings
const AS7261 = {
    channelCount:6,
    channelNames:["X","Y","Z","Dark","C","NIR"],
    channelColors:["lightgray","gray","darkgray","#222222","white","red"]
}
//AS7262 settings
const AS7262 = {
    channelCount:6,
    channelNames:["Blau","Gr&uuml;n","Gelbgr&uuml;n","Gelb","Orange","Red"],
    channelColors:["blue","green","#c0ff00","yellow","orange","red"],
    channelWavelengths:[450,500,550,570,600,650], //nm
    maxSpectrumVal:65536
}
var activeSettings = AS7262;
var activeSensor = "7262";
electronDaemon.setSensor(activeSensor);

//CIE 1931 tristimulus values from:
//https://wisotop.de/Anhang-Tristimulus-Werte.php
const tristimulusX = [0.3362,0.0049,0.4334,0.7621,1.0622,0.2835];
const tristimulusY = [0.0380,0.3230,0.9950,0.9520,0.6310,0.1070];
const tristimulusZ = [1.7721,0.2720,0.0087,0.0021,0.0008,0.0000];

var height = 0;
var cieXdiv = 0;
var cieYdiv = 0;

var barsContainer = null;
var namesContainer = null;
var currMaxDisplay = null;
var valueContainer = null;
var comInput = null;
var currTempDisplay = null;
var currXYZDisplay = null;
var currxyYDisplay = null;
var currRGBDisplay = null;
var currColorDisplay = null;
var cieDisp = null;
var ciePos = null;

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
                else
                {
                    currMax = parseInt(currMax)+1;
                }
                currMaxDisplay.innerHTML = currMax;

                valueContainer.innerHTML = "";

                for(var i = 0; i < activeSettings.channelCount; i++)
                {
                    barsContainer.childNodes[i].style.height = (parseInt(measures[i])/currMax)*height+"px";
                    valueContainer.innerHTML += "<label>"+measures[i]+"</label>";
                }

                if(cieDisp)
                {
                    var box = cieDisp.getBoundingClientRect();
                    cieXdiv = box.width/9;
                    cieYdiv = box.height/9;
                }

                if(activeSensor == "7262")
                {
                    for(i in measures)
                    {
                        measures[i] = parseFloat(measures[i]);
                    }
                    convertSpectrumToXYZ(measures);
                }
                else
                {
                    for(i in measures)
                    {
                        measures[i] = parseFloat(measures[i])/65536;
                    }
                    currXYZDisplay.innerHTML = round(measures[0],4)+" "+round(measures[1],4)+" "+round(measures[2],4);
                    XYZtoXY(measures[0],measures[1],measures[2]);
                    XYZtoRGB(measures[0],measures[1],measures[2]);
                }

                comInput.style.color = "";
            }
        }
    },250);

    setInterval(() => {
        var currentTemp = electronDaemon.getTemp();
        currTempDisplay.innerHTML = JSON.parse(currentTemp)+" &deg;C";
    },5100);

    barsContainer = document.getElementById('bars');
    valueContainer = document.getElementById('values');
    currMaxDisplay = document.getElementById('currentMax');
    currTempDisplay = document.getElementById('currentTemp');
    currXYZDisplay = document.getElementById('currentXYZ');
    currxyYDisplay = document.getElementById('currentxyY');
    currRGBDisplay = document.getElementById('currentRGB');
    currColorDisplay = document.getElementById('currentColor');
    cieDisp = document.getElementById('cie');
    ciePos = document.getElementById('ciePos');
    namesContainer = document.getElementById('names');
    
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

    var ckGrid = document.getElementById('ckGrid');
    ckGrid.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            var grid = document.getElementById("grid");
            var grid2 = document.getElementById("grid2");
            if(input.checked)
            {
                grid.style.display = "";
                grid2.style.display = "";
            }
            else
            {
                grid.style.display = "none";
                grid2.style.display = "none";
            }
        }
    }

    var sensorSelect = document.getElementById('sensorSelect');
    sensorSelect.value = activeSensor;
    sensorSelect.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            if(input.value == "7261")
            {
                activeSettings = AS7261;
                activeSensor = "7261";
                electronDaemon.setSensor(activeSensor);
            }
            else
            {
                activeSettings = AS7262;
                activeSensor = "7262";
                electronDaemon.setSensor(activeSensor);
            }
            createSurface();
        }
    }
    
    createSurface();
}

function createSurface()
{
    barsContainer.innerHTML = "";
    namesContainer.innerHTML = "";
    for(var i = 0; i < activeSettings.channelCount; i++)
    {
        var newBar = document.createElement('div');
        newBar.className = "bar"
        newBar.title = activeSettings.channelNames[i];
        newBar.style.backgroundColor = activeSettings.channelColors[i];
        barsContainer.appendChild(newBar);

        var newLabel = document.createElement('label');
        newLabel.innerHTML = activeSettings.channelNames[i];
        namesContainer.appendChild(newLabel);
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
    for(var wI = 0; wI < activeSettings.channelWavelengths.length; wI++)
    {
        X += tristimulusX[wI]*(spectralData[wI]/activeSettings.maxSpectrumVal);
        Y += tristimulusY[wI]*(spectralData[wI]/activeSettings.maxSpectrumVal);
        Z += tristimulusZ[wI]*(spectralData[wI]/activeSettings.maxSpectrumVal);
    }
    console.log(X+" "+Y+" "+Z);
    if(currXYZDisplay)
    {
        currXYZDisplay.innerHTML = round(X,4)+" "+round(Y,4)+" "+round(Z,4);
    }
    XYZtoXY(X,Y,Z);
    XYZtoRGB(X,Y,Z);
    //return [X,Y,Z];
}

function XYZtoXY(X,Y,Z)
{
    if(currxyYDisplay)
    {
        var x = X/(X+Y+Z);
        var y = Y/(X+Y+Z);
        currxyYDisplay.innerHTML = round(x,4)+" "+round(y,4)+" "+round(Y,4);
        
        if(cieDisp && ciePos)
        {
            ciePos.style.bottom = (y*10*cieYdiv)+"px";
            ciePos.style.left = (x*10*cieXdiv)+"px";
        }
    }
}

function XYZtoRGB(tX,tY,tZ)
{
    var gamma = 1/2.2;
    var r = Math.max((2.3706743*tX)+(-0.9000405*tY)+(-0.4706338*tZ),0);
    var g = Math.max((-0.5138850*tX)+(1.4253036*tY)+(0.0885814*tZ),0);
    var b = Math.max((0.0052982*tX)+(-0.0146949*tY)+(1.0093968*tZ),0);

    r = normalize(Math.pow(r,gamma));
    g = normalize(Math.pow(g,gamma));
    b = normalize(Math.pow(b,gamma));

    r = Math.round(r*255);
    g = Math.round(g*255);
    b = Math.round(b*255);

    if(currRGBDisplay)
    {
        currRGBDisplay.innerHTML = r+" "+g+" "+b;
        currRGBDisplay.style.backgroundColor = "rgb("+r+","+g+","+b+")";
    }
    if(currColorDisplay)
    {
        currColorDisplay.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;";

        var max = Math.max(r,g);
        max = Math.max(max,b);

        var diff = 255-max;
        var fact = diff/max;
        if(fact > 1)
        {
            r = Math.round(r*fact);
            g = Math.round(g*fact);
            b = Math.round(b*fact);
        }

        currColorDisplay.style.backgroundColor = "rgb("+r+","+g+","+b+")";
    }
}

function round(number,digits)
{
    number = number*Math.pow(10,digits);
    number = Math.round(number);
    number = number/Math.pow(10,digits);
    return number;
}

function normalize (n) {
    return Math.max(0,Math.min(n,1));
}

function setxy(x,y)
{
    if(cieDisp && ciePos)
    {
        ciePos.style.bottom = (y*10*cieYdiv)+"px";
        ciePos.style.left = (x*10*cieXdiv)+"px";
    }
}