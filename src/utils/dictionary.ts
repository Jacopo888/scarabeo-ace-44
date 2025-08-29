// Enhanced dictionary system using complete ENABLE word list
// Legacy support for direct imports - modern usage should use DictionaryContext
export const ENABLE_WORDS = new Set<string>()

// Initialize with basic fallback words for immediate availability
const initializeFallbackWords = () => {
  const fallbackWords = [
    // Essential 2-letter words
    'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
    'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET',
    'EX', 'FA', 'FE', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA',
    'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD',
    'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY', 'PA', 'PE', 'PI',
    'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TI', 'TO', 'UH', 'UM', 'UN', 'UP', 'US', 'UT', 'WE', 'WO',
    'XI', 'XU', 'YA', 'YE', 'YO', 'ZA',
    
    // Essential gameplay words
    'THE', 'AND', 'YOU', 'ARE', 'FOR', 'CAN', 'GET', 'HAS', 'HAD', 'HIS', 'HER', 'SHE', 'HIM', 'ONE',
    'TWO', 'WHO', 'OIL', 'SIT', 'SET', 'BUT', 'NOT', 'ALL', 'WAY', 'MAY', 'SAY', 'USE', 'MAN', 'NEW',
    'NOW', 'OLD', 'SEE', 'TWO', 'HOW', 'ITS', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW',
    'GAME', 'WORD', 'PLAY', 'TILE', 'BOARD', 'SCORE'
  ]
  
  fallbackWords.forEach(word => ENABLE_WORDS.add(word.toUpperCase()))
}

// Initialize fallback words immediately
initializeFallbackWords()

// Legacy functions for backward compatibility
// These should be replaced with useDictionary hook in components
export const isValidWord = (word: string): boolean => {
  console.warn('Using legacy isValidWord - consider using useDictionary hook')
  return ENABLE_WORDS.has(word.toUpperCase())
}

export const validateWords = (words: string[]): { valid: string[], invalid: string[] } => {
  console.warn('Using legacy validateWords - consider using useDictionary hook')
  const valid: string[] = []
  const invalid: string[] = []
  
  words.forEach(word => {
    if (isValidWord(word)) {
      valid.push(word)
    } else {
      invalid.push(word)
    }
  })
  
  return { valid, invalid }
}

export const checkWord = async (word: string): Promise<boolean> => {
  console.warn('Using legacy checkWord - consider using useDictionary hook')
  return ENABLE_WORDS.has(word.toUpperCase())
}

export const checkWords = (words: string[]): boolean => {
  console.warn('Using legacy checkWords - consider using useDictionary hook')
  return words.every(word => ENABLE_WORDS.has(word.toUpperCase()))
}