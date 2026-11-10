import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, formatDate, STAGE_LABEL, TOOL_LABEL, type EnrollmentBrief } from '../../api'

export default function StudentHome() {
  const [rows, setRows] = useState<EnrollmentBrief[] | null>(null)
  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.stu.list().then(setRows).catch((e: Error) => setError(e.message))
  }, [])

  async function join(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const en = await api.stu.join(code.trim())
      navigate(`/stu/enrollments/${en.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여 실패')
    }
  }

  const active = (rows ?? []).filter((r) => r.stage !== 'done')
  const done = (rows ?? []).filter((r) => r.stage === 'done')
  const shown = tab === 'active' ? active : done

  return (
    <div>
      <h1>내 과제</h1>
      <div className="card">
        <h2>과제 참여</h2>
        <p className="muted small">교수가 알려 준 참여 코드를 입력한다. 참여하면 과제 개요를 읽고 사전평가부터 시작한다.</p>
        <form className="row" onSubmit={(e) => void join(e)}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="참여 코드" style={{ maxWidth: 200 }} required />
          <button className="btn" type="submit">
            참여
          </button>
        </form>
        {error && <p className="error small">{error}</p>}
      </div>
      <div className="card">
        <div className="card-title">
          <h2>참여한 과제</h2>
          <div className="section-nav" style={{ margin: 0 }}>
            <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
              진행 중 {active.length}
            </button>
            <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
              완료 {done.length}
            </button>
          </div>
        </div>
        {rows === null ? (
          <p className="muted">불러오는 중</p>
        ) : shown.length === 0 ? (
          <p className="muted">{tab === 'active' ? '진행 중인 과제가 없다.' : '완료한 과제가 없다.'}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>과제</th>
                <th>과목</th>
                <th>교수</th>
                <th>도구</th>
                <th>마감</th>
                <th>단계</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/stu/enrollments/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>{r.subject}</td>
                  <td>{r.professor_name}</td>
                  <td className="small">{TOOL_LABEL[r.tool_name] ?? r.tool_name}</td>
                  <td>
                    {formatDate(r.deadline)} {r.deadline_passed && <span className="chip chip-bad">마감 지남</span>}
                  </td>
                  <td>
                    <span className="chip chip-primary">{STAGE_LABEL[r.stage]}</span>
                  </td>
                  <td>
                    {r.stage === 'done' ? (
                      <Link className="btn btn-secondary btn-sm" to={`/stu/enrollments/${r.id}/result`}>
                        결과 요약
                      </Link>
                    ) : (
                      <Link className="btn btn-secondary btn-sm" to={`/stu/enrollments/${r.id}/${r.stage}`}>
                        이어서 하기
                      </Link>
                    )}
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
