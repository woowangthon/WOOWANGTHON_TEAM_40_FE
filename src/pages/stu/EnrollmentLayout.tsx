import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, Lock } from 'lucide-react'

import { api, type Enrollment, type Stage } from '../../api'
import { DownloadButton } from '../../components/Files'
import { stageSteps } from '../../nav'
import { Loading, monthDay, Notice, Status, ThemeToggle } from '../../ui'
import './stu.css'

export interface EnrollmentCtx {
  e: Enrollment
  reload: () => Promise<Enrollment>
  setNotice: (text: string | null) => void
}

export function useEnrollment(): EnrollmentCtx {
  return useOutletContext<EnrollmentCtx>()
}

export const STAGE_ROUTES: { key: Stage; path: string; label: string }[] = [
  { key: 'pre', path: 'pre', label: '1 사전평가' },
  { key: 'learning', path: 'learning', label: '2 학습' },
  { key: 'task', path: 'task', label: '3 과제' },
  { key: 'post', path: 'post', label: '4 사후평가' },
]

const ORDER: Stage[] = ['pre', 'learning', 'task', 'post', 'done']

// 지금 단계에서 그 단계 화면을 열 수 있는지. 지난 단계는 결과를 볼 수 있게 열어 둔다.
export function stageOpen(stage: Stage, target: Stage): boolean {
  return ORDER.indexOf(stage) >= ORDER.indexOf(target)
}

export function currentStagePath(stage: Stage): string {
  return stage === 'done' ? 'task' : stage
}

// 학생 과제의 틀. 위에 단계 표시가 붙은 바, 아래에 개요나 단계 화면이 뜬다.
export default function EnrollmentLayout() {
  const { eid } = useParams()
  const enrollmentId = Number(eid)
  const [e, setE] = useState<Enrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const googleParam = params.get('google')
  const [notice, setNoticeText] = useState<string | null>(
    googleParam === 'connected'
      ? 'Google 계정을 연결했다. 과제 단계에서 문서 주소를 지정한다'
      : googleParam === 'denied'
        ? 'Google 계정 연결을 취소했다'
        : googleParam === 'failed'
          ? 'Google 계정 연결에 실패했다. 다시 시도한다'
          : null,
  )
  const [noticeKind, setNoticeKind] = useState<'info' | 'error'>(googleParam === 'failed' ? 'error' : 'info')
  useEffect(() => {
    if (googleParam) setParams({}, { replace: true })
  }, [googleParam, setParams])

  const setNotice = useCallback((text: string | null) => {
    setNoticeKind('info')
    setNoticeText(text)
  }, [])

  const reload = useCallback(async () => {
    const en = await api.stu.get(enrollmentId)
    setE(en)
    return en
  }, [enrollmentId])
  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [reload])

  if (error) {
    return (
      <div className="page narrow">
        <Notice kind="error">{error}</Notice>
        <Link className="btn" to="/stu">
          <ChevronLeft aria-hidden="true" />
          내 과제로
        </Link>
      </div>
    )
  }
  if (!e) return <Loading />

  const a = e.assignment
  const base = `/stu/enrollments/${e.id}`
  const ctx: EnrollmentCtx = { e, reload, setNotice }
  const at = stageSteps.findIndex((s) => s.key === e.stage)
  // 주소는 /stu/enrollments/번호/단계 꼴이다. 잠긴 단계에는 링크가 없어서 보고 있는 단계를 주소에서 읽는다.
  const viewing = pathname.split('/')[4] ?? ''

  return (
    <>
      <header className="topbar">
        <div className="left">
          <Link className="btn icon quiet" to="/stu" aria-label="내 과제로">
            <ChevronLeft aria-hidden="true" />
          </Link>
          <Link className="title" to={base}>
            {a.title}
          </Link>
        </div>
        <nav className="stepper" aria-label="단계">
          {stageSteps.map((s, i) => {
            const state = i < at ? 'done' : i === at ? 'now' : 'locked'
            const Icon = state === 'done' ? Check : state === 'locked' ? Lock : s.icon
            if (state === 'locked') {
              return (
                <span key={s.path} className={viewing === s.path ? 'step locked active' : 'step locked'} aria-disabled="true">
                  <Icon aria-hidden="true" />
                  {s.label}
                </span>
              )
            }
            return (
              <NavLink key={s.path} to={`${base}/${s.path}`} className={({ isActive }) => `step ${state}${isActive ? ' active' : ''}`}>
                <Icon aria-hidden="true" />
                {s.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="right">
          {e.deadline_passed ? <Status tone="alert">마감 지남</Status> : a.deadline && <span className="num">{monthDay(a.deadline)} 마감</span>}
          {a.attachment_name && <DownloadButton path={api.stu.attachmentPath(e.id)} filename={a.attachment_name} label="과제 첨부 파일" className="btn" />}
          <ThemeToggle />
        </div>
      </header>

      {notice && (
        <div className="stage-notice">
          <Notice kind={noticeKind} onClose={() => setNotice(null)}>
            {notice}
          </Notice>
        </div>
      )}

      <Outlet context={ctx} />
    </>
  )
}
