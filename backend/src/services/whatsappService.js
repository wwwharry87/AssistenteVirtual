// whatsappService.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
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
      console.log("Diretório de autenticação criado:", authDir);
    } else {
      console.log("Diretório de autenticação encontrado:", authDir);
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys versão: ${version}`);
    
    client = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      // Tente ajustar essa configuração conforme necessário
      browser: ["Chrome", "Windows", "10"],
    });

    client.ev.on('connection.update', (update) => {
      console.log("Atualização de conexão recebida:", update);
      const { qr, connection, lastDisconnect } = update;
      if (qr) {
        lastQrRawData = qr;
        console.log("QR gerado:", qr);
      }
      if (connection === 'open') {
        clientReady = true;
        console.log("Conectado ao WhatsApp!");
      } else if (connection === 'close') {
        clientReady = false;
        if (lastDisconnect && lastDisconnect.error) {
          console.error("Conexão fechada. Erro:", lastDisconnect.error);
        } else {
          console.error("Conexão fechada, sem detalhes de erro.");
        }
      }
    });

    client.ev.on('creds.update', saveCreds);

    return client;
  } catch (error) {
    console.error("Erro crítico ao inicializar Baileys:", error);
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
