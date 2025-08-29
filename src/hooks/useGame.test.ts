import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock contexts used by useGame
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

vi.mock('@/contexts/BotContext', () => ({
  useBotContext: () => ({ difficulty: null, makeBotMove: vi.fn() })
}))

vi.mock('@/contexts/DictionaryContext', () => ({
  useDictionary: () => ({ isValidWord: () => true })
}))

import { useGame } from './useGame'

// Simple wrapper to use the hook

describe('useGame pass counter', () => {
  it('ends the game after six consecutive passes', () => {
    const { result } = renderHook(() => useGame())

    act(() => {
      result.current.passTurn()
      result.current.passTurn()
      result.current.passTurn()
      result.current.passTurn()
      result.current.passTurn()
      result.current.passTurn()
    })

    expect(result.current.gameState.gameStatus).toBe('finished')
  })
})
