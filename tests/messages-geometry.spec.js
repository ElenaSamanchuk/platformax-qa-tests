// M-1009-02: observed 09/12 Oct contract — the closed-dialog list fits the viewport.
// Ported from the executed read-only regression; no dialog creation, write or status change.
const fs = require('node:fs');
const { test: base, expect } = require('@playwright/test');
const { configuration } = require('../lib/configuration');
const { acquire, release } = require('../lib/coordination');
const { readOnlyContext, failureScreenshot } = require('./fixtures/read-only');
const { buildEvidence } = require('./fixtures/build-evidence');
const cfg = configuration();
let lock;
const test = base.extend({
  context: async ({ browser, viewport, isMobile, hasTouch, deviceScaleFactor }, use, testInfo) => {
    if (!cfg.sessions.owner || !fs.existsSync(cfg.sessions.owner)) throw Error('BLOCKED: private OWNER_STORAGE_STATE required');
    const context = await readOnlyContext(browser, {
      baseURL: cfg.baseURL, storageState: cfg.sessions.owner,
      viewport, isMobile, hasTouch, deviceScaleFactor, locale: 'ru-RU',
    });
    try { await use(context); }
    finally {
      try { await buildEvidence(context.pages()[0], testInfo); await failureScreenshot(context, testInfo); }
      finally { await context.close(); }
    }
  },
});
// Match the executed source config: original PNG only; no video, trace or media flags.
test.use({ video: 'off', trace: 'off', screenshot: 'off', launchOptions: {} });
test.beforeAll(() => { lock = acquire(process.env, 'messages-geometry-readonly'); });
test.afterAll(() => release(lock));
for (const [width, height] of [[320, 693], [390, 844]]) test.describe(`Messages mobile ${width}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  test('M-1009-02 closed own long preview list stays inside viewport', async ({ page }, testInfo) => {
    const expectedId = Number(process.env.MESSAGES_EXPECTED_OWNER_ID);
    const label = process.env.MESSAGES_LONG_PREVIEW_NAME;
    if (!Number.isSafeInteger(expectedId) || expectedId <= 0 || !label?.trim()) throw Error('BLOCKED: agreed owner ID and own closed-dialog label required');
    const response = await page.goto(cfg.baseURL + '/admin/messages-v2');
    expect(response.status(), 'messages page HTTP').toBe(200);
    await expect(page.getByRole('button', { name: 'Статус диалогов' })).toBeVisible();
    const identity = await page.evaluate(() => {
      const p = JSON.parse(document.getElementById('app').dataset.page).props;
      return { userId: p.currentUserId ?? p.auth?.user?.id, owner: p.schoolRbac?.isOwner, verified: p.schoolRbac?.verified, test: p.isProduction === false };
    });
    expect(identity, 'verified test owner session prerequisite').toEqual({ userId: expectedId, owner: true, verified: true, test: true });
    await page.getByRole('button', { name: 'Статус диалогов' }).tap();
    await page.getByText(/^Закрытые/).last().tap();
    // The private label identifies an agreed own fixture; do not pick an arbitrary first dialog.
    const row = page.getByRole('button').filter({ hasText: label });
    await expect(row, 'unique agreed own closed-dialog row').toHaveCount(1);
    await expect(row).toBeVisible();
    const geometry = await row.evaluate(el => {
      const list = el.closest('section');
      if (!list) throw Error('BLOCKED: verified list section schema changed');
      const r = list.getBoundingClientRect();
      const sidebar = document.querySelector('aside.sidebar-shell')?.getBoundingClientRect();
      return { viewport: innerWidth, documentScrollWidth: document.documentElement.scrollWidth, left: r.left, right: r.right, width: r.width, sidebarRight: sidebar?.right, previewLength: el.innerText.length, dpr: devicePixelRatio, touch: navigator.maxTouchPoints > 0 };
    });
    await testInfo.attach('list-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
    const png = testInfo.outputPath('closed-own-preview.png');
    await page.screenshot({ path: png, type: 'png', scale: 'device' });
    await testInfo.attach('closed-own-preview', { path: png, contentType: 'image/png' });
    expect(geometry.dpr).toBe(3); expect(geometry.touch).toBe(true);
    expect(geometry.sidebarRight, 'menu is really closed').toBeLessThanOrEqual(1);
    expect(geometry.previewLength, 'existing own long preview is present').toBeGreaterThan(100);
    expect.soft(geometry.left, 'M-1009-02 list left edge stays on screen').toBeGreaterThanOrEqual(-1);
    expect(geometry.right, `M-1009-02: list right=${geometry.right}, viewport=${geometry.viewport}; documentScrollWidth=${geometry.documentScrollWidth} cannot prove no clipping`).toBeLessThanOrEqual(geometry.viewport + 1);
  });
});
