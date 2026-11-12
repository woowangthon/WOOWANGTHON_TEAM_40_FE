import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, History, Pause, Play, Sparkles, SquareTerminal } from 'lucide-react'
import { Status } from '../../../ui'
import { clock, commitLabel, type WsCommit } from './wsApi'

type Kind = 'AI' | '직접' | '붙여넣기' | '실행'
type Filter = '전체' | Kind
const FILTERS: Filter[] = ['전체', 'AI', '직접', '붙여넣기', '실행']

export function kindOf(c: WsCommit): Kind {
  return c.author === 'ai' ? 'AI' : c.author === 'paste' ? '붙여넣기' : c.author === 'run' ? '실행' : '직접'
}

/** 수정 이력. 모든 커밋을 시간 순서로 보고, 고른 커밋의 프롬프트와 diff 를 본다. 교수 화면에서도 같은 부품을 쓸 수 있다 */
export function HistoryView({ commits, onClose, onOpenChat }: { commits: WsCommit[]; onClose: () => void; onOpenChat: () => void }) {
  const [filter, setFilter] = useState<Filter>('전체')
  const [file, setFile] = useState('')
  const [selectedId, setSelectedId] = useState(commits[0]?.id)
  const [playing, setPlaying] = useState(false)
  const [split, setSplit] = useState(false)

  const files = useMemo(() => Array.from(new Set(commits.map((c) => c.file).filter(Boolean))), [commits])
  const byFile = commits.filter((c) => !file || c.file === file)
  const list = filter === '전체' ? byFile : byFile.filter((c) => kindOf(c) === filter)
  const selected = list.find((c) => c.id === selectedId) ?? list[0]

  const pick = (f: Filter) => {
    setFilter(f)
    const items = f === '전체' ? byFile : byFile.filter((c) => kindOf(c) === f)
    if (items[0]) setSelectedId(items[0].id)
  }

  // 변경 과정 재생: 지금 보이는 목록을 오래된 순서로 하나씩 넘긴다
  const chrono = [...list].reverse()
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      const next = chrono[chrono.findIndex((c) => c.id === selected?.id) + 1]
      if (!next) return setPlaying(false)
      setSelectedId(next.id)
    }, 1100)
    return () => window.clearInterval(t)
  }, [playing, chrono, selected?.id])

  const togglePlay = () => {
    if (!playing && chrono.length && chrono[chrono.length - 1].id === selected?.id) setSelectedId(chrono[0].id)
    setPlaying((p) => !p)
  }

  return (
    <div className="ws-history">
      <div className="ws-history-bar">
        <button className="btn quiet" onClick={onClose}>
          <ArrowLeft aria-hidden="true" /> 작업으로 돌아가기
        </button>
        <div className="ws-history-title">
          <strong>수정 이력</strong>
          <span className="soft ws-small">모든 변경이 자동으로 기록된다</span>
        </div>
        <span className="ws-grow" />
        <div className="seg" role="group" aria-label="변경 종류">
          {FILTERS.map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => pick(f)}>
              {f} <span className="soft num">{f === '전체' ? byFile.length : byFile.filter((c) => kindOf(c) === f).length}</span>
            </button>
          ))}
        </div>
        <select className="select ws-file-select" value={file} onChange={(e) => setFile(e.target.value)} aria-label="파일">
          <option value="">모든 파일</option>
          {files.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={togglePlay} disabled={list.length < 2}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? '멈춤' : '변경 과정 재생'}
        </button>
      </div>
      <div className="ws-history-body">
        <aside className="ws-timeline">
          <div className="ws-side-head">
            <h2>{filter === '전체' ? '전체 변경' : `${filter} 변경`}</h2>
            <span className="soft num">{list.length}개</span>
          </div>
          {list.map((c) => (
            <button
              key={c.id}
              className={selected?.id === c.id ? 'ws-commit active' : 'ws-commit'}
              onClick={() => {
                setPlaying(false)
                setSelectedId(c.id)
              }}
            >
              <span className={`ws-kind k-${c.author}`}>{kindOf(c)}</span>
              <span className="ws-commit-main">
                <span className="soft ws-small num">
                  {commitLabel(c)} · {clock(c.created_at)}
                </span>
                <span className="ws-ellipsis">{c.title}</span>
                <span className="ws-small num">
                  {c.meta?.run ? (
                    <span className={c.meta.run.compile_error || (c.meta.run.total && c.meta.run.passed < c.meta.run.total) ? 'ws-alert' : 'soft'}>
                      {c.meta.run.total ? `${c.meta.run.passed}/${c.meta.run.total} 통과` : `종료 코드 ${c.meta.run.exit_code ?? '-'}`}
                    </span>
                  ) : (
                    <>
                      <span className="ws-plus">+{c.plus}</span> <span className="ws-minus">-{c.minus}</span>
                    </>
                  )}
                  {c.meta?.paste && !c.meta.paste.source && <span className="ws-tag">출처 미기입</span>}
                  {c.meta?.edited_from_ai && <span className="ws-tag">AI 제안 수정</span>}
                </span>
              </span>
            </button>
          ))}
          {list.length === 0 && <p className="soft ws-pad">조건에 맞는 변경이 없다</p>}
        </aside>
        <main className="ws-detail">
          {selected ? <Detail c={selected} split={split} setSplit={setSplit} onOpenChat={onOpenChat} /> : <p className="soft">아직 기록이 없다</p>}
        </main>
      </div>
    </div>
  )
}

function Detail({ c, split, setSplit, onOpenChat }: { c: WsCommit; split: boolean; setSplit: (v: boolean) => void; onOpenChat: () => void }) {
  const kind = kindOf(c)
  const m = c.meta ?? {}
  const changes = c.diff.filter((d) => d.type !== 'ctx').length
  const prompt = m.prompt ? (
    <div className="ws-prompt">
      <Sparkles aria-hidden="true" />
      <div>
        <span className="soft ws-small">학생 프롬프트</span>
        <p>{m.prompt}</p>
        <button className="btn quiet" onClick={onOpenChat}>
          원래 대화로 이동 <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : null

  return (
    <div className="ws-detail-col">
      <div className="ws-detail-head">
        <span className={`ws-kind k-${c.author}`}>
          {kind}
          {kind === 'AI' ? ' 수정' : ''}
        </span>
        <span className="soft num">
          커밋 {commitLabel(c)} · {clock(c.created_at)}
        </span>
      </div>
      <h2 className="ws-detail-title">{c.title}</h2>
      {c.file && (
        <p className="soft">
          {c.file} · 변경 {changes}개
        </p>
      )}

      {kind === 'AI' ? (
        <>
          {prompt}
          {m.reason && (
            <dl className="ws-dl">
              <dt>AI의 수정 이유</dt>
              <dd>{m.reason}</dd>
            </dl>
          )}
        </>
      ) : (
        <>
          <div className="ws-summary">
            {kind === '실행' ? <SquareTerminal aria-hidden="true" /> : <History aria-hidden="true" />}
            <div>
              <span className="soft ws-small">{kind} 변경 요약</span>
              <p>
                {m.run
                  ? m.run.total
                    ? `${c.file} 을(를) 실행해 테스트 ${m.run.total}개 중 ${m.run.passed}개가 통과했다.`
                    : `${c.file} 을(를) 실행했다. 종료 코드 ${m.run.exit_code ?? '-'}.`
                  : `${c.file} 에서 ${c.plus}줄이 추가되고 ${c.minus}줄이 삭제되었다.`}
              </p>
            </div>
          </div>
          {m.edited_from_ai && (
            <>
              {prompt}
              <dl className="ws-dl">
                {m.reason && (
                  <>
                    <dt>AI의 수정 이유</dt>
                    <dd>{m.reason}</dd>
                  </>
                )}
                <dt>반영 방식</dt>
                <dd>AI 수정안을 학생이 고쳐서 반영했다</dd>
                {m.ai_text && (
                  <>
                    <dt>AI 원안</dt>
                    <dd>
                      <pre className="ws-code">{m.ai_text}</pre>
                    </dd>
                  </>
                )}
              </dl>
            </>
          )}
        </>
      )}

      {c.diff.length > 0 && (
        <>
          <div className="section-head ws-diff-head">
            <h2>{c.file}</h2>
            <span className="ws-grow" />
            <div className="seg" role="group" aria-label="비교 방식">
              <button aria-pressed={!split} onClick={() => setSplit(false)}>
                한 화면
              </button>
              <button aria-pressed={split} onClick={() => setSplit(true)}>
                나란히
              </button>
            </div>
          </div>
          {split ? (
            <div className="ws-split">
              {(['del', 'add'] as const).map((side) => (
                <div className="diff" key={side}>
                  {c.diff
                    .filter((d) => d.type !== (side === 'del' ? 'add' : 'del'))
                    .map((d, i) => (
                      <div key={i} className={d.type === 'ctx' ? '' : d.type}>
                        <span className="soft">{d.no || ''}</span>
                        <span>{d.text}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="diff ws-diff">
              {c.diff.map((d, i) => (
                <div key={i} className={d.type === 'ctx' ? '' : d.type}>
                  <span className="soft">{d.no || ''}</span>
                  <span>
                    {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}
                    {d.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {m.run && (
        <dl className="ws-dl">
          <dt>결과</dt>
          <dd>
            <Status tone={m.run.compile_error || (m.run.total && m.run.passed < m.run.total) ? 'alert' : 'done'}>
              {m.run.compile_error ? '컴파일 오류' : m.run.total ? `테스트 ${m.run.total}개 중 ${m.run.passed}개 통과` : `종료 코드 ${m.run.exit_code ?? 0}`}
            </Status>
          </dd>
          <dt>실행 시간</dt>
          <dd className="num">{m.run.duration ?? '-'}초</dd>
          <dt>환경</dt>
          <dd>Docker 격리 컨테이너 · 네트워크 없음 · 384MB</dd>
          {m.run.stdout && (
            <>
              <dt>출력</dt>
              <dd>
                <pre className="ws-code">{String(m.run.stdout).slice(0, 2000)}</pre>
              </dd>
            </>
          )}
        </dl>
      )}

      {m.paste && (
        <dl className="ws-dl">
          <dt>출처</dt>
          <dd>{m.paste.source ?? <Status tone="alert">출처 미기입</Status>}</dd>
          {m.paste.memo && (
            <>
              <dt>메모</dt>
              <dd>{m.paste.memo}</dd>
            </>
          )}
          <dt>분량</dt>
          <dd className="num">
            {m.paste.lines}줄 · {m.paste.chars}자
          </dd>
          <dt />
          <dd className="soft ws-small">판정이 아니라 참고 정보다. 학생은 제출 전에 설명을 달 수 있다.</dd>
        </dl>
      )}
    </div>
  )
}
