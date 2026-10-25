import {BADGE_TTL,type BadgeCache,type BadgeEntry} from './types';
import {settings} from '../shared';
import {validPacket} from './classify';
import {canonicalEmail} from './identity';
export function installMailRoutes(hooks:{ensure:()=>Promise<void>;register:()=>Promise<unknown>}){
 const notify=async(target='gmailBadgeRefresh')=>{const tabs=await chrome.tabs.query({url:'https://mail.google.com/*'});await Promise.allSettled(tabs.filter(t=>t.id!==undefined).map(t=>chrome.tabs.sendMessage(t.id!,{target})));};
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||!['mail','gmailBadges'].includes(m.target))return;
  void(async()=>{try{
   if(m.target==='gmailBadges'){
    if((await chrome.storage.local.get('mailBadgesEnabled')).mailBadgesEnabled!==true||!sender.tab||!sender.url?.startsWith('https://mail.google.com/')||!await chrome.permissions.contains({origins:['https://mail.google.com/*']})){reply({entries:[]});return;}
    const cache=(await chrome.storage.session.get('mailBadgeCache')).mailBadgeCache as BadgeCache|undefined;
    const ids=new Set(Array.isArray(m.ids)?m.ids.filter((x:unknown)=>typeof x==='string').slice(0,100):[]);
    if(!cache||typeof m.account!=='string'||canonicalEmail(m.account)!==canonicalEmail(cache.account)){reply({entries:[]});return;}
    reply({entries:cache.entries.filter(e=>ids.has(e.threadId)&&Date.now()-e.checkedAt<BADGE_TTL)});return;
   }
   if(sender.url!==chrome.runtime.getURL('mail.html')){reply({error:'Only the local reply inbox can make this request.'});return;}
   if(m.kind==='enableBadges'){
    await chrome.storage.local.set({mailBadgesEnabled:true});await hooks.register();const tabs=await chrome.tabs.query({url:'https://mail.google.com/*'});
    await Promise.allSettled(tabs.filter(t=>t.id!==undefined).map(t=>chrome.scripting.executeScript({target:{tabId:t.id!},files:['gmail-badges.js']})));reply({ok:true});return;
   }
   if(m.kind==='publishBadges'){
    if(typeof m.account!=='string'||!m.account.includes('@')||!Array.isArray(m.entries)){reply({error:'Invalid badge index.'});return;}
    const entries:BadgeEntry[]=m.entries.filter((e:any)=>e&&/^[a-f0-9]{8,32}$/i.test(e.threadId)&&typeof e.messageId==='string'&&e.messageId.length<=200&&typeof e.evidence==='string'&&e.evidence.length<=240&&Number.isFinite(e.checkedAt)).slice(0,100).map((e:any)=>({threadId:e.threadId.toLowerCase(),messageId:e.messageId,evidence:e.evidence,checkedAt:e.checkedAt}));
    await chrome.storage.session.set({mailBadgeCache:{account:canonicalEmail(m.account),entries}});await notify();reply({ok:true});return;
   }
   if(m.kind==='clearMail'){
    await chrome.storage.session.remove('mailBadgeCache');await chrome.storage.local.remove('mailDismissed');await chrome.storage.local.set({mailBadgesEnabled:false});
    const cleanup=await Promise.allSettled([hooks.register(),(async()=>{if(await chrome.offscreen.hasDocument())await chrome.offscreen.closeDocument();})(),notify('gmailBadgeDisconnect')]);
    reply(cleanup.some(r=>r.status==='rejected')?{error:'Some local cleanup could not be confirmed. Reload the extension and disconnect again.'}:{ok:true});return;
   }
   if(!['status','load','resetEngine','cancel','classifyMail'].includes(m.kind)){reply({error:'Unsupported mail operation.'});return;}
   if(m.kind==='classifyMail'&&!validPacket(m.packet)){reply({error:'Email text exceeds the supported local analysis limits.'});return;}
   if(m.kind==='resetEngine'){if(await chrome.offscreen.hasDocument())await chrome.offscreen.closeDocument();reply({ok:true});return;}
   await hooks.ensure();const s=await settings();
   reply(await chrome.runtime.sendMessage({target:'engine',kind:m.kind,settings:s,packet:m.packet,owner:sender.documentId||'mail'}));
  }catch{reply({error:'The local mail operation failed. Reload the extension and try again.'});}})();return true;
 });
}
