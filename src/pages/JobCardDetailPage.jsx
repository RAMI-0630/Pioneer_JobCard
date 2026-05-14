import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchJobCardById } from '../lib/queries'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'

export default function JobCardDetailPage() {
  const { id } = useParams()
  const [jc, setJc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchJobCardById(id)
      .then(setJc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-loading"><Spinner size={40} /></div>
  if (error) return <div className="page"><ErrorAlert message={error} /></div>
  if (!jc) return null

  const serviceLines   = (jc.job_card_service_lines ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const services       = serviceLines.map((sl) => sl.service_catalog?.name).filter(Boolean)

  const balancingLine  = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'balancing')
  const tyreRepairLine = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'tyre repair')
  const mountingLine   = serviceLines.find((sl) => sl.service_catalog?.name?.toLowerCase() === 'mounting')

  const balancingRows  = (balancingLine?.balancing_details ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const tyreRepairRows = (tyreRepairLine?.tyre_repair_details ?? []).sort((a, b) => a.sort_order - b.sort_order)
  const mountingDetail = mountingLine?.mounting_details?.[0] ?? null

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <Link to="/job-cards" className="back-link">← Job Cards</Link>
          <h1 className="page-title">Job Card #{jc.job_card_no}</h1>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--ghost" onClick={() => window.print()}>🖨 Print</button>
          <Link to={`/job-cards/${jc.id}/edit`} className="btn btn--primary">Edit Job Card</Link>
        </div>
      </div>

      <div className="detail-card print-area">
        {/* Header */}
        <div className="detail-header">
          <div>
            <h2 className="detail-header__title">Pioneer Workshop</h2>
            <p className="detail-header__subtitle">Job Card</p>
          </div>
          <div className="detail-header__meta">
            <div className="detail-meta-row">
              <span className="detail-meta-label">Job Card No</span>
              <span className="detail-meta-value mono">{jc.job_card_no}</span>
            </div>
            <div className="detail-meta-row">
              <span className="detail-meta-label">Date</span>
              <span className="detail-meta-value">{jc.job_date}</span>
            </div>
            <div className="detail-meta-row">
              <span className="detail-meta-label">Status</span>
              <StatusBadge status={jc.status} />
            </div>
          </div>
        </div>

        <div className="detail-body">
          {/* Customer */}
          <div className="detail-block">
            <h3 className="detail-block__title">Customer</h3>
            <div className="detail-row">
              <span className="detail-label">Name</span>
              <span className="detail-value">{jc.customers?.full_name ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mobile</span>
              <span className="detail-value">{jc.customers?.mobile ?? '—'}</span>
            </div>
          </div>

          {/* Vehicle */}
          <div className="detail-block">
            <h3 className="detail-block__title">Vehicle</h3>
            <div className="detail-row">
              <span className="detail-label">Plate Number</span>
              <span className="detail-value mono">{jc.vehicles?.plate_no ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Make</span>
              <span className="detail-value">{jc.vehicles?.make ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Model</span>
              <span className="detail-value">{jc.vehicles?.model ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Year</span>
              <span className="detail-value">{jc.vehicles?.year ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">KM Reading</span>
              <span className="detail-value">{jc.vehicles?.current_km_reading ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Tyre Front</span>
              <span className="detail-value">{jc.vehicles?.tyre_size_front ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Tyre Rear</span>
              <span className="detail-value">{jc.vehicles?.tyre_size_rear ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Spare Size</span>
              <span className="detail-value">{jc.vehicles?.spare_size ?? '—'}</span>
            </div>
          </div>

          {/* Services */}
          <div className="detail-block">
            <h3 className="detail-block__title">Work Carried Out</h3>
            {services.length === 0 ? (
              <p className="muted">No services recorded.</p>
            ) : (
              <ul className="service-list">
                {serviceLines.map((sl) => (
                  <li key={sl.id} className="service-list__item">
                    ✓ {sl.service_catalog?.name}
                    {sl.quantity > 1 && (
                      <span className="service-list__qty"> × {sl.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Balancing detail */}
            {balancingRows.length > 0 && (
              <div className="detail-sub-table-wrap">
                <p className="detail-sub-table-title">Balancing Detail</p>
                <table className="detail-sub-table">
                  <thead>
                    <tr><th>Position</th><th>Grams Used</th></tr>
                  </thead>
                  <tbody>
                    {balancingRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="badge badge--closed">{r.tyre_position}</span></td>
                        <td>{r.grams_used} g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tyre repair detail */}
            {tyreRepairRows.length > 0 && (
              <div className="detail-sub-table-wrap">
                <p className="detail-sub-table-title">Tyre Repair Detail</p>
                <table className="detail-sub-table">
                  <thead>
                    <tr><th>Position</th><th>Patch Type</th><th>Patches</th></tr>
                  </thead>
                  <tbody>
                    {tyreRepairRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="badge badge--closed">{r.tyre_position}</span></td>
                        <td>{r.patch_type}</td>
                        <td>{r.patch_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mounting detail */}
            {mountingDetail && (
              <div className="detail-sub-table-wrap">
                <p className="detail-sub-table-title">Mounting Detail</p>
                <table className="detail-sub-table">
                  <thead>
                    <tr><th>Number of Tyres</th><th>Tyre Size</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{mountingDetail.number_of_tyres}</td>
                      <td>{mountingDetail.tyre_type}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Completion */}
          <div className="detail-block">
            <h3 className="detail-block__title">Completion</h3>
            <div className="detail-row">
              <span className="detail-label">Technician</span>
              <span className="detail-value">{jc.technician_name ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Time In</span>
              <span className="detail-value">{jc.time_in ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Time Out</span>
              <span className="detail-value">{jc.time_out ?? '—'}</span>
            </div>
            {jc.notes && (
              <div className="detail-row detail-row--full">
                <span className="detail-label">Notes</span>
                <span className="detail-value">{jc.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="detail-footer no-print">
          <span className="muted">Created: {new Date(jc.created_at).toLocaleString()}</span>
          {jc.updated_at && (
            <span className="muted">Updated: {new Date(jc.updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
