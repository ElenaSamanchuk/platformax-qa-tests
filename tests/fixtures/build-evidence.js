// Save filtered version metadata; do not serialize props, users, cookies or tokens.
async function buildEvidence(page, testInfo, name = 'web-build') {
  if (!page || page.isClosed()) return;
  const metadata = await page.evaluate(() => {
    const raw = document.getElementById('app')?.dataset.page;
    let inertia = {}; try { inertia = raw ? JSON.parse(raw) : {}; } catch {}
    return {
      component: inertia.component || null,
      inertiaVersion: inertia.version || null,
      assets: [...document.querySelectorAll('script[src]')].map(s => new URL(s.src).pathname).filter(p => p.startsWith('/build/assets/')),
      viewport: {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touch:navigator.maxTouchPoints>0},
    };
  });
  await testInfo.attach(name,{body:JSON.stringify(metadata,null,2),contentType:'application/json'});
}
module.exports = { buildEvidence };
