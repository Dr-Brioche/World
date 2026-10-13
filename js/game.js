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
    this.players = [];
    this.attacks = [];
    this.nextAttackId = 1;
    this.alliances = new Set();
    this.buildingTiles = [];
    this.castles = [];
    this.tick = 0;
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
    const b = this.building[i];
    if (old >= 0) {
      const o = this.players[old];
      o.tiles--; o.sumX -= x; o.sumY -= y;
      if (b) o.bCount[b]--;
    }
    this.owner[i] = pid;
    if (pid >= 0) {
      const p = this.players[pid];
      p.tiles++; p.sumX += x; p.sumY += y;
      if (b) p.bCount[b]++;
      if (p.tiles > p.maxTiles) p.maxTiles = p.tiles;
    }
    Render.markDirty(i);
    if (old >= 0 && this.players[old].tiles === 0) this.eliminate(old, pid);
  },

  placeBuilding(i, type) {
    this.building[i] = type;
    const o = this.owner[i];
    if (o >= 0) this.players[o].bCount[type]++;
    this.buildingTiles.push(i);
    if (type === B_CASTLE) this.castles.push(i);
  },

  castleProtects(pid, i) {
    const x = i % this.W, y = (i / this.W) | 0, r2 = CONFIG.CASTLE_RADIUS ** 2;
    for (const c of this.castles) {
      if (this.owner[c] !== pid) continue;
      const dx = (c % this.W) - x, dy = ((c / this.W) | 0) - y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  },

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
    this.placeBuilding(center, B_CASTLE); // la capitale est un château gratuit
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
  maxTroops(p) {
    return CONFIG.BASE_MAX_TROOPS + p.tiles * CONFIG.MAX_TROOPS_PER_TILE
      + p.bCount[B_BARRACKS] * CONFIG.MAX_TROOPS_PER_BARRACKS;
  },

  troopRate(p) {
    const max = this.maxTroops(p);
    if (p.troops >= max) return 0;
    const base = CONFIG.BASE_TROOP_GROWTH + p.tiles * CONFIG.TROOP_GROWTH_PER_TILE;
    const bonus = 1 + p.bCount[B_BARRACKS] * CONFIG.BARRACKS_GROWTH_BONUS;
    return base * bonus * (1 - 0.8 * p.troops / max);
  },

  goldRate(p) {
    return CONFIG.BASE_GOLD + p.tiles * CONFIG.GOLD_PER_TILE + p.bCount[B_FARM] * CONFIG.GOLD_PER_FARM;
  },

  buildCost(p, type) {
    return Math.round(BUILDINGS[type].baseCost * Math.pow(CONFIG.BUILDING_COST_GROWTH, p.bCount[type]));
  },

  // Renvoie un message d'erreur, ou null si la construction a réussi.
  tryBuild(p, i, type) {
    if (this.owner[i] !== p.id) return 'Tu dois construire sur ton territoire.';
    if (this.building[i]) return 'Il y a déjà un bâtiment ici.';
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

  // Choisit une case du front, en préférant celles bien entourées (front plus régulier).
  pickFrontier(a) {
    let best = -1, bestScore = -1;
    for (let k = 0; k < 3 && a.list.length > 0; k++) {
      const idx = (Math.random() * a.list.length) | 0;
      const t = a.list[idx];
      const score = this.countNeighborsOwnedBy(t, a.attacker);
      if (!a.set.has(t) || this.owner[t] !== a.target || score === 0) {
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
    const tc = TERRAIN_INFO[this.terrain[t]].cost;
    if (a.target < 0) return CONFIG.NEUTRAL_TILE_COST * tc;
    const d = this.players[a.target];
    const density = d.troops / Math.max(1, d.tiles);
    let cost = (CONFIG.ENEMY_TILE_BASE_COST + density * CONFIG.DENSITY_FACTOR) * tc;
    if (this.castleProtects(a.target, t)) cost *= CONFIG.CASTLE_DEFENSE;
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
    let budget = Math.max(1, Math.floor(Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED));
    while (budget-- > 0 && !a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) return this.endAttack(a);
      const cost = this.tileCost(a, t);
      if (a.troops < cost) return this.endAttack(a);
      a.troops -= cost;
      if (a.target >= 0) {
        const d = this.players[a.target];
        d.troops = Math.max(0, d.troops - cost * CONFIG.DEFENDER_LOSS);
      }
      this.setOwner(t, a.attacker);
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

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    const p = this.players[a.attacker];
    if (p.alive) p.troops += a.troops; // les survivants rentrent à la maison
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
