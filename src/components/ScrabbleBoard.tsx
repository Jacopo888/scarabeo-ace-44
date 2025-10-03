import { cn } from "@/lib/utils"
import { ScrabbleTile } from "./ScrabbleTile"
import { useState, useEffect, useRef } from "react"
import { SPECIAL_SQUARES } from '@/components/board/constants'
import { getSquareColor, getSquareText } from '@/components/board/utils'

import type { Tile as StoreTile } from '@/store/game'
import type { Tile as GameTile, PlacedTile } from '@/types/game'
import { useGameStore } from '@/store/game'
import { boardKey, getBoardTile, getPendingAt } from '@/lib/game/board'
import { useBoardDnD } from '@/hooks/useBoardDnD'
import { BoardSquare } from '@/components/BoardSquare'

interface ScrabbleBoardProps {
  disabled?: boolean
  selectedTile?: StoreTile | GameTile | null
  onUseSelectedTile?: () => void
  // Puzzle mode props for controlled usage
  boardMap?: Map<string, PlacedTile> | (PlacedTile | null)[][]
  pendingTiles?: PlacedTile[]
  onPlaceTile?: (row: number, col: number, tile: StoreTile | GameTile) => void
  onPickupTile?: (row: number, col: number) => void
  highlightSquares?: Array<{row: number, col: number, type: 'anchor' | 'hint'}>
}

export const ScrabbleBoard = ({
  disabled = false,
  selectedTile = null,
  onUseSelectedTile,
  boardMap,
  pendingTiles = [],
  onPlaceTile,
  onPickupTile,
  highlightSquares = []
}: ScrabbleBoardProps) => {
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardScale, setBoardScale] = useState(1)
  const [hoverSquare, setHoverSquare] = useState<string | null>(null)
  const storeBoard = useGameStore(s => s.board)
  const storePlaceTile = useGameStore(s => s.placeTile)
  
  // Use controlled board if provided, otherwise use store
  const board = boardMap || storeBoard
  const placeTileHandler = onPlaceTile || storePlaceTile

  useEffect(() => {
    if (!boardRef.current) return
    const container = boardRef.current.parentElement
    if (!container) return

    const updateScale = () => {
      const boardWidth = boardRef.current?.scrollWidth || 0
      const boardHeight = boardRef.current?.scrollHeight || 0
      const styles = getComputedStyle(container)
      const paddingLeft = parseFloat(styles.paddingLeft) || 0
      const paddingRight = parseFloat(styles.paddingRight) || 0
      const paddingTop = parseFloat(styles.paddingTop) || 0
      const paddingBottom = parseFloat(styles.paddingBottom) || 0
      const availableW = (container.clientWidth || window.innerWidth) - (paddingLeft + paddingRight)
      const availableH = (container.clientHeight || window.innerHeight) - (paddingTop + paddingBottom)
      const scaleW = boardWidth > 0 ? availableW / boardWidth : 1
      const scaleH = boardHeight > 0 ? availableH / boardHeight : 1
      const scale = Math.min(1, scaleW, scaleH)
      setBoardScale(scale)
    }

    const ro = new ResizeObserver(updateScale)
    ro.observe(container)
    
    // Initial calculation
    updateScale()
    
    return () => ro.disconnect()
  }, [])
  const {
    dragOverSquare,
    draggingTile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleSquareClick,
    handleTileDragStart,
    handleTileDragEnd,
  } = useBoardDnD({
    disabled,
    board: board as any,
    pendingTiles,
    selectedTile: selectedTile || null,
    placeTile: placeTileHandler,
    onPickupTile,
    onUseSelectedTile
  })

  const renderSquare = (row: number, col: number) => {
    const key = boardKey(row, col)
    // Get tile from board (Map or 2D array)
    const currentTile = getBoardTile(board as any, row, col)
    // Check if there's a pending tile at this position
    const pendingTile = getPendingAt(pendingTiles, row, col)
    const displayTile = pendingTile || currentTile
    const isDragOver = dragOverSquare === key
    const highlight = highlightSquares.find(h => h.row === row && h.col === col)

    return (
      <BoardSquare
        key={key}
        row={row}
        col={col}
        displayTile={displayTile as any}
        pending={!!pendingTile}
        disabled={disabled}
        isDragOver={isDragOver}
        isHover={hoverSquare === key}
        onDrop={(e) => handleDrop(e, row, col)}
        onDragOver={(e) => handleDragOver(e, key)}
        onDragLeave={handleDragLeave}
        onMouseEnter={() => setHoverSquare(key)}
        onMouseLeave={() => setHoverSquare(null)}
        onClick={() => {
          if (!displayTile) {
            handleSquareClick(row, col)
          } else if (pendingTile && onPickupTile) {
            onPickupTile(row, col)
          }
        }}
        onTileDragStart={pendingTile ? (e) => handleTileDragStart(e, row, col, displayTile as any) : undefined}
        onTileDragEnd={pendingTile ? handleTileDragEnd : undefined}
        isDragging={draggingTile === key}
        highlight={highlight ? highlight.type : null}
      />
    )
  }

  return (
    <div
      className={cn(
        // Minimal padding on mobile to maximize board space
        "bg-board p-1 sm:p-2 md:p-4 rounded-lg shadow-lg max-w-full overflow-hidden mx-auto",
        // Ensure proper containment for scaled content
        "flex flex-col items-center justify-center",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <div
        ref={boardRef}
        className="grid grid-cols-15 gap-[0.5px] bg-board-border p-0.5 sm:p-1 md:p-2 rounded origin-top-left transition-transform will-change-transform"
        style={{ 
          width: 'fit-content', 
          transform: `scale(${boardScale})`, 
          transformOrigin: 'top left' // Consistent with CSS class
        }}
      >
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => renderSquare(row, col))
        )}
      </div>
    </div>
  )
}