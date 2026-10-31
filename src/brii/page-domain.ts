// Share hostname only: never paths, query parameters, fragments, or credentials.
export function websiteDomain(url:string,inheritedOrigin?:string):string{
 try{const page=new URL(['about:blank','about:srcdoc'].includes(url)?inheritedOrigin||'':url);return ['http:','https:'].includes(page.protocol)?page.hostname:'';}catch{return '';}
}
export function validPageDomain(value:unknown):boolean{
 if(typeof value!=='string'||!value||value.length>253)return false;
 try{return new URL('https://'+value).hostname===value;}catch{return false;}
}
