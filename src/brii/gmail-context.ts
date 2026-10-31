// Read rendered Gmail thread text only when an explicit inline command runs.
export const EMAIL_CONTEXT_LIMIT=8000;
function visible(element:HTMLElement){
 if(!element.isConnected||!element.getClientRects().length)return false;
 for(let node:HTMLElement|null=element;node;node=node.parentElement){
  if(node.matches('[hidden],[aria-hidden="true"],[data-private]'))return false;
  const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
 }
 return true;
}
function renderedText(body:HTMLElement):string{
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
export function gmailContext(editor:HTMLElement):string{
 if(location.origin!=='https://mail.google.com')return '';
 const main=editor.closest<HTMLElement>('[role="main"]');
 // Never fall back to the whole page: it may contain other drafts or inbox rows.
 const candidates=[...(main?.querySelectorAll<HTMLElement>('.a3s.aiL,.adn .a3s')||[]),...editor.querySelectorAll<HTMLElement>('.gmail_quote')];
 const eligible=candidates.filter((body,index)=>candidates.indexOf(body)===index&&visible(body)&&
  (!body.closest('[contenteditable="true"],textarea,input')||editor.contains(body)&&body.matches('.gmail_quote')));
 const bodies=eligible.filter(body=>!eligible.some(parent=>parent!==body&&parent.contains(body)));
 const messages=bodies.map(body=>renderedText(body)).filter(Boolean);
 if(!messages.length)return '';
 const subject=main?.querySelector<HTMLElement>('h2.hP'),heading=subject&&visible(subject)?subject.innerText.trim().slice(0,300):'';
 // Prefer the latest rendered messages when a long thread exceeds the budget.
 const prefix=heading?'Subject: '+heading+'\n\n':'';
 const text=messages.join('\n\n--- Email message ---\n\n');
 const budget=EMAIL_CONTEXT_LIMIT-prefix.length,omitted='[Earlier thread text omitted]\n';
 return prefix+(text.length>budget?omitted+text.slice(-(budget-omitted.length)):text);
}
