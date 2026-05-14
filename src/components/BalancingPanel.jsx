import { useEffect, useState } from 'react'
import ConfirmDialog from './ui/ConfirmDialog'

const POSITIONS = ['FL', 'FR', 'RL', 'RR', 'SPARE']

function emptyRow() {
  return { tyre_position: 'FL', grams_used: '' }
}

function buildRows(count) {
  return Array.from({ length: count }, emptyRow)
}

/**
 * BalancingPanel
 * Props:
 *   initialRows – [{ tyre_position, grams_used }] for edit mode
 *   onChange(rows) – called whenever rows change; parent stores the value
 *   errors – { tyreCount, rows: [{ grams_used }] }
 */
export default function BalancingPanel({ initialRows = [], onChange, errors = {} }) {
  const [rows, setRows] = useState(
    initialRows.length ? initialRows.map((r) => ({ tyre_position: r.tyre_position, grams_used: String(r.grams_used) })) : [emptyRow()]
  )
  const [pendingCount, setPendingCount] = useState(null) // count waiting for confirm
  const [showConfirm, setShowConfirm] = useState(false)

  // Notify parent whenever rows change
  useEffect(() => { onChange(rows) }, [rows])

  // Sync if initialRows arrive late (edit mode)
  useEffect(() => {
    if (initialRows.length) {
      setRows(initialRows.map((r) => ({ tyre_position: r.tyre_position, grams_used: String(r.grams_used) })))
    }
  }, [initialRows.length])

  function handleCountChange(e) {
    const val = parseInt(e.target.value, 10)
    if (isNaN(val) || val < 1 || val > 5) return
    if (val < rows.length) {
      // Warn before removing rows
      setPendingCount(val)
      setShowConfirm(true)
    } else {
      // Add rows
      setRows((prev) => {
        const next = [...prev]
        while (next.length < val) next.push(emptyRow())
        return next
      })
    }
  }

  function confirmReduce() {
    setRows((prev) => prev.slice(0, pendingCount))
    setShowConfirm(false)
    setPendingCount(null)
  }

  function setRow(index, field, value) {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  return (
    <div className="service-panel">
      <div className="service-panel__header">
        <span className="service-panel__icon">⚖️</span>
        <span className="service-panel__title">Balancing Details</span>
      </div>

      {/* Tyre count */}
      <div className="field service-panel__count-field">
        <label htmlFor="bal-count" className="field-label">Number of Tyres</label>
        <input
          id="bal-count"
          type="number"
          className={`field-input field-input--narrow ${errors.tyreCount ? 'field-input--error' : ''}`}
          value={rows.length}
          min={1}
          max={5}
          onChange={handleCountChange}
        />
        {errors.tyreCount && <span className="field-error" role="alert">{errors.tyreCount}</span>}
      </div>

      {/* Repeatable rows */}
      <div className="repeatable-rows">
        {rows.map((row, i) => (
          <div key={i} className="repeatable-row">
            <span className="repeatable-row__index">{i + 1}</span>

            <div className="field repeatable-row__field">
              <label htmlFor={`bal-pos-${i}`} className="field-label">Position</label>
              <select
                id={`bal-pos-${i}`}
                className="field-input"
                value={row.tyre_position}
                onChange={(e) => setRow(i, 'tyre_position', e.target.value)}
              >
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="field repeatable-row__field">
              <label htmlFor={`bal-grams-${i}`} className="field-label">Grams Used</label>
              <input
                id={`bal-grams-${i}`}
                type="number"
                className={`field-input ${errors.rows?.[i]?.grams_used ? 'field-input--error' : ''}`}
                value={row.grams_used}
                min={0}
                step={1}
                onChange={(e) => setRow(i, 'grams_used', e.target.value)}
              />
              {errors.rows?.[i]?.grams_used && (
                <span className="field-error" role="alert">{errors.rows[i].grams_used}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Remove Tyre Rows?"
        message={`This will remove ${rows.length - (pendingCount ?? 0)} row(s). Any data in those rows will be lost.`}
        confirmLabel="Yes, Remove"
        onConfirm={confirmReduce}
        onCancel={() => { setShowConfirm(false); setPendingCount(null) }}
      />
    </div>
  )
}
