import {selectedTrigger,type CommandTrigger} from './trigger';
export interface CloudSettings {includePageContext?:boolean;commandTrigger?:CommandTrigger;enabled:boolean;automatic:boolean;sites:string[];delay:number;}
export const cloudDefaults:CloudSettings={includePageContext:true,commandTrigger:';;',enabled:false,automatic:true,sites:[],delay:80};
export const cloudSettings=async():Promise<CloudSettings>=>{const stored=(await chrome.storage.local.get('briiCloud')).briiCloud as Partial<CloudSettings>|undefined;return {...cloudDefaults,...stored,commandTrigger:selectedTrigger(stored?.commandTrigger)};};
export function cloudAllowed(url:string,s:CloudSettings){try{return s.enabled&&s.sites.includes(new URL(url).origin);}catch{return false;}}
export const BRIDGE='http://127.0.0.1:3001';

// about:blank/srcdoc inherit an origin; do not grant opaque or unrelated frames access.
export function cloudFrameAllowed(url:string,origin:string|undefined,s:CloudSettings){
 if(url==='about:blank'||url==='about:srcdoc')return !!origin&&cloudAllowed(origin,s);
 return cloudAllowed(url,s);
}
