# reproschema-builder

Create protocol from a CSV table:

1. Convert any survey into the format of the data dictionary template below:


### template for CSV 

Variable / Field Name |	Section Header | Form Name  |	Field Type  |	multipleChoice	| Field Label |	Choices, Calculations, OR Slider Labels | minVal |  maxVal |	Branching Logic (Show field only if...) | Form Display Name | Allow | Field Annotation
|------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------|  ------------| ------------|  ------------| 
|          |            |        |            |               |              |              |          |           |        |        |        |          |     

+ **Variable / Field Name:** The id for the survey item (required). <br/>
+ **Section Header:** Optional. Preamble for the survey item (leave blank if you don't want a preamble). <br/>
+ **Form Name:** The id of the activity the survey item is a part of (required). <br/>
+ **Field Type:** Type of reponse for survey item, currently supports: 
  + 1 for radio button
  + 2 for checkbox
  + 3 for slider
  + 4 for text 
  + 0 for markdown message (leave response options column blank)
  <br/>
+ **multipleChoice:** Used for radio button items. Set value=1 if the item is a multi-choice checklist, leave blank if single choice. <br/>
+ **Field Label:** Question/text for survey item. <br/>
+ **Choices, Calculations, OR Slider Labels:** Reponse list for survey item, in the form of `1=choice1, 2=choice2` etc. Leave blank for text and markdown message items. <br/>
+ **maxVal** Used for slider items, the text to display for max value of slider bar. Leave blank for other items types. <br/>
+ **minVal** Used for slider items, the text to display for min value of slider bar. Leave blank for other items types.  <br/>
+ **Branching Logic (Show field only if...):** (NOT TESTED) Optional. For conditional logic. For example, if `question2` only shows when `question1` has value 1, fill this column with `[question1]=1` for the row of `question2`. If the question has no conditional logic, leave this column blank. <br/>
+ **Form Display Name** Name of the activity the survey item is a part of <br/>
+ **Allow** Optional. Properties for the `Allow` array of the item, for example `autoAdvance` to auto-advance after choosing a response option (no need to click 'next') <br/>
+ **Field Annotation** Optional. Field description <br/>


### Usage: 
1. Fork and clone repo
1. Add your csv file to the input/your_personal_folder/ 
2. `npm install` when running the script for the first time
3. `node tools/mhdb2ReproSchema.js input/path_to_your_csv_file "protocol name"`
4. Commit and push the changes
5. Use the link to the raw file of your protocol schema to add your applet to mindlogger (e.g. https://raw.githubusercontent.com/ChildMindInstitute/reproschema-builder/master/applets/protocols/grd_1/grd_1_schema) 
