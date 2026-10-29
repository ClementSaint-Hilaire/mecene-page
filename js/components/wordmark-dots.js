/* =========================================================
   Composant « Wordmark dots » — signature « verdon groupe » en matrice de points
   (Figma 273:216), qui se colore au survol.
   Données : assets/wordmark-dots.json (exportées du nœud Figma)
     w, h : taille du cadre Figma   r : rayon d'un point
     pts  : [x0, y0, x1, y1, …] centres des points, en unités du cadre
   Chaque point a une « chaleur » (0 → 1) qui monte près du curseur et redescend
   lentement après son passage : en chauffant, le point passe de la couleur du texte (--ink) au dégradé
   habituel (lilas → pêche → ambre → vert, --gt-c1…--gt-c4) en doublant de taille,
   puis y revient en refroidissant.
   Canvas 2D, ~900 points : la boucle ne tourne que pendant le survol et le refroidissement.
   ========================================================= */
(() => {
  'use strict';

  const RADIUS = 72;      // rayon d'influence du curseur, en unités du cadre (936 de large)
  const HEAT_IN = 0.08;   // constante de temps de la montée (s)
  const HEAT_OUT = 0.7;   // constante de temps du refroidissement (s) : la traînée
  const GROW = 1;         // grossissement d'un point chaud (rayon × 2) : à ~1,7 px de diamètre, un point n'est
                          // que pixels semi-transparents et ses couleurs pastel se délavent dans le fond clair
  const BUCKETS = 48;     // niveaux de couleur (un tracé par niveau)

  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => {
    const hex = (css.getPropertyValue(name).trim() || fallback).replace('#', '');
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  // rampe chaleur → couleur : couleur du texte, puis le dégradé habituel (lilas dominant, comme Gradient text)
  const RAMP = [
    [0, color('--ink', '#1c1b19')],
    [0.2, color('--gt-c1', '#d6b3ff')],
    [0.7, color('--gt-c2', '#ffb592')],
    [0.86, color('--gt-c3', '#fabb15')],
    [1, color('--gt-c4', '#5fe219')],
  ];
  const PALETTE = Array.from({ length: BUCKETS }, (_, b) => {
    const t = b / (BUCKETS - 1);
    let k = 1;
    while (k < RAMP.length - 1 && t > RAMP[k][0]) k++;
    const [t0, c0] = RAMP[k - 1], [t1, c1] = RAMP[k];
    const u = (t - t0) / (t1 - t0);
    return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * u)).join(',')})`;
  });

  async function init(root) {
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const data = await fetch(root.dataset.src || 'assets/wordmark-dots.json').then((r) => r.json());
    const N = data.pts.length / 2;
    const P = Float32Array.from(data.pts);
    const heat = new Float32Array(N);
    const groups = Array.from({ length: BUCKETS }, () => []);

    let W = 0, H = 0, dpr = 1, scale = 1;
    function resize() {
      const r = root.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      scale = W / data.w;
      draw();
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      groups.forEach((g) => { g.length = 0; });
      for (let k = 0; k < N; k++) groups[Math.round(heat[k] * (BUCKETS - 1))].push(k);
      groups.forEach((g, b) => {
        if (!g.length) return;
        const r = data.r * scale * (1 + GROW * b / (BUCKETS - 1));
        ctx.fillStyle = PALETTE[b];
        ctx.beginPath();
        for (const k of g) {
          const x = P[2 * k] * scale, y = P[2 * k + 1] * scale;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      });
    }

    // curseur en unités du cadre ; on chauffe le long du segment parcouru depuis la dernière image
    // pour que les mouvements rapides laissent une traînée continue
    let inside = false, px = 0, py = 0, lx = 0, ly = 0, touchHold = 0;
    function point(e) {
      const r = root.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * data.w;
      py = ((e.clientY - r.top) / r.height) * data.h;
    }
    function enter(e) { clearTimeout(touchHold); point(e); lx = px; ly = py; inside = true; start(); }
    root.addEventListener('pointerenter', enter);
    root.addEventListener('pointerdown', enter);
    root.addEventListener('pointermove', (e) => { if (!inside) return enter(e); point(e); start(); });
    // au toucher, pointerleave suit aussitôt le tap : on laisse le point chauffer un instant
    ['pointerleave', 'pointercancel'].forEach((t) => root.addEventListener(t, (e) => {
      if (e.pointerType === 'touch') touchHold = setTimeout(() => { inside = false; }, 300);
      else inside = false;
    }));

    let raf = 0, last = 0;
    function step(dt) {
      const sx = px - lx, sy = py - ly, len2 = sx * sx + sy * sy;
      const aIn = 1 - Math.exp(-dt / HEAT_IN), aOut = 1 - Math.exp(-dt / HEAT_OUT);
      let warm = inside;
      for (let k = 0; k < N; k++) {
        let target = 0;
        if (inside) {
          const x = P[2 * k], y = P[2 * k + 1];
          const t = len2 ? Math.max(0, Math.min(1, ((x - lx) * sx + (y - ly) * sy) / len2)) : 0;
          const d = Math.hypot(x - lx - sx * t, y - ly - sy * t);
          if (d < RADIUS) { const f = 1 - d / RADIUS; target = f * f * (3 - 2 * f); }
        }
        const h = heat[k];
        heat[k] = h + (target - h) * (target > h ? aIn : aOut);
        if (heat[k] < 0.002) heat[k] = 0;
        else warm = true;
      }
      lx = px; ly = py;
      return warm;
    }
    function loop(t) {
      const dt = last ? Math.min(t - last, 100) / 1000 : 1 / 60;
      last = t;
      const warm = step(dt);
      draw();
      raf = warm ? requestAnimationFrame(loop) : 0;
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

    new ResizeObserver(resize).observe(root);
    resize();
  }

  document.querySelectorAll('[data-wordmark]').forEach((root) => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      init(root).catch((err) => console.error('[wordmark-dots]', err));
    }, { rootMargin: '400px 0px' });
    io.observe(root);
  });
})();
