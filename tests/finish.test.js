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
    // hard only hands over a set the other side can't build on straight away
    if (level === 'hard') st.players[0].cash = 300;
    const tr = AI.findTrade(st, 1, level);
    assert.ok(tr, level + ' finds a trade');
    if (level === 'medium') assert.deepStrictEqual([tr.give, tr.get], [[19], [37]], 'New York for Park Place');
    else { // hard picks the swap where it can build and the other side can't yet: a set each way
      const after = st.own.map(o => o.owner); tr.give.forEach(i => { after[i] = 0; }); tr.get.forEach(i => { after[i] = 1; });
      const sets = who => ['orange', 'blue'].filter(g => require('../js/board.js').GROUPS[g].every(i => after[i] === who)).length;
      assert.ok(sets(0) === 1 && sets(1) === 1, 'two-way set swap: ' + JSON.stringify(tr));
    }
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

test('hard does not hand an even set swap to someone who can build on it at once', () => {
  const st = swapTable('hard'); // You: $1,500, enough for 3 houses on the dark blues
  assert.strictEqual(AI.findTrade(st, 1, 'hard'), null);
});

test('hard mortgages loose lots to pay for the first houses on a full set', () => {
  let st = E.newGame([{ name: 'Ada', kind: 'cpu', level: 'hard' }, { name: 'Bo', kind: 'cpu', level: 'medium' }], {}, 5);
  [16, 18, 19, 5, 15, 1].forEach(i => { st.own[i].owner = 0; }); // oranges + 2 railroads + Mediterranean
  st.players[0].cash = 120; st.phase = 'end'; st.resume = 'end';
  const seen = [];
  for (let k = 0; k < 12; k++) {
    const a = AI.choose(st, 0).action;
    seen.push(a.type + (a.sq != null ? ':' + a.sq : ''));
    if (a.type === 'end') break;
    st = E.apply(st, a);
  }
  assert.ok(seen.some(x => x.startsWith('mortgage')), 'mortgages: ' + seen.join(' '));
  assert.ok(seen.some(x => x.startsWith('build')), 'then builds: ' + seen.join(' '));
  assert.ok(![16, 18, 19].some(i => st.own[i].mort), 'never mortgages the set it builds on');
});

test('hard beats medium one-on-one (300 games, seats swapped): at least 60%', () => {
  const { measure } = require('../tools/sim.js');
  const r = measure(300, ['hard', 'medium'], {});
  console.log('  hard vs medium 1v1: ' + (100 * r.levels.hard.winRatePerSeat).toFixed(1) + '%');
  assert.ok(r.levels.hard.winRatePerSeat >= 0.6, 'hard ' + r.levels.hard.winRatePerSeat);
});
