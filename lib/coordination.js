const fs = require('fs');
// A cooperative lock: callers must agree the slot before setting QA_RUN_APPROVED.
function acquire(env, suite) {
  if (env.QA_RUN_APPROVED !== '1' || !env.QA_DATA_LOCK_DIR)
    throw new Error('BLOCKED: agree a shared-session slot and data lock before integration');
  fs.mkdirSync(env.QA_DATA_LOCK_DIR); // EEXIST fails closed; do not remove another owner
  fs.writeFileSync(env.QA_DATA_LOCK_DIR + '/owner.json', JSON.stringify({ suite, pid: process.pid, started: new Date().toISOString() }));
  return env.QA_DATA_LOCK_DIR;
}
function release(lock) {
  if (!lock) return;
  fs.unlinkSync(lock + '/owner.json'); fs.rmdirSync(lock);
}
module.exports = { acquire, release };
