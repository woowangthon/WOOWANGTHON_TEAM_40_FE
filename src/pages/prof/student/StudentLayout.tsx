import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'

import { api, formatDate, STAGE_LABEL, type StudentDetail } from '../../../api'

export interface StudentCtx {
  aid: number
  d: StudentDetail
  setD: (d: StudentDetail) => void
  reload: () => Promise<void>
}

export function useStudent(): StudentCtx {
  return useOutletContext<StudentCtx>()
}

const TABS = [
  { key: '', label: '개요' },
  { key: 'tests', label: '사전 사후 평가' },
  { key: 'learning', label: '학습 과정' },
  { key: 'task', label: '결과물 변경 이력' },
  { key: 'conversation', label: '전체 대화' },
]

// 학생 상세의 틀. 다섯 결과물을 탭으로 나눈다.
export default function StudentLayout() {
  const { id, eid } = useParams()
  const aid = Number(id)
  const enrollmentId = Number(eid)
  const [d, setD] = useState<StudentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    () => api.prof.student(aid, enrollmentId).then(setD).catch((e: Error) => setError(e.message)),
    [aid, enrollmentId],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!d) return <p className="muted">불러오는 중</p>

  const base = `/prof/assignments/${aid}/students/${enrollmentId}`
  const ctx: StudentCtx = { aid, d, setD, reload }
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1>
            {d.student.name} <span className="muted small">{d.student.email}</span>
          </h1>
          <p className="muted small">
            현재 단계 {STAGE_LABEL[d.stage]} · 참여 {formatDate(d.joined_at)} · 제출 시도 {d.attempts.filter((t) => t.status === 'submitted').length}회 · 의심 신호{' '}
            {d.signals.length}건
          </p>
        </div>
        <Link className="btn btn-ghost" to={`/prof/assignments/${aid}`}>
          과제 현황으로
        </Link>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink key={t.key} to={t.key ? `${base}/${t.key}` : base} end={!t.key} className={({ isActive }) => (isActive ? 'active' : '')}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={ctx} />
    </div>
  )
}
