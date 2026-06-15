/**
 * generate_sample.js
 * Creates a sample trading history Excel file for testing.
 * Run: node generate_sample.js
 */
const XLSX = require('xlsx');
const path = require('path');

const users = ['U1001', 'U1002', 'U1003', 'U1004', 'U1005'];
const rows  = [];

function rnd(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rnd(min, max + 1)); }

let base = new Date('2026-01-15T08:00:00');

for (let i = 0; i < 200; i++) {
  const userId   = users[randInt(0, users.length - 1)];
  const openTime = new Date(base.getTime() + i * 3600000 + randInt(0, 600) * 1000);

  // 30% chance of scalping trade (< 3 min)
  const isScalp  = Math.random() < 0.30;
  const durationSec = isScalp
    ? randInt(10, 170)         // < 3 min
    : randInt(180, 7200);      // 3 min – 2 hrs

  const closeTime = new Date(openTime.getTime() + durationSec * 1000);
  const lotSize   = parseFloat(rnd(0.01, 5.0).toFixed(2));
  const profit    = parseFloat(rnd(-500, 800).toFixed(2));
  const tradeType = Math.random() > 0.5 ? 'buy' : 'sell';

  const fmt = dt => dt.toISOString().replace('T', ' ').substring(0, 19);

  rows.push({
    login:      userId,
    open_time:  fmt(openTime),
    close_time: fmt(closeTime),
    lot_size:   lotSize,
    profit:     profit,
    trade_type: tradeType
  });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'Trades');

const outPath = path.join(__dirname, '../sample_trades.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅ Sample file created: ${outPath}`);
console.log(`   ${rows.length} trades across users: ${users.join(', ')}`);
