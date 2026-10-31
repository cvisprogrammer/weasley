import type {CommandTrigger} from './trigger';
import type {EditorSurface} from './editor';
export interface InlineCommand {pageDomain?:string;pageContext?:string;emailContext?:string;start:number;end:number;instruction:string;mode:'write'|'continue'|'rewrite-line';scope:'command'|'line';lineText:string;before:string;after:string;prefix:string;}
// A command starts at a line/word boundary; URL protocol slashes are never delimiters.
export function commandAt(value:string,caret:number,trigger:'close'|'enter',marker:CommandTrigger='//'):InlineCommand|undefined {
 if(caret<0||caret>value.length)return;
 if(trigger==='enter'&&caret<value.length&&value[caret]!=='\n')return;
 const lineStart=value.lastIndexOf('\n',caret-1)+1,line=value.slice(lineStart,caret);let found:InlineCommand|undefined;
 for(let open=0;open<line.length-1;open++){
  if(line.slice(open,open+2)!==marker||(open>0&&!/\s/.test(line[open-1])))continue;
  let close=-1;for(let i=open+2;i<line.length-1;i++)if(line.slice(i,i+2)===marker&&(marker!=='//'||![':', '\\'].includes(line[i-1]))){close=i;break;}
  const end=close<0?line.length:close+2,instruction=line.slice(open+2,close<0?line.length:close).trim();
  if(instruction&&(trigger==='enter'||close>=0&&end===line.length)){
   const markerStart=lineStart+open,markerEnd=lineStart+end,nextBreak=value.indexOf('\n',caret),lineEnd=nextBreak<0?value.length:nextBreak;
   const lineText=value.slice(lineStart,markerStart)+value.slice(markerEnd,lineEnd),continuation=['...','…'].includes(instruction),rewrite=!continuation&&!!lineText.trim();
   const start=rewrite?lineStart:markerStart,absoluteEnd=rewrite?lineEnd:markerEnd;
   found={start,end:absoluteEnd,instruction,mode:continuation?'continue':rewrite?'rewrite-line':'write',scope:rewrite?'line':'command',lineText:rewrite?lineText:'',before:value.slice(Math.max(0,start-1200),start),after:value.slice(absoluteEnd,absoluteEnd+400),prefix:value.slice(0,absoluteEnd)};
  }
  if(close<0)break;open=close+1;
 }
 return found;
}
export interface CommandReply {text:string;model?:string;totalMs?:number;}
interface Options {source?:()=>Pick<InlineCommand,'emailContext'|'pageContext'|'pageDomain'>;trigger?:()=>CommandTrigger;active:()=>boolean;ready:()=>boolean;trustedOnly?:boolean;run:(command:InlineCommand,signal:AbortSignal)=>Promise<CommandReply>;status:(message:string)=>void;}
export class InlineCommands {
 private applying=false;private composing=false;private epoch=0;private pending?:{abort:AbortController;command:InlineCommand;epoch:number;caret:number};
 private listeners:{target:EventTarget;type:string;listener:EventListener;capture:boolean}[]=[];
 constructor(private editor:EditorSurface,private element:HTMLElement,private options:Options){
  const listen=(target:EventTarget,type:string,fn:(e:any)=>void,capture=false)=>{target.addEventListener(type,fn,capture);this.listeners.push({target,type,listener:fn,capture});};
  // Capture Enter before normal editor/form handlers; no automatic message sending.
  listen(document,'keydown',e=>this.key(e),true);
  listen(element,'compositionstart',()=>{this.composing=true;this.invalidate('Composition in progress; command paused.');});
  listen(element,'compositionend',()=>{this.composing=false;});
  listen(element,'input',(event:InputEvent)=>{
   if(this.applying||!this.options.active()||this.options.trustedOnly&&!event.isTrusted)return;
   if(this.pending&&!this.matches(this.pending.command))this.invalidate(this.pending.command.scope==='line'?'Target line changed; rewrite cancelled. Finish the line and press Enter to retry.':'Command edited or undone; result cancelled.');
   if(this.composing||event.isComposing)return;
   // Pasting instructions does not execute them. Enter explicitly executes pasted commands.
   if(event.inputType==='insertText'&&event.data===(this.options.trigger?.()||'//')[1]&&editor.selectionStart===editor.selectionEnd){const command=commandAt(editor.value,editor.selectionStart,'close',this.options.trigger?.());if(command)this.execute(command);}
  });
 }
 invalidate(message='Pending command cancelled.'){this.epoch++;this.pending?.abort.abort();this.pending=undefined;this.options.status(message);}
 dispose(){this.invalidate();for(const {target,type,listener,capture} of this.listeners)target.removeEventListener(type,listener,capture);this.listeners=[];}
 private matches(command:InlineCommand){const value=this.editor.value;return value.startsWith(command.prefix)&&(command.scope!=='line'||command.end===value.length||value[command.end]==='\n');}
 private key(event:KeyboardEvent){
  if(this.applying||!this.options.active()||!this.editor.isFocused()||this.options.trustedOnly&&!event.isTrusted||this.composing||event.isComposing||event.keyCode===229)return;
  if(event.key==='Escape'&&this.pending){event.preventDefault();event.stopImmediatePropagation();this.invalidate('Command cancelled. Original command kept.');return;}
  if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||this.editor.selectionStart!==this.editor.selectionEnd)return;
  if(this.pending){event.preventDefault();event.stopImmediatePropagation();this.options.status('Command is still running. Shift+Enter inserts a newline; Escape cancels.');return;}
  const command=commandAt(this.editor.value,this.editor.selectionStart,'enter',this.options.trigger?.());if(!command)return;
  event.preventDefault();event.stopImmediatePropagation();this.execute(command,true);
 }
 private execute(command:InlineCommand,newline=false){
  if(this.pending){this.options.status('A command is already running. Keep typing, or Escape to cancel.');return;}
  if(!this.options.ready()){this.options.status('Bridge not ready. Start or restart npm run cloud; command kept.');return;}
  if(command.lineText.length>1600){this.options.status('Keep a rewrite line under 1600 characters.');return;}
  if(command.instruction.length>600){this.options.status('Keep the instruction under 600 characters.');return;}
  if(!this.editor.canReplace(command.start,command.end)){this.options.status('Command contains unsupported formatting or embedded content.');return;}
  const {emailContext,pageContext,pageDomain}=this.options.source?.()||{};command={...command,...(emailContext?{emailContext}:{}),...(pageContext?{pageContext}:{}),...(pageDomain?{pageDomain}:{})};
  let newlineInserted=false;if(newline){this.applying=true;try{newlineInserted=this.editor.insertText('\n',true);}finally{this.applying=false;}}
  const state={abort:new AbortController(),command,epoch:this.epoch,caret:this.editor.selectionStart};this.pending=state;
  this.options.status((command.scope==='line'?'Rewriting this line… editing it cancels. Other lines stay unchanged. Escape cancels.':'Running command… keep typing. Escape cancels.')+(emailContext?' Using visible Gmail thread ('+emailContext.length+' characters).':'')+(pageContext?' Using webpage context ('+pageContext.length+' characters).':'')+(newline&&!newlineInserted?' Enter runs the command here; use Shift+Enter for a newline.':''));
  void this.options.run(command,state.abort.signal).then(async result=>{
   const caret=this.editor.selectionStart,selectionEnd=this.editor.selectionEnd,insideOriginal=command.scope==='line'&&caret===selectionEnd&&caret===state.caret;
   if(state.abort.signal.aborted||state.epoch!==this.epoch||!this.options.active()||this.composing||!this.editor.isFocused()||!this.matches(command)||!insideOriginal&&(caret<command.end||selectionEnd<command.end)){if(this.pending===state)this.options.status('Result discarded after editing, blur or selection change.');return;}
   if(typeof result.text!=='string'||!result.text.trim()||result.text.length>2400)throw Error('Empty or oversized command response.');
   const insertionIssue=this.editor.insertionIssue?.(result.text);if(insertionIssue)throw Error(insertionIssue);
   const value=this.editor.value,selection={start:this.editor.selectionStart,end:this.editor.selectionEnd,direction:this.editor.selectionDirection},delta=result.text.length-(command.end-command.start),scrollTop=this.editor.scrollTop,scrollLeft=this.editor.scrollLeft;
   const expected=value.slice(0,command.start)+result.text+value.slice(command.end);this.applying=true;
   try{
    this.editor.setSelectionRange(command.start,command.end);
    this.editor.insertText(result.text,true);
    const commit=this.editor.settleInsertion?.();if(commit)await commit;
    if(this.editor.value===expected){if(selection.start<command.end)this.editor.setSelectionRange(command.start+result.text.length,command.start+result.text.length);else this.editor.setSelectionRange(selection.start+delta,selection.end+delta,selection.direction);this.options.status(`Inserted · ${result.model||'AI'}${result.totalMs!==undefined?' · '+Math.round(result.totalMs)+' ms':''} · Undo restores command`);}
    else if(this.editor.value===value){this.editor.setSelectionRange(selection.start,selection.end,selection.direction);this.options.status('Editor rejected insertion. Command kept.');}
    else this.options.status('Host editor changed the insertion; result not confirmed.');
   }finally{this.applying=false;this.editor.scrollTop=scrollTop;this.editor.scrollLeft=scrollLeft;}
  }).catch(error=>{if(!state.abort.signal.aborted&&state.epoch===this.epoch)this.options.status(String(error.message||error)+' Command kept.');}).finally(()=>{if(this.pending===state)this.pending=undefined;});
 }
}
export function commandTransport(send:(message:any)=>Promise<any>){
 return async(command:InlineCommand,signal:AbortSignal):Promise<CommandReply>=>{
  const requestId=crypto.randomUUID();const cancel=()=>void send({kind:'cancel',requestId}).catch(()=>{});signal.addEventListener('abort',cancel,{once:true});
  try{const response=await send({kind:'command',requestId,instruction:command.instruction,mode:command.mode,lineText:command.lineText,before:command.before,after:command.after,...(command.emailContext?{emailContext:command.emailContext}:{}),...(command.pageContext?{pageContext:command.pageContext}:{}),...(command.pageDomain?{pageDomain:command.pageDomain}:{})});if(response.error)throw Error(response.error==='Not found'?'Restart the updated bridge to enable inline commands.':response.error);if(response.commandStrategy!=='inline-commands-v5')throw Error('Restart the updated Brii bridge for inline commands.');return response;}finally{signal.removeEventListener('abort',cancel);}
 };
}
