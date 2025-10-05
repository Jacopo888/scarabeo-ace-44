import { useState, useCallback } from 'react'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile, PlacedTile } from '@/types/game'
import { toServiceCoord } from '@/lib/coords'
import { quackleBestMove, QuackleMove } from '@/services/quackleClient'
import { logQuackleMove } from '@/utils/debugLogger'
import { isDebugQuackle } from '@/config/debug'

// Build a Quackle board mapping using 0-based coordinates and stabilized tiles only
// Output: { "r,c": { letter: string, isBlank: boolean } } (r,c in [0,14])
export function buildQuackleBoard(gameState: GameState): Record<string, { letter: string; isBlank: boolean }> {
  const out: Record<string, { letter: string; isBlank: boolean }> = {}
  const board = gameState.boardMatrix
  for (let r = 0; r < board.length; r++) {
    const row = board[r]
    for (let c = 0; c < row.length; c++) {
      const tile = row[c]
      if (!tile) continue
      if (!Number.isFinite(tile.row) || !Number.isFinite(tile.col)) continue
      if (!Number.isInteger(tile.row) || !Number.isInteger(tile.col)) continue
      const key = toServiceCoord(tile.row, tile.col)
      const isBlank = !!tile.isBlank
      const raw = (tile.letter ?? '').toString().trim().toUpperCase()
      if (isBlank && (!raw || raw === '?' || raw === '.')) continue
      if (!raw || raw === '.') continue
      out[key] = { letter: raw, isBlank }
    }
  }
  return out
}

// Normalize rack for Quackle: array of { letter, points, isBlank }
export function formatRackForQuackle(rack: Tile[]): Array<{ letter: string; points: number; isBlank: boolean }> {
  return rack
    .filter(t => t && (t.letter !== undefined))
    .map(t => {
      const isBlank = !!t.isBlank
      // If blank and letter is empty/unassigned, keep '?' as letter
      const letter = isBlank ? (t.letter && t.letter.trim() ? t.letter.toUpperCase() : '?') : (t.letter || '').toUpperCase()
      const points = typeof t.points === 'number' ? t.points : (isBlank ? 0 : 0)
      return { letter, points, isBlank }
    })
}

// Optional: bridge can accept rack as a plain string, which simplifies parsing
export function formatRackStringForQuackle(rack: Tile[]): string {
  return rack
    .map(t => {
      const isBlank = !!t.isBlank
      // For blanks, if a letter is assigned use it uppercase; otherwise '?'
      const raw = (t.letter || '').toString().trim()
      if (isBlank) return raw ? raw.toUpperCase() : '?'
      return raw.toUpperCase()
    })
    .join('')
    .slice(0, 7)
}

export const useQuackle = () => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [lastEngineInfo, setLastEngineInfo] = useState<{ hl_strict: boolean; path: 'hl' | 'gen' | 'endgame'; kibitz_len: number; status?: 'simulating' | 'endgame' | 'static'; used_simulator?: boolean } | null>(null)

  const makeMove = useCallback(async (
    gameState: GameState,
    playerRack: Tile[],
    difficulty: Difficulty | null
  ): Promise<QuackleMove | null> => {
    if (!difficulty) return null
    
    setIsThinking(true)
    try {
      // Add artificial thinking time for better UX
      const thinkingTime = getThinkingTime(difficulty)
      
      // Build board and rack payloads for bridge
      const board = buildQuackleBoard(gameState)
      // Prefer simple string rack to minimize payload ambiguity
      const rack = formatRackStringForQuackle(playerRack)

      // Provide remaining bag to the engine (pool of single-letter strings, '?' for blanks)
      const bagPool: string[] = Array.isArray(gameState.tileBag)
        ? gameState.tileBag.map(t => {
            const isBlank = !!t.isBlank || (t.letter === '?' || t.letter === '*')
            if (isBlank) return '?'
            const L = (t.letter || '').toString().trim().toUpperCase()
            return L ? L[0] : ''
          }).filter(Boolean)
        : []

  const payload = { board, rack, difficulty, bag_pool: bagPool }

      // Structured debug log
      const bkeys = Object.keys(board)
      if (isDebugQuackle) console.log({
        tag: 'quackle_payload',
        boardCellCount: bkeys.length,
        sampleKeys: bkeys.slice(0, 3),
        rack,
        rackLen: playerRack.length,
        difficulty
      })

      const [move] = await Promise.all([
        quackleBestMove(payload),
        new Promise(resolve => setTimeout(resolve, thinkingTime))
      ])
      if (move && typeof move === 'object' && move.engine_info && typeof move.engine_info === 'object') {
        const ei = move.engine_info as any
        if (ei && (ei.path === 'hl' || ei.path === 'gen' || ei.path === 'endgame')) {
          setLastEngineInfo({ hl_strict: !!ei.hl_strict, path: ei.path, kibitz_len: Number(ei.kibitz_len) || 0, status: ei.status, used_simulator: !!ei.used_simulator })
        }
      }
      
      // Log pulito per debug
  if (isDebugQuackle) logQuackleMove(playerRack, move)
      return move
    } finally {
      setIsThinking(false)
    }
  }, [])

  return {
    difficulty,
    setDifficulty,
    makeMove,
    isThinking,
    lastEngineInfo
  }
}

function getThinkingTime(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy': return 800 + Math.random() * 1200   // 0.8-2.0s
    case 'medium': return 1200 + Math.random() * 1800 // 1.2-3.0s  
    case 'hard': return 1500 + Math.random() * 2500   // 1.5-4.0s
    default: return 1000
  }
}
