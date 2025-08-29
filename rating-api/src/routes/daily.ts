import { Router } from 'express';
import { db, redis } from '../db';
import { dailyPuzzles, dailyScores } from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { generateDaily } from '../daily/generator';

const router = Router();

const getUTCDateNumber = () => Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''));

router.get('/today', async (_req, res) => {
  try {
    const today = getUTCDateNumber();
    let [puzzle] = await db.select().from(dailyPuzzles).where(eq(dailyPuzzles.yyyymmdd, today));
    if (!puzzle) {
      const generated = generateDaily(today);
      await db.insert(dailyPuzzles).values({
        yyyymmdd: today,
        board: generated.board,
        racks: generated.racks,
        seed: generated.seed,
      }).onConflictDoNothing();
      puzzle = { yyyymmdd: today, board: generated.board, racks: generated.racks } as any;
    }
    res.json({ yyyymmdd: puzzle.yyyymmdd, board: puzzle.board, racks: puzzle.racks });
  } catch (err) {
    console.error('daily today error', err);
    res.status(500).json({ error: 'failed' });
  }
});

const submitSchema = z.object({
  yyyymmdd: z.number().int(),
  userId: z.string(),
  score: z.number().int(),
  turns: z.array(z.object({ turn: z.number().int(), placed: z.number().int() })).optional(),
});

router.post('/submit', async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid body' });
  const today = getUTCDateNumber();
  if (parsed.data.yyyymmdd !== today) {
    return res.status(400).json({ error: 'wrong day' });
  }
  const { yyyymmdd, userId, score } = parsed.data;
  const existing = await db.select().from(dailyScores).where(and(eq(dailyScores.yyyymmdd, yyyymmdd), eq(dailyScores.userId, userId)));
  if (existing[0]) {
    return res.json({ kept: true, score: existing[0].score });
  }
  await db.insert(dailyScores).values({ yyyymmdd, userId, score });
  await redis.del(`daily:lb:${yyyymmdd}`);
  res.json({ kept: false, score });
});

router.get('/leaderboard', async (req, res) => {
  try {
    const day = Number(req.query.yyyymmdd) || getUTCDateNumber();
    const limit = Number(req.query.limit) || 50;
    const cacheKey = `daily:lb:${day}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
    const board = await db
      .select({ user_id: dailyScores.userId, score: dailyScores.score })
      .from(dailyScores)
      .where(eq(dailyScores.yyyymmdd, day))
      .orderBy(desc(dailyScores.score))
      .limit(limit);
    await redis.set(cacheKey, JSON.stringify(board), { EX: 60 });
    res.json(board);
  } catch (err) {
    console.error('daily leaderboard error', err);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
