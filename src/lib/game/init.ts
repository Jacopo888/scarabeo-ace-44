import { GameState, TILE_DISTRIBUTION } from '@/types/game'
import type { Difficulty } from '@/components/DifficultyModal'
import { shuffleArray, drawTiles } from './random'

export type GameModeParam = 'local' | 'quackle'

export function initGameState(mode: GameModeParam, difficulty: Difficulty | null): GameState {
  const shuffledBag = shuffleArray(TILE_DISTRIBUTION)
  const p1 = drawTiles(shuffledBag, 7)
  const p2 = drawTiles(p1.remaining, 7)

  const gameMode: 'human' | 'quackle' = mode === 'quackle' ? 'quackle' : 'human'
  const startingPlayerIndex = Math.floor(Math.random() * 2)

  return {
    board: new Map(),
    players: [
      {
        id: 'player1',
        name: gameMode === 'quackle' ? 'You' : 'Player 1',
        score: 0,
        rack: p1.drawn,
        isBot: false
      },
      {
        id: 'player2',
        name: gameMode === 'quackle' ? 'Quackle' : 'Player 2',
        score: 0,
        rack: p2.drawn,
        isBot: gameMode === 'quackle'
      }
    ],
    currentPlayerIndex: startingPlayerIndex,
    tileBag: p2.remaining,
    gameStatus: gameMode === 'quackle' ? 'playing' : 'waiting',
    gameMode,
    passCounts: [0, 0]
  }
}
