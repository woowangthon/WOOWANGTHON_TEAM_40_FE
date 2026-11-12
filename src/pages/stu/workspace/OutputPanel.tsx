import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleX, Sparkles, TriangleAlert } from 'lucide-react'
import type { RunResult } from './wsApi'

export type RunView = { result: RunResult; at: string; commitId: string } | null
type Tab = 'out' | 'test' | 'stdin'

function command(r: RunResult): string {
  if (r.mode === 'test' && r.language === 'python') return `$ python -m test ${r.path}`
  if (r.language === 'cpp') return `$ g++ -std=c++17 -O2 ${r.path} && ./a.out`
  if (r.language === 'java') return `$ javac **/*.java && java ${r.path.replace(/\.java$/, '')}`
  return `$ python ${r.path}`
}

/** 파이썬 traceback 의 마지막 줄(예: ImportError: ...) */
function lastErrorLine(out?: string): string {
  const lines = (out ?? '')
    .trim()
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('@@'))
  return lines[lines.length - 1] ?? ''
}

export function OutputPanel({
  running,
  run,
  error,
  tab,
  setTab,
  stdin,
  setStdin,
  onAskAi,
}: {
  running: boolean
  run: RunView
  error: string | null
  tab: Tab
  setTab: (t: Tab) => void
  stdin: string
  setStdin: (v: string) => void
  onAskAi: (label: string, prompt: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [openTest, setOpenTest] = useState<string | null>(null)
  const r = run?.result
  const tests = r?.tests ?? []
  const failed = tests.filter((t) => !t.passed).length
  const tabs: [Tab, string][] = [
    ['out', '출력'],
    ['test', '테스트 결과'],
    ['stdin', '입력 (stdin)'],
  ]
  const ask = (label: string, prompt: string) => (
    <button className="ws-ask" onClick={() => onAskAi(label, prompt)}>
      <Sparkles aria-hidden="true" /> AI에게 물어보기
    </button>
  )

  return (
    <div className={open ? 'ws-output' : 'ws-output closed'}>
      <div className="ws-output-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key)
              setOpen(true)
            }}
          >
            {label}
            {key === 'test' && failed > 0 && <i className="ws-count">{failed}</i>}
          </button>
        ))}
        <span className="ws-grow" />
        <small className="ws-sandbox">격리된 실행 환경 · 5초 / 384MB 제한</small>
        <button className="ws-icon-btn" aria-label={open ? '실행 패널 접기' : '실행 패널 펼치기'} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="ws-output-body">
          {running ? (
            <div className="ws-running">
              <span className="ws-spinner" />
              <strong>코드를 실행하고 있습니다</strong>
              <small>실행 직전 내용을 커밋하고 격리 환경을 준비하는 중...</small>
            </div>
          ) : error && tab !== 'stdin' ? (
            <div className="ws-run-error">
              <TriangleAlert aria-hidden="true" />
              <div>
                <strong>실행하지 못했어요</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : tab === 'stdin' ? (
            <textarea className="ws-stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="프로그램 실행 시 전달할 입력값을 적어주세요." spellCheck={false} />
          ) : !r ? (
            <p className="ws-empty">아직 실행 기록이 없어요. ‘실행’ 또는 ‘테스트’를 눌러 보세요.</p>
          ) : r.compile_error ? (
            <div className="ws-console">
              <pre>{command(r)}</pre>
              <pre className="ws-alert">{r.compile_error}</pre>
              {ask('컴파일 오류', '이 컴파일 오류가 왜 났는지 설명해줘.')}
            </div>
          ) : tab === 'test' ? (
            tests.length === 0 ? (
              <div className="ws-console">
                {r.error ? (
                  <div className="ws-run-error inline">
                    <TriangleAlert aria-hidden="true" />
                    <div>
                      <strong>{r.error}</strong>
                      <p className="mono">{lastErrorLine(r.stdout)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="ws-empty">테스트 결과가 없어요. ‘테스트’를 눌러 실행하세요.</p>
                )}
                {r.stdout && <pre>{r.stdout}</pre>}
                {r.error && ask('테스트 실행 오류', `테스트가 실행되지 않아. 왜 그런지 알려줘.\n${lastErrorLine(r.stdout)}`)}
              </div>
            ) : (
              <>
                <div className="ws-test-summary">
                  <div className={failed === 0 ? 'ws-ring all' : 'ws-ring'}>
                    {r.passed}
                    <span>/{r.total}</span>
                  </div>
                  <div>
                    <strong>
                      테스트 {r.total}개 중 {r.passed}개 통과
                    </strong>
                    <small>
                      마지막 실행 {run!.at} · {r.duration ?? '-'}초 · 커밋 {run!.commitId}
                    </small>
                  </div>
                  <div className="ws-bar-track">
                    <i style={{ width: `${(r.passed / Math.max(1, r.total)) * 100}%` }} />
                  </div>
                </div>
                <div className="ws-test-list">
                  {tests.map((t, i) => {
                    const expanded = !t.passed && (openTest ?? tests.find((x) => !x.passed)?.name) === t.name
                    return (
                      <div key={t.name + i}>
                        <button className={t.passed ? 'ws-test-row' : 'ws-test-row failed'} onClick={t.passed ? undefined : () => setOpenTest(expanded ? '' : t.name)} disabled={t.passed}>
                          {t.passed ? <CheckCircle2 aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                          <span className="num">{String(i + 1).padStart(2, '0')}</span>
                          <strong className="ws-ellipsis">{t.name}</strong>
                          <small>{t.passed ? `${t.duration ?? 0}s` : '실패'}</small>
                          {!t.passed && (expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />)}
                        </button>
                        {expanded && (
                          <div className="ws-test-detail">
                            <dl>
                              {t.input !== undefined && (
                                <>
                                  <dt>입력</dt>
                                  <dd>{t.input || '(없음)'}</dd>
                                  <dt>기대값</dt>
                                  <dd className="expected">{t.expected}</dd>
                                  <dt>실제값</dt>
                                  <dd className="actual">{t.actual}</dd>
                                </>
                              )}
                              {t.message && (
                                <>
                                  <dt>오류</dt>
                                  <dd className="actual">{t.message}</dd>
                                </>
                              )}
                            </dl>
                            {ask(`테스트 ${t.name} 실패`, `${t.name} 테스트가 왜 실패하는지 알려줘.\n${t.message ?? ''}`.trim())}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : (
            <pre className="ws-console">
              {command(r)}
              {'\n'}
              {r.stdout || (r.mode === 'test' ? '(테스트 결과는 ‘테스트 결과’ 탭에 있어요)' : '(출력 없음)')}
              {'\n\n'}
              <span className="ws-dim">
                {r.timed_out ? '시간 초과로 중단됨' : `Process finished with exit code ${r.exit_code ?? 0}`} · {r.duration ?? '-'}s
              </span>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
