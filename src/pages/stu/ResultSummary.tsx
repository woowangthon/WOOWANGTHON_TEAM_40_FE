import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError, type Phase, type TaskState, type TestResult } from '../../api'
import { Columns, CountUp, dateTime, Legend, Loading, Meta, Notice, PageHead, Section, type Group } from '../../ui'
import { useEnrollment } from './EnrollmentLayout'
import { ScoreTable } from './EnrollmentOverview'
import { AnswerReview, scoreText, SourceLegend } from './TestStage'

interface Records {
  pre: TestResult | null
  post: TestResult | null
  task: TaskState | null
}

const PHASE_LABEL: Record<Phase, string> = { pre: '사전평가', post: '사후평가' }
const digitsOf = (v: number) => (Number.isInteger(v) ? 0 : 1)
const round1 = (v: number) => Math.round(v * 10) / 10

// 학생이 과제를 마친 뒤 자기 변화와 제출 이력을 한눈에 보는 페이지.
export default function ResultSummary() {
  const { e, reload } = useEnrollment()
  const eid = e.id
  const [records, setRecords] = useState<Records | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Phase | null>(null)

  // 이 화면을 열 때마다 교수 평가와 역량 점수를 새로 받는다
  useEffect(() => {
    reload().catch((err: Error) => setError(err.message))
  }, [reload])

  useEffect(() => {
    let cancelled = false
    const ignoreMissing = (err: unknown) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) return null
      throw err
    }
    Promise.all([
      api.stu.testResult(eid, 'pre').catch(ignoreMissing),
      api.stu.testResult(eid, 'post').catch(ignoreMissing),
      api.stu.task(eid).catch(ignoreMissing),
    ])
      .then(([pre, post, task]) => {
        if (!cancelled) setRecords({ pre, post, task })
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [eid])

  if (error && !records) {
    return (
      <div className="page narrow">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!records) return <Loading />

  const { pre, post, task } = records
  const a = e.assignment
  const base = `/stu/enrollments/${e.id}`
  const preTotal = pre?.total_score ?? null
  const postTotal = post?.total_score ?? null
  const diff = preTotal !== null && postTotal !== null ? round1(postTotal - preTotal) : null

  const groups: Group[] = e.states
    .filter((s) => s.pre_score !== null || s.post_score !== null)
    .map((s) => ({
      label: s.name,
      bars: [...(s.pre_score !== null ? [{ v: round1(s.pre_score), mute: true }] : []), ...(s.post_score !== null ? [{ v: round1(s.post_score) }] : [])],
    }))

  const submitted = (task?.attempts ?? []).filter((t) => t.status === 'submitted')
  const versionCount = submitted.reduce((n, t) => n + t.versions.length, 0)
  const canResubmit = Boolean(task) && !task?.deadline_passed && e.stage === 'done'

  const phase: Phase = picked ?? (post ? 'post' : 'pre')
  const shown = phase === 'post' ? post : pre

  return (
    <div className="page narrow stu-page">
      <PageHead title="결과 요약" />
      <Meta
        items={[
          ['사전평가', preTotal === null ? '응시 전' : `${scoreText(preTotal)}점`],
          [
            '사후평가',
            postTotal === null ? (
              '응시 전'
            ) : (
              <>
                <CountUp to={postTotal} digits={digitsOf(postTotal)} />점
              </>
            ),
          ],
          [
            diff !== null && diff < 0 ? '하락' : '상승',
            diff === null ? (
              '없음'
            ) : (
              <>
                <CountUp to={Math.abs(diff)} digits={digitsOf(diff)} />점
              </>
            ),
          ],
        ]}
      />

      <Section title="역량별 비교">
        {groups.length === 0 ? (
          <div className="rows">
            <div className="empty">아직 평가 점수가 없다</div>
          </div>
        ) : (
          <>
            <div className="chart">
              <Columns max={115} height={200} groups={groups} />
              <Legend
                items={[
                  ['사전평가', 'mute'],
                  ['사후평가', 'accent'],
                ]}
              />
            </div>
            <ScoreTable states={e.states} showPost />
          </>
        )}
      </Section>

      <Section title="교수 평가">
        {e.grade ? (
          <>
            <Meta
              items={[
                ['과제 점수', e.grade.score === null ? '없음' : `${e.grade.score}점`],
                ['입력', dateTime(e.grade.updated_at)],
              ]}
            />
            {e.grade.comment && <p className="prose">{e.grade.comment}</p>}
          </>
        ) : (
          <div className="rows">
            <div className="empty">교수가 아직 과제 점수와 코멘트를 입력하지 않았다</div>
          </div>
        )}
      </Section>

      <Section
        title="제출 이력"
        aside={
          canResubmit && (
            <Link className="btn" to={`${base}/task`}>
              다시 제출하기
            </Link>
          )
        }
      >
        <Meta
          items={[
            ['제출 시도', `${submitted.length}회`],
            ['버전', `${versionCount}개`],
            ['마감', a.deadline ? dateTime(a.deadline) : '없음'],
          ]}
        />
        {submitted.length === 0 ? (
          <div className="rows">
            <div className="empty">아직 제출한 시도가 없다</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>시도</th>
                  <th>시작</th>
                  <th>제출</th>
                  <th className="r">버전</th>
                  <th>마지막 변경 이유</th>
                </tr>
              </thead>
              <tbody>
                {submitted.map((t) => (
                  <tr key={t.id}>
                    <td className="strong">{t.attempt_no}회</td>
                    <td className="num">{dateTime(t.started_at)}</td>
                    <td className="num">{dateTime(t.submitted_at)}</td>
                    <td className="r">{t.versions.length}개</td>
                    <td>{t.versions.length > 0 ? t.versions[t.versions.length - 1].reason : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {shown && (
        <Section
          title={`${PHASE_LABEL[phase]} 문항별 결과`}
          aside={
            pre &&
            post && (
              <div className="seg" role="group" aria-label="평가 고르기">
                {(['pre', 'post'] as const).map((p) => (
                  <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPicked(p)}>
                    {PHASE_LABEL[p]}
                  </button>
                ))}
              </div>
            )
          }
        >
          <Meta
            items={[
              ['총점', shown.total_score === null ? '채점 중' : `${scoreText(shown.total_score)}점`],
              ['제출', dateTime(shown.submitted_at)],
            ]}
          />
          <SourceLegend />
          <div className="wrong" key={phase}>
            {shown.answers.map((ans, i) => {
              const c = a.competencies.find((x) => x.id === ans.competency_id)
              return <AnswerReview key={ans.id} a={ans} no={i + 1} competency={c?.name ?? ''} pass={c?.pass_score ?? 0} i={i} />
            })}
          </div>
        </Section>
      )}
    </div>
  )
}
