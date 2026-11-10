import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError, formatDate, STAGE_LABEL, type Enrollment, type TaskState, type TestResult } from '../../api'
import StatesTable from '../../components/StatesTable'

// 학생이 과제를 마친 뒤 자기 변화와 제출 이력을 한눈에 보는 페이지.
export default function ResultSummary() {
  const { eid } = useParams()
  const enrollmentId = Number(eid)
  const [e, setE] = useState<Enrollment | null>(null)
  const [pre, setPre] = useState<TestResult | null>(null)
  const [post, setPost] = useState<TestResult | null>(null)
  const [task, setTask] = useState<TaskState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ignore404 = (err: unknown) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) return null
      throw err
    }
    Promise.all([
      api.stu.get(enrollmentId),
      api.stu.testResult(enrollmentId, 'pre').catch(ignore404),
      api.stu.testResult(enrollmentId, 'post').catch(ignore404),
      api.stu.task(enrollmentId).catch(ignore404),
    ])
      .then(([en, p, q, t]) => {
        setE(en)
        setPre(p)
        setPost(q)
        setTask(t)
      })
      .catch((err: Error) => setError(err.message))
  }, [enrollmentId])

  if (error) return <p className="error">{error}</p>
  if (!e) return <p className="muted">불러오는 중</p>

  const a = e.assignment
  const improved = e.states.filter((s) => s.pre_score !== null && s.post_score !== null && s.post_score > s.pre_score).length
  const submitted = (task?.attempts ?? []).filter((t) => t.status === 'submitted')

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1>결과 요약: {a.title}</h1>
          <p className="muted small">
            {a.subject} · {a.professor_name} 교수 · 현재 단계 {STAGE_LABEL[e.stage]}
          </p>
        </div>
        <Link className="btn btn-ghost" to={`/stu/enrollments/${e.id}`}>
          과제 화면으로
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="muted small">사전평가</div>
          <div className="stat-value">{pre ? `${pre.total_score}점` : '-'}</div>
          <div className="muted small">{pre ? formatDate(pre.submitted_at) : '아직 응시 전'}</div>
        </div>
        <div className="stat">
          <div className="muted small">사후평가</div>
          <div className="stat-value">{post ? `${post.total_score}점` : '-'}</div>
          <div className="muted small">{post ? formatDate(post.submitted_at) : '아직 응시 전'}</div>
        </div>
        <div className="stat">
          <div className="muted small">점수가 오른 역량</div>
          <div className="stat-value">
            {improved}/{e.states.length}
          </div>
          <div className="muted small">사전 대비 사후 기준</div>
        </div>
        <div className="stat">
          <div className="muted small">제출 시도</div>
          <div className="stat-value">{submitted.length}회</div>
          <div className="muted small">버전 {submitted.reduce((n, t) => n + t.versions.length, 0)}개</div>
        </div>
      </div>

      <div className="card">
        <h2>역량별 변화</h2>
        <p className="muted small">사전 점수가 스펙이고, 학습 단계에서 확인 문항으로 현재 점수가 갱신되며, 사후 점수가 늘어난 역량을 보여 준다.</p>
        <StatesTable states={e.states} showPost />
      </div>

      {(pre || post) && (
        <div className="grid-2">
          {pre && <AnswerCard title="사전평가 문항별 결과" result={pre} />}
          {post && <AnswerCard title="사후평가 문항별 결과" result={post} />}
        </div>
      )}

      <div className="card">
        <h2>제출 이력</h2>
        {submitted.length === 0 ? (
          <p className="muted small">아직 제출한 시도가 없다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>시도</th>
                <th>시작</th>
                <th>제출</th>
                <th>버전</th>
                <th>마지막 변경 이유</th>
              </tr>
            </thead>
            <tbody>
              {submitted.map((t) => (
                <tr key={t.id}>
                  <td>{t.attempt_no}</td>
                  <td className="small">{formatDate(t.started_at)}</td>
                  <td className="small">{formatDate(t.submitted_at)}</td>
                  <td>{t.versions.length}개</td>
                  <td className="small">{t.versions.length ? t.versions[t.versions.length - 1].reason : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {task && !task.deadline_passed && e.stage === 'done' && (
          <p className="muted small" style={{ marginTop: 8 }}>
            마감 {formatDate(task.deadline)} 전에는 과제 화면에서 3단계만 다시 해 재제출할 수 있다.
          </p>
        )}
      </div>
    </div>
  )
}

function AnswerCard({ title, result }: { title: string; result: TestResult }) {
  return (
    <div className="card">
      <h3>
        {title} <span className="score">{result.total_score}점</span>
      </h3>
      {result.answers.map((a) => (
        <div className="version" key={a.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{a.stem}</span>
            <span className="score">{a.score === null ? '-' : `${Math.round(a.score)}점`}</span>
          </div>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            내 답: {a.answer_text || '(비어 있음)'}
          </p>
          {a.feedback && <p className="small">{a.feedback}</p>}
        </div>
      ))}
    </div>
  )
}
