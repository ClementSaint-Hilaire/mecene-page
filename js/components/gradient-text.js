/* =========================================================
   Composant « Gradient text » (voir css/components/gradient-text.css)
   - initialise tous les éléments [data-gt]
   - lance le balayage quand l'élément entre dans l'écran (IntersectionObserver)
   - rejoue le balayage au survol du bouton parent ([data-btn])
   API : window.GradientText.init(root?)  → initialise les nouveaux éléments
         window.GradientText.play(el)     → rejoue le balayage
   ========================================================= */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function play(el) {
    el.classList.remove('is-in');
    void el.offsetWidth; // redémarre l'animation CSS
    el.classList.add('is-in');
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0 })
    : null;

  function setup(el) {
    if (el.__gt) return;
    el.__gt = true;
    el.classList.add('gt');

    const fx = document.createElement('span');
    fx.className = 'gt__fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = el.innerHTML;
    el.appendChild(fx);

    if (reduce || !io) { el.classList.add('is-in'); return; }
    io.observe(el);

    const btn = el.closest('[data-btn]');
    if (btn && el.dataset.gtHover !== 'false') {
      btn.addEventListener('mouseenter', () => { if (el.classList.contains('is-in')) play(el); });
    }
  }

  function init(root = document) {
    root.querySelectorAll('[data-gt]').forEach(setup);
  }

  document.documentElement.classList.add('gt-ready');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();

  window.GradientText = { init, play };
})();
