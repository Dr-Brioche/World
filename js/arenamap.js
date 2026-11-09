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
  couronne: { name: tr('La Couronne', 'The Crown'), W: 560, H: 560, players: 8,
    desc: tr('8 vallées gardées par des crêtes à cols, autour d\'un plateau entouré d\'un fleuve : un diamant et 4 mines d\'or au centre.', '8 valleys guarded by ridges with passes, around a plateau ringed by a river: a diamond and 4 gold mines in the centre.') },
  // 🐉 un volcan au centre : un cratère riche, fermé par un anneau de sommets percé d'une porte par joueur
  cratere: { name: tr('Le Cratère', 'The Crater'), W: 520, H: 520, players: 6,
    desc: tr('Un volcan au centre, avec une porte face à chaque joueur : un cratère très riche, entouré d\'un désert.', 'A volcano in the centre, with a gate facing each player: a very rich crater, surrounded by desert.') },
  // 🌊 quatre grands fleuves et un lac au centre, avec une île au trésor qu'on n'atteint qu'en bateau
  carrefour: { name: tr('Le Carrefour des Fleuves', 'The River Crossroads'), W: 500, H: 500, players: 4,
    desc: tr('4 royaumes dans les coins, séparés par 4 grands fleuves ; une île au diamant dans le lac, qu\'on n\'atteint qu\'en bateau.', '4 kingdoms in the corners, split by 4 great rivers; a diamond island in the lake, reachable only by boat.') },
  // 🏝️ une île par royaume, des îlots riches entre elles, et une grande île au centre
  archipel: { name: tr("L'Archipel des Rois", 'The Archipelago of Kings'), W: 600, H: 600, players: 8,
    desc: tr('Une île par royaume, un îlot d\'or entre deux îles et une grande île riche au centre : rien sans ports.', 'An island for each kingdom, a gold islet between two islands and a big rich island in the centre: nothing without ports.') },
  // ⚔️ deux rives d'un grand fleuve, 4 places de chaque côté, et une chaîne d'îles riches au milieu
  rives: { name: tr('Les Deux Rives', 'The Two Banks'), W: 640, H: 420, players: 8,
    desc: tr('4 places de chaque côté d\'un grand fleuve, et une chaîne d\'îles riches au milieu, où se joue le front.', '4 places on each side of a great river, and a chain of rich islands in the middle, where the front line is.') },
  // 🌀 un dédale de crêtes : des couloirs, des cols, et des richesses au fond des impasses
  labyrinthe: { name: tr('Le Labyrinthe', 'The Labyrinth'), W: 520, H: 520, players: 4,
    desc: tr('Un dédale de crêtes et de cols, avec des mines au fond des impasses : un mur bien placé ferme tout un pan de la carte.', 'A maze of ridges and passes, with mines at the end of dead ends: a well-placed wall closes a whole part of the map.') },
  // 🏜️ un grand désert et quelques oasis fertiles, reliées au centre par des fleuves
  oasis: { name: tr("L'Oasis", 'The Oasis'), W: 540, H: 540, players: 6,
    desc: tr('Un grand désert et quelques oasis fertiles, reliées au centre par des fleuves : la bonne terre est rare.', 'A great desert and a few fertile oases, linked to the centre by rivers: good land is rare.') },
  // 🏔️ chacun sur un haut plateau (bien défendu, lent à traverser), et de riches vallées ouvertes entre eux
  plateaux: { name: tr('Les Hauts Plateaux', 'The High Plateaus'), W: 520, H: 520, players: 4,
    desc: tr('Chacun sur un plateau de collines, bien défendu mais lent ; entre eux, de riches vallées ouvertes.', 'Everyone on a plateau of hills, well defended but slow; between them, rich open valleys.') },
  // 🌉 un delta : des dizaines d'îles séparées par des bras de fleuve ; les ponts font tout
  ponts: { name: tr('Les Mille Ponts', 'The Thousand Bridges'), W: 540, H: 540, players: 6,
    desc: tr('Un delta de dizaines d\'îles séparées par des bras de fleuve : celui qui bâtit vite ses ponts avance deux fois plus vite.', 'A delta of dozens of islands split by river arms: whoever builds bridges quickly moves twice as fast.') },
  // ✝️ trois sanctuaires au centre, où les reliques apparaissent ; des hauteurs pour les églises
  saints: { name: tr('Les Lieux Saints', 'The Holy Places'), W: 540, H: 540, players: 6,
    desc: tr('Trois sanctuaires au centre, où apparaissent les reliques, et des départs sur les hauteurs : une partie de Croyance.', 'Three sanctuaries in the centre, where relics appear, and starts on the heights: a game of Faith.') },
  // ⛵ une mer au centre, entourée d'un anneau de terre : deux fronts, la terre et la côte
  merinterieure: { name: tr('La Mer Intérieure', 'The Inland Sea'), W: 600, H: 600, players: 8,
    desc: tr('Un anneau de terre autour d\'une mer : des voisins par la terre et par la mer, deux fronts à tenir.', 'A ring of land around a sea: neighbours by land and by sea, two fronts to hold.') },
  // 🗻 un grand massif au centre, lent et bien défendu, aux flancs riches en fer et en or
  montagne: { name: tr('La Montagne Sacrée', 'The Sacred Mountain'), W: 540, H: 540, players: 5,
    desc: tr('Un grand massif au centre, lent et bien défendu, avec du fer et de l\'or sur ses flancs et un diamant au sommet.', 'A great massif in the centre, slow and well defended, with iron and gold on its slopes and a diamond at the top.') },
  // ❄️ au sud des terres fertiles, au nord la neige et les filons : l'économie ou la force ?
  nord: { name: tr('Les Terres du Nord', 'The Northern Lands'), W: 600, H: 440, players: 4,
    desc: tr('Au sud des terres fertiles, au nord la neige et tous les filons : l\'économie ou la force ?', 'In the south fertile land, in the north snow and every ore vein: economy or strength?') },
  // 🛡️ 20 royaumes serrés en cercle sur une petite île : des voisins partout, dès la première minute
  melee: { name: tr('La Mêlée', 'The Melee'), W: 400, H: 400, players: 20,
    desc: tr('20 royaumes serrés en cercle sur une petite île, autour d\'un centre riche : pas de place, des voisins dès la première minute.', '20 kingdoms packed in a circle on a small island, around a rich centre: no room, neighbours from the very first minute.') },
  // 🌿 la première carte de gloire : une île en octogone, des mines de gloire enclavées (lacs, sommets) à prendre et tenir
  // (glory : une carte de gloire, rangée à part dans le menu ; gloryRate : la gloire de chaque tour, ici divisée par 2,
  //  puisqu'il y a 9 tours pour 8 royaumes)
  gloire: { name: tr("L'Octogone de la Gloire", 'The Octagon of Glory'), W: 500, H: 500, players: 8, glory: true, gloryRate: 0.5,
    desc: tr('Une île en octogone et 9 mines de gloire, enfermées dans des lacs ou des sommets avec un seul petit accès : tiens-les pour remplir la jauge de gloire.', 'An octagonal island and 9 glory mines, shut in by lakes or peaks with a single small way in: hold them to fill the glory gauge.') },
  // 🌿 une petite île en triangle pour 3 : un massif au centre, et sur chaque frontière une rivière avec deux îles de gloire
  // (ox : le centre du triangle est décalé, pour que l'île soit au milieu de la carte)
  trois: { name: tr('Le Trône des Trois', 'The Throne of Three'), W: 340, H: 380, players: 3, glory: true, ox: 34,
    desc: tr('Une île en triangle pour 3 royaumes : au cœur d\'un massif à 3 cols, le Trône ; sur chaque frontière, une rivière et ses deux îles de gloire, dont une dans un cirque de sommets qu\'on n\'atteint que par l\'étroite vallée de la rivière.', 'A triangular island for 3 kingdoms: in the heart of a massif with 3 passes, the Throne; on each border, a river and its two glory islands, one of them in a cirque of peaks reachable only through the narrow river valley.') },
  // 🌿 trois îles du Trône des Trois (la même forme), de 3 royaumes chacune, séparées par une grande mer ; au centre,
  // l'îlot de la Couronne. (scale : la taille de chaque île, par rapport à celle du Trône des Trois ; dist : la distance
  // du centre de la carte au centre de chaque île ; gloryRate : 22 tours de gloire pour 9 royaumes, la jauge ne se
  // remplit pas 3 fois plus vite que sur le Trône des Trois)
  troistrones: { name: tr('Les Trois Trônes', 'The Three Thrones'), W: 700, H: 640, oy: 82, players: 9, glory: true, gloryRate: 0.4, scale: 0.85, dist: 232,
    desc: tr('3 îles toutes pareilles, de 3 royaumes chacune (le Trône des Trois), séparées par une grande mer : sur chaque île, un Trône et 6 îles de gloire ; au milieu de la mer, l\'îlot de la Couronne, qu\'on n\'atteint qu\'en bateau.', '3 identical islands of 3 kingdoms each (the Throne of Three), split by a wide sea: on each island, a Throne and 6 glory islands; in the middle of the sea, the Crown islet, reachable only by boat.') },
};

function generateArenaMap(type, seed) {
  const A = ARENA_MAPS[type], W = A.W, H = A.H, N = W * H, T = TERRAIN;
  const rand = mulberry32(seed);
  const reliefNoise = makeValueNoise(rand), forestNoise = makeValueNoise(rand), edgeNoise = makeValueNoise(rand);
  const terrain = new Uint8Array(N);
  const m = { W, H, N, terrain, spots: [], deposits: [], relicSpots: [], arena: type };
  const cx = W / 2 + (A.ox || 0), cy = H / 2 + (A.oy || 0), DEG = Math.PI / 180;

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
    const t = kind === 'stone' || kind === 'glory' ? T.HILLS : T.MOUNTAIN; // (🌿 la gloire : sur une colline)
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
  } else if (type === 'labyrinthe') {
    // 🌀 Le Labyrinthe : des anneaux de sommets percés de cols, et des crêtes entre eux. Chaque royaume sort de son
    // couloir par deux cols ; derrière lui, une impasse avec sa mine d'or ; entre deux voisins, une impasse partagée
    // (du fer) ; la porte du centre (diamant, or) est entre deux voisins, au bout du dédale.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 4), i = y * W + x, deg = phi / DEG, w = wobble(fx, fy);
      let t = land(fx, fy, 0.62, 0.8);
      if (r > 250 + 4 * w) t = T.PEAK;
      else if (Math.abs(r - 202) < 4 && !(deg > 15 && deg < 21) && !(deg > 43)) t = T.PEAK;   // (anneau 1 : 2 cols, et l'entrée de l'impasse)
      else if (r > 147 && r < 198 && r * phi < 3) t = T.PEAK;                                // (crête entre deux voisins)
      else if (Math.abs(r - 145) < 4 && !(deg > 8 && deg < 12) && !(deg > 41)) t = T.PEAK;    // (anneau 2)
      else if (r > 92 && r < 141 && Math.abs(deg - 22) < 1.4) t = T.PEAK;                    // (crêtes : des impasses)
      else if (Math.abs(r - 90) < 4 && !(deg < 4)) t = T.PEAK;                                // (anneau 3 : la porte du centre)
      else if (r < 7) t = T.MOUNTAIN;
      terrain[i] = t;
    }
    const part = 90 * DEG;
    for (let k = 0; k < 4; k++) {
      const a = k * part + part / 2;
      spot(...polar(226, a));
      deposit(...polar(226, a + 10 * DEG).map(v => v - 1), 'stone');
      deposit(...polar(118, a).map(v => v - 1), 'gold');            // (au fond de son impasse)
      deposit(...polar(118, k * part).map(v => v - 1), 'iron');     // (l'impasse partagée entre deux voisins)
      deposit(...polar(50, a).map(v => v - 1), 'gold');             // (au centre)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 4; k++) m.relicSpots.push(at(...polar(30, k * part)));
  } else if (type === 'oasis') {
    // 🏜️ L'Oasis : un grand désert (−20 % de production), quelques collines. Chaque royaume commence dans une petite
    // oasis ; entre deux royaumes, une oasis avec de l'or ; au centre, une grande oasis (diamant, fer), reliée aux autres
    // par des fleuves.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 6), i = y * W + x, w = wobble(fx, fy);
      const home = DMath.hypot(fx - 200 * DMath.cos(30 * DEG), fy - 200 * DMath.sin(30 * DEG)), mid = DMath.hypot(fx - 122, fy);
      let t = land(fx, fy, 0.64, 0.8);
      const oasis = home < 34 + 4 * w || mid < 24 + 3 * w || r < 72 + 5 * w;
      if (r > 255 + 4 * w) t = T.PEAK;
      else if (r * phi < 1.6 && r > 66 && r < 102) t = T.RIVER; // (le fleuve qui relie l'oasis du centre à celle des voisins)
      else if (!oasis && t !== T.HILLS && t !== T.MOUNTAIN && t !== T.WOODED_HILLS) t = T.DESERT;
      else if (!oasis && t === T.WOODED_HILLS) t = T.HILLS;
      terrain[i] = t;
    }
    const part = 60 * DEG;
    for (let k = 0; k < 6; k++) {
      const a = k * part + part / 2;
      spot(...polar(200, a));
      deposit(...polar(226, a).map(v => v - 1), 'stone');
      deposit(...polar(122, k * part + 7 * DEG).map(v => v - 1), 'gold'); // (l'oasis entre deux royaumes)
      deposit(...polar(150, a).map(v => v - 1), 'iron');                // (dans les collines du désert)
      deposit(...polar(42, a).map(v => v - 1), k % 2 ? 'iron' : 'gold');  // (la grande oasis)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 6; k++) m.relicSpots.push(at(...polar(24, k * part)));
  } else if (type === 'plateaux') {
    // 🏔️ Les Hauts Plateaux : chaque royaume sur un plateau de collines, bordé de pentes de montagne percées de 4 rampes ;
    // entre les plateaux, de larges vallées de plaine, ouvertes et riches (un fleuve, de l'or, du fer) ; un diamant au
    // centre, dans la plaine.
    const P = [175 * DMath.cos(45 * DEG), 175 * DMath.sin(45 * DEG)]; // (le centre du plateau, replié)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 4), i = y * W + x, deg = phi / DEG, w = wobble(fx, fy);
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y), d = DMath.hypot(fx - P[0], fy - P[1]);
      const ramp = deg > 39.5 || Math.abs(r - 175) < 7; // (4 rampes : vers le centre, vers le bord, et vers les deux vallées)
      let t;
      if (edge < 9 + 3 * w) t = T.WATER;
      else if (d < 62 + 3 * w) { // (le plateau : des collines, avec des replats de plaine)
        const e = fbm(reliefNoise, fx / 10 + 9, fy / 10 + 4, 2);
        t = e < 0.45 ? T.PLAINS : fbm(forestNoise, fx / 11, fy / 11, 2) > 0.55 ? T.WOODED_HILLS : T.HILLS;
      }
      else if (d < 71 + 3 * w) t = ramp ? T.HILLS : T.MOUNTAIN; // (ses pentes)
      else if (r > 40 && r * phi < 1.6) t = T.RIVER;              // (le fleuve de la vallée)
      else t = land(fx, fy, 0.75, 0.9);                            // (la vallée : surtout des plaines et des forêts)
      terrain[i] = t;
    }
    const part = 90 * DEG;
    for (let k = 0; k < 4; k++) {
      const a = k * part + part / 2;
      spot(...polar(175, a));
      deposit(...polar(200, a + 8 * DEG).map(v => v - 1), 'stone');
      deposit(...polar(140, k * part + 8 * DEG).map(v => v - 1), 'gold'); // (dans la vallée, au bord du fleuve)
      deposit(...polar(140, k * part - 8 * DEG).map(v => v - 1), 'gold');
      deposit(...polar(230, k * part + 6 * DEG).map(v => v - 1), 'iron');
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 4; k++) m.relicSpots.push(at(...polar(20, k * part + part / 2)));
  } else if (type === 'ponts') {
    // 🌉 Les Mille Ponts : un delta rond, découpé par des bras de fleuve en dizaines d'îles d'environ 30 cases de côté.
    // Tout se passe à gué, lentement : bâtir des ponts change tout.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, fx, fy } = fold(x, y, 6), i = y * W + x, w = wobble(fx, fy, 2);
      let t = land(fx, fy, 0.66, 0.82);
      const gx = (fx + 400) % 33, gy = (fy + 400 + 0.5 * fx) % 33; // (le quadrillage des bras du fleuve, un peu de biais)
      if (r > 258 + 5 * w) t = T.WATER;
      else if ((gx < 2 || gy < 2) && r > 22) t = T.RIVER;
      terrain[i] = t;
    }
    const part = 60 * DEG;
    for (let k = 0; k < 6; k++) {
      const a = k * part + part / 2;
      spot(...polar(205, a));
      deposit(...polar(232, a).map(v => v - 1), 'stone');
      deposit(...polar(155, a).map(v => v - 1), 'iron');
      deposit(...polar(110, k * part).map(v => v - 1), 'gold');
      deposit(...polar(60, a).map(v => v - 1), k % 2 ? 'iron' : 'gold');
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 6; k++) m.relicSpots.push(at(...polar(14, k * part)));
  } else if (type === 'saints') {
    // ✝️ Les Lieux Saints : au centre, une grande plaine ouverte avec trois sanctuaires (les reliques y apparaissent) ;
    // chaque royaume commence sur des hauteurs (+30 % pour les églises), à égale distance d'un sanctuaire.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, fx, fy } = fold(x, y, 6), i = y * W + x, w = wobble(fx, fy);
      let t = land(fx, fy);
      if (r > 255 + 4 * w) t = T.PEAK;
      else if (r < 92 + 4 * w) t = fbm(forestNoise, fx / 12, fy / 12, 2) > 0.7 ? T.FOREST : T.PLAINS; // (la plaine sainte)
      else if (r > 165) t = land(fx, fy, 0.42, 0.85); // (les hauteurs : surtout des collines)
      terrain[i] = t;
    }
    const part = 60 * DEG;
    for (let k = 0; k < 6; k++) {
      const a = k * part + part / 2;
      spot(...polar(205, a));
      deposit(...polar(232, a).map(v => v - 1), 'stone');
      deposit(...polar(140, a).map(v => v - 1), 'iron');
      deposit(...polar(112, k * part).map(v => v - 1), 'gold');
    }
    for (let k = 0; k < 3; k++) for (const d of [-4, 4]) m.relicSpots.push(at(...polar(46, k * 120 * DEG + d * DEG))); // (les 3 sanctuaires)
  } else if (type === 'merinterieure') {
    // ⛵ La Mer Intérieure : un anneau de terre autour d'une grande mer ; chaque royaume a une côte sur la mer, et des
    // voisins par la terre. Dans la mer, des îles riches (or) et une île au centre (diamant).
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, fx, fy } = fold(x, y, 8), i = y * W + x, w = wobble(fx, fy, 1.5);
      let t = land(fx, fy);
      const isle = DMath.hypot(fx - 95, fy) < 17 + 2 * w;
      if (r > 274 + 5 * w) t = T.WATER;
      else if (r < 150 + 6 * w && !isle && r > 30 + 2 * w) t = T.WATER;
      terrain[i] = t;
    }
    const part = 45 * DEG;
    for (let k = 0; k < 8; k++) {
      const a = k * part + part / 2;
      spot(...polar(195, a));
      deposit(...polar(245, a).map(v => v - 1), 'stone');
      deposit(...polar(232, k * part).map(v => v - 1), 'iron'); // (entre deux voisins)
      deposit(...polar(95, k * part).map(v => v - 1), 'gold');  // (une île de la mer)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 8; k++) m.relicSpots.push(at(...polar(12, k * part)));
  } else if (type === 'montagne') {
    // 🗻 La Montagne Sacrée : un grand massif au centre (montagnes et collines : lent à prendre, bien défendu), avec du
    // fer et de l'or sur ses flancs et un diamant au sommet ; 5 royaumes dans les plaines autour.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, fx, fy } = fold(x, y, 5), i = y * W + x, w = wobble(fx, fy);
      let t = land(fx, fy);
      if (r > 258 + 4 * w) t = T.PEAK;
      else if (r < 14) t = T.SNOW;
      else if (r < 128 + 8 * w) t = fbm(reliefNoise, fx / 9, fy / 9, 3) > 0.46 ? T.MOUNTAIN : T.HILLS; // (le massif)
      else if (r < 150) t = land(fx, fy, 0.5, 0.8);
      terrain[i] = t;
    }
    const part = 72 * DEG;
    for (let k = 0; k < 5; k++) {
      const a = k * part + part / 2;
      spot(...polar(200, a));
      deposit(...polar(226, a).map(v => v - 1), 'stone');
      deposit(...polar(105, a).map(v => v - 1), 'gold');       // (sur le flanc, face à lui)
      deposit(...polar(75, k * part).map(v => v - 1), 'iron'); // (sur le flanc, entre deux voisins)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 5; k++) m.relicSpots.push(at(...polar(24, k * part + part / 2)));
  } else if (type === 'nord') {
    // ❄️ Les Terres du Nord : 4 royaumes en ligne, au milieu de la carte. Au sud, des terres fertiles (plaines, forêts)
    // jusqu'à la mer ; au nord, la neige, les collines et les montagnes, où sont les filons (fer, or, et un diamant).
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = Math.abs(x + 0.5 - cx), i = y * W + x, w = wobble(fx, y), v = y / H;
      let t;
      if (fx > W / 2 - 8 - 3 * w || v < 0.03 + 0.01 * w) t = T.PEAK;
      else if (v > 0.93 + 0.02 * w) t = T.WATER;
      else if (v < 0.36 + 0.03 * w) { // (le nord : neige, collines, montagnes)
        const e = fbm(reliefNoise, fx / 14 + 5, y / 14, 3);
        t = e > 0.72 ? T.MOUNTAIN : e > 0.5 ? T.SNOW : T.HILLS;
      } else if (v > 0.6) t = land(fx, y, 0.8, 0.95); // (le sud : fertile)
      else t = land(fx, y);
      terrain[i] = t;
    }
    for (const sx of [-1, 1]) for (const d of [70, 205]) {
      const x = cx + sx * d;
      spot(x, H * 0.5);
      deposit(x - 1, H * 0.57, 'stone');
      deposit(x - 1, H * 0.24, 'iron');
      deposit(x + sx * 30 - 1, H * 0.14, 'gold');
    }
    deposit(cx - 1, H * 0.1, 'diamond');
    deposit(cx - 1, H * 0.25, 'gold');
    for (const s of [-1, 1]) m.relicSpots.push(at(cx + s * 30, H * 0.12));
  } else if (type === 'melee') {
    // 🛡️ La Mêlée : une petite île ronde, 20 places en cercle (à peine 47 cases entre deux capitales : 5 fois moins de
    // place que sur La Couronne). Derrière chaque capitale, une carrière près de la côte ; entre deux voisins, une
    // crête de montagne (lente à passer, avec un col) et, plus près du centre, un filon à partager, tour à tour de l'or
    // et du fer (chacun en a un de chaque à côté de lui) ; au centre, un plateau entouré d'un fleuve (diamant, 5 mines d'or).
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 20), i = y * W + x, w = wobble(fx, fy);
      let t = land(fx, 2.5 * fy, 0.66, 0.86); // (une part est très étroite : on étire le relief en largeur, sinon il fait des anneaux)
      if (r > 188 + 5 * wobble(fx, fy, 2)) t = T.WATER;
      else if (r < 8) t = T.MOUNTAIN;
      else if (r < 48) t = fbm(forestNoise, fx / 10, fy / 10, 2) > 0.55 ? T.WOODED_HILLS : T.HILLS; // (le plateau du centre)
      else if (r < 52.5) t = T.RIVER; // (l'anneau de fleuve)
      else if (r > 124 && r * phi < 2.5 + 0.8 * w) t = r > 146 && r < 155 ? T.HILLS : T.MOUNTAIN; // (la crête entre deux voisins, et son col)
      terrain[i] = t;
    }
    const part = 18 * DEG;
    for (let k = 0; k < 20; k++) {
      const a = k * part + part / 2;
      spot(...polar(150, a));
      deposit(...polar(172, a).map(v => v - 1), 'stone');
      deposit(...polar(106, k * part).map(v => v - 1), k % 2 ? 'iron' : 'gold'); // (entre deux voisins : à partager)
    }
    deposit(cx - 1, cy - 1, 'diamond');
    for (let k = 0; k < 5; k++) deposit(...polar(31, k * 72 * DEG + 36 * DEG).map(v => v - 1), 'gold');
    for (let k = 0; k < 5; k++) m.relicSpots.push(at(...polar(22, k * 72 * DEG)));
  }

  if (type === 'gloire') {
    // 🌿 L'Octogone de la Gloire : une île en octogone (côtes irrégulières), un terrain naturel (plaines, forêts,
    // collines, quelques montagnes). 8 places de départ face aux 8 côtés. 9 mines de gloire, enclavées :
    //  - au centre, le Sanctuaire : un anneau de sommets percé de 8 portes étroites (une entre deux voisins) ;
    //  - entre deux voisins, à mi-chemin du centre : une mine sur une colline au milieu d'un lac, reliée à la terre
    //    par une seule petite chaussée, tournée vers le centre (aussi loin de l'un que de l'autre).
    // Entre deux voisins, vers la côte, une crête de montagnes (lente à passer, pas fermée).
    const part = 45 * DEG, half = part / 2, lakeR = 122, lake = [lakeR, 0]; // (le lac, sur la limite entre deux parts)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const { r, phi, fx, fy } = fold(x, y, 8), i = y * W + x, w = wobble(fx, fy), w2 = wobble(fx, fy, 2);
      // (la côte : un octogone, côtés face aux places de départ, avec des caps et des baies)
      const coast = 224 / DMath.cos(half - phi) + 4 * w2 + 2.5 * w;
      if (r > coast) { terrain[i] = T.WATER; continue; }
      // (vers le centre, des terres plus ouvertes : on y court vers la gloire ; plus de relief vers la côte)
      let t = r < 158 ? land(fx, fy, 0.72, 0.88) : land(fx, fy, 0.62, 0.8);
      // (le lac autour de la mine, et sa chaussée vers le centre : une bande étroite le long de la limite)
      const dl = DMath.hypot(fx - lake[0], fy - lake[1]);
      if (dl < 8) t = T.HILLS;                                              // (l'île de la mine)
      else if (dl < 16 + 2.5 * w) t = fx < lakeR && fy < 2.2 ? T.PLAINS : T.WATER; // (le lac ; la chaussée, vers le centre)
      // (le Sanctuaire du centre : des collines, puis un anneau de sommets percé de 8 portes, entre deux voisins)
      else if (r < 22) t = fbm(forestNoise, fx / 9, fy / 9, 2) > 0.58 ? T.WOODED_HILLS : T.HILLS;
      else if (r < 34 + 1.5 * w) t = r * phi < 2.6 ? T.HILLS : r > 25 && r < 31 + w ? T.PEAK : T.MOUNTAIN;
      // (entre deux voisins, vers la côte : une crête de montagnes en chapelet, plus ou moins large, avec un col)
      else if (r > 150 && r < coast - 12) {
        const e = fbm(reliefNoise, fx / 7 + 11, fy / 7 + 5, 2), wide = 1 + 9 * e * e;
        if (r * phi < wide && !(r > 174 && r < 186)) t = r * phi < wide * 0.45 && e > 0.55 ? T.PEAK : T.MOUNTAIN;
        else if (r * phi < wide + 4) t = t === T.PLAINS ? T.HILLS : t === T.FOREST ? T.WOODED_HILLS : t;
      }
      terrain[i] = t;
    }
    for (let k = 0; k < 8; k++) {
      const a = k * part + half;
      spot(...polar(184, a));
      deposit(...polar(206, a).map(v => v - 1), 'stone');          // (une carrière derrière la capitale)
      deposit(...polar(150, a + 12 * DEG).map(v => v - 1), 'iron'); // (une mine de fer sur le côté)
      deposit(...polar(72, a).map(v => v - 1), 'gold');             // (de l'or devant, vers le centre)
      deposit(...polar(lakeR, k * part).map(v => v - 1), 'glory');  // (la mine de gloire du lac, entre deux voisins)
    }
    deposit(cx - 1, cy - 1, 'glory'); // (le Sanctuaire)
    for (let k = 0; k < 8; k++) m.relicSpots.push(at(...polar(14, k * part + half)));
  }

  // 🌿 L'île du Trône des Trois, posée en (icx, icy), tournée de rot (en radians) et à l'échelle S : une île en triangle
  // aux coins arrondis, 3 royaumes dans les coins. Au centre, un grand massif (montagnes, et un anneau de sommets)
  // percé de 3 cols étroits, un face à chaque frontière : au fond, le Trône (une tour de gloire). Sur chaque frontière,
  // du massif à la mer, coule une rivière (on la passe à gué, lentement) avec deux îles de gloire : l'île du Gué, à
  // mi-chemin, reliée à chaque rive par une petite chaussée, et l'île du Cirque, près de la côte, enfermée dans un
  // anneau de sommets : on n'y entre que par l'étroite vallée de la rivière, sur ses sentiers de berge.
  // Chaque royaume a son lac, ses forêts, une carrière, du fer vers le massif et deux mines d'or sur ses flancs.
  // (le terrain se calcule dans les coordonnées de l'île, avant rotation et échelle : plusieurs îles posées ainsi ont
  //  exactement la même forme et le même terrain)
  const throneIsland = (icx, icy, rot, S) => {
    const part = 120 * DEG, half = part / 2, inn = 72, cirque = 103, reach = 190 * S;
    const cr = DMath.cos(rot), sr = DMath.sin(rot);
    // (un point de l'île, donné en coordonnées de l'île, sur la carte)
    const place = (r, a) => [icx + S * r * DMath.cos(a + rot), icy + S * r * DMath.sin(a + rot)];
    for (let y = Math.max(0, Math.floor(icy - reach)); y < Math.min(H, icy + reach); y++) for (let x = Math.max(0, Math.floor(icx - reach)); x < Math.min(W, icx + reach); x++) {
      // (la case ramenée dans l'île : décalée, tournée de -rot, puis à l'échelle 1)
      const dx = x + 0.5 - icx, dy = y + 0.5 - icy, ux = (dx * cr + dy * sr) / S, uy = (-dx * sr + dy * cr) / S;
      const r = DMath.hypot(ux, uy);
      let phi = DMath.atan2(uy, ux) % part;
      if (phi < 0) phi += part;
      if (phi > half) phi = part - phi;
      const fx = r * DMath.cos(phi), fy = r * DMath.sin(phi), i = y * W + x, w = wobble(fx, fy), w2 = wobble(fx, fy, 2);
      // (la côte : un triangle aux coins arrondis, ses côtés face aux frontières ; un peu de dentelle)
      const coast = 118 / DMath.pow(DMath.cos(Math.min(phi, half - 0.02)), 0.62) + 5 * w2 + 2 * w;
      if (r > coast) continue; // (la mer : déjà là)
      let t = land(fx, fy, 0.64, 0.82);
      const dIn = DMath.hypot(fx - inn, fy), dCi = DMath.hypot(fx - cirque, fy);
      // (le lac de chaque royaume, derrière sa capitale, un peu de côté)
      const lake = DMath.hypot(fx - 112 * DMath.cos(half - 0.42), fy - 112 * DMath.sin(half - 0.42));
      if (lake < 9 + 2 * w) t = T.WATER;
      // (le massif du centre : le Trône, l'anneau de sommets et ses 3 cols, puis les montagnes autour)
      else if (r < 15) t = T.HILLS;
      else if (r < 40 + 2 * w) t = r * phi < 2.4 ? T.HILLS : r > 22 && r < 33 + w ? T.PEAK : T.MOUNTAIN;
      else if (r < 50 + 3 * w && r * phi > 4) t = fbm(reliefNoise, fx / 8, fy / 8, 2) > 0.5 ? T.MOUNTAIN : T.WOODED_HILLS;
      // (le cirque de l'île de gloire près de la côte : un fer à cheval de sommets, ouvert seulement sur la rivière)
      else if (dCi < 7) t = fy < 1.2 && dCi > 3.6 ? T.RIVER : T.HILLS;
      else if (dCi < 13 + w) t = fy < 1.2 ? T.RIVER : fy < 2.8 ? T.PLAINS : dCi < 11 + w ? T.PEAK : T.MOUNTAIN; // (la rivière, et un sentier de berge de chaque côté)
      // (l'île du Gué : une colline au milieu de la rivière, qui se partage en deux bras autour d'elle)
      else if (dIn < 5) t = T.HILLS;
      else if (dIn < 8.5) t = Math.abs(fx - inn) < 1.3 ? T.PLAINS : T.RIVER; // (deux petites chaussées, une de chaque rive)
      // (la rivière de la frontière, du massif à la mer)
      else if (r > 46 && fy < 1.2 + 0.3 * w) t = T.RIVER;
      // (des berges fertiles le long de la rivière)
      else if (r > 46 && fy < 7 && t !== T.WATER) t = t === T.HILLS || t === T.MOUNTAIN ? T.FOREST : T.PLAINS;
      terrain[i] = t;
    }
    for (let k = 0; k < 3; k++) {
      const a = k * part + half, b = k * part; // (a : l'axe du royaume k ; b : la frontière entre deux royaumes)
      spot(...place(140, a));
      deposit(...place(166, a).map(v => v - 1), 'stone');
      deposit(...place(84, a).map(v => v - 1), 'iron');
      for (const s of [-1, 1]) deposit(...place(100, a + s * 16 * DEG).map(v => v - 1), 'gold'); // (entre la capitale et ses lacs)
      deposit(...place(inn, b).map(v => v - 1), 'glory');    // (l'île du Gué)
      deposit(...place(cirque, b).map(v => v - 1), 'glory'); // (l'île du Cirque)
    }
    deposit(icx - 1, icy - 1, 'glory'); // (le Trône)
    for (let k = 0; k < 3; k++) m.relicSpots.push(at(...place(9, k * part + half)));
  };

  if (type === 'trois') {
    // 🌿 Le Trône des Trois : une seule île, au milieu de la carte (voir throneIsland)
    terrain.fill(T.WATER);
    throneIsland(cx, cy, 0, 1);
  }

  if (type === 'troistrones') {
    // 🌿 Les Trois Trônes : 3 îles du Trône des Trois, toutes pareilles (même forme, même terrain), de 3 royaumes
    // chacune, autour d'une grande mer ; au milieu de la mer, l'îlot de la Couronne (une tour de gloire), qu'on
    // n'atteint qu'en bateau. Chaque île tourne un de ses côtés vers le centre : ses voisins d'île sont loin, de
    // l'autre côté d'une large mer.
    terrain.fill(T.WATER);
    const S = A.scale, D = A.dist;
    for (let k = 0; k < 3; k++) {
      const ang = -90 * DEG + k * 120 * DEG;
      // (le côté de l'île qui regarde le centre : sa frontière b = 0 doit pointer vers le centre de la carte)
      throneIsland(cx + D * DMath.cos(ang), cy + D * DMath.sin(ang), ang + Math.PI, S);
    }
    // (l'îlot de la Couronne : une colline boisée au milieu de la mer, avec sa tour de gloire)
    // (24 cases de rayon, deux fois la taille d'avant)
    for (let y = Math.floor(cy - 30); y <= cy + 30; y++) for (let x = Math.floor(cx - 30); x <= cx + 30; x++) {
      const d = DMath.hypot(x + 0.5 - cx, y + 0.5 - cy), w = wobble(x - cx, y - cy);
      if (inMap(x, y) && d < 24 + 4 * w) terrain[y * W + x] = d < 10 ? T.HILLS : fbm(forestNoise, x / 6, y / 6, 2) > 0.55 ? T.FOREST : T.PLAINS;
    }
    deposit(cx - 1, cy - 1, 'glory');
  }

  // (petites variations de couleur pour un rendu moins plat)
  const shade = new Int8Array(N);
  for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12);
  m.shade = shade;
  return m;
}
