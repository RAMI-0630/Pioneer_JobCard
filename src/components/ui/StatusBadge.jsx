/**
 * StatusBadge – coloured pill for job card status.
 */
const STATUS_MAP = {
  OPEN: { label: 'Open', cls: 'badge--open' },
  IN_PROGRESS: { label: 'In Progress', cls: 'badge--in-progress' },
  COMPLETED: { label: 'Completed', cls: 'badge--completed' },
  CLOSED: { label: 'Closed', cls: 'badge--closed' },
}

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: '' }
  return <span className={`badge ${cls}`}>{label}</span>
}
