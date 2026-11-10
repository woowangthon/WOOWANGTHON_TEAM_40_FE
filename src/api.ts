// 백엔드 API 호출. 타입은 backend/app/schemas.py 와 맞춘다.

export type Role = 'professor' | 'student'
export type Stage = 'pre' | 'learning' | 'task' | 'post' | 'done'
export type Phase = 'pre' | 'post'
export type ItemType = 'choice' | 'short' | 'fill' | 'essay_short' | 'essay_long'
export type RuleTarget = 'ai' | 'student' | 'both'

export interface User {
  id: number
  email: string
  name: string
  role: Role
}

export interface Competency {
  id: number
  order: number
  name: string
  description: string
  pass_score: number
  grading_criteria: string
}

export interface CompetencyInput {
  id?: number
  name: string
  description: string
  pass_score: number
  grading_criteria: string
}

export interface Item {
  id: number
  competency_id: number
  phase: Phase
  order: number
  type: ItemType
  stem: string
  options: string[]
  answer: string
}

export interface ItemInput {
  competency_id: number
  type: ItemType
  stem: string
  options: string[]
  answer: string
}

export interface ItemPublic {
  id: number
  competency_id: number
  type: ItemType
  stem: string
  options: string[]
}

export interface Material {
  id: number
  filename: string
  mime: string
  size: number
  has_text: boolean
  created_at: string
}

export interface Rule {
  id: number
  target: RuleTarget
  text: string
}

export interface AssignmentBrief {
  id: number
  title: string
  subject: string
  deadline: string | null
  join_code: string
  status: 'draft' | 'open' | 'closed'
  task_kind: 'performance' | 'essay'
  tool_slot: number
  tool_name: string
  created_at: string
  enrollment_count: number
}

export interface Assignment extends AssignmentBrief {
  description: string
  attachment_name: string
  tool_config: Record<string, unknown>
  pre_time_limit_min: number
  post_time_limit_min: number
  competencies: Competency[]
  items: Item[]
  materials: Material[]
  rules: Rule[]
}

export interface AssignmentStudentView {
  id: number
  title: string
  subject: string
  description: string
  attachment_name: string
  deadline: string | null
  status: string
  task_kind: string
  tool_slot: number
  tool_name: string
  tool_config: Record<string, unknown>
  pre_time_limit_min: number
  post_time_limit_min: number
  competencies: { id: number; name: string; description: string; pass_score: number }[]
  student_rules: string[]
  material_names: string[]
  professor_name: string
}

export interface CompetencyState {
  competency_id: number
  name: string
  pass_score: number
  pre_score: number | null
  current_score: number | null
  post_score: number | null
  passed: boolean
}

export interface Version {
  id: number
  version_no: number
  source: string
  kind: 'text' | 'image' | 'file'
  text_content: string | null
  file_name: string
  has_file: boolean
  reason: string
  meta: Record<string, unknown>
  created_at: string
}

export interface TaskAttempt {
  id: number
  attempt_no: number
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  versions: Version[]
}

export interface Enrollment {
  id: number
  assignment_id: number
  stage: Stage
  joined_at: string
  deadline_passed: boolean
  assignment: AssignmentStudentView
  states: CompetencyState[]
  attempts: TaskAttempt[]
}

export interface EnrollmentBrief {
  id: number
  assignment_id: number
  stage: Stage
  joined_at: string
  deadline_passed: boolean
  title: string
  subject: string
  professor_name: string
  deadline: string | null
  tool_slot: number
  tool_name: string
}

export interface TestStart {
  attempt_id: number
  phase: Phase
  started_at: string
  time_limit_min: number
  items: ItemPublic[]
}

export interface TestAnswer {
  id: number
  item_id: number
  competency_id: number
  type: ItemType
  stem: string
  options: string[]
  answer_text: string
  score: number | null
  feedback: string
  rationale: string
  graded_by: string
  expected_answer: string | null
}

export interface TestResult {
  attempt_id: number
  phase: Phase
  started_at: string
  submitted_at: string | null
  total_score: number | null
  competency_scores: Record<string, number>
  answers: TestAnswer[]
  stage: Stage
}

export interface ChatMessage {
  id: number
  stage: 'learning' | 'task'
  attempt_no: number
  role: 'student' | 'ai'
  content: string
  mode: string
  question_kind: string
  meta: Record<string, unknown>
  created_at: string
}

export interface LearningCheck {
  id: number
  competency_id: number
  item: { type?: ItemType; stem?: string; options?: string[]; answer?: string }
  answer_text: string | null
  score: number | null
  feedback: string
  created_at: string
  answered_at: string | null
}

export interface LearningState {
  enrollment_id: number
  stage: Stage
  states: CompetencyState[]
  messages: ChatMessage[]
  checks: LearningCheck[]
  can_finish: boolean
  student_rules: string[]
}

export interface TaskState {
  enrollment_id: number
  stage: Stage
  deadline: string | null
  deadline_passed: boolean
  can_start_new_attempt: boolean
  attempt: TaskAttempt | null
  attempts: TaskAttempt[]
  messages: ChatMessage[]
  tool_slot: number
  tool_name: string
  tool_config: Record<string, unknown>
  task_kind: string
  description: string
  attachment_name: string
  student_rules: string[]
  companion_connected: boolean
  companion_last_seen: string | null
  companion_live: boolean
  google_connected: boolean
  google_account: string
  google_doc_id: string
  google_doc_name: string
  google_last_synced_at: string | null
}

export interface SubmitResult {
  task: TaskState
  warning: string | null
}

export interface GoogleSync {
  task: TaskState
  added: number
  doc_id: string
}

export interface Summary {
  id: number
  kind: 'learning' | 'task'
  attempt_no: number
  content: {
    spec_summary?: string
    learned_summary?: string
    ai_usage_line?: string
    competencies?: { competency_name: string; status: string; line: string }[]
  }
  created_at: string
}

export interface Signal {
  id: number
  attempt_no: number
  kind: string
  description: string
  evidence: { text?: string }
  created_at: string
}

export interface Grade {
  score: number | null
  comment: string
  updated_at: string
}

export interface OverviewRow {
  enrollment_id: number
  student_name: string
  student_email: string
  stage: Stage
  pre_score: number | null
  post_score: number | null
  passed_count: number
  competency_count: number
  attempt_count: number
  version_count: number
  signal_count: number
  grade_score: number | null
  last_submitted_at: string | null
}

export interface Overview {
  assignment: AssignmentBrief
  stage_counts: Record<string, number>
  rows: OverviewRow[]
}

export interface DashboardRow extends AssignmentBrief {
  stage_counts: Record<string, number>
  submitted_count: number
  ungraded_count: number
  signal_count: number
}

export interface Dashboard {
  assignment_count: number
  open_count: number
  student_count: number
  ungraded_count: number
  signal_count: number
  rows: DashboardRow[]
}

export interface StudentDetail {
  enrollment_id: number
  student: User
  stage: Stage
  joined_at: string
  states: CompetencyState[]
  pre: TestResult | null
  post: TestResult | null
  checks: LearningCheck[]
  summaries: Summary[]
  attempts: TaskAttempt[]
  messages: ChatMessage[]
  signals: Signal[]
  grade: Grade | null
}

export interface CompanionMe {
  enrollment_id: number
  student_name: string
  assignment_title: string
  tool_config: Record<string, unknown>
  attempt_no: number | null
  deadline: string | null
  deadline_passed: boolean
  consent_text: string
  snapshot_seconds: number
  ai_panel_path: string
}

const TOKEN_KEY = 'woowang_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장소를 못 쓰는 환경이면 메모리만 쓴다
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  body?: unknown
  form?: FormData
  companionToken?: string
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (opts.companionToken) headers['X-Companion-Token'] = opts.companionToken
  else if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(path, { method, headers, body })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (res.status === 401 && token && !opts.companionToken && !path.startsWith('/api/auth/')) {
    // 토큰이 만료되었거나 무효다. 로그인 화면으로 보내고 그 이유를 남긴다.
    setToken(null)
    try {
      sessionStorage.setItem('woowang_expired', '1')
    } catch {
      // 저장소를 못 쓰면 안내만 생략한다
    }
    window.dispatchEvent(new Event('woowang-auth-expired'))
  }
  if (!res.ok) {
    let detail = `요청 실패 (${res.status})`
    if (data && typeof data === 'object' && 'detail' in data) {
      const d = (data as { detail: unknown }).detail
      detail = typeof d === 'string' ? d : JSON.stringify(d)
    }
    throw new ApiError(res.status, detail)
  }
  return data as T
}

export async function fetchBlobUrl(path: string, companionToken?: string): Promise<string> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (companionToken) headers['X-Companion-Token'] = companionToken
  else if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { headers })
  if (!res.ok) throw new ApiError(res.status, '파일을 불러오지 못했다')
  return URL.createObjectURL(await res.blob())
}

export const api = {
  health: () => request<{ ok: boolean; ai_available: boolean; model: string }>('GET', '/api/health'),
  auth: {
    signup: (body: { email: string; password: string; name: string; role: Role }) =>
      request<{ token: string; user: User }>('POST', '/api/auth/signup', { body }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: User }>('POST', '/api/auth/login', { body }),
    me: () => request<User>('GET', '/api/auth/me'),
  },
  prof: {
    list: () => request<AssignmentBrief[]>('GET', '/api/assignments'),
    dashboard: () => request<Dashboard>('GET', '/api/assignments/dashboard'),
    create: (body: Partial<Assignment> & { title: string }) =>
      request<Assignment>('POST', '/api/assignments', { body }),
    get: (id: number) => request<Assignment>('GET', `/api/assignments/${id}`),
    update: (id: number, body: Record<string, unknown>) =>
      request<Assignment>('PATCH', `/api/assignments/${id}`, { body }),
    setCompetencies: (id: number, body: CompetencyInput[]) =>
      request<Competency[]>('PUT', `/api/assignments/${id}/competencies`, { body }),
    draftCompetencies: (id: number, hint: string) =>
      request<{ competencies: CompetencyInput[] }>('POST', `/api/assignments/${id}/competencies/draft`, {
        body: { hint },
      }),
    setItems: (id: number, phase: Phase, body: ItemInput[]) =>
      request<Item[]>('PUT', `/api/assignments/${id}/items?phase=${phase}`, { body }),
    draftItems: (id: number, phase: Phase) =>
      request<{ items: ItemInput[] }>('POST', `/api/assignments/${id}/items/draft`, { body: { phase } }),
    uploadMaterial: (id: number, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<Material>('POST', `/api/assignments/${id}/materials`, { form })
    },
    deleteMaterial: (id: number, mid: number) =>
      request<void>('DELETE', `/api/assignments/${id}/materials/${mid}`),
    uploadAttachment: (id: number, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return request<Assignment>('POST', `/api/assignments/${id}/attachment`, { form })
    },
    setRules: (id: number, body: { target: RuleTarget; text: string }[]) =>
      request<Rule[]>('PUT', `/api/assignments/${id}/rules`, { body }),
    publish: (id: number) => request<Assignment>('POST', `/api/assignments/${id}/publish`),
    publishCheck: (id: number) =>
      request<{ ok: boolean; problems: string[]; status: string; join_code: string }>('GET', `/api/assignments/${id}/publish-check`),
    overview: (id: number) => request<Overview>('GET', `/api/assignments/${id}/overview`),
    student: (id: number, eid: number) => request<StudentDetail>('GET', `/api/assignments/${id}/students/${eid}`),
    setGrade: (id: number, eid: number, body: { score: number | null; comment: string }) =>
      request<Grade>('PUT', `/api/assignments/${id}/students/${eid}/grade`, { body }),
    overrideAnswer: (id: number, answerId: number, body: { score: number; feedback: string }) =>
      request<StudentDetail>('PATCH', `/api/assignments/${id}/answers/${answerId}`, { body }),
    versionFilePath: (id: number, eid: number, vid: number) =>
      `/api/assignments/${id}/students/${eid}/versions/${vid}/file`,
  },
  stu: {
    join: (code: string) => request<Enrollment>('POST', '/api/enrollments/join', { body: { code } }),
    list: () => request<EnrollmentBrief[]>('GET', '/api/enrollments'),
    get: (eid: number) => request<Enrollment>('GET', `/api/enrollments/${eid}`),
    attachmentPath: (eid: number) => `/api/enrollments/${eid}/attachment`,
    materialPath: (eid: number, mid: number) => `/api/enrollments/${eid}/materials/${mid}/file`,
    testStart: (eid: number, phase: Phase) =>
      request<TestStart>('POST', `/api/enrollments/${eid}/tests/${phase}/start`),
    testSubmit: (eid: number, phase: Phase, answers: { item_id: number; answer: string }[]) =>
      request<TestResult>('POST', `/api/enrollments/${eid}/tests/${phase}/submit`, { body: { answers } }),
    testResult: (eid: number, phase: Phase) =>
      request<TestResult>('GET', `/api/enrollments/${eid}/tests/${phase}`),
    learning: (eid: number) => request<LearningState>('GET', `/api/enrollments/${eid}/learning`),
    learningChat: (eid: number, message: string) =>
      request<ChatMessage[]>('POST', `/api/enrollments/${eid}/learning/chat`, { body: { message } }),
    newCheck: (eid: number, cid: number) =>
      request<LearningCheck>('POST', `/api/enrollments/${eid}/learning/check/${cid}`),
    answerCheck: (eid: number, checkId: number, answer: string) =>
      request<LearningState>('POST', `/api/enrollments/${eid}/learning/check/${checkId}/answer`, {
        body: { answer },
      }),
    finishLearning: (eid: number) => request<LearningState>('POST', `/api/enrollments/${eid}/learning/finish`),
    task: (eid: number) => request<TaskState>('GET', `/api/enrollments/${eid}/task`),
    newAttempt: (eid: number) => request<TaskState>('POST', `/api/enrollments/${eid}/task/attempts`),
    saveVersion: (
      eid: number,
      body: { text_content: string; reason: string; source: string; meta?: Record<string, unknown> },
    ) => request<TaskState>('POST', `/api/enrollments/${eid}/task/versions`, { body }),
    saveFileVersion: (eid: number, file: File, reason: string, source: string) => {
      const form = new FormData()
      form.append('file', file)
      form.append('reason', reason)
      form.append('source', source)
      return request<TaskState>('POST', `/api/enrollments/${eid}/task/versions/file`, { form })
    },
    versionFilePath: (eid: number, vid: number) => `/api/enrollments/${eid}/task/versions/${vid}/file`,
    taskChat: (eid: number, message: string) =>
      request<ChatMessage[]>('POST', `/api/enrollments/${eid}/task/chat`, { body: { message } }),
    submit: (eid: number) => request<SubmitResult>('POST', `/api/enrollments/${eid}/task/submit`),
    companionToken: (eid: number) =>
      request<{ token: string }>('POST', `/api/enrollments/${eid}/companion/token`),
    googleAuthUrl: (eid: number) => request<{ url: string }>('GET', `/api/enrollments/${eid}/google/auth-url`),
    googleSetDoc: (eid: number, doc_url: string) =>
      request<GoogleSync>('POST', `/api/enrollments/${eid}/google/doc`, { body: { doc_url } }),
    googleSync: (eid: number) => request<GoogleSync>('POST', `/api/enrollments/${eid}/google/sync`),
    googleDisconnect: (eid: number) => request<TaskState>('DELETE', `/api/enrollments/${eid}/google`),
  },
  companion: {
    me: (token: string) => request<CompanionMe>('GET', '/api/companion/me', { companionToken: token }),
    messages: (token: string) =>
      request<ChatMessage[]>('GET', '/api/companion/messages', { companionToken: token }),
    chat: (token: string, message: string) =>
      request<ChatMessage[]>('POST', '/api/companion/chat', { body: { message }, companionToken: token }),
    task: (token: string) => request<TaskState>('GET', '/api/companion/task', { companionToken: token }),
  },
}

export const STAGE_LABEL: Record<Stage, string> = {
  pre: '사전평가',
  learning: '학습',
  task: '과제',
  post: '사후평가',
  done: '완료',
}

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  choice: '선택형',
  short: '단답형',
  fill: '완성형',
  essay_short: '서술형',
  essay_long: '논술형',
}

export const MODE_LABEL: Record<string, string> = {
  direct: '직접 답',
  interrogative: '되묻기',
  refuse: '거절',
}

export const TOOL_LABEL: Record<string, string> = {
  editor: '페이지 안 문서 편집기',
  sql: 'Monaco 편집기와 sql.js',
  google_docs: 'Google 문서',
  companion: '설치형 프로그램과 보조 프로그램',
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
