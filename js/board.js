// Standard US board (game facts only: names, prices, rents). Shared by the
// browser and the node tests.
(function (root) {
  'use strict';

  // type: go, prop, rr, util, cc, chance, tax, jail, free, gotojail
  // rent: [base, 1h, 2h, 3h, 4h, hotel]
  const SQ = [
    { name: 'Go', short: 'GO', type: 'go' },
    { name: 'Mediterranean Ave', short: 'Medit', type: 'prop', group: 'brown', price: 60, house: 50, rent: [2, 10, 30, 90, 160, 250] },
    { name: 'Community Chest', short: 'Chest', type: 'cc' },
    { name: 'Baltic Ave', short: 'Baltic', type: 'prop', group: 'brown', price: 60, house: 50, rent: [4, 20, 60, 180, 320, 450] },
    { name: 'Income Tax', short: 'Tax', type: 'tax', amount: 200 },
    { name: 'Reading Railroad', short: 'Read RR', type: 'rr', group: 'rr', price: 200 },
    { name: 'Oriental Ave', short: 'Orient', type: 'prop', group: 'lblue', price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
    { name: 'Chance', short: 'Chance', type: 'chance' },
    { name: 'Vermont Ave', short: 'Verm', type: 'prop', group: 'lblue', price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
    { name: 'Connecticut Ave', short: 'Conn', type: 'prop', group: 'lblue', price: 120, house: 50, rent: [8, 40, 100, 300, 450, 600] },
    { name: 'Jail', short: 'Jail', type: 'jail' },
    { name: 'St. Charles Place', short: 'St Ch', type: 'prop', group: 'pink', price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
    { name: 'Electric Company', short: 'Elec', type: 'util', group: 'util', price: 150 },
    { name: 'States Ave', short: 'States', type: 'prop', group: 'pink', price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
    { name: 'Virginia Ave', short: 'Virg', type: 'prop', group: 'pink', price: 160, house: 100, rent: [12, 60, 180, 500, 700, 900] },
    { name: 'Pennsylvania Railroad', short: 'Penn RR', type: 'rr', group: 'rr', price: 200 },
    { name: 'St. James Place', short: 'St Jam', type: 'prop', group: 'orange', price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
    { name: 'Community Chest', short: 'Chest', type: 'cc' },
    { name: 'Tennessee Ave', short: 'Tenn', type: 'prop', group: 'orange', price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
    { name: 'New York Ave', short: 'NY', type: 'prop', group: 'orange', price: 200, house: 100, rent: [16, 80, 220, 600, 800, 1000] },
    { name: 'Free Parking', short: 'Free', type: 'free' },
    { name: 'Kentucky Ave', short: 'Kent', type: 'prop', group: 'red', price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
    { name: 'Chance', short: 'Chance', type: 'chance' },
    { name: 'Indiana Ave', short: 'Ind', type: 'prop', group: 'red', price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
    { name: 'Illinois Ave', short: 'Ill', type: 'prop', group: 'red', price: 240, house: 150, rent: [20, 100, 300, 750, 925, 1100] },
    { name: 'B&O Railroad', short: 'B&O RR', type: 'rr', group: 'rr', price: 200 },
    { name: 'Atlantic Ave', short: 'Atl', type: 'prop', group: 'yellow', price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
    { name: 'Ventnor Ave', short: 'Vent', type: 'prop', group: 'yellow', price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
    { name: 'Water Works', short: 'Water', type: 'util', group: 'util', price: 150 },
    { name: 'Marvin Gardens', short: 'Marvin', type: 'prop', group: 'yellow', price: 280, house: 150, rent: [24, 120, 360, 850, 1025, 1200] },
    { name: 'Go To Jail', short: 'To Jail', type: 'gotojail' },
    { name: 'Pacific Ave', short: 'Pacif', type: 'prop', group: 'green', price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
    { name: 'North Carolina Ave', short: 'N Car', type: 'prop', group: 'green', price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
    { name: 'Community Chest', short: 'Chest', type: 'cc' },
    { name: 'Pennsylvania Ave', short: 'Penn', type: 'prop', group: 'green', price: 320, house: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
    { name: 'Short Line', short: 'Short RR', type: 'rr', group: 'rr', price: 200 },
    { name: 'Chance', short: 'Chance', type: 'chance' },
    { name: 'Park Place', short: 'Park', type: 'prop', group: 'blue', price: 350, house: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
    { name: 'Luxury Tax', short: 'Lux Tax', type: 'tax', amount: 100 },
    { name: 'Boardwalk', short: 'Brdwk', type: 'prop', group: 'blue', price: 400, house: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
  ];
  SQ.forEach((s, i) => { s.id = i; });

  const GROUPS = {};
  SQ.forEach(s => { if (s.group) (GROUPS[s.group] = GROUPS[s.group] || []).push(s.id); });

  const GROUP_COLOR = {
    brown: '#8b5a3c', lblue: '#9fd3f0', pink: '#d0509a', orange: '#f08a2c',
    red: '#e0413a', yellow: '#f2d43a', green: '#2fa35a', blue: '#2f5fc8',
    rr: '#6b7280', util: '#9aa3b5',
  };
  const GROUP_NAME = {
    brown: 'Brown', lblue: 'Light blue', pink: 'Pink', orange: 'Orange', red: 'Red',
    yellow: 'Yellow', green: 'Green', blue: 'Dark blue', rr: 'Railroads', util: 'Utilities',
  };

  // Cards. kind: move (to), rr (nearest railroad, double rent), util (nearest
  // utility, 10x dice), back3, jail, goojf, money (amount), each (amount from
  // each other player; negative = pay each), repairs (perHouse, perHotel).
  const CHANCE = [
    { kind: 'move', to: 39, text: 'Advance to Boardwalk' },
    { kind: 'move', to: 0, text: 'Advance to Go (collect $200)' },
    { kind: 'move', to: 24, text: 'Advance to Illinois Ave' },
    { kind: 'move', to: 11, text: 'Advance to St. Charles Place' },
    { kind: 'rr', text: 'Advance to the nearest railroad (pay double)' },
    { kind: 'rr', text: 'Advance to the nearest railroad (pay double)' },
    { kind: 'util', text: 'Advance to the nearest utility (pay 10x dice)' },
    { kind: 'money', amount: 50, text: 'Bank pays you a $50 dividend' },
    { kind: 'goojf', text: 'Get out of jail free' },
    { kind: 'back3', text: 'Go back 3 spaces' },
    { kind: 'jail', text: 'Go to jail' },
    { kind: 'repairs', perHouse: 25, perHotel: 100, text: 'Repairs: $25 per house, $100 per hotel' },
    { kind: 'money', amount: -15, text: 'Speeding fine $15' },
    { kind: 'move', to: 5, text: 'Trip to Reading Railroad' },
    { kind: 'each', amount: -50, text: 'Pay each player $50' },
    { kind: 'money', amount: 150, text: 'Building loan matures: collect $150' },
  ];
  const CHEST = [
    { kind: 'move', to: 0, text: 'Advance to Go (collect $200)' },
    { kind: 'money', amount: 200, text: 'Bank error in your favor: $200' },
    { kind: 'money', amount: -50, text: "Doctor's fee $50" },
    { kind: 'money', amount: 50, text: 'Stock sale: $50' },
    { kind: 'goojf', text: 'Get out of jail free' },
    { kind: 'jail', text: 'Go to jail' },
    { kind: 'money', amount: 100, text: 'Holiday fund matures: $100' },
    { kind: 'money', amount: 20, text: 'Income tax refund: $20' },
    { kind: 'each', amount: 10, text: 'Birthday: collect $10 from each player' },
    { kind: 'money', amount: 100, text: 'Life insurance matures: $100' },
    { kind: 'money', amount: -100, text: 'Hospital fees $100' },
    { kind: 'money', amount: -50, text: 'School fees $50' },
    { kind: 'money', amount: 25, text: 'Consultancy fee: $25' },
    { kind: 'repairs', perHouse: 40, perHotel: 115, text: 'Street repairs: $40 per house, $115 per hotel' },
    { kind: 'money', amount: 10, text: 'Beauty contest: $10' },
    { kind: 'money', amount: 100, text: 'You inherit $100' },
  ];

  const RR = [5, 15, 25, 35];
  const UTIL = [12, 28];
  function nearest(pos, list) {
    for (let k = 1; k <= 40; k++) { const p = (pos + k) % 40; if (list.includes(p)) return p; }
    return list[0];
  }

  const DICE = []; // 36 equally likely outcomes
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) DICE.push({ a, b, sum: a + b, dbl: a === b });

  const Board = { SQ, GROUPS, GROUP_COLOR, GROUP_NAME, CHANCE, CHEST, RR, UTIL, nearest, DICE, JAIL: 10, GOTOJAIL: 30 };
  if (typeof module !== 'undefined' && module.exports) module.exports = Board; else root.Board = Board;
})(this);
