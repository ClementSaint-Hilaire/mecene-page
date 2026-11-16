/* =========================================================
   Verdon — page Data center · animations propres à la page
   (nav, intro du hero, Our approach, compteurs, FAQ, CTA + footer : js/main.js ; campus 3D : js/components/package-3d.js)
   - Cas d'étude : carrousel infini (carte active au centre, voisines réduites)
   - Hero : la photo descend et le contenu s'efface pendant que la section suivante le recouvre
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Cas d'étude : carrousel infini ----------
     La carte active est centrée dans l'écran ; ses voisines sont réduites à 80 % (CSS), ancrées de son côté.
     Clic ou focus clavier sur une voisine, glisser (souris ou doigt), flèches du clavier : elle devient active.
     Le lien d'une carte voisine ne s'ouvre pas : le clic l'amène au centre.
     Boucle : les cartes sont copiées de part et d'autre (copies masquées aux lecteurs d'écran, hors tabulation) ;
     quand la cible sort du jeu d'origine, la piste saute sans transition sur la copie équivalente puis y glisse. */
  const viewport = $('[data-cases]');
  if (viewport) {
    const track = $('[data-cases-track]', viewport);
    const originals = $$('[data-case]', viewport);
    const n = originals.length;
    const copies = () => originals.map((c) => {
      const k = c.cloneNode(true);
      k.setAttribute('aria-hidden', 'true');
      $$('a', k).forEach((a) => a.setAttribute('tabindex', '-1'));
      return k;
    });
    // au moins 3 cartes de chaque côté : de quoi remplir les écrans très larges pendant une transition
    for (let s = Math.ceil(3 / n); s > 0; s--) {
      track.prepend(...copies());
      track.append(...copies());
    }
    const cards = $$('[data-case]', viewport);
    const base = cards.indexOf(originals[0]);
    let active = base + Math.min(1, n - 1); // la maquette s'ouvre sur la 2e carte
    const offset = (i = active) => viewport.clientWidth / 2 - (cards[i].offsetLeft + cards[i].offsetWidth / 2);
    function place(i, x = offset(i)) {
      active = i;
      cards.forEach((c, j) => {
        c.classList.toggle('is-active', j === active);
        c.classList.toggle('is-before', j < active);
        c.classList.toggle('is-after', j > active);
      });
      track.style.setProperty('--x', `${x}px`);
    }
    function instant(fn) {
      viewport.classList.add('is-instant');
      fn();
      void track.offsetWidth;
      viewport.classList.remove('is-instant');
    }
    function go(i) {
      const shift = base + (((i - base) % n) + n) % n - i; // ramène la cible dans le jeu d'origine
      if (shift) {
        // même image avant et après le saut : on repart de la position affichée (transition ou glissé en cours)
        const x = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 + offset(active + shift) - offset(active);
        instant(() => place(active + shift, x));
      }
      place(i + shift);
    }
    // position de départ sans transition
    instant(() => place(active));
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
    });
    originals.forEach((c) => c.addEventListener('focusin', () => {
      // vers la copie la plus proche de la carte active : la piste prend le chemin le plus court
      let i = cards.indexOf(c);
      while (i - active > n / 2) i -= n;
      while (active - i > n / 2) i += n;
      go(i);
    }));
    viewport.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      go(active + (e.key === 'ArrowRight' ? 1 : -1));
      $('a', cards[active])?.focus({ preventScroll: true }); // la carte active est toujours une originale
    });
  }

  if (!hasGSAP || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Hero : sortie pendant que la section suivante le recouvre ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.dcgrowth', start: 'top bottom', end: 'top top', scrub: true } })
    .to('[data-hero-media]', { yPercent: 7.4, ease: 'none' }, 0)   // 8 % de marge / 108 % de hauteur (css/data-center.css)
    .to('.dchero__body', { y: -120, opacity: 0.15, ease: 'none' }, 0);
})();
