import { GameRecord } from '@/types/multiplayer'
import { GameState, PlacedTile, Tile } from '@/types/game'

// Convert legacy persisted board_state (record "r,c" -> tile) into matrix Board
const recordToBoardMatrix = (boardState: Record<string, PlacedTile> = {}): (PlacedTile | null)[][] => {
  const matrix: (PlacedTile | null)[][] = Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => null))
  for (const [key, val] of Object.entries(boardState)) {
    const [rStr, cStr] = key.split(',')
    const r = Number(rStr)
    const c = Number(cStr)
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= 15 || c < 0 || c >= 15) continue
    matrix[r][c] = {
      ...val,
      isBlank: val.isBlank ?? (val.letter === '' && val.points === 0),
      row: r,
      col: c
    }
  }
  return matrix
}

const normalizeRack = (rack: Tile[] = []): Tile[] =>
  rack.map((t) => {
    const rawLetter = (t.letter ?? '').toString()
    const isBlank = t.isBlank ?? (rawLetter === '' && (t.points ?? 0) === 0)
    const letter = isBlank && (rawLetter === '?' || rawLetter === null)
      ? ''
      : (rawLetter || '')
    return {
      letter,
      points: t.points ?? 0,
      isBlank,
    }
  })

export const gameRecordStatusToGameStatus = (status: GameRecord['status']): GameState['gameStatus'] => {
  if (status === 'waiting') return 'waiting'
  if (status === 'active') return 'playing'
  return 'finished'
}

export const buildGameState = (gameData: GameRecord, userId: string): { state: GameState; isMyTurn: boolean } => {
  const boardMatrix = recordToBoardMatrix(gameData.board_state || {})
  const gameStatus = gameRecordStatusToGameStatus(gameData.status)
  const state: GameState = {
    players: [
      {
        id: gameData.player1_id,
        name: 'Player 1',
        score: gameData.player1_score,
        rack: normalizeRack(gameData.player1_rack || []),
      },
      {
        id: gameData.player2_id,
        name: 'Player 2',
        score: gameData.player2_score,
        rack: normalizeRack(gameData.player2_rack || []),
      },
    ],
    currentPlayerIndex: gameData.current_player_id === gameData.player1_id ? 0 : 1,
    boardMatrix,
    tileBag: gameData.tile_bag,
    gameStatus,
  }
  return { state, isMyTurn: gameData.status === 'active' && gameData.current_player_id === userId }
}
