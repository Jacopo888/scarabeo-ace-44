import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { motion } from "framer-motion"

interface ScrabbleTileProps {
  letter: string
  points: number
  isSelected?: boolean
  isBlank?: boolean
  isOnBoard?: boolean
  isDragging?: boolean
  draggable?: boolean
  onSelect?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  className?: string
}

export const ScrabbleTile = ({
  letter,
  points,
  isSelected = false,
  isBlank = false,
  isOnBoard = false,
  isDragging = false,
  draggable = !isOnBoard,
  onSelect,
  onDragStart,
  onDragEnd,
  className
}: ScrabbleTileProps) => {
  const isMobile = useIsMobile()
  const displayLetter = isBlank && letter === '' ? '★' : letter
  const displayPoints = isBlank ? '★' : points
  return (
    <motion.div
      layout={!isOnBoard} // Disable layout animations when on board to prevent grid conflicts
      whileHover={!isOnBoard ? { y: -4, scale: 1.05 } : {}}
      whileTap={!isOnBoard ? { scale: 0.95 } : {}} // Disable tap animations on board to prevent position shifts
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        // Responsive dimensions: match board cell sizes
        isOnBoard ? "w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10" : "w-12 h-12",
        "relative bg-tile rounded-md flex items-center justify-center select-none",
        // Different transition behavior for on-board vs off-board tiles
        isOnBoard ? "transition-colors" : "transition-all",

        // Use thinner border and smaller shadow on-board to fit in small squares
        isOnBoard ? "border border-tile-text shadow" : "border-2 border-tile-text shadow-md",
        draggable && "cursor-grab",
        !draggable && isOnBoard && "cursor-pointer",
        isSelected && "border-primary bg-primary/10",
        isDragging && "opacity-50 cursor-grabbing",
        isBlank && "bg-yellow-100",
        className
      )}
      draggable={draggable && !isMobile}
      onClick={onSelect}
      onDragStart={onDragStart as any}
      onDragEnd={onDragEnd as any}
    >
      <span
        className={cn(
          "text-tile-text font-bold leading-none pointer-events-none",
          // Larger letter to nearly fill tile
          isOnBoard
            ? "text-[14px] xs:text-[16px] sm:text-[18px] md:text-lg"
            : "text-3xl"
        )}
      >
        {displayLetter}
      </span>
      <span
        className={cn(
          "absolute bottom-0.5 right-0.5 text-tile-text leading-none pointer-events-none",
          // Responsive points size
          isOnBoard ? "text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs" : "text-xs"
        )}
      >
        {displayPoints}
      </span>
    </motion.div>
  )
}