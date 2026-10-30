import type {DecodeResult} from './decoding';
export class CloudDecoder {
 private current?:string;
 constructor(private send:(message:any)=>Promise<any>){}
 async decode(text:string,context:string,current=text):Promise<DecodeResult>{const requestId=crypto.randomUUID();this.current=requestId;const start=performance.now();try{const data=await this.send({kind:'decode',requestId,text,context,current});if(data.error)throw Error(data.error);if(data.strategy!=='raw-current-v1')throw Error('Restart the updated Brii bridge: this server does not support raw + current draft decoding.');if(typeof data.corrected!=='string'||!data.corrected.trim()||data.corrected.length>1800)throw Error('Invalid cloud correction; original text was preserved.');return {model:typeof data.model==='string'?data.model:undefined,corrected:data.corrected,rawOutput:data.corrected,ttftMs:null,totalMs:performance.now()-start,finishReason:'complete'};}finally{if(this.current===requestId)this.current=undefined;}}
 cancel(){if(this.current)void this.send({kind:'cancel',requestId:this.current}).catch(()=>{});}
}
export const extensionTransport=(message:any)=>chrome.runtime.sendMessage({target:'briiCloud',...message});
