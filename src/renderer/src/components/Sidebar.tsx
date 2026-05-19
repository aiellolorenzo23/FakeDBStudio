type SidebarProps = {
  displayedFilePath: string
  sourceFormatLabel: string
  schemas: string[]
  selectedSchema: string
  selectedTable: string
  tables: string[]
  onSchemaClick: (schemaName: string) => void
  onTableClick: (tableName: string) => void
  onSchemaContextMenu: (event: React.MouseEvent<HTMLButtonElement>, schemaName: string) => void
  onTableContextMenu: (
    event: React.MouseEvent<HTMLButtonElement>,
    schemaName: string,
    tableName: string
  ) => void
  onCreateSchema: () => void
  onCreateTable: () => void
  onRenameSchema: () => void
  onDeleteSchema: () => void
  onRenameTable: () => void
  onDeleteTable: () => void
}

function Sidebar({
  displayedFilePath,
  sourceFormatLabel,
  schemas,
  selectedSchema,
  selectedTable,
  tables,
  onSchemaClick,
  onTableClick,
  onSchemaContextMenu,
  onTableContextMenu,
  onCreateSchema,
  onCreateTable,
  onRenameSchema,
  onDeleteSchema,
  onRenameTable,
  onDeleteTable
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">CONNECTIONS</div>

      <div className="connection-card">
        <div className="connection-name">Local JSON File</div>
        <div className="connection-path" title={displayedFilePath}>
          {displayedFilePath}
        </div>
        <div className="connection-format">Format: {sourceFormatLabel}</div>
      </div>

      <div className="sidebar-title">SCHEMAS</div>

      <div className="schema-tree">
        {schemas.map((schemaName) => (
          <div key={schemaName} className="schema-block">
            <button
              className={selectedSchema === schemaName ? 'schema-name selected' : 'schema-name'}
              onClick={() => onSchemaClick(schemaName)}
              onContextMenu={(event) => onSchemaContextMenu(event, schemaName)}
            >
              ▾ {schemaName}
            </button>

            {selectedSchema === schemaName && (
              <div className="table-list">
                {tables.map((tableName) => (
                  <button
                    key={tableName}
                    className={selectedTable === tableName ? 'table-name selected' : 'table-name'}
                    onClick={() => onTableClick(tableName)}
                    onContextMenu={(event) => onTableContextMenu(event, schemaName, tableName)}
                  >
                    <span className="table-icon">▪</span>
                    {tableName}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-action-groups">
        <div className="sidebar-action-group">
          <div className="sidebar-action-title">Create</div>

          <div className="sidebar-action-grid">
            <button onClick={onCreateSchema}>+ Schema</button>

            <button onClick={onCreateTable} disabled={!selectedSchema}>
              + Table
            </button>
          </div>
        </div>

        <div className="sidebar-action-group">
          <div className="sidebar-action-title">Schema</div>

          <div className="sidebar-action-grid">
            <button onClick={onRenameSchema} disabled={!selectedSchema}>
              Rename
            </button>

            <button
              className="danger-button subtle"
              onClick={onDeleteSchema}
              disabled={!selectedSchema}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="sidebar-action-group">
          <div className="sidebar-action-title">Table</div>

          <div className="sidebar-action-grid">
            <button onClick={onRenameTable} disabled={!selectedTable}>
              Rename
            </button>

            <button
              className="danger-button subtle"
              onClick={onDeleteTable}
              disabled={!selectedTable}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
