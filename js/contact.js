/* =========================================================
   Verdon — page Contact · formulaire
   (nav, intro, FAQ, CTA + footer : js/main.js et js/components/ ; carte : js/components/europe-map.js)
   - Onglets (type de demande) : chaque groupe [data-request-group] n'est affiché, et envoyé, que pour son onglet
     (raison de la demande : « Ask a question » ; lieu souhaité : « Ask for a visit » ; aucun : « Speak about your project »).
     Un groupe masqué est aussi désactivé : ses champs sortent du clavier et de l'envoi.
   - Champs requis : validation native du navigateur (l'événement submit n'arrive qu'une fois le formulaire valide).
   - Envoi : tant qu'aucun service n'est branché (attribut action du <form>), la messagerie du visiteur
     s'ouvre avec un e-mail prérempli adressé à data-mailto. Avec un action, envoi classique.
   - [data-copy] : l'adresse est copiée dans le presse-papiers au clic, confirmée par un toast
     (messagerie à défaut, si la copie est refusée).
   - Chargement : apparitions du haut vers le bas (voir plus bas).
   ========================================================= */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Chargement : du haut vers le bas ----------
     nav (0.2 s) → titre (Gradient text, 0.45 s) → téléphone et présentation (intro de js/main.js, ~1 s)
     → trait de l'en-tête (0.8 s, lent au départ, css/contact.css) → éléments du corps visibles à l'arrivée, à partir de INTRO,
     décalés selon leur position verticale (la colonne de droite juste après la gauche à hauteur égale).
     Le délai s'ajoute à --d (décalage entre frères, js/components/reveal.js) ; la carte attend aussi pour
     dessiner ses points (--emap-delay). Les éléments sous la ligne de flottaison apparaissent au scroll, sans délai. */
  const INTRO = 1.45;       // s
  const PER_PX = 0.0008;    // s par px vers le bas (~0.4 s pour 500 px)
  const RIGHT = 0.1;        // s pour la colonne de droite
  if (!reduceMotion) {
    const items = Array.from(document.querySelectorAll('.ctbody [data-reveal]'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.top < innerHeight);
    const top = Math.min(...items.map(({ r }) => r.top));
    items.forEach(({ el, r }) => {
      const delay = (INTRO + (r.top - top) * PER_PX + (r.left > innerWidth / 2 ? RIGHT : 0)).toFixed(2);
      el.style.setProperty('--d', `calc(${el.style.getPropertyValue('--d') || '0s'} + ${delay}s)`);
      if (el.hasAttribute('data-europe-map')) el.style.setProperty('--emap-delay', `${delay}s`);
    });
  }

  /* ---------- Adresses copiées au clic ---------- */
  const toast = document.querySelector('[data-toast]');
  const live = document.querySelector('[data-toast-live]');
  let toastTimer = 0;
  function showToast(address) {
    clearTimeout(toastTimer);
    toast.classList.add('is-on');
    const text = toast.querySelector('[data-gt]');
    if (window.GradientText && text) GradientText.play(text);
    // texte vidé puis réécrit : la même adresse copiée deux fois est annoncée deux fois
    live.textContent = '';
    setTimeout(() => { live.textContent = `${address} copied to the clipboard`; }, 50);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2200);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* contexte non sécurisé (http) : ancienne méthode */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
  document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const address = btn.dataset.copy;
    if (toast && live && await copy(address)) showToast(address);
    else location.href = `mailto:${address}`;
  }));

  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector('[data-contact-status]');

  /* ---------- Onglets ---------- */
  const tabs = Array.from(form.querySelectorAll('[data-request]'));
  const groups = Array.from(form.querySelectorAll('[data-request-group]'));
  function showGroups() {
    const current = (tabs.find((t) => t.checked) || tabs[0]).dataset.request;
    groups.forEach((g) => {
      const on = g.dataset.requestGroup === current;
      g.hidden = !on;
      g.disabled = !on;
    });
  }
  tabs.forEach((t) => t.addEventListener('change', () => {
    showGroups();
    // la hauteur de la page change : positions des animations au scroll (CTA, footer) à recalculer
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }));
  showGroups();   // onglet restauré par le navigateur (retour arrière)

  /* ---------- Envoi ---------- */
  form.addEventListener('submit', (e) => {
    if (form.getAttribute('action')) return;
    e.preventDefault();
    const data = new FormData(form);
    const get = (k) => String(data.get(k) || '').trim();
    const subject = `${get('request')} — ${get('company')}`;
    const choices = [];
    groups.filter((g) => !g.disabled).forEach((g) => {
      const checked = g.querySelector('input:checked');
      choices.push(`${g.querySelector('legend').textContent}: ${checked ? checked.value : '-'}`, '');
    });
    const body = [
      ...choices,
      `Company: ${get('company')}`,
      `Name: ${get('name')}`,
      `Phone: ${get('phone')}`,
      `Email: ${get('email')}`,
      '',
      get('message'),
    ].join('\r\n');
    location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (status) status.textContent = 'Your email app opens with your message, ready to send.';
  });
})();
