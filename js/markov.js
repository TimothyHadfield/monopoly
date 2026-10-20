// Exact landing odds as a Markov chain.
// State = (square, doubles rolled so far this turn 0..2) for 40 squares, plus
// three "in jail, about to try attempt 1/2/3" states. One step = one throw of
// the dice; every throw ends on exactly one square (after cards), and that is
// a "landing". Cards are drawn at random (each card 1/16).
// strategy: 'stay' = try for doubles up to 3 turns (late game);
//           'pay'  = pay $50 at the start of the next turn and roll (early game).
(function (root) {
  'use strict';
  const Board = (typeof module !== 'undefined' && module.exports) ? require('./board.js') : root.Board;
  const { SQ, CHANCE, CHEST, RR, UTIL, nearest, DICE, JAIL, GOTOJAIL } = Board;

  const NS = 123; // 40*3 + 3 jail states
  const J0 = 120;
  const sIdx = (pos, d) => pos * 3 + d;

  // Where a token ends after arriving on `pos` by dice. Returns [{sq, p, how, jailed}].
  // how: 'dice' (normal), 'rr2' (card: nearest railroad, double rent), 'util10' (card: nearest utility)
  function resolve(pos) {
    if (pos === GOTOJAIL) return [{ sq: JAIL, p: 1, how: 'jail', jailed: true }];
    const t = SQ[pos].type;
    if (t !== 'chance' && t !== 'cc') return [{ sq: pos, p: 1, how: 'dice', jailed: false }];
    const deck = t === 'chance' ? CHANCE : CHEST;
    const out = [];
    const q = 1 / deck.length;
    for (const c of deck) {
      if (c.kind === 'move') out.push({ sq: c.to, p: q, how: 'card', jailed: false });
      else if (c.kind === 'rr') out.push({ sq: nearest(pos, RR), p: q, how: 'rr2', jailed: false });
      else if (c.kind === 'util') out.push({ sq: nearest(pos, UTIL), p: q, how: 'util10', jailed: false });
      else if (c.kind === 'jail') out.push({ sq: JAIL, p: q, how: 'jail', jailed: true });
      else if (c.kind === 'back3') {
        for (const r of resolve((pos + 37) % 40)) out.push({ ...r, p: r.p * q, how: r.how === 'dice' ? 'card' : r.how });
      } else out.push({ sq: pos, p: q, how: 'dice', jailed: false });
    }
    return out;
  }

  // Transitions out of one state: [{p, sq, how, sum, next, ends}]
  // ends = this throw ends the turn (next state is a turn start).
  function transitions(s, strategy) {
    const out = [];
    const q = 1 / 36;
    const fromJail = s >= J0;
    if (fromJail && strategy === 'pay') return transitions(sIdx(JAIL, 0), strategy);
    const attempt = fromJail ? s - J0 : -1;
    const pos = fromJail ? JAIL : Math.floor(s / 3);
    const d = fromJail ? 0 : s % 3;
    for (const r of DICE) {
      if (!fromJail && r.dbl && d === 2) { // third double in a row
        out.push({ p: q, sq: JAIL, how: 'jail', sum: r.sum, next: J0, ends: true });
        continue;
      }
      if (fromJail && !r.dbl && attempt < 2) { // stay in jail
        out.push({ p: q, sq: JAIL, how: 'jail', sum: r.sum, next: J0 + attempt + 1, ends: true });
        continue;
      }
      for (const x of resolve((pos + r.sum) % 40)) {
        let next, ends;
        if (x.jailed) { next = J0; ends = true; }
        else if (r.dbl && !fromJail) { next = sIdx(x.sq, d + 1); ends = false; }
        else { next = sIdx(x.sq, 0); ends = true; }
        out.push({ p: q * x.p, sq: x.sq, how: x.how, sum: r.sum, next, ends });
      }
    }
    return out;
  }

  const cache = {};
  function table(strategy) {
    if (!cache[strategy]) {
      const t = [];
      for (let s = 0; s < NS; s++) t.push(transitions(s, strategy));
      cache[strategy] = t;
    }
    return cache[strategy];
  }
  const isTurnStart = s => s >= J0 || s % 3 === 0;

  function emptyLand() {
    return { all: new Float64Array(40), dice: new Float64Array(40), rr2: new Float64Array(40), util10: new Float64Array(40), sumW: new Float64Array(40) };
  }
  function addLand(L, t, w) {
    L.all[t.sq] += w;
    if (t.how === 'rr2') L.rr2[t.sq] += w;
    else if (t.how === 'util10') L.util10[t.sq] += w;
    else { L.dice[t.sq] += w; L.sumW[t.sq] += w * t.sum; }
  }

  // Long-run odds. Returns per-throw landing shares (sum 1) and per-turn rates.
  const statCache = {};
  function stationary(strategy) {
    strategy = strategy === 'pay' ? 'pay' : 'stay';
    if (statCache[strategy]) return statCache[strategy];
    const T = table(strategy);
    let pi = new Float64Array(NS); pi[0] = 1;
    for (let it = 0; it < 5000; it++) {
      const nx = new Float64Array(NS);
      for (let s = 0; s < NS; s++) { const m = pi[s]; if (!m) continue; for (const t of T[s]) nx[t.next] += m * t.p; }
      // average with the previous vector to damp any period-2 wobble
      let diff = 0;
      for (let s = 0; s < NS; s++) { const v = 0.5 * (nx[s] + pi[s]); diff += Math.abs(v - pi[s]); nx[s] = v; }
      pi = nx;
      if (diff < 1e-15) break;
    }
    const L = emptyLand();
    let starts = 0, inJail = 0;
    for (let s = 0; s < NS; s++) {
      if (isTurnStart(s)) starts += pi[s];
      if (s >= J0) inJail += pi[s];
      for (const t of T[s]) addLand(L, t, pi[s] * t.p);
    }
    const throwsPerTurn = 1 / starts;
    const perTurn = Array.from(L.all, v => v * throwsPerTurn);
    const res = { strategy, pi, land: Array.from(L.all), perTurn, throwsPerTurn, L, jailShare: inJail };
    statCache[strategy] = res;
    return res;
  }

  // One whole turn starting on `pos` (or in jail on attempt `jailAttempt` 0..2).
  // Returns expected landings per square during that turn (with how-splits).
  const turnCache = {};
  function turnFrom(pos, opts) {
    opts = opts || {};
    const strategy = opts.strategy === 'pay' ? 'pay' : 'stay';
    const key = strategy + (opts.inJail ? 'j' + (opts.jailAttempt || 0) : pos);
    if (!turnCache[key]) turnCache[key] = turnFromRaw(pos, opts, strategy);
    return turnCache[key];
  }
  function turnFromRaw(pos, opts, strategy) {
    const T = table(strategy);
    const L = emptyLand();
    let cur = new Map();
    cur.set(opts.inJail ? J0 + (opts.jailAttempt || 0) : sIdx(pos, 0), 1);
    for (let k = 0; k < 4 && cur.size; k++) {
      const nx = new Map();
      for (const [s, m] of cur) for (const t of T[s]) {
        addLand(L, t, m * t.p);
        if (!t.ends) nx.set(t.next, (nx.get(t.next) || 0) + m * t.p);
      }
      cur = nx;
    }
    return L;
  }

  const Markov = { stationary, turnFrom, transitions, resolve, NS, J0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = Markov; else root.Markov = Markov;
})(this);
