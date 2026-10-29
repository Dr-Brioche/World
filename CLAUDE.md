# Medieval Emperor : notes pour Claude

- Jeu de conquête médiéval en HTML/CSS/JS pur (sans build, sans dépendances), inspiré d'OpenFront.
- Le projet est en français : commentaires, README et messages de commit en français.
- Le jeu est bilingue, **anglais par défaut** et français au choix (liste « Langue » du menu, voir `js/lang.js`) :
  tout texte affiché s'écrit `tr('texte français', 'English text')` ; dans les pages HTML, un texte court porte
  sa traduction dans `data-en` (`data-en-title`, `data-en-placeholder`, `data-en-label`, `data-en-value`) et un long passage existe
  en deux blocs `.fr` / `.en`. Les bannières ont un `id` fixe (le nom français) et un `name` traduit.
- **Aucun emoji dans le jeu** : tout ce qui s'affiche passe par des icônes dessinées, au style médiéval des autres
  (`js/icons.js`, grille 24 x 24). Un emoji écrit dans un texte n'est qu'un raccourci : il doit avoir son icône dans
  `ICON_DEFS` et sa ligne dans `EMOJI_ICONS` (sinon, en ajouter une). Pas d'emoji dans le CSS (`content:`) ni dessiné
  avec `fillText` sur la carte : utiliser un petit SVG ou `Icons.draw`. Dans les infobulles et les listes déroulantes,
  les emojis sont retirés automatiquement (`Icons.strip`).
  Une icône reste **entière dans son cadre 0–24, contour compris** (sinon elle est coupée) : vérifier en la dessinant en grand.
- Le joueur est débutant : garder un code simple et commenté, avec les réglages dans `js/config.js`.
- Les scripts sont chargés par des balises `<script>` classiques (pas de modules ES) pour que le jeu
  marche en ouvrant `index.html` d'un double-clic.
- Le jeu est publié via GitHub Pages depuis la branche `main` : https://dr-brioche.github.io/World/

## Toujours tenir le README à jour

`README.md` est la page d'accueil du projet sur GitHub. À chaque changement visible pour le joueur,
mettre à jour dans la même modification :
- la description et la section « Comment jouer » (nouveaux bâtiments, règles, contrôles…) ;
- la section « Nouveautés » (ajouter une ligne pour la nouvelle version) ;
- la section « Idées pour la suite » (retirer ce qui a été fait).
Garder le lien « JOUER MAINTENANT » en haut de la page.
