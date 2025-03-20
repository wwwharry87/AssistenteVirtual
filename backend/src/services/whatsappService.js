const venom = require('venom-bot');

let client;
let clientReady = false;
let lastQrRawData = null; // Em vez de armazenar a imagem base64, guardamos o texto do QR

const initializeClient = async () => {
  try {
    client = await venom.create({
      session: 'session-name',
      catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log('===== [VENOM-BOT] ASCII QR =====');
        console.log(asciiQR);

        console.log('===== [VENOM-BOT] urlCode (string crua) =====');
        console.log(urlCode);

        // Armazena a string bruta do QR
        lastQrRawData = urlCode;
      },
      headless: true,
      devtools: false,
      useChrome: true,
      logQR: true,
      autoClose: 0, // Não fecha automaticamente, assim fica esperando até escanear
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

// Função para pegar a string crua do QR (urlCode)
const getLastQrRawData = () => lastQrRawData;

module.exports = {
  initializeClient,
  getClient,
  isClientReady,
  getLastQrRawData,
};
