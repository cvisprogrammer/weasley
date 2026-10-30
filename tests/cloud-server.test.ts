import {request as rawRequest} from 'node:http';import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createCloudServer,CLOUD_PROMPT,DRAFT_CLOUD_PROMPT,correctionPayload} from '../scripts/cloud-server.mjs';
const config=JSON.parse(readFileSync('public/cloud-config.json','utf8'));const id=config.extensionId;const origin='chrome-extension://'+id;
async function start(options:any={}){const server=createCloudServer({extensionId:id,...options});server.listen(0,'127.0.0.1');await once(server,'listening');return {server,url:'http://127.0.0.1:'+(server.address() as any).port};}
const headers={'Content-Type':'application/json','X-Brii-Extension':id,Origin:origin};
test('bridge identity matches manifest public key and no API key is bundled',()=>{const manifest=JSON.parse(readFileSync('public/manifest.json','utf8'));const actual=[...createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest().subarray(0,16)].flatMap(b=>[String.fromCharCode(97+(b>>4)),String.fromCharCode(97+(b&15))]).join('');assert.equal(actual,id);assert.deepEqual(manifest.permissions,['storage','scripting','activeTab']);assert.equal(manifest.action.default_popup,'flow-popup.html');});
test('bridge uses GPT-4.1 and the original raw-only prompt only after authorized requests and hides credentials',async()=>{
 let calls:any[]=[];const {server,url}=await start({apiKey:'fixture-key-not-real',fetcher:async(endpoint:string,request:any)=>{calls.push({endpoint,request});return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'The cat'}]}]}));}});
 try{
 const health=await(await fetch(url+'/health',{headers:{Origin:origin}})).json();assert.equal(health.enabled,true);assert.equal(health.model,'gpt-4.1');assert.equal(JSON.stringify(health).includes('fixture-key'),false);
 const result=await fetch(url+'/correct',{method:'POST',headers,body:JSON.stringify({text:'teh cta',context:'Earlier. ',current:'The cta'})});assert.equal((await result.json()).corrected,'The cat');assert.equal(calls.length,1);const payload=JSON.parse(calls[0].request.body);assert.equal(calls[0].endpoint,'https://api.openai.com/v1/responses');assert.equal(payload.instructions,CLOUD_PROMPT);assert.equal(payload.model,'gpt-4.1');assert.equal(health.strategy,'raw-only-baseline');assert.equal(payload.store,false);assert.equal(payload.input,'Context (not to be corrected): Earlier. \n\nText to correct:\nteh cta');assert.equal(payload.input.includes('The cta'),false);
 for(const bad of [{...headers,Origin:'https://evil.example'},{...headers,'X-Brii-Extension':'wrong'}]){assert.equal((await fetch(url+'/correct',{method:'POST',headers:bad,body:JSON.stringify({text:'teh'})})).status,403);}assert.equal(calls.length,1);const denied=await new Promise<number>(resolve=>{const req=rawRequest(url+'/health',{headers:{Host:'evil.example'}},res=>{resolve(res.statusCode!);res.resume();});req.end();});assert.equal(denied,403);
 assert.equal((await fetch(url+'/correct',{method:'POST',headers,body:JSON.stringify({text:'x'.repeat(601)})})).status,400);assert.equal(calls.length,1);for(const current of [undefined,42,'x'.repeat(601)]){assert.equal((await fetch(url+'/correct',{method:'POST',headers,body:JSON.stringify({text:'teh',current})})).status,400);}assert.equal(calls.length,1);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('missing key and truncated upstream replies never become applied corrections',async()=>{
 let calls=0;let running=await start({apiKey:'',fetcher:async()=>{calls++;return new Response('{}');}});
 try{const response=await fetch(running.url+'/correct',{method:'POST',headers,body:'{"text":"teh","current":"teh"}'});assert.equal(response.status,503);assert.equal(calls,0);}finally{await new Promise<void>(resolve=>running.server.close(()=>resolve()));}
 running=await start({apiKey:'fixture-key',fetcher:async()=>new Response('{"status":"incomplete","output_text":"partial"}')});
 try{const response=await fetch(running.url+'/correct',{method:'POST',headers,body:'{"text":"teh","current":"teh"}'});assert.equal(response.status,422);assert.equal((await response.json()).corrected,undefined);}finally{await new Promise<void>(resolve=>running.server.close(()=>resolve()));}
});

test('benchmark preserves distinct baseline and rejected draft-aware strategies',()=>{
 const baseline=correctionPayload({text:'raw',current:'draft'});
 const draft=correctionPayload({text:'raw',current:'draft'},'raw-current-v1');
 assert.equal(baseline.model,'gpt-4.1');assert.equal(baseline.instructions,CLOUD_PROMPT);assert.equal(baseline.input.includes('draft'),false);
 assert.equal(draft.instructions,DRAFT_CLOUD_PROMPT);assert.deepEqual(JSON.parse(draft.input),{context:'',raw:'raw',current_draft:'draft'});
});
