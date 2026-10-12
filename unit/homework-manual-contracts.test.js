const test=require('node:test');const assert=require('node:assert/strict');
const {manualFixture,manualSnapshot,manualStage,manualCompoundBlock}=require('../lib/homework-manual-contracts');
const f={studentId:1,reviewerId:9,homeworkId:2,chapterHomeworkId:3,title:'QA-AT own',runId:'QA-AT own',origin:'https://qa.test.nn99.ru',source:'approved requirement/date',exclusive:true,chapterLinked:true,lessonPath:'/lesson/4',blockSelector:'[data-block-id="5"]',blockId:'5',initialBlockText:'Назначено',completedBlockText:'Проверено',blockSource:'confirmed UI labels/date',openLabel:'Открыть',durationType:'estimated',questionType:'text',questionsCount:1,fileRequired:true,resultMode:'after_review',fresh:true,roleSource:'reviewed role binding',resultText:'QA result',rework:{mode:'new-attempt',source:'approved lifecycle model'}};
const file={id:7,mimeType:'application/pdf',sha256:'synthetic-sha'};
function snapshot() {
 const common={origin:f.origin,studentId:1,homeworkId:2,chapterHomeworkId:3};
 const history=[{id:10,number:2,status:'on_review'}];
 return {probeId:'fresh-probe',server:{...common,reviewerId:9,reviewerCanReview:true,currentAttemptId:null,attempts:[{...history[0],attachments:[file]}],history},ui:{...common,visible:true,attemptId:10,attemptNumber:2,status:'on_review',history:structuredClone(history),attachmentIds:[7]}};
}
test('manual fixture rejects foreign ownership, automatic grading and unapproved rework assumptions',()=>{
 assert.equal(manualFixture(f,f.origin,f.runId),f);
 for(const patch of [{runId:'old'},{title:'QA-AT old'},{reviewerId:0},{fresh:false},{fileRequired:false},{resultMode:'after_submit'},{rework:{mode:'new-attempt',source:''}}]) assert.throws(()=>manualFixture({...f,...patch},f.origin,f.runId));
});
test('manual snapshots reject stale probe, wrong result attempt, hidden UI and mismatched actual history numbers',()=>{
 assert.equal(manualSnapshot(snapshot(),f,'fresh-probe').ui.attemptId,10);
 const stale=snapshot();assert.throws(()=>manualSnapshot(stale,f,'next-probe'),/stale/);
 for(const mutate of [s=>s.ui.attemptId=99,s=>s.ui.visible=false,s=>s.ui.history[0].number=1,s=>s.ui.homeworkId=99,s=>s.server.reviewerCanReview=false]) {
  const s=snapshot();mutate(s);assert.throws(()=>manualSnapshot(s,f,'fresh-probe'));
 }
 const extra=snapshot();extra.server.attempts.push({id:11,number:3,status:'in_progress',attachments:[]});assert.throws(()=>manualSnapshot(extra,f,'fresh-probe'),/extra active/);
});
test('manual stages reject missing/changed PDF, lost older attachment and invisible published result',()=>{
 const expectStage={id:10,status:'on_review',count:1,pdfSha256:file.sha256};
 manualStage(snapshot(),expectStage);
 const missing=snapshot();missing.server.attempts[0].attachments=[];assert.throws(()=>manualStage(missing,expectStage),/PDF/);
 const wrong=snapshot();wrong.server.attempts[0].attachments=[{...file,sha256:'changed'}];assert.throws(()=>manualStage(wrong,expectStage),/PDF/);
 const old={id:4,number:1,attachments:[{id:5,sha256:'old'}]};const rework=snapshot();rework.server.attempts.push({...old,status:'completed',attachments:[]});
 assert.throws(()=>manualStage(rework,{...expectStage,count:2,preserved:[old]}),/old attachment/);
 const result=snapshot();result.server.attempts[0].status=result.ui.status='reviewed';result.ui.resultText='';
 assert.throws(()=>manualStage(result,{id:10,status:'reviewed',count:1,resultText:'QA result'}),/visibly/);
});
test('rework allows cloned PDF ID on a new attempt but retains the old owned file',()=>{
 const s=snapshot(),original={id:4,number:1,status:'completed',attachments:[{...file,id:5}]};
 s.server.attempts.unshift(original);s.server.attempts[1].attachments=[{...file,id:8}];
 s.server.history.unshift({id:4,number:1,status:'completed'});s.ui.history=structuredClone(s.server.history);s.ui.attachmentIds=[8];
 manualSnapshot(s,f,'fresh-probe');
 manualStage(s,{id:10,status:'on_review',count:2,pdfSha256:file.sha256,preserved:[original]});
});

test('compound block rejects hidden/wrong homework/source/status/text on open and return',()=>{
 const s=snapshot();s.ui.compoundBlock={homeworkId:2,sourceId:'5',visible:true,status:'assigned',text:f.initialBlockText};
 manualCompoundBlock(s,f,'assigned',f.initialBlockText);
 for(const patch of [{visible:false},{homeworkId:99},{sourceId:'other'},{status:'reviewed'},{text:'unrelated'}]) {
  const bad=structuredClone(s);Object.assign(bad.ui.compoundBlock,patch);assert.throws(()=>manualCompoundBlock(bad,f,'assigned',f.initialBlockText));
 }
 s.ui.compoundBlock.status='reviewed';s.ui.compoundBlock.text=f.completedBlockText;
 manualCompoundBlock(s,f,'reviewed',f.completedBlockText);
 const hidden=structuredClone(s);hidden.ui.compoundBlock.visible=false;assert.throws(()=>manualCompoundBlock(hidden,f,'reviewed',f.completedBlockText));
});
