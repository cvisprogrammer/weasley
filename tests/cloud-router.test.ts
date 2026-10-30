import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('cloud gateway rejects disabled sites and never accepts arbitrary endpoints',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'brii-cloud-')),oldChrome=(globalThis as any).chrome,oldFetch=globalThis.fetch;let listener:any,calls=0;const noop={addListener:()=>{}};let s={enabled:false,automatic:true,sites:['https://allowed.test'],delay:80};
 (globalThis as any).chrome={runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:(f:any)=>listener=f},onInstalled:noop,onStartup:noop},storage:{local:{get:async()=>({briiCloud:s})},onChanged:noop}};
 globalThis.fetch=(async(url:any,options:any)=>{calls++;assert.equal(String(url),'http://127.0.0.1:3001/correct');assert.equal(options.headers['X-Brii-Extension'],'test');return new Response('{"corrected":"The"}');}) as typeof fetch;
 try{await build({entryPoints:['src/flow-background.ts'],outfile:join(dir,'main.mjs'),bundle:true,platform:'node',format:'esm'});await import(join(dir,'main.mjs'));const send=(sender:any,data:any={})=>new Promise<any>(r=>listener({target:'briiCloud',kind:'decode',requestId:'r',text:'teh',context:'',...data},{id:'test',...sender},r));
 assert.match((await send({url:'https://allowed.test',tab:{id:1}})).error,/Enable/);assert.equal(calls,0);s.enabled=true;assert.match((await send({url:'https://evil.test',tab:{id:1}})).error,/Enable/);assert.equal(calls,0);
 assert.equal((await send({url:'https://allowed.test',tab:{id:1}},{endpoint:'https://evil.test'})).corrected,'The');assert.equal(calls,1);
 assert.match((await send({url:'https://allowed.test',tab:{id:1}},{text:'x'.repeat(601)})).error,/Invalid/);assert.equal(calls,1);
 }finally{(globalThis as any).chrome=oldChrome;globalThis.fetch=oldFetch;await rm(dir,{recursive:true,force:true});}
});
