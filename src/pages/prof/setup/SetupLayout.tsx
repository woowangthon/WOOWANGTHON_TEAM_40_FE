import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'

import { api, type Assignment } from '../../../api'
import type { Notify } from '../setupSections'

export interface SetupCtx {
  a: Assignment
  setA: (a: Assignment) => void
  reload: () => Promise<void>
  notify: Notify
}

export function useSetup(): SetupCtx {
  return useOutletContext<SetupCtx>()
}

export const SECTIONS = [
  { key: 'competencies', label: '1 기본 정보와 역량' },
  { key: 'tests', label: '2 사전 사후 평가' },
  { key: 'task', label: '3 과제 문제' },
  { key: 'materials', label: '4 학습 자료' },
  { key: 'rules', label: '5 AI 응답 규칙' },
  { key: 'tools', label: '6 도구 연동' },
  { key: 'publish', label: '7 점검과 공개' },
] as const

// 구역이 끝났는지 알려 준다. true 완료, false 미완, null 선택 사항.
export function sectionDone(a: Assignment, key: string): boolean | null {
  switch (key) {
    case 'competencies':
      return a.competencies.length > 0 && a.competencies.every((c) => c.grading_criteria.trim().length > 0)
    case 'tests': {
      if (!a.competencies.length) return false
      const covers = (phase: 'pre' | 'post') => {
        const ids = new Set(a.items.filter((i) => i.phase === phase).map((i) => i.competency_id))
        return a.competencies.every((c) => ids.has(c.id))
      }
      return covers('pre') && covers('post')
    }
    case 'task':
      return Boolean(a.description.trim()) && a.deadline !== null
    case 'materials':
      return a.materials.length > 0 ? true : null
    case 'rules':
      return a.rules.length > 0 ? true : null
    case 'tools':
      return true
    case 'publish':
      return a.status === 'open'
    default:
      return null
  }
}

// 과제 설정의 틀. 왼쪽에 구역 메뉴, 오른쪽에 구역 하나씩 보여 준다.
export default function SetupLayout() {
  const { id } = useParams()
  const aid = Number(id)
  const [a, setA] = useState<Assignment | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const reload = useCallback(
    () => api.prof.get(aid).then(setA).catch((e: Error) => setMessage({ kind: 'error', text: e.message })),
    [aid],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  if (!a) return <p className="muted">{message?.text ?? '불러오는 중'}</p>

  const notify: Notify = (kind, text) => setMessage({ kind, text })
  const ctx: SetupCtx = { a, setA, reload, notify }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1>과제 설정: {a.title}</h1>
          <p className="muted small">
            상태 {a.status === 'open' ? '공개 중' : '작성 중'} · 참여 코드 <code>{a.join_code}</code>
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-secondary" to={`/prof/assignments/${aid}`}>
            과제 현황
          </Link>
          <Link className="btn btn-ghost" to="/prof">
            대시보드
          </Link>
        </div>
      </div>
      {message && (
        <div className={`banner row ${message.kind === 'ok' ? 'info' : ''}`} style={{ justifyContent: 'space-between' }}>
          <span>{message.text}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setMessage(null)}>
            닫기
          </button>
        </div>
      )}
      <div className="setup-grid">
        <nav className="setup-nav">
          {SECTIONS.map((s) => {
            const done = sectionDone(a, s.key)
            return (
              <NavLink key={s.key} to={`/prof/assignments/${aid}/setup/${s.key}`} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span>{s.label}</span>
                <span className={`mark ${done === true ? 'ok' : done === false ? 'todo' : ''}`}>
                  {done === true ? '완료' : done === false ? '미완' : '선택'}
                </span>
              </NavLink>
            )
          })}
        </nav>
        <div>
          <Outlet context={ctx} />
        </div>
      </div>
    </div>
  )
}
