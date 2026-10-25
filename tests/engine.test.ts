import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {prepareThread} from '../src/mail/parse.ts';import {samples} from '../src/mail/samples.ts';
import {defaults} from '../src/shared.ts';
test('offscreen lifecycle reports failures, separates context, and produces a short suffix',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'weasley-engine-'));
 const previous={chrome:(globalThis as any).chrome,Worker:(globalThis as any).Worker};let listener:any;let request:any;let resets=0,interrupted=false,fail=false;
 const engine={reload:async()=>{},resetChat:async()=>{resets++;},interruptGenerate:()=>{interrupted=true;},chat:{completions:{create:async(args:any)=>{request=args;if(fail)throw Error('TEST_GPU_FAILURE');if(args.stream===false)return {choices:[{message:{content:JSON.stringify({verdict:'reply_needed',target:'me',evidence:'Could you reply to confirm whether Friday at noon works for our parent meeting?'})},finish_reason:'stop'}]};return (async function*(){for(const text of ['Friday',' at',' noon',' please'])yield {choices:[{delta:{content:text}}]};})();}}}};
 (globalThis as any).__testEngine=engine;
 (globalThis as any).Worker=class {};
 (globalThis as any).chrome={runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:(fn:any)=>listener=fn}}};
 try{
  await build({entryPoints:['src/offscreen.ts'],outfile:join(dir,'offscreen.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'fake-webllm',setup(b){b.onResolve({filter:/^@mlc-ai\/web-llm$/},()=>({path:'fake',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export class WebWorkerMLCEngine {constructor(){return globalThis.__testEngine;}};export const prebuiltAppConfig={model_list:[]};',loader:'js'}));}}]});
  await import(join(dir,'offscreen.mjs'));
  const send=(kind:string,data:any={})=>new Promise<any>(resolve=>listener({target:'engine',kind,settings:defaults,owner:1,...data},{id:'test'},resolve));
  const unloaded=await send('predict',{prefix:'It is on',context:''});assert.match(unloaded.reason,/Not loaded/);
  await send('load');const result=await send('predict',{prefix:'It is on',context:'The review is Friday at noon.'});assert.equal(result.text,' Friday at noon');assert.ok(interrupted);assert.equal(resets,1);assert.equal(request.extra_body.enable_thinking,false);assert.ok(request.max_tokens>=32);assert.equal(JSON.parse(request.messages[1].content).background,'The review is Friday at noon.');
  const mismatch=await send('predict',{prefix:'It is on',context:'',settings:{...defaults,model:'different'}});assert.match(mismatch.reason,/not loaded/);
  const mail=await send('classifyMail',{packet:prepareThread(samples[0],['you@example.test'])});assert.equal(mail.decision.verdict,'reply_needed');assert.equal(request.response_format.type,'json_object');assert.equal(request.extra_body.enable_thinking,false);
  for(let n=0;n<10&&(await send('status')).busy;n++)await new Promise(resolve=>setTimeout(resolve,0));
  fail=true;const failed=await send('predict',{prefix:'It is on',context:''});assert.match(failed.error,/TEST_GPU_FAILURE/);const state=await send('status');assert.equal(state.ready,false);
 }finally{(globalThis as any).chrome=previous.chrome;(globalThis as any).Worker=previous.Worker;delete (globalThis as any).__testEngine;await rm(dir,{recursive:true,force:true});}
});
