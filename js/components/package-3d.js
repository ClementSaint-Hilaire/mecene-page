/* =========================================================
   Composant « Package 3D » — maquette interactive du package factory-built (section Factory built)
   Adapté de « Verdon Factory-Built.html » :
   - three.js + OrbitControls vendorisés (js/vendor/three), pas de CDN
   - géométrie chargée à la demande : assets/package-3d.json (index des systèmes)
     + assets/package-3d.bin (positions quantifiées et triangles en uint16, compressés en gzip)
   - initialisation seulement quand la section approche de l'écran
   - boucle de rendu coupée hors écran et onglet masqué, DPR plafonné à 1.5
   - l'image fixe reste affichée tant que la 3D n'est pas prête (ou sans WebGL)
   Balisage attendu : voir .pack3d dans index.html
   ========================================================= */

// Contenus : brochure VERDON, juillet 2026. tone : teinte de repos (les équipements tiers plus sombres)
const SYSTEMS = [
  { id: 'hac', tone: 1, name: 'Hot aisle containment (HAC)', text: 'Engineered support structures and containment systems designed for load requirements, transport constraints, site assembly and, where required, seismic compliance.' },
  { id: 'pipework', tone: 1, name: 'Cooling and process pipework', text: 'Prefabricated pipework systems including headers, branches, valves, supports and bolted interfaces, designed to minimise field welding and accelerate installation.' },
  { id: 'power', tone: 0.95, name: 'Power distribution', text: 'Integrated busway levels, tap-off boxes, transfer equipment, cabling and associated supports, assembled and checked before shipment.' },
  { id: 'filler', tone: 0.95, name: 'Filler panels with low-voltage safety and service components', text: 'Pre-positioned cable containment, fibre routes, lighting, emergency lighting and low-voltage systems, reducing field installation hours and cross-trade coordination.' },
  { id: 'crossaisle', tone: 1, name: 'Cross-aisles with cameras and other survey tools', text: 'Cross-aisle structures integrating cameras, sensors, auxiliary services and other project-specific components to ensure continuity between rows and systems.' },
  { id: 'fire', tone: 1, name: 'Fire protection', text: 'Integrated sprinkler systems, detection supports and associated fire protection services incorporated within the scope.' },
  { id: 'liquid', tone: 1, name: 'Liquid cooling', text: 'Prefabricated liquid-cooling systems including OEM-compatible CDU/MCDU integration, piping, manifolds, supports and flushing arrangements, assembled and tested to reduce site works and improve commissioning readiness.' },
  { id: 'cfe', tone: 0.62, name: 'Customer-furnished equipment interfaces', text: 'CDUs, RHINO units, AHUs, manifolds and other vendor equipment can be positioned, connected or interface-validated within the VERDON package.' },
];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildDom(root) {
  const cap = root.querySelector('[data-p3d-cap]');
  const markers = root.querySelector('[data-p3d-markers]');
  const items = {}, pins = {};
  for (const s of SYSTEMS) {
    const it = document.createElement('div');
    it.className = 'p3d-cap__item';
    it.innerHTML = `<h3 class="p3d-cap__title">${s.name}</h3><p class="p3d-cap__text">${s.text}</p>`;
    cap.appendChild(it);
    items[s.id] = it;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'p3d-pin';
    b.dataset.id = s.id;
    b.setAttribute('aria-label', s.name);
    markers.appendChild(b);
    pins[s.id] = b;
  }
  return { cap, items, pins };
}

// Le .bin est en gzip ; un serveur peut l'avoir déjà décompressé (Content-Encoding)
function gunzip(buf) {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

// Téléchargement + parsing anticipés pendant un temps mort (pas pendant le scroll)
let loading = null;
function preload(root) {
  if (!loading) {
    loading = Promise.all([
      import('../vendor/three/three.module.min.js'),
      import('../vendor/three/OrbitControls.js'),
      fetch(root.dataset.src || 'assets/package-3d.json').then((r) => r.json()),
      fetch(root.dataset.bin || 'assets/package-3d.bin').then((r) => r.arrayBuffer()).then(gunzip),
    ]);
  }
  return loading;
}

async function init(root) {
  const view = root.querySelector('[data-p3d-view]');
  const cv = root.querySelector('canvas');
  const lp = root.querySelector('[data-p3d-path]');
  const lc = root.querySelector('[data-p3d-dot]');
  const hint = root.querySelector('[data-p3d-hint]');

  // WebGL disponible ?
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl')) || !('DecompressionStream' in window)) { root.classList.add('is-fallback'); return; }

  const [THREE, { OrbitControls }, META, BUF] = await preload(root);

  const { cap, items, pins } = buildDom(root);
  if (matchMedia('(hover: none)').matches) hint.textContent = 'Tap a system · Drag to rotate';

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { root.classList.add('is-fallback'); return; }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false; // le système actif est rendu en deuxième passe, par-dessus les autres

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
  const controls = new OrbitControls(cam, cv);
  cv.style.touchAction = 'pan-y'; // OrbitControls bloque le scroll tactile : on laisse passer le défilement vertical
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  controls.enableZoom = false; // la molette sert au scroll de la page
  controls.minPolarAngle = THREE.MathUtils.degToRad(35); controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  controls.rotateSpeed = 0.6;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = -0.35;
  const el = THREE.MathUtils.degToRad(30), az = THREE.MathUtils.degToRad(-38), R = 60;
  controls.target.set(0, 2.4, 0);
  cam.position.set(R * Math.cos(el) * Math.sin(az), 2.4 + R * Math.sin(el), R * Math.cos(el) * Math.cos(az));
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-8, 14, 10); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(10, 4, -6); scene.add(fill);

  // Géométrie : positions uint16 ramenées dans la boîte englobante, triangles indexés
  const IDLE = new THREE.Color(0xd2d0ca), ON = new THREE.Color(0xffffff), OFF = new THREE.Color(0x7d7c78);
  const pickScene = new THREE.Scene();
  const [lx, ly, lz] = META.lo, [sx, sy, sz] = META.span;
  const parts = {};
  let radius = 0;
  SYSTEMS.forEach((s, i) => {
    const c = META.cats[s.id];
    const q = new Uint16Array(BUF, c.pos, c.nv * 3);
    const pos = new Float32Array(c.nv * 3);
    for (let k = 0; k < c.nv * 3; k += 3) {
      pos[k] = lx + (q[k] / 65535) * sx;
      pos[k + 1] = ly + (q[k + 1] / 65535) * sy;
      pos[k + 2] = lz + (q[k + 2] / 65535) * sz;
      radius = Math.max(radius, Math.hypot(pos[k], pos[k + 2]));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(BUF, c.idx, c.nf * 3), 1));
    g.computeVertexNormals();
    const rest = IDLE.clone().multiplyScalar(s.tone);
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: rest.clone(), flatShading: true, side: THREE.DoubleSide }));
    scene.add(mesh);
    // même géométrie, couleur unie = numéro du système (picking GPU)
    pickScene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(((i + 1) * 24) / 255, 0, 0), side: THREE.DoubleSide })));
    parts[s.id] = { mesh, s, anchor: new THREE.Vector3(...c.a), target: rest };
  });

  // Passe « matrice de points » (même rendu que les visuels du site)
  // La passe ne lit qu'un texel par cellule : la scène est rendue directement à la taille de la grille
  // (≈ 16× moins de pixels qu'en pleine résolution, sans MSAA).
  const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 0, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: rt.texture }, res: { value: new THREE.Vector2() }, cell: { value: 4 } },
    vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D t;uniform vec2 res;uniform float cell;
      void main(){vec2 px=gl_FragCoord.xy;vec2 c=(floor(px/cell)+.5)*cell;
       vec4 s=texture2D(t,c/res);
       vec3 col=pow(max(s.rgb,0.),vec3(1./2.2));
       float l=max(col.r,max(col.g,col.b));
       float k=smoothstep(.1,1.,l);
       float r=.5*cell*.95*sqrt(k);
       float d=length(px-c);
       float m=(1.-smoothstep(r-.7,r+.7,d))*step(.05,s.a)*step(.03,k);
       vec3 o=col/max(l,.001)*mix(.45,1.,k);
       gl_FragColor=vec4(o*m,m);}`,
    transparent: true,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ---------- tailles (lues seulement au resize, jamais dans la boucle) ---------- */
  // clientWidth et non getBoundingClientRect : la vue peut être en cours de reveal (scale)
  let W = 1, H = 1, wide = true, capBox = { w: 0, y: 0 };
  let active = null, pinned = null, lastUser = -1e9, pointer = null, pickDirty = false;
  function resize() {
    W = Math.max(1, view.clientWidth); H = Math.max(1, view.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    const cell = Math.max(3, Math.round((W < 560 ? 3.5 : 4) * dpr));
    postMat.uniforms.res.value.set(W * dpr, H * dpr);
    postMat.uniforms.cell.value = cell;
    rt.setSize(Math.ceil((W * dpr) / cell), Math.ceil((H * dpr) / cell));
    const half = radius * 0.92;
    cam.left = -half; cam.right = half; cam.top = (half * H) / W; cam.bottom = (-half * H) / W;
    cam.updateProjectionMatrix();
    wide = matchMedia('(min-width: 701px)').matches;
    measureCap();
    wake();
  }
  // largeur de la légende et milieu de son titre, pour la ligne de rappel
  function measureCap() {
    if (!active) return;
    const t = items[active].querySelector('.p3d-cap__title');
    capBox = { w: cap.offsetWidth, y: cap.offsetTop + t.offsetTop + t.offsetHeight / 2 };
  }

  /* ---------- interaction ---------- */
  function setActive(id) {
    if (id === active) return;
    active = id;
    for (const s of SYSTEMS) {
      const on = s.id === id;
      pins[s.id].classList.toggle('is-on', on);
      // en sortie, la légende garde son texte pendant le fondu
      if (id) items[s.id].classList.toggle('is-on', on);
      parts[s.id].target.copy(on ? ON : id ? OFF : IDLE);
      if (!on) parts[s.id].target.multiplyScalar(s.tone);
    }
    root.classList.toggle('has-active', !!id);
    if (id) {
      // réutilise le composant dégradé sur le titre de la légende
      const t = items[id].querySelector('.p3d-cap__title');
      if (window.GradientText) {
        if (!t.hasAttribute('data-gt-lines')) { t.setAttribute('data-gt-lines', ''); window.GradientText.init(items[id]); }
        window.GradientText.play(t);
      }
      measureCap();
    }
    wake();
  }
  function user() { lastUser = performance.now(); controls.autoRotate = false; wake(); }

  // Picking GPU : le pixel sous le pointeur est rendu seul, en couleur d'identifiant
  const pickRT = new THREE.WebGLRenderTarget(1, 1), px = new Uint8Array(4);
  function pick(x, y) {
    cam.setViewOffset(W, H, Math.round(x), Math.round(y), 1, 1);
    renderer.setRenderTarget(pickRT); renderer.clear(); renderer.render(pickScene, cam);
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, px);
    cam.clearViewOffset(); renderer.setRenderTarget(null);
    const i = Math.round(px[0] / 24) - 1;
    return px[3] > 0 && SYSTEMS[i] ? SYSTEMS[i].id : null;
  }
  let cvRect = null;
  const local = (e) => { cvRect = cvRect || cv.getBoundingClientRect(); return [e.clientX - cvRect.left, e.clientY - cvRect.top]; };
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    user();
    pointer = local(e); pickDirty = true; // picking au plus une fois par frame
  });
  cv.addEventListener('pointerleave', () => { pointer = null; cvRect = null; if (!pinned) setActive(null); });
  let downAt = null;
  cv.addEventListener('pointerdown', (e) => { user(); cvRect = cv.getBoundingClientRect(); downAt = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved < 6) { const id = pick(...local(e)); pinned = (id && id !== pinned) ? id : null; setActive(pinned); }
  });
  controls.addEventListener('start', user);
  controls.addEventListener('change', () => { pickDirty = true; wake(); });

  for (const s of SYSTEMS) {
    const b = pins[s.id], id = s.id;
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { user(); if (!pinned) setActive(id); } });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) setActive(null); });
    b.addEventListener('focus', () => { user(); setActive(id); });
    b.addEventListener('blur', () => { if (!pinned) setActive(null); });
    b.addEventListener('click', () => { user(); pinned = pinned === id ? null : id; setActive(pinned || id); });
  }

  /* ---------- pastilles + légende et sa ligne de rappel ---------- */
  const v3 = new THREE.Vector3();
  function project(id) { v3.copy(parts[id].anchor).project(cam); return [((v3.x + 1) / 2) * W, ((1 - v3.y) / 2) * H]; }
  let right = false;
  function updateOverlay() {
    for (const s of SYSTEMS) {
      const [x, y] = project(s.id);
      pins[s.id].style.transform = `translate3d(${x}px,${y}px,0)`;
    }
    if (!active || !wide) { lp.setAttribute('opacity', 0); lc.setAttribute('opacity', 0); return; }
    const [ax, ay] = project(active);
    // la légende se place du côté du système survolé
    if ((ax > W * 0.5) !== right) { right = !right; cap.classList.toggle('is-r', right); }
    const m = W * 0.02;
    const sx = right ? W - m - capBox.w - 12 : m + capBox.w + 12;
    const kx = sx + (right ? -1 : 1) * Math.min(70, Math.abs(ax - sx) * 0.3);
    lp.setAttribute('d', `M${sx},${capBox.y} H${kx} L${ax},${ay}`); lp.setAttribute('opacity', 1);
    lc.setAttribute('cx', ax); lc.setAttribute('cy', ay); lc.setAttribute('opacity', 1);
  }

  /* ---------- boucle : tourne seulement quand c'est visible ---------- */
  const clock = new THREE.Clock();
  let visible = false, rafId = 0, settle = 0;
  let inFrame = false, skip = 0, lastScroll = 0;
  function frame() {
    rafId = 0;
    if (!visible || document.hidden) return;
    inFrame = true;
    const now = performance.now();
    // pendant le défilement de la page : 1 image sur 3 (~20 fps) pour laisser la main au scroll
    skip = (now - lastScroll < 150) ? (skip + 1) % 3 : 0;
    if (skip) { rafId = requestAnimationFrame(frame); inFrame = false; return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    // rotation automatique après 5 s sans interaction
    if (!reduce && !pinned && now - lastUser > 5000) controls.autoRotate = true;

    let moving = controls.autoRotate;
    controls.update(dt);
    if (pointer && pickDirty && !pinned) { pickDirty = false; setActive(pick(pointer[0], pointer[1])); }
    for (const p of Object.values(parts)) {
      const c = p.mesh.material.color;
      if (!c.equals(p.target)) { c.lerp(p.target, 1 - Math.pow(0.0008, dt)); moving = true; if (Math.abs(c.r - p.target.r) < 0.002) c.copy(p.target); }
    }
    // le système actif passe devant les autres (rendu après un effacement de la profondeur)
    renderer.setRenderTarget(rt); renderer.clear();
    for (const s of SYSTEMS) parts[s.id].mesh.visible = s.id !== active;
    renderer.render(scene, cam);
    if (active) {
      renderer.clearDepth();
      for (const s of SYSTEMS) parts[s.id].mesh.visible = s.id === active;
      renderer.render(scene, cam);
    }
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
  window.addEventListener('scroll', () => { cvRect = null; lastScroll = performance.now(); }, { passive: true });
  resize();

  renderer.compile(scene, cam);
  renderer.compile(pickScene, cam);
  renderer.compile(postScene, postCam);
  lastUser = performance.now() - 3000;
  root.classList.add('is-ready');
  wake();
}

/* Initialisation paresseuse : on charge three.js (~650 Ko) et la maquette (~790 Ko) seulement à l'approche de la section */
document.querySelectorAll('[data-pack3d]').forEach((root) => {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  window.addEventListener('load', () => idle(() => preload(root).catch(() => {}), { timeout: 4000 }), { once: true });
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    init(root).catch((err) => { console.error('[package-3d]', err); root.classList.add('is-fallback'); });
  }, { rootMargin: '600px 0px' });
  io.observe(root);
});
