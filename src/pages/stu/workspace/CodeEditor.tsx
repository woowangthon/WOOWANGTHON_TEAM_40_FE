import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { DiffEditor, type BeforeMount, type OnMount } from '@monaco-editor/react'
import { Check, Code2, FlaskConical, Lock, Play, Sparkles, X } from 'lucide-react'
import { useTheme } from '../../../ui'
import { applyProposal, type Proposal, type Selection, type WsFile } from './wsApi'

const LANG = {
  python: { name: 'Python 3.12', monaco: 'python' },
  cpp: { name: 'C++17 · g++', monaco: 'cpp' },
  java: { name: 'Java 21', monaco: 'java' },
  '': { name: '텍스트', monaco: 'plaintext' },
}

export type PasteInfo = { text: string; lines: number; chars: number }

// 팀원 디자인 토큰(design.css)의 배경과 줄 번호 색에 맞춘다
const defineThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('ws-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#ffffff', 'editorLineNumber.foreground': '#9aa1ad', 'editorGutter.background': '#ffffff' },
  })
  monaco.editor.defineTheme('ws-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#26282c', 'editorLineNumber.foreground': '#6b717b', 'editorGutter.background': '#26282c' },
  })
}

const options = {
  fontSize: 13,
  fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, monospace",
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  padding: { top: 12 },
  renderLineHighlight: 'line' as const,
}

export function CodeEditor({
  file,
  value,
  readOnly,
  running,
  onRun,
  onChange,
  onPaste,
  onSelection,
  proposal,
  onAccept,
  onReject,
  onApplyEdited,
}: {
  file: WsFile
  value: string
  readOnly: boolean
  running: boolean
  onRun: (mode: 'run' | 'test') => void
  onChange: (value: string) => void
  onPaste: (info: PasteInfo) => void
  onSelection: (sel: Selection | null) => void
  proposal: Proposal | null
  onAccept: () => void
  onReject: () => void
  onApplyEdited: (text: string) => void
}) {
  const theme = useTheme() === 'dark' ? 'ws-dark' : 'ws-light'
  const lang = LANG[file.language] ?? LANG['']
  const [draft, setDraft] = useState<string | null>(null)
  const handlers = useRef({ onPaste, onSelection })
  handlers.current = { onPaste, onSelection }
  useEffect(() => setDraft(null), [proposal?.id])

  const onMount: OnMount = (editor) => {
    editor.onDidPaste((e) => {
      const text = editor.getModel()?.getValueInRange(e.range) ?? ''
      if (text) handlers.current.onPaste({ text, lines: text.split('\n').length, chars: text.length })
    })
    editor.onDidChangeCursorSelection((e) => {
      const s = e.selection
      const model = editor.getModel()
      if (!model || s.isEmpty()) return handlers.current.onSelection(null)
      handlers.current.onSelection({
        start_line: s.startLineNumber,
        end_line: s.endColumn === 1 && s.endLineNumber > s.startLineNumber ? s.endLineNumber - 1 : s.endLineNumber,
        text: model.getValueInRange(s),
      })
    })
  }

  const modified = useMemo(() => (proposal ? applyProposal(value, proposal, draft ?? proposal.new_text) : ''), [proposal, value, draft])
  const runnable = file.language !== ''

  return (
    <div className="ws-editor">
      <div className="ws-toolbar">
        <span className="ws-lang">{lang.name}</span>
        {file.readonly && (
          <span className="ws-chip">
            <Lock aria-hidden="true" /> 교수 제공 · 읽기 전용
          </span>
        )}
        <span className="ws-grow" />
        {runnable && (
          <>
            <button className="btn" onClick={() => onRun('test')} disabled={running}>
              <FlaskConical aria-hidden="true" /> 테스트
            </button>
            <button className="btn primary" onClick={() => onRun('run')} disabled={running}>
              <Play aria-hidden="true" /> {running ? '실행 중' : '실행'}
            </button>
          </>
        )}
      </div>

      {proposal ? (
        <>
          <div className="ws-proposal">
            <div className="ws-proposal-head">
              <Sparkles aria-hidden="true" />
              <strong>AI 수정안</strong>
              <span className="soft">
                {proposal.start_line}
                {proposal.end_line > proposal.start_line ? `–${proposal.end_line}` : ''}번째 줄
              </span>
            </div>
            <p className="ws-proposal-prompt">“{proposal.prompt}”</p>
            {proposal.reason && <p className="soft">{proposal.reason}</p>}
            {draft !== null && (
              <textarea
                className="textarea ws-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
                spellCheck={false}
                autoFocus
              />
            )}
            <div className="ws-proposal-actions">
              {draft === null ? (
                <>
                  <button className="btn primary" onClick={onAccept}>
                    <Check aria-hidden="true" /> 수락
                  </button>
                  <button className="btn" onClick={onReject}>
                    <X aria-hidden="true" /> 거절
                  </button>
                  <button className="btn quiet" onClick={() => setDraft(proposal.new_text)}>
                    <Code2 aria-hidden="true" /> 직접 수정
                  </button>
                </>
              ) : (
                <>
                  <button className="btn primary" onClick={() => onApplyEdited(draft)}>
                    <Check aria-hidden="true" /> 고친 내용 반영
                  </button>
                  <button className="btn" onClick={() => setDraft(null)}>
                    취소
                  </button>
                  <span className="soft">고쳐서 반영하면 직접 수정으로 기록되고 AI 원안도 함께 남는다</span>
                </>
              )}
            </div>
          </div>
          <div className="ws-monaco">
            <DiffEditor
              original={value}
              modified={modified}
              language={lang.monaco}
              theme={theme}
              beforeMount={defineThemes}
              onMount={(diff) => {
                const line = Math.max(1, proposal.start_line)
                window.setTimeout(() => diff.getModifiedEditor().revealLineInCenter(line), 50)
              }}
              keepCurrentOriginalModel
              keepCurrentModifiedModel
              options={{ ...options, readOnly: true, renderSideBySide: false, originalEditable: false }}
            />
          </div>
        </>
      ) : (
        <div className="ws-monaco">
          <Editor
            path={file.path}
            value={value}
            language={lang.monaco}
            theme={theme}
            beforeMount={defineThemes}
            onMount={onMount}
            onChange={(v) => onChange(v ?? '')}
            options={{ ...options, readOnly }}
          />
        </div>
      )}
    </div>
  )
}
