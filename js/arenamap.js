// 🏟️ CARTES ARÈNE
// Des cartes symétriques, pas réalistes (à la façon de Warcraft 3 ou d'Age of Empires) : chacun commence à égalité, à une
// place de départ prévue, autour d'un centre riche et disputé. Rien n'est bâti d'avance : les places de départ sont
// vides (le joueur y fonde sa capitale, ou ailleurs s'il choisit le placement « Libre »), seuls les filons de minerai
// sont posés à l'avance, aux mêmes distances pour tout le monde.
// Chaque carte est créée par un petit programme : son terrain change un peu à chaque partie (forêts, collines), mais il
// est le même pour chaque joueur (on calcule tout dans une seule « part » de la carte, recopiée tout autour du centre).
//
// generateArenaMap renvoie, en plus du terrain : spots (les places de départ : la case du centre de chaque capitale),
// deposits (les filons : { a = case en haut à gauche, kind }) et relicSpots (où les reliques apparaissent de préférence).

const ARENA_MAPS = {
  // 👑 8 vallées en couronne, protégées par des crêtes à deux cols ; au centre, un plateau entouré d'un fleuve
  couronne: { name: tr('La Couronne', 'The Crown'), W: 560, H: 560, players: 8 },
  // 🐉 un volcan au centre : un cratère riche, fermé par un anneau de sommets percé d'une porte par joueur
  cratere: { name: tr('Le Cratère', 'The Crater'), W: 520, H: 520, players: 6 },
  // 🌊 quatre grands fleuves et un lac au centre, avec une île au trésor qu'on n'atteint qu'en bateau
  carrefour: { name: tr('Le Carrefour des Fleuves', 'The River Crossroads'), W: 500, H: 500, players: 4 },
  // 🏝️ une île par royaume, des îlots riches entre elles, et une grande île au centre
  archipel: { name: tr("L'Archipel des Rois", 'The Archipelago of Kings'), W: 600, H: 600, players: 8 },
  // ⚔️ deux rives d'un grand fleuve, 4 places de chaque côté, et une chaîne d'îles riches au milieu
  rives: { name: tr('Les Deux Rives', 'The Two Banks'), W: 640, H: 420, players: 8 },
};

function generateArenaMap(type, seed) {
  const A = ARENA_MAPS[type], W = A.W, H = A.H, N = W * H, T = TERRAIN;
  const rand = mulberry32(seed);
  const reliefNoise = makeValueNoise(rand), forestNoise = makeValueNoise(rand), edgeNoise = makeValueNoise(rand);
  const terrain = new Uint8Array(N);
  const m = { W, H, N, terrain, spots: [], deposits: [], relicSpots: [], arena: type };
  const cx = W / 2, cy = H / 2, DEG = Math.PI / 180;

  // Le point (x, y) ramené dans la première « part » de la carte : n parts autour du centre, chacune en miroir
  // (r = distance au centre, phi = angle dans la part, entre 0 et la moitié de la part ; fx, fy : le point replié)
  const fold = (x, y, n) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = DMath.hypot(dx, dy), part = 2 * Math.PI / n;
    let phi = DMath.atan2(dy, dx) % part;
    if (phi < 0) phi += part;
    if (phi > part / 2) phi = part - phi;
    return { r, phi, fx: r * DMath.cos(phi), fy: r * DMath.sin(phi) };
  };
  // Le terrain « ordinaire » au point replié : plaines, forêts, collines (boisées), quelques montagnes
  const land = (fx, fy, hills = 0.6, mountain = 0.76) => {
    const e = fbm(reliefNoise, fx / 17 + 31, fy / 17 + 17, 3), f = fbm(forestNoise, fx / 12 + 7, fy / 12 + 53, 3) > 0.56;
    if (e > mountain) return T.MOUNTAIN;
    if (e > hills) return f ? T.WOODED_HILLS : T.HILLS;
    return f ? T.FOREST : T.PLAINS;
  };
  const wobble = (fx, fy, k = 1) => (fbm(edgeNoise, fx / (9 * k) + 3, fy / (9 * k) + 91, 2) - 0.5) * 2; // (de -1 à 1)
  const at = (x, y) => Math.round(y) * W + Math.round(x);
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const polar = (r, a) => [cx + r * DMath.cos(a), cy + r * DMath.sin(a)];
  // Un disque de terrain t autour de (x, y)
  const disk = (x, y, R, t, only) => {
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      if (!inMap(xx, yy) || (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > R * R) continue;
      if (!only || only(terrain[yy * W + xx])) terrain[yy * W + xx] = t;
    }
  };
  // Un filon de minerai en (x, y) : son carré de 2x2 cases prend le bon terrain (montagne, ou colline pour la pierre),
  // avec un peu de relief autour
  const deposit = (x, y, kind) => {
    x = Math.round(x); y = Math.round(y);
    const t = kind === 'stone' ? T.HILLS : T.MOUNTAIN;
    disk(x + 1, y + 1, 3.2, kind === 'stone' ? T.HILLS : T.HILLS, v => v !== T.WATER && v !== T.GREAT_RIVER && v !== T.PEAK);
    for (const j of [at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)]) terrain[j] = t;
    m.deposits.push({ a: at(x, y), kind });
  };
  // Une place de départ en (x, y) : de la plaine tout autour (la capitale s'y pose bien), sans eau ni sommet
  const spot = (x, y) => {
    disk(x, y, 7, T.PLAINS, v => v !== T.WATER);
    m.spots.push(at(x, y));
  };

  if (type === 'couronne') {
    // 👑 La Couronne : une île ronde. Au centre, une montagne (diamant) sur un plateau de collines (4 mines d'or),
    // entouré d'un anneau de fleuve ; puis les terres du milieu (une mine de fer par joueur, une carrière entre deux
    // voisins) ; puis une crête de sommets à deux cols ; puis les 8 vallées de départ, séparées par des crêtes à un col.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 8), i = y * W + x, deg = phi / DEG;
      if (r > 258 + 6 * wobble(fx, fy, 2)) { terrain[i] = T.WATER; continue; }
      let t = land(fx, fy);
      if (r < 13) t = T.MOUNTAIN;
      else if (r < 48) t = fbm(forestNoise, fx / 10, fy / 10, 2) > 0.55 ? T.WOODED_HILLS : T.HILLS;
      else if (r < 52.5) t = T.RIVER; // (l'anneau de fleuve : on le passe à gué, ou par un pont)
      else if (r > 165 + 2 * wobble(fx, fy) && r < 174 + 2 * wobble(fx, fy) && !(deg > 6 && deg < 11)) t = T.PEAK; // (la crête, 2 cols par vallée)
      else if (r > 161 && r < 178 && !(deg > 6 && deg < 11)) t = T.MOUNTAIN;
      else if (r >= 174 && r * phi < 5 + wobble(fx, fy) && !(r > 205 && r < 221)) t = T.PEAK; // (entre deux vallées : une crête à un col)
      else if (r >= 174 && r * phi < 8 && !(r > 205 && r < 221)) t = T.MOUNTAIN;
      terrain[i] = t;
    }
    const part = 45 * DEG;
    for (let k = 0; k < 8; k++) {
      const a = k * part + part / 2; // (l'axe de la vallée k)
      spot(...polar(212, a));
      deposit(...polar(238, a).map(v => v - 1), 'stone'); // (une carrière derrière la capitale)
      deposit(...polar(118, a).map(v => v - 1), 'iron');  // (une mine de fer à mi-chemin du centre)
      deposit(...polar(98, a - part / 2).map(v => v - 1), k % 2 ? 'stone' : 'iron'); // (entre deux voisins : à partager)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 4; k++) deposit(...polar(31, k * 90 * DEG).map(v => v - 1), 'gold');
    for (let k = 0; k < 8; k++) m.relicSpots.push(at(...polar(24, k * part + part / 2)));
  } else if (type === 'cratere') {
    // 🐉 Le Cratère : un pays fermé par des sommets. Au centre, un volcan : un anneau de sommets percé de 6 portes (une
    // face à chaque joueur), et dedans une vallée très riche (diamant, 3 mines d'or, 3 mines de fer). Autour, une bande
    // de désert, puis les 6 terres de départ, séparées par des montagnes.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 6), i = y * W + x, deg = phi / DEG;
      if (r > 238 + 7 * wobble(fx, fy, 2)) { terrain[i] = T.PEAK; continue; } // (les montagnes infranchissables du bord)
      if (r > 230 + 7 * wobble(fx, fy, 2)) { terrain[i] = T.MOUNTAIN; continue; }
      const gate = deg > 26.5; // (la porte du cratère, face au joueur)
      let t = land(fx, fy);
      if (r < 6) t = T.MOUNTAIN;
      else if (r < 64) t = land(fx, fy, 0.68, 0.9); // (le fond du cratère : fertile)
      else if (r < 71 + wobble(fx, fy)) t = gate ? T.HILLS : T.MOUNTAIN;
      else if (r < 83 + wobble(fx, fy)) t = gate ? T.HILLS : T.PEAK; // (l'anneau du volcan)
      else if (r < 88) t = gate ? T.HILLS : T.MOUNTAIN;
      else if (r > 100 + 3 * wobble(fx, fy) && r < 132 + 3 * wobble(fx, fy)) t = t === T.HILLS || t === T.MOUNTAIN ? t : T.DESERT; // (le désert)
      else if (r > 140 && r * phi < 6 + 2 * wobble(fx, fy)) t = T.MOUNTAIN; // (entre deux terres de départ : des montagnes, lentes à passer)
      terrain[i] = t;
    }
    const part = 60 * DEG;
    for (let k = 0; k < 6; k++) {
      const a = k * part + part / 2;
      spot(...polar(178, a));
      deposit(...polar(203, a).map(v => v - 1), 'stone');
      deposit(...polar(160, a + 12 * DEG).map(v => v - 1), 'iron');
      deposit(...polar(44, k * part).map(v => v - 1), k % 2 ? 'iron' : 'gold'); // (dans le cratère, entre deux portes)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 6; k++) m.relicSpots.push(at(...polar(28, k * part + part / 2)));
  } else if (type === 'carrefour') {
    // 🌊 Le Carrefour des Fleuves : 4 royaumes dans les coins, séparés par 4 grands fleuves qui vont du bord de la carte
    // à un lac central (on les passe à gué, lentement, ou par un pont). Au milieu du lac, une île au trésor (diamant) :
    // on ne l'atteint qu'en bateau. Le long des fleuves, de bonnes terres et des mines d'or.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 4), i = y * W + x;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (edge < 9 + 3 * wobble(fx, fy, 2)) { terrain[i] = T.WATER; continue; } // (la mer tout autour)
      const lake = 60 + 4 * wobble(fx, fy);
      if (r < 24 + 2 * wobble(fx, fy)) terrain[i] = r < 6 ? T.MOUNTAIN : T.HILLS; // (l'île au trésor)
      else if (r < lake) terrain[i] = T.WATER;
      else if (fy < 2.5) terrain[i] = T.GREAT_RIVER; // (les 4 grands fleuves, le long des axes)
      else if (fy < 10) terrain[i] = T.PLAINS; // (les berges : fertiles)
      else terrain[i] = land(fx, fy);
    }
    for (let k = 0; k < 4; k++) {
      const a = k * 90 * DEG + 45 * DEG;
      spot(...polar(222, a));
      deposit(...polar(268, a).map(v => v - 1), 'stone');
      deposit(...polar(130, a).map(v => v - 1), 'iron');
      // (deux mines d'or le long des deux fleuves de ce royaume)
      deposit(...polar(150, a - 39 * DEG).map(v => v - 1), 'gold');
      deposit(...polar(150, a + 39 * DEG).map(v => v - 1), 'gold');
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 4; k++) m.relicSpots.push(at(...polar(14, k * 90 * DEG + 45 * DEG)));
  } else if (type === 'archipel') {
    // 🏝️ L'Archipel des Rois : une île par royaume (une carrière et une mine de fer), un îlot riche entre deux îles
    // (de l'or, à partager) et une grande île montagneuse au centre (diamant, or et fer). Rien sans ports !
    const part = 45 * DEG;
    const home = [225 * DMath.cos(part / 2), 225 * DMath.sin(part / 2)]; // (le centre de l'île de départ, replié)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, fx, fy } = fold(x, y, 8), i = y * W + x;
      const dh = DMath.hypot(fx - home[0], fy - home[1]), di = DMath.hypot(fx - 232, fy);
      if (dh < 47 + 5 * wobble(fx, fy)) terrain[i] = land(fx, fy);           // (une île de départ)
      else if (di < 14 + 2 * wobble(fx, fy)) terrain[i] = land(fx, fy, 0.5, 0.7); // (un îlot riche)
      else if (r < 88 + 7 * wobble(fx, fy, 1.5)) terrain[i] = land(fx, fy, 0.45, 0.66); // (la grande île du centre)
      else terrain[i] = T.WATER;
    }
    for (let k = 0; k < 8; k++) {
      const a = k * part + part / 2;
      spot(...polar(225, a));
      deposit(...polar(252, a).map(v => v - 1), 'stone');
      deposit(...polar(200, a).map(v => v - 1), 'iron');
      deposit(...polar(232, k * part).map(v => v - 1), 'gold'); // (l'îlot entre deux îles)
      deposit(...polar(52, k * part).map(v => v - 1), k % 2 ? 'iron' : 'gold');
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 8; k++) m.relicSpots.push(at(...polar(30, k * part + part / 2)));
  } else if (type === 'rives') {
    // ⚔️ Les Deux Rives : un grand fleuve coupe la carte en deux, 4 places de chaque côté ; au milieu du fleuve, une
    // chaîne d'îles riches (on y passe à gué) : le front se joue là. La mer au nord et au sud, des sommets à l'ouest et
    // à l'est.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = Math.abs(x + 0.5 - cx), fy = Math.abs(y + 0.5 - cy), i = y * W + x;
      if (fx > W / 2 - 8 - 3 * wobble(fx, fy, 2)) { terrain[i] = T.PEAK; continue; }
      if (fy > H / 2 - 11 - 3 * wobble(fx, fy, 2)) { terrain[i] = T.WATER; continue; }
      const seg = (fx + 32) % 64, island = fy < 5 && seg > 6 && seg < 58 && fx < 284; // (les îles, avec un chenal entre deux)
      if (island) terrain[i] = seg > 26 && seg < 38 ? T.HILLS : T.PLAINS;
      else if (fy < 10) terrain[i] = T.GREAT_RIVER;
      else if (fy < 16) terrain[i] = T.PLAINS; // (les berges)
      else terrain[i] = land(fx, fy);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const d of [96, 228]) {
      const x = cx + sx * d, y = cy + sy * 118;
      spot(x, y);
      deposit(x - 1, cy + sy * 150 - 1, 'stone');
      deposit(x + sx * 38 - 1, y - 1, 'iron');
    }
    // (sur les îles du fleuve : le diamant au centre, puis de l'or, du fer et de l'or vers les bords)
    const kinds = ['diamond', 'gold', 'iron', 'gold', 'stone'];
    for (let k = 0; k < 5; k++) for (const s of k ? [-1, 1] : [1]) deposit(cx + s * k * 64 - 1, cy - 1, kinds[k]);
    for (const s of [-1, 1]) m.relicSpots.push(at(cx + s * 20, cy));
  }

  // (petites variations de couleur pour un rendu moins plat)
  const shade = new Int8Array(N);
  for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12);
  m.shade = shade;
  return m;
}
