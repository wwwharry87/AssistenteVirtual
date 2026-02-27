const crypto = require('crypto');

const DEFAULT_ORIGINS = [
  'https://cr-virtual.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

function parseAllowedOrigins() {
  const fromEnv = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return fromEnv.length ? fromEnv : DEFAULT_ORIGINS;
}

function buildFallbackSecret() {
  const fingerprint = [
    process.env.RENDER_SERVICE_ID,
    process.env.RENDER_GIT_COMMIT,
    process.env.PORT,
    process.cwd()
  ]
    .filter(Boolean)
    .join('|');

  return crypto
    .createHash('sha256')
    .update(fingerprint || 'assistente-virtual-fallback')
    .digest('hex');
}

function resolveSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || '').trim();

  if (secret) return secret;

  console.warn('[config] SESSION_SECRET não definido; usando fallback. Defina SESSION_SECRET em produção.');
  return buildFallbackSecret();
}

module.exports = {
  port: process.env.PORT || 10000,
  sessionSecret: resolveSessionSecret(),
  allowedOrigins: parseAllowedOrigins(),
  isProd: process.env.NODE_ENV === 'production'
};
