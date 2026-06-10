import type { PlacedTile } from '@/types/game';
import { QUACKLE_SERVICE_URL, quackleApi } from '@/config/quackle';
import { qlog, qerror, isDebugQuackle } from '@/config/debug'
import { fetchWithTimeout, classifyNetworkError, type NetworkErrorCode } from './http'

export interface QuackleHealthResult {
  ok: boolean
  status: number
  body: string
  base: string
  data?: {
    engine_ready?: boolean
    lexicon?: string
    strategy_ready?: boolean
    binary_present?: boolean
    [key: string]: unknown
  }
  engineReady?: boolean
  error?: NetworkErrorCode
}

export interface QuackleMove {
  tiles: PlacedTile[];
  score: number;
  words: string[];
  move_type: string;
  // Raw engine metadata (added for direct pass-through, may be undefined if engine omits)
  start_row?: number;
  start_col?: number;
  direction?: string;
  word?: string;
  exchange_count?: number;
  engine_fallback?: boolean;
  engine_info?: {
    hl_strict: boolean;
    path: 'hl' | 'gen' | 'endgame';
    kibitz_len: number;
    search_width?: number;
    used_endgame_solver?: boolean;
    used_simulator?: boolean;
    strategy_set?: string;
    status?: 'simulating' | 'endgame' | 'static';
  };
  error?: string;
  exchange_letters?: string[] // e.g., ['A','E','?'] '?' indicates blank
  exchange_blind?: boolean
}

// fetchWithTimeout now provided by ./http

export async function quackleHealth(): Promise<QuackleHealthResult> {
  try {
    qlog('[Quackle Debug] Attempting health check to:', quackleApi('/health'));
    qlog('[Quackle Debug] API_BASE:', QUACKLE_SERVICE_URL);
    
    const r = await fetchWithTimeout(quackleApi('/health'), { method: 'GET' }, 5000);
    const body = await r.text().catch(() => '');
    const data = (() => {
      try {
        const parsed = JSON.parse(body)
        return parsed && typeof parsed === 'object' ? parsed : undefined
      } catch {
        return undefined
      }
    })()
    const engineReady = data?.engine_ready === true
    
    qlog('[Quackle Debug] Health response:', { ok: r.ok, status: r.status, body: body.slice(0, 100) });
    
    return { ok: r.ok && engineReady, status: r.status, body, base: QUACKLE_SERVICE_URL, data, engineReady };
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
      engineReady: false,
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
  // Hoist engine_info reference for later debug logging
  const ei: any = (data && typeof data === 'object') ? (data.engine_info as any) : null
  
  // DEEP DEBUG: Log raw response from bridge (enabled when isDebugQuackle)
  if (isDebugQuackle && data) {
    const pathInfo = ei && typeof ei === 'object' ? `path=${ei.path} strict=${ei.hl_strict} k=${ei.kibitz_len}` : 'path=?'
    qlog('[quackleClient] 🔍 RAW BRIDGE RESPONSE:', {
      score: data.score,
      move_type: data.move_type,
      words: data.words,
      tiles_count: Array.isArray(data.tiles) ? data.tiles.length : 0,
      first_tile: Array.isArray(data.tiles) ? data.tiles[0] : undefined,
      engine_info: ei || null,
      summary: pathInfo,
    })
  }
  // COORDINATE TRACE: Log EXACT row values from API response (always when debug enabled)
  if (isDebugQuackle && Array.isArray(data?.tiles) && data.tiles.length > 0) {
    try {
      console.log('[quackleClient] 🎯 COORDINATE TRACE - API Response tiles[0].row:', data.tiles[0].row, 'typeof:', typeof data.tiles[0].row)
      console.log('[quackleClient] 🎯 All tile rows from API:', data.tiles.map((t: any) => t.row))
      if (data.raw_move && typeof data.raw_move === 'object') {
        console.log('[quackleClient] 🎯 RAW_MOVE center trace:', { row: data.raw_move.row, col: data.raw_move.col, dir: data.raw_move.dir, positions: data.raw_move.positions })
      }
    } catch {}
    try {
      if (ei && typeof ei === 'object') {
        if (ei.used_simulator || ei.status === 'simulating') {
          qlog('[quackleClient] 🧪 Monte Carlo simulator USED')
        } else if (ei.path === 'endgame' || ei.used_endgame_solver || ei.status === 'endgame') {
          qlog('[quackleClient] 🧮 Endgame solver USED')
        }
      }
    } catch {}
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
