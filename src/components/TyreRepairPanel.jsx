import { useEffect, useState } from 'react'
import ConfirmDialog from './ui/ConfirmDialog'

const POSITIONS   = ['FL', 'FR', 'RL', 'RR', 'SPARE']
const PATCH_TYPES = ['SMALL', 'MEDIUM', 'LARGE']

function emptyRow() {
  return { tyre_position: 'FL', patch_type: 'SMALL', patch_count: '1' }
}

/**
 * TyreRepairPanel
 * Props:
 *   initialRows – [{ tyre_position, patch_type, patch_count }] for edit mode
 *   onChange(rows) – called whenever rows change
 *   errors – { tyreCount, rows: [{ patch_count }] }
 */
export default function TyreRepairPanel({ initialRows = [], onChange, errors = {} }) {
  const [rows, setRows] = useState(
    initialRows.length
      ? initialRows.map((r) => ({ tyre_position: r.tyre_position, patch_type: r.patch_type, patch_count: String(r.patch_count) }))
      : [emptyRow()]
  )
  const [pendingCount, setPendingCount] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => { onChange(rows) }, [rows])

  useEffect(() => {
    if (initialRows.length) {
      setRows(initialRows.map((r) => ({ tyre_position: r.tyre_position, patch_type: r.patch_type, patch_count: String(r.patch_count) })))
    }
  }, [initialRows.length])

  function handleCountChange(e) {
    const val = parseInt(e.target.value, 10)
    if (isNaN(val) || val < 1 || val > 5) return
    if (val < rows.length) {
      setPendingCount(val)
      setShowConfirm(true)
    } else {
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
        <span className="service-panel__icon">🔧</span>
        <span className="service-panel__title">Tyre Repair Details</span>
      </div>

      {/* Tyre count */}
      <div className="field service-panel__count-field">
        <label htmlFor="rep-count" className="field-label">Number of Tyres Repaired</label>
        <input
          id="rep-count"
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
              <label htmlFor={`rep-pos-${i}`} className="field-label">Position</label>
              <select
                id={`rep-pos-${i}`}
                className="field-input"
                value={row.tyre_position}
                onChange={(e) => setRow(i, 'tyre_position', e.target.value)}
              >
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="field repeatable-row__field">
              <label htmlFor={`rep-patch-${i}`} className="field-label">Patch Type</label>
              <select
                id={`rep-patch-${i}`}
                className="field-input"
                value={row.patch_type}
                onChange={(e) => setRow(i, 'patch_type', e.target.value)}
              >
                {PATCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="field repeatable-row__field">
              <label htmlFor={`rep-count-${i}`} className="field-label">Patch Count</label>
              <input
                id={`rep-count-${i}`}
                type="number"
                className={`field-input ${errors.rows?.[i]?.patch_count ? 'field-input--error' : ''}`}
                value={row.patch_count}
                min={1}
                step={1}
                onChange={(e) => setRow(i, 'patch_count', e.target.value)}
              />
              {errors.rows?.[i]?.patch_count && (
                <span className="field-error" role="alert">{errors.rows[i].patch_count}</span>
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
