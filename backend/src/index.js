require('dotenv').config();
require('events').EventEmitter.defaultMaxListeners = 20; // Aumenta o limite de listeners
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// Configurações do servidor
const { port, sessionSecret } = require('./config/serverConfig');

// Configurar CORS para permitir requisições do seu frontend hospedado no Render
const allowedOrigins = ['https://assistentevirtual-7it5.onrender.com', 'http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization"
}));

// Middlewares para tratar JSON e formulários
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar sessão (lembre-se de usar um store em produção)
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 600000,
        secure: process.env.NODE_ENV === 'production', // Apenas em produção com HTTPS
        httpOnly: true
    }
}));

// Inicializa o Venom-Bot
const whatsappService = require('./services/whatsappService');
whatsappService.initializeClient().catch(err => console.error(err));

// Importa as rotas
const authRoutes = require('./routes/authRoutes');
const coordinformaRoutes = require('./routes/coordinformaRoutes');
const respinformaRoutes = require('./routes/respinformaRoutes');
const dadosCsvRoutes = require('./routes/dadosCsvRoutes');

app.use('/api', authRoutes);
app.use('/api/coordinforma', coordinformaRoutes);
app.use('/api/respinforma', respinformaRoutes);
app.use('/api/dados-csv', dadosCsvRoutes);

// Rota para carregar municípios
app.get('/api/municipios', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'municipio.txt');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8').trim();
    const linhas = data.split('\n');
    const municipios = {};
    linhas.forEach(linha => {
      const [nome, tipo, url] = linha.split(';');
      if (!municipios[nome]) {
        municipios[nome] = [];
      }
      municipios[nome].push({
        tipo: parseInt(tipo, 10),
        url: url.trim()
      });
    });
    const municipiosFormatados = Object.keys(municipios).map(nome => ({
      nome,
      dados: municipios[nome]
    }));
    res.json(municipiosFormatados);
  } catch (error) {
    console.error('Erro ao processar arquivo municipio.txt:', error.message);
    res.status(500).json({ error: 'Erro ao processar arquivo municipio.txt.' });
  }
});

// Endpoint para retornar o status do WhatsApp e a string do QR (para reconexão, se necessário)
app.get('/api/whatsapp-status', async (req, res) => {
  let connected = whatsappService.isClientReady();
  let qrString = whatsappService.getQR();

  console.log('===== [API] /api/whatsapp-status =====');
  console.log('Inicial - connected:', connected);
  console.log('Inicial - qrString:', qrString);

  // Se não estiver conectado e não houver QR, tenta reinicializar o cliente
  let retryCount = 0;
  const maxRetries = 3;

  if (!connected && !qrString && retryCount < maxRetries) {
    if (!whatsappService.isInitializing) {
      try {
        console.log('Tentando reinicializar o cliente do WhatsApp para obter QR...');
        await whatsappService.initializeClient();
        retryCount++;
      } catch (error) {
        console.error('Erro ao reinicializar o WhatsApp:', error);
      }
      connected = whatsappService.isClientReady();
      qrString = whatsappService.getQR();
    } else {
      console.log('Cliente já está em processo de inicialização.');
    }
  }

  console.log('Final - connected:', connected);
  console.log('Final - qrString:', qrString);
  res.json({ connected, qrString });
});

// Middleware global para tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!' });
});

// Middleware para tratar payloads muito grandes
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});