import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { quackleApi } from '@/config/quackle'
import { normalizeNewlines } from '@/utils/text'

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

      // 1) Try service-provided word list; 2) fall back to bundled ENABLE.
      let text = ''
      try {
        const svc = await fetch(quackleApi('/lexicon/words'))
        if (svc.ok) text = await svc.text()
      } catch {}
      if (!text) {
        const resp = await fetch('/enable.txt')
        if (!resp.ok) throw new Error(`Failed to load dictionary: ${resp.status}`)
        text = await resp.text()
      }

      // Normalize line endings and build the set in one shot.
      const words = normalizeNewlines(text)
        .split('\n')
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0)

      setWordsSet(new Set(words))
      setIsLoaded(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(msg)
      setWordsSet(new Set())
      setIsLoaded(true)
    } finally {
      setIsLoading(false)
    }
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
