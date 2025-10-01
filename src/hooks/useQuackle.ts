import { useState, useCallback } from 'react'
import { Difficulty } from '@/components/DifficultyModal'
import { GameState, Tile, PlacedTile } from '@/types/game'
import { toServiceCoord } from '@/lib/coords'
import { quackleBestMove, QuackleMove } from '@/services/quackleClient'

// Build a Quackle board mapping using 1-based indices and stabilized tiles only
// Output: { "r,c": { letter: string, isBlank: boolean } }
export function buildQuackleBoard(gameState: GameState): Record<string, { letter: string; isBlank: boolean }> {
  const out: Record<string, { letter: string; isBlank: boolean }> = {}
  // gameState.board is a Map of stabilized tiles only; pending tiles live elsewhere
  gameState.board.forEach((tile: PlacedTile) => {
    // Only process finite integer coordinates
    if (!Number.isFinite(tile.row) || !Number.isFinite(tile.col)) return
    if (!Number.isInteger(tile.row) || !Number.isInteger(tile.col)) return
    // Convert to 1-based and enforce bounds [1,15]
    // Guard bounds with centralized helper
    const key = toServiceCoord(tile.row, tile.col)

    const isBlank = !!tile.isBlank
    const raw = (tile.letter ?? '').toString().trim().toUpperCase()
    // Never send '?' or '.' as a board letter: the engine requires the represented letter for blanks
    if (isBlank && (!raw || raw === '?' || raw === '.')) return
    if (!raw || raw === '.') return

    out[key] = { letter: raw, isBlank }
  })
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
  const BOARD_SCHEMA = (import.meta.env.VITE_BOARD_SCHEMA ?? 'coord_map_1based').toString()
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [isThinking, setIsThinking] = useState(false)

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

  const payload = { board, rack, difficulty, board_schema: BOARD_SCHEMA }

      // Structured debug log
      const bkeys = Object.keys(board)
      if (import.meta.env.DEV) console.log({
        tag: 'quackle_payload',
        boardCellCount: bkeys.length,
        sampleKeys: bkeys.slice(0, 3),
        rack,
        rackLen: playerRack.length,
        difficulty,
        board_schema: BOARD_SCHEMA
      })

      const [move] = await Promise.all([
        quackleBestMove(payload),
        new Promise(resolve => setTimeout(resolve, thinkingTime))
      ])
      
  if (import.meta.env.DEV) console.log('[useQuackle] Raw move from Quackle service:', move)
      return move
    } finally {
      setIsThinking(false)
    }
  }, [])

  return {
    difficulty,
    setDifficulty,
    makeMove,
    isThinking
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
