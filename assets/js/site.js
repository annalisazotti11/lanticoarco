/* Sito: si entra da un arco di fuoco, la storia si accende scorrendo, dati vivi dal gestionale */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  document.querySelectorAll('[data-years]').forEach(function (el) { el.textContent = new Date().getFullYear() - 2001; });

  /* ================= Il fuoco: video in loop del forno (orizzontale su PC, verticale su telefono) ================= */
  var stick = $('heroStick');
  function isWide() { return stick.clientWidth >= 960; }
  var fireCtl = (function fire() {
    var vid = $('fire');
    if (!vid) return null;
    var cur = '';
    function pick() {
      var f = isWide() ? 'forno-16x9' : 'forno-9x16';
      if (f === cur) return;
      cur = f;
      var base = AA.ROOT + 'assets/video/' + f;
      vid.poster = base + '.jpg';
      vid.innerHTML = '<source src="' + base + '.webm" type="video/webm"><source src="' + base + '.mp4" type="video/mp4">';
      vid.load();
      if (wantPlay) play();
    }
    var wantPlay = false;
    function play() { if (reduce) return; var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
    pick();
    window.addEventListener('resize', function () { clearTimeout(vid._t); vid._t = setTimeout(pick, 250); });
    return {
      play: function () { wantPlay = true; play(); },
      pause: function () { wantPlay = false; vid.pause(); }
    };
  })();

  /* ================= Scintille ================= */
  var sparkCtl = (function sparks() {
    var c = $('sparks');
    if (!c || reduce) return null;
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W, H, ps = [], running = false;
    function size() { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function spawn(initial) {
      var cx = isWide() ? .655 : .5, spread = isWide() ? .1 : .2;
      return {
        x: W * (cx - spread + Math.random() * spread * 2), y: initial ? H * (.15 + Math.random() * .6) : H * (isWide() ? .38 : .5) + Math.random() * H * (isWide() ? .3 : .25),
        vy: .5 + Math.random() * 1.5, vx: (Math.random() - .5) * .4, r: .6 + Math.random() * 1.8,
        life: 0, max: 200 + Math.random() * 360, ph: Math.random() * 6.28, hue: 18 + Math.random() * 26
      };
    }
    function init() { size(); var n = Math.min(60, Math.round(W / 22)); ps = []; for (var i = 0; i < n; i++) ps.push(spawn(true)); }
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.life++; p.y -= p.vy; p.ph += .03; p.x += p.vx + Math.sin(p.ph) * .35;
        var k = 1 - p.life / p.max, fl = .65 + Math.sin(p.life * .25 + p.ph) * .35;
        if (k <= 0 || p.y < -20) { ps[i] = spawn(false); continue; }
        var al = k * fl * .9;
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,60%,' + (al * .14) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'hsla(' + (p.hue + 15) + ',100%,' + (70 + k * 15) + '%,' + al + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    init();
    window.addEventListener('resize', function () { clearTimeout(c._t); c._t = setTimeout(init, 200); });
    return { play: function () { if (!running) { running = true; tick(); } }, pause: function () { running = false; } };
  })();

  /* ================= Si entra dall'arco ================= */
  var fireC = $('fire'), sparkC = $('sparks');
  var hero = $('fuoco'), arch = $('arch'), archPath = $('archPath'), copy = $('heroCopy'), enter = $('heroEnter');
  var openT = reduce ? 1 : 0, prog = 0;
  function archShape() {
    var W = stick.clientWidth, H = stick.clientHeight, wide = W >= 960;
    var mx = wide ? Math.max(28, W * .045) : 12;
    var top = wide ? 96 : 74;
    var aw = W - mx * 2, ah = H - top;
    var ry = wide ? Math.min(aw * .2, ah * .34) : Math.min(aw * .5, ah * .3);
    var o = easeOut(openT), p = easeOut(prog);
    var w = lerp(aw * .3, aw, o), h = lerp(ah * .28, ah, o);
    var s = 1 + p * 1.25;
    w *= s; h *= s;
    var rY = ry * (w / aw);
    var left = (W - w) / 2, topY = H - h;
    return { W: W, H: H, left: left, top: topY, w: w, h: h, rx: w / 2, ry: Math.min(rY, h), wide: wide, p: p, ctop: top + ry * .78 };
  }
  function pathFor(g, d) {
    var l = g.left - d, r = g.left + g.w + d, cy = g.top + g.ry, rx = g.rx + d, ry = g.ry + d;
    return 'M' + l + ',' + (g.H + 2) + 'L' + l + ',' + cy + 'A' + rx + ',' + ry + ' 0 0 1 ' + r + ',' + cy + 'L' + r + ',' + (g.H + 2);
  }
  function linesFor(g) {
    var d = g.wide ? 34 : 16, out = pathFor(g, 0) + pathFor(g, d);
    var cx = g.left + g.w / 2, cy = g.top + g.ry, N = g.wide ? 19 : 13;
    for (var i = 1; i < N; i++) {
      var a = Math.PI * i / N, co = Math.cos(a), si = Math.sin(a);
      out += 'M' + (cx - g.rx * co) + ',' + (cy - g.ry * si) + 'L' + (cx - (g.rx + d) * co) + ',' + (cy - (g.ry + d) * si);
    }
    var step = g.wide ? 58 : 40;
    for (var y = cy + step; y < g.H; y += step) {
      out += 'M' + (g.left - d) + ',' + y + 'L' + g.left + ',' + y + 'M' + (g.left + g.w) + ',' + y + 'L' + (g.left + g.w + d) + ',' + y;
    }
    return out;
  }
  var raf = 0;
  function paintHero() {
    raf = 0;
    var g = archShape();
    var dPath = 'M' + g.left + ',' + (g.H + 2) + 'L' + g.left + ',' + (g.top + g.ry) + 'A' + g.rx + ',' + g.ry + ' 0 0 1 ' + (g.left + g.w) + ',' + (g.top + g.ry) + 'L' + (g.left + g.w) + ',' + (g.H + 2) + 'Z';
    arch.style.clipPath = 'path("' + dPath + '")';
    archPath.setAttribute('d', linesFor(g));
    archPath.style.opacity = String(clamp(easeOut(openT) * (1 - g.p * 1.6), 0, 1));
    stick.style.setProperty('--ax', Math.max(0, g.left) + 'px');
    copy.style.opacity = String(clamp(1 - g.p * 2.2, 0, 1));
    stick.style.setProperty('--ctop', g.ctop + 'px');
    var z = 'scale(' + (1 + g.p * .16).toFixed(4) + ')';
    fireC.style.transform = (g.wide ? '' : 'translateY(13%) ') + z; sparkC.style.transform = z;
    copy.style.transform = 'translateY(' + (-g.p * 90) + 'px)';
    enter.style.visibility = g.p > .05 ? 'hidden' : '';
  }
  function queueHero() { if (!raf) raf = requestAnimationFrame(paintHero); }
  function onScrollHero() {
    var r = hero.getBoundingClientRect(), range = hero.offsetHeight - stick.offsetHeight;
    prog = range > 0 ? clamp(-r.top / range, 0, 1) : 0;
    queueHero();
  }
  window.addEventListener('scroll', onScrollHero, { passive: true });
  window.addEventListener('resize', queueHero);
  if (reduce) { paintHero(); hero.classList.add('on'); }
  else {
    var t0 = performance.now();
    (function openArch(now) {
      openT = clamp((now - t0) / 1500, 0, 1);
      paintHero();
      if (openT < 1) requestAnimationFrame(openArch);
    })(t0);
    setTimeout(function () { hero.classList.add('on'); }, 550);
  }
  onScrollHero();
  new IntersectionObserver(function (es) {
    var vis = es[0].isIntersecting;
    if (fireCtl) { if (vis) fireCtl.play(); else fireCtl.pause(); }
    if (sparkCtl) { if (vis) sparkCtl.play(); else sparkCtl.pause(); }
  }).observe(stick);

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
  chapters.forEach(function (c) { revealIO.observe(c); });

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
    setInterval(function () { if (tlSeen && lastFill !== null && document.visibilityState === 'visible') emit(1, .7); }, 380);
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
      var p = it.price == null ? 'Supplemento da chiedere in sala' : (Number(it.price) === 0 ? 'Compreso nel prezzo della pizza' : AA.price(it.price, { signed: true }) + ' sul prezzo della pizza');
      info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
      var lk = look(it), name = it.name.replace(/^Impasto\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); });
      info.innerHTML = '<h3>' + esc(name) + '</h3><p>' + esc(shortOf(it)) + '</p>' + (p ? '<span class="im-price">' + p + '</span>' : '');
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
    if (!reduce) timer = setInterval(function () { if (!user && $('impasti').classList.contains('in')) show((cur + 1) % items.length); }, 4200);
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
      var cut = all.filter(function (it) { return it.cutout; });
      var list = cut.length ? cut : all.filter(function (it) { return it.image; });
      if (!list.length) return;
      list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
      var hint = s.subtitle || '';
      HINTS.forEach(function (h) { if (!hint && h[0].test(s.name)) hint = h[1]; });
      tabs.push({ sec: s, items: list, total: all.length, hint: hint, label: s.name.replace(/^Pizze\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); }) });
    });
    if (!tabs.length) return;
    var tabBox = $('pzTabs'), plate = $('pzPlate'), card = $('pzCard');
    var t = 0, i = 0, timer = null;
    tabBox.innerHTML = tabs.map(function (tb, k) {
      return '<button type="button" role="tab" data-k="' + k + '" aria-selected="' + (k === 0) + '">' + esc(tb.label) + '</button>';
    }).join('');
    function paint() {
      var tb = tabs[t], it = tb.items[i];
      $('pzName').textContent = it.name;
      $('pzDesc').textContent = it.desc || '';
      var pr = it.price;
      if (it.prices && it.prices.length) pr = Math.min.apply(null, it.prices.map(function (p) { return Number(p.price) || Infinity; }));
      $('pzPrice').textContent = pr != null && isFinite(pr) ? (it.prices && it.prices.length ? 'da ' : '') + AA.price(pr) : '';
      $('pzTags').innerHTML = (it.tags || []).map(function (c) { var tg = AA.TAG_BY_CODE[c]; return tg ? '<span>' + esc(tg.short) + '</span>' : ''; }).join('') + (it.featured ? '<span>Preferita</span>' : '');
      $('pzCount').textContent = (i + 1) + ' / ' + tb.items.length;
      var img = $('pzImg');
      plate.classList.toggle('photo', !it.cutout);
      img.src = AA.src(it.cutout || it.image);
      img.alt = 'Pizza ' + it.name;
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
    }
    function swapTo(fn) {
      if (reduce) { fn(); paint(); return; }
      plate.classList.remove('inn'); plate.classList.add('out');
      setTimeout(function () { fn(); paint(); plate.classList.remove('out'); void plate.offsetWidth; plate.classList.add('inn'); }, 420);
    }
    function setTab(k) {
      t = k; i = 0;
      tabBox.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', Number(b.dataset.k) === k); });
      $('pzHint').textContent = tabs[k].hint;
      var a = $('pzAll');
      a.href = AA.ROOT + 'menu/#' + encodeURIComponent(tabs[k].sec.id);
      a.textContent = 'Tutte le ' + tabs[k].total + ' nel menu';
    }
    function stop() { clearInterval(timer); timer = null; }
    tabBox.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || Number(b.dataset.k) === t) return;
      stop(); var k = Number(b.dataset.k); swapTo(function () { setTab(k); });
    });
    $('pzPrev').onclick = function () { stop(); swapTo(function () { i = (i - 1 + tabs[t].items.length) % tabs[t].items.length; }); };
    $('pzNext').onclick = function () { stop(); swapTo(function () { i = (i + 1) % tabs[t].items.length; }); };
    // scorrimento col dito sulla pizza
    var sx = null;
    plate.parentNode.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    plate.parentNode.addEventListener('touchend', function (e) {
      if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) (dx < 0 ? $('pzNext') : $('pzPrev')).click();
    });
    setTab(0); paint();
    if (!reduce) timer = setInterval(function () { if ($('pizze').classList.contains('in')) swapTo(function () { i = (i + 1) % tabs[t].items.length; }); }, 6000);
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

  /* ================= Il prodotto: com'è fatta la nostra pizza ================= */
  function product(data) {
    var extras = [];
    data.sections.forEach(function (x) { if (x.group === 'aggiunte' && x.visible !== false) extras = extras.concat(AA.visibleItems(x)); });
    document.querySelectorAll('[data-n="ingredienti"]').forEach(function (el) { if (extras.length) el.textContent = extras.length; });
    buildScene();
  }
  /* La pizza vista da vicino: una sola foto vera, l'inquadratura scorre da un dettaglio all'altro.
     Il movimento segue lo scroll in modo continuo (solo transform su un livello composto: niente scatti). */
  function buildScene() {
    var wrap = $('build'), frame = $('buildFrame'), img = $('buildPhoto');
    if (!wrap || !frame || !img || wrap.dataset.ready) return;
    wrap.dataset.ready = '1';
    var steps = [].slice.call(document.querySelectorAll('#buildSteps li')), pills = [].slice.call(document.querySelectorAll('#buildNav button'));
    var bar = $('buildBar'), N = steps.length, state = -1;
    // punto a fuoco (frazione della foto) e ingrandimento per ogni passaggio; l'ultimo torna alla pizza intera
    var WHOLE = { x: .5, y: .5, z: 1 };
    var SHOT = [{ x: .44, y: .84, z: 2.3 }, { x: .2, y: .55, z: 2.4 }, { x: .4, y: .5, z: 2.1 }, { x: .66, y: .38, z: 2.2 }, WHOLE];
    // tappe lungo lo scroll (0…N): si parte dalla pizza intera, ogni dettaglio resta fermo per un tratto
    var STOPS = [{ t: 0, c: WHOLE }];
    SHOT.forEach(function (c, i) { STOPS.push({ t: i + .42, c: c }, { t: i + .9, c: c }); });
    function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function cam(t) {
      if (t <= 0) return WHOLE;
      for (var i = 1; i < STOPS.length; i++) {
        var A = STOPS[i - 1], B = STOPS[i];
        if (t <= B.t) {
          var u = ease((t - A.t) / Math.max(.0001, B.t - A.t));
          var lz = Math.log(A.c.z) + (Math.log(B.c.z) - Math.log(A.c.z)) * u;
          return { x: A.c.x + (B.c.x - A.c.x) * u, y: A.c.y + (B.c.y - A.c.y) * u, z: Math.exp(lz) };
        }
      }
      return STOPS[STOPS.length - 1].c;
    }
    function place(c) {
      var W = frame.clientWidth, H = frame.clientHeight, z = c.z;
      var tx = Math.min(0, Math.max(W - W * z, W / 2 - c.x * W * z));
      var ty = Math.min(0, Math.max(H - H * z, H / 2 - c.y * H * z));
      img.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + z.toFixed(4) + ')';
    }
    function setText(i) {
      steps.forEach(function (li, k) { li.classList.toggle('on', k === i); });
      pills.forEach(function (b, k) { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
      frame.setAttribute('data-step', i);
    }
    if (reduce) { wrap.classList.add('static'); setText(N - 1); place(WHOLE); return; }
    var span = function () { return Math.max(1, wrap.offsetHeight - window.innerHeight); };
    var raf = 0, last = -1;
    function onScroll() {
      raf = 0;
      var r = wrap.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) return;
      var p = Math.min(1, Math.max(0, -r.top / span()));
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var t = p * N;
      if (Math.abs(t - last) > .0005) { last = t; place(cam(t)); }
      var k = state < 0 ? Math.floor(t) : state;
      if (t >= state + 1.04 || t < state - .04) k = Math.floor(t);
      k = Math.max(0, Math.min(N - 1, k));
      if (k !== state) { state = k; setText(k); }
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
    window.addEventListener('resize', function () { last = -1; onScroll(); });
    // le etichette portano al dettaglio, quando è fermo
    pills.forEach(function (b, k) {
      b.addEventListener('click', function () {
        var top = wrap.getBoundingClientRect().top + window.scrollY + (k + .66) / N * span();
        window.scrollTo({ top: Math.round(top), behavior: 'smooth' });
      });
    });
    setText(0); state = 0; place(WHOLE);
    onScroll();
  }

  /* La sala: la foto si assesta quando entra nello schermo */
  (function band() {
    var b = document.querySelector('.band'); if (!b) return;
    if (reduce || !('IntersectionObserver' in window)) { b.classList.add('in'); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { b.classList.add('in'); io.disconnect(); } }); }, { threshold: .2 });
    io.observe(b);
  })();

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
    var ids = ['storia', 'prodotto', 'senza-glutine', 'impasti', 'pizze', 'vieni'];
    var els = ids.map(function (id) { return $(id); });
    if (els.some(function (e) { return !e; })) return;
    var links = {};
    document.querySelectorAll('.nav-links a[data-ch], .chap a[data-ch]').forEach(function (a) { (links[a.dataset.ch] = links[a.dataset.ch] || []).push(a); });
    var bar = $('chap'), inner = bar.querySelector('.chap-in'), hero = $('fuoco'), navEl = $('nav');
    var cur = null, raf = 0;
    function setH() { document.documentElement.style.setProperty('--navh', navEl.offsetHeight + 'px'); }
    function upd() {
      raf = 0;
      var line = window.innerHeight * .38, act = null, prog = 0;
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect(), end = i + 1 < els.length ? els[i + 1].getBoundingClientRect().top : r.bottom;
        if (r.top <= line) { act = ids[i]; prog = Math.max(0, Math.min(1, (line - r.top) / Math.max(1, end - r.top))); }
      }
      bar.classList.toggle('on', hero.getBoundingClientRect().bottom < navEl.offsetHeight + 40);
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
    var st = AA.openStatus(info);
    if (st) {
      var s = $('status'); s.hidden = false; s.textContent = st.text; s.classList.toggle('is-open', st.open);
      var vs = $('viStatus'); vs.hidden = false; vs.textContent = st.text; vs.classList.toggle('is-open', st.open);
      var ns = $('nsStatus'); if (ns) { ns.textContent = st.text; ns.classList.toggle('is-open', st.open); }
      var now = new Date(), d = now.getDay(), open = (info.openDays || []).indexOf(d) >= 0 && !st.closedToday;
      var late = info.openTo && (now.getHours() * 60 + now.getMinutes()) >= (function (x) { var p = x.split(':'); return p[0] * 60 + Number(p[1]); })(info.openTo);
      $('viTitle').textContent = st.open ? 'Ti teniamo un tavolo?' : (open && !late ? 'Ci vediamo stasera?' : 'Ti teniamo un tavolo?');
    }
    var ann = AA.announcement(data);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    doughs(data); pizzas(data); promos(data); product(data);
    watchCounts();
  }).catch(function () {});
})();
