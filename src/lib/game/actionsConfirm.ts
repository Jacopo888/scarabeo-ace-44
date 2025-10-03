import type { GameState, PlacedTile, Player, Tile } from '@/types/game'
import { cloneBoard, createEmptyBoard } from '@/core/board'
import { drawTiles } from './random'
import { canEndGame } from '@/utils/gameRules'
import { computeFinalPlayers } from './endgame'

export interface ConfirmDeps {
  validateMoveLogic: (board: Map<string, PlacedTile>, pending: PlacedTile[]) => { isValid: boolean; errors: string[] }
  findNewWordsFormed: (board: Map<string, PlacedTile>, pending: PlacedTile[]) => Array<{ word: string }>
  // Unified API: calculate full score from tiles and board (required)
  calculateScore: (opts: { tiles: PlacedTile[]; existingBoard: Map<string, PlacedTile>; context?: 'player' | 'quackle' }) => number
  isValidWord: (w: string) => boolean
}

export type ConfirmErrorCode = 'empty' | 'invalid_move' | 'invalid_words'

export interface ConfirmMoveInfo {
  word: string
  words?: string[]
  score_earned: number
  rack_before: Tile[]
  player_id: string
  row: number
  col: number
  dir: 'H' | 'V'
}

export interface ConfirmResult {
  ok: boolean
  next?: GameState
  error?: string
  errorCode?: ConfirmErrorCode
  moveInfo?: ConfirmMoveInfo
}

export function applyConfirmMove(prev: GameState, pendingTiles: PlacedTile[], deps: ConfirmDeps): ConfirmResult {
  if (!pendingTiles || pendingTiles.length === 0) {
    return { ok: false, errorCode: 'empty', error: 'No tiles to confirm' }
  }

  const validation = deps.validateMoveLogic(prev.board, pendingTiles)
  if (!validation.isValid) {
    return { ok: false, errorCode: 'invalid_move', error: validation.errors.join(', ') }
  }

  const newWords = deps.findNewWordsFormed(prev.board, pendingTiles)
  const invalidWords = newWords.filter(w => !deps.isValidWord(w.word))
  if (invalidWords.length > 0) {
    return { ok: false, errorCode: 'invalid_words', error: `Invalid words: ${invalidWords.map(w => w.word).join(', ')}` }
  }

  // Calculate using the unified scorer
  const score = deps.calculateScore({ tiles: pendingTiles, existingBoard: prev.board, context: 'player' })

  // Add tiles to board
  const newBoard = new Map(prev.board)
  pendingTiles.forEach(tile => {
    const key = `${tile.row},${tile.col}`
    newBoard.set(key, tile)
  })

  // Shadow-write boardMatrix if present
  const nextMatrix = (() => {
    const matrix = prev.boardMatrix
    if (matrix) {
      const cloned = cloneBoard(matrix)
      pendingTiles.forEach(t => {
        if (t.row >= 0 && t.row < cloned.length && t.col >= 0 && t.col < cloned[0].length) {
          cloned[t.row][t.col] = { ...t }
        }
      })
      return cloned
    }
    // Build from the newBoard Map when no matrix existed yet
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

  // Update player score and rack
  const currentPlayer = prev.players[prev.currentPlayerIndex]
  const tilesNeeded = 7 - currentPlayer.rack.length

  const { drawn, remaining } = tilesNeeded > 0 && prev.tileBag.length > 0
    ? drawTiles(prev.tileBag, Math.min(tilesNeeded, prev.tileBag.length))
    : { drawn: [], remaining: prev.tileBag }

  const newPlayers: Player[] = [...prev.players]
  newPlayers[prev.currentPlayerIndex] = {
    ...currentPlayer,
    score: currentPlayer.score + score,
    rack: [...currentPlayer.rack, ...drawn]
  }

  // Prepare move info
  const rackBefore = [...currentPlayer.rack, ...pendingTiles]
  const row = Math.min(...pendingTiles.map(t => t.row))
  const col = Math.min(...pendingTiles.map(t => t.col))
  const dir = pendingTiles.every(t => t.row === pendingTiles[0].row) ? 'H' : 'V'
  const moveInfo: ConfirmMoveInfo = {
    word: newWords[0]?.word || '',
    words: newWords.map(w => w.word),
    score_earned: score,
    rack_before: rackBefore,
    player_id: currentPlayer.id,
    row,
    col,
    dir
  }

  const newPassCounts = [...(prev.passCounts || Array(prev.players.length).fill(0))]
  newPassCounts[prev.currentPlayerIndex] = 0
  const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length
  const endGame = canEndGame(
    newPlayers.map(p => ({ rack: p.rack })),
    remaining
  )

  if (endGame) {
    const finalPlayers: Player[] = computeFinalPlayers(newPlayers)
    return {
      ok: true,
      moveInfo,
      next: {
        ...prev,
        board: newBoard,
  boardMatrix: nextMatrix,
        players: finalPlayers,
        tileBag: remaining,
        gameStatus: 'finished',
        passCounts: newPassCounts,
        lastMove: pendingTiles
      }
    }
  }

  return {
    ok: true,
    moveInfo,
    next: {
      ...prev,
      board: newBoard,
  boardMatrix: nextMatrix,
      players: newPlayers,
      tileBag: remaining,
      currentPlayerIndex: nextPlayerIndex,
      passCounts: newPassCounts,
      lastMove: pendingTiles
    }
  }
}
