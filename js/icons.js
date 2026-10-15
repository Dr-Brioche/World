// 🛡️ ICÔNES MÉDIÉVALES
// De petits dessins (en SVG, sur une grille de 24 x 24) qui remplacent les emojis partout dans le jeu :
// dans l'interface (menus, barres, messages) et sur la carte (bâtiments vus de loin, bannières des armées…).
// Chaque icône est une liste de couches : { d : le tracé, f : remplissage, s : contour, w : épaisseur, o : opacité }.
// Une couleur 'c' veut dire « la couleur du texte » (currentColor) ; sinon c'est une vraie couleur.

const ICON_DEFS = {
  // --- Bâtiments ---
  castle: [{ d: 'M2 22V8h3.5v2.5h2.5V8h3v2.5h2V8h3v2.5h2.5V8H22v14h-7v-5.5a3 3 0 0 0-6 0V22z', f: 'c' },
    { d: 'M10.5 13.5h3', s: 'c', w: 1 }],
  church: [{ d: 'M12 1.5v5M9.8 3.5h4.4', s: 'c', w: 1.8 }, { d: 'M4 22V12.5l8-6 8 6V22h-5.5v-5a2.5 2.5 0 0 0-5 0v5z', f: 'c' }],
  mill: [{ d: 'M9.2 22l1.6-11h2.4l1.6 11z', f: 'c' },
    { d: 'M12 10.5L4.5 3.5 3.2 5l7.8 6.6zM12 10.5l7.5-7 1.3 1.5-7.8 6.6zM12 10.5l-6.8 7.3 1.5 1.3 6.5-7.2zM12 10.5l6.8 7.3-1.5 1.3-6.5-7.2z', f: 'c', o: 0.75 }],
  swords: [{ d: 'M4 3l13.5 13.5M20 3L6.5 16.5', s: 'c', w: 2.3 },
    { d: 'M14.5 19l5-5M4.5 14l5 5', s: 'c', w: 2.3 }, { d: 'M18.5 18.5l2.5 2.5M5.5 18.5L3 21', s: 'c', w: 2.6 }],
  tent: [{ d: 'M12 4L2 21h20z', f: 'c' }, { d: 'M12 11l-3.2 10h6.4z', f: '#f3e3bf', o: 0.9 }, { d: 'M12 4V1.5l3 1-3 1', s: 'c', w: 1.2 }],
  // --- Ressources et armée ---
  gold: [{ d: 'M15.5 9.5a6 6 0 1 1-.01 0z', f: '#d9a520', s: '#6b4a12', w: 1.2 },
    { d: 'M9 6.5a6 6 0 1 1-.01 0z', f: '#efc23e', s: '#6b4a12', w: 1.2 }, { d: 'M9 9.5a3 3 0 1 1-.01 0z', s: '#8a6416', w: 1 }],
  helmet: [{ d: 'M4.5 15a7.5 7.5 0 0 1 15 0v2.5h-15z', f: 'c' }, { d: 'M11 13.5h2V21h-2zM3.5 17.5h17', s: 'c', w: 1.6 },
    { d: 'M7.5 12.5h3M13.5 12.5h3', s: '#f3e3bf', w: 1.3 }],
  shield: [{ d: 'M12 2l8.5 3v6.5c0 5.5-3.7 9.3-8.5 10.8C7.2 20.8 3.5 17 3.5 11.5V5z', f: 'c' },
    { d: 'M12 5.5v13M7 10.5h10', s: '#f3e3bf', w: 1.6, o: 0.85 }],
  scroll: [{ d: 'M6 4h11a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2z', f: '#f3e3bf', s: 'c', w: 1.5 },
    { d: 'M6 4a2 2 0 0 0-2 2v2h2M19 19a2 2 0 0 1-2 2H8a2 2 0 0 0 2-2', s: 'c', w: 1.5 },
    { d: 'M9 9h7M9 12h7M9 15h5', s: 'c', w: 1.1, o: 0.7 }],
  map: [{ d: 'M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z', f: '#f3e3bf', s: 'c', w: 1.5 }, { d: 'M9 3.5V18M15 6v14.5', s: 'c', w: 1.2 },
    { d: 'M5 13c2-1 3 1 5 0s3-3 5-2 3 1 4 0', s: '#b8322a', w: 1.2 }],
  // --- Mer ---
  ship: [{ d: 'M12 2.5V15', s: 'c', w: 1.6 }, { d: 'M12 2.5l4.5 1.4L12 5.3z', f: 'c' },
    { d: 'M6 6.5q6 1.8 12 0v6.3q-6 1.8-12 0z', f: 'c', o: 0.35, s: 'c', w: 1 }, { d: 'M12 7.2v6.6M7.5 10.2h9', s: 'c', w: 1 },
    { d: 'M2.5 15h19l-3 5h-13z', f: 'c' }],
  anchor: [{ d: 'M12 2.3a2.2 2.2 0 1 1-.01 0zM12 6.7V21M8 10h8M4.5 14.5q1 6.5 7.5 6.5t7.5-6.5M3 16.5l1.5-2.5 2.5 1.5M21 16.5l-1.5-2.5-2.5 1.5', s: 'c', w: 1.9 }],
  raft: [{ d: 'M3 15h18l-2 4H5z', f: 'c' }, { d: 'M8 13l9-9', s: 'c', w: 1.6 }, { d: 'M16.5 3l2.5 2.5-1.5 1.5L15 4.5z', f: 'c' }],
  waves: [{ d: 'M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 13c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0', s: '#2f6f9e', w: 1.8 }],
  // --- Signes ---
  up: [{ d: 'M12 3l8 9h-5v9H9v-9H4z', f: 'c' }],
  x: [{ d: 'M5.5 5.5l13 13M18.5 5.5l-13 13', s: 'c', w: 3 }],
  pennant: [{ d: 'M5 22V2.5', s: '#3a2512', w: 1.8 }, { d: 'M5.5 3l14 4.5-14 4.5z', f: '#c0392b' }],
  whiteflag: [{ d: 'M5 22V2.5', s: '#3a2512', w: 1.8 }, { d: 'M5.5 3h13l-3 4.5 3 4.5h-13z', f: '#f7f1e3', s: '#6b5a44', w: 1 }],
  warning: [{ d: 'M12 2.5L22.5 21h-21z', f: '#c0392b' }, { d: 'M12 9v6', s: '#fff', w: 2.4 }, { d: 'M12 17.2a1.3 1.3 0 1 1-.01 0z', f: '#fff' }],
  target: [{ d: 'M12 3a9 9 0 1 1-.01 0z', f: '#f3e3bf', s: '#b8322a', w: 2 }, { d: 'M12 7a5 5 0 1 1-.01 0z', s: '#b8322a', w: 2 },
    { d: 'M12 10.5a1.5 1.5 0 1 1-.01 0z', f: '#b8322a' }, { d: 'M12 12L21 3M17 3h4v4', s: 'c', w: 1.6 }],
  axe: [{ d: 'M8 21L18 6', s: 'c', w: 2 }, { d: 'M13.5 3.5c3 0 6 2 7 5l-4 2.5-5.5-3.5z', f: 'c' }],
  seal: [{ d: 'M4 4h12a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z', f: '#f3e3bf', s: 'c', w: 1.4 }, { d: 'M7.5 8h8M7.5 11h6', s: 'c', w: 1.1, o: 0.7 },
    { d: 'M16 13.5a4 4 0 1 1-.01 0z', f: '#b8322a' }, { d: 'M14 20l-1 3 3-1.5 3 1.5-1-3', f: '#b8322a' }],
  brokenseal: [{ d: 'M4 4h12a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z', f: '#f3e3bf', s: 'c', w: 1.4 },
    { d: 'M16 13.5a4 4 0 1 1-.01 0z', f: '#b8322a' }, { d: 'M15 13l2 3.5-1.5 2 1.5 2.5', s: '#f3e3bf', w: 1.3 }],
  hourglass: [{ d: 'M6 2.5h12M6 21.5h12', s: 'c', w: 2 }, { d: 'M7.5 3v2.5L12 12l-4.5 6.5V21h9v-2.5L12 12l4.5-6.5V3z', f: '#f3e3bf', s: 'c', w: 1.4 },
    { d: 'M9.5 20h5L12 16.5z', f: '#d9a520' }],
  flame: [{ d: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2.5 1 3.5 2 3.5 0-4-1-6 1-9.5z', f: '#d9661a' },
    { d: 'M12 13c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-2 1.5-3 3-5.5z', f: '#f2c14e' }],
  tomb: [{ d: 'M6 22V9a6 6 0 0 1 12 0v13z', f: 'c' }, { d: 'M12 8v8M9 11h6', s: '#f3e3bf', w: 1.8 }, { d: 'M3 22h18', s: 'c', w: 2 }],
  hammer: [{ d: 'M14 9L5 18l1.5 1.5L15.5 10.5', s: 'c', w: 2.2 }, { d: 'M12 4l6-1.5 3.5 3.5L20 12l-8-8z', f: 'c' }],
  pick: [{ d: 'M4 20L14 10', s: 'c', w: 2.2 }, { d: 'M6 6c5-3 10-3 14 1-3-1-6-1-8 1L10 6c-1 0-2.5 0-4 0z', f: 'c' }],
  lens: [{ d: 'M10 3a7 7 0 1 1-.01 0z', s: 'c', w: 2.2 }, { d: 'M15 15l6 6', s: 'c', w: 3 }],
  back: [{ d: 'M9 5L4 10l5 5', s: 'c', w: 2.2 }, { d: 'M4.5 10H14a6 6 0 0 1 0 12h-3', s: 'c', w: 2.2 }],
  road: [{ d: 'M8 2L3 22M16 2l5 20', s: 'c', w: 1.8 }, { d: 'M12 3v3M12 9.5v3.5M12 16.5v4', s: '#d9a520', w: 2 }],
  dune: [{ d: 'M17 3.5a3 3 0 1 1-.01 0z', f: '#e8a13a' }, { d: 'M2 19c4-6 8-6 12-2s6 1 8-1v6H2z', f: '#d8b46a', s: 'c', w: 1 }],
  tree: [{ d: 'M12 2L5 12h3l-4 6h16l-4-6h3z', f: '#3f6b2f' }, { d: 'M11 18h2v4h-2z', f: 'c' }],
  mountain: [{ d: 'M1.5 21L9 7l4 6 2.5-3.5L22.5 21z', f: 'c' }, { d: 'M9 7l-2.2 4.2 2.2-1 1.8 1.6z', f: '#fff' }],
  crown: [{ d: 'M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z', f: '#d9a520', s: '#6b4a12', w: 1.2 }, { d: 'M5 16h14', s: '#6b4a12', w: 1.2 }],
  dagger: [{ d: 'M12 2l2 4v9h-4V6z', f: 'c', o: 0.75 }, { d: 'M7 15h10', s: 'c', w: 2.2 }, { d: 'M12 15v6', s: 'c', w: 2.4 }],
  chain: [{ d: 'M9.5 14.5l5-5', s: 'c', w: 2 }, { d: 'M10 6.5l2-2a4 4 0 0 1 5.5 5.5l-2 2M14 17.5l-2 2a4 4 0 0 1-5.5-5.5l2-2', s: 'c', w: 2 }],
  burst: [{ d: 'M12 1.5l2 6 5.5-3-2.8 5.6 6 1.9-6 1.9 2.8 5.6-5.5-3-2 6-2-6-5.5 3 2.8-5.6-6-1.9 6-1.9-2.8-5.6 5.5 3z', f: '#d9661a' }],
  cup: [{ d: 'M6 3h12v4a6 6 0 0 1-12 0z', f: '#d9a520', s: '#6b4a12', w: 1.2 }, { d: 'M6 5H3a3 3 0 0 0 3 5M18 5h3a3 3 0 0 1-3 5', s: '#6b4a12', w: 1.4 },
    { d: 'M10 13h4v4h-4zM7 21h10l-1-3H8z', f: '#d9a520', s: '#6b4a12', w: 1 }],
  forbid: [{ d: 'M12 3a9 9 0 1 1-.01 0z', s: '#b8322a', w: 2.4 }, { d: 'M5.8 5.8l12.4 12.4', s: '#b8322a', w: 2.4 }],
  chest: [{ d: 'M3 10h18v11H3zM3 10a9 5 0 0 1 18 0', f: '#8a5a2b', s: '#3a2512', w: 1.3 }, { d: 'M3 13h18', s: '#d9a520', w: 1.6 },
    { d: 'M10.5 12h3v4h-3z', f: '#d9a520' }],
  wall: [{ d: 'M2 7h20v14H2z', f: '#9a8f82', s: 'c', w: 1.2 }, { d: 'M2 11.5h20M2 16h20M8 7v4.5M15 7v4.5M5 11.5V16M11.5 11.5V16M18 11.5V16M8 16v5M15 16v5', s: 'c', w: 1 },
    { d: 'M2 7V3.5h3V7M8 7V3.5h3V7M14 7V3.5h3V7M19 7V3.5h3V7', f: '#9a8f82', s: 'c', w: 1 }],
  skull: [{ d: 'M12 2.5a8 8 0 0 1 8 8c0 3-1.5 4.5-3 5.5V20h-10v-4c-1.5-1-3-2.5-3-5.5a8 8 0 0 1 8-8z', f: 'c' },
    { d: 'M9 9.5a2 2 0 1 1-.01 0zM15 9.5a2 2 0 1 1-.01 0z', f: '#f3e3bf' }, { d: 'M10 17v3M14 17v3', s: '#f3e3bf', w: 1 }],
  play: [{ d: 'M7 4l13 8-13 8z', f: 'c' }],
  pause: [{ d: 'M6 4h4v16H6zM14 4h4v16h-4z', f: 'c' }],
  dice: [{ d: 'M4 4h16v16H4z', f: '#f3e3bf', s: 'c', w: 1.6 }, { d: 'M8.5 7a1.5 1.5 0 1 1-.01 0zM15.5 14a1.5 1.5 0 1 1-.01 0zM12 10.5a1.5 1.5 0 1 1-.01 0z', f: 'c' }],
  mouse: [{ d: 'M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6zM12 3v6M6 9h12', s: 'c', w: 1.6 }],
  keys: [{ d: 'M2 7h20v11H2z', s: 'c', w: 1.6 }, { d: 'M5 10h2M9 10h2M13 10h2M17 10h2M6 14h12', s: 'c', w: 1.6 }],
};

// Emojis → icônes. (Les emojis des « title » et des listes déroulantes restent : là, on ne peut pas dessiner.)
const EMOJI_ICONS = {
  '🏰': 'castle', '⛪': 'church', '🌾': 'mill', '⚔': 'swords', '⛺': 'tent', '⚓': 'anchor',
  '💰': 'gold', '👥': 'helmet', '🛡': 'shield', '📜': 'scroll', '🗺': 'map',
  '⛵': 'ship', '🚢': 'anchor', '🛶': 'raft', '🌊': 'waves',
  '⬆': 'up', '✖': 'x', '🚩': 'pennant', '🏳': 'whiteflag', '⚠': 'warning', '🎯': 'target', '✂': 'axe',
  '🤝': 'seal', '💔': 'brokenseal', '⏳': 'hourglass', '⏱': 'hourglass', '🔥': 'flame', '⚰': 'tomb',
  '🏗': 'hammer', '🧨': 'pick', '🏚': 'pick', '🔎': 'lens', '🔍': 'lens', '↩': 'back', '🛤': 'road', '🛣': 'road',
  '🏜': 'dune', '🌲': 'tree', '🏔': 'mountain', '👑': 'crown', '🗡': 'dagger', '🔗': 'chain', '💥': 'burst',
  '🏆': 'cup', '🚫': 'forbid', '🎁': 'chest', '🧱': 'wall', '💀': 'skull', '☠': 'skull', '▶': 'play', '⏸': 'pause',
  '🎲': 'dice', '🖱': 'mouse', '⌨': 'keys', '🕹': 'mouse',
};
const EMOJI_RE = new RegExp('(' + Object.keys(EMOJI_ICONS).join('|') + ')\\uFE0F?', 'g');

// Une icône en SVG, pour l'interface (HTML)
function iconSVG(name, cls = 'ico') {
  const layers = ICON_DEFS[name];
  if (!layers) return '';
  const col = v => (v === 'c' ? 'currentColor' : v);
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">` + layers.map(l =>
    `<path d="${l.d}" fill="${l.f ? col(l.f) : 'none'}"` +
    (l.s ? ` stroke="${col(l.s)}" stroke-width="${l.w || 1.5}" stroke-linecap="round" stroke-linejoin="round"` : '') +
    (l.o ? ` opacity="${l.o}"` : '') + '/>').join('') + '</svg>';
}

// Remplace les emojis d'un texte HTML par les icônes dessinées
function iconize(html) {
  return html.replace(EMOJI_RE, (m, e) => iconSVG(EMOJI_ICONS[e]));
}

// Dans toute la page : chaque texte qui contient un emoji connu est remplacé par le même texte avec les
// icônes. Un « observateur » le refait dès qu'un texte change (messages, barres, menus…).
const Icons = {
  skip: new Set(['SCRIPT', 'STYLE', 'OPTION', 'SELECT', 'TEXTAREA', 'TITLE', 'svg']),
  fixNode(node) {
    const parent = node.parentNode;
    if (!parent || this.skip.has(parent.nodeName) || parent.closest && parent.closest('svg')) return;
    const text = node.nodeValue;
    EMOJI_RE.lastIndex = 0;
    if (!EMOJI_RE.test(text)) return;
    const span = document.createElement('span');
    span.className = 'icotext';
    span.innerHTML = iconize(text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    parent.replaceChild(span, node);
  },
  fixTree(root) {
    if (root.nodeType === 3) return this.fixNode(root);
    if (root.nodeType !== 1 || this.skip.has(root.nodeName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) list.push(n);
    for (const n of list) this.fixNode(n);
  },
  watch() {
    this.fixTree(document.body);
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') this.fixNode(m.target);
        else for (const n of m.addedNodes) this.fixTree(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  },

  // Icône d'un type de bâtiment (d'après son emoji dans BUILDINGS)
  building(type) { return EMOJI_ICONS[BUILDINGS[type].icon.replace('\uFE0F', '')]; },
  // Petit médaillon (rond de parchemin) avec l'icône d'un bâtiment, pour la carte vue de loin
  badge(ctx, type, x, y, size, ring = '#3a2512') {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = '#f3e3bf';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.strokeStyle = ring;
    ctx.stroke();
    this.draw(ctx, this.building(type), x, y, size * 0.85, '#3a2512');
  },

  // --- Sur la carte (canvas) ---
  paths: {},
  path(d) { return this.paths[d] || (this.paths[d] = new Path2D(d)); },
  // Dessine l'icône name, centrée en (x, y), de taille size (en pixels). col = couleur de « currentColor ».
  draw(ctx, name, x, y, size, col = '#3a2512') {
    if (!ICON_DEFS[name]) name = EMOJI_ICONS[String(name).replace('\uFE0F', '')]; // (on peut aussi donner un emoji)
    const layers = ICON_DEFS[name];
    if (!layers) return;
    const alpha = ctx.globalAlpha; // (on garde la transparence demandée : fondu icône → image)
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const l of layers) {
      const p = this.path(l.d);
      ctx.globalAlpha = alpha * (l.o || 1);
      if (l.f) { ctx.fillStyle = l.f === 'c' ? col : l.f; ctx.fill(p); }
      if (l.s) { ctx.strokeStyle = l.s === 'c' ? col : l.s; ctx.lineWidth = l.w || 1.5; ctx.stroke(p); }
    }
    ctx.restore();
  },
  // Texte avec des emojis, sur la carte : les emojis deviennent des icônes (claires, sur un petit rond sombre).
  // Le texte est placé en (x, y) selon l'alignement choisi (ctx.textAlign), avec la police déjà choisie.
  // outline = contour sombre autour du texte.
  text(ctx, str, x, y, outline = true) {
    const parts = [];
    let last = 0, m;
    EMOJI_RE.lastIndex = 0;
    while ((m = EMOJI_RE.exec(str))) {
      if (m.index > last) parts.push({ t: str.slice(last, m.index) });
      parts.push({ icon: EMOJI_ICONS[m[1]] });
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push({ t: str.slice(last) });
    const size = parseFloat(ctx.font.match(/(\d+(\.\d+)?)px/)[1]) * 1.15;
    const width = parts.reduce((w, p) => w + (p.icon ? size : ctx.measureText(p.t).width), 0);
    const align = ctx.textAlign;
    const fill = ctx.fillStyle; // (couleur du texte, à remettre après chaque icône)
    ctx.textAlign = 'left';
    let cx = align === 'left' || align === 'start' ? x : align === 'right' || align === 'end' ? x - width : x - width / 2;
    for (const p of parts) {
      if (p.icon) {
        // un petit rond sombre derrière l'icône, pour qu'elle se lise sur la carte
        ctx.beginPath();
        ctx.arc(cx + size / 2, y, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,12,4,0.55)';
        ctx.fill();
        this.draw(ctx, p.icon, cx + size / 2, y, size * 0.82, '#f3e3bf');
        cx += size;
      } else {
        ctx.fillStyle = fill;
        if (outline) ctx.strokeText(p.t, cx, y);
        ctx.fillText(p.t, cx, y);
        cx += ctx.measureText(p.t).width;
      }
    }
    ctx.textAlign = align;
    ctx.fillStyle = fill;
  },
};
