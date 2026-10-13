// ⚙️ RÉGLAGES DU JEU
// C'est ici que tu peux mettre le jeu "à ta sauce" : change les chiffres,
// recharge la page, et observe ce qui se passe !

const CONFIG = {
  // --- Carte ---
  MAP_WIDTH: 200,          // largeur de la carte (en cases)
  MAP_HEIGHT: 130,         // hauteur de la carte (en cases)
  WATER_RATIO: 0.40,       // part de mer sur la carte (0.4 = 40 %)

  // --- Vitesse ---
  TICKS_PER_SECOND: 10,    // nombre de "tours" de jeu par seconde

  // --- Départ ---
  START_TROOPS: 600,
  START_GOLD: 100,
  START_RADIUS: 3,         // taille du territoire de départ
  MIN_SPAWN_DISTANCE: 14,  // distance minimale entre deux capitales

  // --- Soldats ---
  BASE_MAX_TROOPS: 1000,
  MAX_TROOPS_PER_TILE: 30,
  BASE_TROOP_GROWTH: 15,       // soldats gagnés par seconde au minimum
  TROOP_GROWTH_PER_TILE: 0.3,  // soldats/seconde en plus par case possédée
  // Le recrutement dépend du remplissage de l'armée : il monte jusqu'à TROOP_PEAK_RATIO
  // du maximum, puis baisse jusqu'à 0 quand on s'approche du maximum.
  TROOP_PEAK_RATIO: 0.4,       // remplissage idéal (40 % du maximum)
  TROOP_GROWTH_AT_ZERO: 0.7,   // vitesse de recrutement quand l'armée est vide (x0.7)
  TROOP_GROWTH_AT_PEAK: 1.3,   // vitesse au remplissage idéal (x1.3)

  // --- Or ---
  BASE_GOLD: 1,            // or par seconde au minimum
  GOLD_PER_TILE: 0.01,
  BUILDING_COST_GROWTH: 1.5, // chaque bâtiment du même type coûte x1.5 plus cher
  BUILDING_SPACING: 3,       // cases vides obligatoires autour de chaque bâtiment...
  CASTLE_SPACING: 4,         // ...et autour des châteaux
  MAX_CASTLES: 3,            // châteaux qu'un royaume peut construire dans la partie (capitale comprise ;
                             // les châteaux pris à l'ennemi ne comptent pas)

  // --- Combat ---
  ATTACK_SPEED: 0.15,          // vitesse de conquête
  ATTACK_PREP_TIME: 10,        // secondes de préparation avant un assaut contre un royaume
                               // (on peut y ajouter des soldats tout de suite)
  REINFORCE_DELAY: 5,          // une fois l'assaut lancé, les renforts mettent 5 s à arriver
  FIGHT_RATE: 0.03,            // vitesse des combats (part des soldats engagés qui tombent par tour)
  FIGHT_MIN_LOSS: 5,           // pertes minimum par tour, pour que chaque combat finisse vite
  GARRISON_REGEN: 0.05,        // la garnison d'un château se reconstitue de 5 % par seconde
  NEUTRAL_TILE_COST: 2,        // soldats perdus pour prendre une case (libre ou ennemie)
  // Prise d'un château : l'assaut finit de conquérir sa zone de défense (un peu élargie),
  // puis s'arrête, et l'armée doit récupérer avant de pouvoir réattaquer ce royaume.
  CASTLE_CAPTURE_EXTRA_RADIUS: 2,  // cases conquises en plus autour de la zone du château
  CASTLE_CAPTURE_COOLDOWN: 30,     // secondes avant de pouvoir réattaquer ce royaume
  RECOVER_GROWTH_FACTOR: 0.5,      // pendant ce repos, l'attaquant recrute 2x moins vite...
  RALLY_GROWTH_FACTOR: 1.5,        // ...et le défenseur 1.5x plus vite, pour se réorganiser

  // --- Alliances (pactes) ---
  MAX_PACT_SIZE: 3,              // nombre maximum de royaumes dans un même pacte
  ALLIANCE_REFUSAL_COOLDOWN: 30, // secondes avant de redemander au même royaume
  TRAITOR_DURATION: 120,         // secondes pendant lesquelles un traître est mal vu
  TRAITOR_DEFENSE_MALUS: 0.5,    // les terres d'un traître coûtent 2x moins cher à prendre
  ALLIANCE_REQUEST_TIMEOUT: 15,  // secondes pour répondre à une demande d'alliance

  // --- Victoire ---
  WIN_RATIO: 0.85,         // posséder 85 % des terres = victoire
};

const TERRAIN = { WATER: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4 };

const TERRAIN_INFO = [
  { name: 'Mer',      color: [52, 92, 130],   cost: Infinity },
  { name: 'Plaine',   color: [172, 186, 112], cost: 1 },
  { name: 'Forêt',    color: [92, 124, 70],   cost: 1.6 },
  { name: 'Colline',  color: [162, 146, 104], cost: 2.2 },
  { name: 'Montagne', color: [130, 124, 118], cost: 3.5 },
];

const B_MILL = 1, B_BARRACKS = 2, B_CASTLE = 3;

// Les 2 niveaux du moulin : chacun rapporte de l'or chaque seconde.
const MILL_LEVELS = [
  null,
  { name: 'Moulin',       gold: 2.5, img: 'img/moulin1.webp', size: 2.3 },
  { name: 'Grand moulin', gold: 6,   img: 'img/moulin2.webp', size: 2.8, upgradeCost: 400 },
];

// Les 3 niveaux de la caserne : soldats max en plus, et bonus de recrutement
// (0.3 = +30 %, les bonus de toutes les casernes s'additionnent).
const BARRACKS_LEVELS = [
  null,
  { name: 'Camp d\'entraînement', maxTroops: 1500, growth: 0.3, img: 'img/caserne1.webp', size: 2.5 },
  { name: 'Caserne',              maxTroops: 3000, growth: 0.5, img: 'img/caserne2.webp', size: 2.8, upgradeCost: 400 },
  { name: 'Grande caserne',       maxTroops: 5000, growth: 0.8, img: 'img/caserne3.webp', size: 3.2, upgradeCost: 1000 },
];

// Les 3 niveaux du château. Le bonus s'ajoute à la défense du terrain
// dans sa muraille (ex. forêt x1.6 + niveau 3 → x5.6).
const CASTLE_LEVELS = [
  null,
  { name: 'Fort en bois', radius: 7,  bonus: 1, garrison: 300,  img: 'img/chateau1.webp', size: 4.4, road: null,    roadBonus: 0 },
  { name: 'Château',      radius: 10, bonus: 2, garrison: 800,  img: 'img/chateau2.webp', size: 5,   road: 'dirt',  roadBonus: 0.2, upgradeCost: 600 },
  { name: 'Citadelle',    radius: 13, bonus: 4, garrison: 2000, img: 'img/chateau3.webp', size: 5.6, road: 'paved', roadBonus: 0.5, upgradeCost: 1500 },
];
// garrison = garnison : soldats du château qui le défendent seuls quand un assaut le vise,
// le temps que le royaume envoie des renforts. Elle se reconstitue avec le temps.
// size = largeur de l'image en cases, quand on zoome assez pour la voir
// road = chemins vers les moulins et casernes dans la muraille ('dirt' = terre, 'paved' = pavés)
// roadBonus = bonus de ces bâtiments reliés (0.2 = +20 % d'or ou de recrutement)

// Production des moulins et casernes selon le terrain où ils sont construits
// (moyenne des cases qu'ils occupent). Ordre : mer, plaine, forêt, colline, montagne.
const TERRAIN_PRODUCTION = {
  [B_MILL]:     [0, 1.3, 1.0, 0.9, 0.7], // les moulins aiment les plaines
  [B_BARRACKS]: [0, 1.0, 1.3, 1.3, 0.9], // les casernes, les forêts et les collines
};

// Niveaux de chaque type de bâtiment (null = ne s'améliore pas)
const BUILDING_LEVELS = [null, MILL_LEVELS, BARRACKS_LEVELS, CASTLE_LEVELS];

// L'index dans ce tableau correspond au numéro du bâtiment (0 = aucun).
// tiles = côté du carré occupé sur la carte (2 → 2x2 cases, 4 → 4x4 cases)
const BUILDINGS = [
  null,
  { name: 'Moulin',  icon: '🌾', tiles: 2, baseCost: 100, desc: `+${MILL_LEVELS[1].gold} or/s (2 niveaux)` },
  { name: 'Caserne', icon: '⚔️', tiles: 2, baseCost: 200, desc: '+soldats max, +recrutement (3 niveaux)' },
  { name: 'Château', icon: '🏰', tiles: 4, baseCost: 300, desc: 'Muraille : +1 à +4 défense (3 niveaux)' },
];

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
];

// Les noms des royaumes contrôlés par l'ordinateur (ils reçoivent une bannière au hasard).
const KINGDOMS = ['Bourgogne', 'Aquitaine', 'Normandie', 'Bretagne', 'Provence', 'Lotharingie',
  'Saxe', 'Castille', 'Écosse', 'Flandre', 'Aragon'];

const DIFFICULTIES = {
  facile:    { bots: 5,  aggression: [0.6, 0.85], hateHuman: 0 },
  normal:    { bots: 7,  aggression: [0.45, 0.7], hateHuman: 0.2 },
  difficile: { bots: 10, aggression: [0.3, 0.55], hateHuman: 0.5 },
};
