import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronRight, Circle, GitCommitHorizontal, History, Info, PanelLeftClose, PanelLeftOpen, PanelRightOpen, SquareFunction, X } from 'lucide-react'
import { ApiError, type Enrollment } from '../../../api'
import { Loading, Notice } from '../../../ui'
import { AiPanel, type AiContext } from './AiPanel'
import { CodeEditor, type PasteInfo } from './CodeEditor'
import { BriefDialog, CompleteDialog, PastePopup, type PendingPaste } from './dialogs'
import { DocEditor } from './DocEditor'
import { FileIcon, FileTree } from './FileTree'
import { HistoryView } from './HistoryView'
import { OutputPanel, type RunView } from './OutputPanel'
import { clock, commitLabel, errorText, ws, type Proposal, type Selection, type Workspace, type WsCommit, type WsMessage } from './wsApi'
import './workspace.css'

/* 커밋 시점 규칙: AI 패널로 포커스 이동, 파일 전환, 실행 직전, AI 요청 직전, 30초 무입력, 5분 강제, 붙여넣기 */
const IDLE_MS = 30_000
const FORCE_MS = 5 * 60_000
/** 붙여넣기 출처를 묻는 기준 */
const PASTE_THRESHOLD = { chars: 40, lines: 3 }

/** 자리 4 작업공간. 여러 파일 편집, 자동 커밋, AI 수정안, 코드 실행, 보고서(docx) 편집을 한 화면에서 한다 */
export default function WorkspaceStage({ enrollment, onChanged }: { enrollment: Enrollment; onChanged: (notice?: string) => void }) {
  const eid = enrollment.id
  const [w, setW] = useState<Workspace | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  /* 파일 내용: contents 는 화면용, committed 는 서버에 커밋된 마지막 내용 */
  const [contents, setContents] = useState<Record<string, string>>({})
  const contentsRef = useRef<Record<string, string>>({})
  const committedRef = useRef<Record<string, string>>({})
  const prevRef = useRef<Record<string, string>>({}) // 마지막 변경 직전 내용. 붙여넣기 직전 상태를 커밋할 때 쓴다
  const [tabs, setTabs] = useState<string[]>([])
  const [active, setActiveRaw] = useState('')
  const activeRef = useRef('')

  /* 기록 */
  const [commits, setCommits] = useState<WsCommit[]>([])
  const [saving, setSaving] = useState(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const idleTimer = useRef<number | undefined>(undefined)
  const dirtySince = useRef<number | null>(null)
  const lastFocus = useRef<'editor' | 'ai'>('editor')

  /* 보고서: 편집기 안 입력은 보이지 않으므로 열려 있는 동안 커밋 시점과 30초마다 저장을 요청한다 */
  const docDirty = useRef<Record<string, number>>({})
  const docKeys = useRef<Record<string, string>>({})
  const [openedDocs, setOpenedDocs] = useState<string[]>([])
  const openedDocsRef = useRef<string[]>([])
  openedDocsRef.current = openedDocs

  /* AI */
  const [messages, setMessages] = useState<WsMessage[]>([])
  const [proposals, setProposals] = useState<Record<number, Proposal>>({})
  const [reviewId, setReviewId] = useState<number | null>(null)
  const [aiContext, setAiContext] = useState<AiContext | null>(null)
  const selection = useRef<(Selection & { path: string }) | null>(null)
  const [seed, setSeed] = useState(0)
  const [sending, setSending] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)

  /* 실행 */
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<RunView>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [outTab, setOutTab] = useState<'out' | 'test' | 'stdin'>('test')
  const [stdin, setStdin] = useState('')

  /* 화면 */
  const [history, setHistory] = useState(false)
  const [brief, setBrief] = useState(false)
  const [recordInfo, setRecordInfo] = useState(false)
  /* 좌우 패널 접기. 이 브라우저에서만 기억한다 */
  const [closed, setClosed] = useState<{ left: boolean; right: boolean }>(() => {
    try {
      return { left: false, right: false, ...JSON.parse(localStorage.getItem('ws_panels') ?? '{}') }
    } catch {
      return { left: false, right: false }
    }
  })
  const togglePanel = (side: 'left' | 'right') =>
    setClosed((c) => {
      const next = { ...c, [side]: !c[side] }
      try {
        localStorage.setItem('ws_panels', JSON.stringify(next))
      } catch {
        // 저장이 막힌 환경이면 이번 화면에서만 유지한다
      }
      return next
    })
  const [confirming, setConfirming] = useState(false)
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const x = await ws.get(eid)
      setW(x)
      const map = Object.fromEntries(x.files.map((f) => [f.path, f.content]))
      contentsRef.current = { ...map }
      committedRef.current = { ...map }
      setContents(map)
      setCommits(x.commits)
      setMessages(x.messages)
      setProposals(Object.fromEntries(x.proposals.map((p) => [p.id, p])))
      const lastRun = x.commits.find((c) => c.author === 'run')
      if (x.last_run && lastRun) setRun({ result: x.last_run, at: clock(lastRun.created_at), commitId: commitLabel(lastRun) })
      const first = x.files.find((f) => f.kind === 'code' && !f.readonly) ?? x.files[0]
      if (first && !activeRef.current) {
        activeRef.current = first.path
        setActiveRaw(first.path)
        setTabs(x.files.filter((f) => f.kind === 'code').slice(0, 2).map((f) => f.path))
      }
    } catch (e) {
      setLoadError(errorText(e))
    }
  }, [eid])

  useEffect(() => {
    void load()
  }, [load])

  const editable = w?.editable ?? false

  /* ───── 커밋 ───── */
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(job, job)
    queue.current = next.catch(() => undefined)
    return next
  }, [])

  const sendCommit = useCallback(
    (path: string, content: string, trigger: string, author: 'human' | 'paste' = 'human', paste?: PasteInfo) =>
      enqueue(async () => {
        if (content === committedRef.current[path]) return null
        setSaving((n) => n + 1)
        try {
          const r = await ws.commit(eid, { path, content, trigger, author, paste: paste ? { chars: paste.chars, lines: paste.lines } : undefined })
          committedRef.current[path] = content
          if (r.commit) setCommits((l) => [r.commit!, ...l])
          return r.commit
        } finally {
          setSaving((n) => n - 1)
        }
      }),
    [eid, enqueue],
  )

  const isDirty = (p: string) => contentsRef.current[p] !== undefined && contentsRef.current[p] !== committedRef.current[p]

  const commitFile = useCallback(
    (path: string, trigger: string) => (path && isDirty(path) ? sendCommit(path, contentsRef.current[path], trigger) : Promise.resolve(null)),
    [sendCommit],
  )

  const commitDoc = useCallback(
    (path: string, trigger: string) => {
      if (!docDirty.current[path]) return Promise.resolve(null)
      delete docDirty.current[path]
      return enqueue(async () => {
        setSaving((n) => n + 1)
        try {
          const r = await ws.docForcesave(eid, path, trigger, docKeys.current[path] ?? '')
          if (r.commit) {
            const c = r.commit
            setCommits((l) => (l.some((x) => x.id === c.id) ? l : [c, ...l]))
          }
          return r.commit
        } finally {
          setSaving((n) => n - 1)
        }
      })
    },
    [eid, enqueue],
  )

  const commitAll = useCallback(
    async (trigger: string) => {
      window.clearTimeout(idleTimer.current)
      for (const p of Object.keys(contentsRef.current).filter(isDirty)) await commitFile(p, trigger)
      for (const p of Object.keys(docDirty.current)) await commitDoc(p, trigger).catch(() => null)
      if (!Object.keys(contentsRef.current).some(isDirty)) dirtySince.current = null
    },
    [commitFile, commitDoc],
  )

  const logEvent = useCallback(
    (kind: string, path = '', payload: Record<string, unknown> = {}) => {
      if (editable) ws.events(eid, [{ kind, path, payload }]).catch(() => undefined)
    },
    [eid, editable],
  )

  useEffect(() => {
    const t = window.setInterval(() => {
      if (dirtySince.current && Date.now() - dirtySince.current >= FORCE_MS) void commitAll('interval')
      const cur = activeRef.current
      if (openedDocsRef.current.includes(cur)) docDirty.current[cur] ??= Date.now()
      for (const [p, since] of Object.entries(docDirty.current)) if (Date.now() - since >= IDLE_MS) void commitDoc(p, 'idle').catch(() => null)
    }, 10_000)
    return () => window.clearInterval(t)
  }, [commitAll, commitDoc])

  useEffect(() => {
    const onUnload = () => {
      for (const p of Object.keys(contentsRef.current).filter(isDirty)) ws.commitOnUnload(eid, p, contentsRef.current[p])
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      // 다른 단계로 이동할 때도 남은 변경을 커밋한다
      void commitAll('leave')
    }
  }, [eid, commitAll])

  const onEditorChange = (value: string) => {
    const path = activeRef.current
    if (value === contentsRef.current[path]) return // 서버에서 받은 내용을 에디터에 넣은 경우
    prevRef.current[path] = contentsRef.current[path]
    contentsRef.current[path] = value
    setContents((c) => ({ ...c, [path]: value }))
    lastFocus.current = 'editor'
    dirtySince.current ??= Date.now()
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => void commitAll('idle'), IDLE_MS)
  }

  const onEditorPaste = (info: PasteInfo) => {
    const path = activeRef.current
    const before = prevRef.current[path]
    const after = contentsRef.current[path]
    void (async () => {
      // 붙여넣기 전까지 직접 쓴 내용을 먼저 커밋하고, 붙여넣기를 따로 커밋한다
      if (before !== undefined) await sendCommit(path, before, 'before_paste')
      const c = await sendCommit(path, after, 'paste', 'paste', info)
      if (c && (info.chars >= PASTE_THRESHOLD.chars || info.lines >= PASTE_THRESHOLD.lines))
        setPendingPaste({ commitId: c.id, file: path, lines: info.lines, chars: info.chars })
    })().catch((e) => setChatError(errorText(e)))
  }

  const closePaste = (source: string | null, memo = '') => {
    const p = pendingPaste
    setPendingPaste(null)
    if (!p || !source) return
    ws.pasteSource(eid, p.commitId, source, memo)
      .then((c) => setCommits((l) => l.map((x) => (x.id === c.id ? c : x))))
      .catch((e) => setChatError(errorText(e)))
  }

  /* ───── 파일 ───── */
  const open = (name: string) => {
    const prev = activeRef.current
    if (prev && prev !== name) {
      void commitFile(prev, 'file_switch')
      if (openedDocsRef.current.includes(prev)) docDirty.current[prev] ??= Date.now()
      void commitDoc(prev, 'file_switch').catch(() => null)
      logEvent('file_switch', name, { from: prev })
    }
    activeRef.current = name
    if (w?.files.some((f) => f.path === name && f.kind === 'doc')) setOpenedDocs((d) => (d.includes(name) ? d : [...d, name]))
    setTabs((t) => (t.includes(name) ? t : [...t, name]))
    setActiveRaw(name)
  }

  const closeTab = (name: string) => {
    const rest = tabs.filter((t) => t !== name)
    setTabs(rest)
    if (active === name && rest.length) open(rest[rest.length - 1])
  }

  const remapPaths = (map: (p: string) => string | null) => {
    const move = <T,>(rec: Record<string, T>) => {
      const out: Record<string, T> = {}
      for (const [k, v] of Object.entries(rec)) {
        const n = map(k)
        if (n !== null) out[n] = v
      }
      return out
    }
    contentsRef.current = move(contentsRef.current)
    committedRef.current = move(committedRef.current)
    prevRef.current = move(prevRef.current)
    docDirty.current = move(docDirty.current)
    docKeys.current = move(docKeys.current)
    setContents({ ...contentsRef.current })
    setTabs((t) => t.map(map).filter((x): x is string => x !== null))
    setOpenedDocs((d) => d.map(map).filter((x): x is string => x !== null))
    setProposals((all) =>
      Object.fromEntries(
        Object.entries(all).map(([id, pr]) => {
          const n = map(pr.file_path)
          return [id, n === null ? { ...pr, status: pr.status === 'pending' ? 'stale' : pr.status } : { ...pr, file_path: n }]
        }),
      ) as Record<number, Proposal>,
    )
    const cur = map(activeRef.current)
    if (cur !== activeRef.current) {
      const fallback = cur ?? w?.files.map((f) => map(f.path)).find((x): x is string => x !== null) ?? ''
      activeRef.current = fallback
      setActiveRaw(fallback)
    }
  }

  const createFile = async (path: string) => {
    const f = await ws.newFile(eid, path)
    setW((x) => (x ? { ...x, files: [...x.files, f] } : x))
    contentsRef.current[f.path] = f.content
    committedRef.current[f.path] = f.content
    setContents((c) => ({ ...c, [f.path]: f.content }))
    if (f.kind === 'doc') setOpenedDocs((d) => [...d, f.path])
    activeRef.current = ''
    open(f.path)
  }

  const renameFile = async (path: string, newPath: string, folder: boolean) => {
    await commitAll('before_rename')
    const r = await ws.renameFile(eid, path, newPath, folder)
    const map = (p: string) => (folder ? (p.startsWith(`${path}/`) ? newPath + p.slice(path.length) : p) : p === path ? newPath : p)
    setW((x) => (x ? { ...x, files: x.files.map((f) => r.files.find((y) => y.path === map(f.path)) ?? f) } : x))
    remapPaths(map)
    setCommits((l) => [...r.commits, ...l])
  }

  const deleteFile = async (path: string, folder: boolean) => {
    await commitAll('before_delete')
    const r = await ws.deleteFile(eid, path, folder)
    const gone = (p: string) => (folder ? p.startsWith(`${path}/`) : p === path)
    setW((x) => (x ? { ...x, files: x.files.filter((f) => !gone(f.path)) } : x))
    remapPaths((p) => (gone(p) ? null : p))
    setCommits((l) => [...r.commits, ...l])
  }

  /* ───── AI ───── */
  const askAi = (label: string, detail: string, prompt?: string) => {
    if (closed.right) togglePanel('right')
    setAiContext({ label, detail, prompt })
    setSeed((s) => s + 1)
  }

  const onSelection = (sel: Selection | null) => {
    if (!sel || !sel.text.trim()) return // 선택을 풀어도 마지막 선택은 문맥으로 남긴다. 칩의 X 로 뺀다
    selection.current = { ...sel, path: activeRef.current }
    setAiContext({ label: '선택한 코드', detail: `${activeRef.current} ${sel.start_line}${sel.end_line > sel.start_line ? `–${sel.end_line}` : ''}줄` })
  }

  const onFocusPanel = () => {
    if (openedDocsRef.current.includes(activeRef.current)) {
      docDirty.current[activeRef.current] ??= Date.now()
      lastFocus.current = 'editor'
    }
    if (lastFocus.current === 'ai') return
    lastFocus.current = 'ai'
    logEvent('focus_ai', activeRef.current)
    void commitAll('focus_ai')
  }

  const sendChat = async (text: string) => {
    setSending(text)
    setChatError(null)
    try {
      await commitAll('before_ai')
      const sel = aiContext && selection.current ? selection.current : null
      const r = await ws.chat(eid, text, sel?.path ?? activeRef.current, sel ? { start_line: sel.start_line, end_line: sel.end_line, text: sel.text } : null)
      setMessages((m) => [...m, ...r.messages])
      setAiContext(null)
      selection.current = null
      if (r.proposal) {
        const p = r.proposal
        setProposals((all) => ({ ...all, [p.id]: p }))
        open(p.file_path)
        setReviewId(p.id)
      }
      return true
    } catch (e) {
      setChatError(errorText(e))
      return false
    } finally {
      setSending(null)
    }
  }

  const reviewing = reviewId !== null ? proposals[reviewId] : undefined
  const activeProposal = reviewing && reviewing.status === 'pending' && reviewing.file_path === active ? reviewing : null

  const resolve = async (p: Proposal, mode: 'accept' | 'reject', text?: string) => {
    setChatError(null)
    try {
      if (mode === 'reject') {
        const r = await ws.reject(eid, p.id)
        setProposals((all) => ({ ...all, [p.id]: r.proposal }))
      } else {
        await commitFile(p.file_path, 'before_accept')
        const r = await enqueue(() => ws.accept(eid, p.id, text))
        setProposals((all) => ({ ...all, [p.id]: r.proposal }))
        if (r.file) {
          const f = r.file
          contentsRef.current[f.path] = f.content
          committedRef.current[f.path] = f.content
          setContents((c) => ({ ...c, [f.path]: f.content }))
        }
        if (r.commit) setCommits((l) => [r.commit!, ...l])
      }
      setReviewId(null)
    } catch (e) {
      setChatError(errorText(e))
      if (e instanceof ApiError && e.status === 409) {
        setProposals((all) => ({ ...all, [p.id]: { ...p, status: 'stale' } }))
        setReviewId(null)
      }
    }
  }

  /* ───── 실행 ───── */
  const runCode = async (mode: 'run' | 'test') => {
    if (running) return
    setRunning(true)
    setRunError(null)
    try {
      await commitAll('before_run')
      const r = await ws.run(eid, activeRef.current, mode, stdin)
      setRun({ result: r.result, at: clock(r.commit.created_at), commitId: commitLabel(r.commit) })
      setCommits((l) => [r.commit, ...l])
      setOutTab(mode === 'test' ? 'test' : 'out')
    } catch (e) {
      setRunError(errorText(e))
      setOutTab(mode === 'test' ? 'test' : 'out')
    } finally {
      setRunning(false)
    }
  }

  /* ───── 제출 ───── */
  const submit = async () => {
    setSubmitBusy(true)
    setSubmitError(null)
    try {
      await commitAll('submit')
      const r = await ws.submit(eid)
      setConfirming(false)
      onChanged(r.warning ?? '과제를 제출했다. 이제 사후평가를 본다')
    } catch (e) {
      setSubmitError(errorText(e))
    } finally {
      setSubmitBusy(false)
    }
  }

  const startAttempt = async () => {
    try {
      await ws.newAttempt(eid)
      activeRef.current = ''
      await load()
      onChanged()
    } catch (e) {
      setNotice(errorText(e))
    }
  }

  if (loadError) return <div className="page narrow"><Notice kind="error">{loadError}</Notice></div>
  if (!w) return <Loading />

  const changed = new Set(Object.keys(contents).filter((p) => contents[p] !== committedRef.current[p]))
  const file = w.files.find((f) => f.path === active)
  const pending = Object.values(proposals).filter((p) => p.status === 'pending').length
  const canRetry = !w.editable && enrollment.stage === 'done' && !w.deadline_passed && enrollment.attempts.every((a) => a.status === 'submitted')

  return (
    <>
      {history && (
        <HistoryView
          commits={commits}
          onClose={() => setHistory(false)}
          onOpenChat={() => setHistory(false)}
        />
      )}
      {/* 수정 이력을 보는 동안에도 작업 화면을 내리지 않는다. 보고서 편집 세션이 끊기지 않게 하기 위해서다 */}
      <div className={`ws${closed.left ? ' left-closed' : ''}${closed.right ? ' right-closed' : ''}`} style={history ? { display: 'none' } : undefined}>
        {closed.left ? (
          <aside className="ws-side ws-rail" aria-label="파일">
            <button className="ws-icon-btn" title="파일 패널 열기" aria-label="파일 패널 열기" onClick={() => togglePanel('left')}>
              <PanelLeftOpen aria-hidden="true" />
            </button>
            <span className="ws-rail-sep" />
            {w.files.map((f) => (
              <button key={f.path} className={f.path === active ? 'ws-icon-btn active' : 'ws-icon-btn'} title={f.path} aria-label={f.path} onClick={() => open(f.path)}>
                <FileIcon kind={f.kind} />
              </button>
            ))}
          </aside>
        ) : (
          <aside className="ws-side">
            <div className="ws-side-top">
              <span>파일</span>
              <button className="ws-icon-btn" title="파일 패널 접기" aria-label="파일 패널 접기" onClick={() => togglePanel('left')}>
                <PanelLeftClose aria-hidden="true" />
              </button>
            </div>
            <button className="ws-brief-card" onClick={() => setBrief(true)}>
            <span className="ws-brief-icon">
              <SquareFunction aria-hidden="true" />
            </span>
            <span className="ws-grow">
              <strong>과제 설명</strong>
              <small>{w.description.split('\n')[0] || w.title}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
          <FileTree
            files={w.files}
            changed={changed}
            active={active}
            setActive={open}
            editable={editable}
            onCreate={createFile}
            onRename={renameFile}
            onDelete={deleteFile}
          />
          <div className="ws-record">
            <button className="ws-record-chip" onClick={() => setRecordInfo((v) => !v)} aria-expanded={recordInfo}>
              <Circle aria-hidden="true" /> 과정 기록 중 <Info aria-hidden="true" />
            </button>
            {recordInfo && (
              <div className="ws-record-pop">
                <strong>무엇이 기록되나요?</strong>
                <ul>
                  <li>편집 내용 (포커스 이동 · 파일 전환 · 30초 정지 시 묶어서 저장)</li>
                  <li>파일 만들기, 이름 바꾸기, 삭제</li>
                  <li>AI 대화, 수정안 수락 / 거절 / 직접 수정</li>
                  <li>코드 실행 · 컴파일 · 테스트 결과</li>
                  <li>붙여넣기 길이와 시점, 직접 적은 출처</li>
                </ul>
                <p>AI 사용은 감점이 아니에요. 교수는 이 기록으로 과정을 확인해요.</p>
              </div>
            )}
          </div>
          </aside>
        )}

        <section className="ws-main" aria-label="작업 영역">
          <div className="ws-bar">
            <div className="ws-tabs" role="tablist">
              {tabs.map((t) => {
                const f = w.files.find((x) => x.path === t)
                if (!f) return null
                return (
                  <div key={t} role="tab" aria-selected={t === active} className={t === active ? 'ws-tab active' : 'ws-tab'} onClick={() => open(t)} title={t}>
                    <FileIcon kind={f.kind} />
                    <span className="ws-ellipsis">{t}</span>
                    {changed.has(t) && <i className="ws-dot" />}
                    {tabs.length > 1 && (
                      <button
                        className="ws-tab-x"
                        aria-label={`${t} 닫기`}
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(t)
                        }}
                      >
                        <X aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <span className="ws-meta num">
              {saving > 0 ? (
                <>
                  <span className="ws-mini-spinner" /> 저장 중
                </>
              ) : editable ? (
                <>
                  <Check aria-hidden="true" /> 자동 저장
                </>
              ) : (
                '제출됨 · 읽기 전용'
              )}
              <i className="ws-meta-sep" />
              <GitCommitHorizontal aria-hidden="true" /> 마지막 커밋 {commits[0] ? commitLabel(commits[0]) : '-'}
            </span>
            <button
              className="ws-btn"
              onClick={() => {
                void commitAll('open_history')
                setHistory(true)
              }}
            >
              <History aria-hidden="true" /> 수정 이력
            </button>
            {editable ? (
              <button className="ws-btn primary" onClick={() => setConfirming(true)} disabled={commits.length === 0}>
                작성 완료 <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              canRetry && (
                <button className="ws-btn primary" onClick={() => void startAttempt()}>
                  재제출 시도 시작
                </button>
              )
            )}
          </div>
          {notice && (
            <div className="ws-pad">
              <Notice kind="error" onClose={() => setNotice(null)}>
                {notice}
              </Notice>
            </div>
          )}

          {openedDocs.map((p) => (
            <DocEditor
              key={p}
              eid={eid}
              path={p}
              hidden={active !== p}
              onDirty={() => {
                docDirty.current[p] ??= Date.now()
                lastFocus.current = 'editor'
              }}
              onKey={(k) => (docKeys.current[p] = k)}
            />
          ))}
          {!file ? (
            <p className="soft ws-pad">파일을 고른다</p>
          ) : file.kind === 'doc' ? null : (
            <div className="ws-code-area">
              <CodeEditor
                key={file.path}
                file={file}
                value={contents[file.path] ?? ''}
                readOnly={!editable || file.readonly}
                running={running}
                onRun={(m) => void runCode(m)}
                onChange={onEditorChange}
                onPaste={onEditorPaste}
                onSelection={onSelection}
                proposal={activeProposal}
                onAccept={() => activeProposal && void resolve(activeProposal, 'accept')}
                onReject={() => activeProposal && void resolve(activeProposal, 'reject')}
                onApplyEdited={(text) => activeProposal && void resolve(activeProposal, 'accept', text)}
              />
              <OutputPanel
                running={running}
                run={run}
                error={runError}
                tab={outTab}
                setTab={setOutTab}
                stdin={stdin}
                setStdin={setStdin}
                onAskAi={(label, prompt) => askAi(label, '실행 결과', prompt)}
              />
            </div>
          )}
          {pendingPaste && <PastePopup paste={pendingPaste} onSave={(s, m) => closePaste(s, m)} onSkip={() => closePaste(null)} />}
        </section>

        {closed.right ? (
          <aside className="ws-ai ws-rail" aria-label="AI 도우미">
            <button className="ws-icon-btn" title="AI 패널 열기" aria-label="AI 패널 열기" onClick={() => togglePanel('right')}>
              <PanelRightOpen aria-hidden="true" />
            </button>
            <span className="ws-rail-label">AI</span>
            {pending > 0 && (
              <button className="ws-rail-badge" title={`검토 대기 수정안 ${pending}개`} onClick={() => togglePanel('right')}>
                {pending}
              </button>
            )}
          </aside>
        ) : (
          <AiPanel
            onCollapse={() => togglePanel('right')}
            messages={messages}
          proposals={proposals}
          onShowProposal={(p) => {
            open(p.file_path)
            setReviewId(p.id)
          }}
          context={aiContext}
          setContext={(c) => {
            setAiContext(c)
            if (!c) selection.current = null
          }}
          seed={seed}
          onSend={sendChat}
          sending={sending}
          aiAvailable={w.ai_available}
          error={chatError}
          setError={setChatError}
          disabled={!editable}
          onFocusPanel={onFocusPanel}
          />
        )}
      </div>

      {brief && (
        <BriefDialog
          subject={w.subject}
          title={w.title}
          deadline={w.deadline ? new Date(w.deadline.endsWith('Z') ? w.deadline : `${w.deadline}Z`).toLocaleString('ko-KR') : '없음'}
          description={w.description}
          files={w.files}
          testCount={w.tests.length}
          onClose={() => setBrief(false)}
        />
      )}
      {confirming && (
        <CompleteDialog
          files={w.files.filter((f) => !f.readonly).map((f) => f.path)}
          commitCount={commits.length}
          aiCount={commits.filter((c) => c.author === 'ai' || c.meta?.edited_from_ai).length}
          tests={{ passed: run?.result.passed ?? 0, total: run?.result.total ?? 0 }}
          unattributedPastes={commits.filter((c) => c.meta?.paste && !c.meta.paste.source).length}
          pendingSuggestions={pending}
          busy={submitBusy}
          error={submitError}
          onClose={() => setConfirming(false)}
          onSubmit={() => void submit()}
        />
      )}
    </>
  )
}
