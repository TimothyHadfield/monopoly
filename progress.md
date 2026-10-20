# Monopoly — progress

## START HERE
Read order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-19 (first build session).

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
| Online seats | waiting on the shared `_online` module (not there on 2026-10-19) |

## Measured strength
(filled in from `tools/sim.js` runs; see Decisions for the method)

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

## NOT verified
- House shortage auction (two players wanting the last houses) is not modelled: first come, first served.
- The trade value formula is a reasoned model, not checked against expert trade data.
- Online play (module not built yet).
