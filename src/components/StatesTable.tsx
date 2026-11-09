import type { CompetencyState } from '../api'

function fmt(v: number | null): string {
  return v === null || v === undefined ? '-' : `${Math.round(v)}점`
}

export default function StatesTable({
  states,
  showPost = false,
  actions,
}: {
  states: CompetencyState[]
  showPost?: boolean
  actions?: (s: CompetencyState) => React.ReactNode
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>역량</th>
          <th>통과 기준</th>
          <th>사전</th>
          <th>현재</th>
          {showPost && <th>사후</th>}
          <th>상태</th>
          {actions && <th></th>}
        </tr>
      </thead>
      <tbody>
        {states.map((s) => (
          <tr key={s.competency_id}>
            <td>{s.name}</td>
            <td>{s.pass_score}점</td>
            <td>{fmt(s.pre_score)}</td>
            <td>{fmt(s.current_score)}</td>
            {showPost && <td>{fmt(s.post_score)}</td>}
            <td>
              {s.pre_score === null ? (
                <span className="chip">미측정</span>
              ) : s.passed ? (
                <span className="chip chip-ok">충분</span>
              ) : (
                <span className="chip chip-warn">부족, 학습 목표</span>
              )}
            </td>
            {actions && <td>{actions(s)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
