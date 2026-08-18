// backend/src/index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// =============================
// Configurações do servidor
// =============================
const { port, sessionSecret, allowedOrigins, isProd } = require('./config/serverConfig');

// Render/Proxy em HTTPS
app.set('trust proxy', 1);
// Oculta header
app.disable('x-powered-by');

// =============================
// CORS (front em Render + localhost)
// =============================
const FRONTENDS = allowedOrigins;

const corsOptions = {
  origin: (origin, cb) => {
    // permite chamadas sem origin (ex: healthchecks) e as de FRONTENDS
    if (!origin || FRONTENDS.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin não permitido: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
};

app.use(
  cors(corsOptions)
);
// preflight
app.options('*', cors(corsOptions));

// =============================
// CSV temporário (antes dos parsers globais)
// =============================
// O upload recebe o arquivo bruto, por isso esta rota precisa ser montada
// antes de express.json/express.urlencoded. O GET /csv/* é público.
const csvStorageRoutes = require('./routes/csvStorageRoutes');
app.use(csvStorageRoutes);

// =============================
// Middlewares principais
// =============================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sessão (se estiver usando login por sessão/cookie)
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2, // 2h
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd
    }
  })
);

// =============================
// WhatsApp: WPPConnect (opcional)
// =============================
// Controle pelo .env: USE_WPP=true/false (default: false)
const USE_WPP = String(process.env.USE_WPP || 'false').toLowerCase() === 'true';
if (USE_WPP) {
  try {
    const whatsappService = require('./services/whatsappService');
    whatsappService
      .initializeClient()
      .then(() => console.log('[WPPConnect] inicializado'))
      .catch((err) => console.error('[WPPConnect] erro ao iniciar:', err));
  } catch (e) {
    console.error('[WPPConnect] módulo indisponível:', e?.message || e);
  }
} else {
  console.log('[WPPConnect] desativado (USE_WPP=false)');
}

// =============================
// Rotas da aplicação
// =============================
const authRoutes = require('./routes/authRoutes');
const coordinformaRoutes = require('./routes/coordinformaRoutes');
const respinformaRoutes = require('./routes/respinformaRoutes');
const dadosCsvRoutes = require('./routes/dadosCsvRoutes');

// Cloud API (oficial) — apenas envio; sem webhooks
try {
  const whatsappCloudRoutes = require('./routes/whatsappCloudRoutes');
  app.use('/api', whatsappCloudRoutes);
  console.log('[CloudAPI] rotas /api/whatsapp-cloud/* ativas');
} catch (e) {
  console.warn('[CloudAPI] rotas não carregadas:', e?.message || e);
}

app.use('/api', authRoutes);
app.use('/api/coordinforma', coordinformaRoutes);
app.use('/api/respinforma', respinformaRoutes);
app.use('/api/dados-csv', dadosCsvRoutes);

// =============================
// Utilitários
// =============================

// Rota para carregar municípios (lendo arquivo txt)
app.get('/api/municipios', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'municipio.txt');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo municipio.txt não encontrado.' });
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8').trim();
    const linhas = data.split('\n');
    const municipios = {};
    linhas.forEach((linha) => {
      const [nome, tipo, url] = linha.split(';');
      if (!municipios[nome]) municipios[nome] = [];
      municipios[nome].push({
        tipo: parseInt(tipo, 10),
        url: (url || '').trim()
      });
    });
    const municipiosFormatados = Object.keys(municipios).map((nome) => ({
      nome,
      dados: municipios[nome]
    }));
    res.json(municipiosFormatados);
  } catch (error) {
    console.error('Erro ao processar arquivo municipio.txt:', error.message);
    res.status(500).json({ error: 'Erro ao processar arquivo municipio.txt.' });
  }
});

// Endpoint opcional para status do WPPConnect (se estiver habilitado)
app.get('/api/whatsapp-status', async (req, res) => {
  if (!USE_WPP) {
    return res.json({ connected: false, state: 'WPP_DISABLED', qrString: null });
  }
  try {
    const whatsappService = require('./services/whatsappService');
    const connectedByFlag = whatsappService.isClientReady();
    const connectedBySdk = await whatsappService.isReallyConnected().catch(() => false);
    const connected = connectedByFlag || connectedBySdk;
    const qrString = whatsappService.getLastQrRawData();
    const state = whatsappService.getConnectionState();
    console.log('===== [API] /api/whatsapp-status =====');
    console.log('connection state:', state);
    console.log('connected(flag):', connectedByFlag, 'connected(sdk):', connectedBySdk);
    console.log('qrString:', qrString);
    res.json({ connected, state, qrString });
  } catch (e) {
    console.error('[WPPConnect] status erro:', e?.message || e);
    res.json({ connected: false, state: 'ERROR', qrString: null });
  }
});

// Healthcheck simples
app.get('/health', (_req, res) => res.json({ ok: true }));

// Servir arquivos estáticos (opcional)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// =============================
// Middleware de erros
// =============================
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// =============================
// Start
// =============================
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
