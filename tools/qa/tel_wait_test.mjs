// Проверка ожидания подмены номера при первом касании (блок счётчиков из server/counters.html).
// Запуск из корня репозитория (нужны Node.js 18+ и puppeteer-core: npm i puppeteer-core):
//   CHROME=/путь/к/chrome node tools/qa/tel_wait_test.mjs          — версия из репозитория: index.html + server/counters.html
//   CHROME=... PAGE=/путь/к/index.php node tools/qa/tel_wait_test.mjs  — готовый index.php
//   CHROME=... LIVE=1 node tools/qa/tel_wait_test.mjs A               — рабочий сайт, только сценарии, начинающиеся с «A»
// Документ сайта подменяется проверяемой версией, остальные файлы берутся с рабочего сайта.
// UIS заменён заглушкой, которая ведёт себя как настоящая очередь __cs: команда waitForTrackViewAndRun
// выполняется после «ответа сервера визитов» (и после подмены номеров, если она есть).
// Переход на tel: отслеживается по событию Page.frameRequestedNavigation, звонок не совершается.
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
const HTML = process.env.LIVE ? '' : buildPage();
const BASE = 'tel:+74951043570', DT = 'tel:+79990001122';

function stub(mode) {
  // mode: replace300 | plain300 | never | slow1500 | storage
  return `(function(){
    var q = Array.isArray(window.__cs) ? window.__cs.slice() : [];
    window.__cs = { push: function (x) { q.push(x); } };
    window.Comagic = window.Comagic || {};
    var mode = ${JSON.stringify(mode)};
    function rep() { document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.href = '${DT}'; }); }
    function fire() { window.__stubReadyAt = Date.now(); for (var i = 0; i < q.length; i++) if (q[i] && q[i][0] === 'waitForTrackViewAndRun') q[i][1]({ session: {} }); }
    if (mode === 'storage') rep();
    if (mode === 'never') return;
    var delay = mode === 'slow1500' ? 1500 : mode === 'storage' ? 600 : 300;
    setTimeout(function () { if (mode === 'replace300' || mode === 'slow1500') rep(); fire(); }, delay);
  })();`;
}

async function run(name, opt) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const desktop = opt.device === 'desktop';
  if (desktop) await page.setViewport({ width: 1366, height: 900 });
  else await page.emulate(KnownDevices['iPhone 13']);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const cdp = await page.createCDPSession();
  await cdp.send('Page.enable');
  const navs = [];
  cdp.on('Page.frameRequestedNavigation', p => { if (/^tel:/.test(p.url)) navs.push({ t: Date.now(), url: p.url, reason: p.reason }); });
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (!process.env.LIVE && (u === SITE || u === SITE + '#x')) return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
    if (u.startsWith('https://mc.yandex.ru/')) return r.respond({ status: 200, contentType: 'application/javascript', body: '/* metrika stub */' });
    if (u.startsWith('https://app.uiscom.ru/static/cs.min.js')) {
      if (opt.uis === 'blocked') return r.abort('blockedbyclient');
      return r.respond({ status: 200, contentType: 'application/javascript', body: stub(opt.uis) });
    }
    if (/uiscom|comagic/.test(u)) return r.abort('blockedbyclient');
    return r.continue();
  });
  await page.evaluateOnNewDocument((ios) => {
    if (ios) window.GestureEvent = function () {};
    window.__T = { clicks: [], reads: [] };
    window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) window.__T.clicks.push({ t: Date.now(), phase: 'cap' }); }, true);
    window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) { const c = window.__T.clicks[window.__T.clicks.length - 1]; if (c) c.prevented = e.defaultPrevented; setTimeout(() => { if (c) c.op20 = a.style.opacity; }, 20); } }, false);
    const desc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
    Object.defineProperty(HTMLAnchorElement.prototype, 'href', { configurable: true, get() { const v = desc.get.call(this); if (/^tel:/.test(v)) window.__T.reads.push({ t: Date.now(), v, ua: navigator.userActivation ? navigator.userActivation.isActive : null }); return v; }, set(v) { desc.set.call(this, v); } });
  }, !!opt.ios);
  await page.goto(SITE, { waitUntil: 'load', timeout: 45000 });
  const loadAt = Date.now();
  const pick = async () => page.evaluate(() => {
    const ls = [...document.querySelectorAll('a[href^="tel:"]')];
    for (const a of ls) { const r = a.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; const el = document.elementFromPoint(x, y); if (el && a.contains(el) && getComputedStyle(a).opacity > 0.9) return { x, y, cls: a.className || '(без класса)' }; }
    return null;
  });
  // ждём, пока номер станет доступен для нажатия (после заставки), не трогая страницу; не дольше 4,5 с после загрузки
  let ready0 = null;
  while (Date.now() - loadAt < 4500) { ready0 = await pick(); if (ready0) break; await new Promise(r => setTimeout(r, 100)); }
  const hittableAfter = Date.now() - loadAt;
  await new Promise(r => setTimeout(r, 150));
  if (opt.before === 'scroll') { await page.evaluate(() => window.scrollBy(0, 1)); await new Promise(r => setTimeout(r, 1000)); await page.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 200)); }
  if (opt.before === 'idle') { const left = 6200 - (Date.now() - loadAt); if (left > 0) await new Promise(r => setTimeout(r, left)); }
  const target = await pick();
  if (!target) { const res = { name, error: 'не найден видимый номер' }; await browser.close(); return res; }
  const tap = async () => {
    if (opt.input === 'enter') {
      await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).closest('a').focus(), target);
      await page.keyboard.press('Enter');
    } else if (desktop) await page.mouse.click(target.x, target.y);
    else await page.touchscreen.tap(target.x, target.y);
  };
  await tap();
  if (opt.second) {
    await new Promise(r => setTimeout(r, opt.second));
    // В безоконном Chromium после перехода на tel: следующее касание не доставляется (проверено на голой странице),
    // поэтому после состоявшегося набора второе нажатие делаем программным щелчком.
    if (opt.secondSynthetic) await page.evaluate(({ x, y }) => { const a = document.elementFromPoint(x, y).closest('a'); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }, target);
    else await tap();
  }
  await new Promise(r => setTimeout(r, opt.waitAfter || 1500));
  const T = await page.evaluate(() => ({ clicks: window.__T.clicks, reads: window.__T.reads, stub: window.__stubReadyAt || null, csType: Array.isArray(window.__cs) ? 'array' : typeof window.__cs, op: [...document.querySelectorAll('a[href^="tel:"]')].map(a => a.style.opacity) }));
  await browser.close();
  const c0 = T.clicks[0] ? T.clicks[0].t : null;
  return {
    name, link: target.cls, hittableAfter, clicks: T.clicks.map(c => ({ prevented: c.prevented, op20: c.op20 })),
    navs: navs.map(n => ({ dt: c0 ? n.t - c0 : null, url: n.url, reason: n.reason })),
    uaAtGo: (T.reads.filter(r => c0 && r.t >= c0).slice(-1)[0] || {}).ua,
    opacityAfter: T.op, errors,
  };
}

const scen = [
  ['A. Касание первым действием, UIS подменил номер через 0,3 с', { uis: 'replace300' }, n => n.navs.length === 1 && n.navs[0].url === DT && n.navs[0].dt < 600 && n.clicks[0].prevented],
  ['B. Касание первым действием, UIS ответил без подмены через 0,3 с', { uis: 'plain300' }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt < 600],
  ['C. UIS не ответил (трекер заблокирован), Android', { uis: 'never' }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt >= 950 && n.navs[0].dt < 1300],
  ['D. UIS не ответил, iPhone (предел 0,8 с)', { uis: 'never', ios: true }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt >= 750 && n.navs[0].dt < 1000],
  ['E. Скрипт UIS заблокирован', { uis: 'blocked' }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt < 400],
  ['F. UIS ответил позже предела (1,5 с)', { uis: 'slow1500', waitAfter: 2000 }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt >= 950 && n.navs[0].dt < 1300],
  ['G. Номер подставлен сразу из памяти UIS', { uis: 'storage' }, n => n.navs.length === 1 && n.navs[0].url === DT && n.navs[0].dt < 300],
  ['H. Сначала прокрутка, касание после ответа UIS', { uis: 'replace300', before: 'scroll' }, n => n.navs.length === 1 && n.navs[0].url === DT && n.navs[0].dt < 150 && n.clicks[0].prevented === false],
  ['I. Двойное касание во время ожидания', { uis: 'never', second: 200 }, n => n.navs.length === 1 && n.navs[0].url === BASE],
  ['J. Повторное касание после первого ожидания', { uis: 'never', second: 1300, secondSynthetic: true, waitAfter: 800 }, n => n.navs.length === 2 && n.navs[1].dt - n.navs[0].dt < 600 && n.clicks[1] && n.clicks[1].prevented === false],
  ['K. Без действий 6 с (загрузка по таймеру), потом касание', { uis: 'replace300', before: 'idle' }, n => n.navs.length === 1 && n.navs[0].url === DT && n.clicks[0].prevented === false],
  ['L. Клавиатура: Enter на номере первым действием', { uis: 'plain300', input: 'enter' }, n => n.navs.length === 1 && n.navs[0].url === BASE && n.navs[0].dt < 600],
  ['M. Компьютер: щелчок по номеру первым действием, подмена', { uis: 'replace300', device: 'desktop' }, n => n.navs.length === 1 && n.navs[0].url === DT && n.navs[0].dt < 600],
];

const only = process.argv[2];
let ok = 0, all = 0;
for (const [name, opt, pass] of scen) {
  if (only && !name.startsWith(only)) continue;
  all++;
  let res;
  try { res = await Promise.race([run(name, opt), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 60s')), 60000))]); } catch (e) { res = { name, error: e.message }; }
  const good = !res.error && pass(res) && res.errors.length === 0 && res.opacityAfter.every(o => o === '') && (res.uaAtGo !== false);
  if (good) ok++;
  console.log((good ? 'OK   ' : 'FAIL ') + JSON.stringify(res));
}
console.log(`ИТОГО ${ok}/${all}`);
