import type { ConfirmDialogState, DialogMode } from '../types/ui'

type DialogHostProps = {
  confirmDialog: ConfirmDialogState
  dialogMode: DialogMode
  selectedSchema: string
  selectedTable: string
  selectedColumnName: string | null
  schemaNameInput: string
  tableNameInput: string
  columnsInput: string
  renameInput: string
  columnNameInput: string
  columnDefaultInput: string
  onCloseConfirmDialog: () => void
  onCloseDialog: () => void
  onSchemaNameInputChange: (value: string) => void
  onTableNameInputChange: (value: string) => void
  onColumnsInputChange: (value: string) => void
  onRenameInputChange: (value: string) => void
  onColumnNameInputChange: (value: string) => void
  onColumnDefaultInputChange: (value: string) => void
  onCreateSchema: () => void
  onCreateTable: () => void
  onRenameSchema: () => void
  onDeleteSchema: () => void
  onRenameTable: () => void
  onDeleteTable: () => void
  onAddColumn: () => void
  onRenameColumn: () => void
  onDeleteColumn: () => void
}

function DialogHost({
  confirmDialog,
  dialogMode,
  selectedSchema,
  selectedTable,
  selectedColumnName,
  schemaNameInput,
  tableNameInput,
  columnsInput,
  renameInput,
  columnNameInput,
  columnDefaultInput,
  onCloseConfirmDialog,
  onCloseDialog,
  onSchemaNameInputChange,
  onTableNameInputChange,
  onColumnsInputChange,
  onRenameInputChange,
  onColumnNameInputChange,
  onColumnDefaultInputChange,
  onCreateSchema,
  onCreateTable,
  onRenameSchema,
  onDeleteSchema,
  onRenameTable,
  onDeleteTable,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn
}: DialogHostProps): React.JSX.Element {
  return (
    <>
      {confirmDialog !== null && (
        <div className="modal-backdrop" onClick={onCloseConfirmDialog}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmDialog.title}</h3>
              <button className="icon-button" onClick={onCloseConfirmDialog}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-info">{confirmDialog.message}</div>
            </div>

            <div className="modal-actions">
              <button onClick={onCloseConfirmDialog}>Cancel</button>

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
        <div className="modal-backdrop" onClick={onCloseDialog}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            {dialogMode === 'schema' && (
              <>
                <div className="modal-header">
                  <h3>Create Schema</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onSchemaNameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onCreateSchema()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onCreateSchema}>
                    Create Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'table' && (
              <>
                <div className="modal-header">
                  <h3>Create Table</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onTableNameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') onCloseDialog()
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
                    onChange={(event) => onColumnsInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onCreateTable()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />

                  <div className="modal-hint">
                    Separate columns with comma, example: <code>id,name,surname,active</code>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onCreateTable}>
                    Create Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameSchema' && (
              <>
                <div className="modal-header">
                  <h3>Rename Schema</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onRenameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onRenameSchema()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onRenameSchema}>
                    Rename Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteSchema' && (
              <>
                <div className="modal-header">
                  <h3>Delete Schema</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="danger-button" onClick={onDeleteSchema}>
                    Delete Schema
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameTable' && (
              <>
                <div className="modal-header">
                  <h3>Rename Table</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onRenameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onRenameTable()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onRenameTable}>
                    Rename Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteTable' && (
              <>
                <div className="modal-header">
                  <h3>Delete Table</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="danger-button" onClick={onDeleteTable}>
                    Delete Table
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'addColumn' && (
              <>
                <div className="modal-header">
                  <h3>Add Column</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onColumnNameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onAddColumn()
                      if (event.key === 'Escape') onCloseDialog()
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
                    onChange={(event) => onColumnDefaultInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onAddColumn()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />

                  <div className="modal-hint">
                    Values are parsed like cells: <code>true</code>, <code>false</code>,{' '}
                    <code>null</code>, numbers and JSON objects/arrays are supported.
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onAddColumn}>
                    Add Column
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'renameColumn' && (
              <>
                <div className="modal-header">
                  <h3>Rename Column</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                    onChange={(event) => onColumnNameInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onRenameColumn()
                      if (event.key === 'Escape') onCloseDialog()
                    }}
                  />
                </div>

                <div className="modal-actions">
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="primary" onClick={onRenameColumn}>
                    Rename Column
                  </button>
                </div>
              </>
            )}

            {dialogMode === 'deleteColumn' && (
              <>
                <div className="modal-header">
                  <h3>Delete Column</h3>
                  <button className="icon-button" onClick={onCloseDialog}>
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
                  <button onClick={onCloseDialog}>Cancel</button>
                  <button className="danger-button" onClick={onDeleteColumn}>
                    Delete Column
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default DialogHost
