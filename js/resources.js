/* =========================================================
   Verdon — page Resources · bibliothèque de fichiers à télécharger
   (nav, intro, FAQ, CTA + footer : js/main.js et js/components/ ; vignettes en points : js/components/service-dots.js)
   - Les ressources sont écrites dans le HTML (une carte [data-rs-item] par fichier) : la liste reste lisible
     et indexable sans JS. Chaque carte porte ses facettes : data-category, data-sectors (séparés par des espaces),
     data-format, data-date (tri) et data-keywords (mots-clés cherchés en plus du texte de la carte).
   - Recherche : chaque mot tapé doit se trouver dans le texte de la carte ou ses mots-clés, sans tenir compte
     des accents ni de la casse ; les correspondances sont surlignées dans les titres.
   - Filtres : catégorie (onglets), secteurs et formats (cases : une ressource passe si elle a l'un des choix cochés).
     Le compteur de chaque choix tient compte de la recherche et des autres filtres.
   - Tri (récent, ancien, A–Z) et vue (grille, liste).
   - État dans l'URL (?q=…&category=…&sector=…&format=…&sort=…&view=…) : une sélection se partage par lien,
     et resources.html?category=datasheets ouvre directement une catégorie.
   - Raccourcis : « / » place le curseur dans la recherche, Échap la vide.
   - Chargement : apparitions du haut vers le bas, comme la page Contact (voir plus bas).
   ========================================================= */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const root = $('[data-resources]');
  if (!root) return;

  const grid = $('[data-rs-grid]', root);
  const results = $('[data-rs-results]', root);
  const search = $('[data-rs-search]', root);
  const sortSelect = $('[data-rs-sort]', root);
  const viewBtns = $$('[data-rs-view]', root);
  const countEl = $('[data-rs-count]', root);
  const emptyEl = $('[data-rs-empty]', root);
  const resetBtns = $$('[data-rs-reset]', root);
  const filtersToggle = $('[data-rs-filters-toggle]', root);
  const filtersPanel = $('[data-rs-filters]', root);
  const activeEl = $('[data-rs-active]', root);
  const live = $('[data-rs-live]');
  const inputs = {
    category: $$('input[name="category"]', root),
    sector: $$('input[name="sector"]', root),
    format: $$('input[name="format"]', root),
  };

  // texte comparable : sans accents, en minuscules
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Ressources ---------- */
  const items = $$('[data-rs-item]', grid).map((el, order) => {
    const title = $('[data-rs-title]', el);
    const titleText = title.textContent;
    // titre replié caractère par caractère : une position trouvée dans le texte replié renvoie au texte d'origine
    let folded = '';
    const map = [];
    for (let i = 0; i < titleText.length; i++) {
      const c = fold(titleText[i]);
      for (let k = 0; k < c.length; k++) map.push(i);
      folded += c;
    }
    // lien « DOWNLOAD » / « REQUEST » nommé par le titre et le fichier pour les lecteurs d'écran
    const link = $('.rscard__dl', el);
    const file = $$('.rscard__file > *', el).map((n) => n.textContent.trim()).join(', ');
    if (link) link.setAttribute('aria-label', `${link.textContent.trim()}: ${titleText.trim()} (${file})`);
    return {
      el, order, title, titleText, folded, map,
      name: titleText.trim(),
      category: el.dataset.category,
      sectors: (el.dataset.sectors || '').split(/\s+/).filter(Boolean),
      format: el.dataset.format,
      date: el.dataset.date || '',
      text: fold(`${el.textContent} ${el.dataset.keywords || ''}`).replace(/\s+/g, ' '),
      shown: true,
      marked: false,
    };
  });
  $$('[data-rs-total]').forEach((el) => { el.textContent = items.length; });

  const SORTS = {
    new: (a, b) => b.date.localeCompare(a.date) || a.order - b.order,
    old: (a, b) => a.date.localeCompare(b.date) || a.order - b.order,
    az: (a, b) => a.name.localeCompare(b.name, 'en'),
  };

  /* ---------- État ↔ URL ↔ contrôles ---------- */
  const state = { q: '', category: 'all', sector: [], format: [], sort: 'new', view: 'grid' };
  const values = (list) => list.map((i) => i.value);

  function readURL() {
    const p = new URLSearchParams(location.search);
    const list = (k) => (p.get(k) || '').split(',').filter((v) => values(inputs[k]).includes(v));
    state.q = p.get('q') || '';
    state.category = values(inputs.category).includes(p.get('category')) ? p.get('category') : 'all';
    state.sector = list('sector');
    state.format = list('format');
    state.sort = p.get('sort') in SORTS ? p.get('sort') : 'new';
    state.view = p.get('view') === 'list' ? 'list' : 'grid';
  }
  function writeControls() {
    search.value = state.q;
    inputs.category.forEach((i) => { i.checked = i.value === state.category; });
    inputs.sector.forEach((i) => { i.checked = state.sector.includes(i.value); });
    inputs.format.forEach((i) => { i.checked = state.format.includes(i.value); });
    sortSelect.value = state.sort;
  }
  // différé : Safari refuse plus de 100 replaceState en 30 s (frappe rapide dans la recherche)
  let urlTimer = 0;
  function writeURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const p = new URLSearchParams();
      if (state.q.trim()) p.set('q', state.q.trim());
      if (state.category !== 'all') p.set('category', state.category);
      if (state.sector.length) p.set('sector', state.sector.join(','));
      if (state.format.length) p.set('format', state.format.join(','));
      if (state.sort !== 'new') p.set('sort', state.sort);
      if (state.view !== 'grid') p.set('view', state.view);
      const qs = p.toString().replace(/%2C/g, ',');
      history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    }, 300);
  }

  /* ---------- Filtrage ---------- */
  // skip : facette ignorée (compteurs de cette facette : « combien si je choisis aussi ceci »)
  function passes(it, terms, skip) {
    if (skip !== 'category' && state.category !== 'all' && it.category !== state.category) return false;
    if (skip !== 'sector' && state.sector.length && !state.sector.some((s) => it.sectors.includes(s))) return false;
    if (skip !== 'format' && state.format.length && !state.format.includes(it.format)) return false;
    return terms.every((t) => it.text.includes(t));
  }

  function updateCounts(terms) {
    const has = {
      category: (it, v) => v === 'all' || it.category === v,
      sector: (it, v) => it.sectors.includes(v),
      format: (it, v) => it.format === v,
    };
    Object.keys(inputs).forEach((facet) => {
      const pool = items.filter((it) => passes(it, terms, facet));
      inputs[facet].forEach((input) => {
        const n = pool.filter((it) => has[facet](it, input.value)).length;
        const label = input.closest('label');
        $('[data-rs-n]', label).textContent = n;
        label.classList.toggle('is-empty', n === 0);
      });
    });
  }

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

  const visibleCards = () => Array.from(grid.children).filter((el) => !el.hidden);

  // décalage d'apparition (reveal.js) des cartes pas encore apparues : de gauche à droite dans chaque rangée
  function stagger() {
    const cols = state.view === 'list' ? 1 : getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    visibleCards().forEach((el, i) => {
      if (!el.classList.contains('is-in')) el.style.setProperty('--d', `${(i % cols) * 80}ms`);
    });
  }

  // cartes déjà apparues qui reviennent (filtre, tri, vue) : courte ré-apparition en cascade
  function pop(list, flow) {
    if (reduceMotion || !list.length) return;
    const order = visibleCards();
    const els = list.filter((el) => el.classList.contains('is-in'));
    els.forEach((el) => el.classList.remove('is-pop'));
    void grid.offsetWidth;   // redémarre l'animation CSS
    els.forEach((el) => {
      el.style.setProperty('--pop', `${Math.min(order.indexOf(el), 8) * 40}ms`);
      el.classList.add('is-pop');
      // nouvelle venue : un passage du flux sur son pictogramme
      const dots = flow && $('[data-service-dots]', el);
      if (dots) dots.dispatchEvent(new Event('service-dots:play'));
    });
  }
  grid.addEventListener('animationend', (e) => e.target.classList.remove('is-pop'));

  let liveTimer = 0, refreshTimer = 0;
  function announce(n) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      if (live) live.textContent = n ? `${n} resource${n > 1 ? 's' : ''} found` : 'No resources found';
    }, 700);
  }
  // la hauteur de la page change : positions des animations au scroll (CTA, footer) à recalculer
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => window.ScrollTrigger && ScrollTrigger.refresh(), 200);
  }

  /* options : popAll → toutes les cartes réapparaissent (tri, vue, catégorie) ; silent → chargement */
  function apply({ popAll = false, silent = false } = {}) {
    const terms = fold(state.q).split(/\s+/).filter(Boolean);
    const sorted = items.slice().sort(SORTS[state.sort]);
    // ordre du DOM = ordre de tri (les cartes masquées suivent le même ordre)
    if (sorted.some((it, i) => grid.children[i] !== it.el)) grid.append(...sorted.map((it) => it.el));

    const appeared = [];
    let n = 0;
    sorted.forEach((it) => {
      const on = passes(it, terms);
      if (on && !it.shown) appeared.push(it.el);
      it.shown = on;
      it.el.hidden = !on;
      if (on) n++;
      highlight(it, on ? terms : []);
    });

    grid.classList.toggle('is-list', state.view === 'list');
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rsView === state.view)));
    countEl.textContent = n === items.length ? `${n} resources` : `${n} of ${items.length} resources`;
    emptyEl.hidden = n > 0;
    grid.hidden = n === 0;   // sinon le trait du haut de la vue liste double celui de l'état vide
    updateCounts(terms);

    const filtered = state.q.trim() || state.category !== 'all' || state.sector.length || state.format.length;
    resetBtns.forEach((b) => { b.disabled = !filtered; });
    if (activeEl) activeEl.textContent = state.sector.length + state.format.length || '';

    stagger();
    if (silent) return;
    pop(popAll ? visibleCards() : appeared, !popAll);
    announce(n);
    writeURL();
    refresh();
  }

  // changement depuis la colonne collante : si le haut des résultats est passé, on y remonte
  function toResults() {
    const top = results.getBoundingClientRect().top;
    if (top >= 0) return;
    const smooth = !reduceMotion && !document.documentElement.classList.contains('lenis');
    window.scrollTo({ top: scrollY + top - (parseFloat(getComputedStyle(results).scrollMarginTop) || 0), behavior: smooth ? 'smooth' : 'auto' });
  }

  /* ---------- Contrôles ---------- */
  search.addEventListener('input', () => { state.q = search.value; apply(); });
  search.closest('form').addEventListener('submit', (e) => { e.preventDefault(); search.blur(); });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (search.value) { search.value = ''; state.q = ''; apply(); } else search.blur();
  });
  const clearBtn = $('[data-rs-clear]', root);
  if (clearBtn) clearBtn.addEventListener('click', () => { search.value = ''; state.q = ''; apply(); search.focus(); });

  // « / » : recherche (sauf pendant la saisie dans un autre champ)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    search.focus();
    search.select();
  });

  inputs.category.forEach((i) => i.addEventListener('change', () => { state.category = i.value; apply({ popAll: true }); }));
  ['sector', 'format'].forEach((facet) => inputs[facet].forEach((i) => i.addEventListener('change', () => {
    state[facet] = inputs[facet].filter((x) => x.checked).map((x) => x.value);
    apply();
    toResults();
  })));
  sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; apply({ popAll: true }); toResults(); });
  viewBtns.forEach((b) => b.addEventListener('click', () => {
    if (state.view === b.dataset.rsView) return;
    state.view = b.dataset.rsView;
    apply({ popAll: true });
  }));
  resetBtns.forEach((b) => b.addEventListener('click', () => {
    Object.assign(state, { q: '', category: 'all', sector: [], format: [] });
    writeControls();
    apply({ popAll: true });
    toResults();
  }));

  // tablette et mobile : filtres repliés sous le bouton FILTERS
  if (filtersToggle && filtersPanel) filtersToggle.addEventListener('click', () => {
    const open = filtersToggle.getAttribute('aria-expanded') !== 'true';
    filtersToggle.setAttribute('aria-expanded', String(open));
    filtersPanel.classList.toggle('is-open', open);
    refresh();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(stagger, 150); });

  readURL();
  writeControls();
  apply({ silent: true });

  /* ---------- Chargement : du haut vers le bas ----------
     nav (0.2 s) → titre (Gradient text, 0.45 s) → infos et présentation (intro de js/main.js, ~1 s)
     → trait de l'en-tête (0.8 s, css/resources.css) → éléments du corps visibles à l'arrivée, à partir de INTRO,
     décalés selon leur position (vers le bas, puis vers la droite : cartes d'une même rangée).
     Le délai remplace --d (décalage entre frères, js/components/reveal.js). Le reste apparaît au scroll (stagger). */
  const INTRO = 1.45;        // s
  const PER_PX = 0.0008;     // s par px vers le bas (~0.4 s pour 500 px)
  const PER_PX_X = 0.00025;  // s par px vers la droite (~90 ms d'une carte à la suivante)
  if (!reduceMotion) {
    const shown = $$('[data-reveal]', root)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height > 0 && r.top < innerHeight);
    const top = Math.min(...shown.map(({ r }) => r.top));
    const left = Math.min(...shown.map(({ r }) => r.left));
    shown.forEach(({ el, r }) => {
      el.style.setProperty('--d', `${(INTRO + (r.top - top) * PER_PX + (r.left - left) * PER_PX_X).toFixed(2)}s`);
    });
  }
})();
