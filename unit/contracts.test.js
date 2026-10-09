const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBase, recordingsReady, restoreRooms } = require('../lib/contracts');
test('only an exact test origin is permitted', () => {
  assert.equal(validateBase('https://qa.test.nn99.ru/'), 'https://qa.test.nn99.ru');
  for (const u of ['https://qa.nn99.ru','http://qa.test.nn99.ru','https://qa.test.nn99.ru.evil.example','https://user:pass@qa.test.nn99.ru','https://qa.test.nn99.ru/path','https://qa.test.nn99.ru?x=1']) assert.throws(() => validateBase(u));
});
const ready = [1,2,3].map(id => ({id, status:'ready', playable:true}));
test('empty, pending, missing, duplicate or non-playable recordings cannot pass', () => {
  assert.equal(recordingsReady(ready), true);
  for (const bad of [[], ready.slice(1), [...ready, ready[0]], [ready[0], ready[0], ready[2]], ready.map(r=>({...r,status:'processing'})), ready.map(r=>({...r,playable:false})), null]) assert.equal(recordingsReady(bad), false);
});
test('cleanup attempts all rooms and unpublish despite failed finish', async () => {
  const calls=[];
  const errors=await restoreRooms([12,13], {
    finish: async id => {calls.push(['finish',id]);return {status:id===12?500:200};},
    unpublish: async id => {calls.push(['unpublish',id]);return {status:200};},
    read: async id => ({status:'finished',is_published:false}),
  });
  assert.deepEqual(calls,[['finish',12],['unpublish',12],['finish',13],['unpublish',13]]);
  assert.deepEqual(errors,[{id:12,action:'finish',error:'HTTP 500'}]);
});
test('successful mutation responses do not substitute server verification', async () => {
  for (const room of [{status:'live',is_published:false},{status:'finished',is_published:true},{status:'finished'}]) {
    const errors=await restoreRooms([12],{finish:async()=>({status:200}),unpublish:async()=>({status:200}),read:async()=>room});
    assert.equal(errors[0].action,'verify');
  }
});
test('cleanup success requires explicit finished and unpublished', async()=> {
 assert.deepEqual(await restoreRooms([12],{finish:async()=>({status:200}),unpublish:async()=>({status:200}),read:async()=>({status:'finished',is_published:false})}),[]);
});
