const path = require('path');
const fs = require('fs');

const loadUsers = () => {
    const usuarios = [];
    const filePath = path.join(__dirname, '../../user_encrypted.txt');
    if (!fs.existsSync(filePath)) {
        console.error('Arquivo de usuários não encontrado!');
        return usuarios;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8').trim();
        const linhas = data.split('\n');
        linhas.forEach((linha, index) => {
            if (index === 0 || !linha.trim()) return;
            const [nome, dataNascimento, usuario, senha, telefone] = linha.split(',');
            usuarios.push({
                nome: nome.trim(),
                dataNascimento: dataNascimento.trim(),
                usuario: usuario.trim().toLowerCase(),
                senha: senha.trim(),
                telefone: telefone.trim()
            });
        });
    } catch (error) {
        console.error('Erro ao carregar o arquivo de usuários:', error.message);
    }
    return usuarios;
};

module.exports = loadUsers;
