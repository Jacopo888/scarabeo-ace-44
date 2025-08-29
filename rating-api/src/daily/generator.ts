import seedrandom from 'seedrandom';

interface Tile {
  id: string;
  letter: string;
  value: number;
}

const TILE_DISTRIBUTION: Array<{ letter: string; value: number; count: number }> = [
  { letter: 'A', value: 1, count: 9 },
  { letter: 'B', value: 3, count: 2 },
  { letter: 'C', value: 3, count: 2 },
  { letter: 'D', value: 2, count: 4 },
  { letter: 'E', value: 1, count: 12 },
  { letter: 'F', value: 4, count: 2 },
  { letter: 'G', value: 2, count: 3 },
  { letter: 'H', value: 4, count: 2 },
  { letter: 'I', value: 1, count: 9 },
  { letter: 'J', value: 8, count: 1 },
  { letter: 'K', value: 5, count: 1 },
  { letter: 'L', value: 1, count: 4 },
  { letter: 'M', value: 3, count: 2 },
  { letter: 'N', value: 1, count: 6 },
  { letter: 'O', value: 1, count: 8 },
  { letter: 'P', value: 3, count: 2 },
  { letter: 'Q', value: 10, count: 1 },
  { letter: 'R', value: 1, count: 6 },
  { letter: 'S', value: 1, count: 4 },
  { letter: 'T', value: 1, count: 6 },
  { letter: 'U', value: 1, count: 4 },
  { letter: 'V', value: 4, count: 2 },
  { letter: 'W', value: 4, count: 2 },
  { letter: 'X', value: 8, count: 1 },
  { letter: 'Y', value: 4, count: 2 },
  { letter: 'Z', value: 10, count: 1 },
  { letter: '_', value: 0, count: 2 },
];

export function generateDaily(yyyymmdd: number): {
  board: (null | Tile)[][];
  racks: Tile[][];
  seed: string;
} {
  const seed = `daily-${yyyymmdd}`;
  const rng = seedrandom(seed);

  const bag: Tile[] = [];
  let uid = 0;
  TILE_DISTRIBUTION.forEach(({ letter, value, count }) => {
    for (let i = 0; i < count; i++) {
      bag.push({ id: `${letter}${uid++}`, letter, value });
    }
  });

  const drawTile = () => {
    const idx = Math.floor(rng() * bag.length);
    return bag.splice(idx, 1)[0];
  };

  const racks: Tile[][] = [];
  for (let r = 0; r < 5; r++) {
    const rack: Tile[] = [];
    for (let i = 0; i < 7; i++) {
      rack.push(drawTile());
    }
    racks.push(rack);
  }

  const board: (null | Tile)[][] = Array.from({ length: 15 }, () => Array(15).fill(null));

  return { board, racks, seed };
}
