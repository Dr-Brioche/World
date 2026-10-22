// 🎨 AFFICHAGE
// La carte est dessinée dans une petite image (1 pixel = 1 case),
// puis agrandie à l'écran selon le zoom.

// Zoom (en pixels par case) à partir duquel l'image des bâtiments apparaît
const CASTLE_IMG_ZOOM = 7;

// Hauteur de chaque terrain pour les ombres qui suivent les formes (voir Render.writeTile), en dixièmes :
// la mer et les fleuves sont plus bas que la terre, les forêts un peu plus hautes, puis collines, montagnes, sommets
const FINE_LEVEL = new Int8Array(16);
FINE_LEVEL[TERRAIN.WATER] = -6; FINE_LEVEL[TERRAIN.GREAT_RIVER] = -5; FINE_LEVEL[TERRAIN.RIVER] = -3;
// (les marches entre collines, montagnes et sommets restent faibles : ce sont les crêtes, voir buildLight, qui
//  font le relief ; sinon on aurait des étages arrondis, comme un gâteau)
FINE_LEVEL[TERRAIN.FOREST] = 4; FINE_LEVEL[TERRAIN.HILLS] = 4; FINE_LEVEL[TERRAIN.WOODED_HILLS] = 4; FINE_LEVEL[TERRAIN.SNOW] = 4; FINE_LEVEL[TERRAIN.MOUNTAIN] = 6; FINE_LEVEL[TERRAIN.PEAK] = 8;

const Render = {
  cam: { x: 0, y: 0, scale: 4 },
  hover: -1,
  mouse: null, // position de la souris à l'écran
  floaters: [], // petits chiffres qui s'envolent au-dessus des bâtiments (+3 💰, +2 ⚔️)

  // Case en haut à gauche d'un bâtiment de ce type, centré sous la souris
  anchorAt(sx, sy, type) {
    const n = Game.sizeOf(type);
    // (une mine s'aimante sur le filon le plus proche de la souris, à moins de 5 cases)
    if (type === B_MINE) {
      const mx = this.cam.x + sx / this.cam.scale, my = this.cam.y + sy / this.cam.scale;
      let best = -1, bestD = 5;
      for (const d of Game.deposits) {
        const dd = Math.hypot(d.a % Game.W + 1 - mx, ((d.a / Game.W) | 0) + 1 - my);
        if (dd < bestD) { bestD = dd; best = d.a; }
      }
      if (best >= 0) return best;
    }
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

  // La carte est une image : F x F pixels par case (4 x 4, ou 2 x 2 sur une très grande carte, pour la mémoire),
  // où les coins en escalier sont adoucis (voir scale2x)
  setupMap() {
    const G = Game, F = G.N <= CONFIG.SMOOTH_FINE_MAX_TILES ? 4 : 2;
    this.F = F;
    this.off = document.createElement('canvas');
    this.off.width = G.W * F;
    this.off.height = G.H * F;
    this.offCtx = this.off.getContext('2d');
    this.img = this.offCtx.createImageData(G.W * F, G.H * F);
    this.tileCol = new Uint8ClampedArray(G.N * 3); // couleur de chaque case
    this.tileKey = new Int32Array(G.N);            // « sorte » de case : royaume, terrain, frontière (voir paintTile)
    this.sub = new Int32Array(G.N * 4);            // grille 2 x 2 par case : la case dont chaque quart prend la couleur
    this.q = [0, 0, 0, 0]; this.q2 = [0, 0, 0, 0];
    this.key1 = n => this.tileKey[n];              // (sorte d'une case, puis d'un quart de case)
    this.key2 = n => this.tileKey[this.sub[n]];
    this.dirty = new Uint8Array(G.N);
    this.dirtyList = [];
    // Les petites variations de couleur de chaque case (map.shade), en partie adoucies (moyenne avec les voisines) :
    // un léger grain de cases (MAP_SHADE_RAW), sans faire un damier trop marqué (MAP_SHADE_SOFT)
    const W = G.W, H = G.H, sh = G.map.shade;
    this.shade = new Int8Array(G.N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        sum += sh[yy * W + xx]; n++;
      }
      this.shade[y * W + x] = Math.round(sum / n * CONFIG.MAP_SHADE_SOFT + sh[y * W + x] * CONFIG.MAP_SHADE_RAW);
    }
    this.buildLight();
    for (let i = 0; i < G.N; i++) this.paintTile(i);
    for (let i = 0; i < G.N; i++) this.smoothQuarters(i);
    // hauteur de chaque petit carré de l'image (pour les ombres qui suivent les formes : voir fineTile)
    this.fineLv = new Int8Array(G.N * F * F);
    this.pixT = new Uint8Array(G.N * F * F); // (et son terrain, pour les lignes entre les terrains : voir borderChunk)
    this.forests = null;
    for (let i = 0; i < G.N; i++) this.fineTile(i);
    for (let i = 0; i < G.N; i++) this.writeTile(i);
    this.offCtx.putImageData(this.img, 0, 0);
    // Nouvelle partie : on oublie les dessins gardés en mémoire de la partie d'avant
    // (Game.version repart de 0 : sans ça, ils pourraient être repris tels quels)
    this.hlCanvas = null; this.hlKey = null;
    this.wallsVersion = -1; this.pactVersion = -1;
    this.previewKey = null; this.planKey = null; this.buildable = null;
    this.buildForests();
    this.buildParchment();
    this.fit();
  },

  // --- Carte parchemin (vue de très loin) ---
  // Quand on dézoome au maximum, la carte devient une vieille carte sur parchemin : terres beiges ombrées par le
  // relief, côtes soulignées à l'encre, mer gris-vert, fleuves foncés, et les royaumes en couleurs légères.
  // Une image d'un pixel par case, tenue à jour comme la carte (voir flush).
  buildParchment() {
    const G = Game;
    this.parch = document.createElement('canvas');
    this.parch.width = G.W; this.parch.height = G.H;
    this.parchCtx = this.parch.getContext('2d');
    this.parchImg = this.parchCtx.createImageData(G.W, G.H);
    for (let i = 0; i < G.N; i++) this.paintParchment(i);
    this.parchCtx.putImageData(this.parchImg, 0, 0);
  },

  paintParchment(i) {
    const G = Game, W = G.W, t = G.terrain[i], o = G.owner[i], x = i % W, y = (i / W) | 0, d = this.parchImg.data, k = i * 4;
    const l = this.lightAt(x + 0.5, y + 0.5), grain = this.shade[i] * 0.6;
    let r, g, b;
    if (t === TERRAIN.WATER || t === TERRAIN.GREAT_RIVER) {
      // (la profondeur de la mer, adoucie : sur le parchemin, juste une nuance)
      const lw = 1 + (l - 1) * 0.45;
      [r, g, b] = [150, 160, 140].map(v => v * lw + grain);
    } else if (t === TERRAIN.RIVER) {
      [r, g, b] = [112, 118, 100];
    } else {
      // les montagnes bien marquées (comme les hachures d'une vieille carte), les sommets plus clairs ; les collines
      // juste un peu (pour ne pas faire « papier froissé ») ; les terres basses (plaine, forêt, désert) presque plates
      const high = t === TERRAIN.MOUNTAIN || t === TERRAIN.PEAK, hill = t === TERRAIN.HILLS || t === TERRAIN.WOODED_HILLS || t === TERRAIN.SNOW;
      const relief = 1 + Math.max(-0.45, Math.min(0.45, (l - 1) * (high ? 1.8 : hill ? 0.8 : 0.5)));
      const woods = t === TERRAIN.FOREST || t === TERRAIN.WOODED_HILLS;
      const base = t === TERRAIN.PEAK ? [238, 228, 205] : t === TERRAIN.SNOW ? [234, 228, 214] : woods ? [200, 186, 140] : [222, 202, 156];
      [r, g, b] = base.map(v => v * relief + grain);
      // la côte, soulignée à l'encre
      if (G.hasNeighbor(i, n => G.terrain[n] === TERRAIN.WATER)) { r *= 0.7; g *= 0.68; b *= 0.62; }
    }
    // les royaumes : une teinte légère de leur couleur, et leur frontière bien nette
    if (o >= 0) {
      const pc = G.players[o].color, border = this.isBorder(i, o), a = border ? 0.75 : 0.3;
      r = r * (1 - a) + pc[0] * (border ? 0.8 : 1) * a;
      g = g * (1 - a) + pc[1] * (border ? 0.8 : 1) * a;
      b = b * (1 - a) + pc[2] * (border ? 0.8 : 1) * a;
    }
    d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
  },

  // Part de la carte parchemin à l'écran (0 à 1) : elle apparaît quand on dézoome presque au maximum (PARCHMENT_ZOOM :
  // de quel zoom elle commence à apparaître, et où elle est complète, en fractions du zoom « toute la carte »)
  parchmentAlpha() {
    const [from, full] = CONFIG.PARCHMENT_ZOOM, s = this.cam.scale / (this.fitScale || 1);
    return Math.max(0, Math.min(1, (from - s) / (from - full)));
  },

  // --- Forêts, et bordures des terrains ---
  // Une fine ligne entre deux terrains différents, qui suit les carrés de la carte dessinée (voir borderChunk). Et
  // des petits sapins dans les forêts, posés un peu au hasard (un toutes les FOREST_TREE_SPACING cases environ).
  // Rangés par paquets de 32 x 32 cases, en coordonnées de cases.
  buildForests() {
    const G = Game, W = G.W, H = G.H, N = G.N, C = 32, cw = Math.ceil(W / C), T = G.terrain;
    const chunk = (map, x, y) => {
      const key = ((y / C) | 0) * cw + ((x / C) | 0);
      let p = map.get(key);
      if (!p) map.set(key, p = new Path2D());
      return p;
    };
    // Bordures entre les terrains : préparées paquet par paquet au moment de les dessiner (voir borderChunk)
    const borders = { terrain: new Map() };
    // Sapins : sur une grille un peu décalée au hasard (toujours le même hasard pour une case donnée)
    const trees = new Map(), S = CONFIG.FOREST_TREE_SPACING, forest = i => T[i] === TERRAIN.FOREST || T[i] === TERRAIN.WOODED_HILLS;
    const rnd = (x, y, k) => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0) % 1000 / 1000;
    for (let gy = 0; gy < H; gy += S) for (let gx = 0; gx < W; gx += S) {
      const x = Math.min(W - 1, gx + Math.floor(rnd(gx, gy, 1) * S)), y = Math.min(H - 1, gy + Math.floor(rnd(gx, gy, 2) * S));
      // (le sapin dépasse vers le haut : la case au-dessus doit être en forêt aussi)
      if (y < 1 || !forest(y * W + x) || !forest((y - 1) * W + x)) continue;
      const tx = x + 0.5, ty = y + 0.6, z = 0.85 + rnd(gx, gy, 3) * 0.3, p = chunk(trees, x, y);
      // deux étages de branches (triangles) et un petit tronc
      p.moveTo(tx, ty - 1.25 * z); p.lineTo(tx + 0.45 * z, ty - 0.45 * z); p.lineTo(tx - 0.45 * z, ty - 0.45 * z); p.closePath();
      p.moveTo(tx, ty - 0.8 * z); p.lineTo(tx + 0.65 * z, ty + 0.15 * z); p.lineTo(tx - 0.65 * z, ty + 0.15 * z); p.closePath();
      p.rect(tx - 0.1 * z, ty + 0.15 * z, 0.2 * z, 0.3 * z);
    }
    this.forests = { C, cw, borders, trees };
  },

  // Bordures des terrains (plaines, déserts, courbes de niveau du relief, puis forêts par-dessus) et sapins
  drawForests(ox, oy) {
    const s = this.cam.scale, k = this.forests;
    if (!k || s < CONFIG.CONTOUR_MIN_ZOOM) return;
    const ctx = this.ctx, C = k.C;
    const x0 = Math.max(0, Math.floor(this.cam.x / C)), y0 = Math.max(0, Math.floor((this.cam.y - 2) / C));
    const x1 = Math.min(k.cw - 1, Math.floor((this.cam.x + this.vw / s) / C)), y1 = Math.min(Math.ceil(Game.H / C) - 1, Math.floor((this.cam.y + this.vh / s + 2) / C));
    const trees = s >= CONFIG.FOREST_TREE_ZOOM;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.lineWidth = 1.2 / s;
    ctx.lineCap = 'square';
    // (bordures dessinées entre les terrains : seulement si TERRAIN_BORDERS ; discrètes, un peu plus nettes en
    // zoomant ; les sapins, eux, sont toujours là)
    if (CONFIG.TERRAIN_BORDERS) {
      ctx.strokeStyle = `rgba(40,28,14,${Math.min(CONFIG.TERRAIN_BORDER_ALPHA, 0.16 + (s - CONFIG.CONTOUR_MIN_ZOOM) * 0.03)})`;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const key = cy * k.cw + cx;
        ctx.stroke(k.borders.terrain.get(key) || this.borderChunk(key));
      }
    }
    if (trees) {
      ctx.fillStyle = `rgba(14,52,18,${Math.min(0.32, 0.22 + (s - CONFIG.FOREST_TREE_ZOOM) * 0.015)})`;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const tree = k.trees.get(cy * k.cw + cx);
        if (tree) ctx.fill(tree);
      }
    }
    ctx.restore();
  },

  // Le décor autour de la carte (CONFIG.DECOR_IMAGE) : une image chargée une seule fois
  decorImage: (() => { const img = new Image(); img.src = CONFIG.DECOR_IMAGE; return img; })(),

  // Le cadre brodé (CONFIG.FRAME_IMAGE) : une tapisserie dont le milieu (FRAME_INNER) reçoit la carte
  frameImage: (() => { const img = new Image(); img.src = CONFIG.FRAME_IMAGE; return img; })(),

  // Le cadre à la forme de la carte : l'image est plus large que la plupart des cartes ; on l'allonge (ou on l'élargit)
  // en recopiant une bande de ses bords, alternativement à l'endroit et en miroir (les raccords ne se voient pas), sans
  // jamais étirer ses dessins. Renvoie { canvas, x0, y0, iw } (iw : largeur du rectangle de la carte), ou null.
  frameCanvas() {
    const img = this.frameImage, G = Game;
    if (!img.complete || !img.naturalWidth) return null;
    const key = G.W + 'x' + G.H;
    if (this.frame && this.frame.key === key) return this.frame;
    const [x0, y0, x1, y1] = CONFIG.FRAME_INNER, [sx, sy] = CONFIG.FRAME_SPLIT, iw = x1 - x0, ih = y1 - y0, a = G.W / G.H;
    const gx = a > iw / ih ? Math.round(ih * a - iw) : 0, gy = a < iw / ih ? Math.round(iw / a - ih) : 0;
    // (rallonge src de gap pixels à la ligne at, le long d'un axe ; vertical : true = en hauteur)
    const extend = (src, gap, at, vertical) => {
      if (gap <= 0) return src;
      const c = document.createElement('canvas'), w = src.width, h = src.height;
      c.width = vertical ? w : w + gap; c.height = vertical ? h + gap : h;
      const ctx = c.getContext('2d');
      // (un morceau de src : de p à p + len le long de l'axe, posé en q, en miroir ou non)
      const piece = (p, len, q, flip) => {
        if (len <= 0) return;
        ctx.save();
        if (vertical) {
          if (flip) { ctx.translate(0, q + len); ctx.scale(1, -1); ctx.drawImage(src, 0, p, w, len, 0, 0, w, len); }
          else ctx.drawImage(src, 0, p, w, len, 0, q, w, len);
        } else if (flip) { ctx.translate(q + len, 0); ctx.scale(-1, 1); ctx.drawImage(src, p, 0, len, h, 0, 0, len, h); }
        else ctx.drawImage(src, p, 0, len, h, q, 0, len, h);
        ctx.restore();
      };
      const size = vertical ? h : w;
      piece(0, at, 0, false);                      // le début de l'image, jusqu'à la ligne at
      const pairs = Math.ceil(gap / (2 * CONFIG.FRAME_BAND));
      let q = at;
      for (let k = 0; k < pairs; k++) {
        // une bande juste avant at, en miroir puis à l'endroit : elle repart de la ligne at, et y revient
        const b = Math.floor(gap / (2 * pairs)) + (k === pairs - 1 ? gap - 2 * pairs * Math.floor(gap / (2 * pairs)) : 0);
        piece(at - b, b, q, true); q += b;
        piece(at - b, b, q, false); q += b;
      }
      piece(at, size - at, at + gap, false);       // la suite de l'image
      return c;
    };
    const canvas = extend(extend(img, gx, sx, false), gy, sy, true);
    // L'intérieur des panneaux illustrés, dans la partie rallongée : des nuages brodés (plus discret qu'une copie)
    const P = CONFIG.FRAME_PANELS, ctx = canvas.getContext('2d'), rand = mulberry32(7);
    if (gy > 0) for (const [a, b] of [P.left, P.right]) this.embroideredClouds(ctx, a + gx * (a > sx), sy, b - a, gy, rand, true);
    if (gx > 0) for (const [a, b] of [P.top, P.bottom]) this.embroideredClouds(ctx, sx, a + gy * (a > sy), gx, b - a, rand, false);
    this.frame = { key, canvas, x0, y0, iw: iw + gx };
    return this.frame;
  },

  // Des nuages brodés, dans le style de la tapisserie, dans le rectangle (x, y, w, h) : un ciel gris-bleu strié (le
  // tissage), et des bancs de nuages allongés, comme sur les tapisseries : le dessous plat, le dessus en festons, un
  // contour sombre, l'ombre en bas et quelques coutures ; puis le grain de la toile par-dessus. Tout autour, une bordure
  // brodée de fil d'or : une séparation assumée avec les dessins d'origine.
  embroideredClouds(ctx, x, y, w, h, rand, vertical) {
    const over = 0; // (les nuages restent dans leur cadre de fil d'or)
    const zone = () => { ctx.beginPath(); if (vertical) ctx.rect(x, y - over, w, h + over * 2); else ctx.rect(x - over, y, w + over * 2, h); ctx.clip(); };
    // le ciel, seulement dans la partie ajoutée, avec de fines stries claires (le tissage)
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sky = vertical ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
    sky.addColorStop(0, '#3e4749'); sky.addColorStop(0.5, '#4a5352'); sky.addColorStop(1, '#3e4749');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(130,130,115,0.25)';
    ctx.lineWidth = 1;
    for (let yy = y + 3; yy < y + h; yy += 5 + rand() * 6) {
      const x1 = x + rand() * w * 0.6, x2 = x1 + 15 + rand() * w * 0.5;
      ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
    }
    ctx.restore();
    // un banc de nuages : centré en (cx, cy), large de bw ; le dessous plat (un peu ondulé), le dessus en festons
    const bank = (cx, cy, bw) => {
      const left = cx - bw / 2, base = cy, n = 2 + Math.floor(rand() * 4), bumps = [];
      let total = 0;
      for (let k = 0; k < n; k++) { const v = 0.6 + rand(); bumps.push(v); total += v; }
      const path = new Path2D(), arcs = [];
      path.moveTo(left, base);
      let px = left;
      for (const v of bumps) {
        const bwk = bw * v / total, hk = bwk * (0.4 + rand() * 0.4) + 3;
        path.ellipse(px + bwk / 2, base, bwk / 2, hk, 0, Math.PI, 0);
        arcs.push([px + bwk / 2, base, bwk / 2, hk]);
        px += bwk;
      }
      path.quadraticCurveTo(cx, base + 4 + rand() * 3, left, base);
      path.closePath();
      ctx.fillStyle = '#8e856e';
      ctx.fill(path);
      // l'ombre du dessous, et le contour
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = '#665e4d';
      ctx.fillRect(left - 2, base - 4, bw + 4, 10);
      ctx.restore();
      ctx.strokeStyle = '#211910';
      ctx.lineWidth = 1.4;
      ctx.stroke(path);
      // les coutures : un feston plus petit dans chaque bosse
      ctx.strokeStyle = 'rgba(70,62,48,0.9)';
      ctx.lineWidth = 1;
      for (const [ax, ay, rx, ry] of arcs) {
        if (rand() < 0.35) continue;
        ctx.beginPath();
        ctx.ellipse(ax, ay - 1, rx * 0.6, ry * 0.55, 0, Math.PI * 1.05, Math.PI * 1.85);
        ctx.stroke();
      }
    };
    ctx.save();
    zone();
    if (vertical) {
      // des bancs empilés, décalés à gauche ou à droite (le bord de la colonne les coupe, comme sur la tapisserie)
      for (let yy = y + 26 + rand() * 10; yy < y + h - 18; yy += 24 + rand() * 18) {
        // (parfois juste un fin filet de nuage, comme une brume brodée)
        if (rand() < 0.25) {
          const x1 = x + rand() * w * 0.4, x2 = x1 + w * (0.3 + rand() * 0.4);
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#211910'; ctx.lineWidth = 4.5;
          ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
          ctx.strokeStyle = '#7e7663'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke();
          continue;
        }
        const bw = w * (0.5 + rand() * 0.7), cx = rand() < 0.5 ? x + bw * (0.2 + rand() * 0.25) : x + w - bw * (0.2 + rand() * 0.25);
        bank(cx, yy, bw);
      }
    } else {
      for (let yy = y + 20; yy < y + h; yy += 22 + rand() * 12) {
        for (let xx = x - rand() * 40; xx < x + w + 40; xx += 70 + rand() * 50) bank(xx, yy, 60 + rand() * 50);
      }
    }
    ctx.restore();
    // le grain de la toile, par-dessus (le même que le fond de la tapisserie, pris au milieu de l'image)
    const img = this.frameImage, [ix, iy] = CONFIG.FRAME_INNER;
    ctx.save();
    zone();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.8;
    for (let ty = y - over; ty < y + h + over; ty += 200) {
      for (let tx = x - over; tx < x + w + over; tx += 200) ctx.drawImage(img, ix + 300, iy + 60, 200, 200, tx, ty, 200, 200);
    }
    ctx.restore();
    // la bordure de fil d'or : un cordon torsadé (un trait sombre, l'or, puis de petits points de broderie en biais)
    const cord = new Path2D();
    cord.rect(x + 2.5, y + 2.5, w - 5, h - 5);
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#24180b';
    ctx.stroke(cord);
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = '#b48a34';
    ctx.stroke(cord);
    ctx.lineWidth = 1.8;
    ctx.setLineDash([2.2, 1.6]);
    ctx.strokeStyle = '#e6c26a';
    ctx.stroke(cord);
    ctx.lineDashOffset = 1.9;
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#6e4f1c';
    ctx.stroke(cord);
    ctx.restore();
  },

  // Où est le décor (en cases) : centré sur la carte, DECOR_SIZE fois plus large qu'elle, assez haut pour la
  // dépasser aussi en haut et en bas, et assez grand pour remplir l'écran au plus fort dézoom (écran haut ou large)
  decorRect() {
    const W = Game.W, H = Game.H, img = this.decorImage;
    const a = img.naturalWidth ? img.naturalWidth / img.naturalHeight : 16 / 9; // (largeur / hauteur de l'image)
    const far = (this.fitScale || 1) * CONFIG.PARCHMENT_ZOOM[2];                  // (le plus fort dézoom)
    const w = Math.max(Math.max(W, H * a) * CONFIG.DECOR_SIZE, this.vw / far, this.vh / far * a), h = w / a;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  },

  // La caméra ne montre jamais plus loin que le décor : pas trop de dézoom, et pas trop loin sur les côtés
  clampCam() {
    const c = this.cam, d = this.decorRect();
    c.scale = Math.max(c.scale, this.vw / d.w, this.vh / d.h);
    c.x = Math.max(d.x, Math.min(d.x + d.w - this.vw / c.scale, c.x));
    c.y = Math.max(d.y, Math.min(d.y + d.h - this.vh / c.scale, c.y));
  },

  // Zoom : de très près (maxScale) jusqu'à toute la carte, et un cran de plus en arrière, où elle devient une
  // carte parchemin (voir parchmentAlpha)
  fit() {
    const s = Math.min(this.vw / Game.W, this.vh / Game.H) * 0.95;
    this.cam.scale = s;
    this.fitScale = s;
    const d = this.decorRect(); // (après fitScale : le décor en dépend)
    this.minScale = Math.max(s * CONFIG.PARCHMENT_ZOOM[2], this.vw / d.w, this.vh / d.h);
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

  // Couleur de la case i (et sa « sorte », pour adoucir les coins : voir scale2x)
  paintTile(i) {
    const G = Game, d = this.tileCol, k = i * 3;
    const base = TERRAIN_INFO[G.terrain[i]].color, sh = this.shade[i];
    let r = base[0] + sh, g = base[1] + sh, b = base[2] + sh;
    const o = G.owner[i], border = o >= 0 && this.isBorder(i, o);
    this.tileKey[i] = (o + 1) * 64 + G.terrain[i] * 2 + (border ? 1 : 0);
    if (o >= 0) {
      const pc = G.players[o].color;
      if (border) {
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
    d[k] = r; d[k + 1] = g; d[k + 2] = b;
  },

  // --- Ombrage du relief et profondeur de la mer (pour un rendu « carte ») ---
  // Une « altitude » par case, puis une nuance de clarté par case (comme sur une carte en pixel art : chaque pixel
  // de la carte est un peu plus clair ou plus foncé selon sa pente, sans bruit fin par-dessus) :
  //  - dans un massif (collines, montagnes, sommets), l'altitude monte de son bord vers son cœur (distance au bord),
  //    plus haut pour les montagnes et les sommets : une ligne de crête au milieu, un versant de chaque côté ;
  //    un léger relief irrégulier (un bruit lisse et large) dessine des vallées et des épaulements ;
  //  - en plaine, forêt ou désert : de douces ondulations (TERRAIN_GRAIN).
  // Le soleil vient d'en haut à gauche : une pente tournée vers lui est éclairée, l'autre est dans l'ombre
  // (light = facteur de clarté de la case, autour de 1). En mer, plus on est loin de la côte, plus l'eau est foncée.
  buildLight() {
    const G = Game, W = G.W, H = G.H, N = G.N, T = G.terrain;
    const level = t => t === TERRAIN.PEAK ? 3 : t === TERRAIN.MOUNTAIN ? 2 : t === TERRAIN.HILLS || t === TERRAIN.WOODED_HILLS || t === TERRAIN.SNOW ? 1 : 0;
    const noise = makeValueNoise(mulberry32((Math.random() * 1e9) | 0));
    // Distance au bord du massif (en cases, en ligne droite), pour les cases de relief : la hauteur monte tout droit
    // depuis le pied du massif jusqu'à sa crête. Ça fait des versants plats (des « facettes ») qui se rejoignent
    // en arêtes nettes, comme des montagnes dessinées en pixel art.
    const dist = new Float32Array(N), R2 = Math.SQRT2;
    for (let i = 0; i < N; i++) dist[i] = level(T[i]) ? 40 : 0;
    // (deux passages, à l'aller puis au retour : chaque case garde la plus petite distance venue de ses voisines)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) v = Math.min(v, dist[i - W] + 1, x > 0 ? dist[i - W - 1] + R2 : 99, x < W - 1 ? dist[i - W + 1] + R2 : 99);
      dist[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x < W - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < H - 1) v = Math.min(v, dist[i + W] + 1, x < W - 1 ? dist[i + W + 1] + R2 : 99, x > 0 ? dist[i + W - 1] + R2 : 99);
      dist[i] = v;
    }
    const e = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      const l = level(T[i]);
      if (!l) { e[i] = (fbm(noise, x / 8, y / 8, 2) - 0.5) * CONFIG.TERRAIN_GRAIN; continue; }
      // collines (boisées ou non) : une pente plus douce, et des bosses arrondies (moins tranchées que la montagne)
      if (l === 1) { e[i] = Math.min(dist[i], 6) * 0.15 + (fbm(noise, x / 7, y / 7, 2) - 0.5) * CONFIG.HILL_BUMPS; continue; }
      // (de grandes ondulations, très douces, tordent un peu les arêtes pour qu'elles ne soient pas trop parfaites)
      e[i] = dist[i] * 0.28 + (fbm(noise, x / 14, y / 14, 2) - 0.5) * CONFIG.MOUNTAIN_ROUGHNESS * 6;
    }
    // Profondeur de la mer : distance à la terre (en cases, au plus DEPTH)
    const DEPTH = 14, depth = new Uint8Array(N).fill(255), q2 = [];
    for (let i = 0; i < N; i++) if (T[i] !== TERRAIN.WATER) { depth[i] = 0; q2.push(i); }
    for (let q = 0; q < q2.length; q++) {
      const i = q2[q];
      if (depth[i] >= DEPTH) continue;
      G.forNeighbors(i, n => { if (depth[n] === 255) { depth[n] = depth[i] + 1; q2.push(n); } });
    }
    const light = new Float32Array(N), K = CONFIG.HILLSHADE, D = CONFIG.WATER_DEPTH_SHADE;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (T[i] === TERRAIN.WATER) {
        // près de la côte un peu plus clair, au large plus foncé, avec de grandes nuances (comme des fonds marins)
        const nuance = CONFIG.WATER_NOISE ? (fbm(noise, x / 20, y / 20, 3) - 0.5) * 2 * CONFIG.WATER_NOISE : 0;
        light[i] = (1.06 - D * Math.min(DEPTH, depth[i] === 255 ? DEPTH : depth[i]) / DEPTH) * (1 + nuance);
        continue;
      }
      // pente : terrain qui monte vers la droite et vers le bas = face tournée vers le soleil (en haut à gauche)
      const ex = e[y * W + Math.min(W - 1, x + 1)] - e[y * W + Math.max(0, x - 1)];
      const ey = e[Math.min(H - 1, y + 1) * W + x] - e[Math.max(0, y - 1) * W + x];
      let shade = Math.max(-0.45, Math.min(0.45, (ex + ey) * K));
      const l = level(T[i]);
      if (l) {
        // montagnes : quelques tons bien tranchés (versant éclairé / versant sombre) ; collines : des nuances douces
        const step = CONFIG.MOUNTAIN_TONE_STEP;
        if (l === 1) shade *= 0.75;
        else if (step > 0) shade = Math.round(shade / step) * step;
      }
      light[i] = 1 + shade;
    }
    this.light = light;
  },

  // Clarté de la case qui contient le point (u, v) de la carte (en cases) : une nuance par case, sans mélange
  lightAt(u, v) {
    const W = Game.W, H = Game.H;
    const x = Math.max(0, Math.min(W - 1, Math.floor(u))), y = Math.max(0, Math.min(H - 1, Math.floor(v)));
    return this.light[y * W + x];
  },

  // --- Coins adoucis (méthode « Scale2x » du pixel art) ---
  // Une cellule c d'une grille w x h est coupée en 4 quarts. Un quart prend la couleur de ses deux voisines (dessus
  // et gauche, par exemple) quand elles sont de la même sorte entre elles et d'une autre sorte que les deux d'en
  // face : un escalier de cellules devient une pente plus douce, sans flou. key(n) = la sorte de la cellule n.
  // Résultat dans out : pour chaque quart (haut-gauche, haut-droit, bas-gauche, bas-droit), la cellule qui le colore.
  // On le fait deux fois (chaque quart est recoupé en 4) : les pentes deviennent encore plus douces.
  scale2x(c, w, h, key, out) {
    const x = c % w, y = (c / w) | 0;
    const up = y > 0 ? c - w : c, down = y < h - 1 ? c + w : c, left = x > 0 ? c - 1 : c, right = x < w - 1 ? c + 1 : c;
    const A = key(up), B = key(right), C = key(left), D = key(down);
    out[0] = C === A && C !== D && A !== B ? up : c;
    out[1] = A === B && A !== C && B !== D ? right : c;
    out[2] = D === C && D !== B && C !== A ? left : c;
    out[3] = B === D && B !== A && D !== C ? down : c;
  },

  // 1er passage : les 4 quarts de la case i (grille 2 x 2 par case, voir sub)
  smoothQuarters(i) {
    const W = Game.W, x = i % W, y = (i / W) | 0, q = this.q;
    if (CONFIG.SMOOTH_MAP) this.scale2x(i, W, Game.H, this.key1, q); else q.fill(i);
    for (let k = 0; k < 4; k++) this.sub[(y * 2 + (k >> 1)) * W * 2 + x * 2 + (k & 1)] = q[k];
  },

  // Les pixels de la case i : ses 4 quarts (2 x 2), ou, avec le 2e passage, chaque quart recoupé en 4 (4 x 4)
  // Pour chaque pixel de la case i (ses quarts, recoupés en 4 au 2e passage) : fn(px, py, case qui le colore)
  // Bords « effilochés » (RAGGED_EDGES) : au bord d'une case, un pixel prend parfois la couleur de la case voisine
  // quand elle n'a qu'un autre terrain (même royaume) : les terrains s'entremêlent en petits pixels, comme sur une
  // vraie carte, au lieu d'un bord bien droit. (Toujours le même hasard pour un pixel donné ; jamais sur un fleuve,
  // pour qu'il reste continu.)
  eachPixel(i, fn) {
    const G = Game, W = G.W, W2 = W * 2, H2 = G.H * 2, x = i % W, y = (i / W) | 0, sub = this.sub, q2 = this.q2;
    const smooth = CONFIG.SMOOTH_MAP >= 2, R = CONFIG.RAGGED_EDGES, key = this.tileKey, T = G.terrain;
    const river = t => t === TERRAIN.RIVER || t === TERRAIN.GREAT_RIVER;
    // (la voisine n'a qu'un autre terrain : même royaume et même bord de frontière, voir paintTile)
    const sameLand = n => n >= 0 && key[n] !== key[i] && (key[n] >> 6) === (key[i] >> 6) && (key[n] & 1) === (key[i] & 1)
      && !river(T[n]) && !river(T[i]);
    const left = x > 0 ? i - 1 : -1, right = x < W - 1 ? i + 1 : -1, up = y > 0 ? i - W : -1, down = y < G.H - 1 ? i + W : -1;
    const rnd = (bx, by) => (((bx * 73856093) ^ (by * 19349663)) >>> 0) % 1000 / 1000;
    // (par blocs de 2 x 2 pixels, des demi-cases : des « gros pixels », pas un bruit fin)
    const ragged = (px, py, tile) => {
      if (!R || this.F !== 4 || tile !== i) return tile;
      const bx = px >> 1, by = py >> 1, r = rnd(bx, by);
      const n = (bx & 1) === 0 ? left : right, m = (by & 1) === 0 ? up : down;
      if (r < R && n >= 0 && sameLand(n)) return n;
      if (r > 1 - R && m >= 0 && sameLand(m)) return m;
      return tile;
    };
    for (let k = 0; k < 4; k++) {
      const cx = x * 2 + (k & 1), cy = y * 2 + (k >> 1), c = cy * W2 + cx;
      if (this.F === 2) { fn(cx, cy, sub[c]); continue; }
      if (smooth) this.scale2x(c, W2, H2, this.key2, q2); else q2.fill(c);
      for (let m = 0; m < 4; m++) {
        const px = cx * 2 + (m & 1), py = cy * 2 + (m >> 1);
        fn(px, py, ragged(px, py, sub[q2[m]]));
      }
    }
  },

  // Hauteur des pixels de la case i, d'après le terrain dessiné à cet endroit (mer, fleuve, plaine, forêt,
  // colline, montagne, sommet : voir FINE_LEVEL)
  fineTile(i) {
    const WF = Game.W * this.F, T = Game.terrain, fl = this.fineLv, pt = this.pixT;
    this.eachPixel(i, (px, py, tile) => { fl[py * WF + px] = FINE_LEVEL[T[tile]]; pt[py * WF + px] = T[tile]; });
    // (les lignes entre les terrains de ce coin sont à refaire : voir borderChunk)
    const k = this.forests;
    if (k) {
      const W = Game.W, x = i % W, y = (i / W) | 0;
      for (const yy of [y - 1, y]) for (const xx of [x - 1, x]) {
        if (xx >= 0 && yy >= 0) k.borders.terrain.delete(((yy / k.C) | 0) * k.cw + ((xx / k.C) | 0));
      }
    }
  },

  // Lignes entre les terrains d'un paquet de 32 x 32 cases : sur chaque côté de petit carré dessiné (voir pixT)
  // qui sépare deux terrains de terre différents (pas le long de la mer ni des fleuves, déjà bien visibles).
  // Elles suivent exactement les carrés de la carte dessinée.
  borderChunk(key) {
    const k = this.forests, F = this.F, W = Game.W, H = Game.H, WF = W * F, HF = H * F, pt = this.pixT, u = 1 / F;
    const cx = key % k.cw, cy = (key / k.cw) | 0, p = new Path2D();
    const x0 = cx * k.C * F, y0 = cy * k.C * F, x1 = Math.min(WF, x0 + k.C * F), y1 = Math.min(HF, y0 + k.C * F);
    const land = t => t !== TERRAIN.WATER && t !== TERRAIN.RIVER && t !== TERRAIN.GREAT_RIVER;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const j = y * WF + x, a = pt[j];
      if (!land(a)) continue;
      if (x < WF - 1 && pt[j + 1] !== a && land(pt[j + 1])) { p.moveTo((x + 1) * u, y * u); p.lineTo((x + 1) * u, (y + 1) * u); }
      if (y < HF - 1 && pt[j + WF] !== a && land(pt[j + WF])) { p.moveTo(x * u, (y + 1) * u); p.lineTo((x + 1) * u, (y + 1) * u); }
    }
    k.borders.terrain.set(key, p);
    return p;
  },

  // Les pixels de la case i : la couleur de leur case, éclairée par l'ombrage doux du relief (voir buildLight) et
  // par les ombres qui suivent les formes dessinées : un pixel plus haut que ses voisins du dessus et de gauche
  // (le bord d'un relief tourné vers le soleil) est éclairé ; plus bas qu'eux (au pied d'un relief, côté ombre),
  // il est dans l'ombre. Comme un relief gravé, qui suit exactement les bords de la carte.
  writeTile(i) {
    const F = this.F, WF = Game.W * F, d = this.img.data, col = this.tileCol, fl = this.fineLv;
    const R = F === 4 ? 2 : 1, K = CONFIG.EDGE_SHADE / 10 / R;
    this.eachPixel(i, (px, py, tile) => {
      const j = py * WF + px, lv = fl[j];
      let e = 0;
      for (let k = 1; k <= R; k++) {
        if (px >= k) e += lv - fl[j - k];
        if (py >= k) e += lv - fl[j - k * WF];
      }
      const edge = Math.max(-0.35, Math.min(0.35, e * K));
      const p = j * 4, c = tile * 3, l = this.lightAt((px + 0.5) / F, (py + 0.5) / F) * (1 + edge);
      d[p] = col[c] * l; d[p + 1] = col[c + 1] * l; d[p + 2] = col[c + 2] * l; d[p + 3] = 255;
    });
  },

  flush() {
    if (!this.dirtyList || !this.dirtyList.length) return;
    // (on ne recopie que le rectangle qui contient les cases changées : sur une grande carte, c'est bien plus rapide)
    const G = Game, W = G.W, F = this.F;
    let x0 = W, y0 = G.H, x1 = -1, y1 = -1;
    for (const i of this.dirtyList) this.paintTile(i);
    // (les coins d'une case dépendent de ses voisines, et le 2e passage des voisines de celles-ci : on refait les
    //  quarts des voisines des cases changées, et les pixels jusqu'à 2 cases autour)
    const near = new Set();
    for (const i of this.dirtyList) { near.add(i); G.forNeighbors(i, n => near.add(n)); this.dirty[i] = 0; }
    for (const i of near) this.smoothQuarters(i);
    const again = new Set(near);
    for (const i of near) G.forNeighbors(i, n => again.add(n));
    for (const i of again) this.fineTile(i);
    for (const i of again) {
      this.writeTile(i);
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    this.dirtyList.length = 0;
    this.offCtx.putImageData(this.img, 0, 0, x0 * F, y0 * F, (x1 - x0 + 1) * F, (y1 - y0 + 1) * F);
    // (et la carte parchemin, vue de très loin : voir buildParchment)
    for (const i of near) this.paintParchment(i);
    this.parchCtx.putImageData(this.parchImg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
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

  // Murs bâtis par les villes : une ligne de pierres d'une case de large (en chantier : à moitié transparente,
  // avec une jauge qui se remplit), et l'aperçu du mur qu'on est en train de poser
  drawCityWalls(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, W = G.W;
    const stones = (tiles, stone, dark) => {
      // les cases voisines (même en diagonale) sont reliées par un trait, chaque case est un bloc de pierre
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (let k = 1; k < tiles.length; k++) {
        const a = tiles[k - 1], b = tiles[k], ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
        if (Math.abs(ax - bx) > 1 || Math.abs(ay - by) > 1) continue;
        ctx.moveTo(ox + (ax + 0.5) * s, oy + (ay + 0.5) * s);
        ctx.lineTo(ox + (bx + 0.5) * s, oy + (by + 0.5) * s);
      }
      ctx.lineWidth = Math.max(5, s * 0.95);
      ctx.strokeStyle = dark;
      ctx.stroke();
      ctx.lineWidth = Math.max(3, s * 0.7);
      ctx.strokeStyle = stone;
      ctx.stroke();
      ctx.lineCap = 'butt';
      const m = Math.max(4, s * 0.85);
      ctx.beginPath();
      for (const i of tiles) ctx.rect(ox + (i % W + 0.5) * s - m / 2, oy + (((i / W) | 0) + 0.5) * s - m / 2, m, m);
      ctx.fillStyle = stone;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark;
      ctx.stroke();
      if (s < 6) return;
      // de près : les joints entre les pierres
      ctx.beginPath();
      for (const i of tiles) {
        const x = ox + (i % W) * s, y = oy + ((i / W) | 0) * s;
        ctx.moveTo(x + s * 0.1, y + s * 0.5); ctx.lineTo(x + s * 0.9, y + s * 0.5);
        ctx.moveTo(x + s * 0.5, y + s * 0.1); ctx.lineTo(x + s * 0.5, y + s * 0.5);
        ctx.moveTo(x + s * 0.3, y + s * 0.5); ctx.lineTo(x + s * 0.3, y + s * 0.9);
        ctx.moveTo(x + s * 0.7, y + s * 0.5); ctx.lineTo(x + s * 0.7, y + s * 0.9);
      }
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    for (const w of G.walls) {
      if (w.done) { stones(w.tiles, '#b3aa98', 'rgba(30,22,12,0.9)'); continue; }
      ctx.globalAlpha = 0.45;
      stones(w.tiles, '#b3aa98', 'rgba(30,22,12,0.9)');
      ctx.globalAlpha = 1;
      // jauge du chantier, au milieu du mur
      const mid = w.tiles[w.tiles.length >> 1], k = Math.min(1, (G.tick - w.start) / Math.max(1, w.ready - w.start));
      const bw = Math.max(26, s * 3), bh = Math.max(5, s * 0.4);
      const x = ox + (mid % W + 0.5) * s - bw / 2, y = oy + (((mid / W) | 0) + 1) * s + 3;
      ctx.fillStyle = 'rgba(20,12,4,0.75)';
      ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#4f9d3a';
      ctx.fillRect(x, y, bw * k, bh);
    }
    // Aperçu du mur qu'on pose (recalculé au plus toutes les 0,1 s) : vert s'il est possible, rouge sinon
    const c = UI.wallFor;
    if (c === undefined || c < 0 || this.hover < 0 || G.phase !== 'playing') return;
    const from = UI.wallFrom >= 0 ? UI.wallFrom : -1;
    // Point de départ du second mur : un rond doré sur le premier mur (celui qu'on survole, ou celui choisi)
    const ring = (t, color) => {
      ctx.beginPath();
      ctx.arc(ox + (t % W + 0.5) * s, oy + (((t / W) | 0) + 0.5) * s, Math.max(5, s * 0.8), 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    if (from >= 0) ring(from, '#ffd34d');
    else if (UI.onFirstWall(c, this.hover)) return ring(this.hover, 'rgba(255,211,77,0.9)');
    const now = performance.now(), key = c + ':' + this.hover + ':' + from;
    if (!this.wallPlan || this.wallPlan.key !== key || (this.wallPlan.version !== G.version && now - this.wallPlan.time > 100)) {
      this.wallPlan = Object.assign(G.planWall(G.human.id, c, this.hover, from), { key, version: G.version, time: now });
    }
    const plan = this.wallPlan, h = G.sizeOf(B_CASTLE) / 2;
    if (plan.error) {
      // (une ligne rouge pointillée de la ville, ou du point de départ, jusqu'à la souris)
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      if (from >= 0) ctx.moveTo(ox + (from % W + 0.5) * s, oy + (((from / W) | 0) + 0.5) * s);
      else ctx.moveTo(ox + (c % W + h) * s, oy + (((c / W) | 0) + h) * s);
      ctx.lineTo(ox + (this.hover % W + 0.5) * s, oy + (((this.hover / W) | 0) + 0.5) * s);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(200,50,40,0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    ctx.globalAlpha = 0.75;
    stones(plan.tiles, '#cfe8b8', '#1f6b1a');
    ctx.globalAlpha = 1;
    // Accroché à un obstacle : un petit rond vert à l'endroit où il s'accroche (le passage est bien fermé)
    if (plan.sealed) {
      const ex = ox + (plan.end % W + 0.5) * s, ey = oy + (((plan.end / W) | 0) + 0.5) * s;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(4, s * 0.6), 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2f9e2a';
      ctx.stroke();
    }
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
      const level = upgrading ? Math.min(CASTLE_LEVELS.length - 1, G.level[h] + 1) : 1;
      const zone = G.castleZone(h, G.human.id, level);
      if (!zone.length) return;
      const set = new Set(zone);
      // Petite bulle près de la souris : la défense totale de la muraille (dessinée par-dessus tout, voir draw)
      const def = Math.round((G.castleZoneDefense(zone, level) - 1) * 100);
      this.castleTip = { x: this.mouse.x, y: this.mouse.y, text: tr(`🛡️ Défense dans la muraille : +${def} %`, `🛡️ Defense inside the walls: +${def}%`) };
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
      // (en doré : au bord du chemin d'une église ou d'un port vers une ville, où il produit plus : voir Game.onRoad)
      const ok = [], bad = [], road = [], links = G.roads();
      for (const i of zone) (!G.canPlace(h.id, i, type) ? bad : G.onRoad(h.id, i, type, links) ? road : ok).push(i);
      this.buildable = { key, time: now, ok, bad, road };
    }
    this.fillTiles(ox, oy, this.buildable.ok, 'rgba(140,240,110,0.3)');
    this.fillTiles(ox, oy, this.buildable.road, 'rgba(255,205,60,0.5)');
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
      // Des alliés du pacte se battent avec lui : la bannière de celui qui a envoyé le plus de soldats, plus petite
      let ally = -1, most = 1;
      if (a.allyDef) for (const k in a.allyDef) if (a.allyDef[k] >= most) { most = a.allyDef[k]; ally = +k; }
      if (ally >= 0 && G.players[ally]) {
        this.drawBannerImage(G.players[ally], sx + 26, sy + 4, 24);
        Icons.text(ctx, '🤝', sx + 26, sy - 26);
      }
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
        // Siège en cours : une jauge ronde autour de la cible se remplit jusqu'à sa chute (voir drawSiegeRing)
        if (a.siege) this.drawSiegeRing(ox, oy, a);
        const siege = a.retreatEnd !== undefined ? tr('🏳️ retraite · ', '🏳️ retreat · ') : a.clash !== undefined ? tr('⚔️ bataille · ', '⚔️ battle · ') : '';
        // Deux armées qui s'affrontent au pied du même château : leurs bannières se font face
        const shift = a.clash !== undefined ? (a.attacker < a.clash ? -30 : 30) : 0;
        this.drawArmyBanner(a, bx + shift, by, `${siege}${G.troopIcon(a.attacker)} ${fmt(a.troops)}${extra}`);
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
      this.drawArmyBanner(a, bx, by, a.retreatEnd !== undefined ? `${tr('🏳️ retraite', '🏳️ retreat')} · ${fmt(a.troops)}` : `${G.troopIcon(a.attacker)} ${fmt(a.troops)}${extra}`);
    }
  },

  // Jauge du siège de l'assaut a : un anneau autour du bâtiment assiégé, qui se remplit (couleur de l'attaquant)
  // à mesure que le siège avance ; plein, la cible tombe
  drawSiegeRing(ox, oy, a) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, c = G.anchor[a.siege.tile], type = G.building[c];
    if (!type) return;
    const n = G.sizeOf(type), x = ox + (c % G.W + n / 2) * s, y = oy + (((c / G.W) | 0) + n / 2) * s;
    const total = Math.max(1, a.siege.end - (a.siege.start === undefined ? a.siege.end - 1 : a.siege.start));
    const k = Math.max(0, Math.min(1, 1 - (a.siege.end - G.tick) / total));
    const r = Math.max(16, n * s * 0.75 * CONFIG.BUILDING_DRAW_SCALE + 4);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, s * 0.5);
    ctx.strokeStyle = 'rgba(20,12,4,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, s * 0.35);
    ctx.strokeStyle = `rgb(${G.players[a.attacker].color.join(',')})`;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
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

  // La vieille carte (tout au fond du dézoom) : chaque ville est un petit dessin à l'encre (des tours et leurs toits
  // pointus, plus nombreuses selon son niveau, avec un fanion à la couleur du royaume). Les autres bâtiments ne sont pas
  // dessinés, sauf les grandes églises et les grandes casernes (niveau 3), en petit croquis aussi.
  drawMapSymbols(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale;
    const u = Math.max(7, Math.min(11, s * 3)); // (taille d'un « trait » du dessin, en pixels)
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const i of G.buildingTiles) {
      const type = G.building[i], lvl = G.level[i] || 1, half = G.sizeOf(type) / 2;
      if (type !== B_CASTLE && !((type === B_CHURCH || type === B_BARRACKS) && lvl >= 3)) continue;
      const x = ox + (i % G.W + half) * s, y = oy + (((i / G.W) | 0) + half) * s;
      if (x < -60 || y < -60 || x > this.vw + 60 || y > this.vh + 60) continue;
      const color = G.owner[i] >= 0 ? `rgb(${G.players[G.owner[i]].color})` : '#7a6a50';
      if (type === B_CASTLE) this.inkTown(x, y, u, lvl, color);
      else if (type === B_CHURCH) this.inkChurch(x, y, u * 0.9);
      else this.inkCamp(x, y, u * 0.9, color);
    }
    ctx.restore();
  },
  // (l'encre et le papier de la vieille carte)
  inkStyle(fill = '#efe2c0') {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#3b2a17';
    ctx.lineWidth = 1.3;
  },
  // Une tour : un carré de mur et un toit pointu (x = son milieu, y = son pied)
  inkTower(x, y, w, h) {
    const ctx = this.ctx;
    this.inkStyle();
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h, w, h);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 1, y - h);
    ctx.lineTo(x, y - h - w * 1.1);
    ctx.lineTo(x + w / 2 + 1, y - h);
    ctx.closePath();
    ctx.fillStyle = '#b5523a';
    ctx.fill(); ctx.stroke();
    // (une petite fenêtre)
    ctx.fillStyle = '#3b2a17';
    ctx.fillRect(x - 0.8, y - h * 0.65, 1.6, h * 0.25);
  },
  // Une ville : un mur bas, et 2 à 4 tours selon son niveau (la plus haute au milieu, avec le fanion du royaume)
  inkTown(x, y, u, lvl, color) {
    const ctx = this.ctx, n = Math.min(4, lvl + 1), w = u * 0.8, gap = w * 1.05;
    const bottom = y + u * 0.9;
    // le mur, avec ses créneaux
    const mw = (n - 1) * gap + w;
    this.inkStyle();
    ctx.beginPath();
    ctx.rect(x - mw / 2, bottom - u * 0.7, mw, u * 0.7);
    ctx.fill(); ctx.stroke();
    // les tours, de gauche à droite (celles du milieu un peu plus hautes)
    let top = Infinity, tx = x;
    for (let k = 0; k < n; k++) {
      const cx = x - (n - 1) * gap / 2 + k * gap;
      const mid = 1 - Math.abs(k - (n - 1) / 2) / n;
      const h = u * (1 + mid * (0.6 + lvl * 0.15));
      this.inkTower(cx, bottom, w, h);
      if (bottom - h < top) { top = bottom - h; tx = cx; }
    }
    // le fanion, au-dessus de la plus haute tour
    const py = top - w * 1.1;
    ctx.strokeStyle = '#3b2a17';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx, py);
    ctx.lineTo(tx, py - u * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, py - u * 0.9);
    ctx.lineTo(tx + u * 0.8, py - u * 0.7);
    ctx.lineTo(tx, py - u * 0.45);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // (la ville impériale : une petite couronne dorée au-dessus)
    if (lvl >= 4) {
      const cy = py - u * 1.2;
      ctx.beginPath();
      ctx.moveTo(tx - u * 0.5, cy);
      ctx.lineTo(tx - u * 0.5, cy - u * 0.45);
      ctx.lineTo(tx - u * 0.25, cy - u * 0.2);
      ctx.lineTo(tx, cy - u * 0.55);
      ctx.lineTo(tx + u * 0.25, cy - u * 0.2);
      ctx.lineTo(tx + u * 0.5, cy - u * 0.45);
      ctx.lineTo(tx + u * 0.5, cy);
      ctx.closePath();
      ctx.fillStyle = '#e2b53e';
      ctx.fill();
      ctx.stroke();
    }
  },
  // Une grande église : sa nef au toit en pente, son clocher pointu et sa croix
  inkChurch(x, y, u) {
    const ctx = this.ctx, bottom = y + u * 0.6;
    this.inkStyle();
    // la nef
    ctx.beginPath();
    ctx.moveTo(x - u * 0.3, bottom);
    ctx.lineTo(x + u * 1.3, bottom);
    ctx.lineTo(x + u * 1.3, bottom - u * 0.8);
    ctx.lineTo(x + u * 0.5, bottom - u * 1.3);
    ctx.lineTo(x - u * 0.3, bottom - u * 0.8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // le clocher
    this.inkTower(x - u * 0.6, bottom, u * 0.7, u * 1.6);
    // la croix, en haut du clocher
    const ty = bottom - u * 1.6 - u * 0.7 * 1.1;
    ctx.strokeStyle = '#3b2a17';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - u * 0.6, ty);
    ctx.lineTo(x - u * 0.6, ty - u * 0.8);
    ctx.moveTo(x - u * 0.9, ty - u * 0.55);
    ctx.lineTo(x - u * 0.3, ty - u * 0.55);
    ctx.stroke();
    // (le portail)
    ctx.fillStyle = '#3b2a17';
    ctx.beginPath();
    ctx.arc(x + u * 0.5, bottom, u * 0.25, Math.PI, 0);
    ctx.fill();
  },
  // Une grande caserne : une tente de camp militaire, et sa bannière à la couleur du royaume
  inkCamp(x, y, u, color) {
    const ctx = this.ctx, bottom = y + u * 0.6;
    this.inkStyle('#e4d3a8');
    ctx.beginPath();
    ctx.moveTo(x - u * 1.1, bottom);
    ctx.quadraticCurveTo(x - u * 0.4, bottom - u * 0.6, x, bottom - u * 1.5);
    ctx.quadraticCurveTo(x + u * 0.4, bottom - u * 0.6, x + u * 1.1, bottom);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // l'entrée de la tente
    ctx.fillStyle = '#3b2a17';
    ctx.beginPath();
    ctx.moveTo(x - u * 0.3, bottom);
    ctx.lineTo(x, bottom - u * 0.8);
    ctx.lineTo(x + u * 0.3, bottom);
    ctx.closePath();
    ctx.fill();
    // la bannière
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, bottom - u * 1.5);
    ctx.lineTo(x, bottom - u * 2.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, bottom - u * 2.3, u * 0.7, u * 0.45);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },

  // Drapeau blanc médiéval (mât, petite pointe dorée, drapeau qui ondule) : un territoire désorganisé
  drawWhiteFlags(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale;
    const spots = G.disorganizedSpots();
    if (!spots.length) return;
    const h = Math.max(20, Math.min(32, s * 2.6)), fw = h * 0.6, fh = h * 0.42;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const t of spots) {
      // (une ville : le drapeau à côté de son image ; une terre : au milieu, sur la case)
      const b = G.building[t], half = b ? G.sizeOf(b) / 2 : 0.5;
      const x = ox + (t % G.W + half) * s + (b ? half * s * CONFIG.BUILDING_DRAW_SCALE + 4 : 0);
      const y = oy + (((t / G.W) | 0) + half) * s + (b ? 0 : h / 2);
      if (x < -50 || y < -50 || x > this.vw + 50 || y > this.vh + 50) continue;
      // le mât
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3a2412';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
      ctx.stroke();
      // le drapeau blanc, qui ondule un peu
      ctx.beginPath();
      ctx.moveTo(x, y - h + 1);
      ctx.bezierCurveTo(x + fw * 0.35, y - h - 3, x + fw * 0.65, y - h + 3, x + fw, y - h + 1);
      ctx.lineTo(x + fw * 0.85, y - h + fh * 0.5); // (petite découpe en queue d'aronde)
      ctx.lineTo(x + fw, y - h + fh);
      ctx.bezierCurveTo(x + fw * 0.65, y - h + fh + 2, x + fw * 0.35, y - h + fh - 4, x, y - h + fh);
      ctx.closePath();
      ctx.fillStyle = '#f6f1e2';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(40,25,10,0.8)';
      ctx.stroke();
      // la pointe dorée en haut du mât
      ctx.fillStyle = '#d9b44a';
      ctx.beginPath();
      ctx.arc(x, y - h - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
      Icons.text(ctx, Game.troopIcon(pid) + ' ' + fmt(troops), x, y - 18);
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

  // Dessine la bannière d'un royaume ; (x, y) = pied du mât, h = hauteur (agrandie de BANNER_SCALE)
  // (le drapeau flotte à droite de sa hampe : le pied du mât est à BANNER_FOOT de la largeur de l'image)
  drawBannerImage(p, x, y, h) {
    const img = this.bannerImages[p.banner];
    if (!img.complete || !img.naturalWidth) return 0;
    // (un écu, sur la carte Azeroth : sans hampe, posé par son milieu)
    const shield = BANNERS[p.banner].shield;
    h *= shield ? SHIELD_SCALE : BANNER_SCALE;
    const w = h * img.naturalWidth / img.naturalHeight;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(img, x - w * (shield ? 0.5 : BANNER_FOOT), y - h, w, h);
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
    const G = Game, f = this.flashKingdom, flash = f && performance.now() < f.until ? f.pid : -1;
    // (un royaume choisi dans le classement s'éclaire un instant, en clignotant : voir UI.showKingdom)
    const o = flash >= 0 ? flash : this.hoveredKingdom();
    if (o < 0 || (flash >= 0 && Math.floor(performance.now() / 250) % 2)) return;
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

  // La souris est sur ⛏️ (barre du haut) : nos mines clignotent sur la carte, pour bien les repérer
  drawFlashingMines(ox, oy) {
    const G = Game;
    if (!UI.flashMines || !G.human) return;
    const ctx = this.ctx, s = this.cam.scale, on = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.save();
    for (const a of G.buildingTiles) {
      if (G.building[a] !== B_MINE || G.owner[a] !== G.human.id) continue;
      const half = G.sizeOf(B_MINE) / 2;
      const x = ox + (a % G.W + half) * s, y = oy + (((a / G.W) | 0) + half) * s;
      const r = Math.max(24, s * half * 2.5); // (assez grand pour se voir même de très loin)
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? 'rgba(255,215,90,0.5)' : 'rgba(255,215,90,0.12)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = on ? '#ffd34d' : 'rgba(255,211,77,0.5)';
      ctx.stroke();
      // (un deuxième cercle, plus large, quand il s'allume)
      if (on) {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,211,77,0.7)';
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  // Petite étiquette au-dessus d'un bâtiment : garnison, soldats stationnés, temps de construction
  drawBuildingLabel(a, type, x, y) {
    const G = Game, ctx = this.ctx, parts = [];
    const o = type === B_OUTPOST ? G.outposts.get(a) : null;
    // (avant-poste en construction : pas de garnison, juste des soldats affaiblis qui bâtissent)
    if (G.builders(a) >= 1) parts.push(`⚔ ${fmt(G.builders(a))} ${tr('affaiblis', 'weakened')}`);
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
      const half = Game.sizeOf(type) / 2, w = BUILDINGS[type].size * s * CONFIG.BUILDING_DRAW_SCALE, h = w * img.naturalHeight / img.naturalWidth;
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
      ctx.font = `${Math.max(16, Math.min(20 * half, s * half * 2)) * CONFIG.BUILDING_DRAW_SCALE}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      Icons.badge(ctx, type, px, py, parseFloat(ctx.font.match(/([\d.]+)px/)[1]));
    }
    if (imgAlpha > 0) {
      const w = size * s * CONFIG.BUILDING_DRAW_SCALE, h = w * img.naturalHeight / img.naturalWidth;
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
    if (o >= 0 && o !== h.id && !G.areAllied(o, h.id) && TARGET_TYPES.includes(t)) return G.anchor[i];
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
    const G = Game, a = UI.wallFor >= 0 || UI.tradeFor >= 0 ? -1 : this.selectableAt(this.hover);
    // épée sur une cible attaquable, main médiévale ailleurs ; pendant une construction, le curseur de pose (voir UI)
    const cursor = UI.selectedBuild || UI.wallFor >= 0 || UI.tradeFor >= 0 ? '' : this.attackableUnderMouse(a) ? this.SWORD_CURSOR : this.HAND_CURSOR;
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
      const grow = 1 + CONFIG.ICON_LEVEL_GROWTH * (lvl - 1); // (plus grande selon le niveau)
      // (une mine : l'icône de son minerai)
      const icon = type === B_MINE && info.kind ? EMOJI_ICONS[MINES[info.kind].icon.replace('\uFE0F', '')] : undefined;
      const size = parseFloat(ctx.font.match(/([\d.]+)px/)[1]) * grow;
      Icons.badge(ctx, type, px, py, size, undefined, icon);
      // (le niveau, en haut à droite de l'icône : visible à tous les zooms où l'on voit l'icône)
      if (lvl > 1) {
        const f = Math.max(9, Math.min(14, size * 0.45));
        ctx.font = `700 ${f}px Georgia, serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20,12,4,0.85)';
        ctx.fillStyle = '#ffe9a8';
        const roman = ['', 'I', 'II', 'III', 'IV'][lvl];
        Icons.text(ctx, roman, px + size * 0.5 + f * 0.3, py - size * 0.4);
      }
      ctx.globalAlpha = 1;
    }
    // De près : la vraie image, posée sur son carré de cases
    if (imgAlpha > 0 && img.complete && img.naturalWidth) {
      const w = info.size * s * CONFIG.BUILDING_DRAW_SCALE, h = w * img.naturalHeight / img.naturalWidth;
      ctx.globalAlpha = imgAlpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, px - w / 2, py + s * (half + 0.1) - h, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
    }
  },

  // ⛏️ Les filons encore libres (sans mine) : une petite icône de leur minerai, dans un rond de parchemin. Pendant la
  // pose d'une mine, ils s'entourent d'un cercle qui pulse (vert si on peut y bâtir, gris sinon).
  drawDeposits(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, placing = UI.selectedBuild === B_MINE;
    const size = Math.max(16, Math.min(32, s * 2.4)), pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    for (const d of G.deposits) {
      if (G.building[d.a] === B_MINE) continue;
      const x = ox + (d.a % G.W + 1) * s, y = oy + (((d.a / G.W) | 0) + 1) * s;
      if (x < -40 || y < -40 || x > this.vw + 40 || y > this.vh + 40) continue;
      if (placing) {
        const ok = G.canPlace(G.human.id, d.a, B_MINE);
        ctx.beginPath();
        ctx.arc(x, y, size * (0.9 + 0.15 * pulse), 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = ok ? 'rgba(90,220,90,0.95)' : 'rgba(200,200,200,0.6)';
        ctx.stroke();
      }
      Icons.badge(ctx, B_MINE, x, y, size, '#5a4a32', EMOJI_ICONS[MINES[d.kind].icon.replace('\uFE0F', '')]);
    }
  },

  // ⛏️ À côté de chaque mine (la sienne comme celles des autres) : une petite bulle ronde avec l'icône de son minerai
  // (fer, or, pierre, diamant), dessinée par-dessus les bâtiments pour qu'une grande ville ne la cache pas
  drawMineBubble(a, px, py) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, d = G.depositAt.get(a);
    if (!d) return;
    const r = Math.max(11, Math.min(17, s * 1.05));
    // (à gauche de la mine : à droite, il y a déjà le chiffre de son niveau)
    const x = px - Math.max(14, s * 1.6 * CONFIG.BUILDING_DRAW_SCALE) - r * 0.6, y = py - s * 0.8 - r * 0.4;
    ctx.save();
    ctx.fillStyle = G.mineSpent(a) ? 'rgb(200,190,170)' : 'rgb(243,227,191)';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#3a2512';
    // la petite pointe vers la mine, puis la bulle ronde par-dessus
    ctx.beginPath();
    ctx.moveTo(x + r * 0.8, y + r * 0.5);
    ctx.lineTo(x + r * 1.45, y + r * 1.2);
    ctx.lineTo(x + r * 0.35, y + r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    Icons.draw(ctx, EMOJI_ICONS[MINES[d.kind].icon.replace('\uFE0F', '')], x, y, r * 1.45);
    ctx.restore();
  },

  // Sur une mine : une croix si son filon est épuisé ; autour, une jauge ronde (le diamant extrait, l'or qui reste)
  drawMineState(a, px, py) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, d = G.depositAt.get(a);
    if (!d) return;
    const r = Math.max(14, s * 1.9 * CONFIG.BUILDING_DRAW_SCALE);
    if (G.mineSpent(a)) {
      const k = r * 0.45;
      ctx.lineCap = 'round';
      for (const [w, col] of [[7, 'rgba(30,15,5,0.85)'], [4, '#c0392b']]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(px - k, py - k); ctx.lineTo(px + k, py + k);
        ctx.moveTo(px + k, py - k); ctx.lineTo(px - k, py + k);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      return;
    }
    if (d.kind !== 'diamond' && d.kind !== 'gold') return;
    // (diamant : ce qui est extrait, avec les 3 quarts marqués ; or : le temps qui reste, MINES.gold.time = plein)
    const k = d.kind === 'diamond' ? d.progress : Math.min(1, d.left / (MINES.gold.time * CONFIG.TICKS_PER_SECOND));
    const col = d.kind === 'diamond' ? '#7fdcf5' : '#f1c232', start = -Math.PI / 2;
    ctx.lineWidth = Math.max(4, s * 0.3);
    ctx.strokeStyle = 'rgba(20,12,4,0.55)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(2.5, s * 0.2);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, r, start, start + Math.PI * 2 * k);
    ctx.stroke();
    if (d.kind === 'diamond') {
      ctx.strokeStyle = 'rgba(20,12,4,0.9)';
      ctx.lineWidth = 2;
      for (let q = 1; q < 4; q++) {
        const t = start + Math.PI / 2 * q, c = Math.cos(t), sn = Math.sin(t), w = Math.max(4, s * 0.3);
        ctx.beginPath();
        ctx.moveTo(px + c * (r - w), py + sn * (r - w));
        ctx.lineTo(px + c * (r + w), py + sn * (r + w));
        ctx.stroke();
      }
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
    const byPact = new Map();
    for (let i = 0; i < G.N; i++) {
      const k = pactOf(i);
      if (k >= 0) (byPact.get(k) || byPact.set(k, []).get(k)).push(i);
    }
    // (un tracé par pacte : ses pointillés prennent la couleur de son fondateur, voir drawPactBorders)
    this.pactEdges = [...byPact].map(([k, tiles]) => {
      const f = G.pactFounder(k);
      return { color: f ? `rgb(${f.color})` : '#f2c94c', edges: this.zoneEdges(tiles, (i, n) => pactOf(n) === pactOf(i)) };
    });
  },

  // Frontière d'un pacte : un fin trait sombre, et par-dessus des pointillés qui alternent l'or et la couleur du
  // royaume qui a fondé le pacte. (Les pointillés suivent la grille : chaque bout de bord prend une couleur selon sa
  // place, par tronçons de PACT_DASH cases.) Plus fins quand on dézoome, pour ne pas cacher la carte.
  drawPactBorders(ox, oy) {
    this.updatePactEdges();
    if (!this.pactEdges.length) return;
    const ctx = this.ctx, s = this.cam.scale, D = 3; // (longueur d'un pointillé, en cases)
    const w = Math.max(1.5, Math.min(4, s * 0.22));
    ctx.lineCap = 'butt';
    for (const { color, edges } of this.pactEdges) {
      const all = new Path2D(), gold = new Path2D(), mine = new Path2D();
      for (const [x1, y1, x2, y2] of edges) {
        const a = [ox + x1 * s, oy + y1 * s], b = [ox + x2 * s, oy + y2 * s];
        all.moveTo(a[0], a[1]); all.lineTo(b[0], b[1]);
        const along = y1 === y2 ? Math.min(x1, x2) : Math.min(y1, y2); // (position le long du bord)
        const p = Math.floor(along / D) % 2 ? mine : gold;
        p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]);
      }
      ctx.lineWidth = w + 1.5;
      ctx.strokeStyle = 'rgba(40,26,4,0.6)';
      ctx.stroke(all);
      ctx.lineWidth = w;
      ctx.strokeStyle = '#f2c94c';
      ctx.stroke(gold);
      ctx.strokeStyle = color;
      ctx.stroke(mine);
    }
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
      if (link.onRoad) continue; // (moulin posé sur une route : pas de chemin en plus)
      // (une ou deux routes, vers une ou deux villes ; le tracé, qui contourne l'eau, est le même que pour le jeu :
      //  voir Game.roadPoints)
      for (const [c, road] of G.linkRoads(link)) {
        const route = G.roadPoints(a, c);
        if (!route) continue;
        const pts = route.map(([x, y]) => [ox + x * s, oy + y * s]), path = road === 'paved' ? paved : dirt;
        path.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) path.lineTo(pts[k][0], pts[k][1]);
      }
    }
    // Chemins des églises (vers une route de port ou des villes), voir Game.churchLinks : de terre, ou de pierre
    // (pavés) vers une cité impériale
    for (const [, list] of G.roadChurches || []) {
      for (const link of list) {
        const pts = link.pts.map(([x, y]) => [ox + x * s, oy + y * s]), path = link.stone ? paved : dirt;
        path.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) path.lineTo(pts[k][0], pts[k][1]);
      }
    }
    // Routes commerciales (vers les villes des alliés) : de grandes voies pavées de pierre grise, comme les vieilles
    // routes marchandes, voir Game.buildTrade ; à l'arrêt (pacte rompu), pâles
    const trade = new Path2D(), idle = new Path2D();
    for (const r of G.tradeRoutes) {
      const path = r.active ? trade : idle;
      r.pts.forEach(([x, y], k) => (k ? path.lineTo : path.moveTo).call(path, ox + x * s, oy + y * s));
    }
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    if (G.tradeRoutes.length) {
      const tw = w * 1.4;
      for (const [path, alpha] of [[idle, 0.4], [trade, 1]]) {
        ctx.globalAlpha = alpha;
        // les bas-côtés de terre battue, usés par les charrettes
        ctx.lineWidth = tw + Math.max(3, tw * 0.6);
        ctx.strokeStyle = 'rgba(120,88,50,0.75)';
        ctx.stroke(path);
        // le lit de la voie (les joints entre les dalles, sombres)
        ctx.lineWidth = tw;
        ctx.strokeStyle = '#6e5d45';
        ctx.stroke(path);
        // les dalles de pierre, de longueurs inégales, sur toute la largeur (de loin : une voie de pierre unie)
        ctx.lineWidth = tw * 0.86;
        ctx.lineCap = 'butt'; // (avec des bouts carrés, chaque dalle déborderait sur les joints)
        if (s >= 4) ctx.setLineDash([tw * 0.9, tw * 0.1, tw * 0.6, tw * 0.1, tw * 1.1, tw * 0.1, tw * 0.75, tw * 0.1]);
        ctx.strokeStyle = '#b3a587';
        ctx.stroke(path);
        ctx.setLineDash([]);
        ctx.lineCap = 'square';
      }
      ctx.globalAlpha = 1;
    }
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

  // Pendant la pose d'un bâtiment : ses futures routes, en transparence (voir Game.roadPreview), pour voir où et
  // comment elles seront tracées. Si aucune ville n'est assez proche, un trait rouge en pointillés vers la plus proche,
  // avec la distance et la portée (« trop loin »). Recalculé seulement si l'emplacement ou la carte change.
  drawRoadPreview(ox, oy, a, t, upgrading) {
    const G = Game, ctx = this.ctx, s = this.cam.scale;
    const key = a + ':' + t + ':' + upgrading + ':' + G.version;
    if (!this.roadPrev || this.roadPrev.key !== key) this.roadPrev = { key, ...G.roadPreview(G.human.id, a, t, upgrading) };
    const { roads, far } = this.roadPrev, w = Math.max(2, s * 0.55);
    if (roads.length) {
      const dirt = new Path2D(), paved = new Path2D();
      for (const r of roads) {
        const path = r.road === 'paved' ? paved : dirt;
        r.pts.forEach(([x, y], k) => (k ? path.lineTo : path.moveTo).call(path, ox + x * s, oy + y * s));
      }
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = w + 2;
      ctx.strokeStyle = 'rgba(95,68,36,0.8)';
      ctx.stroke(dirt);
      ctx.strokeStyle = 'rgba(60,58,54,0.9)';
      ctx.stroke(paved);
      ctx.lineWidth = w;
      ctx.strokeStyle = '#d9ae6e';
      ctx.stroke(dirt);
      ctx.strokeStyle = '#d4d0c6';
      ctx.stroke(paved);
      // (pointillés clairs par-dessus : c'est une route à venir, pas encore bâtie)
      ctx.globalAlpha = 0.9;
      ctx.setLineDash([Math.max(4, w), Math.max(4, w)]);
      ctx.lineWidth = Math.max(1, w * 0.3);
      ctx.strokeStyle = '#fff6dc';
      ctx.stroke(dirt);
      ctx.stroke(paved);
      ctx.restore();
    }
    if (far) {
      const [[x1, y1], [x2, y2]] = far.pts.map(([x, y]) => [ox + x * s, oy + y * s]);
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(230,70,60,0.85)';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Au milieu du trait : la distance et la portée de la ville
      const label = tr(`🛤️ trop loin : ${Math.round(far.d)} cases (${Math.floor(far.max)} max)`,
        `🛤️ too far: ${Math.round(far.d)} cells (${Math.floor(far.max)} max)`);
      ctx.font = '600 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,12,4,0.8)';
      ctx.fillStyle = '#ffb3a8';
      Icons.text(ctx, label, (x1 + x2) / 2, (y1 + y2) / 2 - 10);
      ctx.restore();
    }
  },

  // Ponts : un tablier de bois d'une rive à l'autre, avec ses planches quand on zoome
  drawBridges(ox, oy) {
    const G = Game, ctx = this.ctx, s = this.cam.scale, W = G.W;
    for (const br of G.bridges) {
      // du centre d'une rive au centre de l'autre (on déborde un peu sur la terre)
      const ax = br.a % W + 0.5, ay = ((br.a / W) | 0) + 0.5, bx = br.b % W + 0.5, by = ((br.b / W) | 0) + 0.5;
      const horiz = ay === by, half = 0.42;
      const x0 = ox + (Math.min(ax, bx) - (horiz ? 0.1 : half)) * s, y0 = oy + (Math.min(ay, by) - (horiz ? half : 0.1)) * s;
      const w = (horiz ? Math.abs(bx - ax) + 0.2 : half * 2) * s, h = (horiz ? half * 2 : Math.abs(by - ay) + 0.2) * s;
      if (x0 > this.vw || y0 > this.vh || x0 + w < 0 || y0 + h < 0) continue;
      ctx.fillStyle = '#9a6a38';
      ctx.fillRect(x0, y0, w, h);
      // planches en travers
      if (s >= 5) {
        ctx.strokeStyle = 'rgba(70,42,18,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const step = Math.max(3, s * 0.3);
        if (horiz) for (let x = x0 + step; x < x0 + w; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); }
        else for (let y = y0 + step; y < y0 + h; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
        ctx.stroke();
      }
      // garde-corps sombres sur les deux côtés
      ctx.fillStyle = '#4a2e14';
      const r = Math.max(1, s * 0.1);
      if (horiz) { ctx.fillRect(x0, y0, w, r); ctx.fillRect(x0, y0 + h - r, w, r); }
      else { ctx.fillRect(x0, y0, r, h); ctx.fillRect(x0 + w - r, y0, r, h); }
    }
  },

  // Direction du royaume p (en radians) : celle où il est le plus allongé (calculée avec ses cases, voir setOwner),
  // entre -70° et +70° pour que le nom se lise bien. Un royaume presque rond penche juste un peu (à droite ou à
  // gauche selon le royaume).
  kingdomAxis(p) {
    const n = p.tiles, mx = p.sumX / n, my = p.sumY / n;
    const cxx = p.sumXX / n - mx * mx, cyy = p.sumYY / n - my * my, cxy = p.sumXY / n - mx * my;
    let a = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    // allongement : rapport entre la plus grande et la plus petite largeur
    const d = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy), l1 = (cxx + cyy) / 2 + d, l2 = Math.max(0.01, (cxx + cyy) / 2 - d);
    const long = Math.min(1, (Math.sqrt(l1 / l2) - 1) / 0.6); // 0 = rond, 1 = bien allongé
    const lean = (p.id % 2 ? 1 : -1) * 0.22;                   // (un royaume rond penche un peu)
    return Math.max(-1.22, Math.min(1.22, a * long + lean * (1 - long)));
  },

  // Texte des soldats écrit sous le nom d'un royaume (avec 🤝 s'il est notre allié, 🗡️ si c'est un traître)
  troopsLabel(p) {
    const G = Game;
    let troops = G.troopIcon(p.id) + ' ' + fmt(p.troops);
    if (!p.isHuman && G.areAllied(p.id, G.human.id)) troops = '🤝 ' + troops;
    if (G.isTraitor(p)) troops = '🗡️ ' + troops;
    return troops;
  },

  // 🏷️ OÙ ÉCRIRE LE NOM DE CHAQUE ROYAUME
  // Le nom, avec dessous sa bannière et ses soldats, doit tenir TOUT ENTIER dans le royaume : comme ça, deux noms ne
  // se chevauchent jamais. Toutes les secondes, on mesure la place dans les royaumes (labelSpace), puis, à chaque
  // image, on cherche pour un royaume l'endroit (et le sens) où ce bloc peut être le plus grand (placeLabel).
  // Un royaume trop petit ou trop fin a un nom minuscule : il n'apparaît qu'en zoomant (et on peut toujours le
  // survoler pour voir ses infos).
  updateLabels() {
    const G = Game, now = performance.now();
    if (this.labelPlayers !== G.players) { // nouvelle partie : tout de suite pour tout le monde
      this.labelPlayers = G.players;
      this.labelTime = now;
      this.labelSpace();
      G.players.forEach(p => this.placeLabel(p));
      this.labelQueue = [];
    } else if (now - this.labelTime > 1000) {
      this.labelTime = now;
      this.labelSpace();
      this.labelQueue = G.players.slice();
    } else {
      if (this.labelQueue.length) this.placeLabel(this.labelQueue.shift());
    }
  },

  // Pour chaque case : sa distance (en cases) à la plus proche case qui n'est pas au même royaume (autre royaume,
  // terre libre, mer ou bord de la carte). Et, pour chaque royaume, ses cases les plus loin de ses frontières.
  labelSpace() {
    const G = Game, W = G.W, H = G.H, N = G.N, own = G.owner, D = Math.SQRT2;
    if (!this.labelDist || this.labelDist.length !== N) this.labelDist = new Float32Array(N);
    const d = this.labelDist;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const o = own[i];
      if (o < 0) d[i] = 0;
      else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) d[i] = 1;
      else d[i] = own[i - 1] !== o || own[i + 1] !== o || own[i - W] !== o || own[i + W] !== o ||
        own[i - W - 1] !== o || own[i - W + 1] !== o || own[i + W - 1] !== o || own[i + W + 1] !== o ? 1 : 1e9;
    }
    // (deux passages, à l'aller puis au retour : chaque case garde la plus petite distance venue de ses voisines)
    for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
      let v = d[i];
      if (v <= 1) continue;
      let t = d[i - 1] + 1; if (t < v) v = t;
      t = d[i - W] + 1; if (t < v) v = t;
      t = d[i - W - 1] + D; if (t < v) v = t;
      t = d[i - W + 1] + D; if (t < v) v = t;
      d[i] = v;
    }
    for (let y = H - 2; y >= 1; y--) for (let x = W - 2, i = y * W + x; x >= 1; x--, i--) {
      let v = d[i];
      if (v <= 1) continue;
      let t = d[i + 1] + 1; if (t < v) v = t;
      t = d[i + W] + 1; if (t < v) v = t;
      t = d[i + W + 1] + D; if (t < v) v = t;
      t = d[i + W - 1] + D; if (t < v) v = t;
      d[i] = v;
    }
    const maxD = this.labelMaxD = new Float32Array(G.players.length), cands = this.labelCands = G.players.map(() => []);
    for (let i = 0; i < N; i++) { const o = own[i]; if (o >= 0 && d[i] > maxD[o]) maxD[o] = d[i]; }
    for (let i = 0; i < N; i++) { const o = own[i]; if (o >= 0 && d[i] >= 2 && d[i] >= maxD[o] * 0.6) cands[o].push(i); }
  },

  // La place et le sens où le bloc du nom du royaume p est le plus grand : p.label = { x, y, a, S } (en cases)
  placeLabel(p) {
    const W = Game.W, ctx = this.ctx, list = this.labelCands[p.id], maxD = this.labelMaxD;
    if (!p.alive || !list || !list.length) { p.label = null; return; }
    ctx.save();
    // largeur du nom et de la ligne des soldats (+ bannière), pour une taille de lettres de 1
    const chars = [...p.name.toUpperCase()];
    ctx.font = `90px 'IM Fell English SC', Cinzel, Georgia, serif`;
    const nameW = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) / 100 + 0.28 * (chars.length - 1);
    ctx.font = '600 70px Georgia, serif';
    const troopW = ctx.measureText(this.troopsLabel(p)).width / 100;
    const a0 = this.kingdomAxis(p);
    const angles = [a0, Math.max(-1.22, a0 - 0.4), Math.min(1.22, a0 + 0.4)];
    let best = null;
    const step = Math.max(1, Math.ceil(list.length / 150)); // (150 endroits essayés au plus)
    for (let k = 0; k < list.length; k += step) {
      const x = list[k] % W + 0.5, y = ((list[k] / W) | 0) + 0.5;
      angles.forEach((a, n) => {
        const S = this.labelFit(p.id, x, y, a, nameW, troopW, maxD[p.id]);
        const score = S * (n === 0 ? 1 : 0.85); // (on préfère le sens du royaume)
        if (!best || score > best.score) best = { x, y, a, S, score };
      });
    }
    // On garde l'ancienne place si elle est presque aussi bonne (le nom ne saute pas sans arrêt)
    const old = p.label;
    if (old && best) {
      const S = this.labelFit(p.id, old.x, old.y, old.a, nameW, troopW, maxD[p.id]);
      if (S >= best.S * 0.85 && S > 0) best = { x: old.x, y: old.y, a: old.a, S };
    }
    p.label = best && best.S > 0 ? best : null;
    ctx.restore();
  },

  // Plus grande taille de lettres S (en cases) pour que le bloc du nom, centré en (x, y) et tourné de l'angle a,
  // tienne dans le royaume id. Le bloc = le nom (tourné) + la ligne des soldats et la bannière (droites) dessous.
  labelFit(id, x, y, a, nameW, troopW, maxS) {
    const G = Game, W = G.W, H = G.H, own = G.owner, d = this.labelDist;
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux; // (le long du nom, et vers le bas du nom)
    const bow = nameW / 14; // (le nom est un peu courbé)
    // les deux rectangles : centre (décalage depuis (x, y), pour S = 1), largeur, hauteur, et s'ils sont tournés
    const boxes = [
      { cx: -0.5 * vx, cy: -0.5 * vy, w: nameW + 0.3, h: 1 + bow, rot: true },
      { cx: 0.55 * vx, cy: 0.55 * vy - 0.52, w: troopW + 1.9, h: 1.9, rot: false },
    ];
    const fits = S => {
      for (const b of boxes) {
        // on découpe le rectangle en petits carrés : le centre de chacun doit être assez loin des frontières
        const ch = b.h / 2, cols = Math.max(1, Math.ceil(b.w / ch)), cw = b.w / cols;
        const need = Math.hypot(cw, ch) * S / 2 + 1;
        const bx = x + b.cx * S, by = y + b.cy * S;
        const ax = b.rot ? ux : 1, ay = b.rot ? uy : 0, px = b.rot ? vx : 0, py = b.rot ? vy : 1;
        for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
          const u = (-b.w / 2 + (c + 0.5) * cw) * S, v = (-b.h / 2 + (r + 0.5) * ch) * S;
          const tx = Math.floor(bx + u * ax + v * px), ty = Math.floor(by + u * ay + v * py);
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
          const i = ty * W + tx;
          if (own[i] !== id || d[i] < need) return false;
        }
      }
      return true;
    };
    if (!fits(0.3)) return 0;
    let lo = 0.3, hi = Math.max(0.3, maxS);
    for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    return lo;
  },

  // Écrit le nom en lettres espacées le long d'un arc très ouvert (il bombe un peu vers le haut), centré sur (cx, cy)
  // et tourné de l'angle donné (le sens du royaume).
  drawCurvedName(name, cx, cy, size, angle) {
    const ctx = this.ctx, chars = [...name.toUpperCase()], gap = size * 0.28;
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((a, w) => a + w, 0) + gap * (chars.length - 1);
    const R = Math.max(total * 1.8, size * 6); // (rayon de l'arc : plus il est grand, moins le nom est courbé)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // deux passages : d'abord le contour de toutes les lettres, puis leur couleur (pour qu'elles ne se chevauchent pas)
    for (const pass of [0, 1]) {
      let x = -total / 2;
      chars.forEach((c, k) => {
        const mid = x + widths[k] / 2, phi = mid / R;
        ctx.save();
        ctx.translate(R * Math.sin(phi), R - R * Math.cos(phi));
        ctx.rotate(phi);
        if (pass === 0) ctx.strokeText(c, 0, 0); else ctx.fillText(c, 0, 0);
        ctx.restore();
        x += widths[k] + gap;
      });
    }
    ctx.restore();
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
    if (this.off) this.clampCam(); // (la vue ne sort jamais du décor)
    const ctx = this.ctx, G = Game, s = this.cam.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // (en attendant le décor : la couleur de la mer du large, voir buildLight)
    const deep = TERRAIN_INFO[TERRAIN.WATER].color.map(v => Math.round(v * (1.06 - CONFIG.WATER_DEPTH_SHADE)));
    ctx.fillStyle = `rgb(${deep})`;
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (!this.off) return;

    const ox = -this.cam.x * s, oy = -this.cam.y * s;
    // Le décor autour de la carte (une vieille carte marine)
    const decor = this.decorImage;
    if (decor.complete && decor.naturalWidth) {
      const d = this.decorRect();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(decor, ox + d.x * s, oy + d.y * s, d.w * s, d.h * s);
    }
    // Le cadre brodé autour de la carte, par-dessus le décor marin
    const frame = this.frameCanvas();
    if (frame) {
      const k = G.W * s / frame.iw;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(frame.canvas, ox - frame.x0 * k, oy - frame.y0 * k, frame.canvas.width * k, frame.canvas.height * k);
    }
    // (de loin, l'image est réduite : on la lisse un peu pour éviter le scintillement ; de près, pixels nets)
    ctx.imageSmoothingEnabled = s < this.F;
    ctx.drawImage(this.off, ox, oy, G.W * s, G.H * s);
    // Dernier cran de dézoom : la carte parchemin (voir buildParchment)
    const pa = this.parch ? this.parchmentAlpha() : 0;
    if (pa > 0) {
      ctx.globalAlpha = pa;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.parch, ox, oy, G.W * s, G.H * s);
      ctx.globalAlpha = 1;
    }
    // un fin trait sombre autour de la carte (sans le cadre brodé : un cadre plus épais)
    ctx.lineWidth = frame ? 1.5 : 4;
    ctx.strokeStyle = '#3b2a17';
    ctx.strokeRect(ox - 1, oy - 1, G.W * s + 2, G.H * s + 2);
    ctx.imageSmoothingEnabled = false;
    // (tout au fond du dézoom, la vieille carte : pas de détails, juste les villes dessinées à l'encre, voir drawMapSymbols)
    const oldMap = pa > 0.5;
    if (!oldMap) this.drawForests(ox, oy);
    this.drawHoveredKingdom(ox, oy);

    if (!oldMap) {
      this.drawRoads(ox, oy);
      this.drawBridges(ox, oy);
    }
    this.drawPactBorders(ox, oy);
    if (oldMap) this.drawMapSymbols(ox, oy);
    else {
      this.drawCastleZones(ox, oy);
      this.drawCityWalls(ox, oy);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bâtiments : petites icônes de loin, vraies images quand on zoome
    const imgAlpha = Math.max(0, Math.min(1, (s - CASTLE_IMG_ZOOM) / 3));
    if (s >= 3 && !oldMap) {
      // (pendant la pose d'une mine, les filons passent par-dessus les bâtiments : une grande ville ne les cache plus)
      const placingMine = UI.selectedBuild === B_MINE;
      if (!placingMine) this.drawDeposits(ox, oy);
      const mines = [], shown = [];
      // Les bâtiments visibles, du haut vers le bas de la carte (selon le bas de leur carré) : un bâtiment plus bas
      // se dessine par-dessus celui qui est juste au-dessus de lui, comme sur une vraie vue en perspective
      for (const i of G.buildingTiles) {
        // Centre du bâtiment = milieu de son carré
        const type = G.building[i], half = G.sizeOf(type) / 2;
        const px = ox + (i % G.W + half) * s, py = oy + (((i / G.W) | 0) + half) * s;
        if (px < -300 || py < -300 || px > this.vw + 300 || py > this.vh + 300) continue;
        shown.push({ i, type, half, px, py, bottom: ((i / G.W) | 0) + 2 * half });
      }
      shown.sort((a, b) => a.bottom - b.bottom || a.px - b.px);
      for (const { i, type, half, px, py } of shown) {
        // (icône à sa taille)
        ctx.font = `${Math.max(9, Math.min(20 * half, s * half * 2)) * CONFIG.BUILDING_DRAW_SCALE}px serif`;
        if (BUILDING_LEVELS[type]) this.drawLeveledBuilding(i, px, py, imgAlpha);
        else this.drawSimpleBuilding(type, px, py, imgAlpha);
        if (type === B_MINE) {
          this.drawMineState(i, px, py);
          mines.push([i, px, py]);
        }
      }
      // Par-dessus tous les bâtiments : leurs petites étiquettes
      for (const { i, type, half, px, py } of shown) {
        // Un de nos châteaux (ou ports royaux) coupé de notre royaume : un petit fanion rouge au-dessus
        if (G.owner[i] === G.human.id && G.holdsAlone(i) && G.isIsolated(i)) this.drawIsolatedFlag(px - half * s - 4, py + 6);
        // Au-dessus du bâtiment : 🛡 sa garnison, ⚔ les soldats stationnés (avant-poste), 🏗️ la construction
        if (s >= 4) {
          // (au-dessus de l'image quand on la voit, sinon au-dessus de l'icône)
          const info = BUILDING_LEVELS[type] ? BUILDING_LEVELS[type][G.level[i] || 1] : BUILDINGS[type];
          const top = (imgAlpha > 0.5 && info.size ? info.size * 0.8 : half) * CONFIG.BUILDING_DRAW_SCALE;
          this.drawBuildingLabel(i, type, px, py - s * top - 8);
        }
      }
      // (les bulles des mines par-dessus tous les bâtiments)
      if (s >= 4) for (const [i, px, py] of mines) this.drawMineBubble(i, px, py);
      if (placingMine) this.drawDeposits(ox, oy);
      this.drawWhiteFlags(ox, oy);
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
          this.drawRoadPreview(ox, oy, a, t, upgrading);
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


    // Noms des royaumes : en lettres espacées, dans le sens du royaume (en oblique) et un peu courbés, comme sur
    // une vieille carte ; en dessous, sa bannière et ses soldats. Sur la carte parchemin, ils sont écrits à l'encre.
    // Ils restent toujours dans leur royaume (voir updateLabels) : trop petits, ils n'apparaissent qu'en zoomant.
    this.updateLabels();
    const ink = this.parch ? this.parchmentAlpha() > 0.5 : false;
    for (const p of G.players) {
      const L = p.label;
      if (!p.alive || p.tiles === 0 || !L) continue;
      let size = Math.min(L.S, Math.sqrt(p.tiles) * 0.2) * s; // (jamais plus grand que la place dans le royaume)
      if (size < 8) continue;
      size = Math.min(size, 42);
      const a = L.a, cx = ox + L.x * s + Math.sin(a) * size * 0.5, cy = oy + L.y * s - Math.cos(a) * size * 0.5;
      ctx.lineJoin = 'round';
      ctx.font = `${size * 0.9}px 'IM Fell English SC', Cinzel, Georgia, serif`;
      ctx.lineWidth = Math.max(2, size / 6);
      ctx.strokeStyle = ink ? 'rgba(240,226,190,0.8)' : 'rgba(20,12,4,0.7)';
      ctx.fillStyle = ink ? '#3b2a17' : p.isHuman ? '#ffe9a8' : '#fff';
      this.drawCurvedName(p.name, cx, cy, size, a);
      // « Sous » le nom (perpendiculairement à lui, pour ne pas le chevaucher) : ses soldats, et sa bannière à gauche
      const tx = cx - Math.sin(a) * size * 1.05, ty = cy + Math.cos(a) * size * 1.05;
      ctx.font = `600 ${size * 0.7}px Georgia, serif`;
      ctx.fillStyle = ink ? '#3b2a17' : p.isHuman ? '#ffe9a8' : '#fff';
      const troops = this.troopsLabel(p);
      const tw = ctx.measureText(troops).width;
      // (le drapeau à gauche du nombre de soldats : il flotte à droite de sa hampe, on recule donc le pied du mât)
      const B = BANNERS[p.banner], bimg = this.bannerImages[p.banner];
      const bh = size * 1.5 * (B.shield ? SHIELD_SCALE : BANNER_SCALE), bw = bh * (bimg.naturalWidth / bimg.naturalHeight || 0.77);
      this.drawBannerImage(p, tx - tw / 2 - bw * (1 - (B.shield ? 0.5 : BANNER_FOOT)) - 2, ty + size * 0.5, size * 1.5);
      Icons.text(ctx, troops, tx, ty);
    }

    if (!oldMap) {
      this.drawCastleAssaultPreview(ox, oy);
      this.drawHoveredBuildings(ox, oy);
      this.drawSelectable(ox, oy);
      this.drawFlashingMines(ox, oy);
      this.drawWorks(ox, oy);
      this.drawFloaters(ox, oy);
    }

    // Par-dessus tout le reste, pour bien les voir
    this.drawLandingWarnings(ox, oy);
    this.drawExpeditions(ox, oy);
    this.drawDefendersOnTheWay(ox, oy);
    this.drawReturning(ox, oy);
    this.drawAttackArrows(ox, oy);
    this.drawArmyTarget();
    this.drawTradePreview(ox, oy);
    this.drawCastleTip();
  },

  // Pendant le choix de la ville alliée d'une route commerciale (voir UI.startTrade) : en survolant une ville, la
  // route en transparence (grise si on peut la bâtir, trait rouge sinon), et une bulle avec son prix et son revenu
  drawTradePreview(ox, oy) {
    const G = Game, a = UI.tradeFor;
    if (a === undefined || a < 0 || this.hover < 0 || !this.mouse || G.phase !== 'playing') return;
    if (G.owner[a] !== G.human.id || G.building[a] !== B_CASTLE) return UI.cancelTrade();
    const b = G.building[this.hover] === B_CASTLE ? G.anchor[this.hover] : -1;
    if (b < 0 || b === a) return;
    // (recalculé au plus toutes les 0,5 s : chercher le tracé par les deux territoires coûte cher)
    const key = a + ':' + b, now = performance.now();
    if (!this.tradePrev || this.tradePrev.key !== key || now - this.tradePrev.time > 500) {
      this.tradePrev = { key, time: now, ...G.planTrade(G.human.id, a, b) };
    }
    const plan = this.tradePrev, ctx = this.ctx, s = this.cam.scale, W = G.W, h = G.sizeOf(B_CASTLE) / 2;
    ctx.beginPath();
    if (plan.error) {
      ctx.moveTo(ox + (a % W + h) * s, oy + (((a / W) | 0) + h) * s);
      ctx.lineTo(ox + (b % W + h) * s, oy + (((b / W) | 0) + h) * s);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(200,50,40,0.9)';
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      plan.pts.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, ox + x * s, oy + y * s));
      ctx.lineJoin = 'miter';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(2, s * 0.55) + 2;
      ctx.strokeStyle = 'rgba(40,40,42,0.9)';
      ctx.stroke();
      ctx.lineWidth = Math.max(2, s * 0.55);
      ctx.strokeStyle = '#b9b8b4';
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
    }
    this.castleTip = { x: this.mouse.x, y: this.mouse.y, text: plan.error ||
      tr(`🛒 ${Math.round(plan.len)} cases · 💰 ${fmt(plan.cost)} · +${fmt(plan.income)} 💰 toutes les ${CONFIG.PRODUCTION_INTERVAL} s`,
        `🛒 ${Math.round(plan.len)} cells · 💰 ${fmt(plan.cost)} · +${fmt(plan.income)} 💰 every ${CONFIG.PRODUCTION_INTERVAL} s`) +
      (G.human.gold < plan.cost ? tr(' (pas assez d\'or)', ' (not enough gold)') : '') };
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
