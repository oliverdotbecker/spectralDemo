var settings = localStorage.getItem("spectral.settings") || "{}";
settings = JSON.parse(settings);
var patch = localStorage.getItem("spectral.patch") || "[]";
patch = JSON.parse(patch);

activeSensor = settings.sensor;

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
    newTd.colSpan = 2;
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
                        fixtureChannels.intensity = 0;
                    }
                    for(var eIdx in fTLibEntry.emitters)
                    {
                        fixtureChannels[eIdx] = 0;
                    }
                    patch.push({
                        fixtureType:currRow.childNodes[0].childNodes[0].value,
                        address:currRow.childNodes[1].childNodes[0].value,
                        channels:fixtureChannels,
                        emitterData:null
                    });
                }
                localStorage.setItem("spectral.patch",JSON.stringify(patch));
                currentFixture = patch[0].fixtureType;
                currentFixtureHasIntensity = fixtureTypeLibrary[currentFixture].intensity == true;
                patchOffset = patch[0].address-1;
                doImport("emitters",true);
                createFixtureSheet();
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
    return newTr;
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Fixture Sheet //////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////

function createFixtureSheet()
{
    var fixtureSheet = document.getElementById("fixtureSheet");
    if(fixtureSheet)
    {
        fixtureSheet.innerHTML = "";
        var table = document.createElement('table');

        var usedChannels = {
            intensity:false,
            Rot:false,
            Grün:false,
            Blau:false,
            Amber:false,
            Weiss:false
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
            tr.id = "fixtureRow_"+pI;
            tr.onclick = function(event)
            {
                updateSelection(event.currentTarget);
            }
            td = document.createElement('td');
            td.innerHTML = pI+1;
            tr.appendChild(td);
            td = document.createElement('td');
            td.innerHTML = patch[pI].fixtureType;
            tr.appendChild(td);
            //Channels
            var fTLibEntry = fixtureTypeLibrary[patch[pI].fixtureType];
            for(var uCIdx in usedChannels)
            {
                if(usedChannels[uCIdx])
                {
                    td = document.createElement('td');
                    if(uCIdx == "intensity")
                    {
                        if(fTLibEntry.intensity)
                        {
                            td.id = pI+"_intensity";
                            td.innerText = 0;
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

            //Emitter Data view
            table.appendChild(tr);
        }
        fixtureSheet.appendChild(table);
    }
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
        popupDiv.isReminder = false;
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

function throwReminderPopup(content)
{
    var modalOverlay = document.getElementById("modalOverlay");
    if(modalOverlay)
    {
        modalOverlay.style.display = "block";
    }

    var popupDiv = document.getElementById("popupDiv");
    if(popupDiv)
    {
        if(!popupDiv.isReminder || popupDiv.style.display != "flex")
        {
            popupDiv.innerHTML = "";
            popupDiv.style.display = "flex";
            popupDiv.style.flexDirection = "column";
            popupDiv.style.left = "";
            popupDiv.style.top = "";
            popupDiv.style.right = "";
    
            var titleDiv = document.createElement('div');
            titleDiv.id = "popupTitle";
            titleDiv.innerHTML = "Erinnerung";
            popupDiv.appendChild(titleDiv);

            popupDiv.isReminder = true;
            popupDiv.reminderCount = "1";

            var contentDiv = document.createElement('div');
            contentDiv.id = "popupContent";
            contentDiv.innerHTML = "<p>"+content+"</p>";
            popupDiv.appendChild(contentDiv);
            
            popupDiv.classList.add("buttons");
            var buttonsDiv = document.createElement('div');
            buttonsDiv.id = "buttonsDiv";
            var newBtn = document.createElement('input');
            newBtn.type = "button";
            newBtn.value = "Schließen";
            newBtn.onclick = function() {
                closePopup();
            };
            buttonsDiv.appendChild(newBtn);
            popupDiv.appendChild(buttonsDiv);
        }
        else
        {
            popupDiv.reminderCount = parseInt(popupDiv.reminderCount)+1;
            var popupTitle = document.getElementById("popupTitle");
            if(popupTitle)
            {
                popupTitle.innerHTML = popupDiv.reminderCount+" Erinnerungen";
            }
            var popupContent = document.getElementById("popupContent");
            if(popupContent)
            {
                popupContent.innerHTML += "<p>"+content+"</p>";
            }
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