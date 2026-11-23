/* Menu per telefono, tablet e PC */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var DATA = null;
  var state = { q: '', tags: [], noAllergens: [] };
  var $ = function (id) { return document.getElementById(id); };

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filtering() { return !!(state.q || state.tags.length || state.noAllergens.length); }

  var CAN_GF = {}; // piatti che si possono fare con l'impasto senza glutine (variante della sottocategoria)
  function hasTag(item, t) { return (item.tags || []).indexOf(t) >= 0 || (t === 'senza-glutine' && CAN_GF[item.id]); }
  function matches(item) {
    if (item.available === false) return false;
    if (state.tags.length && !state.tags.every(function (t) { return hasTag(item, t); })) return false;
    if (state.noAllergens.length && (item.allergens || []).some(function (a) { return state.noAllergens.indexOf(a) >= 0; })) return false;
    if (state.q) {
      var hay = norm(item.name + ' ' + item.desc + ' ' + item.note);
      return norm(state.q).split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }
    return true;
  }
  function hl(text) {
    var t = esc(text);
    if (!state.q) return t;
    state.q.trim().split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
      t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return t;
  }
  function algsHTML(codes) {
    var list = AA.allergenNums(codes);
    if (!list.length) return '';
    return '<span class="algs" aria-label="Allergeni: ' + list.map(function (a) { return a.label; }).join(', ') + '">' +
      list.map(function (a) { return '<span class="alg" aria-hidden="true">' + a.n + '</span>'; }).join('') + '</span>';
  }
  function tagsHTML(tags) {
    return (tags || []).map(function (t) { var d = AA.TAG_BY_CODE[t]; return d ? '<span class="tag tag-' + t + '">' + esc(d.short) + '</span>' : ''; }).join('');
  }
  function priceHTML(it, sec) {
    if (it.prices && it.prices.length) return AA.itemPriceHTML(it, '');
    if (it.price === null || it.price === undefined || it.price === '') return '<span class="tbc">Prezzo da confermare</span>';
    if (sec.deltaPrices) return Number(it.price) === 0 ? 'Impasto base' : AA.price(it.price, { signed: true });
    return AA.price(it.price);
  }

  function itemHTML(it, sec) {
    var meta = (it.featured ? '<span class="tag tag-pref">Preferita</span>' : '') + tagsHTML(it.tags) + algsHTML(it.allergens);
    return '<li class="item"><button class="item-btn" type="button" data-item="' + esc(it.id) + '">' +
      '<span class="item-main">' +
      '<span class="item-name">' + hl(it.name) + (it.frozen ? '<span class="frz" title="' + esc(DATA.info.frozenLegend) + '">*</span>' : '') + '</span>' +
      (it.desc ? '<span class="item-desc">' + hl(it.desc) + '</span>' : '') +
      (it.note ? '<span class="item-note">' + esc(it.note) + '</span>' : '') +
      (meta ? '<span class="item-meta">' + meta + '</span>' : '') +
      '<span class="item-price num">' + priceHTML(it, sec) + '</span></span>' +
      (it.image ? '<img class="item-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">' : '') +
      '</button></li>';
  }
  function cardsHTML(items, sec) {
    return '<div class="cards">' + items.map(function (it) {
      return '<button class="card" type="button" data-item="' + esc(it.id) + '">' +
        (it.image ? '<img class="card-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">' : '<span class="card-ph ph-empty">' + AA.archSVG() + '</span>') +
        '<span class="card-name" style="display:block">' + hl(it.name.replace(/^Impasto\s+/i, '')) + '</span>' +
        '<span class="card-price" style="display:block">' + priceHTML(it, sec) + '</span></button>';
    }).join('') + '</div>';
  }
  function chipsHTML(items) {
    var by = {};
    items.forEach(function (it) { var k = String(it.price); (by[k] = by[k] || []).push(it); });
    return Object.keys(by).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) {
      return '<div class="chipgrp"><h4>' + AA.price(Number(k), { signed: true }) + '</h4><ul>' + by[k].map(function (it) {
        var al = AA.allergenNums(it.allergens).map(function (a) { return a.n; }).join(',');
        return '<li>' + hl(it.name) + (al ? '<sup>' + al + '</sup>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }).join('');
  }
  function suppHTML(sec) {
    return (sec.supplements || []).length ? '<ul class="suppl">' + sec.supplements.map(function (s) {
      return '<li>' + esc(s.label) + ' <b class="num">' + AA.price(s.price, { signed: true }) + '</b></li>';
    }).join('') + '</ul>' : '';
  }
  var OPEN = {};   // sottocategorie aperte
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function sectionBody(sec, items) {
    return sec.layout === 'cards' && !state.q ? cardsHTML(items, sec)
      : sec.layout === 'chips' ? chipsHTML(items)
      : '<ul class="items">' + items.map(function (it) { return itemHTML(it, sec); }).join('') + '</ul>';
  }
  function sectionHTML(sec, accordion, groupId) {
    var items = sec.items.filter(matches);
    if (!items.length) return '';
    var extra = (sec.note && !filtering() ? '<p class="sec-note">' + esc(sec.note) + '</p>' : '') + (filtering() ? '' : suppHTML(sec));
    if (!accordion) {
      return '<section class="sec" id="' + esc(sec.id) + '"><h3 class="sec-t">' + esc(sec.name) + '</h3>' +
        (sec.subtitle ? '<p class="sec-sub">' + esc(sec.subtitle) + '</p>' : '') + extra + sectionBody(sec, items) + '</section>';
    }
    var open = filtering() || !!OPEN[sec.id];
    var ph = items.filter(function (it) { return it.cutout; })[0] || items.filter(function (it) { return it.image; })[0];
    var name = sec.name;
    return '<section class="sec acc' + (open ? ' open' : '') + '" id="' + esc(sec.id) + '">' +
      '<button type="button" class="acc-h" data-acc="' + esc(sec.id) + '" aria-expanded="' + open + '" aria-controls="' + esc(sec.id) + '-b">' +
      (ph ? '<span class="acc-ph' + (ph.cutout ? ' cut' : '') + '"><img alt="" loading="lazy" src="' + esc(AA.src(ph.cutout || ph.image)) + '"></span>' : '<span class="acc-ph ph-empty">' + AA.archSVG() + '</span>') +
      '<span class="acc-tx"><b>' + esc(name) + '</b>' + (sec.subtitle ? '<small>' + esc(sec.subtitle) + '</small>' : '') + '</span>' +
      '<span class="acc-ch">' + CHEV + '</span></button>' +
      '<div class="acc-b" id="' + esc(sec.id) + '-b"><div class="acc-in"' + (open ? '' : ' inert') + '>' + extra + sectionBody(sec, items) + '</div></div></section>';
  }

  function groupsWithContent() {
    return DATA.groups.filter(function (g) {
      return DATA.sections.some(function (s) { return s.group === g.id && s.visible && s.items.some(matches); });
    });
  }

  /* Come si sceglie: tre passi, chiudibile */
  function renderGuide() {
    var box = $('guide'), seen = false;
    if (!box) return; // il riquadro "Prima volta da noi?" non c'è più: la parte alta del menu resta corta
    try { seen = localStorage.getItem('aa-guida') === '1'; } catch (e) {}
    if (seen || filtering()) { box.hidden = true; return; }
    var imp = DATA.sections.filter(function (s) { return s.group === 'impasti' && s.visible; })[0];
    var min = null;
    if (imp) imp.items.forEach(function (it) { var v = Number(it.price); if (v > 0 && (min === null || v < min)) min = v; });
    var hasExtra = DATA.sections.some(function (s) { return s.group === 'aggiunte' && s.visible && s.items.length; });
    var steps = [
      ['g-impasti', 'Scegli l\'impasto', 'Il classico è compreso' + (min ? ', gli altri da ' + AA.price(min) + ' in più' : '') + '.'],
      ['g-pizze', 'Poi la pizza', 'Gourmet, classiche, bianche o vegan. Le più amate sono segnate come “Preferita”.'],
      hasExtra ? ['crea', 'Oppure creala tu', 'Scegli impasto e ingredienti: ti diciamo subito quanto costa.'] : null
    ].filter(function (x) { return x && (x[0] === 'crea' || document.getElementById(x[0])); });
    if (!steps.length) { box.hidden = true; return; }
    box.innerHTML = '<div class="guide-in"><div class="guide-h"><h2 id="guideT">Prima volta da noi?</h2><button type="button" class="guide-x" id="guideX">Ho capito</button></div><ol>' +
      steps.map(function (st) { return '<li><a href="#' + st[0] + '"' + (st[0] === 'crea' ? ' data-open-builder' : '') + '><b>' + esc(st[1]) + '</b><span>' + esc(st[2]) + '</span></a></li>'; }).join('') +
      '</ol><p class="guide-f">Allergie o intolleranze? Usa i <button type="button" id="guideF">filtri</button> o chiedi a noi: molte pizze si possono preparare senza glutine o senza lattosio.</p></div>';
    box.hidden = false;
    $('guideX').onclick = function () { try { localStorage.setItem('aa-guida', '1'); } catch (e) {} box.hidden = true; };
    $('guideF').onclick = function () { $('filterBtn').click(); };
  }



  /* La prima frase in grassetto, il resto normale */
  function leadBold(t) {
    var m = String(t).match(/^(.+?[.!?])(\s+[\s\S]*)?$/);
    return m ? '<b>' + esc(m[1]) + '</b>' + esc(m[2] || '') : esc(t);
  }
  /* Allergeni: la prima voce del menu */
  function allergensHTML() {
    var i = DATA.info || {};
    return '<section class="grp grp-alg" id="g-allergeni"><h2 class="grp-t">Allergeni</h2><div class="alg-box">' +
      '<p class="alg-lead">' + leadBold(i.allergenNote || '') + '</p>' +
      '<p class="alg-how">I numeri accanto a ogni piatto indicano gli allergeni presenti (Reg. UE 1169/2011):</p>' +
      '<ol class="alg-legend alg-top">' + AA.ALLERGENS.map(function (a) { return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>'; }).join('') + '</ol>' +
      '<button type="button" class="b-ghost alg-f" id="algFilter">Escludi un allergene dal menu</button></div></section>';
  }

  function render() {
    var html = filtering() ? '' : allergensHTML(), nav = filtering() ? '' : '<a href="#g-allergeni" data-g="allergeni">Allergeni</a>';
    groupsWithContent().forEach(function (g) {
      var secs = DATA.sections.filter(function (s) { return s.group === g.id && s.visible && s.items.some(matches); });
      var acc = secs.length > 1;
      var inner = secs.map(function (s) { return sectionHTML(s, acc, g.id); }).join('');
      if (!inner) return;
      html += '<section class="grp" id="g-' + esc(g.id) + '"><h2 class="grp-t">' + esc(g.name) + '</h2>' + inner + (g.id === 'pizze' && !filtering() ? builderCTA() : '') + '</section>';
      nav += '<a href="#g-' + esc(g.id) + '" data-g="' + esc(g.id) + '">' + esc(g.name) + '</a>';
    });
    var hasDishes = html.indexOf('class="grp" id="g-') >= 0;
    $('contenuto').innerHTML = hasDishes ? html : '<p class="empty">Nessun piatto corrisponde. Prova con un\'altra parola o azzera i filtri.</p>';
    $('gnavIn').innerHTML = nav;
    var af = $('algFilter'); if (af) af.onclick = function () { $('filterBtn').click(); };
    $('gnavF').innerHTML = filterChip();
    $('gnavF').hidden = !nFilters();
    $('gnav').classList.toggle('has-f', nFilters() > 0);
    $('gnav').hidden = !nav;
    renderGuide();
    spy(); reveal();
  }

  /* Comparsa morbida delle schede */
  var revealIO;
  function reveal() {
    if (revealIO) revealIO.disconnect();
    var items = document.querySelectorAll('.item');
    if (!('IntersectionObserver' in window)) { items.forEach(function (i) { i.classList.add('in'); }); return; }
    revealIO = new IntersectionObserver(function (es) {
      var k = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        setTimeout(function () { el.classList.add('in'); }, Math.min(k++, 6) * 50);
        revealIO.unobserve(el);
      });
    }, { rootMargin: '0px 0px -5% 0px' });
    items.forEach(function (i) { revealIO.observe(i); });
  }

  /* Categoria visibile nella barra: è quella che sta subito sotto la barra, non quella a metà schermo.
     Toccando una voce la scelta resta ferma finché la pagina non ha finito di scorrere. */
  var spyCur = null, spyLock = null, spyLockT = null, spyRaf = 0, spyBound = false;
  function spyLine() { var n = $('gnav'); return (n && !n.hidden ? n.getBoundingClientRect().bottom : 70) + 16; }
  function spySet(id) {
    if (id === spyCur) return;
    spyCur = id;
    var nav = $('gnavIn'), a = null;
    nav.querySelectorAll('a').forEach(function (x) { var on = x.dataset.g === id; x.setAttribute('aria-current', on ? 'true' : 'false'); if (on) a = x; });
    if (a) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  }
  function spyCalc() {
    spyRaf = 0;
    if (spyLock) return;
    var grps = document.querySelectorAll('#contenuto .grp'); if (!grps.length) return;
    var line = spyLine(), id = grps[0].id.slice(2);
    grps.forEach(function (g) { if (g.getBoundingClientRect().top <= line) id = g.id.slice(2); });
    // in fondo alla pagina le ultime categorie non arrivano sotto la barra: vale l'ultima visibile
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      var last = grps[grps.length - 1]; if (last.getBoundingClientRect().top < window.innerHeight * .6) id = last.id.slice(2);
    }
    spySet(id);
  }
  function spy() {
    spyCur = null;
    if (!spyBound) {
      spyBound = true;
      window.addEventListener('scroll', function () {
        if (spyLock) { clearTimeout(spyLockT); spyLockT = setTimeout(function () { spyLock = null; spyCalc(); }, 160); }
        if (!spyRaf) spyRaf = requestAnimationFrame(spyCalc);
      }, { passive: true });
      window.addEventListener('resize', function () { if (!spyRaf) spyRaf = requestAnimationFrame(spyCalc); });
      // un tocco su una categoria (barra o riquadri): la voce si accende subito e la pagina si ferma con il titolo sotto la barra
      document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#g-"]'); if (!a) return;
        var el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
        e.preventDefault();
        var id = el.id.slice(2);
        spySet(id); spyLock = id;
        clearTimeout(spyLockT); spyLockT = setTimeout(function () { spyLock = null; spyCalc(); }, 1200);
        // la barra a fine corsa sta ferma in alto: conta la sua posizione finale, non quella di adesso
        var n = $('gnav'), z = n && n.offsetHeight ? n.getBoundingClientRect().height / n.offsetHeight : 1; // sul totem la pagina è ingrandita
        var stuck = n && !n.hidden ? ((parseFloat(getComputedStyle(n).top) || 0) + n.offsetHeight) * z : 70;
        var y = window.scrollY + el.getBoundingClientRect().top - stuck - 4;
        window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: reduceMotion() ? 'auto' : 'smooth' });
        if (history.replaceState) history.replaceState(null, '', '#' + el.id);
      });
    }
    spyCalc();
  }
  function reduceMotion() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function findItem(id) {
    for (var i = 0; i < DATA.sections.length; i++) {
      var s = DATA.sections[i];
      for (var j = 0; j < s.items.length; j++) if (s.items[j].id === id) return { item: s.items[j], sec: s };
    }
    return null;
  }

  /* Schede */
  var lastFocus = null;
  function openSheet(el, html) {
    lastFocus = document.activeElement;
    if (html != null) $('sheetBody').innerHTML = html;
    el.hidden = false; document.body.style.overflow = 'hidden';
    el.querySelector('.sheet-card').scrollTop = 0;
    el.querySelector('.sheet-card').focus();
  }
  function closeSheet(el) {
    el.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus();
    if (el.id === 'builder' && location.hash === '#crea') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  }

  function detailHTML(it, sec) {
    var price = priceHTML(it, sec);
    if (/class="tbc"/.test(price)) price = '<span class="d-tbc">Prezzo da confermare</span>';
    var algs = AA.allergenNums(it.allergens);
    return (it.image ? '<img class="d-ph" alt="" onload="if(this.naturalWidth<400)this.classList.add(\'lowres\')" src="' + esc(AA.src(it.image)) + '">' : '') +
      '<div class="d-body"><p class="d-sec">' + esc(sec.name) + '</p>' +
      '<h2 class="d-name" id="sheetTitle">' + esc(it.name) + (it.frozen ? '<span class="frz">*</span>' : '') + '</h2>' +
      '<div class="d-price num">' + price + '</div>' +
      (it.desc ? '<p class="d-desc">' + esc(it.desc) + '</p>' : '') +
      (it.note ? '<p class="item-note">' + esc(it.note) + '</p>' : '') +
      (it.tags && it.tags.length ? '<div class="item-meta">' + tagsHTML(it.tags) + '</div>' : '') +
      (algs.length ? '<h3 class="d-h">Allergeni</h3><ul class="d-algs">' + algs.map(function (a) {
        return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>';
      }).join('') + '</ul>' : '') +
      (sec.group === 'pizze' ? '<button type="button" class="b-fire d-custom" data-open-builder="' + esc(it.id) + '">Personalizza e calcola il prezzo</button>' : '') +
      ((sec.supplements || []).length ? '<h3 class="d-h">Varianti</h3>' + suppHTML(sec) : '') +
      (it.frozen ? '<p class="d-note">* ' + esc(DATA.info.frozenLegend) + '</p>' : '') +
      '<p class="d-note">' + esc(DATA.info.allergenNote) + '</p></div>';
  }


  /* ================= Crea la tua pizza ================= */
  var DEF_PRESETS = [
    { name: 'Pugliese', items: ['Rape stufate', 'Salsiccia pezzente', 'Provolone Murgiano Putignano'] },
    { name: 'Bufala e pomodorini', items: ['Bufala all’uscita', 'Pomodorini Torre Guaceto bio presidio slow'] },
    { name: 'Mortadella e pistacchio', items: ['Mortadella a fette', 'Stracciatella all’uscita', 'Granella di pistacchio'] },
    { name: 'Piccante', items: ['Nduja', 'Salsiccia piccante', 'Cipolla rossa'] },
    { name: 'Funghi e tartufo', items: ['Funghi porcini', 'Crema di tartufo spalmata'] },
    { name: 'Cetara', items: ['Acciughe di Cetara', 'Pomodorini confit', 'Capperi'] }
  ];
  var DEF_POPULAR = ['Bufala all’uscita', 'Stracciatella all’uscita', 'Funghi freschi champignon', 'Salsiccia di Norcia', 'Prosciutto crudo a dadi', 'Nduja', 'Olive leccine', 'Rape stufate', 'Pomodorini confit', 'Acciughe di Cetara', 'Granella di pistacchio', 'Patate fritte'];
  var B = null;
  function pizzaSections() { return DATA.sections.filter(function (s) { return s.group === 'pizze' && s.visible; }); }
  function extrasSection() { return DATA.sections.filter(function (s) { return s.group === 'aggiunte' && s.visible; })[0]; }
  function doughSection() { return DATA.sections.filter(function (s) { return s.group === 'impasti' && s.visible; })[0]; }
  function unitPrice(it) {
    if (it.prices && it.prices.length) return Number(it.prices[0].price) || 0;
    return Number(it.price) || 0;
  }
  function findByName(name, sections) {
    var n = norm(name);
    for (var i = 0; i < sections.length; i++) {
      var hit = sections[i].items.filter(function (it) { return norm(it.name) === n && it.available !== false; })[0];
      if (hit) return { item: hit, sec: sections[i] };
    }
    return null;
  }
  function builderOptions(sec) {
    var base = [], mods = [];
    var dsec = doughSection();
    var gfDough = dsec && dsec.items.some(function (d) { return /senza glutine/i.test(d.name) && d.available !== false; });
    (sec.supplements || []).forEach(function (sp, i) {
      if (gfDough && /senza glutine/i.test(sp.label)) return;
      var o = { id: 'o' + i, label: sp.label, price: Number(sp.price) || 0 };
      if (/^base\s|doppio pomodoro/i.test(sp.label)) base.push(o); else mods.push(o);
    });
    return { base: base, mods: mods };
  }
  function bCfg() { return (DATA.settings && DATA.settings.builder) || {}; }
  function openBuilder(itemId) {
    var secs = pizzaSections();
    var starts = [];
    if (itemId) { var f = findItem(itemId); if (f) starts.push(f); }
    ['Margherita', 'Marinara'].forEach(function (n) {
      var f = findByName(n, secs);
      if (f && !starts.some(function (x) { return x.item.id === f.item.id; })) starts.push(f);
    });
    if (!starts.length && secs[0] && secs[0].items[0]) starts.push({ item: secs[0].items[0], sec: secs[0] });
    if (!starts.length) return;
    var ex = extrasSection(), dsec = doughSection();
    var extras = ex ? ex.items.filter(function (it) { return it.available !== false; }) : [];
    var byName = {};
    extras.forEach(function (it) { byName[norm(it.name)] = it; });
    var cfg = bCfg();
    var presets = (cfg.presets || DEF_PRESETS).map(function (p) {
      var ids = p.items.map(function (n) { var it = byName[norm(n)]; return it ? it.id : null; });
      return ids.every(Boolean) ? { name: p.name, ids: ids } : null;
    }).filter(Boolean);
    var popular = (cfg.popular || DEF_POPULAR).map(function (n) { return byName[norm(n)]; }).filter(Boolean);
    var doughs = dsec ? AA.visibleItems(dsec) : [];
    var defDough = doughs.filter(function (d) { return !Number(d.price); })[0] || doughs[0] || null;
    B = { from: itemId ? starts[0] : null, starts: starts, start: starts[0], doughs: doughs, dough: defDough, baseOpt: null, mods: [], extras: extras, sel: [], removed: [], presets: presets, popular: popular, q: '', picking: false };
    renderBuilder();
    openSheet($('builder'));
    try { history.replaceState(null, '', '#crea'); } catch (e) {}
  }
  function chip(group, id, label, price, on, extra) {
    return '<button type="button" class="bchip' + (extra || '') + '" data-b="' + group + '" data-v="' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      '<span>' + esc(label) + '</span>' + (price ? '<em class="num">' + price + '</em>' : '') + '</button>';
  }
  /* "pomodoro, mozzarella siero innesto, pecorino romano e pepe" → ['pomodoro', 'mozzarella siero innesto', 'pecorino romano', 'pepe'] */
  function recipeOf(item) {
    var out = [];
    String(item.desc || '').split(/[,;]/).forEach(function (seg) {
      seg = seg.replace(/\([^)]*\)/g, '').replace(/\*/g, '').replace(/^\s*all[’']uscita:\s*/i, '').replace(/^\s*solo\s+/i, '').trim();
      if (!seg) return;
      var parts = seg.split(/\s+e\s+/);
      if (parts.length === 2 && parts.every(function (x) { return x.split(/\s+/).length <= 4; })) parts.forEach(function (x) { out.push(x.trim()); });
      else out.push(seg);
    });
    return out.filter(function (x, i) { return x && out.indexOf(x) === i; });
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function allPizzas() {
    var list = [];
    pizzaSections().forEach(function (sec) { sec.items.forEach(function (it) { if (it.available !== false) list.push({ item: it, sec: sec }); }); });
    return list;
  }
  function pickList(q) {
    q = norm(q || '');
    var hits = allPizzas().filter(function (x) { return !q || norm(x.item.name + ' ' + (x.item.desc || '')).indexOf(q) >= 0; }).slice(0, 12);
    if (!hits.length) return '<p class="b-none">Nessuna pizza con queste parole.</p>';
    return hits.map(function (x) {
      return '<button type="button" class="b-pk" data-b="pickit" data-v="' + esc(x.item.id) + '"><b>' + esc(x.item.name) + '</b><span>' + esc(x.item.desc || '') + '</span><em class="num">' + AA.price(unitPrice(x.item)) + '</em></button>';
    }).join('');
  }
  function deltaLabel(v) { return v == null || v === '' ? 'da chiedere' : (Number(v) ? AA.price(Number(v), { signed: true }) : 'compreso'); }
  function renderBuilder() {
    var opt = builderOptions(B.start.sec);
    var h = '<div class="b-head"><p class="b-k">' + (B.from ? 'Personalizza' : 'Crea la tua pizza') + '</p>' +
      '<h2 class="b-t" id="bTitle">' + esc(B.from ? B.from.item.name + ', a modo tuo.' : 'La tua pizza, il tuo prezzo.') + '</h2>' +
      '<p class="b-s">Togli e aggiungi ingredienti, scegli l’impasto: il totale si aggiorna mentre scegli. <button type="button" class="b-reset" data-b="reset">Ricomincia</button></p></div>';
    var rec = recipeOf(B.start.item);
    h += '<section class="b-step"><h3><b>1</b>Si parte da</h3><div class="bchips">' + B.starts.map(function (st) {
      return chip('start', st.item.id, st.item.name, AA.price(unitPrice(st.item)), st.item.id === B.start.item.id);
    }).join('') + '<button type="button" class="bchip b-other" data-b="pick" aria-expanded="' + (B.picking ? 'true' : 'false') + '"><span>Un’altra pizza</span></button></div>' +
      '<div class="b-pick" id="bPick"' + (B.picking ? '' : ' hidden') + '><label class="b-search"><span class="sr-only">Cerca una pizza</span><input type="search" id="bPickQ" placeholder="Cerca per nome o ingrediente, es. bufala" autocomplete="off"></label><div class="b-pks" id="bPickList">' + (B.picking ? pickList('') : '') + '</div></div>';
    if (rec.length) {
      h += '<p class="b-sub">Nella ricetta. Tocca per togliere quello che non vuoi</p><div class="bchips" id="bRec">' + rec.map(function (r) {
        var off = B.removed.indexOf(r) >= 0;
        return '<button type="button" class="bchip b-rec' + (off ? ' off' : '') + '" data-b="rm" data-v="' + esc(r) + '" aria-pressed="' + (off ? 'false' : 'true') + '" aria-label="' + esc(cap(r)) + (off ? ', tolto: tocca per rimetterlo' : ', tocca per toglierlo') + '"><span>' + esc(cap(r)) + '</span><i aria-hidden="true"></i></button>';
      }).join('') + '</div><p class="b-hint">Se togli un ingrediente il totale non cambia.</p>';
    }
    h += '</section>';
    if (B.doughs.length) {
      h += '<section class="b-step"><h3><b>2</b>L’impasto</h3><div class="bchips">' + B.doughs.map(function (d) {
        return chip('dough', d.id, d.name.replace(/^Impasto\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); }), deltaLabel(d.price), B.dough && d.id === B.dough.id);
      }).join('') + '</div></section>';
    }
    if (opt.base.length) {
      h += '<section class="b-step"><h3><b>3</b>La base</h3><div class="bchips">' + chip('base', '', 'Come da ricetta', '', !B.baseOpt) + opt.base.map(function (o) {
        return chip('base', o.id, o.label, AA.price(o.price, { signed: true }), B.baseOpt === o.id);
      }).join('') + '</div></section>';
    }
    if (opt.mods.length) {
      h += '<section class="b-step"><h3><b>' + (opt.base.length ? 4 : 3) + '</b>Formato e intolleranze</h3><div class="bchips">' + opt.mods.map(function (o) {
        return chip('mod', o.id, o.label, AA.price(o.price, { signed: true }), B.mods.indexOf(o.id) >= 0);
      }).join('') + '</div></section>';
    }
    var n = 2 + (B.doughs.length ? 1 : 0) + (opt.base.length ? 1 : 0) + (opt.mods.length ? 1 : 0);
    h += '<section class="b-step"><h3><b>' + n + '</b>Aggiungi ingredienti</h3><div id="bMine"></div>';
    if (B.presets.length) {
      h += '<p class="b-sub">Idee per cominciare</p><div class="bchips">' + B.presets.map(function (p, i) {
        return '<button type="button" class="bidea" data-b="preset" data-v="' + i + '"><span>' + esc(p.name) + '</span><small>' + p.ids.map(function (id) {
          return esc(B.extras.filter(function (x) { return x.id === id; })[0].name);
        }).join(', ') + '</small></button>';
      }).join('') + '</div>';
    }
    if (B.popular.length) {
      h += '<p class="b-sub">I più scelti</p><div class="bchips">' + B.popular.map(function (it) {
        return chip('extra', it.id, it.name, AA.price(it.price, { signed: true }), B.sel.indexOf(it.id) >= 0);
      }).join('') + '</div>';
    }
    h += '<p class="b-sub">Tutti gli ingredienti</p><label class="b-search"><span class="sr-only">Cerca un ingrediente</span><input type="search" id="bQ" placeholder="Cerca un ingrediente" autocomplete="off"></label><div id="bAll">';
    var by = {};
    B.extras.forEach(function (it) { var k = String(unitPrice(it)); (by[k] = by[k] || []).push(it); });
    Object.keys(by).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) {
      h += '<div class="b-grp" data-grp><h4 class="num">' + AA.price(Number(k), { signed: true }) + '</h4><div class="bchips">' + by[k].map(function (it) {
        return chip('extra', it.id, it.name, '', B.sel.indexOf(it.id) >= 0, ' small');
      }).join('') + '</div></div>';
    });
    h += '</div></section><p class="d-note">Il prezzo è indicativo: lo confermiamo al momento dell’ordine. In caso di allergie chiedete sempre al personale.</p>';
    $('bBody').innerHTML = h;
    $('bPickQ').addEventListener('input', function (e) { $('bPickList').innerHTML = pickList(e.target.value.trim()); });
    if (B.picking) setTimeout(function () { var q = $('bPickQ'); if (q) q.focus({ preventScroll: true }); }, 50);
    $('bQ').addEventListener('input', function (e) {
      var q = norm(e.target.value.trim());
      $('bAll').querySelectorAll('.bchip').forEach(function (b) { b.hidden = q && norm(b.textContent).indexOf(q) < 0; });
      $('bAll').querySelectorAll('[data-grp]').forEach(function (g) { g.hidden = ![].some.call(g.querySelectorAll('.bchip'), function (b) { return !b.hidden; }); });
    });
    updateBuilder();
  }
  function builderState() {
    var opt = builderOptions(B.start.sec);
    B.tbc = false;
    var lines = [], total = unitPrice(B.start.item);
    var algs = (B.start.item.allergens || []).slice();
    lines.push(['Si parte da', B.start.item.name, unitPrice(B.start.item)]);
    if (B.dough) {
      var dp = Number(B.dough.price) || 0; total += dp;
      if (B.dough.price == null || B.dough.price === '') B.tbc = true;
      lines.push(['Impasto', B.dough.name.replace(/^Impasto\s+/i, ''), dp]);
      (B.dough.allergens || []).forEach(function (a) { algs.push(a); });
    }
    var bo = opt.base.filter(function (o) { return o.id === B.baseOpt; })[0];
    if (bo) { total += bo.price; lines.push(['Base', bo.label, bo.price]); }
    opt.mods.forEach(function (o) { if (B.mods.indexOf(o.id) >= 0) { total += o.price; lines.push(['', o.label, o.price]); } });
    var ing = B.sel.map(function (id) { return B.extras.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    ing.forEach(function (it) { total += unitPrice(it); (it.allergens || []).forEach(function (a) { algs.push(a); }); });
    var rec = recipeOf(B.start.item), rem = B.removed.filter(function (r) { return rec.indexOf(r) >= 0; });
    return { total: Math.max(0, total), lines: lines, ing: ing, rem: rem, algs: algs.filter(function (a, i) { return algs.indexOf(a) === i; }) };
  }
  function updateBuilder() {
    var st = builderState();
    var parts = [];
    if (st.rem.length) parts.push('senza ' + st.rem.join(', '));
    if (st.ing.length) parts.push('+ ' + st.ing.map(function (i) { return i.name.toLowerCase(); }).join(', '));
    $('bFoot').innerHTML = '<div class="bf-l"><p class="bf-k">' + (B.tbc ? 'Totale indicativo, impasto da chiedere' : 'Totale indicativo') + '</p><p class="bf-p num">' + AA.price(st.total) + (B.tbc ? '<small> +?</small>' : '') + '</p>' +
      '<p class="bf-s">' + esc(B.start.item.name) + (parts.length ? ', ' + esc(parts.join('; ')) : '') + '</p></div>' +
      '<div class="bf-r"><button type="button" class="b-fire" data-b="waiter">Mostra al cameriere</button></div>';
    var mine = $('bMine');
    if (mine) mine.innerHTML = st.ing.length ? '<p class="b-sub">Aggiunti da te. Tocca per togliere</p><div class="bchips">' + st.ing.map(function (it) {
      return '<button type="button" class="bchip b-mine" data-b="extra" data-v="' + esc(it.id) + '" aria-pressed="true" aria-label="' + esc(it.name) + ', tocca per toglierlo"><span>' + esc(it.name) + '</span><em class="num">' + AA.price(unitPrice(it), { signed: true }) + '</em><i aria-hidden="true"></i></button>';
    }).join('') + '</div>' : '';
  }
  function showWaiter() {
    var st = builderState();
    var algs = AA.allergenNums(st.algs);
    $('waiter').innerHTML = '<div class="w-in"><p class="w-k">La mia pizza</p><h2 class="w-t" id="wTitle">' + esc(B.start.item.name) + (st.ing.length || st.rem.length ? ', a modo mio' : '') + '</h2><dl class="w-l">' +
      st.lines.map(function (l) { return '<div><dt>' + esc(l[0] || 'Variante') + '</dt><dd>' + esc(l[1]) + '</dd></div>'; }).join('') +
      (st.rem.length ? '<div class="w-no"><dt>Senza</dt><dd>' + st.rem.map(function (r) { return esc(r); }).join(', ') + '</dd></div>' : '') +
      (st.ing.length ? '<div><dt>In più</dt><dd>' + st.ing.map(function (i) { return esc(i.name); }).join(', ') + '</dd></div>' : '') +
      '</dl><p class="w-p num">' + AA.price(st.total) + '<small>prezzo indicativo</small></p>' +
      (algs.length ? '<p class="w-a">Allergeni: ' + algs.map(function (a) { return '<span class="alg">' + a.n + '</span>'; }).join('') + '</p>' : '') +
      '<button type="button" class="b-fire" id="wBack">Torna a modificare</button></div>';
    $('waiter').hidden = false;
    $('wBack').onclick = function () { $('waiter').hidden = true; };
    $('wBack').focus();
  }
  function bindBuilder() {
    $('builder').addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      var g = b.dataset.b, v = b.dataset.v;
      if (g === 'start') { B.start = B.starts.filter(function (x) { return x.item.id === v; })[0]; B.baseOpt = null; B.mods = []; B.removed = []; B.picking = false; renderBuilder(); return; }
      if (g === 'pick') { B.picking = !B.picking; renderBuilder(); return; }
      if (g === 'pickit') {
        var hit = allPizzas().filter(function (x) { return x.item.id === v; })[0];
        if (hit) {
          if (!B.starts.some(function (x) { return x.item.id === v; })) B.starts.unshift(hit);
          B.start = B.starts.filter(function (x) { return x.item.id === v; })[0]; B.baseOpt = null; B.mods = []; B.removed = []; B.picking = false; renderBuilder();
          var t = $('bBody'); if (t) t.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      if (g === 'rm') {
        var r = B.removed.indexOf(v); if (r >= 0) B.removed.splice(r, 1); else B.removed.push(v);
        var off = B.removed.indexOf(v) >= 0;
        b.classList.toggle('off', off); b.setAttribute('aria-pressed', off ? 'false' : 'true');
        b.setAttribute('aria-label', cap(v) + (off ? ', tolto: tocca per rimetterlo' : ', tocca per toglierlo'));
        updateBuilder(); return;
      }
      if (g === 'dough') B.dough = B.doughs.filter(function (d) { return d.id === v; })[0];
      if (g === 'base') B.baseOpt = v || null;
      if (g === 'mod') { var k = B.mods.indexOf(v); if (k >= 0) B.mods.splice(k, 1); else B.mods.push(v); }
      if (g === 'extra') { var j = B.sel.indexOf(v); if (j >= 0) B.sel.splice(j, 1); else B.sel.push(v); }
      if (g === 'preset') { B.presets[Number(v)].ids.forEach(function (id) { if (B.sel.indexOf(id) < 0) B.sel.push(id); }); }
      if (g === 'reset') { var first = B.starts[0]; B.start = first; B.dough = B.doughs.filter(function (d) { return !Number(d.price); })[0] || B.doughs[0] || null; B.baseOpt = null; B.mods = []; B.sel = []; B.removed = []; B.picking = false; renderBuilder(); return; }
      if (g === 'waiter') { showWaiter(); return; }
      if (g === 'close') return;
      // aggiorna solo gli stati dei pulsanti
      $('bBody').querySelectorAll('[data-b="dough"]').forEach(function (x) { x.setAttribute('aria-pressed', B.dough && x.dataset.v === B.dough.id); });
      $('bBody').querySelectorAll('[data-b="base"]').forEach(function (x) { x.setAttribute('aria-pressed', (x.dataset.v || null) === B.baseOpt); });
      $('bBody').querySelectorAll('[data-b="mod"]').forEach(function (x) { x.setAttribute('aria-pressed', B.mods.indexOf(x.dataset.v) >= 0); });
      $('bBody').querySelectorAll('[data-b="extra"]').forEach(function (x) { x.setAttribute('aria-pressed', B.sel.indexOf(x.dataset.v) >= 0); });
      updateBuilder();
      if (g === 'preset' || g === 'extra') { var f = $('bFoot'); f.classList.remove('bump'); void f.offsetWidth; f.classList.add('bump'); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('waiter').hidden) $('waiter').hidden = true; });
  }
  function builderCTA() {
    return '<button type="button" class="bcta" data-open-builder><span class="bcta-t">Crea la tua pizza</span><span class="bcta-s">Scegli impasto, base e ingredienti. Il prezzo lo vedi subito.</span><span class="bcta-i" aria-hidden="true">+</span></button>';
  }

  /* Filtri */
  function renderFilters() {
    $('fTags').innerHTML = AA.TAGS.filter(function (t) { return t.code !== 'della-casa' && t.code !== 'novita' && t.code !== 'alcolico' && t.code !== 'analcolico'; }).map(function (t) {
      return '<button type="button" class="chip" data-tag="' + t.code + '" aria-pressed="' + (state.tags.indexOf(t.code) >= 0) + '">' + esc(t.label) + '</button>';
    }).join('');
    $('fAllergens').innerHTML = AA.ALLERGENS.map(function (a) {
      return '<button type="button" class="chip" data-alg="' + a.code + '" aria-pressed="' + (state.noAllergens.indexOf(a.code) >= 0) + '">' + a.n + '. ' + esc(a.label) + '</button>';
    }).join('');
  }
  function nFilters() { return state.tags.length + state.noAllergens.length; }
  function countMatches() {
    var count = 0;
    DATA.sections.forEach(function (s) { if (s.visible) count += s.items.filter(matches).length; });
    return count;
  }
  function filterNames() {
    return state.tags.map(function (c) { var t = AA.TAG_BY_CODE[c]; return t ? t.label : c; })
      .concat(state.noAllergens.map(function (c) {
        var a = AA.ALLERGENS.filter(function (x) { return x.code === c; })[0];
        return 'senza ' + (a ? a.label : c).toLowerCase();
      }));
  }
  function filterChip() {
    var n = nFilters(); if (!n) return '';
    var label = n === 1 ? filterNames()[0] : n + ' filtri';
    return '<button type="button" class="gnav-f" data-clear-filters aria-label="Togli ' + (n === 1 ? 'il filtro ' : 'i filtri: ') + esc(filterNames().join(', ')) + '">' + esc(label) + '<i aria-hidden="true"></i></button>';
  }
  function dropHash() {
    if (!location.hash || location.hash === '#crea') return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function updateFilterUI() {
    var n = nFilters();
    $('filterCount').hidden = !n; $('filterCount').textContent = n;
    var box = $('activeFilters');
    var apply = $('fApply');
    if (!n) { box.hidden = true; box.innerHTML = ''; if (apply) apply.textContent = 'Mostra tutto il menu'; return; }
    var count = countMatches();
    var gf = state.tags.indexOf('senza-glutine') >= 0, onlyGf = gf && n === 1;
    var title = onlyGf ? 'Menu senza glutine' : 'Filtri attivi: ' + filterNames().join(', ');
    var text = count + (count === 1 ? ' piatto' : ' piatti') + (onlyGf ? ' senza glutine o che possiamo fare senza glutine.' : '.');
    if (gf && Object.keys(CAN_GF).length) text += ' Pizze e panzerotti con l’impasto senza glutine hanno un supplemento.';
    if (gf) text += ' Se sei celiaco, dillo sempre quando ordini.';
    box.hidden = false;
    box.innerHTML = '<div class="af-t"><b>' + esc(title) + '</b><span>' + esc(text) + '</span></div>' +
      '<button type="button" class="af-x" data-clear-filters>Mostra tutto il menu</button>';
    if (apply) apply.textContent = count ? 'Mostra ' + count + (count === 1 ? ' piatto' : ' piatti') : 'Nessun piatto';
  }
  function applyFilters() { dropHash(); updateFilterUI(); render(); }
  function clearFilters() {
    // tiene il segno: dopo aver tolto il filtro resti sul piatto che stavi guardando
    var line = $('gnav').hidden ? 80 : $('gnav').getBoundingClientRect().bottom, anchor = null, off = 0;
    var passed = $('contenuto').getBoundingClientRect().top < line;
    if (passed) {
      var its = document.querySelectorAll('#contenuto [data-item]');
      for (var i = 0; i < its.length; i++) {
        var r = its[i].getBoundingClientRect();
        if (its[i].offsetParent && r.bottom > line + 8) { anchor = its[i].dataset.item; off = r.top; break; }
      }
      var fa = anchor && findItem(anchor);
      if (fa) OPEN[fa.sec.id] = true; // la tendina del piatto che stavi guardando resta aperta
    }
    state.tags = []; state.noAllergens = [];
    renderFilters(); applyFilters();
    if (!passed) return;
    var el = anchor && document.querySelector('#contenuto [data-item="' + anchor + '"]');
    if (el) {
      // le schede di quella sottocategoria compaiono subito, senza animazione, così il punto non si sposta
      var near = [].slice.call((el.closest('.sec') || document).querySelectorAll('.item'));
      near.forEach(function (it) { it.style.transition = 'none'; it.classList.add('in'); });
      requestAnimationFrame(function () { near.forEach(function (it) { it.style.transition = ''; }); });
      if (el.offsetParent) { window.scrollBy(0, el.getBoundingClientRect().top - off); return; }
    }
    var f = anchor && findItem(anchor), g = f && $('g-' + f.sec.group);
    if (g) g.scrollIntoView();
  }

  function renderHeader() {
    var info = DATA.info;
    var st = AA.openStatus(info);
    if (st) { $('status').textContent = st.text; $('status').classList.add(st.open ? 'is-open' : 'is-closed'); }
    var ann = AA.announcement(DATA);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    var promos = AA.activePromos(DATA, 'menu');
    $('promos').innerHTML = promos.map(function (p) {
      return '<article class="promo">' + (p.image ? '<img alt="" loading="lazy" src="' + esc(AA.src(p.image)) + '">' : '') +
        '<div>' + (p.kicker ? '<span class="promo-k">' + esc(p.kicker) + '</span>' : '') +
        '<h2 class="promo-t">' + esc(p.title) + '</h2>' + (p.text ? '<p class="promo-x">' + esc(p.text) + '</p>' : '') +
        (p.price ? '<p class="promo-p num">' + esc(p.price) + '</p>' : '') + '</div></article>';
    }).join('');
    $('promos').hidden = !promos.length;
  }

  function renderFooter() {
    var i = DATA.info, f = '<div class="mf-in">';
    f += '<div class="mf-card"><h2>Da sapere</h2><div class="mf-row">' +
      (i.coverCharge ? '<p class="mf-kv"><b>Coperto</b>' + AA.price(i.coverCharge) + '</p>' : '') +
      (i.wifi && i.wifi.network ? '<p class="mf-kv"><b>Wi‑Fi gratuito</b>' + esc(i.wifi.network) + ', password ' + esc(i.wifi.password) + '</p>' : '') +
      '<p class="mf-kv"><b>Prenotazioni</b><a href="' + AA.telHref(i.phone) + '">' + esc(i.phone) + '</a></p>' +
      (i.mobile ? '<p class="mf-kv"><b>Cellulare</b><a href="' + AA.telHref(i.mobile) + '">' + esc(i.mobile) + '</a></p>' : '') +
      '<p class="mf-kv"><b>Orari</b>' + (i.hours || []).map(function (h) { return esc(h.days) + ' ' + esc(h.time); }).join('<br>') + '</p></div>';
    if (i.products) f += '<details><summary>I nostri prodotti</summary><p>' + esc(i.products) + '</p></details>';
    (i.notes || []).forEach(function (n) { f += '<details><summary>' + esc(n.title) + '</summary><p>' + esc(n.text) + '</p></details>'; });
    if (i.frozenLegend) f += '<p class="mf-frz"><span class="frz">*</span> ' + esc(i.frozenLegend) + '</p>';
    f += '<p class="mf-frz"><a href="#g-allergeni">Allergeni e intolleranze</a></p></div>';
    f += '<p style="text-align:center;padding:8px 0"><a href="../">Scopri L\'Antico Arco</a> · <a href="../privacy/">Privacy e cookie</a></p></div>';
    $('footer').innerHTML = f;
  }

  function toggleAcc(id, force) {
    var el = document.getElementById(id); if (!el || !el.classList.contains('acc')) return;
    var open = force != null ? force : !el.classList.contains('open');
    OPEN[id] = open;
    el.classList.toggle('open', open);
    el.querySelector('.acc-h').setAttribute('aria-expanded', open);
    var inn = el.querySelector('.acc-in');
    if (open) inn.removeAttribute('inert'); else inn.setAttribute('inert', '');
    if (open) {
      reveal();
      setTimeout(function () {
        var r = el.getBoundingClientRect();
        if (r.top < 120 || r.top > window.innerHeight * .6) window.scrollTo({ top: window.scrollY + r.top - 130, behavior: 'smooth' });
      }, 60);
    }
  }
  function bind() {
    var t;
    $('contenuto').addEventListener('click', function (e) {
      var h = e.target.closest('[data-acc]'); if (!h) return;
      toggleAcc(h.dataset.acc);
    });
    $('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 140); });
    $('searchBtn').onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(function () { $('q').focus(); }, 300); };
    $('contenuto').addEventListener('click', function (e) {
      var b = e.target.closest('[data-item]'); if (!b) return;
      var f = findItem(b.dataset.item); if (f) openSheet($('sheet'), detailHTML(f.item, f.sec));
    });
    document.querySelectorAll('.sheet').forEach(function (sh) {
      sh.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(sh); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.sheet:not([hidden])').forEach(closeSheet); });
    $('filterBtn').onclick = function () { renderFilters(); updateFilterUI(); openSheet($('filters')); };
    $('filters').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var list = c.dataset.tag ? state.tags : state.noAllergens, v = c.dataset.tag || c.dataset.alg, k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      c.setAttribute('aria-pressed', k < 0);
      applyFilters();
    });
    $('fReset').onclick = function () { state.tags = []; state.noAllergens = []; renderFilters(); applyFilters(); };
    $('fApply').onclick = function () {
      closeSheet($('filters'));
      var box = $('activeFilters'), to = !box.hidden ? box : $('gnav');
      window.scrollTo({ top: Math.max(0, to.getBoundingClientRect().top + window.scrollY - 84), behavior: 'smooth' });
    };
  }

  document.addEventListener('click', function (e) {
    if (DATA && e.target.closest('[data-clear-filters]')) { e.preventDefault(); clearFilters(); }
  });
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open-builder]'); if (!o || !DATA) return;
    e.preventDefault();
    if (!$('sheet').hidden) closeSheet($('sheet'));
    openBuilder(o.getAttribute('data-open-builder') || null);
  });
  AA.loadMenu().then(function (data) {
    DATA = data;
    data.sections.forEach(function (sec) {
      if ((sec.supplements || []).some(function (sp) { return /senza glutine/i.test(sp.label || ''); })) sec.items.forEach(function (it) { CAN_GF[it.id] = true; });
    });
    var tagHash = location.hash.slice(1);
    if (tagHash && AA.TAG_BY_CODE[tagHash]) { state.tags = [tagHash]; }
    renderHeader(); render(); renderFooter(); bind(); bindBuilder();
    // un link a #senza-glutine (o a un altro filtro) mentre sei già nel menu
    window.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (!h || !AA.TAG_BY_CODE[h]) return;
      state.tags = [h]; state.noAllergens = [];
      renderFilters(); applyFilters();
      window.scrollTo(0, 0);
    });
    if (state.tags.length) { dropHash(); updateFilterUI(); return; }
    if (location.hash === '#crea') { openBuilder(null); return; }
    if (location.hash) {
      var el = null;
      try { el = document.querySelector(location.hash); } catch (e) {}
      if (el && el.classList.contains('acc')) toggleAcc(el.id, true);
      else if (el) el.scrollIntoView();
    }
  }).catch(function () {
    $('contenuto').innerHTML = '<p class="empty">Non riesco a caricare il menu. Controlla la connessione e ricarica la pagina.</p>';
  });
})();
