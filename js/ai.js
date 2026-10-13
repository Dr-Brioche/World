// 🤖 INTELLIGENCE DES ROYAUMES ADVERSES
// Chaque bot réfléchit toutes les 1 à 3 secondes : construire ? attaquer ? qui ?

const AI = {
  update(p) {
    if (--p.aiTimer > 0) return;
    p.aiTimer = Math.round(CONFIG.TICKS_PER_SECOND * (1 + Math.random() * 2));

    if (Math.random() < 0.4) this.tryBuild(p);

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
      if (o < 0) continue;
      const e = Game.players[o];
      let score = p.troops / (e.troops + 50) + Math.random() * 0.3;
      if (e.isHuman) score += Game.difficulty.hateHuman;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    const full = p.troops >= max * 0.95;
    if (best !== null && (bestScore > 1 || (full && bestScore > 0.5))) {
      Game.launchAttack(p.id, best, p.troops * 0.5);
    } else if (nb.has(-1)) {
      Game.launchAttack(p.id, -1, p.troops * 0.3);
    }
  },

  tryBuild(p) {
    const c = p.bCount;
    let type = B_FARM;
    if (c[B_BARRACKS] < c[B_FARM] / 2) type = B_BARRACKS;
    else if (Math.random() < 0.2) type = B_CASTLE;
    if (p.gold < Game.buildCost(p, type)) return;

    const tiles = [];
    for (let i = 0; i < Game.N; i++) {
      if (Game.owner[i] === p.id && !Game.building[i]) tiles.push(i);
    }
    if (tiles.length) Game.tryBuild(p, tiles[(Math.random() * tiles.length) | 0], type);
  },
};
