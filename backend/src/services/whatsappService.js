const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const fs = require('fs');
const path = require('path');

let client;
let clientReady = false;
let lastQrRawData = null;

const initializeClient = async () => {
  try {
    console.log("Iniciando Baileys...");
    const authDir = path.join(__dirname, 'baileys_auth');
    
    // Garante que o diretório existe
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Carrega o estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    
    // Configura o cliente
    client = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ["Chrome", "Windows", "10.0.0"], // Chave para ambientes serverless
    });

    // Eventos de conexão
    client.ev.on('connection.update', (update) => {
      const { qr, connection } = update;
      if (qr) {
        lastQrRawData = qr;
        console.log("QR gerado:", qr);
      }
      if (connection === 'open') {
        clientReady = true;
        console.log("Conectado ao WhatsApp!");
      }
    });

    return client;
  } catch (error) {
    console.error("Erro crítico:", error);
    throw error;
  }
};

module.exports = { initializeClient, isClientReady: () => clientReady, getLastQrRawData: () => lastQrRawData };