import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SyncStatusBar from '../ui/SyncStatusBar'

export default function AppLayout() {
  const { user, signOut, isStaff, isCashier } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <svg className="topbar__logo" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="topbar__title">Pioneer Job Cards</span>
        </div>

        <nav className="topbar__nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/job-cards" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
            Job Cards
          </NavLink>
          {isStaff && (
            <NavLink to="/job-cards/new" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
              + New Job Card
            </NavLink>
          )}
        </nav>

        <div className="topbar__user">
          {isCashier && (
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 700, letterSpacing: '0.04em' }}>
              CASHIER
            </span>
          )}
          <span className="topbar__email">{user?.email}</span>
          <button className="btn btn--ghost-white btn--sm" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="main-content">
        <SyncStatusBar />
        <Outlet />
      </main>
    </div>
  )
}
