import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { api, formatDate, type Enrollment, type Stage } from '../../api'
import { DownloadButton } from '../../components/Files'
import LearningStage from './LearningStage'
import TaskStage from './TaskStage'
import TestStage from './TestStage'

const ORDER: { key: Stage; label: string }[] = [
  { key: 'pre', label: '1 사전평가' },
  { key: 'learning', label: '2 학습' },
  { key: 'task', label: '3 과제' },
  { key: 'post', label: '4 사후평가' },
]

export default function EnrollmentPage() {
  const { eid } = useParams()
  const enrollmentId = Number(eid)
  const [e, setE] = useState<Enrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'task' | 'post' | null>(null)
  // 시험을 제출한 직후에는 단계가 바뀌어도 결과 화면을 유지한다
  const [hold, setHold] = useState<Stage | null>(null)
  const [params, setParams] = useSearchParams()
  const googleParam = params.get('google')
  const [notice, setNotice] = useState<string | null>(
    googleParam === 'connected'
      ? 'Google 계정을 연결했다. 과제 단계에서 문서 주소를 지정한다.'
      : googleParam === 'denied'
        ? 'Google 계정 연결을 취소했다.'
        : googleParam === 'failed'
          ? 'Google 계정 연결에 실패했다. 다시 시도한다.'
          : null,
  )
  useEffect(() => {
    if (googleParam) setParams({}, { replace: true })
  }, [googleParam, setParams])
  const changed = (text?: string) => {
    if (text) setNotice(text)
    void reload()
  }

  const reload = useCallback(
    () => api.stu.get(enrollmentId).then(setE).catch((err: Error) => setError(err.message)),
    [enrollmentId],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!e) return <p className="muted">불러오는 중</p>

  const a = e.assignment
  const current: Stage | 'done' = hold ?? e.stage
  const idx = ORDER.findIndex((s) => s.key === current)
  const doneView = current === 'done' ? (view ?? 'task') : null
  const leaveHold = () => {
    setHold(null)
    void reload()
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h1>{a.title}</h1>
          <p className="muted small">
            {a.subject} · {a.professor_name} 교수 · 마감 {formatDate(a.deadline)}
            {e.deadline_passed && <span className="chip chip-bad" style={{ marginLeft: 6 }}>마감 지남</span>}
          </p>
        </div>
        <div className="row">
          {a.attachment_name && <DownloadButton path={api.stu.attachmentPath(e.id)} filename={a.attachment_name} label="과제 첨부 파일" />}
          <Link className="btn btn-ghost" to="/stu">
            목록
          </Link>
        </div>
      </div>

      <div className="stages">
        {ORDER.map((s, i) => (
          <div key={s.key} className={`stage ${current === s.key ? 'current' : current === 'done' || i < idx ? 'done' : ''}`}>
            {s.label}
          </div>
        ))}
        <div className={`stage ${current === 'done' ? 'current' : ''}`}>완료, 재제출 가능</div>
      </div>

      {notice && (
        <div className="banner row" style={{ justifyContent: 'space-between' }}>
          <span>{notice}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}>
            닫기
          </button>
        </div>
      )}

      {current === 'done' && (
        <div className="section-nav">
          <button className={doneView === 'task' ? 'active' : ''} onClick={() => setView('task')}>
            과제 결과물과 재제출
          </button>
          <button className={doneView === 'post' ? 'active' : ''} onClick={() => setView('post')}>
            사후평가 결과
          </button>
        </div>
      )}

      {current === 'pre' && (
        <TestStage enrollment={e} phase="pre" onSubmitted={() => { setHold('pre'); void reload() }} onDone={leaveHold} />
      )}
      {current === 'learning' && <LearningStage enrollment={e} onDone={reload} />}
      {current === 'task' && <TaskStage enrollment={e} onChanged={changed} />}
      {current === 'post' && (
        <TestStage enrollment={e} phase="post" onSubmitted={() => { setHold('post'); void reload() }} onDone={leaveHold} />
      )}
      {current === 'done' && doneView === 'task' && <TaskStage enrollment={e} onChanged={changed} />}
      {current === 'done' && doneView === 'post' && <TestStage enrollment={e} phase="post" onSubmitted={reload} onDone={reload} />}
    </div>
  )
}
