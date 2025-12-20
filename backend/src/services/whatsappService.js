// backend/src/services/whatsappService.js
// Compat layer: mantém a mesma interface esperada pelos controllers antigos,
// mas usa a WhatsApp Cloud API por baixo (sem WPPConnect/venom).

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  sendText,
  sendTemplate,
  uploadMediaFromBuffer,
  uploadMediaFromUrl, // opcional, mas útil
  sendDocument,
  sendTemplateAvisoFaltas, // helper já aponta para "aviso_faltas_multi"
  normalizeToE164BR
} = require("./whatsappCloud");

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_VERSION = "v22.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function toE164(num) {
  // usa a normalização robusta do serviço oficial
  return normalizeToE164BR(num);
}

// ===== API similar ao WPPConnect =====
async function initializeClient() {
  console.log("[whatsappService shim] usando Cloud API (sem WPPConnect)");
  return true;
}
function getClient() { return {}; }
function isClientReady() { return Boolean(TOKEN && PHONE_ID); }
function getLastQrRawData() { return null; }
function getConnectionState() { return "CLOUD_API"; }
async function isReallyConnected() { return isClientReady(); }

// ===== Envio básico =====
async function sendTextSafe(jidOrNumber, text) {
  const to = toE164(jidOrNumber);
  try {
    return await sendText(to, text);
  } catch (e) {
    throw new Error(`[sendTextSafe] ${e.message || e}`);
  }
}

// ===== Envio de IMAGEM (quando o arquivo subir como media image/*) =====
async function sendImageMessage(toE164Str, mediaId, caption) {
  try {
    const url = `${BASE}/${PHONE_ID}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: toE164Str,
      type: "image",
      image: { id: mediaId, ...(caption ? { caption } : {}) }
    };
    const { data } = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    return data;
  } catch (e) {
    const msg = e?.response?.data || e?.message || String(e);
    throw new Error(`[sendImageMessage] ${JSON.stringify(msg)}`);
  }
}

function guessMime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".csv") return "text/csv";
  return "application/octet-stream";
}

/** Envia arquivo; imagens como "image", demais como "document". */
async function sendFileSafe(jidOrNumber, filePath, filename, caption) {
  const to = toE164(jidOrNumber);
  const abs = path.resolve(filePath);
  const name = filename || path.basename(abs);
  const mime = guessMime(name);

  try {
    const buffer = fs.readFileSync(abs);
    const media = await uploadMediaFromBuffer(buffer, mime, name);

    if (mime.startsWith("image/")) {
      return await sendImageMessage(to, media.id, caption || "");
    }
    return await sendDocument(to, media.id, caption || "", name);
  } catch (e) {
    const msg = e?.response?.data || e?.message || String(e);
    throw new Error(`[sendFileSafe] ${JSON.stringify(msg)}`);
  }
}

async function sendImageSafe(jidOrNumber, imagePath, filename, caption) {
  return await sendFileSafe(jidOrNumber, imagePath, filename, caption);
}

// ===== Envio por TEMPLATE (para iniciar/reabrir conversa fora da janela 24h) =====
async function sendTemplateSafe(jidOrNumber, templateName, lang = "pt_BR", components) {
  const to = toE164(jidOrNumber);
  try {
    return await sendTemplate(to, templateName, lang, components);
  } catch (e) {
    throw new Error(`[sendTemplateSafe] ${e.message || e}`);
  }
}

/**
 * Helper específico do template "aviso_faltas_multi".
 * params: { responsavel, periodo, escola, aluno, urlToken? }
 * - periodo: conteúdo para {{2}} (ex.: "09/10/2025", "esta semana", "setembro/2025") — sem "em "
 * - aluno: aqui vai a LISTA agregada (todas as linhas) para {{4}}
 */
async function sendTemplateAvisoFaltasSafe(jidOrNumber, params) {
  const to = toE164(jidOrNumber);
  try {
    return await sendTemplateAvisoFaltas(to, params);
  } catch (e) {
    throw new Error(`[sendTemplateAvisoFaltasSafe] ${e.message || e}`);
  }
}

module.exports = {
  // “estado”/compat
  initializeClient,
  getClient,
  isClientReady,
  getLastQrRawData,
  getConnectionState,
  isReallyConnected,

  // envio básico
  sendTextSafe,
  sendFileSafe,
  sendImageSafe,

  // templates
  sendTemplateSafe,
  sendTemplateAvisoFaltasSafe,

  // utils se precisar em outros pontos
  uploadMediaFromUrl,
  toE164
};
