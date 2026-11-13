import { useEffect, useState, type ReactNode } from 'react'
import { Check, Clock, ListChecks, MessageSquareOff, Repeat1, Save, SpellCheck, Timer } from 'lucide-react'

import {
  api,
  ApiError,
  ITEM_TYPE_LABEL,
  type AnswerBasis,
  type Enrollment,
  type ItemPublic,
  type Phase,
  type Stage,
  type TestAnswer,
  type TestResult,
  type TestStart,
} from '../../api'
import { CountUp, dateTime, HBar, Loading, Meta, Notice, PageHead, Section, Status, vars } from '../../ui'

// 점수는 정수면 그대로, 아니면 소수 한 자리로 적는다.
export function scoreText(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

// 채점 근거의 출처. 색과 이름을 항상 같이 보여 준다.
const SOURCES: { source: AnswerBasis['source']; cls: string; label: string }[] = [
  { source: 'criteria', cls: 'src-rule', label: '교수 채점 기준' },
  { source: 'material', cls: 'src-material', label: '학습 자료' },
  { source: 'ai', cls: 'src-ai', label: 'AI 판단' },
]

export function SourceLegend() {
  return (
    <div className="src-legend" role="group" aria-label="근거의 출처">
      {SOURCES.map((s) => (
        <span key={s.source} className={s.cls}>
          <i />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// 글로 보여 줄 근거. 정답 비교로 채점한 답은 근거가 늘 같은 문장이라 글로 적지 않고 표시 색으로만 알린다.
function basisOf(a: TestAnswer): AnswerBasis[] {
  if (a.graded_by === 'auto') return []
  const given = a.basis.filter((b) => b.text.trim() && SOURCES.some((s) => s.source === b.source))
  if (given.length > 0) return given
  if (!a.feedback) return []
  return [{ source: a.graded_by === 'professor' ? 'criteria' : 'ai', text: a.feedback }]
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 틀린 부분이 답안의 어디에 있는지 찾는다. 공백이나 줄바꿈만 다르게 옮겨진 경우도 받아 준다.
function locate(text: string, span: string): [number, number] | null {
  const s = span.trim()
  if (!s) return null
  const at = text.indexOf(s)
  if (at >= 0) return [at, at + s.length]
  const m = new RegExp(s.split(/\s+/).map(escapeRe).join('\\s+')).exec(text)
  return m ? [m.index, m.index + m[0].length] : null
}

function markParts(text: string, spans: string[]): { t: string; bad: boolean }[] {
  const ranges = spans
    .map((s) => locate(text, s))
    .filter((r): r is [number, number] => r !== null)
    .sort((x, y) => x[0] - y[0])
  const parts: { t: string; bad: boolean }[] = []
  let pos = 0
  for (const [from, to] of ranges) {
    if (to <= pos) continue
    const start = Math.max(from, pos)
    if (start > pos) parts.push({ t: text.slice(pos, start), bad: false })
    parts.push({ t: text.slice(start, to), bad: true })
    pos = to
  }
  if (pos < text.length) parts.push({ t: text.slice(pos), bad: false })
  return parts
}

// 채점한 문항 하나. 문항과 내 답과 점수를 보여 주고 틀린 부분은 근거의 출처 색으로 표시한다.
// AI 가 찾아낸 부분은 AI 판단 색, 정답 비교나 교수 채점으로 틀린 부분은 교수 채점 기준 색이다.
export function AnswerReview({
  a,
  no,
  competency,
  pass,
  end,
  i = 0,
}: {
  a: TestAnswer
  no: number
  competency: string
  pass: number
  end?: ReactNode
  i?: number
}) {
  const wrong = a.score !== null && a.score < pass
  // 정답 비교로 채점한 답은 틀리면 답 전체가 틀린 것이다
  const cut = wrong && a.graded_by === 'auto'
  const parts = cut ? [{ t: a.answer_text, bad: true }] : markParts(a.answer_text, a.wrong_spans)
  const basis = basisOf(a)
  const markCls = a.graded_by === 'ai' ? 'src-ai' : 'src-rule'

  return (
    <article className="wrong-item" style={vars({ '--i': i })}>
      <header className="wrong-head">
        <span>
          {no}번 {ITEM_TYPE_LABEL[a.type]}
        </span>
        <span>{competency}</span>
        {end && <span className="end">{end}</span>}
      </header>
      <div className="wrong-body">
        <p className="wrong-q">{a.stem}</p>
        <dl className="ans">
          <dt>내 답</dt>
          <dd>
            {a.answer_text
              ? parts.map((p, k) =>
                  p.bad ? (
                    <mark key={k} className={cut ? `bad cut ${markCls}` : `bad ${markCls}`}>
                      {p.t}
                    </mark>
                  ) : (
                    <span key={k}>{p.t}</span>
                  ),
                )
              : '미입력'}
          </dd>
          {a.expected_answer && (
            <>
              <dt>정답</dt>
              <dd className="good">{a.expected_answer}</dd>
            </>
          )}
          <dt>점수</dt>
          <dd className="num">{a.score === null ? '채점 중' : `${scoreText(a.score)}점, 통과 점수 ${pass}점`}</dd>
        </dl>
        {basis.length > 0 && (
          <div className="basis">
            {basis.map((b, k) => {
              const src = SOURCES.find((s) => s.source === b.source) ?? SOURCES[2]
              return (
                <div key={k} className={src.cls}>
                  <b>{src.label}</b>
                  {b.text}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}

// 쓰던 답은 시험 하나마다 이 기기에 임시로 저장한다. 화면을 다시 열어도 이어서 쓸 수 있고 제출하면 지운다.
function draftKey(attemptId: number): string {
  return `woowang_test_draft_${attemptId}`
}

function loadDraft(attemptId: number): Record<number, string> {
  try {
    const raw = localStorage.getItem(draftKey(attemptId))
    return raw ? (JSON.parse(raw) as Record<number, string>) : {}
  } catch {
    return {}
  }
}

function saveDraft(attemptId: number, answers: Record<number, string>): void {
  try {
    localStorage.setItem(draftKey(attemptId), JSON.stringify(answers))
  } catch {
    // 저장소를 못 쓰는 환경이면 임시 저장 없이 진행한다
  }
}

function clearDraft(attemptId: number): void {
  try {
    localStorage.removeItem(draftKey(attemptId))
  } catch {
    // 지우지 못해도 다음 시험과 키가 달라 섞이지 않는다
  }
}

// 완성형 문항에서 빈칸 자리를 찾는다. 밑줄이 이어진 곳, 비어 있는 괄호, 네모를 빈칸으로 본다.
const BLANK = /_{2,}|\(\s+\)|（\s+）|\[\s+\]|□+/

function blankOf(stem: string): { text: string; before: string; after: string } | null {
  const lines = stem.split('\n')
  const at = lines.findIndex((l) => BLANK.test(l))
  if (at < 0) return null
  const m = BLANK.exec(lines[at])
  if (!m) return null
  return {
    text: lines
      .filter((_, i) => i !== at)
      .join('\n')
      .trim(),
    before: lines[at].slice(0, m.index),
    after: lines[at].slice(m.index + m[0].length),
  }
}

function Question({
  item,
  no,
  competency,
  value,
  onChange,
}: {
  item: ItemPublic
  no: number
  competency: string
  value: string
  onChange: (v: string) => void
}) {
  const id = `q${no}`
  const blank = item.type === 'fill' ? blankOf(item.stem) : null
  const text = blank ? blank.text : item.stem
  const labelled = text ? `${id}-text` : `${id}-head`
  const long = item.type === 'essay_long'

  return (
    <section className="q" id={id}>
      <div className="q-head" id={`${id}-head`}>
        <b>{no}번</b>
        <span>{ITEM_TYPE_LABEL[item.type]}</span>
        <span>{competency}</span>
      </div>
      {text && (
        <p className="q-text" id={`${id}-text`}>
          {text}
        </p>
      )}
      {blank ? (
        <div className="cloze">
          <span>{blank.before}</span>
          <input className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="빈칸에 들어갈 말" />
          <span>{blank.after}</span>
        </div>
      ) : item.type === 'choice' && item.options.length > 0 ? (
        <div className="opts" role="radiogroup" aria-labelledby={labelled}>
          {item.options.map((o, i) => (
            <button key={i} type="button" role="radio" aria-checked={value === o} className="opt" onClick={() => onChange(o)}>
              <span className="radio" />
              {o}
            </button>
          ))}
        </div>
      ) : item.type === 'essay_short' || long ? (
        <>
          <textarea
            className="textarea"
            rows={long ? 10 : 4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={long ? '근거를 들어 긴 글로 쓴다' : '몇 문장으로 설명한다'}
            aria-labelledby={labelled}
          />
          {long && <div className="count-line">{value.length}자</div>}
        </>
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-labelledby={labelled} />
      )}
    </section>
  )
}

// 사전평가 결과에서 다음으로 가는 버튼의 이름. 모든 역량을 통과하면 학습을 건너뛰고 과제로 간다.
const NEXT_LABEL: Record<Stage, string> = {
  pre: '다음 단계로',
  learning: '학습 시작',
  task: '과제 단계로',
  post: '사후평가로',
  done: '과제 단계로',
}

function ResultView({ enrollment, phase, result, onDone }: { enrollment: Enrollment; phase: Phase; result: TestResult; onDone: () => void }) {
  const label = phase === 'pre' ? '사전평가' : '사후평가'
  const comps = enrollment.assignment.competencies
  const rows = comps.map((c) => {
    const v = result.competency_scores[String(c.id)]
    const has = typeof v === 'number'
    return { c, v: has ? v : null, ok: has && v >= c.pass_score }
  })
  const passed = rows.filter((r) => r.ok).length
  const goals = rows.filter((r) => r.v !== null && !r.ok).length
  const total = result.total_score
  // 제한 시간을 넘겨 제출하면 서버가 이 표시를 남긴다
  const late = Boolean(result.competency_scores._time_exceeded)
  const submittedAt = dateTime(result.submitted_at)

  const meta: [string, ReactNode][] = [
    [
      '총점',
      total === null ? (
        '채점 중'
      ) : (
        <>
          <CountUp to={total} digits={Number.isInteger(total) ? 0 : 1} />점
        </>
      ),
    ],
    ['통과한 역량', `${passed}개`],
  ]
  if (phase === 'pre') meta.push(['학습 목표', `${goals}개`])
  meta.push(['제출', late ? <Status tone="alert">{submittedAt} 시간 초과</Status> : submittedAt])

  return (
    <div className="page narrow stu-page">
      <PageHead title={`${label} 결과`}>
        <button type="button" className="btn primary" onClick={onDone}>
          {phase === 'pre' ? NEXT_LABEL[result.stage] : '결과 보기'}
        </button>
      </PageHead>
      <Meta items={meta} />
      <Section title="역량별 점수">
        <div className="rows score-rows">
          {rows.map(({ c, v, ok }, i) => (
            <div className="row" key={c.id}>
              <span className="name">{c.name}</span>
              <div className="grow">
                <HBar value={v ?? 0} mark={c.pass_score} i={i} />
              </div>
              <span className="val num">{v === null ? '' : scoreText(v)}</span>
              <span className="st">
                {v === null ? (
                  <Status tone="todo">미측정</Status>
                ) : ok ? (
                  <Status tone="done">통과</Status>
                ) : phase === 'pre' ? (
                  <Status tone="doing">학습 목표</Status>
                ) : (
                  <Status tone="alert">통과 점수 미달</Status>
                )}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="문항별 결과">
        <SourceLegend />
        <div className="wrong">
          {result.answers.map((a, i) => {
            const c = comps.find((x) => x.id === a.competency_id)
            return <AnswerReview key={a.id} a={a} no={i + 1} competency={c?.name ?? ''} pass={c?.pass_score ?? 0} i={i} />
          })}
        </div>
      </Section>
    </div>
  )
}

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
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState<TestStart | null>(null)
  const [resumed, setResumed] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 이미 제출했으면 결과를, 시작만 해 두었으면 그 시험을 이어서 보여 준다
  useEffect(() => {
    let cancelled = false
    const notFound = (e: unknown) => e instanceof ApiError && e.status === 404
    async function load() {
      try {
        const res = await api.stu.testResult(eid, phase)
        if (!cancelled) setResult(res)
        return
      } catch (e) {
        if (!notFound(e)) throw e
      }
      try {
        const open = await api.stu.testOpen(eid, phase)
        if (cancelled) return
        setStarted(open)
        setAnswers(loadDraft(open.attempt_id))
        setResumed(true)
      } catch (e) {
        if (!notFound(e)) throw e
      }
    }
    load()
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '오류')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
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
      const res = await api.stu.testStart(eid, phase)
      setStarted(res)
      setAnswers(loadDraft(res.attempt_id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '시작 실패')
    } finally {
      setBusy(false)
    }
  }

  function setAnswer(itemId: number, value: string) {
    if (!started) return
    const next = { ...answers, [itemId]: value }
    setAnswers(next)
    saveDraft(started.attempt_id, next)
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
      clearDraft(started.attempt_id)
      setResult(res)
      setStarted(null)
      setConfirming(false)
      // 길게 내려가 있던 시험 화면에서 결과 화면의 맨 위로 올라간다
      window.scrollTo({ top: 0 })
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  if (result) return <ResultView enrollment={enrollment} phase={phase} result={result} onDone={onDone} />

  if (!started) {
    const limit = phase === 'pre' ? enrollment.assignment.pre_time_limit_min : enrollment.assignment.post_time_limit_min
    return (
      <div className="page narrow stu-page">
        <PageHead title={label}>
          <button type="button" className="btn primary" onClick={() => void start()} disabled={busy}>
            시작
          </button>
        </PageHead>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="rows facts">
          <div className="row">
            <Timer aria-hidden="true" />
            <span>제한 시간</span>
            <span className="end">{limit}분</span>
          </div>
          <div className="row">
            <Repeat1 aria-hidden="true" />
            <span>응시</span>
            <span className="end">한 번</span>
          </div>
          <div className="row">
            <MessageSquareOff aria-hidden="true" />
            <span>AI 도움</span>
            <span className="end">시험 중 없음</span>
          </div>
          <div className="row">
            <Clock aria-hidden="true" />
            <span>시간</span>
            <span className="end">시작하면 화면을 닫아도 흐른다</span>
          </div>
          <div className="row">
            <Save aria-hidden="true" />
            <span>쓰던 답</span>
            <span className="end">이 기기에 임시 저장된다</span>
          </div>
          <div className="row">
            <SpellCheck aria-hidden="true" />
            <span>채점</span>
            <span className="end">서술형과 논술형은 AI가 채점하고 교수가 확인한다</span>
          </div>
        </div>
      </div>
    )
  }

  const startedAt = new Date(started.started_at.endsWith('Z') ? started.started_at : `${started.started_at}Z`).getTime()
  const remaining = Math.min(started.time_limit_min * 60_000, Math.max(0, startedAt + started.time_limit_min * 60_000 - now))
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')
  const comps = enrollment.assignment.competencies
  const done = (item: ItemPublic) => Boolean((answers[item.id] ?? '').trim())
  const answered = started.items.filter(done).length
  const unanswered = started.items.length - answered

  return (
    <div className="exam">
      <div>
        <PageHead title={label} />
        {resumed && (
          <Notice onClose={() => setResumed(false)}>
            시작해 둔 시험을 이어서 본다. 시간은 처음 시작한 때부터 흘렀고 이 기기에 임시 저장된 답을 불러왔다
          </Notice>
        )}
        {remaining === 0 && <Notice kind="error">제한 시간이 지났다. 지금 제출하면 시간 초과로 기록된다</Notice>}
        {started.items.map((item, idx) => (
          <Question
            key={item.id}
            item={item}
            no={idx + 1}
            competency={comps.find((c) => c.id === item.competency_id)?.name ?? ''}
            value={answers[item.id] ?? ''}
            onChange={(v) => setAnswer(item.id, v)}
          />
        ))}
      </div>

      <aside className="rail">
        <div className="rows">
          <div className="row">
            <Timer aria-hidden="true" />
            <span>남은 시간</span>
            <span className={remaining < 60_000 ? 'end timer error-text' : 'end timer'} role="timer">
              {mm}:{ss}
            </span>
          </div>
          <div className="row">
            <ListChecks aria-hidden="true" />
            <span>답한 문항</span>
            <span className="end">
              {started.items.length}개 중 {answered}개
            </span>
          </div>
        </div>
        <nav className="qnav" aria-label="문항 이동">
          {started.items.map((item, idx) => (
            <button key={item.id} type="button" onClick={() => document.getElementById(`q${idx + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <span>
                {idx + 1}번 {ITEM_TYPE_LABEL[item.type]}
              </span>
              {done(item) && <Check aria-label="답함" />}
            </button>
          ))}
        </nav>
        {error && <Notice kind="error">{error}</Notice>}
        {confirming ? (
          <div className="confirm" role="alertdialog" aria-label="제출 확인">
            <p>{unanswered > 0 ? `답하지 않은 문항이 ${unanswered}개 있다. ` : ''}제출하면 다시 응시할 수 없다.</p>
            <div className="inline">
              <button type="button" className="btn block" onClick={() => setConfirming(false)} disabled={busy}>
                계속 풀기
              </button>
              <button type="button" className="btn primary block" onClick={() => void submit()} disabled={busy}>
                {busy ? '채점 중' : '제출'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn primary lg block" onClick={() => setConfirming(true)} disabled={busy}>
            제출
          </button>
        )}
      </aside>
    </div>
  )
}
