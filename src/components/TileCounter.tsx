import { FC, useMemo } from 'react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import type { PlacedTile, Tile } from '@/types/game'
import { TILE_DISTRIBUTION } from '@/types/game'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface TileCounterProps {
  tileBag?: any[]
  boardMap?: Map<string, PlacedTile> | Record<string, PlacedTile>
  myRack?: Tile[]
  opponentRack?: Tile[]
  className?: string
}

export const TileCounter: FC<TileCounterProps> = ({ tileBag, boardMap, myRack, opponentRack: _opponentRack, className }) => {
  // Pure client-side computation to avoid backend discrepancies
  const bagCount = (tileBag?.length || 0)

  // Build per-letter distribution from TILE_DISTRIBUTION
  const baseDist = useMemo(() => {
    const d: Record<string, number> = {}
    for (const t of TILE_DISTRIBUTION) {
      const k = t.isBlank ? '?' : (t.letter || '').toUpperCase()
      d[k] = (d[k] || 0) + 1
    }
    return d
  }, [])

  const boardCounts = useMemo(() => {
    const d: Record<string, number> = {}
    if (!boardMap) return d
    const push = (v: any) => {
      if (!v) return
      const k = v.isBlank ? '?' : String(v.letter || '').toUpperCase().slice(0,1)
      if (!k || k === '.') return
      d[k] = (d[k] || 0) + 1
    }
    if (boardMap instanceof Map) {
      for (const [, v] of boardMap.entries()) push(v)
    } else {
      for (const v of Object.values(boardMap as Record<string, PlacedTile>)) push(v)
    }
    return d
  }, [boardMap])

  const myCounts = useMemo(() => {
    const d: Record<string, number> = {}
    for (const t of (myRack || [])) {
      const k = t.isBlank ? '?' : (t.letter || '').toUpperCase()
      d[k] = (d[k] || 0) + 1
    }
    return d
  }, [myRack])

  const unseenBy = useMemo(() => {
    // Unseen letters from my perspective: total - board - my rack
    const letters = [
      'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','?'
    ]
    const d: Record<string, number> = {}
    for (const k of letters) {
      const v = (baseDist[k] || 0) - (boardCounts[k] || 0) - (myCounts[k] || 0)
      d[k] = v > 0 ? v : 0
    }
    return d
  }, [baseDist, boardCounts, myCounts])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Card className={cn('w-full cursor-pointer select-none', className)}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Tiles in bag
              </span>
              <Badge variant="secondary" className="text-base font-bold min-w-8 justify-center">
                {bagCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <div className="text-sm font-medium">Unseen letters</div>
          <div className="text-xs text-muted-foreground">Includes opponent rack</div>
          {unseenBy && (
            <div className="grid grid-cols-6 gap-1">
              {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','?']
                .filter(k => (unseenBy[k] ?? 0) > 0)
                .map(k => (
                  <div key={k} className="flex items-center justify-between px-2 py-1 rounded bg-secondary text-xs">
                    <span className="font-semibold">{k}</span>
                    <span>{unseenBy[k]}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
