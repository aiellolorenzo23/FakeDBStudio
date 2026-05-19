import type { FakeDb, JsonObject, JsonTable, JsonValue, TableRow } from './fakeDb'

function isObject(value: JsonValue | unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTableRow(value: JsonValue | unknown): value is TableRow {
  return isObject(value)
}

function isJsonTable(value: JsonValue | unknown): value is JsonTable {
  return Array.isArray(value) && value.every(isTableRow)
}

function isFakeDb(value: JsonValue | unknown): value is FakeDb {
  if (!isObject(value)) return false
  return isObject(value.schemas)
}

export function normalizeJsonToFakeDb(value: JsonValue | unknown): FakeDb {
  if (isFakeDb(value)) {
    return value
  }

  if (Array.isArray(value)) {
    if (!value.every(isTableRow)) {
      throw new Error('Root array must contain only objects to be treated as a table.')
    }

    return {
      version: '1.0.0',
      schemas: {
        main: {
          root: value
        }
      }
    }
  }

  if (isObject(value)) {
    const tables: Record<string, JsonTable> = {}
    const properties: TableRow[] = []

    Object.entries(value).forEach(([key, entryValue]) => {
      if (isJsonTable(entryValue)) {
        tables[key] = entryValue
        return
      }

      properties.push({
        key,
        value: entryValue as JsonValue
      })
    })

    if (properties.length > 0) {
      tables._properties = properties
    }

    return {
      version: '1.0.0',
      schemas: {
        main: tables
      }
    }
  }

  throw new Error('Unsupported JSON root. Expected object or array.')
}
