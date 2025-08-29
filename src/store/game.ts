import { create } from 'zustand'
import { produce } from 'immer'
import { devtools } from 'zustand/middleware'

export interface Tile {
  id: string
  letter: string
  value: number
}

interface GameStore {
  board: (Tile | null)[][]
  rack: Tile[]
  scores: { me: number; opp: number }
  turn: 'me' | 'opp'
  placeTile: (row: number, col: number, tile: Tile) => void
  drawTiles: (tiles: Tile[]) => void
  addPoints: (player: 'me' | 'opp', pts: number) => void
  switchTurn: () => void
  reset: () => void
}

const initialState = {
  board: Array(15).fill(null).map(() => Array(15).fill(null)),
  rack: [],
  scores: { me: 0, opp: 0 },
  turn: 'me' as const
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set) => ({
      ...initialState,
      
      placeTile: (row: number, col: number, tile: Tile) =>
        set(
          produce((state) => {
            if (state.board[row][col] === null) {
              state.board[row][col] = tile
              const tileIndex = state.rack.findIndex(t => t.id === tile.id)
              if (tileIndex !== -1) {
                state.rack.splice(tileIndex, 1)
              }
            }
          }),
          false,
          'placeTile'
        ),

      drawTiles: (tiles: Tile[]) =>
        set(
          produce((state) => {
            state.rack.push(...tiles)
          }),
          false,
          'drawTiles'
        ),

      addPoints: (player: 'me' | 'opp', pts: number) =>
        set(
          produce((state) => {
            state.scores[player] += pts
          }),
          false,
          'addPoints'
        ),

      switchTurn: () =>
        set(
          produce((state) => {
            state.turn = state.turn === 'me' ? 'opp' : 'me'
          }),
          false,
          'switchTurn'
        ),

      reset: () =>
        set(
          produce((state) => {
            Object.assign(state, initialState)
          }),
          false,
          'reset'
        ),
    }),
    {
      name: 'game-store',
    }
  )
)

export const resetGameStore = () => useGameStore.getState().reset()
