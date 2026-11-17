/* =========================================================
   Composant « Reveal » — apparitions à l'entrée dans l'écran
   Ajoute .is-in aux éléments [data-reveal="up|fade|clip|scale|line|vline|wipe|card|xcard|quote"].
   Toutes les transitions sont en CSS (transform / opacity / clip-path) : aucun calcul JS au scroll.
   Desktop : décalage automatique entre éléments frères (--d), réglable avec data-reveal-stagger (ms) sur le parent.
   Tablette et mobile : pas de décalage entre frères (empilés, le dernier attendrait pour rien et partirait
   après l'élément du dessous) ; ce qui entre ensemble part dans l'ordre de lecture (js/components/sequence.js).
   ========================================================= */
(() => {
  'use strict';
  const els = Array.from(document.querySelectorAll('[data-reveal]'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sequenced = () => window.Sequence && Sequence.active;

  // stagger entre frères
  const groups = new Map();
  els.forEach((el) => {
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  if (!sequenced()) groups.forEach((list, parent) => {
    if (list.length < 2) return;
    const step = Number(parent.dataset.revealStagger || 80);
    list.forEach((el, i) => el.style.setProperty('--d', `${i * step}ms`));
  });

  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const time = (v) => (parseFloat(v) || 0) * (/ms\s*$/.test(v) ? 1 : 1000);  // « 1.45s » / « 80ms » → ms
  const UNDER = ['cthead', 'rshead'];   // n'animent qu'un trait sous l'élément (en-têtes Contact / Resources)
  function show(el) {
    if (!sequenced()) { el.classList.add('is-in'); return; }
    // délai CSS de l'apparition : --d posé par les scripts des pages, ou trait dessiné par un pseudo-élément ;
    // le plus long des transition-delay
    const delay = Math.max(...[null, '::before', '::after']
      .flatMap((p) => getComputedStyle(el, p).transitionDelay.split(',').map(time)));
    Sequence.add(el, () => el.classList.add('is-in'), { delay, bottom: UNDER.includes(el.dataset.reveal) });
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      show(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  // après les scripts des pages : ils trient les grilles (Resources) et posent les délais d'intro ;
  // observés plus tôt, des éléments descendus par le tri seraient vus à l'écran et apparaîtraient d'avance
  const observe = () => els.forEach((el) => io.observe(el));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
})();
