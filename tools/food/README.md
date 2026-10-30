# Страница «Пест-контроль на пищевом производстве»

- Страница: `pishchevoe-proizvodstvo/index.html` (адрес на сайте — `/pishchevoe-proizvodstvo/`). Общие `../style.css`, `../app.min.js`, `../fonts/` и картинки главной.
- Сборка: `python3 tools/food/assemble.py` — из шаблона `template-dogovor.html` (шапка, подвал, форма), текстов `main.html` и стилей `extra.css`.
- Новые картинки: `img/food-hero.webp`, `img/food-hero-mob.webp`, `img/ind-dairy*.webp`, `img/ind-confect*.webp`, `img/ind-ready*.webp`, `img/p-ant.webp`. Мастер-файлы PNG — в файлах проекта Perplexity («Изображения (мастер)»), в репозиторий не кладутся.
- Предпросмотр — на GitHub Pages (ветка `gh-pages`, с noindex). На сайт не выложено.
- При выкладке на сайт: `index.html` → `index.php` с блоком из `server/counters.html` перед `</body>`; в `send.php` добавить поля `production`, `inspection`, `page`; поднять `?v=` у `style.css`; добавить адрес в `server/sitemap.xml`; на главной поставить ссылку из карточки «Пищевые производства». Блок предпросмотра в конце страницы (подмена отправки заявки вне рабочего домена) можно удалить.
