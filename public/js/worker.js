
    let tables = [];
    let chartInstance = null;
    const multiCharts = {};

    // Clock
    function updateClock() {
      document.getElementById('clock').textContent = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
    }
    updateClock(); setInterval(updateClock, 1000);

    // Section switching
    const sections = ['overview','charts','anomalies','dataexplorer','stats'];
    function showSection(name) {
      sections.forEach(s => {
        document.getElementById('section-'+s).style.display = s === name ? '' : 'none';
      });
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const items = document.querySelectorAll('.nav-item');
      const map = { overview: 0, charts: 1, anomalies: 2, dataexplorer: 3, stats: 4 };
      if (map[name] !== undefined) items[map[name]].classList.add('active');
    }

    function colorFromScore(score) {
      if (score >= 80) return '#10b981';
      if (score >= 50) return '#f59e0b';
      return '#ef4444';
    }

    // Load tables
    async function loadTables() {
      const res = await fetch('/api/tables');
      const data = await res.json();
      tables = data.tables;

      document.getElementById('kpi-tables').textContent = tables.length;

      // Sidebar
      const sidebar = document.getElementById('sidebar-tables');
      sidebar.innerHTML = tables.map(t => `
        <div class="table-item" onclick="selectTable('${t}')" id="st-${t}">
          <div class="table-dot"></div>${t}
        </div>
      `).join('');

      // Selects
      const selects = ['chart-table-select','mc-table-select','anom-table-select','explorer-table-select','stats-table-select'];
      selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = tables.map(t => `<option value="${t}">${t}</option>`).join('');
      });

      if (tables.length > 0) {
        selectTable(tables[0]);
        // Check URL param
        const urlTable = new URLSearchParams(window.location.search).get('table');
        if (urlTable && tables.includes(urlTable)) selectTable(urlTable);
      }
    }

    function selectTable(table) {
      document.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
      const el = document.getElementById('st-'+table);
      if (el) el.classList.add('active');
      ['chart-table-select','mc-table-select','anom-table-select','explorer-table-select','stats-table-select'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.value = table;
      });
      loadKPIs(table);
      loadChart();
      loadAlerts(table);
    }

    async function loadKPIs(table) {
      document.getElementById('kpi-table-name').textContent = table;
      try {
        const res = await fetch(`/api/stats/${table}`);
        const data = await res.json();
        document.getElementById('kpi-records').textContent = Number(data.total).toLocaleString();

        // Health score — based on std deviation anomaly ratio
        const anomRes = await fetch(`/api/anomalies/${table}`);
        const anomData = await anomRes.json();
        const anom = anomData.anomalies?.length || 0;
        document.getElementById('kpi-anomalies').textContent = anom;
        document.getElementById('alert-count').textContent = anom;
        document.getElementById('alerts-badge').textContent = anom;

        const health = Math.max(0, Math.round(100 - (anom * 15)));
        document.getElementById('kpi-health').textContent = health + '%';
        document.getElementById('kpi-health').style.color = colorFromScore(health);
        document.getElementById('kpi-health-label').textContent = health >= 80 ? '✅ Healthy' : health >= 50 ? '⚠️ Warning' : '🔴 Critical';
        document.getElementById('chart-table-badge').textContent = table;
      } catch (e) {
        document.getElementById('kpi-records').textContent = 'Error';
      }
    }

    async function loadAlerts(table) {
      const list = document.getElementById('alerts-list');
      list.innerHTML = '<div class="loading-msg"><span class="loading"></span> Scanning…</div>';
      try {
        const res = await fetch(`/api/anomalies/${table}`);
        const data = await res.json();
        const anomalies = data.anomalies || [];

        if (anomalies.length === 0) {
          list.innerHTML = `
            <div class="alert-item normal"><div class="alert-icon">✅</div>
            <div class="alert-text"><div class="title">All Systems Normal</div>
            <div class="desc">No anomalies detected in ${table}</div></div></div>`;
          return;
        }

        list.innerHTML = anomalies.map(a => `
          <div class="alert-item ${a.count > 5 ? 'critical' : 'warning'}">
            <div class="alert-icon">${a.count > 5 ? '🔴' : '🟡'}</div>
            <div class="alert-text">
              <div class="title">${a.column} — ${a.count} anomalies</div>
              <div class="desc">${a.count > 5 ? 'Critical' : 'Warning'}: Values exceed 3σ threshold</div>
            </div>
          </div>
        `).join('');
      } catch (e) {
        list.innerHTML = `<div class="alert-item warning"><div class="alert-icon">⚠️</div><div class="alert-text"><div class="title">Error loading alerts</div><div class="desc">${e.message}</div></div></div>`;
      }
    }

    async function loadChart() {
      const table = document.getElementById('chart-table-select').value;
      const colSel = document.getElementById('chart-col-select');

      // Load columns first
      const schemaRes = await fetch(`/api/schema/${table}`);
      const schemaData = await schemaRes.json();
      const numCols = schemaData.columns.filter(c =>
        ['integer','bigint','smallint','decimal','numeric','real','double precision','float'].includes(c.data_type)
      );
      colSel.innerHTML = numCols.map(c => `<option value="${c.column_name}">${c.column_name}</option>`).join('') || '<option>No numeric columns</option>';

      const col = colSel.value;
      if (!col) return;

      const res = await fetch(`/api/sensor/latest/${table}`);
      const data = await res.json();
      const rows = data.data;
      if (!rows || rows.length === 0) return;

      const labels = rows.map((_, i) => `#${i+1}`);
      const values = rows.map(r => parseFloat(r[col]) || 0);

      if (chartInstance) chartInstance.destroy();
      const ctx = document.getElementById('sensorChart').getContext('2d');
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: col,
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } } },
          scales: {
            x: { ticks: { color: '#64748b', font: { family: 'Outfit', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#64748b', font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.04)' } }
          }
        }
      });
    }

    async function loadMultiChart() {
      const table = document.getElementById('mc-table-select').value;
      const container = document.getElementById('multi-charts-grid');
      container.innerHTML = '<div class="loading-msg"><span class="loading"></span> Loading charts…</div>';

      const schemaRes = await fetch(`/api/schema/${table}`);
      const schemaData = await schemaRes.json();
      const numCols = schemaData.columns.filter(c =>
        ['integer','bigint','smallint','decimal','numeric','real','double precision','float'].includes(c.data_type)
      ).slice(0, 6);

      if (numCols.length === 0) { container.innerHTML = '<div class="loading-msg">No numeric columns found.</div>'; return; }

      const dataRes = await fetch(`/api/sensor/latest/${table}`);
      const dataObj = await dataRes.json();
      const rows = dataObj.data;
      const labels = rows.map((_, i) => `#${i+1}`);

      const colors = ['#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'];
      container.innerHTML = '';
      container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px,1fr))';

      numCols.forEach((col, i) => {
        const values = rows.map(r => parseFloat(r[col.column_name]) || 0);
        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.borderRadius = '12px'; div.style.padding = '16px';
        div.style.border = '1px solid var(--border)';
        div.innerHTML = `<div style="font-size:0.85rem;color:var(--muted);margin-bottom:12px;">${col.column_name}</div><canvas id="mc-chart-${i}" height="150"></canvas>`;
        container.appendChild(div);

        setTimeout(() => {
          if (multiCharts[i]) multiCharts[i].destroy();
          const ctx = document.getElementById(`mc-chart-${i}`).getContext('2d');
          multiCharts[i] = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [{ label: col.column_name, data: values, borderColor: colors[i], backgroundColor: colors[i]+'15', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }]
            },
            options: {
              responsive: true, maintainAspectRatio: true,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } }
              }
            }
          });
        }, 100);
      });
    }

    async function loadAnomalies() {
      const table = document.getElementById('anom-table-select').value;
      const content = document.getElementById('anomalies-content');
      content.innerHTML = '<div class="loading-msg"><span class="loading"></span> Running anomaly detection…</div>';

      const res = await fetch(`/api/anomalies/${table}`);
      const data = await res.json();
      const anomalies = data.anomalies || [];

      if (anomalies.length === 0) {
        content.innerHTML = `<div style="text-align:center;padding:40px;"><div style="font-size:3rem;margin-bottom:16px;">✅</div><div style="color:var(--green);font-size:1.1rem;font-weight:700;">All Clear!</div><div style="color:var(--muted);margin-top:8px;">No anomalies detected in <strong>${table}</strong></div></div>`;
        return;
      }

      content.innerHTML = anomalies.map(a => `
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="font-size:1.5rem;">${a.count > 5 ? '🔴' : '🟡'}</span>
            <div>
              <div style="font-weight:700;font-size:1rem;">Column: <span style="color:var(--accent2)">${a.column}</span></div>
              <div style="color:var(--muted);font-size:0.85rem;">${a.count} rows exceed the 3σ threshold</div>
            </div>
            <span style="margin-left:auto;background:rgba(239,68,68,0.2);color:var(--red);padding:4px 12px;border-radius:100px;font-size:0.8rem;font-weight:700;">${a.count > 5 ? 'CRITICAL' : 'WARNING'}</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table" style="background:transparent;">
              <thead><tr>${Object.keys(a.samples[0]||{}).map(k=>`<th>${k}</th>`).join('')}</tr></thead>
              <tbody>${a.samples.map(row=>`<tr class="anomaly-row">${Object.values(row).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      `).join('');
    }

    async function loadExplorer() {
      const table = document.getElementById('explorer-table-select').value;
      const limit = document.getElementById('explorer-limit').value;
      const tbl = document.getElementById('data-table');

      tbl.innerHTML = '<tr><td class="loading-msg"><span class="loading"></span> Loading…</td></tr>';

      const res = await fetch(`/api/data/${table}?limit=${limit}`);
      const data = await res.json();
      document.getElementById('explorer-count').textContent = `${data.total?.toLocaleString()} total rows`;

      if (!data.columns || data.columns.length === 0) {
        tbl.innerHTML = '<tr><td>No data found.</td></tr>';
        return;
      }

      tbl.innerHTML = `
        <thead><tr>${data.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${data.data.map(row=>`<tr>${data.columns.map(c=>`<td>${row[c] ?? '–'}</td>`).join('')}</tr>`).join('')}</tbody>
      `;
    }

    async function loadStats() {
      const table = document.getElementById('stats-table-select').value;
      const content = document.getElementById('stats-content');
      content.innerHTML = '<div class="loading-msg"><span class="loading"></span> Calculating statistics…</div>';

      const res = await fetch(`/api/stats/${table}`);
      const data = await res.json();

      if (!data.stats || data.stats.length === 0) {
        content.innerHTML = '<div class="loading-msg">No numeric columns found for statistics.</div>';
        return;
      }

      content.innerHTML = `
        <div style="margin-bottom:16px; color:var(--muted); font-size:0.9rem;">Total rows: <strong style="color:var(--text)">${Number(data.total).toLocaleString()}</strong></div>
        <table class="stats-table">
          <thead><tr><th>Column</th><th>Min</th><th>Max</th><th>Average</th><th>Std Dev</th><th>Health</th></tr></thead>
          <tbody>
            ${data.stats.map(s => {
              const range = (s.max - s.min) || 1;
              const pct = Math.round(((s.avg - s.min) / range) * 100);
              const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981';
              return `<tr>
                <td style="font-weight:600;color:var(--accent2)">${s.column}</td>
                <td>${s.min}</td><td>${s.max}</td><td>${s.avg}</td><td>${s.std}</td>
                <td style="min-width:120px">
                  <div class="health-bar"><div class="health-fill" style="width:${pct}%;background:${color}"></div></div>
                  <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${pct}% of range</div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    // Init
    loadTables().then(() => {
      loadChart();
    });

    // Socket.IO real-time
    const socket = io();
    socket.on('sensor_update', data => {
      console.log('Real-time update:', data.table, data.data.length, 'rows');
    });
  