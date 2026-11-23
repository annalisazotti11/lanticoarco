/* Menu sul totem touch in sala (menu/?totem).
   Caratteri più grandi, nessun link che porta fuori dal menu, QR per portarlo sul telefono,
   pulsante "Inizio"; dopo un po' senza tocchi torna al cartellone, che riparte da zero. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  if (!params.has('totem')) return;
  var AA = window.AA, root = document.documentElement;
  var IDLE = (Number(params.get('attesa')) || 90) * 1000;
  root.classList.add('kiosk');

  // niente zoom con due dita: il totem ha già i caratteri grandi
  var vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');

  // su uno schermo grande il menu si ingrandisce tutto insieme, come un grande telefono
  function scale() {
    var z = window.innerWidth >= 760 ? Math.min(1.9, Math.max(1, window.innerWidth / 640)) : 1; // un po' più grande per chi sta in piedi
    root.style.zoom = z === 1 ? '' : z.toFixed(3);
    // la pagina è larga quanto lo schermo diviso l'ingrandimento: così, ingrandita, lo riempie senza uscire
    root.style.width = z === 1 ? '' : (window.innerWidth / z).toFixed(1) + 'px';
  }
  scale();
  window.addEventListener('resize', scale);

  // i link che porterebbero fuori dal menu (sito, privacy, telefono, mappe) non si aprono
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h.charAt(0) === '#' || a.hasAttribute('data-open-builder')) return;
    e.preventDefault();
    if (a.classList.contains('top-logo')) toTop();
  }, true);
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function toTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // "Inizio" riporta sempre allo schermo con le categorie; la freccia torna in cima, e compare scorrendo
  var home = document.createElement('button');
  home.type = 'button'; home.className = 'k-home';
  home.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Inizio';
  home.onclick = function () { location.href = '../totem/'; };
  document.body.appendChild(home);
  var up = document.createElement('button');
  up.type = 'button'; up.className = 'k-up'; up.hidden = true; up.setAttribute('aria-label', 'Torna su');
  up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  up.onclick = toTop;
  document.body.appendChild(up);
  window.addEventListener('scroll', function () { up.hidden = window.scrollY < 500; }, { passive: true });

  // QR: il menu sul proprio telefono
  function addQr(data) {
    var intro = document.querySelector('.intro');
    if (!intro || !window.qrcode || document.querySelector('.k-qr')) return;
    var url = (data && data.settings && data.settings.menuUrl) || new URL('../menu/', location.href).href;
    var box = document.createElement('div');
    box.className = 'k-qr';
    box.innerHTML = '<div class="k-qr-code">' + AA.qrSVG(url, { margin: 1 }) + '</div><p><b>Il menu sul tuo telefono</b>Inquadra il codice con la fotocamera.</p>';
    intro.appendChild(box);
  }
  AA.loadMenu().then(addQr).catch(function () { addQr(null); });

  // dopo un po' senza tocchi torna al cartellone
  var t = null;
  function wake() { clearTimeout(t); t = setTimeout(function () { location.href = '../totem/'; }, IDLE); }
  ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll', 'input'].forEach(function (ev) { window.addEventListener(ev, wake, { passive: true, capture: true }); });
  wake();

  // schermo sempre acceso
  function keepAwake() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').catch(function () {});
  }
  document.addEventListener('visibilitychange', keepAwake);
  keepAwake();
})();
