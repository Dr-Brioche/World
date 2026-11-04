// ✝️ RÈGLES DU SCÉNARIO « LES CROISADES » (les données et les réglages : voir croisades.js)
// Elles s'ajoutent aux règles du jeu (GameRules, voir game.js). L'état du scénario est dans Game.cr :
//  - role / capital : la faction de chaque rôle, et sa capitale ; cities / churches : nom français → case d'ancrage ;
//  - strong : les villes à grande garnison (le Krak des Chevaliers, Tyr…) ; pact : les pactes du scénario ;
//  - fired : les événements déjà passés ; done / gone : les objectifs remplis, ou perdus pour de bon ;
//  - truceUntil : la paix de Jaffa ; ransom : la rançon de Richard ; stun : les royaumes frappés par les Assassins
//    (ou une guerre civile) ; tributeUntil / tributePaid : le tribut aux Assassins ; hireReady : quand on peut les
//    engager de nouveau.

Object.assign(GameRules, {
  // --- Mise en place : l'Orient et l'Occident en juillet 1187 ---
  startCroisades(opts) {
    const C = CROISADES, W = this.W, H = this.H, P = CROISADES_PROJ;
    const at = (lon, lat) => geoXY(P, lon, lat, W, H); // (avec la loupe de la Terre sainte : voir geoXY)
    this.pactsAllowed = false; // (pas d'autres pactes que ceux du scénario : la croisade, le pacte secret de Byzance…)
    const diff = C.RANSOM[opts.difficulty] ? opts.difficulty : 'normal';
    const cr = this.cr = { diff, role: {}, capital: {}, cities: new Map(), churches: new Map(), strong: new Map(), pact: {},
      fired: new Set(), done: {}, gone: {}, offers: {}, peaceBroken: new Set(),
      loans: new Map(), loansGiven: 0, helpReady: new Map(), helped: new Map(), nextLoan: CROISADES.ORDERS.AI_LOAN_EVERY * CONFIG.TICKS_PER_SECOND,
      cyprusSold: false, cyprusBought: false, truceUntil: 0, ransom: null, stun: new Map(), tributeUntil: new Map(),
      tributePaid: new Set(), hireReady: new Map(), richard: false, arsuf: false, salephBridge: false, john: false,
      civilWarUntil: 0, nextRaid: C.RAIDS.FIRST * CONFIG.TICKS_PER_SECOND, nextAssassin: C.ASSASSINS.AI_EVERY * CONFIG.TICKS_PER_SECOND };
    // Les factions (le joueur incarne celle de sa bannière)
    for (const f of C.factions) {
      const b = BANNERS.findIndex(x => x.set === 'croisades' && x.id === f.id);
      const p = b === opts.banner ? this.human : this.addPlayer(f.name, b, false);
      p.name = f.name;
      p.role = f.id;
      p.defensive = !!f.defensive;
      p.noArmy = !!f.noArmy;
      p.raiders = !!f.raiders;
      p.order = !!f.order; // (✠ un ordre militaire : voir ordres.js)
      p.dormant = !!f.dormant; // (l'Égypte d'al-Aziz : sans terres, elle naît à la mort de Saladin)
      p.garrisonBoost = f.garrison || 1;
      p.camp = f.camp || null;
      p.slowAI = f.slowAI || 1; // (⏱️ les royaumes lointains réfléchissent moins souvent : voir AI.update)
      p.gold = f.id === 'templiers' ? C.ORDERS.TEMPLE_GOLD : C.START_GOLD; // (🏦 le trésor du Temple)
      cr.role[f.id] = p.id;
    }
    // Les terres de 1187 : une case va à la première faction dont le territoire la contient (les contours suivent la
    // déformation de la carte : la Terre sainte agrandie, voir geoPoints)
    const polys = [];
    for (const f of C.factions) {
      for (const ring of f.lands) {
        const pts = geoPoints(P, ring.concat([ring[0]]), W, H), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        polys.push({ pid: cr.role[f.id], pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
      }
    }
    this.claimLands(polys, C.BORDER_WARP);
    // Les villes et les lieux notables, au plus près de leur vraie place (avec leur nom, écrit sur la carte)
    const strong = (p, a, o) => { if (o && o.garrison) cr.strong.set(a, { pid: p.id, boost: o.garrison }); };
    // (une ville qui ne trouve pas de place, parce que la frontière déformée a rogné ses terres : sa faction reçoit
    //  d'abord les terres libres d'obstacles dans un petit disque autour de sa vraie place, puis on réessaie)
    const place = (p, type, x, y, level) => {
      let a = this.placeOnLand(p, type, x, y, level);
      if (a >= 0) return a;
      const R = 6;
      for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || (xx - x) ** 2 + (yy - y) ** 2 > R * R) continue;
        const j = yy * W + xx;
        if (this.isLand(j) && this.claimable(j) && !this.building[j]) this.setOwner(j, p.id);
      }
      return this.placeOnLand(p, type, x, y, level);
    };
    for (const f of C.factions) {
      if (!f.capital) continue;
      const p = this.players[cr.role[f.id]], c0 = f.capital;
      const cap = place(p, B_CASTLE, ...at(c0[0], c0[1]), Math.max(2, f.capitalLevel || 2));
      if (cap >= 0) {
        p.capital = cap; cr.capital[f.id] = cap; p.castlesBuilt = 1;
        this.placeNames.set(cap, c0[2]); cr.cities.set(c0[3], cap); strong(p, cap, c0[4]);
      }
      for (const c of f.cities) {
        const a = place(p, B_CASTLE, ...at(c[0], c[1]), (c[4] && c[4].level) || 1);
        if (a >= 0) { this.placeNames.set(a, c[2]); cr.cities.set(c[3], a); strong(p, a, c[4]); }
      }
      for (const c of f.churches) {
        const a = this.placeOnLand(p, B_CHURCH, ...at(c[0], c[1]), 1);
        if (a >= 0) { this.placeNames.set(a, c[2]); cr.churches.set(c[3], a); }
      }
      // (les grandes capitales : 2 moulins et une caserne de niveau 2 dans leur muraille)
      if (f.production && cap >= 0) {
        const h = this.sizeOf(B_CASTLE) / 2, cx = cap % W + h, cy = ((cap / W) | 0) + h, inside = j => this.inWalls(cap, j);
        for (const type of [B_MILL, B_MILL, B_BARRACKS]) this.placeOnLand(p, type, cx, cy, 2, inside);
      }
    }
    for (const a of cr.strong.keys()) this.garrison[a] = this.garrisonMax(a); // (leurs garnisons, avec leur bonus)
    // Ce qui n'est tenu par aucune ville (îlots, bouts de côte…) redevient une terre libre
    const r = this.regions(true), loose = [];
    for (let k = 0; k < r.size.length; k++) {
      if (r.owner[k] >= 0 && !r.held[k]) loose.push(...r.order.subarray(r.start[k], r.start[k] + r.size[k]));
    }
    for (const t of loose) {
      if (this.building[t] && this.anchor[t] === t) this.removeBuilding(t);
      this.setOwner(t, -1);
    }
    // Les armées de départ (Saladin, s'il est un bot, sort de Hattin avec une bien plus grande armée)
    for (const p of this.players) {
      // (et le royaume de Jérusalem a rassemblé les rescapés de Hattin : JERUSALEM_START)
      const share = p.role === 'ayyoubides' && !p.isHuman ? C.SALADIN.START : p.role === 'jerusalem' ? C.JERUSALEM_START : C.START_ARMY;
      p.troops = p.noArmy || p.dormant ? 0 : Math.round(this.maxTroops(p) * share);
    }
    // 📿 La Vraie Croix, prise à Hattin : dans le trésor de Saladin, à Damas (une relique : voir reliques.js)
    const cross = cr.churches.get(C.TRUE_CROSS);
    if (cross !== undefined) this.relicChurch.set(cross, 1);
    // Outremer : le royaume de Jérusalem et Antioche-Tripoli, alliés pour toujours (les rois croisés les rejoindront)
    cr.pact.croisade = this.crNewPact(tr('Outremer', 'Outremer'), 'jerusalem', ['jerusalem', 'antioche', 'templiers', 'hospitaliers']);
    // Les frères Assen : la Bulgarie, révoltée contre Byzance (1185), et ses alliés coumans des steppes
    cr.pact.assen = this.crNewPact(tr('Les frères Assen', 'The Asen brothers'), 'bulgarie', ['bulgarie', 'coumans']);
    this.version++;
    this.phase = 'playing';
    this.paused = true;
  },
  // Un pacte du scénario (qu'un bot ne trahit jamais ; le joueur, si : voir eternalPact), fondé par le rôle founder,
  // avec ces rôles
  crNewPact(name, founder, roles) {
    const id = this.nextPactId++;
    this.pacts.set(id, { name, founder: this.cr.role[founder], eternal: true });
    for (const r of roles) { const p = this.crP(r); if (this.crCanJoin(p)) p.pact = id; }
    this.version++;
    return id;
  },
  // Le royaume p quitte son pacte (le pacte disparaît s'il ne reste qu'un seul membre)
  crLeavePact(p) {
    const id = p.pact;
    if (id === undefined || id === null || id < 0) return;
    p.pact = -1; // (-1 : sans pacte, comme partout dans le jeu)
    const rest = this.players.filter(q => q.alive && q.pact === id);
    if (rest.length < 2) { for (const q of rest) q.pact = -1; this.pacts.delete(id); }
    this.version++;
  },

  // Le scénario peut-il mettre ce royaume dans un de ses pactes ? (pas un joueur qui a déjà rompu le sien)
  crCanJoin(p) { return p.alive && !(p.human && p.pactBroken); },
  // 🕊️ Ces deux royaumes sont-ils en paix, comme dans l'histoire (PEACE) ? Un bot n'attaque pas l'autre (voir aiSpares).
  // Aucun royaume chrétien n'attaque Rome. Si le joueur attaque l'autre, la paix est rompue pour de bon.
  crPeace(a, b) {
    const cr = this.cr, pa = this.players[a], pb = this.players[b];
    if (!pa || !pb || a === b) return false;
    const key = Math.min(a, b) + ':' + Math.max(a, b);
    if (cr.peaceBroken.has(key)) return false;
    let peace = (pa.role === 'papaute' && pb.camp === 'chretiens') || (pb.role === 'papaute' && pa.camp === 'chretiens');
    if (!peace) {
      const y = this.crYear();
      peace = CROISADES.PEACE.some(([r1, r2, y0, y1]) => y >= y0 && y < y1 && ((pa.role === r1 && pb.role === r2) || (pa.role === r2 && pb.role === r1)));
    }
    if (!peace) return false;
    if ((pa.human || pb.human) && this.attacks.some(t => !t.done && this.players[t.attacker].human &&
      ((t.attacker === a && t.target === b) || (t.attacker === b && t.target === a)))) {
      cr.peaceBroken.add(key);
      return false;
    }
    return true;
  },

  // --- Outils ---
  crP(role) { return this.players[this.cr.role[role]]; },
  // L'année en cours (avec ses décimales), d'après le calendrier (CALENDAR : [minute, année])
  crYear() {
    const K = CROISADES.CALENDAR, m = this.tick / (60 * CONFIG.TICKS_PER_SECOND);
    for (let k = 1; k < K.length; k++) {
      if (m <= K[k][0] || k === K.length - 1) return K[k - 1][1] + (m - K[k - 1][0]) / (K[k][0] - K[k - 1][0]) * (K[k][1] - K[k - 1][1]);
    }
    return K[0][1];
  },
  // Le tour de jeu où l'on arrive à l'année y
  crYearTick(y) {
    const K = CROISADES.CALENDAR;
    for (let k = 1; k < K.length; k++) {
      if (y <= K[k][1] || k === K.length - 1) {
        const m = K[k - 1][0] + (y - K[k - 1][1]) / (K[k][1] - K[k - 1][1]) * (K[k][0] - K[k - 1][0]);
        return Math.round(m * 60 * CONFIG.TICKS_PER_SECOND);
      }
    }
    return 0;
  },
  // La ville (ou le lieu) de ce nom français, si elle existe encore (sinon -1)
  crCity(name) {
    const cr = this.cr, a = cr.cities.has(name) ? cr.cities.get(name) : cr.churches.get(name);
    return a !== undefined && this.building[a] ? a : -1;
  },
  crCityName(a) { return this.placeNames.get(a) || this.targetLabel(a); },
  // Le rôle (faction) qui tient ce lieu, ou '' s'il n'existe plus
  crHolder(name) { const a = this.crCity(name); return a >= 0 && this.owner[a] >= 0 ? this.players[this.owner[a]].role : ''; },
  // Les croisés (pour la paix de Jaffa) et les deux camps
  crCrusader(pid) { return pid >= 0 && ['jerusalem', 'antioche', 'angleterre', 'france', 'empire'].includes(this.players[pid].role); },
  crSaracen(pid) { return pid >= 0 && ['ayyoubides', 'egypte'].includes(this.players[pid].role); },
  // 📜 Un grand événement : un parchemin pour le joueur s'il est concerné (who), sinon un simple message
  crEvent(key, vars, log, kind = 'warn', who) {
    const ev = CROISADES.EVENTS[key];
    if (ev && ev.who.includes(this.human.role)) UI.parchment(ev, vars);
    else if (log) UI.log(log, kind, who);
  },
  // Une grande armée d'un événement : un bot débarque (ou surgit) près de la ville visée et marche sur elle ; le joueur
  // reçoit plutôt les soldats, et choisit lui-même où frapper. targets : les villes visées, la première encore à
  // prendre ; coast : un débarquement (sinon, l'armée surgit dans les terres, comme celle de Barberousse) ; foes : le
  // camp des cibles permises (une croisade ne frappe que les terres de l'islam : 'musulmans')
  crCampaign(role, key, targets, army, coast, log, foes) {
    const p = this.crP(role);
    if (!p.alive) return false;
    const vars = { army: fmt(army) };
    if (p.isHuman) {
      p.troops += army;
      this.crEvent(key, vars, null);
      UI.log(tr(`⚔️ Une grande armée te rejoint : +${fmt(army)} soldats !`, `⚔️ A great army joins you: +${fmt(army)} soldiers!`), 'good');
      return true;
    }
    for (const name of targets) {
      const c = this.crCity(name), d = c >= 0 ? this.owner[c] : -1;
      if (d < 0 || d === p.id || this.areAllied(p.id, d) || this.attackBlocked(p.id, d)) continue;
      if (foes && this.players[d].camp !== foes) continue;
      let landed = null;
      const spot = this.hyLanding(p.id, d, c, coast);
      if (spot >= 0) landed = this.hyLandArmy(p.id, c, spot, army, {});
      if (!landed) {
        // (pas de place pour débarquer : l'armée marche depuis ses terres, si elles touchent celles de la cible)
        p.troops += army;
        if (this.launchAttack(p.id, d, army, c)) { p.troops -= army; continue; }
      }
      this.crEvent(key, vars, log ? log(this.crCityName(c)) : null, 'warn', p);
      if (this.players[d].isHuman) Music.sound('enemyAssault');
      return true;
    }
    return false;
  },

  // --- Chaque seconde : le calendrier et tous les mécanismes du scénario ---
  stepCroisades() {
    const cr = this.cr, TPS = CONFIG.TICKS_PER_SECOND;
    if (!cr || this.tick % TPS) return;
    const y = this.crYear();
    this.crStepEvents(y);
    this.crStepRaids();
    this.crStepRansom();
    this.crStepAssassins();
    this.crStepOrders(); // (✠ les ordres militaires : voir ordres.js)
    // 💰 Venise : l'or de ses comptoirs
    const ve = this.crP('venise'), V = CROISADES.VENICE;
    if (ve.alive && this.tick % (V.EVERY * TPS) === 0) ve.gold += V.GOLD;
  },

  // 📜 Les grands événements, à leur année (voir EVENTS dans croisades.js)
  crStepEvents(y) {
    const cr = this.cr, C = CROISADES, TPS = CONFIG.TICKS_PER_SECOND, E = C.EVENT_ARMY[cr.diff];
    const once = (key, year) => { if (y < year || cr.fired.has(key)) return false; cr.fired.add(key); return true; };
    const sal = this.crP('ayyoubides'), jer = this.crP('jerusalem'), en = this.crP('angleterre'), fr = this.crP('france');
    const em = this.crP('empire'), by = this.crP('byzance'), ve = this.crP('venise');
    const R = Math.round;
    // 1187 : Saladin marche sur Jérusalem, puis sur Tyr
    if (once('jerusalemSiege', 1187.72) && this.crHolder('Jérusalem') === 'jerusalem') {
      this.crCampaign('ayyoubides', 'jerusalemSiege', ['Jérusalem'], R(E * 1.4), false,
        n => tr(`⚔️ Saladin assiège ${n} !`, `⚔️ Saladin besieges ${n}!`));
    }
    if (once('tyreSiege', 1187.9) && this.crHolder('Tyr') === 'jerusalem') {
      this.crCampaign('ayyoubides', 'tyreSiege', ['Tyr'], R(E * 1.0), false,
        n => tr(`⚔️ Saladin assiège ${n} !`, `⚔️ Saladin besieges ${n}!`));
    }
    // 1188 : les rois prennent la croix (ils rejoignent Outremer), et lèvent la dîme saladine
    if (once('gisors', 1188.05)) {
      const gold = 1000;
      for (const p of [en, fr, em]) {
        if (!p.alive) continue;
        p.gold += gold;
        if (this.pacts.has(cr.pact.croisade) && this.crCanJoin(p)) p.pact = cr.pact.croisade;
      }
      // (la Sicile de Guillaume II prend la croix aussi : sa flotte sauve Tripoli et Tyr en 1188)
      const si = this.crP('sicile');
      if (this.pacts.has(cr.pact.croisade) && this.crCanJoin(si) && si.pact < 0) si.pact = cr.pact.croisade;
      if (this.pacts.has(cr.pact.croisade)) this.pacts.get(cr.pact.croisade).name = tr('La Croisade', 'The Crusade');
      this.version++;
      this.crEvent('gisors', { gold: fmt(gold) }, tr('✝️ 1188 : les rois d\'Occident prennent la croix.', '✝️ 1188: the kings of the West take the cross.'), '');
    }
    if (once('guy', 1188.55) && jer.alive) {
      jer.troops += R(E * 0.5);
      this.crEvent('guy', { army: fmt(R(E * 0.5)) }, null);
    }
    if (once('barbarossa', 1189.36) && em.alive) {
      em.troops += R(E * 1.5);
      this.crEvent('barbarossa', { army: fmt(R(E * 1.5)) }, tr('🦅 1189 : Barberousse part en croisade avec la plus grande armée d\'Occident.', '🦅 1189: Barbarossa sets out on crusade with the greatest army of the West.'), '');
    }
    if (once('richardKing', 1189.51) && en.alive) {
      cr.richard = true;
      this.crEvent('richardKing', {}, tr('🦁 1189 : Richard Cœur de Lion devient roi d\'Angleterre.', '🦁 1189: Richard the Lionheart becomes King of England.'), '');
    }
    // 1189 : le siège d'Acre (Guy, avec les renforts d'Occident)
    if (once('acreSiege', 1189.65) && this.crHolder('Acre') !== 'jerusalem') {
      this.crCampaign('jerusalem', 'acreSiege', ['Acre'], R(E * 0.9), true,
        n => tr(`⚔️ Le roi Guy assiège ${n} !`, `⚔️ King Guy besieges ${n}!`), 'musulmans');
    }
    // 1188 : Saladin contre les forteresses des Ordres (il renonce devant le Krak et Tortose) : Baghras, Safed, Belvoir
    if (once('saladinNorth', 1188.7) && this.crHolder('Baghras') && this.crHolder('Baghras') !== 'ayyoubides') {
      this.crCampaign('ayyoubides', 'saladinNorth', ['Baghras'], R(E * 0.9), false,
        n => tr(`⚔️ Saladin assiège ${n}, la forteresse du Temple !`, `⚔️ Saladin besieges ${n}, the Temple's fortress!`));
    }
    if (once('safedSiege', 1188.85) && this.crHolder('Safed') && this.crHolder('Safed') !== 'ayyoubides') {
      this.crCampaign('ayyoubides', 'safedSiege', ['Safed'], R(E * 0.9), false,
        n => tr(`⚔️ Saladin assiège ${n}, la forteresse du Temple !`, `⚔️ Saladin besieges ${n}, the Temple's fortress!`));
    }
    if (once('belvoirSiege', 1188.95) && this.crHolder('Belvoir') && this.crHolder('Belvoir') !== 'ayyoubides') {
      this.crCampaign('ayyoubides', 'belvoirSiege', ['Belvoir'], R(E * 0.8), false,
        n => tr(`⚔️ Saladin assiège ${n}, la forteresse de l'Hôpital !`, `⚔️ Saladin besieges ${n}, the Hospital's fortress!`));
    }
    // 1189 : à Niš, la Serbie s'allie aux frères Assen contre Byzance ; elle les quitte en 1196 (Étienne Nemanjić
    // épouse une princesse byzantine)
    const se = this.crP('serbie'), bg = this.crP('bulgarie');
    if (once('nis', C.NIS.JOIN) && this.pacts.has(cr.pact.assen) && bg.pact === cr.pact.assen && this.crCanJoin(se) && se.pact < 0) {
      se.pact = cr.pact.assen;
      this.pacts.get(cr.pact.assen).name = tr('L\'alliance de Niš', 'The alliance of Niš');
      this.version++;
      UI.log(tr('🤝 1189 : à Niš, la Serbie de Nemanja s\'allie aux frères Assen contre Byzance.', '🤝 1189: at Niš, Nemanja\'s Serbia allies with the Asen brothers against Byzantium.'), '', se);
    }
    if (once('nisEnd', C.NIS.LEAVE) && se.alive && se.pact === cr.pact.assen && !se.human) {
      this.crLeavePact(se);
      if (this.pacts.has(cr.pact.assen)) this.pacts.get(cr.pact.assen).name = tr('Les frères Assen', 'The Asen brothers');
      UI.log(tr('💍 1196 : la Serbie quitte l\'alliance bulgare : Étienne Nemanjić épouse une princesse byzantine.', '💍 1196: Serbia leaves the Bulgarian alliance: Stefan Nemanjić marries a Byzantine princess.'), '', se);
    }
    // 1189 : le pacte secret d'Isaac Ange avec Saladin
    if (once('byzantineTreaty', 1189.75) && by.alive && sal.alive) {
      if (by.isHuman) this.crOffer('byzantineTreaty', {});
      else this.crApplyChoice('byzantineTreaty', 'saladin');
    }
    // 1190 : Barberousse devant Konya, puis le Saleph
    if (once('konya', 1190.3) && this.crHolder('Konya') !== 'empire') {
      this.crCampaign('empire', 'konya', ['Konya'], R(E * 1.6), false,
        n => tr(`⚔️ L'armée de Barberousse surgit devant ${n} !`, `⚔️ Barbarossa's army appears before ${n}!`));
    }
    if (once('saleph', 1190.44) && em.alive) this.crSaleph();
    if (once('messina', 1190.8)) {
      const gold = 800;
      for (const p of [en, fr]) if (p.alive) p.gold += gold;
      this.crEvent('messina', { gold: fmt(gold) }, null);
    }
    // 1191 : la croisade des rois : Philippe devant Acre, Richard à Chypre puis devant Acre
    if (once('philipArrives', 1191.3)) this.crCampaign('france', 'kingsArriveFr', ['Acre', 'Jaffa', 'Jérusalem'], R(E * 1.4), true,
      n => tr(`⛵ Philippe Auguste débarque devant ${n} !`, `⛵ Philip Augustus lands before ${n}!`), 'musulmans');
    if (once('cyprus', 1191.35) && this.crHolder('Nicosie') === 'chypre') {
      this.crCampaign('angleterre', 'cyprus', ['Nicosie'], R(E * 0.8), true,
        n => tr(`⛵ Richard débarque à Chypre et marche sur ${n} !`, `⛵ Richard lands on Cyprus and marches on ${n}!`));
    }
    if (once('kingsArrive', 1191.43)) {
      const done = this.crCampaign('angleterre', 'kingsArriveEn', ['Acre', 'Jaffa', 'Jérusalem'], R(E * 1.8), true,
        n => tr(`⛵ Richard Cœur de Lion débarque devant ${n} !`, `⛵ Richard the Lionheart lands before ${n}!`), 'musulmans');
      if (done || en.alive || fr.alive) this.crEvent('kingsArrive', {}, null);
    }
    if (once('philipLeaves', 1191.58) && fr.alive) {
      if (fr.isHuman) this.crOffer('philipLeaves', {});
      else this.crApplyChoice('philipLeaves', 'home');
    }
    if (once('arsuf', 1191.68) && en.alive && cr.richard) {
      cr.arsuf = true;
      this.crEvent('arsuf', {}, tr('⚔️ 1191 : Richard bat Saladin à Arsouf.', '⚔️ 1191: Richard defeats Saladin at Arsuf.'), '');
    }
    // 1191-1192 : Chypre vendue aux Templiers, puis revendue à Guy de Lusignan (voir ordres.js)
    if (once('cyprusSale', C.CYPRUS.SALE)) this.crCyprusSale();
    if (once('cyprusRevolt', C.CYPRUS.REVOLT)) this.crCyprusRevolt();
    // 1192 : Conrad assassiné (sauf s'il a payé tribut aux Assassins)
    if (once('conrad', 1192.32) && jer.alive) this.crConrad();
    // 1192 : la paix de Jaffa ; les rois rentrent chez eux
    if (once('jaffa', 1192.67)) this.crJaffa();
    if (once('captured', 1192.95) && en.alive) {
      const gold = C.RANSOM[cr.diff];
      cr.ransom = { left: gold, total: gold, paid: false };
      this.crEvent('captured', { gold: fmt(gold) }, tr(`⛓️ Richard Cœur de Lion est prisonnier en Autriche ! Rançon : ${fmt(gold)} pièces d'or.`, `⛓️ Richard the Lionheart is a prisoner in Austria! Ransom: ${fmt(gold)} gold.`), '', en);
    }
    // 1193 : la mort de Saladin, et le partage de son empire
    if (once('saladinDies', 1193.17) && sal.alive) {
      if (sal.isHuman) this.crOffer('saladinDies', {});
      else this.crApplyChoice('saladinDies', 'share');
    }
    if (once('sicily', 1194.85) && this.crHolder('Palerme') === 'sicile') {
      this.crCampaign('empire', 'sicily', ['Palerme', 'Naples'], R(E * 1.4), true,
        n => tr(`⛵ Henri VI débarque en Sicile et marche sur ${n} !`, `⛵ Henry VI lands in Sicily and marches on ${n}!`));
    }
    if (once('isaacBlinded', 1195.3) && by.alive) {
      const lost = R(by.troops * 0.25);
      by.troops -= lost;
      cr.stun.set(by.id, this.tick + 45 * TPS);
      this.crEvent('isaacBlinded', { lost: fmt(lost) }, tr('👁️ 1195 : à Byzance, Isaac Ange est aveuglé par son frère Alexis III.', '👁️ 1195: in Byzantium, Isaac Angelos is blinded by his brother Alexios III.'), '', by);
    }
    if (once('germanCrusade', 1197.4)) {
      this.crCampaign('empire', 'germanCrusade', ['Acre', 'Jaffa', 'Tyr', 'Ascalon', 'Jérusalem'], R(E * 1.2), true,
        n => tr(`⛵ Les croisés d'Henri VI débarquent devant ${n} !`, `⛵ Henry VI's crusaders land before ${n}!`), 'musulmans');
    }
    if (once('henryDies', 1197.75) && em.alive) {
      cr.civilWarUntil = this.tick + 120 * TPS;
      this.crEvent('henryDies', { secs: 120 }, tr('⚱️ 1197 : l\'empereur Henri VI est mort ; l\'Empire se déchire.', '⚱️ 1197: Emperor Henry VI is dead; the Empire tears itself apart.'), '', em);
    }
    if (once('richardDies', 1199.27) && en.alive) {
      cr.richard = false;
      cr.john = true;
      this.crEvent('richardDies', {}, tr('⚱️ 1199 : Richard Cœur de Lion meurt à Châlus ; Jean sans Terre lui succède.', '⚱️ 1199: Richard the Lionheart dies at Châlus; John Lackland succeeds him.'), '', en);
    }
    if (once('reunify', 1200.5)) this.crReunify();
    if (once('venice', 1201.3) && ve.alive) this.crEvent('venice', {}, tr('⛵ 1201 : les barons de la quatrième croisade louent la flotte de Venise.', '⛵ 1201: the barons of the Fourth Crusade hire the fleet of Venice.'), '');
    if (once('zara', 1202.85) && ve.alive && this.crHolder('Zara') !== 'venise') {
      ve.faithBonus = (ve.faithBonus || 0) - C.VENICE.EXCOMMUNICATION;
      this.faithCache = null;
      this.crCampaign('venise', 'zara', ['Zara'], R(E * 1.3), true,
        n => tr(`⛵ La flotte vénitienne débarque les croisés devant ${n} !`, `⛵ The Venetian fleet lands the crusaders before ${n}!`));
    }
    if (once('constantinople1', 1203.5) && ve.alive && this.crHolder('Constantinople') !== 'venise') {
      this.crCampaign('venise', 'constantinople1', ['Constantinople'], R(E * 1.6), true,
        n => tr(`⛵ Les croisés et les Vénitiens attaquent ${n} !`, `⛵ The crusaders and the Venetians attack ${n}!`));
    }
    if (once('sack', 1204.27) && ve.alive && this.crHolder('Constantinople') !== 'venise') {
      this.crCampaign('venise', 'sack', ['Constantinople'], R(E * (ve.isHuman ? 1.5 : 2.4)), true,
        n => tr(`🔥 L'assaut final des croisés sur ${n} !`, `🔥 The crusaders' final assault on ${n}!`));
    }
    if (once('end', C.YEAR_END)) this.crEvent('end', {}, tr('🏁 1204 : la fin d\'une époque.', '🏁 1204: the end of an era.'), '');
  },

  // 🌊 Juin 1190 : Barberousse au Saleph. S'il tient le gué de Séleucie, il passe sur le pont ; sinon, il se noie
  crSaleph() {
    const cr = this.cr, em = this.crP('empire'), S = CROISADES.SALEPH;
    const ford = this.crCity('Séleucie');
    if (ford >= 0 && this.owner[ford] === em.id) {
      cr.salephBridge = true;
      return this.crEvent('salephBridge', {}, tr('🌉 1190 : Barberousse passe le Saleph sur le pont de Séleucie… et vit !', '🌉 1190: Barbarossa crosses the Saleph on the bridge of Seleucia… and lives!'), 'good', em);
    }
    const lost = Math.round(em.troops * S.LOSS);
    em.troops -= lost;
    this.crEvent('saleph', { lost: fmt(lost) }, tr('🌊 1190 : Frédéric Barberousse se noie dans le Saleph ; sa grande armée se débande.', '🌊 1190: Frederick Barbarossa drowns in the Saleph; his great army falls apart.'), '', em);
  },
  // 🗡️ Avril 1192 : les Assassins tuent Conrad de Montferrat (sauf s'il leur paie tribut)
  crConrad() {
    const cr = this.cr, jer = this.crP('jerusalem'), TPS = CONFIG.TICKS_PER_SECOND, as = this.crP('assassins');
    if (cr.tributePaid.has(jer.id) || !as.alive) {
      return this.crEvent('conradSpared', {}, tr('🗡️ 1192 : les Assassins épargnent Conrad de Montferrat.', '🗡️ 1192: the Assassins spare Conrad of Montferrat.'), '', jer);
    }
    const lost = Math.round(jer.troops * 0.3), secs = 60;
    jer.troops -= lost;
    cr.stun.set(jer.id, this.tick + secs * TPS);
    this.crEvent('conrad', { lost: fmt(lost), secs }, tr('🗡️ 1192 : les Assassins poignardent Conrad de Montferrat à Tyr.', '🗡️ 1192: the Assassins stab Conrad of Montferrat in Tyre.'), '', jer);
  },
  // 🕊️ Septembre 1192 : la paix de Jaffa (une trêve entre Saladin et les croisés) ; les rois d'Occident quittent la
  // croisade, et le pacte secret de Byzance avec Saladin prend fin
  crJaffa() {
    const cr = this.cr, TPS = CONFIG.TICKS_PER_SECOND;
    cr.truceUntil = this.tick + CROISADES.TRUCE * TPS;
    for (const role of ['angleterre', 'france', 'empire', 'sicile']) {
      const p = this.crP(role);
      if (p.alive && p.pact === cr.pact.croisade) this.crLeavePact(p);
    }
    if (cr.pact.secret !== undefined && this.pacts.has(cr.pact.secret)) {
      for (const role of ['byzance', 'ayyoubides']) { const p = this.crP(role); if (p.pact === cr.pact.secret) this.crLeavePact(p); }
    }
    if (this.pacts.has(cr.pact.croisade)) this.pacts.get(cr.pact.croisade).name = tr('Outremer', 'Outremer');
    this.crEvent('jaffa', { secs: CROISADES.TRUCE }, tr('🕊️ 1192 : la paix de Jaffa ; trois ans de trêve entre Saladin et les croisés.', '🕊️ 1192: the peace of Jaffa; a three-year truce between Saladin and the crusaders.'), '');
  },
  crTruce() { return this.cr && this.tick < this.cr.truceUntil; },
  // Pendant la paix de Jaffa, pas d'assaut entre Saladin (ou l'Égypte) et les croisés
  crTruceBlock(pid, target) {
    if (!this.crTruce()) return null;
    const a = this.crSaracen(pid) && this.crCrusader(target), b = this.crCrusader(pid) && this.crSaracen(target);
    if (!a && !b) return null;
    return tr(`🕊️ La paix de Jaffa : pas d'assaut avant ${Math.ceil((this.cr.truceUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`,
      `🕊️ The peace of Jaffa: no assault for another ${Math.ceil((this.cr.truceUntil - this.tick) / CONFIG.TICKS_PER_SECOND)} s.`);
  },

  // 👑 Mars 1193 : la succession de Saladin. L'Égypte (à l'ouest de EGYPT_LON) passe à son fils al-Aziz
  crSuccession(ally) {
    const cr = this.cr, sal = this.crP('ayyoubides'), eg = this.crP('egypte'), W = this.W, lon = CROISADES.SUCCESSION.EGYPT_LON;
    eg.dormant = false;
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] === sal.id && geoLonLat(CROISADES_PROJ, i % W, (i / W) | 0, W, this.H)[0] < lon) this.setOwner(i, eg.id);
    }
    for (const [a, w] of this.works) if (w.pid === sal.id && this.owner[a] === eg.id) w.pid = eg.id;
    if (!eg.tiles) return this.eliminate(eg.id, -1, true);
    for (const c of this.castles) if (this.owner[c] === eg.id) { this.garrison[c] = this.garrisonMax(c); if (eg.capital < 0 || eg.capital === undefined) eg.capital = c; }
    const cairo = this.crCity('Le Caire');
    if (cairo >= 0 && this.owner[cairo] === eg.id) eg.capital = cairo;
    eg.troops = Math.round(this.maxTroops(eg) * 0.5);
    eg.gold = 600;
    if (ally) { eg.pact = sal.pact >= 0 && this.pacts.has(sal.pact) ? sal.pact : (cr.pact.ayyoub = this.crNewPact(tr('Les Ayyoubides', 'The Ayyubids'), 'ayyoubides', ['ayyoubides'])); this.version++; }
    UI.log(tr('👑 L\'Égypte passe à al-Aziz, le fils de Saladin.', '👑 Egypt passes to al-Aziz, Saladin\'s son.'), '', eg);
  },
  // 1200 : al-Adil réunit l'empire de Saladin (les terres de l'Égypte reviennent aux Ayyoubides, si ce sont des bots)
  crReunify() {
    const sal = this.crP('ayyoubides'), eg = this.crP('egypte');
    if (!sal.alive || !eg.alive || eg.dormant || sal.isHuman || eg.isHuman) return;
    const keep = this.castles.filter(c => this.owner[c] === eg.id).map(c => [c, this.garrison[c]]);
    sal.troops += eg.troops; sal.gold += eg.gold;
    eg.troops = eg.gold = 0;
    this.eliminate(eg.id, -1, true);
    for (let i = 0; i < this.N; i++) if (this.owner[i] === eg.id) this.setOwner(i, sal.id);
    for (const [c, g] of keep) this.garrison[c] = g;
    for (const w of this.works.values()) if (w.pid === eg.id) w.pid = sal.id;
    UI.log(tr('👑 1200 : al-Adil, le frère de Saladin, réunit l\'Égypte et la Syrie.', '👑 1200: al-Adil, Saladin\'s brother, reunites Egypt and Syria.'), '', sal);
  },

  // --- 📜 Les parchemins à choix (voir CHOICES) : la partie attend la réponse du joueur ---
  crOffer(key, data) {
    const C = CROISADES, cr = this.cr;
    cr.offers[key] = data;
    const vars = Object.assign({ gold: fmt(1500), faith: key === 'saladinDies' ? C.SUCCESSION.FAITH : 60, pct: Math.round(C.SUCCESSION.CIVIL_WAR * 100) }, data);
    UI.parchment(C.EVENTS[key], vars, C.CHOICES[key].map(c => ({ key, pick: c.pick, label: c.label })));
  },
  // Le joueur a choisi (ordre « hyChoice »)
  crChoose(pid, key, pick) {
    const cr = this.cr;
    if (!cr.offers[key] || pid !== this.human.id || !CROISADES.CHOICES[key].some(c => c.pick === pick)) return null;
    delete cr.offers[key];
    this.crApplyChoice(key, pick);
    return null;
  },
  crApplyChoice(key, pick) {
    const C = CROISADES, cr = this.cr, h = this.human;
    if (this.crOrderChoice(key, pick)) { this.version++; return; } // (🏝️ les choix de Chypre : voir ordres.js)
    if (key === 'philipLeaves') {
      const fr = this.crP('france');
      if (pick === 'home') {
        fr.gold += 1500;
        this.crLeavePact(fr);
        if (fr.isHuman) UI.log(tr('🏰 Tu rentres en France : +1 500 d\'or de l\'héritage de Flandre. La croisade continue sans toi.', '🏰 You go home to France: +1,500 gold from the Flemish inheritance. The crusade goes on without you.'), 'good');
        else this.crEvent('philipLeaves', {}, tr('🏰 1191 : Philippe Auguste quitte la croisade et rentre en France.', '🏰 1191: Philip Augustus leaves the crusade and goes home to France.'), '', fr);
      } else {
        fr.faithBonus = (fr.faithBonus || 0) + 60;
        this.faithCache = null;
        UI.log(tr('✝️ Tu restes en Terre sainte : +60 de Croyance.', '✝️ You stay in the Holy Land: +60 Faith.'), 'good');
      }
    }
    if (key === 'byzantineTreaty') {
      const by = this.crP('byzance'), sal = this.crP('ayyoubides');
      if (pick === 'saladin') {
        cr.pact.secret = this.crNewPact(tr('Le pacte secret', 'The secret pact'), 'byzance', ['byzance', 'ayyoubides']);
        if (!by.isHuman) this.crEvent('byzantineTreaty', {}, tr('🤝 1189 : Byzance et Saladin s\'allient en secret contre les croisés.', '🤝 1189: Byzantium and Saladin secretly ally against the crusaders.'), '', by);
        else UI.log(tr('🤝 Tu t\'allies à Saladin, jusqu\'à la paix de Jaffa.', '🤝 You ally with Saladin, until the peace of Jaffa.'), 'good', sal);
      } else {
        by.faithBonus = (by.faithBonus || 0) + 60;
        this.faithCache = null;
        UI.log(tr('✝️ Tu refuses l\'alliance du sultan : +60 de Croyance.', '✝️ You refuse the sultan\'s alliance: +60 Faith.'), 'good');
      }
    }
    if (key === 'saladinDies') {
      const sal = this.crP('ayyoubides'), S = C.SUCCESSION;
      if (pick === 'share') {
        this.crSuccession(sal.isHuman);
        sal.faithBonus = (sal.faithBonus || 0) + S.FAITH;
        this.faithCache = null;
        if (!sal.isHuman) this.crEvent('saladinDies', {}, tr('⚱️ 1193 : Saladin est mort ; ses fils se partagent son empire.', '⚱️ 1193: Saladin is dead; his sons divide his empire.'), '', sal);
      } else {
        const lost = Math.round(sal.troops * S.CIVIL_WAR);
        sal.troops -= lost;
        UI.log(tr(`⚔️ Tu gardes tout l'héritage : la guerre entre les frères te coûte ${fmt(lost)} soldats.`, `⚔️ You keep the whole inheritance: the war between the brothers costs you ${fmt(lost)} soldiers.`), 'warn');
      }
    }
    if (h && h.alive) this.version++;
  },

  // ⛓️ La rançon de Richard : une part de l'or de l'Angleterre y part chaque seconde (pour l'Empereur), jusqu'au bout
  crStepRansom() {
    const cr = this.cr, r = cr.ransom, en = this.crP('angleterre');
    if (!r || r.paid || !en.alive) return;
    const pay = Math.min(r.left, en.gold * CROISADES.RANSOM_SHARE), em = this.crP('empire');
    en.gold -= pay;
    if (em.alive) em.gold += pay;
    r.left -= pay;
    if (r.left < 1) {
      r.paid = true;
      UI.log(tr('⛓️ La rançon est payée : Richard Cœur de Lion rentre en Angleterre.', '⛓️ The ransom is paid: Richard the Lionheart returns to England.'), en.isHuman ? 'good' : '', en);
    }
  },

  // ⚔️ Les razzias des Coumans (comme les Slaves de Charlemagne : voir stepRaids)
  crStepRaids() {
    const cr = this.cr, R = CROISADES.RAIDS, TPS = CONFIG.TICKS_PER_SECOND;
    if (this.tick < cr.nextRaid) return;
    cr.nextRaid = this.tick + R.EVERY[cr.diff] * TPS;
    for (const p of this.players) {
      if (!p.raiders || !p.alive) continue;
      p.raids = (p.raids || 0) + 1;
      const army = Math.min(R.MAX, Math.round(R.ARMY[cr.diff] * (1 + R.GROWTH * (p.raids - 1))));
      const victims = this.shuffle([...this.neighborStats(p.id).keys()].filter(o => o >= 0 && this.players[o].alive && !this.players[o].raiders && !this.areAllied(p.id, o)));
      for (const o of victims) {
        const castle = this.raidTarget(p.id, o);
        if (castle < 0) continue;
        p.troops = army;
        if (this.launchAttack(p.id, o, army, castle)) continue;
        const a = this.attacks.find(a => !a.done && a.attacker === p.id && a.target === o);
        if (a) { a.raid = true; a.loot = R.LOOT; }
        if (this.players[o].isHuman) UI.log(tr(`⚔️ Les Coumans des steppes lancent une razzia de ${fmt(army)} cavaliers sur tes terres !`, `⚔️ The Cumans of the steppes launch a raid of ${fmt(army)} horsemen on your lands!`), 'warn', p);
        break;
      }
    }
  },

  // --- 🗡️ Les Assassins du Vieux de la Montagne (voir ASSASSINS) ---
  crAssassins() { const p = this.crP('assassins'); return p && p.alive ? p : null; },
  crProtected(pid) { return (this.cr.tributeUntil.get(pid) || 0) > this.tick; },
  // Pourquoi pid ne peut pas engager les Assassins contre target (null s'il le peut)
  crHireError(pid, target) {
    const A = CROISADES.ASSASSINS, as = this.crAssassins(), p = this.players[pid], t = this.players[target];
    if (!as) return tr('Il n\'y a plus d\'Assassins.', 'There are no Assassins left.');
    if (!t || !t.alive || target === pid || target === as.id || t.raiders) return tr('Personne à frapper ici.', 'Nobody to strike here.');
    if (t.order) return tr('Tuer un grand maître ne sert à rien : l\'Ordre en élit aussitôt un autre.', 'Killing a Grand Master is useless: the Order at once elects another.');
    if (pid === as.id) return null;
    const wait = (this.cr.hireReady.get(pid) || 0) - this.tick;
    if (wait > 0) return tr(`Les Assassins ne reprendront un contrat que dans ${Math.ceil(wait / CONFIG.TICKS_PER_SECOND)} s.`, `The Assassins will take another contract only in ${Math.ceil(wait / CONFIG.TICKS_PER_SECOND)} s.`);
    if (p.gold < A.HIRE) return tr(`Il faut ${fmt(A.HIRE)} pièces d'or pour engager les Assassins.`, `You need ${fmt(A.HIRE)} gold to hire the Assassins.`);
    return null;
  },
  // pid engage les Assassins contre target (ordre « crHire ») : il perd une part de son armée et ne recrute plus un
  // moment… sauf s'il paie tribut au Vieux de la Montagne
  crHire(pid, target) {
    const err = this.crHireError(pid, target);
    if (err) return err;
    const A = CROISADES.ASSASSINS, TPS = CONFIG.TICKS_PER_SECOND, p = this.players[pid], t = this.players[target], as = this.crAssassins();
    p.gold -= A.HIRE;
    as.gold += A.HIRE;
    this.cr.hireReady.set(pid, this.tick + A.COOLDOWN * TPS);
    if (this.crProtected(target)) {
      if (p.isHuman) UI.log(tr(`🗡️ Le Vieux de la Montagne refuse de frapper ${t.name}, qui lui paie tribut. Ton or est perdu.`, `🗡️ The Old Man of the Mountain refuses to strike ${t.name}, who pays him tribute. Your gold is lost.`), 'warn', t);
      if (t.isHuman) UI.log(tr(`🗡️ Des Assassins rôdaient chez toi… ton tribut au Vieux de la Montagne t'a protégé.`, `🗡️ Assassins were prowling in your lands… your tribute to the Old Man of the Mountain protected you.`), 'good', p);
      return null;
    }
    const lost = Math.round(t.troops * A.KILL);
    t.troops -= lost;
    this.cr.stun.set(target, this.tick + A.STUN * TPS);
    if (p.isHuman) UI.log(tr(`🗡️ Les Assassins ont frappé chez ${t.name} : ${fmt(lost)} soldats désertent, et le royaume ne recrute plus pendant ${A.STUN} s.`, `🗡️ The Assassins have struck at ${t.name}: ${fmt(lost)} soldiers desert, and the kingdom recruits no more for ${A.STUN} s.`), 'good', t);
    else if (t.isHuman) UI.log(tr(`🗡️ Les Assassins ont poignardé un de tes chefs ! ${fmt(lost)} soldats désertent, et tu ne recrutes plus pendant ${A.STUN} s.`, `🗡️ The Assassins have stabbed one of your lords! ${fmt(lost)} soldiers desert, and you recruit no more for ${A.STUN} s.`), 'warn', as);
    return null;
  },
  crTributeError(pid) {
    const A = CROISADES.ASSASSINS, p = this.players[pid], as = this.crAssassins();
    if (!as || pid === as.id) return tr('Il n\'y a plus d\'Assassins.', 'There are no Assassins left.');
    if (this.crProtected(pid)) return tr('Ton tribut te protège déjà.', 'Your tribute already protects you.');
    if (p.gold < A.TRIBUTE) return tr(`Il faut ${fmt(A.TRIBUTE)} pièces d'or pour le tribut.`, `You need ${fmt(A.TRIBUTE)} gold for the tribute.`);
    return null;
  },
  // pid paie tribut au Vieux de la Montagne (ordre « crTribute ») : protégé de ses Assassins pendant SAFE secondes
  crTribute(pid) {
    const err = this.crTributeError(pid);
    if (err) return err;
    const A = CROISADES.ASSASSINS, p = this.players[pid];
    p.gold -= A.TRIBUTE;
    this.crAssassins().gold += A.TRIBUTE;
    this.cr.tributeUntil.set(pid, this.tick + A.SAFE * CONFIG.TICKS_PER_SECOND);
    this.cr.tributePaid.add(pid);
    if (p.isHuman) UI.log(tr(`🗡️ Tu paies tribut au Vieux de la Montagne : ses Assassins t'épargneront pendant ${A.SAFE} s.`, `🗡️ You pay tribute to the Old Man of the Mountain: his Assassins will spare you for ${A.SAFE} s.`), 'good');
    return null;
  },
  // De temps en temps, un bot riche engage les Assassins contre son plus grand voisin ennemi
  crStepAssassins() {
    const cr = this.cr, A = CROISADES.ASSASSINS, TPS = CONFIG.TICKS_PER_SECOND;
    if (this.tick < cr.nextAssassin || !this.crAssassins()) return;
    cr.nextAssassin = this.tick + A.AI_EVERY * TPS;
    const bots = this.players.filter(p => p.alive && !p.human && !p.defensive && !p.raiders && !p.dormant && p.gold >= A.AI_GOLD);
    if (!bots.length) return;
    const p = bots[Math.floor(this.rand() * bots.length)];
    const foes = [...this.neighborStats(p.id).keys()].filter(o => o >= 0 && !this.aiSpares(p.id, o) && !this.crHireError(p.id, o))
      .sort((a, b) => this.players[b].tiles - this.players[a].tiles || a - b);
    if (foes.length) this.crHire(p.id, foes[0]);
  },

  // --- Les effets du scénario sur les règles du jeu ---
  // Recrutement : frappé par les Assassins (rien), Richard captif, Jean sans Terre, la guerre civile de l'Empire
  crRecruit(p) {
    const cr = this.cr, C = CROISADES;
    if ((cr.stun.get(p.id) || 0) > this.tick) return 0;
    let k = this.crMaxTroops(p);
    if (p.role === 'angleterre') {
      if (cr.ransom && !cr.ransom.paid) k *= C.CAPTIVE;
      if (cr.john) k *= C.JOHN;
    }
    if (p.role === 'empire' && this.tick < cr.civilWarUntil) k *= 0.5;
    return k;
  },
  // Armée maximum : Saladin (un bot) a une armée plus grande (voir SALADIN.BOOST), et les ordres aussi (ORDERS.ARMY)
  crMaxTroops(p) {
    if (p.order) return CROISADES.ORDERS.ARMY; // (✠ les recrues des commanderies d'Occident)
    if (p.role !== 'ayyoubides' || p.isHuman) return 1;
    return CROISADES.SALADIN.BOOST[this.cr.diff];
  },
  // Force des soldats : Saladin, Richard Cœur de Lion (et Arsouf), Barberousse vivant, les chevaliers des ordres
  crPower(pid) {
    const cr = this.cr, C = CROISADES, p = this.players[pid], y = this.crYear();
    let k = 1;
    if (p.role === 'ayyoubides' && y < 1193.17) k += C.SALADIN.POWER;
    if (p.order) k += C.ORDERS.POWER; // (✠ des moines-soldats : la meilleure chevalerie d'Orient)
    if (p.role === 'angleterre' && cr.richard && !(cr.ransom && !cr.ransom.paid)) k += C.RICHARD.HERO + (cr.arsuf ? C.RICHARD.ARSUF : 0);
    if (p.role === 'empire' && cr.salephBridge && y < 1192.67) k += C.SALEPH.HERO;
    return k;
  },

  // L'IA : les deux camps s'affrontent (les croisés contre l'islam), les petits royaumes neutres sont ménagés, et les
  // vieilles rivalités comptent (la France contre l'Angleterre, les Bulgares et Venise contre Byzance)
  crTargetBonus(p, e) {
    if (e.raiders) return 1;
    let k = 1;
    if (p.camp && e.camp && p.camp !== e.camp) k *= 1.5;
    if (p.camp && e.camp && p.camp === e.camp) k *= 0.6;
    if (e.defensive) k *= 0.7;
    if ((p.role === 'ayyoubides' || p.role === 'egypte') && e.order) k *= CROISADES.ORDERS.SALADIN_HATE; // (✠ il hait les Ordres)
    const pair = r => (p.role === r[0] && e.role === r[1]) || (p.role === r[1] && e.role === r[0]);
    if (pair(['france', 'angleterre']) && this.crYear() > 1191.58) k *= 3;
    if (pair(['bulgarie', 'byzance']) || pair(['roum', 'byzance'])) k *= 2;
    if (pair(['venise', 'byzance']) && this.crYear() > 1201) k *= 3;
    if (pair(['venise', 'hongrie']) && this.crYear() > 1201) k *= 2;
    return k;
  },
  // ✝️ La Croyance ne convertit les terres qu'entre chrétiens et musulmans (pas entre deux rois chrétiens)
  crFaithPair(a, b) {
    const ca = this.players[a].camp, cb = this.players[b].camp;
    return !!ca && !!cb && ca !== cb;
  },
  // Les lieux des objectifs du joueur : on ne peut pas les raser (razzias, assauts vikings)
  crObjectiveSites() {
    const set = new Set(), list = this.crObjList();
    for (const o of list || []) {
      for (const n of o.cities || []) { const a = this.crCity(n); if (a >= 0) set.add(a); }
      if (o.city) { const a = this.crCity(o.city); if (a >= 0) set.add(a); }
      if (o.name) { const a = this.crCity(o.name); if (a >= 0) set.add(a); }
    }
    const cross = this.crCity(CROISADES.TRUE_CROSS);
    if (cross >= 0) set.add(cross);
    return set;
  },

  // --- 👑 Les objectifs (voir OBJECTIVES dans croisades.js) ---
  crObjList() { const o = CROISADES.OBJECTIVES[this.human.role]; return o ? o.list : null; },
  crObjTitle() { const o = CROISADES.OBJECTIVES[this.human.role]; return o ? o.title : ''; },
  crObjectiveMet(o) {
    const cr = this.cr, h = this.human, diff = cr.diff, mine = c => c >= 0 && this.owner[c] === h.id;
    if (o.kind === 'city') return o.cities.every(n => mine(this.crCity(n)));
    if (o.kind === 'church') return mine(this.crCity(o.name));
    if (o.kind === 'never') return mine(this.crCity(o.city));
    if (o.kind === 'cross') return mine(this.crCity(CROISADES.TRUE_CROSS)) && (this.relicChurch.get(this.crCity(CROISADES.TRUE_CROSS)) || 0) > 0;
    if (o.kind === 'faith') return this.faithOf(h.id) >= o.goal[diff];
    if (o.kind === 'citadel') return this.castles.some(c => this.owner[c] === h.id && this.level[c] >= o.goal[diff]);
    if (o.kind === 'gold') return h.gold >= o.goal[diff];
    if (o.kind === 'ports') return h.bCount[B_PORT] >= o.goal[diff];
    return false;
  },
  crObjectiveText(o) { return o.goal ? o.text.replace('{n}', fmt(o.goal[this.cr.diff])) : o.text; },
  crStepObjectives() {
    const cr = this.cr, list = this.crObjList();
    if (!list || this.tick % CONFIG.TICKS_PER_SECOND) return;
    list.forEach((o, k) => {
      if (cr.gone[k]) return;
      const met = this.crObjectiveMet(o), was = cr.done[k];
      cr.done[k] = met;
      // (« que Tyr ne tombe jamais » : perdue une fois, c'est pour toujours)
      if (o.kind === 'never' && was && !met) { cr.gone[k] = true; cr.done[k] = false; }
      if (was === undefined || was === met) return;
      const t = this.crObjectiveText(o);
      if (met) UI.log(tr(`✔️ Objectif rempli : ${t}`, `✔️ Objective complete: ${t}`), 'good');
      else UI.log(tr(`❌ Objectif perdu${cr.gone[k] ? ' pour toujours' : ''} : ${t}`, `❌ Objective lost${cr.gone[k] ? ' forever' : ''}: ${t}`), 'warn');
    });
  },
  crObjectives() {
    const list = this.crObjList(), cr = this.cr;
    return list ? list.map((o, k) => ({ text: this.crObjectiveText(o), done: !!cr.done[k], gone: !!cr.gone[k] })) : [];
  },
});
