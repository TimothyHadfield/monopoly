/* Monopoly as a game object for the shared online.js module.
   The engine stays the referee: apply(state, action) / view(state, seat).
   Nothing in Monopoly is secret except the dice seed and deck order, so
   privateView is empty and publicView is Engine.view. */
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const Engine = node ? require('./engine.js') : root.Engine;
  const AI = node ? require('./ai.js') : root.AI;
  const LEVELS = ['easy', 'medium', 'hard'];

  const MonoGame = {
    id: 'monopoly',
    minSeats: 2,
    maxSeats: 8,
    // options = { rules: {...engine rules}, levels: ['medium', ...] per seat }
    setup(n, options, rng, seats) {
      const o = options || {}, lv = o.levels || [];
      const players = [];
      for (let k = 0; k < n; k++) {
        const s = (seats && seats[k]) || {};
        players.push({
          name: String(s.name || 'Seat ' + (k + 1)).slice(0, 20),
          kind: s.kind === 'human' ? 'human' : 'cpu',
          level: LEVELS.includes(lv[k]) ? lv[k] : 'medium',
        });
      }
      const rules = Object.assign({}, o.rules || {});
      delete rules.manualDice; // online dice always come from the referee's seeded roll
      const st = Engine.newGame(players, rules, Math.floor(rng() * 4294967295) + 1);
      return JSON.parse(JSON.stringify(st));
    },
    toAct(st) { const a = Engine.actor(st); return a >= 0 ? [a] : []; },
    apply(st, seat, action) {
      // the seat comes from online.js (the sender), never from the action itself
      const a = Object.assign({}, action || {}, { seat });
      delete a.dice;
      return Engine.apply(st, a);
    },
    publicView(st) { return Engine.view(st, -1); },
    privateView() { return {}; },
    bot(ctx, seat) {
      const st = ctx.state;
      // a seat that became a computer mid-game plays at medium unless set
      if (st.players[seat] && st.players[seat].kind !== 'cpu') {
        const c = JSON.parse(JSON.stringify(st));
        c.players[seat].kind = 'cpu';
        return AI.choose(c, seat).action;
      }
      return AI.choose(st, seat).action;
    },
    isOver(st) { return st.phase === 'over'; },
  };

  if (node) module.exports = MonoGame; else root.MonoGame = MonoGame;
})(this);
