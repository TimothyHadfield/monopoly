// House-rule options (starting cash, no rent in jail), the guided game's fixed first throw,
// and how a finished game becomes a My stats result.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');

const two = () => [{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level: 'easy' }];

test('Starting cash option sets everyone\'s money; the default stays $1,500', () => {
  assert.strictEqual(E.newGame(two(), {}, 1).players[0].cash, 1500);
  const st = E.newGame(two(), { startCash: 2000 }, 1);
  assert.deepStrictEqual(st.players.map(p => p.cash), [2000, 2000]);
});

// Ada owns Oriental Avenue (6) and sits in jail; You throw 2 + 4 from Go and land on it.
function jailTable(rules) {
  let st = E.newGame(two(), Object.assign({ manualDice: true }, rules), 3);
  st.own[6].owner = 1;
  st.players[1].jail = 1; st.players[1].pos = 10;
  st = E.apply(st, { seat: 0, type: 'roll', dice: [2, 4] });
  return st;
}
test('No rent in jail: an owner in jail collects nothing (off by default)', () => {
  const on = jailTable({ noJailRent: true });
  assert.strictEqual(on.players[0].pos, 6);
  assert.strictEqual(on.players[0].cash, 1500, 'you paid rent to a jailed owner');
  assert.ok(on.log.some(l => /in jail: no rent/.test(l)));
  const off = jailTable({});
  assert.ok(off.players[0].cash < 1500, 'standard rules: rent is paid even while the owner is in jail');
});

test('Guided game: the fixed seed throws 2 + 4 onto Oriental Avenue', () => {
  global.Engine = E;
  require('../js/tutorial.js');
  const T = globalThis.MonoTutorial, t = T.setup();
  let st = E.newGame(t.seats, {}, t.seed);
  st = E.apply(st, { seat: 0, type: 'roll' });
  assert.deepStrictEqual(st.dice, [2, 4]);
  assert.strictEqual(st.players[0].pos, T.FIRST_LOT);
  assert.strictEqual(st.phase, 'buy');
  assert.ok(T.rules().sections.length >= 8);
});

test('My stats: Hint/Undo makes a game "with help" (unrated); pass-and-play is never rated', () => {
  const P = require('../js/profile-mono.js');
  const st = E.newGame([{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level: 'easy' }, { name: 'Bo', kind: 'cpu', level: 'hard' }], {}, 1);
  st.phase = 'over'; st.winner = 0;
  const clean = P.result(st, 0, {});
  assert.deepStrictEqual([clean.mode, clean.level, clean.won], ['computer', 'hard', true]);
  const help = P.result(st, 0, { helped: true });
  assert.deepStrictEqual([help.mode, help.level], ['help', null]);
  st.winner = 1;
  assert.strictEqual(P.result(st, 0, {}).won, false);
  const pp = E.newGame([{ name: 'A', kind: 'human' }, { name: 'B', kind: 'human' }], {}, 1);
  pp.phase = 'over'; pp.winner = 0;
  assert.strictEqual(P.result(pp, 0, {}).mode, 'friends');
  assert.strictEqual(P.LEVELS.find(l => l.id === 'hard').rating > P.LEVELS.find(l => l.id === 'medium').rating, true);
});
