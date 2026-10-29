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
  - `campus-3d.js` : maquette 3D interactive du campus (section Factory built)
  - `europe-map.js` : carte Europe en points, en rotation (footer)
- `js/vendor/` : GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13, three.js 0.160 (aucun CDN requis)
- `assets/campus-3d.json` : géométrie de la maquette 3D
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

## Navigation (Figma « Navbar » : héro / scroll / menu hover)
Fixe en haut de page, trois états :
- en haut de page : menu déplié ;
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
- Expertises : étoiles qui pivotent, traits verticaux dessinés, blobs de couleur qui dérivent.
- Factory built : maquette 3D interactive du campus (survol ou toucher pour voir chaque bâtiment, glisser pour tourner, visite automatique au repos). three.js n'est chargé qu'au besoin, le rendu s'arrête hors écran.
- Actus : le même arc dégradé que sous le hero, retourné, assure le passage partenaires (clair) → actus (sombre) ; trait vert et image qui suivent l'article survolé (fondu + léger zoom arrière). FAQ : accordéon animé.
- CTA : parallaxe de la photo, footer qui remonte, signature « verdon groupe » révélée.
- `prefers-reduced-motion` respecté (tout s'affiche sans animation).

## Points à valider
- Pas de maquette tablette ni mobile : le responsive a été déduit.
- Images des actus : visuels provisoires (photos déjà dans `assets/`), une `<img class="news__pic">` par article dans `.news__img`, dans le même ordre que la liste.
- Footer : carte de l'Europe en matrice de points, vue isométrique en rotation lente (un tour en 90 s), centrée sur la France / Belgique (`js/components/europe-map.js` + `assets/europe-dots.json`, générées depuis Natural Earth 1:50m, ~880 points en canvas, rendu seulement à l'écran). Les 5 sites sont des points de la grille colorés, nom au survol. Sites à confirmer : Courcelles (siège), Liège, Lille, Paris, Lyon.
- Hero : vidéo « dotmatrix_24s » (24 s en boucle, sans son), recompressée en H.264 24 i/s : `hero-dots-1080.mp4` (8 Mo, desktop) et `hero-dots-720.mp4` (4 Mo, ≤ 991 px), noirs ramenés à 0 et fondus dans le dégradé du hero (`mix-blend-mode: screen`). Image poster tant que la vidéo charge ; vidéo en pause quand le hero est recouvert ou l'onglet masqué ; poster seul si « réduire les animations ».
