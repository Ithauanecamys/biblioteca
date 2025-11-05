const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Configurações do Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// CONEXÃO COM POSTGRESQL (Render ou local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/biblioteca',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Função principal: testa conexão e cria tabelas
async function iniciarBanco() {
  try {
    // Testa conexão
    await pool.query('SELECT NOW()');
    console.log('POSTGRESQL CONECTADO COM SUCESSO!');

    // Cria tabelas
    await criarTabelas();
  } catch (err) {
    console.error('ERRO AO CONECTAR AO BANCO:', err.stack);
    process.exit(1);
  }
}

// Cria tabelas automaticamente
async function criarTabelas() {
  try {
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
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE,
        data_emprestimo DATE
      );
    `);
    console.log('TABELAS CRIADAS OU JÁ EXISTEM!');
  } catch (err) {
    console.error('ERRO AO CRIAR TABELAS:', err.stack);
  }
}

// Inicia o banco
iniciarBanco();

// ROTA: Página de login
app.get('/login', (req, res) => {
  res.render('login');
});

// ROTA: Processar login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
    if (result.rows.length > 0) {
      const usuario = result.rows[0];
      if (usuario.tipo === 'admin') {
        res.redirect('/admin');
      } else {
        res.redirect('/usuario');
      }
    } else {
      res.send('Credenciais inválidas. <a href="/login">Voltar</a>');
    }
  } catch (err) {
    res.send('Erro no login: ' + err.message);
  }
});

// ROTA: Página do admin
app.get('/admin', async (req, res) => {
  try {
    const livros = await pool.query('SELECT * FROM livros');
    res.render('admin', { livros: livros.rows });
  } catch (err) {
    res.send('Erro: ' + err.message);
  }
});

// ROTA: Página do usuário
app.get('/usuario', async (req, res) => {
  try {
    const livros = await pool.query('SELECT * FROM livros WHERE disponivel = true');
    res.render('usuario', { livros: livros.rows });
  } catch (err) {
    res.send('Erro: ' + err.message);
  }
});

// ROTA TEMPORÁRIA: Cadastrar Admin (use apenas na primeira vez)
app.get('/cadastro-admin', (req, res) => {
  res.send(`
    <h2>Cadastrar Admin</h2>
    <form action="/cadastro-admin" method="POST">
      <input type="text" name="nome" placeholder="Nome" value="Admin" required><br><br>
      <input type="email" name="email" placeholder="Email" value="admin@biblio.com" required><br><br>
      <input type="password" name="senha" placeholder="Senha" value="123" required><br><br>
      <input type="text" name="tipo" placeholder="Tipo" value="admin" required><br><br>
      <button type="submit">Cadastrar Admin</button>
    </form>
    <br><a href="/login">Voltar ao Login</a>
  `);
});

app.post('/cadastro-admin', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  try {
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)',
      [nome, email, senha, tipo]
    );
    res.send('Admin cadastrado com sucesso! <a href="/login">Fazer login</a>');
  } catch (err) {
    if (err.code === '23505') {
      res.send('Erro: Este email já está cadastrado. <a href="/login">Fazer login</a>');
    } else {
      res.send('Erro: ' + err.message + ' <a href="/cadastro-admin">Tentar novamente</a>');
    }
  }
});

// INÍCIO DO SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});