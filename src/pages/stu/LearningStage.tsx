import { useCallback, useEffect, useState } from 'react'

import { api, ITEM_TYPE_LABEL, type Enrollment, type LearningState } from '../../api'
import Chat from '../../components/Chat'
import StatesTable from '../../components/StatesTable'

export default function LearningStage({ enrollment, onDone }: { enrollment: Enrollment; onDone: () => void }) {
  const eid = enrollment.id
  const [state, setState] = useState<LearningState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => api.stu.learning(eid).then(setState).catch((e: Error) => setError(e.message)), [eid])
  useEffect(() => {
    void reload()
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!state) return <p className="muted">불러오는 중</p>

  const pending = state.checks.find((c) => c.answered_at === null)
  const pendingName = pending ? state.states.find((s) => s.competency_id === pending.competency_id)?.name : ''

  async function send(message: string) {
    const msgs = await api.stu.learningChat(eid, message)
    setState((prev) => (prev ? { ...prev, messages: [...prev.messages, ...msgs] } : prev))
  }

  async function requestCheck(cid: number) {
    setBusy(true)
    setError(null)
    try {
      await api.stu.newCheck(eid, cid)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 문항 실패')
    } finally {
      setBusy(false)
    }
  }

  async function submitCheck() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      setState(await api.stu.answerCheck(eid, pending.id, answer))
      setAnswer('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '채점 실패')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      await api.stu.finishLearning(eid)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : '종료 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid-side">
      <div>
        <div className="card">
          <div className="card-title">
            <div>
              <h2>학습 목표, 부족한 역량</h2>
              <p className="muted small">
                역량마다 AI의 확인 문항에 답하면 그 점수로 현재 점수가 갱신된다. 모든 역량이 통과 점수를 넘으면 과제 단계가 열린다.
              </p>
            </div>
            <button className="btn" onClick={() => void finish()} disabled={!state.can_finish || busy}>
              과제 단계로
            </button>
          </div>
          <StatesTable
            states={state.states}
            actions={(s) =>
              s.passed ? (
                <span className="muted small">통과</span>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => void requestCheck(s.competency_id)} disabled={busy || Boolean(pending)}>
                  확인 문항 받기
                </button>
              )
            }
          />
          {error && <p className="error small">{error}</p>}
        </div>

        {pending && (
          <div className="card">
            <h2>
              확인 문항 <span className="chip">{pendingName}</span> <span className="chip">{ITEM_TYPE_LABEL[pending.item.type ?? 'essay_short']}</span>
            </h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{pending.item.stem}</p>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="내 답" />
            <button className="btn" onClick={() => void submitCheck()} disabled={busy || !answer.trim()} style={{ marginTop: 8 }}>
              {busy ? '채점 중' : '답 제출'}
            </button>
          </div>
        )}

        {state.checks.filter((c) => c.answered_at).length > 0 && (
          <div className="card">
            <h3>답한 확인 문항</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>역량</th>
                  <th>문항</th>
                  <th>점수</th>
                  <th>피드백</th>
                </tr>
              </thead>
              <tbody>
                {state.checks
                  .filter((c) => c.answered_at)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{state.states.find((s) => s.competency_id === c.competency_id)?.name}</td>
                      <td className="small">{c.item.stem}</td>
                      <td>{c.score === null ? '-' : `${Math.round(c.score)}점`}</td>
                      <td className="small">{c.feedback}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <Chat
          title="학습 AI"
          messages={state.messages}
          onSend={send}
          rules={state.student_rules}
          disabled={Boolean(pending)}
          disabledReason="확인 문항에 먼저 답한다"
        />
      </div>
    </div>
  )
}
