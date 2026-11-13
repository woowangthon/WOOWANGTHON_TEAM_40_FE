import { lazy, Suspense, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { STAGE_LABEL, type Stage } from '../../api'
import { Loading, Notice, PageHead } from '../../ui'
import { currentStagePath, stageOpen, useEnrollment } from './EnrollmentLayout'
import LearningStage from './LearningStage'
import TestStage from './TestStage'

// 작업공간은 코드 편집기까지 딸려 와 무거우므로 과제 단계를 열 때 따로 받는다.
const WorkspaceStage = lazy(() => import('./workspace/WorkspaceStage'))

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

// 과제 단계의 도구는 작업공간 하나다. 작업공간은 학습 단계처럼 위쪽 바 아래를 꽉 채운다.
export function TaskPage() {
  const { e, reload, setNotice } = useEnrollment()
  const navigate = useNavigate()
  const onChanged = (notice?: string) => {
    if (notice) setNotice(notice)
    void reload().then((en) => {
      if (en.stage === 'post' && e.stage === 'task') navigate(`/stu/enrollments/${e.id}/post`)
    })
  }
  // 예전 도구로 만든 과제는 이 화면에서 열 수 없다. 서버도 작업공간 요청을 받지 않으므로 안내만 한다.
  if (e.assignment.tool_name !== 'workspace') {
    return (
      <StageGate target="task">
        <div className="page narrow">
          <PageHead title={STAGE_LABEL.task} />
          <Notice>이 과제는 더 이상 지원하지 않는 도구를 쓴다. 담당 교수에게 문의한다</Notice>
        </div>
      </StageGate>
    )
  }
  return (
    <StageGate target="task">
      <Suspense fallback={<Loading />}>
        <WorkspaceStage enrollment={e} onChanged={onChanged} />
      </Suspense>
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
