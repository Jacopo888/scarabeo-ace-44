import type { Express } from 'express'
import { db, redis } from './db'
import { players, games } from './schema'
import { eq, desc } from 'drizzle-orm'
import { calculateElo, Mode } from './elo'

type PlayerRow = typeof players.$inferSelect
type PublicPlayer = PlayerRow & { externalId?: string | null }

const VALID_MODES: Mode[] = ['blitz', 'rapid', 'async']

function normalizePublicId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return id.length > 0 ? id : null
}

function publicPlayerId(player: PublicPlayer): string {
  return player.externalId || String(player.id)
}

function serializePlayer(player: PublicPlayer) {
  return {
    ...player,
    id: publicPlayerId(player),
  }
}

function isLegacyNumericId(id: string): boolean {
  return /^\d+$/.test(id)
}

async function findPlayer(publicId: string): Promise<PublicPlayer | undefined> {
  if (isLegacyNumericId(publicId)) {
    const [byInternalId] = await db.select().from(players).where(eq(players.id, Number(publicId)))
    if (byInternalId) return byInternalId
  }
  const [byExternalId] = await db.select().from(players).where(eq(players.externalId, publicId))
  return byExternalId
}

async function ensurePlayer(publicId: string): Promise<PublicPlayer> {
  const existing = await findPlayer(publicId)
  if (existing) return existing

  const [created] = await db.insert(players).values({
    externalId: publicId,
    username: publicId,
    password: '',
  }).returning()

  return created
}

export const registerRoutes = (app: Express) => {
  // Health/ping
  app.get('/ping', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Leaderboard
  app.get('/rating', async (_req, res, next) => {
    try {
      const cached = await redis.get('leaderboard')
      if (cached) return res.json(JSON.parse(cached))
      const board = await db.select().from(players).orderBy(desc(players.rating))
      const publicBoard = board.map((player) => serializePlayer(player))
      await redis.set('leaderboard', JSON.stringify(publicBoard), { EX: 60 })
      res.json(publicBoard)
    } catch (e) { next(e) }
  })

  // Player rating
  app.get('/rating/:id', async (req, res, next) => {
    try {
      const id = normalizePublicId(req.params.id)
      if (!id) return res.status(400).json({ error: 'Invalid id' })
      const player = await findPlayer(id)
      if (!player) return res.status(404).json({ error: 'Player not found' })
      res.json({ id: publicPlayerId(player), rating: player.rating })
    } catch (e) { next(e) }
  })

  // Report result and update ratings
  app.post('/rating/report', async (req, res, next) => {
    try {
      const { player1Id, player2Id, winnerId, mode } = req.body as {
        player1Id: unknown
        player2Id: unknown
        winnerId: unknown
        mode: Mode
      }
      const p1PublicId = normalizePublicId(player1Id)
      const p2PublicId = normalizePublicId(player2Id)
      const winnerPublicId = winnerId === null ? null : normalizePublicId(winnerId)
      if (!p1PublicId || !p2PublicId || winnerId === undefined || !mode) return res.status(400).json({ error: 'Missing fields' })
      if (p1PublicId === p2PublicId) return res.status(400).json({ error: 'Players must be different' })
      if (!VALID_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode' })
      if (winnerPublicId && winnerPublicId !== p1PublicId && winnerPublicId !== p2PublicId) {
        return res.status(400).json({ error: 'Invalid winner' })
      }

      const p1 = await ensurePlayer(p1PublicId)
      const p2 = await ensurePlayer(p2PublicId)

      const winner = winnerPublicId === p1PublicId ? 'A' : winnerPublicId === p2PublicId ? 'B' : 'draw'
      const { newRatingA, newRatingB } = calculateElo(p1.rating, p2.rating, winner, mode)
      const internalWinnerId = winner === 'A' ? p1.id : winner === 'B' ? p2.id : null

      await db.transaction(async (tx: any) => {
        await tx.update(players).set({ rating: newRatingA }).where(eq(players.id, p1.id))
        await tx.update(players).set({ rating: newRatingB }).where(eq(players.id, p2.id))
        await tx.insert(games).values({ player1Id: p1.id, player2Id: p2.id, winnerId: internalWinnerId })
      })

      await redis.del('leaderboard')
      res.json({ player1Id: p1PublicId, rating1: newRatingA, player2Id: p2PublicId, rating2: newRatingB, winnerId: winnerPublicId })
    } catch (e) { next(e) }
  })

  // Raw players list
  app.get('/players', async (_req, res, next) => {
    try {
      const allPlayers = await db.select().from(players)
      res.json(allPlayers.map((player) => serializePlayer(player)))
    } catch (e) { next(e) }
  })
}
