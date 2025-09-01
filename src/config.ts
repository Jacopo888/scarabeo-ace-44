// Centralized API configuration + guards
const raw = import.meta.env.VITE_QUACKLE_SERVICE_URL;
const mode = import.meta.env.MODE;
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

console.log('[Quackle Config] Environment details:', {
  MODE: mode,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
  raw_url: raw,
  isLocalhost
});

// Force Railway URL unless we're explicitly on localhost in development
let resolvedUrl = raw;
if (!raw || (!isLocalhost && raw?.includes('localhost'))) {
  resolvedUrl = 'https://scarabeo-ace-44-production.up.railway.app';
  console.warn('[Quackle Config] Forcing Railway URL:', resolvedUrl);
}

// Final fallback for true local development
if (!resolvedUrl) {
  const isDev = mode === 'development' && isLocalhost;
  if (isDev) {
    resolvedUrl = 'http://localhost:5000';
    console.warn('[Quackle Config] Using localhost fallback for local dev');
  } else {
    throw new Error('VITE_QUACKLE_SERVICE_URL not defined and no valid fallback');
  }
}

export const API_BASE = resolvedUrl.replace(/\/+$/, '');
console.log('[Quackle Config] Final API_BASE:', API_BASE);
export const api = (path: string) => `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

export async function checkHealth() {
  try {
    const res = await fetch(api('/health'), { method: 'GET' });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: text };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
  }
}
