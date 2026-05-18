import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  fetchJobCardById,
  updateJobCard,
  updateVehicle,
  updateCustomer,
  replaceServiceLines,
} from '../lib/queries'
import * as offlineQueue from '../lib/offlineQueue'
import { useOffline } from '../context/OfflineContext'
import JobCardForm from '../components/JobCardForm'
import Spinner from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export default function EditJobCardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isOnline, refreshPendingCount } = useOffline()
  const [jc, setJc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // 6.5 — Req 4.1: load draft from IndexedDB for local- prefixed ids
  useEffect(() => {
    if (id.startsWith('local-')) {
      offlineQueue.getByLocalId(id)
        .then((item) => {
          if (item) setJc(buildJcFromPayload(item.payload))
          else setError('Draft not found')
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    } else {
      fetchJobCardById(id)
        .then(setJc)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id])

  async function handleSubmit(form, selectedServiceIds, balancingRows, tyreRepairRows, serviceCatalog, mountingDetail) {
    // 6.4 — Offline path (Req 4.2, 4.3, 4.4)
    if (!isOnline) {
      const payload = { form, selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog }
      if (id.startsWith('local-')) {
        // Req 4.2: update the existing draft in the queue
        const queueItem = await offlineQueue.getByLocalId(id)
        if (queueItem) {
          await offlineQueue.updateItem(queueItem.id, { payload })
        }
      } else {
        // Req 4.3: enqueue an EDIT for a real Supabase UUID
        await offlineQueue.enqueue('EDIT', id, payload)
      }
      await refreshPendingCount()
      // Req 4.4: show "Changes saved locally" toast via local state
      setSavedMsg('Changes saved locally')
      setTimeout(() => setSavedMsg(''), 3000)
      navigate('/job-cards')
      return
    }

    // Online path — unchanged (Req 4.5)
    if (jc.customers?.id) {
      await updateCustomer(jc.customers.id, { full_name: form.full_name, mobile: form.mobile })
    }
    if (jc.vehicles?.id) {
      await updateVehicle(jc.vehicles.id, {
        plate_no: form.plate_no,
        make: form.make || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
        current_km_reading: form.current_km_reading ? Number(form.current_km_reading) : null,
        tyre_size_front: form.tyre_size_front || null,
        tyre_size_rear: form.tyre_size_rear || null,
        spare_size: form.spare_size || null,
      })
    }
    await updateJobCard(id, {
      job_card_no: form.job_card_no,
      job_date: form.job_date,
      time_in: form.time_in || null,
      time_out: form.time_out || null,
      technician_name: form.technician_name || null,
      status: form.status,
      notes: form.notes || null,
    })

    const serviceLines = buildServiceLines(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog)
    console.log('[EditJobCard] selectedServiceIds at submit:', selectedServiceIds)
    console.log('[EditJobCard] built serviceLines:', serviceLines.map(s => s.service_catalog_id))
    await replaceServiceLines(id, serviceLines)

    navigate(`/job-cards/${id}`)
  }

  async function handleClose() {
    const timeOut = new Date().toTimeString().slice(0, 5)
    await updateJobCard(id, { time_out: timeOut, status: 'CLOSED' })
    setShowCloseDialog(false)
    navigate(`/job-cards/${id}`)
  }

  if (loading) return <div className="page-loading"><Spinner size={40} /></div>
  if (error)   return <div className="page"><ErrorAlert message={error} /></div>
  if (!jc)     return null

  const initialValues = {
    job_card_no: jc.job_card_no ?? '',
    job_date: jc.job_date ?? '',
    time_in: jc.time_in ?? '',
    time_out: jc.time_out ?? '',
    status: jc.status ?? 'OPEN',
    full_name: jc.customers?.full_name ?? '',
    mobile: jc.customers?.mobile ?? '',
    plate_no: jc.vehicles?.plate_no ?? '',
    make: jc.vehicles?.make ?? '',
    model: jc.vehicles?.model ?? '',
    year: jc.vehicles?.year ? String(jc.vehicles.year) : '',
    current_km_reading: jc.vehicles?.current_km_reading ? String(jc.vehicles.current_km_reading) : '',
    tyre_size_front: jc.vehicles?.tyre_size_front ?? '',
    tyre_size_rear: jc.vehicles?.tyre_size_rear ?? '',
    spare_size: jc.vehicles?.spare_size ?? '',
    technician_name: jc.technician_name ?? '',
    notes: jc.notes ?? '',
  }

  // Reconstruct selected service ids and detail rows from service lines
  const serviceLines = (jc.job_card_service_lines ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const initialServices = serviceLines.map((sl) => sl.service_catalog?.id).filter(Boolean)

  const balancingLine   = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'balancing')
  const tyreRepairLine  = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'tyre repair')
  const mountingLine    = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'mounting')

  const initialBalancing  = (balancingLine?.balancing_details ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const initialTyreRepair = (tyreRepairLine?.tyre_repair_details ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const initialMounting   = mountingLine?.mounting_details?.[0]
    ? { number_of_tyres: String(mountingLine.mounting_details[0].number_of_tyres), tyre_type: mountingLine.mounting_details[0].tyre_type }
    : {}

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to={`/job-cards/${id}`} className="back-link">← Back</Link>
          <h1 className="page-title">Edit #{jc.job_card_no}</h1>
        </div>
      </div>

      {/* Req 4.4: "Changes saved locally" toast */}
      {savedMsg && (
        <div role="status" style={{ marginBottom: '0.75rem', padding: '0.5rem 1rem', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
          ✅ {savedMsg}
        </div>
      )}

      <JobCardForm
        initialValues={initialValues}
        initialServices={initialServices}
        initialBalancing={initialBalancing}
        initialTyreRepair={initialTyreRepair}
        initialMounting={initialMounting}
        onSubmit={handleSubmit}
        submitLabel="Update Job Card"
        isEdit
      />

      {jc.status !== 'CLOSED' && (
        <div style={{ paddingBottom: '1rem' }}>
          <button className="btn btn--danger btn--full btn--lg" onClick={() => setShowCloseDialog(true)}>
            ✓ Close Job Card
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showCloseDialog}
        title="Close Job Card"
        message="This will record the time out as now and mark the job as CLOSED."
        confirmLabel="Yes, Close It"
        onConfirm={handleClose}
        onCancel={() => setShowCloseDialog(false)}
      />
    </div>
  )
}

function buildServiceLines(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog) {
  return selectedServiceIds.map((id) => {
    const svc  = serviceCatalog.find((s) => s.id === id)
    const name = svc?.name?.toLowerCase() ?? ''

    if (name === 'balancing' && balancingRows.length)
      return { service_catalog_id: id, quantity: balancingRows.length, balancingRows }

    if (name === 'tyre repair' && tyreRepairRows.length)
      return { service_catalog_id: id, quantity: tyreRepairRows.length, tyreRepairRows }

    if (name === 'mounting' && mountingDetail)
      return { service_catalog_id: id, quantity: Number(mountingDetail.number_of_tyres) || 1, mountingDetail }

    return { service_catalog_id: id, quantity: 1 }
  })
}

/**
 * Reconstruct a synthetic jc object from an offline queue payload so that
 * the form's initialValues and service-line reconstruction work correctly.
 * Used when loading a local- prefixed draft (Req 4.1).
 */
function buildJcFromPayload(payload) {
  const { form, selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog } = payload
  return {
    ...form,
    customers: { full_name: form.full_name, mobile: form.mobile },
    vehicles: {
      plate_no: form.plate_no,
      make: form.make,
      model: form.model,
      year: form.year ? Number(form.year) : null,
      current_km_reading: form.current_km_reading ? Number(form.current_km_reading) : null,
      tyre_size_front: form.tyre_size_front,
      tyre_size_rear: form.tyre_size_rear,
      spare_size: form.spare_size,
    },
    job_card_service_lines: buildServiceLinesForDisplay(
      selectedServiceIds,
      balancingRows,
      tyreRepairRows,
      mountingDetail,
      serviceCatalog,
    ),
  }
}

/**
 * Reconstruct service lines in the shape that EditJobCardPage expects
 * (with service_catalog, balancing_details, tyre_repair_details, mounting_details).
 */
function buildServiceLinesForDisplay(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog) {
  return selectedServiceIds.map((id, i) => {
    const svc  = serviceCatalog.find((s) => s.id === id)
    const name = svc?.name?.toLowerCase() ?? ''
    return {
      id: `local-line-${i}`,
      sort_order: i,
      service_catalog: svc ?? { id, name: '' },
      balancing_details:   name === 'balancing'   ? balancingRows  : [],
      tyre_repair_details: name === 'tyre repair' ? tyreRepairRows : [],
      mounting_details:    name === 'mounting' && mountingDetail ? [mountingDetail] : [],
    }
  })
}
