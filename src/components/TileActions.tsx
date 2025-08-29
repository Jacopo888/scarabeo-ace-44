import { Button } from "@/components/ui/button"
import { Shuffle, RotateCcw } from "lucide-react"

interface TileActionsProps {
  onReshuffle: () => void
  onCollectAll: () => void
  hasPendingTiles: boolean
  disabled?: boolean
}

export const TileActions = ({ onReshuffle, onCollectAll, hasPendingTiles, disabled = false }: TileActionsProps) => {
  return (
    <div className="flex justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onReshuffle}
        disabled={disabled}
        className="flex items-center gap-2"
      >
        <Shuffle className="h-4 w-4" />
        Reshuffle Tiles
      </Button>
      
      {hasPendingTiles && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCollectAll}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Collect All
        </Button>
      )}
    </div>
  )
}