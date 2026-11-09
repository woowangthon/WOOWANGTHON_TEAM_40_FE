import { useEffect, useRef, useState } from 'react'

import { MODE_LABEL, type ChatMessage } from '../api'

interface Props {
  messages: ChatMessage[]
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  disabledReason?: string
  rules?: string[]
  title?: string
}

export default function Chat({ messages, onSend, disabled, disabledReason, rules, title }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  async function send() {
    const message = text.trim()
    if (!message || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSend(message)
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      {title && <h3>{title}</h3>}
      {rules && rules.length > 0 && (
        <div className="banner info small">
          <strong>교수가 안내한 규칙</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && <p className="muted small">AI에게 질문하면 산파술로 되묻거나 개념을 설명한다.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.role === 'ai' && (
              <span className="tag">
                AI {m.mode ? `· ${MODE_LABEL[m.mode] ?? m.mode}` : ''}
                {m.meta?.uncertain ? ' · 자료 밖' : ''}
                {m.meta?.refined ? ' · 답 노출 수정됨' : ''}
              </span>
            )}
            {m.content}
          </div>
        ))}
        {busy && <div className="bubble ai muted">생각하는 중</div>}
      </div>
      {error && <p className="error small">{error}</p>}
      <div className="chat-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? (disabledReason ?? '지금은 대화할 수 없다') : '질문을 입력한다. Enter로 보내고 Shift+Enter로 줄을 바꾼다'}
          disabled={disabled || busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button className="btn" onClick={() => void send()} disabled={disabled || busy || !text.trim()}>
          보내기
        </button>
      </div>
    </div>
  )
}
