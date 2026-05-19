import type { FakeDb, JsonValue } from '../model/fakeDb'

export type SourceFormat = 'fakeDb' | 'plainObject' | 'rootArray'

export type PersistedDatabaseContent = {
  content: string
  formatLabel: string
  fallbackToFakeDb: boolean
}

export function detectSourceFormat(value: unknown): SourceFormat {
  if (Array.isArray(value)) {
    return 'rootArray'
  }

  if (typeof value === 'object' && value !== null) {
    const objectValue = value as Record<string, unknown>

    if (
      typeof objectValue.version === 'string' &&
      typeof objectValue.schemas === 'object' &&
      objectValue.schemas !== null &&
      !Array.isArray(objectValue.schemas)
    ) {
      return 'fakeDb'
    }

    return 'plainObject'
  }

  return 'fakeDb'
}

export function getSourceFormatLabel(sourceFormat: SourceFormat): string {
  if (sourceFormat === 'fakeDb') return 'FakeDB'
  if (sourceFormat === 'plainObject') return 'Plain JSON object'
  if (sourceFormat === 'rootArray') return 'Root JSON array'

  return 'Unknown'
}

export function canPreserveRootArrayFormat(db: FakeDb): boolean {
  const schemaNames = Object.keys(db.schemas)

  return (
    schemaNames.length === 1 &&
    schemaNames[0] === 'main' &&
    Object.keys(db.schemas.main ?? {}).length === 1 &&
    Array.isArray(db.schemas.main?.root)
  )
}

export function canPreservePlainObjectFormat(db: FakeDb): boolean {
  const schemaNames = Object.keys(db.schemas)

  return schemaNames.length === 1 && schemaNames[0] === 'main'
}

export function buildPlainObjectFromMainSchema(db: FakeDb): Record<string, JsonValue> {
  const output: Record<string, JsonValue> = {}
  const mainSchema = db.schemas.main ?? {}

  Object.entries(mainSchema).forEach(([tableName, tableRows]) => {
    if (tableName === '_properties') {
      tableRows.forEach((row) => {
        const key = row.key

        if (typeof key === 'string' && key.length > 0) {
          output[key] = row.value ?? null
        }
      })

      return
    }

    output[tableName] = tableRows
  })

  return output
}

export function buildPersistedDatabaseContent(
  db: FakeDb,
  sourceFormat: SourceFormat
): PersistedDatabaseContent {
  if (sourceFormat === 'rootArray') {
    if (canPreserveRootArrayFormat(db)) {
      return {
        content: JSON.stringify(db.schemas.main.root, null, 2),
        formatLabel: 'Root JSON array',
        fallbackToFakeDb: false
      }
    }

    return {
      content: JSON.stringify(db, null, 2),
      formatLabel: 'FakeDB',
      fallbackToFakeDb: true
    }
  }

  if (sourceFormat === 'plainObject') {
    if (canPreservePlainObjectFormat(db)) {
      return {
        content: JSON.stringify(buildPlainObjectFromMainSchema(db), null, 2),
        formatLabel: 'Plain JSON object',
        fallbackToFakeDb: false
      }
    }

    return {
      content: JSON.stringify(db, null, 2),
      formatLabel: 'FakeDB',
      fallbackToFakeDb: true
    }
  }

  return {
    content: JSON.stringify(db, null, 2),
    formatLabel: 'FakeDB',
    fallbackToFakeDb: false
  }
}
