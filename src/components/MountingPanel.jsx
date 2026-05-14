import { useEffect, useState } from 'react'

const TYRE_SIZES = ['NORMAL', 'XL']

/**
 * MountingPanel
 * Captures: number_of_tyres (int) and tyre_type (NORMAL | XL) for a mounting service.
 *
 * Props:
 *   initialData – { number_of_tyres, tyre_type } for edit mode
 *   onChange({ number_of_tyres, tyre_type }) – called on every change
 *   errors – { number_of_tyres?, tyre_type? }
 */
export default function MountingPanel({ initialData = {}, onChange, errors = {} }) {
  const [data, setData] = useState({
    number_of_tyres: initialData.number_of_tyres ? String(initialData.number_of_tyres) : '',
    tyre_type:       initialData.tyre_type ?? 'NORMAL',
  })

  // Notify parent on every change
  useEffect(() => { onChange(data) }, [data])

  // Sync when initialData arrives late (edit mode)
  useEffect(() => {
    if (initialData.number_of_tyres || initialData.tyre_type) {
      setData({
        number_of_tyres: initialData.number_of_tyres ? String(initialData.number_of_tyres) : '',
        tyre_type:       initialData.tyre_type ?? 'NORMAL',
      })
    }
  }, [initialData.number_of_tyres, initialData.tyre_type])

  function set(field, value) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="service-panel">
      <div className="service-panel__header">
        <span className="service-panel__icon">🔩</span>
        <span className="service-panel__title">Mounting Details</span>
      </div>

      <div className="form-row-2">
        <div className="field">
          <label htmlFor="mnt-count" className="field-label">Number of Tyres</label>
          <input
            id="mnt-count"
            type="number"
            className={`field-input ${errors.number_of_tyres ? 'field-input--error' : ''}`}
            value={data.number_of_tyres}
            min={1}
            max={5}
            step={1}
            onChange={(e) => set('number_of_tyres', e.target.value)}
          />
          {errors.number_of_tyres && (
            <span className="field-error" role="alert">{errors.number_of_tyres}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="mnt-size" className="field-label">Tyre Size</label>
          <select
            id="mnt-size"
            className={`field-input ${errors.tyre_type ? 'field-input--error' : ''}`}
            value={data.tyre_type}
            onChange={(e) => set('tyre_type', e.target.value)}
          >
            {TYRE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.tyre_type && (
            <span className="field-error" role="alert">{errors.tyre_type}</span>
          )}
        </div>
      </div>
    </div>
  )
}
