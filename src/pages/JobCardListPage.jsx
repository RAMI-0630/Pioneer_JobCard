import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchJobCards } from '../lib/queries'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'
import EmptyState from '../components/ui/EmptyState'

const PAGE_SIZE = 20
const STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']

export default function JobCardListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    jobCardNo:    searchParams.get('jobCardNo')    || '',
    plateNo:      searchParams.get('plateNo')      || '',
    customerName: searchParams.get('customerName') || '',
    mobile:       searchParams.get('mobile')       || '',
    dateFrom:     searchParams.get('dateFrom')     || '',
    dateTo:       searchParams.get('dateTo')       || '',
    status:       searchParams.get('status')       || '',
    q:            searchParams.get('q')            || '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runSearch = useCallback(async (f, p) => {
    setLoading(true)
    setError('')
    try {
      const q = f.q.trim()
      const { data, count } = await searchJobCards({
        // When quick-search (q) is active, pass it to all three client-side fields
        // so any match on job_card_no, plate, or mobile returns a result
        jobCardNo:    q || f.jobCardNo,
        plateNo:      q || f.plateNo,
        customerName: q ? '' : f.customerName,
        mobile:       q || f.mobile,
        dateFrom:     f.dateFrom,
        dateTo:       f.dateTo,
        status:       f.status,
        page: p,
        pageSize: PAGE_SIZE,
      })
      setResults(data)
      setTotal(count ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { runSearch(filters, page) }, [filters, page, runSearch])

  function set(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  function handleReset() {
    const empty = { jobCardNo: '', plateNo: '', customerName: '', mobile: '', dateFrom: '', dateTo: '', status: '', q: '' }
    setFilters(empty)
    setPage(1)
    setSearchParams({})
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Job Cards</h1>
        <Link to="/job-cards/new" className="btn btn--primary">+ New</Link>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {/* Quick search bar */}
      <div className="filter-bar">
        <div className="quick-search-row">
          <input
            className="field-input"
            type="text"
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Search by plate, mobile, job card no…"
            aria-label="Quick search"
          />
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            {showFilters ? 'Less ▲' : 'Filters ▼'}
          </button>
        </div>

        {/* Advanced filters — hidden by default */}
        {showFilters && (
          <div className="filter-grid">
            <div className="field">
              <label htmlFor="f-jobCardNo" className="field-label">Job Card No</label>
              <input id="f-jobCardNo" className="field-input" value={filters.jobCardNo}
                onChange={(e) => set('jobCardNo', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-plateNo" className="field-label">Plate Number</label>
              <input id="f-plateNo" className="field-input" value={filters.plateNo}
                onChange={(e) => set('plateNo', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-customerName" className="field-label">Customer Name</label>
              <input id="f-customerName" className="field-input" value={filters.customerName}
                onChange={(e) => set('customerName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-mobile" className="field-label">Mobile</label>
              <input id="f-mobile" className="field-input" value={filters.mobile}
                onChange={(e) => set('mobile', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-dateFrom" className="field-label">Date From</label>
              <input id="f-dateFrom" type="date" className="field-input" value={filters.dateFrom}
                onChange={(e) => set('dateFrom', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-dateTo" className="field-label">Date To</label>
              <input id="f-dateTo" type="date" className="field-input" value={filters.dateTo}
                onChange={(e) => set('dateTo', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-status" className="field-label">Status</label>
              <select id="f-status" className="field-input" value={filters.status}
                onChange={(e) => set('status', e.target.value)}>
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {(filters.q || filters.jobCardNo || filters.plateNo || filters.customerName || filters.mobile || filters.dateFrom || filters.dateTo || filters.status) && (
          <button className="btn btn--ghost btn--sm" onClick={handleReset} style={{ alignSelf: 'flex-start' }}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="page-loading"><Spinner size={40} /></div>
      ) : results.length === 0 ? (
        <EmptyState title="No job cards found" message="Try a different search or create a new job card." />
      ) : (
        <>
          <p className="results-count">{total} record{total !== 1 ? 's' : ''}</p>

          {/* Card list — works great on mobile and desktop */}
          <div className="jc-card-list">
            {results.map((jc) => (
              <div key={jc.id} className="jc-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="jc-card__top">
                    <span className="jc-card__no">#{jc.job_card_no}</span>
                    <StatusBadge status={jc.status} />
                  </div>
                  <div className="jc-card__row" style={{ marginTop: '0.25rem' }}>
                    <span className="jc-card__name">{jc.customers?.full_name ?? '—'}</span>
                    <span className="muted">·</span>
                    <span className="mono">{jc.vehicles?.plate_no ?? '—'}</span>
                    {jc.customers?.mobile && (
                      <>
                        <span className="muted">·</span>
                        <span className="muted">{jc.customers.mobile}</span>
                      </>
                    )}
                  </div>
                  <div className="jc-card__row" style={{ marginTop: '0.125rem' }}>
                    <span className="jc-card__meta">{jc.job_date}</span>
                    {jc.technician_name && (
                      <>
                        <span className="muted">·</span>
                        <span className="jc-card__meta">{jc.technician_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flexShrink: 0 }}>
                  <Link to={`/job-cards/${jc.id}`} className="btn btn--ghost btn--sm">View</Link>
                  <Link to={`/job-cards/${jc.id}/edit`} className="btn btn--ghost btn--sm">Edit</Link>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn--ghost btn--sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <span className="pagination__info">{page} / {totalPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
