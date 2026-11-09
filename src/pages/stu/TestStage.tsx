import { useEffect, useState } from 'react'

import { api, ApiError, ITEM_TYPE_LABEL, type Enrollment, type Phase, type TestResult, type TestStart } from '../../api'
import StatesTable from '../../components/StatesTable'

export default function TestStage({
  enrollment,
  phase,
  onSubmitted,
  onDone,
}: {
  enrollment: Enrollment
  phase: Phase
  onSubmitted: () => void
  onDone: () => void
}) {
  const eid = enrollment.id
  const label = phase === 'pre' ? '사전평가' : '사후평가'
  const [started, setStarted] = useState<TestStart | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    api.stu
      .testResult(eid, phase)
      .then(setResult)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.status === 404)) setError(e instanceof Error ? e.message : '오류')
      })
  }, [eid, phase])

  useEffect(() => {
    if (!started) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [started])

  async function start() {
    setBusy(true)
    setError(null)
    try {
      setStarted(await api.stu.testStart(eid, phase))
    } catch (e) {
      setError(e instanceof Error ? e.message : '시작 실패')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!started) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.stu.testSubmit(
        eid,
        phase,
        started.items.map((i) => ({ item_id: i.id, answer: answers[i.id] ?? '' })),
      )
      setResult(res)
      setStarted(null)
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const comps = enrollment.assignment.competencies
    return (
      <div className="card">
        <h2>
          {label} 결과 <span className="score">{result.total_score}점</span>
        </h2>
        <p className="muted small">
          역량별 점수다. {phase === 'pre' ? '통과 점수에 못 미친 역량이 학습 목표가 된다.' : '사전평가와 비교해 늘어난 역량을 본다.'}
        </p>
        <StatesTable states={enrollment.states} showPost={phase === 'post'} />
        <h3 style={{ marginTop: 14 }}>문항별 결과</h3>
        {result.answers.map((a) => (
          <div className="version" key={a.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>
                <span className="chip">{ITEM_TYPE_LABEL[a.type]}</span> <span className="muted small">{comps.find((c) => c.id === a.competency_id)?.name}</span>
              </span>
              <span className="score">{a.score === null ? '채점 중' : `${Math.round(a.score)}점`}</span>
            </div>
            <p className="small" style={{ margin: '4px 0' }}>
              {a.stem}
            </p>
            <p className="small muted">내 답: {a.answer_text || '(비어 있음)'}</p>
            {a.feedback && <p className="small">{a.feedback}</p>}
          </div>
        ))}
        <button className="btn" onClick={onDone}>
          {phase === 'pre' ? '다음 단계로' : '완료 화면으로'}
        </button>
      </div>
    )
  }

  if (!started) {
    const limit = phase === 'pre' ? enrollment.assignment.pre_time_limit_min : enrollment.assignment.post_time_limit_min
    return (
      <div className="card">
        <h2>{label}</h2>
        <p className="small">
          제한 시간은 {limit}분이고 응시는 한 번이다. 시험 중에는 AI를 쓸 수 없다. 문항은 교수가 정한 역량마다 하나씩이며 선택형은 자동
          채점, 단답형과 완성형은 정답 비교, 서술형과 논술형은 AI가 교수의 채점 기준으로 채점한 뒤 교수가 확인한다.
        </p>
        {phase === 'pre' && (
          <p className="small muted">사전평가 점수는 스펙이 된다. 통과 점수에 못 미친 역량이 학습 단계의 학습 목표다.</p>
        )}
        {error && <p className="error small">{error}</p>}
        <button className="btn" onClick={() => void start()} disabled={busy}>
          시작
        </button>
      </div>
    )
  }

  const startedAt = new Date(started.started_at.endsWith('Z') ? started.started_at : `${started.started_at}Z`).getTime()
  const remaining = Math.min(started.time_limit_min * 60_000, Math.max(0, startedAt + started.time_limit_min * 60_000 - now))
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')
  const comps = enrollment.assignment.competencies

  return (
    <div className="card">
      <div className="card-title">
        <h2>{label}</h2>
        <span className={`timer ${remaining < 60_000 ? 'error' : ''}`}>
          남은 시간 {mm}:{ss}
        </span>
      </div>
      {remaining === 0 && <div className="banner">제한 시간이 지났다. 지금 제출하면 시간 초과로 기록된다.</div>}
      {started.items.map((item, idx) => (
        <div className="version" key={item.id}>
          <div className="row">
            <strong>{idx + 1}.</strong>
            <span className="chip">{ITEM_TYPE_LABEL[item.type]}</span>
            <span className="muted small">{comps.find((c) => c.id === item.competency_id)?.name}</span>
          </div>
          <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{item.stem}</p>
          {item.type === 'choice' ? (
            item.options.map((o, i) => (
              <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit', fontSize: 14 }}>
                <input
                  type="radio"
                  name={`item-${item.id}`}
                  style={{ width: 'auto' }}
                  checked={answers[item.id] === o}
                  onChange={() => setAnswers({ ...answers, [item.id]: o })}
                />
                {o}
              </label>
            ))
          ) : item.type === 'short' || item.type === 'fill' ? (
            <input value={answers[item.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })} placeholder="답" />
          ) : (
            <textarea
              value={answers[item.id] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })}
              style={{ minHeight: item.type === 'essay_long' ? 200 : 100 }}
              placeholder={item.type === 'essay_long' ? '근거를 들어 긴 글로 쓴다' : '몇 문장으로 설명한다'}
            />
          )}
        </div>
      ))}
      {error && <p className="error small">{error}</p>}
      <button className="btn" onClick={() => void submit()} disabled={busy}>
        {busy ? '채점 중' : '제출'}
      </button>
    </div>
  )
}
