// 🎨 AFFICHAGE
// La carte est dessinée dans une petite image (1 pixel = 1 case),
// puis agrandie à l'écran selon le zoom.

const Render = {
  cam: { x: 0, y: 0, scale: 4 },
  hover: -1,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = this.vw * this.dpr;
    this.canvas.height = this.vh * this.dpr;
  },

  setupMap() {
    const G = Game;
    this.off = document.createElement('canvas');
    this.off.width = G.W;
    this.off.height = G.H;
    this.offCtx = this.off.getContext('2d');
    this.img = this.offCtx.createImageData(G.W, G.H);
    this.dirty = new Uint8Array(G.N);
    this.dirtyList = [];
    for (let i = 0; i < G.N; i++) this.paintTile(i);
    this.offCtx.putImageData(this.img, 0, 0);
    this.fit();
  },

  fit() {
    const s = Math.min(this.vw / Game.W, this.vh / Game.H) * 0.95;
    this.cam.scale = s;
    this.minScale = s * 0.6;
    this.maxScale = 40;
    this.cam.x = Game.W / 2 - this.vw / 2 / s;
    this.cam.y = Game.H / 2 - this.vh / 2 / s;
  },

  zoomAt(sx, sy, factor) {
    const c = this.cam;
    const wx = c.x + sx / c.scale, wy = c.y + sy / c.scale;
    c.scale = Math.max(this.minScale, Math.min(this.maxScale, c.scale * factor));
    c.x = wx - sx / c.scale;
    c.y = wy - sy / c.scale;
  },

  tileAt(sx, sy) {
    const x = Math.floor(this.cam.x + sx / this.cam.scale);
    const y = Math.floor(this.cam.y + sy / this.cam.scale);
    if (x < 0 || y < 0 || x >= Game.W || y >= Game.H) return -1;
    return y * Game.W + x;
  },

  markDirty(i) {
    if (!this.dirty) return;
    const add = j => { if (!this.dirty[j]) { this.dirty[j] = 1; this.dirtyList.push(j); } };
    add(i);
    Game.forNeighbors(i, add);
  },

  isBorder(i, o) {
    let border = false;
    Game.forNeighbors(i, n => { if (Game.isLand(n) && Game.owner[n] !== o) border = true; });
    return border;
  },

  paintTile(i) {
    const G = Game, d = this.img.data, k = i * 4;
    const base = TERRAIN_INFO[G.terrain[i]].color, sh = G.map.shade[i];
    let r = base[0] + sh, g = base[1] + sh, b = base[2] + sh;
    const o = G.owner[i];
    if (o >= 0) {
      const pc = G.players[o].color;
      if (this.isBorder(i, o)) {
        r = pc[0] * 0.7; g = pc[1] * 0.7; b = pc[2] * 0.7;
      } else {
        r = r * 0.45 + pc[0] * 0.55; g = g * 0.45 + pc[1] * 0.55; b = b * 0.45 + pc[2] * 0.55;
      }
    }
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  },

  flush() {
    if (!this.dirtyList || !this.dirtyList.length) return;
    for (const i of this.dirtyList) { this.paintTile(i); this.dirty[i] = 0; }
    this.dirtyList.length = 0;
    this.offCtx.putImageData(this.img, 0, 0);
  },

  draw() {
    const ctx = this.ctx, G = Game, s = this.cam.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgb(52, 92, 130)';
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (!this.off) return;

    const ox = -this.cam.x * s, oy = -this.cam.y * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, ox, oy, G.W * s, G.H * s);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bâtiments
    if (s >= 3) {
      ctx.font = `${Math.max(9, Math.min(30, s * 1.6))}px serif`;
      for (const i of G.buildingTiles) {
        const px = ox + (i % G.W + 0.5) * s, py = oy + (((i / G.W) | 0) + 0.5) * s;
        if (px < -30 || py < -30 || px > this.vw + 30 || py > this.vh + 30) continue;
        ctx.fillText(BUILDINGS[G.building[i]].icon, px, py);
      }
    }

    // Case survolée (et aperçu de la capitale pendant le placement)
    if (this.hover >= 0 && (G.phase === 'spawn' || G.phase === 'playing')) {
      const hx = this.hover % G.W, hy = (this.hover / G.W) | 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      if (G.phase === 'spawn') {
        ctx.beginPath();
        ctx.arc(ox + (hx + 0.5) * s, oy + (hy + 0.5) * s, (CONFIG.START_RADIUS + 0.5) * s, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(ox + hx * s, oy + hy * s, s, s);
      }
    }

    // Noms des royaumes
    for (const p of G.players) {
      if (!p.alive || p.tiles === 0) continue;
      let size = Math.sqrt(p.tiles) * s * 0.2;
      if (size < 8) continue;
      size = Math.min(size, 42);
      const cx = ox + (p.sumX / p.tiles + 0.5) * s, cy = oy + (p.sumY / p.tiles + 0.5) * s;
      ctx.lineJoin = 'round';
      ctx.font = `700 ${size}px Cinzel, Georgia, serif`;
      ctx.lineWidth = Math.max(2, size / 5);
      ctx.strokeStyle = 'rgba(20,12,4,0.75)';
      ctx.fillStyle = p.isHuman ? '#ffe9a8' : '#fff';
      ctx.strokeText(p.name, cx, cy - size * 0.45);
      ctx.fillText(p.name, cx, cy - size * 0.45);
      ctx.font = `600 ${size * 0.75}px Georgia, serif`;
      ctx.strokeText('⚔ ' + fmt(p.troops), cx, cy + size * 0.55);
      ctx.fillText('⚔ ' + fmt(p.troops), cx, cy + size * 0.55);
    }
  },
};
