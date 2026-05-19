import { describe, expect, it } from 'vitest'
import {
  buildPersistedDatabaseContent,
  detectSourceFormat,
  getSourceFormatLabel
} from './fakeDbFormat'
import type { FakeDb } from '../model/fakeDb'

describe('fakeDbFormat', () => {
  it('detects source formats correctly', () => {
    expect(detectSourceFormat([])).toBe('rootArray')
    expect(detectSourceFormat({ users: [] })).toBe('plainObject')
    expect(detectSourceFormat({ version: '1.0.0', schemas: {} })).toBe('fakeDb')
  })

  it('returns readable labels', () => {
    expect(getSourceFormatLabel('plainObject')).toBe('Plain JSON object')
  })

  it('preserves root array format when structure is compatible', () => {
    const db: FakeDb = {
      version: '1.0.0',
      schemas: {
        main: {
          root: [{ id: 1 }]
        }
      }
    }

    expect(buildPersistedDatabaseContent(db, 'rootArray')).toEqual({
      content: JSON.stringify([{ id: 1 }], null, 2),
      formatLabel: 'Root JSON array',
      fallbackToFakeDb: false
    })
  })

  it('falls back to FakeDB when plain object can no longer be preserved', () => {
    const db: FakeDb = {
      version: '1.0.0',
      schemas: {
        main: {
          users: [{ id: 1 }],
          logs: [{ id: 2 }]
        },
        audit: {
          events: []
        }
      }
    }

    const result = buildPersistedDatabaseContent(db, 'plainObject')

    expect(result.formatLabel).toBe('FakeDB')
    expect(result.fallbackToFakeDb).toBe(true)
    expect(JSON.parse(result.content)).toEqual(db)
  })
})
