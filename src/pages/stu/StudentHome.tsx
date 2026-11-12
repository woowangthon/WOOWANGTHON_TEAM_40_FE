import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Search } from 'lucide-react'

import { STAGE_LABEL, type EnrollmentBrief, type Stage } from '../../api'
import { useStuHome } from '../../shells'
import { ArtIcon, artOf, dateTime, Loading, monthDay, Notice, PageHead, Status, Thumb, vars } from '../../ui'

const ORDER: Stage[] = ['pre', 'learning', 'task', 'post', 'done']
// 완료한 과제는 결과 요약으로, 진행 중인 과제는 과제 개요로 연다.
const hrefOf = (r: EnrollmentBrief) => (r.stage === 'done' ? `/stu/enrollments/${r.id}/result` : `/stu/enrollments/${r.id}`)

// 학생 홈. 참여한 과제를 카드나 표로 보여 준다. 과제 코드로 참여하는 입력은 사이드바에 있다.
export default function StudentHome() {
  const { rows, error } = useStuHome()
  const [sp] = useSearchParams()
  const state = sp.get('state')
  const course = sp.get('course')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  if (error && !rows) {
    return (
      <div className="page">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!rows) return <Loading />

  const list = rows.filter(
    (r) => (!state || (state === 'done') === (r.stage === 'done')) && (!course || r.subject === course) && r.title.includes(q.trim()),
  )
  const title = state === 'done' ? '완료' : state === 'active' ? '진행 중' : (course ?? '최근 과제')

  return (
    <div className="page" key={`${state}${course}`}>
      <PageHead title={title} />
      <div className="toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <input className="input" placeholder="과제 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="과제 검색" />
        </div>
        <div className="actions">
          <div className="seg" role="group" aria-label="보기 방식">
            <button type="button" aria-pressed={view === 'grid'} aria-label="카드로 보기" onClick={() => setView('grid')}>
              <LayoutGrid aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={view === 'list'} aria-label="표로 보기" onClick={() => setView('list')}>
              <List aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 && (
        <div className="rows">
          <div className="empty">{rows.length === 0 ? '아직 참여한 과제가 없다. 왼쪽 아래에서 과제 코드로 참여한다' : '조건에 맞는 과제가 없다'}</div>
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid">
          {list.map((r, i) => {
            const at = ORDER.indexOf(r.stage)
            return (
              <Link key={r.id} to={hrefOf(r)} className="card" style={vars({ '--i': i })}>
                <Thumb kind={artOf(r.tool_name)} />
                <div className="foot">
                  <div className="line">
                    <span className="title">
                      <ArtIcon kind={artOf(r.tool_name)} />
                      <span>{r.title}</span>
                    </span>
                    <span className="num">{r.deadline ? `${monthDay(r.deadline)} 마감` : ''}</span>
                  </div>
                  <div className="line">
                    <div className="steps" aria-hidden="true">
                      {ORDER.slice(0, 4).map((s, k) => (
                        <span key={s} className={k < at ? 'done' : k === at ? 'now' : ''} />
                      ))}
                    </div>
                    <span>{STAGE_LABEL[r.stage]}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>과제</th>
                  <th>과목</th>
                  <th>교수</th>
                  <th>현재 단계</th>
                  <th>마감</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="go">
                    <td className="strong">
                      <Link to={hrefOf(r)} className="with-ico">
                        <ArtIcon kind={artOf(r.tool_name)} />
                        {r.title}
                      </Link>
                    </td>
                    <td>{r.subject}</td>
                    <td>{r.professor_name}</td>
                    <td>
                      <Status tone={r.stage === 'done' ? 'done' : 'doing'}>{STAGE_LABEL[r.stage]}</Status>
                    </td>
                    <td className="num">
                      {r.deadline ? dateTime(r.deadline) : ''}
                      {r.deadline_passed ? ' 마감 지남' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
