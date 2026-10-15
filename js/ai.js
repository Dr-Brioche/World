// 🤖 INTELLIGENCE DES ROYAUMES ADVERSES
// Chaque bot réfléchit toutes les 1 à 3 secondes : construire ? attaquer ? qui ?

const AI = {
  update(p) {
    if (--p.aiTimer > 0) return;
    p.aiTimer = Math.round(CONFIG.TICKS_PER_SECOND * (1 + Math.random() * 2));

    if (Math.random() < 0.4) this.tryBuild(p);
    if (Math.random() < 0.05) this.tryExpedition(p);
    if (this.stuckOnIsland(p)) this.goToSea(p);
    if (Math.random() < 0.08) this.tryAlliance(p);

    this.reactToThreats(p);

    // Une seule campagne à la fois ; si l'assaut en cours se heurte à des défenseurs, renforts !
    const mine = Game.attacks.find(a => !a.done && a.attacker === p.id);
    if (mine) {
      // Assaut de jonction bloqué par des défenseurs : renforts
      // (un bot attend AI_SEND_INTERVAL secondes entre deux envois, et que son armée ait repris des forces :
      //  il envoie alors un gros paquet d'un coup, au lieu de quelques soldats à chaque instant)
      const ready = (mine.aiSent === undefined || Game.tick - mine.aiSent >= CONFIG.AI_SEND_INTERVAL * CONFIG.TICKS_PER_SECOND)
        && p.troops > Game.maxTroops(p) * 0.3;
      if (mine.link !== undefined) {
        if (ready && mine.defenders > mine.troops) { Game.launchLink(p.id, mine.link, p.troops * 0.6); mine.aiSent = Game.tick; }
        return;
      }
      if (mine.target >= 0 && mine.defenders + (mine.garrison || 0) * Game.garrisonPower(mine) > mine.troops) {
        if (ready) {
          Game.launchAttack(p.id, mine.target, p.troops * 0.6, mine.targetCastle >= 0 ? mine.targetCastle : undefined);
          mine.aiSent = Game.tick;
        }
        return;
      }
      // Avec une citadelle : un deuxième assaut contre le même royaume, sur une autre de ses cibles
      const all = Game.attacks.filter(a => !a.done && a.attacker === p.id && a.target === mine.target && a.link === undefined);
      if (mine.target >= 0 && Game.isProtected(mine.target) && all.length < Game.maxAssaults(p.id)
        && p.troops > Game.maxTroops(p) * 0.4 && Math.random() < 0.3) {
        const other = Game.nearestTargets(p.id, mine.target).find(c => !all.some(a => a.targetCastle === c));
        if (other !== undefined) Game.launchAttack(p.id, mine.target, p.troops * 0.5, other);
      }
      return;
    }

    const max = Game.maxTroops(p);
    const nb = Game.neighborStats(p.id);

    // Nos avant-postes bâtis : leurs soldats stationnés prennent des terres libres autour
    for (const [op, o] of Game.outposts) {
      if (Game.owner[op] !== p.id || !Game.outpostReady(op) || o.stationed < 10 || Math.random() > 0.3) continue;
      Game.launchAttack(p.id, -1, o.stationed * 0.7, undefined, op);
    }

    // Un de nos châteaux (ou ports de niveau 3) est isolé : de temps en temps, on tente de le relier au royaume
    if (p.troops > max * 0.4 && Math.random() < 0.2) {
      const lost = Game.buildingTiles.find(c => Game.owner[c] === p.id && Game.holdsAlone(c) && Game.isIsolated(c));
      if (lost !== undefined && !Game.launchLink(p.id, lost, p.troops * 0.5)) return;
    }

    // De temps en temps, des terres libres de l'autre côté d'un fleuve : on le traverse à gué
    // (souvent s'il n'y a plus de terre libre à notre frontière : c'est le seul moyen de passer)
    if (p.troops > max * 0.3 && Math.random() < (nb.has(-1) ? 0.1 : 0.3) && this.tryCrossing(p)) return;

    // S'il reste des terres libres, on s'étend en priorité
    // (il attend d'avoir assez de soldats, puis envoie un gros morceau, plutôt que de petits paquets sans arrêt)
    if (nb.has(-1) && p.troops > max * 0.4 && Math.random() < 0.85) {
      Game.launchAttack(p.id, -1, p.troops * 0.6);
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
      // (une garnison vaut 3 au combat ; les soldats d'un avant-poste en construction, affaiblis, comptent pour 1)
      const garrison = aim === null ? 0 : Game.garrison[aim] * (Game.builders(aim) ? 1 : CONFIG.GARRISON_POWER);
      // Un château isolé ne reçoit pas de défenseurs : seule sa garnison le défend (proie facile !)
      // (sans château ni église, toutes ses troupes défendent d'office, mais à 0.8)
      // (un morceau coupé de tous ses châteaux : personne ne le défend)
      const helpers = plan.tile !== undefined ? 0 : aim === null ? e.troops * CONFIG.LEADERLESS_DEFENSE
        : Game.isIsolated(aim) ? 0 : e.troops * 0.5;
      const power = Game.troopPower(o) / Game.troopPower(p.id); // force des soldats des deux camps
      let score = p.troops * 0.7 / ((helpers + garrison) * plan.D * power + 1) + Math.random() * 0.3;
      if (e.isHuman) score += Game.difficulty.hateHuman;
      if (Game.isTraitor(e)) score += 0.5; // un traître affaibli est une proie facile
      if (score > bestScore) { bestScore = score; best = o; bestAim = plan.tile !== undefined ? plan.tile : aim; }
    }
    const full = Game.armySize(p) >= max * 0.95; // (garnisons comprises)
    if (best !== null && (bestScore > 1.2 || (full && bestScore > 0.7))) {
      Game.launchAttack(p.id, best, p.troops * 0.7, bestAim === null ? undefined : bestAim);
    } else if (nb.has(-1)) {
      Game.launchAttack(p.id, -1, p.troops * 0.3);
    } else if (best === null && full && Math.random() < 0.15) {
      this.betray(p, nb);
    }
  },

  // Cherche une rive libre en face de nos terres, de l'autre côté d'un fleuve, et la traverse à gué.
  // Renvoie true si une traversée est lancée.
  tryCrossing(p) {
    const G = Game, W = G.W;
    if (G.crossings.some(c => c.pid === p.id)) return false; // une traversée à la fois
    // Les cases de fleuve libres qui touchent nos terres
    const fords = [];
    for (const i of G.riverTiles()) {
      let mine = false;
      G.forNeighbors(i, n => { if (G.owner[n] === p.id) mine = true; });
      if (mine) fords.push(i);
    }
    if (!fords.length) return false;
    // On part d'une de ces cases au hasard et on suit le fleuve jusqu'à une rive libre loin de nos terres
    const near = j => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = j % W + dx, y = ((j / W) | 0) + dy;
        if (x >= 0 && y >= 0 && x < W && y < G.H && G.owner[y * W + x] === p.id) return true;
      }
      return false;
    };
    const seen = new Set([fords[(Math.random() * fords.length) | 0]]);
    for (const r of seen) {
      if (seen.size > 200) break;
      let bank = -1;
      G.forNeighbors(r, n => {
        if (G.owner[n] !== -1 || !G.isLand(n)) return;
        if (G.terrain[n] === TERRAIN.RIVER) seen.add(n);
        else if (bank < 0 && !near(n)) bank = n;
      });
      if (bank >= 0) return !G.launchCrossing(p.id, bank);
    }
    return false;
  },

  // Des assauts nous visent : on envoie des défenseurs contre chacun.
  reactToThreats(p) {
    // Envoyer des défenseurs contre chaque assaut : assez pour l'arrêter, vu la défense du terrain
    for (const a of Game.attacks) {
      if (a.done || a.target !== p.id || Game.defendWait(a) > 0) continue; // (5 s entre deux envois)
      // (un bot n'envoie pas ses défenseurs au compte-gouttes : un gros paquet, puis il attend AI_SEND_INTERVAL secondes)
      if (a.aiDefSent !== undefined && Game.tick - a.aiDefSent < CONFIG.AI_SEND_INTERVAL * CONFIG.TICKS_PER_SECOND) continue;
      const D = Game.combatRatio(a);
      // (un bot ne défend pas parfaitement : il envoie 80 % de ce qu'il faudrait, au plus la moitié de son armée)
      const needed = (a.troops / D) * 0.8 - a.defenders - Game.defendersOnTheWay(a) - Game.garrisonFor(a) * Game.garrisonPower(a);
      if (needed <= 0) continue;
      // Château isolé (ou avant-poste) : impossible d'y envoyer des défenseurs. Pour un château, on tente
      // de le rejoindre par un assaut ; pour un avant-poste, on envoie des renforts par la mer.
      const op = Game.outpostZoneOf(a);
      if (op >= 0) {
        // zone d'un avant-poste : d'abord ses soldats stationnés, puis des renforts par la mer
        const sent = Game.sendDefenders(p.id, a.id, needed * 1.3);
        if (sent) { a.aiDefSent = Game.tick; continue; }
        if (!Game.expeditions.some(e => e.reinforce === op)) {
          Game.reinforceOutpost(p.id, op, Math.min(needed, p.troops * 0.4));
        }
        continue;
      }
      if (Game.cutOff(a)) {
        if (Game.holdsAlone(a.targetCastle) && !Game.linkFor(a.targetCastle)) Game.launchLink(p.id, a.targetCastle, Math.min(needed * 1.5, p.troops * 0.5));
        continue;
      }
      const chunk = Math.max(needed * 1.3, Game.maxTroops(p) * 0.1); // (au moins un bon paquet)
      if (Game.sendDefenders(p.id, a.id, Math.min(chunk, p.troops * 0.6))) a.aiDefSent = Game.tick;
    }
    // Un allié du pacte se fait attaquer : on envoie parfois une armée l'aider
    for (const a of Game.attacks) {
      if (a.done || a.target < 0 || a.attacker === p.id || !Game.areAllied(p.id, a.target) || Game.isPreparing(a) || Game.cutOff(a)) continue;
      const need = a.troops / Game.combatRatio(a) - a.defenders - Game.garrisonFor(a) * Game.garrisonPower(a);
      if (need <= 0 || p.troops < Game.maxTroops(p) * 0.3 || Math.random() > 0.3) continue;
      Game.helpAlly(p.id, a.id, Math.min(need, p.troops * 0.25));
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

  // Plus rien à prendre par la terre (ni terre libre, ni ennemi voisin) : il faut partir en mer
  stuckOnIsland(p) {
    for (const [o] of Game.neighborStats(p.id)) if (o < 0 || !Game.areAllied(p.id, o)) return false;
    return true;
  },

  // Bloqué sur son île : bâtir un port, l'améliorer, puis lancer des expéditions (vers des terres libres d'abord)
  goToSea(p) {
    const ports = Game.buildingTiles.filter(a => Game.building[a] === B_PORT && Game.owner[a] === p.id);
    if (!ports.length) return this.tryBuild(p, B_PORT);
    if (!Game.expeditionPorts(p.id).length) {
      const port = ports[0];
      if (Game.upgradeCost(port) !== null && p.gold >= Game.upgradeCost(port)) Game.upgradeBuilding(p, port);
      return;
    }
    if (Math.random() < 0.3) this.tryExpedition(p, true);
  },

  // Avec un grand port : parfois, une expédition vers une côte au hasard (freeFirst : de préférence une terre libre)
  tryExpedition(p, freeFirst) {
    if (!Game.expeditionPorts(p.id).length || p.gold < 40) return;
    for (let k = 0; k < (freeFirst ? 60 : 15); k++) {
      const i = (Math.random() * Game.N) | 0;
      if (!Game.isCoastal(i) || !Game.landable(p.id, i)) continue;
      if (freeFirst && k < 45 && Game.owner[i] !== -1) continue;
      if (!Game.launchExpedition(p.id, i, Math.max(p.troops * 0.3, 12))) return;
    }
  },

  tryBuild(p, forced) {
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
    else if (Math.random() < 0.1 && c[B_PORT] < 2) type = B_PORT;
    if (forced) type = forced;
    if (p.gold < Game.buildCost(p, type)) return;

    const tiles = [];
    for (let i = 0; i < Game.N; i++) {
      if (Game.owner[i] === p.id && Game.canPlace(p.id, i, type)) tiles.push(i);
    }
    if (!tiles.length) return;
    // parmi quelques emplacements tirés au hasard, le meilleur terrain pour produire (pas le désert, si possible)
    let best = -1, bestF = -1;
    for (let k = 0; k < 6; k++) {
      const i = tiles[(Math.random() * tiles.length) | 0], f = Game.terrainFactor(i, type);
      if (f > bestF) { bestF = f; best = i; }
    }
    Game.tryBuild(p, best, type);
  },
};
