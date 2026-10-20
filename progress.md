# Monopoly — progress

## START HERE
Read order: this file → `CLAUDE.md` → `docs/rules-check.md` → `docs/ideas.md` → `chat.md`.
Last updated: 2026-10-20 (v1.7 edge pass: weird scenarios + table-look review fixes; v1.6 real-table look; v1.5 sounds, celebrations + animations; v1.4 visual pass; v1.3: computers trade to finish sets; v1.2 online rooms, ideas 9-11, QA fixes).

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
| Visual pass (v1.4, 2026-10-20) | done: phone lots show prices, owner tint, bigger houses/tokens, gliding tokens, bigger laptop centre |
| Sounds + celebrations + animations (v1.5, 2026-10-20) | done: shared `js/fx.js` (byte copy of `_fx/fx.js`) + game-local `js/fx-game.js`; Settings > Sound & effects; `tests/fx.test.js` |
| Real-table look (v1.6, 2026-10-20) | done: wood table, board printed like the real one (names, glyphs, diagonal corners, upside-down far rows), pewter tokens, real decks on the board, opponents' seats (deeds + bills), your deeds + bill stacks at the bottom, cards dealt from the deck and flipped, deeds fly to the buyer. Phone: seats strip on top, Log behind a tap; laptop: seats left, slim side panel right. Shared `css/table.css` + `js/table.js` = byte copies of `_table/`. Research: builder scratchpad `table/monopoly/real.md` |
| Edge pass (v1.7, 2026-10-20) | done: 66 listed, 64 tested, 21 failed, 20 fixed, 1 accepted (tokens cover square text, as on a real board); live @ 74a9af3; see below |

## Edge pass (v1.7) scenario summary
Scenarios list + results: builder scratchpad `edge/monopoly/scenarios.md`; WebKit harness `edge/monopoly/ui.mjs` (69 UI checks at 320/393/659-landscape/640/1280/1440/1920 widths), engine probes `probe.js`, node tests `tests/edge.test.js` (8).
| Area | Tested | Failed → fixed |
|---|---|---|
| Table look (deck overlap, phone names, houses, bills, chest art, float) | 10 | 9 → 8 fixed: centre scales to clear the decks (`fitCenter`), phone short street names, upright houses, chest glyph, no repeated card line, bill text, float from bills; tokens over text accepted |
| Rules corners (ties, debts, cards, house shortage, Chairman ×7, back-3 onto Chest, both jail cards out) | 20 | 2 → time-limit tie names every tied player; a debtor on another's turn gets their own 3 trade offers |
| Players (all-computer, 8 seats, emoji names, pass-and-play) | 4 of 6 | 0 (P4 "You" on a computer, P6 online leaver not run) |
| Taps and timing (double-tap Buy, stray New game, taps while computers play, Log open) | 12 | 4 → 350 ms guard after the centre changes, New game needs a 2nd tap mid-game, DOM only replaced when changed, Log sheet refreshes live |
| Devices (320 to 1920, landscape, zoom, reload, two tabs, hidden tab) | 11 | 5 → seat lists scroll on laptop/landscape, no dice re-tumble on reload, two tabs adopt the newer game, hidden tab pauses |
| Odd states (all 28 deeds, $25k, $0, end screens) | 7 | 1 → short amounts ($25k) in a crowded phone strip |

## Sound map (v1.5, `js/fx-game.js` `events()`; driven by the state diff, so computer + online moves sound the same)
| Game event | Sound | Animation |
|---|---|---|
| Dice thrown | `diceRoll` ×2 (one per die), `diceLand` as the 450 ms tumble ends | existing CSS tumble |
| Token walks | `hop` (custom, quiet) per square passed, `place` on arrival; `slide` for >12-square card jumps | existing glide (obeys Speed / off) |
| Pass Go / land on Go ($400 rule) | `coins` when the token crosses Go | "+$200" floats on the row, cash counts up |
| Chance / Community Chest | `cardFlip` on arrival | the card note flips in (rotateY) |
| Buy / win an auction | `stamp` (+ `train` whistle for a railroad) | square flashes in the buyer's colour |
| Auction opens / bid | `ding` (low) / `chip` | — |
| Rent | `coins` on arrival | gold coin flies payer token → owner token |
| Taxes, card fees, jail fee, interest, unmortgage | `coins` (pitch .9) | "−$N" float + count down |
| Go to jail | `clank` (custom metal bars) | jail square shakes |
| Roll out of jail / use jail card | `whoosh` / `cardSlide` | — |
| Build / hotel | `place` (hotel lower) | square pops; hotel = `big` sparkle |
| Sell building / mortgage | `slide` / `cardFlip` (low) | — |
| Trade offered / accepted / declined | `cardSlide` / `cardDeal` / `cardSlide` (low) | — |
| You are short of cash | `alarm` (only you) | — |
| Bankruptcy | `sink` | board shakes |
| Colour set completed, Free Parking pot | — | `celebrate big` (ding + stars) on the square |
| Becomes YOUR turn / bid / trade answer | `turn` chime | main button pulses |
| Illegal tap (engine refuses) | `error` | — |
| Game over | `celebrate win` (winner's colour confetti) if you won or only computers played, else `lose` | — |
Computer / other players' sounds play at 0.8 volume. Reload or new game = no replayed sounds.

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
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)." (2026-10-20)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)

## Traps
- Online test account: none needed (anonymous Firebase login). The two-browser script lives in the builder scratchpad, not the repo; rooms expire by TTL within 3 days (QA left room 8JKNT, a test left 3RLYE).
- Never edit `js/online.js` here: re-copy it from `Board and Card Games/_online/` when that module changes.
- Never edit `js/fx.js`: re-copy it from `Board and Card Games/_fx/`. Game sounds/effects live in `js/fx-game.js`; `BoardView.speed` (1 / 0.5 / 0) and the `fx-noanim` / `fx-fast` classes on `<html>` make the existing token glide and dice tumble obey Settings.
- Never edit `js/table.js` / `css/table.css`: re-copy from `Board and Card Games/_table/`. `.gitattributes` marks the three shared copies `-text`, because with `autocrlf=true` a merge rewrote them as CRLF and the byte-copy test failed (2026-10-20).
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
- Max 3 trade offers per seat per turn (`Engine.offersLeft`; keeps computer games moving). Safety stop at 4000 turns → richest wins.
- Default tab Odds; Play is the centre tab.
- Giving up is allowed only when cash + everything sellable/mortgageable can't cover the debt (or nothing can be sold right now). A debtor may offer trades.
- Mortgage money uses integer math: interest = ceil(price/20), unmortgage = price/2 + ceil(price/20).
- Computer trades (v1.3): Medium/Hard offer set-completing trades at end of turn (1 per turn), cash-balanced to the fair meter (never worse than -$50 for the other side); a declined offer isn't repeated for 6 rounds. Hard won't sell a lot that finishes someone else's set without a 25% premium. Easy never trades.
- Visual pass v1.4 (not Tim's choices, flagged): phone board (<560px) shows each lot's price instead of a blank square; owned lots are tinted 20% toward the owner's colour; owner strip 18u on phone; phone header 44px with no version (Settings shows it); laptop panel 480px; tokens are CSS-transformed (style.transform) so they glide.
- v1.5 effects (not Tim's choices, flagged): Sound & effects sits in Settings after Play; railroad buys whistle; jail = custom metal clank; set completion and hotels get the "big" sparkle; computer sounds at 0.8 volume; Fast = half durations.
- v1.6 table look (not Tim's choices, flagged): dark wood surface; far rows printed upside down like a real board seen from your seat; tokens are original pewter silhouettes on a base in the player's colour; cash shown as a greedy bill breakdown; owner strip + tint kept; Hint/Manage/Trade moved to your bottom bar; Log behind a tap on phone; decks show on the Play tab only; laptop board shrank (~582px at 1280 wide) to fit seats + side panel.
- v1.7 edge pass (not Tim's choices, flagged): a time-limit tie is shared ("Game over · tie", the rulebook has no tie-break); 3 trade offers per seat per turn (not per turn); New game mid-game needs a second tap within 3 s (toast); phone board uses short street names (e.g. "PENN. RR", "N. CAROLINA"); crowded phone strip (5+ opponents) shows "$1.5k" amounts without bills; new chest glyph; taps on the centre ignored for 350 ms after it changes.
- Not fixed, Tim's call (from the table-look review): drop owner tints/strips, seat opponents around the board edges, dice as the Roll button, redesigned deeds, redrawn corner art.
- Online: privateView is empty (nothing secret but the seed and deck order, which publicView hides). The room creator's browser runs the engine and the computers.

## NOT verified
- House shortage auction (two players wanting the last houses) is not modelled: first come, first served.
- The trade value formula is a reasoned model, not checked against expert trade data.
- Online with 3+ people on real phones (tested: two headless browsers, WebKit 393 px + Chromium laptop, 70 moves, reload, leave).
- Rule-impact table (idea 12) was dropped when computer games stalled; now they finish (v1.3), so it could be revisited.
- Hard beats Medium only modestly (32% vs fair 25%) since v1.3.
- v1.4 token glide and owner tint checked only in headless WebKit/Chromium screenshots, not on a real iPhone.
- v1.5 sounds were never heard by a person: headless WebKit has no Web Audio; tests use a fake AudioContext. Online sounds from snapshots not tested with two browsers. Confetti seen in headless screenshots only.
- v1.6 card deal/flip and deed flights were counted in a 60 s headless WebKit play run; not seen on a real iPhone.
- v1.7: all checks headless WebKit only (393/320/landscape/laptop), not a real iPhone. Not run: a computer seat named "You", online leaver/host leaving. The double-tap guard, Log refresh and two-tab sync have UI-harness checks only (seen failing first), no node tests. The tie and offers fixes have node tests (seen failing first).
- Lobby shows a just-joined friend as offline for a few seconds (presence heartbeat lag).
