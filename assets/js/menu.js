/* Menu: comparti che si aprono e chiudono, righe pulite, impasti dentro le pizze */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  // prezzi semplici: 12 invece di 12,00
  var _price = AA.price;
  AA.price = function (v, o) { return String(_price(v, o)).replace(/,00(?!\d)/g, ''); };
  function cleanPrice(h) { return String(h).replace(/,00(?!\d)/g, ''); }
  var NUMW = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici'];
  var DATA = null;
  var state = { q: '', tags: [], noAllergens: [] };
  var browseGroup = null; // indice, singola categoria o ricerca globale
  var kioskParams = new URLSearchParams(location.search);
  var kioskV11 = kioskParams.has('totem') && !kioskParams.has('legacy');
  if (kioskV11) document.documentElement.classList.add('kiosk-v11');
  var $ = function (id) { return document.getElementById(id); };

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filtering() { return !!(state.q || state.tags.length || state.noAllergens.length); }

  var CAN_GF = {}; // piatti che si possono fare con l'impasto senza glutine (variante della sottocategoria)
  function hasTag(item, t) { return (item.tags || []).indexOf(t) >= 0 || (t === 'senza-glutine' && CAN_GF[item.id]); }
  function needsAllergenReview(it) { return it.allergenReview === true || (!(it.allergens || []).length && it.allergenReview !== false); }
  function matches(item) {
    if (item.available === false) return false;
    if (state.tags.length && !state.tags.every(function (t) { return hasTag(item, t); })) return false;
    if (state.noAllergens.length && (needsAllergenReview(item) || (item.allergens || []).some(function (a) { return state.noAllergens.indexOf(a) >= 0; }))) return false;
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
  function algsHTML(it) {
    var list = AA.allergenNums(it.allergens), review = needsAllergenReview(it);
    if (!list.length) return review ? '<span class="algs">Allergeni da verificare</span>' : '<span class="algs">Nessuno dichiarato</span>';
    return '<span class="algs" aria-label="Allergeni e possibili tracce: ' + list.map(function (a) { return a.label; }).join(', ') + (review ? '; scheda da verificare' : '') + '"><span aria-hidden="true">Allergeni ' +
      list.map(function (a) { return a.n; }).join(' · ') + (review ? ' · da verificare' : '') + '</span></span>';
  }
  function tagsHTML(tags) {
    return (tags || []).map(function (t) { var d = AA.TAG_BY_CODE[t]; return d ? '<span class="tag tag-' + t + '">' + esc(d.short) + '</span>' : ''; }).join('');
  }
  function priceHTML(it, sec) {
    if (it.prices && it.prices.length) return cleanPrice(AA.itemPriceHTML(it, ''));
    if (it.price === null || it.price === undefined || it.price === '') return '<span class="tbc">Chiedi al personale</span>';
    if (sec.deltaPrices) return Number(it.price) === 0 ? 'Impasto base' : AA.price(it.price, { signed: true });
    return AA.price(it.price);
  }

  function canChooseExtras(sec) { return sec.group === 'pizze' || sec.group === 'cicci'; }
  function plantAlternative(it) { return ['x206','x214','x217','x220'].indexOf(it.id) >= 0; }
  function veganRecipe(item, sec) { return ['s47','s51','s52'].indexOf(sec.id) >= 0 || (item.tags || []).indexOf('vegana') >= 0; }
  function extraOrder(a, b) { return a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }); }
  function itemVariant(it) {
    // Optional price on a single dish, not a supplement for its entire section.
    var note = String(it.note || '').match(/^Senza glutine\s*\+\s*€\s*(\d+(?:[,.]\d+)?)$/i);
    return note ? {label:'Senza glutine',price:Number(note[1].replace(',','.'))} : null;
  }
  function kioskSelectable(sec) { return sec.group !== 'impasti' && sec.group !== 'aggiunte'; }
  function kioskCard(it,sec) {
    var formats = it.prices || [], known = formats.map(function(p){return p.price;}).filter(function(p){return p !== null && p !== '' && Number.isFinite(Number(p));}).map(Number);
    var p = formats.length ? (known.length ? 'Da ' + AA.price(Math.min.apply(null,known)) : 'Da confermare') : knownPrice(it) ? AA.price(unitPrice(it)) : 'Da confermare';
    var badges = (it.featured ? '<span class="tag tag-pref">Preferita</span>' : '') + tagsHTML(it.tags);
    var image = it.image ? '<img src="' + esc(AA.src(it.image)) + '" alt="" loading="lazy" decoding="async">' : '<span class="k11-ph-empty" aria-hidden="true">' + AA.archSVG() + '</span>';
    var action = canChooseExtras(sec) ? '<button class="k11-card-action" type="button" data-open-builder="' + esc(it.id) + '" aria-label="' + (sec.group === 'pizze' ? 'Personalizza ' : 'Aggiunte per ') + esc(it.name) + '">' + (sec.group === 'pizze' ? 'Personalizza' : 'Aggiunte') + ' <span aria-hidden="true">+</span></button>' :
      '<button class="k11-card-action" type="button" data-item="' + esc(it.id) + '" aria-label="Scegli ' + esc(it.name) + '">' + (formats.length || (sec.supplements || []).length || itemVariant(it) ? 'Scegli opzioni' : 'Dettagli e selezione') + ' <span aria-hidden="true">›</span></button>';
    return '<li class="item k11-product"><button type="button" data-item="' + esc(it.id) + '" class="k11-product-open"><span class="k11-product-photo">' + image + '</span><span class="k11-product-copy"><strong>' + hl(it.name) + (it.frozen ? ' *' : '') + '</strong>' + (badges ? '<span class="k11-product-tags">' + badges + '</span>' : '') + '<span class="k11-product-price"><b class="num">' + p + '</b><small>' + (needsAllergenReview(it) ? 'Allergeni da verificare' : 'Ingredienti e allergeni') + '</small></span></span></button>' + action + '</li>';
  }
  function itemHTML(it, sec) {
    if (kioskV11 && kioskSelectable(sec)) return kioskCard(it,sec);
    var meta = (it.featured ? '<span class="tag tag-pref">Preferita</span>' : '') + tagsHTML(it.tags);
    var algs = algsHTML(it);
    return '<li class="item' + (canChooseExtras(sec) ? ' item-pizza' : '') + '"><button class="item-btn" type="button" data-item="' + esc(it.id) + '">' +
      '<span class="item-main">' +
      '<span class="item-name">' + hl(it.name) + (it.frozen ? '<span class="frz" title="' + esc(DATA.info.frozenLegend) + '">*</span>' : '') + '</span>' +
      (it.desc ? '<span class="item-desc">' + hl(it.desc) + '</span>' : '') +
      (itemVariant(it) ? '<span class="item-note item-variant">Variante disponibile: ' + esc(itemVariant(it).label) + ' <b>' + AA.price(itemVariant(it).price,{signed:true}) + '</b></span>' : it.note ? '<span class="item-note">' + esc(it.note) + '</span>' : '') +
      (meta ? '<span class="item-meta">' + meta + '</span>' : '') +
      '<span class="item-foot"><span class="item-price num">' + priceHTML(it, sec) + '</span>' + algs + '</span></span>' +
      (it.image ? '<img class="item-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">' : '') +
      '</button>' + (canChooseExtras(sec) && it.available !== false ? '<button type="button" class="item-customize" data-open-builder="' + esc(it.id) + '" aria-label="' + (sec.group === 'pizze' ? 'Personalizza ' : 'Aggiunte per ') + esc(it.name) + '"><span>' + (sec.group === 'pizze' ? 'Personalizza' : 'Scegli le aggiunte') + '</span><span aria-hidden="true">+</span></button>' : '') + '</li>';
  }
  function cardsHTML(items, sec) {
    return '<div class="cards">' + items.map(function (it) {
      return '<button class="card" type="button" data-item="' + esc(it.id) + '">' +
        (it.image ? '<img class="card-ph" loading="lazy" alt="" src="' + esc(AA.src(it.image)) + '">' : '<span class="card-ph ph-empty">' + AA.archSVG() + '</span>') +
        '<span class="card-name" style="display:block">' + hl(doughName(it.name)) + '</span>' +
        '<span class="card-price" style="display:block">' + priceHTML(it, sec) + '</span>' + algsHTML(it) + '</button>';
    }).join('') + '</div>';
  }
  function extraAllergenText(it) {
    var nums = AA.allergenNums(it.allergens).map(function (a) { return a.n; });
    return nums.length ? 'Allergeni ' + nums.join(' · ') + (needsAllergenReview(it) ? ' · da verificare' : '') : needsAllergenReview(it) ? 'Allergeni da verificare' : 'Nessun allergene dichiarato';
  }
  function extraListButton(it, showPrice) {
    return '<li class="extra-entry" data-extra-search="' + esc(norm(it.name)) + '"><button type="button" data-item="' + esc(it.id) + '" class="extra-entry-btn"><span><strong>' + hl(it.name) + '</strong><small>' + esc(extraAllergenText(it)) + '</small></span><span class="extra-entry-price num">' + (showPrice ? AA.price(it.price, {signed:true}) : '') + '<span aria-hidden="true">›</span></span></button></li>';
  }
  function chipsHTML(items) {
    var plant = items.filter(plantAlternative).sort(extraOrder), by = {};
    items.filter(function (it) { return !plantAlternative(it); }).forEach(function (it) { var k = String(it.price); (by[k] = by[k] || []).push(it); });
    var html = '<div class="extra-catalog"><label class="extra-find"><span class="sr-only">Cerca nelle aggiunte</span><input type="search" id="extraFind" placeholder="Cerca un’aggiunta…" autocomplete="off"></label><p id="extraNone" class="extra-empty" hidden>Nessuna aggiunta trovata.</p>';
    if (plant.length) html += '<section class="extra-catalog-group extra-plants"><h4>Alternative vegetali</h4><p class="extra-group-note">Verificare etichetta e possibili tracce con il personale.</p><ul>' + plant.map(function (it) { return extraListButton(it, true); }).join('') + '</ul></section>';
    html += Object.keys(by).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) {
      return '<section class="extra-catalog-group"><h4 class="num">' + AA.price(Number(k), {signed:true}) + '</h4><ul>' + by[k].slice().sort(extraOrder).map(function (it) { return extraListButton(it, false); }).join('') + '</ul></section>';
    }).join('');
    return html + '</div>';
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
  /* Comparti: chiusi all'inizio, si aprono e si chiudono toccando il titolo */
  function sectionHTML(sec, showSupp, accordion) {
    var items = sec.items.filter(matches);
    if (!items.length) return '';
    var extra = (sec.note && !filtering() ? '<p class="sec-note">' + esc(sec.note) + '</p>' : '') + (showSupp && !filtering() ? suppHTML(sec) : '');
    if (!accordion) {
      return '<section class="sec" id="' + esc(sec.id) + '"><div class="sec-h"><h3 class="sec-t">' + esc(sec.name) + '</h3>' +
        (sec.subtitle ? '<p class="sec-sub">' + esc(sec.subtitle) + '</p>' : '') + '</div>' + extra + sectionBody(sec, items) + '</section>';
    }
    var open = filtering() || !!OPEN[sec.id];
    var ph = items.filter(function (it) { return it.cutout; })[0] || items.filter(function (it) { return it.image; })[0];
    return '<section class="sec acc' + (open ? ' open' : '') + '" id="' + esc(sec.id) + '">' +
      '<button type="button" class="acc-h" data-acc="' + esc(sec.id) + '" aria-expanded="' + open + '" aria-controls="' + esc(sec.id) + '-b">' +
      (ph ? '<span class="acc-ph' + (ph.cutout ? ' cut' : '') + '"><img alt="" loading="lazy" src="' + esc(AA.src(ph.cutout || ph.image)) + '"></span>' : '<span class="acc-ph ph-empty">' + AA.archSVG() + '</span>') +
      '<span class="acc-tx"><b>' + esc(sec.name) + '</b>' + (sec.subtitle ? '<small>' + esc(sec.subtitle) + '</small>' : '') + '</span>' +
      '<span class="acc-ch">' + CHEV + '</span></button>' +
      '<div class="acc-b" id="' + esc(sec.id) + '-b"><div class="acc-in"' + (open ? '' : ' inert') + '>' + extra + sectionBody(sec, items) + '</div></div></section>';
  }

  /* Varianti: quelle comuni a tutto il gruppo si dicono una volta in cima; le altre stanno nella scheda del piatto */
  function commonSupp(secs) {
    var withS = secs.filter(function (s) { return (s.supplements || []).length; });
    if (withS.length < 2) return [];
    var key = function (x) { return x.label + '|' + x.price; };
    return withS[0].supplements.filter(function (x) { return withS.every(function (s) { return s.supplements.some(function (y) { return key(y) === key(x); }); }); });
  }
  function shortSec(n) {
    var t = String(n).replace(/^(Birre artigianali|Le nostre|I nostri|Pizze|Le|I|Gli)\s+/i, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /* Gli impasti: una scelta dentro le pizze, non una portata */
  function doughName(n) {
    var t = String(n).replace(/^Impasto\s+/i, '').replace(/\s+da noi prodotto$/i, '').replace(/\s+100% bio$/i, '').replace(/ integrale 100% Bio$/i, ' integrale');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function doughPh(it) {
    return it.image ? '<img alt="" loading="lazy" src="' + esc(AA.src(it.image)) + '">' : AA.archSVG();
  }
  function doughStrip() {
    var d = doughSection(); if (!d) return '';
    var its = d.items.filter(function (it) { return it.available !== false; });
    if (!its.length) return '';
    var w = NUMW[its.length] || its.length;
    return '<button type="button" class="dstrip" data-doughs><span class="dstrip-phs">' + its.slice(0, 5).map(function (it) { return '<i' + (it.image ? '' : ' class="dl-none"') + '>' + doughPh(it) + '</i>'; }).join('') + '</span>' +
      '<span class="dstrip-tx"><b>' + esc(w.charAt(0).toUpperCase() + w.slice(1)) + ' impasti, su ogni pizza</b><small>Dal classico al carbone vegetale: scopri quale fa per te</small></span>' + CHEV + '</button>';
  }
  function doughsHTML() {
    var d = doughSection();
    return '<div class="d-body dl"><p class="d-sec">Su ogni pizza</p><h2 class="d-name" id="sheetTitle">I nostri impasti</h2>' +
      (d.subtitle ? '<p class="d-desc">' + esc(d.subtitle) + '. Il classico è compreso nel prezzo.</p>' : '') +
      '<ul class="dlist">' + d.items.filter(function (it) { return it.available !== false; }).map(function (it) {
        var p = it.price === null || it.price === undefined || it.price === '' ? '' : (Number(it.price) === 0 ? 'Compreso' : AA.price(it.price, { signed: true }));
        return '<li><i class="dl-ph' + (it.image ? '' : ' dl-none') + '">' + doughPh(it) + '</i><div><b>' + esc(doughName(it.name)) + '</b><span>' + esc(it.desc || '') + '</span></div>' + (p ? '<em class="num">' + p + '</em>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<p class="d-note">Per scegliere l’impasto, apri la personalizzazione di una pizza nel menù.</p></div>';
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
      hasExtra ? ['g-pizze', 'Personalizza la pizza', 'Apri una pizza e scegli impasto, aggiunte e varianti.'] : null
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
      '<p class="alg-how">I numeri accanto a ogni piatto indicano gli allergeni segnalati negli ingredienti e/o possibili tracce (Reg. UE 1169/2011). Il simbolo ? indica una scheda da verificare:</p>' +
      '<ol class="alg-legend alg-top">' + AA.ALLERGENS.map(function (a) { return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>'; }).join('') + '</ol>' +
      '<button type="button" class="b-ghost alg-f" id="algFilter">Escludi un allergene dal menu</button></div></section>';
  }

  /* Indice fotografico: usa esclusivamente categorie e immagini del menu pubblicato. */
  function renderExplore() {
    var box = $('menuExplore'), result = $('menuResults'), clear = $('qClear');
    if (!box) return;
    if ($('menuIndex')) $('menuIndex').hidden = false;
    clear.hidden = !$('q').value;
    result.hidden = !filtering();
    $('promos').hidden = filtering() || !AA.activePromos(DATA, 'menu').length;
    if (filtering()) {
      var n = DATA.sections.filter(function (s) { return s.visible; }).reduce(function (sum, s) { return sum + s.items.filter(matches).length; }, 0);
      result.textContent = n === 1 ? '1 voce corrispondente' : n + ' voci corrispondenti';
      box.hidden = true; return;
    }
    var groups = groupsWithContent();
    var order = ['pizze','antipasti','impasti','cicci','piadine','primi','dessert','bevande','aggiunte'];
    groups = groups.slice().sort(function (a,b) { var x = order.indexOf(a.id), y = order.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    var arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var featured = '', rest = [];
    groups.forEach(function (g) {
      var photo = g.image || '';
      var art = photo ? '<span class="ex-photo"><img src="' + esc(AA.src(photo)) + '" alt="" loading="lazy" decoding="async"></span>' : '<span class="ex-photo ex-none">' + AA.archSVG() + '</span>';
      var title = '<span class="ex-copy"><strong>' + esc(g.name) + '</strong></span>';
      var contents = art + title + '<span class="ex-arrow">' + arrow + '</span>';
      if (g.id === 'pizze') {
        featured = '<a class="ex-card ex-feature" href="#g-pizze">' + art + '<span class="ex-copy"><strong>' + esc(g.name) + '</strong><small>Gourmet, classiche, bianche e vegan</small></span><span class="ex-arrow">' + arrow + '</span></a>';
      } else if (g.id === 'impasti') {
        rest.push('<button class="ex-card" type="button" data-ex-dough>' + contents + '</button>');
      } else {
        rest.push('<a class="ex-card" href="#g-' + esc(g.id) + '">' + contents + '</a>');
      }
    });
    box.innerHTML = '<div class="ex-alert"><p><b>Allergie o intolleranze?</b> Comunicale sempre al personale.</p><a href="#g-allergeni">Allergeni ' + arrow + '</a></div>' +
      '<div class="ex-heading"><h2 id="exploreTitle">Scegli una categoria</h2></div><div class="ex-editorial' + (featured ? '' : ' no-feature') + '">' + (featured ? '<div class="ex-special">' + featured + '</div>' : '') + '<div class="ex-grid">' + rest.join('') + '</div></div>';
    box.hidden = !groups.length;
  }

  function kioskNavigation() {
    var order = ['pizze','antipasti','impasti','cicci','piadine','primi','dessert','bevande','aggiunte'];
    var available = groupsWithContent().map(function(g){return g.id;});
    var html = '<button type="button" class="k11-nav-home" data-k11-home aria-label="Categorie iniziali"><span aria-hidden="true">⌂</span><b>Inizio</b></button>';
    order.forEach(function(id) {
      var g = DATA.groups.filter(function(g){return g.id===id;})[0]; if (!g) return;
      var label = '<span class="k11-side-photo">' + (g.image ? '<img src="' + esc(AA.src(g.image)) + '" alt="" loading="lazy">' : AA.archSVG()) + '</span><b>' + esc(g.name) + '</b>';
      if (id === 'impasti' && !filtering()) html += '<button type="button" data-k11-dough>' + label + '</button>';
      else if (available.indexOf(id) >= 0) html += '<a href="#g-' + esc(id) + '" data-g="' + esc(id) + '">' + label + '</a>';
      else html += '<button type="button" disabled>' + label + '</button>';
    });
    return html + '<button type="button" data-k11-allergens><span class="k11-side-photo k11-side-icon" aria-hidden="true">i</span><b>Allergeni</b></button>';
  }
  function applyBrowse() {
    var search = filtering(), home = !search && !browseGroup;
    document.body.dataset.menuView = search ? 'search' : home ? 'index' : 'category';
    $('menuExplore').hidden = !home || !$('menuExplore').childElementCount;
    $('promos').hidden = !home || !AA.activePromos(DATA, 'menu').length;
    $('gnav').hidden = !kioskV11 && (home || !$('gnavIn').childElementCount);
    if (kioskV11) {
      $('gnavSub').hidden = home;
      var homeBtn = $('gnavIn').querySelector('[data-k11-home]'); if (homeBtn) homeBtn.setAttribute('aria-current',home ? 'true' : 'false');
      if (home) spySet(null);
    }
    $('contenuto').hidden = home;
    $('contenuto').querySelectorAll('.grp').forEach(function(g) { g.hidden = !search && !home && g.id !== 'g-' + browseGroup; });
    if ($('menuIndex')) $('menuIndex').hidden = home;
    if (browseGroup && !search) { spySet(browseGroup); renderSub(browseGroup); }
  }
  function goIndex() {
    browseGroup = null; state.q = ''; state.tags = []; state.noAllergens = [];
    $('q').value = ''; dropHash(); updateFilterUI(); render();
    try { history.replaceState(null, '', location.pathname + location.search); } catch(e) {}
    window.scrollTo({top:0,behavior:'auto'});
  }
  function chooseGroup(id) {
    browseGroup = id; applyBrowse();
    if (!filtering()) { spySet(id); renderSub(id); }
  }

  var SUBS = {};   // per ogni gruppo: le sue sottocategorie (seconda fila della barra)
  function render() {
    var html = filtering() ? '' : allergensHTML(), nav = filtering() ? '' : '<a href="#g-allergeni" data-g="allergeni">Allergeni</a>';
    SUBS = { allergeni: { line: 'Comunicate sempre allergie e intolleranze' } };
    groupsWithContent().forEach(function (g) {
      if (g.id === 'impasti' && !filtering()) return;
      var secs = DATA.sections.filter(function (s) { return s.group === g.id && s.visible && s.items.some(matches); });
      var common = commonSupp(secs);
      var inner = secs.map(function (s) { return sectionHTML(s, !common.length, secs.length > 1 && !kioskV11); }).join('');
      if (!inner) return;
      var top = '';
      if (g.id === 'pizze' && !filtering()) top += doughStrip();
      if (false && common.length && !filtering()) top += '<p class="gsupp"><b>Su ogni pizza</b> ' + common.map(function (x) { return esc(x.label.toLowerCase()) + ' <span class="num">' + AA.price(x.price, { signed: true }) + '</span>'; }).join(' · ') + '. Le altre varianti le trovi in “Personalizza”, nella scheda di ogni pizza.</p>';
      html += '<section class="grp" id="g-' + esc(g.id) + '"><h2 class="grp-t">' + esc(g.name) + '</h2>' + top + inner + (g.id === 'pizze' && !filtering() ? builderCTA() : '') + '</section>';
      nav += '<a href="#g-' + esc(g.id) + '" data-g="' + esc(g.id) + '">' + esc(g.name) + '</a>';
      SUBS[g.id] = kioskV11 && secs.length > 1 ? { secs: secs.map(function (s) { return [s.id, shortSec(s.name)]; }) } : { line: (secs[0] && secs[0].subtitle) || '' };
    });
    var hasDishes = html.indexOf('class="grp" id="g-') >= 0;
    $('contenuto').innerHTML = hasDishes || (!filtering() && browseGroup === 'allergeni') ? html : '<p class="empty">Nessun piatto corrisponde. Prova con un\'altra parola o azzera i filtri.</p>';
    $('gnavIn').innerHTML = kioskV11 ? kioskNavigation() : nav;
    var af = $('algFilter'); if (af) af.onclick = function () { $('filterBtn').click(); };
    $('gnavF').innerHTML = filterChip();
    $('gnavF').hidden = !nFilters();
    $('gnav').classList.toggle('has-f', nFilters() > 0);
    $('gnav').hidden = !kioskV11 && !nav;
    subCur = null; subGrp = null;
    renderExplore(); applyBrowse(); spy(); reveal();
  }
  /* Seconda fila: le sottocategorie del gruppo che stai guardando */
  var subGrp = null, subCur = null;
  function renderSub(gid) {
    if (gid === subGrp) return;
    subGrp = gid; subCur = null;
    var d = SUBS[gid] || {}, box = $('gnavSub');
    box.innerHTML = d.secs ? d.secs.map(function (x) { return '<a href="#' + esc(x[0]) + '" data-jump data-s="' + esc(x[0]) + '">' + esc(x[1]) + '</a>'; }).join('') : '<span class="gs-line">' + esc(d.line || '') + '</span>';
    box.scrollLeft = 0;
  }
  function setSub(sid) {
    if (sid === subCur) return;
    subCur = sid;
    var box = $('gnavSub'), a = null;
    box.querySelectorAll('a').forEach(function (x) { var on = x.dataset.s === sid; x.setAttribute('aria-current', on ? 'true' : 'false'); if (on) a = x; });
    if (a) box.scrollTo({ left: a.offsetLeft - 14, behavior: 'smooth' });
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
  function spyLine() { if (kioskV11) return $('top').offsetHeight + ($('gnavSub').hidden ? 0 : $('gnavSub').offsetHeight) + 12; var n = $('gnav'); return (n && !n.hidden ? n.getBoundingClientRect().bottom : 70) + 16; }
  function spySet(id) {
    if (id === spyCur) return;
    spyCur = id;
    var nav = $('gnavIn'), a = null;
    nav.querySelectorAll('a').forEach(function (x) { var on = x.dataset.g === id; x.setAttribute('aria-current', on ? 'true' : 'false'); if (on) a = x; });
    if (a && !kioskV11) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
  }
  function spyCalc() {
    spyRaf = 0;
    if (spyLock) return;
    if ($('contenuto').hidden) return;
    if (!filtering() && browseGroup) { spySet(browseGroup); renderSub(browseGroup); if (!kioskV11) return; }
    var grps = document.querySelectorAll('#contenuto .grp:not([hidden])'); if (!grps.length) return;
    var line = spyLine(), id = grps[0].id.slice(2);
    grps.forEach(function (g) { if (g.getBoundingClientRect().top <= line) id = g.id.slice(2); });
    // in fondo alla pagina le ultime categorie non arrivano sotto la barra: vale l'ultima visibile
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      var last = grps[grps.length - 1]; if (last.getBoundingClientRect().top < window.innerHeight * .6) id = last.id.slice(2);
    }
    spySet(id);
    renderSub(id);
    var g = document.getElementById('g-' + id), sid = null;
    if (g) g.querySelectorAll('.sec').forEach(function (x) { if (x.getBoundingClientRect().top <= line + 30) sid = x.id; });
    if (!sid && g) { var f = g.querySelector('.sec'); sid = f && f.id; }
    setSub(sid);
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
        var a = e.target.closest('a[href^="#g-"], a[data-jump]'); if (!a) return;
        var el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
        e.preventDefault();
        var grp = el.classList.contains('grp') ? el : el.closest('.grp'), id = grp ? grp.id.slice(2) : '';
        if (id && !filtering()) chooseGroup(id);
        spySet(id); renderSub(id); var fs = el.classList.contains('grp') ? el.querySelector('.sec') : el; if (fs) setSub(fs.id); spyLock = id;
        clearTimeout(spyLockT); spyLockT = setTimeout(function () { spyLock = null; spyCalc(); }, 1200);
        // la barra a fine corsa sta ferma in alto: conta la sua posizione finale, non quella di adesso
        var n = $('gnav'), z = n && n.offsetHeight ? n.getBoundingClientRect().height / n.offsetHeight : 1; // sul totem la pagina è ingrandita
        var stuck = kioskV11 ? $('top').offsetHeight + ($('gnavSub').hidden ? 0 : $('gnavSub').offsetHeight) : n && !n.hidden ? ((parseFloat(getComputedStyle(n).top) || 0) + n.offsetHeight) * z : 70;
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
    if (kioskV11 && el.id === 'sheet' && $('k11DetailPrice')) updateKioskDetailTotal();
    el.hidden = false; document.body.style.overflow = 'hidden';
    el.querySelector('.sheet-card').scrollTop = 0;
    el.querySelector('.sheet-card').focus({preventScroll:true});
  }
  function closeSheet(el) {
    el.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.isConnected) lastFocus.focus(kioskV11 ? {preventScroll:true} : undefined);
    if (el.id === 'builder' && location.hash === '#crea') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  }

  function kioskDetailChoice(it,sec) {
    if (!kioskV11 || !kioskSelectable(sec)) return '';
    var formats = it.prices || [], supp = canChooseExtras(sec) ? [] : (sec.supplements || []).slice(), own = itemVariant(it);
    if (own && !supp.some(function(s){return s.label===own.label;})) supp.push(own);
    var h = '<section class="k11-detail-actions" data-k11-detail="' + esc(it.id) + '"><h3>Scegli e aggiungi alla selezione</h3>';
    if (formats.length) h += '<fieldset class="k11-choice"><legend>Formato</legend>' + formats.map(function(p,i){return '<label><input type="radio" name="k11fmt" value="' + i + '"' + (i===0?' checked':'') + '><span>' + esc(p.label) + '</span><b class="num">' + (p.price==null || p.price===''?'Da confermare':AA.price(p.price)) + '</b></label>';}).join('') + '</fieldset>';
    if (supp.length) h += '<fieldset class="k11-choice"><legend>Varianti facoltative</legend>' + supp.map(function(s,i){return '<label><input type="checkbox" name="k11variant" value="' + i + '"><span>' + esc(s.label) + '</span><b class="num">' + deltaLabel(s.price) + '</b></label>';}).join('') + '</fieldset>';
    return h + '<div class="k11-detail-total"><span>Prezzo selezionato</span><strong id="k11DetailPrice" aria-live="polite">—</strong></div><button type="button" class="b-fire k11-detail-add" data-k11-add-detail>Aggiungi alla selezione <span aria-hidden="true">+</span></button><p class="d-note">Per allergie o intolleranze confermate sempre ingredienti e possibili tracce con il personale.</p></section>';
  }
  function kioskDetailLine() {
    var box = $('sheet').querySelector('[data-k11-detail]'); if (!box) return null;
    var f = findItem(box.dataset.k11Detail); if (!f || f.item.available===false) return null;
    var it = f.item, sec=f.sec, raw=it.price, details=[], fmt=box.querySelector('[name="k11fmt"]:checked');
    if (fmt && it.prices && it.prices[Number(fmt.value)]) {var p=it.prices[Number(fmt.value)]; raw=p.price; details.push(p.label);}
    var unknown = raw==null || raw==='' || !Number.isFinite(Number(raw)), total=unknown?0:Number(raw);
    var supp=canChooseExtras(sec)?[]:(sec.supplements || []).slice(), own=itemVariant(it);
    if (own && !supp.some(function(s){return s.label===own.label;})) supp.push(own);
    box.querySelectorAll('[name="k11variant"]:checked').forEach(function(el){var s=supp[Number(el.value)];if(!s)return;var ok=s.price!=null&&s.price!==''&&Number.isFinite(Number(s.price));if(ok)total+=Number(s.price);else unknown=true;details.push(s.label+(ok?' ('+deltaLabel(s.price)+')':' (da confermare)'));});
    return {id:it.id,name:it.name,image:it.image||'',unit:Math.max(0,Math.round(total*100)/100),unknown:unknown,details:details,allergens:AA.allergenNums(it.allergens).map(function(a){return a.label;}),review:needsAllergenReview(it)||box.querySelectorAll('[name="k11variant"]:checked').length>0};
  }
  function updateKioskDetailTotal() {
    var line = kioskDetailLine(), el=$('k11DetailPrice'); if (line && el) el.textContent = AA.price(line.unit)+(line.unknown?' + da confermare':'');
  }
  function detailHTML(it, sec) {
    var price = priceHTML(it, sec);
    if (/class="tbc"/.test(price)) price = '<span class="d-tbc">Prezzo: chiedi al personale</span>';
    var algs = AA.allergenNums(it.allergens);
    return (it.image ? '<img class="d-ph" alt="" onload="if(this.naturalWidth<400)this.classList.add(\'lowres\')" src="' + esc(AA.src(it.image)) + '">' : '') +
      '<div class="d-body"><p class="d-sec">' + esc(sec.name) + '</p>' +
      '<h2 class="d-name" id="sheetTitle">' + esc(it.name) + (it.frozen ? '<span class="frz">*</span>' : '') + '</h2>' +
      '<div class="d-price num">' + price + '</div>' +
      (it.desc ? '<p class="d-desc">' + esc(it.desc) + '</p>' : '') +
      (it.note && !itemVariant(it) ? '<p class="item-note">' + esc(it.note) + '</p>' : '') +
      (itemVariant(it) ? '<h3 class="d-h">Varianti</h3>' + suppHTML({supplements:[itemVariant(it)]}) : '') +
      (it.tags && it.tags.length ? '<div class="item-meta">' + tagsHTML(it.tags) + '</div>' : '') +
      (algs.length ? '<h3 class="d-h">Allergeni indicati e/o possibili tracce</h3><ul class="d-algs">' + algs.map(function (a) {
        return '<li><span class="alg">' + a.n + '</span>' + esc(a.label) + '</li>';
      }).join('') + '</ul>' : (!needsAllergenReview(it) ? '<p class="d-note">Nessun allergene dichiarato nella scheda; verificare le eventuali tracce.</p>' : '')) +
      (needsAllergenReview(it) ? '<p class="d-note"><b>Allergeni da verificare:</b> scheda incompleta. Confermate ingredienti, etichette e possibili tracce con il personale prima di ordinare.</p>' : '') +
      (it.frozen ? '<p class="d-note">* ' + esc(DATA.info.frozenLegend) + '</p>' : '') +
      (sec.group === 'pizze' ? '<button type="button" class="b-fire d-custom" data-open-builder="' + esc(it.id) + '">Personalizza questa pizza <span aria-hidden="true">✦</span></button>'
        : (sec.group === 'cicci' ? '<button type="button" class="b-fire d-custom" data-open-builder="' + esc(it.id) + '">Scegli le aggiunte <span aria-hidden="true">+</span></button>' : ((sec.supplements || []).length ? '<h3 class="d-h">Varianti</h3>' + suppHTML(sec) : ''))) +
      kioskDetailChoice(it,sec) + '</div>';
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
  function tomatoBase(item) {
    return recipeOf(item).filter(function (r) { return norm(r) === 'pomodoro'; })[0] || null;
  }
  function builderOptions(sec, item) {
    if (sec.group !== 'pizze') return {base:[],mods:[]};
    var base = [], mods = [], red = !!tomatoBase(item);
    var dsec = doughSection();
    var gfDough = dsec && dsec.items.some(function (d) { return /senza glutine/i.test(d.name) && d.available !== false; });
    var sections = pizzaSections(), supplements = sec.supplements || [];
    function configured(label, preferSection) {
      var own = supplements.filter(function (sp) { return norm(sp.label) === norm(label); })[0];
      if (own && !preferSection) return own;
      var chosen = sections.filter(function (s) { return s.id === preferSection; })[0];
      return (chosen && (chosen.supplements || []).filter(function (sp) { return norm(sp.label) === norm(label); })[0]) || own ||
        sections.reduce(function (a, s) { return a || (s.supplements || []).filter(function (sp) { return norm(sp.label) === norm(label); })[0]; }, null);
    }
    function addBase(id, label, preferSection) {
      var sp = configured(label, preferSection);
      if (sp) base.push({ id: id, label: sp.label, price: Number(sp.price) || 0 });
    }
    if (red) { addBase('base-white', 'Base bianca'); addBase('base-double', 'Doppio pomodoro', sec.id === 's50' ? 's49' : null); }
    else { addBase('base-red', 'Base pomodoro', 's50'); addBase('base-double', 'Doppio pomodoro', 's50'); }
    supplements.forEach(function (sp, i) {
      if (gfDough && /senza glutine/i.test(sp.label)) return;
      if (/^base\s|doppio pomodoro/i.test(sp.label)) return;
      mods.push({ id: 'o' + i, label: sp.label, price: Number(sp.price) || 0 });
    });
    return { base: base, mods: mods };
  }
  function setBase(value) {
    B.baseOpt = value || null;
    var tomato = tomatoBase(B.start.item);
    if (!tomato) return;
    B.removed = B.removed.filter(function (r) { return r !== tomato; });
    if (B.baseOpt === 'base-white') B.removed.push(tomato);
  }
  function knownPrice(it) {
    var p = it.prices && it.prices.length ? it.prices[0].price : it.price;
    return p !== null && p !== undefined && p !== '' && Number.isFinite(Number(p));
  }
  function bCfg() { return (DATA.settings && DATA.settings.builder) || {}; }
  function openBuilder(itemId) {
    var secs = pizzaSections();
    var starts = [];
    if (itemId) { var f = findItem(itemId); if (f && canChooseExtras(f.sec) && f.item.available !== false) starts.push(f); else return; }
    if (!starts.length) ['Margherita', 'Marinara'].forEach(function (n) {
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
    var extrasOnly = starts[0].sec.group !== 'pizze';
    var doughs = !extrasOnly && dsec ? AA.visibleItems(dsec) : [];
    var defDough = doughs.filter(function (d) { return knownPrice(d) && Number(d.price) === 0; })[0] || doughs[0] || null;
    B = { extrasOnly: extrasOnly, from: itemId ? starts[0] : null, starts: starts, start: starts[0], doughs: doughs, dough: defDough, baseOpt: null, mods: [], extras: extras, sel: [], removed: [], presets: presets, popular: popular, q: '', picking: false };
    renderBuilder();
    openSheet($('builder'));
    $('bBody').scrollTop = 0;
    // Keep the category URL and scroll position when the editor is opened.
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
  function extraChip(it, detail) {
    var on = B.sel.indexOf(it.id) >= 0;
    return '<button type="button" class="bchip b-extra-choice' + (detail ? ' b-extra-plant' : '') + '" data-b="extra" data-v="' + esc(it.id) + '" aria-pressed="' + on + '"><span><b>' + esc(it.name) + '</b>' + (detail ? '<small>' + esc(extraAllergenText(it)) + '</small>' : '') + '</span><em class="num">' + deltaLabel(it.price) + '</em></button>';
  }
  function extraPicker(n) {
    var veg = veganRecipe(B.start.item,B.start.sec), plant = B.extras.filter(plantAlternative).sort(extraOrder);
    var popular = veg ? [] : B.popular.filter(function (it) { return !plantAlternative(it); });
    var rest = B.extras.filter(function (it) { return !plantAlternative(it) && !popular.some(function (p) { return p.id === it.id; }); });
    var h = '<section class="b-step"><h3><b>' + n + '</b>Aggiunte</h3><div id="bMine"></div><label class="b-search b-search-all"><span class="sr-only">Cerca un ingrediente</span><input type="search" id="bQ" placeholder="Cerca un’aggiunta" autocomplete="off"></label><div id="bPicker">';
    if (plant.length) h += '<div class="b-alt-panel" data-extra-group><h4>Alternative vegetali</h4><p class="b-sub">Scegli tra i prodotti indicati nel listino. Conferma la confezione, le tracce e l’idoneità al personale.</p><div class="bchips">' + plant.map(function (it) { return extraChip(it,true); }).join('') + '</div></div>';
    if (popular.length) h += '<div class="b-grp" data-extra-group><h4>I più scelti</h4><div class="bchips">' + popular.map(function(it) { return extraChip(it,false); }).join('') + '</div></div>';
    h += '<button type="button" class="b-allt" id="bAllT" aria-expanded="false" aria-controls="bAll">' + (veg ? 'Altre aggiunte (non tutte vegetali)' : 'Altre aggiunte') + CHEV + '</button><div id="bAll" hidden>';
    var by = {};
    rest.forEach(function(it) { var k = String(unitPrice(it)); (by[k] = by[k] || []).push(it); });
    Object.keys(by).sort(function(a,b) {return Number(a)-Number(b);}).forEach(function(k) {
      h += '<div class="b-grp" data-extra-group><h4 class="num">' + AA.price(Number(k),{signed:true}) + '</h4><div class="bchips">' + by[k].sort(extraOrder).map(function(it){return extraChip(it,false);}).join('') + '</div></div>';
    });
    return h + '</div><p class="b-sub" id="bNoExtras" hidden>Nessuna aggiunta trovata.</p></div></section>';
  }
  function renderBuilder() {
    var opt = builderOptions(B.start.sec, B.start.item);
    var h = '<div class="b-head"><p class="b-k">' + (B.extrasOnly ? 'Scegli le aggiunte' : B.from ? 'Personalizza la tua pizza' : 'Crea la tua pizza') + '<button type="button" class="b-reset" data-b="reset">Ricomincia</button></p>' +
      '<div class="b-hero">' + (B.start.item.image ? '<img src="' + esc(AA.src(B.start.item.image)) + '" alt="" decoding="async">' : '') +
      '<div><h2 class="b-t" id="bTitle">' + esc(B.start.item.name) + '</h2><p>Prezzo di partenza <b class="num">' + (knownPrice(B.start.item) ? AA.price(unitPrice(B.start.item)) : 'da confermare') + '</b></p></div></div>' +
      '<p class="b-caution">Per allergie o intolleranze, conferma sempre le modifiche con il personale. Il configuratore non garantisce l’assenza di allergeni.</p></div>';
    var n = 1;
    if (!B.extrasOnly) {
    var rec = recipeOf(B.start.item);
    h += '<section class="b-step"><h3><b>1</b>Ingredienti della ricetta</h3>';
    if (!B.from) h += '<div class="bchips b-starts">' + B.starts.map(function (st) {
      return chip('start', st.item.id, st.item.name, AA.price(unitPrice(st.item)), st.item.id === B.start.item.id);
    }).join('') + '<button type="button" class="bchip b-other" data-b="pick" aria-expanded="' + (B.picking ? 'true' : 'false') + '">Un’altra pizza</button></div>' +
      '<div class="b-pick" id="bPick"' + (B.picking ? '' : ' hidden') + '><label class="b-search"><span class="sr-only">Cerca una pizza</span><input type="search" id="bPickQ" placeholder="Cerca una pizza" autocomplete="off"></label><div class="b-pks" id="bPickList">' + (B.picking ? pickList('') : '') + '</div></div>';
    if (rec.length) {
      h += '<p class="b-sub">Tocca − per togliere, + per rimettere. Le rimozioni non cambiano il prezzo, tranne il pomodoro della base.</p><div class="b-recipe" id="bRec">' + rec.map(function (r) {
        var off = B.removed.indexOf(r) >= 0, tomato = r === tomatoBase(B.start.item), white = opt.base.filter(function (o) { return o.id === 'base-white'; })[0];
        return '<button type="button" class="bchip b-rec' + (off ? ' off' : '') + '" data-b="rm" data-v="' + esc(r) + '" aria-pressed="' + (off ? 'false' : 'true') + '" aria-label="' + esc(cap(r)) + (off ? ', tolto: tocca per rimetterlo' : ', tocca per toglierlo') + '"><span class="b-rec-label"><b>' + esc(cap(r)) + '</b><small>' + (tomato && white ? 'Base: ' + AA.price(white.price, { signed: true }) + ' se tolto' : 'Compreso nella ricetta') + '</small></span><span class="b-rec-icon" aria-hidden="true">' + (off ? '+' : '−') + '</span></button>';
      }).join('') + '</div>';
    }
    h += '</section>';
    if (B.doughs.length) {
      h += '<section class="b-step"><h3><b>2</b>L’impasto</h3><div class="bchips">' + B.doughs.map(function (d) {
        return chip('dough', d.id, doughName(d.name), deltaLabel(d.price), B.dough && d.id === B.dough.id);
      }).join('') + '</div></section>';
    }
    if (opt.base.length) {
      h += '<section class="b-step"><h3><b>3</b>La base</h3><div class="bchips">' + chip('base', '', 'Come da ricetta', 'Compreso', !B.baseOpt) + opt.base.map(function (o) {
        return chip('base', o.id, o.label, deltaLabel(o.price), B.baseOpt === o.id);
      }).join('') + '</div></section>';
    }
    if (opt.mods.length) {
      h += '<section class="b-step"><h3><b>' + (opt.base.length ? 4 : 3) + '</b>Formato e intolleranze</h3><div class="bchips">' + opt.mods.map(function (o) {
        return chip('mod', o.id, o.label, deltaLabel(o.price), B.mods.indexOf(o.id) >= 0);
      }).join('') + '</div></section>';
    }
    n = 2 + (B.doughs.length ? 1 : 0) + (opt.base.length ? 1 : 0) + (opt.mods.length ? 1 : 0);
    }
    h += extraPicker(n) + '<section class="b-step b-summary" aria-labelledby="bSummaryTitle"><h3 id="bSummaryTitle"><b>' + (n + 1) + '</b>Riepilogo prezzo</h3><div id="bCosts"></div></section>';
    $('bBody').innerHTML = h;
    if ($('bPickQ')) $('bPickQ').addEventListener('input', function (e) { $('bPickList').innerHTML = pickList(e.target.value.trim()); });
    if (B.picking) setTimeout(function () { var q = $('bPickQ'); if (q) q.focus({ preventScroll: true }); }, 50);
    $('bAllT').addEventListener('click', function () {
      var open = $('bAll').hidden; $('bAll').hidden = !open; this.setAttribute('aria-expanded', open);
    });
    $('bQ').addEventListener('input', function (e) {
      var q = norm(e.target.value.trim());
      if (q && $('bAll').hidden) { $('bAll').hidden = false; $('bAllT').setAttribute('aria-expanded', 'true'); }
      var count = 0;
      $('bPicker').querySelectorAll('[data-extra-group]').forEach(function (g) {
        var found = 0;
        g.querySelectorAll('[data-b="extra"]').forEach(function (b) {
          b.hidden = !!q && norm(b.textContent).indexOf(q) < 0;
          if (!b.hidden) found++;
        });
        g.hidden = !found; count += found;
      });
      $('bNoExtras').hidden = !q || !!count;
    });
    updateBuilder();
  }
  function builderState() {
    var opt = builderOptions(B.start.sec, B.start.item);
    B.tbc = !knownPrice(B.start.item);
    var lines = [[B.extrasOnly ? 'Piatto' : 'Pizza', B.start.item.name, knownPrice(B.start.item) ? unitPrice(B.start.item) : null]];
    var total = unitPrice(B.start.item), algs = (B.start.item.allergens || []).slice();
    if (B.dough) {
      var dp = knownPrice(B.dough) ? unitPrice(B.dough) : null;
      if (dp === null) B.tbc = true; else total += dp;
      lines.push(['Impasto', doughName(B.dough.name), dp]);
      (B.dough.allergens || []).forEach(function (a) { algs.push(a); });
    }
    var bo = opt.base.filter(function (o) { return o.id === B.baseOpt; })[0];
    if (bo) { total += bo.price; lines.push(['Base', bo.label, bo.price]); }
    opt.mods.forEach(function (o) { if (B.mods.indexOf(o.id) >= 0) { total += o.price; lines.push(['Variante', o.label, o.price]); } });
    var ing = B.sel.map(function (id) { return B.extras.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    ing.forEach(function (it) {
      var p = knownPrice(it) ? unitPrice(it) : null;
      if (p === null) B.tbc = true; else total += p;
      lines.push(['Aggiunta', it.name, p]);
      (it.allergens || []).forEach(function (a) { algs.push(a); });
    });
    var rec = recipeOf(B.start.item), rem = B.removed.filter(function (r) { return rec.indexOf(r) >= 0; });
    return { total: Math.max(0, Math.round(total * 100) / 100), lines: lines, ing: ing, rem: rem, algs: algs.filter(function (a, i) { return algs.indexOf(a) === i; }) };
  }
  function priceLine(l, i) {
    return l[2] === null ? 'Da confermare' : i === 0 ? AA.price(l[2]) : deltaLabel(l[2]);
  }
  function syncBuilderButtons() {
    var body = $('bBody');
    body.querySelectorAll('[data-b="dough"]').forEach(function (x) { x.setAttribute('aria-pressed', !!B.dough && x.dataset.v === B.dough.id); });
    body.querySelectorAll('[data-b="base"]').forEach(function (x) { x.setAttribute('aria-pressed', (x.dataset.v || null) === B.baseOpt); });
    body.querySelectorAll('[data-b="mod"]').forEach(function (x) { x.setAttribute('aria-pressed', B.mods.indexOf(x.dataset.v) >= 0); });
    body.querySelectorAll('[data-b="extra"]').forEach(function (x) { x.setAttribute('aria-pressed', B.sel.indexOf(x.dataset.v) >= 0); });
    body.querySelectorAll('[data-b="rm"]').forEach(function (x) {
      var off = B.removed.indexOf(x.dataset.v) >= 0;
      x.classList.toggle('off', off); x.setAttribute('aria-pressed', !off);
      x.setAttribute('aria-label', cap(x.dataset.v) + (off ? ', tolto: tocca per rimetterlo' : ', tocca per toglierlo'));
      x.querySelector('.b-rec-icon').textContent = off ? '+' : '−';
    });
  }
  function updateBuilder() {
    var st = builderState();
    var parts = [];
    if (st.rem.length) parts.push('senza ' + st.rem.join(', '));
    if (st.ing.length) parts.push('+ ' + st.ing.map(function (i) { return i.name.toLowerCase(); }).join(', '));
    var foot = $('bFoot'), previousTotal = foot.dataset.total;
    foot.dataset.total = String(st.total) + (B.tbc ? '?' : '');
    var costs = $('bCosts');
    if (costs) costs.innerHTML = '<dl class="b-cost-lines">' + st.lines.map(function (l, i) {
      return '<div><dt><small>' + esc(l[0]) + '</small>' + esc(l[1]) + '</dt><dd class="num">' + esc(priceLine(l, i)) + '</dd></div>';
    }).join('') + (st.rem.length ? '<div><dt><small>Da togliere</small>' + esc(cap(st.rem.join(', '))) + '</dt><dd>—</dd></div>' : '') + '</dl><p class="b-cost-total"><b>' + (B.tbc ? 'Parziale noto' : (B.extrasOnly ? 'Totale piatto' : 'Totale pizza')) + '</b><strong class="num">' + AA.price(st.total) + (B.tbc ? ' + da confermare' : '') + '</strong></p>';
    if (costs && st.ing.some(needsAllergenReview)) costs.insertAdjacentHTML('beforeend','<p class="b-caution">Da verificare con il personale: ' + esc(st.ing.filter(needsAllergenReview).map(function(it){return it.name;}).join(', ')) + '.</p>');
    foot.innerHTML = '<div class="bf-l"><p class="bf-k">' + (B.tbc ? 'Parziale noto + supplementi da confermare' : (B.extrasOnly ? 'Totale piatto' : 'Totale pizza')) + '</p><p class="bf-p num" aria-live="polite">' + AA.price(st.total) + (B.tbc ? '<small> +?</small>' : '') + '</p>' +
      (parts.length ? '<p class="bf-s">' + esc(cap(parts.join('; '))) + '</p>' : '') + '</div>' +
      '<div class="bf-r"><button type="button" class="b-fire" data-b="' + (kioskV11 ? 'k11add' : 'waiter') + '">' + (kioskV11 ? 'Aggiungi alla selezione' : 'Mostra al cameriere') + '</button></div>';
    if (previousTotal !== undefined && previousTotal !== foot.dataset.total) {
      foot.classList.remove('bump'); void foot.offsetWidth; foot.classList.add('bump');
    }
    var mine = $('bMine');
    if (mine) mine.innerHTML = st.ing.length ? '<p class="b-sub">Aggiunti da te. Tocca per togliere</p><div class="bchips">' + st.ing.map(function (it) {
      return '<button type="button" class="bchip b-mine" data-b="extra" data-v="' + esc(it.id) + '" aria-pressed="true" aria-label="' + esc(it.name) + ', tocca per toglierlo"><span>' + esc(it.name) + '</span><em class="num">' + AA.price(unitPrice(it), { signed: true }) + '</em><i aria-hidden="true"></i></button>';
    }).join('') + '</div>' : '';
  }
  function showWaiter() {
    var st = builderState();
    var algs = AA.allergenNums(st.algs);
    $('waiter').innerHTML = '<div class="w-in"><p class="w-k">' + (B.extrasOnly ? 'Il mio piatto' : 'La mia pizza') + '</p><h2 class="w-t" id="wTitle">' + esc(B.start.item.name) + '</h2><dl class="w-l">' +
      st.lines.map(function (l, i) { return '<div><dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '<span class="w-line-price num">' + esc(priceLine(l, i)) + '</span></dd></div>'; }).join('') +
      (st.rem.length ? '<div class="w-no"><dt>Senza</dt><dd>' + esc(cap(st.rem.join(', '))) + '</dd></div>' : '') +
      '</dl><p class="w-p num">' + AA.price(st.total) + (B.tbc ? '<small>+ supplementi da confermare</small>' : '<small>' + (B.extrasOnly ? 'Totale piatto' : 'Totale pizza') + '</small>') + '</p>' +
      (algs.length ? '<p class="w-a">Allergeni indicati e/o possibili tracce ' + algs.map(function (a) { return a.n; }).join(' · ') + '</p>' : '') +
      (st.ing.filter(needsAllergenReview).length ? '<p class="w-a"><b>Aggiunte da verificare:</b> ' + esc(st.ing.filter(needsAllergenReview).map(function(it){return it.name;}).join(', ')) + '</p>' : '') +
      '<p class="w-a">Confermate allergeni e possibili tracce con il personale; le modifiche non garantiscono l’assenza di allergeni.</p>' +
      '<button type="button" class="b-fire" id="wBack">Torna a modificare</button></div>';
    $('waiter').hidden = false;
    $('wBack').onclick = function () { $('waiter').hidden = true; var f = $('bFoot').querySelector('[data-b="waiter"]'); if (f) f.focus({preventScroll:true}); };
    $('wBack').focus({ preventScroll: true });
  }
  function bindBuilder() {
    $('builder').addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      var g = b.dataset.b, v = b.dataset.v;
      if (g === 'start') { B.start = B.starts.filter(function (x) { return x.item.id === v; })[0]; B.baseOpt = null; B.mods = []; B.sel = []; B.removed = []; B.picking = false; renderBuilder(); return; }
      if (g === 'pick') { B.picking = !B.picking; renderBuilder(); return; }
      if (g === 'pickit') {
        var hit = allPizzas().filter(function (x) { return x.item.id === v; })[0];
        if (hit) {
          if (B.from) B.starts = [hit];
          else if (!B.starts.some(function (x) { return x.item.id === v; })) B.starts.unshift(hit);
          B.start = B.starts.filter(function (x) { return x.item.id === v; })[0]; B.baseOpt = null; B.mods = []; B.sel = []; B.removed = []; B.picking = false; renderBuilder();
          var t = $('bBody'); if (t) t.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      if (g === 'rm') {
        var r = B.removed.indexOf(v);
        if (v === tomatoBase(B.start.item) && builderOptions(B.start.sec, B.start.item).base.some(function (o) { return o.id === 'base-white'; })) setBase(r >= 0 ? null : 'base-white');
        else if (r >= 0) B.removed.splice(r, 1); else B.removed.push(v);
        syncBuilderButtons(); updateBuilder(); return;
      }
      if (g === 'dough') B.dough = B.doughs.filter(function (d) { return d.id === v; })[0];
      if (g === 'base') setBase(v);
      if (g === 'mod') { var k = B.mods.indexOf(v); if (k >= 0) B.mods.splice(k, 1); else B.mods.push(v); }
      if (g === 'extra') { var j = B.sel.indexOf(v); if (j >= 0) B.sel.splice(j, 1); else B.sel.push(v); }
      if (g === 'preset') { B.presets[Number(v)].ids.forEach(function (id) { if (B.sel.indexOf(id) < 0) B.sel.push(id); }); }
      if (g === 'reset') { var first = B.starts[0]; B.start = first; B.dough = B.doughs.filter(function (d) { return knownPrice(d) && Number(d.price) === 0; })[0] || B.doughs[0] || null; B.baseOpt = null; B.mods = []; B.sel = []; B.removed = []; B.picking = false; renderBuilder(); return; }
      if (g === 'k11add' && kioskV11 && window.AAKiosk11) {
        var st = builderState(), it = B.start.item, det = st.lines.slice(1).map(function(l){return (l[0]?l[0]+': ':'')+l[1]+(l[2]!==null && l[2]!==0?' ('+deltaLabel(l[2])+')':l[2]===null?' (da confermare)':'');});
        if (st.rem.length) det.push('Senza: '+st.rem.join(', '));
        var line = {id:it.id,name:it.name,image:it.image||'',unit:st.total,unknown:B.tbc,details:det,allergens:AA.allergenNums(st.algs).map(function(a){return a.label;}),review:needsAllergenReview(it)||(B.dough&&needsAllergenReview(B.dough))||st.ing.some(needsAllergenReview)||st.rem.length>0||!!B.baseOpt||B.mods.length>0};
        closeSheet($('builder')); window.AAKiosk11.add(line); return;
      }
      if (g === 'waiter') { showWaiter(); return; }
      if (g === 'close') return;
      syncBuilderButtons();
      updateBuilder();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('waiter').hidden) $('waiter').hidden = true; });
  }
  function builderCTA() {
    return '<aside class="bcta-section" aria-label="Crea una pizza da zero"><span class="bcta-k">Vuoi qualcosa di diverso?</span><button type="button" class="bcta" data-open-builder><span class="bcta-t">Crea la tua pizza</span><span class="bcta-s">Componila da una base, scegli l’impasto e gli ingredienti. Vedi il totale in tempo reale.</span><span class="bcta-i" aria-hidden="true">+</span></button></aside>';
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
    if (!n) { box.hidden = true; box.innerHTML = ''; if (apply) apply.textContent = 'Chiudi'; return; }
    var count = countMatches();
    var gf = state.tags.indexOf('senza-glutine') >= 0, onlyGf = gf && n === 1;
    var title = onlyGf ? 'Menu senza glutine' : 'Filtri attivi: ' + filterNames().join(', ');
    var text = (onlyGf ? 'Piatti senza glutine o che possiamo preparare senza glutine.' : '') + (gf ? ' Se sei celiaco, dillo quando ordini.' : '');
    box.hidden = false;
    box.innerHTML = '<div class="af-t"><b>' + esc(title) + '</b>' + (text ? '<span>' + esc(text.trim()) + '</span>' : '') + '</div>' +
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
      if (fa) { OPEN[fa.sec.id] = true; if (fa.sec.group !== 'impasti') browseGroup = fa.sec.group; }
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
        (p.price ? '<p class="promo-p num">' + esc(cleanPrice(p.price)) + '</p>' : '') + '</div></article>';
    }).join('');
    $('promos').hidden = !promos.length;
  }

  function renderFooter() {
    var i = DATA.info, f = '<div class="mf-in">';
    var isPren = function (n) { return /^prenotazion/i.test(n.title || ''); };
    var pren = (i.notes || []).filter(isPren)[0];
    f += '<div class="mf-card"><h2>Da sapere</h2><div class="mf-row">' +
      (i.coverCharge ? '<p class="mf-kv"><b>Coperto</b>' + AA.price(i.coverCharge) + '</p>' : '') +
      (i.wifi && i.wifi.network ? '<p class="mf-kv"><b>Wi‑Fi gratuito</b>' + esc(i.wifi.network) + ', password ' + esc(i.wifi.password) + '</p>' : '') +
      '<p class="mf-kv"><b>Prenotazioni</b><a href="' + AA.telHref(i.phone) + '">' + esc(i.phone) + '</a>' + (pren && pren.text ? '<small>' + esc(pren.text) + '</small>' : '') + '</p>' +
      (i.mobile ? '<p class="mf-kv"><b>Cellulare</b><a href="' + AA.telHref(i.mobile) + '">' + esc(i.mobile) + '</a></p>' : '') +
      '<p class="mf-kv"><b>Orari</b>' + (i.hours || []).map(function (h) { return esc(h.days) + ' ' + esc(h.time); }).join('<br>') + '</p></div>';
    if (i.products) f += '<details><summary>I nostri prodotti</summary><p>' + esc(i.products) + '</p></details>';
    // la nota "Prenotazioni" sta già sotto il telefono
    (i.notes || []).filter(function (n) { return !isPren(n); }).forEach(function (n) {
      f += '<details><summary>' + esc(n.title) + '</summary><p>' + esc(cleanPrice(n.text)) + '</p></details>';
    });
    if (i.frozenLegend) f += '<p class="mf-frz"><span class="frz">*</span> ' + esc(i.frozenLegend) + '</p>';
    f += '</div>';
    f += '<p class="mf-links"><a href="' + AA.ROOT + '">Scopri L\'Antico Arco</a> · <a href="' + AA.ROOT + 'privacy/">Privacy e cookie</a></p></div>';
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
    $('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 140); });
    if ($('menuIndex')) $('menuIndex').addEventListener('click', function () {
      clearTimeout(t); goIndex();
    });
    if ($('menuFind')) $('menuFind').addEventListener('click', function () {
      window.scrollTo({top: 0, behavior: 'instant'});
      $('q').focus({preventScroll: true});
    });
    $('q').addEventListener('keydown', function (e) {
      if (new URLSearchParams(location.search).has('totem') || e.key !== 'Enter') return;
      e.preventDefault(); clearTimeout(t); state.q = $('q').value.trim(); render();
      if (state.q) {
        $('q').blur();
        var nav = $('gnav'), target = nav.hidden ? $('contenuto') : nav;
        var offset = $('top').getBoundingClientRect().height;
        window.scrollTo({top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset), behavior: reduceMotion() ? 'auto' : 'smooth'});
      }
    });
    if ($('qClear')) $('qClear').addEventListener('click', function () { clearTimeout(t); $('q').value = ''; state.q = ''; render(); $('q').focus(); });
    if ($('menuExplore')) $('menuExplore').addEventListener('click', function (e) {
      if (e.target.closest('[data-ex-dough]') && doughSection()) openSheet($('sheet'), doughsHTML());
    });
    $('contenuto').addEventListener('input', function(e) {
      if (e.target.id !== 'extraFind') return;
      var q = norm(e.target.value.trim()), count = 0, box = e.target.closest('.extra-catalog');
      box.querySelectorAll('.extra-catalog-group').forEach(function(g) {
        var found = 0;
        g.querySelectorAll('[data-extra-search]').forEach(function(el) {
          el.hidden = !!q && el.dataset.extraSearch.indexOf(q) < 0; if (!el.hidden) found++;
        });
        g.hidden = !found; count += found;
      });
      $('extraNone').hidden = !!count;
    });
    if (kioskV11) $('gnav').addEventListener('click',function(e) {
      if (e.target.closest('[data-k11-home]')) goIndex();
      if (e.target.closest('[data-k11-dough]') && doughSection()) openSheet($('sheet'),doughsHTML());
      if (e.target.closest('[data-k11-allergens]')) openSheet($('sheet'),'<div class="d-body"><h2 id="sheetTitle" class="d-name">Allergeni</h2><p class="d-note">'+esc(DATA.info.allergenNote || 'Comunicate sempre allergie e intolleranze al personale.')+'</p><ul class="d-algs">'+AA.ALLERGENS.map(function(a){return '<li><span class="alg">'+a.n+'</span>'+esc(a.label)+'</li>';}).join('')+'</ul><p class="d-note">Le schede da verificare e le possibili tracce non garantiscono l’assenza di allergeni.</p></div>');
    });
    $('contenuto').addEventListener('click', function (e) {
      var m = e.target.closest('[data-acc]'); if (m) { toggleAcc(m.dataset.acc); return; }
      if (e.target.closest('[data-doughs]')) { openSheet($('sheet'), doughsHTML()); return; }
      var b = e.target.closest('[data-item]'); if (!b) return;
      var f = findItem(b.dataset.item); if (f) openSheet($('sheet'), detailHTML(f.item, f.sec));
    });
    if(kioskV11) {
      $('sheet').addEventListener('change',function(e){if(e.target.matches('[name="k11fmt"],[name="k11variant"]'))updateKioskDetailTotal();});
      $('sheet').addEventListener('click',function(e){if(!e.target.closest('[data-k11-add-detail]')||!window.AAKiosk11)return;var line=kioskDetailLine();if(line){closeSheet($('sheet'));window.AAKiosk11.add(line);}});
    }
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
    else if (tagHash.indexOf('g-') === 0) { browseGroup = tagHash.slice(2); if (!DATA.groups.some(function(g){return g.id === browseGroup;}) && browseGroup !== 'allergeni') browseGroup = null; if (browseGroup === 'impasti') browseGroup = null; }
    else if (tagHash.indexOf('piatto-') === 0) { var found = findItem(decodeURIComponent(tagHash.slice(7))); if (found && found.sec.group !== 'impasti') browseGroup = found.sec.group; }
    else { var linked = DATA.sections.filter(function(s){return s.id === tagHash && s.visible;})[0]; if (linked && linked.group !== 'impasti') { browseGroup = linked.group; OPEN[linked.id] = true; } }
    if (kioskV11) {
      // The subsection bar belongs to the content, not the fixed category sidebar.
      $('gnav').after($('gnavSub'));
      var search = $('searchbar'), holder = $('k11Search'); if (holder && search) holder.appendChild(search);
    }
    renderHeader(); render(); renderFooter(); bind(); bindBuilder();
    // un link a #senza-glutine (o a un altro filtro) mentre sei già nel menu
    window.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (!h || !AA.TAG_BY_CODE[h]) return;
      browseGroup = null;
      state.tags = [h]; state.noAllergens = [];
      renderFilters(); applyFilters();
      window.scrollTo(0, 0);
    });
    if (state.tags.length) { dropHash(); updateFilterUI(); return; }
    if (location.hash === '#crea') { openBuilder(null); return; }
    if (location.hash === '#g-impasti' && doughSection()) { dropHash(); openSheet($('sheet'), doughsHTML()); return; }
    // #piatto-i554: dal totem, apre il comparto del piatto e la sua scheda
    var pm = location.hash.match(/^#piatto-(.+)$/);
    if (pm) {
      var pf = findItem(decodeURIComponent(pm[1]));
      dropHash();
      if (pf) {
        toggleAcc(pf.sec.id, true);
        var pel = document.querySelector('#contenuto [data-item="' + pf.item.id + '"]');
        if (pel) pel.scrollIntoView({ block: 'center' });
        openSheet($('sheet'), detailHTML(pf.item, pf.sec));
      }
      return;
    }
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
