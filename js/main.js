// 🕹️ INTERFACE ET CONTRÔLES
// Menus, boutons, souris/tactile et boucle d'animation.

const $ = id => document.getElementById(id);

const UI = {
  selectedBuild: 0,
  ratio: 0.3,

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

    $('startBtn').addEventListener('click', () => this.start());
    $('replayBtn').addEventListener('click', () => location.reload());
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('allianceBtn').addEventListener('click', () => this.toggleAlliances());
    $('attacks').addEventListener('click', e => {
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
      if (e.key >= '1' && e.key <= String(BUILDINGS.length - 1)) {
        this.selectBuild(this.selectedBuild === +e.key ? 0 : +e.key);
      }
      if (e.key === 'Escape') this.selectBuild(0);
      if (e.key === 'p' || e.key === 'P') this.togglePause();
      if (e.key === 'a' || e.key === 'A') this.toggleAlliances();
    });
  },

  start() {
    const hex = $('color').value;
    Game.init({
      name: $('name').value.trim() || 'Mon Royaume',
      color: [1, 3, 5].map(k => parseInt(hex.substr(k, 2), 16)),
      difficulty: $('difficulty').value,
    });
    Render.setupMap();
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('hint').textContent = '👑 Clique sur une terre pour fonder ta capitale';
  },

  selectBuild(t) {
    this.selectedBuild = t;
    document.querySelectorAll('.build').forEach(b => b.classList.toggle('active', +b.dataset.type === t));
    document.body.style.cursor = t ? 'cell' : '';
  },

  // Infobulle des petits carrés d'alliés dans le classement
  alliesTitle(p) {
    const names = Game.allies(p.id).map(o => o.name);
    return escapeHtml(names.length ? 'Alliés : ' + names.join(', ') : 'Aucun allié');
  },

  // Afficher / cacher toutes les lignes d'alliance sur la carte
  toggleAlliances() {
    this.showAlliances = !this.showAlliances;
    $('allianceBtn').classList.toggle('active', this.showAlliances);
  },

  togglePause() {
    Game.paused = !Game.paused;
    $('pauseBtn').textContent = Game.paused ? '▶ Reprendre' : '⏸ Pause';
  },

  log(msg, cls) {
    const el = document.createElement('div');
    el.className = 'msg ' + (cls || '');
    el.textContent = msg;
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

  // Ce que rapporte un niveau de bâtiment, en quelques mots
  levelEffect(type, info) {
    if (type === B_CASTLE) return `+${info.bonus} défense, rayon ${info.radius}`;
    if (type === B_BARRACKS) return `+${fmt(info.maxTroops)} soldats max, +${Math.round(info.growth * 100)} % recrutement`;
    return `+${info.gold} or/s`;
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
        `<img src="${next.img}" alt="">` +
        `${this.levelEffect(type, cur)} → <b>${this.levelEffect(type, next)}</b>` +
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
    el.innerHTML = `🤝 <b>${escapeHtml(from.name)}</b> te propose une alliance.` +
      `<div class="choices"><button data-yes>Accepter</button><button data-no>Refuser</button></div>`;
    const answer = yes => {
      if (!this.pending.has(from.id)) return;
      this.pending.delete(from.id);
      el.remove();
      if (yes && from.alive && Game.human.alive) Game.makeAlliance(from.id, Game.human.id);
      else Game.refuseAlliance(from.id, Game.human.id);
    };
    el.querySelector('[data-yes]').addEventListener('click', () => answer(true));
    el.querySelector('[data-no]').addEventListener('click', () => answer(false));
    $('log').prepend(el);
    setTimeout(() => answer(false), CONFIG.ALLIANCE_REQUEST_TIMEOUT * 1000);
    return true;
  },

  showEnd(win) {
    const h = Game.human, secs = Math.floor(Game.tick / CONFIG.TICKS_PER_SECOND);
    $('endTitle').textContent = win ? '🏆 Victoire !' : '💀 Défaite...';
    $('endText').textContent = win
      ? `Longue vie au royaume de ${h.name} ! Tu domines le continent.`
      : `Le royaume de ${h.name} est tombé. Les chroniques s'en souviendront...`;
    $('endStats').innerHTML =
      `⏱️ Durée : ${Math.floor(secs / 60)} min ${secs % 60} s<br>` +
      `🗺️ Plus grand territoire : ${(h.maxTiles / Game.landCount * 100).toFixed(1)} %<br>` +
      `☠️ Royaumes anéantis : ${h.kills}`;
    $('endscreen').classList.remove('hidden');
  },

  describeTile(i) {
    if (i < 0) return '';
    const G = Game, t = TERRAIN_INFO[G.terrain[i]];
    if (!G.isLand(i)) return '🌊 Mer';
    const o = G.owner[i];
    let txt = `${t.name} (défense x${t.cost})`;
    txt += o >= 0 ? ` · ${G.players[o].name}` : ' · Terre libre';
    if (o >= 0 && G.areAllied(o, G.human.id)) txt += ' · 🤝 allié';
    if (o >= 0 && G.isTraitor(G.players[o])) txt += ' · 🗡️ traître (défense affaiblie)';
    const info = G.building[i] ? G.buildingInfo(G.anchor[i]) : null;
    if (info) {
      const a = G.anchor[i];
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${info.name} (niv. ${G.level[a]}, ${this.levelEffect(G.building[i], info)})`;
      if (o === G.human.id && G.upgradeCost(a) !== null) txt += ` · clique pour l'améliorer`;
    } else if (G.building[i]) {
      txt += ` · ${BUILDINGS[G.building[i]].icon} ${BUILDINGS[G.building[i]].name}`;
    }
    if (o >= 0 && G.castleProtects(o, i)) txt += ` · dans la muraille : défense x${+G.tileDefense(o, i).toFixed(1)}`;
    return txt;
  },

  refresh() {
    const G = Game, h = G.human;
    if (!h) return;
    $('kName').textContent = h.name;
    $('kName').style.color = `rgb(${h.color})`;
    $('gold').textContent = `${fmt(h.gold)} (+${G.goldRate(h).toFixed(1)}/s)`;
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
      return `<li class="${p.isHuman ? 'me' : ''}${allied ? ' ally' : ''}"><span class="sw" style="background:rgb(${p.color})"></span>` +
        `<span class="nm">${allied ? '🤝 ' : ''}${G.isTraitor(p) ? '🗡️ ' : ''}${escapeHtml(p.name)}</span>` +
        `<span class="allies" title="${this.alliesTitle(p)}">` +
        G.allies(p.id).map(o => `<i style="background:rgb(${o.color})"></i>`).join('') + `</span>` +
        `<span class="pct">${(p.tiles / G.landCount * 100).toFixed(1)}%</span>${btn}</li>`;
    }).join('');

    this.refreshAttacks();

    if (G.phase === 'playing') {
      $('hint').textContent = this.selectedBuild
        ? `Clique sur ton territoire pour construire : ${BUILDINGS[this.selectedBuild].name} (Échap pour annuler)`
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
    $('troopText').textContent = `⚔️ ${fmt(h.troops)} / ${fmt(max)}`;
    let tip = '';
    const f = G.recoveryFactor(h);
    if (G.isRecovering(h) && G.isRallying(h)) tip += ` · repos et réorganisation (x${+f.toFixed(2)})`;
    else if (G.isRecovering(h)) tip += ` · armée au repos (x${CONFIG.RECOVER_GROWTH_FACTOR})`;
    else if (G.isRallying(h)) tip += ` · réorganisation (x${CONFIG.RALLY_GROWTH_FACTOR})`;
    if (r >= 0.98) tip += ' · armée pleine !';
    else if (eff < 0.45) tip += ' · trop de soldats, le recrutement ralentit';
    else if (eff > 0.85) tip += ' · recrutement au top';
    $('troopRate').innerHTML = `<b style="color:${color}">+${fmt(G.troopRate(h))}/s</b>${tip}`;
  },

  // Attaques en cours, en bas de l'écran. On ne reconstruit la liste que si elle change,
  // sinon les boutons "Annuler" seraient recréés pendant qu'on clique dessus.
  refreshAttacks() {
    const G = Game, h = G.human;
    const list = G.attacks.filter(a => !a.done && (a.attacker === h.id || a.target === h.id));
    // Royaumes qu'on ne peut pas réattaquer tout de suite (château pris, armée qui récupère)
    const resting = G.players.filter(p => p.alive && G.recoverTime(h, p.id) > 0);
    const key = list.map(a => a.id).join(',') + '|' + resting.map(p => p.id).join(',');
    const box = $('attacks');
    if (key !== this.attacksKey) {
      this.attacksKey = key;
      box.innerHTML = list.map(a => {
        if (a.attacker === h.id) {
          const target = a.target < 0 ? 'Terres libres' : escapeHtml(G.players[a.target].name);
          return `<div class="attack panel"><span>⚔️ → ${target}</span><b data-troops="${a.id}"></b>` +
            `<button data-cancel="${a.id}" title="Rappeler les soldats survivants">✖ Annuler</button></div>`;
        }
        return `<div class="attack panel incoming"><span>🛡️ ${escapeHtml(G.players[a.attacker].name)} t'attaque</span>` +
          `<b data-troops="${a.id}"></b></div>`;
      }).join('') + resting.map(p =>
        `<div class="attack panel resting" title="Ton armée récupère après la prise d'un château">` +
        `<span>⏳ Repos avant d'attaquer ${escapeHtml(p.name)}</span><b data-rest="${p.id}"></b></div>`
      ).join('');
    }
    for (const p of resting) {
      const el = box.querySelector(`[data-rest="${p.id}"]`);
      if (el) el.textContent = `${G.recoverTime(h, p.id)} s`;
    }
    for (const a of list) {
      const el = box.querySelector(`[data-troops="${a.id}"]`);
      if (!el) continue;
      const wait = Math.ceil((a.startTick - G.tick) / CONFIG.TICKS_PER_SECOND);
      el.textContent = `${fmt(a.troops)} soldats` + (G.isPreparing(a) ? ` · ⏳ ${wait} s` : '');
    }
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
    // Clic sur un de ses bâtiments à niveaux (château, moulin) : proposer l'amélioration
    const t = G.building[i];
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
    const attack = () => {
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

  canvas.addEventListener('contextmenu', e => { e.preventDefault(); UI.selectBuild(0); });

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
