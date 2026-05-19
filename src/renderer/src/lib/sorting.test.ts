import { describe, expect, it } from 'vitest'
import { compareSortableValues, isEmptySortableValue } from './sorting'

describe('sorting', () => {
  it('detects empty sortable values', () => {
    expect(isEmptySortableValue(undefined)).toBe(true)
    expect(isEmptySortableValue(null)).toBe(true)
    expect(isEmptySortableValue('')).toBe(true)
    expect(isEmptySortableValue(0)).toBe(false)
  })

  it('sorts numbers and booleans correctly', () => {
    expect(compareSortableValues(1, 2)).toBeLessThan(0)
    expect(compareSortableValues(true, false)).toBeGreaterThan(0)
  })

  it('pushes empty values to the end', () => {
    expect(compareSortableValues(undefined, 'abc')).toBeGreaterThan(0)
    expect(compareSortableValues('abc', null)).toBeLessThan(0)
  })

  it('sorts strings using locale-aware comparison', () => {
    expect(compareSortableValues('item2', 'item10')).toBeLessThan(0)
  })
})
