import type { GameRecord } from '@/types/multiplayer'
import type { PlacedTile, Tile } from '@/types/game'

export function getOpponentInfo(game: GameRecord, userId: string) {
  const isPlayer1 = game.player1_id === userId
  const opponent = isPlayer1 ? game.player2 : game.player1
  return {
    id: isPlayer1 ? game.player2_id : game.player1_id,
    name: opponent?.display_name || opponent?.username || 'Opponent',
    score: isPlayer1 ? game.player2_score : game.player1_score,
  }
}

export function getMyScore(game: GameRecord, userId: string): number {
  return game.player1_id === userId ? game.player1_score : game.player2_score
}

/**
 * Returns the current rack for the user, subtracting any pending placements.
 * Pending matching considers blanks and duplicates by matching exact tile properties.
 */
export function getCurrentRack(
  game: GameRecord,
  userId: string,
  pendingTiles: PlacedTile[]
): Tile[] {
  const baseRack = game.player1_id === userId ? game.player1_rack : game.player2_rack
  const rackCopy = [...baseRack]
  for (const tile of pendingTiles) {
    const index = rackCopy.findIndex(r => {
      if (tile.isBlank && r.isBlank) return true
      return r.letter === tile.letter && r.points === tile.points && r.isBlank === tile.isBlank
    })
    if (index !== -1) rackCopy.splice(index, 1)
  }
  return rackCopy
}
