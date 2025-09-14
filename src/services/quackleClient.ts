import type { PlacedTile } from '@/types/game';
import { QUACKLE_SERVICE_URL, quackleApi } from '@/config/quackle';

export interface QuackleMove {
  tiles: PlacedTile[];
  score: number;
  words: string[];
  move_type: string;
  engine_fallback?: boolean;
  error?: string;
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal, mode: 'cors' as RequestMode });
    clearTimeout(t);
    return res;
  } catch (e: any) {
    clearTimeout(t);
    // Heuristica CORS: TypeError: Failed to fetch/NetworkError
    const msg = String(e?.message || e);
    const maybeCORS = /Failed to fetch|NetworkError|TypeError/i.test(msg);
    // Log structured error for diagnostics
    try { console.error({ tag: 'quackle_fetch_error', url, err: e }); } catch {}
    throw new Error(maybeCORS
      ? `[CORS/Network] ${msg} — Verifica CORS_ORIGINS su backend e dominio frontend.`
      : msg);
  }
}

export async function quackleHealth(): Promise<{ ok: boolean; status: number; body: string; base: string; error?: string; }> {
  try {
    console.log('[Quackle Debug] Attempting health check to:', quackleApi('/health'));
    console.log('[Quackle Debug] API_BASE:', QUACKLE_SERVICE_URL);
    
    const r = await fetchWithTimeout(quackleApi('/health'), { method: 'GET' }, 5000);
    const body = await r.text().catch(() => '');
    
    console.log('[Quackle Debug] Health response:', { ok: r.ok, status: r.status, body: body.slice(0, 100) });
    
    return { ok: r.ok, status: r.status, body, base: QUACKLE_SERVICE_URL };
  } catch (error: any) {
    const errorMsg = String(error?.message || error);
    console.error('[Quackle Debug] Health check failed:', errorMsg);
    console.error('[Quackle Debug] Error details:', error);
    
    // Detect specific error types
    const isCORSError = /Failed to fetch|NetworkError|TypeError|CORS/i.test(errorMsg);
    const isTimeoutError = /timeout|aborted/i.test(errorMsg);
    
    return { 
      ok: false, 
      status: 0, 
      body: '', 
      base: QUACKLE_SERVICE_URL, 
      error: isCORSError ? 'CORS_ERROR' : isTimeoutError ? 'TIMEOUT_ERROR' : 'UNKNOWN_ERROR'
    };
  }
}

export async function quackleBestMove(payload: any): Promise<QuackleMove> {
  const r = await fetchWithTimeout(quackleApi('/best-move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 15000);

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    // Surface server-side validation/network errors to the caller
    throw new Error(`best-move failed: ${r.status} ${txt.slice(0,180)}`);
  }
  const data = await r.json();
  if (data && (data.engine_fallback === true) && data.error) {
    // Do not mask engine/bridge errors as a pass
    const errMsg = `[bridge] ${data.error}`;
    console.error('[quackleClient] Engine fallback with error:', data);
    throw new Error(errMsg);
  }
  return data;
}

export async function quackleCors(): Promise<{ allow_origins: string[]; status: number }> {
  const r = await fetchWithTimeout(quackleApi('/health/cors'), { method: 'GET' }, 5000);
  const json = await r.json().catch(() => ({}));
  return { allow_origins: Array.isArray(json.allow_origins) ? json.allow_origins : [], status: r.status };
}

export function getQuackleBase() { return QUACKLE_SERVICE_URL; }
