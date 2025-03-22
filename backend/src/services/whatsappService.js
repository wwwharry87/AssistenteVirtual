// whatsappService.js
const baileys = require('@adiwajshing/baileys');
// Tenta obter a função makeWASocket, seja como propriedade ou como default
const makeWASocket = baileys.makeWASocket || baileys.default;
const { useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
const fs = require('fs');
const path = require('path');

let client;
let clientReady = false;
let lastQrRawData = null;
let isInitializing = false;

const initializeClient = async () => {
  try {
    console.log("Iniciando Baileys...");
    const authDir = path.join(__dirname, 'baileys_auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys versão: ${version}`);
    
    client = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ["Chrome", "Windows", "10.0.0"], // Fornece uma string para simular um ambiente de navegador
    });
    
    client.ev.on('connection.update', (update) => {
      const { qr, connection } = update;
      if (qr) {
        lastQrRawData = qr;
        console.log("QR gerado:", qr);
      }
      if (connection === 'open') {
        clientReady = true;
        console.log("Conectado ao WhatsApp!");
      } else if (connection === 'close') {
        clientReady = false;
        console.log("Conexão fechada.");
      }
    });
    
    return client;
  } catch (error) {
    console.error("Erro crítico:", error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error("Cliente Baileys não inicializado.");
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
