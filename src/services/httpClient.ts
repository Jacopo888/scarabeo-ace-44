const API_BASE = import.meta.env.VITE_API_URL || '/api'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: any
  timeoutMs?: number
  idempotencyKey?: string
}

export async function httpRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Request failed: ${res.status} ${text}`)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return res.json() as Promise<T>
    // @ts-expect-error generic unknown text
    return res.text()
  } finally {
    clearTimeout(timeout)
  }
}

// Back-compat: minimal wrapper similar to existing api client
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const body = (options as any).body
  const headers = (options.headers as Record<string, string>) || {}
  return httpRequest<T>(path, {
    method: (options.method as HttpMethod) || 'GET',
    headers,
    body: body ? JSON.parse(body) : undefined,
    timeoutMs: 15000,
  })
}
