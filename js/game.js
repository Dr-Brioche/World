// 🎲 LOGIQUE DU JEU
// Les royaumes, l'économie, les attaques et la victoire.

// Toutes les règles du jeu (les fonctions) sont rangées dans GameRules ; l'objet Game, plus bas,
// les « hérite » et ne garde que les données de la partie (carte, royaumes, attaques…).
// Pourquoi deux objets ? Un objet avec plus de ~128 éléments devient beaucoup plus lent dans
// le navigateur : séparer les règles et les données garde le jeu rapide.
const GameRules = {
  phase: 'menu', // 'menu' → 'spawn' → 'playing' → 'over'
  paused: false,

  init(opts) {
    this.mapType = opts.mapType || 'normal';
    const map = generateMap((Math.random() * 1e9) | 0, this.mapType);
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
    this.builtBy = new Int8Array(this.N).fill(-1); // royaume qui a construit le bâtiment (case d'ancrage)
    this.players = [];
    this.attacks = [];
    this.expeditions = []; // bateaux en route vers une côte
    this.works = new Map();  // travaux en cours sur les bâtiments : ancre → { kind: 'up' ou 'down', start, end, pid, paid }
    this.crossings = [];   // armées qui traversent un fleuve à gué
    this.returning = [];   // défenseurs qui rentrent à pied (l'assaut qu'ils allaient contrer est fini)
    this.outposts = new Map(); // avant-poste → { ready : tick où il est bâti, landing : case du débarquement }
    this.colonies = new Map(); // château bâti ou pris dans la zone d'un avant-poste → son royaume
    this.nextAttackId = 1;
    this.pacts = new Map(); // id du pacte → { name }
    this.nextPactId = 0;
    this.buildingTiles = [];
    this.castles = [];
    this.tick = 0;
    this.version = 0; // augmente à chaque changement de la carte
    // (calculs gardés en mémoire d'une partie à l'autre : on les oublie)
    this.regionsCache = null; this.regionsVersion = -1; this.nbStatsVersion = -1; this.nbStatsTick = undefined; this.assaultPlans = new Map();
    this.roadsVersion = -1;
    this.regionsVersion = -1;
    this.landCount = 0;
    for (let i = 0; i < this.N; i++) if (this.claimable(i)) this.landCount++; // (les fleuves ne se possèdent pas)
    // Grande carte (Monde, Europe) : les terres libres se prennent plus vite et coûtent moins de soldats,
    // sinon la partie n'en finirait pas (x1 sur les cartes aléatoires, jusqu'à x BIG_MAP_BOOST_MAX)
    this.landBoost = Math.min(CONFIG.BIG_MAP_BOOST_MAX, Math.max(1, Math.sqrt(this.landCount / CONFIG.BIG_MAP_LAND)));

    this.difficulty = DIFFICULTIES[opts.difficulty];
    this.pactsAllowed = opts.pacts !== false; // choisi dans le menu : pactes autorisés ou interdits
    this.human = this.addPlayer(opts.name, opts.banner, true);
    const names = KINGDOMS.slice().sort(() => Math.random() - 0.5);
    // Les bots reçoivent au hasard les bannières que le joueur n'a pas prises
    const banners = BANNERS.map((b, k) => k).filter(k => k !== opts.banner).sort(() => Math.random() - 0.5);
    // (les cartes « Monde » et « Europe » sont grandes : quelques royaumes de plus)
    const bots = this.difficulty.bots + (this.mapType === 'world' || this.mapType === 'europe' ? CONFIG.WORLD_EXTRA_BOTS : 0);
    for (let k = 0; k < bots && k < names.length && k < banners.length; k++) {
      this.addPlayer(names[k], banners[k], false);
    }
    this.phase = 'spawn';
    this.spawnBots();
  },

  addPlayer(name, banner, isHuman) {
    const [lo, hi] = this.difficulty.aggression;
    const p = {
      id: this.players.length, name, isHuman,
      banner,                        // numéro de la bannière (BANNERS)
      color: BANNERS[banner].color,  // la couleur du royaume vient de sa bannière
      alive: true, troops: CONFIG.START_TROOPS, gold: CONFIG.START_GOLD,
      tiles: 0, sumX: 0, sumY: 0, maxTiles: 0, kills: 0,
      bCount: [0, 0, 0, 0, 0, 0, 0],
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
  // Terre = tout sauf la mer, les grands fleuves et les sommets (infranchissables)
  isLand(i) {
    const t = this.terrain[i];
    return t !== TERRAIN.WATER && t !== TERRAIN.GREAT_RIVER && t !== TERRAIN.PEAK;
  },

  // Case qu'un royaume peut posséder : une terre, mais jamais un fleuve (il reste neutre, bleu, pour toujours ;
  // on ne le franchit qu'avec une traversée à gué, voir planCrossing)
  claimable(i) { return this.isLand(i) && this.terrain[i] !== TERRAIN.RIVER; },

  forNeighbors(i, cb) {
    const x = i % this.W, y = (i / this.W) | 0;
    if (x > 0) cb(i - 1);
    if (x < this.W - 1) cb(i + 1);
    if (y > 0) cb(i - this.W);
    if (y < this.H - 1) cb(i + this.W);
  },

  // Une des 4 voisines de la case i vérifie-t-elle test(n) ?
  hasNeighbor(i, test) {
    let found = false;
    this.forNeighbors(i, n => { if (!found && test(n)) found = true; });
    return found;
  },

  hasNeighborOwnedBy(i, pid) {
    let found = false;
    this.forNeighbors(i, n => { if (this.owner[n] === pid) found = true; });
    return found;
  },

  // Un royaume « ami » : soi-même ou un allié du même pacte
  isFriend(pid, o) { return o === pid || (o >= 0 && this.areAllied(pid, o)); },

  // La case touche-t-elle notre propre territoire ? (on n'attaque que depuis ses terres, jamais depuis
  // celles d'un allié). Un petit morceau coupé du royaume (un château isolé) ne compte pas : aucune armée
  // ne peut partir de là.
  // source (facultatif) : seulement les terres d'où part cette armée (-1 = le royaume, sinon un avant-poste)
  touchesOwn(i, pid, source) {
    let found = false;
    this.forNeighbors(i, n => {
      if (found || this.owner[n] !== pid) return;
      if (source === undefined) { if (this.isBase(n)) found = true; return; }
      if (this.sourceOf(n) === source) found = true;
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
    if (pid >= 0 && this.terrain[i] === TERRAIN.RIVER) return; // un fleuve ne s'achète ni ne se conquiert
    const x = i % this.W, y = (i / this.W) | 0;
    // Un bâtiment n'est compté qu'une fois : sur sa case d'ancrage
    const b = this.anchor[i] === i ? this.building[i] : 0;
    if (b) this.garrison[i] = 0; // château (ou avant-poste) pris : sa garnison est perdue
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
    if (type === B_PORT && !this.footprint(a, type).some(j => this.isCoastal(j))) return false;
    return this.footprint(a, type).every(j => this.owner[j] === pid && this.isLand(j) && !this.building[j]
      && this.terrain[j] !== TERRAIN.RIVER)
      && this.insideWalls(pid, a, type) && !this.tooCloseToBuilding(a, type)
      && !this.churchCastleConflict(pid, a, type);
  },

  // Les grands bâtiments d'un royaume (châteaux, églises, ports) gardent leurs distances entre eux, dans tous
  // les sens : une église ou un port reste hors de la muraille de ses châteaux (même améliorés), deux églises
  // (ou ports) ne se collent pas, deux châteaux non plus. Et pas de château trop près d'un de ses avant-postes.
  // Renvoie les cercles interdits (cercles rouges) pour construire ce type de bâtiment : le centre du nouveau
  // bâtiment ne doit être dans aucun d'eux.
  placementCircles(pid, type) {
    if (type !== B_CASTLE && type !== B_CHURCH && type !== B_PORT) return [];
    const C = CONFIG, circles = [];
    for (const a of this.buildingTiles) {
      if (this.owner[a] !== pid) continue;
      const b = this.building[a];
      let R = 0;
      if (b === B_CASTLE) R = type === B_CASTLE ? C.CASTLE_CASTLE_DISTANCE : C.CASTLE_CHURCH_DISTANCE;
      else if (b === B_CHURCH || b === B_PORT) R = type === B_CASTLE ? C.CASTLE_CHURCH_DISTANCE : C.CHURCH_CHURCH_DISTANCE;
      else if (b === B_OUTPOST && type === B_CASTLE) R = C.OUTPOST_CASTLE_DISTANCE;
      if (R) circles.push({ a, R });
    }
    return circles;
  },

  // La case j est-elle à moins de R cases du centre du bâtiment a ?
  nearBuilding(a, j, R) {
    const half = this.sizeOf(this.building[a]) / 2;
    const dx = a % this.W + half - (j % this.W + 0.5), dy = ((a / this.W) | 0) + half - (((j / this.W) | 0) + 0.5);
    return dx * dx + dy * dy <= R * R;
  },

  // Le bâtiment type, posé en a, aurait-il son centre dans un cercle rouge ?
  churchCastleConflict(pid, a, type) {
    const h = this.sizeOf(type) / 2, x = a % this.W + h, y = ((a / this.W) | 0) + h;
    return this.placementCircles(pid, type).some(({ a: c, R }) => {
      const hc = this.sizeOf(this.building[c]) / 2;
      return (c % this.W + hc - x) ** 2 + (((c / this.W) | 0) + hc - y) ** 2 < R * R;
    });
  },

  // Moulins et casernes se construisent dans l'enceinte d'un de ses châteaux, ou près d'une de ses
  // églises qui a encore de la place (pas ailleurs dans l'arrière-pays).
  // Les châteaux et les églises se construisent partout sur son territoire
  // (mais une église reste loin des châteaux : voir churchCastleConflict).
  insideWalls(pid, a, type) {
    if (type === B_CASTLE || type === B_CHURCH || type === B_PORT) return true;
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

  // Bâtiment qui permet de construire autour de lui : une église, ou un port de niveau 2 ou 3
  hasSlots(a) {
    const t = this.building[a];
    return (t === B_CHURCH || t === B_PORT) && this.buildingInfo(a).slots > 0;
  },

  // Une église (ou un port) du royaume qui accepte ce bâtiment (il est dans sa zone et elle a de la place), ou -1
  churchFor(pid, a, type) {
    const cells = this.footprint(a, type);
    for (const ch of this.buildingTiles) {
      if (!this.hasSlots(ch) || this.owner[ch] !== pid) continue;
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

  // Bâtiments visables par un assaut (château, église, port, avant-poste) d'un royaume
  targetsOf(pid) {
    return this.buildingTiles.filter(a => TARGET_TYPES.includes(this.building[a]) && this.owner[a] === pid);
  },

  // « ce château », « cette église »… pour les messages
  targetLabel(a) {
    return ['', '', '', 'ce château', 'cette église', 'ce port', 'cet avant-poste'][this.building[a]] || 'cette cible';
  },

  // Retire un bâtiment de la carte (un avant-poste détruit)
  removeBuilding(a) {
    const type = this.building[a], o = this.owner[a];
    for (const j of this.footprint(a, type)) { this.building[j] = 0; this.anchor[j] = -1; Render.markDirty(j); }
    this.level[a] = 0;
    this.garrison[a] = 0;
    this.builtBy[a] = -1;
    this.outposts.delete(a);
    this.works.delete(a);
    if (o >= 0) this.players[o].bCount[type]--;
    this.buildingTiles = this.buildingTiles.filter(b => b !== a);
    this.castles = this.castles.filter(c => c !== a);
    this.version++;
    this.regionsCache = null;
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
    this.regionsCache = null; // (le découpage dépend des bâtiments : à refaire)
    for (const j of this.footprint(i, type)) {
      this.building[j] = type;
      this.anchor[j] = i;
    }
    const o = this.owner[i];
    if (o >= 0) this.players[o].bCount[type]++;
    this.builtBy[i] = o; // (un bâtiment pris à l'ennemi garde son bâtisseur d'origine)
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

  // Lance l'amélioration d'un bâtiment : on paie tout de suite, les travaux durent UPGRADE_TIME secondes.
  // Renvoie un message d'erreur, ou null si les travaux commencent.
  upgradeBuilding(p, a) {
    if (!this.building[a] || this.owner[a] !== p.id) return 'Ce n\'est pas un de tes bâtiments.';
    if (this.works.has(a)) return 'Des travaux sont déjà en cours sur ce bâtiment.';
    const cost = this.upgradeCost(a);
    if (cost === null) return 'Ce bâtiment est déjà au niveau maximum.';
    if (p.gold < cost) return `Pas assez d'or (${cost} nécessaires).`;
    p.gold -= cost;
    // (passer au niveau 3 prend plus longtemps)
    this.startWorks(p, a, 'up', this.level[a] + 1 >= 3 ? CONFIG.UPGRADE_TIME_LEVEL3 : CONFIG.UPGRADE_TIME, cost);
    return null;
  },

  // Lance la démolition d'un de ses bâtiments (DEMOLISH_TIME secondes). Renvoie un message d'erreur, ou null.
  demolishBuilding(p, a) {
    if (!this.building[a] || this.owner[a] !== p.id || this.building[a] === B_OUTPOST) return 'Ce n\'est pas un de tes bâtiments.';
    if (this.works.has(a)) return 'Des travaux sont déjà en cours sur ce bâtiment.';
    this.startWorks(p, a, 'down', CONFIG.DEMOLISH_TIME, 0);
    return null;
  },

  startWorks(p, a, kind, secs, paid) {
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.works.set(a, { kind, start: this.tick, end: this.tick + secs * TPS, pid: p.id, paid });
  },

  // Annule les travaux d'un de ses bâtiments (l'or d'une amélioration est rendu)
  cancelWorks(p, a) {
    const w = this.works.get(a);
    if (!w || w.pid !== p.id) return;
    p.gold += w.paid;
    this.works.delete(a);
    // Chantier annulé : le bâtiment n'est pas construit
    if (w.kind === 'build') {
      if (this.building[a] === B_CASTLE) p.castlesBuilt--;
      this.removeBuilding(a);
    }
  },

  // Le bâtiment est-il encore en chantier (juste posé) ?
  underConstruction(a) {
    const w = this.works.get(a);
    return !!w && w.kind === 'build';
  },

  // Fin des travaux : le bâtiment monte d'un niveau, ou disparaît. S'il a été pris entre-temps, ils sont perdus.
  stepWorks() {
    for (const [a, w] of this.works) {
      const p = this.players[w.pid];
      if (this.owner[a] !== w.pid || !this.building[a]) {
        this.works.delete(a);
        if (p.isHuman) UI.log('🏚️ Ton bâtiment a été pris pendant les travaux : ils sont perdus.', 'warn');
        continue;
      }
      if (this.tick < w.end) continue;
      this.works.delete(a);
      const type = this.building[a], icon = BUILDINGS[type].icon;
      if (w.kind === 'build') continue; // chantier fini : le bâtiment fonctionne
      if (w.kind === 'up') {
        this.level[a]++;
        this.version++;
        if (p.isHuman) UI.log(`${icon} Amélioration terminée : ${this.buildingInfo(a).name} !`, 'good');
      } else {
        // Les soldats de la garnison rejoignent l'armée
        p.troops += this.garrison[a] || 0;
        if (p.isHuman) UI.log(`🧨 ${BUILDINGS[type].name} détruit.`, 'good');
        this.removeBuilding(a);
      }
    }
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
    return TERRAIN_INFO[this.terrain[i]].cost
      + (pid >= 0 ? Math.max(this.castleBonus(pid, i), this.portBonus(pid, i), this.outpostBonus(pid, i)) : 0);
  },

  // --- Avant-postes ---
  // L'avant-poste est-il bâti ? (il faut OUTPOST_BUILD_TIME secondes après le débarquement)
  outpostReady(a) {
    const o = this.outposts.get(a);
    return !!o && this.tick >= o.ready;
  },

  // Bonus de défense autour des avant-postes bâtis du royaume (0 si aucun)
  outpostBonus(pid, i) {
    for (const [a] of this.outposts) {
      if (this.owner[a] === pid && this.outpostReady(a) && this.nearBuilding(a, i, CONFIG.LANDING_RADIUS + 1)) {
        return CONFIG.OUTPOST_DEFENSE;
      }
    }
    return 0;
  },

  // La case est-elle près d'un avant-poste du royaume encore en construction ?
  outpostBuilding(pid, i) {
    for (const [a] of this.outposts) {
      if (this.owner[a] === pid && !this.outpostReady(a) && this.nearBuilding(a, i, CONFIG.LANDING_RADIUS + 1)) return true;
    }
    return false;
  },

  // Chaque tour : les avant-postes qui finissent d'être bâtis, et ceux dont la zone devient une vraie terre
  // du royaume (un château y a été bâti ou pris) : l'avant-poste disparaît et ses soldats rejoignent l'armée.
  stepOutposts() {
    for (const [a, o] of this.outposts) {
      const p = this.players[this.owner[a]];
      if (!o.settled && this.tick >= o.ready) {
        o.settled = true;
        this.regionsCache = null; // (l'avant-poste bâti change le découpage)
        this.version++; // l'avant-poste devient une base d'attaque
        // Une petite garnison fixe reste ; les autres soldats stationnent et peuvent partir à l'attaque
        const keep = Math.min(CONFIG.OUTPOST_GARRISON, this.garrison[a]);
        o.stationed += this.garrison[a] - keep;
        this.garrison[a] = keep;
        if (p && p.isHuman) {
          UI.log(`⛺ Ton avant-poste est bâti : ${fmt(keep)} soldats y restent en garnison, ${fmt(o.stationed)} stationnent ` +
            'et peuvent attaquer depuis lui (curseur « Envoyer »).', 'good');
        }
      }
    }
    if (this.tick % CONFIG.TICKS_PER_SECOND) return;
    const r = this.regions();
    for (const [a, o] of this.outposts) {
      const pid = this.owner[a], k = r.comp[a];
      // Relié par la terre au royaume : ses soldats stationnés rejoignent l'armée du royaume
      if (r.heart[k] && o.stationed > 0) { this.players[pid].troops += o.stationed; o.stationed = 0; }
      const castle = this.castles.find(c => this.owner[c] === pid && r.comp[c] === k);
      if (castle === undefined) continue;
      const p = this.players[pid];
      p.troops += this.garrison[a] + o.stationed;
      this.colonies.set(castle, pid);
      this.regionsCache = null;
      this.removeBuilding(a);
      if (p.isHuman) UI.log('🏰 Ton château fait de l\'avant-poste une vraie terre du royaume : ses soldats rejoignent ton armée.', 'good');
      return; // la carte a changé : on regardera les autres au prochain tour
    }
  },

  // Envoie des renforts par la mer à son avant-poste a (depuis un port d'expédition). Message d'erreur, ou null.
  reinforceOutpost(pid, a, troops) {
    const p = this.players[pid], o = this.outposts.get(a);
    if (!o || this.owner[a] !== pid) return 'Ce n\'est pas un de tes avant-postes.';
    let best = null;
    for (const port of this.expeditionPorts(pid)) {
      const path = this.boatPath(port, o.landing);
      if (!path) continue;
      const time = path.length / this.buildingInfo(port).boatSpeed;
      if (!best || time < best.time) best = { path, time, port };
    }
    if (!best) return 'Aucun de tes ports d\'expédition (niveau 2 ou plus) ne peut rejoindre cet avant-poste.';
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return 'Pas assez de soldats !';
    p.troops -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: o.landing, path: best.path, cost: 0, sent: troops,
      reinforce: a, port: best.port, troops: troops * (1 - this.seaLoss(best.time)),
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(best.time * TPS)) });
    return null;
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

  // Défense moyenne qu'aurait la zone d'un château de ce niveau : terrain + bonus des murs, en moyenne sur
  // les cases de sa muraille (1 = aucune défense en plus, 2 = +100 %…). Pour la bulle d'aperçu du château.
  castleZoneDefense(zone, level) {
    if (!zone.length) return 1;
    const bonus = CASTLE_LEVELS[level].bonus;
    let sum = 0;
    for (const i of zone) sum += TERRAIN_INFO[this.terrain[i]].cost + bonus;
    return sum / zone.length;
  },

  // Ports royaux (niveau 3) : ils ont une petite muraille autour de leur zone
  // (liste recalculée seulement quand la carte a changé)
  walledPorts() {
    if (this.walledPortsVersion !== this.version) {
      this.walledPortsVersion = this.version;
      this.walledPortsList = this.buildingTiles.filter(a => this.building[a] === B_PORT && this.buildingInfo(a).bonus);
    }
    return this.walledPortsList;
  },

  // Bonus de défense dans la muraille d'un port royal, comme un fort en bois (0 si aucun)
  portBonus(pid, i) {
    let best = 0;
    for (const a of this.walledPorts()) {
      if (this.owner[a] !== pid) continue;
      const info = this.buildingInfo(a);
      if (info.bonus > best && this.inChurchRange(a, i, info.radius)) best = info.bonus;
    }
    return best;
  },

  // --- Apparition des royaumes ---
  // Taille du morceau de terre (île ou continent) de chaque case (calculée une fois)
  landSize() {
    if (this.landSizes && this.landSizes.length === this.N && this.landSizesMap === this.map) return this.landSizes;
    const size = new Int32Array(this.N), comp = new Int32Array(this.N).fill(-1), order = [];
    for (let s = 0; s < this.N; s++) {
      if (!this.isLand(s) || comp[s] >= 0) continue;
      order.length = 0;
      comp[s] = s;
      order.push(s);
      for (let q = 0; q < order.length; q++) {
        this.forNeighbors(order[q], n => { if (this.isLand(n) && comp[n] < 0) { comp[n] = s; order.push(n); } });
      }
      for (const i of order) size[i] = order.length;
    }
    this.landSizes = size;
    this.landComps = comp; // comp[i] = numéro de l'île (ou du continent) de la case i, -1 pour l'eau
    this.landSizesMap = this.map;
    return size;
  },
  // Numéro de l'île (ou du continent) de chaque case
  landComp() { this.landSize(); return this.landComps; },

  canSpawnAt(i, minDist) {
    if (!this.isLand(i) || this.terrain[i] === TERRAIN.RIVER || this.owner[i] !== -1) return false;
    if (this.landSize()[i] < CONFIG.MIN_SPAWN_LAND) return false; // pas de capitale sur un îlot
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
        if (this.claimable(i) && this.owner[i] === -1) this.setOwner(i, p.id);
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

  // Les royaumes rivaux s'installent dès l'ouverture de la carte : le joueur voit où ils sont
  // avant de choisir où fonder sa capitale (comme au début d'une partie d'OpenFront)
  spawnBots() {
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
  },

  // Pourquoi le joueur ne peut pas fonder sa capitale ici (null s'il le peut)
  spawnError(i) {
    if (!this.isLand(i) || this.terrain[i] === TERRAIN.RIVER) return 'Choisis une terre, pas l\'eau !';
    if (this.owner[i] >= 0) return `Cette terre appartient déjà à ${this.players[this.owner[i]].name}.`;
    if (this.landSize()[i] < CONFIG.MIN_SPAWN_LAND) return 'Cette île est trop petite pour y fonder ta capitale.';
    if (!this.canSpawnAt(i, CONFIG.MIN_SPAWN_DISTANCE)) return 'Trop près d\'un royaume rival : éloigne-toi un peu.';
    return null;
  },

  // Le joueur fonde sa capitale : la partie commence
  startGame(humanTile) {
    this.spawnPlayer(this.human, humanTile);
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
    const owner = this.players[this.owner[a]];
    const eff = !owner ? 1 : t === B_BARRACKS ? this.barracksEfficiency(owner) : this.goldEfficiency(owner);
    if (t === B_CHURCH) { this.roads(); return this.roadChurches.has(a) ? CONFIG.CHURCH_ROAD_GOLD : 0; } // (église sur la route d'un port)
    const v = (t === B_MILL || t === B_PORT ? info.gold : info.troops) * eff;
    const road = this.roads().get(a);
    return v * (1 + (road ? road.bonus : 0)) * this.terrainFactor(a, t);
  },

  // Rendement des casernes d'un royaume : plus il en a, moins chacune produit (voir BARRACKS_DIMINISHING)
  barracksEfficiency(p) {
    return 1 / (1 + CONFIG.BARRACKS_DIMINISHING * Math.max(0, p.bCount[B_BARRACKS] - 1));
  },

  // Rendement des moulins et des ports d'un royaume : plus il en a, moins chacun rapporte
  // (voir GOLD_DIMINISHING dans config.js). 1 = 100 %.
  goldEfficiency(p) {
    const n = p.bCount[B_MILL] + p.bCount[B_PORT];
    return 1 / (1 + CONFIG.GOLD_DIMINISHING * Math.max(0, n - 1));
  },

  // Versement de la production des moulins et casernes. Chaque bâtiment a son propre moment
  // (selon sa place sur la carte), pour que tout n'arrive pas en même temps.
  produce() {
    const period = CONFIG.PRODUCTION_INTERVAL * CONFIG.TICKS_PER_SECOND;
    for (const a of this.buildingTiles) {
      const t = this.building[a];
      if (t !== B_MILL && t !== B_BARRACKS && t !== B_PORT && t !== B_CHURCH) continue;
      if (this.underConstruction(a)) continue; // en chantier : il ne produit pas encore
      if ((this.tick + a * 7) % period !== 0) continue;
      const p = this.players[this.owner[a]];
      if (!p || !p.alive) continue;
      const amount = this.buildingOutput(a) * (t === B_BARRACKS ? this.warFactor(p) : this.upkeepFactor(p));
      if (!amount) continue; // (une église hors des routes ne produit rien)
      let shown = amount;
      if (t !== B_BARRACKS) p.gold += amount;
      else {
        // une caserne ne fait pas dépasser l'armée maximum
        shown = Math.max(0, Math.min(amount, this.maxTroops(p) - this.armySize(p)));
        p.troops += shown;
      }
      // Le joueur ne voit que la production de ses propres bâtiments
      if (p.isHuman && shown >= 0.5) Render.floatText(a, t, `+${Math.round(shown)} ${t === B_BARRACKS ? '⚔️' : '💰'}`);
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
  // qui sont dans sa muraille. Et tout château (une « ville ») relie par un chemin de terre un port proche. Renvoie une Map : bâtiment → { castle, bonus, road }.
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
    // Un port pas trop loin d'une ville (un château de son royaume, sur la même terre) : un chemin de terre
    // les relie, et le port produit PORT_ROAD_BONUS d'or en plus
    for (const a of this.buildingTiles) {
      if (this.building[a] !== B_PORT || this.owner[a] < 0) continue;
      const c = this.portRoadCastle(this.owner[a], a);
      if (c >= 0) links.set(a, { castle: c, bonus: CONFIG.PORT_ROAD_BONUS, road: 'dirt' });
    }
    // Une église construite sur une de ces routes (tout près) produit un peu d'or (CHURCH_ROAD_GOLD)
    this.roadChurches = new Map(); // église → port de la route
    for (const ch of this.buildingTiles) {
      if (this.building[ch] !== B_CHURCH || this.owner[ch] < 0) continue;
      const h = this.sizeOf(B_CHURCH) / 2, x = ch % this.W + h, y = ((ch / this.W) | 0) + h;
      for (const [a, link] of links) {
        if (this.building[a] !== B_PORT || this.owner[a] !== this.owner[ch]) continue;
        if (this.roadDistance(this.roadPoints(a, link.castle), x, y) <= CONFIG.CHURCH_ROAD_RANGE) { this.roadChurches.set(ch, a); break; }
      }
    }
    this.roadsCache = links;
    this.roadsVersion = this.version;
    return links;
  },

  // Château (une « ville ») de pid auquel un port posé en a serait relié par un chemin de terre : le plus proche,
  // à moins de PORT_ROAD_DISTANCE cases et sur la même terre. -1 s'il n'y en a pas.
  portRoadCastle(pid, a) {
    const land = this.landComp(), W = this.W, mid = (b, n) => [b % W + n / 2, ((b / W) | 0) + n / 2];
    const [px, py] = mid(a, this.sizeOf(B_PORT));
    let best = -1, bestD = CONFIG.PORT_ROAD_DISTANCE;
    for (const c of this.castles) {
      if (this.owner[c] !== pid || land[c] !== land[a]) continue;
      const [cx, cy] = mid(c, this.sizeOf(B_CASTLE)), d = Math.hypot(cx - px, cy - py);
      if (d <= bestD) { bestD = d; best = c; }
    }
    return best;
  },

  // Tracé d'une route (en cases) : du centre du château au centre du bâtiment a, avec un coin à angle droit
  roadPoints(a, castle) {
    const W = this.W, hc = this.sizeOf(B_CASTLE) / 2, hb = this.sizeOf(this.building[a]) / 2;
    const x1 = castle % W + hc, y1 = ((castle / W) | 0) + hc, x2 = a % W + hb, y2 = ((a / W) | 0) + hb;
    // d'abord à l'horizontale puis à la verticale (ou l'inverse, selon le bâtiment)
    return [[x1, y1], a % 2 ? [x2, y1] : [x1, y2], [x2, y2]];
  },

  // Distance (en cases) du point (x, y) à une route
  roadDistance(pts, x, y) {
    let best = Infinity;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  },

  // Une église posée en a serait-elle sur une route port–ville de pid ? (pour l'aide à la construction)
  churchOnRoad(pid, a) {
    const h = this.sizeOf(B_CHURCH) / 2, x = a % this.W + h, y = ((a / this.W) | 0) + h;
    for (const [b, link] of this.roads()) {
      if (this.building[b] === B_PORT && this.owner[b] === pid
        && this.roadDistance(this.roadPoints(b, link.castle), x, y) <= CONFIG.CHURCH_ROAD_RANGE) return true;
    }
    return false;
  },

  maxTroops(p) {
    return CONFIG.BASE_MAX_TROOPS + p.tiles * CONFIG.MAX_TROOPS_PER_TILE
      + this.levelSum(p, B_BARRACKS, 'maxTroops');
  },

  // Garnison maximum d'un bâtiment : celle de son niveau (château, port royal), 0 s'il n'en a pas.
  // Un avant-poste n'a pas de maximum : sa garnison, ce sont les soldats débarqués (elle ne se reconstitue pas).
  garrisonMax(a) {
    const t = this.building[a];
    if (t === B_OUTPOST) return this.outpostReady(a) ? CONFIG.OUTPOST_GARRISON : Infinity; // en construction : tous
    if (t === B_CASTLE || t === B_PORT) return this.buildingInfo(a).garrison || 0;
    return 0;
  },

  // Soldats en garnison dans les châteaux, ports et avant-postes du royaume
  garrisonOf(p) {
    let sum = 0;
    for (const a of this.buildingTiles) if (this.owner[a] === p.id) sum += this.garrison[a];
    return sum;
  },

  // Soldats stationnés dans les avant-postes du royaume (ils peuvent attaquer depuis là)
  stationedOf(p) {
    let sum = 0;
    for (const [a, o] of this.outposts) if (this.owner[a] === p.id) sum += o.stationed;
    return sum;
  },

  // Toute l'armée du royaume : les soldats disponibles + ceux en garnison + ceux stationnés aux avant-postes
  // (ils comptent tous pour le maximum)
  armySize(p) { return p.troops + this.garrisonOf(p) + this.stationedOf(p); },

  troopRate(p) {
    const max = this.maxTroops(p), army = this.armySize(p);
    if (army >= max) return 0;
    const base = CONFIG.BASE_TROOP_GROWTH + Math.sqrt(p.tiles) * CONFIG.TROOP_GROWTH_SQRT;
    return base * this.growthFactor(army / max) * this.warFactor(p) * this.earlyBoost();
  },

  // Élan de départ : multiplicateur du recrutement, de 1 + EARLY_GROWTH_BONUS au début de la partie
  // jusqu'à 1 au bout de EARLY_GROWTH_TIME secondes
  earlyBoost() {
    const t = this.tick / (CONFIG.EARLY_GROWTH_TIME * CONFIG.TICKS_PER_SECOND);
    return 1 + CONFIG.EARLY_GROWTH_BONUS * Math.max(0, 1 - t);
  },

  // Effets d'un assaut réussi sur la production de soldats (recrutement et casernes), pendant WAR_EFFECT_TIME s :
  // le vainqueur subit un malus d'après-guerre, le perdant est galvanisé. Ils s'additionnent : chaque victoire
  // ajoute -25 % pendant 30 s (qui attaque trop le paie cher), chaque défaite +25 % (qui est trop ciblé se rattrape).
  // postWar / rallied : le malus / bonus total en cours (0 = rien)
  postWar(p) {
    p.postWarEnds = (p.postWarEnds || []).filter(t => t > this.tick);
    return Math.min(CONFIG.POST_WAR_MAX, p.postWarEnds.length * CONFIG.POST_WAR_MALUS);
  },
  rallied(p) {
    p.rallyEnds = (p.rallyEnds || []).filter(t => t > this.tick);
    return Math.min(CONFIG.RALLY_MAX, p.rallyEnds.length * CONFIG.RALLY_BONUS);
  },
  warFactor(p) {
    return (1 - this.postWar(p)) * (1 + this.rallied(p));
  },
  warEffects(a) {
    const end = this.tick + CONFIG.WAR_EFFECT_TIME * CONFIG.TICKS_PER_SECOND;
    const p = this.players[a.attacker], d = a.target >= 0 ? this.players[a.target] : null;
    (p.postWarEnds = p.postWarEnds || []).push(end);
    if (d) (d.rallyEnds = d.rallyEnds || []).push(end);
    const secs = CONFIG.WAR_EFFECT_TIME;
    if (p.isHuman) UI.log(`⚰️ Après-guerre : ton royaume panse ses blessures, −${Math.round(CONFIG.POST_WAR_MALUS * 100)} % de soldats produits pendant ${secs} s (en tout : −${Math.round(this.postWar(p) * 100)} %).`, 'warn');
    if (d && d.isHuman) UI.log(`🔥 Ton peuple est galvanisé par la défaite : +${Math.round(CONFIG.RALLY_BONUS * 100)} % de soldats produits pendant ${secs} s (en tout : +${Math.round(this.rallied(d) * 100)} %) !`, 'good');
  },

  // Multiplicateur de recrutement selon le remplissage r (0 = vide, 1 = plein) :
  // il monte jusqu'au remplissage idéal, puis redescend jusqu'à 0 au maximum.
  growthFactor(r) {
    const peak = CONFIG.TROOP_PEAK_RATIO, lo = CONFIG.TROOP_GROWTH_AT_ZERO, hi = CONFIG.TROOP_GROWTH_AT_PEAK;
    if (r <= peak) return lo + (hi - lo) * (r / peak);
    return hi * Math.max(0, (1 - r) / (1 - peak));
  },

  goldRate(p) {
    return (CONFIG.BASE_GOLD + p.tiles * CONFIG.GOLD_PER_TILE) * this.upkeepFactor(p);
  },

  // Solde des troupes : multiplicateur de l'or gagné (1 = rien à payer). Au-delà de UPKEEP_FROM de l'armée
  // maximum, les soldats disponibles en surnombre coûtent de l'or, jusqu'à -UPKEEP_MAX avec une armée pleine.
  upkeepFactor(p) {
    const r = p.troops / Math.max(1, this.maxTroops(p));
    if (r <= CONFIG.UPKEEP_FROM) return 1;
    return 1 - CONFIG.UPKEEP_MAX * Math.min(1, (r - CONFIG.UPKEEP_FROM) / (1 - CONFIG.UPKEEP_FROM));
  },

  buildCost(p, type) {
    return Math.round(BUILDINGS[type].baseCost * Math.pow(CONFIG.BUILDING_COST_GROWTH, this.builtCount(p, type)));
  },

  // Bâtiments de ce type que le royaume a construits lui-même et possède encore : ce sont eux (et eux seuls)
  // qui font monter le prix des suivants. Ceux pris à l'ennemi ne comptent pas.
  builtCount(p, type) {
    let n = 0;
    for (const a of this.buildingTiles) if (this.building[a] === type && this.owner[a] === p.id && this.builtBy[a] === p.id) n++;
    return n;
  },

  // Renvoie un message d'erreur, ou null si la construction a réussi.
  // i = case en haut à gauche du bâtiment (2x2 cases)
  tryBuild(p, i, type) {
    if (BUILDINGS[type].hidden) return 'Ce bâtiment ne se construit pas.';
    if (type === B_CASTLE && p.castlesBuilt >= this.maxCastles(p)) {
      return `Tu as déjà construit ${this.maxCastles(p)} châteaux : c'est le maximum pour l'instant ` +
        '(prends-en à l\'ennemi, ou améliore une église pour en débloquer).';
    }
    if (!this.canPlace(p.id, i, type)) {
      const n = this.sizeOf(type);
      if (i >= 0 && this.owner[i] === p.id && !this.insideWalls(p.id, i, type)) {
        return `${BUILDINGS[type].name} : à construire dans l'enceinte d'un de tes châteaux, ou près d'une de tes églises (ou d'un port amélioré) ` +
          'qui a encore de la place (pas ailleurs dans l\'arrière-pays).';
      }
      if (i >= 0 && this.owner[i] === p.id && this.churchCastleConflict(p.id, i, type)) {
        return type === B_CASTLE
          ? 'Trop près d\'un de tes châteaux, églises, ports ou avant-postes (cercle rouge) : ' +
            'pour un château près d\'un avant-poste, conquiers d\'abord des terres autour de lui.'
          : 'Trop près (cercle rouge) : une église ou un port reste hors de la muraille de tes châteaux (même améliorés), ' +
            'et loin de tes autres églises et ports.';
      }
      if (type === B_PORT && i >= 0 && !this.footprint(i, type).some(j => this.isCoastal(j))) {
        return 'Un port se construit au bord de la mer ou d\'un fleuve.';
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
    // Chantier de BUILD_TIME secondes (petite jauge) : le bâtiment ne produit rien avant la fin
    this.startWorks(p, i, 'build', CONFIG.BUILD_TIME, cost);
    return null;
  },

  // --- Morceaux de territoire ---
  // Découpe la carte en « morceaux » : des cases d'un même royaume qui se touchent.
  // Sur chaque île (ou continent), le plus grand morceau d'un royaume est un cœur ; les autres sont coupés de lui.
  // Avant, seul le plus grand morceau de toute la carte comptait : une grande zone d'avant-poste sur un autre
  // continent pouvait alors faire passer toute l'île du royaume pour « coupée » (et ses châteaux pour isolés).
  // (un royaume qui s'étend sur plusieurs îles, par la mer, n'est donc pas « coupé » d'une île à l'autre)
  // Recalculé seulement quand la carte change.
  // (fresh = false : on réutilise le découpage déjà fait pendant REGIONS_REUSE tours de jeu, même si quelques cases
  //  ont changé de mains entre-temps : sur une grande carte, le refaire à chaque tour ralentirait le jeu.
  //  fresh = true : toujours à jour, pour décider des encerclements.)
  regions(fresh = false) {
    if (this.regionsCache && this.regionsVersion === this.version) return this.regionsCache;
    if (!fresh && this.regionsCache && this.tick - this.regionsTick < CONFIG.REGIONS_REUSE && this.tick >= this.regionsTick) return this.regionsCache;
    this.regionsTick = this.tick;
    // (order est réutilisé d'un calcul à l'autre : ceux qui s'en servent en recopient tout de suite un morceau)
    if (!this.regionsOrder || this.regionsOrder.length !== this.N) this.regionsOrder = new Int32Array(this.N);
    const comp = new Int32Array(this.N).fill(-1), order = this.regionsOrder;
    const size = [], start = [], owner = [], outpost = [], anyOutpost = [], colony = [], hasCastle = [];
    const main = new Array(this.players.length).fill(-1); // royaume → son plus grand morceau
    let n = 0;
    this.riverTiles(); // (prépare riverSide : les cases qui touchent un fleuve)
    const side = this.riverSide;
    const W = this.W, N = this.N, own = this.owner;
    // (cases d'en face, de l'autre côté d'un fleuve ; pas de fonction qui modifie n ou comp : c'est plus rapide)
    const across = [], pushAcross = j => { across.push(j); };
    for (let i = 0; i < N; i++) {
      const o = own[i];
      if (o < 0 || comp[i] >= 0) continue;
      // Nouveau morceau : on le parcourt de proche en proche
      // (les 4 voisins sont écrits à la main : c'est la fonction la plus appelée des grandes cartes)
      const k = size.length, s = n;
      comp[i] = k;
      order[n++] = i;
      for (let q = s; q < n; q++) {
        const t = order[q], x = t % W;
        if (x > 0 && comp[t - 1] < 0 && own[t - 1] === o) { comp[t - 1] = k; order[n++] = t - 1; }
        if (x < W - 1 && comp[t + 1] < 0 && own[t + 1] === o) { comp[t + 1] = k; order[n++] = t + 1; }
        if (t >= W && comp[t - W] < 0 && own[t - W] === o) { comp[t - W] = k; order[n++] = t - W; }
        if (t < N - W && comp[t + W] < 0 && own[t + W] === o) { comp[t + W] = k; order[n++] = t + W; }
        if (side[t]) { // les deux rives d'un fleuve restent un même morceau
          across.length = 0;
          this.acrossRiver(t, pushAcross);
          for (const j of across) if (comp[j] < 0 && own[j] === o) { comp[j] = k; order[n++] = j; }
        }
      }
      size.push(n - s); start.push(s); owner.push(o);
      // Ce morceau a-t-il un avant-poste (bâti ou non), ou le château d'une ancienne zone d'avant-poste ?
      let op = -1, anyOp = false, col = false, cas = false;
      for (let q = s; q < n; q++) {
        const t = order[q], b = this.building[t];
        if (b === B_OUTPOST) { anyOp = true; if (this.outpostReady(this.anchor[t])) op = this.anchor[t]; }
        if (b === B_CASTLE) { cas = true; if (this.colonies.get(this.anchor[t]) === o) col = true; }
      }
      outpost.push(op); anyOutpost.push(anyOp); colony.push(col); hasCastle.push(cas);
      if (main[o] < 0 || size[k] > size[main[o]]) main[o] = k;
    }
    // Les cœurs du royaume : sur chaque île (ou continent), son plus grand morceau.
    // Une zone d'avant-poste n'est pas un cœur (c'est une tête de pont), sauf si un château s'y trouve.
    const land = this.landComp(), heart = new Uint8Array(size.length), best = new Map(), hasHeart = new Set();
    for (let k = 0; k < size.length; k++) {
      if (anyOutpost[k] && !hasCastle[k]) continue;
      const key = owner[k] + ':' + land[order[start[k]]];
      if (!best.has(key) || size[k] > size[best.get(key)]) best.set(key, k);
    }
    for (const k of best.values()) { heart[k] = 1; hasHeart.add(owner[k]); }
    // (un royaume qui n'a plus que des zones d'avant-poste : son plus grand morceau reste son cœur)
    for (let o = 0; o < main.length; o++) if (main[o] >= 0 && !hasHeart.has(o)) heart[main[o]] = 1;
    // outpost[k] = avant-poste bâti du morceau k (-1 s'il n'y en a pas) ; heart[k] = 1 si k est un cœur du royaume
    this.regionsCache = { comp, order, size, start, owner, main, heart, outpost, anyOutpost, colony, hasCastle };
    this.regionsVersion = this.version;
    return this.regionsCache;
  },

  // Morceau de royaume coupé de tous ses châteaux : il n'a ni château ni avant-poste, alors que son royaume
  // a encore un château ailleurs (isolé, par exemple). Ses soldats sont bloqués dans ce château :
  //  - personne ne peut venir le défendre (on l'attaque de front, comme une terre vide) ;
  //  - aucune armée ne peut en partir (il n'a pas de château, la « zone de départ » des armées).
  // Le seul moyen d'en sortir : le relier à un château (assaut de jonction depuis le château isolé), ou y bâtir
  // un nouveau château.
  pieceUnlinked(r, k) {
    return k >= 0 && !r.hasCastle[k] && !r.anyOutpost[k] && this.castles.some(c => this.owner[c] === r.owner[k]);
  },
  // Tous les châteaux de pid sont isolés (aucun n'est relié à son cœur) : son armée est bloquée dans
  // ces châteaux. Elle peut les défendre (elle y est !), mais désorganisée (x LEADERLESS_DEFENSE) ;
  // quand l'un d'eux est attaqué, toutes ses troupes restantes le défendent d'office (voir lastStand).
  troopsInCastles(pid) {
    let any = false;
    for (const c of this.castles) {
      if (this.owner[c] !== pid) continue;
      if (!this.isIsolated(c)) return false;
      any = true;
    }
    return any;
  },
  isUnlinked(i) {
    if (this.owner[i] < 0) return false;
    const r = this.regionsAt(i);
    return this.pieceUnlinked(r, r.comp[i]);
  },
  // Le royaume pid a-t-il au moins un morceau coupé de tous ses châteaux ? (vérification rapide)
  hasUnlinked(pid) {
    const r = this.regions();
    for (let k = 0; k < r.size.length; k++) if (r.owner[k] === pid && this.pieceUnlinked(r, k)) return true;
    return false;
  },
  // Les cases de ce morceau (null s'il n'est pas coupé de ses châteaux)
  unlinkedPiece(i) {
    if (!this.isUnlinked(i)) return null;
    const r = this.regionsAt(i), k = r.comp[i];
    return new Set(r.order.subarray(r.start[k], r.start[k] + r.size[k]));
  },

  // Le découpage, à jour pour la case i : si elle a changé de mains depuis le dernier calcul, on le refait
  regionsAt(i) {
    const r = this.regions(), k = r.comp[i];
    return k < 0 ? (this.owner[i] < 0 ? r : this.regions(true)) : r.owner[k] !== this.owner[i] ? this.regions(true) : r;
  },

  // Toutes les cases de fleuve de la carte (calculées une seule fois par carte)
  riverTiles() {
    if (this.riverCacheFor !== this.terrain) {
      this.riverCacheFor = this.terrain;
      this.riverCache = [];
      this.riverSide = new Uint8Array(this.N); // 1 = case qui touche un fleuve
      for (let i = 0; i < this.N; i++) {
        if (this.terrain[i] !== TERRAIN.RIVER) continue;
        this.riverCache.push(i);
        this.forNeighbors(i, n => { this.riverSide[n] = 1; });
      }
    }
    return this.riverCache;
  },

  // Les cases de terre juste en face, de l'autre côté d'un fleuve (en ligne droite, au plus 3 cases d'eau) :
  // un royaume des deux côtés d'un fleuve n'est pas coupé en deux pour autant
  acrossRiver(i, fn) {
    const W = this.W, x0 = i % W, y0 = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= 4; k++) {
        const x = x0 + dx * k, y = y0 + dy * k;
        if (x < 0 || y < 0 || x >= W || y >= this.H) break;
        const j = y * W + x;
        if (this.terrain[j] === TERRAIN.RIVER) continue;
        if (k > 1) fn(j);
        break;
      }
    }
  },

  // Bâtiment qui sait se défendre seul (avec sa garnison) : un château, ou un port de niveau 3.
  // Coupé de son royaume, il ne tombe pas : il reste au royaume, isolé, avec les terres de sa zone.
  holdsAlone(a) {
    const b = this.building[a];
    return b === B_CASTLE || (b === B_PORT && this.level[a] >= 3);
  },

  // Château (ou port de niveau 3) coupé du cœur de son royaume : ses renforts ne peuvent plus le rejoindre
  isIsolated(c) {
    const o = this.owner[c];
    if (o < 0) return false;
    if (this.colonies.get(c) === o) return false; // château d'une ancienne zone d'avant-poste : terre du royaume
    const r = this.regionsAt(c);
    return !r.heart[r.comp[c]];
  },

  // Une armée peut-elle partir de cette case ? Oui si elle est dans le cœur de son royaume
  // (ou dans un morceau avec un avant-poste ou une colonie),
  // pas si elle est dans un morceau coupé du reste (un château isolé).
  isBase(i) {
    const o = this.owner[i];
    if (o < 0) return false;
    const r = this.regionsAt(i), k = r.comp[i];
    // (un cœur coupé de tous ses châteaux n'est plus une base : voir pieceUnlinked)
    return (r.heart[k] && !this.pieceUnlinked(r, k)) || r.outpost[k] >= 0 || r.colony[k];
  },

  // D'où part une armée qui passe par cette case du royaume ? -1 = du royaume (ses soldats disponibles),
  // sinon de l'avant-poste (son ancre : ses soldats stationnés). null = d'aucun endroit.
  sourceOf(i) {
    const o = this.owner[i];
    if (o < 0) return null;
    const r = this.regionsAt(i), k = r.comp[i];
    if (r.outpost[k] >= 0) return r.outpost[k];
    return this.isBase(i) ? -1 : null;
  },

  // Soldats disponibles pour une armée qui part de source (-1 = le royaume, sinon un avant-poste)
  troopsAt(pid, source) {
    if (source < 0) return this.players[pid].troops;
    const o = this.outposts.get(source);
    return o && this.owner[source] === pid ? o.stationed : 0;
  },
  takeTroops(pid, source, n) {
    if (source < 0) this.players[pid].troops -= n;
    else this.outposts.get(source).stationed -= n;
  },
  // Des soldats rentrent : à leur avant-poste s'il existe encore, sinon au royaume
  giveTroops(pid, source, n) {
    const o = source >= 0 && this.owner[source] === pid ? this.outposts.get(source) : null;
    if (o) o.stationed += n;
    else if (this.players[pid].alive) this.players[pid].troops += n;
  },

  // Meilleur point de départ pour attaquer target vers la case tile : le royaume ou un de ses avant-postes
  // bâtis (celui dont la frontière est la plus proche de la case)
  bestSource(pid, target, tile) {
    let best = -1, bestD = Infinity;
    const tx = tile % this.W, ty = (tile / this.W) | 0;
    for (const src of [-1, ...[...this.outposts.keys()].filter(a => this.owner[a] === pid && this.outpostReady(a))]) {
      for (const i of this.buildFrontier(pid, target, src)) {
        const d = (i % this.W - tx) ** 2 + (((i / this.W) | 0) - ty) ** 2;
        if (d < bestD) { bestD = d; best = src; }
      }
    }
    return best;
  },

  // Le royaume a-t-il encore un château ou une église ? Alors on ne peut l'attaquer qu'en visant
  // l'un d'eux. Sinon, on peut attaquer tout son territoire de front.
  isProtected(pid) {
    return this.targetsOf(pid).length > 0;
  },

  // Encerclement : un royaume reste d'un seul tenant (sur chaque île). Quand il est coupé en morceaux, il ne
  // garde que le plus grand de l'île (son cœur, voir regions) ; tous les autres, quelle que soit leur taille, sont englobés d'un coup par le royaume qui
  // l'a coupé (cutter), avec leurs églises, ports, moulins et casernes. Sans coupeur connu (ou s'il ne touche
  // pas le morceau), c'est le royaume qui l'entoure le plus qui le prend.
  // Exceptions :
  // - les châteaux et les ports de niveau 3 savent se défendre (holdsAlone) : ils restent au royaume, isolés,
  //   avec les terres de leur zone (et les bâtiments qui s'y trouvent) ;
  // - un morceau avec un avant-poste ou une colonie (invasion par la mer) se défend : il faut viser l'avant-poste.
  captureEnclaves(target, cutter = -1) {
    const T = this.players[target];
    if (!T.alive) return;
    const r = this.regions(true), pieces = [];
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] !== target || r.heart[k]) continue;
      if (r.anyOutpost[k] || r.colony[k]) continue;
      pieces.push(Array.from(r.order.subarray(r.start[k], r.start[k] + r.size[k])));
    }
    for (const tiles of pieces) {
      // Les châteaux et ports de niveau 3 du morceau, et les terres de leur zone, restent au royaume
      const keep = tiles.filter(i => this.anchor[i] === i && this.building[i] && this.holdsAlone(i));
      const kept = i => keep.some(c => this.building[c] === B_CASTLE
        ? this.inCastleRange(c, i % this.W, (i / this.W) | 0, this.castleInfo(c).radius)
        : this.inChurchRange(c, i, this.buildingInfo(c).radius)); // (zone du port, celle de sa muraille)
      // Les royaumes qui touchent ce morceau (pas les alliés de target), avec la longueur de leur frontière
      const around = new Map();
      for (const i of tiles) {
        this.forNeighbors(i, n => {
          const o = this.owner[n];
          if (o >= 0 && o !== target && !this.areAllied(o, target)) around.set(o, (around.get(o) || 0) + 1);
        });
      }
      let winner = -1, best = 0;
      if (around.has(cutter) && this.players[cutter].alive) winner = cutter;
      else for (const [o, c] of around) if (c > best && this.players[o].alive) { best = c; winner = o; }
      if (winner < 0) continue;
      let took = 0;
      for (const i of tiles) {
        if (this.owner[i] !== target || kept(i)) continue;
        // un bâtiment à cheval sur une zone gardée reste au royaume
        if (this.building[i] && this.footprint(this.anchor[i], this.building[i]).some(kept)) continue;
        // les garnisons des bâtiments pris se rendent
        if (this.building[i] && this.anchor[i] === i) this.garrison[i] = 0;
        this.setOwner(i, winner);
        took++;
      }
      // Message seulement pour un gros morceau (ou un château isolé) : sinon, les petits bouts coupés spammeraient
      if (!took || (took < CONFIG.ENCLAVE_LOG_MIN && !keep.length)) continue;
      const A = this.players[winner];
      const keepTxt = keep.length ? ` ${keep.length > 1 ? 'Ses châteaux (ou ports) tiennent' : (this.building[keep[0]] === B_CASTLE ? 'Son château tient' : 'Son port tient')} encore, isolé${keep.length > 1 ? 's' : ''}.` : '';
      if (A.isHuman) UI.log(`✂️ Des terres ${this.deName(T.name)}, coupées de leur royaume, sont englobées par le tien !${keepTxt}`, 'good', T);
      else if (T.isHuman) {
        UI.log(`✂️ Une partie de ton royaume, coupée du reste, est englobée par ${A.name} !` +
          (keep.length ? ' Ce qui est isolé tient encore : clique dessus pour lancer un assaut qui le relie à ton royaume.' : ''), 'warn', A);
      }
    }
  },

  // --- Attaques ---
  // (on n'attaque que depuis son propre territoire, ou depuis un avant-poste)
  // Les cases de target qui touchent nos terres (celles d'où l'armée peut partir, voir touchesOwn).
  // On part de nos propres cases (bien moins nombreuses que la carte entière) et on regarde leurs voisines.
  buildFrontier(pid, target, source) {
    const list = [], W = this.W, N = this.N, own = this.owner, seen = new Set();
    for (let i = 0; i < N; i++) {
      if (own[i] !== pid) continue;
      const x = i % W;
      let ok; // cette case peut-elle servir de départ ? (calculé seulement si besoin)
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
        if (n < 0 || own[n] !== target || seen.has(n) || !this.claimable(n)) continue;
        if (ok === undefined) ok = source === undefined ? this.isBase(i) : this.sourceOf(i) === source;
        if (!ok) break;
        seen.add(n);
        list.push(n);
      }
    }
    return list;
  },

  // target = -1 pour les terres libres. aimTile = case visée (pour la flèche sur la carte).
  // source = d'où part l'armée : -1 = le royaume (par défaut), sinon un avant-poste et ses soldats stationnés.
  // Renvoie un message d'erreur, ou null.
  launchAttack(pid, target, troops, aimTile, source = -1) {
    const p = this.players[pid];
    if (source >= 0 && !(this.owner[source] === pid && this.outpostReady(source))) {
      return 'Cet avant-poste ne peut pas (ou plus) lancer d\'attaque.';
    }
    troops = Math.floor(Math.min(troops, this.troopsAt(pid, source)));
    if (target === pid) return null;
    if (target >= 0 && this.areAllied(pid, target)) {
      return `${this.players[target].name} est ton allié ! Romps l'alliance d'abord.`;
    }
    if (troops < 1) return 'Pas assez de soldats !';
    const frontier = this.buildFrontier(pid, target, source);
    if (frontier.length === 0) {
      // (un avant-poste en construction ne sert pas encore de base : ses soldats bâtissent)
      const building = [...this.outposts.keys()].some(a => this.owner[a] === pid && !this.outpostReady(a));
      if (this.hasUnlinked(pid)) {
        return 'Ton territoire est coupé de tous tes châteaux : tes armées ne peuvent plus en partir. ' +
          'Relie-le à un château (clique sur ton château isolé pour lancer un assaut de jonction) ou bâtis-en un nouveau.';
      }
      return (target < 0 ? 'Aucune terre libre à ta frontière.' : `Tu n'as pas de frontière avec ${this.players[target].name}.`) +
        (building ? ' Ton avant-poste est encore en construction : ses soldats ne pourront attaquer qu\'une fois les travaux finis.' : '');
    }
    // Un royaume qui a encore un château ou une église ne s'attaque qu'en visant l'un d'eux.
    // Sans château ni église, on peut attaquer tout son territoire de front (comme une terre libre).
    // castle = château ou église visé par l'assaut
    // unlinked = cases d'un morceau coupé de tous ses châteaux (voir isUnlinked) : attaque de front, sans défenseurs
    let castle = -1, path = null, unlinked = null, front = frontier;
    if (target >= 0 && this.isProtected(target)) {
      const name = this.players[target].name, b = aimTile !== undefined ? this.building[aimTile] : 0;
      if (TARGET_TYPES.includes(b) && this.owner[aimTile] === target) castle = this.anchor[aimTile];
      else if (aimTile !== undefined && this.owner[aimTile] === target) unlinked = this.unlinkedPiece(aimTile);
      if (castle < 0 && !unlinked) {
        return `${name} est protégé : clique sur un de ses châteaux, églises, ports ou avant-postes pour lancer un assaut ` +
          '(ou sur un morceau de son royaume coupé de tous ses châteaux).';
      }
      if (unlinked) {
        front = frontier.filter(t => unlinked.has(t));
        if (!front.length) return 'Tu ne touches pas ce morceau de son royaume : impossible de l\'attaquer d\'ici.';
      }
    }
    // Assauts déjà en cours contre ce royaume : on renforce celui qui vise la même cible ; sinon on en lance
    // un nouveau, s'il en reste (1 à la fois, 2 avec une citadelle)
    const running = this.attacks.filter(a => !a.done && a.attacker === pid && a.target === target && a.link === undefined
      && this.sourceOfAttack(a) === source && a.retreatEnd === undefined); // (une armée en retraite ne reçoit plus de renforts)
    let a = running.find(a => a.targetCastle === castle);
    if (!a && running.length >= this.maxAssaults(pid)) {
      return `Un assaut contre ${this.players[target].name} est déjà en cours.` +
        (this.maxAssaults(pid) < CONFIG.CITADEL_ASSAULTS ? ' (Avec une citadelle, un château de niveau 3, tu pourrais en lancer 2 à la fois.)' : '');
    }
    if (castle >= 0) {
      const name = this.players[target].name;
      path = this.castlePath(pid, castle, source);
      if (!path) {
        return `Impossible d'atteindre ${this.targetLabel(castle)} : ` +
          `des fortifications ${this.deName(name)} bloquent le passage. Prends d'abord les châteaux de la frontière.`;
      }
    }
    // Assaut déjà sur les terres ennemies : les renforts partent de sa cité et marchent jusqu'au front (reinforceTicks)
    // (pendant sa marche sur nos terres, les soldats en plus le rejoignent tout de suite, plus bas)
    if (a && target >= 0 && !this.isPreparing(a)) {
      this.takeTroops(pid, source, troops);
      a.pending.push({ troops, tick: this.tick + this.reinforceTicks(a) });
      return null;
    }
    if (!a) {
      a = {
        id: this.nextAttackId++, attacker: pid, target, troops: 0, done: false, startTick: this.tick,
        targetCastle: castle,
        source,        // d'où part l'armée (-1 = royaume, sinon avant-poste)
        defenders: 0,  // soldats envoyés par le défenseur pour contrer cet assaut
        pending: [],   // renforts en route : { troops, tick d'arrivée }
        frontTile: -1, // case où se trouve l'assaut (pour la défense du terrain)
      };
      if (unlinked) a.unlinked = true; // (morceau coupé de ses châteaux : personne ne vient le défendre)
      if (target >= 0) {
        // Contre un royaume, l'armée part de sa cité la plus proche (ou de son avant-poste) et marche
        // sur ses propres terres jusqu'à la frontière : tout le monde la voit venir
        this.aimArrow(a, front, aimTile);
        // Assaut sur un château (une église…) : l'armée entre chez l'ennemi là où commence son chemin ;
        // elle marche jusque-là depuis sa cité la plus proche (et la flèche part de là)
        if (path) this.entryFromPath(a, path, source);
        const secs = this.startMarch(a, a.startTile);
        if (this.players[target].isHuman) {
          const alone = castle >= 0 && this.building[castle] === B_OUTPOST;
          UI.log(`⚠️ L'armée ${this.deName(p.name)} (${fmt(troops)} soldats) marche vers ta frontière : elle attaque dans ${secs} s ! ` +
            (castle < 0 ? 'Sans château ni église, toutes tes troupes défendront d\'office, désorganisées.'
              : alone ? 'Il vise ton avant-poste : seuls les soldats débarqués le défendront.'
              : 'Clique sur sa bannière ou sur « Défendre » pour envoyer tes soldats.'), 'warn', p);
        }
      }
      this.attacks.push(a);
    }
    a.list = front;
    a.set = new Set(front);
    if (unlinked) a.limitZone = unlinked; // (l'assaut reste dans ce morceau)
    if (castle >= 0 && !a.castleTaken) {
      a.limitZone = this.corridor(castle, path);
      if (a.frontTile < 0 || this.owner[a.frontTile] !== target) a.frontTile = path[0]; // on se bat au début du chemin
    }
    this.takeTroops(pid, source, troops);
    a.troops += troops;
    return null;
  },

  sourceOfAttack(a) { return a.source === undefined ? -1 : a.source; },

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
  castlePath(pid, c, source) {
    const passable = this.castlePassable(c), foot = new Set(this.footprint(c, this.building[c]));
    return this.searchPath(pid, -1, foot, passable, this.owner[c], source); // (-1 = on part de la frontière)
  },

  // Recherche du chemin le plus facile (algorithme de Dijkstra) depuis la case from
  // (ou depuis toute la frontière de pid si from = -1) jusqu'à une case de goal.
  searchPath(pid, from, goal, passable, target, source) {
    const dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-2);
    const done = new Uint8Array(this.N); // cases déjà traitées (chacune une seule fois)
    const heap = new MinHeap();
    const start = i => { dist[i] = this.tileDefense(target, i); prev[i] = -1; heap.push(dist[i], i); };
    if (from >= 0) start(from);
    else {
      // départ : les cases passables qui touchent nos terres (on part de nos cases, bien moins nombreuses que la carte)
      const W = this.W, N = this.N, own = this.owner;
      for (let i = 0; i < N; i++) {
        if (own[i] !== pid) continue;
        const x = i % W;
        let ok;
        for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
          if (n < 0 || own[n] === pid || prev[n] !== -2 || !passable(n)) continue;
          if (ok === undefined) ok = source === undefined ? this.isBase(i) : this.sourceOf(i) === source;
          if (!ok) break;
          start(n);
        }
      }
    }
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

  // Pour les bots : les 3 cibles du royaume target les plus proches du cœur de pid
  // (calculer un chemin coûte cher : on ne le fait pas pour toutes)
  nearestTargets(pid, target) {
    const p = this.players[pid], cx = p.sumX / p.tiles, cy = p.sumY / p.tiles;
    const d = a => (a % this.W - cx) ** 2 + (((a / this.W) | 0) - cy) ** 2;
    return this.targetsOf(target).sort((a, b) => d(a) - d(b)).slice(0, 3);
  },

  // Pour les bots : quel château viser, et quelle défense de terrain attendre au premier combat ?
  // castle : null = pas de château (attaque de front), -1 = aucun atteignable, sinon le château.
  // (gardé 2 secondes en mémoire : chercher les chemins coûte cher sur une grande carte)
  planAssault(pid, target) {
    if (!this.isProtected(target)) return { castle: null, D: 1.3 };
    const key = pid * 1000 + target, old = (this.assaultPlans = this.assaultPlans || new Map()).get(key);
    if (old && this.tick - old.tick < 2 * CONFIG.TICKS_PER_SECOND && (old.plan.castle < 0 || this.owner[old.plan.castle] === target)) return old.plan;
    const plan = this.computeAssaultPlan(pid, target);
    this.assaultPlans.set(key, { tick: this.tick, plan });
    return plan;
  },
  computeAssaultPlan(pid, target) {
    // Un morceau de son royaume, coupé de tous ses châteaux, touche nos terres : proie facile (personne ne le défend)
    const loose = this.hasUnlinked(target) ? this.buildFrontier(pid, target).find(t => this.isUnlinked(t)) : undefined;
    if (loose !== undefined) return { castle: null, D: this.tileDefense(target, loose), tile: loose };
    const castles = this.nearestTargets(pid, target);
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
    const castles = this.nearestTargets(pid, target);
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
    const r = this.regionsAt(c), k = r.comp[c];
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
    // (départ : les cases qui touchent le cœur de son royaume, même s'il est coupé de ses châteaux)
    const r = this.regions(true), heartOf = n => this.owner[n] === pid && r.comp[n] >= 0 && r.heart[r.comp[n]];
    for (let i = 0; i < this.N; i++) {
      if (passable(i) && this.hasNeighbor(i, heartOf)) {
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
    if (this.owner[c] !== pid || !this.holdsAlone(c) || !this.isIsolated(c)) return 'Ce bâtiment n\'est pas coupé de ton royaume.';
    if (troops < 1) return 'Pas assez de soldats !';
    let a = this.linkFor(c);
    if (a) {
      p.troops -= troops;
      // Pendant la préparation, les soldats s'ajoutent tout de suite ; ensuite, ce sont des renforts
      if (this.isPreparing(a)) a.troops += troops;
      else a.pending.push({ troops, tick: this.tick + this.reinforceTicks(a) });
      return null;
    }
    const route = this.linkRoute(pid, c);
    if (!route) return 'Impossible de le rejoindre : des murailles ennemies bloquent le passage.';
    const half = this.sizeOf(this.building[c]) / 2;
    a = {
      id: this.nextAttackId++, attacker: pid, target: route.target, troops, done: false,
      targetCastle: -1, link: c, // link = château isolé à rejoindre
      defenders: 0, pending: [], frontTile: route.path[0], path: route.path, piece: route.piece,
      fromX: p.sumX / p.tiles + 0.5, fromY: p.sumY / p.tiles + 0.5,
      toX: c % this.W + half, toY: ((c / this.W) | 0) + half,
    };
    // Comme tout assaut contre un royaume : l'armée marche d'abord jusqu'à la frontière, et tout le monde la voit
    let edge = -1;
    this.forNeighbors(route.path[0], n => { if (edge < 0 && this.owner[n] === pid) edge = n; });
    this.startMarch(a, edge);
    a.list = this.buildFrontier(pid, route.target);
    a.set = new Set(a.list);
    a.limitZone = this.corridor(c, route.path, route.passable);
    p.troops -= troops;
    this.attacks.push(a);
    if (this.players[route.target].isHuman) {
      UI.log(`⚠️ ${p.name} prépare un assaut à travers tes terres pour rejoindre son ${this.building[c] === B_PORT ? 'port' : 'château'} isolé (${fmt(troops)} soldats) !`, 'warn', p);
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
      const add = Math.min(Math.max(0, this.garrisonMax(c) - this.garrison[c]), a.troops);
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

  // --- Ports et expéditions maritimes ---
  // Les bateaux naviguent sur la mer, les fleuves et les grands fleuves.
  navigable(i) {
    const t = this.terrain[i];
    return t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.GREAT_RIVER;
  },

  // Case de terre (pas un fleuve) au bord de l'eau
  isCoastal(i) {
    if (!this.isLand(i) || this.terrain[i] === TERRAIN.RIVER) return false;
    let found = false;
    this.forNeighbors(i, n => { if (this.navigable(n)) found = true; });
    return found;
  },

  // Trajet en bateau (cases d'eau) du port a jusqu'à la côte i, ou null si on ne peut pas y aller
  boatPath(a, i) {
    const prev = new Int32Array(this.N).fill(-2), queue = [], goal = new Set();
    this.forNeighbors(i, n => { if (this.navigable(n)) goal.add(n); });
    for (const j of this.footprint(a, B_PORT)) {
      this.forNeighbors(j, n => { if (this.navigable(n) && prev[n] === -2) { prev[n] = -1; queue.push(n); } });
    }
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      if (goal.has(c)) {
        const path = [];
        for (let j = c; j >= 0; j = prev[j]) path.push(j);
        return path.reverse();
      }
      this.forNeighbors(c, n => { if (prev[n] === -2 && this.navigable(n)) { prev[n] = c; queue.push(n); } });
    }
    return null;
  },

  // Ports de pid qui peuvent lancer des expéditions (niveau 2 ou plus)
  expeditionPorts(pid) {
    return this.buildingTiles.filter(a => this.building[a] === B_PORT && this.owner[a] === pid && this.buildingInfo(a).boatSpeed > 0);
  },

  // Peut-on débarquer sur cette case ? Terre libre ou ennemie (pas à soi ni à un allié), sans bâtiment :
  // un débarquement ne prend jamais un bâtiment, il se pose à côté.
  landable(pid, j) {
    const o = this.owner[j];
    return this.isLand(j) && !this.building[j] && o !== pid && (o < 0 || !this.areAllied(pid, o));
  },

  // Terres prises en débarquant sur la côte i : une petite zone autour (un demi-cercle le long de la côte),
  // et la place de l'avant-poste (anchor = -1 s'il n'y a pas la place).
  landingZone(pid, i) {
    const R = CONFIG.LANDING_RADIUS, W = this.W, x0 = i % W, y0 = (i / W) | 0;
    const ok = j => this.landable(pid, j) && (j % W - x0) ** 2 + (((j / W) | 0) - y0) ** 2 <= R * R;
    const zone = new Set(ok(i) ? [i] : []);
    for (const j of zone) this.forNeighbors(j, n => { if (!zone.has(n) && ok(n)) zone.add(n); });
    // Place de l'avant-poste : 2x2 cases prises (pas sur un fleuve), au plus près du point de débarquement
    let anchor = -1, best = Infinity;
    for (const a of zone) {
      if (a % W >= W - 1) continue;
      const cells = this.footprint(a, B_OUTPOST);
      if (!cells.every(j => zone.has(j) && this.terrain[j] !== TERRAIN.RIVER)) continue;
      const d = (a % W - x0) ** 2 + (((a / W) | 0) - y0) ** 2;
      if (d < best) { best = d; anchor = a; }
    }
    return { tiles: [...zone], anchor };
  },

  // La côte où débarquer la plus proche de la case i (à moins de R cases), ou -1 : on n'a pas besoin de cliquer
  // pile sur la côte (au zoom normal, elle ne fait que quelques pixels), même un clic dans l'eau tout près suffit
  nearestCoast(pid, i, R = 3) {
    const W = this.W, x0 = i % W, y0 = (i / W) | 0;
    let best = -1, bestD = Infinity;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = x0 + dx, y = y0 + dy, d = dx * dx + dy * dy;
        if (x < 0 || y < 0 || x >= W || y >= this.H || d > R * R || d >= bestD) continue;
        const j = y * W + x;
        if (this.isCoastal(j) && this.landable(pid, j)) { best = j; bestD = d; }
      }
    }
    return best;
  },

  // Prépare un débarquement de pid sur la côte i : { error } ou { port, path, time, cost, zone }
  planLanding(pid, i) {
    const p = this.players[pid];
    const ports = this.expeditionPorts(pid);
    if (!ports.length) return { error: 'Il te faut un port de niveau 2 pour les expéditions maritimes.' };
    if (!this.landable(pid, i) || !this.isCoastal(i)) {
      return { error: 'On débarque sur une côte (au bord de la mer ou d\'un fleuve) qui n\'est ni à toi ni à un allié, à côté des bâtiments.' };
    }
    if (this.expeditions.some(e => e.pid === pid && e.landing === i && e.home === undefined)) return { error: 'Une expédition est déjà en route vers cette côte.' };
    const zone = this.landingZone(pid, i);
    if (zone.anchor < 0) return { error: 'Pas assez de place sur cette côte pour un avant-poste.' };
    // Le port le plus rapide pour y aller
    let best = null;
    for (const a of ports) {
      const path = this.boatPath(a, i);
      if (!path) continue;
      const time = path.length / this.buildingInfo(a).boatSpeed; // en secondes
      if (!best || time < best.time) best = { port: a, path, time };
    }
    if (!best) return { error: 'Aucun de tes ports ne peut rejoindre cette côte par l\'eau.' };
    best.cost = Math.round(this.buildCost(p, B_OUTPOST) * this.buildingInfo(best.port).landingCost);
    // assez de soldats pour remplir la garnison de l'avant-poste une fois arrivés
    best.minTroops = Math.ceil(CONFIG.OUTPOST_GARRISON / (1 - this.seaLoss(best.time)));
    best.zone = zone;
    return best;
  },

  // Rapatrier les soldats stationnés d'un avant-poste : ils rembarquent vers le port le plus proche (n'importe
  // quel niveau) et rejoignent l'armée en arrivant (pertes en mer comprises). La garnison, elle, reste.
  // Renvoie un message d'erreur, ou null.
  repatriate(pid, a) {
    const p = this.players[pid], o = this.outposts.get(a);
    if (!o || this.owner[a] !== pid) return 'Ce n\'est pas un de tes avant-postes.';
    if (!this.outpostReady(a)) return 'L\'avant-poste est encore en construction : ses soldats bâtissent.';
    const troops = Math.floor(o.stationed);
    if (troops < 1) return 'Aucun soldat n\'attend à cet avant-poste (sa garnison, elle, reste sur place).';
    let best = null;
    for (const b of this.buildingTiles) {
      if (this.building[b] !== B_PORT || this.owner[b] !== pid) continue;
      const path = this.boatPath(b, o.landing);
      if (!path) continue;
      const time = path.length / Math.max(this.buildingInfo(b).boatSpeed, CONFIG.REPATRIATE_SPEED);
      if (!best || time < best.time) best = { port: b, path, time };
    }
    if (!best) return 'Aucun de tes ports n\'est relié par l\'eau à cet avant-poste.';
    o.stationed -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: o.landing, home: best.port,
      path: best.path.slice().reverse(), sent: troops,
      troops: troops * (1 - this.seaLoss(best.time)),
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(best.time * TPS)) });
    return null;
  },

  // Part des soldats perdus pendant une traversée de `time` secondes
  seaLoss(time) { return Math.min(CONFIG.SEA_LOSS_MAX, time * CONFIG.SEA_LOSS_PER_SECOND); },

  // Lance une expédition avec `troops` soldats : le bateau part du port et débarque en arrivant.
  // Les soldats arrivés défendent l'avant-poste. Renvoie un message d'erreur, ou null.
  launchExpedition(pid, i, troops) {
    const plan = this.planLanding(pid, i), p = this.players[pid];
    if (plan.error) return plan.error;
    // Une expédition au plus toutes les EXPEDITION_COOLDOWN secondes
    if (p.lastExpedition !== undefined && this.tick - p.lastExpedition < CONFIG.EXPEDITION_COOLDOWN * CONFIG.TICKS_PER_SECOND) {
      return '⛵ Tes bateaux ne sont pas encore prêts.';
    }
    if (p.gold < plan.cost) return `Pas assez d'or pour l'expédition (💰 ${plan.cost}).`;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < plan.minTroops) {
      return `Il faut au moins ${plan.minTroops} soldats pour l'expédition : de quoi remplir la garnison ` +
        'de l\'avant-poste (pertes en mer comprises).';
    }
    p.gold -= plan.cost;
    p.troops -= troops;
    p.lastExpedition = this.tick;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: i, path: plan.path, cost: plan.cost, sent: troops,
      troops: troops * (1 - this.seaLoss(plan.time)), // ceux qui arriveront
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(plan.time * TPS)) });
    // Prévenir les royaumes dont la côte est visée
    const o = this.owner[i];
    if (o >= 0 && this.players[o].isHuman) {
      UI.log(`⛵ ${p.name} envoie une expédition vers ta côte ! Tiens-toi prêt à attaquer son avant-poste quand elle accostera.`, 'warn', p);
    }
    return null;
  },

  // Les bateaux arrivés débarquent : ils prennent les terres libres autour et y bâtissent un avant-poste
  // --- Traversée de fleuve ---
  // Pour prendre des terres libres de l'autre côté d'un fleuve (pas le grand fleuve, infranchissable) :
  // l'armée part de ses terres, passe le fleuve à gué (lentement) et prend une tête de pont sur l'autre rive.
  // Renvoie { path, river, time } (path : de nos terres jusqu'à la case visée i) ou { error }.
  planCrossing(pid, i) {
    if (this.owner[i] !== -1 || !this.isLand(i) || this.terrain[i] === TERRAIN.RIVER) {
      return { error: 'Il faut viser une terre libre, de l\'autre côté du fleuve.' };
    }
    const W = this.W, x0 = i % W, y0 = (i / W) | 0;
    const near = (j, R) => (j % W - x0) ** 2 + (((j / W) | 0) - y0) ** 2 <= R * R;
    // Recherche en largeur depuis la case visée : on passe par les terres libres de la rive (tout près),
    // puis par le fleuve, jusqu'à une case de fleuve qui touche nos terres
    const prev = new Map([[i, -1]]), queue = [i];
    for (let q = 0; q < queue.length; q++) {
      const t = queue[q];
      if (this.terrain[t] === TERRAIN.RIVER) {
        let from = -1;
        this.forNeighbors(t, n => { if (from < 0 && this.owner[n] === pid && this.isBase(n)) from = n; });
        if (from >= 0) {
          const path = [from];
          for (let k = t; k >= 0; k = prev.get(k)) path.push(k);
          const river = path.filter(k => this.terrain[k] === TERRAIN.RIVER).length;
          return { path, river, time: CONFIG.CROSSING_TIME_FIRST + Math.max(0, river - 1) * CONFIG.CROSSING_TIME_NEXT };
        }
      }
      this.forNeighbors(t, n => {
        if (prev.has(n) || this.owner[n] !== -1 || !this.isLand(n)) return;
        const ok = this.terrain[n] === TERRAIN.RIVER ? near(n, CONFIG.CROSSING_MAX_DISTANCE) : near(n, CONFIG.CROSSING_BANK_RADIUS);
        if (!ok) return;
        prev.set(n, t);
        queue.push(n);
      });
    }
    return { error: 'Pas de gué ici : il faut un fleuve entre tes terres et cette terre libre (le grand fleuve, lui, est infranchissable).' };
  },

  // Lance une traversée de fleuve vers la terre libre i. Renvoie un message d'erreur, ou null.
  // Traverser ne coûte aucun soldat : seulement du temps (CROSSING_TIME_FIRST / CROSSING_TIME_NEXT).
  launchCrossing(pid, i) {
    const plan = this.planCrossing(pid, i);
    if (plan.error) return plan.error;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.crossings.push({ pid, target: i, path: plan.path, start: this.tick,
      arrive: this.tick + Math.max(1, Math.round(plan.time * TPS)) });
    return null;
  },

  // Arrivée des traversées : on prend une tête de pont sur l'autre rive (le fleuve, lui, reste neutre).
  // Si quelqu'un a pris le passage entre-temps, la traversée échoue et les soldats rentrent.
  stepCrossings() {
    for (const c of this.crossings) {
      if (this.tick < c.arrive) continue;
      c.done = true;
      const p = this.players[c.pid];
      if (!p.alive) continue;
      const blocked = c.path.slice(1).some(t => this.terrain[t] !== TERRAIN.RIVER && this.owner[t] !== -1 && this.owner[t] !== c.pid);
      if (blocked || this.owner[c.path[0]] !== c.pid) {
        if (p.isHuman) UI.log('🚫 Le passage du fleuve a été pris par un autre : la traversée échoue.', 'warn');
        continue;
      }
      // Les terres libres de la rive autour de la case visée (sans repasser par le fleuve) ; le fleuve reste neutre
      const R = CONFIG.CROSSING_BANK_RADIUS, W = this.W, x0 = c.target % W, y0 = (c.target / W) | 0;
      const bank = new Set([c.target]);
      for (const j of bank) {
        this.forNeighbors(j, n => {
          if (bank.has(n) || this.owner[n] !== -1 || !this.isLand(n) || this.terrain[n] === TERRAIN.RIVER) return;
          if ((n % W - x0) ** 2 + (((n / W) | 0) - y0) ** 2 <= R * R) bank.add(n);
        });
      }
      // (la tête de pont ne coûte aucun soldat : seulement le temps de la traversée)
      for (const t of [...c.path.slice(1), ...bank]) {
        if (this.owner[t] === c.pid || !this.claimable(t)) continue; // (le gué, lui, reste neutre)
        this.setOwner(t, c.pid);
      }
      if (p.isHuman) UI.log('🛶 Tes soldats ont traversé le fleuve : la terre de l\'autre rive est à toi !', 'good');
    }
    this.crossings = this.crossings.filter(c => !c.done);
  },

  stepExpeditions() {
    // Renforts en mer vers un avant-poste qui n'existe plus : demi-tour vers leur port (même trajet en sens
    // inverse, aussi long que le chemin déjà fait) ; en arrivant, ils rejoignent l'armée
    for (const e of this.expeditions) {
      if (e.reinforce === undefined || e.done || this.tick >= e.arrive) continue;
      if (this.building[e.reinforce] === B_OUTPOST && this.owner[e.reinforce] === e.pid) continue;
      const k = Math.min(1, (this.tick - e.start) / Math.max(1, e.arrive - e.start));
      const idx = Math.min(e.path.length - 1, Math.floor(k * e.path.length));
      const back = Math.max(1, this.tick - e.start);
      e.reinforce = undefined;
      e.home = e.port;
      e.path = e.path.slice(0, idx + 1).reverse();
      e.start = this.tick;
      e.arrive = this.tick + back;
      if (this.players[e.pid].isHuman) UI.log('⛵ Ton avant-poste est tombé : tes renforts font demi-tour vers le port.', 'warn');
    }
    for (const e of this.expeditions) {
      if (this.tick < e.arrive) continue;
      e.done = true;
      const p = this.players[e.pid];
      if (!p.alive) continue;
      // Soldats rapatriés d'un avant-poste : ils rejoignent l'armée
      if (e.home !== undefined) {
        p.troops += e.troops;
        if (p.isHuman) UI.log(`🚢 ${fmt(e.troops)} soldats rapatriés sont rentrés au port.`, 'good');
        continue;
      }
      // Renforts pour un avant-poste : ils rejoignent sa garnison (ou rentrent s'il n'existe plus)
      if (e.reinforce !== undefined) {
        if (this.building[e.reinforce] === B_OUTPOST && this.owner[e.reinforce] === e.pid) {
          // bâti : on complète la garnison, les autres stationnent (prêts à agir) ; en construction : tous bâtissent
          const a = e.reinforce, o = this.outposts.get(a);
          if (this.outpostReady(a)) {
            const add = Math.min(e.troops, Math.max(0, CONFIG.OUTPOST_GARRISON - this.garrison[a]));
            this.garrison[a] += add;
            o.stationed += e.troops - add;
          } else this.garrison[a] += e.troops;
          if (p.isHuman) UI.log(`⛺ ${fmt(e.troops)} soldats renforcent ton avant-poste.`, 'good');
        } else {
          p.troops += e.troops;
          if (p.isHuman) UI.log('⛵ Ton avant-poste n\'existe plus : les renforts rentrent.', 'warn');
        }
        continue;
      }
      const zone = this.landingZone(e.pid, e.landing);
      if (!this.landable(e.pid, e.landing) || zone.anchor < 0) {
        p.gold += e.cost; // la côte n'est plus possible (prise par soi ou un allié, bâtie…) : l'or est rendu
        p.troops += e.troops; // et les soldats rentrent
        if (p.isHuman) UI.log('⛵ Impossible de débarquer sur la côte visée : l\'expédition rentre (or et soldats rendus).', 'warn');
        continue;
      }
      const victims = new Set(zone.tiles.map(j => this.owner[j]).filter(o => o >= 0));
      for (const j of zone.tiles) this.setOwner(j, e.pid);
      for (const o of victims) {
        if (this.players[o].isHuman) UI.log(`⛵ ${p.name} a débarqué sur ta côte et y a planté un avant-poste ! Vise-le pour le détruire.`, 'warn', p);
      }
      this.placeBuilding(zone.anchor, B_OUTPOST);
      this.garrison[zone.anchor] = e.troops; // tous les soldats débarqués défendent l'avant-poste
      this.outposts.set(zone.anchor, { ready: this.tick + CONFIG.OUTPOST_BUILD_TIME * CONFIG.TICKS_PER_SECOND,
        landing: e.landing, stationed: 0 });
      if (p.isHuman) {
        UI.log(`⛺ Débarquement réussi ! ${fmt(e.troops)} soldats défendent ton avant-poste ` +
          `(${fmt(e.sent - e.troops)} perdus en mer). Il sera bâti dans ${CONFIG.OUTPOST_BUILD_TIME} s.`, 'good');
        Render.floatText(zone.anchor, B_OUTPOST, '⛵ Débarquement !');
      }
    }
    this.expeditions = this.expeditions.filter(e => !e.done);
  },

  // Flèche de l'attaque : de la frontière du royaume attaquant (un peu à l'intérieur de ses terres)
  // vers la case visée (ou, à défaut, vers la case du front la plus proche de son cœur).
  aimArrow(a, frontier, aimTile) {
    const p = this.players[a.attacker], W = this.W;
    const cx = p.sumX / p.tiles, cy = p.sumY / p.tiles; // cœur du royaume
    const dist2 = (t, x, y) => (t % W - x) ** 2 + (((t / W) | 0) - y) ** 2;
    let aim = aimTile;
    if (aim === undefined || this.owner[aim] !== a.target) {
      let best = Infinity;
      for (const t of frontier) if (dist2(t, cx, cy) < best) { best = dist2(t, cx, cy); aim = t; }
    }
    const ax = aim % W, ay = (aim / W) | 0;
    a.toX = ax + 0.5;
    a.toY = ay + 0.5;
    // Cible sur un bâtiment (château, église…) : on vise son centre
    if (this.building[aim]) {
      const b = this.anchor[aim], half = this.sizeOf(this.building[b]) / 2;
      a.toX = b % W + half;
      a.toY = ((b / W) | 0) + half;
    }
    // Départ : la case de nos terres, au bord du front, la plus proche de la cible...
    let start = -1, best = Infinity;
    for (const t of frontier) {
      this.forNeighbors(t, n => {
        if (this.owner[n] === a.attacker && dist2(n, ax, ay) < best) { best = dist2(n, ax, ay); start = n; }
      });
    }
    a.startTile = start; // case de la frontière d'où partira l'assaut (sa bannière s'y plante pendant la préparation)
    if (start < 0) { a.fromX = cx + 0.5; a.fromY = cy + 0.5; return; }
    // ...puis on recule de quelques cases vers l'intérieur (si ces cases sont encore à nous)
    const sx = start % W, sy = (start / W) | 0, len = Math.hypot(sx - ax, sy - ay) || 1;
    for (let back = CONFIG.ARROW_INSIDE; back >= 0; back--) {
      const x = Math.round(sx + (sx - ax) / len * back), y = Math.round(sy + (sy - ay) / len * back);
      if (x >= 0 && y >= 0 && x < W && y < this.H && this.owner[y * W + x] === a.attacker) {
        a.fromX = x + 0.5;
        a.fromY = y + 0.5;
        return;
      }
    }
  },

  // La case de nos terres d'où l'armée entrera sur le chemin path (sa première case chez l'ennemi)
  entryFromPath(a, path, source) {
    let entry = -1;
    this.forNeighbors(path[0], n => {
      if (entry >= 0 || this.owner[n] !== a.attacker) return;
      if (source >= 0 ? this.sourceOf(n) === source : this.isBase(n)) entry = n;
    });
    if (entry < 0) return;
    a.startTile = entry;
    a.fromX = entry % this.W + 0.5;
    a.fromY = ((entry / this.W) | 0) + 0.5;
  },

  // Temps (en ticks) que mettent des renforts à rejoindre l'assaut a : ils partent de la cité d'où l'assaut
  // est parti et marchent jusqu'au front (MARCH_SPEED cases par seconde, au moins REINFORCE_MIN_TIME secondes).
  // Plus l'armée s'est enfoncée loin de sa cité, plus ils mettent de temps.
  reinforceTicks(a) {
    const TPS = CONFIG.TICKS_PER_SECOND, p = this.players[a.attacker];
    const from = a.marchFrom || { x: p.sumX / Math.max(1, p.tiles) + 0.5, y: p.sumY / Math.max(1, p.tiles) + 0.5 };
    const to = this.attackFront(a), dist = Math.hypot(to.x - from.x, to.y - from.y);
    return Math.round(Math.max(CONFIG.REINFORCE_MIN_TIME, dist / CONFIG.MARCH_SPEED) * TPS);
  },

  // Le morceau visé par cet assaut (coupé de ses châteaux) est-il de nouveau relié à un château ?
  unlinkedRelinked(a) {
    for (const t of a.limitZone) if (this.owner[t] === a.target) return !this.isUnlinked(t);
    return false; // (tout est pris : l'assaut finit de lui-même)
  },

  // L'armée est-elle encore en marche sur ses propres terres (pas encore entrée chez l'ennemi) ?
  isPreparing(a) { return this.tick < a.startTick; },

  // Départ d'un assaut contre un royaume : l'armée part de la cité (château) de son royaume la plus proche
  // de la frontière visée (ou de son avant-poste) et marche sur ses terres jusqu'à la case edge, à
  // MARCH_SPEED cases par seconde. Pendant cette marche, les soldats en plus la rejoignent tout de suite ;
  // une fois chez l'ennemi, ce sont des renforts (avec délai). Renvoie la durée de la marche (en secondes).
  startMarch(a, edge) {
    const W = this.W, TPS = CONFIG.TICKS_PER_SECOND, p = this.players[a.attacker];
    const to = edge >= 0 ? { x: edge % W + 0.5, y: ((edge / W) | 0) + 0.5 } : { x: p.sumX / p.tiles + 0.5, y: p.sumY / p.tiles + 0.5 };
    const src = this.sourceOfAttack(a), mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    let from = src >= 0 && this.building[src] === B_OUTPOST ? mid(src) : null;
    if (!from) {
      let bestD = Infinity;
      for (const c of this.castles) {
        if (this.owner[c] !== a.attacker || !this.isBase(c)) continue;
        const m = mid(c), d = (m.x - to.x) ** 2 + (m.y - to.y) ** 2;
        if (d < bestD) { bestD = d; from = m; }
      }
    }
    if (!from) from = { x: p.sumX / p.tiles + 0.5, y: p.sumY / p.tiles + 0.5 }; // (pas de château : du cœur du royaume)
    const secs = Math.max(CONFIG.MARCH_MIN_TIME, Math.hypot(to.x - from.x, to.y - from.y) / CONFIG.MARCH_SPEED);
    a.marchFrom = from;
    a.marchTo = to;
    a.startTick = this.tick + Math.round(secs * TPS);
    a.prepTicks = a.startTick - this.tick;
    return Math.ceil(secs);
  },

  // Où en est la marche de l'armée (coordonnées en cases) : de sa cité vers la frontière
  marchPosition(a) {
    const f = a.marchFrom, t = a.marchTo, k = 1 - Math.max(0, a.startTick - this.tick) / Math.max(1, a.prepTicks);
    return { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k };
  },

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
  // Une armée en marche perd des hommes : un pourcentage de son effectif (TILE_LOSS_RATE par case, selon le
  // terrain), donc une grosse armée en perd plus qu'une petite ; au moins NEUTRAL_TILE_COST par case.
  // (sur une grande carte, une terre libre coûte moins : voir landBoost)
  tileCost(a, t) {
    const loss = Math.max(CONFIG.NEUTRAL_TILE_COST, a.troops * CONFIG.TILE_LOSS_RATE);
    return loss * TERRAIN_INFO[this.terrain[t]].cost / (a.target < 0 ? this.landBoost : 1);
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
    def = Math.max(1, def);
    // Avant-poste en construction : ses défenseurs, occupés à bâtir, se défendent moins bien
    if (this.outpostBuilding(a.target, t)) def -= CONFIG.OUTPOST_BUILDING_MALUS;
    return def;
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
    // Armée bloquée dans ses châteaux isolés : elle les défend, mais moins bien
    else if (a.targetCastle >= 0 && this.building[a.targetCastle] === B_CASTLE && this.troopsInCastles(a.target)) r *= CONFIG.LEADERLESS_DEFENSE;
    return r;
  },

  // Assaut de front contre un royaume qui n'a plus ni château ni église
  leaderless(a) {
    return a.target >= 0 && a.targetCastle < 0 && !this.isProtected(a.target);
  },

  // Dernier carré : l'assaut vise un château d'un royaume dont tous les châteaux sont isolés (son armée y est
  // bloquée). Toutes ses troupes restantes le défendent d'office.
  lastStand(a) {
    const c = a.targetCastle;
    return a.target >= 0 && c >= 0 && this.building[c] === B_CASTLE && this.owner[c] === a.target && this.troopsInCastles(a.target);
  },

  // Un royaume sans château ni église n'a plus de pouvoir en place : quand un assaut de front commence,
  // toutes les troupes encore présentes dans le royaume défendent d'office (partagées entre les assauts
  // qui commencent en même temps). Les soldats recrutés ensuite restent au royaume.
  // Même chose quand un assaut commence contre le dernier carré d'un royaume (voir lastStand).
  levy() {
    const byTarget = new Map();
    for (const a of this.attacks) {
      if (a.done || a.levied || this.isPreparing(a) || !(this.leaderless(a) || this.lastStand(a))) continue;
      a.levied = true;
      if (!byTarget.has(a.target)) byTarget.set(a.target, []);
      byTarget.get(a.target).push(a);
    }
    for (const [t, list] of byTarget) {
      const p = this.players[t];
      if (!p.alive || p.troops <= 0) continue;
      for (const a of list) a.defenders += p.troops / list.length;
      if (p.isHuman && list.some(a => this.lastStand(a))) {
        UI.log(`🏰 Ton dernier château est attaqué : tes ${fmt(p.troops)} soldats restants le défendent d'office !`, 'warn');
      }
      p.troops = 0;
    }
  },

  // Bonus du camp le plus nombreux : rien tant qu'il n'a pas 2 fois plus de soldats que l'autre,
  // puis (rapport de force) / 2, au plus x5 (réglages NUMBERS_... dans config.js)
  numbersBonus(mine, theirs) {
    const ratio = mine / Math.max(theirs, 1);
    return Math.min(CONFIG.NUMBERS_MAX_BONUS, Math.max(1, ratio / CONFIG.NUMBERS_THRESHOLD));
  },

  // Combat entre l'assaut et les défenseurs envoyés : ce n'est pas instantané,
  // chaque tour une petite partie des soldats engagés tombe.
  fight(a) {
    const D = this.combatRatio(a);
    // Chaque soldat de garnison vaut GARRISON_POWER soldats au combat : on compte en « forces »
    const gp = this.garrisonPower(a), gar = (a.garrison || 0) * gp;
    const total = a.defenders + gar;
    // Supériorité en nombre : le camp bien plus nombreux frappe plus vite et perd moins de soldats
    // (un défenseur ne peut pas bloquer 300 soldats en envoyant 2 ou 3 hommes à la fois)
    const atkBonus = this.numbersBonus(a.troops, total);
    const defBonus = this.numbersBonus(total, a.troops);
    const base = Math.max(CONFIG.FIGHT_MIN_LOSS, CONFIG.FIGHT_RATE * Math.min(a.troops, total)) * atkBonus * defBonus;
    const defLoss = Math.min(total, base);
    // La garnison combat en premier, puis les défenseurs envoyés
    const fromGarrison = Math.min(gar, defLoss);
    a.garrison = (a.garrison || 0) - fromGarrison / gp;
    const before = a.defenders;
    a.defenders -= defLoss - fromGarrison;
    // les alliés venus aider subissent leur part des pertes
    if (a.allyDef && before > 0) for (const k in a.allyDef) a.allyDef[k] *= Math.max(0, a.defenders) / before;
    a.troops = Math.max(0, a.troops - defLoss * D * defBonus / atkBonus);
    if (a.troops < 1) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(`💥 Ton assaut contre ${d.name} a été repoussé !`, 'warn', d);
      else if (d.isHuman) UI.log(`🛡️ Tu as repoussé l'assaut de ${p.name} !`, 'good', p);
      this.endAttack(a);
    } else if (a.defenders + a.garrison < 1) {
      a.defenders = 0;
      a.garrison = 0;
      if (a.allyDef) for (const k in a.allyDef) a.allyDef[k] = 0;
    }
  },

  // Combien vaut un soldat de garnison au combat : GARRISON_POWER (3), sauf pour un avant-poste en construction
  // (sa « garnison », ce sont tous les soldats débarqués, occupés à bâtir)
  garrisonPower(a) {
    const c = a.targetCastle;
    if (c >= 0 && this.building[c] === B_OUTPOST && !this.outpostReady(c)) return 1;
    return CONFIG.GARRISON_POWER;
  },

  // La case touche-t-elle une case de cet ensemble, encore à ce royaume ?
  touchesSet(i, set, pid) {
    let found = false;
    this.forNeighbors(i, n => { if (set.has(n) && this.owner[n] === pid) found = true; });
    return found;
  },

  // L'assaut vise-t-il un château isolé ? Ses défenseurs ne peuvent alors pas le rejoindre.
  // (un avant-poste, au-delà des mers, ne peut compter que sur sa garnison)
  // (un morceau coupé de tous ses châteaux non plus : ses soldats sont bloqués dans le château isolé,
  //  personne ne peut venir le défendre, même pour une église ou un port qui s'y trouve)
  cutOff(a) {
    if (a.unlinked) return true;
    const c = a.targetCastle, b = this.building[c];
    if (c >= 0 && this.owner[c] === a.target && b !== B_CASTLE && b !== B_OUTPOST && this.isUnlinked(c)) return true;
    // (château isolé, mais l'armée du royaume y est bloquée : elle peut le défendre, voir troopsInCastles)
    if (c >= 0 && b === B_CASTLE && this.owner[c] === a.target && this.troopsInCastles(a.target)) return false;
    return c >= 0 && (b === B_CASTLE || b === B_PORT || b === B_OUTPOST) && this.owner[c] === a.target && this.isIsolated(c);
  },

  // Le défenseur envoie des soldats contre un assaut (sans délai, autant qu'il veut)
  sendDefenders(pid, attackId, troops) {
    const p = this.players[pid];
    const a = this.attacks.find(a => a.id === attackId && a.target === pid && !a.done);
    if (!a || this.defendWait(a) > 0) return null; // (les défenseurs se regroupent entre deux envois)
    // Dans la zone d'un avant-poste (pas encore reliée au royaume) : ce sont ses soldats stationnés qui défendent.
    // Château isolé : personne ne peut le rejoindre.
    let src = this.outpostZoneOf(a);
    if (src < 0 && this.cutOff(a)) return null;
    troops = Math.floor(Math.min(troops, this.troopsAt(pid, src)));
    if (troops < 1) return null;
    this.takeTroops(pid, src, troops);
    a.lastDefend = this.tick;
    if (src >= 0) a.defSource = src;
    // Les défenseurs partent tout de suite, du château le plus proche (ou de l'avant-poste),
    // et marchent à la rencontre de l'armée ennemie : ils se battent en arrivant
    const from = this.defenseOrigin(pid, a, src), to = this.attackFront(a);
    const dist = Math.hypot(to.x - from.x, to.y - from.y), TPS = CONFIG.TICKS_PER_SECOND;
    (a.defPending = a.defPending || []).push({ troops, from, start: this.tick,
      arrive: this.tick + Math.max(1, Math.round(dist / CONFIG.DEFENDER_SPEED * TPS)) });
    return a;
  },

  // L'avant-poste bâti dont la zone est attaquée (son morceau de territoire, pas encore relié au royaume), ou -1 :
  // ses soldats stationnés défendent tout ce morceau, tant qu'un château ne l'a pas fait entrer dans le royaume
  outpostZoneOf(a) {
    const t = a.targetCastle >= 0 ? a.targetCastle : a.frontTile;
    if (t < 0 || a.target < 0 || this.owner[t] !== a.target) return -1;
    const r = this.regionsAt(t), k = r.comp[t];
    if (k < 0 || r.heart[k]) return -1;
    return r.outpost[k] >= 0 ? r.outpost[k] : -1;
  },

  // Où se bat l'assaut a (en cases, coordonnées du centre) : au pied des murs pendant un siège, sinon sur son front
  attackFront(a) {
    const W = this.W, center = t => ({ x: t % W + 0.5, y: ((t / W) | 0) + 0.5 });
    if (a.siege) return center(a.siege.tile);
    if (a.bannerX !== undefined) return { x: a.bannerX, y: a.bannerY };
    if (a.frontTile >= 0) return center(a.frontTile);
    return { x: a.toX, y: a.toY };
  },

  // D'où partent les défenseurs de pid : l'avant-poste attaqué, sinon son château le plus proche du combat
  // (pas un château isolé), sinon le cœur de son royaume
  defenseOrigin(pid, a, src) {
    const W = this.W, mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    if (src >= 0) return mid(src);
    // (armée bloquée dans ses châteaux isolés : les défenseurs sortent du château attaqué)
    if (a.targetCastle >= 0 && this.building[a.targetCastle] === B_CASTLE && this.troopsInCastles(pid)) return mid(a.targetCastle);
    const to = this.attackFront(a);
    let best = null, bestD = Infinity;
    for (const c of this.castles) {
      if (this.owner[c] !== pid || !this.isBase(c)) continue;
      const m = mid(c), d = (m.x - to.x) ** 2 + (m.y - to.y) ** 2;
      if (d < bestD) { bestD = d; best = m; }
    }
    if (best) return best;
    const p = this.players[pid];
    return { x: p.sumX / p.tiles + 0.5, y: p.sumY / p.tiles + 0.5 };
  },

  // L'assaut a est fini (la ville est prise, ou l'attaquant est parti) : ses défenseurs encore en route font
  // demi-tour, là où ils sont, et rentrent à pied (DEFENDER_SPEED) jusqu'à la ville (château) la plus proche
  // de leur royaume (ou à leur avant-poste). On ne les récupère qu'à leur arrivée.
  sendHome(a, src) {
    if (!a.defPending || !a.defPending.length) return;
    const W = this.W, TPS = CONFIG.TICKS_PER_SECOND, pid = a.target, front = this.attackFront(a);
    const mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    for (const r of a.defPending) {
      const k = Math.min(1, (this.tick - r.start) / Math.max(1, r.arrive - r.start));
      const from = { x: r.from.x + (front.x - r.from.x) * k, y: r.from.y + (front.y - r.from.y) * k };
      let to = null, best = Infinity;
      if (src >= 0 && this.owner[src] === pid && this.building[src] === B_OUTPOST) to = mid(src);
      else {
        for (const c of this.castles) {
          if (this.owner[c] !== pid) continue;
          const m = mid(c), d = (m.x - from.x) ** 2 + (m.y - from.y) ** 2;
          if (d < best) { best = d; to = m; }
        }
      }
      if (!to) to = r.from; // (plus aucun château : ils retournent d'où ils venaient)
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      this.returning.push({ pid, troops: r.troops, source: src, from, to, start: this.tick,
        arrive: this.tick + Math.max(1, Math.round(dist / CONFIG.DEFENDER_SPEED * TPS)) });
    }
    a.defPending = [];
  },

  // Les défenseurs qui rentrent arrivent à leur ville : ils rejoignent l'armée (ou leur avant-poste)
  stepReturning() {
    for (const r of this.returning) {
      if (this.tick < r.arrive) continue;
      r.done = true;
      if (this.players[r.pid].alive) this.giveTroops(r.pid, r.source, r.troops);
    }
    this.returning = this.returning.filter(r => !r.done);
  },

  // Défenseurs en route vers cet assaut (pas encore arrivés)
  defendersOnTheWay(a) { return a.defPending ? a.defPending.reduce((s, r) => s + r.troops, 0) : 0; },

  // Arrivée des défenseurs en route : ils rejoignent le combat
  arriveDefenders(a) {
    if (!a.defPending || !a.defPending.length) return;
    for (const r of a.defPending) if (r.arrive <= this.tick) { a.defenders += r.troops; r.done = true; }
    a.defPending = a.defPending.filter(r => !r.done);
  },

  // Envoyer une armée aider un allié du pacte qui se fait attaquer : elle arrive en REINFORCE_DELAY secondes
  // et se bat avec ses défenseurs ; à la fin de l'assaut, ses survivants rentrent. Renvoie un message d'erreur, ou null.
  helpAlly(pid, attackId, troops) {
    const p = this.players[pid], TPS = CONFIG.TICKS_PER_SECOND;
    const a = this.attacks.find(x => x.id === attackId && !x.done);
    if (!a || a.target < 0 || !this.areAllied(pid, a.target)) return 'Cet assaut ne vise pas un de tes alliés.';
    if (this.cutOff(a)) return 'Ce bâtiment est coupé de son royaume : aucun renfort ne peut le rejoindre.';
    if (!a.allyLast) { a.allyLast = {}; a.allyDef = {}; a.allyPending = []; }
    const wait = a.allyLast[pid] === undefined ? 0 : (a.allyLast[pid] + CONFIG.DEFEND_COOLDOWN * TPS - this.tick) / TPS;
    if (wait > 0) return `Tes soldats se regroupent : prochaine aide dans ${Math.ceil(wait)} s.`;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return 'Pas assez de soldats !';
    p.troops -= troops;
    a.allyPending.push({ pid, troops, tick: this.tick + CONFIG.REINFORCE_DELAY * TPS });
    a.allyLast[pid] = this.tick;
    const d = this.players[a.target], e = this.players[a.attacker];
    if (d.isHuman) UI.log(`🤝 ${p.name} envoie ${fmt(troops)} soldats t'aider contre ${e.name} !`, 'good', p);
    else if (e.isHuman) UI.log(`🤝 ${p.name} envoie ${fmt(troops)} soldats défendre son allié ${d.name} contre toi !`, 'warn', p);
    return null;
  },

  // Secondes à attendre avant de pouvoir renvoyer des défenseurs contre cet assaut (0 = tout de suite).
  // Ce petit délai (DEFEND_COOLDOWN) évite d'envoyer les soldats un par un en continu.
  defendWait(a) {
    if (a.lastDefend === undefined) return 0;
    const TPS = CONFIG.TICKS_PER_SECOND;
    return Math.max(0, (a.lastDefend + CONFIG.DEFEND_COOLDOWN * TPS - this.tick) / TPS);
  },

  stepAttack(a) {
    this.arriveDefenders(a);
    if (this.stepRetreat(a)) return;
    if (this.isPreparing(a)) return;
    // Assaut sur un morceau coupé de ses châteaux : si son royaume l'a relié à un château entre-temps, il s'arrête
    if (a.unlinked && this.tick % CONFIG.TICKS_PER_SECOND === 0 && this.unlinkedRelinked(a)) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(`🔗 ${d.name} a relié ses terres coupées à un château : ton assaut s'arrête.`, 'warn', d);
      else if (d.isHuman) UI.log(`🔗 Tes terres coupées sont de nouveau reliées à un château : l'assaut ${this.deName(p.name)} s'arrête !`, 'good', p);
      return this.endAttack(a);
    }
    if (a.prepTicks && this.tick === a.startTick) {
      // Fin de la préparation : la frontière a pu bouger entre-temps
      a.list = this.buildFrontier(a.attacker, a.target, this.sourceOfAttack(a));
      a.set = new Set(a.list);
      // Assaut sur un château : le chemin est-il toujours libre ?
      if (a.targetCastle >= 0 && !a.castleTaken) {
        const path = this.owner[a.targetCastle] === a.target
          ? this.castlePath(a.attacker, a.targetCastle, this.sourceOfAttack(a)) : null;
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
        if (this.players[a.attacker].isHuman) UI.log('💥 Trop tard : ton bâtiment isolé est tombé, ton assaut rentre.', 'warn');
        return this.endAttack(a);
      }
      // Déjà relié au royaume (par un autre chemin) : les soldats rejoignent sa défense
      if (!this.isIsolated(a.link)) return this.linkArrives(a);
      // Fin de la préparation : on recalcule le chemin, la frontière a pu bouger
      if (this.tick === a.startTick) {
        const route = this.linkRoute(a.attacker, a.link, a.target);
        if (!route) {
          if (this.players[a.attacker].isHuman) UI.log('🚫 Le passage vers ton bâtiment isolé est bloqué : assaut annulé.', 'warn');
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
    // Arrivée des alliés venus aider le défenseur : ils se battent avec ses défenseurs
    if (a.allyPending) {
      for (const r of a.allyPending) {
        if (r.tick > this.tick) continue;
        a.defenders += r.troops;
        a.allyDef[r.pid] = (a.allyDef[r.pid] || 0) + r.troops;
      }
      a.allyPending = a.allyPending.filter(r => r.tick > this.tick);
    }
    // Tant que des défenseurs (garnison ou renforts) tiennent la position, l'assaut se bat au lieu d'avancer
    if (a.defenders + (a.garrison || 0) >= 1) return this.fight(a);
    // Siège : l'armée est au pied des murs. Le château ne tombe qu'à la fin du siège ;
    // d'ici là, le défenseur peut encore envoyer des soldats (on se bat alors, juste au-dessus).
    if (a.siege) {
      if (this.owner[a.siege.tile] !== a.target) return this.endAttack(a); // le château a changé de mains
      const sb = this.building[a.siege.tile];
      if (sb !== B_CASTLE && sb !== B_OUTPOST) return this.endAttack(a); // (il n'existe plus)
      if (this.tick < a.siege.end) return;
      return this.building[a.siege.tile] === B_OUTPOST ? this.takeOutpost(a, a.siege.tile) : this.takeCastle(a, a.siege.tile);
    }
    // Points de marche de ce tour : prendre une case en coûte autant que sa défense de terrain
    // (plaine 1, forêt 1.6, colline 2.2, montagne 3.5, fleuve 4). On avance donc vite en plaine
    // et lentement dans le relief. Les points non utilisés sont gardés pour le tour suivant.
    // Sur les terres libres, une grosse armée s'étend plus vite. Mais contre un royaume, c'est l'inverse :
    // plus l'armée d'assaut est grande, plus elle est lente (ASSAULT_SPEED / (1 + soldats / ASSAULT_HEAVY)).
    let speed;
    if (a.target >= 0) speed = Math.max(CONFIG.ASSAULT_MIN_SPEED, CONFIG.ASSAULT_SPEED / (1 + a.troops / CONFIG.ASSAULT_HEAVY));
    else speed = Math.max(CONFIG.MIN_ATTACK_SPEED, Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED)
      * this.earlyBoost() * this.landBoost; // élan de départ (et grande carte) : les terres libres se prennent plus vite
    // (on peut toujours garder de quoi prendre une montagne, sinon une petite armée resterait bloquée)
    a.move = Math.min((a.move || 0) + speed, Math.max(speed * 2, MAX_LAND_COST));
    while (!a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) return this.endAttack(a);
      if (a.troops < this.tileCost(a, t)) return this.endAttack(a); // plus assez de soldats
      // Arrivée au pied d'un château : le siège commence (il ne tombe pas tout de suite)
      if (a.target >= 0 && this.building[t] === B_CASTLE) return this.startSiege(a, t);
      // (un avant-poste visé s'assiège aussi : il ne tombe pas tout de suite)
      if (this.building[t] === B_OUTPOST && this.anchor[t] === a.targetCastle) return this.startSiege(a, t);
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
      this.moveBanner(a, t);
      // Prendre une case entre deux cases du défenseur peut couper son royaume (voir captureEnclaves)
      if (a.target >= 0 && this.countNeighborsOwnedBy(t, a.target) >= 2) a.cut = true;
      // Église ou port visé : on note sa zone (avant qu'il ne change de mains), avec les bâtiments qui en dépendent
      const linked = a.targetCastle >= 0 && this.anchor[t] === a.targetCastle && this.hasSlots(a.targetCastle)
        ? this.churchZone(a.targetCastle) : null;
      this.setOwner(t, a.attacker);
      // Prise de l'église, du port ou de l'avant-poste visé : l'assaut s'arrête là
      const b = this.building[t];
      if (a.targetCastle >= 0 && b && b !== B_CASTLE && this.anchor[t] === a.targetCastle) {
        if (linked) this.takeLinked(a, linked);
        this.onTargetTaken(a, b, !!linked);
        if (b === B_OUTPOST) this.removeBuilding(a.targetCastle); // un avant-poste pris est détruit
        return this.endAttack(a);
      }
      // Assaut de jonction : il touche le morceau de son château isolé, c'est gagné
      if (a.link >= 0 && this.touchesSet(t, a.piece, a.attacker)) return this.linkArrives(a);
      this.forNeighbors(t, n => {
        if (this.owner[n] === a.target && this.claimable(n) && !a.set.has(n)) {
          a.set.add(n);
          a.list.push(n);
        }
      });
    }
  },

  // Rappelle les soldats d'une attaque (seulement les siennes).
  // Annuler une attaque : c'est une retraite. Les soldats mettent RETREAT_TIME secondes à décrocher
  // (les défenseurs peuvent encore les attaquer), puis rentrent en perdant RETREAT_LOSS de leurs effectifs.
  cancelAttack(pid, attackId) {
    const a = this.attacks.find(a => a.id === attackId && a.attacker === pid && !a.done);
    if (a && a.retreatEnd === undefined) a.retreatEnd = this.tick + CONFIG.RETREAT_TIME * CONFIG.TICKS_PER_SECOND;
    return a;
  },

  // Retraite en cours : on ne fait que se défendre, puis on rentre avec les pertes. Renvoie true si c'est le cas.
  stepRetreat(a) {
    if (a.retreatEnd === undefined) return false;
    if (this.tick < a.retreatEnd) {
      if (!this.isPreparing(a) && a.defenders + (a.garrison || 0) >= 1) this.fight(a);
      return true;
    }
    const keep = 1 - CONFIG.RETREAT_LOSS;
    a.troops *= keep;
    for (const r of a.pending) r.troops *= keep;
    const p = this.players[a.attacker];
    if (p.isHuman) UI.log(`↩️ Retraite terminée : ${fmt(a.troops + a.pending.reduce((s, r) => s + r.troops, 0))} soldats rentrent.`, 'good');
    this.endAttack(a);
    return true;
  },

  // Château pris : toute sa zone de défense passe d'un coup à l'attaquant, avec les moulins et casernes
  // qui s'y trouvent (une église, un port ou un autre château reste au défenseur : il faut le viser)
  // Nombre d'assauts qu'un royaume peut mener en même temps contre un même royaume :
  // 1, ou CITADEL_ASSAULTS s'il possède une citadelle (château de niveau 3)
  maxAssaults(pid) {
    return this.castles.some(c => this.owner[c] === pid && this.level[c] >= 3) ? CONFIG.CITADEL_ASSAULTS : 1;
  },

  // Position de la bannière d'un assaut : elle glisse doucement vers les cases prises (moyenne des dernières),
  // pour rester à peu près fixe sur le front au lieu de sauter d'une case à l'autre.
  // Un assaut ciblé (dans un couloir) la fait avancer plus vite qu'un assaut de front, très large.
  moveBanner(a, t) {
    const x = t % this.W + 0.5, y = ((t / this.W) | 0) + 0.5;
    if (a.bannerX === undefined) {
      // départ : là où la bannière était plantée pendant la préparation (sinon sur la première case prise)
      const s = a.startTile >= 0 ? a.startTile : t;
      a.bannerX = s % this.W + 0.5;
      a.bannerY = ((s / this.W) | 0) + 0.5;
    }
    const k = a.limitZone ? 0.15 : 0.03;
    a.bannerX += (x - a.bannerX) * k;
    a.bannerY += (y - a.bannerY) * k;
  },

  // L'armée arrive au pied du château (case t) : le siège dure quelques secondes selon son niveau
  startSiege(a, t) {
    const outpost = this.building[t] === B_OUTPOST;
    const secs = outpost ? CONFIG.OUTPOST_SIEGE : this.castleInfo(this.anchor[t]).siege;
    a.siege = { tile: t, end: this.tick + secs * CONFIG.TICKS_PER_SECOND };
    a.frontTile = t; // on se bat au pied des murs (avec leur bonus de défense)
    const p = this.players[a.attacker], d = this.players[a.target];
    const what = outpost ? ['un avant-poste', 'ton avant-poste', '⛺'] : ['un château', 'ton château', '🏰'];
    if (p.isHuman) UI.log(`${what[2]} Ton armée assiège ${what[0]} ${this.deName(d.name)} : il tombe dans ${secs} s si personne ne le défend.`, 'good', d);
    else if (d.isHuman) UI.log(`${what[2]} ${p.name} assiège ${what[1]} ! Il tombe dans ${secs} s : envoie vite des défenseurs !`, 'warn', p);
  },

  // Fin du siège d'un avant-poste : il est détruit (ses terres passent à l'attaquant), et l'assaut s'arrête
  takeOutpost(a, t) {
    const c = this.anchor[t];
    a.troops = Math.max(0, a.troops - this.tileCost(a, t));
    this.setOwner(t, a.attacker);
    this.onTargetTaken(a, B_OUTPOST, false);
    this.removeBuilding(c);
    return this.endAttack(a);
  },

  // Deux armées de royaumes ennemis assiègent le même château (d'un troisième royaume) : elles s'affrontent
  // d'abord entre elles, au pied des murs. Pendant la bataille, le siège est en pause ; la gagnante le reprend.
  siegeClashes() {
    const TPS = CONFIG.TICKS_PER_SECOND;
    for (const a of this.attacks) a.clash = undefined;
    const sieges = this.attacks.filter(a => !a.done && a.siege);
    for (let i = 0; i < sieges.length; i++) {
      for (let j = i + 1; j < sieges.length; j++) {
        const a = sieges[i], b = sieges[j];
        if (a.done || b.done || a.attacker === b.attacker || this.areAllied(a.attacker, b.attacker)) continue;
        if (this.anchor[a.siege.tile] !== this.anchor[b.siege.tile]) continue; // (pas le même château)
        a.clash = b.attacker;
        b.clash = a.attacker;
        if (!a.clashSeen || !b.clashSeen) {
          a.clashSeen = b.clashSeen = true;
          for (const [x, y] of [[a, b], [b, a]]) {
            if (this.players[x.attacker].isHuman) {
              UI.log(`⚔️ Ton armée affronte celle ${this.deName(this.players[y.attacker].name)} au pied du château ! La gagnante reprendra le siège.`, 'warn', this.players[y.attacker]);
            }
          }
        }
        // Combat comme contre des défenseurs : la supériorité en nombre et la force des soldats comptent
        const ba = this.numbersBonus(a.troops, b.troops), bb = this.numbersBonus(b.troops, a.troops);
        const pa = this.troopPower(a.attacker), pb = this.troopPower(b.attacker);
        const base = Math.max(CONFIG.FIGHT_MIN_LOSS, CONFIG.FIGHT_RATE * Math.min(a.troops, b.troops)) * ba * bb;
        a.troops = Math.max(0, a.troops - base * (bb / ba) * (pb / pa));
        b.troops = Math.max(0, b.troops - base * (ba / bb) * (pa / pb));
        // le siège attend la fin de la bataille
        a.siege.end++;
        b.siege.end++;
        for (const [x, y] of [[a, b], [b, a]]) {
          if (x.troops >= 1) continue;
          const px = this.players[x.attacker], py = this.players[y.attacker];
          if (px.isHuman) UI.log(`💥 Ton armée a été battue par celle de ${py.name} au pied du château.`, 'warn', py);
          else if (py.isHuman) UI.log(`⚔️ Tu as battu l'armée de ${px.name} : ton siège reprend !`, 'good', px);
          this.endAttack(x);
        }
      }
    }
  },

  // Fin du siège : le château tombe, avec toute sa zone (voir onCastleTaken), et l'assaut s'arrête
  takeCastle(a, t) {
    const castle = this.anchor[t], zone = this.castleZone(castle, a.target, 0); // (zone notée avant la prise)
    a.troops = Math.max(0, a.troops - this.tileCost(a, t));
    this.setOwner(t, a.attacker);
    this.onCastleTaken(a, castle, zone);
    return this.endAttack(a);
  },

  onCastleTaken(a, castle, zone) {
    a.castleTaken = true;
    this.warEffects(a);
    for (const i of zone) {
      if (this.owner[i] !== a.target) continue; // (déjà pris avec un bâtiment)
      const b = this.building[i];
      if (b && this.anchor[i] !== castle && TARGET_TYPES.includes(b)) continue;
      this.setOwner(i, a.attacker);
    }
    a.cut = true; // la zone prise peut couper le royaume du défenseur (voir captureEnclaves)
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(`🏰 Tu as pris un château ${this.deName(d.name)}, avec toute sa zone et ses bâtiments !`, 'good', d);
    else if (d.isHuman) UI.log(`🏰 ${p.name} a pris un de tes châteaux !`, 'warn', p);
  },

  // Église (ou port) pris : sa zone passe à l'attaquant, avec les moulins et casernes construits grâce à elle.
  // Ce qui est dans la muraille d'un château reste au défenseur (ça dépend du château), comme les autres
  // châteaux, églises et ports.
  takeLinked(a, zone) {
    for (const i of zone) {
      if (this.owner[i] !== a.target || this.castleProtects(a.target, i)) continue;
      const b = this.building[i];
      if (b && TARGET_TYPES.includes(b)) continue;
      if (b && this.footprint(this.anchor[i], b).some(j => this.castleProtects(a.target, j))) continue;
      this.setOwner(i, a.attacker);
    }
    a.cut = true; // la zone prise peut couper le royaume du défenseur (voir captureEnclaves)
  },

  onTargetTaken(a, type, withZone) {
    const p = this.players[a.attacker], d = this.players[a.target];
    this.warEffects(a);
    const what = { [B_CHURCH]: ['⛪', 'une église', 'une de tes églises'], [B_PORT]: ['⚓', 'un port', 'un de tes ports'],
      [B_OUTPOST]: ['⛺', 'un avant-poste', 'un de tes avant-postes'] }[type];
    const verb = type === B_OUTPOST ? 'détruit' : 'pris';
    const zone = withZone ? `, avec sa zone et les bâtiments construits grâce à ${type === B_CHURCH ? 'elle' : 'lui'}` : '';
    if (p.isHuman) UI.log(`${what[0]} Tu as ${verb} ${what[1]} ${this.deName(d.name)}${zone} !`, 'good', d);
    else if (d.isHuman) UI.log(`${what[0]} ${p.name} a ${verb} ${what[2]}${zone} !`, 'warn', p);
  },

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    const p = this.players[a.attacker];
    // Les survivants (et les renforts encore en route) rentrent à la maison (ou à leur avant-poste)
    this.giveTroops(a.attacker, this.sourceOfAttack(a), a.troops + a.pending.reduce((s, r) => s + r.troops, 0));
    // Les alliés venus aider rentrent chez eux avec leurs survivants
    if (a.allyDef) {
      for (const k in a.allyDef) {
        const back = Math.min(a.allyDef[k], Math.max(0, a.defenders));
        a.defenders -= back;
        if (this.players[k].alive) this.players[k].troops += back;
      }
      for (const r of a.allyPending) if (this.players[r.pid].alive) this.players[r.pid].troops += r.troops; // (pas encore arrivés)
    }
    // Les défenseurs survivants rentrent aussi, et la garnison regagne son château. Ceux qui étaient encore
    // en route font demi-tour : ils rentrent à pied jusqu'à la ville la plus proche (voir sendHome)
    if (a.target >= 0 && this.players[a.target].alive) {
      const src = a.defSource === undefined ? -1 : a.defSource;
      this.giveTroops(a.target, src, a.defenders);
      this.sendHome(a, src);
    }
    const c = a.targetCastle;
    if (c >= 0 && a.garrison > 0 && this.owner[c] === a.target) {
      // ce qui dépasse la garnison maximum n'est pas perdu : à un avant-poste, ces soldats stationnent ;
      // à un château, ils rejoignent l'armée
      const total = this.garrison[c] + a.garrison, max = this.garrisonMax(c);
      this.garrison[c] = Math.min(max, total);
      const extra = total - this.garrison[c];
      if (extra > 0) {
        if (this.outposts.has(c)) this.outposts.get(c).stationed += extra;
        else this.players[a.target].troops += extra;
      }
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
    if (!this.pactsAllowed) return 'Les pactes sont interdits dans cette partie : chacun pour soi !';
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
  // Envoyer des soldats à un allié : il n'en reçoit que ALLY_GIFT_RATIO (sans dépasser son armée maximum).
  // Renvoie un message d'erreur, ou le nombre de soldats reçus.
  sendTroopsToAlly(pid, ally, troops) {
    const p = this.players[pid], q = this.players[ally];
    if (!q || !q.alive || !this.areAllied(pid, ally)) return 'On ne peut envoyer des soldats qu\'à un allié.';
    troops = Math.floor(Math.min(troops, p.troops));
    // pas plus que la place qu'il lui reste dans son armée
    const room = Math.max(0, this.maxTroops(q) - this.armySize(q));
    troops = Math.min(troops, Math.floor(room / CONFIG.ALLY_GIFT_RATIO));
    if (troops < 1) return room < 1 ? `L'armée ${this.deName(q.name)} est déjà pleine.` : 'Pas assez de soldats !';
    const got = troops * CONFIG.ALLY_GIFT_RATIO;
    p.troops -= troops;
    q.troops += got;
    if (q.isHuman) UI.log(`🎁 ${p.name} t'envoie ${fmt(got)} soldats !`, 'good', p);
    return got;
  },

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

    // Les garnisons des châteaux se reconstituent (sauf celle qui est en train de combattre,
    // et pas si l'armée du royaume, garnisons comprises, est déjà au maximum)
    const besieged = new Set(this.attacks.filter(a => !a.done && !this.isPreparing(a)).map(a => a.targetCastle));
    const full = this.players.map(p => p.alive && this.armySize(p) >= this.maxTroops(p));
    for (const c of this.buildingTiles) {
      if (this.building[c] === B_OUTPOST) continue; // (la garnison d'un avant-poste ne se reconstitue pas : voir stepOutposts)
      const max = this.garrisonMax(c);
      if (!max || max === Infinity || this.owner[c] < 0 || besieged.has(c) || full[this.owner[c]]) continue;
      this.garrison[c] = Math.min(max, this.garrison[c] + max * CONFIG.GARRISON_REGEN / TPS);
    }

    this.levy();
    for (const a of this.attacks.slice()) if (!a.done) this.stepAttack(a);
    this.siegeClashes();
    // Un assaut a pu couper un royaume en morceaux : les petits morceaux encerclés sont pris
    for (const a of this.attacks) {
      if (a.cut) { a.cut = false; this.captureEnclaves(a.target, a.attacker); }
    }
    this.attacks = this.attacks.filter(a => !a.done);
    this.stepExpeditions();
    this.stepCrossings();
    this.stepReturning();
    this.stepWorks();
    this.stepOutposts();
    // Toutes les 2 secondes : un morceau a pu être coupé autrement (débarquement…)
    // (le découpage n'est refait que si l'un d'eux a vraiment englobé des terres)
    if (this.tick % (2 * TPS) === 0) for (const p of this.players) if (p.alive) this.captureEnclaves(p.id);
    // Le joueur vient de perdre le lien entre son territoire et ses châteaux : on le prévient (une fois)
    const h = this.human;
    if (this.tick % (2 * TPS) === 0 && h && h.alive) {
      const cut = this.hasUnlinked(h.id);
      if (cut && !h.cutWarned) {
        UI.log('🚩 Ton territoire est coupé de tous tes châteaux ! Tes soldats sont bloqués dans ton château isolé : ' +
          'ce territoire n\'est plus défendu et aucune armée ne peut en partir. Relie-le (clique sur ton château isolé) ' +
          'ou bâtis un nouveau château.', 'warn');
      }
      h.cutWarned = cut;
    }

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
  // Calculé pour tous les royaumes d'un coup (les bots le demandent souvent).
  neighborStats(pid) {
    // (au plus une fois par seconde : les bots n'ont pas besoin d'un compte exact à chaque instant)
    if (this.nbStatsVersion !== this.version && !(this.tick - this.nbStatsTick < CONFIG.TICKS_PER_SECOND)) {
      this.nbStatsVersion = this.version;
      this.nbStatsTick = this.tick;
      const all = this.players.map(() => new Map()), W = this.W, N = this.N, own = this.owner;
      const count = (o, j) => {
        const q = own[j];
        if (q !== o && this.claimable(j)) all[o].set(q, (all[o].get(q) || 0) + 1);
      };
      for (let i = 0; i < N; i++) {
        const o = own[i];
        if (o < 0) continue;
        const x = i % W;
        // (une case entourée des siennes ne compte pas : on passe vite)
        if (x > 0 && own[i - 1] !== o) count(o, i - 1);
        if (x < W - 1 && own[i + 1] !== o) count(o, i + 1);
        if (i >= W && own[i - W] !== o) count(o, i - W);
        if (i < N - W && own[i + W] !== o) count(o, i + W);
      }
      this.nbStatsCache = all;
    }
    return this.nbStatsCache[pid];
  },
};

// La partie en cours : elle utilise toutes les règles de GameRules (Game.update(), Game.launchAttack()…)
const Game = Object.create(GameRules);

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
