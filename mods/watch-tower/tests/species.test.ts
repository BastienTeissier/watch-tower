import { describe, expect, test } from 'claude-code/testing'

import { shiftSpecies } from '../hooks/species'

describe('shiftSpecies', () => {
  test('steps through the list and wraps at both ends; an unknown name counts as snail', () => {
    expect(shiftSpecies('snail', 1)).toBe('duck')
    expect(shiftSpecies('duck', -1)).toBe('snail')
    expect(shiftSpecies('snail', -1)).toBe('chonk')
    expect(shiftSpecies('chonk', 1)).toBe('snail')
    expect(shiftSpecies('nope', 1)).toBe('duck')
  })
})
