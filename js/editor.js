// 🖌️ ÉDITEUR DE CARTES
// On peint les terrains case par case (mer, plaine, forêt, colline, montagne, sommet, désert, fleuve, grand fleuve),
// puis on enregistre : la carte est gardée dans le navigateur et apparaît dans la liste des cartes du jeu
// (voir custommaps.js). Clic gauche : peindre · clic droit ou Espace + glisser : déplacer · molette : zoom.

const $ = id => document.getElementById(id);

// Les terrains de la palette, dans l'ordre des touches 1 à 9, puis 0
const PALETTE = [TERRAIN.WATER, TERRAIN.PLAINS, TERRAIN.FOREST, TERRAIN.HILLS, TERRAIN.MOUNTAIN,
  TERRAIN.PEAK, TERRAIN.DESERT, TERRAIN.RIVER, TERRAIN.GREAT_RIVER, TERRAIN.WOODED_HILLS]; // (pas la neige : elle n'existe que sur la carte Azeroth)

const Ed = {
  W: 0, H: 0, terrain: null,
  brush: TERRAIN.PLAINS, tool: 'paint', size: 8,
  cam: { x: 0, y: 0, scale: 1 },
  undo: [], redo: [],
  mouse: null,  // position de la souris à l'écran
  stroke: null, // trait en cours : dernière case peinte
  pan: null,    // déplacement de la carte en cours
  space: false, // touche Espace enfoncée (glisser = déplacer)

  init() {
    this.canvas = $('ed');
    this.ctx = this.canvas.getContext('2d');
    // Palette des terrains
    $('palette').innerHTML = PALETTE.map((t, k) => {
      const c = TERRAIN_INFO[t].color;
      const key = (k + 1) % 10; // (le 10e terrain : touche 0)
      return `<button data-t="${t}" title="${TERRAIN_INFO[t].name} (touche ${key})"><i style="background:rgb(${c})"></i>${key}. ${TERRAIN_INFO[t].name}</button>`;
    }).join('');
    $('palette').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setBrush(+b.dataset.t); });
    document.querySelectorAll('.toolBtn').forEach(b => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
    $('size').addEventListener('input', e => this.setSize(+e.target.value));
    $('undoBtn').addEventListener('click', () => this.doUndo());
    $('redoBtn').addEventListener('click', () => this.doRedo());
    document.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => {
      if (this.changed && !confirm('Commencer une nouvelle carte ? Ce qui n\'est pas enregistré sera perdu.')) return;
      this.newMap(b.dataset.new, $('newSize').value);
    }));
    $('saveBtn').addEventListener('click', () => this.save());
    $('playBtn').addEventListener('click', () => { if (this.save()) location.href = 'index.html?carte=' + encodeURIComponent(this.name()); });
    $('openBtn').addEventListener('click', () => this.open($('saved').value));
    $('deleteBtn').addEventListener('click', () => this.remove($('saved').value));
    $('exportBtn').addEventListener('click', () => this.exportMap());
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => this.importMap(e.target.files[0]));
    this.setupInput();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', e => { if (this.changed) { e.preventDefault(); e.returnValue = ''; } });
    this.resize();
    this.setBrush(TERRAIN.PLAINS);
    this.setTool('paint');
    this.setSize(8);
    this.refreshSaved();
    this.newMap('sea', 'moyen');
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    loop();
  },

  name() { return $('name').value.trim(); },

  // --- La carte ---
  // kind : 'sea' (toute en mer), 'land' (plaine entourée de mer) ou 'random' (une carte aléatoire du jeu)
  newMap(kind, size) {
    const [W, H] = CONFIG.MAP_SIZES[size] || CONFIG.MAP_SIZES.moyen;
    let terrain;
    if (kind === 'random') terrain = generateMap((Math.random() * 1e9) | 0, 'normal', size).terrain;
    else {
      terrain = new Uint8Array(W * H).fill(TERRAIN.WATER);
      if (kind === 'land') {
        for (let y = 4; y < H - 4; y++) terrain.fill(TERRAIN.PLAINS, y * W + 4, y * W + W - 4);
      }
    }
    this.load(W, H, terrain);
    $('name').value = '';
    this.message(kind === 'random' ? '🎲 Carte aléatoire : retouche-la à ton goût !' : '🖌️ Nouvelle carte : à toi de dessiner !');
  },

  load(W, H, terrain) {
    this.W = W; this.H = H; this.terrain = terrain;
    this.undo = []; this.redo = [];
    this.changed = false;
    this.off = document.createElement('canvas');
    this.off.width = W; this.off.height = H;
    this.offCtx = this.off.getContext('2d');
    this.img = this.offCtx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) this.paintPixel(i);
    this.offCtx.putImageData(this.img, 0, 0);
    this.dirty = null;
    // toute la carte à l'écran
    const s = Math.min((this.vw - 240) / W, this.vh / H) * 0.95;
    this.cam.scale = s;
    this.cam.x = W / 2 - (this.vw + 220) / 2 / s;
    this.cam.y = H / 2 - this.vh / 2 / s;
  },

  paintPixel(i) {
    const c = TERRAIN_INFO[this.terrain[i]].color, d = this.img.data, k = i * 4;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  },

  // Change le terrain d'une case (et note le rectangle à redessiner)
  set(x, y, t) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = y * this.W + x;
    if (this.terrain[i] === t) return;
    this.terrain[i] = t;
    this.paintPixel(i);
    this.changed = true;
    const d = this.dirty || (this.dirty = { x0: x, y0: y, x1: x, y1: y });
    if (x < d.x0) d.x0 = x; if (x > d.x1) d.x1 = x; if (y < d.y0) d.y0 = y; if (y > d.y1) d.y1 = y;
  },

  // Taille réelle du pinceau : un fleuve fait toujours 1 case de large, un grand fleuve 3 au plus
  brushSize() {
    if (this.brush === TERRAIN.RIVER) return 1;
    if (this.brush === TERRAIN.GREAT_RIVER) return Math.min(3, this.size);
    return this.size;
  },

  // Un coup de pinceau (rond) centré sur la case (x, y)
  stamp(x, y) {
    const n = this.brushSize(), r = n / 2, o = Math.floor((n - 1) / 2);
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const cx = dx - (n - 1) / 2, cy = dy - (n - 1) / 2;
      if (n > 2 && cx * cx + cy * cy > r * r) continue;
      this.set(x - o + dx, y - o + dy, this.brush);
    }
  },

  // Peint de la case a à la case b, sans trou (pour un geste rapide de la souris)
  line(ax, ay, bx, by) {
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy, x = ax, y = ay;
    for (;;) {
      this.stamp(x, y);
      if (x === bx && y === by) break;
      const e2 = 2 * err, px = x;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) {
        err += dx; y += sy;
        // (un fleuve ne fait pas de pas en diagonale : on peint aussi la case du coin, pour que l'eau se suive)
        if (x !== px && this.brush === TERRAIN.RIVER) this.stamp(x, y - sy);
      }
    }
  },

  // Remplit la zone du même terrain que la case (x, y)
  fill(x, y) {
    const W = this.W, H = this.H, start = y * W + x, from = this.terrain[start], to = this.brush;
    if (from === to) return;
    const stack = [start], seen = new Uint8Array(W * H);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), cx = i % W, cy = (i / W) | 0;
      this.set(cx, cy, to);
      for (const n of [cx > 0 ? i - 1 : -1, cx < W - 1 ? i + 1 : -1, cy > 0 ? i - W : -1, cy < H - 1 ? i + W : -1]) {
        if (n >= 0 && !seen[n] && this.terrain[n] === from) { seen[n] = 1; stack.push(n); }
      }
    }
  },

  // --- Annuler / refaire : on garde une copie de la carte avant chaque geste ---
  remember() {
    this.undo.push(this.terrain.slice());
    if (this.undo.length > 30) this.undo.shift();
    this.redo = [];
  },
  restore(from, to) {
    if (!from.length) return;
    to.push(this.terrain.slice());
    this.terrain = from.pop();
    for (let i = 0; i < this.W * this.H; i++) this.paintPixel(i);
    this.offCtx.putImageData(this.img, 0, 0);
    this.changed = true;
  },
  doUndo() { this.restore(this.undo, this.redo); },
  doRedo() { this.restore(this.redo, this.undo); },

  // --- Outils ---
  setBrush(t) {
    this.brush = t;
    document.querySelectorAll('#palette button').forEach(b => b.classList.toggle('active', +b.dataset.t === t));
  },
  setTool(tool) {
    this.tool = tool;
    document.querySelectorAll('.toolBtn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  },
  setSize(n) {
    this.size = Math.max(1, Math.min(40, n));
    $('size').value = this.size;
    $('sizeVal').textContent = this.size;
  },

  // --- Enregistrer, ouvrir, exporter ---
  // Vérifie que la carte est jouable : une terre d'au moins MIN_SPAWN_LAND cases pour fonder des royaumes.
  // Renvoie { ok, warn } (warn : un conseil, la carte reste jouable)
  check() {
    const W = this.W, H = this.H, N = W * H, T = this.terrain;
    const land = i => T[i] !== TERRAIN.WATER && T[i] !== TERRAIN.GREAT_RIVER && T[i] !== TERRAIN.PEAK;
    const seen = new Uint8Array(N), big = [];
    for (let s = 0; s < N; s++) {
      if (seen[s] || !land(s)) continue;
      let n = 0;
      const stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % W;
        if (T[i] !== TERRAIN.RIVER) n++;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) {
          if (j >= 0 && !seen[j] && land(j)) { seen[j] = 1; stack.push(j); }
        }
      }
      if (n >= CONFIG.MIN_SPAWN_LAND) big.push(n);
    }
    const total = big.reduce((a, b) => a + b, 0);
    if (!big.length) return { ok: false, warn: `Il faut au moins une terre de ${CONFIG.MIN_SPAWN_LAND} cases (sans compter les fleuves) pour y fonder des royaumes.` };
    // (chaque royaume a besoin de place : sinon certains bots ne trouveront pas où s'installer)
    if (total < CONFIG.MIN_SPAWN_LAND * 8) return { ok: true, warn: 'Carte enregistrée, mais il y a peu de terres : certains royaumes rivaux pourraient ne pas trouver de place.' };
    return { ok: true };
  },

  save() {
    const name = this.name();
    if (!name) { this.message('Donne un nom à ta carte avant de l\'enregistrer.', 'bad'); $('name').focus(); return false; }
    if (CUSTOM_MAPS.some(m => m.name === name)) { this.message('Ce nom est déjà celui d\'une carte du jeu : choisis-en un autre.', 'bad'); return false; }
    const check = this.check();
    if (!check.ok) { this.message(check.warn, 'bad'); return false; }
    const err = CustomMaps.save({ name, W: this.W, H: this.H, data: CustomMaps.encode(this.terrain) });
    if (err) { this.message(err, 'bad'); return false; }
    this.changed = false;
    this.refreshSaved(name);
    this.message(check.warn || `💾 « ${name} » est enregistrée : elle est dans la liste des cartes du jeu (✏️ Cartes dessinées).`, check.warn ? 'bad' : 'good');
    return true;
  },

  refreshSaved(select) {
    const list = CustomMaps.all();
    $('saved').innerHTML = list.length
      ? list.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)} (${m.W} x ${m.H})${m.builtIn ? ' · du jeu' : ''}</option>`).join('')
      : '<option value="">(aucune carte enregistrée)</option>';
    if (select) $('saved').value = select;
  },

  open(name) {
    const m = name && CustomMaps.find(name);
    if (!m) return;
    if (this.changed && !confirm('Ouvrir une autre carte ? Ce qui n\'est pas enregistré sera perdu.')) return;
    this.load(m.W, m.H, CustomMaps.decode(m.data, m.W * m.H));
    $('name').value = m.builtIn ? '' : m.name; // (une carte du jeu se modifie sous un autre nom)
    this.message(`📂 « ${m.name} » est ouverte.`);
  },

  remove(name) {
    const m = name && CustomMaps.find(name);
    if (!m) return;
    if (m.builtIn) return this.message('C\'est une carte du jeu : on ne peut pas la supprimer d\'ici.', 'bad');
    if (!confirm(`Supprimer la carte « ${name} » ?`)) return;
    CustomMaps.remove(name);
    this.refreshSaved();
    this.message(`🗑️ « ${name} » est supprimée.`);
  },

  // Télécharge la carte dans un fichier .json (pour la garder, la partager, ou l'ajouter au jeu pour tout le monde)
  exportMap() {
    const name = this.name() || 'carte';
    const json = JSON.stringify({ name, W: this.W, H: this.H, data: CustomMaps.encode(this.terrain) });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name.replace(/[^\w\- ]+/g, '_') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.message('📤 Carte exportée dans un fichier.');
  },

  importMap(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const m = JSON.parse(reader.result);
        if (!(m.W > 0 && m.H > 0 && typeof m.data === 'string')) throw new Error('format');
        this.load(m.W, m.H, CustomMaps.decode(m.data, m.W * m.H));
        $('name').value = m.name || '';
        this.changed = true;
        this.message(`📥 « ${m.name || 'carte'} » importée : enregistre-la pour l'avoir dans le jeu.`, 'good');
      } catch (e) {
        this.message('Ce fichier n\'est pas une carte de l\'éditeur.', 'bad');
      }
      $('importFile').value = '';
    };
    reader.readAsText(file);
  },

  message(text, kind = '') {
    const el = $('msg');
    el.textContent = text;
    el.className = 'panel ' + kind;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => el.classList.add('hidden'), 5000);
  },

  // --- Écran ---
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
  },

  tileAt(sx, sy) {
    return { x: Math.floor(this.cam.x + sx / this.cam.scale), y: Math.floor(this.cam.y + sy / this.cam.scale) };
  },

  draw() {
    const ctx = this.ctx, s = this.cam.scale;
    if (this.dirty) {
      const d = this.dirty;
      this.offCtx.putImageData(this.img, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
      this.dirty = null;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#1d2c3a';
    ctx.fillRect(0, 0, this.vw, this.vh);
    const ox = -this.cam.x * s, oy = -this.cam.y * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, ox, oy, this.W * s, this.H * s);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, this.W * s, this.H * s);
    // Le pinceau sous la souris
    let info = `Carte ${this.W} x ${this.H}`;
    if (this.mouse) {
      const t = this.tileAt(this.mouse.x, this.mouse.y), n = this.tool === 'fill' ? 1 : this.brushSize();
      const o = Math.floor((n - 1) / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      if (n > 2 && this.tool === 'paint') {
        ctx.beginPath();
        ctx.arc(ox + (t.x - o + n / 2) * s, oy + (t.y - o + n / 2) * s, n / 2 * s, 0, Math.PI * 2);
        ctx.stroke();
      } else ctx.strokeRect(ox + (t.x - o) * s, oy + (t.y - o) * s, n * s, n * s);
      if (t.x >= 0 && t.y >= 0 && t.x < this.W && t.y < this.H) {
        info += ` · case ${t.x}, ${t.y} : ${TERRAIN_INFO[this.terrain[t.y * this.W + t.x]].name}`;
      }
    }
    info += ` · pinceau : ${TERRAIN_INFO[this.brush].name}${this.tool === 'fill' ? ' (remplir)' : `, ${this.brushSize()} case${this.brushSize() > 1 ? 's' : ''}`}` +
      (this.changed ? ' · ✏️ modifiée (pas encore enregistrée)' : '');
    if (info !== this.lastInfo) { $('status').textContent = info; this.lastInfo = info; }
  },

  // --- Souris et clavier ---
  setupInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      this.mouse = { x: e.clientX, y: e.clientY };
      // clic droit, molette (bouton du milieu) ou Espace + clic : on déplace la carte
      if (e.button === 2 || e.button === 1 || this.space) { this.pan = { x: e.clientX, y: e.clientY }; return; }
      if (e.button !== 0) return;
      const t = this.tileAt(e.clientX, e.clientY);
      this.remember();
      if (this.tool === 'fill') {
        if (t.x >= 0 && t.y >= 0 && t.x < this.W && t.y < this.H) this.fill(t.x, t.y);
        return;
      }
      this.stamp(t.x, t.y);
      this.stroke = t;
    });
    c.addEventListener('pointermove', e => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (this.pan) {
        this.cam.x -= (e.clientX - this.pan.x) / this.cam.scale;
        this.cam.y -= (e.clientY - this.pan.y) / this.cam.scale;
        this.pan = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!this.stroke) return;
      const t = this.tileAt(e.clientX, e.clientY);
      if (t.x === this.stroke.x && t.y === this.stroke.y) return;
      this.line(this.stroke.x, this.stroke.y, t.x, t.y);
      this.stroke = t;
    });
    const up = () => { this.stroke = null; this.pan = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!this.stroke && !this.pan) this.mouse = null; });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15, cam = this.cam;
      const wx = cam.x + e.clientX / cam.scale, wy = cam.y + e.clientY / cam.scale;
      cam.scale = Math.max(0.3, Math.min(40, cam.scale * f));
      cam.x = wx - e.clientX / cam.scale;
      cam.y = wy - e.clientY / cam.scale;
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'text') return; // (on écrit le nom de la carte)
      if (e.code === 'Space') { this.space = true; e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); return e.shiftKey ? this.doRedo() : this.doUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); return this.doRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); return this.save(); }
      const m = /^(Digit|Numpad)([0-9])$/.exec(e.code);
      if (m) return this.setBrush(PALETTE[m[2] === '0' ? 9 : +m[2] - 1]);
      if (e.code === 'KeyB') this.setTool('paint');
      if (e.code === 'KeyF') this.setTool('fill');
      if (e.key === '[') this.setSize(this.size - 1);
      if (e.key === ']') this.setSize(this.size + 1);
    });
    window.addEventListener('keyup', e => { if (e.code === 'Space') this.space = false; });
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

Ed.init();
