# Monopoly — progress

## START HERE
Read order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-20 (v1.3: computers trade to finish sets; v1.2 online rooms, ideas 9-11, QA fixes).

## Goal right now
A finished Monopoly site in Tim's game-site style: exact landing odds (heatmap), a real-table money companion, a trade evaluator, and full rules-exact games against measured computers, with online seats once the shared module exists.

## Status
| Part | State |
|---|---|
| Landing odds (Markov chain, both jail strategies) | done, tested vs published results + 3M-throw sim |
| Odds tab: heatmap (landing %, rent/turn, payback), rent ladder, set ranking | done |
| Table tab: players, owners, houses, cash, danger ahead, income, best next house | done |
| Trade tab: evaluator with fairness meter | done |
| Play tab: full game, auctions, jail, debts, bankruptcy, trades, variants, hint + coach | done |
| Computer strength measured | see "Measured strength" below |
| Online rooms (create / join by code, computers fill seats, reload resumes, leaver becomes a computer) | done, two-browser test against the real free Firebase project 2026-10-20 |
| Ideas 9-11: From-here odds, worth-to-you on buy/auction, net-worth chart at game over | done |
| QA pass (fresh agent, 2026-10-19) | all 9 findings fixed in v1.2 |

## Measured strength
1,000 computer-only games per table, seats rotated, `tools/sim.js`, AI `reserve: 0.5` (raw JSON in `docs/sim-*.json`). Fair share: 25% at 4 seats, 50% at 2.
| Table | Result |
|---|---|
| Hard vs 3 Medium | Hard 32.1% |
| Medium vs 3 Easy | Medium 77.8% |
| Hard, Medium, 2 Easy | 59.1% / 31.2% / 4.9% each |
| Hard vs Easy, 2 seats | Hard 63.7% (1-v-1 is luck-heavy) |
| 4 Medium | 0 of 1000 hit the safety stop, avg 184 turns |
v1.3 (2026-10-20): Medium/Hard now trade to finish colour sets. Before that ~60% of 4×Medium games hit the 4,000-turn safety stop; now 0/1000 (11 of 4000 across the other tables). Hard's lead over Medium shrank (was 59.6%) because Medium trades too; ~12 knob experiments (block premium, cash edge, reserve, house cap, extra offers) all landed at 30-32%.

## Authorized next steps
- 2026-10-19 manager brief (phase 1 + phase 2): build all of the above, ideas doc + build the good ones, online when `Board and Card Games/_online/README.md` exists.

## Standing instructions (Tim's words)
- "Base the style off of what I did with the other games with a similar aspect and thought process behind it"
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Brainstorm what additions you can do to the game with data, exploration, theory, etc."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors or whatnot."
- "Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- Money $0, static GitHub Pages, no copied publisher art or rulebook text.

## Traps
- Online test account: none needed (anonymous Firebase login). The two-browser script lives in the builder scratchpad, not the repo; rooms expire by TTL within 3 days (QA left room 8JKNT, a test left 3RLYE).
- Never edit `js/online.js` here: re-copy it from `Board and Card Games/_online/` when that module changes.
- Run tests as `npm test` (node --test with explicit files; a bare `node --test tests/` fails on Windows).
- The engine clones state on every `apply` (fast hand-written deep copy). Never mutate a state you got back; `AI.hint` temporarily flips the seat's level and restores it.
- `rules.manualDice` lets an action carry its own dice: tests only (and a future "real dice" mode). Online seats must never get it.
- Utility rent from a card rolls new dice (official); the odds code values that as 10 × 7.
- Card decks: drawn from the top, put under the bottom; Get Out of Jail Free is held out until used.

## Decisions
- Edition: 2008+ US classic (Income Tax $200, Luxury Tax $100). Pre-2008 taxes are a switch.
- Odds are per throw ("share of all landings"); per-turn = × throws per turn (1.166 stay / 1.187 leave-fast).
- Payback = (price + houses) ÷ expected rent per opponent turn.
- Trade value = cash + sell-off value + 10 rounds × change in income once full sets have 3 houses.
- Short game = 2008+ booklet (3 free deeds, hotel at 3 houses, one jail try, ends at the first bankruptcy). Time limit = 2 paid deeds + a round count.
- House rules offered: Free Parking pot, $400 on Go. "No auctions" = Auctions switch off.
- Max 3 trade offers per turn (keeps computer games moving). Safety stop at 4000 turns → richest wins.
- Default tab Odds; Play is the centre tab.
- Giving up is allowed only when cash + everything sellable/mortgageable can't cover the debt (or nothing can be sold right now). A debtor may offer trades.
- Mortgage money uses integer math: interest = ceil(price/20), unmortgage = price/2 + ceil(price/20).
- Computer trades (v1.3): Medium/Hard offer set-completing trades at end of turn (1 per turn), cash-balanced to the fair meter (never worse than -$50 for the other side); a declined offer isn't repeated for 6 rounds. Hard won't sell a lot that finishes someone else's set without a 25% premium. Easy never trades.
- Online: privateView is empty (nothing secret but the seed and deck order, which publicView hides). The room creator's browser runs the engine and the computers.

## NOT verified
- House shortage auction (two players wanting the last houses) is not modelled: first come, first served.
- The trade value formula is a reasoned model, not checked against expert trade data.
- Online with 3+ people on real phones (tested: two headless browsers, WebKit 393 px + Chromium laptop, 70 moves, reload, leave).
- Rule-impact table (idea 12) was dropped when computer games stalled; now they finish (v1.3), so it could be revisited.
- Hard beats Medium only modestly (32% vs fair 25%) since v1.3.
- Lobby shows a just-joined friend as offline for a few seconds (presence heartbeat lag).
