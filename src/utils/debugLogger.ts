/**
 * Clean debug logger for game moves
 * Formato: rack → mossa (score)
 */

import type { PlacedTile, Tile } from '@/types/game'
import type { QuackleMove } from '@/services/quackleClient'

/**
 * Formatta il rack in modo leggibile
 */
export function formatRack(rack: Tile[] | string): string {
  if (typeof rack === 'string') {
    return rack
  }
  return rack
    .map(t => {
      const letter = (t.letter || '?').toUpperCase()
      if (t.isBlank) return `[${letter}]` // blanks tra parentesi
      return letter
    })
    .join('')
}

/**
 * Formatta la mossa in modo leggibile
 */
export function formatMove(tiles: PlacedTile[], words: string[], score: number): string {
  if (!tiles || tiles.length === 0) {
    return 'PASS'
  }
  
  const wordStr = words.length > 0 ? words.join(', ') : '?'
  const tileStr = tiles
    .map(t => {
      const letter = (t.letter || '?').toUpperCase()
      if (t.isBlank) return `[${letter}]`
      return letter
    })
    .join('')
  
  return `${wordStr} (${tileStr}) → ${score} pts`
}

/**
 * Log pulito per mossa di Quackle (AI)
 */
export function logQuackleMove(rack: Tile[] | string, move: QuackleMove | null): void {
  if (!move) {
    console.log(`🤖 Quackle: ${formatRack(rack)} → ERROR (no move)`)
    return
  }

  const rackStr = formatRack(rack)
  
  if (move.move_type === 'pass' || !move.tiles || move.tiles.length === 0) {
    console.log(`🤖 Quackle: ${rackStr} → PASS`)
    return
  }

  const moveStr = formatMove(move.tiles, move.words || [], move.score || 0)
  console.log(`🤖 Quackle: ${rackStr} → ${moveStr}`)
}

/**
 * Log pulito per mossa del giocatore
 */
export function logPlayerMove(
  playerName: string,
  rack: Tile[],
  tiles: PlacedTile[],
  words: string[],
  score: number
): void {
  const rackStr = formatRack(rack)
  const moveStr = formatMove(tiles, words, score)
  console.log(`👤 ${playerName}: ${rackStr} → ${moveStr}`)
}

/**
 * Log per exchange/pass del giocatore
 */
export function logPlayerAction(playerName: string, rack: Tile[], action: 'pass' | 'exchange', exchangedCount?: number): void {
  const rackStr = formatRack(rack)
  if (action === 'exchange') {
    console.log(`👤 ${playerName}: ${rackStr} → EXCHANGE (${exchangedCount || 0} tiles)`)
  } else {
    console.log(`👤 ${playerName}: ${rackStr} → PASS`)
  }
}
