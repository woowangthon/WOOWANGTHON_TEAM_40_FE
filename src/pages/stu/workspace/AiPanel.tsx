import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Code2, MessagesSquare, X } from 'lucide-react'
import { Notice, Status } from '../../../ui'
import { clock, type Proposal, type WsMessage } from './wsApi'

export type AiContext = { label: string; detail: string; prompt?: string }

const PROPOSAL_STATUS: Record<Proposal['status'], [tone: 'doing' | 'done' | 'todo' | 'alert', label: string]> = {
  pending: ['doing', '검토 대기'],
  accepted: ['done', '수락 · AI 커밋으로 기록'],
  rejected: ['todo', '거절함'],
  edited: ['done', '직접 고쳐서 반영'],
  stale: ['alert', '파일이 바뀌어 적용하지 못함'],
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
                  seg.startsWith('`') && seg.endsWith('`') && seg.length > 1 ? (
                    <code key={k} className="mono">
                      {seg.slice(1, -1)}
                    </code>
                  ) : (
                    seg
                  ),
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
      <div className="chat-head">
        <MessagesSquare aria-hidden="true" />
        <span>AI 도우미</span>
        <span className="ws-grow" />
        <Status tone={aiAvailable ? 'doing' : 'todo'}>{aiAvailable ? '기록 중' : '연결 안 됨'}</Status>
      </div>
      <div className="ws-ai-body" ref={body}>
        <p className="soft ws-small ws-ai-note">과제 단계에서는 AI 사용을 막지 않는다. 대화, 수정안, 수락 여부가 모두 기록된다.</p>
        {messages.length === 0 && !sending && (
          <div className="msg ai">코드를 선택하고 질문하면 그 범위가 함께 전달된다. 고쳐 달라고 하면 수정안을 만들어 에디터에 비교 화면으로 보여 준다.</div>
        )}
        {messages.map((m) => {
          if (m.role === 'student') {
            const sel = m.meta?.selection as { start_line?: number; end_line?: number } | null
            return (
              <div className="msg me" key={m.id}>
                {(sel?.start_line || m.meta?.path) && (
                  <span className="ws-ctx">
                    <Code2 aria-hidden="true" /> {m.meta?.path}
                    {sel?.start_line ? ` ${sel.start_line}–${sel.end_line}줄` : ''}
                  </span>
                )}
                {m.content}
              </div>
            )
          }
          const p = m.meta?.proposal_id ? proposals[m.meta.proposal_id as number] : undefined
          return (
            <div className="msg ai" key={m.id}>
              <span className="soft ws-small">{clock(m.created_at)}</span>
              <RichText text={m.content} />
              {p && (
                <div className="ws-sugg">
                  <div>
                    <strong>코드 수정안</strong>
                    <span className="soft">
                      {p.file_path} · {p.start_line}
                      {p.end_line > p.start_line ? `–${p.end_line}` : ''}번째 줄
                    </span>
                  </div>
                  <Status tone={PROPOSAL_STATUS[p.status][0]}>{PROPOSAL_STATUS[p.status][1]}</Status>
                  {p.status === 'pending' && (
                    <button className="btn" onClick={() => onShowProposal(p)}>
                      에디터에서 보기 <ArrowRight aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {sending && <div className="msg me">{sending}</div>}
        {sending && (
          <div className="msg ai" role="status" aria-label="AI가 답을 쓰는 중">
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
        <div className="ws-ctx-chip">
          <Code2 aria-hidden="true" />
          <span className="ws-grow ws-ellipsis">
            <strong>{context.label}</strong> {context.detail}
          </span>
          <button className="btn icon quiet" aria-label="문맥 빼기" onClick={() => setContext(null)}>
            <X aria-hidden="true" />
          </button>
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
          rows={2}
          value={text}
          disabled={disabled}
          placeholder={disabled ? '제출한 뒤에는 질문할 수 없다' : aiAvailable ? '코드나 과제에 대해 질문한다' : '서버에 AI 키가 없다'}
          aria-label="메시지"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button className="btn primary icon" type="submit" aria-label="보내기" disabled={!text.trim() || Boolean(sending) || disabled}>
          <ArrowUp aria-hidden="true" />
        </button>
      </form>
      <p className="soft ws-small ws-ai-foot num">이번 시도 질문 {asked}회</p>
    </aside>
  )
}
