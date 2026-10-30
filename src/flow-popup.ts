import {cloudSettings,type CloudSettings} from './brii/cloud';import {matchPattern} from './shared';import {extensionTransport} from './brii/cloud-client';
const $=(id:string)=>document.getElementById(id)!;const input=(id:string)=>$(id) as HTMLInputElement;let s:CloudSettings=await cloudSettings();
input('enabled').checked=s.enabled;input('automatic').checked=s.automatic;input('delay').value=String(s.delay);
const save=async()=>{await chrome.storage.local.set({briiCloud:s});};
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
for(const key of ['enabled','automatic'] as const)input(key).onchange=async()=>{s[key]=input(key).checked;await save();if(key==='enabled'&&s.enabled)await injectActive();};
input('delay').onchange=async()=>{s.delay=Math.max(0,Math.min(1000,Number(input('delay').value)||0));await save();};
function render(){ $('sites').replaceChildren();for(const origin of s.sites){const li=document.createElement('li');li.textContent=origin+' ';const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=async()=>{s.sites=s.sites.filter(x=>x!==origin);await save();if(!s.sites.some(x=>matchPattern(x)===matchPattern(origin)))await chrome.permissions.remove({origins:[matchPattern(origin)]});render();};li.append(remove);$('sites').append(li);}}
render();$('allow').onclick=async()=>{try{const {tab,url}=await activeWebsite();if(await chrome.permissions.request({origins:[matchPattern(url.origin)]})){s.sites=[...new Set([...s.sites,url.origin])];await save();if(tab.id&&s.enabled)await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:['flow-content.js']});render();$('status').textContent=s.enabled?'Website allowed. Type in an ordinary text field.':'Website allowed. Enable cloud corrections when ready.';}}catch(e){$('status').textContent=String(e);}};
$('try').onclick=()=>void chrome.tabs.create({url:chrome.runtime.getURL('cloud-playground.html')});
async function health(){try{const h=await extensionTransport({kind:'health'});$('status').textContent=h.error||(h.strategy!=='raw-only-baseline'?'Bridge is outdated. Stop it with Ctrl+C and restart npm run cloud.':!h.enabled?'Bridge is running; set OPENAI_API_KEY and restart it.':`Bridge ready · ${h.model} · cloud corrections ${s.enabled?'enabled':'off'}`);}catch{$('status').textContent='Bridge not running. Start npm run cloud in your terminal.';}}
void health();
