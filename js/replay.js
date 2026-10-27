// 📽️ RÉSUMÉ DE LA PARTIE
// Pendant la partie, on photographie régulièrement la carte (qui tient quelle terre), en petit. À la fin, le bouton
// « Résumé » rejoue toutes ces photos en accéléré : on voit les royaumes grandir, se battre et disparaître.
// Les réglages sont dans CONFIG.REPLAY (config.js).

const Replay = {
  // Une nouvelle partie commence : on oublie les photos de la précédente
  reset() { this.rec = null; },

  // Appelé à chaque tour de jeu (voir Game.update) : une photo toutes les EVERY secondes
  record(G) {
    const R = CONFIG.REPLAY;
    if (!this.rec) this.rec = this.newRecording(G);
    const rec = this.rec;
    if (G.tick < rec.next) return;
    rec.next = G.tick + rec.every;
    rec.frames.push(this.snapshot(G));
    rec.ticks.push(G.tick);
    // Trop de photos : on en garde une sur deux, et les suivantes seront deux fois plus espacées
    if (rec.frames.length > R.MAX_FRAMES) {
      rec.frames = rec.frames.filter((_, k) => k % 2 === 0);
      rec.ticks = rec.ticks.filter((_, k) => k % 2 === 0);
      rec.every *= 2;
    }
  },

  // La photo réduite : un petit carré de f × f cases de la carte devient un point (pour ne pas dépasser CELLS points).
  // Chaque point regarde une case de terre de son carré (celle du milieu si possible) : ainsi, les fleuves ne
  // font pas de pointillés bleus au milieu des royaumes ; un carré sans terre est de la mer (-1).
  newRecording(G) {
    const f = Math.max(1, Math.ceil(Math.sqrt(G.N / CONFIG.REPLAY.CELLS)));
    const w = Math.ceil(G.W / f), h = Math.ceil(G.H / f), cells = new Int32Array(w * h).fill(-1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = -1, bestD = Infinity;
        for (let yy = y * f; yy < Math.min(G.H, (y + 1) * f); yy++) {
          for (let xx = x * f; xx < Math.min(G.W, (x + 1) * f); xx++) {
            const i = yy * G.W + xx, d = (xx - x * f - f / 2) ** 2 + (yy - y * f - f / 2) ** 2;
            if (d < bestD && G.claimable(i)) { best = i; bestD = d; }
          }
        }
        cells[y * w + x] = best;
      }
    }
    return { f, w, h, cells, frames: [], ticks: [], next: 0, every: CONFIG.REPLAY.EVERY * CONFIG.TICKS_PER_SECOND };
  },
  // Qui tient chaque point : 0 = personne (ou la mer), sinon le numéro du royaume + 1
  snapshot(G) {
    const cells = this.rec.cells, out = new Uint8Array(cells.length);
    for (let k = 0; k < cells.length; k++) if (cells[k] >= 0) out[k] = G.owner[cells[k]] + 1;
    return out;
  },

  // Y a-t-il de quoi faire un résumé ? (au moins deux photos)
  available() { return !!this.rec && this.rec.frames.length >= 2; },

  // --- Le lecteur (l'écran du résumé) ---
  open() {
    if (!this.available()) return;
    // (la toute dernière image : la carte au moment où la partie s'arrête)
    const rec = this.rec;
    if (rec.ticks[rec.ticks.length - 1] !== Game.tick) { rec.frames.push(this.snapshot(Game)); rec.ticks.push(Game.tick); }
    const cv = $('replayCanvas');
    cv.width = rec.w; cv.height = rec.h;
    this.ctx = cv.getContext('2d');
    this.img = this.ctx.createImageData(rec.w, rec.h);
    // Durée d'une photo : tout le résumé en DURATION secondes, mais pas plus de FRAME_MS par photo
    this.frameMs = Math.min(CONFIG.REPLAY.FRAME_MS, CONFIG.REPLAY.DURATION * 1000 / rec.frames.length);
    const slider = $('replaySlider');
    slider.max = rec.frames.length - 1;
    this.pos = 0;
    this.playing = true;
    this.last = performance.now();
    $('endscreen').classList.add('hidden');
    $('replayScreen').classList.remove('hidden');
    this.draw();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  close() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    $('replayScreen').classList.add('hidden');
    $('endscreen').classList.remove('hidden');
  },
  // ▶️ / ⏸️ (arrivé au bout, ▶️ repart du début)
  togglePlay() {
    if (!this.playing && this.pos >= this.rec.frames.length - 1) this.pos = 0;
    this.playing = !this.playing;
    this.last = performance.now();
    this.draw();
  },
  // La réglette : aller à une photo
  seek(k) {
    this.pos = Math.max(0, Math.min(this.rec.frames.length - 1, k));
    this.draw();
  },
  loop(t) {
    if ($('replayScreen').classList.contains('hidden')) return;
    if (this.playing && t - this.last >= this.frameMs) {
      const steps = Math.floor((t - this.last) / this.frameMs);
      this.last += steps * this.frameMs;
      this.pos = Math.min(this.rec.frames.length - 1, this.pos + steps);
      if (this.pos >= this.rec.frames.length - 1) this.playing = false; // (fin du résumé)
      this.draw();
    }
    this.raf = requestAnimationFrame(t2 => this.loop(t2));
  },

  // Dessine la photo en cours : la mer, les terres libres et les couleurs des royaumes, sans aucun détail ;
  // à côté, l'heure de la partie et les plus grands royaumes à ce moment-là
  draw() {
    const rec = this.rec, frame = rec.frames[this.pos], data = this.img.data, players = Game.players;
    const count = new Array(players.length + 1).fill(0);
    let land = 0;
    for (let i = 0; i < frame.length; i++) {
      const o = frame[i], k = i * 4;
      let c;
      if (rec.cells[i] < 0) c = [30, 56, 88];               // la mer (et les fleuves)
      else if (o === 0) { c = [196, 202, 184]; land++; } // une terre libre (gris-vert : pas comme un royaume beige)
      else {
        c = players[o - 1].color;
        // (⚔️ les terres imprenables des pillards ne comptent pas dans les parts, comme dans le classement)
        if (!players[o - 1].raiders) { count[o]++; land++; }
      }
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    $('replaySlider').value = this.pos;
    $('replayPlay').textContent = this.playing ? '⏸️' : '▶️';
    $('replayTime').textContent = clock(rec.ticks[this.pos] / CONFIG.TICKS_PER_SECOND);
    // Les 6 plus grands royaumes à ce moment de la partie
    const top = players.map((p, k) => ({ p, n: count[k + 1] })).filter(e => e.n > 0).sort((a, b) => b.n - a.n).slice(0, 6);
    $('replayTop').innerHTML = top.map(({ p, n }) =>
      `<li${p.isHuman ? ' class="me"' : ''}><i style="background:rgb(${p.color})"></i>${escapeHtml(p.name)}` +
      `<span>${(n / Math.max(1, land) * 100).toFixed(1)}${tr(' %', '%')}</span></li>`).join('');
  },
};
