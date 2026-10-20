# Monopoly — chat log

## 2026-10-19 · first build (builder agent under the portfolio manager)
- **Asked:** Tim ticked Monopoly from the big games list ("Landing-odds heatmap, trade evaluator like your Fantasy one, return on each property"); phase 2 added rules-exact play with variants, online seats, an ideas list, polished art, QA.
- **Built:** Markov landing odds, Odds / Table / Play / Trade / Settings tabs, the full rules engine (`apply`/`view`), easy/medium/hard computers, hint + coach, original SVG board and icon, rules-check doc (research agent).
- **Verified:** `npm test` (markov vs published 3.18% Illinois / 3.11% Go and a 3M-throw sim; brute-force one-turn walk; hand-worked rent/building/trade cases; engine rule cases; 40 full computer games with invariants). Mutation runs: each test file fails on a deliberately broken rule. phone-view WebKit 393 px + desktop screenshots of each tab, 0 console errors.
- **Open:** online seats wait for the shared `_online` module.
