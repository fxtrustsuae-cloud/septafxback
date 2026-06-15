/* ═══════════════════════════════════════════════════════════════════════════
   ScalpGuard — Frontend Application Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// Auto-detect backend location (relative path for deployed servers)
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.port === '5500' // Live server overrides
  ? 'http://localhost:3001' 
  : '';

// ── State ─────────────────────────────────────────────────────────────────
let state = {
  sessionId:   null,
  userSummary: [],
  filtered:    [],
  currentFilter: 'all',
  searchQuery:   '',
  sortKey:       'violation',
  sortDir:       -1,   // -1 = desc, 1 = asc
  charts:        {}
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fileInput   = $('fileInput');
const dropZone    = $('dropZone');
const fileChosen  = $('fileChosen');
const analyzeBtn  = $('analyzeBtn');
const progressWrap = $('progressWrap');
const progressFill = $('progressFill');
const progressText = $('progressText');
const errorAlert  = $('errorAlert');
const errorMsg    = $('errorMsg');
const resultsSection = $('resultsSection');
const summaryBody = $('summaryBody');
const tableCount  = $('tableCount');
const searchUser  = $('searchUser');
const exportBtn   = $('exportBtn');
const themeToggle = $('themeToggle');
const parseWarn   = $('parseWarn');
const parseWarnMsg= $('parseWarnMsg');
const scalpingTradesCard = $('scalpingTradesCard');
const scalpingBody       = $('scalpingBody');
const scalpingCount      = $('scalpingCount');

// ═══════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════
(function initTheme() {
  const saved = localStorage.getItem('sg-theme') || 'dark';
  if (saved === 'light') { document.body.classList.add('light'); themeToggle.textContent = '☀️'; }
})();

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  themeToggle.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('sg-theme', isLight ? 'light' : 'dark');
  if (state.charts.profit) rebuildCharts(state.userSummary);
});

// ═══════════════════════════════════════════════
//  FILE UPLOAD
// ═══════════════════════════════════════════════
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
});
dropZone.addEventListener('click', e => {
  if (e.target === dropZone || e.target.classList.contains('drop-title') ||
      e.target.classList.contains('drop-sub') || e.target.classList.contains('upload-icon')) {
    fileInput.click();
  }
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(file) {
  const allowedExts = ['.xlsx', '.xls', '.csv'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExts.includes(ext)) {
    showError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
    return;
  }
  fileChosen.textContent = `📎 ${file.name}  (${formatSize(file.size)})`;
  analyzeBtn.disabled = false;
  analyzeBtn._file = file;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ═══════════════════════════════════════════════
//  ANALYZE
// ═══════════════════════════════════════════════
analyzeBtn.addEventListener('click', async () => {
  const file = analyzeBtn._file;
  if (!file) return;

  dismissError();
  parseWarn.style.display = 'none';
  resultsSection.style.display = 'none';

  // Build FormData
  const fd = new FormData();
  fd.append('file', file);
  const startDate = $('startDate').value;
  const endDate   = $('endDate').value;
  const scalpingTimeLimit = $('scalpingTimeLimit').value;
  
  if (startDate) fd.append('startDate', startDate);
  if (endDate)   fd.append('endDate', endDate);
  if (scalpingTimeLimit) fd.append('scalpingTimeLimit', scalpingTimeLimit);

  // Progress animation
  showProgress('Uploading file…', 15);
  analyzeBtn.disabled = true;

  try {
    setProgress(35, 'Processing trades…');
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: fd });
    setProgress(75, 'Computing violations…');

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    setProgress(95, 'Rendering dashboard…');
    await sleep(300);

    hideProgress();
    analyzeBtn.disabled = false;

    state.sessionId   = data.sessionId;
    state.userSummary = data.userSummary;
    renderAll(data);

  } catch (err) {
    hideProgress();
    analyzeBtn.disabled = false;
    showError(err.message || 'Failed to process file. Please check the server is running.');
  }
});

function showProgress(text, pct) {
  progressWrap.style.display = 'block';
  progressFill.style.width   = pct + '%';
  progressText.textContent   = text;
}
function setProgress(pct, text) {
  progressFill.style.width = pct + '%';
  if (text) progressText.textContent = text;
}
function hideProgress() { progressWrap.style.display = 'none'; progressFill.style.width = '0%'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════
//  RENDER ALL
// ═══════════════════════════════════════════════
function renderAll(data) {
  renderStats(data.stats);
  state.filtered = [...state.userSummary];
  state.currentFilter = 'all';
  state.searchQuery   = '';
  searchUser.value    = '';
  setActivePill('all');
  sortAndRender();
  rebuildCharts(state.userSummary);
  renderScalpingTrades(data.trades);

  // Parse errors
  if (data.parseErrors && data.parseErrors.length > 0) {
    parseWarnMsg.textContent = `${data.parseErrors.length} rows skipped due to parsing issues: ${data.parseErrors.slice(0, 3).join('; ')}`;
    parseWarn.style.display = 'flex';
  }

  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ═══════════════════════════════════════════════
//  STATS CARDS
// ═══════════════════════════════════════════════
function renderStats(stats) {
  const grid = $('statsGrid');
  grid.innerHTML = '';

  const cards = [
    { label: 'Total Users',         value: stats.total_users,           icon: '👥', cls: 'purple' },
    { label: 'Total Trades',        value: fmtNum(stats.total_trades),  icon: '📊', cls: '' },
    { label: 'Violated Users',      value: stats.violated_users,        icon: '🚫', cls: 'red',    badge: stats.violated_users > 0 ? 'Requires review' : '' },
    { label: 'High Risk Users',     value: stats.high_risk_users,       icon: '⚠️', cls: 'orange' },
    { label: 'Scalping Trades',     value: fmtNum(stats.total_scalping_trades), icon: '⚡', cls: 'red' },
    { label: 'Clean Users',         value: stats.total_users - stats.violated_users, icon: '✅', cls: 'green' }
  ];

  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = `stat-card ${c.cls}`;
    el.innerHTML = `
      <span class="stat-icon">${c.icon}</span>
      <span class="stat-label">${c.label}</span>
      <span class="stat-value">${c.value}</span>
      ${c.badge ? `<span class="stat-badge">${c.badge}</span>` : ''}
    `;
    grid.appendChild(el);
  });
}

// ═══════════════════════════════════════════════
//  FILTER + SEARCH
// ═══════════════════════════════════════════════
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    state.currentFilter = pill.dataset.filter;
    setActivePill(state.currentFilter);
    applyFilters();
  });
});

searchUser.addEventListener('input', () => {
  state.searchQuery = searchUser.value.trim().toLowerCase();
  applyFilters();
});

function setActivePill(filter) {
  document.querySelectorAll('.pill').forEach(p => {
    p.classList.toggle('active', p.dataset.filter === filter);
  });
}

function applyFilters() {
  let data = [...state.userSummary];

  // Text search
  if (state.searchQuery) {
    data = data.filter(u => String(u.user_id).toLowerCase().includes(state.searchQuery));
  }

  // Category filter
  switch (state.currentFilter) {
    case 'violation': data = data.filter(u => u.violation);           break;
    case 'high':      data = data.filter(u => u.risk_level === 'High'); break;
    case 'eligible':  data = data.filter(u => !u.violation);          break;
  }

  state.filtered = data;
  sortAndRender();
}

// ═══════════════════════════════════════════════
//  SORT
// ═══════════════════════════════════════════════
document.querySelectorAll('thead th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir *= -1;
    } else {
      state.sortKey = key;
      state.sortDir = -1;
    }
    document.querySelectorAll('thead th').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    sortAndRender();
  });
});

function sortAndRender() {
  const key = state.sortKey;
  const dir = state.sortDir;

  const sorted = [...state.filtered].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
    if (typeof av === 'string')  return dir * av.localeCompare(bv);
    return dir * (av - bv);
  });

  renderTable(sorted);
}

// ═══════════════════════════════════════════════
//  TABLE
// ═══════════════════════════════════════════════
function renderTable(data) {
  tableCount.textContent = `${data.length} user${data.length !== 1 ? 's' : ''}`;

  if (data.length === 0) {
    summaryBody.innerHTML = `
      <tr><td colspan="11">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No users match the current filters.</p>
        </div>
      </td></tr>`;
    return;
  }

  summaryBody.innerHTML = data.map(u => {
    const rowCls = u.violation ? 'row-violation' : 'row-eligible';
    const vBadge = u.violation
      ? `<span class="badge badge-violation">🚫 YES</span>`
      : `<span class="badge badge-clean">✅ No</span>`;
    const rBadge = {
      High:   `<span class="badge badge-high">🔴 High</span>`,
      Medium: `<span class="badge badge-medium">🟡 Medium</span>`,
      Low:    `<span class="badge badge-low">🟢 Low</span>`
    }[u.risk_level] || '';

    return `
    <tr class="${rowCls}">
      <td class="user-id-cell">${escHtml(String(u.user_id))}</td>
      <td>${u.total_trades}</td>
      <td>${fmtFloat(u.total_lots)}</td>
      <td>${u.positive_trades}</td>
      <td>${u.negative_trades}</td>
      <td>${u.scalping_trades}${u.scalping_ratio > 0 ? ` <small style="color:var(--text-muted)">(${u.scalping_ratio.toFixed(1)}%)</small>` : ''}</td>
      <td class="${u.total_profit >= 0 ? 'profit-pos' : 'profit-neg'}">${fmtMoney(u.total_profit)}</td>
      <td>${fmtFloat(u.scalping_lots)}</td>
      <td class="profit-pos">${fmtMoney(u.scalping_profit)}</td>
      <td class="${u.scalping_loss < 0 ? 'profit-neg' : ''}">${fmtMoney(u.scalping_loss)}</td>
      <td class="${u.net_eligible_profit >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${fmtMoney(u.net_eligible_profit)}</strong></td>
      <td>${vBadge}</td>
      <td>${rBadge}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════
//  SCALPING TRADES TABLE
// ═══════════════════════════════════════════════
function renderScalpingTrades(trades) {
  if (!trades) return;
  const scalps = trades.filter(t => t.is_scalping);
  
  if (scalps.length === 0) {
    scalpingTradesCard.style.display = 'none';
    return;
  }
  
  scalpingTradesCard.style.display = 'block';
  scalpingCount.textContent = `${scalps.length} trade${scalps.length !== 1 ? 's' : ''}`;
  
  // Sort newest first
  scalps.sort((a, b) => new Date(b.open_time) - new Date(a.open_time));
  
  scalpingBody.innerHTML = scalps.map(t => `
    <tr class="row-violation">
      <td class="user-id-cell">${escHtml(String(t.user_id))}</td>
      <td><span class="badge ${t.trade_type === 'buy' ? 'badge-clean' : 'badge-violation'}">${String(t.trade_type).toUpperCase()}</span></td>
      <td>${formatDateTime(t.open_time)}</td>
      <td>${formatDateTime(t.close_time)}</td>
      <td><strong>${t.duration_minutes.toFixed(2)}</strong></td>
      <td>${fmtFloat(t.lot_size)}</td>
      <td class="${t.profit >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${fmtMoney(t.profit)}</strong></td>
    </tr>
  `).join('');
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => n.toString().padStart(2, '0');
  const dStr = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  const tStr = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  return `${dStr} ${tStr}`;
}

// ═══════════════════════════════════════════════
//  CHARTS
// ═══════════════════════════════════════════════
function rebuildCharts(users) {
  destroyCharts();

  const isDark = !document.body.classList.contains('light');
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tickColor  = isDark ? '#8B949E' : '#5A6478';
  const fontFamily = 'Inter, sans-serif';

  // Limit to top 15 users by total_trades
  const chartUsers = [...users]
    .sort((a, b) => b.total_trades - a.total_trades)
    .slice(0, 15);

  // ── Bar chart: Total Profit vs Scalping Profit ──
  const profitCtx = document.getElementById('profitChart').getContext('2d');
  state.charts.profit = new Chart(profitCtx, {
    type: 'bar',
    data: {
      labels: chartUsers.map(u => `User ${u.user_id}`),
      datasets: [
        {
          label: 'Total Profit',
          data: chartUsers.map(u => u.total_profit),
          backgroundColor: 'rgba(108,99,255,0.7)',
          borderColor: '#6C63FF',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Scalping Profit',
          data: chartUsers.map(u => u.scalping_profit),
          backgroundColor: 'rgba(255,82,82,0.65)',
          borderColor: '#FF5252',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Net Eligible Profit',
          data: chartUsers.map(u => u.net_eligible_profit),
          backgroundColor: 'rgba(0,212,170,0.65)',
          borderColor: '#00D4AA',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tickColor, font: { family: fontFamily, size: 12 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}` } }
      },
      scales: {
        x: { ticks: { color: tickColor, font: { family: fontFamily, size: 11 }, maxRotation: 45 }, grid: { color: gridColor } },
        y: { ticks: { color: tickColor, font: { family: fontFamily }, callback: v => '$' + v.toLocaleString() }, grid: { color: gridColor } }
      }
    }
  });

  // ── Doughnut: Risk Distribution ──
  const riskCtx = document.getElementById('riskChart').getContext('2d');
  const riskCounts = {
    High:   users.filter(u => u.risk_level === 'High').length,
    Medium: users.filter(u => u.risk_level === 'Medium').length,
    Low:    users.filter(u => u.risk_level === 'Low').length
  };

  state.charts.risk = new Chart(riskCtx, {
    type: 'doughnut',
    data: {
      labels: ['High Risk', 'Medium Risk', 'Low Risk'],
      datasets: [{
        data: [riskCounts.High, riskCounts.Medium, riskCounts.Low],
        backgroundColor: ['rgba(255,82,82,0.85)', 'rgba(255,152,0,0.85)', 'rgba(0,212,170,0.85)'],
        borderColor: isDark ? '#161B22' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tickColor, font: { family: fontFamily, size: 12 }, padding: 16, boxWidth: 12 }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} user(s)` } }
      }
    }
  });
}

function destroyCharts() {
  Object.values(state.charts).forEach(c => { if (c) c.destroy(); });
  state.charts = {};
}

// ═══════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════
exportBtn.addEventListener('click', () => {
  if (!state.sessionId) return;
  exportBtn.style.opacity = '0.6';
  exportBtn.textContent  = '⏳ Generating…';

  const a = document.createElement('a');
  a.href     = `${API_BASE}/export/${state.sessionId}`;
  a.download = 'scalping_report.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    exportBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
      Export Excel`;
    exportBtn.style.opacity = '1';
  }, 2500);
});

// ═══════════════════════════════════════════════
//  ERROR HANDLING
// ═══════════════════════════════════════════════
function showError(msg) {
  errorMsg.textContent   = msg;
  errorAlert.style.display = 'flex';
}
function dismissError() { errorAlert.style.display = 'none'; }

// ═══════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════
function fmtMoney(n)  { return (n >= 0 ? '+' : '') + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtFloat(n)  { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtNum(n)    { return Number(n).toLocaleString('en-US'); }
function escHtml(str) { const d = document.createElement('div'); d.appendChild(document.createTextNode(str)); return d.innerHTML; }
