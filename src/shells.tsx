// 화면의 뼈대. 왼쪽 사이드바는 본문과 같은 계열에서 한 단계 어두운 면이고, 그 안의 메뉴는 지금 있는 곳에 따라 바뀐다.
import { createContext, Suspense, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Archive, Check, ChevronLeft, CircleCheck, CirclePlay, CircleUser, Clock, Folder, Hash, Lock, LogOut, PencilLine, Send } from 'lucide-react'

import { api, type Assignment, type Dashboard, type EnrollmentBrief } from './api'
import { useAuth } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import { APP_NAME, sectionDone, setupNav, shownStatus, statusNav, type NavItem } from './nav'
import { Loading, Logo, Notice, ThemeToggle } from './ui'

const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'side-link active' : 'side-link')

// 사이드바 아래쪽. 기록 범위 안내와 계정과 로그아웃이 들어간다.
function SideFoot({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="side-foot">
      {children}
      <Link className="side-link" to="/privacy">
        <Lock aria-hidden="true" />
        기록 범위 안내
      </Link>
      <div className="account">
        <span>
          <CircleUser aria-hidden="true" />
          {user?.name}
        </span>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </div>
  )
}

// 본문. 예외가 나도 사이드바는 남기고, 다른 메뉴로 옮기면 오류 화면을 걷는다.
// 나누어 받는 화면 파일이 오는 동안에는 불러오는 중이라고 알린다.
function Main({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <main className="main">
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </ErrorBoundary>
    </main>
  )
}

function FilterLink({ label, to, active, count, icon: Icon }: { label: string; to: string; active: boolean; count: number; icon: LucideIcon }) {
  return (
    <Link to={to} className={active ? 'side-link active' : 'side-link'}>
      <Icon aria-hidden="true" />
      {label}
      <span className="count">{count}</span>
    </Link>
  )
}

// ---------- 교수 홈 ----------
interface ProfHomeCtx {
  data: Dashboard | null
  error: string | null
  reload: () => Promise<void>
}

const ProfHomeContext = createContext<ProfHomeCtx>({ data: null, error: null, reload: async () => {} })
export const useProfHome = () => useContext(ProfHomeContext)

export function ProfHomeShell() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sp] = useSearchParams()
  const status = sp.get('status') ?? ''
  const course = sp.get('course') ?? ''

  const reload = useCallback(
    () =>
      api.prof
        .dashboard()
        .then((d) => {
          setData(d)
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  const rows = data?.rows ?? []
  const courses = [...new Set(rows.map((r) => r.subject).filter(Boolean))]
  // 공개한 과제는 마감 시각이 지나면 마감으로 센다.
  const byStatus = (s: string) => rows.filter((r) => shownStatus(r) === s).length

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-head">
          <span className="brand">
            <Logo size={20} />
            {APP_NAME}
          </span>
          <ThemeToggle />
        </div>
        <nav className="side-group" aria-label="과제">
          <div className="side-label">과제</div>
          <FilterLink label="최근 과제" to="/prof" active={!status && !course} count={rows.length} icon={Clock} />
          <FilterLink label="공개 중" to="/prof?status=open" active={status === 'open'} count={byStatus('open')} icon={Send} />
          <FilterLink label="작성 중" to="/prof?status=draft" active={status === 'draft'} count={byStatus('draft')} icon={PencilLine} />
          <FilterLink label="마감" to="/prof?status=closed" active={status === 'closed'} count={byStatus('closed')} icon={Archive} />
        </nav>
        {courses.length > 0 && (
          <nav className="side-group" aria-label="과목">
            <div className="side-label">과목</div>
            {courses.map((c) => (
              <FilterLink key={c} label={c} to={`/prof?course=${encodeURIComponent(c)}`} active={course === c} count={rows.filter((r) => r.subject === c).length} icon={Folder} />
            ))}
          </nav>
        )}
        <SideFoot />
      </aside>
      <Main>
        <ProfHomeContext.Provider value={{ data, error, reload }}>
          <Outlet />
        </ProfHomeContext.Provider>
      </Main>
    </div>
  )
}

// ---------- 교수의 과제 하나 ----------
interface AssignmentShellCtx {
  assignment: Assignment
  setAssignment: (a: Assignment) => void
  reload: () => Promise<void>
}

const AssignmentShellContext = createContext<AssignmentShellCtx | null>(null)

// 과제 안의 모든 화면이 같은 과제 정보를 쓴다. 설정에서 저장한 뒤에는 setAssignment 나 reload 로 사이드바까지 갱신한다.
export function useAssignmentShell(): AssignmentShellCtx {
  const ctx = useContext(AssignmentShellContext)
  if (!ctx) throw new Error('AssignmentShell 밖에서 useAssignmentShell 을 썼다')
  return ctx
}

export function AssignmentShell() {
  const { id } = useParams()
  const aid = Number(id)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    () =>
      api.prof
        .get(aid)
        .then((a) => {
          setAssignment(a)
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [aid],
  )
  useEffect(() => {
    setAssignment(null)
    void reload()
  }, [reload])

  const base = `/prof/assignments/${aid}`
  const draft = assignment?.status === 'draft'
  const link = ([label, , Icon]: NavItem, to: string, end = false, done = false) => (
    <NavLink key={label} to={to} end={end} className={cls}>
      <Icon aria-hidden="true" />
      {label}
      {done && (
        <span className="count" aria-label="완료">
          <Check aria-hidden="true" />
        </span>
      )}
    </NavLink>
  )

  return (
    <div className="shell">
      <aside className="side">
        <Link className="side-link" to="/prof">
          <ChevronLeft aria-hidden="true" />
          과제 목록
        </Link>
        <div className="side-title">{assignment?.title ?? ''}</div>
        {assignment && !draft && (
          <nav className="side-group" aria-label="현황">
            <div className="side-label">현황</div>
            {statusNav.map((n) => link(n, n[1] ? `${base}/${n[1]}` : base, !n[1]))}
          </nav>
        )}
        {assignment && (
          <nav className="side-group" aria-label="설정">
            <div className="side-label">설정</div>
            {setupNav.map((n) => link(n, `${base}/setup/${n[1]}`, false, sectionDone(assignment, n[1]) === true))}
          </nav>
        )}
        <SideFoot>
          <div className="account">
            <span>화면 모드</span>
            <ThemeToggle />
          </div>
        </SideFoot>
      </aside>
      <Main>
        {error && !assignment ? (
          <div className="page">
            <Notice kind="error">{error}</Notice>
          </div>
        ) : !assignment ? (
          <Loading />
        ) : (
          <AssignmentShellContext.Provider value={{ assignment, setAssignment, reload }}>
            <Outlet />
          </AssignmentShellContext.Provider>
        )}
      </Main>
    </div>
  )
}

// ---------- 학생 홈 ----------
interface StuHomeCtx {
  rows: EnrollmentBrief[] | null
  error: string | null
  reload: () => Promise<void>
}

const StuHomeContext = createContext<StuHomeCtx>({ rows: null, error: null, reload: async () => {} })
export const useStuHome = () => useContext(StuHomeContext)

export function StuHomeShell() {
  const [rows, setRows] = useState<EnrollmentBrief[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const state = sp.get('state') ?? ''
  const course = sp.get('course') ?? ''

  const reload = useCallback(
    () =>
      api.stu
        .list()
        .then((r) => {
          setRows(r)
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setJoinError(null)
    try {
      const en = await api.stu.join(code.trim())
      navigate(`/stu/enrollments/${en.id}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : '참여하지 못했다')
    } finally {
      setBusy(false)
    }
  }

  const list = rows ?? []
  const courses = [...new Set(list.map((r) => r.subject).filter(Boolean))]
  const done = list.filter((r) => r.stage === 'done').length

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-head">
          <span className="brand">
            <Logo size={20} />
            {APP_NAME}
          </span>
          <ThemeToggle />
        </div>
        <nav className="side-group" aria-label="과제">
          <div className="side-label">과제</div>
          <FilterLink label="최근 과제" to="/stu" active={!state && !course} count={list.length} icon={Clock} />
          <FilterLink label="진행 중" to="/stu?state=active" active={state === 'active'} count={list.length - done} icon={CirclePlay} />
          <FilterLink label="완료" to="/stu?state=done" active={state === 'done'} count={done} icon={CircleCheck} />
        </nav>
        {courses.length > 0 && (
          <nav className="side-group" aria-label="과목">
            <div className="side-label">과목</div>
            {courses.map((c) => (
              <FilterLink key={c} label={c} to={`/stu?course=${encodeURIComponent(c)}`} active={course === c} count={list.filter((r) => r.subject === c).length} icon={Folder} />
            ))}
          </nav>
        )}
        <SideFoot>
          {joining ? (
            <form className="field" onSubmit={(e) => void join(e)}>
              <label className="label" htmlFor="join-code">
                교수에게 받은 과제 코드
              </label>
              <input id="join-code" className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus required />
              {joinError && (
                <p className="error-text" role="alert">
                  {joinError}
                </p>
              )}
              <div className="inline">
                <button className="btn primary block" type="submit" disabled={busy}>
                  참여
                </button>
                <button className="btn block" type="button" onClick={() => setJoining(false)}>
                  취소
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn block" onClick={() => setJoining(true)}>
              <Hash aria-hidden="true" />
              과제 코드로 참여
            </button>
          )}
        </SideFoot>
      </aside>
      <Main>
        <StuHomeContext.Provider value={{ rows, error, reload }}>
          <Outlet />
        </StuHomeContext.Provider>
      </Main>
    </div>
  )
}

// ---------- 로그인하지 않아도 보는 화면 ----------
export function PublicFrame({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  return (
    <div className="public">
      <header className="pub-top">
        <Link to="/" className="brand">
          <Logo size={20} />
          {APP_NAME}
        </Link>
        <div className="inline">
          <Link className="btn quiet" to={user ? '/' : '/login'}>
            {user ? '내 화면으로' : '로그인'}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
    </div>
  )
}
