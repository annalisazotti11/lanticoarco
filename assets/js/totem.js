/* Totem: menu a scorrimento automatico per lo schermo verticale in sala.
   Parametri URL facoltativi: ?secondi=12  ?solo=pizze,bevande  ?anteprima */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), measure = $('measure'), bar = $('bar');
  var DATA = null, SIG = '', pages = [], idx = -1, timer = null, resumeTimer = null, paused = false;
  var params = new URLSearchParams(location.search);

  document.querySelectorAll('[data-arch]').forEach(function (el) { el.innerHTML = AA.archSVG(); });

  function cfg() {
    var t = (DATA.settings && DATA.settings.totem) || {};
    return {
      pageSeconds: Number(params.get('secondi')) || Number(t.pageSeconds) || 12,
      promoEvery: t.promoEvery == null ? 4 : Number(t.promoEvery),
      showPhotos: t.showPhotos !== false,
      showQr: t.showQr !== false,
      theme: params.get('tema') || t.theme || 'chiaro',
      touch: params.has('touch') ? params.get('touch') !== '0' : t.touch !== false
    };
  }

  /* ---------- Contenuti delle pagine ---------- */
  function tagsHTML(tags) {
    return (tags || []).map(function (t) {
      var d = AA.TAG_BY_CODE[t];
      return d ? '<span class="tg tg-' + t + '">' + esc(d.short) + '</span>' : '';
    }).join('');
  }
  function algHTML(codes) {
    var l = AA.allergenNums(codes);
    return l.length ? '<span class="al">' + l.map(function (a) { return '<span>' + a.n + '</span>'; }).join('') + '</span>' : '';
  }
  function priceHTML(it, sec) {
    if (it.prices && it.prices.length) return AA.itemPriceHTML(it, '');
    if (it.price === null || it.price === undefined || it.price === '') return '<span class="tbc">da confermare</span>';
    if (sec.deltaPrices) return Number(it.price) === 0 ? '<span class="tbc">base</span>' : AA.price(it.price, { signed: true });
    return AA.price(it.price);
  }

  function rowHTML(it, sec, usePh) {
    var ph = '';
    if (usePh) {
      ph = it.image ? '<img class="row-ph" alt="" src="' + esc(AA.src(it.image)) + '">'
        : '<span class="row-ph empty">' + AA.archSVG() + '</span>';
    }
    var meta = tagsHTML(it.tags) + algHTML(it.allergens);
    return '<div class="row' + (usePh ? ' ph' : '') + '">' + ph + '<div>' +
      '<p class="row-name">' + esc(it.name) + (it.frozen ? '<span class="frz">*</span>' : '') + '</p>' +
      (it.desc ? '<p class="row-desc">' + esc(it.desc) + '</p>' : '') +
      (it.note ? '<p class="row-note">' + esc(it.note) + '</p>' : '') +
      (meta ? '<div class="row-meta">' + meta + '</div>' : '') +
      '</div><div class="row-price">' + priceHTML(it, sec) + '</div></div>';
  }

  function unitsFor(sec, items) {
    if (sec.layout === 'cards') {
      var rows = [];
      for (var i = 0; i < items.length; i += 3) {
        rows.push('<div class="cards-row">' + items.slice(i, i + 3).map(function (it) {
          return '<div>' + (it.image ? '<img class="cd-ph" alt="" src="' + esc(AA.src(it.image)) + '">' : '<span class="cd-ph empty">' + AA.archSVG() + '</span>') +
            '<p class="cd-name">' + esc(it.name) + '</p><p class="cd-price num">' + priceHTML(it, sec) + '</p></div>';
        }).join('') + '</div>');
      }
      return rows;
    }
    if (sec.layout === 'chips') {
      var by = {};
      items.forEach(function (it) { var k = String(it.price); (by[k] = by[k] || []).push(it); });
      return Object.keys(by).sort(function (a, b) { return a - b; }).map(function (k) {
        return '<div class="chg"><h4>' + AA.price(Number(k), { signed: true }) + '</h4><ul>' + by[k].map(function (it) {
          var al = AA.allergenNums(it.allergens).map(function (a) { return a.n; }).join(',');
          return '<li>' + esc(it.name) + (al ? '<sup>' + al + '</sup>' : '') + '</li>';
        }).join('') + '</ul></div>';
      });
    }
    var withPh = items.filter(function (it) { return it.image; }).length;
    var usePh = cfg().showPhotos && withPh / items.length >= 0.4;
    return items.map(function (it) { return rowHTML(it, sec, usePh); });
  }

  function heroFor(sec, group) {
    if (sec.image) return sec.image;
    var secs = AA.sectionsOf(DATA, group.id, 'totem');
    return secs[0] && secs[0].id === sec.id ? (group.image || '') : '';
  }
  function headHTML(sec, group, first) {
    var hero = first ? heroFor(sec, group) : '';
    var h = (hero ? '<div class="pg-hero"><img alt="" src="' + esc(AA.src(hero)) + '"></div>' : '') + '<div class="pg-top"><p class="pg-group">' + esc(group.name) + '</p><p class="pg-count" data-count></p></div>';
    h += '<h2 class="pg-title' + (first ? '' : ' cont') + '">' + esc(sec.name) + '</h2>';
    if (first) {
      if (sec.subtitle) h += '<p class="pg-sub">' + esc(sec.subtitle) + '</p>';
      if (sec.note) h += '<p class="pg-note">' + esc(sec.note) + '</p>';
      if ((sec.supplements || []).length) {
        h += '<ul class="pg-suppl">' + sec.supplements.map(function (s) {
          return '<li>' + esc(s.label) + ' <b class="num">' + AA.price(s.price, { signed: true }) + '</b></li>';
        }).join('') + '</ul>';
      }
    }
    return h + '<div class="pg-rule"></div>';
  }

  function leadBold(t) {
    var m = String(t).match(/^(.+?[.!?])(\s+[\s\S]*)?$/);
    return m ? '<b>' + esc(m[1]) + '</b>' + esc(m[2] || '') : esc(t);
  }
  function promoHTML(p) {
    return '<div class="promo' + (p.image ? '' : ' no-ph') + '">' +
      (p.image ? '<img class="promo-ph" alt="" src="' + esc(AA.src(p.image)) + '">' : '<img class="promo-logo" alt="" src="' + AA.ROOT + 'assets/img/logo/logo-600.webp">') +
      (p.kicker ? '<p class="promo-k">' + esc(p.kicker) + '</p>' : '') +
      '<h2 class="promo-t">' + esc(p.title) + '</h2>' +
      (p.text ? '<p class="promo-x">' + esc(p.text) + '</p>' : '') +
      (p.price ? '<p class="promo-p">' + esc(p.price) + '</p>' : '') + '</div>';
  }

  /* ---------- Impaginazione: misura le righe e riempie ogni schermata ---------- */
  function paginate() {
    var W = stage.clientWidth, H = stage.clientHeight;
    var cols = W > H * 1.1 ? 2 : 1;
    measure.style.width = W + 'px';
    measure.style.height = H + 'px';
    measure.style.position = 'absolute';
    var out = [];
    var only = (params.get('solo') || '').split(',').filter(Boolean);
    // prima pagina: allergie e intolleranze, come nel menu
    if (!only.length) {
      var inf = DATA.info || {};
      out.push({ group: 'allergeni', html: '<div class="pg pg-alg">' +
        '<h2 class="pg-title">Allergeni</h2>' + (inf.allergenNote ? '<p class="pg-sub">' + leadBold(inf.allergenNote) + '</p>' : '') +
        '<div class="pg-rule"></div><p class="pg-note">I numeri accanto a ogni piatto indicano gli allergeni presenti (Reg. UE 1169/2011).</p>' +
        '<ol class="alg-grid">' + AA.ALLERGENS.map(function (a) { return '<li><span>' + a.n + '</span>' + esc(a.label) + '</li>'; }).join('') + '</ol></div>' });
    }

    DATA.groups.forEach(function (g) {
      if (only.length && only.indexOf(g.id) < 0) return;
      AA.sectionsOf(DATA, g.id, 'totem').forEach(function (sec) {
        var units = unitsFor(sec, AA.visibleItems(sec));
        var secPages = [];
        var k = 0;
        while (k < units.length) {
          var first = secPages.length === 0;
          measure.innerHTML = '<div class="pg">' + headHTML(sec, g, first) + '<div class="pg-body"></div></div>';
          var body = measure.querySelector('.pg-body');
          var avail = body.clientHeight;
          var colsHTML = [], colEls = [], colFit = [];
          for (var c0 = 0; c0 < cols; c0++) {
            var ce = document.createElement('div');
            ce.className = 'pg-col';
            ce.innerHTML = '&nbsp;';
            body.appendChild(ce);
            colEls.push(ce);
          }
          colEls.forEach(function (ce) { ce.innerHTML = ''; });
          for (var c = 0; c < cols && k < units.length; c++) {
            var col = colEls[c];
            var html = '';
            while (k < units.length) {
              col.insertAdjacentHTML('beforeend', units[k]);
              if (col.offsetHeight > avail && html) { col.removeChild(col.lastChild); break; }
              html += units[k];
              k++;
              if (col.offsetHeight > avail) { colFit[c] = Math.max(.6, avail / col.offsetHeight); break; } // unità più alta dello schermo: la mostra da sola, rimpicciolita
            }
            colsHTML.push(html);
          }
          secPages.push({ group: g.id, sec: sec.id, html: '<div class="pg">' + headHTML(sec, g, first) + '<div class="pg-body">' +
            colEls.map(function (ce, ci) { return '<div class="pg-col' + (colFit[ci] ? ' fit" style="--fit:' + colFit[ci].toFixed(3) : '') + '">' + (colsHTML[ci] || '') + '</div>'; }).join('') + '</div></div>' });
        }
        secPages.forEach(function (p, i) {
          if (secPages.length > 1) p.html = p.html.replace('<p class="pg-count" data-count></p>', '<p class="pg-count">' + (i + 1) + ' di ' + secPages.length + '</p>');
        });
        out = out.concat(secPages);
      });
    });
    measure.innerHTML = '';

    var promos = AA.activePromos(DATA, 'totem');
    var every = cfg().promoEvery;
    if (promos.length && every > 0 && !only.length) {
      var mixed = [], pi = 0;
      out.forEach(function (p, i) {
        mixed.push(p);
        if ((i + 1) % every === 0) { mixed.push({ group: p.group, promo: true, html: promoHTML(promos[pi % promos.length]) }); pi++; }
      });
      out = mixed;
    }
    return out;
  }

  /* ---------- Riproduzione ---------- */
  function renderChrome() {
    var info = DATA.info, c = cfg();
    $('tvSub').textContent = 'Cellamare, dal ' + (info.since || 2001);
    document.body.classList.toggle('tema-scuro', c.theme === 'scuro');
    var url = (DATA.settings && DATA.settings.menuUrl) || new URL('../menu/', location.href).href;
    if (c.showQr && url && window.qrcode) {
      $('tvQrCode').innerHTML = AA.qrSVG(url, { margin: 1 });
      $('tvQr').hidden = false;
    } else $('tvQr').hidden = true;
    var ann = AA.announcement(DATA);
    $('tvNotice').hidden = !ann;
    $('tvNotice').textContent = ann;
    var only = (params.get('solo') || '').split(',').filter(Boolean);
    $('groups').innerHTML = DATA.groups.filter(function (g) {
      return AA.sectionsOf(DATA, g.id, 'totem').length && (!only.length || only.indexOf(g.id) >= 0);
    }).map(function (g) {
      return '<button type="button" data-g="' + esc(g.id) + '">' + esc(g.name) + '</button>';
    }).join('');
    if (!(params.get('solo') || '')) $('groups').insertAdjacentHTML('afterbegin', '<button type="button" data-g="allergeni">Allergeni</button>');
    var bits = [];
    if (info.coverCharge) bits.push('<span><b>Coperto</b> ' + AA.price(info.coverCharge) + '</span>');
    if (info.wifi && info.wifi.network) bits.push('<span><b>Wi‑Fi</b> ' + esc(info.wifi.network) + ', password ' + esc(info.wifi.password) + '</span>');
    bits.push('<span><b>*</b> ' + esc(info.frozenLegend || 'Prodotto surgelato') + '</span>');
    bits.push('<span class="i-alg"><b>1–14</b> allergeni: chiedete al personale</span>');
    $('info').innerHTML = bits.join('');
    $('tvTouch').hidden = !c.touch;
  }

  function animateBar(sec) {
    bar.style.transition = 'none';
    bar.style.width = '0';
    void bar.offsetWidth;
    if (paused) return;
    bar.style.transition = 'width ' + sec + 's linear';
    bar.style.width = '100%';
  }

  /* Rete di sicurezza: se una colonna sfora lo schermo, la rimpicciolisce quanto basta */
  function fitPage(node) {
    var body = node.querySelector && node.querySelector('.pg-body');
    if (!body) return;
    var avail = body.clientHeight;
    body.querySelectorAll('.pg-col').forEach(function (c) {
      c.classList.remove('fit'); c.style.removeProperty('--fit');
      var h = c.offsetHeight;
      if (h > avail + 1) { c.classList.add('fit'); c.style.setProperty('--fit', Math.max(.55, avail / h).toFixed(3)); }
    });
  }
  function show(i, instant) {
    if (!pages.length) return;
    idx = (i + pages.length) % pages.length;
    var p = pages[idx];
    var old = stage.querySelectorAll('.pg, .promo-wrap');
    var el = document.createElement('div');
    el.className = 'pg-wrap';
    el.innerHTML = p.html;
    var node = el.firstChild;
    if (p.promo) { node = document.createElement('div'); node.className = 'pg promo-wrap'; node.innerHTML = p.html; }
    if (!instant) node.classList.add('enter');
    old.forEach(function (o) {
      if (instant) { o.remove(); return; }
      o.classList.remove('enter'); o.classList.add('leave');
      setTimeout(function () { o.remove(); }, 480);
    });
    var loading = stage.querySelector('.tv-loading');
    if (loading) loading.remove();
    stage.appendChild(node);
    fitPage(node);
    node.querySelectorAll('img').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { fitPage(node); }, { once: true }); });
    document.querySelectorAll('#groups button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.g === p.group ? 'true' : 'false'); });
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    var sec = cfg().pageSeconds;
    animateBar(sec);
    if (!paused) timer = setTimeout(function () { show(idx + 1); }, sec * 1000);
  }

  function pauseForTouch() {
    paused = true;
    clearTimeout(timer);
    clearTimeout(resumeTimer);
    bar.style.transition = 'none';
    resumeTimer = setTimeout(function () { paused = false; show(idx + 1); }, 45000);
  }

  /* ---------- Schermo d'attesa (totem touch): le categorie in grande, un tocco apre il menu lì ---------- */
  var ATTRACT = false, promoT = null;
  function buildAttract() {
    ATTRACT = true;
    clearTimeout(timer); clearTimeout(resumeTimer); clearInterval(promoT);
    document.body.classList.add('attract');
    var groups = DATA.groups.filter(function (g) { return g.id !== 'aggiunte' && AA.sectionsOf(DATA, g.id, 'totem').length; });
    var promos = AA.activePromos(DATA, 'totem');
    var h = '<div class="att">' +
      '<div class="att-h"><h2>Che cosa ti va stasera?</h2><p class="att-cta"><span aria-hidden="true"></span>Tocca una categoria per iniziare</p></div>' +
      '<div class="att-grid">' + groups.map(function (g, i) {
        return '<button type="button" class="att-tile" data-g="' + esc(g.id) + '" style="--d:' + (-i * 3.7).toFixed(1) + 's">' +
          (g.image ? '<img alt="" src="' + esc(AA.src(g.image)) + '">' : '<i class="att-ph">' + AA.archSVG() + '</i>') +
          '<b>' + esc(g.name) + '</b></button>';
      }).join('') + '</div>' +
      (promos.length ? '<div class="att-promos">' + promos.map(function (p, i) {
        return '<div class="att-promo' + (i === 0 ? ' on' : '') + '">' + (p.image ? '<img alt="" src="' + esc(AA.src(p.image)) + '">' : '') +
          '<div>' + (p.kicker ? '<small>' + esc(p.kicker) + '</small>' : '') + '<b>' + esc(p.title) + '</b>' + (p.text ? '<span>' + esc(p.text) + '</span>' : '') + '</div></div>';
      }).join('') + '</div>' : '') +
      '<button type="button" class="att-alg" data-g="allergeni"><b>Allergie o intolleranze?</b> Comunicatele al personale prima di ordinare.</button>' +
      '</div>';
    stage.innerHTML = h;
    var cards = stage.querySelectorAll('.att-promo'), pi = 0;
    if (cards.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) promoT = setInterval(function () {
      cards[pi].classList.remove('on'); pi = (pi + 1) % cards.length; cards[pi].classList.add('on');
    }, 6000);
  }

  function rebuild(keepPlace) {
    var cur = pages[idx];
    renderChrome();
    if (cfg().touch && !(params.get('solo') || '')) { buildAttract(); return; }
    ATTRACT = false; document.body.classList.remove('attract'); clearInterval(promoT);
    pages = paginate();
    var target = 0;
    if (keepPlace && cur) {
      for (var i = 0; i < pages.length; i++) if (pages[i].sec === cur.sec) { target = i; break; }
    }
    show(target, true);
  }

  /* ---------- Interazione (schermo touch) ----------
     Con lo schermo touch il cartellone fa da attesa: un tocco apre il menu da sfogliare,
     sulla categoria che si stava guardando. Senza touch, i tocchi sfogliano le pagine. */
  function openMenu(group) { location.href = '../menu/?totem' + (group ? '#g-' + encodeURIComponent(group) : ''); }
  $('groups').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (DATA && cfg().touch) { openMenu(b.dataset.g); return; }
    for (var i = 0; i < pages.length; i++) if (pages[i].group === b.dataset.g && !pages[i].promo) { pauseForTouch(); show(i); return; }
  });
  var sx = null;
  stage.addEventListener('pointerdown', function (e) { sx = e.clientX; });
  stage.addEventListener('click', function (e) {
    if (!ATTRACT) return;
    var b = e.target.closest('[data-g]');
    openMenu(b ? b.dataset.g : '');
  });
  stage.addEventListener('pointerup', function (e) {
    if (ATTRACT) { sx = null; return; }
    if (sx === null) return;
    var dx = e.clientX - sx; sx = null;
    if (DATA && cfg().touch) { var pg = pages[idx]; openMenu(pg && !pg.promo ? pg.group : ''); return; }
    if (Math.abs(dx) > 50) { pauseForTouch(); show(idx + (dx < 0 ? 1 : -1)); }
    else { pauseForTouch(); show(idx + 1); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { pauseForTouch(); show(idx + 1); }
    if (e.key === 'ArrowLeft') { pauseForTouch(); show(idx - 1); }
    if (e.key === 'f') toggleFs();
  });

  /* ---------- Schermo sempre acceso, schermo intero, cursore ---------- */
  var lock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', keepAwake);
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  }
  var fs = $('fs');
  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    fs.hidden = false;
    fs.onclick = function () { toggleFs(); keepAwake(); fs.hidden = true; };
    setTimeout(function () { fs.hidden = true; }, 20000);
  }
  var curTimer;
  document.addEventListener('mousemove', function () {
    document.body.classList.remove('no-cursor');
    clearTimeout(curTimer);
    curTimer = setTimeout(function () { document.body.classList.add('no-cursor'); }, 4000);
  });

  /* Scintille leggere sul fondo (solo tema scuro) */
  (function sparks() {
    var c = document.getElementById('tvSparks');
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = c.getContext('2d'), W, H, ps = [];
    function size() { W = c.width = c.clientWidth; H = c.height = c.clientHeight; }
    function spawn(init) { return { x: Math.random() * W, y: init ? H * (.55 + Math.random() * .45) : H + 10, vy: .3 + Math.random() * .9, r: .6 + Math.random() * 1.6, life: 0, max: 260 + Math.random() * 300, ph: Math.random() * 6.28 }; }
    size(); for (var i = 0; i < 46; i++) ps.push(spawn(true));
    window.addEventListener('resize', size);
    (function tick() {
      if (!document.hidden && document.body.classList.contains('tema-scuro')) {
        ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < ps.length; i++) {
          var p = ps[i]; p.life++; p.y -= p.vy; p.ph += .03; p.x += Math.sin(p.ph) * .3;
          var k = 1 - p.life / p.max; if (k <= 0) { ps[i] = spawn(false); continue; }
          ctx.fillStyle = 'hsla(28,100%,62%,' + (k * .12) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'hsla(40,100%,75%,' + (k * .8) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(tick);
    })();
  })();

  /* Ricarica ogni notte alle 4:30 per prendere eventuali aggiornamenti del sito */
  (function nightly() {
    var now = new Date(), t = new Date(now);
    t.setHours(4, 30, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    setTimeout(function () { location.reload(); }, t - now);
  })();

  /* Controlla le modifiche dal gestionale ogni 90 secondi */
  function refresh() {
    AA.loadMenu().then(function (d) {
      var sig = JSON.stringify(d);
      if (sig === SIG) return;
      SIG = sig; DATA = d;
      rebuild(true);
    }).catch(function () {});
  }

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { rebuild(true); }, 400); });

  AA.loadMenu().then(function (d) {
    DATA = d; SIG = JSON.stringify(d);
    var ready = Promise.resolve();
    if (document.fonts && document.fonts.load) {
      ready = Promise.all(['400 20px Inter', '500 20px Inter', '600 20px Inter', '600 20px "Inter Tight"'].map(function (f) {
        return document.fonts.load(f).catch(function () {});
      })).then(function () { return document.fonts.ready; });
    }
    return ready.then(function () { rebuild(false); keepAwake(); setInterval(refresh, 90000); });
  }).catch(function () {
    stage.innerHTML = '<p class="tv-loading">Menu non disponibile: controllo la connessione…</p>';
    setTimeout(function () { location.reload(); }, 60000);
  });
})();
