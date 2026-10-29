/* =========================================================
   Composant « Campus 3D » — maquette interactive (section Factory built)
   Adapté de « Campus Verdon 3D.html » :
   - three.js + OrbitControls vendorisés (js/vendor/three), pas de CDN
   - géométrie chargée à la demande (assets/campus-3d.json)
   - initialisation seulement quand la section approche de l'écran
   - boucle de rendu coupée hors écran et onglet masqué, DPR plafonné à 1.5
   - l'image isométrique reste affichée tant que la 3D n'est pas prête (ou sans WebGL)
   Balisage attendu : voir .campus3d dans index.html
   ========================================================= */

const PARTS = [
  { id: 'A', side: 'L', name: 'Aile ouest', text: "Long bâtiment à façade vitrée, doublée de lames verticales. Un volume vitré en attique couronne la toiture." },
  { id: 'B', side: 'L', name: 'Atrium', text: "Nef à toiture vitrée en double pente, entre l'aile ouest et la cour. Une aile basse à toit terrasse la longe." },
  { id: 'C', side: 'L', name: 'Tour', text: "Point haut du campus. Façade rythmée de lames verticales, avec une rotonde au pied côté cour." },
  { id: 'D', side: 'L', name: 'Cour couverte', text: "Toiture plissée en facettes portée par deux colonnades. Sept puits de lumière bordent l'allée, un pavillon surélevé domine la cour." },
  { id: 'E', side: 'R', name: 'Bloc en pierre', text: "Barre principale en L, façade en pierre percée de fenêtres irrégulières. Elle ferme la cour au sud et à l'est." },
  { id: 'F', side: 'R', name: 'Barre est', text: "Bâtiment fin et détaché, parallèle au bloc en pierre, avec la même écriture de façade." },
  { id: 'G', side: 'R', name: 'Pavillon sud', text: "Petit volume évidé de deux patios, relié au parvis par une rampe en spirale." },
  { id: 'H', side: 'R', name: 'Gradins', text: "Élément en biseau qui s'élève depuis le sol, au sud-ouest du parvis." },
];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildDom(root) {
  const colL = root.querySelector('[data-c3d-left]');
  const colR = root.querySelector('[data-c3d-right]');
  const markers = root.querySelector('[data-c3d-markers]');
  const cards = {}, pins = {};
  for (const p of PARTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c3d-card';
    b.dataset.id = p.id;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<h3 class="c3d-card__title">${p.name}</h3><p class="c3d-card__text">${p.text}</p>`;
    (p.side === 'L' ? colL : colR).appendChild(b);
    cards[p.id] = b;
    const lb = document.createElement('div');
    lb.className = 'c3d-pin';
    lb.dataset.id = p.id;
    lb.innerHTML = `<button type="button" class="c3d-pin__dot" data-id="${p.id}" aria-label="${p.name}"></button>`;
    markers.appendChild(lb);
    pins[p.id] = lb;
  }
  return { cards, pins };
}

// Téléchargement + parsing anticipés pendant un temps mort (pas pendant le scroll)
let loading = null;
function preload(root) {
  if (!loading) {
    loading = Promise.all([
      import('../vendor/three/three.module.min.js'),
      import('../vendor/three/OrbitControls.js'),
      fetch(root.dataset.src || 'assets/campus-3d.json').then((r) => r.json()),
    ]);
  }
  return loading;
}

async function init(root) {
  const view = root.querySelector('[data-c3d-view]');
  const cv = root.querySelector('canvas');
  const lp = root.querySelector('[data-c3d-path]');
  const lc = root.querySelector('[data-c3d-dot]');

  // WebGL disponible ?
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { root.classList.add('is-fallback'); return; }

  const [THREE, { OrbitControls }, DATA] = await preload(root);

  const { cards, pins } = buildDom(root);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { root.classList.add('is-fallback'); return; }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  const controls = new OrbitControls(cam, cv);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.enableZoom = false; // la molette sert au scroll de la page
  controls.minPolarAngle = THREE.MathUtils.degToRad(25); controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.rotateSpeed = 0.6;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = -0.55;
  const el = THREE.MathUtils.degToRad(30), R = 600;
  cam.position.set(0, R * Math.sin(el), R * Math.cos(el));
  controls.target.set(0, 8, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-120, 220, 140); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(160, 60, -60); scene.add(fill);

  const IDLE = new THREE.Color(0xc9c7c1), ON = new THREE.Color(0xfffcf4), OFF = new THREE.Color(0x8e8d89);
  const parts = {};
  let radius = 0;
  for (const p of PARTS) {
    const d = DATA[p.id];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
    const col = new Float32Array(d.p.length);
    d.c.forEach((t, i) => { for (let k = 0; k < 9; k++) col[i * 9 + k] = t; });
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    for (let i = 0; i < d.p.length; i += 3) radius = Math.max(radius, Math.hypot(d.p[i], d.p[i + 2]));
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, color: IDLE.clone(), flatShading: true });
    const mesh = new THREE.Mesh(g, m); mesh.userData.id = p.id; scene.add(mesh);
    parts[p.id] = { mesh, anchor: new THREE.Vector3(...d.a), target: IDLE.clone() };
  }

  // Passe « matrice de points » (même rendu que les visuels du site)
  // La passe ne lit qu'un texel par cellule : la scène est rendue directement à la taille de la grille
  // (≈ 16× moins de pixels qu'en pleine résolution, sans MSAA).
  const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 0 });
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: rt.texture }, res: { value: new THREE.Vector2() }, cell: { value: 7 } },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D t;uniform vec2 res;uniform float cell;
      void main(){vec2 px=gl_FragCoord.xy;vec2 c=(floor(px/cell)+.5)*cell;
       vec4 s=texture2D(t,c/res);
       vec3 col=pow(max(s.rgb,0.),vec3(1./2.2));
       float l=max(col.r,max(col.g,col.b));
       float k=smoothstep(.12,1.,l);
       float r=.5*cell*.94*sqrt(k);
       float d=length(px-c);
       float m=(1.-smoothstep(r-.75,r+.75,d))*step(.05,s.a)*step(.03,k);
       vec3 o=col/max(l,.001)*mix(.42,1.,k);
       gl_FragColor=vec4(o*m,m);}`,
    transparent: true,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ---------- tailles (lues seulement au resize, jamais dans la boucle) ---------- */
  let W = 1, H = 1, viewOff = { x: 0, y: 0 };
  const isWide = () => matchMedia('(min-width: 901px)').matches;
  function resize() {
    const r = view.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const sr = root.getBoundingClientRect();
    viewOff = { x: r.left - sr.left, y: r.top - sr.top };
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const cell = Math.max(3, Math.round((W < 560 ? 3.5 : 4) * dpr));
    postMat.uniforms.res.value.set(W * dpr, H * dpr);
    postMat.uniforms.cell.value = cell;
    rt.setSize(Math.ceil((W * dpr) / cell), Math.ceil((H * dpr) / cell));
    const half = radius * 1.02, a = W / H;
    if (a >= 1) { cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; }
    else { cam.left = -half; cam.right = half; cam.top = half / a; cam.bottom = -half / a; }
    cam.updateProjectionMatrix();
    measureCards();
    wake();
  }
  // positions des titres de cartes (relatives au composant) pour les lignes de rappel
  const cardAnchor = {};
  function measureCards() {
    const sr = root.getBoundingClientRect();
    for (const p of PARTS) {
      const c = cards[p.id].getBoundingClientRect();
      const h = cards[p.id].querySelector('.c3d-card__title').getBoundingClientRect();
      cardAnchor[p.id] = { left: c.left - sr.left, right: c.right - sr.left, y: h.top + h.height / 2 - sr.top };
    }
  }

  /* ---------- interaction ---------- */
  let active = null, pinned = null, lastUser = -1e9, tourIdx = 0, tourT = 0;
  function setActive(id) {
    if (id === active) return;
    active = id;
    for (const p of PARTS) {
      const on = p.id === id;
      cards[p.id].classList.toggle('is-on', on);
      pins[p.id].classList.toggle('is-on', on);
      cards[p.id].setAttribute('aria-pressed', on ? 'true' : 'false');
      parts[p.id].target.copy(id ? (on ? ON : OFF) : IDLE);
    }
    // réutilise le composant dégradé sur le titre de la carte active
    if (id && window.GradientText) {
      const t = cards[id].querySelector('.c3d-card__title');
      if (!t.dataset.gt) { t.dataset.gt = ''; window.GradientText.init(cards[id]); }
      window.GradientText.play(t);
    }
    wake();
  }
  function user() { lastUser = performance.now(); controls.autoRotate = false; wake(); }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const meshes = Object.values(parts).map((p) => p.mesh);
  let cvRect = null;
  function pick(e) {
    cvRect = cvRect || cv.getBoundingClientRect();
    ndc.set(((e.clientX - cvRect.left) / cvRect.width) * 2 - 1, -((e.clientY - cvRect.top) / cvRect.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(meshes, false)[0];
    return h ? h.object.userData.id : null;
  }
  let pickQueued = null;
  cv.addEventListener('pointerenter', () => { cvRect = cv.getBoundingClientRect(); });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    user();
    if (pinned) return;
    // raycast au plus une fois par frame
    if (!pickQueued) requestAnimationFrame(() => { setActive(pick(pickQueued)); pickQueued = null; });
    pickQueued = e;
  });
  cv.addEventListener('pointerleave', () => { cvRect = null; if (!pinned) setActive(null); });
  let downAt = null;
  cv.addEventListener('pointerdown', (e) => { user(); cvRect = cv.getBoundingClientRect(); downAt = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved < 6) { const id = pick(e); pinned = (id && id !== pinned) ? id : null; setActive(pinned); }
  });
  controls.addEventListener('start', user);
  controls.addEventListener('change', wake);

  for (const elx of [...Object.values(cards), ...Object.values(pins).map((l) => l.querySelector('.c3d-pin__dot'))]) {
    const id = elx.dataset.id;
    elx.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { user(); if (!pinned) setActive(id); } });
    elx.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) setActive(null); });
    elx.addEventListener('focus', () => { user(); setActive(id); });
    elx.addEventListener('blur', () => { if (!pinned) setActive(null); });
    elx.addEventListener('click', () => { user(); pinned = pinned === id ? null : id; setActive(pinned || id); });
  }

  /* ---------- lignes de rappel + pastilles ---------- */
  const v3 = new THREE.Vector3();
  function project(id) { v3.copy(parts[id].anchor).project(cam); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  function updateOverlay() {
    for (const p of PARTS) {
      const [x, y] = project(p.id);
      const l = pins[p.id];
      l.style.transform = `translate3d(${x}px,${y}px,0)`;
    }
    if (!active || !isWide()) { lp.setAttribute('opacity', 0); lc.setAttribute('opacity', 0); return; }
    const [px, py] = project(active);
    const ex = viewOff.x + px, ey = viewOff.y + py;
    const a = cardAnchor[active];
    const left = PARTS.find((p) => p.id === active).side === 'L';
    const sx = left ? a.right + 14 : a.left - 14;
    const sy = a.y;
    const kx = sx + (left ? 1 : -1) * Math.min(90, Math.abs(ex - sx) * 0.35);
    lp.setAttribute('d', `M${sx},${sy} H${kx} L${ex},${ey}`); lp.setAttribute('opacity', 1);
    lc.setAttribute('cx', ex); lc.setAttribute('cy', ey); lc.setAttribute('opacity', 1);
  }

  /* ---------- boucle : tourne seulement quand c'est visible ---------- */
  const clock = new THREE.Clock();
  let visible = false, rafId = 0, settle = 0;
  let inFrame = false, skip = 0;
  function frame() {
    rafId = 0;
    inFrame = true;
    if (!visible || document.hidden) return;
    const now = performance.now();
    // pendant le défilement de la page : 1 image sur 3 (~20 fps) pour laisser la main au scroll
    skip = (now - lastScroll < 150) ? (skip + 1) % 3 : 0;
    if (skip) { rafId = requestAnimationFrame(frame); inFrame = false; return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const idle = now - lastUser > 6000 && !pinned;
    if (idle && !reduce) {
      controls.autoRotate = true;
      tourT += dt;
      if (tourT > 3.2) { tourT = 0; tourIdx = (tourIdx + 1) % (PARTS.length + 1); setActive(tourIdx < PARTS.length ? PARTS[tourIdx].id : null); }
    } else tourT = 0;

    let moving = controls.autoRotate;
    for (const p of Object.values(parts)) {
      const c = p.mesh.material.color;
      if (!c.equals(p.target)) { c.lerp(p.target, 1 - Math.pow(0.0005, dt)); moving = true; if (Math.abs(c.r - p.target.r) < 0.002) c.copy(p.target); }
    }
    controls.update();
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, postCam);
    updateOverlay();
    inFrame = false;

    // en mode mouvement réduit : on s'arrête dès que l'image est stable
    settle = moving ? 0 : settle + 1;
    // (wake() a pu déjà programmer la frame suivante pendant controls.update / setActive : jamais deux boucles)
    if (!rafId && (settle < 30 || !reduce)) rafId = requestAnimationFrame(frame);
  }
  function wake() { if (!inFrame && !rafId && visible && !document.hidden) { clock.getDelta(); rafId = requestAnimationFrame(frame); } }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { rootMargin: '100px 0px' }).observe(view);
  document.addEventListener('visibilitychange', wake);
  new ResizeObserver(resize).observe(view);
  let lastScroll = 0;
  window.addEventListener('scroll', () => { cvRect = null; lastScroll = performance.now(); }, { passive: true });
  resize();

  renderer.compile(scene, cam);
  renderer.compile(postScene, postCam);
  lastUser = performance.now() - 4500;
  root.classList.add('is-ready');
  wake();
}

/* Initialisation paresseuse : on charge three.js (~650 Ko) seulement à l'approche de la section */
document.querySelectorAll('[data-campus3d]').forEach((root) => {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  window.addEventListener('load', () => idle(() => preload(root).catch(() => {}), { timeout: 4000 }), { once: true });
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    init(root).catch((err) => { console.error('[campus-3d]', err); root.classList.add('is-fallback'); });
  }, { rootMargin: '600px 0px' });
  io.observe(root);
});
