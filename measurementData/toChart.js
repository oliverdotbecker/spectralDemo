const fs = require('fs');

var data = {};
var fixture = "Arri Skypanel Mode RGBW";
//fixture = "Robe LED Wash 300";
//fixture = "Ape Labs Light Can";
var folderDir = __dirname+"/UPRtek/";
var measureLevels = ["5%","10%","20%","35%","50%","65%","85%","100%"];

var emitters = fs.readdirSync(folderDir+fixture);
if(emitters && emitters.length)
{
    for(var fI = 0; fI < emitters.length; fI++)
    {
        var emitterPath = folderDir+fixture+"/"+emitters[fI];
        if(fs.lstatSync(emitterPath).isDirectory())
        {
            data[emitters[fI]] = [];
            var files = fs.readdirSync(emitterPath);
            files = files.map(function (fileName) {
                return {
                    name: fileName,
                    time: fs.statSync(emitterPath + '/' + fileName).mtime.getTime()
                };
            })
            .sort(function (a, b) {
                return a.time - b.time;
            })
            .map(function (v) {
                return v.name;
            });
            for(var fileI = 0; fileI < files.length; fileI++)
            {
                var fileData = fs.readFileSync(emitterPath+"/"+files[fileI],'utf8');
                var spectralData = readUPRtekCSV(fileData);
                data[emitters[fI]].push(spectralData);
            }
        }
    }
    var csvOut = exportAsCSV(data);
    fs.writeFileSync(folderDir+fixture+".csv",csvOut,"utf8");
}

function readUPRtekCSV(data)
{
    data = data.split("\r\n");
    if(data.length == 1)
    {
        data = data[0].split("\n");
    }
    var x = data[0].split("=")[1].trim();
    var y = data[1].split("=")[1].trim();
    var Y = parseFloat(data[8].split("=")[1].trim()) / parseFloat(data[6].split("=")[1].trim()); //LUX/Peak count

    var X = (x*Y)/y;
    var Z = ((1-x-y)*Y)/y;

    X /= 100;
    Y /= 100;
    Z /= 100;

    return {
        x:x,
        y:y,
        X:X,
        Y:Y,
        Z:Z,
        Lux:parseFloat(data[8].split("=")[1].trim())
    };
}

function exportAsCSV(data)
{
    var csvOut = "";
    csvOut += fixture+"\n\n";

    var rowsLux = [";","5%;","10%;","20%;","35%;","50%;","65%;","85%;","100%;"];
    var rows_xyOut = [";","5%;","10%;","20%;","35%;","50%;","65%;","85%;","100%;"];
    for(var emitter in data)
    {
        rowsLux[0] += emitter+";";
        rows_xyOut[0] += emitter+" (x);"+emitter+" (y);";
        var emitterData = data[emitter];
        for(var lIdx = 0; lIdx < emitterData.length; lIdx++)
        {
            var currDataset = emitterData[lIdx];
            rowsLux[lIdx+1] += currDataset.Lux+";";
            rows_xyOut[lIdx+1] += currDataset.x+";";
            rows_xyOut[lIdx+1] += currDataset.y+";";
        }
    }

    csvOut += "Lux\n"+rowsLux.join("\n")+"\n\n";
    csvOut += "xy\n"+rows_xyOut.join("\n");

    /*for(var emitter in data)
    {
        var emitterData = data[emitter];
        csvOut += emitter+";x;y;X;Y;Z;Lux\n";
        for(var lIdx = 0; lIdx < emitterData.length; lIdx++)
        {
            csvOut += measureLevels[lIdx]+";";
            var currDataset = emitterData[lIdx];
            csvOut += currDataset.x+";";
            csvOut += currDataset.y+";";
            csvOut += currDataset.X+";";
            csvOut += currDataset.Y+";";
            csvOut += currDataset.Z+";";
            csvOut += currDataset.Lux+"\n";
        }
        csvOut += "\n";
    }*/

    csvOut = csvOut.replace(/\./g,",");
    return csvOut;
}