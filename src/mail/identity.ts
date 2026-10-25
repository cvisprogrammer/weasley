export function canonicalEmail(value:string){const email=value.toLowerCase().trim();const [local,domain]=email.split('@');return domain==='gmail.com'||domain==='googlemail.com'?local.split('+')[0].replace(/\./g,'')+'@gmail.com':email;}
export function addresses(value:string){return (value.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(canonicalEmail);}
export const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
