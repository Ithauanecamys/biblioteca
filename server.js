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
      res.redirect('/livros/listar');
    } else {
      res.render('login', { erro: 'Email ou senha incorretos. Dica: admin@biblio.com / 123' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).render('login', { erro: 'Erro interno: ' + err.message });
  }
});

// === ROTAS PARA LIVROS ===
app.get('/livros/listar', (req, res) => {
  const livros = [
    { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', ano: 1899, status: 'Disponível' },
    { id: 2, titulo: '1984', autor: 'George Orwell', ano: 1949, status: 'Emprestado' },
    { id: 3, titulo: 'O Pequeno Príncipe', autor: 'Saint-Exupéry', ano: 1943, status: 'Disponível' }
  ];
  res.render('livros/listar', { livros });
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

app.get('/emprestimos/editar', (req, res) => {
  res.render('emprestimos/editar');
});

app.post('/emprestimos/cadastrar', (req, res) => {
  // Aqui você salvaria no banco (depois!)
  res.redirect('/emprestimos/listar');
});

app.post('/emprestimos/editar', (req, res) => {
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

app.post('/usuarios/cadastrar', (req, res) => {
  res.redirect('/usuarios/listar');
});

app.post('/usuarios/editar', (req, res) => {
  res.redirect('/usuarios/listar');
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
