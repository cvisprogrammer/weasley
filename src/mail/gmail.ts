import {GMAIL_SCOPE,type GmailThread} from './types';
const ROOT='https://gmail.googleapis.com/gmail/v1/users/me/';
export interface IdentityPort {getAuthToken(details:chrome.identity.TokenDetails):Promise<chrome.identity.GetAuthTokenResult>;removeCachedAuthToken(details:{token:string}):Promise<void>;clearAllCachedAuthTokens():Promise<void>;}
export class GmailClient {
 private token:string|undefined;private revision=0;private active=false;
 constructor(private identity:IdentityPort=chrome.identity,private fetcher:typeof fetch=globalThis.fetch.bind(globalThis)){}
 private async authenticate(interactive:boolean){const rev=this.revision;const auth=await this.identity.getAuthToken({interactive,scopes:[GMAIL_SCOPE],enableGranularPermissions:true});if(rev!==this.revision){if(auth.token)await this.identity.removeCachedAuthToken({token:auth.token});throw Error('Connection cancelled.');}if(!auth.token)throw Error('Google did not return an access token.');if(auth.grantedScopes&&!auth.grantedScopes.includes(GMAIL_SCOPE))throw Error('Read-only Gmail access was not granted.');this.token=auth.token;}
 async connect(signal?:AbortSignal){this.active=true;this.revision++;await this.authenticate(true);return await this.request<{emailAddress:string}>('profile',signal);}
 private async request<T>(path:string,signal?:AbortSignal,retry=true):Promise<T>{
  signal?.throwIfAborted();if(!this.active)throw Error('Gmail is disconnected.');const rev=this.revision;
  if(!this.token)await this.authenticate(false);
  signal?.throwIfAborted();if(!this.active||rev!==this.revision)throw Error('Gmail connection changed.');
  const token=this.token!;
  const response=await this.fetcher(ROOT+path,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal});
  signal?.throwIfAborted();if(!this.active||rev!==this.revision)throw Error('Gmail connection changed.');
  if(response.status===401&&retry){await this.identity.removeCachedAuthToken({token});this.token=undefined;return this.request(path,signal,false);}
  if(!response.ok){const messages:Record<number,string>={401:'Google access expired. Reconnect Gmail.',403:'Google denied Gmail access. Check Gmail API enablement, the read-only scope and your test-user configuration.',429:'Gmail rate limit reached. Wait before scanning again.'};throw Error(messages[response.status]||`Gmail request failed (HTTP ${response.status}).`);}
  return await response.json() as T;
 }
 async list(signal?:AbortSignal){const data=await this.request<{threads?:{id:string}[]}>('threads?labelIds=INBOX&q=category%3Aprimary&maxResults=20',signal);return (data.threads||[]).map(t=>safeId(t.id));}
 async thread(id:string,signal?:AbortSignal){return this.request<GmailThread>('threads/'+safeId(id)+'?format=full',signal);}
 async disconnect(){const token=this.token;this.token=undefined;this.active=false;this.revision++;let revoked=false;
  try{if(token){const response=await this.fetcher('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});revoked=response.ok;}}
  catch{revoked=false;}finally{await this.identity.clearAllCachedAuthTokens();}return revoked;
 }
}
export function safeId(id:string){if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw Error('Invalid Gmail thread identifier.');return id;}
export function gmailLink(account:string,id:string){return 'https://mail.google.com/mail/?authuser='+encodeURIComponent(account)+'#all/'+safeId(id);}
export function configuredManifest(manifest:chrome.runtime.Manifest,clientId:string){if(!/^[a-z0-9][a-z0-9-]{9,}\.apps\.googleusercontent\.com$/i.test(clientId.trim()))throw Error('Enter a Google OAuth client ID ending in .apps.googleusercontent.com. Do not enter a client secret.');return {...manifest,oauth2:{client_id:clientId.trim(),scopes:[GMAIL_SCOPE]}};}
