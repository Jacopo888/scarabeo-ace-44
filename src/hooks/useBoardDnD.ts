import { useState } from 'react'
import type { PlacedTile, Tile as GameTile } from '@/types/game'
import type { Tile as StoreTile } from '@/store/game'
import { boardKey, coerceToStoreTile, getBoardTile, getPendingAt } from '@/lib/game/board'
import type { AnyBoard } from '@/lib/game/board'

export interface UseBoardDnDOptions {
  disabled?: boolean
  board: AnyBoard
  pendingTiles: PlacedTile[]
  selectedTile?: StoreTile | GameTile | null
  placeTile: (row: number, col: number, tile: StoreTile | GameTile) => void
  onPickupTile?: (row: number, col: number) => void
  onUseSelectedTile?: () => void
}

export function useBoardDnD({
  disabled = false,
  board,
  pendingTiles,
  selectedTile = null,
  placeTile,
  onPickupTile,
  onUseSelectedTile
}: UseBoardDnDOptions) {
  const [dragOverSquare, setDragOverSquare] = useState<string | null>(null)
  const [draggingTile, setDraggingTile] = useState<string | null>(null)

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    if (disabled) return
    e.preventDefault()
    setDragOverSquare(null)

    const key = boardKey(row, col)
    const currentTile = getBoardTile(board, row, col)
    const pendingTile = getPendingAt(pendingTiles, row, col)
    if (currentTile || pendingTile) return

    try {
      const payload = e.dataTransfer.getData('application/json')
      const data = payload ? JSON.parse(payload) : null
      if (!data) return
      if (data.source === 'rack') {
        placeTile(row, col, data.tile as any)
      } else if (data.source === 'board') {
        if (data.row === row && data.col === col) return
        if (onPickupTile) {
          onPickupTile(data.row, data.col)
          placeTile(row, col, data.tile as any)
        }
      }
    } catch (error) {
      console.error('Failed to parse drop data:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (disabled) return
    const [r, c] = key.split(',').map(Number)
    const currentTile = getBoardTile(board, r, c)
    const pendingTile = getPendingAt(pendingTiles, r, c)
    if (!currentTile && !pendingTile) {
      e.preventDefault()
      setDragOverSquare(key)
    }
  }

  const handleDragLeave = () => {
    setDragOverSquare(null)
  }

  const handleSquareClick = (row: number, col: number) => {
    if (disabled) return
    if (!selectedTile) return
    const currentTile = getBoardTile(board, row, col)
    const pendingTile = getPendingAt(pendingTiles, row, col)
    if (currentTile || pendingTile) return

    const tileToPlace = coerceToStoreTile(selectedTile as StoreTile | GameTile)
    placeTile(row, col, tileToPlace)
    onUseSelectedTile?.()
  }

  const handleTileDragStart = (
    e: React.DragEvent,
    row: number,
    col: number,
    tile: StoreTile | GameTile
  ) => {
    setDraggingTile(boardKey(row, col))
    const { row: _r, col: _c, ...tileData } = tile as any
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ source: 'board', row, col, tile: tileData })
    )
  }

  const handleTileDragEnd = () => {
    setDraggingTile(null)
  }

  return {
    dragOverSquare,
    draggingTile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleSquareClick,
    handleTileDragStart,
    handleTileDragEnd,
  }
}
