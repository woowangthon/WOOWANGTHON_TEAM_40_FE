import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Download, FileCode2, FileText, ImageIcon, Paperclip, Plus, Trash2 } from 'lucide-react'

import {
  api,
  fetchBlobUrl,
  ITEM_TYPE_LABEL,
  toLocalInput,
  type Assignment,
  type AssignmentEnv,
  type EnvSpec,
  type CompetencyInput,
  type ItemInput,
  type ItemType,
  type Material,
  type Phase,
  type RuleTarget,
} from '../../api'
import { setupNav } from '../../nav'
import { Saved, Section, Status, vars } from '../../ui'

export type Notify = (kind: 'ok' | 'error', text: string) => void

const ITEM_TYPES: ItemType[] = ['choice', 'short', 'fill', 'essay_short', 'essay_long']

// 역량 기호. 역량은 여섯 개까지 둔다.
const SYMBOLS = 'ABCDEF'
const PHASES: Phase[] = ['pre', 'post']
const PHASE_LABEL: Record<Phase, string> = { pre: '사전평가', post: '사후평가' }

// 문항 종류마다 서버가 채점하는 방식
const GRADING: Record<ItemType, string> = {
  choice: '자동 채점',
  short: '정답 비교',
  fill: '정답 비교',
  essay_short: 'AI 채점 뒤 확인',
  essay_long: 'AI 채점 뒤 확인',
}

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

// 저장한 직후에 잠깐 저장됨 표시를 켠다.
function useSaved(): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 1800)
  }, [])
  return [saved, flash]
}

// 구역 아래쪽. 저장 버튼과 다음 구역으로 가는 버튼을 둔다. 저장할 것이 없는 구역은 다음 구역 버튼만 둔다.
// onSave 는 저장에 성공했는지를 돌려준다. dirty 는 저장하지 않은 변경이 있다는 뜻이다.
export function Foot({
  section,
  onSave,
  dirty = false,
  saved = false,
  busy = false,
}: {
  section: string
  onSave?: () => Promise<boolean>
  dirty?: boolean
  saved?: boolean
  busy?: boolean
}) {
  const navigate = useNavigate()
  const next = setupNav[setupNav.findIndex(([, path]) => path === section) + 1]

  // 고친 내용이 있으면 먼저 저장하고, 저장에 성공했을 때만 다음 구역으로 간다. 실패하면 오류 알림과 함께 이 구역에 남는다.
  async function goNext() {
    if (!next) return
    if (onSave && dirty && !(await onSave())) return
    navigate(`../${next[1]}`, { relative: 'path' })
  }

  return (
    <div className="editor-foot setup-foot">
      {onSave && (
        <button type="button" className="btn primary" onClick={() => void onSave()} disabled={busy}>
          저장
        </button>
      )}
      {next &&
        (onSave ? (
          <button type="button" className="btn" onClick={() => void goNext()} disabled={busy}>
            다음 {next[0]}
            <ChevronRight aria-hidden="true" />
          </button>
        ) : (
          <Link className="btn" to={`../${next[1]}`} relative="path">
            다음 {next[0]}
            <ChevronRight aria-hidden="true" />
          </Link>
        ))}
      <Saved show={saved} />
    </div>
  )
}

// 파일을 끌어다 놓거나 눌러서 고르는 칸. 고른 파일은 바로 넘긴다.
function FileDrop({ text, label, multiple = false, busy = false, onFiles }: { text: string; label: string; multiple?: boolean; busy?: boolean; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  const take = (list: FileList | null) => {
    const files = list ? Array.from(list) : []
    if (files.length && !busy) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <label
      className={`drop${over ? ' over' : ''}${busy ? ' busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <span>{busy ? '올리는 중' : text}</span>
      <input
        type="file"
        multiple={multiple}
        disabled={busy}
        aria-label={label}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

// ---------- 구역 1. 기본 정보와 역량 ----------
function emptyCompetency(): CompetencyInput {
  return { name: '', description: '', pass_score: 60, grading_criteria: '' }
}

// 서버에 보내는 모양으로 맞춘다. 저장된 역량은 id 를 그대로 보내야 서버가 같은 역량으로 본다.
function toCompetencyInput(c: CompetencyInput): CompetencyInput {
  return { id: c.id, name: c.name, description: c.description, pass_score: c.pass_score, grading_criteria: c.grading_criteria }
}

// 아무것도 적지 않은 새 줄은 저장할 때 없는 것으로 본다.
const isBlank = (c: CompetencyInput) => c.id == null && !c.name.trim() && !c.description.trim() && !c.grading_criteria.trim()

export function CompetenciesSection({
  a,
  setA,
  reload,
  notify,
}: {
  a: Assignment
  setA: (a: Assignment) => void
  reload: () => Promise<void>
  notify: Notify
}) {
  const [title, setTitle] = useState(a.title)
  const [subject, setSubject] = useState(a.subject)
  const [rows, setRows] = useState<CompetencyInput[]>(a.competencies.length ? a.competencies.map(toCompetencyInput) : [emptyCompetency()])
  const [hint, setHint] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, flash] = useSaved()

  const edit = (i: number, patch: Partial<CompetencyInput>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function draft() {
    setDrafting(true)
    try {
      const res = await api.prof.draftCompetencies(a.id, hint)
      if (res.competencies.length) setRows(res.competencies.map(toCompetencyInput))
      notify('ok', 'AI 초안을 불러왔다. 검토하고 저장한다.')
    } catch (e) {
      notify('error', messageOf(e, '초안 실패'))
    } finally {
      setDrafting(false)
    }
  }

  // 서버에 저장된 값과 다른 곳. 바뀐 쪽만 저장하고, 다음 구역으로 갈 때 저장할지도 이것으로 정한다.
  const name = title.trim()
  const list = rows.filter((r) => !isBlank(r)).map(toCompetencyInput)
  const basicChanged = name !== a.title || subject.trim() !== a.subject
  const listChanged = JSON.stringify(list) !== JSON.stringify(a.competencies.map(toCompetencyInput))

  async function save(): Promise<boolean> {
    if (!name) {
      notify('error', '과제 이름을 입력한다.')
      return false
    }
    const unnamed = rows.findIndex((r) => !isBlank(r) && !r.name.trim())
    if (unnamed >= 0) {
      notify('error', `${SYMBOLS[unnamed]} 역량의 이름을 입력한다.`)
      return false
    }
    const badScore = rows.findIndex((r) => !isBlank(r) && !(Number.isInteger(r.pass_score) && r.pass_score >= 0 && r.pass_score <= 100))
    if (badScore >= 0) {
      notify('error', `${SYMBOLS[badScore]} 역량의 통과 점수는 0점에서 100점 사이로 정한다.`)
      return false
    }
    setSaving(true)
    try {
      if (basicChanged) setA(await api.prof.update(a.id, { title: name, subject: subject.trim() }))
      if (listChanged) {
        // 서버가 돌려준 역량으로 줄을 바꿔 새로 생긴 id 를 받아 둔다. 그래야 다음 저장에서 같은 역량으로 다룬다.
        const out = await api.prof.setCompetencies(a.id, list)
        setRows(out.length ? out.map(toCompetencyInput) : [emptyCompetency()])
        await reload()
      }
      notify('ok', '기본 정보와 역량을 저장했다.')
      flash()
      return true
    } catch (e) {
      notify('error', messageOf(e, '저장 실패'))
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Section title="기본 정보">
        <div className="form">
          <div className="form-row">
            <label className="label" htmlFor="a-title">
              과제 이름
            </label>
            <input id="a-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-row">
            <label className="label" htmlFor="a-course">
              과목
            </label>
            <input id="a-course" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>
      </Section>
      <Section
        title="역량"
        aside={
          <>
            <input className="input hint" value={hint} placeholder="AI 초안 힌트" aria-label="AI 초안 힌트" onChange={(e) => setHint(e.target.value)} />
            <button type="button" className="btn" onClick={() => void draft()} disabled={drafting}>
              {drafting ? '초안 작성 중' : 'AI 초안 요청'}
            </button>
            <button type="button" className="btn" onClick={() => setRows((rs) => (rs.length >= 6 ? rs : [...rs, emptyCompetency()]))} disabled={rows.length >= 6}>
              <Plus aria-hidden="true" />
              역량 추가
            </button>
          </>
        }
      >
        <div className="table-wrap">
          <table className="table comp-table">
            <thead>
              <tr>
                <th className="col-key">기호</th>
                <th className="col-name">역량</th>
                <th className="col-desc">설명</th>
                <th className="w-score">통과 점수</th>
                <th>채점 기준</th>
                <th className="col-del" aria-label="삭제" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="strong">{SYMBOLS[i]}</td>
                  <td className="cell-input">
                    <input className="input" value={r.name} maxLength={100} aria-label={`${SYMBOLS[i]} 역량 이름`} onChange={(e) => edit(i, { name: e.target.value })} />
                  </td>
                  <td className="cell-input">
                    <input className="input" value={r.description} aria-label={`${SYMBOLS[i]} 역량 설명`} onChange={(e) => edit(i, { description: e.target.value })} />
                  </td>
                  <td className="cell-input">
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      max={100}
                      value={r.pass_score}
                      aria-label={`${SYMBOLS[i]} 역량 통과 점수`}
                      onChange={(e) => edit(i, { pass_score: Number(e.target.value) })}
                    />
                  </td>
                  <td className="cell-input">
                    <textarea
                      className="textarea"
                      rows={2}
                      value={r.grading_criteria}
                      aria-label={`${SYMBOLS[i]} 역량 채점 기준`}
                      onChange={(e) => edit(i, { grading_criteria: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn icon quiet"
                      aria-label={`${SYMBOLS[i]} 역량 삭제`}
                      disabled={rows.length <= 1}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Foot section="competencies" onSave={save} dirty={basicChanged || listChanged} saved={saved} busy={saving} />
    </>
  )
}

// ---------- 구역 2. 사전 사후 평가 ----------
// 역량마다 문항 하나를 둔다. 역량 id 로 그 역량의 문항을 찾는다.
type Slots = Record<number, ItemInput>
type Sets = Record<Phase, Slots>

// 서버에 보내는 모양으로 맞춘다. 보기는 선택형에만 있고 빈 보기는 뺀다.
function toItemInput(q: ItemInput): ItemInput {
  return {
    competency_id: q.competency_id,
    type: q.type,
    stem: q.stem,
    options: q.type === 'choice' ? q.options.filter((o) => o.trim()) : [],
    answer: q.answer,
  }
}

function slotsOf(items: ItemInput[]): Slots {
  const out: Slots = {}
  for (const i of items) {
    if (!(i.competency_id in out)) out[i.competency_id] = { competency_id: i.competency_id, type: i.type, stem: i.stem, options: [...i.options], answer: i.answer }
  }
  return out
}

const serverSets = (a: Assignment): Sets => ({
  pre: slotsOf(a.items.filter((i) => i.phase === 'pre')),
  post: slotsOf(a.items.filter((i) => i.phase === 'post')),
})

// 정답 칸의 뜻이 같은 종류끼리는 종류를 바꿔도 정답을 남긴다.
const answerKind = (t: ItemType) => (t === 'choice' ? 'choice' : t === 'short' || t === 'fill' ? 'exact' : 'model')

// 서버의 저장 조건과 같은 검사. 어느 문항이 걸렸는지 알려 주려고 화면에서 먼저 본다.
function problemOf(q: ItemInput): string | null {
  if (!q.stem.trim()) return '문항 내용을 입력한다'
  if (q.type === 'choice') {
    const options = q.options.filter((o) => o.trim())
    if (options.length < 2) return '보기를 2개 이상 입력한다'
    if (!q.answer.trim() || !options.some((o) => o.trim() === q.answer.trim())) return '정답 보기를 고른다'
  }
  if ((q.type === 'short' || q.type === 'fill') && !q.answer.trim()) return '정답을 입력한다'
  return null
}

// 문항 종류마다 실제 문제가 어떻게 보이는지 작은 예시로 보여 준다.
function demo(type: ItemType): ReactNode {
  switch (type) {
    case 'choice':
      return (
        <>
          <p>기본키의 성질로 옳지 않은 것은</p>
          <span className="o">중복된 값을 가질 수 없다</span>
          <span className="o on">NULL 을 허용한다</span>
          <span className="o">행 하나를 식별한다</span>
        </>
      )
    case 'short':
      return (
        <>
          <p>일치하는 행만 돌려주는 JOIN 의 이름은</p>
          <span className="box">INNER JOIN</span>
        </>
      )
    case 'fill':
      return (
        <>
          <p>3학년을 고르는 문장을 완성하라</p>
          <code>
            FROM student
            <span className="gap" />
            grade = 3;
          </code>
        </>
      )
    case 'essay_short':
      return (
        <>
          <p>WHERE 와 HAVING 의 차이를 설명하라</p>
          <span className="box tall">WHERE 는 행을 거르고 HAVING 은 그룹을 거른다</span>
        </>
      )
    case 'essay_long':
      return (
        <>
          <p>조회문을 설계하고 이유를 설명하라</p>
          <span className="box taller">수강 과목이 없는 학생도 남겨야 해서 LEFT JOIN 으로 묶었다</span>
        </>
      )
  }
}

export function TestsSection({
  a,
  setA,
  reload,
  notify,
}: {
  a: Assignment
  setA: (a: Assignment) => void
  reload: () => Promise<void>
  notify: Notify
}) {
  const comps = a.competencies
  const [tab, setTab] = useState<Phase>('pre')
  const [sel, setSel] = useState(0)
  // 탭을 오가도 고친 문항이 남도록 두 시험의 문항을 함께 들고 있는다.
  const [sets, setSets] = useState<Sets>(() => serverSets(a))
  const [limits, setLimits] = useState<Record<Phase, number>>({ pre: a.pre_time_limit_min, post: a.post_time_limit_min })
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, flash] = useSaved()

  if (comps.length === 0) {
    return (
      <>
        <div className="note">
          역량을 먼저 저장해야 문항을 만들 수 있다.{' '}
          <Link className="link" to="../competencies" relative="path">
            역량 입력하기
          </Link>
        </div>
        <Foot section="tests" />
      </>
    )
  }

  // 역량별 채점 기준이 모두 있어야 AI 초안을 요청할 수 있다.
  const ready = comps.every((c) => c.grading_criteria.trim())
  const comp = comps[Math.min(sel, comps.length - 1)]
  const q: ItemInput | undefined = sets[tab][comp.id]
  const correct = q && q.answer.trim() ? q.options.findIndex((o) => o.trim() === q.answer.trim()) : -1

  const put = (item: ItemInput | null, cid = comp.id, on = tab) =>
    setSets((s) => {
      const next = { ...s[on] }
      if (item) next[cid] = item
      else delete next[cid]
      return { ...s, [on]: next }
    })

  const pick = (type: ItemType) =>
    put({
      competency_id: comp.id,
      type,
      stem: q?.stem ?? '',
      options: type === 'choice' ? (q?.type === 'choice' && q.options.length ? q.options : ['', '', '', '']) : [],
      answer: q && answerKind(q.type) === answerKind(type) ? q.answer : '',
    })

  // 서버는 모든 역량의 초안을 한 번에 만든다. 고른 역량의 문항은 초안으로 바꾸고, 나머지는 비어 있는 역량만 채운다.
  async function draft() {
    const on = tab
    const cid = comp.id
    setDrafting(true)
    try {
      const res = await api.prof.draftItems(a.id, on)
      const drafts = slotsOf(res.items)
      setSets((s) => {
        const next = { ...s[on] }
        for (const c of comps) {
          const d: ItemInput | undefined = drafts[c.id]
          if (d && (c.id === cid || !next[c.id])) next[c.id] = d
        }
        return { ...s, [on]: next }
      })
      notify('ok', `${PHASE_LABEL[on]} 문항 초안을 불러왔다. 검토하고 저장한다.`)
    } catch (e) {
      notify('error', messageOf(e, '초안 실패'))
    } finally {
      setDrafting(false)
    }
  }

  // 서버에 저장된 값과 다른 시험과 제한 시간. 다음 구역으로 갈 때 저장할지도 이것으로 정한다.
  const keyOf = (slots: Slots) =>
    JSON.stringify(
      comps.map((c) => {
        const item: ItemInput | undefined = slots[c.id]
        return item ? toItemInput(item) : null
      }),
    )
  const server = serverSets(a)
  const changed = PHASES.filter((p) => keyOf(sets[p]) !== keyOf(server[p]))
  const limitsChanged = limits.pre !== a.pre_time_limit_min || limits.post !== a.post_time_limit_min

  // 바뀐 시험만 저장한다. 서버는 응시한 학생이 있는 시험의 문항을 다시 받지 않으므로 손대지 않은 시험은 보내지 않는다.
  async function save(): Promise<boolean> {
    for (const p of changed) {
      for (let i = 0; i < comps.length; i += 1) {
        const item: ItemInput | undefined = sets[p][comps[i].id]
        const problem = item ? problemOf(item) : null
        if (problem) {
          setTab(p)
          setSel(i)
          notify('error', `${PHASE_LABEL[p]}의 ${comps[i].name} 문항에서 ${problem}.`)
          return false
        }
      }
    }
    if (limitsChanged) {
      for (const p of PHASES) {
        if (!(Number.isInteger(limits[p]) && limits[p] >= 1 && limits[p] <= 600)) {
          setTab(p)
          notify('error', `${PHASE_LABEL[p]} 제한 시간은 1분에서 600분 사이로 정한다.`)
          return false
        }
      }
    }
    setSaving(true)
    let latest: Assignment | null = null
    let itemsSaved = false
    let ok = false
    try {
      for (const p of changed) {
        const body = comps.flatMap((c) => {
          const item: ItemInput | undefined = sets[p][c.id]
          return item ? [toItemInput(item)] : []
        })
        try {
          await api.prof.setItems(a.id, p, body)
        } catch (e) {
          throw new Error(`${PHASE_LABEL[p]} 문항을 저장하지 못했다. ${messageOf(e, '')}`.trim())
        }
        itemsSaved = true
      }
      if (limitsChanged) latest = await api.prof.update(a.id, { pre_time_limit_min: limits.pre, post_time_limit_min: limits.post })
      notify('ok', '사전 사후 평가를 저장했다.')
      flash()
      ok = true
    } catch (e) {
      notify('error', messageOf(e, '저장 실패'))
    } finally {
      // 일부만 저장되고 멈췄더라도 저장된 만큼은 사이드바와 점검에 반영한다.
      if (latest) setA(latest)
      else if (itemsSaved) await reload()
      setSaving(false)
    }
    return ok
  }

  return (
    <>
      {!ready && (
        <div className="note setup-gap">
          채점 기준이 비어 있는 역량이 있어 AI 초안을 요청할 수 없다.{' '}
          <Link className="link" to="../competencies" relative="path">
            역량에서 고치기
          </Link>
        </div>
      )}

      <div className="tabs" role="tablist">
        {PHASES.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={tab === p} className={tab === p ? 'tab active' : 'tab'} onClick={() => setTab(p)}>
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>역량별 문항</h2>
      </div>
      <div className="slots fit" role="group" aria-label="역량별 문항" style={vars({ '--n': comps.length })}>
        {comps.map((c, i) => {
          const item: ItemInput | undefined = sets[tab][c.id]
          return (
            <button key={c.id} type="button" className="slot-btn" aria-pressed={comp.id === c.id} onClick={() => setSel(i)}>
              <b>
                {SYMBOLS[i]} {c.name}
              </b>
              <Status tone={item ? 'done' : 'todo'}>{item ? ITEM_TYPE_LABEL[item.type] : '문항 없음'}</Status>
            </button>
          )
        })}
      </div>

      <Section
        title="문항 종류"
        aside={
          <button type="button" className="btn" onClick={() => void draft()} disabled={!ready || drafting}>
            {drafting ? '초안 작성 중' : 'AI 초안 요청'}
          </button>
        }
      >
        <div className="types" role="group" aria-label="문항 종류">
          {ITEM_TYPES.map((t) => (
            <button key={t} type="button" className="type" aria-pressed={q?.type === t} onClick={() => pick(t)}>
              <div className="demo" aria-hidden="true">
                {demo(t)}
              </div>
              <div className="cap">
                <b>{ITEM_TYPE_LABEL[t]}</b>
                <span>{GRADING[t]}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {q && (
        <div className="editor" key={`${tab}${comp.id}${q.type}`}>
          <div className="form">
            <div className="form-row">
              <label className="label" htmlFor="q-stem">
                문항
              </label>
              <textarea id="q-stem" className="textarea" rows={2} value={q.stem} onChange={(e) => put({ ...q, stem: e.target.value })} />
            </div>

            {q.type === 'choice' && (
              <div className="form-row">
                <span className="label">보기와 정답</span>
                <div>
                  <div className="opts" role="radiogroup" aria-label="정답 보기">
                    {q.options.map((o, i) => {
                      const on = i === correct
                      return (
                        <label key={i} className={on ? 'opt on' : 'opt'}>
                          <input type="radio" name="correct" checked={on} disabled={!o.trim()} onChange={() => put({ ...q, answer: o })} aria-label={`보기 ${i + 1} 을 정답으로`} />
                          <span className="radio" />
                          <input
                            className="input bare"
                            value={o}
                            placeholder={`보기 ${i + 1}`}
                            aria-label={`보기 ${i + 1}`}
                            onChange={(e) => put({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)), answer: on ? e.target.value : q.answer })}
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              className="btn icon quiet"
                              aria-label={`보기 ${i + 1} 삭제`}
                              onClick={() => put({ ...q, options: q.options.filter((_, j) => j !== i), answer: on ? '' : q.answer })}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          )}
                        </label>
                      )
                    })}
                  </div>
                  <button type="button" className="btn quiet after-rows" onClick={() => put({ ...q, options: [...q.options, ''] })}>
                    <Plus aria-hidden="true" />
                    보기 추가
                  </button>
                </div>
              </div>
            )}

            {(q.type === 'short' || q.type === 'fill') && (
              <div className="form-row">
                <label className="label" htmlFor="q-answer">
                  정답
                </label>
                <input id="q-answer" className="input" value={q.answer} placeholder="허용할 다른 표현은 | 로 구분한다" onChange={(e) => put({ ...q, answer: e.target.value })} />
              </div>
            )}

            {(q.type === 'essay_short' || q.type === 'essay_long') && (
              <>
                <div className="form-row">
                  <label className="label" htmlFor="q-answer">
                    모범 답안 요지
                  </label>
                  <textarea id="q-answer" className="textarea" rows={2} value={q.answer} onChange={(e) => put({ ...q, answer: e.target.value })} />
                </div>
                <div className="form-row">
                  <span className="label">채점 기준</span>
                  <div className="plain">
                    {comp.grading_criteria.trim() || '채점 기준이 비어 있다'}{' '}
                    <Link className="link" to="../competencies" relative="path">
                      역량에서 고치기
                    </Link>
                  </div>
                </div>
              </>
            )}

            <div className="form-row">
              <span className="label">채점 방식</span>
              <div className="plain">{GRADING[q.type]}</div>
            </div>
          </div>
          <div className="editor-foot">
            <button type="button" className="btn" onClick={() => put(null)}>
              문항 비우기
            </button>
          </div>
        </div>
      )}

      <Section title="시험 설정">
        <div className="form">
          <div className="form-row">
            <label className="label" htmlFor="limit">
              제한 시간
            </label>
            <div className="inline">
              <input
                id="limit"
                className="input num w-score"
                type="number"
                min={1}
                max={600}
                value={limits[tab]}
                onChange={(e) => setLimits((l) => ({ ...l, [tab]: Number(e.target.value) }))}
              />
              <span>분</span>
            </div>
          </div>
          <div className="form-row">
            <span className="label">응시 횟수</span>
            <div className="plain">1회</div>
          </div>
        </div>
      </Section>
      <Foot section="tests" onSave={save} dirty={changed.length > 0 || limitsChanged} saved={saved} busy={saving} />
    </>
  )
}

// ---------- 구역 3. 과제 문제 ----------
export function TaskProblemSection({ a, onSaved, notify }: { a: Assignment; onSaved: (a: Assignment) => void; notify: Notify }) {
  const [taskKind, setTaskKind] = useState(a.task_kind)
  const [description, setDescription] = useState(a.description)
  // 마감은 날짜와 시각으로 나누어 받는다. 날짜가 비어 있으면 마감이 없는 것이다.
  const [date, setDate] = useState(() => toLocalInput(a.deadline).slice(0, 10))
  const [time, setTime] = useState(() => toLocalInput(a.deadline).slice(11))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saved, flash] = useSaved()

  // 서버에 저장된 값과 다른지 본다. 마감은 화면에 보이는 분 단위까지만 견준다.
  const stored = toLocalInput(a.deadline)
  const dirty =
    taskKind !== a.task_kind || description !== a.description || date !== stored.slice(0, 10) || (date !== '' && (time || '23:59') !== stored.slice(11))

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      onSaved(
        await api.prof.update(a.id, {
          task_kind: taskKind,
          description,
          deadline: date ? new Date(`${date}T${time || '23:59'}`).toISOString() : null,
          clear_deadline: !date,
        }),
      )
      notify('ok', '과제 문제를 저장했다.')
      flash()
      return true
    } catch (e) {
      notify('error', messageOf(e, '저장 실패'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function upload(file: File) {
    setUploading(true)
    try {
      onSaved(await api.prof.uploadAttachment(a.id, file))
      notify('ok', '과제 첨부 파일을 올렸다.')
    } catch (e) {
      notify('error', messageOf(e, '업로드 실패'))
    } finally {
      setUploading(false)
    }
  }

  async function download() {
    setDownloading(true)
    try {
      const url = await fetchBlobUrl(`/api/assignments/${a.id}/attachment`)
      const link = document.createElement('a')
      link.href = url
      link.download = a.attachment_name || 'file'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      notify('error', messageOf(e, '내려받기 실패'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="form">
        <div className="form-row">
          <label className="label" htmlFor="t-kind">
            문제 종류
          </label>
          <select id="t-kind" className="select" value={taskKind} onChange={(e) => setTaskKind(e.target.value as Assignment['task_kind'])}>
            <option value="performance">수행형, 도구로 결과물을 만든다</option>
            <option value="essay">논술형, 긴 글을 쓴다</option>
          </select>
        </div>
        <div className="form-row">
          <label className="label" htmlFor="t-desc">
            과제 설명
          </label>
          <textarea id="t-desc" className="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-row">
          <span className="label">마감</span>
          <div className="inline">
            <input
              className="input w-date"
              type="date"
              value={date}
              aria-label="마감 날짜"
              onChange={(e) => {
                setDate(e.target.value)
                if (e.target.value && !time) setTime('23:59')
              }}
            />
            <input className="input w-time" type="time" value={time} aria-label="마감 시각" onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <span className="label">재제출</span>
          <div className="plain">마감까지 허용</div>
        </div>
        <div className="form-row">
          <span className="label">과제 첨부 파일</span>
          <div>
            {a.attachment_name && (
              <div className="rows">
                <div className="row">
                  <Paperclip aria-hidden="true" />
                  <span className="grow">{a.attachment_name}</span>
                  <span className="end">
                    <button type="button" className="btn" onClick={() => void download()} disabled={downloading}>
                      <Download aria-hidden="true" />
                      내려받기
                    </button>
                  </span>
                </div>
              </div>
            )}
            <FileDrop
              text={a.attachment_name ? '다른 파일을 끌어다 놓거나 눌러서 바꾼다' : '파일을 끌어다 놓거나 눌러서 올린다'}
              label="과제 첨부 파일 올리기"
              busy={uploading}
              onFiles={(files) => void upload(files[0])}
            />
          </div>
        </div>
      </div>
      <Foot section="task" onSave={save} dirty={dirty} saved={saved} busy={saving} />
    </>
  )
}

// ---------- 구역 4. 학습 자료 ----------
const CODE_EXT = new Set(['SQL', 'PY', 'JS', 'TS', 'JSX', 'TSX', 'JAVA', 'C', 'CPP', 'H', 'CS', 'GO', 'RS', 'KT', 'RB', 'PHP', 'SH', 'HTML', 'CSS', 'JSON', 'XML', 'YAML', 'YML'])

function extOf(name: string): string {
  const at = name.lastIndexOf('.')
  return at > 0 ? name.slice(at + 1).toUpperCase() : ''
}

function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

function MaterialIcon({ m }: { m: Material }) {
  if (m.mime.startsWith('image/')) return <ImageIcon aria-hidden="true" />
  if (CODE_EXT.has(extOf(m.filename))) return <FileCode2 aria-hidden="true" />
  return <FileText aria-hidden="true" />
}

export function MaterialsSection({ a, onSaved, notify }: { a: Assignment; onSaved: () => Promise<void>; notify: Notify }) {
  const [busy, setBusy] = useState(false)

  // 고른 파일을 차례로 올린다. 올리는 대로 바로 저장되므로 저장 버튼이 따로 없다.
  async function upload(files: File[]) {
    setBusy(true)
    let done = 0
    try {
      for (const file of files) {
        try {
          await api.prof.uploadMaterial(a.id, file)
        } catch (e) {
          throw new Error(`${file.name} 파일을 올리지 못했다. ${messageOf(e, '')}`.trim())
        }
        done += 1
      }
      notify('ok', done > 1 ? `학습 자료 ${done}개를 올렸다.` : '학습 자료를 올렸다.')
    } catch (e) {
      notify('error', messageOf(e, '업로드 실패'))
    } finally {
      if (done) await onSaved()
      setBusy(false)
    }
  }

  async function remove(mid: number) {
    try {
      await api.prof.deleteMaterial(a.id, mid)
      await onSaved()
    } catch (e) {
      notify('error', messageOf(e, '삭제 실패'))
    }
  }

  return (
    <>
      <div className="rows">
        {a.materials.map((m) => (
          <div className="row" key={m.id}>
            <MaterialIcon m={m} />
            <span className="mono soft ext">{extOf(m.filename)}</span>
            <span className="grow">{m.filename}</span>
            <span className="end">
              <Status tone={m.has_text ? 'done' : 'todo'}>{m.has_text ? '텍스트 추출됨' : '이름만 참고'}</Status>
              {sizeText(m.size)}
              <button type="button" className="btn icon quiet" aria-label={`${m.filename} 삭제`} onClick={() => void remove(m.id)}>
                <Trash2 aria-hidden="true" />
              </button>
            </span>
          </div>
        ))}
        {a.materials.length === 0 && <div className="empty">자료가 없으면 AI는 일반 지식으로 답한다</div>}
      </div>
      <FileDrop text="PDF, 텍스트, 코드, 이미지를 끌어다 놓거나 눌러서 올린다" label="학습 자료 올리기" multiple busy={busy} onFiles={(files) => void upload(files)} />
      <Foot section="materials" />
    </>
  )
}

// ---------- 구역 5. AI 응답 규칙 ----------
// 규칙 대상. 값, 버튼에 쓰는 이름, 버튼에 올렸을 때 보이는 풀이 순이다.
const RULE_TARGETS: [RuleTarget, string, string][] = [
  ['ai', 'AI', 'AI가 따른다'],
  ['student', '학생', '학생 화면에 안내로 보인다'],
  ['both', '둘 다', 'AI가 따르고 학생 화면에도 보인다'],
]

type RuleRow = { target: RuleTarget; text: string }

export function RulesSection({ a, onSaved, notify }: { a: Assignment; onSaved: () => Promise<void>; notify: Notify }) {
  const [rows, setRows] = useState<RuleRow[]>(a.rules.map((r) => ({ target: r.target, text: r.text })))
  const [saving, setSaving] = useState(false)
  const [saved, flash] = useSaved()

  const edit = (i: number, patch: Partial<RuleRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  // 내용이 빈 규칙은 없는 것으로 본다. 저장할 때도 보내지 않는다.
  const kept = rows.filter((r) => r.text.trim())
  const dirty = JSON.stringify(kept) !== JSON.stringify(a.rules.map((r) => ({ target: r.target, text: r.text })))

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      // 저장된 규칙으로 줄을 다시 맞춘다.
      const out = await api.prof.setRules(a.id, kept)
      setRows(out.map((r) => ({ target: r.target, text: r.text })))
      await onSaved()
      notify('ok', 'AI 응답 규칙을 저장했다.')
      flash()
      return true
    } catch (e) {
      notify('error', messageOf(e, '저장 실패'))
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="rows">
        {rows.map((r, i) => (
          <div className="row" key={i}>
            <div className="seg" role="group" aria-label="규칙 대상">
              {RULE_TARGETS.map(([value, label, tip]) => (
                <button key={value} type="button" title={tip} aria-pressed={r.target === value} onClick={() => edit(i, { target: value })}>
                  {label}
                </button>
              ))}
            </div>
            <input className="input grow" value={r.text} placeholder="규칙 내용" aria-label="규칙 내용" onChange={(e) => edit(i, { text: e.target.value })} />
            <button type="button" className="btn icon quiet" aria-label="규칙 삭제" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
        {rows.length === 0 && <div className="empty">아직 규칙이 없다</div>}
      </div>
      <button type="button" className="btn after-rows" onClick={() => setRows((rs) => [...rs, { target: 'ai', text: '' }])}>
        <Plus aria-hidden="true" />
        규칙 추가
      </button>
      <Foot section="rules" onSave={save} dirty={dirty} saved={saved} busy={saving} />
    </>
  )
}

// ---------- 구역 6. 도구 연동. 과제 단계의 작업공간에 줄 시작 파일, 채점 테스트, 실행 환경을 정한다. ----------
type FileRow = { path: string; content: string; readonly: boolean }
type CaseRow = { name: string; stdin: string; expected: string }

const ENV_STATE: Record<string, [string, 'done' | 'doing' | 'todo' | 'alert']> = {
  ready: ['준비됨', 'done'],
  building: ['만드는 중', 'doing'],
  failed: ['만들기 실패', 'alert'],
  none: ['아직 만들지 않음', 'todo'],
  missing: ['이미지 없음', 'todo'],
}

const words = (text: string) => text.split(/[\s,]+/).filter(Boolean)

// 서버에 저장된 설정을 입력 줄로 바꾼다.
const fileRows = (files: Partial<FileRow>[] = []): FileRow[] => files.map((f) => ({ path: f.path ?? '', content: f.content ?? '', readonly: Boolean(f.readonly) }))
const caseRows = (tests: Partial<CaseRow>[] = []): CaseRow[] => tests.map((t) => ({ name: t.name ?? '', stdin: t.stdin ?? '', expected: t.expected ?? '' }))
// 서버에 보내는 모양. 이름이 없는 파일과 이름도 기대 출력도 없는 테스트는 뺀다.
const keptFiles = (files: FileRow[]) => files.filter((f) => f.path.trim()).map((f) => ({ path: f.path.trim(), content: f.content, readonly: f.readonly }))
const keptCases = (cases: CaseRow[]) => cases.filter((c) => c.name.trim() || c.expected.trim())
const specKey = (x: EnvSpec | null) => (x ? JSON.stringify([x.preset, x.name, x.required, x.apt, x.pip, x.cflags]) : '')

export function ToolSection({ a, onSaved, notify }: { a: Assignment; onSaved: (a: Assignment) => void; notify: Notify }) {
  const cfg = a.tool_config as { files?: Partial<FileRow>[]; tests?: Partial<CaseRow>[] }
  const [files, setFiles] = useState<FileRow[]>(() => fileRows(cfg.files))
  const [open, setOpen] = useState(0)
  const [cases, setCases] = useState<CaseRow[]>(() => caseRows(cfg.tests))
  const [env, setEnv] = useState<AssignmentEnv | null>(null)
  const [useEnv, setUseEnv] = useState(false)
  const [preset, setPreset] = useState('ubuntu-22.04')
  const [envName, setEnvName] = useState('')
  const [required, setRequired] = useState(false)
  const [apt, setApt] = useState('')
  const [pip, setPip] = useState('')
  const [cflags, setCflags] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, flash] = useSaved()

  // 서버에 저장된 환경으로 입력 칸을 맞춘다
  const fill = useCallback((e: AssignmentEnv) => {
    setEnv(e)
    setUseEnv(e.spec !== null)
    if (e.spec) {
      setPreset(e.spec.preset)
      setEnvName(e.spec.name)
      setRequired(e.spec.required)
      setApt(e.spec.apt.join(' '))
      setPip(e.spec.pip.join(' '))
      setCflags(e.spec.cflags)
    }
  }, [])

  useEffect(() => {
    api.prof
      .envGet(a.id)
      .then(fill)
      .catch((e: unknown) => notify('error', messageOf(e, '실행 환경을 불러오지 못했다')))
  }, [a.id, fill, notify])

  // 이미지를 만드는 동안에는 상태만 다시 읽는다
  const building = env?.environment?.status === 'building'
  useEffect(() => {
    if (!building) return
    const t = setInterval(() => {
      api.prof
        .envGet(a.id)
        .then(setEnv)
        .catch(() => {})
    }, 4000)
    return () => clearInterval(t)
  }, [building, a.id])

  const editFile = (i: number, patch: Partial<FileRow>) => setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const editCase = (i: number, patch: Partial<CaseRow>) => setCases((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  // 서버에 저장된 값과 다른지 본다. 환경은 서버에서 받아 온 뒤에만 견준다.
  const kept = keptFiles(files)
  const spec: EnvSpec | null = useEnv ? { preset, name: envName.trim(), required, apt: words(apt), pip: words(pip), cflags: cflags.trim() } : null
  const dirty =
    JSON.stringify(kept) !== JSON.stringify(keptFiles(fileRows(cfg.files))) ||
    JSON.stringify(keptCases(cases)) !== JSON.stringify(keptCases(caseRows(cfg.tests))) ||
    (env !== null && specKey(spec) !== specKey(env.spec))

  async function save(): Promise<boolean> {
    const paths = kept.map((f) => f.path)
    if (kept.length === 0) {
      notify('error', '시작 파일이 하나 이상 있어야 한다.')
      return false
    }
    if (new Set(paths).size !== paths.length) {
      notify('error', '같은 이름의 파일이 있다.')
      return false
    }
    setSaving(true)
    try {
      // 파일과 테스트를 먼저 저장하고 환경은 서버가 검사하는 전용 주소로 보낸다. 환경을 저장하면 서버가 이미지를 만들기 시작한다
      await api.prof.update(a.id, {
        tool_slot: 4,
        tool_name: 'workspace',
        tool_config: { ...a.tool_config, files: kept, tests: keptCases(cases) },
      })
      fill(await api.prof.envSet(a.id, spec ?? {}))
      onSaved(await api.prof.get(a.id))
      notify('ok', '도구 연동을 저장했다.')
      flash()
      return true
    } catch (e) {
      notify('error', messageOf(e, '저장 실패'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const shown = files[open]
  const p = env?.presets[preset]
  const state = env?.environment ? ENV_STATE[env.environment.status] : null

  return (
    <>
      <Section title="시작 파일">
        <div className="rows">
          {files.map((f, i) => (
            <div className="row" key={i}>
              <button type="button" className="btn icon quiet" aria-label={`${f.path || '새 파일'} 내용 열기`} aria-pressed={open === i} onClick={() => setOpen(i)}>
                {f.path.endsWith('.docx') ? <FileText aria-hidden="true" /> : <FileCode2 aria-hidden="true" />}
              </button>
              <input
                className="input grow mono"
                value={f.path}
                placeholder="main.py"
                aria-label="파일 이름"
                onFocus={() => setOpen(i)}
                onChange={(e) => editFile(i, { path: e.target.value })}
              />
              <div className="seg" role="group" aria-label="학생 수정 여부">
                <button type="button" aria-pressed={!f.readonly} onClick={() => editFile(i, { readonly: false })}>
                  학생이 수정
                </button>
                <button type="button" aria-pressed={f.readonly} onClick={() => editFile(i, { readonly: true })}>
                  읽기 전용
                </button>
              </div>
              <button
                type="button"
                className="btn icon quiet"
                aria-label="파일 삭제"
                onClick={() => {
                  setFiles((fs) => fs.filter((_, j) => j !== i))
                  setOpen(0)
                }}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
          {files.length === 0 && <div className="empty">아직 파일이 없다</div>}
        </div>
        <button
          type="button"
          className="btn after-rows"
          onClick={() => {
            setFiles((fs) => [...fs, { path: '', content: '', readonly: false }])
            setOpen(files.length)
          }}
        >
          <Plus aria-hidden="true" />
          파일 추가
        </button>
        {shown && (
          <div className="form setup-gap">
            <div className="form-row">
              <label className="label" htmlFor="tool-file">
                {shown.path || '새 파일'}
              </label>
              <textarea
                id="tool-file"
                className="textarea mono"
                rows={12}
                spellCheck={false}
                value={shown.content}
                placeholder={shown.path.endsWith('.docx') ? '보고서의 목차를 한 줄에 하나씩 적는다' : '학생이 처음 받는 내용'}
                onChange={(e) => editFile(open, { content: e.target.value })}
              />
            </div>
          </div>
        )}
      </Section>

      <Section title="채점 테스트">
        <div className="rows">
          {cases.map((c, i) => (
            <div className="row" key={i}>
              <input className="input" value={c.name} placeholder="테스트 이름" aria-label="테스트 이름" onChange={(e) => editCase(i, { name: e.target.value })} />
              <input className="input grow mono" value={c.stdin} placeholder="입력" aria-label="입력" onChange={(e) => editCase(i, { stdin: e.target.value })} />
              <input
                className="input grow mono"
                value={c.expected}
                placeholder="기대 출력"
                aria-label="기대 출력"
                onChange={(e) => editCase(i, { expected: e.target.value })}
              />
              <button type="button" className="btn icon quiet" aria-label="테스트 삭제" onClick={() => setCases((cs) => cs.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
          {cases.length === 0 && <div className="empty">아직 테스트가 없다</div>}
        </div>
        <button type="button" className="btn after-rows" onClick={() => setCases((cs) => [...cs, { name: '', stdin: '', expected: '' }])}>
          <Plus aria-hidden="true" />
          테스트 추가
        </button>
      </Section>

      <Section title="실행 환경">
        <div className="form">
          <div className="form-row">
            <span className="label">환경</span>
            <div className="seg" role="group" aria-label="실행 환경 종류">
              <button type="button" aria-pressed={!useEnv} onClick={() => setUseEnv(false)}>
                서비스 기본 환경
              </button>
              <button type="button" aria-pressed={useEnv} onClick={() => setUseEnv(true)}>
                운영체제 지정
              </button>
            </div>
          </div>
          {useEnv && (
            <>
              <div className="form-row">
                <label className="label" htmlFor="env-os">
                  운영체제
                </label>
                <select id="env-os" className="select" value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {Object.entries(env?.presets ?? {}).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.os}
                    </option>
                  ))}
                </select>
              </div>
              {p && (
                <div className="form-row">
                  <span className="label">기본 도구</span>
                  <div className="plain">{[p.python, p.cpp, p.java].join(', ')}</div>
                </div>
              )}
              <div className="form-row">
                <label className="label" htmlFor="env-name">
                  환경 이름
                </label>
                <input id="env-name" className="input" value={envName} placeholder="운영체제 과제 채점 환경" onChange={(e) => setEnvName(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="label" htmlFor="env-apt">
                  apt 패키지
                </label>
                <input id="env-apt" className="input mono" value={apt} placeholder="valgrind gdb" onChange={(e) => setApt(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="label" htmlFor="env-pip">
                  pip 패키지
                </label>
                <input id="env-pip" className="input mono" value={pip} placeholder="numpy pandas" onChange={(e) => setPip(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="label" htmlFor="env-flags">
                  C++ 컴파일 옵션
                </label>
                <input id="env-flags" className="input mono" value={cflags} placeholder="-std=c++17 -O2 -Wall" onChange={(e) => setCflags(e.target.value)} />
              </div>
              <div className="form-row">
                <span className="label">학생 선택</span>
                <div className="seg" role="group" aria-label="학생이 환경을 고를 수 있는지">
                  <button type="button" aria-pressed={!required} onClick={() => setRequired(false)}>
                    기본 환경도 허용
                  </button>
                  <button type="button" aria-pressed={required} onClick={() => setRequired(true)}>
                    이 환경만 사용
                  </button>
                </div>
              </div>
              {state && (
                <div className="form-row">
                  <span className="label">이미지</span>
                  <div className="plain">
                    <Status tone={state[1]}>{state[0]}</Status>
                  </div>
                </div>
              )}
              {env?.environment?.status === 'failed' && env.environment.log && (
                <div className="form-row">
                  <span className="label">만들기 기록</span>
                  <textarea className="textarea mono" rows={6} readOnly value={env.environment.log} aria-label="이미지 만들기 기록" />
                </div>
              )}
            </>
          )}
        </div>
      </Section>
      <Foot section="tools" onSave={save} dirty={dirty} saved={saved} busy={saving} />
    </>
  )
}
