import {execFileSync} from 'node:child_process';import {mkdir,rm} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});await rm('artifacts/weasley-0.1.0.zip',{force:true});execFileSync('zip',['-q','-r','../artifacts/weasley-0.1.0.zip','.'],{cwd:'dist',stdio:'inherit'});console.log('artifacts/weasley-0.1.0.zip');
