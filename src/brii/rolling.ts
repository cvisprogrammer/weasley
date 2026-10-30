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
 private protectedEnd=0;
 protect(end:number){this.revisions=[];this.protectedEnd=end;}
 segment(value:string,boundary:number,wholeSentence=false,manual=false):Segment|undefined {
  let start=Math.max(manual?0:this.protectedEnd,sentenceStart(value,boundary));
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
  return {start,end,raw,context:value.slice(Math.max(0,start-400),start),prefix:value.slice(0,end)};
 }
 applied(segment:Segment,text:string){
  const delta=text.length-(segment.end-segment.start);
  if(segment.start<this.protectedEnd)this.protectedEnd=Math.max(segment.start,this.protectedEnd+delta);
  this.revisions=this.revisions.filter(r=>r.end<=segment.start||r.start>=segment.end).map(r=>r.start>=segment.end?{...r,start:r.start+delta,end:r.end+delta}:r);
  const boundaries=rawBoundaries(segment.raw,text);
  for(const word of text.matchAll(/\S+|\s+/g)){const start=word.index!,end=start+word[0].length;this.revisions.push({start:segment.start+start,end:segment.start+end,raw:segment.raw.slice(boundaries[start],boundaries[end])});}
  this.revisions.sort((a,b)=>a.start-b.start);
 }
}
