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
    this.mapSize = opts.mapSize || 'moyen';
    const map = generateMap((Math.random() * 1e9) | 0, this.mapType, this.mapSize);
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
    this.walls = [];         // murs bâtis par les villes : { castle, owner, tiles, start, ready, done }
    this.faithProgress = new Map(); this.faithCache = null; // (Croyance : voir stepFaith)
    this.crusades = []; // croisades religieuses en cours : { church, owner, end } (voir startCrusade)
    this.wallAt = new Uint8Array(this.N); // 1 = case d'un mur fini (aucun assaut ne la franchit)
    this.crossings = [];   // armées qui traversent un fleuve à gué
    this.bridges = [];     // ponts : { tiles (cases de fleuve), a, b (cases des deux rives), owner } (voir buildBridge)
    this.bridgeAt = new Uint8Array(this.N); // 1 = case de fleuve couverte par un pont
    this.tradeRoutes = []; // routes commerciales : { from, to (villes), active, pts, len, income } (voir buildTrade)
    this.returning = [];   // défenseurs qui rentrent à pied (l'assaut qu'ils allaient contrer est fini)
    this.outposts = new Map(); // avant-poste → { ready : tick où il est bâti, landing : case du débarquement }
    this.colonies = new Map(); // château bâti ou pris dans la zone d'un avant-poste → son royaume
    this.truces = new Map();   // château, église ou port qui vient d'être conquis → tour jusqu'auquel on ne peut pas l'attaquer
    this.nextAttackId = 1;
    this.pacts = new Map(); // id du pacte → { name }
    this.nextPactId = 0;
    this.buildingTiles = [];
    this.castles = [];
    this.tick = 0;
    this.version = 0; // augmente à chaque changement de la carte
    // (calculs gardés en mémoire d'une partie à l'autre : on les oublie)
    this.regionsCache = null; this.regionsVersion = -1; this.nbStatsVersion = -1; this.nbStatsTick = undefined; this.assaultPlans = new Map();
    this.roadsVersion = -1; this.walledPortsVersion = -1; this.slotVersion = -1; this.slotCache = null;
    this.routeCache = new Map(); // tracés des routes déjà calculés (voir roadRoute)
    this.landCount = 0;
    for (let i = 0; i < this.N; i++) if (this.claimable(i)) this.landCount++; // (les fleuves ne se possèdent pas)
    this.placeDeposits(); // ⛏️ les filons de minerai (voir MINES)

    this.difficulty = DIFFICULTIES[opts.difficulty];
    this.speed = 1; // vitesse de la partie (x1, x1.5, x2, x3 : bouton ⏩ en jeu) : la boucle de jeu tourne plus vite (voir main.js)
    this.pactsAllowed = opts.pacts !== false; // choisi dans le menu : pactes autorisés ou interdits
    // ⚔️ Mode « Factions » (carte Azeroth) : 3 camps éternels, chacun à ses capitales du jeu (voir startFactions)
    this.factions = !!opts.factions && this.mapType === 'azeroth';
    if (this.factions) this.pactsAllowed = false; // (pas d'autres pactes que les 3 camps)
    this.human = this.addPlayer(opts.name, opts.banner, true);
    if (this.factions) return this.startFactions(opts);
    const names = KINGDOMS.slice().sort(() => Math.random() - 0.5);
    // Les bots reçoivent au hasard les bannières de la carte que le joueur n'a pas prises (sur Azeroth : les écus, et
    // chaque royaume prend le nom de son écu : les Orcs, les Nains…)
    const banners = bannersForMap(this.mapType).filter(k => k !== opts.banner).sort(() => Math.random() - 0.5);
    banners.forEach((b, k) => { if (BANNERS[b].kingdom) names[k] = BANNERS[b].kingdom; });
    // Nombre de royaumes rivaux : choisi dans le menu (au moins MIN_OPPONENTS), sinon celui de la difficulté
    const bots = Math.max(CONFIG.MIN_OPPONENTS, opts.opponents || this.difficulty.bots);
    for (let k = 0; k < bots && k < banners.length && names[k]; k++) {
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
      sumXX: 0, sumYY: 0, sumXY: 0, // (pour l'allongement et la direction du royaume : voir Render.kingdomAxis)
      bCount: [0, 0, 0, 0, 0, 0, 0, 0],
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

  // Un royaume « ami » : soi-même ou un allié du même pacte
  isFriend(pid, o) { return o === pid || (o >= 0 && this.areAllied(pid, o)); },

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
      o.tiles--; o.sumX -= x; o.sumY -= y; o.sumXX -= x * x; o.sumYY -= y * y; o.sumXY -= x * y;
      if (b) o.bCount[b]--;
    }
    this.owner[i] = pid;
    this.version++;
    // (une case d'un mur, finie ou en chantier, change de mains : le mur est perdu)
    if (this.walls.length) for (const w of this.walls) if (w.tiles.includes(i)) { this.removeWall(w); break; }
    if (pid >= 0) {
      const p = this.players[pid];
      p.tiles++; p.sumX += x; p.sumY += y; p.sumXX += x * x; p.sumYY += y * y; p.sumXY += x * y;
      if (b) p.bCount[b]++;
      if (p.tiles > p.maxTiles) p.maxTiles = p.tiles;
    }
    Render.markDirty(i);
    // Prendre une case d'un bâtiment, c'est prendre tout le bâtiment
    if (this.building[i]) {
      const a = this.anchor[i];
      for (const j of this.footprint(a, this.building[a])) if (this.owner[j] !== pid) this.setOwner(j, pid);
    }
    if (old >= 0 && pid >= 0) this.players[old].lastHitBy = pid; // (pour savoir qui l'a anéanti, voir outpostsOnly)
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
    // (une mine : seulement sur un filon, tout entier à nous, sans les autres règles de construction : cercles
    //  rouges, muraille, écart entre bâtiments ; les autres bâtiments, eux, laissent un peu de place autour d'un filon)
    if (type === B_MINE) {
      return this.depositAt.has(a) && this.footprint(a, type).every(j => this.owner[j] === pid && !this.building[j])
        && this.commanded(a, type);
    }
    if (this.nearDeposit(a, type)) return false;
    if (type === B_PORT && !this.footprint(a, type).some(j => this.isCoastal(j))) return false;
    return this.footprint(a, type).every(j => this.owner[j] === pid && this.isLand(j) && !this.building[j]
      && this.terrain[j] !== TERRAIN.RIVER)
      && this.insideWalls(pid, a, type) && !this.tooCloseToBuilding(a, type)
      && !this.churchCastleConflict(pid, a, type) && this.commanded(a, type);
  },

  // Le bâtiment type, posé en a, serait-il sur un filon ou à moins de DEPOSIT_CLEARANCE cases d'un filon ?
  nearDeposit(a, type) {
    const n = this.sizeOf(type), m = CONFIG.DEPOSIT_CLEARANCE, x0 = a % this.W, y0 = (a / this.W) | 0;
    for (let y = Math.max(0, y0 - m); y <= Math.min(this.H - 1, y0 + n - 1 + m); y++) {
      for (let x = Math.max(0, x0 - m); x <= Math.min(this.W - 1, x0 + n - 1 + m); x++) {
        if (this.depositTile[y * this.W + x]) return true;
      }
    }
    return false;
  },

  // Un territoire désorganisé (son morceau n'a ni ville ni port fortifié pour le diriger, ni avant-poste) ne peut
  // rien construire d'autre qu'un château : il lui faut d'abord une ville pour diriger le royaume.
  commanded(a, type) {
    if (type === B_CASTLE) return true;
    const r = this.regionsAt(a), k = r.comp[a];
    return k >= 0 && (r.held[k] || r.anyOutpost[k]);
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

  // Moulins et casernes se construisent dans l'enceinte d'une de ses villes (châteaux), ou près d'une de ses
  // églises (ou d'un port), qui a encore de la place (pas ailleurs dans l'arrière-pays).
  // Les châteaux et les églises se construisent partout sur son territoire
  // (mais une église reste loin des châteaux : voir churchCastleConflict).
  insideWalls(pid, a, type) {
    if (type === B_CASTLE || type === B_CHURCH || type === B_PORT) return true;
    return this.castleFor(pid, a, type) >= 0 || this.churchFor(pid, a, type) >= 0;
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

  // Nombre de moulins et casernes déjà construits grâce à la ville, à l'église ou au port ch (ses places prises)
  churchUsed(ch) {
    this.slotHosts();
    return this.slotUsed.get(ch) || 0;
  },

  // Églises et ports du royaume pid qui ont des places, les ports d'abord (ils passent en priorité)
  // (liste gardée en mémoire avec slotHosts : les bots la demandent pour chaque case de leur royaume)
  slotBuildings(pid) {
    this.slotHosts();
    return this.slotLists.get(pid) || [];
  },

  // Pour chaque moulin ou caserne : la ville (château), le port ou l'église dont il occupe une place.
  // Dans la muraille d'une ville, il prend une place de la ville (slots : 4, 6 ou 9 selon son niveau) ; sinon
  // (ou si les villes autour sont pleines), celle d'un port ou d'une église. Un bâtiment dans plusieurs zones ne
  // compte que pour une : la ville d'abord, puis le port, puis l'église (s'il leur reste de la place).
  // Renvoie une Map : bâtiment → ville/port/église. (recalculé seulement quand la carte change)
  slotHosts() {
    if (this.slotCache && this.slotCheckTick === this.tick) return this.slotCache; // (vérifié une fois par tour)
    this.slotCheckTick = this.tick;
    // (signature des bâtiments : on recalcule s'ils ont changé, sinon au plus une fois par seconde)
    let sig = this.buildingTiles.length;
    for (const a of this.buildingTiles) sig = (sig * 31 + a * 7 + this.owner[a] * 3 + this.level[a]) | 0;
    if (this.slotCache && this.slotSig === sig && (this.slotVersion === this.version || this.tick - this.slotTick < CONFIG.TICKS_PER_SECOND)) {
      return this.slotCache;
    }
    this.slotSig = sig; this.slotTick = this.tick;
    // les églises et ports avec des places, par royaume, les ports d'abord
    const lists = new Map();
    for (const a of this.buildingTiles) {
      if (!this.hasSlots(a) || this.owner[a] < 0) continue;
      if (!lists.has(this.owner[a])) lists.set(this.owner[a], []);
      lists.get(this.owner[a]).push(a);
    }
    for (const list of lists.values()) list.sort((a, b) => (this.building[b] === B_PORT) - (this.building[a] === B_PORT));
    this.slotLists = lists;
    const hosts = new Map(), used = new Map(), pending = [];
    for (const b of this.buildingTiles) {
      const t = this.building[b], o = this.owner[b];
      if ((t !== B_MILL && t !== B_BARRACKS) || o < 0) continue;
      const cells = this.footprint(b, t);
      // (les villes d'abord, puis les ports et les églises)
      const cands = this.castles.filter(c => this.owner[c] === o && cells.every(j => this.inWalls(c, j)))
        .concat((lists.get(o) || []).filter(ch => cells.every(j => this.inChurchRange(ch, j, this.buildingInfo(ch).radius))));
      if (!cands.length) continue;
      // un seul hôte possible : il le prend tout de suite ; sinon on décide après (voir plus bas)
      if (cands.length === 1) { hosts.set(b, cands[0]); used.set(cands[0], (used.get(cands[0]) || 0) + 1); }
      else pending.push([b, cands]);
    }
    for (const [b, cands] of pending) {
      const ch = cands.find(c => (used.get(c) || 0) < this.buildingInfo(c).slots) ?? cands[0];
      hosts.set(b, ch);
      used.set(ch, (used.get(ch) || 0) + 1);
    }
    // Un moulin (ou une caserne) resté à un royaume, alors que l'église ou le port dont il occupait la place est passé
    // à un autre (par la Croyance, par exemple) : il occupe toujours cette place. Le nouveau maître de l'église ne peut
    // donc pas en bâtir un autre à côté, tant qu'il ne l'a pas améliorée.
    for (const b of this.buildingTiles) {
      const t = this.building[b], o = this.owner[b];
      if ((t !== B_MILL && t !== B_BARRACKS) || o < 0 || hosts.has(b)) continue;
      const cells = this.footprint(b, t);
      for (const [q, list] of lists) {
        if (q === o) continue;
        const ch = list.find(c => cells.every(j => this.inChurchRange(c, j, this.buildingInfo(c).radius)));
        if (ch !== undefined) { used.set(ch, (used.get(ch) || 0) + 1); break; }
      }
    }
    this.slotCache = hosts;
    this.slotUsed = used;
    this.slotVersion = this.version;
    return hosts;
  },

  // Bâtiment qui permet de construire autour de lui : une église, ou un port de niveau 2 ou 3
  hasSlots(a) {
    const t = this.building[a];
    return (t === B_CHURCH || t === B_PORT) && this.buildingInfo(a).slots > 0;
  },

  // Une ville (château) du royaume qui accepte ce moulin (ou cette caserne) : il est dans sa muraille et elle a
  // encore de la place (slots). -1 s'il n'y en a pas.
  castleFor(pid, a, type) {
    const cells = this.footprint(a, type);
    for (const c of this.castles) {
      if (this.owner[c] !== pid || !cells.every(j => this.inWalls(c, j))) continue;
      if (this.churchUsed(c) < this.castleInfo(c).slots) return c;
    }
    return -1;
  },

  // Une église (ou un port) du royaume qui accepte ce bâtiment (il est dans sa zone et elle a de la place), ou -1
  // (les ports d'abord : voir slotHosts)
  churchFor(pid, a, type) {
    const cells = this.footprint(a, type);
    for (const ch of this.slotBuildings(pid)) {
      const info = this.buildingInfo(ch);
      if (cells.every(j => this.inChurchRange(ch, j, info.radius)) && this.churchUsed(ch) < info.slots) return ch;
    }
    return -1;
  },

  // Châteaux qu'un royaume peut construire dans la partie : MAX_CASTLES, plus ceux de sa meilleure église
  // (seule la meilleure compte : les églises ne s'additionnent pas)
  maxCastles(p) {
    let extra = 0;
    for (const ch of this.buildingTiles) {
      if (this.building[ch] === B_CHURCH && this.owner[ch] === p.id) extra = Math.max(extra, this.buildingInfo(ch).castles);
    }
    return CONFIG.MAX_CASTLES + extra;
  },

  // Bâtiments visables par un assaut (château, église, port, avant-poste) d'un royaume
  targetsOf(pid) {
    return this.buildingTiles.filter(a => TARGET_TYPES.includes(this.building[a]) && this.owner[a] === pid);
  },

  // « ce château », « cette église »… pour les messages
  targetLabel(a) {
    return tr(['', '', '', 'ce château', 'cette église', 'ce port', 'cet avant-poste', 'cette mine'],
      ['', '', '', 'this castle', 'this church', 'this port', 'this outpost', 'this mine'])[this.building[a]] || tr('cette cible', 'this target');
  },

  // Retire un bâtiment de la carte (un avant-poste détruit)
  removeBuilding(a) {
    const type = this.building[a], o = this.owner[a];
    for (const j of this.footprint(a, type)) { this.building[j] = 0; this.anchor[j] = -1; Render.markDirty(j); }
    this.level[a] = 0;
    this.garrison[a] = 0;
    this.builtBy[a] = -1;
    this.outposts.delete(a);
    this.colonies.delete(a);
    this.works.delete(a);
    if (o >= 0) this.players[o].bCount[type]--;
    this.buildingTiles = this.buildingTiles.filter(b => b !== a);
    this.castles = this.castles.filter(c => c !== a);
    this.version++;
    this.regionsCache = null;
    this.slotCache = null; // (voir slotHosts)
  },

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
    if (type !== B_MINE) for (const j of this.footprint(i, type)) if (this.depositTile[j]) this.removeDeposit(j);
    this.regionsCache = null; // (le découpage dépend des bâtiments : à refaire)
    this.slotCache = null;    // (les places prises aussi : voir slotHosts)
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

  // --- ⛏️ Mines (voir MINES dans config.js) ---
  // Pose les filons sur la carte, au hasard : un carré de 2x2 cases de montagne (de colline pour la pierre),
  // loin des autres filons. Chaque filon garde son état (or qui reste, diamant extrait) d'un royaume à l'autre.
  placeDeposits() {
    this.deposits = [];
    this.depositAt = new Map();          // case en haut à gauche → filon
    this.depositTile = new Uint8Array(this.N); // 1 = case d'un filon
    const W = this.W, H = this.H, T = this.terrain, scale = Math.sqrt(this.N / (650 * 366)), TPS = CONFIG.TICKS_PER_SECOND;
    const fits = (kind, t) => MINES[kind].terrain === 'hills' ? t === TERRAIN.HILLS || t === TERRAIN.WOODED_HILLS : t === TERRAIN.MOUNTAIN;
    for (const kind of MINE_KINDS) {
      const [lo, hi] = MINES[kind].count, want = Math.max(1, Math.round((lo + Math.floor(Math.random() * (hi - lo + 1))) * scale));
      // les emplacements possibles : 4 cases de terre (pas de fleuve), dont au moins 3 du bon terrain
      const spots = [];
      for (let y = 1; y < H - 2; y++) {
        for (let x = 1; x < W - 2; x++) {
          const a = y * W + x, cells = [a, a + 1, a + W, a + W + 1];
          if (cells.every(j => this.claimable(j)) && cells.filter(j => fits(kind, T[j])).length >= 3) spots.push(a);
        }
      }
      for (let tries = 0, made = 0; made < want && tries < 400 && spots.length; tries++) {
        const a = spots[(Math.random() * spots.length) | 0], x = a % W, y = (a / W) | 0;
        if (this.deposits.some(d => Math.hypot(d.a % W - x, ((d.a / W) | 0) - y) < CONFIG.MINE_SPACING)) continue;
        const d = { a, kind, left: (MINES.gold.time) * TPS, progress: 0, paid: 0 };
        this.deposits.push(d);
        this.depositAt.set(a, d);
        for (const j of [a, a + 1, a + W, a + W + 1]) this.depositTile[j] = 1;
        made++;
      }
    }
  },
  // Retire le filon qui couvre la case j (un château de départ posé dessus)
  removeDeposit(j) {
    const d = this.deposits.find(d => [d.a, d.a + 1, d.a + this.W, d.a + this.W + 1].includes(j));
    if (!d) return;
    this.deposits = this.deposits.filter(e => e !== d);
    this.depositAt.delete(d.a);
    for (const k of [d.a, d.a + 1, d.a + this.W, d.a + this.W + 1]) this.depositTile[k] = 0;
  },
  // Infos d'une mine : son niveau, et ce que fait sa sorte de filon à ce niveau
  mineInfo(a) {
    const d = this.depositAt.get(a), lvl = this.level[a] || 1, base = MINE_LEVELS[lvl];
    if (!d) return base;
    return this.mineInfoAt(d.kind, lvl);
  },
  // Les infos d'une mine de cette sorte, à ce niveau (sans mine posée : pour les aperçus)
  mineInfoAt(kind, lvl) {
    const m = MINES[kind], name = lvl > 1 ? tr('Grande ', 'Great ') + m.name[0].toLowerCase() + m.name.slice(1) : m.name;
    // (or : les 2000 pièces du filon, réparties sur ses versements : un toutes les PRODUCTION_INTERVAL secondes)
    const gold = m.total ? m.total / (m.time / CONFIG.PRODUCTION_INTERVAL) : undefined;
    return { ...MINE_LEVELS[lvl], name, kind, power: m.power && m.power[lvl], gold,
      discount: m.discount && m.discount[lvl], speed: m.speed && m.speed[lvl] };
  },
  // Le filon de la mine a est-il épuisé ? (or : plus de temps d'exploitation ; diamant : tout extrait)
  mineSpent(a) {
    const d = this.depositAt.get(a);
    return !!d && (d.kind === 'gold' ? d.left <= 0 : d.kind === 'diamond' ? d.progress >= 1 : false);
  },
  // Une route relie-t-elle la mine a à une de ses villes ? (elle rapporte alors 2 fois plus)
  mineLinked(a) { return this.roads().has(a); },
  // La ville (château) de pid, la plus proche, à laquelle une route relierait une mine posée en a (-1 si aucune)
  mineRoadCastle(pid, a) {
    const land = this.landComp(), W = this.W, mid = (b, n) => [b % W + n / 2, ((b / W) | 0) + n / 2];
    const [px, py] = mid(a, this.sizeOf(B_MINE));
    let best = -1, bestD = Infinity;
    for (const c of this.castles) {
      if (this.owner[c] !== pid || land[c] !== land[a]) continue;
      const [cx, cy] = mid(c, this.sizeOf(B_CASTLE)), d = Math.hypot(cx - px, cy - py);
      if (d < bestD && d <= this.roadReach(c, CONFIG.MINE_ROAD_DISTANCE) && this.roadPoints(a, c, B_MINE)) { bestD = d; best = c; }
    }
    return best;
  },
  // Les mines de cette sorte que possède pid
  minesOf(pid, kind) {
    return this.buildingTiles.filter(a => this.building[a] === B_MINE && this.owner[a] === pid && this.depositAt.get(a)
      && this.depositAt.get(a).kind === kind);
  },
  // Bonus des mines de fer (force des troupes) ou des carrières (réduction des prix) de pid : la somme de ses
  // MINES[kind].max meilleures, chacune 2 fois plus si elle est reliée à une ville. (gardé en mémoire 1 s)
  mineBonus(pid, kind) {
    if (pid < 0) return 0;
    const key = this.version + ':' + Math.floor(this.tick / CONFIG.TICKS_PER_SECOND);
    if (this.mineBonusKey !== key) { this.mineBonusKey = key; this.mineBonusCache = new Map(); }
    const ck = pid + kind;
    if (this.mineBonusCache.has(ck)) return this.mineBonusCache.get(ck);
    const field = kind === 'iron' ? 'power' : 'discount', m = MINES[kind];
    const list = this.minesOf(pid, kind).filter(a => !this.underConstruction(a))
      .map(a => m[field][this.level[a] || 1] * (this.mineLinked(a) ? CONFIG.MINE_ROAD_FACTOR : 1));
    const v = list.sort((x, y) => y - x).slice(0, m.max).reduce((s, x) => s + x, 0);
    this.mineBonusCache.set(ck, v);
    return v;
  },
  // Chaque tour : les filons d'or s'épuisent pendant qu'on les exploite, et les mines de diamant avancent
  stepMines() {
    const TPS = CONFIG.TICKS_PER_SECOND;
    for (const d of this.deposits) {
      const a = d.a;
      if ((d.kind !== 'gold' && d.kind !== 'diamond') || this.building[a] !== B_MINE || this.owner[a] < 0) continue;
      if (this.underConstruction(a) || this.mineSpent(a)) continue;
      const p = this.players[this.owner[a]];
      if (d.kind === 'gold') {
        d.left--;
        if (d.left <= 0) {
          this.version++; // (sa route disparaît)
          if (p.isHuman) UI.log(tr('🪙 Ta mine d\'or est épuisée', '🪙 Your gold mine is exhausted') + (this.level[a] < 2
            ? tr(` : améliore-la pour la relancer ${Math.round(MINES.gold.time / 60)} minutes de plus !`, `: upgrade it to run it ${Math.round(MINES.gold.time / 60)} more minutes!`)
            : tr(' pour de bon.', ' for good.')), 'warn');
        }
        continue;
      }
      // 💎 diamant : 2 fois plus lent sans route, plus rapide au niveau 2
      const m = MINES.diamond, rate = m.speed[this.level[a] || 1] * (this.mineLinked(a) ? 1 : 0.5) / (m.time * TPS);
      d.progress = Math.min(1, d.progress + rate);
      while (d.paid < 3 && d.progress >= (d.paid + 1) / 4) {
        const pay = m.pay[d.paid]; // (1 000 au 1er quart, 2 000 au 2e, 3 000 au 3e)
        d.paid++;
        p.gold += pay;
        if (p.isHuman) { Render.floatText(a, B_MINE, `+${fmt(pay)} 💰`); UI.log(tr(`💎 Ta mine de diamant est extraite au ${d.paid}/4 : +${fmt(pay)} pièces !`, `💎 Your diamond mine is ${d.paid}/4 mined: +${fmt(pay)} gold!`), 'good'); }
      }
      if (d.progress >= 1) {
        p.gold += m.final;
        this.version++;
        if (p.isHuman) { Render.floatText(a, B_MINE, `+${fmt(m.final)} 💰`); UI.log(tr(`💎 Ta mine de diamant est entièrement extraite : +${fmt(m.final)} pièces ! Le filon est épuisé.`, `💎 Your diamond mine is fully mined: +${fmt(m.final)} gold! The ore vein is exhausted.`), 'good'); }
        else if (this.human && this.human.alive) UI.log(tr(`💎 ${p.name} a fini d'extraire une mine de diamant : +${fmt(m.final)} pièces !`, `💎 ${p.name} has finished mining a diamond mine: +${fmt(m.final)} gold!`), 'warn', p);
      }
    }
  },

  // Infos du niveau actuel d'un bâtiment (null s'il n'a pas de niveaux)
  buildingInfo(a) {
    if (this.building[a] === B_MINE) return this.mineInfo(a);
    const levels = BUILDING_LEVELS[this.building[a]];
    return levels ? levels[this.level[a] || 1] : null;
  },

  castleInfo(c) { return CASTLE_LEVELS[this.level[c] || 1]; },

  // Prix pour passer au niveau suivant (null si impossible)
  upgradeCost(a) {
    const levels = BUILDING_LEVELS[this.building[a]];
    const next = levels && levels[this.level[a] + 1];
    if (!next) return null;
    if (this.building[a] === B_MINE && this.depositAt.get(a).kind === 'diamond' && this.mineSpent(a)) return null; // (épuisée)
    // (🪨 les carrières de pierre du royaume font baisser le prix)
    return Math.round(next.upgradeCost * (1 - this.mineBonus(this.owner[a], 'stone')));
  },

  // Lance l'amélioration d'un bâtiment : on paie tout de suite, les travaux durent UPGRADE_TIME secondes
  // (40 s pour passer au niveau 2, 60 s pour le niveau 3, quel que soit le bâtiment).
  // Renvoie un message d'erreur, ou null si les travaux commencent.
  upgradeBuilding(p, a) {
    if (!this.building[a] || this.owner[a] !== p.id) return tr('Ce n\'est pas un de tes bâtiments.', 'This is not one of your buildings.');
    if (this.works.has(a)) return tr('Des travaux sont déjà en cours sur ce bâtiment.', 'Works are already under way on this building.');
    const cost = this.upgradeCost(a);
    if (cost === null) return tr('Ce bâtiment est déjà au niveau maximum.', 'This building is already at the maximum level.');
    const why = this.upgradeBlocker(p, a);
    if (why) return why;
    if (p.gold < cost) return tr(`Pas assez d'or (${cost} nécessaires).`, `Not enough gold (${cost} needed).`);
    p.gold -= cost;
    const T = CONFIG.UPGRADE_TIME, secs = T[Math.min(T.length - 1, this.level[a] - 1)];
    this.startWorks(p, a, 'up', secs, cost);
    return null;
  },

  // Pourquoi on ne peut pas améliorer le bâtiment a (même avec assez d'or), ou null. La cité impériale (château de
  // niveau 4) demande au moins un bâtiment de chaque type au niveau maximum, et on n'en bâtit qu'une par partie.
  upgradeBlocker(p, a) {
    const levels = BUILDING_LEVELS[this.building[a]], next = levels && levels[this.level[a] + 1];
    if (!next || !next.imperial) return null;
    const building = [...this.works].some(([b, w]) => w.pid === p.id && w.kind === 'up' && this.building[b] === B_CASTLE && this.level[b] >= 3);
    if (p.imperialBuilt || building) return tr('Tu as déjà ta cité impériale : une seule par partie.', 'You already have your imperial city: only one per game.');
    const top = t => BUILDING_LEVELS[t].length - 1; // (le niveau maximum de ce type de bâtiment)
    const missing = [B_MILL, B_BARRACKS, B_CHURCH, B_PORT].filter(t =>
      !this.buildingTiles.some(b => this.building[b] === t && this.owner[b] === p.id && this.level[b] >= top(t)));
    if (missing.length) {
      return tr('Il faut un bâtiment de chaque type au niveau maximum. Il manque : ', 'You need one building of each type at the maximum level. Missing: ') +
        missing.map(t => tr(`${BUILDINGS[t].name} niveau ${top(t)}`, `${BUILDINGS[t].name} level ${top(t)}`)).join(', ') + '.';
    }
    return null;
  },

  // Le royaume pid a-t-il une cité impériale (château de niveau 4) ?
  hasImperial(pid) { return this.castles.some(c => this.owner[c] === pid && this.castleInfo(c).imperial); },

  // Lance la démolition d'un de ses bâtiments (DEMOLISH_TIME secondes). Renvoie un message d'erreur, ou null.
  demolishBuilding(p, a) {
    if (!this.building[a] || this.owner[a] !== p.id || this.building[a] === B_OUTPOST) return tr('Ce n\'est pas un de tes bâtiments.', 'This is not one of your buildings.');
    if (this.building[a] === B_MINE) return tr('Une mine ne se démolit pas.', 'A mine cannot be demolished.');
    if (this.works.has(a)) return tr('Des travaux sont déjà en cours sur ce bâtiment.', 'Works are already under way on this building.');
    this.startWorks(p, a, 'down', CONFIG.DEMOLISH_TIME, 0);
    return null;
  },

  // --- Croyance ✝️ ---
  // Chaque église apporte de la Croyance à son royaume (faith, selon son niveau ; +50 % si elle est reliée à une
  // route). Un royaume qui a plus de Croyance qu'un voisin ennemi (pas un allié) prêche chez lui et convertit
  // lentement ses terres frontalières : d'abord les couloirs étroits et les pointes qui s'avancent dans son
  // propre territoire. C'est passif : pas un acte de guerre (ni alerte, ni après-guerre).
  // Croyance de chaque royaume (recalculée au plus une fois par seconde)
  faithAll() {
    if (this.faithCache && (this.faithVersion === this.version || this.tick - this.faithTick < CONFIG.TICKS_PER_SECOND)) {
      return this.faithCache;
    }
    this.faithVersion = this.version;
    this.faithTick = this.tick;
    const f = this.players.map(() => 0), links = this.roads();
    for (const a of this.buildingTiles) {
      const o = this.owner[a];
      if (this.building[a] !== B_CHURCH || o < 0) continue;
      const w = this.works.get(a);
      if (w && w.kind === 'build') continue; // (encore en chantier)
      // (+FAITH_ROAD_BONUS par chemin : une église reliée à deux villes a deux fois le bonus ; et selon son terrain :
      //  plus forte sur les hauteurs, moins en forêt, voir TERRAIN_PRODUCTION)
      f[o] += this.buildingInfo(a).faith * (1 + CONFIG.FAITH_ROAD_BONUS * this.churchLinks(o, a, links).length) * this.terrainFactor(a, B_CHURCH);
    }
    // Croisades en cours : +CRUSADE_FAITH chacune (tant que la cathédrale est au royaume)
    for (const c of this.crusades) if (this.tick < c.end && this.owner[c.church] === c.owner) f[c.owner] += CONFIG.CRUSADE_FAITH;
    this.faithCache = f;
    return f;
  },
  faithOf(pid) { return this.faithAll()[pid] || 0; },

  // --- ⚔️ Recrutement de masse (grande caserne, niveau 3) ---
  // Secondes qui restent au recrutement de masse du royaume p (0 = aucun en cours)
  levyLeft(p) { return Math.max(0, ((p.levyEnd || 0) - this.tick) / CONFIG.TICKS_PER_SECOND); },

  // Multiplicateur du recrutement (soldats et casernes) pendant un recrutement de masse : fort quand l'armée est
  // petite, il baisse un peu jusqu'à LEVY_FROM de l'armée maximum, puis vite, jusqu'à rien à LEVY_TO.
  // Son bonus est lui-même amplifié par la galvanisation et diminué par l'après-guerre (voir warFactor) : il avantage
  // le royaume qui se défend (galvanisé) bien plus que celui qui vient de gagner une bataille.
  levyFactor(p) {
    if (!p.levyEnd || this.tick >= p.levyEnd) return 1;
    const C = CONFIG, r = this.armySize(p) / Math.max(1, this.maxTroops(p));
    const k = r <= C.LEVY_FROM ? 1 - 0.2 * r / C.LEVY_FROM
      : 0.8 * Math.max(0, 1 - (r - C.LEVY_FROM) / (C.LEVY_TO - C.LEVY_FROM)) ** 2;
    return 1 + C.LEVY_BOOST * k * Math.max(0, this.warFactor(p));
  },

  // Pourquoi la caserne a ne peut pas lancer de recrutement de masse (null si elle le peut)
  levyError(p, a) {
    if (this.building[a] !== B_BARRACKS || this.owner[a] !== p.id) return tr('Ce n\'est pas une de tes casernes.', 'This is not one of your barracks.');
    if (this.level[a] < 3) return tr('Il faut une grande caserne (niveau 3) pour lancer un recrutement de masse.', 'You need great barracks (level 3) to start a mass recruitment.');
    if (this.levyLeft(p) > 0) return tr(`Un recrutement de masse est déjà en cours (encore ${Math.ceil(this.levyLeft(p))} s).`, `A mass recruitment is already under way (${Math.ceil(this.levyLeft(p))} s left).`);
    if (p.gold < CONFIG.LEVY_COST) return tr(`Pas assez d'or : il faut 💰 ${CONFIG.LEVY_COST}.`, `Not enough gold: you need 💰 ${CONFIG.LEVY_COST}.`);
    return null;
  },

  // Lancer un recrutement de masse : LEVY_COST pièces, recrutement accéléré pendant LEVY_TIME s. Renvoie une erreur, ou null.
  startLevy(p, a) {
    const err = this.levyError(p, a);
    if (err) return err;
    p.gold -= CONFIG.LEVY_COST;
    p.levyEnd = this.tick + CONFIG.LEVY_TIME * CONFIG.TICKS_PER_SECOND;
    const h = this.human;
    if (!p.isHuman && h && h.alive && this.neighborStats(p.id).has(h.id)) {
      UI.log(tr(`⚔️ ${p.name} lance un recrutement de masse : son armée se reforme bien plus vite pendant ${CONFIG.LEVY_TIME} s !`,
        `⚔️ ${p.name} starts a mass recruitment: their army rebuilds much faster for ${CONFIG.LEVY_TIME} s!`), 'warn', p);
    }
    return null;
  },

  // --- 🔥 Assaut viking (port royal, niveau 3) ---
  // On l'achète VIKING_COST pièces : il est alors prêt (un seul à la fois), et on le lance quand on veut sur une ville
  // (ou un port fortifié) ennemie de l'autre côté de la mer, à VIKING_RANGE cases au plus d'une de ses côtes.
  // Les bateaux traversent sans pertes, l'armée débarque sur la côte la plus proche de la cible et marche droit sur
  // elle, avec des soldats VIKING_BONUS plus forts. S'il échoue (ou s'il est rappelé), les survivants rentrent par bateau.
  royalPorts(pid) {
    return this.buildingTiles.filter(a => this.building[a] === B_PORT && this.owner[a] === pid && this.level[a] >= 3);
  },
  // Pourquoi p ne peut pas acheter d'assaut viking (null s'il le peut)
  vikingBuyError(p) {
    if (!this.royalPorts(p.id).length) return tr('Il faut un port royal (port de niveau 3) pour préparer un assaut viking.', 'You need a royal port (level 3 port) to prepare a Viking assault.');
    if (p.vikingReady) return tr('Ton assaut viking est déjà prêt : choisis sa cible !', 'Your Viking assault is already ready: choose its target!');
    if (p.gold < CONFIG.VIKING_COST) return tr(`Pas assez d'or : il faut 💰 ${CONFIG.VIKING_COST}.`, `Not enough gold: you need 💰 ${CONFIG.VIKING_COST}.`);
    return null;
  },
  buyViking(p) {
    const err = this.vikingBuyError(p);
    if (err) return err;
    p.gold -= CONFIG.VIKING_COST;
    p.vikingReady = true;
    return null;
  },
  // Chemin de l'assaut viking de pid de la côte où il débarque (landing) jusqu'à la cible c (null s'il n'y en a pas)
  vikingRoute(pid, c, landing) {
    const passable = this.castlePassable(c);
    if (!passable(landing)) return null;
    const foot = new Set(this.footprint(c, this.building[c]));
    return this.stopAtWalls(c, this.searchPath(pid, landing, foot, passable, this.owner[c], undefined, undefined, true));
  },
  // Les trajets en bateau depuis le port a : pour chaque case d'eau, la case d'où l'on vient (-1 : au port, -2 : jamais atteinte)
  boatField(a) {
    const prev = new Int32Array(this.N).fill(-2), queue = [];
    for (const j of this.footprint(a, B_PORT)) {
      this.forNeighbors(j, n => { if (this.navigable(n) && prev[n] === -2) { prev[n] = -1; queue.push(n); } });
    }
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      this.forNeighbors(c, n => { if (prev[n] === -2 && this.navigable(n)) { prev[n] = c; queue.push(n); } });
    }
    return prev;
  },
  // Préparer l'assaut viking de pid sur la cible en i : { castle, target, landing, route, port, path, time }, ou { error }
  planViking(pid, i) {
    const p = this.players[pid], W = this.W, R = CONFIG.VIKING_RANGE;
    if (!p.vikingReady) return { error: tr('Achète d\'abord un assaut viking (dans le menu de ton port royal).', 'First buy a Viking assault (in the menu of your royal port).') };
    const c = i >= 0 && this.building[i] ? this.anchor[i] : -1, o = c >= 0 ? this.owner[c] : -1;
    if (c < 0 || o < 0 || o === pid || !this.holdsAlone(c)) {
      return { error: tr('Un assaut viking vise une ville (un château) ou un port fortifié ennemi.', 'A Viking assault targets an enemy city (a castle) or fortified port.') };
    }
    const name = this.players[o].name;
    if (this.areAllied(pid, o)) return { error: tr(`${name} est ton allié !`, `${name} is your ally!`) };
    if (this.truceLeft(c) > 0) return { error: tr(`${this.targetLabel(c)[0].toUpperCase()}${this.targetLabel(c).slice(1)} vient de changer de mains : attends un peu.`, `${this.targetLabel(c)[0].toUpperCase()}${this.targetLabel(c).slice(1)} has just changed hands: wait a little.`) };
    const ports = this.expeditionPorts(pid);
    if (!ports.length) return { error: tr('Il te faut un port d\'où partir.', 'You need a port to sail from.') };
    // Les côtes de ce royaume à R cases au plus de la cible, de la plus proche à la plus lointaine
    const h = this.sizeOf(this.building[c]) / 2, cx = c % W + h, cy = ((c / W) | 0) + h, coasts = [];
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(this.H - 1, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), j = y * W + x;
        if (d <= R && this.owner[j] === o && !this.building[j] && !this.wallAt[j] && this.isCoastal(j)) coasts.push([d, j]);
      }
    }
    if (!coasts.length) return { error: tr(`Aucune côte ${this.deName(name)} à moins de ${R} cases de cette cible.`, `No coast of ${name} within ${R} tiles of this target.`) };
    coasts.sort((a, b) => a[0] - b[0]);
    const fields = ports.map(a => ({ a, prev: this.boatField(a), speed: this.buildingInfo(a).boatSpeed }));
    let tries = 0;
    for (const [, j] of coasts) {
      // le meilleur bateau pour cette côte (le plus rapide)
      let best = null;
      for (const f of fields) {
        let end = -1;
        this.forNeighbors(j, n => { if (end < 0 && this.navigable(n) && f.prev[n] !== -2) end = n; });
        if (end < 0) continue;
        const path = [];
        for (let k = end; k >= 0; k = f.prev[k]) path.push(k);
        path.reverse();
        const time = path.length / f.speed;
        if (!best || time < best.time) best = { port: f.a, path, time };
      }
      if (!best) continue;
      if (++tries > 15) break; // (on ne cherche pas indéfiniment un passage par la terre)
      const route = this.vikingRoute(pid, c, j);
      if (route) return { castle: c, target: o, landing: j, route, ...best };
    }
    return { error: tr('Aucun débarquement possible près de cette cible : pas de côte que tes bateaux peuvent rejoindre, ou des fortifications bloquent le chemin.',
      'No landing possible near this target: no coast your ships can reach, or fortifications block the way.') };
  },
  // Lancer l'assaut viking de pid sur la cible en i, avec troops soldats. Renvoie un message d'erreur, ou null.
  launchViking(pid, i, troops) {
    const plan = this.planViking(pid, i), p = this.players[pid];
    if (plan.error) return plan.error;
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < CONFIG.VIKING_MIN_TROOPS) return tr(`Il faut au moins ${CONFIG.VIKING_MIN_TROOPS} soldats pour un assaut viking.`, `You need at least ${CONFIG.VIKING_MIN_TROOPS} soldiers for a Viking assault.`);
    p.troops -= troops;
    p.vikingReady = false; // (l'assaut est utilisé : il faudra en racheter un)
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, viking: plan.castle, victim: plan.target, landing: plan.landing,
      path: plan.path, port: plan.port, cost: 0, sent: troops, troops, // (aucune perte en mer)
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(plan.time * TPS)) });
    const d = this.players[plan.target];
    if (d.isHuman) {
      UI.log(tr(`🔥 ${p.name} lance un assaut viking (${fmt(troops)} soldats) vers ${this.targetLabel(plan.castle)} ! Ses bateaux arrivent dans ${Math.ceil(plan.time)} s.`,
        `🔥 ${p.name} launches a Viking assault (${fmt(troops)} soldiers) at ${this.targetLabel(plan.castle)}! Their ships arrive in ${Math.ceil(plan.time)} s.`), 'warn', p);
    }
    return null;
  },
  // Les Vikings accostent : ils débarquent et marchent droit sur leur cible (un assaut, parti de la côte)
  vikingLands(e) {
    const p = this.players[e.pid], c = e.viking, o = this.owner[c], W = this.W;
    const ok = o >= 0 && o === e.victim && this.players[o].alive && !this.areAllied(e.pid, o) && this.holdsAlone(c) && this.owner[e.landing] === o;
    const route = ok ? this.vikingRoute(e.pid, c, e.landing) : null;
    if (!route) {
      this.sailHome(e.pid, e.landing, e.troops);
      if (p.isHuman) UI.log(tr('🔥 La cible de ton assaut viking n\'est plus possible : tes Vikings rentrent au port.', '🔥 The target of your Viking assault is no longer possible: your Vikings sail back to port.'), 'warn');
      return;
    }
    const L = e.landing, h = this.sizeOf(this.building[c]) / 2, at = { x: L % W + 0.5, y: ((L / W) | 0) + 0.5 };
    const a = {
      id: this.nextAttackId++, attacker: e.pid, target: o, troops: e.troops, done: false, startTick: this.tick,
      targetCastle: c, source: -1, defenders: 0, pending: [], frontTile: route[0],
      viking: L, // (la côte où l'armée a débarqué : c'est de là que repartiront les bateaux)
      startTile: L, marchFrom: at, fromX: at.x, fromY: at.y, toX: c % W + h, toY: ((c / W) | 0) + h,
    };
    a.list = [route[0]];
    a.set = new Set(a.list);
    a.pathTiles = route;
    a.limitZone = this.corridor(c, route);
    this.attacks.push(a);
    const d = this.players[o];
    if (p.isHuman) UI.log(tr(`🔥 Tes Vikings (${fmt(e.troops)} soldats) débarquent chez ${d.name} et marchent sur ${this.targetLabel(c)} !`,
      `🔥 Your Vikings (${fmt(e.troops)} soldiers) land in ${d.name}'s land and march on ${this.targetLabel(c)}!`), 'good', d);
    else if (d.isHuman) UI.log(tr(`🔥 Les Vikings ${this.deName(p.name)} (${fmt(e.troops)} soldats) ont débarqué ! Clique sur leur bannière pour envoyer tes défenseurs.`,
      `🔥 ${p.name}'s Vikings (${fmt(e.troops)} soldiers) have landed! Click their banner to send your defenders.`), 'warn', p);
  },
  // Des soldats rembarquent sur la côte `from` et rentrent au port le plus proche (ils rejoignent l'armée en arrivant)
  sailHome(pid, from, troops) {
    const best = this.homePort(pid, from), TPS = CONFIG.TICKS_PER_SECOND;
    if (!best || troops < 1) { this.players[pid].troops += Math.max(0, troops); return; }
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: from, home: best.port, path: best.path.slice().reverse(),
      sent: troops, troops, start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(best.time * TPS)) });
  },

  // Croisade religieuse en cours de la cathédrale a (ou null)
  crusadeOf(a) { return this.crusades.find(c => c.church === a && this.tick < c.end) || null; },

  // Pourquoi la cathédrale a ne peut pas lancer de croisade (null si elle le peut)
  crusadeError(p, a) {
    if (this.building[a] !== B_CHURCH || this.owner[a] !== p.id) return tr('Ce n\'est pas une de tes églises.', 'This is not one of your churches.');
    if (this.level[a] < 3) return tr('Il faut une cathédrale (église de niveau 3) pour lancer une croisade.', 'You need a cathedral (level 3 church) to start a crusade.');
    if (this.crusadeOf(a)) return tr('Une croisade est déjà en cours depuis cette cathédrale.', 'A crusade is already under way from this cathedral.');
    if (p.gold < CONFIG.CRUSADE_COST) return tr(`Pas assez d'or : il faut 💰 ${CONFIG.CRUSADE_COST}.`, `Not enough gold: you need 💰 ${CONFIG.CRUSADE_COST}.`);
    return null;
  },

  // Lancer une croisade religieuse : CRUSADE_COST pièces, +CRUSADE_FAITH de Croyance pendant CRUSADE_TIME s.
  // Renvoie un message d'erreur, ou null.
  startCrusade(p, a) {
    const err = this.crusadeError(p, a);
    if (err) return err;
    p.gold -= CONFIG.CRUSADE_COST;
    this.crusades = this.crusades.filter(c => this.tick < c.end);
    this.crusades.push({ church: a, owner: p.id, end: this.tick + CONFIG.CRUSADE_TIME * CONFIG.TICKS_PER_SECOND });
    this.faithCache = null; // (la Croyance change tout de suite)
    const h = this.human;
    if (!p.isHuman && h && h.alive && this.neighborStats(p.id).has(h.id)) {
      UI.log(tr(`✝️ ${p.name} lance une croisade religieuse : sa Croyance monte de ${CONFIG.CRUSADE_FAITH} pendant ${CONFIG.CRUSADE_TIME} s !`,
        `✝️ ${p.name} starts a crusade: their Faith rises by ${CONFIG.CRUSADE_FAITH} for ${CONFIG.CRUSADE_TIME} s!`), 'warn', p);
    }
    return null;
  },

  // Écart de Croyance avec lequel pid convertit les terres de o (0 s'il ne les convertit pas) : il faut être
  // voisins, ne pas être alliés, et que pid ait une ville (un royaume désorganisé ne prêche pas)
  faithEdge(pid, o) {
    const P = this.players[pid], O = this.players[o];
    if (pid === o || !P.alive || !O.alive || this.areAllied(pid, o) || !this.isProtected(pid)) return 0;
    if (!this.neighborStats(pid).has(o)) return 0;
    return Math.max(0, this.faithOf(pid) - this.faithOf(o));
  },

  // Secondes pour convertir une case avec cet écart de Croyance (voir FAITH_PACE)
  faithInterval(diff) {
    const pace = CONFIG.FAITH_PACE;
    if (diff <= 0) return Infinity;
    if (diff <= pace[0][0]) return pace[0][1] * pace[0][0] / diff;
    for (let k = 1; k < pace.length; k++) {
      const [d1, s1] = pace[k - 1], [d2, s2] = pace[k];
      if (diff <= d2) return s1 + (s2 - s1) * (diff - d1) / (d2 - d1);
    }
    return pace[pace.length - 1][1];
  },

  // Chaque seconde : chaque royaume avance sa conversion de chaque voisin ; quand elle est complète, une case
  // est convertie (voir preach)
  stepFaith() {
    if (this.tick % CONFIG.TICKS_PER_SECOND !== 0) return;
    // Croisades terminées
    for (const c of this.crusades) {
      if (this.tick < c.end) continue;
      c.over = true;
      this.faithCache = null;
      if (this.players[c.owner].isHuman) UI.log(tr('✝️ Ta croisade religieuse est terminée : ta Croyance redescend.', '✝️ Your crusade is over: your Faith goes back down.'));
    }
    this.crusades = this.crusades.filter(c => !c.over);
    // Chaque paire (prêcheur, converti) avance ; une conversion complète = une case. Avec un grand écart,
    // il y en a plusieurs par seconde : preach les prend toutes d'un coup (les meilleures)
    const due = new Map(); // royaume converti → (prêcheur → cases à lui prendre cette seconde)
    for (const p of this.players) {
      if (!p.alive || this.faithOf(p.id) <= 0) continue;
      for (const o of this.neighborStats(p.id).keys()) {
        if (o < 0) continue;
        const diff = this.faithEdge(p.id, o), key = p.id * 1000 + o;
        if (diff <= 0) { this.faithProgress.delete(key); continue; }
        // (un royaume désorganisé, sans ville ni port fortifié pour tenir ses terres, se fait convertir plus vite)
        // (FAITH_SPEED : réglage général de la vitesse de conversion)
        const mult = (this.isProtected(o) ? 1 : CONFIG.FAITH_DISORGANIZED) * CONFIG.FAITH_SPEED;
        const prog = (this.faithProgress.get(key) || 0) + mult / this.faithInterval(diff), n = Math.floor(prog);
        this.faithProgress.set(key, prog - n);
        if (n <= 0) continue;
        if (!due.has(o)) due.set(o, new Map());
        due.get(o).set(p.id, n);
      }
    }
    if (due.size) this.preach(due);
  },

  // Pour chaque paire (prêcheur, converti) de due, convertit le nombre de cases demandé : des cases du converti
  // collées à une terre du prêcheur, de préférence dans un couloir étroit ou une pointe entourée par le prêcheur
  // (on garde les meilleures en un seul passage sur la carte).
  preach(due) {
    const W = this.W, H = this.H, N = this.N, own = this.owner, r = this.regions();
    const routes = new Set(this.pendingRoutes().map(([t]) => t)); // (routes d'assauts en cours : on n'y touche pas)
    const sites = new Set();
    for (const w of this.walls) if (!w.done) for (const t of w.tiles) sites.add(t);
    // On ne prêche que depuis une zone de royaume : pas une zone d'avant-poste, pas un morceau coupé de ses villes
    const from = (j, pid) => {
      const k = r.comp[j];
      return k >= 0 && r.owner[k] === pid && !routes.has(j) && (!r.anyOutpost[k] || r.hasCastle[k])
        && ((r.heart[k] && !this.pieceUnlinked(r, k)) || r.colony[k]);
    };
    const best = new Map(); // prêcheur * 1000 + converti → les meilleures cases [{ t, score, pid, o }], la meilleure d'abord
    // Ce qui attire la Croyance chez chaque converti : ses églises et ses petits ports (le centre de chacun)
    const lures = new Map();
    for (const a of this.buildingTiles) {
      const b = this.building[a], o = own[a];
      if ((b !== B_CHURCH && b !== B_PORT) || o < 0 || !due.has(o) || this.holdsAlone(a)) continue;
      const h = this.sizeOf(b) / 2;
      (lures.get(o) || lures.set(o, []).get(o)).push([a % W + h, ((a / W) | 0) + h]);
    }
    const R = CONFIG.FAITH_LURE_RANGE;
    for (let i = 0; i < N; i++) {
      const o = own[i];
      if (o < 0 || !due.has(o)) continue;
      const preachers = due.get(o), x = i % W;
      let pid = -1;
      if (x > 0 && preachers.has(own[i - 1]) && from(i - 1, own[i - 1])) pid = own[i - 1];
      else if (x < W - 1 && preachers.has(own[i + 1]) && from(i + 1, own[i + 1])) pid = own[i + 1];
      else if (i >= W && preachers.has(own[i - W]) && from(i - W, own[i - W])) pid = own[i - W];
      else if (i < N - W && preachers.has(own[i + W]) && from(i + W, own[i + W])) pid = own[i + W];
      if (pid < 0) continue;
      // Couloir étroit ou pointe : beaucoup de cases du prêcheur autour, peu de cases du converti à côté
      const y = (i / W) | 0;
      let mine = 0, theirs = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = own[yy * W + xx];
        if (q === pid) mine++;
        else if (q === o && (!dx || !dy)) theirs++;
      }
      // La foi gagne les villages : elle avance en pointe vers l'église ou le port le plus proche (s'il n'est pas
      // trop loin), et son front ondule doucement (deux vagues, différentes pour chaque prêcheur) : des courbes,
      // pas des lignes droites.
      let lure = 0;
      for (const [lx, ly] of lures.get(o) || []) {
        const d = Math.hypot(lx - x, ly - y);
        if (d < R) lure = Math.max(lure, 1 - d / R);
      }
      const wave = Math.sin(x * 0.19 + Math.sin(y * 0.11 + pid) * 2.5) + Math.sin(y * 0.17 + Math.sin(x * 0.13 + pid * 2) * 2.5);
      const score = mine + (4 - theirs) * 2 + lure * CONFIG.FAITH_LURE + wave * CONFIG.FAITH_WAVE / 2 + Math.random();
      const key = pid * 1000 + o, n = preachers.get(pid);
      let list = best.get(key);
      if (list && list.length >= n && list[list.length - 1].score >= score) continue;
      if (!this.faithConvertible(i, o, routes, sites)) continue;
      if (!list) best.set(key, list = []);
      let k = list.length;
      while (k > 0 && list[k - 1].score < score) k--;
      list.splice(k, 0, { t: i, score, pid, o });
      if (list.length > n) list.pop();
    }
    for (const { t, pid, o } of [...best.values()].flat()) {
      if (this.owner[t] !== o || !this.players[o].alive) continue;
      // (une église ou un port converti emmène les moulins et casernes qui occupent ses places)
      const host = this.building[t] && this.hasSlots(this.anchor[t]) ? this.anchor[t] : -1;
      const linked = host >= 0 ? this.linkedBuildings(host) : [];
      this.setOwner(t, pid);
      for (const b of linked) if (this.owner[b] === o) this.setOwner(b, pid);
      // la conversion peut couper son royaume : la coupe s'applique tout de suite (voir captureEnclaves)
      if (this.players[o].alive && this.countNeighborsOwnedBy(t, o) >= 2) this.captureEnclaves(o, pid);
    }
  },

  // La Croyance peut-elle convertir cette case du royaume o ? Jamais une ville ni un port fortifié (ils tiennent
  // leur région seuls), ni ce qui est dans leur muraille ; ni un avant-poste et sa zone, ni un mur, ni la route
  // d'un assaut en cours ; ni un moulin ou une caserne (ils suivent la ville, l'église ou le port dont ils occupent
  // la place). Les autres bâtiments (église, petit port, mine) passent avec leur case, l'église et le port avec
  // leurs moulins et casernes.
  faithConvertible(i, o, routes, sites) {
    if (!this.claimable(i) || this.wallAt[i] || sites.has(i) || routes.has(i)) return false;
    if (this.building[i]) {
      const a = this.anchor[i];
      if (this.holdsAlone(a) || this.building[a] === B_OUTPOST || this.building[a] === B_MILL || this.building[a] === B_BARRACKS) return false;
      // (un bâtiment de plusieurs cases : toutes doivent pouvoir passer)
      if (this.footprint(a, this.building[a]).some(j => this.castleBonus(o, j) > 0 || this.portBonus(o, j) > 0 || this.outpostBonus(o, j) > 0)) return false;
    }
    return !(this.castleBonus(o, i) > 0 || this.portBonus(o, i) > 0 || this.outpostBonus(o, i) > 0);
  },

  // --- Murs ---
  // Une ville de niveau 2 peut bâtir un mur (et une citadelle, un second) : une muraille en ligne droite, de sa
  // muraille jusqu'à l'endroit choisi (pas trop loin), pour fermer un passage. Aucun assaut ne peut la franchir.
  // Nombre de murs qu'une ville peut avoir (selon son niveau), et ceux qu'elle a déjà (finis ou en chantier)
  wallMax(c) { return this.building[c] === B_CASTLE ? Math.max(0, (this.level[c] || 1) - 1) : 0; },
  wallsOf(c) { return this.walls.filter(w => w.castle === c); },
  // Prix du prochain mur de la ville c (le 1er, puis le 2e)
  wallCost(c) {
    const base = CONFIG.WALL_COSTS[Math.min(CONFIG.WALL_COSTS.length - 1, this.wallsOf(c).length)];
    return Math.round(base * (1 - this.mineBonus(this.owner[c], 'stone'))); // (🪨 moins cher avec des carrières)
  },

  // Case infranchissable pour un assaut, où un mur peut s'accrocher : mer, lac, fleuve, sommet, ou un autre mur
  wallBarrier(i) {
    return !this.isLand(i) || this.terrain[i] === TERRAIN.RIVER || this.wallAt[i] === 1
      || this.walls.some(w => !w.done && w.tiles.includes(i));
  },

  // « Aimant » : visé près d'un obstacle (à moins de WALL_SNAP cases), le mur va jusqu'à lui, pour qu'il ne
  // reste pas de trou entre les deux. Renvoie la case d'obstacle la plus proche de la case visée, ou -1.
  wallSnap(target) {
    const W = this.W, x0 = target % W, y0 = (target / W) | 0, S = CONFIG.WALL_SNAP;
    if (this.wallBarrier(target)) return target;
    let best = -1, bestD = Infinity;
    for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
      const x = x0 + dx, y = y0 + dy, d = dx * dx + dy * dy;
      if (x < 0 || y < 0 || x >= W || y >= this.H || d > S * S || d >= bestD) continue;
      if (this.wallBarrier(y * W + x)) { best = y * W + x; bestD = d; }
    }
    return best;
  },

  // Le mur que la ville c bâtirait jusqu'à la case visée : { tiles, end, sealed } ou { error }.
  // Il part de la muraille de la ville et va tout droit jusqu'à la case visée (ou jusqu'à l'obstacle tout proche :
  // voir wallSnap, sealed = il s'y accroche) ; il ne passe que sur les terres du royaume (là où il croise un
  // obstacle infranchissable, il n'y a pas besoin de mur : il le laisse).
  // from = une case d'un mur déjà bâti de la ville (pour le second mur) : il part de là, au lieu de la muraille,
  // et va au plus à WALL_MAX_REACH cases de ce point.
  planWall(pid, c, target, from = -1) {
    if (this.building[c] !== B_CASTLE || this.owner[c] !== pid) return { error: tr('Ce n\'est pas une de tes villes.', 'This is not one of your cities.') };
    if (this.wallsOf(c).length >= this.wallMax(c)) {
      return { error: this.level[c] < 2 ? tr('Il faut une ville de niveau 2 pour bâtir un mur.', 'You need a level 2 city to build a wall.')
        : this.level[c] < 3 ? tr('Cette ville a déjà son mur (une citadelle peut en bâtir un second).', 'This city already has its wall (a citadel can build a second one).')
        : this.level[c] < 4 ? tr('Cette ville a déjà ses deux murs (une cité impériale peut en bâtir un troisième).', 'This city already has its two walls (an imperial city can build a third one).')
        : tr(`Cette ville a déjà ses ${this.wallMax(c)} murs.`, `This city already has its ${this.wallMax(c)} walls.`) };
    }
    const W = this.W, h = this.sizeOf(B_CASTLE) / 2, cx = c % W + h, cy = ((c / W) | 0) + h;
    // Visé dans (ou tout près de) la muraille d'une autre de ses villes : le mur va jusqu'à elle, et les relie
    // (city = cette ville : voir garrisonMax)
    let city = -1, Rcity = 0;
    for (const o of this.castles) {
      if (o === c || this.owner[o] !== pid) continue;
      const ox = o % W + h, oy = ((o / W) | 0) + h, Ro = this.castleInfo(o).radius;
      if (Math.hypot(target % W + 0.5 - ox, ((target / W) | 0) + 0.5 - oy) <= Ro + CONFIG.WALL_SNAP) {
        city = o; Rcity = Ro;
        target = Math.floor(oy) * W + Math.floor(ox); // (on vise son centre ; le mur s'arrête à sa muraille)
        break;
      }
    }
    // Sinon, l'aimant : un obstacle tout proche (voir wallSnap)
    const snap = city >= 0 ? -1 : this.wallSnap(target), sealed = city >= 0 || snap >= 0;
    if (snap >= 0) target = snap;
    const tx = target % W + 0.5, ty = ((target / W) | 0) + 0.5, R = this.castleInfo(c).radius;
    let sx, sy;
    if (from >= 0) {
      // Second mur, depuis un point du premier (déjà bâti)
      if (!this.walls.some(w => w.castle === c && w.done && w.tiles.includes(from))) {
        return { error: tr('Le mur doit partir de la muraille de la ville, ou d\'un point de son premier mur déjà bâti.', 'The wall must start from the city walls, or from a point of its first wall already built.') };
      }
      sx = from % W; sy = (from / W) | 0;
      const reach = Math.hypot(tx - sx - 0.5, ty - sy - 0.5) - Rcity;
      if (reach < 2) return { error: tr('Vise un endroit plus loin de ton mur.', 'Aim at a spot further from your wall.') };
      if (reach > CONFIG.WALL_MAX_REACH + (sealed ? CONFIG.WALL_SNAP : 0)) return { error: tr(`Trop loin : un mur va au plus à ${CONFIG.WALL_MAX_REACH} cases de son point de départ.`, `Too far: a wall reaches at most ${CONFIG.WALL_MAX_REACH} tiles from its starting point.`) };
    } else {
      const dist = Math.hypot(tx - cx, ty - cy), reach = dist - Rcity; // (jusqu'à la muraille de l'autre ville)
      if (reach < R + 2) return { error: city >= 0 ? tr('Ces deux villes se touchent déjà : pas besoin de mur entre elles.', 'These two cities already touch: no need for a wall between them.') : tr('Vise un endroit hors de la muraille de la ville.', 'Aim at a spot outside the city walls.') };
      if (reach > R + CONFIG.WALL_MAX_REACH + (sealed ? CONFIG.WALL_SNAP : 0)) return { error: tr(`Trop loin : un mur va au plus à ${CONFIG.WALL_MAX_REACH} cases de la muraille de la ville.`, `Too far: a wall reaches at most ${CONFIG.WALL_MAX_REACH} tiles from the city walls.`) };
      // le mur part du bord de la muraille de la ville, vers la case visée (tracé case par case, sans trou)
      sx = Math.floor(cx + (tx - cx) / dist * (R - 0.5)); sy = Math.floor(cy + (ty - cy) / dist * (R - 0.5));
    }
    const tiles = [], ex = target % W, ey = (target / W) | 0;
    let x = sx, y = sy;
    const dx = Math.abs(ex - x), dy = -Math.abs(ey - y), stx = x < ex ? 1 : -1, sty = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      const i = y * W + x;
      if (city >= 0 && this.inCastleRange(city, x, y, Rcity)) break; // (arrivé à la muraille de l'autre ville)
      // (les cases dans la muraille de la ville sont la ville elle-même : le mur commence juste après)
      if (!this.wallBarrier(i) && !this.inCastleRange(c, x, y, R)) {
        if (this.owner[i] !== pid) return { error: tr('Le mur doit être entièrement sur tes terres.', 'The wall must be entirely on your land.') };
        if (this.building[i]) return { error: tr('Un bâtiment est sur le chemin du mur.', 'A building is in the way of the wall.') };
        tiles.push(i);
      }
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += stx; }
      if (e2 <= dx) { err += dx; y += sty; }
    }
    if (tiles.length < 2) return { error: city >= 0 ? tr('Ces deux villes sont trop proches : pas besoin de mur entre elles.', 'These two cities are too close: no need for a wall between them.') : tr('Le mur est trop court.', 'The wall is too short.') };
    return { tiles, end: city >= 0 ? tiles[tiles.length - 1] : target, sealed, city };
  },

  // Bâtir un mur de la ville c jusqu'à la case visée (depuis la case from d'un de ses murs, si elle est donnée).
  // Renvoie un message d'erreur, ou null.
  buildWall(p, c, target, from = -1) {
    const plan = this.planWall(p.id, c, target, from);
    if (plan.error) return plan.error;
    const cost = this.wallCost(c);
    if (p.gold < cost) return tr(`Pas assez d'or (${cost} nécessaires).`, `Not enough gold (${cost} needed).`);
    p.gold -= cost;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.walls.push({ castle: c, owner: p.id, tiles: plan.tiles, city: plan.city, start: this.tick, ready: this.tick + CONFIG.WALL_BUILD_TIME * TPS, done: false });
    return null;
  },

  // Retire un mur (sa ville est prise ou détruite, ou une de ses cases a changé de mains)
  removeWall(w) {
    for (const t of w.tiles) if (w.done) { this.wallAt[t] = 0; Render.markDirty(t); }
    this.walls = this.walls.filter(x => x !== w);
    for (const x of this.walls) if (x.touch) x.touch.delete(w); // (il ne relie plus rien)
    this.version++;
  },

  // Chaque tour : les murs dont le chantier se termine se dressent. Un assaut dont la route encore devant lui
  // (pas la partie déjà passée) est coupée par ce mur tout neuf le contourne ; s'il n'a pas d'autre chemin, il
  // rebrousse chemin (assaut annulé). Un mur dont la ville n'est plus au royaume disparaît.
  stepWalls() {
    for (const w of this.walls.slice()) {
      if (this.building[w.castle] !== B_CASTLE || this.owner[w.castle] !== w.owner) { this.removeWall(w); continue; }
      if (w.done || this.tick < w.ready) continue;
      const before = this.wallLinked(w.castle).size;
      w.done = true;
      for (const t of w.tiles) { this.wallAt[t] = 1; Render.markDirty(t); }
      this.version++;
      // les murs finis du royaume qu'il touche (deux murs qui se rejoignent relient leurs villes : voir wallLinked)
      w.touch = new Set();
      for (const v of this.walls) {
        if (v === w || !v.done || v.owner !== w.owner || !this.wallsTouch(w, v)) continue;
        w.touch.add(v);
        (v.touch = v.touch || new Set()).add(w);
      }
      const o = this.players[w.owner];
      if (o.isHuman) {
        UI.log(tr('🧱 Ton mur est bâti : aucun assaut ne peut plus le franchir.', '🧱 Your wall is built: no assault can cross it any more.') + (this.wallLinked(w.castle).size > before
          ? tr(` Il relie tes villes : +${CONFIG.WALL_LINK_GARRISON} soldats de garnison pour chacune !`, ` It links your cities: +${CONFIG.WALL_LINK_GARRISON} garrison soldiers for each!`) : ''), 'good');
      }
      const mine = new Set(w.tiles);
      for (const a of this.attacks) {
        if (a.done || a.target !== w.owner || a.retreatEnd !== undefined || a.castleTaken) continue;
        const route = a.pathTiles || a.path;
        if (!route || !route.slice(this.pathPassed(a)).some(t => mine.has(t))) continue;
        const p = this.players[a.attacker];
        if (this.rerouteAssault(a)) {
          if (p.isHuman) UI.log(tr(`🧱 Un mur ${this.deName(o.name)} barre la route de ton armée : elle le contourne.`, `🧱 A wall of ${o.name} blocks your army's route: it goes around it.`), 'warn', o);
          else if (o.isHuman) UI.log(tr(`🧱 Ton mur barre la route de l'armée ${this.deName(p.name)} : elle doit faire le tour !`, `🧱 Your wall blocks ${p.name}'s army: it has to go around!`), 'good', p);
          continue;
        }
        if (p.isHuman) UI.log(tr(`🧱 Un mur ${this.deName(o.name)} ferme le seul passage de ton armée : elle rebrousse chemin.`, `🧱 A wall of ${o.name} closes your army's only way through: it turns back.`), 'warn', o);
        else if (o.isHuman) UI.log(tr(`🧱 Ton mur ferme le seul passage de l'armée ${this.deName(p.name)} : elle rebrousse chemin !`, `🧱 Your wall closes ${p.name}'s army's only way through: it turns back!`), 'good', p);
        this.wallRetreatLoss(a);
        this.endAttack(a);
      }
    }
  },

  // Jusqu'où l'assaut a est passé sur son chemin : les cases de route d'index < à ce nombre sont derrière lui
  // (0 tant qu'il marche encore sur ses terres)
  pathPassed(a) {
    const route = a.pathTiles || a.path;
    if (!route || this.isPreparing(a)) return 0;
    for (let j = route.length - 1; j >= 0; j--) if (this.owner[route[j]] === a.attacker) return j + 1;
    return 0;
  },

  // Un mur barre la route de l'assaut a : il cherche un autre chemin depuis là où il se bat (ou, s'il marche
  // encore sur ses terres, depuis toute sa frontière). Renvoie false s'il n'y en a pas.
  rerouteAssault(a) {
    if (a.link !== undefined && a.link >= 0) {
      // assaut de jonction : nouveau chemin vers son bâtiment isolé
      const route = this.linkRoute(a.attacker, a.link, a.target);
      if (!route) return false;
      a.path = route.path;
      a.piece = route.piece;
      a.limitZone = this.corridor(a.link, route.path, route.passable);
    } else {
      const c = a.targetCastle;
      if (c < 0 || this.owner[c] !== a.target) return false;
      const src = this.sourceOfAttack(a);
      let path;
      if (this.isPreparing(a)) path = this.castlePath(a.attacker, c, src);
      else {
        // on repart du front : la case ennemie, collée à nos terres, la plus proche de la suite de l'ancien chemin
        const passable = this.castlePassable(c), old = a.pathTiles, next = old[Math.min(old.length - 1, this.pathPassed(a))];
        const nx = next % this.W, ny = (next / this.W) | 0;
        let from = -1, best = Infinity;
        for (const t of [a.frontTile, ...a.list]) {
          if (t < 0 || !passable(t) || !this.countFriendNeighbors(t, a.attacker)) continue;
          const d = (t % this.W - nx) ** 2 + (((t / this.W) | 0) - ny) ** 2;
          if (d < best) { best = d; from = t; }
        }
        if (from < 0) return false;
        path = this.searchPath(a.attacker, from, new Set(this.footprint(c, this.building[c])), passable, a.target, src, undefined, true);
        if (path && this.building[c] === B_CASTLE) {
          const k = path.findIndex(i => this.inWalls(c, i));
          if (k >= 0) path.length = k + 1;
        }
        if (path) path = old.slice(0, this.pathPassed(a)).concat(path);
      }
      if (!path) return false;
      a.pathTiles = path;
      a.limitZone = this.corridor(c, path);
    }
    const route = a.pathTiles || a.path, start = route[this.pathPassed(a)];
    if (start !== undefined) {
      a.frontTile = start;
      if (!a.set.has(start)) { a.set.add(start); a.list.push(start); }
    }
    return true;
  },

  // Cas rare : un mur a été bâti dans le dos d'un assaut (sur le chemin déjà parcouru). Pour rentrer, l'armée le
  // franchit quand même, mais y perd WALL_RETREAT_LOSS de ses soldats, à chaque mur.
  wallRetreatLoss(a) {
    const route = a.pathTiles || a.path;
    if (!route || !this.walls.length) return;
    const behind = new Set(route.slice(0, this.pathPassed(a)));
    const n = this.walls.filter(w => w.done && w.owner === a.target && w.tiles.some(t => behind.has(t))).length;
    if (!n) return;
    const keep = Math.pow(1 - CONFIG.WALL_RETREAT_LOSS, n);
    a.troops *= keep;
    for (const r of a.pending) r.troops *= keep;
    if (this.players[a.attacker].isHuman) {
      UI.log(tr(`🧱 Pour rentrer, ton armée doit franchir ${n > 1 ? n + ' murs' : 'un mur'} : elle y perd ${Math.round((1 - keep) * 100)} % de ses soldats.`,
        `🧱 To get home, your army must cross ${n > 1 ? n + ' walls' : 'a wall'}: it loses ${Math.round((1 - keep) * 100)}% of its soldiers.`), 'warn');
    }
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
        if (p.isHuman) UI.log(tr('🏚️ Ton bâtiment a été pris pendant les travaux : ils sont perdus.', '🏚️ Your building was taken during the works: they are lost.'), 'warn');
        continue;
      }
      if (this.tick < w.end) continue;
      this.works.delete(a);
      const type = this.building[a], icon = BUILDINGS[type].icon;
      if (w.kind === 'build') continue; // chantier fini : le bâtiment fonctionne
      if (w.kind === 'up') {
        if (BUILDING_LEVELS[type][this.level[a] + 1]) this.level[a]++; // (jamais au-delà du niveau maximum)
        this.version++;
        // (🪙 une mine d'or améliorée : son filon repart pour MINES.gold.time de plus)
        const dep = type === B_MINE ? this.depositAt.get(a) : null;
        if (dep && dep.kind === 'gold') dep.left += MINES.gold.time * CONFIG.TICKS_PER_SECOND;
        if (type === B_CASTLE && this.castleInfo(a).imperial) {
          p.imperialBuilt = true; // (une seule par partie)
          this.garrison[a] = this.garrisonMax(a);
          if (p.isHuman) UI.log(tr('👑 Ta cité impériale est bâtie : murs immenses, garnison de 300, troupes plus fortes, routes de pierre !', '👑 Your imperial city is built: huge walls, a garrison of 300, stronger troops, stone roads!'), 'good');
          else UI.log(tr(`👑 ${p.name} a bâti sa cité impériale !`, `👑 ${p.name} has built their imperial city!`), 'warn', p);
        } else if (p.isHuman) UI.log(tr(`${icon} Amélioration terminée : ${this.buildingInfo(a).name} !`, `${icon} Upgrade complete: ${this.buildingInfo(a).name}!`), 'good');
      } else {
        // Les soldats de la garnison rejoignent l'armée
        p.troops += this.garrison[a] || 0;
        // Une ville, une église ou un port détruit : les moulins et casernes bâtis grâce à lui (dans sa muraille
        // ou à une de ses places) sautent aussi, sauf si une autre ville, église ou port les accueille
        const linked = this.linkedBuildings(a);
        this.removeBuilding(a);
        const lost = linked.filter(b => !this.stillHosted(b));
        for (const b of lost) this.removeBuilding(b);
        if (p.isHuman) UI.log(tr(`🧨 ${BUILDINGS[type].name} détruit`, `🧨 ${BUILDINGS[type].name} destroyed`) +
          (lost.length ? tr(`, et ${lost.length > 1 ? `les ${lost.length} moulins ou casernes qui en dépendaient` : 'le moulin ou la caserne qui en dépendait'}.`,
            `, along with ${lost.length > 1 ? `the ${lost.length} mills or barracks that depended on it` : 'the mill or barracks that depended on it'}.`) : '.'), 'good');
      }
    }
  },

  // Villes du même royaume reliées à la ville c par un mur fini (son mur vers elle, ou le leur vers c)
  // Un mur relie deux villes s'il va de l'une à la muraille de l'autre (w.city), ou si deux murs, chacun parti
  // de sa ville, se rejoignent (w.touch : les murs finis du royaume qui le touchent). On suit donc la chaîne des
  // murs qui se touchent, depuis ceux de la ville c.
  wallLinked(c) {
    const o = this.owner[c], set = new Set();
    const ok = w => w.done && w.owner === o && this.owner[w.castle] === o && this.building[w.castle] === B_CASTLE;
    const isCity = v => v !== undefined && v >= 0 && this.building[v] === B_CASTLE && this.owner[v] === o;
    const queue = this.walls.filter(w => ok(w) && (w.castle === c || w.city === c)), seen = new Set(queue);
    while (queue.length) {
      const w = queue.pop();
      if (isCity(w.castle)) set.add(w.castle);
      if (isCity(w.city)) set.add(w.city);
      for (const v of w.touch || []) if (!seen.has(v) && ok(v)) { seen.add(v); queue.push(v); }
    }
    set.delete(c);
    return set;
  },

  // Deux murs se touchent-ils (une case de l'un collée à une case de l'autre, même en diagonale) ?
  wallsTouch(a, b) {
    const W = this.W, other = new Set(b.tiles);
    for (const t of a.tiles) {
      const x = t % W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && x + dx < W && other.has(t + dy * W + dx)) return true;
      }
    }
    return false;
  },

  // Moulins et casernes qui dépendent du bâtiment a : dans la muraille d'une ville, ou à une place d'une église
  // (ou d'un port)
  linkedBuildings(a) {
    const type = this.building[a], o = this.owner[a];
    if (type === B_CASTLE) {
      return this.buildingTiles.filter(b => (this.building[b] === B_MILL || this.building[b] === B_BARRACKS)
        && this.owner[b] === o && this.footprint(b, this.building[b]).some(j => this.inWalls(a, j)));
    }
    if (type === B_CHURCH || type === B_PORT) {
      const hosts = this.slotHosts();
      return this.buildingTiles.filter(b => hosts.get(b) === a);
    }
    return [];
  },

  // Ce moulin (ou cette caserne) est-il encore accueilli : dans la muraille d'une ville, ou près d'une église
  // (ou d'un port) du royaume ?
  stillHosted(b) {
    const o = this.owner[b], cells = this.footprint(b, this.building[b]);
    return cells.every(j => this.castleProtects(o, j)) || this.slotHosts().has(b);
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
          UI.log(tr(`⛺ Ton avant-poste est bâti : ${fmt(keep)} soldats y restent en garnison, ${fmt(o.stationed)} stationnent ` +
            'et peuvent attaquer depuis lui (curseur « Envoyer »).',
            `⛺ Your outpost is built: ${fmt(keep)} soldiers stay there as a garrison, ${fmt(o.stationed)} are stationed ` +
            'and can attack from it ("Send" slider).'), 'good');
        }
      }
    }
    if (this.tick % CONFIG.TICKS_PER_SECOND) return;
    const r = this.regions();
    for (const [a, o] of this.outposts) {
      const pid = this.owner[a], k = r.comp[a];
      // Relié par la terre au royaume : ses soldats stationnés rejoignent l'armée du royaume
      if (r.heart[k] && r.hasCastle[k] && o.stationed > 0) { this.players[pid].troops += o.stationed; o.stationed = 0; }
      const castle = this.castles.find(c => this.owner[c] === pid && r.comp[c] === k);
      if (castle === undefined) continue;
      const p = this.players[pid];
      p.troops += this.garrison[a] + o.stationed;
      this.colonies.set(castle, pid);
      this.regionsCache = null;
      this.removeBuilding(a);
      if (p.isHuman) UI.log(tr('🏰 Ton château fait de l\'avant-poste une vraie terre du royaume : ses soldats rejoignent ton armée.', '🏰 Your castle turns the outpost into true kingdom land: its soldiers join your army.'), 'good');
      return; // la carte a changé : on regardera les autres au prochain tour
    }
  },

  // Envoie des renforts par la mer à son avant-poste a (depuis un port d'expédition). Message d'erreur, ou null.
  reinforceOutpost(pid, a, troops) {
    const p = this.players[pid], o = this.outposts.get(a);
    if (!o || this.owner[a] !== pid) return tr('Ce n\'est pas un de tes avant-postes.', 'This is not one of your outposts.');
    let best = null;
    for (const port of this.expeditionPorts(pid)) {
      const path = this.boatPath(port, o.landing);
      if (!path) continue;
      const time = path.length / this.buildingInfo(port).boatSpeed;
      if (!best || time < best.time) best = { path, time, port };
    }
    if (!best) return tr('Aucun de tes ports d\'expédition (niveau 2 ou plus) ne peut rejoindre cet avant-poste.', 'None of your expedition ports (level 2 or higher) can reach this outpost.');
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return tr('Pas assez de soldats !', 'Not enough soldiers!');
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
    // Les bouts de terre de départ qui ne touchent pas la capitale (de l'autre côté d'un fleuve ou d'une crique)
    // redeviennent libres : sinon, ils seraient tout de suite « coupés de tous ses châteaux »
    const seen = new Set([p.capital]), todo = [p.capital];
    while (todo.length) {
      const i = todo.pop(), x = i % this.W;
      for (const j of [i - this.W, i + this.W, x > 0 ? i - 1 : -1, x < this.W - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < this.N && !seen.has(j) && this.owner[j] === p.id) { seen.add(j); todo.push(j); }
      }
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy, i = y * this.W + x;
        if (x >= 0 && y >= 0 && x < this.W && y < this.H && this.owner[i] === p.id && !seen.has(i)) this.setOwner(i, -1);
      }
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
    if (!this.isLand(i) || this.terrain[i] === TERRAIN.RIVER) return tr('Choisis une terre, pas l\'eau !', 'Pick land, not water!');
    if (this.owner[i] >= 0) return tr(`Cette terre appartient déjà à ${this.players[this.owner[i]].name}.`, `This land already belongs to ${this.players[this.owner[i]].name}.`);
    if (this.landSize()[i] < CONFIG.MIN_SPAWN_LAND) return tr('Cette île est trop petite pour y fonder ta capitale.', 'This island is too small to found your capital on.');
    if (!this.canSpawnAt(i, CONFIG.MIN_SPAWN_DISTANCE)) return tr('Trop près d\'un royaume rival : éloigne-toi un peu.', 'Too close to a rival kingdom: move a little further away.');
    return null;
  },

  // Mode « Factions » : les 11 autres races des 3 camps, les 3 pactes éternels, et chaque royaume à sa capitale
  // (AZEROTH_CAPITALS). Le joueur ne choisit pas où il commence : la partie démarre en pause, le temps de se repérer.
  startFactions(opts) {
    const race = p => BANNERS[p.banner].id; // (le nom fixe de la race, en français : voir AZEROTH_BANNERS)
    for (const f of AZEROTH_FACTIONS) {
      for (const r of f.races) {
        const b = BANNERS.findIndex(x => x.set === 'azeroth' && x.id === r);
        if (b !== opts.banner) this.addPlayer(BANNERS[b].name, b, false);
      }
    }
    for (const f of AZEROTH_FACTIONS) {
      const id = this.nextPactId++;
      this.pacts.set(id, { name: f.name, founder: -1, eternal: true });
      for (const p of this.players) if (f.races.includes(race(p))) p.pact = id;
    }
    for (const p of this.players) {
      const [x, y] = AZEROTH_CAPITALS[race(p)].at;
      this.spawnPlayer(p, this.nearestSpawn(x, y));
    }
    this.phase = 'playing';
    this.paused = true;
  },

  // La case la plus proche de (x, y) où l'on peut fonder une capitale (une terre libre, pas un fleuve, sur une
  // terre assez grande ; pas trop près d'une autre capitale si possible)
  nearestSpawn(x, y) {
    const W = this.W, ok = (i, d) => this.isLand(i) && this.terrain[i] !== TERRAIN.RIVER && this.owner[i] < 0
      && this.landSize()[i] >= CONFIG.MIN_SPAWN_LAND && this.canSpawnAt(i, d);
    for (const d of [CONFIG.MIN_SPAWN_DISTANCE, CONFIG.MIN_SPAWN_DISTANCE / 2, 0]) {
      for (let r = 0; r < 40; r++) {
        let best = -1, bestD = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= this.H - 1) continue;
            const i = yy * W + xx;
            if (dx * dx + dy * dy < bestD && ok(i, d)) { best = i; bestD = dx * dx + dy * dy; }
          }
        }
        if (best >= 0) return best;
      }
    }
    return y * W + x;
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
    if (t === B_MINE) { // (🪙 une mine d'or, tant que son filon n'est pas épuisé ; 2 fois plus si elle est reliée)
      if (info.kind !== 'gold' || this.mineSpent(a)) return 0;
      return info.gold * (this.mineLinked(a) ? CONFIG.MINE_ROAD_FACTOR : 1);
    }
    if (t === B_CHURCH) { // (par chemin ; une route de pierre, vers une cité impériale, rapporte plus)
      this.roads();
      return (this.roadChurches.get(a) || []).reduce((s, l) => s + CONFIG.CHURCH_ROAD_GOLD * (l.stone ? IMPERIAL.roadFactor : 1), 0)
        * this.terrainFactor(a, B_CHURCH);
    }
    const eff = !owner ? 1 : t === B_BARRACKS ? this.barracksEfficiency(owner) : this.goldEfficiency(owner);
    const v = (t === B_MILL || t === B_PORT ? info.gold : info.troops) * eff;
    const road = this.roads().get(a);
    const mills = road && road.mills ? road.mills * CONFIG.PORT_MILL_BONUS : 0; // (port : les moulins de ses villes)
    return v * (1 + (road ? road.bonus : 0) + mills) * this.terrainFactor(a, t);
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
      if (t !== B_MILL && t !== B_BARRACKS && t !== B_PORT && t !== B_CHURCH && t !== B_MINE) continue;
      if (this.underConstruction(a)) continue; // en chantier : il ne produit pas encore
      if ((this.tick + a * 7) % period !== 0) continue;
      const p = this.players[this.owner[a]];
      if (!p || !p.alive) continue;
      const amount = this.buildingOutput(a) * (t === B_BARRACKS ? this.warFactor(p) * this.botBonus(p, 'troops') * this.levyFactor(p)
        : this.upkeepFactor(p) * this.botBonus(p, 'gold'));
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
    // Un moulin ou une caserne dans la muraille d'une ville de niveau 2 ou 3 : une route le relie à elle.
    // Entre plusieurs villes (dans la muraille de chacune), il a une route par ville (ROAD_MAX_CITIES au plus) :
    // les bonus s'additionnent.
    for (const a of this.buildingTiles) {
      const t = this.building[a], o = this.owner[a];
      if ((t !== B_MILL && t !== B_BARRACKS) || o < 0) continue;
      const list = this.cityRoads(o, a, t);
      if (list.length) links.set(a, this.roadLink(list));
    }
    // Un port pas trop loin d'une ville (un château de son royaume, sur la même terre) : un chemin de terre
    // les relie, et le port produit PORT_ROAD_BONUS d'or en plus. Avec plusieurs villes assez proches : un chemin
    // par ville (ROAD_MAX_CITIES au plus), et autant de fois le bonus.
    for (const a of this.buildingTiles) {
      if (this.building[a] !== B_PORT || this.owner[a] < 0) continue;
      const list = this.portRoadCastles(this.owner[a], a).map(c => this.castleInfo(c).imperial
        ? { castle: c, bonus: CONFIG.PORT_ROAD_BONUS * IMPERIAL.roadFactor, road: 'paved' } // (route de pierre)
        : { castle: c, bonus: CONFIG.PORT_ROAD_BONUS, road: 'dirt' });
      if (list.length) links.set(a, this.roadLink(list));
    }
    // Le port exporte le grain des moulins de ses villes : chaque moulin relié par une route à une ville du port
    // lui rapporte PORT_MILL_BONUS d'or en plus (PORT_MILL_MAX moulins au plus)
    for (const [a, link] of links) {
      if (this.building[a] !== B_PORT) continue;
      const cities = new Set(this.linkRoads(link).map(([c]) => c));
      let mills = 0;
      for (const [m, ml] of links) {
        if (this.building[m] === B_MILL && this.owner[m] === this.owner[a] && this.linkRoads(ml).some(([c]) => cities.has(c))) mills++;
      }
      link.mills = Math.min(mills, CONFIG.PORT_MILL_MAX);
    }
    // Une mine (qui n'est pas épuisée) à moins de MINE_ROAD_DISTANCE cases d'une de ses villes : une route les relie
    for (const a of this.buildingTiles) {
      if (this.building[a] !== B_MINE || this.owner[a] < 0 || this.mineSpent(a)) continue;
      const c = this.mineRoadCastle(this.owner[a], a);
      if (c >= 0) links.set(a, { castle: c, road: this.castleInfo(c).imperial ? 'paved' : 'dirt', more: [], bonus: 0, mine: true });
    }
    // Une église reliée par un chemin à une de ces routes, ou à une ville proche, produit un peu d'or (CHURCH_ROAD_GOLD)
    this.roadChurches = new Map(); // église → ses chemins (voir churchLinks)
    for (const ch of this.buildingTiles) {
      if (this.building[ch] !== B_CHURCH || this.owner[ch] < 0) continue;
      const list = this.churchLinks(this.owner[ch], ch, links);
      if (list.length) this.roadChurches.set(ch, list);
    }
    // Un moulin ou une caserne hors des villes, posé sur une de ces routes (ou juste à côté) : +MILL_ROAD_BONUS
    for (const a of this.buildingTiles) {
      const t = this.building[a], o = this.owner[a];
      if ((t !== B_MILL && t !== B_BARRACKS) || o < 0 || links.has(a)) continue;
      const on = this.onRoad(o, a, t, links);
      if (on) links.set(a, { bonus: CONFIG.MILL_ROAD_BONUS * (on === 2 ? IMPERIAL.roadFactor : 1), road: on === 2 ? 'paved' : 'dirt', onRoad: true });
    }
    this.roadsCache = links;
    this.roadsVersion = this.version;
    return links;
  },

  // Un moulin (ou une caserne) de pid posé en a est-il sur une route, hors des villes ? Les routes : celles des ports
  // (vers une ville) et les chemins des églises, à moins de MILL_ROAD_DISTANCE cases de son centre.
  // (dans la muraille d'une ville, ce sont les routes de la ville qui comptent : voir roads)
  // Renvoie 0 (pas de route), 1 (au bord d'un chemin de terre) ou 2 (au bord d'une route de pierre, vers une cité
  // impériale : bonus plus fort, voir IMPERIAL).
  onRoad(pid, a, type, links = this.roads()) {
    const cells = this.footprint(a, type);
    if (cells.some(j => this.castleProtects(pid, j))) return 0;
    const W = this.W, h = this.sizeOf(type) / 2, x = a % W + h, y = ((a / W) | 0) + h, D = CONFIG.MILL_ROAD_DISTANCE;
    let best = 0;
    for (const [b, link] of links) {
      if (this.building[b] !== B_PORT || this.owner[b] !== pid) continue;
      for (const [c, kind] of this.linkRoads(link)) {
        if (this.roadNearest(this.roadPoints(b, c), x, y).d <= D) best = Math.max(best, kind === 'paved' ? 2 : 1);
      }
    }
    for (const [ch, list] of this.roadChurches || []) {
      if (this.owner[ch] !== pid) continue;
      for (const link of list) if (this.roadNearest(link.pts, x, y).d <= D) best = Math.max(best, link.stone ? 2 : 1);
    }
    return best;
  },

  // Villes (châteaux de niveau 2 ou 3) de pid dont la muraille contient le centre d'un moulin (ou d'une caserne)
  // posé en a : [{ castle, bonus, road }], la meilleure route d'abord
  cityRoads(pid, a, type) {
    const half = (this.sizeOf(type) - 1) / 2, x = a % this.W + half, y = ((a / this.W) | 0) + half, list = [];
    for (const c of this.castles) {
      const info = this.castleInfo(c);
      if (this.owner[c] !== pid || !info.road || !this.inCastleRange(c, x, y, info.radius)) continue;
      if (!this.roadPoints(a, c, type)) continue; // (l'eau coupe le chemin : pas de route)
      list.push({ castle: c, bonus: info.roadBonus, road: info.road });
    }
    return list.sort((p, q) => q.bonus - p.bonus);
  },

  // Les routes d'un bâtiment (une par ville, ROAD_MAX_CITIES au plus) : { castle, road, more, bonus }
  // (castle et road : la meilleure route ; more : les autres [[ville, type de route]] ; bonus : tous additionnés)
  roadLink(list) {
    const [r1, ...rest] = list.slice(0, CONFIG.ROAD_MAX_CITIES);
    return { castle: r1.castle, road: r1.road, more: rest.map(r => [r.castle, r.road]),
      bonus: r1.bonus + rest.reduce((s, r) => s + r.bonus, 0) };
  },

  // Les routes d'un lien : [[ville, type de route]] (aucune pour un moulin posé au bord d'une route)
  linkRoads(link) {
    return link.castle === undefined ? [] : [[link.castle, link.road], ...(link.more || [])];
  },

  // Portée des routes d'une ville (château c) : la distance de base, +ROAD_RANGE_PER_LEVEL par niveau au-dessus du 1er
  // (level : pour un aperçu, le niveau qu'aura la ville)
  roadReach(c, base, level = this.level[c]) {
    return base * (1 + CONFIG.ROAD_RANGE_PER_LEVEL * (Math.max(1, level) - 1));
  },

  // Villes (châteaux) de pid auxquelles un port posé en a serait relié par un chemin de terre : les plus proches
  // (ROAD_MAX_CITIES au plus), à moins de PORT_ROAD_DISTANCE cases (plus loin pour une ville améliorée, voir roadReach)
  // et sur la même terre (la plus proche d'abord)
  portRoadCastles(pid, a) {
    const land = this.landComp(), W = this.W, mid = (b, n) => [b % W + n / 2, ((b / W) | 0) + n / 2];
    const [px, py] = mid(a, this.sizeOf(B_PORT)), list = [];
    for (const c of this.castles) {
      if (this.owner[c] !== pid || land[c] !== land[a]) continue;
      const [cx, cy] = mid(c, this.sizeOf(B_CASTLE)), d = Math.hypot(cx - px, cy - py);
      if (d <= this.roadReach(c, CONFIG.PORT_ROAD_DISTANCE) && this.roadPoints(a, c, B_PORT)) list.push([d, c]);
    }
    return list.sort((p, q) => p[0] - q[0]).slice(0, CONFIG.ROAD_MAX_CITIES).map(([, c]) => c);
  },
  // La plus proche (-1 s'il n'y en a pas)
  portRoadCastle(pid, a) {
    const list = this.portRoadCastles(pid, a);
    return list.length ? list[0] : -1;
  },

  // Tracé d'une route (en cases) : du centre du château au centre du bâtiment a (voir roadRoute), ou null si l'eau
  // l'empêche (type : celui du bâtiment, s'il n'est pas encore bâti, pour un aperçu)
  roadPoints(a, castle, type = this.building[a]) {
    const W = this.W, hc = this.sizeOf(B_CASTLE) / 2, hb = this.sizeOf(type) / 2;
    return this.roadRoute(castle % W + hc, ((castle / W) | 0) + hc, a % W + hb, ((a / W) | 0) + hb, a % 2);
  },

  // --- Routes commerciales (entre une de ses villes et celle d'un allié du pacte : voir TRADE_* dans config.js) ---
  // Longueur d'un tracé (en cases)
  tradeLength(pts) {
    let len = 0;
    for (let k = 0; k + 1 < pts.length; k++) len += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
    return len;
  },
  // Prix et revenu (à chaque versement) d'une route commerciale de cette longueur
  tradeCost(len) {
    return Math.round(Math.min(CONFIG.TRADE_COST_MAX,
      CONFIG.TRADE_COST_MIN + Math.max(0, len - CONFIG.TRADE_COST_FREE_LENGTH) * CONFIG.TRADE_COST_PER_TILE));
  },
  tradeIncome(len) { return Math.round(len * CONFIG.TRADE_GOLD_PER_TILE); },
  // La route commerciale qui part de la ville a (ou null)
  // Routes commerciales au plus de la ville c, selon son niveau (1 au niveau 2, 2 au niveau 3, 3 au niveau 4)
  tradeMax(c) { return this.castleInfo(c).trades || 0; },
  // Message : la ville c (« Cette ville »…) a déjà toutes ses routes
  tradeFull(c, who) {
    const n = this.tradeMax(c), next = CASTLE_LEVELS[this.level[c] + 1];
    return tr(`${who} a déjà ${n > 1 ? `ses ${n} routes commerciales` : 'sa route commerciale'}`,
      `${who} already has ${n > 1 ? `its ${n} trade routes` : 'its trade route'}`) +
      (next ? tr(` (en l'améliorant en ${next.name}, elle en aura ${next.trades}).`, ` (upgraded to ${next.name}, it will have ${next.trades}).`)
        : tr(' (le maximum).', ' (the maximum).'));
  },
  // Les routes commerciales de la ville a (qu'elle les ait ouvertes ou qu'elles y arrivent)
  tradesOf(a) { return this.tradeRoutes.filter(r => r.from === a || r.to === a); },
  // Les alliés de pid (dans son pacte) qui ont une ville de niveau 2 ou plus
  tradePartners(pid) {
    return this.players.filter(o => o.alive && o.id !== pid && this.areAllied(pid, o.id) &&
      this.castles.some(c => this.owner[c] === o.id && this.level[c] >= 2));
  },
  // Pourquoi la ville a de pid ne peut pas (encore) avoir de route commerciale, ou null si elle le peut
  tradeBlocker(pid, a) {
    // (en mode Factions, les pactes ordinaires sont interdits, mais on commerce avec les alliés de son camp)
    if (!this.pactsAllowed && !this.factions) return tr('Pas de pactes dans cette partie : pas de route commerciale.', 'No pacts in this game: no trade routes.');
    if (this.building[a] !== B_CASTLE || this.owner[a] !== pid || this.level[a] < 2) return tr('Il faut une de tes villes de niveau 2 ou plus.', 'You need one of your cities at level 2 or higher.');
    if (this.tradesOf(a).length >= this.tradeMax(a)) return this.tradeFull(a, tr('Cette ville', 'This city'));
    if (!this.tradePartners(pid).length) return tr('Il te faut un allié dans ton pacte, avec une ville de niveau 2 ou plus.', 'You need an ally in your pact with a city at level 2 or higher.');
    return null;
  },
  // Plan d'une route commerciale de la ville a (au royaume pid) vers la ville visée en b :
  // { to, pts, len, cost, income } ou { error }
  planTrade(pid, a, b) {
    const why = this.tradeBlocker(pid, a);
    if (why) return { error: why };
    if (b < 0 || this.building[b] !== B_CASTLE) return { error: tr('Clique sur une ville (un château) d\'un allié de ton pacte.', 'Click a city (a castle) of an ally in your pact.') };
    b = this.anchor[b];
    const o = this.owner[b];
    if (o < 0 || o === pid || !this.areAllied(pid, o)) return { error: tr('Une route commerciale relie une de tes villes à une ville d\'un allié de ton pacte.', 'A trade route links one of your cities to a city of an ally in your pact.') };
    if (this.level[b] < 2) return { error: tr('La ville de ton allié doit être de niveau 2 ou plus.', 'Your ally\'s city must be level 2 or higher.') };
    // (on ne relie pas deux fois les mêmes villes, même si c'est ton allié qui a ouvert la route)
    if (this.tradeRoutes.some(r => (r.from === b && r.to === a) || (r.from === a && r.to === b))) {
      return { error: tr('Ces deux villes sont déjà reliées par une route commerciale : on ne les relie pas deux fois.', 'These two cities are already linked by a trade route: they cannot be linked twice.') };
    }
    if (this.tradesOf(b).length >= this.tradeMax(b)) return { error: this.tradeFull(b, tr('Cette ville alliée', 'This allied city')) };
    const W = this.W, h = this.sizeOf(B_CASTLE) / 2;
    const tooFar = tr(`Trop loin : une route commerciale fait ${CONFIG.TRADE_MAX_LENGTH} cases au plus.`, `Too far: a trade route is at most ${CONFIG.TRADE_MAX_LENGTH} tiles long.`);
    // (à vol d'oiseau déjà trop loin : inutile de chercher un tracé)
    if (Math.abs(a % W - b % W) + Math.abs(((a / W) | 0) - ((b / W) | 0)) > CONFIG.TRADE_MAX_LENGTH * 1.2) return { error: tooFar };
    const pts = this.tradePath(a % W + h, ((a / W) | 0) + h, b % W + h, ((b / W) | 0) + h, a % 2, pid, o);
    if (!pts) return { error: this.tradeBlockReason(a % W + h, ((a / W) | 0) + h, b % W + h, ((b / W) | 0) + h, pid, o) };
    const len = this.tradeLength(pts);
    if (len > CONFIG.TRADE_MAX_LENGTH) return { error: tooFar };
    return { to: b, pts, len, cost: this.tradeCost(len), income: this.tradeIncome(len) };
  },
  // Construit la route commerciale de la ville a vers la ville visée en b. Renvoie un message d'erreur, ou null.
  buildTrade(p, a, b) {
    const plan = this.planTrade(p.id, a, b);
    if (plan.error) return plan.error;
    if (p.gold < plan.cost) return tr(`Pas assez d'or : cette route commerciale coûte 💰 ${fmt(plan.cost)}.`, `Not enough gold: this trade route costs 💰 ${fmt(plan.cost)}.`);
    p.gold -= plan.cost;
    this.tradeRoutes.push({ from: a, to: plan.to, active: true, pts: plan.pts, tiles: this.routeTiles(plan.pts), len: plan.len, income: plan.income });
    this.version++;
    return null;
  },
  // Pourquoi aucune route commerciale ne passe entre ces deux villes (de pid et de son allié o) : on cherche le tracé
  // sans tenir compte des territoires. S'il existe, ce sont des terres d'un autre (ou des terres libres) qui bloquent ;
  // sinon, c'est l'eau (mer, lac, fleuve sans pont) ou un sommet.
  tradeBlockReason(x1, y1, x2, y2, pid, o) {
    const free = this.roadDetour(x1, y1, x2, y2, i => this.roadTile(i), 40, 3);
    if (!free) return tr('Pas de passage assez court par la terre : la mer, un lac, un sommet ou un fleuve sans pont ' +
      'coupe le chemin (un pont ouvre un passage).', 'No short enough way over land: the sea, a lake, a peak or a river without a bridge ' +
      'cuts the way (a bridge opens a passage).');
    const other = this.routeTiles(free).find(i => this.owner[i] !== pid && this.owner[i] !== o && this.terrain[i] !== TERRAIN.RIVER);
    const who = other === undefined ? null : this.owner[other] < 0 ? tr('des terres libres', 'free land')
      : tr(`les terres ${this.deName(this.players[this.owner[other]].name)}`, `${this.players[this.owner[other]].name}'s land`);
    return tr('La route commerciale doit rester sur vos deux territoires', 'The trade route must stay on your two territories') +
      (who ? tr(` : ici, elle passerait par ${who}. Prends-les d'abord.`, `: here, it would go through ${who}. Take it first.`) : '.');
  },
  // Une case où peut passer une route commerciale entre les royaumes o et q : une case où une route peut passer, sur
  // le territoire de l'un des deux (ou un fleuve, sous un pont)
  tradeTile(i, o, q) {
    return this.roadTile(i) && (this.owner[i] === o || this.owner[i] === q || this.terrain[i] === TERRAIN.RIVER);
  },
  // Tracé d'une route commerciale entre les royaumes o et q (comme roadRoute, mais seulement sur leurs deux
  // territoires, avec un détour plus large si besoin), ou null
  tradePath(x1, y1, x2, y2, first, o, q) {
    const ok = i => this.tradeTile(i, o, q), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const tries = [[[x1, y1], [x2, y1], [x2, y2]], [[x1, y1], [x1, y2], [x2, y2]],
      [[x1, y1], [mx, y1], [mx, y2], [x2, y2]], [[x1, y1], [x1, my], [x2, my], [x2, y2]]];
    if (!first) [tries[0], tries[1]] = [tries[1], tries[0]];
    return tries.find(p => this.roadClear(p, ok)) || this.roadDetour(x1, y1, x2, y2, ok, 40, 3);
  },
  // Pourquoi la route commerciale r ne rapporte rien, ou null si elle marche : ses deux villes doivent être à deux
  // royaumes alliés (dans un même pacte : ceux qui l'ont bâtie, ou d'autres qui ont pris ces villes depuis), et
  // toute la route doit rester sur leurs deux territoires (si une case de son passage est prise, elle est coupée)
  tradeProblem(r) {
    const o = this.owner[r.from], q = this.owner[r.to];
    if (o < 0 || q < 0 || o === q || !this.areAllied(o, q)) return 'ally';
    if (!(r.tiles || []).every(i => this.tradeTile(i, o, q))) return 'cut';
    return null;
  },
  tradeActive(r) { return !this.tradeProblem(r); },
  // Chaque seconde : une route commerciale s'arrête si le pacte est rompu (ou si une de ses villes passe à un royaume
  // qui n'est pas allié avec l'autre) ; elle reprend dès que les royaumes de ses deux villes sont de nouveau alliés.
  // Elle ne disparaît que si une de ses villes est détruite.
  checkTrades() {
    for (const r of this.tradeRoutes.slice()) {
      const p = this.players[this.owner[r.from]], q = this.players[this.owner[r.to]];
      if (this.building[r.from] !== B_CASTLE || this.building[r.to] !== B_CASTLE) {
        this.tradeRoutes.splice(this.tradeRoutes.indexOf(r), 1);
        this.version++;
        if ((p && p.isHuman) || (q && q.isHuman)) UI.log(tr('🛒 Une route commerciale disparaît : une de ses villes a été détruite.', '🛒 A trade route disappears: one of its cities was destroyed.'), 'warn');
        continue;
      }
      const problem = this.tradeProblem(r), active = !problem;
      if (active === r.active) continue;
      r.active = active;
      this.version++;
      if (!(p && p.isHuman) && !(q && q.isHuman)) continue;
      const names = tr(`${p ? p.name : '?'} et ${q ? q.name : '?'}`, `${p ? p.name : '?'} and ${q ? q.name : '?'}`);
      if (active) UI.log(tr(`🛒 La route commerciale entre ${names} reprend : elle rapporte de nouveau de l'or !`, `🛒 The trade route between ${names} resumes: it brings in gold again!`), 'good');
      else if (problem === 'cut') UI.log(tr(`🛒 La route commerciale entre ${names} est coupée : des terres sur son passage ont été prises. ` +
        'Elle reprendra quand tout son passage sera de nouveau à vous deux.', `🛒 The trade route between ${names} is cut: land along its way has been taken. ` +
        'It will resume once its whole way belongs to you two again.'), 'warn');
      else UI.log(tr(`🛒 La route commerciale entre ${names} s'arrête : ils ne sont pas alliés. Elle reprendra si les royaumes ` +
        'de ses deux villes forment un pacte.', `🛒 The trade route between ${names} stops: they are not allies. It will resume if the kingdoms ` +
        'of its two cities form a pact.'), 'warn');
    }
  },
  // Versement de l'or des routes commerciales (comme les moulins : toutes les PRODUCTION_INTERVAL secondes) :
  // tout le revenu pour le royaume de la ville de départ, la moitié en plus pour celui de la ville d'arrivée
  produceTrades() {
    const period = CONFIG.PRODUCTION_INTERVAL * CONFIG.TICKS_PER_SECOND;
    for (const r of this.tradeRoutes) {
      if (!r.active || (this.tick + r.from * 7) % period !== 0) continue;
      // (une route qui touche une cité impériale rapporte plus)
      const bonus = this.castleInfo(r.from).imperial || this.castleInfo(r.to).imperial ? 1 + IMPERIAL.tradeBonus : 1;
      for (const [share, c] of [[1, r.from], [CONFIG.TRADE_ALLY_SHARE, r.to]]) {
        const p = this.players[this.owner[c]];
        if (!p || !p.alive) continue;
        const amount = r.income * bonus * share * this.upkeepFactor(p);
        p.gold += amount;
        if (p.isHuman && amount >= 0.5) Render.floatText(c, B_CASTLE, `+${Math.round(amount)} 💰`);
      }
    }
  },

  // Une route ne passe jamais sur la mer, un lac, un sommet (infranchissable) ou un fleuve (sauf sur un pont) :
  // une case où elle peut passer
  roadTile(i) {
    const t = this.terrain[i];
    return t !== TERRAIN.WATER && t !== TERRAIN.GREAT_RIVER && t !== TERRAIN.PEAK && (t !== TERRAIN.RIVER || this.bridgeAt[i] === 1);
  },

  // Tracé d'une route de (x1, y1) à (x2, y2) (en cases) : une liste de points, ou null s'il n'y a pas de passage.
  // D'abord un simple coin à angle droit (à l'horizontale puis à la verticale si first vaut 1, sinon l'inverse), ou
  // l'autre coin, ou un tracé en « Z ». Si l'eau les coupe tous, la route fait un détour par la terre (le plus court,
  // avec le moins de virages) ; et s'il est bien trop long (ou impossible), pas de route du tout.
  // (gardé en mémoire : le même tracé est demandé très souvent ; un nouveau pont peut ouvrir un passage)
  roadRoute(x1, y1, x2, y2, first) {
    const key = `${x1},${y1},${x2},${y2},${first ? 1 : 0},${this.bridges.length}`;
    if (this.routeCache.has(key)) return this.routeCache.get(key);
    if (this.routeCache.size > 20000) this.routeCache.clear();
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const tries = [
      [[x1, y1], [x2, y1], [x2, y2]], [[x1, y1], [x1, y2], [x2, y2]],                   // les deux coins
      [[x1, y1], [mx, y1], [mx, y2], [x2, y2]], [[x1, y1], [x1, my], [x2, my], [x2, y2]], // les deux « Z »
    ];
    if (!first) [tries[0], tries[1]] = [tries[1], tries[0]];
    let pts = tries.find(p => this.roadClear(p)) || this.roadDetour(x1, y1, x2, y2);
    this.routeCache.set(key, pts);
    return pts;
  },

  // Les cases sur lesquelles passe le tracé pts (on regarde tous les quarts de case), ou null s'il sort de la carte
  routeTiles(pts) {
    const W = this.W, H = this.H, tiles = new Set();
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
      for (let s = 0; s <= n; s++) {
        const x = Math.floor(ax + (bx - ax) * s / n), y = Math.floor(ay + (by - ay) * s / n);
        if (x < 0 || y < 0 || x >= W || y >= H) return null;
        tiles.add(y * W + x);
      }
    }
    return [...tiles];
  },

  // Le tracé pts ne passe-t-il que sur des cases où une route peut passer ? (ok : la règle des cases, roadTile sinon)
  roadClear(pts, ok = i => this.roadTile(i)) {
    const tiles = this.routeTiles(pts);
    return !!tiles && tiles.every(ok);
  },

  // Détour d'une route par la terre : le chemin le plus court de case en case (en comptant un peu chaque virage, pour
  // une route bien droite), pas trop loin du trajet direct. null s'il n'y en a pas, ou s'il est bien trop long.
  // (ok : la règle des cases, roadTile sinon ; M : de combien le détour peut s'écarter ; long : combien de fois le
  //  trajet direct il peut faire au plus)
  roadDetour(x1, y1, x2, y2, ok = i => this.roadTile(i), M = 15, long = 1.8) {
    const W = this.W, H = this.H, sx = Math.floor(x1), sy = Math.floor(y1), ex = Math.floor(x2), ey = Math.floor(y2);
    const bx0 = Math.max(0, Math.min(sx, ex) - M), by0 = Math.max(0, Math.min(sy, ey) - M);
    const bx1 = Math.min(W - 1, Math.max(sx, ex) + M), by1 = Math.min(H - 1, Math.max(sy, ey) + M);
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, maxCost = (Math.abs(ex - sx) + Math.abs(ey - sy)) * long + 8;
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1], TURN = 0.4;
    // (une « position » = une case de la zone et la direction d'arrivée)
    // (Float64Array, pas Float32Array : les coûts doivent être exactement ceux du tas, sinon « c > cost[s] » rejette à tort
    //  toute position atteinte par un virage, et le détour échoue dès qu'il doit tourner)
    const cost = new Float64Array(bw * bh * 4).fill(Infinity), from = new Int32Array(bw * bh * 4).fill(-1);
    const heap = new MinHeap(), start = ((sy - by0) * bw + (sx - bx0)) * 4;
    for (let d = 0; d < 4; d++) { cost[start + d] = 0; heap.push(0, start + d); }
    let end = -1;
    while (heap.size) {
      const [c, s] = heap.pop();
      if (c > maxCost) break;
      if (c > cost[s]) continue;
      const cell = s >> 2, dir = s & 3, x = cell % bw, y = (cell / bw) | 0;
      if (x + bx0 === ex && y + by0 === ey) { end = s; break; }
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh || !ok((ny + by0) * W + nx + bx0)) continue;
        const n = ((ny * bw + nx) << 2) | d, nc = c + 1 + (d !== dir ? TURN : 0);
        if (nc < cost[n]) { cost[n] = nc; from[n] = s; heap.push(nc, n); }
      }
    }
    if (end < 0) return null;
    // les cases du chemin, puis seulement ses virages
    const cells = [];
    for (let s = end; s >= 0; s = from[s]) cells.push(s >> 2);
    cells.reverse();
    const pts = [[x1, y1]];
    for (let k = 1; k + 1 < cells.length; k++) {
      const a = cells[k - 1], b = cells[k], c = cells[k + 1];
      if (b - a !== c - b) pts.push([b % bw + bx0 + 0.5, ((b / bw) | 0) + by0 + 0.5]);
    }
    pts.push([x2, y2]);
    return pts;
  },

  // Point d'une route le plus proche du point (x, y) : { x, y, d } (d = distance, en cases)
  roadNearest(pts, x, y) {
    let best = { x: pts[0][0], y: pts[0][1], d: Infinity };
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
      if (d < best.d) best = { x: px, y: py, d };
    }
    return best;
  },

  // Chemins d'une église (posée en a, au royaume pid) : un chemin vers la route port–ville la plus proche (à moins
  // de CHURCH_ROAD_DISTANCE cases) : { pts, port } ; et un chemin vers chaque ville (château) à moins de
  // CHURCH_CITY_DISTANCE cases (plus loin pour une ville améliorée, voir roadReach) sur la même terre :
  // { pts, castle } (sauf celles où mène déjà cette route).
  // ROAD_MAX_CITIES chemins au plus, les plus proches d'abord ; [] si aucun. pts = le tracé (coin à angle droit).
  // (un port seul, sans ville, ne crée pas de chemin : il n'a pas de route)
  // Une nouvelle ville bâtie près de l'église ajoute un chemin : elle ne remplace pas ceux qui existent.
  churchLinks(pid, a, links = this.roads()) {
    const W = this.W, h = this.sizeOf(B_CHURCH) / 2, x = a % W + h, y = ((a / W) | 0) + h, land = this.landComp();
    const corner = (x1, y1) => this.roadRoute(x1, y1, x, y, a % 2); // (null si l'eau coupe le chemin)
    let road = null, bestD = CONFIG.CHURCH_ROAD_DISTANCE, served = [];
    for (const [b, link] of links) {
      if (this.building[b] !== B_PORT || this.owner[b] !== pid) continue;
      for (const [c, kind] of this.linkRoads(link)) {
        const q = this.roadNearest(this.roadPoints(b, c), x, y);
        if (q.d > bestD || land[Math.floor(q.y) * W + Math.floor(q.x)] !== land[a]) continue; // (pas de l'autre côté de l'eau)
        const pts = corner(q.x, q.y);
        if (!pts) continue;
        bestD = q.d;
        road = { port: b, pts, d: q.d, stone: kind === 'paved' }; // (branché sur une route de pierre : voir roads)
        served = this.linkRoads(link).map(([v]) => v);
      }
    }
    const list = road ? [road] : [], hc = this.sizeOf(B_CASTLE) / 2;
    for (const c of this.castles) {
      if (this.owner[c] !== pid || land[c] !== land[a] || served.includes(c)) continue;
      const cx = c % W + hc, cy = ((c / W) | 0) + hc, d = Math.hypot(cx - x, cy - y);
      if (d > this.roadReach(c, CONFIG.CHURCH_CITY_DISTANCE)) continue;
      const pts = corner(cx, cy);
      if (pts) list.push({ castle: c, pts, d, stone: !!this.castleInfo(c).imperial });
    }
    return list.sort((p, q) => p.d - q.d).slice(0, CONFIG.ROAD_MAX_CITIES);
  },

  // Aperçu, avant de bâtir : les routes qu'aurait un bâtiment de type t posé par pid en a (ou le château a amélioré,
  // si upgrading). Renvoie { roads: [{ pts, road }], far } : road = 'dirt' ou 'paved' ; far = la ville la plus proche
  // quand elle est trop loin pour une route ({ pts, d, max } : distance et portée, en cases), sinon null.
  // (même calcul que le jeu : voir roads, portRoadCastles, churchLinks, cityRoads)
  roadPreview(pid, a, t, upgrading = false) {
    const W = this.W, land = this.landComp(), roads = [];
    const mid = (b, type) => { const h = this.sizeOf(type) / 2; return [b % W + h, ((b / W) | 0) + h]; };
    const [x, y] = mid(a, t);
    // La ville la plus proche sur la même terre, si aucune n'est assez près : trait rouge « trop loin »
    const nearest = base => {
      let best = null;
      for (const c of this.castles) {
        if (this.owner[c] !== pid || land[c] !== land[a]) continue;
        const [cx, cy] = mid(c, B_CASTLE), d = Math.hypot(cx - x, cy - y);
        if (!best || d < best.d) best = { pts: [[cx, cy], [x, y]], d, max: this.roadReach(c, base) };
      }
      return best;
    };
    let far = null;
    if (t === B_PORT) {
      for (const c of this.portRoadCastles(pid, a)) roads.push({ pts: this.roadPoints(a, c, t), road: this.castleInfo(c).imperial ? 'paved' : 'dirt' });
      if (!roads.length) far = nearest(CONFIG.PORT_ROAD_DISTANCE);
    } else if (t === B_MINE) { // (une mine : une route vers sa ville la plus proche, si elle n'est pas trop loin)
      const c = this.mineRoadCastle(pid, a);
      if (c >= 0) roads.push({ pts: this.roadPoints(a, c, t), road: this.castleInfo(c).imperial ? 'paved' : 'dirt' });
      else far = nearest(CONFIG.MINE_ROAD_DISTANCE);
    } else if (t === B_CHURCH) {
      for (const link of this.churchLinks(pid, a)) roads.push({ pts: link.pts, road: link.stone ? 'paved' : 'dirt' });
      if (!roads.length) far = nearest(CONFIG.CHURCH_CITY_DISTANCE);
    } else if (t === B_MILL || t === B_BARRACKS) {
      // Dans la muraille de villes de niveau 2 ou 3 : une route par ville ; sinon, au bord d'une route : un bout de chemin
      for (const r of this.cityRoads(pid, a, t).slice(0, CONFIG.ROAD_MAX_CITIES)) {
        roads.push({ pts: this.roadPoints(a, r.castle, t), road: r.road });
      }
      if (!roads.length && this.onRoad(pid, a, t)) {
        let q = null;
        const near = pts => { const p = this.roadNearest(pts, x, y); if (!q || p.d < q.d) q = p; };
        for (const [b, link] of this.roads()) {
          if (this.building[b] === B_PORT && this.owner[b] === pid) for (const [c] of this.linkRoads(link)) near(this.roadPoints(b, c));
        }
        for (const [ch, list] of this.roadChurches || []) if (this.owner[ch] === pid) for (const l of list) near(l.pts);
        if (q) roads.push({ pts: [[x, y], [q.x, q.y]], road: 'dirt' });
      }
    } else if (t === B_CASTLE) {
      // Une ville (nouvelle, ou améliorée : elle relie plus loin) : chemins vers ses ports et ses églises proches,
      // et routes vers les moulins et casernes de sa muraille (dès le niveau 2)
      const level = upgrading ? Math.min(CASTLE_LEVELS.length - 1, this.level[a] + 1) : 1, info = CASTLE_LEVELS[level];
      for (const b of this.buildingTiles) {
        if (this.owner[b] !== pid || land[b] !== land[a]) continue;
        const type = this.building[b], [bx, by] = mid(b, type), d = Math.hypot(bx - x, by - y);
        let pts = null, road = info.imperial && (type === B_PORT || type === B_CHURCH) ? 'paved' : 'dirt'; // (routes de pierre)
        if (type === B_PORT && d <= this.roadReach(a, CONFIG.PORT_ROAD_DISTANCE, level)) {
          pts = this.roadPoints(b, a);
        } else if (type === B_CHURCH && d <= this.roadReach(a, CONFIG.CHURCH_CITY_DISTANCE, level)) {
          pts = this.roadRoute(x, y, bx, by, b % 2);
        } else if ((type === B_MILL || type === B_BARRACKS) && info.road) {
          const half = (this.sizeOf(type) - 1) / 2;
          if (this.inCastleRange(a, b % W + half, ((b / W) | 0) + half, info.radius)) { pts = this.roadPoints(b, a); road = info.road; }
        }
        if (pts) roads.push({ pts, road }); // (pas de route là où l'eau coupe le chemin)
      }
    }
    return { roads, far: far && far.d > far.max ? far : null };
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
    // (une ville reliée par un mur à d'autres villes du royaume : WALL_LINK_GARRISON soldats de plus par ville reliée)
    if (t === B_CASTLE) return this.buildingInfo(a).garrison + (this.walls.length ? this.wallLinked(a).size * CONFIG.WALL_LINK_GARRISON : 0);
    if (t === B_PORT) return this.buildingInfo(a).garrison || 0;
    return 0;
  },

  // Soldats en garnison dans les châteaux, ports et avant-postes du royaume
  // (pas les soldats d'un avant-poste en construction : ce n'est pas une garnison, voir builders)
  garrisonOf(p) {
    let sum = 0;
    for (const a of this.buildingTiles) if (this.owner[a] === p.id && !this.builders(a)) sum += this.garrison[a];
    return sum;
  },

  // Soldats stationnés dans les avant-postes du royaume (ils peuvent attaquer depuis là),
  // et ceux qui bâtissent un avant-poste (ils n'en sont pas encore la garnison)
  stationedOf(p) {
    let sum = 0;
    for (const [a, o] of this.outposts) if (this.owner[a] === p.id) sum += o.stationed + this.builders(a);
    return sum;
  },

  // Avant-poste en construction : ses soldats ne sont pas une garnison active, ce sont des soldats affaiblis,
  // occupés à bâtir (ils défendent sans le bonus de garnison, et avec -0.2 de défense). Renvoie leur nombre (0 sinon).
  builders(a) { return this.building[a] === B_OUTPOST && !this.outpostReady(a) ? this.garrison[a] : 0; },

  // Toute l'armée du royaume : les soldats disponibles + ceux stationnés aux avant-postes + ceux en mer
  // (ils comptent tous pour le maximum). Les garnisons, elles, n'en font pas partie : ce sont des armées liées
  // à leur bâtiment (avoir des villes bien gardées ne freine pas le recrutement).
  armySize(p) { return p.troops + this.stationedOf(p) + this.atSeaOf(p) + this.campaignOf(p); },

  // Soldats de p partis en campagne : dans ses assauts (et leurs renforts en route), ses défenseurs (au combat,
  // en route ou qui rentrent), et ceux qu'il a envoyés aider un allié. Ils comptent dans son armée : pendant qu'ils
  // sont loin, le royaume ne recrute pas au-delà de son maximum (sinon un assaut pourrait grossir sans fin).
  campaignOf(p) {
    let sum = 0;
    const id = p.id;
    for (const a of this.attacks) {
      if (a.done) continue;
      if (a.attacker === id) sum += a.troops + a.pending.reduce((s, r) => s + r.troops, 0);
      if (a.target === id) sum += Math.max(0, a.defenders) + this.defendersOnTheWay(a);
    }
    for (const r of this.returning) if (r.pid === id) sum += r.troops;
    return sum;
  },

  // Soldats de pid à bord de ses bateaux (débarquements, renforts, retours au port)
  atSeaOf(p) {
    let sum = 0;
    for (const e of this.expeditions) {
      if (e.done || e.pid !== p.id) continue;
      const k = Math.min(1, (this.tick - e.start) / Math.max(1, e.arrive - e.start));
      sum += e.sent - (e.sent - e.troops) * k;
    }
    return sum;
  },

  troopRate(p) {
    const max = this.maxTroops(p), army = this.armySize(p);
    if (army >= max) return 0;
    const base = CONFIG.BASE_TROOP_GROWTH + Math.sqrt(p.tiles) * CONFIG.TROOP_GROWTH_SQRT;
    return base * this.growthFactor(army / max) * this.warFactor(p) * this.earlyBoost() * this.botBonus(p, 'troops') * this.levyFactor(p);
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
  // Après-guerre et galvanisation s'additionnent (pas de multiplication) : un +25 % annule un −25 %
  warFactor(p) {
    return 1 - this.postWar(p) + this.rallied(p);
  },
  // noMalus = pas de malus d'après-guerre pour le vainqueur (avant-poste détruit) : seul le perdant est galvanisé
  warEffects(a, noMalus = false) {
    const end = this.tick + CONFIG.WAR_EFFECT_TIME * CONFIG.TICKS_PER_SECOND;
    const p = this.players[a.attacker], d = a.target >= 0 ? this.players[a.target] : null;
    if (!noMalus) (p.postWarEnds = p.postWarEnds || []).push(end);
    if (d) (d.rallyEnds = d.rallyEnds || []).push(end);
    const secs = CONFIG.WAR_EFFECT_TIME;
    if (p.isHuman && !noMalus) UI.log(tr(`⚰️ Après-guerre : ton royaume panse ses blessures, −${Math.round(CONFIG.POST_WAR_MALUS * 100)} % de soldats produits pendant ${secs} s (en tout : −${Math.round(this.postWar(p) * 100)} %).`,
      `⚰️ Post-war: your kingdom licks its wounds, −${Math.round(CONFIG.POST_WAR_MALUS * 100)}% soldiers produced for ${secs} s (in total: −${Math.round(this.postWar(p) * 100)}%).`), 'warn');
    if (d && d.isHuman) UI.log(tr(`🔥 Ton peuple est galvanisé par la défaite : +${Math.round(CONFIG.RALLY_BONUS * 100)} % de soldats produits pendant ${secs} s (en tout : +${Math.round(this.rallied(d) * 100)} %) !`,
      `🔥 Your people are rallied by defeat: +${Math.round(CONFIG.RALLY_BONUS * 100)}% soldiers produced for ${secs} s (in total: +${Math.round(this.rallied(d) * 100)}%)!`), 'good');
  },

  // Défense réussie (assaut repoussé) : le défenseur est galvanisé (+RALLY_BONUS de soldats produits)
  // pendant DEFENSE_RALLY_TIME secondes (ça s'additionne avec les autres galvanisations, voir rallied)
  defenseRally(d) {
    const secs = CONFIG.DEFENSE_RALLY_TIME;
    (d.rallyEnds = d.rallyEnds || []).push(this.tick + secs * CONFIG.TICKS_PER_SECOND);
    if (d.isHuman) UI.log(tr(`🔥 Victoire ! Ton peuple est galvanisé : +${Math.round(CONFIG.RALLY_BONUS * 100)} % de soldats produits pendant ${secs} s (en tout : +${Math.round(this.rallied(d) * 100)} %) !`,
      `🔥 Victory! Your people are rallied: +${Math.round(CONFIG.RALLY_BONUS * 100)}% soldiers produced for ${secs} s (in total: +${Math.round(this.rallied(d) * 100)}%)!`), 'good');
  },

  // Multiplicateur de recrutement selon le remplissage r (0 = vide, 1 = plein) :
  // il monte jusqu'au remplissage idéal, puis redescend jusqu'à 0 au maximum.
  growthFactor(r) {
    const peak = CONFIG.TROOP_PEAK_RATIO, lo = CONFIG.TROOP_GROWTH_AT_ZERO, hi = CONFIG.TROOP_GROWTH_AT_PEAK;
    if (r <= peak) return lo + (hi - lo) * (r / peak);
    return hi * Math.max(0, (1 - r) / (1 - peak));
  },

  goldRate(p) {
    return (CONFIG.BASE_GOLD + p.tiles * CONFIG.GOLD_PER_TILE) * this.upkeepFactor(p) * this.botBonus(p, 'gold');
  },

  // Avantage des bots selon la difficulté (voir DIFFICULTIES.botBonus) : 1 pour le joueur, ou sans bonus
  botBonus(p, key) {
    const b = this.difficulty.botBonus;
    return !b || !p || p.isHuman ? 1 : b[key] || 1;
  },

  // Solde des troupes : multiplicateur de l'or gagné (1 = rien à payer). Au-delà de UPKEEP_FROM de l'armée
  // maximum, les soldats disponibles en surnombre coûtent de l'or, jusqu'à -UPKEEP_MAX avec une armée pleine.
  upkeepFactor(p) {
    const r = p.troops / Math.max(1, this.maxTroops(p));
    if (r <= CONFIG.UPKEEP_FROM) return 1;
    return 1 - CONFIG.UPKEEP_MAX * Math.min(1, (r - CONFIG.UPKEEP_FROM) / (1 - CONFIG.UPKEEP_FROM));
  },

  buildCost(p, type) {
    // (les églises et les ports montent 2 fois plus vite : on n'en bâtit pas trop)
    // (une mine coûte toujours le même prix ; les moulins et casernes montent moins vite : MILL_COST_GROWTH)
    const growth = type === B_MINE ? 1 : type === B_CHURCH || type === B_PORT ? CONFIG.RARE_COST_GROWTH
      : type === B_MILL || type === B_BARRACKS ? CONFIG.MILL_COST_GROWTH : CONFIG.BUILDING_COST_GROWTH;
    return Math.round(BUILDINGS[type].baseCost * Math.pow(growth, this.builtCount(p, type)));
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
    if (BUILDINGS[type].hidden) return tr('Ce bâtiment ne se construit pas.', 'This building cannot be built.');
    if (type === B_CASTLE && p.castlesBuilt >= this.maxCastles(p)) {
      return tr(`Tu as déjà construit ${this.maxCastles(p)} châteaux : c'est le maximum pour l'instant ` +
        '(prends-en à l\'ennemi, ou améliore une église pour en débloquer).', `You have already built ${this.maxCastles(p)} castles: that is the maximum for now ` +
        '(take some from the enemy, or upgrade a church to unlock more).');
    }
    if (type === B_MINE) {
      const d = i >= 0 ? this.depositAt.get(i) : null;
      if (!d) return tr('Une mine se bâtit sur un filon : les petites icônes de minerai, dans les montagnes (ou les collines pour la pierre).',
        'A mine is built on an ore vein: the small ore icons, in the mountains (or the hills for stone).');
      const m = MINES[d.kind];
      // (« Mine de fer » → « mines de fer »)
      if (m.max && this.minesOf(p.id, d.kind).length >= m.max) return tr(`Tu as déjà ${m.max} ${m.name.toLowerCase().replace(/^(\S+)/, '$1s')} : c'est le maximum.`,
        `You already have ${m.max} ${m.name.toLowerCase()}s: that is the maximum.`);
      if (!this.canPlace(p.id, i, type)) {
        return i >= 0 && this.owner[i] === p.id && !this.commanded(i, type)
          ? tr('Ce territoire n\'a plus ni ville ni port fortifié pour le diriger : il ne peut rien construire d\'autre.', 'This territory no longer has a city or fortified port to rule it: it cannot build anything else.')
          : tr('Ce filon doit être tout entier sur ton territoire.', 'This ore vein must be entirely on your territory.');
      }
    }
    if (!this.canPlace(p.id, i, type)) {
      const n = this.sizeOf(type);
      if (i >= 0 && this.owner[i] === p.id && !this.commanded(i, type)) {
        return tr('Ce territoire n\'a plus ni ville ni port fortifié pour le diriger : il ne peut rien construire d\'autre. ' +
          'Bâtis d\'abord un château ici (ou relie ce territoire à un de tes châteaux).', 'This territory no longer has a city or fortified port to rule it: it cannot build anything else. ' +
          'First build a castle here (or link this territory to one of your castles).');
      }
      if (i >= 0 && this.owner[i] === p.id && !this.insideWalls(p.id, i, type)) {
        return tr(`${BUILDINGS[type].name} : à construire dans l'enceinte d'une de tes villes, ou près d'une de tes églises (ou d'un port amélioré), ` +
          'qui a encore de la place (une ville : 4 moulins ou casernes, 6 au niveau 2, 9 au niveau 3 ; pas ailleurs dans l\'arrière-pays).',
          `${BUILDINGS[type].name}: build it inside the walls of one of your cities, or near one of your churches (or an upgraded port), ` +
          'that still has room (a city: 4 mills or barracks, 6 at level 2, 9 at level 3; not elsewhere in the hinterland).');
      }
      if (i >= 0 && this.owner[i] === p.id && this.churchCastleConflict(p.id, i, type)) {
        return type === B_CASTLE
          ? tr('Trop près d\'un de tes châteaux, églises, ports ou avant-postes (cercle rouge) : ' +
            'pour un château près d\'un avant-poste, conquiers d\'abord des terres autour de lui.', 'Too close to one of your castles, churches, ports or outposts (red circle): ' +
            'for a castle near an outpost, first conquer land around it.')
          : tr('Trop près (cercle rouge) : une église ou un port reste hors de la muraille de tes châteaux (même améliorés), ' +
            'et loin de tes autres églises et ports.', 'Too close (red circle): a church or a port stays outside the walls of your castles (even upgraded ones), ' +
            'and far from your other churches and ports.');
      }
      if (type === B_PORT && i >= 0 && !this.footprint(i, type).some(j => this.isCoastal(j))) {
        return tr('Un port se construit au bord de la mer ou d\'un fleuve.', 'A port is built on the shore of the sea or a river.');
      }
      if (i >= 0 && this.nearDeposit(i, type)) {
        return tr(`Trop près d'un filon : il faut ${CONFIG.DEPOSIT_CLEARANCE} cases libres autour de lui (c'est la place de sa mine).`,
          `Too close to an ore vein: it needs ${CONFIG.DEPOSIT_CLEARANCE} free tiles around it (that is the room for its mine).`);
      }
      if (i >= 0 && this.tooCloseToBuilding(i, type)) {
        return tr(`Trop près d'un autre bâtiment : il faut ${this.tooCloseToBuilding(i, type)} cases d'écart.`,
          `Too close to another building: keep ${this.tooCloseToBuilding(i, type)} tiles apart.`);
      }
      return tr(`Il faut ${n}x${n} cases libres sur ton territoire (pas de mer).`, `You need ${n}x${n} free tiles on your territory (no sea).`);
    }
    const cost = this.buildCost(p, type);
    if (p.gold < cost) return tr(`Pas assez d'or (${cost} nécessaires).`, `Not enough gold (${cost} needed).`);
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
    const size = [], start = [], owner = [], outpost = [], anyOutpost = [], colony = [], hasCastle = [], held = [];
    const main = new Array(this.players.length).fill(-1); // royaume → son plus grand morceau
    let n = 0;
    this.riverTiles(); // (prépare riverSide : les cases qui touchent un fleuve)
    const side = this.riverSide;
    const W = this.W, N = this.N, own = this.owner;
    // (cases d'en face, de l'autre côté d'un fleuve ; pas de fonction qui modifie n ou comp : c'est plus rapide)
    const across = [], pushAcross = j => { across.push(j); };
    // Routes d'assauts encore en cours vers un objectif : tant que le combat n'est pas joué, elles ne sont que
    // visuelles. Elles ne coupent donc pas le royaume traversé : pour lui, ses morceaux restent reliés à travers
    // elles (bridge[t] = royaume traversé). Si l'assaut prend son objectif, la coupe s'applique ; sinon la
    // route lui est rendue (voir revertRoute).
    const bridges = this.pendingRoutes(), bq = [];
    let bridge = null, bseen = null, stamp = 0;
    if (bridges.length) {
      if (!this.bridgeBuf || this.bridgeBuf.length !== N) { this.bridgeBuf = new Int16Array(N).fill(-1); this.bridgeSeen = new Int32Array(N); }
      bridge = this.bridgeBuf; bseen = this.bridgeSeen;
      for (const [t, o] of bridges) bridge[t] = o;
    }
    const visitBridge = (j, o) => { if (bridge[j] === o && bseen[j] !== stamp) { bseen[j] = stamp; bq.push(j); } };
    for (let i = 0; i < N; i++) {
      const o = own[i];
      if (o < 0 || comp[i] >= 0) continue;
      // Nouveau morceau : on le parcourt de proche en proche
      // (les 4 voisins sont écrits à la main : c'est la fonction la plus appelée des grandes cartes)
      const k = size.length, s = n;
      comp[i] = k;
      order[n++] = i;
      stamp = (this.bridgeStamp = (this.bridgeStamp || 0) + 1);
      bq.length = 0;
      let b = 0;
      for (let q = s; q < n || b < bq.length;) {
        // (les cases d'une route en cours sont traversées sans faire partie du morceau)
        const t = q < n ? order[q++] : bq[b++], x = t % W;
        if (x > 0 && comp[t - 1] < 0 && own[t - 1] === o) { comp[t - 1] = k; order[n++] = t - 1; }
        if (x < W - 1 && comp[t + 1] < 0 && own[t + 1] === o) { comp[t + 1] = k; order[n++] = t + 1; }
        if (t >= W && comp[t - W] < 0 && own[t - W] === o) { comp[t - W] = k; order[n++] = t - W; }
        if (t < N - W && comp[t + W] < 0 && own[t + W] === o) { comp[t + W] = k; order[n++] = t + W; }
        if (bridge) {
          if (x > 0) visitBridge(t - 1, o);
          if (x < W - 1) visitBridge(t + 1, o);
          if (t >= W) visitBridge(t - W, o);
          if (t < N - W) visitBridge(t + W, o);
        }
        if (side[t]) { // les deux rives d'un fleuve restent un même morceau
          across.length = 0;
          this.acrossRiver(t, pushAcross);
          for (const j of across) if (comp[j] < 0 && own[j] === o) { comp[j] = k; order[n++] = j; }
        }
      }
      size.push(n - s); start.push(s); owner.push(o);
      // Ce morceau a-t-il un avant-poste (bâti ou non), ou le château d'une ancienne zone d'avant-poste ?
      // (et une ville ou un port fortifié, qui tient la région : sans eux, elle est coupée de ses châteaux)
      let op = -1, anyOp = false, col = false, cas = false, hold = false;
      for (let q = s; q < n; q++) {
        const t = order[q], b = this.building[t];
        if (b === B_OUTPOST) { anyOp = true; if (this.outpostReady(this.anchor[t])) op = this.anchor[t]; }
        if (b === B_CASTLE) { cas = true; if (this.colonies.get(this.anchor[t]) === o) col = true; }
        if (b && this.holdsAlone(this.anchor[t])) hold = true;
      }
      outpost.push(op); anyOutpost.push(anyOp); colony.push(col); hasCastle.push(cas); held.push(hold);
      if (main[o] < 0 || size[k] > size[main[o]]) main[o] = k;
    }
    if (bridge) for (const [t] of bridges) bridge[t] = -1; // (on remet le tableau à zéro pour la prochaine fois)
    // Les cœurs du royaume : sur chaque île (ou continent), son plus grand morceau.
    // Une zone d'avant-poste n'est pas un cœur (c'est une tête de pont), sauf si un château s'y trouve.
    const land = this.landComp(), heart = new Uint8Array(size.length), best = new Map(), hasHeart = new Set();
    for (let k = 0; k < size.length; k++) {
      if (anyOutpost[k] && !hasCastle[k]) continue;
      const key = owner[k] + ':' + land[order[start[k]]];
      if (!best.has(key) || size[k] > size[best.get(key)]) best.set(key, k);
    }
    for (const k of best.values()) { heart[k] = 1; hasHeart.add(owner[k]); }
    // (un autre morceau du même continent, tenu par une ville ou un port fortifié et assez grand : un cœur aussi)
    for (let k = 0; k < size.length; k++) {
      if (heart[k] || !held[k] || (anyOutpost[k] && !hasCastle[k])) continue;
      const b = best.get(owner[k] + ':' + land[order[start[k]]]);
      if (b !== undefined && size[k] >= size[b] * CONFIG.SPLIT_HEART_SHARE) heart[k] = 1;
    }
    // (un royaume qui n'a plus que des zones d'avant-poste : son plus grand morceau reste son cœur)
    for (let o = 0; o < main.length; o++) if (main[o] >= 0 && !hasHeart.has(o)) heart[main[o]] = 1;
    // outpost[k] = avant-poste bâti du morceau k (-1 s'il n'y en a pas) ; heart[k] = 1 si k est un cœur du royaume
    this.regionsCache = { comp, order, size, start, owner, main, heart, outpost, anyOutpost, colony, hasCastle, held };
    this.regionsVersion = this.version;
    return this.regionsCache;
  },

  // Cases des routes d'assauts encore en cours vers un objectif (pas encore pris) : [case, royaume traversé]
  pendingRoutes() {
    const list = [];
    for (const a of this.attacks) {
      if (a.done || !a.route || a.won || a.castleTaken || a.target < 0) continue;
      for (const t of a.route) if (this.owner[t] === a.attacker) list.push([t, a.target]);
    }
    return list;
  },

  // Morceau de royaume coupé de tous ses châteaux : il n'a ni château ni avant-poste, alors que son royaume
  // a encore un château ailleurs (isolé, par exemple). Ses soldats sont bloqués dans ce château :
  //  - personne ne peut venir le défendre (on l'attaque de front, comme une terre vide) ;
  //  - aucune armée ne peut en partir (il n'a pas de château, la « zone de départ » des armées).
  // Le seul moyen d'en sortir : le relier à un château (assaut de jonction depuis le château isolé), ou y bâtir
  // un nouveau château.
  // (la tête de pont d'un assaut viking en cours, elle, n'est pas « coupée » : ses soldats viennent de la mer)
  pieceUnlinked(r, k) {
    return k >= 0 && !r.held[k] && !r.anyOutpost[k] && this.isProtected(r.owner[k]) && !this.vikingTiles().has(r.order[r.start[k]]);
  },
  // Cases prises par les assauts vikings en cours (leur route depuis la côte du débarquement)
  vikingTiles() {
    if (this.vikingTilesVersion !== this.version) {
      this.vikingTilesVersion = this.version;
      this.vikingTilesSet = new Set();
      for (const a of this.attacks) if (!a.done && a.viking !== undefined && a.route) for (const t of a.route) this.vikingTilesSet.add(t);
    }
    return this.vikingTilesSet;
  },
  // Tous les châteaux de pid sont isolés (aucun n'est relié à son cœur) : son armée est bloquée dans
  // ces châteaux. Elle peut les défendre (elle y est !), mais désorganisée (x LEADERLESS_DEFENSE) ;
  // quand l'un d'eux est attaqué, toutes ses troupes restantes le défendent d'office (voir lastStand).
  troopsInCastles(pid) {
    let any = false;
    for (const c of this.castles.concat(this.walledPorts())) {
      if (this.owner[c] !== pid) continue;
      if (!this.isIsolated(c)) return false;
      any = true;
    }
    return any;
  },
  // Où planter un drapeau blanc (le signe d'un territoire désorganisé, sans pouvoir en place) : renvoie des cases.
  // - au milieu de chaque morceau désorganisé assez grand : un royaume sans ville ni port fortifié, ou un morceau
  //   coupé de ses villes (sans avant-poste) ;
  // - à côté des villes d'un royaume dont toutes les villes sont isolées (leurs troupes défendent désorganisées).
  // (recalculé seulement quand la carte change)
  disorganizedSpots() {
    if (this.whiteFlagsVersion === this.version) return this.whiteFlags;
    this.whiteFlagsVersion = this.version;
    const r = this.regions(), spots = [], W = this.W;
    for (let k = 0; k < r.size.length; k++) {
      const o = r.owner[k];
      if (r.size[k] < CONFIG.WHITE_FLAG_MIN_TILES || r.anyOutpost[k] || r.colony[k] || r.held[k]) continue;
      if (this.isProtected(o) && !this.pieceUnlinked(r, k)) continue;
      // (la case du morceau la plus proche de son centre : le drapeau tombe toujours sur ses terres)
      let sx = 0, sy = 0;
      for (let q = r.start[k]; q < r.start[k] + r.size[k]; q++) { sx += r.order[q] % W; sy += (r.order[q] / W) | 0; }
      sx /= r.size[k]; sy /= r.size[k];
      let best = -1, bd = Infinity;
      for (let q = r.start[k]; q < r.start[k] + r.size[k]; q++) {
        const t = r.order[q], d = (t % W - sx) ** 2 + (((t / W) | 0) - sy) ** 2;
        if (d < bd) { bd = d; best = t; }
      }
      spots.push(best);
    }
    for (const p of this.players) {
      if (!p.alive || !this.troopsInCastles(p.id)) continue;
      for (const c of this.castles.concat(this.walledPorts())) if (this.owner[c] === p.id) spots.push(c);
    }
    this.whiteFlags = spots;
    return spots;
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
    for (const src of this.attackSources(pid)) {
      for (const i of this.buildFrontier(pid, target, src)) {
        const d = (i % this.W - tx) ** 2 + (((i / this.W) | 0) - ty) ** 2;
        if (d < bestD) { bestD = d; best = src; }
      }
    }
    return best;
  },

  // D'où peut partir un assaut de pid : de ses villes (-1, ses soldats disponibles), ou d'un de ses avant-postes
  // bâtis qui a encore des soldats prêts à partir. Un avant-poste « vide » (il ne lui reste que sa garnison,
  // qui ne le quitte pas) ne compte pas : l'assaut part alors de la ville.
  attackSources(pid) {
    return [-1, ...[...this.outposts.keys()].filter(a => this.owner[a] === pid && this.outpostReady(a) && this.troopsAt(pid, a) >= 1)];
  },

  // Le royaume a-t-il encore le pouvoir : une muraille avec sa garnison, c'est-à-dire une ville (un château) ou un
  // port fortifié (niveau 3) ? Alors on ne peut l'attaquer qu'en visant un de ses châteaux, églises, ports ou
  // avant-postes. Sinon, c'est l'anarchie : il est désorganisé (même s'il lui reste des églises ou des petits ports),
  // on peut attaquer tout son territoire de front, sans devoir prendre ses bâtiments un par un.
  // (ses avant-postes, eux, se visent toujours : un assaut de front ne les prend pas)
  isProtected(pid) {
    return this.castles.some(c => this.owner[c] === pid) || this.walledPorts().some(a => this.owner[a] === pid);
  },

  // Encerclement : un royaume reste d'un seul tenant (sur chaque île). Quand il est coupé en morceaux, il ne
  // garde que le plus grand de l'île (son cœur, voir regions) ; tous les autres, quelle que soit leur taille, sont englobés d'un coup par le royaume qui
  // l'a coupé (cutter), avec leurs églises, ports, moulins et casernes. Sans coupeur connu (ou s'il ne touche
  // pas le morceau), c'est le royaume qui l'entoure le plus qui le prend.
  // Exceptions :
  // - les châteaux et les ports de niveau 3 savent se défendre (holdsAlone) : ils restent au royaume, isolés,
  //   avec les terres de leur zone (et les bâtiments qui s'y trouvent) ;
  // - un morceau avec un avant-poste ou une colonie (invasion par la mer) se défend : il faut viser l'avant-poste ;
  // - la route d'un de ses assauts encore en cours n'est que visuelle : elle n'est jamais englobée (sinon l'armée
  //   perdrait son chemin, par exemple quand la Croyance convertit la case d'où part sa route).
  captureEnclaves(target, cutter = -1) {
    const T = this.players[target];
    if (!T.alive) return;
    const r = this.regions(true), pieces = [];
    const routes = new Set();
    for (const [t] of this.pendingRoutes()) if (this.owner[t] === target) routes.add(t);
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] !== target || r.heart[k]) continue;
      if (r.anyOutpost[k] || r.colony[k]) continue;
      pieces.push(Array.from(r.order.subarray(r.start[k], r.start[k] + r.size[k])));
    }
    for (const tiles of pieces) {
      // Les châteaux et ports de niveau 3 du morceau, et les terres de leur zone, restent au royaume
      const keep = tiles.filter(i => this.anchor[i] === i && this.building[i] && this.holdsAlone(i));
      // (et aussi toute case dans la muraille d'un de ses châteaux, même si le château est dans un autre morceau :
      //  la zone d'une ville ne tombe qu'avec elle, jamais coupée ou convertie par la Croyance)
      const kept = i => this.castleProtects(target, i) || keep.some(c => this.building[c] === B_CASTLE
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
        if (this.owner[i] !== target || kept(i) || routes.has(i)) continue;
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
      const keepTxt = !keep.length ? '' : tr(` ${keep.length > 1 ? 'Ses châteaux (ou ports) tiennent' : (this.building[keep[0]] === B_CASTLE ? 'Son château tient' : 'Son port tient')} encore, isolé${keep.length > 1 ? 's' : ''}.`,
        ` ${keep.length > 1 ? 'Their castles (or ports) still hold out' : (this.building[keep[0]] === B_CASTLE ? 'Their castle still holds out' : 'Their port still holds out')}, isolated.`);
      if (A.isHuman) UI.log(tr(`✂️ Des terres ${this.deName(T.name)}, coupées de leur royaume, sont englobées par le tien !${keepTxt}`, `✂️ Lands of ${T.name}, cut off from their kingdom, are absorbed by yours!${keepTxt}`), 'good', T);
      else if (T.isHuman) {
        UI.log(tr(`✂️ Une partie de ton royaume, coupée du reste, est englobée par ${A.name} !`, `✂️ A part of your kingdom, cut off from the rest, is absorbed by ${A.name}!`) +
          (keep.length ? tr(' Ce qui est isolé tient encore : clique dessus pour lancer un assaut qui le relie à ton royaume.', ' What is isolated still holds out: click it to launch an assault that links it to your kingdom.') : ''), 'warn', A);
      }
    }
  },

  // --- Attaques ---
  // (on n'attaque que depuis son propre territoire, ou depuis un avant-poste)
  // Les cases de target qui touchent nos terres (celles d'où l'armée peut partir : ses terres, ou celles de l'avant-poste source).
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
      return tr('Cet avant-poste ne peut pas (ou plus) lancer d\'attaque.', 'This outpost cannot (or can no longer) launch an attack.');
    }
    troops = Math.floor(Math.min(troops, this.troopsAt(pid, source)));
    if (target === pid) return null;
    if (target >= 0 && this.areAllied(pid, target)) {
      return tr(`${this.players[target].name} est ton allié ! Romps l'alliance d'abord.`, `${this.players[target].name} is your ally! Break the alliance first.`);
    }
    if (troops < 1) return tr('Pas assez de soldats !', 'Not enough soldiers!');
    const frontier = this.buildFrontier(pid, target, source);
    // (pas de frontière directe, mais on vise un de ses bâtiments : l'armée peut l'atteindre en passant un fleuve à gué)
    const aimsBuilding = target >= 0 && aimTile !== undefined && TARGET_TYPES.includes(this.building[aimTile]) && this.owner[aimTile] === target;
    if (frontier.length === 0 && !aimsBuilding) {
      // (un avant-poste en construction ne sert pas encore de base : ses soldats bâtissent)
      const building = [...this.outposts.keys()].some(a => this.owner[a] === pid && !this.outpostReady(a));
      if (this.hasUnlinked(pid)) {
        return tr('Ton territoire est coupé de tous tes châteaux : tes armées ne peuvent plus en partir. ' +
          'Relie-le à un château (clique sur ton château isolé pour lancer un assaut de jonction) ou bâtis-en un nouveau.',
          'Your territory is cut off from all your castles: your armies can no longer leave it. ' +
          'Link it to a castle (click your isolated castle to launch a linking assault) or build a new one.');
      }
      return (target < 0 ? tr('Aucune terre libre à ta frontière.', 'No free land on your border.')
        : tr(`Tu n'as pas de frontière avec ${this.players[target].name}.`, `You have no border with ${this.players[target].name}.`)) +
        (building ? tr(' Ton avant-poste est encore en construction : ses soldats ne pourront attaquer qu\'une fois les travaux finis.', ' Your outpost is still being built: its soldiers can only attack once the works are done.') : '');
    }
    // Un royaume qui a encore une ville (un château) ne s'attaque qu'en visant un de ses bâtiments (voir isProtected).
    // Sans château, il est désorganisé : on peut attaquer tout son territoire de front (comme une terre libre),
    // ou viser quand même une de ses églises ou un de ses ports (pour prendre sa zone d'un coup) ;
    // ses avant-postes, eux, se visent toujours. (Avec une citadelle, on peut faire les deux à la fois.)
    // castle = bâtiment visé par l'assaut (château, église, port ou avant-poste)
    // unlinked = cases d'un morceau coupé de tous ses châteaux (voir isUnlinked) : attaque de front, sans défenseurs
    let castle = -1, path = null, unlinked = null, front = frontier;
    const buildingAim = aimTile !== undefined && TARGET_TYPES.includes(this.building[aimTile]) && this.owner[aimTile] === target;
    if (target >= 0 && (this.isProtected(target) || buildingAim)) {
      const name = this.players[target].name, b = aimTile !== undefined ? this.building[aimTile] : 0;
      if (TARGET_TYPES.includes(b) && this.owner[aimTile] === target) castle = this.anchor[aimTile];
      else if (aimTile !== undefined && this.owner[aimTile] === target) unlinked = this.unlinkedPiece(aimTile);
      if (castle < 0 && !unlinked) {
        return tr(`${name} est protégé : clique sur un de ses châteaux, églises, ports, mines ou avant-postes pour lancer un assaut ` +
          '(ou sur un morceau de son royaume coupé de tous ses châteaux).', `${name} is protected: click one of their castles, churches, ports, mines or outposts to launch an assault ` +
          '(or a piece of their kingdom cut off from all their castles).');
      }
      // Ville, église ou port qui vient d'être conquis : on ne peut pas l'attaquer tout de suite
      const truce = castle >= 0 ? this.truceLeft(castle) : 0;
      if (truce > 0) return tr(`${this.targetLabel(castle)[0].toUpperCase()}${this.targetLabel(castle).slice(1)} vient de changer de mains : ` +
        `impossible de l'attaquer avant ${Math.ceil(truce)} s.`, `${this.targetLabel(castle)[0].toUpperCase()}${this.targetLabel(castle).slice(1)} has just changed hands: ` +
        `it cannot be attacked for ${Math.ceil(truce)} s.`);
      if (unlinked) {
        front = frontier.filter(t => unlinked.has(t));
        if (!front.length) return tr('Tu ne touches pas ce morceau de son royaume : impossible de l\'attaquer d\'ici.', 'You do not touch this piece of their kingdom: it cannot be attacked from here.');
      }
    }
    // Assauts déjà en cours contre ce royaume : on renforce celui qui vise la même cible ; sinon on en lance
    // un nouveau, s'il en reste (1 à la fois, 2 avec une citadelle)
    const running = this.attacks.filter(a => !a.done && a.attacker === pid && a.target === target && a.link === undefined
      && this.sourceOfAttack(a) === source && a.retreatEnd === undefined // (une armée en retraite ne reçoit plus de renforts)
      && a.viking === undefined); // (ni un assaut viking, venu par la mer)
    let a = running.find(a => a.targetCastle === castle && (castle >= 0 || !a.limitZone || a.limitZone.has(aimTile)));
    if (!a && running.length >= this.maxAssaults(pid)) {
      return tr(`Un assaut contre ${this.players[target].name} est déjà en cours.`, `An assault against ${this.players[target].name} is already under way.`) +
        (this.maxAssaults(pid) < CONFIG.CITADEL_ASSAULTS ? tr(' (Avec une citadelle, un château de niveau 3, tu pourrais en lancer 2 à la fois.)', ' (With a citadel, a level 3 castle, you could launch 2 at once.)') : '');
    }
    if (castle >= 0) {
      const name = this.players[target].name;
      path = this.castlePath(pid, castle, source);
      if (!path) {
        return frontier.length ? tr(`Impossible d'atteindre ${this.targetLabel(castle)} : ` +
          `des fortifications ${this.deName(name)} bloquent le passage. Prends d'abord les châteaux de la frontière.`,
          `Cannot reach ${this.targetLabel(castle)}: ${name}'s fortifications block the way. First take the border castles.`)
          : tr(`Impossible d'atteindre ${this.targetLabel(castle)} : tu n'as pas de frontière avec ${name} (ni de fleuve à passer à gué jusqu'à lui).`,
            `Cannot reach ${this.targetLabel(castle)}: you have no border with ${name} (nor a river to ford up to it).`);
      }
      if (!front.length) front = [path[0]]; // (de l'autre côté d'un fleuve : l'armée commence par sa rive)
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
      else if (target >= 0 && castle < 0) a.disorganized = true; // (royaume sans château : attaque de front)
      if (target >= 0) {
        // Contre un royaume, l'armée part de sa cité la plus proche (ou de son avant-poste) et marche
        // sur ses propres terres jusqu'à la frontière : tout le monde la voit venir
        this.aimArrow(a, front, aimTile);
        // Assaut sur un château (une église…) : l'armée entre chez l'ennemi là où commence son chemin ;
        // elle marche jusque-là depuis sa cité la plus proche (et la flèche part de là)
        if (path) this.entryFromPath(a, path, source);
        const secs = this.startMarch(a, a.startTile, troops);
        if (this.players[target].isHuman) {
          const alone = castle >= 0 && this.building[castle] === B_OUTPOST;
          UI.log(tr(`⚠️ L'armée ${this.deName(p.name)} (${fmt(troops)} soldats) marche vers ta frontière : elle attaque dans ${secs} s ! `,
            `⚠️ ${p.name}'s army (${fmt(troops)} soldiers) is marching to your border: it attacks in ${secs} s! `) +
            (unlinked ? tr('Il vise ton territoire coupé de tous tes châteaux : personne ne peut le défendre !', 'It targets your territory cut off from all your castles: no one can defend it!')
              : alone ? tr('Il vise ton avant-poste : seuls les soldats débarqués le défendront.', 'It targets your outpost: only the landed soldiers will defend it.')
              : !this.isProtected(target) ? tr('Sans ville ni port fortifié, toutes tes troupes défendront d\'office, désorganisées.', 'With no city or fortified port, all your troops will defend automatically, disorganized.')
              : tr('Dès qu\'elle entre sur tes terres, clique sur sa bannière ou sur « Défendre » pour envoyer tes soldats.', 'As soon as it enters your land, click its banner or "Defend" to send your soldiers.')), 'warn', p);
        }
      }
      this.attacks.push(a);
    }
    a.list = front;
    a.set = new Set(front);
    if (unlinked) a.limitZone = unlinked; // (l'assaut reste dans ce morceau)
    if (castle >= 0 && !a.castleTaken) {
      a.pathTiles = path; // (pour savoir si un mur vient couper sa route, voir stepWalls)
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

  // Pour un assaut sur le château (ou l'église) c : peut-on passer par cette case ? Oui si elle est au
  // défenseur et n'est pas protégée par un de ses AUTRES châteaux (la zone du château visé, elle, est passable,
  // mais castlePath arrête le chemin à sa muraille : on l'assiège depuis là).
  castlePassable(c) {
    const target = this.owner[c], isCastle = this.building[c] === B_CASTLE;
    const R = isCastle ? this.castleInfo(c).radius : 0;
    const others = this.castles.filter(o => o !== c && this.owner[o] === target);
    return i => {
      if (this.owner[i] !== target || this.wallAt[i]) return false; // (aucun assaut ne franchit un mur)
      const x = i % this.W, y = (i / this.W) | 0;
      if (isCastle && this.inCastleRange(c, x, y, R)) return true;
      if (this.anchor[i] === c) return true; // le bâtiment visé lui-même
      return !others.some(o => this.inCastleRange(o, x, y, this.castleInfo(o).radius));
    };
  },

  // Chemin le plus court de la frontière de pid jusqu'au château c, en contournant les
  // autres fortifications du défenseur. Renvoie la liste des cases, ou null s'il n'y en a pas.
  // Le chemin préfère les terrains faciles (plaines) : chaque case « coûte » sa défense.
  // Pour un château : le chemin s'arrête à sa muraille (la première case dans son rayon) : l'armée ne la
  // traverse pas, elle l'assiège depuis là (voir step).
  // L'armée part de la ville (château) la plus proche de l'objectif (ou de son avant-poste) : le point d'entrée
  // chez l'ennemi est choisi en comptant aussi sa marche sur ses propres terres depuis cette ville (plus rapide,
  // MARCH_OWN_LAND_BONUS), et pas seulement le bout de frontière le plus proche de la cible.
  castlePath(pid, c, source) {
    const passable = this.castlePassable(c), foot = new Set(this.footprint(c, this.building[c]));
    const h = this.sizeOf(this.building[c]) / 2;
    const dep = this.departurePoint(pid, c % this.W + h, ((c / this.W) | 0) + h, source), W = this.W;
    // La marche jusqu'au point d'entrée compte le VRAI chemin sur nos terres depuis la ville de départ (relief, fleuves,
    // détours autour d'un lac ou des terres ennemies), pas la distance à vol d'oiseau : sinon l'armée pourrait choisir
    // une entrée « proche » sur la carte, mais qu'elle n'atteint qu'en faisant tout le tour. (Une case qu'on ne peut
    // pas rejoindre à pied compte 3 fois sa distance à vol d'oiseau.)
    const field = this.ownLandField(pid, Math.floor(dep.y) * W + Math.floor(dep.x));
    const walk = i => (field(i) < Infinity ? field(i) : 3 * Math.hypot(i % W + 0.5 - dep.x, ((i / W) | 0) + 0.5 - dep.y))
      / CONFIG.MARCH_OWN_LAND_BONUS;
    // (-1 = on part de la frontière ; true : on peut passer un fleuve à gué pour l'atteindre)
    return this.stopAtWalls(c, this.searchPath(pid, -1, foot, passable, this.owner[c], source, walk, true));
  },
  // Un chemin vers le château c s'arrête à sa muraille (on l'assiège depuis là) ; de même à la petite muraille
  // d'un port fortifié
  stopAtWalls(c, path) {
    if (path && this.building[c] === B_CASTLE) {
      const k = path.findIndex(i => this.inWalls(c, i));
      if (k >= 0) path.length = k + 1;
    }
    if (path && this.walledPort(c)) {
      const k = path.findIndex(i => this.inPortWalls(c, i));
      if (k >= 0) path.length = k + 1;
    }
    return path;
  },

  // La case i est-elle dans la muraille (le rayon) du château c ?
  inWalls(c, i) { return this.inCastleRange(c, i % this.W, (i / this.W) | 0, this.castleInfo(c).radius); },

  // Recherche du chemin le plus facile (algorithme de Dijkstra) depuis la case from
  // (ou depuis toute la frontière de pid si from = -1) jusqu'à une case de goal.
  // walk (facultatif) : coût de la marche sur nos terres jusqu'à la case de départ i (voir castlePath)
  searchPath(pid, from, goal, passable, target, source, walk, allowFord = false) {
    const dist = new Float64Array(this.N).fill(Infinity), prev = new Int32Array(this.N).fill(-2);
    const done = new Uint8Array(this.N); // cases déjà traitées (chacune une seule fois)
    const heap = new MinHeap();
    const start = (i, extra = 0) => {
      const d = this.tileDefense(target, i) + extra;
      if (d < dist[i]) { dist[i] = d; prev[i] = -1; heap.push(d, i); }
    };
    if (allowFord) this.riverTiles(); // (prépare riverSide)
    if (from >= 0) start(from);
    else {
      // départ : les cases passables qui touchent nos terres (on part de nos cases, bien moins nombreuses que la carte)
      const W = this.W, N = this.N, own = this.owner;
      for (let i = 0; i < N; i++) {
        if (own[i] !== pid) continue;
        const x = i % W;
        let ok;
        for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
          if (n < 0 || own[n] === pid || (!walk && prev[n] !== -2) || !passable(n)) continue;
          if (ok === undefined) ok = source === undefined ? this.isBase(i) : this.sourceOf(i) === source;
          if (!ok) break;
          start(n, walk ? walk(i) : 0);
        }
        // (un fleuve entre nos terres et les siennes : l'armée le passe à gué, lentement ; ça « coûte » FORD_PATH_COST
        //  par case de fleuve, pour préférer un passage par la terre ou un pont quand il y en a un)
        if (allowFord && this.riverSide[i]) {
          this.fordAcross(i, pid, (n, gap, bridged) => {
            if (ok === undefined) ok = source === undefined ? this.isBase(i) : this.sourceOf(i) === source;
            if (ok) start(n, (walk ? walk(i) : 0) + (bridged ? gap : gap * CONFIG.FORD_PATH_COST));
          }, n => own[n] !== pid && passable(n));
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
      // (un fleuve au milieu de ses terres : l'armée le passe à gué, lentement, comme au départ)
      if (allowFord && this.riverSide[i]) {
        this.fordAcross(i, pid, (n, gap, bridged) => {
          const nd = d + this.tileDefense(target, n) + (bridged ? gap : gap * CONFIG.FORD_PATH_COST);
          if (nd < dist[n]) { dist[n] = nd; prev[n] = i; heap.push(nd, n); }
        }, n => !done[n] && passable(n));
      }
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
    return this.targetsOf(target).filter(a => !this.truceLeft(a)).sort((a, b) => d(a) - d(b)).slice(0, 3);
  },

  // Îlots imprenables : sur un îlot (moins de MIN_SPAWN_LAND cases), si un royaume y tient des terres mais qu'aucun
  // ennemi ne peut plus y débarquer (plus aucune place de 2x2 cases libres, hors de toute muraille, pour un avant-poste),
  // personne ne pourrait jamais l'en chasser : ses terres sur l'îlot disparaissent (elles redeviennent libres, avec
  // leurs bâtiments détruits). S'il n'avait plus que ça, il est anéanti. (vérifié une fois par seconde)
  stepTinyIslands() {
    if (this.tick % CONFIG.TICKS_PER_SECOND !== 0) return;
    const size = this.landSize(), comp = this.landComp(), W = this.W, own = this.owner;
    const islets = new Map(); // numéro de l'îlot → ses cases
    for (let i = 0; i < this.N; i++) {
      if (own[i] < 0 || size[i] >= CONFIG.MIN_SPAWN_LAND) continue;
      if (!islets.has(comp[i])) islets.set(comp[i], []);
    }
    if (!islets.size) return;
    for (let i = 0; i < this.N; i++) if (comp[i] >= 0 && islets.has(comp[i])) islets.get(comp[i]).push(i);
    // (une case où un ennemi pourrait poser le pied : de la terre, pas un fleuve, sans bâtiment ni mur, hors des murailles)
    const free = j => this.isLand(j) && this.terrain[j] !== TERRAIN.RIVER && !this.building[j] && !this.wallAt[j]
      && (own[j] < 0 || !(this.castleProtects(own[j], j) || this.portBonus(own[j], j) > 0));
    for (const tiles of islets.values()) {
      if (tiles.some(t => t % W < W - 1 && free(t) && free(t + 1) && free(t + W) && free(t + W + 1))) continue;
      const losers = new Set();
      for (const t of tiles) {
        const o = own[t];
        if (o < 0) continue;
        losers.add(o);
        if (this.building[t] && this.anchor[t] === t) this.removeBuilding(t);
      }
      for (const t of tiles) if (own[t] >= 0) this.setOwner(t, -1);
      this.version++;
      for (const o of losers) {
        if (this.players[o].isHuman) UI.log(tr('🌊 Ton îlot est trop petit pour qu\'on puisse y débarquer : tes terres y disparaissent.', '🌊 Your islet is too small for anyone to land on: your land there disappears.'), 'warn');
      }
    }
  },

  // Une ville (château), une église ou un port qui vient d'être conquis ne peut pas être attaqué pendant
  // CAPTURE_TRUCE secondes. Renvoie les secondes qui restent (0 = on peut l'attaquer).
  truceLeft(a) {
    const end = this.truces.get(a);
    if (end === undefined) return 0;
    if (this.tick >= end) { this.truces.delete(a); return 0; }
    return (end - this.tick) / CONFIG.TICKS_PER_SECOND;
  },
  startTruce(a) { this.truces.set(a, this.tick + CONFIG.CAPTURE_TRUCE * CONFIG.TICKS_PER_SECOND); },

  // Pour les bots : quel château viser, et quelle défense de terrain attendre au premier combat ?
  // castle : null = pas de château (attaque de front), -1 = aucun atteignable, sinon le château.
  // (gardé 2 secondes en mémoire : chercher les chemins coûte cher sur une grande carte)
  planAssault(pid, target) {
    if (!this.isProtected(target)) return { castle: null, D: 1.3 };
    const key = pid * 1000 + target, old = (this.assaultPlans = this.assaultPlans || new Map()).get(key);
    if (old && this.tick - old.tick < 2 * CONFIG.TICKS_PER_SECOND && (old.plan.castle === null || old.plan.castle < 0 || this.owner[old.plan.castle] === target)) return old.plan;
    const plan = this.computeAssaultPlan(pid, target);
    this.assaultPlans.set(key, { tick: this.tick, plan });
    return plan;
  },
  computeAssaultPlan(pid, target) {
    // Un morceau de son royaume, coupé de tous ses châteaux, touche nos terres : proie facile (personne ne le défend)
    const loose = this.hasUnlinked(target) ? this.buildFrontier(pid, target, -1).find(t => this.isUnlinked(t)) : undefined;
    if (loose !== undefined) return { castle: null, D: this.tileDefense(target, loose), tile: loose };
    const castles = this.nearestTargets(pid, target);
    let best = { castle: -1, D: 1 }, bestLen = Infinity;
    for (const c of castles) {
      const path = this.castlePath(pid, c, -1); // (depuis le royaume, comme l'assaut que le bot lancera)
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
    if (!this.isProtected(target)) return null;
    const castles = this.nearestTargets(pid, target);
    let best = -1, bestLen = Infinity;
    for (const c of castles) {
      const path = this.castlePath(pid, c, -1);
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
    const passable = i => this.owner[i] === o && !this.wallAt[i] && !this.castleProtects(o, i);
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

  // La ligne d'un assaut de jonction part de l'endroit où l'armée entre chez l'ennemi (la case de nos terres
  // à côté du début de son chemin), pas du milieu du royaume
  linkEntry(a, first) {
    let edge = -1;
    this.forNeighbors(first, n => { if (edge < 0 && this.owner[n] === a.attacker) edge = n; });
    const t = edge >= 0 ? edge : first;
    a.fromX = t % this.W + 0.5;
    a.fromY = ((t / this.W) | 0) + 0.5;
  },

  // Un assaut de jonction vers ce château est-il déjà lancé ?
  linkFor(c) { return this.attacks.find(a => !a.done && a.link === c && a.retreatEnd === undefined); },

  // Lance un assaut de jonction vers son château isolé c. Renvoie un message d'erreur, ou null.
  launchLink(pid, c, troops) {
    const p = this.players[pid];
    troops = Math.floor(Math.min(troops, p.troops));
    if (this.owner[c] !== pid || !this.holdsAlone(c) || !this.isIsolated(c)) return tr('Ce bâtiment n\'est pas coupé de ton royaume.', 'This building is not cut off from your kingdom.');
    if (troops < 1) return tr('Pas assez de soldats !', 'Not enough soldiers!');
    let a = this.linkFor(c);
    if (a) {
      p.troops -= troops;
      // Pendant la préparation, les soldats s'ajoutent tout de suite ; ensuite, ce sont des renforts
      if (this.isPreparing(a)) a.troops += troops;
      else a.pending.push({ troops, tick: this.tick + this.reinforceTicks(a) });
      return null;
    }
    const route = this.linkRoute(pid, c);
    if (!route) return tr('Impossible de le rejoindre : des murailles ennemies bloquent le passage.', 'Cannot reach it: enemy walls block the way.');
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
    this.linkEntry(a, route.path[0]);
    a.list = this.buildFrontier(pid, route.target);
    a.set = new Set(a.list);
    a.limitZone = this.corridor(c, route.path, route.passable);
    p.troops -= troops;
    this.attacks.push(a);
    if (this.players[route.target].isHuman) {
      UI.log(tr(`⚠️ ${p.name} prépare un assaut à travers tes terres pour rejoindre son ${this.building[c] === B_PORT ? 'port' : 'château'} isolé (${fmt(troops)} soldats) !`,
        `⚠️ ${p.name} is preparing an assault across your land to reach their isolated ${this.building[c] === B_PORT ? 'port' : 'castle'} (${fmt(troops)} soldiers)!`), 'warn', p);
    }
    return null;
  },

  // L'assaut de jonction a rejoint son château : la route s'élargit un peu,
  // et ses soldats rejoignent la défense du château
  linkArrives(a) {
    a.won = true; // (objectif atteint : la route reste à l'attaquant)
    this.regionsCache = null; // (sa route n'est plus « en cours » : la coupe s'applique, voir regions)
    const c = a.link, p = this.players[a.attacker], R = CONFIG.LINK_WIDEN_RADIUS;
    // La route s'élargit : on prend les terres ennemies proches des cases vraiment prises (hors murailles,
    // et sans bâtiment : ceux-là se prennent en les visant)
    for (const t of a.route || []) {
      const tx = t % this.W, ty = (t / this.W) | 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = tx + dx, y = ty + dy;
          if (x < 0 || y < 0 || x >= this.W || y >= this.H || Math.abs(dx) + Math.abs(dy) > R) continue;
          const i = y * this.W + x;
          if (this.owner[i] !== a.target || !this.isLand(i) || this.castleProtects(a.target, i)) continue;
          if (this.building[i]) continue;
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
    if (p.isHuman) UI.log(tr(`🏰 Ton château isolé est de nouveau relié à ton royaume${siege ? ' : tes soldats rejoignent sa défense !' : ' !'}`,
      `🏰 Your isolated castle is linked to your kingdom again${siege ? ': your soldiers join its defense!' : '!'}`), 'good');
    else if (siege && this.players[siege.attacker].isHuman) {
      UI.log(tr(`🏰 ${p.name} a rejoint le château que tu attaques : ses soldats renforcent la défense !`, `🏰 ${p.name} has reached the castle you are attacking: their soldiers reinforce the defense!`), 'warn', p);
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
  // un débarquement ne prend jamais un bâtiment, il se pose à côté. Jamais dans la muraille d'une ville ou d'un
  // port fortifié (on ne la franchit pas : il faut l'assiéger), ni sur un mur.
  landable(pid, j) {
    const o = this.owner[j];
    if (!this.isLand(j) || this.building[j] || o === pid || (o >= 0 && this.areAllied(pid, o)) || this.wallAt[j]) return false;
    return o < 0 || !(this.castleProtects(o, j) || this.portBonus(o, j) > 0);
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
    if (!ports.length) return { error: tr('Il te faut un port de niveau 2 pour les expéditions maritimes.', 'You need a level 2 port for naval expeditions.') };
    if (!this.landable(pid, i) || !this.isCoastal(i)) {
      return { error: tr('On débarque sur une côte (au bord de la mer ou d\'un fleuve) qui n\'est ni à toi ni à un allié, à côté des bâtiments.', 'You land on a coast (on the shore of the sea or a river) that belongs neither to you nor to an ally, away from buildings.') };
    }
    if (this.expeditions.some(e => e.pid === pid && e.landing === i && e.home === undefined)) return { error: tr('Une expédition est déjà en route vers cette côte.', 'An expedition is already on its way to this coast.') };
    // Pas plus de MAX_SEA_ASSAULTS débarquements à la fois chez un même royaume (en mer ou avant-postes déjà plantés)
    const o = this.owner[i];
    if (o >= 0 && this.seaAssaultsOn(pid, o) >= CONFIG.MAX_SEA_ASSAULTS) {
      return { error: tr(`Tu as déjà ${CONFIG.MAX_SEA_ASSAULTS} débarquements chez ${this.players[o].name} (en mer ou avant-postes) : pas plus à la fois.`,
        `You already have ${CONFIG.MAX_SEA_ASSAULTS} landings at ${this.players[o].name}'s (at sea or outposts): no more at once.`) };
    }
    const zone = this.landingZone(pid, i);
    if (zone.anchor < 0) return { error: tr('Pas assez de place sur cette côte pour un avant-poste.', 'Not enough room on this coast for an outpost.') };
    // Le port le plus rapide pour y aller
    let best = null;
    for (const a of ports) {
      const path = this.boatPath(a, i);
      if (!path) continue;
      const time = path.length / this.buildingInfo(a).boatSpeed; // en secondes
      if (!best || time < best.time) best = { port: a, path, time };
    }
    if (!best) return { error: tr('Aucun de tes ports ne peut rejoindre cette côte par l\'eau.', 'None of your ports can reach this coast by water.') };
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
    if (!o || this.owner[a] !== pid) return tr('Ce n\'est pas un de tes avant-postes.', 'This is not one of your outposts.');
    if (!this.outpostReady(a)) return tr('L\'avant-poste est encore en construction : ses soldats bâtissent.', 'The outpost is still being built: its soldiers are building it.');
    const troops = Math.floor(o.stationed);
    if (troops < 1) return tr('Aucun soldat n\'attend à cet avant-poste (sa garnison, elle, reste sur place).', 'No soldiers are waiting at this outpost (its garrison stays there).');
    const best = this.homePort(pid, o.landing);
    if (!best) return tr('Aucun de tes ports n\'est relié par l\'eau à cet avant-poste.', 'None of your ports is linked by water to this outpost.');
    o.stationed -= troops;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: o.landing, home: best.port,
      path: best.path.slice().reverse(), sent: troops,
      troops: troops * (1 - this.seaLoss(best.time)),
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(best.time * TPS)) });
    return null;
  },

  // Port de pid le plus rapide à rejoindre depuis la côte `landing` : { port, path, time }, ou null
  homePort(pid, landing) {
    let best = null;
    for (const b of this.buildingTiles) {
      if (this.building[b] !== B_PORT || this.owner[b] !== pid) continue;
      const path = this.boatPath(b, landing);
      if (!path) continue;
      const time = path.length / Math.max(this.buildingInfo(b).boatSpeed, CONFIG.REPATRIATE_SPEED);
      if (!best || time < best.time) best = { port: b, path, time };
    }
    return best;
  },

  // Abandonner un de ses avant-postes : il disparaît (ses terres restent au royaume), et tous ses soldats
  // (garnison comprise) rembarquent tout seuls vers le port le plus proche ; sans port relié par l'eau,
  // ils rentrent quand même (comme ramenés par un navire marchand). Renvoie un message d'erreur, ou le nombre de soldats.
  abandonOutpost(pid, a) {
    const o = this.outposts.get(a);
    if (!o || this.owner[a] !== pid) return tr('Ce n\'est pas un de tes avant-postes.', 'This is not one of your outposts.');
    if (this.attacks.some(x => !x.done && x.target === pid && x.targetCastle === a)) return tr('Ton avant-poste est attaqué : impossible de l\'abandonner maintenant.', 'Your outpost is under attack: it cannot be abandoned now.');
    const troops = Math.floor(this.garrison[a] + o.stationed), landing = o.landing;
    this.removeBuilding(a);
    if (troops < 1) return 0;
    const home = this.homePort(pid, landing), TPS = CONFIG.TICKS_PER_SECOND;
    if (!home) { this.players[pid].troops += troops; return troops; }
    this.expeditions.push({ id: this.nextAttackId++, pid, landing, home: home.port,
      path: home.path.slice().reverse(), sent: troops, troops: troops * (1 - this.seaLoss(home.time)),
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(home.time * TPS)) });
    return troops;
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
      return tr('⛵ Tes bateaux ne sont pas encore prêts.', '⛵ Your ships are not ready yet.');
    }
    if (p.gold < plan.cost) return tr(`Pas assez d'or pour l'expédition (💰 ${plan.cost}).`, `Not enough gold for the expedition (💰 ${plan.cost}).`);
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < plan.minTroops) {
      return tr(`Il faut au moins ${plan.minTroops} soldats pour l'expédition : de quoi remplir la garnison ` +
        'de l\'avant-poste (pertes en mer comprises).', `You need at least ${plan.minTroops} soldiers for the expedition: enough to fill the outpost's ` +
        'garrison (losses at sea included).');
    }
    p.gold -= plan.cost;
    p.troops -= troops;
    p.lastExpedition = this.tick;
    const TPS = CONFIG.TICKS_PER_SECOND;
    this.expeditions.push({ id: this.nextAttackId++, pid, landing: i, victim: this.owner[i], path: plan.path, cost: plan.cost, sent: troops,
      troops: troops * (1 - this.seaLoss(plan.time)), // ceux qui arriveront
      start: this.tick, arrive: this.tick + Math.max(TPS, Math.round(plan.time * TPS)) });
    // Prévenir les royaumes dont la côte est visée
    const o = this.owner[i];
    if (o >= 0 && this.players[o].isHuman) {
      UI.log(tr(`⛵ ${p.name} envoie une expédition vers ta côte ! Tiens-toi prêt à attaquer son avant-poste quand elle accostera.`,
        `⛵ ${p.name} is sending an expedition to your coast! Be ready to attack their outpost when it lands.`), 'warn', p);
    }
    return null;
  },

  // Débarquements de pid chez le royaume o : ses expéditions en mer vers lui, et ses avant-postes plantés chez lui
  seaAssaultsOn(pid, o) {
    let n = 0;
    for (const e of this.expeditions) if (!e.done && e.pid === pid && e.home === undefined && !e.reinforce && e.victim === o) n++;
    for (const [a, op] of this.outposts) if (this.owner[a] === pid && op.victim === o) n++;
    return n;
  },

  // Faire rentrer une de ses expéditions en mer (débarquement ou renforts) : comme une retraite, le bateau fait
  // demi-tour là où il est et rentre au port (aussi long que le chemin déjà fait), et RETREAT_LOSS des
  // soldats à bord se perdent. Ceux qui restent rejoignent l'armée en arrivant. (L'or n'est pas rendu.)
  recallExpedition(pid, id) {
    const e = this.expeditions.find(x => x.id === id && !x.done && x.pid === pid && x.home === undefined);
    if (!e || this.tick >= e.arrive) return null;
    const k = Math.min(1, (this.tick - e.start) / Math.max(1, e.arrive - e.start));
    const idx = Math.min(e.path.length - 1, Math.floor(k * e.path.length));
    const aboard = e.sent - (e.sent - e.troops) * k; // (les pertes en mer déjà subies)
    e.troops = e.sent = aboard * (1 - CONFIG.RETREAT_LOSS);
    e.reinforce = undefined;
    e.viking = undefined;
    e.home = e.port !== undefined ? e.port : e.path[0];
    e.path = e.path.slice(0, idx + 1).reverse();
    const back = Math.max(1, this.tick - e.start);
    e.start = this.tick;
    e.arrive = this.tick + back;
    e.recalled = true;
    return e;
  },

  // --- Traversée de fleuve ---
  // Pour prendre des terres libres de l'autre côté d'un fleuve (pas le grand fleuve, infranchissable) :
  // l'armée part de ses terres, passe le fleuve à gué (lentement) et prend une tête de pont sur l'autre rive.
  // Renvoie { path, river, time } (path : de nos terres jusqu'à la case visée i) ou { error }.
  planCrossing(pid, i) {
    if (this.owner[i] !== -1 || !this.isLand(i) || this.terrain[i] === TERRAIN.RIVER) {
      return { error: tr('Il faut viser une terre libre, de l\'autre côté du fleuve.', 'Aim at free land on the other side of the river.') };
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
    return { error: tr('Pas de gué ici : il faut un fleuve entre tes terres et cette terre libre (le grand fleuve, lui, est infranchissable).', 'No ford here: there must be a river between your land and this free land (the great river cannot be crossed).') };
  },

  // Lance une traversée de fleuve vers la terre libre i. Renvoie un message d'erreur, ou null.
  // Traverser ne coûte aucun soldat : seulement du temps (CROSSING_TIME_FIRST / CROSSING_TIME_NEXT).
  launchCrossing(pid, i) {
    const p = this.players[pid], TPS = CONFIG.TICKS_PER_SECOND;
    // (une seule traversée toutes les CROSSING_COOLDOWN secondes)
    const wait = p.lastCrossing === undefined ? 0 : (p.lastCrossing + CONFIG.CROSSING_COOLDOWN * TPS - this.tick) / TPS;
    if (wait > 0) return tr(`Tes soldats préparent la prochaine traversée : encore ${Math.ceil(wait)} s.`, `Your soldiers are preparing the next crossing: ${Math.ceil(wait)} s left.`);
    const plan = this.planCrossing(pid, i);
    if (plan.error) return plan.error;
    p.lastCrossing = this.tick;
    this.crossings.push({ pid, target: i, path: plan.path, start: this.tick,
      arrive: this.tick + Math.max(1, Math.round(plan.time * TPS)) });
    return null;
  },

  // Arrivée des traversées : on prend une tête de pont sur l'autre rive (le fleuve, lui, reste neutre).
  // Si quelqu'un a pris le passage entre-temps, la traversée échoue (elle ne coûte pas de soldats).
  stepCrossings() {
    for (const c of this.crossings) {
      if (this.tick < c.arrive) continue;
      c.done = true;
      const p = this.players[c.pid];
      if (!p.alive) continue;
      const blocked = c.path.slice(1).some(t => this.terrain[t] !== TERRAIN.RIVER && this.owner[t] !== -1 && this.owner[t] !== c.pid);
      if (blocked || this.owner[c.path[0]] !== c.pid) {
        if (p.isHuman) UI.log(tr('🚫 Le passage du fleuve a été pris par un autre : la traversée échoue.', '🚫 The river crossing was taken by someone else: the crossing fails.'), 'warn');
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
      if (p.isHuman) UI.log(tr('🛶 Tes soldats ont traversé le fleuve : la terre de l\'autre rive est à toi !', '🛶 Your soldiers have crossed the river: the land on the other bank is yours!'), 'good');
    }
    this.crossings = this.crossings.filter(c => !c.done);
  },

  // Les bateaux arrivés débarquent : ils prennent les terres autour (libres ou ennemies) et y bâtissent un avant-poste
  stepExpeditions() {
    // Renforts en mer vers un avant-poste qui n'existe plus : demi-tour vers leur port (même trajet en sens
    // inverse, aussi long que le chemin déjà fait) ; en arrivant, ils rejoignent l'armée
    for (const e of this.expeditions) {
      if (e.reinforce === undefined || e.done || this.tick >= e.arrive) continue;
      if (this.building[e.reinforce] === B_OUTPOST && this.owner[e.reinforce] === e.pid) continue;
      const k = Math.min(1, (this.tick - e.start) / Math.max(1, e.arrive - e.start));
      const idx = Math.min(e.path.length - 1, Math.floor(k * e.path.length));
      const back = Math.max(1, this.tick - e.start);
      e.troops = e.sent = e.sent - (e.sent - e.troops) * k; // (soldats encore à bord)
      e.reinforce = undefined;
      e.home = e.port;
      e.path = e.path.slice(0, idx + 1).reverse();
      e.start = this.tick;
      e.arrive = this.tick + back;
      if (this.players[e.pid].isHuman) UI.log(tr('⛵ Ton avant-poste est tombé : tes renforts font demi-tour vers le port.', '⛵ Your outpost has fallen: your reinforcements turn back to port.'), 'warn');
    }
    for (const e of this.expeditions) {
      if (this.tick < e.arrive) continue;
      e.done = true;
      const p = this.players[e.pid];
      if (!p.alive) continue;
      // Soldats rapatriés d'un avant-poste : ils rejoignent l'armée
      if (e.home !== undefined) {
        p.troops += e.troops;
        if (p.isHuman) UI.log(tr(`🚢 ${fmt(e.troops)} soldats rapatriés sont rentrés au port.`, `🚢 ${fmt(e.troops)} repatriated soldiers are back in port.`), 'good');
        continue;
      }
      // Assaut viking : l'armée débarque et marche sur sa cible
      if (e.viking !== undefined) { this.vikingLands(e); continue; }
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
          if (p.isHuman) UI.log(tr(`⛺ ${fmt(e.troops)} soldats renforcent ton avant-poste.`, `⛺ ${fmt(e.troops)} soldiers reinforce your outpost.`), 'good');
        } else {
          p.troops += e.troops;
          if (p.isHuman) UI.log(tr('⛵ Ton avant-poste n\'existe plus : les renforts rentrent.', '⛵ Your outpost no longer exists: the reinforcements head home.'), 'warn');
        }
        continue;
      }
      const zone = this.landingZone(e.pid, e.landing);
      if (!this.landable(e.pid, e.landing) || zone.anchor < 0) {
        p.gold += e.cost; // la côte n'est plus possible (prise par soi ou un allié, bâtie…) : l'or est rendu
        p.troops += e.troops; // et les soldats rentrent
        if (p.isHuman) UI.log(tr('⛵ Impossible de débarquer sur la côte visée : l\'expédition rentre (or et soldats rendus).', '⛵ Cannot land on the targeted coast: the expedition returns (gold and soldiers refunded).'), 'warn');
        continue;
      }
      const victims = new Set(zone.tiles.map(j => this.owner[j]).filter(o => o >= 0));
      for (const j of zone.tiles) this.setOwner(j, e.pid);
      for (const o of victims) {
        if (this.players[o].isHuman) UI.log(tr(`⛵ ${p.name} a débarqué sur ta côte et y a planté un avant-poste ! Vise-le pour le détruire.`, `⛵ ${p.name} has landed on your coast and set up an outpost! Target it to destroy it.`), 'warn', p);
      }
      this.placeBuilding(zone.anchor, B_OUTPOST);
      this.garrison[zone.anchor] = e.troops; // tous les soldats débarqués défendent l'avant-poste
      this.outposts.set(zone.anchor, { ready: this.tick + CONFIG.OUTPOST_BUILD_TIME * CONFIG.TICKS_PER_SECOND,
        landing: e.landing, stationed: 0, victim: e.victim === undefined ? -1 : e.victim }); // (chez qui il est planté)
      if (p.isHuman) {
        UI.log(tr(`⛺ Débarquement réussi ! ${fmt(e.troops)} soldats bâtissent ton avant-poste (affaiblis tant qu'il n'est pas bâti) ` +
          `(${fmt(e.sent - e.troops)} perdus en mer). Il sera bâti dans ${CONFIG.OUTPOST_BUILD_TIME} s.`,
          `⛺ Landing successful! ${fmt(e.troops)} soldiers are building your outpost (weakened until it is built) ` +
          `(${fmt(e.sent - e.troops)} lost at sea). It will be built in ${CONFIG.OUTPOST_BUILD_TIME} s.`), 'good');
        Render.floatText(zone.anchor, B_OUTPOST, tr('⛵ Débarquement !', '⛵ Landing!'));
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
    const base = n => (source >= 0 ? this.sourceOf(n) === source : this.isBase(n));
    this.forNeighbors(path[0], n => {
      if (entry >= 0 || this.owner[n] !== a.attacker) return;
      if (base(n)) entry = n;
    });
    // (pas de terre à nous juste à côté : le chemin commence de l'autre côté d'un fleuve, qu'on passe à gué)
    a.fordTime = 0;
    if (entry < 0) {
      this.riverTiles();
      this.fordAcross(path[0], a.attacker, (n, gap, bridged) => {
        if (entry >= 0 || !base(n)) return;
        entry = n;
        a.fordTime = bridged ? 0 : CONFIG.CROSSING_TIME_FIRST + (gap - 1) * CONFIG.CROSSING_TIME_NEXT;
      });
    }
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
  // de la frontière visée (ou de son avant-poste) et marche sur ses terres jusqu'à la case edge, par le chemin
  // le plus rapide (walkRoute) : vite en plaine, lentement dans le relief, et plus lentement si elle est grande
  // (comme les défenseurs : chez elle, elle marche 60 % plus vite qu'un assaut en terre ennemie). Pendant cette marche, les soldats en plus la
  // rejoignent tout de suite ; une fois chez l'ennemi, ce sont des renforts (avec délai).
  // Renvoie la durée de la marche (en secondes).
  startMarch(a, edge, troops = a.troops) {
    const W = this.W, TPS = CONFIG.TICKS_PER_SECOND, p = this.players[a.attacker];
    const to = edge >= 0 ? { x: edge % W + 0.5, y: ((edge / W) | 0) + 0.5 } : { x: p.sumX / p.tiles + 0.5, y: p.sumY / p.tiles + 0.5 };
    // (assaut sur un bâtiment : de la ville la plus proche de l'objectif, comme son chemin, voir castlePath)
    const c = a.targetCastle, h = c >= 0 ? this.sizeOf(this.building[c]) / 2 : 0;
    const ref = c >= 0 ? { x: c % W + h, y: ((c / W) | 0) + h } : to;
    const from = this.departurePoint(a.attacker, ref.x, ref.y, this.sourceOfAttack(a));
    const march = this.walkRoute(a.attacker, from, to, troops, CONFIG.MARCH_OWN_LAND_BONUS);
    march.arrive = Math.max(march.arrive, this.tick + Math.round(CONFIG.MARCH_MIN_TIME * TPS));
    // (un fleuve à passer à gué avant d'entrer chez l'ennemi : l'armée l'attend sur sa rive, c'est long)
    if (a.fordTime) march.arrive += Math.round(a.fordTime * TPS);
    a.march = march;
    a.marchFrom = from;
    a.startTick = march.arrive;
    a.prepTicks = a.startTick - this.tick;
    return Math.ceil(a.prepTicks / TPS);
  },

  // D'où part une armée de pid vers le point (x, y) : son avant-poste (source), sinon sa place forte (ville ou port fortifié) d'où
  // l'on arrive LE PLUS VITE à ce point en marchant (relief, fleuves, détours compris : voir fastestCity), sinon
  // (aucune ville n'y mène à pied) la plus proche à vol d'oiseau, sinon le cœur de son royaume. Renvoie le centre.
  departurePoint(pid, x, y, source) {
    const W = this.W, mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    if (source >= 0 && this.building[source] === B_OUTPOST) return mid(source);
    const start = Math.floor(y) * W + Math.floor(x), o = this.owner[start];
    const fast = this.fastestCity(pid, start, this.strongholds(pid, true), o !== pid ? o : -2);
    if (fast >= 0) return mid(fast);
    // (une ville sur la même terre que le point visé passe avant une ville de l'autre côté de la mer)
    const land = this.landComp(), here = land[Math.floor(y) * W + Math.floor(x)];
    let best = null, bestD = Infinity;
    for (const c of this.strongholds(pid, true)) {
      const m = mid(c), d = ((m.x - x) ** 2 + (m.y - y) ** 2) * (land[c] === here ? 1 : 100);
      if (d < bestD) { bestD = d; best = m; }
    }
    const p = this.players[pid];
    return best || { x: p.sumX / Math.max(1, p.tiles) + 0.5, y: p.sumY / Math.max(1, p.tiles) + 0.5 };
  },

  // Où en est la marche de l'armée (coordonnées en cases) : de sa cité vers la frontière, le long de son chemin
  marchPosition(a) { return this.walkPosition(a.march); },

  // Choisit une case du front, en préférant celles bien entourées (front plus régulier).
  // Le relief compte : une plaine est plus attirante qu'une montagne.
  pickFrontier(a) {
    let best = -1, bestScore = -1;
    for (let k = 0; k < 4 && a.list.length > 0; k++) {
      const idx = (Math.random() * a.list.length) | 0;
      const t = a.list[idx];
      let around = this.countFriendNeighbors(t, a.attacker);
      // (un assaut vers un objectif peut commencer de l'autre côté d'un fleuve, passé à gué : sa rive compte)
      if (!around && a.targetCastle >= 0 && this.riverSide[t]) this.fordAcross(t, a.attacker, () => { around = 1; });
      // (🔥 des Vikings prennent pied sur la côte où ils débarquent, depuis leurs bateaux)
      if (!around && a.viking === t) around = 1;
      const score = around / TERRAIN_INFO[this.terrain[t]].cost;
      // Un assaut vers un objectif ne sort pas de son couloir (limitZone)
      const outside = a.limitZone && !a.limitZone.has(t);
      // Un assaut de front ne prend pas de château ni d'avant-poste (il faut les viser, en cliquant dessus),
      // et ne passe pas les murailles : il s'arrête au pied du mur
      const castle = a.target >= 0 && a.targetCastle < 0 && a.link === undefined &&
        (this.building[t] === B_CASTLE || this.building[t] === B_OUTPOST || this.castleProtects(a.target, t));
      if (!a.set.has(t) || this.owner[t] !== a.target || around === 0 || outside || castle || this.wallAt[t]) {
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
  // Terres libres : quand l'élan de départ du recrutement retombe, elles coûtent moins de soldats d'autant
  // (jusqu'à 3 fois moins) : l'expansion en terre vierge garde le rythme du début, toute la partie.
  tileCost(a, t) {
    let n = a.troops;
    // (territoire désorganisé : au-delà de DISORGANIZED_LOSS_FROM soldats, les pertes par case n'augmentent plus)
    const M = CONFIG.DISORGANIZED_LOSS_FROM;
    if (n > M && a.target >= 0 && (a.unlinked || this.leaderless(a))) n = M;
    let loss = Math.max(CONFIG.NEUTRAL_TILE_COST, n * CONFIG.TILE_LOSS_RATE);
    if (a.viking !== undefined) loss /= 1 + CONFIG.VIKING_BONUS; // (🔥 des Vikings : +50 % de force)
    const free = a.target < 0 ? this.earlyBoost() / (1 + CONFIG.EARLY_GROWTH_BONUS) / CONFIG.FREE_LAND_BOOST : 1;
    return loss * TERRAIN_INFO[this.terrain[t]].cost * free;
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

  // Niveau de la meilleure caserne d'un royaume (0 s'il n'en a pas), et l'icône de ses troupes qui va avec :
  // deux épées (sans caserne ou niveau 1), + un casque (niveau 2), + un bouclier (niveau 3)
  troopLevel(pid) {
    let best = 0;
    for (const a of this.buildingTiles) {
      if (this.building[a] === B_BARRACKS && this.owner[a] === pid) best = Math.max(best, this.level[a] || 1);
    }
    return best;
  },
  troopIcon(pid) {
    const l = pid >= 0 ? this.troopLevel(pid) : 0;
    // (avec une cité impériale : une petite couronne sur le casque, au-dessus du bouclier)
    if (pid >= 0 && this.hasImperial(pid)) return '🏅';
    return l >= 3 ? '🎖' : l === 2 ? '🪖' : '⚔';
  },

  // Force des soldats d'un royaume : celle de sa meilleure caserne (1 sans caserne améliorée)
  troopPower(pid) {
    let best = 1;
    for (const a of this.buildingTiles) {
      if (this.building[a] === B_BARRACKS && this.owner[a] === pid) best = Math.max(best, this.buildingInfo(a).power);
    }
    // (une cité impériale rend toutes les troupes du royaume plus fortes)
    // (⚒ ses mines de fer aussi)
    if (pid >= 0) best *= 1 + this.mineBonus(pid, 'iron');
    // (🤖 en Difficile, les bots ont des soldats un peu plus forts)
    if (pid >= 0) best *= this.botBonus(this.players[pid], 'power');
    return pid >= 0 && this.hasImperial(pid) ? best * (1 + IMPERIAL.troopPower) : best;
  },

  // Combien d'attaquants tombent pour chaque défenseur tué : la défense de l'endroit,
  // corrigée par la force des soldats des deux camps (casernes de niveau 2 et 3)
  combatRatio(a) {
    let r = this.frontDefense(a) * this.troopPower(a.target) / this.troopPower(a.attacker);
    if (a.viking !== undefined) r /= 1 + CONFIG.VIKING_BONUS; // (🔥 des Vikings : +50 % de force)
    // Royaume sans château (ville) : ses troupes, désorganisées, ne comptent que pour 0.8
    if (this.leaderless(a)) r *= CONFIG.LEADERLESS_DEFENSE;
    // Armée bloquée dans ses châteaux isolés : elle les défend, mais moins bien
    else if (a.targetCastle >= 0 && this.building[a.targetCastle] === B_CASTLE && this.troopsInCastles(a.target)) r *= CONFIG.LEADERLESS_DEFENSE;
    return r;
  },

  // Assaut contre un royaume qui n'a plus de château (ville) : de front, ou sur une de ses églises ou un de ses ports
  // (pas sur un avant-poste : seuls les soldats débarqués le défendent)
  leaderless(a) {
    if (a.target < 0 || this.isProtected(a.target)) return false;
    return a.targetCastle < 0 || this.building[a.targetCastle] !== B_OUTPOST;
  },

  // Dernier carré : l'assaut vise un château d'un royaume dont tous les châteaux sont isolés (son armée y est
  // bloquée). Toutes ses troupes restantes le défendent d'office.
  lastStand(a) {
    const c = a.targetCastle;
    return a.target >= 0 && c >= 0 && this.building[c] === B_CASTLE && this.owner[c] === a.target && this.troopsInCastles(a.target);
  },

  // Un royaume sans château (ville) n'a plus de pouvoir en place : quand un assaut de front commence,
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
        UI.log(tr(`🏰 Ton dernier château est attaqué : tes ${fmt(p.troops)} soldats restants le défendent d'office !`, `🏰 Your last castle is under attack: your ${fmt(p.troops)} remaining soldiers defend it automatically!`), 'warn');
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
    a.defenders -= defLoss - fromGarrison;
    a.troops = Math.max(0, a.troops - defLoss * D * defBonus / atkBonus);
    if (a.troops < 1) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(tr(`💥 Ton assaut contre ${d.name} a été repoussé !`, `💥 Your assault against ${d.name} was repelled!`), 'warn', d);
      else if (d.isHuman) UI.log(tr(`🛡️ Tu as repoussé l'assaut de ${p.name} !`, `🛡️ You repelled ${p.name}'s assault!`), 'good', p);
      this.defenseRally(d);
      this.endAttack(a);
    } else if (a.defenders + a.garrison < 1) {
      a.defenders = 0;
      a.garrison = 0;
    }
  },

  // Les soldats qui sont dans le bâtiment visé par l'assaut a le défendent, même arrivés en cours de route
  // (avant, ils restaient dedans sans se battre, et mouraient avec lui à la fin du siège) :
  // - garnison déjà sortie se battre : ceux qui la rejoignent ensuite (renforts par la mer d'un avant-poste…)
  //   sortent aussi ;
  // - au siège d'un avant-poste : ses soldats stationnés (sur place) le défendent d'office ;
  // - au siège, sans plus personne pour défendre : la garnison qui se bat contre un autre assaut du même royaume
  //   sur le même bâtiment revient aux murs (elle défend contre l'armée qui est au pied des murs).
  rallyGarrison(a) {
    const c = a.targetCastle;
    if (c < 0 || this.owner[c] !== a.target) return;
    if (a.garrisonOut && this.garrison[c] >= 1) {
      a.garrison = (a.garrison || 0) + this.garrison[c];
      this.garrison[c] = 0;
    }
    if (!a.siege) return;
    const o = this.building[c] === B_OUTPOST ? this.outposts.get(c) : null;
    if (o && o.stationed >= 1) {
      a.defenders += o.stationed;
      a.defSource = c; // (à la fin de l'assaut, les survivants y retournent)
      o.stationed = 0;
    }
    if (a.defenders + (a.garrison || 0) >= 1) return;
    for (const b of this.attacks) {
      if (b === a || b.done || b.target !== a.target || b.targetCastle !== c || !(b.garrison >= 1)) continue;
      a.garrison = (a.garrison || 0) + b.garrison;
      b.garrison = 0;
      a.garrisonOut = true;
    }
  },

  // Garnison qui défendra contre l'assaut a : celle qui se bat déjà, ou celle qui attend derrière la muraille
  // du château visé (elle n'entre en jeu qu'au siège). Pour les bots, qui calculent combien de défenseurs envoyer.
  garrisonFor(a) { return (a.garrison || 0) + this.garrisonWaiting(a); },
  // Garnison du château visé qui attend encore derrière sa muraille (0 une fois sortie)
  garrisonWaiting(a) {
    const c = a.targetCastle;
    return !a.garrisonOut && c >= 0 && this.building[c] === B_CASTLE && this.owner[c] === a.target ? this.garrison[c] : 0;
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
    // L'armée ennemie marche encore sur ses propres terres : on ne peut la contrer qu'une fois entrée chez nous
    // (nos défenseurs ne vont jamais l'attendre en terre ennemie)
    if (this.isPreparing(a)) return null;
    // Dans la zone d'un avant-poste (pas encore reliée au royaume) : ce sont ses soldats stationnés qui défendent.
    // Château isolé : personne ne peut le rejoindre.
    let src = this.outpostZoneOf(a);
    if (src < 0 && this.cutOff(a)) return null;
    troops = Math.floor(Math.min(troops, this.troopsAt(pid, src)));
    if (troops < 1) return null;
    this.takeTroops(pid, src, troops);
    a.lastDefend = this.tick;
    if (src >= 0) a.defSource = src;
    // Une armée de défense est déjà partie (en route ou au combat) : ces soldats la renforcent, après un court
    // délai (DEFEND_REINFORCE_DELAY), au lieu de former une nouvelle armée
    if ((a.defPending && a.defPending.length) || a.defenders >= 1) {
      (a.defReinf = a.defReinf || []).push({ troops, tick: this.tick + CONFIG.DEFEND_REINFORCE_DELAY * CONFIG.TICKS_PER_SECOND });
      a.reinforced = true;
      return a;
    }
    a.reinforced = false;
    // Les défenseurs partent tout de suite, du château le plus proche (ou de l'avant-poste),
    // et marchent à la rencontre de l'armée ennemie : ils se battent en arrivant
    // (par le chemin le plus rapide de leurs terres : voir walkRoute ; leur but suit l'assaut, voir arriveDefenders)
    const from = this.defenseOrigin(pid, a, src), to = this.defenseGoal(a);
    (a.defPending = a.defPending || []).push(this.walkRoute(pid, from, to, troops));
    return a;
  },

  // --- Marche à pied sur ses propres terres (défenseurs) ---
  // Vitesse d'un groupe de défenseurs (en « points de terrain » par tour) : comme un assaut de même taille
  // (plus ils sont nombreux, plus ils sont lents), mais DEFENDER_SPEED_BONUS fois plus vite, car ils sont chez eux.
  // (une armée d'assaut qui marche sur ses terres jusqu'à la frontière, elle, va MARCH_OWN_LAND_BONUS fois plus vite)
  defenderSpeed(troops, bonus = CONFIG.DEFENDER_SPEED_BONUS) {
    return bonus *
      Math.max(CONFIG.ASSAULT_MIN_SPEED, CONFIG.ASSAULT_SPEED / (1 + troops / CONFIG.ASSAULT_SLOWDOWN));
  },

  // Trajet de troops soldats de pid, du point from au point to (en cases) : ils prennent le chemin le plus rapide
  // à travers leurs terres (une case de plaine coûte 1, une forêt 1.6, une colline 2.2, une montagne 2.8, un fleuve 4 ;
  // 1 partout dans la muraille de leurs villes : voir marchCost).
  // Renvoie { troops, from, pts, cum, start, arrive } : pts = les points du chemin, cum = le coût cumulé jusqu'à chacun.
  // (pas de chemin sur ses terres : ils vont tout droit, comme en plaine)
  // Un fleuve qui coupe ses terres se passe à gué (voir ownLandPath) : FORD_TIME secondes par case de fleuve.
  walkRoute(pid, from, to, troops, bonus = CONFIG.DEFENDER_SPEED_BONUS) {
    const tile = p => Math.floor(p.y) * this.W + Math.floor(p.x), W = this.W;
    const speed = this.defenderSpeed(troops, bonus), ford = this.fordCost(speed);
    const path = this.ownLandPath(pid, tile(from), tile(to), ford), march = this.marchCost(pid);
    const pts = [from], cum = [0];
    const add = (q, extra = 0) => {
      const last = pts[pts.length - 1];
      const t = tile(q), cost = this.isLand(t) ? march(t) : 1;
      pts.push(q);
      cum.push(cum[cum.length - 1] + Math.hypot(q.x - last.x, q.y - last.y) * cost + extra);
    };
    // (deux cases du chemin qui ne se touchent pas : on passe un fleuve à gué entre les deux)
    // (sur un pont : chaque case de fleuve compte comme une plaine)
    const fordBetween = (a, b) => {
      const gap = Math.max(0, Math.abs(a % W - b % W) + Math.abs(((a / W) | 0) - ((b / W) | 0)) - 1);
      return gap && this.bridgedBetween(a, b) ? gap : gap * ford;
    };
    if (path) for (let k = 1; k < path.length - 1; k++) {
      add({ x: path[k] % W + 0.5, y: ((path[k] / W) | 0) + 0.5 }, fordBetween(path[k - 1], path[k]));
    }
    add(to, path && path.length > 1 ? fordBetween(path[path.length - 2], path[path.length - 1]) : 0);
    const ticks = Math.max(1, Math.round(cum[cum.length - 1] / speed));
    return { troops, from, pts, cum, start: this.tick, arrive: this.tick + ticks };
  },

  // Où en est ce trajet (walkRoute) à ce tour ? Renvoie { x, y, k } (k = l'étape du chemin atteinte)
  walkPosition(r) {
    const total = r.cum[r.cum.length - 1];
    const done = total * Math.min(1, (this.tick - r.start) / Math.max(1, r.arrive - r.start));
    let k = 1;
    while (k < r.cum.length - 1 && r.cum[k] < done) k++;
    const a = r.pts[k - 1], b = r.pts[k], seg = r.cum[k] - r.cum[k - 1];
    const f = seg > 0 ? (done - r.cum[k - 1]) / seg : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, k };
  },

  // Les places fortes de pid d'où partent (et où rentrent) ses armées : ses villes (châteaux) et ses ports
  // fortifiés (niveau 3) : une muraille et sa garnison. base = seulement celles reliées au cœur du royaume.
  strongholds(pid, base) {
    return this.castles.concat(this.walledPorts()).filter(c => this.owner[c] === pid && (!base || this.isBase(c)));
  },

  // La ville (parmi cands) que des soldats de pid rejoignent LE PLUS VITE en marchant depuis la case start (ou,
  // ce qui revient au même, d'où ils arrivent le plus vite à start) : on compte le vrai chemin, comme walkRoute
  // (chaque case coûte son terrain : les fleuves, montagnes et détours rallongent), pas la distance à vol d'oiseau.
  // Ils marchent sur leurs terres ; si enemy est donné (un assaut), aussi sur les siennes, mais
  // MARCH_OWN_LAND_BONUS fois plus lentement. Renvoie -1 si aucune ville n'y mène à pied (de l'autre côté de la mer).
  // (gardé en mémoire une seconde : les bots et les aperçus le demandent souvent)
  fastestCity(pid, start, cands, enemy = -2) {
    const N = this.N, W = this.W, own = this.owner, TPS = CONFIG.TICKS_PER_SECOND;
    if (start < 0 || start >= N || !cands.length) return -1;
    if (cands.length === 1) return cands[0];
    if (!this.cityCache || this.cityCacheTick + TPS <= this.tick) { this.cityCache = new Map(); this.cityCacheTick = this.tick; }
    const key = start + ':' + pid + ':' + enemy + ':' + cands.join(',');
    if (this.cityCache.has(key)) return this.cityCache.get(key);
    const goal = new Map(); // case → ville
    for (const c of cands) for (const j of this.footprint(c, this.building[c])) goal.set(j, c);
    if (!this.cityBuf || this.cityBuf.seen.length !== N) this.cityBuf = { dist: new Float64Array(N), seen: new Int32Array(N), stamp: 0 };
    const B = this.cityBuf, stamp = ++B.stamp, heap = new MinHeap(), slow = CONFIG.MARCH_OWN_LAND_BONUS, march = this.marchCost(pid);
    this.riverTiles(); // (prépare riverSide)
    const ford = this.fordCost(this.defenderSpeed(500)); // (pour une armée moyenne)
    B.seen[start] = stamp; B.dist[start] = 0;
    heap.push(0, start);
    let found = -1;
    while (heap.size) {
      const [d, i] = heap.pop();
      if (B.seen[i] === -stamp) continue;
      B.seen[i] = -stamp;
      if (goal.has(i)) { found = goal.get(i); break; }
      const x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
        if (n < 0 || B.seen[n] === -stamp || !this.isLand(n)) continue;
        const o = own[n], terrain = march(n);
        const cost = o === pid ? terrain : o === enemy && enemy >= 0 ? terrain * slow : -1;
        if (cost < 0) continue;
        const nd = d + cost;
        if (B.seen[n] !== stamp || nd < B.dist[n]) { B.seen[n] = stamp; B.dist[n] = nd; heap.push(nd, n); }
      }
      // (un fleuve qui coupe ses terres : on le passe à gué, voir fordAcross)
      if (this.riverSide[i] && own[i] === pid) this.fordAcross(i, pid, (n, gap, bridged) => {
        if (B.seen[n] === -stamp) return;
        const nd = d + (bridged ? gap : gap * ford) + march(n);
        if (B.seen[n] !== stamp || nd < B.dist[n]) { B.seen[n] = stamp; B.dist[n] = nd; heap.push(nd, n); }
      });
    }
    this.cityCache.set(key, found);
    return found;
  },

  // Distances de marche (Dijkstra) depuis la case from, sur les terres de pid (fleuves passés à gué) : renvoie une
  // fonction case → distance (Infinity si on ne l'atteint pas à pied). Gardé en mémoire tant que la carte ne change pas
  // (l'aperçu du chemin d'assaut le demande souvent).
  // Cases dans la muraille d'une ville de leur propre royaume (1 = oui). Gardé en mémoire tant que la carte ne change pas.
  cityTiles() {
    if (this.cityTilesVersion === this.version && this.cityTilesBuf) return this.cityTilesBuf;
    const mask = this.cityTilesBuf && this.cityTilesBuf.length === this.N ? this.cityTilesBuf.fill(0) : new Uint8Array(this.N);
    for (const c of this.castles) if (this.owner[c] >= 0) for (const i of this.castleZone(c, this.owner[c])) mask[i] = 1;
    this.cityTilesBuf = mask;
    this.cityTilesVersion = this.version;
    return mask;
  },

  // Coût d'une case pour une armée de pid qui marche sur ses terres : celui du terrain (forêt, colline, montagne
  // ralentissent, 4 au plus), sauf dans la muraille de ses propres villes, où les chemins sont tracés : comme une plaine.
  marchCost(pid) {
    const mask = this.cityTiles(), own = this.owner, T = this.terrain;
    return i => (own[i] === pid && mask[i] ? 1 : Math.min(4, TERRAIN_INFO[T[i]].cost));
  },

  ownLandField(pid, from) {
    const N = this.N, W = this.W, own = this.owner;
    if (!this.fieldBuf || this.fieldBuf.seen.length !== N) this.fieldBuf = { dist: new Float64Array(N), seen: new Int32Array(N), stamp: 0, key: '' };
    const B = this.fieldBuf, key = pid + ':' + from + ':' + this.version;
    if (B.key !== key) {
      B.key = key;
      const stamp = ++B.stamp, heap = new MinHeap(), ford = this.fordCost(this.defenderSpeed(500)), cost = this.marchCost(pid);
      this.riverTiles(); // (prépare riverSide)
      if (from >= 0 && from < N && own[from] === pid) { B.seen[from] = stamp; B.dist[from] = 0; heap.push(0, from); }
      // (seen[i] = stamp : case déjà vue ; seen[i] = -stamp : distance définitive)
      const visit = (n, nd) => {
        if (B.seen[n] === -stamp) return;
        if (B.seen[n] !== stamp || nd < B.dist[n]) { B.seen[n] = stamp; B.dist[n] = nd; heap.push(nd, n); }
      };
      while (heap.size) {
        const [d, i] = heap.pop();
        if (B.seen[i] === -stamp) continue;
        B.seen[i] = -stamp;
        const x = i % W;
        for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
          if (n >= 0 && own[n] === pid && this.isLand(n)) visit(n, d + cost(n));
        }
        if (this.riverSide[i]) this.fordAcross(i, pid, (n, gap, bridged) => {
          visit(n, d + (bridged ? gap : gap * ford) + cost(n));
        });
      }
    }
    const stamp = B.stamp;
    return i => (B.seen[i] === -stamp ? B.dist[i] : Infinity);
  },

  // Chemin le plus rapide (Dijkstra) de la case from à la case to, en ne passant que par les terres de pid
  // (to elle-même peut être à l'ennemi : c'est le front). Renvoie la liste des cases, ou null.
  // (les tableaux sont gardés d'une fois sur l'autre : la carte peut être très grande)
  // Un fleuve qui coupe ses terres se passe à gué : on saute d'une rive à l'autre (ses deux rives à pid), pour
  // ford « points de terrain » par case de fleuve (voir fordCost).
  ownLandPath(pid, from, to, ford = this.fordCost(this.defenderSpeed(500))) {
    const N = this.N, W = this.W, own = this.owner;
    this.riverTiles(); // (prépare riverSide)
    if (from < 0 || from >= N || to < 0 || to >= N) return null;
    if (!this.walkBuf || this.walkBuf.seen.length !== N)
      this.walkBuf = { dist: new Float64Array(N), prev: new Int32Array(N), seen: new Int32Array(N), stamp: 0 };
    const B = this.walkBuf, stamp = ++B.stamp, heap = new MinHeap(), cost = this.marchCost(pid);
    // (seen[i] = stamp : case déjà vue lors de CETTE recherche ; seen[i] = -stamp : case finie)
    const passable = i => i === to || (own[i] === pid && this.isLand(i));
    B.seen[from] = stamp; B.dist[from] = 0; B.prev[from] = -1;
    heap.push(0, from);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (B.seen[i] === -stamp) continue;
      B.seen[i] = -stamp;
      if (i === to) {
        const path = [];
        for (let j = i; j >= 0; j = B.prev[j]) path.push(j);
        return path.reverse();
      }
      const x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
        if (n < 0 || B.seen[n] === -stamp || !passable(n)) continue;
        const nd = d + cost(n);
        if (B.seen[n] !== stamp || nd < B.dist[n]) { B.seen[n] = stamp; B.dist[n] = nd; B.prev[n] = i; heap.push(nd, n); }
      }
      if (this.riverSide[i] && own[i] === pid) this.fordAcross(i, pid, (n, gap, bridged) => {
        if (B.seen[n] === -stamp) return;
        const nd = d + (bridged ? gap : gap * ford) + cost(n);
        if (B.seen[n] !== stamp || nd < B.dist[n]) { B.seen[n] = stamp; B.dist[n] = nd; B.prev[n] = i; heap.push(nd, n); }
      });
    }
    return null;
  },

  // Gué : depuis la case i (au bord d'un fleuve), les cases de pid juste en face, de l'autre côté du fleuve
  // (en ligne droite, comme acrossRiver) : fn(case d'en face, nombre de cases de fleuve à traverser, un pont ?)
  // (sur un pont, on passe sans s'arrêter : chaque case de fleuve compte comme une plaine)
  // (want : quelles cases d'en face on cherche ; par défaut, celles de pid)
  fordAcross(i, pid, fn, want = j => this.owner[j] === pid) {
    const W = this.W, x0 = i % W, y0 = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let bridged = true;
      for (let k = 1; k <= 4; k++) {
        const x = x0 + dx * k, y = y0 + dy * k;
        if (x < 0 || y < 0 || x >= W || y >= this.H) break;
        const j = y * W + x;
        if (this.terrain[j] === TERRAIN.RIVER) { if (!this.bridgeAt[j]) bridged = false; continue; }
        if (k > 1 && want(j)) fn(j, k - 1, bridged);
        break;
      }
    }
  },

  // Les cases de fleuve entre deux cases en ligne droite sont-elles toutes couvertes par un pont ?
  bridgedBetween(a, b) {
    const W = this.W, dx = Math.sign(b % W - a % W), dy = Math.sign(((b / W) | 0) - ((a / W) | 0));
    for (let j = a + dx + dy * W; j !== b; j += dx + dy * W) if (!this.bridgeAt[j]) return false;
    return true;
  },

  // --- Ponts ---
  // Un pont sur la case de fleuve i : il va tout droit d'une rive à l'autre (à l'horizontale ou à la verticale,
  // le plus court), et les deux rives doivent être à pid. Renvoie { tiles, a, b } (cases de fleuve, et les deux
  // rives), ou { error }.
  planBridge(pid, i) {
    const W = this.W, H = this.H;
    if (i < 0 || this.terrain[i] !== TERRAIN.RIVER) return { error: tr('Un pont se construit sur un fleuve (pas sur un grand fleuve, infranchissable).', 'A bridge is built on a river (not on a great river, which cannot be crossed).') };
    if (this.bridgeAt[i]) return { error: tr('Il y a déjà un pont ici.', 'There is already a bridge here.') };
    let best = null, why = tr('Les deux rives, juste en face, doivent être à toi (ou l\'une à toi, l\'autre à un allié de ton pacte).', 'Both banks, right opposite each other, must be yours (or one yours, the other an ally\'s in your pact).');
    // (une rive à toi, l'autre à toi ou à un allié de ton pacte : un pont relie aussi deux royaumes alliés,
    //  par exemple pour faire passer une route commerciale)
    const mineOrAlly = j => this.owner[j] === pid || (this.owner[j] >= 0 && this.areAllied(pid, this.owner[j]));
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      // on part de la case cliquée dans les deux sens, jusqu'à la terre
      const tiles = [i], ends = [];
      for (const s of [1, -1]) {
        let x = i % W, y = (i / W) | 0, end = -1;
        for (let k = 0; k < 4; k++) {
          x += dx * s; y += dy * s;
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          const j = y * W + x;
          if (this.terrain[j] === TERRAIN.RIVER) { tiles.push(j); continue; }
          end = j;
          break;
        }
        ends.push(end);
      }
      const [a, b] = ends;
      if (a < 0 || b < 0 || tiles.length > 3) continue; // (pas de rive en face, ou fleuve trop large)
      if (!this.isLand(a) || !this.isLand(b)) continue;
      if (!mineOrAlly(a) || !mineOrAlly(b) || (this.owner[a] !== pid && this.owner[b] !== pid)) continue;
      if (tiles.some(j => this.bridgeAt[j])) { why = tr('Il y a déjà un pont ici.', 'There is already a bridge here.'); continue; }
      if (!best || tiles.length < best.tiles.length) best = { tiles, a, b };
    }
    return best || { error: why };
  },

  // Construire un pont (BRIDGE_COST pièces) : ses soldats passent ce fleuve sans perdre de temps à gué.
  // (un pont sert à tout royaume qui tient ses deux rives : s'il les perd, le nouveau maître s'en sert)
  buildBridge(p, i) {
    const plan = this.planBridge(p.id, i);
    if (plan.error) return plan.error;
    const cost = this.bridgeCost(p.id);
    if (p.gold < cost) return tr(`Pas assez d'or : il faut 💰 ${fmt(cost)}.`, `Not enough gold: you need 💰 ${fmt(cost)}.`);
    p.gold -= cost;
    this.bridges.push({ tiles: plan.tiles, a: plan.a, b: plan.b, owner: p.id });
    for (const j of plan.tiles) this.bridgeAt[j] = 1;
    this.version++;
    return null;
  },
  // Prix d'un pont pour pid (🪨 moins cher avec des carrières de pierre)
  bridgeCost(pid) { return Math.round(CONFIG.BRIDGE_COST * (1 - this.mineBonus(pid, 'stone'))); },
  // Coût d'une case de fleuve passée à gué, en « points de terrain » : FORD_TIME secondes à cette vitesse
  fordCost(speed) { return CONFIG.FORD_TIME * CONFIG.TICKS_PER_SECOND * speed; },

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

  // D'où partent les défenseurs de pid : l'avant-poste attaqué, sinon son château d'où l'on arrive le plus vite
  // au combat en marchant sur ses terres (pas un château isolé ; voir fastestCity), sinon le plus proche à vol
  // d'oiseau, sinon le cœur de son royaume
  defenseOrigin(pid, a, src) {
    const W = this.W, mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    if (src >= 0) return mid(src);
    // (armée bloquée dans ses châteaux isolés : les défenseurs sortent du château attaqué)
    if (a.targetCastle >= 0 && this.building[a.targetCastle] === B_CASTLE && this.troopsInCastles(pid)) return mid(a.targetCastle);
    const goal = this.defenseGoal(a);
    const fast = this.fastestCity(pid, Math.floor(goal.y) * W + Math.floor(goal.x), this.strongholds(pid, true));
    if (fast >= 0) return mid(fast);
    const to = this.attackFront(a);
    let best = null, bestD = Infinity;
    for (const c of this.strongholds(pid, true)) {
      const m = mid(c), d = (m.x - to.x) ** 2 + (m.y - to.y) ** 2;
      if (d < bestD) { bestD = d; best = m; }
    }
    if (best) return best;
    const p = this.players[pid];
    return { x: p.sumX / p.tiles + 0.5, y: p.sumY / p.tiles + 0.5 };
  },

  // L'assaut a est fini (la ville est prise, ou l'attaquant est parti) : ses défenseurs encore en route font
  // demi-tour, là où ils sont, et rentrent à pied (walkRoute) jusqu'à la ville (château) la plus proche
  // de leur royaume (ou à leur avant-poste). On ne les récupère qu'à leur arrivée.
  sendHome(a, src) {
    if (!a.defPending || !a.defPending.length) return;
    const W = this.W, pid = a.target;
    const mid = c => { const h = this.sizeOf(this.building[c]) / 2; return { x: c % W + h, y: ((c / W) | 0) + h }; };
    for (const r of a.defPending) {
      const pos = this.walkPosition(r), from = { x: pos.x, y: pos.y };
      let to = null, best = Infinity;
      if (src >= 0 && this.owner[src] === pid && this.building[src] === B_OUTPOST) to = mid(src);
      else {
        // (la ville la plus rapide à rejoindre à pied, sinon la plus proche à vol d'oiseau)
        const fast = this.fastestCity(pid, Math.floor(from.y) * W + Math.floor(from.x), this.strongholds(pid, false));
        if (fast >= 0) to = mid(fast);
        else for (const c of this.strongholds(pid, false)) {
          const m = mid(c), d = (m.x - from.x) ** 2 + (m.y - from.y) ** 2;
          if (d < best) { best = d; to = m; }
        }
      }
      if (!to) to = r.from; // (plus aucun château : ils retournent d'où ils venaient)
      this.returning.push(Object.assign(this.walkRoute(pid, from, to, r.troops), { pid, source: src, to }));
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
  defendersOnTheWay(a) {
    return (a.defPending ? a.defPending.reduce((s, r) => s + r.troops, 0) : 0)
      + (a.defReinf ? a.defReinf.reduce((s, r) => s + r.troops, 0) : 0);
  },

  // Où vont les défenseurs : la case de leurs terres la plus proche de l'endroit où se bat l'assaut
  // (pour qu'ils y aillent par leurs terres, et pas en ligne droite à travers celles de l'ennemi)
  defenseGoal(a) {
    const front = this.attackFront(a), W = this.W, pid = a.target;
    const fx = Math.floor(front.x), fy = Math.floor(front.y);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 8 && !best; r++) {
      for (let y = fy - r; y <= fy + r; y++) {
        for (let x = fx - r; x <= fx + r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= this.H || this.owner[y * W + x] !== pid) continue;
          const d = (x + 0.5 - front.x) ** 2 + (y + 0.5 - front.y) ** 2;
          if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
        }
      }
    }
    return best || front;
  },

  // Arrivée des défenseurs en route : ils rejoignent le combat. Toutes les secondes, ceux qui marchent encore
  // corrigent leur route : ils suivent l'assaut, qui avance pendant qu'ils viennent à sa rencontre.
  arriveDefenders(a) {
    // Renforts de l'armée de défense : après leur court délai, ils la rejoignent (en route, ou au combat)
    if (a.defReinf && a.defReinf.length) {
      for (const r of a.defReinf) {
        if (r.tick > this.tick) continue;
        r.done = true;
        if (a.defPending && a.defPending.length) a.defPending[0].troops += r.troops;
        else a.defenders += r.troops;
      }
      a.defReinf = a.defReinf.filter(r => !r.done);
    }
    if (!a.defPending || !a.defPending.length) return;
    if (this.tick % CONFIG.TICKS_PER_SECOND === 0) {
      const goal = this.defenseGoal(a);
      for (const r of a.defPending) {
        const end = r.pts[r.pts.length - 1];
        if (r.arrive <= this.tick || Math.hypot(end.x - goal.x, end.y - goal.y) < 2) continue;
        const pos = this.walkPosition(r);
        Object.assign(r, this.walkRoute(a.target, { x: pos.x, y: pos.y }, goal, r.troops));
      }
    }
    for (const r of a.defPending) if (r.arrive <= this.tick) { a.defenders += r.troops; r.done = true; }
    a.defPending = a.defPending.filter(r => !r.done);
  },

  // Secondes à attendre avant de pouvoir renvoyer des défenseurs contre cet assaut : plus d'attente, chaque envoi
  // en plus renforce l'armée de défense déjà partie (voir sendDefenders)
  defendWait() { return 0; },

  stepAttack(a) {
    this.arriveDefenders(a);
    if (this.stepRetreat(a)) return;
    // La ville (l'église, le port…) visée a été prise par un autre royaume avant notre arrivée : demi-tour
    if (a.targetCastle >= 0 && this.owner[a.targetCastle] !== a.target) {
      const p = this.players[a.attacker], o = this.owner[a.targetCastle];
      if (p.isHuman) UI.log(`↩️ ${this.targetLabel(a.targetCastle)[0].toUpperCase()}${this.targetLabel(a.targetCastle).slice(1)} ` +
        tr(`a été pris${o >= 0 ? ' par ' + this.players[o].name : ''} avant ton arrivée : ton armée fait demi-tour.`,
          `was taken${o >= 0 ? ' by ' + this.players[o].name : ''} before you arrived: your army turns back.`), 'warn');
      return this.endAttack(a);
    }
    if (this.isPreparing(a)) return;
    // Assaut sur un morceau coupé de ses châteaux : si son royaume l'a relié à un château entre-temps, il s'arrête
    if (a.unlinked && this.tick % CONFIG.TICKS_PER_SECOND === 0 && this.unlinkedRelinked(a)) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(tr(`🔗 ${d.name} a relié ses terres coupées à un château : ton assaut s'arrête.`, `🔗 ${d.name} has linked their cut-off land to a castle: your assault stops.`), 'warn', d);
      else if (d.isHuman) UI.log(tr(`🔗 Tes terres coupées sont de nouveau reliées à un château : l'assaut ${this.deName(p.name)} s'arrête !`, `🔗 Your cut-off land is linked to a castle again: ${p.name}'s assault stops!`), 'good', p);
      return this.endAttack(a);
    }
    // Assaut de front contre un royaume désorganisé : s'il rebâtit (ou reprend) un château entre-temps,
    // il est de nouveau organisé, et l'assaut s'arrête
    if (a.disorganized && this.tick % CONFIG.TICKS_PER_SECOND === 0 && this.isProtected(a.target)) {
      const p = this.players[a.attacker], d = this.players[a.target];
      if (p.isHuman) UI.log(tr(`🏰 ${d.name} a de nouveau une ville (ou un port fortifié) : il n'est plus désorganisé, ton assaut s'arrête.`, `🏰 ${d.name} has a city (or a fortified port) again: no longer disorganized, your assault stops.`), 'warn', d);
      else if (d.isHuman) UI.log(tr(`🏰 Tu as de nouveau une ville (ou un port fortifié) : l'assaut ${this.deName(p.name)} contre tes terres désorganisées s'arrête !`, `🏰 You have a city (or a fortified port) again: ${p.name}'s assault on your disorganized land stops!`), 'good', p);
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
          if (this.players[a.attacker].isHuman) UI.log(tr('🚫 Le passage vers le château est bloqué : assaut annulé.', '🚫 The way to the castle is blocked: assault cancelled.'), 'warn');
          return this.endAttack(a);
        }
        a.pathTiles = path;
        a.limitZone = this.corridor(a.targetCastle, path);
        a.frontTile = path[0];
      }
    }
    if (a.link >= 0) {
      // Assaut de jonction : son château a été pris avant qu'il n'arrive, les soldats rentrent
      if (this.owner[a.link] !== a.attacker) {
        if (this.players[a.attacker].isHuman) UI.log(tr('💥 Trop tard : ton bâtiment isolé est tombé, ton assaut rentre.', '💥 Too late: your isolated building has fallen, your assault heads home.'), 'warn');
        return this.endAttack(a);
      }
      // Déjà relié au royaume (par un autre chemin) : les soldats rejoignent sa défense
      if (!this.isIsolated(a.link)) return this.linkArrives(a);
      // Fin de la préparation : on recalcule le chemin, la frontière a pu bouger
      if (this.tick === a.startTick) {
        const route = this.linkRoute(a.attacker, a.link, a.target);
        if (!route) {
          if (this.players[a.attacker].isHuman) UI.log(tr('🚫 Le passage vers ton bâtiment isolé est bloqué : assaut annulé.', '🚫 The way to your isolated building is blocked: assault cancelled.'), 'warn');
          return this.endAttack(a);
        }
        a.path = route.path;
        a.piece = route.piece;
        a.limitZone = this.corridor(a.link, route.path, route.passable);
        a.frontTile = route.path[0];
        this.linkEntry(a, route.path[0]);
      }
    }
    // Début d'un assaut sur un port ou un avant-poste : sa garnison sort le défendre
    // (celle d'un château, elle, attend l'ennemi derrière sa muraille : voir startSiege)
    if (a.prepTicks && this.tick === a.startTick && a.targetCastle >= 0 && this.building[a.targetCastle] !== B_CASTLE && !a.done) {
      a.garrison = this.garrison[a.targetCastle];
      this.garrison[a.targetCastle] = 0;
      a.garrisonOut = true;
    }
    // Arrivée des renforts
    for (const r of a.pending) if (r.tick <= this.tick) a.troops += r.troops;
    a.pending = a.pending.filter(r => r.tick > this.tick);
    // Les soldats du bâtiment visé se battent tous, même ceux arrivés après le début de l'assaut :
    this.rallyGarrison(a);
    // Tant que des défenseurs (garnison ou renforts) tiennent la position, l'assaut se bat au lieu d'avancer
    // (et un siège en cours se met en pause pendant le combat : sa jauge ne reprend qu'une fois les défenseurs battus)
    if (a.defenders + (a.garrison || 0) >= 1) {
      this.pauseSiege(a);
      return this.fight(a);
    }
    // Siège : l'armée est au pied des murs. Le château ne tombe qu'à la fin du siège ;
    // d'ici là, le défenseur peut encore envoyer des soldats (on se bat alors, juste au-dessus).
    if (a.siege) {
      if (this.owner[a.siege.tile] !== a.target) return this.endAttack(a); // le château a changé de mains
      const sb = this.building[a.siege.tile];
      if (sb !== B_CASTLE && sb !== B_OUTPOST && sb !== B_PORT) return this.endAttack(a); // (il n'existe plus)
      if (this.tick < a.siege.end) return;
      return sb === B_OUTPOST ? this.takeOutpost(a, a.siege.tile) : sb === B_PORT ? this.takePort(a, this.anchor[a.siege.tile])
        : this.takeCastle(a, a.siege.tile);
    }
    // Points de marche de ce tour : prendre une case en coûte autant que sa défense de terrain
    // (plaine 1, forêt 1.6, colline 2.2, montagne 2.8, fleuve 4). On avance donc vite en plaine
    // et lentement dans le relief. Les points non utilisés sont gardés pour le tour suivant.
    // Sur les terres libres, une grosse armée s'étend plus vite. Mais contre un royaume organisé, c'est l'inverse :
    // plus l'armée d'assaut est grande, plus elle est lente (ASSAULT_SPEED / (1 + soldats / ASSAULT_SLOWDOWN)).
    // Contre un territoire désorganisé (royaume sans château, ou morceau coupé de ses châteaux), personne ne
    // tient le terrain : il se prend plus vite (DISORGANIZED_SPEED), et d'autant plus vite que l'armée est grande.
    let speed;
    if (a.target >= 0 && (a.unlinked || this.leaderless(a))) {
      speed = CONFIG.ASSAULT_SPEED * CONFIG.DISORGANIZED_SPEED * (0.5 + 0.5 * Math.sqrt(a.troops / CONFIG.ASSAULT_HEAVY));
    } else if (a.target >= 0) {
      speed = Math.max(CONFIG.ASSAULT_MIN_SPEED, CONFIG.ASSAULT_SPEED / (1 + a.troops / CONFIG.ASSAULT_SLOWDOWN));
    } else {
      speed = Math.max(CONFIG.MIN_ATTACK_SPEED, Math.sqrt(a.troops) * CONFIG.ATTACK_SPEED)
        * CONFIG.FREE_LAND_SPEED_BONUS * CONFIG.FREE_LAND_BOOST; // les terres libres se prennent vite, toute la partie
    }
    // (on peut toujours garder de quoi prendre une montagne, sinon une petite armée resterait bloquée)
    a.move = Math.min((a.move || 0) + speed, Math.max(speed * 2, MAX_LAND_COST));
    while (!a.done) {
      const t = this.pickFrontier(a);
      if (t < 0) {
        // Plus aucune case à prendre devant l'armée : un assaut vers un objectif reprend sa route (voir resumeAssault)
        if (this.resumeAssault(a)) continue;
        const p = this.players[a.attacker];
        if (p.isHuman && a.target >= 0 && this.players[a.target].alive) {
          const c = a.targetCastle;
          UI.log(c >= 0 && this.owner[c] === a.target
            ? tr(`🚫 Ton armée ne trouve plus de passage vers ${this.targetLabel(c)} : elle rentre.`, `🚫 Your army can no longer find a way to ${this.targetLabel(c)}: it heads home.`)
            : tr(`↩️ Ton assaut contre ${this.players[a.target].name} s'arrête : il n'y a plus rien à prendre de ce côté.`, `↩️ Your assault against ${this.players[a.target].name} stops: there is nothing left to take on this side.`), 'warn', this.players[a.target]);
        }
        return this.endAttack(a);
      }
      if (a.troops < this.tileCost(a, t)) return this.endAttack(a); // plus assez de soldats
      // Un fleuve au milieu de ses terres : l'armée le passe à gué (CROSSING_TIME_FIRST / NEXT secondes), puis prend
      // pied sur l'autre rive. (le gué du départ, lui, est compté dans la marche : voir entryFromPath)
      const fording = a.route && a.route.length && !this.countFriendNeighbors(t, a.attacker);
      if (fording) {
        if (a.fordEnd === undefined) {
          let time = Infinity;
          this.fordAcross(t, a.attacker, (n, gap, bridged) => {
            time = Math.min(time, bridged ? 0 : CONFIG.CROSSING_TIME_FIRST + (gap - 1) * CONFIG.CROSSING_TIME_NEXT);
          });
          a.fordEnd = this.tick + Math.round((time === Infinity ? 0 : time) * CONFIG.TICKS_PER_SECOND);
        }
        if (this.tick < a.fordEnd) { a.set.add(t); return; }
        a.fordEnd = undefined; // (gué passé : l'armée a pied sur l'autre rive)
      }
      // Arrivée au pied d'un château : le siège commence (il ne tombe pas tout de suite)
      if (a.target >= 0 && this.building[t] === B_CASTLE) return this.startSiege(a, this.anchor[t]);
      // Arrivée à la muraille du château visé : l'armée ne la traverse pas, elle s'arrête au pied du mur
      // et commence le siège (on s'y bat avec le bonus de défense des murs)
      const tc = a.targetCastle;
      if (a.target >= 0 && tc >= 0 && this.building[tc] === B_CASTLE && this.owner[tc] === a.target && this.inWalls(tc, t)) {
        return this.startSiege(a, tc);
      }
      // (un avant-poste visé s'assiège aussi : il ne tombe pas tout de suite)
      if (this.building[t] === B_OUTPOST && this.anchor[t] === a.targetCastle) return this.startSiege(a, t);
      // (un port fortifié aussi, comme une petite ville : l'armée s'arrête à sa petite muraille)
      if (a.target >= 0 && tc >= 0 && this.walledPort(tc) && this.owner[tc] === a.target && this.inPortWalls(tc, t)) {
        return this.startSiege(a, tc);
      }
      // (un assaut contre un royaume avance un peu plus vite que la normale dans le relief : ASSAULT_TERRAIN_SLOWDOWN)
      const raw = TERRAIN_INFO[this.terrain[t]].cost;
      const steps = a.target >= 0 ? 1 + (raw - 1) * CONFIG.ASSAULT_TERRAIN_SLOWDOWN : raw;
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
      // (route tracée vers un objectif : elle ne reste à l'attaquant que s'il le prend, voir revertRoute)
      if (a.target >= 0 && (a.targetCastle >= 0 || a.link !== undefined)) (a.route = a.route || []).push(t);
      // Prise de l'église, du port ou de l'avant-poste visé : l'assaut s'arrête là
      const b = this.building[t];
      if (a.targetCastle >= 0 && b && b !== B_CASTLE && this.anchor[t] === a.targetCastle) {
        if (linked) this.takeLinked(a, linked);
        this.onTargetTaken(a, b, !!linked);
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
      // (au bord d'un fleuve : l'autre rive, dans son couloir, peut aussi être prise, à gué)
      if (a.targetCastle >= 0 && this.riverSide[t]) {
        this.fordAcross(t, a.attacker, n => { a.set.add(n); a.list.push(n); },
          n => this.owner[n] === a.target && !a.set.has(n) && (!a.limitZone || a.limitZone.has(n)));
      }
    }
  },

  // Un assaut vers un objectif n'a plus de case à prendre devant lui (des terres ont changé de mains autour de son
  // front…) : il ne s'arrête pas pour autant. On refait la liste des cases ennemies de son couloir qui touchent ses
  // terres ; s'il n'y en a plus, il cherche un nouveau chemin vers l'objectif, qui doit partir près de son front.
  // Renvoie false si l'objectif est vraiment hors d'atteinte. (une fois par tour au plus)
  resumeAssault(a) {
    const c = a.targetCastle;
    if (c < 0 || a.castleTaken || a.siege || this.owner[c] !== a.target || a.resumeTick === this.tick) return false;
    a.resumeTick = this.tick;
    const src = this.sourceOfAttack(a);
    let list = this.buildFrontier(a.attacker, a.target, src).filter(t => !this.wallAt[t] && (!a.limitZone || a.limitZone.has(t)));
    if (!list.length) {
      const path = this.castlePath(a.attacker, c, src), f = a.frontTile, W = this.W;
      // (le nouveau chemin doit partir près de là où se trouve l'armée : elle ne se téléporte pas)
      if (!path || (f >= 0 && Math.hypot(path[0] % W - f % W, ((path[0] / W) | 0) - ((f / W) | 0)) > 8)) return false;
      a.pathTiles = path;
      a.limitZone = this.corridor(c, path);
      list = [path[0]];
    }
    a.list = list;
    a.set = new Set(list);
    return true;
  },

  // Rappelle les soldats d'une attaque (seulement les siennes).
  // Annuler une attaque : c'est une retraite. Les soldats mettent RETREAT_TIME secondes à décrocher
  // (les défenseurs peuvent encore les attaquer), puis rentrent en perdant RETREAT_LOSS de leurs effectifs.
  // (L'armée marche encore sur ses propres terres : elle rentre tout de suite, sans aucune perte.)
  cancelAttack(pid, attackId) {
    const a = this.attacks.find(a => a.id === attackId && a.attacker === pid && !a.done);
    if (a && a.retreatEnd === undefined && this.isPreparing(a)) { a.calledBack = true; this.endAttack(a); return a; }
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
    this.wallRetreatLoss(a); // (et un mur bâti dans son dos coûte cher à franchir)
    const p = this.players[a.attacker];
    if (p.isHuman) UI.log(tr(`↩️ Retraite terminée : ${fmt(a.troops + a.pending.reduce((s, r) => s + r.troops, 0))} soldats rentrent.`, `↩️ Retreat complete: ${fmt(a.troops + a.pending.reduce((s, r) => s + r.troops, 0))} soldiers come home.`), 'good');
    this.endAttack(a);
    return true;
  },

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
    const outpost = this.building[t] === B_OUTPOST, port = this.building[t] === B_PORT;
    const secs = outpost ? CONFIG.OUTPOST_SIEGE : port ? CONFIG.PORT_SIEGE : this.castleInfo(this.anchor[t]).siege;
    a.siege = { tile: t, start: this.tick, end: this.tick + secs * CONFIG.TICKS_PER_SECOND }; // (start : pour la jauge)
    a.frontTile = t; // on se bat au pied des murs (avec leur bonus de défense)
    // L'ennemi est à la muraille : la garnison du château entre enfin en jeu (elle n'en sort pas avant)
    if (!outpost && t === a.targetCastle && !a.garrisonOut) {
      a.garrison = (a.garrison || 0) + this.garrison[t];
      this.garrison[t] = 0;
      a.garrisonOut = true;
    }
    const p = this.players[a.attacker], d = this.players[a.target];
    const what = outpost ? tr(['un avant-poste', 'ton avant-poste', '⛺'], ['an outpost', 'your outpost', '⛺'])
      : port ? tr(['un port fortifié', 'ton port fortifié', '⚓'], ['a fortified port', 'your fortified port', '⚓'])
      : tr(['un château', 'ton château', '🏰'], ['a castle', 'your castle', '🏰']);
    if (p.isHuman) UI.log(tr(`${what[2]} Ton armée assiège ${what[0]} ${this.deName(d.name)} : il tombe dans ${secs} s si personne ne le défend.`,
      `${what[2]} Your army is besieging ${what[0]} of ${d.name}: it falls in ${secs} s if no one defends it.`), 'good', d);
    else if (d.isHuman) UI.log(tr(`${what[2]} ${p.name} assiège ${what[1]} ! Il tombe dans ${secs} s : envoie vite des défenseurs !`,
      `${what[2]} ${p.name} is besieging ${what[1]}! It falls in ${secs} s: send defenders quickly!`), 'warn', p);
  },

  // Port fortifié (niveau 3) : il a une petite muraille autour de sa zone, qu'un assaut assiège comme une petite ville
  walledPort(c) { return this.building[c] === B_PORT && this.level[c] >= 3; },
  inPortWalls(c, i) { return this.inChurchRange(c, i, this.buildingInfo(c).radius); },

  // Fin du siège d'un port fortifié : il est pris, avec sa zone et les bâtiments bâtis grâce à lui
  takePort(a, c) {
    const linked = this.hasSlots(c) ? this.churchZone(c) : null;
    for (const j of this.footprint(c, B_PORT)) this.setOwner(j, a.attacker);
    if (linked) this.takeLinked(a, linked);
    this.onTargetTaken(a, B_PORT, !!linked);
    return this.endAttack(a);
  },

  // Fin du siège d'un avant-poste : il est détruit, et l'assaut s'arrête. Toute la zone qu'il avait prise (son
  // morceau de territoire, s'il n'est pas relié au royaume ni tenu par une ville ou un port fortifié) passe
  // d'un coup à celui qui l'a détruit.
  takeOutpost(a, t) {
    const c = this.anchor[t];
    // (ses soldats qui attendaient là sont vaincus avec lui)
    const o = this.outposts.get(c), d = this.players[a.target], lost = Math.floor((o ? o.stationed : 0) + this.garrison[c]);
    if (d.isHuman && lost >= 1) UI.log(tr(`⛺ Ton avant-poste est détruit : ses ${fmt(lost)} soldats ont été vaincus.`, `⛺ Your outpost is destroyed: its ${fmt(lost)} soldiers were defeated.`), 'warn', this.players[a.attacker]);
    a.troops = Math.max(0, a.troops - this.tileCost(a, t));
    // la zone de l'avant-poste : son morceau de territoire (une tête de pont, pas le cœur du royaume)
    const r = this.regions(true), k = r.comp[c];
    const zone = k >= 0 && r.owner[k] === a.target && r.anyOutpost[k] && !r.held[k] && !r.heart[k]
      ? Array.from(r.order.subarray(r.start[k], r.start[k] + r.size[k])) : [];
    this.setOwner(t, a.attacker);
    let taken = 0;
    for (const j of zone) if (this.owner[j] === a.target) { this.setOwner(j, a.attacker); taken++; }
    if (taken >= 1) {
      const p = this.players[a.attacker];
      if (p.isHuman) UI.log(tr(`⛺ Avant-poste détruit : les ${fmt(taken)} cases de sa zone sont à toi !`, `⛺ Outpost destroyed: the ${fmt(taken)} tiles of its zone are yours!`), 'good', d);
      else if (d.isHuman) UI.log(tr(`⛺ Les ${fmt(taken)} cases de la zone de ton avant-poste passent à ${p.name}.`, `⛺ The ${fmt(taken)} tiles of your outpost's zone go to ${p.name}.`), 'warn', p);
    }
    this.onTargetTaken(a, B_OUTPOST, false);
    this.removeBuilding(c);
    return this.endAttack(a);
  },

  // Deux armées de royaumes ennemis assiègent le même château (d'un troisième royaume) : elles s'affrontent
  // d'abord entre elles, au pied des murs. Pendant la bataille, le siège est en pause ; la gagnante le reprend.
  siegeClashes() {
    const TPS = CONFIG.TICKS_PER_SECOND;
    for (const a of this.attacks) a.clash = undefined;
    const sieges = this.attacks.filter(a => !a.done && a.siege), paused = new Set();
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
              UI.log(tr(`⚔️ Ton armée affronte celle ${this.deName(this.players[y.attacker].name)} au pied du château ! La gagnante reprendra le siège.`,
                `⚔️ Your army is fighting ${this.players[y.attacker].name}'s at the foot of the castle! The winner will resume the siege.`), 'warn', this.players[y.attacker]);
            }
          }
        }
        // Combat comme contre des défenseurs : la supériorité en nombre et la force des soldats comptent
        const ba = this.numbersBonus(a.troops, b.troops), bb = this.numbersBonus(b.troops, a.troops);
        const pa = this.troopPower(a.attacker), pb = this.troopPower(b.attacker);
        const base = Math.max(CONFIG.FIGHT_MIN_LOSS, CONFIG.FIGHT_RATE * Math.min(a.troops, b.troops)) * ba * bb;
        a.troops = Math.max(0, a.troops - base * (bb / ba) * (pb / pa));
        b.troops = Math.max(0, b.troops - base * (ba / bb) * (pa / pb));
        // le siège attend la fin de la bataille (une seule fois par tour, même à 3 armées : voir plus bas)
        paused.add(a); paused.add(b);
        for (const [x, y] of [[a, b], [b, a]]) {
          if (x.troops >= 1) continue;
          const px = this.players[x.attacker], py = this.players[y.attacker];
          if (px.isHuman) UI.log(tr(`💥 Ton armée a été battue par celle de ${py.name} au pied du château.`, `💥 Your army was beaten by ${py.name}'s at the foot of the castle.`), 'warn', py);
          else if (py.isHuman) UI.log(tr(`⚔️ Tu as battu l'armée de ${px.name} : ton siège reprend !`, `⚔️ You beat ${px.name}'s army: your siege resumes!`), 'good', px);
          this.endAttack(x);
        }
      }
    }
    for (const a of paused) this.pauseSiege(a);
  },

  // Met le siège de l'assaut a en pause pour ce tour (une fois par tour au plus) : sa fin et son début reculent
  // d'un tour, la jauge ne bouge plus
  pauseSiege(a) {
    if (!a.siege || a.siege.pausedAt === this.tick) return;
    a.siege.pausedAt = this.tick;
    a.siege.start++;
    a.siege.end++;
  },

  // Fin du siège : le château tombe, avec toute sa zone (voir onCastleTaken), et l'assaut s'arrête
  takeCastle(a, t) {
    const castle = this.anchor[t], zone = this.castleZone(castle, a.target, 0); // (zone notée avant la prise)
    a.troops = Math.max(0, a.troops - this.tileCost(a, t));
    this.setOwner(t, a.attacker);
    this.onCastleTaken(a, castle, zone);
    return this.endAttack(a);
  },

  // Château pris : toute sa zone de défense passe d'un coup à l'attaquant, avec les moulins et casernes
  // qui s'y trouvent (une église, un port ou un autre château reste au défenseur : il faut le viser)
  onCastleTaken(a, castle, zone) {
    a.castleTaken = true;
    this.startTruce(castle); // (on ne peut pas le reprendre tout de suite)
    this.regionsCache = null; // (sa route n'est plus « en cours » : la coupe s'applique, voir regions)
    this.warEffects(a);
    for (const i of zone) {
      if (this.owner[i] !== a.target) continue; // (déjà pris avec un bâtiment)
      const b = this.building[i];
      if (b && b !== B_MINE && this.anchor[i] !== castle && TARGET_TYPES.includes(b)) continue;
      this.setOwner(i, a.attacker);
    }
    a.cut = true; // la zone prise peut couper le royaume du défenseur (voir captureEnclaves)
    const p = this.players[a.attacker], d = this.players[a.target];
    if (p.isHuman) UI.log(tr(`🏰 Tu as pris un château ${this.deName(d.name)}, avec toute sa zone et ses bâtiments !`, `🏰 You took a castle of ${d.name}, with its whole zone and buildings!`), 'good', d);
    else if (d.isHuman) UI.log(tr(`🏰 ${p.name} a pris un de tes châteaux !`, `🏰 ${p.name} took one of your castles!`), 'warn', p);
  },

  // Église (ou port) pris : sa zone passe à l'attaquant, avec les moulins et casernes construits grâce à elle.
  // Ce qui est dans la muraille d'un château reste au défenseur (ça dépend du château), comme les autres
  // châteaux, églises et ports.
  takeLinked(a, zone) {
    for (const i of zone) {
      if (this.owner[i] !== a.target || this.castleProtects(a.target, i)) continue;
      const b = this.building[i];
      if (b && b !== B_MINE && TARGET_TYPES.includes(b)) continue;
      if (b && this.footprint(this.anchor[i], b).some(j => this.castleProtects(a.target, j))) continue;
      this.setOwner(i, a.attacker);
    }
    a.cut = true; // la zone prise peut couper le royaume du défenseur (voir captureEnclaves)
  },

  onTargetTaken(a, type, withZone) {
    a.won = true; // (objectif pris : la route reste à l'attaquant)
    if (type !== B_OUTPOST) this.startTruce(a.targetCastle); // (église ou port : on ne peut pas le reprendre tout de suite)
    a.cut = true; // (et la coupe qu'elle fait dans le royaume s'applique maintenant : voir regions)
    this.regionsCache = null;
    const p = this.players[a.attacker], d = this.players[a.target];
    this.warEffects(a, type === B_OUTPOST); // (détruire un avant-poste ne donne pas de malus d'après-guerre)
    const what = tr({ [B_CHURCH]: ['⛪', 'une église', 'une de tes églises'], [B_PORT]: ['⚓', 'un port', 'un de tes ports'],
      [B_OUTPOST]: ['⛺', 'un avant-poste', 'un de tes avant-postes'], [B_MINE]: ['⛏️', 'une mine', 'une de tes mines'] },
      { [B_CHURCH]: ['⛪', 'a church', 'one of your churches'], [B_PORT]: ['⚓', 'a port', 'one of your ports'],
        [B_OUTPOST]: ['⛺', 'an outpost', 'one of your outposts'], [B_MINE]: ['⛏️', 'a mine', 'one of your mines'] })[type];
    const verb = type === B_OUTPOST ? tr('détruit', 'destroyed') : tr('pris', 'taken');
    const zone = withZone ? tr(`, avec sa zone et les bâtiments construits grâce à ${type === B_CHURCH ? 'elle' : 'lui'}`, ', with its zone and the buildings built thanks to it') : '';
    if (p.isHuman) UI.log(tr(`${what[0]} Tu as ${verb} ${what[1]} ${this.deName(d.name)}${zone} !`, `${what[0]} You have ${verb} ${what[1]} of ${d.name}${zone}!`), 'good', d);
    else if (d.isHuman) UI.log(tr(`${what[0]} ${p.name} a ${verb} ${what[2]}${zone} !`, `${what[0]} ${p.name} has ${verb} ${what[2]}${zone}!`), 'warn', p);
  },

  endAttack(a) {
    if (a.done) return;
    a.done = true;
    this.revertRoute(a);
    const p = this.players[a.attacker];
    // Les survivants (et les renforts encore en route) rentrent à la maison (ou à leur avant-poste) ;
    // des Vikings qui n'ont pas pris leur cible rembarquent là où ils ont débarqué
    const back = a.troops + a.pending.reduce((s, r) => s + r.troops, 0);
    if (a.viking !== undefined && !a.won && !a.castleTaken) this.sailHome(a.attacker, a.viking, back);
    else this.giveTroops(a.attacker, this.sourceOfAttack(a), back);
    // Les défenseurs survivants rentrent aussi, et la garnison regagne son château. Ceux qui étaient encore
    // en route font demi-tour : ils rentrent à pied jusqu'à la ville la plus proche (voir sendHome)
    if (a.target >= 0 && this.players[a.target].alive) {
      const src = a.defSource === undefined ? -1 : a.defSource;
      this.giveTroops(a.target, src, a.defenders);
      if (a.defReinf) this.giveTroops(a.target, src, a.defReinf.reduce((s, r) => s + r.troops, 0)); // (renforts pas encore arrivés)
      a.defReinf = [];
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

  // Assaut vers un objectif (château, église, port, avant-poste, ou château isolé à rejoindre) qui échoue :
  // la route qu'il a tracée à travers le royaume visé lui revient (il la reconquiert). Elle ne reste à
  // l'attaquant que s'il a pris son objectif.
  revertRoute(a) {
    if (!a.route || a.won || a.castleTaken || a.target < 0 || !this.players[a.target].alive) return;
    let back = 0;
    for (const t of a.route) {
      if (this.owner[t] !== a.attacker) continue; // (déjà repris, ou passé à un autre)
      this.setOwner(t, a.target);
      back++;
    }
    a.route = null;
    if (!back) return;
    const p = this.players[a.attacker], d = this.players[a.target];
    if (d.isHuman) UI.log(tr(`🛡️ L'assaut ${this.deName(p.name)} a échoué : tu reprends les terres de son passage (${fmt(back)} cases).`, `🛡️ ${p.name}'s assault has failed: you take back the land along its way (${fmt(back)} tiles).`), 'good', p);
    else if (p.isHuman) UI.log(tr(`🏳️ Ton assaut a échoué : ${d.name} reprend les terres de ton passage (${fmt(back)} cases).`, `🏳️ Your assault has failed: ${d.name} takes back the land along your way (${fmt(back)} tiles).`), 'warn', d);
  },

  // Le royaume p n'a-t-il plus que des avant-postes ? Plus aucune ville ni port fortifié, et toutes ses terres sont
  // dans des zones d'avant-poste (ses terres d'origine sont perdues).
  outpostsOnly(p) {
    if (!p.bCount[B_OUTPOST] || this.strongholds(p.id, false).length) return false;
    const r = this.regions(true);
    let any = false;
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] !== p.id) continue;
      if (!r.anyOutpost[k]) return false;
      any = true;
    }
    return any;
  },

  // Un royaume qui n'a plus que des avant-postes est perdu : il est anéanti (par celui qui lui a pris ses dernières
  // terres), ses avant-postes et leurs bâtiments sont supprimés, et leurs zones redeviennent des terres libres.
  loseKingdom(p) {
    const by = p.lastHitBy !== undefined && this.players[p.lastHitBy].alive ? p.lastHitBy : -1;
    UI.log(tr(`⛺ ${p.name} n'a plus que des avant-postes : son royaume est perdu, ses avant-postes sont abandonnés.`, `⛺ ${p.name} has nothing left but outposts: their kingdom is lost, their outposts are abandoned.`), p.isHuman ? 'warn' : '', p);
    this.eliminate(p.id, by);
    for (const e of this.expeditions) if (e.pid === p.id) e.done = true; // (ses bateaux en mer sont perdus)
    for (const a of this.buildingTiles.slice()) if (this.owner[a] === p.id) this.removeBuilding(a);
    for (let i = 0; i < this.N; i++) if (this.owner[i] === p.id) this.setOwner(i, -1);
  },

  // Plus aucun port : plus de lien par la mer avec les avant-postes. Ils sont supprimés de la carte, avec leurs
  // soldats (perdus : aucun bateau ne peut les ramener) ; leurs zones (pas reliées au royaume ni tenues par une
  // ville ou un port fortifié) redeviennent des terres libres, avec leurs bâtiments.
  dropOutposts(p) {
    const r = this.regions(true), zone = [];
    let lost = 0, n = 0;
    for (const [a, o] of [...this.outposts]) {
      if (this.owner[a] !== p.id) continue;
      const k = r.comp[a];
      if (k >= 0 && r.owner[k] === p.id && r.anyOutpost[k] && !r.held[k] && !r.heart[k]) {
        zone.push(...r.order.subarray(r.start[k], r.start[k] + r.size[k]));
      }
      lost += (o.stationed || 0) + (this.garrison[a] || 0);
      this.removeBuilding(a);
      n++;
    }
    const tiles = new Set(zone);
    for (const a of this.buildingTiles.slice()) if (this.owner[a] === p.id && tiles.has(a)) this.removeBuilding(a);
    for (const t of tiles) if (this.owner[t] === p.id) this.setOwner(t, -1);
    if (p.isHuman && n) {
      UI.log(tr(`⚓ Tu as perdu ton dernier port : ${n > 1 ? `tes ${n} avant-postes sont abandonnés` : 'ton avant-poste est abandonné'}` +
        (lost >= 1 ? ` et leurs ${fmt(lost)} soldats sont perdus` : '') + ' (plus aucun bateau ne peut les rejoindre).',
        `⚓ You lost your last port: ${n > 1 ? `your ${n} outposts are abandoned` : 'your outpost is abandoned'}` +
        (lost >= 1 ? ` and their ${fmt(lost)} soldiers are lost` : '') + ' (no ship can reach them any more).'), 'warn');
    }
  },

  eliminate(id, by) {
    const p = this.players[id];
    if (!p.alive) return;
    p.alive = false;
    p.troops = 0;
    this.leavePact(p);
    for (const a of this.attacks) if (a.attacker === id && !a.done) this.endAttack(a);
    const killer = by >= 0 ? this.players[by] : null;
    if (killer) killer.kills++;
    UI.log(tr(`☠️ ${p.name} a été anéanti${killer ? ' par ' + killer.name : ''} !`, `☠️ ${p.name} has been wiped out${killer ? ' by ' + killer.name : ''}!`), p.isHuman ? 'warn' : '', killer ? [p, killer] : p);
    // Le vainqueur reçoit une prime (ELIMINATION_BOUNTY) et le trésor qui restait au royaume anéanti
    const treasure = Math.max(0, Math.floor(p.gold));
    p.gold = 0;
    if (killer && killer.alive) {
      killer.gold += CONFIG.ELIMINATION_BOUNTY + treasure;
      if (killer.isHuman) UI.log(tr(`💰 Prime de conquête : +${fmt(CONFIG.ELIMINATION_BOUNTY)} pièces, et le trésor ${this.deName(p.name)} : +${fmt(treasure)} !`, `💰 Conquest bounty: +${fmt(CONFIG.ELIMINATION_BOUNTY)} gold, plus ${p.name}'s treasury: +${fmt(treasure)}!`), 'good', p);
    }
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
      return pa.isHuman ? tr(`Tu fais déjà partie d'un pacte, et ${pb.name} d'un autre.`, `You are already in a pact, and ${pb.name} in another one.`)
        : tr(`${pa.name} et ${pb.name} sont déjà dans des pactes différents.`, `${pa.name} and ${pb.name} are already in different pacts.`);
    }
    const pact = pa.pact >= 0 ? pa.pact : pb.pact;
    if (pact >= 0 && this.pactMembers(pact).length >= CONFIG.MAX_PACT_SIZE) {
      return tr(`Le ${this.pacts.get(pact).name} est complet (${CONFIG.MAX_PACT_SIZE} royaumes maximum).`, `The ${this.pacts.get(pact).name} is full (${CONFIG.MAX_PACT_SIZE} kingdoms maximum).`);
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
    if (!this.pactsAllowed) return tr('Les pactes sont interdits dans cette partie : chacun pour soi !', 'Pacts are forbidden in this game: every kingdom for itself!');
    if (!from.alive || !to.alive || fromId === toId) return tr('Ce royaume n\'existe plus.', 'This kingdom no longer exists.');
    if (this.areAllied(fromId, toId)) return tr(`Tu es déjà allié avec ${to.name}.`, `You are already allied with ${to.name}.`);
    const block = this.pactBlock(fromId, toId);
    if (block) return block;
    const wait = (from.refusedUntil[toId] || 0) - this.tick;
    if (wait > 0) return tr(`${to.name} a refusé récemment. Réessaie dans ${Math.ceil(wait / CONFIG.TICKS_PER_SECOND)} s.`, `${to.name} refused recently. Try again in ${Math.ceil(wait / CONFIG.TICKS_PER_SECOND)} s.`);
    // Seul le fondateur d'un pacte (celui qui l'a proposé) y fait entrer de nouveaux membres : un autre membre ne
    // peut pas inviter, et une demande pour rejoindre le pacte va à son fondateur
    if (from.pact >= 0 && to.pact < 0) {
      const f = this.pactFounder(from.pact);
      if (f && f.id !== fromId) {
        return tr(`Seul ${f.name}, fondateur du ${this.pactName(from)}, peut faire entrer de nouveaux membres.`, `Only ${f.name}, founder of the ${this.pactName(from)}, can let new members in.`);
      }
    }
    const judge = to.pact >= 0 && from.pact < 0 ? this.pactFounder(to.pact) || to : to;
    if (judge.isHuman) return UI.askAlliance(from) ? 'pending' : 'refused';
    if (this.wouldAccept(judge, from)) {
      this.makeAlliance(fromId, toId);
      if (judge !== to && from.isHuman) UI.log(tr(`🤝 ${judge.name}, fondateur du pacte, a accepté ta demande.`, `🤝 ${judge.name}, founder of the pact, accepted your request.`), 'good', judge);
      return 'accepted';
    }
    this.refuseAlliance(fromId, toId);
    if (judge !== to && from.isHuman) UI.log(tr(`🤝 ${judge.name}, fondateur du ${this.pactName(to)}, a refusé ta demande.`, `🤝 ${judge.name}, founder of the ${this.pactName(to)}, refused your request.`), 'warn', judge);
    return 'refused';
  },

  // Le fondateur du pacte id (celui qui l'a proposé) : lui seul accepte de nouveaux membres. S'il l'a quitté (ou
  // s'il est tombé), un autre membre prend sa place.
  pactFounder(id) {
    const pact = this.pacts.get(id);
    if (!pact) return null;
    const members = this.pactMembers(id);
    let f = this.players[pact.founder];
    if (!f || !members.includes(f)) {
      f = members[0] || null;
      if (f) pact.founder = f.id;
    }
    return f;
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
      this.pacts.set(id, { name: tr(`Pacte ${this.deName(pa.name)}`, `Pact of ${pa.name}`), founder: pa.id }); // (a : celui qui l'a proposé)
      pa.pact = pb.pact = id;
      UI.log(tr(`🤝 ${pa.name} et ${pb.name} forment le ${this.pacts.get(id).name} !`, `🤝 ${pa.name} and ${pb.name} form the ${this.pacts.get(id).name}!`), 'good', [pa, pb]);
    } else {
      const host = pa.pact >= 0 ? pa : pb, joiner = host === pa ? pb : pa;
      joiner.pact = host.pact;
      UI.log(tr(`🤝 ${joiner.name} rejoint le ${this.pactName(host)} !`, `🤝 ${joiner.name} joins the ${this.pactName(host)}!`), 'good', [joiner, host]);
    }
    this.version++;
    // Les combats entre membres du pacte s'arrêtent, les soldats rentrent
    for (const at of this.attacks) {
      if (at.target >= 0 && this.areAllied(at.attacker, at.target)) this.endAttack(at);
    }
  },

  // Envoyer des soldats à un allié : il n'en reçoit que ALLY_GIFT_RATIO (sans dépasser son armée maximum).
  // Renvoie un message d'erreur, ou le nombre de soldats reçus.
  sendTroopsToAlly(pid, ally, troops) {
    const p = this.players[pid], q = this.players[ally];
    if (!q || !q.alive || !this.areAllied(pid, ally)) return tr('On ne peut envoyer des soldats qu\'à un allié.', 'Soldiers can only be sent to an ally.');
    troops = Math.floor(Math.min(troops, p.troops));
    // pas plus que la place qu'il lui reste dans son armée
    const room = Math.max(0, this.maxTroops(q) - this.armySize(q));
    troops = Math.min(troops, Math.floor(room / CONFIG.ALLY_GIFT_RATIO));
    if (troops < 1) return room < 1 ? tr(`L'armée ${this.deName(q.name)} est déjà pleine.`, `${q.name}'s army is already full.`) : tr('Pas assez de soldats !', 'Not enough soldiers!');
    const got = troops * CONFIG.ALLY_GIFT_RATIO;
    p.troops -= troops;
    q.troops += got;
    if (q.isHuman) UI.log(tr(`🎁 ${p.name} t'envoie ${fmt(got)} soldats !`, `🎁 ${p.name} sends you ${fmt(got)} soldiers!`), 'good', p);
    return got;
  },

  // Envoyer de l'or à un allié du pacte (il le reçoit tout de suite, en entier). Renvoie un message d'erreur, ou null.
  sendGoldToAlly(pid, ally, gold) {
    const p = this.players[pid], q = this.players[ally];
    if (!q || !q.alive || !this.areAllied(pid, ally)) return tr('On ne peut envoyer de l\'or qu\'à un allié de son pacte.', 'Gold can only be sent to an ally in your pact.');
    gold = Math.floor(Math.min(gold, p.gold));
    if (gold < 1) return tr('Pas assez d\'or !', 'Not enough gold!');
    p.gold -= gold;
    q.gold += gold;
    if (q.isHuman) UI.log(tr(`💰 ${p.name} t'envoie ${fmt(gold)} d'or !`, `💰 ${p.name} sends you ${fmt(gold)} gold!`), 'good', p);
    return null;
  },

  // Le royaume pid est-il dans un pacte éternel (un camp du mode « Factions ») ? Il ne peut ni le quitter ni le trahir.
  eternalPact(pid) {
    const id = this.players[pid].pact;
    return id >= 0 && !!(this.pacts.get(id) || {}).eternal;
  },

  // Un traître a sa défense affaiblie pendant TRAITOR_DURATION secondes
  isTraitor(p) { return this.tick < p.traitorUntil; },

  // Trahir un allié = quitter son pacte (en traître)
  breakAlliance(traitorId, otherId) {
    if (!this.areAllied(traitorId, otherId) || this.eternalPact(traitorId)) return;
    const traitor = this.players[traitorId], name = this.pactName(traitor);
    this.leavePact(traitor);
    traitor.traitorUntil = this.tick + CONFIG.TRAITOR_DURATION * CONFIG.TICKS_PER_SECOND;
    UI.log(tr(`🗡️ ${traitor.name} a trahi le ${name} ! Sa défense est affaiblie.`, `🗡️ ${traitor.name} has betrayed the ${name}! Their defense is weakened.`), 'warn', traitor);
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
    if (this.tradeRoutes.length) {
      if (this.tick % TPS === 0) this.checkTrades();
      this.produceTrades();
    }

    // Les garnisons des châteaux se reconstituent (sauf celle qui est en train de combattre)
    // (elles ne comptent pas dans l'armée du royaume : son maximum ne les freine pas)
    const besieged = new Set(this.attacks.filter(a => !a.done && !this.isPreparing(a)).map(a => a.targetCastle));
    for (const c of this.buildingTiles) {
      if (this.building[c] === B_OUTPOST) continue; // (la garnison d'un avant-poste ne se reconstitue pas : voir stepOutposts)
      const max = this.garrisonMax(c);
      if (!max || max === Infinity || this.owner[c] < 0 || besieged.has(c)) continue;
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
    this.stepMines();
    this.stepWalls();
    this.stepTinyIslands();
    this.stepFaith();
    this.stepOutposts();
    // Toutes les 2 secondes : un morceau a pu être coupé autrement (débarquement…)
    // (le découpage n'est refait que si l'un d'eux a vraiment englobé des terres)
    if (this.tick % (2 * TPS) === 0) for (const p of this.players) if (p.alive) this.captureEnclaves(p.id);
    // Toutes les 2 secondes : un royaume qui n'a plus que des avant-postes est perdu (voir outpostsOnly)
    if (this.tick % (2 * TPS) === 0) for (const p of this.players) if (p.alive && this.outpostsOnly(p)) this.loseKingdom(p);
    // ... et un royaume qui a perdu tous ses ports perd aussi tous ses avant-postes (voir dropOutposts)
    if (this.tick % (2 * TPS) === 0) for (const p of this.players) if (p.alive && !p.bCount[B_PORT] && p.bCount[B_OUTPOST]) this.dropOutposts(p);
    // Le joueur vient de perdre le lien entre son territoire et ses châteaux : on le prévient (une fois)
    const h = this.human;
    if (this.tick % (2 * TPS) === 0 && h && h.alive) {
      const cut = this.hasUnlinked(h.id);
      if (cut && !h.cutWarned) {
        UI.log(tr('🚩 Ton territoire est coupé de tous tes châteaux ! Tes soldats sont bloqués dans ton château isolé : ' +
          'ce territoire n\'est plus défendu et aucune armée ne peut en partir. Relie-le (clique sur ton château isolé) ' +
          'ou bâtis un nouveau château.', '🚩 Your territory is cut off from all your castles! Your soldiers are stuck in your isolated castle: ' +
          'this territory is no longer defended and no army can leave it. Link it (click your isolated castle) ' +
          'or build a new castle.'), 'warn');
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
    // (mode « Factions » : les royaumes de son camp ne comptent pas comme rivaux, et les terres du camp comptent ensemble)
    const botsAlive = this.players.some(p => !p.isHuman && p.alive && !(this.factions && this.areAllied(p.id, h.id)));
    const share = (this.factions ? this.players.filter(p => p === h || this.areAllied(p.id, h.id)) : [h])
      .reduce((s, p) => s + p.tiles, 0) / this.landCount;
    // Victoire : 70 % des terres (WIN_RATIO ; une seule fois, on peut ensuite continuer à jouer),
    // ou plus aucun royaume rival (fin de la partie)
    if (!botsAlive || (!this.victoryShown && share >= CONFIG.WIN_RATIO)) {
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

// (toujours arrondi vers le bas : 1 999 s'écrit « 1.9k », jamais « 2.0k » avant d'avoir vraiment 2 000)
function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (Math.floor(n / 1e5) / 10).toFixed(1) + 'M';
  if (n >= 1e4) return Math.floor(n / 1000) + 'k';
  if (n >= 1000) return (Math.floor(n / 100) / 10).toFixed(1) + 'k';
  return String(n);
}

// Une durée en secondes, écrite « 2:05 »
function clock(secs) {
  secs = Math.max(0, Math.ceil(secs));
  return Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
}

// (MinHeap, la petite file de priorité des chemins les plus courts, est dans map.js : la carte s'en sert aussi)
