import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Bot, ClipboardPaste, Pencil, SquareTerminal } from 'lucide-react'

import {
  api,
  ITEM_TYPE_LABEL,
  MODE_LABEL,
  type ChatMessage,
  type StudentDetail as Detail,
  type Summary,
  type TestAnswer,
  type TestResult,
  type Version,
} from '../../api'
import { AuthImage, DownloadButton } from '../../components/Files'
import { Meta, Saved, Section, Status, type Tone } from '../../ui'
import type { DiffLine } from '../stu/workspace/wsApi'
import { Empty, round1, when, type State } from './status/shared'

export const STATUS_LABEL: Record<string, string> = { sufficient: '충분', in_progress: '진행 중', insufficient: '부족' }
export const SIGNAL_LABEL: Record<string, string> = {
  non_sequential: '순차적이지 않은 변화',
  logic_gap: '논리적 공백',
  style_shift: '문체 급변',
  other: '기타',
}

// AI 요약이 역량마다 붙인 상태의 점 색
const SUMMARY_TONE: Record<string, Tone> = { sufficient: 'done', in_progress: 'doing', insufficient: 'alert' }

// AI 요약 하나. 역량별 한 줄과 스펙, 학습 내용, AI 사용 방식을 한 표에 놓는다. 학습 과정 탭과 결과물 변경 이력 탭이 같이 쓴다.
export function SummaryView({ s }: { s: Summary }) {
  const c = s.content
  const lines: [string, string | undefined][] = [
    ['스펙', c.spec_summary],
    ['학습 내용', c.learned_summary],
    ['AI 사용 방식', c.ai_usage_line],
  ]
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>항목</th>
            <th>상태</th>
            <th>요약</th>
          </tr>
        </thead>
        <tbody>
          {(c.competencies ?? []).map((x, i) => (
            <tr key={i}>
              <td className="strong">{x.competency_name}</td>
              <td>
                <Status tone={SUMMARY_TONE[x.status] ?? 'todo'}>{STATUS_LABEL[x.status] ?? x.status}</Status>
              </td>
              <td className="text">{x.line}</td>
            </tr>
          ))}
          {lines.map(
            ([name, text]) =>
              text && (
                <tr key={name}>
                  <td className="strong">{name}</td>
                  <td />
                  <td className="text">{text}</td>
                </tr>
              ),
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------- 결과물 변경 이력 ----------
type Author = 'human' | 'ai' | 'paste' | 'run'

// 버전을 만든 쪽. 값, 화면에 적는 이름, 목록 줄 왼쪽에 놓는 아이콘 순이다.
const AUTHORS: [Author, string, LucideIcon][] = [
  ['human', '직접 작성', Pencil],
  ['ai', 'AI 수정안', Bot],
  ['paste', '붙여넣기', ClipboardPaste],
  ['run', '실행', SquareTerminal],
]

interface RunMeta {
  compile_error?: string | null
  error?: string
  total?: number
  passed?: number
  exit_code?: number | null
  timed_out?: boolean
  duration?: number
  stdout?: string
  env?: string
}

// 작업공간이 버전마다 남긴 기록. 모양은 backend/app/routers/workspace.py 의 make_commit 과 run_code 가 정한다.
interface VersionMeta {
  author?: string
  plus?: number
  minus?: number
  diff?: DiffLine[]
  prompt?: string
  reason?: string
  edited_from_ai?: boolean
  ai_text?: string
  paste?: { source?: string | null; memo?: string; lines?: number; chars?: number }
  run?: RunMeta
}

const metaOf = (v: Version) => v.meta as VersionMeta

// 기록이 없는 예전 버전은 서버와 같이 학생이 직접 쓴 것으로 본다.
function authorOf(v: Version): Author {
  const a = metaOf(v).author
  return a === 'ai' || a === 'paste' || a === 'run' ? a : 'human'
}

function runState(r: RunMeta): State {
  if (r.compile_error) return { label: '컴파일 오류', tone: 'alert' }
  if (r.error) return { label: '실행 실패', tone: 'alert' }
  if (r.total) return { label: `테스트 ${r.total}개 중 ${r.passed ?? 0}개 통과`, tone: (r.passed ?? 0) < r.total ? 'alert' : 'done' }
  if (r.timed_out) return { label: '시간 초과', tone: 'alert' }
  return { label: `종료 코드 ${r.exit_code ?? 0}`, tone: r.exit_code ? 'alert' : 'done' }
}

// 목록 줄과 요약 띠에 적는 변경 크기. 실행은 결과를, 나머지는 추가와 삭제 줄 수를 적는다.
function Change({ v }: { v: Version }) {
  const m = metaOf(v)
  if (m.run) {
    const state = runState(m.run)
    return <Status tone={state.tone}>{state.label}</Status>
  }
  if (!Array.isArray(m.diff)) return null
  return (
    <span className="num">
      +{m.plus ?? 0} -{m.minus ?? 0}
    </span>
  )
}

// 앞 버전과 달라진 줄. 추가와 삭제는 바탕색과 줄 앞의 기호로 함께 알린다.
function Diff({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="diff">
      {lines.map((d, i) => (
        <div key={i} className={d.type === 'ctx' ? undefined : d.type}>
          <span className="no">{d.no || ''}</span>
          <span>{d.type === 'add' ? '+' : d.type === 'del' ? '-' : ''}</span>
          <span>{d.text}</span>
        </div>
      ))}
    </div>
  )
}

// 이름과 값 한 줄
function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{children}</dd>
    </>
  )
}

function VersionDetail({ v, filePath, full, setFull }: { v: Version; filePath: string; full: boolean; setFull: (full: boolean) => void }) {
  const m = metaOf(v)
  const author = authorOf(v)
  const diff = Array.isArray(m.diff) ? m.diff : []
  const text = v.text_content ?? ''
  const run = m.run
  const ran = run ? runState(run) : null
  const problem = run?.compile_error || run?.error
  // 변경과 전체 내용이 둘 다 있을 때만 고르게 한다. 변경 기록이 없는 버전은 전체 내용을 바로 보여 준다.
  const both = diff.length > 0 && text !== ''
  const showFull = both ? full : diff.length === 0

  return (
    <div className="detail">
      <Meta
        items={[
          ['버전', v.version_no],
          ['작성', AUTHORS.find(([key]) => key === author)?.[1]],
          ['시각', when(v.created_at)],
        ]}
      />
      <dl className="ans wide">
        {v.file_name && (
          <Fact name="파일">
            <span className="mono">{v.file_name}</span>
          </Fact>
        )}
        {diff.length > 0 && (
          <Fact name="변경">
            <Change v={v} />
          </Fact>
        )}
        {run && ran ? (
          <>
            <Fact name="결과">
              <Status tone={ran.tone}>{ran.label}</Status>
            </Fact>
            {run.duration != null && <Fact name="실행 시간">{`${run.duration}초`}</Fact>}
            {run.env && <Fact name="환경">{run.env === 'professor' ? '교수 지정 환경' : '서비스 기본 환경'}</Fact>}
            {problem && (
              <Fact name="오류">
                <pre className="raw">{problem}</pre>
              </Fact>
            )}
            {run.stdout && (
              <Fact name="출력">
                <pre className="raw">{run.stdout}</pre>
              </Fact>
            )}
          </>
        ) : (
          <Fact name="요약">{v.reason}</Fact>
        )}
        {m.prompt && <Fact name="학생 요청">{m.prompt}</Fact>}
        {m.reason && <Fact name="AI의 수정 이유">{m.reason}</Fact>}
        {m.edited_from_ai && <Fact name="반영 방식">AI 수정안을 학생이 고쳐서 반영했다</Fact>}
        {m.edited_from_ai && m.ai_text && (
          <Fact name="AI 원안">
            <pre className="raw">{m.ai_text}</pre>
          </Fact>
        )}
        {m.paste && (
          <>
            <Fact name="출처">{m.paste.source || <Status tone="alert">출처 미기입</Status>}</Fact>
            {m.paste.memo && <Fact name="메모">{m.paste.memo}</Fact>}
            <Fact name="분량">{`${m.paste.lines ?? 0}줄, ${m.paste.chars ?? 0}자`}</Fact>
          </>
        )}
      </dl>
      {(both || v.has_file) && (
        <div className="inline">
          {both && (
            <div className="seg" role="group" aria-label="보기 방식">
              <button type="button" aria-pressed={!full} onClick={() => setFull(false)}>
                변경 내용
              </button>
              <button type="button" aria-pressed={full} onClick={() => setFull(true)}>
                전체 내용
              </button>
            </div>
          )}
          {v.has_file && <DownloadButton path={filePath} filename={v.file_name} label="파일 내려받기" />}
        </div>
      )}
      {v.kind === 'image' && v.has_file && <AuthImage path={filePath} alt={`버전 ${v.version_no}`} />}
      {!showFull && <Diff lines={diff} />}
      {showFull && text !== '' && <pre className="raw">{text}</pre>}
      {v.kind === 'file' && text === '' && <div className="note">텍스트를 뽑지 못한 파일이다. 파일을 내려받아 확인한다</div>}
    </div>
  )
}

// 한 시도의 버전 전체. 왼쪽 목록에서 버전을 고르면 오른쪽에 누가 만들었는지와 앞 버전과 달라진 줄이 나온다.
export function VersionHistory({ versions, filePath }: { versions: Version[]; filePath: (vid: number) => string }) {
  const [filter, setFilter] = useState<Author | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [full, setFull] = useState(false)
  // 가장 나중 버전을 맨 위에 둔다.
  const all = [...versions].reverse()
  const list = filter ? all.filter((v) => authorOf(v) === filter) : all
  const selected = list.find((v) => v.id === picked) ?? list[0]

  return (
    <Section title="변경 이력">
      {all.length === 0 ? (
        <Empty>저장된 버전이 없다</Empty>
      ) : (
        <>
          <div className="toolbar">
            <div className="seg" role="group" aria-label="작성 종류 고르기">
              <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>
                전체 {all.length}
              </button>
              {AUTHORS.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {label} {all.filter((v) => authorOf(v) === key).length}
                </button>
              ))}
            </div>
          </div>
          <div className="history">
            <div className="rows">
              {list.map((v) => {
                const [, label, Icon] = AUTHORS.find(([key]) => key === authorOf(v)) ?? AUTHORS[0]
                return (
                  <button key={v.id} type="button" className="row" aria-pressed={selected?.id === v.id} onClick={() => setPicked(v.id)}>
                    <span className="num no">{v.version_no}</span>
                    <Icon aria-hidden="true" />
                    <span className="who">{label}</span>
                    <span className="mono path">{v.file_name}</span>
                    <span className="end">
                      <Change v={v} />
                    </span>
                  </button>
                )
              })}
              {list.length === 0 && <div className="empty">이 종류의 버전이 없다</div>}
            </div>
            {selected && <VersionDetail key={selected.id} v={selected} filePath={filePath(selected.id)} full={full} setFull={setFull} />}
          </div>
        </>
      )}
    </Section>
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
