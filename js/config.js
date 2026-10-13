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
  GOLD_PER_FARM: 2.5,
  BUILDING_COST_GROWTH: 1.5, // chaque bâtiment du même type coûte x1.5 plus cher

  // --- Combat ---
  ATTACK_SPEED: 0.15,          // vitesse de conquête
  ATTACK_PREP_TIME: 5,         // secondes de préparation avant d'attaquer un royaume
  NEUTRAL_TILE_COST: 2,        // soldats perdus pour prendre une case libre
  ENEMY_TILE_BASE_COST: 8,     // soldats perdus pour prendre une case ennemie
  DENSITY_FACTOR: 1.0,         // plus l'ennemi a de soldats par case, plus c'est dur
  DEFENDER_LOSS: 0.5,          // part des pertes infligées au défenseur
  CASTLE_RADIUS: 8,            // rayon de protection d'un château
  CASTLE_DEFENSE: 2,           // les cases protégées coûtent x2 à prendre

  // --- Alliances ---
  ALLIANCE_REFUSAL_COOLDOWN: 30, // secondes avant de redemander au même royaume
  TRAITOR_DURATION: 120,         // secondes pendant lesquelles un traître est mal vu
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

const B_FARM = 1, B_BARRACKS = 2, B_CASTLE = 3;

// L'index dans ce tableau correspond au numéro du bâtiment (0 = aucun).
const BUILDINGS = [
  null,
  { name: 'Ferme',   icon: '🌾', baseCost: 100, desc: `+${CONFIG.GOLD_PER_FARM} or/s` },
  { name: 'Caserne', icon: '⚔️', baseCost: 200, desc: '+recrutement, +soldats max' },
  { name: 'Château', icon: '🏰', baseCost: 300, desc: 'Défense x2 autour' },
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
