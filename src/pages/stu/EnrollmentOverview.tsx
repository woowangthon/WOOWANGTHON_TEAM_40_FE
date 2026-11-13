import { Link } from 'react-router-dom'
import { FileText, Lock } from 'lucide-react'

import { api, STAGE_LABEL, TOOL_LABEL, type CompetencyState, type Stage } from '../../api'
import { DownloadButton } from '../../components/Files'
import { stageSteps } from '../../nav'
import { dateTime, Meta, PageHead, Section, Status, type Tone } from '../../ui'
import { useEnrollment } from './EnrollmentLayout'
import { scoreText } from './TestStage'

// 역량별 점수 표. 사전평가 점수, 학습으로 갱신된 현재 점수, 사후평가 점수를 통과 점수와 함께 보여 준다.
export function ScoreTable({ states, showPost }: { states: CompetencyState[]; showPost: boolean }) {
  const fmt = (v: number | null) => (v === null ? '' : `${scoreText(v)}점`)
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>역량</th>
            <th className="r">통과 점수</th>
            <th className="r">사전</th>
            <th className="r">현재</th>
            {showPost && <th className="r">사후</th>}
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {states.map((s) => (
            <tr key={s.competency_id}>
              <td className="strong">{s.name}</td>
              <td className="r">{s.pass_score}점</td>
              <td className="r">{fmt(s.pre_score)}</td>
              <td className="r">{fmt(s.current_score)}</td>
              {showPost && <td className="r">{fmt(s.post_score)}</td>}
              <td>
                {s.pre_score === null ? (
                  <Status tone="todo">미측정</Status>
                ) : s.passed ? (
                  <Status tone="done">통과</Status>
                ) : (
                  <Status tone="doing">학습 목표</Status>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 과제 개요. 단계마다 상태와 할 일을 보여 주고 과제 설명과 역량과 학습 자료와 규칙을 읽게 한다.
export default function EnrollmentOverview() {
  const { e } = useEnrollment()
  const a = e.assignment
  const base = `/stu/enrollments/${e.id}`
  const at = stageSteps.findIndex((s) => s.key === e.stage)
  const submitted = e.attempts.filter((t) => t.status === 'submitted').length
  const passed = e.states.filter((s) => s.passed).length
  const measured = e.states.some((s) => s.pre_score !== null)

  // 단계 이름 옆에 붙이는 실제 진행 기록
  const detail: Partial<Record<Stage, string>> = {
    learning: measured ? `역량 ${e.states.length}개 중 ${passed}개 통과` : '',
    task: submitted > 0 ? `제출 ${submitted}회` : '',
  }

  return (
    <div className="page narrow stu-page">
      <PageHead title={a.title}>
        <Link className="btn quiet" to="/privacy">
          <Lock aria-hidden="true" />
          기록 범위 안내
        </Link>
      </PageHead>
      <Meta
        items={[
          ['과목', a.subject || '없음'],
          ['교수', a.professor_name],
          ['마감', !a.deadline ? '없음' : e.deadline_passed ? <Status tone="alert">{dateTime(a.deadline)} 지남</Status> : dateTime(a.deadline)],
          ['현재 단계', STAGE_LABEL[e.stage]],
        ]}
      />

      <Section title="단계">
        <div className="rows">
          {stageSteps.map((s, i) => {
            const Icon = s.icon
            const to = `${base}/${s.path}`
            const tone: Tone = i < at ? 'done' : i === at ? 'doing' : 'todo'
            const label = i < at ? '완료' : i > at ? '잠김' : s.key === 'done' ? '확인 가능' : '진행 중'
            // 마감 전에는 완료한 뒤에도 과제만 다시 제출할 수 있다
            const again = s.key === 'task' ? (e.stage === 'done' && !e.deadline_passed ? '다시 제출하기' : '다시 보기') : s.key === 'learning' ? '다시 보기' : '결과 보기'
            return (
              <div className="row" key={s.path}>
                <span className="name">
                  <Icon aria-hidden="true" />
                  {s.label}
                </span>
                <Status tone={tone}>{label}</Status>
                <span className="end">
                  {detail[s.key] && <span>{detail[s.key]}</span>}
                  {i === at && (
                    <Link className="btn primary" to={to}>
                      {s.key === 'done' ? '결과 보기' : '이어서 하기'}
                    </Link>
                  )}
                  {i < at && (
                    <Link className="btn" to={to}>
                      {again}
                    </Link>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {e.grade && (
        <Section title="교수 평가">
          <Meta
            items={[
              ['과제 점수', e.grade.score === null ? '없음' : `${e.grade.score}점`],
              ['입력', dateTime(e.grade.updated_at)],
            ]}
          />
          {e.grade.comment && <p className="prose">{e.grade.comment}</p>}
        </Section>
      )}

      <Section title="과제 설명">
        {a.description ? (
          <p className="prose">{a.description}</p>
        ) : (
          <div className="rows">
            <div className="empty">과제 설명 미입력</div>
          </div>
        )}
        <Meta
          items={[
            ['과제 종류', a.task_kind === 'performance' ? '수행형' : '논술형'],
            ['도구', TOOL_LABEL[a.tool_name] ?? a.tool_name],
          ]}
        />
      </Section>

      <Section title="역량">
        {measured ? (
          <ScoreTable states={e.states} showPost={e.stage === 'done'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>역량</th>
                  <th>설명</th>
                  <th className="r">통과 점수</th>
                </tr>
              </thead>
              <tbody>
                {a.competencies.map((c) => (
                  <tr key={c.id}>
                    <td className="strong">{c.name}</td>
                    <td>{c.description}</td>
                    <td className="r">{c.pass_score}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="학습 자료">
        <div className="rows">
          {a.materials.length === 0 && <div className="empty">교수가 올린 학습 자료가 없다. 이 과제에서 AI는 일반 지식으로 답한다</div>}
          {a.materials.map((m) => (
            <div className="row" key={m.id}>
              <FileText aria-hidden="true" />
              <span className="grow">{m.filename}</span>
              <span className="end">
                <span>{Math.max(1, Math.round(m.size / 1024))}KB</span>
                <DownloadButton path={api.stu.materialPath(e.id, m.id)} filename={m.filename} label="내려받기" className="btn" />
              </span>
            </div>
          ))}
        </div>
      </Section>

      {a.student_rules.length > 0 && (
        <Section title="규칙">
          <div className="rows">
            {a.student_rules.map((r, i) => (
              <div className="row" key={i}>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
