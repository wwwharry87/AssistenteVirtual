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

function resolveSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret && isProd) {
    throw new Error('SESSION_SECRET é obrigatório em produção.');
  }

  return secret || 'dev-only-secret-change-me';
}

module.exports = {
  port: process.env.PORT || 10000,
  sessionSecret: resolveSessionSecret(),
  allowedOrigins: parseAllowedOrigins(),
  isProd: process.env.NODE_ENV === 'production'
};
