import {execFileSync} from 'node:child_process';import {mkdir,rm} from 'node:fs/promises';
const files=['manifest.json','cloud-config.json','cloud-server.mjs','flow-background.js','flow-popup.html','flow-popup.js','flow-content.js','cloud-playground.html','cloud-playground.js','inline-playground.html','inline-playground.js','style.css'];
await mkdir('artifacts',{recursive:true});await rm('artifacts/brii-inline-0.6.6.zip',{force:true});execFileSync('zip',['-q','../artifacts/brii-inline-0.6.6.zip',...files],{cwd:'dist',stdio:'inherit'});console.log('artifacts/brii-inline-0.6.6.zip');
