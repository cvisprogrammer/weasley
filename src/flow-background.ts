import {validPageDomain} from './brii/page-domain';
import {BRIDGE,cloudSettings,cloudFrameAllowed} from './brii/cloud';import {matchPattern} from './shared';
const pending=new Map<string,AbortController>();let registering=Promise.resolve();
async function register(){await chrome.scripting.unregisterContentScripts();const s=await cloudSettings(),matches:string[]=[];if(s.enabled)for(const origin of s.sites)if(await chrome.permissions.contains({origins:[matchPattern(origin)]}))matches.push(matchPattern(origin));if(matches.length)await chrome.scripting.registerContentScripts([{id:'brii-flow',matches:[...new Set(matches)],js:['flow-content.js'],runAt:'document_idle',allFrames:true,matchOriginAsFallback:true,persistAcrossSessions:true}]);}
const queue=()=>{registering=registering.catch(()=>{}).then(register);return registering;};chrome.runtime.onInstalled.addListener(()=>void queue());chrome.runtime.onStartup.addListener(()=>void queue());
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.briiCloud){for(const request of pending.values())request.abort();pending.clear();void queue();}});
// The native permission prompt can destroy the popup. Keep the handoff in session
// storage and finish it from permissions.onAdded, independently of popup lifetime.
const pendingSiteKey='briiPendingSite';let siteWork=Promise.resolve();
function siteTask<T>(task:()=>Promise<T>):Promise<T>{const result=siteWork.then(task,task);siteWork=result.then(()=>{},()=>{});return result;}
async function finishSite(origin?:string,tabId?:number,grantedOrigins?:string[]){
 const record=(await chrome.storage.session.get(pendingSiteKey))[pendingSiteKey] as {origin:string;tabId:number;at:number}|undefined;
 const pending=record&&Date.now()-record.at<10*60*1000?record:undefined;
 if(!origin&&(!pending||!grantedOrigins?.includes(matchPattern(pending.origin))))return {saved:false};
 const site=origin||pending?.origin,id=tabId??pending?.tabId;
 if(!site||id===undefined)return {saved:false};
 if(!await chrome.permissions.contains({origins:[matchPattern(site)]}))return {saved:false};
 const settings=await cloudSettings();
 const staged=pending?.origin===site&&pending.tabId===id;
 if(!staged&&!settings.sites.includes(site))return {saved:false};
 if(staged){await chrome.storage.local.set({briiCloud:{...settings,sites:[...new Set([...settings.sites,site])]}});await chrome.storage.session.remove(pendingSiteKey);}
 // Persist first. An attachment failure must never lose the user's website grant.
 try{await queue();}catch{return {saved:true,enabled:settings.enabled,attached:false};}
 if(!settings.enabled)return {saved:true,enabled:false,attached:false};
 try{await chrome.scripting.executeScript({target:{tabId:id,allFrames:true},files:['flow-content.js']});return {saved:true,enabled:true,attached:true};}
 catch{return {saved:true,enabled:true,attached:false};}
}
chrome.permissions.onAdded?.addListener(permissions=>{void siteTask(()=>finishSite(undefined,undefined,permissions.origins||[])).catch(()=>console.warn('Brii could not finish saving website access. Reopen Brii to retry.'));});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id||m.target!=='briiCloud')return;
 void(async()=>{try{
  const popup=sender.url===chrome.runtime.getURL('flow-popup.html'),lab=['cloud-playground.html','inline-playground.html'].some(p=>sender.url===chrome.runtime.getURL(p)),s=await cloudSettings();
  if(['prepareSite','finishSite','cancelSite'].includes(m.kind)){
   if(!popup){reply({error:'Unauthorized'});return;}
   let url:URL;try{url=new URL(m.origin);}catch{reply({error:'Invalid website.'});return;}
   if(!['http:','https:'].includes(url.protocol)||url.origin!==m.origin||!Number.isInteger(m.tabId)||m.tabId<0){reply({error:'Invalid website.'});return;}
   reply(await siteTask(async()=>{
    if(m.kind==='prepareSite'){await chrome.storage.session.set({[pendingSiteKey]:{origin:m.origin,tabId:m.tabId,at:Date.now()}});return {ok:true};}
    if(m.kind==='cancelSite'){const record=(await chrome.storage.session.get(pendingSiteKey))[pendingSiteKey] as {origin?:string;tabId?:number}|undefined;if(record?.origin===m.origin&&record?.tabId===m.tabId)await chrome.storage.session.remove(pendingSiteKey);return {ok:true};}
    return finishSite(m.origin,m.tabId);
   }));return;
  }
  if(m.kind==='health'){if(!popup&&!lab){reply({error:'Unauthorized'});return;}const r=await fetch(BRIDGE+'/health',{headers:{'X-Brii-Extension':chrome.runtime.id},cache:'no-store',signal:AbortSignal.timeout(3000)});reply(await r.json());return;}
  if(!(lab?s.enabled:!!sender.tab&&cloudFrameAllowed(sender.url||'',sender.origin,s))){reply({error:'Enable cloud correction for this website first.'});return;}
  const owner=sender.documentId||String(sender.tab?.id||'lab'),id=typeof m.requestId==='string'?m.requestId.slice(0,100):'',key=owner+':'+id;
  if(m.kind==='cancel'){pending.get(key)?.abort();pending.delete(key);reply({ok:true});return;}
  const command=m.kind==='command';
  if(!id||(command?(typeof m.instruction!=='string'||!m.instruction.trim()||m.instruction.length>600||!['write','continue','rewrite-line'].includes(m.mode)||m.lineText!==undefined&&(typeof m.lineText!=='string'||m.lineText.length>1600)||m.mode==='rewrite-line'&&(typeof m.lineText!=='string'||!m.lineText.trim())||typeof m.before!=='string'||m.before.length>1200||typeof m.after!=='string'||m.after.length>400||m.pageDomain!==undefined&&!validPageDomain(m.pageDomain)||m.emailContext!==undefined&&(typeof m.emailContext!=='string'||m.emailContext.length>8000)||m.pageContext!==undefined&&(typeof m.pageContext!=='string'||m.pageContext.length>8000)||(m.emailContext||'').length+(m.pageContext||'').length>8000):(m.kind!=='decode'||typeof m.text!=='string'||!m.text.trim()||m.text.length>600||typeof m.current!=='string'||!m.current.trim()||m.current.length>600||typeof m.context!=='string'||m.context.length>400))){reply({error:'Invalid request.'});return;}
  const abort=new AbortController();pending.set(key,abort);
  try{const r=await fetch(BRIDGE+(command?'/command':'/correct'),{method:'POST',headers:{'Content-Type':'application/json','X-Brii-Extension':chrome.runtime.id},body:JSON.stringify(command?{instruction:m.instruction,mode:m.mode,lineText:m.lineText||'',before:m.before,after:m.after,...(m.emailContext?{emailContext:m.emailContext}:{}),...(m.pageContext?{pageContext:m.pageContext}:{}),...(m.pageDomain?{pageDomain:m.pageDomain}:{})}:{text:m.text,context:m.context,current:m.current}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(50000)]),cache:'no-store',redirect:'error'});const data=await r.json();reply(r.ok?data:{error:data.error||'Cloud correction failed.'});}finally{pending.delete(key);}
 }catch{reply({error:'Cloud request cancelled or bridge unavailable. Start npm run cloud; original text is preserved.'});}})();return true;
});
