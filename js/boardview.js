// The board, drawn as original SVG (no publisher art). 1000 x 1000 units,
// laid out like the real board: Go bottom-right, Jail bottom-left, pale mint paper,
// colour bands facing the middle, and every side printed to face the player who sits there
// (bottom row upright, left column turned a quarter, top row upside down, right column the other way).
(function (root) {
  'use strict';
  const { SQ, GROUP_COLOR } = root.Board;
  const NS = 'http://www.w3.org/2000/svg';
  const C = 136, W = (1000 - 2 * C) / 9, BAND = 26;
  const MINT = '#d3e7d3', INK = '#17201a';

  // the words printed on each space, line by line (as on the real board)
  const PRINT = {
    1: ['MEDITER-', 'RANEAN', 'AVENUE'], 2: ['COMMUNITY', 'CHEST'], 3: ['BALTIC', 'AVENUE'], 4: ['INCOME', 'TAX'],
    5: ['READING', 'RAILROAD'], 6: ['ORIENTAL', 'AVENUE'], 7: ['CHANCE'], 8: ['VERMONT', 'AVENUE'], 9: ['CONNECTICUT', 'AVENUE'],
    11: ['ST. CHARLES', 'PLACE'], 12: ['ELECTRIC', 'COMPANY'], 13: ['STATES', 'AVENUE'], 14: ['VIRGINIA', 'AVENUE'],
    15: ['PENNSYLVANIA', 'RAILROAD'], 16: ['ST. JAMES', 'PLACE'], 17: ['COMMUNITY', 'CHEST'], 18: ['TENNESSEE', 'AVENUE'], 19: ['NEW YORK', 'AVENUE'],
    21: ['KENTUCKY', 'AVENUE'], 22: ['CHANCE'], 23: ['INDIANA', 'AVENUE'], 24: ['ILLINOIS', 'AVENUE'], 25: ['B. & O.', 'RAILROAD'],
    26: ['ATLANTIC', 'AVENUE'], 27: ['VENTNOR', 'AVENUE'], 28: ['WATER', 'WORKS'], 29: ['MARVIN', 'GARDENS'],
    31: ['PACIFIC', 'AVENUE'], 32: ['NORTH', 'CAROLINA', 'AVENUE'], 33: ['COMMUNITY', 'CHEST'], 34: ['PENNSYLVANIA', 'AVENUE'],
    35: ['SHORT', 'LINE'], 36: ['CHANCE'], 37: ['PARK', 'PLACE'], 38: ['LUXURY', 'TAX'], 39: ['BOARD-', 'WALK'],
  };

  // outer rect + which side of the board the space is on
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
  // each side space is drawn upright in a W x C local frame (band at the top = towards the middle,
  // price at the bottom = the outer edge), then turned to face its side
  function frame(g) {
    switch (g.side) {
      case 'bottom': return { tf: `translate(${g.x} ${g.y})`, map: (x, y) => [g.x + x, g.y + y] };
      case 'top': return { tf: `translate(${g.x + W} ${g.y + C}) rotate(180)`, map: (x, y) => [g.x + W - x, g.y + C - y] };
      case 'left': return { tf: `translate(${g.x + C} ${g.y}) rotate(90)`, map: (x, y) => [g.x + C - y, g.y + x] };
      case 'right': return { tf: `translate(${g.x} ${g.y + W}) rotate(-90)`, map: (x, y) => [g.x + y, g.y + W - x] };
    }
    return { tf: `translate(${g.x} ${g.y})`, map: (x, y) => [g.x + x, g.y + y] };
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  // printed caps squeezed to fit the space, like the narrow type on the real board
  function printLines(parent, lines, cx, y0, size, maxW, cls) {
    lines.forEach((s, k) => {
      const t = txt(parent, cx, y0 + k * (size + 1.5), s, { class: cls || 'nm', 'font-size': size });
      const est = s.length * size * 0.66;
      if (est > maxW) { t.setAttribute('textLength', maxW); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    });
  }

  // simple original line art, drawn upright around (0, 0), about 40 units tall
  function glyph(i, parent) {
    const s = SQ[i], t = s.type, g = el('g', { class: 'glyph' }, parent);
    if (t === 'chance') { txt(g, 0, 18, '?', { 'font-size': 56, 'font-weight': 900, fill: i === 7 ? '#d6322b' : i === 22 ? '#2b62c4' : '#ef8a1d', stroke: INK, 'stroke-width': 1.5, class: 'qm' }); }
    else if (t === 'cc') {
      el('path', { d: 'M-20 -4 Q0 -22 20 -4 Z', fill: '#c98a3a' }, g);
      el('rect', { x: -20, y: -4, width: 40, height: 22, rx: 2, fill: '#b36f2a' }, g);
      el('path', { d: 'M-20 4 H20 M-13 -4 V18 M13 -4 V18', stroke: '#e9c25a', 'stroke-width': 3 }, g);
      el('rect', { x: -4, y: 0, width: 8, height: 8, fill: '#e9c25a' }, g);
    } else if (t === 'rr') {
      el('path', { d: 'M-24 10 V-6 H2 V-18 H14 V-6 H22 V10 Z M-18 -6 V-15 H-8 V-6 M-30 10 L-24 4', fill: '#2a2a2a' }, g);
      el('rect', { x: -2, y: -26, width: 8, height: 8, fill: '#2a2a2a' }, g);
      [[-15, 14], [-3, 14], [12, 14]].forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 5.5, fill: '#2a2a2a', stroke: MINT, 'stroke-width': 1.5 }, g));
    } else if (t === 'util' && i === 12) {
      el('path', { d: 'M-8 10 V4 Q-17 -3 -17 -11 A17 17 0 0 1 17 -11 Q17 -3 8 4 V10 Z', fill: '#f7df5a', stroke: INK, 'stroke-width': 2.5 }, g);
      el('path', { d: 'M-7 14 H7 M-6 18 H6 M-4 -10 L0 -2 L4 -10', stroke: INK, 'stroke-width': 2.5, fill: 'none' }, g);
    } else if (t === 'util') {
      el('path', { d: 'M-20 -8 H6 Q14 -8 14 0 V6 H6 V2 Q6 0 4 0 H-20 Z M-10 -8 V-16 M-16 -16 H-4', fill: '#9aa6b2', stroke: INK, 'stroke-width': 2.5 }, g);
      el('path', { d: 'M10 10 Q6 16 10 20 Q14 16 10 10 Z', fill: '#3d7fe0' }, g);
    } else if (t === 'tax' && i === 38) {
      el('path', { d: 'M-16 -8 L-8 -18 H8 L16 -8 L0 14 Z', fill: '#cfe9f5', stroke: INK, 'stroke-width': 2.5 }, g);
      el('path', { d: 'M-16 -8 H16 M-6 -8 L0 14 L6 -8', stroke: INK, 'stroke-width': 1.5, fill: 'none' }, g);
    } else if (t === 'tax') {
      el('path', { d: 'M0 -20 L18 0 L0 20 L-18 0 Z', fill: 'none', stroke: INK, 'stroke-width': 3 }, g);
      txt(g, 0, 8, '$', { 'font-size': 22, 'font-weight': 900, fill: INK });
    }
    return g;
  }

  // the four corners: printed on the diagonal, facing whoever sits nearest
  function corner(i, g, grp) {
    const cx = g.x + C / 2, cy = g.y + C / 2;
    const rot = { 0: -45, 10: 45, 20: 135, 30: -135 }[i];
    if (i === 10) {
      // the cell sits in the inner corner; "Just visiting" runs along the outside L
      el('rect', { x: g.x + C * 0.3, y: g.y, width: C * 0.7, height: C * 0.7, fill: '#f08a2c', stroke: INK, 'stroke-width': 2 }, grp);
      const bars = el('g', { stroke: INK, 'stroke-width': 3 }, grp);
      for (let k = 1; k < 5; k++) el('line', { x1: g.x + C * 0.3 + k * C * 0.14, y1: g.y + 6, x2: g.x + C * 0.3 + k * C * 0.14, y2: g.y + C * 0.7 - 6 }, bars);
      const lab = el('g', { transform: `translate(${g.x + C * 0.65} ${g.y + C * 0.35}) rotate(45)` }, grp);
      el('rect', { x: -26, y: -11, width: 52, height: 22, fill: '#f6efe0', stroke: INK, 'stroke-width': 1.5 }, lab);
      txt(lab, 0, 6, 'IN JAIL', { class: 'nm', 'font-size': 12 });
      txt(grp, g.x + C * 0.6, g.y + C - 12, 'VISITING', { class: 'nm', 'font-size': 15 });
      txt(grp, 0, 0, 'JUST', { class: 'nm', 'font-size': 15, transform: `translate(${g.x + 26} ${g.y + C * 0.38}) rotate(90)` });
      return { glY: 0 };
    }
    const c = el('g', { transform: `translate(${cx} ${cy}) rotate(${rot})` }, grp);
    if (i === 0) {
      txt(c, 0, -34, 'COLLECT $200', { class: 'nm', 'font-size': 12 });
      txt(c, 0, -21, 'SALARY AS YOU PASS', { class: 'nm', 'font-size': 10 });
      txt(c, 0, 26, 'GO', { 'font-size': 58, 'font-weight': 900, fill: '#d6322b', class: 'go', 'letter-spacing': 2 });
      el('path', { d: `M${g.x + C - 14} ${g.y + C - 16} H${g.x + 34} M${g.x + 50} ${g.y + C - 30} L${g.x + 24} ${g.y + C - 16} L${g.x + 50} ${g.y + C - 2}`, stroke: '#d6322b', 'stroke-width': 9, fill: 'none', 'stroke-linejoin': 'round' }, grp);
    } else if (i === 20) {
      txt(c, 0, -30, 'FREE', { class: 'nm', 'font-size': 17 });
      el('path', { d: 'M-30 10 V0 L-20 -4 L-12 -16 H10 L20 -4 L30 0 V10 Z', fill: '#d6322b', stroke: INK, 'stroke-width': 2 }, c);
      el('path', { d: 'M-9 -13 H0 V-4 H-15 Z M3 -13 H9 L16 -4 H3 Z', fill: '#cfe9f5' }, c);
      el('circle', { cx: -17, cy: 11, r: 6.5, fill: INK }, c); el('circle', { cx: 17, cy: 11, r: 6.5, fill: INK }, c);
      txt(c, 0, 40, 'PARKING', { class: 'nm', 'font-size': 17 });
    } else if (i === 30) {
      txt(c, 0, -32, 'GO TO', { class: 'nm', 'font-size': 17 });
      // an officer's cap and a pointing arrow (towards the jail, across the board)
      el('path', { d: 'M-16 -2 Q0 -22 16 -2 Z', fill: '#2b4f9e', stroke: INK, 'stroke-width': 2 }, c);
      el('path', { d: 'M-20 -2 H20 V3 H-20 Z', fill: INK }, c);
      el('path', { d: 'M0 30 V14 M-7 21 L0 13 L7 21', stroke: '#2b4f9e', 'stroke-width': 4, fill: 'none' }, c);
      txt(c, 0, 52, 'JAIL', { class: 'nm', 'font-size': 17 });
    }
    return { glY: 0 };
  }

  function create(svg, onTap) {
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    // pewter for the playing pieces
    const lg = el('linearGradient', { id: 'pewter', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    [['0', '#f4f6f8'], ['.45', '#aab1ba'], ['.7', '#7d848e'], ['1', '#c9ced5']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, lg));
    el('rect', { class: 'board-paper', x: 0, y: 0, width: 1000, height: 1000 }, svg);
    el('rect', { class: 'board-felt', x: C, y: C, width: 1000 - 2 * C, height: 1000 - 2 * C }, svg);
    const sqs = [];
    for (let i = 0; i < 40; i++) {
      const s = SQ[i], g = geom(i);
      const isCorner = g.side === 'corner';
      const grp = el('g', { class: 'sq', 'data-sq': i, tabindex: -1 }, svg);
      const base = el('rect', { class: 'base', x: g.x, y: g.y, width: g.w, height: g.h }, grp);
      let band = null, nm = null, price = null, sprice = null, gl = null, om, houses, cx, cy;
      if (isCorner) {
        corner(i, g, grp);
        cx = g.x + C / 2; cy = g.y + C / 2;
        om = el('rect', { class: 'ownmark', visibility: 'hidden' }, grp);
        houses = el('g', {}, grp);
      } else {
        const f = frame(g);
        const loc = el('g', { transform: f.tf }, grp);
        const hasBand = s.type === 'prop';
        if (hasBand) band = el('rect', { class: 'band', x: 0, y: 0, width: W, height: BAND, fill: GROUP_COLOR[s.group] }, loc);
        const top = hasBand ? BAND : 0;
        const lines = PRINT[i] || [s.name.toUpperCase()];
        nm = el('g', { class: 'print' }, loc);
        printLines(nm, lines, W / 2, top + 17, 12.5, W - 8);
        if (!hasBand) {
          gl = el('g', { transform: `translate(${W / 2} ${s.type === 'chance' ? 72 : lines.length > 1 ? 74 : 66})` }, loc);
          glyph(i, gl);
        }
        price = txt(loc, W / 2, C - 14, s.price ? '$' + s.price : s.amount ? 'PAY $' + s.amount : '', { class: 'price' });
        // phone: names are too small to read, so lots show their price big in the middle instead
        if (hasBand) { sprice = txt(loc, W / 2, BAND + (C - BAND) / 2 + 10, '$' + s.price, { class: 'sprice' }); }
        om = el('rect', { class: 'ownmark', visibility: 'hidden', x: 3, y: C - 11, width: W - 6, height: 9 }, loc);
        houses = el('g', { class: 'bldg' }, loc);
        [cx, cy] = f.map(W / 2, (top + C) / 2);
      }
      grp.addEventListener('click', () => onTap && onTap(i));
      sqs.push({ grp, base, band, nm, price, sprice, gl, om, houses, g, cx, cy, isCorner });
    }
    // Odds values sit upright on top of everything so they can always be read
    const valLayer = el('g', { class: 'vals' }, svg);
    sqs.forEach((q, i) => {
      const y = q.isCorner ? q.cy + (i === 10 ? 52 : 50) : q.cy + 9;
      q.val = txt(valLayer, i === 10 ? q.cx - 30 : q.cx, y, '', { class: 'val' });
    });
    const tokLayer = el('g', { class: 'tokens' }, svg);
    return { svg, sqs, tokLayer, tokens: {}, anim: {} };
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
    if (view.small !== small) {
      view.small = small;
      // phone: thicker owner strips so the owner can be seen at a glance
      for (const q of view.sqs) {
        if (!q.isCorner) { q.om.setAttribute('y', C - (small ? 20 : 11)); q.om.setAttribute('height', small ? 18 : 9); }
        q.hk = null;
      }
      for (const id in view.tokens) view.tokens[id].fig.setAttribute('transform', `scale(${small ? 1.45 : 1.05})`);
    }
    for (let i = 0; i < 40; i++) {
      const q = view.sqs[i];
      const h = opts.heat ? opts.heat[i] : null;
      const o = opts.own && opts.own[i];
      const owned = o && o.owner >= 0 && opts.colors;
      // no heat: the plain mint paper of the real board; owned lots lean a little towards the owner's colour
      let fill = h == null ? MINT : (opts.heatFn || heatColor)(h);
      if (h == null && owned && !o.mort && /^#[0-9a-f]{6}$/i.test(opts.colors[o.owner] || '')) fill = lerpHex(MINT, opts.colors[o.owner], 0.22);
      q.base.style.fill = fill;
      // dark heat squares need light print
      q.grp.classList.toggle('inv', h != null && !opts.heatFn && h <= 0.62);
      const showVal = !!(opts.values && opts.values[i]);
      q.val.textContent = showVal ? opts.values[i] : '';
      q.val.style.fill = h != null && !opts.heatFn && h <= 0.62 ? '#f4f1ea' : '';
      if (q.price) q.price.style.display = showVal ? 'none' : '';
      if (q.sprice) q.sprice.style.display = showVal ? 'none' : '';
      if (q.gl) q.gl.style.display = showVal ? 'none' : '';
      if (q.isCorner) q.grp.classList.toggle('dimart', showVal);
      q.grp.classList.toggle('sel', opts.selected === i);
      if (owned && !q.isCorner) {
        q.om.setAttribute('visibility', 'visible');
        q.om.style.fill = opts.colors[o.owner] || '#888';
        q.om.style.opacity = o.mort ? 0.35 : 1;
      } else q.om.setAttribute('visibility', 'hidden');
      drawHouses(q, o ? o.houses : 0, o && o.mort, small);
    }
    drawTokens(view, opts.tokens || [], small);
  }

  // little green houses and red hotels with pitched roofs, standing on the colour band
  function drawHouses(q, n, mort, small) {
    const key = n + (mort ? 'm' : '') + (small ? 's' : '');
    if (q.hk === key) return;
    q.hk = key;
    q.houses.innerHTML = '';
    if (!q.band) return;
    if (mort) { txt(q.houses, W / 2, BAND / 2 + 6, 'MORT', { 'font-size': small ? 19 : 15, 'font-weight': 900, fill: INK, class: 'mort' }); return; }
    const hs = small ? 18 : 15, gap = small ? 19.5 : 18.5;
    const house = (x0, w, fill, dark) => {
      const yb = BAND / 2 + hs * 0.55, ym = yb - hs * 0.6, yt = ym - hs * 0.5, xm = x0 + w / 2;
      el('path', { class: 'house', d: `M${x0} ${yb} V${ym} L${xm} ${yt} L${x0 + w} ${ym} V${yb} Z`, fill }, q.houses);
      el('path', { d: `M${xm} ${yt} L${x0 + w} ${ym} V${yb} H${xm} Z`, fill: dark, opacity: 0.55 }, q.houses);
    };
    if (n === 5) { const w = small ? 46 : 40; house(W / 2 - w / 2, w, '#d4352e', '#7a1612'); return; }
    for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * gap; house(W / 2 - hs / 2 + off, hs, '#2e9d4e', '#0f4a22'); }
  }

  function tokenXY(view, pos, slot, count, jail, small) {
    const q = view.sqs[pos];
    let cx = q.cx, cy = q.cy;
    if (q.isCorner && pos !== 10) cy += small ? 30 : 26;
    if (pos === 10) { if (jail) { cx = q.g.x + 92; cy = q.g.y + 44; } else { cx = q.g.x + 30; cy = q.g.y + 92; } }
    const sp = small ? 30 : 24;
    const cols = Math.min(3, count), row = Math.floor(slot / 3), col = slot % 3;
    const dx = (col - (cols - 1) / 2) * sp, dy = (row - (Math.ceil(count / 3) - 1) / 2) * sp + (q.isCorner ? 0 : 6);
    return [cx + dx, cy + dy];
  }

  // CSS transform (not the SVG attribute) so the browser can glide the piece between squares
  // Settings > Animations: 1 normal, 0.5 fast, 0 off (pieces jump straight to their square)
  const speed = () => { const v = root.BoardView && root.BoardView.speed; return v == null ? 1 : v; };
  function place(tk, x, y, ms) {
    ms = ms * speed();
    tk.g.style.transition = ms ? `transform ${ms}ms cubic-bezier(.3,.7,.4,1)` : 'none';
    tk.g.style.transform = `translate(${x}px, ${y}px)`;
  }

  // small pewter pieces (original drawings), each standing on a base in its player's colour
  const FIGS = [
    'M-13 0 Q0 5 13 0 L9 -4 H7 V-22 Q0 -25 -7 -22 V-4 H-9 Z',                                   // hat
    'M-16 -2 V-8 L-10 -10 L-5 -17 H6 L11 -10 L16 -8 V-2 Z',                                       // car
    'M-16 -9 H16 L10 0 H-10 Z M-1 -9 V-26 L11 -12 H-1',                                           // ship
    'M-6 -25 H4 V-9 L14 -6 Q16 0 10 0 H-8 Q-9 -7 -6 -11 Z',                                       // boot
    'M-9 0 L-7 -18 Q0 -25 7 -18 L9 0 Z',                                                           // thimble
    'M-15 0 H15 Q13 -10 0 -12 H-15 Z M-9 -12 Q-5 -23 7 -12',                                      // iron
    'M-15 -14 H8 L4 -5 H-11 Z M-15 -14 L-19 -18 M-11 -5 L-15 0',                                   // barrow
    'M-15 0 V-8 L-13 -15 L-9 -10 H6 L8 -17 L15 -12 V-8 L11 -6 V0 H7 V-4 H-8 V0 Z',                // dog
  ];
  function drawTokens(view, tokens, small) {
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
        const fig = el('g', { transform: `scale(${small ? 1.45 : 1.05})` }, g);
        el('ellipse', { class: 'shadow', cx: 2, cy: 9, rx: 17, ry: 6 }, fig);
        el('ellipse', { class: 'base', cx: 0, cy: 6, rx: 15, ry: 6, fill: t.color }, fig);
        const n = (+String(t.id).replace(/\D/g, '') || 0) % FIGS.length;
        el('path', { class: 'pewter', d: FIGS[n], transform: 'translate(0 6)' }, fig);
        if (n === 1) [-8, 8].forEach(x => el('circle', { class: 'pewter', cx: x, cy: 5, r: 3.5 }, fig));
        if (n === 6) el('circle', { class: 'pewter', cx: 8, cy: 3, r: 4 }, fig);
        tk = view.tokens[t.id] = { g, fig, pos: t.pos, jail: t.jail };
        const [x, y] = tokenXY(view, t.pos, slot, count, t.jail, small);
        place(tk, x, y, 0);
      }
      tk.g.classList.toggle('turn', !!t.turn);
      tk.g.querySelector('.base').setAttribute('fill', t.color);
      tk.g.style.opacity = t.out ? 0.25 : 1;
      const dest = tokenXY(view, t.pos, slot, count, t.jail, small);
      if (tk.pos !== t.pos && !t.jump && !t.jail) hop(view, tk, tk.pos, t.pos, dest, small);
      else if (!tk.busy) place(tk, dest[0], dest[1], 220);
      else tk.final = dest;
      tk.pos = t.pos; tk.jail = t.jail;
    });
    for (const id in view.tokens) if (!seen[id]) { view.tokens[id].g.remove(); delete view.tokens[id]; }
  }

  // walk square by square so moves feel physical (max ~1.2s); each step glides
  function hop(view, tk, from, to, dest, small) {
    const steps = [];
    let p = from;
    const n = (to - from + 40) % 40;
    if (n === 0 || n > 12 || !speed()) { place(tk, dest[0], dest[1], 320); return; }
    for (let k = 0; k < n; k++) { p = (p + 1) % 40; steps.push(p); }
    tk.busy = true; tk.final = dest;
    const per = Math.max(60, Math.min(120, 1100 / steps.length)) * speed();
    let k = 0;
    const tick = () => {
      if (k >= steps.length) { tk.busy = false; tk.g.style.transition = `transform ${per}ms cubic-bezier(.3,.7,.4,1)`; tk.g.style.transform = `translate(${tk.final[0]}px, ${tk.final[1]}px)`; return; }
      const sq = view.sqs[steps[k]];
      tk.g.style.transition = `transform ${per}ms cubic-bezier(.3,.7,.4,1)`;
      tk.g.style.transform = `translate(${sq.cx}px, ${sq.cy + (sq.isCorner ? (small ? 30 : 26) : 6)}px)`;
      k++;
      setTimeout(tick, per);
    };
    tick();
  }

  root.BoardView = { create, update, heatColor, goodBad, geom };
})(this);
