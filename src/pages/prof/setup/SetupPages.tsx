import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../../api'
import {
  BasicSection,
  CompetencySection,
  ItemsSection,
  MaterialsSection,
  RulesSection,
  TaskProblemSection,
  ToolSection,
} from '../setupSections'
import { SECTIONS, sectionDone, useSetup } from './SetupLayout'

export function CompetenciesPage() {
  const { a, setA, reload, notify } = useSetup()
  return (
    <>
      <BasicSection a={a} onSaved={setA} notify={notify} />
      <CompetencySection a={a} onSaved={() => void reload()} notify={notify} />
      <NextLink to="tests" />
    </>
  )
}

export function TestsPage() {
  const { a, reload, notify } = useSetup()
  const [phase, setPhase] = useState<'pre' | 'post'>('pre')
  return (
    <>
      <div className="section-nav">
        <button className={phase === 'pre' ? 'active' : ''} onClick={() => setPhase('pre')}>
          사전평가 문항
        </button>
        <button className={phase === 'post' ? 'active' : ''} onClick={() => setPhase('post')}>
          사후평가 문항
        </button>
      </div>
      <ItemsSection key={phase} a={a} phase={phase} onSaved={() => void reload()} notify={notify} />
      <NextLink to="task" />
    </>
  )
}

export function TaskPage() {
  const { a, setA, notify } = useSetup()
  return (
    <>
      <TaskProblemSection a={a} onSaved={setA} notify={notify} />
      <NextLink to="materials" />
    </>
  )
}

export function MaterialsPage() {
  const { a, reload, notify } = useSetup()
  return (
    <>
      <MaterialsSection a={a} onSaved={() => void reload()} notify={notify} />
      <NextLink to="rules" />
    </>
  )
}

export function RulesPage() {
  const { a, reload, notify } = useSetup()
  return (
    <>
      <RulesSection a={a} onSaved={() => void reload()} notify={notify} />
      <NextLink to="tools" />
    </>
  )
}

export function ToolsPage() {
  const { a, setA, notify } = useSetup()
  return (
    <>
      <ToolSection a={a} onSaved={setA} notify={notify} />
      <NextLink to="publish" />
    </>
  )
}

export function PublishPage() {
  const { a, setA, notify } = useSetup()
  const [check, setCheck] = useState<{ ok: boolean; problems: string[] } | null>(null)
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
      notify('ok', '과제를 공개했다. 학생은 참여 코드로 들어온다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '공개 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>7. 점검과 공개</h2>
      <p className="muted small">
        공개 조건을 모두 채우면 공개할 수 있다. 공개한 뒤에도 설정을 고칠 수 있지만, 이미 응시한 학생이 있는 단계의 문항은 바꿀 수 없다.
      </p>
      <table className="table">
        <tbody>
          {SECTIONS.filter((s) => s.key !== 'publish').map((s) => {
            const done = sectionDone(a, s.key)
            return (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>
                  <span className={`chip ${done === true ? 'chip-ok' : done === false ? 'chip-bad' : ''}`}>
                    {done === true ? '완료' : done === false ? '미완' : '선택'}
                  </span>
                </td>
                <td>
                  <Link to={`/prof/assignments/${a.id}/setup/${s.key}`}>열기</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {check && !check.ok && (
        <div className="banner" style={{ marginTop: 12 }}>
          <strong>아직 공개할 수 없다</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {check.problems.map((p, i) => (
              <li key={i} className="small">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {check && check.ok && a.status !== 'open' && (
        <div className="banner info" style={{ marginTop: 12 }}>
          공개 조건을 모두 채웠다.
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        {a.status === 'open' ? (
          <span className="chip chip-ok">공개 중</span>
        ) : (
          <button className="btn" onClick={() => void publish()} disabled={busy || !check?.ok}>
            공개하기
          </button>
        )}
      </div>
      {a.status === 'open' && (
        <div className="share">
          <div className="muted small">학생에게 알려 줄 참여 코드</div>
          <div className="share-code">{a.join_code}</div>
          <div className="muted small">
            학생은 {window.location.origin}/stu 에서 로그인한 뒤 이 코드를 입력해 참여한다. 자리 {a.tool_slot} 과제이므로 학생은 과제 단계에서{' '}
            {a.tool_slot === 2 ? 'Google 계정을 연결한다' : a.tool_slot === 3 ? '보조 프로그램을 설치한다' : '페이지 안 도구를 쓴다'}.
          </div>
        </div>
      )}
    </div>
  )
}

function NextLink({ to }: { to: string }) {
  const { a } = useSetup()
  const label = SECTIONS.find((s) => s.key === to)?.label ?? to
  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      <Link className="btn btn-secondary" to={`/prof/assignments/${a.id}/setup/${to}`}>
        다음, {label}
      </Link>
    </div>
  )
}
