// whatsappService.js
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const fs = require('fs');
const path = require('path');

let client;
let clientReady = false;
let lastQrRawData = null;
let isInitializing = false;

const initializeClient = async () => {
  try {
    console.log("Iniciando Baileys...");

    // Garante que o diretório de autenticação existe
    const authDir = path.join(__dirname, 'baileys_auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
      console.log('Diretório baileys_auth criado com sucesso.');
    }

    // Carrega o estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys versão: ${version} (mais recente: ${isLatest})`);

    // Configura o cliente do WhatsApp
    client = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ["Chrome", "Windows", "10.0.0"], // Necessário para ambientes serverless
      logger: undefined
    });

    // Evento de atualização de conexão
    client.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log("QR recebido:", qr);
        lastQrRawData = qr;
      }

      if (connection === 'open') {
        console.log("Conexão aberta!");
        clientReady = true;
      } else if (connection === 'close') {
        clientReady = false;
        const reason = lastDisconnect?.error?.output?.statusCode || "Desconhecido";
        console.log("Conexão fechada. Motivo:", reason);
        
        // Reconexão automática após 5 segundos
        setTimeout(() => {
          console.log("Tentando reconectar...");
          initializeClient().catch(err => console.error("Erro na reconexão:", err));
        }, 5000);
      }
    });

    // Atualiza credenciais
    client.ev.on('creds.update', saveCreds);

    return client;
  } catch (error) {
    console.error("Erro crítico ao inicializar Baileys:", error);
    throw error;
  }
};

// Métodos auxiliares
const getClient = () => {
  if (!client) throw new Error("Cliente não inicializado.");
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