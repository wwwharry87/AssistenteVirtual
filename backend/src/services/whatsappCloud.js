// backend/src/services/whatsappCloud.js
const axios = require("axios");
const FormData = require("form-data");

const GRAPH_VERSION = process.env.WABA_GRAPH_API_VERSION || "v22.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("[whatsappCloud] Faltam WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID no .env");
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  timeout: 45000,
});

// ======================= Utils =======================
function normalizeToE164BR(n) {
  if (!n) return n;
  let s = String(n).trim();
  s = s.replace(/@c\.us$/i, "");
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+55") && s.length >= 13) return s;
  if (s.startsWith("55")) return `+${s}`;
  if (s.startsWith("0055")) return `+${s.slice(2)}`;
  const only = s.replace(/\D/g, "");
  if (only.length === 10 || only.length === 11) return `+55${only}`;
  if (s.startsWith("+")) return s;
  return `+${only}`;
}

function sanitizeParam(text) {
  return String(text ?? "")
    .replace(/[\r\n\t]+/g, " | ")
    .replace(/ {5,}/g, "    ")
    .trim();
}

function friendlyAxiosError(e) {
  return e?.response?.data || e?.message || String(e);
}

// =================== Envio básico ====================
async function sendText(to, body) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: normalizeToE164BR(to),
      type: "text",
      text: { body: String(body) },
    };
    const { data } = await api.post(`/${PHONE_NUMBER_ID}/messages`, payload);
    return data;
  } catch (e) {
    throw new Error(`[sendText] ${JSON.stringify(friendlyAxiosError(e))}`);
  }
}

async function sendTemplate(to, templateName, lang = "pt_BR", components) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: normalizeToE164BR(to),
      type: "template",
      template: {
        name: String(templateName),
        language: { code: lang },
        ...(components ? { components } : {}),
      },
    };
    const { data } = await api.post(`/${PHONE_NUMBER_ID}/messages`, payload);
    return data;
  } catch (e) {
    throw new Error(`[sendTemplate] ${JSON.stringify(friendlyAxiosError(e))}`);
  }
}

// =================== Upload/Media ====================
async function uploadMediaFromBuffer(buffer, mimeType, filename = "file") {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", buffer, { filename, contentType: mimeType });

    const { data } = await api.post(`/${PHONE_NUMBER_ID}/media`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${ACCESS_TOKEN}` },
      maxBodyLength: Infinity,
    });
    console.log(`[uploadMediaFromBuffer] Upload realizado: ${data.id} - ${filename}`);
    return data;
  } catch (e) {
    console.error(`[uploadMediaFromBuffer] Erro:`, friendlyAxiosError(e));
    throw new Error(`[uploadMediaFromBuffer] ${JSON.stringify(friendlyAxiosError(e))}`);
  }
}

async function uploadMediaFromUrl(url, filename = "file") {
  try {
    const resp = await axios.get(url, { responseType: "arraybuffer" });
    const mime = resp.headers["content-type"] || "application/octet-stream";
    return uploadMediaFromBuffer(Buffer.from(resp.data), mime, filename);
  } catch (e) {
    throw new Error(`[uploadMediaFromUrl] ${JSON.stringify(friendlyAxiosError(e))}`);
  }
}

async function sendDocument(to, mediaId, caption, filename) {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to: normalizeToE164BR(to),
      type: "document",
      document: {
        id: mediaId,
        ...(caption ? { caption: String(caption) } : {}),
        ...(filename ? { filename: String(filename) } : {}),
      },
    };
    console.log(`[sendDocument] Enviando documento: ${mediaId} para ${to}`);
    const { data } = await api.post(`/${PHONE_NUMBER_ID}/messages`, payload);
    console.log(`[sendDocument] Sucesso: ${data.messages?.[0]?.id}`);
    return data;
  } catch (e) {
    console.error(`[sendDocument] Erro:`, friendlyAxiosError(e));
    throw new Error(`[sendDocument] ${JSON.stringify(friendlyAxiosError(e))}`);
  }
}

// =================== Templates (nomes) ===============
const TEMPLATE_LANG = "pt_BR";

// RespInforma:
const TEMPLATE_NAME_RESP_DOC = "aviso_faltas_multi_doc";
const TEMPLATE_NAME_RESP_MULTI = "aviso_faltas_multi";

// CoordInforma:
const TEMPLATE_NAME_COORD_DOC = "pendencias_diario_doc";

// ============ Helpers genéricos de template ==========
/** Envia template com header Document + exatamente 2 variáveis no body */
async function sendTemplateWithDocHeader(to, {
  templateName,
  lang = TEMPLATE_LANG,
  mediaId,
  filename,
  bodyParams = [],
} = {}) {
  if (!templateName) throw new Error("[sendTemplateWithDocHeader] templateName obrigatório");
  if (!mediaId) throw new Error("[sendTemplateWithDocHeader] mediaId obrigatório");

  const body2 = (bodyParams || []).map(sanitizeParam).slice(0, 2);
  while (body2.length < 2) body2.push("");

  const components = [
    {
      type: "header",
      parameters: [{ type: "document", document: { id: mediaId, ...(filename ? { filename } : {}) } }]
    },
    {
      type: "body",
      parameters: body2.map((t) => ({ type: "text", text: t }))
    },
  ];

  console.log(`[sendTemplateWithDocHeader] Enviando template ${templateName} com header=Document para ${to}`);
  return sendTemplate(to, templateName, lang, components);
}

// ===== Fallback inteligente para header/document =====
const ERR_HEADER_MISMATCH_HINTS = [
  "Template does not contain title component",
  "header: Format mismatch",
  "expected TEXT, received",
  "number of localizable_params",
  "header parameter type is not supported",
  "is not a valid header"
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tenta enviar com header=Document; se o template não aceitar,
 * envia só o body e depois o documento separado.
 */
async function sendTemplateDocHeaderSafe(to, {
  templateName,
  lang = TEMPLATE_LANG,
  mediaId,
  filename,
  bodyParams = []
} = {}) {
  console.log(`[sendTemplateDocHeaderSafe] Iniciando envio para ${to}, template: ${templateName}`);
  
  try {
    const result = await sendTemplateWithDocHeader(to, {
      templateName, lang, mediaId, filename, bodyParams
    });
    console.log(`[sendTemplateDocHeaderSafe] Sucesso com header=Document para ${to}`);
    return result;
  } catch (e) {
    const msg = e?.message || "";
    console.warn(`[sendTemplateDocHeaderSafe] Erro com header=Document: ${msg}`);
    
    const shouldFallback = ERR_HEADER_MISMATCH_HINTS.some(h => msg.includes(h));
    if (!shouldFallback) {
      console.error(`[sendTemplateDocHeaderSafe] Erro não identificado para fallback, rejeitando`);
      throw e;
    }

    // Fallback: body(2) + documento em mensagem separada
    console.log(`[sendTemplateDocHeaderSafe] Executando FALLBACK para ${to}`);
    const params2 = (bodyParams || []).slice(0, 2);
    while (params2.length < 2) params2.push("");
    const components = [{ type: "body", parameters: params2.map(t => ({ type: "text", text: sanitizeParam(t) })) }];

    console.log(`[sendTemplateDocHeaderSafe] Enviando template sem header para ${to}`);
    const r = await sendTemplate(to, templateName, lang, components);
    
    console.log(`[sendTemplateDocHeaderSafe] Aguardando 2s antes de enviar documento separado para ${to}`);
    await delay(2000);
    
    console.log(`[sendTemplateDocHeaderSafe] Enviando documento separado para ${to}`);
    await sendDocument(to, mediaId, 'Relatório detalhado em anexo.', filename);
    
    console.log(`[sendTemplateDocHeaderSafe] Fallback concluído com sucesso para ${to}`);
    return r;
  }
}

// =============== Helpers específicos =================
// RespInforma (multi inline: 3 vars)
async function sendTemplateAvisoFaltas(to, {
  responsavel,
  periodo = "",
  lista,
} = {}) {
  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: sanitizeParam(responsavel || "Responsável") },
        { type: "text", text: sanitizeParam(periodo || "") },
        { type: "text", text: sanitizeParam(lista || "-") },
      ]
    }
  ];
  console.log(`[sendTemplateAvisoFaltas] Enviando template multi para ${to}`);
  return sendTemplate(to, TEMPLATE_NAME_RESP_MULTI, TEMPLATE_LANG, components);
}

// RespInforma (doc header + 2 vars)
async function sendTemplateRespDocHeader(to, {
  mediaId,
  filename,
  bodyParams = [],
  lang = TEMPLATE_LANG
} = {}) {
  return sendTemplateWithDocHeader(to, {
    templateName: TEMPLATE_NAME_RESP_DOC,
    lang,
    mediaId,
    filename,
    bodyParams
  });
}

async function sendTemplateRespDocHeaderSafe(to, {
  mediaId,
  filename,
  bodyParams = [],
  lang = TEMPLATE_LANG
} = {}) {
  return sendTemplateDocHeaderSafe(to, {
    templateName: TEMPLATE_NAME_RESP_DOC,
    lang,
    mediaId,
    filename,
    bodyParams
  });
}

// CoordInforma (doc header + 2 vars: {{1}} escola, {{2}} período)
async function sendTemplateCoordDocHeader(to, {
  mediaId,
  filename,
  escola,
  periodo,
  lang = TEMPLATE_LANG
} = {}) {
  return sendTemplateWithDocHeader(to, {
    templateName: TEMPLATE_NAME_COORD_DOC,
    lang,
    mediaId,
    filename,
    bodyParams: [sanitizeParam(escola || "-"), sanitizeParam(periodo || "-")]
  });
}

async function sendTemplateCoordDocHeaderSafe(to, {
  mediaId,
  filename,
  escola,
  periodo,
  lang = TEMPLATE_LANG
} = {}) {
  return sendTemplateDocHeaderSafe(to, {
    templateName: TEMPLATE_NAME_COORD_DOC,
    lang,
    mediaId,
    filename,
    bodyParams: [sanitizeParam(escola || "-"), sanitizeParam(periodo || "-")]
  });
}

// =================== Exports ========================
module.exports = {
  // base
  sendText,
  sendTemplate,
  uploadMediaFromBuffer,
  uploadMediaFromUrl,
  sendDocument,

  // templates RespInforma
  sendTemplateAvisoFaltas,
  sendTemplateRespDocHeader,
  sendTemplateRespDocHeaderSafe,

  // templates CoordInforma
  sendTemplateCoordDocHeader,
  sendTemplateCoordDocHeaderSafe,

  // genéricos
  sendTemplateWithDocHeader,
  sendTemplateDocHeaderSafe,

  // utils
  normalizeToE164BR,
  delay
};