import {BADGE_TTL,type BadgeCache,type BadgeEntry} from './types';
import {canonicalEmail} from './identity';
export function threadId(raw:string|null):string|undefined {if(!raw)return;const value=raw.replace(/^#/,'');if(/^[a-f0-9]{8,32}$/i.test(value))return value.toLowerCase();const decimal=value.match(/^thread-f:(\d+)$/);if(decimal){try{return BigInt(decimal[1]).toString(16);}catch{}}}
export function visibleAccount(doc:Document):string|undefined {
 // Only explicit account controls count. Never infer account from the /u/0 index or message senders.
 const nodes=doc.querySelectorAll('a[href^="https://accounts.google.com/SignOutOptions"]');
 for(const node of nodes){if(!(node as HTMLElement).checkVisibility({checkVisibilityCSS:true}))continue;const label=node.getAttribute('aria-label')||'';const email=label.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];if(email)return canonicalEmail(email);}
}
export function usableBadge(cache:BadgeCache|undefined,account:string,id:string,dirtyAt=0,now=Date.now()):BadgeEntry|undefined {
 if(!cache||canonicalEmail(cache.account)!==canonicalEmail(account))return;
 return cache.entries.find(entry=>entry.threadId===id&&entry.checkedAt>=dirtyAt&&now-entry.checkedAt<=BADGE_TTL);
}
