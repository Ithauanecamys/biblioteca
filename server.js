// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// Configurações
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Banco de dados
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error(err);
  console.log('Banco de dados conectado!');
});

// Criar tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE,
      senha TEXT,
      tipo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      autor TEXT,
      ano INTEGER,
      disponivel INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS emprestimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      livro_id INTEGER,
      data_emprestimo TEXT,
      data_devolucao TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY(livro_id) REFERENCES livros(id)
    )
  `);
});

// Middleware de autenticação simples
const auth = (req, res, next) => {
  if (req.query.sessao === 'logado') {
    next();
  } else {
    res.redirect('/login');
  }
};

// ROTAS
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (email === 'admin@biblio.com' && senha === '123') {
    res.redirect('/usuarios?sessao=logado');
  } else {
    res.send('Login inválido. <a href="/login">Tentar novamente</a>');
  }
});

// === CADASTRO 1: USUÁRIOS ===
app.get('/usuarios', auth, (req, res) => {
  db.all('SELECT * FROM usuarios', (err, rows) => {
    res.render('usuarios/listar', { usuarios: rows });
  });
});

app.get('/usuarios/cadastrar', auth, (req, res) => {
  res.render('usuarios/cadastrar');
});

app.post('/usuarios/cadastrar', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  db.run('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
    [nome, email, senha, tipo], () => res.redirect('/usuarios?sessao=logado'));
});

app.get('/usuarios/editar/:id', auth, (req, res) => {
  db.get('SELECT * FROM usuarios WHERE id = ?', [req.params.id], (err, row) => {
    res.render('usuarios/editar', { usuario: row });
  });
});

app.post('/usuarios/editar/:id', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  db.run('UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?',
    [nome, email, senha, tipo, req.params.id], () => res.redirect('/usuarios?sessao=logado'));
});

app.get('/usuarios/excluir/:id', auth, (req, res) => {
  db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id], () => {
    res.redirect('/usuarios?sessao=logado');
  });
});

// === CADASTRO 2: LIVROS ===
app.get('/livros', auth, (req, res) => {
  db.all('SELECT * FROM livros', (err, rows) => {
    res.render('livros/listar', { livros: rows });
  });
});

app.get('/livros/cadastrar', auth, (req, res) => {
  res.render('livros/cadastrar');
});

app.post('/livros/cadastrar', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.run('INSERT INTO livros (titulo, autor, ano, disponivel) VALUES (?, ?, ?, 1)',
    [titulo, autor, ano], () => res.redirect('/livros?sessao=logado'));
});

app.get('/livros/editar/:id', auth, (req, res) => {
  db.get('SELECT * FROM livros WHERE id = ?', [req.params.id], (err, row) => {
    res.render('livros/editar', { livro: row });
  });
});

app.post('/livros/editar/:id', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.run('UPDATE livros SET titulo=?, autor=?, ano=? WHERE id=?',
    [titulo, autor, ano, req.params.id], () => res.redirect('/livros?sessao=logado'));
});

app.get('/livros/excluir/:id', auth, (req, res) => {
  db.run('DELETE FROM livros WHERE id = ?', [req.params.id], () => {
    res.redirect('/livros?sessao=logado');
  });
});

// === CADASTRO 3: EMPRÉSTIMOS ===
app.get('/emprestimos', auth, (req, res) => {
  db.all(`
    SELECT e.id, u.nome as usuario, l.titulo as livro, e.data_emprestimo, e.data_devolucao
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
  `, (err, rows) => {
    db.all('SELECT id, nome FROM usuarios', (err, usuarios) => {
      db.all('SELECT id, titulo FROM livros WHERE disponivel = 1', (err, livros) => {
        res.render('emprestimos/listar', { emprestimos: rows, usuarios, livros });
      });
    });
  });
});

app.post('/emprestimos/cadastrar', auth, (req, res) => {
  const { usuario_id, livro_id, data_emprestimo } = req.body;
  db.run('INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo) VALUES (?, ?, ?)',
    [usuario_id, livro_id, data_emprestimo], () => {
      db.run('UPDATE livros SET disponivel = 0 WHERE id = ?', [livro_id]);
      res.redirect('/emprestimos?sessao=logado');
    });
});

app.get('/emprestimos/devolver/:id', auth, (req, res) => {
  db.get('SELECT livro_id FROM emprestimos WHERE id = ?', [req.params.id], (err, row) => {
    db.run('DELETE FROM emprestimos WHERE id = ?', [req.params.id]);
    db.run('UPDATE livros SET disponivel = 1 WHERE id = ?', [row.livro_id]);
    res.redirect('/emprestimos?sessao=logado');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/login`);
});