// 🏰 CARTE ET RÉGLAGES DU « GOUFFRE DE HELM » (scénario : ses règles sont dans helm.js)
// Une petite carte dessinée à la main, en cases (320 x 200) : à l'ouest, les plaines de l'Ouestfolde (d'où vient
// l'armée d'Isengard) ; puis la Combe du Gouffre, une vallée qui se resserre en entonnoir entre les Montagnes Blanches ;
// la Digue de Helm, sur un étranglement ; le Fort-le-Cor et le Mur du Gouffre, qui ferment l'entrée de la gorge ;
// et au fond du Gouffre, les Cavernes Scintillantes. Tout autour : des montagnes, et une crête infranchissable.

const HELM_MAP = {
  W: 320, H: 200,
  // La vallée, d'ouest en est : [x, y du milieu de la vallée, demi-largeur] (en cases ; entre deux points, on
  // passe en ligne droite). Une demi-largeur de 0 = la vallée se termine (le fond du Gouffre).
  valley: [
    [0, 100, 120], [50, 100, 110], [110, 100, 58], [148, 101, 26],
    [160, 102, 8], [172, 102, 8],                // l'étranglement de la Digue de Helm
    [184, 101, 22], [198, 100, 24],              // le « pré vert » entre la Digue et le Mur
    [208, 99, 15], [222, 98, 14],                // l'entrée de la gorge (Fort-le-Cor et Mur du Gouffre)
    [270, 98, 15], [298, 97, 16], [314, 97, 0],  // le Gouffre, jusqu'aux Cavernes Scintillantes
  ],
  // Les lieux (en cases : le centre du bâtiment)
  places: {
    dike: [166, 102],      // la Digue de Helm
    hornburg: [208, 87],   // Fort-le-Cor, sur son éperon rocheux, au nord de l'entrée
    wall: [214, 110],      // le Mur du Gouffre, qui ferme le reste de l'entrée
    caves: [298, 97],      // les Cavernes Scintillantes (Aglarond)
    isengard: [30, 100],   // le camp d'Isengard, dans l'Ouestfolde
    dunland: [125, 128],   // le camp des Dunlendings (hommes du Pays de Dun), au sud de la Combe
    culvert: [229, 104],   // le ponceau du Ruisseau du Gouffre, juste derrière le Mur
  },
};

// Le milieu et la demi-largeur de la vallée à l'abscisse x
function helmValley(x) {
  const v = HELM_MAP.valley;
  if (x <= v[0][0]) return { cy: v[0][1], hw: v[0][2] };
  for (let k = 0; k + 1 < v.length; k++) {
    const [x0, y0, w0] = v[k], [x1, y1, w1] = v[k + 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      // (au bout du Gouffre, la vallée se referme en arrondi)
      const hw = w1 === 0 ? w0 * Math.sqrt(Math.max(0, 1 - t * t)) : w0 + (w1 - w0) * t;
      return { cy: y0 + (y1 - y0) * t, hw };
    }
  }
  return { cy: v[v.length - 1][1], hw: 0 };
}

function generateHelmMap(seed) {
  const W = HELM_MAP.W, H = HELM_MAP.H, N = W * H, T = TERRAIN;
  const rand = mulberry32(seed);
  const edgeNoise = makeValueNoise(rand), forestNoise = makeValueNoise(rand), rockNoise = makeValueNoise(rand);
  const terrain = new Uint8Array(N), inValley = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, { cy, hw } = helmValley(x + 0.5);
      // d = distance au milieu de la vallée (bords irréguliers, mais à peine aux étranglements, pour que les
      // murailles des forts les ferment bien) ; r = la même, rapportée à la demi-largeur (1 = pied des falaises)
      const d = Math.abs(y + 0.5 - cy) + (fbm(edgeNoise, x / 9, y / 9, 3) - 0.5) * Math.min(8, hw * 0.25);
      const r = hw > 0.5 ? d / hw : Infinity;
      const f = fbm(forestNoise, x / 22, y / 22, 4), h = fbm(rockNoise, x / 11 + 50, y / 11, 3);
      // (au-delà du pied des falaises : un éboulis de montagne là où la vallée est large, puis une crête de
      // sommets infranchissables, d'au moins 3 cases, tout le long de la vallée ; plus loin, un massif où la roche
      // grise et les névés se mêlent)
      const scree = hw > 12 ? hw * 0.22 : 0, beyond = d - hw - scree;
      let t;
      if (r <= 1 || beyond < 0) inValley[i] = 1;
      if (r <= 1) {
        if (r > 0.82) t = T.HILLS;                        // les pentes
        else if (x < 110) {                               // l'Ouestfolde : des champs, des bois, quelques collines
          t = f > 0.58 ? T.FOREST : T.PLAINS;
          if (h < 0.3) t = t === T.FOREST ? T.WOODED_HILLS : T.HILLS;
        } else if (x < 208) t = h < 0.28 ? T.HILLS : T.PLAINS; // la Combe : de l'herbe, quelques rochers
        else t = h < 0.42 ? T.HILLS : T.PLAINS;           // le Gouffre : un fond de gorge rocailleux
        if (t === T.HILLS && x < 110 && f > 0.58) t = T.WOODED_HILLS; // (les pentes boisées de l'Ouestfolde)
      } else if (beyond < 0) t = T.MOUNTAIN;               // l'éboulis au pied des falaises
      else t = fbm(rockNoise, x / 7 + 9, y / 7 + 31, 3) + Math.min(0.15, beyond * 0.003) > 0.6 ? T.PEAK : T.MOUNTAIN;
      terrain[i] = t;
    }
  }
  // La crête : toute case à moins de 3 cases de la vallée (même en diagonale) qui n'en fait pas partie devient un
  // sommet infranchissable ; ainsi elle ne laisse aucun trou, même là où la vallée change brusquement de largeur
  const dist = new Uint8Array(N).fill(255), queue = [];
  for (let i = 0; i < N; i++) if (inValley[i]) { dist[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = (i / W) | 0;
    if (dist[i] >= 3) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[n] !== 255) continue;
      dist[n] = dist[i] + 1;
      terrain[n] = T.PEAK;
      queue.push(n);
    }
  }
  // (pas de fillPockets : les creux de montagne derrière la crête restent de la roche grise, que personne
  //  n'atteint jamais ; c'est juste le décor)
  const shade = new Int8Array(N);
  for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12);
  return { W, H, N, terrain, shade };
}

// --- Les réglages du scénario (ses règles : voir helm.js) ---
const HELM = {
  // Durée de la nuit (minutes avant l'aube), selon la difficulté
  NIGHT: { facile: 14, normal: 18, difficile: 22 },
  // Soldats au départ
  ROHAN_TROOPS: { facile: 1000, normal: 900, difficile: 800 },
  ISENGARD_TROOPS: { facile: 1200, normal: 1500, difficile: 2000 },
  // ⚔️ Les vagues d'Isengard : la première après WAVE_FIRST secondes, puis toutes les WAVE_EVERY secondes ;
  // WAVE_ARMY soldats pour la première, et WAVE_GROWTH de plus à chaque vague (0.12 = +12 %)
  WAVE_FIRST: 35,
  WAVE_EVERY: 70,
  WAVE_ARMY: { facile: 500, normal: 700, difficile: 950 },
  WAVE_GROWTH: 0.12,
  // Les moments de la nuit (en part de la nuit : 0.3 = au bout de 30 % de la nuit)
  DUNLAND_AT: 0.25,  // 🪓 les Dunlendings, hommes sauvages du Pays de Dun, rejoignent l'assaut
  DUNLAND_ARMY: { facile: 600, normal: 900, difficile: 1200 },
  WARGS_AT: 0.45,    // 🐺 les chevaucheurs de wargs : une vague surprise, plus grosse
  WARGS_ARMY: { facile: 700, normal: 1000, difficile: 1400 },
  CULVERT_AT: 0.55,  // 🕳️ des orques se glissent par le ponceau, sous le Mur du Gouffre, et surgissent derrière lui
  CULVERT_ARMY: { facile: 300, normal: 450, difficile: 600 },
  FIRE_AT: [0.4, 0.75], // 💥 le feu de Saroumane fait sauter une muraille (deux fois dans la nuit)
  FIRE_SIEGE: 3,     // (le siège en cours finit alors dans FIRE_SIEGE secondes)
  BREACH_SIEGE: 0.35, // (une muraille éventrée ne tient plus qu'une partie de son siège)
  SIEGE_FACTOR: 1.6, // les sièges durent plus longtemps qu'ailleurs : on a le temps d'envoyer des défenseurs
  // 🏆 Les succès qui font venir des renforts
  ELVES_DIKE: { facile: 120, normal: 180, difficile: 240 }, // 🏹 tenir la Digue de Helm si longtemps (en secondes)…
  ELVES_TROOPS: 500,      // … fait venir Haldir et les archers de la Lórien
  ELVES_TOWERS: 1.5,      // (et les tours tirent 50 % plus fort)
  DWARVES_KILLS: { facile: 2500, normal: 4200, difficile: 6000 }, // ⚒️ le concours de Gimli et Legolas (42 !)…
  DWARVES_TROOPS: 300,    // … fait venir les nains d'Aglarond
  DWARVES_GARRISON: 1.5,  // (garnisons 50 % plus grandes, et chaque tour gagne un niveau)
  TOWER_HORN: 5,          // une tour de ce niveau (la Grande tour du Cor) permet de sonner le Cor une 2e fois
  // 📯 Le Cor de Helm : pendant HORN_TIME secondes, les soldats du Rohan sont HORN_POWER fois plus forts ;
  // les assaillants perdent tout de suite HORN_FLEE de leurs soldats (ils fuient)
  HORN_TIME: 30,
  HORN_POWER: 1.5,
  HORN_FLEE: 0.25,
  // 🌅 L'aube : Erkenbrand et Gandalf arrivent avec ERKENBRAND soldats ; la forêt des Huorns engloutit, chaque
  // seconde, HUORNS des soldats d'Isengard ; la victoire est annoncée DAWN_VICTORY secondes plus tard
  ERKENBRAND: 1000,
  HUORNS: 0.06,
  DAWN_VICTORY: 30,
  // 🗼 Tours de garde que le joueur peut bâtir en plus de celles qui sont déjà là
  TOWERS_TO_BUILD: 3,
  // Les terres de départ (en cases) : le Rohan à partir de ROHAN_FROM (juste devant la Digue) ; les Dunlendings, la
  // moitié sud de la Combe à partir de DUNLAND_FROM ; Isengard, tout le reste (l'Ouestfolde et le nord de la Combe)
  ROHAN_FROM: 156,
  DUNLAND_FROM: 96,
  // Les villes (lieux de helmmap.js) : [lieu, niveau, nom]
  ROHAN_CITIES: [['hornburg', 4, tr('Fort-le-Cor', 'the Hornburg')], ['dike', 2, tr('la Digue de Helm', 'Helm\'s Dike')],
    ['wall', 3, tr('le Mur du Gouffre', 'the Deeping Wall')], ['caves', 2, tr('les Cavernes Scintillantes', 'the Glittering Caves')]],
  // Les tours de garde déjà bâties : [x, y, niveau] (au milieu du pré vert, sur Fort-le-Cor, au fond du Gouffre)
  ROHAN_TOWERS: [[184, 108, 2], [199, 80, 3], [258, 98, 1]],
  factions: [
    { id: 'rohan', name: tr('Rohan', 'Rohan'), leader: tr('le roi Théoden', 'King Théoden'), flag: 'b08', color: [46, 120, 52], playable: true,
      desc: tr('Les Rohirrim se sont retranchés au Gouffre de Helm. Tiens jusqu\'à l\'aube !', 'The Rohirrim have taken refuge in Helm\'s Deep. Hold until dawn!') },
    { id: 'isengard', name: tr('Isengard', 'Isengard'), leader: tr('Saroumane le Blanc', 'Saruman the White'), flag: 'b17', color: [34, 34, 38],
      desc: tr('L\'armée de la Main Blanche : dix mille Uruk-hai et orques.', 'The army of the White Hand: ten thousand Uruk-hai and orcs.') },
    { id: 'dunland', name: tr('Pays de Dun', 'Dunland'), leader: tr('les chefs des hommes sauvages', 'the chieftains of the wild men'), flag: 'b14', color: [150, 96, 40],
      desc: tr('Les hommes sauvages des collines, alliés de Saroumane.', 'The wild hillmen, Saruman\'s allies.') },
  ],
};

// Les bannières des factions (en attendant de vraies bannières : un des drapeaux du jeu, avec sa couleur)
for (const f of HELM.factions) {
  BANNERS.push({ id: f.id, name: f.name, kingdom: f.name, set: 'helm', color: f.color,
    img: `img/bannieres/${f.flag}.webp`, icon: `img/bannieres/${f.flag}s.webp`, logo: `img/bannieres/${f.flag}m.webp` });
}
