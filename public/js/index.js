
    async function loadDashboard() {
      // Check DB health
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'connected') {
          document.getElementById('nav-db-status').textContent = 'DB Connected';
          document.getElementById('db-status-text').textContent = '✅ Connected — ' + new Date(data.time).toLocaleTimeString();
          document.getElementById('db-indicator').classList.remove('error');
        } else {
          throw new Error(data.error);
        }
      } catch (e) {
        document.getElementById('nav-db-status').textContent = 'DB Error';
        document.getElementById('db-status-text').innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span>`;
        document.getElementById('db-indicator').classList.add('error');
      }

      // Load tables
      try {
        const res = await fetch('/api/tables');
        const data = await res.json();
        const grid = document.getElementById('tables-grid');
        document.getElementById('stat-tables').textContent = data.tables.length;

        if (data.tables.length === 0) {
          grid.innerHTML = '<div style="color:var(--muted);padding:20px;">No tables found in database.</div>';
          return;
        }

        // Load row counts
        let totalRecords = 0;
        const cards = await Promise.all(data.tables.map(async t => {
          try {
            const sr = await fetch(`/api/stats/${t}`);
            const sd = await sr.json();
            totalRecords += parseInt(sd.total) || 0;
            return { name: t, rows: sd.total };
          } catch { return { name: t, rows: '?' }; }
        }));

        document.getElementById('stat-records').textContent = totalRecords.toLocaleString();
        grid.innerHTML = cards.map(c => `
          <div class="table-badge" onclick="window.location='/worker?table=${c.name}'">
            <div class="t-icon">📋</div>
            <div class="t-name">${c.name}</div>
            <div class="t-rows">${Number(c.rows).toLocaleString()} rows</div>
          </div>
        `).join('');
      } catch (e) {
        document.getElementById('tables-grid').innerHTML = `<div style="color:var(--red)">Failed to load tables: ${e.message}</div>`;
      }
    }

    loadDashboard();
  