type RawJsonPanelProps = {
  rawJsonError: string | null
  displayedRawJsonText: string
  isRawDirty: boolean
  onRawJsonChange: (value: string) => void
  onResetRawJson: () => void
  onFormatRawJson: () => void
  onApplyRawJson: () => void
}

function RawJsonPanel({
  rawJsonError,
  displayedRawJsonText,
  isRawDirty,
  onRawJsonChange,
  onResetRawJson,
  onFormatRawJson,
  onApplyRawJson
}: RawJsonPanelProps): React.JSX.Element {
  return (
    <div className="raw-panel">
      <textarea
        className={rawJsonError ? 'raw-editor raw-editor-error' : 'raw-editor'}
        value={displayedRawJsonText}
        onChange={(event) => onRawJsonChange(event.target.value)}
        spellCheck={false}
      />

      <div className="raw-actions">
        <div className="raw-actions-left">
          {isRawDirty && <span className="raw-dirty-indicator">Raw JSON not applied</span>}
          {rawJsonError && <span className="raw-error">{rawJsonError}</span>}
        </div>

        <div className="raw-actions-right">
          <button onClick={onResetRawJson} disabled={!isRawDirty}>
            Reset
          </button>

          <button onClick={onFormatRawJson}>Format</button>

          <button className="primary" onClick={onApplyRawJson} disabled={!isRawDirty}>
            Apply Raw
          </button>
        </div>
      </div>
    </div>
  )
}

export default RawJsonPanel
