// Landing odds: checked against published results and against an
// independent simulation that plays the real rules with shuffled decks.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/board.js');
const M = require('../js/markov.js');

const pct = v => v * 100;

test('board facts', () => {
  assert.strictEqual(B.SQ.length, 40);
  assert.strictEqual(B.CHANCE.length, 16);
  assert.strictEqual(B.CHEST.length, 16);
  assert.strictEqual(B.SQ.filter(s => s.type === 'prop').length, 22);
  assert.strictEqual(B.SQ[24].name, 'Illinois Ave');
  assert.strictEqual(B.SQ[39].rent[5], 2000);
  assert.strictEqual(B.nearest(36, B.RR), 5);
  assert.strictEqual(B.nearest(22, B.UTIL), 28);
});

for (const st of ['stay', 'pay']) {
  test(`stationary (${st}): sums to 1, Go To Jail never ends a throw, Jail tops, Illinois top property`, () => {
    const r = M.stationary(st);
    assert.ok(Math.abs(r.land.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    assert.strictEqual(r.land[30], 0);
    const order = r.land.map((v, i) => i).sort((a, b) => r.land[b] - r.land[a]);
    assert.strictEqual(order[0], 10, 'Jail is the most landed square');
    const props = order.filter(i => B.SQ[i].type === 'prop');
    assert.strictEqual(props[0], 24, 'Illinois Ave is the most landed property');
    // Chance squares bleed: most Chance cards move you away
    assert.ok(r.land[7] < 0.01 && r.land[36] < 0.01);
  });
}

test('pay-out-early matches the published Markov results (Illinois 3.18%, Go 3.11%)', () => {
  const r = M.stationary('pay');
  assert.ok(Math.abs(pct(r.land[24]) - 3.18) < 0.02, `Illinois ${pct(r.land[24])}`);
  assert.ok(Math.abs(pct(r.land[0]) - 3.11) < 0.03, `Go ${pct(r.land[0])}`);
  assert.ok(pct(r.land[10]) > 5.8 && pct(r.land[10]) < 6.4, `Jail ${pct(r.land[10])}`);
});

test('stay-in-jail: about 9.4% of throws are spent in jail', () => {
  const r = M.stationary('stay');
  assert.ok(Math.abs(pct(r.jailShare) - 9.39) < 0.05, `in jail ${pct(r.jailShare)}`);
  assert.ok(Math.abs(pct(r.land[24]) - 2.99) < 0.03);
});

// ---- independent simulation with real shuffled decks ----
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function simulate(strategy, throws, seed) {
  const R = rng(seed);
  const decks = { chance: shuffle(B.CHANCE.slice(), R), cc: shuffle(B.CHEST.slice(), R) };
  const ptr = { chance: 0, cc: 0 };
  const draw = k => { const c = decks[k][ptr[k]]; ptr[k] = (ptr[k] + 1) % 16; return c; };
  const count = new Array(40).fill(0);
  let pos = 0, dbl = 0, jail = 0, n = 0;
  const die = () => 1 + Math.floor(R() * 6);
  while (n < throws) {
    const a = die(), b = die(), d = a === b; n++;
    let rollAgain = false;
    if (jail && strategy === 'pay') { jail = 0; dbl = 0; } // pay $50, then a normal turn
    if (jail) {
      if (d) { jail = 0; }                       // doubles: out, move, no extra throw
      else if (jail < 3) { jail++; count[10]++; continue; }
      else { jail = 0; }                         // third miss: pay and move
    } else {
      if (d) dbl++; else dbl = 0;
      if (dbl === 3) { pos = 10; jail = 1; dbl = 0; count[10]++; continue; }
      rollAgain = d;
    }
    pos = (pos + a + b) % 40;
    let jailed = false;
    for (let guard = 0; guard < 3; guard++) {
      const t = B.SQ[pos].type;
      if (pos === 30) { jailed = true; break; }
      if (t !== 'chance' && t !== 'cc') break;
      const c = draw(t);
      if (c.kind === 'move') { pos = c.to; break; }
      if (c.kind === 'rr') { pos = B.nearest(pos, B.RR); break; }
      if (c.kind === 'util') { pos = B.nearest(pos, B.UTIL); break; }
      if (c.kind === 'jail') { jailed = true; break; }
      if (c.kind === 'back3') { pos = (pos + 37) % 40; continue; }
      break;
    }
    if (jailed) { pos = 10; jail = 1; dbl = 0; count[10]++; continue; }
    count[pos]++;
    if (!rollAgain) dbl = 0;
  }
  return count.map(c => c / n);
}

for (const st of ['stay', 'pay']) {
  test(`simulation of 3,000,000 throws agrees with the chain (${st})`, () => {
    const sim = simulate(st, 3e6, 12345);
    const r = M.stationary(st);
    let worst = 0;
    for (let i = 0; i < 40; i++) worst = Math.max(worst, Math.abs(sim[i] - r.land[i]));
    assert.ok(worst < 0.0006, `worst square differs by ${pct(worst).toFixed(4)} points`);
  });
}

test('one turn from Go: total throws = 1 + P(double) + P(two doubles), about 1.19', () => {
  const L = M.turnFrom(0);
  const tot = L.all.reduce((a, b) => a + b, 0);
  // a double that lands on Go To Jail (or a jail card) ends the turn, so slightly under 1 + 1/6 + 1/36
  assert.ok(tot > 1.18 && tot < 1 + 1 / 6 + 1 / 36 + 1e-9, String(tot));
  // from Go the first throw lands on 2..12 with dice odds: Income Tax (4) is a 3/36 first-throw landing
  assert.ok(L.all[4] >= 3 / 36 - 1e-12);
});
