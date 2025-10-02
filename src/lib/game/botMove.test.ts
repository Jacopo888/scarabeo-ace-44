import { describe, it, expect } from 'vitest'
import { applyBotMove } from './botMove'

describe('applyBotMove', () => {
  it('does not overwrite existing tiles on the board', () => {
    const prev: any = {
      board: new Map<string, any>([['7,7', { row:7, col:7, letter:'A', points:1 }]]),
      players: [
        { id:'p1', name:'Bot', score:0, rack:[{ letter:'B', points:3 }], isBot:true },
        { id:'p2', name:'Human', score:0, rack:[], isBot:false }
      ],
      currentPlayerIndex: 0,
      tileBag: [],
      gameStatus: 'playing',
      passCounts: [0,0]
    }
    const payload = {
      sanitizedTiles: [
        { row:7, col:7, letter:'B', points:3, isBlank:false },
        { row:7, col:8, letter:'I', points:1, isBlank:false }
      ],
      score: 4,
      words: ['BI']
    }
    const { next } = applyBotMove(prev, payload)
    // original A must remain at 7,7; B is skipped, I placed at 7,8
    expect(next.board.get('7,7')!.letter).toBe('A')
    expect(next.board.get('7,8')!.letter).toBe('I')
  })
})
