import express from 'express';
import cors from 'cors';
import { db, redis } from './db';
import { players, games, puzzlePuzzles, puzzleScores } from './schema';
import { eq, desc, and } from 'drizzle-orm';
import { calculateElo, Mode } from './elo';
import { generatePuzzle } from './puzzle/puzzle';
import { z } from 'zod';
import analysisRouter from './routes/analysis';
import dailyRouter from './routes/daily';

export const app = express();
const port = Number(process.env.PORT) || 4000;
app.use(cors());
app.use(express.json());

// Analysis routes
app.use('/analysis', analysisRouter);
app.use('/daily-challenge', dailyRouter);

const getUTCDateNumber = (date = new Date()) =>
  Number(date.toISOString().slice(0, 10).replace(/-/g, ''));

// Puzzle game endpoints
app.get('/puzzle/new', async (_req, res) => {
  try {
    const puzzle = generatePuzzle();
    const bestScore = puzzle.topMoves[0]?.score ?? 0;
    await db
      .insert(puzzlePuzzles)
      .values({
        id: puzzle.id,
        board: puzzle.board,
        rack: puzzle.rack,
        bestScore,
      })
      .onConflictDoNothing();
    res.json({ puzzleId: puzzle.id, board: puzzle.board, rack: puzzle.rack, bestScore });
  } catch (error) {
    console.error('Error generating puzzle:', error);
    res.status(500).json({ error: 'Failed to generate puzzle' });
  }
});

const scoreSchema = z.object({
  userId: z.string(),
  puzzleId: z.string().uuid(),
  score: z.number().int().min(0),
});

app.post('/puzzle/score', async (req, res) => {
  try {
    const parsed = scoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    const { userId, puzzleId, score } = parsed.data;
    const existing = await db
      .select()
      .from(puzzleScores)
      .where(and(eq(puzzleScores.userId, userId), eq(puzzleScores.puzzleId, puzzleId)));
    if (existing[0]) {
      if (score > existing[0].score) {
        await db.update(puzzleScores).set({ score }).where(eq(puzzleScores.id, existing[0].id));
      }
    } else {
      await db.insert(puzzleScores).values({ userId, puzzleId, score });
    }
    await redis.del('puzzle:leaderboard');
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording score:', error);
    res.status(500).json({ error: 'Failed to record score' });
  }
});

app.get('/puzzle/leaderboard', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const cacheKey = 'puzzle:leaderboard';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    const board = await db
      .select({
        id: puzzleScores.id,
        user_id: puzzleScores.userId,
        puzzle_id: puzzleScores.puzzleId,
        score: puzzleScores.score,
        created_at: puzzleScores.createdAt,
      })
      .from(puzzleScores)
      .orderBy(desc(puzzleScores.score))
      .limit(limit);
    await redis.set(cacheKey, JSON.stringify(board), { EX: 60 });
    res.json(board);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});


app.get('/ping', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/rating', async (_req, res) => {
  const cached = await redis.get('leaderboard')
  if (cached) {
    return res.json(JSON.parse(cached))
  }
  const board = await db.select().from(players).orderBy(desc(players.rating))
  await redis.set('leaderboard', JSON.stringify(board), { EX: 60 })
  res.json(board)
})

app.get('/rating/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  const [player] = await db.select().from(players).where(eq(players.id, id))
  if (!player) return res.status(404).json({ error: 'Player not found' })
  res.json({ id: player.id, rating: player.rating })
})

app.post('/rating/report', async (req, res) => {
  const { player1Id, player2Id, winnerId, mode } = req.body as {
    player1Id: number
    player2Id: number
    winnerId: number
    mode: Mode
  }
  if (!player1Id || !player2Id || !winnerId || !mode) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  if (!['blitz', 'rapid', 'async'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' })
  }
  const [p1] = await db.select().from(players).where(eq(players.id, player1Id))
  const [p2] = await db.select().from(players).where(eq(players.id, player2Id))
  if (!p1 || !p2) return res.status(404).json({ error: 'Player not found' })

  const winner = winnerId === player1Id ? 'A' : winnerId === player2Id ? 'B' : 'draw'
  const { newRatingA, newRatingB } = calculateElo(p1.rating, p2.rating, winner, mode)

  await db.transaction(async (tx) => {
    await tx.update(players).set({ rating: newRatingA }).where(eq(players.id, player1Id))
    await tx.update(players).set({ rating: newRatingB }).where(eq(players.id, player2Id))
    await tx.insert(games).values({ player1Id, player2Id, winnerId })
  })

  await redis.del('leaderboard')
  res.json({ player1Id, rating1: newRatingA, player2Id, rating2: newRatingB })
})

app.get('/players', async (_req, res) => {
  const allPlayers = await db.select().from(players);
  res.json(allPlayers);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`rating-api listening on port ${port}`);
  });
}

export default app;
