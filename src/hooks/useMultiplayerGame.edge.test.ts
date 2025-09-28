/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Shared spy for toasts
const toastSpy = vi.fn()

// Hoisted mocks before importing the hook
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  }
}))
vi.mock('@/contexts/AuthContext', () => {
  const user = { id: 'u1' }
  return { useAuth: () => ({ user }) }
})
vi.mock('@/contexts/DictionaryContext', () => ({ useDictionary: () => ({ isValidWord: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))

// Mock services used by the hook to avoid hitting Supabase
vi.mock('@/services/multiplayer', () => {
  const fakeGame = { id: 'g1', current_player_id: 'u1', board_state: {}, tile_bag: [], players: [] }
  return {
    fetchGameWithProfiles: vi.fn().mockResolvedValue(fakeGame),
    submitMoveForGame: vi.fn().mockResolvedValue({ endGame: false, winnerId: null }),
    exchangeTilesForGame: vi.fn().mockResolvedValue(undefined),
    passTurnForGame: vi.fn().mockResolvedValue({ endGame: false, winnerId: null }),
    surrenderGameForGame: vi.fn().mockResolvedValue({ winnerId: 'u2' }),
  }
})
vi.mock('@/services/rating', () => ({ reportGameResult: vi.fn().mockResolvedValue(undefined) }))

// Force isMyTurn=true via buildGameState mock
vi.mock('@/lib/multiplayer/state', () => ({
  buildGameState: (gameData: any, userId: string) => ({ state: { gameData, userId }, isMyTurn: true })
}))

import { useMultiplayerGame } from './useMultiplayerGame'
import * as helpers from '@/lib/multiplayer/moveUtils'

describe('useMultiplayerGame edge', () => {
  it('submitMove shows toast on invalid move', async () => {
    toastSpy.mockReset()
    vi.spyOn(helpers, 'computeValidatedMove').mockReturnValue({ ok: false, errors: ['not_contiguous'], newWords: [], score: 0 })
    vi.spyOn(helpers, 'applyPendingTilesToBoard').mockReturnValue({})

    const { result } = renderHook(() => useMultiplayerGame('g1'))

  // Wait until initial fetch finishes so that game is non-null
  await waitFor(() => expect(result.current.loading).toBe(false))
  await waitFor(() => expect(result.current.game).not.toBeNull())

    // place one tile (isMyTurn is forced true by mock)
    act(() => {
      result.current.placeTile(7, 7, { letter: 'A', isBlank: false, points: 1 })
    })

    await act(async () => {
      await result.current.submitMove()
    })

    // computeValidatedMove must be called and toast should be triggered synchronously on invalid outcome
    expect(helpers.computeValidatedMove).toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalled()
  })

  it('placeTile no-op when not my turn', () => {
    // Temporarily simulate not my turn by calling before any effect updates
    const { result } = renderHook(() => useMultiplayerGame('g1'))
    act(() => {
      result.current.placeTile(0, 0, { letter: 'A', isBlank: false, points: 1 })
    })
    expect(result.current.pendingTiles).toEqual([])
  })
})
