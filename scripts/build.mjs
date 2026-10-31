import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {mkdir, cp, writeFile, readFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prebuiltAppConfig} from '@mlc-ai/web-llm';
await mkdir('dist', {recursive:true});
await rm('dist/lab.js',{force:true});
await cp('public','dist',{recursive:true});
// Executable model libraries are packaged, never fetched by the installed extension.
const ids = ['0.8','2','4'].map(n=>`Qwen3.5-${n}B-q4f16_1-MLC`);
const records = prebuiltAppConfig.model_list.filter(m=>ids.includes(m.model_id));
if(records.length!==3) throw Error('Registry compatibility changed');
await mkdir('dist/models',{recursive:true});
let hashes={};
const expected=JSON.parse(await readFile('scripts/model-lock.json','utf8'));
for(const m of records) {
 const path=`dist/models/${m.model_id}.wasm`;
 let data;
 try { data=await readFile(path); } catch { data=execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','120',m.model_lib],{maxBuffer:32*1024*1024}); }
 if(data.subarray(0,4).toString('hex')!=='0061736d') throw Error('Invalid WASM');
 hashes[m.model_id]=createHash('sha256').update(data).digest('hex');
 if(expected[m.model_id]!==hashes[m.model_id]) throw Error('Model library checksum mismatch: '+m.model_id);
 await writeFile(path,data);
}
await writeFile('dist/model-integrity.json',JSON.stringify(hashes,null,2));
await writeFile('dist/registry.json',JSON.stringify(records,null,2));
for(const name of ['background','offscreen','worker','popup','benchmark','mail','brii','flow-background','flow-popup','cloud-playground','inline-playground']) await build({entryPoints:[`src/${name}.ts`],outfile:`dist/${name}.js`,bundle:true,format:'esm',target:'chrome120'});
await build({entryPoints:['src/content.ts'],outfile:'dist/content.js',bundle:true,format:'iife',target:'chrome120'});

await build({entryPoints:['src/gmail-badges.ts'],outfile:'dist/gmail-badges.js',bundle:true,format:'iife',target:'chrome120'});

await build({entryPoints:['src/flow-content.ts'],outfile:'dist/flow-content.js',bundle:true,format:'iife',target:'chrome120'});

await cp('scripts/cloud-server.mjs','dist/cloud-server.mjs');

await build({entryPoints:['src/decoder-content.ts'],outfile:'dist/decoder-content.js',bundle:true,format:'iife',target:'chrome120'});
