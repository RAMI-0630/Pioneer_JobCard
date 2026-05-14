/**
 * ConfirmDialog – modal confirmation prompt.
 * Props: open, title, message, confirmLabel, onConfirm, onCancel
 */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog">
        <h2 id="dialog-title" className="dialog__title">{title}</h2>
        {message && <p className="dialog__message">{message}</p>}
        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
