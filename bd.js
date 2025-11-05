// db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão
pool.connect((err) => {
  if (err) {
    console.error('Erro ao conectar no PostgreSQL:', err.stack);
  } else {
    console.log('Conectado ao PostgreSQL com sucesso!');
  }
});

module.exports = pool;
