// src/lib/coords.ts
// Coordinate: 0-based, origin top-left; center = (size//2, size//2).
// Single model end-to-end; no conversions.

export function toServiceCoord(row: number, col: number): string {
  return `${row},${col}`;
}

export function fromServiceCoord(key: string): { row: number; col: number } {
  const [r, c] = key.split(",").map(Number);
  return { row: r, col: c };
}
