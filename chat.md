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
