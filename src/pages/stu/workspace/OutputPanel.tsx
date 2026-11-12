import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, MessageSquare } from 'lucide-react'
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
    <button className="btn quiet ws-ask" onClick={() => onAskAi(label, prompt)}>
      <MessageSquare aria-hidden="true" /> AI에게 물어보기
    </button>
  )

  return (
    <div className={open ? 'ws-output' : 'ws-output closed'}>
      <div className="ws-output-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(key)
              setOpen(true)
            }}
          >
            {label}
            {key === 'test' && failed > 0 && <span className="ws-count">{failed}</span>}
          </button>
        ))}
        <span className="ws-grow" />
        <span className="soft ws-small">Docker 격리 실행 · 네트워크 없음 · 5초 / 384MB</span>
        <button className="btn icon quiet" aria-label={open ? '실행 패널 접기' : '실행 패널 펼치기'} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="ws-output-body">
          {running ? (
            <p className="soft ws-pad">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>{' '}
              실행 직전 내용을 커밋하고 컨테이너에서 실행하는 중
            </p>
          ) : error && tab !== 'stdin' ? (
            <div className="ws-pad">
              <p className="ws-alert">실행하지 못했다</p>
              <p className="soft">{error}</p>
            </div>
          ) : tab === 'stdin' ? (
            <textarea
              className="ws-stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="실행할 때 프로그램에 넣을 입력을 적는다"
              spellCheck={false}
            />
          ) : !r ? (
            <p className="soft ws-pad">아직 실행 기록이 없다. 실행이나 테스트를 누른다</p>
          ) : r.compile_error ? (
            <div className="ws-pad">
              <pre className="ws-console">{command(r)}</pre>
              <pre className="ws-console ws-alert">{r.compile_error}</pre>
              {ask('컴파일 오류', '이 컴파일 오류가 왜 났는지 설명해줘.')}
            </div>
          ) : tab === 'test' ? (
            tests.length === 0 ? (
              <div className="ws-pad">
                {r.error ? (
                  <>
                    <p className="ws-alert">{r.error}</p>
                    <p className="mono soft">{lastErrorLine(r.stdout)}</p>
                    {ask('테스트 실행 오류', `테스트가 실행되지 않아. 왜 그런지 알려줘.\n${lastErrorLine(r.stdout)}`)}
                  </>
                ) : (
                  <p className="soft">테스트 결과가 없다. 테스트를 누른다</p>
                )}
                {r.stdout && <pre className="ws-console">{r.stdout}</pre>}
              </div>
            ) : (
              <div className="ws-pad">
                <div className="ws-test-sum">
                  <strong className="num">
                    {r.passed} / {r.total} 통과
                  </strong>
                  <span className="soft num">
                    {run!.at} · {r.duration ?? '-'}초 · 커밋 {run!.commitId}
                  </span>
                </div>
                <div className="ws-tests">
                  {tests.map((t, i) => {
                    const expanded = !t.passed && (openTest ?? tests.find((x) => !x.passed)?.name) === t.name
                    return (
                      <div key={t.name + i}>
                        <button
                          className={t.passed ? 'ws-test' : 'ws-test fail'}
                          onClick={t.passed ? undefined : () => setOpenTest(expanded ? '' : t.name)}
                          disabled={t.passed}
                        >
                          <span className={t.passed ? 'status done' : 'status alert'}>
                            <i />
                          </span>
                          <span className="num soft">{String(i + 1).padStart(2, '0')}</span>
                          <span className="ws-grow ws-ellipsis">{t.name}</span>
                          <span className="soft num">{t.passed ? `${t.duration ?? 0}s` : '실패'}</span>
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
                                  <dd>{t.expected}</dd>
                                  <dt>실제값</dt>
                                  <dd className="ws-alert">{t.actual}</dd>
                                </>
                              )}
                              {t.message && (
                                <>
                                  <dt>오류</dt>
                                  <dd className="ws-alert">{t.message}</dd>
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
              </div>
            )
          ) : (
            <pre className="ws-console ws-pad">
              {command(r)}
              {'\n'}
              {r.stdout || (r.mode === 'test' ? '(테스트 결과는 테스트 결과 탭에 있다)' : '(출력 없음)')}
              {'\n\n'}
              <span className="soft">
                {r.timed_out ? '시간 초과로 중단' : `종료 코드 ${r.exit_code ?? 0}`} · {r.duration ?? '-'}초
              </span>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
