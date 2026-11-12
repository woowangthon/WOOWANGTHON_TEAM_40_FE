import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, FileCode, FilePlus, FileText, Folder, FolderOpen, FolderPlus, Lock, Pencil, Trash2 } from 'lucide-react'
import type { WsFile } from './wsApi'

type Node = { name: string; path: string; folders: Node[]; files: WsFile[] }

const NEW_FILE = [
  ['Python', '.py'],
  ['C++', '.cpp'],
  ['C++ 헤더', '.h'],
  ['Java', '.java'],
  ['보고서', '.docx'],
] as const

function buildTree(files: WsFile[], extra: string[]): Node {
  const root: Node = { name: '', path: '', folders: [], files: [] }
  const folderOf = (path: string) => {
    let node = root
    for (const part of path.split('/').filter(Boolean)) {
      const p = node.path ? `${node.path}/${part}` : part
      let next = node.folders.find((f) => f.path === p)
      if (!next) {
        next = { name: part, path: p, folders: [], files: [] }
        node.folders.push(next)
      }
      node = next
    }
    return node
  }
  for (const f of extra) folderOf(f)
  for (const f of files) {
    const i = f.path.lastIndexOf('/')
    folderOf(i < 0 ? '' : f.path.slice(0, i)).files.push(f)
  }
  const sort = (n: Node) => {
    n.folders.sort((a, b) => a.name.localeCompare(b.name))
    n.folders.forEach(sort)
  }
  sort(root)
  return root
}

const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const parentOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const join = (parent: string, name: string) => (parent ? `${parent}/${name}` : name)

export function FileIcon({ kind }: { kind: WsFile['kind'] }) {
  return kind === 'doc' ? <FileText aria-hidden="true" /> : <FileCode aria-hidden="true" />
}

/** 이름 입력 칸. Enter 로 확정, Esc 나 포커스를 잃으면 취소 */
function NameInput({ initial, depth, icon, onSubmit, onCancel }: { initial: string; depth: number; icon: ReactNode; onSubmit: (name: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = initial.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : initial.length)
  }, [initial])
  const submit = async () => {
    const name = value.trim()
    if (!name || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(name)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <div className="ws-tree-input" style={{ paddingLeft: 8 + depth * 14 }}>
      <div>
        {icon}
        <input
          ref={ref}
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit()
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => !busy && !error && onCancel()}
          spellCheck={false}
          disabled={busy}
          aria-label="이름"
        />
      </div>
      <small className={error ? 'ws-alert' : 'soft'}>{error ?? 'Enter 확인 · Esc 취소 · 슬래시(/)로 폴더 지정'}</small>
    </div>
  )
}

export function FileTree({
  files,
  changed,
  active,
  setActive,
  editable,
  onCreate,
  onRename,
  onDelete,
}: {
  files: WsFile[]
  changed: Set<string>
  active: string
  setActive: (path: string) => void
  editable: boolean
  onCreate: (path: string) => Promise<void>
  onRename: (path: string, newPath: string, folder: boolean) => Promise<void>
  onDelete: (path: string, folder: boolean) => Promise<void>
}) {
  const [menu, setMenu] = useState(false)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  // 아직 파일이 없는 새 폴더. 파일을 하나 만들면 경로에서 저절로 생기므로 화면에만 둔다
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])
  const [creating, setCreating] = useState<{ parent: string; kind: 'file' | 'folder'; initial: string } | null>(null)
  const [renaming, setRenaming] = useState<{ path: string; folder: boolean } | null>(null)
  const tree = useMemo(() => buildTree(files, emptyFolders), [files, emptyFolders])

  useEffect(() => {
    setEmptyFolders((list) => list.filter((f) => !files.some((x) => x.path.startsWith(`${f}/`))))
  }, [files])

  const startCreate = (parent: string, kind: 'file' | 'folder', ext = '.py') => {
    setMenu(false)
    if (parent) setClosed((s) => new Set([...s].filter((p) => p !== parent)))
    setCreating({ parent, kind, initial: kind === 'folder' ? '새폴더' : `untitled${ext}` })
  }

  const submitCreate = async (name: string) => {
    if (!creating) return
    const path = join(creating.parent, name.replace(/^\/+|\/+$/g, ''))
    if (creating.kind === 'folder') {
      if (files.some((f) => f.path === path || f.path.startsWith(`${path}/`)) || emptyFolders.includes(path)) throw new Error('같은 이름이 이미 있다')
      setEmptyFolders((l) => [...l, path])
      // 빈 폴더는 저장되지 않으므로 바로 첫 파일 이름을 묻는다
      setCreating({ parent: path, kind: 'file', initial: 'main.py' })
      return
    }
    await onCreate(path)
    setCreating(null)
  }

  const onlyLocal = (path: string) => emptyFolders.includes(path) && !files.some((f) => f.path.startsWith(`${path}/`))

  const submitRename = async (name: string) => {
    if (!renaming) return
    const target = join(parentOf(renaming.path), name.replace(/^\/+|\/+$/g, ''))
    if (target === renaming.path) return setRenaming(null)
    if (renaming.folder && onlyLocal(renaming.path)) setEmptyFolders((l) => l.map((f) => (f === renaming.path ? target : f)))
    else await onRename(renaming.path, target, renaming.folder)
    setRenaming(null)
  }

  const remove = async (path: string, folder: boolean) => {
    if (folder && onlyLocal(path)) return setEmptyFolders((l) => l.filter((f) => f !== path))
    const count = folder ? files.filter((f) => f.path.startsWith(`${path}/`)).length : 1
    const msg = folder ? `${path} 폴더와 안의 파일 ${count}개를 지울까요?\n지운 내용은 수정 이력에 남는다.` : `${path} 파일을 지울까요?\n지운 내용은 수정 이력에 남는다.`
    if (!window.confirm(msg)) return
    try {
      await onDelete(path, folder)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const render = (node: Node, depth: number): ReactNode => (
    <>
      {node.folders.map((folder) => {
        const open = !closed.has(folder.path)
        const locked = files.some((f) => f.template && f.path.startsWith(`${folder.path}/`))
        return (
          <div key={folder.path}>
            {renaming?.folder && renaming.path === folder.path ? (
              <NameInput initial={folder.name} depth={depth} icon={<Folder aria-hidden="true" />} onSubmit={submitRename} onCancel={() => setRenaming(null)} />
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="ws-row folder"
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() =>
                  setClosed((s) => {
                    const n = new Set(s)
                    if (n.has(folder.path)) n.delete(folder.path)
                    else n.add(folder.path)
                    return n
                  })
                }
              >
                {open ? <ChevronDown aria-hidden="true" className="ws-caret" /> : <ChevronRight aria-hidden="true" className="ws-caret" />}
                {open ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" />}
                <span className="ws-grow ws-ellipsis">{folder.name}</span>
                {editable && (
                  <span className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="이 폴더에 새 파일" onClick={() => startCreate(folder.path, 'file')}>
                      <FilePlus aria-hidden="true" />
                    </button>
                    <button title="이 폴더에 새 폴더" onClick={() => startCreate(folder.path, 'folder')}>
                      <FolderPlus aria-hidden="true" />
                    </button>
                    {!locked && (
                      <>
                        <button title="이름 바꾸기" onClick={() => setRenaming({ path: folder.path, folder: true })}>
                          <Pencil aria-hidden="true" />
                        </button>
                        <button title="폴더 삭제" onClick={() => void remove(folder.path, true)}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
            {open && render(folder, depth + 1)}
          </div>
        )
      })}
      {creating && creating.parent === node.path && (
        <NameInput
          key={`${creating.parent}:${creating.kind}`}
          initial={creating.initial}
          depth={depth}
          icon={creating.kind === 'folder' ? <FolderPlus aria-hidden="true" /> : <FilePlus aria-hidden="true" />}
          onSubmit={submitCreate}
          onCancel={() => setCreating(null)}
        />
      )}
      {node.files.map((f) =>
        renaming && !renaming.folder && renaming.path === f.path ? (
          <NameInput key={f.path} initial={baseName(f.path)} depth={depth} icon={<FileIcon kind={f.kind} />} onSubmit={submitRename} onCancel={() => setRenaming(null)} />
        ) : (
          <div
            key={f.path}
            role="button"
            tabIndex={0}
            className={active === f.path ? 'ws-row active' : 'ws-row'}
            style={{ paddingLeft: 8 + depth * 14 + 18 }}
            onClick={() => setActive(f.path)}
            onKeyDown={(e) => e.key === 'Enter' && setActive(f.path)}
            title={f.path}
          >
            <FileIcon kind={f.kind} />
            <span className="ws-grow ws-ellipsis">{baseName(f.path)}</span>
            {changed.has(f.path) && <i className="ws-dot" title="마지막 커밋 뒤 바뀐 내용이 있다" />}
            {f.readonly ? (
              <Lock aria-label="읽기 전용" className="ws-muted-icon" />
            ) : f.template ? (
              <span className="ws-tag" title="과제 기본 파일 · 이름 변경, 삭제 불가">
                기본
              </span>
            ) : (
              editable && (
                <span className="ws-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button title="이름 바꾸기" onClick={() => setRenaming({ path: f.path, folder: false })}>
                    <Pencil aria-hidden="true" />
                  </button>
                  <button title="파일 삭제" onClick={() => void remove(f.path, false)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </span>
              )
            )}
          </div>
        ),
      )}
    </>
  )

  return (
    <div className="ws-tree">
      <div className="ws-side-head">
        <h2>파일</h2>
        <span className="soft num">{files.length}</span>
        <span className="ws-grow" />
        {editable && (
          <>
            <button className="btn icon quiet" title="새 파일" aria-label="새 파일" onClick={() => setMenu((v) => !v)}>
              <FilePlus aria-hidden="true" />
            </button>
            <button className="btn icon quiet" title="새 폴더" aria-label="새 폴더" onClick={() => startCreate('', 'folder')}>
              <FolderPlus aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {menu && (
        <div className="ws-menu">
          {NEW_FILE.map(([label, ext]) => (
            <button key={ext} onClick={() => startCreate('', 'file', ext)}>
              <span>{label}</span>
              <span className="soft mono">{ext}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ws-rows">{render(tree, 0)}</div>
    </div>
  )
}
