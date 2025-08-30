// Centralized API configuration + guards
const raw = import.meta.env.VITE_QUACKLE_SERVICE_URL;

// Fail fast in production; fallback comodo in dev
if (!raw) {
  const isDev = import.meta.env.MODE === 'development';
  if (isDev) {
    console.warn('[Quackle] VITE_QUACKLE_SERVICE_URL non definita. Uso http://localhost:5000');
  } else {
    throw new Error('VITE_QUACKLE_SERVICE_URL non è definita. Impostala nelle env di build.');
  }
}

export const API_BASE = (raw || 'http://localhost:5000').replace(/\/+$/, '');
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
