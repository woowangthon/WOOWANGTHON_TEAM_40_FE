import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  api,
  formatDate,
  ITEM_TYPE_LABEL,
  MODE_LABEL,
  STAGE_LABEL,
  type StudentDetail as Detail,
  type Summary,
  type TestResult,
} from '../../api'
import StatesTable from '../../components/StatesTable'
import VersionList from '../../components/VersionList'

const STATUS_LABEL: Record<string, string> = { sufficient: '충분', in_progress: '진행 중', insufficient: '부족' }
const SIGNAL_LABEL: Record<string, string> = {
  non_sequential: '순차적이지 않은 변화',
  logic_gap: '논리적 공백',
  style_shift: '문체 급변',
  other: '기타',
}

export default function StudentDetail() {
  const { id, eid } = useParams()
  const aid = Number(id)
  const enrollmentId = Number(eid)
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const reload = useCallback(
    () => api.prof.student(aid, enrollmentId).then(setD).catch((e: Error) => setError(e.message)),
    [aid, enrollmentId],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!d) return <p className="muted">불러오는 중</p>

  const learningSummary = d.summaries.find((s) => s.kind === 'learning')

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1>
            {d.student.name} <span className="muted small">{d.student.email}</span>
          </h1>
          <p className="muted small">
            현재 단계 {STAGE_LABEL[d.stage]} · 참여 {formatDate(d.joined_at)}
          </p>
        </div>
        <Link className="btn btn-ghost" to={`/prof/assignments/${aid}`}>
          과제 현황으로
        </Link>
      </div>

      <div className="card">
        <h2>역량 상태, 스펙</h2>
        <StatesTable states={d.states} showPost />
      </div>

      <div className="grid-2">
        <TestCard title="사전평가 점수" result={d.pre} aid={aid} onChanged={setD} />
        <TestCard title="사후평가 점수" result={d.post} aid={aid} onChanged={setD} />
      </div>

      <div className="card">
        <h2>항목별 AI 학습과정 요약</h2>
        {learningSummary ? <SummaryView s={learningSummary} /> : <p className="muted small">학습 단계가 끝나면 생긴다.</p>}
        {d.checks.length > 0 && (
          <>
            <h3 style={{ marginTop: 12 }}>학습 중 확인 문항</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>역량</th>
                  <th>문항</th>
                  <th>학생 답</th>
                  <th>점수</th>
                  <th>피드백</th>
                </tr>
              </thead>
              <tbody>
                {d.checks.map((c) => (
                  <tr key={c.id}>
                    <td>{d.states.find((s) => s.competency_id === c.competency_id)?.name}</td>
                    <td>
                      {c.item.stem}
                      <div className="muted small">모범 답안: {c.item.answer}</div>
                    </td>
                    <td>{c.answer_text ?? '-'}</td>
                    <td>{c.score === null ? '-' : `${Math.round(c.score)}점`}</td>
                    <td className="small">{c.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h2>결과물 변경 이력, 제출 시도별</h2>
        {d.attempts.length === 0 && <p className="muted small">아직 과제 단계 기록이 없다.</p>}
        {d.attempts.map((t) => {
          const summary = d.summaries.find((s) => s.kind === 'task' && s.attempt_no === t.attempt_no)
          const msgs = d.messages.filter((m) => m.stage === 'task' && m.attempt_no === t.attempt_no)
          const signals = d.signals.filter((s) => s.attempt_no === t.attempt_no)
          return (
            <div key={t.id} className="version" style={{ background: '#fafbfc' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>
                  시도 {t.attempt_no} <span className="chip">{t.status === 'submitted' ? '제출됨' : '진행 중'}</span>
                </h3>
                <span className="muted small">
                  시작 {formatDate(t.started_at)} · 제출 {formatDate(t.submitted_at)} · 버전 {t.versions.length}개
                </span>
              </div>
              {signals.length > 0 && (
                <div className="banner" style={{ marginTop: 8 }}>
                  <strong>위반 의심 신호</strong>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {signals.map((s) => (
                      <li key={s.id} className="small">
                        <span className="chip chip-warn">{SIGNAL_LABEL[s.kind] ?? s.kind}</span> {s.description}
                        {s.evidence.text && <span className="muted"> · 근거: {s.evidence.text}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="muted small" style={{ margin: '6px 0 0' }}>
                    AI는 의심 신호만 표시한다. 최종 판단은 교수가 기록을 보고 한다.
                  </p>
                </div>
              )}
              <div className="grid-side" style={{ marginTop: 8 }}>
                <div>
                  <VersionList versions={t.versions} filePath={(vid) => api.prof.versionFilePath(aid, enrollmentId, vid)} compact />
                  <div className="placeholder small">
                    직전 버전과의 텍스트 비교와 이미지 비교 화면은 동료가 구현한다. 지금은 버전 원문과 캡처만 보인다.
                  </div>
                </div>
                <div>
                  {summary ? <SummaryView s={summary} /> : <p className="muted small">제출하면 이 시도의 AI 요약이 생긴다.</p>}
                  <h3 style={{ marginTop: 10 }}>이 시도의 AI 대화 {msgs.length}건</h3>
                  <div className="chat-log" style={{ maxHeight: 260 }}>
                    {msgs.map((m) => (
                      <div key={m.id} className={`bubble ${m.role}`}>
                        {m.role === 'ai' && <span className="tag">AI · {MODE_LABEL[m.mode] ?? m.mode}</span>}
                        {m.content}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>전체 대화 답변</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? '접기' : `${d.messages.length}건 보기`}
          </button>
        </div>
        {showAll && (
          <div className="chat-log" style={{ maxHeight: 480 }}>
            {d.messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <span className="tag">
                  {m.stage === 'learning' ? '학습 단계' : `과제 단계 시도 ${m.attempt_no}`} · {formatDate(m.created_at)}
                  {m.role === 'ai' ? ` · ${MODE_LABEL[m.mode] ?? m.mode}` : ''}
                </span>
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>

      <GradeCard d={d} aid={aid} onSaved={reload} />
    </div>
  )
}

function SummaryView({ s }: { s: Summary }) {
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

function TestCard({
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

function GradeCard({ d, aid, onSaved }: { d: Detail; aid: number; onSaved: () => void }) {
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
