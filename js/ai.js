// 🤖 INTELLIGENCE DES ROYAUMES ADVERSES
// Chaque bot réfléchit toutes les 1 à 3 secondes : construire ? attaquer ? qui ?

const AI = {
  update(p) {
    if (--p.aiTimer > 0) return;
    p.aiTimer = Math.round(CONFIG.TICKS_PER_SECOND * (1 + Math.random() * 2));

    if (Math.random() < 0.4) this.tryBuild(p);
    if (Math.random() < 0.1) this.tryWall(p);
    if (Math.random() < 0.05 * (Game.difficulty.zeal || 1)) this.tryCrusade(p);
    if (Math.random() < 0.1) this.tryLevy(p);
    if (Math.random() < (p.bridgeSaving ? 0.3 : 0.05)) this.tryBridge(p);
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
          // (renforts : même cible et même point de départ que l'assaut en cours)
          // (assaut de front sur un royaume désorganisé : pas de case visée, sinon on risquerait de viser une église)
          const src = Game.sourceOfAttack(mine);
          const aim = mine.targetCastle >= 0 ? mine.targetCastle : mine.disorganized ? undefined : mine.frontTile;
          Game.launchAttack(p.id, mine.target, Game.troopsAt(p.id, src) * 0.6, aim, src);
          mine.aiSent = Game.tick;
        }
        return;
      }
      // Avec une citadelle : un deuxième assaut contre le même royaume, sur une autre de ses cibles
      // (contre un royaume désorganisé attaqué de front : sur une de ses églises ou un de ses ports)
      const all = Game.attacks.filter(a => !a.done && a.attacker === p.id && a.target === mine.target && a.link === undefined);
      if (mine.target >= 0 && all.length < Game.maxAssaults(p.id)
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
    const alive = Game.players.filter(q => q.alive).length;
    for (const [o] of nb) {
      if (o < 0 || Game.areAllied(p.id, o)) continue;
      const e = Game.players[o];
      // château le plus proche atteignable (null = aucun château) et défense du terrain où l'on se battra
      const plan = Game.planAssault(p.id, o), aim = plan.castle;
      if (aim === -1) continue;
      // (une garnison vaut 3 au combat ; les soldats d'un avant-poste en construction, affaiblis, comptent pour 1)
      const garrison = aim === null ? 0 : Game.garrison[aim] * (Game.builders(aim) ? 1 : CONFIG.GARRISON_POWER);
      // Un château isolé ne reçoit pas de défenseurs : seule sa garnison le défend (proie facile !)
      // (sans château, toutes ses troupes défendent d'office, mais à 0.8)
      // (un morceau coupé de tous ses châteaux : personne ne le défend)
      // (ses soldats partis à l'assaut ailleurs comptent à moitié : ils reviendront, il n'est pas si faible)
      const away = Game.attacks.reduce((s, a) => s + (!a.done && a.attacker === o ? a.troops : 0), 0);
      const strength = e.troops + away * 0.5;
      const helpers = plan.tile !== undefined ? 0 : aim === null ? strength * CONFIG.LEADERLESS_DEFENSE
        : Game.isIsolated(aim) ? 0 : strength * 0.5;
      const power = Game.troopPower(o) / Game.troopPower(p.id); // force des soldats des deux camps
      let score = p.troops * 0.7 / ((helpers + garrison) * plan.D * power + 1) + Math.random() * 0.3;
      // (quand il ne reste que quelques royaumes, les bots n'ont plus de préférence contre le joueur)
      if (e.isHuman && alive > 4) score += Game.difficulty.hateHuman;
      // Pas d'acharnement : une cible déjà attaquée par un autre royaume est moins tentante
      // (les bots ne se liguent pas tous contre le même, ils se battent aussi entre eux)
      if (Game.attacks.some(a => !a.done && a.target === o && a.attacker !== p.id)) score *= 0.5;
      if (Game.isTraitor(e)) score += 0.5; // un traître affaibli est une proie facile
      if (score > bestScore) { bestScore = score; best = o; bestAim = plan.tile !== undefined ? plan.tile : aim; }
    }
    const full = Game.armySize(p) >= max * 0.95; // (sans les garnisons)
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
      if (Game.isPreparing(a)) continue; // (l'armée n'est pas encore entrée sur nos terres)
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
    if (Game.eternalPact(p.id)) return; // (un camp du mode « Factions » ne se trahit jamais)
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

  // Un mur pour fermer un passage : une ville de niveau 2 (ou 3) qui a assez d'or regarde par où un royaume
  // ennemi voisin l'attaquerait (son chemin d'assaut), et bâtit un mur qui coupe ce chemin en s'accrochant à un
  // obstacle tout proche (lac, mer, fleuve, sommet, autre mur) : l'ennemi devra faire un détour (ou renoncer).
  // Renvoie true si un chantier est lancé.
  tryWall(p) {
    const G = Game, W = G.W;
    const enemies = [...G.neighborStats(p.id).keys()].filter(o => o >= 0 && !G.areAllied(p.id, o));
    if (!enemies.length) return false;
    for (const c of G.castles) {
      if (G.owner[c] !== p.id || G.works.has(c) || G.wallsOf(c).length >= G.wallMax(c)) continue;
      if (p.gold < G.wallCost(c)) continue;
      // Relier deux de ses villes par un mur : +50 de garnison pour chacune (s'il y en a une à portée)
      for (const o of G.castles) {
        if (o === c || G.owner[o] !== p.id || G.wallLinked(c).has(o)) continue;
        const aim = o + G.W + 1; // (une case au cœur de l'autre ville)
        if (!G.planWall(p.id, c, aim).error && !G.buildWall(p, c, aim)) return true;
      }
      // le chemin qu'un ennemi (pris au hasard parmi les voisins) suivrait pour assiéger cette ville
      const e = enemies[(Math.random() * enemies.length) | 0];
      const path = G.castlePath(e, c);
      if (!path) continue;
      const route = new Set(path);
      // on essaie des murs dans toutes les directions : il doit couper ce chemin ; le mieux est qu'il s'accroche à
      // un obstacle (il ferme vraiment le passage), et qu'il soit court (passage étroit). Sinon, un mur qui coupe le
      // chemin oblige quand même l'ennemi à faire un détour.
      const R = G.castleInfo(c).radius, h = G.sizeOf(B_CASTLE) / 2, cx = c % W + h, cy = ((c / W) | 0) + h;
      let best = -1, bestScore = Infinity;
      for (let k = 0; k < 32; k++) {
        const ang = k / 32 * Math.PI * 2;
        for (let d = R + 3; d <= R + CONFIG.WALL_MAX_REACH; d += 3) {
          const x = Math.round(cx + Math.cos(ang) * d), y = Math.round(cy + Math.sin(ang) * d);
          if (x < 0 || y < 0 || x >= W || y >= G.H) continue;
          const plan = G.planWall(p.id, c, y * W + x);
          if (plan.error || !plan.tiles.some(t => route.has(t))) continue;
          const score = plan.tiles.length + (plan.sealed ? 0 : 100);
          if (score < bestScore) { bestScore = score; best = y * W + x; }
        }
      }
      if (best >= 0 && !G.buildWall(p, c, best)) return true;
    }
    return false;
  },

  // Recrutement de masse : avec une grande caserne, une armée bien entamée (moins de 30 % du maximum) et de l'or en réserve
  tryLevy(p) {
    const G = Game;
    if (p.gold < CONFIG.LEVY_COST * 1.5 || G.armySize(p) > 0.3 * G.maxTroops(p)) return false;
    const b = G.buildingTiles.find(a => G.building[a] === B_BARRACKS && !G.levyError(p, a));
    return b !== undefined && !G.startLevy(p, b);
  },

  // Croisade religieuse : en retard de Croyance sur un voisin ennemi, avec une cathédrale et de l'or en réserve
  // (il garde de quoi construire : pas plus d'une croisade quand il a moins de 1,5 fois son prix)
  tryCrusade(p) {
    const G = Game;
    if (p.gold < CONFIG.CRUSADE_COST * 1.5) return false;
    if (![...G.neighborStats(p.id).keys()].some(o => o >= 0 && G.faithEdge(o, p.id) > 0)) return false;
    const church = G.buildingTiles.find(a => G.building[a] === B_CHURCH && !G.crusadeError(p, a));
    return church !== undefined && !G.startCrusade(p, church);
  },

  // 🌉 Un ou deux ponts par partie (tiré au hasard pour chaque bot), après les premières minutes : sur un fleuve
  // qui coupe ses terres, le plus près possible d'une de ses villes (ses soldats y passent souvent), et pas à côté
  // d'un de ses ponts. S'il n'a pas assez d'or, il en met de côté (voir tryBuild : bridgeSaving).
  tryBridge(p) {
    const G = Game, W = G.W;
    p.bridgeSaving = false;
    if (G.tick < CONFIG.AI_BRIDGE_AFTER * CONFIG.TICKS_PER_SECOND) return false;
    if (p.bridgeGoal === undefined) p.bridgeGoal = Math.random() < 0.5 ? 1 : 2;
    const mine = G.bridges.filter(b => b.owner === p.id);
    if (mine.length >= p.bridgeGoal) return false;
    const cities = G.castles.filter(c => G.owner[c] === p.id);
    if (!cities.length) return false;
    const dist = (a, b) => Math.hypot(a % W - b % W, ((a / W) | 0) - ((b / W) | 0));
    let best = -1, bestD = Infinity;
    for (const t of G.riverTiles()) {
      // (seulement un fleuve qui touche nos terres)
      let near = false;
      G.forNeighbors(t, n => { if (G.owner[n] === p.id) near = true; });
      if (!near) continue;
      const d = Math.min(...cities.map(c => dist(c, t)));
      if (d >= bestD || mine.some(b => dist(b.tiles[0], t) < 8) || G.planBridge(p.id, t).error) continue;
      best = t; bestD = d;
    }
    if (best < 0) return false;
    if (p.gold < Game.bridgeCost(p.id)) { p.bridgeSaving = true; return false; } // (on économise pour le pont)
    return !G.buildBridge(p, best);
  },

  // Bâtit une mine sur le meilleur filon libre de ses terres (diamant, or, fer, pierre), s'il y en a un.
  // Renvoie true s'il en a bâti une.
  tryMine(p) {
    const G = Game, order = { diamond: 0, gold: 1, iron: 2, stone: 3 };
    const spots = G.deposits.filter(d => G.canPlace(p.id, d.a, B_MINE)
      && !(MINES[d.kind].max && G.minesOf(p.id, d.kind).length >= MINES[d.kind].max))
      .sort((x, y) => order[x.kind] - order[y.kind]);
    return spots.length > 0 && !G.tryBuild(p, spots[0].a, B_MINE);
  },

  tryBuild(p, forced) {
    // (il économise pour un pont : il ne dépense pas tout de suite, la plupart du temps)
    if (!forced && p.bridgeSaving && p.gold < Game.bridgeCost(p.id) && Math.random() < 0.7) return;
    // ✝️ Un voisin ennemi a plus de Croyance (il convertit nos terres) : on mise un peu plus sur les églises
    // (zeal : un peu en facile, plus en difficile)
    const zeal = Game.difficulty.zeal || 1;
    const behind = [...Game.neighborStats(p.id).keys()].some(o => o >= 0 && Game.faithEdge(o, p.id) > 0);
    // Parfois, améliorer un château ou un moulin plutôt que construire
    if (Math.random() < 0.3) {
      const mine = Game.buildingTiles.filter(a => Game.owner[a] === p.id && !Game.works.has(a)
        && Game.upgradeCost(a) !== null && p.gold >= Game.upgradeCost(a) && !Game.upgradeBlocker(p, a));
      // (en retard de Croyance : une église d'abord, s'il y en a une à améliorer)
      const church = behind && Math.random() < 0.4 * zeal ? mine.find(a => Game.building[a] === B_CHURCH) : undefined;
      if (church !== undefined) { Game.upgradeBuilding(p, church); return; }
      if (mine.length) { Game.upgradeBuilding(p, mine[(Math.random() * mine.length) | 0]); return; }
    }
    // ⛏️ Un filon libre sur nos terres : on y bâtit une mine (le diamant et l'or d'abord)
    if (!forced && Math.random() < 0.7 && p.gold >= Game.buildCost(p, B_MINE) && this.tryMine(p)) return;
    const c = p.bCount;
    let type = B_MILL;
    if (c[B_BARRACKS] < c[B_MILL] / 2) type = B_BARRACKS;
    else if (Math.random() < 0.2 && p.castlesBuilt < Game.maxCastles(p)) type = B_CASTLE;
    else if (behind && Math.random() < 0.15 * zeal && c[B_CHURCH] < 2 + Math.round(zeal)) type = B_CHURCH;
    else if (Math.random() < 0.1 && c[B_CHURCH] < 2) type = B_CHURCH;
    else if (Math.random() < 0.1 && c[B_PORT] < 2) type = B_PORT;
    if (forced) type = forced;
    if (p.gold < Game.buildCost(p, type)) return;

    // Où chercher (tester toutes les cases du royaume est trop long sur une grande carte) :
    // un moulin ou une caserne ne se bâtit que dans la muraille d'un château ou la zone d'une église (ou d'un
    // port) : on ne regarde que là ; pour les autres, on tire au hasard des cases du royaume.
    let tiles = [];
    if (type === B_MILL || type === B_BARRACKS) {
      const zone = new Set();
      for (const c of Game.castles) if (Game.owner[c] === p.id) for (const i of Game.castleZone(c, p.id)) zone.add(i);
      for (const ch of Game.slotBuildings(p.id)) for (const i of Game.churchZone(ch)) zone.add(i);
      for (const i of zone) if (Game.canPlace(p.id, i, type)) tiles.push(i);
    } else {
      const own = [];
      for (let i = 0; i < Game.N; i++) if (Game.owner[i] === p.id) own.push(i);
      for (let k = 0; k < 600 && tiles.length < 12 && own.length; k++) {
        const i = own[(Math.random() * own.length) | 0];
        if (Game.canPlace(p.id, i, type)) tiles.push(i);
      }
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
