/* Gestionale del menu: modifica, anteprima, pubblicazione su GitHub */
(function () {
  'use strict';
  var AA = window.AA, ST = window.AAStore, esc = AA.esc;
  var $ = function (id) { return document.getElementById(id); };
  var MENU_PATH = 'data/menu.json', CFG_PATH = 'gestione/config.json', SESSION_KEY = 'aa-session';

  var S = {
    cfg: null, store: null, user: '', data: null, publishedStr: '', baseSha: null,
    pending: {}, tab: 'oggi', open: {}, q: '', ed: null, oq: ''
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
      $('askT').textContent = title;
      if (opts.html) $('askX').innerHTML = opts.html; else $('askX').innerHTML = text ? '<p>' + esc(text) + '</p>' : '';
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
    $('gateS').textContent = hasCfg ? 'Menu, orari e novità del sito.' : 'Prima configurazione';
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
    ensureShape(published);
    S.publishedStr = JSON.stringify(published);
    S.baseSha = file.sha;
    var draft = AA.readJSON(AA.DRAFT_KEY);
    if (draft && draft.data) ensureShape(draft.data);
    S.data = JSON.parse(S.publishedStr);
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
    $('demoPill').hidden = store.mode !== 'demo';
    S.published = JSON.parse(S.publishedStr);
    histReset(); render(); updateState();
  }

  function ensureShape(d) {
    d.info = d.info || {}; d.groups = d.groups || []; d.sections = d.sections || []; d.promos = d.promos || [];
    d.settings = d.settings || {}; d.settings.totem = d.settings.totem || {};
    d.info.hours = d.info.hours || []; d.info.notes = d.info.notes || []; d.info.announcement = d.info.announcement || { text: '', until: '' };
    d.info.wifi = d.info.wifi || {}; d.info.legal = d.info.legal || {}; d.info.openDays = d.info.openDays || [];
    d.settings.builder = d.settings.builder || {};
    if (!d.settings.builder.presets) d.settings.builder.presets = [
      { name: 'Pugliese', items: ['Rape stufate', 'Salsiccia pezzente', 'Provolone Murgiano Putignano'] },
      { name: 'Bufala e pomodorini', items: ['Bufala all’uscita', 'Pomodorini Torre Guaceto bio presidio slow'] },
      { name: 'Mortadella e pistacchio', items: ['Mortadella a fette', 'Stracciatella all’uscita', 'Granella di pistacchio'] },
      { name: 'Piccante', items: ['Nduja', 'Salsiccia piccante', 'Cipolla rossa'] },
      { name: 'Funghi e tartufo', items: ['Funghi porcini', 'Crema di tartufo spalmata'] },
      { name: 'Cetara', items: ['Acciughe di Cetara', 'Pomodorini confit', 'Capperi'] }];
    if (!d.settings.builder.popular) d.settings.builder.popular = ['Bufala all’uscita', 'Stracciatella all’uscita', 'Funghi freschi champignon', 'Salsiccia di Norcia', 'Prosciutto crudo a dadi', 'Nduja', 'Olive leccine', 'Rape stufate', 'Pomodorini confit', 'Acciughe di Cetara', 'Granella di pistacchio', 'Patate fritte'];
  }

  /* ================= Bozza e stato ================= */
  var draftT;
  function changed() {
    updateState();
    clearTimeout(draftT);
    draftT = setTimeout(saveDraft, 350);
    histLater();
  }
  function saveDraft() {
    var ok = AA.writeJSON(AA.DRAFT_KEY, { data: S.data, pending: S.pending, baseSha: S.baseSha, savedAt: new Date().toISOString() });
    if (!ok) toast('Memoria del dispositivo piena: pubblica le modifiche per non perderle.', 6000);
  }
  /* confronto che non bada all'ordine delle chiavi */
  function stable(o) {
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).filter(function (k) { return o[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(o[k]); }).join(',') + '}';
    return JSON.stringify(o);
  }
  function pubData() { return S.published || (S.published = JSON.parse(S.publishedStr)); }
  function isDirty() { return JSON.stringify(S.data) !== S.publishedStr && stable(S.data) !== stable(pubData()); }
  function fmtP(v) { return v == null || v === '' ? 'senza prezzo' : AA.price(v); }
  function setOrDel(o, k, v) { if (v === undefined) delete o[k]; else o[k] = clone(v); }
  function idsOf(arr) { return (arr || []).map(function (x) { return x.id; }); }

  /* Differenze leggibili tra due versioni del menu. Ogni voce sa anche come tornare indietro (r). */
  function diff(pub, cur) {
    var out = [];
    function add(t, r) { out.push({ t: t, r: r }); }
    var pi = {}, ci = {};
    (pub.sections || []).forEach(function (s) { (s.items || []).forEach(function (it, k) { pi[it.id] = { it: it, sec: s, k: k }; }); });
    cur.sections.forEach(function (s) { s.items.forEach(function (it, k) { ci[it.id] = { it: it, sec: s, k: k }; }); });
    function secOf(id) { return cur.sections.filter(function (s) { return s.id === id; })[0]; }
    function here(id) { var r = null; cur.sections.forEach(function (s) { s.items.forEach(function (it, k) { if (it.id === id) r = { it: it, sec: s, k: k }; }); }); return r; }
    function putBack(a) {
      var s = secOf(a.sec.id); if (!s) return;
      var c = here(a.it.id); if (c) c.sec.items.splice(c.k, 1);
      s.items.splice(Math.min(a.k, s.items.length), 0, c ? c.it : clone(a.it));
    }
    Object.keys(ci).forEach(function (id) {
      var a = pi[id], b = ci[id], n = b.it.name || 'Piatto senza nome';
      if (!a) { add('Nuovo in ' + b.sec.name + ': ' + n, function () { var c = here(id); if (c) c.sec.items.splice(c.k, 1); }); return; }
      if (stable(a.it) === stable(b.it) && a.sec.id === b.sec.id) return;
      var done = false;
      if (a.it.price !== b.it.price) { add(n + ': ' + fmtP(a.it.price) + ' → ' + fmtP(b.it.price), function () { var c = here(id); if (c) setOrDel(c.it, 'price', a.it.price); }); done = true; }
      if ((a.it.available !== false) !== (b.it.available !== false)) { add(n + ': ' + (b.it.available === false ? 'esaurito' : 'di nuovo disponibile'), function () { var c = here(id); if (c) setOrDel(c.it, 'available', a.it.available); }); done = true; }
      if (a.sec.id !== b.sec.id) { add(n + ': spostato in ' + b.sec.name, function () { putBack(a); }); done = true; }
      var ra = Object.assign({}, a.it, { price: 0, available: 0 }), rb = Object.assign({}, b.it, { price: 0, available: 0 });
      var whole = function () {
        var c = here(id); if (!c) return;
        var keep = { price: c.it.price, available: c.it.available };
        Object.keys(c.it).forEach(function (k) { delete c.it[k]; });
        Object.assign(c.it, clone(a.it)); setOrDel(c.it, 'price', keep.price); setOrDel(c.it, 'available', keep.available);
      };
      if (stable(ra) !== stable(rb)) {
        var LBL = { name: 'nome', desc: 'ingredienti', image: 'foto', cutout: 'foto', tags: 'etichette', allergens: 'allergeni', prices: 'formati', note: 'nota', featured: 'evidenza', frozen: 'surgelato' }, what = [];
        Object.keys(Object.assign({}, ra, rb)).forEach(function (k) { var l = LBL[k] || 'altri dettagli'; if (stable(ra[k]) !== stable(rb[k]) && what.indexOf(l) < 0) what.push(l); });
        var txt = what.length === 1 && what[0] === 'nome' ? (a.it.name || 'Piatto') + ' diventa «' + n + '»'
          : n + ': ' + (what.length === 1 ? ({ ingredienti: 'cambiano gli ingredienti', foto: 'cambia la foto', etichette: 'cambiano le etichette', allergeni: 'cambiano gli allergeni', formati: 'cambiano i formati', nota: 'cambia la nota', evidenza: 'cambia la voce in evidenza', surgelato: 'cambia la voce surgelato' })[what[0]] || 'cambia la scheda' : 'cambiano ' + what.slice(0, -1).join(', ') + ' e ' + what[what.length - 1]);
        add(txt, whole);
      }
      else if (!done) add(n + ': modificato', whole);
    });
    Object.keys(pi).forEach(function (id) { if (!ci[id]) add('Tolto: ' + (pi[id].it.name || 'piatto'), function () { putBack(pi[id]); }); });
    // ordine dei piatti dentro la stessa categoria
    cur.sections.forEach(function (s) {
      var ps = (pub.sections || []).filter(function (x) { return x.id === s.id; })[0];
      if (!ps) return;
      var common = idsOf(s.items).filter(function (id) { return pi[id] && pi[id].sec.id === s.id; });
      var before = idsOf(ps.items).filter(function (id) { return common.indexOf(id) >= 0; });
      if (common.join() !== before.join()) add('Ordine cambiato in ' + s.name, function () {
        var t = secOf(s.id); if (!t) return;
        var pos = {}; idsOf(ps.items).forEach(function (id, k) { pos[id] = k; });
        var fixed = t.items.filter(function (x) { return x.id in pos; }).sort(function (x, y) { return pos[x.id] - pos[y.id]; });
        var j = 0; t.items = t.items.map(function (x) { return x.id in pos ? fixed[j++] : x; });
      });
    });
    var strip = function (arr) { return stable((arr || []).map(function (x) { var c = Object.assign({}, x); delete c.items; return c; })); };
    if (strip(pub.sections) !== strip(cur.sections) || stable(pub.groups || []) !== stable(cur.groups)) add('Categorie del menu modificate', function () {
      cur.groups = clone(pub.groups || []);
      var by = {}; cur.sections.forEach(function (x) { by[x.id] = x; });
      var next = (pub.sections || []).map(function (ps) {
        var m = clone(ps);
        if (by[ps.id]) { m.items = by[ps.id].items; delete by[ps.id]; }
        return m;
      });
      Object.keys(by).forEach(function (id) { if (by[id].items.length) next.push(by[id]); });
      cur.sections = next;
    });
    var pp = {}; (pub.promos || []).forEach(function (p, k) { pp[p.id] = { p: p, k: k }; });
    cur.promos.forEach(function (p) {
      var o = pp[p.id] && pp[p.id].p, t = p.title || 'Novità senza titolo';
      if (!o) add('Nuova novità: ' + t, function () { cur.promos = cur.promos.filter(function (x) { return x.id !== p.id; }); });
      else if (stable(o) !== stable(p)) add(o.active !== p.active ? t + ': ' + (p.active ? 'attivata' : 'spenta') : 'Novità modificata: ' + t, function () {
        cur.promos = cur.promos.map(function (x) { return x.id === p.id ? clone(o) : x; });
      });
    });
    Object.keys(pp).forEach(function (id) {
      if (!cur.promos.some(function (x) { return x.id === id; })) add('Novità tolta: ' + (pp[id].p.title || ''), function () { cur.promos.splice(Math.min(pp[id].k, cur.promos.length), 0, clone(pp[id].p)); });
    });
    var pc = idsOf(cur.promos).filter(function (id) { return pp[id]; }), pb = idsOf(pub.promos).filter(function (id) { return pc.indexOf(id) >= 0; });
    if (pc.join() !== pb.join()) add('Ordine delle novità cambiato', function () {
      cur.promos.sort(function (x, y) { return (pp[x.id] ? pp[x.id].k : 999) - (pp[y.id] ? pp[y.id].k : 999); });
    });
    var pa = pub.info || {}, ca = cur.info;
    if (stable(pa.announcement || { text: '', until: '' }) !== stable(ca.announcement)) add(ca.announcement.text ? 'Avviso: «' + ca.announcement.text + '»' : 'Avviso tolto', function () { cur.info.announcement = clone(pa.announcement || { text: '', until: '' }); });
    if ((pa.closedOn || '') !== (ca.closedOn || '')) add(ca.closedOn === AA.todayISO() ? 'Oggi siete chiusi' : 'Di nuovo aperti oggi', function () { setOrDel(cur.info, 'closedOn', pa.closedOn); });
    var HK = ['openDays', 'openFrom', 'openTo', 'hours'];
    if (stable(HK.map(function (k) { return pa[k]; })) !== stable(HK.map(function (k) { return ca[k]; }))) add('Giorni e orari modificati', function () { HK.forEach(function (k) { setOrDel(cur.info, k, pa[k]); }); });
    var skip = ['announcement', 'closedOn'].concat(HK), keys = {};
    Object.keys(pa).concat(Object.keys(ca)).forEach(function (k) { if (skip.indexOf(k) < 0) keys[k] = 1; });
    if (Object.keys(keys).some(function (k) { return stable(pa[k]) !== stable(ca[k]); })) add('Contatti e informazioni modificati', function () {
      Object.keys(keys).forEach(function (k) { setOrDel(cur.info, k, pa[k]); });
    });
    if (stable(pub.settings || {}) !== stable(cur.settings)) add('Impostazioni modificate', function () { cur.settings = clone(pub.settings || {}); ensureShape(cur); });
    return out;
  }
  function changesList() { return diff(pubData(), S.data).map(function (c) { return c.t; }); }
  /* dopo un annullamento: ciò che torna uguale all'online riprende la sua forma esatta */
  function canon() {
    var pub = pubData();
    if (stable(S.data) === stable(pub)) { S.data = clone(pub); return; }
    var pi = {};
    (pub.sections || []).forEach(function (s) { s.items.forEach(function (it) { pi[it.id] = it; }); });
    S.data.sections.forEach(function (s) { s.items = s.items.map(function (it) { return pi[it.id] && stable(pi[it.id]) === stable(it) ? clone(pi[it.id]) : it; }); });
  }
  function updateState() {
    var d = isDirty();
    $('pub').hidden = !d;
    document.body.classList.toggle('has-pub', d);
    if (d) {
      var n = changesList().length || 1;
      $('pubN').innerHTML = '<b>' + n + (n === 1 ? ' modifica' : ' modifiche') + '</b> da pubblicare<span>Vedi e annulla</span>';
    }
    histUI();
  }

  /* ================= Indietro e avanti (come Ctrl+Z) ================= */
  var H = { list: [], i: 0, t: 0 };
  function histReset() { clearTimeout(H.t); H.t = 0; H.list = [JSON.stringify(S.data)]; H.i = 0; histUI(); }
  function histLater() { clearTimeout(H.t); H.t = setTimeout(histCommit, 700); histUI(); }
  function histCommit() {
    clearTimeout(H.t); H.t = 0;
    if (!S.data) return;
    var now = JSON.stringify(S.data);
    if (now === H.list[H.i]) return histUI();
    H.list = H.list.slice(0, H.i + 1); H.list.push(now);
    if (H.list.length > 150) H.list.shift();
    H.i = H.list.length - 1; histUI();
  }
  function canUndo() { return H.i > 0 || (H.t && JSON.stringify(S.data) !== H.list[H.i]); }
  function canRedo() { return !H.t && H.i < H.list.length - 1; }
  function histUI() {
    document.querySelectorAll('[data-act="undo"]').forEach(function (b) { b.disabled = !canUndo(); });
    document.querySelectorAll('[data-act="redo"]').forEach(function (b) { b.disabled = !canRedo(); });
  }
  function undo() {
    histCommit();
    if (H.i <= 0) { toast('Non c\'è niente da annullare.', 1800); return; }
    var from = H.list[H.i]; H.i--; applySnap(H.list[H.i], from, false);
  }
  function redo() {
    histCommit();
    if (H.i >= H.list.length - 1) { toast('Non c\'è niente da rifare.', 1800); return; }
    var from = H.list[H.i]; H.i++; applySnap(H.list[H.i], from, true);
  }
  function applySnap(str, fromStr, forward) {
    var before = JSON.parse(fromStr), ed = S.ed;
    var pid = ed && ed.type === 'promo' && S.data.promos[ed.promo] ? S.data.promos[ed.promo].id : null;
    S.data = JSON.parse(str); ensureShape(S.data);
    var what = diff(before, S.data);
    afterDataSwap(pid);
    var first = what[0] ? what[0].t : 'fatto';
    toast((forward ? 'Avanti: ' : 'Indietro: ') + first + (what.length > 1 ? ' (e altre ' + (what.length - 1) + ')' : ''), 2600);
  }
  /* i dati sono cambiati da sotto: riallinea scheda aperta, vista e bozza */
  function afterDataSwap(pid) {
    var ed = S.ed;
    if (ed && !$('sheet').hidden) {
      var ok = true;
      if (ed.type === 'item') {
        var where = S.data.sections.filter(function (s) { return s.items.some(function (i) { return i.id === ed.item; }); })[0];
        if (where) ed.sec = where.id; else ok = false;
      } else if (ed.type === 'sec') ok = !!findSec(ed.sec);
      else if (ed.type === 'group') ok = S.data.groups.some(function (g) { return g.id === ed.group; });
      else if (ed.type === 'promo') { var k = S.data.promos.map(function (p) { return p.id; }).indexOf(pid); if (k < 0) ok = false; else ed.promo = k; }
      if (ok) refreshEditor(); else { closeSheet(); }
    }
    saveDraft(); updateState(); render();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="undo"], [data-act="redo"]');
    if (!b || !S.data) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.act === 'undo') undo(); else redo();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!S.data || $('app').hidden || !$('ask').hidden) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase(), t = e.target;
    if (k !== 'z' && k !== 'y') return;
    if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(t.type)))) return; // nel campo di testo vale l'annulla del campo
    e.preventDefault();
    if (k === 'y' || (k === 'z' && e.shiftKey)) redo(); else undo();
  });

  /* ================= Modifiche da pubblicare: una a una ================= */
  function changesEditor() {
    var list = diff(pubData(), S.data);
    if (!list.length) return '<p class="muted chg-empty">Nessuna modifica da pubblicare: è tutto come online.</p>';
    return '<p class="muted chg-lead">Sono salvate su questo dispositivo ma non ancora online. Puoi annullarle una per una.</p>' +
      '<ul class="chg chg-x">' + list.map(function (c, k) {
        return '<li><span>' + esc(c.t) + '</span><button type="button" class="b b-ghost b-sm" data-act="revert" data-k="' + k + '">Annulla</button></li>';
      }).join('') + '</ul>' +
      '<div class="btns chg-end"><button type="button" class="b b-ghost" data-act="revert-all">Annulla tutte</button><button type="button" class="b b-main" data-act="publish-now">Pubblica</button></div>';
  }
  function openChanges() { S.ed = { type: 'changes' }; openSheet('Modifiche da pubblicare', changesEditor()); }
  async function revertOne(k) {
    histCommit();
    var c = diff(pubData(), S.data)[k];
    if (!c) return;
    c.r(); canon(); ensureShape(S.data);
    histCommit(); afterDataSwap(null);
    toast('Annullato: ' + c.t, 2400);
  }
  async function revertAll() {
    var n = changesList().length;
    if (!(await ask('Annullare tutte le modifiche?', 'Torni al menu come è online adesso (' + n + (n === 1 ? ' modifica' : ' modifiche') + '). Puoi sempre tornare avanti con la freccia ↷.', 'Annulla tutte', { danger: true, cancel: 'Indietro' }))) return;
    histCommit();
    S.data = clone(pubData()); ensureShape(S.data);
    histCommit(); afterDataSwap(null);
    toast('Tutto come online.', 2200);
  }

  /* ================= Pubblicazione ================= */
  async function publish() {
    if (!isDirty()) return;
    var demo = S.store.mode === 'demo';
    var list = changesList();
    var ok = await ask('Pubblicare ' + (list.length === 1 ? 'questa modifica?' : 'queste ' + list.length + ' modifiche?'), '', 'Pubblica', {
      html: '<ul class="chg">' + list.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul><p>' +
        (demo ? 'Sei in prova: le modifiche restano solo su questo dispositivo.' : 'Le vedranno i clienti su sito, menu e cartellone entro un paio di minuti.') + '</p>' });
    if (!ok) return;
    var btn = $('publishBtn'); btn.disabled = true; btn.textContent = 'Pubblico…';
    try { window.scrollTo(0, window.scrollY); } catch (e) {}
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
      S.publishedStr = JSON.stringify(S.data); S.published = JSON.parse(S.publishedStr);
      if (S.ed && S.ed.type === 'changes') closeSheet();
      try { localStorage.removeItem(AA.DRAFT_KEY); } catch (e) {}
      updateState();
      toast(demo ? 'Salvato in modalità demo.' : 'Pubblicato. Sito, menu e cartellone si aggiornano entro 1–2 minuti.', 6000);
    } catch (ex) {
      toast('Pubblicazione non riuscita: ' + errText(ex), 8000);
    } finally { btn.textContent = 'Pubblica'; btn.disabled = false; updateState(); }
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
      delete obj.cutout; // la pizza scontornata era della foto vecchia
      changed();
      return true;
    } catch (ex) { toast(ex.message); return false; }
  }

  /* ================= Viste ================= */
  var ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function render() {
    document.querySelectorAll('#tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'); });
    var v = $('view');
    v.innerHTML = S.tab === 'oggi' ? viewOggi() : S.tab === 'menu' ? viewMenu() : S.tab === 'novita' ? viewPromos() : S.tab === 'orari' ? viewOrari() : viewAltro();
    if (S.tab === 'menu' && S.q) { var q = $('q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    if (S.tab === 'oggi' && S.oq) { var oq = $('oq'); if (oq) { oq.focus(); oq.setSelectionRange(oq.value.length, oq.value.length); } }
  }
  function pageHead(title, sub) {
    return '<header class="ph"><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</header>';
  }
  function thumb(src, cls) {
    return src ? '<img class="' + (cls || 'th') + '" alt="" loading="lazy" src="' + esc(AA.src(src)) + '">'
      : '<span class="' + (cls || 'th') + ' th-empty">' + AA.archSVG() + '</span>';
  }
  function allItems() {
    var out = [];
    S.data.sections.forEach(function (s) { s.items.forEach(function (it) { out.push({ it: it, sec: s }); }); });
    return out;
  }
  function sw(act, on, label, extra) {
    return '<label class="sw" title="' + esc(label) + '"><input type="checkbox" data-act="' + act + '"' + (on ? ' checked' : '') + (extra || '') + '><span aria-hidden="true"></span><em class="sr-only">' + esc(label) + '</em></label>';
  }

  /* ---------- Oggi ---------- */
  function viewOggi() {
    var i = S.data.info, today = AA.todayISO();
    var st = AA.openStatus(i) || { open: false, text: '' };
    var hr = new Date().getHours();
    var hello = (hr < 13 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera') + (S.user && S.user !== 'demo' ? ', ' + S.user.charAt(0).toUpperCase() + S.user.slice(1) : '');
    var dateTxt = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    var h = pageHead(hello + '.', esc(dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1)));
    h += '<section class="card status' + (st.open ? ' is-open' : '') + '"><div class="st-row"><span class="st-dot"></span><b>' + esc(st.text || 'Orari non impostati') + '</b></div>' +
      '<label class="line"><span><b>Oggi siamo chiusi</b><small>Per una chiusura straordinaria: sito e menu mostrano "Oggi siamo chiusi".</small></span>' + sw('closed-today', i.closedOn === today, 'Oggi siamo chiusi') + '</label></section>';
    var ann = i.announcement || {};
    h += '<section class="card"><h2>Avviso per i clienti</h2><p class="muted">Compare in alto su sito, menu e cartellone. Lascia vuoto per non mostrare nulla.</p>' +
      '<label class="fld"><span class="sr-only">Testo dell\'avviso</span><input data-path="info.announcement.text" value="' + esc(ann.text || '') + '" placeholder="es. Domenica 14 siamo chiusi per ferie"></label>' +
      '<label class="fld">Mostralo fino al<input type="date" data-path="info.announcement.until" value="' + esc(ann.until || '') + '"><small>Il giorno dopo sparisce da solo.</small></label></section>';
    var off = allItems().filter(function (x) { return x.it.available === false; });
    h += '<section class="card"><h2>Piatti esauriti</h2><p class="muted">Un piatto esaurito non compare su sito, menu e cartellone finché non lo rimetti.</p>';
    if (off.length) {
      h += '<ul class="mini">' + off.map(function (x) {
        return '<li data-sec="' + esc(x.sec.id) + '" data-item="' + esc(x.it.id) + '"><span><b>' + esc(x.it.name) + '</b><small>' + esc(x.sec.name) + '</small></span>' +
          '<button type="button" class="b b-ghost b-sm" data-act="back-on">Rimetti</button></li>';
      }).join('') + '</ul>';
      if (off.length > 1) h += '<button type="button" class="b b-ghost b-sm" data-act="all-on">Rimetti tutti</button>';
    } else h += '<p class="empty-ok">Nessun piatto esaurito.</p>';
    h += '<label class="fld">Segna un piatto come esaurito<input id="oq" type="search" placeholder="Scrivi il nome, es. bufala" value="' + esc(S.oq) + '" autocomplete="off"></label>';
    if (S.oq.trim().length > 1) {
      var w = norm(S.oq).split(/\s+/).filter(Boolean);
      var hits = allItems().filter(function (x) { var hay = norm(x.it.name + ' ' + x.sec.name); return x.it.available !== false && w.every(function (k) { return hay.indexOf(k) >= 0; }); }).slice(0, 8);
      h += '<ul class="mini">' + (hits.length ? hits.map(function (x) {
        return '<li data-sec="' + esc(x.sec.id) + '" data-item="' + esc(x.it.id) + '"><span><b>' + esc(x.it.name) + '</b><small>' + esc(x.sec.name) + '</small></span>' +
          '<button type="button" class="b b-main b-sm" data-act="set-off">Esaurito</button></li>';
      }).join('') : '<li class="muted">Nessun piatto trovato.</li>') + '</ul>';
    }
    h += '</section>';
    var act = AA.activePromos(S.data, null);
    h += '<section class="card"><h2>Novità in vetrina</h2><p class="muted">' + (act.length ? act.length + (act.length === 1 ? ' novità attiva' : ' novità attive') + ': ' + act.map(function (p) { return esc(p.title); }).join(', ') + '.' : 'Nessuna novità attiva.') + '</p>' +
      '<button type="button" class="b b-ghost b-sm" data-go="novita">Gestisci le novità</button></section>';
    h += '<section class="card"><h2>Collegamenti</h2><div class="links">' +
      '<a href="../" target="_blank" rel="noopener">Sito</a><a href="../menu/" target="_blank" rel="noopener">Menu</a><a href="../totem/" target="_blank" rel="noopener">Cartellone</a>' +
      '<button type="button" data-act="qr">QR per i tavoli</button></div></section>';
    return h;
  }

  /* ---------- Menu ---------- */
  function rowHTML(it, sec, showSec) {
    var multi = it.prices && it.prices.length;
    return '<li class="row' + (it.available === false ? ' is-off' : '') + '" data-sec="' + esc(sec.id) + '" data-item="' + esc(it.id) + '">' +
      '<button type="button" class="row-main" data-act="edit-item">' + thumb(it.cutout || it.image) +
      '<span class="row-txt"><span class="row-n">' + esc(it.name || 'Senza nome') + (it.featured ? ' <i class="badge">Preferita</i>' : '') + (it.available === false ? ' <i class="badge badge-off">Esaurito</i>' : '') + '</span>' +
      '<span class="row-d">' + esc(showSec ? sec.name + (it.desc ? ': ' + it.desc : '') : (it.desc || '')) + '</span></span></button>' +
      (multi ? '<button type="button" class="row-fmt" data-act="edit-item">' + it.prices.length + ' formati</button>'
        : '<label class="row-price"><span class="sr-only">Prezzo di ' + esc(it.name) + '</span>€<input inputmode="decimal" data-act="price" value="' + priceInput(it.price) + '" placeholder="—"></label>') +
      sw('avail', it.available !== false, 'Disponibile') + '</li>';
  }
  function viewMenu() {
    var h = pageHead('Menu', 'Prezzo e disponibilità si cambiano dalla lista. Tocca un piatto per la scheda completa.');
    h += '<div class="bar"><label class="search"><span class="sr-only">Cerca</span><input id="q" type="search" placeholder="Cerca un piatto o un ingrediente" value="' + esc(S.q) + '"></label></div>';
    if (S.q) {
      var words = norm(S.q).split(/\s+/).filter(Boolean), rows = '', n = 0;
      S.data.sections.forEach(function (sec) {
        sec.items.forEach(function (it) {
          var hay = norm(it.name + ' ' + it.desc + ' ' + sec.name);
          if (words.every(function (w) { return hay.indexOf(w) >= 0; })) { rows += rowHTML(it, sec, true); n++; }
        });
      });
      return h + '<p class="muted">' + n + (n === 1 ? ' risultato' : ' risultati') + '</p><ul class="rows solo">' + rows + '</ul>';
    }
    S.data.groups.forEach(function (g) {
      var secs = S.data.sections.filter(function (s) { return s.group === g.id; });
      h += '<section class="grp"><header class="grp-h"><h2>' + esc(g.name) + '</h2><button type="button" class="icon-b" data-act="edit-group" data-g="' + esc(g.id) + '" aria-label="Modifica il gruppo ' + esc(g.name) + '">' + ICON_EDIT + '</button></header>';
      secs.forEach(function (sec) {
        var off = sec.items.filter(function (i) { return i.available === false; }).length;
        var open = !!S.open[sec.id];
        var ph = sec.items.filter(function (i) { return i.cutout; })[0] || sec.items.filter(function (i) { return i.image; })[0];
        h += '<div class="acc' + (open ? ' open' : '') + '" data-sec="' + esc(sec.id) + '">' +
          '<button type="button" class="acc-h" data-act="toggle-sec" aria-expanded="' + open + '">' + thumb(ph ? (ph.cutout || ph.image) : '', 'acc-ph' + (ph && ph.cutout ? ' cut' : '')) +
          '<span class="acc-tx"><b>' + esc(sec.name) + '</b><small>' + sec.items.length + ' piatti' + (off ? ' · <em>' + off + ' esauriti</em>' : '') +
          (sec.visible === false ? ' · <em>nascosta</em>' : '') + '</small></span><span class="acc-ch">' + CHEV + '</span></button>' +
          (open ? '<div class="acc-b"><div class="sec-tools"><button type="button" class="b b-main b-sm" data-act="add-item">+ Aggiungi un piatto</button><button type="button" class="b b-ghost b-sm" data-act="edit-sec">Impostazioni della sottocategoria</button></div>' +
            '<ul class="rows">' + sec.items.map(function (it) { return rowHTML(it, sec); }).join('') + '</ul></div>' : '') + '</div>';
      });
      h += '<button type="button" class="b b-dash" data-act="add-sec" data-g="' + esc(g.id) + '">+ Nuova sottocategoria in ' + esc(g.name) + '</button></section>';
    });
    h += '<button type="button" class="b b-dash" data-act="add-group">+ Nuova categoria</button>';
    return h;
  }

  /* ---------- Novità ---------- */
  function promoCard(p) {
    return '<div class="pv-promo' + (p.image ? '' : ' no-ph') + '">' + (p.image ? '<img alt="" src="' + esc(AA.src(p.image)) + '">' : '') +
      '<div>' + (p.kicker ? '<span class="pv-k">' + esc(p.kicker) + '</span>' : '') + '<p class="pv-t">' + esc(p.title || 'Titolo della novità') + '</p>' +
      (p.text ? '<p class="pv-x">' + esc(p.text) + '</p>' : '') + (p.price ? '<p class="pv-p">' + esc(p.price) + '</p>' : '') + '</div></div>';
  }
  function viewPromos() {
    var h = pageHead('Novità', 'Gli annunci in vetrina: in alto nel menu, sul sito e a tutto schermo sul cartellone in sala.');
    h += '<button type="button" class="b b-main" data-act="add-promo">+ Nuova novità</button>';
    h += '<ul class="pgrid">' + S.data.promos.map(function (p, i) {
      var where = ['site', 'menu', 'totem'].filter(function (k) { return p[k]; }).map(function (k) { return { totem: 'cartellone', menu: 'menu', site: 'sito' }[k]; }).join(', ');
      return '<li class="pitem' + (p.active ? '' : ' is-off') + '" data-promo="' + i + '"><button type="button" class="pv-btn" data-act="edit-promo">' + promoCard(p) + '</button>' +
        '<div class="pmeta"><span>' + (p.active ? (where ? 'Su ' + where : 'Attiva ma non mostrata da nessuna parte') : 'Spenta') + (p.until ? ' · fino al ' + esc(p.until.split('-').reverse().join('/')) : '') + '</span>' + sw('promo-active', p.active, 'Attiva') + '</div></li>';
    }).join('') + '</ul>';
    return h;
  }

  /* ---------- Orari e contatti ---------- */
  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hoursFromWeek(i) {
    var open = DAY_ORDER.map(function (d) { return i.openDays.indexOf(d) >= 0; });
    var time = (i.openFrom || '') + ' – ' + (i.openTo || ''), rows = [], k = 0;
    while (k < 7) {
      if (!open[k]) { k++; continue; }
      var j = k; while (j + 1 < 7 && open[j + 1]) j++;
      var a = cap(AA.DAYS[DAY_ORDER[k]]), b = cap(AA.DAYS[DAY_ORDER[j]]);
      rows.push({ days: k === j ? a : (j === k + 1 ? a + ' e ' + b : a + ' – ' + b), time: time });
      k = j + 1;
    }
    var closed = DAY_ORDER.filter(function (d, x) { return !open[x]; }).map(function (d) { return cap(AA.DAYS[d]); });
    if (closed.length && closed.length < 7) rows.push({ days: closed.join(', '), time: closed.length === 1 ? 'Riposo settimanale' : 'Chiuso' });
    return rows;
  }
  function field(label, path, opts) {
    opts = opts || {};
    var v = getPath(S.data, path);
    if (opts.price) v = priceInput(v);
    var tag = opts.area ? '<textarea data-path="' + path + '" rows="' + (opts.rows || 3) + '">' + esc(v == null ? '' : v) + '</textarea>'
      : '<input data-path="' + path + '"' + (opts.price ? ' data-price inputmode="decimal"' : '') + ' type="' + (opts.type || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>';
    return '<label class="fld">' + esc(label) + tag + (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</label>';
  }
  function viewOrari() {
    var i = S.data.info;
    var h = pageHead('Orari e contatti', 'Quello che scrivi qui compare su sito, menu e cartellone.');
    h += '<section class="card"><h2>Giorni di apertura</h2><div class="week">' + DAY_ORDER.map(function (d) {
      var on = i.openDays.indexOf(d) >= 0;
      return '<label class="day' + (on ? ' on' : '') + '"><input type="checkbox" data-act="day" value="' + d + '"' + (on ? ' checked' : '') + '><span>' + cap(AA.DAYS[d]).slice(0, 3) + '</span><small>' + (on ? 'aperto' : 'chiuso') + '</small></label>';
    }).join('') + '</div><div class="two">' + field('Apriamo alle', 'info.openFrom', { type: 'time' }) + field('Chiudiamo alle', 'info.openTo', { type: 'time' }) + '</div>' +
      '<p class="muted">Sul sito apparirà così:</p><dl class="hours-pv">' + (i.hours || []).map(function (r) { return '<div><dt>' + esc(r.days) + '</dt><dd>' + esc(r.time) + '</dd></div>'; }).join('') + '</dl></section>';
    h += '<section class="card"><h2>Contatti</h2>' + '<div class="two">' + field('Telefono per prenotare', 'info.phone', { type: 'tel' }) + field('Cellulare', 'info.mobile', { type: 'tel' }) + '</div>' +
      field('Indirizzo', 'info.address') + field('Email', 'info.email', { type: 'email' }) +
      '<div class="two">' + field('Pagina Facebook', 'info.facebook', { type: 'url' }) + field('Instagram', 'info.instagram', { type: 'url', ph: 'https://instagram.com/…' }) + '</div></section>';
    h += '<section class="card"><h2>In sala</h2><div class="two">' + field('Coperto (€)', 'info.coverCharge', { price: true }) + '<span></span></div>' +
      '<div class="two">' + field('Wi‑Fi: nome rete', 'info.wifi.network') + field('Wi‑Fi: password', 'info.wifi.password') + '</div></section>';
    h += '<section class="card"><h2>Note per i clienti</h2><p class="muted">Prenotazioni, asporto, domicilio… Compaiono in fondo al menu.</p><div class="list">' + (i.notes || []).map(function (n, k) {
      return '<div class="lnote"><input data-list="notes" data-k="' + k + '" data-f="title" value="' + esc(n.title) + '" aria-label="Titolo" placeholder="Titolo">' +
        '<textarea data-list="notes" data-k="' + k + '" data-f="text" rows="3" aria-label="Testo">' + esc(n.text) + '</textarea>' +
        '<button type="button" class="b b-x" data-act="list-del" data-list="notes" data-k="' + k + '" aria-label="Elimina nota">×</button></div>';
    }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="list-add" data-list="notes">+ Aggiungi nota</button></section>';
    h += '<details class="card more"><summary>Testi del menu e dati fiscali</summary>' + field('Legenda dell\'asterisco *', 'info.frozenLegend') + field('Nota sugli allergeni', 'info.allergenNote', { area: true, rows: 2 }) +
      '<div class="two">' + field('Partita IVA', 'info.legal.vat') + field('Codice fiscale', 'info.legal.cf') + '</div>' + field('REA', 'info.legal.rea') + '</details>';
    return h;
  }

  /* ---------- Altro ---------- */
  function extrasList() {
    var s = S.data.sections.filter(function (x) { return x.group === 'aggiunte'; })[0];
    return s ? s.items.map(function (it) { return it.name; }) : [];
  }
  function viewAltro() {
    var t = S.data.settings.totem, demo = S.store.mode === 'demo', b = S.data.settings.builder, ex = extrasList();
    var opts = function (sel) { return '<option value="">+ aggiungi ingrediente</option>' + ex.filter(function (n) { return sel.indexOf(n) < 0; }).map(function (n) { return '<option>' + esc(n) + '</option>'; }).join(''); };
    var h = pageHead('Altro', '');
    h += '<section class="card"><h2>Crea la tua pizza</h2><p class="muted">Le "idee per cominciare" e gli ingredienti "più scelti" che il cliente vede nel menu.</p>' +
      '<h3>Idee per cominciare</h3><div class="ideas">' + b.presets.map(function (p, k) {
        return '<div class="idea" data-k="' + k + '"><div class="idea-h"><input data-idea="name" value="' + esc(p.name) + '" aria-label="Nome dell\'idea"><button type="button" class="b b-x" data-act="idea-del" aria-label="Elimina idea">×</button></div>' +
          '<div class="tagl">' + p.items.map(function (n, j) { return '<span class="tg">' + esc(n) + '<button type="button" data-act="idea-rm" data-j="' + j + '" aria-label="Togli ' + esc(n) + '">×</button></span>'; }).join('') + '</div>' +
          '<select data-act="idea-add" aria-label="Aggiungi ingrediente">' + opts(p.items) + '</select></div>';
      }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="idea-new">+ Nuova idea</button>' +
      '<h3>I più scelti</h3><div class="tagl">' + b.popular.map(function (n, j) { return '<span class="tg">' + esc(n) + '<button type="button" data-act="pop-rm" data-j="' + j + '" aria-label="Togli ' + esc(n) + '">×</button></span>'; }).join('') + '</div>' +
      '<select data-act="pop-add" aria-label="Aggiungi ingrediente">' + opts(b.popular) + '</select></section>';
    h += '<section class="card"><h2>Cartellone in sala</h2>' +
      '<div class="two">' + field('Secondi per pagina', 'settings.totem.pageSeconds', { type: 'number' }) + field('Una novità ogni quante pagine', 'settings.totem.promoEvery', { type: 'number', hint: '0 = mai' }) + '</div>' +
      '<label class="line"><span><b>Schermo touch</b><small>Un tocco sul cartellone apre il menu da sfogliare; dopo 90 secondi senza tocchi si torna al cartellone</small></span><label class="sw"><input type="checkbox" data-ck="settings.totem.touch"' + (t.touch !== false ? ' checked' : '') + '><span></span></label></label>' +
      '<label class="line"><span><b>Foto dei piatti</b></span><label class="sw"><input type="checkbox" data-ck="settings.totem.showPhotos"' + (t.showPhotos !== false ? ' checked' : '') + '><span></span></label></label>' +
      '<label class="line"><span><b>QR per aprire il menu sul telefono</b></span><label class="sw"><input type="checkbox" data-ck="settings.totem.showQr"' + (t.showQr !== false ? ' checked' : '') + '><span></span></label></label>' +
      '<label class="fld">Colori<select data-path="settings.totem.theme"><option value="chiaro"' + (t.theme !== 'scuro' ? ' selected' : '') + '>Chiari, come il sito</option><option value="scuro"' + (t.theme === 'scuro' ? ' selected' : '') + '>Scuri con scintille</option></select></label>' +
      '<div class="btns"><a class="b b-ghost b-sm" href="../totem/" target="_blank" rel="noopener">Apri il cartellone</a><button type="button" class="b b-ghost b-sm" data-act="qr">Stampa i QR per i tavoli</button></div>' +
      '<details class="more-in"><summary>Indirizzo del menu nei QR</summary>' + field('Indirizzo', 'settings.menuUrl', { type: 'url', hint: 'Lascia vuoto per usare quello del sito.' }) + '</details></section>';
    h += '<section class="card"><h2>Cronologia</h2><p class="muted">Ogni pubblicazione viene conservata: puoi ricaricarne una e ripubblicarla.</p>' +
      '<div id="hist"></div><button type="button" class="b b-ghost b-sm" data-act="history"' + (demo ? ' disabled' : '') + '>Mostra le ultime pubblicazioni</button></section>';
    h += '<section class="card"><h2>Copia di sicurezza</h2><p class="muted">Scarica tutto il menu in un file, oppure ricaricalo.</p>' +
      '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="backup">Scarica la copia</button><button type="button" class="b b-ghost b-sm" data-act="restore">Carica una copia</button></div></section>';
    if (!demo) {
      h += '<section class="card"><h2>Accesso</h2><p class="muted">Sei collegato come <b>' + esc(S.user) + '</b>.</p>' +
        '<details class="more-in"><summary>Cambia la tua password</summary><div class="two"><label class="fld">Nuova password<input type="password" id="np1" autocomplete="new-password" minlength="10"></label><label class="fld">Ripeti<input type="password" id="np2" autocomplete="new-password" minlength="10"></label></div>' +
        '<button type="button" class="b b-ghost b-sm" data-act="pass">Cambia password</button></details>' +
        '<details class="more-in"><summary>Persone che possono entrare</summary><ul class="users">' + S.cfg.users.map(function (u) {
          return '<li>' + esc(u.user) + (u.user === S.user ? ' (tu)' : ' <button type="button" class="b b-x" data-act="user-del" data-u="' + esc(u.user) + '" aria-label="Rimuovi">×</button>') + '</li>';
        }).join('') + '</ul><div class="two"><label class="fld">Nuovo utente<input id="nu" autocapitalize="none"></label><label class="fld">Sua password<input type="password" id="nup" autocomplete="new-password" minlength="10"></label></div>' +
        '<button type="button" class="b b-ghost b-sm" data-act="user-add">Aggiungi</button></details></section>';
    }
    h += '<button type="button" class="b b-ghost b-wide" data-act="logout">Esci</button>';
    return h;
  }

  /* ================= Schede di modifica ================= */
  function openSheet(title, html) {
    $('sheetT').textContent = title; $('sheetB').innerHTML = html;
    $('sheet').hidden = false; document.body.classList.add('locked');
    $('sheet').querySelector('.sheet-card').focus();
  }
  function closeSheet() { $('sheet').hidden = true; document.body.classList.remove('locked'); S.ed = null; render(); }
  function chips(list, selected, attr) {
    return '<div class="chips">' + list.map(function (x) {
      var on = selected.indexOf(x.code) >= 0;
      return '<button type="button" class="chip" ' + attr + '="' + x.code + '" aria-pressed="' + on + '">' + (x.n ? '<i>' + x.n + '</i>' : '') + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }
  /* anteprima come nel menu dei clienti */
  function itemPreview(it, sec) {
    var price = it.prices && it.prices.length ? AA.itemPriceHTML(it, '') : (it.price == null || it.price === '' ? '<span class="tbc">Prezzo da confermare</span>' : (sec.deltaPrices ? (Number(it.price) === 0 ? 'Compreso' : AA.price(it.price, { signed: true })) : AA.price(it.price)));
    var tags = (it.featured ? '<span class="tag tag-pref">Preferita</span>' : '') + (it.tags || []).map(function (t) { var d = AA.TAG_BY_CODE[t]; return d ? '<span class="tag">' + esc(d.short) + '</span>' : ''; }).join('');
    var algs = AA.allergenNums(it.allergens).map(function (a) { return '<span class="alg">' + a.n + '</span>'; }).join('');
    return '<div class="pv"><p class="pv-lbl">Così lo vedono i clienti</p><div class="pv-item' + (it.available === false ? ' is-off' : '') + '"><div class="pv-main"><p class="pv-n">' + esc(it.name || 'Nome del piatto') + (it.frozen ? '<span class="frz">*</span>' : '') + '</p>' +
      (it.desc ? '<p class="pv-d">' + esc(it.desc) + '</p>' : '') + (tags || algs ? '<p class="pv-m">' + tags + algs + '</p>' : '') + '<p class="pv-pr">' + price + '</p></div>' +
      (it.image ? '<img alt="" src="' + esc(AA.src(it.image)) + '">' : '') + '</div>' + (it.available === false ? '<p class="pv-off">Esaurito: ora i clienti non lo vedono.</p>' : '') + '</div>';
  }
  function itemEditor() {
    var sec = findSec(S.ed.sec), it = findItem(S.ed.sec, S.ed.item);
    var multi = it.prices && it.prices.length;
    var h = '<div id="pvBox">' + itemPreview(it, sec) + '</div>';
    h += '<div class="ph-edit">' + thumb(it.image, 'ph-big') + '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="img-up">' + (it.image ? 'Cambia foto' : 'Aggiungi una foto') + '</button>' +
      (it.image ? '<button type="button" class="b b-ghost b-sm" data-act="img-del">Togli foto</button>' : '') + '</div></div>';
    h += '<label class="fld">Nome<input data-f="name" value="' + esc(it.name) + '" placeholder="es. Margherita"></label>';
    h += '<label class="fld">Ingredienti<textarea data-f="desc" rows="3" placeholder="es. pomodoro, mozzarella, basilico">' + esc(it.desc) + '</textarea></label>';
    h += '<fieldset class="fld"><legend>Prezzo</legend>';
    if (multi) {
      h += '<div class="list">' + it.prices.map(function (p, k) {
        return '<div class="lrow"><input data-pf="label" data-k="' + k + '" value="' + esc(p.label) + '" placeholder="es. Piccola" aria-label="Formato">' +
          '<label class="row-price">€<input inputmode="decimal" data-pf="price" data-k="' + k + '" value="' + priceInput(p.price) + '" aria-label="Prezzo"></label>' +
          '<button type="button" class="b b-x" data-act="pf-del" data-k="' + k + '" aria-label="Togli formato">×</button></div>';
      }).join('') + '</div><div class="btns"><button type="button" class="b b-ghost b-sm" data-act="pf-add">+ Altro formato</button><button type="button" class="b b-ghost b-sm" data-act="pmode" data-v="1">Torna a prezzo unico</button></div>';
    } else {
      h += '<label class="row-price big">€<input inputmode="decimal" data-f="price" value="' + priceInput(it.price) + '" placeholder="vuoto = da confermare"></label>';
      if (sec.deltaPrices) h += '<small class="muted">Qui il prezzo è un supplemento sulla pizza (es. 2,00 = + € 2,00).</small>';
      h += '<button type="button" class="b b-link" data-act="pmode" data-v="n">Ha più formati? (es. piccola e grande)</button>';
    }
    h += '</fieldset>';
    h += '<label class="line"><span><b>Disponibile</b><small>Spento = esaurito, non compare</small></span><label class="sw"><input type="checkbox" data-fb="available"' + (it.available !== false ? ' checked' : '') + '><span></span></label></label>';
    h += '<label class="line"><span><b>Tra le preferite</b><small>Segnata nel menu e mostrata in home</small></span><label class="sw"><input type="checkbox" data-fb="featured"' + (it.featured ? ' checked' : '') + '><span></span></label></label>';
    h += '<div class="fld"><span>Caratteristiche</span>' + chips(AA.TAGS.filter(function (t) { return t.code !== 'della-casa'; }), it.tags || [], 'data-tag') + '</div>';
    var na = (it.allergens || []).length;
    h += '<details class="more-in"' + (na ? '' : ' open') + '><summary>Allergeni' + (na ? ' (' + na + ')' : '') + '</summary>' + chips(AA.ALLERGENS, it.allergens || [], 'data-alg') + '</details>';
    h += '<details class="more-in"><summary>Altre opzioni</summary>' +
      '<label class="fld">Nota breve<input data-f="note" value="' + esc(it.note) + '" placeholder="es. Disponibile anche senza glutine"></label>' +
      '<label class="line"><span><b>Prodotto surgelato</b><small>Mostra l\'asterisco *</small></span><label class="sw"><input type="checkbox" data-fb="frozen"' + (it.frozen ? ' checked' : '') + '><span></span></label></label>' +
      '<label class="fld">Sottocategoria<select data-act="move-sec">' + S.data.groups.map(function (g) {
        var o = S.data.sections.filter(function (s) { return s.group === g.id; }).map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (s.id === sec.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
        return o ? '<optgroup label="' + esc(g.name) + '">' + o + '</optgroup>' : '';
      }).join('') + '</select></label>' +
      '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="down">Sposta giù</button>' +
      '<button type="button" class="b b-ghost b-sm" data-act="dup">Duplica</button><button type="button" class="b b-danger b-sm" data-act="del-item">Elimina</button></div></details>';
    return h;
  }
  function secEditor() {
    var sec = findSec(S.ed.sec);
    var h = '<label class="fld">Nome<input data-s="name" value="' + esc(sec.name) + '"></label>' +
      '<label class="fld">Sottotitolo<input data-s="subtitle" value="' + esc(sec.subtitle) + '" placeholder="es. Fritti o al forno"></label>' +
      '<label class="fld">Nota (es. "Non disponibili il sabato")<textarea data-s="note" rows="2">' + esc(sec.note) + '</textarea></label>';
    h += '<label class="line"><span><b>Visibile</b><small>Spenta = nascosta ovunque</small></span><label class="sw"><input type="checkbox" data-sb="visible"' + (sec.visible !== false ? ' checked' : '') + '><span></span></label></label>';
    h += '<label class="line"><span><b>Sul cartellone in sala</b></span><label class="sw"><input type="checkbox" data-sb="totem"' + (sec.totem !== false ? ' checked' : '') + '><span></span></label></label>';
    h += '<fieldset class="fld"><legend>Varianti con prezzo (es. Pizzella −1,00, Senza lattosio +1,50)</legend><div class="list">' + (sec.supplements || []).map(function (s, k) {
      return '<div class="lrow"><input data-sup="label" data-k="' + k + '" value="' + esc(s.label) + '" aria-label="Variante">' +
        '<label class="row-price">€<input inputmode="decimal" data-sup="price" data-k="' + k + '" value="' + priceInput(s.price) + '" aria-label="Differenza di prezzo"></label>' +
        '<button type="button" class="b b-x" data-act="sup-del" data-k="' + k + '" aria-label="Togli">×</button></div>';
    }).join('') + '</div><button type="button" class="b b-ghost b-sm" data-act="sup-add">+ Aggiungi variante</button></fieldset>';
    h += '<details class="more-in"><summary>Altre opzioni</summary>' +
      '<label class="fld">Aspetto<select data-s="layout"><option value="list"' + (sec.layout === 'list' ? ' selected' : '') + '>Lista di piatti</option><option value="cards"' + (sec.layout === 'cards' ? ' selected' : '') + '>Schede con foto (come gli impasti)</option><option value="chips"' + (sec.layout === 'chips' ? ' selected' : '') + '>Compatto per prezzo (come le aggiunte)</option></select></label>' +
      '<label class="line"><span><b>I prezzi sono supplementi</b><small>Mostrati come + € …</small></span><label class="sw"><input type="checkbox" data-sb="deltaPrices"' + (sec.deltaPrices ? ' checked' : '') + '><span></span></label></label>' +
      '<label class="fld">Categoria<select data-s="group">' + S.data.groups.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === sec.group ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="sec-up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="sec-down">Sposta giù</button><button type="button" class="b b-danger b-sm" data-act="del-sec">Elimina sottocategoria</button></div></details>';
    return h;
  }
  function groupEditor() {
    var g = S.data.groups.filter(function (x) { return x.id === S.ed.group; })[0];
    return '<label class="fld">Nome della categoria<input data-g="name" value="' + esc(g.name) + '"></label>' +
      '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="grp-up">Sposta su</button><button type="button" class="b b-ghost b-sm" data-act="grp-down">Sposta giù</button><button type="button" class="b b-danger b-sm" data-act="del-group">Elimina categoria</button></div>';
  }
  function promoEditor() {
    var p = S.data.promos[S.ed.promo];
    var h = '<div id="pvBox"><p class="pv-lbl">Così la vedono i clienti</p>' + promoCard(p) + '</div>';
    h += '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="img-up">' + (p.image ? 'Cambia foto' : 'Aggiungi una foto') + '</button>' +
      (p.image ? '<button type="button" class="b b-ghost b-sm" data-act="img-del">Togli foto</button>' : '') + '</div>';
    h += '<label class="fld">Titolo<input data-p="title" value="' + esc(p.title) + '" placeholder="es. Pomodoro nickel free"></label>';
    h += '<label class="fld">Etichetta piccola<input data-p="kicker" value="' + esc(p.kicker) + '" placeholder="es. Novità, Da provare"></label>';
    h += '<label class="fld">Testo<textarea data-p="text" rows="3">' + esc(p.text) + '</textarea></label>';
    h += '<label class="fld">Prezzo<input data-p="price" value="' + esc(p.price) + '" placeholder="es. € 9,00 oppure + € 3,00"></label>';
    h += '<label class="line"><span><b>Attiva</b></span><label class="sw"><input type="checkbox" data-pb="active"' + (p.active ? ' checked' : '') + '><span></span></label></label>';
    h += '<div class="fld"><span>Dove mostrarla</span><div class="chips">' + [['site', 'Sito'], ['menu', 'Menu'], ['totem', 'Cartellone']].map(function (w) {
      return '<button type="button" class="chip" data-where="' + w[0] + '" aria-pressed="' + !!p[w[0]] + '">' + w[1] + '</button>';
    }).join('') + '</div></div>';
    h += '<div class="two"><label class="fld">Dal<input type="date" data-p="from" value="' + esc(p.from) + '"></label><label class="fld">Al<input type="date" data-p="until" value="' + esc(p.until) + '"></label></div><small class="muted">Date facoltative: fuori da queste date non compare.</small>';
    h += '<div class="btns"><button type="button" class="b b-ghost b-sm" data-act="promo-up">Sposta prima</button><button type="button" class="b b-ghost b-sm" data-act="promo-down">Sposta dopo</button><button type="button" class="b b-danger b-sm" data-act="del-promo">Elimina</button></div>';
    return h;
  }
  function refreshEditor() {
    var b = $('sheetB'), top = b.scrollTop;
    if (!S.ed) return;
    if (S.ed.type === 'item') b.innerHTML = itemEditor();
    else if (S.ed.type === 'sec') b.innerHTML = secEditor();
    else if (S.ed.type === 'group') b.innerHTML = groupEditor();
    else if (S.ed.type === 'promo') b.innerHTML = promoEditor();
    else if (S.ed.type === 'changes') b.innerHTML = changesEditor();
    b.scrollTop = top;
  }
  function refreshPreview() {
    var box = $('pvBox'); if (!box || !S.ed) return;
    if (S.ed.type === 'item') box.innerHTML = itemPreview(findItem(S.ed.sec, S.ed.item), findSec(S.ed.sec));
    if (S.ed.type === 'promo') box.innerHTML = '<p class="pv-lbl">Così la vedono i clienti</p>' + promoCard(S.data.promos[S.ed.promo]);
  }

  /* ================= Eventi ================= */
  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    S.tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });
  $('pub').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'publish') publish();
    if (a.dataset.act === 'preview') preview();
    if (a.dataset.act === 'changes') openChanges();
  });
  function preview() {
    saveDraft();
    window.open('../menu/?anteprima', '_blank');
  }

  var view = $('view');
  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { S.q = t.value; clearTimeout(view._qt); view._qt = setTimeout(render, 220); return; }
    if (t.id === 'oq') { S.oq = t.value; clearTimeout(view._qt); view._qt = setTimeout(render, 200); return; }
    if (t.dataset.idea === 'name') { S.data.settings.builder.presets[Number(t.closest('.idea').dataset.k)].name = t.value; changed(); return; }
    if (t.dataset.path) {
      var v = t.value;
      if (t.hasAttribute('data-price')) { v = parsePrice(v); if (v === undefined) return; }
      else if (t.type === 'number') v = t.value === '' ? null : Number(t.value);
      setPath(S.data, t.dataset.path, v);
      if (/^info\.open(From|To)$/.test(t.dataset.path)) { S.data.info.hours = hoursFromWeek(S.data.info); }
      changed(); return;
    }
    if (t.dataset.list) { S.data.info[t.dataset.list][Number(t.dataset.k)][t.dataset.f] = t.value; changed(); }
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
      it2.available = t.checked; changed(); render(); toast(t.checked ? it2.name + ': di nuovo disponibile' : it2.name + ': esaurito', 1800); return;
    }
    if (t.dataset.act === 'promo-active') {
      var i = Number(t.closest('[data-promo]').dataset.promo);
      S.data.promos[i].active = t.checked; changed(); render(); return;
    }
    if (t.dataset.act === 'closed-today') {
      S.data.info.closedOn = t.checked ? AA.todayISO() : ''; changed(); render(); return;
    }
    if (t.dataset.act === 'day') {
      var d = Number(t.value), days = S.data.info.openDays, k = days.indexOf(d);
      if (t.checked && k < 0) days.push(d); if (!t.checked && k >= 0) days.splice(k, 1);
      S.data.info.hours = hoursFromWeek(S.data.info); changed(); render(); return;
    }
    if (t.dataset.act === 'idea-add' && t.value) {
      S.data.settings.builder.presets[Number(t.closest('.idea').dataset.k)].items.push(t.value); changed(); render(); return;
    }
    if (t.dataset.act === 'pop-add' && t.value) { S.data.settings.builder.popular.push(t.value); changed(); render(); return; }
    if (t.dataset.ck) { setPath(S.data, t.dataset.ck, t.checked); changed(); return; }
    if (t.tagName === 'SELECT' && t.dataset.path) { setPath(S.data, t.dataset.path, t.value); changed(); }
  });
  view.addEventListener('click', async function (e) {
    var go = e.target.closest('[data-go]');
    if (go) { S.tab = go.dataset.go; render(); window.scrollTo(0, 0); return; }
    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.dataset.act, row = a.closest('.row'), secEl = a.closest('[data-sec]'), li = a.closest('li[data-item]');
    if (act === 'toggle-sec' && secEl) {
      S.open[secEl.dataset.sec] = !S.open[secEl.dataset.sec]; render();
    } else if (act === 'edit-item' && row) {
      S.ed = { type: 'item', sec: row.dataset.sec, item: row.dataset.item };
      openSheet('Piatto', itemEditor());
    } else if ((act === 'back-on' || act === 'set-off') && li) {
      var x = findItem(li.dataset.sec, li.dataset.item);
      x.available = act === 'back-on'; if (act === 'set-off') S.oq = '';
      changed(); render(); toast(x.name + (act === 'back-on' ? ': di nuovo disponibile' : ': esaurito'), 1800);
    } else if (act === 'all-on') {
      allItems().forEach(function (y) { if (y.it.available === false) y.it.available = true; }); changed(); render();
    } else if (act === 'edit-sec' && secEl) {
      S.ed = { type: 'sec', sec: secEl.dataset.sec };
      openSheet('Sottocategoria', secEditor());
    } else if (act === 'add-item' && secEl) {
      var sec = findSec(secEl.dataset.sec);
      var it = { id: uid('i'), name: '', desc: '', price: null, prices: [], note: '', tags: [], allergens: [], image: '', frozen: false, available: true, featured: false };
      sec.items.push(it); S.open[sec.id] = true; changed();
      S.ed = { type: 'item', sec: sec.id, item: it.id, isNew: true };
      openSheet('Nuovo piatto', itemEditor());
      setTimeout(function () { var n = document.querySelector('#sheetB [data-f="name"]'); if (n) n.focus(); }, 60);
    } else if (act === 'edit-group') {
      S.ed = { type: 'group', group: a.dataset.g }; openSheet('Categoria', groupEditor());
    } else if (act === 'add-sec') {
      var ns = { id: uid('s'), group: a.dataset.g, name: 'Nuova sottocategoria', subtitle: '', note: '', supplements: [], layout: 'list', deltaPrices: false, visible: true, totem: true, items: [] };
      var last = -1;
      S.data.sections.forEach(function (s, k) { if (s.group === a.dataset.g) last = k; });
      S.data.sections.splice(last + 1, 0, ns); S.open[ns.id] = true; changed();
      S.ed = { type: 'sec', sec: ns.id }; openSheet('Nuova sottocategoria', secEditor());
    } else if (act === 'add-group') {
      var ng = { id: uid('g'), name: 'Nuova categoria', icon: '' };
      S.data.groups.push(ng); changed();
      S.ed = { type: 'group', group: ng.id }; openSheet('Nuova categoria', groupEditor());
    } else if (act === 'edit-promo') {
      S.ed = { type: 'promo', promo: Number(a.closest('[data-promo]').dataset.promo) }; openSheet('Novità', promoEditor());
    } else if (act === 'add-promo') {
      S.data.promos.unshift({ id: uid('p'), active: true, title: '', kicker: 'Novità', text: '', price: '', image: '', from: '', until: '', totem: true, menu: true, site: true });
      changed(); S.ed = { type: 'promo', promo: 0 }; openSheet('Nuova novità', promoEditor());
    } else if (act === 'list-add') {
      S.data.info[a.dataset.list].push({ title: '', text: '' }); changed(); render();
    } else if (act === 'list-del') {
      S.data.info[a.dataset.list].splice(Number(a.dataset.k), 1); changed(); render();
    } else if (act === 'idea-del') {
      S.data.settings.builder.presets.splice(Number(a.closest('.idea').dataset.k), 1); changed(); render();
    } else if (act === 'idea-rm') {
      S.data.settings.builder.presets[Number(a.closest('.idea').dataset.k)].items.splice(Number(a.dataset.j), 1); changed(); render();
    } else if (act === 'idea-new') {
      S.data.settings.builder.presets.push({ name: 'Nuova idea', items: [] }); changed(); render();
    } else if (act === 'pop-rm') {
      S.data.settings.builder.popular.splice(Number(a.dataset.j), 1); changed(); render();
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
    changed(); refreshPreview();
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
    changed(); refreshPreview();
  });
  sheetB.addEventListener('click', async function (e) {
    var a = e.target.closest('[data-act], [data-tag], [data-alg], [data-where]');
    if (!a || !S.ed) return;
    if (S.ed.type === 'changes') {
      if (a.dataset.act === 'revert') revertOne(Number(a.dataset.k));
      if (a.dataset.act === 'revert-all') revertAll();
      if (a.dataset.act === 'publish-now') publish();
      return;
    }
    var ed = S.ed, it = ed.type === 'item' ? findItem(ed.sec, ed.item) : null, sec = ed.sec ? findSec(ed.sec) : null;
    if (a.dataset.where) {
      var pr = S.data.promos[ed.promo]; pr[a.dataset.where] = !pr[a.dataset.where];
      a.setAttribute('aria-pressed', pr[a.dataset.where]); changed(); return;
    }
    if (a.dataset.tag || a.dataset.alg) {
      var list = a.dataset.tag ? (it.tags = it.tags || []) : (it.allergens = it.allergens || []);
      var v = a.dataset.tag || a.dataset.alg, k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      a.setAttribute('aria-pressed', k < 0); changed(); refreshPreview(); return;
    }
    var act = a.dataset.act;
    if (act === 'img-up') {
      var target = ed.type === 'promo' ? S.data.promos[ed.promo] : it;
      if (await uploadInto(target, target.name || target.title)) refreshEditor();
    } else if (act === 'img-del') {
      var tgt = ed.type === 'promo' ? S.data.promos[ed.promo] : it;
      tgt.image = ''; delete tgt.cutout; changed(); refreshEditor();
    } else if (act === 'pmode') {
      if (a.dataset.v === 'n' && !(it.prices && it.prices.length)) it.prices = [{ label: 'Piccola', price: it.price }, { label: 'Grande', price: null }];
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
      if (await ask('Eliminare "' + (it.name || 'piatto') + '"?', 'Se è solo finito, meglio spegnere "Disponibile": così lo rimetti con un tocco.', 'Elimina', { danger: true })) {
        sec.items.splice(sec.items.indexOf(it), 1); changed(); closeSheet();
      }
    } else if (act === 'sup-add') { sec.supplements = sec.supplements || []; sec.supplements.push({ label: '', price: 0 }); changed(); refreshEditor(); }
    else if (act === 'sup-del') { sec.supplements.splice(Number(a.dataset.k), 1); changed(); refreshEditor(); }
    else if (act === 'sec-up' || act === 'sec-down') {
      var arr = S.data.sections, idx = arr.indexOf(sec), step = act === 'sec-up' ? -1 : 1, j = idx + step;
      while (j >= 0 && j < arr.length && arr[j].group !== sec.group) j += step;
      if (j >= 0 && j < arr.length) { arr.splice(idx, 1); arr.splice(j, 0, sec); changed(); toast('Spostata', 1200); }
    } else if (act === 'del-sec') {
      if (await ask('Eliminare "' + sec.name + '"?', 'Verranno eliminati anche i suoi ' + sec.items.length + ' piatti. Per nasconderla e basta, spegni "Visibile".', 'Elimina', { danger: true })) {
        S.data.sections.splice(S.data.sections.indexOf(sec), 1); changed(); closeSheet();
      }
    } else if (act === 'grp-up' || act === 'grp-down') {
      var gi = S.data.groups.findIndex(function (g) { return g.id === ed.group; });
      if (move(S.data.groups, gi, act === 'grp-up' ? -1 : 1)) { changed(); toast('Spostata', 1200); }
    } else if (act === 'del-group') {
      var n = S.data.sections.filter(function (s) { return s.group === ed.group; }).length;
      if (n) { toast('Contiene ' + n + ' sottocategorie: spostale o eliminale prima.'); return; }
      S.data.groups = S.data.groups.filter(function (g) { return g.id !== ed.group; }); changed(); closeSheet();
    } else if (act === 'promo-up' || act === 'promo-down') {
      if (move(S.data.promos, ed.promo, act === 'promo-up' ? -1 : 1)) { ed.promo += act === 'promo-up' ? -1 : 1; changed(); toast('Spostata', 1200); }
    } else if (act === 'del-promo') {
      if (await ask('Eliminare questa novità?', 'Per toglierla solo per un po\', spegni "Attiva".', 'Elimina', { danger: true })) {
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
      S.data = JSON.parse(f.text); ensureShape(S.data); changed(); S.tab = 'oggi'; render();
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
