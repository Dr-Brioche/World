// 🐉 CARTE « AZEROTH »
// Le monde d'Azeroth (World of Warcraft), dessiné de mémoire en 600 x 600 cases : Kalimdor à l'ouest, les Royaumes
// de l'Est à l'est, le Norfendre au nord, la Pandarie au sud, et au milieu de la Grande Mer les Îles Brisées,
// Kul Tiras et Zandalar ; les Îles aux Dragons au nord-est. (Carte de fan : les formes sont approximatives.)
// Mêmes outils que les cartes « Monde » et « Europe » (voir worldmap.js), mais les points sont donnés en
// [x, y] de 0 à 100 (x vers la droite, y vers le bas), au lieu de longitudes et de latitudes.

const AZEROTH_PROJ = { lon0: 0, lonSpan: 100, latTop: 0, latBottom: 100, wrap: false };

// --- Terres ---
const AZEROTH_LANDS = [
  // Kalimdor : de la Sombrivage (nord-ouest) vers le Berceau-de-l'Hiver, Azshara, Durotar, le marécage d'Âprefange,
  // Tanaris et Uldum au sud, puis Silithus, Féralas et Désolace en remontant la côte ouest
  [[31, 11], [33, 14], [34.4, 17.6], [36.6, 20.4], [39, 21.8], [41.6, 23], [43, 25.2], [42, 27.2],
   // (la baie des Tempêtes, dans le croissant d'Azshara)
   [40, 27.4], [38.4, 28.2], [38.2, 29.8], [40, 30.8], [42.2, 31.2], [42.6, 32.8], [41, 34.2], [38.6, 34.6],
   // Durotar et les îles de l'Écho
   [36.4, 35.6], [35.6, 37.6], [36, 39.4], [35.2, 42.4], [35.6, 45.4], [34.8, 48.4], [33.6, 50.2],
   // la baie d'Âprefange, puis la péninsule du marécage
   [32.4, 52], [33.2, 54.4], [35.6, 54.2], [38.2, 55], [39.4, 57.4], [38.8, 60], [36.6, 61.4], [34.4, 61.8],
   // Tanaris, qui s'avance au sud-est
   [33.4, 64], [34.6, 67], [36.6, 69.6], [37.6, 73], [37, 76.6], [35.2, 79.6], [32.8, 81.4],
   // Uldum, puis Silithus
   [31.4, 84], [30.2, 87.6], [28, 90], [24.6, 91.4], [21.2, 90.8], [18.4, 89], [15.6, 87.6], [13.2, 85.4], [11.6, 82.2],
   // Féralas, Désolace, les Serres-Rocheuses et la Sombrivage, en remontant la côte ouest
   [10.2, 78.4], [9, 74.6], [8.4, 70.4], [8.8, 66.4], [7.6, 62.6], [6.6, 58.4], [7.4, 54.2], [6.4, 50.2], [7, 46],
   [8.2, 42.2], [7.8, 38.4], [9.2, 35], [8.6, 31.6], [10, 28.6], [10.8, 25], [10.2, 21.2], [11.2, 17.6], [13, 14.6],
   // le Berceau-de-l'Hiver, au nord
   [15.6, 12.2], [18.4, 10.4], [21.6, 9.2], [25, 8.6], [28.4, 9.4]],
  [[4.4, 63.8], [6, 63.4], [6.6, 65.6], [5, 66.4]],                                                            // l'île de Pennelune
  [[6.2, 9.4], [8.6, 8.2], [10.6, 9.6], [11, 12.6], [10, 15.6], [7.8, 16.6], [5.8, 14.8], [5.4, 11.8]],          // Teldrassil
  [[3, 16.4], [5, 15.8], [6, 17.6], [5.6, 20.2], [3.8, 20.8], [2.8, 18.8]],                                    // île de Brume-sang
  [[3.4, 22.2], [5.6, 21.6], [6.8, 23.8], [6.4, 26.8], [4.4, 27.6], [3.2, 25.4]],                              // île de Brume-azur
  [[35.6, 46.4], [37, 46], [37.4, 47.6], [36, 48.2]],                                                          // îles de l'Écho
  [[37.8, 56.4], [39.2, 56], [39.6, 57.8], [38.2, 58.4]],                                                      // île de Theramore

  // Le Norfendre : la toundra Boréenne (sud-ouest), la Désolation des dragons, les Grisonnes et le fjord Hurlant
  // (sud-est), les pics Foudroyés et la Couronne de glace au nord
  [[41, 19.6], [40.2, 15.6], [41.2, 11.4], [42.8, 7.4], [45.4, 4.2], [50, 2.6], [56, 2.2], [62.6, 3], [67.6, 5.2],
   [70.4, 8.6], [71.6, 12.4], [71.2, 16.4], [69.4, 19.4], [66.8, 20], [64.4, 18.6], [62.2, 17.2], [59.6, 16.4],
   [56.4, 17.2], [53, 16.6], [50, 17.6], [47.4, 19.2], [45, 20.8], [42.6, 21.2]],

  // Les Royaumes de l'Est : Quel'Thalas au nord, les Maleterres, Lordaeron (Tirisfal, les Pins-Argentés, Gilnéas),
  // l'Arathi et les Hinterlands, les Paluns, Khaz Modan, Hurlevent, Strangleronce au sud
  [[64.4, 28.2], [66.4, 26.2], [69.6, 24.6], [73.4, 23.6], [76.6, 21.8], [79.6, 19.2],
   // Quel'Thalas, les Hinterlands et l'Arathi, sur la côte est
   [82.6, 17.4], [86, 16.8], [89.6, 17.8], [92.2, 20.2], [93.4, 23.6], [92.6, 27], [93.4, 30.4], [92.8, 33.6],
   [91.4, 37], [89.6, 40], [88.6, 42.4], [86.2, 44.4], [83.4, 45.6],
   // (le bras de mer de l'est, qui monte vers le pont de Thandol)
   [82.2, 46.4], [82.6, 47.6],
   // Khaz Modan, le marais des Chagrins, les Terres foudroyées
   [84.6, 48.4], [86.8, 50.2], [87.6, 53.6], [87.2, 57.4], [86.4, 61.6], [87, 64.6], [88.6, 67.6], [89.4, 71],
   [88.6, 75], [86.8, 79], [84.2, 81.6], [81.2, 82.2],
   // Strangleronce, une longue presqu'île jusqu'au Cap
   [78.6, 83.6], [77, 86.8], [75.2, 89.6], [72.4, 92.4], [69.6, 94], [67.6, 93.4], [66.6, 91], [65.4, 88], [64.4, 84.4],
   [63.4, 80.6], [63.8, 77], [63, 74.4],
   // la Marche de l'Ouest, le port de Hurlevent, Dun Morogh et les Paluns (Menethil)
   [62.6, 71.4], [62, 68.4], [63, 65.4], [64.2, 63.6], [63.6, 61.6], [65, 58.8], [66.4, 55.6], [67.6, 52.6],
   [69.4, 50.6], [71.6, 49], [74.6, 48.2],
   // la baie de Baradin, qui s'enfonce jusqu'au pont de Thandol (il ne reste qu'un isthme étroit)
   [78.2, 47.6], [80.4, 47.2], [80.6, 46], [77.6, 45.4], [74.4, 45], [71.6, 44.4],
   // les contreforts de Hautebrande, puis la péninsule de Gilnéas
   [69.4, 43], [67.6, 42.6], [66, 43.4], [63.6, 43.6], [61, 43], [58.6, 41.6], [57.4, 39.2], [58, 36.8], [59.6, 35],
   [62, 34.4], [63.8, 33.6], [65, 31.6]],
  [[84.4, 11.4], [86.6, 10.8], [88, 12.2], [86.8, 13.8], [84.8, 13.6]],                                        // île de Quel'Danas
  [[64.2, 46], [66, 45.6], [66.6, 47.2], [65, 48.2], [63.8, 47.4]],                                            // Tol Barad

  // Les Îles Brisées : Azsuna, Val'sharah, Haut-Roc, Tornheim, Suramar et le Rivage Brisé
  [[46, 31.2], [49, 28.6], [52.6, 27.8], [55.8, 28.8], [58.2, 31.6], [58.6, 35], [56.6, 37.6], [54.6, 38.6],
   [53.8, 41.4], [52.2, 41.2], [51.4, 39.4], [48.4, 39.2], [45.8, 37.2], [44.8, 34.2]],
  // Kul Tiras : Drustvar à l'ouest, la vallée Chantorage au nord, la rade de Tiragarde et Boralus au sud-est
  [[52.4, 45.6], [55.4, 44], [58.6, 44.4], [60.8, 46.8], [61.2, 50.4], [59.8, 53.4], [57.6, 52.6], [57.8, 55.4],
   [55.4, 56.6], [52.4, 55.6], [50.4, 52.4], [50.6, 48.4]],
  // Zandalar : Vol'dun (désert, à l'ouest), Nazmir (marais, à l'est) et Zuldazar (au sud)
  [[40.6, 59.6], [44.4, 58.2], [48, 59.6], [49.4, 62.8], [48.6, 66.6], [45.6, 68.8], [41.8, 68.4], [39.6, 65.6], [39.4, 62.4]],
  [[42.6, 53.4], [44.8, 52.8], [45.6, 54.8], [44.2, 56.6], [42.4, 56]],                                        // les îles Perdues
  [[46.8, 49.2], [48.2, 48.6], [48.8, 50.2], [47.4, 51]],                                                      // Kezan

  // La Pandarie : le sommet de Kun-Lai au nord, la forêt de Jade à l'est, les étendues Sauvages de Krasarang au sud,
  // les steppes de Townlong et les Terres de l'Angoisse à l'ouest (derrière l'Échine du Serpent)
  [[46, 71.2], [51.6, 69.6], [57.2, 70.6], [60.8, 74], [62.4, 79], [61.4, 84.4], [58.6, 89.4], [53.4, 93],
   [47.4, 93], [43, 89.6], [41, 84], [41.2, 78], [43.2, 73.4]],

  // Les Îles aux Dragons, au nord-est
  [[78.6, 3.4], [82.4, 1.8], [87.4, 1.8], [91.6, 2.6], [94.8, 4.6], [94, 7.4], [90.4, 8.2], [86.4, 7], [82.2, 7.4], [79.2, 6.2]],
];

// --- Lacs (et bras de mer à l'intérieur des terres) ---
const AZEROTH_LAKES = [
  [[69.4, 33.4], [72, 32.6], [73.8, 34.4], [73, 37], [70.6, 37.6], [69, 35.6]],                                // lac Lordamere
  [[76.2, 29.8], [77.8, 29.4], [78.4, 31], [77, 32]],                                                          // lac Darrowmere
  [[80, 51.4], [82, 51], [82.8, 52.8], [81.2, 53.8], [79.8, 53]],                                              // Loch Modan
  [[23.6, 59], [27.2, 58.2], [30.4, 59.8], [30.6, 62.4], [27.4, 63.6], [24, 62.6]],                            // Mille-Pointes (noyées)
  [[22.4, 14.4], [23.8, 14], [24.4, 15.4], [23, 16]],                                                          // lac d'Elune'ara (Reflet-de-Lune)
  [[47.2, 10.4], [49.2, 10], [49.6, 11.8], [47.8, 12.4]],                                                      // lac Joug-d'hiver
  [[66.4, 16.6], [68, 16.2], [68.8, 18.8], [67.2, 19.4]],                                                      // le fjord Hurlant
  [[56.4, 51.2], [58, 50.6], [58.6, 52.2], [57.2, 52.6]],                                                      // la rade de Tiragarde
];

// --- Déserts ---
const AZEROTH_DESERTS = [
  [[30.4, 36], [34, 36.4], [34.4, 44], [33.6, 50], [30.8, 50.4], [30.6, 42]],                                  // Durotar
  [[21.6, 40], [29.4, 39.6], [29.8, 50], [28, 56.4], [22.4, 56], [21, 49]],                                    // les Tarides
  [[7, 44.4], [12.6, 44], [13.4, 50], [12.4, 56.4], [7, 56.6]],                                                // Désolace
  [[24.4, 66], [34, 65.6], [35.6, 72], [34, 79], [29, 82], [24.6, 79]],                                        // Tanaris
  [[10, 78.6], [18.6, 78], [19.4, 84], [16.4, 88], [11.4, 84.4]],                                              // Silithus
  [[19.6, 82.4], [30.6, 82.2], [28.4, 88.8], [24.4, 90.6], [19.4, 88.6]],                                      // Uldum
  [[77.6, 54.8], [86.6, 54.6], [86.6, 60.4], [78, 60.6]],                                                      // les Terres ingrates
  [[79.8, 74.4], [88.4, 74.2], [87.6, 79.6], [83.4, 81.6], [79.4, 79.2]],                                      // les Terres foudroyées
  [[39.8, 60.6], [43.4, 59.6], [43.6, 66.4], [40.4, 66.6]],                                                    // Vol'dun
  [[41.4, 83.6], [46, 83.2], [46.6, 90.4], [43, 89.6]],                                                        // les Terres de l'Angoisse
];

// --- Glaciers (infranchissables) ---
const AZEROTH_GLACIERS = [
  [[43.6, 4.6], [47.4, 3.4], [51.4, 4.4], [52, 7.4], [49.4, 9.2], [45.8, 8.8], [43.8, 7]],                     // la Couronne de glace
];

// --- Montagnes : [largeur en cases, sommets infranchissables ?, crête] ---
const AZEROTH_MOUNTAINS = [
  // Kalimdor
  [14, true, [[26, 17.4], [27.6, 19.4], [29.6, 21.6], [30.6, 24]]],                                           // mont Hyjal
  [10, false, [[19.6, 11.6], [23.6, 11], [27.6, 11.6], [30.6, 13.6]]],                                        // Berceau-de-l'Hiver
  [9, false, [[34.6, 23.4], [37.6, 25.4], [40.6, 25.4]]],                                                     // Azshara
  [13, true, [[12.6, 29.4], [14, 33.4], [15.4, 37.6], [16, 42]]],                                             // Serres-Rocheuses
  [8, false, [[16.6, 45.4], [15.6, 49.6], [17, 53.6], [20.6, 55.6]]],                                         // falaises de Mulgore
  [11, true, [[18.4, 57.4], [19.6, 62], [20.4, 66.6], [19.4, 71.2]]],                                         // monts de Féralas
  [7, true, [[18.6, 74.2], [20.4, 72.8], [23, 73], [24.6, 75.4], [24, 78.2], [21.6, 79.6], [19.2, 78.6], [18.4, 76.2]]], // cratère d'Un'Goro
  [6, false, [[21.4, 75.6], [22.2, 76.6]]],                                                                   // la Corniche du Feu (au milieu du cratère)
  [8, false, [[13, 80], [16, 81], [18.6, 80.6]]],                                                             // monts de Silithus
  [6, false, [[33.6, 54.6], [35.2, 57]]],                                                                     // collines d'Âprefange
  // Le Norfendre
  [16, true, [[55, 4.4], [58.6, 5.6], [62.4, 6.4], [65.8, 8.2], [67.6, 11]]],                                 // les pics Foudroyés
  [10, false, [[55.6, 10.6], [58.4, 12.4], [61.6, 13]]],                                                      // Zul'Drak
  [8, true, [[38.6, 9.6], [40.6, 8.4], [42.6, 9.6], [42.8, 12.6], [40.6, 13.8], [38.6, 12.6]]],              // le bassin de Sholazar (ses falaises)
  [8, false, [[63.4, 13], [66.4, 13.6], [69.4, 14.6]]],                                                       // les Grisonnes
  // Les Royaumes de l'Est
  [12, true, [[71.6, 37], [74.2, 37.6], [76.8, 38.6]]],                                                       // monts d'Alterac
  [9, false, [[84.6, 31.6], [87.6, 33.6], [89.6, 37]]],                                                       // les Hinterlands
  [8, false, [[78.6, 40], [81.6, 41.6], [84.6, 41.6]]],                                                       // hautes-terres d'Arathi
  [15, true, [[67.6, 53.6], [71, 52.6], [74.6, 52.4], [78, 52.8]]],                                           // Dun Morogh et Khaz Modan
  [10, false, [[75.6, 56.6], [78.6, 57.4], [82, 57.2]]],                                                      // la gorge des Vents brûlants
  [9, true, [[76.4, 59.2], [77.4, 60.4]]],                                                                    // le mont Rochenoire
  [10, false, [[79, 62.6], [82, 63.6], [84.6, 65.6]]],                                                        // les Carmines
  [10, true, [[76.6, 69.6], [77.8, 72], [78.2, 74.6]]],                                                       // le défilé de Deuillevent
  [8, false, [[67.6, 78], [69, 82], [69.6, 86.4]]],                                                           // les monts de Strangleronce
  [7, false, [[85, 21], [88, 23]]],                                                                           // Quel'Thalas
  // Les îles
  [10, true, [[52.6, 29.8], [55, 31], [56.6, 33.4]]],                                                         // Haut-Roc
  [7, false, [[48, 30.6], [50, 31.6]]],                                                                       // Tornheim
  [7, false, [[52.4, 34.6], [53.6, 36.2]]],                                                                   // Suramar
  [9, true, [[53.4, 47.4], [55.4, 49.4], [56.6, 52]]],                                                        // Kul Tiras
  [8, false, [[45.4, 61], [46.6, 64], [45.4, 66.6]]],                                                         // Zuldazar
  [16, true, [[45, 74], [49, 73.4], [53.6, 73.6], [57.6, 74.6]]],                                             // le sommet de Kun-Lai
  [8, true, [[45.6, 76.6], [45, 80.6], [45.6, 84.6], [46.6, 88]]],                                            // l'Échine du Serpent
  [9, true, [[83.4, 3.4], [87.4, 3.4], [91, 4.6]]],                                                           // les Îles aux Dragons
];

// --- Fleuves : [cours, n° du point où il devient un grand fleuve infranchissable (-1 = jamais)] ---
const AZEROTH_RIVERS = [
  [[[27, 28.4], [28.8, 32.4], [30, 36.6], [30.4, 41.6], [30.6, 46.6], [31.6, 50], [33.6, 51.6]], 4],          // la Fureur-du-Sud
  [[[19.4, 28.6], [16.4, 30.2], [12.6, 30.2], [9.4, 30.8]], -1],                                              // rivière de l'Orneval
  [[[24.6, 83.4], [25, 86.4], [25.6, 90.6]], -1],                                                             // le Vir'naal (Uldum)
  [[[14.6, 62.4], [11.6, 64], [8.2, 65]], -1],                                                                // Féralas
  [[[71.4, 37.6], [70.6, 40], [69.6, 42.2]], -1],                                                             // l'émissaire du lac Lordamere
  [[[78.8, 26.6], [80.4, 31.4], [82, 36], [84, 40.6], [85.6, 44.6]], -1],                                     // le Thondroril
  [[[79.4, 63.8], [76, 65.2], [72, 66.6], [67.6, 68.6], [63.2, 70]], -1],                                     // Elwynn et Marche-de-l'Ouest
  [[[71.4, 79.6], [68.6, 83.4], [64.4, 85]], -1],                                                             // Strangleronce
  [[[84.6, 18.4], [86.6, 21.6], [89, 24.6], [92.4, 27]], -1],                                                 // Quel'Thalas
  [[[56, 12.4], [56.6, 15.4], [56.6, 17.6]], -1],                                                             // Zul'Drak
  [[[50.4, 75.6], [53.6, 78.6], [57.6, 81.6], [61.6, 83.2]], -1],                                             // Pandarie
  [[[47.6, 59.6], [46.2, 62.2], [44, 65], [42.4, 68.4]], -1],                                                 // Zandalar
];

// La carte « Azeroth » : 600 x 600 cases
function generateAzerothMap(seed) {
  const S = CONFIG.AZEROTH_MAP_SIZE;
  return buildGeoMap(seed, S, S, {
    proj: AZEROTH_PROJ, lands: AZEROTH_LANDS, lakes: AZEROTH_LAKES, deserts: AZEROTH_DESERTS, glaciers: AZEROTH_GLACIERS,
    mountains: AZEROTH_MOUNTAINS, rivers: AZEROTH_RIVERS, detail: 1, coastAmp: 3, widthScale: 1, meander: 2,
    forestLevel: azerothForest,
  });
}

// Forêts d'Azeroth (y, x en pourcentage de la carte) : seuil de forêt (plus bas = plus de forêt, Infinity = aucune)
const AZEROTH_FORESTS = [
  // [x0, y0, x1, y1, seuil] : le premier rectangle qui contient la case l'emporte
  [5, 8, 11.5, 17, 0.36],    // Teldrassil
  [9, 14, 14, 31, 0.4],      // Sombrivage
  [14, 24, 31, 34, 0.38],    // Orneval
  [17, 15, 25, 24, 0.42],    // Gangrebois
  [7.5, 57, 18, 71, 0.4],    // Féralas
  [32, 52, 38, 62, 0.45],    // marécage d'Âprefange
  [18, 6, 33, 15, Infinity], // Berceau-de-l'Hiver (neige)
  [21, 39, 30, 57, 0.62],    // les Tarides
  [58, 10, 70, 18, 0.4],     // les Grisonnes
  [35, 0, 75, 23, 0.7],      // le reste du Norfendre (toundra)
  [78, 15, 94, 28, 0.4],     // Quel'Thalas
  [59, 25, 70.5, 43, 0.4],   // les Pins-Argentés et Gilnéas
  [83, 29, 94, 40, 0.42],    // les Hinterlands
  [66, 61, 77, 67.4, 0.4],   // la forêt d'Elwynn
  [66, 67.4, 79, 73.4, 0.38],// le bois de la Pénombre
  [61, 66, 66.6, 74, 0.66],  // la Marche de l'Ouest (des champs)
  [62, 73.4, 80, 95, 0.34],  // Strangleronce (la jungle)
  [44, 31, 50.4, 39.4, 0.38],// Val'sharah
  [50, 43, 55, 57, 0.4],     // Drustvar
  [44, 58, 50, 70, 0.38],    // Nazmir (jungle)
  [52, 72, 63, 87, 0.38],    // la forêt de Jade
  [44, 86, 59, 95, 0.42],    // Krasarang
  [78, 0, 96, 9, 0.5],       // les Îles aux Dragons
];
function azerothForest(y, x) {
  const f = AZEROTH_FORESTS.find(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  return f ? f[4] : 0.55;
}
