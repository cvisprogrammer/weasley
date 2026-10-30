import {test} from 'node:test';import assert from 'node:assert/strict';import {inputChange,type Caret} from '../src/brii/input-change';
function change(previous:string,value:string,before?:Caret,history=false){return inputChange(previous,value,before,{start:value.length,end:value.length},history,(start,end)=>start===previous.length&&end===previous.length&&value.startsWith(previous));}
test('initial fused-word paste or typing is eligible without beforeinput or InputEvent.data',()=>{
 assert.equal(change('','oktstingonelastitme'),'append');assert.equal(change('\n','oktstingonelastitme'),'append');assert.equal(change('o','oktstingonelastitme'),'append');
});
test('an input event observed after attachment already captured its text does not protect it',()=>{
 assert.equal(change('oktstingonelastitme','oktstingonelastitme'),'unchanged');
});
test('actual replacement, prefix edits, deletion and Undo remain protected',()=>{
 assert.equal(change('abc','axc',{start:1,end:2}),'edit');assert.equal(change('abc','axcde'),'edit');assert.equal(change('abc','ab'),'edit');assert.equal(change('same','same',undefined,true),'history');
});

test('select-all replacement and clearing the field start a fresh eligible draft',()=>{
 assert.equal(change('previous attempt','o',{start:0,end:16}),'restart');
 assert.equal(change('previous attempt','',undefined),'restart');
});
