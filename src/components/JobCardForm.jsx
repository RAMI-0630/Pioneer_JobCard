import { useEffect, useRef, useState } from 'react'
import TextInput from './ui/TextInput'
import NumberInput from './ui/NumberInput'
import DateInput from './ui/DateInput'
import TimeInput from './ui/TimeInput'
import ErrorAlert from './ui/ErrorAlert'
import Spinner from './ui/Spinner'
import BalancingPanel from './BalancingPanel'
import TyreRepairPanel from './TyreRepairPanel'
import MountingPanel from './MountingPanel'
import { fetchServiceCatalog, findCustomerByMobile, findVehicleByPlate } from '../lib/queries'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']

// Services that reveal structured detail panels (matched by name, case-insensitive)
const DETAIL_SERVICES = ['balancing', 'tyre repair', 'mounting']

/** Returns today's date as YYYY-MM-DD in local time */
function localDateString() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

/** Returns current time as HH:MM in local time */
function localTimeString() {
  const d = new Date()
  return [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':')
}

const EMPTY_FORM = {
  job_card_no: '', job_date: '', time_in: '', status: 'OPEN',
  full_name: '', mobile: '',
  plate_no: '', make: '', model: '', year: '', current_km_reading: '',
  tyre_size_front: '', tyre_size_rear: '', spare_size: '',
  technician_name: '', time_out: '', notes: '',
}

/**
 * JobCardForm
 * Props:
 *   nextJobCardNo    – auto-generated number (create mode)
 *   initialValues    – pre-filled values (edit mode)
 *   initialServices  – array of selected service_catalog_ids (edit mode)
 *   initialBalancing – [{ tyre_position, grams_used }] (edit mode)
 *   initialTyreRepair– [{ tyre_position, patch_type, patch_count }] (edit mode)
 *   onSubmit(formData, selectedServiceIds, balancingRows, tyreRepairRows)
 *   submitLabel
 *   isEdit
 */
export default function JobCardForm({
  nextJobCardNo,
  initialValues = {},
  initialServices = [],
  initialBalancing = [],
  initialTyreRepair = [],
  initialMounting = {},
  onSubmit,
  submitLabel = 'Save Job Card',
  isEdit = false,
}) {
  const seedValues = isEdit ? {} : {
    job_card_no: nextJobCardNo ?? '',
    job_date: localDateString(),
    time_in: localTimeString(),
  }

  const [form, setForm] = useState({ ...EMPTY_FORM, ...seedValues, ...initialValues })
  const [selectedServices, setSelectedServices] = useState(new Set(initialServices))
  const [serviceCatalog, setServiceCatalog] = useState([])
  const [errors, setErrors] = useState({})
  const [serviceErrors, setServiceErrors] = useState({}) // { balancing: {...}, tyreRepair: {...} }
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [lookupMsg, setLookupMsg] = useState('')

  // Live refs to panel data — panels call onChange on every change
  const balancingRowsRef  = useRef(initialBalancing)
  const tyreRepairRowsRef = useRef(initialTyreRepair)
  const mountingDetailRef = useRef(initialMounting)

  // Load service catalog — use localStorage cache as offline fallback
  useEffect(() => {
    const CACHE_KEY = 'pioneer_service_catalog'

    // Immediately seed from cache so the form is usable even before the
    // network resolves (or if it never does because we're offline)
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        setServiceCatalog(JSON.parse(cached))
        setLoadingCatalog(false)
      } catch (_) {}
    }

    fetchServiceCatalog()
      .then((data) => {
        setServiceCatalog(data)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      })
      .catch((e) => {
        // Only show an error if we have nothing cached to fall back on
        if (!cached) setServerError('Could not load services. Please check your connection.')
      })
      .finally(() => setLoadingCatalog(false))
  }, [])

  // Sync initialValues on edit load
  useEffect(() => {
    if (Object.keys(initialValues).length) setForm((p) => ({ ...p, ...initialValues }))
  }, [JSON.stringify(initialValues)])

  useEffect(() => { setSelectedServices(new Set(initialServices)) }, [initialServices.join(',')])

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
    setErrors((p) => ({ ...p, [field]: '' }))
  }

  // ── Service selection ──────────────────────────────────────────────────────
  function toggleService(id) {
    setSelectedServices((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Helpers to check if a named service is selected
  function isServiceSelected(name) {
    return serviceCatalog.some(
      (s) => s.name.toLowerCase() === name.toLowerCase() && selectedServices.has(s.id)
    )
  }

  const balancingSelected  = isServiceSelected('balancing')
  const tyreRepairSelected = isServiceSelected('tyre repair')
  const mountingSelected   = isServiceSelected('mounting')

  // ── Auto-lookup ────────────────────────────────────────────────────────────
  async function handleMobileBlur() {
    if (!form.mobile || isEdit) return
    try {
      const c = await findCustomerByMobile(form.mobile)
      if (c) { setForm((p) => ({ ...p, full_name: c.full_name })); flash(`Customer found: ${c.full_name}`) }
    } catch (_) {}
  }

  async function handlePlateBlur() {
    if (!form.plate_no || isEdit) return
    try {
      const v = await findVehicleByPlate(form.plate_no)
      if (v) {
        setForm((p) => ({
          ...p,
          make: v.make || p.make, model: v.model || p.model,
          year: v.year ? String(v.year) : p.year,
          current_km_reading: v.current_km_reading ? String(v.current_km_reading) : p.current_km_reading,
          tyre_size_front: v.tyre_size_front || p.tyre_size_front,
          tyre_size_rear: v.tyre_size_rear || p.tyre_size_rear,
          spare_size: v.spare_size || p.spare_size,
        }))
        flash(`Vehicle found: ${v.make} ${v.model}`)
      }
    } catch (_) {}
  }

  function flash(msg) {
    setLookupMsg(msg)
    setTimeout(() => setLookupMsg(''), 3000)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!form.job_card_no.trim())       e.job_card_no        = 'Job card number is required.'
    if (!form.job_date)                 e.job_date           = 'Date is required.'
    if (!form.full_name.trim())         e.full_name          = 'Customer name is required.'
    if (!form.mobile.trim())            e.mobile             = 'Mobile number is required.'
    if (!form.plate_no.trim())          e.plate_no           = 'Plate number is required.'
    if (!form.make.trim())              e.make               = 'Make is required.'
    if (!form.model.trim())             e.model              = 'Model is required.'
    if (!form.year)                     e.year               = 'Year is required.'
    else if (isNaN(form.year) || form.year < 1900 || form.year > new Date().getFullYear() + 1)
                                        e.year               = 'Enter a valid year.'
    if (!form.current_km_reading)       e.current_km_reading = 'KM reading is required.'
    else if (isNaN(form.current_km_reading) || Number(form.current_km_reading) < 0)
                                        e.current_km_reading = 'Must be a non-negative number.'
    if (!form.tyre_size_front.trim())   e.tyre_size_front    = 'Front tyre size is required.'
    if (!form.tyre_size_rear.trim())    e.tyre_size_rear     = 'Rear tyre size is required.'
    if (!form.technician_name.trim())   e.technician_name    = 'Technician name is required.'
    return e
  }

  function validateServiceDetails() {
    const se = {}

    if (balancingSelected) {
      const rows = balancingRowsRef.current
      const rowErrors = rows.map((r) => {
        const re = {}
        if (r.grams_used === '' || isNaN(r.grams_used) || Number(r.grams_used) < 0)
          re.grams_used = 'Enter grams (0 or more).'
        return re
      })
      if (rowErrors.some((re) => Object.keys(re).length))
        se.balancing = { rows: rowErrors }
    }

    if (tyreRepairSelected) {
      const rows = tyreRepairRowsRef.current
      const rowErrors = rows.map((r) => {
        const re = {}
        if (!r.patch_count || isNaN(r.patch_count) || Number(r.patch_count) < 1)
          re.patch_count = 'Enter patch count (1 or more).'
        return re
      })
      if (rowErrors.some((re) => Object.keys(re).length))
        se.tyreRepair = { rows: rowErrors }
    }

    if (mountingSelected) {
      const d = mountingDetailRef.current
      const me = {}
      if (!d.number_of_tyres || isNaN(d.number_of_tyres) || Number(d.number_of_tyres) < 1)
        me.number_of_tyres = 'Enter number of tyres (1 or more).'
      if (!d.tyre_type?.trim())
        me.tyre_type = 'Tyre type is required.'
      if (Object.keys(me).length) se.mounting = me
    }

    return se
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')

    const errs = validate()
    const sErrs = validateServiceDetails()

    if (Object.keys(errs).length || Object.keys(sErrs).length) {
      setErrors(errs)
      setServiceErrors(sErrs)
      // Scroll to first error
      setTimeout(() => document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(
        form,
        [...selectedServices],
        balancingSelected  ? balancingRowsRef.current  : [],
        tyreRepairSelected ? tyreRepairRowsRef.current : [],
        serviceCatalog,
        mountingSelected   ? mountingDetailRef.current : null,
      )
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate className="job-card-form">
      <ErrorAlert message={serverError} onDismiss={() => setServerError('')} />
      {lookupMsg && <div className="lookup-msg" role="status">{lookupMsg}</div>}

      {/* ── 1. Job Information ── */}
      <section className="form-section">
        <h2 className="form-section__title">Job Information</h2>
        <div className="form-stack">
          <div className="field">
            <label htmlFor="job_card_no" className="field-label">
              Job Card Number
              {!isEdit && <span className="field-auto-badge">auto</span>}
            </label>
            <input
              id="job_card_no"
              className={`field-input ${!isEdit ? 'field-input--readonly' : ''} ${errors.job_card_no ? 'field-input--error' : ''}`}
              value={form.job_card_no}
              onChange={(e) => isEdit && set('job_card_no', e.target.value)}
              readOnly={!isEdit}
              aria-readonly={!isEdit}
            />
            {errors.job_card_no && <span className="field-error" role="alert">{errors.job_card_no}</span>}
          </div>

          <div className="form-row-2">
            <DateInput id="job_date" label="Date" required value={form.job_date}
              onChange={(e) => set('job_date', e.target.value)} error={errors.job_date} />
            <div className="field">
              <label htmlFor="time_in" className="field-label">
                Time In <span className="field-auto-badge">auto</span>
              </label>
              <input
                id="time_in"
                className="field-input field-input--readonly"
                value={form.time_in}
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" className="field-input" value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ── 2. Customer ── */}
      <section className="form-section">
        <h2 className="form-section__title">Customer</h2>
        <div className="form-stack">
          <TextInput id="mobile" label="Mobile Number" required value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)} onBlur={handleMobileBlur}
            error={errors.mobile} inputMode="tel" />
          <TextInput id="full_name" label="Customer Name" required value={form.full_name}
            onChange={(e) => set('full_name', e.target.value)} error={errors.full_name} />
        </div>
      </section>

      {/* ── 3. Vehicle ── */}
      <section className="form-section">
        <h2 className="form-section__title">Vehicle</h2>
        <div className="form-stack">
          <TextInput id="plate_no" label="Plate Number" required value={form.plate_no}
            onChange={(e) => set('plate_no', e.target.value.toUpperCase())}
            onBlur={handlePlateBlur} error={errors.plate_no} />
          <div className="form-row-2">
            <TextInput id="make" label="Make" required value={form.make} onChange={(e) => set('make', e.target.value)} error={errors.make} />
            <TextInput id="model" label="Model" required value={form.model} onChange={(e) => set('model', e.target.value)} error={errors.model} />
          </div>
          <div className="form-row-2">
            <NumberInput id="year" label="Year" required value={form.year}
              onChange={(e) => set('year', e.target.value)} error={errors.year}
              min="1900" max={new Date().getFullYear() + 1} />
            <NumberInput id="current_km_reading" label="KM Reading" required value={form.current_km_reading}
              onChange={(e) => set('current_km_reading', e.target.value)} error={errors.current_km_reading} min="0" />
          </div>
          <div className="form-row-2">
            <TextInput id="tyre_size_front" label="Front Tyre Size" required value={form.tyre_size_front}
              onChange={(e) => set('tyre_size_front', e.target.value)} error={errors.tyre_size_front} />
            <TextInput id="tyre_size_rear" label="Rear Tyre Size" required value={form.tyre_size_rear}
              onChange={(e) => set('tyre_size_rear', e.target.value)} error={errors.tyre_size_rear} />
          </div>
          <TextInput id="spare_size" label="Spare Tyre Size" value={form.spare_size}
            onChange={(e) => set('spare_size', e.target.value)} />
        </div>
      </section>

      {/* ── 4. Work Carried Out ── */}
      <section className="form-section">
        <h2 className="form-section__title">Work Carried Out</h2>

        {loadingCatalog ? <Spinner /> : (
          <div className="service-tile-grid">
            {serviceCatalog.map((svc) => {
              const checked = selectedServices.has(svc.id)
              const hasDetail = DETAIL_SERVICES.includes(svc.name.toLowerCase())
              return (
                <button
                  key={svc.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={`service-tile ${checked ? 'service-tile--active' : ''} ${hasDetail ? 'service-tile--has-detail' : ''}`}
                  onClick={() => toggleService(svc.id)}
                >
                  <span className="service-tile__check">{checked ? '✓' : ''}</span>
                  <span className="service-tile__name">{svc.name}</span>
                  {hasDetail && <span className="service-tile__detail-hint">+ details</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Conditional detail panels */}
        {balancingSelected && (
          <div className="service-panel-wrap">
            <BalancingPanel
              initialRows={initialBalancing}
              onChange={(rows) => { balancingRowsRef.current = rows }}
              errors={serviceErrors.balancing ?? {}}
            />
          </div>
        )}

        {tyreRepairSelected && (
          <div className="service-panel-wrap">
            <TyreRepairPanel
              initialRows={initialTyreRepair}
              onChange={(rows) => { tyreRepairRowsRef.current = rows }}
              errors={serviceErrors.tyreRepair ?? {}}
            />
          </div>
        )}

        {mountingSelected && (
          <div className="service-panel-wrap">
            <MountingPanel
              initialData={initialMounting}
              onChange={(data) => { mountingDetailRef.current = data }}
              errors={serviceErrors.mounting ?? {}}
            />
          </div>
        )}
      </section>

      {/* ── 5. Completion ── */}
      <section className="form-section">
        <h2 className="form-section__title">Completion</h2>
        <div className="form-stack">
          <TextInput id="technician_name" label="Technician Name" required value={form.technician_name}
            onChange={(e) => set('technician_name', e.target.value)} error={errors.technician_name} />
          <TimeInput id="time_out" label="Time Out" value={form.time_out}
            onChange={(e) => set('time_out', e.target.value)} />
          <div className="field">
            <label htmlFor="notes" className="field-label">Notes <span className="field-label-hint">(optional)</span></label>
            <textarea id="notes" className="field-input field-textarea" rows={3}
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      </section>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
