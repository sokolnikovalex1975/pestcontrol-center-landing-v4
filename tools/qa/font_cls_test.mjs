// Проверка сдвига макета (CLS) при подмене шрифта: пока Inter грузится, текст рисуется запасным шрифтом
// "Inter Fallback" (Arial / Liberation Sans / Arimo с подогнанными метриками), потом браузер подменяет его на Inter.
// Файлы шрифтов (.woff2) отдаются с задержкой 1,2 с (подмена ещё под заставкой) и 3,5 с (подмена после
// появления первого экрана, как при медленной сети). Для каждого размера экрана считается сдвиг макета за всё время.
// Метрика, UIS и Radist заблокированы. Считаются все сдвиги, как в Lighthouse.
// Запуск из корня репозитория (нужны Node.js 18+ и puppeteer-core: npm i puppeteer-core):
//   CHROME=/путь/к/chrome node tools/qa/font_cls_test.mjs                  — index.html из репозитория
//   CHROME=... PAGE=/путь/к/index.php node tools/qa/font_cls_test.mjs       — готовый index.php
// Итог «ОК», если сдвиг везде не больше 0,005; иначе код выхода 1.
// Если в системе нет ни Arial, ни Liberation Sans, ни Arimo, запасной шрифт не подключится — тест об этом предупредит.
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const HTML = Buffer.from(fs.readFileSync(process.env.PAGE || path.join(ROOT, 'index.html'), 'utf8'), 'utf8');
const VIEWPORTS = [
  ['ПК 1280×720', 1280, 720, false],
  ['ПК 1350×940 (PageSpeed)', 1350, 940, false],
  ['ПК 1366×768', 1366, 768, false],
  ['ПК 1440×900', 1440, 900, false],
  ['ПК 1536×864', 1536, 864, false],
  ['ПК 1920×1080', 1920, 1080, false],
  ['ПК 2560×1440', 2560, 1440, false],
  ['планшет 768×1024', 768, 1024, true],
  ['телефон 412×823 (PageSpeed)', 412, 823, true],
  ['телефон 375×812', 375, 812, true],
  ['телефон 360×800', 360, 800, true],
];
const DELAYS = [1200, 3500];
const LIMIT = 0.005;
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.html': 'text/html; charset=utf-8' };

let delay = 0;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(HTML); return; }
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const send = () => { res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res); };
  if (f.endsWith('.woff2')) setTimeout(send, delay); else send();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let worst = 0, fallbackMissing = false; const lines = [];
console.log('задержка шрифта:'.padEnd(30), DELAYS.map(d => (d / 1000 + ' с').padStart(7)).join(''));
for (const [vname, w, h, mobile] of VIEWPORTS) {
  const vals = [];
  for (const d of DELAYS) {
    delay = d;
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile }, userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(BASE) ? r.continue() : r.abort('blockedbyclient'));
    await page.evaluateOnNewDocument(() => { window.__cls = 0; window.__src = []; new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__cls += e.value; if (e.value > 0.0005) window.__src.push(Math.round(e.startTime) + ' мс ' + e.value.toFixed(4) + ' ' + (e.sources || []).map(x => x.node ? (x.node.id || x.node.className || x.node.nodeName) : '?').join(',')); } }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(BASE, { waitUntil: 'load' });
    // пока Inter не пришёл: подключился ли запасной шрифт (локальный Arial / Liberation Sans / Arimo)
    const fb = await page.evaluate(() => [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'Inter Fallback').map(f => f.status));
    if (!fb.length) fallbackMissing = 'в странице нет запасного шрифта "Inter Fallback"'; else if (!fb.includes('loaded')) fallbackMissing = 'запасной шрифт "Inter Fallback" не подключился — в системе нет Arial, Liberation Sans или Arimo, проверка не показательна';
    await new Promise(r => setTimeout(r, d + 2300));
    const { cls, src } = await page.evaluate(() => ({ cls: window.__cls, src: window.__src }));
    vals.push(cls); worst = Math.max(worst, cls);
    if (cls > LIMIT) lines.push(`  ${vname}, шрифт через ${d / 1000} с: ${cls.toFixed(4)} — ${src.join('; ')}`);
    await ctx.close();
  }
  console.log(vname.padEnd(30), vals.map(v => v.toFixed(4).padStart(7)).join(''));
}
await browser.close(); server.close();
if (fallbackMissing) console.log('ВНИМАНИЕ: ' + fallbackMissing);
if (lines.length) console.log('Сдвиг больше ' + LIMIT + ':\n' + lines.join('\n'));
console.log(worst <= LIMIT ? 'ОК: наибольший сдвиг ' + worst.toFixed(4) : 'ЕСТЬ СДВИГ: наибольший ' + worst.toFixed(4));
process.exit(worst <= LIMIT ? 0 : 1);
