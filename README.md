# reproschema-builder

Create protocol from a CSV table:

1. Convert any survey into the format of the data dictionary template below:


### template for CSV 

Variable / Field Name |	Section Header | Form Name  |	Field Type  |	multipleChoice	| Field Label |	Choices, Calculations, OR Slider Labels | minVal |  maxVal |	Branching Logic (Show field only if...) |
|------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------| ------------| 
|          |            |        |            |               |              |              |          |           |        |     

+ **Variable / Field Name:** The id for the survey item (required). <br/>
+ **Section Header:** Preamble for the survey item (leave blank if you don't want a preamble). <br/>
+ **Form Name:** Name of the activity the survey item is a part of (required). <br/>
+ **Field Type:** Type of reponse for survey item, currently supports: 
  + `radio`
  + `select`
  + `slider`
  + `text`
  + `static`
  + `timeRange`
  <br/>
+ **multipleChoice:** Used for `radio` items. Set value=1 if the item is a multi-choice checklist, leave blank if single choice. <br/>
+ **Field Label:** Question/text for survey item. <br/>
+ **Choices, Calculations, OR Slider Labels:** Reponse list for survey item, in the form of `value1, choice1 | value2, choice2 | value 3, choice3` etc. Leave blank for `text`, `static`, and `timeRange` items. <br/>
+ **maxVal** Used for slider items, the text to display for max value of slider bar. Leave blank for other items types. <br/>
+ **minVal** Used for slider items, the text to display for min value of slider bar. Leave blank for other items types.  <br/>
+ **Branching Logic (Show field only if...):** For conditional logic. For example, if `question2` only shows when `question1` has value 1, fill this column with `[question1]=1` for the row of `question2`. If the question has no conditional logic, leave this column blank. <br/>


### Usage: 
`node tools/mhdb2ReproSchema.js input/path_to_your_csv_file "protocol name"`

