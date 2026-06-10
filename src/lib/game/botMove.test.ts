import { describe, it, expect } from 'vitest'
import { applyBotMove } from './botMove'
import { createEmptyBoard } from '@/core/board'

describe('applyBotMove', () => {
  it('does not overwrite existing tiles on the board', () => {
    const bm = createEmptyBoard()
    bm[7][7] = { row:7, col:7, letter:'A', points:1 }
    const prev: any = {
      boardMatrix: bm,
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
  // board legacy Map non più usato; verifichiamo solo boardMatrix
  expect(next.boardMatrix[7][7]!.letter).toBe('A')
  expect(next.boardMatrix[7][8]!.letter).toBe('I')
    // boardMatrix shadow-write
    expect(next.boardMatrix).toBeTruthy()
  expect(next.boardMatrix[7][7]?.letter).toBe('A')
  expect(next.boardMatrix[7][8]?.letter).toBe('I')
    expect(next.players[0].rack).toEqual([{ letter:'B', points:3 }])
    expect(next.lastMove).toEqual([{ row:7, col:8, letter:'I', points:1, isBlank:false }])
  })
})
