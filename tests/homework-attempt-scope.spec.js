// Requirement: Valeria 28.10.2026: one homework shares attempts inside a course;
// Ksenia 20.10.2026: another course starts that same homework independently.
const fs = require('fs');
const {test, expect} = require('@playwright/test');
const {configuration} = require('../lib/configuration');
const {acquire, release} = require('../lib/coordination');
const {readOnlyContext, failureScreenshot} = require('./fixtures/read-only');
const {buildEvidence} = require('./fixtures/build-evidence');
const {attemptState, localPath} = require('../lib/homework-contracts');

test.use({video:'off', trace:'off', screenshot:'off'});

async function withScope(browser, testInfo, fn) {
  const base = configuration().baseURL;
  const file = process.env.HW_SCOPE_FIXTURE_FILE;
  const state = process.env.HW_STORAGE_STATE;
  if (!file || !state || !fs.existsSync(file) || !fs.existsSync(state))
    throw Error('BLOCKED: private HW_SCOPE_FIXTURE_FILE and HW_STORAGE_STATE required');
  const f = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Number.isSafeInteger(f.studentId) || f.studentId < 1 || !f.source || f.exclusive !== true || f.owned !== true || !f.title?.startsWith('QA-'))
    throw Error('BLOCKED: confirmed owned QA fixture, requirement source and exclusive read slot required');
  for (const name of ['first','sameCourse','otherCourse']) {
    const e = f[name];
    if (!e || ![e.placementId,e.homeworkId,e.courseId].every(n=>Number.isSafeInteger(n)&&n>0))
      throw Error('BLOCKED: verified homework, placement and course IDs required');
    localPath(e.path,base);
    if (new URL(e.path,base).pathname !== `/homework/${e.placementId}`)
      throw Error('BLOCKED: fixture path must identify its own placement');
  }
  if (f.first.courseId !== f.sameCourse.courseId || f.first.courseId === f.otherCourse.courseId ||
      new Set([f.first.homeworkId,f.sameCourse.homeworkId,f.otherCourse.homeworkId]).size !== 1 ||
      new Set([f.first.placementId,f.sameCourse.placementId,f.otherCourse.placementId]).size !== 3)
    throw Error('BLOCKED: same homework, distinct placements, two course scopes required');
  const lock = acquire(process.env,'homework-attempt-scope');
  let context;
  try {
    context = await readOnlyContext(browser,{storageState:state,viewport:{width:1440,height:900},locale:'ru-RU'});
    await context.route('**/*',route=>route.request().isNavigationRequest() && new URL(route.request().url()).origin!==base ? route.abort('blockedbyclient') : route.fallback());
    const page = await context.newPage();
    async function read(name, resultAttemptId) {
      const entry=f[name], url=base+entry.path;
      const response=await page.goto(url,{waitUntil:'domcontentloaded'});
      expect(response?.status(),'authenticated information page must open').toBe(200);
      expect(new URL(page.url()).pathname).toBe(`/homework/${entry.placementId}`);
      await expect(page.getByText(f.title,{exact:true}).first()).toBeVisible();
      const initial=JSON.parse(await page.locator('#app').getAttribute('data-page'));
      // Initial HTML has deferred auth.user=null. Fresh Inertia JSON supplies it.
      const probe=await context.request.get(url,{maxRedirects:0,headers:{'X-Inertia':'true','X-Inertia-Version':initial.version,'X-Requested-With':'XMLHttpRequest',Accept:'text/html, application/xhtml+xml'}});
      expect(probe.status(),'fresh same-origin information response').toBe(200);
      expect(probe.headers()['content-type']).toMatch(/application\/json/);
      const p=(await probe.json()).props;
      expect(p.auth?.user?.id===f.studentId,'confirmed QA identity; do not print account data').toBe(true);
      expect(p.isProduction,'explicit test environment').toBe(false);
      expect(p.chapterHomework?.id).toBe(entry.placementId);
      expect(p.chapterHomework?.homework_id).toBe(entry.homeworkId);
      expect(p.chapterHomework?.chapter?.course_id).toBe(entry.courseId);
      expect(p.homework?.id).toBe(entry.homeworkId);
      expect(p.homework?.title).toBe(f.title);
      expect(p.homework?.duration_type,'untimed fixture only; reading a timer may reconcile it').toBe('none');
      const facts=attemptState(p);
      expect(facts.current,'fixture must have no active attempt').toBeNull();
      await buildEvidence(page,testInfo,`build-${name}`);
      const shot=testInfo.outputPath(`${name}.png`);
      await page.screenshot({path:shot,type:'png',scale:'device'});
      await testInfo.attach(name,{path:shot,contentType:'image/png'});
      if (resultAttemptId !== undefined) {
        expect(facts.history.some(a=>a.id===resultAttemptId && a.status==='reviewed'),
          'result must belong to the shared reviewed history').toBe(true);
        await expect(page.getByRole('button',{name:'Начать задание',exact:true})).toHaveCount(0);
        await expect(page.getByRole('link',{name:'Начать задание',exact:true})).toHaveCount(0);
        const resultLink=page.getByRole('link',{name:'Просмотреть результаты',exact:true});
        await expect(resultLink).toBeVisible();
        const resultURL=new URL(await resultLink.getAttribute('href'),base);
        expect(resultURL.origin).toBe(base);
        expect(resultURL.pathname).toBe(`/homework/${entry.placementId}/results/${resultAttemptId}`);
        for (const [key,value] of new URL(entry.path,base).searchParams)
          expect(resultURL.searchParams.get(key),`result preserves ${key} context`).toBe(value);
        await resultLink.click();
        // Inertia canonicalizes query order; context values and route must match.
        resultURL.searchParams.sort();
        await expect(page).toHaveURL(url=>{url.searchParams.sort();return url.href===resultURL.href;});
        await expect(page.getByText(`Результаты: ${f.title}`,{exact:true}).first()).toBeVisible();
        await expect(page.getByText('Детализация по вопросам',{exact:true})).toBeVisible();
        const resultInitial=JSON.parse(await page.locator('#app').getAttribute('data-page'));
        const resultProbe=await context.request.get(resultURL.href,{maxRedirects:0,headers:{'X-Inertia':'true','X-Inertia-Version':resultInitial.version,'X-Requested-With':'XMLHttpRequest',Accept:'text/html, application/xhtml+xml'}});
        expect(resultProbe.status(),'shared reviewed result must be accessible through each placement').toBe(200);
        const result=(await resultProbe.json()).props;
        expect(result.auth?.user?.id===f.studentId,'result keeps the confirmed QA identity').toBe(true);
        expect(result.isProduction).toBe(false);
        expect(result.chapterHomework?.id).toBe(entry.placementId);
        expect(result.homework?.id).toBe(entry.homeworkId);
        expect(result.attempt?.id).toBe(resultAttemptId);
        expect(result.attempt?.student_id===f.studentId,'result belongs to this QA student').toBe(true);
        expect(result.attempt?.status).toBe('reviewed');
        const resultShot=testInfo.outputPath(`${name}-result.png`);
        await page.screenshot({path:resultShot,type:'png',scale:'device'});
        await testInfo.attach(`${name}-result`,{path:resultShot,contentType:'image/png'});
      }
      return facts;
    }
    await fn(read);
  } finally {
    if(context) {await failureScreenshot(context,testInfo);await context.close();}
    release(lock);
  }
}

test('HW-scope same course: placements share used attempts and remaining limit',async({browser},testInfo)=>withScope(browser,testInfo,async read=>{
  const first=await read('first');
  expect(first.history.some(a=>a.status==='reviewed'),'first placement needs a reviewed attempt').toBe(true);
  expect(first.attemptsLeft,'owned fixture uses all available attempts').toBe(0);
  const same=await read('sameCourse');
  expect(await read('first'),'reading must preserve original attempts').toEqual(first);
  expect(await read('sameCourse'),'reading must preserve second placement').toEqual(same);
  expect.soft(same.attemptsLeft,'M-3: same homework inside one course must share remaining attempts').toBe(first.attemptsLeft);
  expect(same.history,'M-3: same homework inside one course must share its attempt history').toEqual(first.history);
  const reviewedId=first.history.find(a=>a.status==='reviewed').id;
  expect(await read('first',reviewedId),'viewing the shared result preserves first placement attempts').toEqual(first);
  expect(await read('sameCourse',reviewedId),'viewing the shared result preserves second placement attempts').toEqual(same);
  expect(await read('first'),'result navigation must not create a new attempt').toEqual(first);
  expect(await read('sameCourse'),'result navigation must keep the shared limit/history').toEqual(same);
}));

test('HW-scope another course: same homework starts with its own unused attempt',async({browser},testInfo)=>withScope(browser,testInfo,async read=>{
  const first=await read('first');
  expect(first.history.some(a=>a.status==='reviewed'),'source course must already contain a reviewed attempt').toBe(true);
  const other=await read('otherCourse');
  expect(other.history,'attempts from another course must not leak into history').toEqual([]);
  expect(other.attemptsLeft,'the independent course must allow a fresh attempt').toBeGreaterThan(0);
  expect(await read('otherCourse'),'reading must not consume the independent attempt').toEqual(other);
  expect(await read('first'),'reading another course must preserve source attempts').toEqual(first);
}));
