const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Banco SQLite (funciona 100% no Render)
let db;
if (process.env.NODE_ENV === 'production') {
  db = new sqlite3.Database('./database.db');
} else {
  db = new sqlite3.Database('./database.db');
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, email TEXT UNIQUE, senha TEXT, tipo TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS livros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT, autor TEXT, ano INTEGER, disponivel INTEGER DEFAULT 1
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS emprestimos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER, livro_id INTEGER, data_emprestimo TEXT
  )`);
  console.log('Tabelas criadas!');
});

// Auth simples
const auth = (req, res, next) => {
  if (req.query.sessao === 'logado') return next();
  res.redirect('/login');
};

// LOGIN
app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  if (req.body.email === 'admin@biblio.com' && req.body.senha === '123') {
    res.redirect('/usuarios?sessao=logado');
  } else {
    res.send('Login inválido. <a href="/login">Tentar novamente</a>');
  }
});

// USUÁRIOS
app.get('/usuarios', auth, (req, res) => {
  db.all('SELECT * FROM usuarios', (err, rows) => {
    res.render('usuarios/listar', { usuarios: rows || [] });
  });
});

app.get('/usuarios/cadastrar', auth, (req, res) => res.render('usuarios/cadastrar'));
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
  if (senha) {
    db.run('UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?',
      [nome, email, senha, tipo, req.params.id], () => res.redirect('/usuarios?sessao=logado'));
  } else {
    db.run('UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?',
      [nome, email, tipo, req.params.id], () => res.redirect('/usuarios?sessao=logado'));
  }
});

app.get('/usuarios/excluir/:id', auth, (req, res) => {
  db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id], () => {
    res.redirect('/usuarios?sessao=logado');
  });
});

// LIVROS
app.get('/livros', auth, (req, res) => {
  db.all('SELECT * FROM livros', (err, rows) => {
    res.render('livros/listar', { livros: rows || [] });
  });
});

app.get('/livros/cadastrar', auth, (req, res) => res.render('livros/cadastrar'));
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

// EMPRÉSTIMOS
app.get('/emprestimos', auth, (req, res) => {
  db.all(`
    SELECT e.id, u.nome as usuario, l.titulo as livro, e.data_emprestimo
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
  `, (err, emprestimos) => {
    db.all('SELECT id, nome FROM usuarios', (err, usuarios) => {
      db.all('SELECT id, titulo FROM livros WHERE disponivel = 1', (err, livros) => {
        res.render('emprestimos/listar', { 
          emprestimos: emprestimos || [], 
          usuarios: usuarios || [], 
          livros: livros || [] 
        });
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
    if (row) {
      db.run('DELETE FROM emprestimos WHERE id = ?', [req.params.id]);
      db.run('UPDATE livros SET disponivel = 1 WHERE id = ?', [row.livro_id]);
    }
    res.redirect('/emprestimos?sessao=logado');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/login`);
});
