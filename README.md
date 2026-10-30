# Verdon — page Mécène (intégration Figma 258:4361)

Page statique HTML / CSS / JS. Ouvrir `index.html` via un petit serveur local
(ex. `npx serve .` ou l'extension Live Server) : certaines animations et le chargement
des SVG ne fonctionnent pas en `file://`.

## Structure
- `index.html` : toute la page (hero, positionnement + chiffres, services, expertises,
  factory built, témoignages, partenaires, actus, FAQ, CTA + footer)
- `css/style.css` : tokens Figma en variables CSS, layout desktop 1500 px, responsive (≤1280, ≤991, ≤767)
- `js/main.js` : animations liées au scroll (pin, parallaxes, intro du hero, FAQ, compteurs)
- `js/components/` : composants réutilisables
  - `nav.js` : navigation fixe (3 états, encre selon le fond, voir plus bas)
  - `gradient-text.js` + `css/components/gradient-text.css` : apparition du texte par le dégradé
  - `reveal.js` : apparitions à l'entrée dans l'écran (`data-reveal="up|fade|clip|scale|line|vline|wipe|card|xcard|quote"`)
  - `package-3d.js` : maquette 3D interactive du package factory-built (section Factory built)
  - `europe-map.js` : carte Europe en points, en rotation (footer)
  - `wordmark-dots.js` : signature « verdon groupe » en points, colorée au survol (footer)
  - `service-dots.js` : pictogrammes en points des cartes « Our services » et « Expertises », parcourus par un flux au survol
- `js/vendor/` : GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13, three.js 0.160 (aucun CDN requis)
- `assets/package-3d.json` + `assets/package-3d.bin` : géométrie de la maquette 3D (index des 8 systèmes ; positions et triangles en uint16, gzip), `assets/package-3d-poster.webp` : image fixe (rendue en 2×) affichée avant le chargement ou sans WebGL
- `assets/wordmark-dots.json` : points de la signature du footer (Figma 273:216)
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
Chaque carte « Our services » et « Expertises » porte un pictogramme en matrice de 24 × 16 points dessiné en canvas (`js/components/service-dots.js`, `<div class="gdots" data-service-dots="…">`). Services : skid (cuve, pompe, échangeur sur châssis), portique support de tuyauterie, tableau basse tension, conduites avec coudes et vanne, allée froide confinée, schéma unifilaire de distribution, goutte et plaque froide de puce. Expertises : double hélice d'ADN, pylône électrique, baies de data center, wafer de semi-conducteurs. Pas de 7 px (168 × 112) sur les cartes services, de 6 px (144 × 96) sur les cartes expertises, dont la hauteur est fixe. Les grilles sont écrites en caractères dans `ARTS`, en tête du fichier (`#` trait, `+` remplissage gris, `o` / `~` trait / fluide parcourus par le flux, `src` points de départ du flux) : on modifie un dessin en éditant ses lignes. Les points montent du bas quand la carte entre à l'écran, puis un premier passage du flux montre ce que le pictogramme illustre. Au survol de la carte, des impulsions partent des sources et suivent le tracé (eau, air, courant, charges) en passant au dégradé habituel (`--gt-c1` à `--gt-c4`). Réglages en tête du fichier : `SPEED`, `WAVE`, `TAIL` (impulsions), `GROW`, `RISE` / `POP` (apparition). Sans animation si `prefers-reduced-motion`.

## Navigation (Figma « Navbar » : héro / scroll / menu hover)
Fixe en haut de page, trois états :
- en haut de page : menu déplié (sauf écran peu haut : si le menu déplié recouvre le bloc marqué `data-nav-avoid`, le texte du hero, la nav reste repliée, voir `AVOID_GAP` dans `nav.js`) ;
- dès qu'on scrolle (80 px) : le menu se replie en 6 pastilles ;
- au survol des pastilles : panneau sombre (liens, CLOSE, contact) qui se déplie depuis les pastilles et se referme quand la souris sort. Au clavier ou au toucher, le bouton pastilles ouvre le panneau ; Échap, CLOSE ou un clic ailleurs le ferment.

Encre : blanche sur fond sombre, noire sur fond clair, bloc par bloc (logo, pastilles, langue, burger). Chaque section porte `data-nav-bg="dark"` ou `"light"` ; la dernière zone dans le DOM l'emporte (ex. cartes claires dans le bandeau sombre des services). Pour une nouvelle section, ajouter l'attribut. L'arc dégradé du positionnement compte comme fond clair à partir de `.positioning__navbg` (hauteur réglée à l'œil : 110 px desktop, 170 px ≤ 991 px) ; même chose pour l'arc retourné en haut des actus avec `.news__navbg`. Le bouton WORK WITH US reste blanc partout, comme sur la maquette.

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
- Factory built : maquette 3D interactive du package (data hall) en matrice de points, d'après « Verdon Factory-Built.html ». Survol ou toucher d'un système (ou de sa pastille) : il passe devant les autres et ses points prennent le dégradé habituel (lilas → pêche → ambre → vert, `--gt-c1` à `--gt-c4`, de gauche à droite sur son étendue à l'écran) ; sa légende s'affiche dans le coin de la vue, de son côté, reliée par une ligne de rappel (légende centrée en haut de la vue sur tablette, 701–991 px, avec la ligne de rappel qui part de son bas ; pleine largeur ≤ 700 px) ; un clic la fige. Glisser pour tourner, rotation automatique après 5 s sans interaction. Textes des 8 systèmes dans `SYSTEMS`, en tête de `js/components/package-3d.js` ; densité des points réglée par `CELL` (pas de la grille en px CSS, 3) et `CELL_S` (vue de moins de 560 px, 2,5). Après un changement de densité, refaire l'image fixe. three.js et la maquette (~790 Ko) ne sont chargés qu'au besoin, le rendu s'arrête hors écran. Frise des 8 étapes (Design → Commissioning support) en dessous : sur desktop, elle reste épinglée au milieu de l'écran, marque une pause puis défile avec son titre (`FRISE_SLOW` : px de scroll par px de défilement, `FRISE_HOLD` : pause au départ, dans `js/main.js`) ; scroll horizontal natif sur tablette et mobile.
- Actus : le même arc dégradé que sous le hero, retourné, assure le passage partenaires (clair) → actus (sombre) ; trait vert et image qui suivent l'article survolé (fondu + léger zoom arrière). FAQ : accordéon animé.
- CTA : parallaxe de la photo, footer qui remonte, signature « verdon groupe » révélée puis colorée au survol.
- `prefers-reduced-motion` respecté (tout s'affiche sans animation).

## Points à valider
- Pas de maquette tablette ni mobile : le responsive a été déduit.
- Images des actus : visuels provisoires (photos déjà dans `assets/`), une `<img class="news__pic">` par article dans `.news__img`, dans le même ordre que la liste.
- Footer : carte de l'Europe en matrice de points, vue isométrique en rotation lente (un tour en 90 s), centrée sur la France / Belgique (`js/components/europe-map.js` + `assets/europe-dots.json`, générées depuis Natural Earth 1:50m, ~880 points en canvas, rendu seulement à l'écran). Les 5 sites sont des points de la grille colorés, nom au survol. Sites à confirmer : Courcelles (siège), Liège, Lille, Paris, Lyon.
- Hero : vidéo « dotmatrix_24s » (24 s en boucle, sans son), recompressée en H.264 24 i/s : `hero-dots-1080.mp4` (8 Mo, desktop) et `hero-dots-720.mp4` (4 Mo, ≤ 991 px), noirs ramenés à 0 et fondus dans le dégradé du hero (`mix-blend-mode: screen`). Image poster tant que la vidéo charge ; vidéo en pause quand le hero est recouvert ou l'onglet masqué ; poster seul si « réduire les animations ».
