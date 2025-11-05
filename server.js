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

// === ROTAS ESTÁTICAS ===
app.get('/', (req, res) => {
  res.render('login', { erro: null });
});

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

// === ROTA DE LOGIN (EXATAMENTE COMO VOCÊ PEDIU) ===
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND senha = $2',
      [email, senha]
    );

    if (result.rows.length > 0) {
      res.redirect('/livros/listar'); // ou a página que você quiser
    } else {
      res.render('login', { erro: 'Email ou senha incorretos' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).send('Erro interno: ' + err.message);
  }
});

// === OUTRAS ROTAS (se você tiver arquivos separados) ===
// Exemplo: se tiver routes/livros.js
// const livrosRouter = require('./routes/livros');
// app.use('/livros', livrosRouter);

// === ROTA 404 ===
app.use((req, res) => {
  res.status(404).send('<h1>404 - Página não encontrada</h1>');
});

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: https://biblioteca-mysql.onrender.com`);
});

