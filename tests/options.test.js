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

// ---- wave 3 house rules (2026-10-28): every option the Play setup offers reaches the engine
test('Setup switches map onto engine rules (pass Go first, even building off, Free Parking $500 seed)', () => {
  assert.strictEqual(typeof E.fromSetup, 'function', 'Engine.fromSetup missing');
  const r = E.fromSetup({ auction: false, freeParking: true, parkingSeed: 500, doubleGo: true, goAroundFirst: true, evenBuild: false, oldTaxes: true, startCash: 2000, noJailRent: true, shortGame: false, roundLimit: 20 });
  assert.deepStrictEqual(
    [r.auction, r.freeParking, r.parkingSeed, r.doubleGo, r.goAroundFirst, r.evenBuild, r.incomeTax10, r.luxuryTax, r.startCash, r.noJailRent, r.roundLimit],
    [false, true, 500, true, true, false, true, 75, 2000, true, 20]);
  const d = E.fromSetup({});
  assert.deepStrictEqual([d.auction, d.freeParking, d.parkingSeed, d.goAroundFirst, d.evenBuild, d.startCash], [true, false, 0, false, true, 1500], 'base rules stay the default');
});

test('Even building off: a second house may go on one street of a set; the default refuses', () => {
  const $ = require('../js/money.js');
  const table = rules => { const st = E.newGame(two(), rules, 1); st.own[1].owner = 0; st.own[3].owner = 0; st.own[1].houses = 1; return st; };
  assert.strictEqual($.canBuild(table({}), 0, 1), false, 'official rule: build evenly');
  const off = table({ evenBuild: false });
  assert.strictEqual($.canBuild(off, 0, 1), true);
  off.own[3].houses = 0; off.own[1].houses = 2;
  assert.strictEqual($.canSell(off, 0, 1), true, 'selling need not be even either');
  // a hotel still needs four houses on that street
  off.own[1].houses = 3; assert.strictEqual($.canBuild(off, 0, 1), true);
  let st = E.newGame(two(), { evenBuild: false, manualDice: true }, 1);
  st.own[1].owner = 0; st.own[3].owner = 0; st.phase = 'end'; st.resume = 'end';
  st = E.apply(st, { seat: 0, type: 'build', sq: 1 }); st = E.apply(st, { seat: 0, type: 'build', sq: 1 });
  assert.deepStrictEqual([st.own[1].houses, st.own[3].houses], [2, 0]);
});

test('Free Parking $500 seed: the pot starts at $500 and is refilled after someone takes it', () => {
  let st = E.newGame(two(), { freeParking: true, parkingSeed: 500, manualDice: true }, 1);
  assert.strictEqual(st.pot, 500);
  st.players[0].pos = 15; // Pennsylvania RR, 5 to Free Parking
  const before = st.players[0].cash;
  st = E.apply(st, { seat: 0, type: 'roll', dice: [2, 3] });
  assert.strictEqual(st.players[0].pos, 20);
  assert.strictEqual(st.players[0].cash, before + 500);
  assert.strictEqual(st.pot, 500, 'seed put back');
  assert.strictEqual(E.newGame(two(), { freeParking: true }, 1).pot, 0, 'no seed unless asked');
  assert.strictEqual(E.newGame(two(), { parkingSeed: 500 }, 1).pot, 0, 'seed needs the pot rule');
});

test('Pass Go first: no buying (and no auction) until a player has passed Go once', () => {
  let st = E.newGame(two(), { goAroundFirst: true, manualDice: true }, 3);
  st = E.apply(st, { seat: 0, type: 'roll', dice: [2, 4] });
  assert.strictEqual(st.players[0].pos, 6);
  assert.notStrictEqual(st.phase, 'buy'); assert.notStrictEqual(st.phase, 'auction');
  assert.strictEqual(st.own[6].owner, -1);
  st.players[1].passedGo = true; st.turn = 1; st.phase = 'roll'; st.resume = 'roll';
  st = E.apply(st, { seat: 1, type: 'roll', dice: [2, 4] });
  assert.strictEqual(st.phase, 'buy');
});

// Easy plays with Math.random, so a rare game can still circle to the safety stop (base rules: under 5%, finish.test.js)
test('Computers finish games under every house rule (safety stop in at most 2 of 36 games)', () => {
  const { playGame } = require('../tools/sim.js');
  const rules = [{ freeParking: true, parkingSeed: 500 }, { doubleGo: true }, { auction: false }, { goAroundFirst: true }, { evenBuild: false }, { noJailRent: true }];
  const stalled = [];
  for (const r of rules) {
    for (let g = 0; g < 6; g++) {
      const st = playGame(['hard', 'medium', 'easy', 'medium'], r, 9100 + g);
      if (st.turns >= E.DEFAULT_RULES.maxTurns) stalled.push(JSON.stringify(r));
    }
  }
  assert.ok(stalled.length <= 2, 'stalled: ' + stalled.join(', '));
});

test('Rules sheet has a Videos section: 2-5 YouTube links that open in a new tab', () => {
  require('../js/tutorial.js');
  const sec = globalThis.MonoTutorial.rules().sections.find(s => s.id === 'videos');
  assert.ok(sec, 'no Videos section');
  const links = sec.html.match(/<a [^>]*>/g) || [];
  assert.ok(links.length >= 2 && links.length <= 5, links.length + ' links');
  links.forEach(a => assert.match(a, /href="https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}" target="_blank" rel="noopener"/));
});

test('Time limit: Medium beats Easy and Hard is at least Medium one-on-one (net worth decides)', () => {
  const AI = require('../js/ai.js');
  const { measure } = require('../tools/sim.js');
  const me = measure(150, ['medium', 'easy'], { roundLimit: 20 }).levels;
  const hm = measure(150, ['hard', 'medium'], { roundLimit: 20 }).levels;
  console.log(`  20 rounds: Medium vs Easy ${(me.medium.winRatePerSeat * 100).toFixed(1)}%, Hard vs Medium ${(hm.hard.winRatePerSeat * 100).toFixed(1)}% (clock ${AI.cfg.clock})`);
  assert.ok(me.medium.winRatePerSeat >= 0.6, 'Medium only ' + me.medium.winRatePerSeat);
  assert.ok(hm.hard.winRatePerSeat >= 0.5, 'Hard only ' + hm.hard.winRatePerSeat);
});
