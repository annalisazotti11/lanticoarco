/* Sito: ingresso dall'arco, scintille del forno, capitoli animati, dati vivi dal gestionale */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ================= Ingresso: dal logo si entra nell'arco ================= */
  function startHero() { $('fuoco').classList.add('in'); }
  function intro() {
    if (!root.classList.contains('has-intro')) { startHero(); return; }
    var page = $('page'), logo = $('introLogo'), done = false;
    function finish() {
      if (done) return; done = true;
      page.style.clipPath = ''; root.classList.remove('has-intro');
      try { sessionStorage.setItem('aa-intro', '1'); } catch (e) {}
      startHero();
    }
    function run() {
      var r = logo.getBoundingClientRect();
      if (!r.width || !page.animate) { finish(); return; }
      var W = window.innerWidth, H = window.innerHeight;
      // vano dell'arco nel logo (proporzioni misurate sul disegno)
      var L = r.left + r.width * .325, R = r.left + r.width * .695, T = r.top + r.height * .5, B = r.top + r.height * .985;
      var rad = (R - L) / 2, cx = (L + R) / 2;
      var p0 = 'inset(' + (B - 2) + 'px ' + (W - cx - 2) + 'px ' + (H - B) + 'px ' + (cx - 2) + 'px round 2px 2px 0px 0px)';
      var p1 = 'inset(' + T + 'px ' + (W - R) + 'px ' + (H - B) + 'px ' + L + 'px round ' + rad + 'px ' + rad + 'px 0px 0px)';
      var p2 = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';
      page.style.clipPath = p0;
      var a1 = page.animate([{ clipPath: p0 }, { clipPath: p1 }], { duration: 700, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' });
      a1.onfinish = function () {
        setTimeout(function () {
          var a2 = page.animate([{ clipPath: p1 }, { clipPath: p2 }], { duration: 1100, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
          logo.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
          a2.onfinish = function () { a1.cancel(); a2.cancel(); finish(); };
        }, 350);
      };
    }
    $('intro').addEventListener('click', finish);
    var go = function () { setTimeout(run, 900); };
    if (logo.complete) go(); else { logo.onload = go; logo.onerror = finish; }
    setTimeout(finish, 6000);
  }
  intro();

  document.querySelectorAll('[data-arch-path]').forEach(function (p) { p.setAttribute('d', AA.ARCH_PATH); });

  /* ================= Scintille che salgono dal forno ================= */
  (function sparks() {
    var c = $('sparks');
    if (!c || reduce) return;
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W, H, ps = [], running = true;
    function size() { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function spawn(initial) {
      return {
        x: W * .15 + Math.random() * W * .7, y: initial ? Math.random() * H * .6 : H * .5 + Math.random() * H * .1,
        vy: .35 + Math.random() * 1.1, vx: (Math.random() - .5) * .3, r: .5 + Math.random() * 1.6,
        life: 0, max: 220 + Math.random() * 380, ph: Math.random() * 6.28, hue: 20 + Math.random() * 24
      };
    }
    function init() { size(); var n = Math.min(90, Math.round(W / 3)); ps = []; for (var i = 0; i < n; i++) ps.push(spawn(true)); }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.life++; p.y -= p.vy; p.ph += .03; p.x += p.vx + Math.sin(p.ph) * .3;
        var k = 1 - p.life / p.max, fl = .65 + Math.sin(p.life * .25 + p.ph) * .35;
        if (k <= 0 || p.y < -20) { ps[i] = spawn(false); continue; }
        var a = k * fl * .9;
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,60%,' + (a * .14) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'hsla(' + (p.hue + 15) + ',100%,' + (70 + k * 15) + '%,' + a + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    init(); tick();
    window.addEventListener('resize', function () { clearTimeout(c._t); c._t = setTimeout(init, 200); });
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running) { running = true; tick(); } else if (!vis) running = false;
    }).observe($('fuoco'));
  })();

  /* Bagliore che segue il mouse */
  var glow = $('glow');
  if (glow && window.matchMedia('(pointer: fine)').matches) {
    $('fuoco').addEventListener('pointermove', function (e) {
      var r = glow.getBoundingClientRect();
      glow.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      glow.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ================= Capitoli: comparsa, pallini, colore della barra ================= */
  var chapters = [].slice.call(document.querySelectorAll('.ch'));
  var dots = {};
  document.querySelectorAll('.nav-links a').forEach(function (a) { dots[a.dataset.ch] = a; });
  var nav = $('nav');
  window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && e.target.id !== 'fuoco') e.target.classList.add('in'); });
  }, { threshold: .18 });
  var spyIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var id = e.target.id;
      Object.keys(dots).forEach(function (k) { dots[k].setAttribute('aria-current', k === id ? 'true' : 'false'); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  chapters.forEach(function (c) { revealIO.observe(c); spyIO.observe(c); });

  /* ================= Storia: scorrimento a trascinamento ================= */
  (function track() {
    var t = $('track');
    if (!t) return;
    var down = false, sx = 0, sl = 0, moved = false;
    t.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = t.scrollLeft; t.classList.add('drag');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true;
      t.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () { if (down) { down = false; t.classList.remove('drag'); } });
    t.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    document.querySelectorAll('.track-ctl [data-dir]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = t.querySelector('.tc');
        t.scrollBy({ left: Number(b.dataset.dir) * (card ? card.offsetWidth + 18 : 300), behavior: 'smooth' });
      });
    });
  })();

  /* ================= Impasti: scegli il tuo ================= */
  var NUM = ['Zero', 'Un', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci', 'Undici', 'Dodici'];
  function doughs(data) {
    var sec = data.sections.filter(function (s) { return s.layout === 'cards' && s.visible; })[0];
    if (!sec) return;
    var items = AA.visibleItems(sec);
    var list = $('imList'), info = $('imInfo'), photo = $('imPhoto'), cur = -1, timer, user = false;
    $('imCount').textContent = NUM[items.length] || items.length;
    list.innerHTML = items.map(function (it, i) {
      return '<li><button type="button" data-i="' + i + '" aria-pressed="false">' + esc(it.name.replace(/^Impasto\s+/i, '')) + '</button></li>';
    }).join('');
    function show(i) {
      if (i === cur) return;
      cur = i;
      var it = items[i];
      list.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.i) === i); });
      var p = it.price == null ? '' : (Number(it.price) === 0 ? 'Impasto base, incluso' : AA.price(it.price, { signed: true }));
      info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
      info.innerHTML = '<h3>' + esc(it.name) + '</h3>' + (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') + (p ? '<span class="im-price">' + p + '</span>' : '');
      var src = it.image ? AA.src(it.image) : AA.ROOT + 'assets/img/impasti-grano.webp';
      photo.classList.remove('swap'); void photo.offsetWidth;
      photo.src = src; photo.classList.add('swap');
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      user = true; clearInterval(timer); show(Number(b.dataset.i));
    });
    var first = 0;
    for (var k = 0; k < items.length; k++) if (items[k].image) { first = k; break; }
    show(first);
    if (!reduce) timer = setInterval(function () { if (!user && $('impasti').classList.contains('in')) show((cur + 1) % items.length); }, 4200);
  }

  /* ================= Pizze: il carosello che gira ================= */
  function pizzas(data) {
    var items = [];
    data.sections.forEach(function (s) {
      if (!s.visible) return;
      s.items.forEach(function (it) { if (it.featured && it.available !== false && it.image) items.push(it); });
    });
    if (!items.length) return;
    var i = 0, timer, plate = document.querySelector('.pz-plate'), text = document.querySelector('.pz-text');
    function paint() {
      var it = items[i];
      $('pzName').textContent = it.name;
      $('pzDesc').textContent = it.desc || '';
      $('pzPrice').textContent = it.price != null ? AA.price(it.price) : '';
      $('pzBig').textContent = it.name;
      $('pzCount').textContent = (i + 1) + ' / ' + items.length;
      $('pzImg').src = AA.src(it.image);
      $('pzImg').alt = 'Pizza ' + it.name;
      text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap');
    }
    function go(d) {
      i = (i + d + items.length) % items.length;
      if (reduce) { paint(); return; }
      plate.classList.remove('inn'); plate.classList.add('out');
      setTimeout(function () { paint(); plate.classList.remove('out'); void plate.offsetWidth; plate.classList.add('inn'); }, 430);
    }
    $('pzPrev').onclick = function () { clearInterval(timer); go(-1); };
    $('pzNext').onclick = function () { clearInterval(timer); go(1); };
    paint();
    if (!reduce) timer = setInterval(function () { if ($('pizze').classList.contains('in')) go(1); }, 5500);
  }

  /* ================= Inserzioni nell'apertura ================= */
  function promos(data) {
    var list = AA.activePromos(data, 'site');
    var box = $('promoFloat');
    if (!list.length) return;
    var k = 0;
    function paint() {
      var p = list[k];
      box.classList.toggle('no-img', !p.image);
      box.innerHTML = (p.image ? '<img alt="" src="' + esc(AA.src(p.image)) + '">' : '') + '<div>' + (p.kicker ? '<p class="pf-k">' + esc(p.kicker) + '</p>' : '') +
        '<p class="pf-t">' + esc(p.title) + '</p>' + (p.price ? '<p class="pf-p">' + esc(p.price) + '</p>' : '') + '</div>';
      box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
    }
    box.hidden = false; paint();
    if (list.length > 1 && !reduce) setInterval(function () { k = (k + 1) % list.length; paint(); }, 5000);
  }

  /* ================= Dati vivi ================= */
  function bind(info) {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var key = el.dataset.bind, v = info[key];
      if (key === 'rating' && info.rating) v = String(info.rating.value).replace('.', ',');
      if (key === 'ratingCount' && info.rating) v = info.rating.count;
      if (v != null && v !== '') el.textContent = v;
    });
    document.querySelectorAll('[data-tel]').forEach(function (a) { var n = info[a.dataset.tel]; if (n) a.href = AA.telHref(n); });
    document.querySelectorAll('[data-mail]').forEach(function (a) { if (info.email) a.href = 'mailto:' + info.email; });
    if (info.hours && info.hours.length) {
      $('hours').innerHTML = info.hours.map(function (h) { return '<div><dt>' + esc(h.days) + '</dt><dd>' + esc(h.time) + '</dd></div>'; }).join('');
    }
    if (info.legal) {
      var l = [];
      if (info.legal.vat) l.push('<span>P.IVA ' + esc(info.legal.vat) + '</span>');
      if (info.legal.cf) l.push('<span>C.F. ' + esc(info.legal.cf) + '</span>');
      if (info.legal.rea) l.push('<span>REA ' + esc(info.legal.rea) + '</span>');
      $('legal').innerHTML = l.join('');
    }
  }

  AA.loadMenu().then(function (data) {
    var info = data.info || {};
    bind(info);
    var st = AA.openStatus(info);
    if (st) { var s = $('status'); s.hidden = false; s.textContent = st.text; s.classList.toggle('is-open', st.open); }
    var ann = AA.announcement(data);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    doughs(data); pizzas(data); promos(data);
  }).catch(function () {});
})();
