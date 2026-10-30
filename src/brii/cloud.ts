export interface CloudSettings {enabled:boolean;automatic:boolean;sites:string[];delay:number;}
export const cloudDefaults:CloudSettings={enabled:false,automatic:true,sites:[],delay:80};
export const cloudSettings=async():Promise<CloudSettings>=>({...cloudDefaults,...((await chrome.storage.local.get('briiCloud')).briiCloud as Partial<CloudSettings>||{})});
export function cloudAllowed(url:string,s:CloudSettings){try{return s.enabled&&s.sites.includes(new URL(url).origin);}catch{return false;}}
export const BRIDGE='http://127.0.0.1:3001';
