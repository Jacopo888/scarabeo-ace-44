import React, { useState, useMemo } from 'react';
import { useDictionary } from '@/contexts/DictionaryContext';
import { DictionaryLoader } from '@/components/DictionaryLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BookOpen } from 'lucide-react';

const Dictionary: React.FC = () => {
  const { isLoaded, wordCount, isValidWord } = useDictionary();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLength, setSelectedLength] = useState<number | null>(null);

  // Since we can't iterate over the Set directly in the context,
  // we'll simulate word display with search functionality
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toUpperCase();
    const results = [];
    
    // Generate potential words based on search term
    if (term.length >= 2) {
      // Check if the search term itself is valid
      if (isValidWord(term)) {
        results.push(term);
      }
      
      // For demonstration, we'll show that we can validate words
      // but not list all words since that would be too many to display
    }
    
    return results;
  }, [searchTerm, isValidWord]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <DictionaryLoader />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Dictionary</h1>
          <p className="text-muted-foreground">
            ENABLE word list with {wordCount.toLocaleString()} words
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Word Validator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter a word to check if it's valid..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchTerm && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Result for "{searchTerm}":</span>
                <Badge variant={isValidWord(searchTerm) ? "default" : "destructive"}>
                  {isValidWord(searchTerm) ? "Valid Word" : "Invalid Word"}
                </Badge>
              </div>
              
              {isValidWord(searchTerm) && (
                <div className="text-sm text-muted-foreground">
                  ✓ This word is accepted in Scrabble gameplay
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dictionary Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{wordCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Words</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">2-15</div>
              <div className="text-sm text-muted-foreground">Word Lengths</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">ENABLE</div>
              <div className="text-sm text-muted-foreground">Word List</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">About ENABLE Word List</h3>
            <p className="text-sm text-muted-foreground">
              The Enhanced North American Benchmark LExicon (ENABLE) is a comprehensive word list 
              containing over 173,000 words. It includes all words from 2 to 15 letters that are 
              considered valid for word games like Scrabble.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dictionary;