// Sounds, celebrations and animations: the event -> sound map for a scripted game,
// the Settings switches (Sound off = silent, Animations off = nothing moves),
// and the right celebration at game over. Uses the real js/fx.js with a fake
// Web Audio and a fake DOM (counts animate() calls and overlays).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ---- fake browser bits (before fx.js loads)
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
globalThis.matchMedia = () => ({ matches: false });
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const anode = extra => Object.assign({ connect() {}, disconnect() {} }, extra);
const src = () => anode({ start() {}, stop() {} });
class FakeAC {
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = {}; this.t = 0; }
  get currentTime() { return (this.t += 1); } // every play is "later", so the 3-per-80ms throttle never hides a sound
  createGain() { return anode({ gain: param() }); }
  createOscillator() { return Object.assign(src(), { type: 'sine', frequency: param() }); }
  createBufferSource() { return Object.assign(src(), { buffer: null, loop: false }); }
  createBiquadFilter() { return anode({ type: 'lowpass', frequency: param(), Q: param() }); }
  createStereoPanner() { return anode({ pan: param() }); }
  createDynamicsCompressor() { return anode({}); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
globalThis.AudioContext = FakeAC;
const dom = { animates: 0, overlays: 0 };
const mkEl = () => ({
  style: {}, textContent: '', className: '', isConnected: true,
  animate() { dom.animates++; return {}; },
  getBoundingClientRect: () => ({ left: 10, top: 10, width: 20, height: 20 }),
  remove() {}, cloneNode: () => mkEl(), removeAttribute() {}, setAttribute() {}, getContext: () => null,
});
globalThis.document = { body: { appendChild() { dom.overlays++; } }, head: { appendChild() {} }, createElement: () => mkEl(), addEventListener() {}, removeEventListener() {}, getElementById: () => null };
globalThis.getComputedStyle = () => ({ borderRadius: '0' });

require('../js/fx.js');
const FX = globalThis.FX;
const MonoFX = require('../js/fx-game.js');
const E = require('../js/engine.js');

FX.init({ game: 'monopoly-test', clicks: false });
MonoFX.defineSounds(FX);
FX.unlock(); // the "first tap"

// spy: names that really played (FX.play returns true only when a sound started)
let played = [], celebrated = [];
const realPlay = FX.play, realCelebrate = FX.celebrate;
FX.play = (n, o) => { const ok = realPlay(n, o); if (ok) played.push(n); return ok; };
FX.celebrate = o => { celebrated.push(o.kind); return realCelebrate(o); };

const els = { token: () => mkEl(), square: () => mkEl(), cash: () => mkEl(), center: () => mkEl(), card: () => mkEl(), turnBtn: () => mkEl(), color: () => '#6ea8fe' };
const sync = (fn) => fn(); // run every scheduled effect at once (order is checked on the event list)
const ctx = { mine: k => k === 0, f: 1, colors: ['#6ea8fe', '#f0b354'] };
function act(st, a) {
  const nx = E.apply(st, a);
  const ev = MonoFX.events(st, nx, ctx);
  played = []; celebrated = [];
  MonoFX.run(ev, els, { schedule: sync });
  return { st: nx, ev, played: played.slice(), celebrated: celebrated.slice() };
}
function newTable() {
  const st = E.newGame([{ name: 'You', kind: 'human' }, { name: 'Bo', kind: 'cpu', level: 'medium' }], { manualDice: true }, 99);
  return st;
}
const reset = () => { FX.reset(); mem.clear(); };

test('scripted game: each real event plays the matching sound', () => {
  reset();
  let st = newTable(), r;
  // roll 1+2 from Go: two dice, the token hops 3 squares, the dice land; Baltic is for sale
  r = act(st, { type: 'roll', seat: 0, dice: [1, 2] }); st = r.st;
  assert.deepStrictEqual(r.played.filter(n => n === 'diceRoll').length, 2, 'one roll sound per die');
  assert.ok(r.played.includes('diceLand') && r.played.includes('place'), r.played.join());
  assert.strictEqual(r.played.filter(n => n === 'hop').length, 2, 'a tap on each square passed');
  const land = r.ev.find(e => e.snd === 'diceLand'), place = r.ev.find(e => e.snd === 'place');
  assert.ok(land.t >= 300 && place.t > 0, 'dice land as the tumble ends; the token lands after its walk');
  r = act(st, { type: 'buy', seat: 0 }); st = r.st;
  assert.ok(r.played.includes('stamp'), 'buying stamps the deed');
  r = act(st, { type: 'end', seat: 0 }); st = r.st;
  assert.ok(!r.played.includes('turn'), 'no chime when it becomes the computer\'s turn');
  // Bo lands on Baltic: rent coins (and a coin flies), then hands the turn back: your-turn chime
  r = act(st, { type: 'roll', seat: 1, dice: [1, 2] }); st = r.st;
  assert.ok(r.played.includes('coins'), 'rent paid = coins');
  assert.ok(r.ev.some(e => e.anim === 'coin' && e.from === 1 && e.to === 0), 'coin flies Bo -> You');
  const rentAt = r.ev.find(e => e.snd === 'coins').t, walkEnd = r.ev.find(e => e.snd === 'place').t;
  assert.ok(rentAt >= walkEnd, 'rent is paid when the token arrives, not before');
  r = act(st, { type: 'end', seat: 1 }); st = r.st;
  assert.ok(r.played.includes('turn'), 'your-turn chime');
  // You: from 38 a 1+2 passes Go (coins) onto Mediterranean
  st = JSON.parse(JSON.stringify(st)); st.players[0].pos = 38;
  r = act(st, { type: 'roll', seat: 0, dice: [1, 2] }); st = r.st;
  assert.ok(r.played.includes('coins'), 'pass Go = coins');
  assert.ok(r.ev.some(e => e.anim === 'cash' && e.seat === 0 && e.text === '+$200'), '+$200 floats');
  // completing the brown set (Mediterranean + Baltic) is a "big" moment
  r = act(st, { type: 'buy', seat: 0 }); st = r.st;
  assert.ok(r.played.includes('stamp') && r.celebrated.includes('big'), 'set completed = stamp + sparkle');
  // build on Baltic: a piece set down
  r = act(st, { type: 'build', seat: 0, sq: 3 }); st = r.st;
  assert.ok(r.played.includes('place') && r.ev.some(e => e.anim === 'pop' && e.sq === 3), 'house placed');
  r = act(st, { type: 'end', seat: 0 }); st = r.st;
  // Bo from 27 rolls 1+2 onto Go To Jail: clank
  st = JSON.parse(JSON.stringify(st)); st.players[1].pos = 27;
  r = act(st, { type: 'roll', seat: 1, dice: [1, 2] }); st = r.st;
  assert.ok(r.played.includes('clank'), 'go to jail = clank');
  r = act(st, { type: 'end', seat: 1 }); st = r.st;
  // You from 4 rolls 1+2 onto Chance: the card flips
  st = JSON.parse(JSON.stringify(st)); st.players[0].pos = 4;
  r = act(st, { type: 'roll', seat: 0, dice: [1, 2] }); st = r.st;
  assert.ok(r.played.includes('cardFlip') && r.ev.some(e => e.anim === 'card'), 'Chance card flip');
  // computer sounds are never louder than yours
  assert.ok(r.ev.filter(e => e.snd).every(e => (e.opt.vol == null ? 1 : e.opt.vol) <= 1));
});

test('railroad buy whistles; an auction opens with a bell; bids are chips', () => {
  reset();
  let st = newTable(), r;
  st.rules.auction = true;
  r = act(st, { type: 'roll', seat: 0, dice: [2, 3] }); st = r.st; // Reading Railroad
  r = act(st, { type: 'buy', seat: 0 });
  assert.ok(r.played.includes('stamp') && r.played.includes('train'));
  r = act(st, { type: 'decline', seat: 0 }); st = r.st;
  assert.ok(r.played.includes('ding'), 'auction opens');
  r = act(st, { type: 'bid', seat: E.actor(st), amount: 10 });
  assert.ok(r.played.includes('chip'), 'a bid is a chip');
});

test('Sound off: nothing plays. Animations off: nothing animates', () => {
  const script = () => {
    let st = newTable();
    st = act(st, { type: 'roll', seat: 0, dice: [1, 2] }).st;
    st = act(st, { type: 'buy', seat: 0 }).st;
    st = act(st, { type: 'end', seat: 0 }).st;
    st = act(st, { type: 'roll', seat: 1, dice: [1, 2] }).st;
    return st;
  };
  let total = 0;
  reset(); const p0 = FX.stats.plays; dom.animates = 0; dom.overlays = 0;
  script();
  assert.ok(FX.stats.plays - p0 > 5 && dom.animates > 0 && dom.overlays > 0, 'with everything on, sounds and animations run (the check is not vacuous)');
  reset(); FX.set('sound', false);
  const p1 = FX.stats.plays; script(); total = FX.stats.plays - p1;
  assert.strictEqual(total, 0, 'Sound off = silent');
  reset(); FX.set('moves', false);
  const p2 = FX.stats.plays; script();
  assert.strictEqual(FX.stats.plays - p2, 0, 'Game sounds off = no dice, coins or stamps');
  reset(); FX.set('animations', false); dom.animates = 0; dom.overlays = 0;
  script();
  assert.strictEqual(dom.animates, 0, 'Animations off = no animate() calls');
  assert.strictEqual(dom.overlays, 0, 'Animations off = no flying coins, floats or confetti');
});

test('game over: you win -> win, you lose -> lose, colours of the winner', () => {
  for (const loser of [1, 0]) {
    reset();
    let st = newTable();
    st = JSON.parse(JSON.stringify(st));
    // the loser owes more than everything they have
    st.turn = loser; st.players[loser].cash = 5; st.debts = [{ who: loser, amount: 500, to: 1 - loser, why: 'rent' }]; st.phase = 'debt';
    const r = act(st, { type: 'bankrupt', seat: loser });
    assert.strictEqual(r.st.phase, 'over');
    assert.ok(r.played.includes('sink'), 'bankruptcy sinks');
    assert.deepStrictEqual(r.celebrated, [loser === 1 ? 'win' : 'lose']);
    const c = r.ev.find(e => e.celebrate);
    assert.strictEqual(c.colors[0], ctx.colors[1 - loser], 'winner\'s colour first');
  }
  // no celebration replays when an already-finished game re-renders
  reset();
  let st = newTable(); st.phase = 'over'; st.winner = 0;
  assert.deepStrictEqual(MonoFX.events(st, Object.assign({}, st, { log: st.log.concat('x') }), ctx), []);
});

test('the page loads fx.js + fx-game.js and Settings has the Sound & effects block', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(/js\/fx\.js/.test(html) && /js\/fx-game\.js/.test(html));
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.ok(/FX\.renderSettings\(/.test(app) && /MonoFX\.run\(/.test(app) && /FX\.init\(/.test(app));
  // the copy of the shared library is byte-for-byte
  const lib = path.join(root, '..', '_fx', 'fx.js');
  if (fs.existsSync(lib)) assert.ok(fs.readFileSync(lib).equals(fs.readFileSync(path.join(root, 'js/fx.js'))), 'js/fx.js is an unchanged copy of _fx/fx.js');
});
