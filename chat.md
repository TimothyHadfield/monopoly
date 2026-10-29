# Monopoly — chat log

## 2026-10-19 · first build (builder agent under the portfolio manager)
- **Asked:** Tim ticked Monopoly from the big games list ("Landing-odds heatmap, trade evaluator like your Fantasy one, return on each property"); phase 2 added rules-exact play with variants, online seats, an ideas list, polished art, QA.
- **Built:** Markov landing odds, Odds / Table / Play / Trade / Settings tabs, the full rules engine (`apply`/`view`), easy/medium/hard computers, hint + coach, original SVG board and icon, rules-check doc (research agent).
- **Verified:** `npm test` (markov vs published 3.18% Illinois / 3.11% Go and a 3M-throw sim; brute-force one-turn walk; hand-worked rent/building/trade cases; engine rule cases; 40 full computer games with invariants). Mutation runs: each test file fails on a deliberately broken rule. phone-view WebKit 393 px + desktop screenshots of each tab, 0 console errors.
- **Open:** online seats wait for the shared `_online` module.

## 2026-10-20 · v1.1-1.2 (same builder)
- **Built:** online rooms through the shared `online.js` (`js/mono-online.js` adapter); ideas 9-11 (From-here odds, worth-to-you, net-worth chart); measured strength table in Settings; idea 12 tried and dropped (computer games stall).
- **QA agent fixes:** unmortgage $1 too high (float), give-up blocked while mortgaging could pay + trading while in debt, cash inputs ("12.75", "-500", "1e5"), "Round 21 of 20", (M) + interest on trade offers, "You pays" wording, "−$0", trade verdict numbers, duplicate hint text, blank/duplicate names, laptop board labels under owner strips and railroad icons, reset double-tap, text selection on fast taps, reconnect flash.
- **Verified:** `npm test` 40 pass (new tests seen failing on the old code first); two-browser online run against the real Firebase project (cash matched, reload resumed, leaver became a computer); phone-view 393 px + desktop screenshots, 0 console errors, no overflow.

## 2026-10-20 · v1.3 computer trades (same builder, manager brief)
- **Asked:** "make computers trade to complete colour sets, so games finish"; Medium/Hard propose and accept fair set-completing trades, Hard values blocking, humans get offers in Play.
- **Built:** `AI.findTrade` (2-way swaps and cash-balanced deals judged by the fair meter), Hard blocking premium, declined offers remembered (`Engine.tradeKey`), `tests/finish.test.js`.
- **Verified:** finish test failed on v1.2 (25/40 safety stops) and passes now (0/40, median 169 turns); 1000-game sims re-run (0/1000 stops for 4×Medium); offer screen phone-view 393 px + desktop.
- **Open:** Hard's edge over Medium is now small (32% vs 25% fair).

## 2026-10-20 · v1.4 visual pass (builder, manager brief)
- **Asked:** "review them again for design improvements especially visually".
- **Built:** a fresh read-only reviewer ranked 14 problems; fixed: phone lots show prices, owner tint + thicker owner strips, bigger phone houses/tokens with shine + shadow, tokens glide square to square, GO/corner numbers clear of the art, laptop centre text/dice/buttons bigger, one-line player rows on phone with a colour bar for whose turn, 40px small buttons on phone, railroads/utilities aligned with the set table, level row aligned, wider laptop panel.
- **Verified:** `npm test` 43 pass; phone-view WebKit 393 px + desktop before/after of every tab, a fresh game and a round-17 mid-game save (owners + houses); 0 console errors, no overflow, no page scroll.

## 2026-10-20 · v1.5 sounds, celebrations, animations (builder, manager brief)
- **Asked:** "add opptional sounds ... win celebrations, and other fun annimations ... everything is customizable in the settings".
- **Built:** `js/fx.js` (shared, unchanged copy), `js/fx-game.js` (state-diff event map → sounds + effects, custom `hop` and `clank`), Settings > Sound & effects, cash count-up + floats, coin flight for rent, card flip, win/lose confetti; existing token glide + dice tumble now obey Animations/Speed. Sound map in progress.md.
- **Verified:** `tests/fx.test.js` (failed first: module missing, then wiring missing) + full `npm test` 48 pass; phone-view WebKit 393 px + desktop of Settings, a round-17 roll (card + "+$10" float), win screen (confetti); Animations off = 0 overlays/animations; 0 console errors, no overflow.

## 2026-10-20 · v1.6 real-table look (builder, manager brief)
- **Asked:** make the game look like the real board on a real table from the player's seat (Tim's words in progress.md).
- **Built:** board redrawn like the real print (`js/boardview.js`), wood table, seats strip/column with deeds + bills, your area with deeds + bill stacks, real Chance/Chest decks on the board (`TABLE.deck`), dealt + flipped cards, flying deeds, laptop side panel, phone Log sheet; `css/table.css`/`js/table.js` byte copies; `.gitattributes` for the shared copies.
- **Verified:** `npm test` 48 pass (incl. online) on branch and on main; WebKit 320×568, 393×659, 659×393, 1280×800, 1440 laptop: 0 console errors, no overflow, no page scroll; 60 s scripted play: 19 actions, 3 cards dealt, deeds flew, 0 errors. Before/after shots in the builder scratchpad `table/monopoly/`.
- **Open:** reviewer sub-agent was blocked by the agent limit (self-review only).

## 2026-10-20 · v1.7 edge pass (builder, manager brief)
- **Asked:** "making each game perfect especially in scenarios that the game doesn't expect or are a little weird", plus the table-look review (step 0) that never ran in v1.6.
- **Built:** a read-only reviewer ran; fixed deck overlap (`fitCenter`), phone street names, upright houses, chest glyph, bill text, float from bills. 66 weird scenarios listed (builder scratchpad `edge/monopoly/scenarios.md`), 64 tested, 21 failed, 20 fixed: time-limit tie, per-seat trade offers, double-tap guard, New game confirm tap, lost taps while computers play, dice re-tumble on reload, live Log sheet, two-tab sync + hidden-tab pause, scrolling 8-seat lists, short amounts in a crowded strip.
- **Verified:** `tests/edge.test.js` (8; tie + offers failed first) and full `npm test` 56 pass on branch and on main; WebKit harness `ui.mjs` 69 checks pass locally and on the live site @ 74a9af3 (320/393/659 landscape/640/1280/1440/1920).
- **Open:** a computer seat named "You" and online leaving not re-run; the reviewer's bigger redesign ideas are Tim's call (listed under Decisions).

## 2026-10-21 · v1.8 visibility pass (builder, manager brief)
- **Asked:** "Fix this so the view of what's happening and where everything is is very clear" (full words in progress.md).
- **Audit (measured, WebKit):** phone street names 7.1 px (320: 5.4), prices 7.5, houses/owner strips 6.7, pieces 16 px, worst piece overlap 31%; laptop board 574 px = 32% of 1280×800, names 7.2 px; landscape board 278 px.
- **Built:** phone camera zoom onto the action + mini-map button, upright phone names, laptop full-height board with your area in the right column + one-line player rows, landscape without title bar, piece grid per space, bigger laptop print/strips.
- **Verified:** layout check (`check.mjs`) 86 fails on v1.7 → 0 of 30 screens on v1.8 (names 12.5 px, prices 13.2, pieces 29, houses 11.7, laptop board 704/812 px); taps on the zoomed board open the right lot + zoom toggle + Roll, WebKit and Chrome; v1.7 edge harness 69/69; `npm test` 56 pass; one read-only reviewer, its findings fixed (upside-down zoomed row, lost overview → mini-map, laptop log hidden, clipped laptop prices).

## 2026-10-27 · v1.9 improve pass (builder, manager brief)
- **Asked:** "start building every single improvement you can think of after your competitor analysis" / "make our boardgames the best in every single metric we can"; brief: open on Play, Hard ≥65% vs Medium, rule variants, undo, replay, token hop + tilt, build pop, local record, shared coach/profile/pwa kits, richer art. Online layer untouched (another builder).
- **Built:** default tab Play; Hard AI (real-gain trades until round 40, mortgage loose lots to build, no unmortgage while it wants houses); `_coach` guided game + rules sheet; `_profile` My stats/achievements/Daily; `_pwa` install + offline; Undo; Replay; Starting cash + No rent in jail; hop/drop/tilt/grain.
- **Verified:** sims 1,000 games each (Hard vs Medium 53.6 → 68.4%); `npm test` 63 pass (new AI tests and the no-rent-in-jail test seen failing on the old code); pwa-check 18/18 (old build 3/18); headless WebKit: tutorial walked to step 3, full game vs Easy played with Undo → result in My stats → Replay scrubbed/stepped, Daily double-tap guard, reduced motion = no hop/tilt; screenshots 393/320/659×393/1280/1440, no overflow, 0 console errors. One read-only reviewer: 5 findings fixed (Undo in Daily, second-tab stats, tap twice before leaving a game, saved-data size, helped Daily loss unrated).
- **Open:** Medium < Easy one-on-one (44%); Buy buttons clipped at 320 px on the zoomed board (pre-existing).

## 2026-10-28 · v1.11 wave 3 "just make the games better" (builder, manager brief)
- **Asked:** "adding variations like common house rules ... links to youtube videos on strategies/how to play/variations ... practical settings ... Just make the games better." Brief: common house rules, Learn videos, practical settings, ladder per house rule.
- **Found:** Free Parking pot, $400 on Go, Auctions off, Short game, Time limit, No rent in jail, Starting cash, Computer speed and a remembered setup already existed; "Pass Go before buying" was in the engine but the setup never passed it on.
- **Built:** `Engine.fromSetup`; Pass Go before buying + Build in any order (`evenBuild`) + Free Parking $500 seed (`parkingSeed`) switches; a one-line note under every rule; pot printed on the Free Parking corner; Videos tab in the rules sheet (4 links, oembed 200 + matching title 2026-10-28).
- **Verified:** 4 new tests failed on v1.10, then `npm test` 70 + quit browser test pass, pwa-check 18/18; WebKit screenshots 393/320/659×393/1280/1440 (setup with seed row, game with "$500" on the corner, Videos tab): 0 page errors, no sideways scroll. Ladder per rule: progress.md "Measured strength".
- **Ladder:** every house rule holds Hard ≥ Medium ≥ Easy (300 games each); the existing Time limit did not (Easy beat Medium 65%), fixed with time-limit play (`AI.clock`): Medium 85% vs Easy, Hard 61% vs Medium at 20 rounds.
- **Open:** online room with the new rules not played (same rules object as local games).

## 2026-10-28 — kit sweep (builder b1): `_coach` 1.2.0 ("New to Monopoly?" offer `place:'auto'`, avoids Start game), `_pwa` 1.4.0 build 18, v1.12; offer 0 px over tabs/Start at 393×659, 320×568, 659×393; settings 320 no sideways scroll; npm test 71/71, pwa-check 18/18 WebKit; live 30629be.
