import type { PlacedTile } from '@/types/game'

const BASE = (import.meta as any).env.VITE_QUACKLE_SERVICE_URL?.replace(/\/+$/, '')

export interface QuackleMove {
  tiles: PlacedTile[]
  score: number
  words: string[]
  move_type: string
  engine_fallback?: boolean
}

export async function quackleHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { method: 'GET' })
    if (!r.ok) return false
    const j = await r.json()
    return j?.status === 'ok'
  } catch {
    return false
  }
}

export async function quackleBestMove(payload: any): Promise<QuackleMove> {
  const r = await fetch(`${BASE}/best-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!r.ok) throw new Error('best-move failed')
  return await r.json()
}

export function getQuackleBase() {
  return BASE
}
