import {commandTriggers,selectedTrigger} from './brii/trigger';
import {cloudSettings,type CloudSettings} from './brii/cloud';import {matchPattern} from './shared';import {extensionTransport} from './brii/cloud-client';
const $=(id:string)=>document.getElementById(id)!;const input=(id:string)=>$(id) as HTMLInputElement;let s:CloudSettings=await cloudSettings();
input('enabled').checked=s.enabled;input('includePageContext').checked=s.includePageContext!==false;
const trigger=$('commandTrigger') as HTMLSelectElement;for(const marker of commandTriggers)trigger.add(new Option(marker===';;'?';; (recommended for Gmail)':marker,marker));trigger.value=selectedTrigger(s.commandTrigger);
function triggerHint(){const m=trigger.value;$('triggerHelp').textContent=`Type ${m}instruction${m}, or ${m}instruction then Enter. ${m}...${m} continues a sentence.`;}triggerHint();
const save=async(patch:Partial<CloudSettings>)=>{s={...await cloudSettings(),...patch};await chrome.storage.local.set({briiCloud:s});};
trigger.onchange=async()=>{triggerHint();await save({commandTrigger:selectedTrigger(trigger.value)});$('status').textContent=`Command trigger set to ${s.commandTrigger}. Applies to allowed pages immediately.`;};
input('includePageContext').onchange=async()=>{await save({includePageContext:input('includePageContext').checked});$('status').textContent=s.includePageContext?'Visible page/thread context enabled for commands.':'Page/thread context off. Commands use only your editor text.';};
async function activeWebsite(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const parse=(value?:string)=>{try{const url=new URL(value||'');return ['http:','https:'].includes(url.protocol)?url:undefined;}catch{return undefined;}};
 let url=parse(tab?.url)||parse(tab?.pendingUrl);
 // activeTab can permit injection even when Chrome omits the tab's URL metadata.
 if(!url&&tab?.id!==undefined)try{const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>location.href});url=parse(result?.result);}catch{}
 if(!url||tab?.id===undefined)throw Error('Cannot access this website. Open its page, then click the Brii toolbar icon and try Allow this website again. Chrome internal pages are not supported.');
 return {tab,url};
}
async function injectActive(){try{const {tab,url}=await activeWebsite();if(s.enabled&&s.sites.includes(url.origin))await chrome.scripting.executeScript({target:{tabId:tab.id!,allFrames:true},files:['flow-content.js']});}catch(e){$('status').textContent=String(e);}}
input('enabled').onchange=async()=>{await save({enabled:input('enabled').checked});if(s.enabled)await injectActive();};
function render(){ $('sites').replaceChildren();for(const origin of s.sites){const li=document.createElement('li');li.textContent=origin+' ';const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=async()=>{await save({sites:s.sites.filter(x=>x!==origin)});if(!s.sites.some(x=>matchPattern(x)===matchPattern(origin)))await chrome.permissions.remove({origins:[matchPattern(origin)]});render();websiteStatus();};li.append(remove);$('sites').append(li);}}
let prepared:{origin:string;tabId:number}|undefined;
function websiteStatus(){const current=prepared?.origin;$('websiteStatus').textContent=current?`${current} · ${s.sites.includes(current)?'allowed':'not allowed'} · commands ${s.enabled?'on':'off'}`:'Open a website to allow it.';}
async function prepareWebsite(){const {tab,url}=await activeWebsite();if(prepared?.origin!==url.origin||prepared.tabId!==tab.id){const response=await extensionTransport({kind:'prepareSite',origin:url.origin,tabId:tab.id});if(response.error)throw Error(response.error);prepared={origin:url.origin,tabId:tab.id!};}websiteStatus();return {tab,url};}
render();
// Stage the durable handoff before the user opens Chrome's native permission prompt.
const preparing=prepareWebsite().catch(()=>{websiteStatus();return undefined;});
$('allow').onclick=async()=>{
 const button=$('allow') as HTMLButtonElement;button.disabled=true;
 try{
  await preparing;const {tab,url}=await prepareWebsite();
  if(!await chrome.permissions.request({origins:[matchPattern(url.origin)]})){await extensionTransport({kind:'cancelSite',origin:url.origin,tabId:tab.id});$('status').textContent='Website permission was not granted.';return;}
  const result=await extensionTransport({kind:'finishSite',origin:url.origin,tabId:tab.id});if(result.error)throw Error(result.error);if(!result.saved)throw Error('Website access was not saved. Reopen Brii to retry.');
  s=await cloudSettings();render();websiteStatus();
  $('status').textContent=!s.enabled?'Website allowed. Enable cloud commands when ready.':result.attached===false?'Website allowed and saved. Refresh this tab to attach Brii.':`Website allowed. Type ${selectedTrigger(s.commandTrigger)}instruction${selectedTrigger(s.commandTrigger)} in a text field.`;
 }catch(e){$('status').textContent=String(e);}finally{button.disabled=false;}
};
chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.briiCloud)void cloudSettings().then(settings=>{s=settings;input('enabled').checked=s.enabled;input('includePageContext').checked=s.includePageContext!==false;trigger.value=selectedTrigger(s.commandTrigger);triggerHint();render();websiteStatus();});});
$('try').onclick=()=>void chrome.tabs.create({url:chrome.runtime.getURL('inline-playground.html')});
async function health(){try{const h=await extensionTransport({kind:'health'});$('status').textContent=h.error||(h.commandStrategy!=='inline-commands-v5'?'Bridge is outdated. Stop it with Ctrl+C and restart npm run cloud.':!h.enabled?'Bridge is running; set OPENAI_API_KEY and restart it.':`Bridge ready · ${h.model} · cloud commands ${s.enabled?'enabled':'off'}`);}catch{$('status').textContent='Bridge not running. Start npm run cloud in your terminal.';}}
void health();
