import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { api, type ChatMessage, type CompanionMe } from '../api'
import Chat from '../components/Chat'

// 보조 프로그램의 pywebview 창이 여는 AI 패널. 로그인 대신 보조 프로그램 토큰을 쓴다.
export default function CompanionPanel() {
  const { eid } = useParams()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [me, setMe] = useState<CompanionMe | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setError('토큰이 없다. 보조 프로그램에서 다시 연다.')
      return
    }
    try {
      const [m, msgs] = await Promise.all([api.companion.me(token), api.companion.messages(token)])
      setMe(m)
      setMessages(msgs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    }
  }, [token])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 30_000)
    return () => clearInterval(t)
  }, [load])

  async function send(message: string) {
    const msgs = await api.companion.chat(token, message)
    setMessages((prev) => [...prev, ...msgs])
  }

  return (
    <div className="companion-panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong className="small">{me ? `${me.assignment_title} · ${me.student_name}` : `참여 ${eid}`}</strong>
        <span className="chip chip-primary small">{me?.attempt_no ? `시도 ${me.attempt_no}` : '진행 중인 시도 없음'}</span>
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="card" style={{ padding: 8, marginBottom: 0 }}>
        <Chat
          messages={messages}
          onSend={send}
          disabled={!me || !me.attempt_no || me.deadline_passed}
          disabledReason={me?.deadline_passed ? '마감이 지났다' : '웹에서 과제 단계를 먼저 연다'}
        />
      </div>
    </div>
  )
}
