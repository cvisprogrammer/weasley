import {segmentAt,sentenceStart,planReplacement,type DecodeResult,type Segment,type Selection} from './decoding';
export interface FlowResult {segment:Segment;result:DecodeResult;applied:boolean;unchanged:boolean;reason:string;elapsedMs:number;}
export interface FlowOptions {active?:()=>boolean;trustedOnly?:boolean;decodingStatus?:string;ready:()=>boolean;automatic:()=>boolean;delay:()=>number;decode:(text:string,context:string)=>Promise<DecodeResult>;cancel:()=>void;status:(text:string)=>void;result:(result:FlowResult)=>void;changed?:()=>void;}
// One in-flight operation plus one latest boundary. Editing remains entirely native to the textarea.
export class BriiFlow {
 private epoch=0;private frontier=0;private pending=false;private applying=false;private composing=false;private previous:string;private before?:{start:number;end:number};
 private queued?:{boundary:number;manual:boolean;epoch:number;due:number;at:number};private timer?:ReturnType<typeof setTimeout>;
 constructor(private editor:HTMLTextAreaElement,private options:FlowOptions){
  this.previous=editor.value;
  editor.addEventListener('beforeinput',()=>{if(!this.applying&&this.active())this.before={start:editor.selectionStart,end:editor.selectionEnd};});
  editor.addEventListener('input',e=>this.input(e as InputEvent));
  editor.addEventListener('compositionstart',()=>{this.composing=true;if(this.active())this.invalidate('IME composition: correction paused.');});
  editor.addEventListener('compositionend',()=>{this.composing=false;if(this.active())this.previous=editor.value;});
  editor.addEventListener('keydown',e=>{if(this.active()&&(!this.options.trustedOnly||e.isTrusted)&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.isComposing){e.preventDefault();this.manual();}});
 }
 private active(){return this.options.active?.()??true;}
 get isBusy(){return this.pending;}
 invalidate(message='Pending corrections cancelled.'){
  this.epoch++;this.queued=undefined;clearTimeout(this.timer);if(this.active())this.frontier=sentenceStart(this.editor.value,this.editor.selectionStart);else{this.frontier=0;this.previous='';}if(this.pending)this.options.cancel();this.options.status(message);
 }
 manual(){if(this.composing||!this.active())return;this.editor.focus({preventScroll:true});if(this.editor.selectionStart!==this.editor.selectionEnd){this.options.status('Collapse the selection first. Selected text is never overwritten.');return;}this.enqueue(this.editor.selectionStart,true);}
 private input(event:InputEvent){
  if(this.applying||!this.active()||(this.options.trustedOnly&&!event.isTrusted))return;const value=this.editor.value;
  const history=event.inputType==='historyUndo'||event.inputType==='historyRedo';
  const appendOnly=this.before?.start===this.previous.length&&this.before?.end===this.previous.length&&value.startsWith(this.previous);this.before=undefined;
  if(history||!appendOnly)this.invalidate(history?'Undo/redo preserved. Type another Space to resume.':'Edit invalidated the previous correction.');
  this.previous=value;
  if(this.composing||event.isComposing||history)return;
  if(this.options.automatic()&&event.inputType==='insertText'&&event.data===' '&&this.editor.selectionStart===this.editor.selectionEnd)this.enqueue(this.editor.selectionStart,false);
 }
 private enqueue(boundary:number,manual:boolean){
  if(!this.options.ready()){this.options.status('Decoder is not ready. Check the connection or model; raw typing continues normally.');return;}
  const at=performance.now();this.queued={boundary,manual,epoch:this.epoch,due:at+(manual?0:this.options.delay()),at};
  this.options.status(this.pending?'Queued the latest completed text; current inference continues.':'Waiting for the short Space debounce…');this.drain();
 }
 private drain(){
  clearTimeout(this.timer);if(this.pending||!this.queued||this.composing)return;
  const wait=this.queued.due-performance.now();if(wait>0){this.timer=setTimeout(()=>this.drain(),wait);return;}
  const queued=this.queued;this.queued=undefined;
  if(!this.options.ready()||queued.epoch!==this.epoch||(!queued.manual&&!this.options.automatic())||document.activeElement!==this.editor||this.editor.selectionStart<queued.boundary){this.options.status('Queued correction skipped after focus, selection, model, or mode changed.');return;}
  let segment:Segment|undefined;try{segment=segmentAt(this.editor.value,queued.boundary,this.frontier,queued.manual);}catch(e){this.options.status(String(e));return;}if(!segment)return;
  const started=queued.at;this.pending=true;this.options.status(this.options.decodingStatus||'Decoding locally… keep typing.');
  void this.options.decode(segment.raw,segment.context).then(result=>{
   let applied=false,unchanged=false,reason=result.validationError?'Correction not applied: '+result.validationError:'Result discarded after an edit, selection change, blur, or composition.';
   if(this.active()&&!result.validationError&&queued.epoch===this.epoch&&!this.composing&&document.activeElement===this.editor){
    const selection:Selection={start:this.editor.selectionStart,end:this.editor.selectionEnd,direction:this.editor.selectionDirection};
    const plan=planReplacement(segment!,result.corrected,this.editor.value,selection);
    if(plan){
     if(segment!.raw===result.corrected){unchanged=true;reason='The model returned the text unchanged. It may not have decoded it; the next completed words will be included in another attempt.';}
     else{
      const scrollTop=this.editor.scrollTop,scrollLeft=this.editor.scrollLeft;this.applying=true;
      try{
       this.editor.setSelectionRange(plan.start,plan.end);
       // A native replacement is one undoable edit; never fall back to .value/setRangeText.
       applied=document.execCommand('insertText',false,plan.text);
       if(applied){this.editor.setSelectionRange(plan.selection.start,plan.selection.end,plan.selection.direction);reason='Correction applied; ordinary Undo restores the raw text.';}
       else{this.editor.setSelectionRange(selection.start,selection.end,selection.direction);reason='Browser rejected native insertion; original text preserved.';}
      }finally{this.applying=false;this.previous=this.editor.value;this.editor.scrollTop=scrollTop;this.editor.scrollLeft=scrollLeft;}
     }
     if(applied){this.frontier=plan.start+plan.text.length;if(this.queued&&this.queued.boundary>=plan.end)this.queued.boundary+=plan.delta;}
    }
   }
   this.options.result({segment:segment!,result,applied,unchanged,reason,elapsedMs:performance.now()-started});this.options.status(reason);
  }).catch(e=>this.options.status('Correction failed; original text preserved. '+String(e))).finally(()=>{this.pending=false;this.drain();this.options.changed?.();});
 }
}
