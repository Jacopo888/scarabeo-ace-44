import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TileRack } from './TileRack'
import type { Tile } from '@/types/game'

interface ExchangeTilesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (indexes: number[]) => void
  tiles?: Tile[]
  tileBagCount?: number
}

export const ExchangeTilesDialog = ({ open, onOpenChange, onConfirm, tiles, tileBagCount = 0 }: ExchangeTilesDialogProps) => {
  const [selected, setSelected] = useState<number[]>([])

  const toggleTile = (index: number) => {
    setSelected(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
  }

  const canConfirm = selected.length > 0 && tileBagCount >= Math.max(2, selected.length)
  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(selected)
    setSelected([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exchange Tiles</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <TileRack tiles={tiles} selectedTiles={selected} onTileSelect={toggleTile} />
          <div className="text-xs text-muted-foreground">
            {tileBagCount < 2 ? (
              <span>Not enough tiles in bag to exchange (need at least 2).</span>
            ) : (
              <span>Select up to {Math.min(7, tileBagCount)} tile{Math.min(7, tileBagCount) === 1 ? '' : 's'} to exchange. Bag: {tileBagCount}.</span>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!canConfirm}>Confirm</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
