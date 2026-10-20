// Monopoly sounds + animations, driven only by state changes (prev -> next).
// The same diff runs for your moves, computer moves and online snapshots, so
// everyone hears the same events. events() is pure (tested in node); run()
// plays them through the shared fx.js (window.FX), which obeys Settings.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Board = node ? require('./board.js') : root.Board;
  const { SQ, GROUPS } = Board;
  const GX = typeof window !== 'undefined' ? window : globalThis; // where fx.js puts FX

  // ---------------------------------------------------------------- game sounds fx.js doesn't have
  function defineSounds(FX) {
    if (!FX || !FX.define) return;
    // a token tapping down on the next square (quiet, so 12 in a row don't tire)
    FX.define('hop', k => { k.tone({ f: 640, f2: 470, dur: 0.045, vol: 0.09 }); k.noise({ f: 2400, q: 1.5, dur: 0.018, vol: 0.06 }); }, 'moves');
    // jail door: two metal bar hits (inharmonic partials) and a low latch
    FX.define('clank', k => {
      [0, 0.13].forEach((at, i) => {
        const v = i ? 0.1 : 0.16;
        [410, 1130, 1870, 2950].forEach((f, j) => k.tone({ f: f * (i ? 0.94 : 1), dur: 0.45 - j * 0.08, vol: v / (j + 1), type: j ? 'sine' : 'triangle', at }));
        k.noise({ f: 2500, q: 2, dur: 0.05, vol: 0.3, at });
      });
      k.tone({ f: 140, f2: 70, dur: 0.12, vol: 0.3, at: 0.26 });
    }, 'moves');
  }

  // ---------------------------------------------------------------- helpers
  const money = n => { const r = Math.round(n) || 0; return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US'); };
  // log lines added between two states (the engine keeps the last 80, so the front may have dropped)
  function newLines(a, b) {
    const A = (a && a.log) || [], B = (b && b.log) || [];
    for (let s = 0; s <= A.length; s++) {
      const n = A.length - s;
      if (n > B.length) continue;
      let ok = true;
      for (let i = 0; i < n; i++) if (A[s + i] !== B[i]) { ok = false; break; }
      if (ok) return B.slice(n);
    }
    return B.slice();
  }
  function whoOf(line, players) {
    let best = -1, len = -1;
    players.forEach((p, k) => { const nm = String(p.name); if (line.startsWith(nm + ' ') && nm.length > len) { best = k; len = nm.length; } });
    return best;
  }
  // mirrors BoardView's token walk: square by square (<= 12 squares), else one glide; jail = one glide
  function hopPlan(from, to, jail, f) {
    if (from === to) return { dur: 0, steps: [], goAt: -1 };
    if (jail) return { dur: 220 * f, steps: [], goAt: -1, jail: true };
    const n = (to - from + 40) % 40;
    if (n > 12) return { dur: 320 * f, steps: [], goAt: to < from ? 160 * f : -1, glide: true };
    const per = Math.max(60, Math.min(120, 1100 / n)) * f;
    const steps = [];
    let goAt = -1, p = from;
    for (let k = 0; k < n; k++) { p = (p + 1) % 40; steps.push({ t: (k + 1) * per, sq: p }); if (p === 0) goAt = (k + 1) * per; }
    return { dur: n * per, steps, goAt };
  }
  const setOwner = (st, g) => { const o = st.own[GROUPS[g][0]].owner; return o >= 0 && GROUPS[g].every(i => st.own[i].owner === o) ? o : -1; };

  // ---------------------------------------------------------------- the event map
  // ctx: { mine(seat) -> bool, f: timing factor (1 normal, 0.5 fast, 0 animations off), colors: [...] }
  // returns [{ t (ms), snd, opt } | { t, anim, ... } | { t, celebrate, ... }]
  function events(prev, next, ctx) {
    const out = [];
    if (!prev || !next || prev === next || !prev.players || !next.players || prev.players.length !== next.players.length) return out;
    if (prev.phase === 'over') return out;
    const f = ctx.f == null ? 1 : ctx.f, mine = ctx.mine || (() => false), colors = ctx.colors || [];
    const lines = newLines(prev, next);
    const P = next.players;
    const vol = k => (k >= 0 && mine(k) ? 1 : 0.8); // computers and other people never louder than you
    const snd = (t, name, k, extra) => out.push({ t: Math.round(t), snd: name, opt: Object.assign({ vol: vol(k) }, extra || {}) });

    // token moves first: everything that happens on the square waits for the token to arrive
    let arrive = 0, goAt = -1;
    P.forEach((p, k) => {
      const q = prev.players[k];
      if (q.pos === p.pos && !!q.jail === !!p.jail) return;
      const h = hopPlan(q.pos, p.pos, p.jail > 0 && q.pos !== p.pos, f);
      if (!h.dur && !h.jail) return;
      h.steps.forEach((s, i) => { if (i < h.steps.length - 1) snd(s.t, 'hop', k); });
      if (!h.jail) snd(h.dur, h.glide ? 'slide' : 'place', k);
      arrive = Math.max(arrive, h.dur); if (h.goAt >= 0) goAt = h.goAt;
    });

    let t = 0, rolled = false;
    const gap = 110; // keep back-to-back sounds apart so each is heard
    const at = () => { t = Math.max(t, rolled ? arrive : 0); const r = t; t += gap; return r; };
    lines.forEach(line => {
      const k = whoOf(line, P);
      let m;
      if ((m = / rolls (\d) \+ (\d)/.exec(line))) {
        // one roll per die thrown, landing when the faces settle (the CSS tumble is 450 ms)
        snd(0, 'diceRoll', k); snd(45, 'diceRoll', k, { pitch: 1.08 });
        snd(Math.max(60, 400 * f), 'diceLand', k);
        rolled = true; t = Math.max(t, Math.min(arrive, 60));
      } else if (/ rolls \d+ for the utility\./.test(line)) {
        const a = at(); snd(a, 'diceRoll', k); snd(a + 45, 'diceRoll', k, { pitch: 1.08 }); snd(a + Math.max(60, 400 * f), 'diceLand', k); t = a + Math.max(60, 400 * f) + gap;
      } else if (/ passes Go: \+\$200\.$| lands on Go: \+\$400\.$/.test(line)) {
        snd(goAt >= 0 ? goAt : at(), 'coins', k);
      } else if (/ draws: /.test(line)) {
        const a = at(); snd(a, 'cardFlip', k); out.push({ t: a, anim: 'card' });
      } else if ((m = / buys (.+) for \$(\d+)\.$/.exec(line)) || (m = / wins (.+) for \$(\d+)\.$/.exec(line))) {
        const sq = SQ.findIndex(s => s.name === m[1]), a = at();
        snd(a, 'stamp', k); out.push({ t: a, anim: 'stamp', sq, seat: k });
        if (sq >= 0 && SQ[sq].type === 'rr') { snd(a + 140, 'train', k, { vol: vol(k) * 0.7 }); t += 200; }
      } else if (/ bids \$\d+\.$/.test(line)) {
        snd(at(), 'chip', k);
      } else if (/^Auction for /.test(line)) {
        snd(at(), 'ding', -1, { pitch: 0.75, vol: 0.6 });
      } else if ((m = / pays \$(\d+) rent to (.+)\.$/.exec(line))) {
        const to = P.findIndex(p => p.name === m[2]), a = at();
        snd(a, 'coins', k); out.push({ t: a, anim: 'coin', from: k, to, amount: +m[1] });
      } else if (/ wins the Free Parking pot: /.test(line)) {
        const a = at(); snd(a, 'coins', k); out.push({ t: a + 120, celebrate: 'big', sq: 20 });
      } else if (/ pays \$\d+ /.test(line) || / pays off the mortgage on /.test(line)) {
        snd(at(), 'coins', k, { pitch: 0.9 });
      } else if (/ owes \$\d+ .*is short\.$/.test(line)) {
        if (k >= 0 && mine(k)) snd(at(), 'alarm', k);
      } else if (/ goes to jail\.$/.test(line)) {
        const a = Math.max(at(), 220 * f); snd(a, 'clank', k); out.push({ t: a, anim: 'shake', sq: 10 });
      } else if (/ rolls out of jail\.$/.test(line)) {
        snd(at(), 'whoosh', k);
      } else if (/ uses a Get Out of Jail Free card\.$/.test(line)) {
        snd(at(), 'cardSlide', k);
      } else if ((m = / builds on (.+)\.$/.exec(line))) {
        const sq = SQ.findIndex(s => s.name === m[1]), a = at();
        const hotel = sq >= 0 && next.own[sq].houses === 5;
        snd(a, 'place', k, hotel ? { pitch: 0.8 } : null); out.push({ t: a, anim: 'pop', sq });
        if (hotel) out.push({ t: a + 80, celebrate: 'big', sq });
      } else if (/ sells a building on /.test(line)) {
        snd(at(), 'slide', k);
      } else if (/ mortgages /.test(line)) {
        snd(at(), 'cardFlip', k, { pitch: 0.8 });
      } else if (/ offers .+ a trade\.$/.test(line)) {
        snd(at(), 'cardSlide', k);
      } else if (/ accepts the trade\.$/.test(line)) {
        snd(at(), 'cardDeal', k);
      } else if (/ turns the trade down\.$/.test(line)) {
        snd(at(), 'cardSlide', k, { pitch: 0.7 });
      } else if (/ is bankrupt/.test(line)) {
        const a = at(); snd(a, 'sink', k); out.push({ t: a, anim: 'shake', target: 'center' });
      }
    });

    // a colour set finished (bought, won at auction, traded or inherited): a sparkle on its last lot
    Object.keys(GROUPS).forEach(g => {
      if (g === 'rr' || g === 'util') return;
      const o = setOwner(next, g);
      if (o >= 0 && setOwner(prev, g) !== o) { const sq = GROUPS[g][GROUPS[g].length - 1]; out.push({ t: at() + 120, celebrate: 'big', sq, seat: o }); }
    });

    // cash changes: "+$200" floats over the player's row and the number counts to the new amount
    const cashAt = arrive;
    P.forEach((p, k) => {
      const d = Math.round(p.cash - prev.players[k].cash);
      if (!d) return;
      out.push({ t: 0, delay: cashAt, anim: 'cash', seat: k, from: prev.players[k].cash, to: p.cash, text: (d > 0 ? '+' : '') + money(d), good: d > 0 });
    });

    // game over: your own win or loss (spectating computers: the winner's win)
    if (next.phase === 'over' && next.winner >= 0) {
      const anyMine = P.some((p, k) => mine(k));
      const kind = !anyMine || mine(next.winner) ? 'win' : 'lose';
      out.push({ t: Math.max(t, arrive) + 150, celebrate: kind, seat: next.winner, colors: [colors[next.winner] || '#f0b354', '#f0b354', '#f4f1ea', '#e0413a', '#2fa35a'] });
      return out;
    }

    // it just became YOUR turn (or your bid / trade answer): a chime and a pulse on the main button
    const Engine = node ? require('./engine.js') : root.Engine;
    const a0 = Engine.actor(prev), a1 = Engine.actor(next);
    if (a1 >= 0 && mine(a1) && (a1 !== a0 || next.turns !== prev.turns)) {
      const tt = Math.max(t, arrive) + 80;
      out.push({ t: tt, snd: 'turn', opt: {} }); out.push({ t: tt, anim: 'turn' });
    }
    return out;
  }

  // ---------------------------------------------------------------- playing them
  // dom: { token(k), square(sq), cash(k), center(), card(), turnBtn() } -> elements (or null)
  function run(list, dom, o) {
    o = o || {};
    const FX = o.FX || GX.FX;
    if (!FX || !list.length) return;
    const sched = o.schedule || ((fn, ms) => (ms > 0 ? setTimeout(fn, ms) : fn()));
    list.forEach(e => sched(() => { try { exec(e, dom, FX, sched); } catch (err) { /* effects never break the game */ } }, e.t));
  }
  function anim(el, frames, ms, opts) { // game-local helper: transform/opacity only, obeys Animations + Speed
    const FX = GX.FX;
    if (!el || !el.animate || !FX || !FX.settings.animations) return;
    try { el.animate(frames, Object.assign({ duration: ms * (FX.settings.animSpeed === 'fast' ? 0.5 : 1), easing: 'ease-out' }, opts || {})); } catch (e) { /* ignore */ }
  }
  function exec(e, dom, FX, sched) {
    if (e.snd) { FX.play(e.snd, e.opt); return; }
    if (e.celebrate) {
      const at = e.sq != null ? dom.square(e.sq) : null;
      FX.celebrate({ kind: e.celebrate, colors: e.colors, at });
      return;
    }
    switch (e.anim) {
      case 'card': { const c = dom.card(); anim(c, [{ transform: 'perspective(400px) rotateY(90deg)', opacity: 0.4 }, { transform: 'perspective(400px) rotateY(0deg)', opacity: 1 }], 320); return; }
      case 'stamp': { const s = dom.square(e.sq); if (s) FX.flash(s, (dom.color && dom.color(e.seat)) || undefined); return; }
      case 'pop': { const s = dom.square(e.sq); if (s) FX.pop(s); return; }
      case 'shake': { const s = e.target === 'center' ? dom.center() : dom.square(e.sq); if (s) FX.shake(s); return; }
      case 'turn': { const b = dom.turnBtn(); if (b) FX.pulse(b); return; }
      case 'coin': {
        const a = dom.token(e.from), b = dom.token(e.to);
        if (!a || !b || !FX.settings.animations || !GX.document) return;
        const r = a.getBoundingClientRect(), c = GX.document.createElement('div');
        c.className = 'fx-coin';
        c.style.cssText = `position:fixed;left:${r.left + r.width / 2 - 9}px;top:${r.top + r.height / 2 - 9}px;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3b0,#f0b354 55%,#a87411);box-shadow:0 1px 3px rgba(0,0,0,.5);pointer-events:none;z-index:2147483000`;
        GX.document.body.appendChild(c);
        FX.flyTo(c, b, { clone: false, duration: 520, scale: 1 }).then(() => c.remove(), () => c.remove());
        return;
      }
      case 'cash': {
        // the row keeps the old amount until the token arrives, then floats "+$N" and counts up
        const el0 = dom.cash(e.seat);
        if (!el0) return;
        if (FX.settings.animations) el0.textContent = money(e.from);
        sched(() => {
          const el = dom.cash(e.seat);
          if (!el) return;
          FX.floatText(el, e.text, e.good ? 'var(--good)' : 'var(--bad)');
          if (FX.settings.animations) { el.textContent = money(e.from); FX.countUp(el, e.from, e.to, { duration: 600, format: money }); }
        }, e.delay || 0);
        return;
      }
    }
  }

  const MonoFX = { events, run, newLines, hopPlan, defineSounds, money };
  if (node) module.exports = MonoFX; else root.MonoFX = MonoFX;
})(this);
