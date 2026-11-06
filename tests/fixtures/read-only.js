// Shared read-only browser fixture. Session data remains private and local.
async function readOnlyContext(browser, options) {
  const context = await browser.newContext(options);
  await context.route('**/*', route => ['GET','HEAD','OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
  return context;
}
async function failureScreenshot(context, testInfo) {
  if (testInfo.status === testInfo.expectedStatus) return;
  for (const page of context.pages()) if (!page.isClosed()) {
    const file = testInfo.outputPath('original.png');
    await page.screenshot({ path: file, type: 'png', scale: 'device' });
    await testInfo.attach('original', { path: file, contentType: 'image/png' });
    break;
  }
}
module.exports = { readOnlyContext, failureScreenshot };
