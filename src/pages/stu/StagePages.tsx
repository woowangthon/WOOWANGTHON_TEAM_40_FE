import { Link, useNavigate } from 'react-router-dom'

import { STAGE_LABEL, type Stage } from '../../api'
import { currentStagePath, stageOpen, useEnrollment } from './EnrollmentLayout'
import LearningStage from './LearningStage'
import TaskStage from './TaskStage'
import TestStage from './TestStage'

// 아직 열리지 않은 단계로 들어오면 현재 단계로 안내한다.
function StageGate({ target, children }: { target: Stage; children: React.ReactNode }) {
  const { e } = useEnrollment()
  if (stageOpen(e.stage, target)) return <>{children}</>
  return (
    <div className="card">
      <h2>{STAGE_LABEL[target]} 단계는 아직 열리지 않았다</h2>
      <p className="muted small">현재 단계는 {STAGE_LABEL[e.stage]}이다. 순서대로 진행하면 열린다.</p>
      <Link className="btn" to={`/stu/enrollments/${e.id}/${currentStagePath(e.stage)}`}>
        {STAGE_LABEL[e.stage]} 단계로
      </Link>
    </div>
  )
}

export function PrePage() {
  const { e, reload } = useEnrollment()
  const navigate = useNavigate()
  return (
    <StageGate target="pre">
      <TestStage
        enrollment={e}
        phase="pre"
        onSubmitted={() => void reload()}
        onDone={() => void reload().then((en) => navigate(`/stu/enrollments/${e.id}/${currentStagePath(en.stage)}`))}
      />
    </StageGate>
  )
}

export function LearningPage() {
  const { e, reload } = useEnrollment()
  const navigate = useNavigate()
  return (
    <StageGate target="learning">
      <LearningStage enrollment={e} onDone={() => void reload().then(() => navigate(`/stu/enrollments/${e.id}/task`))} />
    </StageGate>
  )
}

export function TaskPage() {
  const { e, reload, setNotice } = useEnrollment()
  const navigate = useNavigate()
  return (
    <StageGate target="task">
      <TaskStage
        enrollment={e}
        onChanged={(notice) => {
          if (notice) setNotice(notice)
          void reload().then((en) => {
            if (en.stage === 'post' && e.stage === 'task') navigate(`/stu/enrollments/${e.id}/post`)
          })
        }}
      />
    </StageGate>
  )
}

export function PostPage() {
  const { e, reload } = useEnrollment()
  const navigate = useNavigate()
  return (
    <StageGate target="post">
      <TestStage
        enrollment={e}
        phase="post"
        onSubmitted={() => void reload()}
        onDone={() => void reload().then(() => navigate(`/stu/enrollments/${e.id}/result`))}
      />
    </StageGate>
  )
}
