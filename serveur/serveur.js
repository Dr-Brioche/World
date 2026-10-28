// 🌐 SERVEUR DE JEU DE MEDIEVAL EMPEROR (serveur de référence)
//
// Un petit serveur, sans aucune dépendance (juste Node.js, version 18 ou plus) :
//  - il envoie les fichiers du jeu (index.html, js/, img/, sons/…) : le jeu s'ouvre sur http://localhost:8080 ;
//  - il fait jouer les parties en ligne, par WebSocket sur /ws (voir PROTOCOLE.md) : la partie publique, qui part
//    toutes les 2 minutes avec tous ceux qui attendent, et les salons privés (avec un code, l'hôte choisit les réglages).
//
// Le serveur ne calcule pas la partie : chaque navigateur la calcule de son côté (voir js/net.js). Lui, il donne la
// même graine à tout le monde, rassemble les ordres des joueurs et les renvoie à tous dans des « tours », au rythme
// de la partie (10 tours par seconde à vitesse x1). C'est aussi lui qui fait respecter les règles de la pause.
//
// Lancer :   node serveur/serveur.js         (puis ouvrir http://localhost:8080)
// Réglages : PORT=3000 node serveur/serveur.js   (ou les constantes juste en dessous)
//            PUBLIC_SECONDS=20 node serveur/serveur.js   (une partie publique toutes les 20 s : pratique pour essayer)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Réglages ---
const PORT = +process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..'); // (les fichiers du jeu : le dossier au-dessus de serveur/)
const PROTOCOL = 1;                       // (doit être le même que CONFIG.NET.PROTOCOL dans js/config.js)
const TPS = 10;                           // tours par seconde à vitesse x1 (CONFIG.TICKS_PER_SECOND)
const SPEEDS = [1, 1.5, 2, 3];            // vitesses possibles (CONFIG.GAME_SPEEDS)
const PUBLIC_EVERY = (+process.env.PUBLIC_SECONDS || 120) * 1000; // une partie publique part toutes les 2 minutes…
const PUBLIC_KINGDOMS = 10;               // … avec des bots pour arriver à 10 royaumes en tout (s'il y a moins de joueurs)
const MAX_PLAYERS = 16;                   // joueurs humains au plus dans une partie
const SPAWN_TIME = 15;                    // secondes pour choisir où fonder sa capitale
const PAUSE_TIME = 15 * 1000;             // salon privé : un joueur (pas l'hôte) met en pause 15 s au plus…
const PAUSE_EVERY = 5 * 60 * 1000;        // … une fois toutes les 5 minutes
const HASH_KEEP = 2000;                   // tours pendant lesquels on garde les empreintes reçues (pour les comparer)
const MAPS = ['normal', 'continental', 'naval', 'world', 'europe', 'azeroth']; // (CONFIG.NET.MAPS)
const PUBLIC_MAPS = MAPS;                 // cartes tirées au hasard pour la partie publique
const SIZES = ['petit', 'moyen', 'grand'];
const DIFFICULTIES = ['facile', 'normal', 'difficile'];

// ============================================================================================================
// 1. Les fichiers du jeu (un tout petit serveur web)
// ============================================================================================================
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  // (pas de fichier hors du dossier du jeu, ni de fichier caché comme .git)
  if (!file.startsWith(ROOT + path.sep) || url.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 : introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

// ============================================================================================================
// 2. WebSocket, écrit à la main (la norme RFC 6455, en version simple : des messages texte)
// ============================================================================================================
let nextConnId = 1;
const conns = new Set();
server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key']) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  // (la poignée de main : on prouve au navigateur qu'on parle WebSocket)
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const conn = { id: nextConnId++, socket, buf: Buffer.alloc(0), parts: [], alive: true, hello: false,
    name: 'Royaume', banner: 0, room: null };
  conns.add(conn);
  socket.on('data', data => { conn.buf = Buffer.concat([conn.buf, data]); readFrames(conn); });
  socket.on('close', () => dropConn(conn));
  socket.on('error', () => dropConn(conn));
});

// Lit les « trames » WebSocket reçues (un message peut arriver en plusieurs morceaux, ou plusieurs d'un coup)
function readFrames(conn) {
  for (;;) {
    const b = conn.buf;
    if (b.length < 2) return;
    const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, at = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); at = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); at = 10; }
    if (len > 1 << 20) return closeConn(conn); // (un message de plus d'1 Mo : ce n'est pas notre jeu)
    if (!masked) return closeConn(conn);       // (un navigateur masque toujours ses trames)
    if (b.length < at + 4 + len) return;
    const mask = b.subarray(at, at + 4), data = Buffer.from(b.subarray(at + 4, at + 4 + len));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    conn.buf = b.subarray(at + 4 + len);
    if (op === 0x8) return closeConn(conn);                // fermeture
    if (op === 0x9) { sendFrame(conn, 0xA, data); continue; } // ping → pong
    if (op === 0xA) { conn.alive = true; continue; }          // pong
    if (op === 0x1 || op === 0x0) {                           // texte (ou suite d'un message en morceaux)
      conn.parts.push(data);
      if (!fin) continue;
      const text = Buffer.concat(conn.parts).toString('utf8');
      conn.parts = [];
      let msg;
      try { msg = JSON.parse(text); } catch (e) { continue; }
      if (msg && typeof msg === 'object') {
        try { onMessage(conn, msg); } catch (e) { console.error('Erreur sur un message :', e); }
      }
    }
  }
}
function sendFrame(conn, op, data) {
  if (conn.socket.destroyed) return;
  const n = data.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n])
    : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255])
      : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const x = Buffer.alloc(8); x.writeBigUInt64BE(BigInt(n)); return x; })()]);
  conn.socket.write(Buffer.concat([head, data]));
}
function send(conn, msg) { if (conn) sendFrame(conn, 0x1, Buffer.from(JSON.stringify(msg))); }
function closeConn(conn) {
  try { sendFrame(conn, 0x8, Buffer.alloc(0)); conn.socket.end(); } catch (e) { /* (déjà fermée) */ }
  dropConn(conn);
}
function dropConn(conn) {
  if (!conns.has(conn)) return;
  conns.delete(conn);
  leaveRoom(conn);
  if (!conn.socket.destroyed) conn.socket.destroy();
}
// (toutes les 30 s, on vérifie que chacun est encore là : un navigateur répond toujours à un « ping »)
setInterval(() => {
  for (const c of conns) {
    if (!c.alive) { closeConn(c); continue; }
    c.alive = false;
    sendFrame(c, 0x9, Buffer.alloc(0));
  }
}, 30000);

// ============================================================================================================
// 3. Les salons et les parties
// ============================================================================================================
// Un salon : { code, public, host (id de connexion, null pour la partie publique), members (connexions), settings,
//   startsAt (partie publique : quand elle part), game (la partie, une fois lancée) }
const rooms = new Map(); // code → salon
let publicRoom = null;

const clampName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Royaume';
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Un code de salon : 4 lettres faciles à lire et à dicter (pas de O ni de 0, de I ni de 1…)
function newCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let c = '';
    for (let k = 0; k < 4; k++) c += L[Math.floor(Math.random() * L.length)];
    if (!rooms.has(c)) return c;
  }
}
// Les réglages d'une partie, vérifiés (un navigateur peut envoyer n'importe quoi)
function cleanSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    mapType: MAPS.includes(s.mapType) ? s.mapType : 'normal',
    mapSize: SIZES.includes(s.mapSize) ? s.mapSize : 'moyen',
    pacts: !!s.pacts,
    difficulty: DIFFICULTIES.includes(s.difficulty) ? s.difficulty : 'normal',
    opponents: Math.max(0, Math.min(30, s.opponents | 0)),
  };
}
// La prochaine partie publique : une carte au hasard
function openPublicRoom() {
  publicRoom = {
    code: newCode(), public: true, host: null, members: [], game: null, startsAt: Date.now() + PUBLIC_EVERY,
    settings: { mapType: pick(PUBLIC_MAPS), mapSize: pick(['moyen', 'grand']), pacts: Math.random() < 0.5, difficulty: 'normal', opponents: 0 },
  };
  rooms.set(publicRoom.code, publicRoom);
  broadcastRoom(publicRoom);
}

// Les noms des joueurs, sans doublon : le 2e « Valdor » devient « Valdor II », le 3e « Valdor III »…
function uniqueNames(members) {
  const seen = new Map(), R = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  return members.map(c => {
    const k = (seen.get(c.name) || 0) + 1;
    seen.set(c.name, k);
    return c.name + (R[k - 1] !== undefined ? R[k - 1] : ' ' + k);
  });
}
function roomInfo(room, conn) {
  const names = uniqueNames(room.members);
  return {
    t: 'room', code: room.code, public: room.public, host: room.host, you: conn.id,
    players: room.members.map((c, k) => ({ id: c.id, name: names[k], banner: c.banner })),
    // (partie publique : les bots qui compléteront la partie, d'après le nombre de joueurs qui attendent)
    settings: room.public ? { ...room.settings, opponents: Math.max(0, PUBLIC_KINGDOMS - room.members.length) } : room.settings,
    startsIn: room.public ? Math.max(0, room.startsAt - Date.now()) : null,
    rules: { pauseTime: PAUSE_TIME, pauseEvery: PAUSE_EVERY },
  };
}
function broadcastRoom(room) { for (const c of room.members) send(c, roomInfo(room, c)); }

function joinRoom(conn, room) {
  leaveRoom(conn);
  if (room.game) return send(conn, { t: 'error', code: 'started' });
  if (room.members.length >= MAX_PLAYERS) return send(conn, { t: 'error', code: 'full' });
  room.members.push(conn);
  conn.room = room;
  broadcastRoom(room);
}
function leaveRoom(conn) {
  const room = conn.room;
  if (!room) return;
  conn.room = null;
  if (room.game) return leaveGame(room, conn);
  room.members = room.members.filter(c => c !== conn);
  if (!room.public) {
    if (!room.members.length) { rooms.delete(room.code); return; }
    if (room.host === conn.id) room.host = room.members[0].id; // (l'hôte est parti : le suivant le remplace)
  }
  broadcastRoom(room);
}

// --- Lancer une partie ---
function startGame(room) {
  const humans = room.members.slice();
  if (!humans.length) return;
  const s = room.settings;
  // (partie publique : des bots complètent jusqu'à PUBLIC_KINGDOMS royaumes)
  const opponents = room.public ? Math.max(0, PUBLIC_KINGDOMS - humans.length) : s.opponents;
  const settings = { ...s, opponents };
  const hostSlot = room.public ? -1 : Math.max(0, humans.findIndex(c => c.id === room.host));
  room.game = {
    slots: humans,                 // slot (place dans la liste des joueurs) → connexion (null : parti)
    turn: 0, acc: 0, last: Date.now(),
    queue: [],                     // ordres reçus, pour le prochain tour : [slot, ordre, numéro]
    paused: false, pauseBy: -1, pauseUntil: 0, lastPause: new Map(),
    speed: 1, host: hostSlot,
    spawnTurns: SPAWN_TIME * TPS,
    hashes: new Map(), desync: false,
  };
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  const names = uniqueNames(humans), players = humans.map((c, k) => ({ name: names[k], banner: c.banner }));
  humans.forEach((c, k) => send(c, {
    t: 'start', seed, settings, players, me: k, host: hostSlot, public: room.public,
    spawnTurns: room.game.spawnTurns, rules: { pauseTime: PAUSE_TIME, pauseEvery: PAUSE_EVERY },
  }));
  console.log(`⚔️ Partie ${room.public ? 'publique' : 'privée'} ${room.code} : ${humans.length} joueur(s), ${opponents} bots, carte ${s.mapType}`);
  if (room.public) openPublicRoom(); // (la suivante attend déjà ses joueurs)
}
function leaveGame(room, conn) {
  const g = room.game, slot = g.slots.indexOf(conn);
  if (slot < 0) return;
  g.slots[slot] = null;
  g.queue.push([slot, { k: 'leave' }, 0]); // (chez tout le monde, un bot prend sa place)
  if (!g.slots.some(Boolean)) { rooms.delete(room.code); return; } // (plus personne : la partie s'arrête)
  // (l'hôte est parti : le joueur suivant devient l'hôte)
  if (slot === g.host) {
    g.host = g.slots.findIndex(Boolean);
    gameSend(g, { t: 'host', slot: g.host });
  }
  if (g.paused && g.pauseBy === slot) setPause(g, false, -1);
}
function gameSend(g, msg) {
  const data = Buffer.from(JSON.stringify(msg));
  for (const c of g.slots) if (c) sendFrame(c, 0x1, data);
}

// --- Pause et vitesse ---
function setPause(g, on, by, limit = 0) {
  g.paused = on;
  g.pauseBy = on ? by : -1;
  g.pauseUntil = on && limit ? Date.now() + limit : 0;
  g.last = Date.now();
  gameSend(g, { t: 'pause', on, by, limit });
}
function askPause(room, conn, on) {
  const g = room.game, slot = g.slots.indexOf(conn);
  if (room.public) return send(conn, { t: 'error', code: 'nopause' });
  if (g.turn < g.spawnTurns) return; // (pas pendant le choix des places)
  if (slot === g.host) return setPause(g, !!on, slot); // (l'hôte fait comme il veut)
  if (!on) { if (g.paused && g.pauseBy === slot) setPause(g, false, slot); return; } // (on ne reprend que sa propre pause)
  if (g.paused) return;
  const wait = (g.lastPause.get(slot) || -Infinity) + PAUSE_EVERY - Date.now();
  if (wait > 0) return send(conn, { t: 'error', code: 'pause', wait });
  g.lastPause.set(slot, Date.now());
  setPause(g, true, slot, PAUSE_TIME);
}

// --- Les tours ---
// Toutes les 10 ms, chaque partie envoie les tours qui sont dus : TPS par seconde, fois la vitesse
// (le choix des places se fait toujours à vitesse x1)
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const g = room.game;
    if (!g) {
      if (room.public && now >= room.startsAt) {
        if (room.members.length) startGame(room);
        else { room.startsAt = now + PUBLIC_EVERY; room.settings.mapType = pick(PUBLIC_MAPS); }
      }
      continue;
    }
    if (g.paused && g.pauseUntil && now >= g.pauseUntil) setPause(g, false, -1); // (fin d'une courte pause)
    const dt = Math.min(1000, now - g.last);
    g.last = now;
    if (g.paused) continue;
    g.acc += dt * (g.turn < g.spawnTurns ? 1 : g.speed);
    let sent = 0;
    while (g.acc >= 1000 / TPS && sent++ < 10) {
      g.acc -= 1000 / TPS;
      g.turn++;
      const o = g.queue;
      g.queue = [];
      if (g.turn === g.spawnTurns) o.push([0, { k: 'begin' }, 0]); // (le choix des places est fini : la partie commence)
      gameSend(g, { t: 'turn', n: g.turn, o });
    }
  }
}, 10);

// ============================================================================================================
// 4. Les messages des joueurs (voir PROTOCOLE.md)
// ============================================================================================================
function onMessage(conn, m) {
  if (m.t === 'hello') {
    if (m.protocol !== PROTOCOL) { send(conn, { t: 'error', code: 'protocol' }); return closeConn(conn); }
    conn.hello = true;
    conn.name = clampName(m.name);
    conn.banner = Math.max(0, m.banner | 0);
    return;
  }
  if (!conn.hello) return;
  const room = conn.room, g = room && room.game;
  switch (m.t) {
    case 'public': return joinRoom(conn, publicRoom);
    case 'create': {
      const r = { code: newCode(), public: false, host: conn.id, members: [], game: null, settings: cleanSettings(m.settings) };
      rooms.set(r.code, r);
      return joinRoom(conn, r);
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r || r.public) return send(conn, { t: 'error', code: 'noroom' });
      return joinRoom(conn, r);
    }
    case 'leave': return leaveRoom(conn);
    case 'profile':
      conn.name = clampName(m.name);
      conn.banner = Math.max(0, m.banner | 0);
      if (room && !g) broadcastRoom(room);
      return;
    case 'settings':
      if (!room || g || room.public || room.host !== conn.id) return;
      room.settings = cleanSettings(m.settings);
      return broadcastRoom(room);
    case 'start':
      if (!room || g || room.public) return;
      if (room.host !== conn.id) return send(conn, { t: 'error', code: 'host' });
      return startGame(room);
    // --- pendant la partie ---
    case 'order': {
      if (!g) return;
      const slot = g.slots.indexOf(conn), o = m.o;
      if (slot < 0 || !o || typeof o !== 'object' || typeof o.k !== 'string') return;
      if (['leave', 'begin'].includes(o.k)) return; // (ces ordres-là, seul le serveur les donne)
      if (JSON.stringify(o).length > 2000) return;
      if (g.queue.filter(q => q[0] === slot).length >= 20) return; // (pas plus de 20 ordres par tour et par joueur)
      g.queue.push([slot, o, m.s | 0]);
      return;
    }
    case 'pause': if (g) askPause(room, conn, m.on); return;
    case 'speed':
      if (!g || room.public || g.slots.indexOf(conn) !== g.host || !SPEEDS.includes(m.v)) return;
      g.speed = m.v;
      return gameSend(g, { t: 'speed', v: m.v });
    case 'hash': {
      // (chaque joueur envoie l'empreinte de sa partie de temps en temps : elles doivent toutes être identiques)
      if (!g || g.desync) return;
      const n = m.n | 0, h = m.h;
      if (!g.hashes.has(n)) g.hashes.set(n, h);
      else if (g.hashes.get(n) !== h) {
        g.desync = true;
        console.log(`⚠️ Partie ${room.code} : désynchronisation au tour ${n}`);
        gameSend(g, { t: 'desync', n });
      }
      for (const k of g.hashes.keys()) if (k < n - HASH_KEEP) g.hashes.delete(k);
      return;
    }
  }
}

openPublicRoom();
server.listen(PORT, () => {
  console.log(`🏰 Medieval Emperor : http://localhost:${PORT}  (jeu en ligne sur ws://localhost:${PORT}/ws)`);
});
