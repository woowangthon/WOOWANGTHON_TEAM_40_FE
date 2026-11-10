import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, formatDate, STAGE_LABEL, TOOL_LABEL, type Dashboard as DashboardData, type Stage } from '../../api'

const STAGES: Stage[] = ['pre', 'learning', 'task', 'post', 'done']

// 교수 홈. 여러 과제의 진행과 채점 대기와 의심 신호를 한 번에 본다.
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => api.prof.dashboard().then(setData).catch((e: Error) => setError(e.message)), [])
  useEffect(() => {
    void reload()
  }, [reload])

  if (error && !data) return <p className="error">{error}</p>
  if (!data) return <p className="muted">불러오는 중</p>

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1>교수 대시보드</h1>
        <Link className="btn" to="/prof/assignments/new">
          새 과제 만들기
        </Link>
      </div>

      <div className="stat-grid">
        <Stat label="과제" value={`${data.assignment_count}개`} sub={`공개 중 ${data.open_count}개`} />
        <Stat label="참여 학생" value={`${data.student_count}명`} />
        <Stat label="채점 대기" value={`${data.ungraded_count}명`} sub="제출했지만 점수가 없는 학생" warn={data.ungraded_count > 0} />
        <Stat label="의심 신호" value={`${data.signal_count}건`} sub="AI가 표시한 것, 판단은 교수" warn={data.signal_count > 0} />
      </div>

      <div className="card">
        <h2>과제별 진행</h2>
        {data.rows.length === 0 ? (
          <p className="muted">
            아직 과제가 없다. <Link to="/prof/assignments/new">첫 과제를 만든다.</Link>
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>과제</th>
                <th>상태</th>
                <th>단계 분포</th>
                <th>제출</th>
                <th>채점 대기</th>
                <th>의심 신호</th>
                <th>마감</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const total = STAGES.reduce((n, s) => n + (r.stage_counts[s] ?? 0), 0)
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/prof/assignments/${r.id}`}>{r.title}</Link>
                      <div className="muted small">
                        {r.subject} · 자리 {r.tool_slot} · {TOOL_LABEL[r.tool_name] ?? r.tool_name} · 코드 <code>{r.join_code}</code>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${r.status === 'open' ? 'chip-ok' : ''}`}>
                        {r.status === 'open' ? '공개' : r.status === 'closed' ? '마감' : '작성 중'}
                      </span>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      {total === 0 ? (
                        <span className="muted small">참여 없음</span>
                      ) : (
                        <>
                          <div className="stage-bar">
                            {STAGES.map((s) => (
                              <span key={s} className={`seg seg-${s}`} style={{ flex: r.stage_counts[s] ?? 0 }} title={`${STAGE_LABEL[s]} ${r.stage_counts[s] ?? 0}명`} />
                            ))}
                          </div>
                          <div className="muted small">
                            {STAGES.filter((s) => (r.stage_counts[s] ?? 0) > 0)
                              .map((s) => `${STAGE_LABEL[s]} ${r.stage_counts[s]}`)
                              .join(', ')}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {r.submitted_count}/{r.enrollment_count}
                    </td>
                    <td>{r.ungraded_count > 0 ? <span className="chip chip-warn">{r.ungraded_count}명</span> : '-'}</td>
                    <td>{r.signal_count > 0 ? <span className="chip chip-warn">{r.signal_count}건</span> : '-'}</td>
                    <td className="small">{formatDate(r.deadline)}</td>
                    <td className="row" style={{ flexWrap: 'nowrap' }}>
                      <Link className="btn btn-secondary btn-sm" to={`/prof/assignments/${r.id}`}>
                        현황
                      </Link>
                      <Link className="btn btn-ghost btn-sm" to={`/prof/assignments/${r.id}/setup/competencies`}>
                        설정
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`stat ${warn ? 'stat-warn' : ''}`}>
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  )
}
