// ✠ LES ORDRES MILITAIRES DES CROISADES : les Templiers et les Hospitaliers (les réglages : ORDERS et CYPRUS, dans
// croisades.js). Ces règles s'ajoutent à celles du scénario (croisadesrules.js) :
//  - les chevaliers : un ordre (un bot) envoie des soldats à un allié attaqué par l'islam (crStepOrderHelp) ;
//  - 🏦 la banque du Temple : un royaume chrétien emprunte de l'or aux Templiers, et le rend avec intérêts (crLoan) ;
//  - les Assassins versent un tribut aux Templiers (et ne peuvent rien contre les ordres : voir crHireError) ;
//  - 🏝️ Chypre, vendue par Richard aux Templiers en 1191, puis revendue à Guy de Lusignan en 1192.
// L'état est dans Game.cr : loans (pid → { left : ce qu'il reste à rendre, due : toute la dette }), loansGiven (le nombre de prêts du Temple),
// helpReady (ordre → quand il peut de nouveau secourir), helped (royaume → jusqu'à quand il a déjà été secouru),
// nextLoan (quand un bot peut de nouveau emprunter), cyprusSold / cyprusBought (pour les défis).

Object.assign(GameRules, {
  // L'ordre du Temple, s'il existe encore (sinon null)
  crTemple() { const p = this.crP('templiers'); return p && p.alive ? p : null; },

  // Chaque seconde (voir stepCroisades)
  crStepOrders() {
    const cr = this.cr, O = CROISADES.ORDERS, TPS = CONFIG.TICKS_PER_SECOND, tp = this.crTemple();
    // (le tribut des Assassins au Temple)
    if (tp && this.crAssassins()) tp.gold += O.ASSASSIN_GOLD;
    this.crStepOrderHelp();
    this.crStepLoans();
    // (un bot chrétien à court d'or emprunte au Temple)
    if (this.tick >= cr.nextLoan) {
      cr.nextLoan = this.tick + O.AI_LOAN_EVERY * TPS;
      const bots = this.players.filter(p => p.alive && !p.human && !p.defensive && !p.order && p.gold < O.AI_LOAN_GOLD && !this.crLoanError(p.id));
      if (bots.length) this.crLoan(bots[Math.floor(this.rand() * bots.length)].id);
    }
  },

  // ⚔️ Les chevaliers de l'Ordre : un allié d'un ordre est attaqué par l'islam ; l'ordre le plus fort (un bot, qui n'a
  // pas secouru quelqu'un récemment) lui envoie une part de ses soldats. Les deux ordres se jalousent : un seul secourt
  // le même royaume à la fois, et aucun ne secourt l'autre.
  crStepOrderHelp() {
    const cr = this.cr, O = CROISADES.ORDERS, TPS = CONFIG.TICKS_PER_SECOND;
    if (this.crYear() < O.HELP_FROM) return;
    const orders = this.players.filter(p => p.alive && p.order && !p.human && p.troops >= O.HELP_MIN && (cr.helpReady.get(p.id) || 0) <= this.tick);
    if (!orders.length) return;
    for (const a of this.attacks) {
      if (a.done || a.target < 0) continue;
      const t = this.players[a.target], foe = this.players[a.attacker];
      if (!t.alive || t.order || foe.camp !== 'musulmans' || (cr.helped.get(t.id) || 0) > this.tick) continue;
      const helper = orders.filter(o => this.areAllied(o.id, t.id)).sort((x, y) => y.troops - x.troops || x.id - y.id)[0];
      if (!helper) continue;
      const n = Math.round(helper.troops * O.HELP_SHARE);
      helper.troops -= n;
      t.troops += n;
      cr.helpReady.set(helper.id, this.tick + O.HELP_EVERY * TPS);
      cr.helped.set(t.id, this.tick + O.HELP_EVERY * TPS);
      if (t.isHuman) UI.log(tr(`✠ Les ${helper.name} viennent à ton secours contre ${foe.name} : +${fmt(n)} chevaliers !`, `✠ The ${helper.name} come to your aid against ${foe.name}: +${fmt(n)} knights!`), 'good', helper);
      return; // (un seul renfort par seconde)
    }
  },

  // --- 🏦 La banque du Temple ---
  // Pourquoi pid ne peut pas emprunter au Temple (null s'il le peut)
  crLoanError(pid) {
    const O = CROISADES.ORDERS, tp = this.crTemple(), p = this.players[pid], loan = this.cr.loans.get(pid);
    if (!tp) return tr('Il n\'y a plus de Templiers.', 'There are no Templars left.');
    if (pid === tp.id) return tr('Le Temple ne se prête pas à lui-même.', 'The Temple does not lend to itself.');
    if (p.camp !== 'chretiens') return tr('Le Temple ne prête qu\'aux princes chrétiens.', 'The Temple lends only to Christian princes.');
    if (loan) return tr(`Tu dois encore ${fmt(loan.left)} pièces au Temple.`, `You still owe the Temple ${fmt(loan.left)} gold.`);
    if (this.attacks.some(a => !a.done && a.attacker === pid && a.target === tp.id)) return tr('Le Temple ne prête pas à qui l\'attaque.', 'The Temple does not lend to those who attack it.');
    // (des Templiers bots prêtent l'or des commanderies d'Occident ; un joueur templier prête le sien)
    if (tp.human && tp.gold < O.LOAN) return tr(`Le trésor du Temple est vide : il lui faudrait ${fmt(O.LOAN)} pièces.`, `The Temple's treasury is empty: it would need ${fmt(O.LOAN)} gold.`);
    return null;
  },
  // pid emprunte au Temple (ordre « crLoan ») : il reçoit LOAN pièces, et en rendra LOAN × (1 + INTEREST)
  crLoan(pid) {
    const err = this.crLoanError(pid);
    if (err) return err;
    const O = CROISADES.ORDERS, tp = this.crTemple(), p = this.players[pid], due = Math.round(O.LOAN * (1 + O.INTEREST));
    if (tp.human) tp.gold -= O.LOAN;
    p.gold += O.LOAN;
    this.cr.loans.set(pid, { left: due, due });
    this.cr.loansGiven++;
    if (p.isHuman) UI.log(tr(`🏦 Le Temple te prête ${fmt(O.LOAN)} pièces d'or : tu en rendras ${fmt(due)}, peu à peu, sur tes revenus.`, `🏦 The Temple lends you ${fmt(O.LOAN)} gold: you will repay ${fmt(due)}, little by little, out of your income.`), 'good', tp);
    else if (tp.isHuman) UI.log(tr(`🏦 ${p.name} emprunte ${fmt(O.LOAN)} pièces au Temple : il t'en rendra ${fmt(due)}.`, `🏦 ${p.name} borrows ${fmt(O.LOAN)} gold from the Temple: they will repay you ${fmt(due)}.`), 'good', p);
    return null;
  },
  // Chaque seconde : les débiteurs remboursent une part égale de leur dette (en REPAY_TIME secondes, s'ils ont l'or) ;
  // si le Temple tombe, les dettes s'effacent
  crStepLoans() {
    const cr = this.cr, O = CROISADES.ORDERS, tp = this.crTemple();
    for (const [pid, loan] of cr.loans) {
      const p = this.players[pid];
      if (!tp || !p.alive) {
        cr.loans.delete(pid);
        if (p.isHuman && p.alive) UI.log(tr('🏦 Le Temple est tombé : ta dette est effacée.', '🏦 The Temple has fallen: your debt is wiped out.'), 'good');
        continue;
      }
      const pay = Math.max(0, Math.min(loan.left, p.gold, loan.due / O.REPAY_TIME));
      p.gold -= pay;
      tp.gold += pay;
      loan.left -= pay;
      if (loan.left < 1) {
        cr.loans.delete(pid);
        if (p.isHuman) UI.log(tr('🏦 Ta dette au Temple est payée.', '🏦 Your debt to the Temple is paid.'), 'good', tp);
      }
    }
  },

  // --- 🏝️ Chypre ---
  // Les cases de l'île (voir CYPRUS.BOX) que tient from passent à to
  crGiveIsland(from, to) {
    const [w, s, e, n] = CROISADES.CYPRUS.BOX, W = this.W;
    for (let i = 0; i < this.N; i++) {
      if (this.owner[i] !== from.id) continue;
      const [lon, lat] = geoLonLat(CROISADES_PROJ, i % W, (i / W) | 0, W, this.H);
      if (lon >= w && lon <= e && lat >= s && lat <= n) this.setOwner(i, to.id);
    }
    for (const [a, w2] of this.works) if (w2.pid === from.id && this.owner[a] === to.id) w2.pid = to.id; // (les chantiers de l'île)
    // (les assauts de l'un contre l'autre sur l'île s'arrêtent)
    for (const a of this.attacks) if (!a.done && ((a.attacker === to.id && a.target === from.id) || (a.attacker === from.id && a.target === to.id))) this.endAttack(a);
    this.version++;
  },
  // Juin 1191 : Richard vend Chypre aux Templiers (un choix pour le joueur anglais, ou pour le joueur templier)
  crCyprusSale() {
    const cr = this.cr, C = CROISADES.CYPRUS, en = this.crP('angleterre'), tp = this.crTemple();
    if (!tp || !en.alive || this.crHolder('Nicosie') !== 'angleterre') return;
    if (en.isHuman) return this.crOffer('cyprusSale', { price: fmt(C.PRICE) });
    if (tp.isHuman) {
      if (tp.gold >= C.PRICE) return this.crOffer('cyprusBuy', { price: fmt(C.PRICE) });
      return UI.log(tr(`🏝️ Richard voulait te vendre Chypre pour ${fmt(C.PRICE)} pièces, mais le trésor du Temple n'y suffit pas.`, `🏝️ Richard wanted to sell you Cyprus for ${fmt(C.PRICE)} gold, but the Temple's treasury is not enough.`), 'warn', en);
    }
    this.crSellCyprus();
  },
  crSellCyprus() {
    const cr = this.cr, C = CROISADES.CYPRUS, en = this.crP('angleterre'), tp = this.crTemple();
    if (!tp || !en.alive) return;
    const pay = tp.isHuman ? C.PRICE : Math.min(C.PRICE, tp.gold);
    tp.gold -= pay;
    en.gold += C.PRICE;
    this.crGiveIsland(en, tp);
    cr.cyprusSold = cr.cyprusBought = true;
    this.crEvent('cyprusSold', {}, tr('🏝️ 1191 : Richard Cœur de Lion vend Chypre aux Templiers.', '🏝️ 1191: Richard the Lionheart sells Cyprus to the Templars.'), '', tp);
    if (en.isHuman) UI.log(tr(`💰 Chypre est vendue au Temple : +${fmt(C.PRICE)} pièces d'or.`, `💰 Cyprus is sold to the Temple: +${fmt(C.PRICE)} gold.`), 'good');
    if (tp.isHuman) UI.log(tr(`🏝️ Chypre est au Temple (−${fmt(pay)} pièces d'or).`, `🏝️ Cyprus belongs to the Temple (−${fmt(pay)} gold).`), 'good');
  },
  // Avril 1192 : les Chypriotes se révoltent ; les Templiers revendent l'île à Guy de Lusignan (au royaume de Jérusalem)
  crCyprusRevolt() {
    const tp = this.crTemple(), jer = this.crP('jerusalem');
    if (!tp || this.crHolder('Nicosie') !== 'templiers') return;
    if (tp.isHuman) return this.crOffer('cyprusRevolt', { gold: fmt(CROISADES.CYPRUS.RESALE), pct: Math.round(CROISADES.CYPRUS.REVOLT_LOSS * 100) });
    if (jer.alive) this.crResellCyprus();
  },
  crResellCyprus() {
    const C = CROISADES.CYPRUS, tp = this.crTemple(), jer = this.crP('jerusalem');
    if (!tp) return;
    tp.gold += C.RESALE;
    if (jer.alive) {
      this.crGiveIsland(tp, jer);
      if (jer.isHuman) UI.log(tr('🏝️ Guy de Lusignan rachète Chypre aux Templiers : l\'île rejoint ton royaume.', '🏝️ Guy of Lusignan buys Cyprus back from the Templars: the island joins your kingdom.'), 'good', tp);
    }
    if (tp.isHuman) UI.log(tr(`💰 Tu revends Chypre à Guy de Lusignan : +${fmt(C.RESALE)} pièces d'or.`, `💰 You sell Cyprus back to Guy of Lusignan: +${fmt(C.RESALE)} gold.`), 'good');
    else if (!jer.isHuman) UI.log(tr('🏝️ 1192 : révolte à Nicosie ; les Templiers revendent Chypre à Guy de Lusignan.', '🏝️ 1192: revolt in Nicosia; the Templars sell Cyprus back to Guy of Lusignan.'), '', tp);
  },
  // Les choix des parchemins de Chypre (voir crApplyChoice) : true si key en est un
  crOrderChoice(key, pick) {
    const C = CROISADES.CYPRUS;
    if (key === 'cyprusSale' || key === 'cyprusBuy') {
      if (pick === 'sell' || pick === 'buy') this.crSellCyprus();
      return true;
    }
    if (key === 'cyprusRevolt') {
      const tp = this.crTemple();
      if (pick === 'resell') this.crResellCyprus();
      else if (tp) {
        const lost = Math.round(tp.troops * C.REVOLT_LOSS);
        tp.troops -= lost;
        UI.log(tr(`⚔️ Tes frères écrasent la révolte de Nicosie : ${fmt(lost)} soldats y sont tombés, mais Chypre reste au Temple.`, `⚔️ Your brothers crush the revolt of Nicosia: ${fmt(lost)} soldiers fell there, but Cyprus remains the Temple's.`), 'warn');
      }
      return true;
    }
    return false;
  },
});
