import {BriiEngine} from './brii/engine';
import {BriiFlow} from './brii/flow';
import {DECODER_PROMPT} from './brii/decoding';
import {parseDataset,errors,summarize,type Dataset,type BenchmarkRow} from './brii/metrics';
const $=(id:string)=>document.getElementById(id)!;
const button=(id:string)=>$(id) as HTMLButtonElement;
const input=(id:string)=>$(id) as HTMLInputElement;
const editor=$('editor') as HTMLTextAreaElement;
const fmt=(value:number|null)=>value===null?'—':`${value.toFixed(1)} ms`;
let initializing=false,benchmarking=false,stopping=false,dataset:Dataset|undefined,rows:BenchmarkRow[]=[],report:any;
const engine=new BriiEngine(text=>{$('modelStatus').textContent=text;syncControls();});
const loaded=()=>engine.ready&&!initializing&&engine.model===input('model').value;
const flow=new BriiFlow(editor,{ready:()=>loaded()&&!benchmarking,automatic:()=>input('automatic').checked&&!benchmarking,delay:()=>Math.max(0,Math.min(1000,Number(input('debounce').value)||0)),decode:(text,context)=>engine.decode(text,context,{allowInvalid:true}),cancel:()=>engine.cancel(),status:text=>{$('flowStatus').textContent=text;syncControls();},changed:()=>syncControls(),result:r=>{
 $('raw').textContent=r.segment.raw;$('decoded').textContent=r.result.corrected;
 $('rawResponse').textContent=JSON.stringify(r.result.rawOutput??r.result.corrected,null,2);$('rawResponseDetails').toggleAttribute('open',!!r.result.validationError);$('responseReason').textContent=`${r.result.validationCode||'valid'} · finish: ${r.result.finishReason||'unknown'} · empty thinking prefix removed: ${r.result.removedEmptyThinkingPrefix?'yes':'no'}`;
 $('requestStats').textContent=`First token: ${fmt(r.result.ttftMs)} · Inference total: ${fmt(r.result.totalMs)} · Space/manual → result: ${fmt(r.elapsedMs)} · ${r.applied?'Applied':'Not applied'}`;
}});
function syncControls(){button('correct').disabled=!loaded()||benchmarking;button('benchmark').disabled=!loaded()||benchmarking||flow.isBusy||!dataset;button('load').disabled=benchmarking||initializing||flow.isBusy;input('model').disabled=benchmarking||initializing;}
$('load').onclick=async()=>{initializing=true;button('load').disabled=true;flow.invalidate('Loading model; raw typing stays available.');try{await engine.initialize(input('model').value);$('flowStatus').textContent='Ready. Type normally; Space completes a chunk for correction.';}catch(e){$('flowStatus').textContent='Model unavailable. Raw typing still works; no correction has been applied.';$('modelStatus').textContent=String(e);$('benchmarkStatus').textContent='Inference benchmark not run: '+String(e);}finally{initializing=false;syncControls();}};
$('reset').onclick=()=>{stopping=true;flow.invalidate('Model reset; original text retained.');engine.dispose();$('modelStatus').textContent='Model released. Load again to resume.';syncControls();};
input('model').onchange=()=>{flow.invalidate('Model selection changed. Load the selected model to resume.');syncControls();};
input('automatic').onchange=()=>flow.invalidate(input('automatic').checked?'Automatic correction resumes on the next Space.':'Automatic correction off. Manual correction is still available.');
$('correct').onmousedown=e=>e.preventDefault();$('correct').onclick=()=>flow.manual();
function setDataset(raw:string){dataset=parseDataset(raw);$('datasetStatus').textContent=`${dataset.cases.length} cases · edit public/brii-dataset.json or choose a JSON file. No upload occurs.`;syncControls();}
void fetch('brii-dataset.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(`Dataset HTTP ${r.status}`);return r.text();}).then(setDataset).catch(e=>{$('datasetStatus').textContent=String(e);});
input('datasetFile').onchange=async()=>{try{const file=input('datasetFile').files?.[0];if(file){if(file.size>100000)throw Error('Dataset file exceeds 100 KB.');setDataset(await file.text());}}catch(e){$('datasetStatus').textContent=String(e);}};
function summary(){if(!report)return;report.rows=rows;report.summary=summarize(rows);report.unrunCases=report.dataset.cases.length-rows.length;$('benchmarkSummary').textContent=JSON.stringify(report.summary,null,2);button('export').disabled=false;}
function renderRow(row:BenchmarkRow){
 const tr=document.createElement('tr'),source=document.createElement('td'),raw=document.createElement('p'),reference=document.createElement('p');raw.textContent=row.input;reference.className='reference';reference.textContent='Expected: '+row.expected;source.append(raw,reference);tr.append(source);
 for(const value of [row.output!==null?row.output+(row.validationError?'\n[Not safe to apply: '+row.validationError+']':''):row.error??'No output',fmt(row.ttftMs),fmt(row.totalMs),row.metrics?`${(row.metrics.cer*100).toFixed(1)}% / ${(row.metrics.wer*100).toFixed(1)}%`:'Not measured']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
 const review=document.createElement('td'),count=document.createElement('input');count.type='number';count.min='0';count.step='1';count.placeholder='—';count.disabled=row.output===null;count.setAttribute('aria-label',`Unintended semantic changes for ${row.id}`);count.oninput=()=>{row.semanticChanges=count.value===''?null:Number.isInteger(Number(count.value))&&Number(count.value)>=0?Number(count.value):null;summary();};review.append(count);tr.append(review);$('benchmarkRows').append(tr);
}
$('benchmark').onclick=async()=>{
 if(!loaded()||!dataset||flow.isBusy||benchmarking)return;
 benchmarking=true;stopping=false;flow.invalidate('Automatic correction paused for the benchmark. Raw typing remains available.');syncControls();button('stopBenchmark').hidden=false;button('export').disabled=true;rows=[];$('benchmarkRows').replaceChildren();$('benchmarkSummary').textContent='';
 const selectedDataset=structuredClone(dataset);
 report={at:new Date().toISOString(),userAgent:navigator.userAgent,model:engine.model,modelSelectionReason:engine.model.includes('0.8B')?'Explicit smaller-model speed/quality comparison; baseline was not silently switched.':'Existing Qwen3.5-2B baseline retained.',webllm:'0.2.86',prompt:DECODER_PROMPT,temperature:0,thinking:false,initializationMs:engine.loadMs,dataset:selectedDataset,warmup:null,rows,summary:null,unrunCases:selectedDataset.cases.length,timing:'Warm request includes chat reset and worker messaging; initialization, typing debounce, rendering and human review are excluded. TTFT is first decoder content after the synthetic empty thinking header; rawTtftMs records first raw stream content. No actual reasoning is accepted.',semanticReview:'Human count required; null means unreviewed, never zero.',targets:{idealMs:100,experimentalMs:300}};
 try{
  $('benchmarkStatus').textContent='Warming up the loaded model (excluded from scored cases)…';
  try{report.warmup=await engine.decode('teh cta sat','',{allowInvalid:true});}catch(e){report.warmup={error:String(e)};}
  for(const example of selectedDataset.cases){if(stopping||!engine.ready)break;$('benchmarkStatus').textContent=`Decoding ${example.id}…`;
   const row:BenchmarkRow={...example,output:null,ttftMs:null,totalMs:null,metrics:null,semanticChanges:null};
   try{const value=await engine.decode(example.input,'',{allowInvalid:true});if(stopping)break;row.output=value.corrected;row.rawOutput=value.rawOutput;row.validationError=value.validationError;row.validationCode=value.validationCode;row.removedEmptyThinkingPrefix=value.removedEmptyThinkingPrefix;row.rawTtftMs=value.rawTtftMs;row.finishReason=value.finishReason;row.ttftMs=value.ttftMs;row.totalMs=value.totalMs;row.metrics=errors(example.expected,value.corrected);}catch(e){row.error=String(e);}
   rows.push(row);renderRow(row);summary();
  }
  $('benchmarkStatus').textContent=stopping?'Benchmark stopped; remaining cases were not run.':rows.length===selectedDataset.cases.length?'Finished. Review unintended semantic changes before exporting.':'Benchmark incomplete: the model became unavailable.';
 }finally{report.stopped=stopping;summary();benchmarking=false;button('stopBenchmark').hidden=true;syncControls();$('flowStatus').textContent='Benchmark finished. Automatic correction resumes on the next Space.';}
};
$('stopBenchmark').onclick=()=>{stopping=true;engine.cancel();$('benchmarkStatus').textContent='Stopping the benchmark…';};
$('export').onclick=()=>{if(!report)return;summary();const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='brii-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',()=>engine.dispose());
