import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import initSqlJs, { type Database, type QueryExecResult, type SqlJsStatic } from 'sql.js'

import { api, formatDate, TOOL_LABEL, type ChatMessage, type Enrollment, type TaskState } from '../../api'
import Chat from '../../components/Chat'
import VersionList from '../../components/VersionList'
import { openPip, pipSupported, type PipHandle } from '../../pip'

export default function TaskStage({ enrollment, onChanged }: { enrollment: Enrollment; onChanged: (notice?: string) => void }) {
  const eid = enrollment.id
  const [t, setT] = useState<TaskState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const reload = useCallback(() => api.stu.task(eid).then(setT).catch((e: Error) => setError(e.message)), [eid])
  useEffect(() => {
    void reload()
  }, [reload])

  if (error && !t) return <p className="error">{error}</p>
  if (!t) return <p className="muted">불러오는 중</p>

  const attempt = t.attempt
  const editable = Boolean(attempt) && !t.deadline_passed
  // 진행 중인 시도가 없으면 마지막 시도의 마지막 텍스트 버전을 보여 주고, 새 시도는 그 내용에서 이어서 시작한다
  const lastTextOf = (versions: { text_content: string | null }[]) =>
    [...versions].reverse().find((v) => v.text_content)?.text_content
  const latestText =
    lastTextOf(attempt?.versions ?? []) ??
    [...t.attempts]
      .reverse()
      .map((x) => lastTextOf(x.versions))
      .find((text) => text) ??
    ''
  const reasonReady = reason.trim().length > 0

  async function saveText(text: string, source: string, meta?: Record<string, unknown>) {
    if (!reasonReady) {
      setError('변경 이유를 한 줄 적어야 저장할 수 있다')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setT(await api.stu.saveVersion(eid, { text_content: text, reason: reason.trim(), source, meta }))
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function saveFile(file: File | undefined, source: string) {
    if (!file) return
    if (!reasonReady) {
      setError('변경 이유를 한 줄 적어야 저장할 수 있다')
      return
    }
    setBusy(true)
    setError(null)
    try {
      setT(await api.stu.saveFileVersion(eid, file, reason.trim(), source))
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  async function send(message: string) {
    const msgs = await api.stu.taskChat(eid, message)
    setT((prev) => (prev ? { ...prev, messages: [...prev.messages, ...msgs] } : prev))
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.stu.submit(eid)
      setT(res.task)
      setConfirming(false)
      onChanged(res.warning ?? (res.task.stage === 'post' ? '과제를 제출했다. 이제 사후평가를 본다.' : '재제출을 마쳤다. 마감 전에는 다시 시도할 수 있다.'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출 실패')
    } finally {
      setBusy(false)
    }
  }

  async function newAttempt() {
    setBusy(true)
    try {
      setT(await api.stu.newAttempt(eid))
    } catch (e) {
      setError(e instanceof Error ? e.message : '새 시도 실패')
    } finally {
      setBusy(false)
    }
  }

  const chatDisabledReason = t.deadline_passed ? '마감이 지났다' : '진행 중인 시도가 없다'

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>과제 문제</h2>
            <p className="muted small">
              자리 {t.tool_slot} · {TOOL_LABEL[t.tool_name] ?? t.tool_name} · {t.task_kind === 'performance' ? '수행형' : '논술형'} · 마감{' '}
              {formatDate(t.deadline)}
            </p>
          </div>
          <div className="row">
            {attempt ? (
              <>
                <span className="chip chip-primary">
                  시도 {attempt.attempt_no} 진행 중 · 버전 {attempt.versions.length}개
                </span>
                {confirming ? (
                  <>
                    <span className="small">
                      {t.stage === 'task'
                        ? '제출하면 사후평가로 넘어가고, 마감 전에는 다시 들어와 3단계만 수행해 재제출할 수 있다.'
                        : '이 시도를 제출한다.'}
                    </span>
                    <button className="btn" onClick={() => void submit()} disabled={busy}>
                      제출 확정
                    </button>
                    <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                      취소
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => setConfirming(true)} disabled={busy || !editable || attempt.versions.length === 0}>
                    제출
                  </button>
                )}
              </>
            ) : t.can_start_new_attempt ? (
              <button className="btn btn-secondary" onClick={() => void newAttempt()} disabled={busy}>
                재제출 시도 시작, 3단계만 다시 한다
              </button>
            ) : (
              <span className="chip">{t.deadline_passed ? '마감이 지나 수정할 수 없다' : '제출됨'}</span>
            )}
          </div>
        </div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{t.description || '교수가 과제 설명을 쓰지 않았다.'}</p>
        {!editable && attempt === null && t.stage === 'post' && (
          <div className="banner info">첫 제출을 마쳤다. 상단의 사후평가를 보고 나면 마감 전까지 재제출할 수 있다.</div>
        )}
        {error && <p className="error small">{error}</p>}
      </div>

      <div className="grid-side">
        <div>
          <div className="card">
            {editable && (
              <div className="field">
                <label>이번 버전의 변경 이유, 저장할 때 필수</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 부서별 평균을 구하려고 GROUP BY를 추가했다"
                  maxLength={500}
                />
              </div>
            )}
            {t.tool_name === 'sql' && (
              <SqlTool
                config={t.tool_config as { schema_sql?: string; seed_sql?: string }}
                initial={latestText}
                editable={editable}
                busy={busy}
                onSave={(code, meta) => saveText(code, 'embed', meta)}
              />
            )}
            {t.tool_name === 'editor' && (
              <EditorTool initial={latestText} editable={editable} busy={busy} onSave={(text) => saveText(text, 'editor')} />
            )}
            {t.tool_name === 'google_docs' && (
              <GoogleTool
                t={t}
                eid={eid}
                editable={editable}
                busy={busy}
                onTask={setT}
                onError={setError}
                onUpload={(f) => saveFile(f, 'google')}
                chat={{ messages: t.messages, onSend: send, rules: t.student_rules, disabled: !editable, disabledReason: chatDisabledReason }}
              />
            )}
            {t.tool_name === 'companion' && (
              <CompanionTool t={t} eid={eid} editable={editable} busy={busy} onUpload={(f) => saveFile(f, 'companion')} />
            )}
          </div>
          <div className="card">
            <h3>결과물 변경 이력{attempt ? `, 시도 ${attempt.attempt_no}` : ''}</h3>
            <p className="muted small">저장할 때마다 버전이 남고 변경 이유 한 줄이 함께 기록된다. 직전 버전과의 비교 화면은 준비 중이다.</p>
            {attempt ? (
              <VersionList versions={attempt.versions} filePath={(vid) => api.stu.versionFilePath(eid, vid)} compact />
            ) : (
              t.attempts.map((x) => (
                <details key={x.id} style={{ marginBottom: 8 }}>
                  <summary>
                    시도 {x.attempt_no} · {x.status === 'submitted' ? `제출 ${formatDate(x.submitted_at)}` : '진행 중'} · 버전 {x.versions.length}개
                  </summary>
                  <VersionList versions={x.versions} filePath={(vid) => api.stu.versionFilePath(eid, vid)} compact />
                </details>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <Chat
            title="학습 AI, 과제 단계"
            messages={t.messages}
            onSend={send}
            rules={t.student_rules}
            disabled={!editable}
            disabledReason={chatDisabledReason}
          />
        </div>
      </div>
    </div>
  )
}

function EditorTool({
  initial,
  editable,
  busy,
  onSave,
}: {
  initial: string
  editable: boolean
  busy: boolean
  onSave: (text: string) => Promise<void>
}) {
  const [text, setText] = useState(initial)
  useEffect(() => setText(initial), [initial])
  return (
    <div>
      <div className="card-title">
        <h3>페이지 안 문서 편집기</h3>
        <button className="btn btn-sm" onClick={() => void onSave(text)} disabled={!editable || busy || !text.trim()}>
          버전 저장
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ minHeight: 360 }}
        disabled={!editable}
        placeholder="여기에 글을 쓴다. 저장할 때마다 버전이 남는다."
      />
    </div>
  )
}

function SqlTool({
  config,
  initial,
  editable,
  busy,
  onSave,
}: {
  config: { schema_sql?: string; seed_sql?: string }
  initial: string
  editable: boolean
  busy: boolean
  onSave: (code: string, meta: Record<string, unknown>) => Promise<void>
}) {
  const [code, setCode] = useState(initial || '-- SQL 조회문을 작성한다\n')
  const [results, setResults] = useState<QueryExecResult[] | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const sqlRef = useRef<SqlJsStatic | null>(null)
  const lastRun = useRef<Record<string, unknown>>({})

  useEffect(() => {
    if (initial) setCode(initial)
  }, [initial])

  useEffect(() => {
    let cancelled = false
    initSqlJs({ locateFile: (f: string) => `/${f}` })
      .then((SQL) => {
        if (cancelled) return
        sqlRef.current = SQL
        setReady(true)
      })
      .catch((e: Error) => setRunError(`sql.js 로드 실패: ${e.message}`))
    return () => {
      cancelled = true
    }
  }, [])

  function freshDb(): Database | null {
    const SQL = sqlRef.current
    if (!SQL) return null
    const db = new SQL.Database()
    if (config.schema_sql) db.run(config.schema_sql)
    if (config.seed_sql) db.run(config.seed_sql)
    return db
  }

  function run() {
    setRunError(null)
    let db: Database | null = null
    try {
      db = freshDb()
      if (!db) return
      const res = db.exec(code)
      setResults(res)
      lastRun.current = { rows: res.reduce((n, r) => n + r.values.length, 0), ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setRunError(msg)
      setResults(null)
      lastRun.current = { ok: false, error: msg }
    } finally {
      db?.close()
    }
  }

  return (
    <div>
      <div className="card-title">
        <div>
          <h3>Monaco 편집기와 sql.js</h3>
          <p className="muted small">자동 완성은 꺼져 있다. 실행은 브라우저 안에서만 돌고 저장할 때 조회문과 실행 결과 요약이 버전으로 남는다.</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={run} disabled={!ready}>
            실행
          </button>
          <button className="btn btn-sm" onClick={() => void onSave(code, lastRun.current)} disabled={!editable || busy || !code.trim()}>
            버전 저장
          </button>
        </div>
      </div>
      <div className="editor-frame">
        <Editor
          height="320px"
          defaultLanguage="sql"
          value={code}
          onChange={(v) => setCode(v ?? '')}
          options={{
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: 'off',
            minimap: { enabled: false },
            fontSize: 14,
            readOnly: !editable,
          }}
        />
      </div>
      {runError && (
        <p className="error small" style={{ marginTop: 8 }}>
          {runError}
        </p>
      )}
      {results && results.length === 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>
          결과 행이 없다.
        </p>
      )}
      {results &&
        results.map((r, i) => (
          <div className="result-table" key={i} style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  {r.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.values.slice(0, 200).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell === null ? 'NULL' : String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {config.schema_sql && (
        <details style={{ marginTop: 8 }}>
          <summary className="small">교수가 준 스키마</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>
            {config.schema_sql}
          </pre>
        </details>
      )}
    </div>
  )
}

interface ChatProps {
  messages: ChatMessage[]
  onSend: (m: string) => Promise<void>
  rules: string[]
  disabled: boolean
  disabledReason: string
}

function GoogleTool({
  t,
  eid,
  editable,
  busy,
  onTask,
  onError,
  onUpload,
  chat,
}: {
  t: TaskState
  eid: number
  editable: boolean
  busy: boolean
  onTask: (t: TaskState) => void
  onError: (m: string | null) => void
  onUpload: (f: File | undefined) => Promise<void>
  chat: ChatProps
}) {
  const [docUrl, setDocUrl] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [pip, setPip] = useState<PipHandle | null>(null)
  const connected = t.google_connected
  const docId = (t.attempt?.versions ?? []).map((v) => v.meta?.doc_id as string | undefined).find(Boolean)

  useEffect(() => {
    if (!connected || !editable) return
    const timer = setInterval(() => {
      api.stu
        .googleSync(eid)
        .then((r) => {
          onTask(r.task)
          if (r.added > 0) setInfo(`수정 이력 ${r.added}개를 새 버전으로 받았다.`)
        })
        .catch(() => undefined)
    }, 120_000)
    return () => clearInterval(timer)
  }, [connected, editable, eid, onTask])

  useEffect(() => {
    if (!pip) return
    const close = () => setPip(null)
    pip.win.addEventListener('pagehide', close)
    return () => pip.win.removeEventListener('pagehide', close)
  }, [pip])

  async function connect() {
    setWorking(true)
    onError(null)
    try {
      const { url } = await api.stu.googleAuthUrl(eid)
      window.location.href = url
    } catch (e) {
      onError(e instanceof Error ? e.message : '연결 실패')
      setWorking(false)
    }
  }

  async function setDoc() {
    setWorking(true)
    onError(null)
    try {
      const r = await api.stu.googleSetDoc(eid, docUrl)
      onTask(r.task)
      setInfo(`문서를 연결했고 수정 이력 ${r.added}개를 버전으로 받았다.`)
      setDocUrl('')
    } catch (e) {
      onError(e instanceof Error ? e.message : '문서 지정 실패')
    } finally {
      setWorking(false)
    }
  }

  async function sync() {
    setWorking(true)
    onError(null)
    try {
      const r = await api.stu.googleSync(eid)
      onTask(r.task)
      setInfo(r.added > 0 ? `수정 이력 ${r.added}개를 새 버전으로 받았다.` : '새 수정 이력이 없다.')
    } catch (e) {
      onError(e instanceof Error ? e.message : '동기화 실패')
    } finally {
      setWorking(false)
    }
  }

  async function popout() {
    if (pip) {
      pip.win.close()
      setPip(null)
      return
    }
    if (pipSupported()) {
      try {
        const handle = await openPip()
        if (handle) {
          setPip(handle)
          return
        }
      } catch {
        // 사용자가 거부했거나 지원하지 않으면 별도 창으로 간다
      }
    }
    window.open(`/stu/enrollments/${eid}/chat`, 'ai-panel', 'width=440,height=680')
  }

  return (
    <div>
      <h3>Google 문서</h3>
      <p className="small">
        Google 계정을 연결하고 문서 주소를 지정하면 서버가 Google Drive API의 수정 이력을 받아 버전으로 저장한다. 학습 AI는 아래 버튼으로 문서
        탭 위에 작은 창으로 띄운다.
      </p>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className={`chip ${connected ? 'chip-ok' : ''}`}>{connected ? 'Google 계정 연결됨' : 'Google 계정 연결 안 됨'}</span>
        {!connected ? (
          <button className="btn btn-secondary btn-sm" onClick={() => void connect()} disabled={!editable || working}>
            Google 계정 연결
          </button>
        ) : (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => void sync()} disabled={!editable || working}>
              지금 동기화
            </button>
            {docId && (
              <a className="btn btn-ghost btn-sm" href={`https://docs.google.com/document/d/${docId}/edit`} target="_blank" rel="noreferrer">
                문서 열기
              </a>
            )}
          </>
        )}
        <button className="btn btn-sm" onClick={() => void popout()}>
          {pip ? 'AI 창 닫기' : '문서 탭 위에 AI 창 띄우기'}
        </button>
      </div>
      {connected && (
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/문서ID/edit"
            style={{ flex: 1 }}
            disabled={!editable || working}
          />
          <button className="btn btn-sm" onClick={() => void setDoc()} disabled={!editable || working || !docUrl.trim()}>
            문서 지정
          </button>
        </div>
      )}
      {info && <p className="small ok">{info}</p>}
      <div className="field" style={{ marginTop: 10 }}>
        <label>보조 경로, 문서를 파일로 내려받아 올리면 버전이 남는다</label>
        <input type="file" onChange={(e) => void onUpload(e.target.files?.[0])} disabled={!editable || busy} />
      </div>
      {pip &&
        createPortal(
          <div className="card" style={{ padding: 8, margin: 0 }}>
            <Chat
              title="학습 AI, 과제 단계"
              messages={chat.messages}
              onSend={chat.onSend}
              rules={chat.rules}
              disabled={chat.disabled}
              disabledReason={chat.disabledReason}
            />
          </div>,
          pip.container,
        )}
    </div>
  )
}

function CompanionTool({
  t,
  eid,
  editable,
  busy,
  onUpload,
}: {
  t: TaskState
  eid: number
  editable: boolean
  busy: boolean
  onUpload: (f: File | undefined) => Promise<void>
}) {
  const [token, setToken] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const cfg = t.tool_config as { program?: string; extensions?: string }
  async function issue() {
    try {
      setToken((await api.stu.companionToken(eid)).token)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '토큰 발급 실패')
    }
  }
  return (
    <div>
      <h3>{cfg.program ?? '설치된 프로그램'}과 보조 프로그램</h3>
      <p className="small">
        보조 프로그램이 {cfg.program ?? '프로그램'} 창을 캡처하고 저장 폴더에 {cfg.extensions ?? '결과물'} 파일이 저장될 때마다 버전을 올리며 학습
        AI 창을 항상 위에 띄운다. 브라우저를 닫아도 기록이 이어진다.
      </p>
      <ol className="small" style={{ paddingLeft: 18 }}>
        <li>
          <a href="/downloads/companion.exe">보조 프로그램 내려받기</a>, 서명이 없어 Windows 경고가 뜰 수 있다
        </li>
        <li>아래 연결 토큰을 발급해 프로그램에 붙여 넣는다</li>
        <li>프로그램에서 캡처 범위 동의를 읽고 저장 폴더를 고르면 기록이 시작된다</li>
      </ol>
      <div className="row">
        <button className="btn btn-secondary btn-sm" onClick={() => void issue()} disabled={!editable}>
          연결 토큰 발급
        </button>
        <span className={`chip ${t.companion_connected ? 'chip-ok' : ''}`}>{t.companion_connected ? '보조 프로그램 연결됨' : '연결 안 됨'}</span>
      </div>
      {token && (
        <div className="banner info" style={{ marginTop: 8 }}>
          <code style={{ userSelect: 'all' }}>{token}</code>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            이 토큰은 이 과제의 기록에만 쓰인다. 다른 사람에게 주지 않는다.
          </p>
        </div>
      )}
      {err && <p className="error small">{err}</p>}
      <div className="field" style={{ marginTop: 10 }}>
        <label>직접 파일 올리기, 보조 프로그램을 쓸 수 없을 때</label>
        <input type="file" onChange={(e) => void onUpload(e.target.files?.[0])} disabled={!editable || busy} />
      </div>
    </div>
  )
}
