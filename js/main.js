// 🕹️ INTERFACE ET CONTRÔLES
// Menus, boutons, souris/tactile et boucle d'animation.

const $ = id => document.getElementById(id);

// Petites icônes dessinées pour les menus (voir icons.js) : un style médiéval, pas des emojis
const ICONS = { up: iconSVG('up'), ship: iconSVG('ship'), anchor: iconSVG('anchor'), wall: iconSVG('wall'), cross: iconSVG('cross'),
  boatIn: iconSVG('boatIn'), boatOut: iconSVG('boatOut'), cart: iconSVG('cart'), spears: iconSVG('spears'), flame: iconSVG('flame') };

const UI = {
  selectedBuild: 0,
  ratio: 0.3,
  // Assaut choisi par le joueur, en attente de validation : { target, castle, tile, source }
  // (1er clic sur la cible : on la choisit ; 2e clic sur la même cible : l'assaut part)
  plan: null,

  init() {
    // Langue du jeu (en haut à droite du menu) : en changer recharge la page (voir lang.js)
    $('langSelect').value = LANG;
    $('langSelect').addEventListener('change', function () { setLang(this.value); });
    $('ratio').addEventListener('input', e => { this.ratio = e.target.value / 100; this.refresh(); });
    // (curseur lâché : il rend la main au clavier, pour que les flèches et ZQSD déplacent de nouveau la caméra)
    $('ratio').addEventListener('change', e => e.target.blur());
    $('ratio').addEventListener('pointerup', e => e.target.blur());

    const builds = $('builds');
    for (let t = 1; t < BUILDINGS.length; t++) {
      const b = BUILDINGS[t];
      if (b.hidden) continue; // l'avant-poste ne se construit pas
      const btn = document.createElement('button');
      btn.className = 'build';
      btn.dataset.type = t;
      btn.title = tr(`${b.name} : ${b.desc} (touche ${t})`, `${b.name}: ${b.desc} (key ${t})`);
      btn.innerHTML = `<span class="key">${t}</span><span class="icon">${b.icon}</span>` +
        `<span>${b.name}</span><span class="cost"></span>` +
        (t === B_CASTLE ? `<span class="count" title="${tr('Châteaux construits / maximum (ta meilleure église en débloque d\'autres)', 'Castles built / maximum (your best church unlocks more)')}"></span>` : '');
      btn.addEventListener('click', () => this.selectBuild(this.selectedBuild === t ? 0 : t));
      builds.appendChild(btn);
    }
    // Bouton « Croisade » : il apparaît dès qu'on a une cathédrale (église de niveau 3),
    // pour lancer une croisade d'ici, sans aller cliquer sur l'église (voir refreshCrusadeBar)
    const cb = document.createElement('button');
    cb.className = 'build crusade hidden';
    cb.innerHTML = `<span class="icon">${ICONS.cross}</span><span>${tr('Croisade', 'Crusade')}</span><span class="cost"></span>`;
    cb.addEventListener('click', () => {
      const a = this.crusadeChurch();
      if (a >= 0) this.crusade(a);
    });
    builds.appendChild(cb);
    this.crusadeBar = cb;
    // Bouton « Recrutement de masse » : il apparaît dès qu'on a une grande caserne (niveau 3) (voir refreshLevyBar)
    const lb = document.createElement('button');
    lb.className = 'build crusade hidden';
    lb.innerHTML = `<span class="icon">${ICONS.spears}</span><span>${tr('Recrutement', 'Recruitment')}</span><span class="cost"></span>`;
    lb.addEventListener('click', () => {
      const a = this.bigBarracks()[0];
      if (a !== undefined) this.levy(a);
    });
    builds.appendChild(lb);
    this.levyBar = lb;
    // Bouton « Viking » : il apparaît dès qu'on a un port royal (niveau 3) : acheter un assaut viking, puis choisir
    // sa cible (voir refreshVikingBar)
    const vb = document.createElement('button');
    vb.className = 'build crusade hidden';
    vb.innerHTML = `<span class="icon">${ICONS.flame}</span><span>${tr('Viking', 'Viking')}</span><span class="cost"></span>`;
    vb.addEventListener('click', () => this.vikingButton());
    builds.appendChild(vb);
    this.vikingBar = vb;

    // Cartes dessinées avec l'éditeur (voir custommaps.js) : dans la liste des cartes. Revenu de l'éditeur avec
    // « Jouer cette carte » (index.html?carte=Nom) : elle est déjà choisie.
    const drawn = CustomMaps.all();
    $('customMaps').innerHTML = drawn.map(m =>
      `<option value="custom:${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('');
    if (!drawn.length) $('customMaps').remove();
    const wanted = new URLSearchParams(location.search).get('carte');
    if (wanted && drawn.some(m => m.name === wanted)) $('mapType').value = 'custom:' + wanted;
    // Taille de la carte : seulement pour les cartes aléatoires (Monde, Europe, Azeroth et les cartes dessinées ont leur taille)
    const sizeForType = () => {
      const t = $('mapType').value;
      $('mapSize').disabled = ['world', 'europe', 'azeroth'].includes(t) || t.startsWith('custom:');
    };
    $('mapType').addEventListener('change', sizeForType);
    sizeForType();
    // Nombre de royaumes rivaux : de MIN_OPPONENTS à un par drapeau (moins celui du joueur), et pas plus d'un pour
    // CELLS_PER_OPPONENT cases de la carte choisie (une petite carte ne peut pas en accueillir autant) ; 7 par défaut
    // (wantOpp : le nombre choisi par le joueur, retrouvé s'il repasse sur une carte assez grande)
    this.wantOpp = 7;
    $('opponents').addEventListener('change', () => { this.wantOpp = +$('opponents').value; });
    const fillOpponents = () => {
      const cur = this.wantOpp, max = this.maxOpponents();
      $('opponents').innerHTML = '';
      for (let n = CONFIG.MIN_OPPONENTS; n <= max; n++) {
        $('opponents').insertAdjacentHTML('beforeend', `<option value="${n}"${n === Math.min(cur, max) ? ' selected' : ''}>${tr(`${n} royaumes rivaux`, `${n} rival kingdoms`)}</option>`);
      }
    };
    $('mapType').addEventListener('change', fillOpponents);
    $('mapSize').addEventListener('change', fillOpponents);
    fillOpponents();

    // Choix de la bannière dans le menu (elle donne la couleur du royaume) : seulement celles de la carte choisie
    // (les écus des races de Warcraft sur la carte Azeroth, les drapeaux ailleurs) ; on retrouve le dernier choix de chaque sorte
    const lastPick = { base: BANNERS.findIndex(b => b.id === 'Dragon'), azeroth: BANNERS.findIndex(b => b.id === 'Humains') };
    const fillBanners = () => {
      // (mode « Factions » : seulement les 12 races des 3 camps)
      const races = this.factionMode() ? AZEROTH_FACTIONS.flatMap(f => f.races) : null;
      const list = bannersForMap($('mapType').value).filter(k => !races || races.includes(BANNERS[k].id));
      const set = BANNERS[list[0]].set || 'base';
      $('bannerPick').innerHTML = list.map(k =>
        `<button type="button" data-banner="${k}" title="${escapeHtml(BANNERS[k].name)}"><img src="${BANNERS[k].logo || BANNERS[k].icon}" alt="${escapeHtml(BANNERS[k].name)}"></button>`
      ).join('');
      pick(list.includes(lastPick[set]) ? lastPick[set] : list[0]);
    };
    const pick = k => {
      lastPick[BANNERS[k].set || 'base'] = k;
      // (mode « Factions » : le camp de la race choisie, et sa capitale)
      const f = this.factionMode() && AZEROTH_FACTIONS.find(f => f.races.includes(BANNERS[k].id));
      $('factionInfo').classList.toggle('hidden', !f);
      if (f) {
        // (les races du camp sont gardées par leur nom fixe, id : on affiche leur nom dans la langue du jeu)
        const others = f.races.filter(r => r !== BANNERS[k].id).map(r => BANNERS.find(b => b.id === r).name).join(', ');
        const place = AZEROTH_CAPITALS[BANNERS[k].id].place;
        $('factionInfo').textContent = tr(`⚔️ Ton camp : ${f.name} (avec ${others}) · ta capitale : ${place}. Les 3 camps s'affrontent ; un camp ne se divise jamais.`,
          `⚔️ Your faction: ${f.name} (with ${others}) · your capital: ${place}. The 3 factions fight each other; a faction never splits.`);
      }
      this.banner = k;
      document.querySelectorAll('#bannerPick button').forEach(b => b.classList.toggle('active', +b.dataset.banner === k));
      $('bannerName').textContent = BANNERS[k].name;
      $('bannerCur').src = BANNERS[k].logo || BANNERS[k].icon; // (au menu : juste le tissu, recadré sur son motif ; un écu : en entier)
    };
    // (la liste des drapeaux s'ouvre et se ferme d'un clic sur le drapeau choisi ; choisir un drapeau la referme)
    $('bannerBtn').addEventListener('click', () => $('bannerPick').classList.toggle('hidden'));
    $('bannerPick').addEventListener('click', e => {
      const btn = e.target.closest('button[data-banner]');
      if (btn) { pick(+btn.dataset.banner); $('bannerPick').classList.add('hidden'); }
    });
    // Mode de jeu (carte Azeroth seulement) : en « Factions », 12 royaumes (les 3 camps), pactes et nombre de rivaux imposés
    const modeChange = () => {
      const az = $('mapType').value === 'azeroth', fac = this.factionMode();
      $('gameModeRow').classList.toggle('hidden', !az);
      $('opponents').disabled = fac;
      $('pacts').disabled = fac;
      fillBanners();
    };
    $('mapType').addEventListener('change', modeChange);
    $('gameMode').addEventListener('change', modeChange);
    modeChange();
    $('startBtn').addEventListener('click', () => this.start());
    $('replayBtn').addEventListener('click', () => location.reload());
    $('continueBtn').addEventListener('click', () => {
      $('endscreen').classList.add('hidden');
      Game.continueAfterVictory();
      this.log(tr('⚔️ La conquête continue ! Élimine les derniers royaumes si tu le souhaites.', '⚔️ The conquest goes on! Wipe out the last kingdoms if you wish.'), 'good');
    });
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('speedBtn').addEventListener('click', () => this.nextSpeed());
    // (seul celui qui héberge la partie peut la mettre en pause ou changer sa vitesse : voir isHost)
    document.querySelectorAll('.hostOnly').forEach(b => b.classList.toggle('hidden', !this.isHost()));
    // 📜 Règles : le jeu se met en pause, et les règles complètes s'affichent (les mêmes que sur l'écran de départ)
    $('rulesBtn').addEventListener('click', () => this.openRules());
    // Souris sur ⛏️ dans la barre du haut : nos mines clignotent sur la carte (voir Render.drawFlashingMines)
    $('minesBox').addEventListener('mouseenter', () => { this.flashMines = true; });
    $('minesBox').addEventListener('mouseleave', () => { this.flashMines = false; });
    $('rulesClose').addEventListener('click', () => this.closeRules());
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
        if (boat) this.log(tr(`Ton bateau fait demi-tour vers le port : environ ${Math.round(CONFIG.RETREAT_LOSS * 100)} % des soldats à bord se perdront.`,
          `Your ship turns back to port: about ${Math.round(CONFIG.RETREAT_LOSS * 100)}% of the soldiers on board will be lost.`), 'warn');
        return this.refreshAttacks();
      }
      const cancel = e.target.closest('[data-cancel]');
      if (!cancel) return;
      const id = cancel.dataset.cancel;
      const a = Game.cancelAttack(Game.human.id, +id);
      if (a && a.calledBack) this.log(tr('↩️ Ton armée n\'avait pas encore quitté tes terres : elle rentre tout de suite, sans perte.', '↩️ Your army had not left your lands yet: it comes straight back, with no losses.'), 'good');
      else if (a) this.log(tr(`🏳️ Retraite ordonnée : tes soldats décrochent en ${CONFIG.RETREAT_TIME} s, et environ ${Math.round(CONFIG.RETREAT_LOSS * 100)} % se perdront.`,
        `🏳️ Retreat ordered: your soldiers pull back in ${CONFIG.RETREAT_TIME} s, and about ${Math.round(CONFIG.RETREAT_LOSS * 100)}% will be lost.`), 'warn');
      this.refreshAttacks();
    });

    // pointerdown plutôt que click : le classement est redessiné souvent
    $('lb').addEventListener('pointerdown', e => {
      const btn = e.target.closest('button[data-ally]');
      if (btn) return this.onAllyButton(+btn.dataset.ally);
      // Clic sur le nom d'un royaume qui nous attaque (en rouge) : la caméra va voir son attaque ;
      // sur un autre royaume : la caméra va sur ses terres (même un petit bout de territoire perdu)
      const li = e.target.closest('li.attacker');
      if (li) return this.showAttackBy(+li.dataset.pid);
      const any = e.target.closest('li[data-pid]');
      if (any) this.showKingdom(+any.dataset.pid);
    });

    // Déplacer la caméra au clavier : ZQSD (sur un clavier AZERTY ; WASD sur un QWERTY) ou les flèches.
    // On regarde la touche physique (e.code) : elle est au même endroit quel que soit le clavier.
    // Tant qu'une touche est enfoncée, la caméra glisse (voir panCamera, appelée à chaque image).
    const PAN = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
      KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
    this.panKeys = new Set();
    // Le joueur écrit-il dans un champ ? (le curseur « Envoyer » n'en est pas un : les touches restent au jeu)
    const typing = el => /SELECT|TEXTAREA/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'range');
    window.addEventListener('keydown', e => {
      if (!PAN[e.code] || Game.phase === undefined || !$('menu').classList.contains('hidden') || typing(e.target)) return;
      this.panKeys.add(e.code);
      e.preventDefault(); // (les flèches ne font pas défiler la page)
    });
    window.addEventListener('keyup', e => this.panKeys.delete(e.code));
    window.addEventListener('blur', () => this.panKeys.clear()); // (fenêtre quittée : on lâche tout)
    this.panCamera = dt => {
      if (!this.panKeys.size) return;
      let dx = 0, dy = 0;
      for (const k of this.panKeys) { dx += PAN[k][0]; dy += PAN[k][1]; }
      const move = CONFIG.CAMERA_KEY_SPEED * dt / 1000 / Render.cam.scale, n = Math.hypot(dx, dy) || 1;
      Render.cam.x += dx / n * move;
      Render.cam.y += dy / n * move;
    };

    window.addEventListener('keydown', e => {
      if (Game.phase !== 'playing' || typing(e.target)) return;
      // Touche 1, 2 ou 3 : le bâtiment suit la souris, un clic le pose (même touche = annuler)
      // On regarde la touche physique (e.code) : sur un clavier AZERTY, la touche « 1 » du haut
      // donne « & » sans Maj, « 2 » donne « é », « 3 » donne « " ». Le pavé numérique marche aussi.
      const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
      const n = m ? +m[2] : 0;
      if (n >= 1 && n < BUILDINGS.length && !BUILDINGS[n].hidden) {
        this.selectBuild(this.selectedBuild === n ? 0 : n);
      }
      if (e.key === 'Escape' && !$('rulesScreen').classList.contains('hidden')) return this.closeRules(); // (Échap ferme les règles)
      if (e.key === 'Escape') { this.selectBuild(0); this.cancelPlan(); this.cancelWall(); this.cancelTrade(); this.cancelVikingAim(); this.closeBuildingMenus(); this.freeArm = 0; }
      if (e.key === 'p' || e.key === 'P') this.togglePause();
    });
    // Les emojis de la page deviennent des icônes médiévales dessinées (voir icons.js)
    Icons.watch();
  },

  // Nombre de rivaux le plus grand possible sur la carte choisie dans le menu (voir CELLS_PER_OPPONENT)
  maxOpponents() {
    const t = $('mapType').value, C = CONFIG;
    let W, H;
    if (t === 'world') [W, H] = [C.WORLD_MAP_WIDTH, C.WORLD_MAP_HEIGHT];
    else if (t === 'europe') [W, H] = [C.EUROPE_MAP_WIDTH, C.EUROPE_MAP_HEIGHT];
    else if (t === 'azeroth') [W, H] = [C.AZEROTH_MAP_WIDTH, C.AZEROTH_MAP_HEIGHT];
    else if (t.startsWith('custom:')) {
      const m = CustomMaps.all().find(m => 'custom:' + m.name === t);
      [W, H] = m ? [m.W, m.H] : C.MAP_SIZES.moyen;
    } else [W, H] = C.MAP_SIZES[$('mapSize').value] || C.MAP_SIZES.moyen;
    const byMap = Math.floor(W * H / C.CELLS_PER_OPPONENT);
    // (et pas plus de rivaux que de bannières de cette carte, moins celle du joueur ; sur les drapeaux, que de noms de royaumes)
    const banners = bannersForMap(t), names = BANNERS[banners[0]].kingdom ? banners.length : KINGDOMS.length;
    return Math.max(C.MIN_OPPONENTS, Math.min(banners.length - 1, names, byMap));
  },

  // Le mode « Factions » est-il choisi ? (carte Azeroth seulement)
  factionMode() { return $('mapType').value === 'azeroth' && $('gameMode').value === 'factions'; },

  start() {
    Game.init({
      factions: this.factionMode(),
      name: $('name').value.trim() || tr('Mon Royaume', 'My Kingdom'),
      banner: this.banner,
      difficulty: $('difficulty').value,
      opponents: +$('opponents').value,
      mapType: $('mapType').value,
      mapSize: $('mapSize').value,
      pacts: $('pacts').value === 'oui',
    });
    $('kBanner').src = BANNERS[this.banner].icon;
    $('speedBtn').textContent = '⏩ x1'; // (chaque partie commence à vitesse normale)
    Render.setupMap();
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('hint').textContent = tr('👑 Les royaumes rivaux sont déjà installés : clique sur une terre libre pour fonder ta capitale',
      '👑 The rival kingdoms are already settled: click on free land to found your capital');
    // Mode « Factions » : chacun est déjà à sa capitale ; la partie attend en pause que le joueur se repère
    if (Game.factions) {
      const h = Game.human, place = AZEROTH_CAPITALS[BANNERS[h.banner].id].place;
      const half = Game.sizeOf(B_CASTLE) / 2;
      Render.centerOn(h.capital % Game.W + half, ((h.capital / Game.W) | 0) + half);
      $('pauseBtn').textContent = tr('▶ Reprendre', '▶ Resume');
      this.log(tr(`⚔️ Tu es à ${place}, avec ton camp : ${Game.pactName(h)}. La partie est en pause : repère-toi, puis ▶ Reprendre (ou P) pour commencer !`,
        `⚔️ You are in ${place}, with your faction: ${Game.pactName(h)}. The game is paused: get your bearings, then ▶ Resume (or P) to start!`), 'good');
    }
  },

  selectBuild(t) {
    if (t) { this.cancelPlan(); this.cancelWall(); this.cancelVikingAim(); }
    this.selectedBuild = t;
    document.querySelectorAll('.build[data-type]').forEach(b => b.classList.toggle('active', +b.dataset.type === t));
    document.body.style.cursor = t ? 'cell' : '';
  },

  // Infobulle des petits carrés d'alliés dans le classement
  alliesTitle(p) {
    const names = Game.allies(p.id).map(o => o.name);
    return escapeHtml(names.length ? tr(`${Game.pactName(p)} : avec ${names.join(', ')}`, `${Game.pactName(p)}: with ${names.join(', ')}`) : tr('Aucun pacte', 'No pact'));
  },

  openRules() {
    if (!$('rulesBody').firstChild) $('rulesBody').appendChild(document.querySelector('.rulesBox .rules.' + LANG).cloneNode(true));
    this.rulesPaused = !Game.paused; // (on ne remet le jeu en marche en fermant que si c'est nous qui l'avons arrêté)
    if (this.rulesPaused) this.togglePause();
    $('rulesScreen').classList.remove('hidden');
  },
  closeRules() {
    $('rulesScreen').classList.add('hidden');
    if (this.rulesPaused && Game.paused) this.togglePause();
    this.rulesPaused = false;
  },

  // Celui qui héberge la partie : lui seul peut la mettre en pause et changer sa vitesse.
  // (en solo, c'est toujours le joueur ; pour une future partie à plusieurs, seul l'hôte aura ces boutons)
  isHost() { return true; },

  // Vitesse suivante de la partie (x1 → x1,5 → x2 → x3 → x1)
  nextSpeed() {
    if (!this.isHost()) return;
    const S = CONFIG.GAME_SPEEDS, k = S.indexOf(Game.speed);
    Game.speed = S[(k + 1) % S.length];
    $('speedBtn').textContent = `⏩ x${LANG === 'fr' ? String(Game.speed).replace('.', ',') : Game.speed}`;
  },

  togglePause() {
    if (!this.isHost()) return;
    Game.paused = !Game.paused;
    $('pauseBtn').textContent = Game.paused ? tr('▶ Reprendre', '▶ Resume') : '⏸ Pause';
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
      ` · <span title="${tr('Soldats (épées : sans caserne ou niveau 1 · casque : caserne niveau 2 · bouclier : niveau 3)', 'Soldiers (swords: no barracks or level 1 · helmet: level 2 barracks · shield: level 3)')}">${G.troopIcon(o)} ${fmt(p.troops)}</span>` +
      types.filter(t => p.bCount[t] > 0).map(t => ` · <span title="${BUILDINGS[t].name}">${BUILDINGS[t].icon} ${p.bCount[t]}</span>`).join('') +
      this.minesText(o) +
      ` · <span title="${tr('Part des terres', 'Share of the land')}">🗺️ ${(p.tiles / G.landCount * 100).toFixed(1)}${tr(' %', '%')}</span>` +
      ` · <span title="${tr('Croyance', 'Faith')}">✝️ ${fmt(Math.round(G.faithOf(o)))}</span>`;
    // (on compare avec le dernier texte écrit : innerHTML, lui, a déjà vu ses emojis remplacés par des icônes)
    if (this.tipHtml !== html) { this.tipHtml = html; tip.innerHTML = html; }
    // toujours au même endroit : centrée juste sous la barre de nos infos, en haut de l'écran
    const bar = $('topbar').getBoundingClientRect();
    tip.style.left = (bar.left + bar.width / 2) + 'px';
    tip.style.top = (bar.bottom + 6) + 'px';
    tip.classList.remove('hidden');
  },

  // ⛏️ Les mines d'un royaume, pour la barre de résumé : « · ⛏️ 3 (⚒️ 2 🪙 1) » (rien s'il n'en a pas)
  minesText(pid) {
    const G = Game, mines = MINE_KINDS.map(k => [k, G.minesOf(pid, k).length]).filter(([, n]) => n);
    if (!mines.length) return '';
    const total = mines.reduce((s, [, n]) => s + n, 0);
    return ` · <span title="Mines">⛏️ ${total} (${mines.map(([k, n]) => `${MINES[k].icon} ${n}`).join(' ')})</span>`;
  },

  // ✝️ Croyance face à un voisin ennemi, dans le classement : une bible verte si on convertit ses terres,
  // rouge si c'est lui qui convertit les nôtres (rien sinon)
  faithBadge(p) {
    const G = Game, h = G.human;
    if (p.isHuman || !h.alive) return '<span class="faithB"></span>';
    const mine = Math.round(G.faithOf(h.id)), theirs = Math.round(G.faithOf(p.id));
    const win = G.faithEdge(h.id, p.id) > 0, lose = G.faithEdge(p.id, h.id) > 0;
    if (!win && !lose) return '<span class="faithB"></span>';
    const title = tr(`Croyance : toi ${mine}, ${p.name} ${theirs} : `, `Faith: you ${mine}, ${p.name} ${theirs}: `) +
      (win ? tr('tes prêcheurs convertissent peu à peu ses terres', 'your preachers are slowly converting their lands')
        : tr('ses prêcheurs convertissent peu à peu tes terres (bâtis ou améliore des églises !)', 'their preachers are slowly converting your lands (build or upgrade churches!)'));
    return `<span class="faithB ${win ? 'good' : 'bad'}" title="${escapeHtml(title)}">📖</span>`;
  },

  // Petite image de la bannière d'un royaume, pour les messages et les listes
  bannerImg(p, cls = 'bn') {
    return `<img class="${cls}" src="${BANNERS[p.banner].icon}" alt="" title="${escapeHtml(p.name)}">`;
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
      if (G.eternalPact(h.id)) return this.log(tr(`⚔️ ${other.name} et toi êtes du même camp (${G.pactName(h)}) : ce pacte dure toute la partie.`,
        `⚔️ ${other.name} and you are in the same faction (${G.pactName(h)}): this pact lasts the whole game.`), 'warn');
      this.confirmBetrayal(other, () => G.breakAlliance(h.id, id));
      return;
    }
    const res = G.proposeAlliance(h.id, id);
    if (res === 'refused') this.log(tr(`🚫 ${other.name} refuse ton alliance.`, `🚫 ${other.name} turns down your alliance.`), 'warn');
    else if (res !== 'accepted') this.log(res, 'warn');
  },

  // Ce que fait un bâtiment à son niveau : une liste de petits avantages (« Défense des murs +200 % »…)
  levelPerks(type, info) {
    const every = `/ ${CONFIG.PRODUCTION_INTERVAL} s`, s = n => n > 1 ? 's' : '';
    const places = n => tr(`Places : ${n} moulin${s(n)} ou caserne${s(n)}`, `Slots: ${n} mill${s(n)} or barracks`);
    if (type === B_PORT) {
      return [tr(`Or +${info.gold} ${every}`, `Gold +${info.gold} ${every}`), info.boatSpeed && tr('Expéditions maritimes', 'Naval expeditions'), info.slots && places(info.slots),
        info.garrison && tr('Petite garnison', 'Small garrison'), info.bonus && tr(`Petite muraille ${pct(info.bonus)}`, `Small walls ${pct(info.bonus)}`)].filter(Boolean);
    }
    if (type === B_CASTLE) {
      return [tr(`Défense des murs ${pct(info.bonus)}`, `Wall defense ${pct(info.bonus)}`), places(info.slots),
        info.road && tr(`${info.road === 'paved' ? 'Routes pavées' : 'Chemins'} : production ${pct(info.roadBonus)}`,
          `${info.road === 'paved' ? 'Paved roads' : 'Dirt tracks'}: production ${pct(info.roadBonus)}`),
        info.trades && tr(`Routes commerciales : ${info.trades}`, `Trade routes: ${info.trades}`),
        ...(info.imperial ? this.imperialPerks() : [])].filter(Boolean);
    }
    if (type === B_CHURCH) {
      return [tr(`Croyance +${info.faith}`, `Faith +${info.faith}`), places(info.slots), info.castles && tr(`Châteaux +${info.castles}`, `Castles +${info.castles}`)].filter(Boolean);
    }
    if (type === B_BARRACKS) {
      return [tr(`Soldats +${info.troops} ${every}`, `Soldiers +${info.troops} ${every}`), tr(`Armée max +${info.maxTroops}`, `Max army +${info.maxTroops}`),
        info.power > 1 && tr(`Force ${pct(info.power - 1)}`, `Strength ${pct(info.power - 1)}`)].filter(Boolean);
    }
    if (type === B_MINE) return this.minePerks(info);
    return [tr(`Or +${info.gold} ${every}`, `Gold +${info.gold} ${every}`)];
  },

  // Ce que fait une mine à son niveau (info : voir Game.mineInfo) ; « x2 si reliée » : une route vers une de ses villes
  minePerks(info) {
    const m = MINES[info.kind], x2 = tr(`×${CONFIG.MINE_ROAD_FACTOR} si reliée à une ville`, `×${CONFIG.MINE_ROAD_FACTOR} if linked to a city`);
    if (info.kind === 'iron') return [tr(`Force des troupes ${pct(info.power)}`, `Troop strength ${pct(info.power)}`), x2, tr(`${m.max} au plus`, `${m.max} at most`)];
    if (info.kind === 'gold') return [tr(`💰 ${m.total.toLocaleString('fr-FR')} en ${Math.round(m.time / 60)} min`, `💰 ${m.total.toLocaleString('en-US')} in ${Math.round(m.time / 60)} min`),
      x2, tr('puis le filon s\'épuise', 'then the ore vein runs out')];
    if (info.kind === 'stone') return [tr(`Prix des améliorations, murs et ponts ${pct(-info.discount)}`, `Cost of upgrades, walls and bridges ${pct(-info.discount)}`),
      x2, tr(`${m.max} au plus`, `${m.max} at most`)];
    return [tr(`💰 ${m.pay.map(fmt).join(', ')} aux 3 premiers quarts, ${fmt(m.final)} à la fin`, `💰 ${m.pay.map(fmt).join(', ')} at each of the first 3 quarters, ${fmt(m.final)} at the end`),
      tr(`Extraction : ${Math.round(m.time / 60 / info.speed)} min (×0,5 sans route)`, `Extraction: ${Math.round(m.time / 60 / info.speed)} min (×0.5 without a road)`)];
  },

  // Ce que change une amélioration (par rapport au niveau actuel) : une liste de petits avantages
  upgradePerks(type, cur, next) {
    const places = tr(`Places : ${cur.slots} → ${next.slots}`, `Slots: ${cur.slots} → ${next.slots}`);
    if (type === B_PORT) {
      return [tr(`Or ${pct(next.gold / cur.gold - 1)}`, `Gold ${pct(next.gold / cur.gold - 1)}`), next.slots && places,
        ...(cur.boatSpeed ? [tr(`Débarquements ${pct(next.landingCost / cur.landingCost - 1)}`, `Landings ${pct(next.landingCost / cur.landingCost - 1)}`),
          tr(`Bateaux ${pct(next.boatSpeed / cur.boatSpeed - 1)}`, `Ships ${pct(next.boatSpeed / cur.boatSpeed - 1)}`)]
          : [tr('Débloque les expéditions maritimes', 'Unlocks naval expeditions')]),
        next.garrison && !cur.garrison && tr('Petite garnison', 'Small garrison'), next.bonus && tr(`Petite muraille ${pct(next.bonus)}`, `Small walls ${pct(next.bonus)}`),
        PORT_LEVELS.indexOf(next) === 3 && tr('Débloque l\'assaut viking', 'Unlocks the Viking assault')].filter(Boolean);
    }
    if (type === B_CASTLE) {
      const lvl = CASTLE_LEVELS.indexOf(next), walls = n => Math.max(0, n - 1); // (murs à bâtir : voir Game.wallMax)
      return [tr('Muraille plus grande', 'Larger walls'), places, tr(`Défense des murs ${pct(next.bonus - cur.bonus)}`, `Wall defense ${pct(next.bonus - cur.bonus)}`),
        tr(`Garnison ${fmt(cur.garrison)} → ${fmt(next.garrison)}`, `Garrison ${fmt(cur.garrison)} → ${fmt(next.garrison)}`),
        walls(lvl) > walls(lvl - 1) && tr(`Murs : ${walls(lvl - 1)} → ${walls(lvl)}`, `Walls: ${walls(lvl - 1)} → ${walls(lvl)}`),
        next.road && tr(`${next.road === 'paved' ? 'Routes pavées' : 'Chemins'} : production ${pct(next.roadBonus)}`,
          `${next.road === 'paved' ? 'Paved roads' : 'Dirt tracks'}: production ${pct(next.roadBonus)}`),
        next.trades > (cur.trades || 0) && tr(`Routes commerciales : ${cur.trades || 0} → ${next.trades}`, `Trade routes: ${cur.trades || 0} → ${next.trades}`),
        ...(next.imperial ? this.imperialPerks() : [])].filter(Boolean);
    }
    if (type === B_CHURCH) {
      return [tr(`Croyance +${cur.faith} → +${next.faith}`, `Faith +${cur.faith} → +${next.faith}`), tr('Zone plus grande', 'Larger area'), places,
        tr(`Châteaux +${next.castles}`, `Castles +${next.castles}`),
        CHURCH_LEVELS.indexOf(next) === 3 && tr('Débloque les croisades', 'Unlocks crusades')].filter(Boolean);
    }
    if (type === B_BARRACKS) {
      return [tr(`Soldats ${pct(next.troops / cur.troops - 1)}`, `Soldiers ${pct(next.troops / cur.troops - 1)}`),
        tr(`Armée max ${pct(next.maxTroops / cur.maxTroops - 1)}`, `Max army ${pct(next.maxTroops / cur.maxTroops - 1)}`),
        tr(`Force ${pct(next.power - 1)}`, `Strength ${pct(next.power - 1)}`),
        BARRACKS_LEVELS.indexOf(next) === 3 && tr('Débloque le recrutement de masse', 'Unlocks mass recruitment')].filter(Boolean);
    }
    if (type === B_MINE) {
      const m = MINES[cur.kind];
      if (cur.kind === 'iron') return [tr(`Force des troupes ${pct(m.power[1])} → ${pct(m.power[2])}`, `Troop strength ${pct(m.power[1])} → ${pct(m.power[2])}`)];
      if (cur.kind === 'gold') return [tr(`Filon relancé : 💰 ${m.total.toLocaleString('fr-FR')} en ${Math.round(m.time / 60)} min de plus`,
        `Ore vein restarted: 💰 ${m.total.toLocaleString('en-US')} over ${Math.round(m.time / 60)} more min`)];
      if (cur.kind === 'stone') return [tr(`Réduction ${pct(-m.discount[1])} → ${pct(-m.discount[2])}`, `Discount ${pct(-m.discount[1])} → ${pct(-m.discount[2])}`)];
      return [tr(`Extraction ${pct(m.speed[2] / m.speed[1] - 1)} plus rapide`, `Extraction ${pct(m.speed[2] / m.speed[1] - 1)} faster`)];
    }
    return [tr(`Or ${pct(next.gold / cur.gold - 1)}`, `Gold ${pct(next.gold / cur.gold - 1)}`)];
  },

  // Le résumé d'un bâtiment (au survol) : son nom, son niveau et ce qu'il rapporte vraiment, en bref
  buildingSummary(a) {
    const G = Game, b = G.building[a], info = G.buildingInfo(a), o = G.owner[a], h = G.human;
    const every = ` / ${CONFIG.PRODUCTION_INTERVAL} s`, n1 = v => String(Math.round(v * 10) / 10);
    let txt = `${b === B_MINE && info.kind ? MINES[info.kind].icon : BUILDINGS[b].icon} ${info.name} (${tr('niv.', 'lvl')} ${G.level[a]})` +
      (o !== h.id ? tr(` ${G.deName(G.players[o].name)}`, ` · ${G.players[o].name}`) : '');
    if (b === B_MILL || b === B_PORT) txt += ` · +${n1(G.buildingOutput(a))} 💰${every}`;
    if (b === B_PORT && info.boatSpeed) txt += tr(' · ⛵ expéditions', ' · ⛵ expeditions');
    if (b === B_BARRACKS) txt += tr(` · +${n1(G.buildingOutput(a))} soldats${every}`, ` · +${n1(G.buildingOutput(a))} soldiers${every}`) +
      (info.power > 1 ? tr(` · force ${pct(info.power - 1)}`, ` · strength ${pct(info.power - 1)}`) : '');
    // Moulin ou caserne : au bord d'une route (le chemin d'une église ou d'un port vers une ville) ; puis à qui il
    // prend sa place (une ville, une église, un port), ou aucune (pris à un autre royaume)
    const link = (b === B_MILL || b === B_BARRACKS) && G.roads().get(a);
    if (link && link.onRoad) txt += tr(` · 🛤️ au bord d'une route : +${Math.round(link.bonus * 100)} %`, ` · 🛤️ by a road: +${Math.round(link.bonus * 100)}%`);
    if (b === B_MILL || b === B_BARRACKS) {
      const host = G.slotHosts().get(a), hb = host === undefined ? 0 : G.building[host];
      txt += hb === B_CASTLE ? tr(' · 🏰 place d\'une ville', ' · 🏰 city slot') : hb === B_CHURCH ? tr(' · ⛪ place d\'une église', ' · ⛪ church slot')
        : hb === B_PORT ? tr(' · ⚓ place d\'un port', ' · ⚓ port slot') : tr(' · sans place (pris à un autre royaume)', ' · no slot (taken from another kingdom)');
    }
    // Église ou port amélioré : ses places prises (moulins et casernes autour de lui)
    if ((b === B_CHURCH || b === B_PORT) && G.hasSlots(a)) txt += ` · 🏠 ${G.churchUsed(a)}/${info.slots} ${tr('place', 'slot')}${info.slots > 1 ? 's' : ''}`;
    if (b === B_CHURCH) {
      const faith = info.faith * (1 + CONFIG.FAITH_ROAD_BONUS * G.churchLinks(o, a).length) * G.terrainFactor(a, B_CHURCH);
      const gold = G.buildingOutput(a);
      txt += tr(` · ✝️ Croyance +${Math.round(faith)}`, ` · ✝️ Faith +${Math.round(faith)}`) + (gold > 0 ? ` · +${n1(gold)} 💰${every}` : '') +
        (G.crusadeOf(a) ? tr(' · ✝️ croisade en cours', ' · ✝️ crusade under way') : '');
    }
    if (b === B_MINE && info.kind) {
      const d = G.depositAt.get(a), k = G.mineLinked(a) ? CONFIG.MINE_ROAD_FACTOR : 1;
      if (G.mineSpent(a)) txt += tr(' · ❌ épuisée', ' · ❌ exhausted');
      else {
        if (info.kind === 'iron') txt += tr(` · force des troupes ${pct(info.power * k)}`, ` · troop strength ${pct(info.power * k)}`);
        // (or : ce que le filon rapportera encore, et le temps qui lui reste)
        const left = fmt(Math.round(info.gold * k * d.left / CONFIG.TICKS_PER_SECOND / CONFIG.PRODUCTION_INTERVAL));
        if (info.kind === 'gold') txt += tr(` · encore ≈ ${left} 💰 · ⏳ ${clock(d.left / CONFIG.TICKS_PER_SECOND)}`, ` · ≈ ${left} 💰 left · ⏳ ${clock(d.left / CONFIG.TICKS_PER_SECOND)}`);
        if (info.kind === 'stone') txt += tr(` · prix ${pct(-info.discount * k)}`, ` · costs ${pct(-info.discount * k)}`);
        if (info.kind === 'diamond') txt += tr(` · 💎 ${Math.floor(d.progress * 100)} % extrait`, ` · 💎 ${Math.floor(d.progress * 100)}% extracted`);
        txt += k > 1 ? tr(' · 🛤️ reliée', ' · 🛤️ linked') : tr(' · sans route (×2 si reliée à une ville)', ' · no road (×2 if linked to a city)');
      }
    }
    if (G.holdsAlone(a) && G.isIsolated(a)) txt += tr(' · 🚩 isolé', ' · 🚩 isolated');
    const w = G.works.get(a);
    if (w) txt += { up: tr(' · ⬆️ amélioration en cours', ' · ⬆️ upgrade under way'), build: tr(' · 🏗️ en construction', ' · 🏗️ under construction'),
      down: tr(' · 🧨 démolition en cours', ' · 🧨 demolition under way') }[w.kind];
    else if (o === h.id) txt += tr(' · clique pour ses options', ' · click for its options');
    return txt;
  },

  // L'état d'une mine, en bref : reliée ou non à une ville, et son filon (or qui reste, diamant extrait, épuisé)
  mineState(a) {
    const G = Game, d = G.depositAt.get(a);
    if (!d) return '';
    let txt = G.mineSpent(a) ? tr(' · ❌ filon épuisé', ' · ❌ ore vein exhausted') + (d.kind === 'gold' && G.level[a] < 2 ? tr(' (améliore-la pour le relancer)', ' (upgrade it to restart it)') : '')
      : d.kind === 'gold' ? tr(` · ⏳ filon : ${clock(d.left / CONFIG.TICKS_PER_SECOND)} d'exploitation`, ` · ⏳ ore vein: ${clock(d.left / CONFIG.TICKS_PER_SECOND)} of mining left`)
      : d.kind === 'diamond' ? tr(` · 💎 extrait à ${Math.floor(d.progress * 100)} % (${d.paid}/4 versements)`, ` · 💎 ${Math.floor(d.progress * 100)}% extracted (${d.paid}/4 payments)`) : '';
    if (!G.mineSpent(a)) txt += G.mineLinked(a) ? tr(` · 🛤️ reliée à une ville : ×${CONFIG.MINE_ROAD_FACTOR}`, ` · 🛤️ linked to a city: ×${CONFIG.MINE_ROAD_FACTOR}`)
      : tr(` · sans route (×${CONFIG.MINE_ROAD_FACTOR} si reliée à une ville)`, ` · no road (×${CONFIG.MINE_ROAD_FACTOR} if linked to a city)`);
    return txt;
  },

  // Ce qu'apporte en plus la cité impériale (château de niveau 4 : voir IMPERIAL)
  imperialPerks() {
    return [tr(`Force des troupes ${pct(IMPERIAL.troopPower)}`, `Troop strength ${pct(IMPERIAL.troopPower)}`),
      tr(`Revenus du commerce ${pct(IMPERIAL.tradeBonus)}`, `Trade income ${pct(IMPERIAL.tradeBonus)}`),
      tr(`Ports et églises reliés : routes de pierre, bonus x${IMPERIAL.roadFactor}`, `Linked ports and churches: stone roads, bonus x${IMPERIAL.roadFactor}`),
      tr(`Bâtiments au bord : bonus x${IMPERIAL.roadFactor}`, `Roadside buildings: bonus x${IMPERIAL.roadFactor}`),
      tr('Une seule par partie', 'Only one per game')];
  },

  // Une liste d'avantages en HTML : un par ligne, avec un tiret
  perksHTML(list) { return `<ul class="perks">${list.map(p => `<li>${p}</li>`).join('')}</ul>`; },

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
    // (une mine ne se démolit pas)
    const del = type === B_MINE ? '' : `<button data-del>🧨 ${tr('Détruire', 'Demolish')} (${CONFIG.DEMOLISH_TIME} s)</button>`;
    const state = type === B_MINE ? this.mineState(a) : '';
    if (cost === null) {
      el.innerHTML = `${icon} <b>${cur.name}</b> ` + tr(`(niveau ${G.level[a]}) : niveau maximum`, `(level ${G.level[a]}): max level`) + state + this.perksHTML(this.levelPerks(type, cur)) +
        `<div class="choices">${del}<button data-no>OK</button></div>`;
    } else {
      const next = BUILDING_LEVELS[type][G.level[a] + 1], why = G.upgradeBlocker(G.human, a);
      el.innerHTML = `${icon} <b>${cur.name}</b> (${tr('niveau', 'level')} ${G.level[a]}) → <b>${type === B_MINE ? G.mineInfoAt(cur.kind, 2).name : next.name}</b> (${tr('niveau', 'level')} ${G.level[a] + 1})${state}<br>` +
        (next.img ? `<img src="${next.img}" alt="">` : '') +
        this.perksHTML(this.upgradePerks(type, cur, next)) +
        (why ? `<div class="need">⚠️ ${why}</div>` : '') + // (ce qu'il manque pour la cité impériale)
        `<div class="choices"><button data-yes${G.human.gold >= cost && !why ? '' : ' disabled'}>${tr('Améliorer', 'Upgrade')} (💰 ${fmt(cost)})</button>` +
        `${del}<button data-no>${tr('Fermer', 'Close')}</button></div>`;
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
      // ... et « Route commerciale » (vers une ville d'un allié du pacte)
      const trade = document.createElement('button');
      trade.dataset.trade = '';
      btn.after(trade);
      this.updateTradeButton(trade, a, true);
      trade.addEventListener('click', () => { close(); this.closeActionMenu(); this.startTrade(a); });
    }
    // Grande caserne (niveau 3) : bouton « Recrutement de masse »
    if (type === B_BARRACKS && G.level[a] >= 3) {
      const btn = document.createElement('button');
      btn.dataset.levy = '';
      el.querySelector('.choices').prepend(btn);
      this.updateLevyButton(btn, a, true);
      btn.addEventListener('click', () => { close(); this.closeActionMenu(); this.levy(a); });
    }
    // Port royal (port de niveau 3) : bouton « Assaut viking »
    if (type === B_PORT && G.level[a] >= 3) {
      const btn = document.createElement('button');
      btn.dataset.viking = '';
      el.querySelector('.choices').prepend(btn);
      this.updateVikingButton(btn, true);
      btn.addEventListener('click', () => { close(); this.closeActionMenu(); this.vikingButton(); });
    }
    // Cathédrale (église de niveau 3) : bouton « Croisade »
    if (type === B_CHURCH && G.level[a] >= 3) {
      const btn = document.createElement('button');
      btn.dataset.crusade = '';
      el.querySelector('.choices').prepend(btn);
      this.updateCrusadeButton(btn, a, true);
      btn.addEventListener('click', () => { close(); this.closeActionMenu(); this.crusade(a); });
    }
    // Détruire le bâtiment (DEMOLISH_TIME secondes de travaux)
    const delBtn = el.querySelector('[data-del]');
    if (delBtn) delBtn.addEventListener('click', () => {
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
    const canUp = !work && cost !== null && h.gold >= cost && !G.upgradeBlocker(h, a);
    const el = document.createElement('div');
    el.className = 'panel actionMenu quickMenu';
    el.buildingAnchor = a; // (pour le garder à jour : voir refreshBuildingMenu)
    // (la flèche est dessinée en SVG, de la couleur du texte : pas d'emoji)
    el.innerHTML = `<button data-up class="up"${canUp ? '' : ' disabled'} title="${tr('Améliorer', 'Upgrade')}">${ICONS.up}</button>` +
      (G.building[a] === B_CASTLE && G.level[a] >= 2 ? `<button data-wall class="wall">${ICONS.wall}</button>` +
        `<button data-trade class="wall">${ICONS.cart}</button>` : '') +
      (G.building[a] === B_CHURCH && G.level[a] >= 3 ? `<button data-crusade class="up">${ICONS.cross}</button>` : '') +
      (G.building[a] === B_BARRACKS && G.level[a] >= 3 ? `<button data-levy class="up">${ICONS.spears}</button>` : '') +
      (G.building[a] === B_PORT && G.level[a] >= 3 ? `<button data-viking class="up">${ICONS.flame}</button>` : '') +
      (G.building[a] !== B_MINE || work ? `<button data-x class="danger" title="${work ? tr('Annuler les travaux', 'Cancel the works') : tr('Détruire', 'Demolish')}">✖</button>` : '');
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
    const tradeBtn = el.querySelector('[data-trade]');
    if (tradeBtn) {
      this.updateTradeButton(tradeBtn, a, false);
      tradeBtn.addEventListener('click', () => { this.closeBuildingMenus(); this.startTrade(a); });
    }
    const levyBtn = el.querySelector('[data-levy]');
    if (levyBtn) {
      this.updateLevyButton(levyBtn, a, false);
      levyBtn.addEventListener('click', () => { this.closeBuildingMenus(); this.levy(a); });
    }
    const vikingBtn = el.querySelector('[data-viking]');
    if (vikingBtn) {
      this.updateVikingButton(vikingBtn, false);
      vikingBtn.addEventListener('click', () => { this.closeBuildingMenus(); this.vikingButton(); });
    }
    const crusadeBtn = el.querySelector('[data-crusade]');
    if (crusadeBtn) {
      this.updateCrusadeButton(crusadeBtn, a, false);
      crusadeBtn.addEventListener('click', () => { this.closeBuildingMenus(); this.crusade(a); });
    }
    const xBtn = el.querySelector('[data-x]');
    if (xBtn) xBtn.addEventListener('click', () => {
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
      else this.log(tr('⛵ Des renforts partent par la mer vers ton avant-poste !', '⛵ Reinforcements set sail for your outpost!'), 'good');
    };
    const repatriate = () => {
      const err = G.repatriate(h.id, a);
      if (err) this.log(err, 'warn');
      else this.log(tr(`🚢 ${fmt(stationed)} soldats rembarquent vers ton port.`, `🚢 ${fmt(stationed)} soldiers re-embark for your port.`), 'good');
    };
    // Fenêtre d'info (en haut à gauche)
    const box = document.createElement('div');
    this.upgradeBox = box;
    box.className = 'msg request upgrade';
    box.innerHTML = tr(`⛺ <b>Avant-poste</b> ${G.outpostReady(a) ? '' : '(en construction)'} · 🛡️ garnison ${fmt(G.garrison[a])}` +
      ` · ⚔ ${fmt(stationed)} soldats qui attendent`,
      `⛺ <b>Outpost</b> ${G.outpostReady(a) ? '' : '(under construction)'} · 🛡️ garrison ${fmt(G.garrison[a])}` +
      ` · ⚔ ${fmt(stationed)} soldiers waiting`) +
      `<div class="choices"><button data-re>${ICONS.boatIn} ${tr(`Renforts (${fmt(send)} soldats)`, `Reinforce (${fmt(send)} soldiers)`)}</button>` +
      `<button data-rp${stationed < 1 ? ' disabled' : ''}>${ICONS.boatOut} ${tr('Rapatrier', 'Bring back')}</button>` +
      `<button data-ab title="${tr('L\'avant-poste disparaît (ses terres te restent) et tous ses soldats rentrent par la mer', 'The outpost disappears (you keep its lands) and all its soldiers sail home')}">🧨 ${tr('Abandonner', 'Abandon')}</button>` +
      `<button data-no>${tr('Fermer', 'Close')}</button></div>`;
    const closeBox = () => { box.remove(); if (this.upgradeBox === box) this.upgradeBox = null; };
    box.querySelector('[data-re]').addEventListener('click', () => { this.closeBuildingMenus(); reinforce(); });
    box.querySelector('[data-rp]').addEventListener('click', () => { this.closeBuildingMenus(); repatriate(); });
    // Abandonner l'avant-poste : tous ses soldats (garnison comprise) rentrent automatiquement
    box.querySelector('[data-ab]').addEventListener('click', () => {
      this.closeBuildingMenus();
      const got = G.abandonOutpost(h.id, a);
      if (typeof got === 'string') this.log(got, 'warn');
      else this.log(tr(`🧨 Avant-poste abandonné : ${fmt(got)} soldats rentrent ${G.homePort(h.id, o.landing) === null ? 'au royaume' : 'par la mer vers ton port'}.`,
        `🧨 Outpost abandoned: ${fmt(got)} soldiers head ${G.homePort(h.id, o.landing) === null ? 'back to the kingdom' : 'home by sea to your port'}.`), 'good');
    });
    box.querySelector('[data-no]').addEventListener('click', closeBox);
    $('log').prepend(box);
    setTimeout(closeBox, 15000);
    // Menu rapide (à côté de l'avant-poste)
    const el = document.createElement('div');
    el.className = 'panel actionMenu quickMenu';
    el.innerHTML = `<button data-re class="up" title="${tr('Renforts par la mer', 'Reinforcements by sea')}">${ICONS.boatIn}</button>` +
      `<button data-rp class="up" title="${tr('Rapatrier', 'Bring back')}"${stationed < 1 ? ' disabled' : ''}>${ICONS.boatOut}</button>`;
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
    const what = `${BUILDINGS[type].icon} <b>${G.buildingInfo(a) ? G.buildingInfo(a).name : BUILDINGS[type].name}</b>`;
    el.innerHTML = tr(`🧨 Détruire ${what} ? Les travaux prennent ${CONFIG.DEMOLISH_TIME} s, et il est perdu pour de bon.`,
      `🧨 Demolish ${what}? The work takes ${CONFIG.DEMOLISH_TIME} s, and it is lost for good.`) +
      `<div class="choices"><button data-yes>${tr('Détruire', 'Demolish')}</button><button data-no>${tr('Annuler', 'Cancel')}</button></div>`;
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
    el.innerHTML = tr(`🗡️ Trahir <b>${escapeHtml(other.name)}</b> ? Ta défense sera affaiblie de ${pct} % ` +
      `pendant ${CONFIG.TRAITOR_DURATION / 60} min et personne ne voudra s'allier avec toi.`,
      `🗡️ Betray <b>${escapeHtml(other.name)}</b>? Your defense will be weakened by ${pct}% ` +
      `for ${CONFIG.TRAITOR_DURATION / 60} min and nobody will want to ally with you.`) +
      `<div class="choices"><button data-yes>${tr('Trahir', 'Betray')}</button><button data-no>${tr('Annuler', 'Cancel')}</button></div>`;
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
    const text = from.pact >= 0 ? tr(`t'invite dans le <b>${escapeHtml(Game.pactName(from))}</b>.`, `invites you into the <b>${escapeHtml(Game.pactName(from))}</b>.`)
      : h.pact >= 0 ? tr(`veut rejoindre ton <b>${escapeHtml(Game.pactName(h))}</b>.`, `wants to join your <b>${escapeHtml(Game.pactName(h))}</b>.`)
      : tr('te propose de former un pacte.', 'offers to form a pact with you.');
    el.innerHTML = `${this.bannerImg(from)}🤝 <b>${escapeHtml(from.name)}</b> ${text}` +
      `<div class="choices"><button data-yes>${tr('Accepter', 'Accept')}</button><button data-no>${tr('Refuser', 'Decline')}</button></div>`;
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
    $('endTitle').textContent = win ? tr('🏆 Victoire !', '🏆 Victory!') : tr('💀 Défaite...', '💀 Defeat...');
    $('endText').textContent = win
      ? (canContinue ? tr(`Longue vie au royaume de ${h.name} ! Tu domines le continent.`, `Long live the kingdom of ${h.name}! You rule the continent.`)
        : tr(`${h.name} a conquis le monde entier ! Plus aucun royaume ne te résiste.`, `${h.name} has conquered the whole world! No kingdom stands against you anymore.`))
      : tr(`Le royaume de ${h.name} est tombé. Les chroniques s'en souviendront...`, `The kingdom of ${h.name} has fallen. The chronicles will remember...`);
    const best = (h.maxTiles / Game.landCount * 100).toFixed(1);
    $('endStats').innerHTML = tr(
      `⏱️ Durée : ${Math.floor(secs / 60)} min ${secs % 60} s<br>` +
      `🗺️ Plus grand territoire : ${best} %<br>` +
      `☠️ Royaumes anéantis : ${h.kills}`,
      `⏱️ Duration: ${Math.floor(secs / 60)} min ${secs % 60} s<br>` +
      `🗺️ Largest territory: ${best}%<br>` +
      `☠️ Kingdoms destroyed: ${h.kills}`);
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
    if (G.terrain[i] === TERRAIN.GREAT_RIVER) return tr('🌊 Grand fleuve (infranchissable)', '🌊 Great river (impassable)');
    if (G.terrain[i] === TERRAIN.RIVER) return tr('🌊 Fleuve : neutre, personne ne peut le prendre · pour passer, clic droit sur une terre libre en face → 🛶 Traverser le fleuve',
      '🌊 River: neutral, nobody can take it · to cross, right-click on free land on the other bank → 🛶 Cross the river');
    if (G.terrain[i] === TERRAIN.PEAK) return tr('🏔️ Sommet (infranchissable)', '🏔️ Peak (impassable)');
    if (!G.isLand(i)) return tr('🌊 Mer', '🌊 Sea');
    const o = G.owner[i];
    // Château (ou port fortifié), le nôtre comme celui des autres : juste sa défense globale, en bref
    const def = o >= 0 ? this.fortDefense(G.anchor[i]) : null;
    if (def !== null) {
      const a = G.anchor[i], b = G.building[i], info = G.buildingInfo(a), truce = G.truceLeft(a);
      const mine = o === G.human.id, work = G.works.get(a);
      return `${BUILDINGS[b].icon} ${info.name} ${mine ? '' : tr(G.deName(G.players[o].name) + ' ', `· ${G.players[o].name} `)}· ` +
        tr(`🛡️ défense globale ${pct(def)}`, `🛡️ overall defense ${pct(def)}`) +
        (truce ? tr(` · ⏳ inattaquable encore ${Math.ceil(truce)} s`, ` · ⏳ cannot be attacked for ${Math.ceil(truce)} more s`) : '') +
        (work ? { up: tr(' · ⬆️ amélioration en cours', ' · ⬆️ upgrade under way'), build: tr(' · 🏗️ en construction', ' · 🏗️ under construction'),
          down: tr(' · 🧨 démolition en cours', ' · 🧨 demolition under way') }[work.kind]
          : mine ? tr(' · clique pour ses options', ' · click for its options') : '');
    }
    // Un autre bâtiment (moulin, caserne, église, port, mine) : un résumé, en bref (le détail est dans sa fenêtre, au clic)
    if (G.building[i] && G.building[i] !== B_OUTPOST && o >= 0) {
      const a = G.anchor[i], b = G.building[i];
      let txt = this.buildingSummary(a);
      if (o !== G.human.id && !G.areAllied(o, G.human.id) && TARGET_TYPES.includes(b)) {
        const truce = G.truceLeft(a);
        txt += truce ? tr(` · ⏳ inattaquable encore ${Math.ceil(truce)} s`, ` · ⏳ cannot be attacked for ${Math.ceil(truce)} more s`)
          : Render.castlePreview && Render.castlePreview.path ? tr(' · 🎯 clique pour viser', ' · 🎯 click to target') : tr(' · 🚫 inaccessible', ' · 🚫 out of reach');
      }
      return txt;
    }
    let txt = t.cost > 1 ? tr(`${t.name} (défense ${pct(t.cost - 1)})`, `${t.name} (defense ${pct(t.cost - 1)})`) : t.name;
    if (G.terrain[i] === TERRAIN.DESERT) txt = tr(`🏜️ ${t.name} (bâtiments : production ${pct(DESERT_PRODUCTION - 1)})`, `🏜️ ${t.name} (buildings: production ${pct(DESERT_PRODUCTION - 1)})`);
    txt += o >= 0 ? ` · ${G.players[o].name}` : tr(' · Terre libre', ' · Free land');
    if (G.wallAt[i]) txt += tr(' · 🧱 Mur (aucun assaut ne le franchit)', ' · 🧱 Wall (no assault can get past it)');
    else if (G.walls.some(w => w.tiles.includes(i))) txt += tr(' · 🧱 Mur en chantier', ' · 🧱 Wall under construction');
    if (o >= 0 && G.areAllied(o, G.human.id)) txt += tr(' · 🤝 allié', ' · 🤝 ally');
    if (o >= 0 && G.isTraitor(G.players[o])) txt += tr(' · 🗡️ traître (défense affaiblie)', ' · 🗡️ traitor (weakened defense)');
    if (o >= 0 && !G.building[i] && G.isUnlinked(i)) {
      txt += o === G.human.id ? tr(' · 🚩 coupé de tous tes châteaux : tes soldats sont bloqués dans ton château isolé, ce territoire n\'est plus défendu et aucune armée ne peut en partir ! Relie-le à un château (clique sur ton château isolé) ou bâtis-en un nouveau',
        ' · 🚩 cut off from all your castles: your soldiers are stuck in your isolated castle, this territory is no longer defended and no army can leave it! Link it to a castle (click on your isolated castle) or build a new one')
        : tr(' · ⚠️ coupé de tous ses châteaux : clique pour l\'attaquer de front (personne ne le défend)', ' · ⚠️ cut off from all its castles: click to attack it head-on (nobody defends it)');
    }
    if (G.building[i]) {
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${BUILDINGS[G.building[i]].name}`;
      if (G.building[i] === B_OUTPOST) {
        const a = G.anchor[i], o = G.outposts.get(a);
        txt += G.outpostReady(a) ? tr(` · 🛡️ ${fmt(G.garrison[a])} en garnison (fixe) · ⚔️ ${fmt(o.stationed)} stationnés (peuvent attaquer)`,
          ` · 🛡️ ${fmt(G.garrison[a])} in garrison (fixed) · ⚔️ ${fmt(o.stationed)} stationed (can attack)`)
          : tr(` · ⚔️ ${fmt(G.garrison[a])} soldats affaiblis (pas encore de garnison : ils comptent pour 1, pas 3)`,
            ` · ⚔️ ${fmt(G.garrison[a])} weakened soldiers (no garrison yet: they count as 1, not 3)`);
        const secs = Math.ceil((o.ready - G.tick) / CONFIG.TICKS_PER_SECOND);
        txt += G.outpostReady(a) ? tr(' · défense +100 % autour · base pour attaquer depuis la côte', ' · defense +100% around it · a base to attack from the coast')
          : tr(` · 🏗️ en construction (${secs} s) : ` +
            `ses soldats bâtissent et ne peuvent rien faire d'autre (pas d'attaque depuis lui), ` +
            `défense ${pct(-CONFIG.OUTPOST_BUILDING_MALUS)}, on peut déjà l'attaquer`,
            ` · 🏗️ under construction (${secs} s): ` +
            `its soldiers are building and can do nothing else (no attacks from it), ` +
            `defense ${pct(-CONFIG.OUTPOST_BUILDING_MALUS)}, it can already be attacked`);
        if (o && G.owner[a] === G.human.id) txt += tr(' · clique dessus pour envoyer des renforts par la mer', ' · click on it to send reinforcements by sea');
        txt += tr(' · un château bâti ou pris dans sa zone en fait une vraie terre du royaume', ' · a castle built or taken in its area makes it true kingdom land');
      }
    }
    // Un filon libre (sans mine) : ce qu'il donnerait
    if (G.depositTile[i] && G.building[i] !== B_MINE) {
      const d = G.deposits.find(d => [d.a, d.a + 1, d.a + G.W, d.a + G.W + 1].includes(i));
      if (d) txt += ` · ${MINES[d.kind].icon} ${tr('filon', 'ore vein')} : ${MINES[d.kind].name} (${MINES[d.kind].short})` +
        (o === G.human.id ? tr(` · ⛏️ touche ${B_MINE} pour y bâtir une mine (💰 ${fmt(G.buildCost(G.human, B_MINE))})`, ` · ⛏️ key ${B_MINE} to build a mine here (💰 ${fmt(G.buildCost(G.human, B_MINE))})`) : '');
    }
    if (o >= 0 && (G.castleProtects(o, i) || G.portBonus(o, i) > 0)) txt += tr(` · dans la muraille : défense ${pct(G.tileDefense(o, i) - 1)}`, ` · inside the walls: defense ${pct(G.tileDefense(o, i) - 1)}`);
    // Conseils d'attaque contre un royaume ennemi
    if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id) && G.isProtected(o)) {
      const b = G.building[i];
      if (TARGET_TYPES.includes(b) && G.truceLeft(G.anchor[i])) {
        txt += tr(` · ⏳ vient de changer de mains : inattaquable encore ${Math.ceil(G.truceLeft(G.anchor[i]))} s`, ` · ⏳ just changed hands: cannot be attacked for ${Math.ceil(G.truceLeft(G.anchor[i]))} more s`);
      } else if (TARGET_TYPES.includes(b)) {
        txt += Render.castlePreview && Render.castlePreview.path
          ? tr(` · 🎯 clique pour viser ${G.targetLabel(G.anchor[i])} (puis une 2e fois pour lancer l'assaut)`, ` · 🎯 click to target ${G.targetLabel(G.anchor[i])} (then click again to launch the assault)`)
          : tr(' · 🚫 inaccessible : des châteaux bloquent le passage', ' · 🚫 out of reach: castles block the way');
      } else if (!G.isUnlinked(i)) { // (un morceau coupé de ses châteaux s'attaque de front : voir plus haut)
        txt += tr(' · 🏰 protégé : vise un de ses châteaux, églises, ports, mines ou avant-postes', ' · 🏰 protected: target one of its castles, churches, ports, mines or outposts');
      }
    } else if (o >= 0 && o !== G.human.id && !G.areAllied(o, G.human.id)) {
      const b = G.building[i];
      if (TARGET_TYPES.includes(b) && G.truceLeft(G.anchor[i])) {
        txt += tr(` · ⏳ vient de changer de mains : inattaquable encore ${Math.ceil(G.truceLeft(G.anchor[i]))} s`, ` · ⏳ just changed hands: cannot be attacked for ${Math.ceil(G.truceLeft(G.anchor[i]))} more s`);
      } else if (TARGET_TYPES.includes(b)) {
        txt += Render.castlePreview && Render.castlePreview.path
          ? tr(` · 🎯 royaume désorganisé : clique pour viser ${G.targetLabel(G.anchor[i])} et prendre toute sa zone (ou clique ailleurs sur ses terres pour l'attaquer de front)`,
            ` · 🎯 disorganized kingdom: click to target ${G.targetLabel(G.anchor[i])} and take its whole area (or click elsewhere on its lands to attack it head-on)`)
          : tr(' · 🚫 inaccessible : des châteaux bloquent le passage', ' · 🚫 out of reach: castles block the way');
      } else {
        txt += tr(' · ⚔️ plus de ville (château) : royaume désorganisé, clique pour l\'attaquer de front (ses troupes défendent, désorganisées), ou vise une de ses églises ou un de ses ports',
          ' · ⚔️ no city (castle) left: disorganized kingdom, click to attack it head-on (its troops defend, disorganized), or target one of its churches or ports');
      }
    }
    if (G.isCoastal(i) && G.landable(G.human.id, i) && G.expeditionPorts(G.human.id).length) {
      txt += tr(' · ⛵ côte : clic droit → Débarquer', ' · ⛵ coast: right-click → Land');
    }
    // Fleuve : un pont, ou la possibilité d'en bâtir un (les deux rives à nous)
    if (G.bridgeAt[i]) txt += tr(' · 🌉 pont : on passe ce fleuve sans s\'arrêter', ' · 🌉 bridge: this river is crossed without stopping');
    else if (G.terrain[i] === TERRAIN.RIVER && !G.planBridge(G.human.id, i).error) txt += tr(` · 🌉 clic droit → Construire un pont (💰 ${fmt(G.bridgeCost(G.human.id))})`, ` · 🌉 right-click → Build a bridge (💰 ${fmt(G.bridgeCost(G.human.id))})`);
    return txt;
  },

  refresh() {
    const G = Game, h = G.human;
    if (!h) return;
    $('kName').textContent = h.name;
    $('kName').style.color = `rgb(${h.color})`;
    $('gold').textContent = fmt(h.gold);
    this.refreshTroopGauge();
    $('land').textContent = (h.tiles / G.landCount * 100).toFixed(1) + tr(' %', '%');
    $('faith').textContent = fmt(Math.round(G.faithOf(h.id)));
    // ⛏️ Nos mines : leur nombre (le détail par minerai au survol), seulement quand on en a
    const mines = MINE_KINDS.map(k => [k, G.minesOf(h.id, k).length]).filter(([, n]) => n);
    $('minesBox').classList.toggle('hidden', !mines.length);
    $('mines').textContent = mines.reduce((s, [, n]) => s + n, 0);
    // (« 2 mines de fer », « 1 carrière de pierre »)
    $('minesBox').title = tr('Mines : ', 'Mines: ') + mines.map(([k, n]) => LANG === 'fr' ? `${n} ${MINES[k].name.toLowerCase().replace(/^(\S+)/, n > 1 ? '$1s' : '$1')}`
      : `${n} × ${MINES[k].name.toLowerCase()}`).join(', ');
    // Puissance des troupes : 100 % = soldats ordinaires (caserne améliorée, mines de fer, cité impériale : plus)
    $('power').textContent = Math.round(G.troopPower(h.id) * 100) + tr(' %', '%');
    // Durée de la partie (le temps de jeu : la pause l'arrête)
    const secs = Math.floor(G.tick / CONFIG.TICKS_PER_SECOND), hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60;
    $('clock').textContent = (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(secs % 60).padStart(2, '0');
    const traitorSecs = Math.ceil((h.traitorUntil - G.tick) / CONFIG.TICKS_PER_SECOND);
    $('traitor').classList.toggle('hidden', !G.isTraitor(h));
    $('traitor').textContent = tr(`🗡️ Traître : défense -${Math.round((1 - CONFIG.TRAITOR_DEFENSE_MALUS) * 100)} % `,
      `🗡️ Traitor: defense -${Math.round((1 - CONFIG.TRAITOR_DEFENSE_MALUS) * 100)}% `) +
      `(${Math.floor(traitorSecs / 60)}:${String(traitorSecs % 60).padStart(2, '0')})`;
    $('ratioVal').textContent = `${Math.round(this.ratio * 100)}${tr(' %', '%')} (${fmt(h.troops * this.ratio)})`;

    document.querySelectorAll('.build[data-type]').forEach(btn => {
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
    this.refreshCrusadeBar();
    this.refreshLevyBar();
    this.refreshVikingBar();

    const ranking = G.players.filter(p => p.alive && p.tiles > 0).sort((a, b) => b.tiles - a.tiles);
    const row = p => {
      const allied = G.areAllied(p.id, h.id);
      const btn = p.isHuman || !h.alive || !G.pactsAllowed ? '' : allied
        ? `<button data-ally="${p.id}" title="${tr('Rompre l\'alliance (trahison !)', 'Break the alliance (betrayal!)')}">💔</button>`
        : `<button data-ally="${p.id}" title="${tr('Proposer une alliance', 'Offer an alliance')}">🤝</button>`;
      // Un royaume qui nous attaque (ou prépare un assaut contre nous) : son nom clignote en rouge
      const attacking = !p.isHuman && G.attacks.some(a => !a.done && a.attacker === p.id && a.target === h.id);
      const blink = attacking ? (Math.floor(performance.now() / 400) % 2 ? ' attacker' : ' attacker on') : '';
      return `<li class="${p.isHuman ? 'me' : ''}${allied ? ' ally' : ''}${blink}" data-pid="${p.id}"` +
        `${attacking ? ` title="${tr('Il t\'attaque ! Clique pour voir où.', 'They are attacking you! Click to see where.')}"` : ''}>${this.bannerImg(p, 'lbb')}` +
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
    // (les 10 premiers ; et toujours ton royaume, à son vrai rang, s'il n'en fait pas partie)
    const top = groups.slice(0, 10), mineAt = groups.findIndex(g => g.members.includes(h));
    if (mineAt >= 10) top.push(groups[mineAt]);
    $('lb').innerHTML = top.map(g => {
      const k = groups.indexOf(g);
      if (k >= 10) return row(g.members[0]).replace('<li ', `<li value="${k + 1}" `);
      if (g.members.length < 2) return row(g.members[0]);
      const mine = g.members.includes(h);
      return `<li class="pactGroup${mine ? ' mine' : ''}"><div class="pactHead"><span>🤝 ${escapeHtml(G.pacts.get(g.pact).name)}</span>` +
        `<span class="pct">${(tilesOf(g) / G.landCount * 100).toFixed(1)}%</span></div>` +
        `<ul>${g.members.map(row).join('')}</ul></li>`;
    }).join('');

    this.refreshAttacks();

    if (G.phase === 'playing') {
      const freeArm = this.freeArm && performance.now() - this.freeArm < CONFIG.FREE_LAND_CLICK_TIME * 1000;
      $('hint').textContent = this.vikingAim ? this.vikingHint() : this.wallFor >= 0 ? this.wallHint() : this.tradeFor >= 0 ? this.tradeHint() : this.plan ? this.planHint()
        : freeArm ? tr(`🌾 Terres libres : clique encore une fois pour lancer ${fmt(G.human.troops * this.ratio)} soldats à l'attaque`,
          `🌾 Free land: click once more to send ${fmt(G.human.troops * this.ratio)} soldiers into the attack`)
        : this.selectedBuild
        ? tr(`Clique sur ton territoire pour construire : ${BUILDINGS[this.selectedBuild].name}${this.terrainHint()} (Échap pour annuler)`,
          `Click on your territory to build: ${BUILDINGS[this.selectedBuild].name}${this.terrainHint()} (Esc to cancel)`)
        : UI.describeTile(Render.hover) || tr('Clique sur une terre voisine pour attaquer · molette = zoom · glisser, ZQSD ou flèches = déplacer',
          'Click on neighbouring land to attack · wheel = zoom · drag, WASD or arrows = move');
    } else if (G.phase === 'spawn') {
      $('hint').textContent = this.spawnHint(Render.hover);
    } else if (G.phase === 'over') {
      $('hint').textContent = '';
    }
  },

  // Jauge des soldats en bas de l'écran, avec le recrutement par seconde au-dessus
  refreshTroopGauge() {
    // (les soldats stationnés aux avant-postes, en mer et en campagne comptent aussi pour le maximum ; pas les garnisons)
    const G = Game, h = G.human, max = G.maxTroops(h), r = Math.min(1, G.armySize(h) / max);
    const eff = G.growthFactor(r) / CONFIG.TROOP_GROWTH_AT_PEAK; // 1 = recrutement au top
    const color = eff > 0.85 ? '#3f9a3a' : eff > 0.45 ? '#d99a1e' : '#b8322a';
    $('troopFill').style.width = (r * 100).toFixed(1) + '%';
    $('troopFill').style.background = color;
    const st = G.stationedOf(h), sea = G.atSeaOf(h), away = G.campaignOf(h);
    // toute l'armée sur le maximum (ex. « 150 / 300 »), puis ce qui n'est pas disponible pour attaquer
    const rest = [away >= 1 ? tr(`⚔ ${fmt(away)} en campagne`, `⚔ ${fmt(away)} on campaign`) : '', st >= 1 ? tr(`⛺ ${fmt(st)} aux avant-postes`, `⛺ ${fmt(st)} at outposts`) : '',
      sea >= 1 ? tr(`⛵ ${fmt(sea)} en mer`, `⛵ ${fmt(sea)} at sea`) : ''].filter(Boolean);
    $('troopText').textContent = `${G.troopIcon(h.id)} ${fmt(G.armySize(h))} / ${fmt(max)}` + (rest.length ? tr(` · dont ${rest.join(', ')}`, ` · of which ${rest.join(', ')}`) : '');
    // Pas de chiffre précis : juste l'état du recrutement
    let tip = tr('recrutement normal', 'normal recruitment');
    if (r >= 0.98) tip = tr('armée pleine !', 'army full!');
    else if (eff < 0.45) tip = tr('trop de soldats, le recrutement ralentit', 'too many soldiers, recruitment slows down');
    else if (eff > 0.85) tip = tr('recrutement au top', 'peak recruitment');
    // Effets d'un assaut réussi (voir warFactor)
    const P = tr(' %', '%');
    const war = (G.postWar(h) ? ` · <span style="color:#b8322a">⚰️ ${tr('après-guerre', 'post-war')} −${Math.round(G.postWar(h) * 100)}${P}</span>` : '') +
      (G.rallied(h) ? ` · <span style="color:#2f6b2a">🔥 ${tr('galvanisé', 'rallied')} +${Math.round(G.rallied(h) * 100)}${P}</span>` : '') +
      // (les deux à la fois : ils s'annulent, on montre le total)
      (G.postWar(h) && G.rallied(h) ? ` · total ${signedPct(G.warFactor(h) - 1)}` : '') +
      (G.upkeepFactor(h) < 0.995 ? ` · <span style="color:#b8322a">💰 ${tr(`solde des troupes −${Math.round((1 - G.upkeepFactor(h)) * 100)} % d'or`, `troop upkeep −${Math.round((1 - G.upkeepFactor(h)) * 100)}% gold`)}</span>` : '');
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
          return `<div class="attack panel"><span class="goto" data-goto="${a.link}" title="${tr('Clique pour voir ce bâtiment isolé', 'Click to see this isolated building')}">⚔️ → ${G.building[a.link] === B_PORT ? tr('⚓ ton port isolé', '⚓ your isolated port') : tr('🏰 ton château isolé', '🏰 your isolated castle')} 🔎</span><b data-troops="${a.id}"></b>` +
            (a.retreatEnd !== undefined ? `<span class="retreat">${tr('🏳️ retraite…', '🏳️ retreating…')}</span></div>`
              : `${this.retreatCross('data-cancel', a.id)}</div>`);
        }
        if (G.cutOff(a) && a.target === h.id) {
          // Pas de bouton « Défendre » : le château est coupé du royaume
          const tb = a.unlinked ? -1 : G.building[a.targetCastle];
          return `<div class="attack panel incoming" title="${tb === B_OUTPOST
            ? tr('Ton avant-poste ne compte que sur sa garnison : clique dessus pour envoyer des renforts par la mer', 'Your outpost relies on its garrison alone: click on it to send reinforcements by sea')
            : a.unlinked ? tr('Ce territoire est coupé de tous tes châteaux : relie-le à un château (clique sur ton château isolé) ou bâtis-en un', 'This territory is cut off from all your castles: link it to a castle (click on your isolated castle) or build one')
            : tr('Il est coupé de ton royaume : clique dessus pour lancer un assaut qui le relie', 'It is cut off from your kingdom: click on it to launch an assault that links it')}">` +
            `<span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} ${tr('attaque', 'attacks')} ` +
            `${tb === B_OUTPOST ? tr('ton avant-poste ⛺', 'your outpost ⛺') : a.unlinked ? tr('ton territoire coupé 🚩', 'your cut-off territory 🚩') : tb === B_PORT ? tr('ton port isolé 🚩', 'your isolated port 🚩')
              : tb === B_CASTLE ? tr('ton château isolé 🚩', 'your isolated castle 🚩') : tr('ton bâtiment isolé 🚩', 'your isolated building 🚩')}</span>` +
            `<b data-troops="${a.id}"></b></div>`;
        }
        if (a.attacker === h.id) {
          const target = a.target < 0 ? tr('Terres libres', 'Free land')
            : (a.targetCastle >= 0 && BUILDINGS[G.building[a.targetCastle]] ? BUILDINGS[G.building[a.targetCastle]].icon + ' ' : '') + escapeHtml(G.players[a.target].name);
          const flag = a.target >= 0 ? this.bannerImg(G.players[a.target]) : '';
          const from = G.sourceOfAttack(a) >= 0 ? '⛺ ' : '';
          return `<div class="attack panel"><span>${from}⚔️ → ${flag}${target}</span><b data-troops="${a.id}"></b>` +
            (a.retreatEnd !== undefined ? `<span class="retreat">${tr('🏳️ retraite…', '🏳️ retreating…')}</span></div>`
              : `${this.retreatCross('data-cancel', a.id)}</div>`);
        }
        return `<div class="attack panel incoming"><span>${this.bannerImg(G.players[a.attacker])}${escapeHtml(G.players[a.attacker].name)} ${tr('attaque', 'attacks')}</span>` +
          `<b data-troops="${a.id}"></b>` +
          (G.isPreparing(a) // (pas encore entrée sur nos terres : on ne peut pas encore la contrer)
            ? `<button data-defend="${a.id}" disabled title="${tr('Elle marche encore sur ses terres : tu pourras la contrer dès qu\'elle entre sur les tiennes', 'It is still marching on its own lands: you can counter it as soon as it enters yours')}">🛡️ ${tr('Défendre', 'Defend')}</button></div>`
            : `<button data-defend="${a.id}" title="${tr('Envoyer le % de soldats choisi contre cet assaut', 'Send the chosen % of soldiers against this assault')}">🛡️ ${tr('Défendre', 'Defend')}</button></div>`);
      }).join('') + boats.map(e => {
        // Transport en mer : débarquement, renforts vers un avant-poste, ou retour au port
        const what = e.home !== undefined ? `${ICONS.boatOut} ${tr('retour au port', 'back to port')}`
          : e.reinforce !== undefined ? `${ICONS.boatIn} ${tr('renforts pour ton avant-poste', 'reinforcements for your outpost')}`
          : `${ICONS.ship} → ${tr('débarquement', 'landing')}` + (G.owner[e.landing] >= 0 && G.owner[e.landing] !== h.id
            ? ` ${tr('chez', 'at')} ${this.bannerImg(G.players[G.owner[e.landing]])}${escapeHtml(G.players[G.owner[e.landing]].name)}` : '');
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
      if (a.target === h.id && a.attacker !== h.id) { el.textContent = `${G.troopIcon(a.attacker)} ${fmt(a.troops)}`; continue; }
      const onWay = tr('en route', 'on the way');
      el.textContent = `${G.troopIcon(a.attacker)} ${fmt(a.troops)}` + (pending ? ` (+${fmt(pending)} ${onWay})` : '') +
        (defenders >= 1 ? ` vs 🛡 ${fmt(defenders)}` : '') + (coming >= 1 ? ` (🛡 +${fmt(coming)} ${onWay})` : '') +
        (G.isPreparing(a) ? ` · ⏳ ${wait} s` : '') +
        // (garnison du château visé : elle attend derrière sa muraille, et n'entre en jeu qu'au siège)
        (G.garrisonWaiting(a) >= 1 ? tr(` · 🏰 ${fmt(G.garrisonWaiting(a))} derrière les murs`, ` · 🏰 ${fmt(G.garrisonWaiting(a))} behind the walls`) : '') +
        (a.siege ? ` · 🏰 ${tr('siège', 'siege')} ${Math.round(Math.max(0, Math.min(1, (G.tick - (a.siege.start || G.tick)) / Math.max(1, a.siege.end - (a.siege.start || G.tick)))) * 100)}${tr(' %', '%')}` : '') +
        (a.target === G.human.id && G.defendWait(a) > 0 ? tr(` · ⏳ renforts dans ${Math.ceil(G.defendWait(a))} s`, ` · ⏳ reinforcements in ${Math.ceil(G.defendWait(a))} s`) : '');
    }
  },

  // Petite croix dans le coin d'une barre (assaut ou transport en mer) : retraite, avec des pertes
  retreatCross(attr, id) {
    return `<button class="x" ${attr}="${id}" title="${tr(`Retraite : les soldats rentrent, ${Math.round(CONFIG.RETREAT_LOSS * 100)} % se perdent`, `Retreat: the soldiers come home, ${Math.round(CONFIG.RETREAT_LOSS * 100)}% are lost`)}">×</button>`;
  },

  // Pendant la construction d'un moulin, d'une caserne ou d'un port : production prévue selon le terrain
  // (et, pour un port, s'il sera relié à une ville ; pour une église, si elle sera sur la route d'un port)
  terrainHint() {
    const t = this.selectedBuild, G = Game, h = G.human;
    if (!Render.mouse) return '';
    const a = Render.anchorAt(Render.mouse.x, Render.mouse.y, t);
    if (a < 0) return '';
    if (t === B_CHURCH) {
      const list = G.churchLinks(h.id, a);
      // (le terrain compte aussi : plus forte sur les hauteurs, moins en forêt)
      const k = G.terrainFactor(a, B_CHURCH), here = tr(` · terrain : ${prodText(k)}`, ` · terrain: ${prodText(k)}`);
      const gold = Math.round(list.reduce((s, l) => s + CONFIG.CHURCH_ROAD_GOLD * (l.stone ? IMPERIAL.roadFactor : 1), 0) * k);
      return here + (list.length ? tr(` · 🛤️ ${this.churchLinksText(list)} : +${gold} 💰 toutes les ${CONFIG.PRODUCTION_INTERVAL} s` +
          `, Croyance +${Math.round(CONFIG.FAITH_ROAD_BONUS * list.length * 100)} %`,
          ` · 🛤️ ${this.churchLinksText(list)}: +${gold} 💰 every ${CONFIG.PRODUCTION_INTERVAL} s` +
          `, Faith +${Math.round(CONFIG.FAITH_ROAD_BONUS * list.length * 100)}%`)
        : tr(' · trop loin d\'une ville ou d\'une route de port : pas de chemin', ' · too far from a city or a port road: no path'));
    }
    if (!TERRAIN_PRODUCTION[t]) return '';
    let txt = tr(` · production ici : ${prodText(G.terrainFactor(a, t))}`, ` · production here: ${prodText(G.terrainFactor(a, t))}`);
    if (t === B_MILL || t === B_BARRACKS) {
      // (dans la muraille de villes de niveau 2 ou 3 : une route par ville, 3 au plus ; sinon, au bord d'une route)
      const list = G.cityRoads(h.id, a, t).slice(0, CONFIG.ROAD_MAX_CITIES), sum = list.reduce((s, r) => s + r.bonus, 0);
      if (list.length) txt += tr(` · 🛤️ ${list.length > 1 ? `${list.length} routes (vers ${list.length} villes)` : 'route vers la ville'} : +${Math.round(sum * 100)} %`,
        ` · 🛤️ ${list.length > 1 ? `${list.length} roads (to ${list.length} cities)` : 'road to the city'}: +${Math.round(sum * 100)}%`);
      else {
        const on = G.onRoad(h.id, a, t), bonus = Math.round(CONFIG.MILL_ROAD_BONUS * (on === 2 ? IMPERIAL.roadFactor : 1) * 100);
        if (on) txt += tr(` · 🛤️ au bord d'une route${on === 2 ? ' de pierre' : ''} : +${bonus} %`, ` · 🛤️ by a${on === 2 ? ' stone' : ''} road: +${bonus}%`);
      }
    }
    if (t === B_PORT) {
      const list = G.portRoadCastles(h.id, a), n = list.length;
      const sum = list.reduce((s, c) => s + CONFIG.PORT_ROAD_BONUS * (G.castleInfo(c).imperial ? IMPERIAL.roadFactor : 1), 0);
      txt += n ? tr(` · 🛤️ relié à ${n > 1 ? `${n} villes (${n} chemins)` : 'une ville'} : +${Math.round(sum * 100)} % d'or, et +${Math.round(CONFIG.PORT_MILL_BONUS * 100)} % par moulin relié à ces villes`,
          ` · 🛤️ linked to ${n > 1 ? `${n} cities (${n} paths)` : 'a city'}: +${Math.round(sum * 100)}% gold, and +${Math.round(CONFIG.PORT_MILL_BONUS * 100)}% per mill linked to these cities`)
        : tr(` · aucune ville assez proche (${CONFIG.PORT_ROAD_DISTANCE} cases, +${Math.round(CONFIG.ROAD_RANGE_PER_LEVEL * 100)} % par niveau de la ville) : pas de chemin`,
          ` · no city close enough (${CONFIG.PORT_ROAD_DISTANCE} tiles, +${Math.round(CONFIG.ROAD_RANGE_PER_LEVEL * 100)}% per city level): no path`);
    }
    return txt;
  },

  // « reliée à 2 villes et à la route d'un port » (chemins d'une église, voir Game.churchLinks)
  churchLinksText(list) {
    const cities = list.filter(l => l.castle !== undefined).length, port = list.some(l => l.port !== undefined);
    const parts = [];
    if (cities) parts.push(cities > 1 ? tr(`${cities} villes`, `${cities} cities`) : tr('une ville', 'a city'));
    if (port) parts.push(tr('la route d\'un port', 'a port road'));
    return tr('reliée à ', 'linked to ') + parts.join(tr(' et à ', ' and to ')) + (list.length > 1 ? tr(` (${list.length} chemins)`, ` (${list.length} paths)`) : '');
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

  // Avant de fonder sa capitale : en survolant, le terrain et la défense qu'aurait la zone de sa première ville
  // (terrain + murs du fort en bois, en moyenne dans sa muraille), ou pourquoi on ne peut pas la fonder là
  spawnHint(i) {
    const G = Game, base = tr('👑 Clique sur une terre libre pour fonder ta capitale', '👑 Click on free land to found your capital');
    if (i < 0 || !G.isLand(i)) return base;
    const err = G.spawnError(i);
    if (err) return `${base} · ⚠️ ${err}`;
    const W = G.W, R = CASTLE_LEVELS[1].radius, x = i % W, y = (i / W) | 0, zone = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= G.H || dx * dx + dy * dy > R * R) continue;
      if (G.claimable(yy * W + xx)) zone.push(yy * W + xx);
    }
    const t = TERRAIN_INFO[G.terrain[i]];
    return `${base} · ${t.name}${t.cost > 1 ? tr(` (défense ${pct(t.cost - 1)})`, ` (defense ${pct(t.cost - 1)})`) : ''} · ` +
      tr(`🛡️ défense de ta capitale ici : ${pct(G.castleZoneDefense(zone, 1) - 1)} (terrain + murs)`,
        `🛡️ your capital's defense here: ${pct(G.castleZoneDefense(zone, 1) - 1)} (terrain + walls)`);
  },

  // La caméra va sur les terres du royaume pid (clic sur son nom dans le classement) : sur son plus grand morceau,
  // assez près pour le voir en entier (pratique pour trouver un petit bout de territoire perdu et l'achever)
  showKingdom(pid) {
    const G = Game, W = G.W, r = G.regions(), p = G.players[pid];
    if (!p || !p.alive || !p.tiles) return;
    const k = r.main[pid];
    if (k === undefined || k < 0) return;
    let x0 = W, y0 = G.H, x1 = 0, y1 = 0;
    for (const i of r.order.subarray(r.start[k], r.start[k] + r.size[k])) {
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const c = Render.cam, s = Math.min(Render.vw / (x1 - x0 + 12), Render.vh / (y1 - y0 + 12)) * 0.8;
    c.scale = Math.max(Render.fitScale, Math.min(12, s));
    c.x = (x0 + x1 + 1) / 2 - Render.vw / 2 / c.scale;
    c.y = (y0 + y1 + 1) / 2 - Render.vh / 2 / c.scale;
    Render.flashKingdom = { pid, until: performance.now() + 1500 }; // (il clignote un instant, voir Render)
  },

  // Envoyer des soldats (selon le curseur « Envoyer ») contre un assaut ennemi
  defend(attackId) {
    const G = Game, h = G.human;
    // Château isolé ou avant-poste : les défenseurs ne peuvent pas le rejoindre
    const target = G.attacks.find(x => x.id === attackId && !x.done);
    // L'armée marche encore sur ses terres : on ne peut l'affronter qu'une fois entrée sur les nôtres
    if (target && G.isPreparing(target)) {
      const secs = Math.ceil((target.startTick - G.tick) / CONFIG.TICKS_PER_SECOND);
      return this.log(tr(`⏳ L'armée ${G.deName(G.players[target.attacker].name)} marche encore sur ses terres : tes défenseurs ` +
        `pourront l'affronter dès qu'elle entre sur les tiennes (dans ${secs} s).`,
        `⏳ ${G.players[target.attacker].name}'s army is still marching on its own lands: your defenders ` +
        `can face it as soon as it enters yours (in ${secs} s).`), 'warn');
    }
    if (target && G.defendWait(target) > 0) {
      return this.log(tr(`⏳ Tes défenseurs se regroupent : prochains renforts dans ${Math.ceil(G.defendWait(target))} s.`,
        `⏳ Your defenders are regrouping: next reinforcements in ${Math.ceil(G.defendWait(target))} s.`), 'warn');
    }
    // Zone d'un avant-poste (pas encore reliée au royaume) : seuls ses soldats stationnés peuvent la défendre
    const zoneOp = target ? G.outpostZoneOf(target) : -1;
    if (target && (zoneOp >= 0 || G.cutOff(target))) {
      const op = zoneOp >= 0 ? zoneOp : target.targetCastle;
      if (G.building[op] === B_OUTPOST) {
        // Avant-poste : ses soldats stationnés peuvent le défendre (pas ceux du royaume, au-delà des mers)
        const before = G.troopsAt(h.id, op);
        const a = G.sendDefenders(h.id, attackId, before * this.ratio);
        if (a) return this.log(tr(`🛡️ ${fmt(before - G.troopsAt(h.id, op))} soldats stationnés à ton avant-poste partent le défendre ` +
          '(seuls eux peuvent le rejoindre, au-delà des mers).',
          `🛡️ ${fmt(before - G.troopsAt(h.id, op))} soldiers stationed at your outpost set out to defend it ` +
          '(only they can reach it, beyond the seas).'), 'good');
        return this.log(tr('🚫 Ton avant-poste est au-delà des mers : seuls ses soldats le défendent, et il n\'en a plus de libres. ' +
          'Clique sur l\'avant-poste pour lui envoyer des renforts par la mer.',
          '🚫 Your outpost is beyond the seas: only its own soldiers defend it, and it has none left to spare. ' +
          'Click on the outpost to send it reinforcements by sea.'), 'warn');
      }
      if (target.unlinked) return this.log(tr('🚫 Ce territoire est coupé de tous tes châteaux : personne ne peut le défendre. ' +
        'Relie-le à un château (clique sur ton château isolé) ou bâtis-en un nouveau.',
        '🚫 This territory is cut off from all your castles: nobody can defend it. ' +
        'Link it to a castle (click on your isolated castle) or build a new one.'), 'warn');
      return this.log(tr('🚫 Il est coupé de ton royaume : tes défenseurs ne peuvent pas le rejoindre. ' +
        'Clique dessus pour lancer un assaut qui le relie à ton royaume.',
        '🚫 It is cut off from your kingdom: your defenders cannot reach it. ' +
        'Click on it to launch an assault that links it to your kingdom.'), 'warn');
    }
    const before = h.troops;
    const a = G.sendDefenders(h.id, attackId, h.troops * this.ratio);
    if (a && a.reinforced) this.log(tr(`🛡️ ${fmt(before - h.troops)} soldats renforcent ton armée de défense contre ${G.players[a.attacker].name} (ils la rejoignent dans ${CONFIG.DEFEND_REINFORCE_DELAY} s).`,
      `🛡️ ${fmt(before - h.troops)} soldiers reinforce your defending army against ${G.players[a.attacker].name} (they join it in ${CONFIG.DEFEND_REINFORCE_DELAY} s).`), 'good');
    else if (a) this.log(tr(`🛡️ ${fmt(before - h.troops)} défenseurs partent de ton château le plus proche à la rencontre de ${G.players[a.attacker].name} !`,
      `🛡️ ${fmt(before - h.troops)} defenders set out from your nearest castle to meet ${G.players[a.attacker].name}!`), 'good');
    else this.log(tr('Pas assez de soldats pour défendre !', 'Not enough soldiers to defend!'), 'warn');
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
      return this.log(tr(`⏳ ${G.targetLabel(c)[0].toUpperCase()}${G.targetLabel(c).slice(1)} vient de changer de mains : impossible de l'attaquer avant ${Math.ceil(G.truceLeft(c))} s.`,
        `⏳ ${G.targetLabel(c)[0].toUpperCase()}${G.targetLabel(c).slice(1)} just changed hands: it cannot be attacked for ${Math.ceil(G.truceLeft(c))} s.`), 'warn');
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
        return this.log(tr(`Impossible d'atteindre ${G.targetLabel(c)} : ` +
          'des fortifications bloquent le passage. Prends d\'abord les châteaux de la frontière.',
          `Cannot reach ${G.targetLabel(c)}: ` +
          'fortifications block the way. Take the border castles first.'), 'warn');
      }
    } else source = G.bestSource(h.id, target, tile);
    this.plan = { target, castle: c, tile, source };
  },

  cancelPlan() { this.plan = null; },

  planHint() {
    const G = Game, p = this.plan, b = p.castle >= 0 ? BUILDINGS[G.building[p.castle]] : null;
    const def = p.castle >= 0 ? this.fortDefense(p.castle) : null;
    const who = `${b ? b.icon + ' ' : ''}${G.players[p.target].name}`, n = fmt(G.troopsAt(G.human.id, p.source) * this.ratio);
    return tr(`🎯 Assaut sur ${who} avec ${n} soldats`, `🎯 Assault on ${who} with ${n} soldiers`) +
      (def !== null ? tr(` · 🛡️ défense globale ${pct(def)}`, ` · 🛡️ overall defense ${pct(def)}`) : '') +
      tr(' : clique encore une fois sur la cible pour lancer · Échap pour annuler', ': click the target once more to launch · Esc to cancel');
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
    // (assaut de front : on garde la case du 1er clic, pour ne pas viser par erreur une église cliquée au 2e)
    const err = G.launchAttack(h.id, p.target, G.troopsAt(h.id, src) * this.ratio, p.castle >= 0 ? p.castle : p.tile, src);
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
    // (pas sur les terres d'un allié de son camp, en mode Factions : ce pacte-là ne se trahit pas)
    const sameCamp = G.owner[i] >= 0 && G.eternalPact(h.id) && G.areAllied(h.id, G.owner[i]);
    if (G.isLand(i) && !own && !sameCamp) items.push({ label: tr('⚔️ Attaquer', '⚔️ Attack'), run: () => { this.freeArm = performance.now(); this.onMapClick(sx, sy); } });
    // 🔥 Assaut viking prêt : sur une ville (ou un port fortifié) ennemie, le lancer d'ici
    if (h.vikingReady && G.building[i] && G.holdsAlone(G.anchor[i]) && G.owner[i] >= 0 && !own && !G.areAllied(h.id, G.owner[i])) {
      const plan = G.planViking(h.id, i), n = Math.floor(h.troops * this.ratio);
      const label = tr(`🔥 Assaut viking avec ${fmt(n)} soldats`, `🔥 Viking assault with ${fmt(n)} soldiers`);
      if (plan.error) items.push({ label, disabled: plan.error });
      else items.push({ label: label + tr(` (débarquement à ${Math.ceil(plan.time)} s de bateau)`, ` (landing after ${Math.ceil(plan.time)} s at sea)`), run: () => this.viking(i) });
    }
    // Sur un royaume ennemi : lui proposer une alliance (ou, s'il est allié, rompre le pacte)
    // (en mode Factions, pas de nouveaux pactes, mais on aide quand même les alliés de son camp)
    const o = G.owner[i];
    if (o >= 0 && !own && G.players[o].alive && (G.pactsAllowed || G.areAllied(h.id, o))) {
      const name = escapeHtml(G.players[o].name);
      if (G.areAllied(h.id, o)) {
        const n = Math.floor(h.troops * this.ratio);
        items.push({ label: tr(`🎁 Envoyer ${fmt(n)} soldats à ${name} (il en recevra ${fmt(n * CONFIG.ALLY_GIFT_RATIO)})`,
          `🎁 Send ${fmt(n)} soldiers to ${name} (they will receive ${fmt(n * CONFIG.ALLY_GIFT_RATIO)})`), run: () => {
          const got = G.sendTroopsToAlly(h.id, o, n);
          if (typeof got === 'string') this.log(got, 'warn');
          else this.log(tr(`🎁 ${fmt(got)} soldats arrivent chez ${G.players[o].name} (${Math.round((1 - CONFIG.ALLY_GIFT_RATIO) * 100)} % se sont perdus en route).`,
            `🎁 ${fmt(got)} soldiers reach ${G.players[o].name} (${Math.round((1 - CONFIG.ALLY_GIFT_RATIO) * 100)}% were lost on the way).`), 'good', G.players[o]);
        } });
        // ... ou de l'or (la même part de son trésor que le curseur « Envoyer »)
        const g = Math.floor(h.gold * this.ratio);
        if (g >= 1) items.push({ label: tr(`💰 Envoyer ${fmt(g)} d'or à ${name}`, `💰 Send ${fmt(g)} gold to ${name}`), run: () => {
          const err = G.sendGoldToAlly(h.id, o, g);
          if (err) this.log(err, 'warn');
          else this.log(tr(`💰 ${fmt(g)} d'or envoyés à ${G.players[o].name} !`, `💰 ${fmt(g)} gold sent to ${G.players[o].name}!`), 'good', G.players[o]);
        } });
        // (un camp du mode Factions ne se quitte pas)
        if (!G.eternalPact(h.id)) items.push({ label: tr(`💔 Rompre l'alliance avec ${name}`, `💔 Break the alliance with ${name}`), run: () => this.onAllyButton(o) });
      } else {
        items.push({ label: tr(`🤝 Proposer une alliance à ${name}`, `🤝 Offer an alliance to ${name}`), run: () => this.onAllyButton(o) });
      }
    }
    // Son avant-poste : rapatrier les soldats qui y attendent vers le port le plus proche
    if (own && G.building[i] === B_OUTPOST) {
      const op = G.anchor[i], o = G.outposts.get(op), n = o ? Math.floor(o.stationed) : 0;
      if (n < 1) items.push({ label: `${ICONS.boatOut} ${tr('Rapatrier', 'Bring back')}`, disabled: tr('Aucun soldat n\'attend ici (la garnison, elle, reste sur place).', 'No soldiers are waiting here (the garrison stays put).') });
      else items.push({ label: `${ICONS.boatOut} ${tr(`Rapatrier ${fmt(n)} soldats (vers ton port le plus proche)`, `Bring back ${fmt(n)} soldiers (to your nearest port)`)}`, run: () => {
        const err = G.repatriate(h.id, op);
        if (err) this.log(err, 'warn');
        else this.log(tr(`🚢 ${fmt(n)} soldats rembarquent vers ton port.`, `🚢 ${fmt(n)} soldiers re-embark for your port.`), 'good');
      } });
    }
    // Sur un fleuve dont les deux rives sont à nous (ou une à nous, l'autre à un allié) : construire un pont
    if (G.terrain[i] === TERRAIN.RIVER) {
      const plan = G.planBridge(h.id, i);
      const label = tr(`🌉 Construire un pont (💰 ${fmt(G.bridgeCost(h.id))})`, `🌉 Build a bridge (💰 ${fmt(G.bridgeCost(h.id))})`);
      if (plan.error) items.push({ label, disabled: plan.error });
      else if (h.gold < G.bridgeCost(h.id)) items.push({ label, disabled: tr(`Pas assez d'or : il faut 💰 ${fmt(G.bridgeCost(h.id))}.`, `Not enough gold: you need 💰 ${fmt(G.bridgeCost(h.id))}.`) });
      else items.push({ label: label + tr(' : tes soldats passent ce fleuve sans perdre de temps à gué', ': your soldiers cross this river without wasting time at a ford'), run: () => {
        const err = G.buildBridge(h, i);
        if (err) this.log(err, 'warn');
        else this.log(tr('🌉 Pont construit : tes soldats passent maintenant ce fleuve sans s\'arrêter !', '🌉 Bridge built: your soldiers now cross this river without stopping!'), 'good');
      } });
    }
    // Terre libre de l'autre côté d'un fleuve : la traverser à gué
    if (G.owner[i] === -1 && G.isLand(i) && G.terrain[i] !== TERRAIN.RIVER) {
      const plan = G.planCrossing(h.id, i);
      if (!plan.error) {
        items.push({ label: tr(`🛶 Traverser le fleuve (${Math.round(plan.time)} s de traversée, sans perdre de soldats)`,
          `🛶 Cross the river (${Math.round(plan.time)} s to cross, without losing soldiers)`), run: () => {
          const err = G.launchCrossing(h.id, i);
          if (err) this.log(err, 'warn');
          else this.log(tr('🛶 Tes soldats passent le fleuve à gué : c\'est long, mais ça ne coûte aucun soldat !', '🛶 Your soldiers ford the river: it is slow, but it costs no soldiers!'), 'good');
        } });
      }
    }
    // Attaque navale : sur la côte cliquée, ou la plus proche (on peut cliquer dans l'eau tout près)
    const coast = G.nearestCoast(h.id, i);
    if (coast >= 0) {
      const plan = G.planLanding(h.id, coast);
      const sending = Math.floor(h.troops * this.ratio);
      if (!plan.error && sending < plan.minTroops) {
        plan.error = tr(`Il faut au moins ${plan.minTroops} soldats (pour remplir la garnison de l'avant-poste) : augmente le curseur « Envoyer ».`,
          `You need at least ${plan.minTroops} soldiers (to fill the outpost's garrison): raise the "Send" slider.`);
      }
      items.push(plan.error
        ? { label: `${ICONS.ship} ${tr('Attaque navale', 'Naval attack')}`, disabled: plan.error }
        : { label: `${ICONS.ship} ` + tr(`Attaque navale : débarquer ${fmt(h.troops * this.ratio)} soldats (💰 ${plan.cost}, ` +
            `${Math.max(1, Math.round(plan.time))} s de mer, environ ${Math.round(G.seaLoss(plan.time) * 100)} % de pertes)`,
            `Naval attack: land ${fmt(h.troops * this.ratio)} soldiers (💰 ${plan.cost}, ` +
            `${Math.max(1, Math.round(plan.time))} s at sea, about ${Math.round(G.seaLoss(plan.time) * 100)}% losses)`), run: () => {
          const err = G.launchExpedition(h.id, coast, h.troops * this.ratio);
          if (err) this.log(err, 'warn');
          else this.log(tr('⛵ Ton expédition prend la mer ! Ses soldats défendront l\'avant-poste qu\'elle bâtira à l\'arrivée.', '⛵ Your expedition sets sail! Its soldiers will defend the outpost it builds on arrival.'), 'good');
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
      const cost = G.upgradeCost(a), why = cost !== null && G.owner[a] === h.id ? G.upgradeBlocker(h, a) : null;
      btn.disabled = !(G.owner[a] === h.id && !G.works.get(a) && cost !== null && h.gold >= cost && !why);
      btn.title = cost === null ? tr('Déjà au niveau maximum', 'Already at max level') : why ||
        (h.gold >= cost ? tr(`Améliorer (💰 ${fmt(cost)})`, `Upgrade (💰 ${fmt(cost)})`) : tr(`Pas assez d'or : il faut 💰 ${fmt(cost)}`, `Not enough gold: you need 💰 ${fmt(cost)}`));
    }
    for (const [box, text] of [[this.actionMenu, false], [this.upgradeBox, true]]) {
      const btn = box && box.buildingAnchor !== undefined && box.querySelector('[data-wall]');
      if (btn) this.updateWallButton(btn, box.buildingAnchor, text);
      const cb = box && box.buildingAnchor !== undefined && box.querySelector('[data-crusade]');
      if (cb) this.updateCrusadeButton(cb, box.buildingAnchor, text);
      const lv = box && box.buildingAnchor !== undefined && box.querySelector('[data-levy]');
      if (lv) this.updateLevyButton(lv, box.buildingAnchor, text);
      const vk = box && box.buildingAnchor !== undefined && box.querySelector('[data-viking]');
      if (vk) this.updateVikingButton(vk, text);
      const tb = box && box.buildingAnchor !== undefined && box.querySelector('[data-trade]');
      if (tb) this.updateTradeButton(tb, box.buildingAnchor, text);
    }
  },

  // --- 🔥 Assaut viking (port royal) ---
  vikingText() {
    return tr(`Assaut viking (💰 ${fmt(CONFIG.VIKING_COST)}) : un assaut par la mer sur une ville ennemie à ${CONFIG.VIKING_RANGE} cases au plus d'une côte, ` +
      `sans pertes en mer et avec des soldats +${Math.round(CONFIG.VIKING_BONUS * 100)} % plus forts. Une fois acheté, lance-le quand tu veux.`,
      `Viking assault (💰 ${fmt(CONFIG.VIKING_COST)}): an assault by sea on an enemy city within ${CONFIG.VIKING_RANGE} tiles of a coast, ` +
      `with no losses at sea and +${Math.round(CONFIG.VIKING_BONUS * 100)}% stronger soldiers. Once bought, launch it whenever you want.`);
  },
  // Bouton « Assaut viking » (menus du port royal) : l'acheter, ou, s'il est prêt, choisir sa cible
  updateVikingButton(btn, text) {
    const G = Game, h = G.human, ready = h.vikingReady, err = ready ? null : G.vikingBuyError(h);
    btn.disabled = !!err;
    btn.title = ready ? tr('🔥 Assaut viking prêt : clique, puis choisis une ville ennemie de l\'autre côté de la mer', '🔥 Viking assault ready: click, then choose an enemy city across the sea')
      : err || this.vikingText();
    if (text) {
      const html = ready ? tr('🔥 Assaut viking : choisir la cible', '🔥 Viking assault: choose the target') : tr(`🔥 Assaut viking (💰 ${fmt(CONFIG.VIKING_COST)})`, `🔥 Viking assault (💰 ${fmt(CONFIG.VIKING_COST)})`);
      if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
    }
  },
  // Bouton de la barre : caché sans port royal (sauf si un assaut viking est déjà prêt)
  refreshVikingBar() {
    const G = Game, h = G.human, btn = this.vikingBar, show = h.vikingReady || G.royalPorts(h.id).length > 0;
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    btn.querySelector('.cost').textContent = h.vikingReady ? tr('prêt !', 'ready!') : `💰 ${fmt(CONFIG.VIKING_COST)}`;
    btn.classList.toggle('poor', !h.vikingReady && h.gold < CONFIG.VIKING_COST);
    btn.classList.toggle('active', !!this.vikingAim);
    const err = h.vikingReady ? null : G.vikingBuyError(h);
    btn.disabled = !!err;
    btn.title = h.vikingReady ? tr('🔥 Assaut viking prêt : clique, puis choisis une ville ennemie de l\'autre côté de la mer', '🔥 Viking assault ready: click, then choose an enemy city across the sea')
      : err || this.vikingText();
  },
  // Clic sur un bouton « Viking » : l'acheter, ou choisir sa cible (un 2e clic annule le choix)
  vikingButton() {
    const G = Game, h = G.human;
    if (h.vikingReady) return this.vikingAim ? this.cancelVikingAim() : this.startVikingAim();
    const err = G.buyViking(h);
    if (err) return this.log(err, 'warn');
    this.log(tr('🔥 Assaut viking prêt ! Clique sur le bouton « Viking », puis sur une ville ennemie de l\'autre côté de la mer (ou clic droit sur elle).',
      '🔥 Viking assault ready! Click the « Viking » button, then an enemy city across the sea (or right-click it).'), 'good');
    this.startVikingAim();
  },
  startVikingAim() {
    this.selectBuild(0);
    this.cancelPlan();
    this.cancelWall();
    this.cancelTrade();
    this.vikingAim = true;
    document.body.style.cursor = 'crosshair';
  },
  cancelVikingAim() {
    if (!this.vikingAim) return;
    this.vikingAim = false;
    document.body.style.cursor = '';
  },
  vikingHint() {
    return tr(`🔥 Assaut viking : clique sur une ville (ou un port fortifié) ennemie à ${CONFIG.VIKING_RANGE} cases au plus d'une côte · ${fmt(Game.human.troops * this.ratio)} soldats (curseur « Envoyer ») · Échap : plus tard`,
      `🔥 Viking assault: click an enemy city (or fortified port) within ${CONFIG.VIKING_RANGE} tiles of a coast · ${fmt(Game.human.troops * this.ratio)} soldiers (« Send » slider) · Esc: later`);
  },
  // Lancer l'assaut viking sur la cible en i
  viking(i) {
    const G = Game, h = G.human, n = Math.floor(h.troops * this.ratio);
    const err = G.launchViking(h.id, i, n);
    if (err) return this.log(err, 'warn');
    this.cancelVikingAim();
    this.log(tr(`🔥 Tes Vikings embarquent (${fmt(n)} soldats) : ils traversent la mer sans pertes et débarqueront près de leur cible !`,
      `🔥 Your Vikings set sail (${fmt(n)} soldiers): they cross the sea with no losses and will land near their target!`), 'good');
  },

  // --- Croisade religieuse (cathédrale) ---
  // Bouton « Croisade » : actif si aucune croisade n'est en cours depuis cette cathédrale et qu'on a assez d'or
  updateCrusadeButton(btn, a, text) {
    const G = Game, h = G.human, cur = G.crusadeOf(a), err = G.crusadeError(h, a);
    const left = cur ? Math.ceil((cur.end - G.tick) / CONFIG.TICKS_PER_SECOND) : 0;
    btn.disabled = !!err;
    btn.title = cur ? tr(`Croisade en cours : encore ${left} s`, `Crusade under way: ${left} s left`) : err ||
      tr(`Croisade religieuse (💰 ${fmt(CONFIG.CRUSADE_COST)}) : +${fmt(CONFIG.CRUSADE_FAITH)} de Croyance pendant ${CONFIG.CRUSADE_TIME} s`,
        `Crusade (💰 ${fmt(CONFIG.CRUSADE_COST)}): +${fmt(CONFIG.CRUSADE_FAITH)} Faith for ${CONFIG.CRUSADE_TIME} s`);
    if (text) {
      const html = cur ? tr(`✝️ Croisade : ${left} s`, `✝️ Crusade: ${left} s`) : tr(`✝️ Croisade (💰 ${fmt(CONFIG.CRUSADE_COST)})`, `✝️ Crusade (💰 ${fmt(CONFIG.CRUSADE_COST)})`);
      if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
    }
  },

  // Nos cathédrales (églises de niveau 3) : celle d'où partira la croisade du bouton de la barre,
  // la première qui n'a pas de croisade en cours (-1 si on n'en a pas, ou si elles en ont toutes une)
  cathedrals() {
    const G = Game, h = G.human;
    return G.buildingTiles.filter(a => G.building[a] === B_CHURCH && G.owner[a] === h.id && G.level[a] >= 3);
  },
  crusadeChurch() {
    const free = this.cathedrals().find(a => !Game.crusadeOf(a));
    return free === undefined ? -1 : free;
  },

  // Bouton « Croisade » de la barre : caché sans cathédrale ; sinon son prix, ou le temps qui reste
  // si toutes nos cathédrales ont déjà une croisade en cours
  refreshCrusadeBar() {
    const G = Game, h = G.human, btn = this.crusadeBar, list = this.cathedrals();
    btn.classList.toggle('hidden', !list.length);
    if (!list.length) return;
    const a = this.crusadeChurch(), cost = btn.querySelector('.cost');
    if (a >= 0) {
      const err = G.crusadeError(h, a);
      cost.textContent = `💰 ${fmt(CONFIG.CRUSADE_COST)}`;
      btn.classList.toggle('poor', h.gold < CONFIG.CRUSADE_COST);
      btn.disabled = !!err;
      btn.title = err || tr(`Croisade religieuse (💰 ${fmt(CONFIG.CRUSADE_COST)}) : +${fmt(CONFIG.CRUSADE_FAITH)} de Croyance ` +
        `pendant ${CONFIG.CRUSADE_TIME} s` + (list.length > 1 ? ' (chaque cathédrale peut lancer la sienne)' : ''),
        `Crusade (💰 ${fmt(CONFIG.CRUSADE_COST)}): +${fmt(CONFIG.CRUSADE_FAITH)} Faith ` +
        `for ${CONFIG.CRUSADE_TIME} s` + (list.length > 1 ? ' (each cathedral can launch its own)' : ''));
    } else {
      const end = Math.min(...list.map(c => G.crusadeOf(c).end));
      cost.textContent = `⏳ ${Math.ceil((end - G.tick) / CONFIG.TICKS_PER_SECOND)} s`;
      btn.classList.remove('poor');
      btn.disabled = true;
      btn.title = tr('Croisade en cours : attends qu\'elle se termine pour en relancer une', 'Crusade under way: wait for it to end before launching another');
    }
  },

  crusade(a) {
    const G = Game, err = G.startCrusade(G.human, a);
    if (err) return this.log(err, 'warn');
    this.log(tr(`✝️ Croisade religieuse lancée : +${fmt(CONFIG.CRUSADE_FAITH)} de Croyance pendant ${CONFIG.CRUSADE_TIME} s ! Tes prêcheurs vont convertir les terres voisines bien plus vite.`,
      `✝️ Crusade launched: +${fmt(CONFIG.CRUSADE_FAITH)} Faith for ${CONFIG.CRUSADE_TIME} s! Your preachers will convert neighbouring lands much faster.`), 'good');
  },

  // --- ⚔️ Recrutement de masse (grande caserne, niveau 3) ---
  levyText() {
    return tr(`Recrutement de masse (💰 ${fmt(CONFIG.LEVY_COST)}) : ton armée se reforme bien plus vite pendant ${CONFIG.LEVY_TIME} s ` +
      '(jusqu\'à 3 fois plus vite quand elle est presque vide ; plus guère d\'effet au-delà de la moitié de ton armée maximum)',
      `Mass recruitment (💰 ${fmt(CONFIG.LEVY_COST)}): your army rebuilds much faster for ${CONFIG.LEVY_TIME} s ` +
      '(up to 3 times faster when it is nearly empty; hardly any effect above half of your max army)');
  },
  // « Recrutement de masse en cours : encore 42 s (recrutement x2,4) »
  levyRunning(left) {
    const f = Game.levyFactor(Game.human).toFixed(1);
    return tr(`Recrutement de masse en cours : encore ${left} s (recrutement x${f.replace('.', ',')})`, `Mass recruitment under way: ${left} s left (recruitment x${f})`);
  },
  updateLevyButton(btn, a, text) {
    const G = Game, h = G.human, left = Math.ceil(G.levyLeft(h)), err = G.levyError(h, a);
    btn.disabled = !!err;
    btn.title = left ? this.levyRunning(left) : err || this.levyText();
    if (text) {
      const html = left ? tr(`⚔️ Recrutement : ${left} s`, `⚔️ Recruitment: ${left} s`) : tr(`⚔️ Recrutement de masse (💰 ${fmt(CONFIG.LEVY_COST)})`, `⚔️ Mass recruitment (💰 ${fmt(CONFIG.LEVY_COST)})`);
      if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
    }
  },
  // Nos grandes casernes (niveau 3)
  bigBarracks() {
    const G = Game, h = G.human;
    return G.buildingTiles.filter(a => G.building[a] === B_BARRACKS && G.owner[a] === h.id && G.level[a] >= 3);
  },
  // Bouton de la barre : caché sans grande caserne ; sinon son prix, ou le temps qui reste
  refreshLevyBar() {
    const G = Game, h = G.human, btn = this.levyBar, list = this.bigBarracks();
    btn.classList.toggle('hidden', !list.length);
    if (!list.length) return;
    const left = Math.ceil(G.levyLeft(h)), cost = btn.querySelector('.cost'), err = G.levyError(h, list[0]);
    cost.textContent = left ? `⏳ ${left} s` : `💰 ${fmt(CONFIG.LEVY_COST)}`;
    btn.classList.toggle('poor', !left && h.gold < CONFIG.LEVY_COST);
    btn.disabled = !!err;
    btn.title = left ? this.levyRunning(left) : err || this.levyText();
  },
  levy(a) {
    const G = Game, err = G.startLevy(G.human, a);
    if (err) return this.log(err, 'warn');
    this.log(tr(`⚔️ Recrutement de masse lancé : ton armée se reforme bien plus vite pendant ${CONFIG.LEVY_TIME} s (surtout si elle est petite) !`,
      `⚔️ Mass recruitment launched: your army rebuilds much faster for ${CONFIG.LEVY_TIME} s (especially if it is small)!`), 'good');
  },

  // --- Murs d'une ville (château de niveau 2 ou plus) ---
  // Bouton « Mur » : actif s'il reste un mur à bâtir, sans travaux en cours, et avec assez d'or.
  // text = bouton de la fenêtre d'info (avec son texte), sinon petit bouton du menu rapide (juste l'icône)
  updateWallButton(btn, a, text) {
    const G = Game, h = G.human, n = G.wallsOf(a).length, max = G.wallMax(a);
    const cost = n < max ? G.wallCost(a) : null;
    const why = G.owner[a] !== h.id ? tr('Cette ville n\'est plus à toi', 'This city is no longer yours')
      : cost === null ? (max < 2 ? tr('Cette ville a déjà son mur (une citadelle, niveau 3, peut en bâtir un second)', 'This city already has its wall (a citadel, level 3, can build a second one)')
        : max < 3 ? tr('Cette ville a déjà ses deux murs (une cité impériale, niveau 4, peut en bâtir un troisième)', 'This city already has its two walls (an imperial city, level 4, can build a third one)')
        : tr(`Cette ville a déjà ses ${max} murs`, `This city already has its ${max} walls`))
      : G.works.get(a) ? tr('Des travaux sont en cours sur cette ville', 'Works are under way on this city')
      : h.gold < cost ? tr(`Pas assez d'or : il faut 💰 ${fmt(cost)}`, `Not enough gold: you need 💰 ${fmt(cost)}`) : '';
    btn.disabled = !!why;
    btn.title = why || tr(`Bâtir un mur (💰 ${fmt(cost)}) : aucun assaut ne le franchit`, `Build a wall (💰 ${fmt(cost)}): no assault can get past it`);
    if (text) {
      const html = `🧱 ${tr('Mur', 'Wall')} ${n}/${max}` + (cost !== null ? ` (💰 ${fmt(cost)})` : '');
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
    this.wallFrom = -1; // (point de départ choisi sur le premier mur, pour le second : voir onMapClick)
    document.body.style.cursor = 'crosshair';
  },

  // --- Route commerciale d'une ville (château de niveau 2 ou plus) vers la ville d'un allié du pacte ---
  // Bouton « Route commerciale » : grisé sans allié dans son pacte (ou dans une partie sans pactes), si la ville a
  // déjà toutes ses routes (selon son niveau : voir Game.tradeMax), ou sans assez d'or. text = bouton de la fenêtre d'info (avec son
  // texte), sinon petite icône.
  updateTradeButton(btn, a, text) {
    const G = Game, h = G.human, list = G.tradesOf(a), max = G.tradeMax(a);
    // ses routes : avec qui, et ce qu'elles rapportent (ou « à l'arrêt » si le pacte est rompu)
    const mine = list.map(r => {
      const o = G.players[G.owner[r.from === a ? r.to : r.from]];
      return `${o ? o.name : '?'}${tr(' : ', ': ')}${r.active ? `+${fmt(r.income * (r.from === a ? 1 : CONFIG.TRADE_ALLY_SHARE))} 💰` : tr('à l\'arrêt', 'stopped')}`;
    }).join(', ');
    const why = G.tradeBlocker(h.id, a) || (h.gold < CONFIG.TRADE_COST_MIN ? tr(`Pas assez d'or : une route commerciale coûte au moins 💰 ${fmt(CONFIG.TRADE_COST_MIN)}`,
      `Not enough gold: a trade route costs at least 💰 ${fmt(CONFIG.TRADE_COST_MIN)}`) : '');
    btn.disabled = !!why;
    btn.title = (why || tr(`Route commerciale vers une ville alliée (💰 ${fmt(CONFIG.TRADE_COST_MIN)} à ${fmt(CONFIG.TRADE_COST_MAX)})`,
      `Trade route to an allied city (💰 ${fmt(CONFIG.TRADE_COST_MIN)} to ${fmt(CONFIG.TRADE_COST_MAX)})`)) +
      (mine ? tr(` · Routes : ${mine}`, ` · Routes: ${mine}`) : '');
    if (text) {
      const html = `🛒 ${tr('Route commerciale', 'Trade route')} ${list.length}/${max}` + (list.length < max ? ` (💰 ${fmt(CONFIG.TRADE_COST_MIN)}+)` : '');
      if (btn.dataset.html !== html) { btn.dataset.html = html; btn.innerHTML = html; }
    }
  },

  // Choix de la ville alliée : la souris montre la route (et son prix), un clic sur la ville la construit
  startTrade(a) {
    const G = Game, why = G.tradeBlocker(G.human.id, a);
    if (why) return this.log(why, 'warn');
    this.selectBuild(0);
    this.cancelPlan();
    this.cancelWall();
    this.tradeFor = a;
    document.body.style.cursor = 'crosshair';
  },

  cancelTrade() {
    if (this.tradeFor === undefined || this.tradeFor < 0) return;
    this.tradeFor = -1;
    document.body.style.cursor = '';
  },

  tradeHint() {
    return tr(`🛒 Clique sur une ville alliée (niv. 2+) · 💰 ${fmt(CONFIG.TRADE_COST_MIN)} à ${fmt(CONFIG.TRADE_COST_MAX)} · ` +
      `plus elle est longue, plus elle rapporte · Échap : annuler`,
      `🛒 Click on an allied city (lvl 2+) · 💰 ${fmt(CONFIG.TRADE_COST_MIN)} to ${fmt(CONFIG.TRADE_COST_MAX)} · ` +
      `the longer it is, the more it earns · Esc: cancel`);
  },

  // La case i est-elle sur un mur déjà bâti de la ville c ? (le second mur peut en partir)
  onFirstWall(c, i) { return Game.walls.some(w => w.castle === c && w.done && w.tiles.includes(i)); },

  cancelWall() {
    if (this.wallFor === undefined || this.wallFor < 0) return;
    this.wallFor = -1;
    this.wallFrom = -1;
    document.body.style.cursor = '';
  },

  wallHint() {
    const G = Game, c = this.wallFor, cost = G.wallCost(c);
    if (this.wallFrom >= 0) {
      return tr(`🧱 Second mur (💰 ${fmt(cost)}) : clique où il doit aller (${CONFIG.WALL_MAX_REACH} cases au plus) · Échap : annuler`,
        `🧱 Second wall (💰 ${fmt(cost)}): click where it should go (${CONFIG.WALL_MAX_REACH} tiles at most) · Esc: cancel`);
    }
    const second = G.walls.some(w => w.castle === c && w.done); // (le second mur peut partir du premier)
    return tr(`🧱 Mur (💰 ${fmt(cost)}) : clique sur tes terres (${CONFIG.WALL_MAX_REACH} cases au plus) · il s'accroche aux obstacles · ` +
      `relier deux villes : garnison +${CONFIG.WALL_LINK_GARRISON}${second ? ' · second mur : clique d\'abord sur le premier' : ''} · Échap : annuler`,
      `🧱 Wall (💰 ${fmt(cost)}): click on your lands (${CONFIG.WALL_MAX_REACH} tiles at most) · it hooks onto obstacles · ` +
      `linking two cities: garrison +${CONFIG.WALL_LINK_GARRISON}${second ? ' · second wall: click on the first one first' : ''} · Esc: cancel`);
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
      this.log(tr('👑 Ta capitale est fondée ! Clique sur les terres voisines pour t\'étendre.', '👑 Your capital is founded! Click on neighbouring lands to expand.'), 'good');
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
      // Second mur : un 1er clic sur le premier mur choisit le point de départ
      if (this.wallFrom < 0 && this.onFirstWall(c, i)) {
        this.wallFrom = i;
        return this.log(tr('🧱 Point de départ choisi sur ton premier mur : clique maintenant où le second mur doit aller.', '🧱 Starting point chosen on your first wall: now click where the second wall should go.'), 'good');
      }
      const cost = G.wallCost(c), err = G.buildWall(h, c, i, this.wallFrom);
      if (err) return this.log(err, 'warn');
      this.cancelWall();
      this.log(tr(`🧱 Chantier du mur lancé (💰 ${fmt(cost)}) : il sera debout dans ${CONFIG.WALL_BUILD_TIME} s.`, `🧱 Wall construction started (💰 ${fmt(cost)}): it will stand in ${CONFIG.WALL_BUILD_TIME} s.`), 'good');
      return;
    }
    // Assaut viking : le clic choisit la ville ennemie visée
    if (this.vikingAim) return this.viking(i);
    // Route commerciale : le clic choisit la ville alliée
    if (this.tradeFor >= 0) {
      const a = this.tradeFor, plan = G.planTrade(h.id, a, i);
      const err = plan.error || G.buildTrade(h, a, i);
      if (err) return this.log(err, 'warn');
      this.cancelTrade();
      this.log(tr(`🛒 Route commerciale ouverte vers ${G.players[G.owner[plan.to]].name} (${Math.round(plan.len)} cases, 💰 ${fmt(plan.cost)}) : ` +
        `+${fmt(plan.income)} 💰 toutes les ${CONFIG.PRODUCTION_INTERVAL} s pour toi, et la moitié pour ton allié !`,
        `🛒 Trade route opened to ${G.players[G.owner[plan.to]].name} (${Math.round(plan.len)} tiles, 💰 ${fmt(plan.cost)}): ` +
        `+${fmt(plan.income)} 💰 every ${CONFIG.PRODUCTION_INTERVAL} s for you, and half as much for your ally!`), 'good');
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
    // (ses églises, ports et avant-postes se visent toujours, même chez un royaume désorganisé ;
    // ailleurs sur ses terres, l'assaut se fait de front)
    const aimed = target >= 0 && TARGET_TYPES.includes(b);
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
    // Attaquer un allié = le trahir (après confirmation, qui vaut validation de l'assaut) ; sauf dans un camp du mode
    // « Factions » : on n'attaque jamais son propre camp
    if (target >= 0 && G.areAllied(h.id, target) && G.eternalPact(h.id)) {
      return this.log(tr(`⚔️ ${G.players[target].name} est de ton camp (${G.pactName(h)}) : on n'attaque pas ses alliés.`,
        `⚔️ ${G.players[target].name} is in your faction (${G.pactName(h)}): you do not attack your allies.`), 'warn');
    }
    if (target >= 0 && G.areAllied(h.id, target)) {
      // (on vérifie d'abord qu'il y a vraiment une cible à attaquer ici : sinon on le trahirait pour rien)
      const valid = aimed ? G.attackSources(h.id).some(src => G.castlePath(h.id, c, src))
        : !G.isProtected(target) || G.isUnlinked(i);
      if (!valid) return this.log(aimed ? tr(`Impossible d'atteindre ${G.targetLabel(c)} : des fortifications bloquent le passage.`, `Cannot reach ${G.targetLabel(c)}: fortifications block the way.`)
        : tr(`${G.players[target].name} est protégé : vise un de ses châteaux, églises, ports, mines ou avant-postes.`,
          `${G.players[target].name} is protected: target one of its castles, churches, ports, mines or outposts.`), 'warn');
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
    if (UI.selectedBuild || UI.plan || UI.wallFor >= 0 || UI.tradeFor >= 0) { UI.selectBuild(0); UI.cancelPlan(); UI.cancelWall(); UI.cancelTrade(); return; }
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
    UI.panCamera(dt); // (caméra au clavier : ZQSD ou flèches)
    if (Game.phase === 'playing' && !Game.paused) {
      acc += dt * Game.speed; // (partie accélérée : x2 = 2 tours de jeu au lieu d'un, tout va 2 fois plus vite)
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
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + tr(' %', '%');
}

// Un bonus en pourcentage : 0.3 → "+30 %", -0.1 → "-10 %"
function pct(x) {
  const n = Math.round(x * 100);
  return (n >= 0 ? '+' : '') + n + tr(' %', '%');
}

// Multiplicateur de production du terrain, en mots : 1.3 → "+30 %", 1 → "normale"
function prodText(f) {
  return Math.abs(f - 1) < 0.005 ? tr('normale', 'normal') : pct(f - 1);
}
