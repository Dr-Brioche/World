// ⚙️ RÉGLAGES DU JEU
// C'est ici que tu peux mettre le jeu "à ta sauce" : change les chiffres,
// recharge la page, et observe ce qui se passe !

const CONFIG = {
  // --- Carte ---
  MAP_WIDTH: 294,          // largeur de la carte (en cases)
  MAP_HEIGHT: 192,         // hauteur de la carte (en cases)
  WATER_RATIO: 0.50,       // part de mer sur la carte (0.5 = 50 %) ; la carte « Base navale » en a plus
  NAVAL_WATER_RATIO: 0.62, // part de mer de la carte « Base navale » (plusieurs grandes îles)
  ISLANDS: [4, 6],         // nombre de grandes îles de la carte « Base navale » (entre ces deux valeurs)
  ISLETS: [3, 8],          // nombre d'îlots ajoutés à la carte « Normale »
  MIN_SPAWN_LAND: 200,     // une capitale se fonde sur une terre d'au moins 200 cases (pas sur un îlot)
  RIVERS_MIN: 3,           // nombre de fleuves, tiré au hasard entre ces deux valeurs
  RIVERS_MAX: 12,          // (ils partent des montagnes et vont jusqu'à la mer)

  // --- Vitesse ---
  TICKS_PER_SECOND: 10,    // nombre de "tours" de jeu par seconde

  // --- Départ ---
  START_TROOPS: 10,       // soldats au départ (on commence petit !)
  START_GOLD: 10,
  START_RADIUS: 3,         // taille du territoire de départ
  MIN_SPAWN_DISTANCE: 18,  // distance minimale entre deux capitales

  // --- Soldats ---
  BASE_MAX_TROOPS: 20,
  MAX_TROOPS_PER_TILE: 0.12,
  BASE_TROOP_GROWTH: 0.15,     // soldats gagnés par seconde au minimum
  TROOP_GROWTH_PER_TILE: 0.0008, // soldats/seconde en plus par case possédée
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
  PRODUCTION_INTERVAL: 10,   // moulins et casernes produisent toutes les 10 secondes
  BUILDING_COST_GROWTH: 1.5, // chaque bâtiment du même type coûte x1.5 plus cher
  BUILDING_SPACING: 3,       // cases vides obligatoires autour de chaque bâtiment...
  CASTLE_SPACING: 4,         // ...et autour des châteaux
  MAX_CASTLES: 3,            // châteaux qu'un royaume peut construire dans la partie (capitale comprise ;
                             // les châteaux pris à l'ennemi ne comptent pas). Une église en débloque d'autres.

  // --- Combat ---
  ATTACK_SPEED: 0.25,          // vitesse de conquête (plus petit = les armées avancent plus lentement sur la carte)
  MIN_ATTACK_SPEED: 0.25,      // vitesse minimum d'une petite armée (cases de plaine par tour)
  ASSAULT_SLOWDOWN: 3,         // un assaut contre un royaume avance 3 fois moins vite que sur les terres libres
  ATTACK_PREP_TIME: 10,        // secondes de préparation avant un assaut contre un royaume
                               // (on peut y ajouter des soldats tout de suite)
  ARROW_INSIDE: 4,             // la flèche d'un assaut part de 4 cases à l'intérieur de la frontière
  REINFORCE_DELAY: 5,          // une fois l'assaut lancé, les renforts mettent 5 s à arriver
  FIGHT_RATE: 0.03,            // vitesse des combats (part des soldats engagés qui tombent par tour)
  FIGHT_MIN_LOSS: 0.1,         // pertes minimum par tour, pour que chaque combat finisse vite
  // Supériorité en nombre : quand un camp a plus de 2 fois plus de soldats que l'autre, il a un bonus.
  // Il tue plus vite ET perd moins de soldats par ennemi tué. Bonus = (rapport de force) / 2, au plus x5.
  // Ex. : 100 contre 40 → x1.25 · 300 contre 60 → x2.5 · 300 contre 4 → x5 (les 4 sont balayés en un instant)
  NUMBERS_THRESHOLD: 2,
  NUMBERS_MAX_BONUS: 5,
  GARRISON_REGEN: 0.05,        // la garnison d'un château se reconstitue de 5 % par seconde
  NEUTRAL_TILE_COST: 0.08,     // soldats perdus pour prendre une case (libre ou ennemie)
  // Prise d'un château : toute sa zone de défense et les bâtiments qui s'y trouvent sont pris d'un coup,
  // puis l'assaut s'arrête (les survivants rentrent).
  // Un royaume sans château ni église peut être attaqué de front : toutes ses troupes défendent d'office,
  // mais désorganisées (sans pouvoir en place), chaque soldat ne compte que pour 0.8.
  LEADERLESS_DEFENSE: 0.8,
  // Expéditions maritimes : en débarquant, on prend les terres libres autour du point de débarquement
  LANDING_RADIUS: 4,
  // Les soldats embarqués défendent l'avant-poste ; pendant la traversée, une petite partie se perd :
  SEA_LOSS_PER_SECOND: 0.01, // 1 % des soldats par seconde de mer...
  SEA_LOSS_MAX: 0.25,        // ...au plus 25 %
  // Traversée de fleuve (clic droit sur une terre libre de l'autre côté) : l'armée passe à gué
  CROSSING_TIME_PER_TILE: 3, // secondes pour traverser chaque case de fleuve (c'est difficile !)
  CROSSING_MAX_DISTANCE: 14, // on ne traverse que si le fleuve est à moins de 14 cases de la terre visée
  CROSSING_BANK_RADIUS: 4,   // terres libres prises sur l'autre rive, autour de la case visée
  INTERCEPT_SPEED: 6,        // vitesse (cases/s) des bateaux d'un port qui part intercepter un débarquement
  OUTPOST_BUILD_TIME: 20,    // secondes pour bâtir un avant-poste après le débarquement (sans bonus avant)
  OUTPOST_DEFENSE: 1,        // une fois bâti, bonus de défense autour de lui (comme un fort en bois)
  OUTPOST_BUILDING_MALUS: 0.2, // pendant sa construction, ses défenseurs sont occupés à bâtir : défense -0.2
  OUTPOST_GARRISON: 5,       // une fois bâti : soldats en garnison (fixe) ; les autres stationnent et peuvent attaquer
  // Encerclement : un royaume coupé en morceaux ne garde que le plus grand ; les autres vont à celui qui l'a coupé.
  // Seuls ses châteaux et ports de niveau 3 tiennent, isolés (et les morceaux avec un avant-poste).
  // Un château isolé peut être relié à nouveau par un assaut lancé depuis le royaume (en cliquant dessus).
  // S'il arrive, sa route s'élargit de 2 cases de chaque côté.
  LINK_WIDEN_RADIUS: 2,

  // --- Alliances (pactes) ---
  MAX_PACT_SIZE: 3,              // nombre maximum de royaumes dans un même pacte
  ALLIANCE_REFUSAL_COOLDOWN: 30, // secondes avant de redemander au même royaume
  TRAITOR_DURATION: 120,         // secondes pendant lesquelles un traître est mal vu
  TRAITOR_DEFENSE_MALUS: 0.5,    // les terres d'un traître coûtent 2x moins cher à prendre
  ALLIANCE_REQUEST_TIMEOUT: 15,  // secondes pour répondre à une demande d'alliance
  ALLY_GIFT_RATIO: 0.75,         // soldats envoyés à un allié : il n'en reçoit que 75 % (le voyage en coûte)

  // --- Victoire ---
  WIN_RATIO: 0.85,         // posséder 85 % des terres = victoire
};

const TERRAIN = { WATER: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4, RIVER: 5, GREAT_RIVER: 6, PEAK: 7 };

const TERRAIN_INFO = [
  { name: 'Mer',      color: [52, 92, 130],   cost: Infinity },
  { name: 'Plaine',   color: [172, 186, 112], cost: 1 },
  { name: 'Forêt',    color: [92, 124, 70],   cost: 1.6 },
  { name: 'Colline',  color: [162, 146, 104], cost: 2.2 },
  { name: 'Montagne', color: [130, 124, 118], cost: 3.5 },
  // Fleuve : une frontière naturelle, longue à traverser, et un gros bonus de défense (+3)
  { name: 'Fleuve',   color: [74, 132, 184],  cost: 4 },
  // Grand fleuve (là où 3 fleuves se sont rejoints) : infranchissable, comme la mer
  { name: 'Grand fleuve', color: [58, 108, 160], cost: Infinity },
  // Sommet (le cœur des montagnes) : infranchissable
  { name: 'Sommet', color: [226, 228, 232], cost: Infinity },
];
// cost = défense de la case (et temps pour la traverser) : 1 en plaine, plus ailleurs.
// On ne peut rien construire sur un fleuve.
// Le terrain le plus long à traverser (une armée doit toujours pouvoir avancer d'une case)
const MAX_LAND_COST = Math.max(...TERRAIN_INFO.filter(t => t.cost < Infinity).map(t => t.cost));

const B_MILL = 1, B_BARRACKS = 2, B_CASTLE = 3, B_CHURCH = 4, B_PORT = 5, B_OUTPOST = 6;

// Les 2 niveaux du moulin : gold = or produit toutes les PRODUCTION_INTERVAL secondes.
const MILL_LEVELS = [
  null,
  { name: 'Moulin',       gold: 1.5, img: 'img/moulin1.webp', size: 2.3 },
  { name: 'Grand moulin', gold: 3.5, img: 'img/moulin2.webp', size: 2.8, upgradeCost: 40 },
];

// Les 3 niveaux de la caserne : troops = soldats produits toutes les PRODUCTION_INTERVAL secondes,
// maxTroops = soldats en plus dans l'armée maximum,
// power = force de TOUS les soldats du royaume au combat (1.2 = chaque soldat vaut 1,2 soldat).
// Ce bonus ne s'additionne pas : c'est la meilleure caserne du royaume qui compte.
const BARRACKS_LEVELS = [
  null,
  { name: 'Camp d\'entraînement', troops: 2, maxTroops: 25, power: 1.1, img: 'img/caserne1.webp', size: 2.5 },
  { name: 'Caserne',              troops: 4, maxTroops: 50, power: 1.2, img: 'img/caserne2.webp', size: 2.8, upgradeCost: 40 },
  { name: 'Grande caserne',       troops: 7, maxTroops: 80, power: 1.5, img: 'img/caserne3.webp', size: 3.2, upgradeCost: 150 },
];

// Les 3 niveaux du château. Le bonus s'ajoute à la défense du terrain
// dans sa muraille (ex. forêt x1.6 + niveau 3 → x5.6).
// siege = secondes de siège : arrivée au pied du château, l'armée doit tenir ce temps avant qu'il ne tombe
// (le défenseur peut encore envoyer des soldats pendant ce temps).
const CASTLE_LEVELS = [
  null,
  { name: 'Fort en bois', radius: 8,  bonus: 1, garrison: 5,  siege: 5,  img: 'img/chateau1.webp', size: 4.4, road: null,    roadBonus: 0 },
  { name: 'Château',      radius: 10, bonus: 2, garrison: 15, siege: 10, img: 'img/chateau2.webp', size: 5,   road: 'dirt',  roadBonus: 0.2, upgradeCost: 90 },
  { name: 'Citadelle',    radius: 13, bonus: 4, garrison: 35, siege: 15, img: 'img/chateau3.webp', size: 5.6, road: 'paved', roadBonus: 0.5, upgradeCost: 225 },
];
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
// castles = châteaux en plus que le royaume peut construire (chaque église compte : elles s'additionnent).
const CHURCH_LEVELS = [
  null,
  { name: 'Église',        slots: 1, castles: 0, radius: 7,  img: 'img/eglise1.webp', size: 2.6 },
  { name: 'Grande église', slots: 2, castles: 1, radius: 8,  img: 'img/eglise2.webp', size: 3,   upgradeCost: 100 },
  { name: 'Cathédrale',    slots: 5, castles: 2, radius: 10, img: 'img/eglise3.webp', size: 3.4, upgradeCost: 300 },
];

// Les 3 niveaux du port. Il se construit au bord de la mer ou d'un fleuve, n'est pas défendu
// (on peut l'attaquer directement, comme un château) et produit de l'or toutes les PRODUCTION_INTERVAL s.
// boatSpeed = vitesse des bateaux d'expédition (cases par seconde ; 0 = pas d'expédition),
// landingCost = prix d'un débarquement (x1 = normal, x0.5 = moitié prix).
const PORT_LEVELS = [
  null,
  { name: 'Port',       gold: 3,  boatSpeed: 0, slots: 0, img: 'img/port1.webp', size: 3 },
  { name: 'Grand port', gold: 6,  boatSpeed: 5, landingCost: 1,   slots: 1, radius: 7, img: 'img/port2.webp', size: 3.4, upgradeCost: 120 },
  { name: 'Port royal', gold: 10, boatSpeed: 9, landingCost: 0.5, slots: 3, radius: 8, img: 'img/port3.webp', size: 3.8, upgradeCost: 375, garrison: 5, bonus: 1 },
];
// slots / radius = comme l'église : moulins ou casernes qu'on peut construire autour du port
// garrison = petite garnison qui défend le port royal (comme un fort en bois), et se reconstitue
// bonus = défense en plus dans sa petite muraille (sa zone), comme un fort en bois

// Production des moulins et casernes selon le terrain où ils sont construits
// (moyenne des cases qu'ils occupent). Ordre : mer, plaine, forêt, colline, montagne, fleuve, grand fleuve, sommet.
const TERRAIN_PRODUCTION = {
  [B_MILL]:     [0, 1.3, 1.0, 0.9, 0.7, 0, 0, 0], // les moulins aiment les plaines
  [B_BARRACKS]: [0, 1.0, 1.3, 1.3, 0.9, 0, 0, 0], // les casernes, les forêts et les collines
};

// Niveaux de chaque type de bâtiment (null = ne s'améliore pas)
const BUILDING_LEVELS = [null, MILL_LEVELS, BARRACKS_LEVELS, CASTLE_LEVELS, CHURCH_LEVELS, PORT_LEVELS, null];

// L'index dans ce tableau correspond au numéro du bâtiment (0 = aucun).
// tiles = côté du carré occupé sur la carte (2 → 2x2 cases, 4 → 4x4 cases)
const BUILDINGS = [
  null,
  { name: 'Moulin',  icon: '🌾', tiles: 2, baseCost: 10, desc: `produit de l'or toutes les ${CONFIG.PRODUCTION_INTERVAL} s (2 niveaux)` },
  { name: 'Caserne', icon: '⚔️', tiles: 2, baseCost: 20, desc: `produit des soldats toutes les ${CONFIG.PRODUCTION_INTERVAL} s, armée plus grande (3 niveaux)` },
  { name: 'Château', icon: '🏰', tiles: 4, baseCost: 100, desc: 'muraille qui protège ses terres (3 niveaux)' },
  { name: 'Église',  icon: '⛪', tiles: 2, baseCost: 50, desc: 'hors des murailles, sans défense : moulins et casernes autour d\'elle, et plus de châteaux (3 niveaux)' },
  { name: 'Port',    icon: '⚓', tiles: 2, baseCost: 60, desc: 'au bord de la mer ou d\'un fleuve, sans défense : produit de l\'or, et dès le niveau 2 les expéditions maritimes (3 niveaux)' },
  // L'avant-poste ne se construit pas : il apparaît quand on débarque (baseCost = prix de l'expédition)
  { name: 'Avant-poste', icon: '⛺', tiles: 2, baseCost: 20, hidden: true, desc: 'base d\'un débarquement',
    img: 'img/avantposte.webp', size: 3.4 }, // (un seul niveau : son image est ici)
];

// Bâtiments que l'on peut viser directement avec un assaut (un royaume qui en a ne s'attaque que comme ça)
const TARGET_TYPES = [B_CASTLE, B_CHURCH, B_PORT, B_OUTPOST];

// Les bannières des royaumes (une par couleur) : la bannière choisie donne sa couleur au royaume.
const BANNERS = [
  { name: "Lion", img: 'img/bannieres/b01.webp', color: [196, 19, 19] }, // rouge
  { name: "Aigle bleu", img: 'img/bannieres/b02.webp', color: [37, 82, 190] }, // bleu
  { name: "Épées d'azur", img: 'img/bannieres/b07.webp', color: [88, 146, 194] }, // bleu clair
  { name: "Aigle vert", img: 'img/bannieres/b03.webp', color: [51, 98, 57] }, // vert
  { name: "Licorne", img: 'img/bannieres/b09.webp', color: [150, 209, 122] }, // vert clair
  { name: "Dragon", img: 'img/bannieres/b04.webp', color: [229, 175, 34] }, // jaune
  { name: "Couronne", img: 'img/bannieres/b06.webp', color: [102, 66, 45] }, // brun
  { name: "Étoile de feu", img: 'img/bannieres/b24.webp', color: [222, 96, 6] }, // orange
  { name: "Château", img: 'img/bannieres/b05.webp', color: [82, 31, 105] }, // violet
  { name: "Lys", img: 'img/bannieres/b10.webp', color: [229, 47, 119] }, // rose
  { name: "Arbre de vie", img: 'img/bannieres/b16.webp', color: [11, 137, 122] }, // turquoise
  { name: "Hache", img: 'img/bannieres/b21.webp', color: [237, 234, 228] }, // blanc
  { name: "Bouclier", img: 'img/bannieres/b22.webp', color: [35, 34, 34] }, // noir
  { name: "Poissons", img: 'img/bannieres/b25.webp', color: [185, 192, 199] }, // gris clair
];

// Les noms des royaumes contrôlés par l'ordinateur (ils reçoivent une bannière au hasard).
const KINGDOMS = ['Bourgogne', 'Aquitaine', 'Normandie', 'Bretagne', 'Provence', 'Lotharingie',
  'Saxe', 'Castille', 'Écosse', 'Flandre', 'Aragon'];

const DIFFICULTIES = {
  facile:    { bots: 5,  aggression: [0.6, 0.85], hateHuman: 0 },
  normal:    { bots: 7,  aggression: [0.45, 0.7], hateHuman: 0.2 },
  difficile: { bots: 10, aggression: [0.3, 0.55], hateHuman: 0.5 },
};
