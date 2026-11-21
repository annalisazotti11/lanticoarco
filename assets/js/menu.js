/* Menu per telefono, tablet e PC */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var DATA = null;
  var state = { q: '', tags: [], noAllergens: [] };
  var $ = function (id) { return document.getElementById(id); };

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filtering() { return !!(state.q || state.tags.length || state.noAllergens.length); }

  function matches(item) {
    if (item.available === false) return false;
    if (state.tags.length && !state.tags.every(function (t) { return (item.tags || []).indexOf(t) >= 0; })) return false;
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
  function sectionHTML(sec) {
    var items = sec.items.filter(matches);
    if (!items.length) return '';
    var body = sec.layout === 'cards' && !state.q ? cardsHTML(items, sec)
      : sec.layout === 'chips' ? chipsHTML(items)
      : '<ul class="items">' + items.map(function (it) { return itemHTML(it, sec); }).join('') + '</ul>';
    return '<section class="sec" id="' + esc(sec.id) + '"><h3 class="sec-t">' + esc(sec.name) + '</h3>' +
      (sec.subtitle ? '<p class="sec-sub">' + esc(sec.subtitle) + '</p>' : '') +
      (sec.note && !filtering() ? '<p class="sec-note">' + esc(sec.note) + '</p>' : '') +
      (filtering() ? '' : suppHTML(sec)) + body + '</section>';
  }

  function groupsWithContent() {
    return DATA.groups.filter(function (g) {
      return DATA.sections.some(function (s) { return s.group === g.id && s.visible && s.items.some(matches); });
    });
  }

  /* Come si sceglie: tre passi, chiudibile */
  function renderGuide() {
    var box = $('guide'), seen = false;
    try { seen = localStorage.getItem('aa-guida') === '1'; } catch (e) {}
    if (seen || filtering()) { box.hidden = true; return; }
    var imp = DATA.sections.filter(function (s) { return s.group === 'impasti' && s.visible; })[0];
    var min = null;
    if (imp) imp.items.forEach(function (it) { var v = Number(it.price); if (v > 0 && (min === null || v < min)) min = v; });
    var hasExtra = DATA.sections.some(function (s) { return s.group === 'aggiunte' && s.visible && s.items.length; });
    var steps = [
      ['g-impasti', 'Scegli l\'impasto', 'Il classico è compreso' + (min ? ', gli altri da ' + AA.price(min) + ' in più' : '') + '.'],
      ['g-pizze', 'Poi la pizza', 'Gourmet, classiche, bianche o vegan. Le più amate sono segnate come “Preferita”.'],
      hasExtra ? ['g-aggiunte', 'Aggiungi o togli', 'Ogni pizza si può personalizzare: le aggiunte sono in fondo al menu.'] : null
    ].filter(function (x) { return x && document.getElementById(x[0]); });
    if (!steps.length) { box.hidden = true; return; }
    box.innerHTML = '<div class="guide-in"><div class="guide-h"><h2 id="guideT">Prima volta da noi?</h2><button type="button" class="guide-x" id="guideX">Ho capito</button></div><ol>' +
      steps.map(function (st) { return '<li><a href="#' + st[0] + '"><b>' + esc(st[1]) + '</b><span>' + esc(st[2]) + '</span></a></li>'; }).join('') +
      '</ol><p class="guide-f">Allergie o intolleranze? Usa i <button type="button" id="guideF">filtri</button> o chiedi a noi: molte pizze si possono preparare senza glutine o senza lattosio.</p></div>';
    box.hidden = false;
    $('guideX').onclick = function () { try { localStorage.setItem('aa-guida', '1'); } catch (e) {} box.hidden = true; };
    $('guideF').onclick = function () { $('filterBtn').click(); };
  }

  function renderTiles() {
    var f = filtering();
    $('tiles').hidden = f;
    $('promos').hidden = f || !$('promos').innerHTML;
    if (f) return;
    $('tiles').innerHTML = groupsWithContent().map(function (g) {
      var n = 0;
      DATA.sections.forEach(function (s) { if (s.group === g.id && s.visible) n += s.items.filter(matches).length; });
      return '<a class="tile' + (g.image ? '' : ' no-img') + '" href="#g-' + esc(g.id) + '">' +
        (g.image ? '<img alt="" loading="lazy" src="' + esc(AA.src(g.image)) + '">' : '') +
        '<span><b>' + esc(g.name) + '</b><small>' + n + (n === 1 ? ' proposta' : ' proposte') + '</small></span></a>';
    }).join('');
  }

  function render() {
    var html = '', nav = '';
    groupsWithContent().forEach(function (g) {
      var secs = DATA.sections.filter(function (s) { return s.group === g.id && s.visible; });
      var inner = secs.map(sectionHTML).join('');
      if (!inner) return;
      html += '<section class="grp" id="g-' + esc(g.id) + '"><h2 class="grp-t">' + esc(g.name) + '</h2>' + inner + '</section>';
      nav += '<a href="#g-' + esc(g.id) + '" data-g="' + esc(g.id) + '">' + esc(g.name) + '</a>';
    });
    $('contenuto').innerHTML = html || '<p class="empty">Nessun piatto corrisponde. Prova con un\'altra parola o azzera i filtri.</p>';
    $('gnavIn').innerHTML = nav;
    $('gnav').hidden = !nav;
    renderTiles(); renderGuide();
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

  /* Categoria visibile nella barra */
  var spyIO;
  function spy() {
    if (spyIO) spyIO.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('#gnavIn a').forEach(function (a) { links[a.dataset.g] = a; });
    spyIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id.slice(2);
        Object.keys(links).forEach(function (k) { links[k].setAttribute('aria-current', k === id ? 'true' : 'false'); });
        var a = links[id], nav = $('gnavIn');
        if (a) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.grp').forEach(function (g) { spyIO.observe(g); });
  }

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
  function closeSheet(el) { el.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }

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
      ((sec.supplements || []).length ? '<h3 class="d-h">Varianti</h3>' + suppHTML(sec) : '') +
      (it.frozen ? '<p class="d-note">* ' + esc(DATA.info.frozenLegend) + '</p>' : '') +
      '<p class="d-note">' + esc(DATA.info.allergenNote) + '</p></div>';
  }

  /* Filtri */
  function renderFilters() {
    $('fTags').innerHTML = AA.TAGS.filter(function (t) { return t.code !== 'della-casa' && t.code !== 'novita'; }).map(function (t) {
      return '<button type="button" class="chip" data-tag="' + t.code + '" aria-pressed="' + (state.tags.indexOf(t.code) >= 0) + '">' + esc(t.label) + '</button>';
    }).join('');
    $('fAllergens').innerHTML = AA.ALLERGENS.map(function (a) {
      return '<button type="button" class="chip" data-alg="' + a.code + '" aria-pressed="' + (state.noAllergens.indexOf(a.code) >= 0) + '">' + a.n + '. ' + esc(a.label) + '</button>';
    }).join('');
  }
  function updateFilterUI() {
    var n = state.tags.length + state.noAllergens.length;
    $('filterCount').hidden = !n; $('filterCount').textContent = n;
    var box = $('activeFilters');
    if (!n) { box.hidden = true; box.innerHTML = ''; return; }
    var count = 0;
    DATA.sections.forEach(function (s) { if (s.visible) count += s.items.filter(matches).length; });
    box.hidden = false;
    box.innerHTML = '<span>' + count + ' piatti con i filtri attivi</span><button type="button" id="clearF">Azzera filtri</button>';
    $('clearF').onclick = function () { state.tags = []; state.noAllergens = []; renderFilters(); updateFilterUI(); render(); };
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
      '<p class="mf-kv"><b>Orari</b>' + (i.hours || []).map(function (h) { return esc(h.days) + ' ' + esc(h.time); }).join('<br>') + '</p></div>';
    (i.notes || []).forEach(function (n) { f += '<details><summary>' + esc(n.title) + '</summary><p>' + esc(n.text) + '</p></details>'; });
    f += '</div><div class="mf-card"><h2>Allergeni</h2><p style="margin-bottom:12px">' + esc(i.allergenNote) + ' I numeri accanto ai piatti indicano gli allergeni (Reg. UE 1169/2011).</p><ul class="alg-legend">' +
      AA.ALLERGENS.map(function (a) { return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>'; }).join('') + '</ul>' +
      '<p style="margin-top:12px"><span class="frz">*</span> ' + esc(i.frozenLegend) + '</p></div>';
    f += '<p style="text-align:center;padding:8px 0"><a href="../">Scopri L\'Antico Arco</a></p></div>';
    $('footer').innerHTML = f;
  }

  function bind() {
    var t;
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
    $('filterBtn').onclick = function () { renderFilters(); openSheet($('filters')); };
    $('filters').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var list = c.dataset.tag ? state.tags : state.noAllergens, v = c.dataset.tag || c.dataset.alg, k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      c.setAttribute('aria-pressed', k < 0);
    });
    $('fReset').onclick = function () { state.tags = []; state.noAllergens = []; renderFilters(); };
    $('fApply').onclick = function () { closeSheet($('filters')); updateFilterUI(); render(); window.scrollTo({ top: $('gnav').offsetTop - 70, behavior: 'smooth' }); };
  }

  AA.loadMenu().then(function (data) {
    DATA = data;
    renderHeader(); render(); renderFooter(); bind();
    if (location.hash) { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  }).catch(function () {
    $('contenuto').innerHTML = '<p class="empty">Non riesco a caricare il menu. Controlla la connessione e ricarica la pagina.</p>';
  });
})();
