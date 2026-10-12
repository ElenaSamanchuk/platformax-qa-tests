// Opt-in contract-first WEB runner. Concrete UI/API operations belong to a reviewed local adapter.
const fs=require('node:fs');const path=require('node:path');const {randomUUID,createHash}=require('node:crypto');
const {test,expect}=require('@playwright/test');
const {configuration}=require('../lib/configuration');const {acquire,release}=require('../lib/coordination');
const {manualFixture,manualSnapshot,manualStage,manualCompoundBlock}=require('../lib/homework-manual-contracts');
const base=configuration().baseURL;
const approved=process.env.HW_MANUAL_APPROVED==='1' && !!process.env.HW_MANUAL_ADAPTER_FILE;
let lock,cleanupBlocked=false;
test.use({video:'off'});
test.describe('HW-4 owned manual/rework',()=>{
  test.skip(!approved,'BLOCKED coverage: reviewed manual adapter and agreed mutation slot required');
  test.beforeAll(()=>{lock=acquire(process.env,'homework-manual');});
  test.beforeEach(()=>{if(cleanupBlocked) throw Error('BLOCKED: previous cleanup failed; disk lock retained');});
  test.afterAll(()=>release(lock));
  for(const profile of [{name:'desktop',width:1440,height:900},{name:'mobile-375',width:375,height:812},{name:'mobile-390',width:390,height:844}]) {
    test(`HW-4 ${profile.name}: PDF → submit → teacher rework → resubmit → published result`,async({browser},testInfo)=>{
      if(!path.isAbsolute(process.env.HW_MANUAL_ADAPTER_FILE)) throw Error('BLOCKED: absolute local adapter path required');
      const adapter=require(process.env.HW_MANUAL_ADAPTER_FILE);
      for(const method of ['provision','act','snapshot','cleanup','verifyCleanup']) if(typeof adapter[method]!=='function') throw Error(`BLOCKED: adapter.${method} required`);
      if(adapter.validation?.approved!==true || !adapter.validation.source?.trim() || !adapter.validation.capabilities?.includes('manual-web')) throw Error('BLOCKED: reviewed adapter validation/source/manual-web capability required');
      const runId=`QA-AT manual-${randomUUID()}`;
      const options={browser,baseURL:base,runId,testInfo,profile:{...profile,isMobile:profile.name!=='desktop',hasTouch:profile.name!=='desktop',deviceScaleFactor:profile.name==='desktop'?1:3},video:'off'};
      let f,cleanupVerified=false;
      try {
        f=await adapter.provision(options); manualFixture(f,base,runId);
        const journal=JSON.parse(fs.readFileSync(f.journalPath,'utf8'));
        expect(journal.runId).toBe(runId);expect(journal.origin).toBe(base);
        expect(journal.ownedIds).toMatchObject({homeworkId:f.homeworkId,chapterHomeworkId:f.chapterHomeworkId});
        expect(journal.baseline,'provision journal must retain restoration baseline').toBeTruthy();
        const args={...options,fixture:f};
        async function snapshot(stage) {
          const requestedAt=Date.now();const probeId=randomUUID();const s=manualSnapshot(await adapter.snapshot({...args,stage,probeId}),f,probeId);
          if(!s.capture || !path.isAbsolute(s.capture)) throw Error('BLOCKED: original stage PNG path required');
          if(!path.basename(s.capture).includes(probeId)) throw Error('BLOCKED: PNG filename must contain this unique probe ID');
          const capturedAt=fs.statSync(s.capture).mtimeMs;
          if(capturedAt<requestedAt-2000 || capturedAt>Date.now()+2000) throw Error('BLOCKED: stage PNG timestamp outside capture window/tolerance');
          const png=fs.readFileSync(s.capture);
          if(png.length<24 || png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || !png.readUInt32BE(16) || !png.readUInt32BE(20)) throw Error('BLOCKED: nonempty original PNG evidence required');
          await testInfo.attach(stage,{path:s.capture,contentType:'image/png'});
          return s;
        }
        const initial=await snapshot('fresh');expect(initial.server.attempts).toEqual([]);expect(initial.server.currentAttemptId).toBeNull();
        await adapter.act({...args,action:'openCompound'});
        const opened=await snapshot('compound');expect(opened.server).toEqual(initial.server);
        manualCompoundBlock(opened,f,'assigned',f.initialBlockText);
        await adapter.act({...args,action:'start'});
        const started=await snapshot('started');const id=started.ui.attemptId;
        manualStage(started,{id,status:'in_progress',count:1});
        // Valid, dependency-free synthetic PDF; no user document is read or uploaded.
        const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
        let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);
        pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
        const pdfPath=testInfo.outputPath('qa-manual.pdf');fs.writeFileSync(pdfPath,pdf);
        const pdfSha256=createHash('sha256').update(pdf).digest('hex');
        await adapter.act({...args,action:'attachSyntheticPDF',pdfPath,pdfSha256,text:'QA-AT: первоначальный синтетический ответ'});
        manualStage(await snapshot('attached'),{id,status:'in_progress',count:1,pdfSha256});
        await adapter.act({...args,action:'submit'});
        const submitted=await snapshot('submitted');const original=structuredClone(manualStage(submitted,{id,status:'on_review',count:1,pdfSha256}));
        const feedback='QA-AT: уточните ответ и отправьте повторно';
        await adapter.act({...args,action:'teacherReturn',attemptId:id,feedback});
        manualStage(await snapshot('rework'),{id,status:'needs_info',count:1,pdfSha256,feedback});
        await adapter.act({...args,action:'resubmit',attemptId:id,pdfPath,pdfSha256,text:'QA-AT: уточнённый синтетический ответ'});
        const resubmitted=await snapshot('resubmitted');const finalId=resubmitted.ui.attemptId;
        if(f.rework.mode==='same-attempt') expect(finalId).toBe(id); else expect(finalId).not.toBe(id);
        const count=f.rework.mode==='same-attempt'?1:2;
        manualStage(resubmitted,{id:finalId,status:'on_review',count,pdfSha256,preserved:[original]});
        await adapter.act({...args,action:'teacherPublish',attemptId:finalId});
        const published=await snapshot('published');manualStage(published,{id:finalId,status:'reviewed',count,pdfSha256,preserved:[original],resultText:f.resultText});
        await adapter.act({...args,action:'openCompound'});
        const returned=await snapshot('return-compound');expect(returned.server).toEqual(published.server);
        manualCompoundBlock(returned,f,'reviewed',f.completedBlockText);
      } finally {
        try {await adapter.cleanup({...options,fixture:f});cleanupVerified=await adapter.verifyCleanup({...options,fixture:f});expect(cleanupVerified,'independent server verification of owned fixture cleanup').toBe(true);}
        finally {if(!cleanupVerified) {cleanupBlocked=true;lock=null;await testInfo.attach('cleanup-blocked',{body:JSON.stringify({runId,homeworkId:f?.homeworkId,chapterHomeworkId:f?.chapterHomeworkId}),contentType:'application/json'});}}
      }
    });
  }
});
