require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { PythonShell } = require('python-shell');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for hosting platforms (Render/Koyeb/Railway)
app.get('/healthz', (req, res) => res.status(200).send('OK'));

const JWT_SECRET = process.env.JWT_SECRET || 'railsense_secret_2024';

// ─── PostgreSQL Connection Pool ──────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '723403',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception caught:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection caught:', reason);
});

pool.on('error', (err) => {
  console.error('⚠️ Unexpected idle client error on PostgreSQL pool:', err.message);
});
pool.connect(async (err, client, done) => {
  if (err) { console.error('❌ PostgreSQL Connection Failed:', err.message); }
  else {
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10), ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP;');
      console.log('✅ PostgreSQL Connected and Users table verified for OTP');
    } catch (e) { console.error('❌ Failed to update table:', e.message); }
    done();
  }
});

// ─── Email Transporter ───────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. Please login.' });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (e) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, mobile } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: 'Username, password and email are required.' });
    const exists = await pool.query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Username or email already exists.' });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email, mobile) VALUES ($1,$2,$3,$4) RETURNING id, username, email',
      [username, hash, email, mobile || null]
    );
    res.status(201).json({ message: 'Registration successful!', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    username = username.trim();
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [username]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid username or password.' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, mobile: user.mobile } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Forgot Password (OTP Generation)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No account found with this email.' });
    
    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60000); // 15 mins

    await pool.query('UPDATE users SET otp_code=$1, otp_expires=$2 WHERE email=$3', [otpCode, expires, email]);

    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: '🚆 RailSense AI – Your Password Reset OTP',
        html: `<h2>Password Reset OTP</h2><p>Your one-time password is: <strong>${otpCode}</strong></p><p>This OTP will expire in 15 minutes.</p>`,
      });
      res.json({ message: 'OTP sent to your email.' });
    } else {
      console.log(`\n\n[DEV MODE] OTP for ${email}: ${otpCode}\n\n`);
      res.json({ message: 'OTP generated. Check server logs (SMTP not configured).' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset Password (OTP Verification)
app.post('/api/auth/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = result.rows[0];

    if (!user.otp_code || user.otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }
    if (new Date() > new Date(user.otp_expires)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1, otp_code=NULL, otp_expires=NULL WHERE email=$2', [hash, email]);
    res.json({ message: 'Password reset successful. Please login.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ALERTS API
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50');
    res.json({ alerts: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/alerts/acknowledge/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET acknowledged=true WHERE id=$1', [req.params.id]);
    res.json({ message: 'Alert acknowledged.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ML PREDICTION TRIGGER
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/predict', authenticateToken, async (req, res) => {
  try {
    PythonShell.run('ml_model/predict.py', { mode: 'json', args: [JSON.stringify(req.body)] }, async (err, results) => {
      if (err) return res.status(500).json({ error: 'ML model error: ' + err.message });
      const prediction = results && results[0] ? results[0] : {};
      if (prediction.alert_level && prediction.alert_level !== 'NORMAL') {
        const alertResult = await pool.query(
          'INSERT INTO alerts (train_id, alert_level, message, predicted_failure, confidence) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [prediction.train_id || 'UNKNOWN', prediction.alert_level, prediction.message, prediction.predicted_failure, prediction.confidence]
        );
        io.emit('maintenance_alert', alertResult.rows[0]);
      }
      res.json(prediction);
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  EXISTING SENSOR API (now protected)
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/tables', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`);
    res.json({ tables: result.rows.map(r => r.table_name) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/schema/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const result = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position;`, [table]);
    res.json({ table, columns: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/data/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`SELECT * FROM "${table}" LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ table, total, data: result.rows, columns: result.fields.map(f => f.name) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sensor/latest/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const schemaResult = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`, [table]);
    const cols = schemaResult.rows;
    const timeCol = cols.find(c => c.data_type.includes('timestamp') || c.column_name.toLowerCase().includes('time') || c.column_name.toLowerCase().includes('date') || c.column_name.toLowerCase().includes('created'));
    let query = timeCol ? `SELECT * FROM "${table}" ORDER BY "${timeCol.column_name}" DESC LIMIT 50` : `SELECT * FROM "${table}" LIMIT 50`;
    const result = await pool.query(query);
    res.json({ data: result.rows, columns: result.fields.map(f => f.name), timeColumn: timeCol?.column_name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT DISTINCT vendor_device_id FROM "SENSOR_SIGNAL_DATA" WHERE vendor_device_id IS NOT NULL`);
    res.json({ devices: result.rows.map(r => r.vendor_device_id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/device/:vendor_device_id', authenticateToken, async (req, res) => {
  try {
    const { vendor_device_id } = req.params;
    const limit = parseInt(req.query.limit) || 200;
    const result = await pool.query(`
      SELECT * 
      FROM "SENSOR_SIGNAL_DATA" 
      WHERE vendor_device_id = $1 
      ORDER BY time DESC 
      LIMIT $2
    `, [vendor_device_id, limit]);
    // Get numeric column names for charting
    const numericCols = [];
    if (result.fields) {
      const numericOids = [20,21,23,26,700,701,790,1700]; // pg numeric type OIDs
      result.fields.forEach(f => {
        if (numericOids.includes(f.dataTypeID)) numericCols.push(f.name);
      });
    }
    res.json({ vendor_device_id, data: result.rows.reverse(), numericColumns: numericCols, columns: result.fields ? result.fields.map(f => f.name) : [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health_status', authenticateToken, async (req, res) => {
  try {
    // Get latest row for each device
    const result = await pool.query(`
      SELECT DISTINCT ON (vendor_device_id) *
      FROM "SENSOR_SIGNAL_DATA"
      WHERE vendor_device_id IS NOT NULL
      ORDER BY vendor_device_id, time DESC
    `);
    
    const devicesHealth = result.rows.map(row => {
      let status = 'Good';
      let issues = [];
      let isCritical = false;
      let isPoor = false;

      // Helper to check range
      const checkParam = (val, min, max, name) => {
        if (val === null || val === undefined) return;
        const v = parseFloat(val);
        if (isNaN(v)) return;
        
        if (v < min || v > max) {
          isCritical = true;
          issues.push(`${name} is strictly out of range (${v} vs ${min}-${max})`);
        } else {
          // Check if near edge (within 5% of range spread)
          const range = max - min;
          const margin = range * 0.05;
          if (v < min + margin || v > max - margin) {
            isPoor = true;
            issues.push(`${name} is poor/near edge (${v} vs ${min}-${max})`);
          }
        }
      };

      // Main Signals (Red, Yellow, Green, Double Yellow)
      checkParam(row.vrg, 82.5, 137.5, 'Red Signal Voltage (vrg)');
      checkParam(row.irg, 112, 154, 'Red Signal Current (irg)');
      checkParam(row.vhg, 82.5, 137.5, 'Yellow Signal Voltage (vhg)');
      checkParam(row.ihg, 112, 154, 'Yellow Signal Current (ihg)');
      checkParam(row.vdg, 82.5, 137.5, 'Green Signal Voltage (vdg)');
      checkParam(row.idg, 112, 154, 'Green Signal Current (idg)');
      checkParam(row.vhhg, 82.5, 137.5, 'Double Yellow Voltage (vhhg)');
      checkParam(row.ihhg, 112, 154, 'Double Yellow Current (ihhg)');

      // Calling On
      checkParam(row.vaug, 88, 132, 'Calling On Voltage (vaug)');
      checkParam(row.iaug, 120, 165, 'Calling On Current (iaug)');

      // Shunt OFF
      checkParam(row.voff, 88, 132, 'Shunt OFF Voltage (voff)');
      checkParam(row.ioff, 52.25, 57.75, 'Shunt OFF Current (ioff)');
      
      // Determine final status
      if (isCritical) status = 'Critical';
      else if (isPoor) status = 'Poor';

      return {
        vendor_device_id: row.vendor_device_id,
        name: row.vendor_device_name || row.vendor_device_id,
        stn: row.stn,
        time: row.time,
        status,
        issues
      };
    });

    const summary = {
      total: devicesHealth.length,
      Good: devicesHealth.filter(d => d.status === 'Good').length,
      Poor: devicesHealth.filter(d => d.status === 'Poor').length,
      Critical: devicesHealth.filter(d => d.status === 'Critical').length
    };

    res.json({ summary, devices: devicesHealth });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const schemaResult = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`, [table]);
    const numericCols = schemaResult.rows.filter(c => ['integer','bigint','smallint','decimal','numeric','real','double precision','float'].includes(c.data_type));
    if (numericCols.length === 0) {
      const countRes = await pool.query(`SELECT COUNT(*) as total FROM "${table}"`);
      return res.json({ total: countRes.rows[0].total, stats: [] });
    }
    const statExpressions = numericCols.map(c =>
      `MIN("${c.column_name}") as "${c.column_name}_min", MAX("${c.column_name}") as "${c.column_name}_max", ROUND(AVG("${c.column_name}")::numeric,2) as "${c.column_name}_avg", ROUND(STDDEV("${c.column_name}")::numeric,2) as "${c.column_name}_std"`
    ).join(',\n');
    const countRes = await pool.query(`SELECT COUNT(*) as total FROM "${table}"`);
    const statsRes = await pool.query(`SELECT ${statExpressions} FROM "${table}"`);
    const stats = numericCols.map(c => ({ column: c.column_name, min: statsRes.rows[0][`${c.column_name}_min`], max: statsRes.rows[0][`${c.column_name}_max`], avg: statsRes.rows[0][`${c.column_name}_avg`], std: statsRes.rows[0][`${c.column_name}_std`] }));
    res.json({ total: parseInt(countRes.rows[0].total), stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/anomalies/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const schemaResult = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`, [table]);
    const numericCols = schemaResult.rows.filter(c => ['integer','bigint','smallint','decimal','numeric','real','double precision','float'].includes(c.data_type));
    if (numericCols.length === 0) return res.json({ anomalies: [], message: 'No numeric columns found' });
    const anomalyResults = [];
    for (const col of numericCols.slice(0, 5)) {
      const statsRes = await pool.query(`SELECT AVG("${col.column_name}") as mean, STDDEV("${col.column_name}") as std FROM "${table}"`);
      const { mean, std } = statsRes.rows[0];
      if (!mean || !std || parseFloat(std) === 0) continue;
      const anomRes = await pool.query(`SELECT *, ABS(("${col.column_name}"::numeric - $1::numeric) / $2::numeric) as z_score FROM "${table}" WHERE ABS(("${col.column_name}"::numeric - $1::numeric) / $2::numeric) > 3 LIMIT 20`, [mean, std]);
      if (anomRes.rows.length > 0) anomalyResults.push({ column: col.column_name, count: anomRes.rows.length, samples: anomRes.rows.slice(0, 5) });
    }
    res.json({ anomalies: anomalyResults, total_anomaly_columns: anomalyResults.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({ status: 'connected', time: result.rows[0].time, version: result.rows[0].version });
  } catch (err) { res.status(500).json({ status: 'disconnected', error: err.message }); }
});

// ─── Serve Frontend Pages ─────────────────────────────────────────────────────
app.get('/worker',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'worker.html')));
app.get('/passenger', (req, res) => res.sendFile(path.join(__dirname, 'public', 'passenger.html')));
app.get('/device',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'device.html')));
app.get('/health',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'health.html')));
app.get('/login',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/forgot',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot.html')));
app.get('/reset',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset.html')));
app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/train3d',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'train3d.html')));

// ─── Socket.IO ───────────────────────────────────────────────────────────────
let activeTable = null;
let activeDevices = new Set();
io.on('connection', socket => {
  console.log('🔌 Client connected:', socket.id);
  socket.on('set_table', t => { activeTable = t; });
  socket.on('subscribe_device', deviceId => {
    socket.join(`device_${deviceId}`);
    activeDevices.add(deviceId);
    console.log(`🔌 Client ${socket.id} subscribed to device ${deviceId}`);
  });
  socket.on('unsubscribe_device', deviceId => {
    socket.leave(`device_${deviceId}`);
  });
  socket.on('disconnect', () => console.log('🔌 Disconnected:', socket.id));
});

setInterval(async () => {
  if (activeTable) {
    try {
      const result = await pool.query(`SELECT * FROM "${activeTable}" LIMIT 20`);
      io.emit('sensor_update', { table: activeTable, data: result.rows, timestamp: new Date() });
    } catch (e) {}
  }
  
  if (activeDevices.size > 0) {
    for (let deviceId of activeDevices) {
      try {
        const result = await pool.query(`
          SELECT * 
          FROM "SENSOR_SIGNAL_DATA" 
          WHERE vendor_device_id = $1 
          ORDER BY time DESC 
          LIMIT 1
        `, [deviceId]);
        if (result.rows.length > 0) {
          io.to(`device_${deviceId}`).emit('device_update', { vendor_device_id: deviceId, data: result.rows[0], timestamp: new Date() });
        }
      } catch (e) {}
    }
  }
}, 5000);

// ─── Periodic ML Inference (every 60s) ──────────────────────────────────────
setInterval(() => {
  try {
    PythonShell.run('ml_model/inference.py', { mode: 'json' }, async (err, results) => {
      if (err || !results || !results[0]) return;
      const preds = Array.isArray(results[0]) ? results[0] : [results[0]];
      for (const p of preds) {
        if (p.alert_level && p.alert_level !== 'NORMAL') {
          try {
            const alertResult = await pool.query(
              'INSERT INTO alerts (train_id, alert_level, message, predicted_failure, confidence) VALUES ($1,$2,$3,$4,$5) RETURNING *',
              [p.train_id || 'SENSOR', p.alert_level, p.message || 'Anomaly detected', p.predicted_failure || 'Unknown', p.confidence || 0]
            );
            io.emit('maintenance_alert', alertResult.rows[0]);
            console.log('🚨 Alert emitted:', alertResult.rows[0]);
          } catch (e) {}
        }
      }
    });
  } catch (err) {
    // Gracefully handle environments without python binary
  }
}, 60000);



// ─── 3D Digital Twin Live Telemetry Stream ───────────────────────────────────
setInterval(async () => {
  try {
    // 1. Fetch live metrics from your PostgreSQL sensor tables
    // NOTE: Change 'gear_sensors', 'oil_sensors', and 'wheel_sensors' to match your actual table names if different!
    const gearQuery = await pool.query('SELECT temperature, vibration, status FROM gear_sensors ORDER BY id DESC LIMIT 1').catch(() => ({ rows: [] }));
    const oilQuery = await pool.query('SELECT fluid_level, status FROM oil_sensors ORDER BY id DESC LIMIT 1').catch(() => ({ rows: [] }));
    const wheelQuery = await pool.query('SELECT rpm, wear_index, status FROM wheel_sensors ORDER BY id DESC LIMIT 1').catch(() => ({ rows: [] }));

    // 2. Fallback values if database queries return empty or tables don't exist yet
    const gearData = gearQuery.rows[0] || { temperature: 62, vibration: 1.4, status: 'NOMINAL' };
    const oilData = oilQuery.rows[0] || { fluid_level: 88, status: 'NOMINAL' };
    const wheelData = wheelQuery.rows[0] || { rpm: 840, wear_index: 0.12, status: 'NOMINAL' };

    // 3. Package data into the exact structural format train3d.js expects
    const telemetryPayload = {
      train_id: "RS-EXPRESS-302",
      timestamp: new Date().toLocaleTimeString(),
      components: {
        gears: {
          status: String(gearData.status).toUpperCase(), // 'NOMINAL', 'WARNING', or 'CRITICAL'
          temperature: parseFloat(gearData.temperature) || 60,
          vibration: parseFloat(gearData.vibration) || 1.2
        },
        oil: {
          status: String(oilData.status).toUpperCase(),
          level: parseInt(oilData.fluid_level) || 85
        },
        wheels: {
          status: String(wheelData.status).toUpperCase(),
          rpm: parseInt(wheelData.rpm) || 800,
          wear_index: parseFloat(wheelData.wear_index) || 0.1
        }
      }
    };

    // 4. Broadcast live out to the WebGL 3D user viewport canvas
    io.emit('telemetry_update', telemetryPayload);

  } catch (error) {
    console.error('❌ 3D Digital Twin pipeline error:', error.message);
  }
}, 3000); // Updates every 3 seconds
// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚆 RailSense AI`);
  console.log(`🌐  http://0.0.0.0:${PORT}`);
  console.log(`🔐  Login: http://localhost:${PORT}/login`);
  console.log(`👷  Worker: http://localhost:${PORT}/worker`);
  console.log(`👥  Passenger: http://localhost:${PORT}/passenger\n`);
  console.log(`👥  train3d: http://localhost:${PORT}/train3d\n`);
});
