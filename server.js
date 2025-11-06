// server.js
const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();

// Configs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Usuário logado
let usuarioLogado = null;

// === INICIAR BANCO ===
async function initDB() {
  try {
    console.log('Iniciando configuração do banco...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) DEFAULT 'usuario'
      );

      CREATE TABLE IF NOT EXISTS livros (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(200) NOT NULL,
        autor VARCHAR(100) NOT NULL,
        ano INTEGER,
        exemplares INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS emprestimos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        livro_id INTEGER REFERENCES livros(id) ON DELETE CASCADE,
        data_emprestimo DATE DEFAULT CURRENT_DATE,
        data_devolucao DATE,
        data_devolucao_prevista DATE
      );
    `);

    console.log('Tabelas criadas/verficadas.');

    // Criar admin se não existir
    const admin = await db.query('SELECT * FROM usuarios WHERE email = $1', ['admin@biblio.com']);
    if (admin.rows.length === 0) {
      await db.query(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)',
        ['Admin', 'admin@biblio.com', '123', 'admin']
      );
      console.log('ADMIN CRIADO: admin@biblio.com / 123');
    } else {
      console.log('Admin já existe.');
    }

  } catch (err) {
    console.error('Erro ao iniciar banco:', err.message);
  }
}

// === MIDDLEWARES ===
function verificarLogin(req, res, next) {
  if (!usuarioLogado) return res.redirect('/');
  next();
}

function verificarAdmin(req, res, next) {
  if (!usuarioLogado || usuarioLogado.tipo !== 'admin') {
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  next();
}

// === ROTAS ===

// Login
app.get('/', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  console.log('Tentativa de login:', { email, senha });

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const usuario = result.rows[0];
      if (usuario.senha === senha) {
        usuarioLogado = usuario;
        console.log('LOGIN BEM-SUCEDIDO!');
        return res.render('dashboard', { usuario: usuarioLogado });
      } else {
        console.log('SENHA INCORRETA');
        return res.render('login', { erro: 'Senha incorreta' });
      }
    } else {
      console.log('USUÁRIO NÃO ENCONTRADO');
      return res.render('login', { erro: 'Email não encontrado' });
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.render('login', { erro: 'Erro no servidor' });
  }
});

// Dashboard
app.get('/dashboard', verificarLogin, (req, res) => {
  res.render('dashboard', { usuario: usuarioLogado });
});

// === USUÁRIOS ===
app.get('/usuarios', verificarLogin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, nome, email, tipo FROM usuarios ORDER BY id');
    if (usuarioLogado.tipo === 'admin') {
      res.render('usuarios/lista', { usuarios: result.rows, usuarioLogado });
    } else {
      const usuariosSimples = result.rows.map(u => ({ id: u.id, nome: u.nome }));
      res.render('usuarios/lista_usuario', { usuarios: usuariosSimples, usuarioLogado });
    }
  } catch (err) {
    res.status(500).send('Erro ao carregar usuários');
  }
});

app.get('/usuarios/novo', verificarAdmin, (req, res) => {
  res.render('usuarios/form', { usuario: {}, action: '/usuarios', usuarioLogado });
});

app.post('/usuarios', verificarAdmin, async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  await db.query('INSERT INTO usuarios (nome, email, senha, tipo) VALUES ($1, $2, $3, $4)', [nome, email, senha, tipo || 'usuario']);
  res.redirect('/usuarios');
});

app.get('/usuarios/editar/:id', verificarAdmin, async (req, res) => {
  const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
  res.render('usuarios/form', { usuario: result.rows[0], action: `/usuarios/${req.params.id}`, usuarioLogado });
});

app.post('/usuarios/:id', verificarAdmin, async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  await db.query('UPDATE usuarios SET nome=$1, email=$2, senha=$3, tipo=$4 WHERE id=$5', [nome, email, senha, tipo, req.params.id]);
  res.redirect('/usuarios');
});

app.post('/usuarios/excluir/:id', verificarAdmin, async (req, res) => {
  await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  res.redirect('/usuarios');
});

// === LIVROS ===
app.get('/livros', verificarLogin, async (req, res) => {
  const result = await db.query('SELECT * FROM livros ORDER BY id');
  res.render('livros/lista', { livros: result.rows, usuarioLogado });
});

app.get('/livros/novo', verificarAdmin, (req, res) => {
  res.render('livros/form', { livro: {}, action: '/livros', usuarioLogado });
});

app.post('/livros', verificarAdmin, async (req, res) => {
  const { titulo, autor, ano, exemplares } = req.body;
  await db.query('INSERT INTO livros (titulo, autor, ano, exemplares) VALUES ($1, $2, $3, $4)', [titulo, autor, ano || null, exemplares || 1]);
  res.redirect('/livros');
});

app.get('/livros/editar/:id', verificarAdmin, async (req, res) => {
  const result = await db.query('SELECT * FROM livros WHERE id = $1', [req.params.id]);
  res.render('livros/form', { livro: result.rows[0], action: `/livros/${req.params.id}`, usuarioLogado });
});

app.post('/livros/:id', verificarAdmin, async (req, res) => {
  const { titulo, autor, ano, exemplares } = req.body;
  await db.query('UPDATE livros SET titulo=$1, autor=$2, ano=$3, exemplares=$4 WHERE id=$5', [titulo, autor, ano, exemplares, req.params.id]);
  res.redirect('/livros');
});

app.post('/livros/excluir/:id', verificarAdmin, async (req, res) => {
  await db.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
  res.redirect('/livros');
});

// === EMPRÉSTIMOS ===
app.get('/emprestimos', verificarLogin, async (req, res) => {
  let emprestimos, usuarios = [], livros = [];

  try {
    if (usuarioLogado.tipo === 'admin') {
      emprestimos = await db.query(`
        SELECT e.id, u.nome AS usuario_nome, l.titulo AS livro_titulo,
               e.data_emprestimo, e.data_devolucao, e.data_devolucao_prevista
        FROM emprestimos e
        JOIN usuarios u ON e.usuario_id = u.id
        JOIN livros l ON e.livro_id = l.id
        ORDER BY e.data_emprestimo DESC
      `);
      const u = await db.query('SELECT id, nome FROM usuarios');
      const l = await db.query('SELECT id, titulo, autor, exemplares FROM livros WHERE exemplares > 0');
      usuarios = u.rows;
      livros = l.rows;
    } else {
      emprestimos = await db.query(`
        SELECT e.id, l.titulo AS livro_titulo,
               e.data_emprestimo, e.data_devolucao, e.data_devolucao_prevista
        FROM emprestimos e
        JOIN livros l ON e.livro_id = l.id
        WHERE e.usuario_id = $1
        ORDER BY e.data_emprestimo DESC
      `, [usuarioLogado.id]);
    }

    res.render('emprestimos/lista', {
      emprestimos: emprestimos.rows,
      usuarios,
      livros,
      usuarioLogado
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar empréstimos');
  }
});

app.post('/emprestimos', verificarAdmin, async (req, res) => {
  const { usuario_id, livro_id, data_emprestimo, data_devolucao_prevista } = req.body;

  try {
    const livro = await db.query('SELECT exemplares FROM livros WHERE id = $1', [livro_id]);
    if (livro.rows.length === 0 || livro.rows[0].exemplares <= 0) {
      return res.redirect('/emprestimos?erro=estoque');
    }

    await db.query(
      `INSERT INTO emprestimos (usuario_id, livro_id, data_emprestimo, data_devolucao_prevista)
       VALUES ($1, $2, $3, $4)`,
      [usuario_id, livro_id, data_emprestimo || new Date(), data_devolucao_prevista]
    );

    await db.query('UPDATE livros SET exemplares = exemplares - 1 WHERE id = $1', [livro_id]);
    res.redirect('/emprestimos');
  } catch (err) {
    console.error('Erro ao fazer empréstimo:', err);
    res.redirect('/emprestimos?erro=servidor');
  }
});

app.post('/emprestimos/devolver/:id', verificarAdmin, async (req, res) => {
  const emp = await db.query('SELECT livro_id FROM emprestimos WHERE id = $1 AND data_devolucao IS NULL', [req.params.id]);
  if (emp.rows.length > 0) {
    await db.query('UPDATE emprestimos SET data_devolucao = CURRENT_DATE WHERE id = $1', [req.params.id]);
    await db.query('UPDATE livros SET exemplares = exemplares + 1 WHERE id = $1', [emp.rows[0].livro_id]);
  }
  res.redirect('/emprestimos');
});

app.post('/emprestimos/excluir/:id', verificarAdmin, async (req, res) => {
  const emp = await db.query('SELECT livro_id, data_devolucao FROM emprestimos WHERE id = $1', [req.params.id]);
  await db.query('DELETE FROM emprestimos WHERE id = $1', [req.params.id]);
  if (emp.rows.length > 0 && !emp.rows[0].data_devolucao) {
    await db.query('UPDATE livros SET exemplares = exemplares + 1 WHERE id = $1', [emp.rows[0].livro_id]);
  }
  res.redirect('/emprestimos');
});

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await initDB();
  console.log(`\nServidor rodando em http://localhost:${PORT}`);
  console.log(`Login Admin: admin@biblio.com / 123\n`);
});
