// Browser test: leaving a game against the computers before the end counts as a loss in My stats;
// the guided first game never counts.
//   node tests/quit.test.mjs        (needs Playwright in ~/.claude/tools; WebKit)
//   MONO_ROOT=<other checkout> runs it against older code.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
const require = createRequire(join(homedir(), '.claude/tools/') + 'x.js');
const pw = require('playwright');
const ROOT = process.env.MONO_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');

const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': T[extname(p)] || 'application/octet-stream' }); r.end(d); } });
});
await new Promise(ok => srv.listen(0, ok));
const url = 'http://localhost:' + srv.address().port + '/?nosw#play';
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + msg); if (!ok) failed++; };

const browser = await pw.webkit.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('coach-offer:mono-first', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.MonoApp && window.Profile);
  const stats = () => page.evaluate(() => Profile.stats());
  const throwOnce = async () => {
    await page.waitForSelector('[data-act="g:roll"]', { timeout: 20000 });
    await page.waitForTimeout(600);   // the centre ignores taps for 350 ms after it changes
    await page.click('[data-act="g:roll"]');
    await page.waitForFunction(() => MonoApp.G && MonoApp.G.dice);
  };
  // New game sits in the Log sheet on a phone; a game in progress needs a second tap
  const tapNew = async () => {
    const vis = page.locator('[data-act="newgame"]:visible');
    if (!(await vis.count())) { await page.click('[data-act="logsheet"]'); await vis.first().waitFor(); await page.waitForTimeout(300); }
    await vis.first().click();
  };
  const newGame = async () => {
    await tapNew();
    await page.waitForTimeout(600);
    if (await page.evaluate(() => !!MonoApp.G)) await tapNew();
    await page.waitForFunction(() => !MonoApp.G);
  };

  // a game against the computers, one throw, then New game (twice, as the button asks)
  await page.waitForSelector('[data-act="start"]');
  await page.waitForTimeout(800);
  await page.click('[data-act="start"]');
  await throwOnce();
  check((await stats()).games === 0, 'nothing counted while the game is on');
  await newGame();
  let s = await stats();
  check(s.games === 1 && s.losses === 1, 'leaving a game mid-way counts as a loss (' + s.games + ' games, ' + s.losses + ' lost)');

  // a fresh game left before anyone throws: not counted
  await page.click('[data-act="start"]');
  await page.waitForSelector('[data-act="g:roll"]');
  await newGame();
  s = await stats();
  check(s.games === 1, 'a game left before the first throw is not counted (' + s.games + ' games)');

  // the guided game, left mid-way: never counts
  await page.evaluate(() => MonoApp.startTutorial());
  await page.waitForSelector('.coach-layer');
  await page.addStyleTag({ content: '.coach-layer{display:none!important}' });   // the guide's bubbles sit over the buttons
  await throwOnce();
  await newGame();
  s = await stats();
  check(s.games === 1 && s.losses === 1, 'leaving the guided game is not counted (' + s.games + ' games, ' + s.losses + ' lost)');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(failed ? failed + ' FAILED' : 'all passed');
process.exit(failed ? 1 : 0);
