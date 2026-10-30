import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {correctionPayload,outputText,DRAFT_STRATEGY} from './cloud-server.mjs';
const apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||'gpt-4.1';
const report={model,measured:false,note:'One request per case/strategy; latency is not a distribution. Inspect outputs for regressions and intended wording. No automatic semantic accuracy claim.',rows:[]};
if(!apiKey){report.note='Live comparison not run: OPENAI_API_KEY is not configured. No requests were made.';}
else{
 const dataset=JSON.parse(await readFile(new URL('../public/brii-revision-dataset.json',import.meta.url),'utf8'));
 for(const item of dataset.cases)for(const strategy of ['raw-only-baseline',DRAFT_STRATEGY]){
  const started=performance.now();let row={id:item.id,strategy,raw:item.raw,current:item.current,review:item.review};
  try{
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(correctionPayload({model,text:item.raw,current:item.current,context:item.context},strategy)),signal:AbortSignal.timeout(45000),redirect:'error'});
   if(!response.ok)row.error='OpenAI HTTP '+response.status;
   else{const data=await response.json();if(data.status==='incomplete')row.error='Incomplete model response';else{row.output=outputText(data).trim();row.unchangedFromDraft=row.output===item.current;if(!row.output)row.error='Empty model response';}}
   row.latencyMs=Math.round(performance.now()-started);
  }catch{row.latencyMs=Math.round(performance.now()-started);row.error='Request failed or timed out';}
  report.rows.push(row);console.log(JSON.stringify(row));
 }
 report.measured=report.rows.some(row=>typeof row.output==='string'&&row.output.length>0);
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/cloud-revision-benchmark.json',JSON.stringify(report,null,2));
console.log(report.note+'\nReport: artifacts/cloud-revision-benchmark.json');
if(apiKey&&report.rows.some(row=>row.error))process.exitCode=1;
