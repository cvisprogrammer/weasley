export const CONTEXT_LIMIT = 1200;
export function normalizeContext(text: string) { return text.replace(/\s+/g, ' ').trim().slice(0, CONTEXT_LIMIT); }
// Only invoked by an explicit popup action, never while the user is typing.
export function selectedContext(): string {
 const selection=window.getSelection();
 if(!selection || selection.isCollapsed || selection.rangeCount!==1)return '';
 const range=selection.getRangeAt(0),root=range.commonAncestorContainer;
 const excluded='input,textarea,[contenteditable]:not([contenteditable="false"]),[data-private],script,style,noscript,nav,header,footer,aside,[aria-hidden="true"],[hidden]';
 const parts:string[]=[];
 function collect(node:Node){
  if(!range.intersectsNode(node))return;
  const parent=node.parentElement;
  if(!parent || parent.closest(excluded) || !parent.getClientRects().length)return;
  const style=getComputedStyle(parent);if(style.visibility==='hidden'||style.display==='none')return;
  const text=node.textContent||'';
  const from=node===range.startContainer?range.startOffset:0,to=node===range.endContainer?range.endOffset:text.length;
  parts.push(text.slice(from,to));
 }
 if(root.nodeType===Node.TEXT_NODE)collect(root);
 else{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode()))collect(node);}
 return normalizeContext(parts.join(' '));
}
