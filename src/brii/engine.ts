import {WebWorkerMLCEngine,prebuiltAppConfig} from '@mlc-ai/web-llm';
import {modelId} from '../shared';
import {DecoderOutputError,decoderMessages,safeOutput,type DecodeResult,MAX_SEGMENT} from './decoding';
export const BRII_MODELS=[modelId,'Qwen3.5-0.8B-q4f16_1-MLC'];
export class BriiEngine {
 ready=false; model=modelId; loadMs:number|null=null;
 private worker?:Worker;private engine?:WebWorkerMLCEngine;private lifetime=new AbortController();private busy=false;
 constructor(private progress:(text:string)=>void){}
 private async guarded<T>(task:Promise<T>,signal:AbortSignal,ms:number):Promise<T>{
  signal.throwIfAborted();let timeout:ReturnType<typeof setTimeout>|undefined;let abort:()=>void=()=>{};
  try{return await Promise.race([task,new Promise<never>((_,reject)=>{abort=()=>reject(signal.reason||Error('Model reset.'));signal.addEventListener('abort',abort,{once:true});timeout=setTimeout(()=>{reject(Error('Local model timed out. Reset and reload the model.'));this.dispose();},ms);})]);}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
 }
 async initialize(model=modelId){
  if(this.busy)throw Error('Wait for the current request, or reset the model.');
  if(this.ready&&this.model===model)return;
  if(!BRII_MODELS.includes(model))throw Error('Choose a packaged, registry-compatible Brii model.');
  this.dispose();this.lifetime=new AbortController();const signal=this.lifetime.signal;this.busy=true;const start=performance.now();
  try{
   const adapter=await (navigator as any).gpu?.requestAdapter();signal.throwIfAborted();
   if(!adapter)throw Error('No WebGPU adapter is available. Use a WebGPU-enabled Chrome; no inference benchmark can run here.');
   if(!adapter.features.has('shader-f16'))throw Error('These existing f16 models require shader-f16 support.');
   const records=prebuiltAppConfig.model_list.filter(m=>BRII_MODELS.includes(m.model_id));
   if(!records.some(m=>m.model_id===model))throw Error('Selected model is missing from the installed WebLLM registry.');
   this.worker=new Worker('worker.js',{type:'module'});
   this.worker.onerror=()=>{this.dispose();this.progress('Model worker failed. Reset and reload.');};
   this.engine=new WebWorkerMLCEngine(this.worker,{appConfig:{cacheBackend:'indexeddb',model_list:records.map(m=>({...m,model_lib:new URL(`models/${m.model_id}.wasm`,location.href).href}))},initProgressCallback:p=>this.progress(p.text),logLevel:'ERROR'});
   await this.guarded(this.engine.reload(model),signal,600000);signal.throwIfAborted();this.model=model;this.loadMs=performance.now()-start;this.ready=true;this.progress(`Ready · ${model} · model data cached locally`);
  }catch(e){if(!signal.aborted)this.dispose();throw e;}finally{if(signal===this.lifetime.signal)this.busy=false;}
 }
 async decode(text:string,context='',options:{allowInvalid?:boolean}={}):Promise<DecodeResult>{
  if(!this.ready||!this.engine)throw Error('Load the local model first. Raw typing is still available.');
  if(this.busy)throw Error('A local inference request is already active.');
  if(!text.trim()||text.length>MAX_SEGMENT)throw Error(`Use 1–${MAX_SEGMENT} characters per correction.`);
  this.busy=true;const signal=this.lifetime.signal,engine=this.engine,start=performance.now();
  const task=async()=>{
   await engine.resetChat();signal.throwIfAborted();let output='',first:number|null=null,truncated=false;
   const stream=await engine.chat.completions.create({messages:decoderMessages(text,context),temperature:0,max_tokens:Math.min(512,Math.max(64,Math.ceil(text.length*.9)+24)),stream:true,extra_body:{enable_thinking:false}});
   for await(const chunk of stream){signal.throwIfAborted();const choice=chunk.choices[0],value=choice?.delta.content||'';if(value&&first===null)first=performance.now()-start;output+=value;if(choice?.finish_reason==='length')truncated=true;}
   const totalMs=performance.now()-start;
   try{return {corrected:safeOutput(output,truncated),rawOutput:output,ttftMs:first,totalMs};}
   catch(e){if(!options.allowInvalid)throw e;return {corrected:output.replace(/\r\n?/g,'\n').trim(),rawOutput:output,validationError:String(e),ttftMs:first,totalMs};}
  };
  try{return await this.guarded(task(),signal,60000);}catch(e){if(!signal.aborted&&!(e instanceof DecoderOutputError)){this.ready=false;this.progress('Inference failed. Reset and reload the local model.');}throw e;}finally{if(signal===this.lifetime.signal)this.busy=false;}
 }
 cancel(){this.engine?.interruptGenerate();}
 dispose(){this.ready=false;this.lifetime.abort(Error('Model reset or worker lost.'));this.worker?.terminate();this.worker=undefined;this.engine=undefined;this.busy=false;}
}
