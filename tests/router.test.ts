import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {defaults} from '../src/shared.ts';
test('built-in test page routes locally with or without sender.tab; other pages require consent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'weasley-router-')),previous=(globalThis as any).chrome;let listener:any,forwarded:any;let config={...defaults};
 const noop={addListener:()=>{}};
 (globalThis as any).chrome={storage:{local:{get:async()=>({settings:config})},onChanged:noop},runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:(fn:any)=>listener=fn},onInstalled:noop,onStartup:noop,sendMessage:async(m:any)=>{forwarded=m;return {text:' Friday at noon'};}},offscreen:{hasDocument:async()=>true}};
 try{
  await build({entryPoints:['src/background.ts'],outfile:join(dir,'background.mjs'),bundle:true,format:'esm',platform:'node'});await import(join(dir,'background.mjs'));
  const send=(sender:any,kind='predict')=>new Promise<any>(resolve=>listener({target:'background',kind,prefix:'It is on ',context:'The meeting is Friday at noon.'},{id:'test',...sender},resolve));
  for(const tab of [undefined,{id:1}]){assert.equal((await send({url:'chrome-extension://test/test.html',documentId:'lab-doc',tab})).text,' Friday at noon');assert.equal(forwarded.context,'The meeting is Friday at noon.');}
  assert.match((await send({url:'https://unapproved.test',tab:{id:2}})).error,/not enabled/);
  assert.match((await send({url:'chrome-extension://test/other.html'})).error,/Unauthorized/);
  assert.match((await send({url:'chrome-extension://test/test.html'},'load')).error,/Enable/);
  config={...defaults,enabled:false};assert.match((await send({url:'chrome-extension://test/test.html'})).error,/Enable/);
 }finally{(globalThis as any).chrome=previous;await rm(dir,{recursive:true,force:true});}
});
