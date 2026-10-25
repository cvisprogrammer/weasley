import { harvestContext } from './context';
import { allowed, nextWord, safeField, settings, type Settings } from './shared';
let context='',contextUrl=location.href,contextField:HTMLElement|null=null,contextAt=0,lastStatus='Ready to type';
function status(text:string){lastStatus=text;const node=document.querySelector('[data-weasley-status]');if(node)node.textContent=text;}
const labPage=location.href===chrome.runtime.getURL('test.html');
let ownTabId:number|undefined;
if(labPage)void chrome.tabs.getCurrent().then(tab=>ownTabId=tab?.id);
const canUsePage=(s:Settings)=>allowed(location.href,s)||(s.enabled&&labPage);
let config:Settings, composing=false, epoch=0, suggestion='', snapshot='', cursor=0, pending=false;
let field:HTMLInputElement|HTMLTextAreaElement|null=null, timer:ReturnType<typeof setTimeout>;
const host=document.createElement('div');host.setAttribute('data-weasley-ui','');host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647';
const shadow=host.attachShadow({mode:'closed'}), ghost=document.createElement('div');shadow.append(ghost);ghost.setAttribute('aria-hidden','true');
const send=(kind:string, data:object={})=>chrome.runtime.sendMessage({target:'background',kind,...data}).catch(()=>({text:'',error:'Extension connection lost. Reload this page and check Weasley.'}));
const metric=(event:string,data:object={})=>void send('metric',{event,...data});
function clear(reject=true){clearTimeout(timer);epoch++;if(suggestion&&reject)metric('rejected');suggestion='';ghost.textContent='';if(pending){pending=false;void send('cancel');}}
function paint(){
 if(!field||!suggestion)return;if(!host.isConnected)document.documentElement.append(host);
 const r=field.getBoundingClientRect(),s=getComputedStyle(field),mirror=document.createElement('div');
 for(const p of ['font','letterSpacing','lineHeight','padding','border','boxSizing','textIndent','wordSpacing'] as const)mirror.style[p]=s[p];
 mirror.style.cssText+=`;position:fixed;visibility:hidden;left:${r.left}px;top:${r.top}px;width:${r.width}px;white-space:${field instanceof HTMLTextAreaElement?'pre-wrap':'pre'};overflow-wrap:break-word;`;
 mirror.textContent=field.value.slice(0,cursor);const marker=document.createElement('span');marker.textContent='\u200b';mirror.append(marker);shadow.append(mirror);
 const p=marker.getBoundingClientRect();mirror.remove();const x=p.left-field.scrollLeft,y=p.top-field.scrollTop;
 if(x<r.left||x>r.right-8||y<r.top||y>r.bottom-8){ghost.textContent='';return;}
 ghost.style.cssText=`position:fixed;left:${x}px;top:${y}px;font:${s.font};letter-spacing:${s.letterSpacing};color:${s.color};opacity:.45;white-space:pre;max-width:${r.right-x-8}px;overflow:hidden;`;ghost.textContent=suggestion;
}
async function schedule(){
 if(contextUrl!==location.href){context='';contextField=null;contextAt=0;contextUrl=location.href;}
 clear();
 if(!config)return;
 if(!canUsePage(config)){status('Enable Weasley and allow this website in the popup, then reload this page.');return;}
 if(composing||!safeField(document.activeElement))return;
 field=document.activeElement;
 if(field.selectionStart!==field.selectionEnd||field.selectionStart!==field.value.length){status('Move the caret to the end of your message to get a suggestion.');return;}
 if(field.value.trim().length<3){status('Type a few words. Page context is picked up automatically.');return;}
 snapshot=field.value;cursor=field.selectionStart!;const ticket=epoch,target=field;
 status('Waiting for a pause…');let attempts=0;
 const valid=()=>ticket===epoch&&!composing&&document.activeElement===target&&target.value===snapshot&&target.selectionStart===cursor&&config.enabled;
 const run=async()=>{
  if(!valid())return;
  if(contextField!==target||performance.now()-contextAt>3000){context=harvestContext(target,snapshot);contextField=target;contextAt=performance.now();}
  status('Predicting…');pending=true;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const r=await Promise.race([send('predict',{prefix:snapshot.slice(-1800),context}),new Promise<any>(resolve=>{timeout=setTimeout(()=>resolve({text:'',error:'Prediction timed out. Use Release GPU / reset engine in Weasley, then load again.'}),30000);})]);
  clearTimeout(timeout);if(ticket===epoch)pending=false;
  if(!valid())return;
  if(r.reason==='busy'&&attempts++<30){status('Model is finishing the previous prediction…');timer=setTimeout(()=>void run(),150);return;}
  if(r.text){suggestion=r.text;paint();status('Tab to accept · Alt+Right for one word · Escape to dismiss');metric('shown',{chars:suggestion.length,ttft:r.ttft,total:r.total});}
  else status(r.error||r.reason||'No continuation returned. Keep typing.');
 };
 timer=setTimeout(()=>void run(),config.delay);
}
document.addEventListener('focusin',()=>void schedule(),true);
document.addEventListener('input',()=>void schedule(),true);
document.addEventListener('compositionstart',()=>{composing=true;clear();},true);
document.addEventListener('compositionend',()=>{composing=false;void schedule();},true);
for(const event of ['focusout','pointerdown','scroll'])document.addEventListener(event,()=>clear(),true);
window.addEventListener('resize',()=>clear());
document.addEventListener('keydown',e=>{
 if(composing||e.isComposing)return;
 if(e.key==='Escape'){clear();status('Suggestion dismissed. Keep typing.');return;}
 if(suggestion&&field&&document.activeElement===field&&field.value===snapshot&&field.selectionStart===cursor&&field.selectionEnd===cursor&&((e.key==='Tab'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey)||(e.key==='ArrowRight'&&e.altKey&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey))){
 const text=e.altKey?nextWord(suggestion):suggestion;e.preventDefault();e.stopImmediatePropagation();clear(false);
 if(document.execCommand('insertText',false,text)){metric('accepted',{chars:text.length,keys:e.altKey?2:1});void schedule();}return;
 }
 if(!['Shift','Control','Alt','Meta'].includes(e.key))clear();
},true);
void settings().then(s=>{config=s;status(canUsePage(s)?'Ready. Type in the field; page context is automatic.':'Allow this website in Weasley, load the model, and reload this page.');});
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.settings){config=c.settings.newValue as Settings;if(!canUsePage(config)){context='';contextField=null;contextAt=0;}clear();}});

chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(sender.id!==chrome.runtime.id || sender.tab || sender.url!==chrome.runtime.getURL('popup.html') || m.kind!=='contextStatus')return;
 if(m.target==='lab'&&(!labPage||m.labTabId!==ownTabId))return;
 if(!config || !canUsePage(config)){reply({error:'Enable and allow this website first.'});return;}
 if(contextUrl!==location.href){context='';contextField=null;contextAt=0;contextUrl=location.href;}
 reply({context,characters:context.length,status:lastStatus});
});
