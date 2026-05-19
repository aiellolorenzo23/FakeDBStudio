import type { JsonValue, TableRow } from '../model/fakeDb'
import { cloneRow } from './tableUtils'

export type QueryOperator = '=' | '!=' | '>' | '<' | '>=' | '<='

export type SelectedFields = '*' | string[]

export type ParsedSelectQuery = {
  schemaName?: string
  tableName: string
  fields: SelectedFields
  where?: {
    field: string
    operator: QueryOperator
    value: JsonValue
  }
}

export function parseQueryValue(rawValue: string): JsonValue {
  const value = rawValue.trim()

  const isSingleQuoted = value.startsWith("'") && value.endsWith("'")
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"')

  if (isSingleQuoted || isDoubleQuoted) {
    return value.slice(1, -1)
  }

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
      return value
    }
  }

  return value
}

export function parseSelectQuery(rawQuery: string): ParsedSelectQuery {
  const normalizedQuery = rawQuery.trim().replace(/\s+/g, ' ')

  const queryMatch = normalizedQuery.match(
    /^select\s+(.+?)\s+from\s+([a-zA-Z0-9_.-]+)(?:\s+where\s+([a-zA-Z0-9_.-]+)\s*(>=|<=|!=|=|>|<)\s*(.+))?$/i
  )

  if (!queryMatch) {
    throw new Error(
      'Unsupported query. Use: SELECT * FROM table oppure SELECT field1,field2 FROM schema.table WHERE field = value'
    )
  }

  const [, rawFields, rawTableRef, rawWhereField, rawOperator, rawWhereValue] = queryMatch

  const tableParts = rawTableRef.split('.')

  if (tableParts.length > 2) {
    throw new Error('Invalid table reference. Use table or schema.table')
  }

  const schemaName = tableParts.length === 2 ? tableParts[0] : undefined
  const tableName = tableParts.length === 2 ? tableParts[1] : tableParts[0]

  const fields =
    rawFields.trim() === '*'
      ? '*'
      : rawFields
          .split(',')
          .map((field) => field.trim())
          .filter((field) => field.length > 0)

  if (fields !== '*' && fields.length === 0) {
    throw new Error('Select at least one field')
  }

  return {
    schemaName,
    tableName,
    fields,
    where:
      rawWhereField && rawOperator && rawWhereValue
        ? {
            field: rawWhereField,
            operator: rawOperator as QueryOperator,
            value: parseQueryValue(rawWhereValue)
          }
        : undefined
  }
}

export function areValuesEqual(left: JsonValue | undefined, right: JsonValue): boolean {
  if (left === undefined) return false

  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return left === right
}

export function compareValues(
  left: JsonValue | undefined,
  operator: QueryOperator,
  right: JsonValue
): boolean {
  if (operator === '=') return areValuesEqual(left, right)
  if (operator === '!=') return !areValuesEqual(left, right)

  if (left === undefined || left === null || right === null) {
    return false
  }

  if (typeof left === 'number' && typeof right === 'number') {
    if (operator === '>') return left > right
    if (operator === '<') return left < right
    if (operator === '>=') return left >= right
    if (operator === '<=') return left <= right
  }

  const leftText = String(left)
  const rightText = String(right)

  if (operator === '>') return leftText > rightText
  if (operator === '<') return leftText < rightText
  if (operator === '>=') return leftText >= rightText
  if (operator === '<=') return leftText <= rightText

  return false
}

export function projectRow(row: TableRow, fields: SelectedFields): TableRow {
  if (fields === '*') {
    return cloneRow(row)
  }

  return fields.reduce<TableRow>((projectedRow, field) => {
    projectedRow[field] = row[field] ?? null
    return projectedRow
  }, {})
}
