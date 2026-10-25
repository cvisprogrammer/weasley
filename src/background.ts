import {installMailRoutes} from './mail/background';
import { allowed, settings, matchPattern } from './shared';
let creating: Promise<void> | undefined;
let metricQueue: Promise<unknown> = Promise.resolve();
async function ensure() {
 if (await chrome.offscreen.hasDocument()) return;
 if (!creating) creating = chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: [chrome.offscreen.Reason.WORKERS], justification: 'Run a shared, local WebGPU model in a dedicated worker without blocking typing.' }).finally(() => { creating = undefined; });
 await creating;
}
async function register() {
 await chrome.scripting.unregisterContentScripts();
 const s = await settings(); const matches: string[] = [];
 for (const origin of s.sites) if(await chrome.permissions.contains({origins:[matchPattern(origin)]})) matches.push(matchPattern(origin));
 if((await chrome.storage.local.get('mailBadgesEnabled')).mailBadgesEnabled===true&&await chrome.permissions.contains({origins:['https://mail.google.com/*']}))await chrome.scripting.registerContentScripts([{id:'gmailReplyBadge',matches:['https://mail.google.com/*'],js:['gmail-badges.js'],runAt:'document_idle',persistAcrossSessions:true}]);
 if(matches.length) await chrome.scripting.registerContentScripts([{id:'typing', matches:[...new Set(matches)], js:['content.js'], runAt:'document_idle', persistAcrossSessions:true}]);
}
let registration=Promise.resolve();
function queueRegister(){registration=registration.catch(()=>{}).then(register);return registration;}
installMailRoutes({ensure,register:queueRegister});
chrome.runtime.onInstalled.addListener(queueRegister);
chrome.runtime.onStartup.addListener(queueRegister);
chrome.storage.onChanged.addListener((c,area) => { if(area==='local' && c.settings && JSON.stringify((c.settings.oldValue as any)?.sites)!==JSON.stringify((c.settings.newValue as any)?.sites)) queueRegister(); });
chrome.runtime.onMessage.addListener((m,sender,reply) => {
 if (sender.id !== chrome.runtime.id || m.target !== 'background') return;
 void (async () => {
  try {
   const s = await settings();
   const lab=sender.url===chrome.runtime.getURL('test.html');
   const popup=sender.url===chrome.runtime.getURL('popup.html');
   const pageCommand=['predict','cancel','metric'].includes(m.kind);
   if(lab){if(!s.enabled||!pageCommand){reply({text:'',error:'Enable Weasley to use the test page.'});return;}}
   else if(sender.tab){if(!allowed(sender.url||'',s)||!pageCommand){reply({text:'',error:'This website is not enabled in Weasley.'});return;}}
   else if(!popup){reply({text:'',error:'Unauthorized'});return;}
   if(m.kind==='metric') {
    metricQueue=metricQueue.catch(()=>{}).then(async()=>{
    const metrics=((await chrome.storage.local.get('metrics')).metrics || []) as any[];
    // Store only numeric counters/timing. Never text, field identifiers, or browsing URLs.
    const event={at:Date.now(),kind:['shown','accepted','rejected'].includes(m.event)?m.event:'shown', keys:Math.max(1,Math.min(2,Number(m.keys)||1)), chars:Math.max(0,Number(m.chars)||0),ttft:Math.max(0,Number(m.ttft)||0),total:Math.max(0,Number(m.total)||0)};
    await chrome.storage.local.set({metrics:[...metrics.slice(-499),event]}); }); await metricQueue; reply({}); return;
   }
   if(m.kind==='predict' && (typeof m.prefix!=='string' || m.prefix.length>1800 || typeof m.context!=='string' || m.context.length>1200)) {reply({text:'',error:'Prediction request exceeds the supported text/context size.'});return;}
   if(m.kind==='resetEngine') { if(await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument(); reply({ok:true}); return; }
   await ensure(); reply(await chrome.runtime.sendMessage({...m,settings:s,owner:sender.tab?.id ?? (lab?sender.documentId||'lab':'popup'),target:'engine'}));
  } catch(e) {reply({error:String(e),text:''});}
 })(); return true;
});
