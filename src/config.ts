// Centralized API configuration
const raw = import.meta.env.VITE_QUACKLE_SERVICE_URL ?? '';
export const API_BASE = raw.replace(/\/+$/, ''); // Remove trailing slash

export const api = (path: string) =>
  `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

// Health check function for debugging
export async function checkHealth() {
  try {
    const res = await fetch(api('/health'));
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (error) {
    return { ok: false, status: 0, body: `Error: ${error}` };
  }
}