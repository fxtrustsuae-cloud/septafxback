/**
 * processor.js
 * Handles two trade history formats:
 *
 * FORMAT A (classic) — one row per completed trade:
 *   user_id / login | open_time | close_time | lot_size | profit | trade_type
 *
 * FORMAT B (MT5 Deals) — one row per deal event:
 *   Time | Deal | Symbol | Type | Direction | Volume | Price | Order |
 *   Commission | Fee | Swap | Profit | Balance | Comment
 *   → "Direction" = in (open) / out (close), linked by Order number
 *   → Login extracted from the preamble rows above the header
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ── Column aliases for FORMAT A ────────────────────────────────────────────
const COL_ALIASES_A = {
  user_id:    ['user_id', 'login', 'userid', 'user id', 'account', 'client_id'],
  open_time:  ['open_time', 'opentime', 'open time', 'open_date', 'entry_time', 'entrytime'],
  close_time: ['close_time', 'closetime', 'close time', 'close_date', 'exit_time', 'exittime'],
  lot_size:   ['lot_size', 'lots', 'lot', 'volume', 'size', 'quantity'],
  profit:     ['profit', 'pnl', 'p&l', 'net_profit', 'gain', 'result'],
  trade_type: ['trade_type', 'type', 'direction', 'side', 'action', 'cmd']
};

// ── Column names for FORMAT B (MT5) ───────────────────────────────────────
const MT5_COLS = {
  time:       ['time'],
  deal:       ['deal', 'ticket'],
  symbol:     ['symbol', 'item'],
  type:       ['type'],
  direction:  ['direction'],
  volume:     ['volume', 'size', 'lot', 'lots'],
  order:      ['order', 'position'],
  commission: ['commission', 'taxes'],
  fee:        ['fee'],
  swap:       ['swap'],
  profit:     ['profit'],
  comment:    ['comment']
};

// Non-trade row types to skip in MT5 format
const MT5_SKIP_TYPES = new Set(['balance', 'credit', 'deposit', 'withdrawal', 'correction', 'bonus']);

// ── Helpers ────────────────────────────────────────────────────────────────
function resolveCol(headers, aliases) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase().trim());
    if (i !== -1) return headers[i];
  }
  return null;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === 'number') {
    // Excel serial number
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S);
  }
  // Handle MT5 date format: "2026.02.24 12:26:29"
  const normalized = String(val).replace(/\./g, (m, offset, s) => {
    // Only replace dots that are date separators (first 2 dots in date part)
    const beforeDot = s.slice(0, offset);
    const dotCount = (beforeDot.match(/\./g) || []).length;
    return dotCount < 2 ? '-' : m;
  });
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(/,/g, '').replace(/\s/g, ''));
  return isNaN(n) ? 0 : n;
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── MT5 format detection ───────────────────────────────────────────────────
function isMT5Format(headers) {
  const lower = new Set(headers.map(h => h.toLowerCase().trim()));
  
  // If it has both classic Open Time and Close Time, it's definitely NOT an MT5 Deals register
  const hasOpenTime = COL_ALIASES_A.open_time.some(a => lower.has(a.toLowerCase()));
  const hasCloseTime= COL_ALIASES_A.close_time.some(a => lower.has(a.toLowerCase()));
  if (hasOpenTime && hasCloseTime) return false;

  const hasTime = lower.has('time');
  const hasId   = lower.has('order') || lower.has('position') || lower.has('deal') || lower.has('ticket');
  const hasMeta = lower.has('profit') && lower.has('symbol');
  
  return hasTime && hasId && hasMeta;
}

// ── Extract Login from preamble rows (e.g. "Login: 12345678") ─────────────
function extractLoginFromPreamble(preambleRows) {
  for (const row of preambleRows) {
    for (const cell of row) {
      const s = String(cell).trim();
      // Matches patterns like "Login: 12345" or "Account: 12345678"
      const m = s.match(/(?:login|account|client)[:\s#]+([A-Za-z0-9_\-]+)/i);
      if (m) return m[1].trim();
    }
    // Also try: a row where one cell is just a number (the account ID)
    const nums = row.filter(c => /^\d{5,12}$/.test(String(c).trim()));
    if (nums.length === 1) return String(nums[0]).trim();
  }
  return null;
}

// ── Main export ────────────────────────────────────────────────────────────
async function processTradeFile(filePath, startDate, endDate, scalpingTimeLimit = 3) {
  const ext = path.extname(filePath).toLowerCase();

  let rawRows, preambleRows;

  if (ext === '.csv') {
    ({ rows: rawRows, preamble: preambleRows } = await parseCSV(filePath));
  } else {
    ({ rows: rawRows, preamble: preambleRows } = parseExcel(filePath));
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error(`File is empty or could not be parsed. Path: ${filePath}`);
  }

  const headers = Object.keys(rawRows[0]);
  const sdTs = startDate ? new Date(startDate).getTime()              : null;
  const edTs = endDate   ? new Date(endDate + 'T23:59:59').getTime()  : null;

  let trades;

  if (isMT5Format(headers)) {
    trades = processMT5Format(rawRows, headers, preambleRows, sdTs, edTs, scalpingTimeLimit);
  } else {
    trades = processClassicFormat(rawRows, headers, sdTs, edTs, scalpingTimeLimit);
  }

  if (trades.length === 0) {
    throw new Error('No valid completed trades found after processing. Check date filters or verify the file has closed positions.');
  }

  return buildSummary(trades);
}

// ═══════════════════════════════════════════════
//  FORMAT B — MT5 Deals
// ═══════════════════════════════════════════════

// Classify a direction cell value as 'in', 'out', or null
function classifyDirection(val) {
  const v = String(val ?? '').toLowerCase().trim();
  if (!v) return null;
  if (['in', 'i', 'entry', 'buy', '0'].includes(v) || v.startsWith('in')) return 'in';
  if (['out', 'o', 'exit', 'sell', '1'].includes(v) || v.startsWith('out')) return 'out';
  return null;
}

function processMT5Format(rows, headers, preambleRows, sdTs, edTs, scalpingTimeLimit) {
  const col = {};
  for (const [key, aliases] of Object.entries(MT5_COLS)) {
    col[key] = resolveCol(headers, aliases);
  }

  const login = extractLoginFromPreamble(preambleRows || []) || 'Account';

  // ── Step 1: filter non-trade rows ────────────────────────────────────────
  const tradeRows = rows.filter(row => {
    const type  = String(row[col.type]  ?? '').toLowerCase().trim();
    const order = String(row[col.order] ?? '').trim();
    return !MT5_SKIP_TYPES.has(type) && order && order !== '0';
  });

  if (tradeRows.length === 0) {
    const sample = rows.slice(0, 3).map(r =>
      headers.map(h => `${h}=${r[h]}`).join(', ')
    ).join(' | ');
    throw new Error(
      `No trade rows found — file contains only balance/deposit entries. ` +
      `Sample data: ${sample || '(empty)'}`
    );
  }

  // ── Step 2: detect direction strategy ────────────────────────────────────
  // Check what direction values actually appear in the file
  const dirSample = tradeRows
    .slice(0, 20)
    .map(r => String(r[col.direction] ?? '').trim())
    .filter(Boolean);

  const hasExplicitDirection = dirSample.some(v => classifyDirection(v) !== null);

  // ── Step 3: group by Order ─────────────────────────────────────────────
  const orderMap = new Map();

  for (const row of tradeRows) {
    const order = String(row[col.order] ?? '').trim();
    if (!orderMap.has(order)) orderMap.set(order, []);
    orderMap.get(order).push(row);
  }

  // Sort each group by time ascending
  for (const deals of orderMap.values()) {
    deals.sort((a, b) => {
      const ta = parseDate(a[col.time]);
      const tb = parseDate(b[col.time]);
      return (ta && tb) ? ta - tb : 0;
    });
  }

  // ── Step 4: check if we can actually group by Order ───────────────────────
  let canGroupByOrder = false;
  if (hasExplicitDirection) {
    for (const deals of orderMap.values()) {
      const hasIn  = deals.some(d => classifyDirection(d[col.direction]) === 'in');
      const hasOut = deals.some(d => classifyDirection(d[col.direction]) === 'out');
      if (hasIn && hasOut) { canGroupByOrder = true; break; }
    }
  } else {
    // If no explicit direction, verify if most orders actually HAVE pairs
    let pairedDeals = 0;
    for (const deals of orderMap.values()) {
      if (deals.length >= 2) pairedDeals++;
    }
    // If more than 30% of orders have pairs, assume it's a Hedging account
    if (pairedDeals > orderMap.size * 0.3) canGroupByOrder = true;
  }

  const trades = [];

  if (canGroupByOrder) {
    // ── STANDARD HEDGING MATCHER (By Order Number) ────────────────────────
    for (const [, deals] of orderMap) {
      let openDeal, closeDeal, allDeals = deals;

      if (hasExplicitDirection) {
        const inDeals  = deals.filter(d => classifyDirection(d[col.direction]) === 'in');
        const outDeals = deals.filter(d => classifyDirection(d[col.direction]) === 'out');
        if (inDeals.length === 0 || outDeals.length === 0) continue;
        openDeal  = inDeals[0];
        closeDeal = outDeals[outDeals.length - 1];
      } else {
        if (deals.length < 2) continue;
        openDeal  = deals[0];
        closeDeal = deals[deals.length - 1];
      }

      const openTime  = parseDate(openDeal[col.time]);
      const closeTime = parseDate(closeDeal[col.time]);
      if (!openTime || !closeTime) continue;

      if (sdTs && openTime.getTime() < sdTs) continue;
      if (edTs && openTime.getTime() > edTs) continue;

      const durationMinutes = Math.max(0, (closeTime - openTime) / 60000);

      const profit = round2(
        allDeals.reduce((s, d) => s + parseNumber(d[col.profit]),     0) +
        allDeals.reduce((s, d) => s + parseNumber(d[col.commission]), 0) +
        allDeals.reduce((s, d) => s + parseNumber(d[col.fee]),        0) +
        allDeals.reduce((s, d) => s + parseNumber(d[col.swap]),       0)
      );

      const lotSize   = parseNumber(closeDeal[col.volume] || openDeal[col.volume]);
      const tradeType = parseTradeType(openDeal[col.type]);

      trades.push({
        user_id:          login,
        open_time:        openTime.toISOString(),
        close_time:       closeTime.toISOString(),
        lot_size:         lotSize,
        profit,
        trade_type:       tradeType,
        duration_minutes: round2(durationMinutes),
        is_scalping:      round2(durationMinutes) < scalpingTimeLimit
      });
    }
  } else {
    // ── FIFO NETTING MATCHER (For reports with unique Order per deal) ───────
    const openPositionsQueue = {}; // symbol -> array of IN deals
    const netInventory = {};       // symbol -> net volume (positive = long, negative = short)

    for (const row of tradeRows) {
      let dir    = classifyDirection(row[col.direction]);
      const sym  = String(row[col.symbol] || 'Unknown').trim();
      const vol  = parseNumber(row[col.volume]);
      const time = parseDate(row[col.time]);
      const rType = String(row[col.type] ?? '').toLowerCase().trim();
      const isBuy = rType === 'buy' || rType === 'in'; // handle classic 'buy'
      const isSell= rType === 'sell' || rType === 'out';

      if (!time) continue;
      if (!openPositionsQueue[sym]) openPositionsQueue[sym] = [];
      if (!netInventory[sym]) netInventory[sym] = 0;

      const queue = openPositionsQueue[sym];

      // Dynamically infer direction if missing (pure FIFO inventory approach)
      if (!dir && (isBuy || isSell)) {
         if (isBuy) {
            dir = netInventory[sym] < -0.0001 ? 'out' : 'in';
         } else if (isSell) {
            dir = netInventory[sym] > 0.0001 ? 'out' : 'in';
         }
      }

      if (dir === 'in') {
        queue.push({ row, remainingVol: vol, time });
        netInventory[sym] += (isBuy ? vol : -vol);
      } else if (dir === 'out') {
        let outVol = vol;
        const outProfit =
          parseNumber(row[col.profit]) +
          parseNumber(row[col.commission]) +
          parseNumber(row[col.fee]) +
          parseNumber(row[col.swap]);

        // Drain the queue to fulfill the OUT volume
        while (outVol > 0.0001 && queue.length > 0) {
          const head = queue[0];
          const matchedVol = Math.min(outVol, head.remainingVol);

          // Split profit proportionally if this chunk doesn't close the full position
          const chunkProfit = (matchedVol / vol) * outProfit;

          const openTime = head.time;
          const closeTime = time;

          if ((!sdTs || openTime.getTime() >= sdTs) && (!edTs || openTime.getTime() <= edTs)) {
            const durationMinutes = Math.max(0, (closeTime - openTime) / 60000);
            
            let tradeType = parseTradeType(head.row[col.type]);
            if (!tradeType) tradeType = isSell ? 'buy' : 'sell';

            trades.push({
              user_id:          login,
              open_time:        openTime.toISOString(),
              close_time:       closeTime.toISOString(),
              lot_size:         round2(matchedVol),
              profit:           round2(chunkProfit),
              trade_type:       tradeType,
              duration_minutes: round2(durationMinutes),
              is_scalping:      round2(durationMinutes) < scalpingTimeLimit
            });
          }

          outVol -= matchedVol;
          head.remainingVol -= matchedVol;
          netInventory[sym] += (isBuy ? matchedVol : -matchedVol);

          // Remove the IN position if it's fully closed
          if (head.remainingVol < 0.0001) queue.shift();
        }
        
        // If there's STILL outVol remaining, we closed more than we had!
        // This remaining portion flipped our position, turning into a new 'in' deal.
        if (outVol > 0.0001) {
           queue.push({ row, remainingVol: outVol, time });
           netInventory[sym] += (isBuy ? outVol : -outVol);
        }
      }
    }
  }

  // ── Step 5: helpful error if still empty ──────────────────────────────────
  if (trades.length === 0) {
    const totalOrders = orderMap.size;
    const dirValues   = [...new Set(tradeRows.map(r => String(r[col.direction] ?? '').trim()))]
                          .filter(Boolean).slice(0, 5).join(', ');
    const typeValues  = [...new Set(tradeRows.map(r => String(r[col.type] ?? '').trim()))]
                          .filter(Boolean).slice(0, 5).join(', ');
    throw new Error(
      `Found ${tradeRows.length} trade row(s) across ${totalOrders} order(s), ` +
      `but could not pair opening and closing deals. ` +
      `Direction values seen: [${dirValues || 'none'}]. ` +
      `Type values seen: [${typeValues || 'none'}]. ` +
      (hasExplicitDirection
        ? 'Check that each order has both an opening (in) and a closing (out) deal.'
        : 'Each order needs at least 2 deal rows (first = open, last = close).')
    );
  }

  return trades;
}

// ═══════════════════════════════════════════════
//  FORMAT A — Classic (open_time + close_time)
// ═══════════════════════════════════════════════
function processClassicFormat(rows, headers, sdTs, edTs, scalpingTimeLimit) {
  const colMap = {};
  const missing = [];

  for (const [key, aliases] of Object.entries(COL_ALIASES_A)) {
    const found = resolveCol(headers, aliases);
    colMap[key] = found;
    if (!found && key !== 'trade_type') missing.push(key); // trade_type is optional
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(', ')}. ` +
      `Found columns: ${headers.join(', ')}`
    );
  }

  const trades = [];
  const parseErrors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const openTime  = parseDate(row[colMap.open_time]);
    const closeTime = parseDate(row[colMap.close_time]);

    if (!openTime || !closeTime) {
      parseErrors.push(`Row ${i + 2}: invalid date`);
      continue;
    }
    if (sdTs && openTime.getTime() < sdTs) continue;
    if (edTs && openTime.getTime() > edTs) continue;

    const durationMinutes = Math.max(0, (closeTime - openTime) / 60000);
    const profit   = parseNumber(row[colMap.profit]);
    const isScalp  = round2(durationMinutes) < scalpingTimeLimit;

    trades.push({
      user_id:          String(row[colMap.user_id] ?? '').trim(),
      open_time:        openTime.toISOString(),
      close_time:       closeTime.toISOString(),
      lot_size:         parseNumber(row[colMap.lot_size]),
      profit,
      trade_type:       parseTradeType(row[colMap.trade_type]),
      duration_minutes: round2(durationMinutes),
      is_scalping:      isScalp
    });
  }

  return trades;
}

// ═══════════════════════════════════════════════
//  Shared summary builder
// ═══════════════════════════════════════════════
function buildSummary(trades) {
  const userMap = new Map();

  for (const t of trades) {
    if (!userMap.has(t.user_id)) {
      userMap.set(t.user_id, {
        user_id: t.user_id,
        total_trades: 0, total_lots: 0,
        total_profit: 0, total_loss: 0,
        positive_trades: 0, negative_trades: 0,
        scalping_trades: 0, scalping_profit: 0, scalping_loss: 0, scalping_lots: 0
      });
    }
    const u = userMap.get(t.user_id);
    u.total_trades      += 1;
    u.total_lots        += t.lot_size;
    u.total_profit      += t.profit;
    if (t.profit <  0) u.total_loss      += t.profit;
    if (t.profit >  0) u.positive_trades += 1;
    if (t.profit <= 0) u.negative_trades += 1;
    if (t.is_scalping) {
      u.scalping_trades  += 1;
      u.scalping_lots    += t.lot_size;
      if (t.profit > 0) {
        u.scalping_profit  += t.profit;
      } else {
        u.scalping_loss    += t.profit;
      }
    }
  }

  const userSummary = [];
  for (const u of userMap.values()) {
    const scalpRatio          = u.total_trades > 0 ? u.scalping_trades / u.total_trades : 0;
    
    // Calculate net scalping P/L
    const net_scalping_pnl    = u.scalping_profit + u.scalping_loss;
    
    // Final requested rule: Only subtract the scalping profits (do not reverse/refund scalping losses)
    const net_eligible_profit = round2(u.total_profit - u.scalping_profit);
    
    const violation           = u.scalping_trades > 0;
    const risk_level          = scalpRatio > 0.30 ? 'High' : scalpRatio > 0 ? 'Medium' : 'Low';

    userSummary.push({
      user_id:             u.user_id,
      total_trades:        u.total_trades,
      total_lots:          round2(u.total_lots),
      positive_trades:     u.positive_trades,
      negative_trades:     u.negative_trades,
      total_profit:        round2(u.total_profit),
      total_loss:          round2(u.total_loss),
      scalping_trades:     u.scalping_trades,
      scalping_lots:       round2(u.scalping_lots),
      scalping_profit:     round2(u.scalping_profit),
      scalping_loss:       round2(u.scalping_loss),
      net_scalping_pnl:    round2(net_scalping_pnl),
      net_eligible_profit,
      scalping_ratio:      Math.round(scalpRatio * 10000) / 100,
      violation,
      risk_level
    });
  }

  userSummary.sort((a, b) => {
    if (a.violation !== b.violation) return b.violation - a.violation;
    return String(a.user_id).localeCompare(String(b.user_id));
  });

  const stats = {
    total_users:           userSummary.length,
    total_trades:          trades.length,
    violated_users:        userSummary.filter(u => u.violation).length,
    high_risk_users:       userSummary.filter(u => u.risk_level === 'High').length,
    total_scalping_trades: trades.filter(t => t.is_scalping).length,
    parse_errors:          0
  };

  return { trades, userSummary, stats, parseErrors: [] };
}

// ── Trade type normaliser ──────────────────────────────────────────────────
function parseTradeType(val) {
  if (!val) return 'unknown';
  const s = String(val).toLowerCase().trim();
  if (['buy', 'long', '0', 'b'].includes(s)) return 'buy';
  if (['sell', 'short', '1', 's'].includes(s)) return 'sell';
  return s;
}

// ═══════════════════════════════════════════════
//  FILE PARSERS
// ═══════════════════════════════════════════════

// ── All known column aliases for header-row detection ──────────────────────
const ALL_KNOWN_ALIASES = [
  ...Object.values(COL_ALIASES_A).flat(),
  ...Object.values(MT5_COLS).flat()
].map(a => a.toLowerCase());

// ── Excel ──────────────────────────────────────────────────────────────────
function parseExcel(filePath) {
  const wb  = XLSX.readFile(filePath, { cellDates: true, dateNF: 'yyyy-mm-dd hh:mm:ss' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerRowIndex = 0;
  let bestScore = 0;

  // Search entire sheet for the best header (prioritizing the Deals/History table)
  for (let r = 0; r < raw.length; r++) {
    const vals = raw[r].map(v => String(v).toLowerCase().trim());
    let score = 0;
    
    // Core MT5 Deal columns
    if (vals.includes('deal') || vals.includes('ticket')) score += 5;
    if (vals.includes('profit')) score += 5;
    if (vals.includes('time')) score += 2;
    if (vals.includes('symbol') || vals.includes('item')) score += 2;
    if (vals.includes('direction')) score += 2;
    if (vals.includes('type')) score += 2;
    if (vals.includes('volume') || vals.includes('size')) score += 2;
    if (vals.includes('order') || vals.includes('position')) score += 2;

    if (score > bestScore && score >= 6) {
      bestScore = score;
      headerRowIndex = r;
    }
  }

  // Fallback to first row with at least 2 known matches if the scoring fails
  if (bestScore === 0) {
    for (let r = 0; r < Math.min(raw.length, 30); r++) {
      const vals   = raw[r].map(v => String(v).toLowerCase().trim());
      const matches = vals.filter(v => ALL_KNOWN_ALIASES.includes(v)).length;
      if (matches >= 2) { headerRowIndex = r; break; }
    }
  }

  const preamble = raw.slice(0, headerRowIndex);
  const headers  = raw[headerRowIndex].map(v => String(v).trim());
  let dataRows = raw.slice(headerRowIndex + 1);

  // Truncate at the next section if this is a combined MT5 export
  for (let r = 0; r < dataRows.length; r++) {
    const rowStrings = dataRows[r].filter(v => typeof v === 'string').map(v => v.toLowerCase().trim());
    if (rowStrings.length === 1 && (rowStrings[0] === 'positions' || rowStrings[0] === 'orders' || rowStrings[0] === 'working orders')) {
      dataRows = dataRows.slice(0, r);
      break;
    }
  }

  const rows = dataRows
    .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
      return obj;
    });

  return { rows, preamble };
}

// ── CSV ────────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise(resolve => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines   = content.split(/\r?\n/);

    let headerLineIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const vals = splitCSVLine(lines[i]).map(v => v.toLowerCase().trim());
      if (vals.filter(v => ALL_KNOWN_ALIASES.includes(v)).length >= 2) {
        headerLineIndex = i;
        break;
      }
    }

    const preambleLines = lines.slice(0, headerLineIndex).map(l => splitCSVLine(l));
    const headers       = splitCSVLine(lines[headerLineIndex]).map(h => h.trim());
    const rows = [];

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = splitCSVLine(lines[i]);
      if (vals.every(v => !v.trim())) continue;
      const obj = {};
      headers.forEach((h, idx) => { if (h) obj[h] = vals[idx]?.trim() ?? ''; });
      rows.push(obj);
    }

    resolve({ rows, preamble: preambleLines });
  });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

module.exports = { processTradeFile };
