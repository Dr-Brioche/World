// 🐉 CARTE « AZEROTH »
// Le monde d'Azeroth (World of Warcraft) tel qu'il était à l'époque du Norfendre (Wrath of the Lich King), en
// 700 x 550 cases : Kalimdor à l'ouest, les Royaumes de l'Est à l'est, le Norfendre au nord, et la Grande Mer
// (avec le Maelström) au milieu. Dessiné de mémoire : c'est une carte de fan, aux formes approchées.
// Mêmes outils que les cartes « Monde » et « Europe » (voir worldmap.js), mais les points sont donnés en
// [x, y] de 0 à 100 (x vers la droite, y vers le bas), au lieu de longitudes et de latitudes.

const AZEROTH_PROJ = { lon0: 0, lonSpan: 100, latTop: 0, latBottom: 100, wrap: false };

// Le Norfendre est dessiné plus grand, puis resserré au milieu de la carte, au-dessus de la Grande Mer (entre
// le nord-est de Kalimdor et le nord-ouest des Royaumes de l'Est)
const nr = pts => pts.map(([x, y]) => [42 + (x - 31.6) * 0.564, y * 0.85]);

// --- Terres ---
const AZEROTH_LANDS = [
  // Kalimdor, de la Sombrivage (nord-ouest) vers l'est, puis le long de la côte est jusqu'à Tanaris, et retour par la
  // côte ouest (Silithus, Féralas, Désolace, les Serres-Rocheuses)
  [// le Berceau-de-l'Hiver (la côte nord)
   [13.5, 13.5], [15, 11.5], [16.5, 10.2], [18, 9.6], [19.2, 8.4], [21, 7.6], [23, 7.2], [25, 7.4], [26.8, 8.2],
   [28.2, 9.6], [29.4, 11.2], [30.2, 13.2], [30.6, 15.4], [31.4, 17.4],
   // Azshara, et la baie des Tempêtes dans son croissant
   [32.6, 19.2], [34, 20.4], [35.6, 21.2], [37.2, 22.4], [38.4, 24], [38.8, 25.8], [38, 27], [36.6, 27.2], [35.6, 28.2],
   [35.8, 29.6], [37, 30.4], [38.6, 30.6], [39.6, 31.8], [39.2, 33.4], [37.6, 34.2], [35.8, 34.4],
   // Durotar
   [34.4, 35.6], [33.8, 37.6], [34.2, 39.6], [33.6, 41.6], [34, 43.6], [33.4, 45.6], [33.8, 47.4], [33.2, 49.2],
   // la côte des Tarides (Cabestan), puis le marécage d'Âprefange, qui s'avance dans la mer
   [32.6, 50.6], [32.2, 52.4], [33.2, 53.4], [34.8, 53.8], [36.2, 55], [36.8, 56.8], [36.2, 58.6], [34.8, 59.6], [33.2, 60.2],
   // le Bassin des éclats (les Mille-Pointes), puis Tanaris
   [32.6, 62], [33.2, 64], [33, 66], [33.8, 68], [34.8, 70.4], [35.4, 73], [35.2, 76], [34.4, 79], [33.2, 81.6],
   [31.6, 84], [29.6, 86.4], [27.6, 88.6], [25.4, 90.2], [23, 91],
   // la côte sud de Silithus, puis Féralas et Désolace en remontant la côte ouest
   [20.6, 91.4], [18.2, 91], [15.8, 90.2], [13.6, 88.6], [12, 86.4], [10.8, 84], [10, 81], [9, 78], [8, 75], [7.4, 72],
   [7.6, 69], [6.8, 66.4], [6.2, 63.4], [6.8, 60.4], [6, 57.4], [5.6, 54.4], [6.2, 51.4], [5.8, 48.4], [6.4, 45.6], [7.2, 43],
   // les Serres-Rocheuses, puis la Sombrivage, une longue côte vers le nord
   [8, 40.4], [8.6, 37.8], [9.6, 35.6], [10.2, 33], [10.6, 30.2], [10.4, 27.4], [11, 24.6], [11.6, 21.6], [11.8, 18.6], [12.6, 16]],
  [[7.6, 9.2], [9.6, 8.4], [11.2, 9.6], [11.6, 12], [10.8, 14.6], [9, 15.6], [7.4, 14.6], [6.8, 12]],            // Teldrassil
  [[3.6, 17.2], [5.4, 16.4], [6.6, 18], [6.2, 20.6], [4.4, 21.4], [3.4, 19.6]],                                // île de Brume-sang
  [[3.8, 22.8], [5.8, 22], [7, 24.2], [6.6, 27.2], [4.6, 28], [3.4, 25.8]],                                    // île de Brume-azur
  [[35, 46.2], [36.2, 45.8], [36.6, 47.2], [35.4, 47.8]],                                                      // îles de l'Écho
  [[37.4, 57.2], [38.6, 56.8], [39, 58.4], [37.8, 58.8]],                                                      // île de Theramore

  // Le Norfendre : la toundra Boréenne (sud-ouest), le bassin de Sholazar, la Couronne de glace, les pics Foudroyés
  // (nord), les Grisonnes et le fjord Hurlant (sud-est), la Désolation des dragons (au sud)
  nr([[32, 20], [31.6, 17.4], [32.6, 15], [33, 12.6], [34.2, 10.4], [36, 8.8], [38.6, 7], [41.2, 5.4], [44.2, 4],
   [47.6, 3], [51, 2.6], [54.6, 2.4], [58.2, 2.8], [61.6, 3.8], [64.4, 5.4], [66.6, 7.4], [68.2, 9.8], [69.4, 12.4],
   [70, 15.2], [70.4, 18.2], [70, 21], [70.6, 23.6], [70.2, 26.2], [68.8, 28.2], [66.8, 29.4], [64.6, 29.2], [62.8, 28],
   [61.4, 26.4], [59.6, 26], [57.6, 25.4], [55.4, 25.8], [53.2, 25.2], [51, 24.6], [48.6, 24.8], [46.4, 25.6], [44.6, 26.8],
   [42.4, 27.8], [40.6, 29.2], [38.4, 30], [36.2, 29.6], [34.4, 28.4], [33.2, 26.4], [32.4, 24], [31.8, 22]]),

  // Les Royaumes de l'Est, de Tirisfal (nord-ouest) vers Quel'Thalas, puis le long de la côte est jusqu'au cap de
  // Strangleronce, et retour par la côte ouest (Marche de l'Ouest, Paluns, Gilnéas, Pins-Argentés)
  [// Tirisfal, puis Quel'Thalas (la forêt des Chants éternels)
   [66.4, 22.6], [67.6, 21], [69.4, 20], [71.4, 19.6], [73.4, 18.8], [75.6, 17.4], [77.6, 15.6], [79.6, 14.2], [81.8, 13.4],
   [84.2, 13.2], [86.4, 13.8], [88.2, 15.4], [89.2, 17.6], [89.6, 20],
   // les terres Fantômes, les Maleterres de l'Est, les Hinterlands et l'Arathi (la côte est)
   [90.4, 22.4], [90, 24.8], [90.8, 27.2], [91.2, 29.8], [90.6, 32.4], [91.6, 34.8], [91.2, 37.6], [90, 40], [88.4, 42],
   [87.2, 43.8], [85.6, 45], [84, 45.4],
   // (le bras de mer de l'est, sous le pont de Thandol)
   [82.4, 46], [81.6, 47.4], [82.8, 48.6],
   // les terres au-delà du Loch Modan, les Terres ingrates, les Carmines, le marais des Chagrins, les Terres foudroyées
   [84.4, 49.6], [86.2, 50.8], [87.6, 52.8], [88, 55.4], [87.6, 58.2], [87.8, 61], [88.6, 63.6], [89, 66.4], [89.6, 69.2],
   [89.2, 72], [88.4, 74.8], [87.6, 77.6], [86, 80], [84, 81.4], [81.8, 81.8],
   // Strangleronce, une longue presqu'île jusqu'au Cap
   [80.4, 83.6], [79.6, 86.2], [78.4, 88.6], [76.6, 91], [74.6, 93], [72.6, 94.6], [71, 95.4], [69.6, 94.6], [69.2, 92.6],
   [68.4, 90.4], [67.4, 88], [66.8, 85.4], [66.2, 82.6], [66.6, 79.6], [65.8, 77],
   // la Marche de l'Ouest, le port de Hurlevent, Dun Morogh, puis les Paluns (Menethil)
   [65.4, 74.2], [64.8, 71.4], [65.4, 68.6], [66.4, 66.6], [66, 64.8], [67.2, 62.6], [67.8, 60.2], [68.2, 57.8], [69.2, 55.6],
   [70.4, 53.4], [71.6, 51.4], [73, 49.8], [74.8, 48.6],
   // la baie de Baradin, qui s'enfonce jusqu'au pont de Thandol (il ne reste qu'un isthme étroit)
   [77.2, 47.8], [79.4, 47.4], [80.4, 46.6], [79.8, 45.6], [77.6, 45.2], [75.4, 44.8], [73.2, 44.2], [71.4, 43.2],
   // les contreforts de Hautebrande, puis la péninsule de Gilnéas
   [69.8, 42.4], [68.4, 42.6], [67, 43.4], [65.4, 44], [63.8, 43.6], [62.4, 42.4], [61.6, 40.6], [61.8, 38.6], [62.8, 36.8],
   [64.4, 35.8], [65.6, 34.4],
   // la forêt des Pins-Argentés
   [66.2, 32.4], [65.8, 30], [66.4, 27.6], [66, 25.2]],
  [[82.4, 8.8], [84.6, 8.4], [86, 9.8], [84.8, 11.4], [82.8, 11.2]],                                           // île de Quel'Danas
];

// --- Lacs ---
const AZEROTH_LAKES = [
  [[68.8, 33.4], [71, 32.8], [72.6, 34.4], [72.2, 36.8], [70.2, 37.6], [68.8, 36]],                            // lac Lordamere
  [[75, 30.2], [76.6, 29.8], [77.2, 31.4], [75.8, 32.2]],                                                      // lac Darrowmere
  [[79.6, 51.6], [81.6, 51.2], [82.2, 52.8], [80.6, 53.8], [79.4, 53]],                                        // Loch Modan
  [[82.2, 64.2], [84, 63.8], [84.6, 65.4], [82.8, 66]],                                                        // lac Placide (les Carmines)
  [[21.8, 12.8], [23.2, 12.4], [23.8, 13.8], [22.4, 14.4]],                                                    // lac d'Elune'ara (Reflet-de-Lune)
  [[23.8, 25.6], [25.4, 25.2], [25.8, 26.8], [24.2, 27.2]],                                                    // lac Mystral (Orneval)
  nr([[44.4, 16.4], [46.2, 16], [46.6, 17.6], [44.8, 18.2]]),                                                      // lac Joug-d'hiver
  nr([[64.6, 22.6], [65.8, 22.2], [66.6, 26.4], [65.4, 27]]),                                                      // le fjord Hurlant
];

// --- Déserts ---
const AZEROTH_DESERTS = [
  [[30.6, 35.6], [33.6, 35.8], [33.4, 44], [32.8, 50], [30.4, 50.2], [30.2, 42]],                              // Durotar
  [[21.4, 40], [29.4, 39.6], [29.8, 50], [28.6, 58.4], [22.6, 58.2], [21, 49]],                                // le sud des Tarides
  [[6.6, 43.6], [13, 43.2], [13.8, 49.6], [12.8, 56.2], [6.6, 56.6]],                                          // Désolace
  [[22.4, 61.4], [32.4, 61], [33, 67.6], [24, 68.4]],                                                          // les Mille-Pointes et le Bassin des éclats
  [[24.4, 69.4], [33.8, 69.2], [35, 75], [33.4, 81.4], [28.6, 87.6], [24.4, 88.2]],                            // Tanaris
  [[10.2, 79.6], [18.6, 79], [19.6, 85.4], [17.4, 90.8], [12.2, 88.2]],                                        // Silithus
  [[77.6, 56.2], [86.4, 56], [86.8, 61.4], [78.2, 61.6]],                                                      // les Terres ingrates
  [[80.8, 74.6], [88, 74.4], [87.2, 79.6], [84, 81.2], [80.4, 79.4]],                                          // les Terres foudroyées
];

// --- Glaciers (infranchissables) ---
const AZEROTH_GLACIERS = [
  nr([[39.6, 7.8], [43.2, 6], [47, 5.4], [49.4, 7], [49, 10.2], [46.4, 11.8], [43, 11.6], [40.4, 10.2]]),           // la Couronne de glace
];

// --- Montagnes : [largeur en cases, sommets infranchissables ?, crête] ---
const AZEROTH_MOUNTAINS = [
  // Kalimdor
  [16, true, [[24.6, 15.6], [26.2, 17.8], [28, 20.2], [29, 22.6]]],                                           // mont Hyjal
  [11, false, [[18.2, 10.4], [21.4, 9.8], [25, 10.2], [28.2, 12]]],                                           // Berceau-de-l'Hiver
  [9, false, [[32.6, 22.2], [35.2, 23.8], [37.4, 24.6]]],                                                     // Azshara
  [9, false, [[13.2, 16.4], [14, 20.4], [14.4, 24.6]]],                                                       // collines de la Sombrivage
  [15, true, [[12.4, 28.4], [13.6, 32.4], [15, 36.6], [15.8, 41]]],                                           // les Serres-Rocheuses
  [9, false, [[16.4, 44.4], [15.6, 48.6], [16.8, 52.6], [20.4, 54.6]]],                                       // falaises de Mulgore
  [13, true, [[18.4, 57.4], [19.6, 62], [20.2, 66.6], [19.4, 71.4]]],                                         // monts de Féralas
  [10, false, [[23.4, 62.4], [26.6, 64], [29.8, 63.4]]],                                                      // les mesas des Mille-Pointes
  [8, true, [[17.4, 75.4], [19.4, 74], [22.2, 74.2], [24, 76.6], [23.4, 79.6], [21, 81], [18.4, 80], [17.4, 77.6]]], // cratère d'Un'Goro
  [6, false, [[20.4, 77.2], [21.2, 78.2]]],                                                                   // la Corniche du Feu (au milieu du cratère)
  [9, false, [[12.4, 81.6], [15.4, 82.6], [18, 82.2]]],                                                       // monts de Silithus
  [7, false, [[33, 55.6], [34.8, 57.6]]],                                                                     // collines d'Âprefange
  // Le Norfendre
  [18, true, nr([[52.4, 4.4], [56.2, 5.4], [60.2, 6.2], [63.6, 8.2], [65.6, 11.2]])],                             // les pics Foudroyés
  [11, false, nr([[54.6, 12.4], [57.6, 14.2], [60.8, 14.8]])],                                                    // Zul'Drak
  [9, true, nr([[33.4, 11.6], [35.6, 10.2], [37.8, 11.4], [38.2, 14.6], [35.8, 16], [33.6, 14.6]])],              // le bassin de Sholazar (ses falaises)
  [9, false, nr([[58.6, 18.6], [62, 19.4], [65.6, 20.6]])],                                                       // les Grisonnes
  [8, false, nr([[62.6, 25], [65, 27.4], [68.2, 27.6]])],                                                         // les falaises du fjord Hurlant
  [8, false, nr([[49.6, 19.6], [51.6, 21]])],                                                                     // le temple du Repos du ver (Désolation des dragons)
  // Les Royaumes de l'Est
  [13, true, [[70.4, 37.4], [73, 38], [75.6, 39]]],                                                           // monts d'Alterac
  [10, false, [[83.6, 32.4], [86.6, 34.4], [88.8, 37.6]]],                                                    // les Hinterlands
  [9, false, [[77.6, 40.4], [80.6, 42], [83.6, 42]]],                                                         // hautes-terres d'Arathi
  [16, true, [[68.8, 55], [72.2, 54.2], [75.6, 54.2], [78.8, 54.8]]],                                         // Dun Morogh et Khaz Modan
  [11, false, [[75.4, 57.8], [78.4, 58.6], [81.8, 58.4]]],                                                    // la gorge des Vents brûlants
  [10, true, [[76.2, 60.4], [77.2, 61.6]]],                                                                   // le mont Rochenoire
  [10, false, [[79.2, 63], [81.8, 63.4], [85.4, 66.4]]],                                                      // les Carmines
  [11, true, [[77.2, 70.4], [78.4, 72.8], [78.8, 75.4]]],                                                     // le défilé de Deuillevent
  [9, false, [[68.8, 78.6], [70.2, 82.6], [70.8, 87]]],                                                       // les monts de Strangleronce
  [8, false, [[84.6, 19.2], [87.4, 21.4]]],                                                                   // Quel'Thalas
];

// --- Fleuves : [cours, n° du point où il devient un grand fleuve infranchissable (-1 = jamais)] ---
const AZEROTH_RIVERS = [
  [[[26.6, 27.8], [28.4, 31.8], [29.6, 36], [30, 41], [30.2, 46], [31.2, 49.6], [32.6, 51]], 4],             // la Fureur-du-Sud
  [[[19, 28], [16, 29.6], [12.6, 29.8], [10.6, 30.2]], -1],                                                   // rivière de l'Orneval
  [[[14.4, 62.4], [11.4, 64.2], [7.2, 65]], -1],                                                              // Féralas
  [[[70.6, 37.8], [70, 40.4], [69.6, 42.4]], -1],                                                             // l'émissaire du lac Lordamere
  [[[77.6, 26.4], [79.2, 31], [80.8, 35.6], [82.6, 40.4], [84.4, 45.2]], -1],                                 // le Thondroril
  [[[79.4, 63.8], [75.8, 65.2], [71.8, 66.6], [68.4, 68.2], [65.2, 69.4]], -1],                               // Elwynn et Marche-de-l'Ouest
  [[[71.4, 80.4], [68.8, 84], [66.8, 85.6]], -1],                                                             // Strangleronce
  [[[84.4, 16.4], [86.4, 20.6], [88.4, 24.4], [90.6, 27]], -1],                                               // Quel'Thalas
  [nr([[56.4, 15.6], [56.8, 20], [56.8, 25.4]]), -1],                                                             // Zul'Drak
  [nr([[38.6, 20.6], [37.6, 24.6], [36.2, 29.2]]), -1],                                                           // la toundra Boréenne
];

// La carte « Azeroth » : 700 x 550 cases
function generateAzerothMap(seed) {
  return buildGeoMap(seed, CONFIG.AZEROTH_MAP_WIDTH, CONFIG.AZEROTH_MAP_HEIGHT, {
    proj: AZEROTH_PROJ, lands: AZEROTH_LANDS, lakes: AZEROTH_LAKES, deserts: AZEROTH_DESERTS, glaciers: AZEROTH_GLACIERS,
    mountains: AZEROTH_MOUNTAINS, rivers: AZEROTH_RIVERS, detail: 0.8, coastAmp: 3, widthScale: 1, meander: 2,
    forestLevel: azerothForest,
  });
}

// Forêts d'Azeroth : [x0, y0, x1, y1, seuil] (en pourcentage de la carte ; plus bas = plus de forêt, Infinity = aucune).
// Le premier rectangle qui contient la case l'emporte.
const AZEROTH_FORESTS = [
  [6, 7, 12.5, 17, 0.36],    // Teldrassil
  [10, 13, 15, 33, 0.4],     // Sombrivage
  [15, 24, 31, 34, 0.38],    // Orneval
  [16, 14, 24, 24, 0.42],    // Gangrebois
  [6, 57, 18, 73, 0.4],      // Féralas
  [31, 52, 38, 61, 0.45],    // marécage d'Âprefange
  [17, 6, 32, 15, Infinity], // Berceau-de-l'Hiver (neige)
  [20, 33, 30, 60, 0.64],    // les Tarides (la savane)
  [55.8, 12.7, 63.7, 19.6, 0.4], // les Grisonnes
  [58, 18.7, 64.6, 25.5, 0.48], // le fjord Hurlant
  [40, 0, 66, 27, 0.75],     // le reste du Norfendre (toundra et neige)
  [75, 12, 92, 27, 0.4],     // Quel'Thalas
  [61, 22, 69.5, 45, 0.4],   // les Pins-Argentés et Gilnéas
  [82, 30, 92, 40, 0.42],    // les Hinterlands
  [66, 61, 77, 68, 0.4],     // la forêt d'Elwynn
  [66, 68, 79, 74, 0.38],    // le bois de la Pénombre
  [64, 66, 67, 75, 0.66],    // la Marche de l'Ouest (des champs)
  [64, 74, 82, 96, 0.34],    // Strangleronce (la jungle)
];
function azerothForest(y, x) {
  const f = AZEROTH_FORESTS.find(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  return f ? f[4] : 0.55;
}
