import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router-dom'

import { api, formatDate, type Enrollment, type Stage } from '../../api'
import { DownloadButton } from '../../components/Files'

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

// 학생 과제의 틀. 위에 단계 스테퍼, 아래에 개요나 단계 화면이 뜬다.
export default function EnrollmentLayout() {
  const { eid } = useParams()
  const enrollmentId = Number(eid)
  const [e, setE] = useState<Enrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const googleParam = params.get('google')
  const [notice, setNotice] = useState<string | null>(
    googleParam === 'connected'
      ? 'Google 계정을 연결했다. 과제 단계에서 문서 주소를 지정한다.'
      : googleParam === 'denied'
        ? 'Google 계정 연결을 취소했다.'
        : googleParam === 'failed'
          ? 'Google 계정 연결에 실패했다. 다시 시도한다.'
          : null,
  )
  useEffect(() => {
    if (googleParam) setParams({}, { replace: true })
  }, [googleParam, setParams])

  const reload = useCallback(async () => {
    const en = await api.stu.get(enrollmentId)
    setE(en)
    return en
  }, [enrollmentId])
  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!e) return <p className="muted">불러오는 중</p>

  const a = e.assignment
  const base = `/stu/enrollments/${e.id}`
  const ctx: EnrollmentCtx = { e, reload, setNotice }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h1>
            <Link to={base} style={{ color: 'inherit' }}>
              {a.title}
            </Link>
          </h1>
          <p className="muted small">
            {a.subject} · {a.professor_name} 교수 · 마감 {formatDate(a.deadline)}
            {e.deadline_passed && (
              <span className="chip chip-bad" style={{ marginLeft: 6 }}>
                마감 지남
              </span>
            )}
          </p>
        </div>
        <div className="row">
          {a.attachment_name && <DownloadButton path={api.stu.attachmentPath(e.id)} filename={a.attachment_name} label="과제 첨부 파일" />}
          <Link className="btn btn-ghost" to="/stu">
            목록
          </Link>
        </div>
      </div>

      <nav className="stages">
        {STAGE_ROUTES.map((s, i) => {
          const open = stageOpen(e.stage, s.key)
          const passed = ORDER.indexOf(e.stage) > i
          const cls = `stage ${e.stage === s.key ? 'current' : passed ? 'done' : ''}`
          return open ? (
            <NavLink key={s.key} to={`${base}/${s.path}`} className={({ isActive }) => `${cls} ${isActive ? 'viewing' : ''}`}>
              {s.label}
            </NavLink>
          ) : (
            <span key={s.key} className={`${cls} locked`}>
              {s.label}
            </span>
          )
        })}
        {e.stage === 'done' ? (
          <NavLink to={`${base}/result`} className="stage current">
            완료, 결과 요약
          </NavLink>
        ) : (
          <span className="stage locked">완료</span>
        )}
      </nav>

      {notice && (
        <div className="banner row" style={{ justifyContent: 'space-between' }}>
          <span>{notice}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}>
            닫기
          </button>
        </div>
      )}

      <Outlet context={ctx} />
    </div>
  )
}
