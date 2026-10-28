// Computer players. choose(state, seat) -> { action, why }.
// easy: buys on a whim, builds late, never trades.
// medium: buys what it can afford, builds evenly, offers and accepts fair set-finishing trades
//         (only ones where it can afford to build more than the other side).
// hard: uses the landing odds: buys and bids by value, builds the best payback (mortgaging loose lots to reach 3 houses),
//       first up to 3 houses, keeps a cash cushion sized to the danger ahead,
//       pays out of jail early but stays in late, and only trades sets it can afford to build (weighing whether the
//       other side can afford theirs).
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Board = node ? require('./board.js') : root.Board;
  const Money = node ? require('./money.js') : root.Money;
  const Engine = node ? require('./engine.js') : root.Engine;
  const { SQ, GROUPS } = Board;

  const R = Math.random;
  // knobs for strength experiments (tools/sim.js); the shipped values are the defaults
  const cfg = { trade: true, reserve: 0.5, buyAll: false, maxHouses: 5, rounds: 10, swapSlack: 50, blockPremium: 0.25, hardEdge: 40, hardProposals: 1, hardRollTrade: false, mortBuild: true, realTrade: true, realTheirs: 1.5, realMin: 0, realJudge: true, stuckRound: 40, medReserve: 200, medReal: true, clock: true, clockBid: true, clockAuction: true, clockHardBuild: true };
  // medReal: Medium also weighs a trade by whether each side can pay for houses on its new set (as Hard does);
  // with medReserve 200 (was 300) this lifted Medium vs Easy one-on-one from 45% to 67% (1,000 games, 2026-10-27).
  const A = (action, why) => ({ action, why: why || '' });

  function unowned(st) { return st.own.filter((o, i) => SQ[i].group && o.owner < 0).length; }
  function oppHouses(st, me) { return st.own.some(o => o.owner >= 0 && o.owner !== me && o.houses > 0); }
  // time-limit game: rounds left (0 = play to the end). Net worth decides, so lots count at face value,
  // a trade only pays for the rounds that are left, and $50 jail fees / 10% mortgage interest are pure loss.
  const clock = st => (st.rules && st.rules.roundLimit && cfg.clock ? Math.max(1, st.rules.roundLimit - st.round + 1) : 0);
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

  // ---------------------------------------------------------------- hard: money for houses
  // a full, unmortgaged colour set of mine still under 3 houses a lot
  function wantsHouses(st, me) {
    return Object.keys(GROUPS).some(g => g !== 'rr' && g !== 'util' && Money.ownsGroup(st, me, g)
      && GROUPS[g].every(i => !st.own[i].mort) && GROUPS[g].some(i => st.own[i].houses < 3));
  }
  // lots I can mortgage without hurting a set I build on (loose lots, railroads, utilities)
  function looseMortgages(st, me, leg) {
    return leg.filter(a => a.type === 'mortgage' && !(SQ[a.sq].type === 'prop' && Money.ownsGroup(st, me, SQ[a.sq].group)))
      .map(a => ({ sq: a.sq, loss: Money.rentPerTurn(st, a.sq, 'stay') / (SQ[a.sq].price / 2) }))
      .sort((x, y) => x.loss - y.loss);
  }
  function mortgageToBuild(st, me, leg, reserve) {
    const p = st.players[me];
    const want = Money.houseOptions(st, me, 'stay').filter(o => o.next <= 3 && p.cash - o.cost < reserve);
    if (!want.length) return null;
    const ms = looseMortgages(st, me, leg);
    if (!ms.length) return null;
    const raise = ms.reduce((s, m) => s + SQ[m.sq].price / 2, 0);
    if (p.cash + raise - want[0].cost < reserve) return null; // can't reach even one house: keep the lots
    return A({ type: 'mortgage', seat: me, sq: ms[0].sq }, `Mortgage ${SQ[ms[0].sq].name} to pay for houses.`);
  }
  // what it costs to bring every set I'd own after a trade to 3 houses, and what I could pay
  function buildPower(st, who, owners, cashDelta) {
    let need = 0, funds = st.players[who].cash + cashDelta;
    const ownerOf = i => (owners[i] != null ? owners[i] : st.own[i].owner);
    for (const g of Object.keys(GROUPS)) {
      if (g === 'rr' || g === 'util') continue;
      const all = GROUPS[g].every(i => ownerOf(i) === who);
      GROUPS[g].forEach(i => {
        if (ownerOf(i) !== who) return;
        if (all) { need += Math.max(0, 3 - st.own[i].houses) * SQ[i].house; if (st.own[i].mort) need += Engine.unmortgageCost(i); }
        else if (!st.own[i].mort) funds += SQ[i].price / 2;
      });
    }
    return need ? Math.max(0, Math.min(1, funds / need)) : 1;
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
    const ev = Money.evaluateTrade(st, t, { rounds: clock(st) ? Math.min(10, clock(st)) : 10, strategy: 'stay' });
    const mine = ev.b.value, theirs = ev.a.value;
    if (level === 'easy') {
      const gv = tr.give.reduce((s, i) => s + SQ[i].price, 0) + tr.giveCash;
      const lv = tr.get.reduce((s, i) => s + SQ[i].price, 0) + tr.getCash;
      return A({ type: gv >= lv ? 'accept' : 'reject', seat: me }, 'Face value.');
    }
    let ok;
    if (level === 'hard') {
      // blocking: a deal that finishes a set for them but none for me needs a clear premium
      const setsFor = (who, after) => Object.keys(GROUPS).filter(g => g !== 'rr' && g !== 'util' && GROUPS[g].every(i => (after[i] != null ? after[i] : st.own[i].owner) === who)).length;
      const after = {}; tr.give.forEach(i => { after[i] = tr.to; }); tr.get.forEach(i => { after[i] = tr.from; });
      const theyGain = setsFor(tr.from, after) > setsFor(tr.from, {}), iGain = setsFor(me, after) > setsFor(me, {});
      if (theyGain && !iGain) ok = mine > 0 && mine >= theirs + cfg.blockPremium * Math.abs(theirs);
      else ok = mine > 0 && mine >= theirs - cfg.swapSlack;
      if (ok && cfg.realJudge && theyGain && st.round <= cfg.stuckRound) {
        // their new set only hurts once they can pay for houses on it; mine only helps if I can
        const owners = {}; tr.give.forEach(i => { owners[i] = me; }); tr.get.forEach(i => { owners[i] = tr.from; });
        const fMe = buildPower(st, me, owners, tr.giveCash - tr.getCash), fThem = buildPower(st, tr.from, owners, tr.getCash - tr.giveCash);
        ok = mine * fMe - Math.max(0, theirs) * fThem * cfg.realTheirs > 0;
      }
    } else ok = mine >= theirs - 50 && mine > -50;
    return A({ type: ok ? 'accept' : 'reject', seat: me }, ok ? 'Fair or better for me.' : 'Not worth it for me.');
  }

  // Look for a set-completing trade with one opponent. Lots go both ways when that
  // finishes a set for each side; cash then evens the deal out so the fair-trade meter
  // reads close to fair for both (it never hands the other side a lopsided loss).
  function findTrade(st, me, level) {
    level = level || st.players[me].level || 'medium';
    const P = st.players, n = P.length;
    const keep = level === 'hard' ? Math.max(100, cushion(st, me) * 0.5) : 150;
    const recent = (st.declined || []).filter(d => st.turns - d.t < 6 * n).map(d => d.k);
    const colourGroups = Object.keys(GROUPS).filter(g => g !== 'rr' && g !== 'util');
    const lotsOf = (who, g) => GROUPS[g].filter(i => st.own[i].owner === who);
    const okLots = lots => lots.every(i => Money.tradable(st, i));
    let best = null;
    for (let them = 0; them < n; them++) {
      if (them === me || P[them].out) continue;
      // sets I finish by taking all of their lots in it
      const gets = [], gives = [[]];
      for (const g of colourGroups) {
        const mine = lotsOf(me, g), theirs = lotsOf(them, g), size = GROUPS[g].length;
        if (mine.length && theirs.length && mine.length + theirs.length === size && okLots(GROUPS[g])) gets.push(theirs);
        if (mine.length && theirs.length && mine.length + theirs.length === size && okLots(GROUPS[g])) gives.push(mine);
      }
      if (!gets.length) continue;
      // a cheap loose lot can also sweeten the deal
      const loose = st.own.map((o, i) => i).filter(i => st.own[i].owner === me && Money.tradable(st, i) && !Money.ownsGroup(st, me, SQ[i].group)
        && !GROUPS[SQ[i].group].some(j => st.own[j].owner >= 0 && st.own[j].owner !== me && st.own[j].owner !== them));
      for (const x of loose.slice(0, 3)) gives.push([x]);
      for (const get of gets) {
        for (const give of gives) {
          if (give.some(i => SQ[i].group === SQ[get[0]].group)) continue;
          const key = Engine.tradeKey({ from: me, to: them, give, get });
          if (recent.includes(key)) continue;
          const ev = Money.evaluateTrade(st, { a: me, b: them, aGives: give, bGives: get, aCash: 0, bCash: 0 }, { rounds: clock(st) ? Math.min(cfg.rounds, clock(st)) : cfg.rounds });
          const a0 = ev.a.value, b0 = ev.b.value;
          if (a0 + b0 <= 0) continue;              // no gain to share
          // split the gain evenly, in steps of $10
          // hard keeps a small edge (still inside what the meter calls fair)
          let cash = Math.round(((a0 - b0) / 2 - (level === 'hard' ? cfg.hardEdge / 2 : 0)) / 10) * 10; // > 0: I pay them; < 0: they pay me
          if (cash > 0 && cash > P[me].cash - keep) continue;
          if (cash < 0 && -cash > P[them].cash - 100) cash = -Math.max(0, Math.floor((P[them].cash - 100) / 10) * 10);
          const a1 = a0 - cash, b1 = b0 + cash;
          if (a1 <= 0 || b1 < a1 - 50 || b1 < -25) continue;
          // hard also asks: does this hand the other side more than it hands me?
          if (level === 'hard' && b1 > a1 + 50) continue;
          let score = a1;
          if ((level === 'hard' || cfg.medReal) && cfg.realTrade && st.round <= cfg.stuckRound) {
            // a set only pays once it has houses: weigh each side's gain by whether they can pay to build
            const owners = {}; give.forEach(i => { owners[i] = them; }); get.forEach(i => { owners[i] = me; });
            const fa = buildPower(st, me, owners, -cash), fb = buildPower(st, them, owners, cash);
            score = a1 * fa - Math.max(0, b1) * fb * cfg.realTheirs;
            if (score <= cfg.realMin) continue;
          }
          if (!best || score > best.score) best = { a1, score, to: them, give, get, cash };
        }
      }
    }
    if (!best) return null;
    return { to: best.to, give: best.give, get: best.get, giveCash: Math.max(0, best.cash), getCash: Math.max(0, -best.cash) };
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
      // time limit: a lot nobody else needs goes to auction, where it may sell under its face value (net worth decides)
      if (level !== 'easy' && clock(st) && cfg.clockAuction && st.rules.auction && lotValue(st, me, sq) < price * 1.5)
        return A({ type: 'decline', seat: me }, 'Time-limit game: let it go to auction and try to get it under its price.');
      let ok;
      if (level === 'easy') ok = R() < 0.65;
      else if (level === 'medium') ok = p.cash - price >= 50;
      else ok = p.cash - price >= (cfg.buyAll || unowned(st) > 12 ? 0 : cushion(st, me) * 0.5) || lotValue(st, me, sq) > price * 1.9;
      return ok ? A({ type: 'buy', seat: me }, `Buy ${SQ[sq].name}: worth about $${Math.round(level === 'hard' ? lotValue(st, me, sq) : price)} to you.`)
        : A({ type: 'decline', seat: me }, 'Keep the cash; it goes to auction.');
    }

    if (ph === 'auction') {
      const a = st.auction, sq = a.sq;
      let cap;
      if (level === 'easy') cap = SQ[sq].price * 0.6;
      else if (clock(st) && cfg.clockBid) cap = Math.min(SQ[sq].price, p.cash - 10); // any lot under its face value adds to net worth
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
        const strat = level === 'easy' ? (p.cash > 200 ? 'pay' : 'stay') : clock(st) ? 'stay' : level === 'medium' ? (unowned(st) > 10 ? 'pay' : 'stay') : jailStrategy(st, me);
        if (strat === 'pay') {
          if (has('useCard')) return A({ type: 'useCard', seat: me }, 'Lots still for sale: get out and buy.');
          if (has('payJail')) return A({ type: 'payJail', seat: me }, 'Lots still for sale: pay $50 and get moving.');
        }
        if (has('useCard') && p.jailTries >= 2) return A({ type: 'useCard', seat: me }, 'Last try: use the card instead of paying.');
        return A({ type: 'roll', seat: me }, 'Board is dangerous: sit in jail and try for doubles.');
      }
      // trade first: finishing a set is what wins games (once per turn, before building)
      if (level !== 'easy' && cfg.trade && (ph === 'end' || (level === 'hard' && cfg.hardRollTrade && !p.jail)) && has('propose') && (st.proposals || 0) < (level === 'hard' ? cfg.hardProposals : 1)) {
        const tr = findTrade(st, me, level);
        if (tr) return A({ type: 'propose', seat: me, trade: tr }, `Offer a trade for ${SQ[tr.get[0]].name} to finish a set.`);
      }
      // management
      if (level !== 'easy') {
        const reserve = level === 'hard' ? cushion(st, me) * cfg.reserve : cfg.medReserve;
        const builds = Money.houseOptions(st, me, 'stay').filter(o => o.afford && leg.some(a => a.type === 'build' && a.sq === o.sq));
        if (level === 'hard') {
          // best payback first, prefer getting every set to 3 houses
          // time limit, one-on-one: a house must pay for itself in the rounds left, else the cash wins more at auction
          // (measured: 20 rounds, Hard vs Medium 52% -> 59%; with 3+ players it cost Hard, so it is off there)
          const left = cfg.clockHardBuild && st.players.filter(q => !q.out).length === 2 ? clock(st) : 0; // payback is in rounds
          const pick = builds.filter(o => o.next <= 3).concat(builds.filter(o => o.next > 3))
            .find(o => p.cash - o.cost >= reserve && (!left || o.payback <= left));
          if (pick) return A({ type: 'build', seat: me, sq: pick.sq }, `Build on ${SQ[pick.sq].name}: pays back in ${Math.max(1, Math.round(pick.payback))} rounds.`);
          // short of cash for a set's first 3 houses: mortgage loose lots to pay for them
          if (cfg.mortBuild) {
            const mb = mortgageToBuild(st, me, leg, reserve);
            if (mb) return mb;
          }
          const um = !clock(st) && !(cfg.mortBuild && wantsHouses(st, me)) && leg.find(a => a.type === 'unmortgage' && p.cash - Engine.unmortgageCost(a.sq) >= reserve + 200);
          if (um) return A({ ...um, seat: me }, 'Spare cash: pay off a mortgage.');

        } else {
          // even building off (house rule): Medium still spreads houses across the set by choice
          const uneven = st.rules.evenBuild === false;
          const pick = builds.sort((a, b) => (uneven ? (st.own[a.sq].houses - st.own[b.sq].houses) : 0) || a.sq - b.sq).find(o => p.cash - o.cost >= reserve);
          if (pick) return A({ type: 'build', seat: me, sq: pick.sq }, 'Build evenly.');
          const um = !clock(st) && leg.find(a => a.type === 'unmortgage' && p.cash - Engine.unmortgageCost(a.sq) >= 600);
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

  const AI = { choose, hint, lotValue, cushion, findTrade, cfg, clock };
  if (node) module.exports = AI; else root.AI = AI;
})(this);
