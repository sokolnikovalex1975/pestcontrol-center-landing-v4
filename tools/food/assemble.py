#!/usr/bin/env python3
"""Собирает черновик pishchevoe-proizvodstvo/index.html из шаблона страницы договора (ветка dogovor)."""
import re, pathlib
D = pathlib.Path(__file__).resolve().parent
ROOT = D.parent.parent
s = (D / 'template-dogovor.html').read_text(encoding='utf-8')
main = (D / 'main.html').read_text(encoding='utf-8')
css = (D / 'extra.css').read_text(encoding='utf-8').strip()
URL = 'https://xn----itbbsflddbfpfdodg9d0f.xn--p1ai/pishchevoe-proizvodstvo/'
TITLE = 'Пест-контроль на пищевом производстве в Москве и области | ПЕСТКОНТРОЛЬ Центр'
DESC = 'Пест-контроль пищевого предприятия по системе IPM: мониторинг грызунов и насекомых не реже 2 раз в месяц, программа и журналы для ХАССП, FSSC 22000 и аудитов торговых сетей. Бесплатное обследование.'
OGT = 'Пест-контроль на пищевом производстве в Москве и области'
NAME = 'Пест-контроль на пищевом производстве'
CTA = 'Бесплатный выезд'
def sub(pat, rep, txt, n=1, flags=re.S):
    out, k = re.subn(pat, rep, txt, count=n, flags=flags)
    assert k == n, (pat, k)
    return out
s = sub(r'<title>.*?</title>', f'<title>{TITLE}</title>', s)
s = sub(r'(<meta name="description" content=")[^"]*', r'\g<1>' + DESC, s)
s = sub(r'(<meta property="og:description" content=")[^"]*', r'\g<1>' + DESC, s)
s = sub(r'(<meta property="og:title" content=")[^"]*', r'\g<1>' + OGT, s)
s = s.replace('https://xn----itbbsflddbfpfdodg9d0f.xn--p1ai/dogovor-deratizatsiya-dezinsektsiya/', URL)
s = sub(r'"name":"Договор на дератизацию и дезинсекцию"', f'"name":"{NAME}"', s)
s = sub(r'(<link rel="preload" href="\.\./fonts/inter-ru-wght-normal\.woff2"[^>]*>)', r'\g<1>\n<link rel="preload" href="../img/food-hero.webp" as="image" media="(min-width:761px)">\n<link rel="preload" href="../img/food-hero-mob.webp" as="image" media="(max-width:760px)">', s)
s = sub(r'</style>', css + '</style>', s)
NAV = '<a href="#trebovaniya">Требования</a><a href="#zony">Зоны</a><a href="#ipm">IPM</a><a href="#dokumenty">Документы</a><a href="#stoimost">Цена</a><a href="#voprosy">Вопросы</a>'
s = sub(r'(<nav class="nav" aria-label="Основное меню">).*?(</nav>)', r'\g<1> ' + NAV + r' \g<2>', s)
s = sub(r'(<a href="#zayavka" class="btn btn-w btn-sm"[^>]*><span class="btn-t">)[^<]*', r'\g<1>' + CTA, s)
MM = '<a href="../">Главная</a><a href="#trebovaniya">Требования</a><a href="#zony">Зоны риска</a><a href="#ipm">Метод IPM</a><a href="#mesyac">Месяц обслуживания</a><a href="#dokumenty">Документы</a><a href="#stoimost">Цена</a><a href="#voprosy">Вопросы</a> <a href="#zayavka" class="btn btn-w btn-lg"><span class="btn-t">Заказать бесплатное обследование</span></a>'
s = sub(r'(<nav class="mmenu" id="mmenu" aria-label="Мобильное меню">).*?(</nav>)', r'\g<1> ' + MM + r' \g<2>', s)
s = sub(r'(<main id="main" tabindex="-1">).*?(<section class="cta" id="zayavka">)', lambda m: m.group(1) + '\n' + main + '\n' + m.group(2), s)
# заявка
s = sub(r'(<section class="cta" id="zayavka">.*?<h2>).*?(</h2>\s*<p class="sub">).*?(</p>)', lambda m: m.group(1) + 'Начните с бесплатного <em>обследования производства</em>' + m.group(2) + 'Пест-менеджер осмотрит зоны риска, точки контроля и папку документов. После выезда вы узнаете, что исправить до ближайшей проверки, и получите расчёт обслуживания.' + m.group(3), s)
MAIN = (ROOT / 'index.html').read_text(encoding='utf-8')
CL = re.search(r'<ul class="cta-list"[^>]*>.*?</ul>', MAIN, re.S).group(0)
CL = re.sub(r'\s*data-group="[^"]*"', '', CL)
for x, y in [('Аудит объекта\u00a0— бесплатно', 'Обследование производства\u00a0— бесплатно'), ('Программа и\u00a0расчёт\u00a0— после аудита', 'Программа и\u00a0расчёт\u00a0— после обследования')]:
    assert x in CL, x
    CL = CL.replace(x, y)
s = sub(r'(<section class="cta" id="zayavka">)', r'\g<1><div class="cta-bg f-lazy" aria-hidden="true"></div>', s)
s = sub(r'(<section class="cta" id="zayavka">.*?<p class="sub">.*?</p>)', lambda m: m.group(1) + ' ' + CL, s)
s = sub(r'<h3>Заявка на проект договора</h3>', '<h3>Заявка на бесплатное обследование</h3>', s)
FIELDS = '''<div class="fg">
<div class="field"><label class="sr-only" for="f-name">Ваше имя</label><input id="f-name" name="name" placeholder="Ваше имя" required autocomplete="name"><small class="ferr">Укажите имя</small></div>
<div class="field"><label class="sr-only" for="phone">Телефон</label><input name="phone" id="phone" type="tel" inputmode="tel" placeholder="+7 (___) ___-__-__" required autocomplete="tel"><small class="ferr">Укажите телефон полностью</small></div>
<div class="field full"><label class="sr-only" for="f-prod">Вид производства</label><select id="f-prod" name="production"><option value="" selected>Вид производства</option><option>Мясное</option><option>Молочное</option><option>Хлебобулочное</option><option>Кондитерское</option><option>Другое</option></select></div>
<div class="field full"><label class="sr-only" for="f-insp">Ближайшая проверка</label><select id="f-insp" name="inspection"><option value="" selected>Ближайшая проверка</option><option>Роспотребнадзор</option><option>Сертификация</option><option>Аудит торговой сети</option><option>Не планируется</option></select></div>
<div class="field full"><label class="sr-only" for="f-msg">Комментарий</label><textarea id="f-msg" name="msg" placeholder="Комментарий: вредители, площадь, сроки"></textarea></div>
<div class="field" hidden><input type="hidden" name="email" value=""></div>
<div class="field" hidden><input type="hidden" name="type" value="Пищевое производство"></div>
<input type="hidden" name="page" value="Пест-контроль на пищевом производстве">
</div>'''
s = sub(r'<div class="fg">.*?<input type="hidden" name="page" value="[^"]*">\s*</div>', lambda m: FIELDS, s)
s = sub(r'(<button type="submit" class="btn btn-w btn-lg" id="submitBtn"><span class="btn-t">)[^<]*', r'\g<1>Заказать обследование', s)
s = sub(r'согласовать день выезда', 'согласовать день обследования', s)
s = sub(r'(<a href="#zayavka" class="c2"><span>)[^<]*', r'\g<1>Обследование', s)
JS = '''<script>
/* Предпросмотр: вне рабочего домена заявка не отправляется (на пестконтроль-центр.рф этот блок не срабатывает) */
(function(){if(/^(www\\.)?xn----itbbsflddbfpfdodg9d0f\\.xn--p1ai$/i.test(location.hostname))return;var f=window.fetch;window.fetch=function(u){if(typeof u==='string'&&u.indexOf('send.php')>-1)return new Promise(function(r){setTimeout(function(){r(new Response('{"success":true}',{status:200,headers:{'Content-Type':'application/json'}}))},500)});return f.apply(this,arguments)};document.addEventListener('DOMContentLoaded',function(){var p=document.querySelector('.form .fs');if(p)p.textContent='Предпросмотр: заявка никуда не отправляется'})})();
/* самопроверка: счётчик отмеченных пунктов */
document.addEventListener('change',function(e){if(!e.target.closest('.f-check-list'))return;var n=0;document.querySelectorAll('.f-check-list input').forEach(function(i){n+=i.checked?1:0});document.getElementById('chk-n').textContent=n;document.querySelector('.f-check-res').classList.toggle('full',n===5);document.getElementById('chk-note').textContent=n===5?'Всё на месте — на обследовании проверим, как это работает на объекте.':'Чего-то не хватает — на бесплатном обследовании покажем, что добавить и в каком порядке.'});
/* схема зон: подсветка зоны по пункту списка и наоборот */
(function(){var map=document.querySelector('.f-zmap');if(!map)return;var plan=map.querySelector('.f-plan'),items=map.querySelectorAll('.f-zlist li');function set(z){plan.querySelectorAll('[data-z]').forEach(function(g){g.classList.toggle('on',g.getAttribute('data-z')===z)});items.forEach(function(li){li.classList.toggle('on',li.getAttribute('data-z')===z)})}items.forEach(function(li){var z=li.getAttribute('data-z');li.addEventListener('mouseenter',function(){set(z)});li.addEventListener('focus',function(){set(z)});li.addEventListener('click',function(){set(z)})});plan.querySelectorAll('.zf,.bdg').forEach(function(el){var g=el.closest('[data-z]');el.addEventListener('mouseenter',function(){set(g.getAttribute('data-z'))})});map.addEventListener('mouseleave',function(){set(null)})})();
</script>
'''
s = sub(r'(<script src="\.\./app\.min\.js)', JS + r'\g<1>', s)
for bad in ['проект договора', 'договор на дератизацию', 'tbd', 'ph-img']:
    assert bad not in re.sub(r'<footer.*?</footer>|<style>.*?</style>', '', s, flags=re.S).lower(), bad
s = sub(r'<li><a href="\./" aria-current="page">Договор на обслуживание</a></li>', '', s)
s = sub(r'<li><a href="\.\./#otrasli">Пищевые производства</a></li>', '<li><a href="./" aria-current="page">Пищевые производства</a></li>', s)
out = ROOT / 'pishchevoe-proizvodstvo' / 'index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(s, encoding='utf-8')
print('ok', out, len(s))
