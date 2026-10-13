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
  MAX_TROOPS_PER_BARRACKS: 1500,
  BASE_TROOP_GROWTH: 15,       // soldats gagnés par seconde au minimum
  TROOP_GROWTH_PER_TILE: 0.3,  // soldats/seconde en plus par case possédée
  BARRACKS_GROWTH_BONUS: 0.3,  // +30 % de recrutement par caserne

  // --- Or ---
  BASE_GOLD: 1,            // or par seconde au minimum
  GOLD_PER_TILE: 0.01,
  BUILDING_COST_GROWTH: 1.5, // chaque bâtiment du même type coûte x1.5 plus cher

  // --- Combat ---
  ATTACK_SPEED: 0.15,          // vitesse de conquête
  ATTACK_PREP_TIME: 5,         // secondes de préparation avant d'attaquer un royaume
  NEUTRAL_TILE_COST: 2,        // soldats perdus pour prendre une case libre
  ENEMY_TILE_BASE_COST: 8,     // soldats perdus pour prendre une case ennemie
  DENSITY_FACTOR: 1.0,         // plus l'ennemi a de soldats par case, plus c'est dur
  DEFENDER_LOSS: 0.5,          // part des pertes infligées au défenseur

  // --- Alliances ---
  ALLIANCE_REFUSAL_COOLDOWN: 30, // secondes avant de redemander au même royaume
  TRAITOR_DURATION: 120,         // secondes pendant lesquelles un traître est mal vu
  TRAITOR_DEFENSE_MALUS: 0.5,    // les terres d'un traître coûtent 2x moins cher à prendre
  ALLIANCE_REQUEST_TIMEOUT: 15,  // secondes pour répondre à une demande d'alliance

  // --- Victoire ---
  WIN_RATIO: 0.6,          // posséder 60 % des terres = victoire
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

// Les 3 niveaux du château. Le bonus s'ajoute à la défense du terrain
// dans sa muraille (ex. forêt x1.6 + niveau 3 → x5.6).
const CASTLE_LEVELS = [
  null,
  { name: 'Fort en bois', radius: 7,  bonus: 1, img: 'img/chateau1.webp', size: 4.4 },
  { name: 'Château',      radius: 10, bonus: 2, img: 'img/chateau2.webp', size: 5,   upgradeCost: 600 },
  { name: 'Citadelle',    radius: 13, bonus: 4, img: 'img/chateau3.webp', size: 5.6, upgradeCost: 1500 },
];
// size = largeur de l'image en cases, quand on zoome assez pour la voir

// Niveaux de chaque type de bâtiment (null = ne s'améliore pas)
const BUILDING_LEVELS = [null, MILL_LEVELS, null, CASTLE_LEVELS];

// L'index dans ce tableau correspond au numéro du bâtiment (0 = aucun).
// tiles = côté du carré occupé sur la carte (2 → 2x2 cases, 4 → 4x4 cases)
const BUILDINGS = [
  null,
  { name: 'Moulin',  icon: '🌾', tiles: 2, baseCost: 100, desc: `+${MILL_LEVELS[1].gold} or/s (2 niveaux)` },
  { name: 'Caserne', icon: '⚔️', tiles: 2, baseCost: 200, desc: '+recrutement, +soldats max' },
  { name: 'Château', icon: '🏰', tiles: 4, baseCost: 300, desc: 'Muraille : +1 à +4 défense (3 niveaux)' },
];

// Les royaumes contrôlés par l'ordinateur.
const KINGDOMS = [
  { name: 'Bourgogne',   color: [170, 40, 60] },
  { name: 'Aquitaine',   color: [230, 170, 40] },
  { name: 'Normandie',   color: [110, 200, 240] },
  { name: 'Bretagne',    color: [240, 240, 240] },
  { name: 'Provence',    color: [200, 90, 200] },
  { name: 'Lotharingie', color: [40, 170, 170] },
  { name: 'Saxe',        color: [90, 50, 140] },
  { name: 'Castille',    color: [230, 110, 40] },
  { name: 'Écosse',      color: [255, 120, 150] },
  { name: 'Flandre',     color: [240, 220, 60] },
  { name: 'Aragon',      color: [120, 10, 10] },
];

const DIFFICULTIES = {
  facile:    { bots: 5,  aggression: [0.6, 0.85], hateHuman: 0 },
  normal:    { bots: 7,  aggression: [0.45, 0.7], hateHuman: 0.2 },
  difficile: { bots: 10, aggression: [0.3, 0.55], hateHuman: 0.5 },
};
