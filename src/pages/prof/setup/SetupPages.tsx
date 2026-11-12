import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { api, TOOL_LABEL, type Assignment } from '../../../api'
import { sectionDone, setupNav, STATUS_LABEL, STATUS_TONE } from '../../../nav'
import { CopyButton, dateTime, Notice, Section, Status, type Tone } from '../../../ui'
import { CompetenciesSection, MaterialsSection, RulesSection, TaskProblemSection, TestsSection, ToolSection } from '../setupSections'
import { useSetup } from './SetupLayout'

export function CompetenciesPage() {
  const { a, setA, reload, notify } = useSetup()
  return <CompetenciesSection a={a} setA={setA} reload={reload} notify={notify} />
}

export function TestsPage() {
  const { a, setA, reload, notify } = useSetup()
  return <TestsSection a={a} setA={setA} reload={reload} notify={notify} />
}

export function TaskPage() {
  const { a, setA, notify } = useSetup()
  return <TaskProblemSection a={a} onSaved={setA} notify={notify} />
}

export function MaterialsPage() {
  const { a, reload, notify } = useSetup()
  return <MaterialsSection a={a} onSaved={reload} notify={notify} />
}

export function RulesPage() {
  const { a, reload, notify } = useSetup()
  return <RulesSection a={a} onSaved={reload} notify={notify} />
}

export function ToolsPage() {
  const { a, setA, notify } = useSetup()
  return <ToolSection a={a} onSaved={setA} notify={notify} />
}

// 서버가 알려 준 공개 조건 문장이 어느 구역의 것인지 가린다. 가리지 못한 문장은 목록 아래에 따로 보여 준다.
function sectionOfProblem(problem: string): string | null {
  if (problem.includes('문항이 없는 역량')) return 'tests'
  if (problem.startsWith('역량')) return 'competencies'
  if (problem.includes('마감')) return 'task'
  if (problem.includes('작업공간') || problem.includes('프로그램')) return 'tools'
  return null
}

const toolFiles = (a: Assignment) => ((a.tool_config as { files?: unknown[] }).files ?? []).length

// 구역에 빠진 것이 없을 때 보여 주는 현재 내용
function detailOf(a: Assignment, key: string): string {
  switch (key) {
    case 'competencies':
      return `역량 ${a.competencies.length}개`
    case 'tests':
      return `문항 ${a.items.length}개`
    case 'task':
      return a.deadline ? `마감 ${dateTime(a.deadline)}` : ''
    case 'materials':
      return a.materials.length ? `자료 ${a.materials.length}개` : '자료 없음'
    case 'rules':
      return a.rules.length ? `규칙 ${a.rules.length}개` : '규칙 없음'
    case 'tools':
      return a.tool_name === 'workspace' ? `시작 파일 ${toolFiles(a)}개` : (TOOL_LABEL[a.tool_name] ?? a.tool_name)
    default:
      return ''
  }
}

export function PublishPage() {
  const { a, setA, notify } = useSetup()
  const [check, setCheck] = useState<{ ok: boolean; problems: string[] } | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () => api.prof.publishCheck(a.id).then(setCheck).catch((e: Error) => notify('error', e.message)),
    [a.id, notify],
  )
  useEffect(() => {
    void load()
  }, [load, a])

  async function publish() {
    setBusy(true)
    try {
      setA(await api.prof.publish(a.id))
      setAsking(false)
      notify('ok', '과제를 공개했다. 학생은 참여 코드로 들어온다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '공개 실패')
    } finally {
      setBusy(false)
    }
  }

  const problems = check?.problems ?? []
  const unplaced = problems.filter((p) => sectionOfProblem(p) === null)
  const rows = setupNav
    .filter(([, key]) => key !== 'publish')
    .map(([label, key, Icon]) => {
      const missing = problems.filter((p) => sectionOfProblem(p) === key)
      // 과제 설명은 공개 조건은 아니지만 구역 완료 조건이다.
      if (key === 'task' && !a.description.trim()) missing.push('과제 설명이 비어 있다')
      const done = sectionDone(a, key)
      const tone: Tone = missing.length || done === false ? 'alert' : done === null ? 'todo' : 'done'
      return {
        label,
        key,
        Icon,
        tone,
        state: tone === 'alert' ? '미완료' : tone === 'todo' ? '선택' : '완료',
        detail: missing.length ? missing.join(', ') : detailOf(a, key),
      }
    })
  const joinUrl = `${window.location.origin}/stu`

  return (
    <>
      <div className="rows check-list">
        {rows.map(({ label, key, Icon, tone, state, detail }) => (
          <Link className="row" key={key} to={`../${key}`} relative="path">
            <span className="name">
              <Icon aria-hidden="true" />
              {label}
            </span>
            <Status tone={tone}>{state}</Status>
            <span className="end">
              <span>{detail}</span>
              <ChevronRight aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <Section title="공개">
        {unplaced.length > 0 && <Notice kind="error">{unplaced.join(', ')}</Notice>}
        {a.status === 'open' ? (
          <div className="rows">
            <div className="row">
              <span className="name">상태</span>
              <Status tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Status>
            </div>
            <div className="row">
              <span className="name">과제 코드</span>
              <span className="mono">{a.join_code}</span>
              <span className="end">
                <CopyButton text={a.join_code} label="코드 복사" />
              </span>
            </div>
            <div className="row">
              <span className="name">참여 주소</span>
              <span className="mono grow">{joinUrl}</span>
              <span className="end">
                <CopyButton text={joinUrl} label="주소 복사" />
              </span>
            </div>
          </div>
        ) : asking ? (
          <div className="confirm" role="alertdialog" aria-label="공개 확인">
            <p>공개하면 학생이 과제 코드로 참여할 수 있다. 응시한 학생이 생긴 시험의 문항은 바꿀 수 없다.</p>
            <button type="button" className="btn" onClick={() => setAsking(false)} disabled={busy}>
              취소
            </button>
            <button type="button" className="btn primary" onClick={() => void publish()} disabled={busy}>
              공개
            </button>
          </div>
        ) : (
          <div className="inline">
            <button type="button" className="btn primary" disabled={!check?.ok} onClick={() => setAsking(true)}>
              공개
            </button>
            <Status tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Status>
          </div>
        )}
      </Section>
    </>
  )
}
