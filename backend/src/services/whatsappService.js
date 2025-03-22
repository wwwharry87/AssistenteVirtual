// whatsappService.js
const venom = require('venom-bot');

let client;
let clientReady = false;
let lastQrRawData = null;
let isInitializing = false;

const initializeClient = async () => {
  try {
    console.log("Inicializando o Venom-Bot...");
    client = await venom.create({
      session: 'session-name',
      catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log('===== [VENOM-BOT] ASCII QR =====');
        console.log(asciiQR);
        console.log('===== [VENOM-BOT] urlCode =====');
        console.log(urlCode);
        // Armazena a string do QR para que o frontend possa exibir o QRCode
        lastQrRawData = urlCode;
      },
      headless: true,
      devtools: false,
      useChrome: true,
      logQR: true,
      autoClose: 0, // Não fecha automaticamente
      puppeteerOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage'
        ],
        // Tenta usar o caminho do Chromium no Render; ajuste se necessário.
        executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser'
      }
    });
    clientReady = true;
    console.log('Venom-Bot inicializado com sucesso!');
    return client;
  } catch (error) {
    console.error('Erro ao inicializar o Venom-Bot:', error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Cliente Venom-Bot não inicializado.');
  }
  return client;
};

const isClientReady = () => clientReady;
const getLastQrRawData = () => lastQrRawData;

module.exports = {
  initializeClient,
  getClient,
  isClientReady,
  getLastQrRawData,
  get isInitializing() {
    return isInitializing;
  },
  set isInitializing(value) {
    isInitializing = value;
  }
};
