import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { api, formatDate, type ChatMessage, type TaskAttempt, type TaskState, type Version } from '../../api'
import Chat from '../../components/Chat'
import { AuthImage } from '../../components/Files'
import VersionList from '../../components/VersionList'
import { openPip, pipSupported, type PipHandle } from '../../pip'

// 자리 2와 자리 3의 과제 화면. 학생은 우리 페이지 밖의 도구에서 작업하므로
// 연결 전에는 연결 절차를, 연결 뒤에는 도구 화면을 흉내 내지 않고 기록 상태만 보여 준다.

const SYNC_MS = 120_000
const STRIP_MAX = 12

function toDate(value: string): Date {
  return new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
}

function clock(value: string | null | undefined): string {
  if (!value) return '없음'
  return toDate(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isToday(value: string): boolean {
  return toDate(value).toDateString() === new Date().toDateString()
}

function last<T>(items: T[]): T | undefined {
  return items[items.length - 1]
}

async function startGoogleConnect(eid: number, onError: (m: string | null) => void): Promise<void> {
  onError(null)
  try {
    const { url } = await api.stu.googleAuthUrl(eid)
    window.location.href = url
  } catch (e) {
    onError(e instanceof Error ? e.message : '연결 실패')
  }
}

interface SharedProps {
  t: TaskState
  eid: number
  editable: boolean
  onTask: (t: TaskState) => void
  onError: (m: string | null) => void
}

// 문서 주소를 받아 기록할 문서를 지정하거나 다른 문서로 바꾼다.
function DocUrlForm({ eid, editable, onTask, onError, button }: Omit<SharedProps, 't'> & { button: string }) {
  const [docUrl, setDocUrl] = useState('')
  const [working, setWorking] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function setDoc() {
    setWorking(true)
    onError(null)
    setInfo(null)
    try {
      const r = await api.stu.googleSetDoc(eid, docUrl)
      onTask(r.task)
      setInfo(`${r.task.google_doc_name || '문서'}를 연결했고 수정 이력 ${r.added}개를 버전으로 받았다.`)
      setDocUrl('')
    } catch (e) {
      onError(e instanceof Error ? e.message : '문서 지정 실패')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <div className="row">
        <input
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/문서ID/edit"
          style={{ flex: 1 }}
          disabled={!editable || working}
        />
        <button className="btn btn-sm" onClick={() => void setDoc()} disabled={!editable || working || !docUrl.trim()}>
          {button}
        </button>
      </div>
      {info && <p className="small ok" style={{ marginTop: 6 }}>{info}</p>}
    </>
  )
}

// 보조 경로. 도구에서 내려받은 파일을 직접 올려 버전으로 남긴다.
function ManualUpload({ eid, editable, onTask, onError, source, label }: Omit<SharedProps, 't'> & { source: string; label: string }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(0)

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    onError(null)
    try {
      onTask(await api.stu.saveFileVersion(eid, file, reason.trim(), source))
      setReason('')
      setRound((n) => n + 1)
    } catch (e) {
      onError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field" style={{ marginTop: 10 }}>
      <label>{label}</label>
      <div className="row">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="이 파일의 변경 이유 한 줄, 적어야 파일을 고를 수 있다"
          maxLength={500}
          style={{ flex: 1 }}
          disabled={!editable || busy}
        />
        <input
          key={round}
          type="file"
          onChange={(e) => void upload(e.target.files?.[0])}
          disabled={!editable || busy || !reason.trim()}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  )
}

// 자리 2의 연결 전 화면. 계정을 연결하고 문서를 지정하면 기록 상태 화면으로 넘어간다.
export function GoogleSetup({ t, eid, editable, onTask, onError }: SharedProps) {
  const [working, setWorking] = useState(false)
  return (
    <div>
      <h3>Google 문서에서 작업 시작하기</h3>
      <p className="small">
        Google 계정을 연결하고 문서 주소를 지정하면 이 화면이 기록 상태 화면으로 바뀌고, 서버가 Google Drive API로 문서의 수정 이력을 받아
        버전으로 저장한다.
      </p>
      <div className="field">
        <label>1. Google 계정 연결</label>
        <div className="row">
          <span className={`chip ${t.google_connected ? 'chip-ok' : ''}`}>
            {t.google_connected ? `연결됨 ${t.google_account}` : '연결 안 됨'}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setWorking(true)
              void startGoogleConnect(eid, onError).finally(() => setWorking(false))
            }}
            disabled={!editable || working}
          >
            {t.google_connected ? '다른 계정으로 다시 연결' : 'Google 계정 연결'}
          </button>
        </div>
      </div>
      <div className="field">
        <label>2. 작업할 문서의 주소 지정, 연결한 계정이 소유자이거나 편집자인 문서여야 한다</label>
        <DocUrlForm eid={eid} editable={editable && t.google_connected} onTask={onTask} onError={onError} button="문서 지정" />
      </div>
      <ManualUpload
        eid={eid}
        editable={editable}
        onTask={onTask}
        onError={onError}
        source="google"
        label="보조 경로, 문서를 파일로 내려받아 올리면 버전이 남는다"
      />
    </div>
  )
}

// 자리 3의 연결 절차. 보조 프로그램이 서버에 접속하면 기록 상태 화면으로 넘어간다.
export function CompanionSetup({ t, eid, editable, onTask, onError, upload = true }: SharedProps & { upload?: boolean }) {
  const [token, setToken] = useState<string | null>(null)
  const cfg = t.tool_config as { program?: string; extensions?: string }

  async function issue() {
    onError(null)
    try {
      setToken((await api.stu.companionToken(eid)).token)
    } catch (e) {
      onError(e instanceof Error ? e.message : '토큰 발급 실패')
    }
  }

  return (
    <div>
      <h3>{cfg.program ?? '설치된 프로그램'}과 보조 프로그램</h3>
      <p className="small">
        보조 프로그램이 {cfg.program ?? '프로그램'} 창을 캡처하고 저장 폴더에 {cfg.extensions ?? '결과물'} 파일이 저장될 때마다 버전을 올리며 학습
        AI 창을 항상 위에 띄운다. 보조 프로그램이 서버에 접속하면 이 화면이 기록 상태 화면으로 바뀐다.
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
        <span className={`chip ${t.companion_live ? 'chip-ok' : ''}`}>
          {t.companion_live ? '보조 프로그램 접속 중' : t.companion_connected ? '토큰 발급됨, 프로그램 접속 대기' : '연결 안 됨'}
        </span>
      </div>
      {token && (
        <div className="banner info" style={{ marginTop: 8 }}>
          <code style={{ userSelect: 'all' }}>{token}</code>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            이 토큰은 이 과제의 기록에만 쓰인다. 다른 사람에게 주지 않는다.
          </p>
        </div>
      )}
      {upload && (
        <ManualUpload
          eid={eid}
          editable={editable}
          onTask={onTask}
          onError={onError}
          source="companion"
          label="직접 파일 올리기, 보조 프로그램을 쓸 수 없을 때"
        />
      )}
    </div>
  )
}

function StatusCard({ on, title, children }: { on: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="status-card">
      <strong className="small">
        <span className={`dot ${on ? 'on' : ''}`} />
        {title}
      </strong>
      <p className="small" style={{ margin: '4px 0 0' }}>
        {children}
      </p>
    </div>
  )
}

// 시간 순으로 스냅샷과 저장 버전을 한 줄에 놓는다. 저장 버전은 파란 테두리로 구분한다.
function RecordStrip({ versions, filePath, captures }: { versions: Version[]; filePath: (vid: number) => string; captures: boolean }) {
  const today = versions.filter((v) => isToday(v.created_at))
  const pool = today.length > 0 ? today : versions
  const shown = pool.slice(-STRIP_MAX)
  const hidden = versions.length - shown.length
  return (
    <div className="card">
      <div className="card-title">
        <h3 style={{ margin: 0 }}>{today.length > 0 ? '오늘의 기록' : '최근 기록'}</h3>
        <span className="muted small">
          {captures ? '파란 테두리는 저장 버전이고 나머지는 자동 창 캡처다' : '칸 하나가 Google에서 받은 수정 이력 하나다'}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="muted small">아직 기록이 없다. 도구에서 작업하고 저장하면 여기에 쌓인다.</p>
      ) : (
        <div className="rec-strip">
          {shown.map((v) => {
            const snapshot = Boolean(v.meta?.snapshot)
            const ext = v.file_name.includes('.') ? v.file_name.split('.').pop()?.toUpperCase() : ''
            return (
              <div className={`rec-tile ${snapshot ? '' : 'saved'}`} key={v.id} title={v.reason}>
                <div className="rec-body">
                  {v.kind === 'image' && v.has_file ? (
                    <AuthImage path={filePath(v.id)} alt={`버전 ${v.version_no}`} />
                  ) : v.text_content ? (
                    <span className="rec-text">{v.text_content.slice(0, 90)}</span>
                  ) : (
                    <span className="muted small">{ext || '본문 없음'}</span>
                  )}
                </div>
                <div className="rec-foot">
                  {clock(v.created_at)}
                  {!snapshot && ` 버전 ${v.version_no}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        {captures
          ? '저장 버전끼리는 텍스트와 이미지로 비교하고, 자동 창 캡처는 그 사이의 과정을 보여 준다.'
          : '버전은 같은 문서의 직전 버전과 텍스트로 비교한다.'}
        {hidden > 0 && ` 앞선 기록 ${hidden}개는 아래 전체 버전 목록에 있다.`}
      </p>
    </div>
  )
}

// 문서를 바꿔 가며 작업했으면 버전을 문서별로 나누어 보여 준다.
function VersionsByDoc({ versions, filePath }: { versions: Version[]; filePath: (vid: number) => string }) {
  const groups: { id: string; name: string; versions: Version[] }[] = []
  for (const v of versions) {
    const id = typeof v.meta?.doc_id === 'string' ? v.meta.doc_id : ''
    const name = typeof v.meta?.doc_name === 'string' ? v.meta.doc_name : ''
    let g = groups.find((x) => x.id === id)
    if (!g) {
      g = { id, name, versions: [] }
      groups.push(g)
    }
    if (name) g.name = name
    g.versions.push(v)
  }
  if (groups.length <= 1) return <VersionList versions={versions} filePath={filePath} compact />
  return (
    <>
      {groups.map((g) => (
        <div key={g.id || 'upload'} style={{ marginBottom: 12 }}>
          <p className="small" style={{ margin: '0 0 6px' }}>
            <strong>{g.id ? g.name || '이름을 받지 못한 문서' : '직접 올린 파일'}</strong> · 버전 {g.versions.length}개
            {g.id && (
              <>
                {' · '}
                <a href={`https://docs.google.com/document/d/${g.id}/edit`} target="_blank" rel="noreferrer">
                  문서 열기
                </a>
              </>
            )}
          </p>
          <VersionList versions={g.versions} filePath={filePath} compact />
        </div>
      ))}
    </>
  )
}

interface WorkProps extends SharedProps {
  attempt: TaskAttempt
  busy: boolean
  error: string | null
  chat: { messages: ChatMessage[]; onSend: (m: string) => Promise<void>; rules: string[]; disabledReason: string }
  onSubmit: () => Promise<void>
}

// 연결 뒤의 화면. 외부 도구에서 작업 중이라는 것과 기록 상태만 보여 준다.
export default function ExternalWork({ t, eid, attempt, editable, busy, error, chat, onTask, onError, onSubmit }: WorkProps) {
  const isGoogle = t.tool_name === 'google_docs'
  const cfg = t.tool_config as { program?: string; extensions?: string }
  const program = isGoogle ? 'Google 문서' : (cfg.program ?? '설치된 프로그램')
  const versions = attempt.versions
  const snapshots = versions.filter((v) => v.meta?.snapshot)
  const saves = versions.filter((v) => !v.meta?.snapshot)
  const questions = chat.messages.filter((m) => m.role === 'student').length
  const live = editable && (isGoogle || t.companion_live)
  const filePath = (vid: number) => api.stu.versionFilePath(eid, vid)
  const docCount = new Set(versions.map((v) => v.meta?.doc_id).filter(Boolean)).size

  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [pip, setPip] = useState<PipHandle | null>(null)

  // 자리 2는 이 페이지가 열려 있는 동안 2분마다 수정 이력을 받는다
  useEffect(() => {
    if (!isGoogle || !editable) return
    const timer = setInterval(() => {
      api.stu
        .googleSync(eid)
        .then((r) => {
          onTask(r.task)
          if (r.added > 0) setInfo(`수정 이력 ${r.added}개를 새 버전으로 받았다.`)
        })
        .catch(() => undefined)
    }, SYNC_MS)
    return () => clearInterval(timer)
  }, [isGoogle, editable, eid, onTask])

  useEffect(() => {
    if (!pip) return
    const close = () => setPip(null)
    pip.win.addEventListener('pagehide', close)
    return () => {
      pip.win.removeEventListener('pagehide', close)
      pip.win.close()
    }
  }, [pip])

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

  const lastSave = last(saves)
  const lastSnapshot = last(snapshots)
  const iconLabel = isGoogle ? 'DOCS' : (cfg.extensions ?? '').split(',')[0].replace('.', '').trim().toUpperCase() || 'FILE'

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 6 }}>
        <div className="row">
          <h2 style={{ margin: 0 }}>과제</h2>
          <span className="chip chip-primary">
            시도 {attempt.attempt_no} 진행 중 · 버전 {versions.length}개
          </span>
        </div>
        <span className="muted small">마감 {formatDate(t.deadline)}</span>
      </div>
      <p className="muted small">
        {program}에서 작업하는 동안 이 페이지는 도구 화면을 흉내 내지 않고 기록 상태만 보여 준다.
      </p>
      <details className="fold">
        <summary>과제 문제 보기</summary>
        <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{t.description || '교수가 과제 설명을 쓰지 않았다.'}</p>
      </details>
      {error && <p className="error small">{error}</p>}

      <div className="grid-side">
        <div>
          <div className="card work-hero">
            <div className={`work-icon ${isGoogle ? 'google' : ''}`}>{iconLabel}</div>
            <div style={{ flex: 1 }}>
              <div className="row">
                <h2 style={{ margin: 0 }}>{isGoogle ? '외부 도구에서 작업 중' : '외부 프로그램에서 작업 중'}</h2>
                <span className={`chip ${live ? 'chip-rec' : 'chip-warn'}`}>
                  {live ? '기록 중' : !editable ? '기록 종료' : '기록 멈춤'}
                </span>
              </div>
              <p className="small" style={{ margin: '6px 0 4px' }}>
                {isGoogle
                  ? `Google 문서 · ${t.google_doc_name || '이름을 받지 못한 문서'} · 계정 ${t.google_account || '연결됨'} · 학습 AI 창은 문서 탭 위에 띄운다`
                  : `${program} · ${lastSave?.file_name || '아직 저장된 파일 없음'} · 보조 프로그램 ${t.companion_live ? '접속 중' : '응답 없음'} · 학습 AI 창은 보조 프로그램이 항상 위에 띄운다`}
              </p>
              <p className="muted small" style={{ margin: 0 }}>
                {isGoogle
                  ? '이 페이지를 닫으면 동기화가 멈추고, 다시 열면 Google이 보관한 수정 이력을 이어서 받는다. 작업을 마치면 아래 기록이 결과물 변경 이력의 비교 재료가 된다.'
                  : '이 페이지를 닫아도 기록은 보조 프로그램이 계속한다. 작업을 마치면 아래 기록이 결과물 변경 이력의 비교 재료가 된다.'}
              </p>
            </div>
          </div>

          {!isGoogle && editable && !t.companion_live && (
            <div className="banner">
              보조 프로그램이 응답하지 않는다. 마지막 접속은 {formatDate(t.companion_last_seen)}이다. 프로그램이 꺼졌으면 다시 실행해야 창 캡처와
              폴더 감시가 이어진다.
            </div>
          )}

          <div className="status-grid">
            {isGoogle ? (
              <>
                <StatusCard on={live} title="수정 이력 동기화">
                  수정 이력 {saves.filter((v) => v.meta?.revision_id).length}개 · 마지막 동기화 {clock(t.google_last_synced_at)} · 2분마다 받는다
                </StatusCard>
                <StatusCard on={live} title="기록하는 문서">
                  {t.google_doc_name || '이름을 받지 못한 문서'}
                  {docCount > 1 && ` · 이 시도에서 문서 ${docCount}개를 거쳤다`}
                </StatusCard>
              </>
            ) : (
              <>
                <StatusCard on={live} title="창 캡처">
                  {program} 창 · 스냅샷 {snapshots.length}장 · 마지막 {clock(lastSnapshot?.created_at)}
                </StatusCard>
                <StatusCard on={live} title="저장 폴더 감시">
                  저장 {saves.length}회 · 마지막 {clock(lastSave?.created_at)} · 텍스트 추출 {saves.filter((v) => v.text_content).length}개
                </StatusCard>
              </>
            )}
            <StatusCard on={editable} title="학습 AI 대화">
              질문 {questions}개 · 이번 시도의 대화로 모두 저장된다
            </StatusCard>
          </div>

          <RecordStrip versions={versions} filePath={filePath} captures={!isGoogle} />
          {info && <p className="small ok">{info}</p>}

          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
            {confirming ? (
              <>
                <span className="small">
                  {t.stage === 'task'
                    ? '제출하면 사후평가로 넘어가고, 마감 전에는 다시 들어와 3단계만 수행해 재제출할 수 있다.'
                    : '이 시도를 제출한다.'}
                </span>
                <button className="btn" onClick={() => void onSubmit()} disabled={busy}>
                  제출 확정
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  취소
                </button>
              </>
            ) : (
              <>
                {isGoogle && (
                  <>
                    <a className="btn btn-secondary" href={`https://docs.google.com/document/d/${t.google_doc_id}/edit`} target="_blank" rel="noreferrer">
                      문서 열기
                    </a>
                    <button className="btn btn-secondary" onClick={() => void sync()} disabled={!editable || working}>
                      지금 동기화
                    </button>
                    <button className="btn btn-secondary" onClick={() => void popout()}>
                      {pip ? 'AI 창 닫기' : '문서 탭 위에 AI 창 띄우기'}
                    </button>
                  </>
                )}
                <button className="btn" onClick={() => setConfirming(true)} disabled={busy || !editable || versions.length === 0}>
                  작업 마치고 제출
                </button>
              </>
            )}
          </div>

          <details className="fold">
            <summary>{isGoogle ? '문서 바꾸기와 연결 설정' : '보조 프로그램 연결 다시 하기'}</summary>
            <div style={{ marginTop: 10 }}>
              {isGoogle ? (
                <>
                  <div className="field">
                    <label>
                      다른 문서로 바꾸기. 바꾼 뒤에는 새 문서의 수정 이력을 받고, 앞 문서에서 받은 버전은 그대로 남아 문서별로 나뉘어 기록된다
                    </label>
                    <DocUrlForm eid={eid} editable={editable} onTask={onTask} onError={onError} button="이 문서로 바꾸기" />
                  </div>
                  <div className="row">
                    <span className="chip chip-ok">연결한 계정 {t.google_account || '확인 전'}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => void startGoogleConnect(eid, onError)} disabled={!editable}>
                      다른 계정으로 다시 연결
                    </button>
                  </div>
                  <ManualUpload
                    eid={eid}
                    editable={editable}
                    onTask={onTask}
                    onError={onError}
                    source="google"
                    label="보조 경로, 문서를 파일로 내려받아 올리면 버전이 남는다"
                  />
                </>
              ) : (
                <CompanionSetup t={t} eid={eid} editable={editable} onTask={onTask} onError={onError} />
              )}
            </div>
          </details>

          <details className="fold">
            <summary>전체 버전 목록, {versions.length}개</summary>
            <div style={{ marginTop: 10 }}>
              <VersionsByDoc versions={versions} filePath={filePath} />
            </div>
          </details>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>학습 AI</h3>
            <span className="muted small">떠 있는 창과 같은 대화</span>
          </div>
          <Chat messages={chat.messages} onSend={chat.onSend} rules={chat.rules} disabled={!editable} disabledReason={chat.disabledReason} />
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            떠 있는 창에서 한 대화가 여기에도 그대로 보인다. 어느 쪽에서 써도 같은 기록이다.
          </p>
        </div>
      </div>

      {pip &&
        createPortal(
          <div className="card" style={{ padding: 8, margin: 0 }}>
            <Chat
              title="학습 AI, 과제 단계"
              messages={chat.messages}
              onSend={chat.onSend}
              rules={chat.rules}
              disabled={!editable}
              disabledReason={chat.disabledReason}
            />
          </div>,
          pip.container,
        )}
    </div>
  )
}
