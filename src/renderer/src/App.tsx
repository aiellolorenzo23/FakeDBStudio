import { JSX, useMemo, useState } from 'react'
import { mockDb } from './mock/mockDb'
import type { JsonValue, TableRow } from './model/fakeDb'
import logoImage from './assets/brand/logo.png'

type Tab = 'data' | 'structure' | 'raw' | 'query'

function stringifyValue(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  if (value === null) return 'null'

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
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

function App(): JSX.Element {
  const [db] = useState(mockDb)
  const [selectedSchema, setSelectedSchema] = useState('main')
  const [selectedTable, setSelectedTable] = useState('students')
  const [activeTab, setActiveTab] = useState<Tab>('data')
  const [query, setQuery] = useState('SELECT * FROM students')

  const schemas = Object.keys(db.schemas)

  const tables = useMemo(() => {
    return Object.keys(db.schemas[selectedSchema] ?? {})
  }, [db, selectedSchema])

  const rows = useMemo(() => {
    if (!selectedSchema || !selectedTable) return []
    return db.schemas[selectedSchema]?.[selectedTable] ?? []
  }, [db, selectedSchema, selectedTable])

  const columns = useMemo(() => inferColumns(rows), [rows])

  function handleSchemaClick(schemaName: string): void {
    const schemaTables = Object.keys(db.schemas[schemaName] ?? {})

    setSelectedSchema(schemaName)
    setSelectedTable(schemaTables[0] ?? '')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src={logoImage} alt="FakeDB Studio" />
        </div>

        <div className="toolbar">
          <button>New DB</button>
          <button>Open DB</button>
          <button>Save</button>
          <button>Save As</button>
          <button className="primary">New Schema</button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="sidebar-title">CONNECTIONS</div>

          <div className="connection-card">
            <div className="connection-name">Local JSON File</div>
            <div className="connection-path">mock://database.json</div>
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
              </p>
            </div>

            <div className="workspace-actions">
              <button>+ Row</button>
              <button>Duplicate</button>
              <button>Delete</button>
              <button className="primary">Apply</button>
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
                      <tr key={rowIndex}>
                        <td className="row-number">{rowIndex + 1}</td>

                        {columns.map((column) => (
                          <td key={column}>{stringifyValue(row[column])}</td>
                        ))}
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 1} className="empty-cell">
                          Empty table
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
        <span>Status: Valid JSON</span>
        <span>Unsaved changes: no</span>
        <span>Path: mock://database.json</span>
      </footer>
    </div>
  )
}

export default App
