import {WebWorkerMLCEngine,prebuiltAppConfig} from '@mlc-ai/web-llm';
const output=document.getElementById('result')!,button=document.getElementById('run') as HTMLButtonElement,exportButton=document.getElementById('export') as HTMLButtonElement;
let result:object;
exportButton.onclick=()=>{const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='weasley-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
button.onclick=async()=>{
 button.disabled=true;exportButton.disabled=true;const start=performance.now();let worker:Worker|undefined;
 const model=(document.getElementById('model') as HTMLSelectElement).value;
 try {
  const adapter=await (navigator as any).gpu?.requestAdapter();if(!adapter)throw Error('No WebGPU adapter. Inference benchmark cannot run.');
  if(!adapter.features.has('shader-f16'))throw Error('Selected f16 model requires shader-f16.');
  worker=new Worker('worker.js',{type:'module'});
  const engine=new WebWorkerMLCEngine(worker,{appConfig:{cacheBackend:'indexeddb',model_list:prebuiltAppConfig.model_list.filter(m=>m.model_id===model).map(m=>({...m,model_lib:new URL(`models/${model}.wasm`,location.href).href}))},initProgressCallback:p=>{output.textContent=p.text;},logLevel:'ERROR'});
  await engine.reload(model);const loadMs=performance.now()-start;
  const prompts=['I wanted to follow up on our conversation and','Please let me know when you have time to','The most important thing to remember is'];
  const rows: {round:number;prompt:string;ttftMs:number;completeMs:number;characters:number;completion:string}[]=[];
  for(let round=0;round<2;round++)for(const prompt of prompts){await engine.resetChat();const t=performance.now();let first=0,text='';const stream=await engine.completions.create({prompt,stream:true,max_tokens:10,temperature:.15,stop:['\n','<|im_end|>','<|endoftext|>']});for await(const c of stream){const value=c.choices[0]?.text||'';if(value&&!first)first=performance.now()-t;text+=value;}rows.push({round,prompt,ttftMs:first,completeMs:performance.now()-t,characters:text.length,completion:text});output.textContent=JSON.stringify(rows,null,2);}
  const percentile=(key:'ttftMs'|'completeMs',p:number)=>{const v=rows.map(r=>r[key]).sort((a,b)=>a-b);return v[Math.ceil(v.length*p)-1];};
  result={at:new Date().toISOString(),model,userAgent:navigator.userAgent,loadMs,samples:rows.length,ttftP50:percentile('ttftMs',.5),ttftP95:percentile('ttftMs',.95),completeP50:percentile('completeMs',.5),completeP95:percentile('completeMs',.95),rows,note:'Inference timings exclude idle delay; load time includes first-use download or cache read. No human typing-speed claim.'};await engine.unload();
 }catch(e){result={at:new Date().toISOString(),model,error:String(e),elapsedMs:performance.now()-start};}
 finally{worker?.terminate();button.disabled=false;exportButton.disabled=false;output.textContent=JSON.stringify(result!,null,2);}
};
