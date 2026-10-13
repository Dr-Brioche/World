// 🤖 INTELLIGENCE DES ROYAUMES ADVERSES
// Chaque bot réfléchit toutes les 1 à 3 secondes : construire ? attaquer ? qui ?

const AI = {
  update(p) {
    if (--p.aiTimer > 0) return;
    p.aiTimer = Math.round(CONFIG.TICKS_PER_SECOND * (1 + Math.random() * 2));

    if (Math.random() < 0.4) this.tryBuild(p);
    if (Math.random() < 0.08) this.tryAlliance(p);

    this.reactToThreats(p);

    // Une seule campagne à la fois ; si l'assaut en cours se heurte à des défenseurs, renforts !
    const mine = Game.attacks.find(a => !a.done && a.attacker === p.id);
    if (mine) {
      // Assaut de jonction bloqué par des défenseurs : renforts
      if (mine.link !== undefined) {
        if (mine.defenders > mine.troops && p.troops > 2) Game.launchLink(p.id, mine.link, p.troops * 0.4);
        return;
      }
      if (mine.target >= 0 && mine.defenders + (mine.garrison || 0) > mine.troops && p.troops > 2) {
        Game.launchAttack(p.id, mine.target, p.troops * 0.4, mine.targetCastle >= 0 ? mine.targetCastle : undefined);
      }
      return;
    }

    const max = Game.maxTroops(p);
    const nb = Game.neighborStats(p.id);

    // Un de nos châteaux est isolé : de temps en temps, on tente de le relier au royaume
    if (p.troops > max * 0.4 && Math.random() < 0.2) {
      const lost = Game.castlesOf(p.id).find(c => Game.isIsolatedCastle(c));
      if (lost !== undefined && !Game.launchLink(p.id, lost, p.troops * 0.5)) return;
    }

    // S'il reste des terres libres, on s'étend en priorité
    if (nb.has(-1) && p.troops > max * 0.2 && Math.random() < 0.85) {
      Game.launchAttack(p.id, -1, p.troops * 0.4);
      return;
    }

    if (p.troops < max * p.aggression) return;

    // Sinon on cherche le voisin le plus faible : on compare notre assaut (70 % de nos soldats)
    // à ce qu'il pourra nous opposer (la moitié de ses soldats + la garnison du château visé).
    let best = null, bestScore = 0, bestAim = -1;
    for (const [o] of nb) {
      if (o < 0 || Game.areAllied(p.id, o)) continue;
      const e = Game.players[o];
      // château le plus proche atteignable (null = aucun château) et défense du terrain où l'on se battra
      const plan = Game.planAssault(p.id, o), aim = plan.castle;
      if (aim === -1) continue;
      const garrison = aim === null ? 0 : Game.garrison[aim];
      // Un château isolé ne reçoit pas de défenseurs : seule sa garnison le défend (proie facile !)
      // (sans château ni église, toutes ses troupes défendent d'office, mais à 0.8)
      const helpers = aim === null ? e.troops * CONFIG.LEADERLESS_DEFENSE
        : Game.isIsolatedCastle(aim) ? 0 : e.troops * 0.5;
      const power = Game.troopPower(o) / Game.troopPower(p.id); // force des soldats des deux camps
      let score = p.troops * 0.7 / ((helpers + garrison) * plan.D * power + 1) + Math.random() * 0.3;
      if (e.isHuman) score += Game.difficulty.hateHuman;
      if (Game.isTraitor(e)) score += 0.5; // un traître affaibli est une proie facile
      if (score > bestScore) { bestScore = score; best = o; bestAim = aim; }
    }
    const full = p.troops >= max * 0.95;
    if (best !== null && (bestScore > 1.2 || (full && bestScore > 0.7))) {
      Game.launchAttack(p.id, best, p.troops * 0.7, bestAim === null ? undefined : bestAim);
    } else if (nb.has(-1)) {
      Game.launchAttack(p.id, -1, p.troops * 0.3);
    } else if (best === null && full && Math.random() < 0.15) {
      this.betray(p, nb);
    }
  },

  // Des assauts nous visent : on envoie des défenseurs contre chacun.
  reactToThreats(p) {
    // Envoyer des défenseurs contre chaque assaut : assez pour l'arrêter, vu la défense du terrain
    for (const a of Game.attacks) {
      if (a.done || a.target !== p.id) continue;
      const D = Game.combatRatio(a);
      // (un bot ne défend pas parfaitement : il envoie 80 % de ce qu'il faudrait, au plus la moitié de son armée)
      const needed = (a.troops / D) * 0.8 - a.defenders - (a.garrison || 0);
      if (needed <= 0) continue;
      // Château isolé : impossible d'y envoyer des défenseurs, on tente de le rejoindre par un assaut
      if (Game.cutOff(a)) {
        if (!Game.linkFor(a.targetCastle)) Game.launchLink(p.id, a.targetCastle, Math.min(needed * 1.5, p.troops * 0.5));
        continue;
      }
      Game.sendDefenders(p.id, a.id, Math.min(needed, p.troops * 0.5));
    }
    // Une armée se prépare contre nous : parfois, on tente de faire la paix (un pacte)
    const threats = Game.attacks.filter(a => !a.done && a.target === p.id && Game.isPreparing(a));
    if (threats.length && Math.random() < 0.3) Game.proposeAlliance(p.id, threats[0].attacker);
  },

  // Propose une alliance à un voisin
  tryAlliance(p) {
    const candidates = [...Game.neighborStats(p.id).keys()]
      .filter(o => o >= 0 && !Game.areAllied(p.id, o) && !Game.pactBlock(p.id, o) && !Game.isTraitor(Game.players[o])
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
    const aim = Game.pickCastleTarget(p.id, victim.id);
    if (aim === -1) return; // aucun château atteignable : on ne trahit pas pour rien
    Game.breakAlliance(p.id, victim.id);
    Game.launchAttack(p.id, victim.id, p.troops * 0.5, aim === null ? undefined : aim);
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
    else if (Math.random() < 0.2 && p.castlesBuilt < Game.maxCastles(p)) type = B_CASTLE;
    else if (Math.random() < 0.1 && c[B_CHURCH] < 2) type = B_CHURCH;
    if (p.gold < Game.buildCost(p, type)) return;

    const tiles = [];
    for (let i = 0; i < Game.N; i++) {
      if (Game.owner[i] === p.id && Game.canPlace(p.id, i, type)) tiles.push(i);
    }
    if (tiles.length) Game.tryBuild(p, tiles[(Math.random() * tiles.length) | 0], type);
  },
};
