import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from '@/App'

// Minimal UI smoke: render App and assert some stable UI text exists
// Adjust if needed to a more stable element like aria-labels.

describe('UI smoke test', () => {
  it('renders without crashing and shows a title or navigation', () => {
    render(<App />)
    // Loosely check for common elements to avoid brittleness
    const candidates = [
      /quackle/i,
      /game/i,
      /dashboard/i,
      /dictionary/i,
    ]
    const found = candidates.some((rx) => screen.queryByText(rx))
    expect(found).toBe(true)
  })
})
