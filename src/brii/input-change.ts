export interface Caret {start:number;end:number;}
export type InputChange='unchanged'|'append'|'restart'|'edit'|'history';
// Decide from the actual text change, not optional InputEvent.data/inputType metadata.
export function inputChange(previous:string,value:string,before:Caret|undefined,selection:Caret,history:boolean,isAppend:(start:number,end:number)=>boolean):InputChange {
 if(history)return 'history';
 if(value===previous)return 'unchanged';
 // Empty-editor placeholder changes and initial paste/typing cannot edit existing words.
 if(!previous.trim())return 'append';
 // Select-all and replace starts a new draft; it must not protect its first keystroke.
 if(!value||before?.start===0&&before.end===previous.length)return 'restart';
 const replacedSelection=!!before&&before.start>=0&&before.end>before.start&&before.end<=previous.length;
 const added=value.length-previous.length,start=selection.start-added;
 if(!replacedSelection&&added>0&&selection.start===selection.end&&start>=0&&start<=previous.length&&isAppend(start,start))return 'append';
 return 'edit';
}
