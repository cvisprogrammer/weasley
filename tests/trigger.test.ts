import test from 'node:test';import assert from 'node:assert/strict';import {commandTriggers,selectedTrigger} from '../src/brii/trigger';import {cloudSettings} from '../src/brii/cloud';
test('missing or invalid marker settings use semicolons; saved choices preserve other cloud settings',async()=>{
 const previous=(globalThis as any).chrome;
 try{
  for(const value of [undefined,'/', '', 'arbitrary',42,...commandTriggers]){
   (globalThis as any).chrome={storage:{local:{get:async()=>({briiCloud:{enabled:true,sites:['https://mail.google.com'],commandTrigger:value}})}}};
   const settings=await cloudSettings();assert.equal(settings.commandTrigger,selectedTrigger(value));assert.equal(settings.enabled,true);assert.deepEqual(settings.sites,['https://mail.google.com']);
   assert.equal(selectedTrigger(value),commandTriggers.includes(value as any)?value:';;');
  }
 }finally{(globalThis as any).chrome=previous;}
});
