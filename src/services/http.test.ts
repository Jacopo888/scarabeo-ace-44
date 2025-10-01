import { describe, it, expect } from 'vitest'
import { classifyNetworkError } from './http'

describe('classifyNetworkError', () => {
  it('classifies timeout and aborted as TIMEOUT_ERROR', () => {
    expect(classifyNetworkError('Request timeout exceeded')).toBe('TIMEOUT_ERROR')
    expect(classifyNetworkError('The operation was aborted')).toBe('TIMEOUT_ERROR')
    expect(classifyNetworkError('aborted')).toBe('TIMEOUT_ERROR')
    expect(classifyNetworkError('timeout')).toBe('TIMEOUT_ERROR')
  })

  it('classifies browser CORS-like errors as CORS_ERROR', () => {
    expect(classifyNetworkError('Failed to fetch')).toBe('CORS_ERROR')
    expect(classifyNetworkError('NetworkError when attempting to fetch resource.')).toBe('CORS_ERROR')
    expect(classifyNetworkError('CORS header “Access-Control-Allow-Origin” missing')).toBe('CORS_ERROR')
    expect(classifyNetworkError('CORS policy blocked')).toBe('CORS_ERROR')
  })

  it('keeps generic TypeError as UNKNOWN_ERROR to avoid misclassification', () => {
    expect(classifyNetworkError('TypeError: something unexpected')).toBe('UNKNOWN_ERROR')
    expect(classifyNetworkError('TypeError')).toBe('UNKNOWN_ERROR')
  })

  it('falls back to UNKNOWN for unrelated messages', () => {
    expect(classifyNetworkError('something else')).toBe('UNKNOWN_ERROR')
  })
})
