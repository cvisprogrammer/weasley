export interface Example { id:string; input:string; expected:string; }
export interface Dataset {version:number;cases:Example[];}
export function parseDataset(raw:string):Dataset {
 const value=JSON.parse(raw);
 if(!value||!Array.isArray(value.cases)||!value.cases.length||value.cases.length>100)throw Error('Dataset needs 1–100 cases.');
 const ids=new Set<string>();
 for(const row of value.cases){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.input!=='string'||!row.input.trim()||row.input.length>600||typeof row.expected!=='string'||!row.expected)throw Error('Each case needs a unique id, input (1–600 characters), and expected text.');ids.add(row.id);}
 return {version:Number(value.version)||1,cases:value.cases.map((r:Example)=>({id:r.id,input:r.input,expected:r.expected}))};
}
export function distance<T>(expected:T[],actual:T[]):number {
 let previous=Array.from({length:actual.length+1},(_,i)=>i);
 for(let i=1;i<=expected.length;i++){const current=[i];for(let j=1;j<=actual.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(expected[i-1]===actual[j-1]?0:1));previous=current;}
 return previous[actual.length];
}
export function errors(expected:string,actual:string) {
 const chars=Array.from(expected),words=expected.trim().split(/\s+/);const characterEdits=distance(chars,Array.from(actual)),wordEdits=distance(words,actual.trim()?actual.trim().split(/\s+/):[]);
 return {characterEdits,wordEdits,referenceCharacters:chars.length,referenceWords:words.length,cer:characterEdits/Math.max(1,chars.length),wer:wordEdits/Math.max(1,words.length)};
}
export interface BenchmarkRow extends Example {output:string|null;ttftMs:number|null;totalMs:number|null;metrics:ReturnType<typeof errors>|null;semanticChanges:number|null;rawOutput?:string;validationError?:string;validationCode?:string;removedEmptyThinkingPrefix?:boolean;rawTtftMs?:number|null;finishReason?:string|null;error?:string;}
export function summarize(rows:BenchmarkRow[]) {
 const complete=rows.filter(r=>r.metrics!==null),reviewed=complete.filter(r=>r.semanticChanges!==null);
 const percentile=(values:number[],p:number)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted.length?sorted[Math.ceil(sorted.length*p)-1]:null;};
 const characters=complete.reduce((s,r)=>s+r.metrics!.referenceCharacters,0),words=complete.reduce((s,r)=>s+r.metrics!.referenceWords,0);
 return {executed:rows.length,completed:complete.length,failed:rows.length-complete.length,invalidOutputs:complete.filter(r=>r.validationError).length,cer:characters?complete.reduce((s,r)=>s+r.metrics!.characterEdits,0)/characters:null,wer:words?complete.reduce((s,r)=>s+r.metrics!.wordEdits,0)/words:null,totalP50Ms:percentile(complete.map(r=>r.totalMs!),.5),totalP95Ms:percentile(complete.map(r=>r.totalMs!),.95),ttftP50Ms:percentile(complete.flatMap(r=>r.ttftMs===null?[]:[r.ttftMs]),.5),semanticReview:{reviewedCases:reviewed.length,unreviewedCases:complete.length-reviewed.length,unintendedChanges:reviewed.length?reviewed.reduce((s,r)=>s+r.semanticChanges!,0):null}};
}
