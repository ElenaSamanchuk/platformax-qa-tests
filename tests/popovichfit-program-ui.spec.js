// GF-6316: repeatable UI regressions; no writes, credentials or test data in Git.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { readOnlyContext, failureScreenshot } = require('./fixtures/read-only');
const { acquire, release } = require('../lib/coordination');
test.use({ video: 'off', trace: 'off', screenshot: 'off' });
const ORIGIN = process.env.BASE_URL;
async function run(browser, info, width, fn) {
  let target;
  try { target = new URL(ORIGIN); } catch { throw new Error('BLOCKED: configure the reviewed BASE_URL'); }
  if (target.protocol !== 'https:' || target.origin !== ORIGIN || target.username || target.password ||
      process.env.PF_CONFIRMED_TEST_ORIGIN !== ORIGIN ||
      !fs.existsSync(process.env.PF_STORAGE_STATE || '') || !/^\d+$/.test(process.env.PF_EXPECTED_USER_ID || ''))
    throw new Error('BLOCKED: reviewed BASE_URL/PF_CONFIRMED_TEST_ORIGIN, private PF_STORAGE_STATE and PF_EXPECTED_USER_ID required');
  const lock = acquire(process.env, 'GF-6316-readonly');
  let context;
  try {
    context = await readOnlyContext(browser, { storageState: process.env.PF_STORAGE_STATE,
      viewport: { width, height: width < 768 ? 844 : 1000 },
      isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: width < 768 ? 3 : 1 });
    await context.route('**/*', route => {
      const r = route.request();
      if (r.isNavigationRequest() && new URL(r.url()).origin !== ORIGIN) return route.abort('blockedbyclient');
      return route.fallback();
    });
    const page = await context.newPage();
    const response = await page.goto(ORIGIN + '/favourite', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBe(200);
    const initial = JSON.parse(await page.locator('#app').getAttribute('data-page'));
    const fresh = await page.request.get(page.url(), { maxRedirects: 0, headers: {
      'X-Inertia': 'true', 'X-Inertia-Version': initial.version, 'X-Requested-With': 'XMLHttpRequest',
    } });
    expect(fresh.status()).toBe(200);
    const data = await fresh.json();
    expect(data.props.isProduction).toBe(false);
    expect(String(data.props.auth?.user?.id)).toBe(process.env.PF_EXPECTED_USER_ID);
    expect(data.props.impersonation ?? null).toBeNull();
    await fn(page, data.props);
  } finally {
    // A screenshot failure must not hide the product assertion.
    try {
      if (context) {
        await failureScreenshot(context, info).catch(() => {});
        await context.close();
      }
    } finally { release(lock); }
  }
}
for (const width of [1440, 390, 320]) {
  test(`GF6316-M1: favourite timecodes stay inside their card at ${width}`, async ({ browser }, info) => {
    if (!/^\d+$/.test(process.env.PF_TIMECODE_LESSON_ID || ''))
      throw new Error('BLOCKED: prepare an owned favourite strength lesson with timecodes; PF_TIMECODE_LESSON_ID required');
    await run(browser, info, width, async (page, props) => {
      const workout = props.workouts?.find(x => String(x.id) === process.env.PF_TIMECODE_LESSON_ID);
      if (!workout?.name) throw new Error('BLOCKED: the prepared favourite lesson is absent from this account');
      // Favourite cards open a modal, so unlike program cards they need no href.
      const card = page.locator('.ppf-lesson-card').filter({ hasText: workout.name });
      await expect(card).toHaveCount(1);
      const strip = card.locator('.timecodes-scroll');
      await expect(strip).toBeVisible();
      const bounds = await card.evaluate(el => {
        const card = el.getBoundingClientRect();
        const strip = el.querySelector('.timecodes-scroll').getBoundingClientRect();
        return { cardLeft: card.left, cardRight: card.right, stripLeft: strip.left, stripRight: strip.right };
      });
      // Inner horizontal scrolling is allowed; the scroll container itself must fit.
      expect(bounds.stripLeft).toBeGreaterThanOrEqual(bounds.cardLeft - 1);
      expect(bounds.stripRight, 'M1: timecodes overlap neighbouring cards or are clipped outside the card').toBeLessThanOrEqual(bounds.cardRight + 1);
    });
  });
}
test('GF6316-H2: visible bonus folder links open existing pages', async ({ browser }, info) => {
  if (!/^\d+$/.test(process.env.PF_BONUS_PRODUCT_ID || ''))
    throw new Error('BLOCKED: PF_BONUS_PRODUCT_ID with confirmed active access required');
  await run(browser, info, 1440, async page => {
    await page.goto(ORIGIN + `/products/${process.env.PF_BONUS_PRODUCT_ID}/bonus`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Бонусные материалы', exact: true })).toBeVisible();
    const links = await page.locator('a.ppf-support-folder-row[href]:visible').evaluateAll(xs => xs.map(x => ({ name: x.innerText.trim(), url: x.href })));
    const internal = links.filter(link => new URL(link.url).origin === ORIGIN);
    expect(internal.length, 'test requires actual visible internal bonus folders').toBeGreaterThan(0);
    const initial = JSON.parse(await page.locator('#app').getAttribute('data-page'));
    for (const link of internal) {
      const target = new URL(link.url);
      const response = await page.request.get(target.href, { maxRedirects: 0, headers: {
        'X-Inertia': 'true', 'X-Inertia-Version': initial.version, 'X-Requested-With': 'XMLHttpRequest',
      } });
      expect(response.status(), `Visible bonus folder must open: ${target.pathname}`).toBe(200);
      const targetPage = await response.json();
      expect(targetPage.component).toBe('Popovichfit/Folder/FolderPage');
      expect(targetPage.props.isProduction).toBe(false);
      expect(String(targetPage.props.auth?.user?.id)).toBe(process.env.PF_EXPECTED_USER_ID);
      expect(String(targetPage.props.productId)).toBe(process.env.PF_BONUS_PRODUCT_ID);
    }
  });
});
