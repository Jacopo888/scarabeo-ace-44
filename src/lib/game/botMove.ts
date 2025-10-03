import type { GameState, Player, PlacedTile, Tile } from '@/types/game'
import { cloneBoard, createEmptyBoard } from '@/core/board'
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

  const newBoard = new Map(prev.board)
  sanitizedTiles.forEach(tile => {
    const key = `${tile.row},${tile.col}`
    if (newBoard.has(key)) {
      // Do not overwrite an existing board square; this indicates a duplicate/overlap from engine
      if (isDebugQuackle) console.warn('[applyBotMove] Skip overwrite at', key, 'existing:', newBoard.get(key), 'incoming:', tile)
      return
    }
    newBoard.set(key, {
      letter: tile.letter,
      points: tile.points,
      row: tile.row,
      col: tile.col,
      isBlank: tile.isBlank || false
    })
  })

  // Shadow-write boardMatrix if present
  const nextMatrix = (() => {
    const matrix = prev.boardMatrix
    if (matrix) {
      const cloned = cloneBoard(matrix)
      sanitizedTiles.forEach(t => {
        if (t.row >= 0 && t.row < cloned.length && t.col >= 0 && t.col < cloned[0].length) {
          if (cloned[t.row][t.col] === null) {
            cloned[t.row][t.col] = { ...t }
          }
        }
      })
      return cloned
    }
    // Build matrix from newBoard Map if not existing
    const built = createEmptyBoard()
    newBoard.forEach((pt, key) => {
      const [rStr, cStr] = key.split(',')
      const r = Number(rStr), c = Number(cStr)
      if (Number.isFinite(r) && Number.isFinite(c) && r >= 0 && c >= 0 && r < built.length && c < built[0].length) {
        built[r][c] = { ...pt }
      }
    })
    return built
  })()

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
        board: newBoard,
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
      board: newBoard,
  boardMatrix: nextMatrix,
      players: newPlayers,
      tileBag: remaining,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      passCounts: newPassCounts,
      lastMove: sanitizedTiles
    }
  }
}
