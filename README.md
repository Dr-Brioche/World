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
- 🤝 **Des alliances** : fais-toi des alliés… et trahis-les quand ça t'arrange
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
3. **Construis** (touches `1`, `2`, `3`, puis clic sur ton territoire).
   Les moulins et casernes occupent **2x2 cases** de ton territoire, les châteaux **4x4 cases** (pas de mer).
   Il faut aussi laisser **2 cases d'écart** autour de chaque bâtiment (l'aperçu devient rouge si c'est trop près).
   Si un ennemi prend une seule de ces cases, il capture tout le bâtiment !
   - 🌾 **Moulin** : rapporte de l'or. **Clique dessus pour l'améliorer** (2 niveaux) :

     | Niveau | Or rapporté | Prix |
     |---|---|---|
     | 1. Moulin | +2.5 or/s | prix du moulin |
     | 2. Grand moulin | +6 or/s | 💰 400 |

   - ⚔️ **Caserne** : plus de soldats, recrutés plus vite
   - 🏰 **Château** : entoure les terres proches d'une **muraille** dessinée sur la carte.
     La muraille suit tes frontières sans déborder chez le voisin.
     Seules les cases à l'intérieur de la muraille sont renforcées : le bonus s'ajoute à la défense du terrain.
     **Clique sur un de tes châteaux pour l'améliorer** (3 niveaux) :

     | Niveau | Bonus de défense | Rayon de la muraille | Prix |
     |---|---|---|---|
     | 1. Fort en bois | +1 | 7 cases | prix du château |
     | 2. Château | +2 | 10 cases | 💰 600 |
     | 3. Citadelle | +4 | 13 cases | 💰 1500 |

     Exemple : une forêt (x1.6) protégée par une citadelle passe à x5.6.
     Zoome sur la carte pour voir apparaître l'image de chaque château et de chaque moulin !
4. **Fais des alliances** : clique sur 🤝 à côté d'un royaume dans le classement pour lui proposer une alliance.
   Les alliés ne peuvent pas s'attaquer. Les royaumes peuvent aussi te proposer une alliance : accepte ou refuse.
   Pour trahir un allié, attaque-le directement (ou clique sur 💔) : une confirmation t'est demandée.
   Mais attention, un **traître** 🗡️ le paie cher pendant 2 minutes : **sa défense est réduite de moitié**
   (ses terres coûtent 2x moins de soldats à prendre), personne ne veut s'allier avec lui,
   et les autres royaumes en profitent pour l'attaquer !
5. **Gagne** en possédant 60 % des terres, ou en éliminant tous les autres royaumes.

🌲 Chaque terrain a sa défense : plaine x1, forêt x1.6, colline x2.2, montagne x3.5. Plus elle est haute, plus la case coûte de soldats à conquérir.

**Contrôles** : molette = zoom · glisser = déplacer la carte · `P` = pause · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

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
- 🤝 Plus de diplomatie : trêves, tributs en or, demandes d'aide aux alliés
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
| `img/` | Les images des bâtiments (3 niveaux de château, 2 niveaux de moulin) |
