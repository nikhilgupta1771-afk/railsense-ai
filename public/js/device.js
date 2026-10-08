// ─── Auth Guard ──────────────────────────────────────────────────────────────
const token = localStorage.getItem('token');
if (!token) { window.location.href = '/login'; }

const originalFetch = window.fetch;
window.fetch = function() {
  let [resource, config] = arguments;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  config.headers['Authorization'] = 'Bearer ' + token;
  return originalFetch(resource, config);
};

// ─── Color Palette for Charts ────────────────────────────────────────────────
const COLOR_PALETTE = [
  { border: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { border: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { border: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { border: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { border: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { border: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { border: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { border: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  { border: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  { border: '#e11d48', bg: 'rgba(225,29,72,0.12)' },
  { border: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  { border: '#84cc16', bg: 'rgba(132,204,22,0.12)' },
  { border: '#d946ef', bg: 'rgba(217,70,239,0.12)' },
  { border: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { border: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  { border: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  { border: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  { border: '#a3e635', bg: 'rgba(163,230,53,0.12)' },
  { border: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
];

// Non-chartable columns (metadata, text, IDs)
const SKIP_COLUMNS = ['sl_no', 'zone_code', 'div_code', 'section', 'location', 'vendor_device_id',
  'vendor_device_name', 'vendor_device_label', 'vendor_code', 'smms_asset_code', 'loc', 'ver',
  'time', 'stn', 'name', 'date', 'geartype', 'subgear', 'parent_device', 'document', 'comm', 'eventtype'];

const charts = {};
let numericParams = [];

// ─── Detect Mode ─────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const deviceId = urlParams.get('id');

if (deviceId) {
  document.getElementById('search-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('device-id-display').textContent = deviceId;
  document.getElementById('page-title').textContent = 'Device: ' + deviceId;
  loadDeviceData(deviceId);
  connectLive(deviceId);
} else {
  document.getElementById('search-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  loadDeviceList();
}

// ─── Search/List Mode ────────────────────────────────────────────────────────
let allDevices = [];

async function loadDeviceList() {
  const grid = document.getElementById('device-grid');
  const countEl = document.getElementById('device-count');
  grid.innerHTML = '<div class="loading-msg"><span class="loading"></span> Loading devices from database...</div>';

  try {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('API returned ' + res.status);
    const data = await res.json();
    allDevices = data.devices || [];
    countEl.textContent = allDevices.length + ' unique devices found (no duplicates)';
    renderDeviceGrid(allDevices);
  } catch (e) {
    grid.innerHTML = '<div class="loading-msg">⚠️ Error loading devices: ' + e.message + '</div>';
  }
}

function renderDeviceGrid(devices) {
  const grid = document.getElementById('device-grid');
  if (devices.length === 0) {
    grid.innerHTML = '<div class="loading-msg">No devices match your search.</div>';
    document.getElementById('device-count').textContent = '0 devices found';
    return;
  }
  document.getElementById('device-count').textContent = devices.length + ' device(s) shown';
  grid.innerHTML = devices.map((d, i) => `
    <div class="device-card" onclick="window.location='/device?id=${encodeURIComponent(d)}'">
      <div class="device-id">${escapeHtml(d)}</div>
      <div class="device-label">Device #${i + 1} · Click to view live data →</div>
      <div class="device-arrow">→</div>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function filterDevices() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  if (!query) {
    renderDeviceGrid(allDevices);
    return;
  }
  const filtered = allDevices.filter(d => d.toLowerCase().includes(query));
  renderDeviceGrid(filtered);
}

document.getElementById('search-input')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') filterDevices();
});
// Also filter as user types (live search)
document.getElementById('search-input')?.addEventListener('input', function() {
  filterDevices();
});

// ─── Device Detail Mode ─────────────────────────────────────────────────────
async function loadDeviceData(id) {
  try {
    const res = await fetch('/api/device/' + encodeURIComponent(id) + '?limit=200');
    if (!res.ok) throw new Error('API returned ' + res.status);
    const data = await res.json();
    const rows = data.data || [];

    if (rows.length === 0) {
      document.getElementById('charts-container').innerHTML = '<div class="no-data"><div class="icon">📭</div><h3>No Data Found</h3><p>No records found for this device ID.</p></div>';
      return;
    }

    // Show device metadata from first row
    const firstRow = rows[rows.length - 1] || rows[0];
    let metaHtml = rows.length + ' records loaded';
    if (firstRow.vendor_device_name) metaHtml += ' · Name: ' + firstRow.vendor_device_name;
    if (firstRow.vendor_device_label) metaHtml += ' · Label: ' + firstRow.vendor_device_label;
    if (firstRow.stn) metaHtml += ' · Station: ' + firstRow.stn;
    if (firstRow.geartype) metaHtml += ' · Gear: ' + firstRow.geartype;
    document.getElementById('record-count').textContent = metaHtml;

    // Determine numeric columns to chart (use API-provided list or detect from data)
    if (data.numericColumns && data.numericColumns.length > 0) {
      numericParams = data.numericColumns.filter(c => !SKIP_COLUMNS.includes(c));
    } else {
      // Fallback: detect from first row
      numericParams = Object.keys(rows[0]).filter(k => {
        if (SKIP_COLUMNS.includes(k)) return false;
        const val = rows.find(r => r[k] !== null && r[k] !== undefined);
        return val && !isNaN(parseFloat(val[k]));
      });
    }

    // Build labels from time
    const labels = rows.map(r => {
      if (!r.time) return '';
      const d = new Date(r.time);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    });

    // Create charts
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    const CRITICAL_PARAMS = ['ihg', 'vrg', 'vhg', 'irg', 'idg', 'vdg', 'vhhg', 'ihhg', 'temp', 'rh'];

    numericParams.forEach((param, idx) => {
      const values = rows.map(r => r[param] !== null && r[param] !== undefined ? parseFloat(r[param]) : null);
      const hasData = values.some(v => v !== null && !isNaN(v));
      // Force render critical parameters even if they currently lack data
      if (!hasData && !CRITICAL_PARAMS.includes(param)) return;

      const colors = COLOR_PALETTE[idx % COLOR_PALETTE.length];

      const card = document.createElement('div');
      card.className = 'chart-card';
      card.innerHTML = `<h4>${param.toUpperCase()} <span>Sensor Parameter</span></h4><div class="chart-wrap"><canvas id="chart-${param}"></canvas></div>`;
      container.appendChild(card);

      const ctx = document.getElementById('chart-' + param).getContext('2d');
      charts[param] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: param.toUpperCase(),
            data: values,
            borderColor: colors.border,
            backgroundColor: colors.bg,
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 5,
            pointBackgroundColor: colors.border,
            fill: true,
            tension: 0.4,
            spanGaps: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } },
          },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }
          }
        }
      });
    });

    if (container.children.length === 0) {
      container.innerHTML = '<div class="no-data"><div class="icon">📊</div><h3>No Numeric Data</h3><p>This device has no numeric parameters to chart.</p></div>';
    }

    // Render data table
    renderDataTable(rows, data.columns || Object.keys(rows[0]));

  } catch (e) {
    document.getElementById('charts-container').innerHTML = '<div class="no-data"><div class="icon">⚠️</div><h3>Error Loading Data</h3><p>' + e.message + '</p></div>';
  }
}

function renderDataTable(rows, columns) {
  const tableWrap = document.getElementById('data-table-wrap');
  if (!rows || rows.length === 0) { tableWrap.innerHTML = '<p style="color:var(--muted)">No data</p>'; return; }

  // Show important columns first
  const priorityCols = ['time', 'ihg', 'vrg', 'vhg', 'irg', 'idg', 'vdg', 'vhhg', 'ihhg', 'temp', 'rh', 'rssi', 'vs', 'vrr', 'is', 'counter', 'ioff', 'ion', 'ipl', 'pl', 'shpr', 'voff', 'von', 'iaug', 'vaug'];
  const displayCols = priorityCols.filter(c => columns.includes(c));

  let html = '<table class="data-table"><thead><tr>';
  displayCols.forEach(c => { html += '<th>' + c.toUpperCase() + '</th>'; });
  html += '</tr></thead><tbody>';
  
  // Show last 50 rows
  const displayRows = rows.slice(-50);
  displayRows.forEach(r => {
    html += '<tr>';
    displayCols.forEach(c => {
      let val = r[c];
      if (c === 'time' && val) {
        val = new Date(val).toLocaleString('en-IN');
      } else if (val !== null && val !== undefined && !isNaN(parseFloat(val))) {
        val = parseFloat(val).toFixed(2);
      } else {
        val = val || '-';
      }
      html += '<td>' + val + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  tableWrap.innerHTML = html;
}

// ─── Live Updates via Socket.IO ──────────────────────────────────────────────
function connectLive(id) {
  const socket = io();
  socket.emit('subscribe_device', id);

  socket.on('device_update', function(payload) {
    if (payload.vendor_device_id !== id) return;
    const row = payload.data;
    const timeLabel = row.time
      ? new Date(row.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + new Date(row.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString();

    numericParams.forEach(param => {
      if (!charts[param]) return;
      const chart = charts[param];
      const val = row[param] !== null && row[param] !== undefined ? parseFloat(row[param]) : null;
      chart.data.labels.push(timeLabel);
      chart.data.datasets[0].data.push(val);
      if (chart.data.labels.length > 200) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
      }
      chart.update('none');
    });
  });
}
