import type { PlacedTile } from '@/types/game';
import { QUACKLE_SERVICE_URL, quackleApi } from '@/config/quackle';
import { qlog, qerror } from '@/config/debug'
import { fetchWithTimeout, classifyNetworkError, type NetworkErrorCode } from './http'

export interface QuackleHealthResult {
  ok: boolean
  status: number
  body: string
  base: string
  error?: NetworkErrorCode
}

export interface QuackleMove {
  tiles: PlacedTile[];
  score: number;
  words: string[];
  move_type: string;
  engine_fallback?: boolean;
  error?: string;
}

// fetchWithTimeout now provided by ./http

export async function quackleHealth(): Promise<QuackleHealthResult> {
  try {
    qlog('[Quackle Debug] Attempting health check to:', quackleApi('/health'));
    qlog('[Quackle Debug] API_BASE:', QUACKLE_SERVICE_URL);
    
    const r = await fetchWithTimeout(quackleApi('/health'), { method: 'GET' }, 5000);
    const body = await r.text().catch(() => '');
    
    qlog('[Quackle Debug] Health response:', { ok: r.ok, status: r.status, body: body.slice(0, 100) });
    
    return { ok: r.ok, status: r.status, body, base: QUACKLE_SERVICE_URL };
  } catch (error: any) {
    const errorMsg = String(error?.message || error);
    qerror('[Quackle Debug] Health check failed:', errorMsg);
    qerror('[Quackle Debug] Error details:', error);
    
    // Detect specific error types
    const code = classifyNetworkError(errorMsg)
    
    return { 
      ok: false, 
      status: 0, 
      body: '', 
      base: QUACKLE_SERVICE_URL, 
      error: code
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
  
  // DEEP DEBUG: Log raw response from bridge
  if (import.meta.env.DEV && data?.tiles?.length > 0) {
    console.log('[quackleClient] 🔍 RAW BRIDGE RESPONSE:', {
      score: data.score,
      move_type: data.move_type,
      words: data.words,
      tiles_count: data.tiles?.length,
      first_tile: data.tiles?.[0]
    })
  }
  
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

export async function quackleLexiconHealth(): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetchWithTimeout(quackleApi('/health/lexicon'), { method: 'GET' }, 5000);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export function getQuackleBase() { return QUACKLE_SERVICE_URL; }

export async function quackleBagSummary(payload: any): Promise<{
  unseen_count: number;
  unseen_by_letter: Record<string, number>;
  unseen_pool: string[];
  bag_count: number;
  bag_by_letter: Record<string, number>;
  bag_pool: string[];
  remaining_count?: number; // back-compat alias
  remaining_by_letter?: Record<string, number>; // back-compat alias
}> {
  const r = await fetchWithTimeout(quackleApi('/bag/summary'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 10000);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`bag-summary failed: ${r.status} ${txt.slice(0,180)}`);
  }
  return r.json();
}
