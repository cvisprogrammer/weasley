import test from 'node:test';import assert from 'node:assert/strict';import {CloudDecoder} from '../src/brii/cloud-client';
test('cloud client retains the current draft in the bounded local bridge message',async()=>{
 let request:any;const client=new CloudDecoder(async message=>{request=message;return {corrected:'I have to try',model:'fixture',strategy:'raw-only-baseline'};});
 const result=await client.decode('ihvatotry','','I have to try');assert.equal(request.text,'ihvatotry');assert.equal(request.current,'I have to try');assert.equal(request.context,'');assert.equal(result.corrected,'I have to try');
});
test('client rejects the previous draft-aware bridge strategy',async()=>{
 const client=new CloudDecoder(async()=>({corrected:'old response'}));await assert.rejects(client.decode('raw','','draft'),/Restart the updated Brii bridge/);
});
