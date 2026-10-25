import {chromium} from 'playwright-core';import {writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import {resolve} from 'node:path';
await mkdir('artifacts',{recursive:true});
const ctx=await chromium.launchPersistentContext('/tmp/weasley-browser-'+Date.now(),{executablePath:process.env.CHROME_PATH || '/usr/lib/chromium/chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox','--enable-unsafe-extension-debugging','--disable-features=DisableLoadExtensionCommandLineSwitch',`--disable-extensions-except=${resolve('dist')}`,`--load-extension=${resolve('dist')}`]});
const results={};
try {
 try {
 if(!ctx.serviceWorkers().length){const cdp=await ctx.browser().newBrowserCDPSession(); await cdp.send('Extensions.loadUnpacked',{path:resolve('dist')});}
 const sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:10000});results.extensionServiceWorker=sw.url();
 const id=new URL(sw.url()).host, popup=await ctx.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await popup.waitForTimeout(1800);
 results.offscreenStatus=await popup.locator('#status').textContent();assert.match(results.offscreenStatus,/Not loaded/);
 } catch(e) {if(!String(e).includes('disabled by the administrator'))throw e;results.extensionStartupBlocked=String(e);}
 const page=await ctx.newPage();await page.goto('http://127.0.0.1:4173/test.html');
 results.gpu=await page.evaluate(async()=>{try{return {available:!!(await navigator.gpu?.requestAdapter())};}catch(e){return {available:false,reason:String(e)};}});
 await page.evaluate(()=>{window.events=[];window.requests=[];window.reply=' world';window.wait=10;
 window.chrome={storage:{local:{get:async()=>({settings:{enabled:true,sites:[location.origin],delay:100,tokens:10,model:'test'}})},onChanged:{addListener:()=>{}}},runtime:{sendMessage:async m=>{window.events.push(m);if(m.kind==='predict'){window.requests.push(m);const text=window.reply;await new Promise(r=>setTimeout(r,window.wait));return {text,ttft:8,total:10};}return {};}}};});
 await page.addScriptTag({path:'dist/content.js'});
 const input=page.locator('#ordinary');await input.focus();await input.pressSequentially('Hello');await page.waitForTimeout(180);
 assert.equal(await input.inputValue(),'Hello');assert.ok(await page.evaluate(()=>events.some(x=>x.event==='shown')));
 await input.press('Tab');assert.equal(await input.inputValue(),'Hello world');results.tabAcceptance=true;
 await input.press('Control+z');assert.equal(await input.inputValue(),'Hello');results.nativeUndo=true;
 await input.press('End');await input.pressSequentially(' again');await page.waitForTimeout(180);await input.press('Escape');await input.press('Tab');assert.equal(await input.inputValue(),'Hello again');results.escape=true;
 await page.evaluate(()=>{window.wait=300;window.reply=' obsolete';});await input.focus();await input.press('End');await input.pressSequentially('x');await page.waitForTimeout(130);await input.pressSequentially('y');await page.waitForTimeout(30);await input.press('Tab');await page.waitForTimeout(450);assert.equal(await input.inputValue(),'Hello againxy');results.staleResultRejected=true;
 const before=await page.evaluate(()=>requests.length);await page.locator('input[type=password]').fill('secret123');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>requests.length),before);results.passwordExcluded=true;
 await input.focus();await page.evaluate(()=>{document.activeElement.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});await input.pressSequentially('IME');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>requests.length),before);results.imeExcluded=true;

 await page.evaluate(()=>{document.activeElement.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));window.wait=10;window.reply=' useful words';});
 await input.fill('Partial');await input.focus();await input.press('End');await input.pressSequentially(' test');await page.waitForTimeout(180);await input.press('Alt+ArrowRight');assert.equal(await input.inputValue(),'Partial test useful ');results.partialAcceptance=true;
 for(const selector of ['input[type=email]','input[autocomplete="cc-number"]','[contenteditable=true]']){const n=await page.evaluate(()=>requests.length);await page.locator(selector).fill('excluded');await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>requests.length),n);}results.otherSensitiveFieldsExcluded=true;
 const textarea=page.locator('#typing');await textarea.fill('Textarea');await textarea.focus();await textarea.press('End');await textarea.pressSequentially(' test');await page.waitForTimeout(180);await textarea.press('Tab');assert.equal(await textarea.inputValue(),'Textarea test useful words');await textarea.focus();await textarea.press('Control+z');assert.equal(await textarea.inputValue(),'Textarea test');results.textareaAcceptanceAndUndo=true;
 const bench=await ctx.newPage();await bench.goto('http://127.0.0.1:4173/benchmark.html');await bench.locator('#run').click();await bench.waitForFunction(()=>!document.querySelector('#export').disabled);results.modelBenchmark=JSON.parse(await bench.locator('#result').textContent());
 results.note='Editing checks use mocked inference; no model throughput or quality claim.';
 console.log(JSON.stringify(results,null,2));
} finally {await writeFile('artifacts/browser-check.json',JSON.stringify(results,null,2));await ctx.close();}
