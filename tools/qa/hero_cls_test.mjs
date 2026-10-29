// Проверка сдвига макета (CLS) первого экрана при постепенной загрузке страницы.
// Страница отдаётся с паузой 0,5 с в одной из 7 точек первого экрана — как при медленной сети, когда браузер
// успевает нарисовать первый экран частично. Для каждой точки и 4 размеров экрана считается сдвиг макета
// за первые 3,5 с. Метрика, UIS и Radist заблокированы. Считаются все сдвиги, как в Lighthouse: при эмуляции
// сенсорного экрана Chrome помечает первые 0,5 с как «сразу после действия» (hadRecentInput), хотя действий нет.
// Запуск из корня репозитория (нужны Node.js 18+ и puppeteer-core: npm i puppeteer-core):
//   CHROME=/путь/к/chrome node tools/qa/hero_cls_test.mjs                  — index.html из репозитория
//   CHROME=... PAGE=/путь/к/index.php node tools/qa/hero_cls_test.mjs       — готовый index.php
// Итог «ОК», если сдвиг везде не больше 0,005; иначе код выхода 1.
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME || process.env.HOME + '/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const HTML = Buffer.from(fs.readFileSync(process.env.PAGE || path.join(ROOT, 'index.html'), 'utf8'), 'utf8');
const SPLITS = [
  ['после заголовка', '<p class="lead"'],
  ['перед кнопками', 'class="hero-ctas"'],
  ['перед панелью', '<aside class="panel"'],
  ['2-й пункт панели', 'lucide-door-open'],
  ['4-й пункт панели', 'lucide-map"'],
  ['перед «Листайте»', 'class="scroll-cue"'],
  ['после первого экрана', '<!-- ============ 2. STRIP'],
];
const VIEWPORTS = [
  ['телефон 412×823', 412, 823, true],
  ['компьютер 1366×900', 1366, 900, false],
  ['ноутбук 1024×768', 1024, 768, false],
  ['планшет 820×1180', 820, 1180, true],
];
const LIMIT = 0.005, PAUSE = 500;
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.html': 'text/html; charset=utf-8' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/index.html') {
    const marker = SPLITS[+u.searchParams.get('s')] ? SPLITS[+u.searchParams.get('s')][1] : null;
    const i = marker ? HTML.indexOf(Buffer.from(marker, 'utf8')) : -1;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': HTML.length, 'Cache-Control': 'no-store' });
    if (i > 0) { res.write(HTML.subarray(0, i)); setTimeout(() => res.end(HTML.subarray(i)), PAUSE); } else res.end(HTML);
    return;
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let worst = 0; const lines = [];
for (const [vname, w, h, mobile] of VIEWPORTS) {
  const vals = [];
  for (let s = 0; s < SPLITS.length; s++) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }, userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(BASE) ? r.continue() : r.abort('blockedbyclient'));
    await page.evaluateOnNewDocument(() => { window.__cls = 0; window.__src = []; new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__cls += e.value; if (e.value > 0.001) window.__src.push(e.value.toFixed(4) + ' ' + (e.sources || []).map(x => x.node ? (x.node.id || x.node.className || x.node.nodeName) : '?').join(',')); } }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(BASE + '?s=' + s, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 3500));
    const { cls, src } = await page.evaluate(() => ({ cls: window.__cls, src: window.__src }));
    vals.push(cls); worst = Math.max(worst, cls);
    if (cls > LIMIT) lines.push(`  ${vname}, обрыв ${SPLITS[s][0]}: ${cls.toFixed(4)} — ${src.join('; ')}`);
    await ctx.close();
  }
  console.log(vname.padEnd(20), vals.map(v => v.toFixed(4)).join('  '));
}
await browser.close(); server.close();
console.log('точки обрыва:', SPLITS.map(s => s[0]).join(' | '));
if (lines.length) console.log('Сдвиг больше ' + LIMIT + ':\n' + lines.join('\n'));
console.log(worst <= LIMIT ? 'ОК: наибольший сдвиг ' + worst.toFixed(4) : 'ЕСТЬ СДВИГ: наибольший ' + worst.toFixed(4));
process.exit(worst <= LIMIT ? 0 : 1);
