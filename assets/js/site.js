/* Sito: si entra da un arco di fuoco, la pizza sale sopra il fuoco, dati vivi dal gestionale */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* Scorrimento morbido con rotella e trackpad; sul telefono resta quello nativo */
  var lenis = null;
  if (!reduce && window.Lenis && matchMedia("(pointer: fine)").matches) {
    try {
      lenis = new window.Lenis({ autoRaf: true, lerp: .085, wheelMultiplier: .95, anchors: { offset: -84 } });
      window.__lenis = lenis;
    } catch (e) { lenis = null; }
  }
  function scrollToY(y) { if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' }); }

  document.querySelectorAll('[data-years]').forEach(function (el) { el.textContent = new Date().getFullYear() - 2001; });

  /* Hero V8: movimento soltanto durante lo scroll; fotografia fissa a riposo. */
  (function heroV8() {
    var hero = $('fuoco'), scene = $('heroStick'), nav = $('nav'), pending = false;
    if (!hero || !scene || !nav) return;
    function update() {
      pending = false;
      var range = hero.offsetHeight - scene.offsetHeight;
      var p = range <= 1 || reduce ? 0 : clamp((nav.offsetHeight - hero.getBoundingClientRect().top) / range, 0, 1);
      hero.style.setProperty('--p', p.toFixed(4));
    }
    function request() { if (!pending) { pending = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, {passive:true});
    window.addEventListener('resize', request);
    update();
  })();

  /* ================= Titoli che entrano parola per parola ================= */
  function splitWords(el) {
    var nodes = [].slice.call(el.childNodes), out = document.createDocumentFragment(), i = 0;
    function word(content) {
      var w = document.createElement('span'); w.className = 'w';
      var inner = document.createElement('span'); inner.style.setProperty('--i', i++);
      if (typeof content === 'string') inner.textContent = content; else inner.appendChild(content);
      w.appendChild(inner); return w;
    }
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) out.appendChild(document.createTextNode(' ')); else out.appendChild(word(part));
        });
      } else if (n.nodeType === 1 && n.tagName === 'BR') { out.appendChild(n); }
      else out.appendChild(word(n));
    });
    el.innerHTML = ''; el.appendChild(out); el.classList.add('words'); el.removeAttribute('data-rv');
  }

  /* ================= Numeri che contano ================= */
  function countUp(el) {
    var txt = el.textContent.trim(), dec = txt.indexOf(',') >= 0 ? (txt.split(',')[1] || '').length : 0;
    var target = parseFloat(txt.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(target) || reduce) return;
    var t0 = performance.now(), dur = 1500;
    (function step(now) {
      var k = clamp((now - t0) / dur, 0, 1), v = target * easeOut(k);
      var parts = v.toFixed(dec).split('.');
      el.textContent = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + parts[1] : '');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  var countIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { countIO.unobserve(e.target); countUp(e.target); } });
  }, { threshold: .6 });
  function watchCounts() { document.querySelectorAll('[data-count]').forEach(function (el) { countIO.observe(el); }); }

  /* ================= Pizze: la luce segue il puntatore ================= */
  (function pointerLight() {
    var sec = $('pizze'), stage = document.querySelector('.pz-stage');
    if (!sec || reduce || !window.matchMedia('(pointer: fine)').matches) return;
    var raf2 = 0, mx = .75, my = .5;
    sec.addEventListener('pointermove', function (e) {
      var r = sec.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
      if (!raf2) raf2 = requestAnimationFrame(function () {
        raf2 = 0;
        sec.style.setProperty('--lx', (mx * 100).toFixed(1) + '%');
        sec.style.setProperty('--ly', (my * 100).toFixed(1) + '%');
        if (stage) {
          var sr = stage.getBoundingClientRect(), cx = (sr.left + sr.width / 2 - r.left) / r.width, cy = (sr.top + sr.height / 2 - r.top) / r.height;
          stage.style.setProperty('--rx', ((cy - my) * 10).toFixed(2) + 'deg');
          stage.style.setProperty('--ry', ((mx - cx) * 12).toFixed(2) + 'deg');
        }
      });
    });
    sec.addEventListener('pointerleave', function () { if (stage) { stage.style.setProperty('--rx', '0deg'); stage.style.setProperty('--ry', '0deg'); } });
  })();

  /* ================= Capitoli: comparsa e voce attiva nella barra ================= */
  var chapters = [].slice.call(document.querySelectorAll('.ch'));
  var nav = $('nav');
  window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { rootMargin: '0px 0px -14% 0px' });
  // la pizza è lunga: lì ogni blocco compare quando arriva davvero sullo schermo
  chapters.forEach(function (c) {
    if (c.id === 'pizza') c.querySelectorAll(':scope > *').forEach(function (el) { revealIO.observe(el); });
    else revealIO.observe(c);
  });
  if (reduce) document.querySelectorAll('#pizza > *').forEach(function (el) { el.classList.add('in'); });

  /* ================= Storia: la miccia accende gli anni ================= */
  var sparkTrail = (function () {
    var tl = $('tl');
    if (!tl || reduce) return null;
    var c = document.createElement('canvas');
    c.className = 'tl-sparks'; c.setAttribute('aria-hidden', 'true');
    tl.appendChild(c);
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var CW = 200, CH = 260, HX = 100, HY = 150, ps = [], running = false, lastFill = null;
    c.width = CW * dpr; c.height = CH * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    function emit(n, power) {
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.5, sp = (.6 + Math.random() * 1.8) * power;
        ps.push({ x: HX, y: HY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 30 + Math.random() * 45, r: .6 + Math.random() * 1.5, star: Math.random() < .25, rot: Math.random() * 3 });
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    function star(x, y, r, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
      for (var k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * .35, r * .35, r * 3, 0); ctx.quadraticCurveTo(r * .35, -r * .35, 0, 0); }
      ctx.fill(); ctx.restore();
    }
    function tick() {
      ctx.clearRect(0, 0, CW, CH);
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.life++; p.x += p.vx; p.y += p.vy; p.vx *= .96; p.vy = p.vy * .96 + .035; p.rot += .08;
        var k = 1 - p.life / p.max;
        if (k <= 0) { ps.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(26,20,16,' + (k * .85).toFixed(3) + ')';
        if (p.star) star(p.x, p.y, p.r * 1.3, p.rot);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k + .3, 0, 6.283); ctx.fill(); }
      }
      if (ps.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, CW, CH); }
    }
    var tlSeen = false;
    new IntersectionObserver(function (es) { tlSeen = es[0].isIntersecting; }).observe(tl);
    setInterval(function () { if (tlSeen && lastFill !== null && document.visibilityState === 'visible') emit(1, .7); }, 220);
    return {
      move: function (fill) {
        if (lastFill !== null) {
          var d = fill - lastFill;
          ps.forEach(function (p) { p.y -= d; });         // le scintille restano dove sono nate
          if (Math.abs(d) > 1) emit(Math.min(6, 1 + Math.round(Math.abs(d) / 14)), 1);
        }
        lastFill = fill;
        c.style.transform = 'translateY(' + (fill - HY + 14) + 'px)';
      },
      burst: function (y) { emit(14, 1.6); }
    };
  })();
  (function fuse() {
    var tl = $('tl');
    if (!tl) return;
    var items = [].slice.call(tl.querySelectorAll('.tl-i')), pend = 0;
    function paint() {
      pend = 0;
      var r = tl.getBoundingClientRect(), vh = window.innerHeight;
      var fill = reduce ? r.height : clamp(vh * .62 - r.top, 0, r.height - 14);
      tl.style.setProperty('--fill', fill + 'px');
      if (sparkTrail) sparkTrail.move(fill);
      items.forEach(function (li) {
        var on = li.offsetTop <= fill + 6;
        if (on && !li.classList.contains('lit') && sparkTrail && fill > 20) sparkTrail.burst();
        li.classList.toggle('lit', on);
      });
    }
    window.addEventListener('scroll', function () { if (!pend) pend = requestAnimationFrame(paint); }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  })();

  /* ================= Impasti: scegli il tuo ================= */
  var NUM = ['Zero', 'Un', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto', 'Nove', 'Dieci', 'Undici', 'Dodici'];
  function doughs(data) {
    var sec = data.sections.filter(function (s) { return s.layout === 'cards' && s.visible; })[0];
    if (!sec) return;
    var items = AA.visibleItems(sec);
    var list = $('imList'), info = $('imInfo'), photo = $('imPhoto'), cur = -1, timer, user = false;
    $('imCount').textContent = NUM[items.length] || items.length;
    document.querySelectorAll('[data-n="impasti"]').forEach(function (el) { el.textContent = (NUM[items.length] || String(items.length)).toLowerCase(); });
    var LOOK = [
      [/carbone/i, ['#3b3532', '#121010']],
      [/canapa/i, ['#c6b48c', '#8d7c58'], '#4e4232'],
      [/cereali/i, ['#d2ae7c', '#9c7647'], '#3d2c1c'],
      [/curcuma/i, ['#f3c95a', '#d39a23'], '#2a2016'],
      [/farro/i, ['#cfa476', '#9a6f45']],
      [/khorasan|kamut/i, ['#ecc479', '#c2903e']],
      [/cappelli/i, ['#f2d690', '#d2ab55']],
      [/glutine/i, ['#f6ecd6', '#e1cda5']],
      [/./, ['#f1e2c3', '#d9bf8e']]
    ];
    function look(it) { for (var k = 0; k < LOOK.length; k++) if (LOOK[k][0].test(it.name)) return LOOK[k]; }
    function swStyle(lk) { return '--c1:' + lk[1][0] + ';--c2:' + lk[1][1] + (lk[2] ? ';--sd:' + lk[2] : ''); }
    list.innerHTML = items.map(function (it, i) {
      var label = it.name.replace(/^Impasto\s+/i, '').replace(/\s*\(.*?\)/g, '').replace(/\s*(100%\s*)?bio$/i, '').replace(/\s+da (noi prodotto|cocco)$/i, '').replace(/ e semi di sesamo nero/i, ' e sesamo').trim();
      label = label.charAt(0).toUpperCase() + label.slice(1);
      var lk = look(it);
      return '<li><button type="button" data-i="' + i + '" aria-pressed="false"><i class="sw' + (lk[2] ? ' seeds' : '') + '" style="' + swStyle(lk) + '" aria-hidden="true"></i>' + esc(label) + '</button></li>';
    }).join('');
    function shortOf(it) {
      if (it.short) return it.short;
      var d = String(it.desc || ''), m = d.match(/^[^.]{10,140}\./);
      return m ? m[0] : d.slice(0, 140);
    }
    function show(i) {
      if (i === cur) return;
      cur = i;
      var it = items[i];
      list.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.i) === i); });
      info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
      var lk = look(it), name = it.name.replace(/^Impasto\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); });
      info.innerHTML = '<h3>' + esc(name) + '</h3><p>' + esc(shortOf(it)) + '</p>';
      var frame = photo.parentNode;
      frame.className = 'im-photo' + (it.image ? '' : ' dough' + (lk[2] ? ' seeds' : ''));
      frame.setAttribute('style', swStyle(lk));
      photo.classList.remove('swap'); void photo.offsetWidth;
      if (it.image) photo.src = AA.src(it.image);
      photo.classList.add('swap');
    }
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      user = true; clearInterval(timer); show(Number(b.dataset.i));
    });
    var first = 0;
    for (var k = 0; k < items.length; k++) if (items[k].image) { first = k; break; }
    show(first);
    var seen = false;
    new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: .4 }).observe($('impasti'));
    // Impasti: cambia solo su scelta del cliente.
  }

  /* ================= Pizze: che voglia hai? ================= */
  var HINTS = [
    [/gourmet/i, 'Le ricette di casa, con prodotti del territorio e presìdi Slow Food.'],
    [/classic/i, 'Le pizze di sempre, con pomodoro 100% italiano e basilico fresco.'],
    [/bianc/i, 'Senza pomodoro: mozzarella, verdure, salumi e formaggi.'],
    [/vegan/i, 'Nessun ingrediente di origine animale.']
  ];
  function pizzas(data) {
    var tabs = [];
    data.sections.forEach(function (s) {
      if (!s.visible || s.group !== 'pizze') return;
      var all = AA.visibleItems(s).filter(function (it) { return it.available !== false; });
      var list = all.filter(function (it) { return it.image || it.cutout; });
      if (!list.length) return;
      list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
      var hint = s.subtitle || '';
      HINTS.forEach(function (h) { if (!hint && h[0].test(s.name)) hint = h[1]; });
      tabs.push({ sec: s, items: list, total: all.length, hint: hint, label: s.name.replace(/^Pizze\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); }) });
    });
    if (!tabs.length) return;
    var tabBox = $('pzTabs'), plate = $('pzPlate'), card = $('pzCard');
    var t = 0, i = 0;
    var cutouts = window.AAPizzaCutouts || {};
    function pizzaAsset(it) { return cutouts[it.image] || it.cutout || it.image; }
    function prefetch(it) { if (it) { var p = new Image(); p.decoding = 'async'; p.src = AA.src(pizzaAsset(it)); } }
    tabBox.innerHTML = tabs.map(function (tb, k) {
      return '<button type="button" role="tab" id="pzTab' + k + '" data-k="' + k + '" aria-controls="pzCard" tabindex="' + (k === 0 ? 0 : -1) + '" aria-selected="' + (k === 0) + '">' + esc(tb.label) + '</button>';
    }).join('');
    function paint() {
      var tb = tabs[t], it = tb.items[i];
      $('pzName').textContent = it.name;
      $('pzDesc').textContent = it.desc || '';
      $('pzTags').innerHTML = (it.tags || []).map(function (c) { var tg = AA.TAG_BY_CODE[c]; return tg ? '<span>' + esc(tg.short) + '</span>' : ''; }).join('') + (it.featured ? '<span>Preferita</span>' : '');
      $('pzCount').textContent = (i + 1) + ' / ' + tb.items.length;
      var img = $('pzImg');
      plate.classList.toggle('photo', !(cutouts[it.image] || it.cutout));
      img.src = AA.src(pizzaAsset(it));
      img.alt = 'Pizza ' + it.name;
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      prefetch(tb.items[(i + 1) % tb.items.length]);
      prefetch(tb.items[(i - 1 + tb.items.length) % tb.items.length]);
    }
    function swapTo(fn) {
      fn(); paint();
      plate.classList.remove('out', 'inn');
      if (!reduce) { void plate.offsetWidth; plate.classList.add('inn'); }
    }
    function setTab(k) {
      t = k; i = 0;
      tabBox.querySelectorAll('button').forEach(function (b) { var selected = Number(b.dataset.k) === k; b.setAttribute('aria-selected', selected); b.tabIndex = selected ? 0 : -1; });
      card.setAttribute('role', 'tabpanel'); card.setAttribute('aria-labelledby', 'pzTab' + k);
      $('pzHint').textContent = tabs[k].hint;
      var a = $('pzAll');
      a.href = AA.ROOT + 'menu/#' + encodeURIComponent(tabs[k].sec.id);
      a.textContent = 'Tutte le ' + tabs[k].total + ' nel menu';
    }
    tabBox.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || Number(b.dataset.k) === t) return;
      var k = Number(b.dataset.k); swapTo(function () { setTab(k); });
    });
    tabBox.addEventListener('keydown', function (e) {
      var k = t;
      if (e.key === 'ArrowRight') k = (t + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') k = (t - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = tabs.length - 1;
      else return;
      e.preventDefault(); swapTo(function () { setTab(k); });
      tabBox.querySelector('[data-k="' + k + '"]').focus();
    });
    $('pzPrev').onclick = function () { swapTo(function () { i = (i - 1 + tabs[t].items.length) % tabs[t].items.length; }); };
    $('pzNext').onclick = function () { swapTo(function () { i = (i + 1) % tabs[t].items.length; }); };
    // scorrimento col dito sulla pizza
    var sx = null, sy = null;
    plate.parentNode.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    plate.parentNode.addEventListener('touchend', function (e) {
      if (sx == null) return; var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = sy = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.25) (dx < 0 ? $('pzNext') : $('pzPrev')).click();
    });
    plate.parentNode.addEventListener('touchcancel', function () { sx = sy = null; }, { passive: true });
    setTab(0); paint();
    // Pizze: cambia solo su scelta del cliente.
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
      box.innerHTML = '<div class="v19-news-inner">' + (p.image ? '<img class="v19-news-photo" alt="" src="' + esc(AA.src(p.image)) + '">' : '<span class="v19-news-symbol" aria-hidden="true">✦</span>') + '<div class="v19-news-copy"><p class="v19-news-label">' + esc(p.kicker || 'Da provare') + '</p><p class="v19-news-title">' + esc(p.title) + '</p>' + (p.price ? '<p class="v19-news-price">' + esc(p.price) + '</p>' : '') + '</div><a class="v19-news-link" href="' + AA.ROOT + 'menu/">Guarda il menù <span aria-hidden="true">↗</span></a></div>';
      box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
    }
    box.hidden = false; paint();
    if (list.length > 1 && !reduce) setInterval(function () { k = (k + 1) % list.length; paint(); }, 5000);
  }

  /* ================= La pizza: com'è fatta, punto per punto ================= */
  function product(data) {
    var extras = [];
    data.sections.forEach(function (x) { if (x.group === 'aggiunte' && x.visible !== false) extras = extras.concat(AA.visibleItems(x)); });
    document.querySelectorAll('[data-n="ingredienti"]').forEach(function (el) { if (extras.length) el.textContent = extras.length; });
    anatomy(extras.length);
  }
  /* La pizza da vicino: un punto si accende sul dettaglio, una linea si disegna fino alla lente, la lente lo ingrandisce.
     Lo scorrimento guida: la scena resta ferma sullo schermo e a ogni tratto passa al dettaglio successivo.
     Toccare un'icona porta lo scorrimento a quel dettaglio. */
  function anatomy(nIngr) {
    var shot = $('anShot'); if (!shot || shot.dataset.ready) return;
    shot.dataset.ready = '1';
    var M = 2.4, STEP = .55; // mezza schermata abbondante di scorrimento per ogni dettaglio
    var D = [
      { x: .43, y: .84, n: 'Impasto', from: 'Murgia · Trapani', t: 'L’impasto', p: 'Le farine che utilizziamo provengono da un piccolo mulino a km 0 della Murgia barese. L’impasto base è preparato con farina biologica tipo 1, acqua microfiltrata, sale integrale dello Stagnone di Trapani (riserva naturale WWF), pochissimo lievito di birra e olio extravergine di oliva biologico della Murgia barese. Le nostre farine sono 100% naturali, non industriali e prive di additivi chimici, come enzimi o miglioratori.', a: 'Scegli tra nove impasti', href: '#impasti' },
      { x: .2, y: .5, n: 'Pomodoro', from: '100% italiano · Basilico fresco', t: 'Il pomodoro', p: 'Utilizziamo pomodoro 100% italiano, condito con basilico fresco. Su richiesta, è disponibile anche il pomodoro nickel free.' },
      { x: .44, y: .56, n: 'Mozzarelle e latticini', from: 'Km 0 · Siero-innesto', t: 'Mozzarelle e latticini a km 0', p: 'Utilizziamo latticini e mozzarelle a km 0, prodotti con siero-innesto, secondo la tradizione casearia della Murgia barese.' },
      { x: .6, y: .3, n: 'Ingredienti', from: 'Bio · Km 0 · Slow Food', t: 'Gli ingredienti', p: (nIngr ? nIngr + ' ingredienti' : 'Tanti ingredienti') + ' da aggiungere come preferisci. Selezioniamo prodotti biologici e specialità del territorio, privilegiando qualità e provenienza locale.', a: 'Crea la tua pizza', href: AA.ROOT + 'menu/#crea' }
    ];
    var lens = $('anLens'), lensImg = lens.querySelector('img'), dot = $('anDot'), wire = $('anWire'), nameEl = $('anName'), det = $('anDet');
    var lis = [].slice.call(document.querySelectorAll('#anPicks li'));
    var cur = -1, swapT = null, seqT = [], track = $('anTrack'), stick = $('anStick');
    function later(fn, ms) { seqT.push(setTimeout(fn, ms)); }
    function place(k) {
      var W = shot.clientWidth, H = shot.clientHeight, ir = 4 / 3, dw = W, dh = H, ox = 0, oy = 0;
      if (W / H > ir) { dh = W / ir; oy = (H - dh) / 2; } else { dw = H * ir; ox = (W - dw) / 2; }
      var Dm = Math.round(Math.min(Math.min(W,H)-40, Math.max(104, Math.min(W, H) * .39))), r = Dm / 2, pad = 14;
      var p = D[k], px = clamp(ox + p.x * dw, 18, W-18), py = clamp(oy + p.y * dh, 18, H-18);
      // la lente va dove c'è spazio, lontana dal punto quanto basta perché la linea si veda
      var best = null, L = r + Math.max(64, Math.min(W, H) * .2);
      for (var i = 0; i < 16; i++) {
        var an = i / 16 * Math.PI * 2, cx = px + Math.cos(an) * L, cy = py + Math.sin(an) * L;
        var inside = cx - r >= pad && cx + r <= W - pad && cy - r - 10 >= pad && cy + r + 10 <= H - pad;
        var score = (inside ? 1000 : 0) - Math.hypot(cx - W / 2, cy - H / 2) * .6 - (cy < py ? 0 : 20);
        if (!best || score > best.s) best = { s: score, x: cx, y: cy };
      }
      var lx = clamp(best.x, r + pad, W - r - pad), ly = clamp(best.y, r + pad + 10, H - r - pad - 10);
      lens.style.width = lens.style.height = Dm + 'px'; lens.style.left = (lx - r) + 'px'; lens.style.top = (ly - r) + 'px';
      lensImg.style.width = dw * M + 'px'; lensImg.style.height = dh * M + 'px';
      lensImg.style.transform = 'translate3d(' + (r - p.x * dw * M).toFixed(1) + 'px,' + (r - p.y * dh * M).toFixed(1) + 'px,0)';
      dot.style.left = px + 'px'; dot.style.top = py + 'px';
      var d = Math.hypot(lx - px, ly - py) || 1, ex = lx - (lx - px) / d * r, ey = ly - (ly - py) / d * r;
      wire.setAttribute('d', 'M' + (px + (lx - px) / d * 9).toFixed(1) + ',' + (py + (ly - py) / d * 9).toFixed(1) + 'L' + ex.toFixed(1) + ',' + ey.toFixed(1));
      nameEl.textContent = p.n; nameEl.style.left = lx + 'px'; nameEl.style.top = (py > ly ? ly - r - 14 : ly + r - 16) + 'px';
    }
    function frame(k) {
      seqT.forEach(clearTimeout); seqT = [];
      var on = shot.classList.contains('s1');
      if (reduce) { place(k); shot.classList.add('s1', 's2', 's3'); return; }
      shot.classList.remove('s3'); later(function () { shot.classList.remove('s2'); }, on ? 120 : 0);
      later(function () {
        shot.classList.remove('s1'); place(k);
        later(function () { shot.classList.add('s1'); }, 30);
        later(function () { shot.classList.add('s2'); }, 380);
        later(function () { shot.classList.add('s3'); }, 480);
      }, on ? 180 : 0);
    }
    function text(k) {
      var p = D[k];
      function put() {
        $('anFrom').textContent = p.from; $('anT').textContent = p.t; $('anP').textContent = p.p;
        var a = $('anA'); a.hidden = !p.a; if (p.a) { a.textContent = p.a; a.href = p.href; }
        det.classList.remove('out');
      }
      if (reduce) { put(); return; }
      det.classList.add('out'); clearTimeout(swapT); swapT = setTimeout(put, 150);
    }
    function go(k) {
      cur = k; frame(k); text(k);
      lis.forEach(function (li, i) { li.classList.toggle('on', i === k); li.querySelector('button').setAttribute('aria-pressed', i === k); });
    }
    var img = shot.querySelector('.an-cam img');
    function ready(fn) { if (img.complete && img.naturalWidth) fn(); else img.addEventListener('load', fn, { once: true }); }
    if (reduce) {
      lis.forEach(function (li, i) { li.querySelector('button').addEventListener('click', function () { go(i); }); });
      ready(function () { go(0); });
      return;
    }
    lis.forEach(function (li, i) { li.querySelector('button').addEventListener('click', function () { go(i); }); });
    ready(function () {
      var large=matchMedia('(min-width: 960px) and (min-height: 700px)'), pending=false, last=-1;
      function layout(){var active=large.matches && stick.offsetHeight <= innerHeight-($('nav')?.offsetHeight||102)-12;track.classList.toggle('an-scroll-active',active);if(active){var vh=innerHeight,top=($('nav')?.offsetHeight||102)+16;track.style.setProperty('--an-top',top+'px');track.style.setProperty('--an-travel',Math.round(vh*1.16)+'px');track.style.setProperty('--an-scene',stick.offsetHeight+'px')}else{track.style.removeProperty('--an-top');track.style.removeProperty('--an-travel');last=-1}request()}
      function update(){pending=false;if(!track.classList.contains('an-scroll-active'))return;var r=track.getBoundingClientRect(),range=track.offsetHeight-stick.offsetHeight,top=($('nav')?.offsetHeight||102)+16;if(range<1)return;var p=clamp((top-r.top)/range,0,1),k=Math.min(D.length-1,Math.floor(p*D.length));if(k!==last){last=k;if(k!==cur)go(k)}}
      function request(){if(!pending){pending=true;requestAnimationFrame(update)}}
      go(0);layout();addEventListener('scroll',request,{passive:true});addEventListener('resize',layout);
    });
    window.addEventListener('resize', function () { if (cur >= 0) place(cur); });
    if ('ResizeObserver' in window) new ResizeObserver(function(){if(cur>=0)place(cur);}).observe(shot);

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
    week(info);
    if (info.hours && info.hours.length && $('nsHours')) $('nsHours').textContent = info.hours.map(function (h) { return h.days + ' ' + h.time; }).join(' · ');
    if (info.legal) {
      var l = [];
      if (info.legal.vat) l.push('<span>P.IVA ' + esc(info.legal.vat) + '</span>');
      if (info.legal.cf) l.push('<span>C.F. ' + esc(info.legal.cf) + '</span>');
      if (info.legal.rea) l.push('<span>REA ' + esc(info.legal.rea) + '</span>');
      $('legal').innerHTML = l.join('');
    }
  }

  /* ================= Capitoli in alto: dove sei e quanto manca ================= */
  (function chapters() {
    var ids = ['pizza', 'senza-glutine', 'pizze', 'storia', 'album', 'vieni'];
    var els = ids.map(function (id) { return $(id); });
    if (els.some(function (e) { return !e; })) return;
    var links = {};
    document.querySelectorAll('.nav-links a[data-ch], .chap a[data-ch]').forEach(function (a) { (links[a.dataset.ch] = links[a.dataset.ch] || []).push(a); });
    var bar = $('chap'), inner = bar.querySelector('.chap-in'), hero = $('fuoco'), navEl = $('nav'), storyEl = $('pizza');
    var cur = null, raf = 0;
    function setH() { document.documentElement.style.setProperty('--navh', navEl.offsetHeight + 'px'); }
    function upd() {
      raf = 0;
      var line = window.innerHeight * .38, act = null, prog = 0;
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect(), end = i + 1 < els.length ? els[i + 1].getBoundingClientRect().top : r.bottom;
        if (r.top <= line) { act = ids[i]; prog = Math.max(0, Math.min(1, (line - r.top) / Math.max(1, end - r.top))); }
      }
      bar.classList.toggle('on', (storyEl || hero).getBoundingClientRect().top < navEl.offsetHeight + 40);
      if (act !== cur) {
        cur = act;
        Object.keys(links).forEach(function (k) { links[k].forEach(function (a) { a.setAttribute('aria-current', k === act ? 'true' : 'false'); }); });
        var on = act && bar.querySelector('a[data-ch="' + act + '"]');
        if (on && inner.scrollWidth > inner.clientWidth) inner.scrollTo({ left: Math.max(0, on.offsetLeft - (inner.clientWidth - on.offsetWidth) / 2), behavior: 'smooth' });
      }
      if (act) links[act].forEach(function (a) { a.style.setProperty('--p', prog.toFixed(3)); });
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    window.addEventListener('resize', function () { setH(); upd(); });
    setH(); upd();
  })();

  function week(info) {
    var box = $('week'); if (!box) return;
    var days = info.openDays || [], from = info.openFrom, to = info.openTo;
    if (!from || !to) { box.hidden = true; $('hours').hidden = false; return; }
    var NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'], SH = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    var mins = function (x) { var q = String(x).split(':'); return Number(q[0]) * 60 + Number(q[1] || 0); };
    var a = mins(from), b = mins(to); if (b <= a) b += 1440;
    var top = Math.max(0, (a - 720) / 720 * 100), h = Math.min(100 - top, (b - a) / 720 * 100);
    var st = AA.openStatus(info) || {}, today = new Date().getDay();
    var hhmm = function (x) { return String(x).replace(/^0/, '').replace(/:00$/, ''); };
    box.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(function (d) {
      var on = days.indexOf(d) >= 0 && !(d === today && st.closedToday);
      var cls = (on ? '' : 'off') + (d === today ? ' today' + (st.open ? ' live' : '') : '');
      var txt = on ? '<span>' + hhmm(from) + '–</span><span>' + hhmm(to) + '</span>' : (d === today && st.closedToday ? 'chiuso' : 'riposo');
      return '<li class="' + cls.trim() + '" aria-label="' + NAMES[d] + (d === today ? ', oggi' : '') + ': ' + (on ? 'dalle ' + from + ' alle ' + to : txt) + '"><b>' + (d === today ? 'Oggi' : SH[d]) + '</b><small>' + txt + '</small></li>';
    }).join('');
  }

  AA.loadMenu().then(function (data) {
    var info = data.info || {};
    bind(info);
    function refreshStatus() {
      var st = AA.openStatus(info);
      if (!st) return;
      var upcoming = !st.open && st.text.indexOf('Stasera siamo aperti') === 0;
      var label = upcoming ? 'Apertura stasera alle ' + info.openFrom : st.text;
      ['status', 'viStatus', 'nsStatus'].forEach(function (id) {
        var el = $(id); if (!el) return;
        el.hidden = false;
        if (el.textContent !== label) el.textContent = label;
        el.classList.toggle('is-open', st.open);
        el.classList.toggle('is-upcoming', upcoming);
      });
      var title = $('viTitle'), copy = upcoming ? 'Ci vediamo stasera?' : 'Ti teniamo un tavolo?';
      if (title && title.textContent !== copy) title.textContent = copy;
      week(info);
    }
    refreshStatus();
    setInterval(refreshStatus, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshStatus(); });
    var ann = AA.announcement(data);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    doughs(data); pizzas(data); promos(data); product(data);
    watchCounts();
  }).catch(function () { var hours = $('hours'); if (hours) hours.hidden = false; var w = $('week'); if (w) w.hidden = true; anatomy(0); });
})();



/* V12: one scroll engine; natural browser scroll, no pinning or wheel capture. */
(function(){
 var page=document.querySelector('.site-v12');if(!page)return;
 var mq=matchMedia('(prefers-reduced-motion: reduce)');
 var nodes=Array.from(page.querySelectorAll('[data-unfold],.proof,.pr-foot,.v12-event .timeline-copy,.v12-event .timeline-media,.sf-cols'));
 var events=Array.from(page.querySelectorAll('.v12-event')),rail=document.getElementById('verticalTimeline'),scheduled=false;
 function clamp(n){return Math.max(0,Math.min(1,n))}
 function paint(){
   scheduled=false;var vh=innerHeight,reduce=mq.matches;
   var max=Math.max(1,document.documentElement.scrollHeight-vh);page.style.setProperty('--read-progress',clamp(scrollY/max).toFixed(4));
   nodes.forEach(function(el){
     var r=el.getBoundingClientRect(),p=reduce?1:clamp((vh*.96-r.top)/(vh*.30));
     if (!r.width || !r.height) return;
     if(el.contains(document.activeElement))p=1;
     el.style.setProperty('--unfold',p.toFixed(3));
   });
   if(rail){var r=rail.getBoundingClientRect();rail.style.setProperty('--line-fill',(reduce?1:clamp((vh*.66-r.top)/Math.max(1,r.height))).toFixed(4));}
   events.forEach(function(el){var r=el.getBoundingClientRect();el.classList.toggle('is-past',reduce||r.top<vh*.68);var media=el.querySelector('.timeline-media');if(media){var p=reduce?0:clamp((vh-r.top)/(vh+r.height));media.style.setProperty('--image-y',((p-.5)*12).toFixed(2)+'px');}});
 }
 function request(){if(!scheduled){scheduled=true;requestAnimationFrame(paint)}}
 page.classList.add('unfold-ready');
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);addEventListener('pageshow',request);page.addEventListener('focusin',request);
 if(mq.addEventListener)mq.addEventListener('change',request);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(request);
 paint();
})();

/* V13: vertically read the story; images stay in view and follow the active year. */
(function(){
 var wrap=document.getElementById('storyScroll'),view=document.getElementById('storyView'),rail=document.getElementById('verticalTimeline'),images=document.getElementById('storyImages');
 if(!wrap||!view||!rail||!images)return;
 var motion=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 760px)'),events=Array.from(rail.querySelectorAll('.v12-event')),frames=[],pending=false,current=-1;
 if(!events.length)return;
 events.forEach(function(el,i){
   var source=el.querySelector('.timeline-media'),frame=source.cloneNode(true);
   frame.classList.add('story-frame');frame.classList.toggle('active',i===0);
   frame.querySelectorAll('img').forEach(function(img){img.loading='eager';img.alt='';img.removeAttribute('id')});
   images.appendChild(frame);frames.push(frame);
 });
 function clamp(v){return Math.max(0,Math.min(1,v))}
 function layout(){
   var nav=document.getElementById('nav'),chap=document.getElementById('chap'),top=(nav?nav.offsetHeight:90)+14;
   if(chap&&getComputedStyle(chap).display!=='none')top+=chap.offsetHeight;
   wrap.style.setProperty('--story-top',top+'px');
   var enabled=!motion.matches&&innerHeight>=620;
   wrap.classList.toggle('story-enhanced',enabled);view.hidden=!enabled;
   if(enabled){current=-1;paint()}else{events.forEach(function(el){el.classList.remove('story-active')})}
 }
 function paint(){
   pending=false;if(!wrap.classList.contains('story-enhanced'))return;
   var line=small.matches?view.getBoundingClientRect().bottom+Math.min(84,innerHeight*.10):innerHeight*.48;
   var index=0;events.forEach(function(el,i){if(el.getBoundingClientRect().top<=line)index=i});
   if(index!==current){
     current=index;frames.forEach(function(f,i){f.classList.toggle('active',i===index)});
     events.forEach(function(el,i){el.classList.toggle('story-active',i===index)});
     document.getElementById('storyViewYear').textContent=events[index].querySelector('.v12-year>span:last-child').textContent;
     document.getElementById('storyViewCount').textContent=String(index+1).padStart(2,'0')+' / '+String(events.length).padStart(2,'0');
   }
   var rr=rail.getBoundingClientRect(),last=events[events.length-1].getBoundingClientRect(),span=Math.max(1,last.top-rr.top);
   wrap.style.setProperty('--story-progress',clamp((line-rr.top)/span).toFixed(4));
 }
 function request(){if(!pending){pending=true;requestAnimationFrame(paint)}}
 addEventListener('scroll',request,{passive:true});addEventListener('resize',layout);addEventListener('pageshow',layout);
 if(motion.addEventListener)motion.addEventListener('change',layout);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(layout);
 layout();
})();

/* V14: scroll-scrubbed motion and restrained ember particles, pause offscreen. */
(function(){
 var page=document.querySelector('.site-v14'),hero=document.getElementById('fuoco'),scene=document.getElementById('heroStick');if(!page||!hero||!scene)return;
 var mq=matchMedia('(prefers-reduced-motion: reduce)'),canvas=document.getElementById('heroEmbers'),ctx=canvas&&canvas.getContext('2d'),nav=document.getElementById('nav'),wrap=document.getElementById('storyScroll'),rail=document.getElementById('verticalTimeline'),frames=[],events=[],dough=document.getElementById('impasti'),pizza=document.getElementById('pizze'),an=document.getElementById('anTrack'),stick=document.getElementById('anStick');
 var W=0,H=0,dpr=1,particles=[],running=false,visible=false,raf=0,clock=0,last=0;
 function clamp(v){return Math.max(0,Math.min(1,v))}
 function mix(a,b,t){return a+(b-a)*t}
 function smooth(v){v=clamp(v);return v*v*(3-2*v)}
 function rel(el){var r=el.getBoundingClientRect();return clamp((innerHeight-r.top)/(innerHeight+r.height))}
 function size(){if(!ctx)return;W=canvas.clientWidth;H=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);particles=[]}
 function spawn(first){var mobile=innerWidth<=900;return {x:W*(mobile?.34:.68)+Math.random()*W*(mobile?.46:.26),y:H*(mobile?.44:.78)-(first?Math.random()*H*.32:0),vx:(Math.random()-.4)*.32,vy:.22+Math.random()*.46,r:.6+Math.random()*1.15,life:0,max:110+Math.random()*120,phase:Math.random()*6.28}}
 function tick(now){if(!running)return;var dt=Math.min(2,(now-(last||now))/16.67);last=now;ctx.clearRect(0,0,W,H);var n=innerWidth<=900?16:29;
 while(particles.length<n)particles.push(spawn(true));particles.forEach(function(p,i){p.life+=dt;p.x+=(p.vx+Math.sin(p.phase+p.life*.04)*.2)*dt;p.y-=p.vy*dt;var a=Math.sin(Math.PI*clamp(p.life/p.max))*.78;if(p.life>=p.max||p.y<0){particles[i]=spawn(false);return}ctx.fillStyle='rgba(244,170,89,'+a.toFixed(3)+')';ctx.shadowColor='#f08a41';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()});ctx.shadowBlur=0;requestAnimationFrame(tick)}
 function toggle(){var go=!!ctx&&visible&&!mq.matches&&!document.hidden;if(go&&!running){running=true;last=0;requestAnimationFrame(tick)}else if(!go){running=false;if(ctx)ctx.clearRect(0,0,W,H)}}
 function paint(){raf=0;if(mq.matches)return;
 var vh=innerHeight,r=hero.getBoundingClientRect(),n=nav?nav.offsetHeight:0,p=clamp((n-r.top)/Math.max(1,hero.offsetHeight-scene.offsetHeight));if(r.bottom>0&&r.top<vh){hero.style.setProperty('--fire-zoom',(1+.12*p).toFixed(4));hero.style.setProperty('--fire-shift',(-35*p).toFixed(1)+'px');hero.style.setProperty('--hero-copy-y',(-46*p).toFixed(1)+'px');hero.style.setProperty('--hero-fade',(1-.52*smooth((p-.3)/.7)).toFixed(3))}
 if(dough){var q=rel(dough);dough.style.setProperty('--dough-turn',(-48+q*96).toFixed(2)+'deg');dough.style.setProperty('--dough-scale',(.88+.12*smooth(q*2)).toFixed(3))}
 if(pizza){var q=rel(pizza);pizza.style.setProperty('--pizza-turn',(-28+q*56).toFixed(2)+'deg');pizza.style.setProperty('--pizza-scale',(.86+.14*smooth(q*2)).toFixed(3))}
 if(an&&stick&&an.classList.contains('an-scroll-active')){var range=Math.max(1,an.offsetHeight-stick.offsetHeight),p=clamp((n+16-an.getBoundingClientRect().top)/range),local=p*4%1;an.style.setProperty('--ingredient-progress',p===1?1:local.toFixed(3))}
 if(wrap&&wrap.classList.contains('story-enhanced')&&rail){if(!frames.length){frames=Array.from(wrap.querySelectorAll('.story-frame'));events=Array.from(rail.querySelectorAll('.v12-event'))}
 var view=document.getElementById('storyView'),line=innerWidth<=760?view.getBoundingClientRect().bottom+Math.min(84,vh*.10):vh*.48;
 var index=0,t=0;for(var i=0;i<events.length;i++){var top=events[i].getBoundingClientRect().top;if(top<=line)index=i}
 if(index<events.length-1){var next=events[index+1].getBoundingClientRect().top,d=Math.min(135,vh*.19);t=smooth(1-(next-line)/d)}
 frames.forEach(function(f,i){var a=i===index?1-t:i===index+1?t:0;f.style.setProperty('--frame-alpha',a.toFixed(3));f.style.setProperty('--frame-y',f.classList.contains('family-portrait')?'0px':((i===index?-12*t:20*(1-t))).toFixed(1)+'px');f.style.setProperty('--frame-scale',f.classList.contains('family-portrait')?'1':(1+.025*(1-a)).toFixed(3));f.style.zIndex=String(i===index+1?3:i===index?2:0)});
 events.forEach(function(el,i){el.style.setProperty('--story-focus',(i===index?1-t:i===index+1?t:0).toFixed(3))});
 }}
 function request(){if(!raf)raf=requestAnimationFrame(paint)}
 if(!mq.matches)page.classList.add('motion-enter');
 // Use a pseudo-element on the timeline for the moving tip, keeping list semantics intact.
 if(ctx){size();if('IntersectionObserver' in window){new IntersectionObserver(function(es){visible=es[0].isIntersecting;toggle()},{threshold:0}).observe(hero)}else{visible=true;toggle()}document.addEventListener('visibilitychange',toggle)}
 addEventListener('scroll',request,{passive:true});addEventListener('resize',function(){size();request()});addEventListener('pageshow',request);if(mq.addEventListener)mq.addEventListener('change',function(){toggle();request()});request();
})();

/* V15: scrub motion with a single requestAnimationFrame, no automatic page advance. */
(function(){
 var page=document.querySelector('.site-v15');if(!page)return;
 var mq=matchMedia('(prefers-reduced-motion: reduce)'),raf=0;
 var hero=document.getElementById('fuoco'),dough=document.getElementById('impasti'),pizza=document.getElementById('pizze'),story=document.getElementById('storyScroll'),rail=document.getElementById('verticalTimeline');
 var headings=[],reveal=[],groups=[],rules=[],tip=null,lastYear='',year=document.getElementById('storyViewYear');
 var selectors='.an-head .an-h,.im-body .h3,.gf h3,.pz-text .h2,#story-title,.v12-event .timeline-copy h3,.sf-big';
 function split(el){
   if(el.querySelector('.v15-word')||el.closest('[aria-hidden="true"]')&&el.getClientRects().length===0)return;
   var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[],n;while(n=walker.nextNode())nodes.push(n);
   nodes.forEach(function(t){if(!t.textContent.trim())return;var f=document.createDocumentFragment();t.textContent.split(/(\s+)/).forEach(function(s){if(!s)return;if(/^\s+$/.test(s)){f.appendChild(document.createTextNode(s));return}var w=document.createElement('span'),inr=document.createElement('span');w.className='v15-word';inr.textContent=s;w.appendChild(inr);f.appendChild(w)});t.replaceWith(f)});
   el.classList.add('v15-heading');headings.push({el:el,words:Array.from(el.querySelectorAll('.v15-word'))});
 }
 Array.from(page.querySelectorAll(selectors)).forEach(split);
 var shot=document.getElementById('anShot');if(shot){shot.classList.add('v15-reveal-image');reveal.push(shot)}
 ['.an-picks','.proof','.gf-list','.week','.sf-cols'].forEach(function(s){var el=page.querySelector(s);if(el)groups.push(el)});
 /* V19.2: section boundaries use space and background alone. */
 if(story&&rail){tip=document.createElement('span');tip.className='v15-fuse-tip';tip.setAttribute('aria-hidden','true');tip.hidden=true;story.appendChild(tip)}
 function clamp(v){return Math.max(0,Math.min(1,v))}
 function smooth(v){v=clamp(v);return v*v*(3-2*v)}
 function progress(el,vh){var r=el.getBoundingClientRect();if(!r.width||!r.height)return 1;return smooth((vh*.98-r.top)/(vh*.38))}
 function put(el,k,v){el.style.setProperty(k,v)}
 function paint(){
   raf=0;var vh=innerHeight,reduce=mq.matches;
   headings.forEach(function(o){var p=reduce?1:progress(o.el,vh),m=o.words.length;for(var i=0;i<m;i++){var offset=m>1?i/(m-1)*.36:0;put(o.words[i],'--word-p',smooth((p-offset)/.64).toFixed(3))}});
   reveal.forEach(function(el){put(el,'--cinema-p',reduce?1:progress(el,vh).toFixed(3))});
   groups.forEach(function(el){var p=reduce?1:progress(el,vh),children=Array.from(el.children);children.forEach(function(child,i){var v=reduce?1:smooth((p-Math.min(.42,i*.06))/.58);put(child,'--item-p',v.toFixed(3));if(el.classList.contains('an-picks'))put(child,'--pick-p',v.toFixed(3))})});
   rules.forEach(function(el){put(el,'--rule-p',reduce?1:smooth((vh*.96-el.getBoundingClientRect().top)/(vh*.35)).toFixed(3))});
   if(hero){var r=hero.getBoundingClientRect();put(hero,'--v15-heat',reduce?1:(1+.07*smooth(-r.top/Math.max(1,r.height-vh*.5))).toFixed(3))}
   if(dough){var r=dough.getBoundingClientRect(),p=reduce?1:progress(dough,vh);put(dough,'--dough-reveal',p);put(dough,'--dough-float',reduce?'0px':((.5-clamp((vh-r.top)/(vh+r.height)))*48).toFixed(1)+'px')}
   if(pizza){var r=pizza.getBoundingClientRect(),p=reduce?1:progress(pizza,vh);put(pizza,'--v15-pizza-glow',p);put(pizza,'--pizza-float',reduce?'0px':((.5-clamp((vh-r.top)/(vh+r.height)))*66).toFixed(1)+'px')}
   if(story&&rail&&tip){var enabled=!reduce&&story.classList.contains('story-enhanced');tip.hidden=!enabled;if(enabled){var sr=story.getBoundingClientRect(),rr=rail.getBoundingClientRect(),p=parseFloat(story.style.getPropertyValue('--story-progress'))||0;tip.style.left=(rr.left-sr.left+7)+'px';tip.style.top=(rr.top-sr.top+rr.height*clamp(p))+'px';story.querySelectorAll('.story-frame').forEach(function(frame){var a=parseFloat(frame.style.getPropertyValue('--frame-alpha'));if(!isFinite(a))a=frame.classList.contains('active')?1:0;var portrait=frame.classList.contains('family-portrait');put(frame,'--frame-wipe',portrait?'0%':((1-a)*10).toFixed(1)+'%');put(frame,'--frame-light',portrait?1:(.82+.18*a).toFixed(3))})}}
   if(year&&year.textContent!==lastYear){lastYear=year.textContent;var cap=year.parentElement;cap.classList.remove('v15-year-change');if(!reduce){void cap.offsetWidth;cap.classList.add('v15-year-change')}}
 }
 function request(){if(!raf)raf=requestAnimationFrame(paint)}
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request);addEventListener('pageshow',request);if(mq.addEventListener)mq.addEventListener('change',request);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(request);request();
})();

/* V16: native swipe rail and a local image lightbox. */
(function(){
 var rail=document.getElementById('albumRail'),dialog=document.getElementById('albumDialog');if(!rail||!dialog)return;
 var prev=document.getElementById('albumPrev'),next=document.getElementById('albumNext'),full=document.getElementById('albumFull'),caption=document.getElementById('albumCaption'),fp=document.getElementById('fullPrev'),fn=document.getElementById('fullNext'),cards=Array.from(rail.querySelectorAll('[data-album-photo]')),current=0,lastFocus=null,mq=matchMedia('(prefers-reduced-motion: reduce)'),pending=false;
 function clamp(v){return Math.max(0,Math.min(1,v))}
 function paint(){pending=false;var max=Math.max(0,rail.scrollWidth-rail.clientWidth),p=max?clamp(rail.scrollLeft/max):0,thumb=Math.min(1,rail.clientWidth/Math.max(1,rail.scrollWidth));rail.parentElement.style.setProperty('--album-thumb',(thumb*100)+'%');rail.parentElement.style.setProperty('--album-offset',(thumb?((1-thumb)*p/thumb)*100:0)+'%');prev.disabled=rail.scrollLeft<=2;next.disabled=rail.scrollLeft>=max-2;var vh=innerHeight;cards.forEach(function(card,i){var r=card.getBoundingClientRect(),q=mq.matches?1:clamp((vh*.96-r.top)/(vh*.35)-Math.min(i*.06,.2));card.style.setProperty('--album-reveal',q.toFixed(3))})}
 function request(){if(!pending){pending=true;requestAnimationFrame(paint)}}
 function scroll(d){rail.scrollBy({left:d*(cards[0].offsetWidth+16),behavior:mq.matches?'auto':'smooth'})}
 prev.addEventListener('click',function(){scroll(-1)});next.addEventListener('click',function(){scroll(1)});rail.addEventListener('scroll',request,{passive:true});
 function show(i){current=Math.max(0,Math.min(cards.length-1,i));var img=cards[current].querySelector('img');full.src=img.currentSrc||img.src;full.alt=img.alt;caption.textContent=img.alt;fp.disabled=current===0;fn.disabled=current===cards.length-1}
 rail.addEventListener('click',function(e){var btn=e.target.closest('[data-photo]');if(!btn)return;lastFocus=btn;show(Number(btn.dataset.photo));if(dialog.showModal)dialog.showModal();else window.open(full.src,'_blank','noopener')});
 dialog.querySelector('.v16-close').addEventListener('click',function(){dialog.close()});dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close()});dialog.addEventListener('close',function(){if(lastFocus)lastFocus.focus({preventScroll:true})});fp.addEventListener('click',function(){show(current-1)});fn.addEventListener('click',function(){show(current+1)});dialog.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(current+(e.key==='ArrowLeft'?-1:1))}});
 rail.parentElement.classList.add('v16-motion');addEventListener('scroll',request,{passive:true});addEventListener('resize',request);paint();
})();

