import type {FlowResult} from './flow';
export function resultLabel(result:FlowResult){
 return `${result.applied?'Suggestion applied':result.unchanged?'No visible change':'Suggestion not applied'} · ${Math.round(result.result.totalMs)} ms · quality unverified${result.unprocessedTail?' · newer typing not included':''}`;
}
// A single bounded, in-memory trace. Render all model/user text literally.
export function resultView(){
 const element=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
 element.hidden=true;element.style.cssText='pointer-events:auto;font:12px/1.5 system-ui;background:#f7faf7;color:#24332e;border:1px solid #b9c6bc;border-radius:5px;margin-top:4px;padding:6px 10px;max-width:min(400px,calc(100vw - 48px));';
 summary.textContent='Last result';summary.style.cursor='pointer';body.style.cssText='max-height:40vh;overflow:auto;';element.append(summary,body);
 return {element,clear(){element.hidden=true;element.open=false;body.replaceChildren();summary.textContent='Last result';},update(result:FlowResult){
  summary.textContent='Last result · '+(result.applied?'suggestion applied':result.unchanged?'no visible change':'not applied');
  body.replaceChildren();const info=document.createElement('p');info.textContent=`${result.result.model||'Model not reported'} · ${resultLabel(result)}. “Applied” does not mean correct. ${result.reason}`;body.append(info);
  const rows=[['Original typing sent',result.segment.raw],['Text shown before request',result.segment.prefix.slice(result.segment.start,result.segment.end)],['Context sent',result.segment.context],['Model response',result.result.corrected]];
  for(const [label,text] of rows){const heading=document.createElement('strong'),value=document.createElement('pre');heading.textContent=label;value.textContent=text||'(empty)';value.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:3px 0 10px;';body.append(heading,value);}
  element.hidden=false;
 }};
}
