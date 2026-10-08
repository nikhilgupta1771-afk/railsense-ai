
    // Clock
    function updateTime() {
      document.getElementById('passenger-time').textContent = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' });
    }
    updateTime(); setInterval(updateTime, 1000);

    const trainNames = ['Rajdhani Express', 'Shatabdi Express', 'Duronto Express', 'Gatimaan Express', 'Vande Bharat'];
    const routes = ['Delhi → Mumbai', 'Chennai → Bangalore', 'Kolkata → Delhi', 'Agra → Delhi', 'Pune → Mumbai'];

    async function loadPassengerData() {
      // Check DB
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'connected') {
          document.getElementById('sys-icon').textContent = '✅';
          document.getElementById('sys-text').textContent = 'All Systems Operational';
          document.getElementById('sys-text').style.color = '#10b981';
          document.getElementById('sys-sub').textContent = 'Sensor network is live and monitoring all trains';
        }
      } catch (e) {
        document.getElementById('sys-icon').textContent = '❌';
        document.getElementById('sys-text').textContent = 'Connection Issue';
        document.getElementById('sys-sub').textContent = 'Unable to reach sensor network';
      }

      // Load tables
      try {
        const res = await fetch('/api/tables');
        const data = await res.json();
        const tables = data.tables;
        document.getElementById('m-tables').textContent = tables.length;

        let totalRecords = 0;
        let totalAnomalies = 0;
        const section = document.getElementById('table-status-section');
        section.innerHTML = '';

        for (const table of tables) {
          const statsRes = await fetch(`/api/stats/${table}`);
          const statsData = await statsRes.json();
          const rows = parseInt(statsData.total) || 0;
          totalRecords += rows;

          const anomRes = await fetch(`/api/anomalies/${table}`);
          const anomData = await anomRes.json();
          const anomCount = anomData.anomalies?.length || 0;
          totalAnomalies += anomCount;

          const health = Math.max(0, Math.round(100 - (anomCount * 15)));
          const healthColor = health >= 80 ? '#10b981' : health >= 50 ? '#f59e0b' : '#ef4444';
          const healthLabel = health >= 80 ? '✅ Healthy' : health >= 50 ? '⚠️ Monitor' : '🔴 Alert';

          const card = document.createElement('div');
          card.className = 'table-status-card';
          card.innerHTML = `
            <div class="table-status-header">
              <div class="table-name">📋 ${table}</div>
              <div class="status-pill ${health >= 80 ? 'safe' : health >= 50 ? 'warning' : 'danger'}">${healthLabel}</div>
            </div>
            <div style="font-size:0.85rem;color:var(--muted);margin-bottom:10px;">${rows.toLocaleString()} sensor records · ${anomCount} anomaly column${anomCount !== 1 ? 's' : ''} detected</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${health}%;background:${healthColor}"></div></div>
            <div class="progress-label"><span>Health Score</span><span style="color:${healthColor};font-weight:700">${health}%</span></div>
            ${statsData.stats?.slice(0,3).map(s => `
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-top:6px;padding:4px 0;border-top:1px solid rgba(255,255,255,0.04);">
                <span style="color:var(--muted)">${s.column}</span>
                <span>Avg: <strong>${s.avg}</strong> · Range: ${s.min}–${s.max}</span>
              </div>
            `).join('') || ''}
          `;
          section.appendChild(card);
        }

        document.getElementById('m-records').textContent = totalRecords > 999 ? (totalRecords/1000).toFixed(1)+'K' : totalRecords;
        const overallHealth = Math.max(0, Math.round(100 - (totalAnomalies * 10)));
        document.getElementById('m-health').textContent = overallHealth + '%';
        document.getElementById('m-health').style.color = overallHealth >= 70 ? '#10b981' : '#f59e0b';

        // Update banner
        document.getElementById('banner-desc').textContent = `Monitoring ${tables.length} sensor table${tables.length !== 1 ? 's' : ''} with ${totalRecords.toLocaleString()} total records. ${totalAnomalies > 0 ? `⚠️ ${totalAnomalies} anomaly columns detected — maintenance team notified.` : '✅ No anomalies detected.'}`;

        // Alert section
        if (totalAnomalies > 0) {
          document.getElementById('alert-section').innerHTML = `
            <div class="alert-banner" style="border-color:rgba(245,158,11,0.4);">
              <div class="ab-icon">⚠️</div>
              <div class="ab-text">
                <div class="ab-title">Maintenance Advisory</div>
                <div class="ab-desc">Our sensor network has flagged ${totalAnomalies} column${totalAnomalies !== 1 ? 's' : ''} with unusual readings. Maintenance teams have been notified. Train services may be affected. Please check individual train status below.</div>
              </div>
            </div>`;
        }

        // Generate train board based on tables
        const board = document.getElementById('train-board');
        const trainStatuses = tables.map((t, i) => {
          return { table: t, train: trainNames[i % trainNames.length], route: routes[i % routes.length], trainNum: `TRN-${String(i+101).padStart(3,'0')}` };
        });

        if (trainStatuses.length === 0) {
          board.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);">No train data available.</div>`;
        } else {
          board.innerHTML = '';
          for (const ts of trainStatuses) {
            const anomRes = await fetch(`/api/anomalies/${ts.table}`);
            const anomData = await anomRes.json();
            const anom = anomData.anomalies?.length || 0;
            const safe = anom === 0;
            const warn = anom <= 2;

            const card = document.createElement('div');
            card.className = 'train-card';
            const mins = Math.floor(Math.random() * 30) + 5;
            const delay = anom > 2 ? Math.floor(anom * 3) : 0;
            card.innerHTML = `
              <div class="train-no">${ts.trainNum}</div>
              <div class="train-info">
                <div class="train-route">${ts.train}</div>
                <div class="train-detail">${ts.route} · Sensor: ${ts.table}</div>
              </div>
              <div class="train-status">
                <div class="status-pill ${safe ? 'safe' : warn ? 'warning' : 'danger'}">${safe ? '✅ Safe' : warn ? '⚠️ Monitor' : '🔴 Alert'}</div>
                <div class="eta">${delay > 0 ? `⏱️ ~${delay} min delay` : `✓ On time · ${mins} min`}</div>
              </div>
            `;
            board.appendChild(card);
          }
        }

      } catch (e) {
        document.getElementById('table-status-section').innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center;">❌ Error loading data: ${e.message}</div>`;
      }
    }

    loadPassengerData();
    // Refresh every 30 seconds
    setInterval(loadPassengerData, 30000);
  