type WorkspaceHeaderProps = {
  selectedSchema: string
  selectedTable: string
  rowsCount: number
  columnsCount: number
  filteredRowsCount: number
  hasFilter: boolean
  sortSummary: string | null
  selectedRowIndex: number | null
  onAddRow: () => void
  onDuplicateRow: () => void
  onDeleteRow: () => void
  onApplyChanges: () => void
  canAddRow: boolean
  canDuplicateRow: boolean
  canDeleteRow: boolean
  canApplyChanges: boolean
}

function WorkspaceHeader({
  selectedSchema,
  selectedTable,
  rowsCount,
  columnsCount,
  filteredRowsCount,
  hasFilter,
  sortSummary,
  selectedRowIndex,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  onApplyChanges,
  canAddRow,
  canDuplicateRow,
  canDeleteRow,
  canApplyChanges
}: WorkspaceHeaderProps): React.JSX.Element {
  return (
    <div className="workspace-header">
      <div>
        <h2>
          {selectedSchema}.{selectedTable || 'no_table_selected'}
        </h2>
        <p>
          {rowsCount} rows · {columnsCount} columns
          {hasFilter && <> · filtered {filteredRowsCount}</>}
          {sortSummary && <> · sorted by {sortSummary}</>}
          {selectedRowIndex !== null && <> · selected row #{selectedRowIndex + 1}</>}
        </p>
      </div>

      <div className="workspace-actions">
        <button onClick={onAddRow} disabled={!canAddRow}>
          + Row
        </button>
        <button onClick={onDuplicateRow} disabled={!canDuplicateRow}>
          Duplicate
        </button>
        <button onClick={onDeleteRow} disabled={!canDeleteRow}>
          Delete
        </button>
        <button
          className="primary"
          onClick={onApplyChanges}
          disabled={!canApplyChanges}
          title="Write current changes to the JSON file"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

export default WorkspaceHeader
