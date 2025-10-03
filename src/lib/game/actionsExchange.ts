import type { GameState, Player, Tile } from '@/types/game'
import { shuffleArray, drawTiles } from './random'

export function applyExchangeTiles(prev: GameState): GameState {
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const rackSize = currentPlayer.rack.length

  // Not enough tiles in bag to exchange (require at least 2 tiles available as per common rule)
  if (prev.tileBag.length < Math.max(2, rackSize)) return prev

  const bagWithReturned = shuffleArray([...prev.tileBag, ...currentPlayer.rack])
  const { drawn, remaining } = drawTiles(bagWithReturned, rackSize)

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: drawn
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0

  return {
    ...prev,
    players: newPlayers,
    tileBag: remaining,
    currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    passCounts: newPassCounts
  }
}

// Exchange only the selected rack indices for the current player
export function applyExchangeSelected(prev: GameState, indexes: number[]): GameState {
  if (!indexes || indexes.length === 0) return prev
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const rack: Tile[] = currentPlayer.rack
  const unique = Array.from(new Set(indexes.filter(i => i >= 0 && i < rack.length))).sort((a,b)=>a-b)
  const count = unique.length
  if (prev.tileBag.length < Math.max(2, count)) return prev

  // Tiles to return to bag
  const toReturn: Tile[] = unique.map(i => rack[i])
  // Build new rack by removing the selected indexes
  const newRackBase: Tile[] = rack.filter((_, i) => !unique.includes(i))
  const bagWithReturned = shuffleArray([...prev.tileBag, ...toReturn])
  const { drawn, remaining } = drawTiles(bagWithReturned, count)

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: [...newRackBase, ...drawn]
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0

  return {
    ...prev,
    players: newPlayers,
    tileBag: remaining,
    currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    passCounts: newPassCounts
  }
}

// Apply a bot exchange using explicit letters (like ['A','N','D'] or '?' for blanks)
export function applyBotExchange(prev: GameState, letters: string[] | null | undefined, countHint?: number): GameState {
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const rack: Tile[] = currentPlayer.rack
  const lettersNorm = Array.isArray(letters) ? letters.map(l => (l || '').toUpperCase()).filter(Boolean) : []
  const count = lettersNorm.length > 0 ? lettersNorm.length : Math.max(0, Math.min(countHint || 0, rack.length))
  if (count <= 0) return prev

  // Remove from rack by matching letters if provided, otherwise remove first count
  const toReturn: Tile[] = []
  const rackCopy: Tile[] = [...rack]
  if (lettersNorm.length > 0) {
    for (const L of lettersNorm) {
      const idx = rackCopy.findIndex(t => {
        if (L === '?') return !!t.isBlank
        return (t.letter || '').toUpperCase() === L && !t.isBlank
      })
      if (idx !== -1) {
        toReturn.push(rackCopy[idx])
        rackCopy.splice(idx, 1)
      }
    }
  }
  // Fallback if we couldn't match enough tiles
  while (toReturn.length < count && rackCopy.length > 0) {
    toReturn.push(rackCopy.shift() as Tile)
  }

  const bagWithReturned = shuffleArray([...prev.tileBag, ...toReturn])
  const { drawn, remaining } = drawTiles(bagWithReturned, toReturn.length)

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    rack: [...rackCopy, ...drawn]
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0

  return {
    ...prev,
    players: newPlayers,
    tileBag: remaining,
    currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    passCounts: newPassCounts
  }
}
