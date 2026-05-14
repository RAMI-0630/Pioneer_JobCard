import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchDashboardStats, fetchRecentJobCards } from '../lib/queries'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import ErrorAlert from '../components/ui/ErrorAlert'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ openCount: 0, completedToday: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickSearch, setQuickSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([fetchDashboardStats(), fetchRecentJobCards(8)])
        setStats(s)
        setRecent(r)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleQuickSearch(e) {
    e.preventDefault()
    if (!quickSearch.trim()) return
    navigate(`/job-cards?q=${encodeURIComponent(quickSearch.trim())}`)
  }

  if (loading) return <div className="page-loading"><Spinner size={44} /></div>

  return (
    <div className="page">
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {/* Primary actions — the two things technicians do most */}
      <div className="dash-actions">
        <Link to="/job-cards/new" className="dash-action-btn dash-action-btn--primary">
          <span className="dash-action-btn__icon">＋</span>
          New Job Card
        </Link>
        <Link to="/job-cards" className="dash-action-btn">
          <span className="dash-action-btn__icon">🔍</span>
          Search Records
        </Link>
      </div>

      {/* Quick search */}
      <form onSubmit={handleQuickSearch} className="quick-search-form">
        <label htmlFor="quick-search" className="field-label">Quick Search</label>
        <div className="quick-search-row">
          <input
            id="quick-search"
            className="field-input"
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder="Plate number, mobile, or job card no…"
          />
          <button type="submit" className="btn btn--primary">Go</button>
        </div>
      </form>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card stat-card--blue">
          <span className="stat-card__value">{stats.openCount}</span>
          <span className="stat-card__label">Open Jobs</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-card__value">{stats.completedToday}</span>
          <span className="stat-card__label">Done Today</span>
        </div>
      </div>

      {/* Recent job cards */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Recent Job Cards</h2>
          <Link to="/job-cards" className="link">View all →</Link>
        </div>

        {recent.length === 0 ? (
          <p className="muted">No job cards yet.</p>
        ) : (
          <div className="jc-card-list">
            {recent.map((jc) => (
              <Link key={jc.id} to={`/job-cards/${jc.id}`} className="jc-card">
                <div className="jc-card__top">
                  <span className="jc-card__no">#{jc.job_card_no}</span>
                  <StatusBadge status={jc.status} />
                </div>
                <div className="jc-card__row">
                  <span className="jc-card__name">{jc.customers?.full_name ?? '—'}</span>
                  <span className="muted">·</span>
                  <span className="mono">{jc.vehicles?.plate_no ?? '—'}</span>
                </div>
                <span className="jc-card__meta">{jc.job_date}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
