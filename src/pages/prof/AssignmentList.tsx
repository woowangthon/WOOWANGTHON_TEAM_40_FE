import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, formatDate, TOOL_LABEL, type AssignmentBrief } from '../../api'

export default function AssignmentList() {
  const [rows, setRows] = useState<AssignmentBrief[] | null>(null)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.prof.list().then(setRows).catch((e: Error) => setError(e.message))
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    try {
      const a = await api.prof.create({ title, subject })
      navigate(`/prof/assignments/${a.id}/setup`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '만들기 실패')
    }
  }

  return (
    <div>
      <h1>내 과제</h1>
      <div className="card">
        <h2>새 과제</h2>
        <form className="row" onSubmit={(e) => void create(e)}>
          <input placeholder="과제 제목" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ maxWidth: 360 }} />
          <input placeholder="과목" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="btn" type="submit">
            만들고 설정하기
          </button>
        </form>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {rows === null ? (
          <p className="muted">불러오는 중</p>
        ) : rows.length === 0 ? (
          <p className="muted">아직 과제가 없다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>제목</th>
                <th>과목</th>
                <th>도구</th>
                <th>마감</th>
                <th>상태</th>
                <th>참여 코드</th>
                <th>학생</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link to={`/prof/assignments/${a.id}`}>{a.title}</Link>
                  </td>
                  <td>{a.subject}</td>
                  <td className="small">
                    자리 {a.tool_slot} · {TOOL_LABEL[a.tool_name] ?? a.tool_name}
                  </td>
                  <td>{formatDate(a.deadline)}</td>
                  <td>
                    <span className={`chip ${a.status === 'open' ? 'chip-ok' : ''}`}>
                      {a.status === 'open' ? '공개' : a.status === 'closed' ? '마감' : '작성 중'}
                    </span>
                  </td>
                  <td>
                    <code>{a.join_code}</code>
                  </td>
                  <td>{a.enrollment_count}</td>
                  <td>
                    <Link to={`/prof/assignments/${a.id}/setup`}>설정</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
