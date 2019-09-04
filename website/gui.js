var settings = localStorage.getItem("spectral.settings") || "{}";
settings = JSON.parse(settings);
var patch = localStorage.getItem("spectral.patch") || "{}";
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
    throwPopup("Patch","test");
}/*
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