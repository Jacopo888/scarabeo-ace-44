import { PlacedTile } from '@/types/game'
import { getMultipliersAt } from '@/config/boardConstants'

export type BoardCell = PlacedTile | null
export type Board = BoardCell[][] // 15 rows x 15 cols

export const BOARD_SIZE = 15
export const CENTER = 7 // 0-based

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null))
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.slice())
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) return false
    }
  }
  return true
}

function coordKey(r: number, c: number): string { return `${r},${c}` }

function makeVirtualLookup(board: Board, move: PlacedTile[]) {
  const moveMap = new Map<string, PlacedTile>()
  for (const t of move) moveMap.set(coordKey(t.row, t.col), t)
  return (r: number, c: number): PlacedTile | null => moveMap.get(coordKey(r, c)) ?? board[r][c]
}

export function canPlace(board: Board, move: PlacedTile[]): { ok: boolean; reason?: string } {
  if (!Array.isArray(move) || move.length === 0) return { ok: false, reason: 'empty_move' }

  // Bounds & overlap
  for (const t of move) {
    if (!isInBounds(t.row, t.col)) return { ok: false, reason: 'out_of_bounds' }
    if (board[t.row][t.col] !== null) return { ok: false, reason: 'overlap' }
  }

  // Alignment
  const rows = new Set(move.map(t => t.row))
  const cols = new Set(move.map(t => t.col))
  const alignedH = rows.size === 1
  const alignedV = cols.size === 1
  if (!(alignedH || alignedV)) return { ok: false, reason: 'not_aligned' }

  // First move must include center
  const empty = isBoardEmpty(board)
  if (empty) {
    const hitsCenter = move.some(t => t.row === CENTER && t.col === CENTER)
    if (!hitsCenter) return { ok: false, reason: 'must_cover_center' }
  }

  // Contiguity on the main line (with existing + new tiles)
  const virtual = makeVirtualLookup(board, move)
  if (alignedH) {
    const row = move[0].row
    const minC = Math.min(...move.map(t => t.col))
    const maxC = Math.max(...move.map(t => t.col))
    // Extend to include existing neighbors along the line
    let start = minC
    while (start - 1 >= 0 && virtual(row, start - 1)) start--
    let end = maxC
    while (end + 1 < BOARD_SIZE && virtual(row, end + 1)) end++
    for (let c = start; c <= end; c++) {
      if (!virtual(row, c)) return { ok: false, reason: 'gap_in_line' }
    }
  } else if (alignedV) {
    const col = move[0].col
    const minR = Math.min(...move.map(t => t.row))
    const maxR = Math.max(...move.map(t => t.row))
    let start = minR
    while (start - 1 >= 0 && virtual(start - 1, col)) start--
    let end = maxR
    while (end + 1 < BOARD_SIZE && virtual(end + 1, col)) end++
    for (let r = start; r <= end; r++) {
      if (!virtual(r, col)) return { ok: false, reason: 'gap_in_line' }
    }
  }

  // Connectivity to existing tiles (unless first move)
  if (!empty) {
    let touches = false
    for (const t of move) {
      const n = [
        [t.row - 1, t.col],
        [t.row + 1, t.col],
        [t.row, t.col - 1],
        [t.row, t.col + 1],
      ]
      for (const [r, c] of n) {
        if (isInBounds(r, c) && board[r][c] !== null) { touches = true; break }
      }
      if (touches) break
    }
    if (!touches) return { ok: false, reason: 'must_connect' }
  }

  return { ok: true }
}

export function applyMove(board: Board, move: PlacedTile[]): Board {
  const next = cloneBoard(board)
  for (const t of move) {
    if (!isInBounds(t.row, t.col)) throw new Error('out_of_bounds')
    if (next[t.row][t.col] !== null) throw new Error('overlap')
    next[t.row][t.col] = { ...t }
  }
  return next
}

export function scanMainLine(board: Board, move: PlacedTile[]): PlacedTile[] {
  if (!move.length) return []
  const virtual = makeVirtualLookup(board, move)
  // Decide axis: if aligned, use that; else for single tile, prefer the longest formed word
  const rows = new Set(move.map(t => t.row))
  const cols = new Set(move.map(t => t.col))
  const alignedH = rows.size === 1
  const alignedV = cols.size === 1

  if (alignedH) {
    const row = move[0].row
    let c = Math.min(...move.map(t => t.col))
    while (c - 1 >= 0 && virtual(row, c - 1)) c--
    const out: PlacedTile[] = []
    while (c < BOARD_SIZE && virtual(row, c)) { out.push(virtual(row, c)!); c++ }
    return out
  }
  if (alignedV) {
    const col = move[0].col
    let r = Math.min(...move.map(t => t.row))
    while (r - 1 >= 0 && virtual(r - 1, col)) r--
    const out: PlacedTile[] = []
    while (r < BOARD_SIZE && virtual(r, col)) { out.push(virtual(r, col)!); r++ }
    return out
  }
  // Single-tile or scattered (should be prevented by canPlace). For robustness, build the longer of the two lines.
  const t = move[0]
  // horizontal
  let c1 = t.col
  while (c1 - 1 >= 0 && virtual(t.row, c1 - 1)) c1--
  const hor: PlacedTile[] = []
  let c2 = c1
  while (c2 < BOARD_SIZE && virtual(t.row, c2)) { hor.push(virtual(t.row, c2)!); c2++ }
  // vertical
  let r1 = t.row
  while (r1 - 1 >= 0 && virtual(r1 - 1, t.col)) r1--
  const ver: PlacedTile[] = []
  let r2 = r1
  while (r2 < BOARD_SIZE && virtual(r2, t.col)) { ver.push(virtual(r2, t.col)!); r2++ }
  return ver.length >= hor.length ? ver : hor
}

export function scanCrossWords(board: Board, move: PlacedTile[]): PlacedTile[][] {
  const virtual = makeVirtualLookup(board, move)
  const isNewPos = new Set(move.map(t => coordKey(t.row, t.col)))
  const words: PlacedTile[][] = []
  // Determine main orientation to skip scanning along it for multi-tile moves
  const rows = new Set(move.map(t => t.row))
  const cols = new Set(move.map(t => t.col))
  const alignedH = rows.size === 1
  const alignedV = cols.size === 1

  for (const t of move) {
    // If move is horizontal, scan vertical cross, and vice versa. For single-tile, scan both; the along-main will be length>1 only if there are neighbors.
    const scanVertical = alignedH || (!alignedH && !alignedV) // single tile → scan both
    const scanHorizontal = alignedV || (!alignedH && !alignedV)

    if (scanVertical) {
      let r = t.row
      while (r - 1 >= 0 && virtual(r - 1, t.col)) r--
      const line: PlacedTile[] = []
      while (r < BOARD_SIZE && virtual(r, t.col)) { line.push(virtual(r, t.col)!); r++ }
      if (line.length > 1) words.push(line)
    }
    if (scanHorizontal) {
      let c = t.col
      while (c - 1 >= 0 && virtual(t.row, c - 1)) c--
      const line: PlacedTile[] = []
      while (c < BOARD_SIZE && virtual(t.row, c)) { line.push(virtual(t.row, c)!); c++ }
      if (line.length > 1) words.push(line)
    }
  }

  // Deduplicate identical lines (can happen for single tile scanning both axes when both >1? actually lines differ). For safety, unify by join of coords.
  const seen = new Set<string>()
  const unique: PlacedTile[][] = []
  for (const line of words) {
    const key = line.map(x => coordKey(x.row, x.col)).join('|')
    if (!seen.has(key)) { seen.add(key); unique.push(line) }
  }
  return unique
}

function scoreWord(line: PlacedTile[], newPos: Set<string>): number {
  let base = 0
  let wordMult = 1
  for (const t of line) {
    const key = coordKey(t.row, t.col)
    const mul = newPos.has(key) ? getMultipliersAt(t.row, t.col) : { letter: 1, word: 1 }
    const letterScore = (Number(t.points) || 0) * mul.letter
    base += letterScore
    wordMult *= mul.word
  }
  return base * wordMult
}

export function scoreMove(boardBefore: Board, move: PlacedTile[]): { score: number; words: string[] } {
  if (!move.length) return { score: 0, words: [] }
  const newPos = new Set(move.map(t => coordKey(t.row, t.col)))
  const main = scanMainLine(boardBefore, move)
  const crosses = scanCrossWords(boardBefore, move)

  // Build unique set of lines to score: include main if length>1 or if single tile with no crosses
  const lines: PlacedTile[][] = []
  const words: string[] = []

  if (main.length > 1 || (main.length === 1 && crosses.length === 0)) {
    lines.push(main)
    words.push(main.map(t => t.letter).join(''))
  }
  for (const line of crosses) {
    // Skip if identical to main (can happen for single tile when one axis equals main)
    const same = line.length === main.length && line.every((t, i) => t.row === main[i]?.row && t.col === main[i]?.col)
    if (!same) {
      lines.push(line)
      words.push(line.map(t => t.letter).join(''))
    }
  }

  let score = 0
  for (const line of lines) score += scoreWord(line, newPos)

  if (move.length === 7) score += 50

  return { score, words }
}
