import {threadId,visibleAccount,usableBadge} from './mail/badges';
import type {BadgeEntry} from './mail/types';
const global=globalThis as typeof globalThis&{__weasleyBadges?:boolean};
if(!global.__weasleyBadges){global.__weasleyBadges=true;
 const dirty=new Map<string,number>();let timer:ReturnType<typeof setTimeout>,running=false,again=false,alive=true;
 const rows=()=>[...document.querySelectorAll<HTMLElement>('tr.zA,[role="row"][data-thread-id]')];
 const idFor=(row:Element)=>threadId(row.getAttribute('data-legacy-thread-id'))||threadId(row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id')||null)||threadId(row.getAttribute('data-thread-id'))||threadId(row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id')||null);
 const remove=()=>document.querySelectorAll('[data-weasley-reply]').forEach(e=>e.remove());
 async function refresh(){if(!alive)return;if(running){again=true;return;}running=true;try{
  const account=visibleAccount(document),list=rows();if(!account){remove();return;}
  const ids=list.map(idFor).filter((id):id is string=>!!id);
  const response=await chrome.runtime.sendMessage({target:'gmailBadges',account,ids});
  if(!alive)return;
  const cache={account,entries:(response?.entries||[]) as BadgeEntry[]};
  for(const row of list){const id=idFor(row),entry=id?usableBadge(cache,account,id,dirty.get(id)||0):undefined;let badge=row.querySelector<HTMLElement>('[data-weasley-reply]');
   if(!entry||entry.checkedAt<(dirty.get(id!)||0)){badge?.remove();continue;}
   const cell=row.querySelector<HTMLElement>('td.a4W,.a4W,[data-weasley-subject]');if(!cell)continue;
   const subject=cell.querySelector<HTMLElement>('.y6')||cell.querySelector<HTMLElement>('.bog')?.parentElement||cell;
   const title='Needs your reply — '+entry.evidence+'\nChecked '+new Date(entry.checkedAt).toLocaleTimeString()+'. Rescan after new activity.';
   if(!badge){badge=document.createElement('span');badge.dataset.weasleyReply='';badge.setAttribute('role','img');badge.textContent='↩ Reply';badge.style.cssText='display:inline-flex;align-items:center;white-space:nowrap;flex:0 0 auto;min-width:48px;margin-right:8px;padding:1px 5px;border-radius:4px;background:#e8f0fe;color:#174ea6;font:600 11px/18px system-ui;vertical-align:middle;';subject.prepend(badge);}
   if(badge.title!==title){badge.title=title;badge.setAttribute('aria-label',title);}
  }
 }catch{remove();}finally{running=false;if(again){again=false;queue();}}}
 function queue(){clearTimeout(timer);timer=setTimeout(()=>void refresh(),120);}
 const observer=new MutationObserver(records=>{
  let external=false;
  for(const record of records){const target=record.target instanceof Element?record.target:record.target.parentElement;if(target?.closest('[data-weasley-reply]'))continue;
   if(record.type==='childList'&&[...record.addedNodes,...record.removedNodes].length&&[...record.addedNodes,...record.removedNodes].every(n=>n instanceof Element&&n.hasAttribute('data-weasley-reply')))continue;
   external=true;const row=target?.closest('tr.zA,[role="row"][data-thread-id]');const id=row?idFor(row):undefined;if(id)dirty.set(id,Date.now());
  }
  if(external)queue();
 });observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-thread-id','data-legacy-thread-id','aria-label']});
 const interval=setInterval(queue,60000);
 const onMessage=(m:any,sender:chrome.runtime.MessageSender)=>{if(sender.id!==chrome.runtime.id)return;if(m.target==='gmailBadgeRefresh')queue();if(m.target==='gmailBadgeDisconnect'){alive=false;observer.disconnect();clearInterval(interval);clearTimeout(timer);remove();global.__weasleyBadges=false;chrome.runtime.onMessage.removeListener(onMessage);}};
 chrome.runtime.onMessage.addListener(onMessage);queue();
}
