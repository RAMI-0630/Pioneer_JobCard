/**
 * NumberInput – labelled numeric field with optional error message.
 */
export default function NumberInput({ id, label, error, required, className = '', ...rest }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type="number"
        className={`field-input ${error ? 'field-input--error' : ''}`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        {...rest}
      />
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
