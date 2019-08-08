const electronDaemon = require('electron').remote.require('./index.js');

var serialPorts = [];

//AS7261 settings
const AS7261 = {
    channelCount:6,
    channelNames:["X","Y","Z","Dark","C","NIR"],
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
    "eurolight ml 56":{
        intensity:false,
        emitters:{
            Rot:1,
            Grün:2,
            Blau:3,
            Amber:4,
            Weiss:5
        }
    }
}

const emitterDafaultColors = {
    Rot:  "#ff0000",
    Grün: "#00ff00",
    Blau: "#0000ff",
    Amber:"#ffaa00",
    Weiss:"#ffffff"
};

const measureSilderValues = [5,10,20,35,50,65,85,100];

var currentFixture = "Arri Skypannel Mode RGBW";
var currentFixtureHasIntensity = true;

//CIE 1931 tristimulus values from:
//https://wisotop.de/Anhang-Tristimulus-Werte.php
const tristimulusX = [0.3362,0.0049,0.4334,0.7621,1.0622,0.2835];
const tristimulusY = [0.0380,0.3230,0.9950,0.9520,0.6310,0.1070];
const tristimulusZ = [1.7721,0.2720,0.0087,0.0021,0.0008,0.0000];

var height = 0;
var cieXdiv = 0;
var cieYdiv = 0;
var currMax = 0;

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
var mixPos = null;

var savedValues = [];
var saveHandle = null;

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
                currMax = 0;
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

                comInput.style.backgroundColor = "";
            }
        }
    },250);

    setInterval(() => {
        var currentTemp = electronDaemon.getTemp();
        currTempDisplay.innerHTML = JSON.parse(currentTemp)+" &deg;C";
    },5100);

    comInput = document.getElementById("comInput");
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
    emitterList = document.getElementById("emitterList");
    emitterEdit = document.getElementById("emitterEdit");
    sliderContainer = document.getElementById("sliderContainer");
    mixPos = document.getElementById("mixPos");

    comInput.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            electronDaemon.setSerialPath(input.value);
            if(input.value == "No Port")
            {
                portFail();
            }
        }
    }

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

    var sensorSelect = document.getElementById('sensorSelect');
    sensorSelect.value = activeSensor;
    sensorSelect.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            electronDaemon.setSerialPath(input.value);

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

    var fixtureSelect = document.getElementById('fixtureSelect');
    if(fixtureSelect)
    {
        for(var fixture in fixtureTypeLibrary)
        {
            var option = document.createElement('option');
            option.innerHTML = fixture;
            option.value = fixture;
            fixtureSelect.appendChild(option);
        }

        fixtureSelect.onchange = function(event)
        {
            var elem = event.currentTarget;

            if(confirm("Do you want to save the current emitters?"))
            {
                doExport("emitters");
            }

            currentFixture = elem.value;
            currentFixtureHasIntensity = fixtureTypeLibrary[currentFixture].intensity == true;

            doImport("emitters",true);
        }
    }

    createSurface();
    doImport("emitters",true);
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
    comInput.style.backgroundColor = "red";
}

function convertSpectrumToXYZ(spectralData,max,noDisp)
{
    var X = 0;
    var Y = 0;
    var Z = 0;
    for(var wI = 0; wI < activeSettings.channelWavelengths.length; wI++)
    {
        X += tristimulusX[wI]*(spectralData[wI]/max);
        Y += tristimulusY[wI]*(spectralData[wI]/max);
        Z += tristimulusZ[wI]*(spectralData[wI]/max);
    }
    console.log(X+" "+Y+" "+Z);
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
        var z = Z/(X+Y+Z);

        if(currXYZDisplay && !noDisp)
        {
            currxyYDisplay.innerHTML = round(x,4)+" "+round(y,4)+" "+round(z,4);
            setxy(x,y);
        }
    }
    return [x,y,z]
}

function XYZtoRGB(tX,tY,tZ)
{
    /*// Convert CIE_xyz to linear RGB (values[0..1])
    var r = (tX * 3.24071	 + tY * (-1.53726)  + tZ * (-0.498571));
    var g = (tX * (-0.969258) + tY * 1.87599     + tZ * 0.0415557);
    var b = (tX * 0.0556352   + tY * (-0.203996) + tZ * 1.05707);

    // Convert linearRGB[0..1] to sRGB [0..255]
    r *= 255;	g *= 255;	b *= 255;

    // Some values get negative by little rounding errors. Put them to 0.
    if (r < 0){ r = 0; };  if (g < 0){ g = 0; }; if (b < 0){ b = 0; };

    r = parseInt(r);
    g = parseInt(g);
    b = parseInt(b);*/

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
    //Boundaries
    x = Math.min(x,0.9);
    y = Math.min(y,0.9);
    x = Math.max(x,0);
    y = Math.max(y,0);

    //Set position
    if(ciePos)
    {
        ciePos.style.bottom = (y*10*cieYdiv)+"px";
        ciePos.style.left = (x*10*cieXdiv)+"px";
    }
    console.log("Set x="+x+" y="+y+" bottom="+(y*10*cieYdiv)+"px left="+(x*10*cieXdiv)+"px");
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
        //comInput = document.getElementById("comInput");
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
        var filePath = electronDaemon.exportEmitters(JSON.stringify(emitters),"emitters_"+currentFixture+".json");
        console.log("Emitters saved to: "+filePath);
    }
}

function doImport(arg,force)
{
    if(arg == "emitters")
    {
        if(force || confirm("Do you want to overwrite the current emitters?"))
        {
            for(var eNI = 0; eNI < emitterList.childElementCount-1; eNI++)
            {
                emitterList.childNodes[eNI].remove();
                eNI--;
            }
            sliderContainer.innerHTML = "";

            var emitterData = electronDaemon.importEmitters("emitters_"+currentFixture+".json");
            if(emitterData)
            {
                emitters = JSON.parse(emitterData);

                if(currentFixtureHasIntensity)
                {
                    var newEmitter = document.createElement('div');
                    newEmitter.className = "emitterEntry";
                    newEmitter.id = "intensity";
                    newEmitter.name = "intensity";
                    newEmitter.style.borderColor = "none";
                    var emitterLabel = document.createElement('label');
                    emitterLabel.innerHTML = "Intensity";
                    newEmitter.appendChild(emitterLabel);
                    emitterList.insertBefore(newEmitter,emitterList.lastElementChild);

                    var newSliderContainer = document.createElement('div');
                    newSliderContainer.className = "sliderContainer";
                    var newSpaceLabel = document.createElement('div');
                    newSpaceLabel.innerHTML = "Intensity";
                    newSpaceLabel.className = "spaceLabel";
                    newSliderContainer.appendChild(newSpaceLabel);
                    var newSlider = document.createElement('input');
                    newSlider.className = "vertical";
                    newSlider.id = "sliderIntensity";
                    newSlider.type = "range";
                    newSlider.min = 0;
                    newSlider.max = 100;
                    newSlider.value = 100;
                    newSlider.oninput = sendDMX;
                    newSliderContainer.appendChild(newSlider);
                    var newSliderDisp = document.createElement('output');
                    newSliderDisp.id = "sliderIntensityDisp";
                    newSliderDisp.for = "sliderIntensity";
                    newSliderDisp.value = "100";
                    newSliderContainer.appendChild(newSliderDisp);
                    sliderContainer.appendChild(newSliderContainer);
                }

                for(var eI = 0; eI < emitters.length; eI++)
                {
                    var newEmitter = document.createElement('div');
                    newEmitter.className = "emitterEntry";
                    newEmitter.id = "emitter"+eI;
                    newEmitter.name = eI;
                    newEmitter.style.borderColor = emitters[eI].color;
                    var emitterLabel = document.createElement('label');
                    emitterLabel.innerHTML = emitters[eI].name;
                    newEmitter.appendChild(emitterLabel);
                    emitterList.insertBefore(newEmitter,emitterList.lastElementChild);
                    newEmitter.onclick = editEmitter;

                    var newSliderContainer = document.createElement('div');
                    newSliderContainer.className = "sliderContainer";
                    var newSpaceLabel = document.createElement('div');
                    newSpaceLabel.innerHTML = emitters[eI].name;
                    newSpaceLabel.className = "spaceLabel";
                    newSliderContainer.appendChild(newSpaceLabel);
                    var newSlider = document.createElement('input');
                    newSlider.className = "vertical";
                    newSlider.id = "slider"+eI;
                    newSlider.type = "range";
                    newSlider.min = 0;
                    newSlider.max = 100;
                    newSlider.step = 5;
                    newSlider.value = 0;
                    newSlider.oninput = calcColorMix;
                    newSliderContainer.appendChild(newSlider);
                    var newSliderDisp = document.createElement('output');
                    newSliderDisp.id = "sliderDisp"+eI;
                    newSliderDisp.for = "slider"+eI;
                    newSliderDisp.value = "0";
                    newSliderContainer.appendChild(newSliderDisp);
                    sliderContainer.appendChild(newSliderContainer);
                }
            }
            else
            {
                console.error("Failed to import emitter data");

                if(currentFixtureHasIntensity)
                {
                    var newEmitter = document.createElement('div');
                    newEmitter.className = "emitterEntry";
                    newEmitter.id = "intensity";
                    newEmitter.name = "intensity";
                    newEmitter.style.borderColor = "none";
                    var emitterLabel = document.createElement('label');
                    emitterLabel.innerHTML = "Intensity";
                    newEmitter.appendChild(emitterLabel);
                    emitterList.insertBefore(newEmitter,emitterList.lastElementChild);

                    var newSliderContainer = document.createElement('div');
                    newSliderContainer.className = "sliderContainer";
                    var newSpaceLabel = document.createElement('div');
                    newSpaceLabel.innerHTML = "Intensity";
                    newSpaceLabel.className = "spaceLabel";
                    newSliderContainer.appendChild(newSpaceLabel);
                    var newSlider = document.createElement('input');
                    newSlider.className = "vertical";
                    newSlider.id = "sliderIntensity";
                    newSlider.type = "range";
                    newSlider.min = 0;
                    newSlider.max = 100;
                    newSlider.value = 100;
                    newSlider.oninput = sendDMX;
                    newSliderContainer.appendChild(newSlider);
                    var newSliderDisp = document.createElement('output');
                    newSliderDisp.id = "sliderIntensityDisp";
                    newSliderDisp.for = "sliderIntensity";
                    newSliderDisp.value = "100";
                    newSliderContainer.appendChild(newSliderDisp);
                    sliderContainer.appendChild(newSliderContainer);
                }

                //auto create emitters from fixturetype
                var fTEmitters = fixtureTypeLibrary[currentFixture].emitters;
                var eI = 0;
                for(var fTE in fTEmitters)
                {
                    var defaultColor = emitterDafaultColors[fTE] || "#ffffff";
                    emitters.push({
                        name:"Emitter "+(emitters.length+1),
                        color:defaultColor,
                        measures: {}
                    });


                    var newEmitter = document.createElement('div');
                    newEmitter.className = "emitterEntry";
                    newEmitter.id = "emitter"+eI;
                    newEmitter.name = eI;
                    newEmitter.style.borderColor = defaultColor;
                    var emitterLabel = document.createElement('label');
                    emitterLabel.innerHTML = fTE;
                    newEmitter.appendChild(emitterLabel);
                    emitterList.insertBefore(newEmitter,emitterList.lastElementChild);
                    newEmitter.onclick = editEmitter;

                    var newSliderContainer = document.createElement('div');
                    newSliderContainer.className = "sliderContainer";
                    var newSpaceLabel = document.createElement('div');
                    newSpaceLabel.innerHTML = fTE;
                    newSpaceLabel.className = "spaceLabel";
                    newSliderContainer.appendChild(newSpaceLabel);
                    var newSlider = document.createElement('input');
                    newSlider.className = "vertical";
                    newSlider.id = "slider"+eI;
                    newSlider.type = "range";
                    newSlider.min = 0;
                    newSlider.max = 100;
                    newSlider.step = 5;
                    newSlider.value = 0;
                    newSlider.oninput = calcColorMix;
                    newSliderContainer.appendChild(newSlider);
                    var newSliderDisp = document.createElement('output');
                    newSliderDisp.id = "sliderDisp"+eI;
                    newSliderDisp.for = "slider"+eI;
                    newSliderDisp.value = "0";
                    newSliderContainer.appendChild(newSliderDisp);
                    sliderContainer.appendChild(newSliderContainer);
                    eI++;
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Emitters ///////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

var emitters = [];
var emitterList = null;
var emitterEdit = null;

var sliderContainer = null;

function addEmitter()
{
    var newEmitter = document.createElement('div');
    newEmitter.className = "emitterEntry";
    newEmitter.id = "emitter"+emitters.length;
    newEmitter.name = emitters.length;
    var emitterLabel = document.createElement('label');
    emitterLabel.innerHTML = "Emitter "+(emitters.length+1);
    newEmitter.appendChild(emitterLabel);
    emitterList.insertBefore(newEmitter,emitterList.lastElementChild);
    newEmitter.onclick = editEmitter;

    emitters.push({
        name:"Emitter "+(emitters.length+1),
        color:"#FFFFFF",
        measures: {}
    });

    var newSliderContainer = document.createElement('div');
    newSliderContainer.className = "sliderContainer";
    var newSpaceLabel = document.createElement('div');
    newSpaceLabel.innerHTML = "Emitter "+(emitters.length+1);
    newSpaceLabel.className = "spaceLabel";
    newSliderContainer.appendChild(newSpaceLabel);
    var newSlider = document.createElement('input');
    newSlider.className = "vertical";
    newSlider.id = "slider"+(emitters.length-1);
    newSlider.type = "range";
    newSlider.min = 0;
    newSlider.max = 100;
    newSlider.step = 5;
    newSlider.value = 0;
    newSlider.oninput = calcColorMix;
    newSliderContainer.appendChild(newSlider);
    var newSliderDisp = document.createElement('output');
    newSliderDisp.id = "sliderDisp"+(emitters.length-1);
    newSliderDisp.for = "slider"+(emitters.length-1);
    newSliderDisp.value = "0";
    newSliderContainer.appendChild(newSliderDisp);
    sliderContainer.appendChild(newSliderContainer);
}

function editEmitter(event)
{
    var elem = event.currentTarget;
    var idx = elem.name;
    toggleEmitterEdit();

    emitterEdit.idx = idx;

    var editEmitterName = document.getElementById("editEmitterName");
    editEmitterName.value = emitters[idx].name;

    var editEmitterColor = document.getElementById("editEmitterColor");
    editEmitterColor.value = emitters[idx].color;

    var measurementBtns = document.getElementById("measures").children;
    for(var mI = 0; mI < measurementBtns.length; mI++)
    {
        var currMeasurementBtn = measurementBtns[mI];
        if(emitters[idx].measures && emitters[idx].measures[currMeasurementBtn.innerText])
        {
            currMeasurementBtn.style.color = emitters[idx].measures[currMeasurementBtn.innerText].color;
            currMeasurementBtn.style.borderColor = emitters[idx].measures[currMeasurementBtn.innerText].color;
        }
        else
        {
            currMeasurementBtn.style.color = "white";
            currMeasurementBtn.style.borderColor = "white";
        }
    }
}

function toggleEmitterEdit()
{
    if(emitterList.style.display == "none")
    {
        emitterList.style.display = "";
        emitterEdit.style.display = "none";
    }
    else
    {
        emitterList.style.display = "none";
        emitterEdit.style.display = "";
        var editEmitterName = document.getElementById("editEmitterName");
        editEmitterName.focus();
        setTimeout(() => {
            editEmitterName.select();
        },100);
    }
}

function saveEmitter()
{
    var idx = emitterEdit.idx;
    var editEmitterName = document.getElementById("editEmitterName");
    var editEmitterColor = document.getElementById("editEmitterColor");
    emitters[idx].name = editEmitterName.value;
    emitters[idx].color = editEmitterColor.value;

    var emitterNode = document.getElementById("emitter"+idx);
    if(emitterNode)
    {
        emitterNode.style.borderColor = emitters[idx].color;
        emitterNode.childNodes[0].innerHTML = emitters[idx].name;
    }
    toggleEmitterEdit();
}

function deleteEmitter()
{
    var idx = emitterEdit.idx;
    if(confirm("Are you sure, that you want to delete the emitter '"+emitters[idx].name+"'?"))
    {
        var emitterNode = document.getElementById("emitter"+idx);
        if(emitterNode)
        {
            emitters.splice(idx,1);
            emitterNode.remove();
        }
        var sliderNode = document.getElementById("slider"+idx);
        if(sliderNode)
        {
            sliderNode.parentElement.remove();
        }
        toggleEmitterEdit();
    }
}

function updateSliderDisp(event)
{
    var currSlider = event.currentTarget;
    var slidersOut = currSlider.nextElementSibling;
    slidersOut.value = currSlider.value;
}

function getMeasurement(event)
{
    var elem = event.currentTarget;
    var idx = emitterEdit.idx;
    var measurement = emitters[idx].measures[elem.innerText];
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
    emitters[idx].measures[elem.innerText] = measurement;
    elem.style.color = measurement.color;
    elem.style.borderColor = measurement.color;
}

function measureAllEmitters()
{
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
        for(var sI = 0; sI < sliders.length; sI++)
        {
            if(sliders[sI].id != "sliderIntensity")
            {
                var emitterName = sliders[sI].previousElementSibling.textContent;
                measureSilderValues;
                setTimeout(measureNextValue, 400);
            }
        }
    }
}

function measureNextValue()
{

}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Color calc /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function sendDMX(event)
{
    updateSliderDisp(event);
    var sliderValues = [];
    var dmxValues = [];
    var sliders = document.getElementsByClassName("vertical");
    for(var sI = 0; sI < sliders.length; sI++)
    {
        if(sliders[sI].id == "sliderIntensity")
        {
            continue;
        }
        sliderValues.push(sliders[sI].value);
        var emitterName = sliders[sI].previousElementSibling.textContent;
        if(fixtureTypeLibrary[currentFixture].emitters[emitterName])
        {
            dmxValues[fixtureTypeLibrary[currentFixture].emitters[emitterName]-1] = sliders[sI].value;
        }
        else
        {
            console.error("Failed to find emitter "+emitterName+" in fixture "+currentFixture);
        }
    }

    if(currentFixtureHasIntensity)
    {
        var intensitySlider = document.getElementById("sliderIntensity");
        if(intensitySlider)
        {
            dmxValues[fixtureTypeLibrary[currentFixture].intensity-1] = intensitySlider.value;
        }
    }
    electronDaemon.sendArtnet(dmxValues);
    return sliderValues;
}

function calcColorMix(event)
{
    var sliderValues = sendDMX(event);
    var calcX = 0.3;
    var calcY = 0.3;
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

                if(minMeasure == maxMeasure)
                {
                    wroteSpectrum = true;
                    if(currEmitter.measures[minMeasure].spectrum.max > calcMax)
                    {
                        calcMax = currEmitter.measures[minMeasure].spectrum.max;
                    }
                    for(var spI = 0; spI < calcSpectrum.length; spI++)
                    {
                        calcSpectrum[spI] += parseFloat(currEmitter.measures[minMeasure].spectrum.values[spI]);
                    }
                }
                else
                {
                    wroteSpectrum = true;
                    var relation = parseInt(minMeasure)/parseInt(maxMeasure);
                    if((currEmitter.measures[minMeasure].spectrum.max*relation) > calcMax)
                    {
                        calcMax = (currEmitter.measures[minMeasure].spectrum.max*relation);
                    }
                    //Interpolation
                    for(var spI = 0; spI < calcSpectrum.length; spI++)
                    {
                        var minVal = parseFloat(currEmitter.measures[minMeasure].spectrum.values[spI]);
                        var maxVal = parseFloat(currEmitter.measures[maxMeasure].spectrum.values[spI]);
                        var diff1 = (sliderValues[sI]-parseInt(minMeasure))/(parseInt(maxMeasure)-parseInt(minMeasure));
                        var temp2 = diff1*(maxVal-minVal);
                        calcSpectrum[spI] += (temp2+minVal);
                    }
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
    }

    if(cieDisp && cieXdiv == 0)
    {
        var box = cieDisp.getBoundingClientRect();
        cieXdiv = box.width/9;
        cieYdiv = box.height/9;
    }

    var calcBottom = round((calcY*10*cieYdiv),3);
    var calcLeft = round((calcX*10*cieXdiv),3);
    mixPos.style.bottom = calcBottom+"px";
    mixPos.style.left = calcLeft+"px";
}