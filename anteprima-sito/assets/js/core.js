/* L'Antico Arco — funzioni condivise tra sito, menu, totem e gestionale */
(function (global) {
  'use strict';

  var ROOT = (document.querySelector('meta[name="aa-root"]') || {}).content || './';
  var DRAFT_KEY = 'aa-draft';
  var CACHE_KEY = 'aa-menu-cache';

  var ALLERGENS = [
    { n: 1, code: 'glutine', label: 'Glutine', long: 'Cereali contenenti glutine' },
    { n: 2, code: 'crostacei', label: 'Crostacei', long: 'Crostacei e prodotti a base di crostacei' },
    { n: 3, code: 'uova', label: 'Uova', long: 'Uova e prodotti a base di uova' },
    { n: 4, code: 'pesce', label: 'Pesce', long: 'Pesce e prodotti a base di pesce' },
    { n: 5, code: 'arachidi', label: 'Arachidi', long: 'Arachidi e prodotti a base di arachidi' },
    { n: 6, code: 'soia', label: 'Soia', long: 'Soia e prodotti a base di soia' },
    { n: 7, code: 'latte', label: 'Latte', long: 'Latte e prodotti a base di latte (incluso lattosio)' },
    { n: 8, code: 'frutta-a-guscio', label: 'Frutta a guscio', long: 'Frutta a guscio (mandorle, nocciole, noci, pistacchi…)' },
    { n: 9, code: 'sedano', label: 'Sedano', long: 'Sedano e prodotti a base di sedano' },
    { n: 10, code: 'senape', label: 'Senape', long: 'Senape e prodotti a base di senape' },
    { n: 11, code: 'sesamo', label: 'Sesamo', long: 'Semi di sesamo e prodotti a base di sesamo' },
    { n: 12, code: 'solfiti', label: 'Solfiti', long: 'Anidride solforosa e solfiti' },
    { n: 13, code: 'lupini', label: 'Lupini', long: 'Lupini e prodotti a base di lupini' },
    { n: 14, code: 'molluschi', label: 'Molluschi', long: 'Molluschi e prodotti a base di molluschi' }
  ];
  var ALLERGEN_BY_CODE = {};
  ALLERGENS.forEach(function (a) { ALLERGEN_BY_CODE[a.code] = a; });

  var TAGS = [
    { code: 'vegana', label: 'Vegana', short: 'Vegan' },
    { code: 'vegetariana', label: 'Vegetariana', short: 'Veg' },
    { code: 'senza-glutine', label: 'Senza glutine', short: 'Senza glutine' },
    { code: 'senza-lattosio', label: 'Senza lattosio', short: 'Senza lattosio' },
    { code: 'piccante', label: 'Piccante', short: 'Piccante' },
    { code: 'novita', label: 'Novità', short: 'Novità' },
    { code: 'della-casa', label: 'Consigliata dalla casa', short: 'Della casa' },
    { code: 'alcolico', label: 'Alcolico', short: 'Alcolico' },
    { code: 'analcolico', label: 'Analcolico', short: 'Analcolico' }
  ];
  var TAG_BY_CODE = {};
  TAGS.forEach(function (t) { TAG_BY_CODE[t.code] = t; });

  var DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function price(v, opts) {
    opts = opts || {};
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '';
    var n = Number(v);
    var s = Math.abs(n).toFixed(2).replace('.', ',').replace(/,00$/, ''); // € 9, non € 9,00
    var sign = opts.signed ? (n < 0 ? '− ' : '+ ') : (n < 0 ? '−' : '');
    return sign + (opts.noEuro ? '' : '€ ') + s;
  }

  function src(path) {
    if (!path) return '';
    if (/^(data:|blob:|https?:)/.test(path)) return path;
    var pending = global.AA_PENDING_IMAGES;
    if (pending && pending[path]) return pending[path];
    return ROOT + path;
  }

  function isPreview() {
    return /[?&]anteprima\b/.test(location.search);
  }

  function readJSON(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  /* Carica i dati del menu. In anteprima usa la bozza del gestionale. */
  function loadMenu() {
    if (isPreview()) {
      var d = readJSON(DRAFT_KEY);
      if (d && d.data) {
        global.AA_PENDING_IMAGES = d.pending || {};
        return Promise.resolve(d.data);
      }
    }
    var url = ROOT + 'data/menu.json?t=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { writeJSON(CACHE_KEY, data); return data; })
      .catch(function (err) {
        var cached = readJSON(CACHE_KEY);
        if (cached) return cached;
        throw err;
      });
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function activePromos(data, where) {
    var t = todayISO();
    return (data.promos || []).filter(function (p) {
      if (!p.active || (where && !p[where])) return false;
      if (p.from && t < p.from) return false;
      if (p.until && t > p.until) return false;
      return true;
    });
  }

  function announcement(data) {
    var a = (data.info && data.info.announcement) || {};
    if (!a.text) return '';
    if (a.until && todayISO() > a.until) return '';
    return a.text;
  }

  function sectionsOf(data, groupId, where) {
    return data.sections.filter(function (s) {
      if (s.group !== groupId || !s.visible) return false;
      if (where === 'totem' && s.totem === false) return false;
      return s.items.some(function (i) { return i.available !== false; });
    });
  }

  function visibleItems(section) {
    return section.items.filter(function (i) { return i.available !== false; });
  }

  function minutes(hhmm) {
    var p = String(hhmm || '').split(':');
    return p.length === 2 ? Number(p[0]) * 60 + Number(p[1]) : null;
  }

  /* Stato apertura: { open: bool, text: 'Aperto ora · fino alle 23:00' } */
  function openStatus(info, now) {
    now = now || new Date();
    var days = info.openDays || [];
    var from = minutes(info.openFrom), to = minutes(info.openTo);
    if (!days.length || from === null || to === null) return null;
    var m = now.getHours() * 60 + now.getMinutes();
    var d = now.getDay();
    var iso = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (info.closedOn === iso) {
      for (var q = 1; q <= 7; q++) {
        var qd = (d + q) % 7;
        if (days.indexOf(qd) >= 0) return { open: false, closedToday: true, text: 'Oggi siamo chiusi. Riapriamo ' + (q === 1 ? 'domani' : DAYS[qd]) + ' alle ' + info.openFrom };
      }
      return { open: false, closedToday: true, text: 'Oggi siamo chiusi' };
    }
    if (days.indexOf(d) >= 0 && m >= from && m < to) {
      return { open: true, text: 'Aperto ora, fino alle ' + info.openTo };
    }
    if (days.indexOf(d) >= 0 && m < from) {
      return { open: false, text: 'Stasera siamo aperti, dalle ' + info.openFrom };
    }
    for (var k = 1; k <= 7; k++) {
      var nd = (d + k) % 7;
      if (days.indexOf(nd) >= 0) {
        return { open: false, text: (days.indexOf(d) >= 0 ? 'Per stasera abbiamo chiuso. ' : 'Oggi riposo. ') + 'Ci vediamo ' + (k === 1 ? 'domani' : DAYS[nd]) + ' dalle ' + info.openFrom };
      }
    }
    return null;
  }

  function telHref(num) { return 'tel:+39' + String(num || '').replace(/[^\d]/g, ''); }

  function allergenNums(codes) {
    return (codes || []).map(function (c) { return ALLERGEN_BY_CODE[c]; }).filter(Boolean)
      .sort(function (a, b) { return a.n - b.n; });
  }

  function itemPriceHTML(item, cls) {
    cls = cls || '';
    if (item.prices && item.prices.length) {
      return '<span class="' + cls + ' prices num">' + item.prices.map(function (p) {
        return '<span class="pf"><span class="pf-l">' + esc(p.label) + '</span> <span class="pf-v">' + price(p.price) + '</span></span>';
      }).join('') + '</span>';
    }
    if (item.price === null || item.price === undefined || item.price === '') return '';
    return '<span class="' + cls + ' num">' + price(item.price) + '</span>';
  }

  function qrSVG(text, opts) {
    opts = opts || {};
    if (!global.qrcode) return '';
    var q = global.qrcode(0, 'M');
    q.addData(text);
    q.make();
    var n = q.getModuleCount(), m = opts.margin == null ? 2 : opts.margin, size = n + m * 2;
    var d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" role="img" aria-label="Codice QR">' +
      '<rect width="100%" height="100%" fill="' + (opts.bg || '#fff') + '"/><path fill="' + (opts.fg || '#000') + '" d="' + d + '"/></svg>';
  }

  var ARCH_PATH = 'M10.00 56.00A40.0 40.0 0 0 1 12.13 43.11L24.44 47.30A27.0 27.0 0 0 0 23.00 56.00ZM12.71 41.54A40.0 40.0 0 0 1 18.83 30.94L28.96 39.08A27.0 27.0 0 0 0 24.83 46.24ZM19.90 29.65A40.0 40.0 0 0 1 29.28 21.79L36.01 32.91A27.0 27.0 0 0 0 29.68 38.22ZM30.73 20.95A40.0 40.0 0 0 1 42.23 16.76L44.75 29.75A27.0 27.0 0 0 0 36.99 32.58ZM43.86 12.07A44.5 44.5 0 0 1 56.14 12.07L54.17 29.32A27.0 27.0 0 0 0 45.83 29.32ZM57.77 16.76A40.0 40.0 0 0 1 69.27 20.95L63.01 32.58A27.0 27.0 0 0 0 55.25 29.75ZM70.72 21.79A40.0 40.0 0 0 1 80.10 29.65L70.32 38.22A27.0 27.0 0 0 0 63.99 32.91ZM81.17 30.94A40.0 40.0 0 0 1 87.29 41.54L75.17 46.24A27.0 27.0 0 0 0 71.04 39.08ZM87.87 43.11A40.0 40.0 0 0 1 90.00 56.00L77.00 56.00A27.0 27.0 0 0 0 75.56 47.30ZM10.0 57.4H23.0V70.0H10.0ZM77.0 57.4H90.0V70.0H77.0ZM10.0 71.4H23.0V84.0H10.0ZM77.0 71.4H90.0V84.0H77.0ZM10.0 85.4H23.0V98.0H10.0ZM77.0 85.4H90.0V98.0H77.0Z';

  function archSVG(cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="' + ARCH_PATH + '"/></svg>';
  }

  global.AA = {
    ROOT: ROOT, DRAFT_KEY: DRAFT_KEY, ALLERGENS: ALLERGENS, ALLERGEN_BY_CODE: ALLERGEN_BY_CODE,
    TAGS: TAGS, TAG_BY_CODE: TAG_BY_CODE, DAYS: DAYS, ARCH_PATH: ARCH_PATH,
    esc: esc, price: price, src: src, loadMenu: loadMenu, isPreview: isPreview,
    readJSON: readJSON, writeJSON: writeJSON, activePromos: activePromos, announcement: announcement,
    sectionsOf: sectionsOf, visibleItems: visibleItems, openStatus: openStatus, telHref: telHref,
    allergenNums: allergenNums, itemPriceHTML: itemPriceHTML, qrSVG: qrSVG, archSVG: archSVG, todayISO: todayISO
  };
})(window);
