/* ПЕСТКОНТРОЛЬ Центр — интерактив и анимации (GSAP + ScrollTrigger + Lenis, всё локально) */
(function () {
  'use strict';
  var html = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var anim = hasGSAP && !reduce;
  if (!anim) html.classList.add('anim-fail');
  html.classList.add('anim-ready');
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------- текст кнопок для эффекта «прокрутки» надписи ---------- */
  $$('.btn-t').forEach(function (el) {
    el.setAttribute('data-t', el.textContent.trim());
    el.innerHTML = '<span>' + el.innerHTML + '</span>';
  });
  /* ссылки-заглушки не прыгают наверх */
  $$('a[data-todo]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  /* ширина шкал риска для режимов без анимации */
  $$('.bar-f').forEach(function (b) { b.style.setProperty('--w', b.dataset.w + '%'); });

  /* ---------- плавный скролл ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  var scrollToEl = function (target, isTop) {
    if (lenis) lenis.scrollTo(isTop ? 0 : target, { offset: isTop ? 0 : -80, duration: 1.5, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else if (isTop) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- меню ---------- */
  var hdr = $('#hdr'), burger = $('#burger'), mmenu = $('#mmenu'), menuOpen = false;
  var setMenu = function (o) {
    if (o) { /* центр круга — по фактическому положению кнопки при любом масштабе */
      var r = burger.getBoundingClientRect();
      mmenu.style.setProperty('--mx', (r.left + r.width / 2) + 'px');
      mmenu.style.setProperty('--my', (r.top + r.height / 2) + 'px');
    }
    menuOpen = o;
    document.body.classList.toggle('menu-open', o);
    burger.setAttribute('aria-expanded', o);
    burger.setAttribute('aria-label', o ? 'Закрыть меню' : 'Открыть меню');
    hdr.classList.remove('hide');
    if (lenis) { o ? lenis.stop() : lenis.start(); }
  };
  burger.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) setMenu(false); });
  $$('.mmenu a').forEach(function (a, i) { a.style.setProperty('--d', (0.15 + i * 0.045) + 's'); }); /* задержка только при открытии */

  /* ---------- якоря ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var t = id === '#top' ? document.body : $(id);
      if (!t) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      scrollToEl(t, id === '#top');
      if (id === '#main') { t.focus({ preventScroll: true }); }
    });
  });

  /* ---------- шапка, прогресс, мобильная панель ---------- */
  var prog = $('#progress'), mbar = $('#mbar'), cta = $('#zayavka'), lastY = 0;
  var onScroll = function (y) {
    hdr.classList.toggle('scrolled', y > 30);
    if (!menuOpen) {
      if (y > lastY + 4 && y > 500) hdr.classList.add('hide');
      else if (y < lastY - 4 || y < 200) hdr.classList.remove('hide');
    }
    lastY = y;
    var max = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    var f = cta.getBoundingClientRect();
    mbar.classList.toggle('show', y > innerHeight * 0.6 && f.top > innerHeight * 0.5);
  };
  addEventListener('scroll', function () { onScroll(scrollY); }, { passive: true });
  onScroll(scrollY);
  /* клавиатурный фокус внутри шапки — показать шапку */
  hdr.addEventListener('focusin', function () { hdr.classList.remove('hide'); });

  /* активный пункт меню */
  var links = $$('.nav a');
  var so = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(function (l) { var s = $(l.getAttribute('href')); if (s) so.observe(s); });
  so.observe($('#hero'));

  /* ---------- FAQ ---------- */
  var refreshLater = (function () { var t; return function () { clearTimeout(t); t = setTimeout(function () { if (hasGSAP) ScrollTrigger.refresh(); }, 650); }; })();
  $$('.qa button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var qa = btn.parentElement, open = !qa.classList.contains('open');
      qa.classList.toggle('open', open); btn.setAttribute('aria-expanded', open);
      refreshLater();
    });
  });
  var firstQa = $('.qa');
  if (firstQa) { firstQa.classList.add('open'); $('button', firstQa).setAttribute('aria-expanded', true); }

  /* ---------- форма ---------- */
  var form = $('#form'), ph = $('#phone'), submitBtn = $('#submitBtn');
  $$('.field').forEach(function (f, i) {
    var err = $('.ferr', f), inp = $('input,select,textarea', f);
    if (err && inp) { err.id = 'err-' + i; inp.setAttribute('aria-describedby', err.id); }
    if (inp) inp.addEventListener('input', function () { f.classList.remove('err'); inp.removeAttribute('aria-invalid'); });
    if (inp && inp.tagName === 'SELECT') inp.addEventListener('change', function () { f.classList.remove('err'); inp.removeAttribute('aria-invalid'); });
  });
  ph.addEventListener('focus', function () { if (!ph.value) ph.value = '+7 ('; });
  ph.addEventListener('blur', function () { if (ph.value.replace(/\D/g, '').length <= 1) ph.value = ''; });
  ph.addEventListener('input', function () {
    var d = ph.value.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var p = d.slice(1), s = '+7';
    if (p.length) s += ' (' + p.slice(0, 3);
    if (p.length >= 3) s += ')';
    if (p.length > 3) s += ' ' + p.slice(3, 6);
    if (p.length > 6) s += '-' + p.slice(6, 8);
    if (p.length > 8) s += '-' + p.slice(8, 10);
    ph.value = s;
  });
  var checks = {
    name: function (v) { return v.trim().length > 1; },
    phone: function (v) { return v.replace(/\D/g, '').length === 11; },
    email: function (v) { return !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    type: function (v) { return !!v; }
  };
  /* отправка заявки: один запрос к send.php, цели — только после ответа сервера */
  /* превью на GitHub Pages: заявки никуда не отправляются, форма показывает успешную отправку */
  var DEMO = /\.github\.io$/i.test(location.hostname);
  var sending = false, FAIL_MSG = 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам: +7 (495) 085-10-95.';
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var ok = true, first = null;
    Object.keys(checks).forEach(function (n) {
      var el = form.elements[n], f = el.closest('.field'), bad = !checks[n](el.value);
      f.classList.remove('err');
      if (bad) { void f.offsetWidth; f.classList.add('err'); el.setAttribute('aria-invalid', 'true'); ok = false; first = first || el; }
      else el.removeAttribute('aria-invalid');
    });
    if (!ok) { first.focus(); return; }
    sending = true;
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    if (DEMO) { setTimeout(function () { form.classList.add('sent'); refreshLater(); }, 700); return; }
    fetch('/send.php', { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (res) {
        return res.text().then(function (txt) {
          var json = null;
          try { json = JSON.parse(txt); } catch (err) { /* ответ не JSON */ }
          if (!res.ok || !json || !json.success) {
            var er = new Error('send failed: ' + res.status);
            er.userMessage = json && json.message ? json.message : '';
            throw er;
          }
          return json;
        });
      })
      .then(function () {
        try { if (typeof ym === 'function') ym(113675622, 'reachGoal', 'audit'); } catch (err) { console.error('Яндекс Метрика:', err); }
        try {
          if (typeof Comagic !== 'undefined' && typeof Comagic.addOfflineRequest === 'function') {
            Comagic.addOfflineRequest({ name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim() });
          }
        } catch (err) { console.error('UIS:', err); }
        form.classList.add('sent');
        refreshLater();
      })
      .catch(function (err) {
        console.error('Ошибка отправки формы:', err);
        sending = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
        alert(err && err.userMessage ? err.userMessage : FAIL_MSG);
      });
  });

  if (!anim) return; /* дальше — только анимации */

  /* ================================================================ */
  var desk = matchMedia('(min-width: 1025px)').matches;
  var mobile = matchMedia('(max-width: 760px)').matches;

  /* ---------- разбивка текста на слова ---------- */
  function splitWords(el, plain) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/( +)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^ +$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            if (plain) { var s = document.createElement('span'); s.className = 'sw'; s.textContent = p; frag.appendChild(s); }
            else {
              var w = document.createElement('span'); w.className = 'w';
              var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = p;
              w.appendChild(wi); frag.appendChild(w);
            }
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ---------- курсор ---------- */
  if (fine) {
    html.classList.add('has-cursor');
    var cur = $('.cursor'), dot = $('.cursor-dot'), ring = $('.cursor-ring');
    var cx = -100, cy = -100, rx = -100, ry = -100;
    addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      var t = e.target;
      cur.classList.toggle('link', !!(t.closest && t.closest('a,button,select,label')));
      cur.classList.toggle('text', !!(t.closest && t.closest('input,textarea')));
      cur.classList.remove('hidden');
    }, { passive: true });
    addEventListener('pointerdown', function () { cur.classList.add('down'); });
    addEventListener('pointerup', function () { cur.classList.remove('down'); });
    document.addEventListener('pointerleave', function () { cur.classList.add('hidden'); });
    gsap.ticker.add(function () {
      rx += (cx - rx) * 0.2; ry += (cy - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    });
  }

  /* ---------- подсветка карточек за курсором ---------- */
  if (fine) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card,.form');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- магнитные кнопки и наклон карточек ---------- */
  if (fine) {
    $$('[data-magnet]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22); yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
    $$('[data-tilt]').forEach(function (el) {
      gsap.set(el, { transformPerspective: 1100 });
      var rX = gsap.quickTo(el, 'rotationX', { duration: 0.9, ease: 'power3' }), rY = gsap.quickTo(el, 'rotationY', { duration: 0.9, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        rY(px * 7); rX(-py * 7);
      });
      el.addEventListener('pointerleave', function () { rX(0); rY(0); });
    });
  }

  /* ---------- первый экран: «фонарь» инспектора, параллакс, наклон панели ---------- */
  var hero = $('#hero'), media = $('#heroMedia'), lit = $('#heroLit'), panel = $('#panel');
  var sx = 0.7, sy = 0.42, tx = 0.7, ty = 0.42, lastMove = -1e9, heroVisible = true;
  lit.style.setProperty('--sr', mobile ? '190px' : 'clamp(240px, 21vw, 400px)');
  new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe(hero);
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var r = media.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; lastMove = performance.now();
  });
  gsap.ticker.add(function () {
    if (!heroVisible) return;
    var now = performance.now();
    if (now - lastMove > 2600) {
      var t = now / 1000;
      tx = 0.66 + 0.2 * Math.sin(t * 0.33); ty = 0.46 + 0.17 * Math.sin(t * 0.47 + 1.3);
    }
    sx += (tx - sx) * 0.06; sy += (ty - sy) * 0.06;
    lit.style.setProperty('--sx', (sx * 100).toFixed(2) + '%');
    lit.style.setProperty('--sy', (sy * 100).toFixed(2) + '%');
  });
  if (fine) {
    var mX = gsap.quickTo(media, 'x', { duration: 1.4, ease: 'power3' }), mY = gsap.quickTo(media, 'y', { duration: 1.4, ease: 'power3' });
    var pY = gsap.quickTo(panel, 'rotationY', { duration: 1.1, ease: 'power3' }), pX = gsap.quickTo(panel, 'rotationX', { duration: 1.1, ease: 'power3' });
    gsap.set(panel, { transformPerspective: 1200 });
    hero.addEventListener('pointermove', function (e) {
      var px = e.clientX / innerWidth - 0.5, py = e.clientY / innerHeight - 0.5;
      mX(-px * 30); mY(-py * 20); pY(px * 9); pX(-py * 9);
      var r = panel.getBoundingClientRect();
      panel.style.setProperty('--gx', (e.clientX - r.left) + 'px'); panel.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
    hero.addEventListener('pointerleave', function () { mX(0); mY(0); pX(0); pY(0); });
  }
  /* уход первого экрана при прокрутке */
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    .to(media, { yPercent: 14, scale: 1.1, ease: 'none' }, 0)
    .to('.hero .wrap', { y: -110, opacity: 0.1, ease: 'none' }, 0);

  /* вход первого экрана */
  var heroLines = $$('.hero h1 .ln>span');
  gsap.set(heroLines, { y: 0, yPercent: 110, rotation: 3 });
  function heroIn() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.hero-bg,.hero-lit', { scale: 1.18 }, { scale: 1, duration: 2.6 }, 0)
      .to(lit, { opacity: 1, duration: 2 }, 0.4)
      .fromTo('.badge', { opacity: 0, y: 20, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1 }, 0.15)
      .to(heroLines, { yPercent: 0, rotation: 0, duration: 1.4, stagger: 0.11 }, 0.25)
      .fromTo('.lead', { opacity: 0, y: 24, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2 }, 0.65)
      .fromTo('.hero-ctas', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1 }, 0.8)
      .fromTo(panel, { opacity: 0, x: 70, rotationY: -14, filter: 'blur(10px)' }, { opacity: 1, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 1.6 }, 0.5)
      .fromTo('.panel li', { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.9, stagger: 0.08 }, 0.9)
      .fromTo('.scroll-cue', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.4);
  }

  /* ---------- заставка ---------- */
  var intro = $('#intro');
  if (!intro || location.hash) {
    if (intro) intro.remove();
    heroIn();
  } else {
    if (lenis) lenis.stop();
    gsap.timeline({ onComplete: function () { intro.remove(); if (lenis) lenis.start(); } })
      .to('.im-shield', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' })
      .to('.im-c,.im-x', { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out' }, '-=.4')
      .to('.intro-word', { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=.45')
      .to('.intro-bar i', { scaleX: 1, duration: 0.65, ease: 'power2.inOut' }, '-=.5')
      .to(intro, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.95, ease: 'expo.inOut' }, '+=.05')
      .add(heroIn, '-=.55');
  }

  /* ---------- бегущая строка, реагирующая на скорость прокрутки ---------- */
  var track = $('#stripTrack'), set1 = track.firstElementChild, sw = set1.offsetWidth, mx = 0, dir = 1, skew = 0;
  addEventListener('resize', function () { sw = set1.offsetWidth; });
  gsap.ticker.add(function (t, dt) {
    var v = lenis ? lenis.velocity : 0;
    if (v > 0.4) dir = 1; else if (v < -0.4) dir = -1;
    mx -= (0.7 + Math.min(Math.abs(v) * 0.3, 12)) * dir * (dt / 16.7);
    if (mx <= -sw) mx += sw; if (mx > 0) mx -= sw;
    skew += (Math.max(-7, Math.min(7, -v * 0.4)) - skew) * 0.12;
    track.style.transform = 'translate3d(' + mx.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
  });

  /* ---------- надзаголовки, заголовки, подзаголовки ---------- */
  $$('[data-eyebrow]').forEach(function (el) {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { el.classList.add('in'); } });
  });
  $$('[data-split]').forEach(function (h) {
    splitWords(h);
    var ws = $$('.wi', h);
    gsap.set(ws, { yPercent: 118, rotation: 5 });
    h.style.visibility = 'visible';
    gsap.to(ws, { yPercent: 0, rotation: 0, duration: 1.25, ease: 'expo.out', stagger: 0.055, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });
  $$('[data-fade]').forEach(function (el) {
    gsap.fromTo(el, { opacity: 0, y: 34, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  $$('[data-scrub]').forEach(function (p) {
    splitWords(p, true);
    gsap.fromTo($$('.sw', p), { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: p, start: 'top 86%', end: 'bottom 52%', scrub: 0.6 } });
  });

  /* ---------- группы карточек ---------- */
  var group = function (name) { return $$('[data-group="' + name + '"]'); };
  var onceST = function (trigger, fn, start) { ScrollTrigger.create({ trigger: trigger, start: start || 'top 85%', once: true, onEnter: fn }); };

  group('tasks').forEach(function (g) {
    var items = $$(':scope>*', g);
    gsap.set(items, { transformPerspective: 1200, transformOrigin: '50% 0%' });
    onceST(g, function () {
      gsap.fromTo(items, { opacity: 0, y: 90, rotationX: -28 }, { opacity: 1, y: 0, rotationX: 0, duration: 1.5, ease: 'expo.out', stagger: 0.13 });
    });
  });

  group('pests').forEach(function (g) {
    $$(':scope>*', g).forEach(function (card, i) {
      onceST(card, function () {
        var d = (i % 2) * 0.1;
        gsap.fromTo(card, { opacity: 0, y: 60, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: 'expo.out', delay: d });
        gsap.fromTo($('.pest-img img', card), { scale: 1.45, filter: 'grayscale(1) brightness(.6)' }, { scale: 1, filter: 'grayscale(0) brightness(1)', duration: 1.6, ease: 'expo.out', delay: d + 0.1, clearProps: 'filter' });
        var b = $('.bar-f', card);
        gsap.fromTo(b, { width: '0%' }, { width: b.dataset.w + '%', duration: 1.8, ease: 'expo.out', delay: d + 0.35 });
        setTimeout(function () { card.classList.add('scanned'); }, (d + 0.3) * 1000);
      }, 'top 88%');
    });
  });

  group('steps').forEach(function (g) {
    onceST(g, function () {
      gsap.fromTo($$(':scope>*', g), { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, clearProps: 'transform' });
    });
  });

  group('inds').forEach(function (g) {
    $$(':scope>*', g).forEach(function (card, i) {
      var img = $('.ind-img', card), pic = $('img', img);
      onceST(card, function () {
        var d = (i % (desk ? 3 : 2)) * 0.12;
        gsap.fromTo(card, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out', delay: d });
        gsap.fromTo(img, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', delay: d + 0.05 });
        gsap.fromTo(pic, { scale: 1.35 }, { scale: 1, duration: 2, ease: 'expo.out', delay: d + 0.05 });
      }, 'top 90%');
    });
  });

  group('docs').forEach(function (g) {
    var items = $$(':scope>*', g);
    onceST(g, function () {
      gsap.fromTo(items, { opacity: 0, y: 110, scale: 0.9, rotation: function (i) { return [-6, 3, 7, -4, 5, -7][i % 6]; } },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.4, ease: 'expo.out', stagger: 0.08 });
    }, 'top 82%');
  });

  group('kpis').forEach(function (g) {
    var items = $$(':scope>*', g);
    onceST(g, function () {
      gsap.fromTo(items, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 });
      items.forEach(function (k, i) {
        setTimeout(function () { k.classList.add('lit'); }, 200 + i * 160);
        var b = $('b[data-count]', k);
        if (!b) return;
        var to = +b.dataset.count, suf = b.dataset.suf || '', o = { v: 0 };
        if (!to) return;
        gsap.to(o, { v: to, duration: 1.8, ease: 'expo.out', delay: 0.15 + i * 0.1, onUpdate: function () { b.textContent = Math.round(o.v) + suf; } });
      });
    });
  });

  group('cases').forEach(function (g) {
    $$(':scope>*', g).forEach(function (card, i) {
      var img = $('.case-img', card), pic = $('img', img);
      onceST(card, function () {
        var d = i * 0.12;
        gsap.fromTo(card, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out', delay: d });
        gsap.fromTo(img, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', delay: d });
        gsap.fromTo(pic, { scale: 1.3 }, { scale: 1, duration: 2, ease: 'expo.out', delay: d });
        gsap.fromTo($$('.case-k>div', card), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1, delay: d + 0.6 });
      }, 'top 88%');
    });
  });

  group('faq').forEach(function (g) {
    var items = $$(':scope>*', g);
    onceST(g, function () {
      gsap.fromTo(items, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform' });
    }, 'top 88%');
  });

  group('ctalist').forEach(function (g) {
    onceST(g, function () {
      gsap.fromTo($$(':scope>*', g), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', stagger: 0.1 });
    }, 'top 90%');
  });

  var formEl = $('[data-form]');
  onceST(formEl, function () {
    gsap.fromTo(formEl, { opacity: 0, y: 70, rotationY: desk ? -10 : 0, transformPerspective: 1400, filter: 'blur(12px)' },
      { opacity: 1, y: 0, rotationY: 0, filter: 'blur(0px)', duration: 1.6, ease: 'expo.out', clearProps: 'filter' });
    gsap.fromTo($$('.field', formEl), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.35, clearProps: 'transform' });
  }, 'top 88%');

  /* ---------- параллакс изображений и фонов ---------- */
  $$('img[data-parallax]').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('[data-parallax-bg]').forEach(function (bg) {
    gsap.fromTo(bg, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- подход: цикл IPM управляется прокруткой ---------- */
  var steps = $$('.step'), nodes = $$('.node'), cProg = $('#cycleProg'), cArc = $('#cycleArc'), cLbl = $('#cycleStep'), curStep = -1;
  var setOn = function (i) {
    if (i === curStep) return; curStep = i;
    steps.forEach(function (s, j) { s.classList.toggle('on', j === i); });
    nodes.forEach(function (n, j) { n.classList.toggle('on', j === i); });
    cLbl.textContent = '0' + (i + 1) + ' / 04';
    gsap.fromTo(cLbl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  };
  setOn(0);
  ScrollTrigger.create({
    trigger: desk ? '#podhod' : '#cycle', start: desk ? 'top 55%' : 'top 85%', end: desk ? 'bottom 75%' : 'bottom 30%', scrub: true,
    onUpdate: function (s) {
      var p = s.progress;
      cProg.style.strokeDashoffset = (100 - p * 100).toFixed(2);
      cArc.style.transform = 'rotate(' + (p * 540).toFixed(1) + 'deg)';
      if (desk) setOn(Math.min(3, Math.floor(p * 4)));
    }
  });
  if (!desk) {
    steps.forEach(function (s, i) {
      ScrollTrigger.create({ trigger: s, start: 'top 62%', end: 'bottom 62%', onToggle: function (st) { if (st.isActive) setOn(i); } });
    });
    var auto = null;
    ScrollTrigger.create({ trigger: '#cycle', start: 'top 80%', end: 'bottom 20%',
      onToggle: function (st) { clearInterval(auto); if (st.isActive) auto = setInterval(function () { setOn((curStep + 1) % 4); }, 1800); } });
  }
  steps.forEach(function (s, i) { s.addEventListener('pointerenter', function () { if (fine) setOn(i); }); });

  /* ---------- этапы: линия, точки, раскрытие фото ---------- */
  var tlHead = $('#tlhead');
  gsap.to('#tlprog', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#tl', start: 'top 62%', end: 'bottom 62%', scrub: 0.5,
    onUpdate: function (s) { tlHead.style.top = (s.progress * 100).toFixed(2) + '%'; tlHead.style.opacity = s.progress > 0 && s.progress < 1 ? 1 : 0; } } });
  $$('.tl-row').forEach(function (row) {
    var flip = row.classList.contains('flip'), txt = $('.tl-txt', row), box = $('.tl-img', row), pic = $('img', box);
    var from = mobile ? 'inset(0% 0% 100% 0%)' : (flip ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)');
    onceST(row, function () {
      row.classList.add('in');
      gsap.fromTo(txt, { opacity: 0, x: mobile ? 0 : (flip ? 50 : -50), y: mobile ? 24 : 0, filter: 'blur(8px)' }, { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', clearProps: 'filter' });
      gsap.fromTo(box, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' });
      gsap.fromTo(pic, { scale: 1.3 }, { scale: 1, duration: 2.2, ease: 'expo.out' });
    }, 'top 72%');
  });

  /* ---------- заявка: свечение следует за курсором ---------- */
  var orb = $('#orb');
  gsap.set(orb, { xPercent: -50, yPercent: -50, x: cta.offsetWidth * 0.5, y: cta.offsetHeight * 0.5 });
  if (fine) {
    var oX = gsap.quickTo(orb, 'x', { duration: 2.2, ease: 'power3' }), oY = gsap.quickTo(orb, 'y', { duration: 2.2, ease: 'power3' });
    cta.addEventListener('pointermove', function (e) { var r = cta.getBoundingClientRect(); oX(e.clientX - r.left); oY(e.clientY - r.top); });
    cta.addEventListener('pointerleave', function () { oX(cta.offsetWidth * 0.5); oY(cta.offsetHeight * 0.5); });
  } else {
    gsap.to(orb, { x: '+=' + Math.round(innerWidth * 0.15), y: '-=80', duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ---------- подвал ---------- */
  gsap.fromTo('.ft>div', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: 'footer', start: 'top 92%', once: true } });

  /* пересчёт после загрузки шрифтов и изображений */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
