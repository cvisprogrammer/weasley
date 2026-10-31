import {visible,renderedText} from './context-text';
// Read rendered Gmail thread text only when an explicit inline command runs.
export const EMAIL_CONTEXT_LIMIT=8000;
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
