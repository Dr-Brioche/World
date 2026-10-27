// 🏰 SCÉNARIO « LE GOUFFRE DE HELM » (nuit du 3 au 4 mars 3019 du Tiers Âge, d'après « Les Deux Tours »)
// Le roi Théoden s'est retranché au Gouffre de Helm avec les cavaliers du Rohan. L'armée de Saroumane (Uruk-hai,
// orques et hommes sauvages du Pays de Dun) monte à l'assaut toute la nuit. Le joueur défend : il doit tenir
// Fort-le-Cor (ou les Cavernes Scintillantes) jusqu'à l'aube, quand Erkenbrand et Gandalf arrivent, et que la forêt
// des Huorns engloutit les fuyards. Pas de nouvelles villes : on améliore les siennes, et on bâtit des tours de garde.
// La carte et les réglages (HELM) : voir helmmap.js. Les règles de ce fichier s'ajoutent à celles du jeu (GameRules,
// voir game.js) et à son dessin (Render, voir render.js).

Object.assign(GameRules, {
  // --- Mise en place : les terres, les villes, les tours et les armées de la nuit du 3 mars ---
  startHelm(opts) {
    const H = HELM, M = HELM_MAP, W = this.W, TPS = CONFIG.TICKS_PER_SECOND;
    const diff = H.NIGHT[opts.difficulty] ? opts.difficulty : 'normal';
    this.pactsAllowed = false; // (pas d'autres pactes que celui de la Main Blanche)
    const hd = this.hd = { diff, role: {}, place: {}, kills: 0, dikeHeld: 0, waves: 0, ev: {},
      dawn: H.NIGHT[diff] * 60 * TPS, nextWave: H.WAVE_FIRST * TPS, hornUntil: 0, horns: 1 };
    for (const f of H.factions) {
      const b = BANNERS.findIndex(x => x.set === 'helm' && x.id === f.id);
      const p = f.playable ? this.human : this.addPlayer(f.name, b, false);
      p.name = f.name; p.role = f.id; p.banner = b; p.color = BANNERS[b].color;
      p.defensive = !f.playable; // (Isengard n'attaque qu'avec ses vagues : voir helmWave)
      hd.role[f.id] = p.id;
    }
    const rohan = this.helmP('rohan'), isen = this.helmP('isengard'), dun = this.helmP('dunland');
    // Les terres : seulement celles de la vallée, qu'on atteint à pied depuis la Combe (les creux de montagne derrière
    // la crête restent libres : personne n'y va jamais)
    const valley = new Uint8Array(this.N), todo = [M.places.dike[1] * W + M.places.dike[0]];
    valley[todo[0]] = 1;
    while (todo.length) {
      const i = todo.pop();
      this.forNeighbors(i, n => { if (!valley[n] && this.claimable(n)) { valley[n] = 1; todo.push(n); } });
    }
    for (let i = 0; i < this.N; i++) {
      if (!valley[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if (x >= H.ROHAN_FROM) this.setOwner(i, rohan.id);
      else if (x >= H.DUNLAND_FROM && y > helmValley(x + 0.5).cy) this.setOwner(i, dun.id); // (la moitié sud de la Combe)
      else this.setOwner(i, isen.id);
    }
    // Les villes (et leurs moulins et casernes, dans leur muraille)
    const city = (p, key, level) => {
      const [x, y] = M.places[key], a = this.placeOnLand(p, B_CASTLE, x, y, level);
      if (a >= 0) { hd.place[key] = a; p.castlesBuilt++; }
      return a;
    };
    const inside = (c, p, types) => {
      const h = this.sizeOf(B_CASTLE) / 2, cx = c % W + h, cy = ((c / W) | 0) + h;
      for (const [type, lvl] of types) this.placeOnLand(p, type, cx, cy, lvl, j => this.inWalls(c, j));
    };
    for (const [key, level, name] of H.ROHAN_CITIES) {
      const a = city(rohan, key, level);
      if (a >= 0) this.placeNames.set(a, placeLabel(name)); // (🏷️ son nom, écrit sur la carte)
    }
    rohan.capital = hd.place.hornburg;
    inside(hd.place.hornburg, rohan, [[B_BARRACKS, 3], [B_MILL, 2], [B_MILL, 2]]);
    inside(hd.place.caves, rohan, [[B_MILL, 1]]);
    isen.capital = city(isen, 'isengard', 3);
    inside(isen.capital, isen, [[B_BARRACKS, 3], [B_BARRACKS, 2], [B_MILL, 2], [B_MILL, 2]]);
    dun.capital = city(dun, 'dunland', 2);
    inside(dun.capital, dun, [[B_BARRACKS, 2], [B_MILL, 1]]);
    // Les tours de garde du Rohan
    for (const [x, y, lvl] of H.ROHAN_TOWERS) this.placeOnLand(rohan, B_TOWER, x, y, lvl);
    // 💎 Les gemmes des Cavernes Scintillantes (Aglarond) : une mine déjà creusée, au fond du Gouffre
    for (const d of this.deposits.slice()) this.removeDeposit(d.a); // (pas d'autres filons sur cette petite carte)
    const [gx, gy] = M.places.caves, gem = this.placeOnLand(rohan, B_MINE, gx - 12, gy + 4, 1);
    if (gem >= 0) {
      const d = { a: gem, kind: 'diamond', name: tr('gemmes d\'Aglarond', 'Aglarond gems'), left: MINES.gold.time * TPS, progress: 0, paid: 0 };
      this.deposits.push(d); this.depositAt.set(gem, d);
      for (const j of [gem, gem + 1, gem + W, gem + W + 1]) this.depositTile[j] = 1;
    }
    // Les armées : les Dunlendings attendent leur heure (voir stepHelm)
    rohan.troops = H.ROHAN_TROOPS[diff];
    isen.troops = H.ISENGARD_TROOPS[diff];
    dun.troops = 0; dun.noArmy = true;
    for (const p of [rohan, isen, dun]) p.gold = 300;
    // La Main Blanche : Isengard et le Pays de Dun, un pacte éternel
    const id = this.nextPactId++;
    this.pacts.set(id, { name: tr('la Main Blanche', 'the White Hand'), founder: isen.id, eternal: true });
    isen.pact = dun.pact = id;
    this.phase = 'playing';
    this.paused = true;
  },

  helmP(role) { return this.players[this.hd.role[role]]; },

  // --- Chaque tour : les orques abattus ; chaque seconde : les grands moments de la nuit ---
  stepHelm() {
    const hd = this.hd;
    if (!hd || hd.over) return;
    const H = HELM, TPS = CONFIG.TICKS_PER_SECOND, rohan = this.helmP('rohan'), isen = this.helmP('isengard'), dun = this.helmP('dunland');
    // ☠️ Les soldats d'Isengard (et du Pays de Dun) qui tombent en attaquant le Rohan : ce sont les orques abattus
    for (const a of this.attacks) {
      if (a.target !== rohan.id || (a.attacker !== isen.id && a.attacker !== dun.id)) continue;
      if (a.hdLast !== undefined && a.troops < a.hdLast) hd.kills += a.hdLast - a.troops;
      a.hdLast = a.troops;
    }
    if (this.tick % TPS) return;
    const frac = this.tick / hd.dawn, night = this.tick < hd.dawn;
    // ⚔️ Les vagues d'Isengard
    if (night && this.tick >= hd.nextWave && isen.alive) {
      hd.nextWave = this.tick + H.WAVE_EVERY * TPS;
      hd.waves++;
      this.helmWave(isen, Math.round(H.WAVE_ARMY[hd.diff] * (1 + H.WAVE_GROWTH * (hd.waves - 1))),
        n => tr(`⚔️ Vague n° ${hd.waves} : Saroumane lance ${fmt(n)} Uruk-hai à l'assaut !`, `⚔️ Wave ${hd.waves}: Saruman sends ${fmt(n)} Uruk-hai into the assault!`));
      // (les Dunlendings, une fois arrivés, montent aussi à l'assaut avec chaque vague)
      if (hd.ev.dunland && dun.alive) this.helmWave(dun, Math.round(H.DUNLAND_ARMY[hd.diff] * 0.4), null);
    }
    // 🪓 Les Dunlendings rejoignent l'assaut
    if (night && !hd.ev.dunland && frac >= H.DUNLAND_AT && dun.alive) {
      hd.ev.dunland = true;
      dun.noArmy = false;
      dun.troops += H.DUNLAND_ARMY[hd.diff];
      UI.log(tr(`🪓 Les Dunlendings, hommes sauvages du Pays de Dun, descendent des collines : ${fmt(H.DUNLAND_ARMY[hd.diff])} guerriers rejoignent Saroumane !`,
        `🪓 The Dunlendings, wild men of Dunland, come down from the hills: ${fmt(H.DUNLAND_ARMY[hd.diff])} warriors join Saruman!`), 'warn', dun);
      this.helmWave(dun, dun.troops * 0.7, null);
    }
    // 🐺 Les chevaucheurs de wargs
    if (night && !hd.ev.wargs && frac >= H.WARGS_AT && isen.alive) {
      hd.ev.wargs = true;
      this.helmWave(isen, H.WARGS_ARMY[hd.diff], n => tr(`🐺 Les chevaucheurs de wargs fondent sur le Gouffre : ${fmt(n)} loups et orques !`,
        `🐺 The warg riders sweep down on the Deep: ${fmt(n)} wolves and orcs!`));
    }
    // 🕳️ Le ponceau, sous le Mur du Gouffre
    if (night && !hd.ev.culvert && frac >= H.CULVERT_AT && isen.alive) { hd.ev.culvert = true; this.helmCulvert(isen, rohan); }
    if (hd.culvert >= 0 && hd.culvert !== undefined) this.helmCulvertAttack(isen, rohan);
    // 💥 Le feu de Saroumane
    H.FIRE_AT.forEach((f, k) => {
      if (night && !hd.ev['fire' + k] && frac >= f && isen.alive) { hd.ev['fire' + k] = true; this.helmFire(isen, rohan); }
    });
    // 🏹 Succès : tenir la Digue de Helm → les elfes de la Lórien
    if (this.owner[hd.place.dike] === rohan.id) hd.dikeHeld++;
    if (!hd.elves && hd.dikeHeld >= H.ELVES_DIKE[hd.diff]) {
      hd.elves = true;
      rohan.troops += H.ELVES_TROOPS;
      UI.log(tr(`🏹 Un cor elfique retentit : Haldir et ${H.ELVES_TROOPS} archers de la Lórien viennent combattre aux côtés des Hommes ! Tes tours de garde tirent 50 % plus fort.`,
        `🏹 An elven horn rings out: Haldir and ${H.ELVES_TROOPS} archers of Lórien come to fight alongside Men! Your guard towers shoot 50% harder.`), 'good');
      Render.floatText(hd.place.hornburg, B_CASTLE, tr('🏹 Les elfes !', '🏹 The elves!'));
    }
    // ⚒️ Succès : le concours de Gimli et Legolas → les nains d'Aglarond
    if (!hd.dwarves && hd.kills >= H.DWARVES_KILLS[hd.diff]) {
      hd.dwarves = true;
      rohan.troops += H.DWARVES_TROOPS;
      for (const c of this.castles) if (this.owner[c] === rohan.id) this.garrison[c] = this.garrisonMax(c);
      for (const t of this.buildingTiles) {
        if (this.building[t] === B_TOWER && this.owner[t] === rohan.id && this.level[t] < TOWER_LEVELS.length - 1) this.level[t]++;
      }
      UI.log(tr(`⚒️ « Quarante-deux ! » Gimli a gagné son concours : ${H.DWARVES_TROOPS} nains d'Aglarond surgissent des Cavernes. Tes garnisons grossissent de moitié et chaque tour de garde gagne un niveau !`,
        `⚒️ "Forty-two!" Gimli has won his contest: ${H.DWARVES_TROOPS} dwarves of Aglarond burst out of the Caves. Your garrisons grow by half and every guard tower gains a level!`), 'good');
      Render.floatText(hd.place.caves, B_CASTLE, tr('⚒️ Les nains !', '⚒️ The dwarves!'));
    }
    // 📯 Une Grande tour du Cor : le Cor peut sonner une deuxième fois
    if (!hd.hornTower && this.buildingTiles.some(t => this.building[t] === B_TOWER && this.owner[t] === rohan.id && this.level[t] >= H.TOWER_HORN)) {
      hd.hornTower = true;
      hd.horns++;
      UI.log(tr('📯 La Grande tour du Cor domine le Gouffre : le Cor de Helm pourra sonner une fois de plus !', '📯 The Great horn tower overlooks the Deep: the Horn of Helm can sound once more!'), 'good');
    }
    // 🌅 L'aube
    if (!night && !hd.dawned) this.helmDawn(rohan, isen, dun);
    if (hd.dawned) {
      // (la forêt des Huorns engloutit les armées d'Isengard en fuite)
      for (const p of [isen, dun]) if (p.alive) p.troops *= 1 - H.HUORNS;
      for (const a of this.attacks) if (!a.done && (a.attacker === isen.id || a.attacker === dun.id)) a.troops *= 1 - H.HUORNS;
    }
    // Fin de la bataille : Fort-le-Cor et les Cavernes perdus, c'est la défaite ; l'un des deux tenu à l'aube, la victoire
    const holds = this.owner[hd.place.hornburg] === rohan.id || this.owner[hd.place.caves] === rohan.id;
    if (!holds && rohan.alive) return this.helmEnd(false);
    if (hd.dawned && this.tick >= hd.dawn + H.DAWN_VICTORY * TPS) this.helmEnd(true);
  },

  // Une vague : p reçoit army soldats (venus d'Isengard) et lance toute son armée sur la cible du Rohan qu'il peut
  // atteindre, les défenses avancées d'abord (tours, Digue, Mur, Cavernes) et Fort-le-Cor en dernier (s'il a déjà un
  // assaut en cours, ils le renforcent) ; msg(n) : le message pour le joueur
  helmWave(p, army, msg) {
    const rohan = this.helmP('rohan'), hd = this.hd;
    p.troops += army;
    const rank = c => this.building[c] === B_TOWER ? 0 : c === hd.place.dike ? 1 : c === hd.place.wall ? 2 : c === hd.place.caves ? 3 : c === hd.place.hornburg ? 5 : 4;
    // (une tour dans la muraille d'une ville tombe avec elle : on ne la vise pas)
    const walled = c => this.building[c] === B_TOWER && this.castles.some(k => this.owner[k] === rohan.id && this.inWalls(k, c));
    const aims = this.targetsOf(rohan.id).filter(c => !this.truceLeft(c) && !walled(c) && this.castlePath(p.id, c, -1)).sort((a, b) => rank(a) - rank(b));
    const running = this.attacks.find(a => !a.done && a.attacker === p.id && a.target === rohan.id);
    const aim = running && running.targetCastle >= 0 ? running.targetCastle : aims[0];
    // (les Dunlendings coupés du Rohan par les terres d'Isengard : ils rejoignent la horde de Saroumane)
    const isen = this.helmP('isengard');
    if (aim === undefined && p !== isen && isen.alive) { isen.troops += p.troops * 0.9; p.troops *= 0.1; return msg && UI.log(msg(army), 'warn', p); }
    let err = aim === undefined ? 'none' : this.launchAttack(p.id, rohan.id, p.troops * 0.9, aim);
    // (pas encore de frontière avec le Rohan : il s'avance d'abord dans la Combe, sur les terres libres)
    if (err) this.launchAttack(p.id, -1, p.troops * 0.5);
    if (msg) UI.log(msg(army), 'warn', p);
  },

  // 🕳️ Le ponceau : des orques se glissent sous le Mur du Gouffre et plantent un avant-poste juste derrière lui
  helmCulvert(isen, rohan) {
    const hd = this.hd, [x, y] = HELM_MAP.places.culvert;
    if (this.owner[hd.place.wall] !== rohan.id) return; // (le Mur est déjà tombé : plus besoin de ruse)
    const a = this.spotNear(rohan.id, B_OUTPOST, x, y);
    if (a < 0) return;
    const army = HELM.CULVERT_ARMY[hd.diff], W = this.W;
    for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 3; dx++) {
      const j = a + dy * W + dx;
      if (this.owner[j] === rohan.id && !this.building[j] && this.claimable(j)) this.setOwner(j, isen.id);
    }
    this.placeBuilding(a, B_OUTPOST);
    this.garrison[a] = army;
    this.outposts.set(a, { ready: this.tick + 6 * CONFIG.TICKS_PER_SECOND, landing: a, stationed: 0, victim: rohan.id });
    hd.culvert = a;
    UI.log(tr(`🕳️ Trahison dans le noir : ${fmt(army)} orques se sont glissés par le ponceau, sous le Mur du Gouffre ! Ils surgissent derrière lui : détruis leur avant-poste avant qu'ils n'attaquent.`,
      `🕳️ Treachery in the dark: ${fmt(army)} orcs have crept through the culvert, under the Deeping Wall! They emerge behind it: destroy their outpost before they attack.`), 'warn', isen);
    Render.floatText(a, B_OUTPOST, tr('🕳️ Le ponceau !', '🕳️ The culvert!'));
  },
  // ... une fois leur avant-poste bâti, ils attaquent la cible du Rohan la plus proche (Fort-le-Cor ou les Cavernes)
  helmCulvertAttack(isen, rohan) {
    const hd = this.hd, a = hd.culvert;
    if (this.building[a] !== B_OUTPOST || this.owner[a] !== isen.id) { hd.culvert = -1; return; }
    const o = this.outposts.get(a);
    if (!o || !this.outpostReady(a) || o.stationed < 10) return;
    const W = this.W, d = c => (c % W - a % W) ** 2 + (((c / W) | 0) - ((a / W) | 0)) ** 2;
    const aims = this.targetsOf(rohan.id).filter(c => !this.truceLeft(c)).sort((p, q) => d(p) - d(q));
    for (const c of aims) if (!this.launchAttack(isen.id, rohan.id, o.stationed, c, a)) { hd.culvert = -1; return; }
  },

  // 💥 Le feu de Saroumane : une charge explosive. Un siège en cours finit tout de suite (sa garnison est soufflée) ;
  // sinon, c'est le Mur du Gouffre (ou la prochaine muraille) qui est éventré : son siège sera bien plus court.
  helmFire(isen, rohan) {
    const hd = this.hd;
    const a = this.attacks.find(a => !a.done && a.siege && a.attacker === isen.id && this.building[a.targetCastle] === B_CASTLE && this.owner[a.targetCastle] === rohan.id);
    const c = a ? a.targetCastle : [hd.place.wall, hd.place.dike, hd.place.hornburg, hd.place.caves].find(c => this.owner[c] === rohan.id);
    if (c === undefined) return;
    if (a) {
      a.siege.end = Math.min(a.siege.end, this.tick + HELM.FIRE_SIEGE * CONFIG.TICKS_PER_SECOND);
      a.garrison = (a.garrison || 0) * 0.3;
    } else {
      this.garrison[c] *= 0.3;
    }
    (hd.breached = hd.breached || new Set()).add(c);
    UI.log(tr(`💥 Le feu de Saroumane ! Une explosion éventre ${this.helmName(c)} : sa garnison est soufflée, la muraille ne tiendra plus longtemps !`,
      `💥 The fire of Saruman! An explosion rips open ${this.helmName(c)}: its garrison is blown away, the walls will not hold for long!`), 'warn', isen);
    Render.floatText(c, B_CASTLE, '💥');
  },
  // Le nom d'une ville du Rohan
  helmName(c) {
    const hd = this.hd, e = HELM.ROHAN_CITIES.find(([key]) => hd.place[key] === c);
    return e ? e[2] : tr('la ville', 'the city');
  },

  // 🌅 L'aube : le Cor sonne, Théoden charge, Erkenbrand et Gandalf arrivent, les Huorns se referment sur Isengard
  helmDawn(rohan, isen, dun) {
    const hd = this.hd;
    hd.dawned = true;
    rohan.troops += HELM.ERKENBRAND;
    this.helmHorn(true);
    for (const a of this.attacks) if (!a.done && (a.attacker === isen.id || a.attacker === dun.id)) this.cancelAttack(a.attacker, a.id);
    UI.log(tr(`🌅 L'aube se lève ! Théoden charge hors de Fort-le-Cor (« En avant, Eorlingas ! ») ; Gandalf le Blanc et Erkenbrand descendent la colline avec ${fmt(HELM.ERKENBRAND)} hommes de l'Ouestfolde, et une forêt surgie dans la nuit, celle des Huorns, engloutit l'armée de Saroumane !`,
      `🌅 Dawn breaks! Théoden charges out of the Hornburg ("Forth Eorlingas!"); Gandalf the White and Erkenbrand ride down the hill with ${fmt(HELM.ERKENBRAND)} men of the Westfold, and a forest risen in the night, the Huorns, swallows Saruman's army!`), 'good');
  },

  // 📯 Le Cor de Helm (bouton du joueur, et à l'aube) : les assaillants fuient, les défenseurs sont galvanisés.
  // Renvoie un message d'erreur, ou null.
  helmHorn(free = false) {
    const hd = this.hd, rohan = this.helmP('rohan');
    if (!hd || this.phase !== 'playing') return tr('Le Cor de Helm ne sonne qu\'au Gouffre de Helm.', 'The Horn of Helm only sounds at Helm\'s Deep.');
    if (!free && hd.horns <= 0) return tr('Le Cor de Helm a déjà sonné (une Grande tour du Cor, une tour de niveau 5, permet de le sonner encore).',
      'The Horn of Helm has already sounded (a Great horn tower, a level 5 tower, lets it sound again).');
    if (!free && this.owner[hd.place.hornburg] !== rohan.id) return tr('Le Cor est à Fort-le-Cor : il faut tenir la forteresse pour le sonner.', 'The Horn is in the Hornburg: you must hold the fortress to sound it.');
    if (!free) hd.horns--;
    hd.hornUntil = this.tick + HELM.HORN_TIME * CONFIG.TICKS_PER_SECOND;
    let fled = 0;
    for (const a of this.attacks) {
      if (a.done || a.target !== rohan.id) continue;
      const n = a.troops * HELM.HORN_FLEE;
      a.troops -= n; fled += n;
    }
    hd.kills += fled;
    if (!free) UI.log(tr(`📯 Le Cor de Helm retentit dans le Gouffre, et les montagnes le renvoient ! ${fmt(fled)} assaillants fuient, terrifiés ; pendant ${HELM.HORN_TIME} s, tes soldats se battent ${Math.round((HELM.HORN_POWER - 1) * 100)} % plus fort.`,
      `📯 The Horn of Helm rings through the Deep, and the mountains echo it! ${fmt(fled)} attackers flee in terror; for ${HELM.HORN_TIME} s your soldiers fight ${Math.round((HELM.HORN_POWER - 1) * 100)}% harder.`), 'good');
    Render.hornBlown = performance.now();
    return null;
  },

  helmEnd(win) {
    const hd = this.hd;
    hd.over = true;
    this.phase = 'over';
    UI.showEnd(win, false, win ? 'helm' : 'helmLost');
  },

  // --- Les petits réglages du scénario dans les règles du jeu ---
  // Les tours du Rohan tirent plus fort avec les archers elfes
  helmTowerBoost(pid) { return this.hd.elves && pid === this.hd.role.rohan ? HELM.ELVES_TOWERS : 1; },
  // Garnisons du Rohan plus grandes avec les nains
  helmGarrison(c) { return this.hd.dwarves && this.owner[c] === this.hd.role.rohan ? HELM.DWARVES_GARRISON : 1; },
  // Soldats du Rohan plus forts pendant que le Cor sonne
  helmPower(pid) { return pid === this.hd.role.rohan && this.tick < this.hd.hornUntil ? HELM.HORN_POWER : 1; },
  // Durée d'un siège : plus longue qu'ailleurs, sauf derrière une muraille éventrée par le feu de Saroumane
  helmSiege(c, secs) { return secs * HELM.SIEGE_FACTOR * (this.hd.breached && this.hd.breached.has(c) ? HELM.BREACH_SIEGE : 1); },

  // --- Le cadre des objectifs (voir UI.refreshObjectives) ---
  helmTitle() {
    const hd = this.hd, TPS = CONFIG.TICKS_PER_SECOND;
    if (hd.dawned) return tr('🌅 L\'aube s\'est levée sur le Gouffre !', '🌅 Dawn has broken over the Deep!');
    return tr(`🏰 Gouffre de Helm · aube dans ${clock((hd.dawn - this.tick) / TPS)}`, `🏰 Helm's Deep · dawn in ${clock((hd.dawn - this.tick) / TPS)}`);
  },
  helmObjectives() {
    const hd = this.hd, H = HELM, rohan = hd.role.rohan, d = hd.diff;
    const elves = H.ELVES_DIKE[d], kills = H.DWARVES_KILLS[d];
    const tower5 = hd.hornTower;
    return [
      { text: tr('Tenir Fort-le-Cor jusqu\'à l\'aube', 'Hold the Hornburg until dawn'), done: this.owner[hd.place.hornburg] === rohan },
      { text: tr(`Tenir la Digue de Helm ${clock(elves)} (${clock(Math.min(hd.dikeHeld, elves))}) → 🏹 les elfes de la Lórien`,
        `Hold Helm's Dike for ${clock(elves)} (${clock(Math.min(hd.dikeHeld, elves))}) → 🏹 the elves of Lórien`), done: !!hd.elves },
      { text: tr(`Le concours de Gimli et Legolas : abattre ${fmt(kills)} orques (${fmt(Math.min(hd.kills, kills))}) → ⚒️ les nains d'Aglarond`,
        `Gimli and Legolas's contest: slay ${fmt(kills)} orcs (${fmt(Math.min(hd.kills, kills))}) → ⚒️ the dwarves of Aglarond`), done: !!hd.dwarves },
      { text: tr('Garder les Cavernes Scintillantes, où s\'abritent les femmes et les enfants', 'Keep the Glittering Caves, where the women and children shelter'), done: this.owner[hd.place.caves] === rohan },
      { text: tr('Bâtir une Grande tour du Cor (une tour de garde de niveau 5) → 📯 le Cor sonne une fois de plus', 'Build a Great horn tower (a level 5 guard tower) → 📯 the Horn sounds once more'), done: !!tower5 },
    ];
  },
});

// --- 🌧️ La nuit, l'orage, puis l'aube (dessinés par-dessus la carte) ---
Object.assign(Render, {
  drawHelmSky(ox, oy) {
    const G = Game, hd = G.hd, ctx = this.ctx, s = this.cam.scale, now = performance.now();
    const TPS = CONFIG.TICKS_PER_SECOND, frac = Math.min(1, G.tick / hd.dawn);
    // La nuit : de plus en plus noire, puis elle pâlit dans les dernières minutes ; à l'aube, une lumière dorée
    const sinceDawn = (G.tick - hd.dawn) / TPS;
    let dark = frac < 0.85 ? 0.32 + 0.12 * frac / 0.85 : 0.44 * (1 - (frac - 0.85) / 0.15);
    if (sinceDawn > 0) dark = 0;
    if (dark > 0) { ctx.fillStyle = `rgba(14,18,40,${dark})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    if (sinceDawn > 0 && sinceDawn < 40) {
      ctx.fillStyle = `rgba(255,190,90,${0.22 * (1 - sinceDawn / 40)})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    // L'orage : la pluie qui tombe en biais, et parfois un éclair
    if (sinceDawn < 5) {
      const n = Math.round(this.vw * this.vh / 9000);
      ctx.strokeStyle = 'rgba(190,205,230,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const seed = k * 9301 + 49297, x0 = (seed * 233) % this.vw, sp = 600 + (seed % 400);
        const y = ((now * sp / 1000) + (seed * 77) % this.vh) % (this.vh + 40) - 20, x = (x0 + y * 0.25) % this.vw;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 14);
      }
      ctx.stroke();
      const flash = Math.floor(now / 9000), t = now % 9000;
      if ((flash * 7919) % 3 === 0 && t < 160) { ctx.fillStyle = `rgba(230,235,255,${0.25 * (1 - t / 160)})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    }
    // 📯 Le Cor de Helm vient de sonner : des ondes dorées partent de Fort-le-Cor
    if (this.hornBlown && now - this.hornBlown < 2500 && hd.place.hornburg >= 0) {
      const t = (now - this.hornBlown) / 2500, a = hd.place.hornburg, h = G.sizeOf(B_CASTLE) / 2;
      const x = ox + (a % G.W + h) * s, y = oy + (((a / G.W) | 0) + h) * s;
      for (let k = 0; k < 3; k++) {
        const u = (t + k * 0.22) % 1;
        ctx.beginPath(); ctx.arc(x, y, u * 60 * s, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,214,110,${0.7 * (1 - u)})`; ctx.stroke();
      }
    }
    // 🌳 À l'aube, la forêt des Huorns barre la sortie de la Combe : de grands arbres sombres
    if (sinceDawn > 0) {
      const grow = Math.min(1, sinceDawn / 8), M = HELM_MAP;
      for (let k = 0; k < 60; k++) {
        const tx = 128 + (k * 37) % 44, ty = 70 + ((k * 53) % 120);
        const { cy, hw } = helmValley(tx);
        if (Math.abs(ty - cy) > hw * 0.95) continue;
        const x = ox + tx * s, y = oy + ty * s, r = (2.2 + (k % 3) * 0.6) * s * grow;
        if (r < 1) continue;
        ctx.fillStyle = 'rgba(28,52,30,0.85)';
        ctx.beginPath(); ctx.arc(x, y - r * 0.6, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(52,36,20,0.9)';
        ctx.fillRect(x - r * 0.15, y - r * 0.2, r * 0.3, r * 0.8);
      }
      void M;
    }
  },
});
