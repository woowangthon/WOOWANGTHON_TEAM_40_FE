import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { api, type TaskState } from '../../api'
import { useAuth } from '../../auth'
import Chat from '../../components/Chat'

// 자리 2에서 문서 탭 위에 띄우는 별도 창. Document Picture-in-Picture가 안 되는 브라우저용이다.
export default function ChatPopout() {
  const { eid } = useParams()
  const enrollmentId = Number(eid)
  const { user, loading } = useAuth()
  const [t, setT] = useState<TaskState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => api.stu.task(enrollmentId).then(setT).catch((e: Error) => setError(e.message)), [enrollmentId])
  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 30_000)
    return () => clearInterval(timer)
  }, [load])

  if (loading) return <p className="muted">불러오는 중</p>
  if (!user) return <Navigate to="/login" replace />

  async function send(message: string) {
    const msgs = await api.stu.taskChat(enrollmentId, message)
    setT((prev) => (prev ? { ...prev, messages: [...prev.messages, ...msgs] } : prev))
  }

  const editable = Boolean(t?.attempt) && !t?.deadline_passed
  return (
    <div className="companion-panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong className="small">학습 AI, 과제 단계</strong>
        <span className="chip chip-primary small">{t?.attempt ? `시도 ${t.attempt.attempt_no}` : '진행 중인 시도 없음'}</span>
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="card" style={{ padding: 8, marginBottom: 0 }}>
        <Chat
          messages={t?.messages ?? []}
          onSend={send}
          rules={t?.student_rules}
          disabled={!editable}
          disabledReason={t?.deadline_passed ? '마감이 지났다' : '진행 중인 시도가 없다'}
        />
      </div>
    </div>
  )
}
