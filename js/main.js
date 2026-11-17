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

  /* ---------- Menu mobile ----------
     SECTORS ([data-mnav-group]) : sous-menu replié, déplié au clic ; il se replie une fois le menu fermé.
     Page bloquée sous le menu ouvert (html.is-locked ; Lenis, quand il tourne, est aussi arrêté). */
  const burger = $('[data-burger]');
  const mnav = $('[data-mnav]');
  let lenis = null;
  if (burger && mnav) {
    const groups = $$('[data-mnav-group]', mnav).map((el) => {
      const btn = $('[data-mnav-group-toggle]', el);
      const set = (open) => {
        el.classList.toggle('is-expanded', open);
        btn.setAttribute('aria-expanded', String(open));
      };
      btn.addEventListener('click', () => set(!el.classList.contains('is-expanded')));
      return set;
    });
    let inkTimer = 0;
    let groupTimer = 0;
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mnav.classList.toggle('is-open', open);
      mnav.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('is-locked', open);
      // replié après le fondu de fermeture (.4s, css/style.css) : pas d'animation visible
      clearTimeout(groupTimer);
      if (!open) groupTimer = setTimeout(() => groups.forEach((set) => set(false)), reduceMotion ? 0 : 400);
      // menu sombre par-dessus : encre claire pendant que le balayage du fond passe sous la nav
      // (vers 30 % de --mnav-sweep : le burger est déjà couvert, le logo le sera pendant le fondu de couleur)
      clearTimeout(inkTimer);
      if (window.Nav && !open) Nav.setOverlay(false);
      else if (window.Nav) {
        const delay = reduceMotion ? 0 : parseFloat(getComputedStyle(mnav).getPropertyValue('--mnav-sweep')) * 300;
        inkTimer = setTimeout(() => Nav.setOverlay(true), delay || 0);
      }
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
    // départ avec le chiffre (tablette, mobile : dans l'ordre de lecture, js/components/sequence.js)
    const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      if (window.Sequence) Sequence.add(e.target, () => count(e.target));
      else count(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    const count = (el) => {
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
    };
    counters.forEach((el) => {
      // suffixe : data-suffix dans le HTML (« 650 MW »), sinon le « + » final
      if (!('suffix' in el.dataset)) el.dataset.suffix = el.textContent.trim().endsWith('+') ? '+' : '';
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

  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 992px)';

  /* ---------- Smooth scroll (Lenis) — seulement avec <html data-smooth-scroll>, jamais sur mobile ----------
     Le scroll natif est géré hors du thread JS : il reste fluide même quand la page calcule.
     Mobile (≤ 767 px) : scroll natif ; Lenis est créé ou détruit quand la largeur passe le seuil. */
  if (typeof window.Lenis !== 'undefined' && document.documentElement.hasAttribute('data-smooth-scroll')) {
    mm.add('(min-width: 768px)', () => {
      lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      const raf = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      return () => {
        gsap.ticker.remove(raf);
        gsap.ticker.lagSmoothing(500, 33);   // valeurs par défaut de GSAP
        lenis.destroy();
        lenis = null;
      };
    });
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id === '#') { e.preventDefault(); return; }
      const target = lenis && $(id);
      // Lenis ignore scroll-margin-top : on le passe en décalage
      if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -(parseFloat(getComputedStyle(target).scrollMarginTop) || 0) }); }
    }));
  }

  /* =========================================================
     HERO — intro + sortie au scroll
     ========================================================= */
  // visuel du hero : vidéo de points (accueil) ou photo [data-hero-media] (Factory built) ; ni visuel ni surtitre sur la page Contact
  const heroDots = $('.hero__dots, [data-hero-media]');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 });
  if (heroDots) intro.fromTo(heroDots, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power3.out' }, 0);
  // Desktop : une timeline. Tablette et mobile : chaque élément part à son heure, mais jamais avant ce qui est
  // au-dessus de lui (js/components/sequence.js, qui ordonne aussi le titre et les apparitions du dessous).
  const seq = window.Sequence && Sequence.active;
  const t0 = performance.now() + intro.delay() * 1000;
  const enter = (targets, from, to, at) => {
    if (!seq) { intro.fromTo(targets, from, to, at); return; }
    const { stagger = 0, ...rest } = to;
    (typeof targets === 'string' ? $$(targets) : targets).forEach((el, i) => {
      const tween = gsap.fromTo(el, from, { ease: 'expo.out', ...rest, paused: true });
      Sequence.add(el, () => tween.play(), { at: t0 + (at + i * stagger) * 1000 });
    });
  };
  enter('.nav__logo', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 1.2 }, 0.2);
  enter('.nav__menu > *', { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 1, stagger: 0.05 }, 0.3);
  enter('.nav__toggle, .nav__lang, .nav__cta', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'sine.inOut' }, 0.5);
  // burger (tablette, mobile) : juste après le logo, avant le titre
  enter('.nav__burger', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'sine.inOut' }, 0.3);
  if ($('.hero__eyebrow')) enter('.hero__eyebrow', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'sine.inOut' }, 0.45);
  // titre h1 : composant Gradient text ligne par ligne ([data-gt-lines], délai dans le HTML)
  // Tablette et mobile : ce qui est au-dessus du titre (grand titre de la Newsroom) part avec le surtitre, pas après le titre
  const fades = $$('[data-hero-fade]');
  const title = seq && $('h1');
  const above = title ? fades.filter((el) => el.getBoundingClientRect().bottom <= title.getBoundingClientRect().top) : [];
  if (above.length) enter(above, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2 }, 0.45);
  enter(fades.filter((el) => !above.includes(el)), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 0.95);

  // Vidéo mise en pause quand le hero est entièrement recouvert (économie GPU / batterie)
  let heroVisible = true;
  if ($('.positioning__inner')) ScrollTrigger.create({
    trigger: '.positioning__inner', start: 'top top',
    onEnter: () => { heroVisible = false; if (heroVideo) { heroVideo.dataset.offscreen = '1'; heroVideo.pause(); } },
    onLeaveBack: () => { heroVisible = true; if (heroVideo) { heroVideo.dataset.offscreen = ''; heroVideo.__play && heroVideo.__play(); } },
  });

  // Parallaxe souris (desktop) — sans lecture de layout dans le handler
  if ($('.hero__visual')) mm.add('(hover: hover) and (min-width: 992px)', () => {
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

  // Le hero s'efface pendant que la section suivante le recouvre (Factory built : js/factory-built.js)
  if ($('.positioning')) gsap.timeline({ scrollTrigger: { trigger: '.positioning', start: 'top top', end: () => '+=' + innerHeight, scrub: true } })
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
  if ($('.expertise__blobs')) gsap.fromTo('.expertise__blobs', { y: 200 }, { y: -200, ease: 'none', scrollTrigger: { trigger: '.expertise', start: 'top bottom', end: 'bottom top', scrub: true } });

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
