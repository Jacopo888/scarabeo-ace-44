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

function generatePuzzle() {
  // Generate board with some pre-placed tiles
  const board: PlacedTile[] = [];
  const targetWord = HIGH_SCORING_WORDS[Math.floor(Math.random() * HIGH_SCORING_WORDS.length)];
  
  // Place some letters from target word on board
  const startRow = Math.floor(Math.random() * 12) + 2; // Keep away from edges
  const startCol = Math.floor(Math.random() * (15 - targetWord.length));
  
  for (let i = 0; i < Math.min(3, targetWord.length); i++) {
    board.push({
      letter: targetWord[i],
      row: startRow,
      col: startCol + i
    });
  }
  
  // Add a few random letters
  for (let i = 0; i < Math.floor(Math.random() * 5) + 2; i++) {
    let row, col;
    do {
      row = Math.floor(Math.random() * 15);
      col = Math.floor(Math.random() * 15);
    } while (board.some(tile => tile.row === row && tile.col === col));
    
    const randomLetter = Object.keys(LETTER_VALUES)[Math.floor(Math.random() * Object.keys(LETTER_VALUES).length)];
    board.push({
      letter: randomLetter,
      row,
      col
    });
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
  
  const bestScore = 45 + Math.floor(Math.random() * 25); // 45-70 points
  
  return {
    board: shuffleArray(board),
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
      const puzzleData = generatePuzzle();
      
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