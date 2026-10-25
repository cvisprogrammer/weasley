import {settings} from './shared';
import {GmailClient,configuredManifest,gmailLink} from './mail/gmail';
import {prepareThread,addresses,canonicalEmail} from './mail/parse';
import {deterministicDecision} from './mail/classify';
import {samples,sampleAccount} from './mail/samples';
import {MAIL_ORIGINS,type MailRow,type Decision} from './mail/types';
const $=(id:string)=>document.getElementById(id)!;
const button=(id:string)=>$(id) as HTMLButtonElement;
const field=(id:string)=>$(id) as HTMLInputElement;
const manifest=chrome.runtime.getManifest();
const client=new GmailClient();let account='',mode:'gmail'|'sample'|undefined,rows:MailRow[]=[],running=false,generation=0,abort:AbortController|undefined,dismissed=new Set<string>();
const mail=(kind:string,data:object={})=>chrome.runtime.sendMessage({target:'mail',kind,...data}).catch(()=>({error:'Extension connection lost. Reopen the reply inbox.'}));
const status=(value:string)=>$('status').textContent=value;
const validClient=!!manifest.oauth2?.client_id;
$('setup').hidden=validClient;$('extensionId').textContent=chrome.runtime.id;button('connect').disabled=!validClient;
const config=await settings();field('model').value=config.model;
field('model').onchange=async()=>{const s=await settings();s.model=field('model').value;await chrome.storage.local.set({settings:s});};
$('configure').onclick=()=>{try{const value=configuredManifest(manifest,field('clientId').value);const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='manifest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('setupStatus').textContent='Replace manifest.json in the same extension folder, reload the extension, then reopen this page. The OAuth client ID is public; there is no secret in this file.';}catch(e){$('setupStatus').textContent=String(e);}};
async function modelStatus(){try{const state=await mail('status');$('modelStatus').textContent=state.text||state.error||'Model not loaded';}catch{$('modelStatus').textContent='Extension connection lost; reopen this page.';}}
$('loadModel').onclick=async()=>{button('loadModel').disabled=true;try{const response=await mail('load');if(response.error)throw Error(response.error);status('Local model ready.');}catch(e){status(String(e));}finally{button('loadModel').disabled=false;await modelStatus();}};
$('resetModel').onclick=async()=>{stop();await mail('resetEngine');await modelStatus();};
function controls(){button('scan').textContent=mode==='sample'?'Analyze sample inbox':'Scan Primary inbox';button('scan').disabled=running||!mode;button('connect').disabled=running||!validClient;button('sample').disabled=running;button('stop').hidden=!running;button('disconnect').disabled=!mode&&!validClient;field('model').disabled=running;}
async function fingerprint(row:Pick<MailRow,'threadId'|'messageId'>){const data=new TextEncoder().encode(account+'\0'+row.threadId+'\0'+row.messageId);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function publish(){if(mode==='gmail'){const response=await mail('publishBadges',{account,entries:rows.filter(r=>r.verdict==='reply_needed').map(r=>({threadId:r.threadId,messageId:r.messageId,evidence:r.evidence,checkedAt:r.checkedAt}))});if(response.error)status(response.error);}}
function card(row:MailRow){
 const item=document.createElement('article');item.className='card';
 const tag=document.createElement('span');tag.className='tag'+(row.verdict==='uncertain'?' review':'');tag.textContent=row.verdict==='reply_needed'?'NEEDS YOUR REPLY':row.verdict==='uncertain'?'REVIEW':'NO REPLY FLAG';
 const title=document.createElement('h3');title.textContent=row.subject||'(No subject)';const from=document.createElement('p');from.className='muted';from.textContent=row.from||'Sender unavailable';item.append(tag,title,from);
 if(row.evidence){const quote=document.createElement('blockquote');quote.textContent=row.evidence;item.append(quote);}
 const explanation=document.createElement('p');explanation.textContent=row.reason;item.append(explanation);
 const links=document.createElement('div');links.className='links';
 if(!row.sample){const link=document.createElement('a');link.href=gmailLink(account,row.threadId);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open in Gmail';links.append(link);}
 if(row.verdict==='reply_needed'){const dismiss=document.createElement('button');dismiss.className='quiet';dismiss.textContent='Not needed';dismiss.onclick=async()=>{const key=await fingerprint(row);dismissed.add(key);if(mode==='gmail')await chrome.storage.local.set({mailDismissed:[...dismissed].slice(-500)});rows=rows.filter(r=>r!==row);render();await publish();};links.append(dismiss);}
 item.append(links);return item;
}
function render(){const flagged=rows.filter(r=>r.verdict==='reply_needed');const other=rows.filter(r=>r.verdict!=='reply_needed');$('results').replaceChildren(...flagged.map(card));if(!flagged.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=running?'Checking for unresolved requests…':'No requests flagged in this scan. Unchecked mail is still unknown.';$('results').append(empty);}
 $('otherResults').replaceChildren(...other.map(card));$('reviewSummary').textContent=`Review / other results (${other.length})`;$('summary').textContent=`${rows.length} checked · ${flagged.length} reply flags · ${rows.filter(r=>r.verdict==='uncertain').length} to review`;
}
$('connect').onclick=async()=>{button('connect').disabled=true;abort=new AbortController();const ticket=++generation;try{
 if(!await chrome.permissions.request({origins:MAIL_ORIGINS})){status('Network permissions were not granted. No Gmail connection was made.');return;}
 const profile=await client.connect(abort.signal);if(ticket!==generation)return;if(typeof profile.emailAddress!=='string'||!profile.emailAddress.includes('@'))throw Error('Google did not return a valid Gmail profile.');
 account=profile.emailAddress.toLowerCase();mode='gmail';rows=[];dismissed=new Set(((await chrome.storage.local.get('mailDismissed')).mailDismissed||[]) as string[]);$('account').textContent='Connected: '+account+' · read only';const badges=await mail('enableBadges');await publish();render();status(badges.error?'Connected. The reply inbox works, but Gmail badges could not be enabled.':'Connected. Click Scan Primary inbox to analyze up to 20 Primary inbox threads.');
 }catch(e){if(ticket===generation)status('Google sign-in failed. Check the client ID, extension ID, Gmail API and test user. '+String(e));}finally{controls();}};
$('sample').onclick=async()=>{mode='sample';account=sampleAccount;rows=[];dismissed.clear();$('account').textContent='SAMPLE INBOX — fictional messages, analyzed locally. Any existing Gmail connection is unchanged.';controls();await scan();};
function stop(){generation++;abort?.abort();void mail('cancel');status('Stopping. No more email will be fetched.');}
$('stop').onclick=()=>{stop();void publish();};
async function analyze(packet:ReturnType<typeof prepareThread>,signal:AbortSignal):Promise<Decision>{
 const rule=deterministicDecision(packet);if(rule)return rule;
 for(let attempt=0;attempt<60;attempt++){
  signal.throwIfAborted();let timer:ReturnType<typeof setTimeout>|undefined;let onAbort:()=>void=()=>{};
  const result=await Promise.race([mail('classifyMail',{packet}),new Promise<any>(resolve=>{timer=setTimeout(()=>resolve({error:'Local analysis timed out. Reset the model and try again.'}),45000);}),new Promise<any>(resolve=>{onAbort=()=>resolve({error:'Analysis cancelled.'});signal.addEventListener('abort',onAbort,{once:true});})]);clearTimeout(timer);signal.removeEventListener('abort',onAbort);signal.throwIfAborted();
  if(result.busy){await new Promise(resolve=>setTimeout(resolve,250));continue;}
  if(result.error)throw Error(result.error);if(!result.decision)throw Error('No local analysis result was returned.');return result.decision;
 }throw Error('The local model is busy. Stop typing in other tabs and try again.');
}
async function scan(){if(running||!mode)return;const currentMode=mode,ticket=++generation;const state=await mail('status');if(ticket!==generation)return;if(!state.ready){status(state.error||'Load the local model before scanning.');return;}const s=await settings();if(state.model!==s.model){status('Load the selected model before scanning.');return;}
 running=true;abort=new AbortController();const signal=abort.signal;rows=[];render();controls();try{
 const ids=currentMode==='sample'?samples.map(t=>t.id):await client.list(signal);let done=0;
 const self=[canonicalEmail(account),...addresses(field('aliases').value)].slice(0,6);
 for(const id of ids){signal.throwIfAborted();if(ticket!==generation)break;status(`Checking ${++done} of ${ids.length} on this device…`);
  const thread=currentMode==='sample'?samples.find(t=>t.id===id)!:await client.thread(id,signal);signal.throwIfAborted();const packet=prepareThread(thread,self);
  const row:MailRow={threadId:id,messageId:packet.latest.id,subject:packet.latest.subject,from:packet.latest.from,checkedAt:Date.now(),sample:currentMode==='sample',verdict:'uncertain',evidence:'',reason:''};
  if(dismissed.has(await fingerprint(row)))continue;
  const decision=await analyze(packet,signal);if(ticket!==generation)break;Object.assign(row,decision);rows.push(row);render();if(done%5===0)await publish();
 }
 if(ticket===generation){await publish();const count=rows.filter(r=>r.verdict==='reply_needed').length;status(`Scan complete. ${count} ${count===1?'request':'requests'} flagged. No Gmail messages or labels were changed.`);}
 }catch(e){if(ticket===generation)status('Scan stopped: '+String(e));}
 finally{if(currentMode==='gmail'&&mode==='gmail'&&ticket===generation)await publish();running=false;controls();render();}}
$('scan').onclick=()=>void scan();
$('disconnect').onclick=async()=>{stop();rows=[];mode=undefined;account='';field('aliases').value='';dismissed.clear();render();controls();$('account').textContent='Disconnected. Local inbox results cleared.';const cleared=await mail('clearMail');let revoked=false;try{revoked=await client.disconnect();}catch{}status(cleared.error?'Visible results cleared, but saved badge cleanup could not be confirmed. Reload the extension and disconnect again.':revoked?'Disconnected, Google access revoked, and local mail data cleared.':'Local mail data and tokens cleared. Check Google account connections to revoke access if needed.');await modelStatus();};
$('clearDismissed').onclick=async()=>{dismissed.clear();await chrome.storage.local.remove('mailDismissed');status('Dismissed flags reset. Scan again to recheck.');};
window.addEventListener('pagehide',()=>{abort?.abort();void mail('cancel');});
void modelStatus();setInterval(()=>void modelStatus(),1500);
