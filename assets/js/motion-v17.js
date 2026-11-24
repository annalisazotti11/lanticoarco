/* Progressive decoration. Nothing depends on motion to render or navigate. */
(function () {
  'use strict';
  var root = document.documentElement;
  var site = document.querySelector('.site-v17');
  var menu = root.classList.contains('menu-v8');
  if (!site && !menu) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (site) {
    var progress = document.createElement('div');
    progress.className = 'aa-motion-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);
    var queued = false;
    function paintProgress() {
      queued = false;
      var scroller = document.scrollingElement || root;
      var max = Math.max(1, scroller.scrollHeight - window.innerHeight);
      var p = Math.max(0, Math.min(1, scroller.scrollTop / max));
      progress.style.setProperty('--aa-progress', p.toFixed(4));
    }
    function queueProgress() {
      if (!queued) { queued = true; requestAnimationFrame(paintProgress); }
    }
    window.addEventListener('scroll', queueProgress, { passive: true });
    window.addEventListener('resize', queueProgress, { passive: true });
    window.addEventListener('load', queueProgress, { once: true });
    if ('ResizeObserver' in window) new ResizeObserver(queueProgress).observe(site);
    queueProgress();

    // Change photographs in the existing gallery without replacing its controls.
    var gallery = site.querySelector('.v16-dialog');
    if (gallery && 'MutationObserver' in window) {
      var photo = gallery.querySelector('img');
      if (photo) new MutationObserver(function () {
        if (!gallery.open || reduce.matches) return;
        photo.classList.remove('aa-photo-change');
        void photo.offsetWidth;
        photo.classList.add('aa-photo-change');
      }).observe(photo, { attributes: true, attributeFilter: ['src'] });
    }
  }

  // A subtle light follows the pointer on the large promotional images.
  // Only on precise pointers; never spend resources tracking a finger or kiosk.
  if (fine.matches && !reduce.matches && !root.classList.contains('kiosk')) {
    var target = null, x = 0, y = 0, pointerFrame = 0;
    document.addEventListener('pointermove', function (event) {
      if (reduce.matches || !fine.matches || !event.target.closest) return;
      var card = event.target.closest('.site-v17 .v16-photo button,html.menu-v8 .ex-special .ex-feature');
      if (!card) return;
      target = card; x = event.clientX; y = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(function () {
        pointerFrame = 0;
        if (!target || !target.isConnected) return;
        var r = target.getBoundingClientRect();
        if (!r.width || !r.height) return;
        target.style.setProperty('--aa-x', ((x - r.left) / r.width * 100).toFixed(1) + '%');
        target.style.setProperty('--aa-y', ((y - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  if (!('IntersectionObserver' in window) || reduce.matches) return;
  var watched = new Set();
  var seen = new WeakSet();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      observer.unobserve(el);
      watched.delete(el);
      // Search results remain immediate during typing.
      if (reduce.matches || (menu && document.activeElement && document.activeElement.matches('input,textarea'))) return;
      el.classList.add('aa-enter');
    });
  }, { threshold: .12 });

  // The menu is generated from data and may be rebuilt when a category or filter changes.
  // Avoid observing every dish on the touchscreen and do not change layout or visibility.
  var scope = menu ? [document.getElementById('menuExplore'), document.getElementById('contenuto')] : [document.getElementById('album'), site.querySelector('.vi-cta')];
  var selector = menu ? '.ex-card,.ex-build,.acc-h,.sec-h,.items>.item:nth-child(-n+6)>.item-btn' : '.v16-social-links a,.social-latest-card,.vi-cta .btn';
  var refreshQueued = false;
  function refresh() {
    refreshQueued = false;
    watched.forEach(function (el) { if (!el.isConnected) { observer.unobserve(el); watched.delete(el); } });
    scope.forEach(function (container) {
      if (!container) return;
      Array.prototype.forEach.call(container.querySelectorAll(selector), function (el, index) {
        if (seen.has(el)) return;
        seen.add(el);
        el.style.setProperty('--aa-delay', Math.min(index % 6 * 24, 120) + 'ms');
        watched.add(el);
        observer.observe(el);
      });
    });
  }
  function scheduleRefresh() {
    if (!refreshQueued) { refreshQueued = true; requestAnimationFrame(refresh); }
  }
  if ('MutationObserver' in window) {
    var changes = new MutationObserver(scheduleRefresh);
    scope.forEach(function (container) { if (container) changes.observe(container, { childList: true, subtree: true }); });
  }
  scheduleRefresh();
})();
