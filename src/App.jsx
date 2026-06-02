import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OfflineProvider } from './context/OfflineContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import JobCardListPage from './pages/JobCardListPage'
import CreateJobCardPage from './pages/CreateJobCardPage'
import JobCardDetailPage from './pages/JobCardDetailPage'
import EditJobCardPage from './pages/EditJobCardPage'
import Spinner from './components/ui/Spinner'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page-loading"><Spinner size={48} /></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

/** Only staff can access this route; cashiers get redirected to job cards list */
function StaffOnlyRoute({ children }) {
  const { session, loading, isStaff } = useAuth()
  if (loading) return <div className="page-loading"><Spinner size={48} /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/job-cards" replace />
  return children
}

function PublicRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page-loading"><Spinner size={48} /></div>
  if (session) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="job-cards" element={<JobCardListPage />} />
        <Route path="job-cards/new" element={<StaffOnlyRoute><CreateJobCardPage /></StaffOnlyRoute>} />
        <Route path="job-cards/:id" element={<JobCardDetailPage />} />
        <Route path="job-cards/:id/edit" element={<StaffOnlyRoute><EditJobCardPage /></StaffOnlyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineProvider>
          <AppRoutes />
        </OfflineProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
