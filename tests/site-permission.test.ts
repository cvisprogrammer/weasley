import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('background saves a first permission grant after the popup disappears and preserves it if attachment fails',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'brii-permission-')),previous=(globalThis as any).chrome;
 let listener:any,onAdded:any;const session:Record<string,any>={},granted=new Set<string>(),injections:any[]=[],registrations:any[]=[];let settings={enabled:true,sites:[] as string[],commandTrigger:';;',includePageContext:false},failInjection=false;
 const noop={addListener:()=>{}};
 (globalThis as any).chrome={runtime:{id:'fixture',getURL:(path:string)=>'chrome-extension://fixture/'+path,onMessage:{addListener:(fn:any)=>listener=fn},onInstalled:noop,onStartup:noop},storage:{local:{get:async()=>({briiCloud:settings}),set:async(data:any)=>{settings=data.briiCloud;}},session:{get:async()=>({...session}),set:async(data:any)=>Object.assign(session,data),remove:async(key:string)=>{delete session[key];}},onChanged:noop},permissions:{contains:async({origins}:any)=>origins.every((pattern:string)=>granted.has(pattern)),onAdded:{addListener:(fn:any)=>onAdded=fn}},scripting:{unregisterContentScripts:async()=>{},registerContentScripts:async(args:any)=>registrations.push(args),executeScript:async(args:any)=>{if(failInjection)throw Error('Tab navigated');injections.push(args);}}};
 const popup={id:'fixture',url:'chrome-extension://fixture/flow-popup.html'},origin='https://forum.example.test:8443',tabId=7;
 try{
  await build({entryPoints:['src/flow-background.ts'],outfile:join(directory,'main.mjs'),bundle:true,platform:'node',format:'esm'});await import(join(directory,'main.mjs'));
  const send=(kind:string,site=origin,tab=tabId,sender:any=popup)=>new Promise<any>(resolve=>listener({target:'briiCloud',kind,origin:site,tabId:tab},sender,resolve));
  assert.match((await send('prepareSite',origin,tabId,{id:'fixture',url:origin,tab:{id:tabId}})).error,/Unauthorized/);assert.deepEqual(session,{});
  assert.equal((await send('prepareSite')).ok,true);assert.equal(session.briiPendingSite.origin,origin);assert.deepEqual(settings.sites,[]);
  onAdded({origins:['https://unrelated.test/*']});await send('prepareSite');assert.deepEqual(settings.sites,[]);
  // A new native grant closes the popup: no popup-side finish message follows.
  granted.add('https://forum.example.test/*');onAdded({origins:['https://forum.example.test/*']});
  // An already queued worker message acts only as a completion barrier.
  await send('cancelSite','https://unrelated.test',99);
  assert.deepEqual(settings.sites,[origin]);assert.equal(session.briiPendingSite,undefined);assert.equal(injections.length,1);assert.equal(injections[0].target.tabId,tabId);assert.equal(injections[0].target.allFrames,true);assert.equal(registrations.length,1);assert.equal(settings.commandTrigger,';;');assert.equal(settings.includePageContext,false);
  // Reopening the popup sees the saved site; already-granted hosts do not emit onAdded.
  assert.equal((await send('prepareSite')).ok,true);assert.equal((await send('finishSite')).saved,true);assert.deepEqual(settings.sites,[origin]);
  // Denied grants never become local authorization.
  await send('prepareSite','https://denied.test');assert.equal((await send('finishSite','https://denied.test')).saved,false);await send('cancelSite','https://denied.test');assert.deepEqual(settings.sites,[origin]);
  // A remembered browser host grant alone must not authorize a different port.
  assert.equal((await send('finishSite','https://forum.example.test:9443')).saved,false);
  failInjection=true;await send('prepareSite','https://other.test');granted.add('https://other.test/*');const outcome=await send('finishSite','https://other.test');assert.equal(outcome.saved,true);assert.equal(outcome.attached,false);assert.ok(settings.sites.includes('https://other.test'));
  // Expired staging cannot revive consent after a later permission event.
  await send('prepareSite','https://expired.test');session.briiPendingSite.at=Date.now()-11*60*1000;granted.add('https://expired.test/*');onAdded({origins:['https://expired.test/*']});await send('cancelSite','https://unrelated.test',99);assert.ok(!settings.sites.includes('https://expired.test'));
 }finally{(globalThis as any).chrome=previous;await rm(directory,{recursive:true,force:true});}
});
