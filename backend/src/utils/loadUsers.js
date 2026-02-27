const path = require('path');
const fs = require('fs');

const CANDIDATE_PATHS = [
  path.join(__dirname, '../../user_encrypted.txt'),
  path.join(__dirname, '../data/user_encrypted.txt'),
  path.join(process.cwd(), 'backend/user_encrypted.txt')
];

function resolveUserFilePath() {
  return CANDIDATE_PATHS.find((filePath) => fs.existsSync(filePath));
}

const loadUsers = () => {
  const usuarios = [];
  const filePath = resolveUserFilePath();

  if (!filePath) {
    console.error('Arquivo de usuários não encontrado!');
    return usuarios;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8').trim();
    const linhas = data.split('\n');

    linhas.forEach((linha, index) => {
      if (!linha.trim()) return;
      if (index === 0 && linha.toLowerCase().includes('usuario')) return;

      const colunas = linha.split(',');
      if (colunas.length < 4) {
        console.warn(`[loadUsers] linha ignorada por formato inválido: ${linha}`);
        return;
      }

      const [nome = '', dataNascimento = '', usuario = '', senha = '', telefone = ''] = colunas;
      if (!usuario.trim() || !senha.trim()) {
        console.warn(`[loadUsers] linha ignorada por usuário/senha ausente: ${linha}`);
        return;
      }

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
