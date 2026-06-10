import { useMemo, useState } from 'react'
import { Brush, Eraser, Loader2, Play, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SPECIAL_SQUARES } from '@/components/board/constants'
import { getSquareColor, getSquareText } from '@/components/board/utils'
import { TILE_DISTRIBUTION, type PlacedTile } from '@/types/game'
import { quackleTopMoves, type QuackleMoveCandidate } from '@/services/quackleClient'
import { useToast } from '@/hooks/use-toast'

const BOARD_SIZE = 15
const DEFAULT_RACK = 'AEIRSTZ'

const LETTER_POINTS = TILE_DISTRIBUTION.reduce<Record<string, number>>((acc, tile) => {
  if (tile.letter && acc[tile.letter] === undefined) acc[tile.letter] = tile.points
  return acc
}, {})

function createEmptySandboxBoard(): (PlacedTile | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null))
}

function cloneBoard(board: (PlacedTile | null)[][]): (PlacedTile | null)[][] {
  return board.map(row => row.map(tile => tile ? { ...tile } : null))
}

function sanitizeRackInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z?]/g, '').slice(0, 7)
}

function sanitizeLetterInput(value: string): string {
  const letters = value.toUpperCase().replace(/[^A-Z]/g, '')
  return letters.slice(-1) || 'A'
}

function boardToPayload(board: (PlacedTile | null)[][]) {
  const payload: Record<string, { letter: string; isBlank: boolean }> = {}
  board.forEach((row, rowIndex) => {
    row.forEach((tile, colIndex) => {
      if (tile) {
        payload[`${rowIndex},${colIndex}`] = {
          letter: tile.letter,
          isBlank: !!tile.isBlank,
        }
      }
    })
  })
  return payload
}

function moveLabel(move: QuackleMoveCandidate): string {
  if (move.move_type === 'exchange') {
    return `Exchange ${(move.exchange_letters || []).join('') || move.exchange_count || 0}`
  }
  if (move.move_type === 'pass') return 'Pass'
  return move.word || move.words?.[0] || 'Play'
}

function coordinateLabel(move: QuackleMoveCandidate): string {
  if (typeof move.start_row !== 'number' || typeof move.start_col !== 'number') return ''
  return `${move.direction || ''} r${move.start_row + 1} c${move.start_col + 1}`
}

export default function Sandbox() {
  const { toast } = useToast()
  const [board, setBoard] = useState<(PlacedTile | null)[][]>(() => createEmptySandboxBoard())
  const [rack, setRack] = useState(DEFAULT_RACK)
  const [paintLetter, setPaintLetter] = useState('A')
  const [paintBlank, setPaintBlank] = useState(false)
  const [tool, setTool] = useState<'paint' | 'erase'>('paint')
  const [topN, setTopN] = useState(5)
  const [moves, setMoves] = useState<QuackleMoveCandidate[]>([])
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  const selectedMove = moves[selectedMoveIndex] || null
  const selectedMoveTiles = useMemo(() => {
    const map = new Map<string, PlacedTile>()
    selectedMove?.tiles?.forEach(tile => map.set(`${tile.row},${tile.col}`, tile))
    return map
  }, [selectedMove])

  const placeOrErase = (row: number, col: number) => {
    setBoard(current => {
      const next = cloneBoard(current)
      if (tool === 'erase') {
        next[row][col] = null
        return next
      }
      next[row][col] = {
        row,
        col,
        letter: paintLetter,
        points: paintBlank ? 0 : LETTER_POINTS[paintLetter] ?? 1,
        isBlank: paintBlank,
      }
      return next
    })
    setMoves([])
    setSelectedMoveIndex(0)
  }

  const clearBoard = () => {
    setBoard(createEmptySandboxBoard())
    setMoves([])
    setSelectedMoveIndex(0)
  }

  const askQuackle = async () => {
    const cleanRack = sanitizeRackInput(rack)
    if (!cleanRack) {
      toast({ title: 'Rack required', description: 'Add at least one tile.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const nextMoves = await quackleTopMoves({
        rack: cleanRack,
        board: boardToPayload(board),
      }, topN)
      setMoves(nextMoves)
      setSelectedMoveIndex(0)
      if (nextMoves.length === 0) {
        toast({ title: 'No moves', description: 'Quackle returned no candidates.' })
      }
    } catch (error: any) {
      toast({
        title: 'Quackle error',
        description: String(error?.message || error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const applySelectedMove = () => {
    if (!selectedMove?.tiles?.length) return
    setBoard(current => {
      const next = cloneBoard(current)
      selectedMove.tiles?.forEach(tile => {
        next[tile.row][tile.col] = { ...tile }
      })
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-5">
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Sandbox</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={tool === 'paint' ? 'default' : 'outline'} size="sm" onClick={() => setTool('paint')}>
                <Brush className="mr-2 h-4 w-4" />
                Paint
              </Button>
              <Button variant={tool === 'erase' ? 'default' : 'outline'} size="sm" onClick={() => setTool('erase')}>
                <Eraser className="mr-2 h-4 w-4" />
                Erase
              </Button>
              <Button variant="outline" size="sm" onClick={clearBoard}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-auto rounded-lg bg-board p-2 shadow-lg">
            <div className="grid w-fit grid-cols-15 gap-[0.5px] rounded bg-board-border p-1">
              {board.map((row, rowIndex) =>
                row.map((tile, colIndex) => {
                  const key = `${rowIndex},${colIndex}`
                  const specialType = SPECIAL_SQUARES[key as keyof typeof SPECIAL_SQUARES]
                  const candidate = selectedMoveTiles.get(key)
                  const displayTile = tile || candidate
                  const isCandidateOnly = !!candidate && !tile

                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        'relative flex h-8 w-8 items-center justify-center rounded border border-board-border text-[9px] font-bold sm:h-9 sm:w-9',
                        getSquareColor(specialType || ''),
                        isCandidateOnly && 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-background',
                        tile && 'bg-tile text-tile-text shadow-sm'
                      )}
                      onClick={() => placeOrErase(rowIndex, colIndex)}
                    >
                      {displayTile ? (
                        <>
                          <span className={cn('text-base leading-none', isCandidateOnly && 'text-emerald-700')}>{displayTile.letter}</span>
                          <span className="absolute bottom-0.5 right-0.5 text-[8px] leading-none">{displayTile.isBlank ? '*' : displayTile.points}</span>
                        </>
                      ) : (
                        getSquareText(specialType || '')
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sandbox-letter">Board letter</Label>
                  <Input
                    id="sandbox-letter"
                    value={paintLetter}
                    maxLength={1}
                    onChange={(event) => setPaintLetter(sanitizeLetterInput(event.target.value))}
                  />
                </div>
                <div className="flex h-10 items-center gap-2">
                  <Switch checked={paintBlank} onCheckedChange={setPaintBlank} id="sandbox-blank" />
                  <Label htmlFor="sandbox-blank">Blank</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sandbox-rack">Rack</Label>
                <Input
                  id="sandbox-rack"
                  value={rack}
                  maxLength={7}
                  onChange={(event) => setRack(sanitizeRackInput(event.target.value))}
                />
              </div>

              <div className="grid grid-cols-[110px_1fr] items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sandbox-top-n">Top N</Label>
                  <Input
                    id="sandbox-top-n"
                    type="number"
                    min={1}
                    max={10}
                    value={topN}
                    onChange={(event) => setTopN(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                  />
                </div>
                <Button onClick={askQuackle} disabled={loading} className="h-10">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Quackle
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Moves</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {moves.length === 0 ? (
                <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">No candidates</div>
              ) : (
                <div className="space-y-2">
                  {moves.map((move, index) => (
                    <button
                      key={`${move.rank || index}-${moveLabel(move)}-${coordinateLabel(move)}`}
                      type="button"
                      className={cn(
                        'w-full rounded border p-3 text-left transition-colors',
                        index === selectedMoveIndex ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                      )}
                      onClick={() => setSelectedMoveIndex(index)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{move.rank || index + 1}. {moveLabel(move)}</span>
                        <span className="text-sm tabular-nums">{move.score ?? 0} pts</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{coordinateLabel(move)}</span>
                        <span>eq {Number(move.equity ?? 0).toFixed(1)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                disabled={!selectedMove?.tiles?.length}
                onClick={applySelectedMove}
              >
                <Play className="mr-2 h-4 w-4" />
                Apply selected
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
