import type { Tile } from '@/types/game'

export type ShuffleFn = <T,>(array: T[]) => T[]
export type DrawFn = (bag: Tile[], count: number) => { drawn: Tile[]; remaining: Tile[] }

export type InitialDealDeps = {
  shuffleArray: ShuffleFn
  drawTiles: DrawFn
}

export function createInitialDeal(
  fullDistribution: Tile[],
  deps: InitialDealDeps
): { initialTileBag: Tile[]; player1Rack: Tile[]; player2Rack: Tile[] } {
  const { shuffleArray, drawTiles } = deps
  const shuffledBag = shuffleArray(fullDistribution)
  const p1 = drawTiles(shuffledBag, 7)
  const p2 = drawTiles(p1.remaining, 7)
  return {
    initialTileBag: p2.remaining,
    player1Rack: p1.drawn,
    player2Rack: p2.drawn
  }
}
