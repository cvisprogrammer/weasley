import test from 'node:test';import assert from 'node:assert/strict';import {commandAt} from '../src/brii/commands';
test('double slash commands support closing delimiters and line-end Enter',()=>{
 const line='Hi David, //a friendly greeting//',command=commandAt(line,line.length,'close')!;assert.equal(command.instruction,'a friendly greeting');assert.equal(command.before,'Hi David, ');assert.equal(line.slice(command.start,command.end),'//a friendly greeting//');
 const open='Hi David\n//a friendly greeting';assert.equal(commandAt(open,open.length,'enter')!.instruction,'a friendly greeting');assert.equal(commandAt(open,open.length,'close'),undefined);
 const continuation='Sorry to hear about //...//';assert.equal(commandAt(continuation,continuation.length,'close')!.mode,'continue');
});
test('ordinary slashes, URLs, empty markers and escaped literals are not commands',()=>{
 for(const line of ['https://example.com/path','a/b/c','/instruction/','////','\\//literal'])assert.equal(commandAt(line,line.length,'enter'),undefined);
 const url='//summarize https://example.com//';assert.equal(commandAt(url,url.length,'close')!.instruction,'summarize https://example.com');
});
test('command replacement is bounded and Enter never executes half a line',()=>{
 const line='Hi //greeting// other text';const at=line.indexOf(' other');assert.equal(commandAt(line,at,'close')!.after,' other text');assert.equal(commandAt(line,at,'enter'),undefined);
 assert.equal(commandAt(line,line.length,'enter')!.instruction,'greeting');
});
