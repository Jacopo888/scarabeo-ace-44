import { Button } from "@/components/ui/button"
import { TileRack } from "@/components/TileRack"
import { TileCounter } from "@/components/TileCounter"
import type { Tile, PlacedTile } from "@/types/game"

export function RackAndActions(props: {
  currentRack: Tile[]
  selectedTileIndex: number | null
  onTileSelect: (index: number) => void
  isMyTurn: boolean
  canSubmitMove: boolean
  pendingCount: number
  submitMove: () => void
  passTurn: () => void
  onOpenExchange: () => void
  tileCounter: {
    tileBag: Tile[]
    boardMap: Map<string, PlacedTile>
    myRack: Tile[]
    opponentRack: Tile[]
    className?: string
  }
}) {
  const { currentRack, selectedTileIndex, onTileSelect, isMyTurn, canSubmitMove, pendingCount, submitMove, passTurn, onOpenExchange, tileCounter } = props

  return (
    <>
      <TileRack
        tiles={currentRack}
        selectedTiles={selectedTileIndex !== null ? [selectedTileIndex] : []}
        onTileSelect={onTileSelect}
      />
      {isMyTurn ? (
        <div className="flex gap-2 mt-4 items-center flex-wrap">
          <Button onClick={submitMove} disabled={!canSubmitMove} className="flex-1">
            Submit Move ({pendingCount} tiles)
          </Button>
          <Button variant="outline" onClick={passTurn}>Pass Turn</Button>
          <Button variant="outline" onClick={onOpenExchange}>Exchange Tiles</Button>
          <TileCounter
            tileBag={tileCounter.tileBag}
            boardMap={tileCounter.boardMap}
            myRack={tileCounter.myRack}
            opponentRack={tileCounter.opponentRack}
            className={tileCounter.className}
          />
        </div>
      ) : (
        <div className="mt-4 p-3 bg-muted rounded-lg text-center">
          <p className="text-muted-foreground">Waiting for opponent's turn...</p>
        </div>
      )}
    </>
  )
}
