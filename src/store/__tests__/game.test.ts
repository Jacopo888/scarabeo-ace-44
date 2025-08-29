import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore, resetGameStore, type Tile } from '../game'

beforeEach(() => {
  resetGameStore()
})

describe('game store', () => {
  it('adds tiles to rack when drawing', () => {
    const tile: Tile = { id: '1', letter: 'A', value: 1 }
    const prevLength = useGameStore.getState().rack.length
    useGameStore.getState().drawTiles([tile])
    expect(useGameStore.getState().rack).toHaveLength(prevLength + 1)
  })

  it('places tile on board and removes from rack', () => {
    const tile: Tile = { id: '1', letter: 'A', value: 1 }
    useGameStore.getState().drawTiles([tile])
    expect(useGameStore.getState().board[0][0]).toBeNull()
    useGameStore.getState().placeTile(0, 0, tile)
    const state = useGameStore.getState()
    expect(state.board[0][0]).toEqual(tile)
    expect(state.rack).toHaveLength(0)
  })

  it('adds points to player', () => {
    useGameStore.getState().addPoints('me', 20)
    expect(useGameStore.getState().scores.me).toBe(20)
  })

  it('switches turn between players', () => {
    expect(useGameStore.getState().turn).toBe('me')
    useGameStore.getState().switchTurn()
    expect(useGameStore.getState().turn).toBe('opp')
    useGameStore.getState().switchTurn()
    expect(useGameStore.getState().turn).toBe('me')
  })
})