// Computer games must finish: Medium/Hard trade to complete colour sets instead of
// circling the board until the 4,000-turn safety stop.
const test = require('node:test');
const assert = require('node:assert');
const { playGame } = require('../tools/sim.js');
const E = require('../js/engine.js');

test('4 Medium computers finish their games (safety stop under 5%, median well under the cap)', () => {
  const N = 40, cap = E.DEFAULT_RULES.maxTurns;
  const turns = [];
  let stopped = 0, trades = 0;
  for (let g = 0; g < N; g++) {
    const st = playGame(['medium', 'medium', 'medium', 'medium'], {}, 7000 + g);
    turns.push(st.turns);
    if (st.turns >= cap) stopped++;
    trades += st.log.filter(l => /accepts the trade/.test(l)).length;
  }
  turns.sort((a, b) => a - b);
  const median = turns[N >> 1];
  console.log(`  4x Medium: safety stop ${stopped}/${N}, median ${median} turns`);
  assert.ok(stopped / N < 0.05, `safety stop in ${stopped} of ${N} games`);
  assert.ok(median < cap / 3, `median ${median} turns`);
});

const AI = require('../js/ai.js');
const $ = require('../js/money.js');
// You hold St. James + Tennessee + Park Place; Ada holds New York + Boardwalk.
function swapTable(level) {
  let st = E.newGame([{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level }, { name: 'Bo', kind: 'cpu', level: 'medium' }], {}, 21);
  [[16, 0], [18, 0], [37, 0], [19, 1], [39, 1], [1, 2], [3, 2]].forEach(([i, o]) => { st.own[i].owner = o; });
  st.turn = 1; st.phase = 'end'; st.resume = 'end';
  return st;
}

test('computer offers a two-way set swap that the fair-trade meter calls fair, and will not repeat it after a no', () => {
  for (const level of ['medium', 'hard']) {
    let st = swapTable(level);
    const tr = AI.findTrade(st, 1, level);
    assert.ok(tr, level + ' finds a trade');
    assert.deepStrictEqual([tr.give, tr.get], [[19], [37]], 'New York for Park Place');
    const ev = $.evaluateTrade(st, { a: 1, b: 0, aGives: tr.give, bGives: tr.get, aCash: tr.giveCash, bCash: tr.getCash }, {});
    assert.ok(ev.b.value >= ev.a.value - 50 && ev.b.value > 0, 'not lopsided against the human');
    assert.ok(Math.abs(ev.fair) < 0.05, 'meter near fair: ' + ev.fair);
    st = E.apply(st, AI.choose(st, 1).action);
    assert.strictEqual(st.phase, 'trade');
    st = E.apply(st, { type: 'reject', seat: 0 });
    st.proposals = 0;
    const again = AI.findTrade(st, 1, level);
    const key = t => E.tradeKey({ from: 1, to: t.to, give: t.give, get: t.get });
    assert.ok(!again || key(again) !== key(tr), 'same offer not repeated straight away');
  }
});

test('hard blocks: no cash-only deal that finishes a set for someone else at an even split', () => {
  let st = swapTable('hard');
  // Bo offers Ada cash for Boardwalk... make it You wanting Boardwalk: You own Park Place, Ada Boardwalk
  st.turn = 0; st.phase = 'end'; st.resume = 'end';
  st.own[19].owner = 0; // You now have all oranges, so only the blues are in play
  const ev = $.evaluateTrade(st, { a: 0, b: 1, aGives: [], bGives: [39], aCash: 0, bCash: 0 }, {});
  const even = Math.round((ev.a.value - ev.b.value) / 2 / 10) * 10;
  st = E.apply(st, { type: 'propose', seat: 0, trade: { to: 1, give: [], get: [39], giveCash: even } });
  assert.strictEqual(AI.choose(st, 1).action.type, 'reject', 'hard turns down an even cash deal for its blocking lot');
  st.players[1].level = 'medium';
  assert.strictEqual(AI.choose(st, 1).action.type, 'accept', 'medium takes the same fair deal');
});
