import type { PlacedTile } from '@/types/game';
import { API_BASE, api } from '@/config';

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
    throw new Error(maybeCORS
      ? `[CORS/Network] ${msg} — Verifica CORS_ORIGINS su backend e dominio frontend.`
      : msg);
  }
}

export async function quackleHealth(): Promise<{ ok: boolean; status: number; body: string; base: string; }> {
  const r = await fetchWithTimeout(api('/health'), { method: 'GET' }, 5000);
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, body, base: API_BASE };
}

export async function quackleBestMove(payload: any): Promise<QuackleMove> {
  const r = await fetchWithTimeout(api('/best-move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 15000);

  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`best-move failed: ${r.status} ${txt.slice(0,180)}`);
  }
  return await r.json();
}

export function getQuackleBase() { return API_BASE; }
