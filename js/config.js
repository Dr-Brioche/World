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
  DESERT_RATIO: 0.15,      // part des plaines et forêts en désert sur les cartes aléatoires (production -20 %)
  WORLD_MAP_WIDTH: 1080,   // taille de la carte « Monde » (bien plus grande : on dézoome beaucoup)
  WORLD_MAP_HEIGHT: 408,
  EUROPE_MAP_WIDTH: 1000,  // taille de la carte « Europe »
  EUROPE_MAP_HEIGHT: 1000,
  MIN_OPPONENTS: 3,
  // Royaume coupé en deux sur un même continent : son plus grand morceau est son cœur. Un autre morceau tenu par
  // une ville (ou un port fortifié) et assez grand (au moins 25 % du plus grand) est aussi un cœur, à part entière :
  // ses armées en partent, ses défenseurs y vont. Plus petit, il reste isolé (ses villes tiennent seules).
  SPLIT_HEART_SHARE: 0.25,
  CAMERA_KEY_SPEED: 900,   // déplacement de la caméra au clavier (ZQSD / flèches), en pixels d'écran par seconde        // au moins 3 royaumes rivaux (on en choisit le nombre dans le menu, jusqu'à 11)
  WATER_RATIO: 0.50,       // part de mer sur la carte (0.5 = 50 %) ; la carte « Base navale » en a plus
  NAVAL_WATER_RATIO: 0.62, // part de mer de la carte « Base navale » (plusieurs grandes îles)
  ISLANDS: [4, 6],         // nombre de grandes îles de la carte « Base navale » (entre ces deux valeurs)
  // Les nombres d'îlots, de fleuves et de lacs ci-dessous sont pour une carte de 500 x 281 cases ; les autres en ont
  // plus ou moins (multipliés par la racine carrée du rapport de surface : x0,6 « Petite », x1,3 « Moyenne », x2 « Grande »)
  ISLETS: [4, 10],         // nombre de petits îlots ajoutés à la carte « Normale »
  MEDIUM_ISLETS: [1, 3],   // ...et d'îlots moyens (avec un peu de relief)
  MIN_SPAWN_LAND: 600,     // une capitale se fonde sur une terre d'au moins 600 cases (pas sur un îlot)
  RIVERS_MIN: 5,           // nombre de fleuves, tiré au hasard entre ces deux valeurs
  RIVERS_MAX: 18,          // (ils partent des montagnes et vont jusqu'à la mer)
  LAKES_MAX: 4,            // lacs au plus (au milieu d'un fleuve)

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
  BUILD_TIME: 3,             // secondes de chantier pour construire un bâtiment (il ne produit rien avant)
  UPGRADE_TIME: [40, 60],    // améliorer un bâtiment (tous les bâtiments) : 40 s pour passer au niveau 2, 60 s au niveau 3
  // Murs : une ville de niveau 2 peut bâtir 1 mur, une citadelle (niveau 3) un 2e. Un mur va de la muraille de la
  // ville jusqu'à l'endroit choisi, au plus WALL_MAX_REACH cases plus loin. Aucun assaut ne peut le franchir.
  WALL_COSTS: [500, 1000],   // prix du 1er mur, puis du 2e
  WALL_BUILD_TIME: 40,       // secondes de chantier
  WALL_MAX_REACH: 12,
  WALL_RETREAT_LOSS: 0.5,    // une armée en retraite qui doit franchir un mur (bâti dans son dos) y perd 50 % de ses soldats, par mur
  WALL_LINK_GARRISON: 50,    // deux de ses villes reliées par un mur : +50 soldats de garnison pour chacune
  WALL_SNAP: 3,              // visé à moins de 3 cases d'un obstacle (lac, sommet, fleuve, autre mur) : le mur s'y accroche
  DEMOLISH_TIME: 10,         // secondes de travaux pour détruire un de ses bâtiments
  PORT_ROAD_DISTANCE: 30,    // un port à moins de 30 cases d'un de ses châteaux (sur la même terre) y est relié
  PORT_ROAD_BONUS: 0.3,      // par un chemin de terre : +30 % d'or produit par le port
  // Une église pas trop loin d'une de ces routes port–ville (à moins de 10 cases) y est reliée par un petit chemin ;
  // sinon, une église pas trop loin d'une ville (à moins de 25 cases, sur la même terre) est reliée à elle.
  // Reliée, elle produit 2 pièces d'or toutes les PRODUCTION_INTERVAL secondes. (Un port seul, sans ville, ne suffit pas.)
  ROAD_MAX_CITIES: 3,        // un moulin, une caserne ou un port relié à plusieurs villes : une route par ville (3 au plus), les bonus s'additionnent
  CHURCH_ROAD_DISTANCE: 10,
  CHURCH_CITY_DISTANCE: 25,
  CHURCH_ROAD_GOLD: 2,
  // Un moulin ou une caserne bâti hors des villes, sur une route (route d'un port ou chemin d'une église) ou juste à
  // côté (à moins de 2 cases de son centre) : +20 % de production
  MILL_ROAD_DISTANCE: 2,
  MILL_ROAD_BONUS: 0.2,
  // ✝️ Croyance : chaque église en apporte (voir faith dans CHURCH_LEVELS), +50 % si elle est reliée à une route.
  // Un royaume qui a plus de Croyance qu'un voisin ennemi convertit peu à peu ses terres frontalières.
  FAITH_ROAD_BONUS: 0.5,
  FAITH_DISORGANIZED: 2,     // un royaume désorganisé (sans ville ni port fortifié) se fait convertir 2 fois plus vite
  // Croisade religieuse : une cathédrale (église de niveau 3) peut en lancer une pour 2000 pièces :
  // +1000 de Croyance pour le royaume pendant 60 s (une croisade à la fois par cathédrale)
  CRUSADE_COST: 2000,
  CRUSADE_FAITH: 1000,
  CRUSADE_TIME: 60,
  // Vitesse de la conversion selon l'écart de Croyance : [écart, secondes pour convertir une case].
  // (entre deux lignes, on passe en douceur de l'une à l'autre ; plus petit que 20 : encore plus lent ;
  //  500 d'écart : 2 cases par seconde ; 1000 : 5 par seconde ; au-delà, ça accélère de moins en moins :
  //  2000 : 7 par seconde, 3000 : 8,5, et 5000 et plus : 10 cases par seconde, le maximum)
  FAITH_PACE: [[20, 30], [100, 5], [200, 1], [500, 0.5], [1000, 0.2], [2000, 1 / 7], [3000, 1 / 8.5], [5000, 0.1]],
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
  ASSAULT_MIN_SPEED: 0.061,
  ASSAULT_TERRAIN_SLOWDOWN: 0.75, // en terrain difficile, un assaut contre un royaume ne ralentit que de 75 % de la normale
                               // (forêt x1,45 au lieu de x1,6 · colline x1,9 au lieu de x2,2 · montagne x2,35 au lieu de x2,8)     // vitesse minimum d'un assaut (cases de plaine par tour)
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
  DEFEND_COOLDOWN: 5,          // secondes à attendre entre deux envois de défenseurs contre un même assaut
  RETREAT_TIME: 3,             // une attaque annulée met 3 s à décrocher (elle peut encore se faire attaquer)...
  RETREAT_LOSS: 0.15,          // ...et perd 15 % de ses soldats dans la retraite
  REINFORCE_DELAY: 5,          // une armée alliée venue aider met 5 s à arriver
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
  REGIONS_REUSE: 5,            // (technique) tours de jeu pendant lesquels le découpage en morceaux peut servir tel quel
  // Prise d'un château : toute sa zone de défense et les bâtiments qui s'y trouvent sont pris d'un coup,
  // puis l'assaut s'arrête (les survivants rentrent).
  // Un royaume sans château (ville) peut être attaqué de front : toutes ses troupes défendent d'office,
  // mais désorganisées (sans pouvoir en place), chaque soldat ne compte que pour 0.8.
  LEADERLESS_DEFENSE: 0.8,
  // Expéditions maritimes : en débarquant, on prend les terres libres autour du point de débarquement
  LANDING_RADIUS: 4,
  // Les soldats embarqués défendent l'avant-poste ; pendant la traversée, une petite partie se perd :
  SEA_LOSS_PER_SECOND: 0.01, // 1 % des soldats par seconde de mer...
  SEA_LOSS_MAX: 0.25,        // ...au plus 25 %
  // Traversée de fleuve (clic droit sur une terre libre de l'autre côté) : l'armée passe à gué
  CROSSING_TIME_FIRST: 10,   // secondes pour traverser la 1re case de fleuve (c'est difficile !)...
  CROSSING_TIME_NEXT: 6,     // ...et chacune des suivantes (fleuve double)
  CROSSING_MAX_DISTANCE: 14, // on ne traverse que si le fleuve est à moins de 14 cases de la terre visée
  CROSSING_COOLDOWN: 10,
  FREE_LAND_CLICK_TIME: 4,   // terres libres : le 2e clic qui lance l'attaque doit venir dans les 4 secondes     // une seule traversée de fleuve toutes les 10 secondes
  CROSSING_BANK_RADIUS: 4,   // terres libres prises sur l'autre rive, autour de la case visée
  EXPEDITION_COOLDOWN: 5,    // une expédition maritime au plus toutes les 5 secondes
  REPATRIATE_SPEED: 5,       // vitesse minimum (cases/s) des bateaux qui rapatrient les soldats d'un avant-poste
  OUTPOST_BUILD_TIME: 20,    // secondes pour bâtir un avant-poste après le débarquement (sans bonus avant)
  OUTPOST_DEFENSE: 1,        // une fois bâti, bonus de défense autour de lui (comme un fort en bois)
  OUTPOST_BUILDING_MALUS: 0.2, // pendant sa construction, ses défenseurs sont occupés à bâtir : défense -0.2
  OUTPOST_SIEGE: 10,         // secondes de siège pour prendre un avant-poste (le défenseur peut encore le renforcer)
  OUTPOST_CASTLE_DISTANCE: 12, // pas de château à moins de 12 cases d'un de ses avant-postes (il faut conquérir avant)
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

const TERRAIN = { WATER: 0, PLAINS: 1, FOREST: 2, HILLS: 3, MOUNTAIN: 4, RIVER: 5, GREAT_RIVER: 6, PEAK: 7, DESERT: 8 };

const TERRAIN_INFO = [
  { name: 'Mer',      color: [52, 92, 130],   cost: Infinity },
  { name: 'Plaine',   color: [172, 186, 112], cost: 1 },
  { name: 'Forêt',    color: [92, 124, 70],   cost: 1.6 },
  { name: 'Colline',  color: [162, 146, 104], cost: 2.2 },
  { name: 'Montagne', color: [130, 124, 118], cost: 2.8 },
  // Fleuve : une frontière naturelle, longue à traverser, et un gros bonus de défense (+3)
  { name: 'Fleuve',   color: [74, 132, 184],  cost: 4 },
  // Grand fleuve (là où 3 fleuves se sont rejoints) : infranchissable, comme la mer
  { name: 'Grand fleuve', color: [58, 108, 160], cost: Infinity },
  // Sommet (le cœur des montagnes) : infranchissable
  { name: 'Sommet', color: [226, 228, 232], cost: Infinity },
  // Désert : aucune défense en plus (comme une plaine), mais les bâtiments posés dessus produisent moins
  { name: 'Désert', color: [222, 198, 134], cost: 1 },
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
  { name: 'Grand moulin', gold: 3.5, img: 'img/moulin2.webp', size: 2.8, upgradeCost: 150 },
];

// Les 3 niveaux de la caserne : troops = soldats produits toutes les PRODUCTION_INTERVAL secondes,
// maxTroops = soldats en plus dans l'armée maximum,
// power = force de TOUS les soldats du royaume au combat (1.2 = chaque soldat vaut 1,2 soldat).
// Ce bonus ne s'additionne pas : c'est la meilleure caserne du royaume qui compte.
const BARRACKS_LEVELS = [
  null,
  { name: 'Camp d\'entraînement', troops: 2, maxTroops: 25, power: 1.3, img: 'img/caserne1.webp', size: 2.5 },
  { name: 'Caserne',              troops: 4, maxTroops: 50, power: 1.8, img: 'img/caserne2.webp', size: 2.8, upgradeCost: 400 },
  { name: 'Grande caserne',       troops: 9, maxTroops: 350, power: 2.5, img: 'img/caserne3.webp', size: 3.2, upgradeCost: 2500 },
];

// Les 3 niveaux du château. Le bonus s'ajoute à la défense du terrain
// dans sa muraille (ex. forêt x1.6 + niveau 3 → x5.6).
// siege = secondes de siège : une armée ne traverse pas la muraille ; arrivée au pied du mur, elle doit
// tenir ce temps avant que le château ne tombe (avec toute la zone de sa muraille)
// (le défenseur peut encore envoyer des soldats pendant ce temps).
const CASTLE_LEVELS = [
  null,
  { name: 'Fort en bois', radius: 8,  bonus: 1, slots: 4, garrison: 10,  siege: 8,  img: 'img/chateau1.webp', size: 4.4, road: null,    roadBonus: 0 },
  { name: 'Château',      radius: 10, bonus: 2, slots: 6, garrison: 50,  siege: 13, img: 'img/chateau2.webp', size: 5,   road: 'dirt',  roadBonus: 0.2, upgradeCost: 500 },
  { name: 'Citadelle',    radius: 13, bonus: 4, slots: 9, garrison: 150, siege: 18, img: 'img/chateau3.webp', size: 5.6, road: 'paved', roadBonus: 0.5, upgradeCost: 3000 },
];
// slots = moulins et casernes qu'on peut bâtir dans sa muraille (4, 6 puis 9) ;
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
  { name: 'Église',        slots: 1, castles: 0, faith: 10, radius: 7,  img: 'img/eglise1.webp', size: 2.6 },
  { name: 'Grande église', slots: 2, castles: 1, faith: 30, radius: 8,  img: 'img/eglise2.webp', size: 3,   upgradeCost: 800 },
  { name: 'Cathédrale',    slots: 5, castles: 2, faith: 50, radius: 10, img: 'img/eglise3.webp', size: 3.4, upgradeCost: 2000 },
];

// Les 3 niveaux du port. Il se construit au bord de la mer ou d'un fleuve, n'est pas défendu
// (on peut l'attaquer directement, comme un château) et produit de l'or toutes les PRODUCTION_INTERVAL s.
// boatSpeed = vitesse des bateaux d'expédition (cases par seconde ; 0 = pas d'expédition),
// landingCost = prix d'un débarquement (x1 = normal, x0.5 = moitié prix).
const PORT_LEVELS = [
  null,
  { name: 'Port',       gold: 3,  boatSpeed: 0, slots: 0, img: 'img/port1.webp', size: 3 },
  { name: 'Grand port', gold: 9,  boatSpeed: 5, landingCost: 1,   slots: 1, radius: 7, img: 'img/port2.webp', size: 3.4, upgradeCost: 500 },
  { name: 'Port royal', gold: 20, boatSpeed: 9, landingCost: 0.5, slots: 3, radius: 8, img: 'img/port3.webp', size: 3.8, upgradeCost: 2000, garrison: 10, bonus: 1 },
];
// slots / radius = comme l'église : moulins ou casernes qu'on peut construire autour du port
// garrison = petite garnison qui défend le port royal (comme un fort en bois), et se reconstitue
// bonus = défense en plus dans sa petite muraille (sa zone), comme un fort en bois

// Production des moulins, casernes et ports selon le terrain où ils sont construits
// (moyenne des cases qu'ils occupent). Ordre : mer, plaine, forêt, colline, montagne, fleuve, grand fleuve, sommet, désert.
// Dans le désert, tout bâtiment produit DESERT_PRODUCTION (0.8 = -20 %).
const DESERT_PRODUCTION = 0.8;
const TERRAIN_PRODUCTION = {
  [B_MILL]:     [0, 1.3, 1.0, 0.9, 0.7, 0, 0, 0, DESERT_PRODUCTION], // les moulins aiment les plaines
  [B_BARRACKS]: [0, 1.0, 1.3, 1.3, 0.9, 0, 0, 0, DESERT_PRODUCTION], // les casernes, les forêts et les collines
  [B_PORT]:     [0, 1.0, 1.0, 1.0, 1.0, 0, 0, 0, DESERT_PRODUCTION], // le port : seul le désert compte
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
  facile:    { bots: 5,  aggression: [0.6, 0.85], hateHuman: 0,    zeal: 0.5 },
  normal:    { bots: 7,  aggression: [0.45, 0.7], hateHuman: 0.1,  zeal: 1 },
  difficile: { bots: 10, aggression: [0.3, 0.55], hateHuman: 0.25, zeal: 2 },
};
