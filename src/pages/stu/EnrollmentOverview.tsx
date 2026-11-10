import { Link } from 'react-router-dom'

import { STAGE_LABEL, TOOL_LABEL } from '../../api'
import StatesTable from '../../components/StatesTable'
import { currentStagePath, useEnrollment } from './EnrollmentLayout'

const NEXT_LABEL: Record<string, string> = {
  pre: '사전평가 시작하기',
  learning: '학습 단계로 가기',
  task: '과제 단계로 가기',
  post: '사후평가 보기',
  done: '과제 결과물 보기',
}

// 과제 개요. 설명과 규칙과 역량을 읽고 다음 할 일로 간다.
export default function EnrollmentOverview() {
  const { e } = useEnrollment()
  const a = e.assignment
  const base = `/stu/enrollments/${e.id}`
  const submitted = e.attempts.filter((t) => t.status === 'submitted').length

  return (
    <div className="grid-side">
      <div>
        <div className="card">
          <div className="card-title">
            <div>
              <h2>지금 할 일</h2>
              <p className="muted small">현재 단계는 {STAGE_LABEL[e.stage]}이다.</p>
            </div>
            <Link className="btn" to={`${base}/${currentStagePath(e.stage)}`}>
              {NEXT_LABEL[e.stage]}
            </Link>
          </div>
          {e.stage === 'done' && (
            <p className="small">
              첫 제출과 사후평가를 마쳤다. 마감 전에는 과제 단계에서 3단계만 다시 해 재제출할 수 있고, <Link to={`${base}/result`}>결과 요약</Link>에서 변화를 볼 수 있다.
            </p>
          )}
        </div>

        <div className="card">
          <h2>과제 설명</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{a.description || '교수가 과제 설명을 쓰지 않았다.'}</p>
          <p className="muted small">
            {a.task_kind === 'performance' ? '수행형 과제' : '논술형 과제'} · 자리 {a.tool_slot} · {TOOL_LABEL[a.tool_name] ?? a.tool_name}
            {a.material_names.length > 0 && ` · 학습 자료 ${a.material_names.length}개`}
          </p>
        </div>

        {a.student_rules.length > 0 && (
          <div className="card">
            <h2>교수가 안내한 규칙</h2>
            <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
              {a.student_rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="card">
          <h2>이 과제가 요구하는 역량</h2>
          <p className="muted small">
            사전평가 점수가 통과 점수에 못 미친 역량이 학습 목표가 되고, 모든 역량이 통과 점수를 넘어야 과제 단계가 열린다.
          </p>
          {e.states.length > 0 ? (
            <StatesTable states={e.states} showPost={e.stage === 'done'} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>역량</th>
                  <th>설명</th>
                  <th>통과 점수</th>
                </tr>
              </thead>
              <tbody>
                {a.competencies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="small">{c.description}</td>
                    <td>{c.pass_score}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h3>진행 요약</h3>
        <table className="table">
          <tbody>
            <tr>
              <td>사전평가</td>
              <td>{e.states.some((s) => s.pre_score !== null) ? '완료' : '전'}</td>
            </tr>
            <tr>
              <td>학습</td>
              <td>{e.states.length ? `${e.states.filter((s) => s.passed).length}/${e.states.length} 역량 통과` : '-'}</td>
            </tr>
            <tr>
              <td>과제</td>
              <td>{submitted ? `제출 ${submitted}회` : e.attempts.length ? '진행 중' : '전'}</td>
            </tr>
            <tr>
              <td>사후평가</td>
              <td>{e.states.some((s) => s.post_score !== null) ? '완료' : '전'}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">기록 범위는 <Link to="/privacy">개인정보와 기록 범위 안내</Link>에 적혀 있다.</p>
      </div>
    </div>
  )
}
