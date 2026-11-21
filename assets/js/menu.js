/* Menu per telefono, tablet e PC */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var DATA = null;
  var state = { q: '', tags: [], noAllergens: [] };
  var $ = function (id) { return document.getElementById(id); };

  document.querySelectorAll('[data-arch]').forEach(function (el) { el.innerHTML = AA.archSVG(); });

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

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
    var words = state.q.trim().split(/\s+/).filter(function (w) { return w.length > 1; });
    words.forEach(function (w) {
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      t = t.replace(re, '<mark>$1</mark>');
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
    return (tags || []).map(function (t) {
      var d = AA.TAG_BY_CODE[t];
      return d ? '<span class="tag tag-' + t + '">' + esc(d.short) + '</span>' : '';
    }).join('');
  }

  function itemHTML(it, sec) {
    var hasPh = it.image && sec.layout !== 'chips';
    var price = AA.itemPriceHTML(it, 'item-price');
    if (sec.deltaPrices && it.price != null && !(it.prices && it.prices.length)) {
      price = '<span class="item-price num">' + AA.price(it.price, { signed: true }) + '</span>';
    }
    return '<li class="item"><button class="item-btn' + (hasPh ? ' has-ph' : '') + '" type="button" data-item="' + esc(it.id) + '">' +
      (hasPh ? '<img class="item-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">' : '') +
      '<span class="item-main">' +
      '<span class="item-name">' + hl(it.name) + (it.frozen ? '<span class="frz" title="' + esc(DATA.info.frozenLegend) + '">*</span>' : '') + '</span>' +
      (it.desc ? '<span class="item-desc clamp" style="display:block">' + hl(it.desc) + '</span>' : '') +
      (it.note ? '<span class="item-note" style="display:block">' + esc(it.note) + '</span>' : '') +
      ((it.tags && it.tags.length) || (it.allergens && it.allergens.length) ? '<span class="item-meta">' + tagsHTML(it.tags) + algsHTML(it.allergens) + '</span>' : '') +
      '</span>' + (price || '<span></span>') + '</button></li>';
  }

  function cardsHTML(items, sec) {
    return '<div class="cards">' + items.map(function (it) {
      var p = it.price == null ? 'Prezzo da confermare' : (sec.deltaPrices && Number(it.price) === 0 ? 'Impasto base' : AA.price(it.price, { signed: !!sec.deltaPrices }));
      return '<button class="card" type="button" data-item="' + esc(it.id) + '">' +
        (it.image ? '<img class="card-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">'
          : '<span class="card-ph ph-empty">' + AA.archSVG() + '</span>') +
        '<span class="card-name" style="display:block">' + hl(it.name) + '</span>' +
        '<span class="card-price num" style="display:block">' + p + '</span></button>';
    }).join('') + '</div>';
  }

  function chipsHTML(items) {
    var byPrice = {};
    items.forEach(function (it) { var k = String(it.price); (byPrice[k] = byPrice[k] || []).push(it); });
    return Object.keys(byPrice).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) {
      return '<div class="chipgrp"><h4 class="num">' + AA.price(Number(k), { signed: true }) + '</h4><ul>' +
        byPrice[k].map(function (it) {
          var al = AA.allergenNums(it.allergens).map(function (a) { return a.n; }).join(',');
          return '<li>' + hl(it.name) + (al ? '<sup>' + al + '</sup>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function sectionHTML(sec) {
    var items = sec.items.filter(matches);
    if (!items.length) return '';
    var body;
    if (sec.layout === 'cards' && !state.q) body = cardsHTML(items, sec);
    else if (sec.layout === 'chips') body = chipsHTML(items);
    else body = '<ul class="items">' + items.map(function (it) { return itemHTML(it, sec); }).join('') + '</ul>';
    var suppl = (sec.supplements || []).length ? '<ul class="suppl">' + sec.supplements.map(function (s) {
      return '<li>' + esc(s.label) + ' <b class="num">' + AA.price(s.price, { signed: true }) + '</b></li>';
    }).join('') + '</ul>' : '';
    return '<section class="sec" id="' + esc(sec.id) + '">' +
      '<h3 class="sec-t">' + esc(sec.name) + '</h3>' +
      (sec.subtitle ? '<p class="sec-sub">' + esc(sec.subtitle) + '</p>' : '') +
      (sec.note && !state.q ? '<p class="sec-note">' + esc(sec.note) + '</p>' : '') +
      (state.q ? '' : suppl) + body + '</section>';
  }

  function render() {
    var main = $('contenuto');
    var html = '';
    var navHtml = '';
    DATA.groups.forEach(function (g) {
      var secs = DATA.sections.filter(function (s) { return s.group === g.id && s.visible; });
      var inner = secs.map(sectionHTML).join('');
      if (!inner) return;
      var only = secs.filter(function (s) { return s.items.some(matches); });
      var showGroupTitle = !(only.length === 1 && norm(only[0].name).indexOf(norm(g.name)) >= 0);
      html += '<section class="grp" id="g-' + esc(g.id) + '">' +
        (showGroupTitle ? '<h2 class="grp-t">' + esc(g.name) + '</h2>' : '<h2 class="sr-only">' + esc(g.name) + '</h2>') + inner + '</section>';
      navHtml += '<a href="#g-' + esc(g.id) + '" data-g="' + esc(g.id) + '">' + esc(g.name) + '</a>';
    });
    main.innerHTML = html || '<p class="empty">Nessun piatto corrisponde alla ricerca. Prova con un\'altra parola o azzera i filtri.</p>';
    $('gnavIn').innerHTML = navHtml;
    $('gnav').hidden = !navHtml;
    spy();
  }

  /* Evidenzia la categoria visibile */
  var observer;
  function spy() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('#gnavIn a').forEach(function (a) { links[a.dataset.g] = a; });
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id.slice(2);
        Object.keys(links).forEach(function (k) { links[k].setAttribute('aria-current', k === id ? 'true' : 'false'); });
        var a = links[id];
        if (a) {
          var nav = $('gnavIn');
          nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.grp').forEach(function (g) { observer.observe(g); });
  }

  function findItem(id) {
    for (var i = 0; i < DATA.sections.length; i++) {
      var s = DATA.sections[i];
      for (var j = 0; j < s.items.length; j++) if (s.items[j].id === id) return { item: s.items[j], sec: s };
    }
    return null;
  }

  /* Scheda dettaglio */
  var lastFocus = null;
  function openSheet(el, html) {
    lastFocus = document.activeElement;
    if (html != null) $('sheetBody').innerHTML = html;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    el.querySelector('.sheet-card').focus();
  }
  function closeSheet(el) {
    el.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  function detailHTML(it, sec) {
    var price = AA.itemPriceHTML(it, '');
    if (sec.deltaPrices && it.price != null) price = Number(it.price) === 0 ? 'Impasto base' : AA.price(it.price, { signed: true });
    if (!price && !(it.prices && it.prices.length)) price = '<span class="d-tbc">Prezzo da confermare</span>';
    var algs = AA.allergenNums(it.allergens);
    return (it.image ? '<img class="d-ph" alt="" src="' + esc(AA.src(it.image)) + '">' : '') +
      '<p class="d-sec">' + esc(sec.name) + '</p>' +
      '<h2 class="d-name" id="sheetTitle">' + esc(it.name) + (it.frozen ? '<span class="frz">*</span>' : '') + '</h2>' +
      (price ? '<div class="d-price num">' + price + '</div>' : '') +
      (it.desc ? '<p class="d-desc">' + esc(it.desc) + '</p>' : '') +
      (it.note ? '<p class="item-note">' + esc(it.note) + '</p>' : '') +
      (it.tags && it.tags.length ? '<div class="item-meta">' + tagsHTML(it.tags) + '</div>' : '') +
      (algs.length ? '<h3 class="d-h">Allergeni</h3><ul class="d-algs">' + algs.map(function (a) {
        return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>';
      }).join('') + '</ul>' : '') +
      ((sec.supplements || []).length ? '<h3 class="d-h">Varianti</h3><ul class="suppl">' + sec.supplements.map(function (s) {
        return '<li>' + esc(s.label) + ' <b class="num">' + AA.price(s.price, { signed: true }) + '</b></li>';
      }).join('') + '</ul>' : '') +
      (it.frozen ? '<p class="d-note">* ' + esc(DATA.info.frozenLegend) + '</p>' : '') +
      '<p class="d-note">' + esc(DATA.info.allergenNote) + '</p>';
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
    $('filterCount').hidden = !n;
    $('filterCount').textContent = n;
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
    if (st) { var el = $('status'); el.hidden = false; el.textContent = st.text; el.classList.toggle('is-open', st.open); }
    var ann = AA.announcement(DATA);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    var promos = AA.activePromos(DATA, 'menu');
    if (promos.length) {
      $('promos').hidden = false;
      $('promos').innerHTML = promos.map(function (p) {
        return '<article class="promo' + (p.image ? '' : ' no-img') + '"><div>' +
          (p.kicker ? '<p class="promo-k">' + esc(p.kicker) + '</p>' : '') +
          '<h2 class="promo-t">' + esc(p.title) + '</h2>' +
          (p.text ? '<p class="promo-x">' + esc(p.text) + '</p>' : '') +
          (p.price ? '<p class="promo-p num">' + esc(p.price) + '</p>' : '') + '</div>' +
          (p.image ? '<img alt="" loading="lazy" src="' + esc(AA.src(p.image)) + '">' : '') + '</article>';
      }).join('');
    }
  }

  function renderFooter() {
    var i = DATA.info;
    var f = '<div class="mf-in">';
    f += '<div><h2>Da sapere</h2><div class="mf-row">' +
      (i.coverCharge ? '<p class="mf-kv"><b>Coperto</b><span class="num">' + AA.price(i.coverCharge) + '</span></p>' : '') +
      (i.wifi && i.wifi.network ? '<p class="mf-kv"><b>Wi‑Fi gratuito</b>Rete ' + esc(i.wifi.network) + ', password ' + esc(i.wifi.password) + '</p>' : '') +
      '<p class="mf-kv"><b>Prenotazioni</b><a href="' + AA.telHref(i.phone) + '">' + esc(i.phone) + '</a></p>' +
      '</div>';
    (i.notes || []).forEach(function (n) { f += '<details><summary>' + esc(n.title) + '</summary><p>' + esc(n.text) + '</p></details>'; });
    f += '</div>';
    f += '<div><h2>Allergeni</h2><p class="mf-small" style="margin-bottom:12px">' + esc(i.allergenNote) + ' I numeri accanto ai piatti indicano gli allergeni (Reg. UE 1169/2011).</p><ul class="alg-legend">' +
      AA.ALLERGENS.map(function (a) { return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>'; }).join('') + '</ul>' +
      '<p class="mf-small" style="margin-top:12px"><span class="frz">*</span> ' + esc(i.frozenLegend) + '</p></div>';
    f += '<div><h2>' + esc(i.name) + '</h2><p>' + esc(i.address) + '</p><p>' +
      (i.hours || []).map(function (h) { return esc(h.days) + ': ' + esc(h.time); }).join('<br>') + '</p>' +
      '<p style="margin-top:10px"><a href="../">Il nostro sito</a></p></div>';
    f += '</div>';
    $('footer').innerHTML = f;
  }

  function bind() {
    var t;
    $('q').addEventListener('input', function (e) {
      clearTimeout(t);
      t = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 120);
    });
    $('contenuto').addEventListener('click', function (e) {
      var b = e.target.closest('[data-item]');
      if (!b) return;
      var f = findItem(b.dataset.item);
      if (f) openSheet($('sheet'), detailHTML(f.item, f.sec));
    });
    document.querySelectorAll('.sheet').forEach(function (sh) {
      sh.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(sh); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.querySelectorAll('.sheet:not([hidden])').forEach(closeSheet);
    });
    $('filterBtn').onclick = function () { renderFilters(); openSheet($('filters')); };
    $('filters').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var list = c.dataset.tag ? state.tags : state.noAllergens;
      var v = c.dataset.tag || c.dataset.alg;
      var k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      c.setAttribute('aria-pressed', k < 0);
    });
    $('fReset').onclick = function () { state.tags = []; state.noAllergens = []; renderFilters(); };
    $('fApply').onclick = function () { closeSheet($('filters')); updateFilterUI(); render(); window.scrollTo({ top: $('tools').offsetTop - 10 }); };
  }

  AA.loadMenu().then(function (data) {
    DATA = data;
    renderHeader();
    render();
    renderFooter();
    bind();
    if (location.hash) { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  }).catch(function () {
    $('contenuto').innerHTML = '<p class="empty">Non riesco a caricare il menu. Controlla la connessione e ricarica la pagina.</p>';
  });
})();
