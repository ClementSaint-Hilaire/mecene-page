/* =========================================================
   Composant « Service dots » — pictogramme en matrice de points de chaque carte « Our services »
   et « Expertises » de l'accueil, et des cartes « The Factory-Built advantage » et « Our process »
   de la page Factory built (à la place des étoiles), dessiné en canvas : grille de 24 × 16 points sur les cartes.
   Même composant, en pleine vignette et en clair sur fond sombre, sur les vignettes « One integrated chain »
   et les calques du visuel des Steps (grilles de 20 × 25 : la taille est lue dans la grille).
   Grilles de 24 × 16 sur les pages isométriques du panneau « Industrial scale » (survol : la page entière).
   Légende des grilles (ARTS) :
     '#' trait (couleur du texte, --ink)        '+' remplissage (gris, --ink-2)
     'o' trait parcouru par le flux (--ink)      '~' fluide parcouru par le flux (gris, --ink-2)
     '.' point éteint (fond de la matrice, très léger)
     src : points de départ du flux [x, y]
   Couleurs de repos : --dots-ink et --dots-muted sur un conteneur remplacent --ink et --ink-2 (fond sombre).
   --dots-scale (< 1) réduit le dessin au centre d'une matrice plus fine, qui remplit toujours l'élément.
   Au survol de la carte, des impulsions partent des sources et suivent le tracé (câbles, tuyaux, air,
   charges dans la structure) : la distance est mesurée de proche en proche le long des points flux.
   En passant, un point quitte sa couleur de repos pour le dégradé habituel
   (lilas → pêche → ambre → vert, --gt-c1…--gt-c4) et grossit un peu.
   Apparition : quand la carte reçoit .is-in (reveal.js), les points montent du bas,
   puis un premier passage du flux montre ce que le pictogramme illustre.
   L'événement « service-dots:play » sur l'élément relance un passage du flux (étape active des Steps).
   La boucle ne tourne que pendant l'apparition et le flux.
   ========================================================= */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DOT = 0.27;       // rayon d'un point, en fraction du pas de la grille
  const GROW = 0.6;        // grossissement d'un point au plus fort du flux (les couleurs pastel restent lisibles)
  const SPEED = 16;        // vitesse des impulsions (points / s)
  const WAVE = 12;         // écart entre deux impulsions (points)
  const TAIL = 0.6;        // longueur de la traînée derrière une impulsion, en fraction de WAVE
  const FADE = 0.3;        // constante de temps d'allumage / d'extinction du flux (s)
  const START = 0.2;       // délai de l'apparition après .is-in sur la carte (s)
  const RISE = 0.55;       // durée de la montée de bas en haut (s)
  const JITTER = 0.15;     // désordre ajouté au délai de chaque point (s)
  const POP = 0.45;        // durée d'apparition d'un point (s)
  const INTRO_FLOW = 1.6;  // durée du premier passage du flux après l'apparition (s)
  const BUCKETS = 32;      // niveaux de couleur du flux
  const REVEAL_END = RISE + JITTER + POP;

  const ARTS = {
    // skid : cuve, pompe et échangeur sur un châssis commun, reliés par la tuyauterie
    skid: { src: [[0, 7]], grid: [
      '........................',
      '........................',
      '..###...................',
      '.#...#..................',
      '.#...#..#####..######...',
      '.#...#..#####..#~~~~~~~~',
      '.#~~~#....#....#~...#...',
      '~~~~~#...###...#~~~~#...',
      '.#~~~#..#...#..#...~#...',
      '.#~~~~~~~~~~~~~~~~~~#...',
      '..###...#...#..#....#...',
      '.#...#...###...######...',
      '########################',
      '#...#...#...#...#...#..#',
      '########################',
      '........................',
    ] },
    // portique : les tuyaux reposent sur la poutre, les charges descendent jusqu'aux pieds
    support: { src: [[11, 6], [12, 6]], grid: [
      '........................',
      '...###.....###..........',
      '..#...#...#...#...##....',
      '..#...#...#...#..#..#...',
      '..#...#...#...#..#..#...',
      '...###.....###....##....',
      '.oooooooooooooooooooooo.',
      '.o....................o.',
      '.oo..................oo.',
      '.o.o................o.o.',
      '.o..o..#++++++++#..o..o.',
      '.o...o.##########.o...o.',
      '.oooooooooooooooooooooo.',
      '.o....................o.',
      '.o....................o.',
      'ooo..................ooo',
    ] },
    // tableau basse tension : arrivée par le bas, jeux de barres, rangées de disjoncteurs
    lowvoltage: { src: [[6, 15]], grid: [
      '...##################...',
      '...#................#...',
      '...#..ooooooooooooo.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.............#...',
      '...#..o.............#...',
      '...#..ooooooooooooo.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.#.#.#.#.#.#.#...',
      '...#..o.............#...',
      '...#..o.............#...',
      '...###o##############...',
      '....#.o............#....',
    ] },
    // deux conduites en parallèle avec coudes, brides et vanne
    pipework: { src: [[0, 3], [0, 8]], grid: [
      '..........###...........',
      '......#....#............',
      '####################....',
      '~~~~~~~~~~~~~~~~~~~~#...',
      '###################~#...',
      '......#...........#~#...',
      '.........#........#~#...',
      '###############...#~#...',
      '~~~~~~~~~~~~~~~#..#~#...',
      '##############~#..#~#...',
      '.........#...#~#..#~#...',
      '.............#~#.##~##..',
      '.............#~#..#~#...',
      '............##~##.#~#...',
      '.............#~#..#~#...',
      '.............#~#..#~#...',
    ] },
    // allée froide confinée : l'air monte du faux plancher et traverse les serveurs des deux baies
    aisle: { src: [[0, 15]], grid: [
      '........................',
      '..####################..',
      '..#....#........#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#oooo~~~....~~~oooo#..',
      '..#....#.~....~.#....#..',
      '..#....#.~....~.#....#..',
      '#########~####~#########',
      '~~~~~~~~~~~~~~~.........',
    ] },
    // schéma unifilaire : transformateur, jeu de barres, départs vers les charges
    power: { src: [[10, 9]], grid: [
      '.........###............',
      '........#...#...........',
      '........#...#...........',
      '........#...#...........',
      '.........###............',
      '........#...#...........',
      '........#...#...........',
      '........#...#...........',
      '.........###............',
      '..........o.............',
      '..ooooooooooooooooo.....',
      '..o...o...o...o...o.....',
      '..o...o...o...o...o.....',
      '.ooo.ooo.ooo.ooo.ooo....',
      '.ooo.ooo.ooo.ooo.ooo....',
      '.ooo.ooo.ooo.ooo.ooo....',
    ] },
    // goutte et puce : boucle d'eau à travers la plaque froide en serpentin
    liquid: { src: [[7, 5]], grid: [
      '........................',
      '..............#.#.#.#...',
      '....#.......##########..',
      '...#+#......#........#..',
      '...#+#......#........##.',
      '..#+++#ooooooooooooo.#..',
      '.#+++++#....#......o.##.',
      '#+++++++#...#.oooooo.#..',
      '#+++++++#...#.o......##.',
      '#+++++++#...#.oooooo.#..',
      '#+++++++#...#......o.##.',
      '.#+++++#oooooooooooo.#..',
      '..#####.....#........#..',
      '............##########..',
      '..............#.#.#.#...',
      '........................',
    ] },

    /* --- cartes « Expertises » --- */
    // sciences de la vie : double hélice d'ADN, le flux court le long des brins
    pharma: { src: [[0, 3], [0, 12]], grid: [
      '........................',
      '........................',
      '........................',
      'oo........oooo........oo',
      '.ooo....ooo..ooo....ooo.',
      '.+.oo..oo..+.+.oo..oo..+',
      '.+..oooo.+.+.+..oooo.+.+',
      '.+.+.oo..+.+.+.+.oo..+.+',
      '.+.+.oo..+.+.+.+.oo..+.+',
      '.+..oooo.+.+.+..oooo.+.+',
      '.+.oo..oo..+.+.oo..oo..+',
      '.ooo....ooo..ooo....ooo.',
      'oo........oooo........oo',
      '........................',
      '........................',
      '........................',
    ] },
    // énergie : pylône à treillis, le courant passe d'un câble à l'autre par les consoles
    energy: { src: [[0, 6], [0, 10]], grid: [
      '...........##...........',
      '..........#..#..........',
      '..........#..#..........',
      '..oooooooooooooooooooo..',
      '..o.......#..#.......o..',
      '.o.........##.........o.',
      'o.........#..#.........o',
      '....oooooooooooooooo....',
      '....o....#....#....o....',
      '...o.....##..##.....o...',
      'ooo.....#..##..#.....ooo',
      '........#..##..#........',
      '.......#..#..#..#.......',
      '.......#.#....#.#.......',
      '......#.#......#.#......',
      '......##........##......',
    ] },
    // data centers : trois baies vues de face, l'activité balaie les serveurs
    datacenter: { src: [[0, 8]], grid: [
      '........................',
      '#######.#######.#######.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#~~~~##.#~~~~##.#~~~~##.',
      '#.....#.#.....#.#.....#.',
      '#.....#.#.....#.#.....#.',
      '#######.#######.#######.',
      '.#...#...#...#...#...#..',
    ] },
    // semi-conducteurs : wafer et ses puces, qui s'allument en anneaux depuis le centre
    semiconductor: { src: [[11, 7]], grid: [
      '.........######.........',
      '.......##..~~..##.......',
      '......##...~~...##......',
      '.....##..........##.....',
      '.....#..~~.~~.~~..#.....',
      '....#...~~.~~.~~...#....',
      '....#..............#....',
      '....#~~.~~.~~.~~.~~#....',
      '....#~~.~~.~~.~~.~~#....',
      '....#..............#....',
      '....#...~~.~~.~~...#....',
      '.....#..~~.~~.~~..#.....',
      '.....##..........##.....',
      '......##...~~...##......',
      '.......##..~~..##.......',
      '.........######.........',
    ] },

    /* --- page Factory built : cartes « The Factory-Built advantage » --- */
    // délais maîtrisés : chronomètre, le cadran se remplit dans le sens horaire depuis midi
    leadtime: { src: [[12, 4], [13, 4]], grid: [
      '........................',
      '..........####..........',
      '...........##....##.....',
      '...........##....##.....',
      '.........###ooo.#.......',
      '........#..++..o........',
      '.......o........o.......',
      '......o.......#..o......',
      '......o......#...o......',
      '......o+...##...+o......',
      '......o+...##...+o......',
      '......o..........o......',
      '......o..........o......',
      '.......o........o.......',
      '........o..++..o........',
      '.........oooooo.........',
    ] },
    // qualité contrôlée en usine : bouclier parcouru depuis le haut, coche tracée de gauche à droite
    quality: { src: [[7, 7], [11, 1], [12, 1]], grid: [
      '........................',
      '.....oooooooooooooo.....',
      '....o..............o....',
      '....o..............o....',
      '....o..............o....',
      '....o...........oo.o....',
      '....o..........oo..o....',
      '....o..oo.....oo...o....',
      '....o...oo...oo....o....',
      '.....o...oo.oo....o.....',
      '.....o....ooo.....o.....',
      '......o....o.....o......',
      '.......o........o.......',
      '........o......o........',
      '.........oo..oo.........',
      '...........oo...........',
    ] },
    // moins de travaux sur site : grue à tour, le levage passe par la flèche et le câble jusqu'au module
    onsite: { src: [[5, 2]], grid: [
      '...#....................',
      '..#.#...................',
      '#####ooooooooooo#######.',
      '++#.#..........o........',
      '++###..........o........',
      '..#.#.........ooo.......',
      '..###........o...o......',
      '..#.#......oo.....oo....',
      '..###.....ooooooooooo...',
      '..#.#.....o~~~~~~~~~o...',
      '..###.....o~~~~~~~~~o...',
      '..#.#.....o~~~~~~~~~o...',
      '..###.....ooooooooooo...',
      '..#.#...................',
      '..###.....##.......##...',
      '########################',
    ] },
    // industrialisation : le même module répété en piles croissantes, allumées de proche en proche
    scale: { src: [[0, 13]], grid: [
      '..................ooooo.',
      '..................o~~~o.',
      '..................ooooo.',
      '........................',
      '............ooooo.ooooo.',
      '............o~~~o.o~~~o.',
      '............ooooo.ooooo.',
      '........................',
      '......ooooo.ooooo.ooooo.',
      '......o~~~o.o~~~o.o~~~o.',
      '......ooooo.ooooo.ooooo.',
      '........................',
      'ooooo.ooooo.ooooo.ooooo.',
      'o~~~o.o~~~o.o~~~o.o~~~o.',
      'ooooo.ooooo.ooooo.ooooo.',
      '########################',
    ] },

    /* --- page Factory built : cartes « Our process » --- */
    // concevoir tôt : module en perspective et sa cote, les arêtes se tracent comme sur un plan
    engineer: { src: [[3, 8]], grid: [
      '........................',
      '...........oo...........',
      '.........oo..oo.........',
      '.......oo......oo.......',
      '.....oo..........oo.....',
      '++.oo..............oo...',
      '+..o.oo..........oo.o...',
      '+..o...oo......oo...o...',
      '+..o.....oo..oo.....o...',
      '+..o.......oo.......o...',
      '+..o.......oo.......o...',
      '++.oo......oo......oo...',
      '.....oo....oo....oo.....',
      '.......oo..oo..oo.......',
      '.........oooooo.........',
      '...........oo...........',
    ] },
    // approvisionnement : trois fournisseurs convergent vers l'entrepôt
    procure: { src: [[0, 2], [0, 7], [0, 12]], grid: [
      '..................#.....',
      'ooooo...........##.##...',
      'o~~~ooo.......##.....##.',
      'ooooo..o.....#.........#',
      '........o....#.........#',
      '.........o...#.o.......#',
      'ooooo.....o..#..o......#',
      'o~~~oooooooooooooo.....#',
      'ooooo.....o..#..o......#',
      '.........o...#.o.......#',
      '........o....#.........#',
      'ooooo..o.....#..#####..#',
      'o~~~ooo......#..#~~~#..#',
      'ooooo........#..#...#..#',
      '.............#..#~~~#..#',
      '............############',
    ] },
    // fabriquer et valider : usine à sheds, le convoyeur sort les modules vers la coche de validation
    manufacture: { src: [[0, 12]], grid: [
      '........................',
      '........................',
      '....#....#....#.........',
      '...##...##...##.........',
      '..#.#..#.#..#.#.........',
      '.#..#.#..#.#..#.........',
      '###############...oooo..',
      '#.............#..o....o.',
      '#.............#.o......o',
      '#.............#.o....o.o',
      '#..~~....~~...#.o.o.o..o',
      '#..~~....~~...#.o..o...o',
      'oooooooooooooooo.o....o.',
      '#.+..+..+..+..#...oooo..',
      '#.............#.........',
      '###############.........',
    ] },
    // livrer et intégrer : camion chargé d'un module, lignes de vitesse et route qui filent vers l'arrière
    deliver: { src: [[2, 4], [2, 6], [2, 8], [23, 15]], grid: [
      '........................',
      '........................',
      '........................',
      '....###########.........',
      '~~~.#+++++++++#.####....',
      '....#+++++++++#.#+++#...',
      '~~~.#+++++++++#.#++++#..',
      '....#+++++++++#.#.....#.',
      '~~~.#+++++++++#.#.....#.',
      '....###########.#.....#.',
      '..#####################.',
      '.....###..###.....###...',
      '.....#.#..#.#.....#.#...',
      '.....###..###.....###...',
      '........................',
      '~~~~~~~~~~~~~~~~~~~~~~~~',
    ] },

    /* --- page Factory built : vignettes « One integrated chain » et calques du visuel des Steps (20 × 25, fond sombre),
       dans l'ordre des étapes ; même dessin sur la vignette et sur le calque de la même étape --- */
    // conception en amont : clé à molette (mors fixe à bec, mors mobile, molette crantée), le flux remonte le manche jusqu'aux mors
    'step-engineering': { src: [[9, 23], [10, 23], [11, 23]], grid: [
      '....................',
      '..ooooooo...........',
      '..o++++oo...........',
      '..o++++o...oooooo...',
      '..o++++o...o++++o...',
      '..o++++o...o++++o...',
      '..o++++ooooo++++o...',
      '..o+++++++oooooooo..',
      '..o+++++++o~.~.~.o..',
      '..o+++++++o~.~.~.o..',
      '...o++++++oooooooo..',
      '....o+++++++++++o...',
      '.....o+++++++++o....',
      '......o+++++++o.....',
      '.......o+++++o......',
      '.......o+++++o......',
      '.......o+++++o......',
      '.......o+++++o......',
      '.......o+++++o......',
      '.......o+++++o......',
      '.......o++.++o......',
      '.......o+...+o......',
      '.......o++.++o......',
      '........ooooo.......',
      '....................',
    ] },
    // anticipation des achats : calendrier, les jours défilent jusqu'à la date réservée (en blanc)
    'step-procurement': { src: [[4, 10]], grid: [
      '....................',
      '....................',
      '......#......#......',
      '......#......#......',
      '..################..',
      '..#+++#++++++#+++#..',
      '..#++++++++++++++#..',
      '..#++++++++++++++#..',
      '..#..............#..',
      '..#..............#..',
      '..#.~~.~~.~~.~~..#..',
      '..#.~~.~~.~~.~~..#..',
      '..#..............#..',
      '..#.~~.~~.~~.~~..#..',
      '..#.~~.~~.~~.~~..#..',
      '..#..............#..',
      '..#.~~.~~.~~.~~..#..',
      '..#.~~.~~.~~.~~..#..',
      '..#..............#..',
      '..#.~~.~~.~~.oo..#..',
      '..#.~~.~~.~~.oo..#..',
      '..#..............#..',
      '..################..',
      '....................',
      '....................',
    ] },
    // fabrication hors site : bras robotisé, de l'épaule à la pince, qui assemble un module sur l'établi
    'step-manufacturing': { src: [[5, 16], [5, 17]], grid: [
      '....................',
      '....................',
      '....................',
      '........ooo.........',
      '.......oo.oo........',
      '.......o.o.o........',
      '.......oo.oooo......',
      '........ooo.ooo.....',
      '.......ooo...ooo....',
      '......ooo.....ooo...',
      '......ooo.....ooo...',
      '.....ooo.......o....',
      '.....ooo.......o....',
      '....oooo.....oo.oo..',
      '....ooo.......o.o...',
      '....ooo....~.......~',
      '...o.o.o....~.....~.',
      '...o.o.o............',
      '....ooo....#########',
      '...#####...#+++++++#',
      '...#####...#+++++++#',
      '...#####...#########',
      '.#########.#......#.',
      '.###################',
      '....................',
    ] },
    // essais en usine : manomètre sur la conduite, le fluide passe et la pression monte sur le cadran
    'step-testing': { src: [[0, 19], [0, 20]], grid: [
      '....................',
      '....................',
      '.......######.......',
      '.....##......##.....',
      '....##.~..~.~.##....',
      '....#........#.#....',
      '...#..~.....#~..#...',
      '...#.......#....#...',
      '...#.~...##...~.#...',
      '...#.....##.....#...',
      '...#.~........~.#...',
      '...#..~......~..#...',
      '....#..........#....',
      '....##........##....',
      '.....##......##.....',
      '.......##~~##.......',
      '...#....#~~#....#...',
      '#########~~#########',
      '~~~#~~~~~~~~~~~~#~~~',
      '~~~#~~~~~~~~~~~~#~~~',
      '~~~#~~~~~~~~~~~~#~~~',
      '~~~#~~~~~~~~~~~~#~~~',
      '####################',
      '...#............#...',
      '....................',
    ] },
    // intégration sur site : le module se raccorde au réseau du site par deux conduites à brides boulonnées
    'step-integration': { src: [[5, 8], [6, 8], [13, 8], [14, 8]], grid: [
      '....................',
      '.##################.',
      '.#................#.',
      '.#.+.+.+.+.+.+.+..#.',
      '.#.+.+.+.+.+.+.+..#.',
      '.#.+.+.+.+.+.+.+..#.',
      '.#.+.+.+.+.+.+.+..#.',
      '.#................#.',
      '.####~~######~~####.',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '...##~~##..##~~##...',
      '...+#~~#+..+#~~#+...',
      '...##~~##..##~~##...',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      '....#~~#....#~~#....',
      'ooooo~~oooooo~~ooooo',
      '..+..+..+..+..+..+..',
      '.+..+..+..+..+..+..+',
      '+..+..+..+..+..+..+.',
    ] },
    // mise en service : liste de contrôle, cochée ligne après ligne
    'step-commissioning': { src: [[4, 8]], grid: [
      '....................',
      '.......######.......',
      '.......##..##.......',
      '..################..',
      '..#....######....#..',
      '..#..............#..',
      '..#..............#..',
      '..#....o..++++...#..',
      '..#.o.o...++++++.#..',
      '..#..o...........#..',
      '..#..............#..',
      '..#....o.........#..',
      '..#.o.o...++++++.#..',
      '..#..o...........#..',
      '..#..............#..',
      '..#....o..++++...#..',
      '..#.o.o...++++++.#..',
      '..#..o...........#..',
      '..#..............#..',
      '..#....o.........#..',
      '..#.o.o...++++++.#..',
      '..#..o...........#..',
      '..#..............#..',
      '..################..',
      '....................',
    ] },

    /* --- page Factory built : pages du panneau « Industrial scale » --- */
    // processus standardisés, adaptables : le même modèle se décline en trois formats, le flux part du modèle
    'fb-standard': { src: [[8, 7]], grid: [
      '........................',
      '................ooo.....',
      '...........oooooo+o.....',
      '...........o....ooo.....',
      '.#######...o............',
      '.#.....#...o....ooooo...',
      '.#.+++.#...o....o+++o...',
      '.#.....#ooooooooo+++o...',
      '.#.+++.#...o....o+++o...',
      '.#.....#...o....ooooo...',
      '.#######...o............',
      '...........o....ooooooo.',
      '...........o....o+++++o.',
      '...........oooooo+++++o.',
      '................o+++++o.',
      '................ooooooo.',
    ] },
    // fabrication répétable sur plusieurs sites : trois usines identiques, chacune sous son repère,
    // allumées l'une après l'autre le long de la route
    'fb-repeat': { src: [[0, 14]], grid: [
      '........................',
      '..oooo....oooo....oooo..',
      '.o+..+o..o+..+o..o+..+o.',
      '.o+..+o..o+..+o..o+..+o.',
      '..o++o....o++o....o++o..',
      '...oo......oo......oo...',
      '...o..o....o..o....o..o.',
      '..oo.oo...oo.oo...oo.oo.',
      '.oooooo..oooooo..oooooo.',
      '.o....o..o....o..o....o.',
      '.o....o..o....o..o....o.',
      '.o.++.o..o.++.o..o.++.o.',
      '.o.++.o..o.++.o..o.++.o.',
      '.o.++.o..o.++.o..o.++.o.',
      'oooooooooooooooooooooooo',
      '........................',
    ] },
    // livraison coordonnée à l'échelle européenne : depuis le centre, l'onde gagne l'anneau des douze étoiles
    'fb-europe': { src: [[11, 7], [12, 8]], grid: [
      '...........oo...........',
      '.......oo..oo..oo.......',
      '.......oo......oo.......',
      '........................',
      '.....oo...~~~~...oo.....',
      '.....oo..~....~..oo.....',
      '........~......~........',
      '....oo..~..oo..~..oo....',
      '....oo..~..oo..~..oo....',
      '........~......~........',
      '.....oo..~....~..oo.....',
      '.....oo...~~~~...oo.....',
      '........................',
      '.......oo......oo.......',
      '.......oo..oo..oo.......',
      '...........oo...........',
    ] },
  };
  const KINDS = '.#+o~';   // index = genre du point ; >= 3 : parcouru par le flux

  // couleur hexadécimale d'un jeton CSS lu sur un élément : le 1er nom défini l'emporte
  const color = (style, names, fallback) => {
    const value = names.map((name) => style.getPropertyValue(name).trim()).find(Boolean) || fallback;
    const hex = value.replace('#', '');
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const doc = getComputedStyle(document.documentElement);
  const GRADIENT = [color(doc, ['--gt-c1'], '#d6b3ff'), color(doc, ['--gt-c2'], '#ffb592'), color(doc, ['--gt-c3'], '#fabb15'), color(doc, ['--gt-c4'], '#5fe219')];
  // rampe flux → couleur : couleur de repos, puis le dégradé habituel (lilas dominant, comme Gradient text)
  const palette = (rest) => {
    const ramp = [[0, rest], [0.2, GRADIENT[0]], [0.7, GRADIENT[1]], [0.86, GRADIENT[2]], [1, GRADIENT[3]]];
    return Array.from({ length: BUCKETS }, (_, b) => {
      const t = b / (BUCKETS - 1);
      let k = 1;
      while (k < ramp.length - 1 && t > ramp[k][0]) k++;
      const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k];
      const u = (t - t0) / (t1 - t0);
      return `rgb(${c0.map((v, i) => Math.round(v + (c1[i] - v) * u)).join(',')})`;
    });
  };

  const outBack = (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  const hash = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  // impulsion au point situé à `front` points derrière le front de flux : tête vive, traînée qui s'éteint
  const pulse = (front) => {
    if (front < 0) return 0;
    const ph = (front / WAVE) % 1;
    return ph < TAIL ? (1 - ph / TAIL) ** 2 : 0;
  };

  // scale < 1 : dessin réduit au centre d'une matrice plus fine, bordée de points éteints
  function prepare(art, scale) {
    const mx = Math.round(art.grid[0].length * (1 / scale - 1) / 2), my = Math.round(art.grid.length * (1 / scale - 1) / 2);
    const cols = art.grid[0].length + 2 * mx, rows = art.grid.length + 2 * my, n = cols * rows;
    const kind = new Uint8Array(n), dist = new Float32Array(n).fill(-1), delay = new Float32Array(n);
    art.grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) kind[(y + my) * cols + x + mx] = Math.max(0, KINDS.indexOf(row[x])); });
    const src = art.src.map(([x, y]) => [x + mx, y + my]);
    // distance le long du tracé : parcours en largeur des points flux (8 voisins) depuis les sources
    const queue = src.map(([x, y]) => y * cols + x);
    queue.forEach((i) => { dist[i] = 0; });
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % cols, y = (i - x) / cols;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * cols + nx;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || kind[j] < 3 || dist[j] >= 0) continue;
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
    for (let i = 0; i < n; i++) {
      const x = i % cols, y = (i - x) / cols;
      // point flux sans chemin jusqu'à une source : distance à vol d'oiseau
      if (kind[i] >= 3 && dist[i] < 0) dist[i] = Math.min(...src.map(([sx, sy]) => Math.hypot(x - sx, y - sy)));
      delay[i] = ((rows - 1 - y) / (rows - 1)) * RISE + hash(i) * JITTER;
    }
    return { cols, rows, kind, dist, delay };
  }

  function init(root) {
    const art = ARTS[root.dataset.serviceDots];
    if (!art) return;
    // réglages du conteneur : taille du dessin (--dots-scale, 1 par défaut),
    // couleurs de repos (--dots-ink / --dots-muted sur fond sombre, sinon celles du texte)
    const style = getComputedStyle(root);
    const { cols, rows, kind, dist, delay } = prepare(art, parseFloat(style.getPropertyValue('--dots-scale')) || 1);
    const ink = color(style, ['--dots-ink', '--ink'], '#1c1b19');
    const PAL_INK = palette(ink), PAL_MUTED = palette(color(style, ['--dots-muted', '--ink-2'], '#5f5e5e'));
    const BG = `rgba(${ink.join(',')},0.08)`;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const card = root.closest('.gcard, .xcard, .fbpage') || root;
    const revealEl = root.closest('[data-reveal]');

    let W = 0, H = 0, dpr = 1;
    function resize() {
      // offset* : taille de mise en page, sans la rotation de la carte pendant son apparition
      W = root.offsetWidth; H = root.offsetHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw(performance.now());
    }

    let shown = reduce ? -Infinity : null;   // instant de départ de l'apparition (null : pas encore)
    let hover = false, introFrom = 0, introUntil = 0, level = 0, flowT = 0;

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (shown === null) return;
      const t = (now - shown) / 1000;
      const step = Math.min(W / cols, H / rows), r0 = step * DOT;
      const ox = (W - cols * step) / 2, oy = (H - rows * step) / 2;   // matrice centrée (proportions arrondies)
      for (let i = 0; i < kind.length; i++) {
        const p = Math.min(1, (t - delay[i]) / POP);
        if (p <= 0) continue;
        const k = kind[i], x = i % cols, y = (i - x) / cols;
        let r = r0 * outBack(p);
        if (k === 0) {
          r *= 0.75;
          ctx.fillStyle = BG;
        } else {
          const heat = k >= 3 && level > 0 ? level * pulse(flowT * SPEED - dist[i]) : 0;
          ctx.fillStyle = (k === 1 || k === 3 ? PAL_INK : PAL_MUTED)[Math.round(heat * (BUCKETS - 1))];
          r *= 1 + GROW * heat;
        }
        ctx.beginPath();
        ctx.arc(ox + (x + 0.5) * step, oy + (y + 0.5) * step, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let raf = 0, last = 0;
    function frame(now) {
      const dt = last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      const on = hover || (now > introFrom && now < introUntil);
      level += ((on ? 1 : 0) - level) * (1 - Math.exp(-dt / FADE));
      // flux éteint : le prochain repartira des sources
      if (!on && level < 0.002) { level = 0; flowT = 0; } else flowT += dt;
      draw(now);
      const revealing = shown !== null && now < shown + REVEAL_END * 1000;
      raf = revealing || on || level > 0 || now < introUntil ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    function reveal() {
      shown = performance.now() + START * 1000;
      introFrom = shown + REVEAL_END * 800;
      introUntil = introFrom + INTRO_FLOW * 1000;
      start();
    }

    if (!reduce) {
      if (!revealEl || revealEl.classList.contains('is-in')) reveal();
      else {
        const mo = new MutationObserver(() => {
          if (!revealEl.classList.contains('is-in')) return;
          mo.disconnect();
          reveal();
        });
        mo.observe(revealEl, { attributes: true, attributeFilter: ['class'] });
      }
      card.addEventListener('pointerenter', () => { hover = true; start(); });
      card.addEventListener('pointerleave', () => { hover = false; });
      // un passage du flux à la demande (pas avant l'apparition, ni pendant un passage en cours)
      root.addEventListener('service-dots:play', () => {
        const now = performance.now();
        if (shown === null || now < introUntil) return;
        introFrom = now;
        introUntil = now + INTRO_FLOW * 1000;
        start();
      });
    }

    new ResizeObserver(resize).observe(root);
  }

  document.querySelectorAll('[data-service-dots]').forEach(init);
})();
