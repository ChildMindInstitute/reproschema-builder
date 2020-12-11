//User inputs: these are specific to your protocol, fill out before using the script

//1. your protocol id: use underscore for spaces, avoid special characters. The display name is the one that will show up in the app, this will be parsed as string.
const protocolName = "sc_dd";

//2. your protocol display name: this will show up in the app and be parsed as a string
const protocolDisplayName = "Your protocol display name";

//2. create your raw github repo URL
const userName = 'charlie42';
const repoName = 'reproschema-builder';
const branchName = 'mhdb-format';

let yourRepoURL = `https://raw.githubusercontent.com/${userName}/${repoName}/${branchName}`;

//3. add a description to your protocol
let protocolDescription = "Description for your protocol";

//4. where are you hosting your images? For example: openmoji
let imagePath = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/';

/* ************ Constants **************************************************** */
const csv = require('fast-csv');
const fs = require('fs');
const _ = require('lodash');
const shell = require('shelljs');
const camelcase = require('camelcase');
const mkdirp = require('mkdirp');
const HTMLParser =  require ('node-html-parser');

const schemaMap = {
    "Variable / Field Name": "@id", // column A
    "Item Display Name": "skos:prefLabel",
    "Field Annotation": "schema:description", // column R
    "Section Header": "preamble", // todo: check this // column C
    "Field Label": "question", // column E
    "Field Type": "inputType", // column D
    "Allow": "allow",
    "Required Field?": "requiredValue", //column M
    "Text Validation Min": "schema:minValue", // column I
    "Text Validation Max": "schema:maxValue", // column J
    "Choices, Calculations, OR Slider Labels": "choices", // column F
    "Branching Logic (Show field only if...)": "visibility", // column L
    "Custom Alignment": "customAlignment", // column N
    "Identifier?": "identifiable", // column K
    "multipleChoice": "multipleChoice",
    "responseType": "@type"
};

const inputTypeMap = {
    "calc": "number",
    "checkbox": "radio",
    "descriptive": "static",
    "dropdown": "select",
    "notes": "text"
};

const uiList = ['inputType', 'shuffle', 'allow', 'customAlignment'];
const responseList = ['type', 'requiredValue'];
const additionalNotesList = ['Field Note', 'Question Number (surveys only)'];
const defaultLanguage = 'en';
const datas = {};
const schemaVersion = "1.0.0-rc1.post"

/* **************************************************************************************** */

// Make sure we got a filename on the command line.
if (process.argv.length < 3) {
    console.log('Usage: node ' + process.argv[1] + 'your_data_dic.csv');
    process.exit(1);
}

// Read the CSV file.
let csvPath = process.argv[2];
let readStream = fs.createReadStream(csvPath).setEncoding('utf-8');

let schemaContextUrl = 'https://raw.githubusercontent.com/ReproNim/reproschema/master/contexts/generic';
let order = {};
let visibilityObj = {};
let scoresObj = {};
let scoresList = [];
let visibilityList = [];
let languages = [];
let addProperties = [];
let matrixList = [];
let protocolAddProperties = [];
let protocolVisibilityObj = {};
let protocolOrder = [];
let protocolAllow = []; 
let preamble = '';

let options = {
    delimiter: ',',
    headers: true,
    objectMode: true,
    quote: '"',
    escape: '"',
    ignoreEmpty: true
};

// get all field names and instrument name
csv
    .fromStream(readStream, options)
    .on('data', function (data) {
        if (!datas[data['Form Name']]) {
            datas[data['Form Name']] = [];
            // For each form, create directory structure - activities/form_name/items
            shell.mkdir('-p', 'activities/' + data['Form Name'] + '/items');          
        }
        //create directory for protocol
        shell.mkdir('-p', 'protocols/' + protocolName);
        // console.log(62, data);
        datas[data['Form Name']].push(data);
    })

    .on('end', function () {
        console.log(66, datas);
        Object.keys(datas).forEach( form => {
            scoresList = [];
            visibilityList = [];
            let fieldList = datas[form]; // all items of an activity
            createFormContextSchema(form, fieldList); // create context for each activity
            let formContextUrl = `${yourRepoURL}/activities/${form}/${form}_context`;
            scoresObj = {};
            visibilityObj = {};
            addProperties = [];
            matrixList = [];
            console.log("FORM DISPLAY NAME "+fieldList[0]['Form Display Name']);
            activityDisplayName = fieldList[0]['Form Display Name'];
            activityDescription = fieldList[0]['Form Note'];
            preamble = fieldList[0]['Section Header'];
            fieldList.forEach( field => {
                if(languages.length === 0){
                    languages = parseLanguageIsoCodes(field['Field Label']);
                }
                processRow(form, field);
            });
            createFormSchema(form, formContextUrl);
        });
        //create protocol context
        let activityList = Object.keys(datas);
        let protocolContextUrl = `${yourRepoURL}/protocols/${protocolName}/${protocolName}_context`;
        createProtocolContext(activityList);
        
        //create protocol schema
        activityList.forEach( activityName => {
            processActivities(activityName);
        });

        createProtocolSchema(protocolName, protocolContextUrl);
    });

function createFormContextSchema(form, fieldList) {
    // define context file for each form
    let itemOBj = { "@version": 1.1 };
    let formContext = {};
    itemOBj[form] = `${yourRepoURL}/activities/${form}/items/`;
    fieldList.forEach( field => {
        let field_name = field['Variable / Field Name'];
        // define item_x urls to be inserted in context for the corresponding form
        itemOBj[field_name] = { "@id": `${form}:${field_name}` , "@type": "@id" };
    });
    formContext['@context'] = itemOBj;
    const fc = JSON.stringify(formContext, null, 4);
    fs.writeFile(`activities/${form}/${form}_context`, fc, function(err) {
        if (err)
            console.log(err);
        else console.log(`Context created for form ${form}`);
    });
}

function createProtocolContext(activityList) {
    //create protocol context file
    let activityOBj = { "@version": 1.1,
                    "activity_path": `${yourRepoURL}/activities/`           
    };
    let protocolContext = {};
    activityList.forEach(activity => {
        //let activityName = activity['Form Name'];
        // define item_x urls to be inserted in context for the corresponding form
        activityOBj[activity] = { "@id": `activity_path:${activity}/${activity}_schema` , "@type": "@id" };
    });
    protocolContext['@context'] = activityOBj;
    const pc = JSON.stringify(protocolContext, null, 4);
    fs.writeFile(`protocols/${protocolName}/${protocolName}_context`, pc, function(err) {
        if (err)
            console.log(err);
        else console.log(`Protocol context created for ${protocolName}`);
    });
}

function processRow(form, data){
    let rowData = {};
    let ui = {};
    let rspObj = {};
    let choiceList = [];
    //let isVis = '';
    //mhdb:
    let isVis = true;
   
    rowData['@context'] = [schemaContextUrl];
    rowData['@type'] = 'reproschema:Field';
    rowData['@id'] = data['Variable / Field Name'];
    rowData['skos:prefLabel'] = data["Item Display Name"];
    rowData['schema:schemaVersion'] = schemaVersion;
    rowData['schema:version'] = '0.0.1';

    // map Choices, Calculations, OR Slider Labels column to choices or scoringLogic key
    if (data['Field Type'] === 'calc')
        schemaMap['Choices, Calculations, OR Slider Labels'] = 'scoringLogic';
    else schemaMap['Choices, Calculations, OR Slider Labels'] = 'choices';

    // parse Field Type and populate inputType and responseOptions valueType
    if (data['Field Type']) {
        let inputType = '';
        let valueType = '';
        if (data['Field Type'] === 'text') {
            if (data['Text Validation Type OR Show Slider Number']) {
                if (data['Text Validation Type OR Show Slider Number'] === 'number') {
                inputType = 'integer';
                valueType = 'xsd:int';
            }
                else if ((data['Text Validation Type OR Show Slider Number']).startsWith('date_')) {
                    inputType = 'date';
                    valueType = 'xsd:date';
                }
                else if (data['Text Validation Type OR Show Slider Number'].startsWith('datetime_')) {
                    inputType = 'datetime';
                    valueType = 'datetime';
                }
                else if (data['Text Validation Type OR Show Slider Number'].startsWith('time_')) {
                    inputType = 'time';
                    valueType = 'xsd:date';
                }
                else if (data['Text Validation Type OR Show Slider Number'] === 'email') {
                    inputType = 'text';
                    valueType = 'email';
                }
                else if (data['Text Validation Type OR Show Slider Number'] === 'phone') {
                    inputType = 'text';
                    valueType = 'phone';
                }
            }
            else {
                inputType = 'text';
                valueType = 'xsd:string';
            }
        }
        else if (data['Field Type'] === 'notes') {
            inputType = 'text';
            valueType = 'xsd:string';
        }
        else if (data['Field Type'] === 'calc') {
            inputType = 'float';
            valueType = 'float';
        }
        else if (data['Field Type'] === 'dropdown') {
            inputType = 'select';
            valueType = '';
        }
        else if (data['Field Type'] === 'radio') {
            inputType = 'radio';
            multipleChoice = false;
            valueType = '';
        }
        else if (data['Field Type'] === 'checkbox') {
            inputType = 'radio';
            valueType = 'radio';
            multipleChoice = true;
        }
        else if (data['Field Type'] === 'slider') {
            inputType = 'slider';
            valueType = 'slider';
        }
        else if (data['Field Type'] === 'file upload') {
            inputType = 'upload';
        }
        else if (data['Field Type'] === 'descriptive') {
            inputType = 'static';
        }
        //mhdb
        else if (data['Field Type'] === '1') {
            inputType = 'radio';
            multipleChoice = false;
            valueType = '';
        }
        //console.log("UNPUT TYPE" + inputType + " " + data['Field Type'])
        rowData['ui'] = {'inputType': inputType};
        if (valueType) {
            rowData['responseOptions'] = {'valueType': valueType};
        }
    }

    Object.keys(data).forEach(current_key => {

        //Parse 'allow' array
        if (schemaMap[current_key] === 'allow' && data[current_key] !== '') {
            // :todo move from items to activities
            // let uiKey = schemaMap[current_key];
            // let uiValue = data[current_key].split(', ');
            // //uiValue.forEach(val => {
            // //    allowList.push(val)
            // //})
            // // add object to ui element of the item
            // if (rowData.hasOwnProperty('ui')) {
            //     rowData.ui[uiKey] = uiValue; // append to existing ui object
            // }
            // else { // create new ui object
            //     ui[uiKey] = uiValue;
            //     rowData['ui'] = ui;
            // }
        }
        // check all ui elements to be nested under 'ui' key of the item
        else if (uiList.indexOf(schemaMap[current_key]) > -1 && data[current_key] !== '') {
            let uiKey = schemaMap[current_key];
            let uiValue = data[current_key];
            if (inputTypeMap.hasOwnProperty(data[current_key])) { // map Field type to supported inputTypes
                uiValue = inputTypeMap[data[current_key]];
            }
        
            // else if ((uiKey === 'inputType') && (uiValue === 'text') && data['Text Validation Type OR Show Slider Number'] === 'number') {
            //     uiValue = 'integer';
            //     valueType = 'xsd:int'
            // }
            // else if ((uiKey === 'inputType') && (uiValue === 'text') && data['Text Validation Type OR Show Slider Number'] === 'date_mdy') {
            //     uiValue = 'date';
            //     valueType = 'xsd:date';
            // }

            //mhdb:
            else if ((uiKey === 'inputType') && (uiValue === '1')) {
                uiValue = 'radio';
            }

            // add object to ui element of the item
            if (rowData.hasOwnProperty('ui')) {
                rowData.ui[uiKey] = uiValue; // append to existing ui object
            }
            else { // create new ui object
                ui[uiKey] = uiValue;
                rowData['ui'] = ui;
            }
        }
        // parse multipleChoice
        else if (schemaMap[current_key] === 'multipleChoice' && data[current_key] !== '') {

            // split string wrt '|' to get each choice
            let multipleChoiceVal = (data[current_key]) === '1';
            
            // insert 'multiplechoices' key inside responseOptions of the item
            if (rowData.hasOwnProperty('responseOptions')) {
                rowData.responseOptions[schemaMap[current_key]] = multipleChoiceVal;
            }
            else {
                rspObj[schemaMap[current_key]] = multipleChoiceVal;
                rowData['responseOptions'] = rspObj;
            }
        }
        //parse minVal
        else if (schemaMap[current_key] === 'schema:minValue' && data[current_key] !== '') {
            let minValVal = parseInt(data[current_key]);
            
            // insert 'multiplechoices' key inside responseOptions of the item
            if (rowData.hasOwnProperty('responseOptions')) {
                rowData.responseOptions[schemaMap[current_key]] = minValVal;
            }
            else {
                rspObj[schemaMap[current_key]] = minValVal;
                rowData['responseOptions'] = rspObj;
            }
        }
        //parse maxVal
        else if (schemaMap[current_key] === 'schema:maxValue' && data[current_key] !== '') {
            let maxValVal = parseInt(data[current_key]);
            // insert 'multiplechoices' key inside responseOptions of the item
            if (rowData.hasOwnProperty('responseOptions')) {
                rowData.responseOptions[schemaMap[current_key]] = maxValVal;
            }
            else {
                rspObj[schemaMap[current_key]] = maxValVal;
                rowData['responseOptions'] = rspObj;
            }
        }
        /*
        //parse @type
        else if (schemaMap[current_key] === '@type') {

            // insert "@type":"xsd:anyURI" key inside responseOptions of the item
            if (rowData.hasOwnProperty('responseOptions')) {
                rowData.responseOptions[schemaMap[current_key]] = "xsd:anyURI";
            }
            else {
                rspObj[schemaMap[current_key]] = "xsd:anyURI";
                rowData['responseOptions'] = rspObj;
            }
        }
        */
        // parse choice field
        else if (schemaMap[current_key] === 'choices' && data[current_key] !== '') {

            // split string wrt '|' to get each choice
            let c = data[current_key].split(',');
            // split each choice wrt ',' to get name and value
            c.forEach(ch => { // ch = { value, name}
                let choiceObj = {};
                let cs = ch.split('=');
                // create name and value pair + image link for each choice option
                if (cs.length === 3) {
                    choiceObj['schema:value'] = parseInt(cs[0]);
                    let cnameList = cs[1];
                    choiceObj['schema:name'] = {
                        [defaultLanguage]: cnameList
                    };
                    //choiceObj['@type'] = "schema:option";
                    choiceObj['schema:image'] = imagePath + cs[2] + '.png';
                    choiceList.push(choiceObj);
                } else {
                // for no image, create name and value pair for each choice option
                    choiceObj['schema:value'] = parseInt(cs[0]);
                    let cnameList = cs[1];
                    choiceObj['schema:name'] = {
                        [defaultLanguage]: cnameList
                    };
                    //choiceObj['@type'] = "schema:option";
                    choiceList.push(choiceObj);
                }

            });
            // insert 'choices' key inside responseOptions of the item
            if (rowData.hasOwnProperty('responseOptions')) {
                rowData.responseOptions[schemaMap[current_key]] = choiceList;
            }
            else {
                rspObj[schemaMap[current_key]] = choiceList;
                rowData['responseOptions'] = rspObj;
            }
        }
        // check all other response elements to be nested under 'responseOptions' key
        else if (responseList.indexOf(schemaMap[current_key]) > -1) {
            if (schemaMap[current_key] === 'requiredValue' && data[current_key]) {
                if (data[current_key] === 'y') {
                    data[current_key] = true
                }
            }
            if (data[current_key]) { // if value exists in the column then write it to schema
                if (rowData.hasOwnProperty('responseOptions')) {
                    rowData.responseOptions[schemaMap[current_key]] = data[current_key];
                }
                else {
                    rspObj[schemaMap[current_key]] = data[current_key];
                    rowData['responseOptions'] = rspObj;
                }
            }
        }
        // scoring logic
        else if (schemaMap[current_key] === 'scoringLogic' && data[current_key] !== '') {
            // set ui.hidden for the item to true by default
            if (rowData.hasOwnProperty('ui')) {
                rowData.ui['hidden'] = true;
            }
            else {
                ui['hidden'] = true;
                rowData['ui'] = ui;
            }
            let condition = data[current_key];
            let s = condition;
            // normalize the condition field to resemble javascript
            let re = RegExp(/\(([0-9]*)\)/g);
            condition = condition.replace(re, "___$1");
            condition = condition.replace(/([^>|<])=/g, "$1 ==");
            condition = condition.replace(/\ and\ /g, " && ");
            condition = condition.replace(/\ or\ /g, " || ");
            re = RegExp(/\[([^\]]*)\]/g);
            condition = condition.replace(re, " $1 ");

            scoresObj = { "variableName": data['Variable / Field Name'], "jsExpression": condition };
            scoresList.push(scoresObj);
        }
        // branching logic
        else if (schemaMap[current_key] === 'visibility') {
            let condition = true; // for items visible by default
            if (data[current_key]) {
                condition = data[current_key];
                let s = condition;
                // normalize the condition field to resemble javascript
                let re = RegExp(/\(([0-9]*)\)/g);
                condition = condition.replace(re, "___$1");
                condition = condition.replace(/([^>|<])=/g, "$1==");
                condition = condition.replace(/\ and\ /g, " && ");
                condition = condition.replace(/\ or\ /g, " || ");
                re = RegExp(/\[([^\]]*)\]/g);
                condition = condition.replace(re, "$1");
            }
            //visibilityObj = { "variableName": data['Variable / Field Name'], "isVis": condition };
            //visibilityList.push(visibilityObj);
            isVis = condition;
            //visibilityObj[[data['Variable / Field Name']]] = condition;
        }
        // decode html fields
        else if ((schemaMap[current_key] === 'question' || schemaMap[current_key] ==='description'
            || schemaMap[current_key] === 'preamble') && data[current_key] !== '') {
            let questions = parseHtml(data[current_key]);
            // console.log(231, form, schemaMap[current_key], questions);
            rowData[schemaMap[current_key]] = questions;
        }
        else if (current_key === 'Identifier?' && data[current_key]) {
            let identifierVal = false;
            if (data[current_key] === 'y') {
                identifierVal = true
            }
            // TODO: leave "legalStandard" to the user as an optional flag
            // if the user says its hipaa use that. if not leave it as "unknown"
            rowData[schemaMap[current_key]] = [ {"legalStandard": "unknown", "isIdentifier": identifierVal }];
        }
        else if ((additionalNotesList.indexOf(current_key) > -1) && data[current_key]) {
            //console.log(436, current_key, data[current_key]);
            let notesObj = {"source": "redcap", "column": current_key, "value": data[current_key]};
            if (rowData.hasOwnProperty('additionalNotesObj')) {
                (rowData.additionalNotesObj).push(notesObj);
                }
            else {
                rowData['additionalNotesObj'] = [];
                (rowData['additionalNotesObj']).push(notesObj);
            }
        }
        // todo: what does "textValidationTypeOrShowSliderNumber": "number" mean along with inputType: "text" ?
        // text with no value in validation column is -- text inputType
        // text with value in validation as "number" is of inputType - integer
        // text with value in validation as ddate_mdy is of inputType - date
        // dropdown and autocomplete??
    });
    const field_name = data['Variable / Field Name'];

    // add field to addProperties
    addProperties.push({
        "variableName": field_name, 
        "isAbout": field_name,
        "isVis": isVis, 
        //:todo configure requiredValue
        "requiredValue": true,
    });

    // add matrix info to matrixList
    if (data['Matrix Group Name'] || data['Matrix Ranking?']) {
        matrixList.push({"variableName": field_name, "matrixGroupName": data['Matrix Group Name'], "matrixRanking": data['Matrix Ranking?']});
    }
    // check if 'order' object exists for the activity and add the items to the respective order array
    if (!order[form]) {
        order[form] = [];
        order[form].push(field_name);
    }
    else order[form].push(field_name);

    // write to item_x file
    fs.writeFile('activities/' + form + '/items/' + field_name, JSON.stringify(rowData, null, 4), function (err) {
        if (err) {
            console.log("error in writing item schema", err);
        }
    });
}

function createFormSchema(form, formContextUrl) {
    //console.log(27, form, visibilityObj);
    console.log("!!" + addProperties);
    let jsonLD = {
        "@context": [schemaContextUrl, formContextUrl],
        //"@context": schemaContextUrl,
        "@type": "reproschema:Activity",
        "@id": `${form}_schema`,
        "skos:prefLabel": activityDisplayName,
        //"skos:altLabel": `${form}_schema`,
        "schema:description": activityDescription,
        "schema:schemaVersion": schemaVersion,
        "schema:version": "0.0.1",
        // todo: preamble: Field Type = descriptive represents preamble in the CSV file., it also has branching logic. so should preamble be an item in our schema?
        "preamble": {
            [defaultLanguage]: preamble,
        },
        "ui": {
            "order": order[form],
            "addProperties": addProperties,
            "shuffle": false,
            //"visibility": visibilityList
        }
    };
    if (!_.isEmpty(matrixList)) {
        jsonLD['matrixInfo'] = matrixList;
    }
    if (!_.isEmpty(scoresList)) {
        jsonLD['scoringLogic'] = scoresList;
    }
    const op = JSON.stringify(jsonLD, null, 4);
    // console.log(269, jsonLD);
    fs.writeFile(`activities/${form}/${form}_schema`, op, function (err) {
        if (err) {
            console.log("error in writing", form, " form schema", err)
        }
        else console.log(form, "Instrument schema created");
    });
}

function processActivities(activityName) {

    let condition = true; // for items visible by default
    protocolVisibilityObj[activityName] = condition;
    let activityPath = `${yourRepoURL}/activities/${activityName}/${activityName}_schema`;
    
    // add activity to addProperties and Order
    protocolAddProperties.push({
        "variableName": activityName, 
        "isAbout": activityPath,
        //:todo configure isvis
        "isVis": true,
    });
    //protocolOrder.push(activityName);
    protocolOrder.push(activityPath);
}

function createProtocolSchema(protocolName, protocolContextUrl) {
    let protocolSchema = {
        "@context": [schemaContextUrl, protocolContextUrl],
        //"@context": schemaContextUrl,
        "@type": "reproschema:Protocol",
        "@id": `${protocolName}_schema`,
        "skos:prefLabel": protocolDisplayName,
        //"skos:altLabel": `${protocolName}_schema`,
        "schema:description": protocolDescription,
        "schema:schemaVersion": schemaVersion,
        "schema:version": "0.0.1",
        // todo: preamble: Field Type = descriptive represents preamble in the CSV file., it also has branching logic. so should preamble be an item in our schema?
        "ui": {
            "addProperties": protocolAddProperties,
            "order": protocolOrder,
            "shuffle": false,
            //"allow": protocolAllow,
            //"visibility": protocolVisibilityObj
        }
    };
    const op = JSON.stringify(protocolSchema, null, 4);
    // console.log(269, jsonLD);
    fs.writeFile(`protocols/${protocolName}/${protocolName}_schema`, op, function (err) {
        if (err) {
            console.log("error in writing protocol schema")
        }
        else console.log("Protocol schema created");
    });

}

function parseLanguageIsoCodes(inputString){
    let languages = [];
    const root = HTMLParser.parse(inputString);
    if(root.childNodes.length > 0 && inputString.indexOf('lang') !== -1){
        if(root.childNodes){
            root.childNodes.forEach(htmlElement => {
                if (htmlElement.rawAttributes && htmlElement.rawAttributes.hasOwnProperty('lang')) {
                    languages.push(htmlElement.rawAttributes.lang)
                }
            });
        }
    }
    return languages;
}

function parseHtml(inputString) {
    let result = {};
    const root = HTMLParser.parse(inputString);
    if(root.childNodes.length > 0 ){
        if (root.childNodes) {
            root.childNodes.forEach(htmlElement => {
                if(htmlElement.text) {
                    if (htmlElement.rawAttributes && htmlElement.rawAttributes.hasOwnProperty('lang')) {
                        result[htmlElement.rawAttributes.lang] = htmlElement.text;
                    } else {
                        result[defaultLanguage] = htmlElement.text;
                    }
                }
            });
        }
    }
    else {
        result[defaultLanguage] = inputString;
    }
    return result;
}