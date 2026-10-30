import {BRIDGE,cloudSettings,cloudAllowed} from './brii/cloud';import {matchPattern} from './shared';
const pending=new Map<string,AbortController>();let registering=Promise.resolve();
async function register(){await chrome.scripting.unregisterContentScripts();const s=await cloudSettings(),matches:string[]=[];if(s.enabled)for(const origin of s.sites)if(await chrome.permissions.contains({origins:[matchPattern(origin)]}))matches.push(matchPattern(origin));if(matches.length)await chrome.scripting.registerContentScripts([{id:'brii-flow',matches:[...new Set(matches)],js:['flow-content.js'],runAt:'document_idle',persistAcrossSessions:true}]);}
const queue=()=>{registering=registering.catch(()=>{}).then(register);return registering;};chrome.runtime.onInstalled.addListener(()=>void queue());chrome.runtime.onStartup.addListener(()=>void queue());
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.briiCloud){for(const request of pending.values())request.abort();pending.clear();void queue();}});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id||m.target!=='briiCloud')return;
 void(async()=>{try{
  const popup=sender.url===chrome.runtime.getURL('flow-popup.html'),lab=sender.url===chrome.runtime.getURL('cloud-playground.html'),s=await cloudSettings();
  if(m.kind==='health'){if(!popup&&!lab){reply({error:'Unauthorized'});return;}const r=await fetch(BRIDGE+'/health',{headers:{'X-Brii-Extension':chrome.runtime.id},cache:'no-store',signal:AbortSignal.timeout(3000)});reply(await r.json());return;}
  if(!(lab?s.enabled:!!sender.tab&&cloudAllowed(sender.url||'',s))){reply({error:'Enable cloud correction for this website first.'});return;}
  const owner=sender.documentId||String(sender.tab?.id||'lab'),id=typeof m.requestId==='string'?m.requestId.slice(0,100):'',key=owner+':'+id;
  if(m.kind==='cancel'){pending.get(key)?.abort();pending.delete(key);reply({ok:true});return;}
  if(m.kind!=='decode'||!id||typeof m.text!=='string'||!m.text.trim()||m.text.length>600||typeof m.context!=='string'||m.context.length>400){reply({error:'Invalid correction request.'});return;}
  const abort=new AbortController();pending.set(key,abort);
  try{const r=await fetch(BRIDGE+'/correct',{method:'POST',headers:{'Content-Type':'application/json','X-Brii-Extension':chrome.runtime.id},body:JSON.stringify({text:m.text,context:m.context}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(50000)]),cache:'no-store',redirect:'error'});const data=await r.json();reply(r.ok?data:{error:data.error||'Cloud correction failed.'});}finally{pending.delete(key);}
 }catch{reply({error:'Cloud request cancelled or bridge unavailable. Start npm run cloud; original text is preserved.'});}})();return true;
});
