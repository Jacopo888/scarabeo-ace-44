import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Make TILE_DISTRIBUTION exactly 14 tiles so that after initial deal (7+7) the bag is empty
vi.mock('@/types/game', async () => {
  const tiles = Array.from({ length: 14 }, (_, i) => ({ letter: String.fromCharCode(65 + (i % 26)), points: 1 }))
  return {
    TILE_DISTRIBUTION: tiles
  }
})

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

// Mock dictionary to always accept words
vi.mock('@/contexts/DictionaryContext', () => ({
  useDictionary: () => ({ isValidWord: () => true })
}))

// Mock search params to start in quackle mode
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('mode=quackle&difficulty=easy'), vi.fn()]
}))

// Dynamic quackle mock: difficulty enabled and a move that consumes the whole rack
// Note: service returns coordinates that need +1 to match visual grid (row 6 -> displays at row 7)
vi.mock('@/contexts/QuackleContext', () => {
  return {
    useQuackleContext: () => ({
      difficulty: 'easy',
      setDifficulty: vi.fn(),
      isThinking: false,
      makeMove: vi.fn(async (_gameState: any, rack: any[]) => {
        // Service returns row 6, col -1 which becomes row 7, col 0 after +1 adjustment
        const tiles = rack.map((t, idx) => ({ 
          row: 6, 
          col: idx - 1, 
          letter: (t.letter || 'A').toString().toUpperCase(), 
          points: t.points || 1, 
          isBlank: !!t.isBlank 
        }))
        return {
          tiles,
          score: tiles.length, // arbitrary
          words: ['TEST'],
          move_type: 'place',
          engine_fallback: false
        }
      })
    })
  }
})

import { useGame } from './useGame'

describe('Endgame immediate when rack empty and bag empty', () => {
  it('finishes immediately after bot plays last tiles, without passing turn', async () => {
    const { result } = renderHook(() => useGame())

    // Start a new game in quackle mode (difficulty mocked as enabled)
    act(() => {
      result.current.resetGame()
    })

    // Ensure it's the bot's turn; if not, pass once
    const startingIndex = result.current.gameState.currentPlayerIndex
    const startingIsBot = result.current.gameState.players[startingIndex]?.isBot
    if (!startingIsBot) {
      act(() => {
        result.current.passTurn()
      })
    }

    const beforeIndex = result.current.gameState.currentPlayerIndex

    // Force the bot to play (mocked makeMove uses all rack tiles). Bag is empty from setup.
    await act(async () => {
      await result.current.makeQuackleMove()
    })

    // Game should be finished and turn should NOT have advanced
    expect(result.current.gameState.gameStatus).toBe('finished')
    expect(result.current.gameState.currentPlayerIndex).toBe(beforeIndex)
  })
})
