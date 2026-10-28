// 👑 SCÉNARIO « CHARLEMAGNE » (768)
// Octobre 768 : Pépin le Bref vient de mourir. Son fils Charles (le futur Charlemagne) est sacré roi des Francs à
// Noyon ; son frère Carloman reçoit l'autre moitié du royaume. Autour d'eux : les Lombards du roi Didier, le pape à
// Rome, le duc Tassilon III en Bavière, les Saxons païens, les Avars, l'émirat omeyyade de Cordoue, les petits
// royaumes des Asturies et des Bretons, les Danois, les Anglo-Saxons d'Offa… et l'Empire byzantin à Constantinople.
// La carte : l'Europe de l'Ouest et la Méditerranée (voir generateCharlemagneMap, dans europemap.js).
//
// Chaque faction a :
//  - lands : son territoire en 768, en un ou plusieurs contours [longitude, latitude] (une case appartient à la
//    première faction de la liste qui la contient : l'ordre compte là où deux contours se chevauchent) ;
//  - capital et cities : ses villes (châteaux de niveau 1, sans moulin ni caserne ; la capitale au niveau 2, ou
//    capitalLevel) ; une ville peut avoir { level, garrison } : son niveau, et sa garnison (garrison fois plus forte
//    tant que la faction la tient) ;
//  - churches : 1 à 3 églises, aux bourgades notables de l'époque ;
//  - enclaves : des terres à elle au milieu de celles d'une autre ([longitude, latitude, rayon en cases]).
// playable : le joueur peut l'incarner (pas Rome, ni Byzance, ni Carloman) ; defensive : elle se défend, s'étend sur
// les terres libres, mais ne lance pas de conquêtes ; production : moulins et casernes de niveau 2 autour de la capitale.
// garrison : les garnisons de ses villes valent garrison fois plus, tant qu'elle les tient (les petits royaumes qui ont
// historiquement longtemps résisté : la Bavière, l'Aquitaine, les Asturies) ;
// spare : des voisins qu'elle attaque moins volontiers (Cordoue et les Asturies, dans leurs montagnes).
// flag : la bannière (img/bannieres/cm_<faction> : la vraie bannière de la faction) ; color : la couleur de son royaume.
// raiders : des pillards (les Slaves) : leurs terres sont imprenables, ils ne s'étendent pas, mais lancent des razzias
// (voir RAIDS).

const CHARLEMAGNE = {
  // Minutes de jeu avant la mort de Carloman (son royaume passe à Charlemagne, comme en 771), selon la difficulté
  CARLOMAN_DIES: { facile: 3, normal: 6, difficile: 10 },
  // Minutes de jeu avant que les Lombards ne marchent sur Rome (comme en 773), selon la difficulté
  LOMBARDS_MARCH: { facile: 18, normal: 12, difficile: 7 },
  LOMBARDS_WARNING: 30,     // secondes : on prévient le joueur un peu avant
  // Pour cette marche, Didier lève une grande armée (soldats, selon la difficulté), qui vient à bout de la garnison
  // de Rome (en Facile, une fois sur deux) : aux Francs de soumettre les Lombards avant, ou de défendre Rome pendant
  // le siège. Si Rome tombe (aux mains des Lombards ou de n'importe qui d'autre), l'objectif « Rome » est perdu pour
  // de bon (même si on la libère ensuite).
  // (cette armée suit le nombre de villes qu'ils tiennent encore : 2 villes sur 6, c'est 3 fois moins de soldats)
  LOMBARDS_ARMY: { facile: 5000, normal: 5500, difficile: 6500 },
  // Leur marche repoussée, les Lombards retentent leur chance, s'ils en ont les moyens : au plus une fois toutes les
  // EVERY secondes, quand leur armée atteint MIN fois celle de leur grande marche (2500 soldats sur 5000 : ils repartent)
  LOMBARDS_RETRY: { EVERY: 180, MIN: 0.5 },
  // Les frontières de 768 serpentent un peu (au lieu de suivre les lignes droites des contours, voir lands) : chaque
  // case est décalée de AMP cases au plus, par un bruit doux qui ondule sur environ SCALE cases
  BORDER_WARP: { AMP: 10, SCALE: 30 },
  START_ARMY: 0.35,         // au départ, chaque faction a 35 % de son armée maximum
  START_GOLD: 400,
  // Rome n'a pas d'armée (le pape ne recrute pas) : seulement une grande garnison, qui se reconstitue d'elle-même,
  // assez pour repousser les assauts du début (2500 soldats n'y suffisent pas), mais pas la grande armée lombarde
  ROME_GARRISON: 320,
  // ... et le siège de Rome dure longtemps (secondes, selon la difficulté : 10, 6 ou 2 minutes, au lieu de 24 s), pour
  // laisser aux Francs le temps de réagir : les soldats envoyés au pape (il faut que leurs terres se touchent) entrent
  // dans la garnison de Rome
  ROME_SIEGE: { facile: 600, normal: 360, difficile: 120 },
  // ⚔️ Les razzias des Slaves (les pillards du nord-est, voir la faction « slaves ») : la première au bout de FIRST
  // secondes, puis toutes les EVERY secondes, sur un voisin au hasard ; ARMY guerriers pour la première, et GROWTH de
  // plus à chaque razzia (0.2 = +20 %). Une razzia qui prend sa cible la rase (avec les moulins et casernes qui en
  // dépendent), pille LOOT pièces par bâtiment, et rentre : les terres restent au défenseur.
  // Elles plafonnent à MAX guerriers. La première épargne les factions de SPARE_FIRST (la Bavière, trop petite pour
  // l'encaisser dès le début).
  RAIDS: { FIRST: 150, EVERY: { facile: 150, normal: 110, difficile: 80 }, ARMY: { facile: 400, normal: 600, difficile: 900 },
    GROWTH: 0.2, MAX: 5000, LOOT: 150, SPARE_FIRST: ['baviere'] },
  // ✝️ Succès « Empire chrétien » : quand les terres des Francs touchent celles de Rome, leur Croyance gagne
  // CHRISTIAN_EMPIRE pour toujours
  CHRISTIAN_EMPIRE: 100,
  // ✝️ La Croyance prend les terres 2 fois moins vite que dans une partie classique (FAITH_SPEED) : chacun commence
  // déjà avec beaucoup d'églises
  FAITH_SPEED: 0.5,

  // 📜 Les grands événements (un parchemin s'ouvre au milieu de l'écran et met la partie en pause : voir EVENTS)
  // 769 : la révolte d'Aquitaine éclate entre ces deux moments (secondes, au hasard) ; d'ici là, ses terres sont franques
  AQUITAINE_REVOLT: [60, 180],
  // 778 : Roncevaux. La première ville prise par les Francs au sud des Pyrénées (à l'ouest de cette longitude et au sud
  // de cette latitude) : l'arrière-garde est massacrée au retour, les Francs perdent LOSS de leur armée
  RONCEVAUX: { LON: 3.3, LAT: 43.0, LOSS: 0.3 },
  // 782 : Widukind. DELAY secondes après la prise d'Eresburg par les Francs, les Saxons (s'il en reste) lèvent une armée
  // de ARMY soldats et contre-attaquent sur Eresburg
  WIDUKIND: { DELAY: 120, ARMY: { facile: 1500, normal: 2500, difficile: 3500 } },
  // 787 : Tassilon s'allie aux Avars (minutes de jeu, selon la difficulté), si les Francs ne tiennent pas encore Ratisbonne
  TASSILO: { facile: 16, normal: 13, difficile: 10 },
  // 797 : Irène s'empare du trône de Byzance (minutes de jeu) : Byzance perd la moitié de ses soldats et de ses
  // garnisons, et ne recrute plus pendant TIME secondes
  IRENE: { AT: { facile: 14, normal: 18, difficile: 22 }, TIME: 120 },
  // 797-802 : l'éléphant du calife. Quand les Francs prennent Barcelone : GOLD pièces et +FAITH de Croyance pour toujours
  ELEPHANT: { GOLD: 1000, FAITH: 50 },
  // 799 : le pape Léon III agressé. Quand les Francs ont rempli OBJECTIVES objectifs (et que Rome est au pape) : sa
  // garnison tombe de moitié et ne se reconstitue plus ; s'ils ne la remplissent pas (en envoyant des soldats au pape)
  // dans les TIME secondes, l'objectif « Rome » est perdu tant qu'elle n'est pas pleine
  LEO: { OBJECTIVES: 5, TIME: 120 },
  // 799 : les premiers Vikings. À partir de START minutes, toutes les EVERY secondes, les Danois (s'il en reste)
  // débarquent ARMY guerriers près d'une ville côtière des Francs (un raid : elle est rasée s'ils la prennent)
  VIKINGS: { START: { facile: 25, normal: 20, difficile: 16 }, EVERY: 150, ARMY: { facile: 500, normal: 800, difficile: 1200 } },

  // Les textes des parchemins (date, titre, récit, et le conseil, à mots couverts, des conseillers du roi : pas de
  // mode d'emploi, pour rester dans l'histoire) ; « {clé} » est remplacé par un nombre du jeu.
  // Ils s'ouvrent quand le joueur est les Francs ; sinon, un simple message les remplace.
  EVENTS: {
    intro: {
      date: tr('Octobre de l\'an de grâce 768', 'October, in the year of grace 768'),
      title: tr('La mort de Pépin le Bref', 'The death of Pepin the Short'),
      text: tr('Le roi Pépin s\'est éteint à Saint-Denis. Selon la coutume franque, son royaume est partagé entre ses deux fils : à toi, Charles, le nord et l\'ouest, de la Neustrie à l\'Austrasie ; à ton frère Carloman, la Bourgogne, la Provence et le sud. Les deux frères se jalousent, mais ils sont liés au pape par un pacte sacré. Autour d\'eux, les Saxons païens, les Lombards, les Bavarois du duc Tassilon et les Avars guettent le moindre faux pas…',
        'King Pepin has passed away at Saint-Denis. As Frankish custom demands, his kingdom is shared between his two sons: to you, Charles, the north and the west, from Neustria to Austrasia; to your brother Carloman, Burgundy, Provence and the south. The two brothers envy each other, but they are bound to the pope by a sacred pact. Around them, the pagan Saxons, the Lombards, the Bavarians of Duke Tassilo and the Avars wait for the slightest mistake…'),
      todo: tr('Neuf grands desseins attendent ton règne, consignés en haut à gauche : accomplis-les tous, et Rome posera sur ta tête la couronne des Césars. Observe d\'abord tes terres et tes voisins, puis ▶ Reprendre.',
        'Nine great designs await your reign, written at the top left: fulfil them all, and Rome will set the crown of the Caesars upon your head. First survey your lands and your neighbours, then ▶ Resume.'),
    },
    aquitaine: {
      date: tr('Printemps 769', 'Spring 769'),
      title: tr('La trahison d\'Aquitaine', 'The betrayal of Aquitaine'),
      text: tr('À peine Pépin enterré, le duc Hunald II soulève l\'Aquitaine contre les Francs ! Bordeaux, Périgueux et Angoulême ferment leurs portes à tes hommes et lèvent ses bannières. Seul ton château de Fronsac, bâti sur la Dordogne, tient encore… mais il est désormais isolé au milieu des terres rebelles : aucun renfort ne peut l\'atteindre.',
        'Pepin is barely buried when Duke Hunald II raises Aquitaine against the Franks! Bordeaux, Périgueux and Angoulême close their gates to your men and raise his banners. Only your castle of Fronsac, built on the Dordogne, still holds… but it is now isolated in the middle of the rebel lands: no reinforcement can reach it.'),
      todo: tr('Fronsac ne tiendra pas seul éternellement… Un roi qui laisse ses fidèles sans secours perd vite leur cœur, et Bordeaux est le cœur de la révolte.',
        'Fronsac will not hold alone forever… A king who leaves his faithful without help soon loses their hearts, and Bordeaux is the heart of the revolt.'),
    },
    carloman: {
      date: tr('Décembre 771', 'December 771'),
      title: tr('Carloman est mort', 'Carloman is dead'),
      text: tr('Ton frère Carloman est mort subitement, à Samoussy. Sa veuve s\'est enfuie chez le roi Didier, en Lombardie, avec ses enfants. Les grands du royaume de Carloman viennent te prêter serment : te voilà seul roi des Francs, maître de toute la Gaule.',
        'Your brother Carloman has died suddenly, at Samoussy. His widow has fled to King Desiderius, in Lombardy, with her children. The great men of Carloman\'s kingdom come to swear allegiance to you: you are now sole king of the Franks, master of all Gaul.'),
      todo: tr('Un royaume plus grand, ce sont des frontières plus longues : au sud et à l\'est, des voisins jaloux t\'observent.',
        'A greater kingdom means longer borders: to the south and the east, jealous neighbours are watching you.'),
    },
    lombards: {
      date: tr('773', '773'),
      title: tr('Didier marche sur Rome', 'Desiderius marches on Rome'),
      text: tr('Le roi des Lombards, Didier, a levé une armée de {army} soldats. Il veut forcer le pape Adrien à couronner les fils de Carloman, et s\'emparer des terres de saint Pierre. Le pape t\'appelle au secours : Rome n\'a pas d\'armée, seulement la garnison de ses murs.',
        'The king of the Lombards, Desiderius, has raised an army of {army} soldiers. He wants to force Pope Hadrian to crown Carloman\'s sons, and to seize the lands of Saint Peter. The pope calls you for help: Rome has no army, only the garrison of its walls.'),
      todo: tr('Les Lombards se mettront en marche avant peu. Un serpent qu\'on frappe à la tête ne mord plus… et les murs de Rome n\'ont jamais assez de défenseurs.',
        'The Lombards will march before long. A serpent struck on the head bites no more… and the walls of Rome never have enough defenders.'),
    },
    romeFalls: {
      date: tr('Les terres de saint Pierre', 'The lands of Saint Peter'),
      title: tr('Rome est tombée', 'Rome has fallen'),
      text: tr('Rome est tombée aux mains {who} ! Le pape a perdu sa ville, et la chrétienté tout entière regarde vers toi, le protecteur de l\'Église, qui n\'a pas su la garder.',
        'Rome has fallen into the hands of {who}! The pope has lost his city, and all of Christendom looks to you, the protector of the Church, who could not keep it.'),
      todo: tr('La couronne que Rome te promettait s\'est envolée avec elle : nul pape ne sacrera un roi qui n\'a pas su le défendre. Ton règne, lui, continue.',
        'The crown Rome promised you has flown away with it: no pope will crown a king who could not defend him. Your reign, however, goes on.'),
    },
    christian: {
      date: tr('Succès', 'Achievement'),
      title: tr('L\'Empire chrétien', 'The Christian Empire'),
      text: tr('Tes terres touchent enfin celles de Rome : de la mer du Nord jusqu\'au tombeau de saint Pierre, une même chrétienté unit les peuples. Les moines chantent ton nom dans les abbayes.',
        'Your lands finally reach those of Rome: from the North Sea to the tomb of Saint Peter, a single Christendom unites the peoples. Monks sing your name in the abbeys.'),
      todo: tr('Le Ciel te sourit : la foi de ton peuple grandit de {faith}, pour toujours.',
        'Heaven smiles upon you: the faith of your people grows by {faith}, forever.'),
    },
    raids: {
      date: tr('Aux marches de l\'Est', 'On the eastern marches'),
      title: tr('Les razzias des Slaves', 'The raids of the Slavs'),
      text: tr('Au-delà de l\'Elbe, les Wendes et les peuples slaves ne bâtissent pas de royaume : ils frappent et disparaissent. Leur première razzia ({army} guerriers) s\'abat sur {victim}. Leurs forêts et leurs marais sont imprenables, et chaque razzia sera plus grosse que la précédente.',
        'Beyond the Elbe, the Wends and the Slavic peoples build no kingdom: they strike and vanish. Their first raid ({army} warriors) falls upon {victim}. Their forests and marshes cannot be taken, and each raid will be bigger than the last.'),
      todo: tr('Nul ne soumet les forêts et les marais de l\'Elbe : veille sur tes marches de l\'Est.',
        'No one subdues the forests and marshes of the Elbe: watch over your eastern marches.'),
    },
    roncevaux: {
      date: tr('15 août 778', '15 August 778'),
      title: tr('Roncevaux', 'Roncevaux'),
      text: tr('Ta campagne d\'Espagne a pris une ville, mais au retour, dans le col de Roncevaux, les Basques tendent une embuscade à ton arrière-garde. Le comte Roland sonne trop tard de son olifant : il meurt avec ses compagnons, et {lost} de tes soldats ne reverront jamais la Gaule.',
        'Your Spanish campaign has taken a city, but on the way back, in the pass of Roncevaux, the Basques ambush your rearguard. Count Roland blows his oliphant too late: he dies with his companions, and {lost} of your soldiers will never see Gaul again.'),
      todo: tr('Au-delà des monts, chaque pas se paie de sang. Que Barcelone reste ferme, et que l\'ardeur des jeunes comtes soit tempérée.',
        'Beyond the mountains, every step is paid in blood. Let Barcelona stand firm, and temper the ardour of the young counts.'),
    },
    widukind: {
      date: tr('782', '782'),
      title: tr('La révolte de Widukind', 'The revolt of Widukind'),
      text: tr('Tu croyais la Saxe soumise ? Le chef saxon Widukind, réfugié chez les Danois, revient et soulève tout son peuple. Une armée de {army} Saxons sort des forêts et marche sur Eresburg pour reprendre le sanctuaire de l\'Irminsul !',
        'You thought Saxony subdued? The Saxon chief Widukind, who had fled to the Danes, returns and raises his whole people. An army of {army} Saxons comes out of the forests and marches on Eresburg to retake the sanctuary of the Irminsul!'),
      todo: tr('Les forêts saxonnes ont des yeux : Eresburg aura besoin de bras pour la défendre, et vite.',
        'The Saxon forests have eyes: Eresburg will need arms to defend it, and soon.'),
    },
    tassilo: {
      date: tr('787', '787'),
      title: tr('Tassilon trahit', 'Tassilo betrays'),
      text: tr('Le duc Tassilon de Bavière, ton cousin et ton vassal, a renié son serment : il s\'allie en secret avec le khagan des Avars. Désormais, les cavaliers des steppes viendront au secours de la Bavière.',
        'Duke Tassilo of Bavaria, your cousin and your vassal, has broken his oath: he secretly allies with the Khagan of the Avars. From now on, the horsemen of the steppes will come to Bavaria\'s aid.'),
      todo: tr('Le loup bavarois ne chasse plus seul : qui veut Ratisbonne devra compter avec les cavaliers de l\'Est.',
        'The Bavarian wolf no longer hunts alone: whoever wants Regensburg must reckon with the horsemen of the East.'),
    },
    irene: {
      date: tr('797', '797'),
      title: tr('Irène, impératrice', 'Irene, Empress'),
      text: tr('À Constantinople, l\'impératrice Irène a fait aveugler son propre fils pour régner seule. L\'empire est déchiré : la moitié de ses soldats a déserté, et il ne recrute plus pendant {secs} secondes. Pour la première fois, aucun empereur ne siège sur le trône des Césars…',
        'In Constantinople, Empress Irene has had her own son blinded so she can rule alone. The empire is torn apart: half of its soldiers have deserted, and it recruits no more for {secs} seconds. For the first time, no emperor sits on the throne of the Caesars…'),
      todo: tr('Un empire qui se déchire est une proie… mais la fortune ne frappe pas deux fois à la même porte.',
        'An empire tearing itself apart is prey… but fortune does not knock twice at the same door.'),
    },
    elephant: {
      date: tr('802', '802'),
      title: tr('L\'éléphant du calife', 'The caliph\'s elephant'),
      text: tr('Ta Marche d\'Espagne impressionne jusqu\'à Bagdad. Le calife Haroun al-Rachid t\'envoie une ambassade chargée de présents : des épices, des soieries, une horloge qui sonne les heures… et Abul-Abbas, un éléphant blanc, le premier qu\'on ait jamais vu en Gaule !',
        'Your Spanish March impresses even Baghdad. Caliph Harun al-Rashid sends you an embassy laden with gifts: spices, silks, a clock that strikes the hours… and Abul-Abbas, a white elephant, the first ever seen in Gaul!'),
      todo: tr('Le trésor royal s\'enrichit de {gold} pièces d\'or, et la foi de ton peuple grandit de {faith}, pour toujours.',
        'The royal treasury grows richer by {gold} gold coins, and the faith of your people grows by {faith}, forever.'),
    },
    leo: {
      date: tr('25 avril 799', '25 April 799'),
      title: tr('Le pape Léon III agressé', 'Pope Leo III attacked'),
      text: tr('Pendant une procession, des nobles romains ont attaqué le pape Léon III : ils ont tenté de lui crever les yeux et de lui couper la langue ! Une émeute gronde dans Rome, et la moitié de sa garnison a pris le parti des conjurés. Le pape s\'est enfui, et implore ton aide.',
        'During a procession, Roman nobles attacked Pope Leo III: they tried to put out his eyes and cut out his tongue! A riot rumbles in Rome, and half of its garrison has sided with the conspirators. The pope has fled, and begs for your help.'),
      todo: tr('Le Saint-Père n\'a plus que toi : ses murailles réclament des soldats, et le temps presse.',
        'The Holy Father has only you left: his walls cry out for soldiers, and time is short.'),
    },
    vikings: {
      date: tr('799', '799'),
      title: tr('Les premiers Vikings', 'The first Vikings'),
      text: tr('Des navires à tête de dragon sont apparus au large de tes côtes ! Les Danois du roi Sigfred ne se contentent plus de commercer : {army} guerriers vikings débarquent près de {city}. Désormais, ils reviendront régulièrement piller tes villes côtières.',
        'Dragon-headed ships have appeared off your coasts! King Sigfred\'s Danes are no longer content to trade: {army} Viking warriors land near {city}. From now on, they will come back regularly to plunder your coastal cities.'),
      todo: tr('Les hommes du Nord frappent là où la mer touche la terre… et tant que le roi danois régnera, ils reviendront.',
        'The Northmen strike where the sea meets the land… and as long as the Danish king reigns, they will return.'),
    },
  },
  // 👑 Les objectifs des Francs (dans un cadre, en haut à gauche) : tous remplis, Charles est couronné empereur.
  // Un objectif rempli est barré, avec un ✔ ; il se perd si on perd la ville (ou le niveau, la Croyance, Rome).
  //  - capital : tenir la capitale de cette faction ;
  //  - site : tenir la ville ou l'église posée à ce point [longitude, latitude] (voir la liste des factions) ;
  //  - citadel : avoir une ville de ce niveau ; faith : avoir cette Croyance (sans compter les croisades) ;
  //    (ces deux-là dépendent de la difficulté : goal = { facile, normal, difficile } ; « {n} » dans le texte devient ce nombre)
  //  - rome : Rome au pape (ou aux Francs, s'il n'est plus là) ; perdu pour de bon si quelqu'un l'a prise.
  OBJECTIVES: [
    { kind: 'capital', role: 'baviere', text: tr('Soumettre la Bavière : prendre Ratisbonne (788)', 'Subdue Bavaria: take Regensburg (788)') },
    { kind: 'capital', role: 'lombards', text: tr('Devenir roi des Lombards : prendre Pavie (774)', 'Become king of the Lombards: take Pavia (774)') },
    { kind: 'capital', role: 'saxons', text: tr('Soumettre les Saxons : prendre Eresburg et abattre l\'Irminsul (772)', 'Subdue the Saxons: take Eresburg and fell the Irminsul (772)') },
    { kind: 'capital', role: 'avars', text: tr('Abattre le Ring des Avars et piller son trésor (796)', 'Bring down the Avar Ring and plunder its treasure (796)') },
    { kind: 'site', at: [2.17, 41.39], text: tr('Créer la Marche d\'Espagne : prendre Barcelone (801)', 'Create the Spanish March: take Barcelona (801)') },
    { kind: 'citadel', goal: { facile: 3, normal: 4, difficile: 4 }, text: tr('Bâtir une capitale impériale, comme Aix-la-Chapelle : une ville de niveau {n}', 'Build an imperial capital, like Aachen: a level {n} city') },
    { kind: 'mines', goal: { facile: 4, normal: 6, difficile: 8 }, text: tr('Tenir les richesses de l\'Occident : {n} mines historiques (⛏️ au nom célèbre)', 'Hold the riches of the West: {n} historic mines (⛏️ with a famous name)') },
    { kind: 'faith', goal: { facile: 350, normal: 700, difficile: 1200 }, text: tr('Christianiser l\'empire : atteindre {n} de Croyance (sans croisade)', 'Christianise the empire: reach {n} Faith (without a crusade)') },
    { kind: 'rome', text: tr('Protéger Rome : qu\'elle ne tombe jamais', 'Protect Rome: it must never fall') },
  ],

  // ⛏️ Les mines célèbres de l'époque, en plus des filons posés au hasard : déjà creusées (niveau 1) par la faction
  // qui tient ces terres en 768, ou un simple filon sur une terre libre. Chaque faction a la sienne (Cordoue deux).
  // [longitude, latitude, sorte de filon (voir MINES dans config.js : 💎 diamant = un trésor), nom, faction qui la tient
  //  (null = un filon sur une terre libre)]
  HISTORIC_MINES: [
    [-0.14, 46.22, 'gold', tr('argent de Melle', 'Melle silver'), 'francs'],              // Francs : l'argent des ateliers monétaires
    [1.6, 42.95, 'iron', tr('fer de l\'Ariège', 'Ariège iron'), 'carloman'],                // Carloman : les mines du Rancié
    [10.2, 45.7, 'iron', tr('fer de Brescia', 'Brescia iron'), 'lombards'],                 // Lombards : les forges du val Trompia
    [12.8, 41.95, 'stone', tr('travertin de Tivoli', 'Tivoli travertine'), 'papaute'],     // Papauté : la pierre des monuments de Rome
    [24.0, 40.9, 'gold', tr('or du Pangée', 'Pangaion gold'), 'byzance'],                  // Byzance : les mines d'or de Thrace
    [11.86, 49.44, 'iron', tr('fer d\'Amberg', 'Amberg iron'), 'baviere'],                 // Bavière : la « Ruhr du Moyen Âge »
    [10.43, 51.89, 'gold', tr('argent du Harz', 'Harz silver'), 'saxons'],                // Saxons : le Rammelsberg
    [9.0, 56.0, 'iron', tr('fer des marais du Jutland', 'Jutland bog iron'), 'danois'],   // Danois : le fer des épées vikings
    [19.6, 46.6, 'diamond', tr('trésor des Avars', 'Avar treasure'), 'avars'],           // Avars : le trésor pillé en 796
    [-6.6, 37.7, 'gold', tr('argent de Rio Tinto', 'Rio Tinto silver'), 'cordoue'],        // Cordoue
    [-4.83, 38.77, 'diamond', tr('mercure d\'Almadén', 'Almadén mercury'), 'cordoue'],    // Cordoue : al-ma'din, « la mine »
    [-6.77, 42.47, 'gold', tr('or de Las Médulas', 'Las Médulas gold'), 'asturies'],        // Asturies : les vieilles mines romaines
    [-3.75, 48.36, 'gold', tr('argent de Huelgoat', 'Huelgoat silver'), 'bretons'],        // Bretons : le plomb argentifère
    [0.3, 51.05, 'iron', tr('fer du Weald', 'Weald iron'), 'anglos'],                     // Anglo-Saxons : les forges du Sussex
    [14.9, 47.52, 'iron', tr('fer du Norique', 'Noricum iron'), null],                // terre libre : l'Erzberg, le fer des Alpes
    [23.1, 46.3, 'gold', tr('or de Transylvanie', 'Transylvanian gold'), null],       // terre libre : l'or de la Dacie romaine
  ],

  factions: [
    {
      id: 'papaute', name: tr('Papauté', 'Papacy'), leader: tr('le pape Étienne III', 'Pope Stephen III'), flag: 'cm_papaute', color: [150, 26, 56],
      defensive: true, production: true, noArmy: true,
      capital: [12.48, 41.90, tr('Rome', 'Rome')], capitalLevel: 4,
      cities: [[12.20, 44.42, tr('Ravenne', 'Ravenna')]],
      churches: [[12.39, 43.11, tr('Pérouse', 'Perugia')]],
      // le duché de Rome (Latium), et l'Exarchat de Ravenne et la Pentapole (donation de Pépin, 756), reliés par Pérouse
      lands: [[[11.6, 42.3], [12.3, 42.55], [12.15, 43.2], [11.8, 44.05], [11.75, 44.75], [12.35, 44.95], [12.6, 44.3],
        [13.65, 43.6], [13.3, 43.35], [12.65, 43.05], [12.85, 42.45], [13.55, 41.65], [13.2, 41.2], [12.4, 41.4], [11.6, 42.2]]],
      desc: tr('Le pape, allié des Francs, tient Rome et Ravenne.', 'The pope, ally of the Franks, holds Rome and Ravenna.'),
    },
    {
      id: 'byzance', name: tr('Byzance', 'Byzantium'), leader: tr("l'empereur Constantin V", 'Emperor Constantine V'), flag: 'cm_byzance', color: [196, 134, 52],
      defensive: true, production: true,
      capital: [28.98, 41.01, tr('Constantinople', 'Constantinople')], capitalLevel: 4,
      cities: [[22.94, 40.64, tr('Thessalonique', 'Thessalonica')], [23.73, 37.98, tr('Athènes', 'Athens')],
        [15.29, 37.08, tr('Syracuse', 'Syracuse')], [15.65, 38.11, tr('Reggio', 'Reggio')],
        [29.72, 40.43, tr('Nicée', 'Nicaea')], [27.14, 38.42, tr('Smyrne', 'Smyrna')]],
      churches: [[26.56, 41.68, tr('Andrinople', 'Adrianople')], [22.93, 37.94, tr('Corinthe', 'Corinth')]],
      // la Thrace et l'Anatolie, la Grèce, la Sicile et la Calabre
      lands: [
        [[25.7, 42.25], [28.0, 42.6], [33.5, 42.6], [33.5, 34.0], [25.7, 34.0]],
        [[22.3, 41.0], [25.7, 41.25], [25.7, 34.0], [21.0, 34.0], [21.0, 38.6], [22.2, 39.2], [22.6, 40.1]],
        [[12.2, 38.4], [15.75, 38.4], [15.75, 36.5], [12.2, 36.5]],
        [[15.5, 39.9], [16.7, 39.95], [17.2, 39.0], [16.4, 37.8], [15.55, 37.85]],
      ],
      desc: tr('Le vieil Empire romain d\'Orient, riche et bien défendu.', 'The old Eastern Roman Empire, rich and well defended.'),
    },
    {
      id: 'baviere', name: tr('Bavière', 'Bavaria'), leader: tr('le duc Tassilon III', 'Duke Tassilo III'), flag: 'cm_baviere', color: [218, 112, 40],
      playable: true,
      capital: [12.10, 49.02, tr('Ratisbonne', 'Regensburg')], capitalLevel: 3, garrison: 1.5,
      cities: [[13.04, 47.80, tr('Salzbourg', 'Salzburg')]],
      churches: [[11.75, 48.40, tr('Freising', 'Freising')]],
      lands: [[[10.9, 48.6], [11.0, 49.55], [12.4, 49.8], [13.6, 48.95], [14.5, 48.3], [14.6, 47.6], [13.6, 47.0],
        [12.0, 46.6], [10.8, 47.3]]],
      desc: tr('Un petit duché, vassal rebelle des Francs : leur première cible.', 'A small duchy, rebel vassal of the Franks: their first target.'),
    },
    {
      id: 'bretons', name: tr('Bretons', 'Bretons'), leader: tr('les chefs bretons', 'the Breton chiefs'), flag: 'cm_bretons', color: [156, 186, 218],
      playable: true,
      capital: [-2.76, 47.66, tr('Vannes', 'Vannes')], capitalLevel: 3,
      cities: [[-4.10, 48.00, tr('Quimper', 'Quimper')]],
      churches: [[-3.98, 48.68, tr('Saint-Pol-de-Léon', 'Saint-Pol-de-Léon')]],
      lands: [[[-2.05, 47.25], [-2.0, 48.65], [-5.6, 49.0], [-5.6, 47.3]]],
      desc: tr('Les Bretons d\'Armorique, au bout du monde franc.', 'The Bretons of Armorica, at the far end of the Frankish world.'),
    },
    {
      id: 'asturies', name: tr('Asturies', 'Asturias'), leader: tr('le roi Aurelio', 'King Aurelius'), flag: 'cm_asturies', color: [158, 158, 168],
      playable: true,
      capital: [-5.84, 43.36, tr('Oviedo', 'Oviedo')], garrison: 1.5,
      cities: [[-7.56, 43.01, tr('Lugo', 'Lugo')]],
      churches: [[-5.13, 43.35, tr('Cangas de Onís', 'Cangas de Onís')]],
      lands: [[[-9.5, 43.3], [-8.9, 42.1], [-7.4, 42.2], [-6.0, 42.65], [-4.0, 42.85], [-3.15, 43.3], [-3.15, 43.8], [-9.5, 43.9]]],
      desc: tr('Le dernier royaume chrétien d\'Espagne, dans ses montagnes.', 'The last Christian kingdom of Spain, in its mountains.'),
    },
    {
      id: 'aquitaine', name: tr('Aquitaine', 'Aquitaine'), leader: tr('le duc Hunald II', 'Duke Hunald II'), flag: 'cm_aquitaine', color: [224, 198, 36],
      playable: true,
      capital: [-0.58, 44.84, tr('Bordeaux', 'Bordeaux')], capitalLevel: 3, garrison: 1.5,
      cities: [[0.72, 45.18, tr('Périgueux', 'Périgueux')]],
      churches: [[0.16, 45.65, tr('Angoulême', 'Angoulême')]],
      // 769 : le duc Hunald II soulève l'Aquitaine contre les fils de Pépin (le sud-ouest, entre la Charente et la Garonne)
      lands: [[[-1.3, 43.6], [-1.25, 44.4], [-1.2, 45.6], [-1.5, 46.2], [0.2, 46.3], [1.0, 45.9], [1.2, 45.1], [0.6, 44.2], [0.0, 43.9]]],
      desc: tr('769 : le duc Hunald II soulève l\'Aquitaine contre les Francs, qui n\'y tiennent plus que le château isolé de Fronsac.',
        '769: Duke Hunald II raises Aquitaine against the Franks, who hold only the isolated castle of Fronsac there.'),
    },
    {
      id: 'francs', name: tr('Francs', 'Franks'), leader: tr('Charlemagne', 'Charlemagne'), flag: 'cm_francs', color: [26, 58, 140],
      playable: true,
      capital: [3.00, 49.58, tr('Noyon', 'Noyon')],
      cities: [[2.35, 48.86, tr('Paris', 'Paris')], [0.69, 47.39, tr('Tours', 'Tours')], [6.96, 50.94, tr('Cologne', 'Cologne')],
        [-0.05, 45.0, tr('Fronsac', 'Fronsac')]],
      churches: [[1.91, 47.90, tr('Orléans', 'Orléans')], [8.27, 50.00, tr('Mayence', 'Mainz')], [0.34, 46.58, tr('Poitiers', 'Poitiers')],
        [1.10, 49.44, tr('Rouen', 'Rouen')], [9.93, 49.79, tr('Wurtzbourg', 'Würzburg')]],
      // (769 : Charles bâtit le château de Fronsac au cœur de l'Aquitaine révoltée : il y est isolé)
      enclaves: [[-0.05, 45.0, 7]],
      // la part de Charles : la Neustrie, l'Austrasie et la Frise, la Hesse et la Thuringe, l'ouest de l'Aquitaine
      lands: [[[-1.3, 43.5], [-1.25, 44.4], [-1.2, 45.6], [-2.2, 47.0], [-1.95, 47.6], [-1.85, 48.65], [-1.95, 49.75],
        [0.2, 49.75], [1.6, 50.4], [2.5, 51.1], [3.5, 51.6], [4.5, 52.6], [5.0, 53.5], [7.0, 53.65], [7.1, 52.6],
        [6.8, 51.85], [7.5, 51.4], [8.8, 51.3], [9.5, 51.38], [10.0, 51.45], [11.5, 51.55], [12.2, 51.3], [11.9, 50.5],
        [11.5, 50.1], [11.0, 49.6], [10.5, 49.0], [9.8, 48.95], [9.0, 49.3], [8.3, 49.1], [7.6, 49.05], [6.5, 48.65],
        [5.5, 48.6], [4.9, 48.95], [4.6, 49.8], [3.6, 49.7], [3.2, 49.3], [2.8, 48.9], [2.6, 48.4], [2.9, 47.8],
        [2.4, 47.1], [1.9, 46.6], [1.3, 45.8], [0.9, 45.0], [0.6, 44.2], [0.0, 43.9]]],
      desc: tr('Tu es Charles, roi des Francs depuis la mort de ton père Pépin. Ton frère Carloman tient le reste du royaume ' +
        'et le pape est ton allié. Soumets les Saxons, les Lombards, la Bavière et les Avars pour être couronné empereur !',
        'You are Charles, king of the Franks since the death of your father Pepin. Your brother Carloman holds the rest of the kingdom ' +
        'and the pope is your ally. Subdue the Saxons, the Lombards, Bavaria and the Avars to be crowned emperor!'),
    },
    {
      id: 'carloman', name: tr('Carloman', 'Carloman'), leader: tr('Carloman', 'Carloman'), flag: 'cm_carloman', color: [128, 56, 156],
      capital: [4.03, 49.26, tr('Reims', 'Reims')],
      cities: [[4.83, 45.76, tr('Lyon', 'Lyon')], [7.75, 48.58, tr('Strasbourg', 'Strasbourg')], [1.44, 43.60, tr('Toulouse', 'Toulouse')],
        [5.37, 43.30, tr('Marseille', 'Marseille')]],
      churches: [[4.30, 46.95, tr('Autun', 'Autun')], [3.00, 43.18, tr('Narbonne', 'Narbonne')], [9.17, 47.66, tr('Constance', 'Constance')]],
      // la part de Carloman : la Champagne, la Bourgogne, l'Alsace et l'Alémanie, la Provence, la Septimanie, l'est de l'Aquitaine
      lands: [[[2.5, 49.6], [5.5, 49.9], [7.8, 49.2], [8.6, 49.4], [10.4, 49.0], [10.9, 48.4], [10.6, 47.5], [10.0, 46.8],
        [8.5, 46.3], [7.0, 45.9], [6.7, 45.0], [7.6, 44.1], [7.5, 43.75], [6.0, 42.9], [4.5, 43.3], [3.2, 42.9],
        [3.05, 42.45], [1.5, 42.55], [0.0, 42.75], [0.0, 43.0], [0.6, 44.2], [1.2, 45.1], [1.5, 46.0], [2.0, 46.8],
        [2.4, 47.6], [2.5, 48.5]]],
      desc: '',
    },
    {
      id: 'saxons', name: tr('Saxons', 'Saxons'), leader: tr('Widukind', 'Widukind'), flag: 'cm_saxons', color: [62, 58, 56],
      playable: true,
      capital: [8.85, 51.42, tr('Eresburg', 'Eresburg')],
      cities: [[8.92, 52.29, tr('Minden', 'Minden')], [10.38, 53.30, tr('Bardowick', 'Bardowick')]],
      churches: [[7.63, 51.96, tr('Münster', 'Münster')], [11.63, 52.13, tr('Magdebourg', 'Magdeburg')]],
      lands: [[[6.8, 53.6], [8.3, 53.95], [8.9, 54.4], [10.2, 54.4], [11.0, 53.9], [11.3, 53.1], [12.0, 52.5], [12.0, 51.8],
        [11.4, 51.5], [10.0, 51.4], [8.6, 51.25], [7.4, 51.35], [6.7, 51.9]]],
      desc: tr('Les Saxons païens de Widukind, entre le Rhin et l\'Elbe : le grand ennemi des Francs.', 'Widukind\'s pagan Saxons, between the Rhine and the Elbe: the great enemy of the Franks.'),
    },
    {
      id: 'danois', name: tr('Danois', 'Danes'), leader: tr('le roi Sigfred', 'King Sigfred'), flag: 'cm_danois', color: [228, 160, 44],
      playable: true,
      capital: [9.57, 54.49, tr('Hedeby', 'Hedeby')],
      cities: [[8.76, 55.33, tr('Ribe', 'Ribe')], [11.97, 55.60, tr('Lejre', 'Lejre')]],
      churches: [[10.20, 56.15, tr('Aarhus', 'Aarhus')]],
      lands: [[[8.0, 54.4], [11.0, 54.4], [12.5, 54.4], [14.6, 55.3], [14.6, 56.7], [12.6, 56.7], [11.0, 58.0], [8.0, 58.0]]],
      desc: tr('Les Danois du Jutland et des îles, marins redoutables.', 'The Danes of Jutland and the islands, fearsome seafarers.'),
    },
    {
      id: 'lombards', name: tr('Lombards', 'Lombards'), leader: tr('le roi Didier', 'King Desiderius'), flag: 'cm_lombards', color: [36, 104, 68],
      playable: true,
      capital: [9.16, 45.19, tr('Pavie', 'Pavia')], capitalLevel: 3,
      cities: [[10.99, 45.44, tr('Vérone', 'Verona')], [13.43, 46.09, tr('Cividale', 'Cividale')], [10.50, 43.84, tr('Lucques', 'Lucca')],
        [12.73, 42.73, tr('Spolète', 'Spoleto')], [7.68, 45.07, tr('Turin', 'Turin')]],
      churches: [[10.21, 45.54, tr('Brescia', 'Brescia')], [11.25, 43.77, tr('Florence', 'Florence')]],
      // l'Italie du Nord et la Toscane, le Frioul, le duché de Spolète
      lands: [[[7.0, 45.9], [8.5, 46.45], [10.5, 46.65], [12.5, 46.7], [13.75, 46.5], [13.8, 45.7], [12.4, 45.3], [12.3, 44.8],
        [12.5, 43.9], [13.9, 42.6], [14.2, 42.1], [13.6, 41.7], [12.9, 42.0], [12.2, 42.25], [11.2, 42.35], [10.3, 43.4],
        [8.8, 44.4], [7.5, 43.78], [6.95, 44.25]]],
      desc: tr('Le royaume lombard du roi Didier, qui rêve de prendre Rome.', 'King Desiderius\' Lombard kingdom, which dreams of taking Rome.'),
    },
    {
      id: 'avars', name: tr('Avars', 'Avars'), leader: tr('le khagan', 'the Khagan'), flag: 'cm_avars', color: [242, 230, 200],
      playable: true,
      capital: [19.80, 46.90, tr('le Ring', 'the Ring')],
      cities: [[17.64, 47.69, tr('Győr', 'Győr')], [19.61, 44.97, tr('Sirmium', 'Sirmium')]],
      churches: [[18.23, 46.07, tr('Sopianae', 'Sopianae')]],
      lands: [[[14.6, 48.3], [16.0, 48.8], [17.6, 48.6], [19.0, 48.4], [22.0, 48.4], [22.8, 47.5], [22.3, 46.0], [21.2, 45.0],
        [19.5, 44.75], [18.0, 45.15], [16.0, 45.8], [15.0, 46.6], [14.6, 47.6]]],
      desc: tr('Les Avars, cavaliers des steppes, et leur Ring rempli de trésors.', 'The Avars, horsemen of the steppes, and their Ring full of treasure.'),
    },
    {
      id: 'cordoue', name: tr('Cordoue', 'Córdoba'), leader: tr('l\'émir Abd al-Rahman Ier', 'Emir Abd al-Rahman I'), flag: 'cm_cordoue', color: [226, 112, 170],
      playable: true,
      capital: [-4.78, 37.89, tr('Cordoue', 'Córdoba')], spare: ['asturies'],
      cities: [[-4.02, 39.86, tr('Tolède', 'Toledo')], [-0.88, 41.65, tr('Saragosse', 'Zaragoza')], [-5.98, 37.39, tr('Séville', 'Seville')],
        [-9.14, 38.72, tr('Lisbonne', 'Lisbon')],
        // (Barcelone, la porte de l'Espagne : une ville de niveau 2, à la garnison 4 fois plus forte tant que Cordoue la
        //  tient : dure à prendre en début de partie)
        [2.17, 41.39, tr('Barcelone', 'Barcelona'), { level: 2, garrison: 4 }]],
      churches: [[-0.38, 39.47, tr('Valence', 'Valencia')], [-6.34, 38.92, tr('Mérida', 'Mérida')]],
      // presque toute l'Espagne, au sud du « désert du Douro » (des terres vides, entre l'émirat et les Asturies)
      lands: [[[-9.7, 41.0], [-6.5, 41.0], [-4.0, 40.8], [-2.5, 41.3], [-1.6, 42.3], [0.5, 42.55], [2.0, 42.45], [3.4, 42.3],
        [4.5, 40.0], [1.0, 38.0], [-1.5, 36.7], [-5.3, 36.03], [-6.5, 36.4], [-9.7, 36.9]]],
      desc: tr('L\'émirat omeyyade d\'Abd al-Rahman, maître de presque toute l\'Espagne.', 'Abd al-Rahman\'s Umayyad emirate, master of almost all of Spain.'),
    },
    {
      id: 'anglos', name: tr('Anglo-Saxons', 'Anglo-Saxons'), leader: tr('le roi Offa', 'King Offa'), flag: 'cm_anglos', color: [124, 166, 84],
      playable: true,
      capital: [-1.69, 52.63, tr('Tamworth', 'Tamworth')],
      cities: [[-0.12, 51.51, tr('Londres', 'London')], [-1.31, 51.06, tr('Winchester', 'Winchester')], [-1.08, 53.96, tr('York', 'York')]],
      churches: [[-0.54, 53.23, tr('Lincoln', 'Lincoln')], [-3.53, 50.72, tr('Exeter', 'Exeter')], [1.08, 51.28, tr('Cantorbéry', 'Canterbury')]],
      // l'Angleterre (sans la Cornouailles ni le pays de Galles), jusqu'au Forth
      lands: [[[-2.5, 56.05], [-1.6, 55.9], [0.0, 53.6], [1.9, 52.8], [1.6, 51.2], [-1.0, 50.65], [-3.0, 50.55], [-4.3, 50.35],
        [-4.3, 51.2], [-3.1, 51.5], [-3.0, 52.0], [-3.1, 53.0], [-2.9, 53.4], [-3.2, 54.0], [-3.5, 54.9], [-2.8, 55.6]]],
      desc: tr('Les royaumes anglais, sous le grand roi Offa de Mercie.', 'The English kingdoms, under the great King Offa of Mercia.'),
    },
    {
      // ⚔️ Les pillards du nord-est : leurs terres sont imprenables, ils ne s'étendent pas, mais lancent des razzias de
      // plus en plus grosses sur leurs voisins (voir RAIDS)
      id: 'slaves', name: tr('Slaves', 'Slavs'), leader: tr('les chefs wendes', 'the Wendish chieftains'), flag: 'cm_slaves', color: [40, 150, 148],
      raiders: true, noArmy: true,
      capital: [12.55, 52.41, tr('Brenna', 'Brenna')],
      cities: [[14.42, 50.08, tr('Prague', 'Prague')], [17.6, 52.54, tr('Gniezno', 'Gniezno')]],
      churches: [],
      // les terres libres du nord-est : de l'Elbe et de la Bohême jusqu'au bord de la carte (les Wendes, les Sorabes,
      // les Bohémiens, les Polanes…)
      lands: [[[11.0, 53.9], [12.0, 52.5], [12.0, 51.8], [12.6, 50.6], [12.3, 50.1], [13.6, 48.95], [14.6, 48.3], [16.0, 48.8],
        [17.6, 48.6], [19.0, 48.4], [22.0, 48.4], [22.8, 47.5], [26.0, 47.5], [33.0, 47.5], [33.0, 58.5], [21.0, 58.5],
        [21.0, 54.4], [14.0, 54.2], [12.6, 54.4]]],
      desc: tr('Les Wendes et les peuples slaves de l\'Elbe et de la Bohême : des pillards qui razzient leurs voisins.',
        'The Wends and the Slavic peoples of the Elbe and Bohemia: raiders who plunder their neighbours.'),
    },
  ],
};

// Le point (x, y) est-il dans le polygone pts ([[x, y], …]) ? (on compte les bords croisés par une demi-droite)
function insidePolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Les bannières des factions (leur vraie bannière, avec la couleur de leur royaume)
for (const f of CHARLEMAGNE.factions) {
  BANNERS.push({ id: f.id, name: f.name, kingdom: f.name, set: 'charlemagne', color: f.color,
    img: `img/bannieres/${f.flag}.webp`, icon: `img/bannieres/${f.flag}s.webp`, logo: `img/bannieres/${f.flag}m.webp` });
}
