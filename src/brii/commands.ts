import type {EditorSurface} from './editor';
export interface InlineCommand {start:number;end:number;instruction:string;mode:'write'|'continue';before:string;after:string;prefix:string;}
// A command starts at a line/word boundary; URL protocol slashes are never delimiters.
export function commandAt(value:string,caret:number,trigger:'close'|'enter'):InlineCommand|undefined {
 if(caret<0||caret>value.length)return;
 if(trigger==='enter'&&caret<value.length&&value[caret]!=='\n')return;
 const lineStart=value.lastIndexOf('\n',caret-1)+1,line=value.slice(lineStart,caret);let found:InlineCommand|undefined;
 for(let open=0;open<line.length-1;open++){
  if(line.slice(open,open+2)!=='//'||(open>0&&!/\s/.test(line[open-1])))continue;
  let close=-1;for(let i=open+2;i<line.length-1;i++)if(line.slice(i,i+2)==='//'&&![':', '\\'].includes(line[i-1])){close=i;break;}
  const end=close<0?line.length:close+2,instruction=line.slice(open+2,close<0?line.length:close).trim();
  if(instruction&&(trigger==='enter'||close>=0&&end===line.length)){
   const start=lineStart+open,absoluteEnd=lineStart+end;
   found={start,end:absoluteEnd,instruction,mode:['...','…'].includes(instruction)?'continue':'write',before:value.slice(Math.max(0,start-1200),start),after:value.slice(absoluteEnd,absoluteEnd+400),prefix:value.slice(0,absoluteEnd)};
  }
  if(close<0)break;open=close+1;
 }
 return found;
}
export interface CommandReply {text:string;model?:string;totalMs?:number;}
interface Options {active:()=>boolean;ready:()=>boolean;trustedOnly?:boolean;run:(command:InlineCommand,signal:AbortSignal)=>Promise<CommandReply>;status:(message:string)=>void;}
export class InlineCommands {
 private applying=false;private composing=false;private epoch=0;private pending?:{abort:AbortController;command:InlineCommand;epoch:number};
 private listeners:{target:EventTarget;type:string;listener:EventListener;capture:boolean}[]=[];
 constructor(private editor:EditorSurface,private element:HTMLElement,private options:Options){
  const listen=(target:EventTarget,type:string,fn:(e:any)=>void,capture=false)=>{target.addEventListener(type,fn,capture);this.listeners.push({target,type,listener:fn,capture});};
  // Capture Enter before normal editor/form handlers; no automatic message sending.
  listen(document,'keydown',e=>this.key(e),true);
  listen(element,'compositionstart',()=>{this.composing=true;this.invalidate('Composition in progress; command paused.');});
  listen(element,'compositionend',()=>{this.composing=false;});
  listen(element,'input',(event:InputEvent)=>{
   if(this.applying||!this.options.active()||this.options.trustedOnly&&!event.isTrusted)return;
   if(this.pending&&!editor.value.startsWith(this.pending.command.prefix))this.invalidate('Command edited or undone; result cancelled.');
   if(this.composing||event.isComposing)return;
   // Pasting instructions does not execute them. Enter explicitly executes pasted commands.
   if(event.inputType==='insertText'&&event.data==='/'&&editor.selectionStart===editor.selectionEnd){const command=commandAt(editor.value,editor.selectionStart,'close');if(command)this.execute(command);}
  });
 }
 invalidate(message='Pending command cancelled.'){this.epoch++;this.pending?.abort.abort();this.pending=undefined;this.options.status(message);}
 dispose(){this.invalidate();for(const {target,type,listener,capture} of this.listeners)target.removeEventListener(type,listener,capture);this.listeners=[];}
 private key(event:KeyboardEvent){
  if(this.applying||!this.options.active()||!this.editor.isFocused()||this.options.trustedOnly&&!event.isTrusted||this.composing||event.isComposing||event.keyCode===229)return;
  if(event.key==='Escape'&&this.pending){event.preventDefault();event.stopImmediatePropagation();this.invalidate('Command cancelled. Original command kept.');return;}
  if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||this.editor.selectionStart!==this.editor.selectionEnd)return;
  if(this.pending){event.preventDefault();event.stopImmediatePropagation();this.options.status('Command is still running. Shift+Enter inserts a newline; Escape cancels.');return;}
  const command=commandAt(this.editor.value,this.editor.selectionStart,'enter');if(!command)return;
  event.preventDefault();event.stopImmediatePropagation();this.execute(command,true);
 }
 private execute(command:InlineCommand,newline=false){
  if(this.pending){this.options.status('A command is already running. Keep typing, or Escape to cancel.');return;}
  if(!this.options.ready()){this.options.status('Bridge not ready. Start or restart npm run cloud; command kept.');return;}
  if(command.instruction.length>600){this.options.status('Keep the instruction under 600 characters.');return;}
  if(!this.editor.canReplace(command.start,command.end)){this.options.status('Command contains unsupported formatting or embedded content.');return;}
  if(newline){this.applying=true;try{this.editor.insertText('\n',true);}finally{this.applying=false;}}
  const state={abort:new AbortController(),command,epoch:this.epoch};this.pending=state;
  this.options.status('Running command… keep typing. Escape cancels.');
  void this.options.run(command,state.abort.signal).then(result=>{
   if(state.abort.signal.aborted||state.epoch!==this.epoch||!this.options.active()||this.composing||!this.editor.isFocused()||!this.editor.value.startsWith(command.prefix)||this.editor.selectionStart<command.end||this.editor.selectionEnd<command.end){if(this.pending===state)this.options.status('Result discarded after editing, blur or selection change.');return;}
   if(typeof result.text!=='string'||!result.text.trim()||result.text.length>2400)throw Error('Empty or oversized command response.');
   const value=this.editor.value,selection={start:this.editor.selectionStart,end:this.editor.selectionEnd,direction:this.editor.selectionDirection},delta=result.text.length-(command.end-command.start),scrollTop=this.editor.scrollTop,scrollLeft=this.editor.scrollLeft;
   const expected=value.slice(0,command.start)+result.text+value.slice(command.end);this.applying=true;
   try{
    this.editor.setSelectionRange(command.start,command.end);
    const applied=this.editor.insertText(result.text,true);
    if(applied&&this.editor.value===expected){this.editor.setSelectionRange(selection.start+delta,selection.end+delta,selection.direction);this.options.status(`Inserted · ${result.model||'AI'}${result.totalMs!==undefined?' · '+Math.round(result.totalMs)+' ms':''} · Undo restores command`);}
    else if(this.editor.value===value){this.editor.setSelectionRange(selection.start,selection.end,selection.direction);this.options.status('Editor rejected insertion. Command kept.');}
    else this.options.status('Host editor changed the insertion; result not confirmed.');
   }finally{this.applying=false;this.editor.scrollTop=scrollTop;this.editor.scrollLeft=scrollLeft;}
  }).catch(error=>{if(!state.abort.signal.aborted&&state.epoch===this.epoch)this.options.status(String(error.message||error)+' Command kept.');}).finally(()=>{if(this.pending===state)this.pending=undefined;});
 }
}
export function commandTransport(send:(message:any)=>Promise<any>){
 return async(command:InlineCommand,signal:AbortSignal):Promise<CommandReply>=>{
  const requestId=crypto.randomUUID();const cancel=()=>void send({kind:'cancel',requestId}).catch(()=>{});signal.addEventListener('abort',cancel,{once:true});
  try{const response=await send({kind:'command',requestId,instruction:command.instruction,mode:command.mode,before:command.before,after:command.after});if(response.error)throw Error(response.error==='Not found'?'Restart the updated bridge to enable inline commands.':response.error);if(response.commandStrategy!=='inline-commands-v1')throw Error('Restart the updated Brii bridge for inline commands.');return response;}finally{signal.removeEventListener('abort',cancel);}
 };
}
