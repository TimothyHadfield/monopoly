// Monopoly's part of the player profile (shared kit: js/profile.js, never edit that one here).
// The computer levels' ratings, the achievement list, today's Daily game and turning a finished game into a result.
(function (root) {
  'use strict';
  // Elo of each level. Hard beats Medium 68.4% one-on-one (docs/sim-hard-medium-2p-v2.json, 1,000 games,
  // 2026-10-27): +134. Medium vs Easy one-on-one is luck-heavy (Medium 44%, though Medium wins 78% against
  // three Easy computers), so Medium is set 100 above Easy by judgement. Easy anchored at 1200.
  const LEVELS = [
    { id: 'easy', name: 'Easy', rating: 1200 },
    { id: 'medium', name: 'Medium', rating: 1300 },
    { id: 'hard', name: 'Hard', rating: 1435 },
  ];
  const RANK = { easy: 0, medium: 1, hard: 2 };
  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const achievements = () => [
    { id: 'first', title: 'First win', desc: 'Win a game', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Landlord', desc: 'Beat Medium', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Tycoon', desc: 'Beat Hard', test: c => won(c) && c.last.level === 'hard' },
    { id: 'crowd', title: 'Full table', desc: 'Win against 5 or more computers', test: c => won(c) && ex(c).players >= 6 },
    { id: 'set', title: 'Colour set', desc: 'Own a whole colour set', test: c => ex(c).sets >= 1 },
    { id: 'hotel', title: 'Hotelier', desc: 'Build a hotel', test: c => !!ex(c).hotel },
    { id: 'rails', title: 'All aboard', desc: 'Own all four railroads at once', test: c => !!ex(c).rails },
    { id: 'rich', title: 'Deep pockets', desc: 'Be worth $5,000 at some point', test: c => ex(c).peak >= 5000 },
    { id: 'quick', title: 'Fast money', desc: 'Win a full game in 25 rounds or fewer', test: c => won(c) && !ex(c).short && ex(c).rounds <= 25 },
    { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily player', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same dice and decks for everyone that day (the engine's seed),
  // the official short game against two Hard computers.
  function dailyGame(seed) {
    return { seed: (seed >>> 0) || 1, seats: [{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level: 'hard' }, { name: 'Bo', kind: 'cpu', level: 'hard' }], rules: { shortGame: true } };
  }

  // what happened to `me` during a game, kept while it is played (the end state may have lost it all)
  function track(acc, st, me, Money, GROUPS) {
    acc = acc || { sets: 0, hotel: false, rails: false, peak: 0 };
    if (me < 0 || !st.players[me]) return acc;
    let sets = 0;
    for (const g in GROUPS) if (g !== 'rr' && g !== 'util' && Money.ownsGroup(st, me, g)) sets++;
    acc.sets = Math.max(acc.sets, sets);
    if (st.own.some(o => o.owner === me && o.houses === 5)) acc.hotel = true;
    if (GROUPS.rr.every(i => st.own[i].owner === me)) acc.rails = true;
    acc.peak = Math.max(acc.peak, Math.round(Money.netWorth(st, me)));
    return acc;
  }

  // A finished local game -> Profile.recordResult input. helped: Hint or Undo was used -> "with help", not rated.
  // Only a game with exactly one person against computers counts against a level; more people = pass-and-play.
  function result(st, me, opts) {
    opts = opts || {};
    const humans = st.players.filter(p => p.kind === 'human').length;
    const levels = st.players.filter((p, i) => i !== me && p.kind === 'cpu').map(p => p.level).filter(l => RANK[l] != null);
    const level = levels.length ? levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a)) : null; // the strongest computer at the table
    const tied = st.tie && st.tie.length > 1 ? st.tie : [st.winner];
    const iWon = tied.includes(me);
    const extra = Object.assign({ players: st.players.length, rounds: st.round, short: !!(st.rules.shortGame || st.rules.roundLimit) }, opts.acc || {});
    if (humans > 1) return { mode: 'friends', won: null, daily: false, extra };
    const mode = opts.helped ? 'help' : 'computer';
    return { mode, level: mode === 'computer' ? level : null, won: iWon && tied.length === 1, draw: iWon && tied.length > 1, daily: !!opts.daily, extra };
  }

  const api = { LEVELS, achievements, dailyGame, result, track };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MonoProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
