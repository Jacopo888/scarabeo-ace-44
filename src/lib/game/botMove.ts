import type { GameState, Player, PlacedTile, Tile } from '@/types/game'
import { drawTiles } from './random'
import { canEndGame } from '@/utils/gameRules'
import { computeFinalPlayers } from './endgame'

export interface BotMovePayload {
  sanitizedTiles: PlacedTile[]
  score: number
  words: string[]
}

// Apply a sanitized Quackle move to the given game state, returning the next state and whether the game finished.
export function applyBotMove(prev: GameState, payload: BotMovePayload): { next: GameState; finished: boolean } {
  const { sanitizedTiles, score } = payload

  const newBoard = new Map(prev.board)
  sanitizedTiles.forEach(tile => {
    const key = `${tile.row},${tile.col}`
    newBoard.set(key, {
      letter: tile.letter,
      points: tile.points,
      row: tile.row,
      col: tile.col,
      isBlank: tile.isBlank || false
    })
  })

  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const newRack: Tile[] = [...currentPlayer.rack]
  sanitizedTiles.forEach(usedTile => {
    const idx = newRack.findIndex(t => {
      if (usedTile.isBlank && t.isBlank) return true
      return (t.letter || '').toUpperCase() === usedTile.letter && t.points === usedTile.points
    })
    if (idx !== -1) newRack.splice(idx, 1)
  })

  const tilesNeeded = 7 - newRack.length
  const { drawn, remaining } = tilesNeeded > 0 && prev.tileBag.length > 0
    ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
    : { drawn: [], remaining: prev.tileBag }

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    score: currentPlayer.score + score,
    rack: [...newRack, ...drawn]
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0

  const endGame = canEndGame(
    newPlayers.map(p => ({ rack: p.rack })),
    remaining
  )

  if (endGame) {
    const finalPlayers: Player[] = computeFinalPlayers(newPlayers)
    return {
      finished: true,
      next: {
        ...prev,
        board: newBoard,
        players: finalPlayers,
        tileBag: remaining,
        gameStatus: 'finished',
        passCounts: newPassCounts,
        lastMove: sanitizedTiles
      }
    }
  }

  return {
    finished: false,
    next: {
      ...prev,
      board: newBoard,
      players: newPlayers,
      tileBag: remaining,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      passCounts: newPassCounts,
      lastMove: sanitizedTiles
    }
  }
}
