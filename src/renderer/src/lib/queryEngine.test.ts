import { describe, expect, it } from 'vitest'
import { compareValues, parseSelectQuery, projectRow } from './queryEngine'

describe('queryEngine', () => {
  it('parses a basic select query', () => {
    expect(parseSelectQuery('SELECT * FROM students')).toEqual({
      tableName: 'students',
      fields: '*',
      schemaName: undefined,
      where: undefined
    })
  })

  it('parses schema-qualified queries with where clause', () => {
    expect(parseSelectQuery('SELECT id, name FROM main.students WHERE active = true')).toEqual({
      schemaName: 'main',
      tableName: 'students',
      fields: ['id', 'name'],
      where: {
        field: 'active',
        operator: '=',
        value: true
      }
    })
  })

  it('rejects unsupported queries', () => {
    expect(() => parseSelectQuery('DELETE FROM students')).toThrow(/Unsupported query/)
  })

  it('compares numeric and boolean values correctly', () => {
    expect(compareValues(18, '>=', 18)).toBe(true)
    expect(compareValues(true, '=', true)).toBe(true)
    expect(compareValues(false, '!=', true)).toBe(true)
  })

  it('projects selected fields and fills missing values with null', () => {
    expect(projectRow({ id: 1, name: 'Mario' }, ['name', 'surname'])).toEqual({
      name: 'Mario',
      surname: null
    })
  })
})
