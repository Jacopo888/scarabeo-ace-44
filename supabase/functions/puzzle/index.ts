import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Tile {
  letter: string;
  points: number;
}

interface PlacedTile {
  letter: string;
  row: number;
  col: number;
  isBlank?: boolean;
}

// Letter values for Scrabble
const LETTER_VALUES: Record<string, number> = {
  'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
  'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
  'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};

const COMMON_LETTERS = ['A', 'E', 'I', 'O', 'U', 'R', 'S', 'T', 'L', 'N'];
const HIGH_SCORING_WORDS = [
  'QUARTZ', 'ZEPHYR', 'OXYGEN', 'WIZARD', 'CRAZY', 'FUZZY',
  'JAZZY', 'PROXY', 'QUIRK', 'VEXING'
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Enhanced word list for legal puzzle generation
const ENHANCED_WORD_LIST = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'HAS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
  'QUIZ', 'FIZZ', 'BUZZ', 'JAZZ', 'FOXY', 'COZY', 'WAXY', 'ZEST', 'APEX', 'JINX', 'QUAY', 'OXIDE', 'PROXY', 'BLITZ', 'WALTZ', 'ZEBRA', 'DOZEN', 'FUZZY', 'JAZZY', 'DIZZY', 'PIZZA', 'PRIZE', 'FROZE', 'MAIZE', 'BRONZE', 'ENZYME', 'QUARTZ', 'WIZARD', 'OXYGEN', 'ZEPHYR',
  'PLAYER', 'POINTS', 'BOARDS', 'LETTER', 'CHANCE', 'DOUBLE', 'TRIPLE', 'SCORED', 'WINNER', 'PLACED', 'MASTER', 'EXPERT', 'PUZZLE', 'CHALLENGE', 'STRATEGY', 'COMPUTER', 'VOCABULARY', 'ALPHABET', 'SENTENCE', 'CROSSWORD', 'SPELLING',
  'AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST', 'BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT', 'CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE'
]);

// Words organized by starting letter
const WORDS_BY_LETTER: Record<string, string[]> = {
  'A': ['AMAZING', 'ARTIST', 'ANSWER', 'ALWAYS', 'AROUND', 'ALMOST'],
  'B': ['BETTER', 'BEFORE', 'BRINGS', 'BEYOND', 'BRIDGE', 'BRIGHT'],
  'C': ['CREATES', 'CLASSIC', 'CENTRAL', 'CHANGE', 'CHOICE', 'CIRCLE'],
  'P': ['PLAYER', 'POINTS', 'PUZZLE', 'PLACED'],
  'M': ['MASTER', 'MAKING'],
  'S': ['STRATEGY', 'SCORED', 'SPELLING'],
  'W': ['WINNER', 'WIZARD'],
  'Q': ['QUIZ', 'QUARTZ']
};

function isValidWord(word: string): boolean {
  return ENHANCED_WORD_LIST.has(word.toUpperCase());
}

function getRandomWordByLength(minLength: number): string | null {
  const longWords = Object.values(WORDS_BY_LETTER)
    .flat()
    .filter(word => word.length >= minLength);
  
  return longWords.length > 0 
    ? longWords[Math.floor(Math.random() * longWords.length)]
    : null;
}

function findWordsStartingWith(letter: string): string[] {
  return WORDS_BY_LETTER[letter] || [];
}

function placeWordOnBoard(
  board: Map<string, PlacedTile>,
  word: string,
  startRow: number,
  startCol: number,
  direction: 'horizontal' | 'vertical',
  tileBag: Tile[]
): boolean {
  const positions: Array<{row: number, col: number, letter: string}> = [];
  
  for (let i = 0; i < word.length; i++) {
    const row = direction === 'vertical' ? startRow + i : startRow;
    const col = direction === 'horizontal' ? startCol + i : startCol;
    
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return false;
    }
    
    positions.push({ row, col, letter: word[i] });
  }
  
  let hasConnection = false;
  for (const pos of positions) {
    const existing = board.get(`${pos.row},${pos.col}`);
    if (existing) {
      if (existing.letter !== pos.letter) {
        return false;
      }
      hasConnection = true;
    }
  }
  
  if (board.size > 0 && !hasConnection) {
    return false;
  }
  
  for (const pos of positions) {
    const key = `${pos.row},${pos.col}`;
    if (!board.has(key)) {
      const tile = {
        letter: pos.letter,
        points: LETTER_VALUES[pos.letter] || 1,
        row: pos.row,
        col: pos.col
      };
      board.set(key, tile);
    }
  }
  
  return true;
}

function generateLegalPuzzle() {
  const board = new Map<string, PlacedTile>();
  const wordsGenerated: string[] = [];
  
  // 1. Choose a long initial word and place it in center
  const firstWord = getRandomWordByLength(6) || 'PUZZLE';
  const startCol = 7 - Math.floor(firstWord.length / 2);
  
  if (!placeWordOnBoard(board, firstWord, 7, startCol, 'horizontal', [])) {
    throw new Error('Unable to place initial word');
  }
  wordsGenerated.push(firstWord);
  
  // 2. Generate 6 additional words by connecting them
  for (let wordCount = 1; wordCount < 7; wordCount++) {
    const placedTiles = Array.from(board.values());
    const randomTile = placedTiles[Math.floor(Math.random() * placedTiles.length)];
    const connectingLetter = randomTile.letter;
    
    const possibleWords = findWordsStartingWith(connectingLetter);
    if (possibleWords.length === 0) continue;
    
    const newWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
    
    const attempts = [
      { row: randomTile.row - 1, col: randomTile.col, direction: 'vertical' as const },
      { row: randomTile.row + 1, col: randomTile.col, direction: 'vertical' as const },
      { row: randomTile.row, col: randomTile.col - 1, direction: 'horizontal' as const },
      { row: randomTile.row, col: randomTile.col + 1, direction: 'horizontal' as const },
    ];
    
    let placed = false;
    for (const attempt of attempts) {
      const boardCopy = new Map(board);
      
      if (placeWordOnBoard(boardCopy, newWord, attempt.row, attempt.col, attempt.direction, [])) {
        board.clear();
        boardCopy.forEach((tile, key) => board.set(key, tile));
        wordsGenerated.push(newWord);
        placed = true;
        break;
      }
    }
  }
  
  // Generate player rack
  const rack: Tile[] = [];
  
  // Add vowels
  for (let i = 0; i < 2; i++) {
    const vowel = ['A', 'E', 'I', 'O', 'U'][Math.floor(Math.random() * 5)];
    rack.push({ letter: vowel, points: LETTER_VALUES[vowel] });
  }
  
  // Add consonants
  for (let i = 0; i < 3; i++) {
    const consonant = ['R', 'S', 'T', 'L', 'N'][Math.floor(Math.random() * 5)];
    rack.push({ letter: consonant, points: LETTER_VALUES[consonant] });
  }
  
  // Add random letters
  for (let i = 0; i < 2; i++) {
    const allLetters = Object.keys(LETTER_VALUES);
    const randomLetter = allLetters[Math.floor(Math.random() * allLetters.length)];
    rack.push({ letter: randomLetter, points: LETTER_VALUES[randomLetter] });
  }
  
  const bestScore = 50 + Math.floor(Math.random() * 30); // 50-80 points
  
  return {
    board: Array.from(board.values()),
    rack: shuffleArray(rack),
    bestScore
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`Processing ${req.method} request to ${path}`);

    // GET /puzzle/new - Generate new puzzle
    if (req.method === 'GET' && path.endsWith('/new')) {
      const puzzleData = generateLegalPuzzle();
      
      // Store puzzle in database
      const { data: puzzle, error: insertError } = await supabase
        .from('puzzles')
        .insert({
          board: puzzleData.board,
          rack: puzzleData.rack,
          best_score: puzzleData.bestScore
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting puzzle:', insertError);
        throw new Error('Failed to store puzzle');
      }

      return new Response(JSON.stringify({
        puzzleId: puzzle.id,
        board: puzzle.board,
        rack: puzzle.rack,
        bestScore: puzzle.best_score
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /puzzle/score - Submit score
    if (req.method === 'POST' && path.endsWith('/score')) {
      const { puzzleId, userId, score } = await req.json();
      
      if (!puzzleId || !userId || typeof score !== 'number') {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert or update score
      const { error: upsertError } = await supabase
        .from('puzzle_scores')
        .upsert({
          puzzle_id: puzzleId,
          user_id: userId,
          score: score
        }, {
          onConflict: 'puzzle_id,user_id'
        });

      if (upsertError) {
        console.error('Error upserting score:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to save score' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /puzzle/leaderboard - Get leaderboard
    if (req.method === 'GET' && path.endsWith('/leaderboard')) {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      const { data: scores, error: fetchError } = await supabase
        .from('puzzle_scores')
        .select('id, user_id, puzzle_id, score, created_at')
        .order('score', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.error('Error fetching leaderboard:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(scores || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});