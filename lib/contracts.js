// Pure contracts: no browser, network or secrets.
function validateBase(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.test.nn99.ru') || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash)
    throw new Error('BASE_URL must be an HTTPS *.test.nn99.ru origin without credentials/path');
  return u.origin;
}
function recordingsReady(items, expected = 3) {
  return Array.isArray(items) && items.length === expected &&
    new Set(items.map(r => r.id)).size === expected && items.every(r =>
      r.id != null && r.status === 'ready' && r.playable === true);
}
async function restoreRooms(ids, ops) {
  const failures = [];
  for (const id of ids) {
    // Attempt both actions even if finish failed. Never swallow a failure.
    for (const action of ['finish', 'unpublish']) {
      try { const r = await ops[action](id); if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status); }
      catch (e) { failures.push({ id, action, error: e.message }); }
    }
    try {
      const r = await ops.read(id);
      if (r.status !== 'finished' || r.is_published !== false) throw new Error('not confirmed finished/unpublished');
    } catch (e) { failures.push({ id, action: 'verify', error: e.message }); }
  }
  return failures;
}
module.exports = { validateBase, recordingsReady, restoreRooms };
