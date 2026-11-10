import { useEffect, useState } from 'react'

import {
  api,
  ITEM_TYPE_LABEL,
  toLocalInput,
  type Assignment,
  type CompetencyInput,
  type ItemInput,
  type ItemType,
  type Phase,
  type RuleTarget,
} from '../../api'
import { DownloadButton } from '../../components/Files'

export type Notify = (kind: 'ok' | 'error', text: string) => void

const ITEM_TYPES: ItemType[] = ['choice', 'short', 'fill', 'essay_short', 'essay_long']

export const TOOL_OPTIONS: Record<number, { value: string; label: string }[]> = {
  0: [{ value: 'editor', label: '페이지 안 문서 편집기, 논술형 과제' }],
  1: [{ value: 'sql', label: 'Monaco 편집기와 sql.js, SQL 조회문 과제' }],
  2: [{ value: 'google_docs', label: 'Google 문서, API로 수정 이력을 받는다' }],
  3: [{ value: 'companion', label: '설치된 프로그램, 보조 프로그램이 창 캡처와 폴더 감시를 한다' }],
}

export function BasicSection({ a, onSaved, notify }: { a: Assignment; onSaved: (a: Assignment) => void; notify: Notify }) {
  const [title, setTitle] = useState(a.title)
  const [subject, setSubject] = useState(a.subject)
  const [taskKind, setTaskKind] = useState(a.task_kind)
  const [pre, setPre] = useState(a.pre_time_limit_min)
  const [post, setPost] = useState(a.post_time_limit_min)
  async function save() {
    try {
      onSaved(
        await api.prof.update(a.id, {
          title,
          subject,
          task_kind: taskKind,
          pre_time_limit_min: pre,
          post_time_limit_min: post,
        }),
      )
      notify('ok', '기본 정보를 저장했다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card" id="sec1">
      <div className="card-title">
        <h2>1. 기본 정보</h2>
        <button className="btn btn-sm" onClick={() => void save()}>
          저장
        </button>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>과목</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label>과제 종류</label>
          <select value={taskKind} onChange={(e) => setTaskKind(e.target.value as 'performance' | 'essay')}>
            <option value="performance">수행형, 도구로 결과물을 만든다</option>
            <option value="essay">논술형, 긴 글을 쓴다</option>
          </select>
        </div>
        <div className="row">
          <div className="field">
            <label>사전평가 제한 시간, 분</label>
            <input type="number" min={1} value={pre} onChange={(e) => setPre(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>사후평가 제한 시간, 분</label>
            <input type="number" min={1} value={post} onChange={(e) => setPost(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  )
}

function emptyCompetency(): CompetencyInput {
  return { name: '', description: '', pass_score: 60, grading_criteria: '' }
}

export function CompetencySection({ a, onSaved, notify }: { a: Assignment; onSaved: () => void; notify: Notify }) {
  const [rows, setRows] = useState<CompetencyInput[]>(
    a.competencies.length ? a.competencies.map((c) => ({ ...c })) : [emptyCompetency()],
  )
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (a.competencies.length) setRows(a.competencies.map((c) => ({ ...c })))
  }, [a.competencies])

  function update(i: number, patch: Partial<CompetencyInput>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  async function draft() {
    setBusy(true)
    try {
      const res = await api.prof.draftCompetencies(a.id, hint)
      setRows(res.competencies)
      notify('ok', 'AI 초안을 불러왔다. 검토하고 저장한다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '초안 실패')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    try {
      await api.prof.setCompetencies(a.id, rows)
      onSaved()
      notify('ok', '역량과 채점 기준을 저장했다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card">
      <div className="card-title">
        <div>
          <h2>역량과 역량별 통과 점수와 채점 기준</h2>
          <p className="muted small">
            역량은 3개에서 6개로 두고 역량마다 통과 점수와 자연어 채점 기준을 쓴다. 채점 기준은 그 역량에 대응하는 사전 사후 문항과
            학습 중 확인 문항을 AI가 채점할 때 판정 기준이 된다. 역량을 먼저 저장해야 문항을 만들 수 있다.
          </p>
        </div>
        <div className="row">
          <input placeholder="AI 초안 힌트, 선택" value={hint} onChange={(e) => setHint(e.target.value)} style={{ width: 220 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => void draft()} disabled={busy}>
            AI 초안 요청
          </button>
          <button className="btn btn-sm" onClick={() => void save()}>
            저장
          </button>
        </div>
      </div>
      {rows.map((r, i) => (
        <div className="version" key={i}>
          <div className="row">
            <input placeholder="역량 이름" value={r.name} onChange={(e) => update(i, { name: e.target.value })} style={{ maxWidth: 240 }} />
            <input placeholder="한 문장 설명" value={r.description} onChange={(e) => update(i, { description: e.target.value })} style={{ flex: 1 }} />
            <label style={{ margin: 0 }}>통과 점수</label>
            <input
              type="number"
              min={0}
              max={100}
              value={r.pass_score}
              onChange={(e) => update(i, { pass_score: Number(e.target.value) })}
              style={{ width: 80 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} disabled={rows.length <= 1}>
              삭제
            </button>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>채점 기준, 자연어</label>
            <textarea
              value={r.grading_criteria}
              onChange={(e) => update(i, { grading_criteria: e.target.value })}
              placeholder="예: 조인 조건을 기본 키와 외래 키로 설명하면 만점, 조인 종류만 나열하면 50점 이하"
            />
          </div>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setRows([...rows, emptyCompetency()])} disabled={rows.length >= 6}>
        역량 추가
      </button>
    </div>
  )
}

export function ItemsSection({ a, phase, onSaved, notify }: { a: Assignment; phase: Phase; onSaved: () => void; notify: Notify }) {
  const label = phase === 'pre' ? '사전평가' : '사후평가'
  const existing = a.items.filter((i) => i.phase === phase)
  const [rows, setRows] = useState<ItemInput[]>(existing.map((i) => ({ ...i })))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setRows(a.items.filter((i) => i.phase === phase).map((i) => ({ ...i })))
  }, [a.items, phase])
  const ready = a.competencies.length > 0 && a.competencies.every((c) => c.grading_criteria.trim())

  function update(i: number, patch: Partial<ItemInput>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function blank() {
    setRows(a.competencies.map((c) => ({ competency_id: c.id, type: 'short', stem: '', options: [], answer: '' })))
  }
  async function draft() {
    setBusy(true)
    try {
      const res = await api.prof.draftItems(a.id, phase)
      setRows(res.items)
      notify('ok', `${label} 문항 초안을 불러왔다. 검토하고 저장한다.`)
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '초안 실패')
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    try {
      await api.prof.setItems(a.id, phase, rows)
      onSaved()
      notify('ok', `${label} 문항을 저장했다.`)
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card" id={phase === 'pre' ? 'sec2' : undefined}>
      <div className="card-title">
        <div>
          <h2>2. {label} 문항</h2>
          <p className="muted small">
            역량마다 문항 하나, 한 문항은 한 역량에만 대응한다. 종류는 선택형, 단답형, 완성형, 서술형, 논술형이고 수행형은 넣지 않는다.
            {phase === 'post' && ' 사후평가는 사전평가와 같은 역량을 다른 문항으로 잰다.'}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={blank} disabled={!a.competencies.length}>
            역량마다 빈 문항
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => void draft()} disabled={!ready || busy}>
            AI 초안 요청
          </button>
          <button className="btn btn-sm" onClick={() => void save()} disabled={!a.competencies.length}>
            저장
          </button>
        </div>
      </div>
      {!ready && <p className="warn small">역량과 역량별 채점 기준을 먼저 저장해야 이 구역이 열린다.</p>}
      {rows.map((r, i) => (
        <div className="version" key={i}>
          <div className="row">
            <select value={r.competency_id} onChange={(e) => update(i, { competency_id: Number(e.target.value) })} style={{ width: 200 }}>
              {a.competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={r.type} onChange={(e) => update(i, { type: e.target.value as ItemType })} style={{ width: 130 }}>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ITEM_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
              삭제
            </button>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>문항</label>
            <textarea value={r.stem} onChange={(e) => update(i, { stem: e.target.value })} />
          </div>
          {r.type === 'choice' && (
            <div className="field">
              <label>보기, 한 줄에 하나</label>
              <textarea value={r.options.join('\n')} onChange={(e) => update(i, { options: e.target.value.split('\n').filter((s) => s.trim()) })} />
            </div>
          )}
          <div className="field">
            <label>
              {r.type === 'choice'
                ? '정답 보기의 내용'
                : r.type === 'short' || r.type === 'fill'
                  ? '정답, 허용할 다른 표현은 | 로 구분'
                  : '모범 답안 요지, AI 채점 참고'}
            </label>
            <input value={r.answer} onChange={(e) => update(i, { answer: e.target.value })} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TaskProblemSection({ a, onSaved, notify }: { a: Assignment; onSaved: (a: Assignment) => void; notify: Notify }) {
  const [description, setDescription] = useState(a.description)
  const [deadline, setDeadline] = useState(toLocalInput(a.deadline))
  async function save() {
    try {
      onSaved(
        await api.prof.update(a.id, {
          description,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          clear_deadline: !deadline,
        }),
      )
      notify('ok', '과제 문제를 저장했다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return
    try {
      onSaved(await api.prof.uploadAttachment(a.id, file))
      notify('ok', '과제 첨부 파일을 올렸다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '업로드 실패')
    }
  }
  return (
    <div className="card" id="sec3">
      <div className="card-title">
        <div>
          <h2>3. 과제 문제</h2>
          <p className="muted small">학생이 과제 단계에서 보는 설명과 첨부 파일, 그리고 마감이다. 마감까지 재제출할 수 있고 마감 뒤에는 수정할 수 없다.</p>
        </div>
        <button className="btn btn-sm" onClick={() => void save()}>
          저장
        </button>
      </div>
      <div className="field">
        <label>과제 설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 140 }} />
      </div>
      <div className="row">
        <div className="field">
          <label>마감</label>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="field">
          <label>과제 첨부 파일</label>
          <input type="file" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
        {a.attachment_name && (
          <DownloadButton path={`/api/assignments/${a.id}/attachment`} filename={a.attachment_name} label={`현재 첨부: ${a.attachment_name}`} />
        )}
      </div>
    </div>
  )
}

export function MaterialsSection({ a, onSaved, notify }: { a: Assignment; onSaved: () => void; notify: Notify }) {
  const [busy, setBusy] = useState(false)
  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      await api.prof.uploadMaterial(a.id, file)
      onSaved()
      notify('ok', '학습 자료를 올렸다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setBusy(false)
    }
  }
  async function remove(mid: number) {
    try {
      await api.prof.deleteMaterial(a.id, mid)
      onSaved()
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '삭제 실패')
    }
  }
  return (
    <div className="card" id="sec4">
      <div className="card-title">
        <div>
          <h2>4. 학습 자료</h2>
          <p className="muted small">
            AI는 이 자료를 근거로 질문과 설명을 만들고 채점에서도 내용 근거로 삼는다. PDF, 텍스트, 코드, 이미지를 받는다. 자료가 없으면 AI는
            일반 지식으로 답한다고 학생에게 밝힌다.
          </p>
        </div>
        <input type="file" onChange={(e) => void upload(e.target.files?.[0])} disabled={busy} style={{ width: 260 }} />
      </div>
      {a.materials.length === 0 ? (
        <p className="muted small">첨부된 자료가 없다.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>파일</th>
              <th>크기</th>
              <th>텍스트 추출</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {a.materials.map((m) => (
              <tr key={m.id}>
                <td>{m.filename}</td>
                <td>{Math.round(m.size / 1024)}KB</td>
                <td>{m.has_text ? <span className="chip chip-ok">됨</span> : <span className="chip">없음, 이름만 참고</span>}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => void remove(m.id)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function RulesSection({ a, onSaved, notify }: { a: Assignment; onSaved: () => void; notify: Notify }) {
  const [rows, setRows] = useState<{ target: RuleTarget; text: string }[]>(a.rules.map((r) => ({ target: r.target, text: r.text })))
  useEffect(() => {
    setRows(a.rules.map((r) => ({ target: r.target, text: r.text })))
  }, [a.rules])
  async function save() {
    try {
      await api.prof.setRules(
        a.id,
        rows.filter((r) => r.text.trim()),
      )
      onSaved()
      notify('ok', 'AI 응답 규칙을 저장했다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card" id="sec5">
      <div className="card-title">
        <div>
          <h2>5. AI 응답 규칙</h2>
          <p className="muted small">
            학생의 어떤 질문에 무엇을 답하고 무엇을 되물을지에 관한 보완 규칙이다. 산파술 방식 자체는 시스템이 강제하고, 이 규칙은 과목의 세세한
            부분을 교수가 채우는 자리다. 채점 기준과는 다른 입력이다. AI 대상은 AI가 따르고, 학생 대상은 학생 화면에 안내로 보이며, 둘 다는 둘 다 한다.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => void save()}>
          저장
        </button>
      </div>
      {rows.map((r, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <select
            value={r.target}
            onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, target: e.target.value as RuleTarget } : x)))}
            style={{ width: 140 }}
          >
            <option value="ai">AI 대상</option>
            <option value="student">학생 대상</option>
            <option value="both">둘 다 대상</option>
          </select>
          <input
            value={r.text}
            placeholder="예: 서브쿼리는 이 과제에서 설명하지 않는다"
            onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
            style={{ flex: 1 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
            삭제
          </button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setRows([...rows, { target: 'ai', text: '' }])}>
        규칙 추가
      </button>
    </div>
  )
}

export function ToolSection({ a, onSaved, notify }: { a: Assignment; onSaved: (a: Assignment) => void; notify: Notify }) {
  const [slot, setSlot] = useState(a.tool_slot)
  const [tool, setTool] = useState(a.tool_name)
  const cfg = a.tool_config as Record<string, string>
  const [schemaSql, setSchemaSql] = useState(cfg.schema_sql ?? '')
  const [seedSql, setSeedSql] = useState(cfg.seed_sql ?? '')
  const [program, setProgram] = useState(cfg.program ?? 'Excel')
  const [extensions, setExtensions] = useState(cfg.extensions ?? '.xlsx,.xlsm')
  const [windowKeyword, setWindowKeyword] = useState(cfg.window_keyword ?? 'Excel')

  function changeSlot(s: number) {
    setSlot(s)
    setTool(TOOL_OPTIONS[s][0].value)
  }
  async function save() {
    const tool_config: Record<string, string> =
      tool === 'sql'
        ? { schema_sql: schemaSql, seed_sql: seedSql }
        : tool === 'companion'
          ? { program, extensions, window_keyword: windowKeyword }
          : {}
    try {
      onSaved(await api.prof.update(a.id, { tool_slot: slot, tool_name: tool, tool_config }))
      notify('ok', '도구 연동을 저장했다.')
    } catch (e) {
      notify('error', e instanceof Error ? e.message : '저장 실패')
    }
  }
  return (
    <div className="card" id="sec6">
      <div className="card-title">
        <div>
          <h2>6. 도구 연동</h2>
          <p className="muted small">
            도구가 실행되는 자리를 고른다. 자리 1은 페이지 안에 넣는 웹 도구, 자리 2는 API로 연동하는 웹 도구, 자리 3은 학생 컴퓨터에 설치된
            프로그램이다. 결과물 버전은 자리 1에서는 저장할 때마다, 자리 2에서는 API 수정 이력마다, 자리 3에서는 저장 폴더에 저장될 때마다 생긴다.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => void save()}>
          저장
        </button>
      </div>
      <div className="row">
        <div className="field">
          <label>자리</label>
          <select value={slot} onChange={(e) => changeSlot(Number(e.target.value))}>
            <option value={0}>자리 0, 페이지 안 문서 편집기</option>
            <option value={1}>자리 1, 페이지 안 웹 도구</option>
            <option value={2}>자리 2, API 연동 웹 도구</option>
            <option value={3}>자리 3, 설치된 프로그램</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>도구</label>
          <select value={tool} onChange={(e) => setTool(e.target.value)}>
            {TOOL_OPTIONS[slot].map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {tool === 'sql' && (
        <div className="grid-2">
          <div className="field">
            <label>스키마 SQL, 학생 편집기의 데이터베이스를 만드는 CREATE TABLE 문</label>
            <textarea value={schemaSql} onChange={(e) => setSchemaSql(e.target.value)} style={{ minHeight: 160, fontFamily: 'monospace' }} />
          </div>
          <div className="field">
            <label>초기 데이터 SQL, INSERT 문</label>
            <textarea value={seedSql} onChange={(e) => setSeedSql(e.target.value)} style={{ minHeight: 160, fontFamily: 'monospace' }} />
          </div>
        </div>
      )}
      {tool === 'companion' && (
        <div className="row">
          <div className="field">
            <label>프로그램 이름</label>
            <input value={program} onChange={(e) => setProgram(e.target.value)} />
          </div>
          <div className="field">
            <label>감시할 파일 확장자, 쉼표로 구분</label>
            <input value={extensions} onChange={(e) => setExtensions(e.target.value)} />
          </div>
          <div className="field">
            <label>캡처할 창 제목에 들어가는 말</label>
            <input value={windowKeyword} onChange={(e) => setWindowKeyword(e.target.value)} />
          </div>
        </div>
      )}
      {tool === 'google_docs' && (
        <p className="muted small">학생이 과제 단계에서 Google 계정을 연결하고 문서를 지정하면 서버가 수정 이력을 받아 버전을 만든다.</p>
      )}
      {tool === 'editor' && <p className="muted small">학생은 페이지 안 편집기에 글을 쓰고 저장할 때마다 버전이 남는다.</p>}
    </div>
  )
}
