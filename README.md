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
- 👑 **Ton royaume** : choisis son nom et la couleur de ta bannière
- ⚔️ **La conquête** : attaque les terres voisines en choisissant combien de soldats envoyer
- 🏰 **Trois bâtiments** pour développer ton royaume
- 🤖 **5 à 10 royaumes rivaux** (Bourgogne, Aquitaine, Castille…) qui s'étendent, attaquent, s'allient et se trahissent tout seuls
- 🤝 **Des pactes** : allie-toi à d'autres royaumes… et trahis-les quand ça t'arrange
- 🎚️ **3 niveaux de difficulté** : Facile, Normal, Difficile

## 🕹️ Comment jouer

1. **Fonde ta capitale** : clique sur une terre au début de la partie.
2. **Étends-toi** : clique sur une terre voisine (libre ou ennemie) pour l'attaquer.
   Le curseur « Envoyer » choisit le % de tes soldats qui partent en campagne.
   Tes attaques en cours s'affichent en bas de l'écran avec leurs soldats :
   le bouton **✖ Annuler** fait rentrer les survivants au royaume.
   Les attaques ennemies contre toi y apparaissent aussi, en rouge.
   Contre un royaume, l'armée se **prépare pendant 5 secondes** avant d'attaquer :
   une ligne pointillée avec une bannière ⚔️ montre à tout le monde où elle va frapper.
   Les royaumes visés ont le temps de réagir… toi aussi !
   **Prendre un château** arrête l'assaut : ton armée finit de conquérir sa zone de défense
   (un peu élargie), puis rentre. Elle doit ensuite **récupérer 30 secondes** avant de pouvoir
   réattaquer ce royaume : une **trêve**, dont le temps restant s'affiche entre parenthèses sous le nom
   de ce royaume sur la carte, et en bas de l'écran. Pendant ces 30 secondes,
   ton **recrutement est divisé par 2**, et celui du royaume attaqué est **multiplié par 1.5**
   pour qu'il ait le temps de se défendre. La trêve vaut **dans les deux sens** : le royaume qui a perdu
   son château ne peut pas non plus contre-attaquer avant la fin. Les bots suivent la même règle.
3. **Construis** : appuie sur `1`, `2` ou `3` (ou clique sur un bouton en bas) : le bâtiment apparaît
   **sous ta souris**, puis **clique** pour le poser. Rappuie sur la même touche ou `Échap` pour annuler.
   Les moulins et casernes occupent **2x2 cases** de ton territoire, les châteaux **4x4 cases** (pas de mer).
   Il faut aussi laisser **2 cases d'écart** autour de chaque bâtiment (l'aperçu devient rouge si c'est trop près).
   Si un ennemi prend une seule de ces cases, il capture tout le bâtiment !
   - 🌾 **Moulin** : rapporte de l'or. **Clique dessus pour l'améliorer** (2 niveaux) :

     | Niveau | Or rapporté | Prix |
     |---|---|---|
     | 1. Moulin | +2.5 or/s | prix du moulin |
     | 2. Grand moulin | +6 or/s | 💰 400 |

   - ⚔️ **Caserne** : plus de soldats, recrutés plus vite. **Clique dessus pour l'améliorer** (3 niveaux) :

     | Niveau | Soldats max en plus | Recrutement en plus | Prix |
     |---|---|---|---|
     | 1. Camp d'entraînement | +1 500 | +30 % | prix de la caserne |
     | 2. Caserne | +3 000 | +50 % | 💰 400 |
     | 3. Grande caserne | +5 000 | +80 % | 💰 1000 |

     Les bonus de toutes tes casernes s'additionnent.
   - 🏰 **Château** : entoure les terres proches d'une **muraille** dessinée sur la carte.
     La muraille suit tes frontières sans déborder chez le voisin.
     Seules les cases à l'intérieur de la muraille sont renforcées : le bonus s'ajoute à la défense du terrain.
     **Clique sur un de tes châteaux pour l'améliorer** (3 niveaux) :

     | Niveau | Bonus de défense | Rayon de la muraille | Prix |
     |---|---|---|---|
     | 1. Fort en bois | +1 | 7 cases | prix du château |
     | 2. Château | +2 | 10 cases | 💰 600 |
     | 3. Citadelle | +4 | 13 cases | 💰 1500 |

     **Routes** : un château de niveau 2 trace des **chemins de terre** 🛤️ vers tes moulins et casernes
     qui sont dans sa muraille : ils produisent **+20 %** (or des moulins, recrutement des casernes).
     Au niveau 3, ce sont des **routes pavées** 🛣️ grises : **+50 %**.

     Exemple : une forêt (x1.6) protégée par une citadelle passe à x5.6.
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
5. **Gère ton armée** : la jauge en bas de l'écran montre tes soldats, et au-dessus combien tu en
   recrutes par seconde. Le recrutement est **le plus rapide vers 40 % du maximum** (trait doré sur la jauge),
   puis il **ralentit** si tu accumules trop de soldats, jusqu'à s'arrêter quand l'armée est pleine.
   Envoie donc tes troupes au combat plutôt que de les garder !
6. **Gagne** en possédant 85 % des terres, ou en éliminant tous les autres royaumes.
   Après la victoire, le bouton **Continuer** te laisse finir la conquête si tu veux.

🌲 Chaque terrain a sa défense : plaine x1, forêt x1.6, colline x2.2, montagne x3.5. Plus elle est haute, plus la case coûte de soldats **et de temps** à conquérir : ton royaume s'étend vite dans les plaines et lentement dans les forêts, collines et montagnes. Sa forme suit donc le relief !

**Contrôles** : molette = zoom · glisser = déplacer la carte · `1` `2` `3` = choisir un bâtiment (puis clic pour le poser) · `P` = pause · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

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
| `img/` | Les images des bâtiments (3 niveaux de château, 3 de caserne, 2 de moulin) |
