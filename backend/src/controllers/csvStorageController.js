const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CSV_ROOT = path.join(os.tmpdir(), 'coordinforma-csv');
const ALLOWED_FILES = new Set(['numbers.csv', 'responsavel.csv']);

function isValidCodigo(codigo) {
  return /^\d{1,20}$/.test(String(codigo || ''));
}

function isAllowedFile(arquivo) {
  return ALLOWED_FILES.has(String(arquivo || '').toLowerCase());
}

function getCsvPath(codigo, arquivo) {
  return path.join(CSV_ROOT, String(codigo), String(arquivo).toLowerCase());
}

function safeTokenEquals(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractApiKey(req) {
  const direct = req.get('x-api-key');
  if (direct) return direct;

  const auth = req.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function requireUploadKey(req, res, next) {
  const configuredKey = process.env.CSV_UPLOAD_API_KEY;

  // Segurança por padrão: se a chave não estiver configurada, upload fica indisponível.
  if (!configuredKey) {
    return res.status(503).json({
      error: 'Upload de CSV não configurado.',
      detail: 'Defina CSV_UPLOAD_API_KEY nas variáveis de ambiente do servidor.'
    });
  }

  const receivedKey = extractApiKey(req);
  if (!safeTokenEquals(receivedKey, configuredKey)) {
    return res.status(401).json({ error: 'Chave de integração inválida.' });
  }

  next();
}

async function uploadCsv(req, res) {
  const { codigo, arquivo } = req.params;
  const normalizedFile = String(arquivo || '').toLowerCase();

  if (!isValidCodigo(codigo)) {
    return res.status(400).json({ error: 'Código do município inválido.' });
  }
  if (!isAllowedFile(normalizedFile)) {
    return res.status(400).json({
      error: 'Arquivo não permitido.',
      permitidos: Array.from(ALLOWED_FILES)
    });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({
      error: 'CSV vazio ou não enviado.',
      detail: 'Envie o conteúdo bruto do CSV no corpo da requisição.'
    });
  }

  const dir = path.join(CSV_ROOT, String(codigo));
  const destination = getCsvPath(codigo, normalizedFile);
  const tempFile = `${destination}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(tempFile, req.body);
    // rename no mesmo filesystem: troca o arquivo vigente de forma atômica.
    await fs.promises.rename(tempFile, destination);

    return res.status(200).json({
      ok: true,
      codigo: String(codigo),
      arquivo: normalizedFile,
      bytes: req.body.length,
      atualizadoEm: new Date().toISOString(),
      urlPublica: `${req.protocol}://${req.get('host')}/csv/${encodeURIComponent(codigo)}/${encodeURIComponent(normalizedFile)}`
    });
  } catch (error) {
    try {
      if (fs.existsSync(tempFile)) await fs.promises.unlink(tempFile);
    } catch (_) {
      // ignora erro de limpeza do temporário
    }
    console.error('[CSV] Erro ao salvar arquivo:', error);
    return res.status(500).json({ error: 'Não foi possível salvar o CSV.' });
  }
}

async function serveCsv(req, res) {
  const { codigo, arquivo } = req.params;
  const normalizedFile = String(arquivo || '').toLowerCase();

  if (!isValidCodigo(codigo) || !isAllowedFile(normalizedFile)) {
    return res.status(404).json({ error: 'CSV não encontrado.' });
  }

  const filePath = getCsvPath(codigo, normalizedFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'CSV ainda não recebido nesta instância.',
      codigo: String(codigo),
      arquivo: normalizedFile
    });
  }

  // Sempre entregar a versão mais recente, sem cache intermediário.
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });

  return res.sendFile(filePath);
}

function uploadedCsvExists(codigo, arquivo) {
  if (!isValidCodigo(codigo) || !isAllowedFile(arquivo)) return false;
  return fs.existsSync(getCsvPath(codigo, arquivo));
}

module.exports = {
  requireUploadKey,
  uploadCsv,
  serveCsv,
  getCsvPath,
  uploadedCsvExists
};
