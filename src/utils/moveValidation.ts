/**
 * DEPRECATION NOTICE
 * Questo modulo è mantenuto per retrocompatibilità nei test.
 * La validazione della mossa è stata centralizzata in `src/core/board.ts`
 * ed esposta al resto dell'app tramite `makeCoreConfirmDeps` in `src/core/confirmDeps.ts`.
 * Nuovo flusso consigliato:
 *   - canPlace(boardMatrix, move)
 *   - scanMainLine/scanCrossWords per le parole
 */
import { PlacedTile } from '@/types/game'
import { createEmptyBoard, Board, isBoardEmpty } from '@/core/board'
// Import dagli helper (barrel) per evitare l'auto-import ciclico di questo file
import {
  areNewTilesContiguous,
  areTilesInSingleLine,
  areNewTilesAdjacentToBoard,
  areGapsFilledByExistingTiles,
  coversCenter
} from './moveValidation/index'

export interface MoveValidation {
  isValid: boolean
  errors: string[]
}

export const validateMoveLogic = (
  boardInput: Map<string, PlacedTile> | Board,
  newTiles: PlacedTile[]
): MoveValidation => {
  // Normalizza a Board matrix (migrazione). Permette compat con vecchi test che passavano Map.
  let board: Board
  if (Array.isArray(boardInput)) {
    board = boardInput
  } else {
    board = createEmptyBoard()
    for (const [k, tile] of boardInput.entries()) {
      const [r, c] = k.split(',').map(Number)
      if (r >= 0 && r < 15 && c >= 0 && c < 15) board[r][c] = tile
    }
  }
  // Contract (riassunto):
  // - Input: board = mappa ("row,col" -> PlacedTile) con le tessere già piazzate; newTiles = tessere del turno corrente
  // - Assunzioni: coordinate 0..14, nessuna mutazione degli input; isBlank può essere true ma letter deve essere valorizzata
  // - Esito: errors[] con motivi di invalidità; isValid=true se e solo se nessun errore
  // - Regole: caselle libere, posizionamento in linea unica, contiguità o gap coperti da board, copertura centro alla prima mossa,
  //           adiacenza al board se non è la prima mossa
  const errors: string[] = []
  
  if (newTiles.length === 0) {
    return {
      isValid: false,
      errors: ['You must place at least one tile']
    }
  }
  
  // Check if tiles are placed on empty squares
  for (const tile of newTiles) {
    if (board[tile.row][tile.col] !== null) {
      errors.push('Cannot place tile on occupied square')
    }
  }

  const contiguous = areNewTilesContiguous(newTiles)
  const gapsFilled = areGapsFilledByExistingTiles(board as any, newTiles)

  // Check if tiles are contiguous
  if (newTiles.length > 1 && !contiguous && !gapsFilled) {
    errors.push('All new tiles must be adjacent to each other')
  }
  
  // Check if tiles are in a single line
  if (!areTilesInSingleLine(newTiles)) {
    errors.push('Tiles must be placed in a single row or column')
  }
  
  // Check if first move covers center square
  if (isBoardEmpty(board) && !coversCenter(newTiles)) {
    errors.push('First move must cover the center square')
  }
  
  // Check if tiles are adjacent to existing tiles (except first move)
  if (!isBoardEmpty(board) && !areNewTilesAdjacentToBoard(board as any, newTiles)) {
    errors.push('New tiles must be adjacent to existing tiles')
  }
  
  // Check if gaps are filled by existing tiles
  if (!gapsFilled) {
    errors.push('Gaps between new tiles must be filled by existing tiles')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// helpers moved to ./moveValidation/*