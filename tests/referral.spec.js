// Read-only referral regression for the Platforma core, not brand themes.
// No withdrawal submission, payment, clipboard or account modification.
const fs = require('fs');
const { test: base, expect } = require('@playwright/test');
const { configuration } = require('../lib/configuration');
const { discount, displayedDiscount, validBonuses } = require('../lib/referral-contracts');
const config = configuration();
const BASE = config.baseURL;
const coordination = require('../lib/coordination');
const { readOnlyContext, failureScreenshot } = require('./fixtures/read-only');
const { buildEvidence } = require('./fixtures/build-evidence');
let dataLock;
const test = base.extend({
  context: async ({ browser, viewport, isMobile, hasTouch, deviceScaleFactor }, use, testInfo) => {
    const state = config.sessions.referral.state;
    if (!state || !fs.existsSync(state)) throw new Error('BLOCKED: provide a private REFERRAL_STORAGE_STATE path');
    const context = await readOnlyContext(browser, { storageState: state, viewport, isMobile, hasTouch, deviceScaleFactor, locale: 'ru-RU' });
    try { await use(context); }
    finally {
      await buildEvidence(context.pages()[0],testInfo);
      await failureScreenshot(context, testInfo);
      await context.close();
    }
  },
});
test.beforeAll(() => { dataLock = coordination.acquire(process.env, 'referral'); });
test.afterAll(() => { coordination.release(dataLock); });
async function openBonuses(page) {
  const id = Number(config.sessions.referral.expectedId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('BLOCKED: REFERRAL_EXPECTED_USER_ID must identify the agreed fixture');
  const response = await page.goto(BASE + '/bonuses');
  expect(response.status(), 'RF prerequisite /bonuses HTTP').toBe(200);
  const facts = await page.evaluate(() => {
    const props = JSON.parse(document.getElementById('app').dataset.page).props;
    return { userId: props.auth?.user?.id, core: window.isPlatforma, bonuses: props.studentBonuses };
  });
  expect(facts.core, 'RF scope requires Platforma core, not a brand').toBe(true);
  expect(facts.userId === id, 'RF agreed identity; actual identity is not printed').toBe(true);
  expect(validBonuses(facts.bonuses), 'RF enabled program, nonempty promo and numeric friend discount are prerequisites').toBe(true);
  return facts.bonuses;
}
async function activate(page, locator) {
  if (await page.evaluate(()=>navigator.maxTouchPoints>0)) await locator.tap();
  else await locator.click();
}
async function referralTab(page, requireSemantics = true) {
  const tab = page.getByRole('tab', { name: 'Реферальная программа', exact: true });
  const button = page.getByRole('button', { name: 'Реферальная программа', exact: true });
  await activate(page,tab.or(button));
  if (requireSemantics) await expect(tab).toHaveAttribute('aria-selected','true');
  await expect(page.getByText('Ваш реферальный промокод', { exact:true })).toBeVisible();
}
for (const [width,height,profile] of [[1440,900,'desktop'],[320,693,'mobile-320'],[360,780,'mobile-360'],[375,812,'mobile-375'],[390,844,'mobile-390']]) test.describe(`RF-core ${profile}`,()=> {
  test.use({viewport:{width,height},isMobile:profile!=='desktop',hasTouch:profile!=='desktop',deviceScaleFactor:profile==='desktop'?1:3});
test('RF-1 core: referral link controls are absent from the student UI', async ({ page }) => {
  await openBonuses(page); await referralTab(page,false);
  await expect(page.getByTitle('Скопировать ссылку', { exact:true })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Поделиться ссылкой',exact:true })).toHaveCount(0);
});
test('RF-2 tabs/promo: real switching preserves a visible nonempty server promo', async ({ page }) => {
  await openBonuses(page);
  await expect(page.getByRole('tablist', {name:'Разделы бонусов'})).toBeVisible();
  await referralTab(page);
  const shown = await page.evaluate(() => {
    const code=JSON.parse(document.getElementById('app').dataset.page).props.studentBonuses.referral.code;
    return [...document.querySelectorAll('main *')].some(e => e.childElementCount === 0 && e.textContent.trim() === code && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
  });
  expect(shown, 'RF-2 promo is visible; do not log its value').toBe(true);
  const balance=page.getByRole('tab',{name:/^Баланс(?: и история)?$/});
  await activate(page,balance); await expect(balance).toHaveAttribute('aria-selected','true');
  await referralTab(page);
});
test('RF-3 friend discount matches an approved expectation and the server referral value', async ({ page }) => {
  const expected=discount(process.env.REFERRAL_EXPECTED_DISCOUNT);
  test.skip(expected === 0, 'BLOCKED coverage: zero discount display is not an approved requirement');
  if (!process.env.REFERRAL_DISCOUNT_SOURCE?.trim()) throw new Error('BLOCKED: name the source/date of the approved friend discount');
  const bonuses=await openBonuses(page); await referralTab(page,false);
  expect(bonuses.referral.friendDiscountPercent,'RF-3 server friend discount, not cashback').toBe(expected);
  const sentence=page.getByText(/Друг вводит промокод при оплате и получает скидку/);
  await expect(sentence).toBeVisible();
  expect(displayedDiscount(await sentence.innerText()),'RF-3 displayed friend discount').toBe(expected);
});
});
for (const [width,height,profile] of [[1440,900,'desktop'],[320,693,'mobile-320'],[360,780,'mobile-360'],[375,812,'mobile-375'],[390,844,'mobile-390']]) test.describe(`RF-admin ${profile}`,()=> {
  test.use({viewport:{width,height},isMobile:profile!=='desktop',hasTouch:profile!=='desktop',deviceScaleFactor:profile==='desktop'?1:3});
test('RF-4 core admin: removed referral_link field is absent', async ({ browser, viewport, isMobile, hasTouch, deviceScaleFactor }, testInfo) => {
  const state=config.sessions.referralAdmin.state;
  test.skip(!state,'BLOCKED coverage: no read-only admin fixture');
  const id=Number(config.sessions.referralAdmin.expectedId);
  if (!Number.isSafeInteger(id) || id<=0) throw new Error('BLOCKED: agreed admin identity required');
  const context=await readOnlyContext(browser,{storageState:state,viewport,isMobile,hasTouch,deviceScaleFactor,locale:'ru-RU'});
  try {
    const page=await context.newPage(); const response=await page.goto(BASE+'/admin/settings');
    await buildEvidence(page,testInfo,'admin-web-build');
    expect(response.status()).toBe(200);
    const scoped=await page.evaluate(id=>window.isPlatforma===true && JSON.parse(document.getElementById('app').dataset.page).props.auth?.user?.id===id,id);
    expect(scoped,'RF-4 agreed core admin session').toBe(true);
    await expect(page.locator('#referral_link')).toHaveCount(0);
    await expect(page.getByLabel('Реферальная ссылка',{exact:true})).toHaveCount(0);
  } finally { await failureScreenshot(context,testInfo); await context.close(); }
});
});
for (const [width,height] of [[320,693],[360,780],[375,812],[390,844]]) test.describe(`RF-mobile ${width}`,()=> {
  test.use({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  test('RF-5 withdrawal: center touch opens the form without submitting',async({page},testInfo)=> {
    const bonuses=await openBonuses(page);
    test.skip(bonuses.canWithdraw !== true || bonuses.hasPendingWithdrawals !== false,'BLOCKED coverage: choose fixture with eligible withdrawal and no pending request');
    // A separate safe control avoids making the withdrawal test depend on tab ARIA.
    const apply=page.getByRole('button',{name:'Применить к покупке',exact:true});
    await apply.tap();
    await page.waitForURL(url=>url.origin===BASE && url.pathname!=='/bonuses');
    await openBonuses(page); // no checkout fields or payments are touched
    const button=page.getByRole('button',{name:'Вывести средства',exact:true});
    await expect(button).toBeEnabled(); await button.scrollIntoViewIfNeeded();
    const hits=await button.evaluate(el=> {
      const r=el.getBoundingClientRect();
      return [[.5,.5],[.1,.5],[.9,.5],[.5,.2],[.5,.8]].map(([x,y])=>el.contains(document.elementFromPoint(r.left+r.width*x,r.top+r.height*y)));
    });
    await testInfo.attach('withdrawal-hitpoints',{body:JSON.stringify({width,height,touch:true,dpr:3,hits}),contentType:'application/json'});
    // Locator tap preserves real actionability: never force/evaluate click through an overlay.
    await button.tap({position:{x:(await button.boundingBox()).width/2,y:(await button.boundingBox()).height/2},timeout:5000});
    await expect(page.getByText('Вывод средств',{exact:true})).toBeVisible();
    expect(hits.every(Boolean),'RF-5 center and edge hitpoints should reach the button').toBe(true);
    // No fields filled and no Submit action. Context close dismisses the form.
  });
});
