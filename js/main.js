// 🕹️ INTERFACE ET CONTRÔLES
// Menus, boutons, souris/tactile et boucle d'animation.

const $ = id => document.getElementById(id);

const MAX_WAYPOINTS = 3; // points de passage au maximum pour un assaut

const UI = {
  selectedBuild: 0,
  ratio: 0.3,
  // Assaut en cours de préparation par le joueur : { target, castle, waypoints, clicks }
  // (on clique sur la cible, puis on ajoute des points de passage, puis 2 clics sur la cible pour lancer)
  plan: null,

  init() {
    $('ratio').addEventListener('input', e => { this.ratio = e.target.value / 100; this.refresh(); });

    const builds = $('builds');
    for (let t = 1; t < BUILDINGS.length; t++) {
      const b = BUILDINGS[t];
      const btn = document.createElement('button');
      btn.className = 'build';
      btn.dataset.type = t;
      btn.title = `${b.name} : ${b.desc} (touche ${t})`;
      btn.innerHTML = `<span class="key">${t}</span><span class="icon">${b.icon}</span>` +
        `<span>${b.name}</span><span class="cost"></span>`;
      btn.addEventListener('click', () => this.selectBuild(this.selectedBuild === t ? 0 : t));
      builds.appendChild(btn);
    }

    // Choix de la bannière dans le menu (elle donne la couleur du royaume)
    this.banner = BANNERS.findIndex(b => b.name === 'Aigle vert');
    $('bannerPick').innerHTML = BANNERS.map((b, k) =>
      `<button type="button" data-banner="${k}" title="${escapeHtml(b.name)}"><img src="${b.img}" alt="${escapeHtml(b.name)}"></button>`
    ).join('');
    const pick = k => {
      this.banner = k;
      document.querySelectorAll('#bannerPick button').forEach(b => b.classList.toggle('active', +b.dataset.banner === k));
      $('bannerName').textContent = BANNERS[k].name;
    };
    $('bannerPick').addEventListener('click', e => {
      const btn = e.target.closest('button[data-banner]');
      if (btn) pick(+btn.dataset.banner);
    });
    pick(this.banner);
    $('startBtn').addEventListener('click', () => this.start());
    $('replayBtn').addEventListener('click', () => location.reload());
    $('continueBtn').addEventListener('click', () => {
      $('endscreen').classList.add('hidden');
      Game.continueAfterVictory();
      this.log('⚔️ La conquête continue ! Élimine les derniers royaumes si tu le souhaites.', 'good');
    });
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('attacks').addEventListener('click', e => {
      if (e.target.dataset.defend) return this.defend(+e.target.dataset.defend);
      const id = e.target.dataset.cancel;
      if (!id) return;
      const a = Game.cancelAttack(Game.human.id, +id);
      if (a) this.log(`↩️ Retraite ! ${fmt(a.troops)} soldats rentrent au royaume.`, 'good');
      this.refreshAttacks();
    });

    // pointerdown plutôt que click : le classement est redessiné souvent
    $('lb').addEventListener('pointerdown', e => {
      const btn = e.target.closest('button[data-ally]');
      if (btn) this.onAllyButton(+btn.dataset.ally);
    });

    window.addEventListener('keydown', e => {
      if (Game.phase !== 'playing' || e.target.tagName === 'INPUT') return;
      // Touche 1, 2 ou 3 : le bâtiment suit la souris, un clic le pose (même touche = annuler)
      // On regarde la touche physique (e.code) : sur un clavier AZERTY, la touche « 1 » du haut
      // donne « & » sans Maj, « 2 » donne « é », « 3 » donne « " ». Le pavé numérique marche aussi.
      const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
      const n = m ? +m[2] : 0;
      if (n >= 1 && n < BUILDINGS.length) {
        this.selectBuild(this.selectedBuild === n ? 0 : n);
      }
      if (e.key === 'Escape') { this.selectBuild(0); this.cancelPlan(); }
      if (e.key === 'p' || e.key === 'P') this.togglePause();
    });
  },

  start() {
    Game.init({
      name: $('name').value.trim() || 'Mon Royaume',
      banner: this.banner,
      difficulty: $('difficulty').value,
    });
    $('kBanner').src = BANNERS[this.banner].img;
    Render.setupMap();
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('hint').textContent = '👑 Clique sur une terre pour fonder ta capitale';
  },

  selectBuild(t) {
    if (t) this.cancelPlan();
    this.selectedBuild = t;
    document.querySelectorAll('.build').forEach(b => b.classList.toggle('active', +b.dataset.type === t));
    document.body.style.cursor = t ? 'cell' : '';
  },

  // Infobulle des petits carrés d'alliés dans le classement
  alliesTitle(p) {
    const names = Game.allies(p.id).map(o => o.name);
    return escapeHtml(names.length ? `${Game.pactName(p)} : avec ${names.join(', ')}` : 'Aucun pacte');
  },

  togglePause() {
    Game.paused = !Game.paused;
    $('pauseBtn').textContent = Game.paused ? '▶ Reprendre' : '⏸ Pause';
  },

  // Petite image de la bannière d'un royaume, pour les messages et les listes
  bannerImg(p, cls = 'bn') {
    return `<img class="${cls}" src="${BANNERS[p.banner].img}" alt="" title="${escapeHtml(p.name)}">`;
  },

  // who = royaume (ou liste de royaumes) dont on affiche la bannière devant le message
  log(msg, cls, who) {
    const el = document.createElement('div');
    el.className = 'msg ' + (cls || '');
    const people = who ? [].concat(who) : [];
    el.innerHTML = people.map(p => this.bannerImg(p)).join('') + escapeHtml(msg);
    $('log').prepend(el);
    const old = [...$('log').querySelectorAll('.msg:not(.request)')];
    old.slice(6).forEach(m => m.remove());
    setTimeout(() => el.classList.add('fade'), 6000);
    setTimeout(() => el.remove(), 7000);
  },

  onAllyButton(id) {
    const G = Game, h = G.human, other = G.players[id];
    if (G.phase !== 'playing' || !h.alive) return;
    if (G.areAllied(h.id, id)) {
      this.confirmBetrayal(other, () => G.breakAlliance(h.id, id));
      return;
    }
    const res = G.proposeAlliance(h.id, id);
    if (res === 'refused') this.log(`🚫 ${other.name} refuse ton alliance.`, 'warn');
    else if (res !== 'accepted') this.log(res, 'warn');
  },

  // Ce que rapporte un niveau de bâtiment, en quelques mots.
  // On ne montre pas de chiffres précis : seulement des pourcentages.
  levelEffect(type, info) {
    if (type === B_CASTLE) {
      const road = info.road === 'paved' ? 'routes pavées' : 'chemins de terre';
      return `défense des murs ${pct(info.bonus)}` +
        (info.road ? `, ${road} : production des bâtiments reliés ${pct(info.roadBonus)}` : '');
    }
    if (type === B_CHURCH) {
      return `${info.slots} ${info.slots > 1 ? 'moulins ou casernes' : 'moulin ou caserne'} autour d'elle` +
        (info.castles ? `, ${info.castles} château${info.castles > 1 ? 'x' : ''} de plus dans le royaume` : '');
    }
    if (type === B_BARRACKS) {
      return `soldats toutes les ${CONFIG.PRODUCTION_INTERVAL} s, armée plus grande` +
        (info.power > 1 ? `, tous tes soldats ${pct(info.power - 1)} plus forts` : '');
    }
    return `or toutes les ${CONFIG.PRODUCTION_INTERVAL} s`;
  },

  // Ce que change une amélioration, en pourcentages par rapport au niveau actuel
  upgradeEffect(type, cur, next) {
    if (type === B_CASTLE) {
      let txt = `muraille plus grande, défense des murs ${pct(next.bonus - cur.bonus)}, ` +
        `garnison ${pct(next.garrison / cur.garrison - 1)}`;
      if (next.road) {
        const road = next.road === 'paved' ? 'routes pavées' : 'chemins de terre';
        txt += `, ${road} vers les moulins et casernes de la muraille : leur production ${pct(next.roadBonus)}`;
      }
      return txt;
    }
    if (type === B_CHURCH) {
      return `zone plus grande, ${next.slots} moulins ou casernes autour d'elle (au lieu de ${cur.slots}), ` +
        `${next.castles} château${next.castles > 1 ? 'x' : ''} de plus à construire dans le royaume ` +
        '(les églises s\'additionnent)';
    }
    if (type === B_BARRACKS) {
      return `soldats produits ${pct(next.troops / cur.troops - 1)}, bonus d'armée max ${pct(next.maxTroops / cur.maxTroops - 1)}, ` +
        `et tous les soldats du royaume ${pct(next.power - 1)} plus forts au combat (la meilleure caserne compte, ça ne s'additionne pas)`;
    }
    return `or produit ${pct(next.gold / cur.gold - 1)}`;
  },

  // Petite fenêtre pour améliorer un bâtiment (château, moulin)
  showUpgrade(a) {
    const G = Game, type = G.building[a], icon = BUILDINGS[type].icon;
    if (this.upgradeBox) this.upgradeBox.remove();
    const el = document.createElement('div');
    this.upgradeBox = el;
    el.className = 'msg request upgrade';
    const cur = G.buildingInfo(a), cost = G.upgradeCost(a);
    const close = () => { el.remove(); if (this.upgradeBox === el) this.upgradeBox = null; };
    if (cost === null) {
      el.innerHTML = `${icon} <b>${cur.name}</b> (niveau ${G.level[a]}) : déjà au maximum ! ` +
        `${this.levelEffect(type, cur)}.<div class="choices"><button data-no>OK</button></div>`;
    } else {
      const next = BUILDING_LEVELS[type][G.level[a] + 1];
      el.innerHTML = `${icon} <b>${cur.name}</b> (niveau ${G.level[a]}) → <b>${next.name}</b> (niveau ${G.level[a] + 1})<br>` +
        (next.img ? `<img src="${next.img}" alt="">` : '') +
        `<b>${this.upgradeEffect(type, cur, next)}</b>` +
        `<div class="choices"><button data-yes>Améliorer (💰 ${fmt(cost)})</button><button data-no>Fermer</button></div>`;
      el.querySelector('[data-yes]').addEventListener('click', () => {
        const err = G.upgradeBuilding(G.human, a);
        if (err) return this.log(err, 'warn');
        close();
        this.log(`${icon} Amélioration terminée : ${G.buildingInfo(a).name} !`, 'good');
      });
    }
    el.querySelector('[data-no]').addEventListener('click', close);
    $('log').prepend(el);
    setTimeout(close, 15000);
  },

  // Demande confirmation avant de trahir un allié.
  confirmBetrayal(other, onConfirm) {
    if (this.betrayalBox) this.betrayalBox.remove();
    const el = document.createElement('div');
    this.betrayalBox = el;
    el.className = 'msg request betray';
    const pct = Math.round((1 - CONFIG.TRAITOR_DEFENSE_MALUS) * 100);
    el.innerHTML = `🗡️ Trahir <b>${escapeHtml(other.name)}</b> ? Ta défense sera affaiblie de ${pct} % ` +
      `pendant ${CONFIG.TRAITOR_DURATION / 60} min et personne ne voudra s'allier avec toi.` +
      `<div class="choices"><button data-yes>Trahir</button><button data-no>Annuler</button></div>`;
    const close = () => { el.remove(); if (this.betrayalBox === el) this.betrayalBox = null; };
    el.querySelector('[data-yes]').addEventListener('click', () => {
      close();
      if (Game.phase === 'playing' && Game.human.alive && Game.areAllied(Game.human.id, other.id)) onConfirm();
    });
    el.querySelector('[data-no]').addEventListener('click', close);
    $('log').prepend(el);
    setTimeout(close, 10000);
  },

  // Un royaume propose une alliance au joueur. Renvoie false si une demande est déjà en cours.
  askAlliance(from) {
    this.pending = this.pending || new Set();
    // Pas plus de 2 demandes affichées à la fois, pour ne pas cacher la carte
    if (this.pending.has(from.id) || this.pending.size >= 2) return false;
    this.pending.add(from.id);
    const el = document.createElement('div');
    el.className = 'msg request';
    const h = Game.human;
    const text = from.pact >= 0 ? `t'invite dans le <b>${escapeHtml(Game.pactName(from))}</b>.`
      : h.pact >= 0 ? `veut rejoindre ton <b>${escapeHtml(Game.pactName(h))}</b>.`
      : 'te propose de former un pacte.';
    el.innerHTML = `${this.bannerImg(from)}🤝 <b>${escapeHtml(from.name)}</b> ${text}` +
      `<div class="choices"><button data-yes>Accepter</button><button data-no>Refuser</button></div>`;
    const answer = yes => {
      if (!this.pending.has(from.id)) return;
      this.pending.delete(from.id);
      el.remove();
      const block = Game.pactBlock(from.id, Game.human.id);
      if (yes && block) this.log(block, 'warn'); // la situation a changé entre-temps
      if (yes && !block && from.alive && Game.human.alive) Game.makeAlliance(from.id, Game.human.id);
      else Game.refuseAlliance(from.id, Game.human.id);
    };
    el.querySelector('[data-yes]').addEventListener('click', () => answer(true));
    el.querySelector('[data-no]').addEventListener('click', () => answer(false));
    $('log').prepend(el);
    setTimeout(() => answer(false), CONFIG.ALLIANCE_REQUEST_TIMEOUT * 1000);
    return true;
  },

  // canContinue = il reste des royaumes rivaux : bouton « Continuer » pour finir la conquête
  showEnd(win, canContinue = false) {
    const h = Game.human, secs = Math.floor(Game.tick / CONFIG.TICKS_PER_SECOND);
    $('endTitle').textContent = win ? '🏆 Victoire !' : '💀 Défaite...';
    $('endText').textContent = win
      ? (canContinue ? `Longue vie au royaume de ${h.name} ! Tu domines le continent.`
        : `${h.name} a conquis le monde entier ! Plus aucun royaume ne te résiste.`)
      : `Le royaume de ${h.name} est tombé. Les chroniques s'en souviendront...`;
    $('endStats').innerHTML =
      `⏱️ Durée : ${Math.floor(secs / 60)} min ${secs % 60} s<br>` +
      `🗺️ Plus grand territoire : ${(h.maxTiles / Game.landCount * 100).toFixed(1)} %<br>` +
      `☠️ Royaumes anéantis : ${h.kills}`;
    $('continueBtn').classList.toggle('hidden', !canContinue);
    $('endscreen').classList.remove('hidden');
  },

  describeTile(i) {
    if (i < 0) return '';
    const G = Game, t = TERRAIN_INFO[G.terrain[i]];
    if (G.terrain[i] === TERRAIN.GREAT_RIVER) return '🌊 Grand fleuve (infranchissable)';
    if (!G.isLand(i)) return '🌊 Mer';
    const o = G.owner[i];
    let txt = t.cost > 1 ? `${t.name} (défense ${pct(t.cost - 1)})` : t.name;
    txt += o >= 0 ? ` · ${G.players[o].name}` : ' · Terre libre';
    if (o >= 0 && G.areAllied(o, G.human.id)) txt += ' · 🤝 allié';
    if (o >= 0 && G.isTraitor(G.players[o])) txt += ' · 🗡️ traître (défense affaiblie)';
    const info = G.building[i] ? G.buildingInfo(G.anchor[i]) : null;
    if (info) {
      const a = G.anchor[i];
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${info.name} (niv. ${G.level[a]}, ${this.levelEffect(G.building[i], info)})`;
      if (G.building[i] === B_CASTLE) txt += ` · 🛡️ garnison ${Math.round(G.garrison[a] / info.garrison * 100)} %`;
      if (G.building[i] === B_CASTLE && G.isIsolatedCastle(a)) {
        txt += o === G.human.id ? ' · 🚩 coupé de ton royaume (il produit toujours) : clique pour lancer un assaut qui le relie à ton royaume'
          : ' · 🚩 isolé : aucun renfort ne peut le rejoindre';
      }
      if (TERRAIN_PRODUCTION[G.building[i]]) txt += ` · terrain : ${prodText(G.terrainFactor(a, G.building[i]))}`;
      if (G.building[i] === B_CHURCH) txt += ` · places prises : ${G.churchUsed(a)} sur ${info.slots} · ⚠️ sans défense : on peut l'attaquer directement`;
      const road = G.roads().get(a);
      if (road) txt += ` · ${road.road === 'paved' ? '🛣️ route pavée' : '🛤️ chemin'} : +${Math.round(road.bonus * 100)} %`;
      if (o === G.human.id && G.upgradeCost(a) !== null && !(G.building[i] === B_CASTLE && G.isIsolatedCastle(a))) txt += ` · clique pour l'améliorer`;
    } else if (G.building[i]) {
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${BUILDINGS[G.building[i]].name}`;
    }
    if (o >= 0 && G.castleProtects(o, i)) txt += ` · dans la muraille : défense ${pct(G.tileDefense(o, i) - 1)}`;
    // Conseils d'attaque contre un royaume ennemi
    if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id) && G.isProtected(o)) {
      const b = G.building[i];
      if (b === B_CASTLE || b === B_CHURCH) {
        txt += Render.castlePreview && Render.castlePreview.path
          ? ` · 🎯 clique pour préparer un assaut sur ${b === B_CASTLE ? 'ce château' : 'cette église'}`
          : ' · 🚫 inaccessible : des châteaux bloquent le passage';
      } else {
        txt += ' · 🏰 protégé : vise un de ses châteaux ou une de ses églises';
      }
    } else if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id)) {
      txt += ' · ⚔️ sans château ni église : clique pour l\'attaquer de front (ses troupes défendent, désorganisées)';
    }
    return txt;
  },

  refresh() {
    const G = Game, h = G.human;
    if (!h) return;
    $('kName').textContent = h.name;
    $('kName').style.color = `rgb(${h.color})`;
    $('gold').textContent = fmt(h.gold);
    this.refreshTroopGauge();
    $('land').textContent = (h.tiles / G.landCount * 100).toFixed(1) + ' %';
    const traitorSecs = Math.ceil((h.traitorUntil - G.tick) / CONFIG.TICKS_PER_SECOND);
    $('traitor').classList.toggle('hidden', !G.isTraitor(h));
    $('traitor').textContent = `🗡️ Traître : défense -${Math.round((1 - CONFIG.TRAITOR_DEFENSE_MALUS) * 100)} % ` +
      `(${Math.floor(traitorSecs / 60)}:${String(traitorSecs % 60).padStart(2, '0')})`;
    $('ratioVal').textContent = `${Math.round(this.ratio * 100)} % (${fmt(h.troops * this.ratio)})`;

    document.querySelectorAll('.build').forEach(btn => {
      const cost = G.buildCost(h, +btn.dataset.type);
      btn.querySelector('.cost').textContent = `💰 ${fmt(cost)}`;
      btn.classList.toggle('poor', h.gold < cost);
    });

    const ranking = G.players.filter(p => p.alive && p.tiles > 0).sort((a, b) => b.tiles - a.tiles);
    $('lb').innerHTML = ranking.slice(0, 10).map(p => {
      const allied = G.areAllied(p.id, h.id);
      const btn = p.isHuman || !h.alive ? '' : allied
        ? `<button data-ally="${p.id}" title="Rompre l'alliance (trahison !)">💔</button>`
        : `<button data-ally="${p.id}" title="Proposer une alliance">🤝</button>`;
      return `<li class="${p.isHuman ? 'me' : ''}${allied ? ' ally' : ''}">${this.bannerImg(p, 'lbb')}` +
        `<span class="nm">${allied ? '🤝 ' : ''}${G.isTraitor(p) ? '🗡️ ' : ''}${escapeHtml(p.name)}</span>` +
        `<span class="allies" title="${this.alliesTitle(p)}">` +
        G.allies(p.id).map(o => `<i style="background:rgb(${o.color})"></i>`).join('') + `</span>` +
        `<span class="pct">${(p.tiles / G.landCount * 100).toFixed(1)}%</span>${btn}</li>`;
    }).join('');

    this.refreshAttacks();

    if (G.phase === 'playing') {
      $('hint').textContent = this.plan ? this.planHint()
        : this.selectedBuild
        ? `Clique sur ton territoire pour construire : ${BUILDINGS[this.selectedBuild].name}${this.terrainHint()} (Échap pour annuler)`
        : UI.describeTile(Render.hover) || 'Clique sur une terre voisine pour attaquer · molette = zoom · glisser = déplacer';
    } else if (G.phase === 'over') {
      $('hint').textContent = '';
    }
  },

  // Jauge des soldats en bas de l'écran, avec le recrutement par seconde au-dessus
  refreshTroopGauge() {
    const G = Game, h = G.human, max = G.maxTroops(h), r = Math.min(1, h.troops / max);
    const eff = G.growthFactor(r) / CONFIG.TROOP_GROWTH_AT_PEAK; // 1 = recrutement au top
    const color = eff > 0.85 ? '#3f9a3a' : eff > 0.45 ? '#d99a1e' : '#b8322a';
    $('troopFill').style.width = (r * 100).toFixed(1) + '%';
    $('troopFill').style.background = color;
    $('troopPeak').style.left = CONFIG.TROOP_PEAK_RATIO * 100 + '%';
    $('troopText').textContent = `⚔️ ${fmt(h.troops)}`;
    // Pas de chiffre précis : juste l'état du recrutement
    let tip = 'recrutement normal';
    if (r >= 0.98) tip = 'armée pleine !';
    else if (eff < 0.45) tip = 'trop de soldats, le recrutement ralentit';
    else if (eff > 0.85) tip = 'recrutement au top';
    $('troopRate').innerHTML = `<b style="color:${color}">${tip}</b>`;
  },

  // Attaques en cours, en bas de l'écran. On ne reconstruit la liste que si elle change,
  // sinon les boutons "Annuler" seraient recréés pendant qu'on clique dessus.
  refreshAttacks() {
    const G = Game, h = G.human;
    const list = G.attacks.filter(a => !a.done && (a.attacker === h.id || a.target === h.id));
    const key = list.map(a => a.id + (G.cutOff(a) ? 'x' : '')).join(',');
    const box = $('attacks');
    if (key !== this.attacksKey) {
      this.attacksKey = key;
      box.innerHTML = list.map(a => {
        if (a.link !== undefined && a.attacker === h.id) {
          return `<div class="attack panel"><span>⚔️ → 🏰 ton château isolé</span><b data-troops="${a.id}"></b>` +
            `<button data-cancel="${a.id}" title="Rappeler les soldats survivants">✖ Annuler</button></div>`;
        }
        if (G.cutOff(a) && a.target === h.id) {
          // Pas de bouton « Défendre » : le château est coupé du royaume
          return `<div class="attack panel incoming" title="Ton château est coupé de ton royaume : clique dessus pour lancer un assaut qui le relie">` +
            `<span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} attaque ton château isolé 🚩</span>` +
            `<b data-troops="${a.id}"></b></div>`;
        }
        if (a.attacker === h.id) {
          const target = a.target < 0 ? 'Terres libres'
            : (a.targetCastle >= 0 ? BUILDINGS[G.building[a.targetCastle]].icon + ' ' : '') + escapeHtml(G.players[a.target].name);
          const flag = a.target >= 0 ? this.bannerImg(G.players[a.target]) : '';
          return `<div class="attack panel"><span>⚔️ → ${flag}${target}</span><b data-troops="${a.id}"></b>` +
            `<button data-cancel="${a.id}" title="Rappeler les soldats survivants">✖ Annuler</button></div>`;
        }
        return `<div class="attack panel incoming"><span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} t'attaque</span>` +
          `<b data-troops="${a.id}"></b>` +
          `<button data-defend="${a.id}" title="Envoyer le % de soldats choisi contre cet assaut">🛡️ Défendre</button></div>`;
      }).join('');
    }
    for (const a of list) {
      const el = box.querySelector(`[data-troops="${a.id}"]`);
      if (!el) continue;
      const wait = Math.ceil((a.startTick - G.tick) / CONFIG.TICKS_PER_SECOND);
      const pending = a.pending ? a.pending.reduce((s, r) => s + r.troops, 0) : 0;
      const defenders = (a.defenders || 0) + (a.garrison || 0);
      el.textContent = `⚔ ${fmt(a.troops)}` + (pending ? ` (+${fmt(pending)} en route)` : '') +
        (defenders >= 1 ? ` vs 🛡 ${fmt(defenders)}` : '') + (G.isPreparing(a) ? ` · ⏳ ${wait} s` : '');
    }
  },

  // Pendant la construction d'un moulin ou d'une caserne : production prévue selon le terrain
  terrainHint() {
    const t = this.selectedBuild;
    if (!TERRAIN_PRODUCTION[t] || !Render.mouse) return '';
    const a = Render.anchorAt(Render.mouse.x, Render.mouse.y, t);
    return a < 0 ? '' : ` · production ici : ${prodText(Game.terrainFactor(a, t))}`;
  },

  // Envoyer des soldats (selon le curseur « Envoyer ») contre un assaut ennemi
  defend(attackId) {
    const G = Game, h = G.human;
    // Château isolé : les défenseurs ne peuvent pas le rejoindre
    const target = G.attacks.find(x => x.id === attackId && !x.done);
    if (target && G.cutOff(target)) {
      return this.log('🚫 Ton château est coupé de ton royaume : tes défenseurs ne peuvent pas le rejoindre. ' +
        'Clique sur le château pour lancer un assaut qui le relie à ton royaume.', 'warn');
    }
    const a = G.sendDefenders(h.id, attackId, h.troops * this.ratio);
    if (a) this.log(`🛡️ Tes défenseurs partent contrer l'assaut de ${G.players[a.attacker].name} !`, 'good');
    else this.log('Pas assez de soldats pour défendre !', 'warn');
  },

  // Assaut (selon le curseur « Envoyer ») pour relier un château isolé à son royaume
  link(c) {
    const G = Game, h = G.human;
    const err = G.launchLink(h.id, c, h.troops * this.ratio);
    if (err) this.log(err, 'warn');
  },

  // --- Préparer un assaut avec des points de passage ---
  // 1er clic sur un château (ou une église) ennemi : on choisit la cible.
  // Clics sur ses terres : points de passage (l'armée passe par chacun, dans l'ordre ; recliquer dessus l'enlève).
  // 2 clics d'affilée sur la cible : l'assaut part. (3 clics sur la cible = tout droit)
  startPlan(target, c) {
    const G = Game, h = G.human;
    if (!G.castlePath(h.id, c)) {
      return this.log(`Impossible d'atteindre ${G.building[c] === B_CHURCH ? 'cette église' : 'ce château'} : ` +
        'des fortifications bloquent le passage. Prends d\'abord les châteaux de la frontière.', 'warn');
    }
    this.plan = { target, castle: c, waypoints: [], clicks: 0 };
  },

  cancelPlan() { this.plan = null; },

  planHint() {
    const G = Game, p = this.plan, b = BUILDINGS[G.building[p.castle]];
    if (p.clicks >= 1) return `🎯 Clique encore une fois sur la cible pour lancer l'assaut ! (Échap pour annuler)`;
    return `🎯 Assaut sur ${b.icon} ${G.players[p.target].name} : clique sur ses terres pour ajouter des points de passage` +
      ` (${p.waypoints.length}), puis 2 fois sur la cible pour lancer · Échap pour annuler`;
  },

  planClick(i) {
    const G = Game, h = G.human, p = this.plan;
    if (G.owner[p.castle] !== p.target || !G.building[p.castle]) {
      this.cancelPlan();
      return this.log('La cible a changé de mains : assaut annulé.', 'warn');
    }
    // Clic sur la cible : au 2e clic d'affilée, l'assaut part
    if (G.anchor[i] === p.castle) {
      if (++p.clicks < 2) return;
      this.cancelPlan();
      const err = G.launchAttack(h.id, p.target, h.troops * this.ratio, p.castle, p.waypoints);
      if (err) this.log(err, 'warn');
      return;
    }
    p.clicks = 0;
    // Recliquer sur un point de passage l'enlève
    const k = p.waypoints.indexOf(i);
    if (k >= 0) { p.waypoints.splice(k, 1); return; }
    if (!G.castlePassable(p.castle)(i)) {
      return this.log(`Point de passage impossible : choisis une terre ${G.deName(G.players[p.target].name)}, ` +
        'hors de la muraille de ses autres châteaux.', 'warn');
    }
    if (p.waypoints.length >= MAX_WAYPOINTS) return this.log(`${MAX_WAYPOINTS} points de passage au maximum.`, 'warn');
    const wp = p.waypoints.concat([i]);
    if (!G.castlePath(h.id, p.castle, wp)) return this.log('L\'armée ne peut pas passer par là.', 'warn');
    p.waypoints = wp;
  },

  onMapClick(sx, sy) {
    const G = Game, i = Render.tileAt(sx, sy);
    if (i < 0) return;
    if (G.phase === 'spawn') {
      if (!G.isLand(i)) return this.log('Choisis une terre, pas la mer !', 'warn');
      G.startGame(i);
      this.log('👑 Ta capitale est fondée ! Clique sur les terres voisines pour t\'étendre.', 'good');
      return;
    }
    if (G.phase !== 'playing' || !G.human.alive) return;
    const h = G.human;
    // Clic sur la bannière d'un assaut contre soi : on envoie des défenseurs
    const banner = Render.bannerAt(sx, sy);
    const assault = banner >= 0 ? G.attacks.find(a => a.id === banner && !a.done) : null;
    if (assault && assault.target === h.id) return this.defend(banner);
    if (this.plan) return this.planClick(i);
    // Clic sur un de ses bâtiments à niveaux (château, moulin) : proposer l'amélioration
    const t = G.building[i];
    // Clic sur un de ses châteaux isolés : assaut pour le relier au royaume
    if (t === B_CASTLE && G.owner[i] === h.id && !this.selectedBuild && G.isIsolatedCastle(G.anchor[i])) {
      return this.link(G.anchor[i]);
    }
    if (BUILDING_LEVELS[t] && G.owner[i] === h.id && (!this.selectedBuild || this.selectedBuild === t)) {
      this.selectBuild(0);
      this.showUpgrade(G.anchor[i]);
      return;
    }
    if (this.selectedBuild) {
      const err = G.tryBuild(h, Render.anchorAt(sx, sy, this.selectedBuild), this.selectedBuild);
      if (err) this.log(err, 'warn');
      else this.selectBuild(0);
      return;
    }
    if (!G.isLand(i) || G.owner[i] === h.id) return;
    const target = G.owner[i];
    // Château (ou église) ennemi sans assaut en cours : on prépare l'itinéraire avant de lancer
    const b = G.building[i], c = G.anchor[i];
    const aimed = target >= 0 && (b === B_CASTLE || b === B_CHURCH) && G.isProtected(target);
    const running = aimed && G.attacks.some(a => !a.done && a.attacker === h.id && a.targetCastle === c);
    const attack = () => {
      if (aimed && !running) return this.startPlan(target, c);
      const err = G.launchAttack(h.id, target, h.troops * this.ratio, i);
      if (err) this.log(err, 'warn');
    };
    // Attaquer un allié = le trahir (après confirmation)
    if (target >= 0 && G.areAllied(h.id, target)) {
      this.confirmBetrayal(G.players[target], () => { G.breakAlliance(h.id, target); attack(); });
      return;
    }
    attack();
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Souris et tactile : clic, glisser pour déplacer, molette/pincement pour zoomer ---
function setupInput(canvas) {
  const pointers = new Map();
  let drag = null, dragging = false, pinchDist = null;

  canvas.addEventListener('contextmenu', e => { e.preventDefault(); UI.selectBuild(0); UI.cancelPlan(); });

  canvas.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, camX: Render.cam.x, camY: Render.cam.y };
      dragging = false;
    } else {
      dragging = true;
      pinchDist = null;
    }
  });

  canvas.addEventListener('pointermove', e => {
    Render.hover = Render.tileAt(e.clientX, e.clientY);
    Render.mouse = { x: e.clientX, y: e.clientY };
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragging = true;
      if (dragging) {
        Render.cam.x = drag.camX - dx / Render.cam.scale;
        Render.cam.y = drag.camY - dy / Render.cam.scale;
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) Render.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinchDist);
      pinchDist = dist;
    }
  });

  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    if (pointers.size === 1 && !dragging) UI.onMapClick(e.clientX, e.clientY);
    pointers.delete(e.pointerId);
    pinchDist = null;
    if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { x: p.x, y: p.y, camX: Render.cam.x, camY: Render.cam.y };
    } else if (pointers.size === 0) {
      drag = null;
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    Render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
}

// --- Boucle d'animation ---
function main() {
  const canvas = $('map');
  Render.init(canvas);
  UI.init();
  setupInput(canvas);

  const step = 1000 / CONFIG.TICKS_PER_SECOND;
  let last = performance.now(), acc = 0, uiTimer = 0;
  function frame(now) {
    const dt = Math.min(now - last, 1000);
    last = now;
    if (Game.phase === 'playing' && !Game.paused) {
      acc += dt;
      while (acc >= step) { Game.update(); acc -= step; }
    }
    Render.flush();
    Render.draw();
    uiTimer += dt;
    if (uiTimer > 200) { uiTimer = 0; UI.refresh(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();

// Un bonus en pourcentage : 0.3 → "+30 %", -0.1 → "-10 %"
function pct(x) {
  const n = Math.round(x * 100);
  return (n >= 0 ? '+' : '') + n + ' %';
}

// Multiplicateur de production du terrain, en mots : 1.3 → "+30 %", 1 → "normale"
function prodText(f) {
  return Math.abs(f - 1) < 0.005 ? 'normale' : pct(f - 1);
}
