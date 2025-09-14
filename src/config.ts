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

// Resolve API base: prefer localhost in dev on local machine
let resolvedUrl = raw;
const isDevLocal = mode === 'development' && isLocalhost;
if (isDevLocal) {
  resolvedUrl = raw && raw.trim() ? raw : 'http://localhost:5000';
  console.warn('[Quackle Config] Dev on localhost: using', resolvedUrl);
} else if (!resolvedUrl) {
  // Fallbacks
  resolvedUrl = 'https://service-quackle-production.up.railway.app';
  console.warn('[Quackle Config] Using Railway fallback');
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

export async function checkLexiconHealth() {
  try {
    const res = await fetch(api('/health/lexicon'), { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: String(error) } };
  }
}
