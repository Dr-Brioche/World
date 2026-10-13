// 🗺️ GÉNÉRATION DE LA CARTE
// Crée une carte aléatoire (mer, plaines, forêts, collines, montagnes, fleuves)
// à partir d'un "bruit" mathématique qui donne des formes naturelles.

// Générateur de nombres aléatoires à partir d'une graine (même graine = même carte).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(rand) {
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand();
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const hash = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
  const fade = t => t * t * (3 - 2 * t);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = fade(x - xi), v = fade(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function generateMap(seed) {
  const W = CONFIG.MAP_WIDTH, H = CONFIG.MAP_HEIGHT, N = W * H;
  const rand = mulberry32(seed);
  const elevNoise = makeValueNoise(rand);
  const forestNoise = makeValueNoise(rand);
  const reliefNoise = makeValueNoise(rand);

  // 1. Altitude : du bruit, plus bas sur les bords pour former un continent.
  const elev = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 2, ny = (y / H - 0.5) * 2;
      const d = nx * nx + ny * ny;
      elev[y * W + x] = fbm(elevNoise, x / 40, y / 40, 5) - 0.45 * d;
    }
  }

  // 2. On choisit les niveaux de mer/collines/montagnes selon des pourcentages.
  const sorted = Float32Array.from(elev).sort();
  const waterLvl = sorted[Math.floor(N * CONFIG.WATER_RATIO)];

  const terrain = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, e = elev[i];
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || e < waterLvl) terrain[i] = TERRAIN.WATER;
      else {
        // Le relief suit son propre bruit : des chaînes de montagnes éparpillées
        const relief = fbm(reliefNoise, x / 22, y / 22, 4) + (e - waterLvl) * 0.5;
        if (relief > 0.72) terrain[i] = TERRAIN.MOUNTAIN;
        else if (relief > 0.64) terrain[i] = TERRAIN.HILLS;
        else if (fbm(forestNoise, x / 14, y / 14, 3) > 0.56) terrain[i] = TERRAIN.FOREST;
        else terrain[i] = TERRAIN.PLAINS;
      }
    }
  }

  // 3. On garde seulement le plus grand continent (pas encore de bateaux !).
  const comp = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0, label = 0;
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (terrain[s] === TERRAIN.WATER || comp[s] >= 0) continue;
    let size = 0;
    comp[s] = label;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W;
      const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const n of nbs) {
        if (n >= 0 && n < N && terrain[n] !== TERRAIN.WATER && comp[n] < 0) {
          comp[n] = label;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) { bestSize = size; best = label; }
    label++;
  }
  for (let i = 0; i < N; i++) {
    if (terrain[i] !== TERRAIN.WATER && comp[i] !== best) terrain[i] = TERRAIN.WATER;
  }

  // 4. Les fleuves : chacun part d'une montagne et descend la pente jusqu'à la mer.
  addRivers(terrain, elev, W, H, rand);

  // 5. Petites variations de couleur pour un rendu moins plat.
  const shade = new Int8Array(N);
  for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12);

  return { W, H, N, terrain, shade };
}

// Trace entre CONFIG.RIVERS_MIN et CONFIG.RIVERS_MAX fleuves (au hasard). Un fleuve part du pied d'une montagne et suit la pente jusqu'à la mer
// (ou jusqu'à un autre fleuve, dont il devient un affluent).
function addRivers(terrain, elev, W, H, rand) {
  const N = W * H;
  const neighbors = i => {
    const x = i % W, out = [];
    if (x > 0) out.push(i - 1);
    if (x < W - 1) out.push(i + 1);
    if (i >= W) out.push(i - W);
    if (i < N - W) out.push(i + W);
    return out;
  };
  // 1. Pour chaque case, la direction de l'eau qui coule vers la mer. On « remplit » la carte depuis
  //    la mer en montant toujours par le point le plus bas : l'eau ne reste jamais coincée dans un creux.
  //    (MinHeap est défini dans game.js)
  const down = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = new MinHeap();
  for (let i = 0; i < N; i++) if (terrain[i] === TERRAIN.WATER) { done[i] = 1; heap.push(-1, i); }
  while (heap.size) {
    const [level, i] = heap.pop();
    for (const n of neighbors(i)) {
      if (done[n]) continue;
      done[n] = 1;
      down[n] = i; // l'eau de n coule vers i
      heap.push(Math.max(level, elev[n]) + rand() * 0.006, n); // un peu de hasard : des méandres
    }
  }
  // 2. Sources : une case de montagne qui touche une case sans montagne (le pied de la montagne)
  const sources = [];
  for (let i = 0; i < N; i++) {
    if (terrain[i] === TERRAIN.MOUNTAIN && neighbors(i).some(n => terrain[n] !== TERRAIN.MOUNTAIN && terrain[n] !== TERRAIN.WATER)) {
      sources.push(i);
    }
  }
  // 3. On suit l'eau depuis des sources tirées au hasard
  const wanted = CONFIG.RIVERS_MIN + Math.floor(rand() * (CONFIG.RIVERS_MAX - CONFIG.RIVERS_MIN + 1));
  const starts = [];
  let made = 0;
  for (let tries = 0; tries < 1000 && made < wanted && sources.length; tries++) {
    const s = sources[(rand() * sources.length) | 0];
    const sx = s % W, sy = (s / W) | 0;
    if (starts.some(t => Math.abs(t % W - sx) + Math.abs(((t / W) | 0) - sy) < 15)) continue; // sources éloignées
    const path = [];
    let cur = down[s], left = false;
    while (cur >= 0 && terrain[cur] !== TERRAIN.WATER && terrain[cur] !== TERRAIN.RIVER) {
      if (terrain[cur] !== TERRAIN.MOUNTAIN) left = true; // le fleuve commence au pied de la montagne
      if (left) path.push(cur);
      cur = down[cur];
    }
    if (path.length < 12) continue; // trop court : on essaie une autre source
    for (const i of path) terrain[i] = TERRAIN.RIVER;
    starts.push(s);
    made++;
  }
}
