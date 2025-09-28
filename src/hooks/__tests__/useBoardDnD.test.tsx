import { describe, it, expect, vi } from 'vitest'
import React, { useEffect } from 'react'
import { render, fireEvent } from '@testing-library/react'
import { useBoardDnD } from '@/hooks/useBoardDnD'
import { boardKey } from '@/lib/game/board'

function TestHarness({
  disabled = false,
  board,
  pendingTiles = [],
  selectedTile = null,
  placeTile,
  onPickupTile,
  onUseSelectedTile,
  action = null,
}: any) {
  const hook = useBoardDnD({ disabled, board, pendingTiles, selectedTile, placeTile, onPickupTile, onUseSelectedTile })
  // expose handlers via DOM
  const triggerDropFromRack = () => {
    const ev: any = {
      preventDefault: () => {},
      dataTransfer: { getData: () => JSON.stringify({ source: 'rack', tile: { letter: 'A', value: 1 } }) },
    }
    hook.handleDrop(ev as any, 0, 0)
  }
  const triggerDropFromBoard = () => {
    const ev: any = {
      preventDefault: () => {},
      dataTransfer: { getData: () => JSON.stringify({ source: 'board', row: 1, col: 1, tile: { letter: 'B', value: 3 } }) },
    }
    hook.handleDrop(ev as any, 0, 0)
  }
  const triggerClick = () => hook.handleSquareClick(0, 0)
  useEffect(() => {
    if (action === 'dropRack') triggerDropFromRack()
    if (action === 'dropBoard') triggerDropFromBoard()
    if (action === 'click') triggerClick()
  }, [action])
  return (
    <div>
      <button data-testid="drop-rack" onClick={triggerDropFromRack} />
      <button data-testid="drop-board" onClick={triggerDropFromBoard} />
      <button data-testid="dragover" onClick={(e) => hook.handleDragOver((e as any), boardKey(0, 0))} />
      <button data-testid="leave" onClick={() => hook.handleDragLeave()} />
      <button data-testid="click" onClick={triggerClick} />
    </div>
  )
}

describe('useBoardDnD', () => {
  it('prevents placement on occupied or pending squares', () => {
    const placeTile = vi.fn()
    const board = Array.from({ length: 15 }, () => Array(15).fill(null))
    board[0][0] = { id: 'x', letter: 'X', value: 8 }

    const { getAllByTestId } = render(
      <TestHarness board={board} pendingTiles={[]} selectedTile={{ letter: 'A', points: 1 }} placeTile={placeTile} />
    )
    fireEvent.click(getAllByTestId('click')[0])
    expect(placeTile).not.toHaveBeenCalled()
  })

  it('places from rack on empty square via drop', () => {
    const placeTile = vi.fn()
    const board = Array.from({ length: 15 }, () => Array(15).fill(null))

    render(
      <TestHarness action="dropRack" board={board} pendingTiles={[]} selectedTile={{ letter: 'A', points: 1 }} placeTile={placeTile} />
    )
    expect(placeTile).toHaveBeenCalledWith(0, 0, expect.objectContaining({ letter: 'A' }))
  })

  it('moves from board on drop with pickup+place', () => {
    const placeTile = vi.fn()
    const onPickup = vi.fn()
    const board = Array.from({ length: 15 }, () => Array(15).fill(null))

    render(
      <TestHarness action="dropBoard" board={board} pendingTiles={[]} selectedTile={{ letter: 'A', points: 1 }} placeTile={placeTile} onPickupTile={onPickup} />
    )
    expect(onPickup).toHaveBeenCalledWith(1, 1)
    expect(placeTile).toHaveBeenCalledWith(0, 0, expect.objectContaining({ letter: 'B' }))
  })
})
