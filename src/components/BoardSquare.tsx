import { cn } from '@/lib/utils'
import { SPECIAL_SQUARES } from '@/components/board/constants'
import { getSquareColor, getSquareText } from '@/components/board/utils'
import { ScrabbleTile } from '@/components/ScrabbleTile'
import type { PlacedTile } from '@/types/game'
import type { Tile as StoreTile } from '@/store/game'
import { boardKey } from '@/lib/game/board'

type DisplayTile = (PlacedTile | (StoreTile & { points?: number })) | null | undefined

export interface BoardSquareProps {
  row: number
  col: number
  displayTile: DisplayTile
  pending: boolean
  disabled?: boolean
  isDragOver?: boolean
  isHover?: boolean
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onTileDragStart?: (e: React.DragEvent) => void
  onTileDragEnd?: () => void
  isDragging?: boolean
  highlight?: 'anchor' | 'hint' | null
}

export function BoardSquare({
  row,
  col,
  displayTile,
  pending,
  disabled = false,
  isDragOver = false,
  isHover = false,
  onDrop,
  onDragOver,
  onDragLeave,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onTileDragStart,
  onTileDragEnd,
  isDragging = false,
  highlight = null,
}: BoardSquareProps) {
  const key = boardKey(row, col)
  const specialType = SPECIAL_SQUARES[key as keyof typeof SPECIAL_SQUARES]
  const showTile = !!displayTile
  const letter = showTile ? (displayTile as any).letter : undefined
  const points = showTile ? (('value' in (displayTile as any) ? (displayTile as any).value : (displayTile as any).points) as number) : undefined

  return (
    <div
      key={key}
      className={cn(
        'w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-9 lg:h-9 border border-board-border flex items-center justify-center text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs font-bold rounded relative box-border shrink-0',
        getSquareColor(specialType || ''),
        !showTile && 'cursor-pointer',
        isDragOver && 'ring-2 ring-primary ring-opacity-50 bg-primary/10',
        isHover && 'square-hover',
        highlight === 'anchor' && 'ring-2 ring-yellow-400 bg-yellow-100/50',
        highlight === 'hint' && 'ring-2 ring-blue-400 bg-blue-100/50'
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {showTile ? (
        <ScrabbleTile
          letter={letter as string}
          points={points as number}
          isOnBoard={true}
          draggable={!!pending && !disabled}
          isDragging={isDragging}
          onDragStart={pending ? onTileDragStart : undefined}
          onDragEnd={pending ? onTileDragEnd : undefined}
          className={cn('text-[9px] sm:text-[10px]', pending && 'ring-2 ring-primary/50')}
        />
      ) : (
        getSquareText(specialType || '')
      )}
    </div>
  )
}
