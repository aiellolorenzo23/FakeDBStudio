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

function resolveDatabaseName(
  value: JsonValue | unknown,
  fallbackDatabaseName = 'database'
): string {
  if (
    isObject(value) &&
    typeof value.database === 'string' &&
    value.database.trim().length > 0
  ) {
    return value.database.trim()
  }

  return fallbackDatabaseName
}

export function normalizeJsonToFakeDb(
  value: JsonValue | unknown,
  fallbackDatabaseName = 'database'
): FakeDb {
  if (isFakeDb(value)) {
    return {
      version: typeof value.version === 'string' ? value.version : '1.0.0',
      database: resolveDatabaseName(value, fallbackDatabaseName),
      schemas: value.schemas as FakeDb['schemas']
    }
  }

  if (Array.isArray(value)) {
    if (!value.every(isTableRow)) {
      throw new Error('Root array must contain only objects to be treated as a table.')
    }

    return {
      version: '1.0.0',
      database: fallbackDatabaseName,
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
      database: fallbackDatabaseName,
      schemas: {
        main: tables
      }
    }
  }

  throw new Error('Unsupported JSON root. Expected object or array.')
}
