const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qrYK1cLPX0ON@ep-blue-queen-b3cxb93c-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    console.log('Connecting to Neon...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(20),
        otp_code VARCHAR(10),
        otp_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        train_id VARCHAR(100),
        alert_level VARCHAR(50),
        message TEXT,
        predicted_failure TEXT,
        confidence FLOAT,
        acknowledged BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ alerts table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS SENSOR_SIGNAL_DATA (
        sl_no BIGINT,
        zone_code VARCHAR(50),
        div_code VARCHAR(50),
        section VARCHAR(100),
        location VARCHAR(100),
        vendor_device_id TEXT,
        vendor_device_name VARCHAR(100),
        vendor_device_label VARCHAR(200),
        vendor_code VARCHAR(50),
        smms_asset_code VARCHAR(100),
        loc VARCHAR(10),
        ver VARCHAR(10),
        time TIMESTAMP,
        stn VARCHAR(50),
        name VARCHAR(100),
        date DATE,
        rssi NUMERIC,
        eventtype NUMERIC,
        temp NUMERIC,
        rh NUMERIC,
        geartype VARCHAR(50),
        subgear VARCHAR(50),
        parent_device VARCHAR(100),
        ihg NUMERIC,
        vrg NUMERIC,
        vhg NUMERIC,
        irg NUMERIC,
        idg NUMERIC,
        vdg NUMERIC,
        vhhg NUMERIC,
        ihhg NUMERIC,
        vs NUMERIC,
        vrr NUMERIC,
        is_val NUMERIC,
        document JSONB,
        comm VARCHAR(50),
        counter NUMERIC,
        ioff NUMERIC,
        ion NUMERIC,
        ipl NUMERIC,
        pl NUMERIC,
        shpr NUMERIC,
        voff NUMERIC,
        von NUMERIC,
        iaug NUMERIC,
        vaug NUMERIC
      );
    `);
    console.log('✅ SENSOR_SIGNAL_DATA table created');

    const result = await pool.query('SELECT COUNT(*) FROM users');
    console.log('✅ Connection verified. Users count:', result.rows[0].count);
    
    console.log('\n🎉 All tables created successfully on Neon!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setup();
