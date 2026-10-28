// ⚜️ RÈGLES DU SCÉNARIO « LA GUERRE DE CENT ANS » (les données et les réglages : voir centans.js)
// Elles s'ajoutent aux règles du jeu (GameRules, voir game.js). L'état du scénario est dans Game.hy :
//  - role / capital : la faction de chaque rôle, et sa capitale ; cities / churches : nom français → case d'ancrage ;
//  - loyalty : la fidélité des grands vassaux (voir VASSALS) ; pact : les deux camps (pactes éternels) ;
//  - sick / immune / closed : la peste (voir PLAGUE) ; truceUntil : la trêve en cours ;
//  - fired : les événements déjà passés ; done : les objectifs remplis (pour les messages).

Object.assign(GameRules, {
  // --- Mise en place : la France de 1337 ---
  startCentAns(opts) {
    const C = CENTANS, W = this.W, H = this.H, P = CENTANS_PROJ, TPS = CONFIG.TICKS_PER_SECOND;
    const at = (lon, lat) => [geoX(P, lon, W), geoY(P, lat, H)];
    this.pactsAllowed = false; // (pas d'autres pactes que les deux camps)
    const diff = C.RANSOM[opts.difficulty] ? opts.difficulty : 'normal';
    const hy = this.hy = { diff, role: {}, capital: {}, cities: new Map(), churches: new Map(), loyalty: {}, pact: {},
      legitBonus: {}, crowned: { france: true, angleterre: false }, fired: new Set(), done: {},
      sick: new Map(), immune: new Map(), closed: new Map(), truceUntil: 0, kingIdx: 0, engIdx: 0, comps: 0 };
    // Les factions (le joueur incarne celle de sa bannière)
    for (const f of C.factions) {
      const b = BANNERS.findIndex(x => x.set === 'centans' && x.id === f.id);
      const p = b === opts.banner ? this.human : this.addPlayer(f.name, b, false);
      p.name = f.name;
      p.role = f.id;
      p.defensive = !!f.defensive;
      p.noArmy = !!f.noArmy;
      p.raiders = !!f.raiders;
      p.dormant = !!f.landless; // (🗡️ les Grandes Compagnies : pas de terres, elles surgissent pour piller)
      p.garrisonBoost = f.garrison || 1; // (le pape d'Avignon : une grande garnison, voir garrisonMax)
      p.gold = C.START_GOLD;
      hy.role[f.id] = p.id;
    }
    // Les terres de 1337 : une case va à la première faction dont le territoire la contient
    const polys = [];
    for (const f of C.factions) {
      for (const ring of f.lands) {
        const pts = ring.map(([lon, lat]) => at(lon, lat)), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        polys.push({ pid: hy.role[f.id], pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
      }
    }
    this.claimLands(polys, C.BORDER_WARP); // (des frontières qui serpentent : voir claimLands)
    // Les enclaves : le comté d'Évreux (Navarre), le Ponthieu (Angleterre)
    for (const f of C.factions) {
      for (const [lon, lat, R] of f.enclaves || []) {
        const [ex, ey] = at(lon, lat);
        for (let y = Math.floor(ey - R); y <= ey + R; y++) for (let x = Math.floor(ex - R); x <= ex + R; x++) {
          const i = y * W + x;
          if (x >= 0 && y >= 0 && x < W && y < H && DMath.hypot(x + 0.5 - ex, y + 0.5 - ey) <= R && this.claimable(i)) this.setOwner(i, hy.role[f.id]);
        }
      }
    }
    // Les villes et les églises, au plus près de leur vraie place (avec leur nom, écrit sur la carte)
    for (const f of C.factions) {
      if (!f.capital) continue;
      const p = this.players[hy.role[f.id]];
      const cap = this.placeOnLand(p, B_CASTLE, ...at(f.capital[0], f.capital[1]), Math.max(2, f.capitalLevel || 2));
      if (cap >= 0) { p.capital = cap; hy.capital[f.id] = cap; p.castlesBuilt = 1; this.placeNames.set(cap, f.capital[2]); hy.cities.set(f.capital[3], cap); }
      for (const [type, list, map] of [[B_CASTLE, f.cities, hy.cities], [B_CHURCH, f.churches, hy.churches]]) {
        for (const c of list) {
          const a = this.placeOnLand(p, type, ...at(c[0], c[1]), 1);
          if (a >= 0) { this.placeNames.set(a, c[2]); map.set(c[3], a); }
        }
      }
      // (les grandes capitales : 2 moulins et une caserne de niveau 2 dans leur muraille)
      if (f.production && cap >= 0) {
        const h = this.sizeOf(B_CASTLE) / 2, cx = cap % W + h, cy = ((cap / W) | 0) + h, inside = j => this.inWalls(cap, j);
        for (const type of [B_MILL, B_MILL, B_BARRACKS]) this.placeOnLand(p, type, cx, cy, 2, inside);
      }
    }
    // Ce qui n'est tenu par aucune ville (îlots, bouts de côte…) redevient une terre libre
    const r = this.regions(true), loose = [];
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] >= 0 && !r.held[k]) loose.push(...r.order.subarray(r.start[k], r.start[k] + r.size[k]));
    }
    for (const t of loose) {
      if (this.building[t] && this.anchor[t] === t) this.removeBuilding(t);
      this.setOwner(t, -1);
    }
    // Les armées de départ ; le pape d'Avignon n'a qu'une grande garnison
    for (const p of this.players) p.troops = p.noArmy ? 0 : Math.round(this.maxTroops(p) * C.START_ARMY);
    // Les deux camps : des pactes éternels (on ne peut pas trahir son roi). L'Écosse est dans celui du roi de France
    // (l'Auld Alliance) ; les grands vassaux y entrent ou en sortent selon leur fidélité (voir stepVassals).
    for (const [camp, name] of [['france', tr('Couronne de France', 'Crown of France')], ['angleterre', tr('Parti anglais', 'English party')]]) {
      const id = this.nextPactId++;
      this.pacts.set(id, { name, founder: hy.role[camp], eternal: true });
      hy.pact[camp] = id;
    }
    for (const f of C.factions) {
      const p = this.players[hy.role[f.id]];
      if (f.camp) p.pact = hy.pact[f.camp];
      // (un grand vassal que le joueur incarne est indépendant : il choisit lui-même son chemin)
      if (f.vassal && !p.isHuman) {
        hy.loyalty[f.id] = f.legit;
        if (f.legit >= CENTANS.VASSALS.JOIN) p.pact = hy.pact.france;
        else if (f.legit <= -CENTANS.VASSALS.JOIN) p.pact = hy.pact.angleterre;
      }
    }
    this.version++;
    this.phase = 'playing';
    this.paused = true;
  },

  // --- Outils ---
  hyP(role) { return this.players[this.hy.role[role]]; },
  // L'année en cours (avec ses décimales), et le tour de jeu où commence l'année y
  hyYear() {
    const C = CENTANS;
    return C.YEAR_START + this.tick / (C.GAME_MINUTES * 60 * CONFIG.TICKS_PER_SECOND) * (C.YEAR_END - C.YEAR_START);
  },
  // La ville (ou l'église) de ce nom français, si elle existe encore (sinon -1)
  hyCity(name) {
    const a = this.hy.cities.has(name) ? this.hy.cities.get(name) : this.hy.churches.get(name);
    return a !== undefined && this.building[a] ? a : -1;
  },
  hyCityName(a) { return this.placeNames.get(a) || this.targetLabel(a); },
  // Le camp d'un royaume : 'france', 'angleterre', ou null (aucun)
  hyCampOf(pid) {
    if (pid < 0) return null;
    const pact = this.players[pid].pact, hy = this.hy;
    return pact === hy.pact.france ? 'france' : pact === hy.pact.angleterre ? 'angleterre' : null;
  },
  // Le roi de France du moment (voir KINGS)
  hyKing() { return CENTANS.KINGS[this.hy.kingIdx]; },
  hyEngKing() { return CENTANS.ENGLISH_KINGS[this.hy.engIdx]; },
  // 📜 Un grand événement : un parchemin pour le joueur du roi de France (voir EVENTS dans centans.js) ou du roi
  // d'Angleterre (ENGLAND_EVENTS : sa campagne à lui), un simple message (log, s'il y en a un) pour les autres
  hyEvent(key, vars, log, kind = 'warn', who) {
    const role = this.human.role;
    const ev = role === 'france' ? CENTANS.EVENTS[key] : role === 'angleterre' ? CENTANS.ENGLAND_EVENTS[key] : null;
    if (ev) UI.parchment(ev, vars);
    else if (log) UI.log(log, kind, who);
  },

  // --- 👑 La Légitimité (à la place de la Croyance : voir faithAll) ---
  hyLegitAll() {
    const C = CENTANS, L = C.LEGIT, hy = this.hy, f = this.players.map(p => p.raiders ? 0 : L.BASE[p.role] || L.OTHER_BASE);
    const key = new Set(C.KEY_CITIES.map(n => hy.cities.get(n)));
    for (const c of this.castles) if (this.owner[c] >= 0) f[this.owner[c]] += key.has(c) ? L.KEY_CITY : L.CITY;
    for (const a of this.buildingTiles) {
      const o = this.owner[a];
      if (this.building[a] !== B_CHURCH || o < 0 || this.underConstruction(a)) continue;
      f[o] += this.buildingInfo(a).faith * L.CHURCH;
    }
    for (const p of this.players) if (hy.legitBonus[p.id]) f[p.id] += hy.legitBonus[p.id];
    // Le roi de France : pas sacré, captif, ou en pleine crise de folie
    const fr = this.hyP('france');
    if (fr.alive) {
      if (!hy.crowned.france) f[fr.id] += L.UNCROWNED;
      if (hy.ransom && !hy.ransom.paid) f[fr.id] += L.CAPTIVE;
      if (this.tick < (hy.fitUntil || 0)) f[fr.id] += L.MAD;
    }
    return f.map(v => Math.max(0, v));
  },
  hyAddLegit(pid, n) { this.hy.legitBonus[pid] = (this.hy.legitBonus[pid] || 0) + n; this.faithCache = null; },

  // --- Chaque seconde : le calendrier et tous les mécanismes du scénario ---
  stepCentAns() {
    const hy = this.hy, TPS = CONFIG.TICKS_PER_SECOND;
    if (!hy || this.tick % TPS) return;
    const y = this.hyYear();
    this.stepKings(y);
    this.stepHyEvents(y);
    this.stepVassals();
    this.hySeeAttacks();
    this.stepPlague(y);
    this.stepCompagnies(y);
    this.stepChevauchee(y);
    this.stepRansom();
    this.stepSacre();
    this.stepJoan(y);
    this.stepHyEngland(y);
    // 🤪 Charles VI : une crise de folie de temps en temps (voir MAD)
    if (hy.madFrom !== undefined && this.hyP('france').alive && this.tick >= hy.nextFit) {
      hy.fitUntil = this.tick + CENTANS.MAD.TIME * TPS;
      hy.nextFit = this.tick + CENTANS.MAD.EVERY * TPS;
      this.faithCache = null;
      const fr = this.hyP('france');
      if (fr.isHuman) UI.log(tr('🤪 Le roi est pris d\'une crise de folie : il recrute moitié moins, et sa Légitimité vacille.', '🤪 The king is seized by a fit of madness: he recruits half as fast, and his Legitimacy wavers.'), 'warn');
    }
    if (hy.fitUntil && this.tick === hy.fitUntil) this.faithCache = null;
  },

  // 👑 Les règnes : un nouveau roi de France (ou d'Angleterre) à l'année prévue
  stepKings(y) {
    const hy = this.hy, C = CENTANS, fr = this.hyP('france');
    while (hy.kingIdx + 1 < C.KINGS.length && y >= C.KINGS[hy.kingIdx + 1].from) {
      hy.kingIdx++;
      const k = this.hyKing();
      // (un roi captif meurt en captivité : sa rançon ne compte plus)
      if (hy.ransom && !hy.ransom.paid) hy.ransom.paid = true;
      // (un nouveau roi n'est vraiment roi qu'une fois sacré à Reims : tout de suite s'il tient Reims)
      hy.crowned.france = false;
      hy.reignStart = this.tick;
      this.faithCache = null;
      const key = ['jean2', 'charles5', 'charles6', 'charles7'][hy.kingIdx - 1];
      if (key) this.hyEvent(key, {}, tr(`👑 ${k.name} est le nouveau roi de France.`, `👑 ${k.name} is the new King of France.`), '', fr);
      if (hy.kingIdx === 4) { hy.madFrom = undefined; hy.fitUntil = 0; } // (Charles VII n'est pas fou)
    }
    while (hy.engIdx + 1 < C.ENGLISH_KINGS.length && y >= C.ENGLISH_KINGS[hy.engIdx + 1].from) {
      hy.engIdx++;
      const en = this.hyP('angleterre'), E = C.ENGLAND;
      if (!en.alive) continue;
      // (Henri IV l'usurpateur coûte de la Légitimité, qu'Henri V, le roi victorieux, rend : voir USURPER)
      if (hy.engIdx === 2) this.hyAddLegit(en.id, -E.USURPER);
      if (hy.engIdx === 3) this.hyAddLegit(en.id, E.USURPER);
      this.hyEvent(['richard2', 'henri4', 'henri5', 'henri6'][hy.engIdx - 1], {},
        tr(`🦁 ${this.hyEngKing().name} est le nouveau roi d'Angleterre.`, `🦁 ${this.hyEngKing().name} is the new King of England.`), '', en);
    }
  },

  // ⛪ Le sacre : le roi de France (ou d'Angleterre, qui revendique la couronne) qui tient Reims s'y fait sacrer
  stepSacre() {
    const hy = this.hy, reims = this.hyCity('Reims'), L = CENTANS.LEGIT;
    if (reims < 0) return;
    for (const role of ['france', 'angleterre']) {
      const p = this.hyP(role);
      if (!p.alive || hy.crowned[role] || this.owner[reims] !== p.id) continue;
      // (le roi de France a toujours sa couronne : pas de bonus pour un sacre « ordinaire », seulement la fin du malus ;
      //  le premier sacre du roi d'Angleterre, lui, fait de lui un vrai roi de France)
      hy.crowned[role] = true;
      if (role === 'angleterre') this.hyAddLegit(p.id, L.SACRE);
      else this.faithCache = null;
      const late = this.tick - (hy.reignStart || 0) > 3 * CONFIG.TICKS_PER_SECOND;
      if (p.isHuman && role === 'france' && late) UI.parchment(CENTANS.EVENTS.sacre, { legit: -L.UNCROWNED });
      else if (p.isHuman && role === 'angleterre') UI.parchment(CENTANS.ENGLAND_EVENTS.sacre, { legit: L.SACRE });
      else UI.log(role === 'france' ? tr(`⛪ ${this.hyKing().name} est sacré à Reims.`, `⛪ ${this.hyKing().name} is crowned at Reims.`)
        : tr(`⛪ Le roi d'Angleterre se fait sacrer roi de France à Reims ! (+${L.SACRE} de Légitimité)`, `⛪ The King of England has himself crowned King of France at Reims! (+${L.SACRE} Legitimacy)`), p.isHuman ? 'good' : 'warn', p);
    }
  },

  // 📜 Les grands événements, à leur année (voir EVENTS dans centans.js)
  stepHyEvents(y) {
    const hy = this.hy, C = CENTANS, TPS = CONFIG.TICKS_PER_SECOND, diff = hy.diff;
    const once = (key, year) => { if (y < year || hy.fired.has(key)) return false; hy.fired.add(key); return true; };
    const fr = this.hyP('france'), en = this.hyP('angleterre'), army = C.EVENT_ARMY[diff];
    if (once('artevelde', 1339)) {
      const fl = this.hyP('flandre');
      if (fl.alive && !fl.isHuman) { hy.loyalty.flandre = -60; this.stepVassals(); }
      this.hyEvent('artevelde', {}, tr('🧶 1339 : les villes de Flandre se rangent du côté du roi d\'Angleterre.', '🧶 1339: the towns of Flanders side with the King of England.'), '', fl);
    }
    if (once('ecluse', 1340)) this.hyNavalDefeat('france', 'ecluse');
    if (once('bretagne', 1341)) {
      const br = this.hyP('bretagne');
      if (br.alive) {
        br.troops *= 0.5;
        if (!br.isHuman) { hy.loyalty.bretagne = -40; this.stepVassals(); }
        this.hyEvent('bretagne', {}, tr('⚔️ 1341 : la guerre de Succession de Bretagne éclate ; Jean de Montfort appelle les Anglais.', '⚔️ 1341: the War of the Breton Succession breaks out; John of Montfort calls in the English.'), '', br);
      }
    }
    for (const t of C.TRUCES) {
      if (!once(t.key, t.year)) continue;
      // (🦁 le joueur anglais choisit de signer, ou non, la paix de Brétigny : voir hyChoose)
      if (t.key === 'bretigny' && en.isHuman && en.alive && fr.alive) this.hyOffer('bretigny', { truce: t });
      else this.hyStartTruce(t);
    }
    // 1346 : Édouard III débarque en Normandie et pille Caen (une chevauchée), puis assiège Calais
    if (once('crecy', 1346)) this.hyEnglishLanding('crecy', 'Caen', army, true);
    if (once('calais', 1346.7)) this.hyEnglishAssault('calais', 'Calais', army);
    if (once('peste', C.PLAGUE.YEAR)) this.hyStartPlague();
    if (once('dauphine', 1349)) this.hyDauphine();
    if (once('navarre', 1354)) {
      const na = this.hyP('navarre');
      if (na.alive && !na.isHuman) { hy.loyalty.navarre = -50; this.stepVassals(); }
      if (na.alive) this.hyEvent('navarre', {}, tr('🐍 1354 : Charles le Mauvais, roi de Navarre, intrigue avec les Anglais.', '🐍 1354: Charles the Bad, King of Navarre, plots with the English.'), '', na);
    }
    // 1356 : le Prince Noir sort de Bordeaux et remonte vers la Loire en pillant tout (une chevauchée)
    if (once('poitiers', 1356)) this.hyEnglishRaidFrom('poitiers', 'Poitiers', army);
    if (once('jacquerie', 1358) && fr.alive) {
      hy.jacquerieUntil = this.tick + 60 * TPS;
      const paris = this.hyCity('Paris');
      if (paris >= 0 && this.owner[paris] === fr.id) this.garrison[paris] *= 0.5;
      this.hyEvent('jacquerie', {}, tr('🔥 1358 : la Jacquerie soulève les campagnes françaises.', '🔥 1358: the Jacquerie sets the French countryside ablaze.'), '', fr);
    }
    if (once('espagne', C.COMPAGNIES.SPAIN[0])) this.hyEvent('espagne', {}, tr('🗡️ 1366 : Du Guesclin emmène les Grandes Compagnies en Castille.', '🗡️ 1366: Du Guesclin leads the Great Companies to Castile.'), 'good');
    if (once('reprise', 1369)) {
      const ca = this.hyP('castille');
      if (ca.alive && fr.alive && !ca.isHuman) { ca.pact = hy.pact.france; this.version++; }
      this.hyEvent('reprise', {}, tr('⚔️ 1369 : la guerre reprend ; la Castille rejoint le camp du roi de France.', '⚔️ 1369: the war resumes; Castile joins the camp of the King of France.'), '', ca);
    }
    if (once('larochelle', 1372)) this.hyNavalDefeat('angleterre', 'larochelle');
    if (once('flandre', 1384)) this.hyFlandersToBurgundy();
    if (once('folie', 1392) && fr.alive) {
      hy.madFrom = this.tick;
      hy.nextFit = this.tick + 20 * TPS;
      this.hyEvent('folie', {}, tr('🤪 1392 : le roi Charles VI sombre dans la folie.', '🤪 1392: King Charles VI sinks into madness.'), '', fr);
    }
    if (once('armagnacs', 1407)) {
      const bo = this.hyP('bourgogne');
      if (fr.alive) fr.troops *= 0.75;
      if (bo.alive && !bo.isHuman) { hy.loyalty.bourgogne = Math.min(hy.loyalty.bourgogne, 0); this.stepVassals(); }
      this.hyEvent('armagnacs', {}, tr('🗡️ 1407 : Armagnacs contre Bourguignons, la France se déchire.', '🗡️ 1407: Armagnacs against Burgundians, France tears itself apart.'), '', bo);
    }
    // 1415 : Henri V débarque à Harfleur (une vraie conquête, cette fois)
    if (once('azincourt', 1415)) this.hyEnglishLanding('azincourt', 'Harfleur', Math.round(army * 1.2), false);
    if (once('montereau', 1419)) {
      const bo = this.hyP('bourgogne');
      if (bo.alive && !bo.isHuman) { hy.loyalty.bourgogne = -70; this.stepVassals(); }
      if (bo.alive) this.hyEvent('montereau', {}, tr('🗡️ 1419 : Jean sans Peur est tué à Montereau ; la Bourgogne s\'allie à l\'Angleterre.', '🗡️ 1419: John the Fearless is killed at Montereau; Burgundy allies with England.'), '', bo);
    }
    if (once('troyes', 1420)) {
      const bo = this.hyP('bourgogne');
      // (le traité de Troyes ne se signe que si la Bourgogne est du côté anglais, et la reine à Paris… chez les Anglais)
      if (en.alive && fr.alive && this.hyCampOf(bo.id) === 'angleterre') {
        this.hyAddLegit(en.id, C.LEGIT.TROYES);
        this.hyAddLegit(fr.id, C.LEGIT.TROYES_FRANCE);
        this.hyEvent('troyes', {}, tr('📜 1420 : par le traité de Troyes, Henri V devient l\'héritier du royaume de France.', '📜 1420: by the Treaty of Troyes, Henry V becomes heir to the kingdom of France.'), '', en);
      }
    }
    if (once('orleans', 1428)) this.hyEnglishAssault('orleans', 'Orléans', army);
    if (once('jeanne', C.JOAN.YEAR) && fr.alive) {
      hy.joan = { state: 'ready' };
      this.hyEvent('jeanne', {}, tr('⚜️ 1429 : Jeanne d\'Arc rejoint l\'armée du roi de France.', '⚜️ 1429: Joan of Arc joins the army of the King of France.'), '', fr);
    }
    if (once('arras', C.ARRAS)) {
      const bo = this.hyP('bourgogne'), legit = this.faithAll();
      if (bo.alive && !bo.isHuman && fr.alive && this.hyCampOf(bo.id) !== 'france') {
        if (legit[fr.id] >= legit[en.id] || !en.alive) {
          hy.loyalty.bourgogne = 80; this.stepVassals();
          this.hyEvent('arras', {}, tr('🕊️ 1435 : au traité d\'Arras, la Bourgogne revient au roi de France.', '🕊️ 1435: at the Treaty of Arras, Burgundy returns to the King of France.'), '', bo);
        } else this.hyEvent('arrasFailed', {}, null);
      }
    }
    if (once('bureau', C.CANNONS) && fr.alive) this.hyEvent('bureau', {}, tr('💣 1439 : les canons des frères Bureau rendent les sièges du roi de France bien plus courts.', '💣 1439: the Bureau brothers\' cannons make the King of France\'s sieges much shorter.'), '', fr);
    if (once('castillon', C.YEAR_END)) this.hyEvent('castillon', {}, tr('🏁 1453 : la bataille de Castillon met fin à la guerre de Cent Ans.', '🏁 1453: the battle of Castillon ends the Hundred Years\' War.'));
  },

  // ⚓ Une défaite navale (l'Écluse pour la France, La Rochelle pour l'Angleterre) : ses ports de la Manche et de
  // l'Atlantique retombent au niveau 1, et elle ne peut plus lancer d'expédition par la mer pendant 2 minutes
  hyNavalDefeat(role, key) {
    const p = this.hyP(role), TPS = CONFIG.TICKS_PER_SECOND;
    if (!p.alive) return;
    for (const a of this.buildingTiles) if (this.building[a] === B_PORT && this.owner[a] === p.id && this.level[a] > 1) this.level[a] = 1;
    p.noNavyUntil = this.tick + 120 * TPS;
    this.version++;
    this.hyEvent(key, {}, role === 'france'
      ? tr('⚓ 1340 : la flotte française est anéantie à l\'Écluse.', '⚓ 1340: the French fleet is annihilated at Sluys.')
      : tr('⚓ 1372 : la flotte anglaise brûle devant La Rochelle.', '⚓ 1372: the English fleet burns before La Rochelle.'), '', p);
  },
  // Pas d'expédition par la mer après une défaite navale (voir hyNavalDefeat)
  hyNavyBlock(pid) {
    const p = this.players[pid];
    if (!this.hy || !(p.noNavyUntil > this.tick)) return null;
    return tr(`⚓ Ta flotte a été détruite : pas d'expédition par la mer avant ${Math.ceil((p.noNavyUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`,
      `⚓ Your fleet was destroyed: no sea expedition for another ${Math.ceil((p.noNavyUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`);
  },

  // 1349 : le Dauphiné (les terres d'Empire autour de Grenoble) passe au roi de France
  hyDauphine() {
    const fr = this.hyP('france'), em = this.hyP('empire'), g = this.hyCity('Grenoble');
    if (!fr.alive || !em.alive || g < 0 || this.owner[g] !== em.id) return;
    const W = this.W, gx = g % W, gy = (g / W) | 0, R = 45;
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] !== em.id) continue;
      const x = i % W, y = (i / W) | 0;
      // (le Dauphiné : autour de Grenoble, au sud de Lyon et à l'ouest des Alpes ; pas au-delà de la Durance)
      if (DMath.hypot(x - gx, y - gy) <= R && x < gx + 25) this.setOwner(i, fr.id);
    }
    this.hyEvent('dauphine', {}, tr('🐬 1349 : le Dauphiné passe au roi de France.', '🐬 1349: the Dauphiné passes to the King of France.'), 'good', fr);
  },

  // 1384 : la Flandre passe à la Bourgogne (le mariage de Philippe le Hardi), avec ses villes, ses soldats et son or
  hyFlandersToBurgundy() {
    const fl = this.hyP('flandre'), bo = this.hyP('bourgogne');
    if (!fl.alive || !bo.alive || fl.isHuman) return;
    const keep = this.castles.filter(c => this.owner[c] === fl.id).map(c => [c, this.garrison[c]]);
    bo.troops += fl.troops;
    bo.gold += fl.gold;
    fl.troops = fl.gold = 0;
    this.eliminate(fl.id, -1, true); // (d'abord : ce n'est pas une conquête, il n'y a ni prime ni message d'anéantissement)
    for (let i = 0; i < this.N; i++) if (this.owner[i] === fl.id) this.setOwner(i, bo.id);
    for (const [c, g] of keep) this.garrison[c] = g;
    for (const w of this.works.values()) if (w.pid === fl.id) w.pid = bo.id;
    this.hyEvent('flandre', {}, tr('💍 1384 : la Flandre passe à la Bourgogne.', '💍 1384: Flanders passes to Burgundy.'), bo.isHuman ? 'good' : '', bo);
  },

  // --- 🕊️ Les trêves ---
  hyStartTruce(t, quiet = false) {
    const hy = this.hy, TPS = CONFIG.TICKS_PER_SECOND;
    hy.truceUntil = this.tick + t.time * TPS;
    // (les assauts en cours entre les deux camps s'arrêtent : les soldats rentrent)
    for (const a of this.attacks) if (!a.done && a.target >= 0 && this.hyEnemies(a.attacker, a.target)) this.endAttack(a);
    const log = tr(`🕊️ ${t.year} : trêve entre les rois de France et d'Angleterre (${t.time} s).`, `🕊️ ${t.year}: truce between the Kings of France and England (${t.time} s).`);
    if (quiet) UI.log(log, 'good');
    else this.hyEvent(t.key, {}, log, 'good');
  },
  hyTruce() { return this.tick < this.hy.truceUntil; },
  // Les deux royaumes sont-ils dans les deux camps ennemis ?
  hyEnemies(a, b) {
    const ca = this.hyCampOf(a), cb = this.hyCampOf(b);
    return !!ca && !!cb && ca !== cb;
  },
  hyTruceBlock(pid, target) {
    if (target < 0 || !this.hyTruce() || !this.hyEnemies(pid, target)) return null;
    return tr(`🕊️ Trêve entre les deux rois : pas d'assaut contre ${this.players[target].name} avant ${Math.ceil((this.hy.truceUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`,
      `🕊️ Truce between the two kings: no assault against ${this.players[target].name} for another ${Math.ceil((this.hy.truceUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`);
  },

  // --- ⚖️ Les grands vassaux ---
  // Leur fidélité glisse vers l'avis du moment (l'écart de Légitimité entre les deux rois) ; au-delà d'un seuil, ils
  // changent de camp. De temps en temps, un roi (bot) achète la fidélité d'un vassal qui hésite.
  stepVassals() {
    const hy = this.hy, V = CENTANS.VASSALS, legit = this.faithAll(), fr = this.hyP('france'), en = this.hyP('angleterre');
    const gap = (fr.alive ? legit[fr.id] : 0) - (en.alive ? legit[en.id] : 0);
    const want = Math.max(-V.PULL, Math.min(V.PULL, gap / V.LEGIT_SCALE));
    for (const role of Object.keys(hy.loyalty)) {
      const p = this.hyP(role);
      if (!p.alive) continue;
      let L = hy.loyalty[role];
      L += (want - L) * V.DRIFT;
      hy.loyalty[role] = L = Math.max(-100, Math.min(100, L));
      const camp = this.hyCampOf(p.id);
      let next = camp;
      if (camp === 'france' && L < V.LEAVE) next = null;
      if (camp === 'angleterre' && L > -V.LEAVE) next = null;
      if (!next && L >= V.JOIN && fr.alive) next = 'france';
      if (!next && L <= -V.JOIN && en.alive) next = 'angleterre';
      if (next !== camp) this.hySetCamp(p, next);
    }
    // (un roi bot qui a de l'or achète la fidélité du vassal le plus hésitant)
    if (this.tick % (V.AI_BRIBE_EVERY * CONFIG.TICKS_PER_SECOND) === 0) {
      for (const king of [fr, en]) {
        if (!king.alive || king.isHuman || king.gold < V.BRIBE_GOLD * 3) continue;
        const sign = king === fr ? 1 : -1;
        const target = Object.keys(hy.loyalty).filter(r => this.hyP(r).alive && hy.loyalty[r] * sign < V.JOIN + 10)
          .sort((a, b) => Math.abs(hy.loyalty[a]) - Math.abs(hy.loyalty[b]))[0];
        if (target) this.hyBribe(king.id, hy.role[target]);
      }
    }
  },
  // Un vassal change de camp
  hySetCamp(p, camp) {
    const hy = this.hy, h = this.human, old = this.hyCampOf(p.id);
    p.pact = camp ? hy.pact[camp] : -1;
    this.version++;
    // (les combats entre nouveaux alliés s'arrêtent, les soldats rentrent)
    for (const a of this.attacks) if (!a.done && a.target >= 0 && this.areAllied(a.attacker, a.target)) this.endAttack(a);
    const mine = this.hyCampOf(h.id), good = camp && camp === mine, bad = (old && old === mine) || (camp && mine && camp !== mine);
    UI.log(camp === 'france' ? tr(`⚖️ ${p.name} se range du côté du roi de France.`, `⚖️ ${p.name} sides with the King of France.`)
      : camp === 'angleterre' ? tr(`⚖️ ${p.name} se range du côté du roi d'Angleterre.`, `⚖️ ${p.name} sides with the King of England.`)
        : tr(`⚖️ ${p.name} ne suit plus aucun des deux rois.`, `⚖️ ${p.name} no longer follows either king.`), good ? 'good' : bad ? 'warn' : '', p);
  },
  // Acheter la fidélité d'un vassal (le roi de France et son camp la tirent vers lui, le roi d'Angleterre et le sien
  // vers lui). Renvoie un message d'erreur, ou null.
  hyBribe(pid, vid) {
    const hy = this.hy, V = CENTANS.VASSALS, p = this.players[pid], v = this.players[vid], camp = this.hyCampOf(pid);
    if (!v || !v.alive || hy.loyalty[v.role] === undefined) return tr('On ne peut pas acheter ce royaume.', 'This kingdom cannot be bought.');
    if (!camp) return tr('Seuls les deux rois et leurs alliés achètent la fidélité des vassaux.', 'Only the two kings and their allies buy the loyalty of vassals.');
    if (p.gold < V.BRIBE_GOLD) return tr(`Il faut ${fmt(V.BRIBE_GOLD)} pièces d'or.`, `You need ${fmt(V.BRIBE_GOLD)} gold.`);
    p.gold -= V.BRIBE_GOLD;
    hy.loyalty[v.role] = Math.max(-100, Math.min(100, hy.loyalty[v.role] + (camp === 'france' ? V.BRIBE : -V.BRIBE)));
    this.stepVassals();
    return null;
  },
  // La fidélité d'un vassal en mots (pour la barre de résumé et le menu d'actions), ou null
  hyLoyaltyText(pid) {
    const hy = this.hy, L = hy && hy.loyalty[this.players[pid].role];
    if (L === undefined) return null;
    const n = Math.round(L), side = n >= 10 ? tr('penche pour le roi de France', 'leans towards the King of France')
      : n <= -10 ? tr('penche pour le roi d\'Angleterre', 'leans towards the King of England') : tr('hésite entre les deux rois', 'hesitates between the two kings');
    return tr(`⚖️ Fidélité : ${side} (${n > 0 ? '+' : ''}${n})`, `⚖️ Loyalty: ${side} (${n > 0 ? '+' : ''}${n})`);
  },

  // Les nouveaux assauts (une fois par seconde) : un roi qui attaque un vassal le perd ; Jeanne d'Arc accompagne
  // l'assaut que le roi de France a choisi
  hySeeAttacks() {
    const hy = this.hy, V = CENTANS.VASSALS;
    for (const a of this.attacks) {
      if (a.done || a.hySeen) continue;
      a.hySeen = true;
      if (a.target < 0) continue;
      const d = this.players[a.target], camp = this.hyCampOf(a.attacker);
      if (hy.loyalty[d.role] !== undefined && camp) {
        hy.loyalty[d.role] = Math.max(-100, Math.min(100, hy.loyalty[d.role] + (camp === 'france' ? -V.ATTACKED : V.ATTACKED)));
      }
      // ⚜️ Jeanne : avec le premier assaut du roi de France contre un ennemi (le joueur la confie à son prochain assaut)
      const fr = this.hyP('france');
      if (hy.joan && hy.joan.state === 'ready' && a.attacker === fr.id && a.link === undefined && !a.raid
        && (!fr.isHuman || hy.joan.armed)) {
        hy.joan.state = 'army';
        hy.joan.armed = false;
        a.joan = true;
        if (fr.isHuman) UI.log(tr('⚜️ Jeanne d\'Arc chevauche avec ton armée, son étendard à la main !', '⚜️ Joan of Arc rides with your army, her standard in hand!'), 'good');
      }
    }
  },

  // --- ⚜️ Jeanne d'Arc ---
  // Le joueur du roi de France la confie à son prochain assaut (bouton ⚜️) ; elle revient après chaque victoire
  hyArmJoan() {
    const j = this.hy && this.hy.joan;
    if (!j || j.state !== 'ready') return tr('Jeanne n\'est pas là.', 'Joan is not here.');
    j.armed = !j.armed;
    return null;
  },
  stepJoan() {
    const j = this.hy.joan;
    if (!j) return;
    if (j.state === 'back' && this.tick >= j.backAt) j.state = 'ready';
  },

  // --- ☠️ La peste noire ---
  hyStartPlague() {
    const hy = this.hy, start = this.hyCity(CENTANS.PLAGUE.START);
    const first = start >= 0 ? start : this.castles.find(c => this.owner[c] >= 0);
    if (first !== undefined && first >= 0) this.hyInfect(first);
    this.hyEvent('peste', {}, tr('☠️ 1348 : la peste noire arrive à Marseille.', '☠️ 1348: the Black Death reaches Marseille.'));
    hy.plagueOn = true;
  },
  hyInfect(c) {
    const hy = this.hy, P = CENTANS.PLAGUE, TPS = CONFIG.TICKS_PER_SECOND, o = this.owner[c];
    if (hy.sick.has(c) || (hy.immune.get(c) || 0) > this.tick || (hy.closed.get(c) || 0) > this.tick) return;
    hy.sick.set(c, this.tick + P.SICK * TPS);
    if (o >= 0 && this.players[o].isHuman) UI.log(tr(`☠️ La peste frappe ${this.hyCityName(c)} ! Ses soldats meurent, ses moulins et casernes tournent au ralenti.`,
      `☠️ The plague strikes ${this.hyCityName(c)}! Its soldiers are dying, its mills and barracks slow down.`), 'warn');
  },
  stepPlague(y) {
    const hy = this.hy, P = CENTANS.PLAGUE, TPS = CONFIG.TICKS_PER_SECOND, W = this.W;
    if (!hy.sick.size) return;
    const spreading = y < P.MAX_YEAR;
    const cityCount = new Map(), sickCount = new Map();
    for (const c of this.castles) if (this.owner[c] >= 0) cityCount.set(this.owner[c], (cityCount.get(this.owner[c]) || 0) + 1);
    for (const [c, until] of [...hy.sick]) {
      if (!this.building[c] || this.tick >= until) { // (guérie, ou rasée)
        hy.sick.delete(c);
        hy.immune.set(c, this.tick + P.IMMUNE * TPS);
        continue;
      }
      const o = this.owner[c];
      if (o >= 0) sickCount.set(o, (sickCount.get(o) || 0) + 1);
      this.garrison[c] *= 0.98;
      if (!spreading) continue;
      // (elle saute vers les villes voisines, sauf celles qui ont fermé leurs portes)
      const cx = c % W, cy = (c / W) | 0;
      for (const d of this.castles) {
        if (d === c || hy.sick.has(d) || this.rand() >= P.SPREAD_CHANCE) continue;
        if (DMath.hypot(d % W - cx, ((d / W) | 0) - cy) <= P.SPREAD_RANGE) this.hyInfect(d);
      }
      // (un roi bot ferme de temps en temps les portes d'une ville voisine menacée)
      for (const d of this.castles) {
        const q = this.owner[d];
        if (q < 0 || this.players[q].isHuman || hy.sick.has(d) || this.rand() >= 0.01) continue;
        if (DMath.hypot(d % W - cx, ((d / W) | 0) - cy) <= P.SPREAD_RANGE) this.hyCloseGates(q, d);
      }
    }
    // (chaque royaume perd des soldats, selon la part de ses villes malades)
    for (const [o, n] of sickCount) {
      const p = this.players[o];
      if (!p.noArmy) p.troops *= 1 - P.LOSS * n / Math.max(1, cityCount.get(o) || 1);
    }
    for (const [c, until] of [...hy.closed]) if (this.tick >= until || !this.building[c]) hy.closed.delete(c);
  },
  // Fermer les portes d'une ville pendant la peste : elle ne l'attrape pas, mais ne produit plus rien. Renvoie un
  // message d'erreur, ou null.
  hyCloseGates(pid, c) {
    const hy = this.hy, P = CENTANS.PLAGUE;
    if (!hy || !hy.plagueOn) return tr('Il n\'y a pas d\'épidémie.', 'There is no epidemic.');
    if (this.building[c] !== B_CASTLE || this.owner[c] !== pid) return tr('Ce n\'est pas une de tes villes.', 'This is not one of your cities.');
    if (hy.sick.has(c)) return tr('Trop tard : la peste est déjà dans ses murs.', 'Too late: the plague is already within its walls.');
    if ((hy.closed.get(c) || 0) > this.tick) return tr('Ses portes sont déjà fermées.', 'Its gates are already closed.');
    hy.closed.set(c, this.tick + P.CLOSE * CONFIG.TICKS_PER_SECOND);
    return null;
  },
  // La production d'un moulin ou d'une caserne : ralentie si sa ville a la peste, arrêtée si elle a fermé ses portes
  hyOutput(a) {
    const hy = this.hy;
    if (!hy.sick.size && !hy.closed.size) return 1;
    const o = this.owner[a];
    for (const c of this.castles) {
      if (this.owner[c] !== o || !this.inWalls(c, a)) continue;
      if ((hy.closed.get(c) || 0) > this.tick) return 0;
      if (hy.sick.has(c)) return CENTANS.PLAGUE.SLOW;
      return 1;
    }
    return 1;
  },

  // --- 🗡️ Les Grandes Compagnies ---
  stepCompagnies(y) {
    const hy = this.hy, C = CENTANS.COMPAGNIES, TPS = CONFIG.TICKS_PER_SECOND, comp = this.hyP('compagnies');
    if (y < C.FROM || y > C.TO || (y >= C.SPAIN[0] && y < C.SPAIN[1])) return;
    if (hy.nextComp === undefined) hy.nextComp = this.tick + 30 * TPS;
    if (this.tick < hy.nextComp) return;
    hy.nextComp = this.tick + Math.round(C.EVERY[hy.diff] * (this.hyTruce() ? 0.5 : 1)) * TPS;
    const army = Math.min(C.MAX, Math.round(C.ARMY[hy.diff] * (1 + C.GROWTH * hy.comps)));
    // (surtout chez le roi de France : c'est son royaume que les routiers ravagent)
    const victims = ['france', 'france', 'france', 'bourgogne', 'bretagne', 'navarre', 'angleterre'].map(r => this.hyP(r)).filter(p => p.alive);
    for (let k = 0; k < 4 && victims.length; k++) {
      const v = victims[Math.floor(this.rand() * victims.length)];
      const cities = this.castles.filter(c => this.owner[c] === v.id && c !== v.capital && this.holdsAlone(c));
      const c = cities[Math.floor(this.rand() * cities.length)];
      if (c === undefined) continue;
      const land = this.hyLanding(comp.id, v.id, c, false);
      if (land < 0) continue;
      const a = this.hyLandArmy(comp.id, c, land, army, { raid: true, eventArmy: true, loot: C.LOOT });
      if (!a) continue;
      hy.comps++;
      a.raidWho = tr('Les routiers des Grandes Compagnies', 'The mercenaries of the Great Companies');
      if (v.isHuman) {
        Music.sound('enemyAssault');
        UI.log(tr(`🗡️ ${fmt(army)} routiers des Grandes Compagnies surgissent près de ${this.hyCityName(c)} pour la piller ! Clique sur leur bannière pour envoyer tes défenseurs.`,
          `🗡️ ${fmt(army)} mercenaries of the Great Companies emerge near ${this.hyCityName(c)} to plunder it! Click their banner to send your defenders.`), 'warn', comp);
      }
      if (!hy.fired.has('compagnies')) { hy.fired.add('compagnies'); if (!v.isHuman) UI.log(tr('🗡️ Les Grandes Compagnies ravagent le pays.', '🗡️ The Great Companies ravage the land.'), '', comp); }
      return;
    }
  },

  // --- 🔥 Les chevauchées anglaises (un bot) ---
  stepChevauchee(y) {
    const hy = this.hy, C = CENTANS.CHEVAUCHEE, TPS = CONFIG.TICKS_PER_SECOND, en = this.hyP('angleterre');
    if (!en.alive || en.isHuman || y < 1339 || this.hyTruce()) return;
    if (hy.nextChev === undefined) hy.nextChev = this.tick + C.EVERY[hy.diff] * TPS;
    if (this.tick < hy.nextChev) return;
    hy.nextChev = this.tick + C.EVERY[hy.diff] * TPS;
    if (en.troops < C.MIN / C.SHARE || this.attacks.some(a => !a.done && a.attacker === en.id && a.chevauchee)) return;
    // (une chevauchée pille le plat pays et les petites villes : pas les capitales ni les grandes villes du royaume)
    const big = new Set(CENTANS.KEY_CITIES.map(n => hy.cities.get(n)));
    const foes = this.shuffle([...this.neighborStats(en.id).keys()].filter(o => o >= 0 && this.hyCampOf(o) === 'france'));
    for (const o of foes) {
      const cities = this.shuffle(this.targetsOf(o).filter(c => this.building[c] === B_CASTLE && c !== this.players[o].capital && !big.has(c))).slice(0, 4);
      for (const c of cities) if (!this.hyChevauchee(en.id, c, en.troops * C.SHARE)) return;
    }
  },
  // Une chevauchée : un assaut qui pille et rase sa cible, sans la garder (le joueur anglais la lance d'un clic droit)
  hyChevauchee(pid, aim, troops) {
    const o = this.owner[aim];
    if (o < 0 || o === pid) return tr('Il faut viser une ville ennemie.', 'You must aim at an enemy city.');
    const n = this.attacks.length, err = this.launchAttack(pid, o, troops, aim);
    if (err) return err;
    const a = this.attacks.length > n ? this.attacks[this.attacks.length - 1] : this.attacks.find(a => !a.done && a.attacker === pid && a.target === o);
    if (!a) return tr('La chevauchée n\'a pas pu partir.', 'The chevauchée could not set out.');
    a.raid = true;
    a.chevauchee = true;
    // (🦁 1356 : la chevauchée lancée par le joueur anglais juste après l'appel du Prince Noir peut prendre le roi Jean)
    if (this.players[pid].isHuman && this.tick < (this.hy.poitiersUntil || 0)) a.poitiers = true;
    a.loot = CENTANS.CHEVAUCHEE.LOOT;
    a.raidWho = tr('Les chevaliers anglais', 'The English knights');
    const d = this.players[o];
    if (d.isHuman) UI.log(tr(`🔥 Une chevauchée anglaise fond sur ${this.hyCityName(aim)} : ils veulent la piller et la brûler !`, `🔥 An English chevauchée bears down on ${this.hyCityName(aim)}: they mean to plunder and burn it!`), 'warn', this.players[pid]);
    return null;
  },

  // --- ⚔️ Les grandes armées anglaises des événements ---
  // Débarquement (Crécy, Azincourt) : près de la ville visée, sur la côte. raid : une chevauchée qui pille et repart.
  // (le joueur anglais reçoit plutôt les soldats, et choisit lui-même où frapper)
  hyEnglishLanding(key, cityName, army, raid) {
    const en = this.hyP('angleterre'), c = this.hyCity(cityName);
    if (!en.alive) return;
    const d = c >= 0 ? this.owner[c] : -1;
    // (🦁 le joueur anglais : son armée débarque vraiment sur la côte et marche sur la ville, s'il le peut ; sinon,
    //  il reçoit les soldats et choisit lui-même où frapper)
    if (en.isHuman) {
      const spot = d >= 0 && this.hyCampOf(d) === 'france' && !this.hyTruce() ? this.hyLanding(en.id, d, c, true) : -1;
      const landed = spot >= 0 && this.hyLandArmy(en.id, c, spot, army, {});
      if (!landed) return this.hyLevy(en, army, key, c);
      this.hyEvent(key, { army: fmt(army), city: this.hyCityName(c) }, null);
      return UI.log(tr(`⛵ Ton armée (${fmt(army)} hommes) débarque près de ${this.hyCityName(c)} et marche sur elle !`, `⛵ Your army (${fmt(army)} men) lands near ${this.hyCityName(c)} and marches on it!`), 'good');
    }
    if (d < 0 || this.hyCampOf(d) !== 'france' || this.hyTruce()) return;
    const land = this.hyLanding(en.id, d, c, true);
    if (land < 0) return;
    const a = this.hyLandArmy(en.id, c, land, army, raid ? { raid: true, loot: CENTANS.CHEVAUCHEE.LOOT } : {});
    if (!a) return;
    if (raid) { a.chevauchee = true; a.raidWho = tr('Les chevaliers anglais', 'The English knights'); }
    this.hyEvent(key, { army: fmt(army), city: this.hyCityName(c) },
      tr(`⚔️ Le roi d'Angleterre débarque près de ${this.hyCityName(c)} avec ${fmt(army)} hommes !`, `⚔️ The King of England lands near ${this.hyCityName(c)} with ${fmt(army)} men!`), 'warn', en);
    if (this.players[d].isHuman) Music.sound('enemyAssault');
  },
  // Assaut par la terre (Calais, Orléans), avec une grande levée en plus de l'armée anglaise
  hyEnglishAssault(key, cityName, army) {
    const en = this.hyP('angleterre'), c = this.hyCity(cityName);
    if (!en.alive) return;
    if (en.isHuman) return this.hyLevy(en, army, key, c);
    const d = c >= 0 ? this.owner[c] : -1;
    if (d < 0 || this.hyCampOf(d) !== 'france' || this.hyTruce()) return;
    en.troops += army;
    if (this.launchAttack(en.id, d, army, c)) { en.troops -= army; return; }
    this.hyEvent(key, { army: fmt(army), city: this.hyCityName(c) },
      tr(`⚔️ ${fmt(army)} Anglais marchent sur ${this.hyCityName(c)} !`, `⚔️ ${fmt(army)} Englishmen march on ${this.hyCityName(c)}!`), 'warn', en);
  },
  // Chevauchée partie de Guyenne (Poitiers 1356) : depuis les terres anglaises, vers la ville visée
  hyEnglishRaidFrom(key, cityName, army) {
    const en = this.hyP('angleterre'), c = this.hyCity(cityName);
    if (!en.alive) return;
    if (en.isHuman) {
      this.hy.poitiersUntil = this.tick + CENTANS.ENGLAND.POITIERS * CONFIG.TICKS_PER_SECOND; // (voir hyChevauchee)
      return this.hyLevy(en, army, key, c);
    }
    const d = c >= 0 ? this.owner[c] : -1;
    if (d < 0 || this.hyCampOf(d) !== 'france' || this.hyTruce()) return;
    en.troops += army;
    if (this.hyChevauchee(en.id, c, army)) { en.troops -= army; return; }
    const a = this.attacks.find(a => !a.done && a.attacker === en.id && a.chevauchee && a.targetCastle === c);
    if (a) a.poitiers = true; // (si elle réussit, le roi Jean, venu l'arrêter, est pris : voir hyAfterBattle)
    this.hyEvent(key, { army: fmt(army), city: this.hyCityName(c) },
      tr(`🔥 Le Prince Noir lance une chevauchée de ${fmt(army)} hommes vers ${this.hyCityName(c)} !`, `🔥 The Black Prince launches a chevauchée of ${fmt(army)} men towards ${this.hyCityName(c)}!`), 'warn', en);
  },
  // Le joueur anglais : une grande levée de soldats pour la campagne de l'année
  hyLevy(en, army, key, c = -1) {
    en.troops += army;
    if (CENTANS.ENGLAND_EVENTS[key]) return this.hyEvent(key, { army: fmt(army), city: c >= 0 ? this.hyCityName(c) : '' }, null); // (📜 sa campagne)
    const what = { crecy: tr('la campagne de Normandie', 'the Normandy campaign'), calais: tr('le siège de Calais', 'the siege of Calais'),
      poitiers: tr('la chevauchée du Prince Noir', 'the Black Prince\'s chevauchée'), azincourt: tr('la campagne d\'Henri V', 'Henry V\'s campaign'),
      orleans: tr('le siège d\'Orléans', 'the siege of Orléans') }[key];
    UI.log(tr(`⚔️ Le Parlement vote une grande levée pour ${what} : +${fmt(army)} soldats !`, `⚔️ Parliament votes a great levy for ${what}: +${fmt(army)} soldiers!`), 'good');
  },

  // Une case où l'armée de pid débarque (coast) ou surgit (dans les terres) près de la ville c du royaume victim,
  // d'où elle peut marcher jusqu'à elle (voir vikingRoute) ; -1 s'il n'y en a pas
  hyLanding(pid, victim, c, coast) {
    const W = this.W, h = this.sizeOf(B_CASTLE) / 2, cx = c % W + h, cy = ((c / W) | 0) + h;
    const [lo, hi] = coast ? [0, CONFIG.VIKING_RANGE] : [9, 16], spots = [];
    for (let y = Math.max(0, Math.floor(cy - hi)); y <= Math.min(this.H - 1, Math.ceil(cy + hi)); y++) {
      for (let x = Math.max(0, Math.floor(cx - hi)); x <= Math.min(W - 1, Math.ceil(cx + hi)); x++) {
        const d = DMath.hypot(x + 0.5 - cx, y + 0.5 - cy), j = y * W + x;
        if (d < lo || d > hi || this.owner[j] !== victim || this.building[j] || this.wallAt[j]) continue;
        if (coast ? this.isCoastal(j) : this.terrain[j] !== TERRAIN.RIVER) spots.push([coast ? d : this.rand(), j]);
      }
    }
    spots.sort((a, b) => a[0] - b[0]);
    for (const [, j] of spots.slice(0, 8)) if (this.vikingRoute(pid, c, j)) return j;
    return -1;
  },
  // Une armée débarque (ou surgit) en `landing` et marche sur la ville c (comme un assaut viking, mais sans le bonus
  // des Vikings ; voir vikingLands). opts : raid (pille et rase sa cible), eventArmy (les survivants ne rejoignent
  // pas l'armée du royaume), loot (butin par bâtiment détruit). Renvoie l'assaut, ou null.
  hyLandArmy(pid, c, landing, troops, opts = {}) {
    const W = this.W, o = this.owner[c], route = this.vikingRoute(pid, c, landing);
    if (!route || o < 0) return null;
    const L = landing, h = this.sizeOf(this.building[c]) / 2, at = { x: L % W + 0.5, y: ((L / W) | 0) + 0.5 };
    const a = {
      id: this.nextAttackId++, attacker: pid, target: o, troops, done: false, startTick: this.tick,
      targetCastle: c, source: -1, defenders: 0, pending: [], frontTile: route[0],
      viking: L, landed: true, // (débarquée ou surgie : sans le bonus ni la flamme des Vikings)
      startTile: L, marchFrom: at, fromX: at.x, fromY: at.y, toX: c % W + h, toY: ((c / W) | 0) + h,
      raid: !!opts.raid, eventArmy: !!opts.eventArmy, loot: opts.loot,
    };
    a.list = [route[0]];
    a.set = new Set(a.list);
    a.pathTiles = route;
    a.limitZone = this.corridor(c, route);
    this.attacks.push(a);
    return a;
  },

  // --- Les effets du scénario sur les règles du jeu ---
  // Recrutement : la folie du roi, la Jacquerie (roi de France) ; les ports de la Manche (roi d'Angleterre)
  hyRecruit(p) {
    const hy = this.hy, C = CENTANS;
    if (p.role === 'france') {
      let k = 1;
      if (this.tick < (hy.fitUntil || 0)) k *= C.MAD.RECRUIT;
      if (this.tick < (hy.jacquerieUntil || 0)) k *= 0.6;
      return k;
    }
    if (p.role === 'angleterre') return (1 + C.PORT_SUPPLY * this.hyChannelPorts(p.id)) * this.hyMaxTroops(p);
    return 1;
  },
  // Armée maximum : l'Angleterre (un bot) a une armée plus grande (voir ENGLAND_BOOST)
  // (tout le renfort quand le joueur est le roi de France, le héros du scénario ; un tiers seulement sinon)
  hyMaxTroops(p) {
    if (p.role !== 'angleterre' || p.isHuman) return 1;
    const b = CENTANS.ENGLAND_BOOST[this.hy.diff];
    return this.human.role === 'france' ? b : 1 + (b - 1) / 3;
  },
  hyChannelPorts(pid) { return CENTANS.CHANNEL_PORTS.filter(n => { const c = this.hyCity(n); return c >= 0 && this.owner[c] === pid; }).length; },
  // Améliorations : Charles V le Sage les paie moins cher
  hyUpgrade(pid) {
    const fr = this.hyP('france');
    return pid === fr.id && this.hyKing().wise ? CENTANS.WISE_UPGRADE : 1;
  },
  // Force des soldats : Du Guesclin (sous Charles V) pour la France, Henri V pour l'Angleterre
  hyPower(pid) {
    const p = this.players[pid];
    if (p.role === 'france' && this.hyKing().hero) return 1 + CENTANS.HERO_POWER;
    if (p.role === 'angleterre' && this.hyEngKing().hero) return 1 + CENTANS.HERO_POWER;
    return 1;
  },
  // Au combat : les arcs longs anglais en rase campagne, et Jeanne d'Arc (r : combien d'attaquants tombent pour un
  // défenseur ; plus petit = l'attaquant se bat mieux)
  hyCombat(a) {
    const C = CENTANS, en = this.hyP('angleterre');
    let k = 1;
    if (!a.siege && this.hyYear() < C.LONGBOW_END) {
      if (a.attacker === en.id) k /= 1 + C.LONGBOW;
      else if (a.target === en.id) k *= 1 + C.LONGBOW;
    }
    if (a.joan) k /= 1 + C.JOAN.POWER;
    return k;
  },
  // Durée d'un siège : les canons du roi de France, Jeanne d'Arc
  hySiege(a, secs) {
    const C = CENTANS;
    if (a.attacker === this.hyP('france').id && this.hyYear() >= C.CANNONS) secs *= C.CANNON_SIEGE;
    if (a.joan) secs *= C.JOAN.SIEGE;
    return Math.max(3, Math.round(secs));
  },

  // Après une bataille (un assaut qui se termine) : les rançons des chevaliers, le roi Jean captif, Jeanne d'Arc
  hyAfterBattle(a) {
    const hy = this.hy, C = CENTANS, TPS = CONFIG.TICKS_PER_SECOND;
    if (a.target < 0) return;
    const won = !!(a.won || a.castleTaken || a.razed), p = this.players[a.attacker], d = this.players[a.target];
    // 💰 rançons : le vaincu paie pour ses chevaliers tombés
    const lostA = a.lostA || 0, lostD = a.lostD || 0;
    const loser = won ? d : p, winner = won ? p : d, lost = won ? lostD : lostA;
    if (lost >= C.RANSOM_MIN && loser.alive && winner.alive && !loser.raiders && !winner.raiders) {
      // (🦁 l'ordre de la Jarretière : les rançons que touche le roi d'Angleterre sont plus fortes, voir ENGLAND.GARTER)
      const garter = hy.garter && winner.role === 'angleterre' ? C.ENGLAND.GARTER.RANSOM : 1;
      const pay = Math.round(Math.min(loser.gold, lost * C.KNIGHT_RANSOM * garter));
      if (pay >= 1) {
        loser.gold -= pay;
        winner.gold += pay;
        if (winner.isHuman) UI.log(tr(`💰 Les chevaliers captifs ${this.deName(loser.name)} paient rançon : +${fmt(pay)} d'or !`, `💰 ${possessive(loser.name)} captive knights pay ransom: +${fmt(pay)} gold!`), 'good', loser);
        else if (loser.isHuman) UI.log(tr(`💰 Tes chevaliers captifs paient rançon à ${winner.name} : −${fmt(pay)} d'or.`, `💰 Your captive knights pay ransom to ${winner.name}: −${fmt(pay)} gold.`), 'warn', winner);
      }
    }
    // ⛓️ 1346 : le roi David II d'Écosse, repoussé à Neville's Cross, est pris : sa rançon va au roi d'Angleterre
    if (a.neville && !won && p.alive) {
      const en = this.hyP('angleterre'), gold = C.ENGLAND.NEVILLE.RANSOM[hy.diff];
      if (en.alive) {
        en.gold += gold;
        if (en.isHuman) UI.log(tr(`⛓️ Le roi David II d'Écosse est pris à Neville's Cross : sa rançon te rapporte ${fmt(gold)} d'or !`, `⛓️ King David II of Scotland is taken at Neville's Cross: his ransom brings you ${fmt(gold)} gold!`), 'good', p);
        else if (p.isHuman) UI.log(tr(`⛓️ Ton roi David II est pris par les Anglais : ${fmt(gold)} d'or de rançon pour eux.`, `⛓️ Your King David II is taken by the English: ${fmt(gold)} gold of ransom for them.`), 'warn', en);
      }
    }
    // ⛓️ le roi Jean pris dans une défaite française contre le camp anglais (une seule fois, sous son règne)
    const fr = this.hyP('france');
    const beaten = (loser === fr && this.hyCampOf(winner.id) === 'angleterre' && lost >= C.CAPTURE_MIN) || (a.poitiers && won && d === fr);
    if (this.hyKing().captive && !hy.ransom && fr.alive && beaten) {
      hy.ransom = { left: C.RANSOM[hy.diff], total: C.RANSOM[hy.diff], paid: false };
      this.faithCache = null;
      this.hyEvent('captif', { gold: fmt(hy.ransom.total) }, tr(`⛓️ Le roi Jean II est capturé par les Anglais ! Rançon : ${fmt(hy.ransom.total)} pièces d'or.`, `⛓️ King John II is captured by the English! Ransom: ${fmt(hy.ransom.total)} gold.`), '', fr);
    }
    // ⚜️ Jeanne : elle revient après une victoire (et chaque ville prise grandit la Légitimité du roi) ; prise si son
    // armée est battue
    if (a.joan && hy.joan) {
      if (won) {
        hy.joan.state = 'back';
        hy.joan.backAt = this.tick + C.JOAN.BACK * TPS;
        if (a.castleTaken) this.hyAddLegit(fr.id, C.LEGIT.JOAN_CITY);
      } else if (a.troops < 1) {
        hy.joan.state = 'captured';
        const en = this.hyP('angleterre');
        if (en.alive) this.hyAddLegit(en.id, C.ENGLAND.JOAN_LEGIT); // (🦁 la cause anglaise y gagne)
        this.hyEvent('joanCaptured', {}, tr('⚜️ Jeanne d\'Arc a été prise par l\'ennemi.', '⚜️ Joan of Arc has been captured by the enemy.'), '', fr);
      } else {
        hy.joan.state = 'back';
        hy.joan.backAt = this.tick + C.JOAN.BACK * TPS;
      }
    }
  },
  // --- 🦁 La campagne du roi d'Angleterre (voir ENGLAND et ENGLAND_EVENTS dans centans.js) ---
  stepHyEngland(y) {
    const hy = this.hy, E = CENTANS.ENGLAND, TPS = CONFIG.TICKS_PER_SECOND, en = this.hyP('angleterre');
    const once = (key, year) => { if (y < year || hy.fired.has(key)) return false; hy.fired.add(key); return true; };
    // 1346 : les Écossais envahissent le Nord pendant qu'Édouard est en France
    if (once('neville', E.NEVILLE.YEAR)) this.hyNeville();
    // 1348 : l'ordre de la Jarretière (des rançons plus fortes, voir hyAfterBattle)
    if (once('jarretiere', E.GARTER.YEAR) && en.alive) {
      hy.garter = true;
      this.hyEvent('jarretiere', {}, null);
    }
    // 1363 : l'Étape de Calais (de l'or, tant que l'Angleterre tient Calais)
    if (once('etape', E.STAPLE.YEAR) && en.alive) {
      hy.staple = true;
      this.hyEvent('etape', {}, null);
    }
    if (hy.staple && en.alive && this.tick % (E.STAPLE.EVERY * TPS) === 0) {
      const c = this.hyCity('Calais');
      if (c >= 0 && this.owner[c] === en.id) en.gold += E.STAPLE.GOLD;
    }
    // 1381 : la révolte des paysans (un choix pour le joueur anglais ; un bot réprime)
    if (once('paysans', E.PEASANTS.YEAR) && en.alive) {
      if (en.isHuman) this.hyOffer('paysans', {});
      else this.hyApplyChoice('paysans', 'repress');
    }
  },
  // ⚔️ 1346 : le roi David II d'Écosse marche sur une ville du nord de l'Angleterre (Neville's Cross). Repoussé, il est
  // pris (voir hyAfterBattle). Pas si l'Écosse est le joueur, ou alliée de l'Angleterre, ou pendant une trêve.
  hyNeville() {
    const hy = this.hy, E = CENTANS.ENGLAND.NEVILLE, sc = this.hyP('ecosse'), en = this.hyP('angleterre');
    if (!sc.alive || !en.alive || sc.isHuman || this.areAllied(sc.id, en.id) || this.hyTruce()) return;
    const army = Math.round(CENTANS.EVENT_ARMY[hy.diff] * E.ARMY);
    for (const name of E.CITIES) {
      const c = this.hyCity(name);
      if (c < 0 || this.owner[c] !== en.id) continue;
      sc.troops += army;
      if (this.launchAttack(sc.id, en.id, army, c)) { sc.troops -= army; continue; }
      const a = this.attacks.find(a => !a.done && a.attacker === sc.id && a.targetCastle === c);
      if (a) a.neville = true;
      this.hyEvent('neville', { army: fmt(army), city: this.hyCityName(c) },
        tr(`⚔️ 1346 : les Écossais envahissent le nord de l'Angleterre et marchent sur ${this.hyCityName(c)} !`, `⚔️ 1346: the Scots invade the north of England and march on ${this.hyCityName(c)}!`), '', sc);
      if (en.isHuman) Music.sound('enemyAssault');
      return;
    }
  },
  // 📜 Un parchemin à choix pour le joueur anglais (la paix de Brétigny, la révolte des paysans) : la partie attend sa
  // réponse (voir UI.parchment et hyChoose) ; data : ce qu'il faut garder pour appliquer le choix (la trêve…)
  hyOffer(key, data) {
    const E = CENTANS.ENGLAND, hy = this.hy;
    (hy.offers = hy.offers || {})[key] = data;
    const vars = key === 'bretigny' ? { gold: fmt(E.BRETIGNY.GOLD), legit: E.BRETIGNY.LEGIT, legit2: E.BRETIGNY.REFUSE_LEGIT }
      : { gold: fmt(E.PEASANTS.GOLD), pct: Math.round(E.PEASANTS.TROOPS * 100) };
    UI.parchment(CENTANS.ENGLAND_EVENTS[key], vars, CENTANS.CHOICES[key].map(c => ({ key, pick: c.pick, label: c.label })));
  },
  // Le joueur anglais a choisi (ordre « hyChoice »)
  hyChoose(pid, key, pick) {
    const hy = this.hy, offers = hy.offers || {};
    if (!offers[key] || this.players[pid] !== this.hyP('angleterre')) return null;
    if (!CENTANS.CHOICES[key].some(c => c.pick === pick)) return null;
    this.hyApplyChoice(key, pick, offers[key]);
    delete offers[key];
    return null;
  },
  hyApplyChoice(key, pick, data = {}) {
    const E = CENTANS.ENGLAND, en = this.hyP('angleterre');
    if (key === 'bretigny') {
      if (pick === 'accept') {
        this.hyStartTruce(data.truce, true);
        en.gold += E.BRETIGNY.GOLD;
        this.hyAddLegit(en.id, -E.BRETIGNY.LEGIT);
        if (en.isHuman) UI.log(tr(`🕊️ La paix de Brétigny est signée : +${fmt(E.BRETIGNY.GOLD)} d'or, mais tu renonces à la couronne de France (−${E.BRETIGNY.LEGIT} de Légitimité).`,
          `🕊️ The peace of Brétigny is signed: +${fmt(E.BRETIGNY.GOLD)} gold, but you renounce the crown of France (−${E.BRETIGNY.LEGIT} Legitimacy).`), 'good');
      } else {
        this.hyAddLegit(en.id, E.BRETIGNY.REFUSE_LEGIT);
        if (en.isHuman) UI.log(tr(`⚔️ Tu refuses la paix : la guerre continue, et tes partisans te savent gré de ne rien céder (+${E.BRETIGNY.REFUSE_LEGIT} de Légitimité).`,
          `⚔️ You refuse the peace: the war goes on, and your supporters are grateful that you yield nothing (+${E.BRETIGNY.REFUSE_LEGIT} Legitimacy).`), 'good');
      }
    }
    if (key === 'paysans') {
      if (pick === 'smithfield') {
        const pay = Math.min(en.gold, E.PEASANTS.GOLD);
        en.gold -= pay;
        if (en.isHuman) UI.log(tr(`🤝 À Smithfield, le roi apaise les rebelles (−${fmt(pay)} d'or) : ils rentrent chez eux.`, `🤝 At Smithfield, the king appeases the rebels (−${fmt(pay)} gold): they go home.`), 'good');
      } else {
        const lost = Math.round(en.troops * E.PEASANTS.TROOPS);
        en.troops -= lost;
        if (en.isHuman) UI.log(tr(`⚔️ La révolte est écrasée, mais elle t'a coûté ${fmt(lost)} soldats.`, `⚔️ The revolt is crushed, but it cost you ${fmt(lost)} soldiers.`), 'warn');
      }
    }
  },

  // ⛓️ La rançon du roi Jean : une part de l'or du royaume y part, jusqu'à ce qu'elle soit payée
  stepRansom() {
    const hy = this.hy, r = hy.ransom, fr = this.hyP('france');
    if (!r || r.paid || !fr.alive) return;
    const pay = Math.min(r.left, fr.gold * CENTANS.RANSOM_SHARE), en = this.hyP('angleterre');
    fr.gold -= pay;
    if (en.alive) en.gold += pay; // (🦁 la rançon va au roi d'Angleterre)
    r.left -= pay;
    if (r.left < 1) {
      r.paid = true;
      this.faithCache = null;
      UI.log(tr('⛓️ La rançon est payée : le roi Jean II rentre à Paris.', '⛓️ The ransom is paid: King John II returns to Paris.'), fr.isHuman ? 'good' : '', fr);
    }
  },

  // L'IA : un bot préfère attaquer l'autre camp (et ménage les petits royaumes neutres)
  hyTargetBonus(p, e) {
    if (this.hyEnemies(p.id, e.id)) return 1.6;
    if (!this.hyCampOf(e.id) && this.hyCampOf(p.id)) return 0.6;
    return 1;
  },

  // --- 👑 Les objectifs (voir OBJECTIVES dans centans.js) ---
  hyObjList() {
    const o = CENTANS.OBJECTIVES[this.human.role];
    return o ? o.list : null;
  },
  hyObjTitle() {
    const o = CENTANS.OBJECTIVES[this.human.role];
    return o ? o.title : '';
  },
  hyObjectiveMet(o) {
    const hy = this.hy, h = this.human, diff = hy.diff, mine = c => c >= 0 && this.owner[c] === h.id;
    if (o.kind === 'city') return o.cities.every(n => mine(this.hyCity(n)));
    if (o.kind === 'church') return mine(this.hyCity(o.name));
    if (o.kind === 'vassal') {
      const v = this.hyP(o.role);
      return mine(hy.capital[o.role]) || (v.alive && this.areAllied(h.id, v.id));
    }
    if (o.kind === 'crowned') { const r = this.hyCity('Reims'); return !!hy.crowned[h.role] && mine(r); }
    if (o.kind === 'legit') return this.faithOf(h.id) >= o.goal[diff];
    if (o.kind === 'noEnglish') {
      const en = this.hyP('angleterre');
      if (!en.alive) return true;
      // (le continent : la terre où se trouve Paris)
      const comp = this.landComp(), main = comp[hy.capital.france];
      for (let i = 0; i < this.N; i++) if (this.owner[i] === en.id && comp[i] === main) return false;
      return true;
    }
    if (o.kind === 'ports') return this.hyChannelPorts(h.id) >= o.goal[diff];
    if (o.kind === 'citadel') return this.castles.some(c => this.owner[c] === h.id && this.level[c] >= o.goal[diff]);
    if (o.kind === 'allyCity') { const c = this.hyCity(o.city); return c >= 0 && (this.owner[c] === h.id || this.areAllied(h.id, this.owner[c])); }
    return false;
  },
  hyObjectiveText(o) { return o.goal ? o.text.replace('{n}', o.goal[this.hy.diff]) : o.text; },
  hyStepObjectives() {
    const hy = this.hy, list = this.hyObjList();
    if (!list || this.tick % CONFIG.TICKS_PER_SECOND) return;
    list.forEach((o, k) => {
      const met = this.hyObjectiveMet(o), was = hy.done[k];
      hy.done[k] = met;
      if (was === undefined || was === met) return;
      const t = this.hyObjectiveText(o);
      if (met) UI.log(tr(`✔️ Objectif rempli : ${t}`, `✔️ Objective complete: ${t}`), 'good');
      else UI.log(tr(`❌ Objectif perdu : ${t}`, `❌ Objective lost: ${t}`), 'warn');
    });
  },
  hyObjectives() {
    const list = this.hyObjList();
    return list ? list.map((o, k) => ({ text: this.hyObjectiveText(o), done: !!this.hy.done[k] })) : [];
  },
});
