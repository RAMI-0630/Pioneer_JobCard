/**
 * ErrorAlert – dismissible error banner.
 */
export default function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="error-alert" role="alert">
      <span className="error-alert__message">{message}</span>
      {onDismiss && (
        <button className="error-alert__close" onClick={onDismiss} aria-label="Dismiss error">
          ✕
        </button>
      )}
    </div>
  )
}
