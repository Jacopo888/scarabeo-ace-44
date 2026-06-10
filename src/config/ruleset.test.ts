import { describe, expect, it } from 'vitest'
import { ENGLISH_TILE_COUNTS, PRODUCT_NAME, RULESET } from './ruleset'
import { TILE_DISTRIBUTION } from '@/types/game'

function distributionCounts() {
  return TILE_DISTRIBUTION.reduce<Record<string, number>>((acc, tile) => {
    const key = tile.isBlank ? '?' : tile.letter
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

describe('Tilesword ruleset', () => {
  it('documents the current product as English ENABLE, not Italian Scarabeo', () => {
    expect(PRODUCT_NAME).toBe('Tilesword')
    expect(RULESET.id).toBe('english-enable')
    expect(RULESET.dictionaryLanguage).toBe('English')
    expect(RULESET.wordListName).toBe('ENABLE')
    expect(RULESET.quackleLexicon).toBe('enable1.15')
  })

  it('matches the tile bag used by the game runtime', () => {
    expect(TILE_DISTRIBUTION).toHaveLength(RULESET.tileCount)
    expect(distributionCounts()).toEqual(ENGLISH_TILE_COUNTS)
  })
})
