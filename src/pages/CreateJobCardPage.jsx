import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'
import JobCardForm from '../components/JobCardForm'
import Spinner from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import {
  fetchNextJobCardNo,
  findCustomerByMobile,
  createCustomer,
  findVehicleByPlate,
  createVehicle,
  createJobCard,
  replaceServiceLines,
} from '../lib/queries'
import { enqueue } from '../lib/offlineQueue'

export default function CreateJobCardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline, refreshPendingCount } = useOffline()
  const [nextNo, setNextNo] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isOnline) {
      setNextNo('---')
      return
    }
    // Only fetch if we don't already have a number (don't re-fetch if connectivity toggles)
    if (nextNo !== null) return
    fetchNextJobCardNo().then(setNextNo).catch((e) => setLoadError(e.message))
  }, [isOnline])

  async function handleSubmit(form, selectedServiceIds, balancingRows, tyreRepairRows, serviceCatalog, mountingDetail, serviceQuantities) {
    // Offline path — Req 3.1, 3.2, 3.3, 3.4
    if (!isOnline) {
      const localId = `local-${crypto.randomUUID()}`
      await enqueue('CREATE', localId, {
        form,
        selectedServiceIds,
        balancingRows,
        tyreRepairRows,
        mountingDetail,
        serviceCatalog,
        serviceQuantities,
      })
      await refreshPendingCount()
      navigate('/job-cards')
      return
    }

    // Online path
    let customer = await findCustomerByMobile(form.mobile)
    if (!customer) customer = await createCustomer({ full_name: form.full_name, mobile: form.mobile })

    let vehicle = await findVehicleByPlate(form.plate_no)
    if (!vehicle) {
      vehicle = await createVehicle({
        customer_id: customer.id,
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

    const jobCard = await createJobCard({
      job_card_no: form.job_card_no,
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      job_date: form.job_date,
      time_in: form.time_in || null,
      time_out: form.time_out || null,
      technician_name: form.technician_name || null,
      status: form.status,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    })

    const serviceLines = buildServiceLines(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog, serviceQuantities)
    await replaceServiceLines(jobCard.id, serviceLines)

    navigate(`/job-cards/${jobCard.id}`)
  }

  if (loadError) return <div className="page"><ErrorAlert message={loadError} /></div>
  if (nextNo === null) return <div className="page-loading"><Spinner size={40} /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">New Job Card</h1>
      </div>
      <JobCardForm nextJobCardNo={nextNo} onSubmit={handleSubmit} submitLabel="Save Job Card" />
    </div>
  )
}

function buildServiceLines(selectedServiceIds, balancingRows, tyreRepairRows, mountingDetail, serviceCatalog, serviceQuantities = {}) {
  return selectedServiceIds.map((id) => {
    const svc  = serviceCatalog.find((s) => s.id === id)
    const name = svc?.name?.toLowerCase() ?? ''

    if (name === 'balancing' && balancingRows.length)
      return { service_catalog_id: id, quantity: balancingRows.length, balancingRows }

    if (name === 'tyre repair' && tyreRepairRows.length)
      return { service_catalog_id: id, quantity: tyreRepairRows.length, tyreRepairRows }

    if (name === 'mounting' && mountingDetail)
      return { service_catalog_id: id, quantity: Number(mountingDetail.number_of_tyres) || 1, mountingDetail }

    // Use serviceQuantities for qty services (e.g. Tyre Valve), default to 1
    const qty = Math.max(1, parseInt(serviceQuantities[id] ?? '1', 10) || 1)
    return { service_catalog_id: id, quantity: qty }
  })
}
