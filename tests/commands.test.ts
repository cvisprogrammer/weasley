import test from 'node:test';import assert from 'node:assert/strict';import {commandAt} from '../src/brii/commands';
test('double slash commands support closing delimiters and line-end Enter',()=>{
 const line='Hi David, //a friendly greeting//',command=commandAt(line,line.length,'close')!;assert.equal(command.instruction,'a friendly greeting');assert.equal(command.before,'');assert.equal(command.scope,'line');assert.equal(command.mode,'rewrite-line');assert.equal(command.lineText,'Hi David, ');assert.equal(line.slice(command.start,command.end),line);
 const open='Hi David\n//a friendly greeting';assert.equal(commandAt(open,open.length,'enter')!.instruction,'a friendly greeting');assert.equal(commandAt(open,open.length,'close'),undefined);
 const continuation='Sorry to hear about //...//';assert.equal(commandAt(continuation,continuation.length,'close')!.mode,'continue');
});
test('ordinary slashes, URLs, empty markers and escaped literals are not commands',()=>{
 for(const line of ['https://example.com/path','a/b/c','/instruction/','////','\\//literal'])assert.equal(commandAt(line,line.length,'enter'),undefined);
 const url='//summarize https://example.com//';assert.equal(commandAt(url,url.length,'close')!.instruction,'summarize https://example.com');
});
test('command replacement is bounded and Enter never executes half a line',()=>{
 const line='Hi //greeting// other text';const at=line.indexOf(' other');assert.equal(commandAt(line,at,'close')!.after,'');assert.equal(commandAt(line,at,'close')!.lineText,'Hi  other text');assert.equal(commandAt(line,at,'close')!.end,line.length);assert.equal(commandAt(line,at,'enter'),undefined);
 assert.equal(commandAt(line,line.length,'enter')!.instruction,'greeting');
});

test('line rewrites include both sides of the command and exclude adjacent paragraphs',()=>{
 const value='Before.\nOld prefix //make warmer// old suffix\nAfter.',caret=value.indexOf(' old suffix');
 const command=commandAt(value,caret,'close')!;assert.equal(command.mode,'rewrite-line');assert.equal(command.lineText,'Old prefix  old suffix');assert.equal(command.before,'Before.\n');assert.equal(command.after,'\nAfter.');assert.equal(value.slice(command.start,command.end),'Old prefix //make warmer// old suffix');
 const own='Before.\n//a greeting//\nAfter.';const insertion=commandAt(own,own.indexOf('\nAfter.'),'close')!;assert.equal(insertion.mode,'write');assert.equal(insertion.scope,'command');assert.equal(insertion.before,'Before.\n');
});
