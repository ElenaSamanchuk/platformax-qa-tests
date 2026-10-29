// This fixture suite is intentionally narrower than the shared multi-brand suite.
function validatePopovichFitBase(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.hostname !== 'popovichfit.nn99.ru' || u.username || u.password ||
      u.port || u.pathname !== '/' || u.search || u.hash)
    throw new Error('BLOCKED: PopovichFit fixture requires its exact confirmed HTTPS test origin without credentials/path/port/query/hash');
  return u.origin;
}
module.exports = { validatePopovichFitBase };
