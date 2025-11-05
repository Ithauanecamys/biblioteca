// db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão
pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL (Render)');
});

pool.on('error', (err) => {
  console.error('Erro no banco:', err);
});

module.exports = pool;
