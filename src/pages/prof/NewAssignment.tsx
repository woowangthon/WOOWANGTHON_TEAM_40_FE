import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, type Assignment } from '../../api'
import { useProfHome } from '../../shells'
import { Notice, PageHead } from '../../ui'
import './setup/setup.css'

// 과제 만들기. 짧은 기본 정보만 받고 설정 첫 구역으로 보낸다.
export default function NewAssignment() {
  const navigate = useNavigate()
  const { data, reload } = useProfHome()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [taskKind, setTaskKind] = useState<Assignment['task_kind']>('performance')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 이미 쓴 과목 이름을 입력 후보로 보여 준다.
  const courses = [...new Set((data?.rows ?? []).map((r) => r.subject).filter(Boolean))]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('과제 이름을 입력한다.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const a = await api.prof.create({
        title: title.trim(),
        subject: subject.trim(),
        task_kind: taskKind,
        deadline: date ? new Date(`${date}T${time || '23:59'}`).toISOString() : null,
      })
      void reload()
      navigate(`/prof/assignments/${a.id}/setup/competencies`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '만들기 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page narrow setup">
      <PageHead title="과제 만들기" crumbs={[['최근 과제', '/prof']]} />
      {error && <Notice kind="error">{error}</Notice>}
      <form className="form" onSubmit={(e) => void submit(e)}>
        <div className="form-row">
          <label className="label" htmlFor="course">
            과목
          </label>
          <input id="course" className="input" list="course-list" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <datalist id="course-list">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="form-row">
          <label className="label" htmlFor="title">
            과제 이름
          </label>
          <input id="title" className="input" value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-row">
          <label className="label" htmlFor="kind">
            문제 종류
          </label>
          <select id="kind" className="select" value={taskKind} onChange={(e) => setTaskKind(e.target.value as Assignment['task_kind'])}>
            <option value="performance">수행형, 도구로 결과물을 만든다</option>
            <option value="essay">논술형, 긴 글을 쓴다</option>
          </select>
        </div>
        <div className="form-row">
          <span className="label">마감</span>
          <div className="inline">
            <input
              className="input w-date"
              type="date"
              value={date}
              aria-label="마감 날짜"
              onChange={(e) => {
                setDate(e.target.value)
                if (e.target.value && !time) setTime('23:59')
              }}
            />
            <input className="input w-time" type="time" value={time} aria-label="마감 시각" onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <span />
          <div className="inline">
            <button className="btn primary" type="submit" disabled={busy}>
              만들고 설정 시작
            </button>
            <Link className="btn quiet" to="/prof">
              취소
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
