const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
  if (err) {
    console.error('ERRO POSTGRES:', err);
    process.exit(1);
  }
  console.log('POSTGRESQL CONECTADO!');
  criarTabelas();
});

async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(100),
      email VARCHAR(100) UNIQUE,
      senha VARCHAR(50),
      tipo VARCHAR(20)
    );
    CREATE TABLE IF NOT EXISTS livros (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(200),
      autor VARCHAR(100),
      ano INTEGER,
      disponivel BOOLEAN DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS emprestimos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      livro_id INTEGER REFERENCES livros(id),
      data_emprestimo DATE
    );
  `);
}

const auth = (req, res, next) => {
  if (req.query.sessao === 'logado') return next();
  res.redirect('/login');
};

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  if (req.body.email === 'admin@biblio.com' && req.body.senha === '123') {
    res.redirect('/usuarios?sessao=logado');
  } else {
    res.send('Login inválido. <a href="/login">Voltar</a>');
  }
});

app.get('/usuarios', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios');
  res.render('usuarios/listar', { usuarios: rows });
});

app.post('/usuarios/cadastrar', auth, async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  await pool.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)', [nome, email, senha, tipo]);
  res.redirect('/usuarios?sessao=logado');
});

app.get('/livros', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM livros');
  res.render('livros/listar', { livros: rows });
});

app.post('/livros/cadastrar', auth, async (req, res) => {
  const { titulo, autor, ano } = req.body;
  await pool.query('INSERT INTO livros (titulo, autor, ano) VALUES ($1, $2, $3)', [titulo, autor, ano]);
  res.redirect('/livros?sessao=logado');
});

app.get('/emprestimos', auth, async (req, res) => {
  const emprestimos = await pool.query(`
    SELECT e.id, u.nome AS usuario, l.titulo AS livro, e.data_emprestimo,
           e.data_emprestimo + INTERVAL '30 days' AS data_devolucao,
           CASE WHEN CURRENT_DATE > (e.data_emprestimo + INTERVAL '30 days') 
             THEN EXTRACT(DAY FROM (CURRENT_DATE - (e.data_emprestimo + INTERVAL '30 days'))) * 3.90
             ELSE 0 END AS multa
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
  `);
  const usuarios = await pool.query('SELECT id, nome FROM usuarios');
  const livros = await pool.query('SELECT id, titulo, disponivel FROM livros');
  res.render('emprestimos/listar', { 
    emprestimos: emprestimos.rows, 
    usuarios: usuarios.rows, 
    livros: livros.rows 
  });
});

app.post('/emprestimos/cadastrar', auth, async (req, res) => {
  const { usuario_id, livro_id, data_emprestimo } = req.body;
  const livro = await pool.query('SELECT disponivel FROM livros WHERE id = $1', [livro_id]);
  if (livro.rows[0]?.disponivel) {
    await pool.query('INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo) VALUES ($1, $2, $3)', [usuario_id, livro_id, data_emprestimo]);
    await pool.query('UPDATE livros SET disponivel = false WHERE id = $1', [livro_id]);
  }
  res.redirect('/emprestimos?sessao=logado');
});

app.get('/emprestimos/devolver/:id', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT livro_id FROM emprestimos WHERE id = $1', [req.params.id]);
  if (rows.length > 0) {
    await pool.query('DELETE FROM emprestimos WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE livros SET disponivel = true WHERE id = $1', [rows[0].livro_id]);
  }
  res.redirect('/emprestimos?sessao=logado');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor rodando!');
});
Trocar para PostgreSQL + multa 30 dias
