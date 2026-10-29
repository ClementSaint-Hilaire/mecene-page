/* =========================================================
   Composant « Service dots » — pictogramme en matrice de points de chaque carte « Our services »
   et « Expertises » (à la place des étoiles). Une grille de 24 × 16 points par carte, dessinée en canvas.
   Légende des grilles (ARTS) :
     '#' trait (couleur du texte, --ink)        '+' remplissage (gris, --ink-2)
     'o' trait parcouru par le flux (--ink)      '~' fluide parcouru par le flux (gris, --ink-2)
     '.' point éteint (fond de la matrice, très léger)
     src : points de départ du flux [x, y]
   Au survol de la carte, des impulsions partent des sources et suivent le tracé (câbles, tuyaux, air,
   charges dans la structure) : la distance est mesurée de proche en proche le long des points flux.
   En passant, un point quitte sa couleur de repos pour le dégradé habituel
   (lilas → pêche → ambre → vert, --gt-c1…--gt-c4) et grossit un peu.
   Apparition : quand la carte reçoit .is-in (reveal.js), les points montent du bas,
   puis un premier passage du flux montre ce que le pictogramme illustre.
   La boucle ne tourne que pendant l'apparition et le flux.
   ========================================================= */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLS = 24, ROWS = 16;
  const DOT = 0.27;        // rayon d'un point, en fraction du pas de la grille
  const GROW = 0.6;        // grossissement d'un point au plus fort du flux (les couleurs pastel restent lisibles)
  const SPEED = 16;        // vitesse des impulsions (points / s)
  const WAVE = 12;         // écart entre deux impulsions (points)
  const TAIL = 0.6;        // longueur de la traînée derrière une impulsion, en fraction de WAVE
  const FADE = 0.3;        // constante de temps d'allumage / d'extinction du flux (s)
  const START = 0.2;       // délai de l'apparition après .is-in sur la carte (s)
  const RISE = 0.55;       // durée de la montée de bas en haut (s)
  const JITTER = 0.15;     // désordre ajouté au délai de chaque point (s)
  const POP = 0.45;        // durée d'apparition d'un point (s)
  const INTRO_FLOW = 1.6;  // durée du premier passage du flux après l'apparition (s)
  const BUCKETS = 32;      // niveaux de couleur du flux
  const REVEAL_END = RISE + JITTER + POP;

  const ARTS = {
    // skid : cuve, pompe et échangeur sur un châssis commun, reliés par la tuyauterie
    skid: { src: [[0, 7]], grid: [
      '........................',
      '........................',
      '..###...................',
      '.#...#..................',
      '.#...#..#####..######...',
      '.#...#..#####..#~~~~~~~~',
      '.#~~~#....#....#~...#...',
      '~~~~~#...###...#~~~~#...',
      '.#~~~#..#...#..#...~#...',
      '.#~~~~~~~~~~~~~~~~~~#...',
      '..###...#...#..#....#...',
      '.#...#...###...######...',
      '########################',
      '#...#...#...#...#...#..#',
      '########################',
      '........................',
    ] },
    // portique : les tuyaux reposent sur la poutre, les charges descendent jusqu'aux pieds
    support: { src: [[11, 6], [12, 6]], grid: [
      '........................',
      '...###.....###..........',
      '..#...#...#...#...##....',
      '..#...#...#...#..#..#...',
      '..#...#...#...#..#..#...',
      '...###.....###....##....',
      '.oooooooooooooooooooooo.',
      '.o....................o.',
      '.oo..................oo.',
      '.o.o................o.o.',
      '.o..o..#++++++++#..o..o.',
      '.o...o.##########.o...o.',
      '.oooooooooooooooooooooo.',
      '.o....................o.',
      '.o....................o.',
      'ooo..................ooo',
    ] },
    // tableau basse tension : arrivée par le bas, jeux de barres, rangées de disjoncteurs
    lowvoltage: { src: [[6, 15]], grid: [
      '...##################...',
      '...#................#...',
      '...#..ooooooooooooo.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.............#...',
      '...#..o.............#...',
      '...#..ooooooooooooo.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.............#...',
      '...#..o.............#...',
      '...###o##############...',
      '....#.o............#....',
    ] },
    // deux conduites en parallèle avec coudes, brides et vanne
    pipework: { src: [[0, 3], [0, 8]], grid: [
      '..........###...........',
      '......#....#............',
      '####################....',
      '~~~~~~~~~~~~~~~~~~~~#...',
      '###################~#...',
      '......#...........#~#...',
      '.........#........#~#...',
      '###############...#~#...',
      '~~~~~~~~~~~~~~~#..#~#...',
      '##############~#..#~#...',
      '.........#...#~#..#~#...',
      '.............#~#.##~##..',
      '.............#~#..#~#...',
      '............##~##.#~#...',
      '.............#~#..#~#...',
      '.............#~#..#~#...',
    ] },
    // allée froide confinée : l'air monte du faux plancher et traverse les serveurs des deux baies
    aisle: { src: [[0, 15]], grid: [
      '........................',
      '..####################..',
      '..#....#........#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#....#.~....~.#....#..',
      '#########~####~#########',
      '~~~~~~~~~~~~~~~.........',
    ] },
    // schéma unifilaire : transformateur, jeu de barres, départs vers les charges
    power: { src: [[10, 9]], grid: [
      '.........###............',
      '........#...#...........',
      '........#...#...........',
      '........#...#...........',
      '.........###............',
      '........#...#...........',
      '........#...#...........',
      '........#...#...........',
      '.........###............',
      '..........o.............',
      '..ooooooooooooooooo.....',
      '..o...o...o...o...o.....',
      '..o...o...o...o...o.....',
      '.ooo.ooo.ooo.ooo.ooo....',
      '.ooo.ooo.ooo.ooo.ooo....',
      '.ooo.ooo.ooo.ooo.ooo....',
    ] },
    // goutte et puce : boucle d'eau à travers la plaque froide en serpentin
    liquid: { src: [[7, 5]], grid: [
      '........................',
      '..............#.#.#.#...',
      '....#.......##########..',
      '...#+#......#........#..',
      '...#+#......#........##.',
      '..#+++#ooooooooooooo.#..',
      '.#+++++#....#......o.##.',
      '#+++++++#...#.oooooo.#..',
      '#+++++++#...#.o......##.',
      '#+++++++#...#.oooooo.#..',
      '#+++++++#...#......o.##.',
      '.#+++++#oooooooooooo.#..',
      '..#####.....#........#..',
      '............##########..',
      '..............#.#.#.#...',
      '........................',
    ] },

    /* --- cartes « Expertises » --- */
    // sciences de la vie : double hélice d'ADN, le flux court le long des brins
    pharma: { src: [[0, 3], [0, 12]], grid: [
      '........................',
      '........................',
      '........................',
      'oo........oooo........oo',
      '.ooo....ooo..ooo....ooo.',
      '.+.oo..oo..+.+.oo..oo..+',
      '.+..oooo.+.+.+..oooo.+.+',
      '.+.+.oo..+.+.+.+.oo..+.+',
      '.+.+.oo..+.+.+.+.oo..+.+',
      '.+..oooo.+.+.+..oooo.+.+',
      '.+.oo..oo..+.+.oo..oo..+',
      '.ooo....ooo..ooo....ooo.',
      'oo........oooo........oo',
      '........................',
      '........................',
      '........................',
    ] },
    // énergie : pylône à treillis, le courant passe d'un câble à l'autre par les consoles
    energy: { src: [[0, 6], [0, 10]], grid: [
      '...........##...........',
      '..........#..#..........',
      '..........#..#..........',
      '..oooooooooooooooooooo..',
      '..o.......#..#.......o..',
      '.o.........##.........o.',
      'o.........#..#.........o',
      '....oooooooooooooooo....',
      '....o....#....#....o....',
      '...o.....##..##.....o...',
      'ooo.....#..##..#.....ooo',
      '........#..##..#........',
      '.......#..#..#..#.......',
      '.......#.#....#.#.......',
      '......#.#......#.#......',
      '......##........##......',
    ] },
    // data centers : trois baies vues de face, l'activité balaie les serveurs
    datacenter: { src: [[0, 8]], grid: [
      '........................',
      '#######.#######.#######.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#.....#.#.....#.#.....#.',
      '#######.#######.#######.',
      '.#...#...#...#...#...#..',
    ] },
    // semi-conducteurs : wafer et ses puces, qui s'allument en anneaux depuis le centre
    semiconductor: { src: [[11, 7]], grid: [
      '.........######.........',
      '.......##..~~..##.......',
      '......##...~~...##......',
      '.....##..........##.....',
      '.....#..~~.~~.~~..#.....',
      '....#...~~.~~.~~...#....',
      '....#..............#....',
      '....#~~.~~.~~.~~.~~#....',
      '....#~~.~~.~~.~~.~~#....',
      '....#..............#....',
      '....#...~~.~~.~~...#....',
      '.....#..~~.~~.~~..#.....',
      '.....##..........##.....',
      '......##...~~...##......',
      '.......##..~~..##.......',
      '.........######.........',
    ] },
  };
  const KINDS = '.#+o~';   // index = genre du point ; >= 3 : parcouru par le flux

  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => {
    const hex = (css.getPropertyValue(name).trim() || fallback).replace('#', '');
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const INK = color('--ink', '#1c1b19');
  const GRADIENT = [color('--gt-c1', '#d6b3ff'), color('--gt-c2', '#ffb592'), color('--gt-c3', '#fabb15'), color('--gt-c4', '#5fe219')];
  const BG = `rgba(${INK.join(',')},0.08)`;
  // rampe flux → couleur : couleur de repos, puis le dégradé habituel (lilas dominant, comme Gradient text)
  const palette = (rest) => {
    const ramp = [[0, rest], [0.2, GRADIENT[0]], [0.7, GRADIENT[1]], [0.86, GRADIENT[2]], [1, GRADIENT[3]]];
    return Array.from({ length: BUCKETS }, (_, b) => {
      const t = b / (BUCKETS - 1);
      let k = 1;
      while (k < ramp.length - 1 && t > ramp[k][0]) k++;
      const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k];
      const u = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * u)).join(',')})`;
    });
  };
  const PAL_INK = palette(INK);
  const PAL_MUTED = palette(color('--ink-2', '#7b7a7a'));

  const outBack = (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  const hash = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  // impulsion au point situé à `front` points derrière le front de flux : tête vive, traînée qui s'éteint
  const pulse = (front) => {
    if (front < 0) return 0;
    const ph = (front / WAVE) % 1;
    return ph < TAIL ? (1 - ph / TAIL) ** 2 : 0;
  };

  function prepare(art) {
    const n = COLS * ROWS;
    const kind = new Uint8Array(n), dist = new Float32Array(n).fill(-1), delay = new Float32Array(n);
    art.grid.forEach((row, y) => { for (let x = 0; x < COLS; x++) kind[y * COLS + x] = Math.max(0, KINDS.indexOf(row[x])); });
    // distance le long du tracé : parcours en largeur des points flux (8 voisins) depuis les sources
    const queue = art.src.map(([x, y]) => y * COLS + x);
    queue.forEach((i) => { dist[i] = 0; });
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % COLS, y = (i - x) / COLS;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * COLS + nx;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || kind[j] < 3 || dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
    for (let i = 0; i < n; i++) {
      const x = i % COLS, y = (i - x) / COLS;
      // point flux sans chemin jusqu'à une source : distance à vol d'oiseau
      if (kind[i] >= 3 && dist[i] < 0) dist[i] = Math.min(...art.src.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
      delay[i] = ((ROWS - 1 - y) / (ROWS - 1)) * RISE + hash(i) * JITTER;
    }
    return { kind, dist, delay };
  }

  function init(root) {
    const art = ARTS[root.dataset.serviceDots];
    if (!art) return;
    const { kind, dist, delay } = prepare(art);
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const card = root.closest('.gcard, .xcard') || root;
    const revealEl = root.closest('[data-reveal]');

    let W = 0, H = 0, dpr = 1;
    function resize() {
      // offset* : taille de mise en page, sans la rotation de la carte pendant son apparition
      W = root.offsetWidth; H = root.offsetHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw(performance.now());
    }

    let shown = reduce ? -Infinity : null;   // instant de départ de l'apparition (null : pas encore)
    let hover = false, introFrom = 0, introUntil = 0, level = 0, flowT = 0;

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (shown === null) return;
      const t = (now - shown) / 1000;
      const step = Math.min(W / COLS, H / ROWS), r0 = step * DOT;
      for (let i = 0; i < kind.length; i++) {
        const p = Math.min(1, (t - delay[i]) / POP);
        if (p <= 0) continue;
        const k = kind[i], x = i % COLS, y = (i - x) / COLS;
        let r = r0 * outBack(p);
        if (k === 0) {
          r *= 0.75;
          ctx.fillStyle = BG;
        } else {
          const heat = k >= 3 && level > 0 ? level * pulse(flowT * SPEED - dist[i]) : 0;
          ctx.fillStyle = (k === 1 || k === 3 ? PAL_INK : PAL_MUTED)[Math.round(heat * (BUCKETS - 1))];
          r *= 1 + GROW * heat;
        }
        ctx.beginPath();
        ctx.arc((x + 0.5) * step, (y + 0.5) * step, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let raf = 0, last = 0;
    function frame(now) {
      const dt = last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      const on = hover || (now > introFrom && now < introUntil);
      level += ((on ? 1 : 0) - level) * (1 - Math.exp(-dt / FADE));
      // flux éteint : le prochain repartira des sources
      if (!on && level < 0.002) { level = 0; flowT = 0; } else flowT += dt;
      draw(now);
      const revealing = shown !== null && now < shown + REVEAL_END * 1000;
      raf = revealing || on || level > 0 || now < introUntil ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    function reveal() {
      shown = performance.now() + START * 1000;
      introFrom = shown + REVEAL_END * 800;
      introUntil = introFrom + INTRO_FLOW * 1000;
      start();
    }

    if (!reduce) {
      if (!revealEl || revealEl.classList.contains('is-in')) reveal();
      else {
        const mo = new MutationObserver(() => {
          if (!revealEl.classList.contains('is-in')) return;
          mo.disconnect();
          reveal();
        });
        mo.observe(revealEl, { attributes: true, attributeFilter: ['class'] });
      }
      card.addEventListener('pointerenter', () => { hover = true; start(); });
      card.addEventListener('pointerleave', () => { hover = false; });
    }

    new ResizeObserver(resize).observe(root);
  }

  document.querySelectorAll('[data-service-dots]').forEach(init);
})();
