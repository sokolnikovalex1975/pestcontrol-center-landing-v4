#!/usr/bin/env python3
"""Сборка пакета для выкладки на хостинг (для tools/deploy/run_all.sh).

Собирает в папку OUT:
  pkg/                  — файлы для сайта: страницы как index.php со счётчиками из server/counters.html
                          (Метрика 113675622, UIS, Radist — один блок перед </body>, как на главной),
                          style.css (его подключает страница договора) и sitemap.xml;
  MANIFEST.sha256       — суммы файлов pkg/ для сверки после загрузки;
  deploy.conf           — NAME, BK, ORDER, REPLACED и EXPECTED_BEFORE (суммы файлов, которые сейчас отдаёт сайт);
  run_all.sh            — копия скрипта выкладки.

Запуск из корня репозитория (ветка main, после согласования):
    python3 tools/deploy/make_pkg.py --out ../release-2026-10-29

Пакет не собирается, если на странице остались жёлтые пометки (class="tbd") или noindex из тестовой версии.
Для проверочной сборки: --allow-tbd. Сайт ничего не публикует — загрузку делает run_all.sh в «Терминале» на Mac.
"""
import argparse
import hashlib
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SITE = 'https://xn----itbbsflddbfpfdodg9d0f.xn--p1ai'
# страница в репозитории -> файл на хостинге
PAGES = [
    ('dogovor-deratizatsiya-dezinsektsiya/index.html', 'dogovor-deratizatsiya-dezinsektsiya/index.php'),
    ('index.html', 'index.php'),
]
STATIC = [('style.css', 'style.css'), ('server/sitemap.xml', 'sitemap.xml')]
# порядок загрузки: стили, новая страница, главная со ссылкой на неё, карта сайта
ORDER = ['style.css', 'dogovor-deratizatsiya-dezinsektsiya/index.php', 'index.php', 'sitemap.xml']
# файлы, которые уже есть на сервере: перед загрузкой копируются и сверяются с EXPECTED_BEFORE
REPLACED = {'style.css': '/style.css', 'index.php': '/', 'sitemap.xml': '/sitemap.xml'}
START, END = '<!-- Yandex.Metrika counter + UIS', '<!-- /Yandex.Metrika counter -->'
MUST_HAVE = ['113675622', 'uiscom.ru/static/cs.min.js', 'track.radist.me/tracker.min.js']


def counters_block():
    c = (ROOT / 'server' / 'counters.html').read_text(encoding='utf-8')
    a, b = c.find(START), c.find(END)
    if a < 0 or b < 0:
        sys.exit('server/counters.html: не найдены метки блока счётчиков')
    return c[a:b + len(END)]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def live(path):
    req = urllib.request.Request(SITE + path, headers={'User-Agent': 'Mozilla/5.0 make_pkg', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--name', default='pestcontrol-deploy-2026-10-29-dogovor')
    ap.add_argument('--allow-tbd', action='store_true', help='проверочная сборка с жёлтыми пометками')
    ap.add_argument('--no-live', action='store_true', help='не запрашивать текущие файлы сайта')
    args = ap.parse_args()

    out = Path(args.out).resolve()
    if out == ROOT or ROOT in out.parents:
        sys.exit('--out должен быть вне репозитория')
    pkg = out / 'pkg'
    if pkg.exists():
        shutil.rmtree(pkg)
    pkg.mkdir(parents=True)

    block = counters_block()
    errors = []
    for src, dst in PAGES:
        html = (ROOT / src).read_text(encoding='utf-8')
        if 'noindex' in html:
            errors.append(f'{src}: noindex (это тестовая версия из gh-pages?)')
        if 'class="tbd"' in html and not args.allow_tbd:
            n = html.count('class="tbd"')
            errors.append(f'{src}: остались жёлтые пометки ({n} шт.)')
        if START in html:
            errors.append(f'{src}: блок счётчиков уже вставлен')
        i = html.rfind('</body>')
        if i < 0:
            errors.append(f'{src}: нет </body>')
            continue
        built = html[:i] + '\n' + block + '\n' + html[i:]
        for m in MUST_HAVE:
            if m not in built:
                errors.append(f'{dst}: нет {m}')
        if '<?' in built:
            errors.append(f'{dst}: неожиданный PHP-тег')
        p = pkg / dst
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(built, encoding='utf-8')
    for src, dst in STATIC:
        p = pkg / dst
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / src, p)
    if errors:
        sys.exit('Пакет не собран:\n  ' + '\n  '.join(errors))

    manifest = ''.join(f'{sha((pkg / f).read_bytes())}  {f}\n' for f in ORDER)
    (out / 'MANIFEST.sha256').write_text(manifest, encoding='utf-8')

    expected = []
    if not args.no_live:
        for f, url in REPLACED.items():
            expected.append(f'{sha(live(url))}  {f}')
    conf = (
        '# deploy.conf для run_all.sh — собран tools/deploy/make_pkg.py\n'
        f'NAME="{args.name}"\n'
        f'BK="before-{args.name.replace("pestcontrol-deploy-", "")}_ftp.zip"\n'
        f'ORDER="{" ".join(ORDER)}"\n'
        f'REPLACED="{" ".join(REPLACED)}"\n'
        '# sha256 файлов, которые сайт отдаёт сейчас (до выкладки)\n'
        'EXPECTED_BEFORE="' + '\n'.join(expected) + '"\n'
    )
    (out / 'deploy.conf').write_text(conf, encoding='utf-8')
    shutil.copyfile(ROOT / 'tools' / 'deploy' / 'run_all.sh', out / 'run_all.sh')

    print(f'Пакет: {out}')
    print(manifest, end='')
    print('Текущие файлы сайта:' if expected else 'Текущие файлы сайта не запрашивались (--no-live)')
    for e in expected:
        print('  ' + e)
    if args.allow_tbd:
        print('ВНИМАНИЕ: проверочная сборка (--allow-tbd), не для выкладки')


if __name__ == '__main__':
    main()
