const { expect }=require('@playwright/test');
const { attemptState }=require('../../lib/homework-contracts');
// Live Vue props after client navigation; data-page alone can be stale.
async function facts(page) {
  await page.waitForSelector('#app');
  return page.evaluate(()=> {
    const app=document.getElementById('app');
    const p=app?.__vue_app__?.config?.globalProperties?.$page?.props || JSON.parse(app.dataset.page).props;
    const hw=p.homework || p.chapterHomework?.homework;
    return {userId:p.auth?.user?.id, core:window.isPlatforma, homework:hw ? {id:hw.id,title:hw.title,duration_type:hw.duration_type,result_display_mode:hw.result_display_mode,questions_count:hw.questions_count}:null,
      chapterHomeworkId:p.chapterHomework?.id, currentAttempt:p.currentAttempt ? {id:p.currentAttempt.id,status:p.currentAttempt.status,started_at:p.currentAttempt.started_at}:null,
      attemptsLeft:p.attemptsLeft, attemptsHistory:p.attemptsHistory?.map(a=>({id:a.id,status:a.status,started_at:a.started_at,submitted_at:a.submitted_at,reviewed_at:a.reviewed_at})),
      attempt:p.attempt ? {id:p.attempt.id,status:p.attempt.status}:null};
  });
}
async function identity(page,f) {
  const p=await facts(page);
  expect(p.core===true && p.userId===f.studentId,'agreed Platforma core student identity; do not print actual identity').toBe(true);
  return p;
}
async function info(page,base,f) {
  const r=await page.goto(base+'/homework/'+f.chapterHomeworkId);
  expect(r.status(),'homework info response').toBe(200);
  const p=await identity(page,f);
  expect(p.chapterHomeworkId).toBe(f.chapterHomeworkId);
  expect(p.homework?.id).toBe(f.homeworkId);
  expect(p.homework?.title).toBe(f.title);
  expect(p.homework?.duration_type,'fixture must be untimed').toBe(f.durationType);
  return p;
}
async function state(context,base,f) {
  const probe=await context.newPage();
  try {return attemptState(await info(probe,base,f));} finally {await probe.close();}
}
async function activate(page,locator) {
  if(await page.evaluate(()=>navigator.maxTouchPoints>0)) await locator.tap(); else await locator.click();
}
async function openBlock(page,base,f) {
  const r=await page.goto(base+f.lessonPath); expect(r.status()).toBe(200);
  await identity(page,f);
  const block=page.locator(f.blockSelector);
  await expect(block,'actual embedded homework block; do not substitute a schedule/chapter card').toHaveCount(1);
  await expect(block).toContainText(f.title); await expect(block).toBeVisible();
  const link=block.getByRole('link').filter({hasText:f.openLabel});
  const button=block.getByRole('button',{name:f.openLabel,exact:true});
  await activate(page,link.or(button));
  await page.waitForURL(u=>u.origin===base && u.pathname===`/homework/${f.chapterHomeworkId}`);
  return identity(page,f);
}
module.exports={facts,identity,info,state,activate,openBlock};
