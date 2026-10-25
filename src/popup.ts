import { settings, matchPattern } from './shared';
const $=(id:string)=>document.getElementById(id)!;
const input=(id:string)=>$(id) as HTMLInputElement;
const s=await settings();const save=()=>chrome.storage.local.set({settings:s});
input('enabled').checked=s.enabled;
for(const k of ['model','delay','maxWords'] as const)input(k).value=String(s[k]);
input('enabled').onchange=()=>{s.enabled=input('enabled').checked;void save();};
input('model').onchange=()=>{s.model=input('model').value;void save();};
input('delay').onchange=()=>{s.delay=Math.max(100,Math.min(2000,Number(input('delay').value)||250));void save();};
function render(){ $('sites').replaceChildren();for(const origin of s.sites){const li=document.createElement('li');li.textContent=origin+' ';const b=document.createElement('button');b.textContent='Remove';b.onclick=async()=>{s.sites=s.sites.filter(x=>x!==origin);await save();if(!s.sites.some(x=>matchPattern(x)===matchPattern(origin)))await chrome.permissions.remove({origins:[matchPattern(origin)]});render();};li.append(b);$('sites').append(li);}}
render();
$('add').onclick=async()=>{try{const u=new URL(input('site').value);if(!['http:','https:'].includes(u.protocol))throw Error('Use http or https');const origin=u.origin;if(await chrome.permissions.request({origins:[matchPattern(origin)]})){s.sites=[...new Set([...s.sites,origin])];await save();render();}}catch(e){$('status').textContent=String(e);}};
const send=(kind:string)=>chrome.runtime.sendMessage({target:'background',kind});
$('resetEngine').onclick=async()=>{await send('resetEngine');await refresh();};
$('load').onclick=async()=>{const b=$('load') as HTMLButtonElement;b.disabled=true;try{const r=await send('load');$('status').textContent=r.error||'Ready';}catch(e){$('status').textContent=String(e);}finally{b.disabled=false;}};
async function refresh(){void pageContext('contextStatus');try{const state=await send('status');$('status').textContent=state.text||state.error;const metrics=((await chrome.storage.local.get('metrics')).metrics || []) as any[];const shown=metrics.filter((x:any)=>x.kind==='shown'),accepted=metrics.filter((x:any)=>x.kind==='accepted'),rejected=metrics.filter((x:any)=>x.kind==='rejected');const avg=(k:string)=>shown.length?Math.round(shown.reduce((a:number,x:any)=>a+x[k],0)/shown.length):0;
$('stats').textContent=`Last 500 events\nShown: ${shown.length} · Accepted: ${accepted.length}\nAcceptance: ${shown.length?(100*accepted.length/shown.length).toFixed(1):0}%\nRejected: ${rejected.length}\nMean TTFT: ${avg('ttft')} ms\nMean completion: ${avg('total')} ms\nMean length: ${avg('chars')} chars\nAccepted characters: ${accepted.reduce((a:number,x:any)=>a+x.chars,0)}\nEstimated net keys saved: ${accepted.reduce((a:number,x:any)=>a+Math.max(0,x.chars-(x.keys||1)),0)}`;}catch(e){$('status').textContent=String(e);}}
$('reset').onclick=async()=>{await chrome.storage.local.remove('metrics');await refresh();};void refresh();setInterval(()=>void refresh(),1500);

$('try').onclick=()=>void chrome.tabs.create({url:chrome.runtime.getURL('test.html')});
input('maxWords').onchange=()=>{s.maxWords=Number(input('maxWords').value);void save();};
async function pageContext(kind:string){try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error('No active page');let r;try{r=await chrome.tabs.sendMessage(tab.id,{kind});}catch{r=await chrome.runtime.sendMessage({target:'lab',kind,labTabId:tab.id});}$('contextPreview').textContent=r.context?`${r.characters}/1200 characters\n${r.context}`:'No relevant context collected yet.';$('pageStatus').textContent=r.error||r.status||'';}catch{$('pageStatus').textContent='Click Try it for the built-in test, or reload an allowed website.';}}
void pageContext('contextStatus');

$('mail').onclick=()=>void chrome.tabs.create({url:chrome.runtime.getURL('mail.html')});
