import type { GameRecord } from '@/types/multiplayer'

export type RatingMode = 'blitz' | 'rapid' | 'async'

const API_BASE = import.meta.env.VITE_RATING_API_URL || (import.meta.env.MODE === 'development' ? '/api' : '')

export function modeFromTurnDuration(dur: GameRecord['turn_duration'] | null | undefined): RatingMode {
  return dur === '1h' ? 'blitz' : dur === '6h' ? 'rapid' : 'async'
}

export async function reportGameResult(game: GameRecord, winnerId?: string | null): Promise<void> {
  try {
    if (!API_BASE) return
    const mode = modeFromTurnDuration(game.turn_duration)
    await fetch(`${API_BASE}/rating/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player1Id: Number(game.player1_id),
        player2Id: Number(game.player2_id),
        winnerId: winnerId ? Number(winnerId) : null,
        mode
      })
    })
  } catch (err) {
    console.error('rating report error', err)
  }
}
