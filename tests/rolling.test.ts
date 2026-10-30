import {test} from 'node:test';import assert from 'node:assert/strict';import {RollingDraft} from '../src/brii/rolling';
test('rolling reconstruction retains original keystrokes across guesses',()=>{
 const d=new RollingDraft();const first=d.segment('teh ',4)!;d.applied(first,'The');
 const second=d.segment('The cta ',8)!;assert.equal(second.raw,'teh cta');d.applied(second,'The cat');
 assert.equal(d.segment('The cat satt ',13)!.raw,'teh cta satt');
});
test('rolling window retires old words but keeps raw spelling for recent words',()=>{
 const d=new RollingDraft();const raw='teh one two three four five six seven eight nine ten eleven';const initial=d.segment(raw+' ',raw.length+1,true)!;const shown=raw.replace('teh','The');d.applied(initial,shown);
 const next=shown+' twelve ';const segment=d.segment(next,next.length)!;assert.equal(segment.raw,'one two three four five six seven eight nine ten eleven twelve');assert.equal(segment.start,4);
});
test('manual edit and undo protect existing text while new typing can be corrected',()=>{
 const d=new RollingDraft();d.protect('My deliberate spelling '.length);assert.equal(d.segment('My deliberate spelling ',23),undefined);
 const text='My deliberate spelling teh ';assert.equal(d.segment(text,text.length)!.raw,'teh');
});
test('sentence boundaries freeze previous sentences and pause can revisit whole current sentence',()=>{
 const d=new RollingDraft();const value='Done. one two three four five six seven eight nine ten eleven twelve thirteen ';
 assert.equal(d.segment(value,value.length)!.raw.startsWith('two '),true);assert.equal(d.segment(value,value.length,true)!.raw.startsWith('one '),true);
});
test('inserted spaces and punctuation do not replace the retained fused input',()=>{
 const d=new RollingDraft();const raw='ileftsomedog';const first=d.segment(raw+' ',raw.length+1)!;d.applied(first,'I left some dog.');
 const shown='I left some dog. ';assert.equal(d.segment(shown,shown.length,true)!.raw,raw);
});

test('a protected first letter never becomes context for the rest of a fused word',()=>{
 const d=new RollingDraft();d.protect(1);
 const fused='okletstryiagianseefititwroks ';
 assert.equal(d.segment(fused,fused.length),undefined);
 const manual=d.segment(fused,fused.length,true,true)!;assert.equal(manual.raw,fused.trim());assert.equal(manual.context,'');
 const next=fused+'teh ';const segment=d.segment(next,next.length)!;assert.equal(segment.raw,'teh');assert.equal(segment.context,fused);
});
