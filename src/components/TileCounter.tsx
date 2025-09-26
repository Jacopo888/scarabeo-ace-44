import { FC, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import type { PlacedTile, Tile } from '@/types/game'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { quackleBagSummary } from '@/services/quackleClient'

interface TileCounterProps {
  tileBag?: any[]
  boardMap?: Map<string, PlacedTile> | Record<string, PlacedTile>
  myRack?: Tile[]
  opponentRack?: Tile[]
  className?: string
}

export const TileCounter: FC<TileCounterProps> = ({ tileBag, boardMap, myRack, opponentRack, className }) => {
  const [bagCount, setBagCount] = useState<number>(tileBag?.length || 0)
  const [unseenBy, setUnseenBy] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boardPayload = useMemo(() => {
    if (!boardMap) return null
    // Build a canonical 15x15 grid payload for the backend
    const size = 15
    const grid: string[] = Array.from({ length: size }, () => '.'.repeat(size))

    const applyTile = (r: number, c: number, v: PlacedTile | any) => {
      if (!Number.isFinite(r) || !Number.isFinite(c)) return
      const row = Math.max(0, Math.min(size - 1, Math.floor(r)))
      const col = Math.max(0, Math.min(size - 1, Math.floor(c)))
      const isBlank = !!(v?.isBlank)
      const ch = isBlank ? '?' : String(v?.letter || '').toUpperCase().slice(0, 1)
      if (!ch || ch === '.') return
      const rowStr = grid[row]
      grid[row] = rowStr.slice(0, col) + ch + rowStr.slice(col + 1)
    }

    if (boardMap instanceof Map) {
      for (const [k, v] of boardMap.entries()) {
        const [rs, cs] = String(k).split(',')
        applyTile(Number(rs), Number(cs), v)
      }
    } else if (typeof boardMap === 'object' && boardMap) {
      for (const [k, v] of Object.entries(boardMap as Record<string, PlacedTile>)) {
        const [rs, cs] = String(k).split(',')
        applyTile(Number(rs), Number(cs), v)
      }
    }

    return { rows: size, cols: size, grid }
  }, [boardMap])

  const rackToString = (rack?: Tile[]) => {
    if (!rack) return ''
    return rack.map(t => (t.isBlank ? '?' : (t.letter || '').toUpperCase())).join('').slice(0, 7)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!boardPayload || !myRack) {
        setBagCount(tileBag?.length || 0)
        setUnseenBy(null)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const payload: any = {
          board: boardPayload,
          rack: rackToString(myRack),
        }
        if (opponentRack) payload.opponent_rack = rackToString(opponentRack)
        const res = await quackleBagSummary(payload)
        if (cancelled) return
        setBagCount(typeof res.bag_count === 'number' ? res.bag_count : (tileBag?.length || 0))
        setUnseenBy(res.unseen_by_letter || res.remaining_by_letter || null)
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message || e))
          setBagCount(tileBag?.length || 0)
          setUnseenBy(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [boardPayload, myRack, opponentRack, tileBag?.length])

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
                {loading ? '…' : bagCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <div className="text-sm font-medium">Unseen letters</div>
          <div className="text-xs text-muted-foreground">Includes opponent rack</div>
          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
          {!error && !unseenBy && (
            <div className="text-xs text-muted-foreground">No data available.</div>
          )}
          {!error && unseenBy && (
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
