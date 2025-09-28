import { describe, it, expect } from 'vitest'
import { titleForConfirmError } from './toast'

describe('titleForConfirmError', () => {
  it('returns Error for empty', () => {
    expect(titleForConfirmError('empty')).toBe('Error')
  })
  it('returns Invalid move for invalid_move', () => {
    expect(titleForConfirmError('invalid_move')).toBe('Invalid move')
  })
  it('returns Invalid words for others', () => {
    expect(titleForConfirmError('invalid_words')).toBe('Invalid words')
    expect(titleForConfirmError(undefined)).toBe('Invalid words')
  })
})
