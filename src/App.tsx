import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth'
import { homePath } from './nav'
import CompanionPanel from './pages/CompanionPanel'
import Landing from './pages/Landing'
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import SocialCallback from './pages/SocialCallback'
import Dashboard from './pages/prof/Dashboard'
import NewAssignment from './pages/prof/NewAssignment'
import SetupLayout from './pages/prof/setup/SetupLayout'
import { CompetenciesPage, MaterialsPage, PublishPage, RulesPage, TaskPage as SetupTaskPage, TestsPage, ToolsPage } from './pages/prof/setup/SetupPages'
import { StatusLayout, StatusLearning, StatusOverview, StatusPost, StatusPre, StatusStudents, StatusTask } from './pages/prof/status/StatusPages'
import StudentLayout from './pages/prof/student/StudentLayout'
import { ConversationTab, LearningTab, OverviewTab, TaskTab, TestsTab } from './pages/prof/student/StudentTabs'
import ChatPopout from './pages/stu/ChatPopout'
import EnrollmentLayout from './pages/stu/EnrollmentLayout'
import EnrollmentOverview from './pages/stu/EnrollmentOverview'
import ResultSummary from './pages/stu/ResultSummary'
import { LearningPage, PostPage, PrePage, TaskPage } from './pages/stu/StagePages'
import StudentHome from './pages/stu/StudentHome'
import { AssignmentShell, ProfHomeShell, PublicFrame, StuHomeShell } from './shells'
import { Loading } from './ui'

export { APP_NAME, homePath } from './nav'

// 첫 주소. 로그인한 사람은 역할별 홈으로 보내고, 아니면 소개 화면을 보여 준다.
function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Navigate to={homePath(user.role)} replace /> : <Landing />
}

function RequireRole({ role, children }: { role: 'professor' | 'student'; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage initialMode="login" />} />
      <Route path="/signup" element={<LoginPage initialMode="signup" />} />
      <Route path="/login/social" element={<SocialCallback />} />
      <Route
        path="/privacy"
        element={
          <PublicFrame>
            <Privacy />
          </PublicFrame>
        }
      />

      {/* 팀원이 만든 과제 단계의 별도 창. 예전 스타일을 그대로 쓰도록 legacy 영역으로 감싼다. */}
      <Route
        path="/companion-panel/:eid"
        element={
          <div className="legacy legacy-page">
            <CompanionPanel />
          </div>
        }
      />
      <Route
        path="/stu/enrollments/:eid/chat"
        element={
          <div className="legacy legacy-page">
            <ChatPopout />
          </div>
        }
      />

      <Route
        path="/prof"
        element={
          <RequireRole role="professor">
            <ProfHomeShell />
          </RequireRole>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="assignments/new" element={<NewAssignment />} />
      </Route>

      <Route
        path="/prof/assignments/:id"
        element={
          <RequireRole role="professor">
            <AssignmentShell />
          </RequireRole>
        }
      >
        {/* 과제 현황. 반 전체 지표를 단계별 하위 페이지로 나눈다. */}
        <Route element={<StatusLayout />}>
          <Route index element={<StatusOverview />} />
          <Route path="pre" element={<StatusPre />} />
          <Route path="learning" element={<StatusLearning />} />
          <Route path="task" element={<StatusTask />} />
          <Route path="post" element={<StatusPost />} />
          <Route path="students" element={<StatusStudents />} />
        </Route>
        {/* 학생 한 명의 기록 */}
        <Route path="students/:eid" element={<StudentLayout />}>
          <Route index element={<OverviewTab />} />
          <Route path="tests" element={<TestsTab />} />
          <Route path="learning" element={<LearningTab />} />
          <Route path="task" element={<TaskTab />} />
          <Route path="conversation" element={<ConversationTab />} />
        </Route>
        {/* 과제 설정 일곱 구역 */}
        <Route path="setup" element={<SetupLayout />}>
          <Route index element={<Navigate to="competencies" replace />} />
          <Route path="competencies" element={<CompetenciesPage />} />
          <Route path="tests" element={<TestsPage />} />
          <Route path="task" element={<SetupTaskPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="publish" element={<PublishPage />} />
        </Route>
      </Route>

      <Route
        path="/stu"
        element={
          <RequireRole role="student">
            <StuHomeShell />
          </RequireRole>
        }
      >
        <Route index element={<StudentHome />} />
      </Route>

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
        <Route path="result" element={<ResultSummary />} />
      </Route>

      <Route
        path="*"
        element={
          <PublicFrame>
            <NotFound />
          </PublicFrame>
        }
      />
    </Routes>
  )
}
