import test from 'node:test';import assert from 'node:assert/strict';import {installMailRoutes} from '../src/mail/background.ts';import {defaults} from '../src/shared.ts';import {prepareThread} from '../src/mail/parse.ts';import {samples} from '../src/mail/samples.ts';
test('mail gateway isolates real email processing and account-scoped badge quotes from content scripts',async()=>{
 const previous=(globalThis as any).chrome;let listener:any,ensured=0,closed=0,registered=0,forwarded:any;const local:any={settings:defaults,mailBadgesEnabled:true},session:any={};
 const store=(data:any)=>({get:async(key:string)=>({[key]:data[key]}),set:async(value:any)=>Object.assign(data,value),remove:async(key:string)=>{delete data[key];}});
 (globalThis as any).chrome={runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:(fn:any)=>listener=fn},sendMessage:async(m:any)=>{forwarded=m;return {decision:{verdict:'uncertain'}};}},storage:{local:store(local),session:store(session)},permissions:{contains:async()=>true},tabs:{query:async()=>[]},scripting:{executeScript:async()=>{}},offscreen:{hasDocument:async()=>true,closeDocument:async()=>{closed++;}}};
 try{
  installMailRoutes({ensure:async()=>{ensured++;},register:async()=>{registered++;}});
  const send=(m:any,sender:any)=>new Promise<any>(resolve=>listener(m,{id:'test',...sender},resolve));const own={url:'chrome-extension://test/mail.html',documentId:'mail-doc'};const web={url:'https://mail.google.com/mail/u/0/',tab:{id:1}};
  const packet=prepareThread(samples[0],['you@example.test']);assert.match((await send({target:'mail',kind:'classifyMail',packet},web)).error,/Only the local/);assert.equal(ensured,0);
  await send({target:'mail',kind:'classifyMail',packet},own);assert.equal(ensured,1);assert.equal(forwarded.owner,'mail-doc');assert.equal(forwarded.packet.latest.body,packet.latest.body);
  await send({target:'mail',kind:'publishBadges',account:'you@example.test',entries:[{threadId:'aa000001',messageId:'m',evidence:'Please reply Friday',checkedAt:Date.now(),body:'MUST_NOT_STORE',token:'MUST_NOT_STORE'}]},own);assert.doesNotMatch(JSON.stringify(session),/MUST_NOT_STORE/);
  const wrong=await send({target:'gmailBadges',account:'other@example.test',ids:['aa000001']},web);assert.deepEqual(wrong.entries,[]);
  const right=await send({target:'gmailBadges',account:'you@example.test',ids:['aa000001']},web);assert.equal(right.entries.length,1);
  const outside=await send({target:'gmailBadges',account:'you@example.test',ids:['aa000001']},{url:'https://outside.test',tab:{id:2}});assert.deepEqual(outside.entries,[]);
  local.mailDismissed=['fingerprint'];await send({target:'mail',kind:'clearMail'},own);assert.equal(session.mailBadgeCache,undefined);assert.equal(local.mailDismissed,undefined);assert.equal(local.mailBadgesEnabled,false);assert.equal(registered,1);assert.equal(closed,1);
 }finally{(globalThis as any).chrome=previous;}
});
