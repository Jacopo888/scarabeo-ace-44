import { db } from '../src/db';
import { dailyPuzzles } from '../src/schema';
import { generatePuzzle } from '../src/puzzle/puzzle';

const getUTCDateNumber = (date: Date) =>
  Number(date.toISOString().slice(0, 10).replace(/-/g, ''));

async function main() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const day = getUTCDateNumber(tomorrow);
  const puzzle = generatePuzzle();
  const bestScore = puzzle.topMoves[0]?.score ?? 0;
  await db
    .insert(dailyPuzzles)
    .values({ yyyymmdd: day, board: puzzle.board, rack: puzzle.rack, bestScore })
    .onConflictDoNothing();
  console.log('Generated daily puzzle for', day);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
