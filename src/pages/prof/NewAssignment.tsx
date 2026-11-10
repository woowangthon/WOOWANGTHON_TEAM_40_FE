import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api } from '../../api'

// 과제 만들기. 짧은 기본 정보만 받고 설정 첫 구역으로 보낸다.
export default function NewAssignment() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [taskKind, setTaskKind] = useState<'performance' | 'essay'>('performance')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const a = await api.prof.create({
        title: title.trim(),
        subject: subject.trim(),
        task_kind: taskKind,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      })
      navigate(`/prof/assignments/${a.id}/setup/competencies`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '만들기 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>과제 만들기</h1>
      <p className="muted small">
        여기서는 기본 정보만 받는다. 역량과 채점 기준, 사전 사후 문항, 과제 문제, 학습 자료, AI 응답 규칙, 도구 연동은 다음 화면에서 구역별로 설정한다.
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label>과제 제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="예: 부서별 평균 급여 조회문 설계" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>과목</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 데이터베이스" />
          </div>
          <div className="field">
            <label>과제 종류</label>
            <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as 'performance' | 'essay')}>
              <option value="performance">수행형, 도구로 결과물을 만든다</option>
              <option value="essay">논술형, 긴 글을 쓴다</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>마감, 나중에 바꿀 수 있다</label>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            만들고 설정으로
          </button>
          <Link className="btn btn-ghost" to="/prof">
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
