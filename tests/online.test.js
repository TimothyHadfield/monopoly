// The Monopoly game object for the shared online.js module.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const G = require('../js/mono-online.js');

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('bot-only games through the online interface end, stay JSON-safe, never stall', () => {
  for (let g = 0; g < 12; g++) {
    const rng = mulberry(g + 1);
    const n = 2 + (g % 4);
    const seats = Array.from({ length: n }, (_, k) => ({ kind: 'computer', name: 'C' + k }));
    let s = G.setup(n, { rules: { roundLimit: g % 2 ? 20 : 0, freeParking: g % 3 === 0 }, levels: ['hard', 'easy', 'medium'] }, rng, seats);
    let steps = 0;
    while (!G.isOver(s)) {
      const who = G.toAct(s);
      assert.equal(who.length, 1, 'exactly one seat acts');
      const seat = who[0];
      const ctx = { pub: G.publicView(s), mine: G.privateView(s, seat), state: s };
      s = G.apply(JSON.parse(JSON.stringify(s)), seat, G.bot(ctx, seat, rng));
      if (steps % 50 === 0) assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'state survives JSON');
      assert.ok(++steps < 60000, 'game ends');
    }
    assert.ok(s.winner >= 0);
  }
});

test('the sender seat wins over a seat written in the action, and dice cannot be forced', () => {
  const s = G.setup(2, {}, mulberry(3), [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }]);
  assert.deepEqual(G.toAct(s), [0]);
  assert.throws(() => G.apply(s, 1, { type: 'roll', seat: 0 }), /./, 'seat 1 cannot roll for seat 0');
  // dice in the action are ignored: two different requested dice give the same roll
  const a = G.apply(s, 0, { type: 'roll', dice: [6, 6] });
  const b = G.apply(s, 0, { type: 'roll', dice: [1, 2] });
  assert.deepEqual(a.dice, b.dice);
});

test('public view hides the dice seed and deck order; private view is empty', () => {
  const s = G.setup(3, {}, mulberry(9), []);
  const pub = G.publicView(s);
  assert.equal(pub.seed, undefined);
  assert.equal(typeof pub.decks.chance, 'number');
  assert.deepEqual(G.privateView(s, 1), {});
});

test('createLocal plays an all-computer game to the end', async () => {
  const { createLocal } = await import(pathToFileURL(path.join(__dirname, '../js/online.js')).href);
  const room = createLocal({ game: G, seats: ['computer', 'computer', 'computer'], options: { rules: { roundLimit: 20 } }, botDelayMs: 0, rng: mulberry(5) });
  const done = new Promise(res => room.on('change', snap => { if (snap.status === 'finished') res(snap); }));
  room.start();
  const snap = await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))]);
  assert.equal(snap.pub.phase, 'over');
  if (room.stop) room.stop();
});
