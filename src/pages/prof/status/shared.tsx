// 과제 현황과 학생 기록 화면이 같이 쓰는 계산과 작은 부품
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'

import type { CompetencyClassStat, Overview, OverviewRow, Stage } from '../../../api'
import { Status, type Tone } from '../../../ui'

export interface StatusCtx {
  overview: Overview
  reload: () => Promise<void>
}

// 현황 하위 페이지는 틀이 한 번 받아 둔 반 전체 지표를 같이 쓴다.
export function useStatus(): StatusCtx {
  return useOutletContext<StatusCtx>()
}

export type State = { label: string; tone: Tone }

// 역량은 표의 열 이름이 길어지지 않게 순서대로 알파벳을 붙여 부른다.
export function letterOf(index: number): string {
  return String.fromCharCode(65 + index)
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

// 11월 12일 15:04 같은 짧은 시각. 값이 없으면 빈 문자열이다.
export function when(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 현재 단계. started 는 과제 단계에서 작업을 시작했는지다.
export function stageState(stage: Stage, started: boolean): State {
  if (stage === 'pre') return { label: '사전평가 전', tone: 'todo' }
  if (stage === 'learning') return { label: '학습 중', tone: 'doing' }
  if (stage === 'task') return { label: started ? '과제 작업 중' : '과제 시작 전', tone: 'doing' }
  if (stage === 'post') return { label: '사후평가 전', tone: 'doing' }
  return { label: '완료', tone: 'done' }
}

// 학습 단계의 상태. noGoal 은 사전평가에서 통과 점수에 못 미친 역량이 없었다는 뜻이다.
export function learningState(stage: Stage, noGoal: boolean): State {
  if (stage === 'pre') return { label: '시작 전', tone: 'todo' }
  if (stage === 'learning') return { label: '학습 중', tone: 'doing' }
  return { label: noGoal ? '목표 없음' : '완료', tone: 'done' }
}

// 과제 단계의 상태. 한 번이라도 제출했으면 제출로 본다.
export function taskState(submitted: boolean, attempts: number): State {
  if (submitted) return { label: '제출', tone: 'done' }
  if (attempts > 0) return { label: '작업 중', tone: 'doing' }
  return { label: '시작 전', tone: 'todo' }
}

// 사전평가에서 통과 점수에 못 미쳐 학습 목표가 된 역량의 알파벳
export function goalsOf(r: OverviewRow, comps: CompetencyClassStat[]): string[] {
  return comps.flatMap((c, i) => {
    const v = r.pre_scores[i] ?? null
    return v !== null && v < c.pass_score ? [letterOf(i)] : []
  })
}

export function useBase(): string {
  const { id } = useParams()
  return `/prof/assignments/${id}`
}

// 표의 한 줄을 누르면 그 학생의 기록으로 간다.
export function useOpen(tab = ''): (eid: number) => void {
  const navigate = useNavigate()
  const base = useBase()
  return (eid) => navigate(`${base}/students/${eid}${tab ? `/${tab}` : ''}`)
}

export function StuLink({ r, tab = '' }: { r: OverviewRow; tab?: string }) {
  const base = useBase()
  return (
    <Link to={`${base}/students/${r.enrollment_id}${tab ? `/${tab}` : ''}`} onClick={(e) => e.stopPropagation()}>
      {r.student_name}
    </Link>
  )
}

// 교수 평가 칸. 제출했는데 점수가 없으면 대기다.
export function GradeCell({ r }: { r: OverviewRow }) {
  if (r.grade_score !== null) return <Status tone="done">{round1(r.grade_score)}점</Status>
  return r.submitted ? <Status tone="todo">대기</Status> : null
}

export function SignalCell({ r }: { r: OverviewRow }) {
  return r.signal_count > 0 ? <Status tone="alert">{r.signal_count}건</Status> : null
}

export function Empty({ children }: { children: string }) {
  return (
    <div className="rows">
      <div className="empty">{children}</div>
    </div>
  )
}
