// Importar dependências
const express = require('express');
const venom = require('venom-bot');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para tratar JSON
app.use(express.json());

// Rota básica para testar o servidor
app.get('/', (req, res) => {
  res.send('Olá, mundo!');
});

// Variável para armazenar o QR Code
let qrCode = null;

// Inicializar o Venom-Bot
venom.create({
  session: 'session-name', // Nome da sessão (pode ser qualquer nome)
  headless: true, // Rodar em modo headless (sem interface gráfica)
  puppeteerOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },
  onLoadingScreen: (percent, message) => {
    console.log(`Carregando: ${percent}% - ${message}`);
  },
  onQrCode: (qr) => {
    qrCode = qr; // Armazenar o QR Code gerado
    console.log('QR Code gerado:', qr);
  }
})
.then((client) => {
  console.log('Cliente do WhatsApp inicializado com sucesso!');

  // Exemplo: Enviar uma mensagem quando o bot estiver pronto
  client.sendText('5511999999999@c.us', 'Olá, eu sou o Assistente Virtual!')
    .then(() => {
      console.log('Mensagem enviada com sucesso!');
    })
    .catch((err) => {
      console.error('Erro ao enviar mensagem:', err);
    });

  // Rota para enviar mensagens via API
  app.post('/enviar-mensagem', (req, res) => {
    const { numero, mensagem } = req.body;

    if (!numero || !mensagem) {
      return res.status(400).json({ success: false, message: 'Número e mensagem são obrigatórios.' });
    }

    client.sendText(`${numero}@c.us`, mensagem)
      .then(() => {
        res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
      })
      .catch((err) => {
        res.status(500).json({ success: false, message: 'Erro ao enviar mensagem', error: err });
      });
  });
})
.catch((err) => {
  console.error('Erro ao inicializar o Venom-Bot:', err);
});

// Rota para obter o QR Code
app.get('/qr-code', (req, res) => {
  if (qrCode) {
    res.send(`<img src="${qrCode}" alt="QR Code" />`);
  } else {
    res.status(404).send('QR Code não disponível.');
  }
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});