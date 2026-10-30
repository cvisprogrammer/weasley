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
test('protected edits constrain output without hiding eligible prefix from the request',()=>{
 const d=new RollingDraft();d.protect('My deliberate spelling '.length);
 const text='My deliberate spelling teh ',segment=d.segment(text,text.length)!;
 assert.equal(segment.raw,text.trim());assert.equal(segment.context,'');
 assert.equal(d.canApply(segment,'My deliberate spelling The'),true);
 assert.equal(d.canApply(segment,'My improved wording The'),false);
});
test('sentence boundaries freeze previous sentences and pause can revisit whole current sentence',()=>{
 const d=new RollingDraft();const value='Done. one two three four five six seven eight nine ten eleven twelve thirteen ';
 assert.equal(d.segment(value,value.length)!.raw.startsWith('two '),true);assert.equal(d.segment(value,value.length,true)!.raw.startsWith('one '),true);
});
test('inserted spaces and punctuation do not replace the retained fused input',()=>{
 const d=new RollingDraft();const raw='ileftsomedog';const first=d.segment(raw+' ',raw.length+1)!;d.applied(first,'I left some dog.');
 const shown='I left some dog. ';assert.equal(d.segment(shown,shown.length,true)!.raw,raw);
});

test('a protected first letter never becomes excluded context',()=>{
 const d=new RollingDraft();d.protect(1);const fused='okletstryiagianseefititwroks ';
 const segment=d.segment(fused,fused.length)!;assert.equal(segment.raw,fused.trim());assert.equal(segment.context,'');
 assert.equal(d.canApply(segment,'ok lets try again see if it works'),true);
 assert.equal(d.canApply(segment,'OK lets try again see if it works'),false);
});
test('backspacing unresolved typing does not protect or omit the garbled prefix',()=>{
 const d=new RollingDraft(),prefix='okwbuitshoudlinthisjsutwork imean';
 d.edited(prefix,prefix.slice(0,-1));d.edited(prefix.slice(0,-1),prefix);
 const value=prefix+" whaitisthappenignidon'tsunerstand ",segment=d.segment(value,value.length)!;
 assert.equal(segment.raw,value.trim());assert.equal(segment.context,'');assert.deepEqual(segment.protectedRanges,[]);
});
test('editing a decoded word protects that word and retains earlier raw typing',()=>{
 const d=new RollingDraft();const raw='teh cta ';d.applied(d.segment(raw,raw.length)!,'The cat');
 d.edited('The cat ','The dog ');const segment=d.segment('The dog smthng ',15)!;
 assert.equal(segment.raw,'teh dog smthng');assert.equal(segment.context,'');
 assert.equal(d.canApply(segment,'The dog something'),true);assert.equal(d.canApply(segment,'The cat something'),false);
 d.applied(segment,'The dog something');const next=d.segment('The dog something more ',23)!;
 assert.equal(d.canApply(next,'The cat something more'),false);
});

test('Undo at a reconstructed word boundary does not duplicate its original characters',()=>{
 const d=new RollingDraft();const raw='teh cta satt ';d.applied(d.segment(raw,raw.length)!,'The cat sat');
 d.edited('The cat sat ','The cat satt ',true);const value='The cat satt  teh ',segment=d.segment(value,value.length)!;
 assert.equal(segment.raw,'teh cta satt  teh');assert.equal(segment.context,'');
 assert.equal(d.canApply(segment,'The cat satt  The'),true);assert.equal(d.canApply(segment,'The cat sat  The'),false);
});
