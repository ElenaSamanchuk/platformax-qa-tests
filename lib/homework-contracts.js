// Local contracts only; no default accounts, IDs, routes or private fixture contents.
const { validateBase } = require('./contracts');
function positive(n) { return Number.isSafeInteger(n) && n > 0; }
function localPath(value, base) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw Error('BLOCKED: same-origin absolute path required');
  const u = new URL(value, base);
  if (u.origin !== base || u.username || u.password || u.hash) throw Error('BLOCKED: invalid fixture path');
  return value;
}
function fixture(f, base) {
  validateBase(base);
  if (!f || !positive(f.studentId) || !positive(f.homeworkId) || !positive(f.chapterHomeworkId)) throw Error('BLOCKED: explicit agreed fixture IDs required');
  if (!f.source?.trim() || f.exclusive !== true || f.chapterLinked !== true) throw Error('BLOCKED: source, exclusive slot and chapter-linked compound fixture required');
  if (!f.title?.startsWith('QA-AT ') || !f.blockSelector?.trim() || !f.openLabel?.trim()) throw Error('BLOCKED: owned QA-AT title and verified lesson block selector/open label required');
  localPath(f.lessonPath, base);
  if (f.durationType === 'timer') throw Error('BLOCKED: use untimed fixture; reads can reconcile expired attempts');
  if (!f.durationType) throw Error('BLOCKED: explicit untimed duration type required');
  return f;
}
function attemptState(p) {
  if (!Array.isArray(p.attemptsHistory) || !Number.isInteger(p.attemptsLeft)) throw Error('BLOCKED: homework info schema changed');
  return {
    attemptsLeft: p.attemptsLeft,
    current: p.currentAttempt ? {id:p.currentAttempt.id,status:p.currentAttempt.status,started:p.currentAttempt.started_at} : null,
    history: p.attemptsHistory.map(a=>({id:a.id,status:a.status,started:a.started_at,submitted:a.submitted_at,reviewed:a.reviewed_at})).sort((a,b)=>a.id-b.id),
  };
}
function historical(p, id) {
  if (!positive(id)) throw Error('BLOCKED: explicit historical attempt required');
  const a=p.attemptsHistory.find(a=>a.id===id);
  if (!a || a.status!=='reviewed' || id===Math.max(...p.attemptsHistory.map(a=>a.id))) throw Error('BLOCKED: choose an earlier reviewed attempt, not the latest');
  return a;
}
module.exports={fixture,attemptState,historical,localPath};
