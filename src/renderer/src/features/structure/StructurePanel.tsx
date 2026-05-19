import { inferType } from '../../lib/tableUtils'
import type { JsonValue, TableRow } from '../../model/fakeDb'

type StructurePanelProps = {
  columns: string[]
  rows: TableRow[]
  canAddColumn: boolean
  onAddColumn: () => void
  onRenameColumn: (column: string) => void
  onDeleteColumn: (column: string) => void
}

function StructurePanel({
  columns,
  rows,
  canAddColumn,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn
}: StructurePanelProps): React.JSX.Element {
  return (
    <div className="structure-panel">
      <div className="structure-actions">
        <button onClick={onAddColumn} disabled={!canAddColumn}>
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
              const nullable = values.some((value: JsonValue | undefined) => value == null)

              return (
                <tr key={column}>
                  <td>{column}</td>
                  <td>{inferType(values)}</td>
                  <td>{nullable ? 'yes' : 'no'}</td>
                  <td>
                    <div className="inline-actions">
                      <button onClick={() => onRenameColumn(column)}>Rename</button>
                      <button
                        className="danger-button subtle"
                        onClick={() => onDeleteColumn(column)}
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
  )
}

export default StructurePanel
