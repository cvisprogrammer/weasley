import type {Selection as TextSelection} from './decoding';

export interface EditorSurface {
 readonly value:string;
 readonly selectionStart:number;
 readonly selectionEnd:number;
 readonly selectionDirection:TextSelection['direction'];
 scrollTop:number;scrollLeft:number;
 addEventListener(type:string,listener:(event:any)=>void):void;
 focus(options?:FocusOptions):void;
 isFocused():boolean;
 setSelectionRange(start:number,end:number,direction?:TextSelection['direction']):void;
 canReplace(start:number,end:number):boolean;
 isAppend(previous:string,next:string,start:number,end:number):boolean;
 atBoundary(position:number):boolean;
 insertText(text:string):boolean;
}
export class PlainEditor implements EditorSurface {
 constructor(readonly element:HTMLTextAreaElement|HTMLInputElement){}
 get value(){return this.element.value;}
 get selectionStart(){return this.element.selectionStart??0;}
 get selectionEnd(){return this.element.selectionEnd??0;}
 get selectionDirection(){return this.element.selectionDirection??'none';}
 get scrollTop(){return this.element.scrollTop;}set scrollTop(value:number){this.element.scrollTop=value;}
 get scrollLeft(){return this.element.scrollLeft;}set scrollLeft(value:number){this.element.scrollLeft=value;}
 addEventListener(type:string,listener:(event:any)=>void){this.element.addEventListener(type,listener);}
 focus(options?:FocusOptions){this.element.focus(options);}
 isFocused(){return document.activeElement===this.element;}
 setSelectionRange(start:number,end:number,direction:TextSelection['direction']='none'){this.element.setSelectionRange(start,end,direction);}
 canReplace(){return true;}
 isAppend(previous:string,next:string,start:number,end:number){return start===previous.length&&end===previous.length&&next.startsWith(previous);}
 atBoundary(position:number){return position===this.value.length;}
 insertText(text:string){return document.execCommand('insertText',false,text);}
}

interface Point {node:Node;offset:number;}
interface Unit {start:number;end:number;before:Point;after:Point;text:boolean;}
interface Bounds {start:number;end:number;}
const blocks=new Set(['P','DIV','LI','UL','OL','BLOCKQUOTE','PRE','H1','H2','H3','H4','H5','H6']);
// A plain-text view with explicit paragraph/BR boundaries and reversible DOM points.
class RichSnapshot {
 value='';units:Unit[]=[];bounds=new Map<Node,Bounds>();
 constructor(readonly root:HTMLElement){
  const emit=(value:string,before:Point,after:Point,text=false)=>{const start=this.value.length;this.value+=value;this.units.push({start,end:this.value.length,before,after,text});};
  const walk=(node:Node)=>{
   const index=node.parentNode?Array.prototype.indexOf.call(node.parentNode.childNodes,node):0;
   const before={node:node.parentNode!,offset:index},after={node:node.parentNode!,offset:index+1};
   if(node instanceof Text){const start=this.value.length;emit(node.data.replace(/\u00a0/g,' '),{node,offset:0},{node,offset:node.length},true);this.bounds.set(node,{start,end:this.value.length});return;}
   if(!(node instanceof HTMLElement))return;
   const block=node!==root&&blocks.has(node.tagName);
   if(block&&this.value&&!this.value.endsWith('\n'))emit('\n',before,before);
   const start=this.value.length;
   if(node!==root&&(node.contentEditable==='false'||node.matches('[data-private], [aria-readonly="true"], [hidden], [aria-hidden="true"]')||['IMG','HR','INPUT','TEXTAREA','BUTTON','IFRAME','SCRIPT','STYLE','TEMPLATE'].includes(node.tagName)))emit('\ufffc',before,after);
   else if(node.tagName==='BR'){
    // Chrome keeps a terminal BR as a caret placeholder, including in empty paragraphs.
    if(node.nextSibling)emit('\n',before,after);
   }
   else for(const child of node.childNodes)walk(child);
   this.bounds.set(node,{start,end:this.value.length});
   if(block&&(!this.value.endsWith('\n')||this.value.length===start))emit('\n',after,after);
  };
  walk(root);
  // Block separators are virtual; the last paragraph has no trailing typed newline.
  while(this.units.length){const last=this.units.at(-1)!;if(last.text||last.before.node!==last.after.node||last.before.offset!==last.after.offset)break;this.value=this.value.slice(0,last.start);this.units.pop();}
 }
 index(node:Node|null,offset:number):number|undefined {
  if(!node||!this.root.contains(node))return;
  const bound=this.bounds.get(node);if(!bound)return;
  if(node instanceof Text)return Math.min(this.value.length,bound.start+Math.min(offset,node.length));
  if(offset<node.childNodes.length){const next=this.bounds.get(node.childNodes[offset]);if(next)return Math.min(this.value.length,next.start);}
  return Math.min(this.value.length,bound.end);
 }
 point(index:number,end=false):Point|undefined {
  if(index<0||index>this.value.length)return;
  // Prefer the next text run for a start, the previous one for an end.
  const list=end?[...this.units].reverse():this.units;
  for(const unit of list)if(unit.text&&index>=unit.start&&index<=unit.end)return {node:unit.before.node,offset:index-unit.start};
  for(const unit of list)if(index>=unit.start&&index<=unit.end)return end?unit.after:unit.before;
  if(!this.value)return {node:this.root,offset:0};
 }
 range(start:number,end:number){const a=this.point(start),b=this.point(end,true);if(!a||!b)return;const range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);return range;}
}

const inlineTags=new Set(['B','STRONG','I','EM','U','S','STRIKE','DEL','SPAN','A','CODE','SUB','SUP','MARK','SMALL']);
const styleProperties=['font-weight','font-style','text-decoration','text-decoration-line','color','background-color','font-family','font-size','vertical-align','white-space'];
function safeFragment(fragment:DocumentFragment):boolean {
 for(const element of fragment.querySelectorAll('*')){
  if(!(element instanceof HTMLElement)||!inlineTags.has(element.tagName)||element.contentEditable==='false')return false;
  // Reinsert only formatting/link attributes, never event handlers or editor internals.
  const styles=styleProperties.map(p=>[p,element.style.getPropertyValue(p)]).filter(([,v])=>v&&!/url\s*\(|expression\s*\(/i.test(v));
  const href=element.tagName==='A'?element.getAttribute('href'):null,title=element.getAttribute('title'),className=element.getAttribute('class'),direction=element.getAttribute('dir'),language=element.getAttribute('lang');
  for(const attr of [...element.attributes])element.removeAttribute(attr.name);
  for(const [name,value] of styles)element.style.setProperty(name,value);
  if(href){try{const url=new URL(href,document.baseURI);if(!['https:','http:','mailto:','tel:'].includes(url.protocol))return false;element.setAttribute('href',href);}catch{return false;}}
  if(title)element.setAttribute('title',title);
  if(className)element.setAttribute('class',className);
  if(direction&&['ltr','rtl','auto'].includes(direction))element.setAttribute('dir',direction);
  if(language)element.setAttribute('lang',language);
 }
 return true;
}
// Map source boundaries onto corrected text using minimal character edits.
function correctedBoundaries(source:string,target:string){
 const width=target.length+1,table=new Uint16Array((source.length+1)*width);
 for(let i=0;i<=source.length;i++)table[i*width]=i;for(let j=0;j<=target.length;j++)table[j]=j;
 for(let i=1;i<=source.length;i++)for(let j=1;j<=target.length;j++)table[i*width+j]=Math.min(table[(i-1)*width+j]+1,table[i*width+j-1]+1,table[(i-1)*width+j-1]+(source[i-1]===target[j-1]?0:1));
 const boundaries=new Array<number>(source.length+1);let i=source.length,j=target.length;boundaries[i]=j;
 while(i||j){const cost=table[i*width+j];if(i&&j&&cost===table[(i-1)*width+j-1]+(source[i-1]===target[j-1]?0:1)){i--;j--;boundaries[i]=j;}else if(j&&cost===table[i*width+j-1]+1){j--;boundaries[i]=j;}else{i--;boundaries[i]=j;}}
 boundaries[0]=0;boundaries[source.length]=target.length;return boundaries;
}

export class RichEditor implements EditorSurface {
 constructor(readonly element:HTMLElement){}
 private snapshot(){return new RichSnapshot(this.element);}
 get value(){return this.snapshot().value;}
 private selection(){const snapshot=this.snapshot(),selection=document.getSelection();const anchor=snapshot.index(selection?.anchorNode??null,selection?.anchorOffset??0),focus=snapshot.index(selection?.focusNode??null,selection?.focusOffset??0);return anchor===undefined||focus===undefined?undefined:{start:Math.min(anchor,focus),end:Math.max(anchor,focus),direction:anchor>focus?'backward' as const:anchor===focus?'none' as const:'forward' as const};}
 get selectionStart(){return this.selection()?.start??-1;}
 get selectionEnd(){return this.selection()?.end??-1;}
 get selectionDirection(){return this.selection()?.direction??'none';}
 get scrollTop(){return this.element.scrollTop;}set scrollTop(value:number){this.element.scrollTop=value;}
 get scrollLeft(){return this.element.scrollLeft;}set scrollLeft(value:number){this.element.scrollLeft=value;}
 addEventListener(type:string,listener:(event:any)=>void){this.element.addEventListener(type,listener);}
 focus(options?:FocusOptions){this.element.focus(options);}
 isFocused(){return document.activeElement===this.element&&!!this.selection();}
 setSelectionRange(start:number,end:number,direction:TextSelection['direction']='none'){
  const snapshot=this.snapshot(),a=snapshot.point(start),b=snapshot.point(end,true),selection=document.getSelection();if(!a||!b||!selection)throw Error('Editor selection changed; correction cancelled.');
  if(direction==='backward')selection.setBaseAndExtent(b.node,b.offset,a.node,a.offset);else selection.setBaseAndExtent(a.node,a.offset,b.node,b.offset);
 }
 isAppend(previous:string,next:string,start:number,end:number){
  return start===end&&(start===previous.length||previous[start]==='\n')&&next.length>=previous.length&&next.startsWith(previous.slice(0,start))&&next.endsWith(previous.slice(start));
 }
 atBoundary(position:number){const value=this.value;return position===value.length||value[position]==='\n';}
 canReplace(start:number,end:number){const snapshot=this.snapshot();if(/[\n\ufffc]/.test(snapshot.value.slice(start,end)))return false;const range=snapshot.range(start,end);return !!range&&safeFragment(range.cloneContents());}
 insertText(text:string){
  if(/[\r\n]/.test(text))return false;
  const selected=this.selection();if(!selected||!this.canReplace(selected.start,selected.end))return false;
  const range=this.snapshot().range(selected.start,selected.end)!;const fragment=range.cloneContents();if(!safeFragment(fragment))return false;
  if(!fragment.querySelector('*'))return document.execCommand('insertText',false,text);
  const walker=document.createTreeWalker(fragment,NodeFilter.SHOW_TEXT),nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
  const source=nodes.map(n=>n.data.replace(/\u00a0/g,' ')).join(''),boundaries=correctedBoundaries(source,text);let at=0;
  for(const node of nodes){const end=at+node.length;node.data=text.slice(boundaries[at],boundaries[end]);at=end;}
  const container=document.createElement('div');container.append(fragment);
  // One native edit preserves browser Undo and sends an input event to the host editor.
  return document.execCommand('insertHTML',false,container.innerHTML);
 }
}
