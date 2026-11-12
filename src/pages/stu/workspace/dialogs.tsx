import { useState, type ReactNode } from 'react'
import { ClipboardPaste, X } from 'lucide-react'
import { Notice } from '../../../ui'

const PASTE_SOURCES = ['과제 명세 · 수업 자료', '내가 쓴 다른 파일', '외부 AI', '웹 검색', '기타']

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="ws-backdrop" onMouseDown={onClose}>
      <div className="ws-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ws-modal-head">
          <h2>{title}</h2>
          <button className="btn icon quiet" aria-label="닫기" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export type PendingPaste = { commitId: number; file: string; lines: number; chars: number }

/** 일정 길이 이상 붙여넣었을 때 출처를 묻는다. 선택이고 판정 기준이 아니다 */
export function PastePopup({ paste, onSave, onSkip }: { paste: PendingPaste; onSave: (source: string, memo: string) => void; onSkip: () => void }) {
  const [source, setSource] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  return (
    <div className="ws-paste" role="dialog" aria-label="붙여넣기 출처">
      <div className="ws-modal-head">
        <ClipboardPaste aria-hidden="true" />
        <div className="ws-grow">
          <strong>붙여넣기를 기록했다</strong>
          <p className="soft ws-small num">
            {paste.file} · {paste.lines}줄 · {paste.chars}자
          </p>
        </div>
        <button className="btn icon quiet" aria-label="건너뛰기" onClick={onSkip}>
          <X aria-hidden="true" />
        </button>
      </div>
      <p>어디서 가져왔나요? 선택이다</p>
      <div className="ws-chips">
        {PASTE_SOURCES.map((s) => (
          <button key={s} className={source === s ? 'btn ws-on' : 'btn'} onClick={() => setSource(s)} aria-pressed={source === s}>
            {s}
          </button>
        ))}
      </div>
      <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모, 예: 3주차 강의 노트 12쪽" />
      <p className="soft ws-small">감점 기준이 아니라 교수가 참고하는 정보다</p>
      <div className="ws-modal-actions">
        <button className="btn" onClick={onSkip}>
          건너뛰기
        </button>
        <button className="btn primary" disabled={!source} onClick={() => source && onSave(source, memo)}>
          출처 저장
        </button>
      </div>
    </div>
  )
}

export function CompleteDialog({
  files,
  commitCount,
  aiCount,
  tests,
  unattributedPastes,
  pendingSuggestions,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  files: string[]
  commitCount: number
  aiCount: number
  tests: { passed: number; total: number }
  unattributedPastes: number
  pendingSuggestions: number
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
}) {
  const checks = [
    tests.total > 0 && tests.passed < tests.total && `실패한 테스트가 ${tests.total - tests.passed}개 있다`,
    tests.total === 0 && '아직 테스트를 돌리지 않았다',
    pendingSuggestions > 0 && `검토하지 않은 AI 수정안이 ${pendingSuggestions}개 있다`,
    unattributedPastes > 0 && `출처를 적지 않은 붙여넣기가 ${unattributedPastes}건 있다`,
  ].filter(Boolean) as string[]
  return (
    <Modal title="과제를 제출할까요" onClose={onClose}>
      <p className="soft">제출하면 사후평가로 넘어간다. 마감 전에는 사후평가 뒤에 과제 단계만 다시 해서 재제출할 수 있다.</p>
      <dl className="ws-dl">
        <dt>제출 파일</dt>
        <dd>{files.join(', ')}</dd>
        <dt>커밋</dt>
        <dd className="num">{commitCount}개</dd>
        <dt>AI 수정 반영</dt>
        <dd className="num">{aiCount}회</dd>
        <dt>테스트</dt>
        <dd className="num">{tests.total ? `${tests.passed} / ${tests.total} 통과` : '-'}</dd>
      </dl>
      {checks.length > 0 && (
        <ul className="ws-checks">
          {checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="ws-modal-actions">
        <button className="btn" onClick={onClose}>
          계속 작성
        </button>
        <button className="btn primary" onClick={onSubmit} disabled={busy}>
          {busy ? '제출 중' : '제출하고 사후평가로'}
        </button>
      </div>
    </Modal>
  )
}
