import { stringifyValue } from '../../lib/jsonUtils'
import type { TableRow } from '../../model/fakeDb'

type QueryPanelProps = {
  query: string
  selectedSchema: string
  selectedTable: string
  queryError: string | null
  queryHasRun: boolean
  queryResultRows: TableRow[]
  queryResultColumns: string[]
  onQueryChange: (value: string) => void
  onExecuteQuery: () => void
  onClearQuery: () => void
  onUseCurrentTable: () => void
}

function QueryPanel({
  query,
  selectedSchema,
  selectedTable,
  queryError,
  queryHasRun,
  queryResultRows,
  queryResultColumns,
  onQueryChange,
  onExecuteQuery,
  onClearQuery,
  onUseCurrentTable
}: QueryPanelProps): React.JSX.Element {
  return (
    <div className="query-panel">
      <textarea
        className="query-editor"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            onExecuteQuery()
          }
        }}
      />

      <div className="query-actions">
        <button className="primary" onClick={onExecuteQuery}>
          Execute
        </button>

        <button onClick={onClearQuery}>Clear</button>

        <button onClick={onUseCurrentTable} disabled={!selectedTable}>
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
          <div className="query-result-header">Result: {queryResultRows.length} row(s)</div>

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
  )
}

export default QueryPanel
