// 🎲 LOGIQUE DU JEU
// Les royaumes, l'économie, les attaques et la victoire.

const Game = {
  phase: 'menu', // 'menu' → 'spawn' → 'playing' → 'over'
  paused: false,

  init(opts) {
    const map = generateMap((Math.random() * 1e9) | 0);
    this.map = map;
    this.W = map.W; this.H = map.H; this.N = map.N;
    this.terrain = map.terrain;
    this.owner = new Int16Array(this.N).fill(-1);
    this.building = new Uint8Array(this.N);
    this.level = new Uint8Array(this.N); // niveau des châteaux (1 à 3), sur la case d'ancrage
    this.garrison = new Float32Array(this.N); // garnison actuelle des châteaux (case d'ancrage)
    // Un bâtiment occupe un carré de cases (2x2, ou 4x4 pour le château).
    // anchor[i] = case en haut à gauche du bâtiment (-1 si aucun)
    this.anchor = new Int32Array(this.N).fill(-1);
    this.players = [];
    this.attacks = [];
    this.nextAttackId = 1;
    this.pacts = new Map(); // id du pacte → { name }
    this.nextPactId = 0;
    this.buildingTiles = [];
    this.castles = [];
    this.tick = 0;
    this.version = 0; // augmente à chaque changement de la carte
    this.roadsVersion = -1;
    this.regionsVersion = -1;
    this.landCount = 0;
    for (let i = 0; i < this.N; i++) if (this.isLand(i)) this.landCount++;

    this.difficulty = DIFFICULTIES[opts.difficulty];
    this.human = this.addPlayer(opts.name, opts.banner, true);
    const names = KINGDOMS.slice().sort(() => Math.random() - 0.5);
    // Les bots reçoivent au hasard les bannières que le joueur n'a pas prises
    const banners = BANNERS.map((b, k) => k).filter(k => k !== opts.banner).sort(() => Math.random() - 0.5);
    for (let k = 0; k < this.difficulty.bots && k < names.length && k < banners.length; k++) {
      this.addPlayer(names[k], banners[k], false);
    }
    this.phase = 'spawn';
  },

  addPlayer(name, banner, isHuman) {
    const [lo, hi] = this.difficulty.aggression;
    const p = {
      id: this.players.length, name, isHuman,
      banner,                        // numéro de la bannière (BANNERS)
      color: BANNERS[banner].color,  // la couleur du royaume vient de sa bannière
      alive: true, troops: CONFIG.START_TROOPS, gold: CONFIG.START_GOLD,
      tiles: 0, sumX: 0, sumY: 0, maxTiles: 0, kills: 0,
      bCount: [0, 0, 0, 0, 0],
      traitorUntil: 0,
      pact: -1,         // pacte (groupe d'alliés) dont fait partie ce royaume, -1 = aucun
      castlesBuilt: 0,  // châteaux construits dans la partie (capitale comprise), limité à MAX_CASTLES
      refusedUntil: {}, // royaume id → tick avant lequel on ne peut pas redemander
      aiTimer: Math.floor(Math.random() * 20),
      aggression: lo + Math.random() * (hi - lo),
    };
    this.players.push(p);
    return p;
  },

  // --- Outils sur les cases ---
  // Terre = tout sauf la mer et les grands fleuves (infranchissables)
  isLand(i) { return this.terrain[i] !== TERRAIN.WATER && this.terrain[i] !== TERRAIN.GREAT_RIVER; },

  forNeighbors(i, cb) {
    const x = i % this.W, y = (i / this.W) | 0;
    if (x > 0) cb(i - 1);
    if (x < this.W - 1) cb(i + 1);
    if (y > 0) cb(i - this.W);
    if (y < this.H - 1) cb(i + this.W);
  },

  hasNeighborOwnedBy(i, pid) {
    let found = false;
    this.forNeighbors(i, n => { if (this.owner[n] === pid) found = true; });
    return found;
  },

  // Un royaume « ami » : soi-même ou un allié du même pacte
  isFriend(pid, o) { return o === pid || (o >= 0 && this.areAllied(pid, o)); },

  // La case touche-t-elle notre territoire ou celui d'un allié du pacte ?
  // (on peut attaquer depuis les terres de ses alliés, même sans être voisin soi-même)
  // Un petit morceau coupé du royaume (un château isolé) ne compte pas : aucune armée ne peut partir de là.
  touchesFriend(i, pid) {
    let found = false;
    this.forNeighbors(i, n => {
      if (!found && this.isFriend(pid, this.owner[n]) && this.isBase(n)) found = true;
    });
    return found;
  },

  countFriendNeighbors(i, pid) {
    let c = 0;
    this.forNeighbors(i, n => { if (this.isFriend(pid, this.owner[n])) c++; });
    return c;
  },

  countNeighborsOwnedBy(i, pid) {
    let c = 0;
    this.forNeighbors(i, n => { if (this.owner[n] === pid) c++; });
    return c;
  },

  setOwner(i, pid) {
    const old = this.owner[i];
    if (old === pid) return;
    const x = i % this.W, y = (i / this.W) | 0;
    // Un bâtiment n'est compté qu'une fois : sur sa case d'ancrage
    const b = this.anchor[i] === i ? this.building[i] : 0;
    if (b === B_CASTLE) this.garrison[i] = 0; // château pris : sa garnison est perdue
    if (old >= 0) {
      const o = this.players[old];
      o.tiles--; o.sumX -= x; o.sumY -= y;
      if (b) o.bCount[b]--;
    }
    this.owner[i] = pid;
    this.version++;
    if (pid >= 0) {
      const p = this.players[pid];
      p.tiles++; p.sumX += x; p.sumY += y;
      if (b) p.bCount[b]++;
      if (p.tiles > p.maxTiles) p.maxTiles = p.tiles;
    }
    Render.markDirty(i);
    // Prendre une case d'un bâtiment, c'est prendre tout le bâtiment
    if (this.building[i]) {
      const a = this.anchor[i];
      for (const j of this.footprint(a, this.building[a])) if (this.owner[j] !== pid) this.setOwner(j, pid);
    }
    if (old >= 0 && this.players[old].tiles === 0) this.eliminate(old, pid);
  },

  // Côté du carré occupé par un type de bâtiment
  sizeOf(type) { return BUILDINGS[type].tiles; },

  // Les cases d'un bâtiment de ce type dont "a" est la case en haut à gauche
  footprint(a, type) {
    const n = this.sizeOf(type), cells = [];
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) cells.push(a + dy * this.W + dx);
    return cells;
  },

  // Peut-on poser ce bâtiment avec "a" en haut à gauche ?
  canPlace(pid, a, type) {
    const n = this.sizeOf(type);
    if (a < 0 || a % this.W > this.W - n || ((a / this.W) | 0) > this.H - n) return false;
    return this.footprint(a, type).every(j => this.owner[j] === pid && this.isLand(j) && !this.building[j]
      && this.terrain[j] !== TERRAIN.RIVER)
      && this.insideWalls(pid, a, type) && !this.tooCloseToBuilding(a, type)
      && !this.churchCastleConflict(pid, a, type);
  },

  // Une église doit rester assez loin des châteaux de son royaume pour ne jamais se retrouver dans
  // leur muraille, même améliorée (la plus grande muraille possible). Et inversement : pas de nouveau
  // château trop près d'une de ses églises.
  churchCastleRange() { return CASTLE_LEVELS[CASTLE_LEVELS.length - 1].radius; },

  churchCastleConflict(pid, a, type) {
    const R = this.churchCastleRange(), W = this.W;
    const inRange = (c, cells) => cells.some(j => this.inCastleRange(c, j % W, (j / W) | 0, R));
    if (type === B_CHURCH) {
      const cells = this.footprint(a, type);
      return this.castles.some(c => this.owner[c] === pid && inRange(c, cells));
    }
    if (type === B_CASTLE) {
      return this.churchesOf(pid).some(ch => inRange(a, this.footprint(ch, B_CHURCH)));
    }
    return false;
  },

  // Moulins et casernes se construisent dans l'enceinte d'un de ses châteaux, ou près d'une de ses
  // églises qui a encore de la place (pas ailleurs dans l'arrière-pays).
  // Les châteaux et les églises se construisent partout sur son territoire
  // (mais une église reste loin des châteaux : voir churchCastleConflict).
  insideWalls(pid, a, type) {
    if (type === B_CASTLE || type === B_CHURCH) return true;
    return this.footprint(a, type).every(j => this.castleProtects(pid, j)) || this.churchFor(pid, a, type) >= 0;
  },

  // --- Églises ---
  // La case i est-elle à moins de R cases du centre de l'église ch ?
  inChurchRange(ch, i, R) {
    const half = (this.sizeOf(B_CHURCH) - 1) / 2;
    const dx = ch % this.W + half - i % this.W, dy = ((ch / this.W) | 0) + half - ((i / this.W) | 0);
    return dx * dx + dy * dy <= R * R;
  },

  // Terres du royaume autour de l'église ch, où elle permet de construire
  churchZone(ch) {
    const o = this.owner[ch], R = this.buildingInfo(ch).radius, zone = [];
    const cx = ch % this.W, cy = (ch / this.W) | 0;
    for (let y = Math.max(0, cy - R); y <= Math.min(this.H - 1, cy + R + 1); y++) {
      for (let x = Math.max(0, cx - R); x <= Math.min(this.W - 1, cx + R + 1); x++) {
        const i = y * this.W + x;
        if (this.owner[i] === o && this.inChurchRange(ch, i, R)) zone.push(i);
      }
    }
    return zone;
  },

  // Nombre de moulins et casernes déjà construits grâce à l'église ch
  // (ceux de son royaume dans sa zone, hors de la muraille d'un château)
  churchUsed(ch) {
    const o = this.owner[ch], R = this.buildingInfo(ch).radius;
    let n = 0;
    for (const b of this.buildingTiles) {
      const t = this.building[b];
      if ((t !== B_MILL && t !== B_BARRACKS) || this.owner[b] !== o) continue;
      const cells = this.footprint(b, t);
      if (!cells.every(j => this.inChurchRange(ch, j, R))) continue;
      if (cells.every(j => this.castleProtects(o, j))) continue;
      n++;
    }
    return n;
  },

  // Une église du royaume qui accepte ce bâtiment (il est dans sa zone et elle a de la place), ou -1
  churchFor(pid, a, type) {
    const cells = this.footprint(a, type);
    for (const ch of this.buildingTiles) {
      if (this.building[ch] !== B_CHURCH || this.owner[ch] !== pid) continue;
      const info = this.buildingInfo(ch);
      if (cells.every(j => this.inChurchRange(ch, j, info.radius)) && this.churchUsed(ch) < info.slots) return ch;
    }
    return -1;
  },

  // Châteaux qu'un royaume peut construire dans la partie : MAX_CASTLES, plus ceux de chacune de ses églises
  // (elles s'additionnent : autant d'églises améliorées qu'on peut se payer)
  maxCastles(p) {
    let extra = 0;
    for (const ch of this.buildingTiles) {
      if (this.building[ch] === B_CHURCH && this.owner[ch] === p.id) extra += this.buildingInfo(ch).castles;
    }
    return CONFIG.MAX_CASTLES + extra;
  },

  churchesOf(pid) { return this.buildingTiles.filter(a => this.building[a] === B_CHURCH && this.owner[a] === pid); },

  // Écart obligatoire entre deux bâtiments : CASTLE_SPACING si l'un des deux est un château,
  // sinon BUILDING_SPACING (une zone invisible autour de chaque bâtiment)
  spacingBetween(t1, t2) {
    return t1 === B_CASTLE || t2 === B_CASTLE ? CONFIG.CASTLE_SPACING : CONFIG.BUILDING_SPACING;
  },

  // Renvoie l'écart manquant (en cases) si un bâtiment est trop près de cet emplacement, sinon 0
  tooCloseToBuilding(a, type) {
    const n = this.sizeOf(type), m = Math.max(CONFIG.BUILDING_SPACING, CONFIG.CASTLE_SPACING);
    const x0 = a % this.W, y0 = (a / this.W) | 0;
    for (let y = Math.max(0, y0 - m); y <= Math.min(this.H - 1, y0 + n - 1 + m); y++) {
      for (let x = Math.max(0, x0 - m); x <= Math.min(this.W - 1, x0 + n - 1 + m); x++) {
        const t = this.building[y * this.W + x];
        if (!t) continue;
        // nombre de cases vides entre cette case de bâtiment et l'emplacement
        const gap = Math.max(x0 - x - 1, x - (x0 + n), y0 - y - 1, y - (y0 + n));
        const need = this.spacingBetween(type, t);
        if (gap < need) return need;
      }
    }
    return 0;
  },

  placeBuilding(i, type) {
    this.version++;
    for (const j of this.footprint(i, type)) {
      this.building[j] = type;
      this.anchor[j] = i;
    }
    const o = this.owner[i];
    if (o >= 0) this.players[o].bCount[type]++;
    this.buildingTiles.push(i);
    this.level[i] = 1;
    if (type === B_CASTLE) {
      this.castles.push(i);
      this.garrison[i] = CASTLE_LEVELS[1].garrison; // un château neuf a sa garnison complète
    }
  },

  // Infos du niveau actuel d'un bâtiment (null s'il n'a pas de niveaux)
  buildingInfo(a) {
    const levels = BUILDING_LEVELS[this.building[a]];
    return levels ? levels[this.level[a] || 1] : null;
  },

  castleInfo(c) { return CASTLE_LEVELS[this.level[c] || 1]; },

  // Prix pour passer au niveau suivant (null si impossible)
  upgradeCost(a) {
    const levels = BUILDING_LEVELS[this.building[a]];
    const next = levels && levels[this.level[a] + 1];
    return next ? next.upgradeCost : null;
  },

  // Améliore un bâtiment. Renvoie un message d'erreur, ou null si c'est fait.
  upgradeBuilding(p, a) {
    if (!this.building[a] || this.owner[a] !== p.id) return 'Ce n\'est pas un de tes bâtiments.';
    const cost = this.upgradeCost(a);
    if (cost === null) return 'Ce bâtiment est déjà au niveau maximum.';
    if (p.gold < cost) return `Pas assez d'or (${cost} nécessaires).`;
    p.gold -= cost;
    this.level[a]++;
    this.version++;
    return null;
  },

  // Cases protégées par un château : celles de son royaume, dans son rayon.
  // "level" permet de prévisualiser un autre niveau.
  castleZone(c, pid, level, extra = 0) {
    const R = CASTLE_LEVELS[level || this.level[c] || 1].radius + extra;
    const cx = c % this.W, cy = (c / this.W) | 0, zone = [];
    const n = this.sizeOf(B_CASTLE);
    for (let y = Math.max(0, cy - R); y <= Math.min(this.H - 1, cy + R + n); y++) {
      for (let x = Math.max(0, cx - R); x <= Math.min(this.W - 1, cx + R + n); x++) {
        const i = y * this.W + x;
        if (this.inCastleRange(c, x, y, R) && this.owner[i] === pid) zone.push(i);
      }
    }
    return zone;
  },

  // La case (x, y) est-elle à moins de R du centre du château (milieu de son carré) ?
  inCastleRange(c, x, y, R) {
    const half = (this.sizeOf(B_CASTLE) - 1) / 2;
    const dx = (c % this.W) + half - x, dy = ((c / this.W) | 0) + half - y;
    return dx * dx + dy * dy <= R * R;
  },

  // Défense d'une case = celle du terrain, + le bonus du meilleur château qui la protège
  tileDefense(pid, i) {
    return TERRAIN_INFO[this.terrain[i]].cost + (pid >= 0 ? this.castleBonus(pid, i) : 0);
  },

  // Bonus de défense des châteaux du royaume sur cette case (0 si aucun ne la protège)
  castleBonus(pid, i) {
    const x = i % this.W, y = (i / this.W) | 0;
    let best = 0;
    for (const c of this.castles) {
      if (this.owner[c] !== pid) continue;
      const info = this.castleInfo(c);
      if (info.bonus > best && this.inCastleRange(c, x, y, info.radius)) best = info.bonus;
    }
    return best;
  },

  castleProtects(pid, i) { return this.castleBonus(pid, i) > 0; },

  // --- Apparition des royaumes ---
  canSpawnAt(i, minDist) {
    if (!this.isLand(i) || this.terrain[i] === TERRAIN.RIVER || this.owner[i] !== -1) return false;
    const x = i % this.W, y = (i / this.W) | 0;
    for (const p of this.players) {
      if (p.capital === undefined) continue;
      const dx = (p.capital % this.W) - x, dy = ((p.capital / this.W) | 0) - y;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }
    return true;
  },

  spawnPlayer(p, center) {
    const r = CONFIG.START_RADIUS;
    const cx = center % this.W, cy = (center / this.W) | 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 1) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.W || y >= this.H) continue;
        const i = y * this.W + x;
        if (this.isLand(i) && this.owner[i] === -1) this.setOwner(i, p.id);
      }
    }
    p.capital = center;
    // La capitale est un château gratuit : on cherche la place de son carré au plus près
    // du centre (sur la terre, libre ou à soi ; les cases libres sont alors prises)
    const n = this.sizeOf(B_CASTLE), half = (n - 1) / 2;
    const fits = a => this.footprint(a, B_CASTLE).every(j =>
      this.isLand(j) && this.terrain[j] !== TERRAIN.RIVER && !this.building[j] && (this.owner[j] === p.id || this.owner[j] === -1));
    let best = -1, bestDist = Infinity;
    for (let dy = -r - n; dy <= r; dy++) {
      for (let dx = -r - n; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy, d = (dx + half) ** 2 + (dy + half) ** 2;
        if (x < 0 || y < 0 || x > this.W - n || y > this.H - n || d >= bestDist) continue;
        if (fits(y * this.W + x)) { best = y * this.W + x; bestDist = d; }
      }
    }
    if (best >= 0) {
      for (const j of this.footprint(best, B_CASTLE)) if (this.owner[j] === -1) this.setOwner(j, p.id);
      p.castlesBuilt++;
      this.placeBuilding(best, B_CASTLE);
      p.capital = best;
    }
  },

  startGame(humanTile) {
    this.spawnPlayer(this.human, humanTile);
    for (const p of this.players) {
      if (p.isHuman) continue;
      let placed = false;
      for (let tries = 0; tries < 3000 && !placed; tries++) {
        const i = (Math.random() * this.N) | 0;
        const minDist = CONFIG.MIN_SPAWN_DISTANCE * (tries < 1500 ? 1 : 0.5);
        if (this.canSpawnAt(i, minDist)) { this.spawnPlayer(p, i); placed = true; }
      }
      if (!placed) p.alive = false;
    }
    this.phase = 'playing';
  },

  // --- Économie ---
  // Il y a deux sortes de revenus :
  //  - le revenu de base, continu, qui dépend de la taille du territoire ;
  //  - la production des moulins et casernes, versée d'un coup toutes les PRODUCTION_INTERVAL secondes.

  // Somme d'une valeur (ex. "maxTroops") sur tous les bâtiments d'un type d'un royaume,
  // selon leur niveau
  levelSum(p, type, key) {
    let sum = 0;
    for (const a of this.buildingTiles) {
      if (this.building[a] === type && this.owner[a] === p.id) sum += this.buildingInfo(a)[key];
    }
    return sum;
  },

  // Ce que produit un moulin (or) ou une caserne (soldats) à chaque versement,
  // avec les bonus de route et de terrain
  buildingOutput(a) {
    const t = this.building[a], info = this.buildingInfo(a);
    const v = t === B_MILL ? info.gold : info.troops;
    const road = this.roads().get(a);
    return v * (1 + (road ? road.bonus : 0)) * this.terrainFactor(a, t);
  },

  // Versement de la production des moulins et casernes. Chaque bâtiment a son propre moment
  // (selon sa place sur la carte), pour que tout n'arrive pas en même temps.
  produce() {
    const period = CONFIG.PRODUCTION_INTERVAL * CONFIG.TICKS_PER_SECOND;
    for (const a of this.buildingTiles) {
      const t = this.building[a];
      if (t !== B_MILL && t !== B_BARRACKS) continue;
      if ((this.tick + a * 7) % period !== 0) continue;
      const p = this.players[this.owner[a]];
      if (!p || !p.alive) continue;
      const amount = this.buildingOutput(a);
      let shown = amount;
      if (t === B_MILL) p.gold += amount;
      else {
        // une caserne ne fait pas dépasser l'armée maximum
        shown = Math.max(0, Math.min(amount, this.maxTroops(p) - p.troops));
        p.troops += shown;
      }
      // Le joueur ne voit que la production de ses propres bâtiments
      if (p.isHuman && shown >= 0.5) Render.floatText(a, t, `+${Math.round(shown)} ${t === B_MILL ? '💰' : '⚔️'}`);
    }
  },

  // Multiplicateur de production selon le terrain sous le bâtiment (moyenne de ses cases)
  terrainFactor(a, type) {
    const table = TERRAIN_PRODUCTION[type];
    if (!table) return 1;
    const cells = this.footprint(a, type);
    return cells.reduce((s, j) => s + table[this.terrain[j]], 0) / cells.length;
  },

  // --- Routes ---
  // Un château de niveau 2 ou 3 relie par une route les moulins et casernes de son royaume
  // qui sont dans sa muraille. Renvoie une Map : bâtiment → { castle, bonus, road }.
  // Recalculé seulement quand la carte change.
  roads() {
    if (this.roadsVersion === this.version) return this.roadsCache;
    const links = new Map();
    for (const c of this.castles) {
      const o = this.owner[c], info = this.castleInfo(c);
      if (o < 0 || !info.road) continue;
      for (const a of this.buildingTiles) {
        const t = this.building[a];
        if ((t !== B_MILL && t !== B_BARRACKS) || this.owner[a] !== o) continue;
        const half = (this.sizeOf(t) - 1) / 2; // centre du bâtiment
        if (!this.inCastleRange(c, a % this.W + half, ((a / this.W) | 0) + half, info.radius)) continue;
        const best = links.get(a);
        if (!best || info.roadBonus > best.bonus) links.set(a, { castle: c, bonus: info.roadBonus, road: info.road });
      }
    }
    this.roadsCache = links;
    this.roadsVersion = this.version;
    return links;
  },

  maxTroops(p) {
    return CONFIG.BASE_MAX_TROOPS + p.tiles * CONFIG.MAX_TROOPS_PER_TILE
      + this.levelSum(p, B_BARRACKS, 'maxTroops');
  },

  troopRate(p) {
    const max = this.maxTroops(p);
    if (p.troops >= max) return 0;
    const base = CONFIG.BASE_TROOP_GROWTH + p.tiles * CONFIG.TROOP_GROWTH_PER_TILE;
    return base * this.growthFactor(p.troops / max);
  },

  // Multiplicateur de recrutement selon le remplissage r (0 = vide, 1 = plein) :
  // il monte jusqu'au remplissage idéal, puis redescend jusqu'à 0 au maximum.
  growthFactor(r) {
    const peak = CONFIG.TROOP_PEAK_RATIO, lo = CONFIG.TROOP_GROWTH_AT_ZERO, hi = CONFIG.TROOP_GROWTH_AT_PEAK;
    if (r <= peak) return lo + (hi - lo) * (r / peak);
    return hi * Math.max(0, (1 - r) / (1 - peak));
  },

  goldRate(p) {
    return CONFIG.BASE_GOLD + p.tiles * CONFIG.GOLD_PER_TILE;
  },

  buildCost(p, type) {
    return Math.round(BUILDINGS[type].baseCost * Math.pow(CONFIG.BUILDING_COST_GROWTH, p.bCount[type]));
  },

  // Renvoie un message d'erreur, ou null si la construction a réussi.
  // i = case en haut à gauche du bâtiment (2x2 cases)
  tryBuild(p, i, type) {
    if (type === B_CASTLE && p.castlesBuilt >= this.maxCastles(p)) {
      return `Tu as déjà construit ${this.maxCastles(p)} châteaux : c'est le maximum pour l'instant ` +
        '(prends-en à l\'ennemi, ou améliore une église pour en débloquer).';
    }
    if (!this.canPlace(p.id, i, type)) {
      const n = this.sizeOf(type);
      if (i >= 0 && this.owner[i] === p.id && !this.insideWalls(p.id, i, type)) {
        return `${BUILDINGS[type].name} : à construire dans l'enceinte d'un de tes châteaux, ou près d'une de tes églises ` +
          'qui a encore de la place (pas ailleurs dans l\'arrière-pays).';
      }
      if (i >= 0 && this.owner[i] === p.id && this.churchCastleConflict(p.id, i, type)) {
        return type === B_CHURCH
          ? 'Trop près d\'un de tes châteaux : une église doit rester hors de portée de sa muraille, même améliorée (cercle rouge).'
          : 'Trop près d\'une de tes églises : la muraille de ce château pourrait l\'englober (cercle rouge).';
      }
      if (i >= 0 && this.tooCloseToBuilding(i, type)) {
        return `Trop près d'un autre bâtiment : il faut ${this.tooCloseToBuilding(i, type)} cases d'écart.`;
      }
      return `Il faut ${n}x${n} cases libres sur ton territoire (pas de mer).`;
    }
    const cost = this.buildCost(p, type);
    if (p.gold < cost) return `Pas assez d'or (${cost} nécessaires).`;
    p.gold -= cost;
    if (type === B_CASTLE) p.castlesBuilt++;
    this.placeBuilding(i, type);
    return null;
  },

  // --- Morceaux de territoire ---
  // Découpe la carte en « morceaux » : des cases d'un même royaume qui se touchent.
  // Le plus grand morceau d'un royaume est son cœur ; les autres sont coupés de lui.
  // Recalculé seulement quand la carte change.
  regions() {
    if (this.regionsVersion === this.version) return this.regionsCache;
    const comp = new Int32Array(this.N).fill(-1), order = new Int32Array(this.N);
    const size = [], start = [], owner = [];
    const main = new Array(this.players.length).fill(-1); // royaume → son plus grand morceau
    let n = 0;
    for (let i = 0; i < this.N; i++) {
      const o = this.owner[i];
      if (o < 0 || comp[i] >= 0) continue;
      // Nouveau morceau : on le parcourt de proche en proche
      const k = size.length, s = n;
      comp[i] = k;
      order[n++] = i;
      for (let q = s; q < n; q++) {
        this.forNeighbors(order[q], j => {
          if (comp[j] < 0 && this.owner[j] === o) { comp[j] = k; order[n++] = j; }
        });
      }
      size.push(n - s); start.push(s); owner.push(o);
      if (main[o] < 0 || size[k] > size[main[o]]) main[o] = k;
    }
    this.regionsCache = { comp, order, size, start, owner, main };
    this.regionsVersion = this.version;
    return this.regionsCache;
  },

  // Château coupé du cœur de son royaume : ses renforts ne peuvent plus le rejoindre
  isIsolatedCastle(c) {
    const o = this.owner[c];
    if (o < 0) return false;
    const r = this.regions();
    return r.comp[c] !== r.main[o];
  },

  // Une armée peut-elle partir de cette case ? Oui si elle est dans le cœur de son royaume
  // (ou dans un grand morceau), pas si elle est dans un petit morceau coupé du reste.
  isBase(i) {
    const o = this.owner[i];
    if (o < 0) return false;
    const r = this.regions(), k = r.comp[i];
    return k === r.main[o] || r.size[k] >= this.players[o].tiles * CONFIG.ENCLAVE_RATIO;
  },

  // Le royaume a-t-il encore un château ou une église ? Alors on ne peut l'attaquer qu'en visant
  // l'un d'eux. Sinon, on peut attaquer tout son territoire de front.
  isProtected(pid) {
    return this.castlesOf(pid).length > 0 || this.churchesOf(pid).length > 0;
  },

  // Encerclement : un assaut de pid a peut-être coupé le royaume target en morceaux.
  // Chaque petit morceau (moins de ENCLAVE_RATIO de son territoire) qui touche pid est pris d'un coup.
  // Les châteaux qui s'y trouvent restent au défenseur, avec les terres dans leur muraille
  // (et leurs moulins et casernes, qui continuent de produire) : ils tiennent seuls, isolés.
  captureEnclaves(pid, target) {
    const T = this.players[target], A = this.players[pid];
    if (!T.alive || !A.alive) return;
    const r = this.regions(), pieces = [];
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] !== target || k === r.main[target] || r.size[k] >= T.tiles * CONFIG.ENCLAVE_RATIO) continue;
      const tiles = Array.from(r.order.subarray(r.start[k], r.start[k] + r.size[k]));
      if (tiles.some(i => this.hasNeighborOwnedBy(i, pid))) pieces.push(tiles);
    }
    let taken = 0, castles = 0;
    for (const tiles of pieces) {
      // Les châteaux de ce morceau, et ce qui est dans leur muraille, restent au défenseur
      const keep = tiles.filter(i => this.building[i] === B_CASTLE && this.anchor[i] === i);
      const walled = i => keep.some(c => this.inCastleRange(c, i % this.W, (i / this.W) | 0, this.castleInfo(c).radius));
      let took = 0;
      for (const i of tiles) {
        if (this.owner[i] !== target || this.building[i] === B_CASTLE || walled(i)) continue;
        // un bâtiment à cheval sur la muraille reste au défenseur
        if (this.building[i] && this.footprint(this.anchor[i], this.building[i]).some(walled)) continue;
        this.setOwner(i, pid);
        took++;
      }
      if (took) { taken += took; castles += keep.length; }
    }
    if (!taken) return;
    const castleTxt = castles ? (castles > 1 ? ' Ses châteaux, eux, tiennent encore, isolés.' : ' Son château, lui, tient encore, isolé.') : '';
    if (A.isHuman) UI.log(`✂️ Tu as encerclé des terres de ${T.name} : elles sont à toi !${castleTxt}`, 'good', T);
    else if (T.isHuman) {
      UI.log(`✂️ ${A.name} a coupé une partie de ton royaume : elle est perdue !` +
        (castles ? ' Ton château isolé tient encore : clique dessus pour lancer un assaut qui le relie à ton royaume.' : ''), 'warn', A);
    }
  },

  // --- Attaques ---
  buildFrontier(pid, target) {
    const list = [];
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] === target && this.isLand(i) && this.touchesFriend(i, pid)) list.push(i);
    }
    return list;
  },

  // target = -1 pour les terres libres. aimTile = case visée (pour la flèche sur la carte).
  // waypoints = points de passage de l'armée (assaut sur un château ou une église).
  // Renvoie un message d'erreur, ou null.
  launchAttack(pid, target, troops, aimTile, waypoints) {
    const p = this.players[pid];
    troops = Math.floor(Math.min(troops, p.troops));
    if (target === pid) return null;
    if (target >= 0 && this.areAllied(pid, target)) {
      return `${this.players[target].name} est ton allié ! Romps l'alliance d'abord.`;
    }
    if (troops < 1) return 'Pas assez de soldats !';
    const frontier = this.buildFrontier(pid, target);
    if (frontier.length === 0) {
      return target < 0 ? 'Aucune terre libre à ta frontière.' : `Tu n'as pas de frontière avec ${this.players[target].name}.`;
    }
    // Un royaume qui a encore un château ou une église ne s'attaque qu'en visant l'un d'eux.
    // Sans château ni église, on peut attaquer tout son territoire de front (comme une terre libre).
    // castle = château ou église visé par l'assaut
    let castle = -1, path = null;
    if (target >= 0 && this.isProtected(target)) {
      const name = this.players[target].name, b = aimTile !== undefined ? this.building[aimTile] : 0;
      if ((b === B_CASTLE || b === B_CHURCH) && this.owner[aimTile] === target) castle = this.anchor[aimTile];
      if (castle < 0) {
        return `${name} est protégé : clique sur un de ses châteaux ou une de ses églises pour lancer un assaut.`;
      }
    }
    let a = this.attacks.find(a => !a.done && a.attacker === pid && a.target === target && a.link === undefined);
    if (a && a.targetCastle !== castle) return `Un assaut contre ${this.players[target].name} est déjà en cours.`;
    // Assaut déjà en préparation : il garde ses points de passage
    if (!waypoints) waypoints = a && a.waypoints ? a.waypoints : [];
    if (castle >= 0) {
      const name = this.players[target].name;
      path = this.castlePath(pid, castle, waypoints);
      if (!path) {
        return `Impossible d'atteindre ${this.building[castle] === B_CHURCH ? 'cette église' : 'ce château'} : ` +
          `des fortifications ${this.deName(name)} bloquent le passage. Prends d'abord les châteaux de la frontière.`;
      }
    }
    // Assaut déjà lancé : les renforts partent et arrivent dans REINFORCE_DELAY secondes
    if (a && target >= 0 && !this.isPreparing(a)) {
      p.troops -= troops;
      a.pending.push({ troops, tick: this.tick + CONFIG.REINFORCE_DELAY * CONFIG.TICKS_PER_SECOND });
      return null;
    }
    if (!a) {
      a = {
        id: this.nextAttackId++, attacker: pid, target, troops: 0, done: false, startTick: this.tick,
        targetCastle: castle,
        waypoints,     // points de passage choisis
        defenders: 0,  // soldats envoyés par le défenseur pour contrer cet assaut
        pending: [],   // renforts en route : { troops, tick d'arrivée }
        frontTile: -1, // case où se trouve l'assaut (pour la défense du terrain)
      };
      if (target >= 0) {
        // Contre un royaume, l'armée se prépare d'abord : tout le monde la voit venir
        a.startTick = this.tick + CONFIG.ATTACK_PREP_TIME * CONFIG.TICKS_PER_SECOND;
        a.prepTicks = a.startTick - this.tick;
        this.aimArrow(a, frontier, aimTile);
        if (this.players[target].isHuman) {
          UI.log(`⚠️ ${p.name} prépare un assaut contre toi (${fmt(troops)} soldats) ! ` +
            (castle < 0 ? 'Sans château ni église, toutes tes troupes défendront d\'office, désorganisées.'
              : 'Clique sur sa bannière ou sur « Défendre » pour envoyer tes soldats.'), 'warn', p);
        }
      }
      this.attacks.push(a);
    }
    a.list = frontier;
    a.set = new Set(frontier);
    if (castle >= 0 && !a.castleTaken) {
      a.limitZone = this.corridor(castle, path);
      if (a.frontTile < 0 || this.owner[a.frontTile] !== target) a.frontTile = path[0]; // on se bat au début du chemin
    }
    p.troops -= troops;
    a.troops += troops;
    return null;
  },

  // « de Bourgogne » mais « d'Aragon »
  deName(name) { return (/^[AEIOUÉÈÊÂÎÔY]/i.test(name) ? "d'" : 'de ') + name; },

  castlesOf(pid) { return this.castles.filter(c => this.owner[c] === pid); },

  // Pour un assaut sur le château (ou l'église) c : peut-on passer par cette case ? Oui si elle est au
  // défenseur et n'est pas protégée par un de ses AUTRES châteaux (la zone du château visé, elle, se traverse).
  castlePassable(c) {
    const target = this.owner[c], isCastle = this.building[c] === B_CASTLE;
    const R = isCastle ? this.castleInfo(c).radius : 0;
    const others = this.castles.filter(o => o !== c && this.owner[o] === target);
    return i => {
      if (this.owner[i] !== target) return false;
      const x = i % this.W, y = (i / this.W) | 0;
      if (isCastle && this.inCastleRange(c, x, y, R)) return true;
      if (this.anchor[i] === c) return true; // le bâtiment visé lui-même
      return !others.some(o => this.inCastleRange(o, x, y, this.castleInfo(o).radius));
    };
  },

  // Chemin le plus court de la frontière de pid jusqu'au château c, en contournant les
  // autres fortifications du défenseur. Renvoie la liste des cases, ou null s'il n'y en a pas.
  // Le chemin préfère les terrains faciles (plaines) : chaque case « coûte » sa défense.
  // waypoints = points de passage choisis par le joueur : l'armée passe par chacun d'eux, dans l'ordre,
  // en prenant à chaque fois le chemin le plus facile.
  castlePath(pid, c, waypoints = []) {
    const passable = this.castlePassable(c), foot = new Set(this.footprint(c, this.building[c]));
    const target = this.owner[c];
    // (un point de passage devenu impossible, par exemple pris entre-temps, est oublié)
    const goals = waypoints.filter(w => passable(w) && !foot.has(w)).map(w => new Set([w]));
    goals.push(foot);
    let path = [], from = -1; // -1 = on part de la frontière
    for (const goal of goals) {
      const seg = this.searchPath(pid, from, goal, passable, target);
      if (!seg) return null;
      path = path.concat(from < 0 ? seg : seg.slice(1));
      from = seg[seg.length - 1];
    }
    return path;
  },

  // Recherche du chemin le plus facile (algorithme de Dijkstra) depuis la case from
  // (ou depuis toute la frontière de pid si from = -1) jusqu'à une case de goal.
  searchPath(pid, from, goal, passable, target) {
    const dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-2);
    const done = new Uint8Array(this.N); // cases déjà traitées (chacune une seule fois)
    const heap = new MinHeap();
    const start = i => { dist[i] = this.tileDefense(target, i); prev[i] = -1; heap.push(dist[i], i); };
    if (from >= 0) start(from);
    else for (let i = 0; i < this.N; i++) if (passable(i) && this.touchesFriend(i, pid)) start(i);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      if (goal.has(i)) {
        const path = [];
        for (let j = i; j >= 0; j = prev[j]) path.push(j);
        return path.reverse();
      }
      this.forNeighbors(i, n => {
        if (done[n] || !passable(n)) return;
        const nd = d + this.tileDefense(target, n);
        if (nd < dist[n]) { dist[n] = nd; prev[n] = i; heap.push(nd, n); }
      });
    }
    return null;
  },

  // Couloir de l'assaut : le chemin, une case de chaque côté, et le château (ou l'église) lui-même
  corridor(c, path, passable = this.castlePassable(c)) {
    const zone = new Set(this.footprint(c, this.building[c]));
    for (const i of path) {
      zone.add(i);
      this.forNeighbors(i, n => { if (passable(n)) zone.add(n); });
    }
    return zone;
  },

  // Pour les bots : quel château viser, et quelle défense de terrain attendre au premier combat ?
  // castle : null = pas de château (attaque de front), -1 = aucun atteignable, sinon le château.
  planAssault(pid, target) {
    const castles = this.castlesOf(target).concat(this.churchesOf(target));
    if (!this.isProtected(target)) return { castle: null, D: 1.3 };
    let best = { castle: -1, D: 1 }, bestLen = Infinity;
    for (const c of castles) {
      const path = this.castlePath(pid, c);
      if (path && path.length < bestLen) {
        bestLen = path.length;
        best = { castle: c, D: this.tileDefense(target, path[0]) };
      }
    }
    return best;
  },

  // Pour les bots : quel château viser ? null = pas de château (attaque de front),
  // -1 = aucun château atteignable, sinon le château le plus proche.
  pickCastleTarget(pid, target) {
    const castles = this.castlesOf(target).concat(this.churchesOf(target));
    if (!this.isProtected(target)) return null;
    let best = -1, bestLen = Infinity;
    for (const c of castles) {
      const path = this.castlePath(pid, c);
      if (path && path.length < bestLen) { bestLen = path.length; best = c; }
    }
    return best;
  },

  // --- Assaut de jonction ---
  // Un château isolé ne peut pas recevoir de défenseurs. Son royaume peut lancer un assaut
  // depuis son cœur, à travers les terres ennemies, pour le rejoindre. S'il y arrive, la route
  // de l'assaut s'élargit un peu : le château est de nouveau relié au royaume, et les soldats
  // de l'assaut rejoignent sa défense.

  // Cases du morceau de territoire où se trouve le château c (lui et ce qui reste dans sa muraille)
  castlePiece(c) {
    const r = this.regions(), k = r.comp[c];
    return new Set(r.order.subarray(r.start[k], r.start[k] + r.size[k]));
  },

  // Chemin du cœur du royaume pid jusqu'au morceau isolé `piece`, à travers les terres du royaume o
  // (sans passer dans la muraille d'un château de o). Renvoie { path, passable }, ou null.
  linkPath(pid, piece, o) {
    const passable = i => this.owner[i] === o && !this.castleProtects(o, i);
    const touchesPiece = i => {
      let found = false;
      this.forNeighbors(i, n => { if (piece.has(n)) found = true; });
      return found;
    };
    const dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-2);
    const done = new Uint8Array(this.N), heap = new MinHeap();
    for (let i = 0; i < this.N; i++) {
      if (passable(i) && this.touchesFriend(i, pid)) {
        dist[i] = this.tileDefense(o, i);
        prev[i] = -1;
        heap.push(dist[i], i);
      }
    }
    while (heap.size) {
      const [d, i] = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      if (touchesPiece(i)) {
        const path = [];
        for (let j = i; j >= 0; j = prev[j]) path.push(j);
        return { path: path.reverse(), passable };
      }
      this.forNeighbors(i, n => {
        if (done[n] || !passable(n)) return;
        const nd = d + this.tileDefense(o, n);
        if (nd < dist[n]) { dist[n] = nd; prev[n] = i; heap.push(nd, n); }
      });
    }
    return null;
  },

  // Meilleur chemin vers le château isolé c : à travers le royaume voisin qui donne le plus court.
  // Renvoie { path, passable, target, piece }, ou null.
  linkRoute(pid, c, onlyTarget) {
    const piece = this.castlePiece(c), around = new Set();
    for (const j of piece) {
      this.forNeighbors(j, n => {
        const o = this.owner[n];
        if (o >= 0 && o !== pid && !this.areAllied(pid, o)) around.add(o);
      });
    }
    let best = null;
    for (const o of around) {
      if (onlyTarget !== undefined && o !== onlyTarget) continue;
      const r = this.linkPath(pid, piece, o);
      if (r && (!best || r.path.length < best.path.length)) best = { ...r, target: o, piece };
    }
    return best;
  },

  // Un assaut de jonction vers ce château est-il déjà lancé ?
  linkFor(c) { return this.attacks.find(a => !a.done && a.link === c); },

  // Lance un assaut de jonction vers son château isolé c. Renvoie un message d'erreur, ou null.
  launchLink(pid, c, troops) {
    const p = this.players[pid];
    troops = Math.floor(Math.min(troops, p.troops));
    if (this.owner[c] !== pid || !this.isIsolatedCastle(c)) return 'Ce château n\'est pas coupé de ton royaume.';
    if (troops < 1) return 'Pas assez de soldats !';
    let a = this.linkFor(c);
    if (a) {
      p.troops -= troops;
      // Pendant la préparation, les soldats s'ajoutent tout de suite ; ensuite, ce sont des renforts
      if (this.isPreparing(a)) a.troops += troops;
      else a.pending.push({ troops, tick: this.tick + CONFIG.REINFORCE_DELAY * CONFIG.TICKS_PER_SECOND });
      return null;
    }
    const route = this.linkRoute(pid, c);
    if (!route) return 'Impossible de rejoindre ce château : des murailles ennemies bloquent le passage.';
    const half = this.sizeOf(B_CASTLE) / 2;
    a = {
      id: this.nextAttackId++, attacker: pid, target: route.target, troops, done: false,
      targetCastle: -1, link: c, // link = château isolé à rejoindre
      defenders: 0, pending: [], frontTile: route.path[0], path: route.path, piece: route.piece,
      fromX: p.sumX / p.tiles + 0.5, fromY: p.sumY / p.tiles + 0.5,
      toX: c % this.W + half, toY: ((c / this.W) | 0) + half,
    };
    // Comme tout assaut contre un royaume : une préparation que tout le monde voit
    a.startTick = this.tick + CONFIG.ATTACK_PREP_TIME * CONFIG.TICKS_PER_SECOND;
    a.prepTicks = a.startTick - this.tick;
    a.list = this.buildFrontier(pid, route.target);
    a.set = new Set(a.list);
    a.limitZone = this.corridor(c, route.path, route.passable);
    p.troops -= troops;
    this.attacks.push(a);
    if (this.players[route.target].isHuman) {
      UI.log(`⚠️ ${p.name} prépare un assaut à travers tes terres pour rejoindre son château isolé (${fmt(troops)} soldats) !`, 'warn', p);
    }
    return null;
  },

  // L'assaut de jonction a rejoint son château : la route s'élargit un peu,
  // et ses soldats rejoignent la défense du château
  linkArrives(a) {
    const c = a.link, p = this.players[a.attacker], R = CONFIG.LINK_WIDEN_RADIUS;
    // La route s'élargit : on prend les terres ennemies proches du chemin (hors murailles)
    for (const t of a.path) {
      const tx = t % this.W, ty = (t / this.W) | 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = tx + dx, y = ty + dy;
          if (x < 0 || y < 0 || x >= this.W || y >= this.H || Math.abs(dx) + Math.abs(dy) > R) continue;
          const i = y * this.W + x;
          if (this.owner[i] !== a.target || !this.isLand(i) || this.castleProtects(a.target, i)) continue;
          if (this.building[i] === B_CASTLE) continue;
          this.setOwner(i, a.attacker);
        }
      }
    }
    a.cut = true; // la route élargie peut à son tour couper le royaume traversé
    const siege = this.attacks.find(x => !x.done && x.target === a.attacker && x.targetCastle === c);
    if (siege) {
      siege.defenders += a.troops;
    } else {
      // Pas d'assaut contre le château : on remplit sa garnison, le reste rentre au royaume
      const add = Math.min(Math.max(0, this.castleInfo(c).garrison - this.garrison[c]), a.troops);
      this.garrison[c] += add;
      p.troops += a.troops - add;
    }
    if (p.isHuman) UI.log(`🏰 Ton château isolé est de nouveau relié à ton royaume${siege ? ' : tes soldats rejoignent sa défense !' : ' !'}`, 'good');
    else if (siege && this.players[siege.attacker].isHuman) {
      UI.log(`🏰 ${p.name} a rejoint le château que tu attaques : ses soldats renforcent la défense !`, 'warn', p);
    }
    a.troops = 0;
    this.endAttack(a);
  },

  // Flèche de l'attaque : du cœur du royaume attaquant vers la case visée
  // (ou, à défaut, vers la case du front la plus proche).
  aimArrow(a, frontier, aimTile) {
    const p = this.players[a.attacker];
    a.fromX = p.sumX / p.tiles + 0.5;
    a.fromY = p.sumY / p.tiles + 0.5;
    let aim = aimTile;
    if (aim === undefined || this.owner[aim] !== a.target) {
      let best = Infinity;
      for (const t of frontier) {
        const d = (t % this.W - a.fromX) ** 2 + (((t / this.W) | 0) - a.fromY) ** 2;
        if (d < best) { best = d; aim = t; }
      }
    }
    a.toX = aim % this.W + 0.5;
    a.toY = ((aim / this.W) | 0) + 0.5;
  },

  isPreparing(a) { return this.tick < a.startTick; },

  // Choisit une case du front, en préférant celles bien entourées (front plus régulier).
  // Le relief compte : une plaine est plus attirante qu'une montagne.
  pickFrontier(a) {
    let best = -1, bestScore = -1;
    for (let k = 0; k < 4 && a.list.length > 0; k++) {
      const idx = (Math.random() * a.list.length) | 0;
      const t = a.list[idx];
      const around = this.countFriendNeighbors(t, a.attacker);
      const score = around / TERRAIN_INFO[this.terrain[t]].cost;
      // Après la prise d'un château, l'assaut ne sort plus de la zone du château
      const outside = a.limitZone && !a.limitZone.has(t);
      // Un assaut de front ne prend pas de château : il faut le viser (en cliquant dessus)
      const castle = a.target >= 0 && a.targetCastle < 0 && this.building[t] === B_CASTLE;
      if (!a.set.has(t) || this.owner[t] !== a.target || around === 0 || outside || castle) {
        a.list[idx] = a.list[a.list.length - 1];
        a.list.pop();
        a.set.delete(t);
        k--;
        continue;
      }
      if (score > bestScore) { bestScore = score; best = t; }
    }
    if (best >= 0) a.set.delete(best);
    return best;
  },

  // Prendre une case coûte comme une terre libre (selon le terrain), même chez l'ennemi :
  // ce sont les soldats du défenseur qui rendent un assaut coûteux (voir fight).
  tileCost(a, t) {
    return CONFIG.NEUTRAL_TILE_COST * TERRAIN_INFO[this.terrain[t]].cost;
  },

  // Défense de l'endroit où se trouve l'assaut : terrain + château (x0.5 si le défenseur est traître).
  // Chaque défenseur tué coûte autant de soldats à l'attaquant : x1 en plaine, plus ailleurs.
  frontDefense(a) {
    let t = a.frontTile;
    if (t < 0 || this.owner[t] !== a.target) {
      t = a.list.find(i => this.owner[i] === a.target && (!a.limitZone || a.limitZone.has(i)));
      if (t === undefined) return 1;
      a.frontTile = t;
    }
    let def = this.tileDefense(a.target, t);
    if (this.isTraitor(this.players[a.target])) def *= CONFIG.TRAITOR_DEFENSE_MALUS;
    return Math.max(1, def);
  },

  // Force des soldats d'un royaume : celle de sa meilleure caserne (1 sans caserne améliorée)
  troopPower(pid) {
    let best = 1;
    for (const a of this.buildingTiles) {
      if (this.building[a] === B_BARRACKS && this.owner[a] === pid) best = Math.max(best, this.buildingInfo(a).power);
    }
    return best;
  },

  // Combien d'attaquants tombent pour chaque défenseur tué : la défense de l'endroit,
  // corrigée par la force des soldats des deux camps (casernes de niveau 2 et 3)
  combatRatio(a) {
    let r = this.frontDefense(a) * this.troopPower(a.target) / this.troopPower(a.attacker);
    // Royaume sans château ni église : ses troupes, désorganisées, ne comptent que pour 0.8
    if (this.leaderless(a)) r *= CONFIG.LEADERLESS_DEFENSE;
    return r;
  },

  // Assaut de front contre un royaume qui n'a plus ni château ni église
  leaderless(a) {
    return a.target >= 0 && a.targetCastle < 0 && !this.isProtected(a.target);
  },

  // Un royaume sans château ni église n'a plus de pouvoir en place : quand un assaut de front commence,
  // toutes les troupes encore présentes dans le royaume défendent d'office (partagées entre les assauts
  // qui commencent en même temps). Les soldats recrutés ensuite restent au royaume.
  levy() {
    const byTarget = new Map();
    for (const a of this.attacks) {
      if (a.done || a.levied || this.isPreparing(a) || !this.leaderless(a)) continue;
      a.levied = true;
      if (!byTarget.has(a.target)) byTarget.set(a.target, []);
      byTarget.get(a.target).push(a);
    }
    for (const [t, list] of byTarget) {
      const p = this.players[t];
      if (!p.alive || p.troops <= 0) continue;
      for (const a of list) a.defenders += p.troops / list.length;
      p.troops = 0;
    }
  },

  // Combat entre l'assaut et les défenseurs envoyés : ce n'est pas instantané,
  // chaque tour une petite partie des soldats engagés tombe.
  fight(a) {
    const D = this.combatRatio(a);
    const total = a.defenders + (a.garrison || 0);
    const base = Math.max(CONFIG.FIGHT_MIN_LOSS, CONFIG.FIGHT_RATE * Math.min(a.troops, total));
    const defLoss = Math.min(total, base);
    // La garnison combat en premier, puis les défenseurs envoyés
    const fromGarrison = Math.min(a.garrison || 0, defLoss);
    a.garrison = (a.garrison || 0) - fromGarrison;
    a.defenders -= defLoss - fromGarrison;
    a.troops = Math.max(0, a.troops - defLoss * D);
    if (a.troops < 1) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(`💥 Ton assaut contre ${d.name} a été repoussé !`, 'warn', d);
      else if (d.isHuman) UI.log(`🛡️ Tu as repoussé l'assaut de ${p.name} !`, 'good', p);
      this.endAttack(a);
    } else if (a.defenders + a.garrison < 1) {
      a.defenders = 0;
      a.garrison = 0;
    }
  },

  // La case touche-t-elle une case de cet ensemble, encore à ce royaume ?
  touchesSet(i, set, pid) {
    let found = false;
    this.forNeighbors(i, n => { if (set.has(n) && this.owner[n] === pid) found = true; });
    return found;
  },

  // L'assaut vise-t-il un château isolé ? Ses défenseurs ne peuvent alors pas le rejoindre.
  cutOff(a) {
    const c = a.targetCastle;
    return c >= 0 && this.building[c] === B_CASTLE && this.owner[c] === a.target && this.isIsolatedCastle(c);
  },

  // Le défenseur envoie des soldats contre un assaut (sans délai, autant qu'il veut)
  sendDefenders(pid, attackId, troops) {
    const p = this.players[pid];
    const a = this.attacks.find(a => a.id === attackId && a.target === pid && !a.done);
    troops = Math.floor(Math.min(troops, p.troops));
    if (!a || troops < 1 || this.cutOff(a)) return null;
    p.troops -= troops;
    a.defenders += troops;
    return a;
  },

  stepAttack(a) {
    if (this.isPreparing(a)) return;
    if (a.prepTicks && this.tick === a.startTick) {
      // Fin de la préparation : la frontière a pu bouger entre-temps
      a.list = this.buildFrontier(a.attacker, a.target);
      a.set = new Set(a.list);
      // Assaut sur un château : le chemin est-il toujours libre ?
      if (a.targetCastle >= 0 && !a.castleTaken) {
        const path = this.owner[a.targetCastle] === a.target ? this.castlePath(a.attacker, a.targetCastle, a.waypoints) : null;
        if (!path) {
          if (this.players[a.attacker].isHuman) UI.log('🚫 Le passage vers le château est bloqué : assaut annulé.', 'warn');
          return this.endAttack(a);
        }
        a.limitZone = this.corridor(a.targetCastle, path);
        a.frontTile = path[0];
      }
    }
    if (a.link >= 0) {
      // Assaut de jonction : son château a été pris avant qu'il n'arrive, les soldats rentrent
      if (this.owner[a.link] !== a.attacker) {
        if (this.players[a.attacker].isHuman) UI.log('💥 Trop tard : ton château isolé est tombé, ton assaut rentre.', 'warn');
        return this.endAttack(a);
      }
      // Déjà relié au royaume (par un autre chemin) : les soldats rejoignent sa défense
      if (!this.isIsolatedCastle(a.link)) return this.linkArrives(a);
      // Fin de la préparation : on recalcule le chemin, la frontière a pu bouger
      if (this.tick === a.startTick) {
        const route = this.linkRoute(a.attacker, a.link, a.target);
        if (!route) {
          if (this.players[a.attacker].isHuman) UI.log('🚫 Le passage vers ton château isolé est bloqué : assaut annulé.', 'warn');
          return this.endAttack(a);
        }
        a.path = route.path;
        a.piece = route.piece;
        a.limitZone = this.corridor(a.link, route.path, route.passable);
        a.frontTile = route.path[0];
      }
    }
    // Début d'un assaut sur un château : sa garnison sort le défendre
    if (a.prepTicks && this.tick === a.startTick && a.targetCastle >= 0 && !a.done) {
      a.garrison = this.garrison[a.targetCastle];
      this.garrison[a.targetCastle] = 0;
    }
    // Arrivée des renforts
    for (const r of a.pending) if (r.tick <= this.tick) a.troops += r.troops;
    a.pending = a.pending.filter(r => r.tick > this.tick);
    // Tant que des défenseurs (garnison ou renforts) tiennent la position, l'assaut se bat au lieu d'avancer
    if (a.defenders + (a.garrison || 0) >= 1) return this.fight(a);
    // Points de marche de ce tour : prendre une case en coûte autant que sa défense de terrain
    // (plaine 1, forêt 1.6, colline 2.2, montagne 3.5). On avance donc vite en plaine
    // et lentement dans le relief. Les points non utilisés sont gardés pour le tour suivant.
    const speed = Math.max(1, Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED);
    // (on peut toujours garder de quoi prendre une montagne, sinon une petite armée resterait bloquée)
    a.move = Math.min((a.move || 0) + speed, Math.max(speed * 2, MAX_LAND_COST));
    while (!a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) return this.endAttack(a);
      if (a.troops < this.tileCost(a, t)) return this.endAttack(a); // plus assez de soldats
      const steps = TERRAIN_INFO[this.terrain[t]].cost;
      if (a.move < steps) {
        a.set.add(t); // pas assez de points ce tour-ci : on réessaiera
        return;
      }
      a.move -= steps;
      const cost = this.tileCost(a, t);
      if (a.troops < cost) return this.endAttack(a);
      a.troops -= cost;
      a.frontTile = t;
      // Prise d'un château : on note sa zone de défense (un peu élargie), l'assaut s'y arrêtera
      const castle = a.target >= 0 && this.building[t] === B_CASTLE ? this.anchor[t] : -1;
      const zone = castle >= 0 ? this.castleZone(castle, a.target, 0, CONFIG.CASTLE_CAPTURE_EXTRA_RADIUS) : null;
      // Prendre une case entre deux cases du défenseur peut couper son royaume (voir captureEnclaves)
      if (a.target >= 0 && this.countNeighborsOwnedBy(t, a.target) >= 2) a.cut = true;
      this.setOwner(t, a.attacker);
      if (zone) this.onCastleTaken(a, zone);
      // Prise de l'église visée : l'assaut s'arrête là
      if (a.targetCastle >= 0 && this.building[t] === B_CHURCH && this.anchor[t] === a.targetCastle) {
        this.onChurchTaken(a);
        return this.endAttack(a);
      }
      // Assaut de jonction : il touche le morceau de son château isolé, c'est gagné
      if (a.link >= 0 && this.touchesSet(t, a.piece, a.attacker)) return this.linkArrives(a);
      this.forNeighbors(t, n => {
        if (this.owner[n] === a.target && this.isLand(n) && !a.set.has(n)) {
          a.set.add(n);
          a.list.push(n);
        }
      });
    }
  },

  // Rappelle les soldats d'une attaque (seulement les siennes).
  cancelAttack(pid, attackId) {
    const a = this.attacks.find(a => a.id === attackId && a.attacker === pid && !a.done);
    if (a) this.endAttack(a);
    return a;
  },

  onCastleTaken(a, zone) {
    if (!a.limitZone) a.limitZone = new Set();
    for (const i of zone) a.limitZone.add(i);
    a.castleTaken = true;
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(`🏰 Tu as pris un château de ${d.name} ! Ton armée sécurise ses alentours.`, 'good', d);
    else if (d.isHuman) UI.log(`🏰 ${p.name} a pris un de tes châteaux !`, 'warn', p);
  },

  onChurchTaken(a) {
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(`⛪ Tu as pris une église de ${d.name} !`, 'good', d);
    else if (d.isHuman) UI.log(`⛪ ${p.name} a pris une de tes églises !`, 'warn', p);
  },

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    const p = this.players[a.attacker];
    // Les survivants (et les renforts encore en route) rentrent à la maison
    if (p.alive) p.troops += a.troops + a.pending.reduce((s, r) => s + r.troops, 0);
    // Les défenseurs survivants rentrent aussi, et la garnison regagne son château
    if (a.target >= 0 && this.players[a.target].alive) this.players[a.target].troops += a.defenders;
    const c = a.targetCastle;
    if (c >= 0 && a.garrison > 0 && this.owner[c] === a.target) {
      this.garrison[c] = Math.min(this.castleInfo(c).garrison, this.garrison[c] + a.garrison);
    }
  },

  eliminate(id, by) {
    const p = this.players[id];
    if (!p.alive) return;
    p.alive = false;
    p.troops = 0;
    this.leavePact(p);
    for (const a of this.attacks) if (a.attacker === id) a.done = true;
    const killer = by >= 0 ? this.players[by] : null;
    if (killer) killer.kills++;
    UI.log(`☠️ ${p.name} a été anéanti${killer ? ' par ' + killer.name : ''} !`, p.isHuman ? 'warn' : '', killer ? [p, killer] : p);
  },

  // --- Alliances : les pactes ---
  // Des royaumes alliés forment un pacte. Un royaume ne peut faire partie que d'un seul pacte.
  areAllied(a, b) {
    const pa = this.players[a].pact;
    return a !== b && pa >= 0 && pa === this.players[b].pact;
  },

  allies(pid) { return this.players.filter(p => p.alive && this.areAllied(pid, p.id)); },

  pactMembers(id) { return this.players.filter(p => p.alive && p.pact === id); },

  pactName(p) { return p.pact >= 0 ? this.pacts.get(p.pact).name : ''; },

  // Pourquoi ces deux royaumes ne peuvent pas s'allier (null si c'est possible)
  pactBlock(a, b) {
    const pa = this.players[a], pb = this.players[b];
    if (pa.pact >= 0 && pb.pact >= 0) {
      return pa.isHuman ? `Tu fais déjà partie d'un pacte, et ${pb.name} d'un autre.`
        : `${pa.name} et ${pb.name} sont déjà dans des pactes différents.`;
    }
    const pact = pa.pact >= 0 ? pa.pact : pb.pact;
    if (pact >= 0 && this.pactMembers(pact).length >= CONFIG.MAX_PACT_SIZE) {
      return `Le ${this.pacts.get(pact).name} est complet (${CONFIG.MAX_PACT_SIZE} royaumes maximum).`;
    }
    return null;
  },

  // Quitter son pacte ; s'il ne reste qu'un seul royaume, le pacte disparaît
  leavePact(p) {
    const id = p.pact;
    if (id < 0) return;
    p.pact = -1;
    const rest = this.pactMembers(id);
    if (rest.length < 2) {
      for (const m of rest) m.pact = -1;
      this.pacts.delete(id);
    }
    this.version++;
  },

  // Un royaume (bot) accepte-t-il l'alliance proposée par "from" ?
  wouldAccept(bot, from) {
    if (this.isTraitor(from)) return false; // personne ne fait confiance à un traître
    // Un pacte n'accueille pas un traître
    if (this.isTraitor(bot) && from.pact >= 0) return false;
    // Un allié puissant est plus intéressant
    let chance = 0.2 + 0.3 * Math.min(from.troops / Math.max(1, bot.troops), 1.5);
    if (from.isHuman) chance -= this.difficulty.hateHuman * 0.5;
    if (this.allies(bot.id).length + this.allies(from.id).length >= 2) chance *= 0.5;
    if (this.attacks.some(a => !a.done && a.attacker === from.id && a.target === bot.id)) chance *= 0.3;
    return Math.random() < chance;
  },

  // Renvoie 'accepted', 'refused', 'pending' (en attente de la réponse du joueur) ou un message d'erreur.
  proposeAlliance(fromId, toId) {
    const from = this.players[fromId], to = this.players[toId];
    if (!from.alive || !to.alive || fromId === toId) return 'Ce royaume n\'existe plus.';
    if (this.areAllied(fromId, toId)) return `Tu es déjà allié avec ${to.name}.`;
    const block = this.pactBlock(fromId, toId);
    if (block) return block;
    const wait = (from.refusedUntil[toId] || 0) - this.tick;
    if (wait > 0) return `${to.name} a refusé récemment. Réessaie dans ${Math.ceil(wait / CONFIG.TICKS_PER_SECOND)} s.`;
    if (to.isHuman) return UI.askAlliance(from) ? 'pending' : 'refused';
    if (this.wouldAccept(to, from)) {
      this.makeAlliance(fromId, toId);
      return 'accepted';
    }
    this.refuseAlliance(fromId, toId);
    return 'refused';
  },

  refuseAlliance(fromId, toId) {
    this.players[fromId].refusedUntil[toId] = this.tick + CONFIG.ALLIANCE_REFUSAL_COOLDOWN * CONFIG.TICKS_PER_SECOND;
  },

  // a et b s'allient : soit ils créent un nouveau pacte, soit l'un rejoint le pacte de l'autre
  makeAlliance(a, b) {
    const pa = this.players[a], pb = this.players[b];
    if (this.areAllied(a, b) || this.pactBlock(a, b)) return;
    if (pa.pact < 0 && pb.pact < 0) {
      const id = this.nextPactId++;
      this.pacts.set(id, { name: `Pacte ${this.deName(pa.name)}` });
      pa.pact = pb.pact = id;
      UI.log(`🤝 ${pa.name} et ${pb.name} forment le ${this.pacts.get(id).name} !`, 'good', [pa, pb]);
    } else {
      const host = pa.pact >= 0 ? pa : pb, joiner = host === pa ? pb : pa;
      joiner.pact = host.pact;
      UI.log(`🤝 ${joiner.name} rejoint le ${this.pactName(host)} !`, 'good', [joiner, host]);
    }
    this.version++;
    // Les combats entre membres du pacte s'arrêtent, les soldats rentrent
    for (const at of this.attacks) {
      if (at.target >= 0 && this.areAllied(at.attacker, at.target)) this.endAttack(at);
    }
  },

  // Un traître a sa défense affaiblie pendant TRAITOR_DURATION secondes
  isTraitor(p) { return this.tick < p.traitorUntil; },

  // Trahir un allié = quitter son pacte (en traître)
  breakAlliance(traitorId, otherId) {
    if (!this.areAllied(traitorId, otherId)) return;
    const traitor = this.players[traitorId], name = this.pactName(traitor);
    this.leavePact(traitor);
    traitor.traitorUntil = this.tick + CONFIG.TRAITOR_DURATION * CONFIG.TICKS_PER_SECOND;
    UI.log(`🗡️ ${traitor.name} a trahi le ${name} ! Sa défense est affaiblie.`, 'warn', traitor);
  },

  // --- Boucle principale (appelée TICKS_PER_SECOND fois par seconde) ---
  update() {
    if (this.phase !== 'playing' || this.paused) return;
    this.tick++;
    const TPS = CONFIG.TICKS_PER_SECOND;

    for (const p of this.players) {
      if (!p.alive) continue;
      p.troops += this.troopRate(p) / TPS;
      p.gold += this.goldRate(p) / TPS;
    }
    this.produce();

    // Les garnisons des châteaux se reconstituent (sauf celle qui est en train de combattre)
    const besieged = new Set(this.attacks.filter(a => !a.done && !this.isPreparing(a)).map(a => a.targetCastle));
    for (const c of this.castles) {
      if (this.owner[c] < 0 || besieged.has(c)) continue;
      const max = this.castleInfo(c).garrison;
      this.garrison[c] = Math.min(max, this.garrison[c] + max * CONFIG.GARRISON_REGEN / TPS);
    }

    this.levy();
    for (const a of this.attacks.slice()) if (!a.done) this.stepAttack(a);
    // Un assaut a pu couper un royaume en morceaux : les petits morceaux encerclés sont pris
    for (const a of this.attacks) {
      if (a.cut) { a.cut = false; this.captureEnclaves(a.attacker, a.target); }
    }
    this.attacks = this.attacks.filter(a => !a.done);

    for (const p of this.players) if (p.alive && !p.isHuman) AI.update(p);

    if (this.tick % TPS === 0) this.checkEnd();
  },

  checkEnd() {
    const h = this.human;
    if (!h.alive) {
      this.phase = 'over';
      UI.showEnd(false);
      return;
    }
    const botsAlive = this.players.some(p => !p.isHuman && p.alive);
    // Victoire : 85 % des terres (une seule fois, on peut ensuite continuer à jouer),
    // ou plus aucun royaume rival (fin de la partie)
    if (!botsAlive || (!this.victoryShown && h.tiles / this.landCount >= CONFIG.WIN_RATIO)) {
      this.victoryShown = true;
      this.phase = 'over';
      UI.showEnd(true, botsAlive);
    }
  },

  // Après la victoire, reprendre la partie pour finir la conquête
  continueAfterVictory() {
    this.phase = 'playing';
  },

  // Combien de cases de frontière avec chaque voisin (-1 = terres libres).
  neighborStats(pid) {
    const stats = new Map();
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] !== pid) continue;
      this.forNeighbors(i, n => {
        const o = this.owner[n];
        if (o !== pid && this.isLand(n)) stats.set(o, (stats.get(o) || 0) + 1);
      });
    }
    return stats;
  },
};

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// Petite file de priorité (tas binaire) pour chercher le chemin le plus court
class MinHeap {
  constructor() { this.keys = []; this.vals = []; }
  get size() { return this.keys.length; }
  push(k, v) {
    const K = this.keys, V = this.vals;
    let i = K.length;
    K.push(k); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.keys, V = this.vals, top = [K[0], V[0]];
    const k = K.pop(), v = V.pop();
    if (K.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= K.length) break;
        if (c + 1 < K.length && K[c + 1] < K[c]) c++;
        if (K[c] >= k) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = k; V[i] = v;
    }
    return top;
  }
}
