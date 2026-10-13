# ⚔️ Royaumes en Guerre

Un petit jeu de conquête médiévale dans le navigateur, inspiré d'OpenFront.
Étends ton royaume, bâtis des fermes, des casernes et des châteaux, et écrase les royaumes rivaux !

## ▶️ Jouer

Ouvre simplement `index.html` dans ton navigateur (double-clic). Rien à installer.

## 🎮 Comment jouer

- **Début** : clique sur une terre pour fonder ta capitale.
- **Attaquer / s'étendre** : clique sur une terre voisine (libre ou ennemie). Le curseur « Envoyer » choisit le % de tes soldats envoyés.
- **Terrain** : les forêts, collines et montagnes coûtent plus cher à conquérir.
- **Bâtiments** (touches `1`, `2`, `3`, puis clic sur ton territoire) :
  - 🌾 **Ferme** : rapporte de l'or
  - ⚔️ **Caserne** : plus de soldats et un recrutement plus rapide
  - 🏰 **Château** : les cases autour coûtent 2x plus cher à prendre
- **Victoire** : posséder 60 % des terres ou éliminer tous les autres royaumes.
- **Contrôles** : molette = zoom, glisser = déplacer la carte, `P` = pause, `Échap` = annuler une construction.

## 🛠️ Le mettre à ta sauce

Tous les réglages sont dans **`js/config.js`** : taille de la carte, vitesse, coûts,
noms et couleurs des royaumes, difficulté… Change un chiffre, recharge la page, et teste !

## 📁 Organisation du code

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

## 💡 Idées pour la suite

- ⛵ Bateaux pour traverser la mer
- 🤝 Diplomatie : alliances, trêves, trahisons
- 🗼 Nouveaux bâtiments : tours de guet, ports, cathédrales
- 🌦️ Événements médiévaux : peste, famine, croisades, hivers rigoureux
- 👑 Héros ou rois avec des pouvoirs spéciaux
- 🌐 Multijoueur en ligne (le plus gros chantier !)
