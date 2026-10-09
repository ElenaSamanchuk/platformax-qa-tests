// Автотест задачи «Live-комнаты» (встречи 1-1 и группа: видео, экран, чат, управление участниками).
// Каждая проверка создаёт свою комнату «QA-AT …» и завершает её в конце. Чужие комнаты не трогаем.
// Идентификаторы исторических находок обозначают регресс, а не текущий диагноз.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const fs = require('fs');
const { recordingsReady, restoreRooms } = require('../lib/contracts');
const coordination = require('../lib/coordination');
const { qaTitle } = require('../lib/qa-data');
let dataLock;


let owner, A, B; // { ctx, page }: владелец-ведущий, ученик без продукта, ученик с продуктом
const rooms = [];
const newRoom = async (name, extra) => { const id = await h.createRoom(owner.page, qaTitle(name), extra); rooms.push(id); fs.writeFileSync(`created-rooms-${process.pid}.json`, JSON.stringify(rooms)); return id; };
const live = async (name, extra) => { const id = await newRoom(name, extra); expect((await h.publish(owner.page, id)).status).toBe(200); expect((await h.start(owner.page, id)).status).toBe(200); return id; };

test.beforeAll(async ({ browser }) => {
  dataLock = coordination.acquire(process.env, 'live-rooms');
  owner = await h.as(browser, 'owner');
  A = await h.as(browser, 'studentA');
  B = await h.as(browser, 'studentB');
});
test.afterAll(async () => {
  let failures = [];
  try {
    if (rooms.length) failures = await restoreRooms(rooms, {
      finish: id => h.finish(owner.page, id),
      unpublish: id => h.unpublish(owner.page, id),
      read: id => h.roomDetails(owner.page, id),
    });
    if (dataLock) fs.writeFileSync(`cleanup-result-${process.pid}.json`, JSON.stringify({ rooms, failures }, null, 2));
  } finally {
    for (const r of [owner, A, B]) if (r) await r.ctx.close();
  }
  if (failures.length) throw new Error('CLEANUP FAILED: see cleanup-result-<pid>.json; keep data lock and restore these QA ids manually');
  coordination.release(dataLock);
});

test('S-1 окружение: вход выдаёт JWT и wss-адрес медиасервера (не localhost)', async () => {
  const id = await live('S-1');
  const j = await h.api(owner.page, 'POST', `/admin/live-rooms/${id}/join`);
  expect(j.status).toBe(200);
  const t = j.data.token || {};
  const ws = t.ws_url || j.data.wsUrl;
  expect(ws, 'ws_url').toMatch(/^wss:\/\//);
  expect(ws).not.toMatch(/localhost|127\.0\.0\.1/);
  expect(String(t.token || '').split('.').length, 'JWT из трёх частей').toBe(3);
});

test('M-9 старт неопубликованной: после «Начать встречу» страница показывает эфир, а не «Черновик»', async () => {
  const id = await newRoom('M-9');
  const p = owner.page;
  await p.goto(`${h.BASE}/admin/live-rooms/${id}/room`);
  await p.getByRole('button', { name: 'Начать встречу' }).click();
  await expect(p.getByRole('button', { name: /Запускаем встречу/ }), 'L-12: кнопка показывает загрузку').toBeVisible({ timeout: 3000 });
  await expect.poll(async () => (await h.state(p, id)).status, { timeout: 20000 }).toBe('live');
  await expect(p.getByText('Черновик', { exact: true }), 'M-9: эфир идёт, а на странице «Черновик»').toHaveCount(0, { timeout: 10000 });
});

test('M-7 «Ещё → Настройки комнаты» открывает новую вкладку и не выкидывает ведущего', async () => {
  const id = await live('M-7');
  const p = owner.page;
  await h.enterMeeting(p, id, { admin: true });
  await h.wake(p);
  await p.getByRole('button', { name: 'Ещё' }).click();
  const [tab] = await Promise.all([owner.ctx.waitForEvent('page'), p.getByText('Настройки комнаты', { exact: true }).click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toMatch(new RegExp(`/admin/live-rooms/${id}/edit`));
  await tab.close();
  await expect(p.getByRole('button', { name: 'Выйти из встречи' })).toBeAttached();
  expect(await h.inside(p, id)).toContain((await h.state(p, id)).participants.find((x) => x.role === 'host')?.user_id);
});

test('M-6 модератор: назначенный ученик ставит паузу чата и отключает участника', async () => {
  const id = await live('M-6');
  await h.enterMeeting(owner.page, id, { admin: true });
  await h.enterMeeting(A.page, id);
  await h.enterMeeting(B.page, id);
  const nameA = await A.page.evaluate(() => JSON.parse(document.getElementById('app').dataset.page).props.auth.user.name);
  const nameB = await B.page.evaluate(() => JSON.parse(document.getElementById('app').dataset.page).props.auth.user.name);
  await h.wake(owner.page);
  await owner.page.getByRole('button', { name: `Действия: ${nameA}` }).first().click();
  await owner.page.getByText('Сделать модератором', { exact: true }).click();
  await expect(A.page.getByRole('button', { name: 'Управление встречей' })).toBeAttached({ timeout: 15000 });
  const pause = await h.api(A.page, 'PATCH', `/live-rooms/${id}/controls`, { chat_paused: true });
  expect(pause.status, 'модератор: пауза чата').toBe(200);
  await h.api(A.page, 'PATCH', `/live-rooms/${id}/controls`, { chat_paused: false });
  await h.wake(A.page);
  await A.page.getByRole('button', { name: `Действия: ${nameB}` }).first().click();
  await A.page.getByText('Отключить от встречи', { exact: true }).click();
  await expect(B.page.getByText('Вас отключили от встречи.')).toBeVisible({ timeout: 15000 });
});

test('M-5 запись: три запуска, три ready/playable записи на сервере', async () => {
  test.setTimeout(480000);
  const id = await live('M-5');
  const p = owner.page;
  await h.enterMeeting(p, id, { admin: true });
  const results = [];
  for (let i = 0; i < 3; i++) {
    await h.wake(p);
    if (!(await p.getByRole('button', { name: 'Начать запись' }).isVisible())) await p.getByRole('button', { name: 'Управление встречей' }).click();
    const t0 = Date.now();
    const [started] = await Promise.all([
      p.waitForResponse(r => new URL(r.url()).pathname === `/admin/live-rooms/${id}/recordings/start` && r.request().method() === 'POST', { timeout: 70000 }),
      p.getByRole('button', { name: 'Начать запись' }).click(),
    ]);
    results.push(`attempt ${i + 1}: HTTP ${started.status()}, ${Math.round((Date.now() - t0) / 1000)}с`);
    expect(started.status(), 'M-5: текущий start должен быть подтверждён сервером').toBe(200);
    await expect(p.getByRole('button', { name: 'Остановить запись' })).toBeVisible();
    await p.waitForTimeout(5000);
    const [stopped] = await Promise.all([
      p.waitForResponse(r => new URL(r.url()).pathname === `/admin/live-rooms/${id}/recordings/stop` && r.request().method() === 'POST'),
      p.getByRole('button', { name: 'Остановить запись' }).click(),
    ]);
    expect(stopped.status(), 'M-5: stop HTTP').toBe(200);
    await p.waitForTimeout(6000);
  }
  console.log('Запись:', results.join(' | '));
  expect(results, 'M-5: три подтверждённых запуска').toHaveLength(3);
  await expect.poll(async () => {
    const r = await h.api(p, 'GET', `/admin/live-rooms/${id}/recordings`);
    expect(r.status, 'M-5 recordings HTTP').toBe(200);
    expect(Array.isArray(r.data.recordings), 'M-5 recordings contract').toBe(true);
    return recordingsReady(r.data.recordings);
  }, { timeout: 120000, intervals: [5000], message: 'M-5: нужны ровно три разные ready/playable записи, отсутствие failed недостаточно' }).toBe(true);
  // playable is the server flag, not proof of actual video playback. See docs/REQUIREMENTS.md.

});

test('L-11 + M-8 вторая вкладка: понятный текст и человек остаётся в участниках', async () => {
  const id = await live('M-8');
  await h.enterMeeting(A.page, id);
  const userA = (await h.state(owner.page, id)).participants.map((x) => x.user_id)[0];
  const second = await A.ctx.newPage();
  await h.enterMeeting(second, id);
  await expect(A.page.getByText('Вы вошли во встречу с другой вкладки или устройства.'), 'L-11').toBeVisible({ timeout: 15000 });
  await second.waitForTimeout(25000); // пульс присутствия
  expect(await h.inside(owner.page, id), 'M-8: человек во встрече со второй вкладки, но сервер его выписал').toContain(userA);
  await second.close();
});

test('M-4 выключение «Постоянной комнаты» у идущей встречи не сбрасывает эфир', async () => {
  const id = await live('M-4');
  await h.enterMeeting(A.page, id);
  const p = owner.page;
  const toggle = async (on) => {
    await p.goto(`${h.BASE}/admin/live-rooms/${id}/edit`);
    const sw = p.locator('input[type=checkbox]').first();
    if ((await sw.isChecked()) !== on) await sw.locator('xpath=..').click();
    await expect(sw).toBeChecked({ checked: on });
    await p.getByRole('button', { name: /Сохранить/ }).click();
    await p.waitForTimeout(4000);
  };
  for (let i = 0; i < 2; i++) {
    await toggle(true);
    await toggle(false);
    expect((await h.state(p, id)).status, `M-4: попытка ${i + 1} — эфир сброшен`).toBe('live');
    expect((await h.inside(p, id)).length, 'участник остался во встрече').toBeGreaterThan(0);
  }
});

test('H-1 старая ссылка-приглашение не пускает в «Ограниченный доступ» без продукта', async ({ browser }) => {
  test.skip(!process.env.PRODUCT_ID || !process.env.PRODUCT_TITLE, 'нужны PRODUCT_ID и PRODUCT_TITLE в .env');
  const id = await newRoom('H-1');
  await h.publish(owner.page, id);
  const p = owner.page;
  const setAccess = async (label, product) => {
    await p.goto(`${h.BASE}/admin/live-rooms/${id}/edit`);
    await p.locator('button', { hasText: 'Кто может войти' }).first().click();
    await p.getByRole('option', { name: label }).click();
    if (product) { await p.locator('button').filter({ hasText: /^Продукт/ }).filter({ hasNotText: 'Продукты' }).first().click(); await p.getByRole('option', { name: product }).click(); }
    await p.getByRole('button', { name: /Сохранить/ }).click();
    await p.waitForTimeout(3000);
  };
  await setAccess('По персональной ссылке');
  await p.goto(`${h.BASE}/admin/live-rooms/${id}/room`);
  const invite = await p.evaluate(() => JSON.parse(document.getElementById('app').dataset.page).props.invitationUrl);
  await setAccess('Ограниченный доступ', process.env.PRODUCT_TITLE);
  expect((await h.start(p, id)).status).toBe(200);
  const clean = await h.as(browser, 'studentA'); // новый сеанс, у ученика A нет продукта
  try {
    const direct = await clean.page.goto(`${h.BASE}/live-rooms/${id}`);
    expect(direct.status(), 'прямой адрес без продукта').toBe(403);
    await clean.page.goto(invite);
    const link = clean.page.getByRole('button', { name: /Войти в комнату/ }).or(clean.page.getByRole('link', { name: /Войти в комнату/ }));
    if (await link.count()) await link.first().click();
    const again = await clean.page.goto(`${h.BASE}/live-rooms/${id}`);
    expect(again.status(), 'H-1: после старой ссылки ученик без продукта получил доступ').toBe(403);
  } finally { await clean.ctx.close(); }
});

test('Доступы: сотрудник «только просмотр» получает экран «Доступ запрещён» (L-3, L-13)', async ({ browser }) => {
  test.skip(!process.env.STAFF_VIEW_EMAIL, 'нет STAFF_VIEW_EMAIL');
  const id = await newRoom('RBAC');
  const s = await h.as(browser, 'staffView');
  try {
    for (const path of ['/admin/live-rooms/create', `/admin/live-rooms/${id}/edit`]) {
      const r = await s.page.goto(h.BASE + path);
      expect(r.status(), path).toBe(403);
      await expect(s.page.getByText('THIS ACTION IS UNAUTHORIZED', { exact: false }), `${path}: сырая английская 403 (L-13)`).toHaveCount(0);
    }
  } finally { await s.ctx.close(); }
});

test('Вход: «Закрыть вход» → 423, пароль встречи: неверный отклоняется, верный пускает', async () => {
  const id = await live('Пароль');
  const c1 = await h.api(owner.page, 'PATCH', `/admin/live-rooms/${id}/controls`, { locked: true });
  expect(c1.status).toBe(200);
  expect((await h.api(B.page, 'POST', `/live-rooms/${id}/join`)).status).toBe(423);
  await h.api(owner.page, 'PATCH', `/admin/live-rooms/${id}/controls`, { locked: false, password: 'qa4321' });
  await B.page.goto(`${h.BASE}/live-rooms/${id}`);
  await B.page.getByRole('button', { name: /Войти в комнату/ }).click();
  const pw = B.page.locator('input[type=password]').first();
  await pw.fill('wrong1'); await pw.press('Enter');
  await expect(B.page.getByText('Неверный пароль встречи.')).toBeVisible({ timeout: 10000 });
  await pw.fill('qa4321'); await pw.press('Enter');
  await expect(B.page.getByRole('button', { name: 'Выйти из встречи' })).toBeAttached({ timeout: 30000 });
});

test('M-10 закрывший браузер участник уходит из «внутри» за 90 с', async ({ browser }) => {
  test.setTimeout(180000);
  const id = await live('M-10');
  const tmp = await h.as(browser, 'studentB');
  await h.enterMeeting(tmp.page, id);
  const before = await h.inside(owner.page, id);
  expect(before.length).toBeGreaterThan(0);
  await tmp.ctx.close(); // без «Выйти»
  await expect.poll(async () => (await h.inside(owner.page, id)).length, { timeout: 90000, intervals: [10000] }).toBe(before.length - 1);
});
