import type { JsonValue, TableRow } from '../model/fakeDb'

export function parseCellValue(rawValue: string): JsonValue {
  const value = rawValue.trim()

  if (value === '') return ''
  if (value === 'null') return null
  if (value === 'true') return true
  if (value === 'false') return false

  if (!Number.isNaN(Number(value)) && value !== '') {
    return Number(value)
  }

  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  ) {
    try {
      return JSON.parse(value) as JsonValue
    } catch {
      return rawValue
    }
  }

  return rawValue
}

export function inferColumns(rows: TableRow[]): string[] {
  const columns = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columns.add(key))
  })

  return Array.from(columns)
}

export function inferType(values: Array<JsonValue | undefined>): string {
  const types = new Set(
    values.map((value) => {
      if (value === undefined) return 'undefined'
      if (value === null) return 'null'
      if (Array.isArray(value)) return 'array'
      return typeof value
    })
  )

  return Array.from(types).join(' | ')
}

export function getDefaultValueForColumn(rows: TableRow[], column: string): JsonValue {
  const existingValue = rows.find((row) => row[column] !== undefined)?.[column]

  if (column.toLowerCase() === 'id') {
    const maxId = rows.reduce((max, row) => {
      const id = row[column]
      return typeof id === 'number' && id > max ? id : max
    }, 0)

    return maxId + 1
  }

  if (typeof existingValue === 'number') return 0
  if (typeof existingValue === 'boolean') return false
  if (Array.isArray(existingValue)) return []
  if (existingValue !== null && typeof existingValue === 'object') return {}

  return ''
}

export function createEmptyRow(rows: TableRow[], columns: string[]): TableRow {
  if (columns.length === 0) {
    return {
      id: 1
    }
  }

  return columns.reduce<TableRow>((row, column) => {
    row[column] = getDefaultValueForColumn(rows, column)
    return row
  }, {})
}

export function cloneRow(row: TableRow): TableRow {
  return JSON.parse(JSON.stringify(row)) as TableRow
}

export function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, '_')
}

export function parseColumnNames(value: string): string[] {
  return value
    .split(',')
    .map((column) => normalizeIdentifier(column))
    .filter((column) => column.length > 0)
}

export function getDefaultValueForNewColumn(column: string): JsonValue {
  const normalizedColumn = column.toLowerCase()

  if (normalizedColumn === 'id') return 1

  if (
    normalizedColumn.startsWith('is') ||
    normalizedColumn.startsWith('has') ||
    normalizedColumn === 'active' ||
    normalizedColumn === 'enabled' ||
    normalizedColumn === 'visible'
  ) {
    return false
  }

  if (
    normalizedColumn.endsWith('count') ||
    normalizedColumn.endsWith('number') ||
    normalizedColumn.endsWith('amount') ||
    normalizedColumn.endsWith('total') ||
    normalizedColumn === 'age' ||
    normalizedColumn === 'price'
  ) {
    return 0
  }

  return ''
}

export function createInitialRowFromColumns(columns: string[]): TableRow {
  return columns.reduce<TableRow>((row, column) => {
    row[column] = getDefaultValueForNewColumn(column)
    return row
  }, {})
}

export function isRawTableRow(value: unknown): value is TableRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isRawTable(value: unknown): value is TableRow[] {
  return Array.isArray(value) && value.every(isRawTableRow)
}
