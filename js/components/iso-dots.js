/* =========================================================
   Composant « Iso dots » — illustrations isométriques animées en matrice de points
   (page Data center : visuels des 4 cartes « The growth of Data Centres… », .dcard__img).
   Chaque scène est dessinée en projection isométrique 2:1 (pavés éclairés en haut à gauche, tubes, plans)
   dans un petit canvas hors écran d'un pixel par point, puis tramée comme le campus 3D
   (js/components/package-3d.js) : un point par cellule, rayon selon la luminosité du dessin,
   teinte du dessin (blanc / gris, ou le dégradé habituel lilas → pêche → ambre → vert, --gt-c1…--gt-c4).
   Les points éteints de la matrice forment un calque fixe, très léger.
   Scènes (SCENES, choisies par data-iso-dots) :
     schedule     délais : le planning (conception, fabrication, installation) se comprime contre l'échéance,
                  pendant que l'équipement critique, commandé dès la conception, avance sur la voie des achats
                  et arrive au jalon juste à temps
     integration  intégration : structure, froid, courant et sécurité arrivent chacun de leur côté
                  et s'assemblent autour des baies ; les interfaces s'allument, puis fluides et courant circulent
     quality      qualité : des skids de tuyauterie passent sous un portique de mesure ; la nappe laser
                  trace leur profil, chaque pièce contrôlée s'éclaire, son étiquette passe au vert, coche et cote
     scale        déploiement : depuis l'usine, des camions livrent le même module sur trois sites ;
                  les bâtiments s'élèvent module après module, chaque site terminé s'allume
   Apparition : quand la carte reçoit .is-in (reveal.js), les points montent du bas.
   La boucle ne tourne que quand l'illustration est à l'écran ; image fixe si prefers-reduced-motion.
   ========================================================= */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 4;          // pas de la grille de points (px CSS) quand l'illustration fait au moins WIDE px de large
  const CELL_S = 3;        // pas en dessous (vignettes de la maquette : 558 px), plus fin pour garder le détail
  const WIDE = 640;
  const ZS = 1.22;         // hauteur d'une unité verticale (projection 2:1 : vue plongeante à 30°)
  const TOP = 1, LEFT = 0.66, RIGHT = 0.4;   // éclairage des faces visibles : dessus, face avant gauche, face avant droite
  const EDGE = 0.55;       // luminosité des arêtes, en fraction de celle de la face
  const OFF_DOT = 0.2;     // rayon d'un point éteint, en fraction du pas
  const OFF_ALPHA = 0.1;   // opacité des points éteints
  const START = 0.2;       // délai de l'apparition après .is-in sur la carte (s)
  const RISE = 0.8;        // durée de la montée de bas en haut (s)
  const JITTER = 0.2;      // désordre ajouté au délai de chaque point (s)
  const POP = 0.45;        // durée d'apparition d'un point (s)
  const REVEAL_END = RISE + JITTER + POP;
  const TAU = Math.PI * 2;

  // couleurs du dégradé (rgb 0 → 255), lues sur les jetons CSS
  const doc = getComputedStyle(document.documentElement);
  const hex = (name, fallback) => {
    const h = (doc.getPropertyValue(name).trim() || fallback).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const GRADIENT = [hex('--gt-c1', '#d6b3ff'), hex('--gt-c2', '#ffb592'), hex('--gt-c3', '#fabb15'), hex('--gt-c4', '#5fe219')];
  const WHITE = [255, 255, 255];
  const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  // position u (0 → 1) dans le dégradé, lilas dominant comme Gradient text
  const ramp = (u) => (u < 0.62 ? mix(GRADIENT[0], GRADIENT[1], Math.max(0, u) / 0.62)
    : u < 0.82 ? mix(GRADIENT[1], GRADIENT[2], (u - 0.62) / 0.2)
    : mix(GRADIENT[2], GRADIENT[3], Math.min(1, (u - 0.82) / 0.18)));

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const inOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
  const easeOut = (p) => 1 - (1 - p) ** 3;
  const easeIn = (p) => p ** 3;
  const outBack = (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  const hash = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };

  /* ---------- Dessin isométrique ----------
     Repère : x vers le bas à droite, y vers le bas à gauche, z vers le haut ; on voit les faces +x, +y et +z.
     Matières : un nombre = gris (luminosité 0 → 1) ; { u, t, a } = position dans le dégradé (u, absente : blanc),
     luminosité (t) et opacité (a). Ordre de dessin : du fond vers l'avant (peintre), réglé scène par scène ;
     s.later(clé, fn) + s.flush() trient les objets mobiles par profondeur (clé ≈ x + y).
     s.clip = [x0, x1] : ne dessine que la tranche de la scène comprise entre ces deux plans x (portique de mesure). */
  function painter(ctx) {
    const s = { U: 1, ox: 0, oy: 0, a: 1, clip: null, time: 0 };
    const queue = [];
    const P = (x, y, z) => [s.ox + (x - y) * s.U, s.oy + ((x + y) / 2 - z * ZS) * s.U];
    const inClip = (x) => !s.clip || (x >= s.clip[0] && x < s.clip[1]);

    function paint(m, shade) {
      let c = WHITE, t = 1, a = 1;
      if (typeof m === 'number') t = m;
      else { t = m.t ?? 1; a = m.a ?? 1; if (m.u != null) c = ramp(m.u); }
      ctx.globalAlpha = clamp(s.a * a);
      const k = t * shade;
      return `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;
    }
    function trace(pts, close) {
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = P(p[0], p[1], p[2]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      if (close) ctx.closePath();
    }
    function face(pts, m, shade) {
      trace(pts, true);
      ctx.fillStyle = paint(m, shade); ctx.fill();
      // arêtes un peu plus sombres : les volumes se détachent dans la trame (le trait couvre aussi les jointures)
      ctx.strokeStyle = paint(m, shade * EDGE); ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.stroke();
    }
    function stroke(pts, w, m, shade, close = false) {
      const c = paint(m, shade);
      trace(pts, close);
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }

    // cadrage : les points [x, y, z] donnés (extrémités visibles de la scène) remplissent la grille, à `pad` près
    s.fit = (pts, cols, rows, pad) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y, z] of pts) {
        const sx = x - y, sy = (x + y) / 2 - z * ZS;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      s.U = Math.min((cols * (1 - 2 * pad)) / (x1 - x0), (rows * (1 - 2 * pad)) / (y1 - y0));
      s.ox = cols / 2 - (s.U * (x0 + x1)) / 2;
      s.oy = rows / 2 - (s.U * (y0 + y1)) / 2;
    };
    // pavé (h = 0 : dessus seul, pour les marquages au sol)
    s.box = (x, y, z, w, d, h, m) => {
      if (s.clip) {
        const x0 = Math.max(x, s.clip[0]), x1 = Math.min(x + w, s.clip[1]);
        if (x1 <= x0) return;
        x = x0; w = x1 - x0;
      }
      if (w <= 0 || d <= 0 || h < 0) return;
      const X = x + w, Y = y + d, Z = z + h;
      if (h > 0) {
        face([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], m, RIGHT);
        face([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], m, LEFT);
      }
      face([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], m, TOP);
    };
    // polygone plan (fanion, étiquette, nappe laser…), éclairage donné
    s.poly = (pts, m, shade = 1) => {
      if (!inClip(pts.reduce((v, p) => v + p[0], 0) / pts.length)) return;
      face(pts, m, shade);
    };
    // trait d'épaisseur fixe (w en points)
    s.line = (a, b, w, m, shade = 1) => { if (inClip((a[0] + b[0]) / 2)) stroke([a, b], w, m, shade); };
    s.path = (pts, w, m, shade = 1) => { if (inClip(pts[0][0])) stroke(pts, w, m, shade); };
    // cercle dans un plan (axe : normale du plan), plein si w = 0 ; [a0, a1] : arc
    s.ring = (c, r, axis, w, m, a0 = 0, a1 = TAU) => {
      if (!inClip(c[0])) return;
      const n = Math.max(8, Math.ceil(((a1 - a0) / TAU) * 32)), pts = [];
      for (let i = 0; i <= n; i++) {
        const q = a0 + ((a1 - a0) * i) / n, u = Math.cos(q) * r, v = Math.sin(q) * r;
        pts.push(axis === 'z' ? [c[0] + u, c[1] + v, c[2]] : axis === 'x' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]);
      }
      if (w) stroke(pts, w, m, 1);
      else face(pts, m, 1);
    };
    // tube (conduite, câble, mât) : corps dans l'ombre, reflet décalé vers la lumière
    s.tube = (a, b, r, m) => {
      if (s.clip) {
        if (a[1] === b[1] && a[2] === b[2]) {   // tube parallèle à x : coupé par les plans
          const lo = Math.max(Math.min(a[0], b[0]), s.clip[0]), hi = Math.min(Math.max(a[0], b[0]), s.clip[1]);
          if (hi <= lo) return;
          a = [lo, a[1], a[2]]; b = [hi, b[1], b[2]];
        } else if (!inClip((a[0] + b[0]) / 2)) return;
      }
      const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
      let nx = p[1] - q[1], ny = q[0] - p[0];
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; }   // côté éclairé : en haut à gauche
      const w = 2 * r * s.U, o = w * 0.22;
      ctx.lineCap = 'round';
      ctx.strokeStyle = paint(m, LEFT * 0.8); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      ctx.strokeStyle = paint(m, TOP); ctx.lineWidth = w * 0.45;
      ctx.beginPath(); ctx.moveTo(p[0] + nx * o, p[1] + ny * o); ctx.lineTo(q[0] + nx * o, q[1] + ny * o); ctx.stroke();
    };
    s.later = (key, fn) => queue.push([key, fn]);
    s.flush = () => { queue.sort((p, q) => p[0] - q[0]).forEach(([, fn]) => fn()); queue.length = 0; };
    return s;
  }

  /* ---------- Scènes ----------
     frame : points [x, y, z] qui bordent l'illustration (ce qui dépasse, en mouvement, sort du cadre) ; period : durée d'une boucle (s) ;
     still : instant de la boucle affiché sans animation (prefers-reduced-motion) ;
     draw(s, t) : t = avancement dans la boucle (0 → 1), s.time = temps écoulé (s) pour les mouvements continus */
  const SCENES = {
    /* Increasing Schedule Pressure */
    schedule: {
      period: 9, still: 0.66,
      frame: [[0.1, 9.75, 0], [1.2, 1.5, 3.3], [19, 0.1, 0], [18.9, 9.75, 0]],
      draw(s, t) {
        const X0 = 0.8, GAP = 0.35, CW = 3.4, SQ = 0.35;   // départ du planning, écart entre phases, longueur de l'équipement, compression
        const PHASES = [6, 7, 5];                          // conception, fabrication, installation
        const k = 1 - SQ * (inOut(seg(t, 0.08, 0.55)) - inOut(seg(t, 0.8, 0.98)));
        const L = PHASES.map((v) => v * k);
        const xm = X0 + L[0] + L[1] + 2 * GAP;                                    // jalon : début de l'installation
        const xmEnd = X0 + (PHASES[0] + PHASES[1]) * (1 - SQ) + 2 * GAP;
        // l'équipement part dès la conception et arrive au jalon quand la compression s'arrête ;
        // il s'efface en fin de boucle et revient au départ
        const away = t > 0.88;
        const ca = away ? seg(t, 0.9, 1) : 1 - seg(t, 0.8, 0.88);
        const cx = away ? X0 : X0 + (xmEnd - 0.3 - CW - X0) * inOut(seg(t, 0.02, 0.55));
        const ok = seg(t, 0.55, 0.6) * (1 - seg(t, 0.8, 0.88));                  // arrivé à temps

        // calendrier au sol : 9 mois × 4 semaines
        for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) s.box(i * 2.1 + 0.1, j * 2.45 + 0.1, -0.2, 1.9, 2.25, 0.2, 0.26);

        // jalon tracé au sol sur les deux voies : ambre sous pression, vert à l'arrivée
        const mile = { u: 0.84 + 0.16 * ok };
        s.line([xm, 0.2, 0], [xm, 9.6, 0], 1.2, mile);

        // voie des achats : rail, parcouru en dégradé derrière l'équipement
        for (let x = X0; x < 19; x += 0.5) {
          const done = !away && x + 0.5 <= cx + 0.1;
          s.box(x, 2.1, 0, 0.44, 0.5, 0.18, done ? { u: ((x - X0) / (xmEnd - X0)) * 0.8, a: ca } : 0.5);
        }
        // mât du jalon et fanion, derrière la voie des achats
        const fy = 0.45, flap = Math.sin(s.time * 5) * 0.15;
        s.tube([xm, fy, 0], [xm, fy, 4.9], 0.09, 0.85);
        s.poly([[xm, fy, 4.9], [xm + 2.1, fy, 4.5 + flap], [xm, fy, 4.05]], mile, 0.95);

        // onde à l'arrivée
        const w = seg(t, 0.55, 0.8);
        if (w > 0 && w < 1) s.ring([cx + CW / 2, 2.35, 0.02], 2.2 + w * 3, 'z', 1, { u: 1, a: 1 - w });

        // équipement critique (transformateur) : cuve, ailettes, conservateur, traversées
        s.a = ca;
        const cy = 1.05;
        s.box(cx, cy, 0.18, CW, 2.6, 2.3, 0.94);
        for (let j = 0; j < 3; j++) s.box(cx + CW, cy + 0.35 + j * 0.78, 0.45, 0.38, 0.2, 1.7, 0.8);
        for (let i = 0; i < 4; i++) s.box(cx + 0.4 + i * 0.8, cy + 2.6, 0.45, 0.2, 0.38, 1.7, 0.8);
        s.box(cx + 0.45, cy + 0.3, 2.48, 0.22, 0.22, 0.4, 0.8);
        s.tube([cx + 0.4, cy + 0.42, 2.98], [cx + 2.8, cy + 0.42, 2.98], 0.32, 0.88);
        for (let i = 0; i < 3; i++) s.tube([cx + 0.9 + i * 0.85, cy + 1.75, 2.48], [cx + 0.9 + i * 0.85, cy + 1.75, 3.25], 0.14, 0.95);
        s.a = 1;

        // voie du projet : deux tâches par phase, en escalier (Gantt) ; l'installation s'allume à l'arrivée
        const bars = [];
        let x = X0;
        L.forEach((len, i) => { bars.push([x, len, i]); x += len + GAP; });
        for (const row of [0, 1]) for (const [bx, len, i] of bars) {
          const x0 = bx + (row ? len * 0.3 : 0), y0 = row ? 7.3 : 5.6;
          s.box(x0, y0, 0, len * 0.7, 1.35, 0.9, i === 2 ? 0.55 : i ? 0.78 : 0.94);
          if (i === 2 && ok > 0) s.box(x0, y0, 0, len * 0.7, 1.35, 0.9, { u: 1, a: ok });
        }

        // échéance qui avance : panneau à horloge (aiguilles qui s'emballent), chevrons qui poussent pendant la compression
        const xd = x - GAP + 0.45;
        s.box(xd, 5.3, 0, 0.4, 3.6, 3.4, { u: 0.72 });
        const cc = [xd + 0.4, 7.1, 1.75], q = -s.time * 4;
        s.ring(cc, 1.3, 'x', 1.1, 0.95);
        s.line(cc, [cc[0], cc[1] + Math.cos(q) * 1, cc[2] + Math.sin(q) * 1], 1, 0.95);
        s.line(cc, [cc[0], cc[1] + Math.cos(q / 12) * 0.62, cc[2] + Math.sin(q / 12) * 0.62], 1.3, 0.95);
        const push = Math.sin(Math.PI * seg(t, 0.08, 0.55));
        if (push > 0.01) for (let j = 0; j < 3; j++) {
          const c = xd + 0.9 + j * 1.1;
          const a = push * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.time * 7 + j * 1.3)));
          s.poly([[c, 7.1, 0.02], [c + 0.9, 6.05, 0.02], [c + 1.25, 6.05, 0.02], [c + 0.35, 7.1, 0.02], [c + 1.25, 8.15, 0.02], [c + 0.9, 8.15, 0.02]], { u: 0.76, a });
        }
      },
    },

    /* Complex Technical Integration */
    integration: {
      period: 10, still: 0.62,
      frame: [[4.1, 2.1, 5.9], [0.4, 7.5, 0], [17.4, 2.9, 0], [14, 9, -0.4]],
      draw(s, t) {
        const COOL = 0.04, SAFE = 0.5, POWER = 0.84, OK = 1;   // couleur de chaque système dans le dégradé
        // amarrage : structure d'en haut, froid depuis la gauche, courant depuis la droite, sécurité depuis l'avant
        const FROM = [[0, 0, 7], [-9, 0, 0], [0, -9, 0], [0, 8, 3]];
        const dock = (i) => Math.min(easeOut(seg(t, 0.05 + i * 0.09, 0.23 + i * 0.09)), 1 - easeIn(seg(t, 0.86 + i * 0.025, 0.96 + i * 0.01)));
        const D = FROM.map((_, i) => dock(i));
        const O = FROM.map((f, i) => f.map((v) => v * (1 - D[i])));
        const use = (i) => { s.a = clamp(D[i] * 1.6); return O[i]; };
        const flow = seg(t, 0.47, 0.52) * (1 - seg(t, 0.82, 0.86));   // fluides et courant en circulation
        const T = s.time;
        const RACKS = [5, 7, 9, 11];

        // dalle technique
        s.box(4, 2, -0.4, 10, 7, 0.4, 0.4);

        // froid : groupe froid (ventilateurs qui tournent), sortie des conduites
        let [dx, dy, dz] = use(1);
        s.box(dx + 0.4, dy + 4.2, dz, 2.8, 3.3, 1.8, 0.82);
        for (let f = 0; f < 2; f++) {
          const c = [dx + 1.1 + f * 1.4, dy + 5.85, dz + 1.8];
          s.ring(c, 0.55, 'z', 1, { u: COOL });
          for (let b = 0; b < 3; b++) {
            const q = T * 4 + (b * TAU) / 3;
            s.line(c, [c[0] + Math.cos(q) * 0.5, c[1] + Math.sin(q) * 0.5, c[2]], 0.8, { u: COOL, t: 0.8 });
          }
        }

        // structure, côté fond : poteaux et poutres arrière
        [dx, dy, dz] = use(0);
        const col = (x, y) => s.box(dx + x, dy + y, dz, 0.35, 0.35, 5.6, 0.9);
        col(4.1, 2.1); col(13.55, 2.1); col(4.1, 8.55);
        s.box(dx + 4.1, dy + 2.1, dz + 5.25, 9.8, 0.35, 0.35, 0.9);
        s.box(dx + 4.1, dy + 2.45, dz + 5.25, 0.35, 6.45, 0.35, 0.9);

        // courant : tableau et onduleurs, colonne montante
        [dx, dy, dz] = use(2);
        s.box(dx + 14.8, dy + 2.9, dz, 2.6, 2, 2.6, 0.85);
        for (let i = 0; i < 3; i++) {
          const x = dx + 15 + i * 0.82;
          s.poly([[x, dy + 4.9, dz + 0.3], [x + 0.62, dy + 4.9, dz + 0.3], [x + 0.62, dy + 4.9, dz + 2.2], [x, dy + 4.9, dz + 2.2]], { u: POWER, t: 0.55 }, LEFT);
        }
        s.box(dx + 15.5, dy + 3.4, dz + 2.6, 0.5, 0.5, 1.45, { u: POWER, t: 0.85 });

        // baies, rangée du fond
        s.a = 1;
        const rack = (x, y, front) => {
          s.box(x, y, 0, 1.85, 1.2, 3.2, 0.88);
          s.poly([[x + 0.15, y + 1.2, 0.2], [x + 1.7, y + 1.2, 0.2], [x + 1.7, y + 1.2, 3], [x + 0.15, y + 1.2, 3]], 0.42, LEFT);
          if (!front) return;
          for (let j = 0; j < 4; j++) {   // voyants des serveurs
            const on = flow > 0 && hash(x * 13 + j * 7 + Math.floor(T * 3)) > 0.45;
            const z = 0.55 + j * 0.65;
            s.poly([[x + 0.3, y + 1.2, z], [x + 0.9, y + 1.2, z], [x + 0.9, y + 1.2, z + 0.22], [x + 0.3, y + 1.2, z + 0.22]], on ? { u: OK, a: flow } : 0.3, LEFT);
          }
        };
        RACKS.forEach((x) => rack(x, 3, false));

        // courant : gaine au-dessus de la rangée du fond, dérivations vers les baies
        [dx, dy, dz] = use(2);
        s.box(dx + 5, dy + 3.35, dz + 4.05, 11, 0.5, 0.3, { u: POWER, t: 0.85 });
        if (flow > 0) for (let q = 0; q < 4; q++) {
          const x = 15.5 - ((T * 4 + q * 2.75) % 10.5);
          s.box(dx + x, dy + 3.35, dz + 4.05, 0.5, 0.5, 0.32, { u: 0.96, a: flow * s.a });
        }
        RACKS.forEach((x) => s.line([dx + x + 0.92, dy + 3.6, dz + 4.05], [dx + x + 0.92, dy + 3.6, dz + 3.2], 0.8, { u: POWER, t: 0.7 }));

        // froid : départ, colonne montante, collecteurs au-dessus de l'allée, piquages vers les baies
        [dx, dy, dz] = use(1);
        for (let p = 0; p < 2; p++) {
          const y = dy + 5 + p * 0.75, z = dz + 4.45, m = { u: COOL, t: p ? 0.8 : 0.95 };
          s.tube([dx + 3.2, y, dz + 1.2], [dx + 3.65, y, dz + 1.2], 0.22, m);
          s.tube([dx + 3.65, y, dz + 1.2], [dx + 3.65, y, z], 0.22, m);
          s.tube([dx + 3.65, y, z], [dx + 13, y, z], 0.22, m);
          for (const x of [6, 8, 10, 12]) s.tube([dx + x, y, z], [dx + x, y, z - 0.7], 0.14, m);
          if (flow > 0) for (let q = 0; q < 4; q++) {
            const x = 3.65 + ((T * 3 + q * 2.35 + p * 1.2) % 9.4);
            s.tube([dx + x, y, z], [dx + Math.min(13, x + 0.5), y, z], 0.27, { u: 0.2, a: flow * s.a });
          }
        }

        // baies, rangée de devant ; gaine et dérivations au-dessus
        s.a = 1;
        RACKS.forEach((x) => rack(x, 6.6, true));
        [dx, dy, dz] = use(2);
        s.box(dx + 14.3, dy + 3.85, dz + 4.05, 0.5, 3.6, 0.3, { u: POWER, t: 0.85 });
        s.box(dx + 5, dy + 6.95, dz + 4.05, 9.3, 0.5, 0.3, { u: POWER, t: 0.85 });
        if (flow > 0) for (let q = 0; q < 3; q++) {
          const x = 13.8 - ((T * 4 + q * 3) % 8.8);
          s.box(dx + x, dy + 6.95, dz + 4.05, 0.5, 0.5, 0.32, { u: 0.96, a: flow * s.a });
        }
        RACKS.forEach((x) => s.line([dx + x + 0.92, dy + 7.2, dz + 4.05], [dx + x + 0.92, dy + 7.2, dz + 3.2], 0.8, { u: POWER, t: 0.7 }));

        // sécurité : réseau sprinkler (deux antennes et leurs têtes), détecteurs qui clignotent
        [dx, dy, dz] = use(3);
        for (const x of [6.9, 11.1]) {
          s.tube([dx + x, dy + 2.4, dz + 5], [dx + x, dy + 8.5, dz + 5], 0.14, { u: SAFE, t: 0.95 });
          for (const y of [3.3, 5.4, 7.5]) {
            s.tube([dx + x, dy + y, dz + 5], [dx + x, dy + y, dz + 4.68], 0.07, { u: SAFE });
            s.ring([dx + x, dy + y, dz + 4.62], 0.22, 'z', 0.9, { u: SAFE });
          }
          const blinkOn = 0.5 + 0.5 * Math.sin(T * 3 + x);
          s.box(dx + x - 0.15, dy + 8.2, dz + 5.12, 0.3, 0.3, 0.2, { u: SAFE, t: 0.5 + 0.5 * blinkOn });
        }

        // structure, côté avant : poutres intermédiaires, poutres et poteau avant
        [dx, dy, dz] = use(0);
        for (const x of [6.75, 10.95]) s.box(dx + x, dy + 2.45, dz + 5.25, 0.35, 6.1, 0.3, 0.8);
        s.box(dx + 13.55, dy + 2.45, dz + 5.25, 0.35, 6.45, 0.35, 0.9);
        s.box(dx + 4.45, dy + 8.55, dz + 5.25, 9.1, 0.35, 0.35, 0.9);
        col(13.55, 8.55);

        // interfaces : chaque système qui s'amarre allume ses points de raccordement
        const node = (x, y, z, a) => { if (a > 0.01) s.box(x - 0.2, y - 0.2, z, 0.4, 0.4, 0.25, { u: OK, a }); };
        s.a = 1;
        // éclat à l'amarrage, qui s'éteint en ~2 s
        const glow = (i) => { const a = 0.23 + i * 0.09; return seg(t, a - 0.02, a) * (1 - seg(t, a, a + 0.22)); };
        [[4.27, 2.27], [13.72, 2.27], [4.27, 8.72], [13.72, 8.72]].forEach(([x, y]) => node(x, y, 0, glow(0)));
        for (const x of [6, 8, 10, 12]) { node(x, 5, 3.6, glow(1)); node(x, 5.75, 3.6, glow(1)); }
        RACKS.forEach((x) => { node(x + 0.92, 3.6, 3.2, glow(2)); node(x + 0.92, 7.2, 3.2, glow(2)); });
        for (const x of [6.9, 11.1]) for (const y of [2.6, 8.3]) node(x, y, 5.1, glow(3));
      },
    },

    /* Uncompromising Quality Requirements */
    quality: {
      period: 4.5, still: 0.62,
      frame: [[3, 6.3, 0], [12.25, 0.9, 5.65], [22, 1.9, 0], [22, 6.3, 0]],
      draw(s, t) {
        const G = 12.5, SP = 8.5, MW = 5;   // plan du portique, écart entre deux skids, longueur d'un skid
        const T = s.time;
        const RAW = { frame: 0.58, pipe: 0.55, valve: 0.6, tag: 0.45 };
        const DONE = { frame: 0.95, pipe: 0.95, valve: 1, tag: { u: 1 } };

        // convoyeur : bande dont les lattes avancent avec les skids
        s.box(0, 1.9, 0, 25, 4.4, 0.8, 0.36);
        const off = (t * SP) % 0.85;
        for (let x = off - 0.85; x < 25; x += 0.85) if (x > 0 && x < 24.8) s.box(x, 1.95, 0.8, 0.18, 4.3, 0, 0.56);

        // skids : châssis, traverses, deux conduites à brides, vanne et volant, étiquette de traçabilité
        const mods = [];
        for (let k = 0; k < 4; k++) {
          const mx = -5.5 + SP * (k + t);
          const a = clamp((mx + 5) / 2.5) * clamp((25.5 - mx - MW) / 2.5);
          if (a > 0) mods.push([mx, a]);
        }
        const skid = (mx, m) => {
          s.box(mx, 2.55, 0.8, MW, 3.3, 0.32, m.frame);
          s.box(mx + 0.9, 2.75, 1.12, 0.3, 2.9, 0.28, m.frame);
          s.box(mx + 3.8, 2.75, 1.12, 0.3, 2.9, 0.28, m.frame);
          for (const y of [3.45, 4.95]) {
            s.tube([mx + 0.15, y, 1.8], [mx + MW - 0.15, y, 1.8], 0.4, m.pipe);
            s.tube([mx + 0.15, y, 1.8], [mx + 0.45, y, 1.8], 0.56, m.pipe);
            s.tube([mx + MW - 0.45, y, 1.8], [mx + MW - 0.15, y, 1.8], 0.56, m.pipe);
          }
          s.box(mx + 2.1, 4.6, 2.05, 0.8, 0.7, 0.55, m.valve);
          s.line([mx + 2.5, 4.95, 2.6], [mx + 2.5, 4.95, 3], 1, m.valve);
          s.ring([mx + 2.5, 4.95, 3.05], 0.5, 'z', 1.1, m.valve);
          s.poly([[mx + 3.4, 5.42, 1.1], [mx + 4.4, 5.42, 1.1], [mx + 4.4, 5.42, 1.75], [mx + 3.4, 5.42, 1.75]], m.tag, LEFT);
        };

        // portique : poteau arrière
        s.box(G - 0.25, 0.9, 0, 0.5, 0.5, 5.2, 0.8);
        // passe 1 : parties pas encore contrôlées (en amont du portique)
        s.clip = [-Infinity, G];
        mods.forEach(([mx, a]) => { s.a = a; skid(mx, RAW); });
        s.clip = null; s.a = 1;
        // nappe laser dans le plan du portique, ligne de balayage qui monte et descend
        s.poly([[G, 1.4, 0.8], [G, 6.9, 0.8], [G, 6.9, 4.6], [G, 1.4, 4.6]], { u: 0.08, a: 0.24 });
        const zs = 0.9 + 3.6 * (0.5 - 0.5 * Math.cos(T * 3));
        s.line([G, 1.4, zs], [G, 6.9, zs], 1.1, { u: 0.25 });
        // passe 2 : parties contrôlées (en aval)
        s.clip = [G, Infinity];
        mods.forEach(([mx, a]) => { s.a = a; skid(mx, DONE); });
        s.clip = null; s.a = 1;

        // trace du laser sur les pièces traversées : profil du châssis, demi-cercles des conduites
        const laser = { u: 0.35 };
        mods.forEach(([mx]) => {
          if (G <= mx || G >= mx + MW) return;
          s.path([[G, 2.55, 1.12], [G, 5.85, 1.12], [G, 5.85, 0.8]], 0.9, laser);
          for (const y of [3.45, 4.95]) s.ring([G, y, 1.8], G - mx < 0.45 || mx + MW - G < 0.45 ? 0.56 : 0.4, 'x', 0.9, laser, -Math.PI / 4, (3 * Math.PI) / 4);
          if (G > mx + 2.1 && G < mx + 2.9) s.path([[G, 4.6, 2.6], [G, 5.3, 2.6], [G, 5.3, 2.05]], 0.9, laser);
        });

        // contrôle validé : cote le long du châssis, coche au-dessus du skid
        mods.forEach(([mx, a]) => {
          const d = mx - G;   // avance après le portique
          if (d <= 0) return;
          const grow = easeOut(seg(d, 0, 2.5)), fade = a * (1 - seg(d, 6, 8));
          const cy = 6.55, x1 = mx + MW * grow;
          s.line([mx, cy, 0.85], [x1, cy, 0.85], 0.8, { u: 0.55, a: fade });
          s.line([mx, cy, 0.55], [mx, cy, 1.15], 0.8, { u: 0.55, a: fade });
          if (grow > 0.98) s.line([x1, cy, 0.55], [x1, cy, 1.15], 0.8, { u: 0.55, a: fade });
          const ck = seg(d, 0.6, 2), cx = mx + 2.5, cz = 3.7 + 0.5 * easeOut(ck);
          if (ck > 0) s.path([[cx - 0.7, 4.2, cz + 0.5], [cx - 0.2, 4.2, cz], [cx + 0.9, 4.2, cz + 1.1]], 1.6, { u: 1, a: fade * ck });
        });

        // portique : traverse, tête de mesure, poteau avant
        s.box(G - 0.25, 0.9, 5.2, 0.5, 6.5, 0.45, 0.85);
        s.box(G - 0.45, 3.4, 4.6, 0.9, 1.4, 0.6, 0.92);
        s.box(G - 0.12, 3.9, 4.45, 0.24, 0.4, 0.15, { u: 0.25 });
        s.box(G - 0.25, 6.9, 0, 0.5, 0.5, 5.2, 0.85);
      },
    },

    /* Deployment at Scale */
    scale: {
      period: 12, still: 0.8,
      frame: [[2, 19.5, 0], [3, 3, 2.2], [19.5, 2, 0], [19.5, 19.5, 0]],
      draw(s, t) {
        const R0 = 9.6, R1 = 11.4, RC = 10.5;   // routes en croix (bords, axe)
        const SITES = [[13, 2], [2, 13], [13, 13]];   // ordre du programme : droite, gauche, devant
        const T = s.time;

        // routes, accès, marquage
        s.box(0, R0, -0.2, 20.5, R1 - R0, 0.2, 0.42);
        s.box(R0, 0, -0.2, R1 - R0, 20.5, 0.2, 0.42);
        for (let x = 0.3; x < 20.5; x += 1.4) if (x + 0.7 < R0 || x > R1) s.box(x, RC - 0.1, 0, 0.7, 0.2, 0, 0.8);
        for (let y = 0.3; y < 20.5; y += 1.4) if (y + 0.7 < R0 || y > R1) s.box(RC - 0.1, y, 0, 0.2, 0.7, 0, 0.8);
        s.box(8.5, 4.6, -0.2, R0 - 8.5, 1.2, 0.2, 0.42);     // usine → route
        s.box(R1, 4.6, -0.2, 13 - R1, 1.2, 0.2, 0.42);       // route → site 1
        s.box(4.65, R1, -0.2, 1.2, 13 - R1, 0.2, 0.42);      // route → site 2
        s.box(15.65, R1, -0.2, 1.2, 13 - R1, 0.2, 0.42);     // route → site 3

        // terrains des sites ; onde quand un site est terminé
        const MOD = (j) => 0.04 + j * 0.034;   // instant d'arrivée du module j (6 par site)
        const fadeAll = 1 - seg(t, 0.88, 0.97);
        SITES.forEach(([x0, y0], k) => {
          s.box(x0, y0, -0.15, 6.5, 6.5, 0.15, 0.28);
          const w = seg(t, MOD(k * 6 + 5) + 0.07, MOD(k * 6 + 5) + 0.3);
          if (w > 0 && w < 1) s.ring([x0 + 3.25, y0 + 3.25, 0.02], 1.5 + w * 3.5, 'z', 1, { u: 1, a: 1 - w });
        });
        // usine : terrain
        s.box(1.6, 1.6, -0.15, 6.9, 6.9, 0.15, 0.28);

        // usine à sheds (verrières tournées vers l'avant), porte de sortie vers la route
        s.later(10.2, () => {
          s.box(3, 3, 0, 5.5, 4.6, 1.3, 0.86);
          for (let i = 0; i < 3; i++) {
            const x = 3 + i * 1.83, X = x + 1.83;
            s.poly([[x, 3, 1.3], [X, 3, 2.2], [X, 7.6, 2.2], [x, 7.6, 1.3]], 0.86, TOP);
            s.poly([[X, 3, 1.3], [X, 7.6, 1.3], [X, 7.6, 2.2], [X, 3, 2.2]], { u: 0.08, t: 0.9 }, RIGHT);
            s.poly([[x, 7.6, 1.3], [X, 7.6, 1.3], [X, 7.6, 2.2]], 0.86, LEFT);
          }
          s.poly([[8.5, 4.5, 0], [8.5, 5.9, 0], [8.5, 5.9, 1.05], [8.5, 4.5, 1.05]], { u: 0.08 }, 1);
        });

        // modules : le même module, posé l'un après l'autre (2 bâtiments de 3 modules par site)
        SITES.forEach(([x0, y0], k) => {
          for (let h = 0; h < 2; h++) for (let m = 0; m < 3; m++) {
            const j = k * 6 + h * 3 + m, p = seg(t, MOD(j), MOD(j) + 0.07);
            if (p <= 0 || fadeAll <= 0) continue;
            const x = x0 + 0.5 + m * 1.85, y = y0 + 0.6 + h * 3, z = 2.2 * (1 - easeOut(p));
            const settle = seg(t, MOD(j) + 0.07, MOD(j) + 0.14);
            s.later(x + 0.9 + y + 1.15, () => {
              s.a = clamp(p * 2) * fadeAll;
              s.box(x, y, z, 1.75, 2.3, 1.3, 0.9);
              if (settle < 1) s.box(x, y, z, 1.75, 2.3, 1.3, { u: 0.08, a: 1 - settle });
              s.box(x + 0.35, y + 0.5, z + 1.3, 1.05, 1.3, 0.28, 0.72);
              s.box(x + 1.4, y + 1.85, z + 1.3, 0.22, 0.22, 0.18, settle > 0 ? { u: 1, a: settle } : 0.4);
              s.a = 1;
            });
          }
          // balise du site : verte quand le dernier module est posé
          const done = seg(t, MOD(k * 6 + 5) + 0.07, MOD(k * 6 + 5) + 0.1) * fadeAll;
          s.later(x0 + y0 + 12.4, () => {
            s.tube([x0 + 6.2, y0 + 6.2, 0], [x0 + 6.2, y0 + 6.2, 2.4], 0.07, 0.8);
            s.box(x0 + 6.05, y0 + 6.05, 2.4, 0.3, 0.3, 0.3, done > 0 ? { u: 1, t: 0.6 + 0.4 * done * (0.75 + 0.25 * Math.sin(T * 6)) } : 0.45);
          });
        });

        // camions : de l'usine vers chaque site, chargés du même module
        const ROUTES = [
          [[8.5, 5.2], [RC, 5.2], [13.6, 5.2]],
          [[8.5, 5.2], [RC, 5.2], [RC, RC], [5.25, RC], [5.25, 13.6]],
          [[8.5, 5.2], [RC, 5.2], [RC, RC], [16.25, RC], [16.25, 13.6]],
        ];
        ROUTES.forEach((route, k) => {
          const u = (((t - k / 3) % 1) + 1) % 1;
          if (u > 0.55) return;
          const lens = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
          let d = inOut(seg(u, 0, 0.55)) * lens.reduce((a, b) => a + b, 0), i = 0;
          while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
          const [ax, ay] = route[i], [bx, by] = route[i + 1];
          const dirX = Math.sign(bx - ax), dirY = Math.sign(by - ay);
          const px = ax + dirX * d, py = ay + dirY * d;
          const a = seg(u, 0, 0.04) * (1 - seg(u, 0.5, 0.55));
          s.later(px + py, () => truck(s, px, py, dirX, dirY, a));
        });
        s.flush();
      },
    },
  };

  // camion de livraison : plateau, module (lilas, comme le module de l'usine), cabine à l'avant
  function truck(s, px, py, dirX, dirY, a) {
    const along = (from, to, half, z, h, m) => {   // pavé le long du sens de marche
      const f = Math.min(from, to), g = Math.max(from, to);
      if (dirX) s.box(px + (dirX > 0 ? f : -g), py - half, z, g - f, 2 * half, h, m);
      else s.box(px - half, py + (dirY > 0 ? f : -g), z, 2 * half, g - f, h, m);
    };
    s.a = a;
    const parts = [
      [-0.4, () => { along(-1.15, 0.35, 0.5, 0.12, 0.28, 0.6); along(-1.05, 0.25, 0.42, 0.4, 0.62, { u: 0.08 }); }],
      [0.75, () => along(0.42, 1.1, 0.47, 0.12, 0.78, 0.92)],
    ];
    // de l'arrière vers l'avant si le camion s'éloigne, l'inverse s'il revient vers le fond
    if (dirX < 0 || dirY < 0) parts.reverse();
    parts.forEach(([, fn]) => fn());
    s.a = 1;
  }

  function init(root) {
    const scene = SCENES[root.dataset.isoDots];
    if (!scene) return;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    const layer = document.createElement('canvas');   // points éteints
    const s = painter(octx);
    const revealEl = root.closest('[data-reveal]');
    const buckets = [], used = [], COLORS = [];

    let W = 0, H = 0, dpr = 1, cs = CELL, cols = 0, rows = 0, gx = 0, gy = 0, delay = null;
    function resize() {
      // offset* : taille de mise en page, sans la translation de la carte pendant son apparition
      W = root.offsetWidth; H = root.offsetHeight;
      if (!W || !H) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      cs = W < WIDE ? CELL_S : CELL;
      cols = Math.floor(W / cs); rows = Math.floor(H / cs);
      gx = (W - cols * cs) / 2; gy = (H - rows * cs) / 2;
      canvas.width = layer.width = Math.round(W * dpr);
      canvas.height = layer.height = Math.round(H * dpr);
      off.width = cols; off.height = rows;
      s.fit(scene.frame, cols, rows, 0.05);
      delay = new Float32Array(cols * rows);
      for (let i = 0; i < delay.length; i++) delay[i] = ((rows - 1 - Math.floor(i / cols)) / (rows - 1)) * RISE + hash(i) * JITTER;
      const lctx = layer.getContext('2d'), r = cs * OFF_DOT;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.fillStyle = `rgba(255,255,255,${OFF_ALPHA})`;
      lctx.beginPath();
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const px = gx + (x + 0.5) * cs, py = gy + (y + 0.5) * cs;
        lctx.moveTo(px + r, py); lctx.arc(px, py, r, 0, TAU);
      }
      lctx.fill();
      draw(performance.now());
    }

    let shown = reduce ? -Infinity : null;   // instant de départ de l'apparition (null : pas encore)
    let clock = 0;

    function draw(now) {
      if (!cols) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      if (shown === null) return;
      const rt = (now - shown) / 1000, rising = rt < REVEAL_END;
      if (rt <= 0) return;

      // scène, un pixel par point
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalAlpha = 1;
      octx.clearRect(0, 0, cols, rows);
      s.a = 1; s.clip = null; s.time = clock;
      scene.draw(s, reduce ? scene.still : (clock / scene.period) % 1);
      const data = octx.getImageData(0, 0, cols, rows).data;

      // trame : rayon selon la luminosité (couverture comprise), teinte du dessin, comme le campus 3D
      const half = 0.5 * cs * 0.95;
      for (let i = 0, j = 0; i < cols * rows; i++, j += 4) {
        const A = data[j + 3];
        if (A < 13) continue;
        const R = data[j], Gc = data[j + 1], B = data[j + 2];
        const M = Math.max(R, Gc, B);
        if (M < 8) continue;
        const l = (M * A) / 65025;
        const e = clamp((l - 0.1) / 0.9), k = e * e * (3 - 2 * e);
        if (k < 0.03) continue;
        let r = half * Math.sqrt(k);
        if (rising) {
          const p = (rt - delay[i]) / POP;
          if (p <= 0) continue;
          if (p < 1) r *= outBack(p);
        }
        const f = ((0.45 + 0.55 * k) * 15) / M;
        const key = (((R * f + 0.5) | 0) << 8) | (((Gc * f + 0.5) | 0) << 4) | ((B * f + 0.5) | 0);
        let list = buckets[key];
        if (!list) list = buckets[key] = [];
        if (!list.length) used.push(key);
        const x = i % cols, y = (i - x) / cols;
        list.push(gx + (x + 0.5) * cs, gy + (y + 0.5) * cs, r);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const key of used) {
        const list = buckets[key];
        ctx.fillStyle = COLORS[key] || (COLORS[key] = `rgb(${((key >> 8) & 15) * 17},${((key >> 4) & 15) * 17},${(key & 15) * 17})`);
        ctx.beginPath();
        for (let q = 0; q < list.length; q += 3) {
          ctx.moveTo(list[q] + list[q + 2], list[q + 1]);
          ctx.arc(list[q], list[q + 1], list[q + 2], 0, TAU);
        }
        ctx.fill();
        list.length = 0;
      }
      used.length = 0;
    }

    // boucle : seulement quand l'illustration est à l'écran, après le début de l'apparition
    let raf = 0, last = 0, visible = false;
    function frame(now) {
      clock += last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      draw(now);
      raf = visible ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (!raf && visible && shown !== null && !reduce) { last = 0; raf = requestAnimationFrame(frame); } }

    if (!reduce) {
      const reveal = () => { shown = performance.now() + START * 1000; start(); };
      if (!revealEl || revealEl.classList.contains('is-in')) reveal();
      else {
        const mo = new MutationObserver(() => {
          if (!revealEl.classList.contains('is-in')) return;
          mo.disconnect();
          reveal();
        });
        mo.observe(revealEl, { attributes: true, attributeFilter: ['class'] });
      }
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) start();
        else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '80px 0px' }).observe(root);
    }

    new ResizeObserver(resize).observe(root);
  }

  document.querySelectorAll('[data-iso-dots]').forEach(init);
})();
