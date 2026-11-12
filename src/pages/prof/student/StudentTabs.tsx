import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, TriangleAlert } from 'lucide-react'

import { api, formatDate, MODE_LABEL, type Phase } from '../../../api'
import VersionList from '../../../components/VersionList'
import { statusNav } from '../../../nav'
import { HBar, Meta, Section, Status, type Tone } from '../../../ui'
import { Empty, learningState, letterOf, round1, stageState, taskState, when, type State } from '../status/shared'
import { AnswerTable, GradeForm, Log, SIGNAL_LABEL, STATUS_LABEL, SummaryView } from '../studentParts'
import { useStudent } from './StudentLayout'

const points = (v: number | null) => (v === null ? '' : `${round1(v)}점`)

// AI 요약이 역량마다 붙인 상태의 점 색
const SUMMARY_TONE: Record<string, Tone> = { sufficient: 'done', in_progress: 'doing', insufficient: 'alert' }

// 제한 시간을 넘겨 낸 시험에만 붙는 요약 칸
const timeExceeded: [string, ReactNode] = ['제한 시간', <Status tone="alert">초과</Status>]

function StageIcon({ path }: { path: string }) {
  const Icon = statusNav.find((n) => n[1] === path)?.[2]
  return Icon ? <Icon aria-hidden="true" /> : null
}

export function OverviewTab() {
  const { aid, d, reload } = useStudent()
  const base = `/prof/assignments/${aid}/students/${d.enrollment_id}`
  const stage = stageState(d.stage, d.attempts.length > 0)
  const goals = d.states.filter((s) => s.pre_score !== null && s.pre_score < s.pass_score)
  const asked = d.messages.filter((m) => m.stage === 'learning' && m.role === 'student').length
  const submitted = d.attempts.filter((t) => t.status === 'submitted').length
  const versions = d.attempts.reduce((n, t) => n + t.versions.length, 0)
  const taken: State = { label: '응시 완료', tone: 'done' }
  const notTaken: State = { label: '미응시', tone: 'todo' }
  // 단계 이름, 아이콘을 찾는 단계 주소, 열 탭, 상태, 오른쪽에 적는 값
  const rows: [label: string, icon: string, tab: string, state: State, detail: string][] = [
    ['사전평가', 'pre', 'tests', d.pre ? taken : notTaken, d.pre ? [points(d.pre.total_score), when(d.pre.submitted_at)].filter(Boolean).join(', ') : ''],
    [
      '학습',
      'learning',
      'learning',
      learningState(d.stage, d.pre !== null && goals.length === 0),
      [asked ? `대화 ${asked}회` : '', d.checks.length ? `확인 문항 ${d.checks.length}개` : ''].filter(Boolean).join(', '),
    ],
    ['과제', 'task', 'task', taskState(submitted > 0, d.attempts.length), d.attempts.length ? `시도 ${d.attempts.length}회, 제출 ${submitted}회, 버전 ${versions}개` : ''],
    ['사후평가', 'post', 'tests', d.post ? taken : notTaken, d.post ? [points(d.post.total_score), when(d.post.submitted_at)].filter(Boolean).join(', ') : ''],
  ]

  return (
    <>
      <Meta
        items={[
          ['현재 단계', <Status tone={stage.tone}>{stage.label}</Status>],
          ['참여', when(d.joined_at)],
          ['사전평가', d.pre ? points(d.pre.total_score) : '미응시'],
          ['사후평가', d.post ? points(d.post.total_score) : '미응시'],
          ['역량 통과', `${d.states.length}개 중 ${d.states.filter((s) => s.passed).length}개`],
        ]}
      />

      <Section title="단계별 기록">
        <div className="rows">
          {rows.map(([label, icon, tab, state, detail]) => (
            <Link className="row" key={label} to={`${base}/${tab}`}>
              <span className="name">
                <StageIcon path={icon} />
                {label}
              </span>
              <Status tone={state.tone}>{state.label}</Status>
              <span className="end">
                {detail}
                <ChevronRight aria-hidden="true" />
              </span>
            </Link>
          ))}
          {d.signals.map((s) => (
            <Link className="row" key={s.id} to={`${base}/task`}>
              <span className="name">
                <TriangleAlert aria-hidden="true" />
                의심 신호
              </span>
              <Status tone="alert">{SIGNAL_LABEL[s.kind] ?? s.kind}</Status>
              <span className="line">
                시도 {s.attempt_no}, {s.description}
              </span>
              <span className="end">
                <ChevronRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="교수 평가">
        <GradeForm d={d} aid={aid} onSaved={() => void reload()} />
      </Section>
    </>
  )
}

export function TestsTab() {
  const { aid, d, setD } = useStudent()
  const [which, setWhich] = useState<Phase>('pre')
  if (!d.pre) return <Empty>아직 사전평가를 보지 않았다</Empty>
  const result = which === 'post' && d.post ? d.post : d.pre
  const hasPost = d.states.some((s) => s.post_score !== null)

  return (
    <>
      <div className="section-head">
        <h2>역량별 점수</h2>
      </div>
      <div className="rows">
        {d.states.map((s, i) => (
          <div className="row" key={s.competency_id}>
            <span className="name">
              {letterOf(i)} {s.name}
            </span>
            <div className="grow bars">
              {s.pre_score !== null && <HBar value={s.pre_score} mark={s.pass_score} tone="mute" i={i} />}
              {s.post_score !== null && <HBar value={s.post_score} mark={s.pass_score} i={i + 1} />}
            </div>
            <span className="val wide">{s.pre_score !== null && s.post_score !== null ? `${points(s.pre_score)}에서 ${points(s.post_score)}` : points(s.pre_score)}</span>
          </div>
        ))}
      </div>
      <div className="legend">
        <span>
          <i className="dot mute" />
          사전평가
        </span>
        {hasPost && (
          <span>
            <i className="dot accent" />
            사후평가
          </span>
        )}
        <span>
          <i className="tick" />
          통과 점수
        </span>
      </div>

      <Section
        title="답안"
        aside={
          <div className="seg" role="group" aria-label="시험 고르기">
            <button type="button" aria-pressed={result.phase === 'pre'} onClick={() => setWhich('pre')}>
              사전평가
            </button>
            <button type="button" aria-pressed={result.phase === 'post'} onClick={() => setWhich('post')} disabled={!d.post}>
              사후평가
            </button>
          </div>
        }
      >
        <Meta
          items={[
            ['총점', points(result.total_score)],
            ['제출', when(result.submitted_at)],
            ...(result.competency_scores._time_exceeded ? [timeExceeded] : []),
          ]}
        />
        <AnswerTable key={result.attempt_id} result={result} aid={aid} onChanged={setD} />
      </Section>
    </>
  )
}

export function LearningTab() {
  const { aid, d } = useStudent()
  const summary = d.summaries.find((s) => s.kind === 'learning')
  const msgs = d.messages.filter((m) => m.stage === 'learning')
  const asked = msgs.filter((m) => m.role === 'student').length
  const noGoal = d.pre !== null && d.states.every((s) => s.pre_score === null || s.pre_score >= s.pass_score)
  const state = learningState(d.stage, noGoal)

  if (!summary && msgs.length === 0 && d.checks.length === 0) {
    return <Empty>{noGoal ? '모든 역량이 통과 점수를 넘어 학습 단계가 없었다' : '아직 학습을 시작하지 않았다'}</Empty>
  }
  const c = summary?.content

  return (
    <>
      <Meta
        items={[
          ['상태', <Status tone={state.tone}>{state.label}</Status>],
          ['대화 수', `${asked}회`],
          ['확인 문항', `${d.checks.length}개`],
          ['역량 통과', `${d.states.length}개 중 ${d.states.filter((s) => s.passed).length}개`],
        ]}
      />

      <Section title="항목별 AI 학습과정 요약" aside={summary ? <span className="num">{when(summary.created_at)} 작성</span> : undefined}>
        {c ? (
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
                {c.spec_summary && (
                  <tr>
                    <td className="strong">스펙</td>
                    <td />
                    <td className="text">{c.spec_summary}</td>
                  </tr>
                )}
                {c.learned_summary && (
                  <tr>
                    <td className="strong">학습 내용</td>
                    <td />
                    <td className="text">{c.learned_summary}</td>
                  </tr>
                )}
                {c.ai_usage_line && (
                  <tr>
                    <td className="strong">AI 사용 방식</td>
                    <td />
                    <td className="text">{c.ai_usage_line}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>학습 단계가 끝나면 생긴다</Empty>
        )}
      </Section>

      <Section title="역량 상태">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>역량</th>
                <th className="r">통과 점수</th>
                <th className="r">사전</th>
                <th className="r">현재</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {d.states.map((s) => (
                <tr key={s.competency_id}>
                  <td className="strong">{s.name}</td>
                  <td className="r">{s.pass_score}</td>
                  <td className="r">{s.pre_score === null ? '' : round1(s.pre_score)}</td>
                  <td className="r">{s.current_score === null ? '' : round1(s.current_score)}</td>
                  <td>
                    {s.pre_score === null ? <Status tone="todo">미측정</Status> : s.passed ? <Status tone="done">충분</Status> : <Status tone="alert">부족</Status>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`확인 문항 ${d.checks.length}개`}>
        {d.checks.length === 0 ? (
          <Empty>아직 확인 문항이 없다</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>역량</th>
                  <th>문항</th>
                  <th>모범 답안</th>
                  <th>학생 답</th>
                  <th className="r">점수</th>
                  <th>피드백</th>
                </tr>
              </thead>
              <tbody>
                {d.checks.map((k) => (
                  <tr key={k.id}>
                    <td className="strong">{d.states.find((s) => s.competency_id === k.competency_id)?.name}</td>
                    <td className="text">{k.item.stem}</td>
                    <td className="text">{k.item.answer}</td>
                    <td className="text">{k.answered_at === null ? '미응답' : k.answer_text}</td>
                    <td className="r">{k.score === null ? '' : Math.round(k.score)}</td>
                    <td className="text">{k.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title={`학습 대화 ${msgs.length}건`}
        aside={
          <Link className="btn" to={`/prof/assignments/${aid}/students/${d.enrollment_id}/conversation`}>
            전체 대화
          </Link>
        }
      >
        <Log messages={msgs} empty="학습 단계 대화가 없다" />
      </Section>
    </>
  )
}

// 결과물 변경 이력과 버전 비교는 팀원이 맡는다. 예전 스타일시트가 적용되도록 legacy 영역으로만 감싼다.
export function TaskTab() {
  const { aid, d } = useStudent()
  if (d.attempts.length === 0)
    return (
      <div className="legacy">
        <p className="muted">아직 과제 단계 기록이 없다.</p>
      </div>
    )
  return (
    <div className="legacy">
      <div>
        {d.attempts.map((t) => {
          const summary = d.summaries.find((s) => s.kind === 'task' && s.attempt_no === t.attempt_no)
          const msgs = d.messages.filter((m) => m.stage === 'task' && m.attempt_no === t.attempt_no)
          const signals = d.signals.filter((s) => s.attempt_no === t.attempt_no)
          return (
            <div key={t.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>
                  시도 {t.attempt_no} <span className="chip">{t.status === 'submitted' ? '제출됨' : '진행 중'}</span>
                </h2>
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
                </div>
              )}
              <div className="grid-side" style={{ marginTop: 8 }}>
                <div>
                  <VersionList versions={t.versions} filePath={(vid) => api.prof.versionFilePath(aid, d.enrollment_id, vid)} compact />
                  <div className="placeholder small">직전 버전과의 텍스트 비교와 이미지 비교 화면은 동료가 구현한다. 지금은 버전 원문과 캡처만 보인다.</div>
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
    </div>
  )
}

export function ConversationTab() {
  const { d } = useStudent()
  const [stage, setStage] = useState<'' | 'learning' | 'task'>('')
  const [q, setQ] = useState('')
  if (d.messages.length === 0) return <Empty>아직 AI와 나눈 대화가 없다</Empty>
  const word = q.trim().toLowerCase()
  const rows = d.messages.filter((m) => (!stage || m.stage === stage) && (!word || m.content.toLowerCase().includes(word)))
  const filters: [value: '' | 'learning' | 'task', label: string][] = [
    ['', '전체'],
    ['learning', '학습'],
    ['task', '과제'],
  ]

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <input className="input" placeholder="대화 내용 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="대화 내용 검색" />
        </div>
        <div className="seg" role="group" aria-label="단계 고르기">
          {filters.map(([value, label]) => (
            <button key={label} type="button" aria-pressed={stage === value} onClick={() => setStage(value)}>
              {label}
            </button>
          ))}
        </div>
        <span className="actions num">{rows.length}건</span>
      </div>
      <Log messages={rows} staged empty="조건에 맞는 대화가 없다" />
    </>
  )
}
