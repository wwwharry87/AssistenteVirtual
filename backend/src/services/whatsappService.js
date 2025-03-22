const venom = require('venom-bot');
const path = require('path');
const fs = require('fs');

let client = null;
let qrCodeString = null; // Armazenará o QR code como string
let isInitializing = false;
const MAX_RETRIES = 3; // Número máximo de tentativas de reconexão
let retryCount = 0;

const initializeClient = async () => {
  try {
    isInitializing = true;
    const sessionDir = path.join(__dirname, 'whatsapp_sessions');

    // Cria diretório de sessões se não existir
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    client = await venom.create({
      session: 'assistente-virtual',
      headless: true,
      multidevice: true,
      debug: true, // Habilita logs detalhados
      browserArgs: [
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process'
      ],
      puppeteerOptions: {
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', // Usa o Chromium do Render
      },
      logQR: (qr) => {
        qrCodeString = qr; // Armazena o QR code como string
        console.log('QR Code gerado!');
      }
    });

    console.log('✅ WhatsApp conectado!');
    retryCount = 0; // Reseta o contador de tentativas após sucesso
    return client;
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      console.log(`Tentando reconectar... Tentativa ${retryCount} de ${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Aguarda 5 segundos
      return initializeClient(); // Tenta reconectar
    } else {
      console.error('Número máximo de tentativas atingido. Verifique a conexão.');
      throw error;
    }
  } finally {
    isInitializing = false;
  }
};

const getClient = () => {
  if (!client) throw new Error('Cliente não inicializado');
  return client;
};

const getQR = () => qrCodeString; // Retorna o QR code como string
const isClientReady = () => !!client;

module.exports = {
  initializeClient,
  getClient,
  isClientReady,
  getQR,
  get isInitializing() {
    return isInitializing;
  }
};