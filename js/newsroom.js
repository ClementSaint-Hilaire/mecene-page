/* =========================================================
   Verdon — page Newsroom · thèmes, recherche
   (nav, intro du hero, FAQ, CTA + footer : js/main.js et js/components/)
   - Les articles sont écrits dans le HTML (un [data-nw-item] par article : à la une dans le hero, puis la grille) :
     la liste reste lisible et indexable sans JS. Chaque article porte data-tags (thèmes, séparés par des espaces)
     et data-keywords (mots-clés cherchés en plus du texte de la carte).
   - Thèmes (pastilles du hero) : un article passe s'il a l'un des thèmes choisis. Recherche : chaque mot tapé doit
     se trouver dans le texte de l'article ou ses mots-clés, sans tenir compte des accents ni de la casse ; termes
     surlignés dans les titres. Les deux se cumulent ; une pastille sans article pour la recherche en cours passe en grisé.
   - État dans l'URL (?q=…&tag=…) : une sélection se partage par lien.
   - Raccourcis : « / » place le curseur dans la recherche, Échap la vide.
   - Grand titre « OUR NEWSROOM » : défilement en CSS (css/newsroom.css), en pause hors de l'écran.
   - Chargement : les articles visibles à l'arrivée apparaissent pendant l'intro, du haut vers le bas.
   ========================================================= */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const root = $('[data-newsroom]');
  if (!root) return;

  const search = $('[data-nw-search]', root);
  const chips = $$('[data-nw-tag]', root);
  const grid = $('[data-nw-grid]', root);
  const emptyEl = $('[data-nw-empty]', root);
  const resetBtns = $$('[data-nw-reset]', root);
  const live = $('[data-nw-live]');
  const tagValues = chips.map((c) => c.dataset.nwTag);

  // texte comparable : sans accents, en minuscules
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Articles ---------- */
  const items = $$('[data-nw-item]', root).map((el) => {
    const title = $('[data-nw-title]', el);
    const titleText = title.textContent;
    // titre replié caractère par caractère : une position trouvée dans le texte replié renvoie au texte d'origine
    let folded = '';
    const map = [];
    for (let i = 0; i < titleText.length; i++) {
      const c = fold(titleText[i]);
      for (let k = 0; k < c.length; k++) map.push(i);
      folded += c;
    }
    return {
      el, title, titleText, folded, map,
      tags: (el.dataset.tags || '').split(/\s+/).filter(Boolean),
      text: fold(`${el.textContent} ${el.dataset.keywords || ''}`).replace(/\s+/g, ' '),
      shown: true,
      marked: false,
    };
  });

  /* ---------- État ↔ URL ↔ contrôles ---------- */
  const state = { q: '', tags: [] };

  function readURL() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.tags = (p.get('tag') || '').split(',').filter((t) => tagValues.includes(t));
  }
  function writeControls() {
    search.value = state.q;
  }
  // différé : Safari refuse plus de 100 replaceState en 30 s (frappe rapide dans la recherche)
  let urlTimer = 0;
  function writeURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const p = new URLSearchParams();
      if (state.q.trim()) p.set('q', state.q.trim());
      if (state.tags.length) p.set('tag', state.tags.join(','));
      const qs = p.toString().replace(/%2C/g, ',');
      history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    }, 300);
  }

  /* ---------- Filtrage ---------- */
  const matches = (it, terms) => terms.every((t) => it.text.includes(t));
  const tagged = (it) => !state.tags.length || state.tags.some((t) => it.tags.includes(t));

  function highlight(it, terms) {
    if (!terms.length) {
      if (it.marked) { it.title.textContent = it.titleText; it.marked = false; }
      return;
    }
    const ranges = [];
    terms.forEach((t) => {
      for (let j = it.folded.indexOf(t); j !== -1; j = it.folded.indexOf(t, j + 1)) {
        ranges.push([it.map[j], it.map[j + t.length - 1] + 1]);
      }
    });
    if (!ranges.length && !it.marked) return;
    ranges.sort((a, b) => a[0] - b[0]);
    let html = '', at = 0;
    ranges.forEach(([s, e]) => {
      if (e <= at) return;
      s = Math.max(s, at);
      html += `${esc(it.titleText.slice(at, s))}<mark>${esc(it.titleText.slice(s, e))}</mark>`;
      at = e;
    });
    it.title.innerHTML = html + esc(it.titleText.slice(at));
    it.marked = ranges.length > 0;
  }

  const gridCards = () => $$('[data-nw-item]', grid).filter((el) => !el.hidden);

  // décalage d'apparition (reveal.js) des cartes de la grille pas encore apparues : de gauche à droite dans chaque rangée
  function stagger() {
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    gridCards().forEach((el, i) => {
      $$('[data-reveal]', el).forEach((r, k) => {
        if (!r.classList.contains('is-in')) r.style.setProperty('--d', `${(i % cols) * 80 + k * 80}ms`);
      });
    });
  }

  // articles déjà apparus qui reviennent après un filtre : courte ré-apparition en cascade
  function pop(list) {
    if (reduceMotion || !list.length) return;
    const order = items.filter((it) => it.shown).map((it) => it.el);
    const els = list.filter((el) => $('.is-in', el));
    els.forEach((el) => el.classList.remove('is-pop'));
    void root.offsetWidth;   // redémarre l'animation CSS
    els.forEach((el) => {
      el.style.setProperty('--pop', `${Math.min(order.indexOf(el), 8) * 40}ms`);
      el.classList.add('is-pop');
    });
  }
  root.addEventListener('animationend', (e) => e.target.classList.remove('is-pop'));

  let liveTimer = 0, refreshTimer = 0;
  function announce(n) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      if (live) live.textContent = n ? `${n} article${n > 1 ? 's' : ''} found` : 'No articles found';
    }, 700);
  }
  // la hauteur de la page change : positions des animations au scroll (CTA, footer) à recalculer
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => window.ScrollTrigger && ScrollTrigger.refresh(), 200);
  }

  /* silent → chargement */
  function apply({ silent = false } = {}) {
    const terms = fold(state.q).split(/\s+/).filter(Boolean);
    const appeared = [];
    let n = 0;
    items.forEach((it) => {
      const on = tagged(it) && matches(it, terms);
      if (on && !it.shown) appeared.push(it.el);
      it.shown = on;
      it.el.hidden = !on;
      if (on) n++;
      highlight(it, on ? terms : []);
    });

    chips.forEach((c) => {
      const tag = c.dataset.nwTag;
      c.setAttribute('aria-pressed', String(state.tags.includes(tag)));
      c.classList.toggle('is-empty', !items.some((it) => it.tags.includes(tag) && matches(it, terms)));
    });
    emptyEl.hidden = n > 0;
    grid.hidden = gridCards().length === 0;
    resetBtns.forEach((b) => { b.disabled = !(state.q.trim() || state.tags.length); });

    stagger();
    if (silent) return;
    pop(appeared);
    announce(n);
    writeURL();
    refresh();
  }

  // thème choisi plus bas dans la page (colonne collante) : si le 1er article affiché est passé, on y remonte
  function toResults() {
    const first = items.find((it) => it.shown);
    const target = first ? first.el : emptyEl;
    const top = target.getBoundingClientRect().top;
    if (top >= 0) return;
    const smooth = !reduceMotion && !document.documentElement.classList.contains('lenis');
    window.scrollTo({ top: scrollY + top - 96, behavior: smooth ? 'smooth' : 'auto' });
  }

  /* ---------- Contrôles ---------- */
  search.addEventListener('input', () => { state.q = search.value; apply(); });
  search.closest('form').addEventListener('submit', (e) => { e.preventDefault(); search.blur(); });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (search.value) { search.value = ''; state.q = ''; apply(); } else search.blur();
  });

  // « / » : recherche (sauf pendant la saisie dans un autre champ)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    search.focus();
    search.select();
  });

  chips.forEach((c) => c.addEventListener('click', () => {
    const tag = c.dataset.nwTag;
    state.tags = state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : tagValues.filter((t) => t === tag || state.tags.includes(t));
    apply();
    toResults();
  }));
  resetBtns.forEach((b) => b.addEventListener('click', () => {
    state.q = '';
    state.tags = [];
    writeControls();
    apply();
    toResults();
  }));

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(stagger, 150); });

  readURL();
  writeControls();
  apply({ silent: true });

  /* ---------- Grand titre : défilement en pause hors de l'écran ---------- */
  const word = $('.nwhero__word', root);
  if (word && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => word.classList.toggle('is-paused', !e.isIntersecting)).observe(word);
  }

  /* ---------- Chargement : du haut vers le bas ----------
     nav (0.2 s) → titre (Gradient text, 0.45 s) → présentation, boutons et thèmes (intro de js/main.js, ~1 s) ;
     articles à la une, recherche et trait de la colonne gauche visibles à l'arrivée : à partir de INTRO,
     décalés selon leur position verticale. Le délai remplace --d (décalage entre frères, js/components/reveal.js).
     Le reste apparaît au scroll (stagger). */
  const INTRO = 0.5;         // s
  const PER_PX = 0.0008;     // s par px vers le bas (~0.4 s pour 500 px)
  if (!reduceMotion) {
    const shown = $$('.nwhero [data-reveal]', root)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height >= 0 && r.width > 0 && r.top < innerHeight);
    const top = Math.min(...shown.map(({ r }) => r.top));
    shown.forEach(({ el, r }) => {
      el.style.setProperty('--d', `${(INTRO + (r.top - top) * PER_PX).toFixed(2)}s`);
    });
  }
})();
