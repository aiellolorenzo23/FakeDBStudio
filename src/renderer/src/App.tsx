import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { mockDb } from './mock/mockDb'
import type { FakeDb, JsonValue, TableRow } from './model/fakeDb'
import logoImage from './assets/brand/logo.png'
import { normalizeJsonToFakeDb } from './model/normalizeFakeDb'

type Tab = 'data' | 'structure' | 'raw' | 'query'
type DialogMode =
  | 'schema'
  | 'table'
  | 'renameSchema'
  | 'deleteSchema'
  | 'renameTable'
  | 'deleteTable'
  | 'addColumn'
  | 'renameColumn'
  | 'deleteColumn'
  | null

function stringifyValue(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  if (value === null) return 'null'

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function parseCellValue(rawValue: string): JsonValue {
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

function inferColumns(rows: TableRow[]): string[] {
  const columns = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columns.add(key))
  })

  return Array.from(columns)
}

function inferType(values: Array<JsonValue | undefined>): string {
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

function getDefaultValueForColumn(rows: TableRow[], column: string): JsonValue {
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

function createEmptyRow(rows: TableRow[], columns: string[]): TableRow {
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

function cloneRow(row: TableRow): TableRow {
  return JSON.parse(JSON.stringify(row)) as TableRow
}

function normalizeIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, '_')
}

function parseColumnNames(value: string): string[] {
  return value
    .split(',')
    .map((column) => normalizeIdentifier(column))
    .filter((column) => column.length > 0)
}

function getDefaultValueForNewColumn(column: string): JsonValue {
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

function createInitialRowFromColumns(columns: string[]): TableRow {
  return columns.reduce<TableRow>((row, column) => {
    row[column] = getDefaultValueForNewColumn(column)
    return row
  }, {})
}

function isRawTableRow(value: unknown): value is TableRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRawTable(value: unknown): value is TableRow[] {
  return Array.isArray(value) && value.every(isRawTableRow)
}

type QueryOperator = '=' | '!=' | '>' | '<' | '>=' | '<='

type SelectedFields = '*' | string[]

type ParsedSelectQuery = {
  schemaName?: string
  tableName: string
  fields: SelectedFields
  where?: {
    field: string
    operator: QueryOperator
    value: JsonValue
  }
}

function parseQueryValue(rawValue: string): JsonValue {
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

function parseSelectQuery(rawQuery: string): ParsedSelectQuery {
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

function areValuesEqual(left: JsonValue | undefined, right: JsonValue): boolean {
  if (left === undefined) return false

  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return left === right
}

function compareValues(
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

function projectRow(row: TableRow, fields: SelectedFields): TableRow {
  if (fields === '*') {
    return cloneRow(row)
  }

  return fields.reduce<TableRow>((projectedRow, field) => {
    projectedRow[field] = row[field] ?? null
    return projectedRow
  }, {})
}

function App(): JSX.Element {
  const [db, setDb] = useState<FakeDb>(mockDb)
  const [selectedSchema, setSelectedSchema] = useState('main')
  const [selectedTable, setSelectedTable] = useState('students')
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('data')
  const [query, setQuery] = useState('SELECT * FROM students')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Valid JSON')
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [schemaNameInput, setSchemaNameInput] = useState('')
  const [tableNameInput, setTableNameInput] = useState('')
  const [columnsInput, setColumnsInput] = useState('id,name')
  const [renameInput, setRenameInput] = useState('')
  const [rawJsonText, setRawJsonText] = useState('')
  const [rawJsonError, setRawJsonError] = useState<string | null>(null)
  const [isRawDirty, setIsRawDirty] = useState(false)
  const [columnNameInput, setColumnNameInput] = useState('')
  const [columnDefaultInput, setColumnDefaultInput] = useState('')
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null)
  const [queryResultRows, setQueryResultRows] = useState<TableRow[]>([])
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryHasRun, setQueryHasRun] = useState(false)

  const schemas = Object.keys(db.schemas)

  const tables = useMemo(() => {
    return Object.keys(db.schemas[selectedSchema] ?? {})
  }, [db, selectedSchema])

  const rows = useMemo(() => {
    if (!selectedSchema || !selectedTable) return []
    return db.schemas[selectedSchema]?.[selectedTable] ?? []
  }, [db, selectedSchema, selectedTable])

  const columns = useMemo(() => inferColumns(rows), [rows])
  const queryResultColumns = useMemo(() => inferColumns(queryResultRows), [queryResultRows])

  useEffect(() => {
    setRawJsonText(JSON.stringify(rows, null, 2))
    setRawJsonError(null)
    setIsRawDirty(false)
  }, [selectedSchema, selectedTable, rows])

  function updateCurrentTable(nextRows: TableRow[]): void {
    setDb((currentDb) => ({
      ...currentDb,
      schemas: {
        ...currentDb.schemas,
        [selectedSchema]: {
          ...currentDb.schemas[selectedSchema],
          [selectedTable]: nextRows
        }
      }
    }))

    setHasUnsavedChanges(true)
  }

  function handleSchemaClick(schemaName: string): void {
    const schemaTables = Object.keys(db.schemas[schemaName] ?? {})

    setSelectedSchema(schemaName)
    setSelectedTable(schemaTables[0] ?? '')
    setSelectedRowIndex(null)
  }

  function handleTableClick(tableName: string): void {
    setSelectedTable(tableName)
    setSelectedRowIndex(null)
  }

  function handleCellChange(rowIndex: number, column: string, rawValue: string): void {
    const nextRows = rows.map((row, currentIndex) => {
      if (currentIndex !== rowIndex) return row

      return {
        ...row,
        [column]: parseCellValue(rawValue)
      }
    })

    updateCurrentTable(nextRows)
  }

  function handleAddRow(): void {
    if (!selectedTable) return

    const nextRow = createEmptyRow(rows, columns)
    const nextRows = [...rows, nextRow]

    updateCurrentTable(nextRows)
    setSelectedRowIndex(nextRows.length - 1)
  }

  function handleDeleteRow(): void {
    if (selectedRowIndex === null) return

    const nextRows = rows.filter((_, rowIndex) => rowIndex !== selectedRowIndex)

    updateCurrentTable(nextRows)
    setSelectedRowIndex(null)
  }

  function handleDuplicateRow(): void {
    if (selectedRowIndex === null) return

    const selectedRow = rows[selectedRowIndex]
    if (!selectedRow) return

    const duplicatedRow = cloneRow(selectedRow)

    if ('id' in duplicatedRow) {
      duplicatedRow.id = getDefaultValueForColumn(rows, 'id')
    }

    const nextRows = [
      ...rows.slice(0, selectedRowIndex + 1),
      duplicatedRow,
      ...rows.slice(selectedRowIndex + 1)
    ]

    updateCurrentTable(nextRows)
    setSelectedRowIndex(selectedRowIndex + 1)
  }

  function getDatabaseContent(): string {
    return JSON.stringify(db, null, 2)
  }

  function selectFirstAvailableTable(nextDb: FakeDb): void {
    const nextSchemas = Object.keys(nextDb.schemas)
    const firstSchema = nextSchemas[0] ?? ''
    const firstTables = firstSchema ? Object.keys(nextDb.schemas[firstSchema] ?? {}) : []
    const firstTable = firstTables[0] ?? ''

    setSelectedSchema(firstSchema)
    setSelectedTable(firstTable)
    setSelectedRowIndex(null)
  }

  async function handleOpenDatabase(): Promise<void> {
    try {
      const result = await window.fakeDb.openDatabase()

      if (result.canceled || !result.content) {
        setStatusMessage('Open canceled')
        return
      }

      const parsedJson = JSON.parse(result.content) as unknown
      const nextDb = normalizeJsonToFakeDb(parsedJson)

      setDb(nextDb)
      setFilePath(result.filePath ?? null)
      setHasUnsavedChanges(false)
      selectFirstAvailableTable(nextDb)
      setStatusMessage('Database opened')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleSaveDatabase(successMessage = 'Database saved'): Promise<void> {
    if (!filePath) {
      await handleSaveDatabaseAs(successMessage)
      return
    }

    const result = await window.fakeDb.saveDatabase(filePath, getDatabaseContent())

    if (result.success) {
      setHasUnsavedChanges(false)
      setStatusMessage(successMessage)
      return
    }

    setStatusMessage(result.error ?? 'Save failed')
  }

  async function handleSaveDatabaseAs(successMessage = 'Database saved'): Promise<void> {
    const result = await window.fakeDb.saveDatabaseAs(getDatabaseContent())

    if (result.canceled) {
      setStatusMessage('Save canceled')
      return
    }

    if (result.success && result.filePath) {
      setFilePath(result.filePath)
      setHasUnsavedChanges(false)
      setStatusMessage(successMessage)
      return
    }

    setStatusMessage(result.error ?? 'Save failed')
  }

  async function handleApplyChanges(): Promise<void> {
    await handleSaveDatabase('Changes applied to file')
  }

  function handleNewDatabase(): void {
    const nextDb: FakeDb = {
      version: '1.0.0',
      schemas: {
        main: {}
      }
    }

    setDb(nextDb)
    setFilePath(null)
    setSelectedSchema('main')
    setSelectedTable('')
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage('New database created')
  }

  function openCreateSchemaDialog(): void {
    setSchemaNameInput('new_schema')
    setDialogMode('schema')
  }

  function handleCreateSchema(): void {
    const schemaName = normalizeIdentifier(schemaNameInput)

    if (!schemaName) {
      setStatusMessage('Schema name cannot be empty')
      return
    }

    if (db.schemas[schemaName]) {
      setStatusMessage(`Schema "${schemaName}" already exists`)
      return
    }

    setDb((currentDb) => ({
      ...currentDb,
      schemas: {
        ...currentDb.schemas,
        [schemaName]: {}
      }
    }))

    setSelectedSchema(schemaName)
    setSelectedTable('')
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Schema "${schemaName}" created`)
    setDialogMode(null)
  }

  function openCreateTableDialog(): void {
    if (!selectedSchema) {
      setStatusMessage('Select or create a schema first')
      return
    }

    setTableNameInput('new_table')
    setColumnsInput('id,name')
    setDialogMode('table')
  }

  function handleCreateTable(): void {
    if (!selectedSchema) {
      setStatusMessage('Select or create a schema first')
      return
    }

    const tableName = normalizeIdentifier(tableNameInput)

    if (!tableName) {
      setStatusMessage('Table name cannot be empty')
      return
    }

    if (db.schemas[selectedSchema]?.[tableName]) {
      setStatusMessage(`Table "${tableName}" already exists in schema "${selectedSchema}"`)
      return
    }

    const columnNames = parseColumnNames(columnsInput)
    const initialRows = columnNames.length > 0 ? [createInitialRowFromColumns(columnNames)] : []

    setDb((currentDb) => ({
      ...currentDb,
      schemas: {
        ...currentDb.schemas,
        [selectedSchema]: {
          ...currentDb.schemas[selectedSchema],
          [tableName]: initialRows
        }
      }
    }))

    setSelectedTable(tableName)
    setSelectedRowIndex(initialRows.length > 0 ? 0 : null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Table "${tableName}" created in schema "${selectedSchema}"`)
    setDialogMode(null)
  }

  function openRenameSchemaDialog(): void {
    if (!selectedSchema) {
      setStatusMessage('Select a schema first')
      return
    }

    setRenameInput(selectedSchema)
    setDialogMode('renameSchema')
  }

  function handleRenameSchema(): void {
    if (!selectedSchema) {
      setStatusMessage('Select a schema first')
      return
    }

    const nextSchemaName = normalizeIdentifier(renameInput)

    if (!nextSchemaName) {
      setStatusMessage('Schema name cannot be empty')
      return
    }

    if (nextSchemaName === selectedSchema) {
      setDialogMode(null)
      return
    }

    if (db.schemas[nextSchemaName]) {
      setStatusMessage(`Schema "${nextSchemaName}" already exists`)
      return
    }

    setDb((currentDb) => {
      const nextSchemas = Object.entries(currentDb.schemas).reduce<FakeDb['schemas']>(
        (acc, [schemaName, schema]) => {
          acc[schemaName === selectedSchema ? nextSchemaName : schemaName] = schema
          return acc
        },
        {}
      )

      return {
        ...currentDb,
        schemas: nextSchemas
      }
    })

    setSelectedSchema(nextSchemaName)
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Schema "${selectedSchema}" renamed to "${nextSchemaName}"`)
    setDialogMode(null)
  }

  function openDeleteSchemaDialog(): void {
    if (!selectedSchema) {
      setStatusMessage('Select a schema first')
      return
    }

    setDialogMode('deleteSchema')
  }

  function handleDeleteSchema(): void {
    if (!selectedSchema) {
      setStatusMessage('Select a schema first')
      return
    }

    const schemaToDelete = selectedSchema
    const remainingSchemaNames = Object.keys(db.schemas).filter(
      (schemaName) => schemaName !== schemaToDelete
    )
    const nextSelectedSchema = remainingSchemaNames[0] ?? 'main'
    const nextSelectedTable =
      remainingSchemaNames.length > 0
        ? (Object.keys(db.schemas[nextSelectedSchema] ?? {})[0] ?? '')
        : ''

    setDb((currentDb) => {
      const nextSchemas = { ...currentDb.schemas }

      delete nextSchemas[schemaToDelete]

      if (Object.keys(nextSchemas).length === 0) {
        nextSchemas.main = {}
      }

      return {
        ...currentDb,
        schemas: nextSchemas
      }
    })

    setSelectedSchema(nextSelectedSchema)
    setSelectedTable(nextSelectedTable)
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Schema "${schemaToDelete}" deleted`)
    setDialogMode(null)
  }

  function openRenameTableDialog(): void {
    if (!selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    setRenameInput(selectedTable)
    setDialogMode('renameTable')
  }

  function handleRenameTable(): void {
    if (!selectedSchema || !selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    const nextTableName = normalizeIdentifier(renameInput)

    if (!nextTableName) {
      setStatusMessage('Table name cannot be empty')
      return
    }

    if (nextTableName === selectedTable) {
      setDialogMode(null)
      return
    }

    if (db.schemas[selectedSchema]?.[nextTableName]) {
      setStatusMessage(`Table "${nextTableName}" already exists in schema "${selectedSchema}"`)
      return
    }

    setDb((currentDb) => {
      const currentSchema = currentDb.schemas[selectedSchema] ?? {}

      const nextSchema = Object.entries(currentSchema).reduce<Record<string, TableRow[]>>(
        (acc, [tableName, tableRows]) => {
          acc[tableName === selectedTable ? nextTableName : tableName] = tableRows
          return acc
        },
        {}
      )

      return {
        ...currentDb,
        schemas: {
          ...currentDb.schemas,
          [selectedSchema]: nextSchema
        }
      }
    })

    setSelectedTable(nextTableName)
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Table "${selectedTable}" renamed to "${nextTableName}"`)
    setDialogMode(null)
  }

  function openDeleteTableDialog(): void {
    if (!selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    setDialogMode('deleteTable')
  }

  function handleDeleteTable(): void {
    if (!selectedSchema || !selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    const tableToDelete = selectedTable
    const remainingTableNames = Object.keys(db.schemas[selectedSchema] ?? {}).filter(
      (tableName) => tableName !== tableToDelete
    )
    const nextSelectedTable = remainingTableNames[0] ?? ''

    setDb((currentDb) => {
      const nextSchema = { ...(currentDb.schemas[selectedSchema] ?? {}) }

      delete nextSchema[tableToDelete]

      return {
        ...currentDb,
        schemas: {
          ...currentDb.schemas,
          [selectedSchema]: nextSchema
        }
      }
    })

    setSelectedTable(nextSelectedTable)
    setSelectedRowIndex(null)
    setHasUnsavedChanges(true)
    setStatusMessage(`Table "${tableToDelete}" deleted`)
    setDialogMode(null)
  }

  function openAddColumnDialog(): void {
    if (!selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    setColumnNameInput('new_column')
    setColumnDefaultInput('')
    setSelectedColumnName(null)
    setDialogMode('addColumn')
  }

  function handleAddColumn(): void {
    if (!selectedSchema || !selectedTable) {
      setStatusMessage('Select a table first')
      return
    }

    const columnName = normalizeIdentifier(columnNameInput)

    if (!columnName) {
      setStatusMessage('Column name cannot be empty')
      return
    }

    if (columns.includes(columnName)) {
      setStatusMessage(`Column "${columnName}" already exists`)
      return
    }

    const defaultValue = parseCellValue(columnDefaultInput)

    const nextRows =
      rows.length === 0
        ? [{ [columnName]: defaultValue }]
        : rows.map((row) => ({
            ...row,
            [columnName]: defaultValue
          }))

    updateCurrentTable(nextRows)
    setStatusMessage(`Column "${columnName}" added`)
    setDialogMode(null)
  }

  function openRenameColumnDialog(columnName: string): void {
    setSelectedColumnName(columnName)
    setColumnNameInput(columnName)
    setDialogMode('renameColumn')
  }

  function handleRenameColumn(): void {
    if (!selectedColumnName) {
      setStatusMessage('Select a column first')
      return
    }

    const nextColumnName = normalizeIdentifier(columnNameInput)

    if (!nextColumnName) {
      setStatusMessage('Column name cannot be empty')
      return
    }

    if (nextColumnName === selectedColumnName) {
      setDialogMode(null)
      return
    }

    if (columns.includes(nextColumnName)) {
      setStatusMessage(`Column "${nextColumnName}" already exists`)
      return
    }

    const nextRows = rows.map((row) => {
      const nextRow: TableRow = {}

      Object.entries(row).forEach(([key, value]) => {
        nextRow[key === selectedColumnName ? nextColumnName : key] = value
      })

      return nextRow
    })

    updateCurrentTable(nextRows)
    setStatusMessage(`Column "${selectedColumnName}" renamed to "${nextColumnName}"`)
    setSelectedColumnName(null)
    setDialogMode(null)
  }

  function openDeleteColumnDialog(columnName: string): void {
    setSelectedColumnName(columnName)
    setDialogMode('deleteColumn')
  }

  function handleDeleteColumn(): void {
    if (!selectedColumnName) {
      setStatusMessage('Select a column first')
      return
    }

    const nextRows = rows.map((row) => {
      const nextRow = { ...row }
      delete nextRow[selectedColumnName]
      return nextRow
    })

    updateCurrentTable(nextRows)
    setStatusMessage(`Column "${selectedColumnName}" deleted`)
    setSelectedColumnName(null)
    setDialogMode(null)
  }

  function handleRawJsonChange(value: string): void {
    setRawJsonText(value)
    setRawJsonError(null)
    setIsRawDirty(true)
  }

  function handleFormatRawJson(): void {
    try {
      const parsed = JSON.parse(rawJsonText) as unknown

      setRawJsonText(JSON.stringify(parsed, null, 2))
      setRawJsonError(null)
      setStatusMessage('Raw JSON formatted')
    } catch (error) {
      setRawJsonError(error instanceof Error ? error.message : String(error))
      setStatusMessage('Invalid raw JSON')
    }
  }

  function handleResetRawJson(): void {
    setRawJsonText(JSON.stringify(rows, null, 2))
    setRawJsonError(null)
    setIsRawDirty(false)
    setStatusMessage('Raw JSON reset')
  }

  function handleApplyRawJson(): void {
    try {
      const parsed = JSON.parse(rawJsonText) as unknown

      if (!isRawTable(parsed)) {
        throw new Error('Table Raw JSON must be an array of objects.')
      }

      updateCurrentTable(parsed)
      setRawJsonText(JSON.stringify(parsed, null, 2))
      setRawJsonError(null)
      setIsRawDirty(false)
      setStatusMessage('Raw JSON applied to current table')
    } catch (error) {
      setRawJsonError(error instanceof Error ? error.message : String(error))
      setStatusMessage('Invalid raw JSON')
    }
  }

  function handleExecuteQuery(): void {
    try {
      const parsedQuery = parseSelectQuery(query)
      const schemaToUse = parsedQuery.schemaName ?? selectedSchema
      const tableRows = db.schemas[schemaToUse]?.[parsedQuery.tableName]

      if (!tableRows) {
        throw new Error(`Table "${schemaToUse}.${parsedQuery.tableName}" not found`)
      }

      const filteredRows = parsedQuery.where
        ? tableRows.filter((row) =>
            compareValues(
              row[parsedQuery.where!.field],
              parsedQuery.where!.operator,
              parsedQuery.where!.value
            )
          )
        : tableRows

      const projectedRows = filteredRows.map((row) => projectRow(row, parsedQuery.fields))

      setQueryResultRows(projectedRows)
      setQueryError(null)
      setQueryHasRun(true)
      setStatusMessage(`Query executed: ${projectedRows.length} row(s)`)
    } catch (error) {
      setQueryResultRows([])
      setQueryError(error instanceof Error ? error.message : String(error))
      setQueryHasRun(true)
      setStatusMessage('Query failed')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logoImage} alt="FakeDB Studio" />
        </div>

        <div className="toolbar">
          <button onClick={handleNewDatabase}>New DB</button>

          <button onClick={() => void handleOpenDatabase()}>Open DB</button>

          <button onClick={() => void handleSaveDatabase()} disabled={!hasUnsavedChanges}>
            Save
          </button>

          <button onClick={() => void handleSaveDatabaseAs()}>Save As</button>

          <button className="primary" onClick={openCreateSchemaDialog}>
            New Schema
          </button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-title">CONNECTIONS</div>

          <div className="connection-card">
            <div className="connection-name">Local JSON File</div>
            <div className="connection-path">{filePath ?? 'mock://database.json'}</div>
          </div>

          <div className="sidebar-title">SCHEMAS</div>

          <div className="schema-tree">
            {schemas.map((schemaName) => (
              <div key={schemaName} className="schema-block">
                <button
                  className={selectedSchema === schemaName ? 'schema-name selected' : 'schema-name'}
                  onClick={() => handleSchemaClick(schemaName)}
                >
                  ▾ {schemaName}
                </button>

                {selectedSchema === schemaName && (
                  <div className="table-list">
                    {tables.map((tableName) => (
                      <button
                        key={tableName}
                        className={
                          selectedTable === tableName ? 'table-name selected' : 'table-name'
                        }
                        onClick={() => handleTableClick(tableName)}
                      >
                        <span className="table-icon">▦</span>
                        {tableName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="sidebar-actions">
            <button onClick={openCreateSchemaDialog}>+ Schema</button>

            <button onClick={openCreateTableDialog} disabled={!selectedSchema}>
              + Table
            </button>
          </div>

          <div className="sidebar-actions">
            <button onClick={openRenameSchemaDialog} disabled={!selectedSchema}>
              Rename Schema
            </button>

            <button onClick={openDeleteSchemaDialog} disabled={!selectedSchema}>
              Delete Schema
            </button>
          </div>

          <div className="sidebar-actions">
            <button onClick={openRenameTableDialog} disabled={!selectedTable}>
              Rename Table
            </button>

            <button onClick={openDeleteTableDialog} disabled={!selectedTable}>
              Delete Table
            </button>
          </div>
        </aside>

        <section className="workspace">
          <div className="workspace-header">
            <div>
              <h2>
                {selectedSchema}.{selectedTable || 'no_table_selected'}
              </h2>
              <p>
                {rows.length} rows · {columns.length} columns
                {selectedRowIndex !== null && <> · selected row #{selectedRowIndex + 1}</>}
              </p>
            </div>

            <div className="workspace-actions">
              <button onClick={handleAddRow} disabled={!selectedTable}>
                + Row
              </button>
              <button onClick={handleDuplicateRow} disabled={selectedRowIndex === null}>
                Duplicate
              </button>
              <button onClick={handleDeleteRow} disabled={selectedRowIndex === null}>
                Delete
              </button>
              <button
                className="primary"
                onClick={() => void handleApplyChanges()}
                disabled={!hasUnsavedChanges}
                title="Write current changes to the JSON file"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="tabs">
            <button
              className={activeTab === 'data' ? 'active' : ''}
              onClick={() => setActiveTab('data')}
            >
              Data
            </button>

            <button
              className={activeTab === 'structure' ? 'active' : ''}
              onClick={() => setActiveTab('structure')}
            >
              Structure
            </button>

            <button
              className={activeTab === 'raw' ? 'active' : ''}
              onClick={() => setActiveTab('raw')}
            >
              Raw JSON
            </button>

            <button
              className={activeTab === 'query' ? 'active' : ''}
              onClick={() => setActiveTab('query')}
            >
              Query
            </button>
          </div>

          <div className="panel">
            {activeTab === 'data' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="row-number">#</th>
                      {columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={selectedRowIndex === rowIndex ? 'selected-row' : ''}
                        onClick={() => setSelectedRowIndex(rowIndex)}
                      >
                        <td className="row-number">{rowIndex + 1}</td>

                        {columns.map((column) => (
                          <td key={column}>
                            <input
                              className="cell-input"
                              value={stringifyValue(row[column])}
                              onChange={(event) =>
                                handleCellChange(rowIndex, column, event.target.value)
                              }
                              onFocus={() => setSelectedRowIndex(rowIndex)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 1} className="empty-cell">
                          Empty table. Click “+ Row” to create the first record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'structure' && (
              <div className="structure-panel">
                <div className="structure-actions">
                  <button onClick={openAddColumnDialog} disabled={!selectedTable}>
                    + Column
                  </button>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {columns.map((column) => {
                        const values = rows.map((row) => row[column])
                        const nullable = values.some(
                          (value) => value === null || value === undefined
                        )

                        return (
                          <tr key={column}>
                            <td>{column}</td>
                            <td>{inferType(values)}</td>
                            <td>{nullable ? 'yes' : 'no'}</td>
                            <td>
                              <div className="inline-actions">
                                <button onClick={() => openRenameColumnDialog(column)}>
                                  Rename
                                </button>
                                <button
                                  className="danger-button subtle"
                                  onClick={() => openDeleteColumnDialog(column)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      {columns.length === 0 && (
                        <tr>
                          <td colSpan={4} className="empty-cell">
                            No structure available. Click “+ Column” to create the first column.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="raw-panel">
                <textarea
                  className={rawJsonError ? 'raw-editor raw-editor-error' : 'raw-editor'}
                  value={rawJsonText}
                  onChange={(event) => handleRawJsonChange(event.target.value)}
                  spellCheck={false}
                />

                <div className="raw-actions">
                  <div className="raw-actions-left">
                    {isRawDirty && (
                      <span className="raw-dirty-indicator">Raw JSON not applied</span>
                    )}
                    {rawJsonError && <span className="raw-error">{rawJsonError}</span>}
                  </div>

                  <div className="raw-actions-right">
                    <button onClick={handleResetRawJson} disabled={!isRawDirty}>
                      Reset
                    </button>

                    <button onClick={handleFormatRawJson}>Format</button>

                    <button className="primary" onClick={handleApplyRawJson} disabled={!isRawDirty}>
                      Apply Raw
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'query' && (
              <div className="query-panel">
                <textarea
                  className="query-editor"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setQueryHasRun(false)
                    setQueryResultRows([])
                    setQueryError(null)
                  }}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      handleExecuteQuery()
                    }
                  }}
                />

                <div className="query-actions">
                  <button className="primary" onClick={handleExecuteQuery}>
                    Execute
                  </button>

                  <button
                    onClick={() => {
                      setQuery('')
                      setQueryResultRows([])
                      setQueryError(null)
                      setQueryHasRun(false)
                    }}
                  >
                    Clear
                  </button>

                  <button
                    onClick={() => {
                      setQuery(`SELECT * FROM ${selectedTable || 'table'}`)
                      setQueryResultRows([])
                      setQueryError(null)
                      setQueryHasRun(false)
                    }}
                    disabled={!selectedTable}
                  >
                    Current Table
                  </button>
                </div>

                {queryError && <div className="query-error">{queryError}</div>}

                {!queryError && !queryHasRun && (
                  <div className="query-result-placeholder">
                    Supported examples:
                    <code>SELECT * FROM {selectedTable || 'students'}</code>
                    <code>SELECT id,name FROM {selectedTable || 'students'}</code>
                    <code>SELECT * FROM {selectedTable || 'students'} WHERE active = true</code>
                    <code>
                      SELECT * FROM {selectedSchema}.{selectedTable || 'students'} WHERE id = 1
                    </code>
                    <span className="query-shortcut">Shortcut: Ctrl + Enter</span>
                  </div>
                )}

                {!queryError && queryHasRun && queryResultRows.length === 0 && (
                  <div className="query-empty-result">No rows matched the query.</div>
                )}

                {!queryError && queryResultRows.length > 0 && (
                  <div className="query-result">
                    <div className="query-result-header">
                      Result: {queryResultRows.length} row(s)
                    </div>

                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="row-number">#</th>
                            {queryResultColumns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {queryResultRows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="row-number">{rowIndex + 1}</td>

                              {queryResultColumns.map((column) => (
                                <td key={column}>{stringifyValue(row[column])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {dialogMode !== null && (
        <div className="modal-backdrop" onClick={() => setDialogMode(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            {dialogMode === 'schema' && (
              <>
                <div className="modal-header">
                  <h3>Create Schema</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <label className="field-label" htmlFor="schema-name">
                    Schema name
                  </label>

                  <input
                    id="schema-name"
                    className="modal-input"
                    value={schemaNameInput}
                    autoFocus
                    onChange={(event) => setSchemaNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleCreateSchema()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleCreateSchema}>
                    Create Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'table' && (
              <>
                <div className="modal-header">
                  <h3>Create Table</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-info">
                    Schema: <strong>{selectedSchema}</strong>
                  </div>

                  <label className="field-label" htmlFor="table-name">
                    Table name
                  </label>

                  <input
                    id="table-name"
                    className="modal-input"
                    value={tableNameInput}
                    autoFocus
                    onChange={(event) => setTableNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />

                  <label className="field-label" htmlFor="table-columns">
                    Columns
                  </label>

                  <input
                    id="table-columns"
                    className="modal-input"
                    value={columnsInput}
                    placeholder="id,name,active"
                    onChange={(event) => setColumnsInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleCreateTable()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />

                  <div className="modal-hint">
                    Separate columns with comma, example: <code>id,name,surname,active</code>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleCreateTable}>
                    Create Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameSchema' && (
              <>
                <div className="modal-header">
                  <h3>Rename Schema</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-info">
                    Current schema: <strong>{selectedSchema}</strong>
                  </div>

                  <label className="field-label" htmlFor="rename-schema">
                    New schema name
                  </label>

                  <input
                    id="rename-schema"
                    className="modal-input"
                    value={renameInput}
                    autoFocus
                    onChange={(event) => setRenameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRenameSchema()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleRenameSchema}>
                    Rename Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteSchema' && (
              <>
                <div className="modal-header">
                  <h3>Delete Schema</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="danger-box">
                    You are about to delete schema <strong>{selectedSchema}</strong> and all its
                    tables.
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="danger-button" onClick={handleDeleteSchema}>
                    Delete Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameTable' && (
              <>
                <div className="modal-header">
                  <h3>Rename Table</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-info">
                    Current table:{' '}
                    <strong>
                      {selectedSchema}.{selectedTable}
                    </strong>
                  </div>

                  <label className="field-label" htmlFor="rename-table">
                    New table name
                  </label>

                  <input
                    id="rename-table"
                    className="modal-input"
                    value={renameInput}
                    autoFocus
                    onChange={(event) => setRenameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRenameTable()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleRenameTable}>
                    Rename Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteTable' && (
              <>
                <div className="modal-header">
                  <h3>Delete Table</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="danger-box">
                    You are about to delete table{' '}
                    <strong>
                      {selectedSchema}.{selectedTable}
                    </strong>
                    .
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="danger-button" onClick={handleDeleteTable}>
                    Delete Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'addColumn' && (
              <>
                <div className="modal-header">
                  <h3>Add Column</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-info">
                    Table:{' '}
                    <strong>
                      {selectedSchema}.{selectedTable}
                    </strong>
                  </div>

                  <label className="field-label" htmlFor="column-name">
                    Column name
                  </label>

                  <input
                    id="column-name"
                    className="modal-input"
                    value={columnNameInput}
                    autoFocus
                    onChange={(event) => setColumnNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddColumn()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />

                  <label className="field-label" htmlFor="column-default">
                    Default value
                  </label>

                  <input
                    id="column-default"
                    className="modal-input"
                    value={columnDefaultInput}
                    placeholder='Example: "", 0, true, null'
                    onChange={(event) => setColumnDefaultInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddColumn()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />

                  <div className="modal-hint">
                    Values are parsed like cells: <code>true</code>, <code>false</code>,{' '}
                    <code>null</code>, numbers and JSON objects/arrays are supported.
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleAddColumn}>
                    Add Column
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameColumn' && (
              <>
                <div className="modal-header">
                  <h3>Rename Column</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="modal-info">
                    Current column: <strong>{selectedColumnName}</strong>
                  </div>

                  <label className="field-label" htmlFor="rename-column">
                    New column name
                  </label>

                  <input
                    id="rename-column"
                    className="modal-input"
                    value={columnNameInput}
                    autoFocus
                    onChange={(event) => setColumnNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRenameColumn()
                      if (event.key === 'Escape') setDialogMode(null)
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="primary" onClick={handleRenameColumn}>
                    Rename Column
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteColumn' && (
              <>
                <div className="modal-header">
                  <h3>Delete Column</h3>
                  <button className="icon-button" onClick={() => setDialogMode(null)}>
                    ×
                  </button>
                </div>

                <div className="modal-body">
                  <div className="danger-box">
                    You are about to delete column <strong>{selectedColumnName}</strong> from table{' '}
                    <strong>
                      {selectedSchema}.{selectedTable}
                    </strong>
                    .
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDialogMode(null)}>Cancel</button>
                  <button className="danger-button" onClick={handleDeleteColumn}>
                    Delete Column
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="statusbar">
        <span>Status: {statusMessage}</span>
        <span className={hasUnsavedChanges ? 'dirty-status' : ''}>
          Unsaved changes: {hasUnsavedChanges ? 'yes' : 'no'}
        </span>
        <span>Path: {filePath ?? 'mock://database.json'}</span>
      </footer>
    </div>
  )
}

export default App
