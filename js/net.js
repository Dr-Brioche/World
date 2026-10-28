// 🌐 PARTIES EN LIGNE (le côté du navigateur ; le serveur : serveur/serveur.js, le protocole : serveur/PROTOCOLE.md)
//
// Comment ça marche (comme OpenFront) : le serveur ne calcule pas la partie. Chaque navigateur la calcule de son côté,
// avec la même graine (donc la même carte et le même hasard) et les mêmes ordres, dans le même ordre : toutes les
// parties restent identiques. Le serveur sert de chef d'orchestre :
//  - il reçoit les ordres des joueurs (« attaquer ici », « construire là »…, voir Game.runOrder) ;
//  - TICKS_PER_SECOND fois par seconde (plus vite si la partie est accélérée), il envoie à tout le monde un « tour » :
//    la liste des ordres reçus depuis le tour d'avant ;
//  - chaque navigateur exécute les ordres du tour, puis fait avancer la partie d'un tour (Game.update).
// La pause et la vitesse sont donc décidées par le serveur (il n'envoie plus de tours, ou les envoie plus vite), selon
// les règles de la partie : salon privé = l'hôte décide (les autres ont droit à de courtes pauses) ; partie publique =
// personne ne met en pause.
// De temps en temps, chacun envoie l'« empreinte » de sa partie (Game.stateHash) : si elles diffèrent, les parties se
// sont désynchronisées (un bug à corriger !) et le serveur prévient tout le monde.

const Net = {
  ws: null,
  room: null,       // le salon où l'on attend : { code, public, host, you, players, settings, startsIn }
  game: null,       // la partie en cours : { slot, public, host, rules }
  turns: [],        // les tours reçus du serveur, pas encore joués
  turn: 0,          // le dernier tour joué
  seq: 0,           // numéro de nos ordres (pour retrouver leur message quand ils reviennent)
  waiting: new Map(), // numéro d'un de nos ordres → { done, before } (voir UI.act)

  // --- La connexion ---
  // L'adresse du serveur : ?serveur=… dans l'adresse de la page, sinon CONFIG.NET.SERVER, sinon le serveur qui a envoyé
  // la page (si elle vient d'un serveur : pas d'un fichier ouvert d'un double-clic)
  url() {
    const asked = new URLSearchParams(location.search).get('serveur');
    if (asked) return asked;
    if (CONFIG.NET.SERVER) return CONFIG.NET.SERVER;
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    }
    return null;
  },
  available() { return !!this.url() && typeof WebSocket !== 'undefined'; },

  // Se connecter (si ce n'est déjà fait), puis envoyer first (rejoindre la partie publique, créer un salon…)
  connect(first) {
    if (this.ws && this.ws.readyState <= 1) return this.send(first);
    const url = this.url();
    if (!url) return UI.netStatus(tr('🌐 Pas de serveur de jeu : le jeu en ligne marche quand la page vient du serveur (voir serveur/PROTOCOLE.md).',
      '🌐 No game server: online play works when the page comes from the server (see serveur/PROTOCOLE.md).'), 'warn');
    UI.netStatus(tr('🌐 Connexion au serveur…', '🌐 Connecting to the server…'));
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return UI.netStatus(tr('🌐 Adresse du serveur invalide.', '🌐 Invalid server address.'), 'warn'); }
    this.ws = ws;
    this.outbox = [first];
    ws.onopen = () => {
      this.send({ t: 'hello', protocol: CONFIG.NET.PROTOCOL, ...UI.netProfile() });
      for (const m of this.outbox) this.send(m);
      this.outbox = [];
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } this.onMessage(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.game) this.lost();
      else if (this.room) { this.room = null; UI.showRoom(null); }
      UI.netStatus(tr('🌐 Déconnecté du serveur.', '🌐 Disconnected from the server.'), 'warn');
    };
  },
  send(m) {
    if (!m) return;
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
    else if (this.ws && this.ws.readyState === 0) this.outbox.push(m);
  },

  // --- Le salon (avant la partie) ---
  joinPublic() { this.connect({ t: 'public' }); },
  createRoom() { this.connect({ t: 'create', settings: UI.netSettings() }); },
  joinRoom(code) { this.connect({ t: 'join', code: String(code).trim().toUpperCase() }); },
  leaveRoom() { this.send({ t: 'leave' }); this.room = null; UI.showRoom(null); },
  // (l'hôte change un réglage du salon : la carte, les bots…)
  sendSettings() { if (this.room && this.room.host === this.room.you) this.send({ t: 'settings', settings: UI.netSettings() }); },
  sendProfile() { if (this.room) this.send({ t: 'profile', ...UI.netProfile() }); },
  startRoom() { this.send({ t: 'start' }); },

  // --- Les messages du serveur ---
  onMessage(m) {
    switch (m.t) {
      case 'room': this.room = m; return UI.showRoom(m);
      case 'error': return UI.netStatus('🌐 ' + this.errorText(m), 'warn');
      case 'start': return this.start(m);
      case 'turn': this.turns.push(m); return;
      case 'pause': return this.onPause(m);
      case 'speed': return this.onSpeed(m.v);
      case 'host': // (l'hôte a quitté la partie : un autre joueur le remplace)
        if (!this.game) return;
        this.game.host = m.slot;
        UI.refreshHostButtons();
        if (m.slot === this.game.slot) UI.log(tr('👑 L\'hôte est parti : c\'est toi qui décides maintenant de la pause et de la vitesse.', '👑 The host left: you now decide on pause and speed.'), 'good');
        return;
      case 'desync':
        if (!this.desyncShown) {
          this.desyncShown = true;
          UI.log(tr('⚠️ Ta partie ne ressemble plus à celle des autres joueurs (désynchronisation) : ce qui s\'affiche chez toi peut être faux. C\'est un bug du jeu, désolé !',
            '⚠️ Your game no longer matches the other players\' (desync): what you see may be wrong. This is a bug in the game, sorry!'), 'warn');
        }
        return;
    }
  },
  errorText(m) {
    const T = {
      protocol: tr('Ta version du jeu ne correspond pas à celle du serveur : recharge la page.', 'Your version of the game does not match the server\'s: reload the page.'),
      noroom: tr('Aucun salon avec ce code.', 'No room with this code.'),
      started: tr('Cette partie a déjà commencé.', 'This game has already started.'),
      full: tr('Ce salon est plein.', 'This room is full.'),
      host: tr('Seul l\'hôte du salon peut faire ça.', 'Only the room host can do that.'),
      pause: tr(`Tu as déjà fait ta pause : la prochaine dans ${Math.ceil((m.wait || 0) / 1000)} s.`, `You already had your pause: the next one in ${Math.ceil((m.wait || 0) / 1000)} s.`),
      nopause: tr('Pas de pause dans une partie publique.', 'No pausing in a public game.'),
    };
    return T[m.code] || m.msg || m.code;
  },

  // La partie commence : tout le monde lance la même partie (même graine, mêmes réglages, mêmes joueurs)
  start(m) {
    this.room = null;
    this.game = { slot: m.me, public: m.public, host: m.host, rules: m.rules || {} };
    this.turns = [];
    this.turn = 0;
    this.waiting.clear();
    this.desyncShown = false;
    this.spawnTurns = m.spawnTurns;
    UI.startOnline(m);
  },

  // --- Pendant la partie ---
  isHost() { return !!this.game && !this.game.public && this.game.host === this.game.slot; },
  // Peut-on demander une pause ? (l'hôte : toujours ; les autres joueurs d'un salon privé : une courte, de temps en temps)
  canPause() { return !!this.game && !this.game.public; },

  // Un de nos ordres part au serveur ; il s'exécutera quand il reviendra, dans un tour (voir pump)
  sendOrder(o, done, before) {
    if (!this.game || !this.ws) return;
    const s = ++this.seq;
    if (done || before) this.waiting.set(s, { done, before });
    this.send({ t: 'order', s, o });
  },
  // (début de partie : on choisit sa place ; la partie commence pour tout le monde à la fin du compte à rebours)
  chooseSpawn(i) {
    if (Game.human.spawned) return;
    this.sendOrder({ k: 'spawn', i }, err => {
      if (err) return UI.log(err, 'warn');
      UI.log(tr('👑 Ta capitale est fondée ! La partie commence à la fin du compte à rebours.', '👑 Your capital is founded! The game starts when the countdown ends.'), 'good');
    });
  },
  togglePause() {
    if (!this.canPause()) return UI.log(this.errorText({ code: 'nopause' }), 'warn');
    this.send({ t: 'pause', on: !Game.paused });
  },
  nextSpeed() {
    if (!this.isHost()) return;
    // (on part de la dernière vitesse demandée : deux clics rapides font bien deux crans, sans attendre le serveur)
    const S = CONFIG.GAME_SPEEDS, k = S.indexOf(this.askedSpeed || Game.speed);
    this.askedSpeed = S[(k + 1) % S.length];
    this.send({ t: 'speed', v: this.askedSpeed });
  },
  onPause(m) {
    Game.paused = !!m.on;
    UI.refreshPauseButton();
    if (!m.on) return UI.log(tr('▶ La partie reprend.', '▶ The game resumes.'), 'good');
    const who = m.by >= 0 && Game.players[m.by] ? Game.players[m.by].name : tr('Le serveur', 'The server');
    UI.log(m.limit ? tr(`⏸ ${who} met la partie en pause (${Math.round(m.limit / 1000)} s au plus).`, `⏸ ${who} pauses the game (${Math.round(m.limit / 1000)} s at most).`)
      : tr(`⏸ ${who} met la partie en pause.`, `⏸ ${who} pauses the game.`), 'warn');
  },
  onSpeed(v) {
    Game.speed = v;
    this.askedSpeed = 0;
    $('speedBtn').textContent = `⏩ x${LANG === 'fr' ? String(v).replace('.', ',') : v}`;
  },

  // Joue les tours reçus (appelé à chaque image par la boucle du jeu, à la place de Game.update) : un tour =
  // ses ordres, puis un tour de jeu. En retard (l'onglet était caché…), on rattrape, sans figer l'écran trop longtemps.
  pump() {
    const t0 = performance.now();
    while (this.turns.length && performance.now() - t0 < 40) this.playTurn(this.turns.shift());
  },
  playTurn(m) {
    this.turn = m.n;
    for (const [slot, o, s] of m.o || []) {
      if (slot === this.game.slot && this.waiting.has(s)) {
        // (un de nos ordres : on affiche son résultat, comme en solo)
        const w = this.waiting.get(s);
        this.waiting.delete(s);
        if (o.k === 'spawn') { const err = Game.runOrder(slot, o); if (w.done) w.done(err); continue; }
        UI.runMine(o, w.done, w.before);
      } else {
        Game.runOrder(slot, o);
      }
    }
    if (Game.phase === 'playing') Game.update(); // (pendant le choix des places, la partie n'avance pas encore)
    if (m.n % CONFIG.NET.HASH_EVERY === 0) this.send({ t: 'hash', n: m.n, h: Game.stateHash() });
  },
  // Les secondes qui restent pour choisir sa place (début de partie)
  spawnLeft() { return Math.max(0, Math.ceil((this.spawnTurns - this.turn) / CONFIG.TICKS_PER_SECOND)); },

  // La connexion est perdue en pleine partie : elle continue en solo (les autres joueurs deviennent des bots)
  lost() {
    this.game = null;
    this.turns = [];
    if (Game.phase === 'spawn') Game.beginOnline();
    for (const p of Game.players) if (p.human && p !== Game.human) { p.human = false; p.aiTimer = 0; }
    Game.online = false;
    Game.paused = false;
    Game.speed = 1;
    UI.refreshPauseButton();
    UI.refreshHostButtons();
    UI.log(tr('🌐 La connexion au serveur est perdue : la partie continue en solo (les autres joueurs sont remplacés par des bots).',
      '🌐 The connection to the server was lost: the game goes on solo (the other players are replaced by bots).'), 'warn');
  },
};
