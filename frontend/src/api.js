// frontend/src/api.js

// CRA usa process.env.REACT_APP_*
const envBase = (process.env.REACT_APP_API_BASE || '').replace(/\/+$/, '');

// Também permitimos sobrescrever via window.__API_BASE__ (definido em public/index.html)
const winBase = (typeof window !== 'undefined' && window.__API_BASE__)
  ? String(window.__API_BASE__).replace(/\/+$/, '')
  : '';

// Se nada for definido, não força localhost em produção.
// Deixe vazio para usar same-origin ("/api/..."), que funciona quando o front e o back estão no mesmo domínio.
// Como seu back é outro domínio, defina REACT_APP_API_BASE ou window.__API_BASE__.
export const API_BASE = envBase || winBase || '';

export async function apiFetch(path, opts = {}) {
  const url = API_BASE
    ? `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
    : (path.startsWith('/') ? path : `/${path}`);

  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text || '' }; }
  return { ok: res.ok, status: res.status, data };
}
