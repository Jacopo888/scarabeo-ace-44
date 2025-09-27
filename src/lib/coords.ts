// Coordinate helpers for 15x15 board.
// Algebraic (e.g., A1..O15) <-> 0-based [row,col] and 1-based "r,c" string.

export type ZeroCoord = [number, number];

const A_CHAR_CODE = 'A'.charCodeAt(0);

export function algebraicToZeroCoord(alg: string): ZeroCoord {
  // Accept forms like A1..O15 (letters A-O, numbers 1-15)
  if (!/^[A-O](?:[1-9]|1[0-5])$/.test(alg)) throw new Error('invalid_alg');
  const row = alg.charCodeAt(0) - A_CHAR_CODE;
  const col = parseInt(alg.slice(1), 10) - 1;
  if (row < 0 || row > 14 || col < 0 || col > 14) throw new Error('out_of_bounds');
  return [row, col];
}

export function zeroToAlgebraic([row, col]: ZeroCoord): string {
  if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('invalid_coord');
  if (row < 0 || row > 14 || col < 0 || col > 14) throw new Error('out_of_bounds');
  const letter = String.fromCharCode(A_CHAR_CODE + row);
  const num = col + 1;
  return `${letter}${num}`;
}

export function zeroToOneString([row, col]: ZeroCoord): string {
  if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('invalid_coord');
  return `${row + 1},${col + 1}`;
}

export function oneStringToZero(s: string): ZeroCoord {
  const m = s.match(/^(\d+),(\d+)$/);
  if (!m) throw new Error('invalid_one_string');
  const r = parseInt(m[1], 10) - 1;
  const c = parseInt(m[2], 10) - 1;
  if (r < 0 || r > 14 || c < 0 || c > 14) throw new Error('out_of_bounds');
  return [r, c];
}
