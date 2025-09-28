import { describe, it, expect } from 'vitest'
import { classifyNetworkError } from './http'

describe('classifyNetworkError', () => {
  it('detects timeout and aborted', () => {
    expect(classifyNetworkError('Request timeout')).toBe('TIMEOUT_ERROR')
    expect(classifyNetworkError('aborted')).toBe('TIMEOUT_ERROR')
  })
  it('detects CORS/Network errors', () => {
    expect(classifyNetworkError('Failed to fetch')).toBe('CORS_ERROR')
    expect(classifyNetworkError('NetworkError')).toBe('CORS_ERROR')
    expect(classifyNetworkError('TypeError')).toBe('CORS_ERROR')
    expect(classifyNetworkError('CORS policy blocked')).toBe('CORS_ERROR')
  })
  it('falls back to UNKNOWN', () => {
    expect(classifyNetworkError('something else')).toBe('UNKNOWN_ERROR')
  })
})
