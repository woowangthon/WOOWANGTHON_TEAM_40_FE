import { useState } from 'react'

import { api, formatDate, ITEM_TYPE_LABEL, type StudentDetail as Detail, type Summary, type TestResult } from '../../api'

export const STATUS_LABEL: Record<string, string> = { sufficient: '충분', in_progress: '진행 중', insufficient: '부족' }
export const SIGNAL_LABEL: Record<string, string> = {
  non_sequential: '순차적이지 않은 변화',
  logic_gap: '논리적 공백',
  style_shift: '문체 급변',
  other: '기타',
}

export function SummaryView({ s }: { s: Summary }) {
  const c = s.content
  return (
    <div className="small">
      <p>
        <strong>스펙</strong> {c.spec_summary}
      </p>
      <p>
        <strong>학습 내용</strong> {c.learned_summary}
      </p>
      <p>
        <strong>AI 사용 방식</strong> {c.ai_usage_line}
      </p>
      {c.competencies && (
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          {c.competencies.map((x, i) => (
            <li key={i}>
              <span className={`chip ${x.status === 'sufficient' ? 'chip-ok' : x.status === 'insufficient' ? 'chip-bad' : 'chip-warn'}`}>
                {STATUS_LABEL[x.status] ?? x.status}
              </span>{' '}
              {x.competency_name}: {x.line}
            </li>
          ))}
        </ul>
      )}
      <p className="muted" style={{ marginTop: 4 }}>
        {formatDate(s.created_at)}
      </p>
    </div>
  )
}

export function TestCard({
  title,
  result,
  aid,
  onChanged,
}: {
  title: string
  result: TestResult | null
  aid: number
  onChanged: (d: Detail) => void
}) {
  const [edit, setEdit] = useState<Record<number, { score: string; feedback: string }>>({})
  if (!result) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <p className="muted small">아직 응시하지 않았다.</p>
      </div>
    )
  }
  async function override(answerId: number) {
    const e = edit[answerId]
    if (!e) return
    try {
      onChanged(await api.prof.overrideAnswer(aid, answerId, { score: Number(e.score), feedback: e.feedback }))
      setEdit({ ...edit, [answerId]: undefined as unknown as { score: string; feedback: string } })
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장 실패')
    }
  }
  return (
    <div className="card">
      <h2>
        {title} <span className="score">{result.total_score}점</span>
      </h2>
      <p className="muted small">
        {formatDate(result.submitted_at)} 제출{result.competency_scores._time_exceeded ? ' · 제한 시간 초과' : ''}
      </p>
      {result.answers.map((a) => (
        <div className="version" key={a.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="chip">{ITEM_TYPE_LABEL[a.type]}</span>
            <span>
              <span className="score">{a.score === null ? '-' : `${Math.round(a.score)}점`}</span>{' '}
              <span className="muted small">{a.graded_by === 'auto' ? '자동 채점' : a.graded_by === 'ai' ? 'AI 채점' : '교수 확정'}</span>
            </span>
          </div>
          <p className="small" style={{ margin: '4px 0' }}>
            {a.stem}
          </p>
          <p className="small">
            <strong>학생 답</strong> {a.answer_text || '(비어 있음)'}
          </p>
          <p className="small muted">
            <strong>정답 또는 모범 답안</strong> {a.expected_answer}
          </p>
          {a.rationale && (
            <p className="small muted">
              <strong>AI 채점 근거</strong> {a.rationale}
            </p>
          )}
          {(a.type === 'essay_short' || a.type === 'essay_long') && (
            <div className="row" style={{ marginTop: 6 }}>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="점수 확정"
                value={edit[a.id]?.score ?? ''}
                onChange={(e) => setEdit({ ...edit, [a.id]: { score: e.target.value, feedback: edit[a.id]?.feedback ?? '' } })}
                style={{ width: 110 }}
              />
              <input
                placeholder="학생에게 보일 피드백, 선택"
                value={edit[a.id]?.feedback ?? ''}
                onChange={(e) => setEdit({ ...edit, [a.id]: { score: edit[a.id]?.score ?? '', feedback: e.target.value } })}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={() => void override(a.id)} disabled={!edit[a.id]?.score}>
                교수 확인
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function GradeCard({ d, aid, onSaved }: { d: Detail; aid: number; onSaved: () => void }) {
  const [score, setScore] = useState(d.grade?.score?.toString() ?? '')
  const [comment, setComment] = useState(d.grade?.comment ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  async function save() {
    try {
      await api.prof.setGrade(aid, d.enrollment_id, { score: score === '' ? null : Number(score), comment })
      setMsg('저장했다.')
      onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card">
      <h2>과제 점수와 코멘트</h2>
      <p className="muted small">다섯 가지 결과물을 보고 교수가 입력한다. 편법 사용 여부의 최종 판단도 여기서 교수가 한다.</p>
      <div className="row">
        <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} placeholder="점수" style={{ width: 120 }} />
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="코멘트" style={{ flex: 1 }} />
        <button className="btn" onClick={() => void save()}>
          저장
        </button>
      </div>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  )
}
