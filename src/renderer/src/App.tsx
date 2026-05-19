import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import logoImage from './assets/brand/logo.png'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import WorkspaceHeader from './components/WorkspaceHeader'
import QueryPanel from './features/query/QueryPanel'
import RawJsonPanel from './features/raw/RawJsonPanel'
import StructurePanel from './features/structure/StructurePanel'
import { mockDb } from './mock/mockDb'
import {
  buildPersistedDatabaseContent,
  detectSourceFormat,
  getSourceFormatLabel
} from './lib/fakeDbFormat'
import { compareValues, parseSelectQuery, projectRow } from './lib/queryEngine'
import { stringifyValue } from './lib/jsonUtils'
import { compareSortableValues } from './lib/sorting'
import {
  cloneRow,
  createEmptyRow,
  createInitialRowFromColumns,
  getDefaultValueForColumn,
  inferColumns,
  isRawTable,
  normalizeIdentifier,
  parseCellValue,
  parseColumnNames
} from './lib/tableUtils'
import type { PersistedDatabaseContent, SourceFormat } from './lib/fakeDbFormat'
import type { FakeDb, TableRow } from './model/fakeDb'
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

type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel: string
  confirmKind?: 'primary' | 'danger'
  onConfirm: () => void | Promise<void>
  saveAndContinueLabel?: string
  onSaveAndContinue?: () => void | Promise<void>
} | null

type ContextMenuState =
  | {
      kind: 'schema'
      x: number
      y: number
      schemaName: string
    }
  | {
      kind: 'table'
      x: number
      y: number
      schemaName: string
      tableName: string
    }
  | null

type SortDirection = 'asc' | 'desc'

type TableSortState = {
  column: string
  direction: SortDirection
} | null

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
  const [tableFilter, setTableFilter] = useState('')
  const [tableSort, setTableSort] = useState<TableSortState>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>('fakeDb')

  const schemas = Object.keys(db.schemas)

  const tables = useMemo(() => {
    return Object.keys(db.schemas[selectedSchema] ?? {})
  }, [db, selectedSchema])

  const rows = useMemo(() => {
    if (!selectedSchema || !selectedTable) return []
    return db.schemas[selectedSchema]?.[selectedTable] ?? []
  }, [db, selectedSchema, selectedTable])

  const columns = useMemo(() => inferColumns(rows), [rows])
  const currentRawJsonText = useMemo(() => {
    return JSON.stringify(rows, null, 2)
  }, [rows])

  const displayedRawJsonText = isRawDirty ? rawJsonText : currentRawJsonText
  const queryResultColumns = useMemo(() => inferColumns(queryResultRows), [queryResultRows])
  const filteredRows = useMemo(() => {
    const normalizedFilter = tableFilter.trim().toLowerCase()

    const indexedRows = rows.map((row, originalIndex) => ({
      row,
      originalIndex
    }))

    if (!normalizedFilter) {
      return indexedRows
    }

    return indexedRows.filter(({ row }) =>
      columns.some((column) => stringifyValue(row[column]).toLowerCase().includes(normalizedFilter))
    )
  }, [rows, columns, tableFilter])
  const sortedFilteredRows = useMemo(() => {
    if (!tableSort) {
      return filteredRows
    }

    return [...filteredRows].sort((left, right) => {
      const compareResult = compareSortableValues(
        left.row[tableSort.column],
        right.row[tableSort.column]
      )

      return tableSort.direction === 'asc' ? compareResult : -compareResult
    })
  }, [filteredRows, tableSort])

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
    const selectSchema = (): void => {
      const schemaTables = Object.keys(db.schemas[schemaName] ?? {})

      setSelectedSchema(schemaName)
      setSelectedTable(schemaTables[0] ?? '')
      resetTableUiState()
    }

    requestRawJsonConfirmation(selectSchema)
  }

  function handleTableClick(tableName: string): void {
    const selectTable = (): void => {
      setSelectedTable(tableName)
      resetTableUiState()
    }

    requestRawJsonConfirmation(selectTable)
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

  function getDatabaseContent(): PersistedDatabaseContent {
    return buildPersistedDatabaseContent(db, sourceFormat)
  }

  function selectFirstAvailableTable(nextDb: FakeDb): void {
    const nextSchemas = Object.keys(nextDb.schemas)
    const firstSchema = nextSchemas[0] ?? ''
    const firstTables = firstSchema ? Object.keys(nextDb.schemas[firstSchema] ?? {}) : []
    const firstTable = firstTables[0] ?? ''

    setSelectedSchema(firstSchema)
    setSelectedTable(firstTable)
    resetTableUiState()
  }

  function resetTableUiState(): void {
    setTableFilter('')
    setTableSort(null)
    setSelectedRowIndex(null)
    setRawJsonText('')
    setRawJsonError(null)
    setIsRawDirty(false)
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
      const nextSourceFormat = detectSourceFormat(parsedJson)

      setDb(nextDb)
      setSourceFormat(nextSourceFormat)
      setFilePath(result.filePath ?? null)
      setHasUnsavedChanges(false)
      selectFirstAvailableTable(nextDb)
      setStatusMessage(`Database opened as ${getSourceFormatLabel(nextSourceFormat)}`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleSaveDatabase(successMessage = 'Database saved'): Promise<boolean> {
    if (!filePath) {
      return handleSaveDatabaseAs(successMessage)
    }

    const persistedContent = getDatabaseContent()
    const result = await window.fakeDb.saveDatabase(filePath, persistedContent.content)

    if (result.success) {
      setHasUnsavedChanges(false)

      if (persistedContent.fallbackToFakeDb) {
        setSourceFormat('fakeDb')
        setStatusMessage(
          `${successMessage} as FakeDB format because original format cannot represent current structure`
        )
      } else {
        setStatusMessage(`${successMessage} as ${persistedContent.formatLabel}`)
      }

      return true
    }

    setStatusMessage(result.error ?? 'Save failed')
    return false
  }

  async function handleSaveDatabaseAs(successMessage = 'Database saved'): Promise<boolean> {
    const persistedContent = getDatabaseContent()
    const result = await window.fakeDb.saveDatabaseAs(persistedContent.content)

    if (result.canceled) {
      setStatusMessage('Save canceled')
      return false
    }

    if (result.success && result.filePath) {
      setFilePath(result.filePath)
      setHasUnsavedChanges(false)

      if (persistedContent.fallbackToFakeDb) {
        setSourceFormat('fakeDb')
        setStatusMessage(
          `${successMessage} as FakeDB format because original format cannot represent current structure`
        )
      } else {
        setStatusMessage(`${successMessage} as ${persistedContent.formatLabel}`)
      }

      return true
    }

    setStatusMessage(result.error ?? 'Save failed')
    return false
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
    setSourceFormat('fakeDb')
    setFilePath(null)
    setSelectedSchema('main')
    setSelectedTable('')
    resetTableUiState()
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

  function openCreateTableDialog(schemaName = selectedSchema): void {
    if (!schemaName) {
      setStatusMessage('Select or create a schema first')
      return
    }

    setSelectedSchema(schemaName)
    setTableNameInput('new_table')
    setColumnsInput('id,name')
    setDialogMode('table')
    setContextMenu(null)
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

  function openRenameSchemaDialog(schemaName = selectedSchema): void {
    if (!schemaName) {
      setStatusMessage('Select a schema first')
      return
    }

    setSelectedSchema(schemaName)
    setRenameInput(schemaName)
    setDialogMode('renameSchema')
    setContextMenu(null)
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

  function openDeleteSchemaDialog(schemaName = selectedSchema): void {
    if (!schemaName) {
      setStatusMessage('Select a schema first')
      return
    }

    setSelectedSchema(schemaName)
    setDialogMode('deleteSchema')
    setContextMenu(null)
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

  function openRenameTableDialog(schemaName = selectedSchema, tableName = selectedTable): void {
    if (!schemaName || !tableName) {
      setStatusMessage('Select a table first')
      return
    }

    setSelectedSchema(schemaName)
    setSelectedTable(tableName)
    setRenameInput(tableName)
    setDialogMode('renameTable')
    setContextMenu(null)
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

  function openDeleteTableDialog(schemaName = selectedSchema, tableName = selectedTable): void {
    if (!schemaName || !tableName) {
      setStatusMessage('Select a table first')
      return
    }

    setSelectedSchema(schemaName)
    setSelectedTable(tableName)
    setDialogMode('deleteTable')
    setContextMenu(null)
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
      const parsed = JSON.parse(displayedRawJsonText) as unknown
      const formatted = JSON.stringify(parsed, null, 2)

      setRawJsonText(formatted)
      setRawJsonError(null)
      setIsRawDirty(formatted !== currentRawJsonText)
      setStatusMessage('Raw JSON formatted')
    } catch (error) {
      setRawJsonError(error instanceof Error ? error.message : String(error))
      setStatusMessage('Invalid raw JSON')
    }
  }

  function handleResetRawJson(): void {
    setRawJsonText('')
    setRawJsonError(null)
    setIsRawDirty(false)
    setStatusMessage('Raw JSON reset')
  }

  function applyRawJsonChanges(): boolean {
    try {
      const parsed = JSON.parse(displayedRawJsonText) as unknown

      if (!isRawTable(parsed)) {
        const message = 'Table Raw JSON must be an array of objects.'
        setRawJsonError(message)
        setStatusMessage('Invalid raw JSON')
        return false
      }

      updateCurrentTable(parsed)
      setRawJsonText('')
      setRawJsonError(null)
      setIsRawDirty(false)
      setStatusMessage('Raw JSON applied to current table')
      return true
    } catch (error) {
      setRawJsonError(error instanceof Error ? error.message : String(error))
      setStatusMessage('Invalid raw JSON')
      return false
    }
  }

  function handleApplyRawJson(): void {
    applyRawJsonChanges()
  }

  function handleExecuteQuery(): void {
    try {
      const parsedQuery = parseSelectQuery(query)
      const schemaToUse = parsedQuery.schemaName ?? selectedSchema
      const tableRows = db.schemas[schemaToUse]?.[parsedQuery.tableName]

      if (!tableRows) {
        setQueryResultRows([])
        setQueryError(`Table "${schemaToUse}.${parsedQuery.tableName}" not found`)
        setQueryHasRun(true)
        setStatusMessage('Query failed')
        return
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

  function toggleTableSort(column: string): void {
    setTableSort((currentSort) => {
      if (!currentSort || currentSort.column !== column) {
        return {
          column,
          direction: 'asc'
        }
      }

      if (currentSort.direction === 'asc') {
        return {
          column,
          direction: 'desc'
        }
      }

      return null
    })
  }

  function getTableSortIndicator(column: string): string {
    if (!tableSort || tableSort.column !== column) {
      return '↕'
    }

    return tableSort.direction === 'asc' ? '↑' : '↓'
  }

  function requestRawJsonConfirmation(action: () => void | Promise<void>): void {
    if (!isRawDirty) {
      void action()
      return
    }

    setConfirmDialog({
      title: 'Raw JSON not applied',
      message: 'You have Raw JSON changes that are not applied to the current table yet.',
      confirmLabel: 'Discard Raw Changes',
      confirmKind: 'danger',
      onConfirm: async () => {
        setRawJsonText('')
        setRawJsonError(null)
        setIsRawDirty(false)
        setConfirmDialog(null)
        await action()
      },
      saveAndContinueLabel: 'Apply Raw and continue',
      onSaveAndContinue: async () => {
        if (!applyRawJsonChanges()) {
          return
        }

        setConfirmDialog(null)
        await action()
      }
    })
  }

  function requestUnsavedChangesConfirmation(action: () => void | Promise<void>): void {
    if (!hasUnsavedChanges) {
      void action()
      return
    }

    setConfirmDialog({
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Save them before continuing?',
      confirmLabel: 'Discard changes',
      confirmKind: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null)
        await action()
      },
      saveAndContinueLabel: 'Save and continue',
      onSaveAndContinue: async () => {
        const saved = await handleSaveDatabase('Database saved')

        if (!saved) {
          return
        }

        setConfirmDialog(null)
        await action()
      }
    })
  }

  function requestPendingChangesConfirmation(action: () => void | Promise<void>): void {
    requestRawJsonConfirmation(() => requestUnsavedChangesConfirmation(action))
  }

  function handleTabChange(nextTab: Tab): void {
    if (nextTab === activeTab) {
      return
    }

    const switchTab = (): void => {
      setActiveTab(nextTab)
    }

    if (isRawDirty && activeTab === 'raw' && nextTab !== 'raw') {
      requestRawJsonConfirmation(switchTab)
      return
    }

    switchTab()
  }

  function openSchemaContextMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    schemaName: string
  ): void {
    event.preventDefault()

    setContextMenu({
      kind: 'schema',
      x: event.clientX,
      y: event.clientY,
      schemaName
    })
  }

  function openTableContextMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    schemaName: string,
    tableName: string
  ): void {
    event.preventDefault()

    setContextMenu({
      kind: 'table',
      x: event.clientX,
      y: event.clientY,
      schemaName,
      tableName
    })
  }

  const displayedFilePath = filePath ?? 'mock://database.json'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logoImage} alt="FakeDB Studio" />
        </div>

        <div className="toolbar">
          <button onClick={() => requestPendingChangesConfirmation(handleNewDatabase)}>
            New DB
          </button>

          <button onClick={() => requestPendingChangesConfirmation(handleOpenDatabase)}>
            Open DB
          </button>

          <button
            onClick={() => requestRawJsonConfirmation(() => void handleSaveDatabase())}
            disabled={!hasUnsavedChanges && !isRawDirty}
          >
            Save
          </button>

          <button onClick={() => requestRawJsonConfirmation(() => void handleSaveDatabaseAs())}>
            Save As
          </button>

          <button className="primary" onClick={openCreateSchemaDialog}>
            New Schema
          </button>
        </div>
      </header>

      <main className="main-layout">
        <Sidebar
          displayedFilePath={displayedFilePath}
          sourceFormatLabel={getSourceFormatLabel(sourceFormat)}
          schemas={schemas}
          selectedSchema={selectedSchema}
          selectedTable={selectedTable}
          tables={tables}
          onSchemaClick={handleSchemaClick}
          onTableClick={handleTableClick}
          onSchemaContextMenu={openSchemaContextMenu}
          onTableContextMenu={openTableContextMenu}
          onCreateSchema={openCreateSchemaDialog}
          onCreateTable={() => openCreateTableDialog()}
          onRenameSchema={() => openRenameSchemaDialog()}
          onDeleteSchema={() => openDeleteSchemaDialog()}
          onRenameTable={() => openRenameTableDialog()}
          onDeleteTable={() => openDeleteTableDialog()}
        />

        <section className="workspace">
          <WorkspaceHeader
            selectedSchema={selectedSchema}
            selectedTable={selectedTable}
            rowsCount={rows.length}
            columnsCount={columns.length}
            filteredRowsCount={filteredRows.length}
            hasFilter={tableFilter.trim().length > 0}
            sortSummary={
              tableSort ? `${tableSort.column} ${tableSort.direction.toUpperCase()}` : null
            }
            selectedRowIndex={selectedRowIndex}
            onAddRow={handleAddRow}
            onDuplicateRow={handleDuplicateRow}
            onDeleteRow={handleDeleteRow}
            onApplyChanges={() => requestRawJsonConfirmation(() => void handleApplyChanges())}
            canAddRow={Boolean(selectedTable)}
            canDuplicateRow={selectedRowIndex !== null}
            canDeleteRow={selectedRowIndex !== null}
            canApplyChanges={hasUnsavedChanges || isRawDirty}
          />

          <div className="tabs">
            <button
              className={activeTab === 'data' ? 'active' : ''}
              onClick={() => handleTabChange('data')}
            >
              Data
            </button>

            <button
              className={activeTab === 'structure' ? 'active' : ''}
              onClick={() => handleTabChange('structure')}
            >
              Structure
            </button>

            <button
              className={activeTab === 'raw' ? 'active' : ''}
              onClick={() => handleTabChange('raw')}
            >
              Raw JSON
            </button>

            <button
              className={activeTab === 'query' ? 'active' : ''}
              onClick={() => handleTabChange('query')}
            >
              Query
            </button>
          </div>

          <div className="panel">
            {activeTab === 'data' && (
              <div className="data-panel">
                <div className="data-toolbar">
                  <input
                    className="table-filter-input"
                    value={tableFilter}
                    placeholder="Search rows..."
                    onChange={(event) => setTableFilter(event.target.value)}
                    disabled={!selectedTable || rows.length === 0}
                  />

                  <div className="data-toolbar-info">
                    {tableFilter.trim()
                      ? `${filteredRows.length} of ${rows.length} row(s)`
                      : `${rows.length} row(s)`}
                  </div>

                  {tableFilter.trim() && (
                    <button onClick={() => setTableFilter('')}>Clear Filter</button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="row-number">#</th>
                        {columns.map((column) => (
                          <th key={column}>
                            <button
                              className={
                                tableSort?.column === column
                                  ? 'column-sort-button active'
                                  : 'column-sort-button'
                              }
                              onClick={() => toggleTableSort(column)}
                              title={`Sort by ${column}`}
                            >
                              <span>{column}</span>
                              <span className="column-sort-indicator">
                                {getTableSortIndicator(column)}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {sortedFilteredRows.map(({ row, originalIndex }) => (
                        <tr
                          key={originalIndex}
                          className={selectedRowIndex === originalIndex ? 'selected-row' : ''}
                          onClick={() => setSelectedRowIndex(originalIndex)}
                        >
                          <td className="row-number">{originalIndex + 1}</td>

                          {columns.map((column) => (
                            <td key={column}>
                              <input
                                className="cell-input"
                                value={stringifyValue(row[column])}
                                onChange={(event) =>
                                  handleCellChange(originalIndex, column, event.target.value)
                                }
                                onFocus={() => setSelectedRowIndex(originalIndex)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={columns.length + 1} className="empty-cell">
                            Empty table. Click ?+ Row? to create the first record.
                          </td>
                        </tr>
                      )}

                      {rows.length > 0 && filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={columns.length + 1} className="empty-cell">
                            No rows matched the current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'structure' && (
              <StructurePanel
                columns={columns}
                rows={rows}
                canAddColumn={Boolean(selectedTable)}
                onAddColumn={openAddColumnDialog}
                onRenameColumn={openRenameColumnDialog}
                onDeleteColumn={openDeleteColumnDialog}
              />
            )}

            {activeTab === 'raw' && (
              <RawJsonPanel
                rawJsonError={rawJsonError}
                displayedRawJsonText={displayedRawJsonText}
                isRawDirty={isRawDirty}
                onRawJsonChange={handleRawJsonChange}
                onResetRawJson={handleResetRawJson}
                onFormatRawJson={handleFormatRawJson}
                onApplyRawJson={handleApplyRawJson}
              />
            )}

            {activeTab === 'query' && (
              <QueryPanel
                query={query}
                selectedSchema={selectedSchema}
                selectedTable={selectedTable}
                queryError={queryError}
                queryHasRun={queryHasRun}
                queryResultRows={queryResultRows}
                queryResultColumns={queryResultColumns}
                onQueryChange={(value) => {
                  setQuery(value)
                  setQueryHasRun(false)
                  setQueryResultRows([])
                  setQueryError(null)
                }}
                onExecuteQuery={handleExecuteQuery}
                onClearQuery={() => {
                  setQuery('')
                  setQueryResultRows([])
                  setQueryError(null)
                  setQueryHasRun(false)
                }}
                onUseCurrentTable={() => {
                  setQuery(`SELECT * FROM ${selectedTable || 'table'}`)
                  setQueryResultRows([])
                  setQueryError(null)
                  setQueryHasRun(false)
                }}
              />
            )}
          </div>
        </section>
      </main>

      {contextMenu !== null &&
        (() => {
          const menu = contextMenu

          return (
            <div
              className="context-menu-backdrop"
              onClick={() => setContextMenu(null)}
              onContextMenu={(event) => {
                event.preventDefault()
                setContextMenu(null)
              }}
            >
              <div
                className="context-menu"
                style={{
                  left: menu.x,
                  top: menu.y
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {menu.kind === 'schema' && (
                  <>
                    <div className="context-menu-title">Schema: {menu.schemaName}</div>

                    <button onClick={() => openCreateTableDialog(menu.schemaName)}>
                      + Create Table
                    </button>

                    <button onClick={() => openRenameSchemaDialog(menu.schemaName)}>
                      Rename Schema
                    </button>

                    <button
                      className="danger-menu-item"
                      onClick={() => openDeleteSchemaDialog(menu.schemaName)}
                    >
                      Delete Schema
                    </button>
                  </>
                )}

                {menu.kind === 'table' && (
                  <>
                    <div className="context-menu-title">
                      Table: {menu.schemaName}.{menu.tableName}
                    </div>

                    <button
                      onClick={() => {
                        setContextMenu(null)
                        requestRawJsonConfirmation(() => {
                          setSelectedSchema(menu.schemaName)
                          setSelectedTable(menu.tableName)
                          setActiveTab('data')
                          resetTableUiState()
                        })
                      }}
                    >
                      Open Data
                    </button>

                    <button
                      onClick={() => {
                        setContextMenu(null)
                        requestRawJsonConfirmation(() => {
                          setSelectedSchema(menu.schemaName)
                          setSelectedTable(menu.tableName)
                          setActiveTab('structure')
                          resetTableUiState()
                        })
                      }}
                    >
                      Open Structure
                    </button>

                    <button onClick={() => openRenameTableDialog(menu.schemaName, menu.tableName)}>
                      Rename Table
                    </button>

                    <button
                      className="danger-menu-item"
                      onClick={() => openDeleteTableDialog(menu.schemaName, menu.tableName)}
                    >
                      Delete Table
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })()}

      {confirmDialog !== null && (
        <div className="modal-backdrop" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmDialog.title}</h3>
              <button className="icon-button" onClick={() => setConfirmDialog(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-info">{confirmDialog.message}</div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setConfirmDialog(null)}>Cancel</button>

              {confirmDialog.onSaveAndContinue && (
                <button
                  className="primary"
                  onClick={() => void confirmDialog.onSaveAndContinue?.()}
                >
                  {confirmDialog.saveAndContinueLabel ?? 'Save and continue'}
                </button>
              )}

              <button
                className={confirmDialog.confirmKind === 'danger' ? 'danger-button' : 'primary'}
                onClick={() => void confirmDialog.onConfirm()}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

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

      <StatusBar
        statusMessage={statusMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        filePath={filePath}
      />
    </div>
  )
}

export default App
