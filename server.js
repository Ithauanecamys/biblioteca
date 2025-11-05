// server.js
const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();

// Configs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === INICIAR BANCO ===
async function initDB() {
  const client = await db.connect();
  try {
    console.log('Iniciando configuração do banco...');

    // 1. Criar tabelas (se não existirem)
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      );

      CREATE TABLE IF NOT EXISTS livros (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        autor VARCHAR(100) NOT NULL,
        ano INTEGER
      );

      CREATE TABLE IF NOT EXISTS emprestimos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE,
        data_emprestimo DATE DEFAULT CURRENT_DATE
      );
    `);

    // 2. Adicionar colunas faltantes (se não existirem)
    await client.query(`
      ALTER TABLE livros ADD COLUMN IF NOT EXISTS exemplares INTEGER DEFAULT 1;
      ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS data_devolucao DATE;
    `);

    console.log('Tabelas e colunas verificadas/criadas com sucesso.');

    // 3. Criar admin padrão
    const admin = await client.query('SELECT * FROM usuarios WHERE email = $1', ['admin@biblio.com']);
    if (admin.rows.length === 0) {
      await client.query(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)',
        ['Admin', 'admin@biblio.com', '123', 'admin']
      );
      console.log('Admin criado: admin@biblio.com / 123');
    }
  } catch (err) {
    console.error('Erro ao configurar banco:', err);
  } finally {
    client.release();
  }
}
initDB();

// === ROTAS ===

// Login
app.get('/', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
    if (result.rows.length > 0) {
      res.render('dashboard', { usuario: result.rows[0] });
    } else {
      res.render('login', { erro: 'Email ou senha inválidos' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.render('login', { erro: 'Erro no servidor' });
  }
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.render('dashboard', { usuario: { nome: 'Visitante' } });
});

// === USUÁRIOS ===
app.get('/usuarios', async (req, res) => {
  const result = await db.query('SELECT * FROM usuarios ORDER BY id');
  res.render('usuarios/lista', { usuarios: result.rows });
});

app.get('/usuarios/novo', (req, res) => {
  res.render('usuarios/form', { usuario: {}, action: '/usuarios' });
});

app.post('/usuarios', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  await db.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)', [nome, email, senha, tipo || 'usuario']);
  res.redirect('/usuarios');
});

app.get('/usuarios/editar/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
  res.render('usuarios/form', { usuario: result.rows[0], action: `/usuarios/${req.params.id}` });
});

app.post('/usuarios/:id', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  await db.query('UPDATE usuarios SET nome=$1, email=$2, senha=$3, tipo=$4 WHERE id=$5', [nome, email, senha, tipo, req.params.id]);
  res.redirect('/usuarios');
});

app.post('/usuarios/excluir/:id', async (req, res) => {
  await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  res.redirect('/usuarios');
});

// === LIVROS ===
app.get('/livros', async (req, res) => {
  const result = await db.query('SELECT * FROM livros');
  res.render('livros/lista', { livros: result.rows });
});

app.get('/livros/novo', (req, res) => {
  res.render('livros/form', { livro: {}, action: '/livros' });
});

app.post('/livros', async (req, res) => {
  const { titulo, autor, ano, exemplares } = req.body;
  await db.query('INSERT INTO livros (titulo, autor, ano, exemplares) VALUES ($1, $2, $3, $4)', [titulo, autor, ano || null, exemplares || 1]);
  res.redirect('/livros');
});

app.get('/livros/editar/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM livros WHERE id = $1', [req.params.id]);
  res.render('livros/form', { livro: result.rows[0], action: `/livros/${req.params.id}` });
});

app.post('/livros/:id', async (req, res) => {
  const { titulo, autor, ano, exemplares } = req.body;
  await db.query('UPDATE livros SET titulo=$1, autor=$2, ano=$3, exemplares=$4 WHERE id=$5', [titulo, autor, ano, exemplares, req.params.id]);
  res.redirect('/livros');
});

app.post('/livros/excluir/:id', async (req, res) => {
  await db.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
  res.redirect('/livros');
});

// === EMPRÉSTIMOS ===
app.get('/emprestimos', async (req, res) => {
  const emprestimos = await db.query(`
    SELECT e.id, u.nome AS usuario_nome, l.titulo AS livro_titulo, e.data_emprestimo, e.data_devolucao
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
    ORDER BY e.id
  `);
  const usuarios = await db.query('SELECT id, nome FROM usuarios');
  const livros = await db.query('SELECT id, titulo, exemplares FROM livros WHERE exemplares > 0');
  res.render('emprestimos/lista', {
    emprestimos: emprestimos.rows,
    usuarios: usuarios.rows,
    livros: livros.rows
  });
});

app.post('/emprestimos', async (req, res) => {
  const { usuario_id, livro_id } = req.body;
  const livro = await db.query('SELECT exemplares FROM livros WHERE id = $1', [livro_id]);
  if (livro.rows[0] && livro.rows[0].exemplares > 0) {
    await db.query('INSERT INTO emprestimos (usuario_id, livro_id) VALUES ($1, $2)', [usuario_id, livro_id]);
    await db.query('UPDATE livros SET exemplares = exemplares - 1 WHERE id = $1', [livro_id]);
  }
  res.redirect('/emprestimos');
});

app.post('/emprestimos/devolver/:id', async (req, res) => {
  const emp = await db.query('SELECT livro_id FROM emprestimos WHERE id = $1', [req.params.id]);
  if (emp.rows.length > 0) {
    await db.query('UPDATE emprestimos SET data_devolucao = CURRENT_DATE WHERE id = $1', [req.params.id]);
    await db.query('UPDATE livros SET exemplares = exemplares + 1 WHERE id = $1', [emp.rows[0].livro_id]);
  }
  res.redirect('/emprestimos');
});

app.post('/emprestimos/excluir/:id', async (req, res) => {
  const emp = await db.query('SELECT livro_id FROM emprestimos WHERE id = $1', [req.params.id]);
  await db.query('DELETE FROM emprestimos WHERE id = $1', [req.params.id]);
  if (emp.rows.length > 0) {
    await db.query('UPDATE livros SET exemplares = exemplares + 1 WHERE id = $1', [emp.rows[0].livro_id]);
  }
  res.redirect('/emprestimos');
});

// Iniciar
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
