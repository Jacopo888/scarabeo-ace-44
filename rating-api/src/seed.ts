import { db } from './db';
import { players } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.username, 'admin'));

  if (existing.length === 0) {
    await db.insert(players).values({ username: 'admin', password: 'admin' });
    console.log('Admin player created');
  } else {
    console.log('Admin player already exists');
  }
}

seed()
  .catch((err) => {
    console.error(err);
  })
  .finally(() => process.exit(0));
