import { cn } from "@/lib/utils"
import { ScrabbleTile } from "./ScrabbleTile"
import { useState, useEffect, useRef } from "react"
import { SPECIAL_SQUARES } from '@/components/board/constants'
import { getSquareColor, getSquareText } from '@/components/board/utils'

import type { Tile as StoreTile } from '@/store/game'
import type { Tile as GameTile, PlacedTile } from '@/types/game'
import { useGameStore } from '@/store/game'
import { boardKey, canPlaceAt, coerceToStoreTile, getBoardTile, getPendingAt } from '@/lib/game/board'

interface ScrabbleBoardProps {
  disabled?: boolean
  selectedTile?: StoreTile | GameTile | null
  onUseSelectedTile?: () => void
  // Puzzle mode props for controlled usage
  boardMap?: Map<string, PlacedTile>
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
  const [dragOverSquare, setDragOverSquare] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardScale, setBoardScale] = useState(1)
  const [hoverSquare, setHoverSquare] = useState<string | null>(null)
  const [draggingTile, setDraggingTile] = useState<string | null>(null)
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
  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    if (disabled) return
    e.preventDefault()
    setDragOverSquare(null)
    const key = boardKey(row, col)
    const currentTile = getBoardTile(board as any, row, col)
    const pendingTile = getPendingAt(pendingTiles, row, col)

    if (currentTile || pendingTile) {
      return
    }
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"))
      if (data.source === "rack") {
        placeTileHandler(row, col, data.tile as any)
      } else if (data.source === "board") {
        if (data.row === row && data.col === col) return
        if (onPickupTile) {
          onPickupTile(data.row, data.col)
          placeTileHandler(row, col, data.tile as any)
        }
      }
    } catch (error) {
      console.error("Failed to parse drop data:", error)
    }
  }

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (disabled) return
    const [r, c] = key.split(',').map(Number)
    const currentTile = getBoardTile(board as any, r, c)
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

    const key = boardKey(row, col)
    const currentTile = getBoardTile(board as any, row, col)
    const pendingTile = getPendingAt(pendingTiles, row, col)

    if (currentTile || pendingTile) {
      return
    }

    // Convert GameTile to StoreTile format if needed
    const tileToPlace = coerceToStoreTile(selectedTile as StoreTile | GameTile)

    placeTileHandler(row, col, tileToPlace)
    onUseSelectedTile?.()
  }

  const handleTileDragStart = (
    e: React.DragEvent,
    row: number,
    col: number,
    tile: StoreTile | GameTile
  ) => {
    setDraggingTile(`${row},${col}`)
    const { row: _r, col: _c, ...tileData } = tile as any
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ source: "board", row, col, tile: tileData })
    )
  }

  const handleTileDragEnd = () => {
    setDraggingTile(null)
  }

  const renderSquare = (row: number, col: number) => {
    const key = boardKey(row, col)
    const specialType = SPECIAL_SQUARES[key as keyof typeof SPECIAL_SQUARES]
    
    // Get tile from board (Map or 2D array)
    const currentTile = getBoardTile(board as any, row, col)
    
    // Check if there's a pending tile at this position
    const pendingTile = getPendingAt(pendingTiles, row, col)
    const displayTile = pendingTile || currentTile
    
    const isDragOver = dragOverSquare === key
    
    // Check if this square should be highlighted
    const highlight = highlightSquares.find(h => h.row === row && h.col === col)
    
    return (
      <div
        key={key}
        className={cn(
          "w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 border border-board-border flex items-center justify-center text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs font-bold rounded relative box-border shrink-0",
          getSquareColor(specialType || ""),
          !currentTile && "cursor-pointer",
          isDragOver && "ring-2 ring-primary ring-opacity-50 bg-primary/10",
          hoverSquare === key && "square-hover",
          highlight?.type === 'anchor' && "ring-2 ring-yellow-400 bg-yellow-100/50",
          highlight?.type === 'hint' && "ring-2 ring-blue-400 bg-blue-100/50"
        )}
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
      >
        {displayTile ? (
          <ScrabbleTile
            letter={displayTile.letter}
            points={('value' in displayTile ? displayTile.value : displayTile.points) as number}
            isOnBoard={true}
            draggable={!!pendingTile && !disabled}
            isDragging={draggingTile === key}
            onDragStart={pendingTile ? (e) => handleTileDragStart(e, row, col, displayTile as any) : undefined}
            onDragEnd={pendingTile ? handleTileDragEnd : undefined}
            className={cn(
              "text-[9px] sm:text-[10px]",
              pendingTile && "ring-2 ring-primary/50"
            )}
          />
        ) : (
          getSquareText(specialType || "")
        )}
      </div>
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