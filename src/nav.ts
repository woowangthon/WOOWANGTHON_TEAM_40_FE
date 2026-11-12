// 사이드바와 탭과 단계 표시가 같이 쓰는 메뉴 정의. 이름, 주소 조각, 이름 왼쪽에 놓는 아이콘으로 이루어진다.
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  FileCode2,
  FileText,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Plug,
  ScrollText,
  Send,
  Target,
  Users,
} from 'lucide-react'

import type { Assignment, Stage } from './api'
import type { Tone } from './ui'

export const APP_NAME = '학습 도우미'

export function homePath(role: 'professor' | 'student'): string {
  return role === 'professor' ? '/prof' : '/stu'
}

export type NavItem = [label: string, path: string, icon: LucideIcon]

// 교수의 과제 현황. 반 전체 지표를 단계별 하위 페이지로 나눈다.
export const statusNav: NavItem[] = [
  ['개요', '', LayoutDashboard],
  ['사전평가', 'pre', ClipboardList],
  ['학습', 'learning', MessagesSquare],
  ['과제', 'task', FileCode2],
  ['사후평가', 'post', ClipboardCheck],
  ['학생', 'students', Users],
]

// 교수의 과제 설정 일곱 구역
export const setupNav: NavItem[] = [
  ['역량과 채점 기준', 'competencies', Target],
  ['사전 사후 평가', 'tests', ListChecks],
  ['과제 문제', 'task', FileText],
  ['학습 자료', 'materials', BookOpen],
  ['AI 응답 규칙', 'rules', ScrollText],
  ['도구 연동', 'tools', Plug],
  ['점검과 공개', 'publish', Send],
]

// 학생이 거치는 네 단계와 결과 요약
export const stageSteps: { key: Stage; label: string; path: string; icon: LucideIcon }[] = [
  { key: 'pre', label: '사전평가', path: 'pre', icon: ClipboardList },
  { key: 'learning', label: '학습', path: 'learning', icon: MessagesSquare },
  { key: 'task', label: '과제', path: 'task', icon: FileCode2 },
  { key: 'post', label: '사후평가', path: 'post', icon: ClipboardCheck },
  { key: 'done', label: '결과', path: 'result', icon: ChartColumn },
]

export const STATUS_LABEL: Record<Assignment['status'], string> = { draft: '작성 중', open: '공개 중', closed: '마감' }
export const STATUS_TONE: Record<Assignment['status'], Tone> = { draft: 'todo', open: 'doing', closed: 'done' }

// 설정 구역이 끝났는지 알려 준다. true 완료, false 미완, null 선택 사항.
export function sectionDone(a: Assignment, key: string): boolean | null {
  switch (key) {
    case 'competencies':
      return a.competencies.length > 0 && a.competencies.every((c) => c.grading_criteria.trim().length > 0)
    case 'tests': {
      if (!a.competencies.length) return false
      const covers = (phase: 'pre' | 'post') => {
        const ids = new Set(a.items.filter((i) => i.phase === phase).map((i) => i.competency_id))
        return a.competencies.every((c) => ids.has(c.id))
      }
      return covers('pre') && covers('post')
    }
    case 'task':
      return Boolean(a.description.trim()) && a.deadline !== null
    case 'materials':
      return a.materials.length > 0 ? true : null
    case 'rules':
      return a.rules.length > 0 ? true : null
    case 'tools':
      return true
    case 'publish':
      return a.status === 'open'
    default:
      return null
  }
}
