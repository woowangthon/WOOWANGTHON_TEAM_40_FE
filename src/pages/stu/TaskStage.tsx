import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import initSqlJs, { type Database, type QueryExecResult, type SqlJsStatic } from 'sql.js'

import { api, formatDate, TOOL_LABEL, type Enrollment, type TaskState } from '../../api'
import Chat from '../../components/Chat'
import VersionList from '../../components/VersionList'
import ExternalWork, { CompanionSetup, GoogleSetup } from './ExternalWork'

// 자리 2와 자리 3은 기록이 페이지 밖에서 생기므로 이 간격으로 상태를 다시 받는다
const EXTERNAL_POLL_MS = 15_000

export default function TaskStage({ enrollment, onChanged }: { enrollment: Enrollment; onChanged: (notice?: string) => void }) {
  const eid = enrollment.id
  const [t, setT] = useState<TaskState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  // 대화를 보내는 중에 출발한 상태 요청은 새 대화가 빠져 있을 수 있으므로 버린다
  const chatSeq = useRef(0)

  const reload = useCallback(() => api.stu.task(eid).then(setT).catch((e: Error) => setError(e.message)), [eid])
  useEffect(() => {
    void reload()
  }, [reload])

  const external = t?.tool_name === 'google_docs' || t?.tool_name === 'companion'
  const polling = external && Boolean(t?.attempt) && !t?.deadline_passed
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(() => {
      const seq = chatSeq.current
      api.stu
        .task(eid)
        .then((next) => {
          if (seq === chatSeq.current) setT(next)
        })
        .catch(() => undefined)
    }, EXTERNAL_POLL_MS)
    return () => clearInterval(timer)
  }, [polling, eid])

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

  async function send(message: string) {
    chatSeq.current += 1
    try {
      const msgs = await api.stu.taskChat(eid, message)
      setT((prev) => (prev ? { ...prev, messages: [...prev.messages, ...msgs] } : prev))
    } finally {
      chatSeq.current += 1
    }
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

  // 자리 2는 문서가 지정되었을 때, 자리 3은 보조 프로그램이 서버에 접속한 적이 있을 때 작업이 시작된 것으로 본다
  const externalStarted =
    t.tool_name === 'google_docs' ? t.google_connected && Boolean(t.google_doc_id) : t.tool_name === 'companion' && t.companion_last_seen !== null
  if (external && attempt && externalStarted) {
    return (
      <ExternalWork
        t={t}
        eid={eid}
        attempt={attempt}
        editable={editable}
        busy={busy}
        error={error}
        chat={{ messages: t.messages, onSend: send, rules: t.student_rules, disabledReason: chatDisabledReason }}
        onTask={setT}
        onError={setError}
        onSubmit={submit}
      />
    )
  }

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
          {(!external || attempt) && (
            <div className="card">
              {editable && !external && (
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
              {t.tool_name === 'google_docs' && <GoogleSetup t={t} eid={eid} editable={editable} onTask={setT} onError={setError} />}
              {t.tool_name === 'companion' && <CompanionSetup t={t} eid={eid} editable={editable} onTask={setT} onError={setError} />}
            </div>
          )}
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
