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
  effects: null,   // les petits sons en train de se jouer (ils se superposent, voir sound)
  held: false,     // ⏸ la partie est en pause : la musique d'ambiance aussi (voir hold)
  waiting: false,  // un morceau devait commencer pendant la pause : il commencera à la reprise

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
    const bar = document.getElementById('musicVol');
    if (bar) bar.value = Math.round(this.volume * 100);
    this.refreshButton();
    if (!this.on || !CONFIG.MUSIC.MENU || this.menuAudio) return;
    const a = this.menuAudio = new Audio(CONFIG.MUSIC.MENU);
    a.loop = true;
    a.volume = this.volume;
    // (refusée : on réessaie à chaque geste du joueur, jusqu'à ce qu'elle démarre vraiment. Sur un écran tactile,
    //  c'est le doigt levé qui autorise le son, pas le doigt posé : on écoute donc tous ces gestes.)
    const gestures = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'];
    const retry = () => {
      if (this.menuAudio !== a) return forget();
      if (a.paused) a.play().then(forget, () => { /* (pas encore autorisée : au prochain geste) */ });
    };
    const forget = () => { this.menuBlocked = false; gestures.forEach(g => removeEventListener(g, retry, true)); };
    a.play().catch(() => { this.menuBlocked = true; gestures.forEach(g => addEventListener(g, retry, true)); });
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
    // (dans le menu, la musique attendait le premier geste du joueur : ce clic sur 🎵 (ou la touche M) la lance,
    //  au lieu de la couper alors qu'on ne l'entendait pas encore)
    if (this.menuBlocked && this.menuAudio) return;
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
    if (this.menuAudio) this.menuAudio.volume = this.volume; // (la musique du menu suit tout de suite)
  },
  stop() {
    if (this.jingle) { this.jingle.pause(); this.jingle = null; }
    // (musique coupée : les petits sons aussi)
    if (!this.on && this.effects) { for (const a of this.effects) a.pause(); this.effects.clear(); }
    clearTimeout(this.timer); this.timer = null;
    clearInterval(this.fader); this.fader = null;
    this.waiting = false;
    if (this.audio) { this.audio.pause(); this.audio = null; }
  },

  // Un nouveau morceau, au hasard (pas le même que le précédent, s'il y en a d'autres)
  next() {
    this.stop();
    const list = CONFIG.MUSIC.TRACKS;
    if (!this.on || !list.length) return;
    if (this.held) { this.waiting = true; return; } // (⏸ partie en pause : il attendra la reprise)
    let k = Math.floor(Math.random() * list.length);
    if (list.length > 1 && k === this.last) k = (k + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    this.last = k;
    const a = this.audio = new Audio(list[k]);
    a.volume = 0;
    a.addEventListener('ended', () => this.afterTrack());
    a.addEventListener('error', () => this.afterTrack()); // (fichier introuvable : on passe au suivant, plus tard)
    // (lecture refusée par le navigateur : tant pis ; ou interrompue tout de suite par la pause : à la reprise)
    a.play().then(() => this.fade(), () => { if (this.audio === a) { this.audio = null; this.waiting = this.held; } });
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
  // Les sons se superposent (un nouveau son ne coupe pas celui qui joue) ; le même son ne revient pas avant SOUND_GAP
  // secondes, sauf ceux de SOUND_QUEUE (la construction) : plusieurs à la fois s'enchaînent, l'un après l'autre
  sound(key) {
    const M = CONFIG.MUSIC, src = M.SOUNDS[key], now = performance.now(), last = this.lastSound = this.lastSound || {};
    if (!this.on || !src) return;
    // (🔨 un son qui s'enchaîne, comme la construction : s'il en joue déjà un, celui-ci attend son tour, juste après)
    const Q = M.SOUND_QUEUE && M.SOUND_QUEUE[key];
    if (Q) {
      const next = this.nextSound = this.nextSound || {}, at = Math.max(now, next[key] || 0);
      if (at - now > Q.GAP * 1000 * Q.MAX) return; // (déjà trop en attente)
      next[key] = at + Q.GAP * 1000;
      if (at > now) { setTimeout(() => this.playSound(key, src), at - now); return; }
      return this.playSound(key, src);
    }
    if (now - (last[key] || -Infinity) < M.SOUND_GAP * 1000) return;
    last[key] = now;
    this.playSound(key, src);
  },
  // Joue le son key maintenant (et son écho, s'il en a un)
  playSound(key, src) {
    const M = CONFIG.MUSIC;
    if (!this.on) return;
    // (les sons se superposent : un nouveau son ne coupe pas le précédent ; on garde la liste de ceux qui jouent,
    //  pour pouvoir tous les couper avec la musique)
    this.effects = this.effects || new Set();
    this.playEffect(src, 1, 1);
    // (🔁 certains sons se rejouent aussitôt, un peu plus aigus : le bruit de construction fait « toc-toc », voir SOUND_ECHO)
    const echo = M.SOUND_ECHO && M.SOUND_ECHO[key];
    if (echo) setTimeout(() => { if (this.on) this.playEffect(src, echo.RATE, echo.GAIN); }, echo.DELAY * 1000);
  },
  // Joue un son une fois : rate = sa vitesse et sa hauteur (1 = telle quelle, plus = plus aigu), gain = son volume
  playEffect(src, rate, gain) {
    const M = CONFIG.MUSIC, a = new Audio(src);
    a.volume = Math.min(1, this.volume * M.VICTORY_GAIN * gain);
    a.playbackRate = rate;
    a.preservesPitch = false; // (sans ça, le navigateur garderait la même note en jouant plus vite)
    this.effects.add(a);
    a.addEventListener('ended', () => this.effects.delete(a));
    a.play().catch(() => { /* (lecture refusée par le navigateur : tant pis) */ });
  },
  // La partie continue après la victoire : la musique d'ambiance reprend (après un moment de silence)
  resume() {
    if (this.on && !this.audio && !this.timer) this.afterTrack();
  },

  // ⏸ La partie se met en pause (ou repart) : le morceau en cours s'arrête là où il en est, et reprend au même
  // endroit. Appelé à chaque image (voir main.js) : il ne fait quelque chose que quand la pause change.
  hold(h) {
    if (h === this.held) return;
    this.held = h;
    if (h) { if (this.audio) this.audio.pause(); return; }
    if (this.audio) this.audio.play().catch(() => {});
    else if (this.waiting) this.next();
  },

  // Le morceau est fini : un moment de silence (de durée tirée au hasard, voir PAUSE), puis le suivant
  afterTrack() {
    const [lo, hi] = CONFIG.MUSIC.PAUSE;
    this.stop();
    if (this.on) this.timer = setTimeout(() => { this.timer = null; this.next(); }, (lo + Math.random() * (hi - lo)) * 1000);
  },
};
