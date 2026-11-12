import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'

import {
  api,
  formatDate,
  ITEM_TYPE_LABEL,
  MODE_LABEL,
  type ChatMessage,
  type StudentDetail as Detail,
  type Summary,
  type TestAnswer,
  type TestResult,
} from '../../api'
import { Saved, Status } from '../../ui'
import { round1, when, type State } from './status/shared'

export const STATUS_LABEL: Record<string, string> = { sufficient: '충분', in_progress: '진행 중', insufficient: '부족' }
export const SIGNAL_LABEL: Record<string, string> = {
  non_sequential: '순차적이지 않은 변화',
  logic_gap: '논리적 공백',
  style_shift: '문체 급변',
  other: '기타',
}

// 결과물 변경 이력 탭이 쓰는 요약. 팀원 화면이라 예전 모양 그대로 둔다.
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

// 채점한 쪽. AI 채점은 교수가 확인하기 전이라 빈 점으로 둔다.
const GRADER: Record<string, State> = {
  auto: { label: '자동 채점', tone: 'done' },
  ai: { label: 'AI 채점', tone: 'todo' },
  professor: { label: '교수 확정', tone: 'done' },
}

// 시험 한 번의 답안 표. 줄을 펼치면 정답과 채점 근거가 나오고, 서술형과 논술형은 그 자리에서 교수가 점수를 확정한다.
export function AnswerTable({ result, aid, onChanged }: { result: TestResult; aid: number; onChanged: (d: Detail) => void }) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(a: TestAnswer) {
    setError(null)
    if (openId === a.id) {
      setOpenId(null)
      return
    }
    setOpenId(a.id)
    setScore(a.score === null ? '' : String(a.score))
    setFeedback('')
  }

  async function override(e: FormEvent, answerId: number) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChanged(await api.prof.overrideAnswer(aid, answerId, { score: Number(score), feedback }))
      setOpenId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>번호</th>
            <th>종류</th>
            <th>문항</th>
            <th>답안</th>
            <th className="r">점수</th>
            <th>채점</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {result.answers.map((a, i) => {
            const essay = a.type === 'essay_short' || a.type === 'essay_long'
            const grader = GRADER[a.graded_by]
            const open = openId === a.id
            return (
              <Fragment key={a.id}>
                <tr>
                  <td className="num">{i + 1}</td>
                  <td className="nowrap">{ITEM_TYPE_LABEL[a.type]}</td>
                  <td className="text">{a.stem}</td>
                  <td className="text">{a.answer_text || '비어 있음'}</td>
                  <td className="r">{a.score === null ? '' : round1(a.score)}</td>
                  <td className="nowrap">{grader ? <Status tone={grader.tone}>{grader.label}</Status> : a.graded_by}</td>
                  <td className="nowrap">
                    <button type="button" className="btn toggle" aria-expanded={open} onClick={() => toggle(a)}>
                      {open ? '닫기' : !essay ? '정답 보기' : a.graded_by === 'professor' ? '다시 확인' : '채점 확인'}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="detail">
                    <td colSpan={7}>
                      <dl className="ans wide">
                        <dt>{essay ? '모범 답안' : '정답'}</dt>
                        <dd>{a.expected_answer}</dd>
                        {a.rationale && (
                          <>
                            <dt>AI 채점 근거</dt>
                            <dd>{a.rationale}</dd>
                          </>
                        )}
                        {a.feedback && (
                          <>
                            <dt>피드백</dt>
                            <dd>{a.feedback}</dd>
                          </>
                        )}
                      </dl>
                      {essay && (
                        <form className="inline override" onSubmit={(e) => void override(e, a.id)}>
                          <input
                            className="input num w-score"
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            aria-label="확정 점수"
                            placeholder="점수"
                          />
                          <span>점</span>
                          <input
                            className="input grow"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            aria-label="학생에게 보일 피드백"
                            placeholder="학생에게 보일 피드백, 선택"
                          />
                          <button className="btn primary" type="submit" disabled={busy || score === ''}>
                            교수 확인
                          </button>
                        </form>
                      )}
                      {error && (
                        <p className="error-text" role="alert">
                          {error}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 교수가 다섯 가지 결과물을 보고 넣는 과제 점수와 코멘트
export function GradeForm({ d, aid, onSaved }: { d: Detail; aid: number; onSaved: () => void }) {
  const [score, setScore] = useState(d.grade?.score?.toString() ?? '')
  const [comment, setComment] = useState(d.grade?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.prof.setGrade(aid, d.enrollment_id, { score: score === '' ? null : Number(score), comment })
      setSaved(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setSaved(false), 1800)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form grade-form" onSubmit={(e) => void save(e)}>
      <div className="form-row">
        <label className="label" htmlFor="grade-score">
          과제 점수
        </label>
        <div className="inline">
          <input id="grade-score" className="input num w-score" type="number" min={0} max={100} step="any" value={score} onChange={(e) => setScore(e.target.value)} />
          <span>점</span>
        </div>
      </div>
      <div className="form-row">
        <label className="label" htmlFor="grade-comment">
          코멘트
        </label>
        <textarea id="grade-comment" className="textarea" rows={3} placeholder="학생에게 보일 피드백" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="form-row">
        <span />
        <div className="inline">
          <button className="btn primary" type="submit" disabled={busy}>
            평가 저장
          </button>
          <Saved show={saved} />
          {error && (
            <span className="error-text" role="alert">
              {error}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

// 대화 기록. staged 면 어느 단계의 대화인지도 적는다. AI 응답에는 응답 방식이 붙는다.
export function Log({ messages, staged = false, empty }: { messages: ChatMessage[]; staged?: boolean; empty: string }) {
  return (
    <div className={staged ? 'rows log talk staged' : 'rows log talk'}>
      {messages.map((m) => {
        const mode = m.role === 'ai' && m.mode ? (MODE_LABEL[m.mode] ?? m.mode) : ''
        return (
          <div className="log-row" key={m.id}>
            <span className="num">{when(m.created_at)}</span>
            {staged && <span>{m.stage === 'learning' ? '학습' : `과제 시도 ${m.attempt_no}`}</span>}
            <span className="who">{m.role === 'ai' ? `AI ${mode}`.trim() : '학생'}</span>
            <span className="text">{m.content}</span>
          </div>
        )
      })}
      {messages.length === 0 && <div className="empty">{empty}</div>}
    </div>
  )
}
