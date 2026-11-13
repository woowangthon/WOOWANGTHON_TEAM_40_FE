// 과제 현황. 반 전체 지표를 단계별 하위 페이지로 나눈다. 학생 한 명의 기록은 students/:eid 화면에서 본다.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, ClipboardList, PenLine, Search, TrendingDown, TriangleAlert } from 'lucide-react'

import { api, STAGE_LABEL, type Overview, type OverviewRow, type Stage } from '../../../api'
import { shownStatus, STATUS_LABEL, STATUS_TONE, statusNav } from '../../../nav'
import { Columns, CopyButton, CountUp, HBar, Legend, Loading, Meta, Notice, PageHead, Section, Stack, Status, type Group } from '../../../ui'
import {
  Empty,
  goalsOf,
  GradeCell,
  learningState,
  letterOf,
  mean,
  round1,
  SignalCell,
  stageState,
  StuLink,
  taskState,
  useBase,
  useOpen,
  useStatus,
  when,
  type StatusCtx,
} from './shared'
import './status.css'

const STAGES: Stage[] = ['pre', 'learning', 'task', 'post', 'done']

// 사전평가 총점 구간. 서버의 PRE_BUCKET_TOPS 40, 55, 70, 85 와 맞춘다.
const PRE_BUCKETS = ['40 이하', '41에서 55', '56에서 70', '71에서 85', '86 이상']

const noGoal = (r: OverviewRow) => r.pre_score !== null && r.weak_competencies.length === 0
const learnOf = (r: OverviewRow) => learningState(r.stage, noGoal(r))
const taskOf = (r: OverviewRow) => taskState(r.submitted, r.attempt_count)
const score = (v: number | null) => (v === null ? '' : round1(v))

// 반 전체 지표를 한 번 받아 하위 페이지에 넘긴다.
export function StatusLayout() {
  const { id } = useParams()
  const aid = Number(id)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    () =>
      api.prof
        .overview(aid)
        .then((o) => {
          setOverview(o)
          setError(null)
        })
        .catch((e: Error) => setError(e.message)),
    [aid],
  )
  useEffect(() => {
    void reload()
  }, [reload])

  // 다른 과제의 지표가 남아 있으면 새로 받을 때까지 쓰지 않는다.
  const ready = overview !== null && overview.assignment.id === aid
  if (error && !ready) {
    return (
      <div className="page prof-status">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!ready) return <Loading />
  const ctx: StatusCtx = { overview, reload }
  return <Outlet context={ctx} />
}

// 참여한 학생이나 응시한 학생이 없을 때 본문 자리에 두는 한 줄
function Blank({ children }: { children: string }) {
  return (
    <div className="section">
      <Empty>{children}</Empty>
    </div>
  )
}

export function StatusOverview() {
  const { overview } = useStatus()
  const base = useBase()
  const navigate = useNavigate()
  const a = overview.assignment
  const s = overview.stats
  const rows = overview.rows
  const n = s.enrolled
  const working = rows.filter((r) => taskOf(r).tone === 'doing').length
  // 단계마다 끝낸 학생 수와 진행 중인 학생 수. 시험은 응시했는지만 알 수 있어 진행 중이 없다.
  const progress: Record<string, [done: number, doing: number]> = {
    pre: [s.pre_taken, 0],
    learning: [s.learning_done, s.learning_now],
    task: [s.submitted_count, working],
    post: [s.post_taken, 0],
  }
  const stages = statusNav.filter(([, path]) => path in progress)
  const checks: [label: string, count: number, unit: string, path: string, icon: LucideIcon][] = [
    ['교수 평가 대기', rows.filter((r) => r.submitted && r.grade_score === null).length, '명', 'task', PenLine],
    ['위반 의심 신호', rows.reduce((sum, r) => sum + r.signal_count, 0), '건', 'task', TriangleAlert],
    ['사후평가 점수가 내려간 학생', s.dropped_count, '명', 'post', TrendingDown],
    ['사전평가 미응시', n - s.pre_taken, '명', 'pre', ClipboardList],
  ]
  const todo = checks.filter((c) => c[1] > 0)

  return (
    <div className="page prof-status">
      <PageHead title="개요">
        <CopyButton text={a.join_code} label={`과제 코드 ${a.join_code}`} />
      </PageHead>
      <Meta
        items={[
          ['상태', <Status tone={STATUS_TONE[shownStatus(a)]}>{STATUS_LABEL[shownStatus(a)]}</Status>],
          ['마감', a.deadline ? when(a.deadline) : '정하지 않음'],
          ['참여 인원', `${n}명`],
          ['과목', a.subject],
        ]}
      />

      {n === 0 ? (
        <Blank>아직 참여한 학생이 없다</Blank>
      ) : (
        <>
          <Section title="단계별 진행">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>진행</th>
                    <th className="r">완료</th>
                    <th className="r">진행 중</th>
                    <th className="r">시작 전</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stages.map(([label, path, Icon], i) => {
                    const [done, doing] = progress[path]
                    const rest = Math.max(0, n - done - doing)
                    return (
                      <tr key={path} className="go" onClick={() => navigate(`${base}/${path}`)}>
                        <td className="strong">
                          <Link to={`${base}/${path}`} className="with-ico" onClick={(e) => e.stopPropagation()}>
                            <Icon aria-hidden="true" />
                            {label}
                          </Link>
                        </td>
                        <td className="bar">
                          <Stack
                            i={i}
                            parts={[
                              [done, 'ink'],
                              [doing, 'accent'],
                              [rest, 'none'],
                            ]}
                          />
                        </td>
                        <td className="r">{done}</td>
                        <td className="r">{doing}</td>
                        <td className="r">{rest}</td>
                        <td className="act">
                          <Link to={`${base}/${path}`} aria-label={`${label} 현황 열기`} className="btn icon quiet" onClick={(e) => e.stopPropagation()}>
                            <ChevronRight aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Legend
              items={[
                ['완료', 'ink'],
                ['진행 중', 'accent'],
              ]}
            />
          </Section>

          <Section title="확인할 것">
            <div className="rows">
              {todo.map(([label, count, unit, path, Icon]) => (
                <Link className="row" key={label} to={`${base}/${path}`}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  <span className="end">
                    {count}
                    {unit}
                    <ChevronRight aria-hidden="true" />
                  </span>
                </Link>
              ))}
              {todo.length === 0 && <div className="empty">확인할 것이 없다</div>}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export function StatusPre() {
  const { overview } = useStatus()
  const open = useOpen('tests')
  const s = overview.stats
  const comps = s.competencies
  const dist = s.pre_distribution
  const blank = s.enrolled === 0 ? '아직 참여한 학생이 없다' : s.pre_taken === 0 ? '아직 응시한 학생이 없다' : null

  return (
    <div className="page prof-status">
      <PageHead title="사전평가" />
      <Meta
        items={[
          ['응시', `${s.enrolled}명 중 ${s.pre_taken}명`],
          ['평균', s.pre_avg === null ? '없음' : <CountUp to={s.pre_avg} digits={1} />],
          ['최저', s.pre_min === null ? '없음' : round1(s.pre_min)],
          ['최고', s.pre_max === null ? '없음' : round1(s.pre_max)],
        ]}
      />

      {blank ? (
        <Blank>{blank}</Blank>
      ) : (
        <>
          <div className="cols-2">
            <Section title="점수 분포">
              <div className="chart">
                <Columns max={Math.max(1, ...dist) * 1.25} groups={dist.map((v, i) => ({ label: PRE_BUCKETS[i] ?? `구간 ${i + 1}`, bars: [{ v }] }))} />
              </div>
            </Section>
            <Section title="역량별 평균">
              <div className="rows">
                {comps.map((c, i) => (
                  <div className="row" key={c.competency_id}>
                    <span className="name">
                      {letterOf(i)} {c.name}
                    </span>
                    <div className="grow">{c.pre_avg !== null && <HBar value={c.pre_avg} mark={c.pass_score} i={i} />}</div>
                    <span className="val">{score(c.pre_avg)}</span>
                  </div>
                ))}
                {comps.length === 0 && <div className="empty">역량이 없다</div>}
              </div>
              <div className="legend">
                <span>
                  <i className="tick" />
                  통과 점수
                </span>
              </div>
            </Section>
          </div>

          <Section title="학생별 점수">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th className="r">총점</th>
                    {comps.map((c, i) => (
                      <th key={c.competency_id} className="r" title={c.name}>
                        {letterOf(i)}
                      </th>
                    ))}
                    <th>학습 목표</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((r) => (
                    <tr key={r.enrollment_id} className="go" onClick={() => open(r.enrollment_id)}>
                      <td className="strong">
                        <StuLink r={r} tab="tests" />
                      </td>
                      {r.pre_score === null ? (
                        <td colSpan={comps.length + 2}>미응시</td>
                      ) : (
                        <>
                          <td className="r strong">{score(r.pre_score)}</td>
                          {comps.map((c, i) => {
                            const v = r.pre_scores[i] ?? null
                            return (
                              <td key={c.competency_id} className={v !== null && v < c.pass_score ? 'r low' : 'r'}>
                                {v === null ? '' : Math.round(v)}
                              </td>
                            )
                          })}
                          <td>{goalsOf(r, comps).join(' ') || '없음'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export function StatusLearning() {
  const { overview } = useStatus()
  const open = useOpen('learning')
  const s = overview.stats
  const comps = s.competencies
  const rows = overview.rows
  // 사전평가에서 모든 역량이 통과 점수를 넘어 학습 단계를 건너뛴 학생
  const skipped = rows.filter((r) => r.stage !== 'pre' && r.stage !== 'learning' && noGoal(r)).length
  const maxLearning = Math.max(1, ...comps.map((c) => c.learning_count))
  const maxBelow = Math.max(1, ...comps.map((c) => c.below_count))

  return (
    <div className="page prof-status">
      <PageHead title="학습" />
      <Meta
        items={[
          ['학습 완료', `${Math.max(0, s.learning_done - skipped)}명`],
          ['학습 중', `${s.learning_now}명`],
          ['학습 목표 없음', `${skipped}명`],
          ['시작 전', `${s.not_started}명`],
        ]}
      />

      {s.enrolled === 0 ? (
        <Blank>아직 참여한 학생이 없다</Blank>
      ) : (
        <>
          <div className="cols-2">
            <Section title="역량별 학습 중인 학생">
              <div className="rows">
                {comps.map((c, i) => (
                  <div className="row" key={c.competency_id}>
                    <span className="name">
                      {letterOf(i)} {c.name}
                    </span>
                    <div className="grow">
                      <HBar value={c.learning_count} max={maxLearning} i={i} />
                    </div>
                    <span className="val">{c.learning_count}명</span>
                  </div>
                ))}
                {comps.length === 0 && <div className="empty">역량이 없다</div>}
              </div>
            </Section>
            <Section title="역량별 사전평가 미달 학생">
              <div className="rows">
                {comps.map((c, i) => (
                  <div className="row" key={c.competency_id}>
                    <span className="name">
                      {letterOf(i)} {c.name}
                    </span>
                    <div className="grow">
                      <HBar value={c.below_count} max={maxBelow} tone="ink" i={i} />
                    </div>
                    <span className="val">{c.below_count}명</span>
                  </div>
                ))}
                {comps.length === 0 && <div className="empty">역량이 없다</div>}
              </div>
            </Section>
          </div>

          <Section title="학생별 학습">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>상태</th>
                    <th>학습 목표</th>
                    <th className="r">통과 역량</th>
                    <th className="r">대화 수</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = learnOf(r)
                    return (
                      <tr key={r.enrollment_id} className="go" onClick={() => open(r.enrollment_id)}>
                        <td className="strong">
                          <StuLink r={r} tab="learning" />
                        </td>
                        <td>
                          <Status tone={st.tone}>{st.label}</Status>
                        </td>
                        <td>{r.pre_score === null ? '' : goalsOf(r, comps).join(' ') || '없음'}</td>
                        <td className="r">{r.pre_score === null ? '' : `${r.competency_count}개 중 ${r.passed_count}개`}</td>
                        <td className="r">{r.learning_messages || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export function StatusTask() {
  const { overview } = useStatus()
  const base = useBase()
  const open = useOpen('task')
  const s = overview.stats
  const rows = overview.rows
  const working = rows.filter((r) => taskOf(r).tone === 'doing').length
  const versions = mean(rows.filter((r) => r.attempt_count > 0).map((r) => r.version_count))
  const flagged = rows.filter((r) => r.signal_count > 0)
  const signals = flagged.reduce((sum, r) => sum + r.signal_count, 0)

  return (
    <div className="page prof-status">
      <PageHead title="과제" />
      <Meta
        items={[
          ['제출', `${s.submitted_count}명`],
          ['작업 중', `${working}명`],
          ['시작 전', `${Math.max(0, s.enrolled - s.submitted_count - working)}명`],
          ['평균 버전 수', versions === null ? '없음' : <CountUp to={versions} digits={1} />],
        ]}
      />

      {s.enrolled === 0 ? (
        <Blank>아직 참여한 학생이 없다</Blank>
      ) : (
        <>
          <Section title={`위반 의심 신호 ${signals}건`}>
            <div className="rows">
              {flagged.map((r) => (
                <Link className="row" key={r.enrollment_id} to={`${base}/students/${r.enrollment_id}/task`}>
                  <span className="who">{r.student_name}</span>
                  <SignalCell r={r} />
                  <span className="end">
                    <ChevronRight aria-hidden="true" />
                  </span>
                </Link>
              ))}
              {flagged.length === 0 && <div className="empty">신호가 없다</div>}
            </div>
          </Section>

          <Section title="학생별 과제">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>상태</th>
                    <th className="r">시도</th>
                    <th className="r">버전</th>
                    <th>마지막 제출</th>
                    <th>의심 신호</th>
                    <th>교수 평가</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = taskOf(r)
                    return (
                      <tr key={r.enrollment_id} className="go" onClick={() => open(r.enrollment_id)}>
                        <td className="strong">
                          <StuLink r={r} tab="task" />
                        </td>
                        <td>
                          <Status tone={st.tone}>{st.label}</Status>
                        </td>
                        <td className="r">{r.attempt_count || ''}</td>
                        <td className="r">{r.version_count || ''}</td>
                        <td className="num">{when(r.last_submitted_at)}</td>
                        <td>
                          <SignalCell r={r} />
                        </td>
                        <td>
                          <GradeCell r={r} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export function StatusPost() {
  const { overview } = useStatus()
  const open = useOpen('tests')
  const s = overview.stats
  const comps = s.competencies
  const took = overview.rows.filter((r) => r.post_score !== null)
  const blank = s.enrolled === 0 ? '아직 참여한 학생이 없다' : s.post_taken === 0 ? '아직 응시한 학생이 없다' : null
  // 평균이 없는 쪽은 막대를 그리지 않는다.
  const groups: Group[] = comps.map((c, i) => ({
    label: `${letterOf(i)} ${c.name}`,
    bars: [...(c.pre_avg === null ? [] : [{ v: round1(c.pre_avg), mute: true }]), ...(c.post_avg === null ? [] : [{ v: round1(c.post_avg) }])],
  }))

  return (
    <div className="page prof-status">
      <PageHead title="사후평가" />
      <Meta
        items={[
          ['응시', `${s.enrolled}명 중 ${s.post_taken}명`],
          ['사후 평균', s.post_avg === null ? '없음' : <CountUp to={s.post_avg} digits={1} />],
          ['평균 상승', s.gain_avg === null ? '없음' : <CountUp to={s.gain_avg} digits={1} />],
          ['점수가 내려간 학생', `${s.dropped_count}명`],
        ]}
      />

      {blank ? (
        <Blank>{blank}</Blank>
      ) : (
        <>
          <Section title="역량별 평균 비교">
            <div className="chart">
              <Columns max={115} height={200} groups={groups} />
              <Legend
                items={[
                  ['사전평가', 'mute'],
                  ['사후평가', 'accent'],
                ]}
              />
            </div>
          </Section>

          <Section title="학생별 변화">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th className="r">사전</th>
                    <th className="r">사후</th>
                    <th className="r">상승</th>
                    <th>교수 평가</th>
                  </tr>
                </thead>
                <tbody>
                  {took.map((r) => (
                    <tr key={r.enrollment_id} className="go" onClick={() => open(r.enrollment_id)}>
                      <td className="strong">
                        <StuLink r={r} tab="tests" />
                      </td>
                      <td className="r">{score(r.pre_score)}</td>
                      <td className="r">{score(r.post_score)}</td>
                      <td className="r strong">{score(r.gain)}</td>
                      <td>
                        <GradeCell r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

type SortKey = 'name' | 'pre' | 'gain'

export function StatusStudents() {
  const { overview } = useStatus()
  const open = useOpen()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<Stage | ''>('')
  const [sort, setSort] = useState<SortKey>('name')
  const stages = STAGES.filter((st) => (overview.stage_counts[st] ?? 0) > 0)

  const list = useMemo(() => {
    const word = q.trim().toLowerCase()
    const found = overview.rows.filter(
      (r) => (!word || r.student_name.toLowerCase().includes(word) || r.student_email.toLowerCase().includes(word)) && (!stage || r.stage === stage),
    )
    // 값이 없는 학생은 어느 정렬에서든 맨 뒤에 둔다.
    const by = (pick: (r: OverviewRow) => number | null, dir: 1 | -1) => (x: OverviewRow, y: OverviewRow) => {
      const a = pick(x)
      const b = pick(y)
      if (a === null && b === null) return x.student_name.localeCompare(y.student_name)
      if (a === null) return 1
      if (b === null) return -1
      return (a - b) * dir
    }
    if (sort === 'pre') return [...found].sort(by((r) => r.pre_score, 1))
    if (sort === 'gain') return [...found].sort(by((r) => r.gain, -1))
    return found
  }, [overview.rows, q, stage, sort])

  return (
    <div className="page prof-status">
      <PageHead title="학생" />
      {overview.rows.length === 0 ? (
        <Empty>아직 참여한 학생이 없다</Empty>
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Search aria-hidden="true" />
              <input className="input" placeholder="이름이나 이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="이름이나 이메일 검색" />
            </div>
            <select className="select" value={stage} onChange={(e) => setStage(e.target.value as Stage | '')} aria-label="현재 단계">
              <option value="">모든 단계</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {STAGE_LABEL[st]}
                </option>
              ))}
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
              <option value="name">이름 순</option>
              <option value="pre">사전평가 낮은 순</option>
              <option value="gain">사후 변화 큰 순</option>
            </select>
            <span className="actions num">{list.length}명</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>현재 단계</th>
                  <th className="r">사전</th>
                  <th className="r">사후</th>
                  <th className="r">버전</th>
                  <th>의심 신호</th>
                  <th>교수 평가</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const st = stageState(r.stage, r.attempt_count > 0)
                  return (
                    <tr key={r.enrollment_id} className="go" onClick={() => open(r.enrollment_id)}>
                      <td className="strong">
                        <StuLink r={r} />
                      </td>
                      <td>{r.student_email}</td>
                      <td>
                        <Status tone={st.tone}>{st.label}</Status>
                      </td>
                      <td className="r">{score(r.pre_score)}</td>
                      <td className="r">{score(r.post_score)}</td>
                      <td className="r">{r.version_count || ''}</td>
                      <td>
                        <SignalCell r={r} />
                      </td>
                      <td>
                        <GradeCell r={r} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {list.length === 0 && <div className="empty">조건에 맞는 학생이 없다</div>}
          </div>
        </>
      )}
    </div>
  )
}
