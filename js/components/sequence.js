/* =========================================================
   Composant « Sequence » — apparitions dans l'ordre de lecture (tablette et mobile, ≤ 991 px)
   Sur une colonne, les décalages pensés pour le desktop (frères décalés de 80 ms, lignes des titres,
   intro du hero) faisaient partir un élément avant celui du dessus. Les apparitions (reveal.js, gradient-text.js,
   intro et compteurs de js/main.js) confient ici leur départ : chacune part à l'heure demandée, mais jamais
   avant STEP après le départ de ce qui est au-dessus d'elle (ou à sa gauche sur la même ligne) et pas encore parti.
   Ce qui entre seul à l'écran part sans attendre.
   API : Sequence.active                             → true sous BREAKPOINT (lu à chaque appel)
         Sequence.add(el, run, { delay, span, at, bottom })  → run() est appelé quand l'animation de el peut partir
           delay : délai CSS de l'animation après run() (ms) ; span : écart entre son premier et son dernier
           départ (lignes d'un titre, ms) ; at : départ souhaité (horloge performance.now(), défaut : maintenant + delay) ;
           bottom : l'animation est au bas de l'élément (trait sous un en-tête), il est placé à son bord inférieur.
         Hors de BREAKPOINT, run() est appelé tout de suite.
   ========================================================= */
(() => {
  'use strict';
  const BREAKPOINT = window.matchMedia('(max-width: 991px)');
  const STEP = 80;   // ms entre deux départs
  const ROW = 10;    // px : en dessous de cet écart vertical, deux éléments sont sur la même ligne

  let entries = [];  // { el, top, left, delay, span, at, run, start, timer, ran }
  let queued = [];
  let raf = 0;

  // position dans la page, sans les transformations (les apparitions décalent les éléments de 40 à 120 px)
  function place(el) {
    let top = 0, left = 0, last = el;
    for (let n = el; n; last = n, n = n.offsetParent) { top += n.offsetTop; left += n.offsetLeft; }
    if (getComputedStyle(last).position === 'fixed') top += window.scrollY;
    return { top, left };
  }

  const order = (a, b) => (Math.abs(a.top - b.top) > ROW ? a.top - b.top : a.left - b.left);
  // a doit partir avant b : plus haut, ou à sa gauche sur la même ligne, et à l'écran en même temps
  const precedes = (a, b) => b.top - a.top < innerHeight
    && (b.top - a.top > ROW || (Math.abs(b.top - a.top) <= ROW && a.left < b.left - 1));

  // Regroupé par frame : ce qui entre ensemble (intro, plusieurs IntersectionObserver) est trié avant de partir.
  // Les départs pas encore lancés sont recalculés : un élément arrivé plus tard au-dessus les repousse.
  function flush() {
    raf = 0;
    const now = performance.now();
    queued.forEach((e) => {
      Object.assign(e, place(e.el));
      if (e.bottom) e.top += e.el.offsetHeight;
    });
    entries = entries.filter((e) => !e.ran || e.start + e.span + STEP > now).concat(queued);
    queued = [];
    entries.sort(order);
    entries.forEach((e, i) => {
      if (e.ran) return;
      let start = Math.max(e.at, now + e.delay);
      for (let j = 0; j < i; j++) {
        const a = entries[j];
        if (precedes(a, e)) start = Math.max(start, a.start + a.span + STEP);
      }
      if (start === e.start) return;
      e.start = start;
      clearTimeout(e.timer);
      e.timer = setTimeout(() => { e.ran = true; e.run(); }, Math.max(0, start - e.delay - now));
    });
  }

  function add(el, run, { delay = 0, span = 0, at, bottom = false } = {}) {
    if (!BREAKPOINT.matches) { run(); return; }
    const now = performance.now();
    if (at === undefined) at = now + delay;
    // élément masqué (display: none) : part à son heure, sans retenir les autres
    if (!el.getClientRects().length) { setTimeout(run, Math.max(0, at - delay - now)); return; }
    queued.push({ el, run, delay, span, at, bottom });
    if (!raf) raf = requestAnimationFrame(flush);
  }

  window.Sequence = {
    get active() { return BREAKPOINT.matches; },
    add,
  };
})();
