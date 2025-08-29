import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface BlankTileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (letter: string) => void
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export const BlankTileDialog = ({ open, onOpenChange, onSelect }: BlankTileDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Letter</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-2">
          {letters.map((l) => (
            <Button
              key={l}
              variant="outline"
              size="sm"
              onClick={() => {
                onSelect(l)
                onOpenChange(false)
              }}
            >
              {l}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
