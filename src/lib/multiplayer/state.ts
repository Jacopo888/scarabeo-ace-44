import { GameRecord } from '@/types/multiplayer'
import { GameState, PlacedTile, Tile } from '@/types/game'

const normalizeRack = (rack: Tile[] = []): Tile[] =>
  rack.map((t) => ({
    letter: t.letter ?? '',
    points: t.points ?? 0,
    isBlank: t.isBlank ?? (t.letter === '' && t.points === 0),
  }))

const mapBoardState = (boardState: Record<string, PlacedTile> = {}): Map<string, PlacedTile> => {
  const entries = Object.entries(boardState).map(([key, val]) => {
    const tile: PlacedTile = {
      ...val,
      isBlank: val.isBlank ?? (val.letter === '' && val.points === 0),
    }
    return [key, tile] as [string, PlacedTile]
  })
  return new Map<string, PlacedTile>(entries)
}

export const buildGameState = (gameData: GameRecord, userId: string): { state: GameState; isMyTurn: boolean } => {
  const boardMap = mapBoardState(gameData.board_state || {})
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
    board: boardMap,
    tileBag: gameData.tile_bag,
    gameStatus: 'playing',
  }
  return { state, isMyTurn: gameData.current_player_id === userId }
}
