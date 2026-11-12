import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Bot, Check, Clock3, Code2, Sparkles, X } from 'lucide-react'
import { Notice } from '../../../ui'
import { clock, type Proposal, type WsMessage } from './wsApi'

export type AiContext = { label: string; detail: string; prompt?: string }

const PROPOSAL_STATUS: Record<Proposal['status'], [cls: string, label: string]> = {
  pending: ['waiting', '검토 대기'],
  accepted: ['done', '수락함 · AI 커밋으로 기록'],
  rejected: ['rejected', '거절함'],
  edited: ['done', '직접 고쳐서 반영함'],
  stale: ['rejected', '파일이 바뀌어 적용하지 못함'],
}

/** 코드 블록(```)과 `코드`만 따로 보여 주는 최소한의 마크다운 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/```[a-zA-Z+]*\n?/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre className="ws-code" key={i}>
            {part.replace(/\n$/, '')}
          </pre>
        ) : (
          part
            .split(/\n{2,}/)
            .filter((p) => p.trim())
            .map((p, j) => (
              <p key={`${i}-${j}`}>
                {p.split(/(`[^`]+`)/).map((seg, k) =>
                  seg.startsWith('`') && seg.endsWith('`') && seg.length > 1 ? <code key={k}>{seg.slice(1, -1)}</code> : seg,
                )}
              </p>
            ))
        ),
      )}
    </>
  )
}

export function AiPanel({
  messages,
  proposals,
  onShowProposal,
  context,
  setContext,
  seed,
  onSend,
  sending,
  aiAvailable,
  error,
  setError,
  disabled,
  onFocusPanel,
}: {
  messages: WsMessage[]
  proposals: Record<number, Proposal>
  onShowProposal: (p: Proposal) => void
  context: AiContext | null
  setContext: (c: AiContext | null) => void
  /** 바뀌면 context.prompt 를 입력창에 채운다 */
  seed: number
  onSend: (text: string) => Promise<boolean>
  sending: string | null
  aiAvailable: boolean
  error: string | null
  setError: (e: string | null) => void
  disabled: boolean
  /** 에디터에서 AI 패널로 포커스가 옮겨 왔을 때. 커밋 시점이다 */
  onFocusPanel: () => void
}) {
  const [text, setText] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (seed > 0 && context?.prompt) {
      setText(context.prompt)
      input.current?.focus()
    }
  }, [seed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])

  const send = async () => {
    const msg = text.trim()
    if (!msg || sending || disabled) return
    setText('')
    if (!(await onSend(msg))) setText(msg)
  }

  const asked = messages.filter((m) => m.role === 'student').length

  return (
    <aside className="ws-ai" onFocusCapture={onFocusPanel} aria-label="AI 도우미">
      <div className="ws-ai-head">
        <span className="ws-ai-mark">
          <Sparkles aria-hidden="true" />
        </span>
        <strong>AI Tutor</strong>
        <i className={aiAvailable ? 'ws-online' : 'ws-online off'} title={aiAvailable ? '연결됨' : 'AI 키 없음'} />
      </div>
      <div className="ws-ai-body" ref={body}>
        <div className="ws-chat-divider">
          <span /> 작성 단계 · AI 사용 허용, 모든 대화가 기록돼요 <span />
        </div>
        {messages.length === 0 && !sending && (
          <div className="ws-msg ai">
            <div className="ws-msg-author">
              <Bot aria-hidden="true" /> Orbit AI
            </div>
            <p>코드를 선택하고 질문하면 선택한 범위가 함께 전달돼요. “고쳐줘”라고 하면 수정안을 만들어 에디터에 비교 화면으로 보여 드려요.</p>
          </div>
        )}
        {messages.map((m) => {
          if (m.role === 'student') {
            const sel = m.meta?.selection as { start_line?: number; end_line?: number } | null
            return (
              <div className="ws-msg me" key={m.id}>
                {(sel?.start_line || m.meta?.path) && (
                  <div className="ws-msg-ctx">
                    <Code2 aria-hidden="true" /> {m.meta?.path}
                    {sel?.start_line ? ` ${sel.start_line}–${sel.end_line}줄` : ''}
                  </div>
                )}
                <p>{m.content}</p>
              </div>
            )
          }
          const p = m.meta?.proposal_id ? proposals[m.meta.proposal_id as number] : undefined
          const st = p ? PROPOSAL_STATUS[p.status] : null
          return (
            <div className="ws-msg ai" key={m.id}>
              <div className="ws-msg-author">
                <Bot aria-hidden="true" /> Orbit AI <span>{clock(m.created_at)}</span>
              </div>
              <RichText text={m.content} />
              {p && st && (
                <>
                  <div className="ws-sugg">
                    <span className="ws-sugg-icon">
                      <Code2 aria-hidden="true" />
                    </span>
                    <div>
                      <strong>코드 수정안</strong>
                      <small>
                        {p.file_path} · {p.start_line}
                        {p.end_line > p.start_line ? `–${p.end_line}` : ''}번째 줄
                      </small>
                    </div>
                    {p.status === 'pending' && (
                      <button onClick={() => onShowProposal(p)}>
                        에디터에서 보기 <ArrowRight aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className={`ws-msg-status ${st[0]}`}>
                    {p.status === 'pending' ? <Clock3 aria-hidden="true" /> : <Check aria-hidden="true" />} {st[1]}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {sending && (
          <div className="ws-msg me">
            <p>{sending}</p>
          </div>
        )}
        {sending && (
          <div className="ws-msg ai" role="status" aria-label="AI가 답을 쓰는 중">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>
      {error && (
        <div className="ws-ai-alert">
          <Notice kind="error" onClose={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}
      {context && (
        <div className="ws-selection">
          <Code2 aria-hidden="true" />
          <span className="ws-grow ws-ellipsis">
            <strong>{context.label}</strong> {context.detail}
          </span>
          <button aria-label="문맥 빼기" onClick={() => setContext(null)}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      <form
        className="ws-composer"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          ref={input}
          value={text}
          disabled={disabled}
          placeholder={disabled ? '제출한 뒤에는 질문할 수 없어요.' : aiAvailable ? '코드나 과제에 대해 질문하세요...' : '서버에 AI 키가 없어요.'}
          aria-label="메시지"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <div className="ws-composer-bottom">
          <span>Enter 보내기 · Shift+Enter 줄바꿈</span>
          <button type="submit" className="ws-send" aria-label="보내기" disabled={!text.trim() || Boolean(sending) || disabled}>
            <ArrowUp aria-hidden="true" />
          </button>
        </div>
      </form>
      <div className="ws-usage">
        이번 시도 AI 질문 <strong className="num">{asked}회</strong> · 모두 기록됨
      </div>
    </aside>
  )
}
