import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, formatDate, STAGE_LABEL, type Overview, type Stage } from '../../api'

const STAGES: Stage[] = ['pre', 'learning', 'task', 'post', 'done']

export default function AssignmentOverview() {
  const { id } = useParams()
  const aid = Number(id)
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.prof.overview(aid).then(setData).catch((e: Error) => setError(e.message))
  }, [aid])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">불러오는 중</p>
  const a = data.assignment
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1>{a.title}</h1>
          <p className="muted small">
            {a.subject} · 마감 {formatDate(a.deadline)} · 참여 코드 <code>{a.join_code}</code> ·{' '}
            {a.status === 'open' ? '공개 중' : '작성 중'}
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-secondary" to={`/prof/assignments/${aid}/setup`}>
            과제 설정
          </Link>
          <Link className="btn btn-ghost" to="/prof">
            목록
          </Link>
        </div>
      </div>

      <div className="card">
        <h2>반 전체 현황</h2>
        <div className="row">
          {STAGES.map((s) => (
            <div key={s} className="stage" style={{ flex: '0 0 150px' }}>
              <div className="muted small">{STAGE_LABEL[s]} 단계</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{data.stage_counts[s] ?? 0}명</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>학생별 지표</h2>
        {data.rows.length === 0 ? (
          <p className="muted">아직 참여한 학생이 없다. 참여 코드를 학생에게 알려 준다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>학생</th>
                <th>단계</th>
                <th>사전평가</th>
                <th>역량 통과</th>
                <th>시도</th>
                <th>버전</th>
                <th>사후평가</th>
                <th>의심 신호</th>
                <th>과제 점수</th>
                <th>마지막 제출</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.enrollment_id}>
                  <td>
                    <Link to={`/prof/assignments/${aid}/students/${r.enrollment_id}`}>{r.student_name}</Link>
                    <div className="muted small">{r.student_email}</div>
                  </td>
                  <td>
                    <span className="chip chip-primary">{STAGE_LABEL[r.stage]}</span>
                  </td>
                  <td>{r.pre_score === null ? '-' : `${r.pre_score}점`}</td>
                  <td>
                    {r.passed_count}/{r.competency_count}
                  </td>
                  <td>{r.attempt_count}</td>
                  <td>{r.version_count}</td>
                  <td>{r.post_score === null ? '-' : `${r.post_score}점`}</td>
                  <td>{r.signal_count > 0 ? <span className="chip chip-warn">{r.signal_count}건</span> : '-'}</td>
                  <td>{r.grade_score === null ? '-' : `${r.grade_score}점`}</td>
                  <td className="small">{formatDate(r.last_submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
