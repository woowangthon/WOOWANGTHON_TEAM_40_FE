import { useEffect, useId, useRef, useState } from 'react'
import { Notice, useTheme } from '../../../ui'
import { ws } from './wsApi'

// ONLYOFFICE Docs API. 스크립트는 Document Server 가 직접 준다.
type DocEditorInstance = { destroyEditor: () => void }
declare global {
  interface Window {
    DocsAPI?: { DocEditor: new (id: string, config: Record<string, unknown>) => DocEditorInstance }
  }
}

const scripts: Record<string, Promise<void>> = {}
function loadScript(url: string): Promise<void> {
  scripts[url] ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = url
    el.onload = () => resolve()
    el.onerror = () => {
      delete scripts[url]
      reject(new Error('보고서 편집기 스크립트를 불러오지 못했다. ONLYOFFICE 가 켜져 있는지 확인한다'))
    }
    document.head.appendChild(el)
  })
  return scripts[url]
}

/** 보고서(docx) 편집기. 글 내용은 ONLYOFFICE 저장 콜백으로 서버가 커밋한다 */
export function DocEditor({
  eid,
  path,
  hidden,
  onDirty,
  onKey,
}: {
  eid: number
  path: string
  hidden: boolean
  /** 편집기에서 변경 신호가 왔다. 저장을 요청할 것이 있을 수 있다 */
  onDirty: () => void
  /** 편집기가 쓰는 문서 키. 저장 요청에 실어 보낸다 */
  onKey: (key: string) => void
}) {
  const id = `oo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const theme = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const cb = useRef({ onDirty, onKey })
  cb.current = { onDirty, onKey }

  useEffect(() => {
    let editor: DocEditorInstance | null = null
    let cancelled = false
    setReady(false)
    ;(async () => {
      const { api_url, config } = await ws.docConfig(eid, path, theme)
      await loadScript(api_url)
      if (cancelled || !window.DocsAPI) return
      cb.current.onKey(String((config.document as { key?: string } | undefined)?.key ?? ''))
      editor = new window.DocsAPI.DocEditor(id, {
        ...config,
        events: {
          onAppReady: () => setReady(true),
          onDocumentStateChange: () => cb.current.onDirty(),
          onError: (e: { data?: { errorDescription?: string } }) => setError(e.data?.errorDescription ?? '편집기 오류'),
        },
      })
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
      editor?.destroyEditor()
    }
  }, [eid, path, id, theme])

  return (
    <div className="ws-doc" style={hidden ? { display: 'none' } : undefined}>
      {error ? (
        <div className="ws-pad">
          <Notice kind="error">{error}</Notice>
        </div>
      ) : (
        !ready && <p className="soft ws-doc-loading">보고서 편집기를 여는 중</p>
      )}
      <div className="ws-doc-frame">
        <div id={id} />
      </div>
    </div>
  )
}
