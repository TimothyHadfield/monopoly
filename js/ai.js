// Computer players. choose(state, seat) -> { action, why }.
// easy: buys on a whim, builds late, never trades.
// medium: buys what it can afford, builds evenly, accepts fair trades.
// hard: uses the landing odds: buys and bids by value, builds the best payback
//       first up to 3 houses, keeps a cash cushion sized to the danger ahead,
//       pays out of jail early but stays in late, and offers trades that finish sets.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Board = node ? require('./board.js') : root.Board;
  const Money = node ? require('./money.js') : root.Money;
  const Engine = node ? require('./engine.js') : root.Engine;
  const { SQ, GROUPS } = Board;

  const R = Math.random;
  const A = (action, why) => ({ action, why: why || '' });

  function unowned(st) { return st.own.filter((o, i) => SQ[i].group && o.owner < 0).length; }
  function oppHouses(st, me) { return st.own.some(o => o.owner >= 0 && o.owner !== me && o.houses > 0); }
  function jailStrategy(st, me) { return unowned(st) >= 6 && !oppHouses(st, me) ? 'pay' : 'stay'; }

  // biggest rent an opponent could charge me next turn, weighted down by its chance
  function cushion(st, me) {
    const d = Money.danger(st, me, jailStrategy(st, me));
    let worst = 0;
    for (const p of d.parts) if (p.chance > 0.04) worst = Math.max(worst, p.maxRent);
    return Math.max(50, Math.min(worst, d.total * 4 + 100));
  }

  // how much a lot is worth to `me`: price, more if it finishes or blocks a set
  function lotValue(st, me, sq) {
    const s = SQ[sq];
    let v = s.price;
    const g = GROUPS[s.group];
    const mine = g.filter(i => st.own[i].owner === me).length;
    const owners = new Set(g.map(i => st.own[i].owner).filter(o => o >= 0 && o !== me));
    if (mine === g.length - 1) v *= s.type === 'prop' ? 2.2 : 1.4;       // completes my set
    else if (owners.size === 1 && g.filter(i => st.own[i].owner >= 0 && st.own[i].owner !== me).length === g.length - 1) v *= 1.6; // blocks theirs
    else if (mine > 0) v *= 1.25;
    // odds: lots people land on more are worth more
    const lt = Money.rentPerTurn ? Markovish(sq) : 1;
    return v * lt;
  }
  let landCache = null;
  function Markovish(sq) {
    if (!landCache) {
      const M = node ? require('./markov.js') : root.Markov;
      const s = M.stationary('stay');
      const avg = 1 / 40;
      landCache = s.land.map(v => 0.75 + 0.25 * (v / avg));
    }
    return landCache[sq];
  }

  // ---------------------------------------------------------------- debts
  function raiseCash(st, me, level) {
    const leg = Engine.legal(st, me);
    const pay = leg.find(a => a.type === 'payDebt');
    if (pay) return A({ type: 'payDebt', seat: me }, 'Pay what is owed.');
    const sells = leg.filter(a => a.type === 'sell');
    const morts = leg.filter(a => a.type === 'mortgage');
    if (!sells.length && !morts.length) return A({ type: 'bankrupt', seat: me }, 'Nothing left to sell.');
    if (level === 'easy') return A({ ...(morts[0] || sells[0]), seat: me }, 'Raise cash.');
    // mortgage lots outside finished sets first (cheapest loss of income), then sell buildings
    const strat = jailStrategy(st, me);
    const loss = a => {
      const s2 = Money.cloneState(st); s2.rules = st.rules;
      if (a.type === 'mortgage') s2.own[a.sq].mort = true; else s2.own[a.sq].houses = Money.prevLevel(st, s2.own[a.sq].houses);
      const got = a.type === 'mortgage' ? SQ[a.sq].price / 2 : SQ[a.sq].house / 2;
      return (Money.rentPerTurn(st, a.sq, strat) - Money.rentPerTurn(s2, a.sq, strat)) / got;
    };
    const opts = morts.concat(sells).sort((x, y) => loss(x) - loss(y));
    return A({ ...opts[0], seat: me }, 'Raise cash where it costs the least income.');
  }

  // ---------------------------------------------------------------- trades
  function judgeTrade(st, me, level) {
    const tr = st.trade;
    const t = { a: tr.from, b: tr.to, aGives: tr.give, bGives: tr.get, aCash: tr.giveCash, bCash: tr.getCash };
    const ev = Money.evaluateTrade(st, t, { rounds: 10, strategy: 'stay' });
    const mine = ev.b.value, theirs = ev.a.value;
    if (level === 'easy') {
      const gv = tr.give.reduce((s, i) => s + SQ[i].price, 0) + tr.giveCash;
      const lv = tr.get.reduce((s, i) => s + SQ[i].price, 0) + tr.getCash;
      return A({ type: gv >= lv ? 'accept' : 'reject', seat: me }, 'Face value.');
    }
    const ok = level === 'hard' ? mine >= theirs && mine > 0 : mine >= theirs - 50 && mine > -50;
    return A({ type: ok ? 'accept' : 'reject', seat: me }, ok ? 'Fair or better for me.' : 'Not worth it for me.');
  }

  function findTrade(st, me) {
    // a set I'm one lot short of, where one opponent holds the missing lot
    for (const g in GROUPS) {
      if (g === 'util') continue;
      const lots = GROUPS[g];
      const missing = lots.filter(i => st.own[i].owner !== me);
      if (missing.length !== 1 || lots.length - missing.length < 1) continue;
      const want = missing[0], o = st.own[want];
      if (o.owner < 0 || !Money.tradable(st, want) || !Money.tradable(st, lots[0])) continue;
      const them = o.owner;
      // what can I give: a lot they need, else something cheap outside my sets
      const mineLots = st.own.map((x, i) => i).filter(i => st.own[i].owner === me && Money.tradable(st, i) && !lots.includes(i));
      const theirNeed = mineLots.filter(i => { const gg = GROUPS[SQ[i].group]; return gg.filter(j => st.own[j].owner === them).length === gg.length - 1; });
      const offers = [];
      for (const give of [[], ...theirNeed.map(x => [x]), ...mineLots.filter(i => !theirNeed.includes(i)).slice(0, 4).map(x => [x])]) {
        // cash moves value one-for-one, so evaluate once and solve for the sweetener
        const ev = Money.evaluateTrade(st, { a: me, b: them, aGives: give, bGives: [want], aCash: 0, bCash: 0 }, { rounds: 10 });
        const a0 = ev.a.value, b0 = ev.b.value;
        const need = Math.max(0, (a0 - b0 - 50) / 2, -50 - b0 + 1);
        const cash = Math.ceil(need / 10) * 10;
        if (cash > Math.min(st.players[me].cash - 100, 800)) continue;
        const a1 = a0 - cash, b1 = b0 + cash;
        if (a1 > 0 && a1 > b1 && b1 >= a1 - 50) offers.push({ give, cash, gain: a1 - b1, them, want });
      }
      if (offers.length) {
        offers.sort((x, y) => y.gain - x.gain);
        const b = offers[0];
        return { to: b.them, give: b.give, get: [b.want], giveCash: b.cash, getCash: 0 };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- main
  function choose(st, me) {
    const level = st.players[me].level || 'medium';
    const p = st.players[me];
    const ph = st.phase;
    const leg = Engine.legal(st, me);
    const has = t => leg.find(a => a.type === t);

    if (ph === 'debt') return raiseCash(st, me, level);
    if (ph === 'trade') return judgeTrade(st, me, level);

    if (ph === 'buy') {
      const sq = st.pendingBuy, price = SQ[sq].price;
      if (!has('buy')) return A({ type: 'decline', seat: me }, 'Not enough cash.');
      let ok;
      if (level === 'easy') ok = R() < 0.65;
      else if (level === 'medium') ok = p.cash - price >= 50;
      else ok = p.cash - price >= (unowned(st) > 12 ? 0 : cushion(st, me) * 0.5) || lotValue(st, me, sq) > price * 1.9;
      return ok ? A({ type: 'buy', seat: me }, `Buy ${SQ[sq].name}: worth about $${Math.round(level === 'hard' ? lotValue(st, me, sq) : price)} to you.`)
        : A({ type: 'decline', seat: me }, 'Keep the cash; it goes to auction.');
    }

    if (ph === 'auction') {
      const a = st.auction, sq = a.sq;
      let cap;
      if (level === 'easy') cap = SQ[sq].price * 0.6;
      else if (level === 'medium') cap = Math.min(SQ[sq].price, p.cash - 50);
      else cap = Math.min(lotValue(st, me, sq), p.cash - cushion(st, me) * 0.4);
      const step = a.high < 100 ? 10 : 20;
      const bid = Math.max(1, a.high + step);
      if (bid <= cap && bid <= p.cash) return A({ type: 'bid', seat: me, amount: bid }, `Bid up to about $${Math.round(cap)}.`);
      return A({ type: 'pass', seat: me }, 'Price is above its value to you.');
    }

    if (ph === 'roll' || ph === 'end') {
      // jail choice at the start of the turn
      if (ph === 'roll' && p.jail) {
        const strat = level === 'easy' ? (p.cash > 200 ? 'pay' : 'stay') : level === 'medium' ? (unowned(st) > 10 ? 'pay' : 'stay') : jailStrategy(st, me);
        if (strat === 'pay') {
          if (has('useCard')) return A({ type: 'useCard', seat: me }, 'Lots still for sale: get out and buy.');
          if (has('payJail')) return A({ type: 'payJail', seat: me }, 'Lots still for sale: pay $50 and get moving.');
        }
        if (has('useCard') && p.jailTries >= 2) return A({ type: 'useCard', seat: me }, 'Last try: use the card instead of paying.');
        return A({ type: 'roll', seat: me }, 'Board is dangerous: sit in jail and try for doubles.');
      }
      // management
      if (level !== 'easy') {
        const reserve = level === 'hard' ? cushion(st, me) : 300;
        const builds = Money.houseOptions(st, me, 'stay').filter(o => o.afford && leg.some(a => a.type === 'build' && a.sq === o.sq));
        if (level === 'hard') {
          // best payback first, prefer getting every set to 3 houses
          const pick = builds.filter(o => o.next <= 3).concat(builds.filter(o => o.next > 3))
            .find(o => p.cash - o.cost >= reserve);
          if (pick) return A({ type: 'build', seat: me, sq: pick.sq }, `Build on ${SQ[pick.sq].name}: pays back in ${Math.max(1, Math.round(pick.payback))} rounds.`);
          const um = leg.find(a => a.type === 'unmortgage' && p.cash - Engine.unmortgageCost(a.sq) >= reserve + 200);
          if (um) return A({ ...um, seat: me }, 'Spare cash: pay off a mortgage.');
          if (ph === 'end' && has('propose') && (st.proposals || 0) < 1) {
            const tr = findTrade(st, me);
            if (tr) return A({ type: 'propose', seat: me, trade: tr }, `Offer a trade for ${SQ[tr.get[0]].name} to finish a set.`);
          }
        } else {
          const pick = builds.sort((a, b) => a.sq - b.sq).find(o => p.cash - o.cost >= reserve);
          if (pick) return A({ type: 'build', seat: me, sq: pick.sq }, 'Build evenly.');
          const um = leg.find(a => a.type === 'unmortgage' && p.cash - Engine.unmortgageCost(a.sq) >= 600);
          if (um) return A({ ...um, seat: me }, 'Pay off a mortgage.');
        }
      } else if (p.cash > 700) {
        const b = leg.find(a => a.type === 'build');
        if (b) return A({ ...b, seat: me }, 'Build.');
      }
      return A({ type: ph === 'roll' ? 'roll' : 'end', seat: me }, ph === 'roll' ? 'Roll.' : 'End the turn.');
    }
    return A(leg[0] ? { ...leg[0], seat: me } : null, '');
  }

  // A hint for a human seat: what the hard computer would do, and why.
  function hint(st, me) {
    const saved = st.players[me].level;
    st.players[me].level = 'hard';
    try { return choose(st, me); } finally { st.players[me].level = saved; }
  }

  const AI = { choose, hint, lotValue, cushion, findTrade };
  if (node) module.exports = AI; else root.AI = AI;
})(this);
