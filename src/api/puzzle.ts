// Use Supabase Edge Function URL directly
const API_BASE = 'https://qjpvhhijujqblazdlfeg.supabase.co/functions/v1'

import type { Tile, PlacedTile } from '@/types/game'

export interface PuzzleResponse {
  puzzleId: string
  board: PlacedTile[]
  rack: Tile[]
  bestScore: number
}

export interface PuzzleScoreRequest {
  puzzleId: string
  userId: string
  score: number
}

export interface PuzzleLeaderboardEntry {
  id: string
  user_id: string
  puzzle_id: string
  score: number
  created_at: string
}

// Safe JSON parsing to avoid crashes on HTML responses
async function safeJsonParse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Server returned ${contentType}, expected JSON`)
  }
  
  try {
    return await response.json()
  } catch (error) {
    throw new Error('Invalid JSON response from server')
  }
}

// Fetch with timeout to prevent hanging
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server not responding')
    }
    throw error
  }
}

export async function fetchPuzzle(): Promise<PuzzleResponse> {
  // If no API base URL, fail fast to trigger local fallback
  if (!API_BASE) {
    throw new Error('Rating API not configured - using local fallback')
  }
  
  const response = await fetchWithTimeout(`${API_BASE}/puzzle/new`)
  if (!response.ok) {
    throw new Error(`Failed to fetch puzzle: ${response.status} ${response.statusText}`)
  }
  return safeJsonParse<PuzzleResponse>(response)
}

export async function submitPuzzleScore(data: PuzzleScoreRequest): Promise<void> {
  if (!API_BASE) {
    throw new Error('Rating API not configured - scores cannot be saved')
  }
  
  const response = await fetchWithTimeout(`${API_BASE}/puzzle/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Failed to submit score: ${response.status} - ${errorText}`)
  }
}

export async function fetchPuzzleLeaderboard(limit = 50): Promise<PuzzleLeaderboardEntry[]> {
  if (!API_BASE) {
    throw new Error('Rating API not configured - leaderboard unavailable')
  }
  
  const response = await fetchWithTimeout(`${API_BASE}/puzzle/leaderboard?limit=${limit}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`)
  }
  return safeJsonParse<PuzzleLeaderboardEntry[]>(response)
}