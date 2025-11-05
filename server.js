// server.js
const express = require('express');
const path = require('path');
const pool = require('./db'); // ← IMPORTA O BANCO

const app = express();

// === CONFIGURAÇÕES ===
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// === ROTA RAIZ E LOGIN ===
app.get('/', (req, res) => {
  res.render('login', { erro: null });
});

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND senha = $2',
      [email, senha]
    );

    if (result.rows.length > 0) {
      res.redirect('/livros/listar'); // Página inicial após login
    } else {
      res.render('login', { erro: 'Email ou senha incorretos' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro interno: ' + err.message);
  }
});

// === ROTAS PARA LIVROS ===
app.get('/livros/listar', (req, res) => {
  res.render('livros/listar');
});

app.get('/livros/cadastrar', (req, res) => {
  res.render('livros/cadastrar');
});

app.get('/livros/editar', (req, res) => {
  res.render('livros/editar');
});

// === ROTAS PARA EMPRÉSTIMOS ===
app.get('/emprestimos/listar', (req, res) => {
  res.render('emprestimos/listar');
});

app.get('/emprestimos/cadastrar', (req, res) => {
  res.render('emprestimos/cadastrar');
});

// ROTA PARA EDITAR EMPRÉSTIMO
app.get('/emprestimos/editar', (req, res) => {
  res.render('emprestimos/editar');
});

// POST para salvar alterações no empréstimo
app.post('/emprestimos/editar', (req, res) => {
  // Aqui você salvaria no banco (depois!)
  res.redirect('/emprestimos/listar');
});

// === ROTAS PARA USUÁRIOS ===
app.get('/usuarios/listar', (req, res) => {
  res.render('usuarios/listar');
});

app.get('/usuarios/cadastrar', (req, res) => {
  res.render('usuarios/cadastrar');
});

app.get('/usuarios/editar', (req, res) => {
  res.render('usuarios/editar');
});

// === ROTA 404 ===
app.use((req, res) => {
  res.status(404).send('<h1>404 - Página não encontrada</h1><a href="/">Voltar ao login</a>');
});

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: https://biblioteca-mysql.onrender.com`);
});
