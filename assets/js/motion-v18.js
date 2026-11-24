/* One-shot cinematic entrances for the public site. No content depends on JS or motion. */
(function () {
  'use strict';
  var site = document.querySelector('.site-v18');
  if (!site || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('v18-arrived');
      observer.unobserve(entry.target);
    });
  }, { threshold: .18 });
  site.querySelectorAll('.v16-photo button,.v16-album-head,.v16-social,.pr-partners li').forEach(function (el, i) {
    el.style.setProperty('--v18-delay', Math.min(i % 4 * 75, 225) + 'ms');
    observer.observe(el);
  });
})();
