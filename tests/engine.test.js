// Game rules: each case is set up by hand with fixed dice ("real dice" mode).
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
const chanceTop = (st, kind) => { const i = B.CHANCE.findIndex(c => c.kind === kind); st.decks.chance = [i].concat(st.decks.chance.filter(x => x !== i)); };

test('move, pass Go for $200, buy', () => {
  let st = game();
  st.players[0].pos = 35;
  st = roll(st, 3, 4); // 42 -> 2 (Community Chest) passes Go
  assert.strictEqual(st.players[0].pos === 2 || st.players[0].pos !== 35, true);
  assert.ok(st.players[0].cash >= 1500 + 200 - 100, 'got $200 for passing Go');
  st = game();
  st = roll(st, 1, 2); // to Baltic (3)
  assert.strictEqual(st.phase, 'buy');
  st = act(st, 'buy');
  assert.strictEqual(st.own[3].owner, 0);
  assert.strictEqual(st.players[0].cash, 1440);
  assert.strictEqual(st.phase, 'end');
});

test('doubles roll again; a third double goes straight to jail without moving', () => {
  let st = game();
  st = roll(st, 2, 2); // 4 income tax
  assert.strictEqual(st.players[0].cash, 1300);
  assert.strictEqual(st.phase, 'roll');
  st = roll(st, 1, 1); // 6 Oriental
  st = act(st, 'decline'); // auction
  assert.strictEqual(st.phase, 'auction');
  st = act(st, 'pass'); st = act(st, 'pass');
  assert.strictEqual(st.own[6].owner, -1, 'no bids: stays with the bank');
  assert.strictEqual(st.phase, 'roll');
  st = roll(st, 3, 3);
  assert.strictEqual(st.players[0].pos, 10);
  assert.strictEqual(st.players[0].jail, 1);
  assert.strictEqual(st.phase, 'end');
});

test('Go To Jail pays no salary; three missed tries then pay $50 and move', () => {
  let st = game();
  st.players[0].pos = 25;
  st = roll(st, 2, 3); // 30
  assert.strictEqual(st.players[0].pos, 10);
  assert.strictEqual(st.players[0].cash, 1500);
  st = act(st, 'end');
  const p1 = s => { s.players[1].pos = 0; s.players[1].cash = 1500; s = roll(s, 1, 3); return act(s, 'end'); }; // P1 pays income tax
  st = p1(st);
  st = roll(st, 1, 2); assert.strictEqual(st.players[0].pos, 10); st = act(st, 'end');
  st = p1(st);
  st = roll(st, 1, 2); assert.strictEqual(st.players[0].pos, 10); st = act(st, 'end');
  st = p1(st);
  st = roll(st, 1, 2); // third miss: pay 50, move 3 to 13 (States Ave)
  assert.strictEqual(st.players[0].pos, 13);
  assert.strictEqual(st.players[0].cash, 1450);
  assert.strictEqual(st.players[0].jail, 0);
});

test('doubles out of jail move you but give no extra throw', () => {
  let st = game();
  st.players[0].pos = 10; st.players[0].jail = 1;
  st = roll(st, 4, 4); // 18 Tennessee
  assert.strictEqual(st.players[0].pos, 18);
  st = act(st, 'decline'); st = act(st, 'pass'); st = act(st, 'pass');
  assert.strictEqual(st.phase, 'end');
});

test('auction: highest bid wins and pays', () => {
  let st = game(3);
  st = roll(st, 1, 2); st = act(st, 'decline');
  st = act(st, 'bid', { amount: 10 });           // P0
  assert.throws(() => act(st, 'bid', { amount: 10 }), /bad bid/); // must beat the high bid
  st = act(st, 'bid', { amount: 40 });           // P1
  st = act(st, 'pass');                           // P2
  st = act(st, 'pass');                           // P0
  assert.strictEqual(st.own[3].owner, 1);
  assert.strictEqual(st.players[1].cash, 1460);
});

test('rent, short of cash -> debt -> mortgage -> pay', () => {
  let st = game();
  st.own[39].owner = 1; st.own[37].owner = 1; st.own[39].houses = 5;
  st.own[1].owner = 0;
  st.players[0].pos = 33; st.players[0].cash = 1000;
  st = roll(st, 3, 3); // 39 Boardwalk hotel: $2000
  assert.strictEqual(st.phase, 'debt');
  assert.throws(() => act(st, 'payDebt'));
  st = E.apply(st, { type: 'mortgage', seat: 0, sq: 1 });
  assert.strictEqual(st.players[0].cash, 1030);
  st = act(st, 'bankrupt');
  assert.ok(st.players[0].out);
  assert.strictEqual(st.own[1].owner, 1, 'creditor gets the lots');
  assert.strictEqual(st.phase, 'over');
  assert.strictEqual(st.winner, 1);
  // 1500 + 1030 cash, minus 10% interest on the mortgaged Mediterranean ($3)
  assert.strictEqual(st.players[1].cash, 1500 + 1030 - 3);
});

test('bankrupt to the bank: lots return and are auctioned', () => {
  let st = game(3);
  st.own[1].owner = 0; st.players[0].cash = 10; st.players[0].pos = 1;
  st = roll(st, 1, 2); // income tax $200
  assert.strictEqual(st.phase, 'debt');
  st = act(st, 'bankrupt');
  assert.strictEqual(st.phase, 'auction');
  assert.strictEqual(st.auction.sq, 1);
  assert.ok(!st.auction.active.includes(0));
});

test('cards: nearest railroad pays double; back 3; Advance to Go', () => {
  let st = game();
  st.own[15].owner = 1;
  st.players[0].pos = 4;
  chanceTop(st, 'rr');
  st = roll(st, 1, 2); // 7 Chance -> 15 Pennsylvania RR, owned: 2 x $25
  assert.strictEqual(st.players[0].pos, 15);
  assert.strictEqual(st.players[0].cash, 1450);
  st = game(); st.players[0].pos = 33;
  chanceTop(st, 'back3');
  st = roll(st, 1, 2); // 36 Chance -> 33
  assert.strictEqual(st.players[0].pos, 33);
  st = game(); st.players[0].pos = 33;
  st.decks.chance = [1].concat(st.decks.chance.filter(x => x !== 1)); // Advance to Go
  st = roll(st, 1, 2);
  assert.strictEqual(st.players[0].pos, 0);
  assert.strictEqual(st.players[0].cash, 1700);
});

test('jail card is kept, then goes back under the deck when used', () => {
  let st = game();
  st.players[0].pos = 4; chanceTop(st, 'goojf');
  st = roll(st, 1, 2);
  assert.deepStrictEqual(st.players[0].cards, ['chance']);
  assert.strictEqual(st.decks.chance.length, 15);
  st = act(st, 'end'); st = roll(st, 1, 2); st = act(st, 'decline'); st = act(st, 'pass'); st = act(st, 'pass'); st = act(st, 'end');
  st.players[0].jail = 1; st.players[0].pos = 10;
  st = act(st, 'useCard');
  assert.strictEqual(st.decks.chance.length, 16);
  assert.strictEqual(st.players[0].jail, 0);
});

test('building rules through the engine: full set, even, not during someone else\'s turn', () => {
  let st = game();
  [37, 39].forEach(i => { st.own[i].owner = 0; });
  st = E.apply(st, { type: 'build', seat: 0, sq: 39 });
  assert.throws(() => E.apply(st, { type: 'build', seat: 0, sq: 39 }), /cannot build/);
  st = E.apply(st, { type: 'build', seat: 0, sq: 37 });
  assert.strictEqual(st.players[0].cash, 1100);
  assert.throws(() => E.apply(st, { type: 'build', seat: 1, sq: 37 }), /not now/);
});

test('trade: mortgaged lot costs the receiver 10% at once', () => {
  let st = game();
  st.own[39].owner = 1; st.own[39].mort = true;
  st = E.apply(st, { type: 'propose', seat: 0, trade: { to: 1, give: [], get: [39], giveCash: 100 } });
  assert.strictEqual(st.phase, 'trade');
  assert.strictEqual(E.actor(st), 1);
  st = E.apply(st, { type: 'accept', seat: 1 });
  assert.strictEqual(st.own[39].owner, 0);
  assert.strictEqual(st.players[0].cash, 1500 - 100 - 20);
  assert.strictEqual(st.players[1].cash, 1600);
});

test('house rules: Free Parking pot, $400 on Go', () => {
  let st = game(2, { freeParking: true });
  st = roll(st, 1, 3); // income tax 200 -> pot
  assert.strictEqual(st.pot, 200);
  st = act(st, 'end'); st = roll(st, 6, 4); // P1 to Jail (just visiting)
  st = act(st, 'end');
  st.players[0].pos = 16; st = roll(st, 1, 3); // 20 Free Parking
  assert.strictEqual(st.players[0].cash, 1300 + 200);
  st = game(2, { doubleGo: true }); st.players[0].pos = 36; st = roll(st, 1, 3);
  assert.strictEqual(st.players[0].cash, 1900);
});

test('official short game: 3 free deeds, hotel after 3 houses, one jail try', () => {
  let st = game(3, { shortGame: true });
  st.players.forEach((p, i) => {
    assert.strictEqual(p.cash, 1500);
    assert.strictEqual(st.own.filter(o => o.owner === i).length, 3);
  });
  const s2 = { players: st.players, own: $.newOwn(), rules: st.rules };
  [1, 3].forEach(i => { s2.own[i].owner = 0; s2.own[i].houses = 3; });
  assert.ok($.canBuild(s2, 0, 1));
  assert.strictEqual($.nextLevel(s2, 3), 5);
});

test('view hides the dice seed and the deck order', () => {
  const st = game();
  const v = E.view(st, 1);
  assert.strictEqual(v.seed, undefined);
  assert.strictEqual(v.decks.chance, 16);
  assert.ok(st.seed !== undefined, 'original untouched');
});

test('online seat cannot pick its own dice unless real-dice mode is on', () => {
  let st = E.newGame(seats(2), {}, 99);
  const a = E.apply(st, { type: 'roll', seat: 0, dice: [6, 6] });
  const b = E.apply(st, { type: 'roll', seat: 0 });
  assert.deepStrictEqual(a.dice, b.dice, 'requested dice ignored');
});

test('wrong seat or wrong phase is refused', () => {
  const st = game();
  assert.throws(() => E.apply(st, { type: 'roll', seat: 1, dice: [1, 2] }), /not your turn/);
  assert.throws(() => E.apply(st, { type: 'end', seat: 0 }), /not now/);
  assert.throws(() => E.apply(st, { type: 'buy', seat: 0 }), /not now/);
});

test('40 full computer games: rules invariants hold after every action', () => {
  const levels = ['easy', 'medium', 'hard'];
  for (let g = 0; g < 40; g++) {
    const n = 2 + (g % 5);
    let st = E.newGame(Array.from({ length: n }, (_, i) => ({ name: 'C' + i, kind: 'cpu', level: levels[(g + i) % 3] })),
      { freeParking: g % 4 === 1, shortGame: g % 4 === 2, roundLimit: g % 4 === 3 ? 40 : 0 }, 500 + g);
    let steps = 0;
    while (st.phase !== 'over') {
      const me = E.actor(st);
      st = E.apply(st, AI.choose(st, me).action);
      steps++;
      const bank = $.housesInUse(st);
      assert.ok(bank.housesLeft >= 0 && bank.hotelsLeft >= 0, 'bank pieces');
      if (st.phase === 'roll' || st.phase === 'end') st.players.forEach(p => assert.ok(p.cash >= 0, 'no negative cash outside debts'));
      st.own.forEach((o, i) => {
        if (o.owner >= 0) assert.ok(!st.players[o.owner].out, 'out players own nothing');
        if (o.houses) assert.ok($.ownsGroup(st, o.owner, B.SQ[i].group) && !o.mort, 'buildings only on full unmortgaged sets');
      });
      assert.ok(steps < 300000, 'game ends');
    }
    assert.ok(st.winner >= 0);
  }
});
