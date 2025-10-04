import { PlacedTile } from '@/types/game'
import { canPlace, scanCrossWords, scanMainLine, Board } from './board'

export function makeCoreConfirmDeps(isValidWord: (w: string) => boolean) {
  return {
    validateMoveLogic: (board: Board, pending: PlacedTile[]) => {
      const res = canPlace(board, pending)
      if (!res.ok) return { isValid: false, errors: [res.reason || 'invalid_move'] }
      return { isValid: true, errors: [] }
    },
    findNewWordsFormed: (board: Board, pending: PlacedTile[]) => {
      const main = scanMainLine(board, pending)
      const crosses = scanCrossWords(board, pending)
      const words: string[] = []
      // Include main word when significativa (>=1); se è di lunghezza 1 saranno comunque validate tramite crosses
      if (main.length > 1 || (main.length === 1 && crosses.length === 0)) {
        words.push(main.map(t => t.letter).join(''))
      }
      for (const line of crosses) words.push(line.map(t => t.letter).join(''))
      // Dedup
      const unique = Array.from(new Set(words)).filter(Boolean)
      return unique.map(w => ({ word: w })).filter(w => w.word.length > 0)
    },
    calculateScorePassthrough: undefined as unknown as never,
    isValidWord,
  }
}
