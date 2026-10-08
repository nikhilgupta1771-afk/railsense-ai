const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '723403',
});

client.connect()
  .then(() => client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `))
  .then(res => {
    console.log('Tables in postgres database:');
    if (res.rows.length === 0) {
      console.log('  (No tables found)');
    } else {
      res.rows.forEach(r => console.log(' -', r.table_name));
    }
    client.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    client.end();
  });
