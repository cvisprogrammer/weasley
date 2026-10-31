export function visible(element:HTMLElement){
 if(!element.isConnected||!element.getClientRects().length)return false;
 for(let node:HTMLElement|null=element;node;node=node.parentElement){
  if(node.matches('[hidden],[aria-hidden="true"],[data-private]'))return false;
  const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
 }
 return true;
}
export function renderedText(body:HTMLElement):string{
 const read=(node:Node):string=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(!(node instanceof HTMLElement)||!visible(node)||node.matches('script,style,template,input,textarea,button'))return '';
  if(node!==body&&node.matches('[contenteditable="true"]'))return '';
  if(node.tagName==='BR')return '\n';
  const text=Array.from(node.childNodes,read).join('');
  return getComputedStyle(node).display==='inline'?text:text+'\n';
 };
 return read(body).replace(/\n{3,}/g,'\n\n').trim();
}
