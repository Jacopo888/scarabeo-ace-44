// Local fallback puzzle generator for when API is unavailable

interface Letter {
  letter: string
  points: number
}

interface Puzzle {
  id: string
  board: (string | null)[][]
  rack: Letter[]
  bestScore: number
}

const LETTER_VALUES: Record<string, number> = {
  'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
  'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
  'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
}

const HIGH_SCORING_WORDS = [
  'QUARTZ', 'ZEPHYR', 'OXYGEN', 'WIZARD', 'CRAZY', 'FUZZY',
  'JAZZY', 'PROXY', 'QUIRK', 'VEXING'
]

const COMMON_LETTERS = ['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T', 'L', 'N']

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function calculateWordScore(word: string): number {
  return word.split('').reduce((sum, letter) => sum + (LETTER_VALUES[letter] || 0), 0)
}

function generateRandomRack(): Letter[] {
  const letters = []
  
  // Add some vowels
  for (let i = 0; i < 2; i++) {
    const vowel = ['A', 'E', 'I', 'O', 'U'][Math.floor(Math.random() * 5)]
    letters.push({ letter: vowel, points: LETTER_VALUES[vowel] })
  }
  
  // Add common consonants
  for (let i = 0; i < 3; i++) {
    const consonant = ['R', 'S', 'T', 'L', 'N'][Math.floor(Math.random() * 5)]
    letters.push({ letter: consonant, points: LETTER_VALUES[consonant] })
  }
  
  // Add random letters
  for (let i = 0; i < 2; i++) {
    const allLetters = Object.keys(LETTER_VALUES)
    const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)]
    letters.push({ letter: randomLetter, points: LETTER_VALUES[randomLetter] })
  }
  
  return shuffleArray(letters)
}

function tryPlaceBoardLetters(): string[] {
  const letters = []
  
  // Try to include letters that form common words
  const targetWord = HIGH_SCORING_WORDS[Math.floor(Math.random() * HIGH_SCORING_WORDS.length)]
  
  // Add some letters from the target word
  for (let i = 0; i < Math.min(3, targetWord.length); i++) {
    letters.push(targetWord[i])
  }
  
  // Fill with random letters
  while (letters.length < 25) {
    const allLetters = Object.keys(LETTER_VALUES)
    const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)]
    letters.push(randomLetter)
  }
  
  return shuffleArray(letters)
}

export function generateLocalPuzzle(): Puzzle {
  const boardLetters = tryPlaceBoardLetters()
  const board: (string | null)[][] = []
  
  // Create 5x5 board
  for (let i = 0; i < 5; i++) {
    const row: (string | null)[] = []
    for (let j = 0; j < 5; j++) {
      row.push(boardLetters[i * 5 + j])
    }
    board.push(row)
  }
  
  const rack = generateRandomRack()
  
  // Calculate a reasonable best score (40-60 points)
  const bestScore = 45 + Math.floor(Math.random() * 16)
  
  return {
    id: `local-${Date.now()}`,
    board,
    rack,
    bestScore
  }
}