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
// size : 'petit', 'moyen' ou 'grand' (voir MAP_SIZES ; les cartes prédéfinies gardent leur propre taille)
function generateMap(seed, type = 'normal', size = 'moyen') {
  if (type === 'world') return generateWorldMap(seed); // la carte du monde (voir worldmap.js)
  if (type === 'europe') return generateEuropeMap(seed); // la carte d'Europe (voir europemap.js)
  // une carte dessinée avec l'éditeur (voir custommaps.js) ; si elle n'existe plus, une carte normale
  if (type.startsWith('custom:')) {
    const m = CustomMaps.find(type.slice(7));
    if (m) return CustomMaps.toGameMap(m, seed);
    type = 'normal';
  }
  const [W, H] = CONFIG.MAP_SIZES[size] || CONFIG.MAP_SIZES.moyen, N = W * H;
  // Une plus grande carte a plus d'îlots, de fleuves et de lacs (voir mapCount ; référence : 500 x 281 cases)
  mapScale = Math.sqrt((W * H) / (500 * 281));
  // Sur une plus grande carte, les formes (continents, chaînes de montagnes, forêts) sont un peu plus grandes,
  // pour ne pas avoir un relief trop morcelé (fs = 1 pour « Petite », 1,5 « Moyenne », 1,85 « Grande »)
  const fs = Math.sqrt(W / 294);
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
      elev[y * W + x] = cont ? fbm(elevNoise, x / (40 * fs), y / (40 * fs), 5) : fbm(elevNoise, x / (40 * fs), y / (40 * fs), 5) - 0.6 * d - sink;
    }
  }

  // 2. On choisit les niveaux de mer/collines/montagnes selon des pourcentages.
  const sorted = Float32Array.from(elev).sort();
  const waterLvl = sorted[Math.floor(N * (cont ? 0.05 : type === 'naval' ? CONFIG.NAVAL_WATER_RATIO : CONFIG.WATER_RATIO))];

  // Le relief suit son propre bruit : des chaînes de montagnes éparpillées.
  // Les sommets (infranchissables) sont les points les plus hauts : environ PEAK_BLOB_RATIO des terres (plus les chaînes, plus bas).
  const relief = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    relief[i] = fbm(reliefNoise, x / (22 * fs), y / (22 * fs), 4) + (elev[i] - waterLvl) * 0.5;
  }
  const landRelief = Array.from(relief).filter((r, i) => cont || elev[i] >= waterLvl).sort((a, b) => a - b);
  const peakLvl = Math.max(0.8, landRelief[Math.floor(landRelief.length * (1 - CONFIG.PEAK_BLOB_RATIO))]);

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
        else if (r > CONFIG.MOUNTAIN_LEVEL) terrain[i] = TERRAIN.MOUNTAIN;
        else {
          // (la forêt pousse aussi sur les collines : ça fait des collines boisées)
          const forest = fbm(forestNoise, x / (14 * fs), y / (14 * fs), 3) > CONFIG.FOREST_LEVEL;
          if (r > CONFIG.HILLS_LEVEL) terrain[i] = forest ? TERRAIN.WOODED_HILLS : TERRAIN.HILLS;
          else terrain[i] = forest ? TERRAIN.FOREST : TERRAIN.PLAINS;
        }
      }
    }
  }

  // 2 bis. Des chaînes de montagnes : de longues crêtes de sommets, avec des cols (voir addMountainChains)
  addMountainChains(terrain, relief, W, H, rand, fs);

  // 3. On garde toutes les terres sauf les trop petites ; la carte « Normale » reçoit quelques îlots volcaniques,
  //    la carte continentale de grands lacs (où finiront ses fleuves).
  const minLand = CONFIG.MIN_ISLAND;
  keepMainland(terrain, W, H, minLand);
  if (type === 'normal') addIslets(terrain, W, H, rand, mapCount(CONFIG.ISLETS), 9, 13, 8);
  addVolcanoes(terrain, W, H);
  if (cont) addLakes(terrain, elev, W, H, rand);

  // 3 bis. Quelques déserts : là où le « bruit de sécheresse » est le plus fort (environ DESERT_RATIO des plaines
  //    et forêts), elles deviennent du désert (les collines et les montagnes restent)
  addDeserts(terrain, W, H, dryNoise, fs);

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

// Chaînes de montagnes : chacune part d'un massif (une colline ou une montagne) et avance en serpentant doucement,
// jusqu'à sa longueur ou jusqu'à la mer. Sa crête est faite de sommets (infranchissables) larges de 3 cases environ, bordés de
// montagnes puis de collines. De temps en temps, un col (des montagnes seulement) laisse passer les armées : la chaîne
// est un mur, mais pas un mur fermé (sinon des terres seraient coupées de tout).
function addMountainChains(terrain, relief, W, H, rand, fs) {
  const between = ([lo, hi]) => lo + rand() * (hi - lo);
  const [cMin, cMax] = mapCount(CONFIG.MOUNTAIN_CHAINS);
  const wanted = cMin + Math.floor(rand() * (cMax - cMin + 1));
  const isLand = (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2 && terrain[(y | 0) * W + (x | 0)] !== TERRAIN.WATER;
  // (un cran plus haut sur l'échelle du relief : plaine → colline, forêt → colline boisée, colline → montagne)
  const raise = (i, to) => {
    const t = terrain[i];
    if (t === TERRAIN.WATER || t === TERRAIN.PEAK) return;
    if (to === TERRAIN.PEAK || to === TERRAIN.MOUNTAIN) {
      if (to === TERRAIN.PEAK || t !== TERRAIN.MOUNTAIN) terrain[i] = to;
    } else if (t === TERRAIN.PLAINS) terrain[i] = TERRAIN.HILLS;
    else if (t === TERRAIN.FOREST) terrain[i] = TERRAIN.WOODED_HILLS;
  };
  const stamp = (cx, cy, r, to) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) raise(y * W + x, to);
      }
    }
  };
  const starts = [];
  for (let tries = 0, made = 0; tries < 400 && made < wanted; tries++) {
    // Départ : dans un massif (relief déjà haut), loin des autres chaînes
    const x0 = 4 + rand() * (W - 8), y0 = 4 + rand() * (H - 8), i0 = (y0 | 0) * W + (x0 | 0);
    if (!isLand(x0, y0) || relief[i0] < CONFIG.HILLS_LEVEL) continue;
    if (starts.some(([x, y]) => Math.hypot(x - x0, y - y0) < 35 * fs)) continue;
    starts.push([x0, y0]);
    made++;
    const len = between(CONFIG.CHAIN_LENGTH) * Math.sqrt(fs);
    let x = x0, y = y0, a = rand() * Math.PI * 2, turn = 0;
    let nextPass = between(CONFIG.CHAIN_PASS_EVERY) * 0.6, passLeft = 0;
    for (let k = 0; k < len; k++) {
      // elle serpente : son virage change doucement (jamais de demi-tour brusque)
      turn = turn * 0.9 + (rand() - 0.5) * 0.05;
      a += turn;
      x += Math.cos(a) * 0.8;
      y += Math.sin(a) * 0.8;
      if (!isLand(x, y)) break; // (elle s'arrête à la mer)
      // un col de temps en temps
      if (passLeft <= 0 && --nextPass <= 0) {
        passLeft = between(CONFIG.CHAIN_PASS_WIDTH) / 0.8;
        nextPass = between(CONFIG.CHAIN_PASS_EVERY) / 0.8;
      }
      // (des bords irréguliers : chaque tampon est un peu décalé, et plus ou moins gros)
      const j = () => (rand() - 0.5) * 1.6;
      stamp(x + j(), y + j(), 4.5 + rand() * 1.5, TERRAIN.HILLS);
      stamp(x + j(), y + j(), 2.8 + rand() * 1.4, TERRAIN.MOUNTAIN);
      if (passLeft > 0) passLeft--;
      else stamp(x + j() * 0.4, y + j() * 0.4, 1.2 + rand() * 0.6, TERRAIN.PEAK);
    }
  }
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
  //    (MinHeap est défini plus bas)
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
  const [rMin, rMax] = mapCount([CONFIG.RIVERS_MIN, CONFIG.RIVERS_MAX]);
  const wanted = rMin + Math.floor(rand() * (rMax - rMin + 1));
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
    if (lakes >= Math.round(CONFIG.LAKES_MAX * mapScale) || rand() > LAKE_CHANCE || path.length < 20) continue;
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
function addDeserts(terrain, W, H, dryNoise, fs = 1) {
  const N = W * H, dry = new Float32Array(N), land = [];
  for (let i = 0; i < N; i++) {
    if (terrain[i] !== TERRAIN.PLAINS && terrain[i] !== TERRAIN.FOREST) continue;
    dry[i] = fbm(dryNoise, (i % W) / (45 * fs), ((i / W) | 0) / (45 * fs), 4);
    land.push(dry[i]);
  }
  if (!land.length) return;
  land.sort((a, b) => a - b);
  const lvl = land[Math.floor(land.length * (1 - CONFIG.DESERT_RATIO))];
  for (let i = 0; i < N; i++) {
    if ((terrain[i] === TERRAIN.PLAINS || terrain[i] === TERRAIN.FOREST) && dry[i] > lvl) terrain[i] = TERRAIN.DESERT;
  }
}

// Lacs : au plus LAKES_MAX par carte (voir config.js), chaque fleuve a LAKE_CHANCE chances d'en avoir un
const LAKE_CHANCE = 0.3;

// Taille de la carte en cours de création, par rapport à une carte de 500 x 281 cases (0,6 = petite, 2 = grande)
let mapScale = 1;
// Un nombre [min, max] prévu pour une petite carte, agrandi pour la carte en cours
function mapCount([lo, hi]) { return [Math.round(lo * mapScale), Math.round(hi * mapScale)]; }

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

// Quelques îlots volcaniques au large de la carte « Normale » : le sommet d'un volcan qui sort de la mer.
// count = [min, max] îlots, de rayon rMin à rMax cases, à au moins `margin` cases de toute autre terre.
// Au milieu un sommet (infranchissable), puis des montagnes, des collines, et des forêts et plaines sur la côte.
// (rayon d'au plus 13 : l'îlot reste trop petit pour y fonder une capitale, voir MIN_SPAWN_LAND)
function addIslets(terrain, W, H, rand, count, rMin, rMax, margin) {
  const want = count[0] + Math.floor(rand() * (count[1] - count[0] + 1));
  const pad = Math.ceil(rMax * 1.3 + margin + 2);
  if (W < pad * 2 + 4 || H < pad * 2 + 4) return;
  let made = 0;
  for (let tries = 0; tries < 400 && made < want; tries++) {
    const cx = pad + Math.floor(rand() * (W - pad * 2)), cy = pad + Math.floor(rand() * (H - pad * 2));
    const r = rMin + rand() * (rMax - rMin);
    // en pleine mer : pas de terre à moins de r + margin cases (r x 1,3 : la côte irrégulière dépasse un peu)
    let free = true;
    const R = r * 1.3 + margin;
    for (let y = Math.floor(cy - R); y <= cy + R && free; y++) {
      for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        if (terrain[y * W + x] !== TERRAIN.WATER) { free = false; break; }
      }
    }
    if (!free) continue;
    // (une côte irrégulière : le rayon change un peu selon la direction)
    const p1 = rand() * 6.3, p2 = rand() * 6.3, forest = rand() < 0.5;
    for (let y = Math.floor(cy - r * 1.3 - 1); y <= cy + r * 1.3 + 1; y++) {
      for (let x = Math.floor(cx - r * 1.3 - 1); x <= cx + r * 1.3 + 1; x++) {
        const a = Math.atan2(y - cy, x - cx), re = r * (1 + 0.16 * Math.sin(3 * a + p1) + 0.1 * Math.sin(5 * a + p2));
        const f = Math.hypot(x - cx, y - cy) / re; // (0 au centre, 1 sur la côte)
        if (f > 1 + (rand() - 0.5) * 0.12) continue;
        terrain[y * W + x] = f < 0.2 ? TERRAIN.PEAK : f < 0.42 ? TERRAIN.MOUNTAIN
          : f < 0.65 ? (forest && rand() < 0.6 ? TERRAIN.WOODED_HILLS : TERRAIN.HILLS)
          : rand() < (forest ? 0.6 : 0.25) ? TERRAIN.FOREST : TERRAIN.PLAINS;
      }
    }
    made++;
  }
}

// Les petites îles (trop petites pour y fonder une capitale) sans sommet deviennent des volcans sortis de la mer :
// un sommet en leur cœur, entouré de montagnes puis de collines (la forêt y reste : des collines boisées)
function addVolcanoes(terrain, W, H) {
  const N = W * H, isLand = i => terrain[i] !== TERRAIN.WATER && terrain[i] !== TERRAIN.GREAT_RIVER;
  const seen = new Uint8Array(N), islands = [];
  for (let s = 0; s < N; s++) {
    if (!isLand(s) || seen[s]) continue;
    const tiles = [s];
    seen[s] = 1;
    for (let q = 0; q < tiles.length; q++) {
      const i = tiles[q], x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n >= 0 && n < N && isLand(n) && !seen[n]) { seen[n] = 1; tiles.push(n); }
      }
    }
    islands.push(tiles);
  }
  for (const tiles of islands) {
    if (tiles.length >= CONFIG.MIN_SPAWN_LAND || tiles.some(i => terrain[i] === TERRAIN.PEAK)) continue;
    // distance de chaque case à la mer (en cases), en partant de la côte
    const dist = new Map(), queue = [];
    for (const i of tiles) {
      const x = i % W;
      if ([x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W].some(n => n < 0 || n >= N || !isLand(n))) { dist.set(i, 1); queue.push(i); }
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n >= 0 && n < N && isLand(n) && !dist.has(n)) { dist.set(n, dist.get(i) + 1); queue.push(n); }
      }
    }
    const far = Math.max(...dist.values());
    if (far < 4) continue; // (une île trop fine : pas de volcan)
    for (const [i, d] of dist) {
      const f = d / far, t = terrain[i];
      if (t === TERRAIN.RIVER) continue;
      if (f >= 0.8) terrain[i] = TERRAIN.PEAK;
      else if (f >= 0.55) terrain[i] = TERRAIN.MOUNTAIN;
      else if (f >= 0.3 && t !== TERRAIN.HILLS && t !== TERRAIN.WOODED_HILLS && t !== TERRAIN.MOUNTAIN) {
        terrain[i] = t === TERRAIN.FOREST ? TERRAIN.WOODED_HILLS : TERRAIN.HILLS;
      }
    }
  }
}

// Petite file de priorité (tas binaire) pour chercher le chemin le plus court
// (la carte s'en sert pour tracer les fleuves, et le jeu pour les chemins des armées)
class MinHeap {
  constructor() { this.keys = []; this.vals = []; }
  get size() { return this.keys.length; }
  push(k, v) {
    const K = this.keys, V = this.vals;
    let i = K.length;
    K.push(k); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.keys, V = this.vals, top = [K[0], V[0]];
    const k = K.pop(), v = V.pop();
    if (K.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= K.length) break;
        if (c + 1 < K.length && K[c + 1] < K[c]) c++;
        if (K[c] >= k) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = k; V[i] = v;
    }
    return top;
  }
}
