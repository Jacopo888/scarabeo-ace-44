import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock contexts used by useGame
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}))

vi.mock('@/contexts/QuackleContext', () => ({
  useQuackleContext: () => ({ difficulty: null, setDifficulty: vi.fn(), makeMove: vi.fn(), isThinking: false })
}))

vi.mock('@/contexts/DictionaryContext', () => ({
  useDictionary: () => ({ isValidWord: () => true })
}))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()]
}))

import { useGame } from './useGame'
import { buildQuackleBoard } from './useQuackle'
import { quackleBestMove } from '@/services/quackleClient'

describe('Quackle serialization', () => {
  it('serializes board with 1-based indices (center -> "8,8")', () => {
    // Build a minimal GameState with one stabilized tile at 0-based (7,7)
    const board = new Map<string, any>()
    board.set('7,7', { letter: 'a', points: 1, row: 7, col: 7, isBlank: false })
    const gameState: any = {
      board,
      players: [], currentPlayerIndex: 0, tileBag: [], gameStatus: 'playing'
    }
    const out = buildQuackleBoard(gameState)
    expect(Object.keys(out)).toContain('8,8')
    expect(out['8,8'].letter).toBe('A')
  })
})

describe('Smoke vs bridge (mocked)', () => {
  it('empty board + rack AEINRS? -> not pass', async () => {
    const payload = {
      board: {},
      rack: [
        {letter:'A', points:1, isBlank:false},
        {letter:'E', points:1, isBlank:false},
        {letter:'I', points:1, isBlank:false},
        {letter:'N', points:1, isBlank:false},
        {letter:'R', points:1, isBlank:false},
        {letter:'S', points:1, isBlank:false},
        {letter:'?', points:0, isBlank:true},
      ],
      difficulty: 'medium'
    }

    // Mock fetch to simulate a valid place move coming from the service
    const mockMove = {
      tiles: [ { row: 7, col: 7, letter: 'A', points: 1, isBlank: false } ],
      score: 4,
      words: ['AR'],
      move_type: 'place',
      engine_fallback: false
    }
    const originalFetch = globalThis.fetch as any
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockMove,
      headers: new Headers(),
      redirected: false,
      status: 200,
      statusText: 'OK',
      type: 'basic' as ResponseType,
      url: '',
      clone: vi.fn(),
      text: async () => '',
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      formData: async () => new FormData(),
      body: null,
      bodyUsed: false
    } as Response))
    try {
      const mv = await quackleBestMove(payload)
      expect(mv.move_type).not.toBe('pass')
      expect(Array.isArray(mv.tiles)).toBe(true)
      expect(mv.tiles.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

// Simple wrapper to use the hook

describe('useGame pass counter', () => {
  it('ends the game after six consecutive passes', () => {
    const { result } = renderHook(() => useGame())

    act(() => {
      result.current.resetGame()
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
