import type { ContextMenuState } from '../types/ui'

type ContextMenuProps = {
  contextMenu: Exclude<ContextMenuState, null>
  onClose: () => void
  onCreateTable: (schemaName: string) => void
  onRenameSchema: (schemaName: string) => void
  onDeleteSchema: (schemaName: string) => void
  onOpenTableData: (schemaName: string, tableName: string) => void
  onOpenTableStructure: (schemaName: string, tableName: string) => void
  onRenameTable: (schemaName: string, tableName: string) => void
  onDeleteTable: (schemaName: string, tableName: string) => void
}

function ContextMenu({
  contextMenu,
  onClose,
  onCreateTable,
  onRenameSchema,
  onDeleteSchema,
  onOpenTableData,
  onOpenTableStructure,
  onRenameTable,
  onDeleteTable
}: ContextMenuProps): React.JSX.Element {
  return (
    <div
      className="context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        className="context-menu"
        style={{
          left: contextMenu.x,
          top: contextMenu.y
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {contextMenu.kind === 'schema' && (
          <>
            <div className="context-menu-title">Schema: {contextMenu.schemaName}</div>

            <button onClick={() => onCreateTable(contextMenu.schemaName)}>+ Create Table</button>

            <button onClick={() => onRenameSchema(contextMenu.schemaName)}>Rename Schema</button>

            <button
              className="danger-menu-item"
              onClick={() => onDeleteSchema(contextMenu.schemaName)}
            >
              Delete Schema
            </button>
          </>
        )}

        {contextMenu.kind === 'table' && (
          <>
            <div className="context-menu-title">
              Table: {contextMenu.schemaName}.{contextMenu.tableName}
            </div>

            <button onClick={() => onOpenTableData(contextMenu.schemaName, contextMenu.tableName)}>
              Open Data
            </button>

            <button
              onClick={() => onOpenTableStructure(contextMenu.schemaName, contextMenu.tableName)}
            >
              Open Structure
            </button>

            <button onClick={() => onRenameTable(contextMenu.schemaName, contextMenu.tableName)}>
              Rename Table
            </button>

            <button
              className="danger-menu-item"
              onClick={() => onDeleteTable(contextMenu.schemaName, contextMenu.tableName)}
            >
              Delete Table
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ContextMenu
