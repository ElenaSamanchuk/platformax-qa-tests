// Source: PopovichFit 3.0.0 (16) release notes, 28.10.2026, and live web29.10.
// Read-only fixture/reference checks; never claims native playback/tracking coverage.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { validatePopovichFitBase } = require('../lib/popovichfit-fixture-contracts');
const { acquire, release } = require('../lib/coordination');
const { readOnlyContext, failureScreenshot } = require('./fixtures/read-only');
const { buildEvidence } = require('./fixtures/build-evidence');
test.use({ video: 'off', trace: 'off', screenshot: 'off' });

function fixtureConfig() {
  const config = { baseURL: validatePopovichFitBase(process.env.BASE_URL) };
  const state = process.env.PF_STORAGE_STATE;
  const userId = process.env.PF_EXPECTED_USER_ID;
  const productId = process.env.PF_PRODUCT_ID;
  if (!state || !fs.existsSync(state) || !/^\d+$/.test(userId || '') || !/^\d+$/.test(productId || ''))
    throw new Error('BLOCKED: provide local PF_STORAGE_STATE and confirmed PF_EXPECTED_USER_ID/PF_PRODUCT_ID');
  return { ...config, state, userId, productId };
}
async function run(browser, testInfo, profile, fn) {
  const config = fixtureConfig();
  const lock = acquire(process.env, 'popovichfit-fixture-reference');
  let context;
  try {
    context = await readOnlyContext(browser, {
      storageState: config.state, viewport: profile.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: !!profile.mobile, hasTouch: !!profile.mobile, deviceScaleFactor: profile.mobile ? 3 : 1, locale: 'ru-RU',
    });
    await context.route('**/*', route => {
      const r = route.request();
      if (r.isNavigationRequest() && new URL(r.url()).origin !== config.baseURL) return route.abort('blockedbyclient');
      return route.fallback();
    });
    const page = await context.newPage();
    await fn(page, config);
    await buildEvidence(page, testInfo);
  } finally {
    if (context) { await failureScreenshot(context, testInfo); await context.close(); }
    release(lock);
  }
}
async function inertia(page, config, path, component) {
  const response = await page.goto(config.baseURL + path, { waitUntil: 'domcontentloaded' });
  expect(response.status(), 'Reference route must return200').toBe(200);
  expect(new URL(page.url()).pathname, 'A dashboard/login redirect is not reference PASS').toBe(path);
  const initial = JSON.parse(await page.locator('#app').getAttribute('data-page'));
  // Confirmed shared-props contract: first HTML may omit deferred auth.user.
  const json = await page.request.get(config.baseURL + path, { maxRedirects: 0, headers: {
    'X-Inertia': 'true', 'X-Inertia-Version': initial.version, 'X-Requested-With': 'XMLHttpRequest',
    Accept: 'text/html, application/xhtml+xml',
  }});
  expect(json.status(), 'Fresh same-origin Inertia GET must succeed').toBe(200);
  expect(json.headers()['content-type']).toMatch(/application\/json/);
  const data = await json.json();
  expect(data.component).toBe(component);
  expect(String(data.props.auth?.user?.id), 'Private session must belong to the confirmed account').toBe(config.userId);
  expect(data.props.isProduction).toBe(false);
  expect(data.props.impersonation ?? null, 'Positive tracking fixture must be a direct account session').toBeNull();
  return data.props;
}

test('PF-FIX1: premium product provides active access,90% threshold and curator reference', async ({ browser }, info) => {
  await run(browser, info, {}, async (page, c) => {
    const p = await inertia(page, c, '/products/' + c.productId, 'Popovichfit/Product/ProductPage');
    expect(String(p.product.id)).toBe(c.productId);
    expect(p.product.has_active_access).toBe(true);
    expect(p.product.is_premium).toBe(true);
    expect(p.product.premium_chat?.id).toBeTruthy();
    expect(p.product.premium_chat?.name?.trim()).toBeTruthy();
    expect(p.videoWatchThreshold).toEqual({ enabled: true, percent: 90 });
    expect(p.folders?.some(x => x.slug === 'warmup'), 'The reference course must provide the bonus warmup folder').toBe(true);
  });
});
for (const mobile of [false, true]) test('PF-FIX2: referral reference with personal code, ' + (mobile ? 'mobile390' : 'desktop'), async ({ browser }, info) => {
  await run(browser, info, { mobile }, async (page, c) => {
    const p = await inertia(page, c, '/referral', 'Referral/ReferralPage');
    expect(p.referralPromocode, 'The confirmed account must receive its personal referral code').toBeTruthy();
    await expect(page.getByText('Реферальная программа POPOVICHFIT', { exact: false })).toBeVisible();
    const size = await page.evaluate(() => ({ w: innerWidth, full: document.documentElement.scrollWidth }));
    expect(size.full, 'The reference screen must fit the viewport').toBeLessThanOrEqual(size.w);
  });
});
