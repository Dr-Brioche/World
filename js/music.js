// 🎵 MUSIQUE D'AMBIANCE
// Pendant la partie, des morceaux choisis au hasard (CONFIG.MUSIC.TRACKS), en fondu, avec de temps en temps un moment
// de silence entre deux. Le bouton 🎵 de la barre du haut (ou la touche M) la coupe ou la remet ; ce choix est gardé
// dans le navigateur pour les parties suivantes.
// (Un navigateur ne joue pas de son avant que le joueur ait cliqué : la musique démarre avec la partie, au clic sur
// « Commencer ».)

const Music = {
  on: true,        // le joueur veut-il de la musique ?
  audio: null,     // le morceau en cours
  last: -1,        // le dernier morceau joué (pour ne pas le rejouer tout de suite)
  timer: null,     // le prochain morceau (après un silence)
  fader: null,

  // La partie commence : la musique démarre (si le joueur ne l'a pas coupée)
  start() {
    try { this.on = localStorage.getItem('medievalEmperor.music') !== 'off'; } catch (e) { this.on = true; }
    this.refreshButton();
    if (this.on && !this.audio && !this.timer) this.next();
  },

  // 🎵 / 🔇 : couper ou remettre la musique
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('medievalEmperor.music', this.on ? 'on' : 'off'); } catch (e) { /* (navigateur sans stockage) */ }
    this.refreshButton();
    if (this.on) this.next();
    else this.stop();
  },
  refreshButton() {
    const b = document.getElementById('musicBtn');
    if (!b) return;
    b.textContent = this.on ? '🎵' : '🔇'; // (l'emoji devient une icône dessinée : voir icons.js)
    b.title = this.on ? tr('Musique : clique pour la couper (touche M)', 'Music: click to turn it off (M key)')
      : tr('Musique coupée : clique pour la remettre (touche M)', 'Music off: click to turn it back on (M key)');
  },
  stop() {
    clearTimeout(this.timer); this.timer = null;
    clearInterval(this.fader); this.fader = null;
    if (this.audio) { this.audio.pause(); this.audio = null; }
  },

  // Un nouveau morceau, au hasard (pas le même que le précédent, s'il y en a d'autres)
  next() {
    this.stop();
    const list = CONFIG.MUSIC.TRACKS;
    if (!this.on || !list.length) return;
    let k = Math.floor(Math.random() * list.length);
    if (list.length > 1 && k === this.last) k = (k + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this.last = k;
    const a = this.audio = new Audio(list[k]);
    a.volume = 0;
    a.addEventListener('ended', () => this.afterTrack());
    a.addEventListener('error', () => this.afterTrack()); // (fichier introuvable : on passe au suivant, plus tard)
    a.play().then(() => this.fade(), () => { this.audio = null; }); // (lecture refusée par le navigateur : tant pis)
  },

  // Le volume monte en fondu au début, et redescend dans les FADE dernières secondes du morceau
  fade() {
    const M = CONFIG.MUSIC;
    clearInterval(this.fader);
    this.fader = setInterval(() => {
      const a = this.audio;
      if (!a) return;
      const t = a.currentTime, left = (a.duration || Infinity) - t;
      a.volume = M.VOLUME * Math.max(0, Math.min(1, t / M.FADE, left / M.FADE));
    }, 100);
  },

  // Le morceau est fini : souvent un moment de silence, sinon une courte pause, puis le suivant
  afterTrack() {
    const M = CONFIG.MUSIC, [lo, hi] = Math.random() < M.SILENCE_CHANCE ? M.SILENCE : M.GAP;
    this.stop();
    if (this.on) this.timer = setTimeout(() => { this.timer = null; this.next(); }, (lo + Math.random() * (hi - lo)) * 1000);
  },
};
