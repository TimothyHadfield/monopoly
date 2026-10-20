// Measure computer strength: play many full games between computer levels.
// usage: node tools/sim.js <games> <level,level,...> [rule=value ...]
// Seats rotate each game so nobody keeps the first-move edge.
const Engine = require('../js/engine.js');
const AI = require('../js/ai.js');

function playGame(levels, rules, seed) {
  let st = Engine.newGame(levels.map((l, i) => ({ name: l + i, kind: 'cpu', level: l })), rules, seed);
  let steps = 0;
  while (st.phase !== 'over') {
    const me = Engine.actor(st);
    const { action } = AI.choose(st, me);
    st = Engine.apply(st, action);
    if (++steps > 200000) throw new Error('stuck at ' + st.phase);
  }
  return st;
}

function measure(n, levels, rules) {
  const wins = {}, games = {};
  let turns = 0, byWorth = 0;
  for (let g = 0; g < n; g++) {
    const rot = levels.map((_, i) => levels[(i + g) % levels.length]);
    const st = playGame(rot, rules, 1000 + g);
    rot.forEach(l => { games[l] = (games[l] || 0) + 1; });
    const w = rot[st.winner];
    wins[w] = (wins[w] || 0) + 1;
    turns += st.turns;
    if (st.players.filter(p => !p.out).length > 1) byWorth++;
  }
  const out = {};
  for (const l in games) out[l] = { seats: games[l], wins: wins[l] || 0, winRatePerSeat: (wins[l] || 0) / games[l] };
  return { games: n, avgTurns: Math.round(turns / n), endedByLimit: byWorth, levels: out };
}

if (require.main === module) {
  const n = +process.argv[2] || 100;
  const levels = (process.argv[3] || 'hard,medium,medium,medium').split(',');
  const rules = {};
  process.argv.slice(4).forEach(kv => { const [k, v] = kv.split('='); rules[k] = isNaN(+v) ? v === 'true' : +v; });
  const t0 = Date.now();
  const r = measure(n, levels, rules);
  r.seconds = (Date.now() - t0) / 1000;
  console.log(JSON.stringify(r, null, 1));
}
module.exports = { playGame, measure };
