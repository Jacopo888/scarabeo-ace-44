import type { PlacedTile } from '@/types/game'

// Decide whether a bot response should be treated as a pass
// Rules: missing move, move_type === 'pass', or sanitizedTiles empty
export function shouldPassBotMove(move: any, sanitizedTiles: PlacedTile[]): boolean {
  if (!move) return true
  if (move.move_type === 'pass') return true
  if (!Array.isArray(sanitizedTiles) || sanitizedTiles.length === 0) return true
  return false
}
