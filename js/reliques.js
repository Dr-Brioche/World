// 📿 LES RELIQUES SAINTES (parties classiques seulement : pas dans les scénarios)
// De temps en temps (voir CONFIG.RELIC), une relique apparaît sur les terres d'un royaume, plutôt loin des plus grands.
// Le royaume où elle est, et tous ses voisins, peuvent envoyer une armée la chercher (« assaut de relique », une petite
// croix à côté de sa bannière), à condition d'avoir une église de niveau 3 pour la garder. Arrivée à la relique, l'armée
// s'en empare en TAKE_TIME secondes, puis la rapporte à son église de niveau 3 la plus proche, plus lentement.
// En chemin, tout royaume voisin (pas un allié) peut l'intercepter : on clique sur sa bannière. Le combat se joue au
// contact : le vainqueur garde ses survivants, et prend la relique s'il a une église de niveau 3 (sinon elle tombe là).
// Une relique déposée reste liée à son église : son royaume convertit plus vite par la Croyance (+FAITH_BONUS par
// relique), et l'église rapporte plus d'or (+CHURCH_GOLD par relique). Prise par un autre, l'église lui donne ces
// bonus ; détruite (un raid viking, une démolition…), elle emporte sa relique avec elle.
// Ces armées ne prennent aucune terre en chemin : elles marchent sur leurs terres, celles de leurs alliés, celles du
// royaume où est la relique et les terres libres.
//
// État de la partie :
//  - this.relics : les reliques posées sur la carte : { id, tile, region (le royaume où elle est apparue), run (l'armée
//    qui s'en empare, -1 sinon) } ;
//  - this.relicRuns : les armées de relique : { id, pid, troops, region, phase, route, relic, aim, chase, church… }
//    phase = 'go' (elle marche vers la relique aim), 'take' (elle s'en empare), 'carry' (elle la rapporte à son
//    église church), 'chase' (elle poursuit l'armée chase pour l'intercepter) ;
//  - this.relicChurch : église (case d'ancrage) → nombre de reliques qu'elle garde.

Object.assign(GameRules, {
  // Les reliques n'existent que dans les parties classiques (pas Charlemagne, la guerre de Cent Ans ni les Factions)
  relicMode() { return !this.cm && !this.hy && !this.factions; },
  relicReset() {
    this.relics = []; this.relicRuns = []; this.relicChurch = new Map();
    this.relicNext = -1; this.nextRelicId = 1;
  },
  relicMinutes([a, b]) { return Math.round((a + this.rand() * (b - a)) * 60 * CONFIG.TICKS_PER_SECOND); },

  // --- Les bonus ---
  // Reliques gardées par les églises de pid
  relicCount(pid) {
    let n = 0;
    for (const [c, k] of this.relicChurch) if (this.owner[c] === pid) n += k;
    return n;
  },
  // Vitesse de conversion par la Croyance (voir stepFaith) : +FAITH_BONUS par relique
  relicFaithFactor(pid) { return this.relicChurch.size ? 1 + CONFIG.RELIC.FAITH_BONUS * this.relicCount(pid) : 1; },
  // Or d'une église (voir buildingOutput) : +CHURCH_GOLD par relique qu'elle garde
  relicGoldFactor(a) { return 1 + CONFIG.RELIC.CHURCH_GOLD * (this.relicChurch.get(a) || 0); },
  // Une église est détruite (voir removeBuilding) : ses reliques disparaissent avec elle
  relicChurchGone(a) {
    const n = this.relicChurch.get(a);
    if (!n) return;
    this.relicChurch.delete(a);
    const p = this.players[this.owner[a]];
    if (p && p.isHuman) UI.log(tr(`📿 Ton église a été détruite : ${n > 1 ? `ses ${n} reliques sont perdues` : 'sa relique est perdue'} !`,
      `📿 Your church has been destroyed: ${n > 1 ? `its ${n} relics are lost` : 'its relic is lost'}!`), 'warn');
  },

  // --- Où et quand une relique apparaît ---
  stepRelics() {
    if (!this.relicMode() || this.phase !== 'playing') return;
    const TPS = CONFIG.TICKS_PER_SECOND, R = CONFIG.RELIC;
    if (this.relicNext < 0) this.relicNext = this.tick + this.relicMinutes(R.FIRST);
    if (this.tick >= this.relicNext) {
      this.relicNext = this.tick + this.relicMinutes(R.NEXT);
      this.spawnRelic();
    }
    for (const r of this.relicRuns.slice()) this.stepRelicRun(r, this.tick % TPS === 0);
  },
  // Une case au hasard sur les terres d'un royaume, d'autant plus probable qu'elle est loin des plus grands royaumes
  // (pour équilibrer la partie) ; pas sur un bâtiment
  spawnRelic() {
    const W = this.W, alive = this.players.filter(p => p.alive && !p.raiders && p.tiles > 0);
    if (!alive.length) return;
    const big = alive.slice().sort((a, b) => b.tiles - a.tiles || a.id - b.id).slice(0, CONFIG.RELIC.BIG);
    const centers = big.map(p => ({ x: p.sumX / p.tiles, y: p.sumY / p.tiles, id: p.id }));
    const diag = Math.hypot(W, this.H);
    let total = 0;
    const cands = [];
    for (let k = 0; k < 400 && cands.length < 120; k++) {
      const i = Math.floor(this.rand() * this.N), o = this.owner[i];
      if (o < 0 || !this.claimable(i) || this.building[i] || this.players[o].raiders) continue;
      const x = i % W, y = (i / W) | 0;
      const d = Math.min(...centers.map(c => Math.hypot(c.x - x, c.y - y))) / diag;
      const w = (0.05 + d) ** 2 * (centers.some(c => c.id === o) ? 0.3 : 1);
      total += w;
      cands.push([i, w]);
    }
    if (!cands.length) return;
    let pick = this.rand() * total, tile = cands[cands.length - 1][0];
    for (const [i, w] of cands) { pick -= w; if (pick <= 0) { tile = i; break; } }
    const relic = { id: this.nextRelicId++, tile, region: this.owner[tile], run: -1 };
    this.relics.push(relic);
    const h = this.human, o = this.players[relic.region];
    if (h && h.alive) {
      Music.sound('crusade');
      const near = this.relicEligible(h.id, tile, relic.region);
      UI.log(tr(`📿 Une relique sainte est apparue ${o.isHuman ? 'sur tes terres' : `chez ${o.name}`} !`, `📿 A holy relic has appeared ${o.isHuman ? 'on your land' : `in ${o.name}`}!`) +
        (!near ? '' : this.relicRoom(h.id) > 0
          ? tr(' Clique dessus pour envoyer une armée la chercher.', ' Click it to send an army to fetch it.')
          : tr(` Il te faut une église de niveau ${CONFIG.RELIC.CHURCH_LEVEL} libre pour aller la chercher (chacune ne garde qu'une relique).`, ` You need a free level ${CONFIG.RELIC.CHURCH_LEVEL} church to fetch it (each keeps only one relic).`)), 'good', o);
    }
  },

  // --- Qui peut aller la chercher ---
  // Une église de niveau 3 ne garde qu'UNE relique : il en faut une autre, libre, pour la suivante.
  // Les églises libres de pid : assez grandes, sans relique, et pas déjà promises à une autre de ses armées qui en
  // rapporte une (sauf except, l'armée qui pose la question)
  relicChurches(pid, except = null) {
    const L = CONFIG.RELIC.CHURCH_LEVEL;
    const promised = new Set(this.relicRuns.filter(r => r !== except && r.pid === pid && r.phase === 'carry').map(r => r.church));
    return this.buildingTiles.filter(a => this.building[a] === B_CHURCH && this.owner[a] === pid && this.level[a] >= L
      && !this.relicChurch.get(a) && !promised.has(a));
  },
  // Combien de reliques pid peut-il encore aller chercher ? Ses églises libres, moins ses armées déjà en route vers
  // une relique (ou en train de s'en emparer) ; pour l'armée r, seules comptent celles parties avant elle
  relicRoom(pid, r = null) {
    const going = this.relicRuns.filter(x => x !== r && x.pid === pid && (x.phase === 'go' || x.phase === 'take') && (!r || x.id < r.id)).length;
    return this.relicChurches(pid, r).length - going;
  },
  // pid peut-il aller vers cette case ? Elle est sur ses terres ou chez un voisin (ou la relique est apparue chez lui
  // ou chez un voisin)
  relicEligible(pid, tile, region) {
    const nb = this.neighborStats(pid), o = this.owner[tile];
    return o === pid || region === pid || (o >= 0 && nb.has(o)) || (region >= 0 && nb.has(region));
  },
  relicTileCenter(t) { return { x: t % this.W + 0.5, y: ((t / this.W) | 0) + 0.5 }; },
  relicPos(r) {
    if (r.phase === 'take') return this.relicTileCenter(r.relic ? r.relic.tile : r.at);
    return this.walkPosition(r.route);
  },
  relicPosTile(r) { const p = this.relicPos(r); return Math.floor(p.y) * this.W + Math.floor(p.x); },
  // La relique (sur la carte) près de la case i (à moins de 2 cases), ou null
  relicNear(i) {
    const W = this.W, x = i % W, y = (i / W) | 0;
    return this.relics.find(r => Math.abs(r.tile % W - x) <= 2 && Math.abs(((r.tile / W) | 0) - y) <= 2) || null;
  },
  // Le centre d'un bâtiment
  relicMid(c) { const h = this.sizeOf(this.building[c]) / 2; return { x: c % this.W + h, y: ((c / this.W) | 0) + h }; },

  // --- Chemins ---
  // Chemin le plus rapide de la case from jusqu'à une case de goals (un Set), à travers les terres des royaumes de
  // owners (un Set), les terres libres et les fleuves (lents). Renvoie la liste des cases, ou null.
  relicPath(pid, from, goals, owners) {
    const N = this.N, W = this.W, own = this.owner;
    if (from < 0 || from >= N) return null;
    if (!this.relicBuf || this.relicBuf.seen.length !== N)
      this.relicBuf = { dist: new Float64Array(N), prev: new Int32Array(N), seen: new Int32Array(N), stamp: 0 };
    const B = this.relicBuf, stamp = ++B.stamp, heap = new MinHeap(), cost = this.marchCost(pid);
    const passable = i => this.isLand(i) && (own[i] < 0 || owners.has(own[i]));
    B.seen[from] = stamp; B.dist[from] = 0; B.prev[from] = -1;
    heap.push(0, from);
    while (heap.size) {
      const [d, i] = heap.pop();
      if (B.seen[i] === -stamp) continue;
      B.seen[i] = -stamp;
      if (goals.has(i)) {
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
    }
    return null;
  },
  // Les royaumes sur les terres desquels l'armée r peut marcher : le sien, ses alliés, celui de la relique, et celui
  // où elle se trouve
  relicOwners(r, extra = -1) {
    const set = new Set([r.pid, r.region]);
    for (const p of this.allies(r.pid)) set.add(p.id);
    if (extra >= 0) set.add(extra);
    return set;
  },
  // Trajet de l'armée r du point from jusqu'à une case de goals ; (slow : avec la relique, plus lentement)
  relicRoute(r, from, goals, to, slow) {
    const ft = Math.floor(from.y) * this.W + Math.floor(from.x);
    const path = this.relicPath(r.pid, ft, goals, this.relicOwners(r, this.owner[ft]));
    if (!path) return null;
    const bonus = CONFIG.RELIC.SPEED / (slow ? CONFIG.RELIC.CARRY_SLOW : 1);
    return this.walkRoute(r.pid, from, to, r.troops, bonus, false, path);
  },
  // La place forte de pid la plus proche du point (pour partir ou rentrer)
  relicHome(pid, at) {
    const list = this.strongholds(pid, false);
    let best = -1, bestD = Infinity;
    for (const c of list) { const m = this.relicMid(c), d = (m.x - at.x) ** 2 + (m.y - at.y) ** 2; if (d < bestD) { bestD = d; best = c; } }
    return best;
  },

  // --- Les ordres ---
  // pid envoie troops soldats chercher la relique id (ordre « relic »). Si une armée s'en empare déjà, ou l'emporte,
  // c'est une interception de cette armée.
  launchRelicRun(pid, id, troops) {
    const p = this.players[pid], relic = this.relics.find(r => r.id === id), R = CONFIG.RELIC;
    if (!this.relicMode() || !relic) return tr('Cette relique n\'est plus là.', 'This relic is no longer there.');
    if (relic.run >= 0) return this.launchRelicChase(pid, relic.run, troops);
    if (!this.relicEligible(pid, relic.tile, relic.region)) return tr('Cette relique est trop loin : elle doit être sur tes terres ou chez un voisin.', 'This relic is too far: it must be on your land or in a neighbour\'s.');
    // (une armée à nous y va déjà : ces soldats la rejoignent, sans demander une autre église)
    if (!this.relicRuns.some(r => r.pid === pid && r.phase === 'go' && r.aim === id) && this.relicRoom(pid) <= 0) {
      const L = CONFIG.RELIC.CHURCH_LEVEL, any = this.buildingTiles.some(a => this.building[a] === B_CHURCH && this.owner[a] === pid && this.level[a] >= L);
      return any
        ? tr(`Chaque église de niveau ${R.CHURCH_LEVEL} ne garde qu'une relique : il t'en faut une autre, libre, pour celle-ci.`, `Each level ${R.CHURCH_LEVEL} church keeps only one relic: you need another free one for this.`)
        : tr(`Il te faut une église de niveau ${R.CHURCH_LEVEL} pour garder une relique.`, `You need a level ${R.CHURCH_LEVEL} church to keep a relic.`);
    }
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return tr('Pas assez de soldats !', 'Not enough soldiers!');
    // (une armée à nous y va déjà : ces soldats la rejoignent)
    const mine = this.relicRuns.find(r => r.pid === pid && r.phase === 'go' && r.aim === id);
    if (mine) { this.relicReinforce(mine, troops); return null; }
    const goal = this.relicTileCenter(relic.tile);
    const start = this.relicHome(pid, goal);
    if (start < 0) return tr('Tu n\'as aucune ville d\'où partir.', 'You have no city to set out from.');
    const r = { id: this.nextAttackId++, pid, troops, region: relic.region, phase: 'go', aim: id, relic: null };
    r.route = this.relicRoute(r, this.relicMid(start), new Set([relic.tile]), goal, false);
    if (!r.route) return tr('Impossible d\'atteindre cette relique à pied.', 'This relic cannot be reached on foot.');
    p.troops -= troops;
    this.relicRuns.push(r);
    const o = this.players[this.owner[relic.tile]];
    if (o && o.isHuman && o.id !== pid) {
      Music.sound('enemyAssault');
      UI.log(tr(`⚠️ ${p.name} envoie ${fmt(troops)} soldats chercher la relique sur tes terres ! Clique sur leur bannière pour les intercepter.`,
        `⚠️ ${p.name} sends ${fmt(troops)} soldiers to fetch the relic on your land! Click their banner to intercept them.`), 'warn', p);
    }
    return null;
  },
  // pid envoie troops soldats intercepter l'armée de relique id (ordre « relicChase »)
  launchRelicChase(pid, id, troops) {
    const p = this.players[pid], t = this.relicRuns.find(r => r.id === id);
    if (!t) return tr('Cette armée n\'est plus là.', 'This army is no longer there.');
    if (t.pid === pid) return tr('C\'est ta propre armée !', 'That is your own army!');
    if (this.areAllied(pid, t.pid)) return tr(`${this.players[t.pid].name} est ton allié.`, `${this.players[t.pid].name} is your ally.`);
    if (!this.relicEligible(pid, this.relicPosTile(t), t.region)) return tr('Cette armée est trop loin : elle doit être sur tes terres ou chez un voisin.', 'This army is too far: it must be on your land or in a neighbour\'s.');
    troops = Math.floor(Math.min(troops, p.troops));
    if (troops < 1) return tr('Pas assez de soldats !', 'Not enough soldiers!');
    const mine = this.relicRuns.find(r => r.pid === pid && r.phase === 'chase' && r.chase === id);
    if (mine) { this.relicReinforce(mine, troops); return null; }
    const at = this.relicPos(t), start = this.relicHome(pid, at);
    if (start < 0) return tr('Tu n\'as aucune ville d\'où partir.', 'You have no city to set out from.');
    const r = { id: this.nextAttackId++, pid, troops, region: t.region, phase: 'chase', chase: id, relic: null };
    r.route = this.walkRoute(pid, this.relicMid(start), at, troops, CONFIG.RELIC.SPEED, true);
    r.reroute = 0;
    p.troops -= troops;
    this.relicRuns.push(r);
    const v = this.players[t.pid];
    if (v.isHuman) {
      Music.sound('enemyAssault');
      UI.log(tr(`⚠️ ${p.name} envoie ${fmt(troops)} soldats intercepter ton armée de relique !`, `⚠️ ${p.name} sends ${fmt(troops)} soldiers to intercept your relic army!`), 'warn', p);
    }
    return null;
  },

  // Des renforts pour l'armée de relique r : sur nos terres, ils la rejoignent tout de suite ; plus loin, ils marchent
  // depuis notre ville la plus proche, comme les renforts d'un assaut (MARCH_SPEED cases par seconde, au moins
  // REINFORCE_MIN_TIME secondes : voir reinforceTicks), et ne comptent qu'à leur arrivée
  relicReinforce(r, troops) {
    const C = CONFIG, at = this.relicPos(r), t = Math.floor(at.y) * this.W + Math.floor(at.x);
    this.players[r.pid].troops -= troops;
    if (this.owner[t] === r.pid) { r.troops += troops; return; }
    const c = this.relicHome(r.pid, at), from = c >= 0 ? this.relicMid(c) : at;
    const secs = Math.max(C.REINFORCE_MIN_TIME, Math.hypot(at.x - from.x, at.y - from.y) / C.MARCH_SPEED);
    (r.pending = r.pending || []).push({ troops, tick: this.tick + Math.round(secs * C.TICKS_PER_SECOND) });
  },
  // Les renforts encore en route de l'armée r (0 s'il n'y en a pas)
  relicPending(r) { return r.pending ? r.pending.reduce((n, q) => n + q.troops, 0) : 0; },
  // L'armée r a fini : ses renforts encore en route font demi-tour et rejoignent le royaume
  relicPendingBack(r) {
    const n = this.relicPending(r);
    r.pending = [];
    if (n && this.players[r.pid].alive) this.players[r.pid].troops += n;
  },

  // --- Chaque tour : une armée de relique ---
  // (second : une fois par seconde, on vérifie ce qui a changé et on corrige les trajets)
  stepRelicRun(r, second) {
    const p = this.players[r.pid], TPS = CONFIG.TICKS_PER_SECOND;
    // (les renforts arrivés rejoignent l'armée)
    if (r.pending && r.pending.length) {
      for (const q of r.pending) if (q.tick <= this.tick) { r.troops += q.troops; q.done = true; }
      r.pending = r.pending.filter(q => !q.done);
    }
    if (!p.alive || r.troops < 1) return this.relicRunEnd(r);
    if (r.phase === 'go') {
      const relic = this.relics.find(x => x.id === r.aim);
      if (second) {
        // (la relique est déjà emportée par une autre armée : on la poursuit ; plus de relique du tout : on rentre)
        if (!relic) {
          const carrier = this.relicRuns.find(x => x.relic && x.relic.id === r.aim);
          if (carrier && carrier.pid !== r.pid && !this.areAllied(r.pid, carrier.pid)) { r.phase = 'chase'; r.chase = carrier.id; r.reroute = 0; return; }
          return this.relicGoHome(r, tr('📿 La relique n\'est plus là : ton armée rentre.', '📿 The relic is no longer there: your army heads home.'));
        }
        if (this.relicRoom(r.pid, r) <= 0) return this.relicGoHome(r, tr('📿 Tu n\'as plus d\'église de niveau 3 libre pour garder la relique : ton armée rentre.', '📿 You no longer have a free level 3 church to keep the relic: your army heads home.'));
        // (une autre armée s'en empare déjà : on la poursuit)
        if (relic.run >= 0 && relic.run !== r.id) { r.phase = 'chase'; r.chase = relic.run; r.reroute = 0; return; }
      }
      if (relic && this.tick >= r.route.arrive) {
        if (relic.run >= 0 && relic.run !== r.id) { r.phase = 'chase'; r.chase = relic.run; r.reroute = 0; return; }
        r.phase = 'take';
        r.relic = relic;
        r.takeEnd = this.tick + CONFIG.RELIC.TAKE_TIME * TPS;
        relic.run = r.id;
        if (p.isHuman) UI.log(tr(`📿 Ton armée s'empare de la relique : encore ${CONFIG.RELIC.TAKE_TIME} s.`, `📿 Your army is taking the relic: ${CONFIG.RELIC.TAKE_TIME} s to go.`), 'good');
        else this.relicWarn(r, tr(`📿 ${p.name} s'empare de la relique (${CONFIG.RELIC.TAKE_TIME} s) ! Clique sur sa bannière pour l'en empêcher.`, `📿 ${p.name} is taking the relic (${CONFIG.RELIC.TAKE_TIME} s)! Click its banner to stop it.`));
      }
      return;
    }
    if (r.phase === 'take') {
      if (second && this.relicRoom(r.pid, r) <= 0) {
        r.relic.run = -1; r.relic = null;
        return this.relicGoHome(r, tr('📿 Tu n\'as plus d\'église de niveau 3 pour garder la relique : ton armée rentre.', '📿 You no longer have a level 3 church to keep the relic: your army heads home.'));
      }
      if (this.tick < r.takeEnd) return;
      // La relique est prise : elle quitte la carte et part avec l'armée
      const relic = r.relic;
      this.relics = this.relics.filter(x => x !== relic);
      relic.run = r.id;
      if (!this.relicCarry(r, this.relicTileCenter(relic.tile))) return;
      if (p.isHuman) UI.log(tr('📿 Ton armée a la relique ! Elle la rapporte à ton église (plus lentement) : protège-la en chemin.', '📿 Your army has the relic! It carries it back to your church (more slowly): protect it on the way.'), 'good');
      else this.relicWarn(r, tr(`📿 ${p.name} emporte la relique ! Clique sur sa bannière pour l'intercepter.`, `📿 ${p.name} is carrying the relic away! Click its banner to intercept it.`));
      return;
    }
    if (r.phase === 'carry') {
      if (second) {
        // (son église a été prise, détruite… : vers une autre ; plus aucune : elle pose la relique là et rentre)
        if (!(this.building[r.church] === B_CHURCH && this.owner[r.church] === r.pid && this.level[r.church] >= CONFIG.RELIC.CHURCH_LEVEL && !this.relicChurch.get(r.church))) {
          if (!this.relicCarry(r, this.relicPos(r))) return;
        }
      }
      if (this.tick >= r.route.arrive) this.relicStore(r);
      return;
    }
    if (r.phase === 'chase') {
      const t = this.relicRuns.find(x => x.id === r.chase);
      if (!t || this.areAllied(r.pid, t.pid)) return this.relicGoHome(r, '');
      const C = CONFIG, me = this.relicPos(r), at = this.relicPos(t), d = Math.hypot(me.x - at.x, me.y - at.y);
      if (d <= C.DEFEND_CONTACT) return this.relicBattle(r, t);
      if (second) {
        // (près d'elle : droit dessus ; plus loin : par les terres, trajet corrigé toutes les 3 secondes)
        if (d <= C.DEFEND_DIRECT) r.route = this.walkRoute(r.pid, me, at, r.troops, C.RELIC.SPEED, true);
        else if (this.tick >= r.reroute) {
          r.reroute = this.tick + 3 * TPS;
          const tt = Math.floor(at.y) * this.W + Math.floor(at.x);
          r.route = this.relicRoute(r, me, new Set([tt]), at, false) || this.walkRoute(r.pid, me, at, r.troops, C.RELIC.SPEED, true);
        }
      }
    }
  },
  // Message aux humains qui pourraient intercepter l'armée r
  relicWarn(r, msg) {
    const h = this.human;
    if (!h || !h.alive || h.id === r.pid || this.areAllied(h.id, r.pid) || !this.relicEligible(h.id, this.relicPosTile(r), r.region)) return;
    Music.sound('enemyAssault');
    UI.log(msg, 'warn', this.players[r.pid]);
  },
  // L'armée r part (ou repart) avec la relique vers son église de niveau 3 la plus proche ; aucune : elle pose la
  // relique là où elle est, et rentre. Renvoie false si elle ne porte plus la relique.
  relicCarry(r, from) {
    const churches = this.relicChurches(r.pid, r), slow = CONFIG.RELIC.SPEED / CONFIG.RELIC.CARRY_SLOW;
    if (!churches.length) {
      this.relicDrop(r, from);
      this.relicGoHome(r, tr('📿 Tu n\'as plus d\'église de niveau 3 libre pour garder la relique : ton armée la laisse là et rentre.', '📿 You no longer have a free level 3 church to keep the relic: your army leaves it there and heads home.'));
      return false;
    }
    // (le chemin à pied jusqu'à la première église atteinte ; puis jusqu'à son centre)
    const goals = new Map();
    for (const c of churches) for (const j of this.footprint(c, B_CHURCH)) goals.set(j, c);
    const ft = Math.floor(from.y) * this.W + Math.floor(from.x);
    const path = this.relicPath(r.pid, ft, new Set(goals.keys()), this.relicOwners(r, this.owner[ft]));
    let church = path ? goals.get(path[path.length - 1]) : -1;
    // (pas de chemin à pied jusqu'à une église : tout droit vers la plus proche)
    if (church < 0) {
      let bestD = Infinity;
      for (const c of churches) { const m = this.relicMid(c), d = (m.x - from.x) ** 2 + (m.y - from.y) ** 2; if (d < bestD) { bestD = d; church = c; } }
    }
    r.phase = 'carry';
    r.church = church;
    r.route = this.walkRoute(r.pid, from, this.relicMid(church), r.troops, slow, !path, path);
    return true;
  },
  // L'armée r pose sa relique (ou celle dont elle s'emparait) au point at : elle redevient une relique sur la carte
  relicDrop(r, at) {
    const relic = r.relic;
    r.relic = null;
    if (!relic) return;
    let t = Math.floor(at.y) * this.W + Math.floor(at.x);
    if (!this.isLand(t) || this.building[t]) {
      // (sur l'eau ou un bâtiment : la case de terre libre de bâtiment la plus proche)
      const W = this.W, x0 = t % W, y0 = (t / W) | 0;
      let best = -1, bestD = Infinity;
      for (let y = y0 - 6; y <= y0 + 6; y++) for (let x = x0 - 6; x <= x0 + 6; x++) {
        if (x < 0 || y < 0 || x >= W || y >= this.H) continue;
        const j = y * W + x, d = (x - x0) ** 2 + (y - y0) ** 2;
        if (d < bestD && this.claimable(j) && !this.building[j]) { bestD = d; best = j; }
      }
      if (best < 0) return; // (aucune terre autour : la relique est perdue)
      t = best;
    }
    relic.tile = t;
    relic.run = -1;
    if (this.owner[t] >= 0) relic.region = this.owner[t];
    if (!this.relics.includes(relic)) this.relics.push(relic);
  },
  // L'armée r arrive à son église avec la relique : elle y est gardée, et les soldats rejoignent le royaume
  relicStore(r) {
    const p = this.players[r.pid], c = r.church;
    // (cette église garde déjà une relique, arrivée entre-temps : vers une autre église libre)
    if (this.relicChurch.get(c)) { this.relicCarry(r, this.relicPos(r)); return; }
    this.relicChurch.set(c, (this.relicChurch.get(c) || 0) + 1);
    r.relic = null;
    this.relicRunEnd(r, true);
    const n = this.relicCount(r.pid), R = CONFIG.RELIC;
    if (p.isHuman) {
      Music.sound('crusade');
      UI.log(tr(`📿 La relique est dans ton église ! Tes terres se convertissent ${Math.round(R.FAITH_BONUS * 100)} % plus vite par la Croyance (${n} relique${n > 1 ? 's' : ''} : +${Math.round(R.FAITH_BONUS * 100 * n)} %), et cette église rapporte ${Math.round(R.CHURCH_GOLD * 100)} % d'or en plus.`,
        `📿 The relic is in your church! Your Faith converts land ${Math.round(R.FAITH_BONUS * 100)}% faster (${n} relic${n > 1 ? 's' : ''}: +${Math.round(R.FAITH_BONUS * 100 * n)}%), and this church brings ${Math.round(R.CHURCH_GOLD * 100)}% more gold.`), 'good');
    } else if (this.human && this.human.alive) {
      UI.log(tr(`📿 ${p.name} a déposé une relique dans une de ses églises.`, `📿 ${p.name} has placed a relic in one of their churches.`), '', p);
    }
  },
  // L'armée r a fini (rentrée, détruite, ou la relique déposée) : elle disparaît ; ses soldats rejoignent le royaume
  // si home (et sa relique tombe là où elle est, si elle en portait une)
  relicRunEnd(r, home = false) {
    if (r.relic) {
      if (r.phase === 'take') { r.relic.run = -1; r.relic = null; } else this.relicDrop(r, this.relicPos(r));
    }
    if (home && this.players[r.pid].alive) this.players[r.pid].troops += r.troops;
    this.relicPendingBack(r);
    this.relicRuns = this.relicRuns.filter(x => x !== r);
    // (ceux qui la poursuivaient rentrent)
    for (const x of this.relicRuns) if (x.phase === 'chase' && x.chase === r.id) this.relicGoHome(x, '');
  },
  // L'armée r rentre à pied à sa place forte la plus proche (comme des défenseurs : voir stepReturning)
  relicGoHome(r, msg) {
    if (msg && this.players[r.pid].isHuman) UI.log(msg, 'warn');
    const at = this.relicPos(r), c = this.relicHome(r.pid, at);
    if (r.relic && r.phase !== 'take') this.relicDrop(r, at);
    else if (r.relic) { r.relic.run = -1; r.relic = null; }
    this.relicPendingBack(r);
    this.relicRuns = this.relicRuns.filter(x => x !== r);
    for (const x of this.relicRuns) if (x.phase === 'chase' && x.chase === r.id) this.relicGoHome(x, '');
    if (c < 0) return;
    const to = this.relicMid(c);
    this.returning.push(Object.assign(this.walkRoute(r.pid, { x: at.x, y: at.y }, to, r.troops), { pid: r.pid, source: -1, to }));
  },
  // L'armée c rattrape l'armée t : combat. Le plus fort (soldats x leur force) l'emporte et garde des survivants ;
  // s'il prend une relique, il l'emporte vers son église de niveau 3 (sinon elle tombe là)
  relicBattle(c, t) {
    const cp = this.players[c.pid], tp = this.players[t.pid];
    const a = c.troops * this.troopPower(c.pid), d = t.troops * this.troopPower(t.pid);
    const at = this.relicPos(t), relic = t.relic;
    if (a > d) {
      c.troops = Math.max(1, Math.round(c.troops * (1 - d / a)));
      // (l'armée vaincue disparaît ; sa relique passe au vainqueur ; ceux qui la poursuivaient aussi poursuivent
      //  désormais le vainqueur, sauf ses alliés)
      if (t.phase === 'take') relic.run = -1;
      t.relic = null;
      t.troops = 0;
      c.chase = -1;
      const others = this.relicRuns.filter(x => x !== c && x.phase === 'chase' && x.chase === t.id);
      for (const x of others) x.chase = c.id;
      this.relicRunEnd(t);
      for (const x of others) if (x.pid === c.pid || this.areAllied(x.pid, c.pid)) this.relicGoHome(x, '');
      if (relic) {
        this.relics = this.relics.filter(x => x !== relic);
        c.relic = relic;
        relic.run = c.id;
        c.region = relic.region;
        if (!this.relicChurches(c.pid, c).length) {
          this.relicDrop(c, at);
          this.relicGoHome(c, '');
        } else this.relicCarry(c, at);
      } else this.relicGoHome(c, '');
      if (cp.isHuman) UI.log(tr(`⚔️ Tes soldats ont battu l'armée ${this.deName(tp.name)}${relic ? (c.relic ? ' et emportent la relique !' : ' : la relique tombe là (il te faut une église de niveau 3 pour la garder).') : ' !'}`,
        `⚔️ Your soldiers beat ${possessive(tp.name)} army${relic ? (c.relic ? ' and carry off the relic!' : ': the relic falls there (you need a level 3 church to keep it).') : '!'}`), 'good', tp);
      if (tp.isHuman) UI.log(tr(`⚔️ Ton armée de relique a été battue par ${cp.name}${relic ? (c.relic ? ', qui emporte la relique ! Intercepte-le à ton tour.' : ' : la relique tombe là.') : '.'}`,
        `⚔️ Your relic army was beaten by ${cp.name}${relic ? (c.relic ? ', who carries off the relic! Intercept them in turn.' : ': the relic falls there.') : '.'}`), 'warn', cp);
    } else {
      t.troops = Math.max(0, Math.round(t.troops * (1 - a / Math.max(1, d))));
      c.troops = 0;
      this.relicPendingBack(c);
      this.relicRuns = this.relicRuns.filter(x => x !== c);
      if (cp.isHuman) UI.log(tr(`⚔️ Tes soldats n'ont pas pu arrêter l'armée ${this.deName(tp.name)}.`, `⚔️ Your soldiers could not stop ${possessive(tp.name)} army.`), 'warn', tp);
      if (tp.isHuman) UI.log(tr(`⚔️ Ton armée de relique a repoussé ${cp.name} !`, `⚔️ Your relic army drove off ${cp.name}!`), 'good', cp);
      if (t.troops < 1) this.relicRunEnd(t);
    }
  },

  // --- 🤖 Les bots ---
  // (de temps en temps, voir AI.update) : chercher une relique proche, ou intercepter une armée qui en porte une
  relicBot(p) {
    if (!this.relicMode() || (!this.relics.length && !this.relicRuns.length)) return;
    const busy = this.relicRuns.some(r => r.pid === p.id);
    if (busy || p.troops < this.maxTroops(p) * 0.3) return;
    const power = this.troopPower(p.id);
    // Intercepter une armée qui s'empare d'une relique, ou l'emporte, si on est nettement plus fort
    for (const t of this.relicRuns) {
      if ((t.phase !== 'carry' && t.phase !== 'take') || t.pid === p.id || this.areAllied(p.id, t.pid)) continue;
      if (!this.relicEligible(p.id, this.relicPosTile(t), t.region)) continue;
      const need = t.troops * this.troopPower(t.pid) / power * 1.6;
      if (need < p.troops * 0.6) { this.launchRelicChase(p.id, t.id, Math.max(need, p.troops * 0.3)); return; }
    }
    // Aller chercher une relique libre à sa portée ; sans église de niveau 3 pour la garder, on améliore d'abord
    // sa meilleure église
    const near = this.relics.filter(relic => relic.run < 0 && this.relicEligible(p.id, relic.tile, relic.region));
    if (!near.length) return;
    if (this.relicRoom(p.id) <= 0) {
      // (il met de l'or de côté pour cette église pendant 2 minutes : voir AI.tryBuild, relicSaving)
      // (une église pas encore au niveau 3 : ses cathédrales gardent déjà chacune leur relique)
      p.relicSaving = this.tick + 120 * CONFIG.TICKS_PER_SECOND;
      const best = this.buildingTiles.filter(a => this.building[a] === B_CHURCH && this.owner[a] === p.id && this.level[a] < CONFIG.RELIC.CHURCH_LEVEL)
        .sort((a, b) => this.level[b] - this.level[a] || a - b)[0];
      if (best !== undefined) { if (!this.works.has(best)) this.upgradeBuilding(p, best); return; }
      // (pas encore d'église : il en bâtit une près de sa capitale)
      if (p.gold < this.buildCost(p, B_CHURCH) || p.capital < 0) return;
      const W = this.W, cx = p.capital % W, cy = (p.capital / W) | 0;
      for (let k = 0; k < 40; k++) {
        const x = cx + Math.round((this.rand() - 0.5) * 30), y = cy + Math.round((this.rand() - 0.5) * 30);
        if (x < 0 || y < 0 || x >= W || y >= this.H || this.owner[y * W + x] !== p.id) continue;
        if (!this.tryBuild(p, y * W + x, B_CHURCH)) return;
      }
      return;
    }
    for (const relic of near) if (!this.launchRelicRun(p.id, relic.id, Math.max(20, p.troops * 0.3))) return;
  },
});
