require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// Configurações do servidor
const { port, sessionSecret } = require('./config/serverConfig');

// Configurar CORS para permitir requisições do seu frontend hospedado no Render
app.use(cors({
    origin: "https://assistentevirtual-7it5.onrender.com",  // ajuste para a URL do seu frontend
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
    cookie: { maxAge: 600000 }
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
app.get('/api/whatsapp-status', (req, res) => {
  const connected = whatsappService.isClientReady();
  const qrString = whatsappService.getLastQrRawData();
  console.log('===== [API] /api/whatsapp-status =====');
  console.log('connected:', connected);
  console.log('qrString:', qrString);
  res.json({ connected, qrString });
});

// (Opcional) Serve arquivos estáticos do frontend (se desejar)
// app.use(express.static(path.join(__dirname, '../frontend/build')));

const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
