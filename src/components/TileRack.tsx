import { ScrabbleTile } from "./ScrabbleTile"
import { useState } from "react"
import { useGameStore } from '@/store/game'
import type { Tile } from '@/types/game'
import { Button } from '@/components/ui/button'
import { Shuffle } from 'lucide-react'

interface TileRackProps {
  tiles?: Tile[]
  selectedTiles?: number[]
  onTileSelect?: (index: number) => void
  onTileDragStart?: (index: number, tile: Tile) => void
  onShuffle?: () => void
}

export const TileRack = ({ tiles, selectedTiles = [], onTileSelect, onTileDragStart, onShuffle }: TileRackProps) => {
  const storeRack = useGameStore(s => s.rack)
  const rack = tiles || storeRack
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const canShuffle = !!onShuffle && rack.length > 1
  return (
    <div className="bg-secondary p-3 sm:p-4 rounded-none sm:rounded-lg shadow-lg overflow-hidden sticky bottom-0 left-0 right-0 z-20">
      {canShuffle ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="hidden sm:block text-sm font-medium text-secondary-foreground">Your tiles</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-2 px-2 text-xs"
            onClick={onShuffle}
            title="Shuffle rack"
          >
            <Shuffle className="h-4 w-4" />
            <span className="hidden sm:inline">Shuffle</span>
          </Button>
        </div>
      ) : (
        <h3 className="hidden sm:block text-sm font-medium text-secondary-foreground mb-3">Your tiles</h3>
      )}
      <div className="flex gap-2 justify-center flex-wrap max-w-full">
        {rack.map((tile, index) => (
          <ScrabbleTile
            key={index}
            letter={tile.letter}
            points={('value' in tile ? (tile as any).value : (tile as any).points) as number}
            isBlank={(tile as any).isBlank}
            isSelected={selectedTiles.includes(index)}
            isDragging={draggingIndex === index}
            onSelect={() => onTileSelect?.(index)}
            onDragStart={(e) => {
              setDraggingIndex(index)
              e.dataTransfer.setData("application/json", JSON.stringify({
                index,
                tile,
                source: "rack" 
              }))
              onTileDragStart?.(index, tile)
            }}
            onDragEnd={() => setDraggingIndex(null)}
          />
        ))}
      </div>
    </div>
  )
}
