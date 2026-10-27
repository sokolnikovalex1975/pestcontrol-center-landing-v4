#!/usr/bin/env python3
"""Сборка главной страницы для быстрой загрузки.

1. Встраивает сжатый style.css прямо в index.html (между метками <!-- style:start --> и <!-- style:end -->):
   браузеру не нужен отдельный запрос за стилями, первый экран рисуется на один сетевой круг раньше.
2. Сжимает app.js в app.min.js — его и подключает страница.

Исходники для правок — style.css и app.js. После любой правки в них запустите из корня репозитория:

    python3 tools/build.py

Нужен Node.js (используется npx esbuild). Скрипт ничего не публикует, только обновляет index.html и app.min.js.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ESBUILD = ['npx', '--yes', 'esbuild@0.24.2']


def run(args, **kw):
    res = subprocess.run(ESBUILD + args, cwd=ROOT, capture_output=True, text=True, **kw)
    if res.returncode != 0:
        sys.exit('esbuild: ' + res.stderr)
    return res.stdout


def main():
    css = run(['style.css', '--minify', '--loader:.css=css', '--charset=utf8', '--log-level=warning']).strip()
    run(['app.js', '--minify', '--target=es2015', '--charset=utf8', '--outfile=app.min.js', '--log-level=warning'])

    index = ROOT / 'index.html'
    html = index.read_text(encoding='utf-8')
    block = re.compile(r'<!-- style:start -->.*?<!-- style:end -->', re.S)
    if not block.search(html):
        sys.exit('В index.html нет меток <!-- style:start --> … <!-- style:end -->')
    new_block = '<!-- style:start --><style>' + css + '</style><!-- style:end -->'
    html = block.sub(lambda m: new_block, html, count=1)
    index.write_text(html, encoding='utf-8')

    js = (ROOT / 'app.min.js').stat().st_size
    print(f'index.html: встроено {len(css.encode()) // 1024} КБ стилей; app.min.js: {js // 1024} КБ')


if __name__ == '__main__':
    main()
