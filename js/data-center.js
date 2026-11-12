/* =========================================================
   Verdon — page Data center · animations propres à la page
   (nav, intro du hero, Our approach, compteurs, FAQ, CTA + footer : js/main.js ; campus 3D : js/components/package-3d.js)
   - Cas d'étude : carrousel (carte active au centre, voisines réduites)
   - Hero : la photo descend et le contenu s'efface pendant que la section suivante le recouvre
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Cas d'étude : carrousel ----------
     La carte active est centrée dans l'écran ; ses voisines sont réduites à 80 % (CSS), ancrées de son côté.
     Clic ou focus clavier sur une voisine, glisser (souris ou doigt), flèches du clavier : elle devient active.
     Le lien d'une carte voisine ne s'ouvre pas : le clic l'amène au centre. */
  const viewport = $('[data-cases]');
  if (viewport) {
    const track = $('[data-cases-track]', viewport);
    const cards = $$('[data-case]', viewport);
    let active = Math.min(1, cards.length - 1); // la maquette s'ouvre sur la 2e carte
    const offset = () => viewport.clientWidth / 2 - (cards[active].offsetLeft + cards[active].offsetWidth / 2);
    function go(i) {
      active = Math.max(0, Math.min(cards.length - 1, i));
      cards.forEach((c, j) => {
        c.classList.toggle('is-active', j === active);
        c.classList.toggle('is-before', j < active);
        c.classList.toggle('is-after', j > active);
      });
      track.style.setProperty('--x', `${offset()}px`);
    }
    // position de départ sans transition
    viewport.classList.add('is-dragging');
    go(active);
    void track.offsetWidth;
    viewport.classList.remove('is-dragging');
    new ResizeObserver(() => go(active)).observe(viewport);

    // glisser : la piste suit le pointeur, au-delà de 60 px on passe à la carte suivante / précédente
    let downX = null, dx = 0, dragged = false;
    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      downX = e.clientX; dx = 0; dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (downX === null) return;
      dx = e.clientX - downX;
      if (!dragged && Math.abs(dx) > 6) { dragged = true; viewport.classList.add('is-dragging'); }
      if (dragged) track.style.setProperty('--x', `${offset() + dx}px`);
    });
    const end = () => {
      if (downX === null) return;
      downX = null;
      viewport.classList.remove('is-dragging');
      if (dragged) go(active + (dx < -60 ? 1 : dx > 60 ? -1 : 0));
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    viewport.addEventListener('dragstart', (e) => e.preventDefault());

    cards.forEach((c, i) => {
      c.addEventListener('click', (e) => {
        if (dragged) { e.preventDefault(); return; } // fin d'un glissé, pas un clic
        if (i !== active) { e.preventDefault(); go(i); }
      });
      c.addEventListener('focusin', () => go(i));
    });
    viewport.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = active + (e.key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= cards.length) return;
      e.preventDefault();
      $('a', cards[next])?.focus({ preventScroll: true });
    });
  }

  if (!hasGSAP || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Hero : sortie pendant que la section suivante le recouvre ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.dcgrowth', start: 'top bottom', end: 'top top', scrub: true } })
    .to('[data-hero-media]', { yPercent: 7.4, ease: 'none' }, 0)   // 8 % de marge / 108 % de hauteur (css/data-center.css)
    .to('.dchero__body', { y: -120, opacity: 0.15, ease: 'none' }, 0);
})();
