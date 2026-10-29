/* =========================================================
   Composant « Reveal » — apparitions à l'entrée dans l'écran
   Ajoute .is-in aux éléments [data-reveal="up|fade|clip|scale|line|vline|wipe|card|xcard|quote"].
   Toutes les transitions sont en CSS (transform / opacity / clip-path) : aucun calcul JS au scroll.
   Décalage automatique entre éléments frères (--d), réglable avec data-reveal-stagger (ms) sur le parent.
   ========================================================= */
(() => {
  'use strict';
  const els = Array.from(document.querySelectorAll('[data-reveal]'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // stagger entre frères
  const groups = new Map();
  els.forEach((el) => {
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  groups.forEach((list, parent) => {
    if (list.length < 2) return;
    const step = Number(parent.dataset.revealStagger || 80);
    list.forEach((el, i) => el.style.setProperty('--d', `${i * step}ms`));
  });

  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  els.forEach((el) => io.observe(el));
})();
