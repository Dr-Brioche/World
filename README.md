# ⚔️ Medieval Emperor

**Un petit jeu de conquête médiévale, jouable directement dans le navigateur.**

Inspiré d'OpenFront, mais à la sauce médiévale : fonde ta capitale, étends ton royaume case par case,
bâtis moulins, casernes et châteaux, et écrase les royaumes rivaux pour dominer le continent !

## 🎮 [▶️ JOUER MAINTENANT](https://dr-brioche.github.io/World/)

👉 **https://dr-brioche.github.io/World/** : rien à installer, ça marche sur ordinateur, tablette et téléphone.

> Le jeu en ligne est mis à jour automatiquement à chaque nouveauté.
> Tu peux aussi télécharger le projet et ouvrir `index.html` d'un double-clic.

---

## 📜 Le jeu en bref

- 🗺️ **Une carte différente à chaque partie** : plaines, forêts, déserts, collines, montagnes, sommets enneigés, fleuves, lacs et mers,
  avec 3 sortes de cartes : 3 cartes **aléatoires** (Normale, Continentale, Base navale), 3 cartes **prédéfinies**
  (**Monde** et **Europe**, les vraies cartes, et **Azeroth**, le monde de Warcraft au temps du Norfendre) en départ classique,
  et des **📜 scénarios** : une carte avec des camps et des départs imposés (**Azeroth : les Factions**,
  **Charlemagne (768)** : l'Europe de Charlemagne, avec ses 15 factions historiques, et **La guerre de Cent Ans (1337)** :
  la France contre l'Angleterre, de Crécy à Jeanne d'Arc)
- 👑 **Ton royaume** : choisis son nom et sa **bannière** parmi 21 drapeaux brodés sur leur hampe (elle donne sa couleur à ton royaume)
- ⚔️ **La conquête** : attaque les terres voisines en choisissant combien de soldats envoyer
- 🏰 **Cinq bâtiments** pour développer ton royaume : moulin, caserne, château, église et port
- ⛵ **Des expéditions maritimes** : débarque sur une côte lointaine et plante un avant-poste
- 🤖 **3 à 20 royaumes rivaux** (tu choisis combien, un par drapeau, selon la taille de la carte : Bourgogne, Aquitaine, Castille, Bohême…) qui s'étendent, attaquent, s'allient et se trahissent tout seuls
- 🤝 **Des pactes** : allie-toi à d'autres royaumes… et trahis-les quand ça t'arrange
- 🎚️ **3 niveaux de difficulté** : Facile, Normale, Difficile (en Difficile, les bots ont un petit avantage : **+25 % d'or**, recrutement **20 % plus rapide** et soldats **10 % plus forts**)
- ⏩ **Vitesse de la partie** : en jeu, le bouton ⏩ (en haut) la fait passer à x1, x1,5, x2 ou x3, pour des parties plus courtes
- ✝️ **La Croyance** : tes églises prêchent chez tes voisins et convertissent peu à peu leurs terres
- 🌐 **Jouer en ligne, à plusieurs** (avec un serveur de jeu, voir [`serveur/PROTOCOLE.md`](serveur/PROTOCOLE.md)) : la **partie publique**, qui part toutes les 2 minutes avec tous ceux qui attendent (carte au hasard, des bots complètent), ou un **salon privé** entre amis, avec un code
- 🌍 **En anglais ou en français** : le jeu est en anglais par défaut ; la liste « Langue » en haut à droite du menu le passe en français (le choix est gardé)

## 🕹️ Comment jouer

1. **Fonde ta capitale** : choisis d'abord la **langue** du jeu en haut à droite du menu (🇬🇧 English, par défaut, ou 🇫🇷 Français : la page se recharge dans la nouvelle langue, et le choix est gardé pour les prochaines fois), puis ta bannière (clique sur le drapeau affiché pour ouvrir la liste de tous les drapeaux), le **type de carte**, la **difficulté** (Facile, Normale, Difficile : les bots y sont avantagés) et le
   **nombre de royaumes rivaux** (de 3 à 20, autant que de drapeaux disponibles ; au plus un rival pour 5 000 cases de carte : 10 sur la petite carte, réglage `CELLS_PER_OPPONENT`) dans le menu. ⏩ **Vitesse de la partie** : en jeu, le bouton ⏩ en haut (à côté de
   Pause) la fait passer à **x1, x1,5, x2 ou x3** : **tout** va plus vite (production, recrutement, marches, assauts, sièges,
   chantiers, croisades…). Le chrono en haut affiche le temps de jeu. Seul celui qui héberge la partie peut la mettre en pause
   ou changer sa vitesse (en solo : toi ; en ligne, voir « Joue à plusieurs » plus bas). Sur la carte, **les royaumes rivaux
   sont déjà installés** (leur nom et leur bannière sont affichés) : regarde qui est où, puis clique sur une terre libre
   pour fonder ta capitale (pas sur un îlot, ni trop près d'un rival : le cercle devient rouge si c'est impossible).
   🎲 **Cartes aléatoires** (différentes à chaque partie, avec un décor de Moyen Âge : beaucoup de **forêts**, moins de
   montagnes ; réglages `FOREST_LEVEL`, `HILLS_LEVEL` et `MOUNTAIN_LEVEL` dans `js/config.js`) :
   - **Normale** : un grand continent entouré d'océan, à la côte découpée de **criques** (une entrée étroite sur un petit bassin)
     et de **baies**, et souvent un ou deux grands **golfes** qui le coupent presque en morceaux (il ne reste qu'un isthme, une
     bande de terre étroite, à défendre !). Au large, **1 à 3 vraies îles** moyennes, assez grandes pour y fonder une capitale,
     et parfois un îlot volcanique (un sommet enneigé au milieu). Les petites îles sont toujours des volcans, et les miettes de
     terre de moins de 250 cases sont retirées.
   - **Continentale** : pas de mer, que de la terre, bordée de **montagnes infranchissables** en guise de limite
     de carte ; les fleuves s'y jettent dans de **grands lacs**.
   - **Base navale** : **plusieurs grandes îles** ; les ports et les expéditions maritimes deviennent essentiels.
   📏 **Taille de la carte** (pour les cartes aléatoires, au format 16:9) : **Petite** (300 x 169 cases), **Moyenne**
   (650 x 366) ou **Grande** (1000 x 562). Une grande carte a plus d'îlots, de fleuves et de lacs, et une partie plus longue.
   🗺️ **Cartes prédéfinies** (les vraies cartes, avec un peu de hasard dans les forêts et les côtes) :
   - **Monde** 🌍 (1080 x 408 cases) : la **vraie carte du monde**, bien plus grande (on dézoome beaucoup) : les continents, les grandes
     îles, les mers intérieures (mer Noire, Caspienne, Grands Lacs), les **chaînes de montagnes** (Rocheuses, Andes,
     Alpes, Himalaya…) et les **grands fleuves** (Mississippi, Amazone, Nil, Danube, Volga, Yangzi…) sont à leur place.
     Le cours inférieur des plus grands fleuves est un **grand fleuve** infranchissable ; le Groenland est un glacier
     (seules ses côtes sont habitables).
   - **Europe** 🏰 (1000 x 1000 cases, immense) : l'Europe en détail, de l'Islande à la Volga et du cap Nord au Sahara,
     avec l'Afrique du Nord, l'Anatolie et le Caucase. Les îles (Grande-Bretagne, Irlande, Sicile, Sardaigne, Corse,
     Crète, Chypre, les îles danoises…), la mer Noire, les grands lacs (Ladoga, Onega, Vänern, Léman…), les montagnes
     (Alpes, Pyrénées, Carpates, Alpes scandinaves, Apennins, Balkans, Caucase, Atlas, Taurus…), dessinées avec un
     **relief naturel** (des chaînes qui serpentent et se ramifient, des vallées de collines entre leurs arêtes, des
     piémonts qui s'effilochent), les vieux massifs de collines (Massif armoricain, Ardennes, Massif central, forêt de
     Bohême, Sierra Morena, plateau central russe, Podolie, Valdaï, Småland…), l'épaisse forêt de Germanie, et une cinquantaine
     de fleuves avec leurs méandres (Rhin, Danube, Loire, Seine, Rhône, Pô, Elbe, Vistule, Dniepr, Don, Tamise…).
     Le Danube (après Belgrade), le Dniepr (après Kiev) et le Don inférieur sont de grands fleuves infranchissables ;
     le Bosphore, à Istanbul, est un passage de terre entre l'Europe et l'Asie.
     ⚠️ C'est une très grande carte : la partie est longue, et le jeu peut ralentir un peu sur un ordinateur modeste.
   - **Azeroth** 🐉 (700 x 550 cases) : le monde de Warcraft **au temps du Norfendre** (Wrath of the Lich King), **relevé
     case par case sur les cartes du jeu** (une par continent) : les côtes, les lacs, les rivières et le terrain de chaque
     région d'après sa couleur (forêts, prairies, sable et terres rouges, roche, neige), avec ses trois continents autour de
     la Grande Mer, et quelques fleuves retracés à la main (la Fureur-du-Sud, l'Orneval, Féralas, le Thondroril, Elwynn).
     🛡️ Sur cette carte, les drapeaux laissent la place à **15 écus des races et des groupes de World of Warcraft**
     (Humains, Nains, Elfes de la nuit, Gnomes, Orcs, Morts-vivants, Taurens, Trolls, Gnolls, Ogres, Murlocs, Démons,
     Défias, Monastère Écarlate, La Main d'Argent) : tu choisis le tien dans le menu, et chaque royaume rival prend le nom
     de son écu (14 rivaux au plus).
     📜 **Scénario « Azeroth : les Factions »** (dans la liste des cartes, rubrique 📜 Scénarios ; choisie dans les cartes
     prédéfinies, Azeroth se joue en départ classique, comme les autres cartes) : 12 royaumes répartis en
     **3 camps** qui sont des **pactes éternels** (on ne peut ni les quitter, ni trahir, ni attaquer son propre camp) :
     **l'Alliance** (Humains, Nains, Gnomes, Elfes de la nuit), **la Horde** (Orcs, Trolls, Morts-vivants, Taurens) et
     **le Pacte sauvage** (Défias, Gnolls, Ogres, Murlocs). Tu choisis ta race (donc ton camp), mais pas où tu commences :
     chaque royaume est installé à **sa capitale du jeu** (Hurlevent, Forgefer, Gnomeregan, Darnassus, Orgrimmar, les îles de
     l'Écho, Fossoyeuse, les Pitons-du-Tonnerre ; les Défias à la Mine de la Mort, les Gnolls dans les Carmines, les Ogres à
     Hache-Tripes, les Murlocs à Sombrivage). La partie **démarre en pause**, centrée sur ta capitale, le temps de te
     repérer (▶ Reprendre, `Espace` ou `P` pour commencer). Ton camp gagne quand les deux autres sont anéantis (ou qu'il tient 70 % des terres).
     ❄️ C'est la seule carte avec de la **neige** (le Norfendre, le Berceau-de-l'Hiver, Dun Morogh, Alterac) : un terrain
     blanc bleuté qui se joue **comme une colline** (même défense, même lenteur, même production), différent des sommets
     blancs infranchissables.
     Le cœur des grands massifs (Hyjal, Dun Morogh, les pics Foudroyés…) et les glaciers du Norfendre sont infranchissables.
     **Kalimdor** à l'ouest (Teldrassil, Brume-azur et Brume-sang, la Sombrivage, l'Orneval, le mont Hyjal, Azshara et sa baie
     des Tempêtes, Durotar et les îles de l'Écho, les Tarides, le marécage d'Âprefange et Theramore, les Serres-Rocheuses,
     Désolace, Féralas, les Mille-Pointes, Tanaris, le cratère d'Un'Goro et Silithus), les **Royaumes de l'Est** à l'est
     (Quel'Thalas et Quel'Danas, Tirisfal, les Pins-Argentés, la péninsule de Gilnéas, le lac Lordamere, Alterac, l'Arathi, les
     Hinterlands, la baie de Baradin, Khaz Modan, Hurlevent, la Marche de l'Ouest, Deuillevent, les Terres foudroyées,
     Strangleronce) et le **Norfendre** au nord, entre les deux (la Couronne de glace, infranchissable, les pics Foudroyés,
     Sholazar, Zul'Drak, les Grisonnes, le fjord Hurlant). Au pont de Thandol, les deux moitiés des Royaumes de l'Est ne
     tiennent que par un isthme étroit.
   👑 **Scénario « Charlemagne (768) »** (rubrique 📜 Scénarios) : octobre 768, Pépin le Bref vient de mourir. La carte
     couvre l'**Europe de l'Ouest et la Méditerranée**, de l'Irlande et du Portugal jusqu'à **Constantinople** (les mêmes
     côtes, fleuves et reliefs que la carte Europe, en 780 x 620 cases ; au bord de la carte, la terre finit sur des
     sommets, pas sur une ligne de mer). **15 factions** y sont déjà installées, sur leurs terres de l'époque, avec leurs
     vraies villes (niveau 1, sans moulin ni caserne ; chaque capitale au moins au **niveau 2**, Pavie et Vannes au
     niveau 3) et 1 à 5 **églises** aux bourgades notables : les **Francs** de Charles (Noyon, Paris, Tours, Cologne,
     et le château isolé de **Fronsac** ; églises à Rouen, Wurtzbourg, Orléans, Mayence et Poitiers), l'**Aquitaine**
     révoltée du duc Hunald II (Bordeaux, Périgueux),
     **Carloman**, son frère (Reims, Lyon, Strasbourg, Toulouse, Marseille), les **Lombards** du roi Didier (Pavie,
     Vérone, Cividale, Lucques, Spolète, Turin), la **Papauté** (Rome, Ravenne), **Byzance** (Constantinople,
     Thessalonique, Athènes, Syracuse, Reggio, Nicée, Smyrne), la **Bavière** de Tassilon III (Ratisbonne, Salzbourg),
     les **Saxons** de Widukind (Eresburg, Minden, Bardowick), les **Danois** (Hedeby, Ribe, Lejre), les **Avars**
     (le Ring, Győr, Sirmium), l'émirat de **Cordoue** (Cordoue, Tolède, Saragosse, Séville, Lisbonne), les
     **Asturies** (Oviedo, Lugo), les **Bretons** (Vannes, Quimper) et les **Anglo-Saxons** d'Offa (Tamworth, Londres,
     Winchester, York), et au nord-est les **Slaves** (les Wendes : Brenna, Prague, Gniezno). Le reste (Irlande,
     Écosse, Afrique du Nord…) est libre.
     **Rome et Constantinople** sont des cités de niveau 4, avec déjà deux moulins et une caserne de niveau 2.
     ⛏️ **16 mines historiques** (en plus des filons au hasard), là où on les exploitait : **chaque faction a la sienne**,
     déjà creusée, et son nom s'affiche au survol. L'argent de Melle (Francs), le fer de l'Ariège (Carloman), le fer de
     Brescia (Lombards), le travertin de Tivoli (Papauté), l'or du Pangée (Byzance), le fer d'Amberg (Bavière), l'argent
     du Harz (Saxons), le fer des marais du Jutland (Danois), le 💎 trésor des Avars, l'argent de Rio Tinto et le 💎
     mercure d'Almadén (Cordoue), l'or de Las Médulas (Asturies), l'argent de Huelgoat (Bretons), le fer du Weald
     (Anglo-Saxons), plus le fer du Norique et l'or de Transylvanie, aux confins (souvent sur une terre libre, où il
     reste à bâtir la mine). L'argent compte comme une mine d'or ; le trésor des Avars et le mercure d'Almadén comme
     une mine de diamant.
     Tu choisis ta faction dans le menu (tout le monde sauf Rome, Byzance et Carloman), mais le but est surtout de jouer
     les **Francs** et de bâtir l'empire de Charlemagne. Règles du scénario :
     - **pas de nouvelles villes** : on améliore les siennes, on prend celles des autres (le bouton Château disparaît) ;
     - ✝️ la **Croyance** prend les terres voisines **2 fois moins vite** que dans une partie classique (chacun commence
       déjà avec beaucoup d'églises ; réglage `FAITH_SPEED` dans `js/charlemagne.js`) ;
     - 📜 **les grands événements** s'ouvrent sur un **parchemin** au milieu de l'écran, en écriture médiévale : la
       partie se met en pause, le parchemin raconte ce qui se passe, et **tes conseillers murmurent** un conseil à mots
       couverts (pas de mode d'emploi : à toi de comprendre comment t'en sortir) (Poursuivre, Entrée
       ou Échap pour reprendre). Les réglages sont dans `js/charlemagne.js` (avec les textes, dans `EVENTS`) :
       - 👑 **768, la mort de Pépin** : le parchemin d'ouverture, qui présente la situation et les objectifs ;
       - ⚔️ **769, la trahison d'Aquitaine**, entre la 1ʳᵉ et la 3ᵉ minute (au hasard) : le duc Hunald II soulève
         le sud-ouest (Bordeaux, Périgueux, Angoulême, jusque-là aux Francs), et les Francs n'y gardent que le
         **château isolé de Fronsac** (il ne compte que sur sa garnison : tiens-le, et relie-le à ton royaume en
         soumettant l'Aquitaine) ;
       - ⚱️ **771, la mort de Carloman** ; ⚔️ **773, Didier marche sur Rome** (30 s avant), puis **Rome est tombée**
         si les Lombards la prennent ; ✝️ le succès **« Empire chrétien »** ; ⚔️ la **première razzia** des Slaves ;
       - 🗡️ **778, Roncevaux** : la première ville que les Francs prennent en Espagne, leur arrière-garde est
         massacrée au retour (Roland meurt) : **−30 %** de leurs soldats ;
       - ⚔️ **782, la révolte de Widukind** : 2 min après la prise d'Eresburg, les Saxons lèvent une armée
         (1 500, 2 500 ou 3 500 soldats selon la difficulté) et marchent sur elle ;
       - 🤝 **787, Tassilon trahit** : à la 16ᵉ, 13ᵉ ou 10ᵉ minute, si les Francs n'ont pas encore pris Ratisbonne, la
         Bavière et les Avars s'allient pour de bon (ils se défendent l'un l'autre) ;
       - 👑 **797, Irène, impératrice** : à la 14ᵉ, 18ᵉ ou 22ᵉ minute, Byzance perd la moitié de ses soldats et de
         ses garnisons, et ne recrute plus pendant 2 minutes (le moment de l'attaquer) ;
       - 🐘 **802, l'éléphant du calife** : quand les Francs prennent Barcelone, Haroun al-Rachid leur offre
         **💰 1 000** et **+50 de Croyance** pour toujours ;
       - ✝️ **799, le pape Léon III agressé** : quand tu as rempli 5 objectifs, la garnison de Rome tombe de moitié et
         ne se reconstitue plus : remplis-la en envoyant des soldats au pape (clic droit sur ses terres) dans les
         **2 minutes**, sinon l'objectif « Rome » est perdu tant qu'elle n'est pas pleine ;
       - 🔥 **799, les premiers Vikings** : à partir de la 25ᵉ, 20ᵉ ou 16ᵉ minute, toutes les 2 min 30, les Danois
         débarquent (500, 800 ou 1 200 guerriers) près d'une ville côtière des Francs, et la rasent s'ils la prennent ;
     - 🏷️ **les noms des villes** : de près, chaque ville et église historique porte son nom, écrit en lettres
       médiévales sous elle (Paris, Aix, Pavie, Rome…) ; aussi au survol de la ville ;
     - ⚔️ **les Slaves, pillards du nord-est** : leurs terres sont **imprenables**, ni par les armes ni par la Croyance
       (on ne peut que se défendre contre eux) et ils ne s'étendent pas, mais ils lancent des **razzias** sur un voisin au hasard (toutes les 150 s en
       Facile, 110 s en Normal, 80 s en Difficile, après 2 min 30), de plus en plus grosses (600 guerriers en Normal,
       puis +20 % à chaque fois, jusqu'à **5 000 guerriers** au plus ; la première épargne la Bavière). Une razzia qui
       prend sa cible la **rase** (avec ses moulins et casernes), pille de l'or et rentre : les terres restent au
       défenseur. Quand leurs terres touchent celles des **Francs**, ils les visent **en premier**, d'autant plus souvent
       et plus fort que la partie est difficile (une razzia sur cinq en Facile, une sur deux en Normal, quatre sur cinq en
       Difficile, avec 20 % puis 40 % de guerriers en plus). Ils ne razzient **jamais les lieux des objectifs** de
       Charlemagne (Ratisbonne, Pavie, Eresburg, le Ring des Avars, Barcelone, Rome, les mines historiques) : la partie
       reste toujours gagnable (de même, aucun assaut viking ne peut les raser). Leurs terres ne comptent pas dans les parts du classement ni pour la victoire (les 70 % se comptent
       sur les terres à conquérir), et il n'est pas nécessaire de les anéantir ;
     - 🛡️ **les petits royaumes résistent** : la Bavière (Ratisbonne au niveau 3), l'Aquitaine (Bordeaux au niveau 3) et
       les Asturies ont des garnisons 50 % plus fortes tant qu'elles tiennent leurs villes, et Cordoue s'attaque moins
       volontiers aux Asturies, dans leurs montagnes ;
     - ✝️ **succès « Empire chrétien »** : quand les terres des Francs touchent celles de Rome, leur Croyance gagne
       **+100 pour toujours** ;
     - les **Francs, Carloman et le pape** forment un **pacte éternel** (l'« Alliance de Rome ») ; au bout de quelques
       minutes (3 en Facile, 6 en Normal, 10 en Difficile), **Carloman meurt** et son royaume revient aux Francs ;
     - **Byzance et Rome** sont des puissances défensives : elles se défendent mais ne partent pas en conquête ;
     - **Rome** n'a **pas d'armée**, seulement une **grande garnison** (320 soldats, qui se reconstitue) qui repousse
       les assauts du début ; les Francs ne peuvent pas la prendre (c'est leur allié), mais **tous les autres royaumes
       peuvent l'attaquer** ;
     - au bout d'un moment (18 min en Facile, 12 en Normal, 7 en Difficile ; un message prévient 30 s avant), les
       **Lombards marchent sur Rome** avec une **grande armée** (5 000, 5 500 ou 6 500 soldats, moins s'ils ont déjà
       perdu des villes). Le **siège de Rome dure 10 minutes en Facile, 6 en Normal, 2 en Difficile** : les soldats
       envoyés au pape (clic droit sur ses terres, si elles touchent les tiennes) **renforcent sa garnison**, et 1 500
       suffisent à la sauver (ce siège long vaut pour tout royaume qui attaque Rome). Repoussés, les Lombards
       **retentent leur chance** quand leur armée a retrouvé la moitié de celle de leur grande marche (au plus une fois
       toutes les 3 minutes ; réglage `LOMBARDS_RETRY`). Si Rome tombe, **aux Lombards ou à n'importe quel autre royaume**,
       l'objectif « Rome » est **perdu pour de bon** (barré en rouge, ✖) : on peut continuer à jouer, mais plus être
       couronné empereur (même en la libérant ensuite : elle est alors rendue au pape) ;
     - 🏰 **Barcelone** est une **ville de niveau 2** à la **garnison 4 fois plus forte** (200 soldats) tant que Cordoue
       la tient : dure à prendre en début de partie ;
     - **victoire des Francs** : remplir les **9 objectifs de Charlemagne**, listés dans un **cadre en haut à gauche**
       (un clic le replie ; un objectif rempli est **barré en gris avec un ✔**) :
       soumettre la **Bavière** (prendre Ratisbonne, 788), devenir **roi des Lombards** (prendre Pavie, 774), soumettre
       les **Saxons** (prendre Eresburg et abattre l'Irminsul, 772), abattre le **Ring des Avars** (796), créer la
       **Marche d'Espagne** (prendre Barcelone, 801), bâtir une **capitale impériale** comme Aix-la-Chapelle (une ville de
       niveau 3 en Facile, 4 en Normal et Difficile), tenir les **richesses de l'Occident** (4, 6 ou 8 **mines
       historiques** selon la difficulté), **christianiser l'empire** (350 de Croyance en Facile, 700 en
       Normal, 1 200 en Difficile : le pacte avec Rome en donne déjà 150, sans compter une croisade en cours) et **protéger Rome**
       (qu'elle ne tombe jamais). Un objectif **se perd** (le ✔ disparaît, un message
       prévient) si tu **perds la ville** (ou ta ville de haut niveau, ta Croyance, Rome) : il faut tout tenir en même
       temps. Tout est rempli : tu es **couronné empereur** !
       (Sinon, la victoire normale à 70 % des terres reste possible.)
     Chaque faction porte sa **propre bannière** (le monogramme de Charlemagne pour les Francs, les clés de saint Pierre
     pour le pape, l'aigle bicéphale de Byzance, la guivre des Lombards, le corbeau des Danois…) et la couleur de son royaume.
     Tous les réglages du scénario sont dans `js/charlemagne.js`.
   ⚜️ **Scénario « La guerre de Cent Ans (1337) »** (rubrique 📜 Scénarios) : mai 1337, Philippe VI de Valois confisque
     la Guyenne au roi d'Angleterre Édouard III, qui se proclame roi de France. La carte : la **France, les îles
     Britanniques et le nord de l'Espagne** (600 x 780 cases, une case fait environ 2,5 km), avec **12 factions** déjà en
     place : la **France**, l'**Angleterre** (avec la Guyenne, le Ponthieu et Dublin), l'**Écosse**, la **Bourgogne**, la
     **Bretagne**, la **Flandre**, la **Navarre** (et son comté d'Évreux, en Normandie), la **Castille**, l'**Aragon**,
     le **Saint-Empire** (des Pays-Bas à la Provence), les **clans irlandais** et le **pape d'Avignon** ; leurs villes
     portent leur nom sur la carte. Deux **campagnes** avec leur récit (des parchemins à chaque grand événement) : celle
     du **roi de France**, et celle du **roi d'Angleterre** (voir plus bas) ; tu peux aussi jouer la **Bourgogne**, la
     **Bretagne** ou l'**Écosse**, chacune avec ses objectifs.
     Règles du scénario :
     - **pas de nouvelles villes** (on améliore les siennes, on prend celles des autres) et **pas de nouveaux pactes** :
       deux camps, la **Couronne de France** (avec l'Écosse : l'Auld Alliance) et le **Parti anglais** ;
     - 📅 **le calendrier** : la guerre dure de **1337 à 1453** en environ **45 minutes** ; l'année, le roi de France et le
       roi d'Angleterre s'affichent en haut (avec la trêve en cours, la rançon du roi, ses crises de folie, la peste) ;
     - 👑 **la Légitimité** remplace la Croyance : qui est le vrai roi ? Elle vient de tes villes (plus pour les grandes :
       Paris, Reims, Rouen, Orléans, Calais, Bordeaux, Londres), de tes églises (leur Croyance, à moitié : améliore-les !)
       et des événements ; un roi **pas sacré à Reims**, **captif** ou **fou** en perd. Le roi d'Angleterre qui prend
       Reims s'y fait sacrer roi de France (+80) ;
     - ⚖️ **les grands vassaux** (Bourgogne, Bretagne, Flandre, Navarre) ont une **fidélité** (de −100, pour l'Anglais, à
       +100, pour le roi de France) qui glisse vers le roi le plus légitime : au-delà de ±35, ils rejoignent son camp, et
       le quittent sous ±15. Le roi qui attaque un vassal le perd (−25) ; clic droit sur ses terres : **acheter sa
       fidélité** (💰 500 = ±15). Elle s'affiche au survol de ses terres. Les rois bots achètent aussi leurs vassaux ;
     - 🏹 **les arcs longs** : en rase campagne (pas pendant un siège), l'armée du roi d'Angleterre se bat 30 % mieux,
       jusqu'en 1450 ; 💣 à partir de **1439**, les **canons des frères Bureau** rendent les sièges du roi de France plus
       de 2 fois plus courts ;
     - 🕊️ **les trêves** (Malestroit 1343, Brétigny 1360, Leulinghem 1389) : 1 à 3 minutes sans aucun assaut entre les
       deux camps ;
     - ☠️ **la peste noire** (1348) part de Marseille et saute de ville en ville : une ville malade perd des soldats, sa
       garnison fond et ses moulins et casernes tournent au ralenti, pendant 45 s. Clic droit sur une de tes villes :
       **fermer ses portes** (40 s : la peste n'y entre pas, mais elle ne produit plus rien) ;
     - 🔥 **les chevauchées** : l'armée anglaise pille et rase une ville du camp français (sans la garder) et rentre
       avec son butin ; le joueur anglais en lance d'un clic droit sur une ville ennemie. 🗡️ **les Grandes Compagnies**
       (de 1357 à 1445, deux fois plus pendant les trêves ; parties en Castille de 1366 à 1369) surgissent dans le pays
       et razzient une ville ;
     - 💰 **les rançons** : une armée battue d'au moins 300 soldats paie rançon au vainqueur pour ses chevaliers tombés ;
     - 👑 **les rois de France** : Philippe VI, **Jean II** (s'il perd une grande bataille contre les Anglais, il est
       **capturé** : sa rançon, de 2 000 à 4 000 pièces, se paie toute seule avec la moitié de ton or), **Charles V le
       Sage** (améliorations 25 % moins chères, et **Du Guesclin** : soldats 15 % plus forts), **Charles VI** (à partir de
       1392, des **crises de folie** : recrutement divisé par 2) et **Charles VII** ; chaque nouveau roi doit être sacré à
       Reims. **Henri V** rend les soldats anglais 15 % plus forts ;
     - ⚓ **les ports de la Manche** (Calais, Harfleur, Cherbourg, Abbeville, Dunkerque) : chacun que tient l'Anglais
       ravitaille son armée (+8 % de recrutement). Après une défaite navale (l'Écluse 1340 pour la France, La Rochelle
       1372 pour l'Angleterre), ses ports retombent au niveau 1 et elle ne peut plus traverser la mer pendant 2 minutes ;
     - ⚜️ **Jeanne d'Arc** (1429) : un bouton ⚜️ la confie à ton prochain assaut (son étendard flotte au-dessus de son
       armée) : il se bat 40 % mieux et assiège 2 fois plus vite, et chaque ville prise grandit ta Légitimité (+15). Si
       son armée est battue, elle est **prise**. (Les rois de France bots l'emmènent aussi) ;
     - 📜 **les grands événements** (parchemins pour le roi de France, messages pour les autres) : la Flandre choisit
       l'Angleterre (1339), l'Écluse, la guerre de Succession de Bretagne, Édouard III débarque en Normandie et le siège
       de Calais (1346), la peste noire, le Dauphiné (1349), Charles le Mauvais, la chevauchée du Prince Noir (1356), la
       Jacquerie, la paix de Brétigny, les Compagnies en Castille, la guerre reprend (la Castille rejoint la France,
       1369), La Rochelle, la Flandre bourguignonne (1384 : elle passe à la Bourgogne), la folie du roi, Armagnacs et
       Bourguignons (1407), Henri V débarque à Harfleur (1415), le pont de Montereau (la Bourgogne passe aux Anglais),
       le traité de Troyes, le petit roi de Bourges, le siège d'Orléans, Jeanne d'Arc, le traité d'Arras (1435 : la
       Bourgogne revient, si le roi de France est le plus légitime), les canons des frères Bureau et Castillon (1453) ;
     - 🦁 **la campagne du roi d'Angleterre** (en jouant l'Angleterre) : la même guerre vue de Londres, avec ses propres
       parchemins (« Roi de France par ma mère », la victoire de l'Écluse, Crécy, Calais, Poitiers et le roi Jean ton
       prisonnier, Henri V, Azincourt, le traité de Troyes, la Pucelle…) et des événements à elle :
       - ⛵ **les débarquements** de 1346 (vers Caen) et 1415 (vers Harfleur) : une vraie armée débarque sur la côte normande
         et marche sur la ville (sinon, le Parlement te vote les soldats, et tu choisis où frapper) ; pour Calais,
         Poitiers et Orléans, le Parlement te vote une grande levée ;
       - ⚔️ **Neville's Cross** (1346) : pendant que tu guerroies en France, le roi d'Écosse envahit le Nord (Newcastle,
         Carlisle ou York) ; repoussé, il est pris, et sa **rançon** (1 200 à 2 000 pièces) est pour toi ;
       - 🗡️ **l'ordre de la Jarretière** (1348) : les rançons que tu touches sont **doublées** ;
       - ⛓️ la rançon du **roi Jean** captif (Poitiers 1356 : une chevauchée lancée juste après l'appel du Prince Noir
         peut le capturer) est **pour toi** ;
       - 🕊️ **la paix de Brétigny** (1360) est **un choix** : la signer (la trêve, +2 000 d'or, mais tu renonces à la
         couronne de France : −50 de Légitimité) ou la refuser (la guerre continue, +30) ;
       - 💰 **l'Étape de Calais** (1363) : tant que tu tiens Calais, +60 d'or toutes les 10 s ;
       - 👑 **tes rois** : Richard II, un enfant (1377) ; **Henri IV l'usurpateur** (1399 : −40 de Légitimité) ;
         **Henri V** (1413 : ta Légitimité revient, et ses soldats sont 15 % plus forts) ; Henri VI et le duc de Bedford (1422) ;
       - ⚔️ **la révolte des paysans** (1381) est **un choix** : rencontrer les rebelles à Smithfield (−800 d'or) ou
         réprimer la révolte (−20 % de tes soldats) ;
       - ⚜️ **Jeanne d'Arc prise** : ta Légitimité grandit (+20) ;
       - les parchemins à choix ont un bouton par choix (la partie attend ta décision). Les réglages sont dans
         `js/centans.js` (`ENGLAND`, `ENGLAND_EVENTS`, `CHOICES`) ;
     - 🏆 **les objectifs** (dans le cadre en haut à gauche, tous à remplir en même temps : sinon, la victoire normale à
       70 % des terres reste possible) :
       - ⚜️ **France** : Paris, le sacre à Reims, la Normandie (Rouen et Caen), Bordeaux, Calais, rallier ou soumettre la
         Bourgogne et la Bretagne, 400 / 480 / 560 de Légitimité, et plus une terre anglaise sur le continent ;
       - 🦁 **Angleterre** (une armée plus grande quand c'est un bot : +10 / 30 / 50 %) : Londres, la Guyenne (Bordeaux
         et Bayonne), 2 ou 3 ports de la Manche, la Normandie, Paris, le sacre à Reims, la Bourgogne, et 350 / 420 / 500
         de Légitimité ;
       - 🍇 **Bourgogne** : Dijon, la Flandre (Gand et Bruges), Bruxelles, Luxembourg, Nancy, Paris, une ville de niveau
         3 ou 4, et de la Légitimité ;
       - 🐾 **Bretagne** : Rennes, Nantes, Brest, ses 6 villes, le Mont-Saint-Michel, une ville de niveau 3 ou 4, et de la
         Légitimité ;
       - 🦄 **Écosse** : Édimbourg, Stirling et Perth, Berwick, Carlisle et Newcastle, York, que Paris reste au roi de
         France (l'Auld Alliance), et de la Légitimité.
     Les bannières des factions sont provisoires (des drapeaux du jeu, à leurs couleurs). Les données du scénario
     (factions, objectifs, réglages, textes des parchemins) sont dans `js/centans.js`, ses règles dans `js/centansrules.js`,
     et sa carte dans `js/europemap.js` (`generateCentAnsMap`).
   ⭐ **Les défis des campagnes** (Charlemagne et la guerre de Cent Ans) : **chaque faction jouable** (les 11 de
     Charlemagne, les 5 de la guerre de Cent Ans) a **4 défis**, des objectifs en plus, historiques, drôles ou très durs.
     Ils ne comptent pas pour la victoire, mais chacun rapporte sa **récompense** (de l'or, de la Croyance ou de la
     Légitimité) dès qu'il est réussi. Ils s'affichent sous les objectifs, dans le cadre en haut à gauche (✔ réussi,
     ✖ manqué : certains ont une limite de temps, d'autres se jouent dans la durée, comme « ne perdre aucune ville
     pendant 20 min »). Quelques exemples : les Lombards veulent **prendre Paris**, les Saxons bâtir 4 églises
     « au cas où », les Danois **raser 3 villes** et prendre Londres un siècle d'avance, Cordoue **venger 732** en
     prenant Tours, les Asturies prendre Cordoue ; le roi de France **prendre Londres** ou bouter l'Anglais sans
     Jeanne, avant 1429 ; le roi d'Angleterre tenir le **vœu du héron** (Paris avant 1360), l'Écosse jouer à
     **Braveheart** à Londres, la Bretagne prendre Cherbourg et Harfleur comme la **Lionne de Bretagne**…
     🙏 **Le vœu solennel** : au début de la partie, un parchemin te propose de **jurer** un de tes défis (ou rien).
     Tenu, il rapporte **le double** ; trahi (manqué, ou pas tenu avant 30 min de jeu, ou l'an 1420), il coûte
     **1 000 pièces** et **40 de Croyance** (de Légitimité). Les défis sont dans `CHALLENGES` (`js/charlemagne.js`,
     `js/centans.js`), le vœu et les règles dans `js/defis.js`.
   🗼 **Tour de garde** (pas encore disponible dans les parties : le bâtiment est prêt, il s'active avec `TOWERS` dans
     `js/config.js` ; touche **8**, 💰 150 puis plus cher à chaque tour) : elle tire chaque
     seconde sur l'armée ennemie la plus proche qui se bat à sa portée (une volée de flèches), et lui abat des soldats.
     5 niveaux : tour de guet en bois (portée 9 cases, 3 soldats par seconde), tour de garde (11, 6 ; 💰 250), tour
     d'archers (13, 10 ; 💰 700), tour fortifiée (15, 16 ; 💰 1 600) et Grande tour (18, 25 ; 💰 3 500). Sa portée
     s'affiche en pointillés quand on la survole. Elle se bâtit partout sur ses terres, à 10 cases au moins d'une autre de
     ses tours ; on en bâtit `TOWERS` au plus. L'ennemi peut la viser et la prendre : elle
     **retombe alors au niveau 1** (une tour dans la muraille d'une ville tombe avec la ville).
   🖌️ **Dessine tes cartes** : le bouton **« 🖌️ Création de carte »**, en bas à droite du menu (en face des règles), ouvre l'**éditeur de cartes**
   (`editeur.html`). Pars d'une carte toute en mer, toute en terre, ou d'une carte au hasard, puis peins les terrains
   (mer, plaine, forêt, colline, montagne, sommet, désert, fleuve, grand fleuve, colline boisée) au **pinceau** (taille réglable) ou
   avec l'outil **remplir**. Clic droit (ou Espace + glisser) pour déplacer la carte, molette pour zoomer, touches 1 à 9
   puis 0 pour les terrains, Ctrl + Z pour annuler. Donne-lui un nom et clique sur **💾 Enregistrer** : elle apparaît tout de
   suite dans la liste des cartes du jeu (**✏️ Cartes dessinées**) ; **▶️ Jouer** la lance directement.
   Les cartes sont gardées **dans ton navigateur** : **📤 Exporter** les enregistre dans un fichier (pour les garder,
   les partager ou les ajouter au jeu pour tout le monde dans `js/custommaps.js`), **📥 Importer** les rouvre.
   Il faut au moins une terre de 600 cases pour fonder des royaumes.
   Les cartes prédéfinies ont leur propre taille. **Toutes les cartes ont les mêmes règles** : une plus grande carte
   demande juste plus de temps.
   Chaque royaume a sa bannière : elle s'affiche à côté de son nom (carte, classement, barre du haut),
   porte ses armées, et accompagne les messages pour reconnaître tout de suite qui fait quoi.
2. **Étends-toi** : clique **deux fois de suite** sur une terre libre voisine pour t'en emparer (le 1er clic prépare l'attaque,
   le 2e la lance : un clic à côté pour fermer un menu ne lance donc rien).
   **Pour attaquer un royaume, clique sur un de ses châteaux 🏰** (ou une de ses églises ⛪, ports ⚓ ou avant-postes ⛺, sans défense) : ton armée se fraie un chemin depuis ta
   frontière en **contournant ses autres fortifications**, capture tout sur son passage jusqu'à la **muraille**
   du château, puis l'assiège. L'armée **ne traverse pas la muraille** : si le château tombe, toute sa zone tombe avec lui.
   En survolant un château ennemi, tu vois le chemin prévu (pointillés dorés), et en bas sa **défense globale** (terrain + murs). Si le château est en arrière-pays,
   derrière d'autres zones de défense, il est **inaccessible** (croix rouge) : prends d'abord les châteaux
   de la frontière. **Tant qu'un royaume a une ville (un château), tu ne peux viser que ses châteaux, églises, ports, mines ou avant-postes.**
   **Exception — morceau coupé de ses châteaux** : si un morceau de son royaume n'a plus **aucune ville ni port fortifié** (port de niveau 3) (il s'est fait
   isoler du reste, alors que son royaume a encore une ville ou un port fortifié ailleurs), personne ne le commande : tu peux
   **l'attaquer de front**, comme une terre **vide** (aucun défenseur ne peut venir). En le survolant, tu vois
   « ⚠️ coupé de tous ses châteaux ». Mais si son royaume arrive à le **relier à un château** (en reprenant des
   terres, ou en y bâtissant un château), **l'assaut s'arrête**. Attention, ça marche aussi contre toi !
   🏛️ **La règle du pouvoir** : c'est une **muraille avec sa garnison** qui maintient le pouvoir dans une zone, c'est-à-dire une
   **ville (château)** ou un **port fortifié** (niveau 3). Chacun tient sa région, même isolé.
   Quand un royaume n'a **plus aucune ville ni port fortifié**, c'est l'**anarchie** : il est **désorganisé**, même s'il lui reste des églises ou des petits ports :
   un petit **drapeau blanc** 🏳️ flotte sur ses terres (et sur chaque morceau de royaume coupé de ses villes) ;
   clique n'importe où sur ses terres, l'assaut se fait **de front, sur tout son territoire** (comme sur une terre libre),
   sans devoir prendre ses bâtiments un par un. Tu peux **quand même viser** une de ses **églises** ou un de ses **ports**
   (ou un avant-poste) pour foncer droit dessus et **prendre toute sa zone d'un coup**. Avec une **citadelle** (château niveau 3),
   tu as droit à 2 assauts à la fois : **un de front et un sur une église ou un port**, ou deux ciblés.
   Un territoire **désorganisé** (royaume sans ville ni port fortifié, ou morceau coupé d'eux) se prend **plus vite**, et **d'autant plus vite
   que ton armée est grande**. Et une grosse armée n'y perd **pas plus de soldats par case** : au-delà de 500 soldats, chaque case
   coûte autant (environ un demi-soldat en plaine) ; envoyer beaucoup de monde y est donc rentable. Si le royaume rebâtit (ou reprend) une ville, ou fortifie un port, pendant l'assaut, il est de nouveau organisé : l'assaut s'arrête.
   Toutes les troupes encore présentes dans ce royaume **défendent d'office**, mais désorganisées
   sans pouvoir en place : chaque soldat ne compte que pour **0,8**.

   **🎯 Viser puis valider** : le premier clic sur un château (ou une église, un port, un avant-poste) ennemi
   **choisit la cible** : elle est entourée d'un cercle rouge et le chemin de ton armée s'affiche en doré.
   **Clique une 2e fois sur la cible pour lancer l'assaut**. Un clic ailleurs, `Échap` ou clic droit l'annule.
   (Les terres libres, elles, s'attaquent d'un seul clic.)
   Le curseur « Envoyer » choisit le % de tes soldats qui partent en campagne.
   Tes attaques en cours s'affichent en bas de l'écran avec leurs soldats, ainsi que tes **bateaux en mer**
   (débarquement, renforts vers un avant-poste, retour au port) avec les soldats à bord et le temps restant.
   La **petite croix rouge** dans le coin d'une barre ordonne la **retraite** 🏳️ : pour un assaut, tes soldats mettent
   **3 s** à décrocher (ils peuvent encore se faire attaquer), puis rentrent en perdant **15 %** de leurs effectifs
   (mais si l'armée n'a pas encore quitté tes terres, elle rentre tout de suite, **sans aucune perte**) ;
   pour un bateau, il fait demi-tour vers le port, et **15 %** des soldats à bord se perdent (l'or de l'expédition
   n'est pas rendu). Les soldats en mer comptent dans ton armée (la jauge en bas indique « ⛵ en mer »).
   Les attaques ennemies contre toi y apparaissent aussi, en rouge.
   **Point de départ** : le jeu choisit tout seul celui qui est **le plus proche de la cible** : une de tes villes, ou un
   de tes **avant-postes** en territoire ennemi (avec ses soldats qui y attendent). Si l'avant-poste est **vide** (il ne
   lui reste que sa garnison, qui ne le quitte pas), l'assaut part de la ville.
   On n'attaque **que depuis son propre territoire** (ou depuis un avant-poste) : même dans un pacte,
   impossible de lancer un assaut depuis les terres d'un allié.

   **⚔️ Le déroulement d'un assaut**
   - **La marche (sur tes terres)** : ton armée part de **ta place forte d'où elle arrive le plus vite** à la cible
     (une ville, ou un **port fortifié** de niveau 3 : une muraille et sa garnison)
     (le vrai trajet à pied compte : fleuves, montagnes et détours, pas la distance à vol d'oiseau ; mais **dans la muraille
     de tes villes**, les chemins sont tracés : aucun ralentissement dû au terrain, même en forêt ou en montagne)
     (ou de ton avant-poste) et **marche jusqu'à ta frontière** par le **chemin le plus rapide** de tes terres ;
     elle entre chez l'ennemi par le meilleur passage **depuis cette ville** (et pas forcément par le bout de frontière
     le plus proche de la cible, qui l'obligerait à traverser tout ton royaume)
     (en pointillés) : vite en plaine, plus lentement en forêt, en colline, en montagne ou en traversant un fleuve,
     et d'autant plus lentement que l'armée est grande (sa vitesse est fixée au départ ; 2 s au minimum).
     Chez toi, elle marche **60 % plus vite** qu'un assaut en terre ennemie.
     Tout le monde la voit venir : ta **bannière** ⚔️ avance sur la carte avec tes soldats ;
     en face, les terres menacées **scintillent à ta couleur**, et le bâtiment visé est entouré d'un **halo** qui pulse.
     Pendant la marche, reclique sur la cible pour **ajouter des soldats tout de suite** : c'est ce qui fixe l'ampleur de l'assaut.
     L'armée entre chez l'ennemi là où commence son chemin (en pointillés dorés) : c'est de là que part la
     **flèche rouge en pointillés** qui la montre jusqu'à sa cible. Le point d'entrée est choisi selon le **vrai trajet**
     depuis sa ville de départ (relief, fleuves, détours autour d'un lac ou des terres ennemies) : l'armée ne fait pas
     tout le tour d'un royaume pour une entrée qui n'est proche que sur la carte.
     🌊 **De l'autre côté d'un fleuve** : si un fleuve sépare tes terres des siennes (même sans autre frontière), tu peux
     quand même viser ses villes, églises, ports, mines et avant-postes : l'armée **passe le fleuve à gué**, lentement
     (10 s pour la 1re case de fleuve, 6 s pour les suivantes, rien sur un pont), puis prend pied sur l'autre rive.
     C'est pareil pour un fleuve **au milieu de ses terres**, entre ta frontière et la ville visée : l'armée le passe à gué
     (même temps), puis continue sa route.
   - **L'assaut entre chez l'ennemi** : tu peux encore envoyer des **renforts** en recliquant sur le château visé,
     mais ils partent de la cité d'où l'assaut est parti et **marchent jusqu'au front** (au moins 3 s) :
     plus ton armée s'est enfoncée loin de sa cité, plus ils mettent de temps à arriver.
   - **Pertes en route** : une armée qui avance (sur une terre libre ou chez l'ennemi) perd des hommes à chaque case,
     un **pourcentage de son effectif** (0,1 % par case de plaine, plus dans le relief) : une grosse armée en perd
     plus qu'une petite.
   - **Échec = la route revient au défenseur** : les terres qu'un assaut a prises en traçant sa route vers son
     objectif (château, église, port, avant-poste, ou château isolé à rejoindre) **ne restent à l'attaquant que s'il
     prend l'objectif**. S'il est repoussé, bat en retraite ou est bloqué, le défenseur **reprend toute la route**.
   - **Prendre des terres** coûte peu (comme une terre libre, selon le terrain). Ce qui coûte cher,
     ce sont les **défenseurs** ennemis. Mais un assaut **avance lentement** chez l'ennemi, et **plus l'armée est grande,
     plus elle est lente** (100 soldats : environ 6,9 cases de plaine par seconde, 500 : 5,1, 1000 : 3,8, 3000 : 1,9) :
     une énorme armée écrase tout, mais l'ennemi a le temps de la voir venir. Elle avance bien moins vite
     que sur les terres libres, et encore moins dans le relief (forêt, colline, montagne, fleuve).
   - **Où est l'attaque ?** Un royaume qui t'attaque a son nom qui **clignote en rouge** dans le classement, en haut
     à droite : **clique sur son nom**, la caméra va directement voir son armée (s'il a plusieurs assauts contre toi,
     chaque clic montre le suivant). **Clique sur le nom de n'importe quel royaume** du classement : la caméra va sur
     ses terres (il clignote un instant), pratique pour retrouver un petit royaume perdu et l'achever pour la prime.
   - **Défendre** : quand un assaut te vise, une barre courte s'affiche en bas de l'écran : « Écosse attaque · ⚔ 242 · 🛡️ Défendre »
     (les soldats de l'assaut). Le reste (réserve de l'attaquant…) se voit sur la carte, sous son nom.
     Dès que l'armée **entre sur tes terres** (pas avant : pendant sa marche chez elle, tes défenseurs n'iront jamais
     l'attendre en terre ennemie, et le bouton **🛡️ Défendre** reste grisé), clique sur sa bannière (ou sur **🛡️ Défendre** en bas de l'écran)
     pour envoyer le % de soldats choisi. Ils partent **tout de suite** de ton **château le plus rapide à pied** (pas forcément le plus proche à vol d'oiseau) et marchent
     à la rencontre de l'ennemi par le **chemin le plus rapide** de tes terres (on voit leur bannière 🛡 avancer, et
     leur chemin en pointillés) : comme un assaut, ils vont vite en plaine et lentement dans le relief, et un gros
     groupe est plus lent, mais ils sont chez eux : **18 % plus vite** qu'un assaut de même taille. Ils ne se battent qu'en arrivant. Contre un même assaut, tu n'envoies qu'**une armée de défense** :
     si tu recliques, les soldats en plus **la renforcent** (ils la rejoignent en **3 s**, qu'elle soit encore en route
     ou déjà au combat) au lieu de former une nouvelle armée.
     Si l'assaut se termine avant leur arrivée (la ville est prise, ou l'ennemi bat en retraite), ils **font
     demi-tour** là où ils sont et **rentrent à pied** jusqu'à ta ville (château) la plus rapide à rejoindre, comme les bateaux
     de renfort (on voit leur bannière ↩ revenir) : tu ne les récupères qu'à leur arrivée.
   - **La garnison** : chaque château a ses propres défenseurs (beaucoup plus nombreux selon son niveau).
     Ils attendent l'ennemi **derrière la muraille** et n'entrent en jeu qu'au **siège**, quand l'armée arrive au pied
     du mur (la barre de l'assaut l'indique : « 🏰 10 derrière les murs ») ; avant, ce sont tes défenseurs qui l'arrêtent.
     (La garnison d'un port royal ou d'un avant-poste, elle, sort dès que l'assaut entre sur tes terres.) **Au combat, chaque soldat de garnison
     en vaut 3.** Ils se reconstituent ensuite peu à peu.
   - **Le combat** n'est pas instantané : sur la bannière, tu vois en direct les soldats des deux armées.
     **En plaine, 1 défenseur vaut 1 attaquant** ; ailleurs, le défenseur profite de la défense de l'endroit
     où se bat l'assaut (forêt +60 %, colline +120 %, colline boisée ou montagne +180 %, + bonus du château dans sa muraille).
     L'assaut choisit donc un chemin qui passe le plus possible par les plaines.
   - **La supériorité en nombre** compte : un camp qui a **plus de 2 fois plus de soldats** que l'autre
     tue plus vite et perd moins de soldats par ennemi tué (jusqu'à **x5** pour un écrasement, comme 300 contre 4).
     Envoyer 2 ou 3 défenseurs à la fois ne suffit donc pas à bloquer une grosse armée !
   - Si l'attaquant n'a plus de soldats, l'assaut est **repoussé**. Les défenseurs survivants rentrent chez eux.
   - **🏰 Le siège** : quand ton armée arrive à la **muraille** d'un château, elle s'arrête au pied du mur
     (elle ne la traverse pas, la muraille reste entière) et l'assiège : il ne tombe pas tout de suite. Elle doit
     tenir **8 s** (fort en bois), **13 s** (château) ou **18 s** (citadelle) : pendant ce temps, sa garnison sort,
     et le défenseur peut encore **envoyer des soldats** le défendre ; tous se battent avec le bonus de ses murs.
     Une **jauge ronde**, toujours **jaune** (bien visible, quel que soit l'assaillant ; réglage `SIEGE_RING_COLOR`), se remplit autour de la ville assiégée : quand le cercle est plein, elle tombe.
     ⏸️ Le siège se met **en pause** tant que les défenseurs (garnison ou renforts) se battent contre l'armée : la jauge
     ne reprend qu'une fois qu'ils sont tous battus.
     ⚓ Un **port fortifié** (niveau 3) se défend pareil, comme une petite ville : l'armée s'arrête à sa petite muraille
     et l'assiège **10 s**, le temps que ses défenseurs arrivent.
     **Deux armées ennemies** (pas alliées) qui assiègent **le même château** d'un troisième royaume s'affrontent
     d'abord entre elles, au pied des murs : le siège attend la fin de la bataille, et la gagnante le reprend.
   - **Prendre un château** te donne d'un coup **toute sa zone de défense** (dans sa muraille) et
     **les moulins et casernes** qui s'y trouvent. L'assaut s'arrête alors et les survivants rentrent.
   - **⏳ Trêve** : une ville (château), une église ou un port qui vient d'être conquis **ne peut pas être attaqué
     pendant 30 s** (ni par son ancien maître, ni par un autre royaume).
     Tu peux relancer un nouvel assaut aussitôt.
   - **Prendre une église ou un port** (qui permet de construire autour de lui) te donne aussi **sa zone**
     et **les moulins et casernes construits grâce à lui**. Ce qui est dans la muraille d'un château reste au défenseur.
   - **⚰️ Après-guerre et 🔥 galvanisation** : après un assaut réussi (château, église, port ou avant-poste pris ;
     détruire un avant-poste ne donne **pas** de malus d'après-guerre, mais son propriétaire est quand même galvanisé),
     pendant **30 s**, le vainqueur panse ses blessures (**−25 %** de soldats produits), et le perdant est galvanisé
     par la défaite (**+25 %**). **Ces effets s'additionnent** : chaque victoire ajoute −25 % pendant ses 30 s
     (jusqu'à −75 % : qui attaque trop le paie cher), chaque défaite ajoute +25 % (jusqu'à +100 % : qui est trop
     ciblé peut se rattraper). Après-guerre et galvanisation **s'additionnent aussi entre eux** : un +25 % annule
     un −25 %. La jauge des soldats indique le total.
     **Repousser un assaut** galvanise aussi le défenseur : **+25 %** de soldats produits pendant **15 s** (ça s'additionne aussi).

   **✂️ Couper** : un royaume reste **d'un seul tenant** (sur chaque île). Quand un assaut le coupe en morceaux, il ne garde
   que le plus grand de l'île : **celui qui a coupé prend d'un coup tous les autres**, **quelle que soit leur taille**,
   avec leurs **églises, ports, moulins et casernes**. Si personne ne l'a coupé (par exemple après la perte
   d'un avant-poste), c'est le royaume qui entoure le plus le morceau qui le prend.
   Mais la **route** d'un assaut vers un objectif (château, église, port…) n'est que **visuelle** tant que le combat
   n'est pas joué : elle ne coupe le royaume que si l'assaut **prend son objectif**. S'il échoue, elle est rendue et rien n'est coupé.
   Et elle ne peut **jamais être coupée** en route : même si la case d'où elle part est convertie par la Croyance (ou prise),
   l'armée garde son chemin.
   Un morceau avec un **avant-poste** (une invasion par la mer) se défend : il faut viser l'avant-poste.
   Un royaume installé sur **plusieurs îles** (par la mer, puis un château) n'est pas « coupé » d'une île à l'autre.

   **✂️ Grand morceau coupé** : si un royaume est coupé en deux sur un même continent, un autre morceau tenu par une **ville**
   (ou un port fortifié) et **assez grand** (au moins **25 %** de son plus grand morceau) n'est pas « coupé » : c'est un
   **cœur à part entière**, comme une autre île. Ses armées en partent, ses défenseurs y vont, et il n'est pas englobé.
   Seuls les **petits** morceaux sont pris (sauf la zone de leurs villes, qui restent isolées, voir ci-dessous).
   **🚩 Château isolé** : les **châteaux** et les **ports de niveau 3** savent se défendre seuls (avec leur
   garnison) : quand leur morceau est pris, ils **restent à leur royaume**, avec les terres de leur zone,
   **isolés** au milieu des terres ennemies.
   - Un château (ou port) isolé **continue de produire** pour son royaume (avec les moulins et casernes de sa zone) :
     il est juste plus difficile à défendre.
   - Son royaume **ne peut plus lui envoyer de défenseurs** : seule sa garnison le défend.
     Aucune armée ne peut partir de lui.
   - Sur la carte, chacun de tes châteaux (ou ports royaux) isolés porte un **petit fanion rouge** sur le côté.
   - Pour le sauver, **clique sur ton château (ou port) isolé** : tu lances un **assaut classique** (marche depuis ta cité la plus proche,
     renforts…) depuis ton royaume, qui traverse les terres ennemies (en évitant leurs murailles) pour le rejoindre.
     **S'il y arrive**, sa route s'élargit un peu : tu récupères des terres entre le château et ton royaume,
     ils sont **réunis** et tu peux le défendre comme avant. Si le château était attaqué, les soldats
     de ton assaut rejoignent sa défense.
   - **Ton dernier château isolé** : si **tous** tes châteaux sont isolés, ton armée est **bloquée dedans** :
     - ton grand territoire, coupé de tous tes châteaux, **n'est plus défendu** (tout le monde peut l'attaquer de front)
       et **aucune armée ne peut en partir** (ni attaque, ni expansion) ;
     - tes soldats peuvent défendre ce château, mais **moins bien** (chacun compte pour 0,8) ; et quand il est
       attaqué, **toutes tes troupes restantes le défendent d'office** ;
     - **le seul moyen d'en sortir** : relier ton territoire à un château (clique sur ton château isolé pour un
       assaut de jonction) ou **bâtir un nouveau château** sur ton territoire, pour avoir de nouveau une zone de
       départ pour tes armées. Un message 🚩 te prévient quand ça arrive.
     - un territoire **désorganisé** (sans ville ni port fortifié pour le diriger, ni avant-poste) **ne peut rien construire
       d'autre qu'un château** : il lui faut d'abord un château pour diriger le royaume.
3. **Construis** : appuie sur `1` à `5` ou `7` pour la mine (ou `&`, `é`, `"`, `'`, `(`, `è` sur un clavier AZERTY, ou clique sur un bouton en bas) : le bâtiment apparaît
   **sous ta souris** (son image, sur un carré vert si l'emplacement est bon, rouge sinon), puis **clique** pour le poser. Rappuie sur la même touche ou `Échap` pour annuler.
   Un bâtiment posé est d'abord **en chantier pendant 3 s** (petite jauge verte) : il ne produit rien avant la fin.
   **Clique sur un de tes bâtiments** : un **menu rapide** s'ouvre juste à côté, avec deux icônes : une **flèche ⬆️** pour l'améliorer
   (travaux de **40 s** pour passer au niveau 2, **60 s** pour le niveau 3, pour tous les bâtiments) et **✖** rouge pour le détruire (travaux de **10 s**, après une confirmation). La fenêtre en haut à gauche explique
   ce qu'apporte l'amélioration, avec ses propres boutons **Améliorer** et **🧨 Détruire**. Détruire une **ville**, une **église** ou un **port**
   fait aussi sauter les **moulins et casernes qui en dépendaient** (dans sa muraille, ou à une de ses places), sauf si une autre ville, église ou port les accueille. Pendant les travaux, une petite **jauge** se remplit sous le bâtiment ;
   recliquer dessus permet de les annuler (l'or d'une amélioration est rendu). S'il est pris pendant les travaux, ils sont perdus.
   Les moulins et casernes occupent **2x2 cases** de ton territoire, les châteaux **4x4 cases** (pas de mer).
   **Tu peux construire au maximum 3 châteaux par partie** (capitale comprise ; le bouton **Château** affiche le compte, ex. « 1/3 ») ; les châteaux pris à l'ennemi
   ne comptent pas dans cette limite, et ta meilleure **église** améliorée en débloque d'autres.
   **Le terrain compte** : un moulin produit plus en plaine (+30 %) qu'en forêt (normal), colline (-10 %) ou montagne (-30 %) ;
   une caserne produit plus en forêt ou colline (+30 %), et encore plus sur une **colline boisée** (+40 %), qu'en plaine (normal) ou montagne (-10 %) ;
   une **église** (sa Croyance et son or) rayonne mieux en hauteur : **+30 %** sur une colline, une colline boisée ou une montagne,
   **-20 %** en forêt, normale en plaine.
   Dans le **désert** 🏜️, tout bâtiment (moulin, caserne, port) produit **20 % de moins**.
   Pendant la construction, l'info en bas à gauche indique la production prévue à cet endroit.
   **💰 Prix** : chaque bâtiment que tu **construis** rend le suivant du même type **50 % plus cher** (seulement **35 %** pour
   les **moulins** et les **casernes**, et **2 fois plus cher** pour les **églises** et les **ports** ; les mines gardent leur prix).
   Les bâtiments que tu **prends à l'ennemi** ne comptent pas (et un bâtiment perdu ne compte plus).
   **Les moulins et casernes se construisent dans l'enceinte d'une de tes villes** (dans sa muraille),
   **ou près d'une de tes églises** (ou d'un port amélioré), qui a encore de la place, pas ailleurs dans l'arrière-pays.
   Une ville a **4 places** (niveau 1), **6** (niveau 2) ou **9** (niveau 3) ; quand elle est pleine, un moulin dans sa muraille
   doit prendre la place d'une église ou d'un port proche (sinon, impossible). En survolant une ville : « places prises : 3 sur 6 » ;
   en survolant une église ou un port : « 🏠 1/1 place » ; en survolant un moulin ou une caserne : la place qu'il occupe
   (d'une ville, d'une église, d'un port), ou « sans place » s'il a été pris à un autre royaume (il produit quand même pour
   son nouveau maître, mais ne laisse pas de place libre pour en bâtir un autre). De même, si une église (ou un port) passe
   à un autre royaume sans son moulin, ce moulin occupe toujours sa place : le nouveau maître ne peut pas en bâtir un autre
   à côté tant qu'il ne l'a pas améliorée.
   Les châteaux et les églises, eux, se construisent partout sur ton territoire.
   Il faut aussi laisser **3 cases d'écart** autour de chaque bâtiment, et **4 cases** autour des châteaux
   (l'aperçu devient rouge si c'est trop près). Quand tu choisis un **moulin** ou une **caserne**, les zones où l'on peut
   construire (muraille de tes châteaux, zone de tes églises et ports) se colorent : **vert** là où il peut se poser,
   **rouge** là où c'est impossible, pour bien organiser tes constructions.
   Si un ennemi prend une seule de ces cases, il capture tout le bâtiment !
   - 🌾 **Moulin** : **toutes les 10 secondes**, il verse un peu d'or d'un coup
     (un petit chiffre `+2 💰` s'envole au-dessus de lui). **Clique dessus pour l'améliorer** (menu rapide) (2 niveaux) :

     | Niveau | Or produit | Prix |
     |---|---|---|
     | 1. Moulin | un peu | prix du moulin |
     | 2. Grand moulin | +133 % | 💰 150 |

     **Rendement décroissant** : plus ton royaume a de moulins et de ports, moins chacun rapporte
     (3 → 83 % chacun, 6 → 67 %, 12 → environ la moitié). Les premiers rapportent bien, mais on ne devient pas
     riche trop vite en en accumulant (le survol d'un moulin montre son rendement).

   - ⚔️ **Caserne** : **toutes les 10 secondes**, elle forme quelques soldats (`+3 ⚔️` au-dessus d'elle),
     et elle agrandit ton armée maximum. **Clique dessus pour l'améliorer** (menu rapide) (3 niveaux) :

     | Niveau | Soldats produits | Bonus d'armée max | Force de **tous** tes soldats | Prix |
     |---|---|---|---|---|
     | 1. Camp d'entraînement | quelques-uns | un peu | **+30 %** | prix de la caserne |
     | 2. Caserne | +100 % | +100 % | **+80 %** | 💰 400 |
     | 3. Grande caserne | +125 % | **x7** (+350 soldats) | **+150 %** | 💰 2500 |

     ⚔️ **Recrutement de masse** (avec une **grande caserne**, niveau 3 : bouton dans son menu, et dans la barre des
     constructions) : pour **💰 3000**, ton royaume recrute **bien plus vite pendant 60 s** (un seul à la fois). C'est
     d'autant plus fort que ton armée est **petite** : au plus fort quand elle est presque vide, encore 80 % de l'effet à 35 % de
     ton armée maximum ; puis l'effet tombe vite (plus rien à 65 %). Idéal pour se refaire après une grosse bataille.
     Et il **favorise les petits royaumes** : son effet dépend de ton armée maximum comparée à celle du **plus grand royaume**.
     Un tout petit royaume recrute jusqu'à **x5** (armée vide), un royaume moitié moins grand que le plus grand environ x3,3,
     et le plus grand **x1,6** au plus (réglages `LEVY_SMALL` et `LEVY_BIG`).
     Son bonus est **amplifié par la galvanisation** et **diminué par l'après-guerre** : il avantage la **défense** (un royaume
     galvanisé +50 % voit son bonus monter de moitié), bien plus que l'attaquant qui vient de gagner.

     Une caserne ne fait pas dépasser l'armée maximum. **L'armée maximum compte tous tes soldats** : ceux du royaume, mais
     aussi ceux **partis en campagne** (dans tes assauts, tes défenseurs, ceux qui rentrent), aux avant-postes et en mer
     (pas les garnisons) : pendant qu'une armée est au loin, le royaume ne recrute pas au-delà de son maximum. Les soldats produits et l'armée max de toutes
     tes casernes s'additionnent, mais avec un **rendement décroissant** (comme les moulins) : plus tu as de casernes,
     moins chacune produit de soldats (3 → 83 % chacune, 6 → 67 %).
     **La force des soldats** vaut pour tout le royaume dès **une seule** caserne de ce niveau
     (la meilleure compte, ça ne s'additionne pas) : au combat, chacun de tes soldats vaut 1,3 soldat
     (niveau 1), 1,8 soldat (niveau 2) ou 2,5 soldats (niveau 3), en attaque comme en défense.
     C'est un rapport entre les deux camps : une grande caserne (x2,5) contre une caserne (x1,8), c'est x1,4 pour toi.
     **L'icône des troupes** montre le niveau de la meilleure caserne de chaque royaume (sur la carte, sur ses armées,
     dans sa fiche) : **deux épées croisées** (sans caserne ou niveau 1), les épées avec **un casque** (niveau 2), puis
     avec **un bouclier** devant (niveau 3). Tu vois tout de suite quelles troupes sont les plus fortes.
     Tu ne vois que les chiffres de **tes** bâtiments, pas ceux des autres royaumes.
   - 🏰 **Château** : entoure les terres proches d'une **muraille** dessinée sur la carte.
     La muraille suit tes frontières sans déborder chez le voisin.
     Seules les cases à l'intérieur de la muraille sont renforcées : le bonus s'ajoute à la défense du terrain.
     Pendant que tu le poses (ou l'améliores), une **petite bulle** près de la souris montre la **défense totale**
     de sa muraille à cet endroit (terrain + murs, en moyenne) : en forêt ou en colline, elle est bien plus forte.
     **Clique sur un de tes châteaux pour l'améliorer** (menu rapide) (4 niveaux) :

     | Niveau | Défense des murs | Muraille | Moulins et casernes dedans | Garnison | Prix |
     |---|---|---|---|---|---|
     | 1. Fort en bois | +100 % | petite | 4 | quelques soldats | 💰 250 (puis plus cher à chaque château) |
     | 2. Château | +200 % | moyenne | 6 | x5 | 💰 500 |
     | 3. Citadelle | +400 % | grande | 9 | x3 | 💰 3000 |
     | 4. Cité impériale | +600 % | immense | 12 | 300 soldats | 💰 15 000 |

     Chaque soldat de garnison **vaut 3 soldats** au combat. **Une citadelle** permet aussi de mener
     **2 assauts en même temps** contre un même royaume (sur deux de ses cibles différentes).

     👑 **La cité impériale** (niveau 4) : **une seule par partie**, et il faut d'abord avoir **au moins un bâtiment de chaque
     type au niveau maximum** (un grand moulin, une caserne niveau 3, une église niveau 3, un port niveau 3, et la citadelle
     elle-même) ; la fenêtre de la ville dit ce qu'il manque. Pour **15 000 d'or** (90 s de travaux), elle apporte :
     - muraille immense, défense des murs **+600 %**, **12** places, garnison de **300** ;
     - un **3e mur** (💰 2000) ;
     - routes internes à **+100 %** ;
     - **toutes les troupes du royaume +25 %** plus fortes au combat ;
     - ses **routes commerciales +50 %** ;
     - ses chemins vers les **ports et les églises** deviennent des **routes de pierre** : leurs bonus **x2** (port +60 %,
       église 2 fois plus d'or), et les moulins et casernes au bord de ces routes aussi (+40 %).

     **Routes** : un château de niveau 2 trace des **chemins de terre** 🛤️ vers tes moulins et casernes
     qui sont dans sa muraille : ils produisent **+20 %** (or des moulins, soldats des casernes).
     Au niveau 3, ce sont des **routes pavées** 🛣️ grises : **+50 %** (et **+100 %** pour une cité impériale).
     **Entre plusieurs villes** : un moulin ou une caserne dans la muraille de **deux ou trois villes** (de niveau 2 ou 3)
     a **une route vers chacune**, et les bonus **s'additionnent** (3 villes au plus : jamais plus que le triple).
     Peu importe l'ordre : si la deuxième (ou troisième) ville est construite après, la route apparaît aussi.

     Exemple : une forêt (+60 %) protégée par une citadelle passe à +460 %.

     🧱 **Murs** : une ville de **niveau 2** peut bâtir **un mur** (💰 500), et une **citadelle** (niveau 3) **un second** (💰 1000).
     Clique sur ta ville, puis sur le bouton **🧱 Mur** (menu rapide ou fenêtre en haut à gauche, avec le compte, ex. « Mur 0/1 »),
     puis sur l'endroit de tes terres où il doit aller (au plus **12 cases** après la muraille de la ville) : le mur part de la
     ville et va **tout droit** jusque-là (aperçu **vert** s'il est possible, ligne **rouge** sinon ; il ne passe que sur tes
     terres, sans bâtiment sur le chemin). **🧲 Aimant** : vise à moins de **3 cases** d'un obstacle (mer, lac, fleuve, sommet
     ou un autre mur) et le mur va s'y accrocher tout seul (petit rond vert), pour **fermer le passage** sans laisser de trou.
     🔀 **Second mur depuis le premier** : pour le second mur d'une citadelle, clique d'abord sur **un point de ton premier
     mur déjà bâti** (rond doré), puis sur l'endroit où il doit aller (12 cases au plus) : il part de là, en embranchement.
     🏰🧱🏰 **Relier deux villes** : vise une **autre de tes villes** (dans sa muraille, ou à moins de 3 cases) et le mur va
     jusqu'à sa muraille (ou bien chaque ville bâtit un mur vers l'autre, et les **deux murs se rejoignent** : l'aimant
     accroche le second au premier). Une fois debout, il **relie les deux villes** : **+50 soldats de garnison pour chacune** (en survolant
     la ville : « reliée par un mur à une autre ville : +50 soldats »). Si l'une des deux est prise, le bonus disparaît.
     Les bots relient aussi leurs villes quand ils le peuvent.
     Le chantier dure **40 s** (le mur apparaît à moitié transparent, avec une jauge). Une fois debout, **aucun assaut ne peut
     le franchir** : les armées ennemies doivent faire le tour. Si un mur tout neuf coupe la route d'un assaut déjà lancé,
     **devant lui** (là où il n'est pas encore passé), l'armée **le contourne** par un autre chemin ; s'il n'y a **pas d'autre
     chemin** jusqu'à sa cible, elle **rebrousse chemin** (assaut annulé). Un mur bâti sur la partie de la route **déjà
     passée** n'arrête pas l'assaut. Cas rare : une armée qui **bat en retraite** avec un mur dans son dos le franchit quand
     même, mais perd **50 % de ses soldats** à chaque mur franchi. Si la ville est prise ou détruite, ses murs disparaissent
     (et un mur dont une case est prise aussi). `Échap` ou clic droit annule la pose. **Les bots aussi bâtissent des murs** :
     ils ferment le passage par où un voisin ennemi viendrait assiéger leur ville.
   - ⛪ **Église** : elle coûte cher, mais **se construit n'importe où** sur ton territoire,
     **sauf trop près de tes châteaux** : elle doit rester hors de portée de leur muraille, même améliorée
     au maximum (quand tu places une église, un **cercle rouge** entoure chacun de tes châteaux).
     De même, un nouveau château ne peut pas être construit trop près d'une de tes églises.
     📏 **Distances entre grands bâtiments** (dans tous les sens, cercles rouges) : château ↔ château **13 cases**,
     château ↔ église ou port **15 cases**, église ↔ église, port ↔ port ou église ↔ port **11 cases**.
     Elle permet de construire des **moulins ou casernes autour d'elle**, même hors de la muraille d'un château
     (quand tu choisis un moulin ou une caserne, sa zone s'affiche en pointillés clairs).
     Attention : elle **n'est pas défendue** (pas de bonus de défense, pas de garnison), et on peut
     **l'attaquer directement, comme un château** : clique sur une église ennemie pour lancer un assaut
     (il contourne les murailles des châteaux et s'arrête une fois l'église prise).
     **Clique dessus pour l'améliorer** (menu rapide) (3 niveaux) :

     | Niveau | Croyance ✝️ | Moulins ou casernes autour d'elle | Châteaux en plus dans le royaume | Prix |
     |---|---|---|---|---|
     | 1. Église | +10 | 1 | aucun | 💰 50 (puis 2 fois plus cher à chaque église) |
     | 2. Grande église | +30 | 2 | +1 | 💰 800 |
     | 3. Cathédrale | +50 | 5 | +2 | 💰 2000 |

     Seule ta **meilleure église** compte pour les châteaux en plus : elles ne s'additionnent pas
     (une cathédrale donne +2 châteaux, même si tu as d'autres grandes églises). La **Croyance**, elle, s'additionne.

     ✝️ **La Croyance** (en haut de l'écran, à côté de tes terres) : au départ, tu en as 0. Chaque église en apporte
     (voir le tableau), et **+50 %** par **chemin** qui la relie à une ville ou à la route d'un port (3 au plus : jusqu'à +150 %).
     Tes églises **prêchent chez tes voisins ennemis** (pas chez tes alliés de pacte) : si tu as **plus de Croyance**
     qu'un voisin, tu **convertis lentement ses terres** collées aux tiennes, une case à la fois. C'est l'**écart** qui compte :
     avec 100 contre 80, ta Croyance vaut 20 face à lui. Plus l'écart est grand, plus ça va vite : environ une case
     toutes les **24 s** avec 20 d'écart, toutes les **16 s** avec 50, toutes les **4 s** avec 100, **1,25 par seconde**
     avec 200, **2,5 par seconde** avec 500, **6 par seconde** avec 1000 ; au-delà, ça accélère **de moins en moins** :
     **9 par seconde** avec 2000, **10,5** avec 3000, et **12,5 par seconde** à partir de **5000** (le maximum).
     Ces vitesses sont celles d'une **vraie domination** : il faut avoir **au moins 2 fois plus** de Croyance que le
     voisin. Un écart mince par rapport à ta Croyance avance moins vite : avec 1,5 fois plus que lui, à 85 % de la
     vitesse ; avec 1,2 fois plus, à 55 % (1 200 contre 1 000 convertit 1,8 fois moins vite que 250 contre 50, pour le
     même écart de 200). Réglages : `FAITH_DOMINANCE` et `FAITH_DOMINANCE_POWER` dans `js/config.js`. Plusieurs
     croisades en même temps (une par cathédrale) servent donc encore. Les prêcheurs visent d'abord les **couloirs étroits** et les **pointes** de son royaume qui
     s'avancent dans le tien : les frontières deviennent plus nettes, et ses routes trop fines se referment.
     La foi avance **en courbes**, pas en ligne droite : comme elle gagne les villages, elle s'étire en pointe vers les
     **églises** et les **petits ports** voisins (à moins de 30 cases), et son front ondule doucement.
     Si une conversion **coupe** son royaume, la coupe s'applique tout de suite (le morceau coupé est englobé), sauf
     les **zones de muraille** des villes et des ports fortifiés : la Croyance ne les détruit jamais.
     Elle ne prend **jamais un moulin ni une caserne** : ils suivent la ville, l'église ou le port dont ils occupent la place.
     Tant que ce bâtiment est à ton royaume, eux (et leur production) restent à toi ; si une église ou un port est converti,
     ses moulins et casernes passent avec lui.
     Un royaume **désorganisé** (sans ville ni port fortifié) se fait convertir **2 fois plus vite**.
     Ça marche dans les deux sens : un voisin plus croyant convertit **tes** terres ! Dans le classement, une **📖 bible verte**
     à côté d'un voisin veut dire que tu convertis ses terres, une **bible rouge** que c'est lui qui convertit les tiennes ;
     le petit chiffre à côté donne l'**écart de Croyance** entre vous deux (« +180 » en vert : tu gagnes ; « −420 » en
     rouge : tu perds ; plus il est gros, plus ça va vite).
     Ce n'est **pas une agression** (pas d'alerte, pas d'après-guerre). Ce que la Croyance **ne convertit jamais** : les
     **villes** et les **ports fortifiés** (niveau 3), tout ce qui est **dans leur muraille**, les **avant-postes** et leur zone,
     les **murs** 🧱, les **terres libres**, et la route d'un **assaut en cours**. Elle ne part que d'une **zone de royaume**
     organisée : pas d'une zone d'avant-poste, ni d'un morceau coupé de ses villes, ni d'un royaume désorganisé (sans ville).
     Les **bots** bâtissent et améliorent plus d'églises quand un voisin les dépasse en Croyance (surtout en Difficile).
     ✝️ **Croisade religieuse** : une **cathédrale** (église de niveau 3) propose une action dans son menu rapide (la croix,
     comme le mur des villes) et dans sa fenêtre : pour **💰 2500**, ta Croyance monte de **+1000 pendant 60 s** (une croisade
     à la fois par cathédrale). Dès ta première cathédrale, un bouton **✝️ Croisade** apparaît aussi dans la barre des
     constructions, en bas : un clic la lance tout de suite (depuis une cathédrale libre), et il affiche le temps restant
     quand toutes tes cathédrales ont déjà leur croisade en cours. De quoi convertir très vite les terres de tes voisins ! Les bots en lancent aussi quand ils sont
     en retard de Croyance (un message te prévient si c'est un voisin).

   - ⛏️ **Mine** (touche **7**, 💰 **600**, puis 💰 **1200** pour le niveau 2) : elle se bâtit seulement sur un **filon**, une
     petite icône de minerai posée au hasard sur la carte : dans les **montagnes** (fer, or, diamant) ou les **collines**
     (pierre). Il y en a environ 5 de fer, 5 d'or, 5 de pierre et 2 de diamant par carte. Une mine a **2 niveaux**, ne se
     démolit pas, et rapporte **2 fois plus** si une **route** la relie à une de tes villes (une ville à moins de **30 cases**,
     sur la même terre). Elle passe à qui prend ses terres, avec l'état de son filon. 🎯 Une mine ennemie **se vise directement**,
     comme une église ou un port (sauf si elle est dans la muraille d'une ville : il faut d'abord prendre la ville, et la mine part avec elle).
     - ⚒️ **Mine de fer** : **toutes tes troupes** sont plus fortes, **+4 %** (+8 % au niveau 2), doublé si elle est reliée :
       **3 mines au plus** (+48 % au maximum).
     - 🪙 **Mine d'or** : son filon rapporte **2 500 pièces en 10 minutes** (un peu à chaque production), doublé si reliée.
       Puis il **s'épuise** (une jauge dorée autour d'elle montre le temps qui reste) ; l'améliorer au niveau 2 le
       **relance pour 10 minutes de plus**, qui rapportent de nouveau **2 500 pièces**. Chaque mine d'or a **son propre compteur** : prise par un autre, elle reste épuisée.
     - 🪨 **Carrière de pierre** (en colline) : les **améliorations**, les **murs** et les **ponts** coûtent moins cher, **−5 %**
       (−10 % au niveau 2), doublé si elle est reliée : **3 carrières au plus** (−60 % au maximum).
     - 💎 **Mine de diamant** : une longue extraction de **20 minutes** (2 fois plus lente sans route vers une ville, 50 %
       plus rapide au niveau 2), avec une **jauge ronde** autour d'elle. Au 1er **quart**, **1 000 pièces**, au 2e **2 000**, au 3e
       **3 000**, et à la fin **10 000 pièces** d'un coup (16 000 en tout), puis le filon est **épuisé pour tout le monde**. Attention : si on te la vole, le
       chrono continue pour le nouveau maître, qui touche les versements suivants !
     À gauche de chaque mine (la tienne comme celles des autres), une **petite bulle ronde** montre l'icône de ce qui y est
     miné (fer, or, pierre, diamant), toujours visible, même quand un grand bâtiment est à côté. Une mine épuisée reste sur la carte avec une **croix rouge**. Pendant la pose d'une mine, les filons s'entourent d'un
     cercle (vert si tu peux y bâtir), passent **par-dessus les bâtiments** (une grande ville ne les cache plus), et la mine
     s'aimante sur le filon le plus proche de la souris (à moins de 5 cases). Une mine **n'a pas d'autre règle de construction** :
     elle se pose même dans la muraille d'une ville, ou tout près d'un autre bâtiment. Les **autres bâtiments**, eux, laissent
     **2 cases libres** autour d'un filon (la place de sa mine) : réglage `DEPOSIT_CLEARANCE` dans `js/config.js`.
   - ⚓ **Port** : il coûte cher et se construit **au bord de la mer ou d'un fleuve**, avec les mêmes règles
     que l'église (hors de la zone de tes châteaux et de tes églises : cercles rouges). Comme l'église, il donne des
     places pour des moulins et casernes autour de lui ; un moulin dans les zones d'un port **et** d'une église n'occupe
     qu'**une** place : celle du port en priorité. Il **n'est pas défendu** :
     on peut l'attaquer directement, comme un château. **Toutes les 10 secondes**, il rapporte de l'or.
     🛤️ **Route du port** : si une de tes **villes** (un château, de n'importe quel niveau) est à **moins de 30 cases**
     du port, sur la même terre, un **chemin de terre** les relie : le port produit **+30 % d'or**. Avec **deux** ou **trois
     villes** assez proches, il a **un chemin vers chacune** : **+60 %** ou **+90 %** (3 villes au plus).
     Une **église** pas trop loin de ce chemin (à moins de **10 cases**) s'y relie par un **petit chemin**, et elle a aussi
     un chemin vers **chaque ville** proche (à moins de **25 cases**, sur la même terre) : **3 chemins au plus**.
     🌊 **Les routes et chemins ne passent jamais sur la mer, un lac, un sommet ou un fleuve** (sauf sur un **pont**) : si l'eau
     coupe le tracé direct, la route fait un **détour** par la terre ; si le détour est bien trop long (ou impossible),
     **il n'y a pas de route** (et donc pas de bonus).
     👀 **Aperçu des routes** : pendant que tu poses un bâtiment (port, église, moulin, caserne, ville) ou que tu améliores
     une ville, ses futures routes s'affichent **en transparence** (avec des pointillés clairs) : tu vois où et comment
     elles seront tracées. Si aucune ville n'est assez proche, un **trait rouge en pointillés** part vers la plus proche
     avec « trop loin : 34 cases (30 max) ».
     📏 **Une ville améliorée relie plus loin** : **+20 % de portée par niveau**. Les routes de port et les chemins d'église
     vers elle vont jusqu'à **30 / 25 cases** (niveau 1), **36 / 30 cases** (niveau 2) et **42 / 35 cases** (niveau 3). Une nouvelle
     ville bâtie près d'elle **ajoute** un chemin (elle ne remplace pas les autres). Chaque chemin rapporte **un peu d'or**
     (+2 💰 toutes les 10 s) et **+50 % de Croyance** : les bonus s'additionnent. Mais une église près d'un **port seul**
     (sans ville proche, donc sans route) ne crée pas de chemin.
     🌾 **Le port exporte le grain** : de base, un port rapporte autant qu'un moulin. Chaque **moulin relié par une route** à une
     des villes du port lui rapporte **+15 %** d'or en plus (**6 moulins** au plus : +90 %). La barre d'aide l'indique en survolant le port.
     🌾 **Au bord d'une route** : un **moulin** ou une **caserne** bâti **hors des villes** (près d'une église ou d'un port),
     **sur** une de ces routes ou juste à côté (à moins de **3 cases** de son centre), produit **+20 %**. En le posant,
     les emplacements où il aura ce bonus sont **dorés** (au lieu de verts), et la barre d'aide en bas l'indique
     (« 🛤️ au bord d'une route ») ; une fois bâti, son survol l'affiche aussi.
     En posant un port ou une église, la barre d'aide en bas indique s'il sera relié à une ville (ou sur la route).
     **Clique dessus pour l'améliorer** (menu rapide) (3 niveaux) :

     | Niveau | Or produit | Moulins ou casernes autour | Expéditions maritimes | Prix |
     |---|---|---|---|---|
     | 1. Port | plus qu'un moulin (3 💰 toutes les 10 s) | aucun | non | 💰 60 (puis 2 fois plus cher à chaque port) |
     | 2. Grand port | +167 % | 1 | **oui** | 💰 400 |
     | 3. Port royal | +100 % | 3 | moitié prix, bateaux 80 % plus rapides, et une **petite garnison** et une **petite muraille** (+1 de défense dans sa zone, comme un fort en bois) | 💰 2000 |

     Comme l'église, un port amélioré permet de construire des moulins ou casernes autour de lui.

     🔥 **Assaut viking** (port royal, niveau 3) : achète-le **💰 3000** (bouton 🔥 Viking dans la barre des constructions,
     ou dans le menu du port royal) ; il est alors **prêt** (un seul à la fois), à lancer quand tu veux. Clique sur le bouton
     🔥 Viking, puis sur une **ville** (ou un port fortifié) ennemie **de l'autre côté de la mer**, à **25 cases au plus d'une
     de ses côtes** (ou fais un clic droit sur elle → « 🔥 Assaut viking ») : tes bateaux partent **de ton port royal** avec le %
     de soldats du curseur « Envoyer », traversent **sans aucune perte en mer**, débarquent sur la côte la plus proche de la
     cible et l'armée marche droit sur elle, **sans avant-poste**, avec des soldats **50 % plus forts**. C'est un **raid** :
     à la fin du siège, la ville n'est pas prise mais **détruite**, avec ses moulins et casernes, et chaque bâtiment détruit
     te rapporte **💰 300 de butin** ; les terres restent à l'ennemi. Puis les survivants rembarquent et rentrent au port, **2 fois plus vite** qu'à l'aller (de
     même s'il échoue ou si tu le rappelles ; réglage `VIKING_RETURN_SPEED`). **Un seul assaut viking par minute** au plus. Bateaux et assauts vikings portent une **🔥 flamme** pour les reconnaître.
     Une fois lancé, il faut en racheter un. Les bots s'en servent aussi (réglages `VIKING_...` dans `js/config.js`).

     Zoome sur la carte pour voir apparaître l'image de chaque bâtiment !

   🏝️ **Îlots imprenables** : sur un îlot (moins de 600 cases), si plus aucun ennemi ne peut y débarquer (plus aucune place
   libre de 2x2 cases, hors des murailles, pour un avant-poste), les terres qu'un royaume y tient **disparaissent** (elles
   redeviennent libres, bâtiments compris) : on ne peut pas se cacher sur un rocher pour ne jamais être achevé.
   **⛵ Expéditions maritimes** (avec un port de niveau 2 ou 3) : fais un **clic droit** sur une côte
   (au bord de la mer ou d'un fleuve, ou juste dans l'eau à côté) et choisis **⛵ Attaque navale**. Un bateau part de ton port le plus rapide,
   navigue sur la mer et les fleuves (tout le monde le voit passer), puis débarque : tu prends une **petite
   zone en demi-cercle le long de la côte** et tu y bâtis un **avant-poste ⛺** (jamais dans la **muraille** d'une ville ou
   d'un port fortifié, ni sur un mur : la côte d'une ville se prend en l'assiégeant). L'expédition coûte un peu d'or
   (un peu plus à chaque avant-poste) et emmène **le % de soldats choisi** avec le curseur « Envoyer » :
   choisis bien avant de partir ! Une petite partie se perd en mer (1 % par seconde de traversée, 25 % au plus).
   **2 assauts maritimes au plus** contre un même royaume : avec 2 bateaux en route vers lui (ou 2 avant-postes déjà sur ses terres),
   impossible d'en envoyer un 3e.
   Il faut emmener **au moins de quoi remplir la garnison** de l'avant-poste (5 soldats, pertes en mer comprises).
   - Pendant la construction, tous les soldats débarqués sont sur place. Une fois l'avant-poste bâti,
     **5 restent en garnison** (fixe : ils ne bougent jamais) et **les autres stationnent** à l'avant-poste.
   - **Les soldats stationnés peuvent partir à l'attaque depuis l'avant-poste** : clique sur une terre
     proche de l'avant-poste (ou sur un château ennemi accessible depuis lui), le curseur « Envoyer » prend alors
     le % de ses soldats stationnés. Les survivants y reviennent. Ils peuvent aussi défendre l'avant-poste
     (bannière de l'assaut ou « Défendre »).
   - On peut débarquer **partout** (terre libre ou ennemie), mais un débarquement **ne prend jamais
     un bâtiment** : il se pose juste à côté.
   - L'avant-poste met **20 secondes à être bâti** après le débarquement (compte à rebours sur la carte).
     Pendant ce temps, ses soldats bâtissent et **ne peuvent rien faire d'autre** (pas d'attaque depuis lui) ;
     on peut déjà l'attaquer. Il n'a **pas encore de garnison** : juste des **soldats affaiblis**, occupés à bâtir
     (« ⚔ 30 affaiblis » sur la carte) : chacun ne compte que pour 1 au combat (pas 3 comme une garnison), **sans aucun bonus du terrain** (même en montagne : ils ne sont pas encore retranchés) et à **60 % de leur force** (réglage `OUTPOST_BUILDING_DEFENSE`). Une fois bâti, il donne **+1 de défense** autour de lui, et **depuis lui**,
     tu peux attaquer les ennemis ou prendre des terres libres, comme depuis ton royaume.
   - Tant qu'il n'est pas relié par la terre à ton royaume, il ne compte **que sur ses soldats** (au-delà des
     mers, ton royaume ne peut pas lui envoyer de défenseurs ; une fois relié, ses soldats stationnés rejoignent
     ton armée). **Clique sur ton avant-poste** : sa fenêtre d'info s'ouvre en haut à gauche, et un **menu rapide**
     à côté de lui propose une **nef** pour les **Renforts** (le % choisi part par la mer, depuis un port de niveau 2
     ou plus) et une **ancre** pour **Rapatrier** (les soldats qui y attendent rembarquent vers ton port le plus proche et rejoignent ton armée ;
     la garnison, elle, reste). Le bouton **🧨 Abandonner** (dans sa fenêtre d'info) fait disparaître l'avant-poste
     (ses terres te restent) : **tous ses soldats**, garnison comprise, rentrent automatiquement par la mer.
     Si c'est l'**ennemi** qui le détruit, ses soldats ont été vaincus : ils sont perdus.
     Si l'avant-poste tombe pendant que des renforts sont en mer, leur bateau **fait demi-tour** jusqu'au port.
     Les renforts qui arrivent sur un avant-poste **déjà bâti** complètent sa garnison, et les autres
     stationnent, tout de suite prêts à agir (pas de nouvelle construction à attendre).
   - Si un **château** ou un **port royal** (niveau 3, un poste de commandement comme une ville) **est bâti ou pris dans sa zone**, elle devient une vraie terre de ton royaume, qui partage
     ton armée : l'avant-poste disparaît et ses soldats rejoignent tes troupes.
   - **Toute la zone de l'avant-poste** (son morceau de territoire, tant qu'il n'est pas relié au royaume) est défendue
     par **ses soldats stationnés** : si l'ennemi y attaque une église ou un port, ce sont eux qui partent le défendre.
   - On ne peut **pas bâtir de château à moins de 12 cases d'un avant-poste** (cercle rouge) : il faut d'abord
     conquérir des terres autour de lui.
   - Les ennemis peuvent **viser l'avant-poste** pour le détruire (après un **siège de 10 s**, pendant lequel
     ses soldats stationnés et des renforts peuvent encore le défendre). **Tous les soldats qui sont dans l'avant-poste
     se battent** avant qu'il tombe : ceux qui le bâtissent, la garnison, les renforts arrivés par la mer pendant
     l'assaut, et, au siège, les soldats stationnés (d'office, même si tu n'as pas cliqué sur « Défendre »).
     Avec deux assauts en même temps, la garnison défend contre l'armée qui est au pied des murs. Détruit, il emporte **toute sa zone** avec lui :
     les terres qu'il avait prises passent **d'un coup** à celui qui l'a détruit (sauf si cette zone est déjà reliée au
     royaume, ou tenue par une ville ou un port fortifié).
   - Un royaume qui a **perdu tous ses ports** perd aussi **tous ses avant-postes** : plus aucun bateau ne peut les rejoindre.
     Ils sont supprimés de la carte avec leurs soldats, et leurs zones redeviennent des terres libres (sauf si elles sont
     reliées au royaume ou tenues par une ville ou un port fortifié).
   - Un royaume qui n'a **plus que des avant-postes** (plus aucune ville ni port fortifié, et plus de terres hors de leurs
     zones) est **perdu** : il est anéanti (la prime va à celui qui lui a pris ses dernières terres), ses avant-postes
     sont supprimés et leurs zones redeviennent des terres libres.
   - Une expédition en mer **ne peut pas être interceptée** : tu es prévenu quand elle vise ta côte
     (une petite zone rouge marque l'endroit du débarquement), et tu l'attaques quand elle accoste.

   **🖱️ Clic droit** sur la carte : un menu d'actions s'ouvre (⚔️ Attaquer · 🤝 Proposer une alliance · ⛵ Attaque navale · 🛶 Traverser le fleuve · 🌉 Construire un pont).
   Pour construire un bâtiment, utilise la barre du bas (ou les touches 1 à 5).
   Chez un **allié**, il propose aussi **🎁 Envoyer des soldats** (le % choisi avec « Envoyer » ; seulement si ses terres
   **touchent les tiennes** : tes soldats y vont à pied) : il n'en reçoit que
   **75 %**, le reste se perd en route, et sans dépasser son armée maximum. Et **💰 Envoyer de l'or** (le même %
   de ton trésor) : lui le reçoit **en entier**, tout de suite.
   Ça marche aussi avec les alliés de ton camp dans le scénario **Azeroth : les Factions**. Un allié ne se bat jamais à ta place sur tes
   terres : quand tu te fais attaquer, les royaumes de ton pacte t'envoient parfois des soldats, qui **rejoignent ton
   armée** (un message te prévient) ; à toi de les envoyer se défendre. Les royaumes rivaux font de même entre eux.
4. **Forme des pactes** (ils sont **interdits par défaut** : chacun pour soi ; autorise-les dans le menu de départ pour jouer avec) : clique sur 🤝 à côté d'un royaume dans le classement (ou fais un **clic droit** sur ses terres)
   pour lui proposer de t'allier.
   Les alliés forment un **pacte** (jusqu'à 3 royaumes) : si l'un d'eux est déjà dans un pacte, l'autre le rejoint.
   **Seul le fondateur** du pacte (celui qui l'a proposé) accepte les nouveaux membres ; s'il quitte le pacte (ou tombe), le
   **plus grand royaume** qui reste devient le fondateur, et le pacte prend son nom (« Pacte de … ») : une demande pour rejoindre le pacte
   va à lui, et les autres membres ne peuvent pas inviter.
   **On ne peut faire partie que d'un seul pacte** : impossible de s'allier avec un royaume d'un autre pacte.
   Les membres d'un pacte ne peuvent pas s'attaquer. Les royaumes peuvent aussi te proposer un pacte : accepte ou refuse. Pas de spam : au plus une demande toutes les
   20 s, et un royaume refusé ne redemande pas avant **2 minutes**, ni à toi ni à un autre membre de ton pacte.
   **Qui est allié avec qui ?** Chaque pacte est entouré d'une **frontière en pointillés**, **or** et **couleur de son fondateur**,
   visible par tous, qui fait le tour de tous ses membres (plus fine quand on dézoome). Dans le **classement**, les membres d'un pacte sont **regroupés dans un cadre**,
   avec le nom du pacte et sa **part des terres** (tous ses membres ensemble) ; les pactes et les royaumes seuls sont classés ensemble.
   🚶 **Traverser les terres d'un allié** : une cible (ville, église, port, mine ou avant-poste) qu'on ne peut pas
   atteindre depuis ses terres, mais qui touche les terres d'un allié du pacte : l'assaut passe par chez lui. En la
   visant, le chemin s'affiche (sa marche chez l'allié en bleu, puis son chemin chez l'ennemi en jaune). L'armée part de ta
   ville, traverse tes terres puis celles de ton allié **sans perdre de soldats** (comme chez toi), et attaque depuis le
   bord de ses terres. Si le **pacte est rompu** (ou si ces terres changent de mains) pendant qu'elle les traverse, elle
   **rentre tout de suite, sans perte**. Une ville prise ainsi est d'abord un **château isolé**, loin de ton royaume.
   Pour trahir un allié, attaque-le directement (ou clique sur 💔) : une confirmation t'est demandée,
   et tu quittes le pacte.
   Mais attention, un **traître** 🗡️ le paie cher pendant 2 minutes : **sa défense est réduite de moitié**
   (ses terres coûtent 2x moins de soldats à prendre), personne ne veut s'allier avec lui,
   et les autres royaumes en profitent pour l'attaquer !
   🛒 **Routes commerciales** : dans le menu d'une de tes **villes de niveau 2 ou plus** (à côté du mur), le bouton
   **Route commerciale** la relie à une **ville de niveau 2 ou plus d'un allié de ton pacte** : clique sur la ville
   alliée (en la survolant, tu vois le tracé, le prix et le revenu). La route est une **grande voie pavée** de pierres grises,
   comme les vieilles routes marchandes, et passe **uniquement sur vos
   deux territoires** (le tien et celui de ton allié ; si elle ne peut pas, la bulle dit ce qui bloque : des terres libres
   ou d'un autre royaume sur le passage, ou l'eau) : jamais sur la mer, un lac ou un sommet infranchissable, ni à
   travers un fleuve, **sauf sur un pont** (un pont bâti ouvre un passage). **Si une case de son passage est prise par un
   autre royaume, la route est coupée** : le commerce s'arrête jusqu'à ce que tout son passage soit de nouveau à vous deux. Elle coûte **1 000 d'or** jusqu'à 40 cases, puis 30 de plus
   par case (**5 000 au plus**), et rapporte **+0,5 d'or par case de route toutes les 10 secondes** (une route de 100
   cases : +50) ; ton allié en touche aussi **la moitié**. Plus elle est longue, plus elle rapporte : elle se rembourse
   en 8 à 10 minutes environ. **Le nombre de routes d'une ville dépend de son niveau** : **1** pour un château (niveau 2), **2** pour une citadelle, **3** pour la cité impériale (celles qu'elle a ouvertes et celles qui y arrivent : le bouton affiche « 0/1 », « 1/2 »…), 250 cases au plus. Une ville déjà reliée peut s'ouvrir vers **une autre** ville alliée, mais **deux villes ne se relient qu'une fois** (si ton allié a déjà ouvert la route entre elles, tu ne peux pas la refaire). **Si le pacte est rompu, la route reste mais
   ne rapporte plus rien** (elle devient pâle) ; elle **reprend** dès que les royaumes qui tiennent ses deux villes sont
   de nouveau alliés, même si ce sont d'autres royaumes qui les ont prises entre-temps (l'or va alors à eux). Elle ne
   disparaît que si une de ses villes est détruite. Dans une partie **sans pactes**, le bouton reste grisé.
5. **Gère ton armée et ton or** : tu commences petit, puis ton royaume grandit peu à peu.
   Tu as deux sortes de revenus : un **revenu de base**, continu, qui grandit avec ton territoire,
   et la **production de tes moulins et casernes**, versée toutes les 10 secondes.
   Le jeu ne montre **pas de chiffres précis** (pas de « +X par seconde ») : seulement des pourcentages.
   À toi de voir ce qui marche le mieux !
   La jauge en bas de l'écran montre **ton armée sur son maximum** (ex. « ⚔️ 150 / 300 », dont tant en garnison…) ;
   au-dessus, si ton recrutement va bien.
   **Les garnisons sont fixes** : leurs soldats ne quittent jamais leur château, port ou avant-poste
   (ils ne servent qu'à le défendre ; pour attaquer, tu utilises tes soldats disponibles, ou ceux stationnés
   à un avant-poste). **Les garnisons ne comptent pas dans ton armée** : ce sont des armées liées à leur bâtiment
   (des villes bien gardées ne freinent donc pas ton recrutement). Les soldats **stationnés** aux avant-postes et
   ceux **en mer**, eux, comptent dans ton armée (la jauge les affiche) : ensemble, ils ne peuvent pas dépasser le maximum. Le recrutement est **le plus rapide quand ton armée n'est
   ni vide ni trop pleine**, puis il **ralentit** si tu accumules trop de soldats, jusqu'à s'arrêter quand l'armée
   est pleine. Pas de repère précis : c'est la **couleur de la jauge** qui te guide (vert = au top, orange = normal,
   rouge = ralenti).
   **🐢 Fatigue de guerre** : un grand territoire recrute plus vite, mais **de moins en moins** : un royaume 4 fois plus grand
   ne recrute que 2 fois plus de soldats. Les grandes armées se font attendre !
   **💰 Solde des troupes** : garder trop de soldats coûte cher ! Au-delà de la moitié de ton armée maximum,
   tes soldats disponibles (pas les garnisons) réduisent **tout l'or que tu gagnes**, jusqu'à **−25 %** avec
   une armée pleine (c'est affiché sous la jauge).
   Envoie donc tes troupes au combat plutôt que de les garder !
   **🚀 Élan de départ** : au début de la partie, tout le monde recrute **3 fois plus vite** ;
   cet élan diminue peu à peu et disparaît au bout de **5 minutes**. Les **terres libres**, elles, se prennent
   **3 fois plus vite toute la partie**, et quand l'élan du recrutement retombe, elles coûtent **moins de soldats**
   (jusqu'à 3 fois moins) : l'expansion en terre vierge garde le même rythme qu'au début, toute la partie.
   Et elle va encore **30 % plus vite** (`FREE_LAND_BOOST`) : chaque armée avance plus vite et perd moins de soldats par case libre.
6. **Gagne** en possédant 70 % des terres, ou en éliminant tous les autres royaumes.
   À la fin (victoire ou défaite), le bouton **📽️ Résumé** rejoue toute la partie en accéléré, sur la carte
   entière et sans détail : on voit les royaumes grandir, se battre et disparaître (avec l'heure de la partie et
   les plus grands royaumes du moment ; ▶️/⏸️ et une réglette pour revenir à un moment précis).
   **Anéantir un royaume** rapporte une **prime de 500 pièces**, plus **tout le trésor** qui lui restait.
   Après la victoire, le bouton **Continuer** te laisse finir la conquête si tu veux.
7. **Joue à plusieurs, en ligne** 🌐 : quand le jeu vient d'un **serveur de jeu** (voir
   [`serveur/PROTOCOLE.md`](serveur/PROTOCOLE.md) : `node serveur/serveur.js`, puis http://localhost:8080), le menu
   affiche **🌐 Jouer en ligne** (sous « Commencer la conquête ») :
   - 🌍 **Partie publique** : une partie part **toutes les 2 minutes** avec tous ceux qui attendent, sur une carte tirée
     au hasard (aléatoire ou prédéfinie, annoncée dans le salon avec le compte à rebours) ; des **bots** complètent
     jusqu'à 10 royaumes. **Personne** ne peut la mettre en pause ni changer sa vitesse.
   - 🔒 **Salon privé** : « Créer un salon privé » donne un **code** de 4 lettres (et un lien 🔗 à copier) ; tes amis
     tapent le code et cliquent sur « Rejoindre » (ou ouvrent le lien). L'**hôte** 👑 choisit les réglages du menu (carte,
     taille, pactes, difficulté, nombre de bots ; les autres les voient changer), puis **⚔️ Lance la partie**. Il décide de
     la **pause** et de la **vitesse**, pour tout le monde ; chacun des autres joueurs peut mettre la partie en pause
     **15 s, une fois toutes les 5 minutes**. Si l'hôte s'en va, le joueur suivant prend sa place.
   - Pas de nom écrit (ou « Mon Royaume » laissé tel quel) : ton royaume reçoit un **nom au hasard** (Valdor, Brumeval…),
     pour que tout le monde ne s'appelle pas pareil ; deux joueurs au même nom deviennent « Valdor » et « Valdor II ».
   - Au début, chacun a **15 secondes** pour fonder sa capitale (sinon, une place au hasard), puis la partie commence pour
     tous. Les autres joueurs ont un 👤 dans le classement ; on peut leur proposer un pacte (ils répondent eux-mêmes),
     les aider ou les attaquer comme un bot. Un joueur qui quitte la partie est remplacé par un **bot**. Vaincu, tu peux
     **👁️ regarder la suite** ; la partie s'arrête quand un royaume tient 70 % des terres (ou reste seul).
   - Les **scénarios** et les **cartes dessinées** se jouent en solo, pour l'instant. Si la connexion au serveur est
     perdue, la partie continue en solo (les autres joueurs deviennent des bots).
   - Comment ça marche : chaque navigateur calcule la partie de son côté (la même graine, les mêmes ordres, dans le
     même ordre : comme OpenFront) ; le serveur ne fait que relayer les ordres des joueurs, 10 fois par seconde. Il
     compare de temps en temps les « empreintes » des parties : si elles diffèrent, un avertissement s'affiche.

🌲 Chaque terrain a sa défense : plaine normale, forêt +60 %, colline +120 %, montagne +180 %. La forêt pousse aussi sur les collines : une **colline boisée** cumule les deux bonus (+180 %, comme une montagne) ; on la reconnaît à son vert olive bosselé, parsemé de sapins. Plus elle est haute, plus la case coûte de soldats **et de temps** à conquérir : ton royaume s'étend vite dans les plaines et lentement dans les forêts, collines et montagnes. Sa forme suit donc le relief !
🎨 **Une carte en pixel art** : chaque case est dessinée en petits pixels carrés. Là où deux terrains se touchent,
leurs pixels **s'entremêlent** (bords « effilochés »), comme sur une vraie carte ; les fleuves, eux, restent continus.
🏔️ **Ombrage du relief**, comme sur une vraie carte : le soleil vient d'en haut à gauche, les pentes tournées vers lui
sont éclairées et les autres dans l'ombre. Les montagnes montent tout droit vers les crêtes de leur massif : des **versants plats
aux tons bien tranchés** (éclairé ou sombre) qui se rejoignent en **arêtes nettes**, case par case comme du pixel art, et les plaines, forêts
et déserts de **douces ondulations** (un peu plus fines en forêt), même sous les couleurs d'un royaume. La **mer fonce au large**, avec de grandes nuances
plus claires et plus foncées. (Réglages dans `js/config.js` : `SMOOTH_MAP` pour la forme des bords entre terrains (escalier, coins coupés en biais ou arrondis), `RAGGED_EDGES` pour des bords granuleux,
`TERRAIN_BORDERS` pour les lignes entre les terrains, `HILLSHADE`, `TERRAIN_GRAIN`, `MOUNTAIN_ROUGHNESS`, `MOUNTAIN_TONE_STEP`, `HILL_BUMPS`, `EDGE_SHADE`,
`WATER_DEPTH_SHADE`, `WATER_NOISE`, `MAP_SHADE_SOFT` et `MAP_SHADE_RAW`.)
🌲 En zoomant, les **forêts** sont parsemées de petits **sapins** transparents.
📜 **Vue parchemin** : en dézoomant presque au maximum (molette vers l'arrière, au-delà de « toute la carte »), la carte
devient une **vieille carte sur parchemin**, encadrée : terres beiges ombrées par le relief, côtes soulignées à l'encre, mer
gris-vert, et les royaumes en couleurs légères. Elle apparaît en fondu, et on revient à la carte normale en zoomant.
Plus de détails (routes, murailles, moulins…) : chaque **ville** est un petit dessin à l'encre (des tours aux toits pointus,
plus nombreuses selon son niveau, avec le fanion de son royaume ; une couronne pour la cité impériale), et seules les
**cathédrales** ⛪ et les **grandes casernes** ⛺ (niveau 3) sont dessinées aussi.
(Réglage `PARCHMENT_ZOOM` dans `js/config.js`.)
🧵 **Le cadre brodé** : la carte est entourée d'une **tapisserie médiévale** (chasseurs, anges, guerriers, saints, drakkars,
dragon…), posée par-dessus le décor marin. Quelle que soit la forme de la carte, le cadre s'y adapte sans jamais étirer ses
dessins : ses rubans d'entrelacs sont prolongés, et ses panneaux illustrés se remplissent d'un ciel de **nuages brodés**
dans le même style (dessous plat, dessus en festons, contour sombre et coutures, sur le grain de la toile), dans un cadre
brodé de **fil d'or** qui les sépare franchement des dessins d'origine. (Réglages
`FRAME_IMAGE`, `FRAME_INNER`, `FRAME_SPLIT`, `FRAME_BAND` et `FRAME_PANELS` dans `js/config.js`.)
🌊 **Le décor autour de la carte** : la carte est encadrée et posée sur une vieille carte marine dessinée (îles rocheuses,
navires, monstres marins), qu'on découvre en dézoomant. La vue ne va jamais plus loin que ce décor : on ne peut pas
dézoomer ni se déplacer au-delà. (Réglages `DECOR_IMAGE` et `DECOR_SIZE` dans `js/config.js`.)
🏷️ **Noms des royaumes** : écrits comme sur une vieille carte, en lettres espacées d'une police ancienne, **en oblique dans
le sens du royaume** (s'il est allongé) et légèrement courbés ; sa bannière et ses soldats sont juste en dessous.
Le nom (avec sa bannière et ses soldats) **reste toujours à l'intérieur de son royaume**, à l'endroit où il a le plus de
place : deux noms ne se chevauchent donc jamais. Le nom d'un royaume petit ou très fin n'apparaît qu'en **zoomant** (en
survolant le royaume, la barre du haut donne de toute façon son nom et ses infos).
🖊️ En zoomant, une **fine ligne brune, discrète**, délimite chaque zone de terrain (plaine, forêt, colline, colline
boisée, montagne, sommet, désert) : on voit bien où commence chaque terrain. (Réglages `TERRAIN_BORDERS` pour l'enlever
et `TERRAIN_BORDER_ALPHA` pour sa force, dans `js/config.js`.)

🌊 **Les fleuves** naissent dans les montagnes et descendent jusqu'à la mer : ce sont de vraies **frontières naturelles**.
**Personne ne peut les prendre** : ils restent bleus et neutres pour toujours, et ni l'expansion ni les assauts ne les franchissent.
**Le seul moyen de passer, c'est la traversée à gué** (ci-dessous). Un royaume présent des deux côtés d'un fleuve
reste un seul royaume (il n'est pas « coupé »), mais ses soldats ne volent pas : ses **défenseurs**, ses armées qui
marchent vers la frontière et ses soldats qui rentrent passent le fleuve **à gué**, par le vrai chemin, et perdent
**5 secondes par case de fleuve** traversée.
🌉 **Ponts** : fais un **clic droit sur un fleuve** dont les deux rives, juste en face, sont à toi (à l'horizontale ou à la
verticale, 3 cases de fleuve au plus) et choisis **Construire un pont** (💰 **700**). Tes armées, tes défenseurs et tes
soldats qui rentrent le passent alors **sans s'arrêter**, comme une plaine. Le pont sert à celui qui tient ses deux rives.
🤝 Un pont peut aussi relier **ton territoire à celui d'un allié de ton pacte** (une rive à toi, l'autre à lui) : les routes
(et les **routes commerciales**) passent dessus.
Les **bots** bâtissent aussi **1 ou 2 ponts** par partie (après 4 minutes, près de leurs villes : ils mettent de l'or de côté pour ça). Il y a entre **3 et 12 fleuves** par partie, au hasard.
Quand deux fleuves se rejoignent, le fleuve **double de largeur** ; quand un troisième les rejoint, il devient
un **grand fleuve** (3 cases de large, plus sombre) **infranchissable**, comme la mer : un royaume des deux côtés
d'un grand fleuve est **coupé**. Sa rive sans ville ni port fortifié est désorganisée, et aucun soldat ne passe.
Certains fleuves forment aussi un **lac** en chemin.
**🛶 Traverser un fleuve** : pour prendre des terres libres de l'autre côté, fais un **clic droit** sur la rive d'en face
et choisis **🛶 Traverser le fleuve**. La traversée **ne coûte aucun soldat**, seulement du **temps**
(**10 s** pour la première case de fleuve, **6 s** pour la seconde d'un fleuve double), et tout le monde voit le radeau.
On ne peut lancer qu'**une traversée toutes les 10 s**.
À l'arrivée, tu prends une **tête de pont** sur l'autre rive (le fleuve, lui, reste neutre).
(Le grand fleuve, lui, ne se traverse pas.)
🛶 **Un territoire désorganisé de l'autre côté** (un royaume sans ville ni port fortifié, ou un morceau de royaume coupé
de ses villes), juste en face d'un fleuve qui borde ton royaume : clique dessus (deux fois, comme une attaque) et ton
armée **passe le fleuve à gué** (10 s pour la première case de fleuve, 6 s pour la suivante ; rien sur un pont), puis
l'attaque depuis l'autre rive.
Les royaumes rivaux savent aussi traverser les fleuves quand une rive libre les attend en face.

⛰️ **Chaînes de montagnes** : sur les cartes aléatoires, des chaînes serpentent à travers les terres, comme dans le vrai
monde : une suite de **sommets** enneigés de tailles et de formes différentes, serrés les uns contre les autres (avec parfois
un gros sommet, et des **contreforts** sur les côtés), bordés de montagnes et de collines. Ce sont de **vrais murs** : on ne
passe que par leurs **cols** (des passages de montagne entre deux sommets, tous les 20 à 30 cases environ), ou en les contournant. De quoi bâtir sa défense derrière une chaîne et se battre pour les cols !
(Réglages `MOUNTAIN_CHAINS`, `CHAIN_LENGTH`, `CHAIN_PASS_EVERY` et `CHAIN_PASS_WIDTH` dans `js/config.js`.)
🏔️ **Les sommets** (le cœur blanc et enneigé des plus hautes montagnes) sont **infranchissables**, comme la mer :
il faut les contourner.

🏜️ **Les déserts** (couleur sable) se prennent et se défendent **comme des plaines** (aucun bonus de défense),
mais **tout bâtiment posé dessus produit 20 % de moins** (moulins, casernes, ports). Sur les cartes aléatoires,
ce sont de grandes taches (environ 15 % des plaines et forêts) ; sur la carte **Monde**, ils sont à leur vraie place
(Sahara, Arabie, Gobi, Kalahari, désert australien…), avec une bande fertile le long des fleuves qui les traversent (le Nil).

**Contrôles** : ⛏️ dans la barre du haut, le **nombre de tes mines** (le détail par minerai au survol, et tes mines **clignotent sur la carte** pour les repérer), dès ta première · ⚔️ la **puissance de tes troupes** en % (100 % = des soldats ordinaires ; ta meilleure caserne, tes mines de fer et ta cité impériale la font monter) · 📜 le bouton **Règles**, en haut, met le jeu en pause et affiche les règles complètes (Échap ou « Reprendre la partie » pour revenir) · ⏩ le bouton de vitesse fait passer la partie à x1, x1,5, x2 ou x3 · 🎥 déplace la carte en la **glissant** à la souris, ou au clavier avec **ZQSD** (WASD sur un clavier anglais) ou les **flèches** · molette : zoom · en survolant un **autre royaume**, une barre fixe, juste sous ta barre d'infos en haut de l'écran, le résume (👥 soldats, nombre de châteaux, églises, ports, moulins, casernes et avant-postes, quel que soit leur niveau, ⛏️ ses mines avec le détail par minerai, et 🗺️ part des terres) · en survolant un bâtiment qu'on peut sélectionner (un des tiens à améliorer, une cible ennemie), il s'illumine (doré chez toi, rouge chez l'ennemi) · sur la carte, la souris est une petite **main médiévale** (gantelet), qui devient une **épée** sur une cible que tu peux vraiment attaquer (château, église, port, mine ou avant-poste ennemi atteignable, terres ennemies sans défense organisée, armée ennemie qui t'attaque) · en survolant une **armée ennemie** qui t'attaque, un **cercle de ciblage** rouge l'entoure (clic = envoyer tes défenseurs) · molette = zoom · glisser = déplacer la carte · `1` à `5` et `7` (ou `&` `é` `"` `'` `(` `è`) = choisir un bâtiment (puis clic pour le poser) · clic droit = menu d'actions (attaquer, construire, débarquer, traverser un fleuve) · `U` = ⬆️ **souris d'amélioration** (son curseur est une flèche dorée : chaque clic sur un de tes bâtiments l'améliore tout de suite, pour aller vite quand tu as beaucoup d'or ; un clic droit, `U` ou `Échap` pour l'arrêter) · en posant un bâtiment, une petite **bulle** près de la souris donne son **bonus de production** à cet endroit (« +30 % » en vert, « −20 % » en rouge : terrain et routes compris) · `Espace` ou `P` = pause (la musique d'ambiance s'arrête avec la partie et reprend au même endroit) · bouton **↩ Menu** (barre du haut) = quitter la partie et revenir au menu de départ, après confirmation (la partie se met en pause pendant que tu choisis) · `M` ou le bouton 🎵 (en bas à droite) = couper ou remettre la **musique d'ambiance** (des morceaux tirés au hasard, en fondu, avec toujours un silence de 20 s à 2 min entre deux ; à la victoire, un son de victoire à la place ; un son d'alerte quand tu perds une ville, un son de départ quand ton armée part à l'assaut d'un ennemi (et quand tes défenseurs partent intercepter un assaut, ou qu'un assaut part relier ta ville isolée), un son quand un de tes bâtiments est construit ou finit son amélioration, un autre quand une de tes mines de diamant verse son or, et d'autres quand tu prends une ville, lances une croisade, un assaut viking ou un recrutement de masse, et une alerte quand un ennemi lance un assaut sur toi ; les petits sons se superposent (un nouveau son ne coupe pas celui qui joue encore) ; dans le menu de départ, sa propre musique, coupée au début de la partie), avec une petite **barre de volume** à côté ; tes choix sont gardés pour les parties suivantes · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

- **v0.92.161** : 🎨 **plus aucun emoji dans le jeu** : 36 nouvelles icônes dessinées au style médiéval (l'almanach de l'année, la fleur de lys, le lion d'Angleterre, le chardon d'Écosse, l'hermine de Bretagne, la grappe de Bourgogne, la colombe de la trêve, la balance, la cloche, l'étoile des défis, les mains jointes du vœu…) ; la coche, la croix et l'étoile du cadre des objectifs sont dessinées aussi, et les infobulles n'ont plus d'emojis · 📜 parchemin : le bois des rouleaux sort du papier par un bord arrondi, dans une petite ombre (moins « collé par-dessus »)
- **v0.92.160** : ⭐ **les défis des campagnes** : chaque faction jouable de Charlemagne et de la guerre de Cent Ans a 4 défis, historiques, drôles ou très durs (prendre Paris avec les Lombards, raser 3 villes avec les Danois, venger 732 avec Cordoue, Braveheart à Londres avec l'Écosse, le vœu du héron pour le roi d'Angleterre…), avec une récompense chacun, affichés sous les objectifs · 🙏 **le vœu solennel** : au début, jure un de tes défis ; tenu, double récompense ; trahi, 1 000 pièces et 40 de Croyance (ou de Légitimité) perdues · les factions de Charlemagne sans objectifs ont maintenant leur cadre de défis
- **v0.92.159** : 🦁 guerre de Cent Ans : **la campagne du roi d'Angleterre**, avec ses propres parchemins (la même guerre vue de Londres) et des événements à elle : les débarquements de 1346 et 1415 sont de vraies armées, Neville's Cross et la rançon du roi d'Écosse, l'ordre de la Jarretière (rançons doublées), l'Étape de Calais, les rois d'Angleterre (Henri IV l'usurpateur…), et deux **parchemins à choix** : signer ou non la paix de Brétigny, et que faire de la révolte des paysans ; la rançon du roi Jean revient au roi d'Angleterre
- **v0.92.158** : 👑 Charlemagne : les **Slaves** ne razzient plus jamais les **lieux des objectifs** (le Ring des Avars, Pavie, Barcelone, Rome…), et aucun assaut viking ne peut les raser : la partie reste toujours gagnable · les Slaves visent **les Francs en premier**, d'autant plus souvent et plus fort que la partie est difficile
- **v0.92.157** : 🔥 les Vikings **rentrent au port 2 fois plus vite** qu'à l'aller (après leur raid, un échec ou un rappel)
- **v0.92.156** : 🗺️ scénarios (Charlemagne, guerre de Cent Ans) : les frontières de départ entre les factions (et avec les terres libres, comme chez les Slaves) **serpentent** naturellement au lieu de suivre de longues lignes droites (réglage `BORDER_WARP`)
- **v0.92.155** : 🏰 la jauge ronde d'un siège est toujours **jaune**, quelle que soit la couleur de l'assaillant : elle reste bien visible
- **v0.92.154** : ✝️ les terres des pillards (les **Slaves** de Charlemagne) ne se prennent plus non plus par la **Croyance**
- **v0.92.153** : 👑 Charlemagne : **tout le monde peut de nouveau attaquer Rome** ; si elle tombe, aux Lombards ou à n'importe qui, l'objectif « Rome » est perdu pour de bon (plus de couronne d'empereur) · repoussés, les **Lombards retentent leur chance** quand ils en ont les moyens (au plus toutes les 3 minutes)
- **v0.92.152** : 🔔 le son du départ à l'assaut se joue aussi quand tes **défenseurs partent intercepter** un assaut ennemi (il se jouait déjà pour un assaut qui part relier une ville isolée)
- **v0.92.151** : 🛶 un territoire **désorganisé** (sans ville, ou coupé de ses villes) juste de l'autre côté d'un fleuve qui borde ton royaume s'attaque en **passant le fleuve à gué** · 👑 Charlemagne : le **siège de Rome** dure 10, 6 ou 2 minutes selon la difficulté ; si les Lombards la prennent, l'objectif « Rome » est **perdu pour de bon** ; tant qu'elle est au pape, **personne d'autre ne peut la prendre** · 🏰 **Barcelone** devient une ville de niveau 2 à la garnison 4 fois plus forte tant que Cordoue la tient
- **v0.92.150** : 🚶 **traverser les terres d'un allié** : une cible qu'on ne peut pas atteindre depuis ses terres, mais qui touche celles d'un allié du pacte, s'attaque en passant par chez lui (sans perdre de soldats en route ; pacte rompu en chemin : l'armée rentre sans perte) · 🔔 les petits sons se superposent au lieu de se couper · 👑 Charlemagne : la Croyance prend les terres 2 fois moins vite (chacun commence avec beaucoup d'églises) · 🌐 en ligne, un joueur qui n'a pas écrit le nom de son royaume en reçoit un au hasard (et deux noms pareils deviennent « Valdor » et « Valdor II »)
- **v0.92.149** : 🌐 **le jeu en ligne, à plusieurs** (comme OpenFront) : la **partie publique** part toutes les 2 minutes avec tous ceux qui attendent (carte au hasard, des bots complètent) ; les **salons privés** se rejoignent avec un code, et leur hôte choisit les réglages, la pause et la vitesse (les autres : une pause de 15 s toutes les 5 min). Avec un **serveur de référence** sans dépendance (`node serveur/serveur.js`) et son protocole (`serveur/PROTOCOLE.md`). Pour ça, la partie est devenue « déterministe » (le même hasard et les mêmes calculs dans tous les navigateurs, `js/dmath.js`), et chaque action du joueur est un « ordre ». Au passage : en anglais, le nom de la carte choisie s'affiche enfin en anglais dans le menu
- **v0.92.148** : 📜 les rouleaux des parchemins, encore retouchés : de vrais pommeaux de bois tourné (un collier, un col, un bouton bombé et sa pointe, dessinés en SVG, plus de formes carrées) et des bouts de rouleau nets (sans les tours de la feuille)
- **v0.92.147** : 📜 de plus beaux rouleaux pour les parchemins d'événements : le parchemin enroulé, en volume, avec ses tours visibles aux deux bouts, sur une baguette de bois tourné qui dépasse de chaque côté (un collier et un pommeau)
- **v0.92.146** : ⚜️ nouveau scénario **La guerre de Cent Ans (1337-1453)** : la France, les îles Britanniques et le nord de l'Espagne, 12 factions, le récit du roi de France en parchemins (de l'Écluse à Castillon), et des mécaniques à lui : la Légitimité, les grands vassaux qui changent de camp, les trêves, la peste noire, les chevauchées et les Grandes Compagnies, les arcs longs et les canons, les rançons, le roi Jean captif, la folie de Charles VI, les ports de la Manche et Jeanne d'Arc ; jouable aussi en Angleterre, Bourgogne, Bretagne ou Écosse
- **v0.92.145** : 📜 Charlemagne : les parchemins ne disent plus exactement quoi faire ; ils racontent l'événement, et **tes conseillers murmurent** un conseil à mots couverts (« veille sur tes marches de l'Est »…), pour rester dans l'histoire
- **v0.92.144** : 🏰 le scénario **Gouffre de Helm** est retiré du jeu (la tour de garde, faite pour lui, reste prête mais pas encore disponible dans les parties)
- **v0.92.143** : 🛡️ correction : tes défenseurs qui interceptent une armée ne tournent plus autour quand ils arrivent près d'elle (ils recalculaient sans cesse un chemin par tes terres, que l'ennemi grignotait, et faisaient des détours) : à moins de 15 cases, ils foncent droit sur elle, et à 3 cases ils l'attaquent tout de suite
- **v0.92.142** : ⏸ quand la partie est en **pause**, la musique d'ambiance se met en pause aussi, et reprend au même endroit (sauf pendant la lecture d'un parchemin d'événement)
- **v0.92.141** : 🔔 4 nouveaux sons (de dr_brioche) : quand tu **prends une ville**, lances une **croisade**, un **assaut viking** ou un **recrutement de masse** (les renforts de la grande caserne)
- **v0.92.140** : ↩ un bouton **Menu** dans la barre du haut pour quitter la partie (avec confirmation : la partie se met en pause, « Non » la reprend) · 🔔 un **son de construction** (de dr_brioche) quand un de tes bâtiments est construit ou finit son amélioration ; l'ancien son d'amélioration se joue maintenant quand une de tes **mines de diamant** verse son or · 📱 sur un écran étroit (téléphone, petite fenêtre), la barre du haut passe sur 2 lignes au lieu de déborder : Pause, vitesse, Menu et Règles restent accessibles, et les objectifs, la musique et les messages se rangent juste en dessous
- **v0.92.139** : 🎵 le bouton de la musique et sa **barre de volume** sont aussi sur la page du menu (en bas à droite ; en haut à gauche sur un téléphone) : la barre règle la musique du menu tout de suite, et le premier clic sur 🎵 la lance (au lieu de la couper alors qu'on ne l'entendait pas encore)
- **v0.92.138** : 🏰 la musique du menu démarre aussi sur un téléphone ou une tablette (au premier toucher : avant, elle restait muette)
- **v0.92.137** : 🏰 une **musique pour le menu de départ** (de dr_brioche) : en boucle dans le menu (dès ton premier clic ou ta première touche : avant, le navigateur interdit le son), elle s'éteint en fondu au début de la partie ; la touche `M` la coupe aussi · 🔔 un nouveau petit son **coupe net** celui qui joue encore, pour enchaîner tout de suite
- **v0.92.136** : 🔔 une **alerte sonore** (de dr_brioche) quand un ennemi lance un assaut sur toi (ou un assaut viking, ou que des Vikings débarquent chez toi)
- **v0.92.135** : 🔔 un **son d'amélioration terminée** (de dr_brioche) quand un de tes bâtiments finit son amélioration (à la fin du chantier) · chaque petit son a son propre délai de 3 s : une amélioration n'empêche plus d'entendre une ville perdue juste après
- **v0.92.134** : 🔔 un **son de départ à l'assaut** (de dr_brioche) quand ton armée part à l'assaut d'un ennemi (assaut validé sur une cible, assaut viking, assaut de jonction) ; pas pour les terres libres ni les renforts
- **v0.92.133** : 🔔 un **son** (de dr_brioche) quand tu perds une ville (prise par un ennemi, ou rasée par des pillards ou des Vikings), par-dessus la musique
- **v0.92.132** : 🏆 un **son de victoire** (de dr_brioche) sur l'écran de victoire, à la place de la musique d'ambiance (qui reprend si tu continues la partie)
- **v0.92.131** : 🎵 un septième morceau d'ambiance, *M7* (de dr_brioche)
- **v0.92.130** : 🎵 un sixième morceau d'ambiance, *M6* (de dr_brioche)
- **v0.92.129** : 🎵 un cinquième morceau d'ambiance, *M5* (de dr_brioche)
- **v0.92.128** : 🎵 un quatrième morceau d'ambiance, *M4* (de dr_brioche)
- **v0.92.127** : 🎵 un troisième morceau d'ambiance, *M3* (de dr_brioche) · entre deux morceaux, toujours un moment de silence, d'une durée tirée au hasard (de 20 s à 2 min)
- **v0.92.126** : 🎵 un deuxième morceau d'ambiance, *M2* (de dr_brioche) : le jeu tire au hasard entre les deux, sans jouer deux fois de suite le même
- **v0.92.125** : 🎵 la musique est 2 fois moins forte au départ, et une petite **barre de volume** l'accompagne ; le bouton 🎵 passe en bas à droite de l'écran (en haut à droite sur un téléphone)
- **v0.92.124** : 🎵 **musique d'ambiance** : pendant la partie, des morceaux tirés au hasard (le premier : *M1*, de dr_brioche), en fondu, avec de temps en temps un moment de silence entre deux ; le bouton 🎵 de la barre du haut (ou la touche `M`) la coupe ou la remet
- **v0.92.123** : ✝️ dans le classement, à côté de la bible verte ou rouge, un petit chiffre donne l'écart de Croyance avec ce voisin (« +180 », « −420 ») · la conversion ralentit moins pour une avance mince : 1,2 fois plus de Croyance convertit 1,8 fois moins vite (au lieu de 3)
- **v0.92.122** : ✝️ la Croyance convertit moins vite quand l'avance est mince : pleine vitesse à partir de 2 fois plus de Croyance que le voisin, 2/3 avec 1,5 fois plus, 1/3 avec 1,2 fois plus (une vraie domination avance comme avant)
- **v0.92.121** : ⬆️ souris d'amélioration (touche **U**) : un clic droit l'arrête (un clic gauche à côté ne fait rien)
- **v0.92.120** : ⌨️ la **barre Espace** met la partie en pause (et la relance), comme la touche `P`
- **v0.92.119** : 📜 **Les grands événements sur parchemin** (Charlemagne) : un parchemin se déroule au milieu de l'écran, en écriture médiévale, met la partie en pause, raconte l'événement et dit ce qu'il faut faire (la mort de Pépin, la trahison d'Aquitaine, la mort de Carloman, la marche de Didier, la chute de Rome, l'Empire chrétien, les razzias slaves) · ⚔️ l'Aquitaine se révolte maintenant **entre la 1ʳᵉ et la 3ᵉ minute** (ses terres sont franques au départ) · 7 nouveaux événements historiques : 🗡️ **Roncevaux**, ⚔️ **Widukind**, 🤝 **Tassilon et les Avars**, 👑 **Irène**, 🐘 **l'éléphant du calife**, ✝️ **Léon III agressé**, 🔥 **les premiers Vikings** · 🏷️ **les noms des villes** historiques écrits en lettres médiévales courbées sous elles (Charlemagne, Gouffre de Helm, et les capitales d'Azeroth) · 🇬🇧 « the Danes' » au lieu de « the Danes's » dans les messages anglais
- **v0.92.118** : 📽️ **Résumé de la partie** : sur l'écran de fin, un bouton rejoue toute la partie en accéléré (la carte entière, juste les couleurs des royaumes, l'heure et les plus grands royaumes du moment) · 👑 Charlemagne, après des dizaines de parties testées en accéléré : 🏆 la victoire aux 70 % (et la victoire par anéantissement) ne bloque plus sur les Slaves : leurs terres imprenables ne comptent plus, et ils sont classés à part (⚔️) au lieu d'être 1ᵉʳˢ avec 28 % · ⚔️ les razzias plafonnent à 5 000 guerriers, et la première épargne la Bavière · 🛡️ la Bavière, l'Aquitaine et les Asturies, qui disparaissaient en quelques minutes, résistent (Ratisbonne et Bordeaux au niveau 3, garnisons +50 %, Cordoue moins acharnée sur les Asturies) · 🐛 un assaut dont la cible venait d'être rasée pouvait planter la partie · 💬 après une razzia réussie, plus de message « l'assaut a échoué »
- **v0.92.117** : 👑 Charlemagne : les **15 factions ont leurs vraies bannières** (monogramme KAROLUS des Francs et de Carloman, clés de saint Pierre du pape, aigle bicéphale de Byzance, guivre lombarde, cheval saxon, corbeau danois, triskèle breton, croix des Asturies…) et chaque royaume prend la couleur de son drapeau : Carloman en violet, les Lombards en vert, la Bavière en orange, les Saxons en noir… (Rome, les Francs et Carloman se distinguent enfin au premier coup d'œil)
- **v0.92.116** : 👑 Charlemagne : ⚔️ la **révolte d'Aquitaine** (Hunald II, Bordeaux) avec le **château isolé de Fronsac** · ⚔️ les **Slaves**, pillards du nord-est : terres imprenables, **razzias** de plus en plus grosses qui rasent leur cible · ✝️ succès **« Empire chrétien »** (terres franques reliées à Rome : +100 de Croyance pour toujours) · capitales au moins au niveau 2, Pavie et Vannes au niveau 3, Rouen et Wurtzbourg deviennent des églises · 🗺️ au bord des cartes Charlemagne et Europe, la terre finit sur des sommets (plus de ligne de mer que suivent les bateaux)
- **v0.92.115** : 📊 en posant un bâtiment, une petite bulle donne son bonus de production à l'endroit visé (« +30 % », « −20 % ») · ⬆️ touche **U** : la souris d'amélioration (un clic sur un de ses bâtiments l'améliore directement) · 🧹 plus d'icône à côté du choix de la langue, au menu
- **v0.92.114** : 🏰 nouveau scénario **Gouffre de Helm (3019)** : défendre Fort-le-Cor jusqu'à l'aube contre les vagues d'Isengard (petite carte du Gouffre, Digue, Mur, Fort-le-Cor, Cavernes Scintillantes), avec les Dunlendings, les wargs, le ponceau, le feu de Saroumane, le Cor de Helm, la nuit et l'orage, puis l'aube (Gandalf, Erkenbrand, les Huorns) ; des succès font venir les elfes de la Lórien et les nains d'Aglarond · 🗼 nouveau bâtiment, la **tour de garde** (5 niveaux, elle tire sur les armées ennemies proches ; prise, elle retombe au niveau 1)
- **v0.92.113** : 🗺️ carte **Europe** redessinée comme celle de Charlemagne : relief naturel (crêtes qui serpentent et se ramifient, vallées de collines, sommets en massifs, piémonts irréguliers), 28 massifs de collines en plus (dont, à l'est et au nord, le plateau central russe, la Podolie, le Valdaï, le Småland, la Laponie finlandaise, les Khibiny), forêts plus denses en Germanie
- **v0.92.112** : ⛏️ Charlemagne : 16 mines historiques sur toute la carte (une par faction, deux pour Cordoue, deux aux confins), avec leur nom au survol (argent de Melle, fer de Brescia, or du Pangée, argent du Harz, trésor des Avars, mercure d'Almadén…) · 👑 nouvel objectif : tenir 4, 6 ou 8 mines historiques selon la difficulté
- **v0.92.111** : 🗺️ carte Charlemagne redessinée : montagnes moins rectilignes (crêtes qui serpentent et se ramifient, largeur variable, vallées de collines, sommets enneigés en massifs), piémonts irréguliers, collines en taches éparses, 19 nouveaux massifs (Massif armoricain, Ardennes et Eifel, forêt de Bohême, Sierra Morena, monts de León, Péloponnèse…), forêts plus denses en Germanie
- **v0.92.110** : 👑 Charlemagne : un objectif rempli **se perd** si on perd la ville (ou le niveau, la Croyance, Rome) ; il faut tout tenir en même temps pour être couronné · objectif de Croyance relevé à 350, 700 ou 1 200 (le pacte avec Rome en donne déjà 150) · ⛏️ 3 mines historiques déjà creusées : l'argent de Melle (Francs), le fer d'Amberg (Bavière), l'or de Las Médulas (Asturies)
- **v0.92.109** : 👑 Charlemagne : un **cadre d'objectifs** en haut à gauche (8 objectifs historiques : Bavière, Pavie, Saxons et Irminsul, Ring des Avars, Marche d'Espagne, capitale impériale de niveau 3 à 4 et Croyance de 250 à 1 000 selon la difficulté, Rome), barrés en gris avec un ✔ une fois remplis ; les remplir tous fait couronner empereur
- **v0.92.108** : 👑 nouveau scénario **Charlemagne (768)** : l'Europe de l'Ouest et la Méditerranée, 13 factions historiques à leurs vraies places (Francs, Carloman, Lombards, Papauté, Byzance, Bavière, Saxons, Danois, Avars, Cordoue, Asturies, Bretons, Anglo-Saxons), Rome et Constantinople au niveau 4, mort de Carloman, marche des Lombards sur Rome (siège de 2 minutes), victoire « Couronné empereur » · 🎁 on n'envoie plus de soldats qu'à un allié dont les terres touchent les tiennes
- **v0.92.107** : 🎨 menu de départ dans le style du jeu : la liste des cartes devient un panneau rangé par sortes, avec des icônes dessinées (dés, carte, parchemin, plume), le bouton « Création de carte » a son pinceau, et la langue son globe crucigère (plus d'emojis)
- **v0.92.106** : 📜 une 3ᵉ sorte de cartes dans le menu, les **scénarios** : « Azeroth : les Factions » (camps et capitales imposés) y remplace le choix « Mode de jeu » ; dans les cartes prédéfinies, Azeroth se joue désormais en départ classique, comme Monde et Europe
- **v0.92.105** : ⚔️ le recrutement de masse favorise les petits royaumes : jusqu'à x5 pour un tout petit royaume (armée vide), x1,6 au plus pour le plus grand, selon l'armée maximum comparée à celle du plus grand royaume
- **v0.92.104** : 🖥️ dans une fenêtre étroite, la barre d'aide (en bas à gauche) ne recouvre plus le curseur « Envoyer » : elle se range sous la barre du bas, au centre
- **v0.92.103** : 🤝 fini le spam de demandes d'alliance : au plus une demande toutes les 20 s, et un royaume refusé ne redemande pas avant 2 minutes (ni à toi, ni à un autre membre de ton pacte, ce qui la renvoyait au fondateur) · 🐛 une demande d'alliance ne reste plus bloquée à l'écran : elle disparaît si son royaume tombe, à la fin de la partie ou au début d'une nouvelle
- **v0.92.102** : 🤝 si le fondateur d'un pacte le quitte (ou tombe), le plus grand royaume du pacte devient le fondateur et le pacte prend son nom
- **v0.92.101** : ⛺ un avant-poste en construction est vraiment affaibli : ses soldats, occupés à bâtir, n'ont plus le bonus du terrain (une montagne les rendait presque 3 fois plus forts) et ne se battent qu'à 60 %
- **v0.92.100** : 🔥 un seul assaut viking par minute au plus (réglage `VIKING_COOLDOWN`) ; le bouton Viking affiche le temps restant
- **v0.92.99** : 🔥 l'assaut viking devient un **raid** : il part forcément d'un port royal, et s'il l'emporte, la ville visée est **détruite** (avec ses moulins et casernes) au lieu d'être prise ; 💰 300 de butin par bâtiment détruit, puis les Vikings rentrent par bateau
- **v0.92.98** : ⚓ un port royal (niveau 3) bâti ou pris dans la zone d'un avant-poste la fait entrer dans ton royaume, comme un château (l'avant-poste disparaît) · 🔥 **assaut viking** (port royal, niveau 3, 💰 3000) : un assaut par la mer, sans avant-poste, sur une ville ennemie à 25 cases au plus d'une côte ; traversée sans pertes, soldats +50 % plus forts, flamme 🔥 au-dessus des bateaux et des assauts vikings ; les survivants d'un échec rentrent par bateau ; les bots l'utilisent aussi
- **v0.92.97** : ⛏️ la souris sur ⛏️ (barre du haut) fait clignoter tes mines sur la carte · ⛵ les bots n'envoient plus d'expéditions au hasard : ils débarquent avec un but (des terres libres au-delà de la mer quand il n'y en a plus à leur frontière, ou tout près d'une ville d'un ennemi plus faible), renforcent leur avant-poste par la mer, puis lancent une vraie campagne depuis lui
- **v0.92.96** : ⬆️ la fenêtre d'amélioration annonce ce que débloque le niveau 3 : « Débloque le recrutement de masse » (caserne → grande caserne) et « Débloque les croisades » (église → cathédrale)
- **v0.92.95** : 🌍 le jeu parle anglais ! Une liste « Langue » en haut à droite du menu de départ : 🇬🇧 English (par défaut) ou 🇫🇷 Français. Tous les textes sont traduits (menu, règles, messages, infobulles, noms des bâtiments, des terrains, des royaumes et des bannières, éditeur de cartes) · 🤝 mode Factions : clic droit chez un allié de ton camp → envoyer des soldats ou de l'or (le % de la jauge « Envoyer »), et route commerciale possible entre alliés du camp · 🛡️ l'aide des alliés contre un assaut rejoint maintenant ton armée (à toi de l'envoyer se battre) au lieu de se battre toute seule sur tes terres · 🏰 une ville (château) coûte 250 au départ, le grand port (niveau 2) 400 · 🐛 une capitale fondée près d'un fleuve n'est plus déclarée « coupée de tous ses châteaux » dès le départ (Hurlevent en mode Factions)
- **v0.92.94** : 🖌️ menu de départ : un vrai bouton « Création de carte » en bas à droite (en face des règles), à la place du petit lien
- **v0.92.93** : ⚔️ nouveau bonus de la grande caserne : le **recrutement de masse** (💰 3000, 60 s, jusqu'à x3 de recrutement quand l'armée est petite, de moins en moins au-delà de 35 % de l'armée maximum ; amplifié par la galvanisation, diminué par l'après-guerre) · 🧹 menu de départ allégé (plus d'explications entre parenthèses dans les choix) · ✝️ la croisade passe à 💰 2500
- **v0.92.92** : ⚔️ carte Azeroth : nouveau **mode « Factions »** : 3 camps éternels (l'Alliance, la Horde, le Pacte sauvage), chaque royaume à sa vraie capitale du jeu, la partie démarre en pause le temps de se repérer
- **v0.92.91** : ⛏️ la bulle du minerai passe à gauche de la mine (elle ne recouvre plus le chiffre de son niveau) · 🪙 mine d'or : 2 500 pièces en 10 minutes (au lieu de 5 000), et de nouveau 2 500 au niveau 2
- **v0.92.90** : 🪙 mine d'or : 5 000 pièces en 10 minutes (au lieu de 2 000 en 5), et de nouveau 5 000 en 10 minutes au niveau 2 · 💰 moulins et casernes : +35 % par bâtiment (au lieu de +25 %)
- **v0.92.89** : 💰 le prix des moulins et des casernes monte moins vite (+25 % par bâtiment au lieu de +50 %) · ⛏️ mines plus chères : 600 (au lieu de 400), puis 1 200 pour le niveau 2 (au lieu de 1 000)
- **v0.92.88** : 🚩 menu de départ : drapeaux un peu moins zoomés (cadre 25 % plus large : on voit le haut de la lance et le début des rubans)
- **v0.92.87** : 🚩 au menu de départ, les drapeaux sont recadrés sur leur tissu (sans la lance ni les rubans) : leur motif se voit bien ; icônes des drapeaux plus nettes
- **v0.92.86** : 🛡️ carte Azeroth : 15 écus des races et des groupes de WoW à la place des drapeaux (Humains, Orcs, Elfes de la nuit, Défias, La Main d'Argent…), et les royaumes rivaux portent leur nom
- **v0.92.85** : 🗺️ le nombre de royaumes rivaux est limité selon la taille de la carte (un pour 5 000 cases : 10 au plus sur la petite carte, 20 sur les autres) ; ton choix est retrouvé si tu repasses sur une carte plus grande
- **v0.92.84** : 🚩 3 nouveaux drapeaux : le Corbeau, les Chopes et le Péteur (21 en tout), et donc jusqu'à 20 royaumes rivaux (nouveaux noms : Bavière, Lombardie, Galles) ; couleurs voisines accentuées (rouge des épées plus profond, orange du marteau plus doré, vert des hallebardes plus doux)
- **v0.92.83** : ⚔️ contre un territoire désorganisé, une grosse armée ne perd plus de soldats par case qu'une petite (au-delà de 500 soldats, chaque case coûte autant) : elle va juste plus vite, et prend bien plus de terres
- **v0.92.82** : 🏝️ un royaume ne peut plus se cacher sur un îlot où personne ne peut débarquer : ses terres y disparaissent (et s'il n'avait plus que ça, il est anéanti)
- **v0.92.81** : 💎 la mine de diamant rapporte 1 000, 2 000 puis 3 000 pièces aux trois premiers quarts de l'extraction, et toujours 10 000 à la fin (16 000 en tout, au lieu de 13 000)
- **v0.92.80** : 🚩 drapeaux 20 % plus grands en jeu (carte, classement, messages, barre du haut), et 2 fois plus grands dans le menu de départ : le drapeau choisi en grand, un clic ouvre la liste déroulante de tous les drapeaux
- **v0.92.79** : 🤖 jusqu'à **17 royaumes rivaux** (un par drapeau disponible), avec 6 nouveaux noms (Bohême, Navarre, Savoie, Hongrie, Pologne, Danemark) · 🏆 le classement montre toujours ton royaume, à son vrai rang, même hors des 10 premiers
- **v0.92.78** : 🚩 18 nouveaux drapeaux pour les royaumes (épées, masse d'armes, soleil, marteau, canards, aigle, hallebardes, dragon, chêne, lion, château, fleurs de lys, croissant, poing, poissons, hache, main couronnée, croix) ; la couleur de chaque royaume suit le fond de son drapeau, accentuée pour que deux royaumes ne se ressemblent pas
- **v0.92.77** : 🐉 carte Azeroth : le nord des Royaumes de l'Est retrouve ses prairies (Tirisfal, les Maleterres, Hautebrande, l'Arathi) entre les forêts des Pins-Argentés et des Hinterlands, et ses lacs (Lordamere, Darrowmere, le lac de Tirisfal, les lacs et la rivière des Hinterlands)
- **v0.92.76** : ❄️ carte Azeroth : de la **neige** (blanc bleuté, comme une colline : seulement sur cette carte) au Norfendre, au Berceau-de-l'Hiver, à Dun Morogh et en Alterac · 🌊 lacs et rivières relevés sur les cartes du jeu (le Norfendre surtout), et 3 fleuves retracés en plus (l'Orneval, Féralas, Elwynn)
- **v0.92.75** : 🐉 carte **Azeroth** redessinée d'après les vraies cartes du jeu de chaque continent (Kalimdor, les Royaumes de l'Est, le Norfendre) : côtes, lacs, et terrain de chaque région (forêts, prairies, déserts, roche, neige) bien plus fidèles
- **v0.92.74** : 🏰 nouvelle image pour la ville de niveau 2 (le château) : un fort de pierre et de bois, avec ses tours et sa grande maison au centre
- **v0.92.73** : 🏘️ superposition des bâtiments : ceux plus bas sur la carte passent devant ceux du dessus (une caserne juste au-dessus d'une ville est cachée en partie par elle) ; garnisons et chantiers restent affichés par-dessus
- **v0.92.72** : 🛤️ bonus des moulins et casernes au bord du chemin d'une église ou d'un port vers une ville : emplacements dorés pendant la pose, bonus affiché au survol, et il s'obtient jusqu'à 3 cases du chemin (au lieu de 2)
- **v0.92.71** : 🏰 dans la muraille de leurs propres villes, les troupes en marche (assauts, défenseurs, retours) ne sont plus ralenties par le terrain
- **v0.92.70** : 🌾 moulins 20 % plus productifs (1,8 💰 toutes les 10 s, 4,2 pour un grand moulin, au lieu de 1,5 et 3,5) · ⚓ ports 2 fois plus productifs environ (3, 8 et 16 💰 toutes les 10 s selon le niveau, au lieu de 1,5, 4,5 et 10)
- **v0.92.69** : 🔢 de loin, le niveau des bâtiments (II, III, IV) reste affiché à côté de leur icône, même bien dézoomé
- **v0.92.68** : ⛏️ le nombre de mines dans ta barre d'infos (détail au survol), et dans la barre de résumé des autres royaumes (avec le détail par minerai : ⛏️ 3 (⚒️ 2 🪙 1))
- **v0.92.67** : ⏸️ le siège d'une ville se met en pause tant que ses défenseurs se battent contre l'assaillant · 🌊 un fleuve au milieu des terres ennemies ne rend plus une ville inaccessible : l'armée le passe à gué (lentement) en plein assaut · ✝️ la Croyance ne prend plus les moulins et les casernes : ils suivent l'église, le port ou la ville dont ils occupent la place (une église convertie les emmène avec elle)
- **v0.92.66** : 🐛 une église (ou un port) prise sans son moulin ne laissait plus voir ce moulin dans ses places : son nouveau maître pouvait en bâtir un 2e à côté (d'où des églises niveau 1 avec 2 moulins) ; le moulin occupe maintenant toujours sa place
- **v0.92.65** : 🐛 une route d'assaut ne peut plus être coupée en route (par exemple quand la Croyance convertit la case d'où elle part) : l'assaut n'est plus annulé · 🪙 mine d'or : 2 000 pièces en 5 minutes (et de nouveau 2 000 au niveau 2) · ⛏️ la bulle d'une mine n'affiche plus que l'icône de son minerai, par-dessus les bâtiments · 🏠 au survol : les places d'une église ou d'un port, et la place qu'occupe un moulin ou une caserne
- **v0.92.64** : 🪙 le filon d'une mine d'or dure 5 minutes (au lieu de 3), et le niveau 2 le relance pour 5 minutes de plus
- **v0.92.63** : ⛏️ les autres bâtiments laissent 2 cases libres autour d'un filon · pendant la pose d'une mine, les filons passent par-dessus les bâtiments (une grande ville ne les cache plus) et la mine s'aimante à 5 cases au lieu de 3
- **v0.92.62** : ⚔️ la barre du haut affiche la puissance de tes troupes en % (caserne, mines de fer, cité impériale)
- **v0.92.61** : ✝️ la Croyance convertit les terres voisines 25 % plus vite
- **v0.92.60** : 🎚️ Difficile : les bots ont un petit avantage (+25 % d'or, recrutement 20 % plus rapide, soldats 10 % plus forts)
- **v0.92.59** : 🎯 on peut viser directement les mines ennemies pour les attaquer (comme une église ou un port) ; dans la zone d'une ville ou d'une église prise, elles partent avec elle
- **v0.92.58** : ⛏️ une petite bulle à côté de chaque mine (la tienne comme celles des autres) montre ce qui y est miné et où elle en est (Fer +8 %, Or 2:14, Pierre −10 %, Diamant 62 %, épuisée)
- **v0.92.57** : ⏩ bouton de vitesse en jeu (x1, x1,5, x2, x3), à côté de Pause ; le choix « Partie accélérée » du menu de départ disparaît · 🎮 pause et vitesse réservées à celui qui héberge la partie (pour une future partie à plusieurs)
- **v0.92.56** : 📜 bouton **Règles** en jeu (en haut) : le jeu se met en pause et affiche les règles complètes ; les règles expliquent maintenant chaque bâtiment point par point · 💬 survol d'un moulin, d'une caserne, d'une église, d'un port ou d'une mine : juste un résumé (son niveau et ce qu'il rapporte vraiment)
- **v0.92.55** : ⛏️ nouvelle icône de la mine : une vraie pioche, d'une seule couleur comme les autres icônes
- **v0.92.54** : 💬 survol d'un château (le tien comme celui des autres) : la barre d'aide en bas à gauche ne montre plus que son nom et sa défense globale
- **v0.92.53** : ⛏️ nouveau bâtiment, la **mine** (touche 7) : sur des filons posés au hasard dans les montagnes (ou les collines pour la pierre), 4 sortes : ⚒️ fer (troupes plus fortes, 3 au plus), 🪙 or (beaucoup d'or, mais le filon s'épuise en 3 minutes ; le niveau 2 le relance), 🪨 pierre (améliorations, murs et ponts moins chers, 3 au plus) et 💎 diamant (20 minutes d'extraction : 1 000 pièces à chaque quart et 10 000 à la fin, puis épuisé pour tous) ; 2 niveaux, x2 si une route la relie à une ville ; les bots en bâtissent aussi
- **v0.92.52** : 🏰 grands bâtiments agrandis sur la carte : ports niveaux 2 et 3, casernes niveaux 2 et 3, villes niveaux 2, 3 et 4
- **v0.92.51** : 🏰 bâtiments plus grands sur la carte (+15 %), cathédrale nettement plus grande et moulins un peu plus petits ; de loin, l'icône d'un bâtiment grandit avec son niveau
- **v0.92.50** : 🎨 images des bâtiments retouchées : plus de taches blanches (trous du fond entre les poutres, les ailes et les arcs-boutants, liseré blanc sur les bords, halo et ombre du fortin et du fort), et tailles harmonisées (chaque niveau un peu plus grand que le précédent, les villes nettement au-dessus du reste)
- **v0.92.49** : 🏰 nouvelles images pour les 4 niveaux de la ville : le petit fortin de bois, le fort de pierre et de bois, le château fortifié (entouré de douves) et la grande citadelle impériale (sa cathédrale et ses tours, qui a enfin sa propre image)
- **v0.92.48** : ⛪ nouvelles images pour les 3 niveaux de l'église : la petite église en bois, l'église de pierre et la grande cathédrale (avec sa flèche)
- **v0.92.47** : 🎨 nouvelles images : l'avant-poste (un camp de tentes dans une palissade ronde, avec tour de guet et feu de camp), les 2 niveaux du moulin (moulin à vent de bois, puis de pierre avec ses annexes) et les 3 niveaux du port (petit port de pêcheur, port de commerce de pierre, grand port de commerce médiéval avec son phare et son fort)
- **v0.92.46** : ⚔️ nouvelles images pour les 3 niveaux de la caserne : la petite caserne de bois (palissade et toits de chaume), la caserne de pierre et de bois (colombages, enceinte de pierre) et la grande bâtisse de la guilde des guerriers (tours, remparts et cour d'entraînement)
- **v0.92.45** : 🐉 carte **Azeroth** refaite : 700 x 550, telle qu'au temps du Norfendre (Kalimdor, les Royaumes de l'Est et le Norfendre, sans les îles venues après), aux côtes bien plus détaillées
- **v0.92.44** : 🐉 nouvelle carte prédéfinie **Azeroth** (600 x 600) : Kalimdor, les Royaumes de l'Est, le Norfendre, la Pandarie, les Îles Brisées, Kul Tiras, Zandalar et les Îles aux Dragons, avec leurs montagnes, déserts, lacs et fleuves
- **v0.92.43** : 🌊 côtes et lacs plus naturels : les criques, les baies, les golfes et les lacs ne sont plus faits de ronds réguliers, leurs bords sont déformés et découpés (anses, pointes, formes allongées)
- **v0.92.42** : 🧵 les nuages brodés du cadre sont entourés d'une bordure de fil d'or (un cordon torsadé) : une séparation assumée avec les dessins de la tapisserie
- **v0.92.41** : 🧵 cadre brodé : là où il est rallongé, des nuages brodés dans le style de la tapisserie remplissent ses colonnes (au lieu de copies en miroir des dessins), en teintes sombres et discrètes
- **v0.92.40** : 🧵 un cadre brodé (une tapisserie médiévale) entoure la carte, par-dessus le décor marin ; il s'adapte à toutes les formes de carte
- **v0.92.39** : 🏝️ carte « Normale » : 1 à 3 vraies îles moyennes habitables au large, moins d'îlots volcaniques, des criques et des baies sur la côte, et souvent un ou deux grands golfes qui coupent presque le continent en morceaux
- **v0.92.38** : ⛰️ chaînes de montagnes plus naturelles : une suite de sommets de tailles et de formes différentes, avec des contreforts sur les côtés et des cols entre deux sommets (fini le trait de pinceau)
- **v0.92.37** : 🐛 les routes (routes commerciales, chemins des ports et des églises) qui devaient faire un détour avec un virage échouaient : une route commerciale ne passait pas sur un pont · 🌉 un pont peut relier ton territoire à celui d'un allié de ton pacte · 🌊 on peut viser une ville (église, port…) de l'autre côté d'un fleuve, même sans autre frontière : l'armée le passe à gué, lentement · 🐛 un assaut ne fait plus tout le tour d'un royaume : son point d'entrée suit le vrai trajet depuis sa ville de départ · 🛒 routes commerciales en grandes voies pavées médiévales (fini la « route nationale ») ; si on ne peut pas en bâtir une, la bulle dit ce qui bloque
- **v0.92.36** : ⛰️ chaînes de montagnes : de longues crêtes de sommets infranchissables, avec des cols pour passer, de vrais murs qui rendent la carte plus stratégique (moins de sommets isolés en tas)
- **v0.92.35** : ✝️ la Croyance ne détruit plus les zones de muraille des villes, et elle avance en courbes vers les églises et les ports voisins · 📜 vue parchemin : villes dessinées à l'encre, seules les cathédrales et les grandes casernes en plus · 🤝 frontières de pacte en pointillés or + couleur du fondateur, plus fines dézoomé ; seul le fondateur accepte les nouveaux membres ; 💰 envoyer de l'or à un allié · ⚓ port : revenu de base d'un moulin, +15 % par moulin relié à ses villes ; port fortifié assiégé 10 s à sa muraille · 💰 l'or ne s'arrondit plus vers le haut · 💸 églises et ports 2 fois plus chers à chaque construction · ⛵ 2 assauts maritimes au plus contre un même royaume · 🎯 clic sur un nom du classement : la caméra va sur ce royaume · 👑 icône des troupes avec une couronne pour la cité impériale · ⏳ sièges : jauge ronde autour de la cible · ⛰️ églises +30 % en hauteur, -20 % en forêt ; casernes +40 % sur colline boisée · 🏰 placement de la capitale : la défense de la zone dans la barre d'info · 🏳️ drapeau blanc sur les terres désorganisées · 🏠 bâtiments 30 % plus grands sur la carte
- **v0.92.34** : 🛒 une route commerciale ne passe que sur les territoires des deux royaumes qu'elle relie ; si une case de son passage est prise, le commerce s'arrête jusqu'à ce qu'elle soit reprise
- **v0.92.33** : 🛒 routes commerciales selon le niveau de la ville : 1 pour un château, 2 pour une citadelle, 3 pour la cité impériale
- **v0.92.32** : 👑 **cité impériale** : un 4e niveau de ville (une seule par partie, 15 000 d'or, un bâtiment de chaque type au niveau maximum) : murs immenses (+600 %), garnison de 300, 3e mur, routes internes +100 %, troupes +25 %, routes commerciales +50 %, routes de pierre vers ses ports et églises (bonus x2)
- **v0.92.31** : 💬 fenêtres des bâtiments plus simples : les avantages en liste courte (« – Garnison +200 % », « – Places : 6 → 9 »…) ; aides du mur et de la route commerciale raccourcies
- **v0.92.30** : 🛒 jusqu'à 3 routes commerciales par ville (vers des villes alliées différentes) ; le bouton affiche combien elle en a
- **v0.92.29** : 🛒 deux villes ne se relient qu'une fois par une route commerciale (même si c'est ton allié qui l'a ouverte) · nouvelle icône : une charrette de marchand bâchée
- **v0.92.28** : 🛒 une route commerciale n'est plus perdue quand le pacte est rompu : elle s'arrête (pâle) et reprend dès que les royaumes qui tiennent ses deux villes sont de nouveau alliés (même d'autres royaumes) · 🛤️ les routes ne passent plus sur les sommets infranchissables
- **v0.92.27** : 🛒 routes commerciales : relie une de tes villes (niveau 2+) à celle d'un allié de ton pacte par une route grise ; elle coûte de 1 000 à 5 000 d'or selon sa longueur et rapporte d'autant plus d'or qu'elle est longue (la moitié aussi pour ton allié)
- **v0.92.26** : 🐛 un assaut vers un objectif ne s'annule plus tout seul en chemin (par exemple en longeant la mer, quand des terres changent de mains autour de lui) : il reprend sa route ; et s'il ne peut vraiment plus avancer, un message explique pourquoi il rentre
- **v0.92.25** : 🛤️ les routes et chemins ne passent plus sur la mer, les lacs ou les fleuves (sauf sur un pont) : ils font un détour par la terre, ou ne se créent pas si le détour est trop long
- **v0.92.24** : 🌉 le pont a sa propre icône médiévale (arche de pierre au-dessus de l'eau) au lieu de l'emoji
- **v0.92.23** : 🎨 bords entre terrains adoucis : coins coupés en biais au lieu des petits carrés pointus, et les lignes entre terrains suivent ce nouveau bord
- **v0.92.22** : 🖊️ les lignes entre les terrains suivent exactement les carrés de la carte (plus de ligne qui coupe un carré), aussi dans les royaumes
- **v0.92.21** : 🖊️ une fine ligne discrète délimite de nouveau chaque zone de terrain (en zoomant), en suivant les bords en gros pixels
- **v0.92.20** : 🌋 îlots volcaniques : plus de petits îlots inutiles (terres de moins de 150 cases retirées), des îlots plus grands avec un sommet enneigé au milieu, et chaque petite île devient un volcan sorti de la mer
- **v0.92.19** : 📜 vue parchemin : collines adoucies (fini l'effet « papier froissé »), seules les montagnes restent bien marquées
- **v0.92.18** : 🌊 décor autour de la carte : une vieille carte marine dessinée remplace le fond bleu uni, la carte est encadrée dessus, et la vue ne va jamais plus loin que le décor
- **v0.92.17** : 🎨 bords entre terrains deux fois moins granuleux (moins de petits grains d'un terrain mêlés aux autres)
- **v0.92.16** : ⛰️ collines adoucies : de grandes ondulations douces au lieu de petites pointes
- **v0.92.15** : ⛰️ collines bien plus étendues sur les cartes aléatoires (environ un tiers des terres, collines boisées comprises), un peu moins de plaines et de forêts
- **v0.92.14** : 🌳⛰️ nouveau terrain : la **colline boisée** (forêt sur colline, bonus cumulés : +180 %), vert olive bosselé avec des sapins · ⛰️ collines plus étendues et en bosses douces (moins tranchées que les montagnes)
- **v0.92.13** : ⛰️ montagnes un peu moins abruptes (pentes plus douces et plus de nuances entre les versants)
- **v0.92.12** : ⛰️ montagnes plus abruptes : versants plats aux tons tranchés et arêtes nettes, au lieu de bosses
- **v0.92.11** : 🏷️ le nom de chaque royaume reste toujours dans son territoire, là où il a le plus de place : plus de noms qui se chevauchent ; celui d'un royaume petit ou très fin n'apparaît qu'en zoomant
- **v0.92.10** : ⛰️ montagnes ombrées en nuances de ton par case (un versant éclairé, un versant sombre, plus haut au cœur du massif), sans effet de bruit
- **v0.92.9** : 🌾 plaines, forêts et déserts : de douces ondulations au lieu d'un relief qui ressemblait à des montagnes (surtout sur le parchemin, où ils restent presque plats)
- **v0.92.8** : 🌲 cartes aléatoires plus médiévales : environ 40 % de forêts, moins de montagnes et de plaines · 🎨 bords entre terrains en plus gros pixels (moins de bruit) · ⛰️ l'ombrage des montagnes ne déborde plus sur les plaines · 📜 la vue parchemin arrive dès qu'on dézoome presque au maximum · 🏷️ noms des royaumes en oblique, dans le sens du royaume, un peu courbés, en lettres anciennes espacées
- **v0.92.7** : 📜 vue parchemin : au dernier cran de dézoom, la carte devient une vieille carte sur parchemin encadrée (terres beiges ombrées, côtes à l'encre, mer gris-vert, royaumes en couleurs légères)
- **v0.92.6** : 🎨 carte en pixel art : pixels carrés (plus d'arrondis), terrains qui s'entremêlent sur leurs bords, petites bosses ombrées sur toutes les terres, grandes nuances dans la mer ; les bordures dessinées autour des terrains sont retirées (réglage `TERRAIN_BORDERS` pour les remettre)
- **v0.92.5** : ⛰️ montagnes aux arêtes et pics rocheux (fini l'effet « gâteau » à étages arrondis) · 🟫 un léger grain de cases revient sur le sol (moins lisse)
- **v0.92.4** : 🏔️ les ombres suivent les formes de la carte : bord éclairé côté soleil et ombre portée au pied des collines, montagnes, sommets, forêts et côtes
- **v0.92.3** : 🏔️ ombrage du relief (soleil en haut à gauche : les montagnes et les sommets ressortent, aussi sous les royaumes), petites bosses du terrain, et la mer fonce au large
- **v0.92.2** : 🎨 carte bien moins « pixel » : coins arrondis deux fois (4 x 4 pixels par case), sol sans damier, et image lissée de loin ; les bordures des terrains suivent ces nouvelles courbes
- **v0.92.1** : ⛰️ les courbes de niveau suivent toutes le bord des cases (pied des collines, pied des montagnes, tour des sommets enneigés) : fini les lignes qui coupaient les cases en biais
- **v0.92** : 🖌️ **éditeur de cartes** (lien « Dessiner une carte » dans le menu) : peins mer, plaines, forêts, collines, montagnes, sommets, déserts et fleuves au pinceau ou à l'outil remplir ; une carte enregistrée apparaît tout de suite dans la liste des cartes du jeu (✏️ Cartes dessinées), et on peut l'exporter dans un fichier
- **v0.91.25** : 🗺️ la courbe de niveau du pied des collines suit le bord des cases (comme la bordure des forêts) ; plaines et déserts ont aussi leur fine bordure
- **v0.91.24** : 🎨 carte moins « pixel » : les coins en escalier sont légèrement adoucis (dessin 2 fois plus fin, sans flou) · 🌉 les bots bâtissent 1 ou 2 ponts par partie
- **v0.91.23** : 🌲 forêts plus lisibles : un contour vert foncé autour d'elles et de petits sapins transparents en zoomant · 🔀 le second mur d'une citadelle peut partir d'un point du premier mur déjà bâti (clique d'abord sur ce point)
- **v0.91.22** : 🌉 **ponts** : clic droit sur un fleuve dont les deux rives sont à toi → Construire un pont (💰 700), et tes soldats le passent sans perdre de temps à gué · 🖱️ le clic droit ne propose plus de construire des bâtiments (la barre du bas et les touches 1 à 5 suffisent)
- **v0.91.21** : ⛰️ de fines courbes de niveau autour des collines et des montagnes (visibles en zoomant) · 📖 précision : un grand fleuve (infranchissable) coupe le royaume
- **v0.91.20** : 🐛 les défenseurs ne traversent plus les fleuves tout droit comme par magie : ils suivent le vrai chemin et passent à gué (5 s par case de fleuve) ; pareil pour les armées qui marchent vers la frontière et les soldats qui rentrent
- **v0.91.19** : 👀 pendant la pose d'un bâtiment (ou l'amélioration d'une ville), ses futures routes s'affichent en transparence ; trop loin d'une ville, un trait rouge indique la distance et la portée
- **v0.91.18** : 🐛 un avant-poste ne tombe plus avec ses soldats sans combattre : les renforts arrivés par la mer pendant l'assaut se battent aussi, ses soldats stationnés le défendent d'office au siège, et avec deux assauts en même temps la garnison défend contre celui qui est au pied des murs (vaut aussi pour les ports et les villes)
- **v0.91.17** : 📏 une ville améliorée relie plus loin : +20 % de portée de ses routes par niveau (route d'un port : 30, 36 puis 42 cases ; chemin d'une église : 25, 30 puis 35 cases)
- **v0.91.16** : 🐛 après avoir touché au curseur « Envoyer », les flèches et ZQSD déplacent de nouveau la caméra tout de suite (plus besoin de recliquer sur la carte), et les touches 1 à 5 marchent aussi
- **v0.91.15** : 🏆 la victoire arrive plus tôt : il suffit de posséder 70 % des terres (au lieu de 85 %)
- **v0.91.14** : ✝️ un bouton « Croisade » apparaît dans la barre des constructions dès ta première cathédrale, pour lancer une croisade sans aller cliquer sur l'église · 📱 boutons de la barre un peu plus étroits sur téléphone
- **v0.91.13** : 🎯 contre un royaume désorganisé, on peut toujours viser ses églises et ses ports (pour prendre leur zone d'un coup) ou l'attaquer de front en cliquant ailleurs ; avec une citadelle, les deux à la fois · 🤖 les bots font pareil
- **v0.91.12** : 🛡️ une seule armée de défense par assaut : recliquer sur « Défendre » la renforce (les soldats la rejoignent en 3 s, en route ou au combat) au lieu de créer une nouvelle armée ; plus d'attente de 5 s entre deux envois
- **v0.91.11** : 🐛 un débarquement ne peut plus se poser dans la muraille d'une ville ou d'un port fortifié (ni sur un mur) : il fallait l'assiéger, pas y planter un avant-poste
- **v0.91.10** : ✝️ un royaume désorganisé (sans ville ni port fortifié) se fait convertir 2 fois plus vite par la Croyance de ses voisins
- **v0.91.9** : ⚓ un royaume qui perd tous ses ports perd aussi tous ses avant-postes : ils sont supprimés de la carte avec leurs soldats, et leurs zones redeviennent libres
- **v0.91.8** : ⛺ un royaume qui n'a plus que des avant-postes est perdu : il est anéanti, ses avant-postes sont supprimés et leurs zones redeviennent libres
- **v0.91.7** : ✂️ un royaume coupé en deux sur un même continent garde ses deux morceaux comme des cœurs à part entière si le plus petit est tenu par une ville (ou un port fortifié) et fait au moins 25 % du plus grand : ses villes ne sont plus isolées, ses armées en partent ; seuls les petits morceaux restent coupés
- **v0.91.6** : ⚡ assauts (marche, combat, renforts) et défenseurs 15 % plus rapides
- **v0.91.5** : ⚡ un territoire désorganisé se prend 30 % plus vite
- **v0.91.4** : 🐎 une grosse armée est moins ralentie par sa taille (assauts, marches et défenseurs) : 1000 soldats avancent 50 % plus vite qu'avant, 3000 soldats 75 % plus vite (le ralentissement est deux fois plus faible)
- **v0.91.3** : ⛺ détruire un avant-poste ennemi reprend d'un coup toute la zone qu'il avait prise (si elle n'est pas reliée à son royaume ni tenue par une ville ou un port fortifié)
- **v0.91.2** : 🎥 la caméra se déplace aussi au clavier, avec ZQSD (WASD sur un clavier anglais) ou les flèches
- **v0.91.1** : 🌾 l'expansion en terre libre (la première phase de la partie) va 30 % plus vite : les armées avancent 30 % plus vite et chaque case libre coûte 30 % de soldats en moins
- **v0.91** : ✝️ la conversion monte jusqu'à 5000 d'écart de Croyance (au lieu de 1000), avec une accélération de plus en plus faible : 5 cases par seconde à 1000, 7 à 2000, 8,5 à 3000, 10 à 5000 (le maximum) ; plusieurs croisades en même temps servent donc encore
- **v0.90.9** : 🐛 les soldats en campagne (assauts, renforts en route, défenseurs, retours) comptent dans l'armée maximum : un royaume ne recrute plus au-delà de son maximum pendant que son armée est au loin (un assaut ne peut plus grossir sans fin) ; ta jauge l'affiche (« dont ⚔ … en campagne »)
- **v0.90.8** : ⏳ tous les bâtiments s'améliorent au même rythme que les villes : 40 s pour passer au niveau 2, 60 s pour le niveau 3 (au lieu de 5 s et 10 s pour les autres)
- **v0.90.7** : ⚓ un port fortifié (niveau 3) sert aussi de point de départ pour les armées (assauts et défenseurs), et de point de retour, comme une ville
- **v0.90.6** : 🧱 deux villes qui bâtissent chacune un mur vers l'autre, et dont les murs se rejoignent, sont reliées aussi : +50 soldats de garnison pour chacune
- **v0.90.5** : ⛰️ les assauts contre un royaume avancent un peu plus vite dans le relief : forêt +10 %, colline +16 %, montagne +19 % de vitesse (le relief ralentit 25 % moins qu'avant ; l'expansion en terre libre ne change pas)
- **v0.90.4** : 🧭 assauts, défenseurs et soldats qui rentrent partent de (ou rentrent à) la ville d'où le trajet à pied est le plus rapide, en comptant les fleuves, le relief et les détours, et plus la ville la plus proche à vol d'oiseau
- **v0.90.3** : 💰 le port royal (niveau 3) coûte 2000 (au lieu de 1200)
- **v0.90.2** : 💰 la grande caserne (niveau 3) coûte 2500 (au lieu de 1600), mais agrandit bien plus l'armée maximum : +350 soldats (au lieu de +200)
- **v0.90.1** : 🛤️ une église a un chemin vers chaque ville proche (et vers la route d'un port), 3 au plus : une nouvelle ville bâtie près d'elle ajoute un chemin au lieu de remplacer l'ancien ; chaque chemin rapporte +2 💰 et +50 % de Croyance
- **v0.90** : ⏩ partie accélérée : au menu, « Vitesse de la partie : Accélérée » fait tout aller 2 fois plus vite (le jeu fait 2 tours au lieu d'un) ; le chrono affiche « (x2) »
- **v0.89.1** : ✝️ la conversion continue d'accélérer au-delà de 200 d'écart de Croyance : 2 cases par seconde à 500, 5 par seconde à 1000 (le maximum)
- **v0.89** : ✝️ croisade religieuse : une cathédrale (église de niveau 3) peut en lancer une pour 2000 pièces, et la Croyance du royaume monte de 1000 pendant 60 s ; les bots en lancent aussi quand un voisin les dépasse en Croyance
- **v0.88.2** : 🏰🧱🏰 un mur peut relier deux de tes villes (vise l'autre ville : le mur va jusqu'à sa muraille) ; une fois debout, chacune gagne +50 soldats de garnison · 🤖 les bots relient aussi leurs villes · ⚡ un territoire désorganisé se prend 25 % plus vite
- **v0.88.1** : ⚔️ l'icône des troupes montre le niveau des casernes de chaque royaume : deux épées médiévales croisées (sans caserne ou niveau 1), avec un casque (niveau 2), puis avec un bouclier (niveau 3), sur la carte, les armées, la fiche des royaumes et ta jauge
- **v0.88** : 🏰 une ville a un nombre de places pour ses moulins et casernes : 4 au niveau 1, 6 au niveau 2, 9 au niveau 3 (« places prises » en la survolant) · ⛵ avant-poste : nouvelles icônes, un petit bateau avec une flèche vers la gauche pour envoyer des renforts, vers la droite pour rapatrier
- **v0.87.7** : ⚡ les assauts vont 15 % plus vite (en terre ennemie, dans leur marche jusqu'à la frontière et pour leurs renforts) et les défenseurs 15 % moins vite : ils ne vont plus que 18 % plus vite qu'un assaut de même taille (au lieu de 60 %)
- **v0.87.6** : 🛤️ un moulin, une caserne ou un port relié à plusieurs villes a une route vers chacune, et les bonus s'additionnent (double avec 2 villes, triple avec 3, jamais plus), que les villes soient bâties avant ou après lui
- **v0.87.5** : 🌾 un moulin ou une caserne bâti hors des villes, sur une route (celle d'un port ou le chemin d'une église) ou juste à côté, produit +20 %
- **v0.87.4** : ⚓ ports plus rentables : le grand port rapporte 50 % d'or de plus qu'avant (9 au lieu de 6) et le port royal 100 % de plus (20 au lieu de 10)
- **v0.87.3** : 🌾 l'expansion en terre libre ne ralentit plus : les terres libres se prennent 3 fois plus vite toute la partie, et coûtent jusqu'à 3 fois moins de soldats quand l'élan de recrutement retombe (au bout de 5 minutes) : la conquête des terres vierges garde le rythme du début
- **v0.87.2** : ⚔️ casernes bien plus fortes : chaque soldat vaut 1,3 (camp d'entraînement), 1,8 (caserne) ou 2,5 soldats (grande caserne) au combat, au lieu de 1,1, 1,2 et 1,5
- **v0.87.1** : 🏛️ la règle du pouvoir : une muraille avec sa garnison maintient le pouvoir, donc un **port fortifié** (niveau 3) tient sa région comme une ville. Un royaume qui garde un port fortifié n'est plus désorganisé, et une région avec un port fortifié peut construire ; sans ville ni port fortifié, c'est l'anarchie
- **v0.87** : ✝️ **la Croyance** : chaque église en apporte (10, 30 ou 50 selon son niveau, +50 % si reliée à une route) ; plus croyant qu'un voisin ennemi, tu convertis lentement ses terres frontalières (d'abord ses couloirs étroits et ses pointes), d'autant plus vite que l'écart est grand ; jamais ses villes, ports fortifiés, avant-postes ni ce qui est dans leur muraille ; bible verte ou rouge dans le classement · 🎚️ menu : la difficulté et le nombre de royaumes rivaux (3 à 11) se choisissent séparément · 🧨 détruire une ville, une église ou un port fait aussi sauter les moulins et casernes qui en dépendaient · ⚓ un morceau de royaume avec un port fortifié n'est plus « coupé de ses châteaux » : il est défendu, comme avec une ville
- **v0.86** : 🧱 murs plus courts (12 cases au plus après la muraille de la ville, au lieu de 15) · 🔀 un mur tout neuf sur la route d'un assaut : l'armée le contourne, et ne rebrousse chemin que s'il ferme son seul passage (un mur sur la partie déjà passée ne l'arrête pas) · ↩️ une armée en retraite qui doit franchir un mur bâti dans son dos y perd 50 % de ses soldats, par mur · 🤖 les bots bâtissent aussi des murs, là où un voisin ennemi viendrait les attaquer
- **v0.85** : 🧱 **murs** : une ville de niveau 2 bâtit un mur (💰 500), une citadelle un second (💰 1000) : il va tout droit de la ville jusqu'à l'endroit choisi (15 cases au plus après sa muraille), s'accroche tout seul à un obstacle proche (lac, mer, fleuve, sommet, autre mur) et aucun assaut ne le franchit ; un assaut dont la route est coupée par un mur tout neuf rebrousse chemin · ⏳ améliorer une ville prend plus de temps : 40 s pour le niveau 2, 60 s pour le niveau 3
- **v0.84.1** : 📏 nouvelles tailles de carte : Petite 300 x 169, Moyenne 650 x 366, Grande 1000 x 562
- **v0.84** : 📏 choix de la taille de la carte avant la partie (cartes aléatoires) : Petite 500 x 281, Moyenne 750 x 422, Grande 1000 x 562 (format 16:9) ; plus d'îlots, de fleuves et de lacs sur les grandes, avec des reliefs plus étendus · ⚖️ toutes les cartes ont les mêmes règles de vitesse (fini le bonus des terres libres sur les cartes Monde et Europe : une grande carte prend juste plus de temps) · 🏝️ une capitale ne se fonde plus sur un îlot (terre d'au moins 600 cases)
- **v0.83.1** : 🚀 départ plus rapide : l'élan de départ triple le recrutement et la conquête des terres libres (au lieu de +50 %), puis disparaît en 5 minutes : l'expansion va environ 2 fois plus vite (la moitié des terres prise en 3 minutes au lieu de 6)
- **v0.83** : ⚡ assauts, marches et défenseurs 15 % plus rapides · 🧨 tu peux abandonner un avant-poste : tous ses soldats rentrent automatiquement par la mer (détruit par l'ennemi, ses soldats sont vaincus) · ⛪⚓ un moulin dans les zones d'un port et d'une église n'occupe plus qu'une place (celle du port en priorité) · 🏝️ les petits îlots ne disparaissent plus à la création de la carte, et il y a aussi des îlots moyens · ⚡ partie 2 fois plus fluide (les bots cherchent plus vite où construire)
- **v0.82** : 🏰 un assaut part de ta ville (château) la plus proche de l'objectif, et entre chez l'ennemi par le meilleur passage depuis elle (plus besoin de traverser la moitié du royaume) · 🛡️ tes défenseurs suivent l'assaut qui avance et passent par tes terres (plus de ligne droite à travers celles de l'ennemi) · 🤖 les bots ne s'acharnent plus à plusieurs sur la même cible et se battent aussi entre eux (ils ne te visent plus en priorité quand il reste peu de royaumes) · 🗺️ les frontières des royaumes suivent aussi les côtes et les lacs · 🌄 le relief et les sols se voient mieux sous la couleur des royaumes
- **v0.81** : 🖱️ terres libres : il faut deux clics de suite pour les attaquer, et un clic qui ferme un menu ne lance plus rien · ↩️ une retraite avant que l'armée ait quitté tes terres est immédiate et sans perte · ↩️ si la ville (église, port) que tu vises est prise par un autre avant ton arrivée, ton armée fait demi-tour · 🛶 une traversée de fleuve toutes les 10 s au plus · ⏳ un chrono de la partie en haut de l'écran · 🔱 les soldats sont représentés par deux lances croisées (au lieu d'un casque)
- **v0.80.1** : 🏚️ un royaume qui n'a plus de ville (château) est désorganisé, même s'il lui reste des églises ou des ports : on l'attaque de front, sans devoir prendre ses bâtiments un par un (ses avant-postes se visent toujours) · 🏰 s'il rebâtit ou reprend un château pendant l'assaut, l'assaut s'arrête · ⚡ contre un territoire désorganisé, plus l'armée est grande, plus elle avance vite · pas de flèche rouge pour ces assauts de front · ⛪ seule ta meilleure église débloque des châteaux en plus (elles ne s'additionnent plus) · 💰 nouveaux prix : grand moulin 150, château niveau 2 500, grande église 800, cathédrale 2000
- **v0.80** : 🛡️ les garnisons ne comptent plus dans ton armée (ce sont des armées liées à leur bâtiment : des villes bien gardées ne freinent plus le recrutement) · 💰 anéantir un royaume rapporte une prime de 500 pièces et tout son trésor · ⏳ une ville, une église ou un port qui vient d'être conquis ne peut pas être attaqué pendant 30 s · 🧹 grande vérification du code : 🐛 le bouton « Défendre » ne marchait qu'en cliquant sur son bord (le clic sur l'icône était ignoré) · 🐛 le jeu pouvait se figer si la cible d'un de tes assauts disparaissait · 🐛 plus de trahison « pour rien » (attaquer un allié là où il n'y a rien à attaquer) · 🐛 un royaume anéanti en plein assaut faisait disparaître les défenseurs et la garnison d'en face · 🐛 un assaut de jonction ne prend plus de bande de terres (ni de bâtiments) qu'il n'a pas traversée · 🐛 renforcer l'assaut contre un morceau coupé visait parfois le mauvais morceau · 🐛 bataille à 3 armées au pied d'un château : le siège ne recule plus · 🐛 on ne peut plus aider un allié contre une armée qui marche encore chez elle · 🐛 l'aperçu du chemin d'assaut tient compte de tes avant-postes · ⚡ grandes cartes plus fluides (dessin de la carte, survol d'un royaume, chemins d'assaut) · petites corrections d'affichage et nettoyage du code inutile
- **v0.79.1** : ✂️ la barre d'un assaut ennemi est raccourcie : juste « Écosse attaque · ⚔ soldats · Défendre »
- **v0.79** : 🤝 dans le classement, les membres d'un pacte sont regroupés dans un cadre, avec le nom du pacte et sa part des terres
- **v0.78.3** : 🐛 correction : les assauts contre un royaume avançaient beaucoup trop vite (à la vitesse des terres libres) depuis la v0.76 · 🏰 le bouton Château affiche un petit compteur « construits / maximum » (ex. 1/3), qui monte avec tes églises
- **v0.78.2** : ✂️ la route d'un assaut vers un objectif n'est que visuelle tant que le combat n'est pas joué : elle ne coupe le royaume traversé que si l'assaut prend son objectif (s'il échoue, elle est rendue et rien n'est coupé) · ⏱️ plus de temps de trajet affiché à côté des armées en marche
- **v0.78.1** : 🛡️ on ne peut envoyer des défenseurs contre un assaut qu'une fois qu'il est entré sur nos terres (fini les défenseurs qui partent l'attendre en terre ennemie pendant sa marche) ; les bots aussi
- **v0.78** : ⛪ une église pas trop loin d'une route de port (10 cases) s'y relie par un petit chemin, et une église pas trop loin d'une ville (25 cases) est reliée à elle : reliée, elle rapporte +2 💰 toutes les 10 s (un port seul, sans ville, ne crée pas de chemin)
- **v0.77.4** : 🧤 la souris est une petite main médiévale sur la carte · 🗡️ l'épée n'apparaît plus que sur les cibles qu'on peut vraiment attaquer (château ennemi atteignable, armée ennemie…)
- **v0.77.3** : 📊 la jauge des soldats affiche simplement « ⚔️ 150 / 300 » (sans le chiffre en double), puis ce qui est en garnison, aux avant-postes ou en mer
- **v0.77.2** : 🔎 la barre d'un assaut ennemi montre les soldats que l'attaquant garde en réserve, et entre parenthèses ceux qu'il a envoyés
- **v0.77.1** : 📊 la jauge des soldats affiche ton armée sur son maximum (ex. « armée 150 / 300 »)
- **v0.77** : 🎯 un cercle de ciblage rouge entoure l'armée ennemie survolée (clic = envoyer tes défenseurs) · 🗡️ la souris devient une petite épée (au lieu d'une main) sur tout ce qu'on peut sélectionner
- **v0.76.7** : ⚖️ après-guerre et galvanisation s'additionnent au lieu de se multiplier : un +25 % annule un −25 % (la jauge affiche le total quand les deux sont actifs)
- **v0.76.6** : ⛺ détruire un avant-poste ennemi ne donne plus de malus d'après-guerre (son propriétaire est toujours galvanisé)
- **v0.76.5** : 🏔️ la montagne défend un peu moins : +180 % au lieu de +250 % (elle se prend aussi un peu plus vite et moins cher)
- **v0.76.4** : 🔥 réussir une défense (repousser un assaut) galvanise ton peuple : +25 % de soldats produits pendant 15 s
- **v0.76.3** : ⛺ un avant-poste en construction n'a pas de garnison : ses soldats sont des soldats affaiblis occupés à bâtir (« ⚔ affaiblis » sur la carte, comptés avec les avant-postes dans la jauge, et les bots ne les comptent plus comme une garnison)
- **v0.76.2** : ⚓ le grand port (niveau 2) coûte 500 et le port royal (niveau 3) 1200
- **v0.76.1** : 🛡️ en survolant (ou en visant) un château ou un port fortifié ennemi, la fenêtre d'info en bas affiche juste sa défense globale (terrain + murs), sans les longues explications
- **v0.76** : 🏰 une armée ne traverse plus la muraille d'un château : elle s'arrête au pied du mur et l'assiège (la muraille reste entière ; si le château tombe, toute sa zone tombe) · ⏳ sièges plus longs : 8, 13 et 18 s selon le niveau · 🛡️ la garnison d'un château attend derrière sa muraille et n'entre en jeu qu'au siège · ⚡ un territoire désorganisé se prend 25 % plus vite
- **v0.75** : 🥾 les défenseurs, et les armées d'assaut qui marchent jusqu'à la frontière, prennent le chemin le plus rapide de leurs terres (en pointillés sur la carte) : vite en plaine, lentement dans le relief, plus lentement s'ils sont nombreux, mais 60 % plus vite qu'un assaut en terre ennemie car ils sont chez eux (même chose pour les défenseurs qui rentrent)
- **v0.74.1** : 🔍 la barre de résumé d'un royaume survolé ne suit plus la souris : elle s'affiche toujours au même endroit, juste sous ta barre d'infos en haut de l'écran
- **v0.74** : 🎨 fini les emojis : toutes les icônes du jeu (menus, barre du haut, journal, classement, bâtiments et armées sur la carte…) sont maintenant de petits dessins médiévaux (épées croisées, bourse d'or, heaume, écu, nef, sceau, sablier…)
- **v0.73** : 🛡️ un assaut qui échoue (repoussé, retraite…) rend au défenseur la route qu'il avait tracée à travers ses terres : elle ne reste à l'attaquant que s'il prend son objectif
- **v0.72.2** : 🚩 un petit fanion rouge marque tes châteaux isolés sur la carte · 🐛 correction : la ligne d'un assaut de jonction part de l'endroit où l'armée entre chez l'ennemi (et plus du milieu de ton royaume, ce qui faisait croire qu'un autre château était visé) · 🔎 clic sur « ton château isolé » dans la barre de l'assaut : la caméra va le voir
- **v0.72.1** : 🎯 l'assaut part du point le plus proche de la cible (une ville ou un avant-poste) ; un avant-poste vide (garnison seule) n'est plus choisi : l'assaut part alors de la ville
- **v0.72** : ⛵ tes bateaux en mer ont leur barre en bas de l'écran, comme les assauts · ❌ une petite croix dans le coin d'une barre (assaut ou bateau) ordonne la retraite (15 % de pertes ; un bateau fait demi-tour vers le port) · les soldats en mer comptent dans la jauge de ton armée
- **v0.71.1** : 🎨 menus plus médiévaux, sans emojis : une simple flèche dessinée pour améliorer un bâtiment, une nef pour débarquer ou envoyer des renforts par la mer, une ancre pour rapatrier
- **v0.71** : 🔍 en survolant un autre royaume, une barre au-dessus de la souris le résume : ses soldats, le nombre de bâtiments de chaque type et sa part des terres
- **v0.70.2** : 🏗️ un territoire désorganisé (sans château pour le diriger) ne peut plus rien construire d'autre qu'un château
- **v0.70.1** : ↩ des défenseurs encore en route quand l'assaut se termine (ville prise…) font demi-tour et rentrent à pied jusqu'à la ville la plus proche : on ne les récupère qu'à leur arrivée
- **v0.70** : 🚩 si tous tes châteaux sont isolés, ton armée est bloquée dedans : ton territoire coupé n'est plus défendu et aucune armée ne peut en partir (relie-le ou bâtis un château) ; tes soldats défendent ton dernier château moins bien (x0,8), mais tous d'office quand il est attaqué
- **v0.69.2** : 🐢 plus une armée d'assaut est grande, plus elle avance lentement chez l'ennemi (sur les terres libres, rien ne change)
- **v0.69.1** : ⚔️ améliorer une caserne coûte plus cher : 400 pour le niveau 2, 1600 pour le niveau 3
- **v0.69** : ⚠️ un morceau de royaume coupé de tous ses châteaux s'attaque de front, sans défenseurs, jusqu'à ce que son royaume le relie à un château (l'assaut s'arrête alors) · 🏰 la citadelle (château niveau 3) coûte 3000
- **v0.68** : 🔎 clic sur le nom (en rouge) d'un royaume qui t'attaque : la caméra va voir son armée · ⏱️ les renforts d'un assaut marchent depuis sa cité de départ : plus l'armée est loin, plus ils mettent de temps · 🐛 correction : l'armée part bien vers le point où commence son chemin chez l'ennemi (la marche, la flèche et le chemin coïncident) · 🤖 les royaumes rivaux n'envoient plus leurs soldats au compte-gouttes : ils attendent et envoient de plus gros paquets · 🩸 une armée en marche perd un pourcentage de ses hommes à chaque case (une grosse armée perd plus qu'une petite)
- **v0.67** : 🛤️ un port à moins de 30 cases d'une ville (château) est relié à elle par un chemin de terre : +30 % d'or · ⛪ une église construite sur ce chemin produit un peu d'or (+2 💰 toutes les 10 s)
- **v0.66.3** : 🛶 traverser un fleuve ne coûte plus aucun soldat : seulement le temps de la traversée (10 s, +6 s pour un fleuve double)
- **v0.66.2** : 🐛 correction : le bouton « Améliorer » d'un bâtiment (menu rapide ⬆️ et fenêtre en haut à gauche) se débloque tout seul dès que tu as assez d'or, sans devoir refermer et rouvrir le menu (en survolant le bouton, tu vois l'or qu'il manque)
- **v0.66.1** : 👑 le jeu s'appelle désormais **Medieval Emperor**
- **v0.66** : 🏰 nouvelle carte **Europe** (1000 x 1000 cases) · 🌍 la carte **Monde** passe à 1080 x 408 cases · 🗺️ menu des cartes en deux groupes : aléatoires et prédéfinies · 🌊 fleuves avec des méandres sur les cartes prédéfinies · ⚓ fini l'interception des expéditions en mer : on attaque l'avant-poste quand elle accoste · 🐎 sur les grandes cartes, les terres libres se prennent plus vite et coûtent moins de soldats (jusqu'à x4 en Europe) · ⚡ jeu bien plus rapide sur les grandes cartes (calculs optimisés)
- **v0.65** : 🏜️ nouveau terrain : le **désert** (défense comme une plaine, production des bâtiments −20 %), sur toutes les cartes, et aux vrais endroits sur la carte Monde · 📜 règles du menu réécrites avec toutes les mécaniques actuelles · 🏗️ de loin, le bâtiment qu'on pose apparaît sous la souris en version simplifiée (son icône), comme les bâtiments sur la carte
- **v0.64** : 🎯 un clic sur la cible pour la choisir, un 2e pour lancer l'assaut · fini les points de passage · ⚔️ plus de préparation de 10 s : l'armée part de ta cité la plus proche et marche sur tes terres jusqu'à la frontière (tu peux lui ajouter des soldats tout de suite pendant la marche, ensuite ce sont des renforts avec délai)
- **v0.63.1** : ⚔️ la grande caserne (niveau 3) agrandit beaucoup plus l'armée maximum (+200 au lieu de +80) et forme un peu plus de soldats (9 au lieu de 7) · 🤖 les royaumes rivaux s'acharnent moins sur toi (préférence pour le joueur divisée par 2 en Normal et Difficile)
- **v0.63** : 🌍 nouvelle carte **Monde** (dans le menu) : la vraie carte du monde, très grande, avec ses montagnes et ses grands fleuves au bon endroit
- **v0.62.2** : 📏 les châteaux, églises et ports se bloquent tous entre eux (cercles rouges, dans les deux sens) : 13 cases entre deux châteaux, 15 entre un château et une église ou un port, 11 entre deux églises ou ports
- **v0.62.1** : 🐛 correction : une grande zone d'avant-poste (ou des terres sur un autre continent) ne fait plus passer toute l'île de ton royaume pour « coupée » — tes châteaux ne sont plus isolés d'un coup et tes terres ne sont plus données à l'ennemi · les soldats stationnés restent à l'avant-poste
- **v0.62** : ⛺ toute la zone d'un avant-poste est défendue par ses soldats stationnés (pas par ceux du royaume, au-delà des mers) · pas de château à moins de 12 cases d'un avant-poste : il faut conquérir des terres autour avant
- **v0.61.6** : ⛵ si un avant-poste tombe pendant que des renforts sont en mer, leur bateau fait demi-tour jusqu'au port (au lieu de rentrer d'un coup)
- **v0.61.5** : 🐛 correction : les soldats débarqués en plus de la garnison d'un avant-poste ne disparaissent plus à la fin de sa construction (ils stationnent, prêts à agir)
- **v0.61.4** : 🚨 une expédition ennemie qui vise ta côte : la zone où elle va débarquer clignote en rouge sur ton territoire
- **v0.61.3** : 🚨 un royaume qui t'attaque (ou prépare un assaut contre toi) voit son nom clignoter en rouge dans le classement, en haut à droite
- **v0.61.2** : 🟩🟥 en posant un moulin ou une caserne, les zones constructibles (châteaux, églises, ports) montrent en vert où il peut se poser et en rouge où c'est impossible
- **v0.61.1** : 💰 l'amélioration du château au niveau 2 coûte 300 (au lieu de 90)
- **v0.61** : 🛡️ les défenseurs n'arrivent plus instantanément : ils partent du château le plus proche et marchent à la rencontre de l'armée ennemie (bannière visible, « en route » dans le panneau)
- **v0.60.5** : ⛺ un avant-poste ne tombe plus tout de suite : il faut l'assiéger 10 s, le temps pour son propriétaire de le défendre
- **v0.60.4** : ⛺ cliquer sur un de ses avant-postes n'envoie plus directement de renforts : ça ouvre sa fenêtre d'info et un menu rapide ⛵ Renforts / 🚢 Rapatrier
- **v0.60.3** : 💰 l'amélioration de la caserne au niveau 2 coûte 80 (au lieu de 40)
- **v0.60.2** : cliquer à côté (ou `Échap`) ferme ensemble le menu rapide et la fenêtre d'info d'un bâtiment
- **v0.60.1** : une confirmation est demandée avant de détruire un bâtiment
- **v0.60** : 🏗️ un bâtiment posé est en chantier pendant 3 s (petite jauge verte, il ne produit rien avant) · passer au niveau 3 prend 10 s de travaux
- **v0.59.1** : 🛡️ en défendant, le message indique combien de soldats partent (et, pour un avant-poste, que seuls ses soldats stationnés peuvent le défendre)
- **v0.59** : 🚢 clic droit sur un de ses avant-postes → « Rapatrier » : les soldats qui y attendent rentrent en bateau au port le plus proche
- **v0.58.1** : ⛵ l'option s'appelle « Attaque navale » et se trouve plus facilement : plus besoin de cliquer pile sur la côte, un clic droit tout près (même dans l'eau) suffit · une expédition au plus toutes les 5 s
- **v0.58** : 🐢 recrutement freiné pour les grands royaumes (il suit la racine carrée du territoire) et rendement décroissant des casernes · 💰 améliorations plus chères : grand moulin 100, grande caserne 800, port royal 600, cathédrale 1000 · ✂️ plus de message pour les petits morceaux englobés (seulement à partir de 50 cases, ou s'il reste un château isolé)
- **v0.57.1** : ⚰️🔥 l'après-guerre et la galvanisation s'additionnent : −25 % par victoire récente (jusqu'à −75 %), +25 % par défaite récente (jusqu'à +100 %)
- **v0.57** : 🌊 les fleuves ne se prennent plus jamais : ils restent neutres et bloquent l'expansion et les assauts ; on ne passe qu'en traversant à gué (10 s pour la 1re case, 6 s pour la 2e) · un royaume des deux côtés d'un fleuve reste un seul royaume
- **v0.56** : 🏳️ annuler une attaque = retraite : 3 s pour décrocher, puis 15 % de pertes · bouton « Détruire » aussi dans la fenêtre d'un bâtiment, en haut à gauche
- **v0.55.1** : le menu rapide des bâtiments n'a plus que deux icônes (⬆️ améliorer, ✖ détruire) ; la fenêtre explicative revient en haut à gauche
- **v0.55** : 🛠️ clic sur un de ses bâtiments → menu rapide juste à côté : l'améliorer (5 s de travaux) ou le détruire (10 s), avec une petite jauge qui se remplit
- **v0.54.3** : 👆 en survolant un bâtiment sélectionnable, la souris devient une main et le bâtiment s'illumine (doré chez soi, rouge chez l'ennemi)
- **v0.54.2** : en construisant, l'image du bâtiment apparaît sous la souris (sur un carré vert ou rouge) au lieu d'un simple carré
- **v0.54.1** : les pactes sont interdits par défaut dans le menu de départ (chacun pour soi) ; on peut toujours les autoriser
- **v0.54** : 🚀 élan de départ : les 4 premières minutes, recrutement et prise des terres libres plus rapides (+50 %, qui diminue peu à peu) · 💰 solde des troupes : au-delà de la moitié de l'armée maximum, les soldats disponibles font baisser l'or gagné (jusqu'à −25 %)
- **v0.53** : 🛡️ en posant ou en améliorant un château, une bulle près de la souris montre la défense totale de sa muraille (terrain + murs)
- **v0.52** : 👀 au début de la partie, les royaumes rivaux sont déjà installés sur la carte (nom et bannière) : on voit où ils sont avant de choisir où fonder sa capitale
- **v0.51** : 🐢 les armées avancent encore 2 fois moins vite quand elles traversent un royaume ennemi (6 fois moins vite que sur les terres libres)
- **v0.50** : 💰 seuls les bâtiments que tu construis toi-même font monter le prix des suivants (ceux pris à l'ennemi ne comptent plus) · ⚰️🔥 l'après-guerre et la galvanisation durent 30 s
- **v0.49** : ⚔️ deux armées ennemies qui assiègent le même château s'affrontent d'abord entre elles, la gagnante reprend le siège · 🛡️ clic droit chez un allié attaqué → l'aider à se défendre (ses survivants rentrent ensuite)
- **v0.48** : 🗺️ un point de passage d'assaut doit être à au moins 4 cases du bord du royaume visé · ⚰️ après un assaut réussi, 60 s d'après-guerre pour le vainqueur (−25 % de soldats produits) et 🔥 de galvanisation pour le perdant (+25 %)
- **v0.47** : 🏰 une citadelle (château niveau 3) permet 2 assauts en même temps contre un même royaume, et coûte 1000 · garnisons des châteaux bien plus grandes (petite, x5, puis x3) et chaque soldat de garnison vaut 3 au combat · le port royal a la même petite garnison qu'un fort en bois
- **v0.46** : ⏳ 5 s d'attente entre deux envois de défenseurs contre un même assaut (fini les renforts envoyés en continu, soldat par soldat)
- **v0.45** : ⛪ prendre une église ou un port donne aussi sa zone et les bâtiments construits grâce à lui · 🚩 pendant un assaut de front, la bannière reste à peu près fixe sur le front et glisse doucement (elle ne saute plus d'un bout à l'autre)
- **v0.44** : 💰 rendement décroissant des moulins et des ports : plus un royaume en a, moins chacun rapporte (l'économie ne s'emballe plus en fin de partie)
- **v0.43** : 💰 un château coûte 100 (au lieu de 30), ses améliorations 90 et 225 · toutes les améliorations au niveau 3 coûtent 50 % de plus (grande caserne 150, cathédrale 300, port royal 375)
- **v0.42.1** : 🤖 les royaumes rivaux traversent aussi les fleuves à gué pour prendre les terres libres d'en face
- **v0.42** : 🛶 clic droit sur une terre libre de l'autre côté d'un fleuve → « Traverser le fleuve » : l'armée passe à gué (3 s par case de fleuve) et prend une tête de pont sur l'autre rive
- **v0.41** : 🏰 siège : un château ne tombe plus tout de suite, l'armée doit l'assiéger 5 s (niveau 1), 10 s (niveau 2) ou 15 s (niveau 3), le temps pour le défenseur d'envoyer des soldats
- **v0.40** : 🐢 les assauts contre un royaume avancent 3 fois moins vite (toujours plus lentement dans les forêts, collines, montagnes et fleuves) : on a le temps de voir venir l'ennemi et de réagir
- **v0.39.3** : plus de trait doré sur la jauge des soldats : seule sa couleur indique, à peu près, quand le recrutement va bien
- **v0.39.2** : plus de flèche pendant la préparation d'un assaut : la bannière de l'attaquant est plantée sur la frontière, les terres menacées scintillent à sa couleur et le bâtiment visé a un halo qui pulse
- **v0.39.1** : 🧱 la muraille du port royal donne +1 de défense dans sa zone, comme un fort en bois
- **v0.39** : 🎯 une flèche rouge en pointillés, légèrement courbée, montre chaque assaut : un cercle au départ (juste à l'intérieur de la frontière) et une cible sur la zone attaquée · 🧱 le port royal (niveau 3) a une petite muraille, comme un fort en bois
- **v0.38** : ✂️ couper un royaume en deux donne d'un coup le plus petit morceau à celui qui a coupé, **quelle que soit sa taille** (fini la limite de 20 %), avec ses églises et ports · 🚩 seuls les châteaux et les ports de niveau 3 tiennent, isolés
- **v0.37** : ✂️ un morceau coupé (moins de 20 % du royaume) va entièrement à celui qui l'a coupé, châteaux et bâtiments compris : un royaume reste d'un seul tenant (sauf invasion par la mer) · 🤝 on ne peut plus attaquer depuis les terres d'un allié, seulement depuis son propre territoire
- **v0.36** : ⚔️ supériorité en nombre : le camp le plus nombreux (plus de 2 fois plus de soldats) tue plus vite et perd moins de soldats, jusqu'à x5 · une petite poignée de défenseurs ne bloque plus une grosse armée · 🏰 prendre un château donne d'un coup toute sa zone de défense et les bâtiments qui s'y trouvent
- **v0.35** : les armées avancent 4 fois moins vite sur la carte (on voit mieux ce qui se passe) · un petit morceau de royaume coupé du reste est englobé par le royaume qui l'entoure le plus
- **v0.34.7** : dans le menu de départ, on peut **interdire les pactes** (chacun pour soi)
- **v0.34.6** : en survolant un royaume, tout son territoire s'illumine et ses bâtiments sont entourés d'un cercle doré
- **v0.34.5** : clic droit chez un allié : 🎁 lui envoyer des soldats (il en reçoit 75 %)
- **v0.34.4** : depuis les terres d'un allié, on peut lancer des assauts, mais plus prendre des terres libres
- **v0.34.3** : clic droit sur un royaume : « 🤝 Proposer une alliance » (ou « 💔 Rompre l'alliance » avec un allié)
- **v0.34.2** : un bouclier 🛡️ au-dessus des châteaux, ports royaux et avant-postes montre les soldats de leur garnison (et ⚔ les soldats stationnés d'un avant-poste)
- **v0.34.1** : menu de départ : bannières plus grandes, règles repliées (on clique pour les dérouler)
- **v0.34** : 🗺️ 3 types de cartes au choix (Normale avec quelques îlots, Continentale sans mer bordée de montagnes et de grands lacs, Base navale avec plusieurs grandes îles) · 🏔️ sommets enneigés infranchissables au cœur des montagnes · les royaumes coincés sur leur île bâtissent un port et partent en expédition
- **v0.33.5** : image de l'avant-poste (camp fortifié avec sa palissade et sa tour de guet), visible en zoomant
- **v0.33.4** : images des 3 niveaux du port (port de pêche, grand port, port royal), visibles en zoomant
- **v0.33.3** : avant-postes : il faut emmener de quoi remplir leur garnison ; une fois bâtis, 5 soldats restent en garnison (fixe) et les autres stationnent, prêts à attaquer depuis l'avant-poste ou à le défendre
- **v0.33.2** : un avant-poste en construction peut être attaqué, et ses défenseurs ont -0,2 de défense ; ses soldats ne peuvent rien faire avant la fin des travaux (message clair si on essaie d'attaquer depuis lui)
- **v0.33.1** : un avant-poste met 20 s à être bâti, puis donne +1 de défense ; clique dessus pour lui envoyer des renforts par la mer ; un château bâti ou pris dans sa zone en fait une vraie terre du royaume · le jeu est de nouveau plus rapide (correction d'un ralentissement)
- **v0.33** : ⚓ avec un port, clique sur le bateau d'une expédition ennemie pour envoyer des soldats l'intercepter : bataille en mer s'ils arrivent avant elle
- **v0.32.1** : une expédition emmène le % de soldats choisi (petite perte en mer), qui défendent seuls l'avant-poste · le port royal (niveau 3) a une petite garnison · on peut construire 1 bâtiment autour d'un grand port, 3 autour d'un port royal · les soldats en garnison comptent dans l'armée maximum
- **v0.32** : ⚓ nouveau bâtiment **port** (3 niveaux, au bord de l'eau, produit de l'or, attaquable) · ⛵ **expéditions maritimes** dès le niveau 2 : clic droit sur une côte → Débarquer, un bateau traverse la mer et plante un **avant-poste** ⛺ d'où l'on peut attaquer · menu d'actions au clic droit
- **v0.31.1** : zone de jeu 50 % plus grande (carte de 294 x 192 cases, vue plus dézoomée au départ)
- **v0.31** : les fleuves qui se rejoignent grossissent (2 fleuves = double largeur, 3 = grand fleuve infranchissable) · quelques lacs sur les fleuves · les fleuves naissent dans les montagnes · toujours de l'océan au bord de la carte (plus de terre coupée net)
- **v0.30.1** : bonus de défense des fleuves réduit à +3 · entre 3 et 12 fleuves par partie, au hasard · carte un peu plus grande (240 x 156 cases au lieu de 200 x 130)
- **v0.30** : 🌊 des fleuves sur la carte, du pied des montagnes jusqu'à la mer : longs à traverser, et +5 de défense pour celui qui y intercepte un ennemi
- **v0.29.2** : 3 points de passage au maximum par assaut
- **v0.29.1** : on ne peut viser que les châteaux et églises d'un royaume tant qu'il en a ; sans eux, l'assaut se fait de front sur tout son territoire, et toutes ses troupes défendent d'office (à 0,8, désorganisées)
- **v0.29** : choisis l'itinéraire de tes assauts : après avoir cliqué sur la cible, place des points de passage, puis 2 clics sur la cible pour lancer (3 clics = tout droit)
- **v0.28.1** : une église se construit assez loin de tes châteaux pour ne jamais finir dans leur muraille (cercles rouges pendant la construction), et inversement pour un nouveau château
- **v0.28** : on peut attaquer une église ⛪ directement, comme un château (elle n'a ni défense ni garnison) · chaque église améliorée ajoute ses châteaux (elles s'additionnent) · une église ne se construit plus dans la muraille d'un château
- **v0.27.1** : images des 3 niveaux de l'église (église en bois, grande église, cathédrale), visibles en zoomant
- **v0.27** : nouveau bâtiment ⛪ **église** (3 niveaux jusqu'à la cathédrale) : se construit partout, permet des moulins et casernes autour d'elle et débloque des châteaux en plus, mais n'est pas défendue · la caserne de niveau 1 rend aussi les soldats 10 % plus forts
- **v0.26** : une caserne de niveau 2 rend **tous** les soldats du royaume 20 % plus forts au combat, une de niveau 3 50 % plus forts (la meilleure caserne compte)
- **v0.25** : un château encerclé garde les terres de sa muraille et continue de produire · plus d'« armée de secours » : on clique sur son château isolé pour lancer un assaut classique qui le relie au royaume (la route s'élargit s'il réussit)
- **v0.24** : ✂️ encerclement : un morceau de royaume coupé par un assaut (moins de 20 % du royaume) est pris d'un coup · ses châteaux restent debout, isolés 🚩 : ils ne reçoivent plus de défenseurs, mais leur royaume peut leur envoyer une armée de secours · un assaut de front ne prend plus de château (il faut le viser)
- **v0.23** : plus de chiffres précis dans le jeu, seulement des pourcentages · les moulins et casernes produisent **toutes les 10 secondes**, avec un petit chiffre qui s'envole au-dessus d'eux (seulement pour tes bâtiments) · revenu de base selon la taille du territoire · les touches `&`, `é`, `"` du clavier AZERTY marchent comme `1`, `2`, `3` · la muraille du fort en bois est un peu plus grande, pour pouvoir y construire
- **v0.22.1** : nouvelle bannière aux poissons (gris clair)
- **v0.22** : nouvelle échelle plus progressive : on commence avec 10 soldats et 10 pièces d'or, le recrutement et les revenus grandissent lentement (prix des bâtiments 10 / 20 / 30)
- **v0.21** : suppression de la trêve après la prise d'un château (plus de délai avant de réattaquer, plus de bonus ou malus de recrutement)
- **v0.20** : 13 bannières de royaume (une par couleur) à choisir au début ; elles s'affichent à côté des noms, portent les armées et accompagnent les messages
- **v0.19** : nouveaux combats : 10 s de préparation (on ajoute des soldats), renforts en 5 s, le défenseur envoie ses soldats en cliquant sur la bannière, combats visibles en direct, bonus de terrain pour le défenseur, garnison dans les châteaux · on peut attaquer depuis les terres d'un allié du pacte · production des moulins et casernes selon le terrain · 3 châteaux construits maximum par partie
- **v0.18** : nouvelle logique d'attaque : on vise un château ennemi, l'armée contourne les autres fortifications et capture tout sur son chemin ; un royaume sans château s'attaque de front · écart obligatoire de 3 cases autour des bâtiments et 4 autour des châteaux · moulins et casernes seulement dans l'enceinte d'un château
- **v0.17.2** : les routes se rejoignent proprement aux carrefours (elles ne se coupent plus)
- **v0.17.1** : les routes des châteaux sont tracées en lignes droites avec des coins à 90°
- **v0.17** : les alliances deviennent des **pactes** (jusqu'à 3 royaumes, un seul pacte par royaume), entourés d'une frontière dorée visible par tous · il faut maintenant **85 %** des terres pour gagner, avec un bouton « Continuer » pour finir la conquête après la victoire
- **v0.16.2** : la trêve après la prise d'un château vaut dans les deux sens : le royaume qui l'a perdu ne peut pas contre-attaquer tout de suite
- **v0.16.1** : le temps de trêve après la prise d'un château s'affiche sous le nom du royaume ennemi sur la carte
- **v0.16** : les châteaux de niveau 2 et 3 tracent des chemins de terre puis des routes pavées vers les moulins et casernes de leur muraille, qui produisent +20 % puis +50 %
- **v0.15** : pendant les 30 s de repos après la prise d'un château, l'attaquant recrute 2x moins vite et le défenseur 1.5x plus vite
- **v0.14** : prendre un château arrête l'assaut après la conquête de sa zone, puis 30 s de repos avant de réattaquer le même royaume
- **v0.13** : la caserne a 3 niveaux (camp d'entraînement, caserne, grande caserne) avec leurs images ; chaque niveau donne plus de soldats max et un meilleur recrutement
- **v0.12** : le relief ralentit la conquête : on avance vite en plaine, lentement en forêt, colline et montagne, et le territoire épouse le relief
- **v0.11** : jauge des soldats en bas de l'écran, avec le recrutement par seconde ; le recrutement est maximal vers 40 % de l'armée puis ralentit si on garde trop de soldats
- **v0.10** : alliances visibles pour tout le monde : carrés de couleur dans le classement, lignes dorées 🤝 au survol d'un royaume, touche `A` pour tout afficher · les touches `1`, `2`, `3` mettent le bâtiment sous la souris, un clic le pose
- **v0.9.2** : les touches `1`, `2`, `3` posent le bâtiment directement sous la souris (ou l'améliorent)
- **v0.9.1** : 2 cases d'écart obligatoires autour de chaque bâtiment, pour qu'ils ne se chevauchent plus
- **v0.9** : les châteaux occupent 4x4 cases et paraissent plus grands sur la carte
- **v0.8.2** : nouveaux visuels pour les trois niveaux du château
- **v0.8.1** : nouveaux visuels pour les deux niveaux du moulin
- **v0.8** : la ferme devient un **moulin** à 2 niveaux (moulin, grand moulin) avec ses images quand on zoome
- **v0.7** : les bâtiments occupent 2x2 cases sur la carte, avec un aperçu de l'emplacement avant de construire
- **v0.6** : châteaux à 3 niveaux (fort en bois, château, citadelle) avec leurs images quand on zoome ; chaque niveau agrandit la muraille et augmente la défense (+1, +2, +4)
- **v0.5.1** : ton royaume est vert par défaut (le bleu se confondait avec la mer)
- **v0.5** : la zone des châteaux devient une muraille crénelée qui suit les frontières · le bonus du château s'ajoute à la défense du terrain, seulement dans sa muraille
- **v0.4** : attaquer un allié = le trahir, et un traître 🗡️ a sa défense réduite de moitié pendant 2 minutes
- **v0.3** : alliances (proposer, accepter, refuser, trahir) · les attaques contre un royaume se préparent 5 s avec une flèche et une bannière ⚔️ visibles par tous
- **v0.2** : zone de protection des châteaux visible sur la carte · attaques en cours affichées en bas de l'écran, avec un bouton pour les annuler
- **v0.1** : première version jouable (carte aléatoire, conquête, or, 3 bâtiments, royaumes rivaux, victoire/défaite)

## 💡 Idées pour la suite

- 🤝 Plus de diplomatie : demandes d'aide aux membres du pacte
- 🗼 Activer la tour de garde dans les parties (le bâtiment est prêt : `TOWERS` dans `js/config.js`)
- 🌦️ Événements médiévaux dans les parties normales : famine, hivers rigoureux (la peste existe déjà dans la guerre de Cent Ans)
- 👑 Héros ou rois avec des pouvoirs spéciaux dans les parties normales (comme Jeanne d'Arc et les rois de la guerre de Cent Ans)
- ⚜️ Les vraies bannières des factions de la guerre de Cent Ans
- 🌐 En ligne : les scénarios (Charlemagne, la guerre de Cent Ans, les Factions) à plusieurs, les cartes dessinées, et revenir dans sa partie après une coupure

---

## 🛠️ Pour les curieux : modifier le jeu

Tous les réglages sont dans **`js/config.js`** : taille de la carte, vitesse, coûts,
noms et couleurs des royaumes, difficulté… Change un chiffre, recharge la page, et teste !

| Fichier | Rôle |
|---|---|
| `index.html` | La page : menus et interface |
| `style.css` | Le style « parchemin » |
| `js/config.js` | Tous les réglages du jeu |
| `js/map.js` | Génération aléatoire de la carte |
| `js/worldmap.js`, `js/europemap.js`, `js/azerothmap.js` | Les cartes prédéfinies (Monde, Europe, Azeroth) |
| `js/custommaps.js` | Les cartes dessinées avec l'éditeur (celles du navigateur, et la liste `CUSTOM_MAPS` des cartes ajoutées au jeu) |
| `editeur.html`, `js/editor.js` | L'éditeur de cartes |
| `js/game.js` | Règles : économie, attaques, victoire |
| `js/charlemagne.js` | 👑 Le scénario « Charlemagne » : ses factions, objectifs, réglages et textes (ses règles sont dans `js/game.js`) |
| `js/centans.js`, `js/centansrules.js` | ⚜️ Le scénario « La guerre de Cent Ans » : ses données (factions, objectifs, réglages, parchemins), puis ses règles |
| `js/defis.js` | ⭐ Les défis des campagnes et le vœu solennel (les défis de chaque faction sont dans `CHALLENGES`) |
| `js/ai.js` | Le cerveau des royaumes adverses |
| `js/icons.js` | Les icônes médiévales dessinées (elles remplacent les emojis partout) |
| `js/render.js` | Le dessin de la carte |
| `js/music.js`, `sons/` | 🎵 La musique d'ambiance (`sons/musique/`) et les petits sons du jeu (`MUSIC.SOUNDS`) (pour ajouter un morceau : le mettre dans `sons/musique/` et l'ajouter à la liste `MUSIC.TRACKS` de `js/config.js`) |
| `js/replay.js` | 📽️ Le résumé de fin de partie (les photos de la carte, et leur lecture en accéléré) |
| `js/main.js` | Souris, clavier, boutons et boucle de jeu |
| `js/net.js` | 🌐 Le jeu en ligne, côté navigateur : la connexion au serveur, les salons, les tours, la pause et la vitesse |
| `js/dmath.js` | 🧮 Les calculs (sinus, arc tangente…) qui donnent le même résultat dans tous les navigateurs (pour le jeu en ligne) |
| `serveur/serveur.js`, `serveur/PROTOCOLE.md` | 🌐 Le serveur de jeu en ligne (Node.js, sans dépendance) et la description de ses messages |
| `img/` | Les images des bâtiments (2 niveaux de mine, 4 niveaux de château, de caserne, d'église et de port, 2 de moulin, et l'avant-poste) , des bannières (`img/bannieres/`), le décor marin (`decor_mer.webp`) et le cadre brodé (`cadre.webp`) |
