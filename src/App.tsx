import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth'
import CompanionPanel from './pages/CompanionPanel'
import LoginPage from './pages/LoginPage'
import AssignmentList from './pages/prof/AssignmentList'
import AssignmentOverview from './pages/prof/AssignmentOverview'
import AssignmentSetup from './pages/prof/AssignmentSetup'
import StudentDetail from './pages/prof/StudentDetail'
import ChatPopout from './pages/stu/ChatPopout'
import EnrollmentPage from './pages/stu/EnrollmentPage'
import StudentHome from './pages/stu/StudentHome'

export const APP_NAME = '학습 도우미'

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          {APP_NAME}
          <span className="brand-sub">서비스 이름 미정</span>
        </Link>
        {user && (
          <div className="topbar-user">
            <span className={`role-chip role-${user.role}`}>{user.role === 'professor' ? '교수' : '학생'}</span>
            <span>{user.name}</span>
            <button className="btn btn-ghost" onClick={logout}>
              로그아웃
            </button>
          </div>
        )}
      </header>
      <main className="content">{children}</main>
    </div>
  )
}

function RequireRole({ role, children }: { role: 'professor' | 'student'; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="muted">불러오는 중</p>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">불러오는 중</p>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'professor' ? '/prof' : '/stu'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/companion-panel/:eid" element={<CompanionPanel />} />
      <Route path="/stu/enrollments/:eid/chat" element={<ChatPopout />} />
      <Route
        path="*"
        element={
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/prof"
                element={
                  <RequireRole role="professor">
                    <AssignmentList />
                  </RequireRole>
                }
              />
              <Route
                path="/prof/assignments/:id/setup"
                element={
                  <RequireRole role="professor">
                    <AssignmentSetup />
                  </RequireRole>
                }
              />
              <Route
                path="/prof/assignments/:id"
                element={
                  <RequireRole role="professor">
                    <AssignmentOverview />
                  </RequireRole>
                }
              />
              <Route
                path="/prof/assignments/:id/students/:eid"
                element={
                  <RequireRole role="professor">
                    <StudentDetail />
                  </RequireRole>
                }
              />
              <Route
                path="/stu"
                element={
                  <RequireRole role="student">
                    <StudentHome />
                  </RequireRole>
                }
              />
              <Route
                path="/stu/enrollments/:eid"
                element={
                  <RequireRole role="student">
                    <EnrollmentPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  )
}
