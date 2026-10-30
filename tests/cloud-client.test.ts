import test from 'node:test';import assert from 'node:assert/strict';import {CloudDecoder} from '../src/brii/cloud-client';
test('cloud client sends the exact current draft alongside raw typing',async()=>{
 let request:any;const client=new CloudDecoder(async message=>{request=message;return {corrected:'I have to try',model:'fixture',strategy:'raw-current-v1'};});
 const result=await client.decode('ihvatotry','','I have to try');assert.equal(request.text,'ihvatotry');assert.equal(request.current,'I have to try');assert.equal(request.context,'');assert.equal(result.corrected,'I have to try');
});
test('old bridge responses cannot silently bypass the current-draft experiment',async()=>{
 const client=new CloudDecoder(async()=>({corrected:'old response'}));await assert.rejects(client.decode('raw','','draft'),/Restart the updated Brii bridge/);
});
