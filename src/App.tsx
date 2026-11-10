import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import CompanionPanel from './pages/CompanionPanel'
import Landing from './pages/Landing'
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import AssignmentOverview from './pages/prof/AssignmentOverview'
import Dashboard from './pages/prof/Dashboard'
import NewAssignment from './pages/prof/NewAssignment'
import SetupLayout from './pages/prof/setup/SetupLayout'
import { CompetenciesPage, MaterialsPage, PublishPage, RulesPage, TaskPage as SetupTaskPage, TestsPage, ToolsPage } from './pages/prof/setup/SetupPages'
import StudentLayout from './pages/prof/student/StudentLayout'
import { ConversationTab, LearningTab, OverviewTab, TaskTab, TestsTab } from './pages/prof/student/StudentTabs'
import ChatPopout from './pages/stu/ChatPopout'
import EnrollmentLayout from './pages/stu/EnrollmentLayout'
import EnrollmentOverview from './pages/stu/EnrollmentOverview'
import ResultSummary from './pages/stu/ResultSummary'
import { LearningPage, PostPage, PrePage, TaskPage } from './pages/stu/StagePages'
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
        {user ? (
          <div className="topbar-user">
            <Link to={user.role === 'professor' ? '/prof' : '/stu'} className="small">
              {user.role === 'professor' ? '대시보드' : '내 과제'}
            </Link>
            <span className={`role-chip role-${user.role}`}>{user.role === 'professor' ? '교수' : '학생'}</span>
            <span>{user.name}</span>
            <button className="btn btn-ghost" onClick={logout}>
              로그아웃
            </button>
          </div>
        ) : (
          <div className="topbar-user">
            <Link className="btn btn-ghost" to="/login">
              로그인
            </Link>
            <Link className="btn btn-secondary" to="/signup">
              회원가입
            </Link>
          </div>
        )}
      </header>
      <main className="content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <footer className="footer">
        <span>{APP_NAME}, AI 우왕톤 40팀 우왕우왕</span>
        <Link to="/privacy">개인정보와 기록 범위 안내</Link>
      </footer>
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
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<LoginPage initialMode="login" />} />
              <Route path="/signup" element={<LoginPage initialMode="signup" />} />
              <Route path="/privacy" element={<Privacy />} />

              <Route
                path="/prof"
                element={
                  <RequireRole role="professor">
                    <Dashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/prof/assignments/new"
                element={
                  <RequireRole role="professor">
                    <NewAssignment />
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
                path="/prof/assignments/:id/setup"
                element={
                  <RequireRole role="professor">
                    <SetupLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Navigate to="competencies" replace />} />
                <Route path="competencies" element={<CompetenciesPage />} />
                <Route path="tests" element={<TestsPage />} />
                <Route path="task" element={<SetupTaskPage />} />
                <Route path="materials" element={<MaterialsPage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="publish" element={<PublishPage />} />
              </Route>
              <Route
                path="/prof/assignments/:id/students/:eid"
                element={
                  <RequireRole role="professor">
                    <StudentLayout />
                  </RequireRole>
                }
              >
                <Route index element={<OverviewTab />} />
                <Route path="tests" element={<TestsTab />} />
                <Route path="learning" element={<LearningTab />} />
                <Route path="task" element={<TaskTab />} />
                <Route path="conversation" element={<ConversationTab />} />
              </Route>

              <Route
                path="/stu"
                element={
                  <RequireRole role="student">
                    <StudentHome />
                  </RequireRole>
                }
              />
              <Route
                path="/stu/enrollments/:eid/result"
                element={
                  <RequireRole role="student">
                    <ResultSummary />
                  </RequireRole>
                }
              />
              <Route
                path="/stu/enrollments/:eid"
                element={
                  <RequireRole role="student">
                    <EnrollmentLayout />
                  </RequireRole>
                }
              >
                <Route index element={<EnrollmentOverview />} />
                <Route path="pre" element={<PrePage />} />
                <Route path="learning" element={<LearningPage />} />
                <Route path="task" element={<TaskPage />} />
                <Route path="post" element={<PostPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  )
}
