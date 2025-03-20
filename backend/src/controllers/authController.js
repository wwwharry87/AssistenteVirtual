const bcrypt = require('bcryptjs');
const loadUsers = require('../utils/loadUsers');

exports.verificarUsuario = (req, res) => {
    const { username } = req.body;
    const usuarios = loadUsers();
    const usuarioValido = usuarios.find(user => user.usuario === username.toLowerCase());
    if (usuarioValido) {
        res.json({ success: true, message: 'Usuário encontrado' });
    } else {
        res.json({ success: false, message: 'Usuário não encontrado' });
    }
};

exports.login = (req, res) => {
    const { username, password } = req.body;
    const usuarios = loadUsers();
    const usuarioValido = usuarios.find(user => user.usuario === username.toLowerCase());
    if (usuarioValido) {
        const senhaValida = bcrypt.compareSync(password, usuarioValido.senha);
        if (senhaValida) {
            req.session.authenticated = true;
            req.session.user = usuarioValido.nome;
            res.json({ success: true, redirecionar: "/coordinforma" });
        } else {
            res.json({ success: false, message: 'Senha inválida' });
        }
    } else {
        res.json({ success: false, message: 'Usuário não encontrado' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.sendStatus(200);
    });
};
