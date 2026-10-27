// App shell: tabs, storage, sheets, and the five screens.
(function () {
  'use strict';
  const { SQ, GROUPS, GROUP_COLOR, GROUP_NAME } = Board;
  const VERSION = 'v1.9 · 2026-10-27';
  const KEY = 'monopoly:v1';
  const COLORS = ['#6ea8fe', '#f0b354', '#6ee7a8', '#f08c8c', '#c79bff', '#5fd4d4', '#f4f1ea', '#ff9f5a'];

  // ---------------------------------------------------------------- storage
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked: app still works */ } },
  };
  function defaults() {
    return {
      tab: 'play', // a first visit opens on Play (2026-10-27: it used to open on the Odds tab)
      settings: { jail: 'stay', rounds: 10, coach: true, speed: 'normal' },
      odds: { metric: 'land', sel: 24 },
      table: {
        players: [0, 1, 2].map(i => ({ name: 'Player ' + (i + 1), color: COLORS[i], cash: 1500, pos: 0, jail: 0, out: false })),
        own: Money.newOwn(), selPlayer: 0,
      },
      trade: { a: 0, b: 1, aGives: [], bGives: [], aCash: 0, bCash: 0 },
      setup: {
        seats: [{ name: 'You', kind: 'human' }, { name: 'Ada', kind: 'cpu', level: 'hard' }, { name: 'Bo', kind: 'cpu', level: 'medium' }, { name: 'Cy', kind: 'cpu', level: 'easy' }],
        rules: { auction: true, freeParking: false, doubleGo: false, shortGame: false, roundLimit: 0, oldTaxes: false },
      },
      game: null,
    };
  }
  let S = defaults();
  (function load() {
    const d = store.get();
    if (!d || typeof d !== 'object') return;
    try {
      const base = defaults();
      S = Object.assign(base, d);
      S.settings = Object.assign(base.settings, d.settings || {});
      S.odds = Object.assign(base.odds, d.odds || {});
      S.setup = Object.assign(base.setup, d.setup || {});
      S.setup.rules = Object.assign(defaults().setup.rules, (d.setup || {}).rules || {});
      if (!S.table || !Array.isArray(S.table.players) || !Array.isArray(S.table.own) || S.table.own.length !== 40) S.table = base.table;
      if (S.game && (!S.game.players || !S.game.own)) S.game = null;
    } catch (e) { S = defaults(); }
  })();
  const save = () => store.set(S);

  // ---------------------------------------------------------------- helpers
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => { const r = Math.round(n) || 0; return (r < 0 ? '−$' : '$') + Math.abs(r).toLocaleString('en-US'); };
  // blank names become "Seat N"; repeats get a number so the log and chart stay readable
  const uniqueNames = names => { const seen = {}; return names.map((n, k) => { let b = String(n || '').trim() || 'Seat ' + (k + 1); let x = b, j = 2; while (seen[x.toLowerCase()]) x = b + ' ' + j++; seen[x.toLowerCase()] = 1; return x; }); };
  const wins = nm => (nm === 'You' ? 'You win' : nm + ' wins');
  const shortMoney = n => { const r = Math.round(n) || 0; return r >= 9950 ? '$' + Math.round(r / 1000) + 'k' : r >= 1000 ? '$' + (r / 1000).toFixed(1) + 'k' : money(r); };
  const signed = n => (n > 0.5 ? '+' : '') + money(n);
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // "$1,250" -> 1250, "12.75" -> 13, "1e5" -> 100000; anything unreadable -> null (keep the old value)
  const readCash = str => { const v = Number(String(str).replace(/[$,\s]/g, '')); return str === '' ? 0 : Number.isFinite(v) ? Math.round(v) : null; };
  const help = key => `<button class="help" data-act="help" data-k="${key}" aria-label="Why?">?</button>`;
  const HELP = {
    land: 'Exact long-run odds from a Markov chain of the real rules: doubles, three doubles to jail, every Chance and Chest card. Jail is the most visited square because so many things send you there, which is why the oranges and reds just past it get landed on most.',
    jail: 'Early on, paying $50 to leave jail is better (you want to buy). Late in the game, staying in jail is safer (the board is full of houses). The choice changes the odds a little.',
    rent: 'What one opponent pays you per turn on average: chance they land there on a turn times the rent. Multiply by the number of opponents for one full round.',
    from: 'Tap any square: the board shows the chance (in %) of each square being landed on during one turn starting there, counting doubles, cards and the jail rules. Numbers can add to over 100% because doubles give extra throws.',
    payback: 'How many opponent turns until the rent repays what you paid for the lots and houses. Lower is better. With 3 opponents, divide by 3 for rounds.',
    danger: 'Expected money this player pays out on their next turn (rent to others plus taxes), counting every roll, double and card. The biggest single risk is shown underneath.',
    income: 'Expected rent this player collects in one full round (every opponent takes one turn), from what they own right now.',
    best: 'Legal next buildings (full set, building evenly, bank has the piece), ranked by how fast the extra rent pays for the house.',
    value: 'Value = cash change + change in what your lots sell back for + 10 rounds of change in income once your full sets have 3 houses each (the sweet spot). The meter compares both sides.',
    strength: 'Measured by playing thousands of full 4-player games between computer levels with seats rotated (see How strong). Hard uses the landing odds, house payback and danger ahead to decide.',
    worth: 'The printed price, raised if it finishes one of your sets (×2.2) or blocks a set for someone else (×1.6), and nudged by how often it gets landed on. Bidding above this usually loses money.',
    online: 'One person creates a room and shares the 5-letter code; friends tap Join on their own phone or laptop. Computers run in the browser of whoever made the room. If someone leaves, a computer takes the seat. Free, no sign-up.',
    interest: '(M) means mortgaged. Whoever receives a mortgaged lot pays the bank 10% of its mortgage value at once, and can lift the mortgage later for the mortgage value plus 10%.',
    coach: 'After each of your choices in a game, shows what the hard computer would have done instead, if it differs.',
  };
  function toast(msg, ms) {
    const t = $('toast'); t.innerHTML = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }

  // ---------------------------------------------------------------- sheet + back button
  let sheetOpen = false, sheetKind = '';
  function openSheet(html, kind) {
    sheetKind = kind || '';
    $('sheet').innerHTML = html; $('sheet').hidden = false; $('sheetBack').hidden = false;
    if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
  }
  function closeSheet(fromPop) {
    if (!sheetOpen) return;
    $('sheet').hidden = true; $('sheetBack').hidden = true; sheetOpen = false;
    if (!fromPop) history.back();
  }
  window.addEventListener('popstate', e => {
    if (sheetOpen) { closeSheet(true); return; }
    const t = (location.hash || '').slice(1);
    if (TABS.some(x => x.id === t) && t !== S.tab) { S.tab = t; save(); render(); }
  });

  // ---------------------------------------------------------------- tabs
  const I = {
    odds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/><rect x="10.5" y="10.5" width="9" height="9" fill="currentColor" stroke="none" opacity=".45"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
    trade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  };
  const TABS = [
    { id: 'odds', label: 'Odds' }, { id: 'table', label: 'Table' }, { id: 'play', label: 'Play', hub: true },
    { id: 'trade', label: 'Trade' }, { id: 'settings', label: 'Settings' },
  ];
  // replace an element's insides only when they changed: a finger that is mid-tap on a button
  // while the computers play must not lose its tap because the button was redrawn under it
  function setHTML(el, html) { if (el._html !== html) { el._html = html; el.innerHTML = html; } }
  function renderTabs() {
    setHTML($('tabsBottom'), TABS.map(t => `<button data-tab="${t.id}" class="${t.hub ? 'hub' : ''}" ${S.tab === t.id ? 'aria-current="page"' : ''}>${I[t.id]}<span>${t.label}</span></button>`).join(''));
    setHTML($('tabsTop'), TABS.map(t => `<button data-tab="${t.id}" ${S.tab === t.id ? 'aria-current="page"' : ''}>${t.label}</button>`).join(''));
  }
  function goTab(id) {
    if (id === S.tab) return;
    S.tab = id; save();
    history.pushState({ tab: id }, '', '#' + id);
    $('panel').scrollTop = 0;
    render();
  }

  // ---------------------------------------------------------------- layout
  // a game in progress is laid out like a real table: other players' seats, the board,
  // and your own money and deeds in front of you (phone: strip / board / your area;
  // laptop: seats left, board with your area under it, a slim side panel on the right)
  const SEATS_H = 54, MINE_H = 104, MINE_HW = 128, SEATS_W = 210, SIDE_W = 290;
  function layout(playing) {
    if (playing == null) playing = document.body.classList.contains('playing');
    const wide = innerWidth >= 900;
    const land = !wide && innerWidth > innerHeight * 1.2;
    document.body.classList.toggle('land', land);
    // a phone held sideways hides the title bar during a game (css), so the board gets that height
    const head = wide ? 56 : playing && land ? 0 : 44, tab = wide ? 0 : $('tabsBottom').offsetHeight || 58;
    let size;
    // laptop: the board takes the whole height; your area sits in the right column
    if (wide && playing) size = Math.min(innerHeight - head - 32, innerWidth - 40 - SEATS_W - SIDE_W - 36);
    else if (wide) size = Math.min(innerHeight - head - 32, innerWidth - 500 - 64);
    else if (playing && land) size = Math.min(innerHeight - head - tab - 12, innerWidth * 0.5);
    else if (playing) size = Math.min(innerWidth - 16, innerHeight - head - tab - 8 - SEATS_H - MINE_H - 16);
    else size = Math.min(innerWidth - 16, innerHeight - head - tab - 16 - 190);
    size = Math.max(playing ? 200 : 260, Math.floor(size));
    $('boardWrap').style.width = size + 'px';
    $('boardWrap').style.height = size + 'px';
    $('boardWrap').style.setProperty('--bw', size + 'px');
  }

  // ---------------------------------------------------------------- odds maths
  const stat = () => Markov.stationary(S.settings.jail);
  // a pretend state where one owner holds the whole set at `level`
  function setState(sq, level) {
    const st = { players: [{ cash: 0, pos: 0, jail: 0 }, { cash: 0, pos: 0, jail: 0 }], own: Money.newOwn() };
    const g = SQ[sq].group;
    GROUPS[g].forEach(i => { st.own[i].owner = 0; st.own[i].houses = SQ[i].type === 'prop' ? level : 0; });
    return st;
  }
  function setStats(g, level) { // whole set at a level: rent per opponent turn, total cost, payback
    const lots = GROUPS[g];
    const st = setState(lots[0], level);
    let rent = 0, cost = 0;
    lots.forEach(i => { rent += Money.rentPerTurn(st, i, S.settings.jail); cost += SQ[i].price + (SQ[i].type === 'prop' ? level * SQ[i].house * (level === 5 ? 1 : 1) : 0); });
    if (level === 5) cost = lots.reduce((s, i) => s + SQ[i].price + 5 * SQ[i].house, 0);
    const land = lots.reduce((s, i) => s + stat().land[i], 0);
    return { rent, cost, payback: rent > 0 ? cost / rent : Infinity, land };
  }
  function lotAt3(sq) { // one lot, its set built to 3 (or all railroads / both utilities)
    const s = SQ[sq];
    if (!s.group) return null;
    const st = setState(sq, 3);
    const rent = Money.rentPerTurn(st, sq, S.settings.jail);
    const cost = s.price + (s.type === 'prop' ? 3 * s.house : 0);
    return { rent, cost, payback: cost / rent };
  }

  // ---------------------------------------------------------------- board
  let BV = null;
  function boardTap(i) { (SCREENS[S.tab].tap || (() => {}))(i); }

  // ================================================================ ODDS
  const Odds = {
    board() {
      const st = stat();
      const m = S.odds.metric;
      let heat, values, heatFn = null;
      if (m === 'from') {
        // one turn from the selected square: chance of ending a throw on each square
        const L = Markov.turnFrom(S.odds.sel, { strategy: S.settings.jail });
        const mx = Math.max(...L.all);
        heat = Array.from(L.all, v => (v > 0 ? 0.15 + 0.85 * v / mx : null));
        values = Array.from(L.all, v => (v >= 0.005 ? Math.round(v * 100) + '' : ''));
        return { heat, values, heatFn: null, selected: S.odds.sel, tokens: [{ id: 'src', pos: S.odds.sel, color: '#6ea8fe', jail: false, jump: true }] };
      }
      if (m === 'land') {
        // scale over the squares you can own or must pay on, so cards/jail don't flatten the colours
        const pool = st.land.filter((v, i) => SQ[i].group || SQ[i].type === 'tax');
        const mx = Math.max(...pool), mn = Math.min(...pool);
        heat = st.land.map((v, i) => (i === 30 ? 0 : clamp((v - mn) / (mx - mn), 0, 1)));
        values = st.land.map((v, i) => (i === 30 ? '0' : (v * 100).toFixed(1)));
      } else {
        const rows = SQ.map((s, i) => lotAt3(i));
        const pb = rows.filter(Boolean).map(r => r.payback);
        const rt = rows.filter(Boolean).map(r => r.rent);
        if (m === 'rent') {
          const mx = Math.max(...rt);
          heat = rows.map(r => (r ? r.rent / mx : null));
          values = rows.map(r => (r ? '$' + Math.round(r.rent) : ''));
        } else {
          const lo = Math.min(...pb), hi = Math.max(...pb);
          heat = rows.map(r => (r ? 1 - (r.payback - lo) / (hi - lo) : null));
          heatFn = BoardView.goodBad;
          values = rows.map(r => (r ? String(Math.round(r.payback)) : ''));
        }
      }
      return { heat, values, heatFn, selected: S.odds.sel };
    },
    center() {
      const i = S.odds.sel, s = SQ[i], st = stat();
      if (S.odds.metric === 'from') {
        const L = Markov.turnFrom(i, { strategy: S.settings.jail });
        const top = Array.from(L.all, (v, k) => k).sort((a, b) => L.all[b] - L.all[a]).slice(0, 3);
        const paid = Array.from(L.all).reduce((a, b) => a + b, 0);
        return `<div class="cap">One turn from</div><div class="ctitle">${esc(s.name)}</div>
          <div class="big">${esc(SQ[top[0]].short)} ${Math.round(L.all[top[0]] * 100)}%</div>
          <div class="csub">then ${top.slice(1).map(k => esc(SQ[k].short) + ' ' + Math.round(L.all[k] * 100) + '%').join(' · ')}</div>
          <div class="csub">${paid.toFixed(2)} throws this turn on average</div>`;
      }
      const rank = st.land.map((v, k) => k).sort((a, b) => st.land[b] - st.land[a]).indexOf(i) + 1;
      const band = s.group ? `<div class="chip-band" style="background:${GROUP_COLOR[s.group]}"></div>` : '';
      let extra = '';
      const r = lotAt3(i);
      if (r) extra = `<div class="csub">${s.type === 'prop' ? 'With 3 houses' : s.type === 'rr' ? 'Owning all 4' : 'Owning both'}: ${money(r.rent)} per opponent turn</div>`;
      return `${band}<div class="ctitle">${esc(s.name)}</div>
        <div class="big">${(st.land[i] * 100).toFixed(2)}%</div>
        <div class="csub">of all landings · #${rank} of 40</div>${extra}`;
    },
    panel() {
      const m = S.odds.metric, j = S.settings.jail;
      const seg = (k, v, l) => `<button data-act="${k}" data-v="${v}" aria-pressed="${(k === 'metric' ? m : j) === v}">${l}</button>`;
      let h = `<div class="ph"><div class="seg">${seg('metric', 'land', 'Landing')}${seg('metric', 'rent', 'Rent')}${seg('metric', 'payback', 'Payback')}${seg('metric', 'from', 'From here')}</div>${help(m)}</div>
        <div class="ph"><span class="sub" style="color:var(--muted);font-size:13px">Jail:</span><div class="seg">${seg('jail', 'pay', 'Leave fast')}${seg('jail', 'stay', 'Stay in')}</div>${help('jail')}</div>`;
      // selected lot: rent ladder
      const i = S.odds.sel, s = SQ[i];
      if (s.type === 'prop') {
        const st0 = setState(i, 0), lvls = [0, 1, 2, 3, 4, 5];
        h += `<div class="sec">${esc(s.name)} ${help('payback')}</div><table class="t"><tr><th>Build</th><th>Rent</th><th>Per opp. turn</th><th>Pays back</th></tr>`;
        let best = Infinity;
        const rows = lvls.map(L => {
          const stL = setState(i, L);
          const per = Money.rentPerTurn(stL, i, S.settings.jail);
          const cost = s.price + (L === 5 ? 5 : L) * s.house;
          const pb = cost / per; best = Math.min(best, pb);
          return { L, rent: Money.rent(stL, i, 'dice', 7), per, pb };
        });
        rows.forEach(r => {
          const c = BoardView.goodBad(clamp(1 - (r.pb - best) / (best * 3), 0, 1));
          h += `<tr><td>${r.L === 0 ? 'Full set' : r.L === 5 ? 'Hotel' : r.L + (r.L === 1 ? ' house' : ' houses')}</td><td>${money(r.rent)}</td><td>${money(r.per)}</td><td style="color:${c}">${Math.round(r.pb)} turns</td></tr>`;
        });
        h += '</table>';
        void st0;
      }
      // colour sets ranked
      const sets = Object.keys(GROUPS).filter(g => g !== 'rr' && g !== 'util').map(g => ({ g, ...setStats(g, 3) }));
      sets.sort((a, b) => a.payback - b.payback);
      const lo = sets[0].payback, hi = sets[sets.length - 1].payback;
      h += `<div class="sec">Colour sets with 3 houses ${help('payback')}</div><table class="t"><tr><th>Set</th><th>Landing</th><th>Rent/turn</th><th>Cost</th><th>Pays back</th></tr>`;
      sets.forEach(x => {
        const c = BoardView.goodBad(1 - (x.payback - lo) / (hi - lo));
        h += `<tr class="tap" data-act="selsq" data-sq="${GROUPS[x.g][GROUPS[x.g].length - 1]}"><td><span class="dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${GROUP_COLOR[x.g]};margin-right:6px"></span>${GROUP_NAME[x.g]}</td><td>${pct(x.land)}</td><td>${money(x.rent)}</td><td>${money(x.cost)}</td><td style="color:${c};font-weight:700">${Math.round(x.payback)}</td></tr>`;
      });
      // railroads + utilities in the same table so their columns line up with the colour sets
      const rr = setStats('rr', 0), ut = setStats('util', 0), sep = ' style="border-top:2px solid var(--line)"';
      h += `<tr><td${sep}>Railroads (all 4)</td><td${sep}>${pct(rr.land)}</td><td${sep}>${money(rr.rent)}</td><td${sep}>${money(rr.cost)}</td><td${sep}>${Math.round(rr.payback)}</td></tr><tr><td>Utilities (both)</td><td>${pct(ut.land)}</td><td>${money(ut.rent)}</td><td>${money(ut.cost)}</td><td>${Math.round(ut.payback)}</td></tr></table>`;
      const st = stat();
      h += `<p class="csub" style="margin:10px 2px">A turn has ${st.throwsPerTurn.toFixed(3)} throws on average (doubles throw again). ${pct(st.jailShare)} of throws are made from inside jail.</p>`;
      return h;
    },
    tap(i) { S.odds.sel = i; save(); render(); },
    act(a, d) {
      if (a === 'metric') { S.odds.metric = d.v; save(); render(); }
      if (a === 'jail') { S.settings.jail = d.v; save(); render(); }
      if (a === 'selsq') { S.odds.sel = +d.sq; save(); render(); }
    },
  };

  // ================================================================ TABLE (real-table companion)
  const T = () => S.table;
  const tableState = () => ({ players: T().players, own: T().own });
  const Table = {
    board() {
      const st = tableState();
      const values = SQ.map((s, i) => {
        const o = st.own[i];
        if (!s.group || o.owner < 0 || o.mort) return '';
        return '$' + Math.round(Money.rentPerTurn(st, i, S.settings.jail));
      });
      return {
        values, own: st.own, colors: T().players.map(p => p.color), selected: T().selSq,
        tokens: T().players.map((p, k) => ({ id: 't' + k, pos: p.pos, color: p.color, jail: p.jail > 0, turn: k === T().selPlayer })),
      };
    },
    center() {
      const ps = T().players, k = clamp(T().selPlayer || 0, 0, ps.length - 1), p = ps[k];
      if (!p) return '<div class="csub">Add players in the list below.</div>';
      const st = tableState();
      const d = Money.danger(st, k, S.settings.jail);
      const inc = Money.incomePerRound(st, k, S.settings.jail);
      const top = d.parts.slice(0, 2).map(x => `${esc(SQ[x.sq].short)} ${money(x.maxRent)} (${pct(x.chance, 0)})`).join(' · ');
      return `<div class="cap"><span style="color:${p.color}">●</span> ${esc(p.name)} · ${esc(SQ[p.pos].name)}${p.jail ? ' (in jail)' : ''}</div>
        <div class="cap" style="margin-top:6px">Danger next turn ${help('danger')}</div>
        <div class="big" style="color:${BoardView.goodBad(1 - clamp(d.total / 250, 0, 1))}">${money(d.total)}</div>
        <div class="csub">${top || 'Nothing to pay nearby'}</div>
        <div class="csub" style="margin-top:6px">Income ${money(inc)} / round ${help('income')}</div>`;
    },
    panel() {
      const ps = T().players, st = tableState();
      let h = `<div class="ph"><h2>Players</h2><span class="grow"></span><button class="btn small" data-act="addp" ${ps.length >= 8 ? 'disabled' : ''}>+ Player</button></div><div class="list">`;
      ps.forEach((p, k) => {
        const d = Money.danger(st, k, S.settings.jail).total, inc = Money.incomePerRound(st, k, S.settings.jail);
        h += `<div class="rowi tap" data-act="psel" data-k="${k}" style="${k === T().selPlayer ? 'box-shadow:0 0 0 1px ' + p.color : ''}"><span class="dot" style="background:${p.color}"></span>
          <span class="name">${esc(p.name)}<br><span class="sub">${esc(SQ[p.pos].short)}${p.jail ? ' · jail' : ''} · ${money(p.cash)}</span></span>
          <span class="v">${money(inc)}<small>income/round</small></span><span class="v" style="color:${BoardView.goodBad(1 - clamp(d / 250, 0, 1))}">${money(d)}<small>danger</small></span>
          <button class="btn small ghost" data-act="pedit" data-k="${k}" aria-label="Edit">Edit</button></div>`;
      });
      h += '</div>';
      const k = T().selPlayer || 0;
      if (ps[k]) {
        const opts = Money.houseOptions(st, k, S.settings.jail).slice(0, 5);
        h += `<div class="sec">Best next house for ${esc(ps[k].name)} ${help('best')}</div>`;
        if (!opts.length) h += '<div class="empty">No full colour set to build on yet. Tap a lot on the board to set its owner.</div>';
        else {
          const lo = opts[0].payback;
          h += '<div class="list">' + opts.map(o => `<div class="rowi"><span class="band" style="background:${GROUP_COLOR[SQ[o.sq].group]}"></span><span class="name">${esc(SQ[o.sq].name)}<br><span class="sub">${o.next === 5 ? 'hotel' : 'house ' + o.next} · ${money(o.cost)}${o.afford ? '' : ' · short of cash'}</span></span><span class="v">${signed(o.gain)}<small>per round</small></span><span class="v" style="color:${BoardView.goodBad(clamp(1 - (o.payback - lo) / (lo * 2), 0, 1))}">${Math.round(o.payback)}<small>rounds back</small></span></div>`).join('') + '</div>';
        }
      }
      const bank = Money.housesInUse(st);
      h += `<p class="csub" style="margin:12px 2px">Bank has ${bank.housesLeft} houses and ${bank.hotelsLeft} hotels left. Tap a square to set owner, houses or move a token.</p>`;
      return h;
    },
    tap(i) {
      T().selSq = i; save(); render();
      Table.squareSheet(i);
    },
    squareSheet(i) {
      const s = SQ[i], o = T().own[i], ps = T().players;
      let h = `<h3>${s.group ? `<span class="dot" style="width:14px;height:14px;border-radius:4px;background:${GROUP_COLOR[s.group]}"></span>` : ''}${esc(s.name)}</h3>`;
      if (s.group) {
        const st = tableState();
        h += `<div class="csub">${s.price ? 'Price ' + money(s.price) : ''}${o.owner >= 0 && !o.mort ? ` · rent now ${s.type === 'util' ? (Money.countOwned(st, o.owner, 'util') === 2 ? '10' : '4') + '× dice' : money(Money.rent(st, i, 'dice', 7))} · ${money(Money.rentPerTurn(st, i, S.settings.jail))} per opponent turn` : ''}</div>`;
        h += `<div class="sec">Owner</div><div class="chips"><button class="chip" data-act="own" data-sq="${i}" data-k="-1" aria-pressed="${o.owner < 0}">Bank</button>${ps.map((p, k) => `<button class="chip" data-act="own" data-sq="${i}" data-k="${k}" aria-pressed="${o.owner === k}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div>`;
        if (s.type === 'prop' && o.owner >= 0) {
          h += `<div class="sec">Buildings</div><div class="seg">${[0, 1, 2, 3, 4, 5].map(n => `<button data-act="houses" data-sq="${i}" data-n="${n}" aria-pressed="${o.houses === n}">${n === 5 ? 'Hotel' : n}</button>`).join('')}</div>`;
        }
        if (o.owner >= 0) h += `<div class="line" style="margin-top:8px"><span class="lbl">Mortgaged</span><label class="switch"><input type="checkbox" data-act="mort" data-sq="${i}" ${o.mort ? 'checked' : ''}><span></span></label></div>`;
      }
      h += `<div class="sec">Move a token here</div><div class="chips">${ps.map((p, k) => `<button class="chip" data-act="moveto" data-sq="${i}" data-k="${k}" aria-pressed="${p.pos === i}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div>`;
      h += '<div class="acts"><button class="btn primary" data-act="close">Done</button></div>';
      openSheet(h);
    },
    playerSheet(k) {
      const p = T().players[k];
      const h = `<h3><span class="dot" style="width:14px;height:14px;border-radius:50%;background:${p.color}"></span>Player</h3>
        <div class="line"><span class="lbl">Name</span><input class="num" style="width:160px;text-align:left" data-act="pname" data-k="${k}" value="${esc(p.name)}" maxlength="16"></div>
        <div class="line"><span class="lbl">Cash</span><input class="num" inputmode="numeric" data-act="pcash" data-k="${k}" value="${p.cash}"></div>
        <div class="chips">${[-200, -100, -50, 50, 100, 200].map(v => `<button class="chip" data-act="padd" data-k="${k}" data-v="${v}">${v > 0 ? '+' : '−'}$${Math.abs(v)}</button>`).join('')}</div>
        <div class="sec">Rolled (moves the token)</div>
        <div class="chips">${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => `<button class="chip" data-act="proll" data-k="${k}" data-n="${n}">${n}</button>`).join('')}</div>
        <div class="line" style="margin-top:8px"><span class="lbl">In jail</span><label class="switch"><input type="checkbox" data-act="pjail" data-k="${k}" ${p.jail ? 'checked' : ''}><span></span></label></div>
        <div class="sec">Colour</div><div class="chips">${COLORS.map(c => `<button class="chip" data-act="pcolor" data-k="${k}" data-c="${c}" aria-pressed="${p.color === c}" aria-label="colour"><span class="dot" style="background:${c}"></span></button>`).join('')}</div>
        <div class="acts"><button class="btn danger" data-act="pdel" data-k="${k}" ${T().players.length <= 2 ? 'disabled' : ''}>Remove</button><button class="btn primary" data-act="close">Done</button></div>`;
      openSheet(h);
    },
    act(a, d, e) {
      const ps = T().players;
      const k = d.k != null ? +d.k : null;
      switch (a) {
        case 'addp': {
          const used = new Set(ps.map(p => p.color));
          ps.push({ name: 'Player ' + (ps.length + 1), color: COLORS.find(c => !used.has(c)) || COLORS[0], cash: 1500, pos: 0, jail: 0, out: false });
          break;
        }
        case 'psel': T().selPlayer = k; break;
        case 'pedit': e.stopPropagation(); T().selPlayer = k; save(); render(); Table.playerSheet(k); return;
        case 'own': T().own[+d.sq].owner = k; if (k < 0) { T().own[+d.sq].houses = 0; T().own[+d.sq].mort = false; } save(); render(); Table.squareSheet(+d.sq); return;
        case 'houses': T().own[+d.sq].houses = +d.n; if (+d.n) T().own[+d.sq].mort = false; save(); render(); Table.squareSheet(+d.sq); return;
        case 'mort': T().own[+d.sq].mort = e.target.checked; if (e.target.checked) T().own[+d.sq].houses = 0; save(); render(); Table.squareSheet(+d.sq); return;
        case 'moveto': ps[k].pos = +d.sq; ps[k].jail = 0; T().selPlayer = k; save(); render(); Table.squareSheet(+d.sq); return;
        case 'padd': ps[k].cash = Math.max(0, ps[k].cash + +d.v); save(); render(); Table.playerSheet(k); return;
        case 'proll': {
          const n = +d.n, p = ps[k];
          if (p.jail) p.jail = 0;
          const to = (p.pos + n) % 40;
          if (to < p.pos) p.cash += 200; // passed Go
          if (to === 30) { p.pos = 10; p.jail = 1; } else p.pos = to;
          save(); render(); closeSheet();
          toast(`${esc(p.name)} → ${esc(SQ[p.pos].name)}${to < (p.pos === 10 && p.jail ? 99 : to) ? '' : ''}`);
          return;
        }
        case 'pjail': ps[k].jail = e.target.checked ? 1 : 0; if (e.target.checked) ps[k].pos = 10; save(); render(); return;
        case 'pcolor': ps[k].color = d.c; save(); render(); Table.playerSheet(k); return;
        case 'pdel': {
          ps.splice(k, 1);
          T().own.forEach(o => { if (o.owner === k) { o.owner = -1; o.houses = 0; o.mort = false; } else if (o.owner > k) o.owner--; });
          T().selPlayer = 0; S.trade = defaults().trade;
          save(); closeSheet(); render(); return;
        }
      }
      save(); render();
    },
    input(a, d, e) {
      const k = +d.k, p = T().players[k];
      if (a === 'pname') { p.name = e.target.value.slice(0, 16) || 'Player'; save(); renderLight(); }
      if (a === 'pcash') { const v = readCash(e.target.value); if (v == null) return; p.cash = clamp(v, 0, 1e6); save(); renderLight(); }
    },
  };

  // ================================================================ TRADE (evaluator)
  function tradeView(src, t, opts) {
    // src: { players, own }, t: { a, b, aGives, bGives, aCash, bCash }
    const ps = src.players;
    if (!ps[t.a] || !ps[t.b] || t.a === t.b) return '<div class="empty">Pick two different players.</div>';
    const ev = Money.evaluateTrade(src, { a: t.a, b: t.b, aGives: t.aGives, bGives: t.bGives, aCash: t.aCash, bCash: t.bCash }, { rounds: S.settings.rounds, strategy: S.settings.jail });
    const col = (p, x) => `<div style="flex:1;min-width:0"><div class="cap" style="color:${p.color}">${esc(p.name)}</div>
      <table class="t"><tr><td>Income now</td><td>${signed(x.incomeAfter - x.incomeBefore)}</td></tr>
      <tr><td>Income built</td><td>${signed(x.potAfter - x.potBefore)}</td></tr>
      <tr><td>Cash</td><td>${signed(x.cash)}</td></tr>
      <tr><td>Sell-off value</td><td>${signed(x.liquid)}</td></tr>
      <tr><td><b>Value</b></td><td style="color:${x.value >= 0 ? 'var(--good)' : 'var(--bad)'};font-weight:800">${signed(x.value)}</td></tr></table></div>`;
    const pos = clamp(50 + ev.fair * 50, 2, 98);
    const diff = Math.abs(ev.a.value - ev.b.value);
    const hi = ev.a.value > ev.b.value ? ev.a : ev.b, lo = hi === ev.a ? ev.b : ev.a;
    const verdict = diff < 100 ? 'Fair trade' : `Better for ${esc(ps[hi === ev.a ? t.a : t.b].name)} <span class="csub">(${signed(hi.value)} vs ${signed(lo.value)})</span>`;
    return `<div class="sec">Result ${help('value')}</div>
      <div class="ctitle" style="margin:2px 2px 0">${verdict}</div>
      <div class="meter"><div class="needle" style="left:calc(${100 - pos}% - 2px)"></div></div>
      <div class="meter-l"><span>${esc(wins(ps[t.a].name))}</span><span>fair</span><span>${esc(wins(ps[t.b].name))}</span></div>
      <div style="display:flex;gap:12px;margin-top:8px">${col(ps[t.a], ev.a)}${col(ps[t.b], ev.b)}</div>`;
  }
  function tradeBuilder(src, t, prefix) {
    const ps = src.players;
    const chooser = (key) => `<div class="chips">${ps.map((p, k) => p.out ? '' : `<button class="chip" data-act="${prefix}who" data-side="${key}" data-k="${k}" aria-pressed="${t[key] === k}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</button>`).join('')}</div>`;
    const lots = (who, key) => {
      const mine = src.own.map((o, i) => i).filter(i => src.own[i].owner === who);
      if (!mine.length) return '<div class="csub">Owns no lots.</div>';
      return `<div class="chips">${mine.map(i => { const ok = Money.tradable(src, i); return `<button class="chip" data-act="${prefix}lot" data-side="${key}" data-sq="${i}" aria-pressed="${t[key].includes(i)}" ${ok ? '' : 'disabled title="Sell the buildings in this set first"'}><span class="dot" style="border-radius:3px;background:${GROUP_COLOR[SQ[i].group]}"></span>${esc(SQ[i].short)}${src.own[i].mort ? ' (M)' : ''}</button>`; }).join('')}</div>`;
    };
    const lockA = prefix === 'g';
    return `${lockA ? '' : `<div class="sec">Side A</div>${chooser('a')}`}
      <div class="sec">${esc(ps[t.a] ? ps[t.a].name : '')} gives</div>${lots(t.a, 'aGives')}
      <div class="line"><span class="lbl">Cash from ${esc(ps[t.a] ? ps[t.a].name : '')}</span><input class="num" inputmode="numeric" data-act="${prefix}cash" data-side="aCash" value="${t.aCash || 0}"></div>
      <div class="sec">${lockA ? 'Trade with' : 'Side B'}</div>${chooser('b')}
      <div class="sec">${esc(ps[t.b] ? ps[t.b].name : '')} gives</div>${ps[t.b] ? lots(t.b, 'bGives') : ''}
      <div class="line"><span class="lbl">Cash from ${esc(ps[t.b] ? ps[t.b].name : '')}</span><input class="num" inputmode="numeric" data-act="${prefix}cash" data-side="bCash" value="${t.bCash || 0}"></div>`;
  }
  function tradeEdit(src, t, a, d, e) {
    if (a.endsWith('who')) {
      const k = +d.k, side = d.side;
      if (side === 'a' && k === t.b) t.b = t.a;
      if (side === 'b' && k === t.a) t.a = t.b;
      t[side] = k; t.aGives = []; t.bGives = []; t.aCash = 0; t.bCash = 0;
    } else if (a.endsWith('lot')) {
      const arr = t[d.side], sq = +d.sq, at = arr.indexOf(sq);
      if (at >= 0) arr.splice(at, 1); else arr.push(sq);
    } else if (a.endsWith('cash')) {
      const v = readCash(e.target.value);
      if (v == null) return;
      const who = d.side === 'aCash' ? t.a : t.b;
      t[d.side] = clamp(v, 0, src.players[who] ? src.players[who].cash : 0);
    }
  }
  const Trade = {
    t() {
      const t = S.trade, n = T().players.length;
      if (!(t.a < n)) t.a = 0;
      if (!(t.b < n) || t.b === t.a) t.b = t.a === 0 ? 1 : 0;
      t.aGives = t.aGives.filter(i => T().own[i].owner === t.a);
      t.bGives = t.bGives.filter(i => T().own[i].owner === t.b);
      return t;
    },
    board() {
      const t = Trade.t(), ps = T().players;
      const heat = SQ.map((s, i) => (t.aGives.includes(i) || t.bGives.includes(i) ? 1 : null));
      const values = SQ.map((s, i) => (t.aGives.includes(i) ? '→' : t.bGives.includes(i) ? '←' : ''));
      return { heat, values, heatFn: () => '#3a3220', own: T().own, colors: ps.map(p => p.color) };
    },
    center() {
      const t = Trade.t(), ps = T().players, src = tableState();
      if (!ps[t.a] || !ps[t.b]) return '';
      const ev = Money.evaluateTrade(src, { a: t.a, b: t.b, aGives: t.aGives, bGives: t.bGives, aCash: t.aCash, bCash: t.bCash }, { rounds: S.settings.rounds, strategy: S.settings.jail });
      const diff = ev.a.value - ev.b.value;
      const empty = !t.aGives.length && !t.bGives.length && !t.aCash && !t.bCash;
      if (empty) return `<div class="ctitle">Trade check</div><div class="csub">Pick what each side gives below.</div>`;
      const pos = clamp(50 + ev.fair * 50, 2, 98);
      return `<div class="cap">${Math.abs(diff) < 100 ? 'Fair trade' : 'Better for'}</div>
        <div class="big" style="font-size:clamp(22px,7vw,40px)">${Math.abs(diff) < 100 ? '≈' : esc(ps[diff > 0 ? t.a : t.b].name)}</div>
        <div class="csub">${Math.abs(diff) < 100 ? 'within $100' : 'by ' + money(Math.abs(diff))}</div>
        <div class="meter" style="width:80%"><div class="needle" style="left:calc(${100 - pos}% - 2px)"></div></div>`;
    },
    panel() {
      const t = Trade.t();
      return `<div class="ph"><h2>Trade check</h2><span class="grow"></span><span class="csub">uses the Table tab</span></div>` + tradeBuilder(tableState(), t, 't') + tradeView(tableState(), t);
    },
    tap() {},
    act(a, d, e) { if (a === 'tclear') { S.trade.aGives = []; S.trade.bGives = []; } else tradeEdit(tableState(), S.trade, a, d, e); save(); render(); },
    input(a, d, e) { tradeEdit(tableState(), S.trade, a, d, e); save(); renderLight(true); },
  };

  // ================================================================ PLAY
  let G = null; // engine state (S.game)
  let gen = 0, timer = null, lastDiceKey = null; // null until the first draw: a reload never tumbles the dice
  const humanSeat = st => {
    const a = Engine.actor(st);
    if (NETS) return a >= 0 && a === NETS.mySeat ? a : -1;
    return a >= 0 && st.players[a].kind === 'human' ? a : -1;
  };
  // ---------------------------------------------------------------- online room (shared online.js)
  let NET = null, NETS = null, netMod = null, netBusy = false, netResuming = false;
  const NET_FLAG = 'monopoly:online';
  function netLoad() {
    if (netMod) return Promise.resolve(netMod);
    return import(new URL('js/online.js', location.href).href).then(m => (netMod = m));
  }
  function netAttach(m) {
    if (NET) return NET;
    NET = m.createOnline({ game: MonoGame, gameId: 'monopoly', botDelayMs: 900 });
    NET.on('change', snap => {
      const st = snap && snap.status;
      if (st === 'closed' || st === 'left') { netDrop(st === 'closed' ? 'The room was closed.' : ''); return; }
      if (st === 'lobby' || st === 'playing' || st === 'finished') NETS = snap;
      else if (st !== 'joining') NETS = null;
      if (NETS && NETS.pub) track(NETS.pub, 'net:' + NETS.code);
      render();
    });
    NET.on('error', msg => toast(esc(msg), 5000));
    return NET;
  }
  function netDrop(msg) {
    NET = null; NETS = null; S.hist = null;
    try { localStorage.removeItem(NET_FLAG); } catch (e) { /* ignore */ }
    if (msg) toast(esc(msg));
    render();
  }
  async function netRun(fn) {
    if (netBusy) return;
    netBusy = true; render();
    try {
      const m = await netLoad();
      netAttach(m);
      const r = await fn(NET);
      if (r && r.ok === false) toast(esc(r.message || 'That did not work.'), 5000);
      else { try { localStorage.setItem(NET_FLAG, '1'); } catch (e) { /* ignore */ } }
      return r;
    } catch (e) { toast('Online play could not load. Check the connection.', 5000); }
    finally { netBusy = false; render(); }
  }
  const delay = () => ({ fast: 140, normal: 520, slow: 1000 }[S.settings.speed] || 520);
  function setGame(st) {
    if (st) st.seq = ((G && G.startId === st.startId && G.seq) || 0) + 1; // move counter: lets a second tab tell newer from older
    G = st; S.game = st;
    if (!st) S.hist = null; else track(st, st.startId);
    save();
  }
  // net worth once per round, for the after-game chart
  function track(st, id) {
    {
      if (!S.hist || S.hist.id !== id) S.hist = { id, rows: [] };
      const rows = S.hist.rows;
      if (!rows.length || rows[rows.length - 1].r !== st.round || st.phase === 'over') {
        const w = st.players.map((p, k) => (p.out ? 0 : Math.round(Money.netWorth(st, k))));
        if (rows.length && rows[rows.length - 1].r === st.round) rows[rows.length - 1].w = w; else rows.push({ r: st.round, w });
      }
    }
  }
  // simple line chart of net worth by round (one line per player, labelled at the end)
  function worthChart(hist, st) {
    if (!hist || hist.rows.length < 2) return '';
    const rows = hist.rows, W = 400, H = 170, L = 44, R = 84, T = 10, B = 22;
    const maxW = Math.max(100, ...rows.map(x => Math.max(...x.w)));
    const r0 = rows[0].r, r1 = rows[rows.length - 1].r || 1;
    const X = r => L + (W - L - R) * (r - r0) / Math.max(1, r1 - r0), Y = v => T + (H - T - B) * (1 - v / maxW);
    let g = `<line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" stroke="#2a3042"/>`;
    [0.5, 1].forEach(f => { g += `<line x1="${L}" y1="${Y(maxW * f)}" x2="${W - R}" y2="${Y(maxW * f)}" stroke="#2a3042" stroke-dasharray="3 4"/><text x="${L - 6}" y="${Y(maxW * f) + 4}" text-anchor="end" font-size="11" fill="#969db4">${money(maxW * f)}</text>`; });
    g += `<text x="${L}" y="${H - 4}" font-size="11" fill="#969db4">round ${r0}</text><text x="${W - R}" y="${H - 4}" font-size="11" fill="#969db4" text-anchor="end">${r1}</text>`;
    const ends = [];
    st.players.forEach((p, k) => {
      const pts = rows.map(x => `${X(x.r).toFixed(1)},${Y(x.w[k] || 0).toFixed(1)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" stroke="${COLORS[k]}" stroke-width="2" stroke-linejoin="round"/>`;
      ends.push({ k, y: Y(rows[rows.length - 1].w[k] || 0) });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    // keep the labels inside the chart: push the bottom ones back up
    const floor = H - B + 4;
    for (let i = ends.length - 1; i >= 0; i--) {
      const lim = i === ends.length - 1 ? floor : ends[i + 1].y - 13;
      if (ends[i].y > lim) ends[i].y = lim;
    }
    ends.forEach(e => { g += `<text x="${W - R + 6}" y="${e.y + 4}" font-size="12" fill="#e8eaf0">${esc(st.players[e.k].name.length > 10 ? st.players[e.k].name.slice(0, 9) + '…' : st.players[e.k].name)}</text>`; });
    return `<div class="sec">Net worth by round</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Net worth by round">${g}</svg>`;
  }
  // log lines read "You pays"; fix the verb when a seat is named You
  const IRREG = { is: 'are', has: 'have', goes: 'go', does: 'do' };
  const say = l => String(l).replace(/(^|[.;] |, )You (\w+)/g, (m, pre, v) => pre + 'You ' + (IRREG[v] || (/(ss|sh|ch|x)es$/.test(v) ? v.slice(0, -2) : /[^s]s$/.test(v) ? v.slice(0, -1) : v)));
  function doAction(action, fromHuman) {
    if (!G) return;
    let before = null;
    if (fromHuman && S.settings.coach && ['buy', 'decline', 'bid', 'pass', 'payJail', 'useCard', 'accept', 'reject'].includes(action.type)) {
      try { before = AI.hint(G, action.seat); } catch (e) { before = null; }
    }
    if (NETS) {
      // online: the host's engine is the referee; check here first for a quick message
      try { Engine.apply(G, action); } catch (e) { fxError(); toast(esc(e.message)); return; }
      const a = Object.assign({}, action); delete a.seat;
      NET.act(a).then(r => { if (r && r.ok === false) toast(esc(r.message)); });
    } else {
      try { setGame(Engine.apply(G, action)); }
      catch (e) { fxError(); toast(esc(e.message)); return; }
    }
    if (before && before.action && before.action.type !== action.type) {
      const what = { buy: 'buy it', decline: 'not buy it', bid: 'keep bidding', pass: 'pass', payJail: 'pay to leave jail', useCard: 'use the jail card', roll: 'roll for doubles', accept: 'accept', reject: 'turn it down' }[before.action.type] || before.action.type;
      toast(`Hard computer would ${what}. ${esc(before.why)}`, 4200);
    }
    render();
    pump();
  }
  function pump() {
    clearTimeout(timer);
    // only the tab you are looking at plays the computers (a hidden or second tab just follows)
    if (NETS || !G || G.phase === 'over' || S.tab !== 'play' || document.hidden) return;
    const a = Engine.actor(G);
    if (a < 0 || G.players[a].kind !== 'cpu') return;
    const my = ++gen;
    timer = setTimeout(() => {
      if (my !== gen || !G) return;
      const me = Engine.actor(G);
      if (me < 0 || G.players[me].kind !== 'cpu') return;
      let ch;
      try { ch = AI.choose(G, me); setGame(Engine.apply(G, ch.action)); }
      catch (e) { console.warn('computer move failed', e); return; }
      render();
      pump();
    }, delay() * (G.phase === 'roll' ? 1.2 : 1));
  }
  // real white dice, thrown into the middle of the board: each lands at its own small angle
  function dieHTML(n, anim, seed, k) {
    const on = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n] || [];
    const j = window.TABLE ? TABLE.jitter(seed || 'd', k || 0, { rot: 16, off: 3 }) : { x: 0, y: 0, r: 0 };
    return `<div class="tbl-die mdie${anim ? ' roll' : ''}" style="--jr:${j.r}deg;--jx:${j.x}px;--jy:${j.y}px" aria-label="Die showing ${n}">${on.map(c => `<i style="grid-area:${Math.ceil(c / 3)}/${(c - 1) % 3 + 1}"></i>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- table pieces: money, deeds, jail cards
  // paper money sorted by note, like the piles in front of a real player
  const BILLS = [[500, '#f3a35c'], [100, '#eadcbc'], [50, '#93bdea'], [20, '#a6d79c'], [10, '#f3e27c'], [5, '#f2bccb'], [1, '#f8f6ef']];
  function billsHTML(cash, max, only) {
    let a = Math.max(0, Math.floor(cash)), h = '', stacks = 0;
    for (const [v, c] of BILLS) {
      const n = Math.floor(a / v);
      if (!n) continue;
      a -= n * v;
      if (only && stacks >= only) continue;
      stacks++;
      const k = Math.min(n, max || 4);
      h += `<span class="bstack" style="--n:${k}" title="${n} × $${v}">${Array.from({ length: k }, (_, i) => `<span class="bill" style="--bc:${c};--i:${i}"><b>${v}</b></span>`).join('')}</span>`;
    }
    return `<span class="bills">${h}</span>`;
  }
  const GORDER = ['brown', 'lblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'rr', 'util'];
  // a title deed: colour band at the top, the rent ladder underneath; mortgaged ones lie face down
  function deedHTML(i, mort, cls) {
    const s = SQ[i];
    if (mort) return `<span class="deed back ${cls || ''}" title="${esc(s.name)} (mortgaged)"><i>M</i></span>`;
    const head = s.type === 'prop' ? GROUP_COLOR[s.group] : '#f4f1ea';
    return `<span class="deed ${s.type} ${cls || ''}" style="--dc:${head}" title="${esc(s.name)}"><em>${esc(s.short)}</em><u></u><u></u><u></u></span>`;
  }
  function deedsHTML(st, k) {
    const lots = st.own.map((o, i) => i).filter(i => st.own[i].owner === k);
    return GORDER.map(g => lots.filter(i => SQ[i].group === g)).filter(x => x.length)
      .map(gr => `<span class="dset">${gr.map(i => deedHTML(i, st.own[i].mort)).join('')}</span>`).join('');
  }
  const jailCards = p => (p.cards || []).map(d => `<span class="jcard ${d === 'chance' ? 'chance' : 'chest'}" title="Get Out of Jail Free"></span>`).join('');
  // deed card width so a whole holding fits the space in front of a player
  function deedWidth(st, k, avail, maxW, minW) {
    const lots = st.own.filter(o => o.owner === k).length;
    const sets = GORDER.filter(g => st.own.some((o, i) => o.owner === k && SQ[i].group === g)).length;
    if (!lots) return maxW;
    const units = sets + (lots - sets) * 0.34 + (sets - 1) * 0.12;
    return Math.max(minW, Math.min(maxW, Math.floor(avail / units)));
  }
  const Play = {
    board() {
      if (!G) return { own: Money.newOwn(), colors: [] , tokens: [] };
      return {
        own: G.own, colors: G.players.map((p, k) => COLORS[k]),
        selected: G.phase === 'buy' ? G.pendingBuy : G.phase === 'auction' ? G.auction.sq : null,
        tokens: G.players.map((p, k) => ({ id: 'g' + k, pos: p.pos, color: COLORS[k], jail: p.jail > 0, turn: k === G.turn, out: p.out })),
      };
    },
    center() {
      if (netResuming && !NETS) return `<div class="ctitle">Reconnecting…</div><div class="csub">Getting your online room back.</div>`;
      if (NETS && !G) return `<div class="cap">Online room</div><div class="big" style="letter-spacing:.12em">${esc(NETS.code || '')}</div><div class="csub">${NETS.isHost ? 'Friends open this site, tap Play, and join with this code.' : 'Waiting for the host to start.'}</div>`;
      if (!G) return `<div class="ctitle">New game</div><div class="csub" style="margin-bottom:8px">Set the seats and rules below.</div><div class="row"><button class="btn warm" data-act="start">Start game</button></div>`;
      const st = G, me = humanSeat(st), a = Engine.actor(st);
      const who = a >= 0 ? st.players[a] : null;
      const dk = st.dice ? st.dice.join('') + ':' + st.turns + ':' + st.log.length : '';
      // no tumble on a reload or when coming back to the tab: only a throw seen live
      const anim = st.dice && dk !== lastDiceKey && lastDiceKey !== null && /rolls/.test(st.log[st.log.length - 1] || '');
      lastDiceKey = dk;
      let h = '';
      if (st.phase === 'over') {
        if (st.tie && st.tie.length > 1) return `<div class="cap">Game over · tie</div><div class="ctitle">${st.tie.map(k => `<span style="color:${COLORS[k]}">${esc(st.players[k].name)}</span>`).join(' &amp; ')}</div><div class="csub">level on worth after ${st.round} round${st.round === 1 ? "" : "s"}</div><div class="row" style="margin-top:8px"><button class="btn warm" data-act="${NETS ? 'netleave' : 'newgame'}">${NETS ? 'Leave room' : 'New game'}</button></div>`;
        return `<div class="cap">Game over</div><div class="big" style="color:${COLORS[st.winner]}">${esc(st.players[st.winner].name)}</div><div class="csub">${st.players[st.winner].name === 'You' ? 'win' : 'wins'} after ${st.round} round${st.round === 1 ? "" : "s"}</div><div class="row" style="margin-top:8px"><button class="btn warm" data-act="${NETS ? 'netleave' : 'newgame'}">${NETS ? 'Leave room' : 'New game'}</button></div>`;
      }
      h += `<div class="cap turn"><span style="color:${COLORS[a]}">●</span> ${esc(who.name)}${who.kind === 'cpu' ? ' (computer)' : ''}</div>`;
      if (st.dice) h += `<div class="dice">${dieHTML(st.dice[0], anim, dk, 0)}${dieHTML(st.dice[1], anim, dk, 1)}</div>`;
      const cardUp = st.lastCard && st.lastCard.n === st.turns;
      // the last log line, unless it only repeats the card lying face up
      const lastLine = () => { const l = st.log[st.log.length - 1] || ''; return cardUp && / draws: /.test(l) ? '' : `<div class="csub">${esc(say(l))}</div>`; };
      if (cardUp) h += `<div class="cardnote ${st.lastCard.deck}" data-ck="${st.lastCard.deck}:${st.lastCard.n}:${st.lastCard.idx}"><b>${st.lastCard.deck === 'chance' ? 'Chance' : 'Community Chest'}</b>${esc(st.lastCard.text)}</div>`;
      if (me < 0) { h += lastLine(); return h; }
      const p = st.players[me];
      const btn = (act, label, cls, extra) => `<button class="btn ${cls || ''}" data-act="${act}" ${extra || ''}>${label}</button>`;
      if (st.phase === 'roll') {
        h += `<div class="csub">${p.jail ? `In jail (try ${p.jailTries + 1} of ${st.rules.shortGame ? 1 : 3})` : st.doubles ? 'Doubles! Roll again.' : 'Your turn.'}</div><div class="row">${btn('g:roll', 'Roll', 'warm')}${p.jail && p.cash >= 50 ? btn('g:payJail', 'Pay $50') : ''}${p.jail && p.cards.length ? btn('g:useCard', 'Use card') : ''}</div>`;
      } else if (st.phase === 'buy') {
        const s = SQ[st.pendingBuy];
        h += `<div class="ctitle">${esc(s.name)}</div><div class="csub">${money(s.price)} · you have ${money(p.cash)}</div><div class="csub">Worth about ${money(AI.lotValue(st, me, st.pendingBuy))} to you ${help('worth')}</div><div class="row">${btn('g:buy', 'Buy ' + money(s.price), 'warm', p.cash < s.price ? 'disabled' : '')}${btn('g:decline', st.rules.auction ? 'Auction' : 'Skip')}</div>`;
      } else if (st.phase === 'auction') {
        const au = st.auction, s = SQ[au.sq];
        h += `<div class="ctitle">Auction: ${esc(s.name)}</div><div class="csub">High bid ${au.bidder >= 0 ? money(au.high) + ' by ' + esc(st.players[au.bidder].name) : 'none yet'} · you have ${money(p.cash)}</div><div class="csub">Worth about ${money(AI.lotValue(st, me, au.sq))} to you ${help('worth')}</div>
          <div class="row">${[10, 50, 100].map(x => btn('g:bid', '+$' + x, x === 10 ? 'warm' : '', `data-v="${au.high + x}" ${au.high + x > p.cash ? 'disabled' : ''}`)).join('')}${btn('g:pass', 'Pass')}</div>`;
      } else if (st.phase === 'debt') {
        const d = st.debts[0];
        h += `<div class="ctitle">You owe ${money(d.amount)}</div><div class="csub">to ${d.to >= 0 ? esc(st.players[d.to].name) : 'the bank'} · cash ${money(p.cash)}</div><div class="row">${btn('g:payDebt', 'Pay', 'warm', p.cash < d.amount ? 'disabled' : '')}${btn('manage', 'Raise cash')}${btn('gtrade', 'Trade')}${btn('g:bankrupt', 'Give up', 'danger', Engine.canGiveUp(st, me) ? '' : 'disabled title="Mortgage or sell first"')}</div>${Engine.canGiveUp(st, me) ? '' : '<div class="csub">Mortgage or sell to cover it; giving up comes only when nothing is left.</div>'}`;
      } else if (st.phase === 'trade') {
        h += `<div class="ctitle">${esc(st.players[st.trade.from].name)} offers a trade</div><div class="row">${btn('seeoffer', 'See offer', 'warm')}</div>`;
      } else if (st.phase === 'end') {
        h += `${lastLine()}<div class="row">${btn('g:end', 'End turn', 'primary')}${btn('manage', 'Build')}</div>`;
      }
      return h;
    },
    panel() {
      if (netResuming && !NETS) return '<div class="empty">Reconnecting to your room…</div>';
      if (NETS && !G) return Play.lobbyPanel();
      if (!G) return Play.setupPanel();
      return Play.sidePanel();
    },
    // the slim side panel (laptop) / Log sheet (phone): round, everyone's worth, the log, the chart
    sidePanel() {
      const st = G;
      let h = `<div class="ph"><h2>Round ${st.round}${st.rules.roundLimit ? ' of ' + st.rules.roundLimit : ''}</h2></div><div class="list">`;
      st.players.forEach((p, k) => {
        const lots = st.own.filter(o => o.owner === k).length;
        h += `<div class="rowi tap prow${k === st.turn ? ' turn' : ''}" data-act="pinfo" data-k="${k}" style="--pc:${COLORS[k]};${p.out ? 'opacity:.4' : ''}"><span class="dot" style="background:${COLORS[k]}"></span><span class="name">${esc(p.name)}<br><span class="sub">${p.out ? 'bankrupt' : (NETS ? ((NETS.seats[k] || {}).kind === 'computer' ? 'computer' : k === NETS.mySeat ? 'you' : ((NETS.seats[k] || {}).online ? 'online' : 'offline')) : p.kind === 'cpu' ? p.level : 'you') + ' · ' + lots + (lots === 1 ? ' lot' : ' lots') + (p.jail ? ' · jail' : '') + (p.cards.length ? ' · jail card' : '')}</span></span><span class="v"><span class="cash">${money(p.cash)}</span><small>worth ${money(Money.netWorth(st, k))}</small></span></div>`;
      });
      if (st.phase === 'over') h += '</div>' + worthChart(S.hist, st) + '<div>';
      h += `</div>${st.rules.freeParking ? `<p class="csub" style="margin:8px 2px">Free Parking pot: ${money(st.pot)}</p>` : ''}<div class="sec">Log</div><div class="log">${st.log.slice(-8).map(l => `<div>${esc(say(l))}</div>`).join('')}</div>
        <div class="row" style="margin-top:12px;display:flex;gap:8px">${NETS ? `<span class="csub" style="align-self:center">Room ${esc(NETS.code)}${NETS.hostAway ? ' · host away' : ''}</span><button class="btn small ghost" data-act="netleave">Leave room</button>` : '<button class="btn small ghost" data-act="newgame">New game</button>'}</div>`;
      return h;
    },
    // whose things lie at the bottom edge: your seat (online), the person whose turn it is
    // (pass-and-play), else the first person seat; -1 = only computers are playing
    me() {
      const st = G;
      if (NETS) return NETS.mySeat >= 0 ? NETS.mySeat : -1;
      const h = humanSeat(st);
      if (h >= 0) return (Play.lastMe = h);
      if (Play.lastMe >= 0 && st.players[Play.lastMe] && st.players[Play.lastMe].kind === 'human') return Play.lastMe;
      return st.players.findIndex(p => p.kind === 'human');
    },
    lastMe: -1,
    logSheet: () => Play.sidePanel() + '<div class="acts"><button class="btn primary" data-act="close">Close</button></div>',
    seatSub(st, k) {
      const p = st.players[k];
      if (p.out) return 'bankrupt';
      const who = NETS ? ((NETS.seats[k] || {}).kind === 'computer' ? 'computer' : ((NETS.seats[k] || {}).online ? 'online' : 'offline')) : p.kind === 'cpu' ? p.level : 'person';
      return who + (p.jail ? ' · jail' : '');
    },
    // the other players round the table, in turn order after you
    seats() {
      const st = G, me = Play.me(), n = st.players.length;
      const order = [];
      for (let j = 1; j <= n; j++) { const k = ((me < 0 ? -1 : me) + j + n) % n; if (k !== me) order.push(k); }
      const wide = innerWidth >= 900, land = document.body.classList.contains('land');
      const avail = wide ? SEATS_W - 20 : land ? innerWidth * 0.22 - 20 : Math.max(60, (innerWidth - 16) / order.length - 50);
      // a crowded strip (5+ opponents on a phone): no bill piles, short amounts ($1.5k), so nothing runs into the next seat
      const crowd = !wide && !land && order.length >= 5;
      $('seats').classList.toggle('many', order.length >= 5);
      const cash = (p, k) => (crowd ? `<b class="short" title="${money(p.cash)}">${shortMoney(p.cash)}</b>` : billsHTML(p.cash, wide ? 3 : 2, wide ? 4 : innerWidth < 380 ? 1 : 2) + `<b data-cash="${k}">${money(p.cash)}</b>`);
      return order.map(k => {
        const p = st.players[k];
        const dw = deedWidth(st, k, avail, wide ? 26 : 16, wide ? 12 : 9);
        return `<div class="seat${k === st.turn && st.phase !== 'over' ? ' turn' : ''}${p.out ? ' out' : ''}" data-act="pinfo" data-k="${k}" style="--pc:${COLORS[k]};--dw:${dw}px" role="button" aria-label="${esc(p.name)}">
          <div class="plate"><span class="pdot"></span><span class="pn">${esc(p.name)}</span><span class="ps">${Play.seatSub(st, k)}</span></div>
          <div class="sarea"><span class="sdeeds">${deedsHTML(st, k)}${jailCards(p)}</span><span class="scash">${cash(p, k)}</span></div>
          ${wide ? `<div class="sworth">worth ${money(Money.netWorth(st, k))}</div>` : ''}</div>`;
      }).join('');
    },
    // your own money and deeds, laid out in front of you, with your buttons
    mine() {
      const st = G, me = Play.me(), act = humanSeat(st) >= 0 && (st.phase === 'roll' || st.phase === 'end' || st.phase === 'debt');
      const wide = innerWidth >= 900, land = document.body.classList.contains('land');
      const btns = `${humanSeat(st) >= 0 && st.phase !== 'over' ? '<button class="btn small" data-act="hint">Hint</button>' : ''}<button class="btn small" data-act="manage" ${act ? '' : 'disabled'}>Manage</button><button class="btn small" data-act="gtrade" ${act ? '' : 'disabled'}>Trade</button>${wide ? '' : '<button class="btn small" data-act="logsheet">Log</button>'}`;
      if (me < 0) return `<div class="mbar"><span class="csub">Computers only</span><span class="grow"></span>${btns}</div>`;
      const p = st.players[me];
      const avail = wide ? SIDE_W - 24 : land ? innerWidth * 0.3 - 20 : innerWidth - 16 - 150;
      const dw = deedWidth(st, me, avail, wide ? 44 : 36, 16);
      return `<div class="mrow"style="--pc:${COLORS[me]};--dw:${dw}px">
          <div class="mdeeds" data-act="pinfo" data-k="${me}" role="button" aria-label="Your deeds">${deedsHTML(st, me) || '<span class="tbl-spot dspot"></span>'}${jailCards(p)}</div>
          <div class="mcash">${billsHTML(p.cash, 4)}<b data-cash="${me}">${money(p.cash)}</b></div>
        </div>
        <div class="mbar"><span class="plate${me === st.turn && st.phase !== 'over' ? ' turn' : ''}" style="--pc:${COLORS[me]}"><span class="pdot"></span>${esc(p.name)}${p.jail ? ' · jail' : ''}</span><span class="grow"></span>${btns}</div>`;
    },
    lobbyPanel() {
      const n = NETS;
      let h = `<div class="ph"><h2>Room ${esc(n.code)}</h2></div><div class="list">`;
      n.seats.forEach((s, k) => {
        const label = s.kind === 'empty' ? 'Open seat' : esc(s.name || 'Player') + (k === n.mySeat ? ' (you)' : '');
        const sub = s.kind === 'computer' ? 'computer · ' + ((n.options.levels || [])[k] || 'medium') : s.kind === 'empty' ? 'a friend can join here' : (s.online ? 'online' : 'offline') + (s.isHost ? ' · host' : '');
        h += `<div class="rowi"><span class="dot" style="background:${COLORS[k]}"></span><span class="name">${label}<br><span class="sub">${sub}</span></span>${n.isHost && k !== n.mySeat ? `<div class="seg" style="margin-left:auto">${['empty', 'computer'].map(x => `<button data-act="netseat" data-k="${k}" data-v="${x}" aria-pressed="${s.kind === x}">${x === 'empty' ? 'Friend' : 'Computer'}</button>`).join('')}</div>` : ''}</div>`;
      });
      h += `</div><p class="csub" style="margin:8px 2px">Open seats become computers when the game starts. ${help('online')}</p>
        <div class="row" style="display:flex;gap:8px;margin-top:10px">${n.isHost ? `<button class="btn warm" style="flex:1" data-act="netstart" ${netBusy ? 'disabled' : ''}>Start game</button>` : ''}<button class="btn ghost" data-act="netleave">${n.isHost ? 'Close room' : 'Leave'}</button></div>`;
      return h;
    },
    setupPanel() {
      const su = S.setup, r = su.rules;
      const sw = (k, label, hk) => `<div class="line"><span class="lbl">${label}${hk ? help(hk) : ''}</span><label class="switch"><input type="checkbox" data-act="rule" data-k="${k}" ${r[k] ? 'checked' : ''}><span></span></label></div>`;
      let h = `<div class="ph"><h2>Seats</h2><span class="grow"></span><button class="btn small" data-act="addseat" ${su.seats.length >= 8 ? 'disabled' : ''}>+ Seat</button></div><div class="list">`;
      su.seats.forEach((s, k) => {
        h += `<div class="rowi"><span class="dot" style="background:${COLORS[k]}"></span><input class="num" style="width:96px;text-align:left" data-act="sname" data-k="${k}" value="${esc(s.name)}" maxlength="12" aria-label="Name">
          <div class="seg" style="margin-left:auto">${['human', 'cpu'].map(x => `<button data-act="skind" data-k="${k}" data-v="${x}" aria-pressed="${s.kind === x}">${x === 'human' ? 'Person' : 'Computer'}</button>`).join('')}</div>
          ${su.seats.length > 2 ? `<button class="btn small ghost" data-act="delseat" data-k="${k}" aria-label="Remove">×</button>` : ''}</div>`;
        if (s.kind === 'cpu') h += `<div style="display:flex;justify-content:flex-end;align-items:center;gap:4px;padding:2px 0 6px"><div class="seg">${['easy', 'medium', 'hard'].map(x => `<button data-act="slevel" data-k="${k}" data-v="${x}" aria-pressed="${s.level === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>${help('strength')}</div>`;
      });
      h += `</div>
        <div class="sec">Online ${help('online')}</div>
        <div class="line"><span class="lbl">Other Person seats open for friends</span><button class="btn small" data-act="netcreate" ${netBusy ? 'disabled' : ''}>Create room</button></div>
        <div class="line"><input class="num" style="width:110px;text-align:left;text-transform:uppercase" data-act="netcode" value="${esc(S.netCode || '')}" maxlength="5" placeholder="Code" aria-label="Room code" autocapitalize="characters" autocomplete="off"><span style="flex:1"></span><button class="btn small" data-act="netjoin" ${netBusy ? 'disabled' : ''}>Join</button></div>
        <div class="sec">Rules</div>
        ${sw('auction', 'Auctions')}
        ${sw('shortGame', 'Short game')}
        <div class="line"><span class="lbl">Time limit</span><div class="seg">${[0, 20, 40].map(n => `<button data-act="rlimit" data-v="${n}" aria-pressed="${r.roundLimit === n}">${n ? n + ' rounds' : 'Off'}</button>`).join('')}</div></div>
        <div class="sec">House rules</div>
        ${sw('freeParking', 'Free Parking pot')}
        ${sw('doubleGo', '$400 on Go')}
        ${sw('oldTaxes', 'Pre-2008 taxes')}
        <div class="row" style="display:flex;margin-top:14px"><button class="btn warm" style="flex:1" data-act="start">Start game</button></div>`;
      return h;
    },
    tap(i) {
      if (!G) return;
      const s = SQ[i], o = G.own[i];
      if (!s.group) return;
      const st = G;
      openSheet(`<h3><span class="dot" style="width:14px;height:14px;border-radius:4px;background:${GROUP_COLOR[s.group]}"></span>${esc(s.name)}</h3>
        <div class="csub">Price ${money(s.price)} · ${o.owner >= 0 ? 'owned by ' + esc(st.players[o.owner].name) : 'for sale'}${o.mort ? ' · mortgaged' : ''}</div>
        <div class="csub">Landing ${pct(Markov.stationary(S.settings.jail).land[i], 2)} · now ${o.owner >= 0 && !o.mort ? money(Money.rentPerTurn(st, i, S.settings.jail)) + ' per opponent turn' : 'no rent'}</div>
        ${s.type === 'prop' ? `<table class="t" style="margin-top:8px"><tr><th>Build</th><th>Rent</th></tr>${s.rent.map((r, L) => `<tr><td>${L === 0 ? 'None (×2 with set)' : L === 5 ? 'Hotel' : L}</td><td>${money(r)}</td></tr>`).join('')}<tr><td>House cost</td><td>${money(s.house)}</td></tr></table>` : ''}
        <div class="acts"><button class="btn primary" data-act="close">Close</button></div>`);
    },
    manageSheet() {
      const st = G, me = humanSeat(st);
      if (me < 0) return;
      const leg = Engine.legal(st, me);
      const mine = st.own.map((o, i) => i).filter(i => st.own[i].owner === me);
      let h = `<h3>Manage · ${money(st.players[me].cash)}</h3>`;
      if (!mine.length) h += '<div class="empty">You own no lots yet.</div>';
      const opts = Money.houseOptions(st, me, S.settings.jail);
      mine.forEach(i => {
        const o = st.own[i], can = t => leg.some(a => a.type === t && a.sq === i);
        const ho = opts.find(x => x.sq === i);
        h += `<div class="line"><span class="band" style="width:6px;align-self:stretch;border-radius:3px;background:${GROUP_COLOR[SQ[i].group]}"></span><span class="lbl">${esc(SQ[i].name)}<br><span class="csub">${o.mort ? 'mortgaged' : o.houses === 5 ? 'hotel' : o.houses ? o.houses + ' houses' : ''}${ho ? ` · next pays back in ${Math.round(ho.payback)} rounds` : ''}</span></span>
          ${can('build') ? `<button class="btn small" data-act="g:build" data-sq="${i}">+${money(SQ[i].house)}</button>` : ''}
          ${can('sell') ? `<button class="btn small" data-act="g:sell" data-sq="${i}">Sell</button>` : ''}
          ${can('mortgage') ? `<button class="btn small" data-act="g:mortgage" data-sq="${i}">Mortgage</button>` : ''}
          ${can('unmortgage') ? `<button class="btn small" data-act="g:unmortgage" data-sq="${i}">Unmortgage ${money(Engine.unmortgageCost(i))}</button>` : ''}</div>`;
      });
      h += '<div class="acts"><button class="btn primary" data-act="close">Done</button></div>';
      openSheet(h);
    },
    gt: null,
    tradeSheet() {
      const st = G, me = humanSeat(st);
      if (me < 0) return;
      if (!Play.gt || Play.gt.a !== me) Play.gt = { a: me, b: st.players.findIndex((p, k) => k !== me && !p.out), aGives: [], bGives: [], aCash: 0, bCash: 0 };
      const t = Play.gt;
      openSheet(`<h3>Offer a trade</h3>${tradeBuilder(st, t, 'g')}${tradeView(st, t)}
        <div class="acts"><button class="btn ghost" data-act="close">Cancel</button><button class="btn warm" data-act="gpropose" ${Engine.offersLeft(st, me) <= 0 ? 'disabled' : ''}>Offer</button></div>`);
    },
    offerSheet() {
      const st = G, tr = st.trade;
      if (!tr) return;
      const t = { a: tr.to, b: tr.from, aGives: tr.get, bGives: tr.give, aCash: tr.getCash, bCash: tr.giveCash };
      const list = (sqs, cash, cards) => sqs.map(i => esc(SQ[i].name) + (st.own[i].mort ? ' (M)' : '')).concat(cash ? [money(cash)] : []).concat(cards ? [cards + ' jail card'] : []).join(', ') || 'nothing';
      openSheet(`<h3>${esc(st.players[tr.from].name)} offers</h3>
        <div class="line"><span class="lbl">You get</span><b>${list(tr.give, tr.giveCash, tr.giveCards)}</b></div>
        <div class="line"><span class="lbl">You give</span><b>${list(tr.get, tr.getCash, tr.getCards)}</b></div>
        ${(() => { const due = tr.give.filter(i => st.own[i].mort).reduce((a, i) => a + Math.ceil(SQ[i].price / 20), 0); return due ? `<div class="line"><span class="lbl">Interest you pay now ${help('interest')}</span><b>${money(due)}</b></div>` : ''; })()}
        ${tradeView(st, t)}
        <div class="acts"><button class="btn" data-act="g:reject">Turn down</button><button class="btn warm" data-act="g:accept">Accept</button></div>`);
    },
    act(a, d, e) {
      const su = S.setup;
      if (a.startsWith('g:')) {
        const type = a.slice(2), me = humanSeat(G);
        const extra = {};
        if (d.sq != null) extra.sq = +d.sq;
        if (type === 'bid') extra.amount = +d.v;
        const isManage = ['build', 'sell', 'mortgage', 'unmortgage'].includes(type);
        const seat = isManage ? me : Engine.actor(G);
        if (seat < 0 || G.players[seat].kind !== 'human') return;
        if (['accept', 'reject'].includes(type)) closeSheet();
        doAction(Object.assign({ type, seat }, extra), true);
        if (isManage) Play.manageSheet();
        return;
      }
      switch (a) {
        case 'start': {
          const r = su.rules;
          const rules = { auction: r.auction, freeParking: r.freeParking, doubleGo: r.doubleGo, shortGame: r.shortGame, roundLimit: r.roundLimit, incomeTax10: r.oldTaxes, luxuryTax: r.oldTaxes ? 75 : 100 };
          gen++; clearTimeout(timer); lastDiceKey = '';
          const nm = uniqueNames(su.seats.map(s => s.name));
          const ng = Engine.newGame(su.seats.map((s, k) => ({ name: nm[k], kind: s.kind, level: s.level || 'medium' })), rules);
          ng.startId = Date.now();
          setGame(ng);
          render(); pump(); return;
        }
        case 'newgame': {
          // a game in progress needs a second tap (0.4 to 3 s later), so a stray tap can't throw it away
          if (G && G.phase !== 'over') {
            const dt = Date.now() - (Play.armed || 0);
            if (!(Play.armed && dt > 400 && dt < 3000)) { if (!Play.armed || dt >= 3000) { Play.armed = Date.now(); toast('Tap New game again to end this game.'); } return; }
          }
          Play.armed = 0;
        }
        // falls through
        case 'newgameNow': closeSheet(); gen++; clearTimeout(timer); setGame(null); render(); return;
        case 'netcreate': {
          const mine = su.seats.findIndex(x => x.kind === 'human');
          const name = (su.seats[mine >= 0 ? mine : 0].name || 'Player').slice(0, 12);
          const r = su.rules;
          const rules = { auction: r.auction, freeParking: r.freeParking, doubleGo: r.doubleGo, shortGame: r.shortGame, roundLimit: r.roundLimit, incomeTax10: r.oldTaxes, luxuryTax: r.oldTaxes ? 75 : 100 };
          const seats = su.seats.map(x => (x.kind === 'human' ? 'human' : { kind: 'computer', name: x.name || 'Computer' }));
          if (mine < 0) seats[0] = 'human';
          netRun(N => N.createRoom({ name, seats, options: { rules, levels: su.seats.map(x => x.level || 'medium') } }));
          return;
        }
        case 'netjoin': {
          const code = String(S.netCode || '').trim().toUpperCase();
          if (code.length !== 5) { toast('Type the 5-letter room code.'); return; }
          const mine = su.seats.find(x => x.kind === 'human');
          netRun(N => N.joinRoom(code, ((mine && mine.name) || 'Player').slice(0, 12)));
          return;
        }
        case 'netseat': if (NET) netRun(N => N.setSeat(+d.k, d.v)); return;
        case 'netstart': if (NET) netRun(N => N.start()); return;
        case 'netleave': {
          closeSheet();
          if (!NET) return;
          const N = NET;
          const p = NETS && NETS.isHost && NETS.status !== 'playing' ? N.close() : N.leave();
          Promise.resolve(p).catch(() => null).then(() => netDrop(''));
          return;
        }
        case 'addseat': su.seats.push({ name: 'Seat ' + (su.seats.length + 1), kind: 'cpu', level: 'medium' }); break;
        case 'delseat': su.seats.splice(+d.k, 1); break;
        case 'skind': su.seats[+d.k].kind = d.v; if (d.v === 'cpu' && !su.seats[+d.k].level) su.seats[+d.k].level = 'medium'; break;
        case 'slevel': su.seats[+d.k].level = d.v; break;
        case 'rule': su.rules[d.k] = e.target.checked; break;
        case 'rlimit': su.rules.roundLimit = +d.v; break;
        case 'manage': Play.manageSheet(); return;
        case 'logsheet': openSheet(Play.logSheet(), 'log'); return;
        case 'gtrade': Play.tradeSheet(); return;
        case 'seeoffer': Play.offerSheet(); return;
        case 'hint': {
          const me = humanSeat(G); if (me < 0) return;
          const h = AI.hint(G, me);
          const act = h.action;
          const name = { roll: 'Roll', end: 'End the turn', buy: 'Buy', decline: 'Let it go to auction', bid: `Bid ${money(act.amount || 0)}`, pass: 'Pass', payJail: 'Pay $50', useCard: 'Use your jail card', build: 'Build', propose: 'Offer a trade', payDebt: 'Pay', bankrupt: 'Give up', mortgage: 'Mortgage', sell: 'Sell a building', accept: 'Accept', reject: 'Turn it down', unmortgage: 'Unmortgage' }[act.type] || act.type;
          const why = String(h.why || '');
          toast(why.toLowerCase().startsWith(name.toLowerCase()) ? esc(why) : `<b>${name}.</b> ${esc(why)}`, 5000); return;
        }
        case 'pinfo': {
          const k = +d.k, p = G.players[k];
          const lots = G.own.map((o, i) => i).filter(i => G.own[i].owner === k);
          openSheet(`<h3><span class="dot" style="width:14px;height:14px;border-radius:50%;background:${COLORS[k]}"></span>${esc(p.name)}</h3>
            <div class="csub">${money(p.cash)} cash · worth ${money(Money.netWorth(G, k))} · income ${money(Money.incomePerRound(G, k, S.settings.jail))}/round · danger next turn ${money(Money.danger(G, k, S.settings.jail).total)}</div>
            <div class="chips" style="margin-top:10px">${lots.map(i => `<span class="chip"><span class="dot" style="border-radius:3px;background:${GROUP_COLOR[SQ[i].group]}"></span>${esc(SQ[i].short)}${G.own[i].houses ? ' ' + (G.own[i].houses === 5 ? 'H' : G.own[i].houses + 'h') : ''}${G.own[i].mort ? ' (M)' : ''}</span>`).join('') || '<span class="csub">No lots.</span>'}</div>
            <div class="acts"><button class="btn primary" data-act="close">Close</button></div>`);
          return;
        }
        case 'gpropose': {
          const t = Play.gt, me = humanSeat(G);
          closeSheet();
          doAction({ type: 'propose', seat: me, trade: { to: t.b, give: t.aGives, get: t.bGives, giveCash: t.aCash, getCash: t.bCash } }, true);
          Play.gt = null;
          return;
        }
        default:
          if (a.startsWith('g') && Play.gt) { tradeEdit(G, Play.gt, a, d, e); Play.tradeSheet(); return; }
      }
      save(); render();
    },
    input(a, d, e) {
      if (a === 'sname') { S.setup.seats[+d.k].name = e.target.value.slice(0, 12); save(); return; }
      if (a === 'netcode') { S.netCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); save(); return; }
      if (a === 'gcash' && Play.gt) { tradeEdit(G, Play.gt, a, d, e); const s = $('sheet'); const keep = s.scrollTop; const tv = s.querySelector('.sec:last-of-type'); void tv; Play.refreshTradeResult(); s.scrollTop = keep; }
    },
    refreshTradeResult() {
      // update only the result block so the focused input keeps the keyboard
      const s = $('sheet'), at = s.querySelector('[data-res]');
      if (at) at.innerHTML = tradeView(G, Play.gt);
    },
  };
  // the trade sheet's result block is wrapped so typing doesn't redraw the input
  const _ts = Play.tradeSheet;
  Play.tradeSheet = function () {
    _ts();
    const s = $('sheet'), secs = s.querySelectorAll('.sec');
    const resultSec = Array.from(secs).find(x => /Result/.test(x.textContent));
    if (resultSec) {
      const wrap = document.createElement('div'); wrap.setAttribute('data-res', '1');
      let n = resultSec; const nodes = [];
      while (n && !(n.classList && n.classList.contains('acts'))) { nodes.push(n); n = n.nextSibling; }
      resultSec.parentNode.insertBefore(wrap, resultSec);
      nodes.forEach(x => wrap.appendChild(x));
    }
  };

  // ================================================================ SETTINGS
  const Settings = {
    board() { return { heat: null, values: null }; },
    center() { return `<div class="ctitle">Settings</div><div class="csub">${VERSION}</div>`; },
    panel() {
      const s = S.settings;
      const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${k}" data-v="${v}" aria-pressed="${String(s[k]) === String(v)}">${l}</button>`).join('')}</div>`;
      return `<div class="sec">Odds</div>
        <div class="line"><span class="lbl">Jail${help('jail')}</span>${seg('jail', [['pay', 'Leave fast'], ['stay', 'Stay in']])}</div>
        <div class="sec">Trade check</div>
        <div class="line"><span class="lbl">Rounds counted${help('value')}</span>${seg('rounds', [[5, '5'], [10, '10'], [20, '20']])}</div>
        <div class="sec">Play</div>
        <div class="line"><span class="lbl">Computer speed</span>${seg('speed', [['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']])}</div>
        <div class="line"><span class="lbl">Coach${help('coach')}</span><label class="switch"><input type="checkbox" data-act="coach" ${s.coach ? 'checked' : ''}><span></span></label></div>
        <div class="sec">Sound &amp; effects</div>
        <div id="fxSet"></div>
        <div class="sec">How strong are the computers?</div>
        <div id="strength">${STRENGTH}</div>
        <div class="sec">Table data</div>
        <div class="line"><span class="lbl">Clear owners, houses and cash</span><button class="btn small danger" data-act="resettable">Reset</button></div>
        <p class="csub" style="margin:14px 2px">Rules: 2008+ US edition. Sources and checks: <a href="https://github.com/TimothyHadfield/monopoly/blob/main/docs/rules-check.md" target="_blank" rel="noopener">rules-check</a>. Fan-made study tool; not affiliated with the game's publisher. ${VERSION}</p>`;
    },
    act(a, d, e) {
      if (a === 'set') { S.settings[d.k] = d.k === 'rounds' ? +d.v : d.v; }
      if (a === 'coach') S.settings.coach = e.target.checked;
      if (a === 'resettable') {
        // a second tap between 0.4 s and 3 s confirms (a fast double-tap does not)
        const dt = Date.now() - (Settings.armed || 0);
        if (Settings.armed && dt > 400 && dt < 3000) { S.table = defaults().table; S.trade = defaults().trade; Settings.armed = 0; toast('Table cleared.'); }
        else { if (!Settings.armed || dt >= 3000) { Settings.armed = Date.now(); toast('Tap Reset again to clear the table.'); } return; }
      }
      save(); render();
    },
  };
  // measured in tools/sim.js; numbers filled in from progress.md
  const STRENGTH = `<p class="csub" style="margin:2px 2px 8px">Win rate over 1,000 computer-only games each (a fair share is 25% at a 4-seat table, 50% one-on-one).</p>
    <table class="t"><tr><th>Table</th><th>Win rate</th></tr>
    <tr><td>Hard vs Medium, 2 seats</td><td>Hard 68%</td></tr>
    <tr><td>Hard vs 3 Medium</td><td>Hard 38%</td></tr>
    <tr><td>Medium vs 3 Easy</td><td>Medium 78%</td></tr>
    <tr><td>Hard, Medium, 2 Easy</td><td>63% · 29% · 4% each</td></tr>
    <tr><td>Hard vs Easy, 2 seats</td><td>Hard 79%</td></tr></table>`;

  const SCREENS = { odds: Odds, table: Table, trade: Trade, play: Play, settings: Settings };

  // ---------------------------------------------------------------- render
  function render() {
    renderTabs();
    G = NETS ? NETS.pub : S.game;
    const sc = SCREENS[S.tab];
    const playing = S.tab === 'play' && !!G && !(netResuming && !NETS);
    if (playing !== document.body.classList.contains('playing') || !render.laid) { document.body.classList.toggle('playing', playing); layout(playing); render.laid = true; }
    $('seats').hidden = !playing; $('mine').hidden = !playing;
    if (playing) { setHTML($('seats'), Play.seats()); setHTML($('mine'), Play.mine()); }
    BoardView.update(BV, Object.assign({ heat: null, values: null, own: null, colors: null, tokens: [] }, sc.board()));
    camera();
    drawDecks();
    const ch = sc.center();
    if (ch !== render.center) { render.center = ch; render.centerAt = Date.now(); }
    setHTML($('center'), ch);
    fitCenter();
    dealCard();
    const keep = $('panel').scrollTop;
    $('panel').innerHTML = sc.panel();
    $('panel').scrollTop = keep;
    if (S.tab === 'settings' && window.FX && $('fxSet')) FX.renderSettings($('fxSet'));
    fxStep();
    // the phone's Log sheet keeps up while computers play
    if (sheetOpen && sheetKind === 'log') { if (S.tab === 'play' && G) { const sh = $('sheet'), k = sh.scrollTop; sh.innerHTML = Play.logSheet(); sh.scrollTop = k; } else closeSheet(); }
    if (S.tab === 'play' && G && G.phase === 'trade' && humanSeat(G) >= 0 && (!sheetOpen || sheetKind === 'log')) Play.offerSheet();
  }
  // ---------------------------------------------------------------- sounds + animations (js/fx-game.js)
  // every effect comes from comparing the game before and after, so your moves, computer
  // moves and online snapshots all sound the same; a reload or a new game starts quiet
  let fxPrev = null, fxId = null;
  const fxDom = {
    token: k => (BV && BV.tokens['g' + k] ? BV.tokens['g' + k].g : null),
    square: sq => (BV && BV.sqs[sq] ? BV.sqs[sq].grp : null),
    cash: k => document.querySelector(`#seats [data-cash="${k}"], #mine [data-cash="${k}"]`),
    cashFloat: k => { const b = document.querySelector(`#seats [data-cash="${k}"], #mine [data-cash="${k}"]`); const bl = b && b.parentNode.querySelector('.bills'); return bl && bl.offsetWidth ? bl : null; },
    center: () => $('boardWrap'),
    card: () => document.querySelector('#center .cardnote'),
    turnBtn: () => document.querySelector('#center .btn.warm, #center .btn.primary'),
    color: k => COLORS[k],
  };
  const fxSpeed = () => { const f = window.FX ? FX.settings : null; return !f || !f.animations ? 0 : f.animSpeed === 'fast' ? 0.5 : 1; };
  function fxApply() {
    const f = fxSpeed();
    BoardView.speed = f;
    document.documentElement.classList.toggle('fx-noanim', f === 0);
    document.documentElement.classList.toggle('fx-fast', f === 0.5);
  }
  function fxStep() {
    const id = NETS ? 'net:' + NETS.code : (G ? G.startId || 'local' : null);
    const prev = fxPrev, same = fxId === id;
    fxPrev = G; fxId = id;
    if (!G || !prev || !same || prev === G || S.tab !== 'play' || document.hidden || !window.FX || !window.MonoFX) return;
    const mine = k => (NETS ? k === NETS.mySeat : !!(G.players[k] && G.players[k].kind === 'human'));
    try { MonoFX.run(MonoFX.events(prev, G, { mine, f: fxSpeed(), colors: COLORS }), fxDom); } catch (e) { /* effects never break the game */ }
    try { flyDeeds(prev, G); } catch (e) { /* effects never break the game */ }
  }
  function fxError() { if (window.FX) FX.play('error'); }
  // ---------------------------------------------------------------- the card decks on the board
  // Chance and Community Chest lie face down on their places in the middle; a held
  // Get Out of Jail Free card leaves its deck thinner until it is used
  function drawDecks() {
    if (!window.TABLE) return;
    const st = S.tab === 'play' && G ? G : null;
    [['chance', 'deckChance'], ['chest', 'deckChest']].forEach(([d, id]) => {
      const n = st && st.decks && st.decks[d] ? st.decks[d].length : 16, el = $(id);
      // the helper tabs keep the middle clear for their numbers; the zoomed phone board puts the decks away
      el.hidden = S.tab !== 'play' || $('boardWrap').classList.contains('zoomed');
      if (el.dataset.count === String(n) && el.firstChild) return;
      TABLE.deck(el, n, { pattern: 'plain', cls: 'mback ' + d, badge: false, perCard: 0.45, max: 8 });
    });
  }
  // the words and buttons in the middle stay off the two decks: the decks lie on the diagonal,
  // so their inner long edges run along x + y = ±0.41 board (measured from the middle);
  // when the middle holds a lot (card + dice + buttons) it shrinks just enough to stay clear
  // ---------------------------------------------------------------- phone camera
  // On a phone the whole board is ~375 px wide, so names, prices, houses and pieces are 5-8 px.
  // During a game the board is shown at about twice the size, looking at the side of the board
  // where the action is (the piece whose turn it is, or the lot being bought or auctioned); the
  // round button in the middle switches to the whole board and back (remembered on this device).
  const ZOOM_ICON = {
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    in: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>',
  };
  function miniMap(x0, y0, V) {
    let h = '<svg class="mmap" viewBox="-2 -2 104 104" aria-hidden="true"><rect x="-2" y="-2" width="104" height="104" rx="3" fill="#17201a"/><rect x="0" y="0" width="100" height="100" fill="#d3e7d3"/>';
    for (let i = 0; i < 40; i++) {
      const g = BoardView.geom(i), o = G.own[i];
      const fill = o && o.owner >= 0 ? COLORS[o.owner] : SQ[i].type === 'prop' ? '#d3e7d3' : '#c2d6c2';
      h += `<rect x="${(g.x / 10).toFixed(1)}" y="${(g.y / 10).toFixed(1)}" width="${(g.w / 10).toFixed(1)}" height="${(g.h / 10).toFixed(1)}" fill="${fill}"${o && o.mort ? ' fill-opacity=".45"' : ''} stroke="#17201a" stroke-width=".4"/>`;
    }
    // pieces: a dot in the player's colour; several on one space sit side by side
    const at = {};
    G.players.forEach((p, k) => {
      if (p.out) return;
      const key = p.pos + (p.jail ? 'j' : ''), n = (at[key] = (at[key] || 0) + 1) - 1, q = BV.sqs[p.pos];
      let x = q.cx / 10, y = q.cy / 10;
      if (p.pos === 10) { x = (q.g.x + (p.jail ? 88 : 50)) / 10; y = (q.g.y + (p.jail ? 44 : 118)) / 10; }
      x += (n % 3 - 1) * 3.2; y += Math.floor(n / 3) * 3.2 * (p.pos === 10 && !p.jail ? -1 : 1);
      h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === G.turn ? 3.4 : 2.9}" fill="${COLORS[k]}" stroke="${k === G.turn ? '#fff' : '#17201a'}" stroke-width=".8"/>`;
    });
    h += `<rect x="${(x0 / 10).toFixed(1)}" y="${(y0 / 10).toFixed(1)}" width="${(V / 10).toFixed(1)}" height="${(V / 10).toFixed(1)}" fill="none" stroke="#e0413a" stroke-width="1.6"/></svg>`;
    return h;
  }
  function camFocus() {
    if (G.phase === 'buy') return G.pendingBuy;
    if (G.phase === 'auction') return G.auction.sq;
    const p = G.players[G.turn];
    return p ? p.pos : 0;
  }
  function camera() {
    const wrap = $('boardWrap'), cam = $('cam'), box = $('cbox'), zb = $('zoomBtn');
    const bw = wrap.offsetWidth;
    const can = S.tab === 'play' && !!G && G.phase !== 'over' && bw > 0 && bw < 560;
    const on = can && S.settings.zoom !== false;
    zb.hidden = !can;
    if (can && !on && zb.dataset.k !== 'in') { zb.dataset.k = 'in'; zb.innerHTML = ZOOM_ICON.in; zb.setAttribute('aria-label', 'Zoom in'); }
    wrap.classList.toggle('zoomed', on);
    if (!on) { box.dataset.k = ''; cam.style.transform = ''; box.style.left = box.style.top = box.style.width = box.style.height = ''; return; }
    // zoom so the phone street names come out at ~12.5 px (19 board units each)
    const z = clamp(12.5 / (19 * bw / 1000), 1.6, 2.4), V = 1000 / z;
    const i = camFocus(), q = BV.sqs[i], side = BoardView.geom(i).side;
    let x0 = clamp(q.cx - V / 2, 0, 1000 - V), y0 = clamp(q.cy - V / 2, 0, 1000 - V);
    // keep the row the action is on against the edge of the view, so the free middle is one block
    if (side === 'bottom' || i === 0 || i === 10) y0 = 1000 - V;
    if (side === 'top' || i === 20 || i === 30) y0 = 0;
    if (side === 'left' || i === 10 || i === 20) x0 = 0;
    if (side === 'right' || i === 0 || i === 30) x0 = 1000 - V;
    const px = bw / 1000;
    // opening the page (or a reload) starts already zoomed; only later moves glide
    if (!camera.shown) {
      camera.shown = true;
      cam.style.transition = box.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => { cam.style.transition = box.style.transition = ''; }));
    }
    cam.style.transform = `translate(${(-x0 * z * px).toFixed(1)}px, ${(-y0 * z * px).toFixed(1)}px) scale(${z.toFixed(3)})`;
    // the dice, card and buttons go on the part of the middle that is in view
    const F0 = 136, F1 = 864;
    const l = Math.max(x0, F0), t = Math.max(y0, F0), r = Math.min(x0 + V, F1), b = Math.min(y0 + V, F1);
    // the button is a little map of the whole board: who owns what, where every piece is, and
    // the part shown big (red frame); tapping it shows the whole board
    const mm = miniMap(x0, y0, V);
    if (zb.dataset.k !== mm) { zb.dataset.k = mm; zb.innerHTML = mm; zb.setAttribute('aria-label', 'Whole board'); }
    const pc = v => (v / V * 100).toFixed(2) + '%';
    const key = [l, t, r, b].map(Math.round).join();
    if (box.dataset.k !== key) { box.dataset.k = key; clearTimeout(camera.t); camera.t = setTimeout(fitCenter, 560); }
    box.style.left = pc(l - x0); box.style.top = pc(t - y0); box.style.width = pc(Math.max(0, r - l)); box.style.height = pc(Math.max(0, b - t));
  }
  function fitCenter() {
    const c = $('center');
    c.style.transform = '';
    if (S.tab !== 'play' || !G) return;
    if ($('boardWrap').classList.contains('zoomed')) {
      // zoomed: the decks are put away; just make sure the middle's contents fit their space
      const need = c.scrollHeight, have = c.clientHeight;
      if (need > have + 1) c.style.transform = `scale(${Math.max(0.6, have / need).toFixed(3)})`;
      return;
    }
    if ($('deckChance').hidden) return;
    const wrap = $('boardWrap'), bw = wrap.offsetWidth, r0 = wrap.getBoundingClientRect();
    if (!bw) return;
    const mx = r0.left + bw / 2, my = r0.top + bw / 2, lim = 0.385 * bw - 4;
    let worst = 0;
    const take = r => { if (!r.width) return; worst = Math.max(worst, r.right - mx + r.bottom - my, mx - r.left + my - r.top); };
    c.querySelectorAll('.btn, .cardnote, .dice, .help').forEach(e => take(e.getBoundingClientRect()));
    c.querySelectorAll('.cap, .ctitle, .csub, .big').forEach(e => { const g = document.createRange(); g.selectNodeContents(e); take(g.getBoundingClientRect()); });
    if (worst > lim) c.style.transform = `scale(${Math.max(0.55, lim / worst).toFixed(3)})`;
  }
  // a drawn card flies off its deck, then turns face up in the middle of the board
  let dealt = '', dealing = '';
  function dealCard() {
    const c = document.querySelector('#center .cardnote');
    if (!c) return;
    const key = c.dataset.ck;
    if (key === dealing) { c.style.opacity = 0; return; }
    if (key === dealt) return;
    dealt = key;
    if (!window.TABLE || !TABLE.animOn() || !fxPrev) return; // reload / animations off: just show it
    const deck = $(c.classList.contains('chance') ? 'deckChance' : 'deckChest');
    if (deck.hidden) { c.classList.add('flipin'); return; } // zoomed phone board: the decks are put away, the card just turns over
    dealing = key; c.style.opacity = 0;
    TABLE.deal(deck, c, { duration: 380 }).then(() => {
      dealing = '';
      const now = document.querySelector(`#center .cardnote[data-ck="${key}"]`);
      if (now) { now.style.opacity = ''; now.classList.add('flipin'); }
    });
  }
  // a deed that changes hands slides from its square (bought) or from the old owner (traded) to the new owner
  function flyDeeds(prev, st) {
    if (!window.TABLE || !TABLE.animOn() || !prev || !prev.own || S.tab !== 'play') return;
    st.own.forEach((o, i) => {
      const was = prev.own[i] ? prev.own[i].owner : -1;
      if (o.owner < 0 || o.owner === was) return;
      const to = document.querySelector(`#mine .mdeeds[data-k="${o.owner}"], #seats .seat[data-k="${o.owner}"] .sdeeds`);
      const box = was >= 0 ? document.querySelector(`#mine .mdeeds[data-k="${was}"], #seats .seat[data-k="${was}"] .sdeeds`) : null;
      const from = was >= 0 ? (box && (box.querySelector('.deed') || box)) : BV.sqs[i].grp;
      if (!to || !from) return;
      TABLE.deal(from, to, { face: deedHTML(i, false, 'flying'), duration: 520 });
    });
  }
  // redraw everything except the panel (keeps a focused input and its keyboard)
  function renderLight(withResult) {
    const sc = SCREENS[S.tab];
    G = NETS ? NETS.pub : S.game;
    BoardView.update(BV, Object.assign({ heat: null, values: null, own: null, colors: null, tokens: [] }, sc.board()));
    setHTML($('center'), sc.center());
    if (withResult && S.tab === 'trade') {
      const p = $('panel'), r = p.querySelector('[data-res]');
      if (r) r.innerHTML = tradeView(tableState(), Trade.t());
    }
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    const tb = e.target.closest('[data-tab]');
    if (tb) { goTab(tb.dataset.tab); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') return;
    const a = el.dataset.act;
    if (a === 'help') { toast(HELP[el.dataset.k] || '', 7000); return; }
    if (a === 'close') { closeSheet(); return; }
    if (a === 'zoom') { S.settings.zoom = S.settings.zoom === false; save(); render(); return; }
    // a fast double tap must not land on the button that just replaced the one tapped
    // (Roll -> End turn, Buy -> End turn, Start -> Roll)
    if (el.closest('#center') && Date.now() - (render.centerAt || 0) < 350) return;
    const sc = SCREENS[S.tab];
    if (sc.act) sc.act(a, el.dataset, e);
  }
  function onChange(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName !== 'INPUT') return;
    const sc = SCREENS[S.tab];
    // when a cash box loses focus, show the number that was actually kept (rounded, capped)
    if (el.type !== 'checkbox' && /cash$/.test(el.dataset.act)) {
      const kept = el.dataset.act === 'pcash' ? (T().players[+el.dataset.k] || {}).cash
        : ((el.dataset.act === 'gcash' ? Play.gt : Trade.t()) || {})[el.dataset.side];
      if (kept != null) el.value = kept;
      return;
    }
    if (el.type === 'checkbox') sc.act(el.dataset.act, el.dataset, e);
  }
  function onInput(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName !== 'INPUT' || el.type === 'checkbox') return;
    const sc = SCREENS[S.tab];
    if (sc.input) sc.input(el.dataset.act, el.dataset, e);
  }
  document.addEventListener('click', e => { if (e.target.type === 'checkbox') return; onClick(e); });
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  $('sheetBack').addEventListener('click', () => closeSheet());

  // ---------------------------------------------------------------- boot
  $('ver').textContent = VERSION;
  if (window.FX) { FX.init({ game: 'monopoly', accent: '#6ea8fe' }); if (window.MonoFX) MonoFX.defineSounds(FX); FX.onChange(fxApply); }
  fxApply();
  const h0 = (location.hash || '').slice(1);
  if (TABS.some(t => t.id === h0)) S.tab = h0;
  history.replaceState({ tab: S.tab }, '', '#' + S.tab);
  layout();
  BV = BoardView.create($('board'), boardTap);
  render();
  pump();
  // back into an online room after a reload
  try {
    if (localStorage.getItem(NET_FLAG)) {
      netResuming = true; render();
      netLoad().then(m => netAttach(m).resume()).then(ok => { netResuming = false; if (!ok) netDrop(''); else render(); }).catch(() => { netResuming = false; netDrop(''); });
    }
  } catch (e) { /* storage blocked */ }
  // the same game open in two tabs: the one behind takes the newer game when the other saves
  window.addEventListener('storage', e => {
    if (e.key !== KEY || NETS || !e.newValue) return;
    let d; try { d = JSON.parse(e.newValue); } catch (x) { return; }
    const g = d && d.game, mine = S.game;
    const newer = g ? (!mine || g.startId !== mine.startId || (g.seq || 0) > (mine.seq || 0)) : !!mine;
    if (!newer) return;
    gen++; clearTimeout(timer);
    S.game = g || null; S.hist = d.hist || null; G = S.game;
    if (!g) closeSheet();
    render(); pump();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pump(); });
  // home-screen app (js/pwa.js, shared _pwa kit): a new deploy reloads by itself only when nothing would be lost
  if (window.PWA) window.PWA.safeToReload = () => {
    const ae = document.activeElement;
    if (NET || NETS || netBusy || netResuming || sheetOpen || (window.COACH && COACH.rulesOpen())) return false;
    if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return false;
    return S.tab === 'settings' || S.tab === 'odds' || !S.game || S.game.phase === 'over';
  };
  window.MonoApp = { get S() { return S; }, get G() { return G; }, Play, doAction, render, save }; // for tests / debugging
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); render(); }, 120); });
  // the trade tab's result block gets the same wrapper so typing cash doesn't redraw inputs
  const _tp = Trade.panel;
  Trade.panel = () => { const h = _tp(); return h.replace('<div class="sec">Result', '<div data-res="1"><div class="sec">Result') + '</div>'; };
  if (S.tab === 'trade') render();
  // pump computers when returning to Play
  const _goTab = goTab;
  void _goTab;
  document.addEventListener('click', e => { if (e.target.closest('[data-tab="play"]')) setTimeout(pump, 0); });
})();
