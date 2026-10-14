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
    this.players = [];
    this.attacks = [];
    this.expeditions = []; // bateaux en route vers une côte
    this.crossings = [];   // armées qui traversent un fleuve à gué
    this.outposts = new Map(); // avant-poste → { ready : tick où il est bâti, landing : case du débarquement }
    this.colonies = new Map(); // château bâti ou pris dans la zone d'un avant-poste → son royaume
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
    this.pactsAllowed = opts.pacts !== false; // choisi dans le menu : pactes autorisés ou interdits
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

  // Une église doit rester assez loin des châteaux de son royaume pour ne jamais se retrouver dans
  // leur muraille, même améliorée (la plus grande muraille possible). Et inversement : pas de nouveau
  // château trop près d'une de ses églises.
  churchCastleRange() { return CASTLE_LEVELS[CASTLE_LEVELS.length - 1].radius; },

  // Plus grande zone possible d'une église (au niveau maximum)
  churchMaxRadius() { return CHURCH_LEVELS[CHURCH_LEVELS.length - 1].radius; },

  // Cercles interdits (cercles rouges) pour construire ce type de bâtiment :
  // une église ou un port reste hors de la zone des châteaux (même améliorés) et des églises du royaume,
  // et un château ne se construit pas assez près d'une église ou d'un port pour les englober.
  placementCircles(pid, type) {
    const castleR = this.churchCastleRange(), churchR = this.churchMaxRadius();
    const own = t => this.buildingTiles.filter(a => this.building[a] === t && this.owner[a] === pid);
    if (type === B_CHURCH) return own(B_CASTLE).map(a => ({ a, R: castleR })).concat(own(B_PORT).map(a => ({ a, R: churchR })));
    if (type === B_PORT) return own(B_CASTLE).map(a => ({ a, R: castleR })).concat(own(B_CHURCH).map(a => ({ a, R: churchR })));
    if (type === B_CASTLE) return own(B_CHURCH).concat(own(B_PORT)).map(a => ({ a, R: castleR + 2 }));
    return [];
  },

  // La case j est-elle à moins de R cases du centre du bâtiment a ?
  nearBuilding(a, j, R) {
    const half = this.sizeOf(this.building[a]) / 2;
    const dx = a % this.W + half - (j % this.W + 0.5), dy = ((a / this.W) | 0) + half - (((j / this.W) | 0) + 0.5);
    return dx * dx + dy * dy <= R * R;
  },

  churchCastleConflict(pid, a, type) {
    const cells = this.footprint(a, type);
    return this.placementCircles(pid, type).some(c => cells.some(j => this.nearBuilding(c.a, j, c.R)));
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
    this.outposts.delete(a);
    if (o >= 0) this.players[o].bCount[type]--;
    this.buildingTiles = this.buildingTiles.filter(b => b !== a);
    this.castles = this.castles.filter(c => c !== a);
    this.version++;
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
      if (this.tick === o.ready) {
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
      if (k === r.main[pid] && o.stationed > 0) { this.players[pid].troops += o.stationed; o.stationed = 0; }
      const castle = this.castles.find(c => this.owner[c] === pid && r.comp[c] === k);
      if (castle === undefined) continue;
      const p = this.players[pid];
      p.troops += this.garrison[a] + o.stationed;
      this.colonies.set(castle, pid);
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
      if (!best || time < best.time) best = { path, time };
    }
    if (!best) return 'Aucun de tes ports d\'expédition (niveau 2 ou plus) ne peut rejoindre cet avant-poste.';
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return 'Pas assez de soldats !';
    p.troops -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: o.landing, path: best.path, cost: 0, sent: troops,
      reinforce: a, interceptors: [], troops: troops * (1 - this.seaLoss(best.time)),
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
    this.landSizesMap = this.map;
    return size;
  },

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
    if (t === B_PORT) return info.gold; // le port : ni route ni terrain
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
      if (t !== B_MILL && t !== B_BARRACKS && t !== B_PORT) continue;
      if ((this.tick + a * 7) % period !== 0) continue;
      const p = this.players[this.owner[a]];
      if (!p || !p.alive) continue;
      const amount = this.buildingOutput(a);
      let shown = amount;
      if (t === B_MILL || t === B_PORT) p.gold += amount;
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
    const base = CONFIG.BASE_TROOP_GROWTH + p.tiles * CONFIG.TROOP_GROWTH_PER_TILE;
    return base * this.growthFactor(army / max);
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
          ? 'Trop près d\'une de tes églises ou d\'un de tes ports : la muraille de ce château pourrait les englober (cercle rouge).'
          : 'Trop près : une église ou un port doit rester hors de la zone de tes châteaux (même améliorés) ' +
            'et de tes églises (cercles rouges).';
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
    return null;
  },

  // --- Morceaux de territoire ---
  // Découpe la carte en « morceaux » : des cases d'un même royaume qui se touchent.
  // Le plus grand morceau d'un royaume est son cœur ; les autres sont coupés de lui.
  // Recalculé seulement quand la carte change.
  regions() {
    if (this.regionsVersion === this.version) return this.regionsCache;
    const comp = new Int32Array(this.N).fill(-1), order = new Int32Array(this.N);
    const size = [], start = [], owner = [], outpost = [], anyOutpost = [], colony = [];
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
      // Ce morceau a-t-il un avant-poste (bâti ou non), ou le château d'une ancienne zone d'avant-poste ?
      let op = -1, anyOp = false, col = false;
      for (let q = s; q < n; q++) {
        const t = order[q], b = this.building[t];
        if (b === B_OUTPOST) { anyOp = true; if (this.outpostReady(this.anchor[t])) op = this.anchor[t]; }
        if (b === B_CASTLE && this.colonies.get(this.anchor[t]) === o) col = true;
      }
      outpost.push(op); anyOutpost.push(anyOp); colony.push(col);
      if (main[o] < 0 || size[k] > size[main[o]]) main[o] = k;
    }
    // outpost[k] = avant-poste bâti du morceau k (-1 s'il n'y en a pas)
    this.regionsCache = { comp, order, size, start, owner, main, outpost, anyOutpost, colony };
    this.regionsVersion = this.version;
    return this.regionsCache;
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
    const r = this.regions();
    return r.comp[c] !== r.main[o];
  },

  // Une armée peut-elle partir de cette case ? Oui si elle est dans le cœur de son royaume
  // (ou dans un morceau avec un avant-poste ou une colonie),
  // pas si elle est dans un morceau coupé du reste (un château isolé).
  isBase(i) {
    const o = this.owner[i];
    if (o < 0) return false;
    const r = this.regions(), k = r.comp[i];
    return k === r.main[o] || r.outpost[k] >= 0 || r.colony[k];
  },

  // D'où part une armée qui passe par cette case du royaume ? -1 = du royaume (ses soldats disponibles),
  // sinon de l'avant-poste (son ancre : ses soldats stationnés). null = d'aucun endroit.
  sourceOf(i) {
    const o = this.owner[i];
    if (o < 0) return null;
    const r = this.regions(), k = r.comp[i];
    if (k === r.main[o]) return -1;
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

  // Encerclement : un royaume reste d'un seul tenant. Quand il est coupé en morceaux, il ne garde que
  // le plus grand ; tous les autres, quelle que soit leur taille, sont englobés d'un coup par le royaume qui
  // l'a coupé (cutter), avec leurs églises, ports, moulins et casernes. Sans coupeur connu (ou s'il ne touche
  // pas le morceau), c'est le royaume qui l'entoure le plus qui le prend.
  // Exceptions :
  // - les châteaux et les ports de niveau 3 savent se défendre (holdsAlone) : ils restent au royaume, isolés,
  //   avec les terres de leur zone (et les bâtiments qui s'y trouvent) ;
  // - un morceau avec un avant-poste ou une colonie (invasion par la mer) se défend : il faut viser l'avant-poste.
  captureEnclaves(target, cutter = -1) {
    const T = this.players[target];
    if (!T.alive) return;
    const r = this.regions(), pieces = [];
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] !== target || k === r.main[target]) continue;
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
      if (!took) continue;
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
  buildFrontier(pid, target, source) {
    const list = [];
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] === target && this.isLand(i) && this.touchesOwn(i, pid, source)) list.push(i);
    }
    return list;
  },

  // target = -1 pour les terres libres. aimTile = case visée (pour la flèche sur la carte).
  // waypoints = points de passage de l'armée (assaut sur un château ou une église).
  // source = d'où part l'armée : -1 = le royaume (par défaut), sinon un avant-poste et ses soldats stationnés.
  // Renvoie un message d'erreur, ou null.
  launchAttack(pid, target, troops, aimTile, waypoints, source = -1) {
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
      return (target < 0 ? 'Aucune terre libre à ta frontière.' : `Tu n'as pas de frontière avec ${this.players[target].name}.`) +
        (building ? ' Ton avant-poste est encore en construction : ses soldats ne pourront attaquer qu\'une fois les travaux finis.' : '');
    }
    // Un royaume qui a encore un château ou une église ne s'attaque qu'en visant l'un d'eux.
    // Sans château ni église, on peut attaquer tout son territoire de front (comme une terre libre).
    // castle = château ou église visé par l'assaut
    let castle = -1, path = null;
    if (target >= 0 && this.isProtected(target)) {
      const name = this.players[target].name, b = aimTile !== undefined ? this.building[aimTile] : 0;
      if (TARGET_TYPES.includes(b) && this.owner[aimTile] === target) castle = this.anchor[aimTile];
      if (castle < 0) {
        return `${name} est protégé : clique sur un de ses châteaux, églises, ports ou avant-postes pour lancer un assaut.`;
      }
    }
    let a = this.attacks.find(a => !a.done && a.attacker === pid && a.target === target && a.link === undefined
      && this.sourceOfAttack(a) === source);
    if (a && a.targetCastle !== castle) return `Un assaut contre ${this.players[target].name} est déjà en cours.`;
    // Assaut déjà en préparation : il garde ses points de passage
    if (!waypoints) waypoints = a && a.waypoints ? a.waypoints : [];
    if (castle >= 0) {
      const name = this.players[target].name;
      path = this.castlePath(pid, castle, waypoints, source);
      if (!path) {
        return `Impossible d'atteindre ${this.targetLabel(castle)} : ` +
          `des fortifications ${this.deName(name)} bloquent le passage. Prends d'abord les châteaux de la frontière.`;
      }
    }
    // Assaut déjà lancé : les renforts partent et arrivent dans REINFORCE_DELAY secondes
    if (a && target >= 0 && !this.isPreparing(a)) {
      this.takeTroops(pid, source, troops);
      a.pending.push({ troops, tick: this.tick + CONFIG.REINFORCE_DELAY * CONFIG.TICKS_PER_SECOND });
      return null;
    }
    if (!a) {
      a = {
        id: this.nextAttackId++, attacker: pid, target, troops: 0, done: false, startTick: this.tick,
        targetCastle: castle,
        source,        // d'où part l'armée (-1 = royaume, sinon avant-poste)
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
          const alone = castle >= 0 && this.building[castle] === B_OUTPOST;
          UI.log(`⚠️ ${p.name} prépare un assaut contre toi (${fmt(troops)} soldats) ! ` +
            (castle < 0 ? 'Sans château ni église, toutes tes troupes défendront d\'office, désorganisées.'
              : alone ? 'Il vise ton avant-poste : seuls les soldats débarqués le défendront.'
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
  // waypoints = points de passage choisis par le joueur : l'armée passe par chacun d'eux, dans l'ordre,
  // en prenant à chaque fois le chemin le plus facile.
  castlePath(pid, c, waypoints = [], source) {
    const passable = this.castlePassable(c), foot = new Set(this.footprint(c, this.building[c]));
    const target = this.owner[c];
    // (un point de passage devenu impossible, par exemple pris entre-temps, est oublié)
    const goals = waypoints.filter(w => passable(w) && !foot.has(w)).map(w => new Set([w]));
    goals.push(foot);
    let path = [], from = -1; // -1 = on part de la frontière
    for (const goal of goals) {
      const seg = this.searchPath(pid, from, goal, passable, target, source);
      if (!seg) return null;
      path = path.concat(from < 0 ? seg : seg.slice(1));
      from = seg[seg.length - 1];
    }
    return path;
  },

  // Recherche du chemin le plus facile (algorithme de Dijkstra) depuis la case from
  // (ou depuis toute la frontière de pid si from = -1) jusqu'à une case de goal.
  searchPath(pid, from, goal, passable, target, source) {
    const dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-2);
    const done = new Uint8Array(this.N); // cases déjà traitées (chacune une seule fois)
    const heap = new MinHeap();
    const start = i => { dist[i] = this.tileDefense(target, i); prev[i] = -1; heap.push(dist[i], i); };
    if (from >= 0) start(from);
    else for (let i = 0; i < this.N; i++) if (passable(i) && this.touchesOwn(i, pid, source)) start(i);
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
  planAssault(pid, target) {
    const castles = this.nearestTargets(pid, target);
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
      if (passable(i) && this.touchesOwn(i, pid)) {
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
      else a.pending.push({ troops, tick: this.tick + CONFIG.REINFORCE_DELAY * CONFIG.TICKS_PER_SECOND });
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
    // Comme tout assaut contre un royaume : une préparation que tout le monde voit
    a.startTick = this.tick + CONFIG.ATTACK_PREP_TIME * CONFIG.TICKS_PER_SECOND;
    a.prepTicks = a.startTick - this.tick;
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

  // Prépare un débarquement de pid sur la côte i : { error } ou { port, path, time, cost, zone }
  planLanding(pid, i) {
    const p = this.players[pid];
    const ports = this.expeditionPorts(pid);
    if (!ports.length) return { error: 'Il te faut un port de niveau 2 pour les expéditions maritimes.' };
    if (!this.landable(pid, i) || !this.isCoastal(i)) {
      return { error: 'On débarque sur une côte (au bord de la mer ou d\'un fleuve) qui n\'est ni à toi ni à un allié, à côté des bâtiments.' };
    }
    if (this.expeditions.some(e => e.pid === pid && e.landing === i)) return { error: 'Une expédition est déjà en route vers cette côte.' };
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

  // Part des soldats perdus pendant une traversée de `time` secondes
  seaLoss(time) { return Math.min(CONFIG.SEA_LOSS_MAX, time * CONFIG.SEA_LOSS_PER_SECOND); },

  // Lance une expédition avec `troops` soldats : le bateau part du port et débarque en arrivant.
  // Les soldats arrivés défendent l'avant-poste. Renvoie un message d'erreur, ou null.
  launchExpedition(pid, i, troops) {
    const plan = this.planLanding(pid, i), p = this.players[pid];
    if (plan.error) return plan.error;
    if (p.gold < plan.cost) return `Pas assez d'or pour l'expédition (💰 ${plan.cost}).`;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < plan.minTroops) {
      return `Il faut au moins ${plan.minTroops} soldats pour l'expédition : de quoi remplir la garnison ` +
        'de l\'avant-poste (pertes en mer comprises).';
    }
    p.gold -= plan.cost;
    p.troops -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: i, path: plan.path, cost: plan.cost, sent: troops,
      interceptors: [], // bateaux ennemis partis l'intercepter
      troops: troops * (1 - this.seaLoss(plan.time)), // ceux qui arriveront
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(plan.time * TPS)) });
    // Prévenir les royaumes dont la côte est visée
    const o = this.owner[i];
    if (o >= 0 && this.players[o].isHuman) {
      UI.log(`⛵ ${p.name} envoie une expédition vers ta côte ! Avec un port, clique sur son bateau pour l'intercepter.`, 'warn', p);
    }
    return null;
  },

  // --- Intercepter un débarquement ---
  // Avec un port (de n'importe quel niveau), on peut envoyer des soldats en bateau jusqu'à la côte visée
  // par une expédition ennemie. S'ils y arrivent avant elle, il y a bataille en mer à son arrivée.
  // Renvoie { error } ou { port, path, arrive } (le plus rapide de ses ports).
  planInterception(pid, e) {
    if (e.pid === pid || this.areAllied(pid, e.pid)) return { error: 'Ce bateau n\'est pas ennemi.' };
    const ports = this.buildingTiles.filter(a => this.building[a] === B_PORT && this.owner[a] === pid);
    if (!ports.length) return { error: 'Il te faut un port pour intercepter un débarquement.' };
    let best = null;
    for (const a of ports) {
      const path = this.boatPath(a, e.landing);
      if (!path) continue;
      const speed = Math.max(this.buildingInfo(a).boatSpeed, CONFIG.INTERCEPT_SPEED);
      const arrive = this.tick + Math.max(1, Math.round(path.length / speed * CONFIG.TICKS_PER_SECOND));
      if (!best || arrive < best.arrive) best = { port: a, path, arrive };
    }
    if (!best) return { error: 'Aucun de tes ports ne peut rejoindre ces eaux.' };
    if (best.arrive > e.arrive) return { error: 'Trop loin : tes bateaux arriveraient après le débarquement.' };
    return best;
  },

  launchInterception(pid, expeditionId, troops) {
    const e = this.expeditions.find(x => x.id === expeditionId && !x.done), p = this.players[pid];
    if (!e) return 'Cette expédition est déjà arrivée.';
    const plan = this.planInterception(pid, e);
    if (plan.error) return plan.error;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return 'Pas assez de soldats !';
    p.troops -= troops;
    e.interceptors.push({ pid, troops, path: plan.path, start: this.tick, arrive: plan.arrive });
    if (this.players[e.pid].isHuman) UI.log(`⚓ ${p.name} envoie des bateaux intercepter ton expédition !`, 'warn', p);
    return null;
  },

  // Bataille en mer à l'arrivée de l'expédition e : chaque escadre qui l'attend la combat (1 contre 1,
  // corrigé par la force des soldats). Renvoie les soldats de l'expédition qui restent.
  seaBattle(e) {
    let troops = e.troops;
    const p = this.players[e.pid];
    for (const it of e.interceptors) {
      const q = this.players[it.pid];
      if (!q.alive) continue;
      if (troops < 1) { q.troops += it.troops; continue; } // plus personne à combattre : retour au port
      const pe = this.troopPower(e.pid), pi = this.troopPower(it.pid);
      const se = troops * pe, si = it.troops * pi;
      if (si >= se) {
        q.troops += (si - se) / pi; // les survivants rentrent
        troops = 0;
        if (q.isHuman) UI.log(`⚓ Ton escadre a coulé l'expédition ${this.deName(p.name)} !`, 'good', p);
        if (p.isHuman) UI.log(`⚓ ${q.name} a intercepté et coulé ton expédition !`, 'warn', q);
      } else {
        troops = (se - si) / pe;
        if (q.isHuman) UI.log(`⚓ Ton escadre n'a pas suffi : l'expédition ${this.deName(p.name)} débarque quand même.`, 'warn', p);
        if (p.isHuman) UI.log(`⚓ Ton expédition a repoussé les bateaux ${this.deName(q.name)}, mais avec des pertes.`, 'warn', q);
      }
    }
    return troops;
  },

  // Les soldats d'escadres qui n'ont pas eu à combattre rentrent
  returnInterceptors(e) {
    for (const it of e.interceptors) if (this.players[it.pid].alive) this.players[it.pid].troops += it.troops;
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
          return { path, river, time: river * CONFIG.CROSSING_TIME_PER_TILE };
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
  launchCrossing(pid, i, troops) {
    const p = this.players[pid], plan = this.planCrossing(pid, i);
    if (plan.error) return plan.error;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return 'Pas assez de soldats !';
    p.troops -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.crossings.push({ pid, target: i, path: plan.path, troops, start: this.tick,
      arrive: this.tick + Math.max(1, Math.round(plan.time * TPS)) });
    return null;
  },

  // Arrivée des traversées : on prend le gué (les cases de fleuve traversées) et une tête de pont sur l'autre rive.
  // Si quelqu'un a pris le passage entre-temps, la traversée échoue et les soldats rentrent.
  stepCrossings() {
    for (const c of this.crossings) {
      if (this.tick < c.arrive) continue;
      c.done = true;
      const p = this.players[c.pid];
      if (!p.alive) continue;
      const blocked = c.path.slice(1).some(t => this.owner[t] !== -1 && this.owner[t] !== c.pid);
      if (blocked || this.owner[c.path[0]] !== c.pid) {
        p.troops += c.troops;
        if (p.isHuman) UI.log('🚫 Le passage du fleuve a été pris par un autre : tes soldats rentrent.', 'warn');
        continue;
      }
      // Le gué, puis les terres libres de la rive autour de la case visée (sans repasser par le fleuve)
      const R = CONFIG.CROSSING_BANK_RADIUS, W = this.W, x0 = c.target % W, y0 = (c.target / W) | 0;
      const bank = new Set([c.target]);
      for (const j of bank) {
        this.forNeighbors(j, n => {
          if (bank.has(n) || this.owner[n] !== -1 || !this.isLand(n) || this.terrain[n] === TERRAIN.RIVER) return;
          if ((n % W - x0) ** 2 + (((n / W) | 0) - y0) ** 2 <= R * R) bank.add(n);
        });
      }
      let troops = c.troops;
      for (const t of [...c.path.slice(1), ...bank]) {
        if (this.owner[t] === c.pid) continue;
        const cost = CONFIG.NEUTRAL_TILE_COST * TERRAIN_INFO[this.terrain[t]].cost;
        if (troops < cost) break;
        troops -= cost;
        this.setOwner(t, c.pid);
      }
      p.troops += troops; // les survivants rejoignent l'armée
      if (p.isHuman) UI.log('🛶 Tes soldats ont traversé le fleuve : la terre de l\'autre rive est à toi !', 'good');
    }
    this.crossings = this.crossings.filter(c => !c.done);
  },

  stepExpeditions() {
    for (const e of this.expeditions) {
      if (this.tick < e.arrive) continue;
      e.done = true;
      const p = this.players[e.pid];
      if (!p.alive) { this.returnInterceptors(e); continue; }
      // Renforts pour un avant-poste : ils rejoignent sa garnison (ou rentrent s'il n'existe plus)
      if (e.reinforce !== undefined) {
        if (e.interceptors.length) e.troops = this.seaBattle(e);
        if (e.troops < 1) continue;
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
        this.returnInterceptors(e);
        p.gold += e.cost; // la côte n'est plus possible (prise par soi ou un allié, bâtie…) : l'or est rendu
        p.troops += e.troops; // et les soldats rentrent
        if (p.isHuman) UI.log('⛵ Impossible de débarquer sur la côte visée : l\'expédition rentre (or et soldats rendus).', 'warn');
        continue;
      }
      // Bataille en mer contre ceux qui attendent l'expédition
      if (e.interceptors.length) {
        e.troops = this.seaBattle(e);
        if (e.troops < 1) continue; // expédition coulée : l'or est perdu
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
    const total = a.defenders + (a.garrison || 0);
    // Supériorité en nombre : le camp bien plus nombreux frappe plus vite et perd moins de soldats
    // (un défenseur ne peut pas bloquer 300 soldats en envoyant 2 ou 3 hommes à la fois)
    const atkBonus = this.numbersBonus(a.troops, total);
    const defBonus = this.numbersBonus(total, a.troops);
    const base = Math.max(CONFIG.FIGHT_MIN_LOSS, CONFIG.FIGHT_RATE * Math.min(a.troops, total)) * atkBonus * defBonus;
    const defLoss = Math.min(total, base);
    // La garnison combat en premier, puis les défenseurs envoyés
    const fromGarrison = Math.min(a.garrison || 0, defLoss);
    a.garrison = (a.garrison || 0) - fromGarrison;
    a.defenders -= defLoss - fromGarrison;
    a.troops = Math.max(0, a.troops - defLoss * D * defBonus / atkBonus);
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
  // (un avant-poste, au-delà des mers, ne peut compter que sur sa garnison)
  cutOff(a) {
    const c = a.targetCastle, b = this.building[c];
    return c >= 0 && (b === B_CASTLE || b === B_PORT || b === B_OUTPOST) && this.owner[c] === a.target && this.isIsolated(c);
  },

  // Le défenseur envoie des soldats contre un assaut (sans délai, autant qu'il veut)
  sendDefenders(pid, attackId, troops) {
    const p = this.players[pid];
    const a = this.attacks.find(a => a.id === attackId && a.target === pid && !a.done);
    if (!a) return null;
    // Château isolé : personne ne peut le rejoindre. Avant-poste bâti : ses soldats stationnés le défendent.
    let src = -1;
    if (this.cutOff(a)) {
      if (this.building[a.targetCastle] !== B_OUTPOST || !this.outpostReady(a.targetCastle)) return null;
      src = a.targetCastle;
    }
    troops = Math.floor(Math.min(troops, this.troopsAt(pid, src)));
    if (troops < 1) return null;
    this.takeTroops(pid, src, troops);
    a.defenders += troops;
    if (src >= 0) a.defSource = src;
    return a;
  },

  stepAttack(a) {
    if (this.isPreparing(a)) return;
    if (a.prepTicks && this.tick === a.startTick) {
      // Fin de la préparation : la frontière a pu bouger entre-temps
      a.list = this.buildFrontier(a.attacker, a.target, this.sourceOfAttack(a));
      a.set = new Set(a.list);
      // Assaut sur un château : le chemin est-il toujours libre ?
      if (a.targetCastle >= 0 && !a.castleTaken) {
        const path = this.owner[a.targetCastle] === a.target
          ? this.castlePath(a.attacker, a.targetCastle, a.waypoints, this.sourceOfAttack(a)) : null;
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
    // Tant que des défenseurs (garnison ou renforts) tiennent la position, l'assaut se bat au lieu d'avancer
    if (a.defenders + (a.garrison || 0) >= 1) return this.fight(a);
    // Siège : l'armée est au pied des murs. Le château ne tombe qu'à la fin du siège ;
    // d'ici là, le défenseur peut encore envoyer des soldats (on se bat alors, juste au-dessus).
    if (a.siege) {
      if (this.owner[a.siege.tile] !== a.target) return this.endAttack(a); // le château a changé de mains
      if (this.tick < a.siege.end) return;
      return this.takeCastle(a, a.siege.tile);
    }
    // Points de marche de ce tour : prendre une case en coûte autant que sa défense de terrain
    // (plaine 1, forêt 1.6, colline 2.2, montagne 3.5, fleuve 4). On avance donc vite en plaine
    // et lentement dans le relief. Les points non utilisés sont gardés pour le tour suivant.
    // Contre un royaume, l'armée avance ASSAULT_SLOWDOWN fois moins vite (elle traverse des terres défendues).
    let speed = Math.max(CONFIG.MIN_ATTACK_SPEED, Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED);
    if (a.target >= 0) speed /= CONFIG.ASSAULT_SLOWDOWN;
    // (on peut toujours garder de quoi prendre une montagne, sinon une petite armée resterait bloquée)
    a.move = Math.min((a.move || 0) + speed, Math.max(speed * 2, MAX_LAND_COST));
    while (!a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) return this.endAttack(a);
      if (a.troops < this.tileCost(a, t)) return this.endAttack(a); // plus assez de soldats
      // Arrivée au pied d'un château : le siège commence (il ne tombe pas tout de suite)
      if (a.target >= 0 && this.building[t] === B_CASTLE) return this.startSiege(a, t);
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
      // Prendre une case entre deux cases du défenseur peut couper son royaume (voir captureEnclaves)
      if (a.target >= 0 && this.countNeighborsOwnedBy(t, a.target) >= 2) a.cut = true;
      this.setOwner(t, a.attacker);
      // Prise de l'église, du port ou de l'avant-poste visé : l'assaut s'arrête là
      const b = this.building[t];
      if (a.targetCastle >= 0 && b && b !== B_CASTLE && this.anchor[t] === a.targetCastle) {
        this.onTargetTaken(a, b);
        if (b === B_OUTPOST) this.removeBuilding(a.targetCastle); // un avant-poste pris est détruit
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

  // Château pris : toute sa zone de défense passe d'un coup à l'attaquant, avec les moulins et casernes
  // qui s'y trouvent (une église, un port ou un autre château reste au défenseur : il faut le viser)
  // L'armée arrive au pied du château (case t) : le siège dure quelques secondes selon son niveau
  startSiege(a, t) {
    const secs = this.castleInfo(this.anchor[t]).siege;
    a.siege = { tile: t, end: this.tick + secs * CONFIG.TICKS_PER_SECOND };
    a.frontTile = t; // on se bat au pied des murs (avec leur bonus de défense)
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(`🏰 Ton armée assiège un château ${this.deName(d.name)} : il tombe dans ${secs} s si personne ne le défend.`, 'good', d);
    else if (d.isHuman) UI.log(`🏰 ${p.name} assiège ton château ! Il tombe dans ${secs} s : envoie vite des défenseurs !`, 'warn', p);
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
    for (const i of zone) {
      if (this.owner[i] !== a.target) continue; // (déjà pris avec un bâtiment)
      const b = this.building[i];
      if (b && this.anchor[i] !== castle && TARGET_TYPES.includes(b)) continue;
      this.setOwner(i, a.attacker);
    }
    a.cut = true; // la zone prise peut couper le royaume du défenseur (voir captureEnclaves)
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(`🏰 Tu as pris un château de ${d.name}, avec toute sa zone et ses bâtiments !`, 'good', d);
    else if (d.isHuman) UI.log(`🏰 ${p.name} a pris un de tes châteaux !`, 'warn', p);
  },

  onTargetTaken(a, type) {
    const p = this.players[a.attacker], d = this.players[a.target];
    const what = { [B_CHURCH]: ['⛪', 'une église', 'une de tes églises'], [B_PORT]: ['⚓', 'un port', 'un de tes ports'],
      [B_OUTPOST]: ['⛺', 'un avant-poste', 'un de tes avant-postes'] }[type];
    const verb = type === B_OUTPOST ? 'détruit' : 'pris';
    if (p.isHuman) UI.log(`${what[0]} Tu as ${verb} ${what[1]} de ${d.name} !`, 'good', d);
    else if (d.isHuman) UI.log(`${what[0]} ${p.name} a ${verb} ${what[2]} !`, 'warn', p);
  },

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    const p = this.players[a.attacker];
    // Les survivants (et les renforts encore en route) rentrent à la maison (ou à leur avant-poste)
    this.giveTroops(a.attacker, this.sourceOfAttack(a), a.troops + a.pending.reduce((s, r) => s + r.troops, 0));
    // Les défenseurs survivants rentrent aussi, et la garnison regagne son château
    if (a.target >= 0 && this.players[a.target].alive) {
      this.giveTroops(a.target, a.defSource === undefined ? -1 : a.defSource, a.defenders);
    }
    const c = a.targetCastle;
    if (c >= 0 && a.garrison > 0 && this.owner[c] === a.target) {
      this.garrison[c] = Math.min(this.garrisonMax(c), this.garrison[c] + a.garrison);
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
      const max = this.garrisonMax(c);
      if (!max || max === Infinity || this.owner[c] < 0 || besieged.has(c) || full[this.owner[c]]) continue;
      this.garrison[c] = Math.min(max, this.garrison[c] + max * CONFIG.GARRISON_REGEN / TPS);
    }

    this.levy();
    for (const a of this.attacks.slice()) if (!a.done) this.stepAttack(a);
    // Un assaut a pu couper un royaume en morceaux : les petits morceaux encerclés sont pris
    for (const a of this.attacks) {
      if (a.cut) { a.cut = false; this.captureEnclaves(a.target, a.attacker); }
    }
    this.attacks = this.attacks.filter(a => !a.done);
    this.stepExpeditions();
    this.stepCrossings();
    this.stepOutposts();
    // Toutes les 2 secondes : un morceau a pu être coupé autrement (débarquement…)
    if (this.tick % (2 * TPS) === 0) for (const p of this.players) if (p.alive) this.captureEnclaves(p.id);

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
