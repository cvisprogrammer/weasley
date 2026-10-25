import { WebWorkerMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { continuationMessages, shortContinuation } from './prediction';
import { type Settings } from './shared';
const worker = new Worker('worker.js', { type: 'module' });
let state = { text: 'Not loaded. Open settings to approve the model download.', ready: false, model: '', busy: false };
let epoch = 0; let owner: number | string | undefined;
const engine = new WebWorkerMLCEngine(worker, {
 appConfig: { cacheBackend: 'indexeddb', model_list: prebuiltAppConfig.model_list.filter(m => /^Qwen3\.5-(0\.8|2|4)B-q4f16_1-MLC$/.test(m.model_id)).map(m => ({ ...m, model_lib: chrome.runtime.getURL(`models/${m.model_id}.wasm`) })) },
 initProgressCallback: p => { state.text = p.text; }, logLevel: 'ERROR'
});
worker.onerror = () => { state.ready = false; state.text = 'Worker failed. Use Release GPU / reset engine, then load again.'; state.busy = false; };
chrome.runtime.onMessage.addListener((m, sender, reply) => {
 if (sender.id !== chrome.runtime.id || m.target !== 'engine') return;
 if (m.kind === 'status') { reply(state); return; }
 if (m.kind === 'cancel') { if(owner===m.owner){epoch++; engine.interruptGenerate();} reply({}); return; }
 if (m.kind === 'load') {
  if(state.busy) { reply({ error: 'Engine busy. Try again shortly.' }); return; }
  state.busy = true; state.ready = false; state.text = 'Loading…';
  void (async () => { try { const s = m.settings as Settings; await engine.reload(s.model); state.model = s.model; state.ready = true; state.text = 'Ready — inference stays on this device'; reply({ok:true}); }
  catch(e) { state.text = String(e); reply({error:state.text}); } finally {state.busy=false;} })(); return true;
 }
 if (m.kind === 'predict') {
  if (!state.ready || state.busy) { reply({ text: '' }); return; }
  state.busy = true; owner=m.owner; const ticket = ++epoch;
  void (async () => {
   try {
    const s = m.settings as Settings;
    if (state.model !== s.model) { reply({text:''}); return; }
    const start = performance.now(); let first = 0; let text = '';
    const instructed=s.promptMode!=='raw';let truncated=false;
    await engine.resetChat(); // No conversational history or cross-field context is retained.
    if(ticket!==epoch){reply({text:''});return;}
    if(instructed){
     const stream=await engine.chat.completions.create({messages:continuationMessages(m.prefix,m.context||'',s.maxWords||3),max_tokens:s.tokens,temperature:.1,top_p:.8,stream:true,extra_body:{enable_thinking:false}});
     for await(const chunk of stream){if(ticket!==epoch){engine.interruptGenerate();break;}const t=chunk.choices[0]?.delta.content||'';if(t&&!first)first=performance.now()-start;text+=t;if(chunk.choices[0]?.finish_reason==='length')truncated=true;}
    }else{
     const stream=await engine.completions.create({prompt:m.prefix,max_tokens:s.tokens,temperature:.15,top_p:.8,stream:true,stop:['\n','<|im_end|>','<|endoftext|>']});
     for await(const chunk of stream){if(ticket!==epoch){engine.interruptGenerate();break;}const t=chunk.choices[0]?.text||'';if(t&&!first)first=performance.now()-start;text+=t;if(chunk.choices[0]?.finish_reason==='length')truncated=true;}
    }
    reply({text:ticket===epoch?shortContinuation(text,m.prefix,s.maxWords||3,instructed,truncated):'',ttft:first,total:performance.now()-start});
   } catch(e) { state.ready=false; state.text=`Inference failed; click Load to recover: ${String(e)}`; reply({text:'',error:state.text}); }
   finally {state.busy=false;}
  })(); return true;
 }
});
