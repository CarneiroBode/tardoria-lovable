// src/db/migrate.js — roda o schema.sql
// uso: node src/db/migrate.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('[migrate] Executando schema.sql...');
  await pool.query(sql);
  console.log('[migrate] ✅ Banco pronto!');
  await pool.end();
}

migrate().catch(err => {
  console.error('[migrate] ❌ Erro:', err.message);
  process.exit(1);
});
