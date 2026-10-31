import test from 'node:test';import assert from 'node:assert/strict';
import {variants,requestFor,compare,summarize,markdown,RECONSTRUCTION_PROMPT,reasoningVariants,listModels} from '../scripts/cloud-model-benchmark.mjs';
import {BASELINE_CLOUD_PROMPT} from '../scripts/cloud-server.mjs';
const item={id:'case',raw:'knwowhatimtryingotsayornot',context:'Earlier sentence. ',review:'Private review note, never model input'};
test('three-way comparison isolates prompt and model with identical raw input',()=>{
 const conditions=variants(),requests=conditions.map((c:any)=>requestFor(c,item));
 assert.deepEqual(conditions.map((v:any)=>v.model),['gpt-4.1','gpt-4.1','gpt-5']);assert.equal(requests[0].instructions,BASELINE_CLOUD_PROMPT);
 assert.equal(requests[1].instructions,RECONSTRUCTION_PROMPT);assert.equal(requests[2].instructions,requests[1].instructions);
 assert.equal(requests[0].input,requests[1].input);assert.equal(requests[1].input,requests[2].input);assert.equal(requests[0].input.includes(item.review),false);
 assert.equal(requests[0].max_output_tokens,requests[2].max_output_tokens);assert.equal(requests[2].store,false);assert.deepEqual(requests[2].reasoning,{effort:'minimal'});assert.equal(requests[1].reasoning,undefined);
 assert.equal(variants('another-model')[2].reasoning,undefined);
});
test('repeats rotate order and report each raw output without claiming semantic scores',async()=>{
 const requests:any[]=[];const conditions=variants();const rows=await compare({cases:[item],conditions,repeats:2,apiKey:'fixture',fetcher:async(url:string,options:any)=>{assert.equal(url,'https://api.openai.com/v1/responses');requests.push(JSON.parse(options.body));return new Response('{"status":"completed","output_text":"know what I am trying to say or not"}');}});
 assert.equal(requests.length,6);assert.deepEqual(rows.map((r:any)=>r.variant),['4.1-baseline','4.1-reconstruct','candidate-reconstruct','4.1-reconstruct','candidate-reconstruct','4.1-baseline']);
 const summary=summarize(rows,conditions);assert.equal(summary.length,3);assert.ok(summary.every((r:any)=>r.completed===2&&r.errors===0&&r.latencyMs.median>=0));
 assert.ok(rows.every((r:any)=>r.output&&!('accuracy' in r)&&!('apiKey' in r)));
 const report=markdown({note:'fixture',dataset:{cases:[item]},rows:[{...rows[0],output:'```\n<script>unsafe</script>\n```'}]});assert.match(report,/````\n```/);
});
test('inaccessible candidate is explicit, skipped on repeats and never replaced silently',async()=>{
 let candidateCalls=0;const rows=await compare({cases:[item],conditions:variants(),repeats:2,apiKey:'fixture',fetcher:async(_url:string,options:any)=>{const request=JSON.parse(options.body);if(request.model==='gpt-5'){candidateCalls++;return new Response('secret error detail',{status:404});}return new Response('{"status":"completed","output_text":"OK"}');}});
 assert.equal(candidateCalls,1);const own=rows.filter((r:any)=>r.model==='gpt-5');assert.equal(own[0].error,'OpenAI HTTP 404');assert.match(own[1].skipped,/404/);assert.equal(JSON.stringify(rows).includes('secret error detail'),false);
});
test('truncated output is reported as failure, never a usable prediction',async()=>{
 const rows=await compare({cases:[item],conditions:[variants()[0]],apiKey:'fixture',fetcher:async()=>new Response('{"status":"incomplete","output_text":"partial"}')});assert.match(rows[0].error,/Incomplete/);assert.equal(rows[0].output,undefined);
});

test('reasoning comparison varies only effort and provides equal reasoning/output budgets',()=>{
 const conditions=reasoningVariants(),requests=conditions.map((c:any)=>requestFor(c,item));
 assert.deepEqual(requests.map((r:any)=>r.reasoning.effort),['minimal','low','medium']);
 for(const request of requests){assert.equal(request.model,'gpt-5');assert.equal(request.instructions,RECONSTRUCTION_PROMPT);assert.equal(request.input,requests[0].input);assert.equal(request.max_output_tokens,4096);assert.equal(request.store,false);}
 assert.deepEqual(reasoningVariants('gpt-6-sol').map((c:any)=>c.reasoning.effort),['low','medium']);
 assert.deepEqual(reasoningVariants('gpt-6-astra',['medium']).map((c:any)=>c.id),['gpt-6-astra-medium']);
});
test('account model listing filters newer families and never prints credentials',async()=>{
 const ids=await listModels({apiKey:'fixture',fetcher:async(url:string,request:any)=>{assert.equal(url,'https://api.openai.com/v1/models');assert.equal(request.headers.Authorization,'Bearer fixture');return new Response(JSON.stringify({data:[{id:'gpt-6-sol'},{id:'gpt-4.1'},{id:'gpt-5'},{id:'gpt-6.1-sol'}]}));}});
 assert.deepEqual(ids,['gpt-5','gpt-6-sol','gpt-6.1-sol']);
 await assert.rejects(listModels({apiKey:'fixture',fetcher:async()=>new Response('secret body',{status:403})}),/HTTP 403/);
});
test('reasoning token use and incomplete budget failure are visible in the report',async()=>{
 const rows=await compare({cases:[item],conditions:[reasoningVariants()[2]],apiKey:'fixture',fetcher:async()=>new Response(JSON.stringify({status:'incomplete',model:'returned-model',incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:100,output_tokens:4096,output_tokens_details:{reasoning_tokens:4096}},output_text:'partial'}))});
 assert.equal(rows[0].maxOutputTokens,4096);assert.equal(rows[0].returnedModel,'returned-model');assert.equal(rows[0].incompleteReason,'max_output_tokens');assert.equal(rows[0].usage.reasoningTokens,4096);assert.equal(rows[0].output,undefined);
});
