/**
 * exporter.js
 * Generates a multi-sheet Excel report using ExcelJS.
 * Sheet 1: All trades (with duration + scalping flag)
 * Sheet 2: Scalping trades only
 * Sheet 3: User summary report
 */

const ExcelJS = require('exceljs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Color palette ──────────────────────────────────────────────────────────
const COLORS = {
  headerBg:     '1E2A3A',
  headerFont:   'FFFFFF',
  scalpRed:     'FFEBEE',
  scalpRedFont: 'C62828',
  eligGreen:    'E8F5E9',
  eligGreenFont:'1B5E20',
  highRisk:     'FFF3E0',
  highRiskFont: 'E65100',
  altRow:       'F8FAFF',
  border:       'D0D7E3'
};

function headerStyle(ws, cols, row = 1) {
  const headerRow = ws.getRow(row);
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font   = { bold: true, color: { argb: COLORS.headerFont }, size: 10 };
    cell.border = border();
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.height = 28;
}

function border() {
  const s = { style: 'thin', color: { argb: COLORS.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function applyRowStyle(row, bgColor, fontColor) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    if (fontColor) cell.font = { color: { argb: fontColor }, size: 10 };
    cell.border = border();
    cell.alignment = { vertical: 'middle' };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHEET 1: All Trades
// ─────────────────────────────────────────────────────────────────────────────
function buildTradesSheet(wb, trades) {
  const ws = wb.addWorksheet('All Trades', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = [
    { header: 'User ID',            key: 'user_id',           width: 14 },
    { header: 'Trade Type',         key: 'trade_type',        width: 10 },
    { header: 'Open Time',          key: 'open_time',         width: 20 },
    { header: 'Close Time',         key: 'close_time',        width: 20 },
    { header: 'Duration (min)',     key: 'duration_minutes',  width: 15 },
    { header: 'Lot Size',           key: 'lot_size',          width: 10 },
    { header: 'Profit',             key: 'profit',            width: 12 },
    { header: 'Scalping?',          key: 'is_scalping',       width: 11 }
  ];

  headerStyle(ws, ws.columns);

  trades.forEach((t, i) => {
    const row = ws.addRow({
      ...t,
      open_time:   formatDate(t.open_time),
      close_time:  formatDate(t.close_time),
      is_scalping: t.is_scalping ? 'YES' : 'No'
    });

    if (t.is_scalping) {
      applyRowStyle(row, COLORS.scalpRed, COLORS.scalpRedFont);
    } else if (i % 2 === 0) {
      applyRowStyle(row, COLORS.altRow, null);
    } else {
      applyRowStyle(row, 'FFFFFF', null);
    }
  });

  ws.autoFilter = { from: 'A1', to: 'H1' };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHEET 2: Scalping Trades Only
// ─────────────────────────────────────────────────────────────────────────────
function buildScalpingSheet(wb, trades) {
  const ws = wb.addWorksheet('Scalping Trades', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = [
    { header: 'User ID',            key: 'user_id',           width: 14 },
    { header: 'Trade Type',         key: 'trade_type',        width: 10 },
    { header: 'Open Time',          key: 'open_time',         width: 20 },
    { header: 'Close Time',         key: 'close_time',        width: 20 },
    { header: 'Duration (min)',     key: 'duration_minutes',  width: 15 },
    { header: 'Lot Size',           key: 'lot_size',          width: 10 },
    { header: 'Profit',             key: 'profit',            width: 12 }
  ];

  headerStyle(ws, ws.columns);

  const scalpTrades = trades.filter(t => t.is_scalping);

  scalpTrades.forEach((t, i) => {
    const row = ws.addRow({
      ...t,
      open_time:  formatDate(t.open_time),
      close_time: formatDate(t.close_time)
    });
    applyRowStyle(row, i % 2 === 0 ? COLORS.scalpRed : 'FFD7D7', COLORS.scalpRedFont);
  });

  ws.autoFilter = { from: 'A1', to: 'G1' };

  // Totals row
  if (scalpTrades.length > 0) {
    ws.addRow([]);
    const totalRow = ws.addRow({
      user_id:           'TOTAL',
      duration_minutes:  '',
      lot_size:          round2(scalpTrades.reduce((s, t) => s + t.lot_size, 0)),
      profit:            round2(scalpTrades.reduce((s, t) => s + t.profit, 0))
    });
    totalRow.font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHEET 3: User Summary
// ─────────────────────────────────────────────────────────────────────────────
function buildSummarySheet(wb, userSummary) {
  const ws = wb.addWorksheet('User Summary Report', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = [
    { header: 'User ID',              key: 'user_id',             width: 14 },
    { header: 'Total Trades',         key: 'total_trades',        width: 13 },
    { header: 'Total Lots',           key: 'total_lots',          width: 11 },
    { header: 'Positive Trades',      key: 'positive_trades',     width: 15 },
    { header: 'Negative Trades',      key: 'negative_trades',     width: 15 },
    { header: 'Total Profit',         key: 'total_profit',        width: 13 },
    { header: 'Total Loss',           key: 'total_loss',          width: 12 },
    { header: 'Scalping Trades',      key: 'scalping_trades',     width: 14 },
    { header: 'Scalping %',           key: 'scalping_ratio',      width: 12 },
    { header: 'Scalping Lots',        key: 'scalping_lots',       width: 13 },
    { header: 'Scalping Profit',      key: 'scalping_profit',     width: 14 },
    { header: 'Scalping Loss',        key: 'scalping_loss',       width: 14 },
    { header: 'Net Eligible Profit',  key: 'net_eligible_profit', width: 17 },
    { header: 'Violation',            key: 'violation',           width: 11 },
    { header: 'Risk Level',           key: 'risk_level',          width: 11 }
  ];

  headerStyle(ws, ws.columns);

  userSummary.forEach((u, i) => {
    const row = ws.addRow({
      ...u,
      scalping_ratio: u.scalping_ratio.toFixed(2) + '%',
      violation:      u.violation ? 'YES' : 'No'
    });

    let bg = i % 2 === 0 ? COLORS.altRow : 'FFFFFF';
    let fg = null;

    if (u.violation && u.risk_level === 'High') {
      bg = COLORS.highRisk; fg = COLORS.highRiskFont;
    } else if (u.violation) {
      bg = COLORS.scalpRed; fg = COLORS.scalpRedFont;
    } else {
      bg = COLORS.eligGreen; fg = COLORS.eligGreenFont;
    }

    applyRowStyle(row, bg, fg);

    // Bold violation cell
    const vCell = row.getCell('violation');
    vCell.font = { bold: true, color: { argb: fg || '000000' } };
  });

  ws.autoFilter = { from: 'A1', to: 'O1' };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main export function
// ─────────────────────────────────────────────────────────────────────────────
async function generateExcelReport({ trades, userSummary }, tmpDir) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Scalping Detector';
  wb.created  = new Date();
  wb.modified = new Date();

  buildTradesSheet(wb, trades);
  buildScalpingSheet(wb, trades);
  buildSummarySheet(wb, userSummary);

  const outPath = path.join(tmpDir, `report_${uuidv4()}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  return outPath;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { hour12: false }).replace(',', '');
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = { generateExcelReport };
