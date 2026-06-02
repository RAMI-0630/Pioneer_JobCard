import { useEffect, useState } from 'react'
import ConfirmDialog from './ui/ConfirmDialog'

const POSITIONS   = ['FL', 'FR', 'RL', 'RR', 'SPARE']
const PATCH_SIZES = ['SMALL', 'MEDIUM', 'LARGE']

/**
 * Each row shape:
 *   {
 *     tyre_position: 'FL'|'FR'|'RL'|'RR'|'SPARE'
 *     repair_method: 'PATCH' | 'WETIF'
 *     patch_size:    'SMALL'|'MEDIUM'|'LARGE' | null  (null when WETIF)
 *     quantity:      string  (number of patches for PATCH; number of tyres for WETIF)
 *   }
 */
function emptyRow() {
  return { tyre_position: 'FL', repair_method: 'PATCH', patch_size: 'SMALL', quantity: '1' }
}

function rowFromInitial(r) {
  // Handle both old schema (patch_type + patch_count) and new schema (repair_method + patch_size + quantity)
  if (r.repair_method) {
    return {
      tyre_position: r.tyre_position,
      repair_method: r.repair_method,
      patch_size:    r.patch_size ?? null,
      quantity:      String(r.quantity ?? 1),
    }
  }
  // Back-compat: old rows have patch_type + patch_count
  return {
    tyre_position: r.tyre_position,
    repair_method: 'PATCH',
    patch_size:    r.patch_type ?? 'SMALL',
    quantity:      String(r.patch_count ?? 1),
  }
}

/**
 * TyreRepairPanel
 *
 * Two repair methods per tyre:
 *   PATCH  – select patch size (Small / Medium / Large) + quantity (# of patches)
 *   WETIF  – tubeless wet-if repair, quantity = number of tyres
 *
 * Props:
 *   initialRows – array of existing rows (edit mode)
 *   onChange(rows) – called whenever rows change
 *   errors – { tyreCount, rows: [{ quantity }] }
 */
export default function TyreRepairPanel({ initialRows = [], onChange, errors = {} }) {
  const [rows, setRows] = useState(
    initialRows.length ? initialRows.map(rowFromInitial) : [emptyRow()]
  )
  const [countInput, setCountInput] = useState(String(initialRows.length || 1))
  const [pendingCount, setPendingCount] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => { onChange(rows) }, [rows])

  useEffect(() => {
    if (initialRows.length) {
      setRows(initialRows.map(rowFromInitial))
      setCountInput(String(initialRows.length))
    }
  }, [initialRows.length])

  function applyCount(val) {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 1 || n > 5) {
      setCountInput(String(rows.length))
      return
    }
    if (n < rows.length) {
      setPendingCount(n)
      setShowConfirm(true)
    } else {
      setRows((prev) => {
        const next = [...prev]
        while (next.length < n) next.push(emptyRow())
        return next
      })
      setCountInput(String(n))
    }
  }

  function confirmReduce() {
    setRows((prev) => prev.slice(0, pendingCount))
    setCountInput(String(pendingCount))
    setShowConfirm(false)
    setPendingCount(null)
  }

  function cancelReduce() {
    setCountInput(String(rows.length))
    setShowConfirm(false)
    setPendingCount(null)
  }

  function setRow(index, field, value) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== index) return r
      const updated = { ...r, [field]: value }
      // When switching to WETIF, clear patch_size; when switching to PATCH, restore default
      if (field === 'repair_method') {
        updated.patch_size = value === 'PATCH' ? (r.patch_size ?? 'SMALL') : null
      }
      return updated
    }))
  }

  const qtyLabel = (row) => row.repair_method === 'WETIF' ? 'No. of Tyres' : 'Patch Count'

  return (
    <div className="service-panel">
      <div className="service-panel__header">
        <span className="service-panel__icon">🔧</span>
        <span className="service-panel__title">Tyre Repair Details</span>
      </div>

      {/* Row count */}
      <div className="field service-panel__count-field">
        <label htmlFor="rep-count" className="field-label">Number of Tyres Repaired</label>
        <input
          id="rep-count"
          type="number"
          className={`field-input field-input--narrow ${errors.tyreCount ? 'field-input--error' : ''}`}
          value={countInput}
          min={1}
          max={5}
          onChange={(e) => setCountInput(e.target.value)}
          onBlur={(e) => applyCount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyCount(e.target.value) }}
        />
        {errors.tyreCount && <span className="field-error" role="alert">{errors.tyreCount}</span>}
      </div>

      <div className="repeatable-rows">
        {rows.map((row, i) => (
          <div key={i} className="repeatable-row">
            <span className="repeatable-row__index">{i + 1}</span>

            {/* Position */}
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

            {/* Repair method */}
            <div className="field repeatable-row__field">
              <label htmlFor={`rep-method-${i}`} className="field-label">Repair Type</label>
              <select
                id={`rep-method-${i}`}
                className="field-input"
                value={row.repair_method}
                onChange={(e) => setRow(i, 'repair_method', e.target.value)}
              >
                <option value="PATCH">Patch</option>
                <option value="WETIF">Tubeless Wetif</option>
              </select>
            </div>

            {/* Patch size — only for PATCH */}
            {row.repair_method === 'PATCH' && (
              <div className="field repeatable-row__field">
                <label htmlFor={`rep-size-${i}`} className="field-label">Patch Size</label>
                <select
                  id={`rep-size-${i}`}
                  className="field-input"
                  value={row.patch_size ?? 'SMALL'}
                  onChange={(e) => setRow(i, 'patch_size', e.target.value)}
                >
                  {PATCH_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Quantity */}
            <div className="field repeatable-row__field">
              <label htmlFor={`rep-qty-${i}`} className="field-label">{qtyLabel(row)}</label>
              <input
                id={`rep-qty-${i}`}
                type="number"
                className={`field-input ${errors.rows?.[i]?.quantity ? 'field-input--error' : ''}`}
                value={row.quantity}
                min={1}
                step={1}
                onChange={(e) => setRow(i, 'quantity', e.target.value)}
              />
              {errors.rows?.[i]?.quantity && (
                <span className="field-error" role="alert">{errors.rows[i].quantity}</span>
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
        onCancel={cancelReduce}
      />
    </div>
  )
}
