// whatsappService.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');

let client;
let clientReady = false;
let lastQrRawData = null;
let isInitializing = false;

const initializeClient = async () => {
  try {
    console.log("Iniciando Baileys...");
    // Cria/recupera o estado de autenticação em arquivos (pasta 'baileys_auth')
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando Baileys versão: ${version} (mais recente: ${isLatest})`);
    
    client = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true, // Imprime o QR no terminal para debug (opcional)
      logger: undefined // Você pode configurar seu logger, se desejar
    });
    
    // Ouve atualizações de conexão para capturar o QR e status
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
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log("Conexão fechada, motivo:", reason);
      }
    });
    
    // Atualiza as credenciais automaticamente
    client.ev.on('creds.update', saveCreds);
    
    return client;
  } catch (error) {
    console.error("Erro ao inicializar Baileys:", error);
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
