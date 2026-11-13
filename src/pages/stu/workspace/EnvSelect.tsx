// 실행환경 설정. 기본 환경과 교수가 지정한 환경 중에서 고른다.
// 교수 환경은 과제마다 Docker 이미지로 만들어 두고(처음 한 번 몇 분), 고른 환경에서 실행과 테스트가 돈다.
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Cpu, GraduationCap, Lock, Monitor, Package, RotateCcw, Settings2, TriangleAlert } from 'lucide-react'
import { Modal } from './dialogs'
import { errorText, ws, type EnvInfo, type EnvView } from './wsApi'

export function envLabel(e: EnvView): string {
  return `${e.os.split(' (')[0]} · ${e.key === 'professor' ? '교수 환경' : '기본 환경'}`
}

function Spec({ env }: { env: EnvView }) {
  return (
    <dl className="ws-env-spec">
      <dt>
        <Monitor aria-hidden="true" /> OS
      </dt>
      <dd>{env.os}</dd>
      <dt>
        <Cpu aria-hidden="true" /> 언어
      </dt>
      <dd>
        {env.python}
        <br />
        {env.cpp} · C++17
        <br />
        {env.java}
      </dd>
      <dt>
        <Package aria-hidden="true" /> 패키지
      </dt>
      <dd>
        {env.apt.length + env.pip.length === 0 ? (
          <span className="soft">추가 패키지 없음</span>
        ) : (
          <span className="ws-env-pkgs">
            {env.apt.map((p) => (
              <code key={`a${p}`}>apt {p}</code>
            ))}
            {env.pip.map((p) => (
              <code key={`p${p}`}>pip {p}</code>
            ))}
          </span>
        )}
      </dd>
      <dt>
        <Settings2 aria-hidden="true" /> 컴파일
      </dt>
      <dd>
        <code>{env.cflags}</code>
      </dd>
    </dl>
  )
}

/** docker build 로그에서 "Step 2/4 : RUN apt-get ..." 을 찾아 진행 상황을 만든다 */
function progressOf(log: string): { step: number; total: number; text: string } | null {
  const steps = [...log.matchAll(/Step (\d+)\/(\d+) : (.*)/g)]
  const last = steps[steps.length - 1]
  if (!last) return null
  const raw = last[3]
  const text = raw.startsWith('FROM') ? '기반 OS 이미지 받기' : raw.includes('apt-get') ? 'OS 패키지와 컴파일러 설치' : raw.includes('pip install') ? 'Python 패키지 설치' : '환경 설정'
  return { step: Number(last[1]), total: Number(last[2]), text }
}

/** 과제 단계 첫 화면, 또는 작업 중에 환경을 바꿀 때 */
export function EnvSelect({ eid, info, onDone, onCancel }: { eid: number; info: EnvInfo; onDone: (info: EnvInfo) => void; onCancel?: () => void }) {
  const prof = info.professor
  const [picked, setPicked] = useState<EnvView['key']>(info.chosen ?? (prof ? 'professor' : 'default'))
  const [live, setLive] = useState<EnvInfo | null>(null) // 준비 중일 때 서버에서 받은 최신 상태
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const started = useRef<number>(0)
  const [, tick] = useState(0)
  const done = useRef(onDone)
  done.current = onDone

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await ws.envPick(eid, picked)
      if (picked === 'default' || next.professor?.status === 'ready') return onDone(next)
      started.current = Date.now()
      setLive(next)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // 교수 환경 이미지를 만드는 동안 2초마다 상태를 받는다
  useEffect(() => {
    if (!live || live.professor?.status === 'failed') return
    const t = window.setInterval(() => {
      tick((n) => n + 1)
      ws.envGet(eid)
        .then((next) => {
          if (next.professor?.status === 'ready') done.current(next)
          else setLive(next)
        })
        .catch((e) => setError(errorText(e)))
    }, 2000)
    return () => window.clearInterval(t)
  }, [live, eid])

  const cards: [EnvView, boolean][] = prof ? [[prof, false], [info.default, prof.required]] : [[info.default, false]]
  const p = live?.professor
  const prog = p ? progressOf(p.log ?? '') : null
  const secs = started.current ? Math.round((Date.now() - started.current) / 1000) : 0

  return (
    <div className="ws-env">
      <div className="ws-env-col">
        <h1>실행환경 설정</h1>

        <div className="ws-env-cards" role="radiogroup" aria-label="실행 환경">
          {cards.map(([env, locked]) => {
            const on = picked === env.key
            return (
              <button
                key={env.key}
                role="radio"
                aria-checked={on}
                disabled={locked || Boolean(live) || busy}
                className={`ws-env-card${on ? ' on' : ''}${locked ? ' locked' : ''}`}
                onClick={() => setPicked(env.key)}
              >
                <div className="ws-env-card-head">
                  <span className="ws-env-icon">{env.key === 'professor' ? <GraduationCap aria-hidden="true" /> : <Monitor aria-hidden="true" />}</span>
                  <div className="ws-grow">
                    <strong>{env.key === 'professor' ? '교수 지정 환경' : '기본 환경'}</strong>
                    {env.key === 'professor' && <small>{env.name}</small>}
                  </div>
                  {env.key === 'professor' && prof?.required && <span className="ws-env-badge req">필수</span>}
                  <span className="ws-env-radio">{on && <Check aria-hidden="true" />}</span>
                </div>
                <Spec env={env} />
                {locked && (
                  <p className="ws-env-lock">
                    <Lock aria-hidden="true" /> 교수가 지정 환경을 필수로 정해 고를 수 없다
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {error && (
          <p className="ws-env-error">
            <TriangleAlert aria-hidden="true" /> {error}
          </p>
        )}

        {!live ? (
          <div className="ws-env-actions">
            {onCancel && (
              <button className="ws-btn" onClick={onCancel} disabled={busy}>
                취소
              </button>
            )}
            <button className="ws-btn primary lg" onClick={() => void start()} disabled={busy}>
              이 환경으로 시작 <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="ws-env-prep" role="status">
            <strong>
              {p?.status === 'failed' ? `${p.os} 환경을 만들지 못했어요` : `${p?.os} 환경을 만드는 중`}
              <span className="soft num"> · {secs}초</span>
            </strong>
            {p?.status === 'failed' ? (
              <>
                <pre className="ws-env-log">{(p.log ?? '').split('\n').slice(-8).join('\n')}</pre>
                <div className="ws-env-actions">
                  <button className="ws-btn primary" onClick={() => void start()}>
                    <RotateCcw aria-hidden="true" /> 다시 시도
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="ws-env-progress">
                  <i style={{ width: `${prog ? Math.round(((prog.step - 0.5) / prog.total) * 100) : 4}%` }} />
                </div>
                <p className="soft num">{prog ? `${prog.step}/${prog.total} 단계 · ${prog.text}` : '빌드를 시작하는 중'}</p>
                <pre className="ws-env-log">{(p?.log ?? '').split('\n').filter(Boolean).slice(-4).join('\n') || '…'}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** 작업 중에 환경 칩을 누르면 뜨는 창 */
export function EnvDialog({ env, canChange, onChange, onClose }: { env: EnvView; canChange: boolean; onChange: () => void; onClose: () => void }) {
  return (
    <Modal title="실행 환경" onClose={onClose}>
      <div className="ws-env-card-head">
        <span className="ws-env-icon">{env.key === 'professor' ? <GraduationCap aria-hidden="true" /> : <Monitor aria-hidden="true" />}</span>
        <div className="ws-grow">
          <strong>{env.key === 'professor' ? '교수 지정 환경' : '기본 환경'}</strong>
          {env.key === 'professor' && <small>{env.name}</small>}
        </div>
      </div>
      <Spec env={env} />
      <div className="ws-modal-actions">
        <button className="ws-btn" onClick={onClose}>
          닫기
        </button>
        {canChange && (
          <button className="ws-btn primary" onClick={onChange}>
            환경 바꾸기
          </button>
        )}
      </div>
    </Modal>
  )
}
