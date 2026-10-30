/* =========================================================
   Verdon — page Mécène · animations liées au scroll
   GSAP 3 + ScrollTrigger + Lenis (vendorisés dans js/vendor)

   Les animations « d'entrée » sont des composants CSS + IntersectionObserver :
   - js/components/gradient-text.js  → titres h1 / h2 / h3, légendes des chiffres ([data-gt-lines]) et libellés de CTA ([data-gt])
   - js/components/reveal.js         → apparitions ([data-reveal])
   Ce fichier ne garde que ce qui dépend vraiment du scroll (scrub, pin) + intro du hero.
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Menu mobile ---------- */
  const burger = $('[data-burger]');
  const mnav = $('[data-mnav]');
  let lenis = null;
  if (burger && mnav) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      mnav.classList.toggle('is-open', open);
      mnav.setAttribute('aria-hidden', String(!open));
      if (window.Nav) Nav.setOverlay(open);  // menu sombre par-dessus : encre claire
      if (open) $$('[data-gt]', mnav).forEach((el) => window.GradientText && GradientText.play(el));
      if (lenis) open ? lenis.stop() : lenis.start();
    });
    $$('a', mnav).forEach((a) => a.addEventListener('click', () => burger.click()));
  }

  /* ---------- FAQ (accordéon) ---------- */
  const faqItems = $$('[data-faq-item]');
  function setFaq(item, open, animate = true) {
    const panel = $('.faq__a', item);
    $('.faq__q', item).setAttribute('aria-expanded', String(open));
    if (!hasGSAP || !animate || reduceMotion) {
      item.classList.toggle('is-open', open);
      panel.style.height = open ? 'auto' : '0px';
      return;
    }
    if (open) {
      item.classList.add('is-open');
      gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
      gsap.fromTo($('.faq__a-inner', item), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.inOut', delay: 0.05 });
    } else {
      gsap.to(panel, {
        height: 0, duration: 0.45, ease: 'expo.out',
        onStart: () => item.classList.remove('is-open'),
        onComplete: () => ScrollTrigger.refresh(),
      });
    }
  }
  faqItems.forEach((item) => {
    setFaq(item, item.classList.contains('is-open'), false);
    $('.faq__q', item).addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');
      faqItems.forEach((other) => { if (other !== item && other.classList.contains('is-open')) setFaq(other, false); });
      setFaq(item, willOpen);
    });
  });

  /* ---------- Actualités : trait vert + image de l'article survolé ---------- */
  const newsItems = $$('[data-news-item]');
  const newsPics = $$('[data-news-img] .news__pic');
  newsItems.forEach((item, i) => {
    const activate = () => {
      newsItems.forEach((n) => n.classList.toggle('is-active', n === item));
      newsPics.forEach((p, j) => p.classList.toggle('is-active', j === i));
    };
    item.addEventListener('mouseenter', activate);
    item.addEventListener('focus', activate);
  });

  /* ---------- Factory built : frise des étapes ----------
     Scroll horizontal libre (trackpad, molette horizontale, glisser à la souris, flèches du clavier),
     jamais imposé par le scroll vertical. (La maquette 3D est dans js/components/package-3d.js.) */
  const rail = $('[data-drag]');
  if (rail) {
    // geste horizontal : laissé au navigateur (sinon Lenis le transforme en scroll vertical de la page)
    rail.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation(); }, { passive: true });
    let x0 = null, s0 = 0;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();  // pas de sélection de texte ni de glisser-déposer d'image
      x0 = e.clientX; s0 = rail.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      if (Math.abs(e.clientX - x0) > 3) rail.classList.add('is-dragging');
      rail.scrollLeft = s0 - (e.clientX - x0);
    });
    window.addEventListener('pointerup', () => { x0 = null; rail.classList.remove('is-dragging'); });
  }

  /* ---------- Compteurs (IntersectionObserver, pas de ScrollTrigger) ---------- */
  const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const counters = $$('[data-count]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const el = e.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now();
      const dur = 2200;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(2, -10 * k); // expo.out
        el.textContent = fmt(target * (k === 1 ? 1 : eased)) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { rootMargin: '0px 0px -12% 0px' });
    counters.forEach((el) => {
      el.dataset.suffix = el.textContent.trim().endsWith('+') ? '+' : '';
      el.textContent = '0' + el.dataset.suffix;
      cio.observe(el);
    });
  }

  /* ---------- Vidéo du hero ---------- */
  const heroVideo = $('[data-hero-video]');
  if (heroVideo && !reduceMotion) {
    const small = matchMedia('(max-width: 991px)').matches;
    heroVideo.src = (small && heroVideo.dataset.srcMobile) || heroVideo.dataset.src;
    heroVideo.preload = 'auto';
    const tryPlay = () => { const p = heroVideo.play(); if (p) p.catch(() => {}); };
    tryPlay();
    document.addEventListener('visibilitychange', () => { if (document.hidden) heroVideo.pause(); else if (heroVideo.dataset.offscreen !== '1') tryPlay(); });
    heroVideo.__play = tryPlay;
  }

  if (!hasGSAP || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- Smooth scroll (Lenis) — désactivé par défaut ----------
     Le scroll natif est géré hors du thread JS : il reste fluide même quand la page calcule.
     Pour réactiver le lissage Lenis : <html data-smooth-scroll>. */
  if (typeof window.Lenis !== 'undefined' && document.documentElement.hasAttribute('data-smooth-scroll')) {
    lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id); }
      else if (id === '#') e.preventDefault();
    }));
  }

  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 992px)';

  /* =========================================================
     HERO — intro + sortie au scroll
     ========================================================= */
  const heroDots = $('.hero__dots');
  gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
    .fromTo(heroDots, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power3.out' }, 0)
    .fromTo('.nav__logo', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 1.2 }, 0.2)
    .fromTo('.nav__menu .nav__item', { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 1, stagger: 0.05 }, 0.3)
    .fromTo(['.nav__lang', '.nav__cta', '.nav__burger'], { opacity: 0 }, { opacity: 1, duration: 1, ease: 'sine.inOut' }, 0.5)
    .fromTo('.hero__eyebrow', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'sine.inOut' }, 0.45)
    // titre h1 : composant Gradient text ligne par ligne ([data-gt-lines], délai dans le HTML)
    .fromTo('[data-hero-fade]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.95);

  // Vidéo mise en pause quand le hero est entièrement recouvert (économie GPU / batterie)
  let heroVisible = true;
  ScrollTrigger.create({
    trigger: '.positioning__inner', start: 'top top',
    onEnter: () => { heroVisible = false; if (heroVideo) { heroVideo.dataset.offscreen = '1'; heroVideo.pause(); } },
    onLeaveBack: () => { heroVisible = true; if (heroVideo) { heroVideo.dataset.offscreen = ''; heroVideo.__play && heroVideo.__play(); } },
  });

  // Parallaxe souris (desktop) — sans lecture de layout dans le handler
  mm.add('(hover: hover) and (min-width: 992px)', () => {
    const xTo = gsap.quickTo('.hero__visual', 'x', { duration: 1.2, ease: 'power3.out' });
    const yTo = gsap.quickTo('.hero__visual', 'y', { duration: 1.2, ease: 'power3.out' });
    const onMove = (e) => {
      if (!heroVisible) return;
      xTo(((e.clientX / innerWidth) - 0.5) * -30);
      yTo(((e.clientY / innerHeight) - 0.5) * -20);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  });

  // Le hero s'efface pendant que la section suivante le recouvre
  gsap.timeline({ scrollTrigger: { trigger: '.positioning', start: 'top top', end: () => '+=' + innerHeight, scrub: true } })
    .to('.hero__dots', { yPercent: -12, ease: 'none' }, 0)
    .to('.hero__content', { y: -120, opacity: 0.15, ease: 'none' }, 0);

  // (l'arc dégradé ne bouge pas : il doit toujours masquer la jonction hero / section suivante)


  /* =========================================================
     OUR SERVICES — scroll horizontal épinglé (desktop)
     ========================================================= */
  mm.add(DESKTOP, () => {
    const pin = $('[data-hscroll-pin]');
    const track = $('[data-hscroll-track]');
    const big = $('[data-hscroll-bigword]');
    if (!pin || !track) return;
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.timeline({
      scrollTrigger: {
        trigger: pin,
        start: () => (pin.offsetHeight > innerHeight ? 'bottom bottom' : 'top top'),
        end: () => '+=' + distance(),
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    })
      .to(track, { x: () => -distance(), ease: 'none', force3D: true }, 0)
      .to(big, { x: () => -distance() * 0.42, ease: 'none', force3D: true }, 0);
  });

  /* =========================================================
     EXPERTISES — blobs en parallaxe
     ========================================================= */
  gsap.fromTo('.expertise__blobs', { y: 200 }, { y: -200, ease: 'none', scrollTrigger: { trigger: '.expertise', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* =========================================================
     CTA + FOOTER
     ========================================================= */
  gsap.fromTo('[data-cta-bg]', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.fromTo('[data-footer]', { y: 160 }, { y: 0, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 70%', end: 'bottom bottom', scrub: 0.6 } });

  /* ---------- Refresh après chargement ---------- */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
})();
