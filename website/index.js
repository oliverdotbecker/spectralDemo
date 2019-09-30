const electronDaemon = require('electron').remote.require('./index.js');

//AS7261 settings
const AS7261 = {
    channelCount:3,
    channelNames:["X","Y","Z"],
    channelColors:["lightgray","gray","darkgray","#222222","white","red"]
}
//AS7262 settings
const AS7262 = {
    channelCount:6,
    channelNames:["Blau","Gr&uuml;n","Gelbgr&uuml;n","Gelb","Orange","Rot"],
    channelColors:["blue","green","#c0ff00","yellow","orange","red"],
    channelWavelengths:[450,500,550,570,600,650], //nm
    maxSpectrumVal:65536
}
var serialPorts = [];
var activeSettings = AS7262;
var activeSensor = "7262";
electronDaemon.setSensor(activeSensor);

const fixtureTypeLibrary = {
    "Arri Skypannel Mode RGBW":{
        intensity:1,
        emitters:{
            Rot:2,
            Grün:3,
            Blau:4,
            Weiss:5
        }
    },
    "Eurolight ML 56":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Amber:4,
            Weiss:5
        }
    },
    "Ape Labs Light Can":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Weiss:4
        }
    },
    "Ape Labs Mini":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Weiss:4
        }
    },
    "Ape Labs Maxi":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Weiss:4
        }
    },
    "Ape Stick4":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Weiss:4
        }
    }
}

const valueChangeTimeout = 3000;
const emitterChangeTimeout = 6000;
const measureSliderValues = [5,10,20,35,50,65,85,100];

var selectedFixtures = [];
var selectedFixturesHaveChangedValues = false;
var currMeasuredFixtureId = null;
var referenceFixtureId = -1;

//CIE 1931 tristimulus values from:
//https://wisotop.de/Anhang-Tristimulus-Werte.php
const tristimulusX = [0.3362,0.0049,0.4334,0.7621,1.0622,0.2835];
const tristimulusY = [0.0380,0.3230,0.9950,0.9520,0.6310,0.1070];
const tristimulusZ = [1.7721,0.2720,0.0087,0.0021,0.0008,0.0000];

var height = 0;
var currMax = 0;
var plusSize = 8;

var barsContainer = null;
var currMaxDisplay = null;
var valueContainer = null;
var wavelengthsContainer = null;
var comInput = null;
var currTempDisplay = null;
var currXYZDisplay = null;
var currxyYDisplay = null;
var currRGBDisplay = null;
var livePos = null;
var calcPos = null;

var mixPos = null;
var mixTriangleSvg = null;

var savedValues = [];
var saveHandle = null;

function init()
{
    console.log("Init");
    setInterval(() => {
        var measures = electronDaemon.getMeasures();
        if(measures)
        {
            //console.log(measures);
            measures = JSON.parse(measures);

            if(barsContainer)
            {
                var box = barsContainer.getBoundingClientRect();
                height = box.height;
                currMax = 0;
                for(var i = 0; i < Math.min(activeSettings.channelCount,measures.length); i++)
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
                    if(activeSensor == "7262")
                    {
                        barsContainer.childNodes[i].style.height = (parseInt(measures[i])/currMax)*height+"px";
                        valueContainer.innerHTML += "<label>"+round(measures[i]/currMax,3)+"</label>";
                    }
                    else
                    {
                        barsContainer.childNodes[i].style.height = (parseInt(measures[i])/currMax)*height+"px";
                        valueContainer.innerHTML += "<label>"+round(measures[i],3)+"</label>";
                    }
                }

                if(activeSensor == "7262")
                {
                    for(i in measures)
                    {
                        measures[i] = parseFloat(measures[i]);
                    }
                    convertSpectrumToXYZ(measures,currMax);
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

                if(comInput)
                {
                    comInput.style.backgroundColor = "";
                }
            }
        }
    },250);

    /*setInterval(() => {
        var currentTemp = electronDaemon.getTemp();
        currTempDisplay.innerHTML = JSON.parse(currentTemp)+" &deg;C";
    },5100);*/

    barsContainer = document.getElementById('bars');
    valueContainer = document.getElementById('values');
    wavelengthsContainer = document.getElementById('wavelengths');
    if(activeSettings.channelWavelengths)
    {
        for(var i = 0; i < activeSettings.channelCount; i++)
        {
            wavelengthsContainer.innerHTML += "<label>"+activeSettings.channelWavelengths[i]+"</label>";
        }
    }
    currMaxDisplay = document.getElementById('currentMax');
    currTempDisplay = document.getElementById('currentTemp');
    currXYZDisplay = document.getElementById('currentXYZ');
    currxyYDisplay = document.getElementById('currentxyY');
    currRGBDisplay = document.getElementById('currentRGB');
    namesContainer = document.getElementById('names');
    channelSliders = document.getElementById("channelSliders");
    emitterEdit = document.getElementById("emitterEdit");
    sliderContainer = document.getElementById("sliderContainer");
    calcPos = document.getElementById("calcPos");
    livePos = document.getElementById('livePos');

    mixPos = document.getElementById('mixPos');
    mixTriangleSvg = document.getElementById('mixTriangle');

    calcPosData = document.getElementById('calcPosData');
    mixPosData = document.getElementById('mixPosData');

    var commandInput = document.getElementById('commandInput');
    if(commandInput)
    {
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
    }

    var ckLED = document.getElementById('ckLED');
    if(ckLED)
    {
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

    var ckGrid = document.getElementById('ckGrid');
    if(ckGrid)
    {
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
    }
    updateSerialPorts(true);

    createSurface();
    sendDMX();
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Color conversions //////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function convertSpectrumToXYZ(spectralData,max,noDisp)
{
    var X = 0;
    var Y = 0;
    var Z = 0;
    for(var wI = 0; wI < AS7262.channelWavelengths.length; wI++)
    {
        X += tristimulusX[wI]*(spectralData[wI]/max);
        Y += tristimulusY[wI]*(spectralData[wI]/max);
        Z += tristimulusZ[wI]*(spectralData[wI]/max);
    }
    //console.log(X+" "+Y+" "+Z);
    if(currXYZDisplay && !noDisp)
    {
        currXYZDisplay.innerHTML = round(X,4)+" "+round(Y,4)+" "+round(Z,4);
        XYZtoXY(X,Y,Z);
        XYZtoRGB(X,Y,Z);
    }
    return [X,Y,Z];
}

function XYZtoXY(X,Y,Z,noDisp)
{
    if(currxyYDisplay)
    {
        var x = X/(X+Y+Z);
        var y = Y/(X+Y+Z);
        var Y = Y;

        if(currXYZDisplay && !noDisp)
        {
            currxyYDisplay.innerHTML = round(x,4)+" "+round(y,4)+" "+round(z,4);
            setxy(x,y);
        }
    }
    return [x,y,Y];
}

function XYZtoRGB(tX,tY,tZ)
{
    //sRGB - D65
    // Convert CIE_xyz to linear RGB (values[0..1])
    var r = Math.max(tX * 3.24071     + tY * (-1.53726)  + tZ * (-0.498571),0);
    var g = Math.max(tX * (-0.969258) + tY * 1.87599     + tZ * 0.0415557  ,0);
    var b = Math.max(tX * 0.0556352   + tY * (-0.203996) + tZ * 1.05707    ,0);

    // Convert linearRGB[0..1] to sRGB [0..255]
    /*r *= 255;	g *= 255;	b *= 255;

    // Some values get negative by little rounding errors. Put them to 0.
    if (r < 0){ r = 0; };  if (g < 0){ g = 0; }; if (b < 0){ b = 0; };

    r = parseInt(r);
    g = parseInt(g);
    b = parseInt(b);*/

    //CIE RGB - E
    /*var r = Math.max((2.3706743*tX)+(-0.9000405*tY)+(-0.4706338*tZ),0);
    var g = Math.max((-0.5138850*tX)+(1.4253036*tY)+(0.0885814*tZ),0);
    var b = Math.max((0.0052982*tX)+(-0.0146949*tY)+(1.0093968*tZ),0);*/

    var gamma = 1/2.2;
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
}

function xyToRGB(x,y)
{
    var X = x/y;
    var Y = 1;
    var Z = (1-x-y)/y;

    //sRGB - D65
    /*var r = (X*0.4124564 + Y*0.3575761 + Z*0.1804375);
    var g = (X*0.2126729 + Y*0.7151522 + Z*0.0721750);
    var b = (X*0.0193339 + Y*0.1191920 + Z*0.9503041);*/

    //CIE RGB - E
    var r = (X*0.4887180 + Y*0.3106803 + Z*0.2006017);
    var g = (X*0.1762044 + Y*0.8129847 + Z*0.0108109);
    var b = (X*0.0000000 + Y*0.0102048 + Z*0.9897952);

    var max = Math.max(r,Math.max(g,b));
    r /= max;
    g /= max;
    b /= max;

    var gamma = 1;
    r = normalize(Math.pow(r,gamma));
    g = normalize(Math.pow(g,gamma));
    b = normalize(Math.pow(b,gamma));

    r = Math.round(r*255);
    g = Math.round(g*255);
    b = Math.round(b*255);

    return {r:r,g:g,b:b};
}

function round(number,digits)
{
    number = number*Math.pow(10,digits);
    number = Math.round(number);
    number = number/Math.pow(10,digits);
    return number;
}

function normalize(n)
{
    return Math.max(0,Math.min(n,1));
}

function setxy(x,y)
{
    //Boundaries
    x = Math.min(x,0.9);
    y = Math.min(y,0.9);
    x = Math.max(x,0);
    y = Math.max(y,0);

    //Set position
    if(livePos)
    {
        var box = livePos.parentElement.getBoundingClientRect();
        var sizeX = box.width;
        var sizeY = box.height;
        livePos.parentElement.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97))

        var newPath = "M "+ ((x*sizeX)-plusSize) + "," + parseInt(y*sizeY);
        newPath += " L "+ ((x*sizeX)+plusSize) + "," + parseInt(y*sizeY);
        newPath += " M "+ (x*sizeX) + "," + (parseInt(y*sizeY)-plusSize);
        newPath += " L "+ (x*sizeX) + "," + (parseInt(y*sizeY)+plusSize);
        livePos.setAttribute("d",newPath);
    }
}

function drawMixPos(x,y)
{
    //Boundaries
    x = Math.min(x,0.9);
    y = Math.min(y,0.9);
    x = Math.max(x,0);
    y = Math.max(y,0);

    //Set position
    if(mixPos)
    {
        var box = mixPos.parentElement.getBoundingClientRect();
        var sizeX = box.width;
        var sizeY = box.height;
        mixPos.parentElement.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97))

        var newPath = "M "+ ((x*sizeX)-plusSize) + "," + parseInt(y*sizeY);
        newPath += " L "+ ((x*sizeX)+plusSize) + "," + parseInt(y*sizeY);
        newPath += " M "+ (x*sizeX) + "," + (parseInt(y*sizeY)-plusSize);
        newPath += " L "+ (x*sizeX) + "," + (parseInt(y*sizeY)+plusSize);
        mixPos.setAttribute("d",newPath);
    }
}

function updateSerialPorts(getPorts)
{
    if(getPorts)
    {
        electronDaemon.getAvailableSerialPorts(true).then(()=>{
            serialPorts = JSON.parse(electronDaemon.getAvailableSerialPorts());
            updateSerialPorts();
        });
    }
    else
    {
        comInput = document.getElementById("comInput");
        if(comInput)
        {
            while(comInput.childElementCount > 0)
            {
                comInput.childNodes[0].remove();
            }
            for(idx in serialPorts)
            {
                var newOption = document.createElement('option');
                newOption.value = serialPorts[idx].comName;
                newOption.innerHTML = serialPorts[idx].comName;
                comInput.appendChild(newOption);
            }
            var newOption = document.createElement('option');
            newOption.value = "No Port";
            newOption.innerHTML = "No Port";
            comInput.appendChild(newOption);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Im / Export ////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function save()
{
    var currXY = currxyYDisplay.innerHTML;
    savedValues.push({
        x:currXY.split(" ")[0],
        y:currXY.split(" ")[1]
    });
}

function saveContinuous(event)
{
    if(!saveHandle)
    {
        saveHandle = setInterval(save,1000);
        event.currentTarget.classList.add("rec");
    }
    else
    {
        clearInterval(saveHandle);
        saveHandle = null;
        event.currentTarget.classList.remove("rec");
    }
}

function doExport(arg)
{
    if(arg == "data")
    {
        var filePath = electronDaemon.exportSavedData(JSON.stringify(savedValues));
        console.log("Saved to: "+filePath);
        savedValues = [];
    }
    else if(arg == "emitters")
    {
        for(var sI in selectedFixtures)
        {
            if(selectedFixtures[sI])
            {
                var emitterData = patch[sI].emitterData;
                var filePath = electronDaemon.exportEmitters(JSON.stringify(emitterData),"emitters_"+patch[sI].fixtureType+".json");
                console.log("Emitters saved to: "+filePath);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Emitters ///////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

var emitters = null;

function editEmitter(row)
{
    var fixtureID = row.id.split("_")[1];

    var mainDiv = document.createElement('div');
    mainDiv.id = "emitterMainDiv";

    for(var eI in patch[fixtureID].emitterData)
    {
        var currDataEntry = patch[fixtureID].emitterData[eI];

        var emitterDiv = document.createElement('div');
        emitterDiv.className = "emitterDiv";

        var emitterTitle = document.createElement('div');
        emitterTitle.className = "emitterTitle";
        if(currDataEntry.name == "Weiss")
        {
            emitterTitle.className += " white"
        }
        emitterTitle.innerHTML = "<label>"+currDataEntry.name+"</label>";
        emitterTitle.style.backgroundColor = currDataEntry.color;
        emitterTitle.title = "Click to toggle the measurement values";
        emitterTitle.onclick = function(event)
        {
            var elem = event.currentTarget;
            elem.parentElement.classList.toggle("collapsed");
        }
        emitterDiv.appendChild(emitterTitle);

        var emitterContent = document.createElement('div');
        emitterContent.className = "emitterContent";
        for(var mI in currDataEntry.measures)
        {
            var currMeasure = currDataEntry.measures[mI];
            var currMeasurementBtn = document.createElement('div');
            currMeasurementBtn.className = "measurementBtn";
            currMeasurementBtn.innerText = mI;
            currMeasurementBtn.style.color = currMeasure.color;
            currMeasurementBtn.style.borderColor = currMeasure.color;
            currMeasurementBtn.title = "Spectral: "+currMeasure.spectrum.values.join(" ")+"\n";
            currMeasurementBtn.title += "XYZ: "+currMeasure.XYZ.join(" ")+"\n";
            currMeasurementBtn.title += "xyY: "+currMeasure.xyY.join(" ")+"\n";
            currMeasurementBtn.title += "RGB: "+currMeasure.RGB.join(" ")+"\n";
            emitterContent.appendChild(currMeasurementBtn);
        }
        emitterDiv.appendChild(emitterContent);
        mainDiv.appendChild(emitterDiv);
    }
    throwPopup("Fixture Info",mainDiv,true);
}

function updateSliderDisp(event)
{
    var currSlider = event.currentTarget;
    var slidersOut = currSlider.nextElementSibling;
    slidersOut.value = currSlider.value;

    selectedFixturesHaveChangedValues = true;

    for(var sFI in selectedFixtures)
    {
        if(selectedFixtures[sFI])
        {
            var emitter = currSlider.previousElementSibling.textContent;
            patch[sFI].channels[emitter] = currSlider.value;
            var sheetCell = document.getElementById(sFI+"_"+emitter);
            if(sheetCell)
            {
                sheetCell.innerHTML = currSlider.value;
            }

            if(patch[sFI].calibratedChannels)
            {
                for(var emitterName in patch[sFI].channels)
                {
                    var sheetCell = document.getElementById(sFI+"_"+emitterName);
                    if(sheetCell)
                    {
                        var pos = sheetCell.innerHTML.indexOf("(");
                        if(pos != -1)
                        {
                            sheetCell.innerHTML = sheetCell.innerHTML.substring(0,pos);
                        }
                        sheetCell.innerHTML += "("+parseInt(patch[sFI].calibratedChannels[emitterName]*100)+")";
                    }
                }
            }
        }
    }
}

function getMeasurement(event,level,emitterIdx)
{
    var elem = null;
    var idx = emitterIdx;
    if(level == undefined)
    {
        elem = event.currentTarget;
        level = elem.innerText;
    }
    if(emitterIdx == undefined)
    {
        idx = emitterEdit.idx;
    }
    ;
    var measurement = patch[currMeasuredFixtureId].emitterData[idx].measures[level];
    if(!measurement)
    {
        measurement = {};
    }
    if(activeSensor == "7262")
    {
        measurement.spectrum = {};
        measurement.spectrum.sensor = activeSensor;
        measurement.spectrum.max = currMax;
        measurement.spectrum.values = [];

        for(var i = 0; i < valueContainer.childElementCount; i++)
        {
            var valueNode = valueContainer.childNodes[i];
            measurement.spectrum.values.push(valueNode.innerHTML);
        }
    }
    measurement.xyY = currxyYDisplay.innerText.split(" ");
    measurement.XYZ = currXYZDisplay.innerText.split(" ");
    measurement.RGB = currRGBDisplay.innerText.split(" ");
    measurement.color = currRGBDisplay.style.backgroundColor;
    patch[currMeasuredFixtureId].emitterData[idx].measures[level] = measurement;
    if(elem)
    {
        elem.style.color = measurement.color;
        elem.style.borderColor = measurement.color;
    }
}

var currEmitter = 0;
var currSliderValueIndex = 0;
var currEmitterCount = -1;
function measureAllEmitters(row)
{
    currMeasuredFixtureId = row.id.split("_")[1];
    if(confirm("Are you sure? All past data will be lost."))
    {
        var sliders = document.getElementsByClassName("vertical");
        for(var sI = 0; sI < sliders.length; sI++)
        {
            if(sliders[sI].id == "sliderIntensity")
            {
                sliders[sI].value = 100;
            }
            else
            {
                sliders[sI].value = 0;
            }
        }

        currEmitter = -1;
        currSliderValueIndex = -1;
        currEmitterCount = Object.keys(fixtureTypeLibrary[patch[currMeasuredFixtureId].fixtureType].emitters).length;

        for(var sI in selectedFixtures)
        {
            selectedFixtures[sI] = false;
            var row = document.getElementById("fixtureRow_"+sI);
            if(row)
            {
                row.classList.remove("selected");
            }
        }

        selectedFixtures[currMeasuredFixtureId] = true;
        var row = document.getElementById("fixtureRow_"+currMeasuredFixtureId);
        if(row)
        {
            row.classList.add("selected");
        }

        throwWaitPopup();

        measureNextValue();
    }
}

function measureNextValue()
{
    var nextTimeoutVal = valueChangeTimeout;
    //Measure
    if(currEmitter != -1)
    {
        getMeasurement(null,measureSliderValues[currSliderValueIndex]+"%",currEmitter);
    }

    //Get next measurement job or end loop
    if(currEmitter < currEmitterCount && currSliderValueIndex <= measureSliderValues.length)
    {
        currSliderValueIndex++;
        if(currSliderValueIndex == measureSliderValues.length)
        {
            currSliderValueIndex = 0;
            if(currEmitter < currEmitterCount-1)
            {
                var currentSlider = document.getElementById("slider"+currEmitter);
                if(currentSlider)
                {
                    currentSlider.value = 0;
                }
                calcColorMix({currentTarget:currentSlider});
                nextTimeoutVal = emitterChangeTimeout;
                currEmitter++;
            }
            else
            {
                var currentSlider = document.getElementById("slider"+currEmitter);
                if(currentSlider)
                {
                    currentSlider.value = 0;
                }
                calcColorMix({currentTarget:currentSlider});
                localStorage.setItem("spectral.patch",JSON.stringify(patch));
                closePopup();
                drawColorSpace();
                console.info("Finished automatic measurement");
                return;
            }
        }
    }
    if(currEmitter == -1)
    {
        currEmitter = 0;
        currSliderValueIndex = 0;
        nextTimeoutVal = emitterChangeTimeout;
    }

    //Prepare next output
    var currentSlider = document.getElementById("slider"+currEmitter);
    if(currentSlider)
    {
        currentSlider.value = measureSliderValues[currSliderValueIndex];
    }
    calcColorMix({currentTarget:currentSlider});

    //Continue
    setTimeout(measureNextValue, nextTimeoutVal);
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Color calc /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function sendDMX(event)
{
    if(event)
    {
        updateSliderDisp(event);
    }
    var dmxValues = new Array(512);
    dmxValues.fill(0);
    for(var pI = 0; pI < patch.length; pI++)
    {
        var currFixture = patch[pI];
        var currFixtureType = fixtureTypeLibrary[currFixture.fixtureType];
        for(var channel in currFixture.channels)
        {
            var address = currFixtureType.emitters[channel]+parseInt(currFixture.address)-2;
            if(referenceFixtureId != -1 && selectedFixtures[pI])
            {
                if(patch[pI].calibratedChannels)
                {
                    dmxValues[address] = parseInt(parseInt(currFixture.calibratedChannels[channel])*255);
                }
            }
            else
            {
                dmxValues[address] = parseInt(parseInt(currFixture.channels[channel])/100*255); //avoiding 2.55 due to floating point js errors
            }
        }
    }
    //console.log(dmxValues);
    electronDaemon.sendArtnet(dmxValues);
}

function calcColorMix(event)
{
    sendDMX(event);

    var sliderValues = [];
    var sliders = document.getElementsByClassName("vertical");
    for(var sI = 0; sI < sliders.length; sI++)
    {
        if(sliders[sI].id == "sliderIntensity")
        {
            continue;
        }
        sliderValues.push(sliders[sI].value);
    }

    var posMarkers = document.getElementsByClassName("posMarker");
    while(posMarkers.length)
    {
        posMarkers[0].remove();
    }

    emitters = null;
    var newPath = "";
    var selectedFixturesCount = 0;
    var referencePointCoordinates = null;
    for(var sFI in selectedFixtures)
    {
        if(selectedFixtures[sFI])
        {
            selectedFixturesCount++;
            emitters = patch[sFI].emitterData;

            var calcX = 0.33;
            var calcY = 0.33;
            var calcSpectrum = [0,0,0,0,0,0];
            var calcMax = 0;
            var wroteSpectrum = false;

            for(var sI = 0; sI < sliderValues.length; sI++)
            {
                if(sliderValues[sI] != 0)
                {
                    var currEmitter = emitters[sI];
                    if(JSON.stringify(currEmitter.measures) != JSON.stringify({}))
                    {
                        var minMeasure = 0;
                        var maxMeasure = 0;
                        for(measurePercent in currEmitter.measures)
                        {
                            if(parseInt(measurePercent) <= sliderValues[sI])
                            {
                                minMeasure = measurePercent;
                            }
                            if(parseInt(measurePercent) >= sliderValues[sI])
                            {
                                maxMeasure = measurePercent;
                                break;
                            }
                        }

                        var lastCalcMax = calcMax;
                        if(minMeasure == maxMeasure || sliderValues[sI] < 5)
                        {
                            wroteSpectrum = true;
                            if(currEmitter.measures[maxMeasure].spectrum.max > calcMax)
                            {
                                calcMax = currEmitter.measures[maxMeasure].spectrum.max;
                            }
                            if(sliderValues[sI] < 5)
                            {
                                calcMax = calcMax/(6-sliderValues[sI]);
                            }
                            var ratio = lastCalcMax/calcMax;
                            for(var spI = 0; spI < calcSpectrum.length; spI++)
                            {
                                if(lastCalcMax != 0)
                                {
                                    calcSpectrum[spI] = calcSpectrum[spI]*ratio;
                                }
                                calcSpectrum[spI] += parseFloat(currEmitter.measures[maxMeasure].spectrum.values[spI]);
                            }
                        }
                        else if(maxMeasure != 0)
                        {
                            if(minMeasure)
                            {
                                wroteSpectrum = true;
                                var relation = parseInt(minMeasure)/parseInt(maxMeasure);
                                if((currEmitter.measures[minMeasure].spectrum.max*relation) > calcMax)
                                {
                                    calcMax = (currEmitter.measures[minMeasure].spectrum.max*relation);
                                }
                                var ratio = lastCalcMax/calcMax;
                                //Interpolation
                                for(var spI = 0; spI < calcSpectrum.length; spI++)
                                {
                                    var minVal = parseFloat(currEmitter.measures[minMeasure].spectrum.values[spI]);
                                    var maxVal = parseFloat(currEmitter.measures[maxMeasure].spectrum.values[spI]);
                                    var diff1 = (sliderValues[sI]-parseInt(minMeasure))/(parseInt(maxMeasure)-parseInt(minMeasure));
                                    var temp2 = diff1*(maxVal-minVal);
                                    if(lastCalcMax != 0)
                                    {
                                        calcSpectrum[spI] = calcSpectrum[spI]*ratio;
                                    }
                                    calcSpectrum[spI] += (temp2+minVal);
                                }
                            }
                        }
                        else
                        {
                            console.warn("Failed to interpolate values, due to missing measurement values");
                        }
                    }
                }
            }

            if(wroteSpectrum)
            {
                var calcXYZ = convertSpectrumToXYZ(calcSpectrum,calcMax,true);
                var calcxyY = XYZtoXY(calcXYZ[0],calcXYZ[1],calcXYZ[2],true);
                calcX = Math.min(calcxyY[0],0.9);
                calcY = Math.min(calcxyY[1],0.9);
                calcX = Math.max(calcX,0);
                calcY = Math.max(calcY,0);
                if(sFI == referenceFixtureId)
                {
                    referencePointCoordinates = {x:calcX,y:calcY};
                }
            }
            //Set position
            if(calcPos)
            {
                var box = calcPos.parentElement.getBoundingClientRect();
                var sizeX = box.width;
                var sizeY = box.height;
                calcPos.parentElement.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97));

                if(newPath != "")
                {
                    newPath += " ";
                }

                newPath += "M "+ ((calcX*sizeX)-plusSize) + "," + parseInt(calcY*sizeY);
                newPath += " L "+ ((calcX*sizeX)+plusSize) + "," + parseInt(calcY*sizeY);
                newPath += " M "+ (calcX*sizeX) + "," + (parseInt(calcY*sizeY)-plusSize);
                newPath += " L "+ (calcX*sizeX) + "," + (parseInt(calcY*sizeY)+plusSize);
                calcPos.setAttribute("d",newPath);

                var newPosMarker = document.createElementNS("http://www.w3.org/2000/svg", "text");
                newPosMarker.setAttribute("class","posMarker");
                newPosMarker.setAttribute("x",(calcX*sizeX)+plusSize);
                newPosMarker.setAttribute("y",parseInt(calcY*sizeY)+plusSize);
                newPosMarker.setAttribute("style","fill:red;");
                newPosMarker.innerHTML = (parseInt(sFI)+1);
                calcPos.parentElement.appendChild(newPosMarker);
            }
        }
    }

    //Doing the color correlation
    if(selectedFixturesCount > 1 && referenceFixtureId != -1 && referencePointCoordinates)
    {
        var mixCoordinates = null;
        mixTriangleSvg.parentElement.style.display = "";
        //Get next point inside the combined Gamut if the point is outside
        if(pointIsInside(referencePointCoordinates,currColorSpaceCoordinates))
        {
            console.log("inside");
            mixCoordinates = referencePointCoordinates;
            mixPosData.style.display = "none";
            mixPos.parentElement.style.display = "none";
        }
        else if(pointOnPolygon(referencePointCoordinates,currColorSpaceCoordinates))
        {
            console.log("on line");
            mixCoordinates = referencePointCoordinates;
            mixPosData.style.display = "none";
            mixPos.parentElement.style.display = "none";
        }
        else
        {
            console.log("outside");
            mixPosData.style.display = "";
            mixPos.parentElement.style.display = "";
            //Find vector with the shortest distance to the outside point

            //Get Point on the gamut
            var possiblePoints = [];
            for(var i = 0; i < currColorSpaceCoordinates.length; i++)
            {
                var curr = currColorSpaceCoordinates[i];
                var next = currColorSpaceCoordinates[(i+1)%currColorSpaceCoordinates.length];

                var intersection = getSpPoint(curr,next,referencePointCoordinates,true);
                if(intersection)
                {
                    possiblePoints.push(intersection);
                }
                next = currColorSpaceCoordinates[i+2];
            }

            //Find the point with the shortest distance
            var minDistance = 5;
            var minDistIdx = -1;
            for(var i = 0; i < possiblePoints.length; i++)
            {
                var x = Math.abs(possiblePoints[i].x-referencePointCoordinates.x);
                var y = Math.abs(possiblePoints[i].y-referencePointCoordinates.y);

                var distance = Math.sqrt(Math.pow(x,2)+Math.pow(y,2));
                console.log("X="+x+" Y="+y+" Dist="+distance);

                if(distance < minDistance)
                {
                    minDistIdx = i;
                    minDistance = distance;
                }
            }
            mixCoordinates = possiblePoints[minDistIdx];

            var rgbPoint = xyToRGB(mixCoordinates.x,mixCoordinates.y);
            mixPosData.style.backgroundColor = "rgb("+rgbPoint.r+","+rgbPoint.g+","+rgbPoint.b+")";
            mixPosData.childNodes[1].innerText = "xy: "+round(mixCoordinates.x,4)+" "+round(mixCoordinates.y,4);
            mixPosData.childNodes[2].innerText = "RGB: "+rgbPoint.r+" "+rgbPoint.g+" "+rgbPoint.b;
        }
        var rgbReference = xyToRGB(referencePointCoordinates.x,referencePointCoordinates.y);
        calcPosData.style.backgroundColor = "rgb("+rgbReference.r+","+rgbReference.g+","+rgbReference.b+")";
        calcPosData.childNodes[1].innerText = "xy: "+round(referencePointCoordinates.x,4)+" "+round(referencePointCoordinates.y,4);
        calcPosData.childNodes[2].innerText = "RGB: "+rgbReference.r+" "+rgbReference.g+" "+rgbReference.b;

        //Draw found point
        drawMixPos(mixCoordinates.x,mixCoordinates.y);

        //go thru each fixture
        for(var sFI in selectedFixtures)
        {
            var currentEmitterData = patch[sFI].emitterData;

            //get emitter triangles for this fixture
            var mixTriangles = [];
            for(var i = 0; i < currentEmitterData.length-2; i++)
            {
                for(var j = i+1; j < currentEmitterData.length-1; j++)
                {
                    for(var k = j+1; k < currentEmitterData.length; k++)
                    {
                        console.log("["+sFI+"] Found triangle");
                        var currTestTriangle = [
                            {
                                x:parseFloat(currentEmitterData[i].measures["100%"].xyY[0]),
                                y:parseFloat(currentEmitterData[i].measures["100%"].xyY[1]),
                                name:currentEmitterData[i].name
                            },
                            {
                                x:parseFloat(currentEmitterData[j].measures["100%"].xyY[0]),
                                y:parseFloat(currentEmitterData[j].measures["100%"].xyY[1]),
                                name:currentEmitterData[j].name
                            },
                            {
                                x:parseFloat(currentEmitterData[k].measures["100%"].xyY[0]),
                                y:parseFloat(currentEmitterData[k].measures["100%"].xyY[1]),
                                name:currentEmitterData[k].name
                            }
                        ];

                        var currTestTriangle = sortCombinedPointsCounterClockwise(currTestTriangle,getCenterpoint(currTestTriangle));

                        //get if triangle is relevant and "relevance index"
                        if(pointIsInside(mixCoordinates,currTestTriangle) || pointOnPolygon(mixCoordinates,currTestTriangle))
                        {
                            console.log("["+sFI+"] Mix point is inside");

                            var relevanceDistance = 0;
                            //Add up all vector distances of the triangle points
                            for(var triIdx = 0; triIdx < currTestTriangle.length; triIdx++)
                            {
                                relevanceDistance += Math.sqrt(Math.pow(mixCoordinates.x-currTestTriangle[triIdx].x,2)+Math.pow(mixCoordinates.y-currTestTriangle[triIdx].y,2));
                            }
                            mixTriangles.push({
                                points:currTestTriangle,
                                relevanceDistance:relevanceDistance
                            })
                        }
                    }
                }
            }

            //get best triangle (the one with the shortest distance should win)
            var mixTriangle = mixTriangles.reduce(function(prev, curr) {
                return prev.relevanceDistance < curr.relevanceDistance ? prev : curr;
            });

            var box = calcPos.parentElement.getBoundingClientRect();
            var sizeX = box.width;
            var sizeY = box.height;
            mixTriangleSvg.parentElement.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97));
            var newPath = "";
            for(var i = 0; i < mixTriangle.points.length; i++)
            {
                if(i == 0)
                {
                    newPath += "M ";
                }
                else
                {
                    newPath += "L ";
                }

                newPath += parseInt(mixTriangle.points[i].x*sizeX);
                newPath += ",";
                newPath += parseInt((mixTriangle.points[i].y)*sizeY);
                newPath += " ";
            }
            if(mixTriangle.points[0])
            {
                newPath += "L "+ parseInt(mixTriangle.points[0].x*sizeX) + "," + parseInt((mixTriangle.points[0].y)*sizeY);
            }
            mixTriangleSvg.setAttribute("d",newPath);

            //Perform matrix calculation
            var e1 = xyToRGB(mixTriangle.points[0].x,mixTriangle.points[0].y);
            var e2 = xyToRGB(mixTriangle.points[1].x,mixTriangle.points[1].y);
            var e3 = xyToRGB(mixTriangle.points[2].x,mixTriangle.points[2].y);
            var emitterMatrix = [
                [e1.r,e1.g,e1.b],
                [e2.r,e2.g,e2.b],
                [e3.r,e3.g,e3.b]
            ];
            var invertMatrix = matrix_invert(emitterMatrix);
            var mixPoint = xyToRGB(mixCoordinates.x,mixCoordinates.y);

            var resultIntensities = [
                invertMatrix[0][0]*mixPoint.r + invertMatrix[0][1]*mixPoint.r + invertMatrix[0][2]*mixPoint.r,
                invertMatrix[1][0]*mixPoint.g + invertMatrix[1][1]*mixPoint.g + invertMatrix[1][2]*mixPoint.g,
                invertMatrix[2][0]*mixPoint.b + invertMatrix[2][1]*mixPoint.b + invertMatrix[2][2]*mixPoint.b
            ];

            //Apply dmx values
            patch[sFI].calibratedChannels = {};
            for(var eIdx = 0; eIdx < currentEmitterData.length; eIdx++)
            {
                var emitterFound = false;
                for(var iI = 0; iI < mixTriangle.points.length; iI++)
                {
                    if(mixTriangle.points[iI].name == currentEmitterData[eIdx].name)
                    {
                        patch[sFI].calibratedChannels[currentEmitterData[eIdx].name] = Math.max(0,Math.min(resultIntensities[iI],1));
                        emitterFound = true;
                        break;
                    }
                }
                if(!emitterFound)
                {
                    patch[sFI].calibratedChannels[currentEmitterData[eIdx].name] = 0;
                }
            }
        }
    }
    else
    {
        //Not all conditions for a color correlation fulfilled
        mixPosData.style.display = "none";
        mixPos.parentElement.style.display = "none";
        mixTriangleSvg.parentElement.style.display = "none";
    }
}

function getSpPoint(A,B,C,limit)
{
    var x1=A.x, y1=A.y, x2=B.x, y2=B.y, x3=C.x, y3=C.y;
    var px = x2-x1, py = y2-y1, dAB = px*px + py*py;
    var u = ((x3 - x1) * px + (y3 - y1) * py) / dAB;
    if(limit)
    {
        u = Math.max(0,Math.min(u,1));
    }
    var x = x1 + u * px, y = y1 + u * py;
    return {x:x, y:y}; //this is D
}

var selectedEmitters = [];
var currColorSpaceCoordinates = [];
function drawColorSpace()
{
    var combinedPathDOM = document.getElementById("realColorSpace");
    if(combinedPathDOM)
    {
        var singleColorSpaces = document.getElementsByClassName("singleColorSpace");
        while(singleColorSpaces.length > 0)
        {
            singleColorSpaces[0].remove();
        }

        combinedPathDOM.setAttribute("d","");
        selectedEmitters = [];
        for(var sFI in selectedFixtures)
        {
            if(selectedFixtures[sFI])
            {
                selectedEmitters.push(patch[sFI].emitterData);
            }
        }

        if(selectedEmitters.length > 0)
        {
            var coordinates = [];
            for(var fI = 0; fI < selectedEmitters.length; fI++)
            {
                coordinates[fI] = [];
                var currEmitters = selectedEmitters[fI];
                for(eIdx in currEmitters)
                {
                    var currMeasures = currEmitters[eIdx].measures;
                    if(currMeasures && JSON.stringify(currMeasures) != JSON.stringify({}) && currMeasures["100%"])
                    {
                        var xy = currMeasures["100%"].xyY;
                        coordinates[fI].push(xy);
                    }
                    else
                    {
                        console.warn("Selected Fixture "+fI+" Emitter "+currEmitters[eIdx].name+" has no 100% measures. Failed to get coordinates.");
                    }
                }

                //Draw single color space
                {
                    var box = combinedPathDOM.parentElement.getBoundingClientRect();
                    var sizeX = box.width;
                    var sizeY = box.height;
    
                    var currSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    combinedPathDOM.parentElement.parentElement.insertBefore(currSvg,combinedPathDOM.parentElement);
                    currSvg.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97));
                    currSvg.setAttribute("class","singleColorSpace")
                    var currPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    currSvg.appendChild(currPath);
                    currPath.setAttribute("stroke","black");
                    currPath.setAttribute("stroke-width",".5");
                    currPath.setAttribute("fill","transparent");
    
                    var newPath = "";
                    for(var i = 0; i < Math.min(coordinates[fI].length,3); i++)
                    {
                        if(i == 0)
                        {
                            newPath += "M ";
                        }
                        else
                        {
                            newPath += "L ";
                        }
    
                        newPath += parseInt(coordinates[fI][i][0]*sizeX);
                        newPath += ",";
                        newPath += parseInt((coordinates[fI][i][1])*sizeY);
                        newPath += " ";
                    }
                    if(coordinates[fI][0])
                    {
                        newPath += "L "+ parseInt(coordinates[fI][0][0]*sizeX) + "," + parseInt((coordinates[fI][0][1])*sizeY);
                    }
                    currPath.setAttribute("d",newPath);
                }
            }

            //Analyse the coordinates
            var combinedCoordinates = [];
            {
                // temporary vertex storage
                var vertices1 = [], vertices2 = [];

                // start from the gamut of the first selected fixture
                vertices2.push([ parseFloat(coordinates[0][0][0]), parseFloat(coordinates[0][0][1]) ]);
                vertices2.push([ parseFloat(coordinates[0][1][0]), parseFloat(coordinates[0][1][1]) ]);
                vertices2.push([ parseFloat(coordinates[0][2][0]), parseFloat(coordinates[0][2][1]) ]);

                // clip using the gamuts of all other fixtures
                for(var fI = 1; fI < selectedEmitters.length; fI++) //fixtureIndex
                {
                    var compareGamutCoordinates = coordinates[fI];

                    var clipPoints = []; // == the clipping polygon
                    for (var vI = 0; vI < compareGamutCoordinates.length; vI++) //vertexIndex <-> emitter coordinate index
                    {
                        clipPoints.push([ parseFloat(compareGamutCoordinates[vI][0]), parseFloat(compareGamutCoordinates[vI][1]) ]);
                    }

                    // Attention! clipPoints are expected to be in CCW order emitters should be presorted for this
                    /*var centerPoint = getCenterpoint(combinedCoordinates);
                    combinedCoordinates = sortCombinedPointsCounterClockwise(combinedCoordinates,centerPoint);*/
                    // Eliminate Points inside the rgb gamut

                    // loop through clipping edges
                    for (var vI = 0; vI < 3; vI++) //vertexIndex <-> emitter coordinate index
                    {
                        var clip_point1 = clipPoints[vI];
                        var clip_point2 = clipPoints[(vI + 1) % 3];

                        // swap lists
                        vertices1 = vertices2; // == the W
                        vertices2 = [];

                        for (var i = 0; i < vertices1.length; i++)
                        {
                            var point1 = vertices1[i];
                            var point2 = vertices1[(i + 1) % vertices1.length];

                            //Kreuzprodukt?
                            var d1 = (point1[0] - clip_point1[0]) * (clip_point2[1] - clip_point1[1]) - (point1[1] - clip_point1[1]) * (clip_point2[0] - clip_point1[0]);
                            var d2 = (point2[0] - clip_point1[0]) * (clip_point2[1] - clip_point1[1]) - (point2[1] - clip_point1[1]) * (clip_point2[0] - clip_point1[0]);

                            if (d1 < 0.0 && d2 < 0.0)
                            {
                                // both points are inside, add second point
                                vertices2.push(point2);
                            }
                            else if (d1 >= 0.0 && d2 < 0.0)
                            {
                                // only first point is outside, add intersection and second point
                                var intersection = intersect(point1[0], point1[1], point2[0], point2[1], clip_point1[0], clip_point1[1], clip_point2[0], clip_point2[1]);
                                if (intersection)
                                {
                                    vertices2.push([ intersection.x, intersection.y ]);
                                }
                                vertices2.push(point2);
                            }
                            else if (d1 < 0.0 && d2 >= 0.0)
                            {
                                // only second point is outside, add intersection point
                                var intersection = intersect(point1[0], point1[1], point2[0], point2[1], clip_point1[0], clip_point1[1], clip_point2[0], clip_point2[1]);
                                if (intersection)
                                {
                                    vertices2.push([ intersection.x, intersection.y ]);
                                }
                            }
                        }
                    }
                }

                // copy values to output container
                for (var i = 0; i < vertices2.length; i++)
                {
                    combinedCoordinates.push({ x : vertices2[i][0], y : vertices2[i][1] });
                }
            }

            if(combinedCoordinates.length > 0)
            {
                currColorSpaceCoordinates = JSON.parse(JSON.stringify(combinedCoordinates));

                //Draw combined color space
                var box = combinedPathDOM.parentElement.getBoundingClientRect();
                var sizeX = box.width;
                var sizeY = box.height;
                combinedPathDOM.parentElement.setAttribute("viewBox","0 0 "+(box.width)+" "+(box.height*0.97))

                var newPath = "";
                for(var i = 0; i < combinedCoordinates.length; i++)
                {
                    if(i == 0)
                    {
                        newPath += "M ";
                    }
                    else
                    {
                        newPath += "L ";
                    }

                    newPath += parseInt(combinedCoordinates[i].x*sizeX);
                    newPath += ",";
                    newPath += parseInt((combinedCoordinates[i].y)*sizeY);
                    newPath += " ";
                }
                if(combinedCoordinates.length > 0)
                {
                    newPath += "L "+ parseInt(combinedCoordinates[0].x*sizeX) + "," + parseInt((combinedCoordinates[0].y)*sizeY);
                }
                combinedPathDOM.setAttribute("d",newPath);
            }
        }
    }
}

window.onresize = function()
{
    drawColorSpace();
    calcColorMix();
}

function intersect(x1, y1, x2, y2, x3, y3, x4, y4,force)
{
    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4))
    {
        return false;
    }

    denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

    // Lines are parallel
    if (denominator === 0)
    {
        return false;
    }

    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

    // is the intersection along the segments
    if (force && (ua < 0 || ua > 1 || ub < 0 || ub > 1))
    {
        return false;
    }

    // Return a object with the x and y coordinates of the intersection
    let x = x1 + ua * (x2 - x1);
    let y = y1 + ua * (y2 - y1);

    return {x, y};
}

function pointIsInside(point, vs)
{
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point.x, y = point.y;

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++)
    {
        var xi = vs[i].x, yi = vs[i].y;
        var xj = vs[j].x, yj = vs[j].y;

        var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect)
        {
            inside = !inside;
        }
    }

    return inside;
}

function pointOnPolygon(point, vertices)
{
    for(var idx = 0; idx < vertices.length; idx++)
    {
        for(var idx2 = 0; idx2 < vertices.length; idx2++)
        {
            if(idx != idx2)
            {
                p1 = vertices[idx]
                p2 = vertices[idx2]
                if(intersect(point.x-0.001,point.y-0.001,point.x+0.001,point.y+0.001, p1.x, p1.y, p2.x, p2.y,true))
                {
                    return true;
                }
            }
        }
    }
    return false;
}

function getCenterpoint(coordinates)
{
    var x = 0;
    var y = 0;
    for(var idx in coordinates)
    {
        x += coordinates[idx].x;
        y += coordinates[idx].y;
    }
    console.log("Found center at x="+(x/coordinates.length)+" y="+(y/coordinates.length));
    return {x:(x/coordinates.length), y:(y/coordinates.length)};
}

function sortCombinedPointsCounterClockwise(coordinates,center)
{
    coordinates.sort((a,b) => {
        var angle1 = (Math.atan2(a.x - center.x,a.y - center.y)*(180/Math.PI))+360;
        var angle2 = (Math.atan2(b.x - center.x,b.y - center.y)*(180/Math.PI))+360;
        return (angle1 - angle2);
    });
    return coordinates;
}

// Returns the inverse of matrix `M`.
function matrix_invert(M){
    // I use Guassian Elimination to calculate the inverse:
    // (1) 'augment' the matrix (left) by the identity (on the right)
    // (2) Turn the matrix on the left into the identity by elemetry row ops
    // (3) The matrix on the right is the inverse (was the identity matrix)
    // There are 3 elemtary row ops: (I combine b and c in my code)
    // (a) Swap 2 rows
    // (b) Multiply a row by a scalar
    // (c) Add 2 rows
    
    //if the matrix isn't square: exit (error)
    if(M.length !== M[0].length){return;}
    
    //create the identity matrix (I), and a copy (C) of the original
    var i=0, ii=0, j=0, dim=M.length, e=0, t=0;
    var I = [], C = [];
    for(i=0; i<dim; i+=1){
        // Create the row
        I[I.length]=[];
        C[C.length]=[];
        for(j=0; j<dim; j+=1){
            
            //if we're on the diagonal, put a 1 (for identity)
            if(i==j){ I[i][j] = 1; }
            else{ I[i][j] = 0; }
            
            // Also, make the copy of the original
            C[i][j] = M[i][j];
        }
    }
    
    // Perform elementary row operations
    for(i=0; i<dim; i+=1){
        // get the element e on the diagonal
        e = C[i][i];
        
        // if we have a 0 on the diagonal (we'll need to swap with a lower row)
        if(e==0){
            //look through every row below the i'th row
            for(ii=i+1; ii<dim; ii+=1){
                //if the ii'th row has a non-0 in the i'th col
                if(C[ii][i] != 0){
                    //it would make the diagonal have a non-0 so swap it
                    for(j=0; j<dim; j++){
                        e = C[i][j];       //temp store i'th row
                        C[i][j] = C[ii][j];//replace i'th row by ii'th
                        C[ii][j] = e;      //repace ii'th by temp
                        e = I[i][j];       //temp store i'th row
                        I[i][j] = I[ii][j];//replace i'th row by ii'th
                        I[ii][j] = e;      //repace ii'th by temp
                    }
                    //don't bother checking other rows since we've swapped
                    break;
                }
            }
            //get the new diagonal
            e = C[i][i];
            //if it's still 0, not invertable (error)
            if(e==0){return}
        }
        
        // Scale this row down by e (so we have a 1 on the diagonal)
        for(j=0; j<dim; j++){
            C[i][j] = C[i][j]/e; //apply to original matrix
            I[i][j] = I[i][j]/e; //apply to identity
        }
        
        // Subtract this row (scaled appropriately for each row) from ALL of
        // the other rows so that there will be 0's in this column in the
        // rows above and below this one
        for(ii=0; ii<dim; ii++){
            // Only apply to other rows (we want a 1 on the diagonal)
            if(ii==i){continue;}
            
            // We want to change this element to 0
            e = C[ii][i];
            
            // Subtract (the row above(or below) scaled by e) from (the
            // current row) but start at the i'th column and assume all the
            // stuff left of diagonal is 0 (which it should be if we made this
            // algorithm correctly)
            for(j=0; j<dim; j++){
                C[ii][j] -= e*C[i][j]; //apply to original matrix
                I[ii][j] -= e*I[i][j]; //apply to identity
            }
        }
    }
    
    //we've done all operations, C should be the identity
    //matrix I should be the inverse:
    return I;
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Fixture Selection //////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function updateSelection(row)
{
    if(selectedFixturesHaveChangedValues)
    {
        for(var sI in selectedFixtures)
        {
            selectedFixtures[sI] = false;
            var unselectRow = document.getElementById("fixtureRow_"+sI);
            if(unselectRow)
            {
                unselectRow.classList.remove("selected");
            }
        }
    }

    var fixtureID = row.id.split("_")[1];
    if(!selectedFixtures[fixtureID])
    {
        row.classList.add("selected");
        selectedFixtures[fixtureID] = true;
    }
    else
    {
        row.classList.remove("selected");
        selectedFixtures[fixtureID] = false;
    }
    drawColorSpace();

    //Set faders to the values of the last selected fixture
    var currFixture = patch[fixtureID];
    for(var channel in currFixture.channels)
    {
        var currSlider = document.getElementById("slider_"+channel);
        if(currSlider)
        {
            currSlider = currSlider.nextElementSibling;
            currSlider.value = currFixture.channels[channel];
            currSlider.nextElementSibling.innerHTML = currFixture.channels[channel];
        }
    }
    selectedFixturesHaveChangedValues = false;
}