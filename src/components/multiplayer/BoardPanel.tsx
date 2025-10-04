import { ScrabbleBoard } from "@/components/ScrabbleBoard"
import type { PlacedTile, Tile as GameTile } from "@/types/game"
import type { Tile as StoreTile } from "@/store/game"

type GameOrStoreTile = StoreTile | GameTile

export type RequestBlank = (row: number, col: number, tile: GameTile) => void

export function BoardPanel(props: {
  isMyTurn: boolean
  selectedTile: GameOrStoreTile | null
  onUseSelectedTile: () => void
  boardMap: Map<string, PlacedTile> | (PlacedTile | null)[][]
  pendingTiles: PlacedTile[]
  onPlaceTile: (row: number, col: number, tile: GameTile) => void
  onPickupTile: (row: number, col: number) => void
  onRequestBlank: RequestBlank
}) {
  const { isMyTurn, selectedTile, onUseSelectedTile, boardMap, pendingTiles, onPlaceTile, onPickupTile, onRequestBlank } = props

  return (
    <ScrabbleBoard
      disabled={!isMyTurn}
      selectedTile={selectedTile}
      onUseSelectedTile={onUseSelectedTile}
      boardMap={boardMap}
      pendingTiles={pendingTiles}
      onPlaceTile={(row, col, tile) => {
        const t = tile as GameOrStoreTile
        const gameTile: GameTile = 'value' in t && !('points' in t)
          ? { letter: t.letter, points: t.value, isBlank: (t as any).isBlank }
          : (t as GameTile)
        if (gameTile?.isBlank && (gameTile.letter === '' || gameTile.letter === '?')) {
          onRequestBlank(row, col, gameTile)
        } else {
          onPlaceTile(row, col, gameTile)
        }
      }}
      onPickupTile={onPickupTile}
    />
  )
}
