// The board, drawn as original SVG (no publisher art). 1000 x 1000 units,
// Go bottom-right, Jail bottom-left, like the real board.
(function (root) {
  'use strict';
  const { SQ, GROUP_COLOR } = root.Board;
  const NS = 'http://www.w3.org/2000/svg';
  const C = 136, W = (1000 - 2 * C) / 9, BAND = 24;

  // outer rect + which side the colour band sits on (the side facing the middle)
  function geom(i) {
    if (i === 0) return { x: 1000 - C, y: 1000 - C, w: C, h: C, side: 'corner' };
    if (i < 10) return { x: 1000 - C - i * W, y: 1000 - C, w: W, h: C, side: 'bottom' };
    if (i === 10) return { x: 0, y: 1000 - C, w: C, h: C, side: 'corner' };
    if (i < 20) return { x: 0, y: 1000 - C - (i - 10) * W, w: C, h: W, side: 'left' };
    if (i === 20) return { x: 0, y: 0, w: C, h: C, side: 'corner' };
    if (i < 30) return { x: C + (i - 21) * W, y: 0, w: W, h: C, side: 'top' };
    if (i === 30) return { x: 1000 - C, y: 0, w: C, h: C, side: 'corner' };
    return { x: 1000 - C, y: C + (i - 31) * W, w: C, h: W, side: 'right' };
  }
  function bandRect(g) {
    switch (g.side) {
      case 'bottom': return { x: g.x, y: g.y, w: g.w, h: BAND };
      case 'top': return { x: g.x, y: g.y + g.h - BAND, w: g.w, h: BAND };
      case 'left': return { x: g.x + g.w - BAND, y: g.y, w: BAND, h: g.h };
      case 'right': return { x: g.x, y: g.y, w: BAND, h: g.h };
    }
    return null;
  }
  // content area (outside the band)
  function inner(g, hasBand) {
    if (!hasBand) return { x: g.x, y: g.y, w: g.w, h: g.h };
    switch (g.side) {
      case 'bottom': return { x: g.x, y: g.y + BAND, w: g.w, h: g.h - BAND };
      case 'top': return { x: g.x, y: g.y, w: g.w, h: g.h - BAND };
      case 'left': return { x: g.x, y: g.y, w: g.w - BAND, h: g.h };
      case 'right': return { x: g.x + BAND, y: g.y, w: g.w - BAND, h: g.h };
    }
    return { x: g.x, y: g.y, w: g.w, h: g.h };
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // simple line glyphs, centred on (cx, cy), about 36 units tall
  function glyph(i, cx, cy, parent, scale) {
    const s = SQ[i], g = el('g', { class: 'glyph', transform: `translate(${cx} ${cy})${scale ? ` scale(${scale})` : ''}` }, parent);
    const t = s.type;
    if (t === 'chance') { const q = el('text', { x: 0, y: 14, 'font-size': 46, 'font-weight': 800, fill: '#f0b354', stroke: 'none', 'text-anchor': 'middle' }, g); q.textContent = '?'; }
    else if (t === 'cc') { el('rect', { x: -18, y: -10, width: 36, height: 24, rx: 3, stroke: '#6ea8fe' }, g); el('path', { d: 'M-18 -2 H18 M-18 -10 Q0 -24 18 -10', stroke: '#6ea8fe' }, g); el('rect', { x: -4, y: -5, width: 8, height: 7, stroke: '#6ea8fe' }, g); }
    else if (t === 'rr') { el('path', { d: 'M-20 8 V-6 H4 V-16 H14 V-6 H20 V8 Z M-14 -6 V-14 H-6 V-6' }, g); el('circle', { cx: -11, cy: 13, r: 5 }, g); el('circle', { cx: 11, cy: 13, r: 5 }, g); }
    else if (t === 'util' && i === 12) { el('path', { d: 'M-7 10 V4 Q-16 -2 -16 -10 A16 16 0 0 1 16 -10 Q16 -2 7 4 V10 Z M-6 16 H6', stroke: '#f2d43a' }, g); }
    else if (t === 'util') { el('path', { d: 'M0 -20 Q16 0 14 8 A14 14 0 0 1 -14 8 Q-16 0 0 -20 Z', stroke: '#6ea8fe' }, g); }
    else if (t === 'tax' && i === 38) { el('path', { d: 'M-16 -6 L-8 -16 H8 L16 -6 L0 16 Z M-16 -6 H16', stroke: '#c9cedd' }, g); }
    else if (t === 'tax') { el('circle', { cx: 0, cy: 0, r: 17, stroke: '#c9cedd' }, g); const d = el('text', { x: 0, y: 8, 'font-size': 22, 'font-weight': 800, fill: '#c9cedd', stroke: 'none', 'text-anchor': 'middle' }, g); d.textContent = '$'; }
    else if (t === 'go') { el('path', { d: 'M26 26 H-24 M-8 10 L-24 26 L-8 42', stroke: '#e0413a', 'stroke-width': 7 }, g); const x = el('text', { x: 0, y: 2, 'font-size': 40, 'font-weight': 900, fill: '#e8eaf0', stroke: 'none', 'text-anchor': 'middle' }, g); x.textContent = 'GO'; }
    else if (t === 'jail') { el('rect', { x: -6, y: -50, width: 56, height: 56, rx: 4, stroke: '#f08a2c', 'stroke-width': 4 }, g); el('path', { d: 'M8 -50 V6 M22 -50 V6 M36 -50 V6', stroke: '#f08a2c', 'stroke-width': 4 }, g); }
    else if (t === 'free') { el('circle', { cx: 0, cy: -6, r: 24, stroke: '#6ea8fe', 'stroke-width': 5 }, g); const x = el('text', { x: 0, y: 6, 'font-size': 32, 'font-weight': 900, fill: '#6ea8fe', stroke: 'none', 'text-anchor': 'middle' }, g); x.textContent = 'P'; }
    else if (t === 'gotojail') { el('path', { d: 'M24 -26 L-18 16 M-18 -6 V16 H4', stroke: '#e0413a', 'stroke-width': 7 }, g); }
    return g;
  }

  function create(svg, onTap) {
    svg.innerHTML = '';
    el('rect', { class: 'board-felt', x: C, y: C, width: 1000 - 2 * C, height: 1000 - 2 * C }, svg);
    const sqs = [];
    for (let i = 0; i < 40; i++) {
      const s = SQ[i], g = geom(i);
      const grp = el('g', { class: 'sq', 'data-sq': i, tabindex: -1 }, svg);
      const base = el('rect', { class: 'base', x: g.x, y: g.y, width: g.w, height: g.h }, grp);
      const hasBand = s.type === 'prop';
      let band = null;
      if (hasBand) { const b = bandRect(g); band = el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: GROUP_COLOR[s.group], stroke: '#0f1117', 'stroke-width': 2 }, grp); }
      const r = inner(g, hasBand);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const isCorner = g.side === 'corner';
      // the owner strip sits on the outer edge: keep the name (top row) and price (bottom row) clear of it
      const nm = el('text', { class: 'nm', x: cx, y: isCorner ? r.y + 22 : g.side === 'top' ? r.y + 30 : r.y + 20 }, grp);
      nm.textContent = isCorner ? (i === 10 ? 'Jail' : i === 30 ? 'To Jail' : i === 20 ? 'Parking' : '') : s.short;
      const sideways = g.side === 'left' || g.side === 'right'; // short squares: smaller picture between name and price
      const gl = (s.type !== 'prop') ? glyph(i, cx, isCorner ? cy - (i === 10 ? -10 : 8) : sideways ? cy + 1 : cy + 4, grp, sideways ? 0.62 : 0) : null;
      // corners: picture in the middle, number underneath (jail: bottom-left, clear of the bars)
      const val = el('text', { class: 'val', x: i === 10 ? cx - 26 : cx, y: isCorner ? cy + 50 : cy + 10 }, grp);
      const price = el('text', { class: 'price', x: cx, y: r.y + r.h - (g.side === 'bottom' ? 18 : 10) }, grp);
      if (s.price) price.textContent = '$' + s.price;
      // owner mark on the outer edge, buildings on the band
      const om = el('rect', { class: 'ownmark', visibility: 'hidden' }, grp);
      const o = outerStrip(g); for (const k in o) om.setAttribute(k, o[k]);
      const houses = el('g', {}, grp);
      grp.addEventListener('click', () => onTap && onTap(i));
      sqs.push({ grp, base, band, nm, val, price, gl, om, houses, g, r, cx, cy, isCorner });
    }
    const tokLayer = el('g', { class: 'tokens' }, svg);
    return { svg, sqs, tokLayer, tokens: {}, anim: {} };
  }
  function outerStrip(g) {
    const t = 9;
    switch (g.side) {
      case 'bottom': return { x: g.x + 3, y: g.y + g.h - t - 2, width: g.w - 6, height: t };
      case 'top': return { x: g.x + 3, y: g.y + 2, width: g.w - 6, height: t };
      case 'left': return { x: g.x + 2, y: g.y + 3, width: t, height: g.h - 6 };
      case 'right': return { x: g.x + g.w - t - 2, y: g.y + 3, width: t, height: g.h - 6 };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  function lerpHex(a, b, t) {
    const pa = [1, 3, 5].map(k => parseInt(a.slice(k, k + 2), 16)), pb = [1, 3, 5].map(k => parseInt(b.slice(k, k + 2), 16));
    return '#' + pa.map((v, k) => Math.round(v + (pb[k] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  // one hue, dark -> bright amber (magnitude)
  function heatColor(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? lerpHex('#1d2231', '#7a5a2a', t / 0.5) : lerpHex('#7a5a2a', '#f0b354', (t - 0.5) / 0.5);
  }
  // red -> yellow -> green for good/bad numbers (Tim's rule)
  function goodBad(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? lerpHex('#e0675f', '#f0d36e', t / 0.5) : lerpHex('#f0d36e', '#6ee7a8', (t - 0.5) / 0.5);
  }

  // opts: { heat: [0..1]|null, values: [str]|null, own, colors, tokens: [{id, pos, color, jail, turn}], selected }
  function update(view, opts) {
    const small = view.svg.getBoundingClientRect().width < 560;
    view.svg.classList.toggle('board-small', small);
    for (let i = 0; i < 40; i++) {
      const q = view.sqs[i];
      const h = opts.heat ? opts.heat[i] : null;
      // no heat: a faint wash of the set's colour so the board reads like a board
      const fill = h == null ? (SQ[i].type === 'prop' ? lerpHex('#1d2231', GROUP_COLOR[SQ[i].group], 0.12) : '') : (opts.heatFn || heatColor)(h);
      q.base.style.fill = fill;
      const light = h != null && h > 0.62 && !opts.heatFn;
      q.val.textContent = opts.values ? (opts.values[i] || '') : '';
      q.val.style.fill = light ? '#1d1404' : '';
      q.nm.style.fill = light ? '#2a1d06' : '';
      q.price.style.display = opts.values && opts.values[i] ? 'none' : '';
      if (q.gl) q.gl.style.display = opts.values && opts.values[i] && !q.isCorner ? 'none' : '';
      q.grp.classList.toggle('sel', opts.selected === i);
      // owner + buildings
      const o = opts.own && opts.own[i];
      if (o && o.owner >= 0 && opts.colors) {
        q.om.setAttribute('visibility', 'visible');
        q.om.style.fill = opts.colors[o.owner] || '#888';
        q.om.style.opacity = o.mort ? 0.35 : 1;
      } else q.om.setAttribute('visibility', 'hidden');
      drawHouses(q, o ? o.houses : 0, o && o.mort);
    }
    drawTokens(view, opts.tokens || []);
  }

  function drawHouses(q, n, mort) {
    const key = n + (mort ? 'm' : '');
    if (q.hk === key) return;
    q.hk = key;
    q.houses.innerHTML = '';
    if (!q.band) return;
    const b = q.band, x = +b.getAttribute('x'), y = +b.getAttribute('y'), w = +b.getAttribute('width'), h = +b.getAttribute('height');
    const horiz = w > h;
    if (mort) { const t = el('text', { x: x + w / 2, y: y + h / 2 + 6, 'font-size': 16, 'font-weight': 800, fill: '#0f1117', 'text-anchor': 'middle' }, q.houses); t.textContent = horiz ? 'MORT' : 'M'; return; }
    if (n === 5) { el('rect', { class: 'house', x: x + w / 2 - (horiz ? 22 : 9), y: y + h / 2 - (horiz ? 9 : 22), width: horiz ? 44 : 18, height: horiz ? 18 : 44, rx: 3, fill: '#e0413a' }, q.houses); return; }
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 18;
      el('rect', { class: 'house', x: x + w / 2 - 7 + (horiz ? off : 0), y: y + h / 2 - 7 + (horiz ? 0 : off), width: 14, height: 14, rx: 2, fill: '#2fa35a' }, q.houses);
    }
  }

  function tokenXY(view, pos, slot, count, jail) {
    const q = view.sqs[pos];
    let cx = q.cx, cy = q.cy;
    if (q.isCorner && pos !== 10) cy += 34;
    if (pos === 10) { if (jail) { cx = q.g.x + 98; cy = q.g.y + 36; } else { cx = q.g.x + 34; cy = q.g.y + 96; } }
    const cols = Math.min(3, count), row = Math.floor(slot / 3), col = slot % 3;
    const dx = (col - (cols - 1) / 2) * 24, dy = (row - (Math.ceil(count / 3) - 1) / 2) * 24 + (q.isCorner ? 0 : 6);
    return [cx + dx, cy + dy];
  }

  function drawTokens(view, tokens) {
    const seen = {};
    const groups = {};
    tokens.forEach(t => { const k = t.pos + (t.jail ? 'j' : ''); (groups[k] = groups[k] || []).push(t); });
    tokens.forEach(t => {
      seen[t.id] = true;
      const k = t.pos + (t.jail ? 'j' : '');
      const slot = groups[k].indexOf(t), count = groups[k].length;
      let tk = view.tokens[t.id];
      if (!tk) {
        const g = el('g', { class: 'token' }, view.tokLayer);
        el('circle', { r: 15, fill: t.color }, g);
        tk = view.tokens[t.id] = { g, pos: t.pos, jail: t.jail };
        const [x, y] = tokenXY(view, t.pos, slot, count, t.jail);
        g.setAttribute('transform', `translate(${x} ${y})`);
      }
      tk.g.classList.toggle('turn', !!t.turn);
      tk.g.querySelector('circle').setAttribute('fill', t.color);
      tk.g.style.opacity = t.out ? 0.25 : 1;
      const dest = tokenXY(view, t.pos, slot, count, t.jail);
      if (tk.pos !== t.pos && !t.jump && !t.jail) hop(view, tk, tk.pos, t.pos, dest);
      else if (!tk.busy) tk.g.setAttribute('transform', `translate(${dest[0]} ${dest[1]})`);
      else tk.final = dest;
      tk.pos = t.pos; tk.jail = t.jail;
    });
    for (const id in view.tokens) if (!seen[id]) { view.tokens[id].g.remove(); delete view.tokens[id]; }
  }

  // walk square by square so moves feel physical (max ~1.2s)
  function hop(view, tk, from, to, dest) {
    const steps = [];
    let p = from;
    const n = (to - from + 40) % 40;
    if (n === 0 || n > 12) { tk.g.setAttribute('transform', `translate(${dest[0]} ${dest[1]})`); return; }
    for (let k = 0; k < n; k++) { p = (p + 1) % 40; steps.push(p); }
    tk.busy = true; tk.final = dest;
    const per = Math.max(60, Math.min(120, 1100 / steps.length));
    let k = 0;
    const tick = () => {
      if (k >= steps.length) { tk.busy = false; tk.g.setAttribute('transform', `translate(${tk.final[0]} ${tk.final[1]})`); return; }
      const sq = view.sqs[steps[k]];
      tk.g.setAttribute('transform', `translate(${sq.cx} ${sq.cy})`);
      k++;
      setTimeout(tick, per);
    };
    tick();
  }

  root.BoardView = { create, update, heatColor, goodBad, geom };
})(this);
