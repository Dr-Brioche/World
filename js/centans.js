// ⚜️ SCÉNARIO « LA GUERRE DE CENT ANS » (1337-1453)
// 1337 : le roi de France Philippe VI de Valois confisque la Guyenne au roi d'Angleterre Édouard III, qui se proclame
// à son tour roi de France. Commence une guerre de plus d'un siècle : Crécy, la peste noire, Poitiers et le roi Jean
// captif, Du Guesclin, la folie de Charles VI, Azincourt, Jeanne d'Arc, et enfin Castillon.
// La carte : la France, les îles Britanniques et le nord de l'Espagne (voir generateCentAnsMap, dans europemap.js).
// Les règles du scénario : voir centansrules.js. Comme pour Charlemagne, chaque faction a :
//  - lands : son territoire en 1337, en un ou plusieurs contours [longitude, latitude] (une case appartient à la
//    première faction de la liste qui la contient : l'ordre compte là où deux contours se chevauchent) ;
//  - capital et cities : ses villes [longitude, latitude, nom, nom français : son identifiant fixe, dans toutes les
//    langues] (la capitale au niveau 2, ou capitalLevel) ;
//  - churches : ses églises ; enclaves : des terres à elle au milieu de celles d'une autre ([longitude, latitude, rayon]).
// playable : le joueur peut l'incarner ; defensive : elle se défend, mais ne part pas en conquête ; noArmy : pas
// d'armée, seulement la garnison de ses villes (le pape d'Avignon) ; production : moulins et casernes de niveau 2 autour
// de la capitale ; vassal : un grand vassal dont la fidélité balance entre les deux rois (voir VASSALS) ;
// camp : le camp de départ ('france' ou 'angleterre') ; legit : la fidélité de départ d'un vassal (voir VASSALS) ;
// garrison : les garnisons de ses villes valent garrison fois plus (le pape d'Avignon, qui n'a pas d'armée).
// flag : sa bannière (en attendant les vraies : un des drapeaux du jeu) ; color : la couleur de son royaume.

const CENTANS = {
  // 📅 Le calendrier : la guerre dure de 1337 à 1453, en GAME_MINUTES minutes de jeu (l'année s'affiche en haut)
  YEAR_START: 1337,
  YEAR_END: 1453,
  GAME_MINUTES: 45,
  START_ARMY: 0.35,         // au départ, chaque faction a 35 % de son armée maximum
  START_GOLD: 400,

  // 👑 La Légitimité (elle remplace la Croyance dans ce scénario) : qui est le vrai roi ? Elle compte pour les objectifs,
  // et décide du camp que choisissent les grands vassaux (voir VASSALS). Elle vient :
  //  - de la faction (BASE) ; de ses villes (CITY chacune, KEY_CITY pour les grandes villes du royaume : KEY_CITIES) ;
  //  - de ses églises (CHURCH : la part de leur Croyance habituelle ; le clergé soutient le roi) ;
  //  - des événements : le sacre à Reims (SACRE), le traité de Troyes, Jeanne d'Arc…
  // Elle baisse quand le roi n'est pas sacré (UNCROWNED), est captif (CAPTIVE) ou fou (MAD).
  LEGIT: { BASE: { france: 150, angleterre: 100 }, OTHER_BASE: 50, CITY: 5, KEY_CITY: 15, CHURCH: 0.5,
    SACRE: 80, UNCROWNED: -50, CAPTIVE: -80, MAD: -30, TROYES: 100, TROYES_FRANCE: -60, JOAN_CITY: 15 },
  KEY_CITIES: ['Paris', 'Reims', 'Rouen', 'Orléans', 'Calais', 'Bordeaux', 'Londres'],

  // ⚖️ Les grands vassaux (Bourgogne, Bretagne, Flandre, Navarre) : leur fidélité va de -100 (pour le roi d'Angleterre)
  // à +100 (pour le roi de France). Elle glisse doucement (DRIFT par seconde) vers l'avis du moment : l'écart de
  // Légitimité entre les deux rois, divisé par LEGIT_SCALE (au plus ±PULL). Au-delà de JOIN, le vassal rejoint ce
  // camp ; il le quitte en repassant sous LEAVE. Un roi qui attaque un vassal le perd (ATTACKED) ; l'or l'achète :
  // BRIBE_GOLD pièces = ±BRIBE de fidélité (clic droit sur ses terres).
  VASSALS: { DRIFT: 0.004, LEGIT_SCALE: 2, PULL: 60, JOIN: 35, LEAVE: 15, ATTACKED: 25, BRIBE_GOLD: 500, BRIBE: 15,
    AI_BRIBE_EVERY: 60 },

  // 🏹 Les arcs longs anglais : en rase campagne (pas pendant un siège), l'armée du roi d'Angleterre se bat
  // LONGBOW fois mieux (Crécy, Poitiers, Azincourt), jusqu'à LONGBOW_END (Formigny : les canons français)
  LONGBOW: 0.3, LONGBOW_END: 1450,
  // 💣 L'artillerie des frères Bureau : à partir de CANNONS (année), les sièges menés par le roi de France durent
  // CANNON_SIEGE fois moins longtemps
  CANNONS: 1439, CANNON_SIEGE: 0.45,
  // 🗡️ Du Guesclin (sous Charles V) et Henri V : les soldats de leur roi sont HERO_POWER plus forts
  HERO_POWER: 0.15,
  // 🛠️ Charles V le Sage : les améliorations du roi de France coûtent WISE_UPGRADE fois moins
  WISE_UPGRADE: 0.75,
  // 🤪 Charles VI le Fou : toutes les MAD.EVERY secondes, une crise de MAD.TIME secondes : le roi de France recrute
  // 2 fois moins vite (et sa Légitimité baisse : voir LEGIT.MAD)
  MAD: { EVERY: 100, TIME: 30, RECRUIT: 0.5 },

  // 🦁 L'Angleterre, quand c'est un bot : une armée plus grande et un recrutement plus rapide (ENGLAND_BOOST, selon la
  // difficulté), pour qu'elle reste une vraie menace face au grand royaume de France (un tiers seulement de ce renfort
  // quand le joueur incarne une autre faction que la France)
  ENGLAND_BOOST: { facile: 1.1, normal: 1.3, difficile: 1.5 },
  // ⛓️ Le roi Jean captif : sous Jean II, si une armée française perd au moins CAPTURE_MIN soldats dans une bataille
  // perdue contre le camp anglais (ou si la chevauchée du Prince Noir réussit), le roi est pris (Poitiers, 1356). Sa rançon (RANSOM pièces, selon la difficulté) se paie toute seule :
  // RANSOM_SHARE de l'or du royaume y part, jusqu'à ce qu'elle soit payée.
  CAPTURE_MIN: 500, RANSOM: { facile: 2000, normal: 3000, difficile: 4000 }, RANSOM_SHARE: 0.5,

  // 💰 Rançons des chevaliers : une armée battue d'au moins RANSOM_MIN soldats paie au vainqueur KNIGHT_RANSOM pièces
  // par soldat tombé (s'il a de quoi payer)
  RANSOM_MIN: 300, KNIGHT_RANSOM: 0.15,

  // 🕊️ Les trêves : pendant TIME secondes, aucun assaut entre le camp du roi de France et celui du roi d'Angleterre
  TRUCES: [
    { key: 'malestroit', year: 1343, time: 60 },
    { key: 'bretigny', year: 1360, time: 180 },
    { key: 'leulinghem', year: 1389, time: 120 },
  ],

  // ☠️ La peste noire (1348) : elle part de Marseille et saute de ville en ville (à moins de SPREAD_RANGE cases, une
  // chance sur SPREAD_CHANCE chaque seconde). Une ville touchée le reste SICK secondes : sa garnison et le royaume
  // perdent des soldats (LOSS de l'armée, partagé entre ses villes malades), ses moulins et casernes produisent SLOW
  // fois moins. Ensuite elle est guérie (et protégée IMMUNE secondes). Une ville aux portes fermées (CLOSE secondes,
  // clic droit) ne l'attrape pas et ne la transmet pas, mais ne produit plus rien.
  PLAGUE: { YEAR: 1348, START: 'Marseille', SPREAD_RANGE: 60, SPREAD_CHANCE: 0.06, SICK: 45, LOSS: 0.012, SLOW: 0.4,
    IMMUNE: 240, CLOSE: 40, MAX_YEAR: 1352 },

  // 🔥 Les chevauchées : de temps en temps (EVERY secondes), l'Angleterre lance une armée qui pille et rase une ville du
  // camp français (sans la garder), et rentre avec son butin (LOOT pièces par bâtiment détruit)
  CHEVAUCHEE: { EVERY: { facile: 150, normal: 110, difficile: 80 }, SHARE: 0.35, MIN: 600, LOOT: 120 },
  // 🗡️ Les Grandes Compagnies : de FROM à TO (années), des routiers sans maître surgissent dans le pays et razzient une
  // ville (EVERY secondes, 2 fois plus souvent pendant une trêve) ; ARMY guerriers, GROWTH de plus à chaque fois
  COMPAGNIES: { FROM: 1357, TO: 1445, EVERY: { facile: 120, normal: 90, difficile: 70 }, ARMY: { facile: 400, normal: 600, difficile: 800 },
    GROWTH: 0.1, MAX: 2500, LOOT: 120, SPAIN: [1366, 1369] },
  // ⚓ Les ports de la Manche : chaque ville de cette liste que tient le roi d'Angleterre ravitaille son armée :
  // +PORT_SUPPLY de recrutement chacune
  CHANNEL_PORTS: ['Calais', 'Harfleur', 'Cherbourg', 'Abbeville', 'Dunkerque'], PORT_SUPPLY: 0.08,
  // ⚔️ Les grandes armées des événements (Crécy, Calais, Poitiers, Azincourt, Orléans), selon la difficulté
  EVENT_ARMY: { facile: 1800, normal: 2500, difficile: 3200 },
  // ⚜️ Jeanne d'Arc (1429) : l'armée qu'elle accompagne se bat JOAN_POWER mieux et assiège JOAN_SIEGE fois plus vite
  JOAN: { YEAR: 1429, POWER: 0.4, SIEGE: 0.5, BACK: 5 },
  // ⚖️ Le traité d'Arras (1435) : la Bourgogne revient au roi de France (si sa Légitimité dépasse celle de l'Anglais)
  ARRAS: 1435,

  // 👑 Les rois de France (le règne commence à l'année from) et leurs effets (voir centansrules.js)
  KINGS: [
    { from: 1337, name: tr('Philippe VI', 'Philip VI') },
    { from: 1350, name: tr('Jean II le Bon', 'John II the Good'), captive: true },
    { from: 1364, name: tr('Charles V le Sage', 'Charles V the Wise'), wise: true, hero: true },
    { from: 1380, name: tr('Charles VI', 'Charles VI') },
    { from: 1422, name: tr('Charles VII', 'Charles VII') },
  ],
  // (les rois d'Angleterre, pour les messages ; Henri V rend ses soldats plus forts : voir HERO_POWER)
  ENGLISH_KINGS: [
    { from: 1337, name: tr('Édouard III', 'Edward III') },
    { from: 1377, name: tr('Richard II', 'Richard II') },
    { from: 1399, name: tr('Henri IV', 'Henry IV') },
    { from: 1413, name: tr('Henri V', 'Henry V'), hero: true },
    { from: 1422, name: tr('Henri VI', 'Henry VI') },
  ],

  // 📜 Les grands événements (voir centansrules.js) : à l'année year, un parchemin s'ouvre pour le joueur du roi de
  // France (un simple message pour les autres) ; « {clé} » est remplacé par un nombre du jeu. Le conseil, à mots
  // couverts, des conseillers du roi : pas de mode d'emploi, pour rester dans l'histoire.
  EVENTS: {
    intro: {
      date: tr('Mai de l\'an de grâce 1337', 'May, in the year of grace 1337'),
      title: tr('La Guyenne confisquée', 'Guyenne confiscated'),
      text: tr('Le roi Philippe VI de Valois a prononcé la confiscation de la Guyenne : le duc qui la tient, Édouard III, roi d\'Angleterre, a trop longtemps refusé l\'hommage qu\'il lui doit. En réponse, Édouard se proclame lui-même roi de France, par sa mère Isabelle, fille de Philippe le Bel. Les lys et les léopards vont s\'affronter… et nul ne sait encore que cette guerre durera plus d\'un siècle.',
        'King Philip VI of Valois has decreed the confiscation of Guyenne: the duke who holds it, Edward III, King of England, has too long refused the homage he owes. In reply, Edward proclaims himself King of France, through his mother Isabella, daughter of Philip the Fair. The lilies and the leopards are about to clash… and no one yet knows that this war will last more than a century.'),
      todo: tr('Neuf grands desseins attendent ta couronne, consignés en haut à gauche : accomplis-les tous, et le royaume sera délivré. Les grands vassaux regardent qui est le vrai roi : veille sur ta Légitimité. Observe d\'abord tes terres, puis ▶ Reprendre.',
        'Nine great designs await your crown, written at the top left: fulfil them all, and the kingdom will be delivered. The great vassals are watching who the true king is: look after your Legitimacy. First survey your lands, then ▶ Resume.'),
    },
    artevelde: {
      date: tr('1339', '1339'),
      title: tr('Les Flamands choisissent l\'Angleterre', 'The Flemings choose England'),
      text: tr('Sans la laine anglaise, les métiers de Gand et de Bruges se taisent. Le riche drapier Jacques van Artevelde soulève les villes de Flandre contre leur comte, fidèle au roi de France, et fait reconnaître Édouard III comme roi de France.',
        'Without English wool, the looms of Ghent and Bruges fall silent. The rich clothier Jacob van Artevelde raises the towns of Flanders against their count, loyal to the King of France, and has Edward III recognised as King of France.'),
      todo: tr('La laine pèse plus lourd que les serments… mais l\'or, lui aussi, sait parler aux bourgeois.',
        'Wool weighs more than oaths… but gold, too, knows how to speak to burghers.'),
    },
    ecluse: {
      date: tr('24 juin 1340', '24 June 1340'),
      title: tr('Le désastre de l\'Écluse', 'The disaster of Sluys'),
      text: tr('Dans l\'estuaire du Zwin, la flotte du roi s\'est fait prendre au piège, serrée bord contre bord. Les archers anglais l\'ont criblée de flèches : près de vingt mille hommes ont péri. On dit que nul n\'ose l\'annoncer au roi, et que c\'est son fou qui s\'en est chargé : « Les Anglais sont des lâches, ils n\'ont pas osé sauter à l\'eau ! »',
        'In the estuary of the Zwin, the king\'s fleet was caught in a trap, packed hull against hull. The English archers riddled it with arrows: nearly twenty thousand men perished. It is said that no one dared tell the king, and that his fool did it: "The English are cowards, they did not dare to jump into the water!"'),
      todo: tr('La mer appartient à l\'Anglais pour un temps : tes ports de la Manche pansent leurs plaies.',
        'The sea belongs to the Englishman for a time: your Channel ports are licking their wounds.'),
    },
    bretagne: {
      date: tr('1341', '1341'),
      title: tr('La guerre de Succession de Bretagne', 'The War of the Breton Succession'),
      text: tr('Le duc Jean III de Bretagne est mort sans héritier. Deux prétendants se disputent son duché : Charles de Blois, neveu du roi de France, et Jean de Montfort, qui a couru demander l\'aide du roi d\'Angleterre. La Bretagne se déchire.',
        'Duke John III of Brittany has died without an heir. Two claimants fight over his duchy: Charles of Blois, nephew of the King of France, and John of Montfort, who has rushed to ask the King of England for help. Brittany tears itself apart.'),
      todo: tr('Un duché qui hésite se gagne… ou se perd.', 'A wavering duchy can be won… or lost.'),
    },
    malestroit: {
      date: tr('Janvier 1343', 'January 1343'),
      title: tr('La trêve de Malestroit', 'The Truce of Malestroit'),
      text: tr('Les légats du pape d\'Avignon ont obtenu des deux rois une trêve : pour un temps, les lys et les léopards rangent leurs épées.',
        'The legates of the pope of Avignon have obtained a truce from both kings: for a time, the lilies and the leopards sheathe their swords.'),
      todo: tr('Une trêve n\'est qu\'un souffle entre deux batailles : que ce souffle te serve.',
        'A truce is but a breath between two battles: make that breath count.'),
    },
    crecy: {
      date: tr('Juillet 1346', 'July 1346'),
      title: tr('Édouard III débarque en Normandie', 'Edward III lands in Normandy'),
      text: tr('Le roi d\'Angleterre a débarqué dans le Cotentin avec {army} hommes. Ses troupes brûlent tout sur leur passage et marchent sur {city}. Ses archers gallois tirent dix flèches quand nos arbalétriers en tirent deux : en rase campagne, ils sont redoutables.',
        'The King of England has landed in the Cotentin with {army} men. His troops burn everything in their path and march on {city}. His Welsh archers shoot ten arrows while our crossbowmen shoot two: in the open field, they are fearsome.'),
      todo: tr('La chevalerie de France brûle d\'en découdre… mais les murailles, elles, ne craignent pas les flèches.',
        'The chivalry of France burns for battle… but walls, at least, do not fear arrows.'),
    },
    calais: {
      date: tr('Septembre 1346', 'September 1346'),
      title: tr('Le siège de Calais', 'The siege of Calais'),
      text: tr('Les Anglais ont mis le siège devant Calais. Ses bourgeois tiendront onze mois : on raconte que six d\'entre eux viendront s\'offrir, la corde au cou, pour sauver leur ville.',
        'The English have laid siege to Calais. Its burghers will hold out for eleven months: it is said that six of them will come to offer themselves, ropes around their necks, to save their town.'),
      todo: tr('Qui tient Calais tient la porte de la France.', 'Whoever holds Calais holds the gate of France.'),
    },
    peste: {
      date: tr('1348', '1348'),
      title: tr('La peste noire', 'The Black Death'),
      text: tr('Des navires venus de Crimée ont apporté à Marseille un mal terrible : la peste. Elle court de ville en ville plus vite que les chevaux. Les bubons noircissent, les corps s\'entassent, et des villages entiers se vident. Bientôt, un homme sur trois sera mort.',
        'Ships from Crimea have brought a terrible sickness to Marseille: the plague. It runs from town to town faster than horses. The buboes blacken, bodies pile up, and whole villages empty. Soon, one man in three will be dead.'),
      todo: tr('On dit que les villes qui ferment leurs portes à temps sont épargnées… mais une ville close ne travaille plus.',
        'They say that towns which close their gates in time are spared… but a closed town no longer works.'),
    },
    dauphine: {
      date: tr('1349', '1349'),
      title: tr('Le Dauphiné', 'The Dauphiné'),
      text: tr('Ruiné et sans héritier, le dauphin Humbert II a vendu ses terres au roi de France. Désormais, le fils aîné du roi portera le titre de dauphin.',
        'Ruined and without an heir, Dauphin Humbert II has sold his lands to the King of France. From now on, the king\'s eldest son will bear the title of dauphin.'),
      todo: tr('Le royaume s\'agrandit sans qu\'une goutte de sang ait coulé.', 'The kingdom grows without a drop of blood being shed.'),
    },
    jean2: {
      date: tr('Août 1350', 'August 1350'),
      title: tr('Le roi Jean II', 'King John II'),
      text: tr('Philippe VI est mort. Son fils Jean II, que l\'on dit le Bon, monte sur le trône : un roi chevalier, brave jusqu\'à l\'imprudence, qui aime les tournois plus que les conseils.',
        'Philip VI is dead. His son John II, called the Good, ascends the throne: a knightly king, brave to the point of rashness, who loves tournaments more than councils.'),
      todo: tr('Un roi qui se jette dans la mêlée peut y rester… et une couronne captive coûte cher.',
        'A king who throws himself into the fray may be taken… and a captive crown is costly.'),
    },
    navarre: {
      date: tr('1354', '1354'),
      title: tr('Charles le Mauvais', 'Charles the Bad'),
      text: tr('Le roi de Navarre, Charles, petit-fils de Louis X, a fait assassiner le connétable de France. Comte d\'Évreux, il tient des terres jusqu\'au cœur de la Normandie, et intrigue maintenant avec les Anglais.',
        'The King of Navarre, Charles, grandson of Louis X, has had the Constable of France murdered. As Count of Évreux, he holds lands right into the heart of Normandy, and now plots with the English.'),
      todo: tr('Un serpent dans le jardin normand…', 'A serpent in the Norman garden…'),
    },
    poitiers: {
      date: tr('Septembre 1356', 'September 1356'),
      title: tr('La chevauchée du Prince Noir', 'The Black Prince\'s chevauchée'),
      text: tr('Le fils d\'Édouard III, le Prince Noir, est sorti de Bordeaux avec {army} hommes. Il pille le pays et remonte vers {city}, brûlant les moulins et les granges.',
        'Edward III\'s son, the Black Prince, has ridden out of Bordeaux with {army} men. He plunders the land and heads for {city}, burning the mills and barns.'),
      todo: tr('Que le roi se garde à droite, que le roi se garde à gauche…', 'Father, guard yourself on the right; father, guard yourself on the left…'),
    },
    captif: {
      date: tr('1356', '1356'),
      title: tr('Le roi est captif', 'The king is a captive'),
      text: tr('La chevalerie de France a été taillée en pièces, et le roi Jean, qui se battait à la hache, a été pris. Il est emmené à Londres : sa rançon est fixée à {gold} pièces d\'or. Tant qu\'elle n\'est pas payée, le royaume est sans roi.',
        'The chivalry of France has been cut to pieces, and King John, who fought with an axe, has been taken. He is led away to London: his ransom is set at {gold} gold coins. Until it is paid, the kingdom has no king.'),
      todo: tr('Le trésor saigne pour la rançon… chaque pièce y compte.', 'The treasury bleeds for the ransom… every coin counts.'),
    },
    jacquerie: {
      date: tr('Mai 1358', 'May 1358'),
      title: tr('La Jacquerie', 'The Jacquerie'),
      text: tr('Écrasés de taxes et pillés par les routiers, les paysans du Beauvaisis se soulèvent : on les appelle les Jacques. À Paris, le prévôt des marchands Étienne Marcel défie le dauphin. Le royaume vacille.',
        'Crushed by taxes and plundered by mercenaries, the peasants of the Beauvaisis rise up: they are called the Jacques. In Paris, the provost of the merchants, Étienne Marcel, defies the dauphin. The kingdom totters.'),
      todo: tr('Le peuple a faim de paix : les recrues se font rares pour un temps.', 'The people hunger for peace: recruits will be scarce for a while.'),
    },
    bretigny: {
      date: tr('Mai 1360', 'May 1360'),
      title: tr('La paix de Brétigny', 'The Peace of Brétigny'),
      text: tr('Épuisés, les deux rois signent la paix à Brétigny. Mais des milliers de soldats se retrouvent sans solde : réunis en Grandes Compagnies, ces routiers vont désormais piller le pays pour leur propre compte.',
        'Exhausted, the two kings make peace at Brétigny. But thousands of soldiers find themselves without pay: gathered into Great Companies, these mercenaries will now plunder the land on their own account.'),
      todo: tr('La paix des rois n\'est pas celle des campagnes : gare aux bandes qui sortent des bois.',
        'The peace of kings is not the peace of the countryside: beware the bands coming out of the woods.'),
    },
    charles5: {
      date: tr('Avril 1364', 'April 1364'),
      title: tr('Charles V le Sage', 'Charles V the Wise'),
      text: tr('Le roi Jean est mort à Londres. Son fils Charles V, de faible santé mais d\'esprit fin, lui succède. Il a trouvé son épée : Bertrand du Guesclin, un petit noble breton, laid et redoutable, vainqueur à Cocherel.',
        'King John has died in London. His son Charles V, of poor health but sharp mind, succeeds him. He has found his sword: Bertrand du Guesclin, a minor Breton noble, ugly and formidable, victor at Cocherel.'),
      todo: tr('Un roi sage bâtit plus qu\'il ne brûle, et un bon capitaine vaut une armée.',
        'A wise king builds more than he burns, and a good captain is worth an army.'),
    },
    espagne: {
      date: tr('1366', '1366'),
      title: tr('Les Compagnies partent en Castille', 'The Companies leave for Castile'),
      text: tr('Du Guesclin a promis or et pillage aux Grandes Compagnies : il les emmène en Castille, pour aider Henri de Trastamare à prendre le trône. Le royaume respire.',
        'Du Guesclin has promised gold and plunder to the Great Companies: he leads them to Castile, to help Henry of Trastámara take the throne. The kingdom breathes again.'),
      todo: tr('Les loups sont partis chasser ailleurs… pour combien de temps ?', 'The wolves have gone hunting elsewhere… for how long?'),
    },
    reprise: {
      date: tr('1369', '1369'),
      title: tr('La guerre reprend', 'The war resumes'),
      text: tr('Henri de Trastamare est roi de Castille, et il n\'oublie pas qui l\'a fait roi : la Castille rejoint le camp du roi de France. Charles V confisque à nouveau la Guyenne. La guerre recommence.',
        'Henry of Trastámara is King of Castile, and he does not forget who made him king: Castile joins the camp of the King of France. Charles V confiscates Guyenne once more. The war begins again.'),
      todo: tr('Les galères de Castille sont maintenant les tiennes.', 'The galleys of Castile are now yours.'),
    },
    larochelle: {
      date: tr('Juin 1372', 'June 1372'),
      title: tr('La bataille de La Rochelle', 'The battle of La Rochelle'),
      text: tr('Devant La Rochelle, les galères castillanes ont lancé des brûlots sur la flotte anglaise : ses navires ont flambé comme des torches. La mer n\'est plus à l\'Anglais.',
        'Before La Rochelle, the Castilian galleys launched fireships against the English fleet: its ships went up like torches. The sea no longer belongs to the Englishman.'),
      todo: tr('Pour un temps, aucune voile anglaise n\'osera paraître.', 'For a time, no English sail will dare appear.'),
    },
    charles6: {
      date: tr('Septembre 1380', 'September 1380'),
      title: tr('Charles VI', 'Charles VI'),
      text: tr('Charles V est mort, et Du Guesclin avec lui, devant Châteauneuf-de-Randon. Le nouveau roi, Charles VI, n\'a que onze ans : ses oncles, les ducs de Bourgogne, de Berry et d\'Anjou, gouvernent à sa place… et se disputent le trésor.',
        'Charles V is dead, and Du Guesclin with him, before Châteauneuf-de-Randon. The new king, Charles VI, is only eleven: his uncles, the Dukes of Burgundy, Berry and Anjou, rule in his place… and quarrel over the treasury.'),
      todo: tr('Un roi enfant, des oncles avides : garde un œil sur Dijon.', 'A child king, greedy uncles: keep an eye on Dijon.'),
    },
    flandre: {
      date: tr('1384', '1384'),
      title: tr('La Flandre bourguignonne', 'Burgundian Flanders'),
      text: tr('Le comte de Flandre est mort. Sa fille Marguerite a épousé le duc Philippe le Hardi : la Flandre, ses villes drapières et ses ports passent à la Bourgogne, qui devient un État puissant entre la France et l\'Empire.',
        'The Count of Flanders is dead. His daughter Margaret married Duke Philip the Bold: Flanders, its cloth towns and its ports pass to Burgundy, which becomes a powerful state between France and the Empire.'),
      todo: tr('Ton vassal est devenu bien grand… est-il encore ton vassal ?', 'Your vassal has grown very large… is he still your vassal?'),
    },
    leulinghem: {
      date: tr('1389', '1389'),
      title: tr('La trêve de Leulinghem', 'The Truce of Leulinghem'),
      text: tr('Les deux royaumes sont las. À Leulinghem, entre Calais et Boulogne, on signe une longue trêve.',
        'Both kingdoms are weary. At Leulinghem, between Calais and Boulogne, a long truce is signed.'),
      todo: tr('Bâtis tant que les épées dorment.', 'Build while the swords sleep.'),
    },
    folie: {
      date: tr('Août 1392', 'August 1392'),
      title: tr('La folie du roi', 'The madness of the king'),
      text: tr('Dans la forêt du Mans, un page a laissé tomber sa lance : le roi Charles VI, pris de folie, a tiré l\'épée et tué quatre de ses compagnons. Depuis, ses crises reviennent : il se croit de verre, et ne reconnaît plus la reine.',
        'In the forest of Le Mans, a page dropped his lance: King Charles VI, seized by madness, drew his sword and killed four of his companions. Since then, his fits keep returning: he believes himself made of glass, and no longer recognises the queen.'),
      todo: tr('Quand le roi s\'égare, le royaume vacille : tiens bon entre deux crises.', 'When the king wanders, the kingdom totters: hold firm between two fits.'),
    },
    armagnacs: {
      date: tr('Novembre 1407', 'November 1407'),
      title: tr('Armagnacs et Bourguignons', 'Armagnacs and Burgundians'),
      text: tr('Rue Vieille-du-Temple, à Paris, des hommes masqués ont assassiné le duc Louis d\'Orléans, frère du roi. Le duc de Bourgogne, Jean sans Peur, avoue le crime. La guerre civile éclate : Armagnacs contre Bourguignons.',
        'In the Rue Vieille-du-Temple, in Paris, masked men have murdered Duke Louis of Orléans, the king\'s brother. The Duke of Burgundy, John the Fearless, admits the crime. Civil war breaks out: Armagnacs against Burgundians.'),
      todo: tr('Un royaume divisé est une proie facile pour qui attend de l\'autre côté de la mer.',
        'A divided kingdom is easy prey for whoever waits on the other side of the sea.'),
    },
    azincourt: {
      date: tr('Août 1415', 'August 1415'),
      title: tr('Henri V débarque à Harfleur', 'Henry V lands at Harfleur'),
      text: tr('Le jeune roi Henri V a profité de nos divisions : il a débarqué avec {army} hommes près de {city}. Ses archers sont aussi redoutables que ceux de son arrière-grand-père.',
        'The young King Henry V has taken advantage of our divisions: he has landed with {army} men near {city}. His archers are as fearsome as those of his great-grandfather.'),
      todo: tr('Les champs boueux de l\'Artois ont la mémoire courte… mais pas les archers.',
        'The muddy fields of Artois have short memories… but archers do not.'),
    },
    montereau: {
      date: tr('Septembre 1419', 'September 1419'),
      title: tr('Le pont de Montereau', 'The bridge at Montereau'),
      text: tr('Sur le pont de Montereau, pendant une entrevue, les hommes du dauphin ont tué Jean sans Peur. Son fils, Philippe le Bon, ne pardonnera pas : la Bourgogne s\'allie au roi d\'Angleterre.',
        'On the bridge at Montereau, during a meeting, the dauphin\'s men killed John the Fearless. His son, Philip the Good, will not forgive: Burgundy allies with the King of England.'),
      todo: tr('Le sang versé sur ce pont coulera longtemps.', 'The blood shed on that bridge will flow for a long time.'),
    },
    troyes: {
      date: tr('Mai 1420', 'May 1420'),
      title: tr('Le traité de Troyes', 'The Treaty of Troyes'),
      text: tr('À Troyes, la reine Isabeau a signé : Henri V épousera sa fille Catherine et sera roi de France à la mort de Charles VI. Le dauphin est déshérité. Il n\'y aura bientôt plus qu\'un seul royaume, et il sera anglais.',
        'At Troyes, Queen Isabeau has signed: Henry V will marry her daughter Catherine and become King of France on the death of Charles VI. The dauphin is disinherited. Soon there will be only one kingdom, and it will be English.'),
      todo: tr('Un parchemin ne fait pas un roi : seul le sacre le fait.', 'A parchment does not make a king: only the coronation does.'),
    },
    charles7: {
      date: tr('Octobre 1422', 'October 1422'),
      title: tr('Le petit roi de Bourges', 'The little king of Bourges'),
      text: tr('Henri V et Charles VI sont morts la même année. À Paris, on proclame roi un enfant anglais de dix mois, Henri VI. Au sud de la Loire, le dauphin se dit roi sous le nom de Charles VII : ses ennemis se moquent du « petit roi de Bourges ».',
        'Henry V and Charles VI have died in the same year. In Paris, a ten-month-old English child, Henry VI, is proclaimed king. South of the Loire, the dauphin calls himself king under the name of Charles VII: his enemies mock the "little king of Bourges".'),
      todo: tr('Un roi qui n\'est pas sacré à Reims n\'est roi qu\'à moitié.', 'A king not crowned at Reims is only half a king.'),
    },
    orleans: {
      date: tr('Octobre 1428', 'October 1428'),
      title: tr('Le siège d\'Orléans', 'The siege of Orléans'),
      text: tr('{army} Anglais marchent sur Orléans, la clé de la Loire. Si elle tombe, plus rien ne les sépare de Bourges.',
        '{army} Englishmen march on Orléans, the key to the Loire. If it falls, nothing will stand between them and Bourges.'),
      todo: tr('On murmure qu\'une jeune fille de Lorraine entend des voix…', 'They whisper that a young girl from Lorraine hears voices…'),
    },
    jeanne: {
      date: tr('Mars 1429', 'March 1429'),
      title: tr('Jeanne d\'Arc', 'Joan of Arc'),
      text: tr('À Chinon, une jeune fille de dix-sept ans venue de Domrémy a reconnu le roi caché parmi ses courtisans. Elle dit que Dieu l\'envoie pour bouter les Anglais hors de France et mener le roi à Reims. Vêtue en homme, son étendard à la main, elle demande une armée.',
        'At Chinon, a seventeen-year-old girl from Domrémy recognised the king hidden among his courtiers. She says God sends her to drive the English out of France and lead the king to Reims. Dressed as a man, her standard in hand, she asks for an army.'),
      todo: tr('Là où va son étendard, les murailles tremblent… mais qu\'on ne la laisse pas seule devant l\'ennemi.',
        'Where her standard goes, walls tremble… but let her never be left alone before the enemy.'),
    },
    joanCaptured: {
      date: tr('Compiègne, mai 1430', 'Compiègne, May 1430'),
      title: tr('Jeanne est prise', 'Joan is captured'),
      text: tr('Sous les murs de Compiègne, Jeanne a été désarçonnée et prise par les Bourguignons, qui l\'ont vendue aux Anglais. Elle sera jugée à Rouen pour hérésie, et brûlée vive sur la place du Vieux-Marché.',
        'Beneath the walls of Compiègne, Joan was unhorsed and taken by the Burgundians, who sold her to the English. She will be tried at Rouen for heresy, and burned alive in the Old Market square.'),
      todo: tr('Son étendard est tombé, mais la flamme qu\'elle a allumée ne s\'éteindra pas.', 'Her standard has fallen, but the flame she lit will not go out.'),
    },
    arras: {
      date: tr('Septembre 1435', 'September 1435'),
      title: tr('Le traité d\'Arras', 'The Treaty of Arras'),
      text: tr('À Arras, Philippe le Bon a fait la paix avec le roi de France : la Bourgogne abandonne l\'alliance anglaise. Privés de leur meilleur allié, les Anglais doivent maintenant se battre seuls.',
        'At Arras, Philip the Good has made peace with the King of France: Burgundy abandons the English alliance. Deprived of their best ally, the English must now fight alone.'),
      todo: tr('Le vent a tourné : il souffle maintenant vers la mer.', 'The wind has turned: it now blows towards the sea.'),
    },
    arrasFailed: {
      date: tr('Septembre 1435', 'September 1435'),
      title: tr('L\'échec d\'Arras', 'The failure of Arras'),
      text: tr('À Arras, les envoyés du roi ont tenté de ramener la Bourgogne, mais le duc Philippe le Bon a jugé le roi d\'Angleterre plus puissant : il reste à ses côtés.',
        'At Arras, the king\'s envoys tried to win Burgundy back, but Duke Philip the Good judged the King of England more powerful: he remains at his side.'),
      todo: tr('Un duc se range toujours du côté de la couronne la plus solide.', 'A duke always sides with the steadiest crown.'),
    },
    bureau: {
      date: tr('1439', '1439'),
      title: tr('L\'artillerie des frères Bureau', 'The artillery of the Bureau brothers'),
      text: tr('Jean et Gaspard Bureau, deux bourgeois de Paris, ont fondu pour le roi des bombardes et des couleuvrines. Leurs boulets de pierre et de fer abattent en quelques jours des murailles qui résistaient des mois.',
        'Jean and Gaspard Bureau, two burghers of Paris, have cast bombards and culverins for the king. Their stone and iron balls bring down in a few days walls that once resisted for months.'),
      todo: tr('Les vieilles murailles ne protègent plus personne… surtout pas les Anglais.', 'The old walls protect no one any more… least of all the English.'),
    },
    castillon: {
      date: tr('17 juillet 1453', '17 July 1453'),
      title: tr('Castillon', 'Castillon'),
      text: tr('Près de Castillon, sur la Dordogne, le vieux Talbot a chargé les canons français : il y est mort avec la fleur de l\'armée anglaise. Les chroniqueurs écriront que la longue guerre s\'achève ici, après cent seize ans.',
        'Near Castillon, on the Dordogne, old Talbot charged the French cannons: he died there with the flower of the English army. The chroniclers will write that the long war ends here, after one hundred and sixteen years.'),
      todo: tr('Les chroniques retiendront ce que tu auras accompli.', 'The chronicles will remember what you have accomplished.'),
    },
    sacre: {
      date: tr('Reims', 'Reims'),
      title: tr('Le sacre', 'The coronation'),
      text: tr('Dans la cathédrale de Reims, l\'archevêque a oint le roi de la sainte ampoule, comme Clovis jadis. Désormais, nul ne peut douter qu\'il est le vrai roi de France.',
        'In the cathedral of Reims, the archbishop has anointed the king with the holy ampulla, as Clovis was long ago. From now on, no one can doubt that he is the true King of France.'),
      todo: tr('Ta Légitimité grandit de {legit}.', 'Your Legitimacy grows by {legit}.'),
    },
  },

  // 👑 Les objectifs de chaque faction jouable (dans le cadre en haut à gauche) : tous remplis en même temps, c'est
  // la victoire. Un objectif rempli est barré, avec un ✔ ; il se perd si on perd la ville, l'allié…
  //  - city : tenir ces villes (noms, voir les factions) ; church : tenir cette église ;
  //  - vassal : ce vassal est dans ton camp, ou tu tiens sa capitale ;
  //  - crowned : être sacré à Reims (et tenir Reims) ; legit : avoir cette Légitimité ;
  //  - noEnglish : plus aucune terre au roi d'Angleterre sur le continent ; ports : tenir n ports de la Manche ;
  //  - citadel : avoir une ville de ce niveau ; allyCity : cette ville est à toi ou à ton camp.
  //  (goal : selon la difficulté, { facile, normal, difficile } ; « {n} » dans le texte devient ce nombre)
  OBJECTIVES: {
    france: {
      title: tr('⚜️ Délivrer le royaume', '⚜️ Deliver the kingdom'),
      list: [
        { kind: 'city', cities: ['Paris'], text: tr('Tenir Paris', 'Hold Paris') },
        { kind: 'crowned', text: tr('Être sacré à Reims', 'Be crowned at Reims') },
        { kind: 'city', cities: ['Rouen', 'Caen'], text: tr('Tenir la Normandie : Rouen et Caen (1450)', 'Hold Normandy: Rouen and Caen (1450)') },
        { kind: 'city', cities: ['Bordeaux'], text: tr('Reprendre la Guyenne : Bordeaux (1453)', 'Retake Guyenne: Bordeaux (1453)') },
        { kind: 'city', cities: ['Calais'], text: tr('Tenir Calais', 'Hold Calais') },
        { kind: 'vassal', role: 'bourgogne', text: tr('Rallier ou soumettre la Bourgogne', 'Win over or subdue Burgundy') },
        { kind: 'vassal', role: 'bretagne', text: tr('Rallier ou soumettre la Bretagne', 'Win over or subdue Brittany') },
        { kind: 'legit', goal: { facile: 400, normal: 480, difficile: 560 }, text: tr('Être le vrai roi : {n} de Légitimité', 'Be the true king: {n} Legitimacy') },
        { kind: 'noEnglish', text: tr('Bouter l\'Anglais hors du royaume : plus une terre anglaise sur le continent', 'Drive the English out of the kingdom: not one English land left on the continent') },
      ],
    },
    angleterre: {
      title: tr('🦁 La couronne de France', '🦁 The crown of France'),
      list: [
        { kind: 'city', cities: ['Londres'], text: tr('Tenir Londres', 'Hold London') },
        { kind: 'city', cities: ['Bordeaux', 'Bayonne'], text: tr('Garder la Guyenne : Bordeaux et Bayonne', 'Keep Guyenne: Bordeaux and Bayonne') },
        { kind: 'ports', goal: { facile: 2, normal: 3, difficile: 3 }, text: tr('Tenir {n} ports de la Manche (Calais, Harfleur, Cherbourg, Abbeville, Dunkerque)', 'Hold {n} Channel ports (Calais, Harfleur, Cherbourg, Abbeville, Dunkirk)') },
        { kind: 'city', cities: ['Rouen', 'Caen'], text: tr('Conquérir la Normandie : Rouen et Caen (1419)', 'Conquer Normandy: Rouen and Caen (1419)') },
        { kind: 'city', cities: ['Paris'], text: tr('Entrer dans Paris (1420)', 'Enter Paris (1420)') },
        { kind: 'crowned', text: tr('Être sacré roi de France à Reims', 'Be crowned King of France at Reims') },
        { kind: 'vassal', role: 'bourgogne', text: tr('Rallier ou soumettre la Bourgogne', 'Win over or subdue Burgundy') },
        { kind: 'legit', goal: { facile: 350, normal: 420, difficile: 500 }, text: tr('Être le vrai roi : {n} de Légitimité', 'Be the true king: {n} Legitimacy') },
      ],
    },
    bourgogne: {
      title: tr('🍇 Le grand État bourguignon', '🍇 The great Burgundian state'),
      list: [
        { kind: 'city', cities: ['Dijon'], text: tr('Tenir Dijon', 'Hold Dijon') },
        { kind: 'city', cities: ['Gand', 'Bruges'], text: tr('Tenir la Flandre : Gand et Bruges (1384)', 'Hold Flanders: Ghent and Bruges (1384)') },
        { kind: 'city', cities: ['Bruxelles'], text: tr('Prendre le Brabant : Bruxelles (1430)', 'Take Brabant: Brussels (1430)') },
        { kind: 'city', cities: ['Luxembourg'], text: tr('Prendre Luxembourg (1443)', 'Take Luxembourg (1443)') },
        { kind: 'city', cities: ['Nancy'], text: tr('Prendre la Lorraine : Nancy', 'Take Lorraine: Nancy') },
        { kind: 'city', cities: ['Paris'], text: tr('Tenir Paris (1418)', 'Hold Paris (1418)') },
        { kind: 'citadel', goal: { facile: 3, normal: 4, difficile: 4 }, text: tr('Une cour fastueuse : une ville de niveau {n}', 'A lavish court: a level {n} city') },
        { kind: 'legit', goal: { facile: 220, normal: 280, difficile: 340 }, text: tr('Le grand duc d\'Occident : {n} de Légitimité', 'The Grand Duke of the West: {n} Legitimacy') },
      ],
    },
    bretagne: {
      title: tr('🐾 La Bretagne libre', '🐾 Free Brittany'),
      list: [
        { kind: 'city', cities: ['Rennes'], text: tr('Tenir Rennes', 'Hold Rennes') },
        { kind: 'city', cities: ['Nantes'], text: tr('Tenir Nantes', 'Hold Nantes') },
        { kind: 'city', cities: ['Brest'], text: tr('Tenir Brest (anglaise de 1342 à 1397)', 'Hold Brest (English from 1342 to 1397)') },
        { kind: 'city', cities: ['Rennes', 'Nantes', 'Vannes', 'Brest', 'Quimper', 'Saint-Malo'], text: tr('Garder tout le duché : ses 6 villes', 'Keep the whole duchy: its 6 cities') },
        { kind: 'church', name: 'Mont-Saint-Michel', text: tr('Prendre le Mont-Saint-Michel', 'Take Mont-Saint-Michel') },
        { kind: 'citadel', goal: { facile: 3, normal: 4, difficile: 4 }, text: tr('Une capitale ducale : une ville de niveau {n}', 'A ducal capital: a level {n} city') },
        { kind: 'legit', goal: { facile: 180, normal: 230, difficile: 280 }, text: tr('Un duc souverain : {n} de Légitimité', 'A sovereign duke: {n} Legitimacy') },
      ],
    },
    ecosse: {
      title: tr('🦄 Le royaume d\'Écosse', '🦄 The kingdom of Scotland'),
      list: [
        { kind: 'city', cities: ['Édimbourg'], text: tr('Tenir Édimbourg', 'Hold Edinburgh') },
        { kind: 'city', cities: ['Stirling', 'Perth'], text: tr('Tenir Stirling et Perth', 'Hold Stirling and Perth') },
        { kind: 'city', cities: ['Berwick'], text: tr('Reprendre Berwick (1461)', 'Retake Berwick (1461)') },
        { kind: 'city', cities: ['Carlisle', 'Newcastle'], text: tr('Prendre les marches du Nord : Carlisle et Newcastle', 'Take the northern marches: Carlisle and Newcastle') },
        { kind: 'city', cities: ['York'], text: tr('Prendre York', 'Take York') },
        { kind: 'allyCity', city: 'Paris', text: tr('L\'Auld Alliance : que Paris reste au roi de France', 'The Auld Alliance: Paris must stay with the King of France') },
        { kind: 'legit', goal: { facile: 180, normal: 230, difficile: 280 }, text: tr('Un roi respecté : {n} de Légitimité', 'A respected king: {n} Legitimacy') },
      ],
    },
  },

  // Les factions de 1337 (l'ordre compte : une case va à la première dont un contour la contient)
  factions: [
    {
      id: 'avignon', name: tr('Papauté d\'Avignon', 'Papacy of Avignon'), leader: tr('le pape Benoît XII', 'Pope Benedict XII'), flag: 'b20', color: [168, 28, 84],
      defensive: true, noArmy: true, production: true, garrison: 3,
      capital: [4.81, 43.95, tr('Avignon', 'Avignon'), 'Avignon'], capitalLevel: 3, cities: [], churches: [],
      // le Comtat Venaissin
      lands: [[[4.62, 43.86], [4.68, 44.42], [5.3, 44.42], [5.38, 43.95], [4.95, 43.8]]],
      desc: tr('Le pape, installé à Avignon, sert de médiateur entre les deux rois.', 'The pope, settled at Avignon, mediates between the two kings.'),
    },
    {
      id: 'navarre', name: tr('Navarre', 'Navarre'), leader: tr('la reine Jeanne II', 'Queen Joan II'), flag: 'b15', color: [40, 150, 150],
      vassal: true, legit: 0,
      capital: [-1.64, 42.81, tr('Pampelune', 'Pamplona'), 'Pampelune'], cities: [[-1.60, 42.06, tr('Tudela', 'Tudela'), 'Tudela'], [1.15, 49.02, tr('Évreux', 'Évreux'), 'Évreux']],
      churches: [[-1.32, 43.01, tr('Roncevaux', 'Roncevaux'), 'Roncevaux']],
      // (le comté d'Évreux, au cœur de la Normandie, appartient au roi de Navarre)
      enclaves: [[1.15, 49.02, 9]],
      lands: [[[-2.2, 43.2], [-1.4, 43.28], [-0.85, 43.0], [-1.0, 42.4], [-1.5, 41.92], [-1.95, 41.98], [-2.4, 42.5]]],
      desc: tr('Le petit royaume pyrénéen, qui tient aussi le comté d\'Évreux en Normandie.', 'The small Pyrenean kingdom, which also holds the county of Évreux in Normandy.'),
    },
    {
      id: 'flandre', name: tr('Flandre', 'Flanders'), leader: tr('le comte Louis de Nevers', 'Count Louis of Nevers'), flag: 'b12', color: [238, 206, 48],
      vassal: true, legit: 35, production: true,
      capital: [3.72, 51.05, tr('Gand', 'Ghent'), 'Gand'], capitalLevel: 3,
      cities: [[3.22, 51.21, tr('Bruges', 'Bruges'), 'Bruges'], [2.89, 50.85, tr('Ypres', 'Ypres'), 'Ypres'], [2.38, 51.03, tr('Dunkerque', 'Dunkirk'), 'Dunkerque']],
      churches: [[3.26, 50.83, tr('Courtrai', 'Kortrijk'), 'Courtrai']],
      lands: [[[2.1, 51.2], [2.55, 50.85], [2.9, 50.68], [3.3, 50.72], [3.9, 50.78], [4.15, 51.0], [4.3, 51.38], [3.4, 51.5]]],
      desc: tr('Le riche comté des villes drapières, qui vivent de la laine anglaise.', 'The rich county of the cloth towns, which live on English wool.'),
    },
    {
      id: 'bretagne', name: tr('Bretagne', 'Brittany'), leader: tr('le duc Jean III', 'Duke John III'), flag: 'b18', color: [236, 232, 218],
      vassal: true, legit: 40, playable: true,
      capital: [-1.68, 48.11, tr('Rennes', 'Rennes'), 'Rennes'],
      cities: [[-1.55, 47.22, tr('Nantes', 'Nantes'), 'Nantes'], [-2.76, 47.66, tr('Vannes', 'Vannes'), 'Vannes'], [-4.49, 48.39, tr('Brest', 'Brest'), 'Brest'],
        [-2.01, 48.65, tr('Saint-Malo', 'Saint-Malo'), 'Saint-Malo'], [-4.10, 48.0, tr('Quimper', 'Quimper'), 'Quimper']],
      churches: [[-3.98, 48.68, tr('Saint-Pol-de-Léon', 'Saint-Pol-de-Léon'), 'Saint-Pol-de-Léon'], [-3.23, 48.78, tr('Tréguier', 'Tréguier'), 'Tréguier'], [-2.08, 47.65, tr('Redon', 'Redon'), 'Redon']],
      lands: [[[-1.0, 47.0], [-1.25, 47.8], [-1.05, 48.35], [-1.45, 48.68], [-5.6, 49.0], [-5.6, 47.2], [-2.2, 47.0]]],
      desc: tr('Le duché de Bretagne, fier de ses libertés, entre la France et l\'Angleterre.', 'The duchy of Brittany, proud of its liberties, between France and England.'),
    },
    {
      id: 'bourgogne', name: tr('Bourgogne', 'Burgundy'), leader: tr('le duc Eudes IV', 'Duke Odo IV'), flag: 'b06', color: [126, 52, 152],
      vassal: true, legit: 60, playable: true,
      capital: [5.04, 47.32, tr('Dijon', 'Dijon'), 'Dijon'],
      cities: [[4.85, 46.78, tr('Chalon', 'Chalon'), 'Chalon'], [6.02, 47.24, tr('Besançon', 'Besançon'), 'Besançon'], [3.57, 47.80, tr('Auxerre', 'Auxerre'), 'Auxerre']],
      churches: [[4.30, 46.95, tr('Autun', 'Autun'), 'Autun'], [4.66, 46.43, tr('Cluny', 'Cluny'), 'Cluny'], [5.49, 47.09, tr('Dole', 'Dole'), 'Dole']],
      // le duché et le comté de Bourgogne (la Franche-Comté)
      lands: [[[3.3, 47.9], [4.2, 48.1], [5.3, 47.85], [5.7, 48.0], [6.6, 47.95], [7.0, 47.5], [6.5, 46.9], [6.1, 46.4],
        [5.4, 46.3], [4.8, 46.2], [4.4, 46.3], [4.0, 46.7], [3.6, 47.2]]],
      desc: tr('Le duché de Bourgogne et la Franche-Comté : le plus puissant vassal du roi.', 'The duchy of Burgundy and Franche-Comté: the king\'s mightiest vassal.'),
    },
    {
      id: 'angleterre', name: tr('Angleterre', 'England'), leader: tr('le roi Édouard III', 'King Edward III'), flag: 'b03', color: [196, 30, 44],
      playable: true, camp: 'angleterre',
      capital: [-0.12, 51.51, tr('Londres', 'London'), 'Londres'], capitalLevel: 3,
      cities: [[-1.08, 53.96, tr('York', 'York'), 'York'], [-1.31, 51.06, tr('Winchester', 'Winchester'), 'Winchester'], [-2.59, 51.45, tr('Bristol', 'Bristol'), 'Bristol'],
        [1.30, 52.63, tr('Norwich', 'Norwich'), 'Norwich'], [-1.61, 54.97, tr('Newcastle', 'Newcastle'), 'Newcastle'], [-2.89, 53.19, tr('Chester', 'Chester'), 'Chester'],
        [-3.53, 50.72, tr('Exeter', 'Exeter'), 'Exeter'], [-2.00, 55.77, tr('Berwick', 'Berwick'), 'Berwick'], [-2.93, 54.89, tr('Carlisle', 'Carlisle'), 'Carlisle'],
        [1.31, 51.13, tr('Douvres', 'Dover'), 'Douvres'], [-4.27, 53.14, tr('Caernarfon', 'Caernarfon'), 'Caernarfon'], [-6.26, 53.35, tr('Dublin', 'Dublin'), 'Dublin'],
        [-0.58, 44.84, tr('Bordeaux', 'Bordeaux'), 'Bordeaux'], [-1.47, 43.49, tr('Bayonne', 'Bayonne'), 'Bayonne'], [1.83, 50.11, tr('Abbeville', 'Abbeville'), 'Abbeville']],
      churches: [[1.08, 51.28, tr('Cantorbéry', 'Canterbury'), 'Cantorbéry'], [-1.79, 51.07, tr('Salisbury', 'Salisbury'), 'Salisbury'], [-1.26, 51.75, tr('Oxford', 'Oxford'), 'Oxford'],
        [-0.54, 53.23, tr('Lincoln', 'Lincoln'), 'Lincoln'], [-1.05, 43.71, tr('Dax', 'Dax'), 'Dax']],
      // (le comté de Ponthieu, autour d'Abbeville : anglais depuis 1279)
      enclaves: [[1.83, 50.11, 9]],
      lands: [
        // l'Angleterre et le pays de Galles, jusqu'à la Tweed (Berwick comprise)
        [[-6.0, 49.8], [2.2, 49.8], [2.2, 53.5], [-1.0, 55.2], [-1.8, 55.95], [-2.15, 55.85], [-2.6, 55.62], [-2.3, 55.35],
          [-2.65, 55.15], [-3.05, 55.05], [-3.6, 54.98], [-6.0, 54.6]],
        // la seigneurie d'Irlande (le Pale, autour de Dublin)
        [[-5.8, 52.1], [-5.8, 54.05], [-6.7, 54.0], [-7.0, 53.4], [-7.1, 52.6], [-7.1, 52.1]],
        // la Guyenne (le Bordelais, les Landes, Bayonne)
        [[-1.6, 45.6], [-0.6, 45.55], [-0.1, 45.2], [0.25, 44.75], [0.3, 44.3], [-0.1, 43.9], [-0.4, 43.55], [-1.0, 43.35], [-1.6, 43.28], [-1.9, 43.45]],
      ],
      desc: tr('Le royaume d\'Angleterre, la Guyenne et le Ponthieu : Édouard III revendique la couronne de France.', 'The kingdom of England, Guyenne and Ponthieu: Edward III claims the crown of France.'),
    },
    {
      id: 'france', name: tr('France', 'France'), leader: tr('le roi Philippe VI', 'King Philip VI'), flag: 'b08', color: [32, 66, 170],
      playable: true, camp: 'france',
      capital: [2.35, 48.86, tr('Paris', 'Paris'), 'Paris'], capitalLevel: 3,
      cities: [[1.10, 49.44, tr('Rouen', 'Rouen'), 'Rouen'], [-0.37, 49.18, tr('Caen', 'Caen'), 'Caen'], [1.86, 50.95, tr('Calais', 'Calais'), 'Calais'],
        [2.30, 49.89, tr('Amiens', 'Amiens'), 'Amiens'], [4.03, 49.26, tr('Reims', 'Reims'), 'Reims'], [4.08, 48.30, tr('Troyes', 'Troyes'), 'Troyes'],
        [1.91, 47.90, tr('Orléans', 'Orléans'), 'Orléans'], [0.69, 47.39, tr('Tours', 'Tours'), 'Tours'], [2.40, 47.08, tr('Bourges', 'Bourges'), 'Bourges'],
        [0.34, 46.58, tr('Poitiers', 'Poitiers'), 'Poitiers'], [-1.15, 46.16, tr('La Rochelle', 'La Rochelle'), 'La Rochelle'], [1.26, 45.83, tr('Limoges', 'Limoges'), 'Limoges'],
        [4.83, 45.76, tr('Lyon', 'Lyon'), 'Lyon'], [1.44, 43.60, tr('Toulouse', 'Toulouse'), 'Toulouse'], [2.35, 43.21, tr('Carcassonne', 'Carcassonne'), 'Carcassonne'],
        [3.06, 50.63, tr('Lille', 'Lille'), 'Lille'], [0.20, 49.51, tr('Harfleur', 'Harfleur'), 'Harfleur'], [-1.62, 49.64, tr('Cherbourg', 'Cherbourg'), 'Cherbourg'],
        [3.08, 45.78, tr('Clermont', 'Clermont'), 'Clermont']],
      churches: [[1.49, 48.45, tr('Chartres', 'Chartres'), 'Chartres'], [2.08, 49.43, tr('Beauvais', 'Beauvais'), 'Beauvais'], [0.20, 48.0, tr('Le Mans', 'Le Mans'), 'Le Mans'],
        [-0.55, 47.47, tr('Angers', 'Angers'), 'Angers'], [2.15, 43.93, tr('Albi', 'Albi'), 'Albi'], [3.88, 45.04, tr('Le Puy', 'Le Puy'), 'Le Puy'],
        [3.28, 48.20, tr('Sens', 'Sens'), 'Sens'], [3.62, 49.56, tr('Laon', 'Laon'), 'Laon'], [3.16, 46.99, tr('Nevers', 'Nevers'), 'Nevers'],
        [-1.51, 48.64, tr('Mont-Saint-Michel', 'Mont-Saint-Michel'), 'Mont-Saint-Michel'], [0.24, 47.17, tr('Chinon', 'Chinon'), 'Chinon']],
      // le royaume de France (les grands fiefs, plus haut dans la liste, en sont retirés)
      lands: [[[-5.6, 48.9], [-5.6, 51.3], [1.5, 51.3], [2.5, 51.15], [3.9, 50.8], [4.2, 50.0], [4.9, 49.8], [5.1, 49.3], [5.3, 48.6],
        [5.4, 48.0], [4.85, 46.2], [4.85, 45.7], [4.8, 45.0], [4.75, 44.2], [4.65, 43.6], [4.6, 43.0], [3.1, 42.95], [1.7, 42.7],
        [0.7, 42.8], [-0.8, 42.9], [-1.0, 43.25], [-1.8, 43.4], [-5.6, 45.5]]],
      desc: tr('Tu es Philippe VI de Valois, roi de France. Édouard III d\'Angleterre te dispute ta couronne : défends le royaume, rallie tes grands vassaux, et bouter l\'Anglais hors de France !',
        'You are Philip VI of Valois, King of France. Edward III of England disputes your crown: defend the kingdom, win over your great vassals, and drive the English out of France!'),
    },
    {
      id: 'empire', name: tr('Saint-Empire', 'Holy Roman Empire'), leader: tr('l\'empereur Louis IV', 'Emperor Louis IV'), flag: 'b10', color: [124, 124, 132],
      defensive: true, production: true,
      capital: [6.08, 50.78, tr('Aix-la-Chapelle', 'Aachen'), 'Aix-la-Chapelle'], capitalLevel: 3,
      cities: [[4.35, 50.85, tr('Bruxelles', 'Brussels'), 'Bruxelles'], [5.57, 50.63, tr('Liège', 'Liège'), 'Liège'], [6.18, 49.12, tr('Metz', 'Metz'), 'Metz'],
        [6.13, 49.61, tr('Luxembourg', 'Luxembourg'), 'Luxembourg'], [6.18, 48.69, tr('Nancy', 'Nancy'), 'Nancy'], [7.75, 48.58, tr('Strasbourg', 'Strasbourg'), 'Strasbourg'],
        [6.96, 50.94, tr('Cologne', 'Cologne'), 'Cologne'], [7.59, 47.56, tr('Bâle', 'Basel'), 'Bâle'], [6.14, 46.20, tr('Genève', 'Geneva'), 'Genève'],
        [5.72, 45.19, tr('Grenoble', 'Grenoble'), 'Grenoble'], [5.37, 43.30, tr('Marseille', 'Marseille'), 'Marseille'], [5.12, 52.09, tr('Utrecht', 'Utrecht'), 'Utrecht'],
        [4.40, 51.22, tr('Anvers', 'Antwerp'), 'Anvers'], [5.92, 45.57, tr('Chambéry', 'Chambéry'), 'Chambéry']],
      churches: [[8.27, 50.00, tr('Mayence', 'Mainz'), 'Mayence'], [6.64, 49.75, tr('Trèves', 'Trier'), 'Trèves'], [5.79, 43.53, tr('Aix-en-Provence', 'Aix-en-Provence'), 'Aix-en-Provence']],
      // les Pays-Bas, la Lorraine, l'Alsace, la Suisse, la Savoie, le Dauphiné et la Provence : les terres d'Empire
      lands: [[[3.9, 50.8], [4.4, 53.8], [9.5, 53.8], [9.5, 42.8], [4.6, 42.8], [4.65, 43.6], [4.75, 44.2], [4.8, 45.0], [4.85, 45.7],
        [4.85, 46.2], [5.4, 48.0], [5.3, 48.6], [5.1, 49.3], [4.9, 49.8], [4.2, 50.0]]],
      desc: tr('Les terres d\'Empire, de la Hollande à la Provence : une mosaïque de princes qui regardent la guerre.', 'The lands of the Empire, from Holland to Provence: a mosaic of princes watching the war.'),
    },
    {
      id: 'aragon', name: tr('Aragon', 'Aragon'), leader: tr('le roi Pierre IV', 'King Peter IV'), flag: 'b11', color: [232, 168, 64],
      defensive: true,
      capital: [-0.88, 41.65, tr('Saragosse', 'Zaragoza'), 'Saragosse'], capitalLevel: 3,
      cities: [[2.17, 41.39, tr('Barcelone', 'Barcelona'), 'Barcelone'], [-0.41, 42.14, tr('Huesca', 'Huesca'), 'Huesca'], [0.62, 41.62, tr('Lérida', 'Lleida'), 'Lérida'],
        [2.90, 42.70, tr('Perpignan', 'Perpignan'), 'Perpignan']],
      churches: [[1.84, 41.59, tr('Montserrat', 'Montserrat'), 'Montserrat'], [-0.55, 42.57, tr('Jaca', 'Jaca'), 'Jaca']],
      lands: [[[-1.7, 41.0], [-1.5, 41.92], [-1.0, 42.4], [-0.85, 42.9], [0.7, 42.82], [1.7, 42.72], [2.1, 42.9], [3.1, 42.95], [3.7, 42.5], [3.7, 41.0]]],
      desc: tr('La couronne d\'Aragon, puissance de la Méditerranée.', 'The Crown of Aragon, a Mediterranean power.'),
    },
    {
      id: 'castille', name: tr('Castille', 'Castile'), leader: tr('le roi Alphonse XI', 'King Alfonso XI'), flag: 'b13', color: [150, 96, 52],
      defensive: true,
      capital: [-3.70, 42.34, tr('Burgos', 'Burgos'), 'Burgos'], capitalLevel: 3,
      cities: [[-5.57, 42.60, tr('León', 'León'), 'León'], [-4.72, 41.65, tr('Valladolid', 'Valladolid'), 'Valladolid'], [-3.81, 43.46, tr('Santander', 'Santander'), 'Santander'],
        [-5.84, 43.36, tr('Oviedo', 'Oviedo'), 'Oviedo'], [-8.40, 43.36, tr('La Corogne', 'A Coruña'), 'La Corogne'], [-2.67, 42.85, tr('Vitoria', 'Vitoria'), 'Vitoria'],
        [-2.46, 41.76, tr('Soria', 'Soria'), 'Soria']],
      churches: [[-8.54, 42.88, tr('Saint-Jacques', 'Santiago'), 'Saint-Jacques'], [-4.53, 42.01, tr('Palencia', 'Palencia'), 'Palencia']],
      lands: [[[-10.0, 41.85], [-6.2, 41.85], [-6.2, 41.0], [-1.7, 41.0], [-1.95, 41.98], [-2.4, 42.5], [-2.2, 43.2], [-1.75, 43.45], [-10.0, 44.2]]],
      desc: tr('Le royaume de Castille, dont les galères pèseront lourd sur la mer.', 'The kingdom of Castile, whose galleys will weigh heavily at sea.'),
    },
    {
      id: 'ecosse', name: tr('Écosse', 'Scotland'), leader: tr('le roi David II', 'King David II'), flag: 'b16', color: [96, 162, 214],
      playable: true, camp: 'france',
      capital: [-3.19, 55.95, tr('Édimbourg', 'Edinburgh'), 'Édimbourg'],
      cities: [[-3.94, 56.12, tr('Stirling', 'Stirling'), 'Stirling'], [-3.43, 56.40, tr('Perth', 'Perth'), 'Perth'], [-2.10, 57.15, tr('Aberdeen', 'Aberdeen'), 'Aberdeen'],
        [-4.22, 57.48, tr('Inverness', 'Inverness'), 'Inverness'], [-4.63, 55.46, tr('Ayr', 'Ayr'), 'Ayr']],
      churches: [[-2.80, 56.34, tr('Saint Andrews', 'St Andrews'), 'Saint Andrews'], [-4.25, 55.86, tr('Glasgow', 'Glasgow'), 'Glasgow'], [-3.32, 57.65, tr('Elgin', 'Elgin'), 'Elgin']],
      lands: [[[-3.05, 55.05], [-2.65, 55.15], [-2.3, 55.35], [-2.6, 55.62], [-2.15, 55.85], [-1.8, 55.95], [-1.0, 56.5], [0.0, 59.6],
        [-8.5, 59.6], [-8.5, 55.8], [-6.3, 55.55], [-5.85, 55.1], [-5.3, 54.55], [-3.6, 54.98]]],
      desc: tr('Le royaume d\'Écosse, vieil allié de la France contre l\'Angleterre : l\'Auld Alliance.', 'The kingdom of Scotland, France\'s old ally against England: the Auld Alliance.'),
    },
    {
      id: 'irlande', name: tr('Clans irlandais', 'Irish clans'), leader: tr('les rois gaéliques', 'the Gaelic kings'), flag: 'b05', color: [74, 150, 70],
      defensive: true,
      capital: [-6.77, 54.50, tr('Dungannon', 'Dungannon'), 'Dungannon'],
      cities: [[-8.63, 52.66, tr('Limerick', 'Limerick'), 'Limerick'], [-9.05, 53.27, tr('Galway', 'Galway'), 'Galway'], [-8.47, 54.27, tr('Sligo', 'Sligo'), 'Sligo']],
      churches: [[-7.99, 53.33, tr('Clonmacnoise', 'Clonmacnoise'), 'Clonmacnoise'], [-7.89, 52.52, tr('Cashel', 'Cashel'), 'Cashel']],
      lands: [[[-11.0, 51.2], [-11.0, 55.6], [-5.4, 55.6], [-5.4, 51.2]]],
      desc: tr('Les rois et les clans gaéliques d\'Irlande, hors du Pale anglais.', 'The Gaelic kings and clans of Ireland, outside the English Pale.'),
    },
    {
      // 🗡️ Les Grandes Compagnies : des routiers sans terres, qui surgissent ici ou là pour piller (voir COMPAGNIES)
      id: 'compagnies', name: tr('Grandes Compagnies', 'Great Companies'), leader: tr('les capitaines routiers', 'the mercenary captains'), flag: 'b17', color: [70, 60, 52],
      raiders: true, landless: true, noArmy: true, capital: null, cities: [], churches: [], lands: [],
      desc: tr('Des bandes de routiers sans solde, qui pillent le pays.', 'Bands of unpaid mercenaries who plunder the land.'),
    },
  ],
};

// Les bannières des factions (en attendant leurs vraies bannières : un des drapeaux du jeu, avec la couleur du royaume)
for (const f of CENTANS.factions) {
  BANNERS.push({ id: f.id, name: f.name, kingdom: f.name, set: 'centans', color: f.color,
    img: `img/bannieres/${f.flag}.webp`, icon: `img/bannieres/${f.flag}s.webp`, logo: `img/bannieres/${f.flag}m.webp` });
}
