// db.js
const { Pool } = require('pg');

// Configuração da conexão com o PostgreSQL do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário para o Render
  }
});

// === FUNÇÃO PARA CRIAR TABELAS E DADOS INICIAIS ===
async function initDatabase() {
  try {
    console.log('Inicializando banco de dados...');

    // Tabela de Usuários
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL
      );
    `);

    // Tabela de Livros
    await pool.query(`
      CREATE TABLE IF NOT EXISTS livros (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        autor VARCHAR(100) NOT NULL,
        ano INTEGER,
        status VARCHAR(20) DEFAULT 'Disponível'
      );
    `);

    // Tabela de Empréstimos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emprestimos (
        id SERIAL PRIMARY KEY,
        livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        data_emprestimo DATE DEFAULT CURRENT_DATE,
        data_devolucao DATE
      );
    `);

    // Dados iniciais (só insere se não existirem)
    await pool.query(`
      INSERT INTO usuarios (nome, email, senha) 
      VALUES ('Admin', 'admin@biblio.com', '123') 
      ON CONFLICT (email) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO livros (titulo, autor, ano, status) VALUES 
      ('Dom Casmurro', 'Machado de Assis', 1899, 'Disponível'),
      ('1984', 'George Orwell', 1949, 'Emprestado'),
      ('O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 1943, 'Disponível')
      ON CONFLICT DO NOTHING;
    `);

    console.log('Tabelas criadas e dados iniciais inseridos com sucesso!');

  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err.message);
  }
}

// === EXECUTA A INICIALIZAÇÃO UMA VEZ ===
initDatabase();

// === TESTE DE CONEXÃO ===
pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL com sucesso!');
});

pool.on('error', (err) => {
  console.error('Erro na conexão com o banco:', err.message);
});

// Exporta o pool para usar no server.js
module.exports = pool;
