import { stringifyValue } from '../../lib/jsonUtils'
import type { TableRow } from '../../model/fakeDb'

type DataPanelProps = {
  tableFilter: string
  selectedTable: string
  rowsCount: number
  filteredRowsCount: number
  columns: string[]
  activeSortColumn: string | null
  sortedFilteredRows: Array<{
    row: TableRow
    originalIndex: number
  }>
  selectedRowIndex: number | null
  onFilterChange: (value: string) => void
  onClearFilter: () => void
  onToggleSort: (column: string) => void
  getTableSortIndicator: (column: string) => string
  onSelectRow: (rowIndex: number) => void
  onCellChange: (rowIndex: number, column: string, value: string) => void
}

function DataPanel({
  tableFilter,
  selectedTable,
  rowsCount,
  filteredRowsCount,
  columns,
  activeSortColumn,
  sortedFilteredRows,
  selectedRowIndex,
  onFilterChange,
  onClearFilter,
  onToggleSort,
  getTableSortIndicator,
  onSelectRow,
  onCellChange
}: DataPanelProps): React.JSX.Element {
  return (
    <div className="data-panel">
      <div className="data-toolbar">
        <input
          className="table-filter-input"
          value={tableFilter}
          placeholder="Search rows..."
          onChange={(event) => onFilterChange(event.target.value)}
          disabled={!selectedTable || rowsCount === 0}
        />

        <div className="data-toolbar-info">
          {tableFilter.trim()
            ? `${filteredRowsCount} of ${rowsCount} row(s)`
            : `${rowsCount} row(s)`}
        </div>

        {tableFilter.trim() && <button onClick={onClearFilter}>Clear Filter</button>}
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
                      activeSortColumn === column
                        ? 'column-sort-button active'
                        : 'column-sort-button'
                    }
                    onClick={() => onToggleSort(column)}
                    title={`Sort by ${column}`}
                  >
                    <span>{column}</span>
                    <span className="column-sort-indicator">{getTableSortIndicator(column)}</span>
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
                onClick={() => onSelectRow(originalIndex)}
              >
                <td className="row-number">{originalIndex + 1}</td>

                {columns.map((column) => (
                  <td key={column}>
                    <input
                      className="cell-input"
                      value={stringifyValue(row[column])}
                      onChange={(event) => onCellChange(originalIndex, column, event.target.value)}
                      onFocus={() => onSelectRow(originalIndex)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {rowsCount === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="empty-cell">
                  Empty table. Click <code>+ Row</code> to create the first record.
                </td>
              </tr>
            )}

            {rowsCount > 0 && filteredRowsCount === 0 && (
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
  )
}

export default DataPanel
