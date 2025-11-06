// db.js
const { Pool } = require('pg');

// Configuração para Render E local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }  // Render: SSL obrigatório
    : false                          // Local: sem SSL
});

// Logs de conexão
pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Erro no banco:', err.stack);
});

module.exports = pool;
