type StatusBarProps = {
  statusMessage: string
  hasUnsavedChanges: boolean
  hasExternalFileChange: boolean
  filePath: string | null
}

function StatusBar({
  statusMessage,
  hasUnsavedChanges,
  hasExternalFileChange,
  filePath
}: StatusBarProps): React.JSX.Element {
  return (
    <footer className="statusbar">
      <span>Status: {statusMessage}</span>
      <span className={hasUnsavedChanges ? 'dirty-status' : ''}>
        Unsaved changes: {hasUnsavedChanges ? 'yes' : 'no'}
      </span>
      <span className={hasExternalFileChange ? 'external-change-status' : ''}>
        External changes: {hasExternalFileChange ? 'pending' : 'none'}
      </span>
      <span>Path: {filePath ?? 'mock://database.json'}</span>
    </footer>
  )
}

export default StatusBar
