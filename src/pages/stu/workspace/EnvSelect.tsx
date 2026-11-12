// 실행 환경 선택. 지금은 화면만 확인하는 프로토타입이다.
// 교수 환경 값은 과제 설정(tool_config.environment)에 있으면 그것을, 없으면 아래 예시 값을 쓴다.
// 실제 Docker 이미지 빌드와 실행 연결은 아직 없다.
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Cpu, GraduationCap, Info, Lock, Monitor, Package, Settings2 } from 'lucide-react'
import { Modal } from './dialogs'

export type EnvSpec = {
  key: 'default' | 'professor'
  name: string
  os: string
  python: string
  cpp: string
  java: string
  apt: string[]
  pip: string[]
  flags: string
  note?: string
}

export type EnvChoice = { key: EnvSpec['key']; at: string }

export const DEFAULT_ENV: EnvSpec = {
  key: 'default',
  name: '기본 환경',
  os: 'Debian 12 (bookworm)',
  python: 'Python 3.12',
  cpp: 'g++ 14 · C++17',
  java: 'OpenJDK 21',
  apt: [],
  pip: [],
  flags: '-std=c++17 -O2',
  note: '서비스 기본 환경',
}

const SAMPLE_PROFESSOR_ENV: EnvSpec & { required: boolean } = {
  key: 'professor',
  name: '운영체제 과제 채점 환경',
  required: false,
  os: 'Ubuntu 22.04 LTS',
  python: 'Python 3.10',
  cpp: 'g++ 11 · C++17',
  java: 'OpenJDK 17',
  apt: ['build-essential', 'valgrind'],
  pip: ['numpy', 'matplotlib'],
  flags: '-std=c++17 -O2 -Wall',
  note: '교수가 지정한 채점 환경',
}

/** 과제 설정에 교수 환경이 있으면 읽고, 없으면 예시를 쓴다. ?env=required 로 필수 모드를 미리 볼 수 있다 */
export function professorEnv(toolConfig: Record<string, unknown>): EnvSpec & { required: boolean } {
  const raw = toolConfig.environment as Partial<EnvSpec & { required: boolean }> | undefined
  const required = new URLSearchParams(window.location.search).get('env') === 'required'
  return { ...SAMPLE_PROFESSOR_ENV, ...(raw ?? {}), key: 'professor', required: required || Boolean(raw?.required) }
}

export function envLabel(e: EnvSpec): string {
  return `${e.os.split(' (')[0]} · ${e.key === 'professor' ? '교수 환경' : '기본 환경'}`
}

function Spec({ env }: { env: EnvSpec }) {
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
        {env.cpp}
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
        <code>{env.flags}</code>
      </dd>
    </dl>
  )
}

/** 과제 단계 첫 화면. 기본 환경과 교수 환경 중에서 고른다 */
export function EnvSelect({
  prof,
  current,
  onPick,
  onCancel,
}: {
  prof: EnvSpec & { required: boolean }
  current: EnvChoice | null
  onPick: (key: EnvSpec['key']) => void
  onCancel?: () => void
}) {
  const [picked, setPicked] = useState<EnvSpec['key']>(current?.key ?? 'professor')
  const [step, setStep] = useState(-1)
  const steps = ['실행 이미지 확인', '패키지 확인', '컴파일러와 런타임 확인', '작업공간 연결']

  // 준비 과정은 화면을 보여 주기 위한 흉내다. 실제 연결 때 서버 진행 상황으로 바꾼다
  useEffect(() => {
    if (step < 0) return
    if (step >= steps.length) {
      onPick(picked)
      return
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), 450)
    return () => window.clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const cards: [EnvSpec, boolean][] = [
    [prof, false],
    [DEFAULT_ENV, prof.required],
  ]

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
                disabled={locked || step >= 0}
                className={`ws-env-card${on ? ' on' : ''}${locked ? ' locked' : ''}`}
                onClick={() => setPicked(env.key)}
              >
                <div className="ws-env-card-head">
                  <span className="ws-env-icon">{env.key === 'professor' ? <GraduationCap aria-hidden="true" /> : <Monitor aria-hidden="true" />}</span>
                  <div className="ws-grow">
                    <strong>{env.key === 'professor' ? '교수 지정 환경' : '기본 환경'}</strong>
                    <small>{env.key === 'professor' ? env.name : '서비스 표준'}</small>
                  </div>
                  {env.key === 'professor' && <span className={prof.required ? 'ws-env-badge req' : 'ws-env-badge'}>{prof.required ? '필수' : '권장'}</span>}
                  <span className="ws-env-radio">{on && <Check aria-hidden="true" />}</span>
                </div>
                <Spec env={env} />
                {env.note && <p className="ws-env-note">{env.note}</p>}
                {locked && (
                  <p className="ws-env-lock">
                    <Lock aria-hidden="true" /> 교수가 지정 환경을 필수로 정해 고를 수 없다
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {!prof.required && (
          <p className="ws-env-hint">
            <Info aria-hidden="true" /> 기본 환경을 골라도 제출할 때는 교수 환경에서 테스트를 한 번 더 돌립니다.
          </p>
        )}

        {step < 0 ? (
          <div className="ws-env-actions">
            {onCancel && (
              <button className="ws-btn" onClick={onCancel}>
                취소
              </button>
            )}
            <button className="ws-btn primary lg" onClick={() => setStep(0)}>
              이 환경으로 시작 <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="ws-env-prep" role="status">
            <strong>{picked === 'professor' ? prof.os : DEFAULT_ENV.os} 환경을 준비하는 중</strong>
            <ol>
              {steps.map((s, i) => (
                <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                  <span>{i < step ? <Check aria-hidden="true" /> : i === step ? <i className="ws-mini-spinner" /> : null}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

/** 작업 중에 환경 칩을 누르면 뜨는 창 */
export function EnvDialog({ env, required, onChange, onClose }: { env: EnvSpec; required: boolean; onChange: () => void; onClose: () => void }) {
  return (
    <Modal title="실행 환경" onClose={onClose}>
      <div className="ws-env-card-head">
        <span className="ws-env-icon">{env.key === 'professor' ? <GraduationCap aria-hidden="true" /> : <Monitor aria-hidden="true" />}</span>
        <div className="ws-grow">
          <strong>{env.key === 'professor' ? '교수 지정 환경' : '기본 환경'}</strong>
          <small>{env.key === 'professor' ? env.name : '서비스 표준'}</small>
        </div>
      </div>
      <Spec env={env} />
      {env.note && <p className="ws-note">{env.note}</p>}
      <div className="ws-modal-actions">
        <button className="ws-btn" onClick={onClose}>
          닫기
        </button>
        {!required && (
          <button className="ws-btn primary" onClick={onChange}>
            환경 바꾸기
          </button>
        )}
      </div>
    </Modal>
  )
}
