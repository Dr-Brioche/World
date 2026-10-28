// 🌍 LANGUE DU JEU
// Le jeu existe en anglais (la langue par défaut) et en français. La langue se choisit en haut à droite du menu de
// départ ; elle est gardée dans le navigateur, et en changer recharge la page.
//  - Dans le code, chaque texte affiché s'écrit dans les deux langues, côte à côte : tr('Bonjour', 'Hello').
//  - Dans les pages HTML : un texte court porte sa traduction anglaise dans data-en :
//      <span data-en="Map">Carte</span>   (le français est écrit dans la page ; en anglais, il est remplacé)
//    et un long passage existe deux fois : <div class="fr">…</div><div class="en">…</div> (seul le bon s'affiche).
// Ce fichier est chargé avant tous les autres.

const LANG_KEY = 'medievalEmperor.lang'; // (nom de la boîte où le navigateur garde la langue choisie)
const LANG = (() => {
  try { return localStorage.getItem(LANG_KEY) === 'fr' ? 'fr' : 'en'; } catch (e) { return 'en'; }
})();

// Le texte dans la langue du jeu
function tr(fr, en) { return LANG === 'fr' ? fr : en; }

// Change de langue (la page se recharge, pour tout réécrire dans la nouvelle langue)
function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* (navigateur sans stockage : on garde l'anglais) */ }
  location.reload();
}

// Les pages HTML : la classe lang-en ou lang-fr sur <html> cache les passages de l'autre langue (voir style.css),
// et les textes courts (data-en) sont remplacés par leur version anglaise
document.documentElement.lang = LANG;
document.documentElement.classList.add('lang-' + LANG);
function translatePage(root = document) {
  if (LANG !== 'en') return;
  for (const el of root.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en;
  for (const el of root.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for (const el of root.querySelectorAll('[data-en-placeholder]')) el.placeholder = el.dataset.enPlaceholder;
  for (const el of root.querySelectorAll('[data-en-label]')) el.label = el.dataset.enLabel; // (titres des groupes d'une liste)
  for (const el of root.querySelectorAll('[data-en-value]')) el.value = el.dataset.enValue; // (texte déjà écrit dans un champ)
}
// (ce fichier est chargé en bas de la page : elle est déjà là, on la traduit tout de suite, avant les autres scripts)
// (document.readyState vaut encore « loading » à ce moment-là : on ne l'attend pas, sinon le menu, construit juste
//  après par main.js, recopierait les textes encore en français, comme le nom de la carte choisie)
if (document.body) translatePage();
else document.addEventListener('DOMContentLoaded', () => translatePage());
