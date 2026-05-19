import { JSX, useEffect, useMemo, useState } from 'react'
import { mockDb } from './mock/mockDb'
import type { FakeDb, JsonValue, TableRow } from './model/fakeDb'
import logoImage from './assets/brand/logo.png'
import { normalizeJsonToFakeDb } from './model/normalizeFakeDb'

type Tab = 'data' | 'structure' | 'raw' | 'query'

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

  const schemas = Object.keys(db.schemas)

  const tables = useMemo(() => {
    return Object.keys(db.schemas[selectedSchema] ?? {})
  }, [db, selectedSchema])

  const rows = useMemo(() => {
    if (!selectedSchema || !selectedTable) return []
    return db.schemas[selectedSchema]?.[selectedTable] ?? []
  }, [db, selectedSchema, selectedTable])

  const columns = useMemo(() => inferColumns(rows), [rows])

  useEffect(() => {
    setSelectedRowIndex(null)
  }, [selectedSchema, selectedTable])

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

          <button className="primary">New Schema</button>
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
                        onClick={() => setSelectedTable(tableName)}
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
            <button>+ Schema</button>
            <button>+ Table</button>
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
              <button onClick={handleAddRow}>+ Row</button>
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
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Nullable</th>
                    </tr>
                  </thead>

                  <tbody>
                    {columns.map((column) => {
                      const values = rows.map((row) => row[column])
                      const nullable = values.some((value) => value === null || value === undefined)

                      return (
                        <tr key={column}>
                          <td>{column}</td>
                          <td>{inferType(values)}</td>
                          <td>{nullable ? 'yes' : 'no'}</td>
                        </tr>
                      )
                    })}

                    {columns.length === 0 && (
                      <tr>
                        <td colSpan={3} className="empty-cell">
                          No structure available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'raw' && (
              <textarea className="raw-editor" value={JSON.stringify(rows, null, 2)} readOnly />
            )}

            {activeTab === 'query' && (
              <div className="query-panel">
                <textarea
                  className="query-editor"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />

                <div className="query-actions">
                  <button className="primary">Execute</button>
                  <button onClick={() => setQuery('')}>Clear</button>
                </div>

                <div className="query-result-placeholder">
                  Query engine non ancora collegato.
                  <code>SELECT * FROM {selectedTable || 'table'}</code>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

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
