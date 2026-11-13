import { useEffect, useState } from 'react'

import { fetchBlobUrl } from '../api'

export function AuthImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    fetchBlobUrl(path)
      .then((u) => {
        objectUrl = u
        if (!revoked) setUrl(u)
      })
      .catch(() => setError(true))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])
  if (error) return <span className="soft">이미지를 불러오지 못했다</span>
  if (!url) return <span className="soft">이미지 불러오는 중</span>
  return <img src={url} alt={alt} />
}

export function DownloadButton({
  path,
  filename,
  label,
  className = 'btn',
}: {
  path: string
  filename: string
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function download() {
    setBusy(true)
    setError(null)
    try {
      const url = await fetchBlobUrl(path)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '내려받기 실패')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className={className} onClick={() => void download()} disabled={busy}>
        {label ?? `${filename} 내려받기`}
      </button>
      {error && <span className="error-text">{error}</span>}
    </>
  )
}
