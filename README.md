# ⚔️ World

**Un petit jeu de conquête médiévale, jouable directement dans le navigateur.**

Inspiré d'OpenFront, mais à la sauce médiévale : fonde ta capitale, étends ton royaume case par case,
bâtis fermes, casernes et châteaux, et écrase les royaumes rivaux pour dominer le continent !

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
- 🤖 **5 à 10 royaumes rivaux** (Bourgogne, Aquitaine, Castille…) qui s'étendent et attaquent tout seuls
- 🎚️ **3 niveaux de difficulté** : Facile, Normal, Difficile

## 🕹️ Comment jouer

1. **Fonde ta capitale** : clique sur une terre au début de la partie.
2. **Étends-toi** : clique sur une terre voisine (libre ou ennemie) pour l'attaquer.
   Le curseur « Envoyer » choisit le % de tes soldats qui partent en campagne.
3. **Construis** (touches `1`, `2`, `3`, puis clic sur ton territoire) :
   - 🌾 **Ferme** : rapporte de l'or
   - ⚔️ **Caserne** : plus de soldats, recrutés plus vite
   - 🏰 **Château** : les cases autour coûtent 2x plus cher à prendre
4. **Gagne** en possédant 60 % des terres, ou en éliminant tous les autres royaumes.

🌲 Les forêts, collines et montagnes coûtent plus de soldats à conquérir que les plaines.

**Contrôles** : molette = zoom · glisser = déplacer la carte · `P` = pause · `Échap` / clic droit = annuler une construction

## 🆕 Nouveautés

- **v0.1** : première version jouable (carte aléatoire, conquête, or, 3 bâtiments, royaumes rivaux, victoire/défaite)

## 💡 Idées pour la suite

- ⛵ Bateaux pour traverser la mer
- 🤝 Diplomatie : alliances, trêves, trahisons
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
