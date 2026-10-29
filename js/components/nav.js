/* =========================================================
   Composant « Nav » — navigation fixe, 3 états (Figma « Navbar ») :
   - défaut        : menu déplié (haut de page, sur le hero)
   - .is-collapsed : menu replié en pastilles dès qu'on a scrollé
   - .is-open      : panneau ouvert au survol des pastilles, refermé quand la souris quitte le menu
                     (ou CLOSE, Échap). Clavier / tactile : le bouton pastilles ouvre, focus ou toucher ailleurs ferme.
   Couleur : .nav--on-light sur chaque bloc (logo, pastilles, langue, bouton, burger) qui passe sur un fond clair
   (encre foncée). Le fond est lu sur les zones [data-nav-bg="dark|light"] sous le centre de chaque bloc ;
   si plusieurs se superposent, la dernière dans le DOM l'emporte. Aucune zone = fond clair.
   API : window.Nav.setOverlay(bool) → force l'encre claire (menu mobile ouvert par-dessus)
   ========================================================= */
(() => {
  'use strict';
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;

  const COLLAPSE_AT = 80;   // px scrollés avant de replier le menu
  const PROBE_Y = 43;       // ligne de lecture du fond : milieu de la barre (24 + 38 / 2)
  const CLOSE_DELAY = 250;  // ms de tolérance quand la souris sort du menu

  const DOT_COLORS = ['green', 'amber', 'peach', 'lilac'];  // tokens de style.css

  const slot = nav.querySelector('[data-nav-slot]');
  const toggle = nav.querySelector('[data-nav-toggle]');
  const panel = nav.querySelector('[data-nav-panel]');

  /* ---------- Pastilles : une couleur aléatoire par item ----------
     Tirée par index --i (même couleur dans le menu déplié et le panneau),
     jamais identique à celle de l'item précédent. */
  const dotColor = [];
  nav.querySelectorAll('.nav__item').forEach((item) => {
    const i = Number(item.style.getPropertyValue('--i')) || 0;
    if (!dotColor[i]) {
      const choices = DOT_COLORS.filter((c) => c !== dotColor[i - 1]);
      dotColor[i] = choices[Math.floor(Math.random() * choices.length)];
    }
    item.style.setProperty('--dot', `var(--${dotColor[i]})`);
  });

  /* ---------- Panneau (survol des pastilles) ---------- */
  let closeTimer = null;
  let hoverLocked = false;  // après CLOSE : pas de réouverture tant que la souris n'est pas sortie du menu

  function setOpen(open) {
    clearTimeout(closeTimer);
    if (nav.classList.contains('is-open') === open) return;
    if (!open && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  }

  if (slot && toggle && panel) {
    const isMouse = (e) => e.pointerType === 'mouse';
    toggle.addEventListener('pointerenter', (e) => {
      if (isMouse(e) && !hoverLocked && nav.classList.contains('is-collapsed')) setOpen(true);
    });
    slot.addEventListener('pointerenter', (e) => { if (isMouse(e)) clearTimeout(closeTimer); });
    slot.addEventListener('pointerleave', (e) => {
      if (!isMouse(e)) return;
      hoverLocked = false;
      closeTimer = setTimeout(() => setOpen(false), CLOSE_DELAY);
    });

    toggle.addEventListener('click', () => setOpen(true));
    slot.addEventListener('focusout', (e) => { if (!slot.contains(e.relatedTarget)) setOpen(false); });
    nav.querySelector('[data-nav-close]').addEventListener('click', () => { hoverLocked = true; setOpen(false); });
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (e) => { if (!slot.contains(e.target)) setOpen(false); });
  }

  /* ---------- Replié / déplié ---------- */
  let collapsed = null;
  function onScroll() {
    const c = window.scrollY > COLLAPSE_AT;
    if (c === collapsed) return;
    collapsed = c;
    nav.classList.toggle('is-collapsed', c);
    if (!c && panel) setOpen(false);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Fond clair / sombre sous la nav ----------
     Chaque bloc (logo, pastilles, langue, bouton, burger) lit le fond sous son propre centre :
     un logo sur une carte claire passe en foncé même si le reste de la barre est sur fond sombre. */
  const zones = Array.from(document.querySelectorAll('[data-nav-bg]'));
  const regions = [
    { el: nav.querySelector('.nav__logo'), at: 0.15 },  // le mot « Verdon » n'occupe que la gauche du SVG (347 px)
    { el: slot, probe: toggle },                        // sonde sur les pastilles
    { el: nav.querySelector('.nav__lang') },
    { el: nav.querySelector('.nav__cta') },
    { el: nav.querySelector('.nav__burger') },
  ].filter((r) => r.el).map((r) => ({ ...r, probe: r.probe || r.el, at: r.at ?? 0.5, hits: new Set() }));
  let overlay = false;

  function paint() {
    regions.forEach((r) => {
      let bg = 'light';
      for (let i = zones.length - 1; i >= 0; i--) {
        if (r.hits.has(zones[i])) { bg = zones[i].dataset.navBg; break; }
      }
      r.el.classList.toggle('nav--on-light', bg === 'light' && !overlay);
    });
  }

  let observers = [];
  function observe() {
    observers.forEach((io) => io.disconnect());
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    observers = regions.map((r) => {
      r.hits.clear();
      const b = r.probe.getBoundingClientRect();
      const x = Math.min(vw - 1, Math.max(0, Math.round(b.left + b.width * r.at)));
      // racine réduite à un point de 1 px : (centre du bloc, PROBE_Y)
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? r.hits.add(e.target) : r.hits.delete(e.target)));
        paint();
      }, { rootMargin: `-${PROBE_Y}px -${vw - x - 1}px -${Math.max(0, vh - PROBE_Y - 1)}px -${x}px` });
      zones.forEach((z) => io.observe(z));
      return io;
    });
  }

  if ('IntersectionObserver' in window && zones.length) {
    observe();
    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(observe, 150); });
  }

  window.Nav = {
    setOverlay(on) { overlay = !!on; paint(); },
  };
})();
