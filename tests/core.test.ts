import test from 'node:test';import assert from 'node:assert/strict';import {allowed,defaults,clean,nextWord,matchPattern} from '../src/shared.ts';
test('allowlist matches exact origin and scheme',()=>{const s={...defaults,sites:['https://example.com']};assert.ok(allowed('https://example.com/path',s));for(const url of ['http://example.com','https://example.com.evil.test','https://sub.example.com','bad'])assert.equal(allowed(url,s),false);assert.equal(allowed('https://example.com',{...s,enabled:false}),false);});
test('suppress conversational or markup output',()=>{for(const text of ['Sure, here is text','<think>hi','line\nanswer'])assert.equal(clean(text,'Hello '),'');assert.equal(clean(' there friend','Hello '),'there friend');assert.equal(clean(' world','Hello'),' world');});
test('partial acceptance preserves whitespace',()=>{assert.equal(nextWord(' a good idea'),' a ');assert.equal(nextWord('hello world'),'hello ');});

test("Chrome permissions omit ports while origin consent retains them",()=>{assert.equal(matchPattern("http://localhost:4173"),"http://localhost/*");assert.equal(allowed("http://localhost:4174",{...defaults,sites:["http://localhost:4173"]}),false);});
