const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { acquire, release } = require('../lib/coordination');
test('cooperative lock requires approval and preserves an existing owner', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(),'qa-coordination-'));
  const lock = path.join(parent,'data.lock');
  try {
    assert.throws(()=>acquire({QA_DATA_LOCK_DIR:lock},'referral'));
    const held=acquire({QA_RUN_APPROVED:'1',QA_DATA_LOCK_DIR:lock},'referral');
    const original=fs.readFileSync(path.join(lock,'owner.json'),'utf8');
    assert.throws(()=>acquire({QA_RUN_APPROVED:'1',QA_DATA_LOCK_DIR:lock},'live-rooms'));
    assert.equal(fs.readFileSync(path.join(lock,'owner.json'),'utf8'),original);
    release(held); assert.equal(fs.existsSync(lock),false);
  } finally { fs.rmSync(parent,{recursive:true,force:true}); }
});
