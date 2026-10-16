// ✏️ CARTES DESSINÉES
// Les cartes dessinées avec l'éditeur (editeur.html). Quand on enregistre une carte dans l'éditeur, elle est
// gardée dans le navigateur (localStorage) et apparaît tout de suite dans la liste des cartes du menu du jeu.
// Pour qu'une carte soit dans le jeu pour TOUT LE MONDE, on l'exporte (bouton « Exporter ») et on colle le
// contenu du fichier dans la liste CUSTOM_MAPS ci-dessous.

// Cartes dessinées ajoutées au jeu pour tout le monde : { name, W, H, data } (data : voir CustomMaps.encode)
const CUSTOM_MAPS = [
];

const CustomMaps = {
  KEY: 'medievalEmperor.cartes', // (nom de la boîte où le navigateur garde les cartes enregistrées)

  // Une carte prend peu de place : on écrit chaque suite de cases du même terrain en un petit morceau de
  // texte : le numéro du terrain, puis combien il y en a (en base 36), puis une virgule. Ex. : « 0k8,1z, »
  encode(terrain) {
    const out = [];
    for (let i = 0; i < terrain.length;) {
      let n = 1;
      while (i + n < terrain.length && terrain[i + n] === terrain[i]) n++;
      out.push(terrain[i] + n.toString(36));
      i += n;
    }
    return out.join(',');
  },
  decode(data, N) {
    const terrain = new Uint8Array(N);
    let i = 0;
    for (const run of data.split(',')) {
      if (!run) continue;
      const t = +run[0], n = parseInt(run.slice(1), 36);
      terrain.fill(t, i, Math.min(N, i + n));
      i += n;
    }
    return terrain;
  },

  // Les cartes enregistrées dans ce navigateur (une liste vide si le navigateur ne les garde pas)
  saved() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; }
  },
  // Enregistre (ou remplace, si le nom existe déjà) une carte. Renvoie un message d'erreur, ou null.
  save(map) {
    const list = this.saved().filter(m => m.name !== map.name);
    list.push(map);
    try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) {
      return 'Impossible d\'enregistrer : le navigateur n\'a plus de place (supprime une ancienne carte, ou exporte-la).';
    }
    return null;
  },
  remove(name) {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.saved().filter(m => m.name !== name))); } catch (e) { /* rien */ }
  },

  // Toutes les cartes dessinées : celles du jeu (CUSTOM_MAPS), puis celles de ce navigateur
  all() {
    const mine = this.saved().filter(m => !CUSTOM_MAPS.some(c => c.name === m.name));
    return CUSTOM_MAPS.map(m => ({ ...m, builtIn: true })).concat(mine);
  },
  find(name) { return this.all().find(m => m.name === name) || null; },

  // La carte prête pour le jeu : { W, H, N, terrain, shade } (comme generateMap)
  toGameMap(m, seed) {
    const N = m.W * m.H, terrain = this.decode(m.data, N), rand = mulberry32(seed);
    const shade = new Int8Array(N);
    for (let i = 0; i < N; i++) shade[i] = Math.round((rand() - 0.5) * 12); // petites variations de couleur
    return { W: m.W, H: m.H, N, terrain, shade };
  },
};
