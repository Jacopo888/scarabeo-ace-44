import { Tile, PlacedTile, TILE_DISTRIBUTION } from '@/types/game'
import { Puzzle, PuzzleMove } from '@/types/puzzle'
import { ScrabbleBot } from '@/ai/ScrabbleBot'

interface GeneratedBoard {
  placedTiles: Map<string, PlacedTile>
  wordsGenerated: string[]
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function getRandomWordByLength(isValidWord: (word: string) => boolean, minLength: number): string | null {
  // Lista di parole comuni lunghe per iniziare
  const longWords = [
    'PLAYER', 'POINTS', 'BOARDS', 'LETTER', 'CHANCE', 'DOUBLE', 'TRIPLE', 'SCORED',
    'WINNER', 'PLACED', 'MASTER', 'EXPERT', 'PUZZLE', 'CHALLENGE', 'STRATEGY',
    'COMPUTER', 'VOCABULARY', 'ALPHABET', 'SENTENCE', 'CROSSWORD', 'SPELLING'
  ]
  
  const validLongWords = longWords.filter(word => 
    word.length >= minLength && isValidWord(word)
  )
  
  if (validLongWords.length === 0) {
    // Fallback a parole più corte se non troviamo niente
    const shortWords = ['GAME', 'PLAY', 'WORD', 'TILE', 'BOARD', 'SCORE']
    const validShortWords = shortWords.filter(word => isValidWord(word))
    return validShortWords.length > 0 ? validShortWords[Math.floor(Math.random() * validShortWords.length)] : null
  }
  
  return validLongWords[Math.floor(Math.random() * validLongWords.length)]
}

function findWordsStartingWith(letter: string, isValidWord: (word: string) => boolean): string[] {
  // Lista curata di parole che iniziano con lettere comuni
  const wordsByLetter: Record<string, string[]> = {
    'A': ['AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST'],
    'B': ['BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT'],
    'C': ['CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE'],
    'D': ['DOUBLE', 'DURING', 'DIRECT', 'DECIDE', 'DESIGN', 'DETAIL'],
    'E': ['EXPERT', 'ENABLE', 'ENERGY', 'ENOUGH', 'EASILY', 'ENTER'],
    'F': ['FUTURE', 'FRIEND', 'FOLLOW', 'FAMOUS', 'FIGURE', 'FINISH'],
    'G': ['GOLDEN', 'GLOBAL', 'GROUND', 'GARDEN', 'GATHER', 'GIVING'],
    'H': ['HELPER', 'HAPPEN', 'HIGHER', 'HANDLE', 'HEARTS', 'HOSTED'],
    'I': ['INSIDE', 'INDEED', 'ISLAND', 'IMPACT', 'INVITE', 'INFORM'],
    'J': ['JOINED', 'JUNGLE', 'JUMPED', 'JUNIOR', 'JOYFUL', 'JACKET'],
    'K': ['KEEPER', 'KINDLY', 'KNIGHT', 'KITCHEN', 'KINGDOM', 'KNOWLEDGE'],
    'L': ['LONGER', 'LOVELY', 'LISTEN', 'LEADER', 'LITTLE', 'LETTER'],
    'M': ['MASTER', 'MAKING', 'MOMENT', 'MODERN', 'MOBILE', 'MENTAL'],
    'N': ['NATURE', 'NOTHING', 'NORMAL', 'NEARBY', 'NOTICE', 'NUMBER'],
    'O': ['ONLINE', 'OUTSIDE', 'OPENED', 'OBJECT', 'OFFICE', 'ORANGE'],
    'P': ['PLAYER', 'POINTS', 'PUZZLE', 'PRETTY', 'PLACED', 'PERSON'],
    'Q': ['QUALITY', 'QUICKLY', 'QUESTION', 'QUIETLY', 'QUARTER', 'QUEEN'],
    'R': ['REALLY', 'RETURN', 'RESULT', 'RECORD', 'REASON', 'RECENT'],
    'S': ['SIMPLE', 'STRONG', 'SECOND', 'SYSTEM', 'SINGLE', 'SOUNDS'],
    'T': ['TRYING', 'TURTLE', 'TRAVEL', 'TALENT', 'THANKS', 'TISSUE'],
    'U': ['UNIQUE', 'UNABLE', 'UNITED', 'USEFUL', 'UNITED', 'UPLOAD'],
    'V': ['VALLEY', 'VISUAL', 'VOLUME', 'VILLAGE', 'VISION', 'VALUED'],
    'W': ['WINNER', 'WONDER', 'WINDOW', 'WORKED', 'WRITER', 'WEEKLY'],
    'X': ['XYLEM'], // Molto poche parole iniziano con X
    'Y': ['YELLOW', 'YEARLY', 'YOUNG'], 
    'Z': ['ZEBRA', 'ZONAL'] // Molto poche parole iniziano con Z
  }
  
  const candidates = wordsByLetter[letter] || []
  return candidates.filter(word => isValidWord(word))
}

function placeWordOnBoard(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[]
): boolean {
  const positions: Array<{row: number, col: number, letter: string}> = []
  
  // Calcola tutte le posizioni
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow
    const col = direction === 'horizontal' ? startCol + i : startCol
    
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return false // Fuori dal board
    }
    
    positions.push({ row, col, letter: word[i] })
  }
  
  // Verifica conflitti e trova connessioni
  let hasConnection = false
  for (const pos of positions) {
    const existing = board.get(`${pos.row},${pos.col}`)
    if (existing) {
      if (existing.letter !== pos.letter) {
        return false // Conflitto
      }
      hasConnection = true
    }
  }
  
  // Se non è la prima parola, deve connettersi
  if (board.size > 0 && !hasConnection) {
    return false
  }
  
  // Piazza le nuove lettere
  for (const pos of positions) {
    const key = `${pos.row},${pos.col}`
    if (!board.has(key)) {
      const tileIndex = tileBag.findIndex(t => t.letter === pos.letter)
      if (tileIndex >= 0) {
        const tile = tileBag.splice(tileIndex, 1)[0]
        board.set(key, {
          ...tile,
          row: pos.row,
          col: pos.col
        })
      } else {
        return false // Non abbiamo la lettera nel sacchetto
      }
    }
  }
  
  return true
}

function generateLegalBoard(isValidWord: (word: string) => boolean, tileBag: Tile[]): GeneratedBoard {
  const board = new Map<string, PlacedTile>()
  const wordsGenerated: string[] = []
  
  // 1. Scegli una parola iniziale lunga (>5 lettere) e piazzala al centro
  const firstWord = getRandomWordByLength(isValidWord, 6)
  if (!firstWord) {
    throw new Error('Impossibile trovare una parola iniziale valida')
  }
  
  const startCol = 7 - Math.floor(firstWord.length / 2)
  if (!placeWordOnBoard(board, firstWord, 7, startCol, 'horizontal', tileBag)) {
    throw new Error('Impossibile piazzare la parola iniziale')
  }
  wordsGenerated.push(firstWord)
  
  // 2. Genera max 4 parole aggiuntive connettendole (ridotto per evitare loop)
  for (let wordCount = 1; wordCount < 5; wordCount++) {
    // Scegli una lettera casuale dalle parole già piazzate
    const placedTiles = Array.from(board.values())
    if (placedTiles.length === 0) break
    
    const randomTile = placedTiles[Math.floor(Math.random() * placedTiles.length)]
    const connectingLetter = randomTile.letter
    
    // Trova parole che iniziano con quella lettera
    const possibleWords = findWordsStartingWith(connectingLetter, isValidWord)
    if (possibleWords.length === 0) continue
    
    const newWord = possibleWords[Math.floor(Math.random() * possibleWords.length)]
    
    // Prova a piazzare la parola in diverse posizioni
    let placed = false
    const attempts = [
      // Sopra
      { row: randomTile.row - 1, col: randomTile.col, direction: 'vertical' as const },
      // Sotto  
      { row: randomTile.row + 1, col: randomTile.col, direction: 'vertical' as const },
      // Sinistra
      { row: randomTile.row, col: randomTile.col - 1, direction: 'horizontal' as const },
      // Destra
      { row: randomTile.row, col: randomTile.col + 1, direction: 'horizontal' as const },
    ]
    
    for (const attempt of attempts) {
      const boardCopy = new Map(board)
      const tileBagCopy = [...tileBag]
      
      if (placeWordOnBoard(boardCopy, newWord, attempt.row, attempt.col, attempt.direction, tileBagCopy)) {
        // Successo - aggiorna il board vero
        board.clear()
        boardCopy.forEach((tile, key) => board.set(key, tile))
        tileBag.splice(0, tileBag.length, ...tileBagCopy)
        wordsGenerated.push(newWord)
        placed = true
        break
      }
    }
    
    if (!placed) {
      // Se non riusciamo a piazzare, proviamo con una parola più corta
      const shorterWords = findWordsStartingWith(connectingLetter, isValidWord)
        .filter(w => w.length <= 4)
      
      for (const shortWord of shorterWords) {
        for (const attempt of attempts) {
          const boardCopy = new Map(board)
          const tileBagCopy = [...tileBag]
          
          if (placeWordOnBoard(boardCopy, shortWord, attempt.row, attempt.col, attempt.direction, tileBagCopy)) {
            board.clear()
            boardCopy.forEach((tile, key) => board.set(key, tile))
            tileBag.splice(0, tileBag.length, ...tileBagCopy)
            wordsGenerated.push(shortWord)
            placed = true
            break
          }
        }
        if (placed) break
      }
    }
  }
  
  return { placedTiles: board, wordsGenerated }
}

export function generateLegalPuzzle(
  isValidWord: (word: string) => boolean,
  isDictionaryLoaded: boolean
): Puzzle {
  if (!isDictionaryLoaded) {
    throw new Error('Dizionario non caricato - impossibile generare puzzle legale')
  }
  
  let attempts = 0
  const maxAttempts = 3 // Ridotto per evitare loop infiniti
  
  while (attempts < maxAttempts) {
    try {
      const tileBag = shuffleArray([...TILE_DISTRIBUTION])
      const { placedTiles, wordsGenerated } = generateLegalBoard(isValidWord, tileBag)
      
      // Crea la rack del giocatore
      const rack = tileBag.splice(0, 7)
      
      // Usa il bot per trovare la mossa migliore
      const bot = new ScrabbleBot(isValidWord, isDictionaryLoaded)
      const gameState = {
        board: placedTiles,
        players: [],
        currentPlayerIndex: 0,
        tileBag: [],
        gameStatus: 'playing' as const
      }
      
      const allMoves = bot.generateAllPossibleMoves(gameState, rack)
      const bestMoves = allMoves
        .filter(move => move.score >= 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
      
      if (bestMoves.length > 0) {
        const topMoves: PuzzleMove[] = bestMoves.map(move => {
          const isHorizontal = move.tiles.every(t => t.row === move.tiles[0].row)
          const startTile = isHorizontal
            ? move.tiles.reduce((min, t) => (t.col < min.col ? t : min), move.tiles[0])
            : move.tiles.reduce((min, t) => (t.row < min.row ? t : min), move.tiles[0])
          
          return {
            tiles: move.tiles,
            words: move.words,
            score: move.score,
            startCell: { row: startTile.row, col: startTile.col },
            mainWordLength: move.words.length > 0 ? Math.max(...move.words.map(w => w.length)) : undefined,
            lettersUsed: move.tiles.map(t => t.letter).sort()
          }
        })
        
        return {
          id: `legal-puzzle-${Date.now()}`,
          board: Array.from(placedTiles.values()),
          rack: shuffleArray(rack),
          topMoves
        }
      }
    } catch (error) {
      console.warn(`Tentativo ${attempts + 1} fallito:`, error)
    }
    
    attempts++
  }
  
  throw new Error('Impossibile generare un puzzle legale dopo ' + maxAttempts + ' tentativi')
}