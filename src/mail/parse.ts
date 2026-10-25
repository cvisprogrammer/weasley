import {Parser} from 'htmlparser2';
import type {MimePart,GmailThread,MailPacket} from './types';
import {canonicalEmail,addresses,normalize} from './identity';
export {canonicalEmail,addresses,normalize} from './identity';
export function header(part:MimePart|undefined,name:string){return part?.headers?.find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||'';}
export function decodeBody(value:string,charset='utf-8'){if(value.length>400000)throw Error('Body exceeds local parsing limit');const data=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return new TextDecoder(charset,{fatal:true}).decode(Uint8Array.from(data,c=>c.charCodeAt(0)));}
// Pure text parser: never instantiate DOM email elements or load images/links.
export function htmlText(html:string){
 const text:string[]=[];let skipped=0;const stack:boolean[]=[];
 const parser=new Parser({onopentag(name,attrs){const exclude=skipped>0||['script','style','head','noscript','svg','math','iframe','object','embed','template','blockquote'].includes(name)||attrs.hidden!==undefined||attrs['aria-hidden']==='true'||/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)/i.test(attrs.style||'')||/gmail_quote|yahoo_quoted|moz-cite-prefix/.test(attrs.class||'');stack.push(exclude);if(exclude)skipped++;if(!skipped&&['br','p','div','li','tr'].includes(name))text.push('\n');},ontext(value){if(!skipped)text.push(value);},onclosetag(){if(stack.pop())skipped--;},},{decodeEntities:true});
 parser.write(html.slice(0,200000));parser.end();return text.join('');
}
export function freshText(text:string){const result:string[]=[];for(const line of text.replace(/\r/g,'').split('\n')){if(/^On .{0,220}wrote:\s*$/i.test(line.trim())||/^-{2,}\s*(Original Message|Forwarded message)/i.test(line.trim()))break;if(!/^\s*>/.test(line))result.push(line);}return normalize(result.join('\n'));}
function partText(part:MimePart,depth=0):string {
 if(depth>12||part.filename||part.body?.attachmentId)return '';
 const charset=header(part,'Content-Type').match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]||'utf-8';
 if(part.mimeType==='text/plain'&&part.body?.data)return decodeBody(part.body.data,charset);
 if(part.mimeType==='text/html'&&part.body?.data)return htmlText(decodeBody(part.body.data,charset));
 const children=part.parts||[];
 if(part.mimeType==='multipart/alternative'){const plain=children.find(p=>p.mimeType==='text/plain');if(plain)return partText(plain,depth+1);const html=children.find(p=>p.mimeType==='text/html');if(html)return partText(html,depth+1);}
 return children.slice(0,30).map(p=>partText(p,depth+1)).filter(Boolean).join('\n');
}
export function prepareThread(thread:GmailThread,self:string[]):MailPacket {
 const messages=(thread.messages||[]).filter(m=>!m.labelIds?.includes('DRAFT')).sort((a,b)=>Number(a.internalDate||0)-Number(b.internalDate||0));
 const latest=messages.at(-1);if(!latest)throw Error('Thread has no readable messages');
 let incomplete=false,historyIncomplete=false;
 const body=(p:MimePart|undefined,limit:number,latest=false)=>{try{const text=freshText(p?partText(p):'');if(text.length>limit){if(latest)incomplete=true;else historyIncomplete=true;}return text.slice(0,limit);}catch{if(latest)incomplete=true;else historyIncomplete=true;return '';}};
 // Old context is deliberately short. The latest body is the only source allowed for evidence.
 const history=messages.slice(-4,-1).map(m=>({from:header(m.payload,'From').slice(0,180),body:body(m.payload,450)}));
 const latestBody=body(latest.payload,2400,true);
 if(!latestBody)incomplete=true;
 return {self:self.map(canonicalEmail),latest:{id:latest.id,from:header(latest.payload,'From').slice(0,180),to:header(latest.payload,'To').slice(0,300),cc:header(latest.payload,'Cc').slice(0,200),subject:header(latest.payload,'Subject').slice(0,240),body:latestBody},history,incomplete,historyIncomplete};
}
export function lastFromSelf(packet:MailPacket){return addresses(packet.latest.from).some(email=>packet.self.includes(email));}
