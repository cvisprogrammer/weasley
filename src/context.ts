export const CONTEXT_LIMIT = 1200;
export function normalizeContext(text: string) { return text.replace(/\s+/g, ' ').trim().slice(0, CONTEXT_LIMIT); }
const excluded='input,textarea,select,option,button,label,[contenteditable]:not([contenteditable="false"]),[data-private],[data-weasley-ui],script,style,noscript,nav,header,footer,aside,[role="navigation"],[role="menu"],[aria-hidden="true"],[hidden]';
const stopwords=new Set('a an the and or but to of in on at for is are was were be this that it i we you our your with from have has will can'.split(' '));
const terms=(text:string)=>new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(w=>!stopwords.has(w)));
// Bounded DOM work after a typing pause; never read other form values or fetch other pages.
export function harvestContext(field:HTMLElement,draft:string):string {
 const roots:Node[]=[];
 let anchor:Element|null=field;
 for(let depth=0;anchor&&depth<3;depth++,anchor=anchor.parentElement){
  let sibling=anchor.previousElementSibling;
  for(let n=0;sibling&&n<3;n++,sibling=sibling.previousElementSibling)roots.push(sibling);
 }
 const semantic=field.closest('article,main,[role="main"]')||document.querySelector('main,[role="main"],article');
 if(field.parentElement)roots.push(field.parentElement);
 if(semantic)roots.push(semantic);
 if(document.body)roots.push(document.body);
 const visited=new Set<Node>(),groups=new Map<Element,{text:string;score:number;order:number}>();
 const query=terms(draft.slice(-500)),deadline=performance.now()+10;let scanned=0;
 function visit(node:Node){
  if(visited.has(node))return;visited.add(node);
  const parent=node.parentElement;if(!parent||parent.closest(excluded))return;
  if(!parent.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return;
  const text=(node.textContent||'').slice(0,600).replace(/\s+/g,' ').trim();if(text.length<8)return;
  const block=parent.closest('p,li,blockquote,h1,h2,h3,div,section,article')||parent;
  if(!block.getClientRects().length)return;
  const style=getComputedStyle(block);if(style.visibility==='hidden'||style.display==='none')return;
  const existing=groups.get(block);if(existing){existing.text=(existing.text+' '+text).slice(0,600);return;}
  const overlap=[...terms(text)].filter(w=>query.has(w)).length;
  const preceding=!!(block.compareDocumentPosition(field)&Node.DOCUMENT_POSITION_FOLLOWING);
  const close=field.parentElement?.contains(block)?4:0;
  groups.set(block,{text:text.slice(0,600),score:overlap*3+(preceding?3:0)+close,order:groups.size});
 }
 outer:for(const root of roots){
  if(root instanceof Element&&root.closest(excluded))continue;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode())){if(++scanned>1000||performance.now()>deadline)break outer;visit(node);}
 }
 const seen=new Set<string>();
 const ranked=[...groups.values()].sort((a,b)=>b.score-a.score||a.order-b.order).filter(x=>{if(seen.has(x.text))return false;seen.add(x.text);return true;});
 return normalizeContext(ranked.slice(0,6).map(x=>x.text).join(' '));
}
