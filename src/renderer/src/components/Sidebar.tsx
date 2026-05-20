import type { RecentFileEntry } from '../types/recentFile'

type SidebarProps = {
  databaseName: string
  displayedFilePath: string
  sourceFormatLabel: string
  recentFiles: RecentFileEntry[]
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
  onOpenRecentFile: (filePath: string) => void
  onRemoveRecentFile: (filePath: string) => void
}

function Sidebar({
  databaseName,
  displayedFilePath,
  sourceFormatLabel,
  recentFiles,
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
  onDeleteTable,
  onOpenRecentFile,
  onRemoveRecentFile
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">CONNECTIONS</div>

      <div className="connection-card">
        <div className="connection-name">Local JSON File</div>
        <div className="connection-meta">
          <span className="connection-meta-label">Database name:</span>{' '}
          <span className="connection-meta-value">{databaseName}</span>
        </div>
        <div className="connection-meta" title={displayedFilePath}>
          <span className="connection-meta-label">Path:</span>{' '}
          <span className="connection-path">{displayedFilePath}</span>
        </div>
        <div className="connection-meta">
          <span className="connection-meta-label">Format:</span>{' '}
          <span className="connection-meta-value">{sourceFormatLabel}</span>
        </div>
      </div>

      {recentFiles.length > 0 && (
        <>
          <div className="sidebar-title">RECENT FILES</div>

          <div className="sidebar-action-group">
            <div className="table-list recent-files-list">
              {recentFiles.map((recentFile) => (
                <div key={recentFile.filePath} className="recent-file-item">
                  <button
                    className="table-name recent-file-open"
                    onClick={() => onOpenRecentFile(recentFile.filePath)}
                  >
                    <span className="table-icon">{'\u21BA'}</span>
                    <span className="recent-file-content" title={recentFile.filePath}>
                      <span className="recent-file-name">{recentFile.databaseName}</span>
                      <span className="recent-file-path">{recentFile.filePath}</span>
                    </span>
                  </button>

                  <button
                    className="recent-file-remove"
                    onClick={() => onRemoveRecentFile(recentFile.filePath)}
                    title={`Remove recent file: ${recentFile.filePath}`}
                    aria-label={`Remove recent file: ${recentFile.filePath}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="sidebar-title">SCHEMAS</div>

      <div className="schema-tree">
        {schemas.map((schemaName) => (
          <div key={schemaName} className="schema-block">
            <button
              className={selectedSchema === schemaName ? 'schema-name selected' : 'schema-name'}
              onClick={() => onSchemaClick(schemaName)}
              onContextMenu={(event) => onSchemaContextMenu(event, schemaName)}
            >
              {'\u25BE'} {schemaName}
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
                    <span className="table-icon">{'\u25AA'}</span>
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
