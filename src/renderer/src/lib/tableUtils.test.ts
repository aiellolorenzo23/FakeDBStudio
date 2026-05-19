import { describe, expect, it } from 'vitest'
import {
  createEmptyRow,
  inferColumns,
  inferType,
  normalizeIdentifier,
  parseCellValue,
  parseColumnNames
} from './tableUtils'

describe('tableUtils', () => {
  it('infers columns across rows', () => {
    expect(
      inferColumns([
        { id: 1, name: 'Mario' },
        { id: 2, active: true }
      ])
    ).toEqual(['id', 'name', 'active'])
  })

  it('parses cell values into typed JSON values', () => {
    expect(parseCellValue('true')).toBe(true)
    expect(parseCellValue('42')).toBe(42)
    expect(parseCellValue('null')).toBeNull()
    expect(parseCellValue('{"role":"ADMIN"}')).toEqual({ role: 'ADMIN' })
  })

  it('creates an empty row using inferred defaults', () => {
    expect(
      createEmptyRow([{ id: 3, active: true, name: 'Mario' }], ['id', 'active', 'name'])
    ).toEqual({
      id: 4,
      active: false,
      name: ''
    })
  })

  it('normalizes identifiers and parses comma-separated column names', () => {
    expect(normalizeIdentifier('first name')).toBe('first_name')
    expect(parseColumnNames('id, first name, active')).toEqual(['id', 'first_name', 'active'])
  })

  it('infers mixed value types', () => {
    expect(inferType([1, 'text', null, undefined])).toBe('number | string | null | undefined')
  })
})
