import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DictionaryContextType {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  isValidWord: (word: string) => boolean;
  validateWords: (words: string[]) => { valid: string[], invalid: string[] };
  checkWord: (word: string) => Promise<boolean>;
  checkWords: (words: string[]) => boolean;
  wordCount: number;
}

const DictionaryContext = createContext<DictionaryContextType | undefined>(undefined);

interface DictionaryProviderProps {
  children: ReactNode;
}

export const DictionaryProvider: React.FC<DictionaryProviderProps> = ({ children }) => {
  const [wordsSet, setWordsSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the ENABLE word list
      const response = await fetch('/enable.txt');
      if (!response.ok) {
        throw new Error(`Failed to load dictionary: ${response.status}`);
      }

      const text = await response.text();
      const words = text
        .split('\n')
        .map(word => word.trim().toUpperCase())
        .filter(word => word.length > 0);

      // Create the Set in chunks to avoid blocking the main thread
      const wordsSet = new Set<string>();
      const chunkSize = 500; // Smaller chunks
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize);
        chunk.forEach(word => wordsSet.add(word));
        
        // Yield control more frequently to allow UI updates
        if (i % chunkSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      setWordsSet(wordsSet);
      setIsLoaded(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Fallback to basic word set if loading fails
      setWordsSet(createFallbackDictionary());
      setIsLoaded(true);
    } finally {
      setIsLoading(false);
    }
  };

  const createFallbackDictionary = (): Set<string> => {
    // Basic fallback dictionary with essential words
    return new Set([
      // 2-letter words
      'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
      'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET',
      'EX', 'FA', 'FE', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA',
      'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD',
      'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY', 'PA', 'PE', 'PI',
      'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TI', 'TO', 'UH', 'UM', 'UN', 'UP', 'US', 'UT', 'WE', 'WO',
      'XI', 'XU', 'YA', 'YE', 'YO', 'ZA',
      
      // Common words for basic gameplay
      'THE', 'AND', 'YOU', 'ARE', 'FOR', 'CAN', 'GET', 'HAS', 'HAD', 'HIS', 'HER', 'SHE', 'HIM', 'ONE',
      'TWO', 'WHO', 'OIL', 'SIT', 'SET', 'BUT', 'NOT', 'ALL', 'WAY', 'MAY', 'SAY', 'USE', 'MAN', 'NEW',
      'NOW', 'OLD', 'SEE', 'TWO', 'HOW', 'ITS', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW',
      'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'OUR', 'OUT', 'SAY', 'SHE', 'TWO', 'USE', 'WAS', 'WAY', 'WHO'
    ]);
  };

  const isValidWord = (word: string): boolean => {
    return wordsSet.has(word.toUpperCase());
  };

  const validateWords = (words: string[]): { valid: string[], invalid: string[] } => {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    words.forEach(word => {
      if (isValidWord(word)) {
        valid.push(word);
      } else {
        invalid.push(word);
      }
    });
    
    return { valid, invalid };
  };

  const checkWord = async (word: string): Promise<boolean> => {
    return wordsSet.has(word.toUpperCase());
  };

  const checkWords = (words: string[]): boolean => {
    return words.every(word => wordsSet.has(word.toUpperCase()));
  };

  const contextValue: DictionaryContextType = {
    isLoaded,
    isLoading,
    error,
    isValidWord,
    validateWords,
    checkWord,
    checkWords,
    wordCount: wordsSet.size
  };

  return (
    <DictionaryContext.Provider value={contextValue}>
      {children}
    </DictionaryContext.Provider>
  );
};

export const useDictionary = (): DictionaryContextType => {
  const context = useContext(DictionaryContext);
  if (context === undefined) {
    throw new Error('useDictionary must be used within a DictionaryProvider');
  }
  return context;
};