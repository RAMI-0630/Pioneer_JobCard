/**
 * EmptyState – shown when a list has no results.
 */
export default function EmptyState({ title = 'No records found', message }) {
  return (
    <div className="empty-state" role="status">
      <svg className="empty-state__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
        <path d="M22 32h20M32 22v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      </svg>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
    </div>
  )
}
