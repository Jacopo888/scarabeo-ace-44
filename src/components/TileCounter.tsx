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
    if (boardMap instanceof Map) {
      return Object.fromEntries(boardMap)
    }
    return boardMap
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
                Tessere nel sacchetto
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
          <div className="text-sm font-medium">Lettere non uscite</div>
          <div className="text-xs text-muted-foreground">Include rack avversario</div>
          {error && (
            <div className="text-xs text-destructive">{error}</div>
          )}
          {!error && !unseenBy && (
            <div className="text-xs text-muted-foreground">Nessun dato disponibile.</div>
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
