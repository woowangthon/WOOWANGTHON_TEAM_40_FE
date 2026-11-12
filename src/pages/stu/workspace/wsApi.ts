// 자리 4 작업공간 API. 백엔드 app/routers/workspace.py, app/routers/onlyoffice.py 와 같은 모양이다.
import { getToken, request } from '../../../api'

export type WsFile = {
  path: string
  kind: 'code' | 'doc'
  language: '' | 'python' | 'cpp' | 'java'
  content: string
  template: boolean
  readonly: boolean
}

export type DiffLine = { type: 'ctx' | 'add' | 'del'; no: number; text: string }

export type WsCommit = {
  id: number
  version_no: number
  file: string
  title: string
  author: 'human' | 'ai' | 'paste' | 'run' | string
  trigger: string
  plus: number
  minus: number
  diff: DiffLine[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any>
  created_at: string
}

export type Proposal = {
  id: number
  message_id: number | null
  file_path: string
  start_line: number
  end_line: number
  old_text: string
  new_text: string
  reason: string
  prompt: string
  status: 'pending' | 'accepted' | 'rejected' | 'edited' | 'stale'
  created_at: string
}

export type WsMessage = {
  id: number
  role: 'student' | 'ai'
  content: string
  mode: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any>
  created_at: string
}

export type TestResult = {
  name: string
  passed: boolean
  duration?: number
  message?: string
  input?: string
  expected?: string
  actual?: string
}

export type RunResult = {
  mode: 'run' | 'test'
  language: string
  path: string
  compile_error: string | null
  tests: TestResult[]
  passed: number
  total: number
  stdout?: string
  exit_code?: number
  timed_out?: boolean
  duration?: number
  error?: string
  env?: 'default' | 'professor'
  env_os?: string
}

export type EnvView = {
  key: 'default' | 'professor'
  name: string
  os: string
  python: string
  cpp: string
  java: string
  apt: string[]
  pip: string[]
  cflags: string
  status: 'ready' | 'building' | 'failed' | 'none' | 'missing'
  required?: boolean
  log?: string
  started_at?: string | null
}

export type EnvInfo = { default: EnvView; professor: (EnvView & { required: boolean }) | null; chosen: 'default' | 'professor' | null }

export type Workspace = {
  enrollment_id: number
  stage: string
  title: string
  subject: string
  description: string
  deadline: string | null
  deadline_passed: boolean
  editable: boolean
  attempt_no: number
  attempt_status: string
  files: WsFile[]
  commits: WsCommit[]
  proposals: Proposal[]
  messages: WsMessage[]
  tests: { name: string }[]
  last_run: RunResult | null
  ai_available: boolean
  environment: EnvInfo
}

export type Selection = { start_line: number; end_line: number; text: string }
export type FileOp = { files: WsFile[]; commits: WsCommit[] }

const base = (eid: number) => `/api/enrollments/${eid}/workspace`

export const ws = {
  get: (eid: number) => request<Workspace>('GET', base(eid)),
  commit: (eid: number, body: { path: string; content: string; author?: 'human' | 'paste'; trigger: string; paste?: { chars: number; lines: number } }) =>
    request<{ committed: boolean; commit: WsCommit | null; file: WsFile }>('POST', `${base(eid)}/commit`, { body }),
  /** 창을 닫을 때 남은 변경을 보낸다. 페이지가 사라져도 요청이 끝나게 keepalive 를 쓴다 */
  commitOnUnload: (eid: number, path: string, content: string) => {
    const token = getToken()
    void fetch(`${base(eid)}/commit`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ path, content, trigger: 'unload' }),
    }).catch(() => undefined)
  },
  pasteSource: (eid: number, commitId: number, source: string | null, memo: string) =>
    request<WsCommit>('POST', `${base(eid)}/commits/${commitId}/paste-source`, { body: { source, memo } }),
  events: (eid: number, events: { kind: string; path?: string; payload?: Record<string, unknown> }[]) =>
    request<void>('POST', `${base(eid)}/events`, { body: events }),
  newFile: (eid: number, path: string) => request<WsFile>('POST', `${base(eid)}/files`, { body: { path } }),
  renameFile: (eid: number, path: string, newPath: string, folder: boolean) =>
    request<FileOp>('POST', `${base(eid)}/files/rename`, { body: { path, new_path: newPath, folder } }),
  deleteFile: (eid: number, path: string, folder: boolean) => request<FileOp>('POST', `${base(eid)}/files/delete`, { body: { path, folder } }),
  chat: (eid: number, message: string, path: string, selection: Selection | null) =>
    request<{ messages: WsMessage[]; proposal: Proposal | null }>('POST', `${base(eid)}/chat`, { body: { message, path, selection } }),
  accept: (eid: number, id: number, text?: string) =>
    request<{ proposal: Proposal; file: WsFile | null; commit: WsCommit | null }>('POST', `${base(eid)}/proposals/${id}/accept`, {
      body: text === undefined ? {} : { text },
    }),
  reject: (eid: number, id: number) => request<{ proposal: Proposal }>('POST', `${base(eid)}/proposals/${id}/reject`),
  run: (eid: number, path: string, mode: 'run' | 'test', stdin: string, env?: 'default' | 'professor') =>
    request<{ result: RunResult; commit: WsCommit }>('POST', `${base(eid)}/run`, { body: { path, mode, stdin, env } }),
  envGet: (eid: number) => request<EnvInfo>('GET', `${base(eid)}/environment`),
  envPick: (eid: number, key: 'default' | 'professor') => request<EnvInfo>('POST', `${base(eid)}/environment`, { body: { key } }),
  docConfig: (eid: number, path: string, theme: string) =>
    request<{ api_url: string; config: Record<string, unknown> }>(
      'GET',
      `${base(eid)}/doc-config?path=${encodeURIComponent(path)}&theme=${theme}`,
    ),
  docForcesave: (eid: number, path: string, trigger: string, key: string) =>
    request<{ saved: boolean; commit: WsCommit | null; note: string }>('POST', `${base(eid)}/doc-forcesave`, { body: { path, trigger, key } }),
  submit: (eid: number) => request<{ warning: string | null }>('POST', `/api/enrollments/${eid}/task/submit`),
  newAttempt: (eid: number) => request<unknown>('POST', `/api/enrollments/${eid}/task/attempts`),
}

export function clock(iso: string): string {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`)
  return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

export function commitLabel(c: Pick<WsCommit, 'version_no'>): string {
  return `c${String(c.version_no).padStart(3, '0')}`
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 수정안을 적용한 결과 전체. 서버의 replace_lines 와 같은 규칙이다 */
export function applyProposal(content: string, p: Pick<Proposal, 'start_line' | 'end_line'>, text: string): string {
  const lines = content.split('\n')
  const add = text === '' ? [] : text.split('\n')
  return [...lines.slice(0, p.start_line - 1), ...add, ...lines.slice(p.end_line)].join('\n')
}
