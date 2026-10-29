// Pure owned-manual contracts. No routes, sessions, browser or private fixture defaults.
const assert = require('node:assert/strict');
const { fixture } = require('./homework-contracts');
const positive = n => Number.isSafeInteger(n) && n > 0;
const rows = list => [...list].sort((a,b)=>a.id-b.id);
function manualFixture(f, base, runId) {
  fixture(f, base);
  assert.equal(f.title, runId, 'BLOCKED: fresh owned title must equal this run');
  assert.equal(f.runId, runId, 'BLOCKED: ownership run mismatch');
  assert.equal(f.origin, base, 'BLOCKED: fixture origin mismatch');
  assert.equal(f.questionType, 'text', 'BLOCKED: one manual text question required');
  assert.equal(f.questionsCount, 1); assert.equal(f.fileRequired, true);
  assert.equal(f.resultMode, 'after_review'); assert.equal(f.fresh, true);
  assert.ok(positive(f.reviewerId), 'BLOCKED: verified reviewer identity required');
  assert.ok(f.roleSource?.trim() && f.resultText?.trim(), 'BLOCKED: approved roles/result text required');
  assert.ok(typeof f.blockId==='string' && f.blockId.trim(), 'BLOCKED: verified compound source block ID required');
  assert.ok(f.initialBlockText?.trim() && f.completedBlockText?.trim() && f.blockSource?.trim(), 'BLOCKED: confirmed initial/completed block labels and source required');
  assert.ok(['same-attempt','new-attempt'].includes(f.rework?.mode) && f.rework.source?.trim(), 'BLOCKED: explicit rework model/source required; numbering is not guessed');
  return f;
}
function manualSnapshot(s, f, probeId) {
  assert.equal(s.probeId, probeId, 'stale snapshot/probe');
  const server=s.server, ui=s.ui;
  assert.ok(server && ui, 'fresh independent server and visible UI facts required');
  for (const facts of [server,ui]) {
    assert.equal(facts.origin, f.origin, 'wrong origin');
    assert.equal(facts.studentId, f.studentId, 'wrong student');
    assert.equal(facts.homeworkId, f.homeworkId, 'wrong homework');
    assert.equal(facts.chapterHomeworkId, f.chapterHomeworkId, 'wrong chapter fixture');
  }
  assert.equal(server.reviewerId, f.reviewerId, 'wrong reviewer');
  assert.equal(server.reviewerCanReview, true, 'review permission not verified');
  assert.equal(ui.visible, true, 'empty/hidden UI cannot pass');
  assert.ok(Array.isArray(server.attempts) && Array.isArray(server.history) && Array.isArray(ui.history));
  assert.equal(new Set(server.attempts.map(a=>a.id)).size,server.attempts.length,'duplicate attempts');
  for(const a of server.attempts) {
    assert.ok(positive(a.id) && positive(a.number) && typeof a.status==='string');
    assert.ok(Array.isArray(a.attachments), 'attachment schema required');
  }
  for(const h of server.history) {
    const a=server.attempts.find(a=>a.id===h.id);
    assert.ok(a && a.number===h.number && a.status===h.status, 'history points to wrong actual attempt');
  }
  assert.deepEqual(rows(ui.history),rows(server.history),'visible history/number differs from actual server IDs');
  assert.equal(server.attempts.filter(a=>a.status==='in_progress').length,server.currentAttemptId==null?0:1,'extra active attempt');
  if(server.currentAttemptId!=null) assert.ok(server.attempts.some(a=>a.id===server.currentAttemptId && a.status==='in_progress'),'invalid current attempt');
  assert.ok(Array.isArray(ui.attachmentIds), 'visible attachment IDs required');
  if(ui.attemptId!=null) {
    const a=server.attempts.find(a=>a.id===ui.attemptId);
    assert.ok(a && ui.attemptNumber===a.number && ui.status===a.status,'stale/wrong visible attempt');
    assert.deepEqual([...ui.attachmentIds].sort(),a.attachments.map(x=>x.id).sort(),'visible attachment mismatch');
  }
  return s;
}
function manualStage(s, {id,status,count,pdfSha256,preserved,feedback,resultText}) {
  const server=s.server, ui=s.ui;
  assert.equal(server.attempts.length,count,'implicit or extra attempt');
  const a=server.attempts.find(a=>a.id===id);
  assert.ok(a && a.status===status,'wrong server lifecycle state');
  assert.equal(ui.attemptId,id); assert.equal(ui.status,status);
  if(status==='in_progress') assert.equal(server.currentAttemptId,id);
  else assert.equal(server.currentAttemptId,null,'submission/review must not leave an active attempt');
  if(pdfSha256) assert.ok(a.attachments.some(x=>positive(x.id) && x.mimeType==='application/pdf' && x.sha256===pdfSha256),'required synthetic PDF missing/changed');
  for(const old of preserved||[]) {
    const retained=server.attempts.find(x=>x.id===old.id);
    assert.ok(retained && retained.number===old.number,'old actual attempt/number lost');
    for(const file of old.attachments) assert.ok(retained.attachments.some(x=>x.id===file.id && x.sha256===file.sha256),'old attachment lost on rework');
  }
  if(feedback) {assert.equal(a.feedback,feedback);assert.equal(ui.feedback,feedback,'review feedback not visible');}
  if(resultText) assert.equal(ui.resultText,resultText,'review result not visibly rendered');
  return a;
}
function manualCompoundBlock(s, f, status, text) {
  const block=s.ui.compoundBlock;
  assert.ok(block && block.visible===true, 'own compound block must be visibly rendered');
  assert.equal(block.homeworkId,f.homeworkId,'wrong compound homework');
  assert.equal(block.sourceId,f.blockId,'wrong source block');
  assert.equal(block.status,status,'wrong compound status');
  assert.equal(block.text,text,'wrong visible compound status text');
  return block;
}
module.exports={manualFixture,manualSnapshot,manualStage,manualCompoundBlock};
