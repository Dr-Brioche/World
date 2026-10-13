// 🤖 INTELLIGENCE DES ROYAUMES ADVERSES
// Chaque bot réfléchit toutes les 1 à 3 secondes : construire ? attaquer ? qui ?

const AI = {
  update(p) {
    if (--p.aiTimer > 0) return;
    p.aiTimer = Math.round(CONFIG.TICKS_PER_SECOND * (1 + Math.random() * 2));

    if (Math.random() < 0.4) this.tryBuild(p);
    if (Math.random() < 0.08) this.tryAlliance(p);

    this.reactToThreats(p);

    // Une seule campagne à la fois
    if (Game.attacks.some(a => !a.done && a.attacker === p.id)) return;

    const max = Game.maxTroops(p);
    const nb = Game.neighborStats(p.id);

    // S'il reste des terres libres, on s'étend en priorité
    if (nb.has(-1) && p.troops > max * 0.2 && Math.random() < 0.85) {
      Game.launchAttack(p.id, -1, p.troops * 0.4);
      return;
    }

    if (p.troops < max * p.aggression) return;

    // Sinon on cherche le voisin le plus faible
    let best = null, bestScore = 0;
    for (const [o] of nb) {
      if (o < 0 || Game.areAllied(p.id, o) || Game.recoverTime(p, o) > 0) continue;
      const e = Game.players[o];
      let score = p.troops / (e.troops + 50) + Math.random() * 0.3;
      if (e.isHuman) score += Game.difficulty.hateHuman;
      if (Game.isTraitor(e)) score += 0.5; // un traître affaibli est une proie facile
      if (score > bestScore) { bestScore = score; best = o; }
    }
    const full = p.troops >= max * 0.95;
    if (best !== null && (bestScore > 1 || (full && bestScore > 0.5))) {
      Game.launchAttack(p.id, best, p.troops * 0.5);
    } else if (nb.has(-1)) {
      Game.launchAttack(p.id, -1, p.troops * 0.3);
    } else if (best === null && full && Math.random() < 0.15) {
      this.betray(p, nb);
    }
  },

  // Une armée se prépare contre nous : on rappelle nos soldats pour défendre,
  // et parfois on cherche un allié... ou même la paix avec l'agresseur.
  reactToThreats(p) {
    const threats = Game.attacks.filter(a => !a.done && a.target === p.id && Game.isPreparing(a));
    if (!threats.length) return;
    const incoming = threats.reduce((s, a) => s + a.troops, 0);
    if (incoming > p.troops * 0.5) {
      for (const a of Game.attacks) if (!a.done && a.attacker === p.id) Game.endAttack(a);
    }
    if (Math.random() < 0.3) Game.proposeAlliance(p.id, threats[0].attacker);
  },

  // Propose une alliance à un voisin
  tryAlliance(p) {
    if (Game.allies(p.id).length >= 2) return;
    const candidates = [...Game.neighborStats(p.id).keys()]
      .filter(o => o >= 0 && !Game.areAllied(p.id, o)
        && !Game.attacks.some(a => !a.done && a.attacker === p.id && a.target === o));
    if (candidates.length) Game.proposeAlliance(p.id, candidates[(Math.random() * candidates.length) | 0]);
  },

  // Entouré uniquement d'alliés et à l'étroit : trahison du plus faible !
  betray(p, nb) {
    let victim = null;
    for (const [o] of nb) {
      if (o < 0 || !Game.areAllied(p.id, o)) continue;
      if (!victim || Game.players[o].troops < victim.troops) victim = Game.players[o];
    }
    if (!victim) return;
    Game.breakAlliance(p.id, victim.id);
    Game.launchAttack(p.id, victim.id, p.troops * 0.5);
  },

  tryBuild(p) {
    // Parfois, améliorer un château ou un moulin plutôt que construire
    if (Math.random() < 0.3) {
      const mine = Game.buildingTiles.filter(a => Game.owner[a] === p.id
        && Game.upgradeCost(a) !== null && p.gold >= Game.upgradeCost(a));
      if (mine.length) { Game.upgradeBuilding(p, mine[(Math.random() * mine.length) | 0]); return; }
    }
    const c = p.bCount;
    let type = B_MILL;
    if (c[B_BARRACKS] < c[B_MILL] / 2) type = B_BARRACKS;
    else if (Math.random() < 0.2) type = B_CASTLE;
    if (p.gold < Game.buildCost(p, type)) return;

    const tiles = [];
    for (let i = 0; i < Game.N; i++) {
      if (Game.owner[i] === p.id && Game.canPlace(p.id, i, type)) tiles.push(i);
    }
    if (tiles.length) Game.tryBuild(p, tiles[(Math.random() * tiles.length) | 0], type);
  },
};
