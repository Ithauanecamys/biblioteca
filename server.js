const express = require('express');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// better-sqlite3 com path fixo para Render
const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/database.db' : './database.db';

// Criar banco se não existir
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '');
}

const db = new Database(dbPath);

// Criar tabelas
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT UNIQUE,
      senha TEXT,
      tipo TEXT
    );
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      autor TEXT,
      ano INTEGER,
      disponivel INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS emprestimos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      livro_id INTEGER,
      data_emprestimo TEXT
    )
  `);
  console.log('Tabelas criadas com sucesso!');
} catch (err) {
  console.error('Erro ao criar tabelas:', err);
}

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
  const usuarios = db.prepare('SELECT * FROM usuarios').all();
  res.render('usuarios/listar', { usuarios });
});

app.get('/usuarios/cadastrar', auth, (req, res) => res.render('usuarios/cadastrar'));
app.post('/usuarios/cadastrar', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  try {
    db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(nome, email, senha, tipo);
    res.redirect('/usuarios?sessao=logado');
  } catch (err) {
    res.send('Erro ao cadastrar: ' + err.message);
  }
});

app.get('/usuarios/editar/:id', auth, (req, res) => {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  res.render('usuarios/editar', { usuario });
});

app.post('/usuarios/editar/:id', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  if (senha) {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, senha = ?, tipo = ? WHERE id = ?').run(nome, email, senha, tipo, req.params.id);
  } else {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, tipo = ? WHERE id = ?').run(nome, email, tipo, req.params.id);
  }
  res.redirect('/usuarios?sessao=logado');
});

app.get('/usuarios/excluir/:id', auth, (req, res) => {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.redirect('/usuarios?sessao=logado');
});

// LIVROS
app.get('/livros', auth, (req, res) => {
  const livros = db.prepare('SELECT * FROM livros').all();
  res.render('livros/listar', { livros });
});

app.get('/livros/cadastrar', auth, (req, res) => res.render('livros/cadastrar'));
app.post('/livros/cadastrar', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.prepare('INSERT INTO livros (titulo, autor, ano, disponivel) VALUES (?, ?, ?, 1)').run(titulo, autor, ano);
  res.redirect('/livros?sessao=logado');
});

app.get('/livros/editar/:id', auth, (req, res) => {
  const livro = db.prepare('SELECT * FROM livros WHERE id = ?').get(req.params.id);
  res.render('livros/editar', { livro });
});

app.post('/livros/editar/:id', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.prepare('UPDATE livros SET titulo = ?, autor = ?, ano = ? WHERE id = ?').run(titulo, autor, ano, req.params.id);
  res.redirect('/livros?sessao=logado');
});

app.get('/livros/excluir/:id', auth, (req, res) => {
  db.prepare('DELETE FROM livros WHERE id = ?').run(req.params.id);
  res.redirect('/livros?sessao=logado');
});

// EMPRÉSTIMOS
app.get('/emprestimos', auth, (req, res) => {
  const emprestimos = db.prepare(`
    SELECT e.id, u.nome as usuario, l.titulo as livro, e.data_emprestimo
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
  `).all();
  const usuarios = db.prepare('SELECT id, nome FROM usuarios').all();
  const livros = db.prepare('SELECT id, titulo FROM livros WHERE disponivel = 1').all();
  res.render('emprestimos/listar', { emprestimos, usuarios, livros });
});

app.post('/emprestimos/cadastrar', auth, (req, res) => {
  const { usuario_id, livro_id, data_emprestimo } = req.body;
  db.prepare('INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo) VALUES (?, ?, ?)').run(usuario_id, livro_id, data_emprestimo);
  db.prepare('UPDATE livros SET disponivel = 0 WHERE id = ?').run(livro_id);
  res.redirect('/emprestimos?sessao=logado');
});

app.get('/emprestimos/devolver/:id', auth, (req, res) => {
  const row = db.prepare('SELECT livro_id FROM emprestimos WHERE id = ?').get(req.params.id);
  if (row) {
    db.prepare('DELETE FROM emprestimos WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE livros SET disponivel = 1 WHERE id = ?').run(row.livro_id);
  }
  res.redirect('/emprestimos?sessao=logado');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/login`);
});
