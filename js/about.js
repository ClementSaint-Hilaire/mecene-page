/* =========================================================
   Verdon — page About · animations propres à la page
   (nav, intro du hero, compteurs, FAQ, CTA + footer : js/main.js ; pictogrammes en points : js/components/service-dots.js)
   - Hero : la photo descend et le contenu s'efface pendant que Our story recouvre le hero
   - Our team : la rangée de portraits glisse vers la gauche pendant que la section traverse l'écran (desktop) ;
     tablette et mobile : scroll horizontal natif (css/about.css)
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);

  if (!hasGSAP || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Hero : sortie pendant que la section suivante le recouvre ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.abstory', start: 'top bottom', end: 'top top', scrub: true } })
    .to('[data-hero-media]', { yPercent: 7.4, ease: 'none' }, 0)   // 8 % de marge / 108 % de hauteur (css/about.css)
    .to('.abhero__body', { y: -120, opacity: 0.15, ease: 'none' }, 0);

  /* ---------- Our team : la piste glisse jusqu'au dernier portrait (même principe que la frise de l'accueil) ---------- */
  gsap.matchMedia().add('(min-width: 992px)', () => {
    const vp = $('[data-team]');
    const tr = $('[data-team-track]');
    if (!vp || !tr) return;
    const over = () => Math.max(0, tr.scrollWidth - vp.clientWidth);
    gsap.to(tr, {
      x: () => -over(), ease: 'none',
      scrollTrigger: { trigger: vp, start: 'top 85%', end: 'bottom 20%', scrub: 0.8, invalidateOnRefresh: true },
    });
  });
})();
