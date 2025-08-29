import { cn } from "@/lib/utils"
import { ScrabbleTile } from "./ScrabbleTile"
import { useState, useEffect, useRef } from "react"

// Definizioni delle caselle speciali
const SPECIAL_SQUARES = {
  // Triple Word Score
  "0,0": "TW", "0,7": "TW", "0,14": "TW",
  "7,0": "TW", "7,14": "TW",
  "14,0": "TW", "14,7": "TW", "14,14": "TW",
  
  // Double Word Score  
  "1,1": "DW", "1,13": "DW",
  "2,2": "DW", "2,12": "DW",
  "3,3": "DW", "3,11": "DW",
  "4,4": "DW", "4,10": "DW",
  "10,4": "DW", "10,10": "DW",
  "11,3": "DW", "11,11": "DW",
  "12,2": "DW", "12,12": "DW",
  "13,1": "DW", "13,13": "DW",
  
  // Triple Letter Score
  "1,5": "TL", "1,9": "TL",
  "5,1": "TL", "5,5": "TL", "5,9": "TL", "5,13": "TL",
  "9,1": "TL", "9,5": "TL", "9,9": "TL", "9,13": "TL",
  "13,5": "TL", "13,9": "TL",
  
  // Double Letter Score
  "0,3": "DL", "0,11": "DL",
  "2,6": "DL", "2,8": "DL",
  "3,0": "DL", "3,7": "DL", "3,14": "DL",
  "6,2": "DL", "6,6": "DL", "6,8": "DL", "6,12": "DL",
  "7,3": "DL", "7,11": "DL",
  "8,2": "DL", "8,6": "DL", "8,8": "DL", "8,12": "DL",
  "11,0": "DL", "11,7": "DL", "11,14": "DL",
  "12,6": "DL", "12,8": "DL",
  "14,3": "DL", "14,11": "DL",
  
  // Star (center)
  "7,7": "STAR"
}

const getSquareColor = (type: string) => {
  switch (type) {
    case "TW": return "bg-triple-word text-white"
    case "DW": return "bg-double-word text-white" 
    case "TL": return "bg-triple-letter text-white"
    case "DL": return "bg-double-letter text-white"
    case "STAR": return "bg-star text-white"
    default: return "bg-tile border-board-border"
  }
}

const getSquareText = (type: string) => {
  switch (type) {
    // English abbreviations: 3W/2W for word, 3L/2L for letter
    case "TW": return "3W"
    case "DW": return "2W"
    case "TL": return "3L"
    case "DL": return "2L"
    case "STAR": return "★"
    default: return ""
  }
}

import type { Tile as StoreTile } from '@/store/game'
import type { Tile as GameTile, PlacedTile } from '@/types/game'
import { useGameStore } from '@/store/game'

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
      const styles = getComputedStyle(container)
      const paddingLeft = parseFloat(styles.paddingLeft) || 0
      const paddingRight = parseFloat(styles.paddingRight) || 0
      const available = (container.clientWidth || window.innerWidth) - (paddingLeft + paddingRight)
      const scale = boardWidth > 0 ? Math.min(1, available / boardWidth) : 1
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
    
    const key = `${row},${col}`
    const currentTile = boardMap ? boardMap.get(key) : board[row][col]
    const pendingTile = pendingTiles.find(t => t.row === row && t.col === col)
    
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
    const currentTile = boardMap ? boardMap.get(key) : board[r][c]
    const pendingTile = pendingTiles.find(t => t.row === r && t.col === c)
    
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

    const key = `${row},${col}`
    const currentTile = boardMap ? boardMap.get(key) : board[row][col]
    const pendingTile = pendingTiles.find(t => t.row === row && t.col === col)

    if (currentTile || pendingTile) {
      return
    }

    // Convert GameTile to StoreTile format if needed
    const tileToPlace = 'id' in selectedTile 
      ? selectedTile 
      : {
          id: `${selectedTile.letter}-${Date.now()}-${Math.random()}`,
          letter: selectedTile.letter,
          value: (selectedTile as any).points || (selectedTile as any).value || 1
        }

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
    const key = `${row},${col}`
    const specialType = SPECIAL_SQUARES[key as keyof typeof SPECIAL_SQUARES]
    
    // Get tile from board (Map or 2D array)
    const currentTile = boardMap ? boardMap.get(key) : board[row][col]
    
    // Check if there's a pending tile at this position
    const pendingTile = pendingTiles.find(t => t.row === row && t.col === col)
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