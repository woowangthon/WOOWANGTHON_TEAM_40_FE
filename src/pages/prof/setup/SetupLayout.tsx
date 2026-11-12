import { useCallback, useMemo, useState } from 'react'
import { Outlet, useMatch, useOutletContext } from 'react-router-dom'

import type { Assignment } from '../../../api'
import { setupNav } from '../../../nav'
import { useAssignmentShell } from '../../../shells'
import { Notice, PageHead } from '../../../ui'
import type { Notify } from '../setupSections'
import './setup.css'

export interface SetupCtx {
  a: Assignment
  setA: (a: Assignment) => void
  reload: () => Promise<void>
  notify: Notify
}

export function useSetup(): SetupCtx {
  return useOutletContext<SetupCtx>()
}

// 과제 설정의 틀. 구역 메뉴는 사이드바에 있으므로 여기서는 제목과 알림과 구역 하나만 보여 준다.
// 과제 정보는 과제 뼈대가 불러온 것을 그대로 쓰고, 저장한 뒤에는 setA 나 reload 로 사이드바까지 갱신한다.
export default function SetupLayout() {
  const { assignment: a, setAssignment: setA, reload } = useAssignmentShell()
  const section = useMatch('/prof/assignments/:id/setup/:section')?.params.section ?? 'competencies'
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; section: string } | null>(null)

  // 알림은 그것을 띄운 구역에서만 보인다. 다른 구역으로 가면 사라진다.
  const notify = useCallback<Notify>((kind, text) => setMessage({ kind, text, section }), [section])
  const ctx = useMemo<SetupCtx>(() => ({ a, setA, reload, notify }), [a, setA, reload, notify])

  const title = setupNav.find(([, path]) => path === section)?.[0] ?? '과제 설정'
  const shown = message?.section === section ? message : null
  const wide = section === 'competencies' || section === 'tests'

  return (
    <div className={wide ? 'page setup' : 'page narrow setup'} key={section}>
      <PageHead title={title} />
      {shown && (
        <div className="setup-notice">
          <Notice kind={shown.kind === 'error' ? 'error' : 'info'} onClose={() => setMessage(null)}>
            {shown.text}
          </Notice>
        </div>
      )}
      <Outlet context={ctx} />
    </div>
  )
}
