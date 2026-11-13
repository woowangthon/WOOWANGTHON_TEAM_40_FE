import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import { homePath } from './nav'
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import SocialCallback from './pages/SocialCallback'
import EnrollmentLayout from './pages/stu/EnrollmentLayout'
import EnrollmentOverview from './pages/stu/EnrollmentOverview'
import ResultSummary from './pages/stu/ResultSummary'
import { LearningPage, PostPage, PrePage, TaskPage } from './pages/stu/StagePages'
import StudentHome from './pages/stu/StudentHome'
import { AssignmentShell, ProfHomeShell, PublicFrame, StuHomeShell } from './shells'
import { Loading } from './ui'

// 소개 화면과 교수 화면은 처음부터 받지 않고 그 화면을 열 때 받는다. 작업공간은 pages/stu/StagePages.tsx 에서 같은 방식으로 받는다.
const Landing = lazy(() => import('./pages/Landing'))

// 교수 화면은 파일 하나로 묶여 있어 어느 화면을 먼저 열든 한 번만 받는다.
const profPages = () => import('./pages/prof/pages')
type ProfPages = Awaited<ReturnType<typeof profPages>>
const prof = (name: keyof ProfPages) => lazy(() => profPages().then((m) => ({ default: m[name] as ComponentType })))

const Dashboard = prof('Dashboard')
const NewAssignment = prof('NewAssignment')
const SetupLayout = prof('SetupLayout')
const CompetenciesPage = prof('CompetenciesPage')
const TestsPage = prof('TestsPage')
const SetupTaskPage = prof('SetupTaskPage')
const MaterialsPage = prof('MaterialsPage')
const RulesPage = prof('RulesPage')
const ToolsPage = prof('ToolsPage')
const PublishPage = prof('PublishPage')
const StatusLayout = prof('StatusLayout')
const StatusOverview = prof('StatusOverview')
const StatusPre = prof('StatusPre')
const StatusLearning = prof('StatusLearning')
const StatusTask = prof('StatusTask')
const StatusPost = prof('StatusPost')
const StatusStudents = prof('StatusStudents')
const StudentLayout = prof('StudentLayout')
const OverviewTab = prof('OverviewTab')
const TestsTab = prof('TestsTab')
const LearningTab = prof('LearningTab')
const TaskTab = prof('TaskTab')
const ConversationTab = prof('ConversationTab')

// 첫 주소. 로그인한 사람은 역할별 홈으로 보내고, 아니면 소개 화면을 보여 준다.
function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to={homePath(user.role)} replace />
  return (
    <Suspense fallback={<Loading />}>
      <Landing />
    </Suspense>
  )
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
  const { pathname } = useLocation()
  return (
    // 뼈대 밖에서 난 예외와 화면 파일을 받지 못한 경우를 여기서 받는다. 주소가 바뀌면 오류 화면을 걷는다.
    <ErrorBoundary resetKey={pathname}>
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
    </ErrorBoundary>
  )
}
