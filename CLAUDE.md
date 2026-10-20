# Monopoly (odds, table companion, trade check, computer play)

Static site, no build. Online rooms use the shared free Firebase module (`js/online.js`, copied unchanged from `Board and Card Games/_online`; gameId `monopoly`).
- Live: https://timothyhadfield.github.io/monopoly/ · Repo: `TimothyHadfield/monopoly` (public), Pages from `main` / root.
- Read `progress.md` first (state, traps, decisions). Rules and sources: `docs/rules-check.md`.

## Files
- `js/board.js` board facts (squares, rents, 16 Chance + 16 Chest, 2008+ US edition).
- `js/markov.js` exact landing odds (123-state chain) + one-turn odds from any square.
- `js/money.js` rent, expected income, house payback, danger ahead, trade value.
- `js/engine.js` the full game as `apply(state, action) -> state`, `view(state, seat)`, `legal`, `actor`. Seeded dice in state.
- `js/ai.js` computers (easy / medium / hard) + `hint`.
- `js/mono-online.js` the engine wrapped as the online.js game object (setup/toAct/apply/publicView/privateView/bot/isOver). `js/online.js` = shared module, never edit it here.
- `js/boardview.js` original SVG board. `js/app.js` the five tabs (Odds, Table, Play, Trade, Settings).
- `tools/sim.js` strength measurement: `node tools/sim.js 400 hard,medium,medium,medium`.

## Test
- `npm test` (node only, ~5 s). Includes a 3M-throw simulation check of the chain and 40 full computer games with invariants.
- Serve: `python -m http.server 8231` (background), then `node ~/.claude/tools/phone-view.mjs http://localhost:8231/#odds --out x.png` (+ `--desktop`). Tabs by hash: `#odds #table #play #trade #settings`. Play flow: `--do "click:[data-act=start]" --do "click:[data-act='g:roll']"`.
- Bump `?v=` on the script/css tags and `VERSION` in app.js on every shipped change (phone cache).
