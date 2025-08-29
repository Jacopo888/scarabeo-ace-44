import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TileRack } from './TileRack'

interface ExchangeTilesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (indexes: number[]) => void
}

export const ExchangeTilesDialog = ({ open, onOpenChange, onConfirm }: ExchangeTilesDialogProps) => {
  const [selected, setSelected] = useState<number[]>([])

  const toggleTile = (index: number) => {
    setSelected(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index])
  }

  const handleConfirm = () => {
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
          <TileRack selectedTiles={selected} onTileSelect={toggleTile} />
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selected.length === 0}>Confirm</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}