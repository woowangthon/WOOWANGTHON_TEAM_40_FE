import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { STAGE_LABEL, type Stage } from '../../api'
import { PageHead } from '../../ui'
import { currentStagePath, stageOpen, useEnrollment } from './EnrollmentLayout'
import LearningStage from './LearningStage'
import TaskStage from './TaskStage'
import WorkspaceStage from './workspace/WorkspaceStage'
import TestStage from './TestStage'

// 아직 열리지 않은 단계로 들어오면 현재 단계로 안내한다.
function StageGate({ target, children }: { target: Stage; children: ReactNode }) {
  const { e } = useEnrollment()
  if (stageOpen(e.stage, target)) return <>{children}</>
  return (
    <div className="page narrow">
      <PageHead title={STAGE_LABEL[target]}>
        <Link className="btn primary" to={`/stu/enrollments/${e.id}/${currentStagePath(e.stage)}`}>
          {STAGE_LABEL[e.stage]} 단계로
        </Link>
      </PageHead>
      <div className="note">
        {STAGE_LABEL[target]} 단계는 아직 열리지 않았다. 현재 단계는 {STAGE_LABEL[e.stage]}이다
      </div>
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

// 과제 단계 화면은 팀원이 만든다. 예전 스타일시트가 적용되도록 legacy 영역으로 감싼다.
export function TaskPage() {
  const { e, reload, setNotice } = useEnrollment()
  const navigate = useNavigate()
  const onChanged = (notice?: string) => {
    if (notice) setNotice(notice)
    void reload().then((en) => {
      if (en.stage === 'post' && e.stage === 'task') navigate(`/stu/enrollments/${e.id}/post`)
    })
  }
  // 자리 4 작업공간은 학습 단계처럼 위쪽 바 아래를 꽉 채운다
  if (e.assignment.tool_name === 'workspace') {
    return (
      <StageGate target="task">
        <WorkspaceStage enrollment={e} onChanged={onChanged} />
      </StageGate>
    )
  }
  return (
    <StageGate target="task">
      <div className="task-frame">
        <div className="legacy">
          <TaskStage
            enrollment={e}
            onChanged={(notice) => {
              if (notice) setNotice(notice)
              void reload().then((en) => {
                if (en.stage === 'post' && e.stage === 'task') navigate(`/stu/enrollments/${e.id}/post`)
              })
            }}
          />
        </div>
      </div>
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
