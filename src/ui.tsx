import type { CSSProperties, ReactNode } from 'react'
import { createContext, Fragment, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronRight, Code, Copy, FileText, Moon, Sun, Workflow } from 'lucide-react'

// 상태 점의 종류. todo 는 시작 전, doing 은 진행 중, done 은 끝남, alert 는 확인이 필요한 상태다.
export type Tone = 'todo' | 'doing' | 'done' | 'alert'
// 과제 카드의 미리보기 그림 종류
export type Art = 'code' | 'doc' | 'diagram'

export const vars = (o: Record<string, string | number>) => o as CSSProperties

// 과제가 쓰는 도구에 맞는 미리보기 그림을 고른다.
export function artOf(toolName: string): Art {
  if (toolName === 'sql') return 'code'
  if (toolName === 'companion') return 'diagram'
  return 'doc'
}

// 11월 15일 같은 짧은 날짜. 값이 없으면 빈 문자열이다.
export function monthDay(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// 11월 15일 18:00 같은 날짜와 시각. 값이 없으면 빈 문자열이다.
export function dateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${monthDay(value)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Theme = 'light' | 'dark'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // 저장이 막힌 환경에서는 모드를 기억하지 않는다.
    }
  }, [theme])
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

/** 지금 테마. 편집기처럼 색을 직접 정하는 부품이 따라가게 한다 */
export function useTheme(): Theme {
  return useContext(ThemeCtx).theme
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeCtx)
  return (
    <button type="button" className="btn icon quiet" onClick={toggle} aria-label={theme === 'dark' ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  )
}

// 서비스 대표 이미지. 소문자 p 의 둥근 부분 안에 기록을 뜻하는 점을 둔다.
// 다른 화면의 svg 규칙에 크기와 선 굵기가 바뀌지 않도록 값을 style 로 준다.
export function Logo({ size = 20 }: { size?: number }) {
  const line = { fill: 'none', stroke: '#fff', strokeWidth: 3.2 }
  return (
    <svg className="logo" viewBox="0 0 32 32" style={{ width: size, height: size, flex: 'none' }} aria-hidden="true">
      <rect width="32" height="32" rx="8" style={{ fill: '#2563eb', stroke: 'none' }} />
      <path d="M11 9v15.5" style={{ ...line, strokeLinecap: 'round' }} />
      <circle cx="17.4" cy="14" r="5.6" style={line} />
      <circle cx="17.4" cy="14" r="1.9" style={{ fill: '#fff', stroke: 'none' }} />
    </svg>
  )
}

// 색 상자 대신 점과 글자로 상태를 알린다.
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`status ${tone}`}>
      <i />
      {children}
    </span>
  )
}

export function HBar({ value, max = 100, mark, tone, i = 0 }: { value: number; max?: number; mark?: number; tone?: 'mute' | 'ink'; i?: number }) {
  return (
    <div className="hbar">
      <span className={tone} style={vars({ '--v': `${(value / max) * 100}%`, '--i': i })} />
      {mark != null && <b style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  )
}

export function Stack({ parts, i = 0 }: { parts: [number, 'ink' | 'accent' | 'none'][]; i?: number }) {
  return (
    <div className="stack" style={vars({ '--i': i })}>
      {parts
        .filter((p) => p[0] > 0)
        .map(([n, tone], k) => (
          <span key={k} className={tone} style={{ flexGrow: n }} />
        ))}
    </div>
  )
}

export type Group = { label: string; bars: { v: number; mute?: boolean }[] }

// 세로 막대는 처음에 없다가 값만큼 올라온다.
export function Columns({ groups, max, height = 180 }: { groups: Group[]; max: number; height?: number }) {
  let i = 0
  return (
    <div>
      <div className="plot" style={vars({ '--plot-h': `${height}px` })}>
        {groups.map((g) => (
          <div className="slot" key={g.label}>
            {g.bars.map((b, k) => (
              <div key={k} className={b.mute ? 'bw mute' : 'bw'} style={vars({ '--h': `${Math.max(1, (b.v / max) * 100)}%`, '--i': i++ })}>
                <em>{b.v}</em>
                <i />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="plot-x">
        {groups.map((g) => (
          <span key={g.label}>{g.label}</span>
        ))}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: [string, 'ink' | 'accent' | 'mute'][] }) {
  return (
    <div className="legend">
      {items.map(([label, tone]) => (
        <span key={label}>
          <i className={`dot ${tone}`} />
          {label}
        </span>
      ))}
    </div>
  )
}

export function CountUp({ to, digits = 0 }: { to: number; digits?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(to)
      return
    }
    const dur = 700
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setV(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // 화면이 가려져 있어 프레임이 돌지 않아도 최종 값은 맞춘다.
    const done = setTimeout(() => setV(to), dur + 200)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [to])
  return <span className="num">{v.toFixed(digits)}</span>
}

export function Meta({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="meta">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {aside && <div className="actions">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function PageHead({ title, crumbs, children }: { title: ReactNode; crumbs?: [string, string][]; children?: ReactNode }) {
  return (
    <>
      {crumbs && (
        <nav className="crumbs" aria-label="위치">
          {crumbs.map(([label, to]) => (
            <Fragment key={to}>
              <Link to={to}>{label}</Link>
              <ChevronRight />
            </Fragment>
          ))}
        </nav>
      )}
      <header className="page-head">
        <h1>{title}</h1>
        {children && <div className="actions">{children}</div>}
      </header>
    </>
  )
}

const artIcons: Record<Art, LucideIcon> = { code: Code, doc: FileText, diagram: Workflow }

export function ArtIcon({ kind }: { kind: Art }) {
  const Icon = artIcons[kind]
  return <Icon aria-hidden="true" />
}

// 카드 위쪽의 미리보기 그림. 결과물의 종류를 한눈에 알 수 있게 한다.
export function Thumb({ kind }: { kind: Art }) {
  if (kind === 'diagram') {
    return (
      <div className="thumb center" aria-hidden="true">
        <div className="pv-diagram">
          {[0, 1, 2].map((k) => (
            <Fragment key={k}>
              {k > 0 && <span className="wire" />}
              <div className="ent">
                <b />
                <div>
                  <i className="k" style={{ width: '55%' }} />
                  <i style={{ width: '85%' }} />
                  <i style={{ width: '70%' }} />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    )
  }
  if (kind === 'doc') {
    return (
      <div className="thumb" aria-hidden="true">
        <div className="pv doc">
          <i className="h" style={{ width: '44%' }} />
          <i style={{ width: '92%' }} />
          <i style={{ width: '80%' }} />
          <div className="tbl">
            {Array.from({ length: 6 }).map((_, k) => (
              <span key={k} />
            ))}
          </div>
          <i style={{ width: '88%' }} />
          <i style={{ width: '64%' }} />
        </div>
      </div>
    )
  }
  const lines: [string, number][][] = [
    [['k', 26], ['', 52]],
    [['k', 20], ['', 38]],
    [['sp', 0], ['k', 42], ['', 30], ['s', 34]],
    [['k', 34], ['', 56]],
    [['k', 44], ['s', 14]],
    [['k', 28], ['', 44]],
    [['k', 22], ['', 50]],
  ]
  return (
    <div className="thumb" aria-hidden="true">
      <div className="pv code">
        {lines.map((ln, r) => (
          <div className="ln" key={r}>
            {ln.map(([c, w], k) => (
              <i key={k} className={c} style={c === 'sp' ? undefined : { width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 클립보드 권한이 없으면 표시만 바꾼다.
    }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button type="button" className="btn" onClick={copy}>
      {done ? <Check /> : <Copy />}
      {done ? '복사됨' : label}
    </button>
  )
}

export function Saved({ show }: { show: boolean }) {
  return show ? (
    <span className="status done" role="status">
      <i />
      저장됨
    </span>
  ) : null
}

export function Loading({ text = '불러오는 중' }: { text?: string }) {
  return (
    <div className="empty" role="status">
      {text}
    </div>
  )
}

// 저장 결과나 오류를 알리는 한 줄. 닫기 버튼이 있다.
export function Notice({ kind = 'info', children, onClose }: { kind?: 'info' | 'error'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={kind === 'error' ? 'notice error' : 'notice'} role={kind === 'error' ? 'alert' : 'status'}>
      <p>{children}</p>
      {onClose && (
        <button type="button" className="btn quiet" onClick={onClose}>
          닫기
        </button>
      )}
    </div>
  )
}
