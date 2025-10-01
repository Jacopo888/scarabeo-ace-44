export type NetworkErrorCode = 'CORS_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN_ERROR'
import { qerror } from '@/config/debug'

export function classifyNetworkError(message: string): NetworkErrorCode {
  const msg = message || ''
  // AbortController abort or timeout
  if (/timeout|aborted/i.test(msg)) return 'TIMEOUT_ERROR'
  // Typical browser fetch CORS errors are surfaced as "Failed to fetch" or "NetworkError"; some runtimes include the word CORS
  if (/Failed to fetch|NetworkError|CORS/i.test(msg)) return 'CORS_ERROR'
  // Generic TypeError is too broad and often used for many other issues; don't misclassify as CORS
  return 'UNKNOWN_ERROR'
}

export async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal, mode: 'cors' as RequestMode })
    clearTimeout(t)
    return res
  } catch (e: any) {
    clearTimeout(t)
    const msg = String(e?.message || e)
  // Log structured error for diagnostics (best-effort)
  try { qerror({ tag: 'quackle_fetch_error', url, err: e }) } catch {}
    // Maintain previous thrown message format for callers, using the classifier
    const code = classifyNetworkError(msg)
    if (code === 'CORS_ERROR') {
      throw new Error(`[CORS/Network] ${msg} — Verifica CORS_ORIGINS su backend e dominio frontend.`)
    }
    if (code === 'TIMEOUT_ERROR') {
      throw new Error(`[Timeout] ${msg}`)
    }
    throw new Error(msg)
  }
}
