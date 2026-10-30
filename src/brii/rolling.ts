import {MAX_SEGMENT,sentenceStart,type Segment} from './decoding';
// Align original characters to displayed characters so a window can retire old words
// without replacing the remaining original spelling with model-generated text.
function rawBoundaries(raw:string,text:string){
 const width=text.length+1,table=new Uint16Array((raw.length+1)*width);
 for(let i=0;i<=raw.length;i++)table[i*width]=i;
 for(let j=0;j<=text.length;j++)table[j]=j;
 for(let i=1;i<=raw.length;i++)for(let j=1;j<=text.length;j++)table[i*width+j]=Math.min(table[(i-1)*width+j]+1,table[i*width+j-1]+1,table[(i-1)*width+j-1]+(raw[i-1]===text[j-1]?0:1));
 const boundary=new Array<number>(width);let i=raw.length,j=text.length;boundary[j]=i;
 while(i||j){const cost=table[i*width+j];if(i&&j&&cost===table[(i-1)*width+j-1]+(raw[i-1]===text[j-1]?0:1)){i--;j--;boundary[j]=i;}else if(i&&cost===table[(i-1)*width+j]+1){i--;boundary[j]=i;}else{j--;boundary[j]=i;}}
 boundary[0]=0;boundary[text.length]=raw.length;return boundary;
}
interface Revision {start:number;end:number;raw:string;}
// Revisions retain what the user typed, not the model's previous guesses.
export class RollingDraft {
 private revisions:Revision[]=[];
 private protectedRanges:{start:number;end:number}[]=[];
 reset(){this.revisions=[];this.protectedRanges=[];}
 protect(end:number){this.reset();if(end>0)this.protectedRanges=[{start:0,end}];}
 edited(previous:string,value:string,history=false){
  let start=0;while(start<previous.length&&start<value.length&&previous[start]===value[start])start++;
  let oldEnd=previous.length,newEnd=value.length;
  while(oldEnd>start&&newEnd>start&&previous[oldEnd-1]===value[newEnd-1]){oldEnd--;newEnd--;}
  const delta=newEnd-oldEnd;let oldFrom=start,oldTo=oldEnd;
  while(oldFrom>0&&/\S/.test(previous[oldFrom-1]))oldFrom--;while(oldTo<previous.length&&/\S/.test(previous[oldTo]))oldTo++;
  // Backspacing raw, unresolved typing must not freeze the whole preceding draft.
  // Protect Undo and deliberate edits to text that Brii actually reconstructed.
  const overlaps=(r:{start:number;end:number})=>start===oldEnd?r.start<start&&r.end>start:r.start<oldEnd&&r.end>start;
  const reconstructed=this.revisions.some(r=>r.end>oldFrom&&r.start<oldTo&&r.raw!==previous.slice(r.start,r.end));
  const deliberate=history||reconstructed||this.protectedRanges.some(overlaps);
  this.revisions=this.revisions.filter(r=>r.end<=oldFrom||r.start>=oldTo).map(r=>r.start>=oldEnd?{...r,start:r.start+delta,end:r.end+delta}:r);
  this.protectedRanges=this.protectedRanges.flatMap(r=>r.end<=start?[r]:r.start>=oldEnd?[{start:r.start+delta,end:r.end+delta}]:[]);
  if(deliberate){let from=start,to=newEnd;while(from>0&&/\S/.test(value[from-1]))from--;while(to<value.length&&/\S/.test(value[to]))to++;if(to>from)this.protectedRanges.push({start:from,end:to});}
  this.protectedRanges.sort((a,b)=>a.start-b.start);this.protectedRanges=this.protectedRanges.reduce<{start:number;end:number}[]>((ranges,r)=>{const last=ranges.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else ranges.push({...r});return ranges;},[]);
 }
 segment(value:string,boundary:number,wholeSentence=false,manual=false):Segment|undefined {
  let start=sentenceStart(value,boundary);
  const end=value.slice(0,boundary).trimEnd().length;if(end<=start)return;
  if(!wholeSentence){const words=[...value.slice(start,end).matchAll(/\S+/g)];if(words.length>12)start+=words[words.length-12].index!;}
  // Never cut through a previous reconstruction: its raw spelling is indivisible.
  for(const revision of this.revisions)if(revision.start<start&&revision.end>start)start=revision.start;
  while(start<end&&/\s/.test(value[start]))start++;
  const shown=value.slice(start,end);if(!shown.trim())return;
  let raw='',at=start;
  for(const revision of this.revisions){if(revision.start<start||revision.end>end)continue;raw+=value.slice(at,revision.start)+revision.raw;at=revision.end;}
  raw+=value.slice(at,end);
  if(raw.length>MAX_SEGMENT||shown.length>MAX_SEGMENT)throw Error(`Correction chunk exceeds ${MAX_SEGMENT} characters. Finish this sentence before continuing.`);
  return {start,end,raw,context:value.slice(Math.max(0,start-400),start),prefix:value.slice(0,end),protectedRanges:this.protectedRanges.filter(r=>r.end>start&&r.start<end).map(r=>({...r}))};
 }
 canApply(segment:Segment,text:string){
  if(!segment.protectedRanges?.length)return true;
  const shown=segment.prefix.slice(segment.start,segment.end);if(text===shown)return true;const boundaries=rawBoundaries(text,shown);
  return (segment.protectedRanges||[]).every(r=>{const start=Math.max(r.start,segment.start)-segment.start,end=Math.min(r.end,segment.end)-segment.start;return text.slice(boundaries[start],boundaries[end])===shown.slice(start,end);});
 }
 applied(segment:Segment,text:string,manual=false){
  const delta=text.length-(segment.end-segment.start),mapped=rawBoundaries(text,segment.prefix.slice(segment.start,segment.end));
  this.protectedRanges=this.protectedRanges.flatMap(r=>{
   if(r.end<=segment.start)return [r];if(r.start>=segment.end)return [{start:r.start+delta,end:r.end+delta}];
   if(manual)return [...(r.start<segment.start?[{start:r.start,end:segment.start}]:[]),...(r.end>segment.end?[{start:segment.start+text.length,end:r.end+delta}]:[])];
   return [{start:r.start<segment.start?r.start:segment.start+mapped[r.start-segment.start],end:r.end>segment.end?r.end+delta:segment.start+mapped[r.end-segment.start]}];
  });
  this.revisions=this.revisions.filter(r=>r.end<=segment.start||r.start>=segment.end).map(r=>r.start>=segment.end?{...r,start:r.start+delta,end:r.end+delta}:r);
  const boundaries=rawBoundaries(segment.raw,text);
  for(const word of text.matchAll(/\S+|\s+/g)){const start=word.index!,end=start+word[0].length;this.revisions.push({start:segment.start+start,end:segment.start+end,raw:segment.raw.slice(boundaries[start],boundaries[end])});}
  this.revisions.sort((a,b)=>a.start-b.start);
 }
}
