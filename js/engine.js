// The full game as a pure function: apply(state, action) -> new state.
// view(state, seat) hides what nobody at a real table could see (dice seed,
// deck order). The same engine runs local, computer and online seats.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Board = node ? require('./board.js') : root.Board;
  const Money = node ? require('./money.js') : root.Money;
  const { SQ, GROUPS, CHANCE, CHEST, RR, UTIL, nearest, JAIL } = Board;

  const DEFAULT_RULES = {
    auction: true,        // official: an unbought lot is auctioned
    freeParking: false,   // house rule: taxes and fees go to a pot won on Free Parking
    doubleGo: false,      // house rule: $400 for landing exactly on Go
    incomeTax10: false,   // older rule: pay 10% of worth or $200, whichever is lower
    luxuryTax: 100,       // $100 now, $75 in older sets
    goAroundFirst: false, // house rule: no buying until you have passed Go once
    shortGame: false,     // official short game: 2 deeds dealt, hotel at 3 houses, ends at 2nd bankruptcy
    roundLimit: 0,        // official time-limit game as a number of rounds (0 = play to the end)
    startCash: 1500,
    manualDice: false,    // tests / 'real dice' mode: the roll action carries the dice
    maxTurns: 4000,       // safety stop; richest wins
  };

  // ---------------------------------------------------------------- random
  function rand(st) { // mulberry32, state kept in st.seed
    let t = (st.seed = (st.seed + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const die = st => 1 + Math.floor(rand(st) * 6);
  function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------------------------------------------------------------- setup
  // seats: [{ name, kind: 'human'|'cpu'|'online', level }]
  function newGame(seats, rules, seed) {
    const st = {
      v: 1,
      rules: Object.assign({}, DEFAULT_RULES, rules || {}),
      seed: (seed >>> 0) || ((Math.random() * 4294967296) >>> 0),
      players: seats.map(s => ({
        name: s.name, kind: s.kind || 'human', level: s.level || 'medium',
        cash: 0, pos: 0, jail: 0, jailTries: 0, cards: [], out: false, passedGo: false,
      })),
      own: Money.newOwn(),
      decks: { chance: [], chest: [] },
      turn: 0, round: 1, turns: 0, doubles: 0,
      phase: 'roll', resume: 'roll',
      pendingBuy: null, auction: null, auctionQueue: [], debts: [], trade: null,
      pot: 0, dice: null, lastMove: null, lastCard: null, log: [], winner: -1, bankruptcies: 0,
    };
    st.players.forEach(p => { p.cash = st.rules.startCash; });
    st.decks.chance = shuffle(st, CHANCE.map((_, i) => i));
    st.decks.chest = shuffle(st, CHEST.map((_, i) => i));
    if (st.rules.shortGame || st.rules.roundLimit) {
      // official short game (2008+ booklet): three deeds dealt free.
      // official time-limit game: two deeds dealt, paid for at the printed price.
      const deeds = shuffle(st, SQ.filter(s => s.group).map(s => s.id));
      const n = st.rules.shortGame ? 3 : 2;
      st.players.forEach((p, i) => {
        for (let k = 0; k < n && deeds.length; k++) {
          const sq = deeds.pop(); st.own[sq].owner = i;
          if (!st.rules.shortGame) p.cash -= SQ[sq].price;
        }
      });
    }
    log(st, `${st.players[0].name} to roll.`);
    return st;
  }

  function log(st, text) { st.log.push(text); if (st.log.length > 80) st.log.splice(0, st.log.length - 80); }
  const name = (st, i) => (i < 0 ? 'the bank' : st.players[i].name);
  const money = n => '$' + Math.round(n);

  // ---------------------------------------------------------------- who acts
  function actor(st) {
    if (st.phase === 'over') return -1;
    if (st.phase === 'debt') return st.debts[0].who;
    if (st.phase === 'auction') return st.auction.active[st.auction.idx];
    if (st.phase === 'trade') return st.trade.to;
    return st.turn;
  }

  // ---------------------------------------------------------------- money
  function toBank(st, amount) { if (st.rules.freeParking) st.pot += amount; }
  // who pays `amount` to `to` (player index, or -1 = bank). Short of cash -> a debt to settle.
  function charge(st, who, amount, to, why) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    const p = st.players[who];
    if (p.cash >= amount) {
      p.cash -= amount;
      if (to >= 0) st.players[to].cash += amount; else toBank(st, amount);
      if (why) log(st, `${p.name} pays ${money(amount)} ${why}.`);
    } else {
      st.debts.push({ who, amount, to, why: why || '' });
      log(st, `${p.name} owes ${money(amount)} ${why || ''} and is short.`);
    }
  }

  // ---------------------------------------------------------------- movement
  function passGo(st, i) {
    st.players[i].cash += 200; st.players[i].passedGo = true;
    log(st, `${name(st, i)} passes Go: +$200.`);
  }
  function moveTo(st, i, to, collect) {
    const p = st.players[i];
    if (collect && to < p.pos) {
      if (to === 0 && st.rules.doubleGo) { p.cash += 400; p.passedGo = true; log(st, `${p.name} lands on Go: +$400.`); }
      else passGo(st, i);
    }
    st.lastMove = { who: i, from: p.pos, to, n: st.turns };
    p.pos = to;
  }
  function sendToJail(st, i) {
    const p = st.players[i];
    st.lastMove = { who: i, from: p.pos, to: JAIL, n: st.turns, jail: true };
    p.pos = JAIL; p.jail = 1; p.jailTries = 0;
    st.doubles = 0; st.resume = 'end';
    log(st, `${p.name} goes to jail.`);
  }

  function drawCard(st, deckName) {
    const deck = st.decks[deckName];
    const idx = deck.shift();
    const card = (deckName === 'chance' ? CHANCE : CHEST)[idx];
    if (card.kind !== 'goojf') deck.push(idx); // the jail card is kept until used
    return { idx, card };
  }

  // Resolve landing on the player's square. how: 'dice' | 'card' | 'rr2' | 'util10'
  function land(st, i, how, diceSum) {
    const p = st.players[i], sq = p.pos, s = SQ[sq];
    if (s.type === 'gotojail') return sendToJail(st, i);
    if (s.type === 'go' && st.rules.doubleGo && st.lastMove && st.lastMove.to === 0) { /* paid in moveTo */ }
    if (s.type === 'tax') {
      let amt = sq === 38 ? st.rules.luxuryTax : s.amount;
      if (sq === 4 && st.rules.incomeTax10 && !st.rules.shortGame) amt = Math.min(200, Math.floor(Money.netWorth(st, i) * 0.1));
      return charge(st, i, amt, -1, s.name === 'Income Tax' ? 'income tax' : 'luxury tax');
    }
    if (s.type === 'free') {
      if (st.rules.freeParking && st.pot > 0) { p.cash += st.pot; log(st, `${p.name} wins the Free Parking pot: ${money(st.pot)}.`); st.pot = 0; }
      return;
    }
    if (s.type === 'chance' || s.type === 'cc') {
      const dn = s.type === 'chance' ? 'chance' : 'chest';
      const { idx, card } = drawCard(st, dn);
      st.lastCard = { deck: dn, idx, text: card.text, who: i, n: st.turns };
      log(st, `${p.name} draws: ${card.text}.`);
      return doCard(st, i, dn, idx, card);
    }
    if (!s.group) return;
    const o = st.own[sq];
    if (o.owner < 0) {
      if (st.rules.goAroundFirst && !p.passedGo) { log(st, `${p.name} can't buy until passing Go once.`); return; }
      st.pendingBuy = sq;
      return;
    }
    if (o.owner === i || o.mort) return;
    let sum = diceSum;
    if (how === 'util10') { const a = die(st), b = die(st); sum = a + b; st.dice = [a, b]; log(st, `${p.name} rolls ${sum} for the utility.`); }
    const r = Money.rent(st, sq, how, sum);
    charge(st, i, r, o.owner, `rent to ${name(st, o.owner)}`);
  }

  function doCard(st, i, deckName, idx, card) {
    const p = st.players[i];
    switch (card.kind) {
      case 'move': moveTo(st, i, card.to, true); return land(st, i, 'card', 0);
      case 'rr': moveTo(st, i, nearest(p.pos, RR), true); return land(st, i, 'rr2', 0);
      case 'util': moveTo(st, i, nearest(p.pos, UTIL), true); return land(st, i, 'util10', 0);
      case 'back3': moveTo(st, i, (p.pos + 37) % 40, false); return land(st, i, 'card', 0);
      case 'jail': return sendToJail(st, i);
      case 'goojf': p.cards.push(deckName); return;
      case 'money':
        if (card.amount > 0) p.cash += card.amount; else charge(st, i, -card.amount, -1, 'to the bank');
        return;
      case 'each':
        st.players.forEach((q, j) => {
          if (j === i || q.out) return;
          if (card.amount > 0) charge(st, j, card.amount, i, `to ${p.name}`);
          else charge(st, i, -card.amount, j, `to ${q.name}`);
        });
        return;
      case 'repairs': {
        let h = 0, H = 0;
        st.own.forEach(o => { if (o.owner === i) { if (o.houses === 5) H++; else h += o.houses; } });
        return charge(st, i, h * card.perHouse + H * card.perHotel, -1, 'for repairs');
      }
    }
  }

  // ---------------------------------------------------------------- flow
  function nextTurn(st) {
    st.doubles = 0;
    const n = st.players.length;
    let j = st.turn;
    for (let k = 0; k < n; k++) {
      j = (j + 1) % n;
      if (!st.players[j].out) break;
    }
    if (j <= st.turn) st.round++;
    st.turn = j; st.turns++;
    st.resume = 'roll';
    st.lastCard = null; st.proposals = 0;
    if (st.rules.roundLimit && st.round > st.rules.roundLimit) { st.round = st.rules.roundLimit; return finishByWorth(st, `Round limit reached.`); }
    if (st.turns >= st.rules.maxTurns) return finishByWorth(st, `Turn limit reached.`);
    log(st, `${st.players[j].name} to roll.`);
  }

  function finishByWorth(st, why) {
    let best = -1, bw = -Infinity;
    st.players.forEach((p, i) => { if (!p.out) { const w = Money.netWorth(st, i); if (w > bw) { bw = w; best = i; } } });
    st.winner = best; st.phase = 'over';
    log(st, `${why} ${name(st, best)} wins with ${money(bw)}.`);
  }

  // decide the phase after every action
  function settle(st) {
    if (st.phase === 'over') return st;
    const alive = st.players.filter(p => !p.out).length;
    if (alive <= 1) { st.winner = st.players.findIndex(p => !p.out); st.phase = 'over'; log(st, `${name(st, st.winner)} wins!`); return st; }
    if (st.rules.shortGame && st.bankruptcies >= 1) { finishByWorth(st, 'Short game ends at the first bankruptcy.'); return st; }
    if (st.trade) { st.phase = 'trade'; return st; } // a debtor may sell to another player to raise cash
    if (st.debts.length) { st.phase = 'debt'; return st; }
    if (!st.auction && st.auctionQueue.length) startAuction(st, st.auctionQueue.shift());
    if (st.auction) { st.phase = 'auction'; return st; }
    if (st.pendingBuy != null) { st.phase = 'buy'; return st; }
    if (st.trade) { st.phase = 'trade'; return st; }
    if (st.players[st.turn].out) { nextTurn(st); if (st.phase === 'over') return st; return settle(st); }
    st.phase = st.resume;
    return st;
  }

  // ---------------------------------------------------------------- auction
  function startAuction(st, sq) {
    const n = st.players.length, order = [];
    for (let k = 0; k < n; k++) { const j = (st.turn + k) % n; if (!st.players[j].out) order.push(j); }
    st.auction = { sq, high: 0, bidder: -1, active: order, idx: 0 };
    log(st, `Auction for ${SQ[sq].name}.`);
  }
  function auctionStep(st) {
    const a = st.auction;
    if (a.active.length === 0 || (a.active.length === 1 && a.bidder === a.active[0])) {
      if (a.bidder >= 0) {
        const w = a.bidder;
        st.players[w].cash -= a.high; toBank(st, 0);
        st.own[a.sq].owner = w;
        log(st, `${name(st, w)} wins ${SQ[a.sq].name} for ${money(a.high)}.`);
      } else log(st, `No bids: ${SQ[a.sq].name} stays with the bank.`);
      st.auction = null;
      return;
    }
    a.idx = a.idx % a.active.length;
    // skip the high bidder if everyone else has had their say is handled by passes
  }

  // ---------------------------------------------------------------- bankruptcy
  function goBankrupt(st, who) {
    const d = st.debts[0];
    const to = d && d.who === who ? d.to : -1;
    const p = st.players[who];
    // buildings go back to the bank at half price
    st.own.forEach((o, sq) => {
      if (o.owner === who && o.houses) {
        const n = o.houses === 5 ? Money.hotelAt(st) + 1 : o.houses;
        p.cash += n * SQ[sq].house / 2; o.houses = 0;
      }
    });
    const lots = st.own.map((o, sq) => (o.owner === who ? sq : -1)).filter(sq => sq >= 0);
    if (to >= 0) {
      const c = st.players[to];
      c.cash += p.cash;
      lots.forEach(sq => {
        st.own[sq].owner = to;
        if (st.own[sq].mort) charge(st, to, Math.ceil(SQ[sq].price / 20), -1, `10% interest on ${SQ[sq].name}`);
      });
      c.cards.push(...p.cards);
      log(st, `${p.name} is bankrupt; everything goes to ${c.name}.`);
    } else {
      lots.forEach(sq => { st.own[sq].owner = -1; st.own[sq].mort = false; if (st.rules.auction) st.auctionQueue.push(sq); });
      p.cards.forEach(dn => st.decks[dn].push((dn === 'chance' ? CHANCE : CHEST).findIndex(c => c.kind === 'goojf')));
      log(st, `${p.name} is bankrupt to the bank.`);
    }
    p.cash = 0; p.cards = []; p.out = true; p.jail = 0;
    st.bankruptcies++;
    st.debts = st.debts.filter(x => x.who !== who);
    // anyone owed money by this player loses that claim; claims *to* them go to the bank
    st.debts.forEach(x => { if (x.to === who) x.to = -1; });
    if (st.auction) {
      st.auction.active = st.auction.active.filter(j => j !== who);
      if (st.auction.bidder === who) { st.auction.bidder = -1; st.auction.high = 0; }
    }
    if (st.trade && (st.trade.from === who || st.trade.to === who)) st.trade = null;
    if (st.turn === who) { st.pendingBuy = null; st.resume = 'end'; }
  }

  // ---------------------------------------------------------------- legality
  const isMine = (st, i, sq) => st.own[sq] && st.own[sq].owner === i;
  function canMortgage(st, i, sq) {
    const o = st.own[sq];
    return isMine(st, i, sq) && !o.mort && (SQ[sq].type !== 'prop' || GROUPS[SQ[sq].group].every(j => st.own[j].houses === 0));
  }
  const unmortgageCost = sq => SQ[sq].price / 2 + Math.ceil(SQ[sq].price / 20); // integer math: no float round-up
  function canManage(st, i) { // build / sell / mortgage outside of a buy or auction
    if (st.phase === 'over' || st.players[i].out) return false;
    if (st.phase === 'debt') return st.debts[0].who === i;
    return (st.phase === 'roll' || st.phase === 'end') && st.turn === i;
  }

  // Every action the seat may take now (types only, plus targets for management).
  // official rule: you are bankrupt only when selling buildings and mortgaging still can't cover what you owe
  // same lots between the same two players = same offer (cash may differ)
  const tradeKey = tr => `${tr.from}>${tr.to}:${tr.give.slice().sort((x, y) => x - y).join(',')}|${tr.get.slice().sort((x, y) => x - y).join(',')}`;
  function owed(st, i) { return st.debts.filter(d => d.who === i).reduce((a, d) => a + d.amount, 0); }
  function canGiveUp(st, i) {
    if (st.players[i].cash + Money.liquidValue(st, i) < owed(st, i)) return true;
    // stuck: nothing can be sold or mortgaged right now (e.g. a hotel with no houses left in the bank)
    for (let sq = 0; sq < 40; sq++) if (Money.canSell(st, i, sq) || canMortgage(st, i, sq)) return false;
    return true;
  }
  function legal(st, i) {
    const out = [];
    if (st.phase === 'over' || i < 0 || st.players[i].out) return out;
    const p = st.players[i];
    const me = actor(st) === i;
    if (me && st.phase === 'roll') {
      out.push({ type: 'roll' });
      if (p.jail) { if (p.cash >= 50) out.push({ type: 'payJail' }); if (p.cards.length) out.push({ type: 'useCard' }); }
      out.push({ type: 'propose' });
    }
    if (me && st.phase === 'end') { out.push({ type: 'end' }); out.push({ type: 'propose' }); }
    if (me && st.phase === 'buy') { if (p.cash >= SQ[st.pendingBuy].price) out.push({ type: 'buy' }); out.push({ type: 'decline' }); }
    if (me && st.phase === 'auction') { out.push({ type: 'bid' }); out.push({ type: 'pass' }); }
    if (me && st.phase === 'trade') { out.push({ type: 'accept' }); out.push({ type: 'reject' }); }
    if (me && st.phase === 'debt') { if (p.cash >= st.debts[0].amount) out.push({ type: 'payDebt' }); else if (canGiveUp(st, i)) out.push({ type: 'bankrupt' }); out.push({ type: 'propose' }); }
    if (canManage(st, i)) {
      for (let sq = 0; sq < 40; sq++) {
        if (st.phase !== 'debt' && Money.canBuild(st, i, sq) && p.cash >= SQ[sq].house) out.push({ type: 'build', sq });
        if (Money.canSell(st, i, sq)) out.push({ type: 'sell', sq });
        if (canMortgage(st, i, sq)) out.push({ type: 'mortgage', sq });
        if (st.phase !== 'debt' && isMine(st, i, sq) && st.own[sq].mort && p.cash >= unmortgageCost(sq)) out.push({ type: 'unmortgage', sq });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- apply
  // fast structured copy (the state is plain data: numbers, strings, arrays, small objects)
  function deep(x) {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) { const a = new Array(x.length); for (let k = 0; k < x.length; k++) a[k] = deep(x[k]); return a; }
    const o = {}; for (const k in x) o[k] = deep(x[k]); return o;
  }
  const clone = deep;

  function apply(state, action) {
    const st = clone(state);
    const i = action.seat;
    const fail = msg => { const e = new Error(msg); e.illegal = true; throw e; };
    if (st.phase === 'over') fail('game over');
    if (i == null || !st.players[i] || st.players[i].out) fail('bad seat');
    const p = st.players[i];
    const me = actor(st) === i;
    const t = action.type;

    if (['build', 'sell', 'mortgage', 'unmortgage'].includes(t)) {
      if (!canManage(st, i)) fail('not now');
      const sq = action.sq, s = SQ[sq];
      if (t === 'build') {
        if (st.phase === 'debt' || !Money.canBuild(st, i, sq) || p.cash < s.house) fail('cannot build');
        p.cash -= s.house; st.own[sq].houses = Money.nextLevel(st, st.own[sq].houses);
        log(st, `${p.name} builds on ${s.name}.`);
      } else if (t === 'sell') {
        if (!Money.canSell(st, i, sq)) fail('cannot sell');
        p.cash += s.house / 2; st.own[sq].houses = Money.prevLevel(st, st.own[sq].houses);
        log(st, `${p.name} sells a building on ${s.name}.`);
      } else if (t === 'mortgage') {
        if (!canMortgage(st, i, sq)) fail('cannot mortgage');
        st.own[sq].mort = true; p.cash += s.price / 2;
        log(st, `${p.name} mortgages ${s.name}.`);
      } else {
        if (st.phase === 'debt' || !isMine(st, i, sq) || !st.own[sq].mort || p.cash < unmortgageCost(sq)) fail('cannot unmortgage');
        p.cash -= unmortgageCost(sq); toBank(st, 0); st.own[sq].mort = false;
        log(st, `${p.name} pays off the mortgage on ${s.name}.`);
      }
      return settle(st);
    }

    if (!me) fail('not your turn');

    switch (t) {
      case 'roll': {
        if (st.phase !== 'roll') fail('not now');
        // fixed dice only when the table chose 'real dice' (or in tests); online seats can't pick their roll
        const fixed = st.rules.manualDice && Array.isArray(action.dice) && action.dice.every(d => d >= 1 && d <= 6 && d === Math.floor(d));
        const a = fixed ? action.dice[0] : die(st), b = fixed ? action.dice[1] : die(st);
        st.dice = [a, b];
        const dbl = a === b, sum = a + b;
        log(st, `${p.name} rolls ${a} + ${b}${dbl ? ' (double)' : ''}.`);
        if (p.jail) {
          if (dbl) { p.jail = 0; p.jailTries = 0; st.resume = 'end'; log(st, `${p.name} rolls out of jail.`); }
          else {
            p.jailTries++;
            // short game: you must leave jail on your next turn
            if (p.jailTries < (st.rules.shortGame ? 1 : 3)) { st.resume = 'end'; return settle(st); }
            p.jail = 0; p.jailTries = 0; st.resume = 'end';
            charge(st, i, 50, -1, 'to leave jail');
          }
          moveTo(st, i, (p.pos + sum) % 40, true);
          land(st, i, 'dice', sum);
          return settle(st);
        }
        st.doubles = dbl ? st.doubles + 1 : 0;
        if (st.doubles === 3) { log(st, `${p.name} rolls a third double.`); sendToJail(st, i); return settle(st); }
        st.resume = dbl ? 'roll' : 'end';
        moveTo(st, i, (p.pos + sum) % 40, true);
        land(st, i, 'dice', sum);
        return settle(st);
      }
      case 'payJail':
        if (st.phase !== 'roll' || !p.jail || p.cash < 50) fail('not now');
        p.cash -= 50; toBank(st, 50); p.jail = 0; p.jailTries = 0;
        log(st, `${p.name} pays $50 to leave jail.`);
        return settle(st);
      case 'useCard': {
        if (st.phase !== 'roll' || !p.jail || !p.cards.length) fail('not now');
        const dn = p.cards.shift();
        st.decks[dn].push((dn === 'chance' ? CHANCE : CHEST).findIndex(c => c.kind === 'goojf'));
        p.jail = 0; p.jailTries = 0;
        log(st, `${p.name} uses a Get Out of Jail Free card.`);
        return settle(st);
      }
      case 'buy': {
        if (st.phase !== 'buy') fail('not now');
        const sq = st.pendingBuy;
        if (p.cash < SQ[sq].price) fail('not enough cash');
        p.cash -= SQ[sq].price; st.own[sq].owner = i; st.pendingBuy = null;
        log(st, `${p.name} buys ${SQ[sq].name} for ${money(SQ[sq].price)}.`);
        return settle(st);
      }
      case 'decline': {
        if (st.phase !== 'buy') fail('not now');
        const sq = st.pendingBuy; st.pendingBuy = null;
        log(st, `${p.name} doesn't buy ${SQ[sq].name}.`);
        if (st.rules.auction) startAuction(st, sq);
        return settle(st);
      }
      case 'bid': {
        if (st.phase !== 'auction') fail('not now');
        const a = st.auction, amt = Math.floor(action.amount);
        if (!(amt > a.high) || amt > p.cash) fail('bad bid');
        a.high = amt; a.bidder = i; a.idx = (a.idx + 1) % a.active.length;
        log(st, `${p.name} bids ${money(amt)}.`);
        auctionStep(st);
        return settle(st);
      }
      case 'pass': {
        if (st.phase !== 'auction') fail('not now');
        const a = st.auction;
        a.active.splice(a.idx, 1);
        log(st, `${p.name} passes.`);
        if (a.active.length) a.idx = a.idx % a.active.length;
        auctionStep(st);
        return settle(st);
      }
      case 'end':
        if (st.phase !== 'end') fail('not now');
        nextTurn(st);
        return settle(st);
      case 'payDebt': {
        if (st.phase !== 'debt') fail('not now');
        const d = st.debts[0];
        if (p.cash < d.amount) fail('not enough cash');
        st.debts.shift();
        p.cash -= d.amount;
        if (d.to >= 0) st.players[d.to].cash += d.amount; else toBank(st, d.amount);
        log(st, `${p.name} pays ${money(d.amount)} ${d.why}.`);
        return settle(st);
      }
      case 'bankrupt':
        if (st.phase !== 'debt' || !me) fail('not now');
        if (!canGiveUp(st, i)) fail('you can still raise enough: sell buildings or mortgage first');
        goBankrupt(st, i);
        return settle(st);
      case 'propose': {
        if (!me || (st.phase !== 'roll' && st.phase !== 'end' && st.phase !== 'debt')) fail('not now');
        if ((st.proposals || 0) >= 3) fail('three offers per turn');
        st.proposals = (st.proposals || 0) + 1;
        const tr = action.trade; // { to, give:[sq], get:[sq], giveCash, getCash, giveCards, getCards }
        const to = tr.to;
        if (to === i || !st.players[to] || st.players[to].out) fail('bad partner');
        const give = tr.give || [], get = tr.get || [];
        if (give.some(sq => !isMine(st, i, sq) || !Money.tradable(st, sq))) fail('bad give');
        if (get.some(sq => !isMine(st, to, sq) || !Money.tradable(st, sq))) fail('bad get');
        const gc = Math.max(0, Math.floor(tr.giveCash || 0)), rc = Math.max(0, Math.floor(tr.getCash || 0));
        if (gc > p.cash || rc > st.players[to].cash) fail('not enough cash');
        const gk = Math.min(tr.giveCards || 0, p.cards.length), rk = Math.min(tr.getCards || 0, st.players[to].cards.length);
        if (!give.length && !get.length && !gc && !rc && !gk && !rk) fail('empty trade');
        st.trade = { from: i, to, give: give.slice(), get: get.slice(), giveCash: gc, getCash: rc, giveCards: gk, getCards: rk };
        log(st, `${p.name} offers ${st.players[to].name} a trade.`);
        return settle(st);
      }
      case 'accept':
      case 'reject': {
        if (st.phase !== 'trade') fail('not now');
        const tr = st.trade; st.trade = null;
        const A = st.players[tr.from], Bp = st.players[tr.to];
        if (t === 'reject') {
          // remembered for a few rounds so computers don't repeat the same offer every turn
          const key = tradeKey(tr);
          st.declined = (st.declined || []).filter(d => st.turns - d.t < 12 * st.players.length && d.k !== key);
          st.declined.push({ k: key, t: st.turns });
          log(st, `${Bp.name} turns the trade down.`); return settle(st);
        }
        // re-check: things may not have changed, but stay safe
        if (tr.give.some(sq => !isMine(st, tr.from, sq)) || tr.get.some(sq => !isMine(st, tr.to, sq)) || A.cash < tr.giveCash || Bp.cash < tr.getCash) fail('trade no longer valid');
        tr.give.forEach(sq => { st.own[sq].owner = tr.to; });
        tr.get.forEach(sq => { st.own[sq].owner = tr.from; });
        A.cash += tr.getCash - tr.giveCash; Bp.cash += tr.giveCash - tr.getCash;
        for (let k = 0; k < tr.giveCards; k++) Bp.cards.push(A.cards.shift());
        for (let k = 0; k < tr.getCards; k++) A.cards.push(Bp.cards.shift());
        log(st, `${Bp.name} accepts the trade.`);
        // receiving a mortgaged lot costs 10% interest straight away (official rule)
        tr.give.forEach(sq => { if (st.own[sq].mort) charge(st, tr.to, Math.ceil(SQ[sq].price / 20), -1, `10% interest on ${SQ[sq].name}`); });
        tr.get.forEach(sq => { if (st.own[sq].mort) charge(st, tr.from, Math.ceil(SQ[sq].price / 20), -1, `10% interest on ${SQ[sq].name}`); });
        return settle(st);
      }
    }
    fail('unknown action ' + t);
  }

  // What seat `seat` may see. Nothing in Monopoly is secret except the dice
  // seed and the order of the decks.
  function view(st, seat) {
    const v = clone(st);
    delete v.seed;
    v.decks = { chance: st.decks.chance.length, chest: st.decks.chest.length };
    v.you = seat;
    return v;
  }

  const Engine = { tradeKey, canGiveUp, DEFAULT_RULES, newGame, apply, view, legal, actor, settle, unmortgageCost, canMortgage };
  if (node) module.exports = Engine; else root.Engine = Engine;
})(this);
