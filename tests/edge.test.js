// Weird but real table moments (edge pass, 2026-10-20): ties at the time limit,
// a debtor's own trade offers, and the deck / auction / bankruptcy corners.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/board.js');
const E = require('../js/engine.js');
const AI = require('../js/ai.js');
const $ = require('../js/money.js');

const seats = n => Array.from({ length: n }, (_, i) => ({ name: 'P' + i, kind: 'human' }));
const game = (n = 2, rules = {}) => E.newGame(seats(n), Object.assign({ manualDice: true }, rules), 7);
const roll = (st, a, b) => E.apply(st, { type: 'roll', seat: E.actor(st), dice: [a, b] });
const act = (st, type, extra) => E.apply(st, Object.assign({ type, seat: E.actor(st) }, extra || {}));
const top = (st, deck, pred) => { const src = deck === 'chance' ? B.CHANCE : B.CHEST; const i = src.findIndex(pred); st.decks[deck] = [i].concat(st.decks[deck].filter(x => x !== i)); };
const noBuy = st => { if (st.phase === 'buy') st = act(st, 'decline'); while (st.phase === 'auction') st = act(st, 'pass'); return st; };

test('time limit ends level: every player tied on worth is named, not just the first seat', () => {
  let st = game(3, { roundLimit: 1 });
  for (let k = 0; k < 3; k++) { st = noBuy(roll(st, 1, 2)); st = act(st, 'end'); }
  assert.strictEqual(st.phase, 'over');
  assert.deepStrictEqual(st.tie, [0, 1, 2]);
  assert.match(st.log[st.log.length - 1], /tie/i);
});

test('a clear winner at the time limit has no tie', () => {
  let st = game(2, { roundLimit: 1 });
  st = roll(st, 1, 2); st = act(st, 'buy'); st = act(st, 'end'); // P0 owns Baltic: same worth, so P1 pays tax
  st = roll(st, 1, 3); st = act(st, 'end'); // P1 pays $200 income tax
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.winner, 0);
  assert.ok(!st.tie);
});

test('a player in debt on someone else\'s turn can still offer trades after the turn player used all 3', () => {
  let st = game(3);
  st.own[1].owner = 1;
  st.proposals = 3; // the turn player (P0) has made three offers
  top(st, 'chest', c => c.kind === 'each' && c.amount > 0); // birthday: everyone pays P0 $10
  st.players[1].cash = 0;
  st = roll(st, 1, 1); // P0 to Community Chest
  assert.strictEqual(st.phase, 'debt');
  assert.strictEqual(E.actor(st), 1);
  st = E.apply(st, { type: 'propose', seat: 1, trade: { to: 2, give: [1], getCash: 30 } });
  assert.strictEqual(st.phase, 'trade');
  // still capped at three for that debtor
  st = act(st, 'reject');
  st = E.apply(st, { type: 'propose', seat: 1, trade: { to: 2, give: [1], getCash: 31 } }); st = act(st, 'reject');
  st = E.apply(st, { type: 'propose', seat: 1, trade: { to: 2, give: [1], getCash: 32 } }); st = act(st, 'reject');
  assert.throws(() => E.apply(st, { type: 'propose', seat: 1, trade: { to: 2, give: [1], getCash: 33 } }), /three offers/);
  assert.strictEqual(E.offersLeft(st, 1), 0);
});

test('the Chairman card with 7 opponents: pays who it can, owes the rest, and giving up clears every claim', () => {
  let st = game(8);
  st.players[0].cash = 100;
  top(st, 'chance', c => c.kind === 'each' && c.amount < 0);
  st = roll(st, 3, 4);
  assert.strictEqual(st.phase, 'debt');
  assert.strictEqual(st.debts.length, 5);
  st = act(st, 'bankrupt');
  assert.strictEqual(st.debts.length, 0);
  assert.strictEqual(st.phase, 'roll');
  assert.strictEqual(E.actor(st), 1);
});

test('back three spaces from Chance (36) lands on Community Chest and draws that card too', () => {
  let st = game(2);
  st.players[0].pos = 33;
  top(st, 'chance', c => c.kind === 'back3');
  st = roll(st, 1, 2);
  assert.strictEqual(st.players[0].pos, 33);
  assert.strictEqual(st.lastCard.deck, 'chest');
});

test('both Get Out of Jail Free cards held: each deck shows 15', () => {
  let st = game(2);
  top(st, 'chance', c => c.kind === 'goojf'); top(st, 'chest', c => c.kind === 'goojf');
  st = roll(st, 3, 4); st = act(st, 'end');
  st = roll(st, 1, 1);
  const v = E.view(st, 0);
  assert.deepStrictEqual(v.decks, { chance: 15, chest: 15 });
});

test('a hotel cannot be sold back while the bank has fewer than 4 houses', () => {
  const st = game(2);
  [37, 39].forEach(i => { st.own[i].owner = 0; st.own[i].houses = 5; });
  let left = 30;
  for (const i of [16, 18, 19, 21, 23, 24, 26, 27]) { st.own[i].owner = 1; st.own[i].houses = Math.min(4, left); left -= st.own[i].houses; }
  assert.ok($.housesInUse(st).housesLeft < 4);
  assert.strictEqual($.canSell(st, 0, 39), false);
});

test('8 computers and 2 computers both play to a finish', () => {
  for (const n of [8, 2]) {
    let st = E.newGame(Array.from({ length: n }, (_, k) => ({ name: 'C' + k, kind: 'cpu', level: ['easy', 'medium', 'hard'][k % 3] })), {}, 90 + n);
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 200000) st = E.apply(st, AI.choose(st, E.actor(st)).action);
    assert.strictEqual(st.phase, 'over', n + ' seats');
  }
});
