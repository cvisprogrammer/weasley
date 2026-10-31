import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {readFileSync} from 'node:fs';import {createCloudServer,COMMAND_PROMPT} from '../scripts/cloud-server.mjs';
const {extensionId}=JSON.parse(readFileSync('public/cloud-config.json','utf8'));
const headers={'Content-Type':'application/json','X-Brii-Extension':extensionId,Origin:'chrome-extension://'+extensionId};
test('command route separates instruction/context, validates structured drafts and blocks calendar tools',async()=>{
 let calls=0,reply={status:'ok',text:'Hope you are well!',reason:''};const server=createCloudServer({extensionId,apiKey:'fixture',fetcher:async(endpoint:string,request:any)=>{calls++;assert.equal(endpoint,'https://api.openai.com/v1/responses');const payload=JSON.parse(request.body);assert.equal(payload.instructions,COMMAND_PROMPT);assert.deepEqual(JSON.parse(payload.input),{instruction:'a friendly greeting',mode:'write',before:'Hi David, ',after:' See you soon.'});assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.store,false);return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify(reply)}));}});server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+(server.address() as any).port;
 const input={instruction:'a friendly greeting',mode:'write',before:'Hi David, ',after:' See you soon.'};const send=(body:any,h=headers)=>fetch(url+'/command',{method:'POST',headers:h,body:JSON.stringify(body)});
 try{
 assert.equal((await(await fetch(url+'/health')).json()).commands,true);
 const response=await(await send(input)).json();assert.equal(response.text,'Hope you are well!');assert.equal(response.commandStrategy,'inline-commands-v1');assert.equal(calls,1);
 assert.equal((await send({...input,instruction:'check my calendar and stick in a time'})).status,409);assert.equal(calls,1);
 assert.equal((await send({...input,before:'x'.repeat(1201)})).status,400);assert.equal(calls,1);
 assert.equal((await send(input,{...headers,Origin:'https://evil.test'})).status,403);assert.equal(calls,1);
 reply={status:'unavailable',text:'',reason:'No calendar connection.'};assert.equal((await send(input)).status,409);
 reply={status:'ok',text:'',reason:''};assert.equal((await send(input)).status,422);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
