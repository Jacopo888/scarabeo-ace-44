// Local fallback puzzle generator for 15x15 Puzzle mode
import { Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { Puzzle, PuzzleMove } from '@/types/puzzle'
import { ScrabbleBot } from '@/ai/ScrabbleBot'
import { validateMoveLogic } from '@/utils/moveValidation'
import { findNewWordsFormed } from '@/utils/newWordFinder'
import { calculateNewMoveScore } from '@/utils/newScoring'

const BASIC_WORDS = ['GAME', 'PLAY', 'WORD', 'QUIZ', 'STAR', 'TEAM', 'CODE', 'DATA', 'TEST']

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function generateConnectedBoard(
  tileBag: Tile[], 
  useLight = false, 
  simulationTurns = 2,
  isValidWord: (word: string) => boolean = () => true,
  isDictionaryLoaded: boolean = false
): Map<string, PlacedTile> {
  const board = new Map<string, PlacedTile>()

  // Start with a word at center (horizontally)
  const centerWords = ['GAME', 'PLAY', 'WORD', 'QUIZ', 'STAR', 'TEAM']
  const word = centerWords[Math.floor(Math.random() * centerWords.length)]
  const startCol = 7 - Math.floor(word.length / 2)
  
  for (let i = 0; i < word.length; i++) {
    const letter = word[i]
    const tileIndex = tileBag.findIndex(t => t.letter === letter)
    if (tileIndex >= 0) {
      const tile = tileBag.splice(tileIndex, 1)[0]
      board.set(`7,${startCol + i}`, {
        ...tile,
        letter,
        row: 7,
        col: startCol + i
      })
    }
  }

  // Add crossing words that connect properly
  const crossWords = [
    { word: 'CAT', row: 5, col: 7, direction: 'vertical' },
    { word: 'DOG', row: 8, col: 7, direction: 'vertical' },
    { word: 'TOP', row: 7, col: 4, direction: 'horizontal' },
    { word: 'SUN', row: 6, col: 8, direction: 'vertical' },
    { word: 'RUN', row: 7, col: 10, direction: 'horizontal' }
  ]
  
  // Place 2-3 crossing words that actually connect
  const selectedCrossWords = shuffleArray(crossWords).slice(0, Math.random() > 0.5 ? 3 : 2)
  
  for (const cross of selectedCrossWords) {
    let canPlace = true
    const newPositions: Array<{row: number, col: number, letter: string}> = []
    
    for (let i = 0; i < cross.word.length; i++) {
      const row = cross.direction === 'vertical' ? cross.row + i : cross.row
      const col = cross.direction === 'horizontal' ? cross.col + i : cross.col
      
      if (row < 0 || row >= 15 || col < 0 || col >= 15) {
        canPlace = false
        break
      }
      
      const existing = board.get(`${row},${col}`)
      if (existing) {
        // Must match for crossing
        if (existing.letter !== cross.word[i]) {
          canPlace = false
          break
        }
      } else {
        newPositions.push({ row, col, letter: cross.word[i] })
      }
    }
    
    // Ensure at least one connection
    const hasConnection = cross.word.split('').some((letter, i) => {
      const row = cross.direction === 'vertical' ? cross.row + i : cross.row
      const col = cross.direction === 'horizontal' ? cross.col + i : cross.col
      return board.has(`${row},${col}`)
    })
    
    if (canPlace && hasConnection) {
      for (const pos of newPositions) {
        const tileIndex = tileBag.findIndex(t => t.letter === pos.letter)
        if (tileIndex >= 0) {
          const tile = tileBag.splice(tileIndex, 1)[0]
          board.set(`${pos.row},${pos.col}`, {
            ...tile,
            letter: pos.letter,
            row: pos.row,
            col: pos.col
          })
        }
      }
    }
  }

  // Simulate additional moves to make it look mid-game
  return simulateAdditionalMoves(board, tileBag, useLight, simulationTurns, isValidWord, isDictionaryLoaded)
}

function simulateAdditionalMoves(
  board: Map<string, PlacedTile>, 
  tileBag: Tile[], 
  useLight = false, 
  simulationTurns = 2,
  isValidWord: (word: string) => boolean = () => true,
  isDictionaryLoaded: boolean = false
): Map<string, PlacedTile> {
  // Skip heavy simulation in light mode or without dictionary
  if (useLight || !isDictionaryLoaded) {
    return board
  }
  
  const bot = new ScrabbleBot(isValidWord, isDictionaryLoaded)
  
  for (let moveCount = 0; moveCount < simulationTurns; moveCount++) {
    const currentRack = tileBag.splice(0, 7)
    if (currentRack.length < 3) break
    
    const gameState = {
      board,
      players: [],
      currentPlayerIndex: 0,
      tileBag: [],
      gameStatus: 'playing' as const
    }
    
    const moves = bot.generateAllPossibleMoves(gameState, currentRack)
    const validMoves = moves.filter(move => move.score >= 15 && move.tiles.length >= 2).slice(0, 20)
    
    if (validMoves.length > 0) {
      const selectedMove = validMoves[Math.floor(Math.random() * Math.min(3, validMoves.length))]
      
      // Place the move on the board
      for (const tile of selectedMove.tiles) {
        board.set(`${tile.row},${tile.col}`, tile)
      }
      
      // Remove used tiles from rack
      for (const usedTile of selectedMove.tiles) {
        const rackIndex = currentRack.findIndex(t => t.letter === usedTile.letter && t.points === usedTile.points)
        if (rackIndex >= 0) {
          currentRack.splice(rackIndex, 1)
        }
      }
    }
    
    // Return unused tiles to bag
    tileBag.unshift(...currentRack)
  }
  
  return board
}

// Helper to create plausible moves using only rack tiles
function createPlaceableFallbackMove(boardMap: Map<string, PlacedTile>, rack: Tile[]): PuzzleMove {
  // Find free cells adjacent to existing tiles
  const adjacentCells: Array<{row: number, col: number}> = []
  
  for (const [key, tile] of boardMap.entries()) {
    const { row, col } = tile
    
    // Check all 4 directions
    const neighbors = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 }
    ]
    
    for (const neighbor of neighbors) {
      if (neighbor.row >= 0 && neighbor.row < 15 && neighbor.col >= 0 && neighbor.col < 15) {
        const neighborKey = `${neighbor.row},${neighbor.col}`
        if (!boardMap.has(neighborKey) && !adjacentCells.some(c => c.row === neighbor.row && c.col === neighbor.col)) {
          adjacentCells.push(neighbor)
        }
      }
    }
  }
  
  if (adjacentCells.length === 0 || rack.length === 0) {
    // Ultimate fallback: place at center
    return {
      tiles: [{
        ...rack[0] || { letter: 'A', points: 1, isBlank: false },
        row: 7,
        col: 7
      }],
      words: ['A'],
      score: 10,
      startCell: { row: 7, col: 7 },
      mainWordLength: 1,
      lettersUsed: rack.length > 0 ? [rack[0].letter] : ['A']
    }
  }
  
  // Use 1-2 tiles from rack on adjacent free cells
  const numTiles = Math.min(2, rack.length, adjacentCells.length)
  const selectedCells = adjacentCells.slice(0, numTiles)
  const selectedRackTiles = rack.slice(0, numTiles)
  
  const tiles: PlacedTile[] = selectedCells.map((cell, i) => ({
    ...selectedRackTiles[i],
    row: cell.row,
    col: cell.col
  }))
  
  return {
    tiles,
    words: [tiles.map(t => t.letter).join('')], // Simple word from placed tiles
    score: tiles.reduce((sum, t) => sum + t.points, 0) + 15, // Base points + bonus
    startCell: { row: tiles[0].row, col: tiles[0].col },
    mainWordLength: tiles.length,
    lettersUsed: tiles.map(t => t.letter).sort()
  }
}

function generateTopMovesWithBot(
  board: Map<string, PlacedTile>, 
  rack: Tile[], 
  isValidWord: (word: string) => boolean,
  isDictionaryLoaded: boolean
): PuzzleMove[] {
  const bot = new ScrabbleBot(isValidWord, isDictionaryLoaded)
  
  if (!isDictionaryLoaded) {
    // Use rack-based fallback instead of board tiles
    return [createPlaceableFallbackMove(board, rack)]
  }
  
  const gameState = {
    board,
    players: [],
    currentPlayerIndex: 0,
    tileBag: [],
    gameStatus: 'playing' as const
  }
  
  const allMoves = bot.generateAllPossibleMoves(gameState, rack).slice(0, 200)
  
  // Filter for high-scoring moves, then select a mixed set (directions/anchors)
  const filtered = allMoves
    .filter(move => move.score >= 30)
    .sort((a, b) => b.score - a.score)

  const picked: typeof allMoves = []
  const seenAnchors = new Set<string>()

  const getOrientation = (mv: typeof allMoves[number]) => mv.tiles.every(t => t.row === mv.tiles[0].row) ? 'H' : 'V'
  const getStartTile = (mv: typeof allMoves[number]) => {
    const isH = getOrientation(mv) === 'H'
    return isH
      ? mv.tiles.reduce((min, t) => (t.col < min.col ? t : min), mv.tiles[0])
      : mv.tiles.reduce((min, t) => (t.row < min.row ? t : min), mv.tiles[0])
  }
  
  // Prefer alternating orientations and different anchor rows/cols
  let lastOrientation: 'H' | 'V' | null = null
  for (const mv of filtered) {
    if (picked.length >= 5) break
    const ori = getOrientation(mv)
    const start = getStartTile(mv)
    const anchorKey = ori === 'H' ? `r${start.row}` : `c${start.col}`

    const orientationOk = lastOrientation === null || ori !== lastOrientation || picked.length >= 3
    const anchorOk = !seenAnchors.has(anchorKey)

    if (orientationOk && anchorOk) {
      picked.push(mv)
      seenAnchors.add(anchorKey)
      lastOrientation = ori
    }
  }

  // Fill remaining slots if needed
  if (picked.length < 5) {
    for (const mv of filtered) {
      if (picked.length >= 5) break
      const start = getStartTile(mv)
      const anchorKey = getOrientation(mv) === 'H' ? `r${start.row}` : `c${start.col}`
      if (!picked.includes(mv)) {
        // try to avoid duplicate anchors if possible
        if (!seenAnchors.has(anchorKey) || picked.length <= 2) {
          picked.push(mv)
          seenAnchors.add(anchorKey)
        }
      }
    }
  }

  const finalMoves = picked.slice(0, 5).map(move => {
    const isHorizontal = move.tiles.every(t => t.row === move.tiles[0].row)
    const startTile = isHorizontal
      ? move.tiles.reduce((min, t) => (t.col < min.col ? t : min), move.tiles[0])
      : move.tiles.reduce((min, t) => (t.row < min.row ? t : min), move.tiles[0])
    const startCell = { row: startTile.row, col: startTile.col }
    const mainWordLength = move.words.length > 0 ? Math.max(...move.words.map(w => w.length)) : undefined
    const lettersUsed = move.tiles.map(tile => tile.letter).sort()

    return {
      tiles: move.tiles,
      words: move.words,
      score: move.score,
      startCell,
      mainWordLength,
      lettersUsed
    }
  })

  return finalMoves
}

export function generateLocal15x15Puzzle(
  isValidWord: (word: string) => boolean,
  isDictionaryLoaded: boolean,
  useLight = false,
  simulationTurns = 2
): Puzzle {
  let attempts = 0
  const maxAttempts = useLight ? 1 : 5
  
  while (attempts < maxAttempts) {
    const tileBag = shuffleArray([...TILE_DISTRIBUTION])
    const board = generateConnectedBoard(tileBag, useLight, simulationTurns, isValidWord, isDictionaryLoaded)
    const rack = tileBag.splice(0, 7)
    
    const topMoves = generateTopMovesWithBot(board, rack, isValidWord, isDictionaryLoaded)

    if (topMoves.length >= 3 && topMoves[0].score >= 30) {
      return {
        id: `local-15x15-${Date.now()}`,
        board: Array.from(board.values()),
        rack: shuffleArray(rack),
        topMoves
      }
    }
    
    attempts++
  }
  
  // Fallback - always succeeds
  const tileBag = shuffleArray([...TILE_DISTRIBUTION])
  const board = generateConnectedBoard(tileBag, true, 1, isValidWord, isDictionaryLoaded) // Force light mode for fallback with minimal turns
  const rack = tileBag.splice(0, 7)
  
  // Generate fallback moves using only rack tiles
  const fallbackMoves = [createPlaceableFallbackMove(board, rack)]
  
  return {
    id: `local-fallback-${Date.now()}`,
    board: Array.from(board.values()),
    rack: shuffleArray(rack),
    topMoves: fallbackMoves
  }
}

// Export function to generate top moves for any board+rack combination
export function getTopMovesForBoard(
  boardMap: Map<string, PlacedTile>,
  rack: Tile[],
  isValidWord: (word: string) => boolean,
  isDictionaryLoaded: boolean
): PuzzleMove[] {
  return generateTopMovesWithBot(boardMap, rack, isValidWord, isDictionaryLoaded)
}