import type { GameState, Player, PlacedTile, Tile } from '@/types/game'
import { cloneBoard } from '@/core/board'
import { drawTiles } from './random'
import { isDebugQuackle } from '@/config/debug'
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

  // Update board matrix (immutable clone)
  const nextMatrix = cloneBoard(prev.boardMatrix)
  // COORDINATE TRACE: Log tiles BEFORE writing to matrix
  if (isDebugQuackle && sanitizedTiles.length > 0) {
    console.log('[applyBotMove] 🎯 TRACE - Input sanitizedTiles[0].row:', sanitizedTiles[0].row)
    console.log('[applyBotMove] 🎯 All input rows:', sanitizedTiles.map(t => t.row))
  }
  sanitizedTiles.forEach(tile => {
    if (tile.row >= 0 && tile.row < nextMatrix.length && tile.col >= 0 && tile.col < nextMatrix[0].length) {
      if (nextMatrix[tile.row][tile.col] !== null) {
        // Do not overwrite an existing board square; this indicates a duplicate/overlap from engine
        if (isDebugQuackle) console.warn('[applyBotMove] Skip overwrite at', `${tile.row},${tile.col}`, 'existing:', nextMatrix[tile.row][tile.col], 'incoming:', tile)
        return
      }
      nextMatrix[tile.row][tile.col] = {
        letter: tile.letter,
        points: tile.points,
        row: tile.row,
        col: tile.col,
        isBlank: tile.isBlank || false
      }
      // COORDINATE TRACE: Log what we just wrote
      if (isDebugQuackle) {
        console.log(`[applyBotMove] 🎯 TRACE - Wrote to nextMatrix[${tile.row}][${tile.col}]:`, nextMatrix[tile.row][tile.col])
      }
    }
  })

  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const newRack: Tile[] = [...currentPlayer.rack]
  // eslint-disable-next-line no-console
  if (isDebugQuackle) console.log('[applyBotMove] Rack before:', newRack.map(t => ({ L: t.letter, P: t.points, B: !!t.isBlank })))
  // eslint-disable-next-line no-console
  if (isDebugQuackle) console.log('[applyBotMove] Using tiles:', sanitizedTiles.map(t => ({ L: t.letter, P: t.points, B: !!t.isBlank })))
  sanitizedTiles.forEach(usedTile => {
    const idx = newRack.findIndex(t => {
      if (usedTile.isBlank && t.isBlank) return true
      return (t.letter || '').toUpperCase() === usedTile.letter && t.points === usedTile.points
    })
    if (idx !== -1) newRack.splice(idx, 1)
  })
  // eslint-disable-next-line no-console
  if (isDebugQuackle) console.log('[applyBotMove] Rack after removal:', newRack.map(t => ({ L: t.letter, P: t.points, B: !!t.isBlank })))

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

  // Finish only when the current player has emptied their rack and the bag is empty
  const currentEmptiedAndBagEmpty = remaining.length === 0 && newPlayers[prev.currentPlayerIndex].rack.length === 0
  const endGame = currentEmptiedAndBagEmpty || canEndGame(
    newPlayers.map(p => ({ rack: p.rack })),
    remaining
  )

  if (currentEmptiedAndBagEmpty || endGame) {
    // eslint-disable-next-line no-console
  if (isDebugQuackle) console.log('[applyBotMove] Finishing game:', {
      remaining: remaining.length,
      rackLen: newPlayers[prev.currentPlayerIndex].rack.length,
      currentEmptiedAndBagEmpty,
      endGame
    })
    const finalPlayers: Player[] = computeFinalPlayers(newPlayers)
    return {
      finished: true,
      next: {
        ...prev,
        boardMatrix: nextMatrix,
        players: finalPlayers,
        tileBag: remaining,
        gameStatus: 'finished',
        passCounts: newPassCounts,
        lastMove: sanitizedTiles
      }
    }
  }

  // eslint-disable-next-line no-console
  if (isDebugQuackle) console.log('[applyBotMove] Continuing game (advance turn):', {
    remaining: remaining.length,
    rackLen: newPlayers[prev.currentPlayerIndex].rack.length
  })
  return {
    finished: false,
    next: {
      ...prev,
      boardMatrix: nextMatrix,
      players: newPlayers,
      tileBag: remaining,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      passCounts: newPassCounts,
      lastMove: sanitizedTiles
    }
  }
}
