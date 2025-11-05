// server.js
const express = require('express');
const path = require('path');
const pool = require('./db'); // ← IMPORTA O BANCO (com init automático)

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
app.get('/livros/listar', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM livros ORDER BY id');
    res.render('livros/listar', { livros: result.rows });
  } catch (err) {
    console.error('Erro ao carregar livros:', err);
    res.status(500).send('Erro ao carregar livros');
  }
});

app.get('/livros/cadastrar', (req, res) => {
  res.render('livros/cadastrar');
});

app.post('/livros/cadastrar', async (req, res) => {
  const { titulo, autor, ano, status } = req.body;
  try {
    await pool.query(
      'INSERT INTO livros (titulo, autor, ano, status) VALUES ($1, $2, $3, $4)',
      [titulo, autor, ano, status || 'Disponível']
    );
    res.redirect('/livros/listar');
  } catch (err) {
    console.error('Erro ao cadastrar livro:', err);
    res.status(500).send('Erro ao cadastrar livro');
  }
});

app.get('/livros/editar', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect('/livros/listar');

  try {
    const result = await pool.query('SELECT * FROM livros WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.render('livros/editar', { livro: result.rows[0] });
    } else {
      res.redirect('/livros/listar');
    }
  } catch (err) {
    console.error('Erro ao carregar livro para edição:', err);
    res.status(500).send('Erro ao carregar livro');
  }
});

app.post('/livros/editar', async (req, res) => {
  const { id, titulo, autor, ano, status } = req.body;
  try {
    await pool.query(
      'UPDATE livros SET titulo = $1, autor = $2, ano = $3, status = $4 WHERE id = $5',
      [titulo, autor, ano, status, id]
    );
    res.redirect('/livros/listar');
  } catch (err) {
    console.error('Erro ao editar livro:', err);
    res.status(500).send('Erro ao editar livro');
  }
});

// === ROTAS PARA USUÁRIOS ===
app.get('/usuarios/listar', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nome, email FROM usuarios ORDER BY id');
    res.render('usuarios/listar', { usuarios: result.rows });
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    res.status(500).send('Erro ao carregar usuários');
  }
});

app.get('/usuarios/cadastrar', (req, res) => {
  res.render('usuarios/cadastrar');
});

app.post('/usuarios/cadastrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)',
      [nome, email, senha]
    );
    res.redirect('/usuarios/listar');
  } catch (err) {
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).send('Erro ao cadastrar usuário');
  }
});

app.get('/usuarios/editar', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect('/usuarios/listar');

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.render('usuarios/editar', { usuario: result.rows[0] });
    } else {
      res.redirect('/usuarios/listar');
    }
  } catch (err) {
    console.error('Erro ao carregar usuário para edição:', err);
    res.status(500).send('Erro ao carregar usuário');
  }
});

app.post('/usuarios/editar', async (req, res) => {
  const { id, nome, email, senha } = req.body;
  try {
    if (senha && senha.trim() !== '') {
      await pool.query(
        'UPDATE usuarios SET nome = $1, email = $2, senha = $3 WHERE id = $4',
        [nome, email, senha, id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nome = $1, email = $2 WHERE id = $3',
        [nome, email, id]
      );
    }
    res.redirect('/usuarios/listar');
  } catch (err) {
    console.error('Erro ao editar usuário:', err);
    res.status(500).send('Erro ao editar usuário');
  }
});

// === ROTAS PARA EMPRÉSTIMOS (BÁSICO) ===
app.get('/emprestimos/listar', (req, res) => {
  res.render('emprestimos/listar');
});

app.get('/emprestimos/cadastrar', (req, res) => {
  res.render('emprestimos/cadastrar');
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
