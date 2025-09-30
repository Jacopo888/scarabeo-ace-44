// src/lib/coords.ts
const SCHEMA = import.meta.env.VITE_BOARD_SCHEMA ?? "coord_map_1based";
const isOneBased = SCHEMA.endsWith("1based");

export function toServiceCoord(row: number, col: number): string {
  return isOneBased ? `${row + 1},${col + 1}` : `${row},${col}`;
}

export function fromServiceCoord(key: string): { row: number; col: number } {
  const [r, c] = key.split(",").map(Number);
  return isOneBased ? { row: r - 1, col: c - 1 } : { row: r, col: c };
}
