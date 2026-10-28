// ⭐ LES DÉFIS DES CAMPAGNES (Charlemagne, la guerre de Cent Ans)
// Des objectifs secondaires, pour chaque faction jouable : historiques, drôles ou très difficiles. Ils ne comptent pas
// pour la victoire, mais chacun rapporte une récompense (de l'or, de la Croyance ou de la Légitimité) dès qu'il est
// réussi ; un défi réussi le reste, un défi manqué aussi. Les défis de chaque faction sont dans CHALLENGES
// (charlemagne.js, centans.js) : { kind, …, text, reward: { gold, faith } }. Les sortes de défis (kind) :
//  - hold : tenir ces lieux (places : un rôle = sa capitale, « lon,lat » = une ville de Charlemagne ; un nom français
//    de ville dans la guerre de Cent Ans) ;
//  - gold, army, land, level, faith, kills : avoir n pièces d'or, n soldats, pct % des terres, une ville de niveau n,
//    n de Croyance (de Légitimité), anéanti n royaumes ;
//  - count : avoir n bâtiments de la sorte b ('church', 'port', 'mine', 'outpost') ;
//  - walls, vikings, razed : n murs bâtis, n assauts vikings lancés, n villes rasées (raids, chevauchées) ;
//  - destroy : que la faction role ait disparu ;
//  - obj : un objectif du scénario (voir OBJECTIVES), comme { kind: 'noEnglish' } ;
//  - king, joan (guerre de Cent Ans) : que le roi Jean ait été capturé, que Jeanne d'Arc ait été prise ;
//  - noLoss : ne perdre aucune ville jusqu'à until (minutes) ou untilYear ; keep : garder ces lieux jusque-là ;
//    noCapture : que le roi de France ne soit jamais capturé jusque-là.
// before (minutes) ou byYear : le défi doit être réussi avant ce moment, sinon il est manqué.
// 🙏 Le vœu : au début de la partie, un parchemin propose de jurer un des défis. Accompli, il rapporte VOW.MULT fois sa
// récompense ; manqué (ou pas accompli avant VOW.MINUTES minutes, ou l'année VOW.YEAR), il coûte VOW.PENALTY_GOLD pièces
// et VOW.PENALTY_FAITH de Croyance (de Légitimité).

const DEFIS = {
  VOW: { MULT: 2, MINUTES: 30, YEAR: 1420, PENALTY_GOLD: 1000, PENALTY_FAITH: 40 },
  VOW_EVENT: {
    date: tr('Le jour du serment', 'The day of the oath'),
    title: tr('Un vœu solennel', 'A solemn vow'),
    text: tr('Devant ta cour assemblée, la main sur les reliques des saints, tu peux prêter un serment. Accompli, il te vaudra une double récompense et la gloire ; trahi, il te coûtera cher : de l\'or, et la confiance de tes fidèles.',
      'Before your assembled court, your hand upon the relics of the saints, you may swear an oath. Fulfilled, it will earn you a double reward and glory; broken, it will cost you dearly: gold, and the trust of your followers.'),
    todo: tr('Un vœu n\'oblige que celui qui le prononce… mais le ciel, dit-on, s\'en souvient. (Le vœu doit être tenu avant {limit}.)',
      'A vow binds only the one who speaks it… but heaven, they say, remembers. (The vow must be kept before {limit}.)'),
  },
};

Object.assign(GameRules, {
  // Les défis de la faction du joueur (une liste vide hors des campagnes)
  challengeList() {
    const S = this.cm ? CHARLEMAGNE : this.hy ? CENTANS : null;
    return (S && S.CHALLENGES && this.human && S.CHALLENGES[this.human.role]) || [];
  },
  defisState() { return this.defis || (this.defis = { state: [], vow: -1, vowAsked: false, owned: null }); },
  // Le tour de jeu de l'année y (guerre de Cent Ans), ou de la minute m
  defisYearTick(y) {
    const C = CENTANS;
    return Math.round((y - C.YEAR_START) / (C.YEAR_END - C.YEAR_START) * C.GAME_MINUTES * 60 * CONFIG.TICKS_PER_SECOND);
  },
  defisTick(minutes, year) {
    if (minutes !== undefined) return minutes * 60 * CONFIG.TICKS_PER_SECOND;
    if (year !== undefined && this.hy) return this.defisYearTick(year);
    return Infinity;
  },
  // Les défis qui se jugent dans la durée (on les réussit en tenant jusqu'au bout)
  defisLasting(c) { return ['noLoss', 'keep', 'noCapture'].includes(c.kind); },
  // Le moment où le défi k est manqué s'il n'est pas réussi (le vœu ajoute sa propre limite)
  defisDeadline(c, k) {
    let t = this.defisTick(c.before, c.byYear);
    if (k === this.defisState().vow && !this.defisLasting(c)) t = Math.min(t, this.defisTick(this.cm ? DEFIS.VOW.MINUTES : undefined, this.hy ? DEFIS.VOW.YEAR : undefined));
    return t;
  },
  // La case d'ancrage d'un lieu (-1 s'il n'existe plus)
  defisPlace(token) {
    if (this.hy) return this.hyCity(token);
    const cm = this.cm;
    const a = cm.capital[token] !== undefined ? cm.capital[token] : cm.sites.has(token) ? cm.sites.get(token) : -1;
    return a >= 0 && this.building[a] ? a : -1;
  },
  defisHolds(places) {
    const h = this.human;
    return places.every(t => { const a = this.defisPlace(t); return a >= 0 && this.owner[a] === h.id; });
  },
  // Le défi c est-il réussi en ce moment ?
  challengeMet(c) {
    const h = this.human, hy = this.hy;
    switch (c.kind) {
      case 'hold': return this.defisHolds(c.places);
      case 'gold': return h.gold >= c.n;
      case 'army': return h.troops >= c.n;
      case 'land': return h.tiles / this.conquerableLand() * 100 >= c.pct;
      case 'level': return this.castles.some(a => this.owner[a] === h.id && this.level[a] >= c.n);
      case 'faith': return this.faithOf(h.id) >= c.n;
      case 'kills': return h.kills >= c.n;
      case 'count': return h.bCount[{ church: B_CHURCH, port: B_PORT, mine: B_MINE, outpost: B_OUTPOST }[c.b]] >= c.n;
      case 'walls': return this.walls.filter(w => w.owner === h.id && w.done).length >= c.n;
      case 'vikings': return (h.vikingsLaunched || 0) >= c.n;
      case 'razed': return (h.razedCount || 0) >= c.n;
      case 'destroy': { const p = this.players.find(q => q.role === c.role); return !!p && !p.alive; }
      case 'obj': return hy ? this.hyObjectiveMet(c.obj) : this.objectiveMet(c.obj);
      case 'king': return !!(hy && hy.ransom);
      case 'joan': return !!(hy && hy.joan && hy.joan.state === 'captured');
    }
    return false;
  },
  // Chaque seconde : on regarde les défis encore ouverts du joueur
  stepChallenges() {
    const list = this.challengeList();
    if (!list.length || this.tick % CONFIG.TICKS_PER_SECOND || !this.human.alive) return;
    const st = this.defisState(), h = this.human;
    // (une ville perdue depuis la dernière fois : pour les défis « ne perdre aucune ville » ; sauf celles que l'histoire
    //  reprend d'elle-même : en 769, la révolte d'Aquitaine rend à Hunald ses villes, voir aquitaineRevolt)
    const owned = new Set(this.castles.filter(a => this.owner[a] === h.id));
    const aq = this.cm && this.cm.role.aquitaine !== undefined ? this.players[this.cm.role.aquitaine] : null;
    const revolt = st.aqDormant && aq && !aq.dormant;
    st.aqDormant = !!(aq && aq.dormant);
    const lost = st.owned && !revolt ? [...st.owned].some(a => !owned.has(a)) : false;
    st.owned = owned;
    list.forEach((c, k) => {
      if (st.state[k]) return;
      if (this.defisLasting(c)) {
        const broken = c.kind === 'noLoss' ? lost : c.kind === 'keep' ? !this.defisHolds(c.places) : !!(this.hy && this.hy.ransom);
        if (broken) return this.defisEnd(k, false);
        if (this.tick >= this.defisTick(c.until, c.untilYear)) this.defisEnd(k, true);
        return;
      }
      if (this.challengeMet(c)) this.defisEnd(k, true);
      else if (this.tick >= this.defisDeadline(c, k)) this.defisEnd(k, false);
    });
  },
  // Le défi k est réussi (ok) ou manqué : sa récompense, ou (un vœu manqué) sa pénalité
  defisEnd(k, ok) {
    const st = this.defisState(), c = this.challengeList()[k], h = this.human, V = DEFIS.VOW, vow = k === st.vow;
    st.state[k] = ok ? 'done' : 'failed';
    if (ok) {
      const m = vow ? V.MULT : 1, gold = (c.reward.gold || 0) * m, faith = (c.reward.faith || 0) * m;
      h.gold += gold;
      if (faith) this.defisFaith(faith);
      Music.sound('diamond'); // (le carillon d'une récompense)
      UI.log((vow ? tr('🙏 Vœu accompli ! ', '🙏 Vow fulfilled! ') : tr('🏅 Défi réussi ! ', '🏅 Challenge complete! ')) + `${c.text} · ${this.defisRewardText(c.reward, m)}`, 'good');
    } else if (vow) {
      const pay = Math.min(h.gold, V.PENALTY_GOLD);
      h.gold -= pay;
      this.defisFaith(-V.PENALTY_FAITH);
      UI.log(tr(`💔 Vœu trahi : ${c.text} · −${fmt(pay)} 💰, −${V.PENALTY_FAITH} de ${this.hy ? 'Légitimité' : 'Croyance'}`,
        `💔 Vow broken: ${c.text} · −${fmt(pay)} 💰, −${V.PENALTY_FAITH} ${this.hy ? 'Legitimacy' : 'Faith'}`), 'warn');
    } else UI.log(tr(`✖ Défi manqué : ${c.text}`, `✖ Challenge failed: ${c.text}`), 'warn');
  },
  // De la Croyance (Charlemagne) ou de la Légitimité (guerre de Cent Ans) pour le joueur
  defisFaith(n) {
    if (this.hy) return this.hyAddLegit(this.human.id, n);
    this.human.faithBonus = (this.human.faithBonus || 0) + n;
    this.faithCache = null;
  },
  defisRewardText(r, m = 1) {
    const parts = [];
    if (r.gold) parts.push(`+${fmt(r.gold * m)} 💰`);
    if (r.faith) parts.push(this.hy ? tr(`+${r.faith * m} de Légitimité`, `+${r.faith * m} Legitimacy`) : tr(`+${r.faith * m} de Croyance`, `+${r.faith * m} Faith`));
    return parts.join(', ');
  },

  // --- 🙏 Le vœu ---
  // Le parchemin du vœu (au début de la partie, voir UI.launch) : un bouton par défi qu'on peut jurer, et « ne rien jurer »
  offerVow() {
    const list = this.challengeList(), st = this.defisState();
    if (!list.length || st.vowAsked) return;
    st.vowAsked = true;
    const limit = this.hy ? tr(`l'an ${DEFIS.VOW.YEAR}`, `the year ${DEFIS.VOW.YEAR}`) : tr(`${DEFIS.VOW.MINUTES} minutes de règne`, `${DEFIS.VOW.MINUTES} minutes of reign`);
    const choices = list.map((c, k) => ({ key: 'vow', pick: k, label: tr('🙏 Jurer : ', '🙏 Swear: ') + c.text }));
    choices.push({ key: 'vow', pick: -1, label: tr('Ne rien jurer', 'Swear nothing') });
    UI.parchment(DEFIS.VOW_EVENT, { limit }, choices);
  },
  chooseVow(pid, pick) {
    const st = this.defisState(), list = this.challengeList();
    if (pid !== this.human.id || st.vow >= 0 || !(pick >= -1 && pick < list.length)) return null;
    st.vow = pick;
    if (pick >= 0) UI.log(tr(`🙏 Tu as juré : ${list[pick].text}`, `🙏 You have sworn: ${list[pick].text}`), 'good');
    return null;
  },
  // Pour le cadre des objectifs : [{ text, done, gone, vow }]
  challenges() {
    const st = this.defisState();
    return this.challengeList().map((c, k) => ({ text: `${c.text} (${this.defisRewardText(c.reward, k === st.vow ? DEFIS.VOW.MULT : 1)})`,
      done: st.state[k] === 'done', gone: st.state[k] === 'failed', vow: k === st.vow }));
  },
});
