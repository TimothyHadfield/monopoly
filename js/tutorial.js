// The rules sheet and the guided first game (shared kit: js/coach.js, never edit that one here).
// Rules are written in our own words from the 2008+ US rules (sources: docs/rules-check.md).
(function (root) {
  'use strict';
  // the guided game: you against one Easy computer; seed 6 makes your first throw 2 + 4, onto Oriental Avenue
  const SEED = 6;
  const FIRST_LOT = 6;
  function setup() {
    return { seed: SEED, seats: [{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level: 'easy' }], rules: {} };
  }

  // checked 2026-10-28: each returns 200 from youtube.com/oembed with this title and channel
  const VIDEOS = [
    { id: '4nz-_hvFw44', title: 'How To Play Monopoly Correctly! - A Full Tutorial', by: 'Watch It Played', note: 'How to play: the full official rules, step by step.' },
    { id: 'dvHqVyxdWYU', title: 'How to play Monopoly (2025 Rules)', by: 'Triple S Games', note: 'How to play: the rules in about five minutes.' },
    { id: 'wK7xcWFgHoA', title: 'The right way to play Monopoly', by: 'Vox', note: 'Strategy: a world-championship player on the odds, houses and the real rules.' },
    { id: 'AntpTSOyOYs', title: 'The Exact Math Behind the Jail Strategy in Monopoly', by: 'Almost Exact', note: 'Strategy: when to stay in jail (the same maths as the Odds tab).' },
  ];

  function rules() {
    return {
      title: 'Monopoly rules',
      intro: 'The classic US rules (2008 and later). Options for shorter games and house rules are on the Play tab before you start.',
      foot: 'Fan-made; not affiliated with the game\'s publisher.',
      sections: [
        { id: 'goal', title: 'Goal', short: 'Goal', html: '<p>Be the last player left who isn\'t bankrupt. You buy lots, charge rent when others land on them, and build houses and hotels to make that rent bigger.</p><p class="tip">Whole colour sets win games: one set with three houses on each lot is usually enough to break the other players.</p>' },
        { id: 'setup', title: 'Setup', short: 'Setup', html: '<ul><li>2 to 8 players, each with $1,500.</li><li>Everyone starts on Go; play goes in seat order.</li><li>The bank holds the money, 32 houses, 12 hotels and the deeds.</li></ul>' },
        { id: 'turn', title: 'Your turn', short: 'Turn', html: '<ol><li>Roll both dice and move that many spaces.</li><li>Do what the space says: buy it, pay rent or tax, or draw a card.</li><li>Build, trade or mortgage if you want, then end your turn.</li></ol><ul><li><b>Doubles</b>: take another turn. A third double in a row sends you straight to jail.</li><li><b>Passing Go</b>: collect $200.</li></ul>' },
        { id: 'buy', title: 'Buying and auctions', short: 'Buying', html: '<p>Land on a lot nobody owns and you may buy it at the printed price. If you don\'t, the bank auctions it at once: anyone, you included, may bid, and the highest bid wins.</p><p class="tip">"Worth about" on the Buy button is what the lot is worth to you: more if it finishes or blocks a colour set.</p>' },
        { id: 'rent', title: 'Rent', short: 'Rent', html: '<ul><li><b>Streets</b>: the rent on the deed. Owning the whole colour set doubles the rent of a street with no houses.</li><li><b>Railroads</b>: $25, $50, $100 or $200 for owning 1 to 4.</li><li><b>Utilities</b>: 4 times the dice, or 10 times if one owner has both.</li><li>A mortgaged lot charges no rent.</li></ul>' },
        { id: 'build', title: 'Houses and hotels', short: 'Build', html: '<ul><li>Own every street of a colour set (none mortgaged) to build on it, on your turn.</li><li>Build evenly: no street may get a second house before every street in its set has one.</li><li>After 4 houses a street can get a hotel (the 4 houses go back to the bank).</li><li>If the bank runs out of houses, nobody can build more until some come back.</li><li>Buildings sell back to the bank for half what they cost, evenly too.</li></ul>' },
        { id: 'jail', title: 'Jail', short: 'Jail', html: '<p>You go to jail from the Go To Jail space, a card, or three doubles in a row. You don\'t pass Go on the way.</p><p>To get out: pay $50, use a Get Out of Jail Free card, or roll doubles. After three failed rolls you pay $50 and move. You still collect rent while in jail.</p><p>Landing on Jail by a normal throw is "just visiting".</p>' },
        { id: 'cards', title: 'Chance and Community Chest', short: 'Cards', html: '<p>Land on one of these and take the top card of that deck, do what it says, and put it at the bottom. A Get Out of Jail Free card is kept until you use it (or sell it).</p>' },
        { id: 'money', title: 'Money trouble', short: 'Money', html: '<ul><li><b>Mortgage</b> a lot (no buildings in its set) to get half its price. Lifting it costs that plus 10%.</li><li>Short of cash: sell buildings, mortgage lots or trade until you can pay.</li><li>If you still can\'t pay, you are bankrupt: everything you have goes to the player you owe (or the bank, which auctions your lots).</li></ul>' },
        { id: 'trade', title: 'Trading', short: 'Trade', html: '<p>On your turn you may offer any other player a trade: lots, cash and Get Out of Jail Free cards, in any mix. A lot can\'t be traded while its colour set has buildings. Whoever receives a mortgaged lot pays the bank 10% interest at once.</p>' },
        { id: 'options', title: 'Shorter games and house rules', short: 'Options', html: '<ul><li><b>Short game</b>: three free deeds each, a hotel after 3 houses, one try to roll out of jail, and the game ends at the first bankruptcy: the richest player wins.</li><li><b>Time limit</b>: two deeds each (paid for), then the richest player after the last round wins.</li><li><b>Auctions off</b>: an unbought lot just stays with the bank.</li><li>House rules (not in the rulebook, but common at home): <b>Free Parking pot</b> (taxes and fees go to the middle; land on Free Parking to take them, optionally with $500 from the bank to start), <b>$400 on Go</b> for landing exactly on it, <b>pass Go before buying</b>, <b>build in any order</b> (no even building), <b>no rent in jail</b>, <b>starting cash</b>, and the older <b>pre-2008 taxes</b>.</li></ul>' },
        { id: 'videos', title: 'Videos', short: 'Videos', html: '<p>Watch the real game being played and explained (opens YouTube):</p><ul class="vids">'
          + VIDEOS.map(v => `<li><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${v.title}</a> · ${v.by}<br><span class="vnote">${v.note}</span></li>`).join('') + '</ul>' },
      ],
    };
  }

  // the steps: each points at a real part of the screen and moves on when the game does
  // ctx: { game: () => state|null (only while the guided game runs), me: 0 }
  function steps(ctx) {
    const G = () => ctx.game();
    const mine = () => { const g = G(); return g && Engine.actor(g) === 0; };
    return [
      { title: 'Your first game', text: 'You play against one easy computer, Ada. Your money and your deeds lie in front of you, here.', target: '#mine' },
      { title: 'Roll the dice', text: 'Tap Roll. Your piece walks round the board by the number you throw.', target: '#center [data-act="g:roll"]', until: () => { const g = G(); return !!g && (g.turns > 0 || g.phase !== 'roll'); } },
      { title: 'Buy it', text: 'Nobody owns Oriental Avenue yet. "Worth about" is what it is worth to you. Lots win games: tap Buy.', target: '#center [data-act="g:buy"]', skipIf: () => { const g = G(); return !g || g.phase !== 'buy'; }, until: () => { const g = G(); return !!g && g.phase !== 'buy'; } },
      { title: 'Your deed', text: 'The deed now lies in front of you, and your money went down by its price. When Ada lands here she pays you rent.', target: '#mine .mdeeds', skipIf: () => { const g = G(); return !g || g.own[FIRST_LOT].owner !== 0; } },
      { title: 'End your turn', text: 'Nothing else to do this turn: tap End turn.', target: '#center [data-act="g:end"]', when: () => { const g = G(); return !!g && g.phase === 'end' && g.turn === 0; }, until: () => { const g = G(); return !!g && (g.turn !== 0 || g.turns > 0); } },
      { title: 'Ada\'s turn', text: 'Computers play by themselves. Their money and deeds sit along the top. Wait for your turn to come back.', target: '#seats', until: () => { const g = G(); return !!g && g.turns >= 2 && mine(); }, next: true },
      { title: 'Hint', text: 'Not sure what to do? Hint tells you what the Hard computer would do, and why.', target: '#mine [data-act="hint"]' },
      { title: 'Undo', text: 'Changed your mind? Undo takes back your last move. Games where you used Hint or Undo count as "with help" in My stats.', target: '#mine [data-act="undo"]' },
      { title: 'Build and trade', text: 'Own a whole colour set and Manage lets you build houses on it. Trade swaps lots, cash and cards with other players to finish sets.', target: '#mine [data-act="manage"]' },
      { title: 'That\'s it', text: 'Play on against Ada. The rules are in Settings whenever you need them.', target: () => document.querySelector('#tabsBottom [data-tab="settings"]') && document.querySelector('#tabsBottom').offsetParent ? '#tabsBottom [data-tab="settings"]' : '#tabsTop [data-tab="settings"]' },
    ];
  }

  root.MonoTutorial = { setup, rules, steps, SEED, FIRST_LOT };
})(typeof window !== 'undefined' ? window : globalThis);
