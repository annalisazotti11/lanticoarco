/* Sito: i testi statici restano per i motori di ricerca, i dati vivi arrivano dal gestionale */
(function () {
  'use strict';
  var AA = window.AA, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };

  document.querySelectorAll('[data-arch]').forEach(function (el) { el.innerHTML = AA.archSVG(); });

  /* Dissolvenza tra le foto dell'apertura */
  var imgs = document.querySelectorAll('.hero-img');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (imgs.length > 1 && !reduce) {
    var k = 0;
    setInterval(function () {
      imgs[k].classList.remove('is-on');
      k = (k + 1) % imgs.length;
      imgs[k].classList.add('is-on');
    }, 6000);
  }

  /* Mappa caricata solo su richiesta (niente cookie di Google finché non si clicca) */
  var mapBtn = $('mapBtn');
  if (mapBtn) mapBtn.addEventListener('click', function () {
    var lat = mapBtn.dataset.lat || '41.0211722', lng = mapBtn.dataset.lng || '16.9287389';
    var f = document.createElement('iframe');
    f.title = 'Mappa: Pizzeria L\'Antico Arco';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=' + lat + ',' + lng + '&z=17&output=embed';
    mapBtn.replaceWith(f);
  });

  function bind(info) {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var key = el.dataset.bind;
      var v = info[key];
      if (key === 'rating' && info.rating) v = String(info.rating.value).replace('.', ',');
      if (key === 'ratingCount' && info.rating) v = info.rating.count;
      if (v != null && v !== '') el.textContent = v;
    });
    document.querySelectorAll('[data-tel]').forEach(function (a) {
      var n = info[a.dataset.tel];
      if (n) a.href = AA.telHref(n);
    });
    document.querySelectorAll('[data-mail]').forEach(function (a) { if (info.email) a.href = 'mailto:' + info.email; });
    if (mapBtn && info.lat) { mapBtn.dataset.lat = info.lat; mapBtn.dataset.lng = info.lng; }
    if (info.hours && info.hours.length) {
      $('hours').innerHTML = info.hours.map(function (h) {
        return '<div><dt>' + esc(h.days) + '</dt><dd>' + esc(h.time) + '</dd></div>';
      }).join('');
    }
    if (info.legal) {
      var l = [];
      if (info.legal.vat) l.push('<span>P.IVA ' + esc(info.legal.vat) + '</span>');
      if (info.legal.cf) l.push('<span>C.F. ' + esc(info.legal.cf) + '</span>');
      if (info.legal.rea) l.push('<span>REA ' + esc(info.legal.rea) + '</span>');
      $('legal').innerHTML = l.join('');
    }
  }

  function renderDoughs(data) {
    var sec = data.sections.filter(function (s) { return s.layout === 'cards' && s.group === 'impasti'; })[0];
    if (!sec) return;
    $('doughList').innerHTML = AA.visibleItems(sec).map(function (it) {
      var p = it.price == null ? '' : (Number(it.price) === 0 ? 'Impasto base' : AA.price(it.price, { signed: true }));
      var d = it.desc || ''; var cut = d.indexOf('. '); var first = cut > 0 ? d.slice(0, cut + 1) : d;
      return '<li><span class="dl-name">' + esc(it.name) + '</span><span class="dl-price">' + p + '</span>' +
        (first ? '<span class="dl-desc">' + esc(first) + '</span>' : '') + '</li>';
    }).join('');
  }

  function renderFeatured(data) {
    var items = [];
    data.sections.forEach(function (s) {
      if (!s.visible) return;
      s.items.forEach(function (it) { if (it.featured && it.available !== false) items.push(it); });
    });
    if (!items.length) { document.querySelector('.featured').hidden = true; return; }
    $('featGrid').innerHTML = items.slice(0, 6).map(function (it) {
      return '<li>' + (it.image ? '<img alt="" loading="lazy" src="' + esc(AA.src(it.image)) + '">' : '') +
        '<div class="feat-top"><h3 class="feat-name">' + esc(it.name) + '</h3>' +
        (it.price != null ? '<span class="feat-price">' + AA.price(it.price) + '</span>' : '') + '</div>' +
        (it.desc ? '<p class="feat-desc">' + esc(it.desc) + '</p>' : '') + '</li>';
    }).join('');
  }

  function renderPromos(data) {
    var promos = AA.activePromos(data, 'site');
    if (!promos.length) return;
    $('promos').hidden = false;
    $('promos').innerHTML = promos.map(function (p) {
      return '<article class="promo">' + (p.kicker ? '<p class="promo-k">' + esc(p.kicker) + '</p>' : '') +
        '<h3 class="promo-t">' + esc(p.title) + '</h3>' + (p.text ? '<p class="promo-x">' + esc(p.text) + '</p>' : '') +
        (p.price ? '<p class="promo-p">' + esc(p.price) + '</p>' : '') + '</article>';
    }).join('');
  }

  AA.loadMenu().then(function (data) {
    var info = data.info || {};
    bind(info);
    var st = AA.openStatus(info);
    if (st) { $('status').hidden = false; $('status').textContent = st.text; $('status').classList.toggle('is-open', st.open); }
    var ann = AA.announcement(data);
    if (ann) { $('notice').hidden = false; $('notice').textContent = ann; }
    renderDoughs(data);
    renderFeatured(data);
    renderPromos(data);
  }).catch(function () { /* il sito resta leggibile con i testi statici */ });
})();
