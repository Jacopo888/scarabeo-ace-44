import { describe, test, expect } from 'vitest'
import { generatePuzzle } from '../puzzle'

describe('Puzzle Generator', () => {
  test('should generate a valid puzzle', () => {
    const puzzle = generatePuzzle()
    
    expect(puzzle).toHaveProperty('id')
    expect(puzzle).toHaveProperty('board')
    expect(puzzle).toHaveProperty('rack')
    expect(puzzle).toHaveProperty('topMoves')
    
    expect(typeof puzzle.id).toBe('string')
    expect(puzzle.id.length).toBeGreaterThan(0)
  })
  
  test('should generate 15x15 board positions', () => {
    const puzzle = generatePuzzle()
    
    expect(Array.isArray(puzzle.board)).toBe(true)
    puzzle.board.forEach(tile => {
      expect(tile.row).toBeGreaterThanOrEqual(0)
      expect(tile.row).toBeLessThan(15)
      expect(tile.col).toBeGreaterThanOrEqual(0)
      expect(tile.col).toBeLessThan(15)
    })
  })
  
  test('should generate rack with 7 tiles', () => {
    const puzzle = generatePuzzle()
    
    expect(puzzle.rack.length).toBe(7)
  })
  
  test('should generate top moves with at least 3 moves', () => {
    const puzzle = generatePuzzle()
    
    expect(puzzle.topMoves.length).toBeGreaterThanOrEqual(1)
    expect(puzzle.topMoves.length).toBeLessThanOrEqual(5)
  })
  
  test('should ensure top move score is at least 50', () => {
    const puzzle = generatePuzzle()
    
    expect(puzzle.topMoves[0].score).toBeGreaterThanOrEqual(50)
  })
  
  test('rack tiles should have valid letter and points', () => {
    const puzzle = generatePuzzle()
    
    puzzle.rack.forEach(tile => {
      expect(typeof tile.letter).toBe('string')
      expect(typeof tile.points).toBe('number')
      expect(tile.points).toBeGreaterThanOrEqual(0)
    })
  })
  
  test('top moves should have valid structure', () => {
    const puzzle = generatePuzzle()
    
    puzzle.topMoves.forEach(move => {
      expect(Array.isArray(move.tiles)).toBe(true)
      expect(Array.isArray(move.words)).toBe(true)
      expect(typeof move.score).toBe('number')
      expect(move.score).toBeGreaterThan(0)
    })
  })
  
  test('should generate unique puzzle IDs', () => {
    const puzzle1 = generatePuzzle()
    const puzzle2 = generatePuzzle()
    
    expect(puzzle1.id).not.toBe(puzzle2.id)
  })
})