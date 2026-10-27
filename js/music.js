// 🎵 MUSIQUE D'AMBIANCE
// Pendant la partie, des morceaux choisis au hasard (CONFIG.MUSIC.TRACKS), en fondu, avec toujours un moment
// de silence (de durée tirée au hasard) entre deux. Le bouton 🎵 en bas à droite (ou la touche M) la coupe ou la
// remet, et la petite barre à côté règle son volume ; ces choix sont gardés dans le navigateur pour les parties
// suivantes.
// (Un navigateur ne joue pas de son avant que le joueur ait cliqué : la musique démarre avec la partie, au clic sur
// « Commencer ».)

const Music = {
  on: true,        // le joueur veut-il de la musique ?
  volume: 0,       // son volume (de 0 à 1 ; au départ CONFIG.MUSIC.VOLUME, puis celui de la petite barre)
  audio: null,     // le morceau en cours
  last: -1,        // le dernier morceau joué (pour ne pas le rejouer tout de suite)
  timer: null,     // le prochain morceau (après un silence)
  fader: null,
  jingle: null,    // le son de la victoire, quand il se joue
  effect: null,    // le petit son en train de se jouer (voir sound)

  // Les choix du joueur, gardés dans le navigateur : musique coupée ou non, et son volume
  loadPrefs() {
    try { this.on = localStorage.getItem('medievalEmperor.music') !== 'off'; } catch (e) { this.on = true; }
    let v = null;
    try { v = localStorage.getItem('medievalEmperor.musicVolume'); } catch (e) { /* (navigateur sans stockage) */ }
    this.volume = v !== null && !isNaN(+v) ? +v : CONFIG.MUSIC.VOLUME;
  },

  // 🏰 La musique du menu de départ : en boucle tant qu'on est dans le menu (voir stopMenu). Un navigateur ne joue
  // pas de son avant le premier geste du joueur : si elle est refusée, elle démarre à son premier clic ou à sa
  // première touche.
  menu() {
    this.loadPrefs();
    if (!this.on || !CONFIG.MUSIC.MENU || this.menuAudio) return;
    const a = this.menuAudio = new Audio(CONFIG.MUSIC.MENU);
    a.loop = true;
    a.volume = this.volume;
    a.play().catch(() => {
      const retry = () => {
        removeEventListener('pointerdown', retry, true);
        removeEventListener('keydown', retry, true);
        if (this.menuAudio === a) a.play().catch(() => { /* (toujours refusée : tant pis) */ });
      };
      addEventListener('pointerdown', retry, true);
      addEventListener('keydown', retry, true);
    });
  },
  // La musique du menu s'arrête, en fondu rapide (la partie commence, ou le joueur coupe la musique)
  stopMenu() {
    const a = this.menuAudio;
    if (!a) return;
    this.menuAudio = null;
    // (le fondu compte à partir de son premier pas : la création de la carte, juste après, occupe le navigateur
    //  un moment ; la musique continue pendant ce temps, puis s'éteint en douceur)
    const v0 = a.volume;
    let t0 = null;
    const fade = setInterval(() => {
      if (t0 === null) t0 = performance.now();
      const k = (performance.now() - t0) / (CONFIG.MUSIC.MENU_FADE * 1000);
      if (k >= 1) { clearInterval(fade); a.pause(); } else a.volume = v0 * (1 - k);
    }, 50);
  },

  // La partie commence : la musique du menu s'arrête, et la musique d'ambiance démarre (si le joueur ne l'a pas coupée)
  start() {
    this.stopMenu();
    this.loadPrefs();
    const bar = document.getElementById('musicVol');
    if (bar) bar.value = Math.round(this.volume * 100);
    this.refreshButton();
    if (this.on && !this.audio && !this.timer) this.next();
  },

  // 🎵 / 🔇 : couper ou remettre la musique
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('medievalEmperor.music', this.on ? 'on' : 'off'); } catch (e) { /* (navigateur sans stockage) */ }
    this.refreshButton();
    if (!this.on) { this.stop(); this.stopMenu(); }
    else if (Game.phase === 'menu') this.menu(); // (dans le menu de départ : sa musique à lui)
    else this.next();
  },
  refreshButton() {
    const b = document.getElementById('musicBtn');
    if (!b) return;
    b.textContent = this.on ? '🎵' : '🔇'; // (l'emoji devient une icône dessinée : voir icons.js)
    b.title = this.on ? tr('Musique : clique pour la couper (touche M)', 'Music: click to turn it off (M key)')
      : tr('Musique coupée : clique pour la remettre (touche M)', 'Music off: click to turn it back on (M key)');
  },
  // La petite barre de volume (de 0 à 100) : le morceau en cours change tout de suite de volume
  setVolume(pct) {
    this.volume = Math.max(0, Math.min(1, pct / 100));
    try { localStorage.setItem('medievalEmperor.musicVolume', String(this.volume)); } catch (e) { /* (navigateur sans stockage) */ }
  },
  stop() {
    if (this.jingle) { this.jingle.pause(); this.jingle = null; }
    if (!this.on && this.effect) { this.effect.pause(); this.effect = null; } // (musique coupée : les petits sons aussi)
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
      a.volume = this.volume * Math.max(0, Math.min(1, t / M.FADE, left / M.FADE));
    }, 100);
  },

  // 🏆 La partie est gagnée : la musique d'ambiance s'arrête, et le son de la victoire se joue une fois (rien si le
  // joueur a coupé la musique). La musique d'ambiance ne reprend que s'il continue la partie (voir resume).
  victory() {
    this.stop();
    if (!this.on || !CONFIG.MUSIC.VICTORY) return;
    const a = this.jingle = new Audio(CONFIG.MUSIC.VICTORY);
    a.volume = Math.min(1, this.volume * CONFIG.MUSIC.VICTORY_GAIN);
    a.addEventListener('ended', () => { if (this.jingle === a) this.jingle = null; });
    a.play().catch(() => { this.jingle = null; });
  },
  // 🔔 Un petit son du jeu (voir CONFIG.MUSIC.SOUNDS), par-dessus la musique d'ambiance (rien si le joueur a coupé
  // la musique, ni si le même son vient de se jouer)
  // Un seul petit son à la fois : un son qui arrive pendant qu'un autre joue le coupe net et démarre tout de suite
  // (plusieurs événements d'un coup s'enchaînent ainsi sans attendre)
  sound(key) {
    const M = CONFIG.MUSIC, src = M.SOUNDS[key], now = performance.now(), last = this.lastSound = this.lastSound || {};
    if (!this.on || !src || now - (last[key] || -Infinity) < M.SOUND_GAP * 1000) return;
    last[key] = now;
    if (this.effect) this.effect.pause(); // (le son précédent est coupé net)
    const a = this.effect = new Audio(src);
    a.volume = Math.min(1, this.volume * M.VICTORY_GAIN);
    a.addEventListener('ended', () => { if (this.effect === a) this.effect = null; });
    a.play().catch(() => { /* (lecture refusée par le navigateur : tant pis) */ });
  },
  // La partie continue après la victoire : la musique d'ambiance reprend (après un moment de silence)
  resume() {
    if (this.on && !this.audio && !this.timer) this.afterTrack();
  },

  // Le morceau est fini : un moment de silence (de durée tirée au hasard, voir PAUSE), puis le suivant
  afterTrack() {
    const [lo, hi] = CONFIG.MUSIC.PAUSE;
    this.stop();
    if (this.on) this.timer = setTimeout(() => { this.timer = null; this.next(); }, (lo + Math.random() * (hi - lo)) * 1000);
  },
};
