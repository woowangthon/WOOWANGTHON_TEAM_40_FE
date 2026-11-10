import { useState } from 'react'
import { Link } from 'react-router-dom'

import { api, formatDate, MODE_LABEL } from '../../../api'
import StatesTable from '../../../components/StatesTable'
import VersionList from '../../../components/VersionList'
import { GradeCard, SIGNAL_LABEL, SummaryView, TestCard } from '../studentParts'
import { useStudent } from './StudentLayout'

export function OverviewTab() {
  const { aid, d, reload } = useStudent()
  const base = `/prof/assignments/${aid}/students/${d.enrollment_id}`
  const learning = d.summaries.find((s) => s.kind === 'learning')
  return (
    <div>
      <div className="stat-grid">
        <Stat label="사전평가 점수" value={d.pre ? `${d.pre.total_score}점` : '-'} to={`${base}/tests`} />
        <Stat label="사후평가 점수" value={d.post ? `${d.post.total_score}점` : '-'} to={`${base}/tests`} />
        <Stat label="역량 통과" value={`${d.states.filter((s) => s.passed).length}/${d.states.length}`} to={`${base}/learning`} />
        <Stat
          label="결과물 버전"
          value={`${d.attempts.reduce((n, t) => n + t.versions.length, 0)}개`}
          sub={`시도 ${d.attempts.length}회`}
          to={`${base}/task`}
        />
      </div>
      <div className="card">
        <h2>역량 상태, 스펙</h2>
        <StatesTable states={d.states} showPost />
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>항목별 AI 학습과정 요약</h2>
          {learning ? <SummaryView s={learning} /> : <p className="muted small">학습 단계가 끝나면 생긴다.</p>}
          <Link className="small" to={`${base}/learning`}>
            학습 과정 자세히
          </Link>
        </div>
        <div className="card">
          <h2>위반 의심 신호 {d.signals.length}건</h2>
          {d.signals.length === 0 ? (
            <p className="muted small">AI가 표시한 신호가 없다.</p>
          ) : (
            <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
              {d.signals.map((s) => (
                <li key={s.id} className="small">
                  <span className="chip chip-warn">{SIGNAL_LABEL[s.kind] ?? s.kind}</span> 시도 {s.attempt_no}: {s.description}
                </li>
              ))}
            </ul>
          )}
          <p className="muted small" style={{ marginTop: 6 }}>
            AI는 의심 신호만 표시한다. 최종 판단은 교수가 기록을 보고 한다.
          </p>
        </div>
      </div>
      <GradeCard d={d} aid={aid} onSaved={() => void reload()} />
    </div>
  )
}

export function TestsTab() {
  const { aid, d, setD } = useStudent()
  return (
    <div className="grid-2">
      <TestCard title="사전평가 점수" result={d.pre} aid={aid} onChanged={setD} />
      <TestCard title="사후평가 점수" result={d.post} aid={aid} onChanged={setD} />
    </div>
  )
}

export function LearningTab() {
  const { d } = useStudent()
  const learning = d.summaries.find((s) => s.kind === 'learning')
  const msgs = d.messages.filter((m) => m.stage === 'learning')
  return (
    <div className="grid-side">
      <div>
        <div className="card">
          <h2>항목별 AI 학습과정 요약</h2>
          {learning ? <SummaryView s={learning} /> : <p className="muted small">학습 단계가 끝나면 생긴다.</p>}
        </div>
        <div className="card">
          <h2>확인 문항 {d.checks.length}개</h2>
          {d.checks.length === 0 ? (
            <p className="muted small">아직 확인 문항이 없다.</p>
          ) : (
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
          )}
        </div>
      </div>
      <div className="card">
        <h3>학습 단계 대화 {msgs.length}건</h3>
        <div className="chat-log" style={{ maxHeight: 560 }}>
          {msgs.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.role === 'ai' && <span className="tag">AI · {MODE_LABEL[m.mode] ?? m.mode}</span>}
              {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TaskTab() {
  const { aid, d } = useStudent()
  if (d.attempts.length === 0) return <p className="muted">아직 과제 단계 기록이 없다.</p>
  return (
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
  )
}

export function ConversationTab() {
  const { d } = useStudent()
  const [filter, setFilter] = useState<'all' | 'learning' | 'task'>('all')
  const msgs = d.messages.filter((m) => filter === 'all' || m.stage === filter)
  return (
    <div className="card">
      <div className="card-title">
        <h2>전체 대화 답변 {msgs.length}건</h2>
        <div className="section-nav" style={{ margin: 0 }}>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            전체
          </button>
          <button className={filter === 'learning' ? 'active' : ''} onClick={() => setFilter('learning')}>
            학습 단계
          </button>
          <button className={filter === 'task' ? 'active' : ''} onClick={() => setFilter('task')}>
            과제 단계
          </button>
        </div>
      </div>
      <p className="muted small">교수가 필요할 때 찾아 보는 부가 요소다. AI 응답에는 모드가 붙어 있다.</p>
      <div className="chat-log" style={{ maxHeight: 640 }}>
        {msgs.length === 0 && <p className="muted small">대화가 없다.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            <span className="tag">
              {m.stage === 'learning' ? '학습 단계' : `과제 단계 시도 ${m.attempt_no}`} · {formatDate(m.created_at)}
              {m.role === 'ai' ? ` · ${MODE_LABEL[m.mode] ?? m.mode}` : ''}
            </span>
            {m.content}
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, to }: { label: string; value: string; sub?: string; to: string }) {
  return (
    <Link to={to} className="stat" style={{ color: 'inherit' }}>
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </Link>
  )
}
