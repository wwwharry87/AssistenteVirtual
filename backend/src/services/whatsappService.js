// whatsappService.js
const venom = require('venom-bot');
const path = require('path');
const fs = require('fs');

let client = null;
let qrCode = null;
let isInitializing = false;

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
      puppeteerOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      },
      logQR: (qr) => {
        qrCode = qr;
        console.log('QR Code gerado!');
      }
    });

    console.log('✅ WhatsApp conectado!');
    return client;
  } catch (error) {
    console.error('❌ Erro na conexão:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

const getClient = () => {
  if (!client) throw new Error('Cliente não inicializado');
  return client;
};

const getQR = () => qrCode;
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