// H-1012-MEDIA / PDF-WEB-1012: received own PDF must have a visible file link.
// Existing fixture only. Only the authorized owner→approved-student session switch POST is allowed.
const fs = require('node:fs');
const { test: base, expect } = require('@playwright/test');
const { configuration } = require('../lib/configuration');
const { acquire, release } = require('../lib/coordination');
const { readOnlyContext, failureScreenshot } = require('./fixtures/read-only');
const { buildEvidence } = require('./fixtures/build-evidence');
const cfg = configuration();
let lock;
const test = base.extend({
  context: async ({ browser, viewport }, use, testInfo) => {
    if (!cfg.sessions.owner || !fs.existsSync(cfg.sessions.owner)) throw Error('BLOCKED: private OWNER_STORAGE_STATE required');
    const context = await readOnlyContext(browser, { baseURL: cfg.baseURL, storageState: cfg.sessions.owner, viewport, locale: 'ru-RU' });
    // DOM presence/link regression never needs audio/video bytes or playback.
    await context.route('**/*', route => route.request().resourceType() === 'media' ? route.abort('blockedbyclient') : route.fallback());
    try { await use(context); }
    finally {
      try {
        for (const page of context.pages()) await buildEvidence(page, testInfo);
        await failureScreenshot(context, testInfo);
      } finally { await context.close(); }
    }
  },
});
test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1, video: 'off', trace: 'off', screenshot: 'off', launchOptions: {} });
test.beforeAll(() => { lock = acquire(process.env, 'messages-media-readonly'); });
test.afterAll(() => release(lock));
test('PDF-WEB-1012 received own PDF exposes a visible file link in student messages', async ({ page }, testInfo) => {
  const ownerId = Number(process.env.MESSAGES_EXPECTED_OWNER_ID);
  const studentId = Number(process.env.MESSAGES_STUDENT_ID);
  const sessionId = Number(process.env.MESSAGES_STUDENT_SESSION_ID);
  const messageId = Number(process.env.MESSAGES_PDF_MESSAGE_ID);
  const name = process.env.MESSAGES_STUDENT_NAME;
  const marker = process.env.MESSAGES_OWN_MARKER;
  if (![ownerId, studentId, sessionId, messageId].every(n => Number.isSafeInteger(n) && n > 0) || !name?.trim() || !marker?.trim()) throw Error('BLOCKED: approved owner/student/dialog/PDF IDs, private student name and own QA caption marker required');
  const response = await page.goto(cfg.baseURL + '/admin/messages-v2');
  expect(response.status()).toBe(200);
  const owner = await page.evaluate(() => {
    const p = JSON.parse(document.querySelector('#app').dataset.page).props;
    return { id: p.currentUserId, owner: p.schoolRbac?.isOwner, test: p.isProduction === false };
  });
  expect(owner, 'verified test owner before session switch').toEqual({ id: ownerId, owner: true, test: true });
  await page.goto(cfg.baseURL + '/admin/users?filter%5Bsearch%5D=' + encodeURIComponent(name));
  await expect(page.getByText(name, { exact: true }).locator('visible=true').first()).toBeVisible();
  const matches = await page.evaluate(([id, name]) => JSON.parse(document.querySelector('#app').dataset.page).props.paginator.data.filter(x => x.id === id && x.name === name).length, [studentId, name]);
  expect(matches, 'unique approved student fixture identity').toBe(1);
  const impersonateURL = cfg.baseURL + '/admin/users/' + studentId + '/impersonate';
  const sessionSwitch = route => route.request().method() === 'POST' ? route.continue() : route.fallback();
  await page.context().route(impersonateURL, sessionSwitch);
  let student;
  try {
    const row = page.locator('tbody tr').filter({ hasText: name });
    await expect(row, 'unique approved student row').toHaveCount(1);
    await row.getByTitle('Действия', { exact: true }).click();
    [student] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Войти как пользователь', exact: true }).locator('visible=true').first().click(),
    ]);
    await student.waitForLoadState('domcontentloaded');
  } finally { await page.context().unroute(impersonateURL, sessionSwitch); }
  const principal = () => student.evaluate(() => {
    const raw = document.querySelector('#app')?.dataset.page;
    return raw ? JSON.parse(raw).props.auth?.user?.id : null;
  });
  const initialId = await principal();
  if (initialId == null) await student.reload({ waitUntil: 'domcontentloaded' });
  else expect(initialId, 'never accept a different principal').toBe(studentId);
  await expect.poll(principal, { timeout: 15000, message: 'BLOCKED: verified student before messages read' }).toBe(studentId);
  await student.goto(cfg.baseURL + '/messages');
  const facts = await student.evaluate(mid => {
    const p = JSON.parse(document.querySelector('#app').dataset.page).props;
    const m = p.thread?.messages?.find(x => x.id === mid);
    return { userId: p.auth?.user?.id, test: p.isProduction === false, sessionId: p.thread?.sessionId, message: m ? { id: m.id, content: m.content, mediaType: m.mediaType, mediaUrlPresent: !!m.mediaUrl, mediaPath: m.mediaUrl ? new URL(m.mediaUrl).pathname : null } : null };
  }, messageId);
  expect(facts.userId).toBe(studentId); expect(facts.test).toBe(true); expect(facts.sessionId).toBe(sessionId);
  expect(facts.message?.id).toBe(messageId); expect(facts.message?.mediaType).toBe('file'); expect(facts.message?.mediaUrlPresent).toBe(true);
  expect(typeof facts.message.content).toBe('string'); expect(facts.message.content.includes(marker), 'existing own QA caption marker').toBe(true);
  const caption = student.getByText(facts.message.content, { exact: true });
  await expect(caption).toBeVisible(); await caption.scrollIntoViewIfNeeded();
  const links = await student.locator('a[href]').evaluateAll((elements, path) => {
    const matched = elements.filter(a => new URL(a.href).pathname === path);
    return { matching: matched.length, visible: matched.filter(a => { const r = a.getBoundingClientRect(), style = getComputedStyle(a); return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; }).length };
  }, facts.message.mediaPath);
  await testInfo.attach('received-pdf-facts', { body: JSON.stringify({ verifiedStudent: true, verifiedDialog: true, verifiedMessage: true, ownMarkerMatched: true, mediaType: facts.message.mediaType, mediaUrlPresent: facts.message.mediaUrlPresent, fileLinks: links }, null, 2), contentType: 'application/json' });
  const png = testInfo.outputPath('student-own-pdf.png');
  await student.screenshot({ path: png, type: 'png', scale: 'device' });
  await testInfo.attach('student-own-pdf', { path: png, contentType: 'image/png' });
  expect(links.matching, 'PDF-WEB-1012: received PDF has mediaUrl but no file link; caption alone is not a file').toBeGreaterThan(0);
  expect(links.visible, 'PDF-WEB-1012: the received PDF link must be visible').toBeGreaterThan(0);
});
