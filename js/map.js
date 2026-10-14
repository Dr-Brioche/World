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

// Largeur (en cases) de la bande près des bords où la terre s'enfonce dans l'océan
const EDGE_MARGIN = 14;

// type : 'normal' (un continent et quelques îlots), 'continental' (que de la terre, bordée de montagnes
// infranchissables, avec de grands lacs), 'naval' (plusieurs grandes îles), 'world' (la carte du monde), 'europe' (la carte d'Europe)
function generateMap(seed, type = 'normal') {
  if (type === 'world') return generateWorldMap(seed); // la carte du monde (voir worldmap.js)
  if (type === 'europe') return generateEuropeMap(seed); // la carte d'Europe (voir europemap.js)
  const W = CONFIG.MAP_WIDTH, H = CONFIG.MAP_HEIGHT, N = W * H;
  const rand = mulberry32(seed);
  const elevNoise = makeValueNoise(rand);
  const forestNoise = makeValueNoise(rand);
  const reliefNoise = makeValueNoise(rand);
  const dryNoise = makeValueNoise(rand);

  // 1. Altitude : du bruit, plus bas sur les bords pour former un continent.
  //    (carte « Base navale » : plus bas loin de plusieurs centres, pour former plusieurs îles)
  const centers = type === 'naval' ? islandCenters(W, H, rand) : null;
  const cont = type === 'continental';
  const elev = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 2, ny = (y / H - 0.5) * 2;
      let d = nx * nx + ny * ny;
      if (centers) {
        d = Infinity;
        for (const [cx, cy] of centers) d = Math.min(d, ((x - cx) / (W * 0.16)) ** 2 + ((y - cy) / (H * 0.17)) ** 2);
        d *= 0.55;
      }
      // Près des bords, le terrain plonge dans l'océan : la terre n'est jamais coupée net par le bord
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const sink = edge < EDGE_MARGIN ? ((EDGE_MARGIN - edge) / EDGE_MARGIN) ** 2 : 0;
      elev[y * W + x] = cont ? fbm(elevNoise, x / 40, y / 40, 5) : fbm(elevNoise, x / 40, y / 40, 5) - 0.6 * d - sink;
    }
  }

  // 2. On choisit les niveaux de mer/collines/montagnes selon des pourcentages.
  const sorted = Float32Array.from(elev).sort();
  const waterLvl = sorted[Math.floor(N * (cont ? 0.05 : type === 'naval' ? CONFIG.NAVAL_WATER_RATIO : CONFIG.WATER_RATIO))];

  // Le relief suit son propre bruit : des chaînes de montagnes éparpillées.
  // Les sommets (infranchissables) sont les points les plus hauts : environ 3 % des terres.
  const relief = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    relief[i] = fbm(reliefNoise, x / 22, y / 22, 4) + (elev[i] - waterLvl) * 0.5;
  }
  const landRelief = Array.from(relief).filter((r, i) => cont || elev[i] >= waterLvl).sort((a, b) => a - b);
  const peakLvl = Math.max(0.8, landRelief[Math.floor(landRelief.length * 0.97)]);

  const terrain = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, e = elev[i];
      // Carte continentale : pas de mer, mais une barrière de montagnes infranchissables tout autour
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const wall = 3 + fbm(reliefNoise, x / 9 + 50, y / 9 + 50, 2) * 7; // épaisseur irrégulière
      if (cont && edge < wall) terrain[i] = TERRAIN.PEAK;
      else if (cont && edge < wall + 3) terrain[i] = TERRAIN.MOUNTAIN;
      else if (!cont && (x === 0 || y === 0 || x === W - 1 || y === H - 1 || e < waterLvl)) terrain[i] = TERRAIN.WATER;
      else {
        const r = relief[i];
        if (r > peakLvl) terrain[i] = TERRAIN.PEAK; // le cœur des montagnes : infranchissable
        else if (r > 0.72) terrain[i] = TERRAIN.MOUNTAIN;
        else if (r > 0.64) terrain[i] = TERRAIN.HILLS;
        else if (fbm(forestNoise, x / 14, y / 14, 3) > 0.56) terrain[i] = TERRAIN.FOREST;
        else terrain[i] = TERRAIN.PLAINS;
      }
    }
  }

  // 3. On garde toutes les terres sauf les miettes ; la carte « Normale » reçoit quelques îlots,
  //    la carte continentale de grands lacs (où finiront ses fleuves).
  const minLand = 12;
  keepMainland(terrain, W, H, minLand);
  if (type === 'normal') addIslets(terrain, W, H, rand);
  if (cont) addLakes(terrain, elev, W, H, rand);

  // 3 bis. Quelques déserts : là où le « bruit de sécheresse » est le plus fort (environ DESERT_RATIO des plaines
  //    et forêts), elles deviennent du désert (les collines et les montagnes restent)
  addDeserts(terrain, W, H, dryNoise);

  // 4. Les fleuves : chacun part d'une montagne et descend la pente jusqu'à la mer (ou un lac).
  addRivers(terrain, elev, W, H, rand);

  // 5. Un grand fleuve a pu isoler un petit bout de terre : on le retire.
  keepMainland(terrain, W, H, minLand);
  // Un creux enfermé par des sommets, sans accès à l'eau, serait inaccessible : il devient sommet aussi.
  fillPockets(terrain, W, H);

  // 6. Petites variations de couleur pour un rendu moins plat.
  const shade = new Int8Array(N);
  for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12);

  return { W, H, N, terrain, shade };
}

// Trace entre CONFIG.RIVERS_MIN et CONFIG.RIVERS_MAX fleuves (au hasard). Un fleuve naît dans une montagne et suit la pente jusqu'à la mer
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
  // 2. Sources : une case de montagne à 2 ou 3 cases dans le massif (pas juste au bord)
  const depth = new Int32Array(N).fill(-1), queue = [];
  for (let i = 0; i < N; i++) if (terrain[i] !== TERRAIN.MOUNTAIN) { depth[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    for (const n of neighbors(queue[q])) {
      if (depth[n] < 0) { depth[n] = depth[queue[q]] + 1; queue.push(n); }
    }
  }
  const sources = [];
  for (let i = 0; i < N; i++) if (depth[i] === 2 || depth[i] === 3) sources.push(i); // 1 = bord du massif
  // 3. On suit l'eau depuis des sources tirées au hasard
  const wanted = CONFIG.RIVERS_MIN + Math.floor(rand() * (CONFIG.RIVERS_MAX - CONFIG.RIVERS_MIN + 1));
  const flow = new Uint8Array(N); // nombre de fleuves qui passent par chaque case
  const starts = [], paths = [];
  let made = 0;
  for (let tries = 0; tries < 1000 && made < wanted && sources.length; tries++) {
    const s = sources[(rand() * sources.length) | 0];
    const sx = s % W, sy = (s / W) | 0;
    if (starts.some(t => Math.abs(t % W - sx) + Math.abs(((t / W) | 0) - sy) < 15)) continue; // sources éloignées
    const path = [];
    let cur = s;
    while (cur >= 0 && terrain[cur] !== TERRAIN.WATER && terrain[cur] !== TERRAIN.RIVER) {
      path.push(cur);
      cur = down[cur];
    }
    if (path.length < 12) continue; // trop court : on essaie une autre source
    for (const i of path) { terrain[i] = TERRAIN.RIVER; flow[i]++; }
    // Il a rejoint un autre fleuve : il continue avec lui jusqu'à la mer, qui grossit d'autant
    while (cur >= 0 && terrain[cur] !== TERRAIN.WATER) { flow[cur] = Math.min(255, flow[cur] + 1); cur = down[cur]; }
    starts.push(s);
    paths.push(path);
    made++;
  }
  // 4. Les fleuves qui se rejoignent grossissent : 2 fleuves = 2 cases de large,
  //    3 fleuves ou plus = 3 cases de large, et infranchissable (grand fleuve)
  for (let i = 0; i < N; i++) {
    if (flow[i] < 2) continue;
    const great = flow[i] >= 3;
    const cells = great ? [i, ...neighbors(i)] : [i, i % W < W - 1 ? i + 1 : i, i < N - W ? i + W : i];
    for (const c of cells) {
      if (terrain[c] === TERRAIN.WATER || terrain[c] === TERRAIN.GREAT_RIVER) continue;
      terrain[c] = great ? TERRAIN.GREAT_RIVER : TERRAIN.RIVER;
    }
  }
  // 5. Parfois, un fleuve s'élargit en lac au milieu de son cours (pas trop souvent)
  let lakes = 0;
  for (const path of paths) {
    if (lakes >= LAKES_MAX || rand() > LAKE_CHANCE || path.length < 20) continue;
    const c = path[Math.floor(path.length * (0.35 + rand() * 0.35))];
    const cx = c % W, cy = (c / W) | 0, r = 2 + rand() * 2.5;
    for (let y = Math.max(1, cy - 5); y <= Math.min(H - 2, cy + 5); y++) {
      for (let x = Math.max(1, cx - 5); x <= Math.min(W - 2, cx + 5); x++) {
        // un disque aux bords irréguliers
        if (Math.hypot(x - cx, y - cy) <= r + (rand() - 0.5) * 1.6) terrain[y * W + x] = TERRAIN.WATER;
      }
    }
    lakes++;
  }
}

// Déserts des cartes aléatoires : de grandes taches, sur à peu près CONFIG.DESERT_RATIO des plaines et forêts
function addDeserts(terrain, W, H, dryNoise) {
  const N = W * H, dry = new Float32Array(N), land = [];
  for (let i = 0; i < N; i++) {
    if (terrain[i] !== TERRAIN.PLAINS && terrain[i] !== TERRAIN.FOREST) continue;
    dry[i] = fbm(dryNoise, (i % W) / 45, ((i / W) | 0) / 45, 4);
    land.push(dry[i]);
  }
  if (!land.length) return;
  land.sort((a, b) => a - b);
  const lvl = land[Math.floor(land.length * (1 - CONFIG.DESERT_RATIO))];
  for (let i = 0; i < N; i++) {
    if ((terrain[i] === TERRAIN.PLAINS || terrain[i] === TERRAIN.FOREST) && dry[i] > lvl) terrain[i] = TERRAIN.DESERT;
  }
}

// Lacs : au plus LAKES_MAX par carte, chaque fleuve a LAKE_CHANCE chances d'en avoir un
const LAKES_MAX = 3, LAKE_CHANCE = 0.3;

// Garde seulement le plus grand morceau de terre (la mer et les grands fleuves séparent les terres) :
// les autres morceaux deviennent de la mer.
// (minSize donné : on garde tous les morceaux d'au moins minSize cases)
// (les sommets comptent comme de la terre ici : ce sont la mer et les grands fleuves qui séparent les îles)
function keepMainland(terrain, W, H, minSize) {
  const N = W * H;
  const isLand = i => terrain[i] !== TERRAIN.WATER && terrain[i] !== TERRAIN.GREAT_RIVER;
  const comp = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0, label = 0;
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (!isLand(s) || comp[s] >= 0) continue;
    let size = 0;
    comp[s] = label;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W;
      const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const n of nbs) {
        if (n >= 0 && n < N && isLand(n) && comp[n] < 0) {
          comp[n] = label;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) { bestSize = size; best = label; }
    label++;
  }
  const sizes = [];
  for (let i = 0; i < N; i++) if (comp[i] >= 0) sizes[comp[i]] = (sizes[comp[i]] || 0) + 1;
  for (let i = 0; i < N; i++) {
    if (!isLand(i)) continue;
    if (minSize === undefined ? comp[i] !== best : sizes[comp[i]] < minSize) terrain[i] = TERRAIN.WATER;
  }
}

// Terres enfermées par des sommets (sans le plus grand morceau, et sans accès à la mer ou à un grand fleuve) :
// personne ne pourrait les atteindre, elles deviennent des sommets
function fillPockets(terrain, W, H) {
  const N = W * H;
  const isLand = i => terrain[i] !== TERRAIN.WATER && terrain[i] !== TERRAIN.GREAT_RIVER && terrain[i] !== TERRAIN.PEAK;
  const isWater = i => terrain[i] === TERRAIN.WATER || terrain[i] === TERRAIN.GREAT_RIVER;
  const seen = new Uint8Array(N), pieces = [];
  for (let s = 0; s < N; s++) {
    if (!isLand(s) || seen[s]) continue;
    const tiles = [s];
    let coast = false;
    seen[s] = 1;
    for (let q = 0; q < tiles.length; q++) {
      const i = tiles[q], x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n < 0 || n >= N) continue;
        if (isWater(n)) coast = true;
        else if (isLand(n) && !seen[n]) { seen[n] = 1; tiles.push(n); }
      }
    }
    pieces.push({ tiles, coast });
  }
  const biggest = pieces.reduce((b, p) => (!b || p.tiles.length > b.tiles.length ? p : b), null);
  for (const p of pieces) if (p !== biggest && !p.coast) for (const i of p.tiles) terrain[i] = TERRAIN.PEAK;
}

// Grands lacs de la carte continentale : dans les creux, loin des bords et les uns des autres
function addLakes(terrain, elev, W, H, rand) {
  const want = 2 + Math.floor(rand() * 3), lakes = [];
  for (let k = 0; k < want; k++) {
    // le point le plus bas parmi quelques endroits tirés au hasard
    let best = null;
    for (let t = 0; t < 40; t++) {
      const x = 30 + Math.floor(rand() * (W - 60)), y = 30 + Math.floor(rand() * (H - 60));
      if (lakes.some(([lx, ly]) => Math.hypot(x - lx, y - ly) < 55)) continue;
      if (!best || elev[y * W + x] < elev[best[1] * W + best[0]]) best = [x, y];
    }
    if (!best) continue;
    lakes.push(best);
    const [cx, cy] = best, r = 7 + rand() * 6;
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        // un lac aux bords irréguliers (un peu allongé)
        const d = Math.hypot((x - cx) / 1.3, y - cy);
        if (d <= r + (rand() - 0.5) * 2 && terrain[y * W + x] !== TERRAIN.PEAK) terrain[y * W + x] = TERRAIN.WATER;
      }
    }
  }
}

// Centres des grandes îles de la carte « Base navale », bien écartés les uns des autres
function islandCenters(W, H, rand) {
  const want = CONFIG.ISLANDS[0] + Math.floor(rand() * (CONFIG.ISLANDS[1] - CONFIG.ISLANDS[0] + 1));
  const centers = [];
  for (let tries = 0; tries < 500 && centers.length < want; tries++) {
    const x = W * (0.18 + rand() * 0.64), y = H * (0.2 + rand() * 0.6);
    if (centers.every(([cx, cy]) => ((x - cx) / W) ** 2 + ((y - cy) / H) ** 2 > 0.33 ** 2)) centers.push([x, y]);
  }
  return centers;
}

// Quelques îlots au large de la carte « Normale » : de petites taches de terre dans la mer
function addIslets(terrain, W, H, rand) {
  const want = CONFIG.ISLETS[0] + Math.floor(rand() * (CONFIG.ISLETS[1] - CONFIG.ISLETS[0] + 1));
  let made = 0;
  for (let tries = 0; tries < 400 && made < want; tries++) {
    const cx = 20 + Math.floor(rand() * (W - 40)), cy = 20 + Math.floor(rand() * (H - 40));
    const r = 2 + rand() * 3.5;
    // en pleine mer : pas de terre à moins de r + 4 cases
    let free = true;
    for (let y = cy - r - 4; y <= cy + r + 4 && free; y++) {
      for (let x = cx - r - 4; x <= cx + r + 4; x++) {
        if (terrain[Math.round(y) * W + Math.round(x)] !== TERRAIN.WATER) { free = false; break; }
      }
    }
    if (!free) continue;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (Math.hypot(x - cx, y - cy) <= r + (rand() - 0.5) * 1.5) terrain[y * W + x] = rand() < 0.3 ? TERRAIN.FOREST : TERRAIN.PLAINS;
      }
    }
    made++;
  }
}
