// ⚙️ RÉGLAGES DU JEU
// C'est ici que tu peux mettre le jeu "à ta sauce" : change les chiffres,
// recharge la page, et observe ce qui se passe !

const CONFIG = {
  // --- Carte ---
  // Tailles des cartes aléatoires (en cases), au format 16:9, choisies dans le menu
  // (les cartes prédéfinies, Monde et Europe, ont leur propre taille, plus bas)
  MAP_SIZES: {
    petit: [300, 169],
    moyen: [650, 366],
    grand: [1000, 562],
  },
  CELLS_PER_OPPONENT: 5000, // au plus un royaume rival pour 5000 cases de carte (petite carte : 10 rivaux au plus)
  // Relief et forêts des cartes aléatoires (un décor de Moyen Âge : beaucoup de forêts, moins de montagnes) :
  // plus le seuil est haut, plus le terrain est rare (forêt : plus il est bas, plus il y a de forêts)
  MOUNTAIN_LEVEL: 0.77,
  HILLS_LEVEL: 0.62,
  FOREST_LEVEL: 0.44,
  DESERT_RATIO: 0.15,      // part des plaines et forêts en désert sur les cartes aléatoires (production -20 %)
  WORLD_MAP_WIDTH: 1080,   // taille de la carte « Monde » (bien plus grande : on dézoome beaucoup)
  WORLD_MAP_HEIGHT: 408,
  EUROPE_MAP_WIDTH: 1000,  // taille de la carte « Europe »
  EUROPE_MAP_HEIGHT: 1000,
  AZEROTH_MAP_WIDTH: 700,  // taille de la carte « Azeroth » (700 x 550)
  AZEROTH_MAP_HEIGHT: 550,
  CHARLEMAGNE_MAP_WIDTH: 780, // taille de la carte du scénario « Charlemagne » (l'Europe de l'Ouest et la Méditerranée)
  CHARLEMAGNE_MAP_HEIGHT: 620,
  MIN_OPPONENTS: 3,
  // Royaume coupé en deux sur un même continent : son plus grand morceau est son cœur. Un autre morceau tenu par
  // une ville (ou un port fortifié) et assez grand (au moins 25 % du plus grand) est aussi un cœur, à part entière :
  // ses armées en partent, ses défenseurs y vont. Plus petit, il reste isolé (ses villes tiennent seules).
  SPLIT_HEART_SHARE: 0.25,
  CAMERA_KEY_SPEED: 900,   // déplacement de la caméra au clavier (ZQSD / flèches), en pixels d'écran par seconde
  // Courbes de niveau (pied des collines, des montagnes, et bord des sommets) et bordures des terrains : le zoom
  // à partir duquel on les voit (elles suivent le bord des cases : voir buildForests dans render.js)
  CONTOUR_MIN_ZOOM: 2,
  // Vue de très loin : en dézoomant presque au maximum, la carte devient une carte parchemin. Elle commence à apparaître
  // en dessous de 85 % du zoom « toute la carte », elle est complète à 60 % ; on peut dézoomer jusqu'à 45 %
  PARCHMENT_ZOOM: [0.85, 0.6, 0.45],
  PLACE_NAME_ZOOM: 1.4,      // 🏷️ les noms des villes historiques s'écrivent à partir de ce zoom (× le zoom de la carte entière)
  // Décor autour de la carte (une vieille carte marine) : on le voit en dézoomant ; la vue ne va jamais plus loin
  DECOR_IMAGE: 'img/decor_mer.webp',
  DECOR_SIZE: 2.6,           // largeur du décor, en largeurs de carte (la carte est au milieu)
  // Le cadre brodé autour de la carte (une tapisserie médiévale, posée par-dessus le décor marin) :
  FRAME_IMAGE: 'img/cadre.webp',
  FRAME_INNER: [165, 232, 1507, 716], // le rectangle de toile au milieu de l'image, où se pose la carte (en pixels)
  FRAME_SPLIT: [600, 440],   // où rallonger le cadre si la carte n'a pas la même forme (x pour l'élargir, y pour l'allonger)
  FRAME_BAND: 90,            // (les rubans des bords sont recopiés en miroir, par bandes de 90 pixels au plus...)
  // ...et l'intérieur des panneaux illustrés, dans la partie rallongée, est rempli de nuages brodés :
  // [début, fin] des panneaux de gauche et de droite (en x), du haut et du bas (en y), en pixels de l'image
  FRAME_PANELS: { left: [22, 125], right: [1547, 1650], top: [15, 215], bottom: [733, 917] },
  SMOOTH_MAP: 1,             // bords entre terrains : 0 = carrés en escalier, 1 = coins coupés en biais (adouci), 2 = arrondis
  SMOOTH_FINE_MAX_TILES: 600000, // jusqu'à cette taille de carte (en cases), dessin plus fin (4 x 4 pixels par case)
  RAGGED_EDGES: 0,           // bords « effilochés » : part des demi-cases prises par le terrain voisin (0 = aucune ; plus = plus de grain)
  TERRAIN_BORDERS: true,     // fine ligne discrète entre deux terrains différents (false pour l'enlever)
  TERRAIN_BORDER_ALPHA: 0.32, // ...et sa force (0 = invisible, 1 = noire)
  MAP_SHADE_SOFT: 1,         // petites variations de couleur du sol, adoucies entre voisines (0 = sol tout uni)...
  MAP_SHADE_RAW: 0.8,        // ...et le grain propre à chaque case (plus = damier plus visible)
  HILLSHADE: 0.5,            // ombrage du relief (soleil en haut à gauche) : 0 = pas d'ombre, plus = relief plus marqué
  WATER_DEPTH_SHADE: 0.3,    // la mer fonce au large (0 = mer d'une seule couleur)
  WATER_NOISE: 0.1,          // grandes nuances claires et foncées dans la mer (comme des fonds marins)
  TERRAIN_GRAIN: 0.6,        // douces ondulations des terres basses (plaine, forêt, désert) ; en montagne, des crêtes et des pics
  MOUNTAIN_ROUGHNESS: 0.3,   // arêtes des massifs un peu tordues (0 = versants tout droits, comme des pyramides)
  MOUNTAIN_TONE_STEP: 0.1,   // écart entre les tons des versants (plus grand = moins de tons, plus tranchés ; 0 = dégradé)
  HILL_BUMPS: 1.5,          // bosses des collines (plus douces que les montagnes) : 0 = collines lisses
  EDGE_SHADE: 0.09,          // ombres qui suivent les formes de la carte (bord éclairé d'un relief, ombre à son pied)
  // Forêts, plaines, déserts et relief : une fine bordure autour d'eux (dès CONTOUR_MIN_ZOOM) ;
  // et dans les forêts, de petits sapins transparents en zoomant
  FOREST_TREE_ZOOM: 4,
  FOREST_TREE_SPACING: 3,  // un sapin toutes les 3 cases environ
  WATER_RATIO: 0.50,       // part de mer sur la carte (0.5 = 50 %) ; la carte « Base navale » en a plus
  NAVAL_WATER_RATIO: 0.62, // part de mer de la carte « Base navale » (plusieurs grandes îles)
  ISLANDS: [4, 6],         // nombre de grandes îles de la carte « Base navale » (entre ces deux valeurs)
  // Les nombres d'îlots, de fleuves et de lacs ci-dessous sont pour une carte de 500 x 281 cases ; les autres en ont
  // plus ou moins (multipliés par la racine carrée du rapport de surface : x0,6 « Petite », x1,3 « Moyenne », x2 « Grande »)
  ISLETS: [0, 2],          // nombre d'îlots volcaniques ajoutés à la carte « Normale » (un sommet au milieu)
  BIG_ISLANDS: [1, 3],     // vraies îles moyennes de la carte « Normale », assez grandes pour y fonder une capitale
  BIG_ISLAND_RADIUS: [15, 21], // (leur rayon, en cases, sur une carte moyenne)
  COVES: [5, 9],           // criques et baies creusées dans la côte du continent
  GULF_CHANCE: 0.6,        // chance d'avoir un (parfois deux) grand golfe qui coupe presque le continent en deux
  MIN_ISLAND: 250,         // une terre de moins de 250 cases est retirée (plus de petits îlots inutiles)
  MIN_SPAWN_LAND: 600,     // une capitale se fonde sur une terre d'au moins 600 cases (pas sur un îlot)
  RIVERS_MIN: 5,           // nombre de fleuves, tiré au hasard entre ces deux valeurs
  RIVERS_MAX: 18,          // (ils partent des montagnes et vont jusqu'à la mer)
  LAKES_MAX: 4,            // lacs au plus (au milieu d'un fleuve)
  // Chaînes de montagnes : de longues crêtes de sommets infranchissables (de vrais murs, qui rendent la carte plus
  // stratégique), coupées de cols (des montagnes, franchissables) où les armées peuvent passer
  MOUNTAIN_CHAINS: [6, 9],      // nombre de chaînes (entre ces deux valeurs)
  CHAIN_LENGTH: [45, 90],       // longueur d'une chaîne, en cases (un peu plus sur une grande carte)
  CHAIN_PASS_EVERY: [18, 30],   // un col toutes les 18 à 30 cases de crête...
  CHAIN_PASS_WIDTH: [2.5, 4.5], // ...large de 2 à 4 cases (entre deux sommets)
  PEAK_BLOB_RATIO: 0.015,       // en plus des chaînes, 1,5 % des terres en sommets isolés (le cœur des massifs)

  // --- Vitesse ---
  TICKS_PER_SECOND: 10,
  GAME_SPEEDS: [1, 1.5, 2, 3], // vitesses de la partie, au choix en jeu (bouton ⏩ en haut)    // nombre de "tours" de jeu par seconde

  // --- Départ ---
  START_TROOPS: 10,       // soldats au départ (on commence petit !)
  START_GOLD: 10,
  START_RADIUS: 3,         // taille du territoire de départ
  MIN_SPAWN_DISTANCE: 18,  // distance minimale entre deux capitales

  // --- Soldats ---
  BASE_MAX_TROOPS: 20,
  MAX_TROOPS_PER_TILE: 0.12,
  BASE_TROOP_GROWTH: 0.15,     // soldats gagnés par seconde au minimum
  // Soldats/seconde en plus selon la taille du territoire : TROOP_GROWTH_SQRT × racine carrée du nombre de cases.
  // (la racine : un territoire 4 fois plus grand ne recrute que 2 fois plus vite, l'armée ne s'emballe pas)
  // Ex. : 400 cases → +0.32/s · 1600 cases → +0.64/s · 6400 cases → +1.28/s
  TROOP_GROWTH_SQRT: 0.016,
  // Rendement décroissant des casernes, comme les moulins : rendement = 1 / (1 + 0.1 × (casernes - 1))
  BARRACKS_DIMINISHING: 0.1,
  // Élan de départ : au début de la partie, le recrutement va plus vite (x3 au tout début : +200 %), puis ce bonus
  // diminue peu à peu jusqu'à disparaître au bout de EARLY_GROWTH_TIME secondes (la fin de partie ne change pas)
  EARLY_GROWTH_BONUS: 2,
  EARLY_GROWTH_TIME: 300,
  // Les terres libres (vierges) se prennent toujours vite, toute la partie (x3), comme au début
  FREE_LAND_SPEED_BONUS: 3,
  FREE_LAND_BOOST: 1.3,      // et l'expansion en terre libre va encore 30 % plus vite : plus rapide, et moins de soldats par case
  // Le recrutement dépend du remplissage de l'armée : il monte jusqu'à TROOP_PEAK_RATIO
  // du maximum, puis baisse jusqu'à 0 quand on s'approche du maximum.
  TROOP_PEAK_RATIO: 0.4,       // remplissage idéal (40 % du maximum)
  TROOP_GROWTH_AT_ZERO: 0.7,   // vitesse de recrutement quand l'armée est vide (x0.7)
  TROOP_GROWTH_AT_PEAK: 1.3,   // vitesse au remplissage idéal (x1.3)

  // --- Or ---
  BASE_GOLD: 0.06,         // or par seconde au minimum (revenu de base, selon le territoire)
  GOLD_PER_TILE: 0.0002,
  // Rendement décroissant : plus un royaume a de moulins et de ports, moins chacun rapporte
  // (rendement = 1 / (1 + 0.1 × (nombre - 1)) : 1 → 100 %, 3 → 83 %, 6 → 67 %, 12 → 48 %).
  // Le début de partie ne change pas, mais l'économie ne s'emballe plus.
  GOLD_DIMINISHING: 0.1,
  // Solde des troupes : garder trop de soldats coûte de l'or. Au-delà de UPKEEP_FROM de l'armée maximum
  // (50 %), tout l'or gagné baisse peu à peu, jusqu'à -UPKEEP_MAX (-25 %) avec une armée pleine.
  // (les garnisons ne comptent pas : seulement les soldats disponibles)
  UPKEEP_FROM: 0.5,
  UPKEEP_MAX: 0.25,
  PRODUCTION_INTERVAL: 10,   // moulins et casernes produisent toutes les 10 secondes
  BUILDING_COST_GROWTH: 1.5, // chaque bâtiment du même type construit soi-même rend le suivant x1.5 plus cher
                             // (ceux pris à l'ennemi ne comptent pas)
  BUILDING_DRAW_SCALE: 1.5, // taille des bâtiments dessinés sur la carte (icônes et images) : 1.5 = 50 % plus grands
  ICON_LEVEL_GROWTH: 0.18,  // de loin, l'icône d'un bâtiment grandit de 18 % par niveau (une cathédrale se voit mieux qu'une église)
  RARE_COST_GROWTH: 2,       // ...et x2 pour les églises et les ports (une hausse 2 fois plus forte : +100 % au lieu de +50 %)
  MILL_COST_GROWTH: 1.35,    // ...et seulement x1.35 pour les moulins et les casernes (on en bâtit beaucoup : leur prix monte moins vite)
  BUILD_TIME: 3,             // secondes de chantier pour construire un bâtiment (il ne produit rien avant)
  UPGRADE_TIME: [40, 60, 90], // améliorer un bâtiment : 40 s pour passer au niveau 2, 60 s au niveau 3, 90 s au niveau 4
  // Murs : une ville de niveau 2 peut bâtir 1 mur, une citadelle (niveau 3) un 2e. Un mur va de la muraille de la
  // ville jusqu'à l'endroit choisi, au plus WALL_MAX_REACH cases plus loin. Aucun assaut ne peut le franchir.
  WALL_COSTS: [500, 1000, 2000], // prix du 1er mur, du 2e (citadelle), puis du 3e (cité impériale)
  WALL_BUILD_TIME: 40,       // secondes de chantier
  WALL_MAX_REACH: 12,
  WALL_RETREAT_LOSS: 0.5,    // une armée en retraite qui doit franchir un mur (bâti dans son dos) y perd 50 % de ses soldats, par mur
  WALL_LINK_GARRISON: 50,    // deux de ses villes reliées par un mur : +50 soldats de garnison pour chacune
  WALL_SNAP: 3,              // visé à moins de 3 cases d'un obstacle (lac, sommet, fleuve, autre mur) : le mur s'y accroche
  DEMOLISH_TIME: 10,         // secondes de travaux pour détruire un de ses bâtiments
  PORT_ROAD_DISTANCE: 30,    // un port à moins de 30 cases d'un de ses châteaux (sur la même terre) y est relié
  MINE_ROAD_DISTANCE: 30,    // une mine à moins de 30 cases d'une de ses villes (sur la même terre) y est reliée par une route
  MINE_ROAD_FACTOR: 2,       // ... et rapporte 2 fois plus (voir MINES)
  MINE_SPACING: 14,          // deux filons sont à au moins 14 cases l'un de l'autre
  DEPOSIT_CLEARANCE: 2,      // les autres bâtiments laissent 2 cases libres autour d'un filon (la place de sa mine)
  PORT_ROAD_BONUS: 0.3,      // par un chemin de terre : +30 % d'or produit par le port
  PORT_MILL_BONUS: 0.15,     // chaque moulin relié par une route à la même ville que le port : +15 % d'or pour le port
  PORT_MILL_MAX: 6,          // (6 moulins au plus comptent : +90 % au maximum)
  // Une église pas trop loin d'une de ces routes port–ville (à moins de 10 cases) y est reliée par un petit chemin ;
  // sinon, une église pas trop loin d'une ville (à moins de 25 cases, sur la même terre) est reliée à elle.
  // Reliée, elle produit 2 pièces d'or toutes les PRODUCTION_INTERVAL secondes. (Un port seul, sans ville, ne suffit pas.)
  // Une ville améliorée relie plus loin : +20 % de portée par niveau au-dessus du 1er (routes de port et chemins
  // d'église vers elle) : niveau 1 = 30 et 25 cases, niveau 2 = 36 et 30, niveau 3 = 42 et 35
  ROAD_RANGE_PER_LEVEL: 0.2,
  ROAD_MAX_CITIES: 3,        // un moulin, une caserne ou un port relié à plusieurs villes : une route par ville (3 au plus), les bonus s'additionnent
  CHURCH_ROAD_DISTANCE: 10,
  CHURCH_CITY_DISTANCE: 25,
  CHURCH_ROAD_GOLD: 2,
  // Un moulin ou une caserne bâti hors des villes, sur une route (route d'un port ou chemin d'une église) ou juste à
  // côté (à moins de 3 cases de son centre) : +20 % de production
  MILL_ROAD_DISTANCE: 3,
  MILL_ROAD_BONUS: 0.2,
  // ✝️ Croyance : chaque église en apporte (voir faith dans CHURCH_LEVELS), +50 % si elle est reliée à une route.
  // Un royaume qui a plus de Croyance qu'un voisin ennemi convertit peu à peu ses terres frontalières.
  FAITH_ROAD_BONUS: 0.5,
  FAITH_LURE: 6,             // la Croyance avance en courbes vers les églises et les ports voisins (comme la foi
  FAITH_LURE_RANGE: 30,      //   qui gagne les villages) : attirée par ceux à moins de 30 cases...
  FAITH_WAVE: 2,             // ...et son front ondule un peu (au lieu d'avancer en ligne droite)
  FAITH_DISORGANIZED: 2,     // un royaume désorganisé (sans ville ni port fortifié) se fait convertir 2 fois plus vite
  // Croisade religieuse : une cathédrale (église de niveau 3) peut en lancer une pour 2500 pièces :
  // +1000 de Croyance pour le royaume pendant 60 s (une croisade à la fois par cathédrale)
  CRUSADE_COST: 2500,
  // ⚔️ Recrutement de masse : une grande caserne (niveau 3) peut le lancer pour 3000 pièces : pendant 60 s, le royaume
  // recrute bien plus vite (un à la fois par royaume). Plus l'armée est petite, plus c'est fort : jusqu'à
  // x(1 + LEVY_BOOST) quand l'armée est vide, encore x2,6 environ à LEVY_FROM (35 %) de l'armée maximum ; puis ça décroît
  // vite, jusqu'à rien à LEVY_TO (65 %) : à plus de la moitié de l'armée maximum, il ne sert presque plus à rien.
  LEVY_COST: 3000,
  LEVY_TIME: 60,
  LEVY_BOOST: 2,
  LEVY_FROM: 0.35,
  LEVY_TO: 0.65,
  // ... et il favorise les petits royaumes : son bonus est multiplié selon la taille de l'armée maximum du royaume,
  // comparée à celle du plus grand : x LEVY_SMALL pour un tout petit royaume (jusqu'à x5 de recrutement, armée vide),
  // x LEVY_BIG pour le plus grand (au plus x1,6), et entre les deux en proportion
  LEVY_SMALL: 2,
  LEVY_BIG: 0.3,
  // 🔥 Assaut viking (port royal, niveau 3) : on l'achète VIKING_COST pièces, il est alors prêt (un seul à la fois) ;
  // on le lance quand on veut, depuis un port royal, sur une ville (ou un port fortifié) ennemie de l'autre côté de
  // la mer, à VIKING_RANGE cases au plus d'une de ses côtes : les bateaux traversent sans pertes, l'armée débarque et
  // marche droit sur la cible, avec des soldats VIKING_BONUS plus forts (+50 %). C'est un raid : s'il l'emporte, la
  // cible est DÉTRUITE (avec ses moulins et casernes), et chaque bâtiment détruit rapporte VIKING_LOOT pièces.
  // Puis les survivants rentrent par bateau (de même s'il échoue).
  VIKING_COST: 3000,
  VIKING_LOOT: 300,
  VIKING_COOLDOWN: 60,         // secondes entre deux assauts vikings lancés (une fois par minute au plus)
  VIKING_RANGE: 25,
  VIKING_BONUS: 0.5,
  VIKING_MIN_TROOPS: 20,       // soldats à embarquer au moins
  CRUSADE_FAITH: 1000,
  CRUSADE_TIME: 60,
  // Vitesse de la conversion selon l'écart de Croyance : [écart, secondes pour convertir une case].
  // (entre deux lignes, on passe en douceur de l'une à l'autre ; plus petit que 20 : encore plus lent ;
  //  500 d'écart : 2 cases par seconde ; 1000 : 5 par seconde ; au-delà, ça accélère de moins en moins :
  //  2000 : 7 par seconde, 3000 : 8,5, et 5000 et plus : 10 cases par seconde, le maximum)
  FAITH_PACE: [[20, 30], [100, 5], [200, 1], [500, 0.5], [1000, 0.2], [2000, 1 / 7], [3000, 1 / 8.5], [5000, 0.1]],
  FAITH_SPEED: 1.25,         // ...et tout ce tableau va 25 % plus vite (1 = vitesse du tableau, 1.5 = +50 %)
  // ...mais un écart mince par rapport à sa propre Croyance avance moins vite : pleine vitesse (celle du tableau) à
  // partir de 2 fois plus de Croyance que le voisin (0.5 : l'écart fait la moitié de sa Croyance) ; en dessous, la
  // vitesse baisse en douceur (FAITH_DOMINANCE_POWER : plus petit = baisse plus douce) : 1,5 fois plus : 85 % de la
  // vitesse ; 1,2 fois plus : 55 % (1,8 fois moins vite) ; 1,1 fois plus : 40 %
  FAITH_DOMINANCE: 0.5,
  FAITH_DOMINANCE_POWER: 0.55,
  BUILDING_SPACING: 3,       // cases vides obligatoires autour de chaque bâtiment...
  CASTLE_SPACING: 4,         // ...et autour des châteaux
  // Distances minimum (de centre à centre, en cases) entre ses grands bâtiments : cercles rouges à la construction
  CASTLE_CASTLE_DISTANCE: 13, // entre deux de ses châteaux
  CASTLE_CHURCH_DISTANCE: 15, // entre un château et une église ou un port (ils restent hors de sa muraille)
  CHURCH_CHURCH_DISTANCE: 11, // entre deux églises, deux ports, ou une église et un port
  MAX_CASTLES: 3,            // châteaux qu'un royaume peut construire dans la partie (capitale comprise ;
                             // les châteaux pris à l'ennemi ne comptent pas). Une église améliorée en débloque d'autres.

  // --- Combat ---
  ATTACK_SPEED: 0.25,          // vitesse de conquête (plus petit = les armées avancent plus lentement sur la carte)
  MIN_ATTACK_SPEED: 0.25,      // vitesse minimum d'une petite armée (cases de plaine par tour)
  ASSAULT_SPEED: 0.76,        // vitesse d'un assaut contre un royaume (cases de plaine par tour)... divisée par
  ASSAULT_SLOWDOWN: 1000,      // (1 + soldats / 1000) : plus l'armée est grande, plus elle est lente (assauts, marches,
                               // défenseurs) (100 soldats : ~6,9 cases/s · 500 : 5,1 · 1000 : 3,8 · 3000 : 1,9)
  ASSAULT_HEAVY: 500,          // (contre un territoire désorganisé, au contraire, une grosse armée va plus vite : voir plus bas)
  ASSAULT_MIN_SPEED: 0.061,    // vitesse minimum d'un assaut (cases de plaine par tour)
  ASSAULT_TERRAIN_SLOWDOWN: 0.75, // en terrain difficile, un assaut contre un royaume ne ralentit que de 75 % de la normale
                               // (forêt x1,45 au lieu de x1,6 · colline x1,9 au lieu de x2,2 · montagne x2,35 au lieu de x2,8)
  DISORGANIZED_SPEED: 2.03,    // un territoire désorganisé (sans ville ni port fortifié, ou coupé d'eux) se prend plus vite,
                               // et d'autant plus vite que l'armée est grande (100 soldats : ~11 cases/s · 500 : 15 · 2000 : 23)
  // Un assaut contre un royaume part de la cité la plus proche et marche sur ses terres jusqu'à la frontière,
  // par le chemin le plus rapide, comme les défenseurs (voir DEFENDER_SPEED_BONUS) : pendant ce temps,
  // tout le monde le voit venir
  MARCH_SPEED: 6.6,            // (les renforts d'un assaut déjà chez l'ennemi marchent à 6,6 cases par seconde)
  MARCH_OWN_LAND_BONUS: 1.6,   // sur ses propres terres (jusqu'à la frontière), une armée d'assaut marche 60 % plus vite
                               // qu'en terre ennemie
  MARCH_MIN_TIME: 2,           // la marche jusqu'à la frontière dure au moins 2 secondes
                               // (on peut y ajouter des soldats tout de suite)
  ARROW_INSIDE: 4,             // la flèche d'un assaut part de 4 cases à l'intérieur de la frontière
  // Après un assaut réussi (château, église, port ou avant-poste pris), pendant WAR_EFFECT_TIME secondes :
  // le vainqueur subit un malus d'après-guerre (-25 % de soldats produits ; pas pour un avant-poste détruit),
  // le perdant est galvanisé (+25 %). Les deux s'additionnent : un +25 % annule un -25 %.
  WAR_EFFECT_TIME: 30,
  CAPTURE_TRUCE: 30,           // une ville (château), une église ou un port qui vient d'être conquis ne peut pas être attaqué pendant 30 s
  ELIMINATION_BOUNTY: 500,     // anéantir un royaume rapporte une prime de 500 pièces, plus le trésor qui lui restait
  POST_WAR_MALUS: 0.25,
  RALLY_BONUS: 0.25,
  DEFENSE_RALLY_TIME: 15, // repousser un assaut galvanise aussi le défenseur (+25 % de soldats produits) pendant 15 s
  // Ces effets s'additionnent (chaque victoire ou défaite compte 30 s), jusqu'à ces limites :
  POST_WAR_MAX: 0.75,  // au pire -75 % de soldats produits
  RALLY_MAX: 1,        // au mieux +100 %
  ENCLAVE_LOG_MIN: 50,         // un message n'annonce un morceau englobé que s'il fait au moins 50 cases
  CITADEL_ASSAULTS: 2,         // avec une citadelle (château niveau 3) : 2 assauts en même temps contre un même royaume
  DEFENDER_SPEED_BONUS: 1.18,  // les défenseurs partent du château le plus proche et marchent vers l'ennemi par le chemin
                               // le plus rapide de leurs terres (comme un assaut : vite en plaine, lentement dans le
                               // relief, et plus lentement s'ils sont nombreux), mais 18 % plus vite qu'un assaut
                               // de même taille, car ils sont chez eux (même chose pour ceux qui rentrent)
  DEFEND_COOLDOWN: 5,          // secondes à attendre entre deux envois d'aide à un allié contre un même assaut
  DEFEND_REINFORCE_DELAY: 3,   // défenseurs envoyés en plus : ils rejoignent l'armée de défense déjà partie en 3 s
  RETREAT_TIME: 3,             // une attaque annulée met 3 s à décrocher (elle peut encore se faire attaquer)...
  RETREAT_LOSS: 0.15,          // ...et perd 15 % de ses soldats dans la retraite
  REINFORCE_MIN_TIME: 3,       // les renforts d'un assaut marchent de sa cité jusqu'au front (MARCH_SPEED) : au moins 3 s
  AI_SEND_INTERVAL: 12,        // un bot attend au moins 12 s entre deux envois de soldats (renforts, défenseurs)
                               // et envoie alors un gros paquet, au lieu de quelques soldats à chaque instant
  FIGHT_RATE: 0.03,            // vitesse des combats (part des soldats engagés qui tombent par tour)
  FIGHT_MIN_LOSS: 0.1,         // pertes minimum par tour, pour que chaque combat finisse vite
  // Supériorité en nombre : quand un camp a plus de 2 fois plus de soldats que l'autre, il a un bonus.
  // Il tue plus vite ET perd moins de soldats par ennemi tué. Bonus = (rapport de force) / 2, au plus x5.
  // Ex. : 100 contre 40 → x1.25 · 300 contre 60 → x2.5 · 300 contre 4 → x5 (les 4 sont balayés en un instant)
  NUMBERS_THRESHOLD: 2,
  NUMBERS_MAX_BONUS: 5,
  GARRISON_POWER: 3,           // au combat, chaque soldat de garnison (château, port, avant-poste bâti) en vaut 3
  GARRISON_REGEN: 0.05,        // la garnison d'un château se reconstitue de 5 % par seconde
  NEUTRAL_TILE_COST: 0.08,     // soldats perdus (au moins) pour prendre une case (libre ou ennemie)...
  TILE_LOSS_RATE: 0.001,       // ...ou 0,1 % de l'armée par case (x la défense du terrain) : une grosse armée perd plus d'hommes
  // ...sauf en territoire désorganisé (personne n'y tient le terrain) : au-delà de DISORGANIZED_LOSS_FROM soldats, les
  // pertes par case n'augmentent plus (une grosse armée y va plus vite, sans perdre plus d'hommes par case)
  DISORGANIZED_LOSS_FROM: 500,
  REGIONS_REUSE: 5,            // (technique) tours de jeu pendant lesquels le découpage en morceaux peut servir tel quel
  // Prise d'un château : toute sa zone de défense et les bâtiments qui s'y trouvent sont pris d'un coup,
  // puis l'assaut s'arrête (les survivants rentrent).
  // Un royaume sans château (ville) peut être attaqué de front : toutes ses troupes défendent d'office,
  // mais désorganisées (sans pouvoir en place), chaque soldat ne compte que pour 0.8.
  LEADERLESS_DEFENSE: 0.8,
  WHITE_FLAG_MIN_TILES: 12,     // drapeau blanc (territoire désorganisé) : seulement sur les morceaux d'au moins 12 cases
  // Expéditions maritimes : en débarquant, on prend les terres libres autour du point de débarquement
  LANDING_RADIUS: 4,
  // Les soldats embarqués défendent l'avant-poste ; pendant la traversée, une petite partie se perd :
  SEA_LOSS_PER_SECOND: 0.01, // 1 % des soldats par seconde de mer...
  SEA_LOSS_MAX: 0.25,        // ...au plus 25 %
  // Traversée de fleuve (clic droit sur une terre libre de l'autre côté) : l'armée passe à gué
  CROSSING_TIME_FIRST: 10,   // secondes pour traverser la 1re case de fleuve (c'est difficile !)...
  CROSSING_TIME_NEXT: 6,     // ...et chacune des suivantes (fleuve double)
  CROSSING_MAX_DISTANCE: 14, // on ne traverse que si le fleuve est à moins de 14 cases de la terre visée
  CROSSING_COOLDOWN: 10,     // une seule traversée de fleuve toutes les 10 secondes
  FREE_LAND_CLICK_TIME: 4,   // terres libres : le 2e clic qui lance l'attaque doit venir dans les 4 secondes
  CROSSING_BANK_RADIUS: 4,   // terres libres prises sur l'autre rive, autour de la case visée
  // Ses soldats (défenseurs, armées qui marchent vers la frontière, soldats qui rentrent) passent un fleuve qui coupe
  // ses terres à gué : ils suivent le vrai chemin et perdent 5 secondes par case de fleuve traversée
  FORD_TIME: 5,
  FORD_PATH_COST: 4,         // un assaut vers une ville de l'autre côté d'un fleuve le passe à gué (s'il n'a pas mieux)
  // 🌉 Pont : clic droit sur un fleuve dont les deux rives (en face, en ligne droite) sont à toi. Ses soldats
  // passent alors ce fleuve comme une case de plaine, sans perdre de temps à gué.
  BRIDGE_COST: 700,
  AI_BRIDGE_AFTER: 240,      // les bots bâtissent leurs 1 ou 2 ponts après 4 minutes de partie
  EXPEDITION_COOLDOWN: 5,    // une expédition maritime au plus toutes les 5 secondes
  MAX_SEA_ASSAULTS: 2,        // débarquements à la fois chez un même royaume au plus (en mer, ou avant-postes chez lui)
  REPATRIATE_SPEED: 5,       // vitesse minimum (cases/s) des bateaux qui rapatrient les soldats d'un avant-poste
  OUTPOST_BUILD_TIME: 20,    // secondes pour bâtir un avant-poste après le débarquement (sans bonus avant)
  OUTPOST_DEFENSE: 1,        // une fois bâti, bonus de défense autour de lui (comme un fort en bois)
  OUTPOST_BUILDING_DEFENSE: 0.6, // pendant sa construction, ses défenseurs, occupés à bâtir, ne sont pas retranchés :
                               // pas de bonus du terrain (montagne, colline…), et ils ne se battent qu'à 60 %
  OUTPOST_SIEGE: 10,         // secondes de siège pour prendre un avant-poste (le défenseur peut encore le renforcer)
  PORT_SIEGE: 10,            // secondes de siège d'un port fortifié (niveau 3) : l'armée s'arrête à sa petite muraille
  OUTPOST_CASTLE_DISTANCE: 12, // pas de château à moins de 12 cases d'un de ses avant-postes (il faut conquérir avant)
  OUTPOST_GARRISON: 5,       // une fois bâti : soldats en garnison (fixe) ; les autres stationnent et peuvent attaquer
  // Encerclement : un royaume coupé en morceaux ne garde que le plus grand ; les autres vont à celui qui l'a coupé.
  // Seuls ses châteaux et ports de niveau 3 tiennent, isolés (et les morceaux avec un avant-poste).
  // Un château isolé peut être relié à nouveau par un assaut lancé depuis le royaume (en cliquant dessus).
  // S'il arrive, sa route s'élargit de 2 cases de chaque côté.
  LINK_WIDEN_RADIUS: 2,

  // --- Alliances (pactes) ---
  MAX_PACT_SIZE: 3,              // nombre maximum de royaumes dans un même pacte
  ALLIANCE_REFUSAL_COOLDOWN: 120, // après un refus, secondes avant de redemander à ce royaume (ni à un membre de son pacte)
  ALLIANCE_REQUEST_GAP: 20,      // au moins 20 s entre deux demandes d'alliance affichées au joueur (pas de spam)
  TRAITOR_DURATION: 120,         // secondes pendant lesquelles un traître est mal vu
  TRAITOR_DEFENSE_MALUS: 0.5,    // les terres d'un traître coûtent 2x moins cher à prendre
  ALLIANCE_REQUEST_TIMEOUT: 15,  // secondes pour répondre à une demande d'alliance
  ALLY_GIFT_RATIO: 0.75,         // soldats envoyés à un allié : il n'en reçoit que 75 % (le voyage en coûte)

  // --- Routes commerciales ---
  // Une de tes villes de niveau 2 ou plus peut être reliée par une route commerciale (grise) à une ville de niveau 2
  // ou plus d'un allié de ton pacte. Elle coûte cher, mais rapporte de l'or toutes les PRODUCTION_INTERVAL secondes,
  // d'autant plus que la route est longue. (selon son niveau, une ville a 1, 2 ou 3 routes au plus : voir trades dans CASTLE_LEVELS, et deux villes ne se relient
  // qu'une fois ; si le pacte est rompu, la route s'arrête, et elle reprend quand ses deux villes sont de nouveau alliées.)
  TRADE_COST_MIN: 1000,          // prix d'une route commerciale...
  TRADE_COST_FREE_LENGTH: 40,    // ...jusqu'à cette longueur (en cases)...
  TRADE_COST_PER_TILE: 30,       // ...puis tant d'or par case en plus...
  TRADE_COST_MAX: 5000,          // ...et au plus
  TRADE_GOLD_PER_TILE: 0.5,      // or rapporté à chaque versement, par case de longueur (une route de 100 cases : +50)
  TRADE_ALLY_SHARE: 0.5,         // l'allié touche en plus la moitié de ce revenu (le commerce enrichit les deux villes)
  TRADE_MAX_LENGTH: 250,         // longueur maximum d'une route commerciale (en cases)

  // --- Victoire ---
  WIN_RATIO: 0.7,          // posséder 70 % des terres = victoire

  // --- 🎵 Musique d'ambiance (voir music.js) ---
  // Les morceaux (dans sons/musique/) : le jeu en choisit un au hasard (jamais deux fois de suite le même), le joue en
  // entier (en fondu au début et à la fin), puis laisse toujours un moment de silence avant le suivant : PAUSE secondes,
  // au hasard entre ces deux valeurs.
  // Elle démarre avec la partie ; le bouton 🎵 en bas à droite (ou la touche M) la coupe ou la remet, et la petite barre
  // à côté règle son volume.
  MUSIC: {
    TRACKS: ['sons/musique/M1.mp3', 'sons/musique/M2.mp3', 'sons/musique/M3.mp3', 'sons/musique/M4.mp3', 'sons/musique/M5.mp3', 'sons/musique/M6.mp3'],
    VOLUME: 0.15,            // volume de départ (de 0 à 1) ; le joueur le règle avec la petite barre, en bas à droite
    FADE: 4,                 // secondes de fondu au début et à la fin d'un morceau
    PAUSE: [20, 120],        // silence entre deux morceaux (secondes, au hasard entre les deux)
  },

  // --- 📽️ Résumé de la partie (bouton « Résumé » de l'écran de fin, voir replay.js) ---
  // Pendant la partie, une photo de la carte (qui tient quoi) toutes les EVERY secondes, en petit (au plus CELLS cases) ;
  // au-delà de MAX_FRAMES photos, on en garde une sur deux (et on espace les suivantes). Le résumé rejoue toute la
  // partie en DURATION secondes (plus vite pour une partie courte : au plus FRAME_MS millisecondes par photo).
  REPLAY: { EVERY: 2, CELLS: 40000, MAX_FRAMES: 600, DURATION: 20, FRAME_MS: 120 },
};

const TERRAIN = { WATER: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4, RIVER: 5, GREAT_RIVER: 6, PEAK: 7, DESERT: 8,
  WOODED_HILLS: 9, SNOW: 10 };

const TERRAIN_INFO = [
  { name: tr('Mer', 'Sea'),      color: [52, 92, 130],   cost: Infinity },
  { name: tr('Plaine', 'Plains'),   color: [172, 186, 112], cost: 1 },
  { name: tr('Forêt', 'Forest'),    color: [92, 124, 70],   cost: 1.6 },
  { name: tr('Colline', 'Hills'),  color: [162, 146, 104], cost: 2.2 },
  { name: tr('Montagne', 'Mountain'), color: [130, 124, 118], cost: 2.8 },
  // Fleuve : une frontière naturelle, longue à traverser, et un gros bonus de défense (+3)
  { name: tr('Fleuve', 'River'),   color: [74, 132, 184],  cost: 4 },
  // Grand fleuve (là où 3 fleuves se sont rejoints) : infranchissable, comme la mer
  { name: tr('Grand fleuve', 'Great river'), color: [58, 108, 160], cost: Infinity },
  // Sommet (le cœur des montagnes) : infranchissable
  { name: tr('Sommet', 'Peak'), color: [226, 228, 232], cost: Infinity },
  // Désert : aucune défense en plus (comme une plaine), mais les bâtiments posés dessus produisent moins
  { name: tr('Désert', 'Desert'), color: [222, 198, 134], cost: 1 },
  // Colline boisée : une colline couverte de forêt, les deux bonus s'ajoutent (forêt +60 % et colline +120 %)
  { name: tr('Colline boisée', 'Wooded hills'), color: [122, 124, 70], cost: 2.8 },
  // Neige (seulement sur la carte Azeroth) : comme une colline (défense +120 %, aussi lente à traverser), mais blanche
  // (le Norfendre, le Berceau-de-l'Hiver, Dun Morogh…)
  // (un peu bleutée et moins éclatante que les sommets, pour ne pas les confondre)
  { name: tr('Neige', 'Snow'), color: [184, 201, 224], cost: 2.2 },
];
// cost = défense de la case (et temps pour la traverser) : 1 en plaine, plus ailleurs.
// On ne peut rien construire sur un fleuve.
// Le terrain le plus long à traverser (une armée doit toujours pouvoir avancer d'une case)
const MAX_LAND_COST = Math.max(...TERRAIN_INFO.filter(t => t.cost < Infinity).map(t => t.cost));

const B_MILL = 1, B_BARRACKS = 2, B_CASTLE = 3, B_CHURCH = 4, B_PORT = 5, B_OUTPOST = 6, B_MINE = 7, B_TOWER = 8;

// Les 2 niveaux du moulin : gold = or produit toutes les PRODUCTION_INTERVAL secondes.
const MILL_LEVELS = [
  null,
  { name: tr('Moulin', 'Mill'),       gold: 1.8, img: 'img/moulin1.webp', size: 2.0 },
  { name: tr('Grand moulin', 'Great mill'), gold: 4.2, img: 'img/moulin2.webp', size: 2.4, upgradeCost: 150 },
];

// Les 3 niveaux de la caserne : troops = soldats produits toutes les PRODUCTION_INTERVAL secondes,
// maxTroops = soldats en plus dans l'armée maximum,
// power = force de TOUS les soldats du royaume au combat (1.2 = chaque soldat vaut 1,2 soldat).
// Ce bonus ne s'additionne pas : c'est la meilleure caserne du royaume qui compte.
const BARRACKS_LEVELS = [
  null,
  { name: tr('Camp d\'entraînement', 'Training camp'), troops: 2, maxTroops: 25, power: 1.3, img: 'img/caserne1.webp', size: 3.2 },
  { name: tr('Caserne', 'Barracks'),              troops: 4, maxTroops: 50, power: 1.8, img: 'img/caserne2.webp', size: 4.6, upgradeCost: 400 },
  { name: tr('Grande caserne', 'Great barracks'),       troops: 9, maxTroops: 350, power: 2.5, img: 'img/caserne3.webp', size: 6.0, upgradeCost: 2500 },
];

// Les 3 niveaux du château. Le bonus s'ajoute à la défense du terrain
// dans sa muraille (ex. forêt x1.6 + niveau 3 → x5.6).
// siege = secondes de siège : une armée ne traverse pas la muraille ; arrivée au pied du mur, elle doit
// tenir ce temps avant que le château ne tombe (avec toute la zone de sa muraille)
// (le défenseur peut encore envoyer des soldats pendant ce temps).
const CASTLE_LEVELS = [
  null,
  { name: tr('Fort en bois', 'Wooden fort'), radius: 8,  bonus: 1, slots: 4, garrison: 10,  siege: 8,  img: 'img/chateau1.webp', size: 4.8, road: null,    roadBonus: 0, trades: 0 },
  { name: tr('Château', 'Castle'),      radius: 10, bonus: 2, slots: 6, garrison: 50,  siege: 13, img: 'img/chateau2.webp', size: 6.4,   road: 'dirt',  roadBonus: 0.2, upgradeCost: 500, trades: 1 },
  { name: tr('Citadelle', 'Citadel'),    radius: 13, bonus: 4, slots: 9, garrison: 150, siege: 18, img: 'img/chateau3.webp', size: 7.8, road: 'paved', roadBonus: 0.5, upgradeCost: 3000, trades: 2 },
  // Niveau 4 : la cité impériale, une seule par royaume et par partie (voir IMPERIAL plus bas)
  { name: tr('Cité impériale', 'Imperial city'), radius: 16, bonus: 6, slots: 12, garrison: 300, siege: 24, img: 'img/chateau4.webp', size: 9.0, road: 'paved', roadBonus: 1, upgradeCost: 15000, imperial: true, trades: 3 },
];
// Cité impériale (château de niveau 4) : il faut au moins un bâtiment de chaque type au niveau maximum (moulin,
// caserne, église, port et la citadelle elle-même), et on n'en bâtit qu'une par partie. En plus de ses murs :
const IMPERIAL = {
  troopPower: 0.25,   // tous les soldats du royaume +25 % plus forts au combat (en plus de la meilleure caserne)
  tradeBonus: 0.5,    // ses routes commerciales rapportent +50 %
  roadFactor: 2,      // ses chemins vers les ports et les églises deviennent des routes de pierre : leurs bonus x2
                      // (ports +60 %, églises 2 fois plus d'or), et les moulins et casernes au bord aussi (+40 %)
};
// slots = moulins et casernes qu'on peut bâtir dans sa muraille (4, 6, 9 puis 12) ;
// trades = routes commerciales au plus vers des villes alliées (1 au niveau 2, 2 au niveau 3, 3 au niveau 4) ;
// garrison = garnison : soldats du château qui le défendent seuls quand un assaut le vise,
// le temps que le royaume envoie des renforts. Elle se reconstitue avec le temps.
// size = largeur de l'image en cases, quand on zoome assez pour la voir
// road = chemins vers les moulins et casernes dans la muraille ('dirt' = terre, 'paved' = pavés)
// roadBonus = bonus de ces bâtiments reliés (0.2 = +20 % d'or ou de soldats produits)

// Les 3 niveaux de l'église. Elle se construit n'importe où sur son territoire, sauf dans la muraille
// d'un château. Elle n'est pas défendue (pas de bonus de défense, pas de garnison) : on peut l'attaquer
// directement, comme un château.
// slots = moulins ou casernes qu'on peut construire autour d'elle (à moins de radius cases),
//         même hors de la muraille d'un château ;
// castles = châteaux en plus que le royaume peut construire (seule sa meilleure église compte) ;
// faith = Croyance apportée au royaume (les églises s'additionnent).
const CHURCH_LEVELS = [
  null,
  { name: tr('Église', 'Church'),        slots: 1, castles: 0, faith: 10, radius: 7,  img: 'img/eglise1.webp', size: 2.7 },
  { name: tr('Grande église', 'Great church'), slots: 2, castles: 1, faith: 30, radius: 8,  img: 'img/eglise2.webp', size: 3.6,   upgradeCost: 800 },
  { name: tr('Cathédrale', 'Cathedral'),    slots: 5, castles: 2, faith: 50, radius: 10, img: 'img/eglise3.webp', size: 5.0, upgradeCost: 2000 },
];

// Les 3 niveaux du port. Il se construit au bord de la mer ou d'un fleuve, n'est pas défendu
// (on peut l'attaquer directement, comme un château) et produit de l'or toutes les PRODUCTION_INTERVAL s.
// boatSpeed = vitesse des bateaux d'expédition (cases par seconde ; 0 = pas d'expédition),
// landingCost = prix d'un débarquement (x1 = normal, x0.5 = moitié prix).
const PORT_LEVELS = [
  null,
  { name: tr('Port', 'Port'),       gold: 3, boatSpeed: 0, slots: 0, img: 'img/port1.webp', size: 3 },
  { name: tr('Grand port', 'Great port'), gold: 8, boatSpeed: 5, landingCost: 1,   slots: 1, radius: 7, img: 'img/port2.webp', size: 4.6, upgradeCost: 400 },
  { name: tr('Port royal', 'Royal port'), gold: 16, boatSpeed: 9, landingCost: 0.5, slots: 3, radius: 8, img: 'img/port3.webp', size: 6.2, upgradeCost: 2000, garrison: 10, bonus: 1 },
];
// slots / radius = comme l'église : moulins ou casernes qu'on peut construire autour du port
// garrison = petite garnison qui défend le port royal (comme un fort en bois), et se reconstitue
// bonus = défense en plus dans sa petite muraille (sa zone), comme un fort en bois

// Production des moulins, casernes, églises et ports selon le terrain où ils sont construits
// (moyenne des cases qu'ils occupent). Ordre : mer, plaine, forêt, colline, montagne, fleuve, grand fleuve, sommet,
// désert, colline boisée. Dans le désert, tout bâtiment produit DESERT_PRODUCTION (0.8 = -20 %).
const DESERT_PRODUCTION = 0.8;
const TERRAIN_PRODUCTION = {
  [B_MILL]:     [0, 1.3, 1.0, 0.9, 0.7, 0, 0, 0, DESERT_PRODUCTION, 0.9, 0.9], // les moulins aiment les plaines (la neige : comme une colline)
  // les casernes, les forêts et les collines (colline boisée : les deux à la fois, +40 %)
  [B_BARRACKS]: [0, 1.0, 1.3, 1.3, 0.9, 0, 0, 0, DESERT_PRODUCTION, 1.4, 1.3],
  // les églises (or de leurs chemins et Croyance), les hauteurs : +30 % sur colline, colline boisée et montagne ;
  // neutre en plaine, et -20 % en forêt
  [B_CHURCH]:   [0, 1.0, 0.8, 1.3, 1.3, 0, 0, 0, DESERT_PRODUCTION, 1.3, 1.3],
  [B_PORT]:     [0, 1.0, 1.0, 1.0, 1.0, 0, 0, 0, DESERT_PRODUCTION, 1.0, 1.0], // le port : seul le désert compte
};

// Niveaux de chaque type de bâtiment (null = ne s'améliore pas)
// ⛏️ Les mines : elles se bâtissent seulement sur un filon (des taches de minerai posées au hasard sur la carte, dans les
// montagnes, ou les collines pour la pierre). Une mine a 2 niveaux, et rapporte 2 fois plus si une route la relie à une
// de ses villes (une ville à moins de MINE_ROAD_DISTANCE cases, sur la même terre). Elle ne se démolit pas.
const MINE_LEVELS = [
  null,
  { name: tr('Site minier', 'Mining site'),  img: 'img/mine1.webp', size: 3 },
  { name: tr('Grand site minier', 'Great mining site'), img: 'img/mine2.webp', size: 3.8, upgradeCost: 1200 },
];
// Les 4 sortes de filons. count = combien sur une carte moyenne (au hasard entre les deux, un peu plus sur une grande
// carte), max = combien un royaume peut en avoir au plus (les autres ne comptent pas), puis par niveau (1 et 2) :
const MINES = {
  // ⚒ fer : toutes les troupes du royaume sont plus fortes (+4 % / +8 % par mine, doublé si reliée : +48 % au plus)
  iron: { name: tr('Mine de fer', 'Iron mine'), short: tr('troupes plus fortes', 'stronger troops'), icon: '⚒️', terrain: 'mountain', count: [4, 6], max: 3, power: [0, 0.04, 0.08] },
  // 🪙 or : le filon rapporte 2500 pièces en 10 minutes d'exploitation (un peu à chaque production), doublé si
  //   reliée ; puis il s'épuise (son compteur, à lui, passe d'un royaume à l'autre) ; le niveau 2 le relance pour
  //   10 minutes de plus, qui rapportent de nouveau 2500 pièces
  gold: { name: tr('Mine d\'or', 'Gold mine'), short: tr('beaucoup d\'or, mais il s\'épuise', 'lots of gold, but it runs out'), icon: '🪙', terrain: 'mountain', count: [4, 6], total: 2500, time: 600 },
  // 🪨 pierre (une carrière, en colline) : les améliorations, les murs et les ponts coûtent moins cher
  //   (−5 % / −10 % par carrière, doublé si reliée : −60 % au plus)
  stone: { name: tr('Carrière de pierre', 'Stone quarry'), short: tr('améliorations moins chères', 'cheaper upgrades'), icon: '🪨', terrain: 'hills', count: [4, 6], max: 3, discount: [0, 0.05, 0.1] },
  // 💎 diamant : une longue extraction (20 minutes ; 2 fois plus lente sans route, 50 % plus rapide au niveau 2) ;
  //   au 1er quart 1 000 pièces, au 2e 2 000, au 3e 3 000, et 10 000 à la fin ; puis le filon est épuisé pour tout le monde.
  //   (son compteur passe à celui qui prend la mine : il touche les versements suivants)
  diamond: { name: tr('Mine de diamant', 'Diamond mine'), short: tr('un trésor de 16 000 pièces', 'a treasure of 16,000 gold'), icon: '💎', terrain: 'mountain', count: [1, 3], time: 1200, speed: [0, 1, 1.5],
    pay: [1000, 2000, 3000], final: 10000 }, // (pay : le versement de chaque quart, dans l'ordre)
};
const MINE_KINDS = ['iron', 'gold', 'stone', 'diamond'];

// 🗼 Les 5 niveaux de la tour de garde (seulement dans le scénario « Gouffre de Helm », voir helm.js) : chaque seconde,
// elle abat damage soldats des armées ennemies qui se battent à moins de range cases d'elle (la plus proche d'abord).
// Une tour prise par l'ennemi retombe au niveau 1. Elle se construit partout sur ses terres (pas de muraille),
// à TOWER_DISTANCE cases au moins de ses autres tours.
const TOWER_LEVELS = [
  null,
  { name: tr('Tour de guet', 'Watchtower'),          range: 9,  damage: 3,  img: 'img/tour1.webp', size: 2.6 },
  { name: tr('Tour de garde', 'Guard tower'),        range: 11, damage: 6,  img: 'img/tour2.webp', size: 3.0, upgradeCost: 250 },
  { name: tr('Tour d\'archers', 'Archer tower'),     range: 13, damage: 10, img: 'img/tour3.webp', size: 3.4, upgradeCost: 700 },
  { name: tr('Tour fortifiée', 'Fortified tower'),   range: 15, damage: 16, img: 'img/tour4.webp', size: 3.8, upgradeCost: 1600 },
  { name: tr('Grande tour du Cor', 'Great horn tower'), range: 18, damage: 25, img: 'img/tour5.webp', size: 4.3, upgradeCost: 3500 },
];
const TOWER_DISTANCE = 10;

const BUILDING_LEVELS = [null, MILL_LEVELS, BARRACKS_LEVELS, CASTLE_LEVELS, CHURCH_LEVELS, PORT_LEVELS, null, MINE_LEVELS, TOWER_LEVELS];

// L'index dans ce tableau correspond au numéro du bâtiment (0 = aucun).
// tiles = côté du carré occupé sur la carte (2 → 2x2 cases, 4 → 4x4 cases)
const BUILDINGS = [
  null,
  { name: tr('Moulin', 'Mill'), icon: '🌾', tiles: 2, baseCost: 10,
    desc: tr(`produit de l'or toutes les ${CONFIG.PRODUCTION_INTERVAL} s (2 niveaux)`, `produces gold every ${CONFIG.PRODUCTION_INTERVAL} s (2 levels)`) },
  { name: tr('Caserne', 'Barracks'), icon: '⚔️', tiles: 2, baseCost: 20,
    desc: tr(`produit des soldats toutes les ${CONFIG.PRODUCTION_INTERVAL} s, armée plus grande (3 niveaux)`,
      `trains soldiers every ${CONFIG.PRODUCTION_INTERVAL} s, bigger army (3 levels)`) },
  { name: tr('Château', 'Castle'), icon: '🏰', tiles: 4, baseCost: 250,
    desc: tr('muraille qui protège ses terres (3 niveaux)', 'walls that protect its lands (3 levels)') },
  { name: tr('Église', 'Church'), icon: '⛪', tiles: 2, baseCost: 50,
    desc: tr('hors des murailles, sans défense : moulins et casernes autour d\'elle, et plus de châteaux (3 niveaux)',
      'outside the walls, undefended: mills and barracks around it, and more castles (3 levels)') },
  { name: tr('Port', 'Port'), icon: '⚓', tiles: 2, baseCost: 60,
    desc: tr('au bord de la mer ou d\'un fleuve, sans défense : produit de l\'or, et dès le niveau 2 les expéditions maritimes (3 niveaux)',
      'by the sea or a river, undefended: produces gold, and naval expeditions from level 2 (3 levels)') },
  // L'avant-poste ne se construit pas : il apparaît quand on débarque (baseCost = prix de l'expédition)
  { name: tr('Avant-poste', 'Outpost'), icon: '⛺', tiles: 2, baseCost: 20, hidden: true, desc: tr('base d\'un débarquement', 'base of a landing'),
    img: 'img/avantposte.webp', size: 3.8 }, // (un seul niveau : son image est ici)
  { name: tr('Mine', 'Mine'), icon: '⛏️', tiles: 2, baseCost: 600,
    desc: tr('sur un filon : fer (troupes plus fortes), or (beaucoup d\'or, mais il s\'épuise), pierre (améliorations moins chères) ou diamant (un trésor) (2 niveaux)',
      'on an ore vein: iron (stronger troops), gold (lots of gold, but it runs out), stone (cheaper upgrades) or diamond (a treasure) (2 levels)') },
  { name: tr('Tour de garde', 'Guard tower'), icon: '🗼', tiles: 2, baseCost: 150,
    desc: tr('tire sur les armées ennemies proches ; prise, elle retombe au niveau 1 (5 niveaux)',
      'shoots enemy armies nearby; if taken, it drops back to level 1 (5 levels)') },
];

// Bâtiments que l'on peut viser directement avec un assaut (un royaume qui en a ne s'attaque que comme ça)
// (une mine aussi ; mais dans la zone d'une ville ou d'une église prise, elle part avec elle, comme un moulin)
const TARGET_TYPES = [B_CASTLE, B_CHURCH, B_PORT, B_OUTPOST, B_MINE, B_TOWER];

// Les bannières des royaumes (une par couleur) : la bannière choisie donne sa couleur au royaume.
// img = le drapeau entier, sur sa hampe (carte) ; icon = son tissu et ses rubans (petites icônes du classement, des messages…) ;
// logo = juste le tissu, recadré sur son motif (le choix de la bannière, au menu de départ)
// (la couleur suit le fond du drapeau, accentuée pour que deux royaumes ne se ressemblent pas sur la carte)
// Sur la carte : le pied du mât est à BANNER_FOOT de la largeur de l'image (le drapeau flotte à sa droite), et les
// drapeaux sont dessinés BANNER_SCALE fois plus hauts que les anciennes bannières (la longue hampe prend de la place ; 1.8 : +20 %)
const BANNER_FOOT = 0.28;
const BANNER_SCALE = 1.8;
const BANNERS = [
  { id: "Épées croisées", name: tr("Épées croisées", "Crossed swords"), img: 'img/bannieres/b01.webp', icon: 'img/bannieres/b01s.webp', logo: 'img/bannieres/b01m.webp', color: [180, 20, 20] },
  { id: "Le Péteur", name: tr("Le Péteur", "The Farter"), img: 'img/bannieres/b21.webp', icon: 'img/bannieres/b21s.webp', logo: 'img/bannieres/b21m.webp', color: [222, 78, 44] },
  { id: "Masse d'armes", name: tr("Masse d'armes", "Mace"), img: 'img/bannieres/b02.webp', icon: 'img/bannieres/b02s.webp', logo: 'img/bannieres/b02m.webp', color: [240, 128, 130] },
  { id: "Soleil", name: tr("Soleil", "Sun"), img: 'img/bannieres/b03.webp', icon: 'img/bannieres/b03s.webp', logo: 'img/bannieres/b03m.webp', color: [138, 24, 72] },
  { id: "Marteau", name: tr("Marteau", "Hammer"), img: 'img/bannieres/b04.webp', icon: 'img/bannieres/b04s.webp', logo: 'img/bannieres/b04m.webp', color: [245, 132, 10] },
  { id: "Canards", name: tr("Canards", "Ducks"), img: 'img/bannieres/b05.webp', icon: 'img/bannieres/b05s.webp', logo: 'img/bannieres/b05m.webp', color: [200, 160, 50] },
  { id: "Aigle noir", name: tr("Aigle noir", "Black eagle"), img: 'img/bannieres/b06.webp', icon: 'img/bannieres/b06s.webp', logo: 'img/bannieres/b06m.webp', color: [252, 232, 30] },
  { id: "Hallebardes", name: tr("Hallebardes", "Halberds"), img: 'img/bannieres/b07.webp', icon: 'img/bannieres/b07s.webp', logo: 'img/bannieres/b07m.webp', color: [150, 182, 118] },
  { id: "Chopes", name: tr("Chopes", "Tankards"), img: 'img/bannieres/b20.webp', icon: 'img/bannieres/b20s.webp', logo: 'img/bannieres/b20m.webp', color: [192, 222, 0] },
  { id: "Dragon", name: tr("Dragon", "Dragon"), img: 'img/bannieres/b08.webp', icon: 'img/bannieres/b08s.webp', logo: 'img/bannieres/b08m.webp', color: [38, 100, 48] },
  { id: "Chêne", name: tr("Chêne", "Oak"), img: 'img/bannieres/b09.webp', icon: 'img/bannieres/b09s.webp', logo: 'img/bannieres/b09m.webp', color: [48, 120, 110] },
  { id: "Lion", name: tr("Lion", "Lion"), img: 'img/bannieres/b10.webp', icon: 'img/bannieres/b10s.webp', logo: 'img/bannieres/b10m.webp', color: [40, 210, 210] },
  { id: "Château", name: tr("Château", "Castle"), img: 'img/bannieres/b11.webp', icon: 'img/bannieres/b11s.webp', logo: 'img/bannieres/b11m.webp', color: [130, 185, 235] },
  { id: "Fleurs de lys", name: tr("Fleurs de lys", "Fleurs-de-lis"), img: 'img/bannieres/b12.webp', icon: 'img/bannieres/b12s.webp', logo: 'img/bannieres/b12m.webp', color: [30, 60, 165] },
  { id: "Croissant", name: tr("Croissant", "Crescent"), img: 'img/bannieres/b13.webp', icon: 'img/bannieres/b13s.webp', logo: 'img/bannieres/b13m.webp', color: [125, 55, 190] },
  { id: "Poing", name: tr("Poing", "Fist"), img: 'img/bannieres/b14.webp', icon: 'img/bannieres/b14s.webp', logo: 'img/bannieres/b14m.webp', color: [112, 64, 30] },
  { id: "Corbeau", name: tr("Corbeau", "Raven"), img: 'img/bannieres/b19.webp', icon: 'img/bannieres/b19s.webp', logo: 'img/bannieres/b19m.webp', color: [196, 166, 120] },
  { id: "Poissons", name: tr("Poissons", "Fish"), img: 'img/bannieres/b15.webp', icon: 'img/bannieres/b15s.webp', logo: 'img/bannieres/b15m.webp', color: [238, 234, 222] },
  { id: "Hache d'or", name: tr("Hache d'or", "Golden axe"), img: 'img/bannieres/b16.webp', icon: 'img/bannieres/b16s.webp', logo: 'img/bannieres/b16m.webp', color: [150, 150, 146] },
  { id: "Main couronnée", name: tr("Main couronnée", "Crowned hand"), img: 'img/bannieres/b17.webp', icon: 'img/bannieres/b17s.webp', logo: 'img/bannieres/b17m.webp', color: [70, 78, 98] },
  { id: "Croix", name: tr("Croix", "Cross"), img: 'img/bannieres/b18.webp', icon: 'img/bannieres/b18s.webp', logo: 'img/bannieres/b18m.webp', color: [22, 20, 20] },
];

// (id : le nom fixe d'une bannière, le même dans toutes les langues ; c'est lui que le code utilise pour la retrouver)

// 🐉 Carte Azeroth : à la place des drapeaux, 15 écus des races et des groupes de World of Warcraft. Les royaumes
// rivaux y prennent le nom de leur écu (kingdom). shield : un écu, sans hampe (sur la carte, il est posé par son milieu).
const AZEROTH_BANNERS = [
  { id: "Humains", name: tr("Humains", "Humans"), kingdom: tr("Humains", "Humans"), color: [40, 82, 178] },
  { id: "Nains", name: tr("Nains", "Dwarves"), kingdom: tr("Nains", "Dwarves"), color: [215, 92, 30] },
  { id: "Elfes de la nuit", name: tr("Elfes de la nuit", "Night Elves"), kingdom: tr("Elfes de la nuit", "Night Elves"), color: [64, 50, 132] },
  { id: "Gnomes", name: tr("Gnomes", "Gnomes"), kingdom: tr("Gnomes", "Gnomes"), color: [240, 206, 30] },
  { id: "Orcs", name: tr("Orcs", "Orcs"), kingdom: tr("Orcs", "Orcs"), color: [138, 20, 20] },
  { id: "Morts-vivants", name: tr("Morts-vivants", "Undead"), kingdom: tr("Morts-vivants", "Undead"), color: [112, 52, 165] },
  { id: "Taurens", name: tr("Taurens", "Tauren"), kingdom: tr("Taurens", "Tauren"), color: [112, 76, 40] },
  { id: "Trolls", name: tr("Trolls", "Trolls"), kingdom: tr("Trolls", "Trolls"), color: [40, 180, 190] },
  { id: "Gnolls", name: tr("Gnolls", "Gnolls"), kingdom: tr("Gnolls", "Gnolls"), color: [104, 112, 88] },
  { id: "Ogres", name: tr("Ogres", "Ogres"), kingdom: tr("Ogres", "Ogres"), color: [204, 150, 52] },
  { id: "Murlocs", name: tr("Murlocs", "Murlocs"), kingdom: tr("Murlocs", "Murlocs"), color: [22, 110, 118] },
  { id: "Démons", name: tr("Démons", "Demons"), kingdom: tr("Démons", "Demons"), color: [82, 205, 40] },
  { id: "Défias", name: tr("Défias", "Defias"), kingdom: tr("Défias", "Defias"), color: [40, 40, 48] },
  { id: "Monastère Écarlate", name: tr("Monastère Écarlate", "Scarlet Monastery"), kingdom: tr("Monastère Écarlate", "Scarlet Monastery"), color: [228, 30, 42] },
  { id: "La Main d'Argent", name: tr("La Main d'Argent", "The Silver Hand"), kingdom: tr("La Main d'Argent", "The Silver Hand"), color: [204, 208, 218] },
];
// (ils vont à la suite des drapeaux, dans la même liste : set = 'azeroth')
AZEROTH_BANNERS.forEach((b, k) => {
  const n = String(k + 1).padStart(2, '0');
  BANNERS.push({ ...b, set: 'azeroth', shield: true, img: `img/bannieres/az${n}.webp`, icon: `img/bannieres/az${n}s.webp` });
});
// Les numéros (dans BANNERS) des bannières proposées sur une carte : les écus sur la carte Azeroth, les drapeaux ailleurs
function bannersForMap(mapType) {
  const set = mapType === 'azeroth' ? 'azeroth' : mapType === 'charlemagne' ? 'charlemagne' : mapType === 'helm' ? 'helm' : undefined;
  return BANNERS.map((b, k) => k).filter(k => BANNERS[k].set === set);
}
// ⚔️ Mode « Factions » (carte Azeroth seulement) : 3 camps, chacun un pacte éternel (il ne se rompt jamais, pas de
// trahison possible), et chaque royaume commence à sa capitale du jeu (x, y en cases de la carte Azeroth).
// Le joueur choisit sa race (donc son camp), mais pas l'endroit où il commence.
const AZEROTH_FACTIONS = [
  { name: tr('Alliance', 'Alliance'), races: ['Humains', 'Nains', 'Gnomes', 'Elfes de la nuit'] },
  { name: tr('Horde', 'Horde'), races: ['Orcs', 'Trolls', 'Morts-vivants', 'Taurens'] },
  { name: tr('Pacte sauvage', 'Wild Pact'), races: ['Défias', 'Gnolls', 'Ogres', 'Murlocs'] },
];
const AZEROTH_CAPITALS = {
  // (place : où, dans les phrases ; name : le nom écrit sur la carte, sous la capitale)
  'Humains': { at: [547, 402], place: tr('Hurlevent', 'Stormwind'), name: tr('Hurlevent', 'Stormwind') },
  'Nains': { at: [591, 329], place: tr('Forgefer', 'Ironforge'), name: tr('Forgefer', 'Ironforge') },
  'Gnomes': { at: [543, 325], place: tr('Gnomeregan', 'Gnomeregan'), name: tr('Gnomeregan', 'Gnomeregan') },
  'Elfes de la nuit': { at: [38, 68], place: tr('Darnassus', 'Darnassus'), name: tr('Darnassus', 'Darnassus') },
  'Orcs': { at: [180, 236], place: tr('Orgrimmar', 'Orgrimmar'), name: tr('Orgrimmar', 'Orgrimmar') },
  'Trolls': { at: [194, 288], place: tr('les îles de l\'Écho (Durotar)', 'the Echo Isles (Durotar)'), name: tr('Îles de l\'Écho', 'Echo Isles') },
  'Morts-vivants': { at: [563, 171], place: tr('Fossoyeuse', 'the Undercity'), name: tr('Fossoyeuse', 'Undercity') },
  'Taurens': { at: [91, 305], place: tr('les Pitons-du-Tonnerre', 'Thunder Bluff'), name: tr('Pitons-du-Tonnerre', 'Thunder Bluff') },
  'Défias': { at: [531, 448], place: tr('la Mine de la Mort (Marche de l\'Ouest)', 'the Deadmines (Westfall)'), name: tr('Mine de la Mort', 'Deadmines') },
  'Gnolls': { at: [614, 414], place: tr('les Carmines', 'the Redridge Mountains'), name: tr('Les Carmines', 'Redridge') },
  'Ogres': { at: [64, 347], place: tr('Hache-Tripes (Féralas)', 'Dire Maul (Feralas)'), name: tr('Hache-Tripes', 'Dire Maul') },
  'Murlocs': { at: [81, 155], place: tr('Sombrivage', 'Darkshore'), name: tr('Sombrivage', 'Darkshore') },
};

// 🏷️ Le nom d'un lieu tel qu'on l'écrit sur la carte : sans article au début (« la Digue de Helm » → « Digue de Helm »)
function placeLabel(name) {
  const s = name.replace(/^(le |la |les |l'|the )/i, '');
  return s[0].toUpperCase() + s.slice(1);
}

// Sur la carte, un écu est dessiné à cette taille (il n'a pas de longue hampe : pas besoin de l'agrandir autant)
const SHIELD_SCALE = 1.0;

// Les noms des royaumes contrôlés par l'ordinateur (ils reçoivent une bannière au hasard).
// (autant de noms que de drapeaux, moins celui du joueur : on peut jouer contre autant de rivaux que de drapeaux)
const KINGDOMS = tr(['Bourgogne', 'Aquitaine', 'Normandie', 'Bretagne', 'Provence', 'Lotharingie',
  'Saxe', 'Castille', 'Écosse', 'Flandre', 'Aragon', 'Bohême', 'Navarre', 'Savoie', 'Hongrie', 'Pologne', 'Danemark',
  'Bavière', 'Lombardie', 'Galles'], ['Burgundy', 'Aquitaine', 'Normandy', 'Brittany', 'Provence', 'Lotharingia',
  'Saxony', 'Castile', 'Scotland', 'Flanders', 'Aragon', 'Bohemia', 'Navarre', 'Savoy', 'Hungary', 'Poland', 'Denmark',
  'Bavaria', 'Lombardy', 'Wales']);

// botBonus : petit avantage donné aux royaumes de l'ordinateur (pas au joueur), en multiplicateurs
//   gold = or gagné (revenu des terres et des bâtiments), troops = recrutement, power = force des soldats
const DIFFICULTIES = {
  facile:    { bots: 5,  aggression: [0.6, 0.85], hateHuman: 0,    zeal: 0.5 },
  normal:    { bots: 7,  aggression: [0.45, 0.7], hateHuman: 0.1,  zeal: 1 },
  difficile: { bots: 10, aggression: [0.3, 0.55], hateHuman: 0.25, zeal: 2,
               botBonus: { gold: 1.25, troops: 1.2, power: 1.1 } },
};
