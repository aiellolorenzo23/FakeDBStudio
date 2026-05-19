import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import logoImage from './assets/brand/logo.png'
import ContextMenu from './components/ContextMenu'
import DialogHost from './components/DialogHost'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import WorkspaceHeader from './components/WorkspaceHeader'
import DataPanel from './features/data/DataPanel'
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
import type { ConfirmDialogState, ContextMenuState, DialogMode } from './types/ui'
import { normalizeJsonToFakeDb } from './model/normalizeFakeDb'

type Tab = 'data' | 'structure' | 'raw' | 'query'
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
  const [queryHistory, setQueryHistory] = useState<string[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Valid JSON')
  const [recentFiles, setRecentFiles] = useState<string[]>([])
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

  const resetTableUiState = useCallback((): void => {
    setTableFilter('')
    setTableSort(null)
    setSelectedRowIndex(null)
    setRawJsonText('')
    setRawJsonError(null)
    setIsRawDirty(false)
  }, [])

  const selectFirstAvailableTable = useCallback(
    (nextDb: FakeDb): void => {
      const nextSchemas = Object.keys(nextDb.schemas)
      const firstSchema = nextSchemas[0] ?? ''
      const firstTables = firstSchema ? Object.keys(nextDb.schemas[firstSchema] ?? {}) : []
      const firstTable = firstTables[0] ?? ''

      setSelectedSchema(firstSchema)
      setSelectedTable(firstTable)
      resetTableUiState()
    },
    [resetTableUiState]
  )

  const refreshRecentFiles = useCallback(async (): Promise<void> => {
    try {
      const nextRecentFiles = await window.fakeDb.getRecentFiles()
      setRecentFiles(nextRecentFiles)
    } catch {
      setRecentFiles([])
    }
  }, [])

  const refreshQueryHistory = useCallback(async (): Promise<void> => {
    try {
      const nextQueryHistory = await window.fakeDb.getQueryHistory()
      setQueryHistory(nextQueryHistory)
    } catch {
      setQueryHistory([])
    }
  }, [])

  const applyOpenedDatabase = useCallback(
    (content: string, nextFilePath: string | null): void => {
      const parsedJson = JSON.parse(content) as unknown
      const nextDb = normalizeJsonToFakeDb(parsedJson)
      const nextSourceFormat = detectSourceFormat(parsedJson)

      setDb(nextDb)
      setSourceFormat(nextSourceFormat)
      setFilePath(nextFilePath)
      setHasUnsavedChanges(false)
      selectFirstAvailableTable(nextDb)
      setStatusMessage(`Database opened as ${getSourceFormatLabel(nextSourceFormat)}`)
    },
    [selectFirstAvailableTable]
  )

  const handleOpenRecentDatabase = useCallback(
    async (nextFilePath: string): Promise<void> => {
      try {
        const result = await window.fakeDb.openRecentDatabase(nextFilePath)

        if (result.error) {
          setStatusMessage(result.error)
          await refreshRecentFiles()
          return
        }

        if (!result.content) {
          setStatusMessage('Unable to open recent database')
          await refreshRecentFiles()
          return
        }

        applyOpenedDatabase(result.content, result.filePath ?? nextFilePath)
        await refreshRecentFiles()
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error))
      }
    },
    [applyOpenedDatabase, refreshRecentFiles]
  )

  useEffect(() => {
    const loadInitialSidebarState = async (): Promise<void> => {
      await Promise.allSettled([refreshRecentFiles(), refreshQueryHistory()])
    }

    window.fakeDb
      .getLastOpenedFile()
      .then(async (lastOpenedFile) => {
        if (lastOpenedFile) {
          await handleOpenRecentDatabase(lastOpenedFile)
          await refreshQueryHistory()
          return
        }

        await loadInitialSidebarState()
      })
      .catch(() => {
        void loadInitialSidebarState()
      })
  }, [handleOpenRecentDatabase, refreshQueryHistory, refreshRecentFiles])

  async function handleOpenDatabase(): Promise<void> {
    try {
      const result = await window.fakeDb.openDatabase()

      if (result.canceled || !result.content) {
        setStatusMessage('Open canceled')
        return
      }

      applyOpenedDatabase(result.content, result.filePath ?? null)
      await refreshRecentFiles()
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
      await refreshRecentFiles()

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
      await refreshRecentFiles()

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
      void window.fakeDb
        .pushQueryHistoryEntry(query)
        .then((nextQueryHistory) => {
          setQueryHistory(nextQueryHistory)
        })
        .catch(() => {})
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
          recentFiles={recentFiles}
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
          onOpenRecentFile={(nextFilePath) =>
            requestPendingChangesConfirmation(() => handleOpenRecentDatabase(nextFilePath))
          }
          onRemoveRecentFile={(nextFilePath) => {
            void window.fakeDb
              .removeRecentFile(nextFilePath)
              .then((nextRecentFiles) => {
                setRecentFiles(nextRecentFiles)
              })
              .catch(() => {})
          }}
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
              <DataPanel
                tableFilter={tableFilter}
                selectedTable={selectedTable}
                rowsCount={rows.length}
                filteredRowsCount={filteredRows.length}
                columns={columns}
                activeSortColumn={tableSort?.column ?? null}
                sortedFilteredRows={sortedFilteredRows}
                selectedRowIndex={selectedRowIndex}
                onFilterChange={setTableFilter}
                onClearFilter={() => setTableFilter('')}
                onToggleSort={toggleTableSort}
                getTableSortIndicator={getTableSortIndicator}
                onSelectRow={setSelectedRowIndex}
                onCellChange={handleCellChange}
              />
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
                queryHistory={queryHistory}
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
                onReuseQuery={(value) => {
                  setQuery(value)
                  setQueryResultRows([])
                  setQueryError(null)
                  setQueryHasRun(false)
                }}
                onRemoveQuery={(value) => {
                  void window.fakeDb
                    .removeQueryHistoryEntry(value)
                    .then((nextQueryHistory) => {
                      setQueryHistory(nextQueryHistory)
                    })
                    .catch(() => {})
                }}
              />
            )}
          </div>
        </section>
      </main>

      {contextMenu !== null && (
        <ContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateTable={openCreateTableDialog}
          onRenameSchema={openRenameSchemaDialog}
          onDeleteSchema={openDeleteSchemaDialog}
          onOpenTableData={(schemaName, tableName) => {
            setContextMenu(null)
            requestRawJsonConfirmation(() => {
              setSelectedSchema(schemaName)
              setSelectedTable(tableName)
              setActiveTab('data')
              resetTableUiState()
            })
          }}
          onOpenTableStructure={(schemaName, tableName) => {
            setContextMenu(null)
            requestRawJsonConfirmation(() => {
              setSelectedSchema(schemaName)
              setSelectedTable(tableName)
              setActiveTab('structure')
              resetTableUiState()
            })
          }}
          onRenameTable={openRenameTableDialog}
          onDeleteTable={openDeleteTableDialog}
        />
      )}

      <DialogHost
        confirmDialog={confirmDialog}
        dialogMode={dialogMode}
        selectedSchema={selectedSchema}
        selectedTable={selectedTable}
        selectedColumnName={selectedColumnName}
        schemaNameInput={schemaNameInput}
        tableNameInput={tableNameInput}
        columnsInput={columnsInput}
        renameInput={renameInput}
        columnNameInput={columnNameInput}
        columnDefaultInput={columnDefaultInput}
        onCloseConfirmDialog={() => setConfirmDialog(null)}
        onCloseDialog={() => setDialogMode(null)}
        onSchemaNameInputChange={setSchemaNameInput}
        onTableNameInputChange={setTableNameInput}
        onColumnsInputChange={setColumnsInput}
        onRenameInputChange={setRenameInput}
        onColumnNameInputChange={setColumnNameInput}
        onColumnDefaultInputChange={setColumnDefaultInput}
        onCreateSchema={handleCreateSchema}
        onCreateTable={handleCreateTable}
        onRenameSchema={handleRenameSchema}
        onDeleteSchema={handleDeleteSchema}
        onRenameTable={handleRenameTable}
        onDeleteTable={handleDeleteTable}
        onAddColumn={handleAddColumn}
        onRenameColumn={handleRenameColumn}
        onDeleteColumn={handleDeleteColumn}
      />

      <StatusBar
        statusMessage={statusMessage}
        hasUnsavedChanges={hasUnsavedChanges}
        filePath={filePath}
      />
    </div>
  )
}

export default App
