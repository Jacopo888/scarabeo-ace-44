const API_BASE = (() => {
  const url = import.meta.env.VITE_RATING_API_URL
  if (import.meta.env.MODE === 'development') {
    return '/api'
  }
  // Only use external URL if it's valid and not localhost in production
  if (url && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url
  }
  return '' // Disable API calls if no valid production URL
})()

export interface AnalysisMove {
  row: number
  col: number
  dir: 'H' | 'V'
  word: string
  score: number
  rackBefore: string
}

export interface AnalysisRequest {
  moves: AnalysisMove[]
  boardSize: number
  lexicon: 'NWL' | 'CSW' | 'ITA'
}

export interface MissedOpportunity {
  turn: number
  betterWord: string
  scoreGain: number
  coords: [number, number]
  dir: 'H' | 'V'
}

export interface BingoChance {
  turn: number
  found: boolean
  bestBingo?: string
  score?: number
}

export interface TimelineEntry {
  turn: number
  my: number
  opp: number
  cumMy: number
  cumOpp: number
}

export interface RackAdvice {
  turn: number
  keep: string
  note: string
}

export interface AnalysisResponse {
  missed: MissedOpportunity[]
  bingoChances: BingoChance[]
  timeline: TimelineEntry[]
  rackAdvice: RackAdvice[]
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export async function postAnalysis(payload: AnalysisRequest): Promise<AnalysisResponse> {
  if (!API_BASE) {
    throw new Error('Game analysis is not available in this environment')
  }

  const response = await fetchWithTimeout(`${API_BASE}/analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Analysis failed: ${response.status} - ${errorText}`)
  }
  // Guard against HTML or non-JSON responses (e.g. proxies returning index.html)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text().catch(() => '')
    throw new Error(text ? `Analysis service returned non-JSON response: ${text.slice(0, 180)}...` : 'Analysis service returned non-JSON response')
  }
  try {
    return await response.json()
  } catch (err) {
    const text = await response.text().catch(() => '')
    throw new Error(text ? `Invalid JSON from analysis service: ${text.slice(0, 180)}...` : 'Invalid JSON from analysis service')
  }
}