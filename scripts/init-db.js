require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.end();
  console.log('Neon schema initialized.');
}

init().catch(async error => {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
