import {BriiFlow} from './brii/flow';import {CloudDecoder,extensionTransport} from './brii/cloud-client';import {cloudSettings,cloudFrameAllowed,type CloudSettings} from './brii/cloud';import {safeField,richHost} from './shared';import {RichEditor} from './brii/editor';
const global=globalThis as typeof globalThis&{__briiFlow?:boolean};
if(!global.__briiFlow){global.__briiFlow=true;let config:CloudSettings|undefined;const flows=new Set<{element:HTMLElement;flow:BriiFlow}>();const known=new WeakSet<Element>();
 const host=document.createElement('div');host.dataset.briiStatus='';host.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;pointer-events:none;';const shadow=host.attachShadow({mode:'closed'});const status=document.createElement('div');status.style.cssText='font:12px/1.5 system-ui;background:#173a2b;color:white;padding:7px 12px;border-radius:5px;max-width:400px;';status.setAttribute('role','status');shadow.append(status);
 const active=()=>!!config&&cloudFrameAllowed(location.href,globalThis.origin,config);
 function show(message:string){if(!active()){host.remove();return;}if(!host.isConnected)document.documentElement.append(host);status.textContent='Brii · OpenAI · '+message;}
 function attach(target:Element|null){
  if(!active())return;
  const element=safeField(target)?target:richHost(target);
  if(!element){if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLElement&&target.isContentEditable)show('This field is excluded from cloud correction.');return;}
  const plain=safeField(element);
  show(`Ready in this ${plain?'field':'rich-text editor'} · type, then Space or Cmd/Ctrl+Enter`);
  if(known.has(element))return;
  for(const item of flows)if(!item.element.isConnected){item.flow.invalidate();flows.delete(item);}
  known.add(element);
  const decoder=new CloudDecoder(extensionTransport);
  const flow=new BriiFlow(plain?element:new RichEditor(element),{rolling:true,active:()=>active()&&(plain?safeField(element):richHost(element)===element),trustedOnly:true,ready:active,automatic:()=>!!config?.automatic,delay:()=>config?.delay??80,decodingStatus:'Decoding with OpenAI… keep typing.',decode:(text,context)=>decoder.decode(text,context),cancel:()=>decoder.cancel(),status:show,result:r=>{if(r.applied)show(`Corrected · ${Math.round(r.result.totalMs)} ms · Undo to restore`);}});
  flows.add({element,flow});
 }
 document.addEventListener('focusin',event=>{if(event.isTrusted)attach(event.target as Element);},true);
 void cloudSettings().then(s=>{config=s;attach(document.activeElement);});
 chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&c.briiCloud){config=c.briiCloud.newValue as CloudSettings;for(const item of flows)item.flow.invalidate('Cloud correction settings changed.');if(!active())host.remove();else attach(document.activeElement);}});
}
