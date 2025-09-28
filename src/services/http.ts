export type NetworkErrorCode = 'CORS_ERROR' | 'TIMEOUT_ERROR' | 'UNKNOWN_ERROR'

export function classifyNetworkError(message: string): NetworkErrorCode {
  const msg = message || ''
  if (/timeout|aborted/i.test(msg)) return 'TIMEOUT_ERROR'
  if (/Failed to fetch|NetworkError|TypeError|CORS/i.test(msg)) return 'CORS_ERROR'
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
    try { console.error({ tag: 'quackle_fetch_error', url, err: e }) } catch {}
    // Maintain previous thrown message format for callers
    const maybeCORS = /Failed to fetch|NetworkError|TypeError/i.test(msg)
    throw new Error(maybeCORS
      ? `[CORS/Network] ${msg} — Verifica CORS_ORIGINS su backend e dominio frontend.`
      : msg)
  }
}
