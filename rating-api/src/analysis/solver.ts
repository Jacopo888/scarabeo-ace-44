import words from 'word-list-json';

interface Move {
  row: number;
  col: number;
  dir: 'H' | 'V';
  word: string;
  score: number;
  rackBefore: string;
}

interface BoardState {
  board: string[][];
  rack: string;
}

interface MissedOpportunity {
  turn: number;
  betterWord: string;
  scoreGain: number;
  coords: [number, number];
  dir: 'H' | 'V';
}

interface BingoChance {
  turn: number;
  found: boolean;
  bestBingo?: string;
  score?: number;
}

interface RackAdvice {
  turn: number;
  keep: string;
  note: string;
}

export class ScrabbleSolver {
  private dictionary: Set<string>;
  private tileValues: Record<string, number> = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
    M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
  };

  constructor() {
    // Initialize with common English words
    this.dictionary = new Set(words.map(w => w.toUpperCase()));
  }

  analyzeGame(moves: Move[], boardSize = 15, lexicon = 'NWL') {
    const missed: MissedOpportunity[] = [];
    const bingoChances: BingoChance[] = [];
    const timeline: Array<{ turn: number; my: number; opp: number; cumMy: number; cumOpp: number }> = [];
    const rackAdvice: RackAdvice[] = [];

    let cumMy = 0, cumOpp = 0;
      const currentBoard = this.initializeBoard(boardSize);

    moves.forEach((move, index) => {
      const turn = index + 1;
      const isMyTurn = turn % 2 === 1;

      // Update board with current move
      this.placeWordOnBoard(currentBoard, move);

      // Find better alternatives for this move
      const alternatives = this.findBetterMoves(currentBoard, move);
      if (alternatives.length > 0) {
        const best = alternatives[0];
        if (best.score > move.score) {
          missed.push({
            turn,
            betterWord: best.word,
            scoreGain: best.score - move.score,
            coords: [best.row, best.col],
            dir: best.dir
          });
        }
      }

      // Check for bingo opportunities
      const bingoFound = this.findBingoOpportunities(currentBoard, move.rackBefore);
      bingoChances.push({
        turn,
        found: bingoFound.length > 0,
        bestBingo: bingoFound[0]?.word,
        score: bingoFound[0]?.score
      });

      // Generate rack advice
      const advice = this.generateRackAdvice(move.rackBefore);
      rackAdvice.push({
        turn,
        keep: advice.keep,
        note: advice.note
      });

      // Update timeline
      if (isMyTurn) {
        cumMy += move.score;
      } else {
        cumOpp += move.score;
      }

      timeline.push({
        turn,
        my: isMyTurn ? move.score : 0,
        opp: isMyTurn ? 0 : move.score,
        cumMy,
        cumOpp
      });
    });

    return { missed, bingoChances, timeline, rackAdvice };
  }

  private initializeBoard(size: number): string[][] {
    return Array(size).fill(null).map(() => Array(size).fill(''));
  }

  private placeWordOnBoard(board: string[][], move: Move) {
    const { row, col, dir, word } = move;
    for (let i = 0; i < word.length; i++) {
      if (dir === 'H') {
        board[row][col + i] = word[i];
      } else {
        board[row + i][col] = word[i];
      }
    }
  }

  private findBetterMoves(board: string[][], move: Move): Array<{ word: string; score: number; row: number; col: number; dir: 'H' | 'V' }> {
    const alternatives: Array<{ word: string; score: number; row: number; col: number; dir: 'H' | 'V' }> = [];
    const rack = move.rackBefore;

    // Simple strategy: try common high-scoring words that can be formed with the rack
    const possibleWords = this.generatePossibleWords(rack);
    
    for (const word of possibleWords) {
      // Try to place horizontally and vertically at various positions
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[0].length; col++) {
          // Try horizontal
          if (this.canPlaceWord(board, word, row, col, 'H')) {
            const score = this.calculateScore(word, row, col, 'H', board);
            alternatives.push({ word, score, row, col, dir: 'H' });
          }
          // Try vertical
          if (this.canPlaceWord(board, word, row, col, 'V')) {
            const score = this.calculateScore(word, row, col, 'V', board);
            alternatives.push({ word, score, row, col, dir: 'V' });
          }
        }
      }
    }

    return alternatives.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private generatePossibleWords(rack: string): string[] {
    const rackLetters = rack.split('');
    const possible: string[] = [];

    // Check dictionary words that can be formed with available letters
    for (const word of this.dictionary) {
      if (word.length >= 2 && word.length <= 7 && this.canFormWord(word, rackLetters)) {
        possible.push(word);
      }
    }

    return possible.slice(0, 100); // Limit for performance
  }

  private canFormWord(word: string, availableLetters: string[]): boolean {
    const letterCount: Record<string, number> = {};
    availableLetters.forEach(letter => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });

    for (const letter of word) {
      if (!letterCount[letter] || letterCount[letter] === 0) {
        return false;
      }
      letterCount[letter]--;
    }

    return true;
  }

  private canPlaceWord(board: string[][], word: string, row: number, col: number, dir: 'H' | 'V'): boolean {
    if (dir === 'H') {
      if (col + word.length > board[0].length) return false;
      for (let i = 0; i < word.length; i++) {
        if (board[row][col + i] !== '' && board[row][col + i] !== word[i]) {
          return false;
        }
      }
    } else {
      if (row + word.length > board.length) return false;
      for (let i = 0; i < word.length; i++) {
        if (board[row + i][col] !== '' && board[row + i][col] !== word[i]) {
          return false;
        }
      }
    }
    return true;
  }

  private calculateScore(word: string, row: number, col: number, dir: 'H' | 'V', board: string[][]): number {
    let score = 0;
    for (const letter of word) {
      score += this.tileValues[letter] || 0;
    }
    
    // Simple bonus for longer words
    if (word.length >= 7) score += 50; // Bingo bonus
    if (word.length >= 6) score += 10;
    
    return score;
  }

  private findBingoOpportunities(board: string[][], rack: string): Array<{ word: string; score: number }> {
    const bingos: Array<{ word: string; score: number }> = [];
    const rackLetters = rack.split('');

    // Look for 7+ letter words that can be formed
    for (const word of this.dictionary) {
      if (word.length === 7 && this.canFormWord(word, rackLetters)) {
        const score = this.calculateScore(word, 0, 0, 'H', board);
        bingos.push({ word, score });
      }
    }

    return bingos.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private generateRackAdvice(rack: string): { keep: string; note: string } {
    const vowels = 'AEIOU';
    const goodConsonants = 'NRTLS';
    
    let keep = '';
    let vowelCount = 0;
    let consonantCount = 0;

    for (const letter of rack) {
      if (vowels.includes(letter) && vowelCount < 2) {
        keep += letter;
        vowelCount++;
      } else if (goodConsonants.includes(letter) && consonantCount < 4) {
        keep += letter;
        consonantCount++;
      }
    }

    const note = vowelCount >= 2 && consonantCount >= 3 
      ? "Good balance of vowels and consonants"
      : vowelCount < 2 
        ? "Need more vowels"
        : "Need better consonants";

    return { keep: keep.slice(0, 6), note };
  }
}