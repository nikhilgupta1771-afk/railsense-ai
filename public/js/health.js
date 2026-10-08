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

let allDevices = [];
let currentFilter = 'All';

async function loadHealthData() {
  const grid = document.getElementById('device-grid');
  grid.innerHTML = '<div class="loading-msg"><span class="loading"></span> Evaluating device health rules...</div>';

  try {
    const res = await fetch('/api/health_status');
    if (!res.ok) throw new Error('API returned ' + res.status);
    const data = await res.json();
    
    allDevices = data.devices || [];
    
    // Update summary cards
    document.getElementById('sum-total').textContent = data.summary.total;
    document.getElementById('sum-good').textContent = data.summary.Good;
    document.getElementById('sum-poor').textContent = data.summary.Poor;
    document.getElementById('sum-critical').textContent = data.summary.Critical;

    applyFilters();
  } catch (e) {
    grid.innerHTML = '<div class="loading-msg">⚠️ Error loading health status: ' + e.message + '</div>';
  }
}

function renderGrid(devices) {
  const grid = document.getElementById('device-grid');
  if (devices.length === 0) {
    grid.innerHTML = '<div class="loading-msg">No devices match the current filters.</div>';
    return;
  }

  grid.innerHTML = devices.map(d => {
    let statusClass = d.status.toLowerCase();
    
    let issuesHtml = '';
    if (d.issues && d.issues.length > 0) {
      issuesHtml = '<div class="device-issues"><ul>' + d.issues.map(iss => {
        let liClass = iss.includes('strictly out of range') ? 'crit' : 'warn';
        return `<li class="${liClass}">${escapeHtml(iss)}</li>`;
      }).join('') + '</ul></div>';
    } else {
      issuesHtml = '<div class="device-issues" style="color:var(--green)">✓ All monitored parameters within safe limits</div>';
    }

    const lastUpdated = d.time ? new Date(d.time).toLocaleString('en-IN') : 'Unknown';

    return `
      <div class="device-card ${statusClass}">
        <div class="device-header">
          <div>
            <div class="device-id">${escapeHtml(d.vendor_device_id)}</div>
            <div class="device-name">${escapeHtml(d.name || d.vendor_device_id)} · Updated: ${lastUpdated}</div>
          </div>
          <div class="status-badge ${statusClass}">${d.status}</div>
        </div>
        ${issuesHtml}
        <div class="device-action">
          <a href="/device?id=${encodeURIComponent(d.vendor_device_id)}">📊 View Live Charts & Data</a>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function applyFilters() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  
  let filtered = allDevices;
  
  // Apply status filter
  if (currentFilter !== 'All') {
    filtered = filtered.filter(d => d.status === currentFilter);
  }
  
  // Apply search query
  if (query) {
    filtered = filtered.filter(d => 
      (d.vendor_device_id && d.vendor_device_id.toLowerCase().includes(query)) ||
      (d.name && d.name.toLowerCase().includes(query))
    );
  }
  
  renderGrid(filtered);
}

// Event Listeners
document.getElementById('search-input')?.addEventListener('input', applyFilters);

document.querySelectorAll('.filter-tabs button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-tabs button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    applyFilters();
  });
});

// Load on start
loadHealthData();

// Refresh every 30 seconds
setInterval(loadHealthData, 30000);
