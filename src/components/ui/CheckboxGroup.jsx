/**
 * CheckboxGroup – renders a vertical list of checkboxes.
 * Props:
 *   legend   – group label
 *   options  – [{ id, name }]
 *   selected – Set or array of selected ids
 *   onChange – (id, checked) => void
 */
export default function CheckboxGroup({ legend, options = [], selected = [], onChange }) {
  const selectedSet = new Set(selected)

  return (
    <fieldset className="checkbox-group">
      <legend className="checkbox-group__legend">{legend}</legend>
      <div className="checkbox-group__list">
        {options.map((opt) => (
          <label key={opt.id} className="checkbox-group__item">
            <input
              type="checkbox"
              checked={selectedSet.has(opt.id)}
              onChange={(e) => onChange(opt.id, e.target.checked)}
            />
            <span>{opt.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
