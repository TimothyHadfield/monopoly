# Ideas: data, theory and exploration layers (2026-10-19)

Tim's ask: "Brainstorm what additions you can do to the game with data, exploration, theory, etc." Build = in the site; Skip = reason given.

| # | Idea | Call | Why |
|---|---|---|---|
| 1 | Exact landing heatmap from a Markov chain (doubles, triple-double jail, all 32 cards) | **Build** (done) | The core "odds" layer; matches published results. |
| 2 | Jail strategy switch (leave fast vs stay in) changing the odds | **Build** (done) | Real strategic choice; the numbers shift visibly (Jail 6.2% vs 11.5%). |
| 3 | Rent ladder per lot: rent, rent per opponent turn, payback at each house count | **Build** (done) | "Return on each property", Tim's own words. Shows the 3-house sweet spot. |
| 4 | Colour sets ranked by payback with 3 houses | **Build** (done) | The classic "oranges are best" result, measured instead of told. |
| 5 | Danger ahead: expected cost of a player's next turn + biggest risk | **Build** (done) | Real-table decision: how much cash to hold back. |
| 6 | Best next house by payback (legal builds only) | **Build** (done) | Turns the odds into an action at the table. |
| 7 | Trade fairness meter (value to each side) | **Build** (done) | Tim asked for it "like your Fantasy one". |
| 8 | Hint button + Coach (what the hard computer would have done, after each choice) | **Build** (done) | The study mode every one of his game sites has. |
| 9 | "From here" view: the odds of where a token lands this turn from any square | **Build** (done) | One tap on the Odds board; uses the exact one-turn walk already tested. |
| 10 | Auction / buy guide: what a lot is worth to you | **Build** (done) | Auctions are where people overpay or underpay most. |
| 11 | Net-worth-over-time chart after a game | **Build** (done) | Post-game analysis; shows the turning point (usually the first set built). |
| 12 | Rule impact table: game length with Free Parking / no auctions / short game (measured by simulation) | Skip (tried) | 200 games per rule with 4 Medium computers: ~60% hit the 4,000-turn stop under every rule, so the numbers measured the computers, not the rules. Revisit once computers close out games faster. |
| 13 | Live "win chance" per player by simulating the rest of the game | Skip (for now) | Needs thousands of rollouts; too slow on a phone without a worker. Revisit with a Web Worker. |
| 14 | Card-order memory (decks cycle in a fixed order, so after 16 draws the next card is known) | Skip | True and clever, but needs a tap on every card draw at the table. Low use. |
| 15 | House-shortage strategy explainer (stop at 4 houses to starve the bank) | Skip | Needs the shortage auction modelled first (not verified). |
| 16 | Mortgage-or-sell helper when short of cash (income lost per $ raised) | Skip | The hard computer already uses it; the Manage sheet shows payback per lot. |
| 17 | Speed Die / Mega edition | Skip | Not a common variant at home tables. |
