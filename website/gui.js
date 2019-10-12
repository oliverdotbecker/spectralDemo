var settings = localStorage.getItem("spectral.settings") || "{}";
settings = JSON.parse(settings);
var patch = localStorage.getItem("spectral.patch") || "[]";
patch = JSON.parse(patch);

for(var pI = 0; pI < patch.length; pI++)
{
    patch[pI].calibratedChannels = null;
}

const emitterDefaultColors = {
    Rot:  "#ff0000",
    Grün: "#00ff00",
    Blau: "#0000ff",
    Amber:"#ffaa00",
    Weiss:"#ffffff"
};

var namesContainer = null;
var channelSliders = null;
var sliderContainer = null;

function createSurface()
{
    barsContainer.innerHTML = "";
    namesContainer.innerHTML = "";
    for(var i = 0; i < activeSettings.channelCount; i++)
    {
        var newBar = document.createElement('div');
        newBar.className = "bar"
        newBar.title = activeSettings.channelNames[i].replace(/&uuml;/g,"ü");
        newBar.style.backgroundColor = activeSettings.channelColors[i];
        barsContainer.appendChild(newBar);

        var newLabel = document.createElement('label');
        newLabel.innerHTML = activeSettings.channelNames[i];
        namesContainer.appendChild(newLabel);
    }
    createFixtureSheet();
    createSliders();
}

function createSliders()
{
    channelSliders.innerHTML = "";
    sliderContainer.innerHTML = "";

    var usedChannels = {
        intensity:false,
        Rot:false,
        Grün:false,
        Blau:false,
        Weiss:false,
        Amber:false
    };

    for(var pI = 0; pI < patch.length; pI++)
    {
        var fTLibEntry = fixtureTypeLibrary[patch[pI].fixtureType];
        if(fTLibEntry.intensity)
        {
            usedChannels.intensity = true;
        }
        for(var eIdx in fTLibEntry.emitters)
        {
            usedChannels[eIdx] = true;
        }
    }

    if(usedChannels.intensity)
    {
        var newEmitter = document.createElement('div');
        newEmitter.className = "emitterEntry";
        newEmitter.id = "intensity";
        newEmitter.name = "intensity";
        newEmitter.style.borderColor = "none";
        var emitterLabel = document.createElement('label');
        emitterLabel.innerHTML = "Intensity";
        newEmitter.appendChild(emitterLabel);
        channelSliders.insertBefore(newEmitter,channelSliders.lastElementChild);

        var newSliderContainer = document.createElement('div');
        newSliderContainer.className = "sliderContainer";
        var newSpaceLabel = document.createElement('div');
        newSpaceLabel.innerHTML = "intensity";
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

    var eI = 0;
    for(var fTE in usedChannels)
    {
        if(fTE == "intensity")
        {
            continue;
        }
        if(usedChannels[fTE])
        {
            var defaultColor = emitterDefaultColors[fTE] || "#ffffff";
    
            var newEmitter = document.createElement('div');
            newEmitter.className = "emitterEntry";
            newEmitter.id = "emitter"+eI;
            newEmitter.name = eI;
            newEmitter.style.borderColor = defaultColor;
            var emitterLabel = document.createElement('label');
            emitterLabel.innerHTML = fTE;
            newEmitter.appendChild(emitterLabel);
            channelSliders.appendChild(newEmitter);
    
            var newSliderContainer = document.createElement('div');
            newSliderContainer.className = "sliderContainer";
            var newSpaceLabel = document.createElement('div');
            newSpaceLabel.innerHTML = fTE;
            newSpaceLabel.className = "spaceLabel";
            newSpaceLabel.id = "slider_"+fTE;
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

    //Adding mix info
    var mixInfo = document.createElement('div');
    calcPosData = document.createElement('div');
    calcPosData.className = "mixInfo";
    calcPosData.id = "calcPosData";
    calcPosData.innerHTML = "<div>Ref</div><div>xy: 0.33 0.33</div><div>RGB: 255 255 255</div>";
    mixInfo.appendChild(calcPosData);
    mixPosData = document.createElement('div');
    mixPosData.className = "mixInfo";
    mixPosData.id = "mixPosData";
    mixPosData.innerHTML = "<div>Mix</div><div>xy: 0.33 0.33</div><div>RGB: 255 255 255</div>";
    mixInfo.appendChild(mixPosData);
    mixPosData.style.display = "none";
    sliderContainer.appendChild(mixInfo);
}

function openSensorSettings()
{
    var newTable = document.createElement('table');
    var newTr = document.createElement('tr');
    var newTd = document.createElement('td');

    //Com Port
    var newLabel = document.createElement('label');
    newLabel.innerText = "COM Port:";
    newTd.appendChild(newLabel);
    newTr.appendChild(newTd);
    newTd = document.createElement('td');
    var newPortSelect = document.createElement('select');
    newPortSelect.id = "comInput";
    newPortSelect.list = "portList";
    newPortSelect.onchange = function(event)
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
    for(idx in serialPorts)
    {
        var newOption = document.createElement('option');
        newOption.value = serialPorts[idx].comName;
        newOption.innerHTML = serialPorts[idx].comName;
        newPortSelect.appendChild(newOption);
    }
    var newOption = document.createElement('option');
    newOption.value = "No Port";
    newOption.innerHTML = "No Port";
    newPortSelect.appendChild(newOption);
    newPortSelect.value = settings.comPort;
    newTd.appendChild(newPortSelect);
    newTr.appendChild(newTd);
    newTable.appendChild(newTr);

    //Sensor
    newTr = document.createElement('tr');
    newTd = document.createElement('td');
    var newLabel = document.createElement('label');
    newLabel.innerText = "Sensor:";
    newTd.appendChild(newLabel);
    newTr.appendChild(newTd);
    newTd = document.createElement('td');
    var newSensorSelect = document.createElement('select');
    newSensorSelect.id = "sensorSelect";
    var newOption = document.createElement('option');
    newOption.value = "7261";
    newOption.innerHTML = "AS 7261";
    newSensorSelect.appendChild(newOption);
    var newOption = document.createElement('option');
    newOption.value = "7262";
    newOption.innerHTML = "AS 7262";
    newSensorSelect.appendChild(newOption);
    newSensorSelect.value = activeSensor;
    newSensorSelect.onchange = function(event)
    {
        var input = event.currentTarget;
        if(input)
        {
            if(input.value == "7261")
            {
                activeSettings = AS7261;
                activeSensor = "7261";
                currMaxDisplay.parentElement.style.display = "none";
                var waveLengthContainer = document.getElementById("wavelengths");
                if(waveLengthContainer)
                {
                    waveLengthContainer.style.display = "none";
                }
                electronDaemon.setSensor(activeSensor);
            }
            else
            {
                activeSettings = AS7262;
                activeSensor = "7262";
                currMaxDisplay.parentElement.style.display = "";
                var waveLengthContainer = document.getElementById("wavelengths");
                if(waveLengthContainer)
                {
                    waveLengthContainer.style.display = "";
                }
                electronDaemon.setSensor(activeSensor);
            }
            createSurface();
        }
    }
    newTd.appendChild(newSensorSelect);
    newTr.appendChild(newTd);
    newTable.appendChild(newTr);

    updateSerialPorts(true);

    throwPopup("Sensor Settings",newTable,true,[
        ["Close",closePopup],
        ["Apply",(event) => {
            if(!comInput)
            {
                comInput = document.getElementById("comInput");
            }
            settings.comPort = comInput.value;
            settings.sensor = activeSensor;
            localStorage.setItem("spectral.settings",JSON.stringify(settings));
            closePopup();
        }]
    ]);
}

function portFail()
{
    if(!comInput)
    {
        comInput = document.getElementById("comInput");
    }
    if(comInput)
    {
        comInput.style.backgroundColor = "red";
    }
}

function openPatch()
{
    var newTable = document.createElement('table');
    newTable.id = "patchTable";
    for(var pI = 0; pI < patch.length; pI++)
    {
        newTable.appendChild(addPatchLine(patch[pI]));
    }

    var newTr = document.createElement('tr');
    var newTd = document.createElement('td');
    newTd.colSpan = 3;
    var newLabel = document.createElement('label');
    newLabel.innerText = "Add a fixture";
    newTd.appendChild(newLabel);
    newTr.appendChild(newTd);
    newTr.onclick = function(event)
    {
        var table = event.currentTarget.parentElement;
        table.insertBefore(addPatchLine(),event.currentTarget);
    }
    newTable.appendChild(newTr);

    throwPopup("Patch",newTable,true,[
        ["Close",closePopup],
        ["Apply",(event) => {
            var patchTable = document.getElementById("patchTable");
            if(patchTable)
            {
                patch = [];
                for(var tI = 0; tI < patchTable.childElementCount-1; tI++)
                {
                    var currRow = patchTable.childNodes[tI];
                    var fixtureChannels = {};
                    var fTLibEntry = fixtureTypeLibrary[currRow.childNodes[0].childNodes[0].value];
                    if(fTLibEntry.intensity)
                    {
                        fixtureChannels.intensity = 100;
                    }
                    for(var eIdx in fTLibEntry.emitters)
                    {
                        fixtureChannels[eIdx] = 0;
                    }
                    var emitterData = electronDaemon.importEmitters("emitters_"+currRow.childNodes[0].childNodes[0].value+".json");
                    if(emitterData)
                    {
                        emitterData = JSON.parse(emitterData);
                    }
                    else
                    {
                        console.error("Failed to import emitter data");
                        emitterData = [];
                        for(var eI in fTLibEntry.emitters)
                        {
                            emitterData.push({
                                name:eI,
                                color:emitterDefaultColors[eI],
                                measures:{}
                            })
                        }
                    }
                    patch.push({
                        fixtureType:currRow.childNodes[0].childNodes[0].value,
                        address:currRow.childNodes[1].childNodes[0].value,
                        channels:fixtureChannels,
                        emitterData:emitterData
                    });
                }
                localStorage.setItem("spectral.patch",JSON.stringify(patch));
                selectedFixtures = [];

                createFixtureSheet();
                createSliders();
            }
            closePopup();
        }]
    ]);
}

function addPatchLine(patchData)
{
    var newTr = document.createElement('tr');
    var newTd = document.createElement('td');

    //Fixturetype
    var newFixtureSelect = document.createElement('select');
    newFixtureSelect.id = "fixtureSelect";
    for(var fixture in fixtureTypeLibrary)
    {
        var option = document.createElement('option');
        option.innerHTML = fixture;
        option.value = fixture;
        newFixtureSelect.appendChild(option);
    }
    if(patchData)
    {
        newFixtureSelect.value = patchData.fixtureType;
    }
    newTd.appendChild(newFixtureSelect);
    newTr.appendChild(newTd);
    newTd = document.createElement('td');
    var numberInput = document.createElement('input');
    numberInput.type = "number";
    numberInput.min = 1;
    numberInput.max = 512;
    if(patchData)
    {
        numberInput.value = patchData.address;
    }
    else
    {
        numberInput.value = 1;
    }
    newTd.appendChild(numberInput);
    newTr.appendChild(newTd);
    newTd = document.createElement('td');
    var deleteFixture = document.createElement('div');
    deleteFixture.className = "deleteFixture";
    deleteFixture.onclick = function(event)
    {
        var elem = event.currentTarget;
        elem.parentElement.parentElement.remove();
    }
    newTd.appendChild(deleteFixture);
    newTr.appendChild(newTd);
    return newTr;
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Fixture Sheet //////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

var lassoStartPoint = null;

function createFixtureSheet()
{
    var fixtureSheet = document.getElementById("fixtureSheet");
    if(fixtureSheet)
    {
        fixtureSheet.innerHTML = "";
        var lasso = document.createElement('div');
        lasso.id = "lasso";
        fixtureSheet.appendChild(lasso);
        fixtureSheet.onmousemove = function(event)
        {
            if(event.buttons != 0)
            {
                var lasso = document.getElementById("lasso");
                if(lasso)
                {
                    if(!lassoStartPoint)
                    {
                        lasso.style.display = "block";
                        lasso.style.width = "0px";
                        lasso.style.height = "0px";
                        lasso.style.left = event.layerX+"px";
                        lasso.style.top = event.layerY+"px";
                        lassoStartPoint = {
                            x:event.clientX,
                            y:event.clientY
                        }
                    }
                    else
                    {
                        var lassoWidth = lassoStartPoint.x-event.clientX;
                        var lassoHeight = lassoStartPoint.y-event.clientY;
                        if(lassoWidth > 0)
                        {
                            if(event.layerX != 0)
                            {
                                lasso.style.left = event.layerX+"px";
                            }
                            lasso.style.width = lassoWidth+"px";
                            lasso.style.height = lassoHeight+"px";
                        }
                        else
                        {
                            lassoWidth = lassoWidth*(-1);
                            lasso.style.width = lassoWidth+"px";
                            lasso.style.height = lassoHeight+"px";
                        }
                        if(lassoHeight < 0)
                        {
                            lassoHeight = lassoHeight*(-1);
                            lasso.style.width = lassoWidth+"px";
                            lasso.style.height = lassoHeight+"px";
                        }
                        else
                        {
                            if(event.layerY != 0)
                            {
                                lasso.style.top = event.layerY+"px";
                            }
                            lasso.style.width = lassoWidth+"px";
                            lasso.style.height = lassoHeight+"px";
                        }
                        //console.log("W="+lassoWidth+" H="+lassoHeight);
                    }
                }
            }
        }
        fixtureSheet.onmouseup = function(event)
        {
            if(lassoStartPoint != null)
            {
                var lassoHeight = lassoStartPoint.y-event.clientY;
                if(lassoHeight != 0)
                {
                    var startHeight = 0;
                    var stopHeight = 0;
                    if(lassoHeight > 0)
                    {
                        startHeight = lassoStartPoint.y-lassoHeight;
                        stopHeight = lassoStartPoint.y;
                    }
                    else
                    {
                        stopHeight = lassoStartPoint.y-lassoHeight;
                        startHeight = lassoStartPoint.y;
                    }
                    var fixtureSheet = document.getElementById("fixtureSheet");
                    if(fixtureSheet)
                    {
                        //var sheetBox = fixtureSheet.getBoundingClientRect();
                        var sheetRows = fixtureSheet.childNodes[1].childNodes;
                        for(var i = 1; i < sheetRows.length; i++)
                        {
                            var box = sheetRows[i].getBoundingClientRect();
                            if(box.bottom > startHeight && box.top < stopHeight)
                            {
                                if(event.shiftKey)
                                {
                                    updateSelection(sheetRows[i]);
                                }
                                else
                                {
                                    if(sheetRows[i].className.search("selected") == -1)
                                    {
                                        updateSelection(sheetRows[i]);
                                    }
                                }
                            }
                            else
                            {
                                if(!event.ctrlKey)
                                {
                                    if(sheetRows[i].className.search("selected") != -1)
                                    {
                                        updateSelection(sheetRows[i]);
                                    }
                                }
                                console.log("Row "+i+" does not match "+box.bottom+" > "+startHeight+" && "+box.top+" < "+stopHeight);
                            }
                        }
                    }
                    else
                    {
                        console.warn("Lasso: There is no fixture sheet");
                    }
                }
                else
                {
                    console.warn("Lasso is too small");
                }

                lassoStartPoint = null;
                var lasso = document.getElementById("lasso");
                if(lasso)
                {
                    lasso.style.display = "";
                }
            }
        }
        var table = document.createElement('table');
        table.draggable = false;

        var usedChannels = {
            intensity:false,
            Rot:false,
            Grün:false,
            Blau:false,
            Weiss:false,
            Amber:false
        };

        for(var pI = 0; pI < patch.length; pI++)
        {
            var fTLibEntry = fixtureTypeLibrary[patch[pI].fixtureType];
            if(fTLibEntry.intensity)
            {
                usedChannels.intensity = true;
            }
            for(var eIdx in fTLibEntry.emitters)
            {
                usedChannels[eIdx] = true;
            }
        }

        //Title line
        var tr = document.createElement('tr');
        tr.draggable = false;
        tr.className = "titleLine";
        var td = document.createElement('td');
        td.innerHTML = "No";
        tr.appendChild(td);
        td = document.createElement('td');
        td.innerHTML = "Type";
        tr.appendChild(td);
        for(var uCIdx in usedChannels)
        {
            if(usedChannels[uCIdx])
            {
                td = document.createElement('td');
                switch(uCIdx)
                {
                    case "intensity":
                        td.innerHTML = "Dim";
                        break;
                    case "Rot":
                        td.innerHTML = "Red";
                        break;
                    case "Grün":
                        td.innerHTML = "Green";
                        break;
                    case "Blau":
                        td.innerHTML = "Blue";
                        break;
                    case "Weiss":
                        td.innerHTML = "White";
                        break;
                    default:
                        td.innerHTML = uCIdx;
                        break;
                }
                tr.appendChild(td);
            }
        }
        td = document.createElement('td');
        td.innerHTML = "M"; //Measure
        td.title = "Measure";
        tr.appendChild(td);
        td = document.createElement('td');
        td.innerHTML = "S"; //Settings
        td.title = "Settings";
        tr.appendChild(td);
        table.appendChild(tr);

        //Data
        for(var pI = 0; pI < patch.length; pI++)
        {
            tr = document.createElement('tr');
            tr.draggable = false;
            tr.id = "fixtureRow_"+pI;
            tr.onclick = function(event)
            {
                if(event.srcElement == event.currentTarget || (event.srcElement != event.currentTarget && (event.srcElement.className == "" || event.srcElement.className == "selected")))
                {
                    if(!event.currentTarget.classList.contains("reference"))
                    {
                        updateSelection(event.currentTarget);
                    }
                    else
                    {
                        console.warn("Can't be unselected if it is a reference");
                    }
                }
            }
            tr.oncontextmenu = function(event)
            {
                var row = event.currentTarget;
                if(!row.classList.contains("selected"))
                {
                    return;
                }
                if(referenceFixtureId != -1)
                {
                    var lastReferenceRow = document.getElementById("fixtureRow_"+(referenceFixtureId));
                    if(lastReferenceRow)
                    {
                        lastReferenceRow.classList.remove("reference");
                    }
                }
                var fixtureID = row.id.split("_")[1];
                if(referenceFixtureId != fixtureID)
                {
                    referenceFixtureId = fixtureID;
                    row.classList.add("reference");
                }
                else
                {
                    referenceFixtureId = -1;
                }

                var realValLabels = document.getElementsByClassName("realVal");
                while(realValLabels.length)
                {
                    realValLabels[0].remove();
                }
                sendDMX(event);

                if(referenceFixtureId == -1)
                {
                    mixTriangle.style.display = "none";
                    mixPosData.style.display = "none";
                    mixPos.style.display = "none";
                    fixturesHaveStillRefData = true;
                }
                else
                {
                    mixTriangle.style.display = "";
                    mixPosData.style.display = "";
                    mixPos.style.display = "";
                }
            }
            td = document.createElement('td');
            td.draggable = false;
            td.innerHTML = pI+1;
            tr.appendChild(td);
            td = document.createElement('td');
            td.draggable = false;
            td.innerHTML = patch[pI].fixtureType;
            tr.appendChild(td);
            //Channels
            var fTLibEntry = fixtureTypeLibrary[patch[pI].fixtureType];
            for(var uCIdx in usedChannels)
            {
                if(usedChannels[uCIdx])
                {
                    td = document.createElement('td');
                    td.draggable = false;
                    if(uCIdx == "intensity")
                    {
                        if(fTLibEntry.intensity)
                        {
                            td.id = pI+"_intensity";
                            td.innerText = 100;
                        }
                    }
                    else
                    {
                        for(var eIdx in fTLibEntry.emitters)
                        {
                            if(eIdx == uCIdx)
                            {
                                td.id = pI+"_"+eIdx;
                                td.innerText = 0;
                                continue;
                            }
                        }
                    }
                    tr.appendChild(td);
                }
            }

            //Measure Button
            td = document.createElement('td');
            td.draggable = false;
            td.className = "measureFixture";
            td.onclick = function(event)
            {
                measureAllEmitters(event.currentTarget.parentElement);
            }
            tr.appendChild(td);

            //Emitter Data view
            td = document.createElement('td');
            td.draggable = false;
            td.className = "fixtureData";
            td.onclick = function(event)
            {
                editEmitter(event.currentTarget.parentElement);
            }
            tr.appendChild(td);
            table.appendChild(tr);
        }
        fixtureSheet.appendChild(table);
    }
    updateSelection(fixtureSheet.childNodes[1].childNodes[1]);
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Popup //////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

/*
buttons: [
    [value,callback,{attribute:value}]
]
*/
function throwPopup(title,content,modal,buttons,autoClose)
{
    if(modal)
    {
        var modalOverlay = document.getElementById("modalOverlay");
        if(modalOverlay)
        {
            modalOverlay.style.display = "block";
        }
    }

    var popupDiv = document.getElementById("popupDiv");
    if(popupDiv)
    {
        popupDiv.innerHTML = "";
        popupDiv.className = "";
        popupDiv.style.display = "flex";
        popupDiv.style.flexDirection = "column";
        popupDiv.style.left = "";
        popupDiv.style.top = "";
        popupDiv.style.right = "";

        var titleDiv = document.createElement('div');
        titleDiv.id = "popupTitle";
        titleDiv.innerHTML = title;
        popupDiv.appendChild(titleDiv);

        if(!modal)
        {
            popupDiv.style.right = "initial";
            popupDiv.style.left = "25%";
        }

        var contentDiv = document.createElement('div');
        contentDiv.id = "popupContent";
        if(typeof(content) == "object")
        {
            for(var cd = 0; cd < content.length; cd++)
            {
                if(typeof(content[cd]) == "object")
                {
                    contentDiv.appendChild(content[cd]);
                }
                else
                {
                    contentDiv.innerHTML += content[cd];
                }
            }
            if(content.length == undefined)
            {
                contentDiv.appendChild(content);
            }
        }
        else
        {
            contentDiv.innerHTML = content;
        }
        popupDiv.appendChild(contentDiv);

        if(buttons)
        {
            popupDiv.classList.add("buttons");
            var buttonsDiv = document.createElement('div');
            buttonsDiv.id = "buttonsDiv";
            for(var bd = 0; bd < buttons.length; bd++)
            {
                var newBtn = document.createElement('input');
                newBtn.type = "button";
                newBtn.value = buttons[bd][0];
                newBtn.onclick = buttons[bd][1]; //Callback

                if(buttons[bd][2])
                {
                    for(var attKey in buttons[bd][2])
                    {
                        newBtn.setAttribute(attKey,buttons[bd][2][attKey]);
                    }
                }

                buttonsDiv.appendChild(newBtn);
            }
            popupDiv.appendChild(buttonsDiv);
            newBtn.focus();
        }
        else
        {
            popupDiv.classList.add("buttons");
            var buttonsDiv = document.createElement('div');
            buttonsDiv.id = "buttonsDiv";
            var newBtn = document.createElement('input');
            newBtn.type = "button";
            newBtn.value = "Close";
            newBtn.onclick = function() {
                closePopup();
            };
            buttonsDiv.appendChild(newBtn);
            popupDiv.appendChild(buttonsDiv);
        }
    }
}

function throwWaitPopup()
{
    var modalOverlay = document.getElementById("modalOverlay");
    if(modalOverlay)
    {
        modalOverlay.style.display = "block";
    }

    var popupDiv = document.getElementById("popupDiv");
    if(popupDiv)
    {
        popupDiv.innerHTML = "";
        popupDiv.style.display = "flex";
        popupDiv.style.flexDirection = "row";
        popupDiv.className = "circle";

        var colors = ["blue","green","#c0ff00","yellow","orange","red"];
        for(var cLI = 0; cLI < 6; cLI++)
        {
            var colorLine = document.createElement('div');
            colorLine.className = "colorLine";
            colorLine.style.backgroundColor = colors[cLI];
            colorLine.style.animationDelay = (2/6*cLI)+"s";
            popupDiv.appendChild(colorLine);
        }
    }
}

function closePopup()
{
    var modalOverlay = document.getElementById("modalOverlay");
    if(modalOverlay)
    {
        modalOverlay.style.display = "";
    }
    
    var popupDiv = document.getElementById("popupDiv");
    if(popupDiv)
    {
        popupDiv.style.display = "";
    }
}