export type DialogMode =
  | 'schema'
  | 'table'
  | 'renameSchema'
  | 'deleteSchema'
  | 'renameTable'
  | 'deleteTable'
  | 'addColumn'
  | 'renameColumn'
  | 'deleteColumn'
  | null

export type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel: string
  confirmKind?: 'primary' | 'danger'
  onConfirm: () => void | Promise<void>
  saveAndContinueLabel?: string
  onSaveAndContinue?: () => void | Promise<void>
} | null

export type ContextMenuState =
  | {
      kind: 'schema'
      x: number
      y: number
      schemaName: string
    }
  | {
      kind: 'table'
      x: number
      y: number
      schemaName: string
      tableName: string
    }
  | null
