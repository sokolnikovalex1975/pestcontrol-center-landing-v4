// Проверка кода заявки Radist в ссылках Telegram и MAX (блок счётчиков из server/counters.html).
// Запуск из корня репозитория (нужны Node.js 18+ и puppeteer-core: npm i puppeteer-core):
//   CHROME=/путь/к/chrome node tools/qa/radist_test.mjs             — версия из репозитория: index.html + server/counters.html
//   CHROME=... PAGE=/путь/к/index.php node tools/qa/radist_test.mjs  — готовый index.php
//   CHROME=... LIVE=1 LIVE_TRACKER=1 node tools/qa/radist_test.mjs   — рабочий сайт как есть, скрипт Radist с track.radist.me
// Документ и app.min.js — из репозитория, остальные файлы — с рабочего сайта. Метрика и UIS заменены заглушками
// (заглушка Метрики ставит cookie _ym_uid). Скрипт Radist настоящий: TRACKER=/путь/к/tracker.min.js или свежая копия
// с track.radist.me (LIVE_TRACKER=1 — грузить прямо с track.radist.me). Отправка визита в Radist перехватывается
// и в Radist не уходит.
import puppeteer, { KnownDevices } from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const SITE = 'https://xn----itbbsflddbfpfdodg9d0f.xn--p1ai/';
function buildPage() {
  if (process.env.PAGE) return fs.readFileSync(process.env.PAGE, 'utf8');
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const c = fs.readFileSync(path.join(ROOT, 'server', 'counters.html'), 'utf8');
  const a = c.indexOf('<!-- Yandex.Metrika counter + UIS'), b = c.indexOf('<!-- /Yandex.Metrika counter -->') + '<!-- /Yandex.Metrika counter -->'.length;
  const i = h.lastIndexOf('</body>');
  return h.slice(0, i) + '\n' + c.slice(a, b) + '\n' + h.slice(i);
}
const LIVE = !!process.env.LIVE;
const HTML = LIVE ? '' : buildPage();
const APP = fs.readFileSync(process.env.APP || path.join(ROOT, 'app.min.js'), 'utf8');
const TRACKER = process.env.TRACKER ? fs.readFileSync(process.env.TRACKER, 'utf8') : await (await fetch('https://track.radist.me/tracker.min.js')).text();
const LIVE_TRACKER = !!process.env.LIVE_TRACKER;
const STATIC_TG = 'Здравствуйте! Пишу с сайта пестконтроль-центр.рф';
const MSG = id => STATIC_TG + '. Номер заявки: ' + id;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const errorsAll = [];
function ok(cond, name, info) { if (cond) pass++; else fail++; console.log((cond ? 'OK   ' : 'FAIL ') + name + (info ? ' ' + JSON.stringify(info) : '')); }

async function open(browser, { url = SITE, device = 'mobile', storage = true, tracker = 'ok', ymuid = true, ctx, trackerDelay = 0 } = {}) {
  const page = await (ctx || browser).newPage();
  if (device === 'desktop') await page.setViewport({ width: 1366, height: 900 }); else await page.emulate(KnownDevices['iPhone 13']);
  const log = { tracker: [], posts: [], errors: [] };
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|net::ERR_FAILED/.test(m.text())) log.errors.push('console: ' + m.text().slice(0, 160)); });
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (!LIVE && (u.split('?')[0] === SITE || u.split('#')[0] === SITE || u.startsWith(SITE + '?'))) { if (r.resourceType() === 'document') return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }); }
    if (!LIVE && u.startsWith(SITE + 'app.min.js')) return r.respond({ status: 200, contentType: 'application/javascript; charset=utf-8', body: APP });
    if (u.startsWith('https://mc.yandex.ru/metrika/tag.js')) return r.respond({ status: 200, contentType: 'application/javascript', body: ymuid ? 'document.cookie="_ym_uid=1761700000123456789; path=/";' : '/* stub */' });
    if (/mc\.yandex|uiscom|comagic/.test(u)) return r.abort('blockedbyclient');
    if (u === 'https://track.radist.me/tracker.min.js') {
      log.tracker.push(Date.now());
      if (tracker === 'blocked') return r.abort('blockedbyclient');
      if (LIVE_TRACKER) return r.continue();
      const resp = () => r.respond({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: TRACKER });
      if (trackerDelay) { setTimeout(resp, trackerDelay); return; }
      return resp();
    }
    if (u.startsWith('https://track.radist.me/track')) { log.posts.push({ t: Date.now(), body: JSON.parse(r.postData() || '{}') }); return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); }
    if (/^https?:\/\/([a-z0-9-]+\.)*radist\.me\//.test(u)) return r.abort('blockedbyclient');
    return r.continue();
  });
  if (!storage) await page.evaluateOnNewDocument(() => { Storage.prototype.setItem = function () { throw new Error('storage blocked'); }; Storage.prototype.getItem = function () { return null; }; });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await sleep(600);
  return { page, log };
}
const links = page => page.evaluate(() => ({
  tg: [...document.querySelectorAll('a[href*="t.me/"]')].map(a => { const u = new URL(a.href); return { path: u.pathname, text: u.searchParams.get('text'), q: [...u.searchParams.keys()].join(',') }; }),
  max: [...document.querySelectorAll('a[href*="max.ru/"]')].map(a => { const u = new URL(a.href); return { path: u.pathname, start: u.searchParams.get('start'), q: [...u.searchParams.keys()].join(',') }; }),
  sid: (() => { try { return sessionStorage.getItem('radistVisit'); } catch (e) { return 'ERR'; } })(),
  rt: typeof window.radist_tracker, getId: window.radist_tracker && window.radist_tracker.getVisitId ? window.radist_tracker.getVisitId() : null,
}));
const allCode = (L, id) => L.tg.length === 4 && L.max.length === 4 && L.tg.every(x => x.text === MSG(id) && x.path === '/Centr_Dezinfection' && x.q === 'text') && L.max.every(x => x.start === id && x.path === '/u/f9LHodD0cOIlIUXFkt4KMFP88lD8n4TArBiTcV7RI1XML5c4o39QfsDBXUc' && x.q === 'start');
const firstAction = page => page.evaluate(() => window.scrollBy(0, 400));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
// 1–3. Сразу после открытия, после первого действия, идентификатор Метрики
{
  const { page, log } = await open(browser);
  const L = await links(page);
  const id = L.sid;
  ok(/^ro[A-Za-z0-9]{10}$/.test(id || ''), 'код заявки создан сразу при открытии', { id });
  ok(allCode(L, id), 'все 4 ссылки Telegram и 4 ссылки MAX содержат код до загрузки скрипта Radist', { tg: L.tg[0], max: L.max[0] });
  ok(log.tracker.length === 0, 'скрипт Radist до первого действия не загружается', { n: log.tracker.length });
  await firstAction(page); await sleep(2600);
  const L2 = await links(page);
  ok(log.tracker.length === 1, 'после первого действия скрипт Radist загружен один раз', { n: log.tracker.length });
  ok(L2.getId === id && allCode(L2, id), 'скрипт Radist взял тот же код, ссылки не изменились', { getId: L2.getId });
  const p0 = log.posts[0] && log.posts[0].body;
  ok(!!p0 && p0.id === id && p0.url === SITE, 'данные визита ушли в Radist с тем же кодом и адресом страницы', p0);
  const withYm = log.posts.find(p => p.body.ym_uid === '1761700000123456789' && p.body.id === id);
  ok(!!withYm, 'идентификатор посетителя Метрики (_ym_uid) передан в Radist', { posts: log.posts.length });
  ok(log.errors.length === 0, 'без ошибок на странице', log.errors); errorsAll.push(...log.errors);
  // 5. Повторное открытие в той же вкладке — тот же код
  log.posts.length = 0; log.tracker.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(600);
  const L3 = await links(page);
  ok(L3.sid === id && allCode(L3, id), 'после перезагрузки вкладки код тот же', { sid: L3.sid });
  await page.close();
}
// 4. Метки utm и yclid
{
  const url = SITE + '?utm_source=yandex&utm_medium=cpc&utm_campaign=test_radist&yclid=987654321';
  const { page, log } = await open(browser, { url });
  const id = (await links(page)).sid;
  await firstAction(page); await sleep(1800);
  const b = log.posts[0] && log.posts[0].body || {};
  ok(b.id === id && b.utm_source === 'yandex' && b.utm_medium === 'cpc' && b.utm_campaign === 'test_radist' && b.yclid === '987654321' && b.url === url, 'метки utm и yclid переданы в Radist вместе с кодом', b);
  await page.close();
}
// 6. Другая вкладка (новый сеанс) — другой код
{
  const ctx = await browser.createBrowserContext();
  const a = await open(browser, { ctx }); const idA = (await links(a.page)).sid; await a.page.close();
  const b = await open(browser, { ctx: await browser.createBrowserContext() }); const idB = (await links(b.page)).sid; await b.page.close();
  ok(idA && idB && idA !== idB, 'в новом сеансе код другой', { idA, idB });
}
// 7. sessionStorage недоступен — ссылки с обычным текстом, код подставит скрипт Radist
{
  const { page, log } = await open(browser, { storage: false });
  const L = await links(page);
  ok(L.tg.every(x => x.text === STATIC_TG) && L.max.every(x => x.q === ''), 'без sessionStorage до скрипта: готовый текст без кода, MAX без кода', { tg: L.tg[0].text, max: L.max[0].q });
  await firstAction(page); await sleep(1800);
  const L2 = await links(page); const id = L2.getId;
  ok(/^ro[A-Za-z0-9]{10}$/.test(id || '') && allCode(L2, id) && log.posts[0] && log.posts[0].body.id === id, 'без sessionStorage после скрипта: код в ссылках совпадает с переданным в Radist', { id, post: log.posts[0] && log.posts[0].body.id });
  ok(log.errors.length === 0, 'без ошибок на странице (без sessionStorage)', log.errors); errorsAll.push(...log.errors);
  await page.close();
}
// 8. Скрипт Radist заблокирован — код в ссылках остаётся
{
  const { page, log } = await open(browser, { tracker: 'blocked' });
  const id = (await links(page)).sid;
  await firstAction(page); await sleep(1500);
  const L = await links(page);
  ok(allCode(L, id) && log.posts.length === 0, 'скрипт Radist заблокирован: код в ссылках есть, страница работает', { id, posts: log.posts.length });
  ok(log.errors.length === 0, 'без ошибок на странице (Radist заблокирован)', log.errors); errorsAll.push(...log.errors);
  await page.close();
}
// 9–10. Нажатие на Telegram и MAX первым действием (компьютер: плавающая кнопка; телефон: шапка)
for (const [device, sel] of [['desktop', '.fab .tg'], ['mobile', '.fab .tg'], ['desktop', '.fab .max']]) {
  const { page, log } = await open(browser, { device, trackerDelay: device === 'mobile' ? 2500 : 0 });
  if (device === 'desktop') await page.waitForFunction(() => !document.getElementById('intro'), { timeout: 9000 }).catch(() => {});
  const id = (await links(page)).sid;
  let el = await page.$(sel);
  if (device === 'mobile') {
    await page.evaluate(() => window.scrollTo(0, innerHeight * 1.3));
    const t0 = Date.now();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.fab')).opacity === '1', { timeout: 2000, polling: 50 }).catch(() => {});
    console.log('     кнопки появились через', Date.now() - t0, 'мс после прокрутки');
    el = await page.$('.fab .tg');
    console.log('     до нажатия: скрипт Radist запрошен', log.tracker.length, 'раз, выполнен:', await page.evaluate(() => !!(window.radist_tracker && window.radist_tracker.getVisitId)));
  }
  const popupP = new Promise(res => browser.once('targetcreated', t => res(t)));
  if (device === 'mobile') { const bb = await el.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
  else await el.click();
  const t = await Promise.race([popupP, sleep(4000).then(() => null)]);
  let url = t ? t.url() : '';
  for (let i = 0; i < 20 && t && (!url || url === 'about:blank'); i++) { await sleep(100); url = t.url(); }
  const u = url ? new URL(url) : null;
  const good = sel.includes('max') ? (u && u.host === 'max.ru' && u.searchParams.get('start') === id) : (u && u.host === 't.me' && u.searchParams.get('text') === MSG(id));
  ok(!!good, `нажатие первым действием (${device}, ${sel.split(',')[0]}) открывает ссылку с кодом`, { url: url.slice(0, 80) + '…', id });
  for (const p of await browser.pages()) if (p !== page && p.url() !== 'about:blank') await p.close().catch(() => {});
  await page.close();
}
await browser.close();
console.log('ERRORS', JSON.stringify(errorsAll), 'ИТОГО', pass + '/' + (pass + fail));
