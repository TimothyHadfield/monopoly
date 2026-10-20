// Rent rules, house payback, danger ahead and trade value: hand-worked cases
// plus an independent brute-force walk of one turn.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/board.js');
const M = require('../js/markov.js');
const $ = require('../js/money.js');

function mk(n) {
  return { players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, cash: 1500, pos: 0, jail: 0, out: false })), own: $.newOwn() };
}
const give = (st, p, ...sqs) => sqs.forEach(i => { st.own[i].owner = p; });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('property rent: base, full set doubles, houses, hotel, mortgaged', () => {
  const st = mk(2);
  give(st, 0, 39);
  assert.strictEqual($.rent(st, 39, 'dice', 7), 50);
  give(st, 0, 37);
  assert.strictEqual($.rent(st, 39, 'dice', 7), 100);
  st.own[37].mort = true; // a mortgaged lot in the set still leaves the set "owned"
  assert.strictEqual($.rent(st, 39, 'dice', 7), 100);
  assert.strictEqual($.rent(st, 37, 'dice', 7), 0);
  st.own[37].mort = false;
  st.own[39].houses = 2; assert.strictEqual($.rent(st, 39, 'dice', 7), 600);
  st.own[39].houses = 5; assert.strictEqual($.rent(st, 39, 'dice', 7), 2000);
});

test('railroads 25/50/100/200, card doubles; utilities 4x / 10x', () => {
  const st = mk(2);
  give(st, 1, 5, 15, 25);
  assert.strictEqual($.rent(st, 5, 'dice', 7), 100);
  assert.strictEqual($.rent(st, 5, 'rr2', 7), 200);
  give(st, 1, 35); assert.strictEqual($.rent(st, 35, 'dice', 7), 200);
  give(st, 0, 12);
  assert.strictEqual($.rent(st, 12, 'dice', 8), 32);
  assert.strictEqual($.rent(st, 12, 'util10', 8), 80);
  give(st, 0, 28); assert.strictEqual($.rent(st, 28, 'dice', 5), 50);
});

test('building: full set, evenly, house supply', () => {
  const st = mk(2);
  give(st, 0, 16, 18);
  assert.ok(!$.canBuild(st, 0, 16), 'needs the whole set');
  give(st, 0, 19);
  assert.ok($.canBuild(st, 0, 16));
  st.own[16].houses = 1;
  assert.ok(!$.canBuild(st, 0, 16), 'must build evenly');
  assert.ok($.canBuild(st, 0, 18));
  assert.ok(!$.canSell(st, 0, 18));
  assert.ok($.canSell(st, 0, 16));
  st.own[18].mort = true;
  assert.ok(!$.canBuild(st, 0, 19), 'no building with a mortgaged lot in the set');
  st.own[18].mort = false;
  // use up all 32 houses elsewhere
  let left = 32; for (const i of [21, 23, 24, 26, 27, 29, 31, 32]) { st.own[i].houses = 4; left -= 4; }
  assert.strictEqual(left, 0);
  assert.ok(!$.canBuild(st, 0, 18), 'bank out of houses');
});

test('house payback = cost / (extra rent per turn x opponents)', () => {
  const st = mk(4);
  give(st, 0, 16, 18, 19);
  const opts = $.houseOptions(st, 0, 'stay');
  assert.strictEqual(opts.length, 3);
  const o16 = opts.find(o => o.sq === 16);
  const s = M.stationary('stay');
  const pt = s.L.dice[16] * s.throwsPerTurn; // St James is never a card/railroad target
  const gain = (70 - 28) * pt * 3;
  assert.ok(near(o16.gain, gain), `${o16.gain} vs ${gain}`);
  assert.ok(near(o16.payback, 100 / gain));
  assert.ok(opts[0].payback <= opts[1].payback);
});

// ---- independent brute force of one turn (no Markov code) ----
function bruteTurn(start) {
  const land = new Array(40).fill(0);
  function resolve(pos, p, out) { // returns list [sq, p, jailed]
    if (pos === 30) return out.push([10, p, true]);
    const t = B.SQ[pos].type;
    if (t !== 'chance' && t !== 'cc') return out.push([pos, p, false]);
    for (const c of (t === 'chance' ? B.CHANCE : B.CHEST)) {
      const q = p / 16;
      if (c.kind === 'move') out.push([c.to, q, false]);
      else if (c.kind === 'rr') out.push([B.nearest(pos, B.RR), q, false]);
      else if (c.kind === 'util') out.push([B.nearest(pos, B.UTIL), q, false]);
      else if (c.kind === 'jail') out.push([10, q, true]);
      else if (c.kind === 'back3') resolve((pos + 37) % 40, q, out);
      else out.push([pos, q, false]);
    }
  }
  function go(pos, p, d) {
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
      const q = p / 36;
      if (a === b && d === 2) { land[10] += q; continue; }
      const out = []; resolve((pos + a + b) % 40, q, out);
      for (const [sq, w, jailed] of out) { land[sq] += w; if (a === b && !jailed) go(sq, w, d + 1); }
    }
  }
  go(start, 1, 0);
  return land;
}

test('one-turn odds match a brute-force walk from every square', () => {
  for (let s = 0; s < 40; s++) {
    if (s === 30) continue;
    const a = M.turnFrom(s).all, b = bruteTurn(s);
    for (let i = 0; i < 40; i++) assert.ok(near(a[i], b[i], 1e-12), `from ${s} to ${i}: ${a[i]} vs ${b[i]}`);
  }
});

test('danger ahead = sum of chance x rent (+ taxes)', () => {
  const st = mk(2);
  give(st, 1, 24); st.own[24].houses = 5; // Illinois hotel
  st.players[0].pos = 0;
  const L = M.turnFrom(0);
  const d = $.danger(st, 0, 'stay');
  const want = L.all[24] * 1100 + L.all[4] * 200 + L.all[38] * 100;
  assert.ok(near(d.total, want), `${d.total} vs ${want}`);
  assert.ok(d.parts.some(p => p.sq === 24 && p.maxRent === 1100));
  assert.ok(d.parts[0].cost >= d.parts[d.parts.length - 1].cost, 'sorted biggest first');
  // your own property is no danger
  st.players[1].pos = 0;
  const d1 = $.danger(st, 1, 'stay');
  assert.ok(near(d1.total, L.all[4] * 200 + L.all[38] * 100));
});

test('trade: completing a colour set is worth more to the side that completes it', () => {
  const st = mk(3);
  give(st, 0, 16, 18); give(st, 1, 19, 39);
  const t = { a: 0, b: 1, aGives: [], bGives: [19], aCash: 200, bCash: 0 };
  const ev = $.evaluateTrade(st, t, { rounds: 10 });
  assert.ok(ev.a.potAfter > ev.a.potBefore);
  assert.strictEqual(ev.a.cash, -200);
  assert.strictEqual(ev.b.cash, 200);
  assert.ok(ev.a.value > ev.b.value, 'completing the oranges beats $200');
  assert.ok(ev.fair > 0);
  // the trade did not change the real state
  assert.strictEqual(st.own[19].owner, 1);
  assert.strictEqual(st.players[0].cash, 1500);
});

test('cannot trade a lot whose colour set has buildings', () => {
  const st = mk(2);
  give(st, 0, 1, 3); st.own[3].houses = 1;
  assert.ok(!$.tradable(st, 1));
  assert.ok($.tradable(st, 5));
});
