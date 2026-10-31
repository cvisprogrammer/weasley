import {InlineCommands,commandTransport} from './brii/commands';
import {selectedTrigger} from './brii/trigger';
import {gmailContext} from './brii/gmail-context';
import {PlainEditor,RichEditor} from './brii/editor';
import {extensionTransport} from './brii/cloud-client';
import {cloudSettings,cloudFrameAllowed,type CloudSettings} from './brii/cloud';
import {safeField,richHost} from './shared';
const global=globalThis as typeof globalThis&{__briiCommands?:boolean};
if(!global.__briiCommands){
 global.__briiCommands=true;let config:CloudSettings|undefined;
 const controllers=new Set<{element:HTMLElement;flow:InlineCommands}>(),known=new WeakSet<Element>();
 const host=document.createElement('div');host.dataset.briiStatus='';host.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;pointer-events:none;';
 const shadow=host.attachShadow({mode:'closed'}),status=document.createElement('div');status.style.cssText='font:12px/1.5 system-ui;background:#173a2b;color:white;padding:7px 12px;border-radius:5px;max-width:400px;';status.setAttribute('role','status');shadow.append(status);
 const active=()=>!!config&&cloudFrameAllowed(location.href,globalThis.origin,config);
 function show(message:string){if(!active()){host.remove();return;}if(!host.isConnected)document.documentElement.append(host);status.textContent='Brii · '+message;}
 function attach(target:Element|null){
  if(!active())return;const element=safeField(target)?target:richHost(target);
  if(!element){if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLElement&&target.isContentEditable)show('This field is excluded.');return;}
  const marker=selectedTrigger(config?.commandTrigger);show(`Ready · ${marker}instruction${marker} or ${marker}instruction then Enter`);if(known.has(element))return;
  for(const item of controllers)if(!item.element.isConnected){item.flow.dispose();known.delete(item.element);controllers.delete(item);}
  known.add(element);const plain=safeField(element);
  const flow=new InlineCommands(plain?new PlainEditor(element):new RichEditor(element),element,{active:()=>active()&&(plain?safeField(element):richHost(element)===element),ready:active,trustedOnly:true,trigger:()=>selectedTrigger(config?.commandTrigger),context:()=>gmailContext(element),run:commandTransport(extensionTransport),status:show});controllers.add({element,flow});
 }
 document.addEventListener('focusin',event=>{if(event.isTrusted)attach(event.target as Element);},true);
 void cloudSettings().then(settings=>{config=settings;attach(document.activeElement);});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.briiCloud){config=changes.briiCloud.newValue as CloudSettings;for(const item of controllers)item.flow.invalidate('Command settings changed.');if(!active())host.remove();else attach(document.activeElement);}});
 window.addEventListener('pagehide',()=>{for(const item of controllers)item.flow.dispose();controllers.clear();});
}
