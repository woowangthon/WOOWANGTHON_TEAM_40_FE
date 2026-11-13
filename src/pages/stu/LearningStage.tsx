import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, BookOpen, ClipboardX, Gauge, ListChecks, MessagesSquare, ScrollText, Target } from 'lucide-react'

import {
  api,
  ApiError,
  ITEM_TYPE_LABEL,
  MODE_LABEL,
  type ChatMessage,
  type CompetencyState,
  type Enrollment,
  type LearningCheck,
  type LearningState,
  type TestResult,
} from '../../api'
import { DownloadButton } from '../../components/Files'
import { HBar, Loading, Notice, Status, type Tone } from '../../ui'
import { AnswerReview, scoreText, SourceLegend } from './TestStage'

// 서버 요청이 진행 중인 동안만 대화 끝에 보이는 것. 보낸 글과 AI가 쓰는 중이라는 표시다.
type Sending = { kind: 'chat' | 'answer'; text: string } | { kind: 'check' }

type Entry = { at: number; m: ChatMessage; c?: undefined } | { at: number; c: LearningCheck; m?: undefined }

const SENDING_LABEL: Record<Sending['kind'], string> = {
  chat: 'AI가 답을 쓰는 중',
  answer: 'AI가 채점하는 중',
  check: 'AI가 확인 문항을 만드는 중',
}

function timeOf(value: string): number {
  return new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`).getTime()
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot + 1, dot + 5).toUpperCase() : ''
}

// AI 응답에 붙는 표시. 응답 방식과 학습 자료 밖의 내용인지를 알린다.
function flagsOf(m: ChatMessage): [Tone, string][] {
  const flags: [Tone, string][] = []
  if (m.mode) flags.push([m.mode === 'refuse' ? 'alert' : m.mode === 'direct' ? 'done' : 'todo', MODE_LABEL[m.mode] ?? m.mode])
  if (m.meta?.uncertain) flags.push(['alert', '학습 자료 밖'])
  if (m.meta?.refined) flags.push(['todo', '답 노출 수정됨'])
  return flags
}

function Message({ m }: { m: ChatMessage }) {
  if (m.role === 'student') return <div className="msg me">{m.content}</div>
  const flags = flagsOf(m)
  return (
    <div className="msg ai">
      {m.content}
      {flags.length > 0 && (
        <div className="msg-flags">
          {flags.map(([tone, label]) => (
            <Status key={label} tone={tone}>
              {label}
            </Status>
          ))}
        </div>
      )}
    </div>
  )
}

// 확인 문항 하나. 문항, 내 답, 채점 결과가 대화 흐름 안에 차례로 놓인다.
function CheckBlock({
  c,
  state,
  picked,
  onPick,
}: {
  c: LearningCheck
  state: CompetencyState | undefined
  picked?: string
  onPick?: (option: string) => void
}) {
  const type = c.item.type ?? 'essay_short'
  const options = type === 'choice' ? (c.item.options ?? []) : []
  const pass = state?.pass_score ?? 0
  return (
    <>
      <div className="msg ai check">
        <div className="check-head">
          <ListChecks aria-hidden="true" />
          <b>확인 문항</b>
          <span>{state?.name}</span>
          <span>{ITEM_TYPE_LABEL[type]}</span>
        </div>
        <p>{c.item.stem}</p>
        {onPick && options.length > 0 && (
          <div className="opts" role="radiogroup" aria-label="보기">
            {options.map((o, i) => (
              <button key={i} type="button" role="radio" aria-checked={picked === o} className="opt" onClick={() => onPick(o)}>
                <span className="radio" />
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
      {c.answered_at !== null && (
        <>
          <div className="msg me">{c.answer_text}</div>
          <div className="msg ai">
            {c.feedback}
            <div className="msg-flags">
              {c.score === null ? (
                <Status tone="todo">채점 중</Status>
              ) : (
                <Status tone={c.score >= pass ? 'done' : 'doing'}>
                  {scoreText(c.score)}점, 통과 점수 {pass}점
                </Status>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function LearningStage({ enrollment, onDone }: { enrollment: Enrollment; onDone: () => void }) {
  const eid = enrollment.id
  const [state, setState] = useState<LearningState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // undefined 는 불러오는 중, null 은 사전평가 응시 기록이 없다는 뜻이다
  const [pre, setPre] = useState<TestResult | null | undefined>(undefined)
  const [preError, setPreError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState<Sending | null>(null)
  const [finishing, setFinishing] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const refocus = useRef(false)

  const reload = useCallback(() => api.stu.learning(eid).then(setState), [eid])
  useEffect(() => {
    reload().catch((e: Error) => setLoadError(e.message))
  }, [reload])

  useEffect(() => {
    let cancelled = false
    api.stu
      .testResult(eid, 'pre')
      .then((r) => {
        if (!cancelled) setPre(r)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setPre(null)
        if (!(e instanceof ApiError && e.status === 404)) setPreError(e instanceof Error ? e.message : '사전평가 결과를 불러오지 못했다')
      })
    return () => {
      cancelled = true
    }
  }, [eid])

  const messageCount = state?.messages.length ?? 0
  const checkCount = state?.checks.length ?? 0
  useEffect(() => {
    const el = body.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messageCount, checkCount, sending])

  // 보내는 동안 입력 칸이 잠겼다가 풀리면 다시 입력할 수 있게 초점을 돌려준다
  useEffect(() => {
    if (!sending && refocus.current) {
      refocus.current = false
      input.current?.focus()
    }
  }, [sending])

  if (loadError && !state) {
    return (
      <div className="page narrow">
        <Notice kind="error">{loadError}</Notice>
      </div>
    )
  }
  if (!state) return <Loading />

  const active = state.stage === 'learning'
  const busy = sending !== null || finishing
  const pendingCheck = state.checks.find((c) => c.answered_at === null)
  const stateOf = (cid: number) => state.states.find((s) => s.competency_id === cid)
  // 사전평가에서 통과 점수에 못 미친 역량이 학습 목표다. 통과한 뒤에도 목록에 남긴다.
  const goals = state.states.filter((s) => !s.passed || (s.pre_score !== null && s.pre_score < s.pass_score))
  const remaining = goals.filter((s) => !s.passed)
  const base = `/stu/enrollments/${eid}`

  async function send() {
    const message = text.trim()
    if (!message || busy || !active) return
    setError(null)
    setText('')
    refocus.current = true
    if (pendingCheck) {
      setSending({ kind: 'answer', text: message })
      try {
        setState(await api.stu.answerCheck(eid, pendingCheck.id, message))
      } catch (e) {
        setText(message)
        setError(e instanceof Error ? e.message : '채점 실패')
      } finally {
        setSending(null)
      }
      return
    }
    setSending({ kind: 'chat', text: message })
    try {
      const msgs = await api.stu.learningChat(eid, message)
      setState((prev) => (prev ? { ...prev, messages: [...prev.messages, ...msgs] } : prev))
    } catch (e) {
      setText(message)
      setError(e instanceof Error ? e.message : '전송 실패')
    } finally {
      setSending(null)
    }
  }

  async function requestCheck(cid: number) {
    if (busy) return
    setError(null)
    setSending({ kind: 'check' })
    try {
      await api.stu.newCheck(eid, cid)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 문항 실패')
    } finally {
      setSending(null)
    }
  }

  async function finish() {
    setFinishing(true)
    setError(null)
    try {
      await api.stu.finishLearning(eid)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패')
    } finally {
      setFinishing(false)
    }
  }

  // 대화와 확인 문항을 만든 시각 순서로 한 줄에 세운다
  const entries: Entry[] = [
    ...state.messages.map((m): Entry => ({ at: timeOf(m.created_at), m })),
    ...state.checks.map((c): Entry => ({ at: timeOf(c.created_at), c })),
  ].sort((x, y) => x.at - y.at)

  const head =
    !active || remaining.length === 0
      ? '학습 목표를 모두 채웠다'
      : pendingCheck
        ? `확인 문항 ${stateOf(pendingCheck.competency_id)?.name ?? ''}`
        : remaining.map((s) => s.name).join(', ')

  const wrong = (pre?.answers ?? [])
    .map((a, i) => ({ a, no: i + 1, s: stateOf(a.competency_id) }))
    .filter(({ a, s }) => s !== undefined && a.score !== null && a.score < s.pass_score)

  const materials = enrollment.assignment.materials

  return (
    <div className="learn">
      <aside>
        <div className="block">
          <h2>
            <Gauge aria-hidden="true" />내 스펙
          </h2>
          {state.states.map((s, i) => {
            const score = s.current_score ?? s.pre_score
            return (
              <div className="spec-row" key={s.competency_id}>
                <span title={s.name}>{s.name}</span>
                <HBar value={score ?? 0} mark={s.pass_score} i={i} />
                <span className="r">{score === null ? '' : Math.round(score)}</span>
              </div>
            )
          })}
        </div>

        <div className="block">
          <h2>
            <Target aria-hidden="true" />
            학습 목표
          </h2>
          {goals.length === 0 && <div className="empty">사전평가에서 모든 역량을 통과했다</div>}
          {goals.map((s) => (
            <div className="goal" key={s.competency_id}>
              <span title={s.name}>{s.name}</span>
              <Status tone={s.passed ? 'done' : 'doing'}>{s.passed ? '통과' : '학습 중'}</Status>
              {active && !s.passed && (
                <button type="button" className="btn" onClick={() => void requestCheck(s.competency_id)} disabled={busy || Boolean(pendingCheck)}>
                  확인 문항
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="block">
          {active ? (
            <button type="button" className="btn primary block" onClick={() => void finish()} disabled={!state.can_finish || busy}>
              {finishing ? '학습 과정을 요약하는 중' : '과제 단계로'}
            </button>
          ) : (
            <Link className="btn block" to={`${base}/task`}>
              과제 단계로
            </Link>
          )}
        </div>

        {state.student_rules.length > 0 && (
          <div className="block">
            <h2>
              <ScrollText aria-hidden="true" />
              규칙
            </h2>
            <ul className="rule-list">
              {state.student_rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="block">
          <h2>
            <BookOpen aria-hidden="true" />
            학습 자료
          </h2>
          {materials.length === 0 && <div className="empty">교수가 올린 학습 자료가 없다. AI는 일반 지식으로 답한다</div>}
          {materials.map((m) => (
            <div className="file" key={m.id}>
              <span className="ext">{extOf(m.filename)}</span>
              <span className="fname" title={m.filename}>
                {m.filename}
              </span>
              <DownloadButton path={api.stu.materialPath(eid, m.id)} filename={m.filename} label="내려받기" className="btn" />
            </div>
          ))}
        </div>
      </aside>

      <section className="chat" aria-label="학습 AI와 나눈 대화">
        <div className="chat-head">
          <MessagesSquare aria-hidden="true" />
          <span>{head}</span>
        </div>
        <div className="chat-body" ref={body}>
          <div className="chat-col">
            {entries.length === 0 && !sending && <div className="empty">아직 나눈 대화가 없다</div>}
            {entries.map((en) =>
              en.m ? (
                <Message key={`m${en.m.id}`} m={en.m} />
              ) : (
                <CheckBlock
                  key={`c${en.c.id}`}
                  c={en.c}
                  state={stateOf(en.c.competency_id)}
                  picked={text}
                  onPick={active && !busy && en.c.id === pendingCheck?.id ? setText : undefined}
                />
              ),
            )}
            {sending && sending.kind !== 'check' && <div className="msg me">{sending.text}</div>}
            {sending && (
              <div className="msg ai" role="status" aria-label={SENDING_LABEL[sending.kind]}>
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="chat-alert">
            <Notice kind="error" onClose={() => setError(null)}>
              {error}
            </Notice>
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <textarea
            ref={input}
            rows={1}
            value={text}
            disabled={!active || busy}
            placeholder={!active ? '학습 단계가 끝났다' : pendingCheck ? '확인 문항의 답을 입력한다' : '질문을 입력한다'}
            aria-label={pendingCheck ? '확인 문항의 답' : '메시지'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button className="btn primary icon" type="submit" aria-label={pendingCheck ? '답 제출' : '보내기'} disabled={!text.trim() || busy || !active}>
            <ArrowUp aria-hidden="true" />
          </button>
        </form>
      </section>

      <aside>
        <div className="block">
          <h2>
            <ClipboardX aria-hidden="true" />
            틀린 문항
          </h2>
          {preError ? (
            <Notice kind="error">{preError}</Notice>
          ) : pre === undefined ? (
            <Loading />
          ) : wrong.length === 0 ? (
            <div className="empty">{pre ? '틀린 문항이 없다' : '사전평가 결과가 없다'}</div>
          ) : (
            <>
              <SourceLegend />
              <div className="wrong">
                {wrong.map(({ a, no, s }, i) => (
                  <AnswerReview
                    key={a.id}
                    a={a}
                    no={no}
                    competency={s?.name ?? ''}
                    pass={s?.pass_score ?? 0}
                    i={i}
                    end={<Status tone={s?.passed ? 'done' : 'doing'}>{s?.passed ? '통과' : '학습 중'}</Status>}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
