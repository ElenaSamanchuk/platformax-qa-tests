// Source: Medvediva task, Ksenia22.10: real purchase -> booking -> meeting -> debit.
// This suite checks deployment availability only, never that complete lifecycle.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { configuration } = require('../lib/configuration');
const { acquire, release } = require('../lib/coordination');
const { readOnlyContext } = require('./fixtures/read-only');
const { buildEvidence } = require('./fixtures/build-evidence');

test.use({ video: 'off', trace: 'off', screenshot: 'off' });

const profiles = [
  { role: 'ADMIN', route: '/admin/service-sessions', component: 'Admin/ServiceSessions/ServiceSessionsView' },
  { role: 'STUDENT', route: '/service-sessions', component: 'ServiceSessions/StudentSessionsPage' },
];

for (const profile of profiles) {
  test(`PM deployment ${profile.role}: authenticated route renders its session component`, async ({ browser }, testInfo) => {
    const state = process.env[`PM_${profile.role}_STORAGE_STATE`];
    const expectedId = process.env[`PM_${profile.role}_EXPECTED_USER_ID`];
    if (!state || !fs.existsSync(state) || !expectedId || !/^\d+$/.test(expectedId))
      throw new Error(`BLOCKED: provide private PM_${profile.role}_STORAGE_STATE and confirmed PM_${profile.role}_EXPECTED_USER_ID; no login/impersonation is attempted`);
    const config = configuration(); // Shared strict test-origin guard, before requests.
    const lock = acquire(process.env, 'personal-meetings-deployment-' + profile.role);
    let context;
    try {
      context = await readOnlyContext(browser, {
        storageState: state, viewport: { width: 1440, height: 900 }, locale: 'ru-RU',
      });
      // Reject navigation outside the approved origin, including redirect to another school.
      await context.route('**/*', route => {
        const request = route.request();
        if (request.isNavigationRequest() && new URL(request.url()).origin !== config.baseURL)
          return route.abort('blockedbyclient');
        return route.fallback();
      });
      const page = await context.newPage();
      const response = await page.goto(config.baseURL + profile.route, { waitUntil: 'domcontentloaded' });
      const current = new URL(page.url());
      if (current.pathname === '/login' || current.pathname.startsWith('/login/'))
        throw new Error('BLOCKED: saved session expired or belongs to another host; login redirect is not deployment PASS');
      expect(response, 'Route must return an HTTP response').not.toBeNull();
      expect(response.status(), 'Session route must not return 404/403/500').toBe(200);
      expect(current.origin).toBe(config.baseURL);
      expect(current.pathname, 'No redirect to dashboard/login may count as PASS').toBe(profile.route);
      const data = await page.locator('#app').getAttribute('data-page');
      expect(data, 'Expected authenticated Inertia page, not a soft404 HTML page').toBeTruthy();
      let inertia = JSON.parse(data);
      if (!inertia.props?.auth?.user?.id) {
        // Confirmed on core23.10: initial HTML auth.user is null; Inertia JSON GET
        // with current version returns the real shared identity (owner31).
        const partial = await page.request.get(config.baseURL + profile.route, {
          maxRedirects: 0,
          headers: {
            'X-Inertia': 'true', 'X-Inertia-Version': inertia.version,
            'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, application/xhtml+xml',
          },
        });
        expect(partial.status(), 'Authenticated identity GET must not redirect or return409/404').toBe(200);
        expect(partial.headers()['content-type']).toMatch(/application\/json/);
        inertia = await partial.json();
      }
      const user = inertia.props?.auth?.user;
      if (!user?.id) throw new Error('BLOCKED: no authenticated identity in page props');
      expect(String(user.id), 'Saved state must match confirmed QA identity').toBe(expectedId);
      expect(inertia.props?.isProduction, 'Explicit test-environment evidence required').toBe(false);
      expect(inertia.component, 'HTTP200 is insufficient: exact Personal Meetings page must be deployed').toBe(profile.component);
      await buildEvidence(page, testInfo);
    } finally {
      if (context) await context.close();
      release(lock);
    }
  });
}

// Public artifact availability is independent of authenticated route/role acceptance.
test('PM frontend deployment: core manifest publishes both session page assets', async ({ request }) => {
  const config = configuration();
  const lock = acquire(process.env, 'personal-meetings-public-assets');
  try {
    const response = await request.get(config.baseURL + '/build/manifest.json', { maxRedirects: 0 });
    expect(response.status(), 'Manifest must be directly served, not redirect/login/404').toBe(200);
    const manifest = await response.json();
    for (const key of [
      'resources/js/Pages/Admin/ServiceSessions/ServiceSessionsView.vue',
      'resources/js/Pages/ServiceSessions/StudentSessionsPage.vue',
      'resources/js/Pages/Admin/Services/ServiceEditPage.vue',
    ]) {
      expect(manifest[key], `Missing deployed Personal Meetings component: ${key}`).toBeTruthy();
      const file = manifest[key].file;
      expect(file).toMatch(/^assets\/[A-Za-z0-9_-]+\.js$/);
      const asset = await request.get(config.baseURL + '/build/' + file, { maxRedirects: 0 });
      expect(asset.status(), `Manifest asset must exist: ${key}`).toBe(200);
      expect(asset.headers()['content-type']).toMatch(/javascript/);
      expect((await asset.body()).length).toBeGreaterThan(1000);
    }
  } finally { release(lock); }
});
