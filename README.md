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

- 🗺️ **Une carte différente à chaque partie** : plaines, forêts, collines, montagnes et mers
- 👑 **Ton royaume** : choisis son nom et sa **bannière** parmi 14 (elle donne sa couleur à ton royaume)
- ⚔️ **La conquête** : attaque les terres voisines en choisissant combien de soldats envoyer
- 🏰 **Trois bâtiments** pour développer ton royaume
- 🤖 **5 à 10 royaumes rivaux** (Bourgogne, Aquitaine, Castille…) qui s'étendent, attaquent, s'allient et se trahissent tout seuls
- 🤝 **Des pactes** : allie-toi à d'autres royaumes… et trahis-les quand ça t'arrange
- 🎚️ **3 niveaux de difficulté** : Facile, Normal, Difficile

## 🕹️ Comment jouer

1. **Fonde ta capitale** : choisis ta bannière dans le menu, puis clique sur une terre au début de la partie.
   Chaque royaume a sa bannière : elle s'affiche à côté de son nom (carte, classement, barre du haut),
   porte ses armées, et accompagne les messages pour reconnaître tout de suite qui fait quoi.
2. **Étends-toi** : clique sur une terre libre voisine pour t'en emparer.
   **Pour attaquer un royaume, clique sur un de ses châteaux 🏰** : ton armée se fraie un chemin depuis ta
   frontière en **contournant ses autres fortifications**, capture tout sur son passage, puis prend le château.
   En survolant un château ennemi, tu vois le chemin prévu (pointillés dorés). Si le château est en arrière-pays,
   derrière d'autres zones de défense, il est **inaccessible** (croix rouge) : prends d'abord les châteaux
   de la frontière. Quand un royaume n'a **plus aucun château**, tu peux attaquer tout son territoire de front.
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
3. **Construis** : appuie sur `1`, `2` ou `3` (ou `&`, `é`, `"` sur un clavier AZERTY, ou clique sur un bouton en bas) : le bâtiment apparaît
   **sous ta souris**, puis **clique** pour le poser. Rappuie sur la même touche ou `Échap` pour annuler.
   Les moulins et casernes occupent **2x2 cases** de ton territoire, les châteaux **4x4 cases** (pas de mer).
   **Tu peux construire au maximum 3 châteaux par partie** (capitale comprise) ; les châteaux pris à l'ennemi
   ne comptent pas dans cette limite.
   **Le terrain compte** : un moulin produit plus en plaine (+30 %) qu'en forêt (normal), colline (-10 %) ou montagne (-30 %) ;
   une caserne produit plus en forêt ou colline (+30 %) qu'en plaine (normal) ou montagne (-10 %).
   Pendant la construction, l'info en bas à gauche indique la production prévue à cet endroit.
   **Les moulins et casernes se construisent uniquement dans l'enceinte d'un de tes châteaux** (dans sa muraille),
   pas dans l'arrière-pays. Les châteaux, eux, se construisent partout sur ton territoire.
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

     | Niveau | Soldats produits | Bonus d'armée max | Prix |
     |---|---|---|---|
     | 1. Camp d'entraînement | quelques-uns | un peu | prix de la caserne |
     | 2. Caserne | +100 % | +100 % | 💰 40 |
     | 3. Grande caserne | +75 % | +60 % | 💰 100 |

     Une caserne ne fait pas dépasser l'armée maximum. Les bonus de toutes tes casernes s'additionnent.
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
     Zoome sur la carte pour voir apparaître l'image de chaque bâtiment !
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
   La jauge en bas de l'écran montre tes soldats, et au-dessus si ton recrutement va bien. Le recrutement est **le plus rapide vers 40 % du maximum** (trait doré sur la jauge),
   puis il **ralentit** si tu accumules trop de soldats, jusqu'à s'arrêter quand l'armée est pleine.
   Envoie donc tes troupes au combat plutôt que de les garder !
6. **Gagne** en possédant 85 % des terres, ou en éliminant tous les autres royaumes.
   Après la victoire, le bouton **Continuer** te laisse finir la conquête si tu veux.

🌲 Chaque terrain a sa défense : plaine normale, forêt +60 %, colline +120 %, montagne +250 %. Plus elle est haute, plus la case coûte de soldats **et de temps** à conquérir : ton royaume s'étend vite dans les plaines et lentement dans les forêts, collines et montagnes. Sa forme suit donc le relief !

**Contrôles** : molette = zoom · glisser = déplacer la carte · `1` `2` `3` (ou `&` `é` `"`) = choisir un bâtiment (puis clic pour le poser) · `P` = pause · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

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

- ⛵ Bateaux pour traverser la mer
- 🤝 Plus de diplomatie : tributs en or, demandes d'aide aux membres du pacte
- 🗼 Nouveaux bâtiments : tours de guet, ports, cathédrales
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
| `img/` | Les images des bâtiments (3 niveaux de château, 3 de caserne, 2 de moulin) et des bannières (`img/bannieres/`) |
