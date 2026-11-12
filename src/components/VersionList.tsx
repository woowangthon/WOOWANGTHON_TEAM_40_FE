import { useState } from 'react'

import { formatDate, type Version } from '../api'
import { AuthImage, DownloadButton } from './Files'

const SOURCE_LABEL: Record<string, string> = {
  editor: '페이지 안 편집기',
  embed: '페이지 안 웹 도구',
  google: 'Google 문서 API',
  companion: '보조 프로그램',
  workspace: '작업공간',
}

export default function VersionList({
  versions,
  filePath,
  compact = false,
}: {
  versions: Version[]
  filePath: (vid: number) => string
  compact?: boolean
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({})
  if (versions.length === 0) return <p className="muted small">저장된 버전이 없다.</p>
  return (
    <div>
      {[...versions].reverse().map((v) => {
        const snapshot = Boolean(v.meta?.snapshot)
        // 자리 2에서 문서를 바꿔 가며 작업하면 버전마다 어느 문서에서 받은 것인지 보여 준다
        const docName = typeof v.meta?.doc_name === 'string' ? v.meta.doc_name : ''
        const expanded = open[v.id] ?? (!compact && !snapshot)
        return (
          <div className="version" key={v.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <strong>버전 {v.version_no}</strong>
                <span className="chip">{SOURCE_LABEL[v.source] ?? v.source}</span>
                <span className="chip">{v.kind === 'text' ? '텍스트' : v.kind === 'image' ? '이미지' : '파일'}</span>
                {snapshot && <span className="chip chip-primary">자동 캡처</span>}
                {docName && <span className="chip">문서 {docName}</span>}
                <span className="muted small">{formatDate(v.created_at)}</span>
              </div>
              <div className="row">
                {v.has_file && <DownloadButton path={filePath(v.id)} filename={v.file_name} label="파일" />}
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen({ ...open, [v.id]: !expanded })}>
                  {expanded ? '접기' : '펼치기'}
                </button>
              </div>
            </div>
            <p className="small" style={{ margin: '4px 0 0' }}>
              변경 이유: {v.reason}
            </p>
            {expanded && v.kind === 'image' && v.has_file && <AuthImage path={filePath(v.id)} alt={`버전 ${v.version_no}`} />}
            {expanded && v.text_content && <pre>{v.text_content}</pre>}
            {expanded && v.kind === 'file' && !v.text_content && (
              <p className="muted small">텍스트를 뽑지 못한 파일이다. 파일을 내려받아 확인한다.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
