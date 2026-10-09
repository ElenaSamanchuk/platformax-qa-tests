const fs=require('fs');
const path=require('path');
const {test,expect}=require('@playwright/test');
const {configuration}=require('../lib/configuration');
const {fixture,attemptState,historical}=require('../lib/homework-contracts');
const {acquire,release}=require('../lib/coordination');
const {readOnlyContext,failureScreenshot}=require('./fixtures/read-only');
const {buildEvidence}=require('./fixtures/build-evidence');
const {info,state,activate,openBlock,identity}=require('./fixtures/homework');
const config=configuration(); const base=config.baseURL;
let lock, cleanupBlocked=false;
test.beforeEach(()=>{if(cleanupBlocked) throw Error("BLOCKED: prior cleanup failed; disk lock retained, do not continue integration");});
test.beforeAll(()=>{lock=acquire(process.env,'homework');});
test.afterAll(()=>{release(lock);});
const profiles=[[1440,900,'desktop'],[375,812,'mobile-375'],[390,844,'mobile-390']];
for(const [width,height,name] of profiles) test.describe(`HW-core ${name}`,()=> {
  const mobile=name!=='desktop';
  test.use({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1});
  async function readonly(browser,testInfo,fn,history=false) {
    const manifest=history ? process.env.HW_HISTORY_FIXTURE_FILE : process.env.HW_FIXTURE_FILE;
    test.skip(!manifest || !process.env.HW_STORAGE_STATE,'BLOCKED coverage: private owned fixture manifest/session missing');
    const f=fixture(JSON.parse(fs.readFileSync(manifest,'utf8')),base);
    if (!f.openLabel?.trim()) throw Error('BLOCKED: verified embedded block open label required');
    const context=await readOnlyContext(browser,{baseURL:base,storageState:process.env.HW_STORAGE_STATE,viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,locale:'ru-RU'});
    try {await fn(context,f);}
    finally {await failureScreenshot(context,testInfo);await context.close();}
  }
  test('HW-1 compound lesson: homework block opens its own information page',async({browser},testInfo)=>readonly(browser,testInfo,async(context,f)=>{
    const before=await state(context,base,f); const page=await context.newPage();
    await openBlock(page,base,f); await buildEvidence(page,testInfo);
    await expect(page.getByText(f.title,{exact:true}).first()).toBeVisible();
    expect(await state(context,base,f),'opening embedded homework must not consume an attempt').toEqual(before);
  }));
  test('HW-2 information/reload: no implicit attempt; explicit Start is visible',async({browser},testInfo)=>readonly(browser,testInfo,async(context,f)=>{
    const page=await context.newPage();const p=await info(page,base,f);
    if (p.currentAttempt || p.attemptsHistory.length) throw Error('BLOCKED: HW-2 requires a fresh untimed fixture with no previous attempts');
    const before=attemptState(p);
    await expect(page.getByRole('button',{name:'Начать задание',exact:true})).toBeVisible();
    await page.reload(); await buildEvidence(page,testInfo);
    expect(attemptState(await identity(page,f))).toEqual(before);
    expect(await state(context,base,f),'fresh server state after reading/reload').toEqual(before);
  }));
  test('H17 history: selected earlier result opens that attempt, not the latest',async({browser},testInfo)=>readonly(browser,testInfo,async(context,f)=>{
    test.skip(!f.historyAttemptId,'BLOCKED coverage: separate historical fixture required');
    const page=await context.newPage(); const p=await info(page,base,f);
    const old=historical(p,f.historyAttemptId); const before=attemptState(p);
    const latest=p.attemptsHistory.reduce((a,b)=>a.id>b.id?a:b);
    if(latest.status!=='on_review') throw Error('BLOCKED: H17 fixture needs a newer attempt pending review');
    const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:String(old.id),exact:true})});
    await expect(row).toHaveCount(1);
    await activate(page,row.getByRole('link',{name:'Перейти к результатам',exact:true}).or(row.getByRole('button',{name:'Перейти к результатам',exact:true})));
    await page.waitForURL(u=>u.origin===base && u.pathname===`/homework/${f.chapterHomeworkId}/results/${old.id}`);
    const result=await identity(page,f); expect(result.attempt?.id,'server result must belong to selected historical attempt').toBe(old.id);
    if(!f.historyResultText?.trim()) throw Error('BLOCKED: expected visible historical result text required');
    await expect(page.getByText(f.historyResultText,{exact:true}).first()).toBeVisible();
    await buildEvidence(page,testInfo); expect(await state(context,base,f)).toEqual(before);
  },true));
  test('HW-3 full owned lifecycle: explicit start → submit → result → return to lesson',async({browser},testInfo)=>{
    test.skip(process.env.HW_LIFECYCLE_APPROVED!=='1' || !process.env.HW_ADAPTER_FILE,'BLOCKED coverage: provision/cleanup adapter and mutation slot required');
    const adapter=require(path.resolve(process.env.HW_ADAPTER_FILE));
    for(const method of ['provision','cleanup','verifyCleanup']) if(typeof adapter[method]!=='function') throw Error('BLOCKED: adapter must implement provision, cleanup, verifyCleanup');
    // Adapter owns an isolated fixture per test and cleanup even when provisioning fails.
    const runId=`QA-AT ${Date.now()}-${process.pid}-${name}`;
    let context, f, cleanupVerified=false;
    try {
      f=fixture(await adapter.provision({browser,baseURL:base,runId,testInfo}),base);
      if(!process.env.HW_STORAGE_STATE) throw Error('BLOCKED: private student session required');
      if(f.title!==runId || f.resultMode!=='after_submit' || !f.optionText || !f.returnLabel || !f.resultText || !f.completedBlockText) throw Error('BLOCKED: fresh single-choice auto-graded fixture contract required');
      context=await browser.newContext({baseURL:base,storageState:process.env.HW_STORAGE_STATE,viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,locale:'ru-RU'});
      const page=await context.newPage();const initial=await info(page,base,f);
      expect(initial.attemptsHistory).toHaveLength(0);expect(initial.currentAttempt).toBeNull();
      expect(initial.homework.result_display_mode).toBe('after_submit');expect(initial.homework.questions_count).toBe(1);
      const before=attemptState(initial); await openBlock(page,base,f);expect(await state(context,base,f)).toEqual(before);
      await activate(page,page.getByRole('button',{name:'Начать задание',exact:true}));
      await page.waitForURL(u=>u.origin===base && u.pathname===`/homework/${f.chapterHomeworkId}/attempt`);
      const started=await identity(page,f);expect(started.attempt?.id).toBeGreaterThan(0);
      const attemptId=started.attempt.id;const active=await state(context,base,f);
      expect(active.current?.id).toBe(attemptId);expect(active.current?.status).toBe('in_progress');
      await activate(page,page.locator('div.group').filter({has:page.getByText(f.optionText,{exact:true})}));
      await activate(page,page.getByRole('button',{name:/^Завершить задание$|^Завершить$/}));
      await expect(page.getByText('Сдать задание?',{exact:false}).first()).toBeVisible();
      await activate(page,page.getByRole('button',{name:'Сдать',exact:true}));
      await page.waitForURL(u=>u.origin===base && u.pathname===`/homework/${f.chapterHomeworkId}/results/${attemptId}`);
      expect((await identity(page,f)).attempt?.id).toBe(attemptId);
      await expect(page.getByText(f.resultText,{exact:true}).first()).toBeVisible();
      const finished=await state(context,base,f);expect(finished.current).toBeNull();expect(finished.history).toHaveLength(1);expect(finished.history[0].id).toBe(attemptId);expect(finished.history[0].status).toBe('reviewed');
      await activate(page,page.getByRole('link',{name:f.returnLabel,exact:true}).or(page.getByRole('button',{name:f.returnLabel,exact:true})));
      await page.waitForURL(u=>u.origin===base && u.pathname===new URL(f.lessonPath,base).pathname);
      const block=page.locator(f.blockSelector);await expect(block).toContainText(f.completedBlockText);
      await buildEvidence(page,testInfo);expect(await state(context,base,f),'return must not create a new attempt').toEqual(finished);
    } finally {
      if(context) {await failureScreenshot(context,testInfo);await context.close();}
      try {await adapter.cleanup({browser,baseURL:base,runId,fixture:f,testInfo});cleanupVerified=await adapter.verifyCleanup({browser,baseURL:base,runId,fixture:f,testInfo});expect(cleanupVerified,'server verification of owned fixture cleanup').toBe(true);}
      finally {if(!cleanupVerified) {cleanupBlocked=true;await testInfo.attach('cleanup-blocked',{body:JSON.stringify({runId,homeworkId:f?.homeworkId,chapterHomeworkId:f?.chapterHomeworkId}),contentType:'application/json'});lock=null; /* keep disk lock for investigation */}}
    }
  });
});
