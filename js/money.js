// Rent, expected income, house payback, danger ahead and trade value.
// Works on a plain state object shared with the game engine:
//   state.players[i] = { name, cash, pos, jail (0 = free, 1..3 = in jail, next try #), out }
//   state.own[sq]    = { owner (-1 = bank), houses (0..4, 5 = hotel), mort }
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Board = node ? require('./board.js') : root.Board;
  const Markov = node ? require('./markov.js') : root.Markov;
  const { SQ, GROUPS } = Board;

  const HOUSES = 32, HOTELS = 12;
  const ownable = i => !!SQ[i].group;

  function newOwn() {
    return SQ.map(() => ({ owner: -1, houses: 0, mort: false }));
  }

  function ownsGroup(state, owner, group) {
    return GROUPS[group].every(i => state.own[i].owner === owner);
  }
  function countOwned(state, owner, group) {
    return GROUPS[group].filter(i => state.own[i].owner === owner).length;
  }

  // Rent a visitor pays on a square. how: 'dice' | 'card' | 'rr2' | 'util10'. diceSum for utilities.
  function rent(state, sq, how, diceSum) {
    const s = SQ[sq], o = state.own[sq];
    if (!s.group || o.owner < 0 || o.mort) return 0;
    if (s.type === 'prop') {
      if (o.houses > 0) return s.rent[o.houses];
      return ownsGroup(state, o.owner, s.group) ? s.rent[0] * 2 : s.rent[0];
    }
    if (s.type === 'rr') {
      const r = 25 * Math.pow(2, countOwned(state, o.owner, 'rr') - 1);
      return how === 'rr2' ? 2 * r : r;
    }
    if (s.type === 'util') {
      const mult = how === 'util10' || countOwned(state, o.owner, 'util') === 2 ? 10 : 4;
      return mult * diceSum;
    }
    return 0;
  }

  // Expected rent from landings L (Markov land-split arrays) on square sq, times scale.
  function expectedRent(state, L, sq, scale) {
    const s = SQ[sq];
    if (!s.group) return 0;
    let v;
    if (s.type === 'util') {
      // dice landings pay mult x the sum that got them there; a card sends you there and you roll again (avg 7)
      const o = state.own[sq];
      if (o.owner < 0 || o.mort) return 0;
      const mult = countOwned(state, o.owner, 'util') === 2 ? 10 : 4;
      v = mult * L.sumW[sq] + 10 * 7 * L.util10[sq];
    } else {
      v = (L.dice[sq]) * rent(state, sq, 'dice', 7) + L.rr2[sq] * rent(state, sq, 'rr2', 7);
    }
    return v * scale;
  }

  function stat(strategy) { return Markov.stationary(strategy); }

  // Expected rent per opponent turn for one square, as owned now.
  function rentPerTurn(state, sq, strategy) {
    const st = stat(strategy);
    return expectedRent(state, st.L, sq, st.throwsPerTurn);
  }

  function activeOpponents(state, p) {
    return state.players.filter((q, i) => i !== p && !q.out).length;
  }

  // Expected income per round (every opponent takes one turn) for player p.
  function incomePerRound(state, p, strategy) {
    const opp = activeOpponents(state, p);
    let sum = 0;
    for (let i = 0; i < 40; i++) if (state.own[i].owner === p) sum += rentPerTurn(state, i, strategy);
    return sum * opp;
  }

  function housesInUse(state) {
    let h = 0, H = 0;
    state.own.forEach(o => { if (o.houses === 5) H++; else h += o.houses; });
    return { houses: h, hotels: H, housesLeft: HOUSES - h, hotelsLeft: HOTELS - H };
  }

  // Official short game: a hotel needs only 3 houses. Level 5 is always "hotel".
  const hotelAt = state => (state.rules && state.rules.shortGame) ? 3 : 4;
  const nextLevel = (state, h) => (h >= hotelAt(state) ? 5 : h + 1);
  const prevLevel = (state, h) => (h === 5 ? hotelAt(state) : h - 1);
  // houses as an even-building level (a hotel counts one above hotelAt)
  const lvl = (state, h) => (h === 5 ? hotelAt(state) + 1 : h);

  // house rule "even building off": any street of a full set, in any order
  const evenOn = state => !(state.rules && state.rules.evenBuild === false);

  // Can player p add one building to sq right now (rules: whole group owned,
  // nothing in the group mortgaged, build evenly, bank has the pieces)?
  function canBuild(state, p, sq) {
    const s = SQ[sq], o = state.own[sq];
    if (s.type !== 'prop' || o.owner !== p || o.houses >= 5) return false;
    const g = GROUPS[s.group];
    if (!ownsGroup(state, p, s.group) || g.some(i => state.own[i].mort)) return false;
    if (evenOn(state) && g.some(i => lvl(state, state.own[i].houses) < lvl(state, o.houses))) return false;
    const bank = housesInUse(state);
    if (nextLevel(state, o.houses) === 5) return bank.hotelsLeft > 0;
    return bank.housesLeft > 0;
  }
  function canSell(state, p, sq) {
    const s = SQ[sq], o = state.own[sq];
    if (s.type !== 'prop' || o.owner !== p || o.houses <= 0) return false;
    if (evenOn(state) && GROUPS[s.group].some(i => lvl(state, state.own[i].houses) > lvl(state, o.houses))) return false;
    if (o.houses === 5 && housesInUse(state).housesLeft < hotelAt(state)) return false;
    return true;
  }

  // Every legal next building for p with its gain and payback (in rounds).
  function houseOptions(state, p, strategy) {
    const opp = Math.max(1, activeOpponents(state, p));
    const out = [];
    for (let i = 0; i < 40; i++) {
      if (!canBuild(state, p, i)) continue;
      const before = rentPerTurn(state, i, strategy);
      const h0 = state.own[i].houses, h1 = nextLevel(state, h0);
      state.own[i].houses = h1;
      const after = rentPerTurn(state, i, strategy);
      state.own[i].houses = h0;
      const gain = (after - before) * opp;
      const cost = SQ[i].house;
      out.push({ sq: i, cost, gain, payback: gain > 0 ? cost / gain : Infinity, afford: state.players[p].cash >= cost, next: h1 });
    }
    out.sort((a, b) => a.payback - b.payback);
    return out;
  }

  // Cash p would raise by selling every building and mortgaging everything.
  function liquidValue(state, p) {
    let v = 0;
    for (let i = 0; i < 40; i++) {
      const o = state.own[i];
      if (o.owner !== p) continue;
      if (o.houses) v += (o.houses === 5 ? hotelAt(state) + 1 : o.houses) * SQ[i].house / 2;
      if (!o.mort) v += SQ[i].price / 2;
    }
    return v;
  }
  function netWorth(state, p) {
    let v = state.players[p].cash;
    for (let i = 0; i < 40; i++) {
      const o = state.own[i];
      if (o.owner !== p) continue;
      // buildings at cost; a hotel counts with the houses it replaced
      v += (o.mort ? SQ[i].price / 2 : SQ[i].price) + (o.houses ? (o.houses === 5 ? hotelAt(state) + 1 : o.houses) * SQ[i].house : 0);
    }
    return v;
  }

  // Danger ahead: expected money player p pays out on their next turn
  // (rent to others + taxes), plus the biggest single risks.
  function danger(state, p, strategy) {
    const pl = state.players[p];
    const L = Markov.turnFrom(pl.pos, { inJail: pl.jail > 0, jailAttempt: Math.max(0, (pl.jail || 1) - 1), strategy });
    let total = 0;
    const parts = [];
    for (let i = 0; i < 40; i++) {
      if (!L.all[i]) continue;
      let c = 0;
      const s = SQ[i];
      if (s.type === 'tax') c = s.amount * L.all[i];
      else if (s.group && state.own[i].owner >= 0 && state.own[i].owner !== p) c = expectedRent(state, L, i, 1);
      if (c > 0) {
        const maxRent = s.type === 'tax' ? s.amount : (s.type === 'util' ? rent(state, i, 'util10', 12) : rent(state, i, 'rr2', 0));
        parts.push({ sq: i, cost: c, chance: L.all[i], maxRent });
        total += c;
      }
    }
    parts.sort((a, b) => b.cost - a.cost);
    return { total, parts };
  }

  // Income per round if every complete colour set p owns had `level` houses on each lot.
  function builtIncome(state, p, strategy, level) {
    const saved = state.own.map(o => o.houses);
    for (const g in GROUPS) {
      if (g === 'rr' || g === 'util') continue;
      if (ownsGroup(state, p, g) && GROUPS[g].every(i => !state.own[i].mort))
        GROUPS[g].forEach(i => { state.own[i].houses = Math.max(state.own[i].houses, level); });
    }
    const v = incomePerRound(state, p, strategy);
    state.own.forEach((o, i) => { o.houses = saved[i]; });
    return v;
  }

  // Can this square be traded? (No buildings anywhere in its colour set.)
  function tradable(state, sq) {
    const s = SQ[sq];
    if (!s.group) return false;
    if (s.type !== 'prop') return true;
    return GROUPS[s.group].every(i => state.own[i].houses === 0);
  }

  function cloneState(state) {
    return { players: state.players.map(q => ({ ...q })), own: state.own.map(o => ({ ...o })) };
  }

  // Apply a trade: { a, b, aGives: [sq], bGives: [sq], aCash, bCash }
  function applyTrade(state, t) {
    t.aGives.forEach(i => { state.own[i].owner = t.b; });
    t.bGives.forEach(i => { state.own[i].owner = t.a; });
    state.players[t.a].cash += (t.bCash || 0) - (t.aCash || 0);
    state.players[t.b].cash += (t.aCash || 0) - (t.bCash || 0);
  }

  // Trade value for each side. Value = cash change + change in sell-off value
  // + `rounds` x change in income per round once their full sets have 3 houses.
  function evaluateTrade(state, t, opts) {
    opts = opts || {};
    const strategy = opts.strategy || 'stay';
    const rounds = opts.rounds == null ? 10 : opts.rounds;
    const after = cloneState(state);
    applyTrade(after, t);
    const side = p => {
      const nowB = incomePerRound(state, p, strategy), nowA = incomePerRound(after, p, strategy);
      const potB = Math.max(nowB, builtIncome(state, p, strategy, 3));
      const potA = Math.max(nowA, builtIncome(after, p, strategy, 3));
      const cash = after.players[p].cash - state.players[p].cash;
      const liquid = liquidValue(after, p) - liquidValue(state, p);
      const value = cash + liquid + rounds * (potA - potB);
      return { incomeBefore: nowB, incomeAfter: nowA, potBefore: potB, potAfter: potA, cash, liquid, value };
    };
    const A = side(t.a), B = side(t.b);
    // fairness: -1 = all in B's favour, +1 = all in A's favour
    const fair = (A.value - B.value) / (Math.abs(A.value) + Math.abs(B.value) + 200);
    return { a: A, b: B, fair };
  }

  const Money = {
    HOUSES, HOTELS, newOwn, hotelAt, nextLevel, prevLevel, ownable, ownsGroup, countOwned, rent, expectedRent, rentPerTurn,
    incomePerRound, housesInUse, canBuild, canSell, houseOptions, liquidValue, netWorth,
    danger, builtIncome, tradable, cloneState, applyTrade, evaluateTrade, activeOpponents,
  };
  if (node) module.exports = Money; else root.Money = Money;
})(this);
