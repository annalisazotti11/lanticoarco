/* Gestionale del menu: modifica, anteprima, pubblicazione su GitHub */
(function () {
  'use strict';
  var AA = window.AA, ST = window.AAStore, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var MENU_PATH = 'data/menu.json', CFG_PATH = 'gestione/config.json', SESSION_KEY = 'aa-session';

  var S = {
    cfg: null, store: null, user: '', data: null, publishedStr: '', baseSha: null,
    pending: {}, tab: 'menu', open: {}, q: '', ed: null
  };
  window.AA_PENDING_IMAGES = S.pending;

  /* ================= Utilità ================= */
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slug(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'foto'; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function parsePrice(v) {
    v = String(v == null ? '' : v).replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
    if (v === '') return null;
    var n = Number(v);
    return isNaN(n) ? undefined : Math.round(n * 100) / 100;
  }
  function priceInput(v) { return v === null || v === undefined || v === '' ? '' : Number(v).toFixed(2).replace('.', ','); }
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setPath(obj, path, val) {
    var ks = path.split('.'), o = obj;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }
  function findSec(id) { return S.data.sections.filter(function (s) { return s.id === id; })[0]; }
  function findItem(secId, itemId) { var s = findSec(secId); return s ? s.items.filter(function (i) { return i.id === itemId; })[0] : null; }
  function move(arr, idx, delta) {
    var j = idx + delta;
    if (j < 0 || j >= arr.length) return false;
    var t = arr[idx]; arr[idx] = arr[j]; arr[j] = t; return true;
  }

  var toastT;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 3800);
  }
  function ask(title, text, okLabel, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      $('askT').textContent = title; $('askX').textContent = text || '';
      $('askOk').textContent = okLabel || 'Conferma';
      $('askOk').className = 'b ' + (opts.danger ? 'b-danger' : 'b-main');
      $('askNo').textContent = opts.cancel || 'Annulla';
      $('ask').hidden = false; $('askOk').focus();
      function done(v) { $('ask').hidden = true; $('askOk').onclick = $('askNo').onclick = null; resolve(v); }
      $('askOk').onclick = function () { done(true); };
      $('askNo').onclick = function () { done(false); };
    });
  }
  function errText(e) {
    if (!e) return 'Errore sconosciuto.';
    if (e.status === 401) return 'La chiave GitHub non è più valida (scaduta o revocata). Va rifatta la configurazione iniziale.';
    if (e.status === 403) return 'GitHub rifiuta l\'operazione: la chiave non ha il permesso di scrittura.';
    if (e.status === 404) return 'Repository non trovato: controlla nome utente/repository e i permessi della chiave.';
    if (e.message === 'Failed to fetch') return 'Connessione assente: controlla internet e riprova.';
    return e.message || String(e);
  }

  /* ================= Sessione e accesso ================= */
  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeSession(sess, remember) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function guessRepo() {
    var h = location.hostname, m = h.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return '';
    var first = location.pathname.split('/').filter(Boolean)[0];
    return m[1] + '/' + (first && first !== 'gestione' ? first : m[1] + '.github.io');
  }

  function showGate() {
    $('app').hidden = true; $('gate').hidden = false;
    var hasCfg = S.cfg && S.cfg.users && S.cfg.users.length;
    $('loginForm').hidden = !hasCfg;
    $('setupForm').hidden = !!hasCfg;
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /[?&]demo\b/.test(location.search);
    $('demoBtn').hidden = !(local || !hasCfg);
    if (!hasCfg) {
      $('setupForm').repo.value = guessRepo();
      var url = 'https://github.com/settings/personal-access-tokens/new?name=' + encodeURIComponent('Gestione menu Antico Arco') +
        '&description=' + encodeURIComponent('Pubblicazione del menu dal gestionale') + '&expires_in=none&contents=write';
      $('tokenLink').href = url;
    } else {
      setTimeout(function () { $('loginForm').user.focus(); }, 50);
    }
  }

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, err = $('loginErr'), btn = f.querySelector('button');
    err.hidden = true; btn.disabled = true; btn.textContent = 'Verifico…';
    try {
      var name = f.user.value.trim().toLowerCase();
      var entry = S.cfg.users.filter(function (u) { return u.user.toLowerCase() === name; })[0];
      if (!entry) throw new Error('password');
      var token = await ST.decryptSecret(entry, f.pass.value);
      var store = new ST.GitHubStore(S.cfg, token);
      await store.checkAccess();
      writeSession({ mode: 'github', user: entry.user, token: token }, f.remember.checked);
      f.pass.value = '';
      await start(store, entry.user);
    } catch (ex) {
      err.textContent = ex.message === 'password' ? 'Nome utente o password non corretti.' : errText(ex);
      err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Entra'; }
  });

  $('setupForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, err = $('setupErr'), btn = f.querySelector('button');
    err.hidden = true;
    var parts = f.repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '').split('/');
    if (parts.length !== 2) { err.textContent = 'Scrivi il repository nella forma utente/repository.'; err.hidden = false; return; }
    if (f.pass.value !== f.pass2.value) { err.textContent = 'Le due password non coincidono.'; err.hidden = false; return; }
    if (f.pass.value.length < 10) { err.textContent = 'Usa una password di almeno 10 caratteri.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Configuro…';
    try {
      var token = f.token.value.trim();
      var store = new ST.GitHubStore({ owner: parts[0], repo: parts[1] }, token);
      var repo = await store.checkAccess();
      store.branch = repo.default_branch || 'main';
      var enc = await ST.encryptSecret(token, f.pass.value);
      var cfg = { owner: parts[0], repo: parts[1], branch: store.branch, users: [Object.assign({ user: f.user.value.trim() }, enc)] };
      await store.commitFiles([{ path: CFG_PATH, text: JSON.stringify(cfg, null, 1) }], 'Configurazione del gestionale');
      S.cfg = cfg;
      writeSession({ mode: 'github', user: cfg.users[0].user, token: token }, false);
      f.reset();
      await start(store, cfg.users[0].user);
      toast('Configurazione salvata. D\'ora in poi si entra con nome utente e password.');
    } catch (ex) {
      err.textContent = errText(ex); err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Salva e entra'; }
  });

  $('demoBtn').addEventListener('click', function () {
    writeSession({ mode: 'demo', user: 'demo' }, false);
    start(new ST.DemoStore(), 'demo');
  });

  /* ================= Avvio ================= */
  async function start(store, user) {
    S.store = store; S.user = user;
    var file = await store.readFile(MENU_PATH);
    var published = JSON.parse(file.text);
    S.publishedStr = JSON.stringify(published);
    S.baseSha = file.sha;
    var draft = AA.readJSON(AA.DRAFT_KEY);
    S.data = published;
    if (draft && draft.data && JSON.stringify(draft.data) !== S.publishedStr) {
      if (draft.baseSha === file.sha) {
        S.data = draft.data; Object.assign(S.pending, draft.pending || {});
        toast('Ho ripreso le modifiche non ancora pubblicate.');
      } else {
        var keep = await ask('Modifiche in sospeso',
          'Su questo dispositivo ci sono modifiche non pubblicate, ma nel frattempo il menu è stato pubblicato da un altro dispositivo. Se le riprendi, alla pubblicazione sostituiranno la versione online.',
          'Riprendi le mie modifiche', { cancel: 'Scartale' });
        if (keep) { S.data = draft.data; Object.assign(S.pending, draft.pending || {}); }
      }
    }
    ensureShape(S.data);
    $('gate').hidden = true; $('app').hidden = false;
    document.body.classList.toggle('is-demo', store.mode === 'demo');
    render(); updateState();
  }

  function ensureShape(d) {
    d.info = d.info || {}; d.groups = d.groups || []; d.sections = d.sections || []; d.promos = d.promos || [];
    d.settings = d.settings || {}; d.settings.totem = d.settings.totem || {};
    d.info.hours = d.info.hours || []; d.info.notes = d.info.notes || []; d.info.announcement = d.info.announcement || { text: '', until: '' };
    d.info.wifi = d.info.wifi || {}; d.info.legal = d.info.legal || {}; d.info.openDays = d.info.openDays || [];
  }

  /* ================= Bozza e stato ================= */
  var draftT;
  function changed() {
    updateState();
    clearTimeout(draftT);
    draftT = setTimeout(saveDraft, 350);
  }
  function saveDraft() {
    var ok = AA.writeJSON(AA.DRAFT_KEY, { data: S.data, pending: S.pending, baseSha: S.baseSha, savedAt: new Date().toISOString() });
    if (!ok) toast('Memoria del dispositivo piena: pubblica le modifiche per non perderle.', 6000);
  }
  function isDirty() { return JSON.stringify(S.data) !== S.publishedStr; }
  function updateState() {
    var d = isDirty();
    $('publishBtn').disabled = !d;
    $('state').classList.toggle('is-dirty', d);
    $('stateTxt').textContent = d ? 'Modifiche da pubblicare' : (S.store && S.store.mode === 'demo' ? 'Modalità demo' : 'Tutto pubblicato');
  }

  /* ================= Pubblicazione ================= */
  async function publish() {
    if (!isDirty()) return;
    var demo = S.store.mode === 'demo';
    var ok = await ask('Pubblicare le modifiche?',
      demo ? 'In modalità demo le modifiche restano solo su questo dispositivo.' : 'Saranno visibili su sito, menu e totem entro un paio di minuti.', 'Pubblica');
    if (!ok) return;
    var btn = $('publishBtn'); btn.disabled = true; btn.textContent = 'Pubblico…';
    try {
      var current = await S.store.fileSha(MENU_PATH);
      if (current && S.baseSha && current !== S.baseSha) {
        var force = await ask('Il menu è cambiato', 'Qualcuno ha pubblicato da un altro dispositivo dopo che hai aperto il gestionale. Pubblicando ora, la tua versione sostituisce la sua.', 'Pubblica comunque', { danger: true });
        if (!force) return;
      }
      S.data.updatedAt = new Date().toISOString();
      var text = JSON.stringify(S.data, null, 1);
      var files = [{ path: MENU_PATH, text: text }];
      Object.keys(S.pending).forEach(function (p) {
        if (text.indexOf('"' + p + '"') >= 0) files.push({ path: p, base64: S.pending[p].split(',')[1] });
      });
      var res = await S.store.commitFiles(files, 'Menu aggiornato dal gestionale (' + S.user + ')');
      S.baseSha = res.blobs[MENU_PATH] || current;
      S.publishedStr = JSON.stringify(S.data);
      try { localStorage.removeItem(AA.DRAFT_KEY); } catch (e) {}
      updateState();
      toast(demo ? 'Salvato in modalità demo.' : 'Pubblicato. Sito, menu e totem si aggiornano entro 1–2 minuti.', 6000);
    } catch (ex) {
      toast('Pubblicazione non riuscita: ' + errText(ex), 8000);
    } finally { btn.textContent = 'Pubblica'; updateState(); }
  }

  /* ================= Foto ================= */
  function pickImage() {
    return new Promise(function (resolve) {
      var inp = $('fileImg');
      inp.value = '';
      inp.onchange = function () { resolve(inp.files && inp.files[0]); };
      inp.click();
    });
  }
  function processImage(file, maxSide) {
    maxSide = maxSide || 1400;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var sc = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        var asWebp = c.toDataURL('image/webp', 0.82);
        if (asWebp.indexOf('data:image/webp') === 0) resolve({ url: asWebp, ext: 'webp' });
        else resolve({ url: c.toDataURL('image/jpeg', 0.85), ext: 'jpg' });
      };
      img.onerror = function () { reject(new Error('Formato immagine non supportato.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  async function uploadInto(obj, nameHint) {
    var f = await pickImage();
    if (!f) return false;
    try {
      var r = await processImage(f);
      var d = new Date();
      var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' +
        String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
      var path = 'img/uploads/' + stamp + '-' + slug(nameHint) + '.' + r.ext;
      S.pending[path] = r.url;
      obj.image = path;
      changed();
      return true;
    } catch (ex) { toast(ex.message); return false; }
  }

  /* ================= Viste ================= */
  function render() {
    document.querySelectorAll('#tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === S.tab); });
    var v = $('view');
    if (S.tab === 'menu') v.innerHTML = viewMenu();
    else if (S.tab === 'promo') v.innerHTML = viewPromos();
    else if (S.tab === 'locale') v.innerHTML = viewLocale();
    else v.innerHTML = viewAltro();
    if (S.tab === 'menu' && S.q) { var q = $('q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }

  function thumb(src, cls) {
    return src ? '<img class="' + (cls || 'th') + '" alt="" loading="lazy" src="' + esc(AA.src(src)) + '">'
      : '<span class="' + (cls || 'th') + ' th-empty">' + AA.archSVG() + '</span>';
  }

  function rowHTML(it, sec, showSec) {
    var multi = it.prices && it.prices.length;
    return '<li class="row' + (it.available === false ? ' is-off' : '') + '" data-sec="' + esc(sec.id) + '" data-item="' + esc(it.id) + '">' +
      '<button type="button" class="row-main" data-act="edit-item">' + thumb(it.image) +
      '<span class="row-txt"><span class="row-n">' + esc(it.name || 'Senza nome') + (it.featured ? ' <i class="badge">In evidenza</i>' : '') + '</span>' +
      '<span class="row-d">' + esc(showSec ? sec.name + (it.desc ? ': ' + it.desc : '') : (it.desc || '')) + '</span></span></button>' +
      (multi ? '<button type="button" class="row-fmt" data-act="edit-item">' + it.prices.length + ' formati</button>'
        : '<label class="row-price"><span class="sr-only">Prezzo di ' + esc(it.name) + '</span>€<input inputmode="decimal" data-act="price" value="' + priceInput(it.price) + '" placeholder="—"></label>') +
      '<label class="sw" title="Disponibile"><input type="checkbox" data-act="avail"' + (it.available !== false ? ' checked' : '') + '><span aria-hidden="true"></span><em class="sr-only">Disponibile</em></label>' +
      '</li>';
  }

  function viewMenu() {
    var h = '<div class="bar"><label class="search"><span class="sr-only">Cerca</span><input id="q" type="search" placeholder="Cerca un piatto o un ingrediente" value="' + esc(S.q) + '"></label></div>';
    if (S.q) {
      var words = norm(S.q).split(/\s+/).filter(Boolean), rows = '';
      var n = 0;
      S.data.sections.forEach(function (sec) {
        sec.items.forEach(function (it) {
          var hay = norm(it.name + ' ' + it.desc + ' ' + sec.name);
          if (words.every(function (w) { return hay.indexOf(w) >= 0; })) { rows += rowHTML(it, sec, true); n++; }
        });
      });
      return h + '<p class="muted">' + n + ' risultati</p><ul class="rows">' + rows + '</ul>';
    }
    h += '<p class="muted">Tocca un piatto per modificarlo. Il prezzo e l\'interruttore "disponibile" si cambiano direttamente dalla lista; un piatto spento non compare né nel menu né sul totem.</p>';
    S.data.groups.forEach(function (g, gi) {
      var secs = S.data.sections.filter(function (s) { return s.group === g.id; });
      h += '<section class="grp"><header class="grp-h"><h2>' + esc(g.name) + '</h2>' +
        '<button type="button" class="b b-ghost b-sm" data-act="edit-group" data-g="' + esc(g.id) + '">Modifica gruppo</button></header>';
      secs.forEach(function (sec) {
        var off = sec.items.filter(function (i) { return i.available === false; }).length;
        h += '<details class="sec" data-sec="' + esc(sec.id) + '"' + (S.open[sec.id] ? ' open' : '') + '><summary>' +
          '<span class="sec-n">' + esc(sec.name) + '</span><span class="sec-c">' + sec.items.length + ' voci' + (off ? ', ' + off + ' spente' : '') + '</span>' +
          (sec.visible === false ? '<i class="badge badge-off">Nascosta</i>' : '') + (sec.totem === false ? '<i class="badge">Non sul totem</i>' : '') +
          '</summary><div class="sec-tools"><button type="button" class="b b-ghost b-sm" data-act="edit-sec">Modifica categoria</button>' +
          '<button type="button" class="b b-main b-sm" data-act="add-item">Aggiungi piatto</button></div>' +
          '<ul class="rows">' + sec.items.map(function (it) { return rowHTML(it, sec); }).join('') + '</ul></details>';
      });
      h += '<button type="button" class="b b-dash" data-act="add-sec" data-g="' + esc(g.id) + '">Nuova categoria in ' + esc(g.name) + '</button></section>';
    });
    h += '<button type="button" class="b b-dash" data-act="add-group">Nuovo gruppo</button>';
    return h;
  }

  function viewPromos() {
    var h = '<p class="muted">Le inserzioni sono gli annunci in evidenza: compaiono a tutto schermo sul totem tra una pagina e l\'altra, in alto nel menu e sul sito, secondo dove le attivi.</p>';
    h += '<ul class="cards">' + S.data.promos.map(function (p, i) {
      var where = ['totem', 'menu', 'site'].filter(function (k) { return p[k]; }).map(function (k) { return { totem: 'Totem', menu: 'Menu', site: 'Sito' }[k]; }).join(', ');
      return '<li class="pcard' + (p.active ? '' : ' is-off') + '" data-promo="' + i + '">' +
        '<button type="button" class="row-main" data-act="edit-promo">' + thumb(p.image) +
        '<span class="row-txt"><span class="row-n">' + esc(p.title || 'Senza titolo') + '</span><span class="row-d">' + esc(p.kicker || '') +
        (where ? ' — ' + where : ' — non visibile') + (p.until ? ', fino al ' + esc(p.until.split('-').reverse().join('/')) : '') + '</span></span></button>' +
        '<label class="sw" title="Attiva"><input type="checkbox" data-act="promo-active"' + (p.active ? ' checked' : '') + '><span aria-hidden="true"></span><em class="sr-only">Attiva</em></label></li>';
    }).join('') + '</ul>';
    return h + '<button type="button" class="b b-dash" data-act="add-promo">Nuova inserzione</button>';
  }

  function field(label, path, opts) {
    opts = opts || {};
    var v = getPath(S.data, path);
    if (opts.price) v = priceInput(v);
    var tag = opts.area ? '<textarea data-path="' + path + '"' + (opts.price ? ' data-price' : '') + ' rows="' + (opts.rows || 3) + '">' + esc(v == null ? '' : v) + '</textarea>'
      : '<input data-path="' + path + '"' + (opts.price ? ' data-price inputmode="decimal"' : '') + ' type="' + (opts.type || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>';
    return '<label class="fld">' + esc(label) + tag + (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</label>';
  }

  function viewLocale() {
    var i = S.data.info;
    var h = '<section class="card"><h2>Avviso in evidenza</h2><p class="muted">Una riga ben visibile in cima a sito, menu e totem. Per esempio: "Domenica 14 siamo chiusi".</p>' +
      field('Testo dell\'avviso', 'info.announcement.text', { ph: 'Lascia vuoto per non mostrare nulla' }) +
      field('Mostra fino al (compreso)', 'info.announcement.until', { type: 'date', hint: 'Dopo questa data l\'avviso sparisce da solo.' }) + '</section>';
    h += '<section class="card"><h2>Contatti</h2>' + field('Nome', 'info.name') + field('Frase di presentazione', 'info.tagline', { area: true, rows: 2 }) +
      field('Indirizzo', 'info.address') + '<div class="two">' + field('Telefono prenotazioni', 'info.phone', { type: 'tel' }) + field('Cellulare', 'info.mobile', { type: 'tel' }) + '</div>' +
      field('Email', 'info.email', { type: 'email' }) + '<div class="two">' + field('Pagina Facebook', 'info.facebook', { type: 'url' }) + field('Instagram', 'info.instagram', { type: 'url' }) + '</div></section>';
    h += '<section class="card"><h2>Orari</h2><p class="muted">Come appaiono sul sito.</p><div class="list">' + (i.hours || []).map(function (r, k) {
      return '<div class="lrow"><input data-list="hours" data-k="' + k + '" data-f="days" value="' + esc(r.days) + '" aria-label="Giorni">' +
        '<input data-list="hours" data-k="' + k + '" data-f="time" value="' + esc(r.time) + '" aria-label="Orario">' +
        '<button type="button" class="b b-x" data-act="list-del" data-list="hours" data-k="' + k + '" aria-label="Elimina riga">×</button></div>';
    }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="list-add" data-list="hours">Aggiungi riga</button>' +
      '<h3>Aperto ora / chiuso</h3><p class="muted">Serve per la scritta "Aperto ora" su sito e menu.</p><div class="days">' +
      [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        return '<label class="chip-ck"><input type="checkbox" data-act="day" value="' + d + '"' + (i.openDays.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + AA.DAYS[d].slice(0, 3) + '</span></label>';
      }).join('') + '</div><div class="two">' + field('Dalle', 'info.openFrom', { type: 'time' }) + field('Alle', 'info.openTo', { type: 'time' }) + '</div></section>';
    h += '<section class="card"><h2>In sala</h2><div class="two">' + field('Coperto (€)', 'info.coverCharge', { price: true }) + '<span></span></div>' +
      '<div class="two">' + field('Wi‑Fi: nome rete', 'info.wifi.network') + field('Wi‑Fi: password', 'info.wifi.password') + '</div></section>';
    h += '<section class="card"><h2>Note per i clienti</h2><p class="muted">Prenotazioni, asporto, domicilio… Compaiono in fondo al menu.</p><div class="list">' + (i.notes || []).map(function (n, k) {
      return '<div class="lnote"><input data-list="notes" data-k="' + k + '" data-f="title" value="' + esc(n.title) + '" aria-label="Titolo">' +
        '<textarea data-list="notes" data-k="' + k + '" data-f="text" rows="3" aria-label="Testo">' + esc(n.text) + '</textarea>' +
        '<button type="button" class="b b-x" data-act="list-del" data-list="notes" data-k="' + k + '" aria-label="Elimina nota">×</button></div>';
    }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="list-add" data-list="notes">Aggiungi nota</button></section>';
    h += '<section class="card"><h2>Testi del menu</h2>' + field('I nostri prodotti (sito, sezione impasti)', 'info.products', { area: true, rows: 5 }) +
      field('Legenda asterisco *', 'info.frozenLegend') + field('Nota allergeni', 'info.allergenNote', { area: true, rows: 2 }) + '</section>';
    h += '<section class="card"><h2>Dati fiscali (piè di pagina del sito)</h2><div class="two">' + field('Partita IVA', 'info.legal.vat') + field('Codice fiscale', 'info.legal.cf') + '</div>' + field('REA', 'info.legal.rea') + '</section>';
    return h;
  }

  function viewAltro() {
    var t = S.data.settings.totem, demo = S.store.mode === 'demo';
    var h = '<section class="card"><h2>Totem in sala</h2>' +
      '<div class="two">' + field('Secondi per pagina', 'settings.totem.pageSeconds', { type: 'number' }) + field('Inserzione ogni quante pagine', 'settings.totem.promoEvery', { type: 'number', hint: '0 = mai' }) + '</div>' +
      '<label class="ck"><input type="checkbox" data-ck="settings.totem.showPhotos"' + (t.showPhotos !== false ? ' checked' : '') + '> Mostra le foto dei piatti</label>' +
      '<label class="ck"><input type="checkbox" data-ck="settings.totem.showQr"' + (t.showQr !== false ? ' checked' : '') + '> Mostra il QR per aprire il menu sul telefono</label>' +
      '<label class="fld">Colori<select data-path="settings.totem.theme"><option value="chiaro"' + (t.theme !== 'scuro' ? ' selected' : '') + '>Chiaro (come il logo)</option><option value="scuro"' + (t.theme === 'scuro' ? ' selected' : '') + '>Scuro (sala in penombra)</option></select></label>' +
      field('Indirizzo del menu (per i QR)', 'settings.menuUrl', { type: 'url', hint: 'Lascia vuoto per usare l\'indirizzo di questo sito + /menu/' }) +
      '<p class="muted">Per scegliere quali categorie scorrono sul totem: Menu → categoria → Modifica categoria.</p>' +
      '<div class="btns"><a class="b b-ghost" href="../totem/" target="_blank" rel="noopener">Apri il totem</a><a class="b b-ghost" href="../menu/" target="_blank" rel="noopener">Apri il menu</a><button type="button" class="b b-ghost" data-act="qr">Stampa i QR per i tavoli</button></div></section>';
    h += '<section class="card"><h2>Cronologia</h2><p class="muted">Ogni pubblicazione viene conservata. Puoi ricaricare una versione precedente e ripubblicarla.</p>' +
      '<div id="hist"></div><button type="button" class="b b-ghost" data-act="history"' + (demo ? ' disabled' : '') + '>Mostra le ultime pubblicazioni</button></section>';
    h += '<section class="card"><h2>Copia di sicurezza</h2><p class="muted">Scarica tutto il menu in un file da conservare, oppure ricaricalo.</p>' +
      '<div class="btns"><button type="button" class="b b-ghost" data-act="backup">Scarica la copia</button><button type="button" class="b b-ghost" data-act="restore">Carica una copia</button></div></section>';
    if (!demo) {
      h += '<section class="card"><h2>Accesso</h2><p class="muted">Sei collegato come <b>' + esc(S.user) + '</b>.</p>' +
        '<h3>Cambia la tua password</h3><div class="two"><label class="fld">Nuova password<input type="password" id="np1" autocomplete="new-password" minlength="10"></label><label class="fld">Ripeti<input type="password" id="np2" autocomplete="new-password" minlength="10"></label></div>' +
        '<button type="button" class="b b-ghost b-sm" data-act="pass">Cambia password</button>' +
        '<h3>Utenti</h3><ul class="users">' + S.cfg.users.map(function (u) {
          return '<li>' + esc(u.user) + (u.user === S.user ? ' (tu)' : ' <button type="button" class="b b-x" data-act="user-del" data-u="' + esc(u.user) + '" aria-label="Rimuovi">×</button>') + '</li>';
        }).join('') + '</ul><div class="two"><label class="fld">Nuovo utente<input id="nu" autocapitalize="none"></label><label class="fld">Sua password<input type="password" id="nup" autocomplete="new-password" minlength="10"></label></div>' +
        '<button type="button" class="b b-ghost b-sm" data-act="user-add">Aggiungi utente</button></section>';
    }
    h += '<section class="card"><button type="button" class="b b-ghost" data-act="logout">Esci</button></section>';
    return h;
  }

  /* ================= Editor (finestra laterale) ================= */
  function openSheet(title, html) {
    $('sheetT').textContent = title; $('sheetB').innerHTML = html;
    $('sheet').hidden = false; document.body.classList.add('locked');
    $('sheet').querySelector('.sheet-card').focus();
  }
  function closeSheet() { $('sheet').hidden = true; document.body.classList.remove('locked'); S.ed = null; render(); }

  function chips(list, selected, attr) {
    return '<div class="chips">' + list.map(function (x) {
      var on = selected.indexOf(x.code) >= 0;
      return '<button type="button" class="chip" ' + attr + '="' + x.code + '" aria-pressed="' + on + '">' + (x.n ? x.n + '. ' : '') + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }

  function itemEditor() {
    var sec = findSec(S.ed.sec), it = findItem(S.ed.sec, S.ed.item);
    var multi = it.prices && it.prices.length;
    var h = '<div class="ph-edit">' + thumb(it.image, 'ph-big') + '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="img-up">' + (it.image ? 'Cambia foto' : 'Carica foto') + '</button>' +
      (it.image ? '<button type="button" class="b b-ghost b-sm" data-act="img-del">Togli foto</button>' : '') + '</div></div>';
    h += '<label class="fld">Nome<input data-f="name" value="' + esc(it.name) + '"></label>';
    h += '<label class="fld">Ingredienti / descrizione<textarea data-f="desc" rows="3">' + esc(it.desc) + '</textarea></label>';
    h += '<fieldset class="fld"><legend>Prezzo</legend><div class="seg"><button type="button" data-act="pmode" data-v="1" aria-pressed="' + !multi + '">Prezzo unico</button><button type="button" data-act="pmode" data-v="n" aria-pressed="' + !!multi + '">Più formati</button></div>';
    if (multi) {
      h += '<div class="list">' + it.prices.map(function (p, k) {
        return '<div class="lrow"><input data-pf="label" data-k="' + k + '" value="' + esc(p.label) + '" placeholder="es. 33 cl" aria-label="Formato">' +
          '<label class="row-price">€<input inputmode="decimal" data-pf="price" data-k="' + k + '" value="' + priceInput(p.price) + '" aria-label="Prezzo"></label>' +
          '<button type="button" class="b b-x" data-act="pf-del" data-k="' + k + '" aria-label="Togli formato">×</button></div>';
      }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="pf-add">Aggiungi formato</button>';
    } else {
      h += '<label class="row-price big">€<input inputmode="decimal" data-f="price" value="' + priceInput(it.price) + '" placeholder="vuoto = prezzo da confermare"></label>';
      if (sec.deltaPrices) h += '<small class="muted">In questa categoria il prezzo è un supplemento (es. +2,00).</small>';
    }
    h += '</fieldset>';
    h += '<label class="fld">Nota breve<input data-f="note" value="' + esc(it.note) + '" placeholder="es. Senza glutine + € 2,50"></label>';
    h += '<div class="fld"><span>Caratteristiche</span>' + chips(AA.TAGS, it.tags || [], 'data-tag') + '</div>';
    h += '<div class="fld"><span>Allergeni</span>' + chips(AA.ALLERGENS, it.allergens || [], 'data-alg') + '</div>';
    h += '<label class="ck"><input type="checkbox" data-fb="available"' + (it.available !== false ? ' checked' : '') + '> Disponibile (spento = non compare)</label>';
    h += '<label class="ck"><input type="checkbox" data-fb="frozen"' + (it.frozen ? ' checked' : '') + '> Prodotto surgelato (mostra l\'asterisco *)</label>';
    h += '<label class="ck"><input type="checkbox" data-fb="featured"' + (it.featured ? ' checked' : '') + '> In evidenza sul sito</label>';
    h += '<label class="fld">Categoria<select data-act="move-sec">' + S.data.groups.map(function (g) {
      var opts = S.data.sections.filter(function (s) { return s.group === g.id; }).map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === sec.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('');
      return opts ? '<optgroup label="' + esc(g.name) + '">' + opts + '</optgroup>' : '';
    }).join('') + '</select></label>';
    h += '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="down">Sposta giù</button>' +
      '<button type="button" class="b b-ghost b-sm" data-act="dup">Duplica</button><button type="button" class="b b-danger b-sm" data-act="del-item">Elimina</button></div>';
    return h;
  }

  function secEditor() {
    var sec = findSec(S.ed.sec);
    var h = '<label class="fld">Nome<input data-s="name" value="' + esc(sec.name) + '"></label>' +
      '<label class="fld">Sottotitolo<input data-s="subtitle" value="' + esc(sec.subtitle) + '"></label>' +
      '<label class="fld">Nota (es. "Non disponibili il sabato")<textarea data-s="note" rows="3">' + esc(sec.note) + '</textarea></label>';
    h += '<fieldset class="fld"><legend>Varianti e supplementi della categoria</legend><div class="list">' + (sec.supplements || []).map(function (s, k) {
      return '<div class="lrow"><input data-sup="label" data-k="' + k + '" value="' + esc(s.label) + '" aria-label="Variante">' +
        '<label class="row-price">€<input inputmode="decimal" data-sup="price" data-k="' + k + '" value="' + priceInput(s.price) + '" aria-label="Differenza di prezzo"></label>' +
        '<button type="button" class="b b-x" data-act="sup-del" data-k="' + k + '" aria-label="Togli">×</button></div>';
    }).join('') + '</div><small class="muted">Usa il meno per gli sconti, es. Pizzella −1,00.</small><button type="button" class="b b-ghost b-sm" data-act="sup-add">Aggiungi variante</button></fieldset>';
    h += '<label class="fld">Aspetto<select data-s="layout"><option value="list"' + (sec.layout === 'list' ? ' selected' : '') + '>Lista (piatti)</option><option value="cards"' + (sec.layout === 'cards' ? ' selected' : '') + '>Schede con foto (impasti)</option><option value="chips"' + (sec.layout === 'chips' ? ' selected' : '') + '>Compatto per prezzo (aggiunte)</option></select></label>';
    h += '<label class="ck"><input type="checkbox" data-sb="deltaPrices"' + (sec.deltaPrices ? ' checked' : '') + '> I prezzi sono supplementi (+ € …)</label>';
    h += '<label class="ck"><input type="checkbox" data-sb="visible"' + (sec.visible !== false ? ' checked' : '') + '> Visibile nel menu e sul sito</label>';
    h += '<label class="ck"><input type="checkbox" data-sb="totem"' + (sec.totem !== false ? ' checked' : '') + '> Mostra sul totem</label>';
    h += '<label class="fld">Gruppo<select data-s="group">' + S.data.groups.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === sec.group ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') + '</select></label>';
    h += '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="sec-up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="sec-down">Sposta giù</button><button type="button" class="b b-danger b-sm" data-act="del-sec">Elimina categoria</button></div>';
    return h;
  }

  function groupEditor() {
    var g = S.data.groups.filter(function (x) { return x.id === S.ed.group; })[0];
    return '<label class="fld">Nome<input data-g="name" value="' + esc(g.name) + '"></label>' +
      '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="grp-up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="grp-down">Sposta giù</button><button type="button" class="b b-danger b-sm" data-act="del-group">Elimina gruppo</button></div>';
  }

  function promoEditor() {
    var p = S.data.promos[S.ed.promo];
    var h = '<div class="ph-edit">' + thumb(p.image, 'ph-big') + '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="img-up">' + (p.image ? 'Cambia foto' : 'Carica foto') + '</button>' +
      (p.image ? '<button type="button" class="b b-ghost b-sm" data-act="img-del">Togli foto</button>' : '') + '</div></div>';
    h += '<label class="fld">Etichetta (piccola, sopra il titolo)<input data-p="kicker" value="' + esc(p.kicker) + '" placeholder="es. Novità"></label>';
    h += '<label class="fld">Titolo<input data-p="title" value="' + esc(p.title) + '"></label>';
    h += '<label class="fld">Testo<textarea data-p="text" rows="3">' + esc(p.text) + '</textarea></label>';
    h += '<label class="fld">Prezzo (testo libero)<input data-p="price" value="' + esc(p.price) + '" placeholder="es. € 9,00 oppure + € 3,00"></label>';
    h += '<label class="ck"><input type="checkbox" data-pb="active"' + (p.active ? ' checked' : '') + '> Attiva</label>';
    h += '<div class="two"><label class="fld">Dal<input type="date" data-p="from" value="' + esc(p.from) + '"></label><label class="fld">Al<input type="date" data-p="until" value="' + esc(p.until) + '"></label></div>';
    h += '<div class="fld"><span>Dove mostrarla</span><label class="ck"><input type="checkbox" data-pb="totem"' + (p.totem ? ' checked' : '') + '> Totem</label>' +
      '<label class="ck"><input type="checkbox" data-pb="menu"' + (p.menu ? ' checked' : '') + '> Menu sul telefono</label>' +
      '<label class="ck"><input type="checkbox" data-pb="site"' + (p.site ? ' checked' : '') + '> Sito</label></div>';
    h += '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="promo-up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="promo-down">Sposta giù</button><button type="button" class="b b-danger b-sm" data-act="del-promo">Elimina</button></div>';
    return h;
  }

  function refreshEditor() {
    var b = $('sheetB'), top = b.scrollTop;
    if (!S.ed) return;
    if (S.ed.type === 'item') b.innerHTML = itemEditor();
    else if (S.ed.type === 'sec') b.innerHTML = secEditor();
    else if (S.ed.type === 'group') b.innerHTML = groupEditor();
    else if (S.ed.type === 'promo') b.innerHTML = promoEditor();
    b.scrollTop = top;
  }

  /* ================= Eventi: lista ================= */
  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    S.tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });
  document.querySelector('.ah-actions').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'publish') publish();
    if (a.dataset.act === 'preview') preview();
  });
  function preview() {
    saveDraft();
    window.open('../menu/?anteprima', '_blank');
  }

  var view = $('view');
  view.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.matches && d.matches('details.sec')) S.open[d.dataset.sec] = d.open;
  }, true);

  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { S.q = t.value; clearTimeout(view._qt); view._qt = setTimeout(render, 220); return; }
    if (t.dataset.path) {
      var v = t.value;
      if (t.hasAttribute('data-price')) { v = parsePrice(v); if (v === undefined) return; }
      else if (t.type === 'number') v = t.value === '' ? null : Number(t.value);
      setPath(S.data, t.dataset.path, v); changed(); return;
    }
    if (t.dataset.list) {
      S.data.info[t.dataset.list][Number(t.dataset.k)][t.dataset.f] = t.value; changed();
    }
  });

  view.addEventListener('change', function (e) {
    var t = e.target, row = t.closest('.row');
    if (t.dataset.act === 'price' && row) {
      var it = findItem(row.dataset.sec, row.dataset.item), v = parsePrice(t.value);
      if (v === undefined) { toast('Prezzo non valido: usa numeri come 9,50'); t.value = priceInput(it.price); return; }
      it.price = v; t.value = priceInput(v); changed(); return;
    }
    if (t.dataset.act === 'avail' && row) {
      var it2 = findItem(row.dataset.sec, row.dataset.item);
      it2.available = t.checked; row.classList.toggle('is-off', !t.checked); changed(); return;
    }
    if (t.dataset.act === 'promo-active') {
      var i = Number(t.closest('[data-promo]').dataset.promo);
      S.data.promos[i].active = t.checked; t.closest('.pcard').classList.toggle('is-off', !t.checked); changed(); return;
    }
    if (t.dataset.act === 'day') {
      var d = Number(t.value), days = S.data.info.openDays, k = days.indexOf(d);
      if (t.checked && k < 0) days.push(d); if (!t.checked && k >= 0) days.splice(k, 1);
      changed(); return;
    }
    if (t.dataset.ck) { setPath(S.data, t.dataset.ck, t.checked); changed(); return; }
    if (t.tagName === 'SELECT' && t.dataset.path) { setPath(S.data, t.dataset.path, t.value); changed(); }
  });

  view.addEventListener('click', async function (e) {
    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.dataset.act, row = a.closest('.row'), secEl = a.closest('[data-sec]');
    if (act === 'edit-item' && row) {
      S.ed = { type: 'item', sec: row.dataset.sec, item: row.dataset.item };
      openSheet('Modifica piatto', itemEditor());
    } else if (act === 'edit-sec' && secEl) {
      S.ed = { type: 'sec', sec: secEl.dataset.sec };
      openSheet('Modifica categoria', secEditor());
    } else if (act === 'add-item' && secEl) {
      var sec = findSec(secEl.dataset.sec);
      var it = { id: uid('i'), name: '', desc: '', price: null, prices: [], note: '', tags: [], allergens: [], image: '', frozen: false, available: true, featured: false };
      sec.items.push(it); S.open[sec.id] = true; changed();
      S.ed = { type: 'item', sec: sec.id, item: it.id, isNew: true };
      openSheet('Nuovo piatto', itemEditor());
      setTimeout(function () { var n = document.querySelector('#sheetB [data-f="name"]'); if (n) n.focus(); }, 60);
    } else if (act === 'edit-group') {
      S.ed = { type: 'group', group: a.dataset.g }; openSheet('Modifica gruppo', groupEditor());
    } else if (act === 'add-sec') {
      var ns = { id: uid('s'), group: a.dataset.g, name: 'Nuova categoria', subtitle: '', note: '', supplements: [], layout: 'list', deltaPrices: false, visible: true, totem: true, items: [] };
      var last = -1;
      S.data.sections.forEach(function (s, k) { if (s.group === a.dataset.g) last = k; });
      S.data.sections.splice(last + 1, 0, ns); S.open[ns.id] = true; changed();
      S.ed = { type: 'sec', sec: ns.id }; openSheet('Nuova categoria', secEditor());
    } else if (act === 'add-group') {
      var ng = { id: uid('g'), name: 'Nuovo gruppo', icon: '' };
      S.data.groups.push(ng); changed();
      S.ed = { type: 'group', group: ng.id }; openSheet('Nuovo gruppo', groupEditor());
    } else if (act === 'edit-promo') {
      S.ed = { type: 'promo', promo: Number(a.closest('[data-promo]').dataset.promo) }; openSheet('Modifica inserzione', promoEditor());
    } else if (act === 'add-promo') {
      S.data.promos.unshift({ id: uid('p'), active: true, title: '', kicker: '', text: '', price: '', image: '', from: '', until: '', totem: true, menu: true, site: false });
      changed(); S.ed = { type: 'promo', promo: 0 }; openSheet('Nuova inserzione', promoEditor());
    } else if (act === 'list-add') {
      S.data.info[a.dataset.list].push(a.dataset.list === 'hours' ? { days: '', time: '' } : { title: '', text: '' }); changed(); render();
    } else if (act === 'list-del') {
      S.data.info[a.dataset.list].splice(Number(a.dataset.k), 1); changed(); render();
    } else if (act === 'qr') printQr();
    else if (act === 'history') showHistory(a);
    else if (act === 'restore-ver') restoreVersion(a.dataset.sha);
    else if (act === 'backup') backup();
    else if (act === 'restore') restoreBackup();
    else if (act === 'pass') changePassword();
    else if (act === 'user-add') addUser();
    else if (act === 'user-del') delUser(a.dataset.u);
    else if (act === 'logout') logout();
  });

  /* ================= Eventi: editor ================= */
  var sheetB = $('sheetB');
  sheetB.addEventListener('input', function (e) {
    var t = e.target, ed = S.ed;
    if (!ed) return;
    if (ed.type === 'item') {
      var it = findItem(ed.sec, ed.item);
      if (t.dataset.f === 'price') { var v = parsePrice(t.value); if (v !== undefined) it.price = v; }
      else if (t.dataset.f) it[t.dataset.f] = t.value;
      else if (t.dataset.pf) {
        var p = it.prices[Number(t.dataset.k)];
        if (t.dataset.pf === 'price') { var v2 = parsePrice(t.value); if (v2 !== undefined) p.price = v2; } else p.label = t.value;
      }
    } else if (ed.type === 'sec') {
      var sec = findSec(ed.sec);
      if (t.dataset.s) sec[t.dataset.s] = t.value;
      else if (t.dataset.sup) {
        var s = sec.supplements[Number(t.dataset.k)];
        if (t.dataset.sup === 'price') { var v3 = parsePrice(String(t.value).replace('−', '-')); if (v3 !== undefined) s.price = v3; } else s.label = t.value;
      }
    } else if (ed.type === 'group') {
      var g = S.data.groups.filter(function (x) { return x.id === ed.group; })[0];
      if (t.dataset.g) g[t.dataset.g] = t.value;
    } else if (ed.type === 'promo') {
      if (t.dataset.p) S.data.promos[ed.promo][t.dataset.p] = t.value;
    }
    changed();
  });
  sheetB.addEventListener('change', function (e) {
    var t = e.target, ed = S.ed;
    if (!ed) return;
    if (ed.type === 'item') {
      var it = findItem(ed.sec, ed.item);
      if (t.dataset.fb) it[t.dataset.fb] = t.checked;
      if (t.dataset.act === 'move-sec' && t.value !== ed.sec) {
        var from = findSec(ed.sec), to = findSec(t.value);
        from.items.splice(from.items.indexOf(it), 1); to.items.push(it);
        ed.sec = to.id; S.open[to.id] = true; toast('Spostato in ' + to.name);
      }
      if (t.dataset.f === 'price') t.value = priceInput(it.price);
    } else if (ed.type === 'sec') {
      var sec = findSec(ed.sec);
      if (t.dataset.sb) sec[t.dataset.sb] = t.checked;
      if (t.tagName === 'SELECT' && t.dataset.s) sec[t.dataset.s] = t.value;
    } else if (ed.type === 'promo') {
      if (t.dataset.pb) S.data.promos[ed.promo][t.dataset.pb] = t.checked;
    }
    changed();
  });
  sheetB.addEventListener('click', async function (e) {
    var a = e.target.closest('[data-act], [data-tag], [data-alg]');
    if (!a || !S.ed) return;
    var ed = S.ed, it = ed.type === 'item' ? findItem(ed.sec, ed.item) : null, sec = ed.sec ? findSec(ed.sec) : null;
    if (a.dataset.tag || a.dataset.alg) {
      var list = a.dataset.tag ? (it.tags = it.tags || []) : (it.allergens = it.allergens || []);
      var v = a.dataset.tag || a.dataset.alg, k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      a.setAttribute('aria-pressed', k < 0); changed(); return;
    }
    var act = a.dataset.act;
    if (act === 'img-up') {
      var target = ed.type === 'promo' ? S.data.promos[ed.promo] : it;
      if (await uploadInto(target, target.name || target.title)) refreshEditor();
    } else if (act === 'img-del') {
      (ed.type === 'promo' ? S.data.promos[ed.promo] : it).image = ''; changed(); refreshEditor();
    } else if (act === 'pmode') {
      if (a.dataset.v === 'n' && !(it.prices && it.prices.length)) it.prices = [{ label: '', price: it.price }, { label: '', price: null }];
      if (a.dataset.v === '1' && it.prices && it.prices.length) { it.price = it.prices[0].price; it.prices = []; }
      changed(); refreshEditor();
    } else if (act === 'pf-add') { it.prices.push({ label: '', price: null }); changed(); refreshEditor(); }
    else if (act === 'pf-del') { it.prices.splice(Number(a.dataset.k), 1); changed(); refreshEditor(); }
    else if (act === 'up' || act === 'down') { if (move(sec.items, sec.items.indexOf(it), act === 'up' ? -1 : 1)) { changed(); toast(act === 'up' ? 'Spostato su' : 'Spostato giù', 1200); } }
    else if (act === 'dup') {
      var c = clone(it); c.id = uid('i'); c.name = it.name + ' (copia)';
      sec.items.splice(sec.items.indexOf(it) + 1, 0, c); changed();
      S.ed = { type: 'item', sec: sec.id, item: c.id }; refreshEditor(); toast('Duplicato: ora stai modificando la copia.');
    } else if (act === 'del-item') {
      if (await ask('Eliminare "' + (it.name || 'piatto') + '"?', 'Se vuoi solo toglierlo per un po\', usa l\'interruttore "Disponibile".', 'Elimina', { danger: true })) {
        sec.items.splice(sec.items.indexOf(it), 1); changed(); closeSheet();
      }
    } else if (act === 'sup-add') { sec.supplements = sec.supplements || []; sec.supplements.push({ label: '', price: 0 }); changed(); refreshEditor(); }
    else if (act === 'sup-del') { sec.supplements.splice(Number(a.dataset.k), 1); changed(); refreshEditor(); }
    else if (act === 'sec-up' || act === 'sec-down') {
      var arr = S.data.sections, idx = arr.indexOf(sec), step = act === 'sec-up' ? -1 : 1, j = idx + step;
      while (j >= 0 && j < arr.length && arr[j].group !== sec.group) j += step;
      if (j >= 0 && j < arr.length) { arr.splice(idx, 1); arr.splice(j, 0, sec); changed(); toast('Spostata', 1200); }
    } else if (act === 'del-sec') {
      if (await ask('Eliminare la categoria "' + sec.name + '"?', 'Verranno eliminati anche i suoi ' + sec.items.length + ' piatti. Per nasconderla e basta, togli la spunta "Visibile".', 'Elimina', { danger: true })) {
        S.data.sections.splice(S.data.sections.indexOf(sec), 1); changed(); closeSheet();
      }
    } else if (act === 'grp-up' || act === 'grp-down') {
      var gi = S.data.groups.findIndex(function (g) { return g.id === ed.group; });
      if (move(S.data.groups, gi, act === 'grp-up' ? -1 : 1)) { changed(); toast('Spostato', 1200); }
    } else if (act === 'del-group') {
      var n = S.data.sections.filter(function (s) { return s.group === ed.group; }).length;
      if (n) { toast('Il gruppo contiene ' + n + ' categorie: spostale o eliminale prima.'); return; }
      S.data.groups = S.data.groups.filter(function (g) { return g.id !== ed.group; }); changed(); closeSheet();
    } else if (act === 'promo-up' || act === 'promo-down') {
      if (move(S.data.promos, ed.promo, act === 'promo-up' ? -1 : 1)) { ed.promo += act === 'promo-up' ? -1 : 1; changed(); toast('Spostata', 1200); }
    } else if (act === 'del-promo') {
      if (await ask('Eliminare questa inserzione?', 'Per toglierla solo per un po\', spegni "Attiva".', 'Elimina', { danger: true })) {
        S.data.promos.splice(ed.promo, 1); changed(); closeSheet();
      }
    }
  });
  $('sheet').addEventListener('click', function (e) { if (e.target.closest('[data-act="close"]')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden && $('ask').hidden) closeSheet(); });
  window.addEventListener('beforeunload', function () { if (S.data) saveDraft(); });

  /* ================= Altro ================= */
  function printQr() {
    var url = S.data.settings.menuUrl || new URL('../menu/', location.href).href;
    var logo = new URL('../assets/img/logo/logo-600.webp', location.href).href;
    var svg = AA.qrSVG(url, { margin: 0 });
    var card = '<div class="c"><img src="' + logo + '" alt=""><p class="t">Il nostro menu</p>' + svg + '<p class="u">Inquadra il codice con la fotocamera</p></div>';
    var w = window.open('', '_blank');
    if (!w) { toast('Il browser ha bloccato la finestra: consenti i popup e riprova.'); return; }
    w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>QR per i tavoli</title><style>' +
      '@page{size:A4;margin:10mm}body{margin:0;font-family:Georgia,serif;color:#1c1714}.g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}' +
      '.c{border:1px dashed #bbb;border-radius:4mm;padding:6mm;text-align:center;break-inside:avoid;height:128mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
      '.c img{width:52mm}.c svg{width:56mm;height:56mm;margin:4mm 0}.t{font-size:18pt;margin:3mm 0 0}.u{font:10pt sans-serif;color:#5f554e;margin:0}' +
      '.bar{padding:10px;font:14px sans-serif}@media print{.bar{display:none}}</style></head><body><div class="bar">Ritaglia lungo il tratteggio. <button onclick="print()">Stampa</button> Indirizzo: ' + esc(url) + '</div>' +
      '<div class="g">' + card + card + card + card + '</div></body></html>');
    w.document.close();
  }

  async function showHistory(btn) {
    btn.disabled = true; btn.textContent = 'Carico…';
    try {
      var list = await S.store.history(MENU_PATH, 15);
      $('hist').innerHTML = '<ul class="hist">' + list.map(function (c, k) {
        var d = new Date(c.date);
        return '<li><span>' + d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
          '<small>' + esc(c.message.split('\n')[0]) + '</small></span>' +
          (k === 0 ? '<em>online ora</em>' : '<button type="button" class="b b-ghost b-sm" data-act="restore-ver" data-sha="' + c.sha + '">Ricarica</button>') + '</li>';
      }).join('') + '</ul>';
      btn.hidden = true;
    } catch (ex) { toast(errText(ex)); btn.disabled = false; btn.textContent = 'Mostra le ultime pubblicazioni'; }
  }
  async function restoreVersion(sha) {
    if (!(await ask('Ricaricare questa versione?', 'Sostituisce le modifiche attuali nella bozza. Diventerà visibile ai clienti solo quando premi Pubblica.', 'Ricarica'))) return;
    try {
      var f = await S.store.readFile(MENU_PATH, sha);
      S.data = JSON.parse(f.text); ensureShape(S.data); changed(); S.tab = 'menu'; render();
      toast('Versione ricaricata. Controlla e premi Pubblica per rimetterla online.', 6000);
    } catch (ex) { toast(errText(ex)); }
  }
  function backup() {
    var blob = new Blob([JSON.stringify(S.data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'menu-antico-arco-' + AA.todayISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function restoreBackup() {
    var inp = $('fileJson'); inp.value = '';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      f.text().then(async function (t) {
        var d = JSON.parse(t);
        if (!d.sections || !d.groups) throw new Error('Il file non è una copia del menu.');
        if (!(await ask('Caricare la copia?', 'Sostituisce la bozza attuale. Diventa visibile ai clienti solo dopo Pubblica.', 'Carica'))) return;
        S.data = d; ensureShape(S.data); changed(); render(); toast('Copia caricata nella bozza.');
      }).catch(function (ex) { toast(ex.message || 'File non valido.'); });
    };
    inp.click();
  }
  async function saveConfig(message) {
    await S.store.commitFiles([{ path: CFG_PATH, text: JSON.stringify(S.cfg, null, 1) }], message);
  }
  async function changePassword() {
    var p1 = $('np1').value, p2 = $('np2').value;
    if (p1.length < 10) { toast('Usa almeno 10 caratteri.'); return; }
    if (p1 !== p2) { toast('Le due password non coincidono.'); return; }
    try {
      var enc = await ST.encryptSecret(S.store.token, p1);
      S.cfg.users = S.cfg.users.map(function (u) { return u.user === S.user ? Object.assign({ user: u.user }, enc) : u; });
      await saveConfig('Cambio password di ' + S.user);
      $('np1').value = $('np2').value = '';
      toast('Password cambiata. Vale da subito su tutti i dispositivi.');
    } catch (ex) { toast(errText(ex)); }
  }
  async function addUser() {
    var u = $('nu').value.trim(), p = $('nup').value;
    if (!u || p.length < 10) { toast('Scrivi un nome utente e una password di almeno 10 caratteri.'); return; }
    if (S.cfg.users.some(function (x) { return x.user.toLowerCase() === u.toLowerCase(); })) { toast('Questo utente esiste già.'); return; }
    try {
      var enc = await ST.encryptSecret(S.store.token, p);
      S.cfg.users.push(Object.assign({ user: u }, enc));
      await saveConfig('Nuovo utente ' + u); render(); toast('Utente aggiunto.');
    } catch (ex) { toast(errText(ex)); }
  }
  async function delUser(u) {
    if (!(await ask('Rimuovere l\'utente ' + u + '?', 'Non potrà più entrare nel gestionale.', 'Rimuovi', { danger: true }))) return;
    try {
      S.cfg.users = S.cfg.users.filter(function (x) { return x.user !== u; });
      await saveConfig('Rimosso utente ' + u); render(); toast('Utente rimosso.');
    } catch (ex) { toast(errText(ex)); }
  }
  async function logout() {
    if (isDirty() && !(await ask('Uscire?', 'Le modifiche non pubblicate restano salvate su questo dispositivo e le ritrovi al prossimo accesso.', 'Esci'))) return;
    saveDraft(); clearSession(); location.reload();
  }

  /* ================= Partenza ================= */
  (async function boot() {
    try {
      var r = await fetch('config.json?t=' + Date.now(), { cache: 'no-store' });
      S.cfg = r.ok ? await r.json() : null;
    } catch (e) { S.cfg = null; }
    var sess = readSession();
    try {
      if (sess && sess.mode === 'demo') return await start(new ST.DemoStore(), 'demo');
      if (sess && sess.token && S.cfg) return await start(new ST.GitHubStore(S.cfg, sess.token), sess.user);
    } catch (ex) {
      clearSession();
      toast(errText(ex), 6000);
    }
    showGate();
  })();
})();
