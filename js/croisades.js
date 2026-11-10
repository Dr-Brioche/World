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
  // (v0.98.66 : chaque année dure 30 % de plus qu'avant : 27 → 35 et 50 → 65 minutes)
  CALENDAR: [[0, 1187.5], [35.1, 1193.25], [65, 1204.3]],
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
  // ✠ Les ordres militaires (Templiers et Hospitaliers, voir ordres.js) :
  //  - les chevaliers : à partir de HELP_FROM (ils ont été décimés à Hattin), quand un allié d'un ordre est attaqué par
  //    l'islam, l'ordre le plus fort (un bot) lui envoie HELP_SHARE de ses soldats (s'il en a au moins HELP_MIN), au plus
  //    une fois toutes les HELP_EVERY secondes ; les deux ordres se jalousent : un seul secourt le même royaume à la
  //    fois, et jamais l'autre ordre ;
  //  - 🏦 la banque du Temple : un royaume chrétien emprunte LOAN pièces aux Templiers (clic droit sur leurs terres ; un
  //    joueur templier prête son propre or, des Templiers bots celui des commanderies d'Occident) et rend
  //    LOAN × (1 + INTEREST), en REPAY_TIME secondes environ (une part égale chaque seconde, s'il a l'or) ; un bot
  //    chrétien à court d'or (moins de AI_LOAN_GOLD) emprunte parfois (toutes les AI_LOAN_EVERY secondes) ; le Temple
  //    commence avec TEMPLE_GOLD pièces ;
  //  - Saladin les hait : la paix de Jaffa ne les protège pas, et son IA les vise SALADIN_HATE fois plus ;
  //  - les Assassins ne peuvent rien contre eux, et versent ASSASSIN_GOLD pièces par seconde aux Templiers ;
  //  - leurs recrues viennent de toutes les commanderies d'Occident : armée maximum et recrutement ARMY fois plus
  //    grands que leurs petites terres ne le permettraient, et des chevaliers POWER plus forts.
  ORDERS: { HELP_FROM: 1188, HELP_EVERY: 90, HELP_SHARE: 0.4, HELP_MIN: 150, LOAN: 2000, INTEREST: 0.25, REPAY_TIME: 180,
    AI_LOAN_EVERY: 150, AI_LOAN_GOLD: 300, TEMPLE_GOLD: 3000, SALADIN_HATE: 2, ASSASSIN_GOLD: 1, ARMY: 10, POWER: 0.25 },
  // ⚔️ Les mercenaires du Temple : un prince chrétien paie GOLD pièces aux Templiers (un joueur templier, lui, paie ses
  // commanderies d'Occident) et reçoit tout de suite TROOPS soldats, une fois toutes les COOLDOWN secondes au plus
  // (selon la difficulté : plus de soldats, moins cher, en Facile)
  MERCENARIES: { GOLD: { facile: 1500, normal: 2000, difficile: 2500 }, TROOPS: { facile: 1500, normal: 1200, difficile: 900 }, COOLDOWN: 300 },
  // 🏝️ Chypre : en SALE, Richard (s'il tient Nicosie) vend l'île aux Templiers pour PRICE pièces ; en REVOLT, les
  // Chypriotes se révoltent contre eux, et les Templiers la revendent (RESALE pièces) à Guy de Lusignan, l'ancien roi de
  // Jérusalem (elle va au royaume de Jérusalem) ; un joueur templier peut la garder, mais perd REVOLT_LOSS de ses
  // soldats. BOX : l'île, [longitude ouest, latitude sud, longitude est, latitude nord].
  CYPRUS: { SALE: 1191.5, REVOLT: 1192.25, PRICE: 2000, RESALE: 1500, REVOLT_LOSS: 0.3, BOX: [32.2, 34.5, 34.7, 35.75] },
  // ⛓️ Richard captif en Autriche (décembre 1192) : sa rançon (RANSOM pièces, selon la difficulté) se paie toute seule,
  // RANSOM_SHARE de l'or de l'Angleterre y part chaque seconde ; elle va à l'Empereur. Tant qu'elle n'est pas payée,
  // l'Angleterre recrute CAPTIVE fois moins vite.
  RANSOM: { facile: 1500, normal: 2500, difficile: 3500 }, RANSOM_SHARE: 0.5, CAPTIVE: 0.6,
  // 🧭 Le retour de Richard (octobre 1192, un parchemin pour le joueur anglais, juste avant la capture) :
  //  - par l'Autriche, déguisé (comme dans l'histoire) : il est pris, et c'est la rançon ci-dessus ;
  //  - par la mer, autour de l'Espagne : FLEET pièces (selon la difficulté) pour une flotte sûre ; pas de capture ;
  //  - rester en Terre sainte : pas de capture, mais son frère Jean intrigue en Angleterre : jusqu'en STAY_UNTIL,
  //    le royaume recrute STAY_RECRUIT fois moins vite.
  RETURN: { AT: 1192.85, FLEET: { facile: 800, normal: 1300, difficile: 1800 }, STAY_UNTIL: 1194, STAY_RECRUIT: 0.8 },
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
    saladinNorth: {
      who: ['templiers', 'ayyoubides'],
      date: tr('Septembre 1188', 'September 1188'),
      title: tr('Saladin en Syrie du Nord', 'Saladin in northern Syria'),
      text: tr('Saladin a renoncé devant le Krak des Chevaliers et devant le donjon de Tortose ; il remonte vers le nord avec {army} hommes, prend Lattaquié et Saône, puis met le siège devant Baghras, la forteresse du Temple qui garde les portes de Syrie.',
        'Saladin gave up before the Krak des Chevaliers and the keep of Tortosa; he marches north with {army} men, takes Latakia and Saone, then lays siege to Baghras, the Temple\'s fortress guarding the Syrian Gates.'),
      todo: tr('Baghras commande la route d\'Antioche : qui la tient tient le nord.', 'Baghras commands the road to Antioch: whoever holds it holds the north.'),
    },
    safedSiege: {
      who: ['templiers', 'ayyoubides'],
      date: tr('Novembre 1188', 'November 1188'),
      title: tr('Le siège de Safed', 'The siege of Safed'),
      text: tr('Malgré l\'hiver et la pluie, Saladin ne rentre pas à Damas : il assiège Safed, la grande forteresse du Temple en Galilée, avec {army} hommes. Ses mangonneaux battent les murs jour et nuit.',
        'Despite the winter and the rain, Saladin does not go home to Damascus: he besieges Safed, the Temple\'s great fortress in Galilee, with {army} men. His mangonels pound the walls day and night.'),
      todo: tr('Safed ne tiendra pas seule : il lui faut des défenseurs.', 'Safed will not hold alone: it needs defenders.'),
    },
    belvoirSiege: {
      who: ['hospitaliers', 'ayyoubides'],
      date: tr('Décembre 1188', 'December 1188'),
      title: tr('Le siège de Belvoir', 'The siege of Belvoir'),
      text: tr('Sur son éperon au-dessus du Jourdain, Belvoir, la forteresse de l\'Hôpital, résiste depuis un an et demi. Saladin vient en finir lui-même avec {army} hommes, et ses sapeurs creusent déjà sous les tours.',
        'On its spur above the Jordan, Belvoir, the fortress of the Hospital, has held out for a year and a half. Saladin comes to finish it himself with {army} men, and his sappers are already digging under the towers.'),
      todo: tr('Belvoir veille sur le Jourdain : qui la tient garde la porte de la Galilée.', 'Belvoir watches over the Jordan: whoever holds it guards the gate of Galilee.'),
    },
    cyprusSale: {
      who: ['angleterre'],
      date: tr('Juin 1191', 'June 1191'),
      title: tr('Que faire de Chypre ?', 'What to do with Cyprus?'),
      text: tr('Chypre est à toi, mais tu n\'as ni le temps ni les hommes pour la garder : Jérusalem t\'attend. Le grand maître du Temple, Robert de Sablé, ton vassal et ami, t\'offre {price} pièces d\'or pour l\'île entière. Ses chevaliers la tiendront à ta place.',
        'Cyprus is yours, but you have neither the time nor the men to keep it: Jerusalem awaits you. The Grand Master of the Temple, Robert de Sablé, your vassal and friend, offers you {price} gold for the whole island. His knights will hold it in your stead.'),
      todo: tr('Une île ne se défend pas toute seule… mais l\'or, lui, se dépense partout.', 'An island does not defend itself… but gold can be spent anywhere.'),
    },
    cyprusBuy: {
      who: ['templiers'],
      date: tr('Juin 1191', 'June 1191'),
      title: tr('Richard vend Chypre', 'Richard sells Cyprus'),
      text: tr('Le roi d\'Angleterre a pris Chypre en quelques jours, mais il ne veut pas s\'y attarder. Il propose de te la vendre : {price} pièces d\'or, et l\'île est au Temple, avec ses ports et ses moissons.',
        'The King of England took Cyprus in a few days, but he does not want to linger there. He offers to sell it to you: {price} gold, and the island belongs to the Temple, with its ports and its harvests.'),
      todo: tr('Les Chypriotes n\'aiment guère les moines-soldats : une île achetée n\'est pas une île soumise.', 'The Cypriots have little love for warrior monks: an island bought is not an island subdued.'),
    },
    cyprusRevolt: {
      who: ['templiers'],
      date: tr('Avril 1192', 'April 1192'),
      title: tr('Nicosie se révolte', 'Nicosia rises'),
      text: tr('Les Chypriotes se sont soulevés contre tes frères, trop peu nombreux et trop durs : la garnison de Nicosie a dû s\'enfermer dans le château. Guy de Lusignan, l\'ancien roi de Jérusalem, propose de racheter l\'île : {gold} pièces d\'or.',
        'The Cypriots have risen against your brothers, too few and too harsh: the garrison of Nicosia had to shut itself in the castle. Guy of Lusignan, the former King of Jerusalem, offers to buy back the island: {gold} gold.'),
      todo: tr('Garder Chypre coûtera du sang ; la rendre rapportera de l\'or.', 'Keeping Cyprus will cost blood; giving it up will bring gold.'),
    },
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
    // ⛵ Juillet 1190 : Richard et Philippe partent de Vézelay (un parchemin à choix pour le joueur : partir ou rester)
    richardCross: {
      who: ['angleterre'],
      date: tr('4 juillet 1190', '4 July 1190'),
      title: tr('Le départ de Vézelay', 'The departure from Vézelay'),
      text: tr('Pour payer sa croisade, Richard a tout vendu, charges, châteaux et villes : « je vendrais Londres, si je trouvais un acheteur ». Ses cent navires sont partis de Dartmouth faire le tour de l\'Espagne ; lui doit les retrouver à Marseille, avec Philippe Auguste. Mais le royaume reste sans roi, et son frère Jean guette la couronne.',
        'To pay for his crusade, Richard has sold everything, offices, castles and towns: "I would sell London, if I could find a buyer". His hundred ships have left Dartmouth to sail round Spain; he is to meet them at Marseille, with Philip Augustus. But the kingdom is left without a king, and his brother John has his eye on the crown.'),
      todo: tr('Qui part en croisade gagne la gloire de Dieu ; qui reste garde ses terres.', 'Whoever goes on crusade wins the glory of God; whoever stays keeps his lands.'),
    },
    philipCross: {
      who: ['france'],
      date: tr('4 juillet 1190', '4 July 1190'),
      title: tr('Le départ de Vézelay', 'The departure from Vézelay'),
      text: tr('À Vézelay, Philippe Auguste et Richard Cœur de Lion jurent de partir ensemble et de partager le butin. Les Génois ont promis des navires pour l\'armée de France. Mais le roi d\'Angleterre tient la moitié de ton royaume, de la Normandie à l\'Aquitaine : partir avec lui, c\'est lui laisser les mains libres… ou le tenir à l\'œil.',
        'At Vézelay, Philip Augustus and Richard the Lionheart swear to leave together and share the spoils. The Genoese have promised ships for the army of France. But the King of England holds half your kingdom, from Normandy to Aquitaine: going with him means leaving him a free hand… or keeping an eye on him.'),
      todo: tr('Un roi qui part est un roi qui revient… s\'il revient.', 'A king who leaves is a king who comes back… if he comes back.'),
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
    richardReturn: {
      who: ['angleterre'],
      date: tr('Octobre 1192', 'October 1192'),
      title: tr('Le retour du roi', 'The king\'s return'),
      text: tr('La paix est signée : il est temps de rentrer. Mais la route est pleine d\'ennemis. Philippe Auguste guette les côtes de France, et le duc Léopold d\'Autriche, que tu as humilié devant Acre en jetant sa bannière dans le fossé, n\'a rien oublié. Par où passeras-tu ?',
        'Peace is signed: it is time to go home. But the road is full of enemies. Philip Augustus watches the coasts of France, and Duke Leopold of Austria, whom you humiliated before Acre by throwing his banner into the ditch, has forgotten nothing. Which way will you go?'),
      todo: tr('Un roi qui se déguise n\'est plus protégé par sa couronne… Une flotte coûte cher, mais la mer n\'a pas de duc.',
        'A king in disguise is no longer protected by his crown… A fleet is costly, but the sea has no duke.'),
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
  // 📖 Ce qui change dans cette campagne : un parchemin au début de la partie (après le récit), pour toutes les
  // factions (all), puis ce qui est propre à la faction jouée (roles). Chaque ligne : [titre, explication].
  MECHANICS: {
    all: [
      [tr('📅 Le temps', '📅 Time'), tr('de juillet 1187 à 1204, en 65 minutes environ (l\'année est en haut). Les grands moments arrivent à leur date, sur un parchemin ; quand il y a un choix, celui de l\'histoire est marqué 📜.', 'from July 1187 to 1204, in about 65 minutes (the year is at the top). The great moments arrive on their date, on a parchment; when there is a choice, the historical one is marked 📜.')],
      [tr('🏰 Pas de nouvelle ville', '🏰 No new cities'), tr('on améliore les siennes et on prend celles des autres.', 'you upgrade your own and take other kingdoms\' cities.')],
      [tr('✝️ La Croyance', '✝️ Faith'), tr('elle ne convertit les terres qu\'entre chrétiens et musulmans (jamais entre deux rois chrétiens), et deux fois moins vite qu\'en partie classique.', 'it converts land only between Christians and Muslims (never between two Christian kings), and half as fast as in a classic game.')],
      [tr('📿 La Vraie Croix', '📿 The True Cross'), tr('une relique gardée à Damas : celui qui la tient gagne +150 de Croyance.', 'a relic kept in Damascus: whoever holds it gains +150 Faith.')],
      [tr('🗡️ Les Assassins', '🗡️ The Assassins'), tr('clic droit sur un royaume → les engager contre lui (1 500 d\'or : il perd 25 % de ses soldats et ne recrute plus pendant 45 s). Clic droit sur leurs terres → leur payer tribut (600 d\'or : ils t\'épargnent 5 minutes).', 'right-click a kingdom → hire them against it (1,500 gold: it loses 25% of its soldiers and stops recruiting for 45 s). Right-click their lands → pay them tribute (600 gold: they spare you for 5 minutes).')],
      [tr('🏦 Le bouton « Temple · Assassins »', '🏦 The « Temple · Assassins » button'), tr('à droite de l\'écran, toujours visible : tout ce qu\'on peut marchander y est réuni (aussi par un clic droit sur leurs terres). Un rond vert : une action est possible.', 'on the right of the screen, always visible: everything you can bargain for is gathered there (also by right-clicking their lands). A green dot: an action is available.')],
      [tr('🏦 La banque du Temple', '🏦 The bank of the Temple'), tr('un royaume chrétien peut emprunter 2 000 d\'or tout de suite, et en rend 2 500 peu à peu sur son revenu (environ 3 minutes).', 'a Christian kingdom can borrow 2,000 gold right now, and pays back 2,500 little by little from its income (about 3 minutes).')],
      [tr('⚔️ Les mercenaires du Temple', '⚔️ The Temple\'s mercenaries'), tr('un royaume chrétien loue des chevaliers aux Templiers : 1 500 / 1 200 / 900 soldats tout de suite (Facile / Normal / Difficile) pour 1 500 / 2 000 / 2 500 d\'or, une fois toutes les 5 minutes. De quoi lever une grosse armée d\'un coup.', 'a Christian kingdom hires knights from the Templars: 1,500 / 1,200 / 900 soldiers at once (Easy / Normal / Hard) for 1,500 / 2,000 / 2,500 gold, once every 5 minutes. Enough to raise a big army in one go.')],
      [tr('⛵ La route de la mer', '⛵ The sea route'), tr('la carte va de l\'Atlantique à Bagdad : les flottes des rois croisés partent de leur port (Dartmouth, Gênes, Venise) et on les voit traverser la mer ; Richard contourne l\'Espagne par le détroit de Gibraltar. Tes ports peuvent faire de même.', 'the map runs from the Atlantic to Baghdad: the crusader kings\' fleets leave from their port (Dartmouth, Genoa, Venice) and you see them cross the sea; Richard sails around Spain through the Strait of Gibraltar. Your ports can do the same.')],
      [tr('🤝 Les pactes et les paix de l\'histoire', '🤝 The pacts and peaces of history'), tr('les alliances de 1187 sont déjà en place, et certains royaumes ne se font pas la guerre (une trêve, un mariage…). Les bots ne les rompent jamais ; toi, tu peux (une paix est rompue dès que tu attaques).', 'the alliances of 1187 are already in place, and some kingdoms do not fight each other (a truce, a marriage…). Bots never break them; you can (a peace is broken as soon as you attack).')],
      [tr('🎯 Les objectifs', '🎯 Objectives'), tr('en haut à gauche : tous tenus en même temps, c\'est la victoire. Clique sur un objectif : la carte te montre où il est.', 'at the top left: all held at the same time is victory. Click an objective: the map shows you where it is.')],
      [tr('🎁 Les récompenses', '🎁 Rewards'), tr('l\'or, la Croyance et les soldats que t\'apportent les événements, les choix et les défis : +25 % en Facile, −25 % en Difficile.', 'the gold, Faith and soldiers that events, choices and challenges bring you: +25% on Easy, −25% on Hard.')],
    ],
    roles: {
      ayyoubides: [
        [tr('🦁 Saladin', '🦁 Saladin'), tr('tant qu\'il vit, tes soldats se battent 10 % mieux. En 1188, tes armées assiègent les forteresses des ordres (Baghras, Safed, Belvoir).', 'while he lives, your soldiers fight 10% better. In 1188, your armies besiege the orders\' fortresses (Baghras, Safed, Belvoir).')],
        [tr('👑 Ta succession', '👑 Your succession'), tr('Saladin meurt en 1193 : partager l\'empire (l\'Égypte à ton frère, ton allié) ou tout garder (une guerre civile te coûte des soldats).', 'Saladin dies in 1193: share the empire (Egypt to your brother, your ally) or keep everything (a civil war costs you soldiers).')],
      ],
      templiers: [
        [tr('✠ Les commanderies d\'Occident', '✠ The commanderies of the West'), tr('peu de terres, mais des forteresses imprenables, une armée et un recrutement bien plus grands que tes terres ne le permettraient, et des chevaliers 25 % plus forts.', 'little land, but impregnable fortresses, an army and recruitment much bigger than your land would allow, and knights 25% stronger.')],
        [tr('🏦 Tu es la banque', '🏦 You are the bank'), tr('les rois chrétiens t\'empruntent ton or (2 000) et te le rendent avec 25 % d\'intérêt ; ceux qui louent tes mercenaires te paient. Toi, tu fais venir des chevaliers de tes commanderies d\'Occident (bouton à droite).', 'Christian kings borrow your gold (2,000) and pay it back with 25% interest; those who hire your mercenaries pay you. You bring knights over from your commanderies of the West (button on the right).')],
        [tr('⚔️ La haine de Saladin', '⚔️ Saladin\'s hatred'), tr('la paix de Jaffa (1192) ne te protège pas, et Saladin te vise deux fois plus. Les Assassins ne peuvent rien contre toi, et te versent 1 d\'or par seconde.', 'the peace of Jaffa (1192) does not protect you, and Saladin targets you twice as much. The Assassins can do nothing against you, and pay you 1 gold per second.')],
        [tr('🏝️ Chypre', '🏝️ Cyprus'), tr('en 1191, Richard te propose l\'île ; en 1192, les Chypriotes se révoltent (la revendre, ou écraser la révolte).', 'in 1191, Richard offers you the island; in 1192, the Cypriots revolt (sell it back, or crush the revolt).')],
      ],
      hospitaliers: [
        [tr('✠ Les commanderies d\'Occident', '✠ The commanderies of the West'), tr('peu de terres, mais des forteresses imprenables (le Krak), une armée bien plus grande que tes terres ne le permettraient, et des chevaliers 25 % plus forts.', 'little land, but impregnable fortresses (the Krak), an army much bigger than your land would allow, and knights 25% stronger.')],
        [tr('⚔️ La haine de Saladin', '⚔️ Saladin\'s hatred'), tr('la paix de Jaffa ne te protège pas, et Saladin te vise deux fois plus ; les Assassins ne peuvent rien contre toi.', 'the peace of Jaffa does not protect you, and Saladin targets you twice as much; the Assassins can do nothing against you.')],
      ],
      jerusalem: [
        [tr('🛡️ Le plus dur', '🛡️ The hardest'), tr('il ne te reste que Tyr et quelques villes isolées (les rescapés de Hattin : 80 % de ton armée). Saladin marche sur Jérusalem puis sur Tyr dès 1187.', 'only Tyre and a few isolated cities remain to you (the survivors of Hattin: 80% of your army). Saladin marches on Jerusalem then Tyre from 1187.')],
        [tr('🤝 Outremer', '🤝 Outremer'), tr('les rois croisés rejoignent ton pacte en 1188, et les ordres militaires secourent tes villes attaquées.', 'the crusader kings join your pact in 1188, and the military orders rescue your attacked cities.')],
        [tr('🗡️ Conrad', '🗡️ Conrad'), tr('en 1192, les Assassins le tuent… sauf si tu leur as payé tribut.', 'in 1192, the Assassins kill him… unless you have paid them tribute.')],
      ],
      angleterre: [
        [tr('🦁 Richard Cœur de Lion', '🦁 Richard the Lionheart'), tr('tant qu\'il règne (et n\'est pas captif), tes soldats se battent 15 % mieux (25 % après Arsouf).', 'while he reigns (and is not a captive), your soldiers fight 15% better (25% after Arsuf).')],
        [tr('⛵ Ta croisade', '⛵ Your crusade'), tr('ton royaume est loin de la Terre sainte : en 1190 (Vézelay), tu choisis de prendre la croix. Une armée embarque, débarque à Chypre puis devant Acre. Si tu restes, ces événements n\'ont pas lieu.', 'your kingdom is far from the Holy Land: in 1190 (Vézelay), you choose to take the cross. An army embarks, lands on Cyprus then before Acre. If you stay, these events do not happen.')],
        [tr('⛓️ Le retour (fin 1192)', '⛓️ The return (late 1192)'), tr('tu choisis ta route : par l\'Autriche (comme dans l\'histoire), Richard est capturé et sa rançon coûte la moitié de ton or jusqu\'à être payée ; par la mer (de l\'or tout de suite) ou en restant en Terre sainte, il n\'est pas pris.', 'you choose your route: through Austria (as in history), Richard is captured and his ransom costs half your gold until paid; by sea (gold right away) or by staying in the Holy Land, he is not taken.')],
        [tr('👑 Jean sans Terre', '👑 John Lackland'), tr('en 1199, Richard meurt : le royaume recrute 15 % moins vite.', 'in 1199, Richard dies: the kingdom recruits 15% slower.')],
      ],
      france: [
        [tr('⛵ Ta croisade', '⛵ Your crusade'), tr('en 1190 (Vézelay), tu choisis de prendre la croix : une armée embarque et débarque devant Acre. En 1191, tu peux rentrer (l\'héritage de Flandre : de l\'or) ou rester (de la Croyance).', 'in 1190 (Vézelay), you choose to take the cross: an army embarks and lands before Acre. In 1191, you can go home (the Flemish inheritance: gold) or stay (Faith).')],
        [tr('🕊️ Tes paix', '🕊️ Your peaces'), tr('l\'Empire ne t\'attaque pas (le traité d\'Ivois).', 'the Empire does not attack you (the treaty of Ivois).')],
      ],
      empire: [
        [tr('🦅 Barberousse', '🦅 Barbarossa'), tr('en 1189, tu choisis de partir par la route de terre : une grande armée surgit devant Konya.', 'in 1189, you choose to set out by the land route: a great army appears before Konya.')],
        [tr('🌊 Le Saleph (juin 1190)', '🌊 The Saleph (June 1190)'), tr('si tu ne tiens pas le gué de Séleucie, Barberousse se noie et tu perds 40 % de ton armée ; si tu le tiens, tes soldats se battent 10 % mieux.', 'if you do not hold the ford of Seleucia, Barbarossa drowns and you lose 40% of your army; if you hold it, your soldiers fight 10% better.')],
        [tr('💰 La rançon de Richard', '💰 Richard\'s ransom'), tr('si Richard est pris (fin 1192), sa rançon te revient. En 1194, Henri VI débarque en Sicile.', 'if Richard is taken (late 1192), his ransom comes to you. In 1194, Henry VI lands in Sicily.')],
      ],
      byzance: [
        [tr('🤝 Le pacte secret', '🤝 The secret pact'), tr('en 1189, Saladin te propose une alliance contre les croisés (jusqu\'en 1192), ou tu les laisses passer (de la Croyance).', 'in 1189, Saladin offers you an alliance against the crusaders (until 1192), or you let them pass (Faith).')],
        [tr('⚠️ La quatrième croisade', '⚠️ The Fourth Crusade'), tr('Venise est en paix avec toi jusqu\'en 1201… puis la croisade peut se tourner contre Constantinople.', 'Venice is at peace with you until 1201… then the crusade may turn against Constantinople.')],
      ],
      venise: [
        [tr('💰 La Sérénissime', '💰 The Serenissima'), tr('tes comptoirs te rapportent 25 d\'or toutes les 5 secondes.', 'your trading posts bring you 25 gold every 5 seconds.')],
        [tr('⛵ La quatrième croisade', '⛵ The Fourth Crusade'), tr('vers 1202, les croisés ne peuvent pas payer ta flotte : accepte le marché, et ils prennent Zara puis Constantinople pour toi ; refuse, et tu gardes de l\'or.', 'around 1202, the crusaders cannot pay for your fleet: accept the bargain, and they take Zara then Constantinople for you; refuse, and you keep some gold.')],
      ],
    },
  },

  INTROS: {
    templiers: {
      date: tr('Juillet 1187', 'July 1187'), title: tr('Les pauvres chevaliers du Christ', 'The Poor Knights of Christ'),
      text: tr('À Hattin, deux cents de tes frères ont été pris ; Saladin les a fait décapiter, tous, sous ses yeux. Le grand maître Gérard de Ridefort est son prisonnier. Il ne reste au Temple que trois forteresses — Tortose, Safed, Baghras — et ce que nul ne peut lui prendre : l\'or. Les rois d\'Occident déposent leur trésor dans tes commanderies, et empruntent à tes frères.',
        'At Hattin, two hundred of your brothers were taken; Saladin had them all beheaded, before his eyes. Grand Master Gérard de Ridefort is his prisoner. The Temple has only three fortresses left — Tortosa, Safed, Baghras — and what no one can take from it: gold. The kings of the West keep their treasure in your commanderies, and borrow from your brothers.'),
      todo: tr('Chaque roi chrétien peut t\'emprunter de l\'or, et te le rendre avec intérêts. Tu ne fondes pas de villes : tiens les tiennes.',
        'Every Christian king may borrow gold from you, and repay it with interest. You found no cities: hold your own.'),
    },
    hospitaliers: {
      date: tr('Juillet 1187', 'July 1187'), title: tr('L\'ordre de Saint-Jean', 'The Order of Saint John'),
      text: tr('Ton grand maître est mort à la Fontaine du Cresson, tes frères pris à Hattin ont été exécutés, et l\'Hôpital de Jérusalem, où tes moines soignaient mille pèlerins, va tomber. Mais l\'Ordre tient encore ses grandes forteresses : le Krak des Chevaliers, Margat, Belvoir. Le Krak est la plus formidable de toute la chrétienté.',
        'Your Grand Master died at the Spring of Cresson, your brothers taken at Hattin were executed, and the Hospital of Jerusalem, where your monks nursed a thousand pilgrims, is about to fall. But the Order still holds its great fortresses: the Krak des Chevaliers, Margat, Belvoir. The Krak is the most formidable in all Christendom.'),
      todo: tr('Tu ne fondes pas de villes : tiens les tiennes, et viens au secours d\'Outremer.',
        'You found no cities: hold your own, and come to the aid of Outremer.'),
    },
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
  // ⛵ La croisade du joueur (Richard, Philippe, Barberousse, Venise) : en partant, SHARE de ses soldats embarquent
  // (ils débarquent avec l'armée de l'événement, devant sa première cible) ; en restant, STAY_GOLD d'or, mais
  // STAY_FAITH de Croyance en moins, et la suite de son histoire n'a pas lieu (voir crOff)
  CRUSADE: { SHARE: 0.35, STAY_GOLD: 2000, STAY_FAITH: 50 },
  // ⛵ Les flottes des croisades, qu'on voit traverser la carte : elles partent de leur port (from, [longitude, latitude],
  // en mer) l'année depart et arrivent en vue de leur cible (to) l'année arrive, quand leur armée débarque (l'événement
  // off : sans lui, la flotte ne part pas). La flotte de Richard part de Dartmouth et passe par le détroit de Gibraltar.
  FLEETS: [
    { role: 'angleterre', off: 'cyprus', from: [-3.55, 50.25], depart: 1190.52, to: [33.2, 34.55], arrive: 1191.35,
      name: tr('La flotte de Richard', 'Richard\'s fleet'), port: tr('Dartmouth', 'Dartmouth'), dest: tr('Chypre', 'Cyprus') },
    { role: 'france', off: 'kingsArriveFr', from: [8.9, 44.3], depart: 1190.7, to: [34.85, 32.95], arrive: 1191.3,
      name: tr('La flotte de Philippe Auguste', 'Philip Augustus\'s fleet'), port: tr('Gênes', 'Genoa'), dest: tr('Acre', 'Acre') },
    { role: 'venise', off: 'zara', from: [12.45, 45.3], depart: 1202.6, to: [15.0, 44.1], arrive: 1202.85,
      name: tr('La flotte de la quatrième croisade', 'The fleet of the Fourth Crusade'), port: tr('Venise', 'Venice'), dest: tr('Zara', 'Zara') },
  ],

  // 📜 Ce qui s'est vraiment passé, sous les choix des parchemins (voir UI.parchment)
  HISTORY: {
    richardCross: tr('Richard part de Vézelay le 4 juillet 1190 ; il hiverne à Messine, prend Chypre en mai 1191 et débarque devant Acre en juin. Pendant ce temps, son frère Jean intrigue en Angleterre.', 'Richard leaves Vézelay on 4 July 1190; he winters in Messina, takes Cyprus in May 1191 and lands before Acre in June. Meanwhile, his brother John plots in England.'),
    philipCross: tr('Philippe part de Vézelay avec Richard ; il hiverne à Messine et débarque devant Acre en avril 1191, deux mois avant lui.', 'Philip leaves Vézelay with Richard; he winters in Messina and lands before Acre in April 1191, two months before him.'),
    barbarossa: tr('Barberousse part de Ratisbonne le 11 mai 1189 par la route de terre ; il bat les Turcs devant Konya en mai 1190, puis se noie dans le Saleph le 10 juin 1190 : sa grande armée se disperse.', 'Barbarossa leaves Regensburg on 11 May 1189 by the land route; he defeats the Turks before Konya in May 1190, then drowns in the Saleph on 10 June 1190: his great army scatters.'),
    venice: tr('Venise accepte le marché ; faute d\'argent, les croisés prennent Zara pour elle (1202), puis Constantinople (1203), qu\'ils mettent à sac en avril 1204. La croisade n\'atteint jamais la Terre sainte.', 'Venice accepts the bargain; short of money, the crusaders take Zara for it (1202), then Constantinople (1203), which they sack in April 1204. The crusade never reaches the Holy Land.'),
    richardReturn: tr('Richard quitte Acre le 9 octobre 1192. Une tempête le jette sur la côte de l\'Adriatique ; il traverse l\'Autriche déguisé en pèlerin, mais il est reconnu près de Vienne en décembre et enfermé à Dürnstein. Il ne sera libéré qu\'en février 1194, contre 150 000 marcs d\'argent.', 'Richard leaves Acre on 9 October 1192. A storm throws him onto the Adriatic coast; he crosses Austria disguised as a pilgrim, but is recognised near Vienna in December and locked up in Dürnstein. He is only freed in February 1194, for 150,000 marks of silver.'),
    philipLeaves: tr('Le 31 juillet 1191, malade et brouillé avec Richard, Philippe quitte Acre ; rentré en France, il profite de l\'absence de Richard pour attaquer la Normandie.', 'On 31 July 1191, ill and at odds with Richard, Philip leaves Acre; back in France, he takes advantage of Richard\'s absence to attack Normandy.'),
    byzantineTreaty: tr('Isaac II Ange s\'allie bien à Saladin et retarde Barberousse en Thrace ; l\'empereur doit menacer Constantinople pour obtenir le passage vers l\'Asie.', 'Isaac II Angelos does ally with Saladin and delays Barbarossa in Thrace; the emperor has to threaten Constantinople to win the crossing to Asia.'),
    saladinDies: tr('Saladin meurt à Damas le 4 mars 1193 ; ses fils se partagent son empire (al-Aziz l\'Égypte, al-Afdal Damas), jusqu\'à ce que son frère al-Adil le réunisse en 1200.', 'Saladin dies in Damascus on 4 March 1193; his sons divide his empire (al-Aziz Egypt, al-Afdal Damascus), until his brother al-Adil reunites it in 1200.'),
    cyprusSale: tr('En 1191, Richard vend Chypre aux Templiers pour 100 000 besants.', 'In 1191, Richard sells Cyprus to the Templars for 100,000 bezants.'),
    cyprusBuy: tr('En 1191, les Templiers achètent Chypre à Richard, pour 100 000 besants.', 'In 1191, the Templars buy Cyprus from Richard, for 100,000 bezants.'),
    cyprusRevolt: tr('En avril 1192, les Chypriotes se soulèvent contre les Templiers, qui rendent l\'île ; elle est revendue à Guy de Lusignan, l\'ancien roi de Jérusalem.', 'In April 1192, the Cypriots rise against the Templars, who give the island back; it is sold on to Guy of Lusignan, the former King of Jerusalem.'),
  },

  // 🎁 Ce que chaque grand événement donne (ou coûte) au joueur, dit clairement sur son parchemin (selon sa faction ;
  // '*' : pour tous). « {clé} » devient un nombre du jeu.
  GAINS: {
    saladinNorth: { ayyoubides: tr('une armée de {army} soldats assiège la forteresse pour toi (ses survivants te rejoignent ensuite).', 'an army of {army} soldiers besieges the fortress for you (its survivors join you afterwards).'), '*': tr('l\'armée de Saladin ({army} soldats) assiège ta forteresse : tiens bon derrière ses murs.', 'Saladin\'s army ({army} soldiers) besieges your fortress: hold fast behind its walls.') },
    safedSiege: { ayyoubides: tr('une armée de {army} soldats assiège la forteresse pour toi.', 'an army of {army} soldiers besieges the fortress for you.'), '*': tr('l\'armée de Saladin ({army} soldats) assiège ta forteresse.', 'Saladin\'s army ({army} soldiers) besieges your fortress.') },
    belvoirSiege: { ayyoubides: tr('une armée de {army} soldats assiège la forteresse pour toi.', 'an army of {army} soldiers besieges the fortress for you.'), '*': tr('l\'armée de Saladin ({army} soldats) assiège ta forteresse.', 'Saladin\'s army ({army} soldiers) besieges your fortress.') },
    jerusalemSiege: { ayyoubides: tr('une armée de {army} soldats marche sur Jérusalem pour toi.', 'an army of {army} soldiers marches on Jerusalem for you.'), '*': tr('l\'armée de Saladin ({army} soldats) marche sur ta ville : défends-la !', 'Saladin\'s army ({army} soldiers) marches on your city: defend it!') },
    tyreSiege: { ayyoubides: tr('une armée de {army} soldats marche sur Tyr pour toi.', 'an army of {army} soldiers marches on Tyre for you.'), '*': tr('l\'armée de Saladin ({army} soldats) marche sur Tyr : défends-la !', 'Saladin\'s army ({army} soldiers) marches on Tyre: defend it!') },
    gisors: { '*': tr('les rois d\'Angleterre et de France et l\'Empereur reçoivent +{gold} d\'or (la dîme saladine) et rejoignent le pacte de la Croisade, alliés d\'Outremer.', 'the Kings of England and France and the Emperor receive +{gold} gold (the Saladin tithe) and join the pact of the Crusade, allies of Outremer.') },
    guy: { jerusalem: tr('+{army} soldats rejoignent ton armée.', '+{army} soldiers join your army.') },
    richardKing: { angleterre: tr('tant que Richard vit (et n\'est pas prisonnier), tous tes soldats sont 15 % plus forts au combat.', 'as long as Richard lives (and is not a prisoner), all your soldiers are 15% stronger in battle.'), '*': tr('rien pour toi, mais les soldats d\'Angleterre sont désormais 15 % plus forts.', 'nothing for you, but England\'s soldiers are now 15% stronger.') },
    acreSiege: { jerusalem: tr('{army} soldats d\'Occident débarquent devant Acre et l\'assiègent pour toi.', '{army} soldiers from the West land before Acre and besiege it for you.'), '*': tr('{army} croisés débarquent devant Acre : la ville est en danger.', '{army} crusaders land before Acre: the city is in danger.') },
    konya: { empire: tr('ton armée de croisade ({army} soldats) surgit devant Konya et l\'assiège.', 'your crusading army ({army} soldiers) appears before Konya and besieges it.') },
    saleph: { empire: tr('−{lost} soldats : sans leur empereur, beaucoup rentrent chez eux.', '−{lost} soldiers: without their emperor, many go home.') },
    salephBridge: { empire: tr('Barberousse vit : tous tes soldats sont 10 % plus forts, jusqu\'à la paix de Jaffa (1192).', 'Barbarossa lives: all your soldiers are 10% stronger, until the peace of Jaffa (1192).') },
    messina: { '*': tr('+{gold} d\'or : le roi Tancrède de Sicile achète la paix.', '+{gold} gold: King Tancred of Sicily buys peace.') },
    cyprus: { angleterre: tr('ton armée de croisade ({army} soldats, avec ceux qui ont embarqué) débarque à Chypre et marche sur Nicosie : prends-la, et tu auras un port en Méditerranée.', 'your crusading army ({army} soldiers, with those who embarked) lands on Cyprus and marches on Nicosia: take it, and you will have a port in the Mediterranean.') },
    kingsArrive: { angleterre: tr('ton armée de croisade débarque devant Acre (ou la prochaine ville musulmane de la côte) et l\'assiège.', 'your crusading army lands before Acre (or the next Muslim city on the coast) and besieges it.'), france: tr('ton armée de croisade débarque devant Acre (ou la prochaine ville musulmane de la côte) et l\'assiège.', 'your crusading army lands before Acre (or the next Muslim city on the coast) and besieges it.'), '*': tr('les armées des rois d\'Occident débarquent devant Acre.', 'the armies of the kings of the West land before Acre.') },
    arsuf: { angleterre: tr('tous tes soldats sont 10 % plus forts (en plus des 15 % de Richard), tant que Richard vit et n\'est pas prisonnier.', 'all your soldiers are 10% stronger (on top of Richard\'s 15%), as long as Richard lives and is not a prisoner.'), '*': tr('rien de plus pour toi, mais les soldats de Richard sont désormais 25 % plus forts.', 'nothing more for you, but Richard\'s soldiers are now 25% stronger.') },
    conrad: { jerusalem: tr('−{lost} soldats, et ton royaume ne recrute plus pendant {secs} s.', '−{lost} soldiers, and your kingdom recruits nobody for {secs} s.') },
    conradSpared: { jerusalem: tr('rien à perdre : ton tribut aux Assassins t\'a protégé.', 'nothing lost: your tribute to the Assassins protected you.') },
    jaffa: { '*': tr('pendant {secs} s, aucun assaut entre Saladin (et l\'Égypte) et les croisés ; les rois d\'Occident quittent le pacte de la Croisade.', 'for {secs} s, no assault between Saladin (and Egypt) and the crusaders; the kings of the West leave the pact of the Crusade.') },
    richardReturn: { angleterre: tr('par l\'Autriche, Richard sera pris (une rançon de {ransom} d\'or, recrutement −40 % jusqu\'à ce qu\'elle soit payée) ; la flotte coûte {cost} d\'or tout de suite ; rester coûte 20 % de recrutement jusqu\'en 1194. La flotte ou rester sauvent le défi « Pas de Dürnstein ».', 'through Austria, Richard will be taken (a ransom of {ransom} gold, recruitment −40% until it is paid); the fleet costs {cost} gold right away; staying costs 20% recruitment until 1194. The fleet or staying save the « No Dürnstein » challenge.') },
    captured: { angleterre: tr('une rançon de {gold} d\'or : la moitié de ton or y part chaque seconde jusqu\'à ce qu\'elle soit payée ; d\'ici là, ton recrutement baisse de 40 % et le bonus de Richard disparaît.', 'a ransom of {gold} gold: half your gold goes to it every second until it is paid; until then, your recruitment drops by 40% and Richard\'s bonus is gone.'), empire: tr('la rançon de Richard ({gold} d\'or) te sera versée, peu à peu, par l\'Angleterre.', 'Richard\'s ransom ({gold} gold) will be paid to you, little by little, by England.'), '*': tr('rien pour toi, mais l\'Angleterre est affaiblie le temps de payer {gold} d\'or.', 'nothing for you, but England is weakened while it pays {gold} gold.') },
    sicily: { empire: tr('{army} soldats débarquent en Sicile et marchent sur Palerme pour toi.', '{army} soldiers land in Sicily and march on Palermo for you.') },
    isaacBlinded: { byzance: tr('−{lost} soldats, et ton empire ne recrute plus pendant 45 s.', '−{lost} soldiers, and your empire recruits nobody for 45 s.') },
    germanCrusade: { empire: tr('{army} croisés allemands débarquent en Terre sainte pour toi.', '{army} German crusaders land in the Holy Land for you.'), '*': tr('{army} croisés allemands débarquent en Terre sainte.', '{army} German crusaders land in the Holy Land.') },
    henryDies: { empire: tr('pendant {secs} s, ton recrutement est divisé par deux.', 'for {secs} s, your recruitment is halved.') },
    richardDies: { angleterre: tr('plus de bonus de force de Richard, et sous Jean sans Terre, ton recrutement baisse de 15 %.', 'no more strength bonus from Richard, and under John Lackland, your recruitment drops by 15%.'), '*': tr('rien pour toi, mais l\'Angleterre perd son roi guerrier.', 'nothing for you, but England loses its warrior king.') },
    zara: { venise: tr('−60 de Croyance (le pape t\'excommunie), mais {army} croisés débarquent devant Zara pour toi.', '−60 Faith (the pope excommunicates you), but {army} crusaders land before Zara for you.'), '*': tr('{army} croisés débarquent devant Zara.', '{army} crusaders land before Zara.') },
    constantinople1: { venise: tr('{army} croisés débarquent devant Constantinople pour toi.', '{army} crusaders land before Constantinople for you.'), '*': tr('{army} croisés et Vénitiens attaquent Constantinople : défends-la !', '{army} crusaders and Venetians attack Constantinople: defend it!') },
    sack: { venise: tr('{army} croisés donnent l\'assaut final à Constantinople pour toi.', '{army} crusaders make the final assault on Constantinople for you.'), '*': tr('{army} croisés donnent l\'assaut final à Constantinople : défends-la !', '{army} crusaders make the final assault on Constantinople: defend it!') },
  },

  // Les choix des parchemins : pour chaque événement, ses boutons (pick : le choix, voir crChoose ; hist : le choix
  // qu'on a fait dans l'histoire, voir HISTORY)
  CHOICES: {
    richardCross: [
      { pick: 'go', hist: true, label: tr('⛵ Prendre la croix : {n} soldats embarquent (ils débarqueront à Chypre, puis devant Acre)', '⛵ Take the cross: {n} soldiers embark (they will land on Cyprus, then before Acre)') },
      { pick: 'stay', label: tr('🏰 Rester garder l\'Angleterre (+{gold} d\'or, −{faith} de Croyance ; la croisade de Richard n\'aura pas lieu)', '🏰 Stay and guard England (+{gold} gold, −{faith} Faith; Richard\'s crusade will not happen)') },
    ],
    philipCross: [
      { pick: 'go', hist: true, label: tr('⛵ Prendre la croix : {n} soldats embarquent (ils débarqueront devant Acre)', '⛵ Take the cross: {n} soldiers embark (they will land before Acre)') },
      { pick: 'stay', label: tr('🏰 Rester en France (+{gold} d\'or, −{faith} de Croyance ; ta croisade n\'aura pas lieu)', '🏰 Stay in France (+{gold} gold, −{faith} Faith; your crusade will not happen)') },
    ],
    barbarossa: [
      { pick: 'go', hist: true, label: tr('🦅 Partir par la route de terre : {army} croisés et {n} de tes soldats (ils surgiront devant Konya)', '🦅 Set out by the land route: {army} crusaders and {n} of your soldiers (they will appear before Konya)') },
      { pick: 'stay', label: tr('🏰 Rester dans l\'Empire (+{gold} d\'or, −{faith} de Croyance ; ni Konya ni le Saleph)', '🏰 Stay in the Empire (+{gold} gold, −{faith} Faith; neither Konya nor the Saleph)') },
    ],
    venice: [
      { pick: 'go', hist: true, label: tr('⛵ Accepter le marché : la croisade frappera Zara, puis Constantinople, pour toi', '⛵ Accept the bargain: the crusade will strike Zara, then Constantinople, for you') },
      { pick: 'stay', label: tr('💰 Refuser : garder ta flotte pour le commerce (+{gold} d\'or ; ni Zara ni Constantinople)', '💰 Refuse: keep your fleet for trade (+{gold} gold; neither Zara nor Constantinople)') },
    ],
    richardReturn: [
      { pick: 'austria', hist: true, label: tr('🦁 Par l\'Adriatique et l\'Autriche, déguisé en pèlerin (gratuit, mais Léopold veille…)', '🦁 Through the Adriatic and Austria, disguised as a pilgrim (free, but Leopold is watching…)') },
      { pick: 'fleet', need: true, label: tr('⛵ Par la mer, autour de l\'Espagne, sur une flotte sûre (−{cost} d\'or ; pas de capture)', '⛵ By sea, around Spain, on a safe fleet (−{cost} gold; no capture)') },
      { pick: 'stay', label: tr('✝️ Rester en Terre sainte (pas de capture ; mais Jean intrigue : −20 % de recrutement jusqu\'en 1194)', '✝️ Stay in the Holy Land (no capture; but John plots: −20% recruitment until 1194)') },
    ],
    cyprusSale: [
      { pick: 'sell', hist: true, label: tr('💰 Vendre Chypre aux Templiers (+{price} d\'or)', '💰 Sell Cyprus to the Templars (+{price} gold)') },
      { pick: 'keep', label: tr('🏝️ Garder l\'île', '🏝️ Keep the island') },
    ],
    cyprusBuy: [
      { pick: 'buy', hist: true, label: tr('🏝️ Acheter Chypre (−{price} d\'or)', '🏝️ Buy Cyprus (−{price} gold)') },
      { pick: 'refuse', label: tr('🚫 Refuser : le Temple garde son or', '🚫 Refuse: the Temple keeps its gold') },
    ],
    cyprusRevolt: [
      { pick: 'resell', hist: true, label: tr('💰 Revendre l\'île à Guy de Lusignan (+{gold} d\'or)', '💰 Sell the island back to Guy of Lusignan (+{gold} gold)') },
      { pick: 'keep', label: tr('⚔️ Écraser la révolte (−{pct} % de tes soldats)', '⚔️ Crush the revolt (−{pct}% of your soldiers)') },
    ],
    philipLeaves: [
      { pick: 'home', hist: true, label: tr('🏰 Rentrer en France (+{gold} d\'or de l\'héritage de Flandre, la croisade sans toi)', '🏰 Go home to France (+{gold} gold from the Flemish inheritance, the crusade goes on without you)') },
      { pick: 'stay', label: tr('✝️ Rester en Terre sainte (+{faith} de Croyance)', '✝️ Stay in the Holy Land (+{faith} Faith)') },
    ],
    saladinDies: [
      { pick: 'share', hist: true, label: tr('🤝 Partager : l\'Égypte va à ton frère al-Aziz, ton allié (+{faith} de Croyance)', '🤝 Share: Egypt goes to your brother al-Aziz, your ally (+{faith} Faith)') },
      { pick: 'keep', label: tr('⚔️ Tout garder : la guerre civile (−{pct} % de tes soldats)', '⚔️ Keep everything: civil war (−{pct}% of your soldiers)') },
    ],
    byzantineTreaty: [
      { pick: 'saladin', hist: true, label: tr('🤝 S\'allier à Saladin (jusqu\'à la paix de Jaffa)', '🤝 Ally with Saladin (until the peace of Jaffa)') },
      { pick: 'refuse', label: tr('✝️ Refuser : laisser passer les croisés (+{faith} de Croyance)', '✝️ Refuse: let the crusaders pass (+{faith} Faith)') },
    ],
  },

  // 👑 Les objectifs de chaque faction jouable (tous remplis en même temps : la victoire)
  //  - city : tenir ces villes (noms français) ; church : tenir ce lieu ; cross : tenir la Vraie Croix ;
  //  - never : que cette ville ne soit jamais prise par un autre (perdu pour de bon sinon) ;
  //  - faith : avoir cette Croyance ; citadel : une ville de ce niveau ; gold : avoir cet or.
  //  (goal = { facile, normal, difficile } ; « {n} » dans le texte devient ce nombre)
  OBJECTIVES: {
    templiers: {
      title: tr('✠ Le Temple de Salomon', '✠ The Temple of Solomon'),
      list: [
        { kind: 'never', city: 'Tortose', text: tr('Que Tortose ne tombe jamais : son donjon tient en 1188', 'Tortosa must never fall: its keep holds in 1188') },
        { kind: 'city', cities: ['Safed'], text: tr('Tenir Safed, la forteresse de Galilée', 'Hold Safed, the fortress of Galilee') },
        { kind: 'city', cities: ['Baghras'], text: tr('Tenir Baghras, la porte d\'Antioche', 'Hold Baghras, the gate of Antioch') },
        { kind: 'city', cities: ['Jérusalem'], text: tr('Le Temple de Salomon : reprendre Jérusalem, berceau de l\'Ordre', 'The Temple of Solomon: retake Jerusalem, cradle of the Order') },
        { kind: 'cross', text: tr('Reprendre la Vraie Croix, que tes frères portaient à Hattin', 'Recover the True Cross, which your brothers carried at Hattin') },
        { kind: 'gold', goal: { facile: 6000, normal: 8000, difficile: 10000 }, text: tr('Le trésor du Temple : {n} pièces d\'or', 'The treasure of the Temple: {n} gold') },
      ],
    },
    hospitaliers: {
      title: tr('✠ L\'Hôpital de Saint-Jean', '✠ The Hospital of Saint John'),
      list: [
        { kind: 'never', city: 'Krak des Chevaliers', text: tr('Que le Krak des Chevaliers ne tombe jamais', 'The Krak des Chevaliers must never fall') },
        { kind: 'city', cities: ['Margat'], text: tr('Tenir Margat, le nouveau siège de l\'Ordre', 'Hold Margat, the new seat of the Order') },
        { kind: 'city', cities: ['Belvoir'], text: tr('Tenir Belvoir, qui veille sur le Jourdain', 'Hold Belvoir, which watches over the Jordan') },
        { kind: 'city', cities: ['Acre'], text: tr('L\'Hôpital d\'Acre : prendre Acre (1191)', 'The Hospital of Acre: take Acre (1191)') },
        { kind: 'city', cities: ['Jérusalem'], text: tr('L\'Hôpital de Saint-Jean : reprendre Jérusalem', 'The Hospital of Saint John: retake Jerusalem') },
        { kind: 'faith', goal: { facile: 200, normal: 300, difficile: 400 }, text: tr('Soigner les pèlerins : {n} de Croyance', 'Nurse the pilgrims: {n} Faith') },
      ],
    },
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
    templiers: [
      { kind: 'crFlag', flag: 'cyprusBought', byYear: 1192, text: tr('Le Temple achète une île : acheter Chypre à Richard', 'The Temple buys an island: buy Cyprus from Richard'), reward: { gold: 1500 } },
      { kind: 'crFlag', flag: 'loansGiven', n: 3, text: tr('Le banquier des rois : prêter trois fois l\'or du Temple', 'Banker to kings: lend the Temple\'s gold three times'), reward: { faith: 30 } },
      { kind: 'hold', places: ['Le Caire'], text: tr('La croisade d\'Égypte, 30 ans d\'avance : prendre Le Caire', 'The Egyptian crusade, 30 years early: take Cairo'), reward: { gold: 4000, faith: 60 } },
      { kind: 'gold', n: 15000, text: tr('De quoi tenter Philippe le Bel : amasser 15 000 pièces d\'or', 'Enough to tempt Philip the Fair: hoard 15,000 gold'), reward: { faith: 40 } },
    ],
    hospitaliers: [
      { kind: 'keep', places: ['Belvoir'], untilYear: 1190, text: tr('Belvoir résiste : garder Belvoir jusqu\'en 1190', 'Belvoir holds out: keep Belvoir until 1190'), reward: { gold: 2000, faith: 40 } },
      { kind: 'hold', places: ['Alep'], text: tr('Du Krak à Alep : prendre Alep', 'From the Krak to Aleppo: take Aleppo'), reward: { gold: 3000 } },
      { kind: 'level', n: 4, text: tr('Le Krak agrandi : une forteresse de niveau 4', 'The Krak enlarged: a level 4 fortress'), reward: { faith: 40 } },
      { kind: 'hold', places: ['Damas'], text: tr('Ce que la deuxième croisade a manqué : prendre Damas', 'What the Second Crusade missed: take Damascus'), reward: { gold: 3000, faith: 60 } },
    ],
    ayyoubides: [
      { kind: 'hold', places: ['Jérusalem'], byYear: 1188, text: tr('La reconquête éclair : prendre Jérusalem avant 1188', 'Lightning reconquest: take Jerusalem before 1188'), reward: { gold: 2000, faith: 40 } },
      { kind: 'hold', places: ['Constantinople'], text: tr('Deux siècles d\'avance : prendre Constantinople', 'Two centuries early: take Constantinople'), reward: { gold: 3000, faith: 60 } },
      { kind: 'army', n: 12000, text: tr('L\'armée de Hattin : réunir 12 000 soldats', 'The army of Hattin: gather 12,000 soldiers'), reward: { gold: 1500 } },
      { kind: 'hold', places: ['Rome'], text: tr('Le cheval de Saladin à Saint-Pierre : prendre Rome', 'Saladin\'s horse in St Peter\'s: take Rome'), reward: { gold: 4000, faith: 80 } },
      { kind: 'destroy', role: 'templiers', text: tr('Pas de quartier pour les moines-soldats : anéantir les Templiers', 'No quarter for the warrior monks: wipe out the Templars'), reward: { gold: 2500, faith: 40 } },
    ],
    jerusalem: [
      { kind: 'keep', places: ['Jérusalem'], untilYear: 1188, text: tr('Balian tient bon : garder Jérusalem jusqu\'en 1188', 'Balian holds firm: keep Jerusalem until 1188'), reward: { gold: 2000, faith: 40 } },
      { kind: 'hold', places: ['Damas'], text: tr('Le rêve de Baudouin : prendre Damas', 'Baldwin\'s dream: take Damascus'), reward: { gold: 3000, faith: 60 } },
      { kind: 'hold', places: ['Le Caire'], text: tr('Amaury avait raison : prendre Le Caire', 'Amalric was right: take Cairo'), reward: { gold: 4000, faith: 60 } },
      { kind: 'tribute', text: tr('Le marquis prudent : payer tribut au Vieux de la Montagne', 'The prudent marquis: pay tribute to the Old Man of the Mountain'), reward: { gold: 500 } },
      { kind: 'alive', role: 'templiers', untilYear: 1204.3, text: tr('Le Temple ne tombe jamais : que les Templiers tiennent jusqu\'en 1204', 'The Temple never falls: the Templars must hold until 1204'), reward: { gold: 1500, faith: 40 } },
    ],
    angleterre: [
      { kind: 'hold', places: ['Jérusalem'], byYear: 1193, text: tr('Ce que Richard n\'a pas osé : prendre Jérusalem avant 1193', 'What Richard did not dare: take Jerusalem before 1193'), reward: { gold: 3000, faith: 80 } },
      { kind: 'hold', places: ['Paris'], text: tr('Le vassal qui voulait être roi : prendre Paris', 'The vassal who would be king: take Paris'), reward: { gold: 3000 } },
      { kind: 'hold', places: ['Messine'], byYear: 1191, text: tr('Les Grecs de Messine : prendre Messine avant 1191', 'The Greeks of Messina: take Messina before 1191'), reward: { gold: 1500 } },
      { kind: 'noCapture', untilYear: 1194, text: tr('Pas de Dürnstein : que Richard ne soit jamais capturé (au retour, fin 1192 : ne pas passer par l\'Autriche)', 'No Dürnstein: Richard must never be captured (on the way home, late 1192: avoid Austria)'), reward: { faith: 50 } },
      { kind: 'crFlag', flag: 'cyprusSold', byYear: 1192, text: tr('Le roi marchand : vendre Chypre aux Templiers', 'The merchant king: sell Cyprus to the Templars'), reward: { gold: 1000 } },
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
      // ✠ Les ordres militaires : des moines-soldats, peu de terres mais des forteresses très solides (garnisons 2 fois
      // plus fortes ; 3 fois à Tortose et Margat, 4 fois au Krak des Chevaliers), dans Outremer (voir ORDERS) ; décimés
      // à Hattin, ils envoient des renforts à partir de 1188
      id: 'templiers', name: tr('Templiers', 'Templars'), leader: tr('le grand maître Gérard de Ridefort', 'Grand Master Gérard de Ridefort'), flag: 'cr_templiers', color: [179, 20, 28],
      playable: true, order: true, defensive: true, garrison: 2, camp: 'chretiens',
      capital: [35.89, 34.89, tr('Tortose', 'Tortosa'), 'Tortose', { garrison: 1.5 }], capitalLevel: 2,
      cities: [[35.50, 32.96, tr('Safed', 'Safed'), 'Safed', { level: 2 }], [36.40, 36.38, tr('Baghras', 'Baghras'), 'Baghras']],
      churches: [],
      lands: [[[35.75, 34.78], [36.03, 34.78], [36.03, 35.00], [35.75, 35.00]], [[35.36, 32.85], [35.64, 32.85], [35.64, 33.07], [35.36, 33.07]], [[36.26, 36.27], [36.54, 36.27], [36.54, 36.49], [36.26, 36.49]]],
      desc: tr('Les pauvres chevaliers du Christ et du Temple de Salomon : trois forteresses, et la banque de l\'Occident.', 'The Poor Knights of Christ and of the Temple of Solomon: three fortresses, and the bank of the West.'),
    },
    {
      id: 'hospitaliers', name: tr('Hospitaliers', 'Hospitallers'), leader: tr('le grand maître Ermengard d\'Asp', 'Grand Master Ermengard d\'Asp'), flag: 'cr_hospitaliers', color: [30, 30, 34],
      playable: true, order: true, defensive: true, garrison: 2, camp: 'chretiens',
      // (Margat, le siège de l'Ordre après la chute de Jérusalem ; le Krak, sa plus grande forteresse)
      capital: [35.97, 35.17, tr('Margat', 'Margat'), 'Margat', { garrison: 1.5 }], capitalLevel: 2,
      cities: [[36.29, 34.76, tr('Krak des Chevaliers', 'Krak des Chevaliers'), 'Krak des Chevaliers', { level: 2, garrison: 2 }], [35.52, 32.56, tr('Belvoir', 'Belvoir'), 'Belvoir']],
      churches: [],
      lands: [[[36.15, 34.65], [36.43, 34.65], [36.43, 34.87], [36.15, 34.87]], [[35.84, 35.07], [36.10, 35.07], [36.10, 35.27], [35.84, 35.27]], [[35.38, 32.45], [35.66, 32.45], [35.66, 32.67], [35.38, 32.67]]],
      desc: tr('L\'ordre de Saint-Jean de Jérusalem : les moines-soldats qui soignent les pèlerins, et tiennent le Krak des Chevaliers.', 'The Order of Saint John of Jerusalem: the warrior monks who nurse the pilgrims, and hold the Krak des Chevaliers.'),
    },
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
      cities: [[35.84, 34.44, tr('Tripoli', 'Tripoli'), 'Tripoli', { level: 2 }], [35.78, 35.52, tr('Lattaquié', 'Latakia'), 'Lattaquié']],
      churches: [],
      lands: [[[35.7, 34.2], [36.45, 34.2], [36.45, 34.95], [36.15, 34.95], [36.15, 35.3], [36.5, 35.45], [36.75, 36.05], [36.6, 36.55],
        [36.2, 36.75], [35.9, 36.5], [35.7, 35.5]]],
      desc: tr('La principauté d\'Antioche et le comté de Tripoli, entre les forteresses des Templiers et des Hospitaliers.', 'The principality of Antioch and the county of Tripoli, between the fortresses of the Templars and the Hospitallers.'),
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
      // (les royaumes chrétiens d'Espagne et le Portugal de Sanche Ier, réunis sous la Castille)
      capital: [-4.02, 39.86, tr('Tolède', 'Toledo'), 'Tolède'], cities: [[2.17, 41.39, tr('Barcelone', 'Barcelona'), 'Barcelone'], [-9.14, 38.72, tr('Lisbonne', 'Lisbon'), 'Lisbonne']], churches: [],
      lands: [[[-6.8, 38.9], [-8.5, 38.5], [-10.8, 38.5], [-10.8, 44.3], [-1.8, 43.4], [-0.5, 42.8], [0.6, 42.7], [1.5, 42.55], [3.05, 42.45], [3.4, 41.8], [2.0, 41.0],
        [0.6, 40.3], [-0.3, 39.5], [-2.0, 38.8]]],
      desc: '',
    },
    {
      id: 'almohades', name: tr('Almohades', 'Almohads'), leader: tr('le calife Abu Yusuf Yaqub', 'Caliph Abu Yusuf Yaqub'), flag: 'cr_almohades', color: [31, 122, 77],
      defensive: true, slowAI: 3, camp: 'musulmans',
      capital: [-4.78, 37.89, tr('Cordoue', 'Córdoba'), 'Cordoue'], cities: [[-4.98, 34.03, tr('Fès', 'Fez'), 'Fès'], [10.18, 36.80, tr('Tunis', 'Tunis'), 'Tunis']],
      churches: [],
      // (al-Andalus et le Maghreb, jusqu'au Sahara)
      lands: [[[-10.8, 29.5], [-10.8, 38.5], [-8.5, 38.5], [-6.8, 38.9], [-2.0, 38.8], [-0.3, 39.5], [0.6, 38.8], [0.0, 37.5], [-2.0, 36.6], [3.0, 37.0], [8.0, 37.3], [11.0, 37.3],
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
