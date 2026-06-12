import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { quackleApi } from '@/config/quackle'
import { qlog } from '@/config/debug'
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

  const parseWords = (text: string): string[] =>
    normalizeNewlines(text)
      .split('\n')
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length > 0)

  const loadDictionary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Prefer the bundled text list. The service may only ship binary DAWG/GADDAG files.
      let text = ''
      try {
        const resp = await fetch('/enable.txt', { cache: 'no-store' as RequestCache })
        if (resp.ok) text = await resp.text()
      } catch {}
      let words = parseWords(text)
      qlog('[Dictionary] local ENABLE words:', words.length)

      // If the static asset is unavailable, try the service-provided word list.
      if (words.length < 100) {
        const svc = await fetch(quackleApi('/lexicon/words'), { cache: 'no-store' as RequestCache })
        if (!svc.ok) throw new Error(`Failed to load dictionary: ${svc.status}`)
        words = parseWords(await svc.text())
        qlog('[Dictionary] service fallback words:', words.length)
      }

      setWordsSet(new Set(words))
      qlog('[Dictionary] final words set size:', words.length)
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
