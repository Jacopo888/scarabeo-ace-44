import { describe, it, expect } from 'vitest'
import { normalizeNewlines } from './text'

describe('normalizeNewlines', () => {
  it('normalizes CR-only to LF', () => {
    const input = 'HELLO\rWORLD\r'
    expect(normalizeNewlines(input)).toBe('HELLO\nWORLD\n')
  })
  it('removes BOM and normalizes CRLF', () => {
    const input = '\uFEFFHELLO\r\nWORLD\r\n'
    expect(normalizeNewlines(input)).toBe('HELLO\nWORLD\n')
  })
})
