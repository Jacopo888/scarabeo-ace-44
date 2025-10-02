/**
 * Board Constants - Single Source of Truth
 * 
 * Definisce le caselle speciali della board Scrabble (15x15)
 * e i moltiplicatori associati per il calcolo dello score.
 * 
 * Coordinate: 0-based (0-14), formato "row,col"
 * Centro board: (7,7) = STAR (conta come Double Word)
 */

export type SpecialSquareType = 'TW' | 'DW' | 'TL' | 'DL' | 'STAR'

/**
 * Mappa delle caselle speciali sulla board 15x15
 * 
 * - TW: Triple Word Score (×3 parola)
 * - DW: Double Word Score (×2 parola)
 * - TL: Triple Letter Score (×3 lettera)
 * - DL: Double Letter Score (×2 lettera)
 * - STAR: Centro board (7,7) - conta come DW
 */
export const SPECIAL_SQUARES: Record<string, SpecialSquareType> = {
  // Triple Word Score (rosso)
  "0,0": "TW", "0,7": "TW", "0,14": "TW",
  "7,0": "TW", "7,14": "TW",
  "14,0": "TW", "14,7": "TW", "14,14": "TW",
  
  // Double Word Score (rosa)
  "1,1": "DW", "1,13": "DW",
  "2,2": "DW", "2,12": "DW",
  "3,3": "DW", "3,11": "DW",
  "4,4": "DW", "4,10": "DW",
  "10,4": "DW", "10,10": "DW",
  "11,3": "DW", "11,11": "DW",
  "12,2": "DW", "12,12": "DW",
  "13,1": "DW", "13,13": "DW",
  
  // Triple Letter Score (blu scuro)
  "1,5": "TL", "1,9": "TL",
  "5,1": "TL", "5,5": "TL", "5,9": "TL", "5,13": "TL",
  "9,1": "TL", "9,5": "TL", "9,9": "TL", "9,13": "TL",
  "13,5": "TL", "13,9": "TL",
  
  // Double Letter Score (azzurro)
  "0,3": "DL", "0,11": "DL",
  "2,6": "DL", "2,8": "DL",
  "3,0": "DL", "3,7": "DL", "3,14": "DL",
  "6,2": "DL", "6,6": "DL", "6,8": "DL", "6,12": "DL",
  "7,3": "DL", "7,11": "DL",
  "8,2": "DL", "8,6": "DL", "8,8": "DL", "8,12": "DL",
  "11,0": "DL", "11,7": "DL", "11,14": "DL",
  "12,6": "DL", "12,8": "DL",
  "14,3": "DL", "14,11": "DL",
  
  // Star (centro) - conta come Double Word
  "7,7": "STAR"
} as const

/**
 * Restituisce i moltiplicatori per una casella speciale
 * 
 * @param type - Tipo di casella speciale (o null se normale)
 * @returns Oggetto con moltiplicatori { letter, word }
 * 
 * @example
 * getScoreMultiplier('TW')  // { letter: 1, word: 3 }
 * getScoreMultiplier('DL')  // { letter: 2, word: 1 }
 * getScoreMultiplier('STAR') // { letter: 1, word: 2 } (come DW)
 * getScoreMultiplier(null)  // { letter: 1, word: 1 }
 */
export function getScoreMultiplier(type: SpecialSquareType | null): {
  letter: number
  word: number
} {
  switch (type) {
    case 'TL':
      return { letter: 3, word: 1 }
    case 'DL':
      return { letter: 2, word: 1 }
    case 'TW':
      return { letter: 1, word: 3 }
    case 'DW':
      return { letter: 1, word: 2 }
    case 'STAR':
      return { letter: 1, word: 2 } // STAR conta come DW
    default:
      return { letter: 1, word: 1 }
  }
}

/**
 * Helper: ottiene il tipo di casella speciale data la posizione
 * 
 * @param row - Riga (0-14)
 * @param col - Colonna (0-14)
 * @returns Tipo casella speciale o null se normale
 */
export function getSpecialSquareType(row: number, col: number): SpecialSquareType | null {
  const key = `${row},${col}` as keyof typeof SPECIAL_SQUARES
  return SPECIAL_SQUARES[key] || null
}

/**
 * Verifica se una casella è uno special square
 */
export function isSpecialSquare(row: number, col: number): boolean {
  return getSpecialSquareType(row, col) !== null
}

/**
 * Ottiene i moltiplicatori per una posizione sulla board
 * 
 * @param row - Riga (0-14)
 * @param col - Colonna (0-14)
 * @returns Moltiplicatori { letter, word }
 */
export function getMultipliersAt(row: number, col: number): { letter: number; word: number } {
  const type = getSpecialSquareType(row, col)
  return getScoreMultiplier(type)
}
