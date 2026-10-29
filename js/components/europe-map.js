/* =========================================================
   Composant « Europe map » — carte en matrice de points, vue isométrique,
   en rotation lente (plateau tournant centré sur la France / Belgique).
   Données : assets/europe-dots.json (générées depuis Natural Earth 1:50m)
     pts   : [x0, y0, x1, y1, …] en unités carte autour du centre
     sites : [{ name, color, i }] → i = index du point de la grille coloré
   Les sites sont des points de la grille comme les autres, seulement colorés.
   Canvas 2D, ~900 points : rendu seulement quand la carte est à l'écran.
   ========================================================= */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TILT = 0.56;            // écrasement vertical (vue isométrique)
  const TURN_SECONDS = 90;      // durée d'un tour complet
  const INK = 'rgba(28, 27, 25, 0.32)';

  async function init(root) {
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const data = await fetch(root.dataset.src || 'assets/europe-dots.json').then((r) => r.json());
    const N = data.pts.length / 2;
    const P = Float32Array.from(data.pts);
    const siteOf = new Map(data.sites.map((s) => [s.i, s]));
    const hitR = new Float32Array(data.sites.length * 2);

    let W = 0, H = 0, dpr = 1, scale = 1, dotR = 1;
    function resize() {
      const r = root.getBoundingClientRect();
      W = r.width; H = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      // le disque de points doit couvrir le cadre quelle que soit la rotation
      const needX = W / 2, needY = (H / 2) / TILT;
      scale = Math.hypot(needX, needY) / (data.radius * 0.92);
      dotR = Math.max(0.9, data.step * scale * 0.24);
      draw();
    }

    let angle = -0.35, reveal = reduce ? 1 : 0;
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, ca = Math.cos(angle), sa = Math.sin(angle);
      const revealR = reveal * data.radius * 1.05;
      // points gris en un seul tracé
      ctx.fillStyle = INK;
      ctx.beginPath();
      for (let k = 0; k < N; k++) {
        if (siteOf.has(k)) continue;
        const x = P[2 * k], y = P[2 * k + 1];
        if (reveal < 1 && x * x + y * y > revealR * revealR) continue;
        const sx = cx + (x * ca - y * sa) * scale;
        const sy = cy + (x * sa + y * ca) * scale * TILT;
        if (sx < -dotR || sx > W + dotR || sy < -dotR || sy > H + dotR) continue;
        ctx.moveTo(sx + dotR, sy);
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      }
      ctx.fill();
      // sites : mêmes points, colorés
      data.sites.forEach((s, j) => {
        const x = P[2 * s.i], y = P[2 * s.i + 1];
        if (reveal < 1 && x * x + y * y > revealR * revealR) return;
        const sx = cx + (x * ca - y * sa) * scale;
        const sy = cy + (x * sa + y * ca) * scale * TILT;
        hitR[2 * j] = sx; hitR[2 * j + 1] = sy;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(sx, sy, dotR, 0, Math.PI * 2); ctx.fill();
      });
    }

    // nom du site au survol (title natif)
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let hit = '';
      data.sites.forEach((s, j) => { if (Math.hypot(hitR[2 * j] - mx, hitR[2 * j + 1] - my) < Math.max(6, dotR * 3)) hit = s.name; });
      canvas.title = hit;
      canvas.style.cursor = hit ? 'help' : '';
    });

    // boucle : seulement à l'écran, ~30 i/s (la rotation est lente)
    let visible = false, raf = 0, last = 0, revealStart = 0;
    function loop(t) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (t - last >= 32) {
        const dt = last ? Math.min(t - last, 100) / 1000 : 0;
        last = t;
        angle += (dt * Math.PI * 2) / TURN_SECONDS;
        if (reveal < 1) { reveal = Math.min(1, (t - revealStart) / 1600); reveal = 1 - Math.pow(1 - reveal, 3); }
        draw();
      }
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduce) { last = 0; if (!revealStart) revealStart = performance.now(); raf = requestAnimationFrame(loop); } }

    new ResizeObserver(resize).observe(root);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0.1 }).observe(root);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    resize();
  }

  document.querySelectorAll('[data-europe-map]').forEach((root) => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      init(root).catch((err) => console.error('[europe-map]', err));
    }, { rootMargin: '400px 0px' });
    io.observe(root);
  });
})();
