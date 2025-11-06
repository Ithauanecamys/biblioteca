// db.js
const { Pool } = require('pg');

/**
 * Configuração da conexão com PostgreSQL (Render)
 * Usa DATABASE_URL do ambiente (Render fornece automaticamente)
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário no Render (SSL obrigatório)
  }
});

// === TESTE DE CONEXÃO ===
pool.on('connect', () => {
  console.log('Conectado ao banco de dados PostgreSQL (Render)');
});

pool.on('error', (err) => {
  console.error('Erro inesperado no banco:', err.stack);
});

// Exporta o pool diretamente (permite usar db.query e db.connect)
module.exports = pool;
