/* =========================================================
   Composant « Gradient text » (voir css/components/gradient-text.css)
   Deux modes, même balayage dégradé :
   - [data-gt]        un seul balayage sur tout l'élément (libellés de CTA) ;
                      rejoué au survol du bouton parent ([data-btn])
   - [data-gt-lines]  animation du titre h1 : le texte est découpé en lignes, telles qu'elles
                      tombent à l'écran, et chaque ligne a son balayage, décalé de --gt-stagger
                      (h1, h2, h3, légendes des chiffres clés). Redécoupé quand la largeur
                      de l'élément change ou quand la police arrive.
   Le balayage démarre à l'entrée dans l'écran (IntersectionObserver).
   API : window.GradientText.init(root?)  → initialise les nouveaux éléments
         window.GradientText.play(el)     → rejoue le balayage
   ========================================================= */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // .gt + calque coloré (copie du texte, rendue en dégradé par le CSS)
  function decorate(el) {
    el.classList.add('gt');
    const fx = document.createElement('span');
    fx.className = 'gt__fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = el.innerHTML;
    el.appendChild(fx);
  }

  function play(el) {
    const st = el.__gtl;
    const targets = st ? st.lines : [el];
    targets.forEach((t) => t.classList.remove('is-in', 'is-done'));
    void el.offsetWidth; // redémarre l'animation CSS
    targets.forEach((t) => t.classList.add('is-in'));
    if (st) { st.entered = true; st.done = false; }
  }

  function enter(el) {
    const st = el.__gtl;
    if (!st) { el.classList.add('is-in'); return; }
    st.entered = true;
    st.lines.forEach((l) => l.classList.add('is-in'));
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          enter(e.target);
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0 })
    : null;

  /* ---------- [data-gt] : un seul balayage ---------- */
  function setup(el) {
    if (el.__gt) return;
    el.__gt = true;
    decorate(el);

    if (reduce || !io) { el.classList.add('is-in'); return; }
    io.observe(el);

    const btn = el.closest('[data-btn]');
    if (btn && el.dataset.gtHover !== 'false') {
      btn.addEventListener('mouseenter', () => { if (el.classList.contains('is-in')) play(el); });
    }
  }

  /* ---------- [data-gt-lines] : une ligne après l'autre ---------- */

  // 1. chaque mot dans un <span> pour savoir sur quelle ligne il tombe
  function wrapWords(node, words) {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 1) { if (n.tagName !== 'BR') wrapWords(n, words); return; }
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      n.data.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        part.match(/[^-]*-|[^-]+/g).forEach((chunk) => { // le texte peut aussi passer à la ligne après un trait d'union
          const w = document.createElement('span');
          w.textContent = chunk;
          words.push(w);
          frag.appendChild(w);
        });
      });
      n.replaceWith(frag);
    });
    return words;
  }

  // 2. numéro de ligne de chaque mot (offsetTop : insensible aux transformations des parents)
  function measure(words) {
    let top = -Infinity, i = -1;
    words.forEach((w) => {
      if (w.offsetTop - top > w.offsetHeight / 2) { i++; top = w.offsetTop; }
      w.__gtLine = i;
    });
  }

  // 3. une .gt-line par ligne, en recopiant les éléments inline qui portent le texte (couleurs…)
  function rebuild(el) {
    const st = el.__gtl;
    const lines = [];
    let cur = -1, open = []; // éléments ouverts dans la ligne en cours : [original, copie]
    const add = (text, chain, i) => {
      if (i !== cur) { cur = i; lines.push(document.createElement('span')); open = []; }
      let k = 0;
      while (k < open.length && k < chain.length && open[k][0] === chain[k]) k++;
      open.length = k;
      let parent = k ? open[k - 1][1] : lines[lines.length - 1];
      for (; k < chain.length; k++) {
        const copy = chain[k].cloneNode(false);
        parent.appendChild(copy);
        open.push([chain[k], copy]);
        parent = copy;
      }
      parent.appendChild(document.createTextNode(text));
    };
    (function walk(node, chain) {
      node.childNodes.forEach((n) => {
        if (n.__gtLine !== undefined) add(n.textContent, chain, n.__gtLine);
        else if (n.nodeType === 3) { if (cur >= 0) add(n.data, chain, cur); } // espaces
        else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n, chain.concat(n));
      });
    })(el, []);

    el.textContent = '';
    lines.forEach((line, i) => {
      if (i) el.appendChild(document.createElement('br'));
      line.className = 'gt-line';
      line.style.setProperty('--gt-i', i);
      decorate(line);
      if (st.entered) line.classList.add('is-in');   // déjà vu : rejoue (ou reste affiché si terminé)
      if (st.done) line.classList.add('is-done');
      el.appendChild(line);
    });
    st.lines = lines;
    el.classList.add('gt-lines');
  }

  // Découpages regroupés par frame : écritures, lectures, écritures → une seule mise en page
  const pending = new Set();
  let raf = 0;
  function split(el) {
    pending.add(el);
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const list = Array.from(pending);
      pending.clear();
      const words = list.map((t) => { t.innerHTML = t.__gtl.html; return wrapWords(t, []); });
      words.forEach(measure);
      list.forEach(rebuild);
    });
  }

  // Redécoupe quand la largeur change (le premier appel fait le découpage initial)
  const ro = 'ResizeObserver' in window
    ? new ResizeObserver((entries) => entries.forEach(({ target, contentRect }) => {
        const st = target.__gtl;
        if (Math.abs(contentRect.width - st.w) < 1) return;
        st.w = contentRect.width;
        split(target);
      }))
    : null;

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', () => document.querySelectorAll('.gt-lines').forEach((el) => el.__gtl.lines.length && split(el)));
  }

  function setupLines(el) {
    if (el.__gtl) return;
    const st = el.__gtl = { html: el.innerHTML, lines: [], w: -1, entered: false, done: false };

    if (reduce || !io || !ro) { el.classList.add('gt-lines'); return; }
    el.addEventListener('animationend', (e) => {
      if (e.target === st.lines[st.lines.length - 1]) st.done = true;
    });
    io.observe(el);
    fontsReady.then(() => ro.observe(el));
  }

  function init(root = document) {
    root.querySelectorAll('[data-gt]').forEach(setup);
    root.querySelectorAll('[data-gt-lines]').forEach(setupLines);
  }

  document.documentElement.classList.add('gt-ready');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();

  window.GradientText = { init, play };
})();
