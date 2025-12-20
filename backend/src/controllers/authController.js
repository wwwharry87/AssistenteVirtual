// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const loadUsers = require('../utils/loadUsers');

// Decide a rota de destino conforme perfil (opcional)
function resolveRedirect(user) {
  // se o JSON tiver um campo "redirect", respeita
  if (user.redirect) return String(user.redirect);

  // se tiver "perfil" ou "role", decide
  const perfil = String(user.perfil || user.role || '').toLowerCase();
  if (perfil === 'coord' || perfil === 'coordenador') return '/coordinforma';
  if (perfil === 'resp'  || perfil === 'responsavel') return '/respinforma';

  // padrão
  return '/coordinforma';
}

exports.verificarUsuario = (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ success: false, message: 'Informe o usuário.' });
    }

    const usuarios = loadUsers(); // precisa sempre retornar [] se não houver arquivo
    const lookup = String(username).toLowerCase().trim();
    const usuarioValido = usuarios.find(u => String(u.usuario || '').toLowerCase() === lookup);

    if (usuarioValido) {
      return res.status(200).json({ success: true, message: 'Usuário encontrado' });
    }
    return res.status(200).json({ success: false, message: 'Usuário não encontrado' });
  } catch (err) {
    console.error('[authController.verificarUsuario] erro:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
};

exports.login = (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
    }

    const usuarios = loadUsers();
    const lookup = String(username).toLowerCase().trim();
    const usuarioValido = usuarios.find(u => String(u.usuario || '').toLowerCase() === lookup);

    if (!usuarioValido) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    // senha armazenada deve ser hash bcrypt em usuarioValido.senha
    const senhaHash = String(usuarioValido.senha || '');
    const senhaValida = senhaHash && bcrypt.compareSync(String(password), senhaHash);

    if (!senhaValida) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }

    // cria sessão
    req.session.authenticated = true;
    req.session.user = {
      username: usuarioValido.usuario,
      nome: usuarioValido.nome || usuarioValido.usuario,
      perfil: usuarioValido.perfil || usuarioValido.role || 'coord',
      loggedAt: Date.now(),
    };

    const redirecionar = resolveRedirect(usuarioValido);
    return res.status(200).json({ success: true, redirecionar });
  } catch (err) {
    console.error('[authController.login] erro:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
};

exports.logout = (req, res) => {
  try {
    if (!req.session) {
      return res.status(200).json({ success: true, message: 'Logout efetuado.' });
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid'); // cookie padrão do express-session
      return res.status(200).json({ success: true, message: 'Logout efetuado.' });
    });
  } catch (err) {
    console.error('[authController.logout] erro:', err);
    return res.status(500).json({ success: false, message: 'Erro interno.' });
  }
};
