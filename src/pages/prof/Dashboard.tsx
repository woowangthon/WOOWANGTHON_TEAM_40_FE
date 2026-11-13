import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'

import type { DashboardRow } from '../../api'
import { shownStatus, STATUS_LABEL, STATUS_TONE } from '../../nav'
import { useProfHome } from '../../shells'
import { ArtIcon, artOf, dateTime, HBar, Loading, Notice, PageHead, Status, Thumb, vars } from '../../ui'

// 작성 중인 과제는 설정으로, 공개한 과제는 현황으로 연다.
const hrefOf = (r: DashboardRow) => (r.status === 'draft' ? `/prof/assignments/${r.id}/setup/competencies` : `/prof/assignments/${r.id}`)
const progress = (r: DashboardRow) => (r.enrollment_count ? `${r.enrollment_count}명 중 ${r.submitted_count}명 제출` : '학생 참여 전')

// 교수 홈. 사이드바에서 고른 상태나 과목에 맞는 과제를 카드나 표로 보여 준다.
export default function Dashboard() {
  const { data, error } = useProfHome()
  const [sp] = useSearchParams()
  const status = sp.get('status')
  const course = sp.get('course')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  if (error && !data) {
    return (
      <div className="page">
        <Notice kind="error">{error}</Notice>
      </div>
    )
  }
  if (!data) return <Loading />

  // 사이드바의 상태 묶음과 같은 기준을 쓴다. 공개한 과제는 마감 시각이 지나면 마감이다.
  const list = data.rows.filter((r) => (!status || shownStatus(r) === status) && (!course || r.subject === course) && r.title.includes(q.trim()))
  const title = status ? STATUS_LABEL[status as DashboardRow['status']] ?? '최근 과제' : (course ?? '최근 과제')

  return (
    <div className="page" key={`${status}${course}`}>
      <PageHead title={title}>
        <Link className="btn primary" to="/prof/assignments/new">
          <Plus aria-hidden="true" />
          과제 만들기
        </Link>
      </PageHead>
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
          <div className="empty">
            {data.rows.length === 0 ? (
              <>
                아직 과제가 없다.{' '}
                <Link className="link" to="/prof/assignments/new">
                  첫 과제를 만든다
                </Link>
              </>
            ) : (
              '조건에 맞는 과제가 없다'
            )}
          </div>
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid">
          {list.map((r, i) => (
            <Link key={r.id} to={hrefOf(r)} className="card" style={vars({ '--i': i })}>
              <Thumb kind={artOf(r.tool_name)} />
              <div className="foot">
                <div className="line">
                  <span className="title">
                    <ArtIcon kind={artOf(r.tool_name)} />
                    <span>{r.title}</span>
                  </span>
                  <Status tone={STATUS_TONE[shownStatus(r)]}>{STATUS_LABEL[shownStatus(r)]}</Status>
                </div>
                <div className="line">
                  <div style={{ flex: 1 }}>
                    <HBar value={r.submitted_count} max={r.enrollment_count || 1} i={i} />
                  </div>
                  <span className="num">{progress(r)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>과제</th>
                  <th>과목</th>
                  <th>상태</th>
                  <th>마감</th>
                  <th className="r">제출</th>
                  <th className="r">채점 대기</th>
                  <th className="r">의심 신호</th>
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
                    <td>
                      <Status tone={STATUS_TONE[shownStatus(r)]}>{STATUS_LABEL[shownStatus(r)]}</Status>
                    </td>
                    <td className="num">{r.deadline ? dateTime(r.deadline) : '정하지 않음'}</td>
                    <td className="r">{progress(r)}</td>
                    <td className="r">{r.ungraded_count ? `${r.ungraded_count}명` : ''}</td>
                    <td className="r">{r.signal_count ? `${r.signal_count}건` : ''}</td>
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
