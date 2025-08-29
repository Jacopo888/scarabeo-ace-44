import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../index';

describe('POST /analysis', () => {
  it('should analyze a game and return expected structure', async () => {
    const mockMoves = [
      {
        row: 7,
        col: 7,
        dir: 'H' as const,
        word: 'HELLO',
        score: 8,
        rackBefore: 'HELLOWR'
      },
      {
        row: 8,
        col: 7,
        dir: 'V' as const,
        word: 'HI',
        score: 5,
        rackBefore: 'HITEMPR'
      },
      {
        row: 7,
        col: 12,
        dir: 'V' as const,
        word: 'WORLD',
        score: 9,
        rackBefore: 'WORLDXY'
      }
    ];

    const response = await request(app)
      .post('/analysis')
      .send({
        moves: mockMoves,
        boardSize: 15,
        lexicon: 'NWL'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('missed');
    expect(response.body).toHaveProperty('bingoChances');
    expect(response.body).toHaveProperty('timeline');
    expect(response.body).toHaveProperty('rackAdvice');

    expect(Array.isArray(response.body.missed)).toBe(true);
    expect(Array.isArray(response.body.bingoChances)).toBe(true);
    expect(Array.isArray(response.body.timeline)).toBe(true);
    expect(Array.isArray(response.body.rackAdvice)).toBe(true);

    // Check timeline structure
    expect(response.body.timeline).toHaveLength(3);
    response.body.timeline.forEach((entry: Record<string, unknown>, index: number) => {
      expect(entry).toHaveProperty('turn', index + 1);
      expect(entry).toHaveProperty('my');
      expect(entry).toHaveProperty('opp');
      expect(entry).toHaveProperty('cumMy');
      expect(entry).toHaveProperty('cumOpp');
    });
  });

  it('should return 400 for invalid request body', async () => {
    const response = await request(app)
      .post('/analysis')
      .send({
        moves: [],
        boardSize: 16, // Invalid board size
        lexicon: 'INVALID'
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});