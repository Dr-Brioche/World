# ⚔️ World

**Un petit jeu de conquête médiévale, jouable directement dans le navigateur.**

Inspiré d'OpenFront, mais à la sauce médiévale : fonde ta capitale, étends ton royaume case par case,
bâtis moulins, casernes et châteaux, et écrase les royaumes rivaux pour dominer le continent !

## 🎮 [▶️ JOUER MAINTENANT](https://dr-brioche.github.io/World/)

👉 **https://dr-brioche.github.io/World/** : rien à installer, ça marche sur ordinateur, tablette et téléphone.

> Le jeu en ligne est mis à jour automatiquement à chaque nouveauté.
> Tu peux aussi télécharger le projet et ouvrir `index.html` d'un double-clic.

---

## 📜 Le jeu en bref

- 🗺️ **Une carte différente à chaque partie** : plaines, forêts, collines, montagnes, sommets enneigés, fleuves, lacs et mers,
  avec **3 types de cartes** au choix : Normale, Continentale ou Base navale
- 👑 **Ton royaume** : choisis son nom et sa **bannière** parmi 14 (elle donne sa couleur à ton royaume)
- ⚔️ **La conquête** : attaque les terres voisines en choisissant combien de soldats envoyer
- 🏰 **Cinq bâtiments** pour développer ton royaume : moulin, caserne, château, église et port
- ⛵ **Des expéditions maritimes** : débarque sur une côte lointaine et plante un avant-poste
- 🤖 **5 à 10 royaumes rivaux** (Bourgogne, Aquitaine, Castille…) qui s'étendent, attaquent, s'allient et se trahissent tout seuls
- 🤝 **Des pactes** : allie-toi à d'autres royaumes… et trahis-les quand ça t'arrange
- 🎚️ **3 niveaux de difficulté** : Facile, Normal, Difficile

## 🕹️ Comment jouer

1. **Fonde ta capitale** : choisis ta bannière et le **type de carte** dans le menu, puis clique sur une terre au début de la partie
   (pas sur un îlot : il faut une terre assez grande).
   - **Normale** : un grand continent entouré d'océan, et parfois quelques îlots au large.
   - **Continentale** : pas de mer, que de la terre, bordée de **montagnes infranchissables** en guise de limite
     de carte ; les fleuves s'y jettent dans de **grands lacs**.
   - **Base navale** : **plusieurs grandes îles** ; les ports et les expéditions maritimes deviennent essentiels.
   Chaque royaume a sa bannière : elle s'affiche à côté de son nom (carte, classement, barre du haut),
   porte ses armées, et accompagne les messages pour reconnaître tout de suite qui fait quoi.
2. **Étends-toi** : clique sur une terre libre voisine pour t'en emparer.
   **Pour attaquer un royaume, clique sur un de ses châteaux 🏰** (ou une de ses églises ⛪, ports ⚓ ou avant-postes ⛺, sans défense) : ton armée se fraie un chemin depuis ta
   frontière en **contournant ses autres fortifications**, capture tout sur son passage, puis prend le château.
   En survolant un château ennemi, tu vois le chemin prévu (pointillés dorés). Si le château est en arrière-pays,
   derrière d'autres zones de défense, il est **inaccessible** (croix rouge) : prends d'abord les châteaux
   de la frontière. **Tant qu'un royaume a un château, une église, un port ou un avant-poste, tu ne peux viser que ceux-ci.**
   Quand il n'en a **plus aucun**, clique n'importe où sur ses terres : l'assaut se fait
   **de front, sur tout son territoire** (comme sur une terre libre, sans points de passage).
   Toutes les troupes encore présentes dans ce royaume **défendent d'office**, mais désorganisées
   sans pouvoir en place : chaque soldat ne compte que pour **0,8**.

   **🗺️ Choisir l'itinéraire** : le premier clic sur un château (ou une église) ennemi **choisit la cible**.
   Ensuite, clique sur ses terres pour placer jusqu'à **3 points de passage** (numérotés 1, 2, 3) :
   l'armée passera par chacun d'eux, dans l'ordre, en prenant toujours le chemin le plus facile (les plaines)
   entre deux points. En survolant la carte, tu vois en blanc le chemin si tu ajoutais un point à cet endroit.
   Reclique sur un point pour l'enlever. Puis **clique 2 fois sur la cible pour lancer l'assaut**.
   Pour aller tout droit : **3 clics d'affilée** sur le château. `Échap` ou clic droit pour annuler.
   Le curseur « Envoyer » choisit le % de tes soldats qui partent en campagne.
   Tes attaques en cours s'affichent en bas de l'écran avec leurs soldats :
   le bouton **✖ Annuler** fait rentrer les survivants au royaume.
   Les attaques ennemies contre toi y apparaissent aussi, en rouge.
   **Si tu es dans un pacte**, tu peux aussi attaquer les terres qui touchent celles de tes alliés,
   même si tu n'es pas toi-même voisin.

   **⚔️ Le déroulement d'un assaut**
   - **Préparation (10 s)** : une ligne pointillée et une bannière ⚔️ à ta couleur montrent à tout le monde
     où tu vas frapper. Pendant ce temps, reclique sur la cible pour **ajouter des soldats tout de suite** :
     c'est ce qui fixe l'ampleur de l'assaut.
   - **L'assaut commence** : tu peux encore envoyer des **renforts** en recliquant sur le château visé,
     mais ils mettent **5 secondes** à arriver.
   - **Prendre des terres** coûte peu (comme une terre libre, selon le terrain). Ce qui coûte cher,
     ce sont les **défenseurs** ennemis.
   - **Défendre** : quand un assaut te vise, clique sur sa bannière (ou sur **🛡️ Défendre** en bas de l'écran)
     pour envoyer le % de soldats choisi. Le défenseur peut en envoyer autant qu'il veut, **sans délai**.
   - **La garnison** : chaque château a ses propres défenseurs (plus nombreux selon son niveau),
     qui sortent le défendre seuls le temps que le royaume réagisse. Ils se reconstituent ensuite peu à peu.
   - **Le combat** n'est pas instantané : sur la bannière, tu vois en direct les soldats des deux armées.
     **En plaine, 1 défenseur vaut 1 attaquant** ; ailleurs, le défenseur profite de la défense de l'endroit
     où se bat l'assaut (forêt +60 %, colline +120 %, montagne +250 %, + bonus du château dans sa muraille).
     L'assaut choisit donc un chemin qui passe le plus possible par les plaines.
   - Si l'attaquant n'a plus de soldats, l'assaut est **repoussé**. Les défenseurs survivants rentrent chez eux.
   - **Prendre un château** arrête l'assaut : ton armée finit de conquérir sa zone de défense
     (un peu élargie), puis les survivants rentrent. Tu peux relancer un nouvel assaut aussitôt.

   **✂️ Encercler** : si ton assaut **coupe** un morceau du royaume ennemi, et que ce morceau fait
   **moins de 20 %** de son territoire et touche le tien, il est **pris d'un coup** !
   S'il y a un château dedans, le château reste à l'ennemi **avec les terres dans sa muraille** :
   il tient seul, **isolé** 🚩 au milieu de tes terres.
   - Un château isolé **continue de produire** pour son royaume (avec les moulins et casernes de sa muraille) :
     il est juste plus difficile à défendre.
   - Son royaume **ne peut plus lui envoyer de défenseurs** : seule sa garnison le défend.
     Aucune armée ne peut partir de lui.
   - Pour le sauver, **clique sur ton château isolé** : tu lances un **assaut classique** (préparation de 10 s,
     renforts…) depuis ton royaume, qui traverse les terres ennemies (en évitant leurs murailles) pour le rejoindre.
     **S'il y arrive**, sa route s'élargit un peu : tu récupères des terres entre le château et ton royaume,
     ils sont **réunis** et tu peux le défendre comme avant. Si le château était attaqué, les soldats
     de ton assaut rejoignent sa défense.
3. **Construis** : appuie sur `1` à `5` (ou `&`, `é`, `"`, `'`, `(` sur un clavier AZERTY, ou clique sur un bouton en bas) : le bâtiment apparaît
   **sous ta souris**, puis **clique** pour le poser. Rappuie sur la même touche ou `Échap` pour annuler.
   Les moulins et casernes occupent **2x2 cases** de ton territoire, les châteaux **4x4 cases** (pas de mer).
   **Tu peux construire au maximum 3 châteaux par partie** (capitale comprise) ; les châteaux pris à l'ennemi
   ne comptent pas dans cette limite, et une **église** améliorée en débloque d'autres.
   **Le terrain compte** : un moulin produit plus en plaine (+30 %) qu'en forêt (normal), colline (-10 %) ou montagne (-30 %) ;
   une caserne produit plus en forêt ou colline (+30 %) qu'en plaine (normal) ou montagne (-10 %).
   Pendant la construction, l'info en bas à gauche indique la production prévue à cet endroit.
   **Les moulins et casernes se construisent dans l'enceinte d'un de tes châteaux** (dans sa muraille),
   **ou près d'une de tes églises** (ou d'un port amélioré) qui a encore de la place, pas ailleurs dans l'arrière-pays.
   Les châteaux et les églises, eux, se construisent partout sur ton territoire.
   Il faut aussi laisser **3 cases d'écart** autour de chaque bâtiment, et **4 cases** autour des châteaux
   (l'aperçu devient rouge si c'est trop près).
   Si un ennemi prend une seule de ces cases, il capture tout le bâtiment !
   - 🌾 **Moulin** : **toutes les 10 secondes**, il verse un peu d'or d'un coup
     (un petit chiffre `+2 💰` s'envole au-dessus de lui). **Clique dessus pour l'améliorer** (2 niveaux) :

     | Niveau | Or produit | Prix |
     |---|---|---|
     | 1. Moulin | un peu | prix du moulin |
     | 2. Grand moulin | +133 % | 💰 40 |

   - ⚔️ **Caserne** : **toutes les 10 secondes**, elle forme quelques soldats (`+3 ⚔️` au-dessus d'elle),
     et elle agrandit ton armée maximum. **Clique dessus pour l'améliorer** (3 niveaux) :

     | Niveau | Soldats produits | Bonus d'armée max | Force de **tous** tes soldats | Prix |
     |---|---|---|---|---|
     | 1. Camp d'entraînement | quelques-uns | un peu | **+10 %** | prix de la caserne |
     | 2. Caserne | +100 % | +100 % | **+20 %** | 💰 40 |
     | 3. Grande caserne | +75 % | +60 % | **+50 %** | 💰 100 |

     Une caserne ne fait pas dépasser l'armée maximum. Les soldats produits et l'armée max de toutes
     tes casernes s'additionnent.
     **La force des soldats** vaut pour tout le royaume dès **une seule** caserne de ce niveau
     (la meilleure compte, ça ne s'additionne pas) : au combat, chacun de tes soldats vaut 1,1 soldat
     (niveau 1), 1,2 soldat (niveau 2) ou 1,5 soldat (niveau 3), en attaque comme en défense.
     Tu ne vois que les chiffres de **tes** bâtiments, pas ceux des autres royaumes.
   - 🏰 **Château** : entoure les terres proches d'une **muraille** dessinée sur la carte.
     La muraille suit tes frontières sans déborder chez le voisin.
     Seules les cases à l'intérieur de la muraille sont renforcées : le bonus s'ajoute à la défense du terrain.
     **Clique sur un de tes châteaux pour l'améliorer** (3 niveaux) :

     | Niveau | Défense des murs | Muraille | Garnison | Prix |
     |---|---|---|---|---|
     | 1. Fort en bois | +100 % | petite | quelques soldats | prix du château |
     | 2. Château | +200 % | moyenne | +200 % | 💰 60 |
     | 3. Citadelle | +400 % | grande | +133 % | 💰 150 |

     **Routes** : un château de niveau 2 trace des **chemins de terre** 🛤️ vers tes moulins et casernes
     qui sont dans sa muraille : ils produisent **+20 %** (or des moulins, soldats des casernes).
     Au niveau 3, ce sont des **routes pavées** 🛣️ grises : **+50 %**.

     Exemple : une forêt (+60 %) protégée par une citadelle passe à +460 %.
   - ⛪ **Église** : elle coûte cher, mais **se construit n'importe où** sur ton territoire,
     **sauf trop près de tes châteaux** : elle doit rester hors de portée de leur muraille, même améliorée
     au maximum (quand tu places une église, un **cercle rouge** entoure chacun de tes châteaux).
     De même, un nouveau château ne peut pas être construit trop près d'une de tes églises.
     Elle permet de construire des **moulins ou casernes autour d'elle**, même hors de la muraille d'un château
     (quand tu choisis un moulin ou une caserne, sa zone s'affiche en pointillés clairs).
     Attention : elle **n'est pas défendue** (pas de bonus de défense, pas de garnison), et on peut
     **l'attaquer directement, comme un château** : clique sur une église ennemie pour lancer un assaut
     (il contourne les murailles des châteaux et s'arrête une fois l'église prise).
     **Clique dessus pour l'améliorer** (3 niveaux) :

     | Niveau | Moulins ou casernes autour d'elle | Châteaux en plus dans le royaume | Prix |
     |---|---|---|---|
     | 1. Église | 1 | aucun | 💰 50 (puis plus cher à chaque église) |
     | 2. Grande église | 2 | +1 | 💰 100 |
     | 3. Cathédrale | 5 | +2 | 💰 200 |

     **Chaque église améliorée** ajoute ses châteaux : elles s'additionnent, tu peux en construire autant
     que ton or le permet.

   - ⚓ **Port** : il coûte cher et se construit **au bord de la mer ou d'un fleuve**, avec les mêmes règles
     que l'église (hors de la zone de tes châteaux et de tes églises : cercles rouges). Il **n'est pas défendu** :
     on peut l'attaquer directement, comme un château. **Toutes les 10 secondes**, il rapporte de l'or.
     **Clique dessus pour l'améliorer** (3 niveaux) :

     | Niveau | Or produit | Moulins ou casernes autour | Expéditions maritimes | Prix |
     |---|---|---|---|---|
     | 1. Port | un peu | aucun | non | 💰 60 (puis plus cher à chaque port) |
     | 2. Grand port | +100 % | 1 | **oui** | 💰 120 |
     | 3. Port royal | +67 % | 3 | moitié prix, bateaux 80 % plus rapides, et une **petite garnison** (comme un fort en bois) | 💰 250 |

     Comme l'église, un port amélioré permet de construire des moulins ou casernes autour de lui.

     Zoome sur la carte pour voir apparaître l'image de chaque bâtiment !

   **⛵ Expéditions maritimes** (avec un port de niveau 2 ou 3) : fais un **clic droit** sur une côte
   (au bord de la mer ou d'un fleuve) et choisis **⛵ Débarquer**. Un bateau part de ton port le plus rapide,
   navigue sur la mer et les fleuves (tout le monde le voit passer), puis débarque : tu prends une **petite
   zone en demi-cercle le long de la côte** et tu y bâtis un **avant-poste ⛺**. L'expédition coûte un peu d'or
   (un peu plus à chaque avant-poste) et emmène **le % de soldats choisi** avec le curseur « Envoyer » :
   choisis bien avant de partir ! Une petite partie se perd en mer (1 % par seconde de traversée, 25 % au plus).
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
     on peut déjà l'attaquer, et ses défenseurs, occupés à bâtir, ont **-0,2 de défense**. Une fois bâti, il donne **+1 de défense** autour de lui, et **depuis lui**,
     tu peux attaquer les ennemis ou prendre des terres libres, comme depuis ton royaume.
   - Tant qu'il n'est pas relié par la terre à ton royaume, il ne compte **que sur ses soldats** (au-delà des
     mers, ton royaume ne peut pas lui envoyer de défenseurs ; une fois relié, ses soldats stationnés rejoignent
     ton armée) : clique sur
     ton avant-poste pour lui **envoyer des renforts par la mer** (depuis un port de niveau 2 ou plus).
     Les renforts qui arrivent sur un avant-poste **déjà bâti** complètent sa garnison, et les autres
     stationnent, tout de suite prêts à agir (pas de nouvelle construction à attendre).
   - Si un **château est bâti ou pris dans sa zone**, elle devient une vraie terre de ton royaume, qui partage
     ton armée : l'avant-poste disparaît et ses soldats rejoignent tes troupes.
   - Les ennemis peuvent **viser l'avant-poste** pour le détruire ; sans lui, ses terres sont à nouveau
     un petit morceau isolé, facile à encercler.
   - **⚓ Intercepter** : si un royaume a un **port** (n'importe quel niveau), il peut **cliquer sur le bateau**
     d'une expédition ennemie pour envoyer le % de soldats choisi à sa rencontre. Ses bateaux foncent vers la côte
     visée : s'ils y arrivent **avant** l'expédition, il y a **bataille en mer** à son arrivée (1 soldat contre 1,
     selon la force de chaque camp). Si l'escadre gagne, l'expédition est **coulée** et ses survivants rentrent ;
     sinon, l'expédition débarque quand même, avec moins de soldats. Tu es prévenu quand une expédition vise ta côte.

   **🖱️ Clic droit** sur la carte : un menu d'actions s'ouvre (⚔️ Attaquer · 🏗️ Construire · ⛵ Débarquer).
4. **Forme des pactes** : clique sur 🤝 à côté d'un royaume dans le classement pour lui proposer de t'allier.
   Les alliés forment un **pacte** (jusqu'à 3 royaumes) : si l'un d'eux est déjà dans un pacte, l'autre le rejoint.
   **On ne peut faire partie que d'un seul pacte** : impossible de s'allier avec un royaume d'un autre pacte.
   Les membres d'un pacte ne peuvent pas s'attaquer. Les royaumes peuvent aussi te proposer un pacte : accepte ou refuse.
   **Qui est allié avec qui ?** Chaque pacte est entouré d'une **grande frontière dorée**, visible par tous,
   qui fait le tour de tous ses membres. Les petits carrés de couleur dans le classement montrent aussi les alliés.
   Pour trahir un allié, attaque-le directement (ou clique sur 💔) : une confirmation t'est demandée,
   et tu quittes le pacte.
   Mais attention, un **traître** 🗡️ le paie cher pendant 2 minutes : **sa défense est réduite de moitié**
   (ses terres coûtent 2x moins de soldats à prendre), personne ne veut s'allier avec lui,
   et les autres royaumes en profitent pour l'attaquer !
5. **Gère ton armée et ton or** : tu commences petit, puis ton royaume grandit peu à peu.
   Tu as deux sortes de revenus : un **revenu de base**, continu, qui grandit avec ton territoire,
   et la **production de tes moulins et casernes**, versée toutes les 10 secondes.
   Le jeu ne montre **pas de chiffres précis** (pas de « +X par seconde ») : seulement des pourcentages.
   À toi de voir ce qui marche le mieux !
   La jauge en bas de l'écran montre tes soldats, et au-dessus si ton recrutement va bien.
   **Les garnisons sont fixes** : leurs soldats ne quittent jamais leur château, port ou avant-poste
   (ils ne servent qu'à le défendre ; pour attaquer, tu utilises tes soldats disponibles, ou ceux stationnés
   à un avant-poste). **Les soldats en garnison et stationnés** comptent aussi dans ton armée (la jauge les affiche) :
   ensemble, ils ne peuvent pas dépasser le maximum. Le recrutement est **le plus rapide vers 40 % du maximum** (trait doré sur la jauge),
   puis il **ralentit** si tu accumules trop de soldats, jusqu'à s'arrêter quand l'armée est pleine.
   Envoie donc tes troupes au combat plutôt que de les garder !
6. **Gagne** en possédant 85 % des terres, ou en éliminant tous les autres royaumes.
   Après la victoire, le bouton **Continuer** te laisse finir la conquête si tu veux.

🌲 Chaque terrain a sa défense : plaine normale, forêt +60 %, colline +120 %, montagne +250 %. Plus elle est haute, plus la case coûte de soldats **et de temps** à conquérir : ton royaume s'étend vite dans les plaines et lentement dans les forêts, collines et montagnes. Sa forme suit donc le relief !

🌊 **Les fleuves** naissent dans les montagnes et descendent jusqu'à la mer : ce sont des **frontières naturelles**.
Ils sont très longs à traverser, et un défenseur qui intercepte un ennemi sur un fleuve de son royaume
a un **gros bonus de défense (+3, soit +300 %)**. Il y a entre **3 et 12 fleuves** par partie, au hasard. On ne peut rien construire dessus.
Quand deux fleuves se rejoignent, le fleuve **double de largeur** ; quand un troisième les rejoint, il devient
un **grand fleuve** (3 cases de large, plus sombre) **infranchissable**, comme la mer.
Certains fleuves forment aussi un **lac** en chemin.

🏔️ **Les sommets** (le cœur blanc et enneigé des plus hautes montagnes) sont **infranchissables**, comme la mer :
il faut les contourner.

**Contrôles** : molette = zoom · glisser = déplacer la carte · `1` à `5` (ou `&` `é` `"` `'` `(`) = choisir un bâtiment (puis clic pour le poser) · clic droit = menu d'actions (attaquer, construire, débarquer) · `P` = pause · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

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

- 🤝 Plus de diplomatie : tributs en or, demandes d'aide aux membres du pacte
- 🗼 Nouveaux bâtiments : tours de guet
- 🌦️ Événements médiévaux : peste, famine, croisades, hivers rigoureux
- 👑 Héros ou rois avec des pouvoirs spéciaux
- 🌐 Multijoueur en ligne

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
| `js/game.js` | Règles : économie, attaques, victoire |
| `js/ai.js` | Le cerveau des royaumes adverses |
| `js/render.js` | Le dessin de la carte |
| `js/main.js` | Souris, clavier, boutons et boucle de jeu |
| `img/` | Les images des bâtiments (3 niveaux de château, de caserne, d'église et de port, 2 de moulin, et l'avant-poste) et des bannières (`img/bannieres/`) |
