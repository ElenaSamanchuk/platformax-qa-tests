// Shared same-origin session + XSRF transport. Never log full responses/tokens.
async function api(page, method, url, body) {
  return page.evaluate(async ([m, u, b]) => {
    const x = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '');
    const r = await fetch(u, { method: m, headers: { 'X-XSRF-TOKEN': x, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let data = await r.text(); try { data = JSON.parse(data); } catch (e) { /* html */ }
    return { status: r.status, data };
  }, [method, url, body]);
}

module.exports = { api };
