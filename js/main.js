// 🕹️ INTERFACE ET CONTRÔLES
// Menus, boutons, souris/tactile et boucle d'animation.

const $ = id => document.getElementById(id);

// Petites icônes dessinées pour les menus (voir icons.js) : un style médiéval, pas des emojis
const ICONS = { up: iconSVG('up'), ship: iconSVG('ship'), anchor: iconSVG('anchor'), wall: iconSVG('wall') };

const UI = {
  selectedBuild: 0,
  ratio: 0.3,
  // Assaut choisi par le joueur, en attente de validation : { target, castle, tile, source }
  // (1er clic sur la cible : on la choisit ; 2e clic sur la même cible : l'assaut part)
  plan: null,

  init() {
    $('ratio').addEventListener('input', e => { this.ratio = e.target.value / 100; this.refresh(); });

    const builds = $('builds');
    for (let t = 1; t < BUILDINGS.length; t++) {
      const b = BUILDINGS[t];
      if (b.hidden) continue; // l'avant-poste ne se construit pas
      const btn = document.createElement('button');
      btn.className = 'build';
      btn.dataset.type = t;
      btn.title = `${b.name} : ${b.desc} (touche ${t})`;
      btn.innerHTML = `<span class="key">${t}</span><span class="icon">${b.icon}</span>` +
        `<span>${b.name}</span><span class="cost"></span>` +
        (t === B_CASTLE ? '<span class="count" title="Châteaux construits / maximum (ta meilleure église en débloque d\'autres)"></span>' : '');
      btn.addEventListener('click', () => this.selectBuild(this.selectedBuild === t ? 0 : t));
      builds.appendChild(btn);
    }

    // Taille de la carte : seulement pour les cartes aléatoires (Monde et Europe ont leur propre taille)
    const sizeForType = () => { $('mapSize').disabled = ['world', 'europe'].includes($('mapType').value); };
    $('mapType').addEventListener('change', sizeForType);
    sizeForType();

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
      // (closest : le texte des boutons est remplacé par des icônes, le clic peut tomber sur l'icône)
      const def = e.target.closest('[data-defend]');
      if (def) return this.defend(+def.dataset.defend);
      // Clic sur « ton château isolé » : la caméra va le voir
      const go = e.target.closest('[data-goto]');
      if (go) {
        const c = +go.dataset.goto, half = Game.sizeOf(Game.building[c]) / 2;
        return Render.centerOn(c % Game.W + half, ((c / Game.W) | 0) + half);
      }
      // Croix d'un transport en mer : il fait demi-tour vers le port
      const rec = e.target.closest('[data-recall]');
      if (rec) {
        const boat = Game.recallExpedition(Game.human.id, +rec.dataset.recall);
        if (boat) this.log(`Ton bateau fait demi-tour vers le port : environ ${Math.round(CONFIG.RETREAT_LOSS * 100)} % des soldats à bord se perdront.`, 'warn');
        return this.refreshAttacks();
      }
      const cancel = e.target.closest('[data-cancel]');
      if (!cancel) return;
      const id = cancel.dataset.cancel;
      const a = Game.cancelAttack(Game.human.id, +id);
      if (a && a.calledBack) this.log('↩️ Ton armée n\'avait pas encore quitté tes terres : elle rentre tout de suite, sans perte.', 'good');
      else if (a) this.log(`🏳️ Retraite ordonnée : tes soldats décrochent en ${CONFIG.RETREAT_TIME} s, et environ ${Math.round(CONFIG.RETREAT_LOSS * 100)} % se perdront.`, 'warn');
      this.refreshAttacks();
    });

    // pointerdown plutôt que click : le classement est redessiné souvent
    $('lb').addEventListener('pointerdown', e => {
      const btn = e.target.closest('button[data-ally]');
      if (btn) return this.onAllyButton(+btn.dataset.ally);
      // Clic sur le nom d'un royaume qui nous attaque (en rouge) : la caméra va voir son attaque
      const li = e.target.closest('li.attacker');
      if (li) this.showAttackBy(+li.dataset.pid);
    });

    window.addEventListener('keydown', e => {
      if (Game.phase !== 'playing' || e.target.tagName === 'INPUT') return;
      // Touche 1, 2 ou 3 : le bâtiment suit la souris, un clic le pose (même touche = annuler)
      // On regarde la touche physique (e.code) : sur un clavier AZERTY, la touche « 1 » du haut
      // donne « & » sans Maj, « 2 » donne « é », « 3 » donne « " ». Le pavé numérique marche aussi.
      const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
      const n = m ? +m[2] : 0;
      if (n >= 1 && n < BUILDINGS.length && !BUILDINGS[n].hidden) {
        this.selectBuild(this.selectedBuild === n ? 0 : n);
      }
      if (e.key === 'Escape') { this.selectBuild(0); this.cancelPlan(); this.cancelWall(); this.closeBuildingMenus(); this.freeArm = 0; }
      if (e.key === 'p' || e.key === 'P') this.togglePause();
    });
    // Les emojis de la page deviennent des icônes médiévales dessinées (voir icons.js)
    Icons.watch();
  },

  start() {
    Game.init({
      name: $('name').value.trim() || 'Mon Royaume',
      banner: this.banner,
      difficulty: $('difficulty').value,
      opponents: +$('opponents').value,
      mapType: $('mapType').value,
      mapSize: $('mapSize').value,
      pacts: $('pacts').value === 'oui',
    });
    $('kBanner').src = BANNERS[this.banner].img;
    Render.setupMap();
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('hint').textContent = '👑 Les royaumes rivaux sont déjà installés : clique sur une terre libre pour fonder ta capitale';
  },

  selectBuild(t) {
    if (t) { this.cancelPlan(); this.cancelWall(); }
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

  // Barre de résumé (fixe, juste sous la barre du haut) quand on survole un autre royaume : ses soldats, ses bâtiments
  // (le nombre de chaque type, quel que soit le niveau) et la part des terres qu'il possède
  refreshKingdomTip() {
    const G = Game, h = G.human, i = Render.hover, m = Render.mouse;
    let tip = $('kTip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'kTip';
      tip.className = 'panel kTip hidden';
      document.body.appendChild(tip);
    }
    const o = i >= 0 && m && (G.phase === 'playing' || G.phase === 'spawn') && !this.selectedBuild ? G.owner[i] : -1;
    if (o < 0 || !h || o === h.id) { tip.classList.add('hidden'); this.tipFor = -1; return; }
    const p = G.players[o];
    const types = [B_CASTLE, B_CHURCH, B_PORT, B_MILL, B_BARRACKS, B_OUTPOST];
    const html = `${this.bannerImg(p)}<b>${escapeHtml(p.name)}</b>${G.areAllied(o, h.id) ? ' 🤝' : ''}` +
      ` · <span title="Soldats">👥 ${fmt(p.troops)}</span>` +
      types.filter(t => p.bCount[t] > 0).map(t => ` · <span title="${BUILDINGS[t].name}">${BUILDINGS[t].icon} ${p.bCount[t]}</span>`).join('') +
      ` · <span title="Part des terres">🗺️ ${(p.tiles / G.landCount * 100).toFixed(1)} %</span>` +
      ` · <span title="Croyance">✝️ ${fmt(Math.round(G.faithOf(o)))}</span>`;
    // (on compare avec le dernier texte écrit : innerHTML, lui, a déjà vu ses emojis remplacés par des icônes)
    if (this.tipHtml !== html) { this.tipHtml = html; tip.innerHTML = html; }
    // toujours au même endroit : centrée juste sous la barre de nos infos, en haut de l'écran
    const bar = $('topbar').getBoundingClientRect();
    tip.style.left = (bar.left + bar.width / 2) + 'px';
    tip.style.top = (bar.bottom + 6) + 'px';
    tip.classList.remove('hidden');
  },

  // ✝️ Croyance face à un voisin ennemi, dans le classement : une bible verte si on convertit ses terres,
  // rouge si c'est lui qui convertit les nôtres (rien sinon)
  faithBadge(p) {
    const G = Game, h = G.human;
    if (p.isHuman || !h.alive) return '<span class="faithB"></span>';
    const mine = Math.round(G.faithOf(h.id)), theirs = Math.round(G.faithOf(p.id));
    const win = G.faithEdge(h.id, p.id) > 0, lose = G.faithEdge(p.id, h.id) > 0;
    if (!win && !lose) return '<span class="faithB"></span>';
    const title = `Croyance : toi ${mine}, ${p.name} ${theirs} : ` +
      (win ? 'tes prêcheurs convertissent peu à peu ses terres' : 'ses prêcheurs convertissent peu à peu tes terres (bâtis ou améliore des églises !)');
    return `<span class="faithB ${win ? 'good' : 'bad'}" title="${escapeHtml(title)}">📖</span>`;
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
    if (type === B_PORT) {
      return `or toutes les ${CONFIG.PRODUCTION_INTERVAL} s` +
        (info.boatSpeed ? `, expéditions maritimes${info.landingCost < 1 ? ' moins chères et plus rapides' : ''}` : '') +
        (info.slots ? `, ${info.slots} ${info.slots > 1 ? 'moulins ou casernes' : 'moulin ou caserne'} autour de lui` : '') +
        (info.garrison ? ', petite garnison' : '') + (info.bonus ? `, petite muraille (défense ${pct(info.bonus)})` : '');
    }
    if (type === B_CASTLE) {
      const road = info.road === 'paved' ? 'routes pavées' : 'chemins de terre';
      return `défense des murs ${pct(info.bonus)}` +
        (info.road ? `, ${road} : production des bâtiments reliés ${pct(info.roadBonus)}` : '');
    }
    if (type === B_CHURCH) {
      return `Croyance +${info.faith} (+${CONFIG.FAITH_ROAD_BONUS * 100} % si reliée à une route), ` +
        `${info.slots} ${info.slots > 1 ? 'moulins ou casernes' : 'moulin ou caserne'} autour d'elle` +
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
    if (type === B_PORT) {
      return `or produit ${pct(next.gold / cur.gold - 1)}, ${next.slots} ${next.slots > 1 ? 'moulins ou casernes' : 'moulin ou caserne'} ` +
        'autour de lui, ' + (cur.boatSpeed
        ? `débarquements ${pct(next.landingCost / cur.landingCost - 1)} moins chers, bateaux ${pct(next.boatSpeed / cur.boatSpeed - 1)} plus rapides` +
          (next.garrison ? `, et une petite garnison et une petite muraille (défense ${pct(next.bonus)}) pour le défendre` : '')
        : 'débloque les expéditions maritimes (clic droit sur une côte → ⛵ Débarquer)');
    }
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
      return `Croyance +${next.faith} (au lieu de +${cur.faith}), zone plus grande, ${next.slots} moulins ou casernes autour d'elle (au lieu de ${cur.slots}), ` +
        `${next.castles} château${next.castles > 1 ? 'x' : ''} de plus à construire dans le royaume ` +
        '(seule ta meilleure église compte pour les châteaux)';
    }
    if (type === B_BARRACKS) {
      return `soldats produits ${pct(next.troops / cur.troops - 1)}, bonus d'armée max ${pct(next.maxTroops / cur.maxTroops - 1)}, ` +
        `et tous les soldats du royaume ${pct(next.power - 1)} plus forts au combat (la meilleure caserne compte, ça ne s'additionne pas)`;
    }
    return `or produit ${pct(next.gold / cur.gold - 1)}`;
  },

  // Fenêtre explicative d'un de ses bâtiments (en haut à gauche) : ce qu'apporterait son amélioration
  showUpgrade(a) {
    const G = Game, type = G.building[a], icon = BUILDINGS[type].icon;
    if (this.upgradeBox) this.upgradeBox.remove();
    const el = document.createElement('div');
    this.upgradeBox = el;
    el.buildingAnchor = a;
    el.className = 'msg request upgrade';
    const cur = G.buildingInfo(a), cost = G.upgradeCost(a);
    const close = () => { el.remove(); if (this.upgradeBox === el) this.upgradeBox = null; };
    if (cost === null) {
      el.innerHTML = `${icon} <b>${cur.name}</b> (niveau ${G.level[a]}) : déjà au maximum ! ` +
        `${this.levelEffect(type, cur)}.<div class="choices"><button data-del>🧨 Détruire (${CONFIG.DEMOLISH_TIME} s)</button><button data-no>OK</button></div>`;
    } else {
      const next = BUILDING_LEVELS[type][G.level[a] + 1];
      el.innerHTML = `${icon} <b>${cur.name}</b> (niveau ${G.level[a]}) → <b>${next.name}</b> (niveau ${G.level[a] + 1})<br>` +
        (next.img ? `<img src="${next.img}" alt="">` : '') +
        `<b>${this.upgradeEffect(type, cur, next)}</b>` +
        `<div class="choices"><button data-yes${G.human.gold >= cost ? '' : ' disabled'}>Améliorer (💰 ${fmt(cost)})</button>` +
        `<button data-del>🧨 Détruire (${CONFIG.DEMOLISH_TIME} s)</button><button data-no>Fermer</button></div>`;
      el.querySelector('[data-yes]').addEventListener('click', () => {
        const err = G.upgradeBuilding(G.human, a);
        if (err) return this.log(err, 'warn');
        close();
      });
    }
    // Ville de niveau 2 ou plus : bouton « Mur » (avant « Détruire »)
    if (type === B_CASTLE && G.level[a] >= 2) {
      const btn = document.createElement('button');
      btn.dataset.wall = '';
      el.querySelector('.choices').prepend(btn);
      this.updateWallButton(btn, a, true);
      btn.addEventListener('click', () => { close(); this.closeActionMenu(); this.startWall(a); });
    }
    // Détruire le bâtiment (DEMOLISH_TIME secondes de travaux)
    el.querySelector('[data-del]').addEventListener('click', () => {
      close();
      this.closeActionMenu();
      this.confirmDemolish(a);
    });
    el.querySelector('[data-no]').addEventListener('click', close);
    $('log').prepend(el);
    setTimeout(close, 15000);
  },

  // Menu rapide d'un de ses bâtiments (clic dessus) : deux icônes juste à côté de lui,
  // une flèche vers le haut pour l'améliorer et ✖ (rouge) pour le détruire ; l'explication s'affiche en haut à gauche.
  // Les travaux prennent du temps (UPGRADE_TIME / DEMOLISH_TIME) : une petite jauge s'affiche sur le bâtiment.
  openBuildingMenu(a, sx, sy) {
    const G = Game, h = G.human, cost = G.upgradeCost(a), work = G.works.get(a);
    this.closeActionMenu();
    this.showUpgrade(a);
    const canUp = !work && cost !== null && h.gold >= cost;
    const el = document.createElement('div');
    el.className = 'panel actionMenu quickMenu';
    el.buildingAnchor = a; // (pour le garder à jour : voir refreshBuildingMenu)
    // (la flèche est dessinée en SVG, de la couleur du texte : pas d'emoji)
    el.innerHTML = `<button data-up class="up"${canUp ? '' : ' disabled'} title="Améliorer">${ICONS.up}</button>` +
      (G.building[a] === B_CASTLE && G.level[a] >= 2 ? `<button data-wall class="wall">${ICONS.wall}</button>` : '') +
      `<button data-x class="danger" title="${work ? 'Annuler les travaux' : 'Détruire'}">✖</button>`;
    el.style.left = Math.min(sx + 14, window.innerWidth - 100) + 'px';
    el.style.top = Math.min(sy - 20, window.innerHeight - 60) + 'px';
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.querySelector('[data-up]').addEventListener('click', () => {
      this.closeActionMenu();
      const err = G.upgradeBuilding(h, a);
      if (err) this.log(err, 'warn');
      else if (this.upgradeBox) { this.upgradeBox.remove(); this.upgradeBox = null; }
    });
    const wallBtn = el.querySelector('[data-wall]');
    if (wallBtn) {
      this.updateWallButton(wallBtn, a, false);
      wallBtn.addEventListener('click', () => { this.closeBuildingMenus(); this.startWall(a); });
    }
    el.querySelector('[data-x]').addEventListener('click', () => {
      this.closeActionMenu();
      if (this.upgradeBox) { this.upgradeBox.remove(); this.upgradeBox = null; }
      if (work) return G.cancelWorks(h, a);
      this.confirmDemolish(a);
    });
    document.body.appendChild(el);
    this.actionMenu = el;
  },

  // Avant-poste : fenêtre d'info en haut à gauche + menu rapide à côté de lui, avec deux icônes :
  // une nef pour envoyer des renforts par la mer (le % du curseur « Envoyer ») et une ancre pour rapatrier
  // les soldats qui y attendent
  openOutpostMenu(a, sx, sy) {
    const G = Game, h = G.human, o = G.outposts.get(a);
    this.closeBuildingMenus();
    const stationed = o ? Math.floor(o.stationed) : 0, send = Math.floor(h.troops * this.ratio);
    const reinforce = () => {
      const err = G.reinforceOutpost(h.id, a, h.troops * this.ratio);
      if (err) this.log(err, 'warn');
      else this.log('⛵ Des renforts partent par la mer vers ton avant-poste !', 'good');
    };
    const repatriate = () => {
      const err = G.repatriate(h.id, a);
      if (err) this.log(err, 'warn');
      else this.log(`🚢 ${fmt(stationed)} soldats rembarquent vers ton port.`, 'good');
    };
    // Fenêtre d'info (en haut à gauche)
    const box = document.createElement('div');
    this.upgradeBox = box;
    box.className = 'msg request upgrade';
    box.innerHTML = `⛺ <b>Avant-poste</b> ${G.outpostReady(a) ? '' : '(en construction)'} · 🛡️ garnison ${fmt(G.garrison[a])}` +
      ` · ⚔ ${fmt(stationed)} soldats qui attendent` +
      `<div class="choices"><button data-re>${ICONS.ship} Renforts (${fmt(send)} soldats)</button>` +
      `<button data-rp${stationed < 1 ? ' disabled' : ''}>${ICONS.anchor} Rapatrier</button>` +
      `<button data-ab title="L'avant-poste disparaît (ses terres te restent) et tous ses soldats rentrent par la mer">🧨 Abandonner</button>` +
      `<button data-no>Fermer</button></div>`;
    const closeBox = () => { box.remove(); if (this.upgradeBox === box) this.upgradeBox = null; };
    box.querySelector('[data-re]').addEventListener('click', () => { this.closeBuildingMenus(); reinforce(); });
    box.querySelector('[data-rp]').addEventListener('click', () => { this.closeBuildingMenus(); repatriate(); });
    // Abandonner l'avant-poste : tous ses soldats (garnison comprise) rentrent automatiquement
    box.querySelector('[data-ab]').addEventListener('click', () => {
      this.closeBuildingMenus();
      const got = G.abandonOutpost(h.id, a);
      if (typeof got === 'string') this.log(got, 'warn');
      else this.log(`🧨 Avant-poste abandonné : ${fmt(got)} soldats rentrent ${G.homePort(h.id, o.landing) === null ? 'au royaume' : 'par la mer vers ton port'}.`, 'good');
    });
    box.querySelector('[data-no]').addEventListener('click', closeBox);
    $('log').prepend(box);
    setTimeout(closeBox, 15000);
    // Menu rapide (à côté de l'avant-poste)
    const el = document.createElement('div');
    el.className = 'panel actionMenu quickMenu';
    el.innerHTML = `<button data-re class="up" title="Renforts par la mer">${ICONS.ship}</button>` +
      `<button data-rp class="up" title="Rapatrier"${stationed < 1 ? ' disabled' : ''}>${ICONS.anchor}</button>`;
    el.style.left = Math.min(sx + 14, window.innerWidth - 100) + 'px';
    el.style.top = Math.min(sy - 20, window.innerHeight - 60) + 'px';
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.querySelector('[data-re]').addEventListener('click', () => { this.closeBuildingMenus(); reinforce(); });
    el.querySelector('[data-rp]').addEventListener('click', () => { this.closeBuildingMenus(); repatriate(); });
    document.body.appendChild(el);
    this.actionMenu = el;
  },

  // Demande confirmation avant de détruire un de ses bâtiments (en haut à gauche)
  confirmDemolish(a) {
    const G = Game, type = G.building[a];
    if (!type) return;
    if (this.demolishBox) this.demolishBox.remove();
    const el = document.createElement('div');
    this.demolishBox = el;
    el.className = 'msg request betray';
    el.innerHTML = `🧨 Détruire ${BUILDINGS[type].icon} <b>${G.buildingInfo(a) ? G.buildingInfo(a).name : BUILDINGS[type].name}</b> ? ` +
      `Les travaux prennent ${CONFIG.DEMOLISH_TIME} s, et il est perdu pour de bon.` +
      `<div class="choices"><button data-yes>Détruire</button><button data-no>Annuler</button></div>`;
    const close = () => { el.remove(); if (this.demolishBox === el) this.demolishBox = null; };
    el.querySelector('[data-yes]').addEventListener('click', () => {
      close();
      const err = G.demolishBuilding(G.human, a);
      if (err) this.log(err, 'warn');
    });
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

  // Défense globale d'un château ou d'un port fortifié (terrain + murs, traître compris), en plus (0.5 = +50 %),
  // ou null si ce n'est pas un bâtiment fortifié
  fortDefense(a) {
    const G = Game, b = G.building[a], o = G.owner[a];
    if (o < 0 || !(b === B_CASTLE || (b === B_PORT && G.buildingInfo(a).bonus))) return null;
    let def = G.tileDefense(o, a);
    if (G.isTraitor(G.players[o])) def *= CONFIG.TRAITOR_DEFENSE_MALUS;
    return def - 1;
  },

  describeTile(i) {
    if (i < 0) return '';
    const G = Game, t = TERRAIN_INFO[G.terrain[i]];
    if (G.terrain[i] === TERRAIN.GREAT_RIVER) return '🌊 Grand fleuve (infranchissable)';
    if (G.terrain[i] === TERRAIN.RIVER) return '🌊 Fleuve : neutre, personne ne peut le prendre · pour passer, clic droit sur une terre libre en face → 🛶 Traverser le fleuve';
    if (G.terrain[i] === TERRAIN.PEAK) return '🏔️ Sommet (infranchissable)';
    if (!G.isLand(i)) return '🌊 Mer';
    const o = G.owner[i];
    // Château (ou port fortifié) ennemi : juste sa défense globale, en bref
    const def = o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id) ? this.fortDefense(G.anchor[i]) : null;
    if (def !== null) {
      const b = G.building[i], info = G.buildingInfo(G.anchor[i]);
      const truce = G.truceLeft(G.anchor[i]);
      return `${BUILDINGS[b].icon} ${info.name} ${G.deName(G.players[o].name)} · 🛡️ défense globale ${pct(def)}` +
        (truce ? ` · ⏳ vient de changer de mains : inattaquable encore ${Math.ceil(truce)} s` : '');
    }
    let txt = t.cost > 1 ? `${t.name} (défense ${pct(t.cost - 1)})` : t.name;
    if (G.terrain[i] === TERRAIN.DESERT) txt = `🏜️ ${t.name} (bâtiments : production ${pct(DESERT_PRODUCTION - 1)})`;
    txt += o >= 0 ? ` · ${G.players[o].name}` : ' · Terre libre';
    if (G.wallAt[i]) txt += ' · 🧱 Mur (aucun assaut ne le franchit)';
    else if (G.walls.some(w => w.tiles.includes(i))) txt += ' · 🧱 Mur en chantier';
    if (o >= 0 && G.areAllied(o, G.human.id)) txt += ' · 🤝 allié';
    if (o >= 0 && G.isTraitor(G.players[o])) txt += ' · 🗡️ traître (défense affaiblie)';
    if (o >= 0 && !G.building[i] && G.isUnlinked(i)) {
      txt += o === G.human.id ? ' · 🚩 coupé de tous tes châteaux : tes soldats sont bloqués dans ton château isolé, ce territoire n\'est plus défendu et aucune armée ne peut en partir ! Relie-le à un château (clique sur ton château isolé) ou bâtis-en un nouveau'
        : ' · ⚠️ coupé de tous ses châteaux : clique pour l\'attaquer de front (personne ne le défend)';
    }
    const info = G.building[i] ? G.buildingInfo(G.anchor[i]) : null;
    if (info) {
      const a = G.anchor[i];
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${info.name} (niv. ${G.level[a]}, ${this.levelEffect(G.building[i], info)})`;
      if (G.building[i] === B_CASTLE) txt += ` · 🛡️ garnison ${Math.round(G.garrison[a] / info.garrison * 100)} %`;
      if (G.holdsAlone(a) && G.isIsolated(a)) {
        txt += o === G.human.id ? ' · 🚩 coupé de ton royaume (il produit toujours) : clique pour lancer un assaut qui le relie à ton royaume'
          : ' · 🚩 isolé : aucun renfort ne peut le rejoindre';
      }
      if (TERRAIN_PRODUCTION[G.building[i]]) txt += ` · terrain : ${prodText(G.terrainFactor(a, G.building[i]))}`;
      if ((G.building[i] === B_MILL || G.building[i] === B_PORT) && o >= 0) {
        const p = G.players[o], n = p.bCount[B_MILL] + p.bCount[B_PORT];
        if (n > 1) txt += ` · rendement ${Math.round(G.goldEfficiency(p) * 100)} % (${n} moulins et ports dans le royaume)`;
      }
      if (G.building[i] === B_PORT) {
        if (info.slots) txt += ` · places prises : ${G.churchUsed(a)} sur ${info.slots}`;
        txt += info.garrison ? ` · 🛡️ garnison ${Math.round(G.garrison[a] / info.garrison * 100)} %` : '';
        txt += info.bonus ? ` · 🧱 petite muraille : +${info.bonus} de défense dans sa zone (on peut l'attaquer directement)`
          : ' · ⚠️ pas de muraille : on peut l\'attaquer directement';
      }
      if (G.building[i] === B_CHURCH) {
        txt += ` · places prises : ${G.churchUsed(a)} sur ${info.slots} · ⚠️ sans défense : on peut l'attaquer directement`;
        G.roads();
        const link = G.roadChurches.get(a);
        if (link) txt += ` · 🛤️ reliée ${link.port !== undefined ? 'à la route d\'un port' : 'à une ville'} : +${CONFIG.CHURCH_ROAD_GOLD} 💰 toutes les ${CONFIG.PRODUCTION_INTERVAL} s`;
        else txt += ' · pas de chemin (ni route de port ni ville assez proche)';
      }
      const road = G.roads().get(a);
      if (road) txt += ` · ${road.onRoad ? '🛤️ au bord d\'une route' : road.road === 'paved' ? '🛣️ route pavée' : '🛤️ chemin'} : +${Math.round(road.bonus * 100)} %`;
      if (G.works.has(a)) txt += { up: ' · ⬆️ amélioration en cours', build: ' · 🏗️ en construction', down: ' · 🧨 démolition en cours' }[G.works.get(a).kind];
      else if (o === G.human.id && BUILDING_LEVELS[G.building[i]] && !(G.holdsAlone(a) && G.isIsolated(a))) txt += ` · clique pour l'améliorer ou le détruire`;
    } else if (G.building[i]) {
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${BUILDINGS[G.building[i]].name}`;
      if (G.building[i] === B_OUTPOST) {
        const a = G.anchor[i], o = G.outposts.get(a);
        txt += G.outpostReady(a) ? ` · 🛡️ ${fmt(G.garrison[a])} en garnison (fixe) · ⚔️ ${fmt(o.stationed)} stationnés (peuvent attaquer)`
          : ` · ⚔️ ${fmt(G.garrison[a])} soldats affaiblis (pas encore de garnison : ils comptent pour 1, pas 3)`;
        txt += G.outpostReady(a) ? ' · défense +100 % autour · base pour attaquer depuis la côte'
          : ` · 🏗️ en construction (${Math.ceil((o.ready - G.tick) / CONFIG.TICKS_PER_SECOND)} s) : ` +
            `ses soldats bâtissent et ne peuvent rien faire d'autre (pas d'attaque depuis lui), ` +
            `défense ${pct(-CONFIG.OUTPOST_BUILDING_MALUS)}, on peut déjà l'attaquer`;
        if (o && G.owner[a] === G.human.id) txt += ' · clique dessus pour envoyer des renforts par la mer';
        txt += ' · un château bâti ou pris dans sa zone en fait une vraie terre du royaume';
      }
    }
    if (o >= 0 && (G.castleProtects(o, i) || G.portBonus(o, i) > 0)) txt += ` · dans la muraille : défense ${pct(G.tileDefense(o, i) - 1)}`;
    // Conseils d'attaque contre un royaume ennemi
    if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id) && G.isProtected(o)) {
      const b = G.building[i];
      if (TARGET_TYPES.includes(b) && G.truceLeft(G.anchor[i])) {
        txt += ` · ⏳ vient de changer de mains : inattaquable encore ${Math.ceil(G.truceLeft(G.anchor[i]))} s`;
      } else if (TARGET_TYPES.includes(b)) {
        txt += Render.castlePreview && Render.castlePreview.path
          ? ` · 🎯 clique pour viser ${G.targetLabel(G.anchor[i])} (puis une 2e fois pour lancer l'assaut)`
          : ' · 🚫 inaccessible : des châteaux bloquent le passage';
      } else if (!G.isUnlinked(i)) { // (un morceau coupé de ses châteaux s'attaque de front : voir plus haut)
        txt += ' · 🏰 protégé : vise un de ses châteaux, églises, ports ou avant-postes';
      }
    } else if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id)) {
      txt += ' · ⚔️ plus de ville (château) : royaume désorganisé, clique pour l\'attaquer de front (ses troupes défendent, désorganisées)';
    }
    if (G.isCoastal(i) && G.landable(G.human.id, i) && G.expeditionPorts(G.human.id).length) {
      txt += ' · ⛵ côte : clic droit → Débarquer';
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
    $('faith').textContent = fmt(Math.round(G.faithOf(h.id)));
    // Durée de la partie (le temps de jeu : la pause l'arrête)
    const secs = Math.floor(G.tick / CONFIG.TICKS_PER_SECOND), hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60;
    $('clock').textContent = (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(secs % 60).padStart(2, '0');
    const traitorSecs = Math.ceil((h.traitorUntil - G.tick) / CONFIG.TICKS_PER_SECOND);
    $('traitor').classList.toggle('hidden', !G.isTraitor(h));
    $('traitor').textContent = `🗡️ Traître : défense -${Math.round((1 - CONFIG.TRAITOR_DEFENSE_MALUS) * 100)} % ` +
      `(${Math.floor(traitorSecs / 60)}:${String(traitorSecs % 60).padStart(2, '0')})`;
    $('ratioVal').textContent = `${Math.round(this.ratio * 100)} % (${fmt(h.troops * this.ratio)})`;

    document.querySelectorAll('.build').forEach(btn => {
      const cost = G.buildCost(h, +btn.dataset.type);
      btn.querySelector('.cost').textContent = `💰 ${fmt(cost)}`;
      btn.classList.toggle('poor', h.gold < cost);
      // Château : petit compteur « construits / maximum » (le maximum monte avec les églises)
      const count = btn.querySelector('.count');
      if (count) {
        const max = G.maxCastles(h);
        count.textContent = `${h.castlesBuilt}/${max}`;
        count.classList.toggle('full', h.castlesBuilt >= max);
      }
    });
    this.refreshBuildingMenu();

    const ranking = G.players.filter(p => p.alive && p.tiles > 0).sort((a, b) => b.tiles - a.tiles);
    const row = p => {
      const allied = G.areAllied(p.id, h.id);
      const btn = p.isHuman || !h.alive || !G.pactsAllowed ? '' : allied
        ? `<button data-ally="${p.id}" title="Rompre l'alliance (trahison !)">💔</button>`
        : `<button data-ally="${p.id}" title="Proposer une alliance">🤝</button>`;
      // Un royaume qui nous attaque (ou prépare un assaut contre nous) : son nom clignote en rouge
      const attacking = !p.isHuman && G.attacks.some(a => !a.done && a.attacker === p.id && a.target === h.id);
      const blink = attacking ? (Math.floor(performance.now() / 400) % 2 ? ' attacker' : ' attacker on') : '';
      return `<li class="${p.isHuman ? 'me' : ''}${allied ? ' ally' : ''}${blink}" data-pid="${p.id}"` +
        `${attacking ? ' title="Il t\'attaque ! Clique pour voir où."' : ''}>${this.bannerImg(p, 'lbb')}` +
        `<span class="nm">${allied ? '🤝 ' : ''}${G.isTraitor(p) ? '🗡️ ' : ''}${escapeHtml(p.name)}</span>` +
        `<span class="allies" title="${this.alliesTitle(p)}">` +
        G.allies(p.id).map(o => `<i style="background:rgb(${o.color})"></i>`).join('') + `</span>` +
        `${this.faithBadge(p)}<span class="pct">${(p.tiles / G.landCount * 100).toFixed(1)}%</span>${btn}</li>`;
    };
    // Les membres d'un même pacte sont regroupés dans un cadre, avec la part des terres du pacte entier.
    // Les groupes (pactes et royaumes seuls) sont classés selon leurs terres.
    const groups = [], seen = new Map();
    for (const p of ranking) {
      if (p.pact >= 0 && seen.has(p.pact)) { seen.get(p.pact).members.push(p); continue; }
      const g = { pact: p.pact, members: [p] };
      if (p.pact >= 0) seen.set(p.pact, g);
      groups.push(g);
    }
    const tilesOf = g => g.members.reduce((s, p) => s + p.tiles, 0);
    groups.sort((a, b) => tilesOf(b) - tilesOf(a));
    $('lb').innerHTML = groups.slice(0, 10).map(g => {
      if (g.members.length < 2) return row(g.members[0]);
      const mine = g.members.includes(h);
      return `<li class="pactGroup${mine ? ' mine' : ''}"><div class="pactHead"><span>🤝 ${escapeHtml(G.pacts.get(g.pact).name)}</span>` +
        `<span class="pct">${(tilesOf(g) / G.landCount * 100).toFixed(1)}%</span></div>` +
        `<ul>${g.members.map(row).join('')}</ul></li>`;
    }).join('');

    this.refreshAttacks();

    if (G.phase === 'playing') {
      const freeArm = this.freeArm && performance.now() - this.freeArm < CONFIG.FREE_LAND_CLICK_TIME * 1000;
      $('hint').textContent = this.wallFor >= 0 ? this.wallHint() : this.plan ? this.planHint()
        : freeArm ? `🌾 Terres libres : clique encore une fois pour lancer ${fmt(G.human.troops * this.ratio)} soldats à l'attaque`
        : this.selectedBuild
        ? `Clique sur ton territoire pour construire : ${BUILDINGS[this.selectedBuild].name}${this.terrainHint()} (Échap pour annuler)`
        : UI.describeTile(Render.hover) || 'Clique sur une terre voisine pour attaquer · molette = zoom · glisser = déplacer';
    } else if (G.phase === 'over') {
      $('hint').textContent = '';
    }
  },

  // Jauge des soldats en bas de l'écran, avec le recrutement par seconde au-dessus
  refreshTroopGauge() {
    // (les soldats stationnés aux avant-postes et ceux en mer comptent aussi pour le maximum ; pas les garnisons)
    const G = Game, h = G.human, max = G.maxTroops(h), r = Math.min(1, G.armySize(h) / max);
    const eff = G.growthFactor(r) / CONFIG.TROOP_GROWTH_AT_PEAK; // 1 = recrutement au top
    const color = eff > 0.85 ? '#3f9a3a' : eff > 0.45 ? '#d99a1e' : '#b8322a';
    $('troopFill').style.width = (r * 100).toFixed(1) + '%';
    $('troopFill').style.background = color;
    const st = G.stationedOf(h), sea = G.atSeaOf(h);
    // toute l'armée sur le maximum (ex. « 150 / 300 »), puis ce qui n'est pas disponible pour attaquer
    const rest = [st >= 1 ? `⛺ ${fmt(st)} aux avant-postes` : '',
      sea >= 1 ? `⛵ ${fmt(sea)} en mer` : ''].filter(Boolean);
    $('troopText').textContent = `⚔️ ${fmt(G.armySize(h))} / ${fmt(max)}` + (rest.length ? ` · dont ${rest.join(', ')}` : '');
    // Pas de chiffre précis : juste l'état du recrutement
    let tip = 'recrutement normal';
    if (r >= 0.98) tip = 'armée pleine !';
    else if (eff < 0.45) tip = 'trop de soldats, le recrutement ralentit';
    else if (eff > 0.85) tip = 'recrutement au top';
    // Effets d'un assaut réussi (voir warFactor)
    const war = (G.postWar(h) ? ` · <span style="color:#b8322a">⚰️ après-guerre −${Math.round(G.postWar(h) * 100)} %</span>` : '') +
      (G.rallied(h) ? ` · <span style="color:#2f6b2a">🔥 galvanisé +${Math.round(G.rallied(h) * 100)} %</span>` : '') +
      // (les deux à la fois : ils s'annulent, on montre le total)
      (G.postWar(h) && G.rallied(h) ? ` · total ${signedPct(G.warFactor(h) - 1)}` : '') +
      (G.upkeepFactor(h) < 0.995 ? ` · <span style="color:#b8322a">💰 solde des troupes −${Math.round((1 - G.upkeepFactor(h)) * 100)} % d'or</span>` : '');
    $('troopRate').innerHTML = `<b style="color:${color}">${tip}</b>${war}`;
  },

  // Attaques en cours, en bas de l'écran. On ne reconstruit la liste que si elle change,
  // sinon les boutons "Annuler" seraient recréés pendant qu'on clique dessus.
  refreshAttacks() {
    const G = Game, h = G.human;
    const list = G.attacks.filter(a => !a.done && (a.attacker === h.id || a.target === h.id));
    const boats = G.expeditions.filter(e => !e.done && e.pid === h.id); // nos transports en mer
    const key = list.map(a => a.id + (G.cutOff(a) ? 'x' : '') + (a.retreatEnd !== undefined ? 'r' : '') + (G.isPreparing(a) ? 'p' : '')).join(',') +
      '|' + boats.map(e => e.id + (e.home !== undefined ? 'h' : '')).join(',');
    const box = $('attacks');
    if (key !== this.attacksKey) {
      this.attacksKey = key;
      box.innerHTML = list.map(a => {
        if (a.link !== undefined && a.attacker === h.id) {
          return `<div class="attack panel"><span class="goto" data-goto="${a.link}" title="Clique pour voir ce bâtiment isolé">⚔️ → ${G.building[a.link] === B_PORT ? '⚓ ton port isolé' : '🏰 ton château isolé'} 🔎</span><b data-troops="${a.id}"></b>` +
            (a.retreatEnd !== undefined ? '<span class="retreat">🏳️ retraite…</span></div>'
              : `${this.retreatCross('data-cancel', a.id)}</div>`);
        }
        if (G.cutOff(a) && a.target === h.id) {
          // Pas de bouton « Défendre » : le château est coupé du royaume
          const tb = a.unlinked ? -1 : G.building[a.targetCastle];
          return `<div class="attack panel incoming" title="${tb === B_OUTPOST
            ? 'Ton avant-poste ne compte que sur sa garnison : clique dessus pour envoyer des renforts par la mer'
            : a.unlinked ? 'Ce territoire est coupé de tous tes châteaux : relie-le à un château (clique sur ton château isolé) ou bâtis-en un'
            : 'Il est coupé de ton royaume : clique dessus pour lancer un assaut qui le relie'}">` +
            `<span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} attaque ` +
            `${tb === B_OUTPOST ? 'ton avant-poste ⛺' : a.unlinked ? 'ton territoire coupé 🚩' : tb === B_PORT ? 'ton port isolé 🚩'
              : tb === B_CASTLE ? 'ton château isolé 🚩' : 'ton bâtiment isolé 🚩'}</span>` +
            `<b data-troops="${a.id}"></b></div>`;
        }
        if (a.attacker === h.id) {
          const target = a.target < 0 ? 'Terres libres'
            : (a.targetCastle >= 0 && BUILDINGS[G.building[a.targetCastle]] ? BUILDINGS[G.building[a.targetCastle]].icon + ' ' : '') + escapeHtml(G.players[a.target].name);
          const flag = a.target >= 0 ? this.bannerImg(G.players[a.target]) : '';
          const from = G.sourceOfAttack(a) >= 0 ? '⛺ ' : '';
          return `<div class="attack panel"><span>${from}⚔️ → ${flag}${target}</span><b data-troops="${a.id}"></b>` +
            (a.retreatEnd !== undefined ? '<span class="retreat">🏳️ retraite…</span></div>'
              : `${this.retreatCross('data-cancel', a.id)}</div>`);
        }
        return `<div class="attack panel incoming"><span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} attaque</span>` +
          `<b data-troops="${a.id}"></b>` +
          (G.isPreparing(a) // (pas encore entrée sur nos terres : on ne peut pas encore la contrer)
            ? `<button data-defend="${a.id}" disabled title="Elle marche encore sur ses terres : tu pourras la contrer dès qu'elle entre sur les tiennes">🛡️ Défendre</button></div>`
            : `<button data-defend="${a.id}" title="Envoyer le % de soldats choisi contre cet assaut">🛡️ Défendre</button></div>`);
      }).join('') + boats.map(e => {
        // Transport en mer : débarquement, renforts vers un avant-poste, ou retour au port
        const what = e.home !== undefined ? `${ICONS.anchor} retour au port`
          : e.reinforce !== undefined ? `${ICONS.ship} → renforts pour ton avant-poste`
          : `${ICONS.ship} → débarquement` + (G.owner[e.landing] >= 0 && G.owner[e.landing] !== h.id
            ? ` chez ${this.bannerImg(G.players[G.owner[e.landing]])}${escapeHtml(G.players[G.owner[e.landing]].name)}` : '');
        return `<div class="attack panel"><span>${what}</span><b data-boat="${e.id}"></b>` +
          (e.home !== undefined ? '' : this.retreatCross('data-recall', e.id)) + '</div>';
      }).join('');
    }
    for (const e of boats) {
      const el = box.querySelector(`[data-boat="${e.id}"]`);
      if (!el) continue;
      const k = Math.min(1, (G.tick - e.start) / Math.max(1, e.arrive - e.start));
      el.textContent = `⚔ ${fmt(e.sent - (e.sent - e.troops) * k)} · ⏳ ${Math.max(0, Math.ceil((e.arrive - G.tick) / CONFIG.TICKS_PER_SECOND))} s`;
    }
    for (const a of list) {
      const el = box.querySelector(`[data-troops="${a.id}"]`);
      if (!el) continue;
      const wait = Math.ceil((a.startTick - G.tick) / CONFIG.TICKS_PER_SECOND);
      const pending = a.pending ? a.pending.reduce((s, r) => s + r.troops, 0) : 0;
      const defenders = (a.defenders || 0) + (a.garrison || 0), coming = G.defendersOnTheWay(a);
      // Assaut ennemi contre nous : juste ses soldats (la barre reste courte : « Écosse attaque · ⚔ 242 · Défendre »)
      if (a.target === h.id && a.attacker !== h.id) { el.textContent = `⚔ ${fmt(a.troops)}`; continue; }
      el.textContent = `⚔ ${fmt(a.troops)}` + (pending ? ` (+${fmt(pending)} en route)` : '') +
        (defenders >= 1 ? ` vs 🛡 ${fmt(defenders)}` : '') + (coming >= 1 ? ` (🛡 +${fmt(coming)} en route)` : '') +
        (G.isPreparing(a) ? ` · ⏳ ${wait} s` : '') +
        // (garnison du château visé : elle attend derrière sa muraille, et n'entre en jeu qu'au siège)
        (G.garrisonWaiting(a) >= 1 ? ` · 🏰 ${fmt(G.garrisonWaiting(a))} derrière les murs` : '') +
        (a.siege ? ` · 🏰 siège ${Math.max(0, Math.ceil((a.siege.end - G.tick) / CONFIG.TICKS_PER_SECOND))} s` : '') +
        (a.target === G.human.id && G.defendWait(a) > 0 ? ` · ⏳ renforts dans ${Math.ceil(G.defendWait(a))} s` : '');
    }
  },

  // Petite croix dans le coin d'une barre (assaut ou transport en mer) : retraite, avec des pertes
  retreatCross(attr, id) {
    return `<button class="x" ${attr}="${id}" title="Retraite : les soldats rentrent, ${Math.round(CONFIG.RETREAT_LOSS * 100)} % se perdent">×</button>`;
  },

  // Pendant la construction d'un moulin, d'une caserne ou d'un port : production prévue selon le terrain
  // (et, pour un port, s'il sera relié à une ville ; pour une église, si elle sera sur la route d'un port)
  terrainHint() {
    const t = this.selectedBuild, G = Game, h = G.human;
    if (!Render.mouse) return '';
    const a = Render.anchorAt(Render.mouse.x, Render.mouse.y, t);
    if (a < 0) return '';
    if (t === B_CHURCH) {
      const link = G.churchLink(h.id, a);
      return link ? ` · 🛤️ reliée ${link.port !== undefined ? 'à la route d\'un port' : 'à une ville'} par un chemin : +${CONFIG.CHURCH_ROAD_GOLD} 💰 toutes les ${CONFIG.PRODUCTION_INTERVAL} s`
        : ' · trop loin d\'une ville ou d\'une route de port : pas de chemin';
    }
    if (!TERRAIN_PRODUCTION[t]) return '';
    let txt = ` · production ici : ${prodText(G.terrainFactor(a, t))}`;
    if ((t === B_MILL || t === B_BARRACKS) && G.onRoad(h.id, a, t)) {
      txt += ` · 🛤️ au bord d'une route : +${Math.round(CONFIG.MILL_ROAD_BONUS * 100)} %`;
    }
    if (t === B_PORT) {
      txt += G.portRoadCastle(h.id, a) >= 0 ? ` · 🛤️ relié à une ville : +${Math.round(CONFIG.PORT_ROAD_BONUS * 100)} % d'or`
        : ` · aucune ville à moins de ${CONFIG.PORT_ROAD_DISTANCE} cases (pas de chemin)`;
    }
    return txt;
  },

  // La caméra va voir une attaque de pid contre nous (s'il en a plusieurs, chaque clic montre la suivante)
  showAttackBy(pid) {
    const G = Game, h = G.human;
    const list = G.attacks.filter(a => !a.done && a.attacker === pid && a.target === h.id);
    if (!list.length) return;
    this.shownAttack = this.shownAttack === undefined ? 0 : (this.shownAttack + 1) % list.length;
    const a = list[this.shownAttack];
    // en marche sur ses terres : là où est son armée ; sinon, le front de l'assaut
    const pos = G.isPreparing(a) && a.marchFrom ? G.marchPosition(a) : G.attackFront(a);
    Render.centerOn(pos.x, pos.y);
  },

  // Envoyer des soldats (selon le curseur « Envoyer ») contre un assaut ennemi
  defend(attackId) {
    const G = Game, h = G.human;
    // Château isolé ou avant-poste : les défenseurs ne peuvent pas le rejoindre
    const target = G.attacks.find(x => x.id === attackId && !x.done);
    // L'armée marche encore sur ses terres : on ne peut l'affronter qu'une fois entrée sur les nôtres
    if (target && G.isPreparing(target)) {
      return this.log(`⏳ L'armée ${G.deName(G.players[target.attacker].name)} marche encore sur ses terres : tes défenseurs ` +
        `pourront l'affronter dès qu'elle entre sur les tiennes (dans ${Math.ceil((target.startTick - G.tick) / CONFIG.TICKS_PER_SECOND)} s).`, 'warn');
    }
    if (target && G.defendWait(target) > 0) {
      return this.log(`⏳ Tes défenseurs se regroupent : prochains renforts dans ${Math.ceil(G.defendWait(target))} s.`, 'warn');
    }
    // Zone d'un avant-poste (pas encore reliée au royaume) : seuls ses soldats stationnés peuvent la défendre
    const zoneOp = target ? G.outpostZoneOf(target) : -1;
    if (target && (zoneOp >= 0 || G.cutOff(target))) {
      const op = zoneOp >= 0 ? zoneOp : target.targetCastle;
      if (G.building[op] === B_OUTPOST) {
        // Avant-poste : ses soldats stationnés peuvent le défendre (pas ceux du royaume, au-delà des mers)
        const before = G.troopsAt(h.id, op);
        const a = G.sendDefenders(h.id, attackId, before * this.ratio);
        if (a) return this.log(`🛡️ ${fmt(before - G.troopsAt(h.id, op))} soldats stationnés à ton avant-poste partent le défendre ` +
          '(seuls eux peuvent le rejoindre, au-delà des mers).', 'good');
        return this.log('🚫 Ton avant-poste est au-delà des mers : seuls ses soldats le défendent, et il n\'en a plus de libres. ' +
          'Clique sur l\'avant-poste pour lui envoyer des renforts par la mer.', 'warn');
      }
      if (target.unlinked) return this.log('🚫 Ce territoire est coupé de tous tes châteaux : personne ne peut le défendre. ' +
        'Relie-le à un château (clique sur ton château isolé) ou bâtis-en un nouveau.', 'warn');
      return this.log('🚫 Il est coupé de ton royaume : tes défenseurs ne peuvent pas le rejoindre. ' +
        'Clique dessus pour lancer un assaut qui le relie à ton royaume.', 'warn');
    }
    const before = h.troops;
    const a = G.sendDefenders(h.id, attackId, h.troops * this.ratio);
    if (a) this.log(`🛡️ ${fmt(before - h.troops)} défenseurs partent de ton château le plus proche à la rencontre de ${G.players[a.attacker].name} !`, 'good');
    else this.log('Pas assez de soldats pour défendre !', 'warn');
  },

  // Assaut (selon le curseur « Envoyer ») pour relier un château isolé à son royaume
  link(c) {
    const G = Game, h = G.human;
    const err = G.launchLink(h.id, c, h.troops * this.ratio);
    if (err) this.log(err, 'warn');
  },

  // --- Choisir la cible d'un assaut, puis valider ---
  // 1er clic sur un château, une église, un port ou un avant-poste ennemi (ou sur les terres d'un royaume sans
  // château) : on choisit la cible, son chemin s'affiche. 2e clic sur la même cible : l'assaut part.
  // c = bâtiment visé (-1 = attaque de front), tile = case cliquée
  startPlan(target, c, tile) {
    const G = Game, h = G.human;
    // (ville, église ou port qui vient d'être conquis : pas d'assaut avant la fin de la trêve)
    if (c >= 0 && G.truceLeft(c)) {
      return this.log(`⏳ ${G.targetLabel(c)[0].toUpperCase()}${G.targetLabel(c).slice(1)} vient de changer de mains : impossible de l'attaquer avant ${Math.ceil(G.truceLeft(c))} s.`, 'warn');
    }
    let source = null;
    if (c >= 0) {
      // D'où part l'armée : du royaume ou d'un avant-poste bâti (le chemin le plus court)
      let best = Infinity;
      // (le point de départ le plus proche de la cible : une ville, ou un avant-poste qui a encore des soldats)
      for (const src of G.attackSources(h.id)) {
        const path = G.castlePath(h.id, c, src);
        if (path && path.length < best) { best = path.length; source = src; }
      }
      if (source === null) {
        return this.log(`Impossible d'atteindre ${G.targetLabel(c)} : ` +
          'des fortifications bloquent le passage. Prends d\'abord les châteaux de la frontière.', 'warn');
      }
    } else source = G.bestSource(h.id, target, tile);
    this.plan = { target, castle: c, tile, source };
  },

  cancelPlan() { this.plan = null; },

  planHint() {
    const G = Game, p = this.plan, b = p.castle >= 0 ? BUILDINGS[G.building[p.castle]] : null;
    const def = p.castle >= 0 ? this.fortDefense(p.castle) : null;
    return `🎯 Assaut sur ${b ? b.icon + ' ' : ''}${G.players[p.target].name} avec ${fmt(G.troopsAt(G.human.id, p.source) * this.ratio)} soldats` +
      (def !== null ? ` · 🛡️ défense globale ${pct(def)}` : '') +
      ' : clique encore une fois sur la cible pour lancer · Échap pour annuler';
  },

  // Clic pendant qu'une cible est choisie. Renvoie true si le clic a servi (assaut lancé) ;
  // sinon la cible est oubliée et le clic fait son effet habituel (choisir une autre cible…).
  planClick(i) {
    const G = Game, h = G.human, p = this.plan;
    this.cancelPlan();
    if (!G.players[p.target].alive) return false;
    const same = p.castle >= 0 ? G.anchor[i] === p.castle && G.owner[p.castle] === p.target : G.owner[i] === p.target;
    if (!same) return false;
    // (l'avant-poste choisi s'est vidé entre les deux clics : l'assaut part de la ville)
    const src = p.source >= 0 && G.troopsAt(h.id, p.source) < 1 ? -1 : p.source;
    const err = G.launchAttack(h.id, p.target, G.troopsAt(h.id, src) * this.ratio, p.castle >= 0 ? p.castle : i, src);
    if (err) this.log(err, 'warn');
    return true;
  },

  // --- Menu d'actions (clic droit sur la carte) : attaquer, construire, débarquer ---
  openActionMenu(sx, sy) {
    const G = Game, h = G.human, i = Render.tileAt(sx, sy);
    this.closeActionMenu();
    if (G.phase !== 'playing' || !h.alive || i < 0) return;
    const items = [];
    const own = G.owner[i] === h.id;
    // (choisir « Attaquer » dans le menu vaut le double clic des terres libres)
    if (G.isLand(i) && !own) items.push({ label: '⚔️ Attaquer', run: () => { this.freeArm = performance.now(); this.onMapClick(sx, sy); } });
    // Sur un royaume ennemi : lui proposer une alliance (ou, s'il est allié, rompre le pacte)
    const o = G.owner[i];
    if (o >= 0 && !own && G.players[o].alive && G.pactsAllowed) {
      const name = escapeHtml(G.players[o].name);
      if (G.areAllied(h.id, o)) {
        const n = Math.floor(h.troops * this.ratio);
        items.push({ label: `🎁 Envoyer ${fmt(n)} soldats à ${name} (il en recevra ${fmt(n * CONFIG.ALLY_GIFT_RATIO)})`, run: () => {
          const got = G.sendTroopsToAlly(h.id, o, n);
          if (typeof got === 'string') this.log(got, 'warn');
          else this.log(`🎁 ${fmt(got)} soldats arrivent chez ${G.players[o].name} (${Math.round((1 - CONFIG.ALLY_GIFT_RATIO) * 100)} % se sont perdus en route).`, 'good', G.players[o]);
        } });
        // L'allié se fait attaquer : on peut envoyer une armée l'aider à se défendre
        const n2 = Math.floor(h.troops * this.ratio);
        for (const a of G.attacks) {
          if (a.done || a.target !== o || a.attacker === h.id || G.cutOff(a) || G.isPreparing(a)) continue;
          items.push({ label: `🛡️ Aider ${name} contre ${escapeHtml(G.players[a.attacker].name)} avec ${fmt(n2)} soldats (arrivée en ${CONFIG.REINFORCE_DELAY} s)`, run: () => {
            const err = G.helpAlly(h.id, a.id, n2);
            if (err) this.log(err, 'warn');
            else this.log(`🛡️ ${fmt(n2)} soldats partent aider ${G.players[o].name} !`, 'good', G.players[o]);
          } });
        }
        items.push({ label: `💔 Rompre l'alliance avec ${name}`, run: () => this.onAllyButton(o) });
      } else {
        items.push({ label: `🤝 Proposer une alliance à ${name}`, run: () => this.onAllyButton(o) });
      }
    }
    // Son avant-poste : rapatrier les soldats qui y attendent vers le port le plus proche
    if (own && G.building[i] === B_OUTPOST) {
      const op = G.anchor[i], o = G.outposts.get(op), n = o ? Math.floor(o.stationed) : 0;
      if (n < 1) items.push({ label: `${ICONS.anchor} Rapatrier`, disabled: 'Aucun soldat n\'attend ici (la garnison, elle, reste sur place).' });
      else items.push({ label: `${ICONS.anchor} Rapatrier ${fmt(n)} soldats (vers ton port le plus proche)`, run: () => {
        const err = G.repatriate(h.id, op);
        if (err) this.log(err, 'warn');
        else this.log(`🚢 ${fmt(n)} soldats rembarquent vers ton port.`, 'good');
      } });
    }
    if (own) {
      for (let t = 1; t < BUILDINGS.length; t++) {
        const b = BUILDINGS[t];
        if (b.hidden) continue;
        items.push({ label: `🏗️ ${b.icon} ${b.name} (💰 ${fmt(G.buildCost(h, t))})`, run: () => {
          const err = G.tryBuild(h, Render.anchorAt(sx, sy, t), t);
          if (err) this.log(err, 'warn');
        } });
      }
    }
    // Terre libre de l'autre côté d'un fleuve : la traverser à gué
    if (G.owner[i] === -1 && G.isLand(i) && G.terrain[i] !== TERRAIN.RIVER) {
      const plan = G.planCrossing(h.id, i);
      if (!plan.error) {
        items.push({ label: `🛶 Traverser le fleuve (${Math.round(plan.time)} s de traversée, sans perdre de soldats)`, run: () => {
          const err = G.launchCrossing(h.id, i);
          if (err) this.log(err, 'warn');
          else this.log('🛶 Tes soldats passent le fleuve à gué : c\'est long, mais ça ne coûte aucun soldat !', 'good');
        } });
      }
    }
    // Attaque navale : sur la côte cliquée, ou la plus proche (on peut cliquer dans l'eau tout près)
    const coast = G.nearestCoast(h.id, i);
    if (coast >= 0) {
      const plan = G.planLanding(h.id, coast);
      const sending = Math.floor(h.troops * this.ratio);
      if (!plan.error && sending < plan.minTroops) {
        plan.error = `Il faut au moins ${plan.minTroops} soldats (pour remplir la garnison de l'avant-poste) : augmente le curseur « Envoyer ».`;
      }
      items.push(plan.error
        ? { label: `${ICONS.ship} Attaque navale`, disabled: plan.error }
        : { label: `${ICONS.ship} Attaque navale : débarquer ${fmt(h.troops * this.ratio)} soldats (💰 ${plan.cost}, ` +
            `${Math.max(1, Math.round(plan.time))} s de mer, environ ${Math.round(G.seaLoss(plan.time) * 100)} % de pertes)`, run: () => {
          const err = G.launchExpedition(h.id, coast, h.troops * this.ratio);
          if (err) this.log(err, 'warn');
          else this.log('⛵ Ton expédition prend la mer ! Ses soldats défendront l\'avant-poste qu\'elle bâtira à l\'arrivée.', 'good');
        } });
    }
    if (!items.length) return;
    const el = document.createElement('div');
    el.className = 'panel actionMenu';
    el.innerHTML = items.map((it, k) =>
      `<button data-k="${k}"${it.disabled ? ` disabled title="${escapeHtml(it.disabled)}"` : ''}>${it.label}</button>` +
      (it.disabled ? `<small>${escapeHtml(it.disabled)}</small>` : '')).join('');
    el.style.left = Math.min(sx, window.innerWidth - 260) + 'px';
    el.style.top = Math.min(sy, window.innerHeight - 40 * items.length - 20) + 'px';
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('click', e => {
      const btn = e.target.closest('button[data-k]');
      if (!btn || btn.disabled) return;
      this.closeActionMenu();
      items[+btn.dataset.k].run();
    });
    document.body.appendChild(el);
    this.actionMenu = el;
  },

  // Le menu rapide et la fenêtre d'un bâtiment restent à jour pendant qu'ils sont ouverts :
  // le bouton « Améliorer » se débloque tout seul dès qu'on a assez d'or (et se bloque pendant des travaux)
  refreshBuildingMenu() {
    const G = Game, h = G.human;
    for (const [box, sel] of [[this.actionMenu, '[data-up]'], [this.upgradeBox, '[data-yes]']]) {
      if (!box || box.buildingAnchor === undefined) continue;
      const a = box.buildingAnchor, btn = box.querySelector(sel);
      if (!btn) continue;
      const cost = G.upgradeCost(a);
      btn.disabled = !(G.owner[a] === h.id && !G.works.get(a) && cost !== null && h.gold >= cost);
      btn.title = cost === null ? 'Déjà au niveau maximum'
        : h.gold >= cost ? `Améliorer (💰 ${fmt(cost)})` : `Pas assez d'or : il faut 💰 ${fmt(cost)}`;
    }
    for (const [box, text] of [[this.actionMenu, false], [this.upgradeBox, true]]) {
      const btn = box && box.buildingAnchor !== undefined && box.querySelector('[data-wall]');
      if (btn) this.updateWallButton(btn, box.buildingAnchor, text);
    }
  },

  // --- Murs d'une ville (château de niveau 2 ou plus) ---
  // Bouton « Mur » : actif s'il reste un mur à bâtir, sans travaux en cours, et avec assez d'or.
  // text = bouton de la fenêtre d'info (avec son texte), sinon petit bouton du menu rapide (juste l'icône)
  updateWallButton(btn, a, text) {
    const G = Game, h = G.human, n = G.wallsOf(a).length, max = G.wallMax(a);
    const cost = n < max ? G.wallCost(a) : null;
    const why = G.owner[a] !== h.id ? 'Cette ville n\'est plus à toi'
      : cost === null ? (max < 2 ? 'Cette ville a déjà son mur (une citadelle, niveau 3, peut en bâtir un second)' : 'Cette ville a déjà ses deux murs')
      : G.works.get(a) ? 'Des travaux sont en cours sur cette ville'
      : h.gold < cost ? `Pas assez d'or : il faut 💰 ${fmt(cost)}` : '';
    btn.disabled = !!why;
    btn.title = why || `Bâtir un mur (💰 ${fmt(cost)}, ${CONFIG.WALL_BUILD_TIME} s) : il ferme un passage, aucun assaut ne le franchit`;
    if (text) {
      const html = `🧱 Mur ${n}/${max}` + (cost !== null ? ` (💰 ${fmt(cost)})` : '');
      if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
    }
  },

  // Pose d'un mur : la souris montre le mur, un clic sur la carte le bâtit (Échap ou clic droit = annuler)
  startWall(c) {
    const G = Game, err = G.planWall(G.human.id, c, c).error;
    // (on vérifie juste qu'il reste un mur à bâtir : la case visée, elle, sera choisie sur la carte)
    if (err && G.wallsOf(c).length >= G.wallMax(c)) return this.log(err, 'warn');
    this.selectBuild(0);
    this.cancelPlan();
    this.wallFor = c;
    document.body.style.cursor = 'crosshair';
  },

  cancelWall() {
    if (this.wallFor === undefined || this.wallFor < 0) return;
    this.wallFor = -1;
    document.body.style.cursor = '';
  },

  wallHint() {
    const G = Game, c = this.wallFor, cost = G.wallCost(c);
    return `🧱 Mur (💰 ${fmt(cost)}, ${CONFIG.WALL_BUILD_TIME} s) : clique sur tes terres, à ${CONFIG.WALL_MAX_REACH} cases au plus de la muraille de la ville ` +
      `: le mur ira tout droit de la ville jusque-là (près d'un lac, d'un sommet, d'un fleuve ou d'un autre mur, il s'y accroche tout seul) · Échap ou clic droit pour annuler`;
  },

  closeActionMenu() {
    if (this.actionMenu) { this.actionMenu.remove(); this.actionMenu = null; }
  },

  // Ferme le menu rapide ET la fenêtre d'info du bâtiment (en haut à gauche), ouverts ensemble
  closeBuildingMenus() {
    this.closeActionMenu();
    if (this.upgradeBox) { this.upgradeBox.remove(); this.upgradeBox = null; }
  },

  onMapClick(sx, sy) {
    const G = Game, i = Render.tileAt(sx, sy);
    if (i < 0) return;
    // (terres libres : il faut deux clics de suite pour les attaquer, voir plus bas)
    const armed = this.freeArm && performance.now() - this.freeArm < CONFIG.FREE_LAND_CLICK_TIME * 1000;
    this.freeArm = 0;
    if (G.phase === 'spawn') {
      const err = G.spawnError(i);
      if (err) return this.log(err, 'warn');
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
    if (this.plan && this.planClick(i)) return;
    // Pose d'un mur : le clic choisit jusqu'où il va
    if (this.wallFor >= 0) {
      const c = this.wallFor;
      if (G.building[c] !== B_CASTLE || G.owner[c] !== h.id) { this.cancelWall(); return; }
      const cost = G.wallCost(c), err = G.buildWall(h, c, i);
      if (err) return this.log(err, 'warn');
      this.cancelWall();
      this.log(`🧱 Chantier du mur lancé (💰 ${fmt(cost)}) : il sera debout dans ${CONFIG.WALL_BUILD_TIME} s.`, 'good');
      return;
    }
    const t = G.building[i];
    // Clic sur un de ses avant-postes : sa fenêtre d'info et son menu rapide (renforts / rapatrier)
    if (t === B_OUTPOST && G.owner[i] === h.id && !this.selectedBuild) {
      return this.openOutpostMenu(G.anchor[i], sx, sy);
    }
    // Clic sur un de ses châteaux (ou ports de niveau 3) isolés : assaut pour le relier au royaume
    if (t && G.owner[i] === h.id && !this.selectedBuild && G.holdsAlone(G.anchor[i]) && G.isIsolated(G.anchor[i])) {
      return this.link(G.anchor[i]);
    }
    // Clic sur un de ses bâtiments à niveaux : son menu rapide (améliorer / détruire)
    if (BUILDING_LEVELS[t] && G.owner[i] === h.id && (!this.selectedBuild || this.selectedBuild === t)) {
      this.selectBuild(0);
      this.openBuildingMenu(G.anchor[i], sx, sy);
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
    // Terres libres : un 1er clic prépare l'attaque, un 2e clic de suite (sur des terres libres) la lance.
    // (évite de lancer des soldats par erreur, par exemple en cliquant à côté pour fermer un menu)
    if (target < 0 && !armed) { this.freeArm = performance.now(); return; }
    // Royaume ennemi : un 1er clic choisit la cible (château, église… ou ses terres s'il n'en a plus),
    // un 2e clic lance l'assaut. Assaut déjà en cours sur cette cible : on envoie tout de suite des soldats en plus.
    // Terres libres : on attaque tout de suite.
    const b = G.building[i], c = G.anchor[i];
    // (un avant-poste se vise toujours, même chez un royaume désorganisé)
    const aimed = target >= 0 && TARGET_TYPES.includes(b) && (G.isProtected(target) || b === B_OUTPOST);
    const running = target >= 0 && G.attacks.find(a => !a.done && a.attacker === h.id && a.target === target
      && a.link === undefined && a.retreatEnd === undefined && (!aimed || a.targetCastle === c));
    const attack = confirmed => {
      // (de front : un royaume sans château, ou un morceau de royaume coupé de tous ses châteaux)
      if (target >= 0 && !running && !confirmed && (aimed || !G.isProtected(target) || G.isUnlinked(i))) return this.startPlan(target, aimed ? c : -1, i);
      // L'armée part du royaume ou d'un avant-poste bâti (avec ses soldats stationnés)
      const src = running ? G.sourceOfAttack(running) : G.bestSource(h.id, target, i);
      const err = G.launchAttack(h.id, target, G.troopsAt(h.id, src) * this.ratio, i, src);
      if (err) this.log(err, 'warn');
    };
    // Attaquer un allié = le trahir (après confirmation, qui vaut validation de l'assaut)
    if (target >= 0 && G.areAllied(h.id, target)) {
      // (on vérifie d'abord qu'il y a vraiment une cible à attaquer ici : sinon on le trahirait pour rien)
      const valid = aimed ? G.attackSources(h.id).some(src => G.castlePath(h.id, c, src))
        : !G.isProtected(target) || G.isUnlinked(i);
      if (!valid) return this.log(aimed ? `Impossible d'atteindre ${G.targetLabel(c)} : des fortifications bloquent le passage.`
        : `${G.players[target].name} est protégé : vise un de ses châteaux, églises, ports ou avant-postes.`, 'warn');
      this.confirmBetrayal(G.players[target], () => { G.breakAlliance(h.id, target); attack(true); });
      return;
    }
    attack(false);
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Souris et tactile : clic, glisser pour déplacer, molette/pincement pour zoomer ---
function setupInput(canvas) {
  const pointers = new Map();
  let drag = null, dragging = false, pinchDist = null, closedMenu = false;

  // Clic droit : annule une construction ou un assaut en préparation, sinon ouvre le menu d'actions
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (UI.selectedBuild || UI.plan || UI.wallFor >= 0) { UI.selectBuild(0); UI.cancelPlan(); UI.cancelWall(); return; }
    UI.openActionMenu(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerdown', e => {
    // un clic à côté ferme le menu rapide et la fenêtre d'info du bâtiment (et ne fait rien d'autre)
    closedMenu = !!(UI.actionMenu || UI.upgradeBox);
    UI.closeBuildingMenus();
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

  // La souris quitte la carte (vers un panneau) : plus de case survolée
  canvas.addEventListener('pointerleave', () => { Render.hover = -1; UI.refreshKingdomTip(); });

  canvas.addEventListener('pointermove', e => {
    Render.hover = Render.tileAt(e.clientX, e.clientY);
    Render.mouse = { x: e.clientX, y: e.clientY };
    UI.refreshKingdomTip();
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
    if (pointers.size === 1 && !dragging && !closedMenu) UI.onMapClick(e.clientX, e.clientY);
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
    requestAnimationFrame(frame); // (demandé en premier : une erreur dans ce tour ne fige pas le jeu)
    const dt = Math.min(now - last, 1000);
    last = now;
    if (Game.phase === 'playing' && !Game.paused) {
      acc += dt;
      while (acc >= step) { Game.update(); acc -= step; }
    }
    Render.flush();
    Render.draw();
    uiTimer += dt;
    if (uiTimer > 200) { uiTimer = 0; UI.refresh(); UI.refreshKingdomTip(); }
  }
  requestAnimationFrame(frame);
}

main();

// Pourcentage avec son signe (0 → « 0 % », 0.25 → « +25 % », -0.25 → « −25 % »)
function signedPct(x) {
  const n = Math.round(x * 100);
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + ' %';
}

// Un bonus en pourcentage : 0.3 → "+30 %", -0.1 → "-10 %"
function pct(x) {
  const n = Math.round(x * 100);
  return (n >= 0 ? '+' : '') + n + ' %';
}

// Multiplicateur de production du terrain, en mots : 1.3 → "+30 %", 1 → "normale"
function prodText(f) {
  return Math.abs(f - 1) < 0.005 ? 'normale' : pct(f - 1);
}
