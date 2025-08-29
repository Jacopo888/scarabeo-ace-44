import { Router } from 'express';
import { z } from 'zod';
import { ScrabbleSolver } from '../analysis/solver';

const router = Router();
const solver = new ScrabbleSolver();

const moveSchema = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
  dir: z.enum(['H', 'V']),
  word: z.string().min(1).max(15),
  score: z.number().int().min(0),
  rackBefore: z.string().min(1).max(7)
});

const analysisRequestSchema = z.object({
  moves: z.array(moveSchema).min(1).max(50),
  boardSize: z.number().int().min(15).max(15).default(15),
  lexicon: z.enum(['NWL', 'CSW', 'ITA']).default('NWL')
});

router.post('/', async (req, res) => {
  try {
    const parsed = analysisRequestSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: parsed.error.issues
      });
    }

    const { moves, boardSize, lexicon } = parsed.data;

    // Perform game analysis
    const analysis = solver.analyzeGame(moves, boardSize, lexicon);

    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing game:', error);
    res.status(500).json({ error: 'Failed to analyze game' });
  }
});

export default router;