/* =========================================================
   Verdon — page Factory built · animations propres à la page
   (nav, intro du hero, Our process, FAQ, CTA + footer : js/main.js et js/components/)
   - Steps : étape active (sommaire + visuel collant), règle graduée remplie au dégradé
   - One integrated chain : les vignettes s'empilent sous le visuel collant des Steps (desktop)
   - Hero : le contenu s'efface pendant que l'intro le recouvre
   - Intro : section épinglée, le texte passe de tertiaire à primaire, lettre après lettre, au scroll
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Steps : étape active ----------
     L'étape qui passe sur la ligne du milieu de l'écran est active :
     lien du sommaire marqué (pastille), calque du visuel collant découvert et parcouru par le flux de son illustration.
     Les calques sont empilés dans l'ordre, le 1er dessus ; ceux des étapes passées sont relevés (.is-past). */
  const steps = $$('[data-step]');
  const links = $$('[data-steps-link]');
  const slides = $$('[data-steps-slide]');
  slides.forEach((s, j) => { s.style.zIndex = slides.length - j; });
  let active = -1;
  function setActive(i) {
    if (i === active) return;
    active = i;
    links.forEach((a, j) => {
      a.classList.toggle('is-active', j === i);
      if (j === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    slides.forEach((s, j) => s.classList.toggle('is-past', j < i));
    // illustration en points du calque découvert (js/components/service-dots.js)
    slides[i]?.querySelector('[data-service-dots]')?.dispatchEvent(new Event('service-dots:play'));
  }
  if (steps.length) {
    setActive(0);
    if ('IntersectionObserver' in window) {
      // racine réduite à la ligne du milieu de l'écran
      const list = steps[0].parentElement;
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        // ligne sortie de la liste, même par un saut de scroll (ancre, retour rapide) : 1re ou dernière étape
        // (le visuel collant est aussi la pile de « One integrated chain » : il doit y revenir au 1er calque)
        // (position relue : la 1re notification de Chrome peut arriver avec un rectangle vide)
        if (e.target === list) { if (!e.isIntersecting) setActive(list.getBoundingClientRect().top > innerHeight / 2 ? 0 : steps.length - 1); }
        else if (e.isIntersecting) setActive(steps.indexOf(e.target));
      }), { rootMargin: '-50% 0px -50% 0px' });
      steps.forEach((s) => io.observe(s));
      io.observe(list);
    }
  }

  if (!hasGSAP || reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();
  const DESKTOP = '(min-width: 992px)';

  /* ---------- Hero : sortie pendant que l'intro le recouvre ---------- */
  gsap.timeline({ scrollTrigger: { trigger: '.fbintro', start: 'top bottom', end: 'top top', scrub: true } })
    .to('[data-hero-media]', { yPercent: 7.4, ease: 'none' }, 0)   // 8 % de marge / 108 % de hauteur (css/factory-built.css)
    .to('.fbhero__body', { y: -120, opacity: 0.15, ease: 'none' }, 0);

  /* ---------- Intro : tertiaire → primaire, lettre après lettre ----------
     La section est épinglée dès qu'elle remplit l'écran ; les lettres passent au primaire
     pendant une hauteur d'écran de scroll, puis la page reprend.
     Chaque lettre dans un <span> (sans effet sur les retours à la ligne) ; le texte entier
     reste lisible par les lecteurs d'écran dans .fbintro__sr. */
  const intro = $('[data-fb-chars]');
  if (intro) {
    const text = intro.textContent.trim().replace(/\s+/g, ' ');
    const sr = document.createElement('span');
    sr.className = 'fbintro__sr';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    const chars = [];
    Array.from(text).forEach((c) => {
      if (c === ' ') { vis.appendChild(document.createTextNode(c)); return; }
      const s = document.createElement('span');
      s.className = 'fbintro__char';
      s.textContent = c;
      chars.push(s);
      vis.appendChild(s);
    });
    intro.replaceChildren(sr, vis);

    let lit = 0;
    ScrollTrigger.create({
      trigger: '.fbintro', start: 'top top', end: '+=100%',
      pin: true, anticipatePin: 1,
      refreshPriority: 1, // créé après les déclencheurs de js/main.js plus bas dans la page : calculé avant eux
      onUpdate: (st) => {
        const n = Math.round(st.progress * chars.length);
        for (let i = Math.min(n, lit); i < Math.max(n, lit); i++) chars[i].classList.toggle('is-on', i < n);
        lit = n;
      },
    });
  }

  /* ---------- One integrated chain → Steps : les vignettes s'empilent, puis la pile descend la règle (desktop) ----------
     Le visuel collant des Steps (calque 1 dessus) est remonté sur la 1re vignette (.is-linked, css/factory-built.css).
     Quand la rangée arrive au milieu de l'écran, là où le visuel se colle, la section est épinglée avec les Steps
     (visibles en dessous) et les vignettes 2 à 6 glissent l'une après l'autre sous la première. Les sections
     repartent ensuite : le visuel reste collé et la règle graduée défile derrière lui, un calque par étape. */
  mm.add(DESKTOP, () => {
    const flow = $('[data-chain-flow]');
    const chain = $('.fbchain');
    const vp = $('[data-chain-viewport]');
    const tr = $('[data-chain-track]');
    const stepsEl = $('.fbsteps');
    const body = $('.fbsteps__body');
    if (!flow || !chain || !vp || !tr || !stepsEl || !body) return;
    const tiles = Array.from(tr.children);

    stepsEl.classList.add('is-linked');
    // après l'épinglage, GSAP décale le bloc par transform (translateY = durée de l'épinglage), ce que les éléments
    // collants des Steps ignorent : --pin-shift corrige leur top (css/factory-built.css). La pile est alors masquée.
    const after = (st) => {
      const done = st.progress === 1;
      chain.classList.toggle('is-stacked', done);
      stepsEl.style.setProperty('--pin-shift', done ? `${st.end - st.start}px` : '0px');
    };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: vp, start: 'center center', end: '+=100%',   // centre de la rangée = centre du visuel collant
        pin: flow, scrub: 0.5, invalidateOnRefresh: true,
        onRefresh: (st) => {
          // écart entre le haut de la rangée et le haut des Steps (la section suit directement .fbchain)
          stepsEl.style.setProperty('--chain-lead', `${chain.offsetHeight - vp.offsetTop + body.offsetTop}px`);
          after(st);
        },
        onLeave: after,       // (pas onToggle : un saut par-dessus l'épinglage ne le déclenche pas)
        onEnterBack: after,
      },
    });
    // 1re vignette dessus. Décalage par --stack-x (propriété translate, css/factory-built.css) :
    // transform reste à l'apparition (data-reveal="up")
    gsap.set(tiles, { zIndex: (i) => tiles.length - i });
    tiles.forEach((t, i) => {
      if (i) tl.fromTo(t, { '--stack-x': '0px' }, { '--stack-x': () => `${tiles[0].offsetLeft - t.offsetLeft}px`, duration: 1, ease: 'power2.inOut' }, (i - 1) * 0.2);
    });
    tl.to({}, { duration: 0.4 });   // pile complète : un temps avant que la section reparte
    // les vignettes hors de l'écran à droite apparaissent avec la rangée (reveal.js ne les verrait qu'en glissant)
    ScrollTrigger.create({ trigger: vp, start: 'top 92%', once: true, onEnter: () => tiles.forEach((t) => t.classList.add('is-in')) });
    // la 1re vignette est sous le visuel collant : son survol relance l'illustration du calque du dessus
    const playTop = () => slides[active]?.querySelector('[data-service-dots]')?.dispatchEvent(new Event('service-dots:play'));
    tiles[0].addEventListener('pointerenter', playTop);

    return () => {
      tiles[0].removeEventListener('pointerenter', playTop);
      stepsEl.classList.remove('is-linked');
      stepsEl.style.removeProperty('--chain-lead');
      stepsEl.style.removeProperty('--pin-shift');
      chain.classList.remove('is-stacked');
    };
  });

  /* ---------- Steps : règle graduée remplie jusqu'à l'étape en cours ---------- */
  const fill = $('[data-steps-fill]');
  if (fill) {
    gsap.fromTo(fill, { clipPath: 'inset(0% 0% 100% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.fbsteps__items', start: 'top 50%', end: 'bottom 50%', scrub: true, pinnedContainer: '[data-chain-flow]' },   // épinglé avec la chain (desktop)
    });
  }
})();
