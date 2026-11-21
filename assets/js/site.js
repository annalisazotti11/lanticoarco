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
    var box = $('intro'), logo = $('introLogo'), fire = $('introFire'), done = false;
    function finish() {
      if (done) return; done = true;
      root.classList.remove('has-intro');
      try { sessionStorage.setItem('aa-intro', '1'); } catch (e) {}
      startHero();
    }
    function rectCSS(r) {
      var rad = r.width / 2;
      return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: rad + 'px ' + rad + 'px 0px 0px' };
    }
    function run() {
      var lr = logo.getBoundingClientRect(), mouth = document.querySelector('.oven-mouth');
      if (!lr.width || !mouth || !fire.animate) { finish(); return; }
      // vano dell'arco nel disegno del logo: il fuoco sta dietro al logo, che resta intatto
      var from = { left: lr.left + lr.width * .325, top: lr.top + lr.height * .5, width: lr.width * .37, height: lr.height * .485 };
      var a = rectCSS(from);
      Object.keys(a).forEach(function (k) { fire.style[k] = a[k]; });
      var ignite = fire.animate([{ opacity: 0, transform: 'scaleY(.4)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      ignite.onfinish = function () {
        setTimeout(function () {
          var to = rectCSS(mouth.getBoundingClientRect());
          var fly = fire.animate([rectCSS(from), to], { duration: 1100, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
          logo.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.08)' }], { duration: 650, easing: 'ease-in', fill: 'forwards' });
          box.animate([{ backgroundColor: getComputedStyle(box).backgroundColor }, { backgroundColor: 'rgba(244,235,223,0)' }], { duration: 900, delay: 250, easing: 'ease-in-out', fill: 'forwards' });
          fly.onfinish = function () {
            fire.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }).onfinish = finish;
          };
        }, 450);
      };
    }
    box.addEventListener('click', finish);
    var go = function () { setTimeout(run, 850); };
    if (logo.complete) go(); else { logo.onload = go; logo.onerror = finish; }
    setTimeout(finish, 7000);
  }
  intro();

  document.querySelectorAll('[data-arch-path]').forEach(function (p) { p.setAttribute('d', AA.ARCH_PATH); });


  /* ================= Il fuoco nel forno (WebGL, leggero) ================= */
  var fireCtl = (function fire() {
    var c = $('fire');
    if (!c) return null;
    var gl;
    try { gl = c.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    var fs = [
      'precision mediump float;uniform vec2 R;uniform float T;',
      'float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/R; float x=(uv.x-.5)*R.x/R.y; float y=uv.y;',
      ' vec3 col=mix(vec3(.17,.055,.02),vec3(.02,.008,.004),smoothstep(.0,.85,y));',
      ' float gy=y-.12; col+=vec3(.40,.12,.03)*exp(-(x*x*2.5+gy*gy*5.));',
      ' float n1=fbm(vec2(x*3.2,y*2.2-T*1.5));',
      ' float n2=fbm(vec2(x*6.5+n1*1.8,y*4.6-T*2.6));',
      ' float bx=x+.04; float bed=exp(-bx*bx*7.);',
      ' float v=bed*(1.-y/(.26+.52*bed))*(.7+.6*n2);',
      ' float f=clamp((v*.8+n1*.75+n2*.6-1.)*2.,0.,1.)*(.5+.5*v)*smoothstep(.0,.03,y);',
      ' col=col*(1.-clamp(f*1.6,0.,1.))+vec3(1.5*f,1.5*f*f*f,f*f*f*f*f*f);',
      ' float e=fbm(vec2(x*24.,y*20.-T*.35))*smoothstep(.07,.0,y);',
      ' col+=vec3(1.,.36,.07)*e*.9+vec3(1.,.7,.3)*e*e*e*e*1.2;',
      ' gl_FragColor=vec4(col,1.);',
      '}'].join('\n');
    function sh(t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var a = sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), b = sh(gl.FRAGMENT_SHADER, fs);
    if (!a || !b) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, a); gl.attachShader(pr, b); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T');
    var scale = Math.min(window.devicePixelRatio || 1, 2) * .6, running = false, t0 = performance.now();
    function size() {
      var w = Math.max(2, Math.round(c.clientWidth * scale)), hh = Math.max(2, Math.round(c.clientHeight * scale));
      if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; gl.viewport(0, 0, w, hh); }
    }
    function draw(t) { gl.uniform2f(uR, c.width, c.height); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function loop(now) { if (!running) return; draw((now - t0) / 1000); requestAnimationFrame(loop); }
    size(); draw(3.2);
    c.closest('.oven').classList.add('gl');
    window.addEventListener('resize', function () { clearTimeout(c._t); c._t = setTimeout(function () { size(); if (!running) draw(3.2); }, 150); });
    return {
      play: function () { if (reduce || running) return; running = true; requestAnimationFrame(loop); },
      pause: function () { running = false; }
    };
  })();

  /* ================= Scintille che salgono dal forno ================= */
  (function sparks() {
    var c = $('sparks');
    if (!c || reduce) { if (fireCtl && !reduce) fireCtl.play(); return; }
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
      if (fireCtl) { if (vis) fireCtl.play(); else fireCtl.pause(); }
    }).observe($('fuoco'));
  })();
  if (fireCtl && reduce) fireCtl.pause();


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
      var label = it.name.replace(/^Impasto\s+/i, '');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      return '<li><button type="button" data-i="' + i + '" aria-pressed="false">' + esc(label) + '</button></li>';
    }).join('');
    function show(i) {
      if (i === cur) return;
      cur = i;
      var it = items[i];
      list.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.dataset.i) === i); });
      var p = it.price == null ? '' : (Number(it.price) === 0 ? 'Compreso nel prezzo della pizza' : AA.price(it.price, { signed: true }) + ' sul prezzo della pizza');
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
    var tabBox = $('pzTabs'), plate = $('pzPlate'), card = $('pzCard'), big = $('pzBig');
    var t = 0, i = 0, timer = null;
    tabBox.innerHTML = tabs.map(function (tb, k) {
      return '<button type="button" role="tab" data-k="' + k + '" aria-selected="' + (k === 0) + '">' + esc(tb.label) + '</button>';
    }).join('');
    function fitBig() {
      var n = (big.textContent || '').length || 1;
      big.style.setProperty('--bn', Math.min(22, 150 / n).toFixed(2) + 'vw');
    }
    function paint() {
      var tb = tabs[t], it = tb.items[i];
      $('pzName').textContent = it.name;
      $('pzDesc').textContent = it.desc || '';
      var pr = it.price;
      if (it.prices && it.prices.length) pr = Math.min.apply(null, it.prices.map(function (p) { return Number(p.price) || Infinity; }));
      $('pzPrice').textContent = pr != null && isFinite(pr) ? (it.prices && it.prices.length ? 'da ' : '') + AA.price(pr) : '';
      $('pzTags').innerHTML = (it.tags || []).map(function (c) { var tg = AA.TAG_BY_CODE[c]; return tg ? '<span>' + esc(tg.short) + '</span>' : ''; }).join('') + (it.featured ? '<span>Preferita</span>' : '');
      $('pzCount').textContent = (i + 1) + ' / ' + tb.items.length;
      big.textContent = it.name; fitBig();
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
    window.addEventListener('resize', fitBig);
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
    if (st) {
      var s = $('status'); s.hidden = false; s.textContent = st.text; s.classList.toggle('is-open', st.open);
      var vs = $('viStatus'); vs.hidden = false; vs.textContent = st.text; vs.classList.toggle('is-open', st.open);
      var now = new Date(), d = now.getDay(), open = (info.openDays || []).indexOf(d) >= 0;
      var late = info.openTo && (now.getHours() * 60 + now.getMinutes()) >= (function (x) { var p = x.split(':'); return p[0] * 60 + Number(p[1]); })(info.openTo);
      $('viTitle').textContent = st.open ? 'Ti teniamo un tavolo?' : (open && !late ? 'Ci vediamo stasera?' : 'Ti teniamo un tavolo?');
    }
    var ann = AA.announcement(data);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    doughs(data); pizzas(data); promos(data);
  }).catch(function () {});
})();
