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
      btn.innerHTML = `<span class="icon">${b.icon}</span><span>${b.name}</span><span class="cost"></span>`;
      btn.addEventListener('click', () => this.selectBuild(this.selectedBuild === t ? 0 : t));
      builds.appendChild(btn);
    }

    $('startBtn').addEventListener('click', () => this.start());
    $('replayBtn').addEventListener('click', () => location.reload());
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('attacks').addEventListener('click', e => {
      const id = e.target.dataset.cancel;
      if (!id) return;
      const a = Game.cancelAttack(Game.human.id, +id);
      if (a) this.log(`↩️ Retraite ! ${fmt(a.troops)} soldats rentrent au royaume.`, 'good');
      this.refreshAttacks();
    });

    window.addEventListener('keydown', e => {
      if (Game.phase !== 'playing' || e.target.tagName === 'INPUT') return;
      if (e.key >= '1' && e.key <= String(BUILDINGS.length - 1)) this.selectBuild(+e.key);
      if (e.key === 'Escape') this.selectBuild(0);
      if (e.key === 'p' || e.key === 'P') this.togglePause();
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

  togglePause() {
    Game.paused = !Game.paused;
    $('pauseBtn').textContent = Game.paused ? '▶ Reprendre' : '⏸ Pause';
  },

  log(msg, cls) {
    const el = document.createElement('div');
    el.className = 'msg ' + (cls || '');
    el.textContent = msg;
    $('log').prepend(el);
    while ($('log').children.length > 6) $('log').lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 6000);
    setTimeout(() => el.remove(), 7000);
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
    let txt = `${t.name} (coût x${t.cost})`;
    txt += o >= 0 ? ` · ${G.players[o].name}` : ' · Terre libre';
    if (G.building[i]) txt += ` · ${BUILDINGS[G.building[i]].icon} ${BUILDINGS[G.building[i]].name}`;
    if (o >= 0 && G.castleProtects(o, i)) txt += ' · 🛡️ protégée';
    return txt;
  },

  refresh() {
    const G = Game, h = G.human;
    if (!h) return;
    $('kName').textContent = h.name;
    $('kName').style.color = `rgb(${h.color})`;
    $('gold').textContent = `${fmt(h.gold)} (+${G.goldRate(h).toFixed(1)}/s)`;
    $('troops').textContent = `${fmt(h.troops)} / ${fmt(G.maxTroops(h))} (+${Math.round(G.troopRate(h))}/s)`;
    $('land').textContent = (h.tiles / G.landCount * 100).toFixed(1) + ' %';
    $('ratioVal').textContent = `${Math.round(this.ratio * 100)} % (${fmt(h.troops * this.ratio)})`;

    document.querySelectorAll('.build').forEach(btn => {
      const cost = G.buildCost(h, +btn.dataset.type);
      btn.querySelector('.cost').textContent = `💰 ${fmt(cost)}`;
      btn.classList.toggle('poor', h.gold < cost);
    });

    const ranking = G.players.filter(p => p.alive && p.tiles > 0).sort((a, b) => b.tiles - a.tiles);
    $('lb').innerHTML = ranking.slice(0, 10).map(p =>
      `<li class="${p.isHuman ? 'me' : ''}"><span class="sw" style="background:rgb(${p.color})"></span>` +
      `<span class="nm">${escapeHtml(p.name)}</span><span>${(p.tiles / G.landCount * 100).toFixed(1)}%</span></li>`
    ).join('');

    this.refreshAttacks();

    if (G.phase === 'playing') {
      $('hint').textContent = this.selectedBuild
        ? `Clique sur ton territoire pour construire : ${BUILDINGS[this.selectedBuild].name} (Échap pour annuler)`
        : UI.describeTile(Render.hover) || 'Clique sur une terre voisine pour attaquer · molette = zoom · glisser = déplacer';
    } else if (G.phase === 'over') {
      $('hint').textContent = '';
    }
  },

  // Attaques en cours, en bas de l'écran. On ne reconstruit la liste que si elle change,
  // sinon les boutons "Annuler" seraient recréés pendant qu'on clique dessus.
  refreshAttacks() {
    const G = Game, h = G.human;
    const list = G.attacks.filter(a => !a.done && (a.attacker === h.id || a.target === h.id));
    const key = list.map(a => a.id).join(',');
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
      }).join('');
    }
    for (const a of list) {
      const el = box.querySelector(`[data-troops="${a.id}"]`);
      if (el) el.textContent = `${fmt(a.troops)} soldats`;
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
    if (this.selectedBuild) {
      const err = G.tryBuild(h, i, this.selectedBuild);
      if (err) this.log(err, 'warn');
      else this.selectBuild(0);
      return;
    }
    if (!G.isLand(i) || G.owner[i] === h.id) return;
    const err = G.launchAttack(h.id, G.owner[i], h.troops * this.ratio);
    if (err) this.log(err, 'warn');
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
