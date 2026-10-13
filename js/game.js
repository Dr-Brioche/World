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
    // Un bâtiment occupe un carré de cases (2x2, ou 4x4 pour le château).
    // anchor[i] = case en haut à gauche du bâtiment (-1 si aucun)
    this.anchor = new Int32Array(this.N).fill(-1);
    this.players = [];
    this.attacks = [];
    this.nextAttackId = 1;
    this.alliances = new Set();
    this.buildingTiles = [];
    this.castles = [];
    this.tick = 0;
    this.version = 0; // augmente à chaque changement de la carte
    this.roadsVersion = -1;
    this.landCount = 0;
    for (let i = 0; i < this.N; i++) if (this.isLand(i)) this.landCount++;

    this.difficulty = DIFFICULTIES[opts.difficulty];
    this.human = this.addPlayer(opts.name, opts.color, true);
    const pool = KINGDOMS.slice().sort(() => Math.random() - 0.5);
    for (let k = 0; k < this.difficulty.bots && k < pool.length; k++) {
      this.addPlayer(pool[k].name, pool[k].color, false);
    }
    this.phase = 'spawn';
  },

  addPlayer(name, color, isHuman) {
    const [lo, hi] = this.difficulty.aggression;
    const p = {
      id: this.players.length, name, color, isHuman,
      alive: true, troops: CONFIG.START_TROOPS, gold: CONFIG.START_GOLD,
      tiles: 0, sumX: 0, sumY: 0, maxTiles: 0, kills: 0,
      bCount: [0, 0, 0, 0],
      traitorUntil: 0,
      refusedUntil: {}, // royaume id → tick avant lequel on ne peut pas redemander
      recoverUntil: {}, // royaume id → fin de la trêve avec lui (château pris) : pas d'attaque avant
      restUntil: 0,     // tick jusqu'auquel l'armée se repose (recrute moins vite) après avoir pris un château
      rallyUntil: 0,    // tick jusqu'auquel ce royaume recrute plus vite (il vient de perdre un château)
      aiTimer: Math.floor(Math.random() * 20),
      aggression: lo + Math.random() * (hi - lo),
    };
    this.players.push(p);
    return p;
  },

  // --- Outils sur les cases ---
  isLand(i) { return this.terrain[i] !== TERRAIN.WATER; },

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
    return this.footprint(a, type).every(j => this.owner[j] === pid && this.isLand(j) && !this.building[j])
      && !this.tooCloseToBuilding(a, type);
  },

  // Y a-t-il un bâtiment à moins de BUILDING_SPACING cases autour de cet emplacement ?
  // (une zone invisible autour de chaque bâtiment, pour éviter qu'ils se chevauchent)
  tooCloseToBuilding(a, type) {
    const n = this.sizeOf(type), m = CONFIG.BUILDING_SPACING;
    const x0 = a % this.W, y0 = (a / this.W) | 0;
    for (let y = Math.max(0, y0 - m); y <= Math.min(this.H - 1, y0 + n - 1 + m); y++) {
      for (let x = Math.max(0, x0 - m); x <= Math.min(this.W - 1, x0 + n - 1 + m); x++) {
        if (this.building[y * this.W + x]) return true;
      }
    }
    return false;
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
    if (type === B_CASTLE) this.castles.push(i);
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
    if (!this.isLand(i) || this.owner[i] !== -1) return false;
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
      this.isLand(j) && !this.building[j] && (this.owner[j] === p.id || this.owner[j] === -1));
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
  // Somme d'une valeur (ex. "gold") sur tous les bâtiments d'un type d'un royaume,
  // selon leur niveau
  // withRoads = compter le bonus des routes (or des moulins, recrutement des casernes)
  levelSum(p, type, key, withRoads = false) {
    let sum = 0;
    for (const a of this.buildingTiles) {
      if (this.building[a] !== type || this.owner[a] !== p.id) continue;
      const road = withRoads ? this.roads().get(a) : null;
      sum += this.buildingInfo(a)[key] * (1 + (road ? road.bonus : 0));
    }
    return sum;
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
    const bonus = 1 + this.levelSum(p, B_BARRACKS, 'growth', true);
    return base * bonus * this.growthFactor(p.troops / max) * this.recoveryFactor(p);
  },

  // Après la prise d'un château : l'armée de l'attaquant se repose (recrutement réduit)
  // et le défenseur se réorganise (recrutement accéléré).
  isRecovering(p) { return p.restUntil > this.tick; },
  isRallying(p) { return p.rallyUntil > this.tick; },

  recoveryFactor(p) {
    let f = 1;
    if (this.isRecovering(p)) f *= CONFIG.RECOVER_GROWTH_FACTOR;
    if (this.isRallying(p)) f *= CONFIG.RALLY_GROWTH_FACTOR;
    return f;
  },

  // Multiplicateur de recrutement selon le remplissage r (0 = vide, 1 = plein) :
  // il monte jusqu'au remplissage idéal, puis redescend jusqu'à 0 au maximum.
  growthFactor(r) {
    const peak = CONFIG.TROOP_PEAK_RATIO, lo = CONFIG.TROOP_GROWTH_AT_ZERO, hi = CONFIG.TROOP_GROWTH_AT_PEAK;
    if (r <= peak) return lo + (hi - lo) * (r / peak);
    return hi * Math.max(0, (1 - r) / (1 - peak));
  },

  goldRate(p) {
    return CONFIG.BASE_GOLD + p.tiles * CONFIG.GOLD_PER_TILE + this.levelSum(p, B_MILL, 'gold', true);
  },

  buildCost(p, type) {
    return Math.round(BUILDINGS[type].baseCost * Math.pow(CONFIG.BUILDING_COST_GROWTH, p.bCount[type]));
  },

  // Renvoie un message d'erreur, ou null si la construction a réussi.
  // i = case en haut à gauche du bâtiment (2x2 cases)
  tryBuild(p, i, type) {
    if (!this.canPlace(p.id, i, type)) {
      const n = this.sizeOf(type);
      if (i >= 0 && this.tooCloseToBuilding(i, type)) {
        return `Trop près d'un autre bâtiment : il faut ${CONFIG.BUILDING_SPACING} cases d'écart.`;
      }
      return `Il faut ${n}x${n} cases libres sur ton territoire (pas de mer).`;
    }
    const cost = this.buildCost(p, type);
    if (p.gold < cost) return `Pas assez d'or (${cost} nécessaires).`;
    p.gold -= cost;
    this.placeBuilding(i, type);
    return null;
  },

  // --- Attaques ---
  buildFrontier(pid, target) {
    const list = [];
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] === target && this.isLand(i) && this.hasNeighborOwnedBy(i, pid)) list.push(i);
    }
    return list;
  },

  // target = -1 pour les terres libres. aimTile = case visée (pour la flèche sur la carte).
  // Renvoie un message d'erreur, ou null.
  launchAttack(pid, target, troops, aimTile) {
    const p = this.players[pid];
    troops = Math.floor(Math.min(troops, p.troops));
    if (target === pid) return null;
    if (target >= 0 && this.areAllied(pid, target)) {
      return `${this.players[target].name} est ton allié ! Romps l'alliance d'abord.`;
    }
    const recover = this.recoverTime(p, target);
    if (recover > 0) {
      return `Trêve après la prise d'un château : encore ${recover} s avant de pouvoir attaquer ${this.players[target].name}.`;
    }
    if (troops < 1) return 'Pas assez de soldats !';
    const frontier = this.buildFrontier(pid, target);
    if (frontier.length === 0) {
      return target < 0 ? 'Aucune terre libre à ta frontière.' : `Tu n'as pas de frontière avec ${this.players[target].name}.`;
    }
    let a = this.attacks.find(a => !a.done && a.attacker === pid && a.target === target);
    if (!a) {
      a = { id: this.nextAttackId++, attacker: pid, target, troops: 0, done: false, startTick: this.tick };
      if (target >= 0) {
        // Contre un royaume, l'armée se prépare d'abord : tout le monde la voit venir
        a.startTick = this.tick + CONFIG.ATTACK_PREP_TIME * CONFIG.TICKS_PER_SECOND;
        a.prepTicks = a.startTick - this.tick;
        this.aimArrow(a, frontier, aimTile);
        if (this.players[target].isHuman) {
          UI.log(`⚠️ ${p.name} prépare une attaque contre toi (${fmt(troops)} soldats) !`, 'warn');
        }
      }
      this.attacks.push(a);
    }
    a.list = frontier;
    a.set = new Set(frontier);
    p.troops -= troops;
    a.troops += troops;
    return null;
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

  // Secondes avant de pouvoir réattaquer ce royaume après lui avoir pris un château (0 = c'est bon)
  recoverTime(p, target) {
    if (target < 0) return 0;
    return Math.max(0, Math.ceil(((p.recoverUntil[target] || 0) - this.tick) / CONFIG.TICKS_PER_SECOND));
  },

  // Choisit une case du front, en préférant celles bien entourées (front plus régulier).
  // Le relief compte : une plaine est plus attirante qu'une montagne.
  pickFrontier(a) {
    let best = -1, bestScore = -1;
    for (let k = 0; k < 4 && a.list.length > 0; k++) {
      const idx = (Math.random() * a.list.length) | 0;
      const t = a.list[idx];
      const around = this.countNeighborsOwnedBy(t, a.attacker);
      const score = around / TERRAIN_INFO[this.terrain[t]].cost;
      // Après la prise d'un château, l'assaut ne sort plus de la zone du château
      const outside = a.limitZone && !a.limitZone.has(t);
      if (!a.set.has(t) || this.owner[t] !== a.target || around === 0 || outside) {
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

  tileCost(a, t) {
    if (a.target < 0) return CONFIG.NEUTRAL_TILE_COST * TERRAIN_INFO[this.terrain[t]].cost;
    const d = this.players[a.target];
    const density = d.troops / Math.max(1, d.tiles);
    let cost = (CONFIG.ENEMY_TILE_BASE_COST + density * CONFIG.DENSITY_FACTOR) * this.tileDefense(a.target, t);
    if (this.isTraitor(d)) cost *= CONFIG.TRAITOR_DEFENSE_MALUS;
    return cost;
  },

  stepAttack(a) {
    if (this.isPreparing(a)) return;
    if (a.prepTicks && this.tick === a.startTick) {
      // Fin de la préparation : la frontière a pu bouger entre-temps
      a.list = this.buildFrontier(a.attacker, a.target);
      a.set = new Set(a.list);
    }
    // Points de marche de ce tour : prendre une case en coûte autant que sa défense de terrain
    // (plaine 1, forêt 1.6, colline 2.2, montagne 3.5). On avance donc vite en plaine
    // et lentement dans le relief. Les points non utilisés sont gardés pour le tour suivant.
    const speed = Math.max(1, Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED);
    a.move = Math.min((a.move || 0) + speed, speed * 2);
    while (!a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) return this.endAttack(a);
      const steps = TERRAIN_INFO[this.terrain[t]].cost;
      if (a.move < steps) {
        a.set.add(t); // pas assez de points ce tour-ci : on réessaiera
        return;
      }
      a.move -= steps;
      const cost = this.tileCost(a, t);
      if (a.troops < cost) return this.endAttack(a);
      a.troops -= cost;
      if (a.target >= 0) {
        const d = this.players[a.target];
        d.troops = Math.max(0, d.troops - cost * CONFIG.DEFENDER_LOSS);
      }
      // Prise d'un château : on note sa zone de défense (un peu élargie), l'assaut s'y arrêtera
      const castle = a.target >= 0 && this.building[t] === B_CASTLE ? this.anchor[t] : -1;
      const zone = castle >= 0 ? this.castleZone(castle, a.target, 0, CONFIG.CASTLE_CAPTURE_EXTRA_RADIUS) : null;
      this.setOwner(t, a.attacker);
      if (zone) this.onCastleTaken(a, zone);
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
    if (p.isHuman) UI.log(`🏰 Tu as pris un château de ${d.name} ! Ton armée sécurise ses alentours.`, 'good');
    else if (d.isHuman) UI.log(`🏰 ${p.name} a pris un de tes châteaux !`, 'warn');
  },

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    const p = this.players[a.attacker];
    if (p.alive) p.troops += a.troops; // les survivants rentrent à la maison
    // Après la prise d'un château : trêve dans les deux sens. L'attaquant se repose
    // (recrute moins vite) et le défenseur se réorganise (recrute plus vite),
    // mais aucun des deux ne peut attaquer l'autre avant la fin de la trêve.
    if (a.castleTaken && p.alive) {
      const until = this.tick + CONFIG.CASTLE_CAPTURE_COOLDOWN * CONFIG.TICKS_PER_SECOND;
      const d = this.players[a.target];
      p.recoverUntil[a.target] = until;
      d.recoverUntil[a.attacker] = Math.max(d.recoverUntil[a.attacker] || 0, until);
      p.restUntil = Math.max(p.restUntil, until);
      d.rallyUntil = Math.max(d.rallyUntil, until);
      const secs = CONFIG.CASTLE_CAPTURE_COOLDOWN;
      if (p.isHuman) {
        UI.log(`⏳ Assaut terminé : trêve de ${secs} s avec ${d.name}. Ton armée se repose ` +
          `(recrutement x${CONFIG.RECOVER_GROWTH_FACTOR}), et ${d.name} ne peut pas contre-attaquer non plus.`);
      } else if (d.isHuman && d.alive) {
        UI.log(`🛡️ ${p.name} a fini son assaut : trêve de ${secs} s. Ton royaume se réorganise ` +
          `(recrutement x${CONFIG.RALLY_GROWTH_FACTOR}), mais tu ne peux pas contre-attaquer tout de suite.`, 'good');
      }
    }
  },

  eliminate(id, by) {
    const p = this.players[id];
    if (!p.alive) return;
    p.alive = false;
    p.troops = 0;
    for (const o of this.players) if (o.id !== id) this.alliances.delete(this.allyKey(id, o.id));
    for (const a of this.attacks) if (a.attacker === id) a.done = true;
    const killer = by >= 0 ? this.players[by] : null;
    if (killer) killer.kills++;
    UI.log(`☠️ ${p.name} a été anéanti${killer ? ' par ' + killer.name : ''} !`, p.isHuman ? 'warn' : '');
  },

  // --- Alliances ---
  allyKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; },

  areAllied(a, b) { return this.alliances.has(this.allyKey(a, b)); },

  allies(pid) { return this.players.filter(p => p.alive && p.id !== pid && this.areAllied(pid, p.id)); },

  // Un royaume (bot) accepte-t-il l'alliance proposée par "from" ?
  wouldAccept(bot, from) {
    if (this.tick < from.traitorUntil) return false; // personne ne fait confiance à un traître
    // Un allié puissant est plus intéressant
    let chance = 0.2 + 0.3 * Math.min(from.troops / Math.max(1, bot.troops), 1.5);
    if (from.isHuman) chance -= this.difficulty.hateHuman * 0.5;
    if (this.allies(bot.id).length >= 2) chance *= 0.5;
    if (this.attacks.some(a => !a.done && a.attacker === from.id && a.target === bot.id)) chance *= 0.3;
    return Math.random() < chance;
  },

  // Renvoie 'accepted', 'refused', 'pending' (en attente de la réponse du joueur) ou un message d'erreur.
  proposeAlliance(fromId, toId) {
    const from = this.players[fromId], to = this.players[toId];
    if (!from.alive || !to.alive || fromId === toId) return 'Ce royaume n\'existe plus.';
    if (this.areAllied(fromId, toId)) return `Tu es déjà allié avec ${to.name}.`;
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

  makeAlliance(a, b) {
    this.alliances.add(this.allyKey(a, b));
    // Les combats entre les deux royaumes s'arrêtent, les soldats rentrent
    for (const at of this.attacks) {
      if ((at.attacker === a && at.target === b) || (at.attacker === b && at.target === a)) this.endAttack(at);
    }
    UI.log(`🤝 ${this.players[a].name} et ${this.players[b].name} sont maintenant alliés !`, 'good');
  },

  // Un traître a sa défense affaiblie pendant TRAITOR_DURATION secondes
  isTraitor(p) { return this.tick < p.traitorUntil; },

  breakAlliance(traitorId, otherId) {
    if (!this.areAllied(traitorId, otherId)) return;
    this.alliances.delete(this.allyKey(traitorId, otherId));
    const traitor = this.players[traitorId];
    traitor.traitorUntil = this.tick + CONFIG.TRAITOR_DURATION * CONFIG.TICKS_PER_SECOND;
    UI.log(`🗡️ ${traitor.name} a trahi ${this.players[otherId].name} ! Sa défense est affaiblie.`, 'warn');
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

    for (const a of this.attacks.slice()) if (!a.done) this.stepAttack(a);
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
    if (h.tiles / this.landCount >= CONFIG.WIN_RATIO || !botsAlive) {
      this.phase = 'over';
      UI.showEnd(true);
    }
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
