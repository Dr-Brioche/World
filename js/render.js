// 🎨 AFFICHAGE
// La carte est dessinée dans une petite image (1 pixel = 1 case),
// puis agrandie à l'écran selon le zoom.

// Zoom (en pixels par case) à partir duquel l'image des bâtiments apparaît
const CASTLE_IMG_ZOOM = 7;

const Render = {
  cam: { x: 0, y: 0, scale: 4 },
  hover: -1,
  mouse: null, // position de la souris à l'écran
  floaters: [], // petits chiffres qui s'envolent au-dessus des bâtiments (+3 💰, +2 ⚔️)

  // Case en haut à gauche d'un bâtiment de ce type, centré sous la souris
  anchorAt(sx, sy, type) {
    const n = Game.sizeOf(type);
    const x = Math.floor(this.cam.x + sx / this.cam.scale - n / 2 + 0.5);
    const y = Math.floor(this.cam.y + sy / this.cam.scale - n / 2 + 0.5);
    if (x < 0 || y < 0 || x > Game.W - n || y > Game.H - n) return -1;
    return y * Game.W + x;
  },

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
    // Nouvelle partie : on oublie les dessins gardés en mémoire de la partie d'avant
    // (Game.version repart de 0 : sans ça, ils pourraient être repris tels quels)
    this.hlCanvas = null; this.hlKey = null;
    this.wallsVersion = -1; this.pactVersion = -1;
    this.previewKey = null; this.planKey = null; this.buildable = null;
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

  // Centre la caméra sur un point de la carte (en cases), en zoomant un peu si on est très loin
  centerOn(x, y) {
    const c = this.cam;
    c.scale = Math.min(this.maxScale, Math.max(c.scale, 6));
    c.x = x - this.vw / 2 / c.scale;
    c.y = y - this.vh / 2 / c.scale;
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

  // Case au bord du royaume : elle touche une case d'un autre (ou libre), un fleuve, ou la mer / un lac
  // (la frontière se dessine donc aussi le long des côtes ; pas au pied des sommets enneigés)
  isBorder(i, o) {
    let border = false;
    Game.forNeighbors(i, n => { if (Game.owner[n] !== o && Game.terrain[n] !== TERRAIN.PEAK) border = true; });
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
      } else if (G.terrain[i] === TERRAIN.RIVER) {
        // un fleuve reste bien visible dans un royaume
        r = r * 0.7 + pc[0] * 0.3; g = g * 0.7 + pc[1] * 0.3; b = b * 0.7 + pc[2] * 0.3;
      } else {
        // La couleur du royaume prend la clarté du terrain (forêts et montagnes plus sombres, plaines et déserts
        // plus clairs, et le relief ombré), pour qu'on distingue bien le sol sous le royaume
        const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 160;
        r = r * 0.4 + pc[0] * lum * 0.6; g = g * 0.4 + pc[1] * lum * 0.6; b = b * 0.4 + pc[2] * lum * 0.6;
      }
    }
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  },

  flush() {
    if (!this.dirtyList || !this.dirtyList.length) return;
    // (on ne recopie que le rectangle qui contient les cases changées : sur une grande carte, c'est bien plus rapide)
    const W = Game.W;
    let x0 = W, y0 = Game.H, x1 = -1, y1 = -1;
    for (const i of this.dirtyList) {
      this.paintTile(i); this.dirty[i] = 0;
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    this.dirtyList.length = 0;
    this.offCtx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  },

  // --- Murailles des châteaux (et des ports de niveau 3) ---
  // La zone d'un château = les cases de son royaume dans le rayon de son niveau (voir CASTLE_LEVELS).
  // Un port de niveau 3 a aussi une petite muraille, autour de sa zone (comme un fort en bois).
  // On dessine une muraille sur chaque bord de case qui sépare la zone de l'extérieur :
  // elle suit donc la frontière sans jamais déborder chez le voisin.

  // Bords d'un ensemble de cases : [x1, y1, x2, y2, nx, ny] (n = direction de l'extérieur)
  zoneEdges(tiles, inZone) {
    const G = Game, edges = [];
    for (const i of tiles) {
      const x = i % G.W, y = (i / G.W) | 0;
      if (x === 0 || !inZone(i, i - 1)) edges.push([x, y, x, y + 1, -1, 0]);
      if (x === G.W - 1 || !inZone(i, i + 1)) edges.push([x + 1, y, x + 1, y + 1, 1, 0]);
      if (y === 0 || !inZone(i, i - G.W)) edges.push([x, y, x + 1, y, 0, -1]);
      if (y === G.H - 1 || !inZone(i, i + G.W)) edges.push([x, y + 1, x + 1, y + 1, 0, 1]);
    }
    return edges;
  },

  // Recalcule les murailles seulement quand la carte a changé
  updateWalls() {
    const G = Game;
    if (this.wallsVersion === G.version) return;
    this.wallsVersion = G.version;
    if (!this.protOwner || this.protOwner.length !== G.N) this.protOwner = new Int16Array(G.N);
    const prot = this.protOwner;
    prot.fill(-1);
    const tiles = [];
    const add = (zone, o) => {
      for (const i of zone) {
        if (prot[i] < 0) tiles.push(i);
        prot[i] = o;
      }
    };
    for (const c of G.castles) if (G.owner[c] >= 0) add(G.castleZone(c, G.owner[c]), G.owner[c]);
    for (const a of G.buildingTiles) {
      if (G.building[a] === B_PORT && G.level[a] >= 3 && G.owner[a] >= 0) add(G.churchZone(a), G.owner[a]);
    }
    this.wallEdges = this.zoneEdges(tiles, (i, n) => prot[n] === prot[i]);
  },

  // Dessine une muraille crénelée le long des bords donnés
  drawWall(ox, oy, edges, stone, dark) {
    if (!edges.length) return;
    const ctx = this.ctx, s = this.cam.scale;
    const w = Math.max(2.5, Math.min(9, s * 0.4));
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of edges) {
      ctx.moveTo(ox + x1 * s, oy + y1 * s);
      ctx.lineTo(ox + x2 * s, oy + y2 * s);
    }
    ctx.lineWidth = w + 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = stone;
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (s < 5) return; // trop petit pour voir les créneaux
    // Créneaux : deux petits blocs par bord de case, côté extérieur
    const m = w * 0.9;
    ctx.beginPath();
    for (const [x1, y1, x2, y2, nx, ny] of edges) {
      for (const t of [0.25, 0.75]) {
        const cx = ox + (x1 + (x2 - x1) * t) * s + nx * w * 0.6;
        const cy = oy + (y1 + (y2 - y1) * t) * s + ny * w * 0.6;
        ctx.rect(cx - m / 2, cy - m / 2, m, m);
      }
    }
    ctx.fillStyle = stone;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark;
    ctx.stroke();
  },

  // Remplit légèrement des cases (zone survolée ou aperçu)
  fillTiles(ox, oy, tiles, color) {
    const ctx = this.ctx, s = this.cam.scale, W = Game.W;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const i of tiles) ctx.rect(ox + (i % W) * s, oy + ((i / W) | 0) * s, s, s);
    ctx.fill();
  },

  drawCastleZones(ox, oy) {
    const G = Game;
    this.updateWalls();
    this.drawWall(ox, oy, this.wallEdges, '#b3aa98', 'rgba(30,22,12,0.9)');

    // Château survolé : sa zone est mise en avant
    if (this.hover >= 0 && G.building[this.hover] === B_CASTLE && G.owner[this.hover] >= 0) {
      const c = G.anchor[this.hover];
      this.fillTiles(ox, oy, G.castleZone(c, G.owner[c]), 'rgba(255,255,255,0.22)');
    }
    this.drawChurchZones(ox, oy);
    this.drawBuildableTiles(ox, oy);
    this.drawChurchCastleCircles(ox, oy);
    // Aperçu de la muraille avant de construire (ou d'améliorer) un château
    if (G.phase === 'playing' && UI.selectedBuild === B_CASTLE && this.hover >= 0 && this.mouse) {
      const upgrading = G.owner[this.hover] === G.human.id && G.building[this.hover] === B_CASTLE;
      const h = upgrading ? G.anchor[this.hover] : this.anchorAt(this.mouse.x, this.mouse.y, B_CASTLE);
      if (h < 0) return;
      const ok = upgrading ? G.upgradeCost(h) !== null : G.canPlace(G.human.id, h, B_CASTLE);
      const level = upgrading ? Math.min(3, G.level[h] + 1) : 1;
      const zone = G.castleZone(h, G.human.id, level);
      if (!zone.length) return;
      const set = new Set(zone);
      // Petite bulle près de la souris : la défense totale de la muraille (dessinée par-dessus tout, voir draw)
      const def = Math.round((G.castleZoneDefense(zone, level) - 1) * 100);
      this.castleTip = { x: this.mouse.x, y: this.mouse.y, text: `🛡️ Défense dans la muraille : +${def} %` };
      this.fillTiles(ox, oy, zone, ok ? 'rgba(255,230,120,0.3)' : 'rgba(220,60,50,0.3)');
      this.drawWall(ox, oy, this.zoneEdges(zone, (i, n) => set.has(n)),
        ok ? 'rgba(255,230,140,0.95)' : 'rgba(230,90,80,0.95)', 'rgba(30,22,12,0.8)');
    }
  },

  // Pendant la construction d'une église, d'un port ou d'un château : cercles rouges là où c'est interdit
  // (voir Game.placementCircles).
  drawChurchCastleCircles(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, t = UI.selectedBuild;
    if (G.phase !== 'playing' || (t !== B_CHURCH && t !== B_CASTLE && t !== B_PORT)) return;
    for (const { a, R } of G.placementCircles(G.human.id, t)) {
      const half = G.sizeOf(G.building[a]) / 2;
      const cx = ox + (a % G.W + half) * s, cy = oy + (((a / G.W) | 0) + half) * s;
      ctx.beginPath();
      ctx.arc(cx, cy, R * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220,50,40,0.12)';
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(230,60,50,0.95)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  // Zones des églises (là où elles permettent de construire) : on les montre quand on survole une église,
  // ou quand on s'apprête à poser un moulin ou une caserne
  // Pendant la pose d'un moulin ou d'une caserne : dans les zones où l'on peut construire (muraille de ses châteaux,
  // zone de ses églises et ports), chaque case est verte si le bâtiment peut s'y poser, rouge sinon
  // (trop près d'un autre bâtiment, fleuve, plus de place dans l'église…). Recalculé au plus 3 fois par seconde.
  drawBuildableTiles(ox, oy) {
    const G = Game, h = G.human, type = UI.selectedBuild;
    if (G.phase !== 'playing' || (type !== B_MILL && type !== B_BARRACKS)) { this.buildable = null; return; }
    const key = type + ':' + G.buildingTiles.length + ':' + G.works.size + ':' + h.tiles;
    const now = performance.now();
    if (!this.buildable || (this.buildable.key !== key && now - this.buildable.time > 300)) {
      const zone = new Set();
      for (const c of G.castles) if (G.owner[c] === h.id) for (const i of G.castleZone(c, h.id)) zone.add(i);
      for (const a of G.buildingTiles) if (G.owner[a] === h.id && G.hasSlots(a)) for (const i of G.churchZone(a)) zone.add(i);
      const ok = [], bad = [];
      for (const i of zone) (G.canPlace(h.id, i, type) ? ok : bad).push(i);
      this.buildable = { key, time: now, ok, bad };
    }
    this.fillTiles(ox, oy, this.buildable.ok, 'rgba(140,240,110,0.3)');
    this.fillTiles(ox, oy, this.buildable.bad, 'rgba(235,45,35,0.42)');
  },

  drawChurchZones(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale;
    if (G.phase !== 'playing') return;
    let churches = [];
    if (this.hover >= 0 && G.owner[this.hover] >= 0 && G.building[this.hover] && G.hasSlots(G.anchor[this.hover])) {
      churches = [G.anchor[this.hover]];
    } else if (UI.selectedBuild === B_MILL || UI.selectedBuild === B_BARRACKS) {
      churches = G.buildingTiles.filter(a => G.hasSlots(a) && G.owner[a] === G.human.id);
    }
    for (const ch of churches) {
      const zone = G.churchZone(ch), set = new Set(zone);
      const full = G.churchUsed(ch) >= G.buildingInfo(ch).slots;
      this.fillTiles(ox, oy, zone, full ? 'rgba(200,190,170,0.18)' : 'rgba(255,245,200,0.28)');
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of this.zoneEdges(zone, (i, n) => set.has(n))) {
        ctx.moveTo(ox + x1 * s, oy + y1 * s);
        ctx.lineTo(ox + x2 * s, oy + y2 * s);
      }
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = full ? 'rgba(120,110,95,0.9)' : 'rgba(255,240,190,0.95)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  // Bannière d'une armée : drapeau à la couleur de l'attaquant avec deux épées croisées,
  // ses soldats au-dessus et, s'il y en a, les défenseurs (bouclier à la couleur du défenseur).
  drawArmyBanner(a, bx, by, label) {
    const ctx = this.ctx, G = Game;
    // La bannière du royaume attaquant, avec deux épées croisées
    this.drawBannerImage(G.players[a.attacker], bx + 14, by, 46);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    Icons.draw(ctx, 'swords', bx + 2, by - 40, 15, '#f3e3bf');
    ctx.font = '700 12px Georgia, serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,12,4,0.85)';
    ctx.fillStyle = '#fff';
    Icons.text(ctx, label, bx + 16, by - 52);
    // Défenseurs engagés contre cet assaut
    const defenders = a.defenders + (a.garrison || 0);
    if (a.target >= 0 && defenders >= 1) {
      const sx = bx + 50, sy = by;
      this.drawBannerImage(G.players[a.target], sx, sy, 34); // bannière du défenseur
      ctx.font = '700 12px Georgia, serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,12,4,0.85)';
      ctx.fillStyle = '#ffe2a8';
      Icons.text(ctx, '🛡 ' + fmt(defenders), sx, sy - 40);
    }
    // Zone cliquable (le défenseur clique dessus pour envoyer ses soldats)
    this.bannerHits.push({ id: a.id, x: bx + 20, y: by - 24 });
  },

  // Flèche rouge d'un assaut, visible par tous : pointillés en légère courbe, un cercle au départ
  // (un peu à l'intérieur du royaume attaquant) et une cible (cercle + point) sur la zone attaquée.
  // alpha : transparence. Renvoie la fonction qui donne le point de la courbe à l'instant t
  // (0 = départ, 1 = cible).
  drawAttackArrow(x1, y1, x2, y2, alpha, side) {
    const ctx = this.ctx, now = performance.now();
    const red = `rgba(214,36,30,${alpha})`, dark = `rgba(40,8,4,${alpha * 0.7})`;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    // Point de contrôle de la courbe : décalé sur le côté, au milieu du trajet
    const bend = len * 0.18 * side;
    const mx = (x1 + x2) / 2 - (y2 - y1) / len * bend, my = (y1 + y2) / 2 + (x2 - x1) / len * bend;
    const at = t => ({
      x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2,
      y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2,
    });
    // (les cercles grossissent un peu avec le zoom ; la cible « bat » doucement)
    const zoom = Math.min(2.2, Math.max(1, this.cam.scale / 7));
    const rStart = 7 * zoom, rTarget = (11 + Math.sin(now / 250) * 1.5) * zoom;
    // La courbe s'arrête au bord des deux cercles
    const t0 = Math.min(0.45, rStart / len), t1 = Math.max(0.55, 1 - (rTarget + 4) / len);
    const curve = () => {
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const p = at(t0 + (t1 - t0) * k / 24);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    };
    ctx.lineCap = 'round';
    curve();
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -now / 40; // les pointillés défilent vers la cible
    ctx.lineWidth = 5;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = red;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // Pointe de flèche, orientée selon la fin de la courbe
    const end = at(t1), before = at(t1 - 0.03), ang = Math.atan2(end.y - before.y, end.x - before.x), h = 13;
    ctx.beginPath();
    ctx.moveTo(end.x + Math.cos(ang) * 3, end.y + Math.sin(ang) * 3);
    ctx.lineTo(end.x - h * Math.cos(ang - 0.45), end.y - h * Math.sin(ang - 0.45));
    ctx.lineTo(end.x - h * Math.cos(ang + 0.45), end.y - h * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = red;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark;
    ctx.stroke();
    // Cercle de départ
    const ring = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = dark;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = red;
      ctx.stroke();
    };
    ring(x1, y1, rStart);
    // Cible : un cercle et un point rouge au milieu
    ring(x2, y2, rTarget);
    ctx.beginPath();
    ctx.arc(x2, y2, 3.5 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = red;
    ctx.fill();
    return at;
  },

  // Assaut en préparation : les terres du défenseur juste en face de la bannière scintillent doucement
  // à la couleur de l'attaquant, et le bâtiment visé (s'il y en a un) est entouré d'un halo qui pulse.
  drawThreat(ox, oy, a) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, W = G.W;
    const col = G.players[a.attacker].color.join(',');
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    // Les cases menacées : celles du défenseur à moins de R cases du point de départ (calculées une fois),
    // rangées en anneaux : plus elles sont loin, plus elles sont pâles
    const R = 7;
    if (!a.threatTiles) {
      const st = a.startTile >= 0 ? a.startTile : -1, sx = st % W, sy = (st / W) | 0;
      a.threatTiles = [[], [], []];
      for (let dy = -R; dy <= R && st >= 0; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = sx + dx, y = sy + dy, d = Math.hypot(dx, dy);
          if (d > R || x < 0 || y < 0 || x >= W || y >= G.H) continue;
          const t = y * W + x;
          if (G.owner[t] === a.target) a.threatTiles[Math.min(2, Math.floor(d / R * 3))].push(t);
        }
      }
    }
    a.threatTiles.forEach((ring, k) => {
      ctx.fillStyle = `rgba(${col},${(0.35 + 0.35 * pulse) * (1 - k * 0.3)})`;
      ctx.beginPath();
      for (const t of ring) if (G.owner[t] === a.target) ctx.rect(ox + (t % W) * s, oy + ((t / W) | 0) * s, s, s);
      ctx.fill();
    });
    // Liseré pointillé autour de la zone menacée (recalculé seulement si la carte a changé)
    if (a.threatVersion !== G.version) {
      a.threatVersion = G.version;
      const set = new Set(a.threatTiles.flat().filter(t => G.owner[t] === a.target));
      a.threatEdges = this.zoneEdges(set, (i, n) => set.has(n));
    }
    ctx.beginPath();
    for (const [ex1, ey1, ex2, ey2] of a.threatEdges) {
      ctx.moveTo(ox + ex1 * s, oy + ey1 * s);
      ctx.lineTo(ox + ex2 * s, oy + ey2 * s);
    }
    ctx.lineWidth = Math.max(1.5, s * 0.2);
    ctx.strokeStyle = `rgba(${col},${0.6 + 0.4 * pulse})`;
    ctx.stroke();
    // Bâtiment visé : un halo qui pulse autour de lui
    const c = a.targetCastle;
    if (c >= 0 && G.building[c]) {
      const half = G.sizeOf(G.building[c]) / 2;
      const cx = ox + (c % W + half) * s, cy = oy + (((c / W) | 0) + half) * s;
      const r = (half + 1.2 + pulse * 0.6) * s;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, s * 0.5);
      ctx.strokeStyle = `rgba(${col},${0.6 + 0.4 * pulse})`;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(20,12,4,${0.4 + 0.3 * pulse})`;
      ctx.stroke();
    }
  },

  // Armées contre les royaumes : pendant la marche sur ses terres, la bannière avance de sa cité vers la
  // frontière, par son chemin (et le front menacé scintille, voir drawThreat) ; une fois l'assaut lancé,
  // une flèche rouge le montre et la bannière se tient là où se bat l'assaut.
  drawAttackArrows(ox, oy) {
    const ctx = this.ctx, G = Game, s = this.cam.scale;
    const now = performance.now();
    this.bannerHits = [];
    for (const a of G.attacks) {
      if (a.done || a.target < 0 || a.fromX === undefined) continue;
      const pending = a.pending.reduce((sum, r) => sum + r.troops, 0);
      const extra = pending ? ` (+${fmt(pending)})` : '';
      const x1 = ox + a.fromX * s, y1 = oy + a.fromY * s;
      const x2 = ox + a.toX * s, y2 = oy + a.toY * s;
      const side = a.id % 2 ? 1 : -1; // courbe d'un côté ou de l'autre, pour que deux flèches se croisent moins
      if (!G.isPreparing(a)) {
        // (pas de flèche pour un assaut de jonction : sa ligne mène au château isolé)
        // (ni pour l'assaut de front d'un territoire désorganisé : il n'a pas de cible précise)
        if (a.link === undefined && !a.unlinked && !a.disorganized) this.drawAttackArrow(x1, y1, x2, y2, 0.6, side);
        // (la bannière se tient à sa position lissée sur le front, voir moveBanner ; au début, sur la case du front)
        const t = a.frontTile >= 0 ? a.frontTile : -1;
        if (a.bannerX !== undefined) {
          // à l'écran, la bannière rejoint sa position en glissant (pas de saut d'une image à l'autre)
          if (a.drawX === undefined) { a.drawX = a.bannerX; a.drawY = a.bannerY; }
          a.drawX += (a.bannerX - a.drawX) * 0.08;
          a.drawY += (a.bannerY - a.drawY) * 0.08;
        }
        const bx = a.drawX !== undefined ? ox + a.drawX * s : t >= 0 ? ox + (t % G.W + 0.5) * s : ox + a.toX * s;
        const by = a.drawY !== undefined ? oy + a.drawY * s : t >= 0 ? oy + (((t / G.W) | 0) + 0.5) * s : oy + a.toY * s;
        // Assaut de jonction : une ligne pointillée montre le château isolé qu'il veut rejoindre
        if (a.link !== undefined) {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ox + a.toX * s, oy + a.toY * s);
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -now / 40;
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = `rgb(${G.players[a.attacker].color.join(',')})`;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
        }
        // Siège en cours : compte à rebours avant la chute du château
        const siege = a.retreatEnd !== undefined ? '🏳️ retraite · ' : a.clash !== undefined ? '⚔️ bataille · '
          : a.siege ? `${G.building[a.siege.tile] === B_OUTPOST ? '⛺' : '🏰'} ${Math.max(0, Math.ceil((a.siege.end - G.tick) / CONFIG.TICKS_PER_SECOND))} s · ` : '';
        // Deux armées qui s'affrontent au pied du même château : leurs bannières se font face
        const shift = a.clash !== undefined ? (a.attacker < a.clash ? -30 : 30) : 0;
        this.drawArmyBanner(a, bx + shift, by, `${siege}⚔ ${fmt(a.troops)}${extra}`);
        continue;
      }
      // Marche sur ses propres terres : pas de flèche. Le front menacé scintille à la couleur de l'attaquant,
      // et sa bannière avance de sa cité vers la frontière, avec ses soldats.
      this.drawThreat(ox, oy, a);
      const m = a.marchFrom ? G.marchPosition(a) : null, st = a.startTile >= 0 ? a.startTile : -1;
      // le reste du chemin de la marche (le plus rapide sur ses terres), en pointillés
      if (a.march) {
        this.walkTrail(a.march, ox, oy);
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${G.players[a.attacker].color.join(',')},0.7)`;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const bx = m ? ox + m.x * s : st >= 0 ? ox + (st % G.W + 0.5) * s : x1;
      const by = m ? oy + m.y * s : st >= 0 ? oy + (((st / G.W) | 0) + 0.5) * s : y1;
      this.drawArmyBanner(a, bx, by, a.retreatEnd !== undefined ? `🏳️ retraite · ${fmt(a.troops)}` : `⚔ ${fmt(a.troops)}${extra}`);
    }
  },

  // Trajet à pied (Game.walkRoute) : prépare le tracé du reste du chemin (à dessiner ensuite avec stroke)
  // et renvoie la position actuelle du groupe, en pixels
  walkTrail(r, ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, pos = G.walkPosition(r);
    const x = ox + pos.x * s, y = oy + pos.y * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = pos.k; k < r.pts.length; k++) ctx.lineTo(ox + r.pts[k].x * s, oy + r.pts[k].y * s);
    return { x, y };
  },

  // Défenseurs en route vers un assaut : leur bannière marche du château vers le combat (visible par tous)
  drawDefendersOnTheWay(ox, oy) {
    const G = Game, ctx = this.ctx;
    for (const a of G.attacks) {
      if (a.done || !a.defPending || !a.defPending.length || a.target < 0) continue;
      const d = G.players[a.target];
      for (const r of a.defPending) {
        const { x, y } = this.walkTrail(r, ox, oy); // (les pointillés du reste du trajet)
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(${d.color.join(',')},0.85)`;
        ctx.stroke();
        ctx.setLineDash([]);
        this.drawBannerImage(d, x, y, 30);
        ctx.font = '700 12px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20,12,4,0.85)';
        ctx.fillStyle = '#fff';
        Icons.text(ctx, '🛡 ' + fmt(r.troops), x, y - 22);
      }
    }
  },

  // Petit fanion rouge (mât et drapeau triangulaire) : marque un de nos bâtiments isolés
  drawIsolatedFlag(x, y) {
    const ctx = this.ctx, h = 22;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2b1a0c';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - 14, y - h + 5);
    ctx.lineTo(x, y - h + 10);
    ctx.closePath();
    ctx.fillStyle = '#d0352a';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },

  // Défenseurs qui rentrent à pied vers leur ville (l'assaut qu'ils allaient contrer est fini)
  drawReturning(ox, oy) {
    const G = Game, ctx = this.ctx;
    for (const r of G.returning) {
      const p = G.players[r.pid];
      const { x, y } = this.walkTrail(r, ox, oy);
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${p.color.join(',')},0.6)`;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.75;
      this.drawBannerImage(p, x, y, 26);
      ctx.globalAlpha = 1;
      ctx.font = '700 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,12,4,0.85)';
      ctx.fillStyle = '#fff';
      Icons.text(ctx, '↩ ' + fmt(r.troops), x, y - 20);
    }
  },

  // Expédition ennemie qui vise notre côte : la zone où elle va débarquer est marquée en rouge (elle clignote)
  drawLandingWarnings(ox, oy) {
    const G = Game, h = G.human, ctx = this.ctx, s = this.cam.scale;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    for (const e of G.expeditions) {
      if (e.done || e.home !== undefined || e.reinforce !== undefined || e.pid === h.id || G.owner[e.landing] !== h.id) continue;
      // zone de débarquement (recalculée seulement si la carte a changé)
      if (e.warnVersion !== G.version) {
        e.warnVersion = G.version;
        const zone = G.landingZone(e.pid, e.landing).tiles, set = new Set(zone);
        e.warnTiles = zone;
        e.warnEdges = this.zoneEdges(zone, (i, n) => set.has(n));
      }
      this.fillTiles(ox, oy, e.warnTiles, `rgba(230,40,30,${0.2 + 0.25 * pulse})`);
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of e.warnEdges) {
        ctx.moveTo(ox + x1 * s, oy + y1 * s);
        ctx.lineTo(ox + x2 * s, oy + y2 * s);
      }
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(200,20,15,${0.6 + 0.4 * pulse})`;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  // Bateaux d'expédition : ils avancent sur l'eau vers la côte visée (visibles par tous)
  drawExpeditions(ox, oy) {
    const G = Game;
    // Traversées de fleuve : un radeau avance le long du gué
    for (const c of G.crossings) {
      const t = Math.min(1, (G.tick - c.start) / Math.max(1, c.arrive - c.start));
      this.drawBoat(ox, oy, c.path, t, c.pid, null, '🛶');
    }
    for (const e of G.expeditions) {
      // soldats à bord (ils diminuent un peu pendant la traversée)
      const t = Math.min(1, (G.tick - e.start) / Math.max(1, e.arrive - e.start));
      this.drawBoat(ox, oy, e.path, t, e.pid, e.sent - (e.sent - e.troops) * t);
    }
  },

  // Bateau qui avance le long de son trajet (t = 0 au départ, 1 à l'arrivée), avec ses soldats à bord (null = aucun)
  drawBoat(ox, oy, path, t, pid, troops, icon = '⛵') {
    const G = Game, ctx = this.ctx, s = this.cam.scale, W = G.W;
    const px = i => ox + (i % W + 0.5) * s, py = i => oy + (((i / W) | 0) + 0.5) * s;
    const k = Math.min(path.length - 1, Math.floor(t * path.length));
    const x = px(path[k]), y = py(path[k]);
    // le reste du trajet en pointillés
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = k + 1; j < path.length; j += 2) ctx.lineTo(px(path[j]), py(path[j]));
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${G.players[pid].color.join(',')},0.9)`;
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawBannerImage(G.players[pid], x + 12, y - 2, 30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // (la nef ou le radeau, sur un petit rond sombre pour bien se voir sur l'eau)
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,12,4,0.6)';
    ctx.fill();
    Icons.draw(ctx, icon, x, y, 18, '#f3e3bf');
    ctx.font = '700 12px Georgia, serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,12,4,0.85)';
    ctx.fillStyle = '#fff';
    if (troops !== null) { // (un radeau de traversée n'emporte pas de soldats de l'armée)
      Icons.text(ctx, '⚔ ' + fmt(troops), x, y - 18);
    }
    return { x, y };
  },

  // Bannière cliquée (à l'écran) : renvoie l'id de l'assaut, ou -1
  bannerAt(sx, sy) {
    for (const b of this.bannerHits || []) {
      if (Math.abs(sx - b.x) < 30 && Math.abs(sy - b.y) < 24) return b.id;
    }
    return -1;
  },

  // Images des bannières des royaumes (chargées une seule fois)
  bannerImages: BANNERS.map(b => {
    const img = new Image();
    img.src = b.img;
    return img;
  }),

  // Dessine la bannière d'un royaume ; (x, y) = pied du mât, h = hauteur
  drawBannerImage(p, x, y, h) {
    const img = this.bannerImages[p.banner];
    if (!img.complete || !img.naturalWidth) return 0;
    const w = h * img.naturalWidth / img.naturalHeight;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(img, x - w / 2, y - h, w, h);
    this.ctx.imageSmoothingEnabled = false;
    return w;
  },

  // Images de chaque niveau des bâtiments (chargées une seule fois)
  // (un niveau sans image garde son icône)
  buildingImages: BUILDING_LEVELS.map(levels => levels && levels.map(l => {
    if (!l || !l.img) return null;
    const img = new Image();
    img.src = l.img;
    return img;
  })),

  // Image des bâtiments sans niveaux (l'avant-poste)
  simpleImages: BUILDINGS.map(b => {
    if (!b || !b.img) return null;
    const img = new Image();
    img.src = b.img;
    return img;
  }),

  // Royaume survolé (un autre que le sien) : tout son territoire est mis en surbrillance
  hoveredKingdom() {
    const G = Game, h = this.hover;
    if (G.phase !== 'playing' || h < 0 || UI.selectedBuild || UI.plan) return -1;
    const o = G.owner[h];
    return o >= 0 && G.human && o !== G.human.id ? o : -1;
  },

  drawHoveredKingdom(ox, oy) {
    const G = Game, o = this.hoveredKingdom();
    if (o < 0) return;
    // Une petite image (1 pixel = 1 case) des terres de ce royaume, refaite si on survole un autre royaume,
    // ou au plus 3 fois par seconde si la carte a changé (sur une grande carte, c'est un gros calcul)
    const now = performance.now();
    if (this.hlKey !== o || (this.hlVersion !== G.version && now - (this.hlTime || 0) > 300)) {
      this.hlKey = o; this.hlVersion = G.version; this.hlTime = now;
      if (!this.hlCanvas) {
        this.hlCanvas = document.createElement('canvas');
        this.hlCanvas.width = G.W; this.hlCanvas.height = G.H;
        this.hlImg = this.hlCanvas.getContext('2d').createImageData(G.W, G.H);
      }
      const d = this.hlImg.data;
      for (let i = 0; i < G.N; i++) {
        const k = i * 4, mine = G.owner[i] === o;
        d[k] = 255; d[k + 1] = 245; d[k + 2] = 200; d[k + 3] = mine ? 115 : 0;
      }
      this.hlCanvas.getContext('2d').putImageData(this.hlImg, 0, 0);
    }
    const ctx = this.ctx, s = this.cam.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.hlCanvas, ox, oy, G.W * s, G.H * s);
  },

  // ... et ses bâtiments (ses « propriétés ») sont entourés d'un cercle doré
  drawHoveredBuildings(ox, oy) {
    const G = Game, o = this.hoveredKingdom();
    if (o < 0) return;
    const ctx = this.ctx, s = this.cam.scale;
    for (const a of G.buildingTiles) {
      if (G.owner[a] !== o) continue;
      const half = G.sizeOf(G.building[a]) / 2;
      const x = ox + (a % G.W + half) * s, y = oy + (((a / G.W) | 0) + half) * s;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(9, s * half * 1.5), 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255,215,90,0.95)';
      ctx.stroke();
    }
  },

  // Petite étiquette au-dessus d'un bâtiment : garnison, soldats stationnés, temps de construction
  drawBuildingLabel(a, type, x, y) {
    const G = Game, ctx = this.ctx, parts = [];
    const o = type === B_OUTPOST ? G.outposts.get(a) : null;
    // (avant-poste en construction : pas de garnison, juste des soldats affaiblis qui bâtissent)
    if (G.builders(a) >= 1) parts.push(`⚔ ${fmt(G.builders(a))} affaiblis`);
    else if (G.garrison[a] >= 1) parts.push('🛡️ ' + fmt(G.garrison[a]));
    if (o && G.outpostReady(a) && o.stationed >= 1) parts.push('⚔ ' + fmt(o.stationed));
    if (o && !G.outpostReady(a)) parts.push(`🏗️ ${Math.ceil((o.ready - G.tick) / CONFIG.TICKS_PER_SECOND)} s`);
    if (!parts.length) return;
    const f = ctx.font, txt = parts.join('  ');
    ctx.font = '700 12px Georgia, serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,12,4,0.85)';
    ctx.fillStyle = '#ffe9a8';
    Icons.text(ctx, txt, x, y);
    ctx.font = f;
  },

  // Bâtiment sans niveaux : icône de loin, image quand on zoome (s'il en a une)
  drawSimpleBuilding(type, px, py, imgAlpha) {
    const ctx = this.ctx, s = this.cam.scale, img = this.simpleImages[type];
    const ready = img && img.complete && img.naturalWidth;
    const a = ready ? imgAlpha : 0;
    if (a < 1) {
      ctx.globalAlpha = 1 - a;
      Icons.badge(ctx, type, px, py, parseFloat(ctx.font.match(/([\d.]+)px/)[1]));
      ctx.globalAlpha = 1;
    }
    if (a > 0) {
      const half = Game.sizeOf(type) / 2, w = BUILDINGS[type].size * s, h = w * img.naturalHeight / img.naturalWidth;
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, px - w / 2, py + s * (half + 0.1) - h, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
  },

  // Aperçu du bâtiment qu'on s'apprête à poser, sous la souris, à moitié transparent. Comme les vrais bâtiments :
  // de loin, sa version simplifiée (son icône) ; de près, son image (niveau 1).
  drawBuildingGhost(type, px, py, ok) {
    const ctx = this.ctx, s = this.cam.scale, half = Game.sizeOf(type) / 2;
    const levels = BUILDING_LEVELS[type];
    const img = levels ? this.buildingImages[type][1] : this.simpleImages[type];
    const size = levels ? levels[1].size : BUILDINGS[type].size;
    const ready = img && img.complete && img.naturalWidth && size;
    const imgAlpha = ready ? Math.max(0, Math.min(1, (s - CASTLE_IMG_ZOOM) / 3)) : 0; // (même fondu que sur la carte)
    const alpha = ok ? 0.8 : 0.55;
    if (imgAlpha < 1) {
      ctx.globalAlpha = alpha * (1 - imgAlpha);
      ctx.font = `${Math.max(16, Math.min(20 * half, s * half * 2))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      Icons.badge(ctx, type, px, py, parseFloat(ctx.font.match(/([\d.]+)px/)[1]));
    }
    if (imgAlpha > 0) {
      const w = size * s, h = w * img.naturalHeight / img.naturalWidth;
      ctx.globalAlpha = alpha * imgAlpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, px - w / 2, py + s * (half + 0.1) - h, w, h);
      ctx.imageSmoothingEnabled = false;
    }
    ctx.globalAlpha = 1;
  },

  // Bâtiment survolé qu'on peut sélectionner d'un clic (un des siens à améliorer, son avant-poste à renforcer,
  // ou une cible ennemie à attaquer) : la souris devient une main et le bâtiment s'illumine
  selectableAt(i) {
    const G = Game, h = G.human, t = G.building[i];
    if (i < 0 || !t || G.phase !== 'playing' || !h.alive || UI.selectedBuild || UI.plan) return -1;
    const o = G.owner[i];
    if (o === h.id && (BUILDING_LEVELS[t] || t === B_OUTPOST)) return G.anchor[i];
    if (o >= 0 && o !== h.id && !G.areAllied(o, h.id) && TARGET_TYPES.includes(t) && (G.isProtected(o) || t === B_OUTPOST)) return G.anchor[i];
    return -1;
  },

  // Travaux en cours (amélioration ou démolition) : une petite jauge sous le bâtiment, qui se remplit
  drawWorks(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale;
    for (const [a, w] of G.works) {
      const n = G.sizeOf(G.building[a]), k = Math.min(1, (G.tick - w.start) / Math.max(1, w.end - w.start));
      const bw = Math.max(26, n * s), bh = Math.max(5, s * 0.4);
      const x = ox + (a % G.W + n / 2) * s - bw / 2, y = oy + (((a / G.W) | 0) + n) * s + 3;
      ctx.fillStyle = 'rgba(20,12,4,0.75)';
      ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = w.kind === 'up' ? '#e6b422' : w.kind === 'build' ? '#4f9d3a' : '#c0392b';
      ctx.fillRect(x, y, bw * k, bh);
    }
  },

  // Curseur « épée » (au lieu de la petite main) quand on survole une cible qu'on peut vraiment attaquer :
  // une épée dessinée en SVG, la pointe en haut à gauche (c'est là que se fait le clic)
  SWORD_CURSOR: 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<g stroke-linecap="round">' +
    '<path d="M2 2L20 20" stroke="#1c1208" stroke-width="6"/><path d="M15 25L25 15M20 20L27 27" stroke="#1c1208" stroke-width="6"/>' +
    '<path d="M2 2L20 20" stroke="#e9e6dc" stroke-width="3"/><path d="M4 4L19 19" stroke="#ffffff" stroke-width="1"/>' +
    '<path d="M15 25L25 15" stroke="#d9a520" stroke-width="3"/><path d="M21 21L26 26" stroke="#7a4a22" stroke-width="3"/>' +
    '<circle cx="28" cy="28" r="2.6" fill="#d9a520" stroke="#1c1208" stroke-width="1.2"/></g></svg>') + '") 2 2, pointer',

  // Curseur habituel sur la carte : une petite main médiévale (gantelet de cuir à manchette dorée) qui pointe
  // de l'index (le clic se fait au bout du doigt)
  HAND_CURSOR: 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<path d="M7 16V4a2.5 2.5 0 0 1 5 0v8.5h.8a2.3 2.3 0 0 1 4.2.6a2.3 2.3 0 0 1 4.2.8a2.1 2.1 0 0 1 3.8 1.3V21c0 3-2.2 4.5-5 4.5h-6.5' +
    'c-2.3 0-3.4-1.2-4.4-2.6l-3.6-5.2a1.9 1.9 0 0 1 3-2.3z" fill="#dcc39a" stroke="#2a1a0c" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M12.8 12.5v4.2M17 13.1v4M21.2 14v3.6" stroke="#2a1a0c" stroke-width="1.1" stroke-linecap="round"/>' +
    '<path d="M8.5 6.5h2" stroke="#8a6a44" stroke-width="1" stroke-linecap="round"/>' +
    '<rect x="9.5" y="24.6" width="14" height="5.6" rx="1.2" fill="#c9962b" stroke="#2a1a0c" stroke-width="1.4"/>' +
    '<circle cx="12.5" cy="27.4" r="0.9" fill="#2a1a0c"/><circle cx="16.5" cy="27.4" r="0.9" fill="#2a1a0c"/><circle cx="20.5" cy="27.4" r="0.9" fill="#2a1a0c"/>' +
    '</svg>') + '") 9 1, auto',

  // Armée ennemie survolée sur laquelle on peut cliquer (un assaut contre nous : clic = envoyer des défenseurs) :
  // renvoie sa zone cliquable { id, x, y } (à l'écran), ou null
  armyUnderMouse() {
    const G = Game, m = this.mouse;
    if (!m || G.phase !== 'playing' || !G.human || !G.human.alive || UI.selectedBuild) return null;
    for (const b of this.bannerHits || []) {
      if (Math.abs(m.x - b.x) >= 30 || Math.abs(m.y - b.y) >= 24) continue;
      const a = G.attacks.find(a => a.id === b.id && !a.done);
      if (a && a.target === G.human.id && !G.isPreparing(a)) return b; // (en marche chez lui : pas encore attaquable)
    }
    return null;
  },

  // Petit cercle de ciblage rouge (qui tourne) autour de l'armée ennemie survolée, comme pour viser une ville
  drawArmyTarget() {
    const b = this.armyUnderMouse();
    if (!b) return;
    const ctx = this.ctx, now = performance.now(), r = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.setLineDash([8, 5]);
    ctx.lineDashOffset = -now / 30;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff5b3a';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    // quatre petits traits de visée
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(b.x + dx * (r - 6), b.y + dy * (r - 6));
      ctx.lineTo(b.x + dx * (r + 7), b.y + dy * (r + 7));
    }
    ctx.stroke();
    ctx.restore();
  },

  // La souris est-elle sur une cible qu'on peut attaquer ? (a = bâtiment sélectionnable survolé, ou -1)
  // Château, église, port ou avant-poste ennemi atteignable, cible déjà visée (2e clic pour lancer),
  // terres ennemies qui s'attaquent de front (sans château, ou coupées de leurs châteaux),
  // ou armée ennemie qui nous attaque. (Nos bâtiments gardent la petite main.)
  attackableUnderMouse(a) {
    const G = Game, h = G.human, i = this.hover;
    if (this.armyUnderMouse()) return true;
    if (!h || G.phase !== 'playing' || !h.alive || UI.selectedBuild || i < 0) return false;
    const o = G.owner[i];
    if (o < 0 || o === h.id || G.areAllied(o, h.id)) return false;
    const p = UI.plan;
    if (p) return p.castle >= 0 ? G.anchor[i] === p.castle && !!G.building[i] : o === p.target;
    if (a >= 0) return !G.truceLeft(a) && !!(this.castlePreview && this.castlePreview.castle === a && this.castlePreview.path);
    return !G.isProtected(o) || G.isUnlinked(i);
  },

  drawSelectable(ox, oy) {
    const G = Game, a = this.selectableAt(this.hover);
    // épée sur une cible attaquable, main médiévale ailleurs ; pendant une construction, le curseur de pose (voir UI)
    const cursor = UI.selectedBuild ? '' : this.attackableUnderMouse(a) ? this.SWORD_CURSOR : this.HAND_CURSOR;
    // (on garde le dernier curseur choisi : le navigateur réécrit l'adresse de l'image à sa façon)
    if (this.curCursor !== cursor) { this.curCursor = cursor; this.canvas.style.cursor = cursor; }
    if (a < 0) return;
    const ctx = this.ctx, s = this.cam.scale, n = G.sizeOf(G.building[a]);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    const pad = Math.max(2, s * 0.3), x = ox + (a % G.W) * s - pad, y = oy + ((a / G.W) | 0) * s - pad, w = n * s + pad * 2;
    const mine = G.owner[a] === G.human.id;
    ctx.save();
    ctx.shadowColor = mine ? 'rgba(255,215,90,0.9)' : 'rgba(255,90,60,0.9)';
    ctx.shadowBlur = 10 + 6 * pulse;
    ctx.fillStyle = mine ? `rgba(255,230,140,${0.15 + 0.15 * pulse})` : `rgba(255,120,90,${0.12 + 0.12 * pulse})`;
    ctx.fillRect(x, y, w, w);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = mine ? '#ffd34d' : '#ff6a4d';
    ctx.strokeRect(x, y, w, w);
    ctx.restore();
  },

  // Bâtiment à niveaux (moulin, caserne, château, église) : icône de loin, image quand on zoome
  drawLeveledBuilding(i, px, py, imgAlpha) {
    const ctx = this.ctx, s = this.cam.scale, G = Game;
    const type = G.building[i], lvl = G.level[i] || 1, info = BUILDING_LEVELS[type][lvl];
    const img = this.buildingImages[type][lvl];
    if (!img) imgAlpha = 0; // pas d'image : toujours l'icône
    const half = G.sizeOf(type) / 2; // demi-côté du bâtiment, en cases
    // De loin : l'icône et le niveau en chiffres romains
    if (imgAlpha < 1) {
      ctx.globalAlpha = 1 - imgAlpha;
      Icons.badge(ctx, type, px, py, parseFloat(ctx.font.match(/([\d.]+)px/)[1]));
      if (lvl > 1 && s >= 5) {
        const f = Math.max(8, Math.min(14, s * 0.8));
        ctx.font = `700 ${f}px Georgia, serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20,12,4,0.85)';
        ctx.fillStyle = '#ffe9a8';
        const roman = ['', 'I', 'II', 'III'][lvl];
        Icons.text(ctx, roman, px + s * half * 1.2, py - s * half * 0.8);
      }
      ctx.globalAlpha = 1;
    }
    // De près : la vraie image, posée sur son carré de cases
    if (imgAlpha > 0 && img.complete && img.naturalWidth) {
      const w = info.size * s, h = w * img.naturalHeight / img.naturalWidth;
      ctx.globalAlpha = imgAlpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, px - w / 2, py + s * (half + 0.1) - h, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
  },

  // Fait apparaître un petit chiffre qui monte au-dessus d'un bâtiment (production)
  floatText(a, type, text) {
    const half = Game.sizeOf(type) / 2;
    this.floaters.push({ x: a % Game.W + half, y: ((a / Game.W) | 0), text, color: type === B_BARRACKS ? '#ffffff' : '#ffd75e', start: performance.now() });
  },

  drawFloaters(ox, oy) {
    const ctx = this.ctx, s = this.cam.scale, now = performance.now(), LIFE = 1800;
    this.floaters = this.floaters.filter(f => now - f.start < LIFE);
    const size = Math.max(11, Math.min(18, s * 1.2));
    ctx.font = `700 ${size}px Georgia, serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    for (const f of this.floaters) {
      const t = (now - f.start) / LIFE; // 0 → 1
      const x = ox + f.x * s, y = oy + f.y * s - 6 - t * 28; // il monte...
      ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;        // ...puis s'efface
      ctx.strokeStyle = 'rgba(20,12,4,0.85)';
      ctx.fillStyle = f.color;
      Icons.text(ctx, f.text, x, y);
    }
    ctx.globalAlpha = 1;
  },

  // Frontière dorée autour de chaque pacte : on trace les bords des cases d'un royaume
  // membre d'un pacte qui touchent une case hors du pacte (autre royaume, terre libre, mer).
  // Les frontières entre alliés ne sont donc pas dorées : le pacte forme un seul bloc.
  updatePactEdges() {
    const G = Game;
    if (this.pactVersion === G.version) return;
    this.pactVersion = G.version;
    if (!G.pacts.size) { this.pactEdges = []; return; } // (aucun pacte : rien à chercher sur la carte)
    const pactOf = i => (G.owner[i] >= 0 ? G.players[G.owner[i]].pact : -1);
    const tiles = [];
    for (let i = 0; i < G.N; i++) if (pactOf(i) >= 0) tiles.push(i);
    this.pactEdges = this.zoneEdges(tiles, (i, n) => pactOf(n) === pactOf(i));
  },

  drawPactBorders(ox, oy) {
    this.updatePactEdges();
    if (!this.pactEdges.length) return;
    const ctx = this.ctx, s = this.cam.scale;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of this.pactEdges) {
      ctx.moveTo(ox + x1 * s, oy + y1 * s);
      ctx.lineTo(ox + x2 * s, oy + y2 * s);
    }
    ctx.lineCap = 'square';
    ctx.lineWidth = Math.max(3, s * 0.35) + 2;
    ctx.strokeStyle = 'rgba(60,40,5,0.75)';
    ctx.stroke();
    ctx.lineWidth = Math.max(3, s * 0.35);
    ctx.strokeStyle = '#f2c94c';
    ctx.stroke();
    ctx.lineCap = 'butt';
  },

  // Routes des châteaux (niveau 2 : chemins de terre, niveau 3 : routes pavées)
  // Tracé en lignes droites avec un coin à 90°, comme des rails.
  // On dessine d'abord TOUS les contours, puis TOUS les intérieurs : ainsi les routes
  // se fondent aux carrefours au lieu de se couper les unes les autres.
  drawRoads(ox, oy) {
    const ctx = this.ctx, G = Game, s = this.cam.scale;
    const w = Math.max(2, s * 0.55);
    const dirt = new Path2D(), paved = new Path2D();
    for (const [a, link] of G.roads()) {
      // (le tracé, avec son coin à angle droit, est le même que pour le jeu : voir Game.roadPoints)
      const pts = G.roadPoints(a, link.castle).map(([x, y]) => [ox + x * s, oy + y * s]);
      const path = link.road === 'paved' ? paved : dirt;
      path.moveTo(pts[0][0], pts[0][1]);
      path.lineTo(pts[1][0], pts[1][1]);
      path.lineTo(pts[2][0], pts[2][1]);
    }
    // Chemins de terre des églises (vers une route de port ou une ville), voir Game.churchLink
    for (const [, link] of G.roadChurches || []) {
      const pts = link.pts.map(([x, y]) => [ox + x * s, oy + y * s]);
      dirt.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) dirt.lineTo(pts[k][0], pts[k][1]);
    }
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    // 1. Contours sombres de toutes les routes
    ctx.lineWidth = w + 2;
    ctx.strokeStyle = 'rgba(95,68,36,0.7)';
    ctx.stroke(dirt);
    ctx.strokeStyle = 'rgba(60,58,54,0.85)';
    ctx.stroke(paved);
    // 2. Intérieurs
    ctx.lineWidth = w;
    ctx.strokeStyle = '#b38a55';
    ctx.stroke(dirt);
    ctx.strokeStyle = '#b4b0a6';
    ctx.stroke(paved);
    // 3. Pavés, visibles en zoomant
    if (s >= 6) {
      ctx.setLineDash([w * 0.5, w * 0.35]);
      ctx.lineWidth = w * 0.6;
      ctx.strokeStyle = '#8f8b82';
      ctx.stroke(paved);
      ctx.setLineDash([]);
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
  },

  // Survol d'un château ennemi : on montre le chemin de l'assaut (pointillés dorés),
  // ou une croix rouge si d'autres fortifications bloquent le passage.
  // Trace un chemin d'assaut (pointillés), case par case
  strokePath(ox, oy, path, color, width) {
    const ctx = this.ctx, s = this.cam.scale, W = Game.W;
    ctx.beginPath();
    path.forEach((i, k) => {
      const x = ox + (i % W + 0.5) * s, y = oy + (((i / W) | 0) + 0.5) * s;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineJoin = 'round';
    ctx.lineWidth = width + 2.5;
    ctx.strokeStyle = 'rgba(20,12,4,0.6)';
    ctx.stroke();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.setLineDash([]);
  },

  // Cible d'assaut choisie par le joueur (en attente du 2e clic) : le chemin de l'armée, et la cible entourée
  // d'un cercle rouge qui tourne
  drawAssaultPlan(ox, oy) {
    const G = Game, p = UI.plan, ctx = this.ctx, s = this.cam.scale, W = G.W;
    let cx, cy, r;
    if (p.castle >= 0) {
      // (chemin recalculé si la cible change, ou au plus 3 fois par seconde si la carte change : c'est un gros calcul)
      const key = p.castle + ':' + p.source, now = performance.now();
      if (this.planKey !== key || (this.planVersion !== G.version && now - this.planTime > 300)) {
        this.planKey = key; this.planVersion = G.version; this.planTime = now;
        this.planPath = G.castlePath(G.human.id, p.castle, p.source);
      }
      if (this.planPath) this.strokePath(ox, oy, this.planPath, '#ffd34d', 3);
      const n = G.sizeOf(G.building[p.castle]);
      cx = ox + (p.castle % W + n / 2) * s;
      cy = oy + (((p.castle / W) | 0) + n / 2) * s;
      r = Math.max(12, s * n * 0.75);
    } else {
      cx = ox + (p.tile % W + 0.5) * s;
      cy = oy + (((p.tile / W) | 0) + 0.5) * s;
      r = Math.max(10, s * 1.5);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.setLineDash([8, 5]);
    ctx.lineDashOffset = -performance.now() / 30;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff5b3a';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  },

  drawCastleAssaultPreview(ox, oy) {
    const G = Game, h = this.hover;
    this.castlePreview = null;
    if (UI.plan && G.phase === 'playing') return this.drawAssaultPlan(ox, oy);
    if (G.phase !== 'playing' || h < 0 || UI.selectedBuild || !G.human.alive) return;
    const o = G.owner[h];
    if (!TARGET_TYPES.includes(G.building[h]) || o < 0 || o === G.human.id || G.areAllied(o, G.human.id)) return;
    // Le chemin le plus court, depuis le royaume ou un avant-poste (comme l'assaut qui partira), recalculé
    // si la cible change, ou au plus 3 fois par seconde si la carte change (c'est un gros calcul)
    const c = G.anchor[h], now = performance.now();
    if (this.previewKey !== c || (this.previewVersion !== G.version && now - this.previewTime > 300)) {
      this.previewKey = c; this.previewVersion = G.version; this.previewTime = now;
      this.previewPath = null;
      for (const src of G.attackSources(G.human.id)) {
        const path = G.castlePath(G.human.id, c, src);
        if (path && (!this.previewPath || path.length < this.previewPath.length)) this.previewPath = path;
      }
    }
    this.castlePreview = { castle: c, path: this.previewPath };
    const ctx = this.ctx, s = this.cam.scale, W = G.W;
    if (this.previewPath) {
      this.strokePath(ox, oy, this.previewPath, '#ffd34d', 2.5);
    } else {
      const n = G.sizeOf(G.building[c]), cx = ox + (c % W + n / 2) * s, cy = oy + (((c / W) | 0) + n / 2) * s;
      const r = Math.max(10, s * n * 0.5);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#c0281e';
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
    }
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
    this.drawHoveredKingdom(ox, oy);

    this.drawRoads(ox, oy);
    this.drawPactBorders(ox, oy);
    this.drawCastleZones(ox, oy);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bâtiments : petites icônes de loin, vraies images quand on zoome
    const imgAlpha = Math.max(0, Math.min(1, (s - CASTLE_IMG_ZOOM) / 3));
    if (s >= 3) {
      for (const i of G.buildingTiles) {
        // Centre du bâtiment = milieu de son carré ; icône à sa taille
        const type = G.building[i], half = G.sizeOf(type) / 2;
        const px = ox + (i % G.W + half) * s, py = oy + (((i / G.W) | 0) + half) * s;
        if (px < -300 || py < -300 || px > this.vw + 300 || py > this.vh + 300) continue;
        ctx.font = `${Math.max(9, Math.min(20 * half, s * half * 2))}px serif`;
        if (BUILDING_LEVELS[type]) this.drawLeveledBuilding(i, px, py, imgAlpha);
        else this.drawSimpleBuilding(type, px, py, imgAlpha);
        // Un de nos châteaux (ou ports royaux) coupé de notre royaume : un petit fanion rouge au-dessus
        if (G.owner[i] === G.human.id && G.holdsAlone(i) && G.isIsolated(i)) this.drawIsolatedFlag(px - half * s - 4, py + 6);
        // Au-dessus du bâtiment : 🛡 sa garnison, ⚔ les soldats stationnés (avant-poste), 🏗️ la construction
        if (s >= 4) {
          // (au-dessus de l'image quand on la voit, sinon au-dessus de l'icône)
          const info = BUILDING_LEVELS[type] ? BUILDING_LEVELS[type][G.level[i] || 1] : BUILDINGS[type];
          const top = imgAlpha > 0.5 && info.size ? info.size * 0.8 : half;
          this.drawBuildingLabel(i, type, px, py - s * top - 8);
        }
      }
    }

    // Case survolée (et aperçu de la capitale pendant le placement)
    if (this.hover >= 0 && (G.phase === 'spawn' || G.phase === 'playing')) {
      const hx = this.hover % G.W, hy = (this.hover / G.W) | 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      if (G.phase === 'spawn') {
        // Aperçu de la capitale : blanc si on peut la fonder ici, rouge sinon (trop près d'un rival…)
        const ok = !G.spawnError(this.hover);
        ctx.beginPath();
        ctx.arc(ox + (hx + 0.5) * s, oy + (hy + 0.5) * s, (CONFIG.START_RADIUS + 0.5) * s, 0, Math.PI * 2);
        ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(230,70,60,0.95)';
        ctx.lineWidth = ok ? 1.5 : 2.5;
        ctx.stroke();
      } else if (UI.selectedBuild && this.mouse) {
        // Aperçu de l'emplacement du bâtiment (2x2 ou 4x4 cases)
        const t = UI.selectedBuild, n = G.sizeOf(t);
        // (château posé sur un de nos châteaux : c'est une amélioration, l'aperçu se cale sur lui)
        const upgrading = t === B_CASTLE && G.building[this.hover] === B_CASTLE && G.owner[this.hover] === G.human.id;
        const a = upgrading ? G.anchor[this.hover] : this.anchorAt(this.mouse.x, this.mouse.y, t);
        if (a >= 0) {
          const ok = upgrading ? G.upgradeCost(a) !== null : G.canPlace(G.human.id, a, t);
          const rx = ox + (a % G.W) * s, ry = oy + ((a / G.W) | 0) * s;
          ctx.fillStyle = ok ? 'rgba(255,255,255,0.25)' : 'rgba(230,80,70,0.4)';
          ctx.fillRect(rx, ry, n * s, n * s);
          ctx.lineWidth = 2;
          ctx.strokeStyle = ok ? '#1f6b1a' : '#a3261f';
          ctx.strokeRect(rx, ry, n * s, n * s);
          this.drawBuildingGhost(t, rx + n * s / 2, ry + n * s / 2, ok);
        }
      } else {
        ctx.strokeRect(ox + hx * s, oy + hy * s, s, s);
      }
    }


    // Noms des royaumes
    for (const p of G.players) {
      if (!p.alive || p.tiles === 0) continue;
      let size = Math.sqrt(p.tiles) * s * 0.2;
      if (G.phase === 'spawn') size = Math.max(size, 13); // avant de fonder sa capitale : on voit bien qui est où
      if (size < 8) continue;
      size = Math.min(size, 42);
      const cx = ox + (p.sumX / p.tiles + 0.5) * s, cy = oy + (p.sumY / p.tiles + 0.5) * s;
      ctx.lineJoin = 'round';
      ctx.font = `700 ${size}px Cinzel, Georgia, serif`;
      ctx.lineWidth = Math.max(2, size / 5);
      ctx.strokeStyle = 'rgba(20,12,4,0.75)';
      ctx.fillStyle = p.isHuman ? '#ffe9a8' : '#fff';
      let label = !p.isHuman && G.areAllied(p.id, G.human.id) ? '🤝 ' + p.name : p.name;
      if (G.isTraitor(p)) label = '🗡️ ' + label;
      Icons.text(ctx, label, cx, cy - size * 0.45);
      // La bannière du royaume, à gauche de son nom
      const tw = ctx.measureText(label).width;
      this.drawBannerImage(p, cx - tw / 2 - size * 0.55, cy + size * 0.6, size * 1.9);
      ctx.font = `600 ${size * 0.75}px Georgia, serif`;
      Icons.text(ctx, '⚔ ' + fmt(p.troops), cx, cy + size * 0.55);
    }

    this.drawCastleAssaultPreview(ox, oy);
    this.drawHoveredBuildings(ox, oy);
    this.drawSelectable(ox, oy);
    this.drawWorks(ox, oy);
    this.drawFloaters(ox, oy);

    // Par-dessus tout le reste, pour bien les voir
    this.drawLandingWarnings(ox, oy);
    this.drawExpeditions(ox, oy);
    this.drawDefendersOnTheWay(ox, oy);
    this.drawReturning(ox, oy);
    this.drawAttackArrows(ox, oy);
    this.drawArmyTarget();
    this.drawCastleTip();
  },

  // Bulle d'info pendant la pose (ou l'amélioration) d'un château : la défense totale de sa muraille
  drawCastleTip() {
    const tip = this.castleTip;
    this.castleTip = null; // (recalculée à chaque image tant qu'on vise un emplacement)
    if (!tip) return;
    const ctx = this.ctx;
    ctx.font = '700 13px Georgia, serif';
    const w = ctx.measureText(tip.text).width + 16, h = 24;
    const x = Math.min(tip.x + 18, this.vw - w - 4), y = Math.min(tip.y + 18, this.vh - h - 4);
    ctx.fillStyle = 'rgba(241,228,195,0.95)';
    ctx.strokeStyle = '#5a3a1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, 6) : ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b1d0e';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    Icons.text(ctx, tip.text, x + 8, y + h / 2 + 1, false);
  },
};
