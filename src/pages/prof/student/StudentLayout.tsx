import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, ChevronRight, ClipboardList, History, LayoutDashboard, MessageSquareText, MessagesSquare } from 'lucide-react'

import { api, type StudentDetail } from '../../../api'
import { Loading, Notice, PageHead } from '../../../ui'
import '../status/status.css'

export interface StudentCtx {
  aid: number
  d: StudentDetail
  setD: (d: StudentDetail) => void
  reload: () => Promise<void>
}

export function useStudent(): StudentCtx {
  return useOutletContext<StudentCtx>()
}

const TABS: [label: string, path: string, icon: LucideIcon][] = [
  ['개요', '', LayoutDashboard],
  ['사전 사후 평가', 'tests', ClipboardList],
  ['학습 과정', 'learning', MessagesSquare],
  ['결과물 변경 이력', 'task', History],
  ['전체 대화', 'conversation', MessageSquareText],
]

// 학생 한 명의 기록. 다섯 결과물을 탭으로 나눈다.
export default function StudentLayout() {
  const { id, eid } = useParams()
  const aid = Number(id)
  const enrollmentId = Number(eid)
  const { pathname } = useLocation()
  const [d, setD] = useState<StudentDetail | null>(null)
  // 오류는 어느 학생을 받다가 났는지와 함께 둔다. 다른 학생으로 넘기면 보이지 않는다.
  const [failure, setFailure] = useState<{ eid: number; text: string } | null>(null)
  // 이전 학생과 다음 학생으로 넘기는 데 쓰는 학생 순서. 현황의 학생 표와 같은 순서다.
  const [order, setOrder] = useState<number[]>([])

  // 학생을 넘기는 사이에 늦게 도착한 응답이 지금 학생의 기록을 덮지 않게 한다.
  const latest = useRef(enrollmentId)
  useEffect(() => {
    latest.current = enrollmentId
  }, [enrollmentId])
  const accept = useCallback((x: StudentDetail) => {
    if (x.enrollment_id === latest.current) setD(x)
  }, [])

  const reload = useCallback(
    () =>
      api.prof
        .student(aid, enrollmentId)
        .then((x) => {
          accept(x)
          setFailure((cur) => (cur?.eid === x.enrollment_id ? null : cur))
        })
        .catch((e: Error) => setFailure({ eid: enrollmentId, text: e.message })),
    [aid, enrollmentId, accept],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    let alive = true
    api.prof
      .overview(aid)
      .then((o) => {
        if (alive) setOrder(o.rows.map((r) => r.enrollment_id))
      })
      .catch(() => {
        // 순서를 받지 못하면 넘기는 버튼만 내지 않는다. 기록을 못 받은 오류는 위에서 따로 알린다.
        if (alive) setOrder([])
      })
    return () => {
      alive = false
    }
  }, [aid])

  const list = `/prof/assignments/${aid}/students`
  const base = `${list}/${enrollmentId}`
  const ready = d !== null && d.enrollment_id === enrollmentId
  const error = failure !== null && failure.eid === enrollmentId ? failure.text : null

  if (!ready && error) {
    return (
      <div className="page">
        <PageHead title="학생 기록" crumbs={[['학생', list]]} />
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!ready) return <Loading />

  // 다른 학생으로 넘겨도 보던 탭을 그대로 둔다.
  const tail = pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : ''
  const at = order.indexOf(enrollmentId)
  const prev = at >= 0 && order.length > 1 ? order[(at - 1 + order.length) % order.length] : null
  const next = at >= 0 && order.length > 1 ? order[(at + 1) % order.length] : null
  const ctx: StudentCtx = { aid, d, setD: accept, reload }

  return (
    <div className="page prof-status" key={enrollmentId}>
      <PageHead title={d.student.name} crumbs={[['학생', list]]}>
        <span>{d.student.email}</span>
        {prev !== null && (
          <Link className="btn icon" to={`${list}/${prev}${tail}`} aria-label="이전 학생">
            <ChevronLeft aria-hidden="true" />
          </Link>
        )}
        {next !== null && (
          <Link className="btn icon" to={`${list}/${next}${tail}`} aria-label="다음 학생">
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </PageHead>
      {error && <Notice kind="error">{error}</Notice>}
      <nav className="tabs fit" aria-label="학생 기록">
        {TABS.map(([label, path, Icon]) => (
          <NavLink key={label} to={path ? `${base}/${path}` : base} end={!path} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <Icon aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={ctx} />
    </div>
  )
}
