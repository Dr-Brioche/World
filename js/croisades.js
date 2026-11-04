// ✝️ SCÉNARIO « LES CROISADES » (1187-1204)
// 4 juillet 1187 : aux Cornes de Hattin, Saladin anéantit l'armée du royaume de Jérusalem. Le roi Guy de Lusignan est
// captif, la Vraie Croix est perdue, Acre est tombée ; Jérusalem va suivre. Seul le marquis Conrad de Montferrat, à Tyr,
// tient encore. L'Occident s'émeut : Frédéric Barberousse, Philippe Auguste et Richard Cœur de Lion prennent la croix.
// Commencent la troisième croisade (Acre, Arsouf, Jaffa), la mort de Saladin, la croisade d'Henri VI… et la quatrième,
// que Venise détourne sur Zara puis sur Constantinople, saccagée en avril 1204.
// La carte : de Londres à Bagdad, la Terre sainte agrandie (voir generateCroisadesMap, dans europemap.js).
// Les règles du scénario : voir croisadesrules.js. Comme pour la guerre de Cent Ans, chaque faction a :
//  - lands : son territoire en 1187, en un ou plusieurs contours [longitude, latitude] (une case appartient à la
//    première faction de la liste qui la contient : l'ordre compte là où deux contours se chevauchent) ;
//  - capital et cities : ses villes [longitude, latitude, nom, nom français (son identifiant fixe), { level, garrison }]
//    (la capitale au niveau 2, ou capitalLevel ; garrison : sa garnison vaut tant de fois plus, tant que la faction la
//    tient : les grandes forteresses, comme le Krak des Chevaliers) ;
//  - churches : des lieux notables, posés comme des églises (un champ de bataille, une abbaye, un trésor…).
// playable : le joueur peut l'incarner ; defensive : elle se défend, mais ne part pas en conquête ; noArmy : pas
// d'armée, seulement la garnison de ses villes (le pape) ; raiders : des pillards (les Coumans des steppes) ;
// production : moulins et casernes de niveau 2 autour de la capitale ; slowAI : un royaume lointain réfléchit tant de fois
// moins souvent (pour que le jeu reste rapide) ; camp : 'chretiens' ou 'musulmans' (l'IA s'en
// sert pour choisir ses cibles) ; dormant : pas de terres au départ (l'Égypte d'al-Aziz, qui naît à la mort de Saladin).
// flag : sa bannière (img/bannieres/cr_<id>) ; color : la couleur de son royaume
// (proche du fond de son drapeau, et différente de celle des autres).

const CROISADES = {
  // 📅 Le calendrier : de juillet 1187 à avril 1204. La troisième croisade (1187-1193) prend la première moitié de la
  // partie ; les années qui suivent passent plus vite (CALENDAR : [minute de jeu, année], entre deux points l'année
  // avance régulièrement)
  YEAR_START: 1187.5,
  YEAR_END: 1204.3,
  CALENDAR: [[0, 1187.5], [27, 1193.25], [50, 1204.3]],
  // Les frontières de 1187 serpentent un peu (voir claimLands)
  BORDER_WARP: { AMP: 6, SCALE: 22 },
  START_ARMY: 0.35,         // au départ, chaque faction a 35 % de son armée maximum…
  JERUSALEM_START: 0.8,     // … le royaume de Jérusalem, 80 % : les rescapés de Hattin, rassemblés à Tyr
  START_GOLD: 400,
  // ✝️ La Croyance prend les terres 2 fois moins vite que dans une partie classique (chacun a déjà ses églises)
  FAITH_SPEED: 0.5,
  // ⚔️ Saladin, quand c'est un bot : il sort de Hattin avec une armée bien plus grande (START, la part de son armée
  // maximum), et une armée maximum plus grande (BOOST, selon la difficulté) : la Terre sainte doit trembler
  SALADIN: { START: 0.75, BOOST: { facile: 1.15, normal: 1.35, difficile: 1.6 }, POWER: 0.1 },
  // Les grandes armées des événements (le siège de Jérusalem, l'armée de Barberousse…) : EVENT_ARMY soldats (selon la
  // difficulté), multipliés par ce que dit chaque événement
  EVENT_ARMY: { facile: 1800, normal: 2500, difficile: 3200 },
  // 🦁 Richard Cœur de Lion : tant qu'il règne, ses soldats se battent HERO mieux (après Arsouf, ARSUF de plus)
  RICHARD: { HERO: 0.15, ARSUF: 0.1 },
  // 🌊 Barberousse au Saleph (juin 1190) : s'il n'a pas pris le gué de Séleucie, il s'y noie, et l'Empire perd LOSS de
  // son armée ; s'il le tient, il passe le fleuve sur le pont, et ses soldats se battent HERO mieux jusqu'à la fin de
  // la croisade
  SALEPH: { LOSS: 0.4, HERO: 0.1 },
  // 🗡️ Les Assassins du Vieux de la Montagne (clic droit sur les terres d'un royaume, quand ils sont en vie) :
  //  - HIRE pièces : un assassinat contre ce royaume (s'il n'a pas payé le tribut) : il perd KILL de son armée et ne
  //    recrute plus pendant STUN secondes ; on ne peut les engager qu'une fois toutes les COOLDOWN secondes ;
  //  - TRIBUTE pièces : le tribut, qui protège des Assassins pendant SAFE secondes (et ils n'assassinent jamais
  //    celui qui le paie, pas même Conrad de Montferrat en 1192).
  //  Un bot les engage parfois (AI_EVERY secondes, s'il a AI_GOLD pièces) contre son plus grand ennemi.
  ASSASSINS: { HIRE: 1500, TRIBUTE: 600, KILL: 0.25, STUN: 45, COOLDOWN: 180, SAFE: 300, AI_EVERY: 240, AI_GOLD: 3000 },
  // 🕊️ La paix de Jaffa (septembre 1192) : TRUCE secondes sans assaut entre Saladin et les croisés
  TRUCE: 150,
  // 🤝 Les pactes du scénario (des alliances de l'histoire) : Outremer (Jérusalem et Antioche-Tripoli), que rejoignent
  // en 1188 les rois croisés (Angleterre, France, Empire) et la Sicile de Guillaume II, jusqu'à la paix de Jaffa ; les
  // frères Assen (la Bulgarie et ses alliés coumans), que la Serbie de Nemanja rejoint à Niš (NIS.JOIN) puis quitte
  // quand son fils Étienne épouse une princesse byzantine (NIS.LEAVE) ; le pacte secret de Byzance et de Saladin
  // (1189-1192) ; les Ayyoubides, si Saladin partage son empire. Un bot ne quitte jamais un pacte du scénario ; le joueur,
  // lui, peut rompre le sien (en traître), mais pas en créer d'autres.
  NIS: { JOIN: 1189.55, LEAVE: 1196.2 },
  // 🕊️ Les paix de l'histoire : ces royaumes ne se sont pas fait la guerre entre ces deux années (un traité, un mariage,
  // une trêve…). Un bot n'attaque jamais l'autre ; le joueur, lui, le peut, et la paix est alors rompue pour de bon.
  // (et aucun royaume chrétien n'attaque Rome : voir crPeace)
  PEACE: [
    ['empire', 'france', 1187, 1205],        // le traité d'Ivois (1187) ; puis Henri VI et Philippe Auguste, contre Richard
    ['empire', 'hongrie', 1187, 1205],       // Béla III accueille Barberousse et son armée (1189)
    ['angleterre', 'espagne', 1187, 1205],   // Alphonse VIII de Castille a épousé Aliénor d'Angleterre
    ['hongrie', 'byzance', 1187, 1195.3],    // Isaac Ange a épousé Marguerite de Hongrie (1185) ; il est renversé en 1195
    ['venise', 'byzance', 1187, 1201.3],     // le traité de 1187, jusqu'au marché de la quatrième croisade
    ['ayyoubides', 'abbassides', 1187, 1205], // Saladin reconnaît le calife de Bagdad
    ['egypte', 'abbassides', 1187, 1205],
    ['ayyoubides', 'assassins', 1187, 1205], // la trêve de Masyaf (1176)
    ['egypte', 'assassins', 1187, 1205],
    ['chypre', 'ayyoubides', 1187, 1191.5],  // Isaac Comnène, l'allié de Saladin, jusqu'à la venue de Richard
  ],
  // ⛓️ Richard captif en Autriche (décembre 1192) : sa rançon (RANSOM pièces, selon la difficulté) se paie toute seule,
  // RANSOM_SHARE de l'or de l'Angleterre y part chaque seconde ; elle va à l'Empereur. Tant qu'elle n'est pas payée,
  // l'Angleterre recrute CAPTIVE fois moins vite.
  RANSOM: { facile: 1500, normal: 2500, difficile: 3500 }, RANSOM_SHARE: 0.5, CAPTIVE: 0.6,
  // 👑 La succession de Saladin (mars 1193) : l'Égypte (les terres à l'ouest de EGYPT_LON) passe à son fils al-Aziz ;
  // si le joueur garde tout, une guerre civile lui coûte CIVIL_WAR de son armée
  SUCCESSION: { EGYPT_LON: 33.9, CIVIL_WAR: 0.35, FAITH: 60 },
  // 🦁 Jean sans Terre (1199) : l'Angleterre recrute JOHN fois moins vite
  JOHN: 0.85,
  // 💰 La Sérénissime : Venise reçoit GOLD pièces de ses comptoirs toutes les EVERY secondes
  VENICE: { GOLD: 25, EVERY: 5, EXCOMMUNICATION: 60 },
  // 📿 La Vraie Croix : prise à Hattin, Saladin la garde à Damas. Celui qui la tient gagne la Croyance d'une relique
  // (voir CONFIG.RELIC.FAITH) ; la reprendre est le rêve de tous les croisés
  TRUE_CROSS: 'Vraie Croix',

  // Les textes des parchemins (date, titre, récit, et le conseil, à mots couverts, des conseillers). who : les factions
  // jouables pour qui il s'ouvre (pour les autres, un simple message le remplace). « {clé} » devient un nombre du jeu.
  EVENTS: {
    jerusalemSiege: {
      who: ['jerusalem', 'ayyoubides'],
      date: tr('20 septembre 1187', '20 September 1187'),
      title: tr('Saladin devant Jérusalem', 'Saladin before Jerusalem'),
      text: tr('Ascalon a ouvert ses portes ; c\'est au tour de la Ville sainte. Saladin dresse ses tentes devant les murs, du côté du mont des Oliviers, avec {army} hommes. Dans Jérusalem, Balian d\'Ibelin n\'a que quelques chevaliers : il arme les bourgeois et adoube jusqu\'aux fils de bourgeois.',
        'Ascalon has opened its gates; now it is the Holy City\'s turn. Saladin pitches his tents before the walls, on the side of the Mount of Olives, with {army} men. Inside Jerusalem, Balian of Ibelin has only a handful of knights: he arms the townsfolk and knights even the burghers\' sons.'),
      todo: tr('Les murs de la Ville sainte ne tiendront pas sans défenseurs… et celui qui la tient tient le cœur du monde.',
        'The walls of the Holy City will not hold without defenders… and whoever holds it holds the heart of the world.'),
    },
    tyreSiege: {
      who: ['jerusalem', 'ayyoubides'],
      date: tr('Novembre 1187', 'November 1187'),
      title: tr('Le siège de Tyr', 'The siege of Tyre'),
      text: tr('Saladin se tourne vers Tyr, la dernière grande ville franque du royaume, bâtie sur sa presqu\'île. Il amène sa flotte d\'Égypte et {army} hommes. Sur les remparts, le marquis Conrad de Montferrat, arrivé par miracle juste après Hattin, jure qu\'il ne rendra pas la ville, même si Saladin menace de tuer son vieux père, captif.',
        'Saladin turns towards Tyre, the last great Frankish city of the kingdom, built on its peninsula. He brings his Egyptian fleet and {army} men. On the ramparts, Marquis Conrad of Montferrat, who arrived by a miracle just after Hattin, swears he will not surrender the city, even when Saladin threatens to kill his old father, a captive.'),
      todo: tr('Tyr est une presqu\'île : un seul chemin y mène. Qui la tient tient la porte de la reconquête.',
        'Tyre is a peninsula: a single road leads to it. Whoever holds it holds the door to the reconquest.'),
    },
    gisors: {
      who: ['angleterre', 'france', 'empire', 'jerusalem'],
      date: tr('21 janvier 1188', '21 January 1188'),
      title: tr('Les rois prennent la croix', 'The kings take the cross'),
      text: tr('La nouvelle de Hattin a brisé le cœur du vieux pape Urbain III, mort de chagrin. Sous l\'orme de Gisors, Henri II d\'Angleterre et Philippe Auguste, qui se faisaient la guerre la veille, prennent ensemble la croix ; en mars, à Mayence, l\'empereur Frédéric Barberousse fait de même. Pour payer le voyage, chacun lève la « dîme saladine » : +{gold} d\'or pour les rois croisés.',
        'The news of Hattin broke the heart of the old Pope Urban III, who died of grief. Under the elm of Gisors, Henry II of England and Philip Augustus, at war the day before, take the cross together; in March, at Mainz, Emperor Frederick Barbarossa does the same. To pay for the journey, each levies the "Saladin tithe": +{gold} gold for the crusading kings.'),
      todo: tr('Les rois croisés forment désormais une seule armée de Dieu : le chemin de Jérusalem passe par la mer… ou par Byzance.',
        'The crusading kings now form a single army of God: the road to Jerusalem goes by sea… or through Byzantium.'),
    },
    guy: {
      who: ['jerusalem'],
      date: tr('Été 1188', 'Summer 1188'),
      title: tr('Le roi Guy est libéré', 'King Guy is freed'),
      text: tr('Saladin a relâché le roi Guy de Lusignan, contre la promesse de ne plus jamais porter les armes contre lui. Guy oublie aussitôt sa promesse : il rassemble {army} hommes, chevaliers rescapés, Templiers et pèlerins. Mais Conrad refuse de lui ouvrir les portes de Tyr : deux chefs pour un seul royaume…',
        'Saladin has released King Guy of Lusignan, on the promise never to bear arms against him again. Guy promptly forgets his promise: he gathers {army} men, surviving knights, Templars and pilgrims. But Conrad refuses to open the gates of Tyre to him: two leaders for a single kingdom…'),
      todo: tr('Une armée sans ville cherche une ville. Acre, le grand port du royaume, est à deux jours de marche.',
        'An army without a city looks for a city. Acre, the great port of the kingdom, is two days\' march away.'),
    },
    barbarossa: {
      who: ['empire', 'byzance', 'hongrie'],
      date: tr('11 mai 1189', '11 May 1189'),
      title: tr('Barberousse part de Ratisbonne', 'Barbarossa sets out from Regensburg'),
      text: tr('À soixante-sept ans, l\'empereur Frédéric Barberousse quitte Ratisbonne à la tête de la plus grande armée jamais partie pour la croisade : {army} hommes, qui prennent la route de terre, par la Hongrie et l\'Empire byzantin. Le roi Béla III de Hongrie les reçoit en amis ; à Constantinople, l\'empereur Isaac Ange tremble.',
        'At sixty-seven, Emperor Frederick Barbarossa leaves Regensburg at the head of the greatest army ever to leave on crusade: {army} men, who take the land route, through Hungary and the Byzantine Empire. King Béla III of Hungary welcomes them as friends; in Constantinople, Emperor Isaac Angelos trembles.'),
      todo: tr('La route de l\'Orient est longue : au-delà du Bosphore attendent les Turcs de Konya, et des fleuves traîtres.',
        'The road to the East is long: beyond the Bosporus wait the Turks of Konya, and treacherous rivers.'),
    },
    richardKing: {
      who: ['angleterre', 'france'],
      date: tr('6 juillet 1189', '6 July 1189'),
      title: tr('Richard, roi d\'Angleterre', 'Richard, King of England'),
      text: tr('Le vieux roi Henri II est mort à Chinon, vaincu par son propre fils Richard, allié de Philippe Auguste. Richard est sacré à Westminster : on l\'appelle déjà Cœur de Lion. Il vide le trésor, vend des châteaux et des charges, et jure de partir au plus vite pour Jérusalem.',
        'The old King Henry II has died at Chinon, beaten by his own son Richard, ally of Philip Augustus. Richard is crowned at Westminster: they already call him Lionheart. He empties the treasury, sells castles and offices, and swears to leave for Jerusalem as soon as he can.'),
      todo: tr('Un roi qui se bat au premier rang vaut une armée : ses hommes le suivront jusqu\'au bout du monde.',
        'A king who fights in the front rank is worth an army: his men will follow him to the end of the world.'),
    },
    acreSiege: {
      who: ['jerusalem', 'ayyoubides'],
      date: tr('28 août 1189', '28 August 1189'),
      title: tr('Le siège d\'Acre', 'The siege of Acre'),
      text: tr('Avec une poignée d\'hommes, le roi Guy vient camper devant Acre. C\'est de la folie… mais chaque navire venu d\'Occident lui amène des renforts : Danois, Frisons, Pisans, Champenois. Saladin accourt et assiège à son tour les assiégeants. Le plus long siège des croisades commence.',
        'With a handful of men, King Guy comes to camp before Acre. It is madness… but every ship from the West brings him reinforcements: Danes, Frisians, Pisans, men of Champagne. Saladin hurries over and besieges the besiegers in turn. The longest siege of the crusades begins.'),
      todo: tr('Acre est la clé de la mer : qui la tient reçoit les renforts d\'Occident.',
        'Acre is the key to the sea: whoever holds it receives the reinforcements from the West.'),
    },
    byzantineTreaty: {
      who: ['byzance', 'empire', 'ayyoubides'],
      date: tr('Automne 1189', 'Autumn 1189'),
      title: tr('Le pacte secret d\'Isaac Ange', 'Isaac Angelos\' secret pact'),
      text: tr('L\'empereur Isaac II Ange craint plus Barberousse que Saladin : il a promis au sultan de retenir les Allemands. Ses envoyés sont jetés en prison, et l\'empereur d\'Occident occupe Philippopolis. Byzance et Saladin sont désormais alliés.',
        'Emperor Isaac II Angelos fears Barbarossa more than Saladin: he has promised the sultan to hold back the Germans. His envoys are thrown in prison, and the Western emperor occupies Philippopolis. Byzantium and Saladin are now allies.'),
      todo: tr('Un allié au-delà des mers vaut-il un ennemi à ses portes ?',
        'Is an ally beyond the seas worth an enemy at one\'s gates?'),
    },
    konya: {
      who: ['empire', 'byzance'],
      date: tr('18 mai 1190', '18 May 1190'),
      title: tr('L\'Empereur devant Konya', 'The Emperor before Konya'),
      text: tr('Les Allemands ont passé le Bosphore et traversé l\'Anatolie, harcelés par les archers turcs, mourant de soif. Affamés, ils fondent sur Konya, la capitale du sultan Kılıç Arslan : {army} hommes à l\'assaut !',
        'The Germans have crossed the Bosporus and Anatolia, harried by Turkish archers, dying of thirst. Starving, they fall upon Konya, the capital of Sultan Kılıç Arslan: {army} men to the assault!'),
      todo: tr('Konya prise, la route de la Cilicie est ouverte… et ses fleuves descendent en torrents du Taurus.',
        'With Konya taken, the road to Cilicia is open… and its rivers rush down in torrents from the Taurus.'),
    },
    saleph: {
      who: ['empire'],
      date: tr('10 juin 1190', '10 June 1190'),
      title: tr('Barberousse se noie dans le Saleph', 'Barbarossa drowns in the Saleph'),
      text: tr('Sous la chaleur de Cilicie, le vieil empereur a voulu traverser le Saleph à cheval, sans attendre le pont. Le courant l\'a emporté : on l\'a tiré de l\'eau sans vie. Sa grande armée se débande : {lost} hommes rentrent chez eux ou meurent de fièvre. Son fils Henri VI hérite de l\'Empire.',
        'In the heat of Cilicia, the old emperor wanted to ford the Saleph on horseback, without waiting for the bridge. The current carried him away: he was pulled from the water lifeless. His great army falls apart: {lost} men go home or die of fever. His son Henry VI inherits the Empire.'),
      todo: tr('L\'Empire continue, mais le cœur de la croisade allemande s\'est noyé avec son chef.',
        'The Empire goes on, but the heart of the German crusade has drowned with its leader.'),
    },
    salephBridge: {
      who: ['empire'],
      date: tr('10 juin 1190', '10 June 1190'),
      title: tr('Le pont de Séleucie', 'The bridge of Seleucia'),
      text: tr('Tes hommes tenaient le gué de Séleucie : au lieu de se jeter dans le torrent, le vieil empereur a passé le Saleph sur le pont, au pas, sous les bannières. L\'histoire en est changée : Barberousse vit, et sa présence enflamme ses soldats.',
        'Your men held the ford of Seleucia: instead of throwing himself into the torrent, the old emperor crossed the Saleph on the bridge, at a walk, under the banners. History is changed: Barbarossa lives, and his presence fires his soldiers.'),
      todo: tr('Les soldats de l\'Empereur se battent avec une ardeur nouvelle : la Terre sainte n\'est plus qu\'à quelques marches.',
        'The Emperor\'s soldiers fight with new zeal: the Holy Land is only a few marches away.'),
    },
    messina: {
      who: ['angleterre', 'france'],
      date: tr('Hiver 1190', 'Winter 1190'),
      title: tr('L\'hiver à Messine', 'Winter in Messina'),
      text: tr('Les flottes de Richard et de Philippe hivernent à Messine. Les Grecs de la ville insultent les Anglais : Richard prend Messine d\'assaut et plante sa bannière sur ses murs, au nez du roi de France. Le roi Tancrède de Sicile achète la paix : +{gold} d\'or pour chaque roi.',
        'Richard\'s and Philip\'s fleets winter in Messina. The Greeks of the town insult the English: Richard storms Messina and plants his banner on its walls, under the King of France\'s nose. King Tancred of Sicily buys peace: +{gold} gold for each king.'),
      todo: tr('Deux rois, une seule croisade… et déjà deux bannières qui se disputent les mêmes murs.',
        'Two kings, a single crusade… and already two banners quarrelling over the same walls.'),
    },
    cyprus: {
      who: ['angleterre'],
      date: tr('Mai 1191', 'May 1191'),
      title: tr('Isaac Comnène et l\'île de Chypre', 'Isaac Comnenus and the island of Cyprus'),
      text: tr('La tempête a jeté sur Chypre des navires de ta flotte, dont celui de ta fiancée, Bérengère de Navarre. Le « despote » Isaac Comnène a pillé les naufragés et voulu prendre la princesse en otage. Tu débarques avec {army} hommes : l\'île sera à toi, et tu épouseras Bérengère à Limassol.',
        'The storm has thrown ships of your fleet onto Cyprus, among them that of your bride, Berengaria of Navarre. The "despot" Isaac Comnenus has plundered the castaways and tried to take the princess hostage. You land with {army} men: the island will be yours, and you will marry Berengaria at Limassol.'),
      todo: tr('Chypre est à un jour de voile de la Terre sainte : un grenier, un port, une base pour toute la croisade.',
        'Cyprus is a day\'s sail from the Holy Land: a granary, a port, a base for the whole crusade.'),
    },
    kingsArrive: {
      who: ['angleterre', 'france', 'ayyoubides', 'jerusalem'],
      date: tr('Printemps 1191', 'Spring 1191'),
      title: tr('Les rois débarquent devant Acre', 'The kings land before Acre'),
      text: tr('En avril, Philippe Auguste et ses Français ; en juin, Richard et ses Anglais, avec leurs machines de siège, « Mauvaise Voisine » et « Malcousine ». Les murs d\'Acre, assiégés depuis deux ans, craquent sous les pierres. Saladin ne peut plus secourir la ville.',
        'In April, Philip Augustus and his Frenchmen; in June, Richard and his Englishmen, with their siege engines, "Bad Neighbour" and "Bad Cousin". The walls of Acre, besieged for two years, crack under the stones. Saladin can no longer relieve the city.'),
      todo: tr('Le sort de la croisade se joue devant Acre.', 'The fate of the crusade is decided before Acre.'),
    },
    philipLeaves: {
      who: ['france', 'angleterre'],
      date: tr('31 juillet 1191', '31 July 1191'),
      title: tr('Philippe Auguste rentre en France', 'Philip Augustus goes home'),
      text: tr('Acre prise, le roi de France est malade de la fièvre, et las de vivre dans l\'ombre de Richard. Surtout, le comte de Flandre est mort devant Acre : son héritage, l\'Artois et le Vermandois, se joue à Paris, pas à Jérusalem. Philippe quitte la croisade… et lorgne déjà sur la Normandie de Richard.',
        'With Acre taken, the King of France is sick with fever, and tired of living in Richard\'s shadow. Above all, the Count of Flanders has died before Acre: his inheritance, Artois and Vermandois, is played out in Paris, not in Jerusalem. Philip leaves the crusade… and already eyes Richard\'s Normandy.'),
      todo: tr('Un roi absent laisse ses terres à qui veut les prendre.', 'An absent king leaves his lands to whoever wants to take them.'),
    },
    arsuf: {
      who: ['angleterre', 'ayyoubides'],
      date: tr('7 septembre 1191', '7 September 1191'),
      title: tr('La bataille d\'Arsouf', 'The battle of Arsuf'),
      text: tr('Toute la journée, la colonne de Richard a marché le long de la côte sous les flèches des archers turcs, sans rompre les rangs. Puis les Hospitaliers chargent, et Richard lance toute sa chevalerie : l\'armée de Saladin est mise en déroute. On dit désormais que Saladin peut être vaincu.',
        'All day long, Richard\'s column has marched along the coast under the arrows of the Turkish archers, without breaking ranks. Then the Hospitallers charge, and Richard throws in all his knights: Saladin\'s army is routed. Men now say that Saladin can be beaten.'),
      todo: tr('La victoire d\'Arsouf rend tes chevaliers plus hardis encore.', 'The victory of Arsuf makes your knights bolder still.'),
    },
    conrad: {
      who: ['jerusalem'],
      date: tr('28 avril 1192', '28 April 1192'),
      title: tr('Conrad de Montferrat assassiné', 'Conrad of Montferrat assassinated'),
      text: tr('Élu roi de Jérusalem il y a quelques jours à peine, le marquis Conrad rentrait souper dans une rue de Tyr quand deux hommes l\'ont abordé avec une lettre… puis poignardé. Les Assassins du Vieux de la Montagne ont frappé. Le royaume se déchire en querelles : son armée perd {lost} hommes, et ne recrute plus pendant {secs} secondes. Henri de Champagne épouse la reine Isabelle et prend sa place.',
        'Elected King of Jerusalem only a few days before, Marquis Conrad was returning to supper in a street of Tyre when two men approached him with a letter… and stabbed him. The Assassins of the Old Man of the Mountain have struck. The kingdom tears itself apart in quarrels: its army loses {lost} men, and recruits no more for {secs} seconds. Henry of Champagne marries Queen Isabella and takes his place.'),
      todo: tr('Le Vieux de la Montagne épargne ceux qui lui paient tribut… les autres ne dorment jamais tranquilles.',
        'The Old Man of the Mountain spares those who pay him tribute… the others never sleep easy.'),
    },
    conradSpared: {
      who: ['jerusalem'],
      date: tr('Avril 1192', 'April 1192'),
      title: tr('Le Vieux de la Montagne épargne Conrad', 'The Old Man of the Mountain spares Conrad'),
      text: tr('Deux hommes déguisés en moines rôdaient autour du marquis Conrad, à Tyr… puis sont repartis sans frapper. Le Vieux de la Montagne honore ceux qui lui paient tribut : l\'histoire en est changée, et Conrad règne sur Jérusalem.',
        'Two men disguised as monks prowled around Marquis Conrad, in Tyre… then left without striking. The Old Man of the Mountain honours those who pay him tribute: history is changed, and Conrad reigns over Jerusalem.'),
      todo: tr('Un tribut bien placé vaut toutes les cottes de mailles.', 'A well-placed tribute is worth all the mail in the world.'),
    },
    jaffa: {
      who: ['angleterre', 'ayyoubides', 'jerusalem', 'empire', 'france'],
      date: tr('2 septembre 1192', '2 September 1192'),
      title: tr('La paix de Jaffa', 'The peace of Jaffa'),
      text: tr('Deux fois, Richard est arrivé en vue de Jérusalem ; deux fois, il a fait demi-tour, sachant qu\'il ne pourrait pas la garder. Épuisés, Richard et Saladin signent la paix : trois ans de trêve. Les pèlerins chrétiens pourront prier au Saint-Sépulcre, sans armes. Les rois d\'Occident rentrent chez eux.',
        'Twice Richard came within sight of Jerusalem; twice he turned back, knowing he could not keep it. Exhausted, Richard and Saladin sign the peace: a three-year truce. Christian pilgrims may pray at the Holy Sepulchre, unarmed. The kings of the West go home.'),
      todo: tr('Pendant {secs} secondes, le sabre et l\'épée restent au fourreau entre Saladin et les croisés. La croisade est finie : chacun reprend sa liberté.',
        'For {secs} seconds, sabre and sword stay sheathed between Saladin and the crusaders. The crusade is over: each regains his freedom.'),
    },
    captured: {
      who: ['angleterre', 'empire', 'france'],
      date: tr('Décembre 1192', 'December 1192'),
      title: tr('Richard prisonnier', 'Richard a prisoner'),
      text: tr('Sur le chemin du retour, déguisé en pèlerin, Richard a été reconnu près de Vienne et pris par le duc Léopold d\'Autriche, qu\'il avait humilié devant Acre. Il est enfermé à Dürnstein, puis livré à l\'empereur Henri VI. Rançon : {gold} pièces d\'or. Pendant ce temps, son frère Jean et Philippe Auguste se partagent ses terres en rêve.',
        'On his way home, disguised as a pilgrim, Richard was recognised near Vienna and taken by Duke Leopold of Austria, whom he had humiliated before Acre. He is locked up in Dürnstein, then handed over to Emperor Henry VI. Ransom: {gold} gold. Meanwhile, his brother John and Philip Augustus divide his lands in their dreams.'),
      todo: tr('La moitié du trésor d\'Angleterre partira pour la rançon, jusqu\'à ce qu\'elle soit payée ; d\'ici là, le royaume recrute moins.',
        'Half of England\'s treasury will go to the ransom until it is paid; until then, the kingdom recruits less.'),
    },
    saladinDies: {
      who: ['ayyoubides'],
      date: tr('4 mars 1193', '4 March 1193'),
      title: tr('La mort de Saladin', 'The death of Saladin'),
      text: tr('Saladin s\'est éteint à Damas, à cinquante-cinq ans. Il a tant donné qu\'on n\'a pas trouvé dans son trésor de quoi payer son enterrement. Ses fils se disputent déjà l\'héritage : al-Afdal tient Damas, al-Aziz Le Caire, az-Zahir Alep, et leur oncle al-Adil attend son heure. Que faire de l\'Égypte ?',
        'Saladin has passed away in Damascus, aged fifty-five. He gave away so much that his treasury did not hold enough to pay for his burial. His sons already quarrel over the inheritance: al-Afdal holds Damascus, al-Aziz Cairo, az-Zahir Aleppo, and their uncle al-Adil bides his time. What is to become of Egypt?'),
      todo: tr('Partager, c\'est garder la paix mais perdre l\'Égypte ; tout garder, c\'est la guerre entre frères.',
        'To share is to keep the peace but lose Egypt; to keep everything is war between brothers.'),
    },
    sicily: {
      who: ['empire'],
      date: tr('Automne 1194', 'Autumn 1194'),
      title: tr('L\'héritage de Sicile', 'The inheritance of Sicily'),
      text: tr('Le roi Tancrède est mort : par sa femme Constance, l\'empereur Henri VI réclame le royaume de Sicile. Payée avec l\'or de la rançon de Richard, sa flotte cingle vers Palerme avec {army} hommes. Le jour de Noël, il y sera couronné.',
        'King Tancred is dead: through his wife Constance, Emperor Henry VI claims the kingdom of Sicily. Paid for with the gold of Richard\'s ransom, his fleet sails for Palermo with {army} men. On Christmas Day, he will be crowned there.'),
      todo: tr('Palerme, la plus riche ville d\'Occident, attend son nouveau maître.', 'Palermo, the richest city of the West, awaits its new master.'),
    },
    isaacBlinded: {
      who: ['byzance'],
      date: tr('Avril 1195', 'April 1195'),
      title: tr('Isaac Ange aveuglé', 'Isaac Angelos blinded'),
      text: tr('Pendant que l\'empereur Isaac chassait en Thrace, son propre frère Alexis l\'a fait arrêter, aveugler et jeter en prison. Alexis III monte sur le trône ; l\'armée, déchirée, perd {lost} hommes.',
        'While Emperor Isaac was hunting in Thrace, his own brother Alexios had him arrested, blinded and thrown in prison. Alexios III ascends the throne; the army, torn apart, loses {lost} men.'),
      todo: tr('Le fils d\'Isaac, le jeune Alexis, s\'est enfui en Occident : on en reparlera.', 'Isaac\'s son, the young Alexios, has fled to the West: we shall hear of him again.'),
    },
    germanCrusade: {
      who: ['empire', 'ayyoubides', 'egypte'],
      date: tr('Septembre 1197', 'September 1197'),
      title: tr('La croisade d\'Henri VI', 'Henry VI\'s crusade'),
      text: tr('Maître de l\'Empire et de la Sicile, Henri VI rêve de Byzance et de Jérusalem. Il envoie en Terre sainte {army} croisés allemands, qui reprennent Sidon et Beyrouth.',
        'Master of the Empire and of Sicily, Henry VI dreams of Byzantium and Jerusalem. He sends {army} German crusaders to the Holy Land, who retake Sidon and Beirut.'),
      todo: tr('La trêve de Jaffa est oubliée.', 'The truce of Jaffa is forgotten.'),
    },
    henryDies: {
      who: ['empire'],
      date: tr('28 septembre 1197', '28 September 1197'),
      title: tr('La mort d\'Henri VI', 'The death of Henry VI'),
      text: tr('L\'empereur Henri VI est mort de la malaria à Messine, à trente-deux ans, laissant un fils de trois ans. Les princes allemands élisent deux rois à la fois, Philippe de Souabe et Otton de Brunswick : la guerre civile déchire l\'Empire. Pendant {secs} secondes, il recrute moitié moins.',
        'Emperor Henry VI has died of malaria in Messina, aged thirty-two, leaving a three-year-old son. The German princes elect two kings at once, Philip of Swabia and Otto of Brunswick: civil war tears the Empire apart. For {secs} seconds, it recruits half as fast.'),
      todo: tr('Un empire à deux têtes ne regarde plus vers l\'Orient.', 'A two-headed empire no longer looks to the East.'),
    },
    richardDies: {
      who: ['angleterre', 'france'],
      date: tr('6 avril 1199', '6 April 1199'),
      title: tr('Richard meurt à Châlus', 'Richard dies at Châlus'),
      text: tr('Devant le petit château de Châlus, en Limousin, un arbalétrier a touché Richard à l\'épaule. La plaie s\'est gangrenée : le Cœur de Lion est mort. Son frère Jean, qu\'on appellera « sans Terre », lui succède… et Philippe Auguste n\'attendait que ça.',
        'Before the little castle of Châlus, in the Limousin, a crossbowman struck Richard in the shoulder. The wound turned gangrenous: the Lionheart is dead. His brother John, who will be called "Lackland", succeeds him… and Philip Augustus was only waiting for that.'),
      todo: tr('Le roi Jean recrute moins que son frère, et la Normandie n\'a plus de lion pour la garder.',
        'King John recruits less than his brother, and Normandy has no lion left to guard it.'),
    },
    venice: {
      who: ['venise', 'byzance'],
      date: tr('Avril 1201', 'April 1201'),
      title: tr('Le marché de Venise', 'The bargain of Venice'),
      text: tr('Les barons de la quatrième croisade demandent au vieux doge Enrico Dandolo, aveugle et rusé, des navires pour 33 500 hommes : 85 000 marcs d\'argent. Mais ils ne seront jamais assez nombreux pour payer. Le doge a une idée : la dette sera remise… s\'ils l\'aident d\'abord à reprendre Zara, la ville rebelle passée au roi de Hongrie.',
        'The barons of the Fourth Crusade ask the old Doge Enrico Dandolo, blind and cunning, for ships for 33,500 men: 85,000 silver marks. But they will never be numerous enough to pay. The doge has an idea: the debt will be forgiven… if they first help him retake Zara, the rebel city that went over to the King of Hungary.'),
      todo: tr('Une croisade qui ne peut pas payer son passage est une armée à louer.', 'A crusade that cannot pay its passage is an army for hire.'),
    },
    zara: {
      who: ['venise', 'hongrie'],
      date: tr('Novembre 1202', 'November 1202'),
      title: tr('Les croisés devant Zara', 'The crusaders before Zara'),
      text: tr('La flotte vénitienne débarque {army} croisés devant Zara, une ville chrétienne, sous les bannières à croix que ses habitants ont accrochées aux remparts. Le pape Innocent III excommunie les assaillants.',
        'The Venetian fleet lands {army} crusaders before Zara, a Christian city, beneath the cross-marked banners its citizens have hung on the ramparts. Pope Innocent III excommunicates the attackers.'),
      todo: tr('L\'excommunication coûte cher aux âmes… et à la Croyance.', 'Excommunication costs souls dearly… and Faith too.'),
    },
    constantinople1: {
      who: ['venise', 'byzance'],
      date: tr('Juillet 1203', 'July 1203'),
      title: tr('La flotte devant Constantinople', 'The fleet before Constantinople'),
      text: tr('Le jeune Alexis, fils d\'Isaac l\'aveugle, a promis aux croisés monts et merveilles s\'ils lui rendent le trône. La flotte vénitienne force la Corne d\'Or ; le doge aveugle saute le premier sur la grève. {army} hommes donnent l\'assaut à la plus grande ville du monde.',
        'The young Alexios, son of the blind Isaac, has promised the crusaders the earth if they give him back the throne. The Venetian fleet forces the Golden Horn; the blind doge is the first to leap onto the shore. {army} men assault the greatest city in the world.'),
      todo: tr('Les murs de Théodose n\'ont jamais été pris… du côté de la terre.', 'The walls of Theodosius have never been taken… from the landward side.'),
    },
    sack: {
      who: ['venise', 'byzance'],
      date: tr('12 avril 1204', '12 April 1204'),
      title: tr('Le sac de Constantinople', 'The sack of Constantinople'),
      text: tr('Alexis IV n\'a pas payé ; il a été étranglé. Les croisés et les Vénitiens, furieux, lancent l\'assaut final : {army} hommes. Si la ville tombe, trois jours de pillage : les chevaux de bronze de l\'Hippodrome partiront pour Saint-Marc.',
        'Alexios IV has not paid; he has been strangled. The furious crusaders and Venetians launch the final assault: {army} men. If the city falls, three days of plunder: the bronze horses of the Hippodrome will leave for Saint Mark\'s.'),
      todo: tr('C\'est la fin d\'un monde, ou sa dernière victoire.', 'This is the end of a world, or its last victory.'),
    },
    end: {
      who: ['ayyoubides', 'jerusalem', 'angleterre', 'france', 'empire', 'byzance', 'venise'],
      date: tr('Avril 1204', 'April 1204'),
      title: tr('La fin d\'une époque', 'The end of an era'),
      text: tr('Constantinople a connu son destin ; Saladin, Richard et Barberousse sont morts. Les croisades continueront encore un siècle, mais plus jamais avec cette grandeur. Les chroniqueurs posent la plume : ton règne, lui, peut continuer.',
        'Constantinople has met its fate; Saladin, Richard and Barbarossa are dead. The crusades will go on for another century, but never again with such grandeur. The chroniclers lay down their pens: your reign, however, may go on.'),
      todo: tr('Tes objectifs restent à remplir, si tu le veux.', 'Your objectives remain to be fulfilled, if you wish.'),
    },
  },
  // Les premiers parchemins : un par faction jouable, au début de la partie
  INTROS: {
    ayyoubides: {
      date: tr('5 juillet 1187', '5 July 1187'), title: tr('Le lendemain de Hattin', 'The day after Hattin'),
      text: tr('Hier, aux Cornes de Hattin, tu as écrasé l\'armée franque : le roi Guy est ton prisonnier, Renaud de Châtillon, le pillard des caravanes, a payé de sa tête, et la Vraie Croix des chrétiens est dans ta tente. Acre vient de t\'ouvrir ses portes. De l\'Égypte à Alep, l\'islam est uni sous ta bannière : il te reste à rendre Jérusalem — al-Quds — aux croyants.',
        'Yesterday, at the Horns of Hattin, you crushed the Frankish army: King Guy is your prisoner, Reynald of Châtillon, the plunderer of caravans, has paid with his head, and the Christians\' True Cross lies in your tent. Acre has just opened its gates to you. From Egypt to Aleppo, Islam is united under your banner: it remains for you to give Jerusalem — al-Quds — back to the faithful.'),
      todo: tr('Tes grands desseins sont écrits en haut à gauche. Mais l\'Occident va se lever : tous ses rois prendront la croix.',
        'Your great designs are written at the top left. But the West will rise: all its kings will take the cross.'),
    },
    jerusalem: {
      date: tr('14 juillet 1187', '14 July 1187'), title: tr('Le dernier rempart', 'The last bulwark'),
      text: tr('Ton navire venait de Constantinople ; il devait accoster à Acre, mais Acre est tombée. Tu as débarqué à Tyr, où les rescapés de Hattin t\'ont supplié de prendre le commandement. Le royaume de Jérusalem n\'est plus qu\'une poignée de villes : Tyr, Jérusalem, Ascalon, le Krak de Moab, isolées les unes des autres. Saladin arrive.',
        'Your ship came from Constantinople; it was to put in at Acre, but Acre has fallen. You landed at Tyre, where the survivors of Hattin begged you to take command. The kingdom of Jerusalem is now only a handful of cities: Tyre, Jerusalem, Ascalon, the Krak of Moab, cut off from one another. Saladin is coming.'),
      todo: tr('Tiens, jusqu\'à ce que l\'Occident arrive. Ta tâche est la plus dure de toutes : chaque ville gardée est une victoire.',
        'Hold on until the West arrives. Yours is the hardest task of all: every city kept is a victory.'),
    },
    angleterre: {
      date: tr('Été 1187', 'Summer 1187'), title: tr('L\'empire Plantagenêt', 'The Plantagenet empire'),
      text: tr('Ton père Henri II règne de l\'Écosse aux Pyrénées : l\'Angleterre, la Normandie, l\'Anjou, l\'Aquitaine. Toi, Richard, duc d\'Aquitaine, tu es le premier prince d\'Occident à prendre la croix en apprenant la chute de Jérusalem. Mais avant de partir, il faut garder tes terres de France contre le roi Philippe… et contre ta propre famille.',
        'Your father Henry II reigns from Scotland to the Pyrenees: England, Normandy, Anjou, Aquitaine. You, Richard, Duke of Aquitaine, are the first prince of the West to take the cross on learning of the fall of Jerusalem. But before leaving, you must keep your French lands against King Philip… and against your own family.'),
      todo: tr('Le chemin de Jérusalem passe par la mer : il faudra des ports, des navires, et une étape en route.',
        'The road to Jerusalem goes by sea: you will need ports, ships, and a stopover on the way.'),
    },
    france: {
      date: tr('Été 1187', 'Summer 1187'), title: tr('Le roi au petit domaine', 'The king with the small domain'),
      text: tr('Tu as vingt-deux ans, et ton royaume est plus petit que les terres de ton vassal, le roi d\'Angleterre, qui tient la moitié de la France. Tu es Philippe, que l\'on appellera Auguste : celui qui agrandit. Jérusalem est tombée, et l\'Église t\'appelle à la croisade… mais ton vrai combat est ici, contre les Plantagenêts.',
        'You are twenty-two, and your kingdom is smaller than the lands of your vassal, the King of England, who holds half of France. You are Philip, who will be called Augustus: he who enlarges. Jerusalem has fallen, and the Church calls you to the crusade… but your real fight is here, against the Plantagenets.'),
      todo: tr('Une croisade grandit un roi aux yeux de Dieu ; la Normandie le grandit aux yeux des hommes.',
        'A crusade makes a king greater in the eyes of God; Normandy makes him greater in the eyes of men.'),
    },
    empire: {
      date: tr('Été 1187', 'Summer 1187'), title: tr('Le vieil empereur', 'The old emperor'),
      text: tr('Tu es Frédéric Barberousse, empereur depuis trente-cinq ans, vainqueur et vaincu de l\'Italie. À près de soixante-dix ans, tu veux couronner ta vie par la plus sainte des guerres. Ton armée sera la plus grande jamais partie pour l\'Orient… mais la route de terre est longue, et passe par Byzance et par le sultanat de Konya.',
        'You are Frederick Barbarossa, emperor for thirty-five years, conqueror and conquered of Italy. At nearly seventy, you want to crown your life with the holiest of wars. Your army will be the greatest ever to leave for the East… but the land route is long, and passes through Byzantium and the sultanate of Konya.'),
      todo: tr('Ton fils Henri a épousé Constance, l\'héritière de Sicile : un jour, Palerme sera à l\'Empire.',
        'Your son Henry has married Constance, heiress of Sicily: one day, Palermo will belong to the Empire.'),
    },
    byzance: {
      date: tr('Été 1187', 'Summer 1187'), title: tr('L\'empire qui chancelle', 'The tottering empire'),
      text: tr('Tu es Isaac II Ange, empereur des Romains depuis deux ans, par une émeute. L\'empire de Manuel Comnène se défait : les Bulgares des frères Asen se sont révoltés, un usurpateur règne à Chypre, les Turcs mordent l\'Anatolie, et les Latins méprisent les Grecs depuis le massacre de 1182. Et voilà que les Allemands vont traverser tes terres.',
        'You are Isaac II Angelos, Emperor of the Romans for two years, thanks to a riot. Manuel Comnenus\' empire is unravelling: the Bulgarians of the Asen brothers have revolted, a usurper reigns in Cyprus, the Turks gnaw at Anatolia, and the Latins have despised the Greeks since the massacre of 1182. And now the Germans are about to cross your lands.'),
      todo: tr('La Ville reine n\'est jamais tombée. Qu\'elle ne tombe pas sous ton règne.', 'The Queen of Cities has never fallen. Let it not fall in your reign.'),
    },
    venise: {
      date: tr('Été 1187', 'Summer 1187'), title: tr('La Sérénissime', 'The Most Serene Republic'),
      text: tr('Venise n\'a presque pas de terres, mais elle a la mer : ses galères portent les pèlerins, les épices et la soie, ses marchands ont un quartier dans chaque port d\'Orient. Le doge Orio Mastropiero compte ses ducats ; dans l\'ombre, un vieux conseiller presque aveugle, Enrico Dandolo, n\'a pas oublié comment Byzance a jeté les Vénitiens en prison en 1171.',
        'Venice has almost no land, but it has the sea: its galleys carry pilgrims, spices and silk, its merchants have a quarter in every port of the East. Doge Orio Mastropiero counts his ducats; in the shadows, an old, almost blind councillor, Enrico Dandolo, has not forgotten how Byzantium threw the Venetians in prison in 1171.'),
      todo: tr('Une croisade, c\'est d\'abord des navires… et ceux qui louent les navires fixent la route.',
        'A crusade is first of all ships… and those who hire out the ships choose the route.'),
    },
  },
  // Les choix des parchemins : pour chaque événement, ses boutons (pick : le choix, voir crChoose)
  CHOICES: {
    philipLeaves: [
      { pick: 'home', label: tr('🏰 Rentrer en France (+{gold} d\'or de l\'héritage de Flandre, la croisade sans toi)', '🏰 Go home to France (+{gold} gold from the Flemish inheritance, the crusade goes on without you)') },
      { pick: 'stay', label: tr('✝️ Rester en Terre sainte (+{faith} de Croyance)', '✝️ Stay in the Holy Land (+{faith} Faith)') },
    ],
    saladinDies: [
      { pick: 'share', label: tr('🤝 Partager : l\'Égypte va à ton frère al-Aziz, ton allié (+{faith} de Croyance)', '🤝 Share: Egypt goes to your brother al-Aziz, your ally (+{faith} Faith)') },
      { pick: 'keep', label: tr('⚔️ Tout garder : la guerre civile (−{pct} % de tes soldats)', '⚔️ Keep everything: civil war (−{pct}% of your soldiers)') },
    ],
    byzantineTreaty: [
      { pick: 'saladin', label: tr('🤝 S\'allier à Saladin (jusqu\'à la paix de Jaffa)', '🤝 Ally with Saladin (until the peace of Jaffa)') },
      { pick: 'refuse', label: tr('✝️ Refuser : laisser passer les croisés (+{faith} de Croyance)', '✝️ Refuse: let the crusaders pass (+{faith} Faith)') },
    ],
  },

  // 👑 Les objectifs de chaque faction jouable (tous remplis en même temps : la victoire)
  //  - city : tenir ces villes (noms français) ; church : tenir ce lieu ; cross : tenir la Vraie Croix ;
  //  - never : que cette ville ne soit jamais prise par un autre (perdu pour de bon sinon) ;
  //  - faith : avoir cette Croyance ; citadel : une ville de ce niveau ; gold : avoir cet or.
  //  (goal = { facile, normal, difficile } ; « {n} » dans le texte devient ce nombre)
  OBJECTIVES: {
    ayyoubides: {
      title: tr('☪️ Le djihad de Saladin', '☪️ Saladin\'s jihad'),
      list: [
        { kind: 'city', cities: ['Jérusalem'], text: tr('Rendre al-Quds aux croyants : prendre Jérusalem (1187)', 'Return al-Quds to the faithful: take Jerusalem (1187)') },
        { kind: 'city', cities: ['Tyr'], text: tr('Prendre Tyr, que Saladin n\'a jamais pu prendre', 'Take Tyre, which Saladin never could take') },
        { kind: 'city', cities: ['Tripoli'], text: tr('Rejeter les Francs à la mer : prendre Tripoli', 'Drive the Franks into the sea: take Tripoli') },
        { kind: 'city', cities: ['Krak des Chevaliers'], text: tr('Prendre le Krak des Chevaliers, devant lequel Saladin a renoncé (1188)', 'Take the Krak des Chevaliers, before which Saladin gave up (1188)') },
        { kind: 'city', cities: ['Antioche'], text: tr('Prendre Antioche', 'Take Antioch') },
        { kind: 'cross', text: tr('Garder la Vraie Croix des chrétiens', 'Keep the Christians\' True Cross') },
        { kind: 'faith', goal: { facile: 300, normal: 450, difficile: 600 }, text: tr('Le défenseur de la foi : {n} de Croyance', 'Defender of the faith: {n} Faith') },
      ],
    },
    jerusalem: {
      title: tr('✝️ Sauver le royaume de Jérusalem', '✝️ Save the kingdom of Jerusalem'),
      list: [
        { kind: 'never', city: 'Tyr', text: tr('Que Tyr ne tombe jamais', 'Tyre must never fall') },
        { kind: 'city', cities: ['Acre'], text: tr('Reprendre Acre (1191)', 'Retake Acre (1191)') },
        { kind: 'city', cities: ['Jaffa'], text: tr('Reprendre Jaffa (1191)', 'Retake Jaffa (1191)') },
        { kind: 'city', cities: ['Jérusalem'], text: tr('Tenir Jérusalem', 'Hold Jerusalem') },
        { kind: 'cross', text: tr('Reprendre la Vraie Croix', 'Recover the True Cross') },
        { kind: 'faith', goal: { facile: 150, normal: 220, difficile: 300 }, text: tr('La terre des pèlerins : {n} de Croyance', 'The land of pilgrims: {n} Faith') },
      ],
    },
    angleterre: {
      title: tr('🦁 La croisade de Richard', '🦁 Richard\'s crusade'),
      list: [
        { kind: 'city', cities: ['Nicosie'], text: tr('Prendre Chypre : Nicosie (1191)', 'Take Cyprus: Nicosia (1191)') },
        { kind: 'city', cities: ['Acre'], text: tr('Prendre Acre (1191)', 'Take Acre (1191)') },
        { kind: 'city', cities: ['Jaffa'], text: tr('Prendre Jaffa (1191)', 'Take Jaffa (1191)') },
        { kind: 'city', cities: ['Jérusalem'], text: tr('Prendre Jérusalem, que Richard n\'a fait qu\'apercevoir', 'Take Jerusalem, which Richard only glimpsed') },
        { kind: 'city', cities: ['Rouen', 'Bordeaux'], text: tr('Garder la Normandie et l\'Aquitaine : Rouen et Bordeaux', 'Keep Normandy and Aquitaine: Rouen and Bordeaux') },
        { kind: 'faith', goal: { facile: 250, normal: 350, difficile: 450 }, text: tr('Le roi croisé : {n} de Croyance', 'The crusader king: {n} Faith') },
      ],
    },
    france: {
      title: tr('⚜️ Philippe Auguste', '⚜️ Philip Augustus'),
      list: [
        { kind: 'city', cities: ['Acre'], text: tr('Prendre Acre (1191)', 'Take Acre (1191)') },
        { kind: 'city', cities: ['Rouen'], text: tr('Prendre la Normandie : Rouen (1204)', 'Take Normandy: Rouen (1204)') },
        { kind: 'city', cities: ['Poitiers'], text: tr('Prendre le Poitou : Poitiers', 'Take Poitou: Poitiers') },
        { kind: 'church', name: 'Fontevraud', text: tr('Prendre l\'Anjou : Fontevraud, le tombeau des Plantagenêts', 'Take Anjou: Fontevraud, tomb of the Plantagenets') },
        { kind: 'citadel', goal: { facile: 4, normal: 4, difficile: 4 }, text: tr('L\'enceinte de Philippe Auguste : une ville de niveau {n}', 'The wall of Philip Augustus: a level {n} city') },
        { kind: 'faith', goal: { facile: 250, normal: 350, difficile: 450 }, text: tr('Le roi très chrétien : {n} de Croyance', 'The Most Christian King: {n} Faith') },
      ],
    },
    empire: {
      title: tr('🦅 L\'Empereur croisé', '🦅 The crusader Emperor'),
      list: [
        { kind: 'city', cities: ['Ratisbonne', 'Milan'], text: tr('Tenir l\'Empire : Ratisbonne et Milan', 'Hold the Empire: Regensburg and Milan') },
        { kind: 'city', cities: ['Konya'], text: tr('Prendre Konya, la capitale du sultan (1190)', 'Take Konya, the sultan\'s capital (1190)') },
        { kind: 'city', cities: ['Palerme'], text: tr('L\'héritage de Constance : prendre Palerme (1194)', 'Constance\'s inheritance: take Palermo (1194)') },
        { kind: 'city', cities: ['Acre'], text: tr('Prendre Acre, où naît l\'ordre Teutonique (1190)', 'Take Acre, where the Teutonic Order is born (1190)') },
        { kind: 'citadel', goal: { facile: 4, normal: 4, difficile: 4 }, text: tr('Une capitale impériale : une ville de niveau {n}', 'An imperial capital: a level {n} city') },
        { kind: 'faith', goal: { facile: 250, normal: 350, difficile: 450 }, text: tr('Le Saint-Empire : {n} de Croyance', 'The Holy Empire: {n} Faith') },
      ],
    },
    byzance: {
      title: tr('☦️ La Ville reine', '☦️ The Queen of Cities'),
      list: [
        { kind: 'never', city: 'Constantinople', text: tr('Que Constantinople ne tombe jamais', 'Constantinople must never fall') },
        { kind: 'city', cities: ['Tarnovo'], text: tr('Soumettre les Bulgares : prendre Tarnovo', 'Subdue the Bulgarians: take Tarnovo') },
        { kind: 'city', cities: ['Nicosie'], text: tr('Reprendre Chypre à l\'usurpateur : Nicosie', 'Retake Cyprus from the usurper: Nicosia') },
        { kind: 'city', cities: ['Konya'], text: tr('Venger Myrioképhalon : prendre Konya', 'Avenge Myriokephalon: take Konya') },
        { kind: 'city', cities: ['Antioche'], text: tr('Antioche, la cité de l\'empereur : la prendre', 'Antioch, the emperor\'s city: take it') },
        { kind: 'gold', goal: { facile: 5000, normal: 7000, difficile: 9000 }, text: tr('Le trésor des Basileis : {n} pièces d\'or', 'The treasure of the Basileis: {n} gold') },
      ],
    },
    venise: {
      title: tr('🦁 La Sérénissime', '🦁 The Most Serene Republic'),
      list: [
        { kind: 'city', cities: ['Venise'], text: tr('Tenir Venise', 'Hold Venice') },
        { kind: 'city', cities: ['Zara'], text: tr('Reprendre Zara (1202)', 'Retake Zara (1202)') },
        { kind: 'city', cities: ['Constantinople'], text: tr('Prendre Constantinople (1204)', 'Take Constantinople (1204)') },
        { kind: 'city', cities: ['Candie'], text: tr('Acheter la Crète : Candie (1204)', 'Buy Crete: Candia (1204)') },
        { kind: 'ports', goal: { facile: 4, normal: 5, difficile: 6 }, text: tr('Un comptoir dans chaque port : {n} ports', 'A trading post in every port: {n} ports') },
        { kind: 'gold', goal: { facile: 8000, normal: 10000, difficile: 12000 }, text: tr('Les ducats de Saint-Marc : {n} pièces d\'or', 'The ducats of Saint Mark: {n} gold') },
      ],
    },
  },

  // ⭐ Les défis de chaque faction jouable (voir defis.js) : des objectifs en plus, historiques, drôles ou très durs.
  // Un lieu (places) : le nom français d'une ville ou d'un lieu. byYear / untilYear : l'année.
  CHALLENGES: {
    ayyoubides: [
      { kind: 'hold', places: ['Jérusalem'], byYear: 1188, text: tr('La reconquête éclair : prendre Jérusalem avant 1188', 'Lightning reconquest: take Jerusalem before 1188'), reward: { gold: 2000, faith: 40 } },
      { kind: 'hold', places: ['Constantinople'], text: tr('Deux siècles d\'avance : prendre Constantinople', 'Two centuries early: take Constantinople'), reward: { gold: 3000, faith: 60 } },
      { kind: 'army', n: 12000, text: tr('L\'armée de Hattin : réunir 12 000 soldats', 'The army of Hattin: gather 12,000 soldiers'), reward: { gold: 1500 } },
      { kind: 'hold', places: ['Rome'], text: tr('Le cheval de Saladin à Saint-Pierre : prendre Rome', 'Saladin\'s horse in St Peter\'s: take Rome'), reward: { gold: 4000, faith: 80 } },
    ],
    jerusalem: [
      { kind: 'keep', places: ['Jérusalem'], untilYear: 1188, text: tr('Balian tient bon : garder Jérusalem jusqu\'en 1188', 'Balian holds firm: keep Jerusalem until 1188'), reward: { gold: 2000, faith: 40 } },
      { kind: 'hold', places: ['Damas'], text: tr('Le rêve de Baudouin : prendre Damas', 'Baldwin\'s dream: take Damascus'), reward: { gold: 3000, faith: 60 } },
      { kind: 'hold', places: ['Le Caire'], text: tr('Amaury avait raison : prendre Le Caire', 'Amalric was right: take Cairo'), reward: { gold: 4000, faith: 60 } },
      { kind: 'tribute', text: tr('Le marquis prudent : payer tribut au Vieux de la Montagne', 'The prudent marquis: pay tribute to the Old Man of the Mountain'), reward: { gold: 500 } },
    ],
    angleterre: [
      { kind: 'hold', places: ['Jérusalem'], byYear: 1193, text: tr('Ce que Richard n\'a pas osé : prendre Jérusalem avant 1193', 'What Richard did not dare: take Jerusalem before 1193'), reward: { gold: 3000, faith: 80 } },
      { kind: 'hold', places: ['Paris'], text: tr('Le vassal qui voulait être roi : prendre Paris', 'The vassal who would be king: take Paris'), reward: { gold: 3000 } },
      { kind: 'hold', places: ['Messine'], byYear: 1191, text: tr('Les Grecs de Messine : prendre Messine avant 1191', 'The Greeks of Messina: take Messina before 1191'), reward: { gold: 1500 } },
      { kind: 'noCapture', untilYear: 1194, text: tr('Pas de Dürnstein : que Richard ne soit jamais capturé', 'No Dürnstein: Richard must never be captured'), reward: { faith: 50 } },
    ],
    france: [
      { kind: 'hold', places: ['Londres'], text: tr('Louis le Lion avant l\'heure : prendre Londres', 'Louis the Lion ahead of time: take London'), reward: { gold: 3000, faith: 40 } },
      { kind: 'hold', places: ['Rouen'], byYear: 1195, text: tr('Sans attendre la mort de Richard : prendre Rouen avant 1195', 'Without waiting for Richard\'s death: take Rouen before 1195'), reward: { gold: 2500 } },
      { kind: 'hold', places: ['Toulouse', 'Bordeaux'], text: tr('Le Midi capétien : tenir Toulouse et prendre Bordeaux', 'The Capetian South: hold Toulouse and take Bordeaux'), reward: { gold: 2000 } },
      { kind: 'gold', n: 8000, text: tr('Le trésor du Temple : amasser 8 000 pièces d\'or', 'The treasure of the Temple: hoard 8,000 gold'), reward: { faith: 40 } },
    ],
    empire: [
      { kind: 'saleph', byYear: 1190.5, text: tr('Le pont de Séleucie : que Barberousse ne se noie pas', 'The bridge of Seleucia: Barbarossa must not drown'), reward: { gold: 2000, faith: 60 } },
      { kind: 'hold', places: ['Constantinople'], text: tr('Ce que Barberousse n\'a pas osé : prendre Constantinople', 'What Barbarossa did not dare: take Constantinople'), reward: { gold: 3000 } },
      { kind: 'hold', places: ['Jérusalem'], text: tr('Comme Frédéric II, avec 40 ans d\'avance : prendre Jérusalem', 'Like Frederick II, 40 years early: take Jerusalem'), reward: { gold: 3000, faith: 80 } },
      { kind: 'army', n: 10000, text: tr('La plus grande armée de croisade : réunir 10 000 soldats', 'The greatest crusading army: gather 10,000 soldiers'), reward: { gold: 1500 } },
    ],
    byzance: [
      { kind: 'keep', places: ['Constantinople'], untilYear: 1204.3, text: tr('Le sac n\'aura pas lieu : garder Constantinople jusqu\'en avril 1204', 'The sack will not happen: keep Constantinople until April 1204'), reward: { gold: 3000, faith: 80 } },
      { kind: 'hold', places: ['Venise'], text: tr('La revanche de 1171 : prendre Venise', 'The revenge of 1171: take Venice'), reward: { gold: 3000 } },
      { kind: 'hold', places: ['Jérusalem'], text: tr('Le basileus au Saint-Sépulcre : prendre Jérusalem', 'The basileus at the Holy Sepulchre: take Jerusalem'), reward: { gold: 3000, faith: 60 } },
      { kind: 'level', n: 4, text: tr('Sainte-Sophie rayonne : une ville de niveau 4', 'Hagia Sophia shines: a level 4 city'), reward: { faith: 40 } },
    ],
    venise: [
      { kind: 'gold', n: 15000, text: tr('85 000 marcs d\'argent : amasser 15 000 pièces d\'or', '85,000 silver marks: hoard 15,000 gold'), reward: { faith: 40 } },
      { kind: 'hold', places: ['Alexandrie'], text: tr('Les épices d\'Alexandrie : prendre Alexandrie', 'The spices of Alexandria: take Alexandria'), reward: { gold: 2500 } },
      { kind: 'count', b: 'port', n: 8, text: tr('La reine des mers : avoir 8 ports', 'Queen of the seas: own 8 ports'), reward: { gold: 2000 } },
      { kind: 'hold', places: ['Constantinople'], byYear: 1200, text: tr('Dandolo pressé : prendre Constantinople avant 1200', 'Dandolo in a hurry: take Constantinople before 1200'), reward: { gold: 4000 } },
    ],
  },

  // Les factions de 1187 (l'ordre compte : une case va à la première dont un contour la contient)
  factions: [
    {
      id: 'assassins', name: tr('Assassins', 'Assassins'), leader: tr('Rachid ad-Din Sinan, le Vieux de la Montagne', 'Rashid ad-Din Sinan, the Old Man of the Mountain'), flag: 'cr_assassins', color: [90, 20, 24],
      defensive: true, garrison: 4, camp: 'musulmans',
      capital: [36.42, 35.32, tr('Masyaf', 'Masyaf'), 'Masyaf'], capitalLevel: 2, cities: [], churches: [],
      lands: [[[36.15, 34.95], [36.55, 34.95], [36.55, 35.45], [36.15, 35.45]]],
      desc: tr('Les forteresses des Ismaéliens nizarites : on les paie, ou on les craint.', 'The fortresses of the Nizari Ismailis: one pays them, or one fears them.'),
    },
    {
      id: 'chypre', name: tr('Chypre', 'Cyprus'), leader: tr('le despote Isaac Comnène', 'the despot Isaac Comnenus'), flag: 'cr_chypre', color: [156, 199, 228],
      defensive: true, camp: 'chretiens',
      capital: [33.36, 35.17, tr('Nicosie', 'Nicosia'), 'Nicosie'], cities: [],
      churches: [[33.04, 34.68, tr('Limassol', 'Limassol'), 'Limassol']],
      lands: [[[32.2, 34.5], [34.7, 34.5], [34.7, 35.75], [32.2, 35.75]]],
      desc: tr('Un usurpateur byzantin qui règne seul sur son île.', 'A Byzantine usurper who reigns alone over his island.'),
    },
    {
      id: 'jerusalem', name: tr('Royaume de Jérusalem', 'Kingdom of Jerusalem'), leader: tr('le marquis Conrad de Montferrat', 'Marquis Conrad of Montferrat'), flag: 'cr_jerusalem', color: [238, 237, 230],
      playable: true, camp: 'chretiens', hard: true,
      capital: [35.20, 33.27, tr('Tyr', 'Tyre'), 'Tyr', { garrison: 6 }], capitalLevel: 2,
      cities: [[35.23, 31.78, tr('Jérusalem', 'Jerusalem'), 'Jérusalem', { level: 3, garrison: 0.6 }], [34.57, 31.67, tr('Ascalon', 'Ascalon'), 'Ascalon'],
        [35.70, 31.18, tr('Kérak', 'Kerak'), 'Kérak', { garrison: 2 }]],
      churches: [[35.56, 30.53, tr('Montréal', 'Montréal'), 'Montréal']],
      lands: [
        [[35.12, 33.12], [35.42, 33.12], [35.45, 33.43], [35.15, 33.43]],                                                 // Tyr
        [[34.38, 31.45], [34.5, 31.95], [35.0, 31.95], [35.35, 31.9], [35.55, 31.75], [35.45, 31.5], [35.0, 31.35], [34.6, 31.38]], // Judée
        [[35.45, 30.35], [35.6, 31.45], [36.05, 31.45], [36.0, 30.35]],                                                    // Oultrejordain
      ],
      desc: tr('Après Hattin, il ne reste du royaume que quelques villes isolées. La faction la plus difficile !', 'After Hattin, only a few isolated cities remain of the kingdom. The hardest faction!'),
    },
    {
      id: 'antioche', name: tr('Antioche et Tripoli', 'Antioch and Tripoli'), leader: tr('le prince Bohémond III', 'Prince Bohemond III'), flag: 'cr_antioche', color: [168, 50, 110],
      defensive: true, camp: 'chretiens',
      capital: [36.16, 36.20, tr('Antioche', 'Antioch'), 'Antioche', { garrison: 2 }], capitalLevel: 3,
      cities: [[35.84, 34.44, tr('Tripoli', 'Tripoli'), 'Tripoli', { level: 2 }], [36.29, 34.76, tr('Krak des Chevaliers', 'Krak des Chevaliers'), 'Krak des Chevaliers', { level: 2, garrison: 4 }],
        [35.78, 35.52, tr('Lattaquié', 'Latakia'), 'Lattaquié']],
      churches: [[35.89, 34.89, tr('Tortose', 'Tortosa'), 'Tortose']],
      lands: [[[35.7, 34.2], [36.45, 34.2], [36.45, 34.95], [36.15, 34.95], [36.15, 35.3], [36.5, 35.45], [36.75, 36.05], [36.6, 36.55],
        [36.2, 36.75], [35.9, 36.5], [35.7, 35.5]]],
      desc: tr('La principauté d\'Antioche et le comté de Tripoli, avec les forteresses des Hospitaliers et des Templiers.', 'The principality of Antioch and the county of Tripoli, with the fortresses of the Hospitallers and the Templars.'),
    },
    {
      id: 'armenie', name: tr('Arménie', 'Armenia'), leader: tr('le prince Léon II', 'Prince Leo II'), flag: 'cr_armenie', color: [214, 74, 42],
      defensive: true, camp: 'chretiens',
      capital: [35.82, 37.45, tr('Sis', 'Sis'), 'Sis', { garrison: 2 }], cities: [[34.90, 36.92, tr('Tarse', 'Tarsus'), 'Tarse']],
      churches: [[33.93, 36.38, tr('Séleucie (le Saleph)', 'Seleucia (the Saleph)'), 'Séleucie']],
      lands: [[[33.6, 36.1], [34.6, 36.5], [35.6, 36.55], [36.15, 36.75], [36.4, 37.2], [36.6, 37.7], [35.5, 37.9], [34.0, 37.4], [33.4, 37.0]]],
      desc: tr('Les Arméniens de Cilicie, dans leurs montagnes du Taurus.', 'The Armenians of Cilicia, in their Taurus mountains.'),
    },
    {
      id: 'ayyoubides', name: tr('Ayyoubides', 'Ayyubids'), leader: tr('le sultan Saladin', 'Sultan Saladin'), flag: 'cr_ayyoubides', color: [224, 138, 30],
      playable: true, camp: 'musulmans', production: true,
      capital: [36.29, 33.51, tr('Damas', 'Damascus'), 'Damas'], capitalLevel: 3,
      cities: [[31.24, 30.04, tr('Le Caire', 'Cairo'), 'Le Caire', { level: 3 }], [29.92, 31.20, tr('Alexandrie', 'Alexandria'), 'Alexandrie'],
        [37.16, 36.20, tr('Alep', 'Aleppo'), 'Alep', { level: 2 }], [35.07, 32.93, tr('Acre', 'Acre'), 'Acre', { level: 2, garrison: 2 }],
        [34.75, 32.05, tr('Jaffa', 'Jaffa'), 'Jaffa'], [43.13, 36.34, tr('Mossoul', 'Mosul'), 'Mossoul']],
      churches: [[35.5, 32.76, tr('Cornes de Hattin', 'Horns of Hattin'), 'Hattin'], [36.55, 33.25, tr('Trésor de Damas', 'Treasury of Damascus'), 'Vraie Croix'],
        [31.81, 31.42, tr('Damiette', 'Damietta'), 'Damiette']],
      lands: [[[27.0, 29.0], [27.0, 31.3], [29.0, 31.2], [31.0, 31.7], [32.5, 31.2], [34.0, 31.3], [34.3, 32.5], [34.7, 33.5], [35.3, 34.2],
        [36.45, 34.2], [36.55, 34.95], [36.5, 35.45], [36.75, 36.05], [36.9, 36.6], [37.5, 36.95], [38.5, 37.25], [40.0, 37.35], [41.5, 37.4],
        [43.3, 37.3], [44.2, 36.6], [43.8, 35.6], [42.5, 35.0], [41.0, 34.4], [39.5, 33.4], [38.5, 32.5], [38.5, 29.0]]],
      desc: tr('Saladin, vainqueur de Hattin, maître de l\'Égypte et de la Syrie : Jérusalem est à portée de sa main.', 'Saladin, victor of Hattin, master of Egypt and Syria: Jerusalem is within his reach.'),
    },
    {
      // (l'Égypte d'al-Aziz : sans terres au départ ; elle naît à la mort de Saladin, voir crSuccession)
      id: 'egypte', name: tr('Égypte', 'Egypt'), leader: tr('le sultan al-Aziz', 'Sultan al-Aziz'), flag: 'cr_egypte', color: [125, 190, 154],
      dormant: true, camp: 'musulmans', lands: [], cities: [], churches: [],
      desc: '',
    },
    {
      id: 'roum', name: tr('Sultanat de Roum', 'Sultanate of Rum'), leader: tr('le sultan Kılıç Arslan II', 'Sultan Kılıç Arslan II'), flag: 'cr_roum', color: [30, 140, 140],
      camp: 'musulmans',
      capital: [32.49, 37.87, tr('Konya', 'Konya'), 'Konya'], capitalLevel: 3,
      cities: [[35.49, 38.72, tr('Kayseri', 'Kayseri'), 'Kayseri', { level: 2 }], [32.86, 39.93, tr('Ankara', 'Ankara'), 'Ankara']],
      churches: [],
      lands: [[[30.3, 38.0], [30.8, 37.0], [32.0, 36.7], [33.4, 36.95], [34.0, 37.4], [35.5, 37.9], [36.6, 37.7], [37.5, 37.0], [38.5, 37.3],
        [40.0, 37.5], [41.2, 38.5], [41.0, 40.1], [39.0, 40.3], [37.0, 40.6], [35.0, 40.9], [33.0, 40.9], [31.5, 40.2], [30.5, 39.3]]],
      desc: tr('Les Turcs seldjoukides d\'Anatolie, sur la route de terre des croisés.', 'The Seljuk Turks of Anatolia, on the crusaders\' land route.'),
    },
    {
      id: 'byzance', name: tr('Byzance', 'Byzantium'), leader: tr('l\'empereur Isaac II Ange', 'Emperor Isaac II Angelos'), flag: 'cr_byzance', color: [106, 44, 145],
      playable: true, camp: 'chretiens', production: true,
      capital: [28.98, 41.01, tr('Constantinople', 'Constantinople'), 'Constantinople', { garrison: 2 }], capitalLevel: 4,
      cities: [[22.94, 40.64, tr('Thessalonique', 'Thessalonica'), 'Thessalonique', { level: 2 }], [26.56, 41.68, tr('Andrinople', 'Adrianople'), 'Andrinople'],
        [29.72, 40.43, tr('Nicée', 'Nicaea'), 'Nicée'], [23.73, 37.98, tr('Athènes', 'Athens'), 'Athènes'], [25.13, 35.34, tr('Candie', 'Candia'), 'Candie'],
        [30.71, 36.89, tr('Attalia', 'Attalia'), 'Attalia'], [39.72, 41.00, tr('Trébizonde', 'Trebizond'), 'Trébizonde']],
      churches: [[24.75, 42.15, tr('Philippopolis', 'Philippopolis'), 'Philippopolis'], [24.25, 40.16, tr('Mont Athos', 'Mount Athos'), 'Mont Athos']],
      lands: [
        [[26.0, 36.6], [26.0, 40.6], [29.0, 40.9], [29.6, 41.25], [31.5, 41.4], [33.0, 42.1], [35.0, 42.2], [37.0, 41.4], [39.0, 41.2], [41.5, 41.6],
          [41.6, 40.7], [39.0, 40.6], [37.0, 40.8], [35.0, 41.05], [33.0, 41.05], [31.5, 40.35], [30.5, 39.3], [30.2, 38.0], [30.6, 37.0], [30.0, 36.5], [28.0, 36.4]],
        [[19.4, 39.5], [19.9, 41.9], [21.0, 42.3], [22.5, 42.35], [24.0, 42.5], [25.0, 42.6], [27.3, 42.7], [28.1, 42.0], [29.15, 41.3], [29.1, 40.9],
          [27.0, 40.45], [26.2, 40.05], [24.5, 40.0], [24.2, 37.5], [23.5, 36.3], [21.0, 36.3], [19.4, 38.5]],
        [[23.4, 34.8], [26.4, 34.8], [26.4, 35.75], [23.4, 35.75]],
      ],
      desc: tr('L\'Empire romain d\'Orient, riche mais déchiré. Une faction difficile.', 'The Eastern Roman Empire, rich but torn apart. A difficult faction.'),
    },
    {
      id: 'bulgarie', name: tr('Bulgarie', 'Bulgaria'), leader: tr('les tsars Assen et Pierre', 'Tsars Asen and Peter'), flag: 'cr_bulgarie', color: [138, 90, 43],
      camp: 'chretiens',
      capital: [25.63, 43.08, tr('Tarnovo', 'Tarnovo'), 'Tarnovo', { garrison: 2 }], cities: [],
      churches: [[26.82, 43.16, tr('Preslav', 'Preslav'), 'Preslav']],
      lands: [[[22.4, 42.9], [22.6, 44.2], [24.0, 43.75], [25.5, 43.7], [27.0, 44.15], [28.6, 44.3], [28.6, 43.0], [27.6, 42.5], [25.0, 42.65],
        [24.0, 42.55], [22.5, 42.45]]],
      desc: tr('Les Bulgares révoltés contre Byzance depuis 1185.', 'The Bulgarians in revolt against Byzantium since 1185.'),
    },
    {
      id: 'serbie', name: tr('Serbie', 'Serbia'), leader: tr('le grand joupan Étienne Nemanja', 'Grand Župan Stefan Nemanja'), flag: 'cr_serbie', color: [107, 122, 143],
      defensive: true, slowAI: 3, camp: 'chretiens',
      capital: [20.52, 43.14, tr('Ras', 'Ras'), 'Ras'], cities: [[21.90, 43.32, tr('Niš', 'Niš'), 'Niš']], churches: [],
      lands: [[[18.9, 42.5], [19.3, 43.6], [19.6, 44.4], [20.6, 44.6], [21.6, 44.5], [22.6, 44.2], [22.4, 42.9], [22.5, 42.45], [21.0, 42.3], [19.9, 41.9]]],
      desc: '',
    },
    {
      id: 'venise', name: tr('Venise', 'Venice'), leader: tr('le doge Orio Mastropiero', 'Doge Orio Mastropiero'), flag: 'cr_venise', color: [139, 26, 58],
      playable: true, camp: 'chretiens', production: true,
      capital: [12.33, 45.44, tr('Venise', 'Venice'), 'Venise', { garrison: 2 }], capitalLevel: 3,
      cities: [[13.85, 44.87, tr('Pola', 'Pola'), 'Pola']], churches: [],
      // (la lagune et la terre ferme de Trévise et Padoue, l'Istrie)
      lands: [[[11.4, 44.95], [11.5, 45.8], [12.4, 46.1], [13.2, 46.0], [13.7, 45.75], [14.3, 45.35], [14.2, 44.75], [13.75, 44.7], [13.3, 45.3], [12.5, 44.85]]],
      desc: tr('Peu de terres, beaucoup d\'or et de navires : la croisade passera par toi.', 'Little land, plenty of gold and ships: the crusade will go through you.'),
    },
    {
      id: 'hongrie', name: tr('Hongrie', 'Hungary'), leader: tr('le roi Béla III', 'King Béla III'), flag: 'cr_hongrie', color: [92, 158, 63],
      camp: 'chretiens',
      capital: [18.74, 47.79, tr('Esztergom', 'Esztergom'), 'Esztergom'], capitalLevel: 3,
      cities: [[15.23, 44.12, tr('Zara', 'Zara'), 'Zara', { level: 2, garrison: 3 }], [20.46, 44.82, tr('Belgrade', 'Belgrade'), 'Belgrade']],
      churches: [[17.76, 47.55, tr('Pannonhalma', 'Pannonhalma'), 'Pannonhalma']],
      lands: [[[13.7, 45.3], [14.2, 46.3], [16.1, 46.5], [16.3, 47.7], [17.1, 48.0], [18.8, 48.3], [20.0, 48.5], [22.0, 48.5], [24.0, 48.0],
        [25.5, 47.4], [26.5, 46.5], [26.2, 45.4], [24.0, 45.4], [22.6, 44.5], [20.6, 44.6], [19.6, 44.4], [19.3, 43.6], [18.9, 42.5], [17.5, 43.0],
        [16.0, 43.4], [15.0, 44.0], [14.4, 44.9]]],
      desc: '',
    },
    {
      id: 'papaute', name: tr('Papauté', 'Papacy'), leader: tr('le pape Grégoire VIII', 'Pope Gregory VIII'), flag: 'cr_papaute', color: [237, 216, 143],
      defensive: true, noArmy: true, production: true, garrison: 3, camp: 'chretiens',
      capital: [12.48, 41.90, tr('Rome', 'Rome'), 'Rome'], capitalLevel: 4, cities: [], churches: [],
      lands: [[[11.6, 42.3], [12.3, 42.55], [12.15, 43.2], [12.3, 43.9], [12.7, 43.95], [13.65, 43.6], [13.9, 42.9], [14.1, 42.2], [13.5, 41.6],
        [12.9, 41.4], [12.4, 41.6], [11.6, 42.2]]],
      desc: '',
    },
    {
      id: 'sicile', name: tr('Sicile', 'Sicily'), leader: tr('le roi Guillaume II le Bon', 'King William II the Good'), flag: 'cr_sicile', color: [61, 139, 201],
      camp: 'chretiens',
      capital: [13.36, 38.12, tr('Palerme', 'Palermo'), 'Palerme'], capitalLevel: 3,
      cities: [[15.55, 38.19, tr('Messine', 'Messina'), 'Messine'], [14.27, 40.85, tr('Naples', 'Naples'), 'Naples', { level: 2 }], [16.87, 41.12, tr('Bari', 'Bari'), 'Bari']],
      churches: [[13.81, 41.49, tr('Mont-Cassin', 'Monte Cassino'), 'Mont-Cassin']],
      lands: [[[12.2, 36.5], [15.8, 36.5], [15.8, 38.3], [16.0, 38.6], [16.2, 39.4], [16.6, 40.0], [17.0, 40.5], [18.6, 40.1], [18.6, 40.7], [17.0, 41.2],
        [16.0, 41.9], [15.0, 42.0], [14.2, 42.2], [13.5, 41.6], [13.0, 41.2], [12.2, 38.4]]],
      desc: '',
    },
    {
      id: 'empire', name: tr('Saint-Empire', 'Holy Roman Empire'), leader: tr('l\'empereur Frédéric Barberousse', 'Emperor Frederick Barbarossa'), flag: 'cr_empire', color: [226, 185, 43],
      playable: true, camp: 'chretiens', production: true,
      capital: [12.10, 49.02, tr('Ratisbonne', 'Regensburg'), 'Ratisbonne'], capitalLevel: 3,
      cities: [[6.96, 50.94, tr('Cologne', 'Cologne'), 'Cologne', { level: 2 }], [9.19, 45.46, tr('Milan', 'Milan'), 'Milan', { level: 2 }],
        [16.37, 48.21, tr('Vienne', 'Vienna'), 'Vienne'], [14.42, 50.08, tr('Prague', 'Prague'), 'Prague']],
      churches: [[6.08, 50.78, tr('Aix-la-Chapelle', 'Aachen'), 'Aix-la-Chapelle'], [8.27, 50.00, tr('Mayence', 'Mainz'), 'Mayence'],
        [15.52, 48.39, tr('Dürnstein', 'Dürnstein'), 'Dürnstein']],
      lands: [[[4.5, 43.2], [4.6, 44.5], [4.7, 45.5], [4.75, 46.2], [5.2, 47.2], [5.5, 47.7], [5.8, 48.3], [5.4, 49.0], [5.0, 49.5], [4.4, 50.0],
        [3.6, 50.3], [4.0, 50.7], [4.3, 51.3], [4.5, 52.6], [5.0, 53.5], [5.0, 54.0], [15.0, 54.0], [15.0, 52.6], [14.6, 51.5], [15.0, 50.8],
        [16.4, 50.4], [16.9, 49.5], [17.1, 48.5], [16.3, 47.7], [16.1, 46.5], [14.2, 46.3], [13.7, 45.75], [13.0, 45.9], [12.2, 45.7], [12.0, 45.1],
        [12.5, 44.9], [12.3, 43.9], [12.15, 43.2], [12.3, 42.55], [11.6, 42.3], [11.2, 42.4], [10.3, 43.4], [8.8, 44.4], [7.5, 43.78], [7.0, 43.5],
        [6.0, 43.0]]],
      desc: tr('Le vieil empereur Barberousse et la plus grande armée de croisade jamais levée.', 'The old Emperor Barbarossa and the greatest crusading army ever raised.'),
    },
    {
      id: 'france', name: tr('France', 'France'), leader: tr('le roi Philippe Auguste', 'King Philip Augustus'), flag: 'cr_france', color: [31, 63, 166],
      playable: true, camp: 'chretiens', production: true,
      capital: [2.35, 48.86, tr('Paris', 'Paris'), 'Paris'], capitalLevel: 3,
      cities: [[4.03, 49.26, tr('Reims', 'Reims'), 'Reims'], [2.40, 47.08, tr('Bourges', 'Bourges'), 'Bourges'],
        [1.44, 43.60, tr('Toulouse', 'Toulouse'), 'Toulouse']],
      churches: [[3.75, 47.47, tr('Vézelay', 'Vézelay'), 'Vézelay'], [4.66, 46.43, tr('Cluny', 'Cluny'), 'Cluny']],
      lands: [[[1.4, 50.1], [1.6, 50.6], [1.9, 51.0], [2.5, 51.1], [3.2, 51.4], [4.3, 51.3], [4.0, 50.7], [3.6, 50.3], [4.4, 50.0], [5.0, 49.5],
        [5.4, 49.0], [5.8, 48.3], [5.5, 47.7], [5.2, 47.2], [4.75, 46.2], [4.7, 45.5], [4.6, 44.5], [4.5, 43.2], [3.2, 42.9], [3.05, 42.45],
        [1.5, 42.55], [0.6, 42.7], [0.6, 43.4], [0.9, 44.1], [1.6, 44.6], [2.1, 45.4], [2.4, 46.4], [2.2, 47.0], [1.3, 47.6], [1.45, 48.4], [1.6, 49.2]]],
      desc: tr('Le jeune roi Philippe Auguste, au royaume encore petit face aux Plantagenêts.', 'The young King Philip Augustus, whose kingdom is still small next to the Plantagenets.'),
    },
    {
      id: 'angleterre', name: tr('Angleterre', 'England'), leader: tr('le roi Henri II, puis Richard Cœur de Lion', 'King Henry II, then Richard the Lionheart'), flag: 'cr_angleterre', color: [200, 16, 46],
      playable: true, camp: 'chretiens', production: true,
      capital: [-0.12, 51.51, tr('Londres', 'London'), 'Londres'], capitalLevel: 3,
      cities: [[1.10, 49.44, tr('Rouen', 'Rouen'), 'Rouen', { level: 2 }], [0.34, 46.58, tr('Poitiers', 'Poitiers'), 'Poitiers', { level: 2 }],
        [-0.58, 44.84, tr('Bordeaux', 'Bordeaux'), 'Bordeaux', { level: 2 }], [-1.68, 48.11, tr('Rennes', 'Rennes'), 'Rennes'],
        [1.26, 45.83, tr('Limoges', 'Limoges'), 'Limoges']],
      churches: [[1.08, 51.28, tr('Cantorbéry', 'Canterbury'), 'Cantorbéry'], [0.05, 47.18, tr('Fontevraud', 'Fontevraud'), 'Fontevraud']],
      lands: [
        [[-6.2, 49.8], [-6.2, 54.0], [2.0, 54.0], [2.0, 50.5]],
        [[1.4, 50.1], [1.6, 49.2], [1.45, 48.4], [1.3, 47.6], [2.2, 47.0], [2.4, 46.4], [2.1, 45.4], [1.6, 44.6], [0.9, 44.1], [0.6, 43.4],
          [0.6, 42.7], [-0.5, 42.8], [-1.8, 43.3], [-1.6, 43.7], [-1.3, 44.5], [-1.2, 45.6], [-1.6, 46.2], [-2.3, 47.1], [-4.8, 47.6], [-5.0, 48.6],
          [-3.5, 49.0], [-1.9, 49.8], [-1.2, 49.8], [0.2, 49.6], [1.0, 50.0]],
      ],
      desc: tr('L\'empire Plantagenêt, de l\'Angleterre aux Pyrénées. Richard sera bientôt roi…', 'The Plantagenet empire, from England to the Pyrenees. Richard will soon be king…'),
    },
    {
      id: 'espagne', name: tr('Castille', 'Castile'), leader: tr('le roi Alphonse VIII', 'King Alfonso VIII'), flag: 'cr_espagne', color: [210, 112, 42],
      defensive: true, slowAI: 3, camp: 'chretiens',
      capital: [-4.02, 39.86, tr('Tolède', 'Toledo'), 'Tolède'], cities: [[2.17, 41.39, tr('Barcelone', 'Barcelona'), 'Barcelone']], churches: [],
      lands: [[[-6.5, 38.8], [-6.5, 43.9], [-1.8, 43.4], [-0.5, 42.8], [0.6, 42.7], [1.5, 42.55], [3.05, 42.45], [3.4, 41.8], [2.0, 41.0],
        [0.6, 40.3], [-0.3, 39.5], [-2.0, 38.8]]],
      desc: '',
    },
    {
      id: 'almohades', name: tr('Almohades', 'Almohads'), leader: tr('le calife Abu Yusuf Yaqub', 'Caliph Abu Yusuf Yaqub'), flag: 'cr_almohades', color: [31, 122, 77],
      defensive: true, slowAI: 3, camp: 'musulmans',
      capital: [-4.78, 37.89, tr('Cordoue', 'Córdoba'), 'Cordoue'], cities: [[-4.98, 34.03, tr('Fès', 'Fez'), 'Fès'], [10.18, 36.80, tr('Tunis', 'Tunis'), 'Tunis']],
      churches: [],
      // (al-Andalus et le Maghreb, jusqu'au Sahara)
      lands: [[[-6.5, 31.0], [-6.5, 38.8], [-2.0, 38.8], [-0.3, 39.5], [0.6, 38.8], [0.0, 37.5], [-2.0, 36.6], [3.0, 37.0], [8.0, 37.3], [11.0, 37.3],
        [11.5, 35.0], [11.5, 32.5], [8.0, 32.0], [2.0, 31.0]]],
      desc: '',
    },
    {
      id: 'abbassides', name: tr('Califat abbasside', 'Abbasid Caliphate'), leader: tr('le calife an-Nasir', 'Caliph an-Nasir'), flag: 'cr_abbassides', color: [43, 42, 46],
      defensive: true, slowAI: 3, camp: 'musulmans', garrison: 3,
      capital: [44.37, 33.31, tr('Bagdad', 'Baghdad'), 'Bagdad'], capitalLevel: 3, cities: [], churches: [],
      lands: [[[42.5, 35.0], [43.8, 35.6], [44.2, 36.6], [45.5, 36.5], [48.5, 35.5], [48.5, 29.0], [38.5, 29.0], [39.5, 33.4], [41.0, 34.4]]],
      desc: '',
    },
    {
      id: 'georgie', name: tr('Géorgie', 'Georgia'), leader: tr('la reine Thamar', 'Queen Tamar'), flag: 'cr_georgie', color: [238, 201, 194],
      defensive: true, slowAI: 3, camp: 'chretiens',
      capital: [44.79, 41.72, tr('Tbilissi', 'Tbilisi'), 'Tbilissi'], cities: [], churches: [],
      lands: [[[40.0, 41.4], [41.6, 41.6], [42.5, 42.5], [44.0, 43.0], [46.5, 42.3], [47.5, 41.6], [46.5, 40.9], [45.0, 40.9], [43.4, 41.0], [42.0, 41.0],
        [41.5, 40.6], [40.0, 40.8]]],
      desc: '',
    },
    {
      id: 'pologne', name: tr('Pologne', 'Poland'), leader: tr('le duc Casimir le Juste', 'Duke Casimir the Just'), flag: 'cr_pologne', color: [224, 122, 122],
      defensive: true, slowAI: 3, camp: 'chretiens',
      capital: [19.94, 50.06, tr('Cracovie', 'Kraków'), 'Cracovie'], cities: [], churches: [],
      lands: [[[15.0, 54.0], [24.0, 54.0], [24.0, 50.3], [22.5, 49.3], [20.0, 49.4], [18.8, 49.5], [17.1, 49.9], [16.9, 49.5], [16.4, 50.4],
        [15.0, 50.8], [14.6, 51.5], [15.0, 52.6]]],
      desc: '',
    },
    {
      id: 'rus', name: tr('Rus\' de Kiev', 'Kievan Rus\''), leader: tr('le grand-prince Sviatoslav', 'Grand Prince Sviatoslav'), flag: 'cr_rus', color: [74, 111, 165],
      defensive: true, slowAI: 3, camp: 'chretiens',
      capital: [30.52, 50.45, tr('Kiev', 'Kyiv'), 'Kiev'], cities: [], churches: [],
      lands: [[[24.0, 54.0], [40.0, 54.0], [40.0, 49.5], [36.0, 49.5], [33.0, 49.0], [30.0, 48.6], [28.0, 48.6], [26.5, 48.3], [25.5, 47.9],
        [24.0, 48.0], [22.5, 49.3], [24.0, 50.3]]],
      desc: '',
    },
    {
      // ⚔️ Les Coumans des steppes : leurs terres sont imprenables, ils ne s'étendent pas, mais razzient leurs voisins
      // (les Bulgares, Byzance, les Rus' : voir RAIDS)
      id: 'coumans', name: tr('Coumans', 'Cumans'), leader: tr('les khans coumans', 'the Cuman khans'), flag: 'cr_coumans', color: [184, 162, 117],
      raiders: true, noArmy: true, camp: null,
      capital: [34.97, 44.85, tr('Soudak', 'Sudak'), 'Soudak'], cities: [], churches: [],
      lands: [[[22.6, 44.3], [24.0, 45.4], [26.2, 45.4], [26.5, 46.5], [25.5, 47.9], [26.5, 48.3], [28.0, 48.6], [30.0, 48.6], [33.0, 49.0],
        [36.0, 49.5], [48.5, 49.5], [48.5, 44.5], [45.0, 44.7], [42.0, 44.3], [39.5, 44.0], [37.5, 45.0], [36.6, 45.4], [35.5, 44.3], [33.6, 44.3],
        [33.0, 46.1], [30.6, 46.5], [29.7, 45.2], [28.6, 44.3], [27.0, 44.15], [25.5, 43.7], [24.0, 43.75], [22.6, 44.2]]],
      desc: '',
    },
  ],
  // ⚔️ Les razzias des Coumans : comme les Slaves de Charlemagne (voir RAIDS dans charlemagne.js)
  RAIDS: { FIRST: 240, EVERY: { facile: 200, normal: 150, difficile: 110 }, ARMY: { facile: 400, normal: 600, difficile: 800 },
    GROWTH: 0.15, MAX: 3500, LOOT: 120 },
};

// Les bannières des factions : leur vraie bannière (cr_…, la hampe au milieu : foot 0.5), avec la couleur du royaume
for (const f of CROISADES.factions) {
  BANNERS.push({ id: f.id, name: f.name, kingdom: f.name, set: 'croisades', color: f.color, foot: f.foot ?? (f.flag.startsWith('cr_') ? 0.5 : undefined),
    img: `img/bannieres/${f.flag}.webp`, icon: `img/bannieres/${f.flag}s.webp`, logo: `img/bannieres/${f.flag}m.webp` });
}
