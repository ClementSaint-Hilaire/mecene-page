# Verdon — page Mécène (intégration Figma 258:4361)

Page statique HTML / CSS / JS. Ouvrir `index.html` via un petit serveur local
(ex. `npx serve .` ou l'extension Live Server) : certaines animations et le chargement
des SVG ne fonctionnent pas en `file://`.

## Structure
- `index.html` : toute la page (hero, positionnement + chiffres, services, expertises,
  factory built, témoignages, partenaires, actus, FAQ, CTA + footer)
- `factory-built.html` : page Factory built (Figma 318:3931, voir « Page Factory built » plus bas),
  avec `css/factory-built.css` et `js/factory-built.js` (styles et animations propres à la page)
- `contact.html` : page Contact (Figma 328:4976, voir « Page Contact » plus bas), avec `css/contact.css` et `js/contact.js` (envoi du formulaire)
- `css/style.css` : tokens Figma en variables CSS, layout desktop 1500 px, responsive (≤1280, ≤991, ≤767)
- `js/main.js` : animations liées au scroll (pin, parallaxes, intro du hero, FAQ, compteurs), communes à toutes les pages
  (chaque bloc ne tourne que si sa section est dans la page)
- `js/components/` : composants réutilisables
  - `nav.js` : navigation fixe (3 états, encre selon le fond, voir plus bas)
  - `gradient-text.js` + `css/components/gradient-text.css` : apparition du texte par le dégradé
  - `reveal.js` : apparitions à l'entrée dans l'écran (`data-reveal="up|fade|clip|scale|line|vline|wipe|card|xcard|quote"`)
  - `package-3d.js` : maquette 3D interactive du package factory-built (section Factory built)
  - `europe-map.js` : carte Europe en points, en rotation (footer, et carte des sites de la page Contact)
  - `wordmark-dots.js` : signature « verdon groupe » en points, colorée au survol (footer)
  - `service-dots.js` : pictogrammes en points des cartes « Our services » et « Expertises » (accueil), « The Factory-Built advantage » et « Our process » (Factory built), parcourus par un flux au survol ; illustrations en points des vignettes « One integrated chain » et du visuel des Steps
- `js/vendor/` : GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13, three.js 0.160 (aucun CDN requis)
- `assets/package-3d.json` + `assets/package-3d.bin` : géométrie de la maquette 3D (index des 8 systèmes ; positions et triangles en uint16, gzip), `assets/package-3d-poster.webp` : image fixe (rendue en 2×) affichée avant le chargement ou sans WebGL
- `assets/wordmark-dots.json` : points de la signature du footer (Figma 273:216)
- `assets/europe-dots-fine.json` : points de la carte des sites de la page Contact (grille 3 fois plus fine que `europe-dots.json`, même projection)
- `assets/` : images et SVG exportés de Figma

## Police
La maquette utilise **ABC Areal Superfamily Variable** (Dinamo, licence payante).
Déposer le fichier `ABCArealSuperfamilyVariable.woff2` dans `fonts/`, ou installer
la police sur le poste. Sinon, la page s'affiche en Helvetica Neue / Arial
(les chiffres « 180 000+ » perdent alors leur style).

## Composant « Gradient text »
Le texte apparaît de gauche à droite à l'entrée dans l'écran, le bord d'attaque passant par le dégradé lilas → vert. Deux modes :
- `data-gt-lines` (animation du titre h1) : à mettre sur les h1, h2, h3 et légendes des chiffres clés. Le texte est découpé en lignes telles qu'elles tombent à l'écran (redécoupé au redimensionnement) et chaque ligne a son propre balayage, décalé de `--gt-stagger`. Les `<span>` de couleur et les `<br>` sont conservés.
- `data-gt` : un seul balayage sur tout l'élément (libellés de CTA). Sur les boutons (`[data-btn]`), il est rejoué au survol.

Réglages par variables CSS, sur l'élément ou un parent : `--gt-duration`, `--gt-delay`, `--gt-stagger`, `--gt-feather`, `--gt-c1` à `--gt-c4`. `data-gt-hover="false"` désactive la relecture au survol.

## Signature du footer (Figma 273:216)
La signature « verdon groupe » est une matrice de 894 points dessinée en canvas (`js/components/wordmark-dots.js`, données `assets/wordmark-dots.json`). Au survol, les points proches du curseur chauffent et passent de la couleur du texte (`--ink`) au dégradé habituel (lilas → pêche → ambre → vert, `--gt-c1` à `--gt-c4`) en doublant de taille, puis refroidissent lentement derrière lui (traînée). Au toucher, un tap colore la zone touchée. Réglages en tête du fichier : `RADIUS` (rayon d'influence), `HEAT_IN` / `HEAT_OUT` (vitesse de montée et de retour à la couleur du texte), `GROW` (grossissement des points chauds : sans lui, les points de ~1,7 px sont délavés par l'anticrénelage et les couleurs paraissent ternes). Le rendu ne tourne que pendant le survol et le refroidissement.

## Pictogrammes des services et expertises
Chaque carte « Our services » et « Expertises » de l'accueil, et chaque carte « The Factory-Built advantage » et « Our process » de la page Factory built, porte un pictogramme en matrice de 24 × 16 points dessiné en canvas (`js/components/service-dots.js`, `<div class="gdots" data-service-dots="…">`). Services : skid (cuve, pompe, échangeur sur châssis), portique support de tuyauterie, tableau basse tension, conduites avec coudes et vanne, allée froide confinée, schéma unifilaire de distribution, goutte et plaque froide de puce. Expertises : double hélice d'ADN, pylône électrique, baies de data center, wafer de semi-conducteurs. Factory-Built advantage : chronomètre (délais), bouclier et coche (qualité), grue à tour levant un module (moins de travaux sur site), piles de modules identiques (industrialisation). Our process : module en perspective avec sa cote (conception), fournisseurs qui convergent vers l'entrepôt (approvisionnement), usine à sheds et coche de validation (fabrication), camion chargé d'un module (livraison). Pas de 7 px (168 × 112) sur les cartes `.gcard` (services, process), de 6 px (144 × 96) sur les cartes `.xcard` (expertises, advantage), dont la hauteur est fixe. Vignettes « One integrated chain » et calques du visuel des Steps : illustrations dessinées sur une grille de 20 × 25, réduites à 70 % au centre de la vignette (`--dots-scale: .7` dans `css/factory-built.css` : la matrice de points éteints remplit toujours la vignette, au pas de ~7 px, ~5,7 px sur mobile), en clair sur le fond sombre (`--dots-ink` / `--dots-muted` sur le conteneur, en hexadécimal), clés `step-…` dans l'ordre des étapes : clé à molette dont le flux remonte le manche jusqu'aux mors (conception), calendrier dont les jours défilent jusqu'à la date réservée (achats), bras robotisé sur un module (fabrication), manomètre sur une conduite (essais), module raccordé au réseau du site par des brides (intégration), liste de contrôle cochée ligne après ligne (mise en service). Pages d'« Industrial scale » : grilles de 24 × 16 au pas de 6 px, clés `fb-…` : un modèle décliné en trois formats (processus standardisés), trois usines identiques sous leur repère, allumées le long de la route (fabrication répétable), onde partie du centre jusqu'à l'anneau des douze étoiles (livraison européenne coordonnée) ; le flux se lance au survol de la page entière. La taille de grille est lue dans le dessin. L'événement `service-dots:play` sur un `[data-service-dots]` relance un passage du flux (`js/factory-built.js` l'envoie au calque de l'étape active, et au survol de la 1re vignette, cachée sous le visuel). Les grilles sont écrites en caractères dans `ARTS`, en tête du fichier (`#` trait, `+` remplissage gris, `o` / `~` trait / fluide parcourus par le flux, `src` points de départ du flux) : on modifie un dessin en éditant ses lignes. Les points montent du bas quand la carte entre à l'écran, puis un premier passage du flux montre ce que le pictogramme illustre. Au survol de la carte, des impulsions partent des sources et suivent le tracé (eau, air, courant, charges) en passant au dégradé habituel (`--gt-c1` à `--gt-c4`). Réglages en tête du fichier : `SPEED`, `WAVE`, `TAIL` (impulsions), `GROW`, `RISE` / `POP` (apparition). Sans animation si `prefers-reduced-motion`.

## Navigation (Figma « Navbar » : héro / scroll / menu hover)
Fixe en haut de page, trois états :
- en haut de page : menu déplié ;
- dès qu'on scrolle (80 px) : le menu se replie en 6 pastilles ;
- au survol des pastilles : panneau sombre (liens, CLOSE, contact) qui se déplie depuis les pastilles et se referme quand la souris sort. Au clavier ou au toucher, le bouton pastilles ouvre le panneau ; Échap, CLOSE ou un clic ailleurs le ferment.

`data-nav-compact` sur `.nav` (page Factory built, comme sur sa maquette) : menu replié en pastilles dès le haut de page ; mettre aussi la classe `is-collapsed` dans le HTML pour que le menu déplié n'apparaisse pas avant le JS.

Encre : blanche sur fond sombre, noire sur fond clair, bloc par bloc (logo, pastilles, langue, burger). Chaque section porte `data-nav-bg="dark"` ou `"light"` ; la dernière zone dans le DOM l'emporte (ex. cartes claires dans le bandeau sombre des services). Pour une nouvelle section, ajouter l'attribut. L'arc dégradé du positionnement compte comme fond clair à partir de `.positioning__navbg` (hauteur réglée à l'œil : 110 px desktop, 170 px ≤ 991 px) ; même chose pour l'arc retourné en haut des actus avec `.news__navbg`. Le bouton WORK WITH US reste blanc partout, comme sur la maquette.

## Page Factory built (Figma 318:3931)
Même nav, mêmes boutons, FAQ, CTA et footer que l'accueil ; titres « Heading 1 » à 64 px (`.fb-h1`, 54 px sur l'accueil).
- Hero : photo plein cadre (`assets/factory-hero.webp`, 2400 px, et `factory-hero-1200.webp` pour les petits écrans) assombrie en bas à gauche par le dégradé radial de la maquette ; elle apparaît depuis le noir puis descend en parallaxe pendant que l'intro recouvre le hero (le hero reste collé, comme sur l'accueil).
- Intro : section de 100vh, trait vertical dessiné à l'entrée ; le texte est en `--ink-3`. Une fois la section en plein écran, elle est épinglée le temps d'une hauteur d'écran de scroll pendant laquelle le texte passe en `--ink` lettre après lettre (`[data-fb-chars]`, `js/factory-built.js`). Sans JS ou si « réduire les animations » : texte directement en `--ink`, sans épinglage.
- The Factory-Built advantage : même composant que les Expertises de l'accueil (`.xcard`), colonne gauche collante, pictogrammes en points (voir « Pictogrammes des services et expertises »).
- Our process : même composant que « Our services » (`.services`, scroll horizontal épinglé), cartes à pictogramme en points ; trait des cartes `assets/frame-104-short.svg` (365 px, cartes de 440 px).
- One integrated chain : 6 vignettes 200 × 250 qui débordent à droite, chacune illustrée en points (voir « Pictogrammes des services et expertises »). Desktop : quand la rangée arrive au milieu de l'écran, la section est épinglée avec les Steps (`.fbflow`, le haut des Steps reste visible sous les vignettes) le temps d'une hauteur d'écran, et les vignettes 2 à 6 glissent l'une après l'autre sous la première (pile à gauche) ; les sections repartent, la pile reste collée au milieu de l'écran et devient le visuel des Steps, qui descend le long de la règle graduée. Techniquement, le visuel collant des Steps est remonté sur la 1re vignette (`.fbsteps.is-linked`, `--chain-lead` calculé par `js/factory-built.js`) : les colonnes des deux sections doivent rester alignées (300 + 128 px, 300 + 64 px ≤ 1280 px, 220 + 64 px ≤ 1100 px). Tablette et mobile : scroll horizontal natif. Sans animation si « réduire les animations ».
- Steps : sommaire collant (étape active marquée d'une pastille, clic = étape centrée à l'écran), règle graduée (`assets/frame-427321029.svg`) dont les graduations se remplissent au dégradé lilas → vert jusqu'à l'étape en cours, visuel 200 × 250 collé au milieu de l'écran avec un calque par étape (`[data-steps-slide]`, dans l'ordre des étapes, même illustration en points que la vignette de la même étape), empilés comme les vignettes (le 1er dessus) : à l'étape suivante, le calque du dessus se relève et découvre le suivant, dont l'illustration est parcourue une fois par le flux ; il redescend en remontant.
- Industrial scale : section sombre ; à droite du texte, trois pages sombres en vue isométrique, posées sur le fond de la section (`.fbpages`, une par ligne de la maquette : titre, complément, illustration en points en clair), empilées de la plus éloignée (01, en haut à droite) à la plus proche (03, en bas à gauche), qui se posent l'une après l'autre (`data-reveal="page"`). Illustration à gauche, texte à droite dans chaque page. Projection orthogonale par rotations 3D sans perspective ; réglages en variables CSS sur `.fbpages` : taille d'une page (`--pw`, `--ph`), décalage entre pages (`--sx`, `--sy`), angles de vue (`--rx`, `--ry`), survol (`--lift`, `--drop`, `--lift-front`). Au repos, le texte de chaque page est lisible ; au survol, la page monte et celles de devant descendent pour découvrir son illustration, parcourue par le flux. Pages réduites quand la colonne rétrécit (`@container`), à plat l'une sous l'autre sur mobile.

## Page Contact (Figma 328:4976)
Même nav (pastilles dès le haut de page, `data-nav-compact`), mêmes FAQ, CTA et footer que les autres pages ; titre « Heading 1 » à 64 px.
- En-tête : téléphone, titre et présentation sur une ligne ; le trait du dessous se dessine à l'entrée.
- Formulaire : onglets « type de demande » (boutons radio, non sélectionnés à 50 % d'opacité), champs dont le libellé remonte au focus ou une fois rempli, trait foncé dessiné au focus. Champs marqués * requis : validation native du navigateur. Onglets puis colonnes se replient selon la largeur de la carte du formulaire (`@container`).
- Groupe propre à chaque onglet (`[data-request-group]` = `data-request` de l'onglet, `js/contact.js`) : ASK A QUESTION → « Reason of enquiry » (2 colonnes de 6, remplies colonne par colonne : c'est aussi l'ordre du clavier) ; SPEAK ABOUT YOUR PROJECT → aucun ; ASK FOR A VISIT → « Desired location » (les 5 sites de la carte). Un groupe masqué est désactivé : il sort du clavier et de l'envoi.
- Envoi (`js/contact.js`) : tant qu'aucun service n'est branché, ouvre la messagerie du visiteur avec un e-mail prérempli (type, raison ou lieu, coordonnées, message) adressé à `data-mailto` (info@groupe-verdon.com). Pour brancher un service d'envoi, renseigner `action` (et `method="post"`) sur le `<form>` : l'envoi classique prend alors le relais.
- E-mails de Luc Gerodez et Mikus Strele (`[data-copy]`) : copiés dans le presse-papiers au clic, confirmés par un petit toast en bas de l'écran (fond du panneau de la nav, pastille verte, texte qui apparaît par le dégradé) et annoncés aux lecteurs d'écran ; si le navigateur refuse la copie, la messagerie s'ouvre.
- Carte des sites : colonne de droite collante (686 px de haut sur la maquette, centrée dans l'écran sous la nav, raccourcie sur les écrans bas). Même composant que le footer (`europe-map.js`), sur une grille 3 fois plus fine (`assets/europe-dots-fine.json`, ~7 950 points, régénérée depuis Natural Earth 1:50m avec la projection de `europe-dots.json`) pour garder à cette taille le pas de points du footer (~8 px). Points plus clairs (`--emap-ink` sur `.ctmap`) et un peu plus petits, sites agrandis pour ressortir (`dotScale` / `siteScale` dans le JSON). Tablette et mobile : carte dans le flux, sous les infos de contact.
- Les boutons WORK WITH US, TALK WITH US / TALK TO US et CONTACT des autres pages mènent à `contact.html`, EMAIL US à info@groupe-verdon.com ; sur la page Contact, ils ramènent au formulaire.

## Scroll lissé
Désactivé par défaut (le scroll natif reste fluide même quand la page calcule). Pour réactiver Lenis : `<html data-smooth-scroll>`.

## Animations
- Hero : vidéo de la matrice de points en boucle, apparition du menu et du titre ligne par ligne
  (composant Gradient text), parallaxe à la souris, le hero reste collé pendant que
  la section suivante le recouvre (avec l'arc dégradé).
- h1, h2, h3 et légendes des chiffres : composant « Gradient text » ligne par ligne (`data-gt-lines`,
  motion Figma du titre positionnement, easing cubic-bezier(.42,0,.58,1)) ; CTA : un seul balayage,
  rejoué au survol des boutons.
- Compteurs 0 → 180 000+, lignes qui se dessinent, photos révélées par un masque.
- Our services : scroll horizontal épinglé (desktop), le grand « OUR SERVICES » en parallaxe,
  cartes qui entrent une à une (sans flou d'arrière-plan, trop coûteux au scroll) ; scroll horizontal natif sur tablette et mobile.
  Chaque carte porte un pictogramme en matrice de points (voir « Pictogrammes des services et expertises »).
- Expertises : pictogrammes en points (voir « Pictogrammes des services et expertises »), traits verticaux dessinés, blobs de couleur qui dérivent.
- Factory built : maquette 3D interactive du package (data hall) en matrice de points, d'après « Verdon Factory-Built.html ». Survol ou toucher d'un système (ou de sa pastille) : il passe devant les autres et ses points prennent le dégradé habituel (lilas → pêche → ambre → vert, `--gt-c1` à `--gt-c4`, de gauche à droite sur son étendue à l'écran) ; sa légende s'affiche dans le coin de la vue, de son côté, reliée par une ligne de rappel (légende pleine largeur en haut de la vue ≤ 700 px) ; un clic la fige. Glisser pour tourner, rotation automatique après 5 s sans interaction. Textes des 8 systèmes dans `SYSTEMS`, en tête de `js/components/package-3d.js` ; densité des points réglée par `CELL` (pas de la grille en px CSS, 3) et `CELL_S` (vue de moins de 560 px, 2,5). Après un changement de densité, refaire l'image fixe. three.js et la maquette (~790 Ko) ne sont chargés qu'au besoin, le rendu s'arrête hors écran. Frise des 8 étapes (Design → Commissioning support) en dessous.
- Actus : le même arc dégradé que sous le hero, retourné, assure le passage partenaires (clair) → actus (sombre) ; trait vert et image qui suivent l'article survolé (fondu + léger zoom arrière). FAQ : accordéon animé.
- CTA : parallaxe de la photo, footer qui remonte, signature « verdon groupe » révélée puis colorée au survol.
- `prefers-reduced-motion` respecté (tout s'affiche sans animation).

## Points à valider
- Pas de maquette tablette ni mobile : le responsive a été déduit.
- Factory built : pages isométriques d'« Industrial scale » d'après un croquis (pas de maquette) ; chaque ligne de la liste a été coupée en titre + complément (« Standardised processes » / « Adaptable to project requirements. », etc.), sans changer le texte.
- Factory built : les 6 vignettes de « One integrated chain » et le visuel des Steps sont des blocs pleins sur la maquette (visuels à venir) ; ils sont intégrés tels quels, prêts à recevoir une image (une `.fbtile` et un `.fbsteps__slide` par étape, dans l'ordre). La vignette n et le calque n doivent porter le même visuel : sur desktop, la pile de vignettes passe le relais au visuel des Steps sans coupure.
- Factory built : coquille corrigée dans le texte des avantages (« environmetunts » → « environments ») ; FAQ numérotée 01 à 06 (toutes en « 02 » sur la maquette).
- Contact : les 12 raisons de la demande de la maquette sont des intitulés de logistique (Air Freight, Brokerage, 3PL…) sans rapport avec l'activité de Verdon ; intégrées telles quelles, à remplacer.
- Contact : lieux de visite (« Desired location ») absents de la maquette ; ce sont les 5 sites de la carte, à confirmer avec eux.
- Contact : les 3 adresses d'« Our locations » sont identiques sur la maquette (siège de Courcelles), intégrées telles quelles ; lien LinkedIn à renseigner (`href="#"`) ; envoi du formulaire à brancher (voir « Page Contact »).
- Contact : coquilles corrigées (« Your infomation » → « Your information », « LNKEDIN » → « LINKEDIN »), e-mails en minuscules comme dans le footer ; libellés des champs en ABC Areal (Helvetica Neue sur la maquette) ; texte du CTA et première ligne du footer repris des autres pages (lorem ipsum sur la maquette).
- Images des actus : visuels provisoires (photos déjà dans `assets/`), une `<img class="news__pic">` par article dans `.news__img`, dans le même ordre que la liste.
- Footer : carte de l'Europe en matrice de points, vue isométrique en rotation lente (un tour en 90 s), centrée sur la France / Belgique (`js/components/europe-map.js` + `assets/europe-dots.json`, générées depuis Natural Earth 1:50m, ~880 points en canvas, rendu seulement à l'écran). Les 5 sites sont des points de la grille colorés, nom au survol. Sites à confirmer : Courcelles (siège), Liège, Lille, Paris, Lyon.
- Hero : vidéo « dotmatrix_24s » (24 s en boucle, sans son), recompressée en H.264 24 i/s : `hero-dots-1080.mp4` (8 Mo, desktop) et `hero-dots-720.mp4` (4 Mo, ≤ 991 px), noirs ramenés à 0 et fondus dans le dégradé du hero (`mix-blend-mode: screen`). Image poster tant que la vidéo charge ; vidéo en pause quand le hero est recouvert ou l'onglet masqué ; poster seul si « réduire les animations ».
