const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// Configuração do MySQL (funciona no Render e local)
const db = mysql.createConnection({
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'biblioteca',
  port: process.env.MYSQLPORT || 3306
});

// Conectar
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar MySQL:', err);
    process.exit(1);
  }
  console.log('MySQL conectado com sucesso!');
  criarTabelas();
});

// Criar tabelas
function criarTabelas() {
  const sql = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100),
      email VARCHAR(100) UNIQUE,
      senha VARCHAR(50),
      tipo ENUM('leitor', 'admin')
    );
    CREATE TABLE IF NOT EXISTS livros (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(200),
      autor VARCHAR(100),
      ano INT,
      disponivel TINYINT DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS emprestimos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT,
      livro_id INT,
      data_emprestimo DATE,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY(livro_id) REFERENCES livros(id) ON DELETE CASCADE
    )
  `;
  db.query(sql, (err) => {
    if (err) console.error('Erro ao criar tabelas:', err);
    else console.log('Tabelas criadas ou já existem!');
  });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Auth
const auth = (req, res, next) => {
  if (req.query.sessao === 'logado') return next();
  res.redirect('/login');
};

// LOGIN
app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (email === 'admin@biblio.com' && senha === '123') {
    res.redirect('/usuarios?sessao=logado');
  } else {
    res.send('Login inválido. <a href="/login">Tentar novamente</a>');
  }
});

// USUÁRIOS
app.get('/usuarios', auth, (req, res) => {
  db.query('SELECT * FROM usuarios', (err, results) => {
    if (err) throw err;
    res.render('usuarios/listar', { usuarios: results });
  });
});

app.get('/usuarios/cadastrar', auth, (req, res) => res.render('usuarios/cadastrar'));
app.post('/usuarios/cadastrar', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  db.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
    [nome, email, senha, tipo], () => res.redirect('/usuarios?sessao=logado'));
});

app.get('/usuarios/editar/:id', auth, (req, res) => {
  db.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id], (err, results) => {
    res.render('usuarios/editar', { usuario: results[0] });
  });
});

app.post('/usuarios/editar/:id', auth, (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  const sql = senha ? 'UPDATE usuarios SET nome=?, email=?, senha=?, tipo=? WHERE id=?' 
                   : 'UPDATE usuarios SET nome=?, email=?, tipo=? WHERE id=?';
  const params = senha ? [nome, email, senha, tipo, req.params.id] : [nome, email, tipo, req.params.id];
  db.query(sql, params, () => res.redirect('/usuarios?sessao=logado'));
});

app.get('/usuarios/excluir/:id', auth, (req, res) => {
  db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id], () => {
    res.redirect('/usuarios?sessao=logado');
  });
});

// LIVROS
app.get('/livros', auth, (req, res) => {
  db.query('SELECT * FROM livros', (err, results) => {
    res.render('livros/listar', { livros: results });
  });
});

app.get('/livros/cadastrar', auth, (req, res) => res.render('livros/cadastrar'));
app.post('/livros/cadastrar', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.query('INSERT INTO livros (titulo, autor, ano) VALUES (?, ?, ?)',
    [titulo, autor, ano], () => res.redirect('/livros?sessao=logado'));
});

app.get('/livros/editar/:id', auth, (req, res) => {
  db.query('SELECT * FROM livros WHERE id = ?', [req.params.id], (err, results) => {
    res.render('livros/editar', { livro: results[0] });
  });
});

app.post('/livros/editar/:id', auth, (req, res) => {
  const { titulo, autor, ano } = req.body;
  db.query('UPDATE livros SET titulo=?, autor=?, ano=? WHERE id=?',
    [titulo, autor, ano, req.params.id], () => res.redirect('/livros?sessao=logado'));
});

app.get('/livros/excluir/:id', auth, (req, res) => {
  db.query('DELETE FROM livros WHERE id = ?', [req.params.id], () => {
    res.redirect('/livros?sessao=logado');
  });
});

// EMPRÉSTIMOS
app.get('/emprestimos', auth, (req, res) => {
  const query = `
    SELECT e.id, u.nome AS usuario, l.titulo AS livro, e.data_emprestimo
    FROM emprestimos e
    JOIN usuarios u ON e.usuario_id = u.id
    JOIN livros l ON e.livro_id = l.id
  `;
  db.query(query, (err, emprestimos) => {
    db.query('SELECT id, nome FROM usuarios', (err, usuarios) => {
      db.query('SELECT id, titulo FROM livros WHERE disponivel = 1', (err, livros) => {
        res.render('emprestimos/listar', { emprestimos, usuarios, livros });
      });
    });
  });
});

app.post('/emprestimos/cadastrar', auth, (req, res) => {
  const { usuario_id, livro_id, data_emprestimo } = req.body;
  db.query('INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo) VALUES (?, ?, ?)',
    [usuario_id, livro_id, data_emprestimo], () => {
      db.query('UPDATE livros SET disponivel = 0 WHERE id = ?', [livro_id]);
      res.redirect('/emprestimos?sessao=logado');
    });
});

app.get('/emprestimos/devolver/:id', auth, (req, res) => {
  db.query('SELECT livro_id FROM emprestimos WHERE id = ?', [req.params.id], (err, results) => {
    if (results.length > 0) {
      const livro_id = results[0].livro_id;
      db.query('DELETE FROM emprestimos WHERE id = ?', [req.params.id]);
      db.query('UPDATE livros SET disponivel = 1 WHERE id = ?', [livro_id]);
    }
    res.redirect('/emprestimos?sessao=logado');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}/login`);
});