/* Archiviazione del gestionale: GitHub (pubblicazione reale) oppure prova locale.
   La chiave GitHub è salvata in gestione/config.json cifrata con la password (PBKDF2 + AES-GCM). */
(function (global) {
  'use strict';
  var te = new TextEncoder(), td = new TextDecoder();

  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function textToB64(t) { return bytesToB64(te.encode(t)); }
  function b64ToText(b) { return td.decode(b64ToBytes(b)); }
  function rand(n) { var u = new Uint8Array(n); crypto.getRandomValues(u); return u; }

  /* ---------- Cifratura della chiave ---------- */
  var ITER = 310000;
  function deriveKey(password, salt, iter) {
    return crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function encryptSecret(secret, password) {
    var salt = rand(16), iv = rand(12);
    return deriveKey(password, salt, ITER).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, te.encode(secret));
    }).then(function (ct) {
      return { salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)), iter: ITER };
    });
  }
  function decryptSecret(entry, password) {
    return deriveKey(password, b64ToBytes(entry.salt), entry.iter || ITER).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(entry.iv) }, key, b64ToBytes(entry.data));
    }).then(function (pt) { return td.decode(pt); }, function () { throw new Error('password'); });
  }

  /* ---------- GitHub ---------- */
  function GitHubStore(cfg, token) {
    this.owner = cfg.owner; this.repo = cfg.repo; this.branch = cfg.branch || 'main'; this.token = token;
    this.mode = 'github';
  }
  GitHubStore.prototype.api = function (path, opts) {
    opts = opts || {};
    var url = path.indexOf('https://') === 0 ? path : 'https://api.github.com/repos/' + this.owner + '/' + this.repo + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Accept': opts.accept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error((j && j.message) || ('HTTP ' + r.status));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  };
  GitHubStore.prototype.checkAccess = function () {
    return this.api('').then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) {
        var e = new Error('La chiave non ha il permesso di scrittura su questo repository.');
        e.status = 403; throw e;
      }
      return repo;
    });
  };
  GitHubStore.prototype.readFile = function (path, ref) {
    var self = this;
    return this.api('/contents/' + path + '?ref=' + encodeURIComponent(ref || this.branch)).then(function (j) {
      if (j.content) return { text: b64ToText(j.content), sha: j.sha };
      return self.api('/git/blobs/' + j.sha).then(function (b) { return { text: b64ToText(b.content), sha: j.sha }; });
    });
  };
  GitHubStore.prototype.fileSha = function (path) {
    return this.api('/contents/' + path + '?ref=' + encodeURIComponent(this.branch)).then(function (j) { return j.sha; },
      function (e) { if (e.status === 404) return null; throw e; });
  };
  /* Un unico commit con più file: files = [{path, text}|{path, base64}] */
  GitHubStore.prototype.commitFiles = function (files, message) {
    var self = this, headSha, baseTree, blobShas = {};
    return this.api('/git/ref/heads/' + this.branch).then(function (ref) {
      headSha = ref.object.sha;
      return self.api('/git/commits/' + headSha);
    }).then(function (c) {
      baseTree = c.tree.sha;
      return Promise.all(files.map(function (f) {
        var content = f.base64 != null ? f.base64 : textToB64(f.text);
        return self.api('/git/blobs', { method: 'POST', body: { content: content, encoding: 'base64' } }).then(function (b) {
          blobShas[f.path] = b.sha;
          return { path: f.path, mode: '100644', type: 'blob', sha: b.sha };
        });
      }));
    }).then(function (tree) {
      return self.api('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } });
    }).then(function (t) {
      return self.api('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [headSha] } });
    }).then(function (c) {
      return self.api('/git/refs/heads/' + self.branch, { method: 'PATCH', body: { sha: c.sha } }).then(function () {
        return { commit: c.sha, blobs: blobShas };
      });
    });
  };
  GitHubStore.prototype.history = function (path, n) {
    return this.api('/commits?path=' + encodeURIComponent(path) + '&sha=' + encodeURIComponent(this.branch) + '&per_page=' + (n || 20))
      .then(function (list) {
        return list.map(function (c) { return { sha: c.sha, date: c.commit.author.date, message: c.commit.message }; });
      });
  };

  /* ---------- Prova locale (nessuna pubblicazione) ---------- */
  function DemoStore() { this.mode = 'demo'; }
  DemoStore.prototype.checkAccess = function () { return Promise.resolve({}); };
  DemoStore.prototype.readFile = function (path) {
    var saved = null;
    try { saved = localStorage.getItem('aa-demo:' + path); } catch (e) {}
    if (saved) return Promise.resolve({ text: saved, sha: 'demo-' + saved.length });
    return fetch('../' + path + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.text();
    }).then(function (t) { return { text: t, sha: 'demo-' + t.length }; });
  };
  DemoStore.prototype.fileSha = function (path) { return this.readFile(path).then(function (f) { return f.sha; }, function () { return null; }); };
  DemoStore.prototype.commitFiles = function (files) {
    var blobs = {};
    files.forEach(function (f) {
      if (f.text != null) { try { localStorage.setItem('aa-demo:' + f.path, f.text); } catch (e) {} blobs[f.path] = 'demo-' + f.text.length; }
    });
    return Promise.resolve({ commit: 'demo', blobs: blobs });
  };
  DemoStore.prototype.history = function () { return Promise.resolve([]); };

  global.AAStore = {
    GitHubStore: GitHubStore, DemoStore: DemoStore,
    encryptSecret: encryptSecret, decryptSecret: decryptSecret,
    textToB64: textToB64, b64ToText: b64ToText
  };
})(window);
