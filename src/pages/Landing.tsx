import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ClipboardCheck, ClipboardList, FileCode2, FileText, FolderCode, Lock, MessagesSquare, Play, Send, Sparkles } from 'lucide-react'

import { APP_EXPANSION, APP_NAME } from '../nav'
import { Logo, ThemeToggle } from '../ui'
import './landing.css'

// 로그인하지 않은 사람이 처음 보는 소개 화면.
// 화면 안의 제품 그림은 실제 화면을 본떠 그린 것이고 안의 자료는 예시 데이터다.

const vars = (v: Record<string, string | number>) => v as CSSProperties

// 화면에 들어온 요소에 in 클래스를 붙여 나타나는 효과를 켠다
function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const targets = el.querySelectorAll('[data-reveal]')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])
  return root
}

// 같은 화면 안의 구역으로 부드럽게 내려간다
function toSection(e: MouseEvent<HTMLAnchorElement>) {
  const id = e.currentTarget.getAttribute('href')?.slice(1)
  const target = id ? document.getElementById(id) : null
  if (!target) return
  e.preventDefault()
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
}

// ---------- 히어로의 제품 그림. 과제 단계 작업공간 ----------
const CODE: [string, 'ctx' | 'del' | 'add'][] = [
  ['def round_robin(tasks, quantum):', 'ctx'],
  ['    queue = deque(tasks)', 'ctx'],
  ['    timeline = []', 'ctx'],
  ['    while queue:', 'ctx'],
  ['        name, remaining = queue.popleft()', 'ctx'],
  ['        run_time = min(quantum, remaining)', 'del'],
  ['        if remaining == 0:', 'add'],
  ['            continue', 'add'],
  ['        run_time = min(quantum, remaining)', 'add'],
  ['        timeline.append((name, run_time))', 'ctx'],
  ['        remaining -= run_time', 'ctx'],
]

function HeroShot() {
  return (
    <div className="lp-app" aria-hidden="true">
      <aside className="lp-app-side">
        <div className="lp-app-title">
          <Logo size={18} />
          Round Robin 스케줄러
        </div>
        <ul className="lp-app-list">
          <li className="done">
            <Check />
            사전평가
          </li>
          <li className="done">
            <Check />
            학습
          </li>
          <li className="now">
            <FolderCode />
            과제
          </li>
          <li>
            <Lock />
            사후평가
          </li>
        </ul>
        <div className="lp-app-label">파일</div>
        <ul className="lp-app-list">
          <li className="now">
            <FileCode2 />
            scheduler.py
          </li>
          <li>
            <FileCode2 />
            test_scheduler.py
          </li>
          <li>
            <FileText />
            report.docx
          </li>
        </ul>
        <div className="lp-app-label">실행 환경</div>
        <ul className="lp-app-list">
          <li>
            <Play />
            Ubuntu 22.04 LTS
          </li>
        </ul>
      </aside>
      <div className="lp-app-main">
        <div className="lp-app-bar">
          <span className="lp-dot warn" />
          <b>scheduler.py</b>
          <span>버전 12</span>
          <span className="end">테스트 5개 중 4개 통과</span>
        </div>
        <div className="lp-app-body">
          <pre className="lp-code">
            {CODE.map(([text, kind], i) => (
              <span key={i} className={kind}>
                <i>{kind === 'del' ? '-' : kind === 'add' ? '+' : ' '}</i>
                {text}
              </span>
            ))}
          </pre>
          <div className="lp-act">
            <div className="lp-act-h">기록</div>
            <div className="lp-act-row">
              <span className="lp-dot" />
              <b>직접 수정</b> 준비 큐를 deque 로 바꿨다 <span>4분 전</span>
            </div>
            <div className="lp-act-row">
              <span className="lp-dot run" />
              <b>실행</b> 테스트 5개 중 4개 통과 <span>2분 전</span>
            </div>
            <div className="lp-act-row">
              <span className="lp-dot ai" />
              <b>AI 수정안</b> 실행 시간이 0인 작업을 건너뛴다 <span>방금</span>
            </div>
          </div>
        </div>
        <div className="lp-agent">
          <div className="lp-agent-h">
            <Sparkles />
            <b>AI</b>
          </div>
          <div className="lp-agent-msg">실행 시간이 0인 작업이 들어오면 건너뛰게 고쳐 줘</div>
          <div className="lp-agent-diff">
            <span className="del">- run_time = min(quantum, remaining)</span>
            <span className="add">+ if remaining == 0:</span>
            <span className="add">+ continue</span>
          </div>
          <div className="lp-agent-btns">
            <span className="on">수락</span>
            <span>고쳐서 반영</span>
            <span>거절</span>
          </div>
          <div className="lp-agent-input">
            요청을 입력한다
            <Send />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- 기능 구역 ----------
function Feature({ id, title, lead, children }: { id: string; title: [string, string]; lead: string; children: ReactNode }) {
  return (
    <section className="lp-feature" id={id}>
      <div className="lp-wrap">
        <div className="lp-feature-head" data-reveal>
          <h2 className="lp-h2">
            {title[0]}
            <br />
            {title[1]}
          </h2>
          <p className="lp-lead">{lead}</p>
        </div>
        <div className="lp-visual" data-reveal aria-hidden="true">
          {children}
        </div>
      </div>
    </section>
  )
}

function Bar({ label, value, pass, state }: { label: string; value: number; pass: number; state: string }) {
  return (
    <div className="lp-bar">
      <span>{label}</span>
      <div className="lp-bar-track">
        <i style={vars({ '--w': `${value}%` })} />
        <em style={vars({ '--x': `${pass}%` })} />
      </div>
      <b>{value}</b>
      <span className={value >= pass ? 'ok' : 'goal'}>{state}</span>
    </div>
  )
}

function VisualPre() {
  return (
    <>
      <div className="lp-card front" style={vars({ '--x': '0%', '--y': '0px', '--w': '44%' })}>
        <div className="lp-card-h">
          <ClipboardList />
          <b>사전평가</b>
        </div>
        <div className="lp-card-b">
          <p className="lp-q">Round Robin 에서 한 작업이 한 번에 CPU 를 쓸 수 있는 최대 시간을 무엇이라 하는가</p>
          <div className="lp-field">시간 할당량</div>
          <p className="lp-q">선점형 스케줄링에 해당하는 것은</p>
          <div className="lp-opts">
            <span>FCFS</span>
            <span>비선점 SJF</span>
            <span className="on">Round Robin</span>
          </div>
        </div>
      </div>
      <div className="lp-card back" style={vars({ '--x': '46%', '--y': '56px', '--w': '54%' })}>
        <div className="lp-card-h">
          <b>내 스펙</b>
        </div>
        <div className="lp-card-b">
          <Bar label="CPU 스케줄링 개념" value={100} pass={60} state="통과" />
          <Bar label="Round Robin 동작" value={100} pass={60} state="통과" />
          <Bar label="시간 할당량 분석" value={35} pass={60} state="학습 목표" />
        </div>
      </div>
    </>
  )
}

function VisualLearning() {
  return (
    <>
      <div className="lp-card front" style={vars({ '--x': '0%', '--y': '0px', '--w': '40%' })}>
        <div className="lp-card-h">
          <MessagesSquare />
          <b>학습</b>
        </div>
        <div className="lp-card-b lp-chat">
          <div className="me">시간 할당량을 작게 잡으면 뭐가 문제야?</div>
          <div className="ai">
            <span className="lp-tag">되묻기</span>
            작업이 바뀔 때마다 운영체제가 추가로 하는 일이 있다. 그 일이 무엇인지 떠올려 보겠는가
          </div>
          <div className="me">문맥 교환</div>
          <div className="ai">
            <span className="lp-tag">직접 답</span>
            맞다. 할당량이 작을수록 문맥 교환이 잦아지고 그 비용이 실제 작업 시간을 잠식한다
          </div>
        </div>
      </div>
      <div className="lp-card back" style={vars({ '--x': '42%', '--y': '48px', '--w': '58%' })}>
        <div className="lp-card-h">
          <ClipboardCheck />
          <b>사전평가에서 틀린 문항</b>
        </div>
        <div className="lp-card-b">
          <p className="lp-q">시간 할당량을 아주 작게 잡으면 어떤 문제가 생기는지 설명하라</p>
          <p className="lp-answer">
            할당량이 작으면 <s>작업이 더 빨리 끝난다</s>
          </p>
          <div className="lp-basis criteria">
            <b>교수 채점 기준</b>문맥 교환 비용과 응답 시간으로 설명해야 한다
          </div>
          <div className="lp-basis material">
            <b>학습 자료</b>강의 자료 4장의 문맥 교환 절
          </div>
          <div className="lp-basis ai">
            <b>AI 판단</b>완료 시간과 응답 시간을 구분하지 못했다
          </div>
        </div>
      </div>
    </>
  )
}

const VERSIONS: [string, string, string, string][] = [
  ['12', 'ai', 'AI 수정안 수락', '실행 시간이 0인 작업을 건너뛴다'],
  ['11', 'run', '실행', '테스트 5개 중 4개 통과'],
  ['10', 'paste', '붙여넣기', '외부에서 가져온 14줄'],
  ['9', 'me', '직접 수정', '준비 큐를 deque 로 바꿨다'],
]

function VisualTask() {
  return (
    <>
      <div className="lp-card back" style={vars({ '--x': '0%', '--y': '40px', '--w': '64%' })}>
        <div className="lp-card-h">
          <FolderCode />
          <b>결과물 변경 이력</b>
        </div>
        <div className="lp-card-b">
          {VERSIONS.map(([no, kind, label, text]) => (
            <div className="lp-ver" key={no}>
              <span className="no">버전 {no}</span>
              <span className={`lp-dot ${kind}`} />
              <b>{label}</b>
              <span>{text}</span>
            </div>
          ))}
          <pre className="lp-code small">
            <span className="del">
              <i>-</i> run_time = min(quantum, remaining)
            </span>
            <span className="add">
              <i>+</i> if remaining == 0:
            </span>
            <span className="add">
              <i>+</i>     continue
            </span>
          </pre>
        </div>
      </div>
      <div className="lp-card front" style={vars({ '--x': '58%', '--y': '0px', '--w': '42%' })}>
        <div className="lp-card-h">
          <Play />
          <b>실행 환경</b>
        </div>
        <div className="lp-card-b lp-env">
          <div>
            <span>운영체제</span>
            <b>Ubuntu 22.04 LTS</b>
          </div>
          <div>
            <span>언어</span>
            <b>Python 3.10, g++ 11, OpenJDK 17</b>
          </div>
          <div>
            <span>패키지</span>
            <b>valgrind, numpy</b>
          </div>
          <div>
            <span>컴파일</span>
            <b>-std=c++17 -O2 -Wall</b>
          </div>
          <div className="lp-env-pick">
            <span className="on">이 환경으로 실행</span>
            <span>기본 환경</span>
          </div>
        </div>
      </div>
    </>
  )
}

const STUDENTS: [string, string, string, string, string][] = [
  ['박지훈', '과제', '33', '', '3건'],
  ['이서연', '제출', '100', '100', '1건'],
  ['최유진', '학습', '67', '', ''],
  ['홍길동', '제출', '33', '83', '6건'],
]

function VisualReview() {
  return (
    <>
      <div className="lp-card back" style={vars({ '--x': '0%', '--y': '0px', '--w': '63%' })}>
        <div className="lp-card-h">
          <b>과제 현황</b>
        </div>
        <div className="lp-card-b">
          <div className="lp-trow head">
            <span>이름</span>
            <span>단계</span>
            <span>사전</span>
            <span>사후</span>
            <span>AI 수정안 수락</span>
          </div>
          {STUDENTS.map(([name, stage, pre, post, ai]) => (
            <div className="lp-trow" key={name}>
              <b>{name}</b>
              <span>
                <i className={`lp-dot ${stage === '제출' ? 'me' : 'ai'}`} />
                {stage}
              </span>
              <span>{pre}</span>
              <span>{post}</span>
              <span>{ai}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="lp-card front" style={vars({ '--x': '60%', '--y': '72px', '--w': '40%' })}>
        <div className="lp-card-h">
          <b>홍길동</b>
        </div>
        <div className="lp-card-b">
          <Bar label="CPU 스케줄링 개념" value={100} pass={60} state="통과" />
          <Bar label="Round Robin 동작" value={90} pass={60} state="통과" />
          <Bar label="시간 할당량 분석" value={60} pass={60} state="통과" />
          <div className="lp-grade">
            <span>과제 점수</span>
            <div className="lp-field">88</div>
            <span className="lp-pill sm">평가 저장</span>
          </div>
        </div>
      </div>
    </>
  )
}

const HEADLINE = [
  ['AI와', '함께', '배운', '과정을'],
  ['기록하고', '평가한다'],
]
// 줄마다 앞줄까지의 낱말 수. 낱말이 차례로 나타나는 순서를 정한다
const LINE_START = HEADLINE.map((_, li) => HEADLINE.slice(0, li).reduce((n, line) => n + line.length, 0))

export default function Landing() {
  const root = useReveal()
  return (
    <div className="lp" ref={root}>
      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <Link to="/" className="lp-logo">
            <Logo size={24} />
            {APP_NAME}
          </Link>
          <nav className="lp-nav" aria-label="소개 구역">
            <a href="#pre" onClick={toSection}>
              사전평가
            </a>
            <a href="#learning" onClick={toSection}>
              학습
            </a>
            <a href="#task" onClick={toSection}>
              과제
            </a>
            <a href="#review" onClick={toSection}>
              평가
            </a>
            <Link to="/privacy">기록 범위</Link>
          </nav>
          <span className="lp-sep" aria-hidden="true" />
          <Link to="/login" className="lp-navlink">
            로그인
          </Link>
          <Link to="/signup" className="lp-pill sm">
            회원가입
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero lp-wrap">
          <h1 className="lp-h1" aria-label={HEADLINE.map((l) => l.join(' ')).join(' ')}>
            {HEADLINE.map((line, li) => (
              <span className="lp-line" key={li} aria-hidden="true">
                {line.map((w, wi) => (
                  <span className="lp-word" key={w} style={vars({ '--i': LINE_START[li] + wi })}>
                    {w}
                  </span>
                ))}
              </span>
            ))}
          </h1>
        </section>

        <div className="lp-stage">
          <div className="lp-frame">
            <HeroShot />
          </div>
        </div>

        <Feature
          id="pre"
          title={['사전평가와', '스펙 판정']}
          lead="과제를 풀기 전에 학생이 무엇을 알고 무엇을 모르는지 역량별로 잰다. 통과 점수에 못 미친 역량이 학습 목표가 된다."
        >
          <VisualPre />
        </Feature>

        <Feature
          id="learning"
          title={['되묻는', '학습']}
          lead="부족한 역량을 AI와 대화하며 채운다. AI는 답을 대신 주지 않고 질문으로 학생이 스스로 답에 이르게 한다."
        >
          <VisualLearning />
        </Feature>

        <Feature
          id="task"
          title={['기록되는', '과제']}
          lead="과제 단계에서는 AI 사용을 막지 않는다. 대신 무엇을 요청했고 무엇을 받아들였는지를 버전마다 남긴다."
        >
          <VisualTask />
        </Feature>

        <Feature
          id="review"
          title={['과정을 보는', '평가']}
          lead="교수는 반 전체의 흐름과 학생 한 명의 기록을 나눠 본다. 사전과 사후 점수, 변경 이력, 전체 대화가 한곳에 있다."
        >
          <VisualReview />
        </Feature>

        <section className="lp-cta" data-reveal>
          <div className="lp-wrap">
            <h2>
              결과가 아닌 과정으로.
              <br />
              지금 시작한다.
            </h2>
            <div>
              <Link to="/signup" className="lp-pill">
                회원가입
              </Link>
              <Link to="/login" className="lp-pill ghost">
                로그인
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <div className="lp-footer-brand">
            <Link to="/" className="lp-logo">
              <Logo size={22} />
              {APP_NAME}
            </Link>
            <span>{APP_EXPANSION}</span>
          </div>
          <div>
            <h3>서비스</h3>
            <ul>
              <li>
                <Link to="/login">로그인</Link>
              </li>
              <li>
                <Link to="/signup">회원가입</Link>
              </li>
              <li>
                <Link to="/privacy">개인정보와 기록 범위</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>과정</h3>
            <ul>
              <li>
                <a href="#pre" onClick={toSection}>
                  사전평가
                </a>
              </li>
              <li>
                <a href="#learning" onClick={toSection}>
                  학습
                </a>
              </li>
              <li>
                <a href="#task" onClick={toSection}>
                  과제
                </a>
              </li>
              <li>
                <a href="#review" onClick={toSection}>
                  평가
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3>화면</h3>
            <ul>
              <li className="lp-footer-theme">
                화면 모드
                <ThemeToggle />
              </li>
            </ul>
          </div>
        </div>
        <div className="lp-wrap lp-footer-note">
          <span>Copyright © 2026 {APP_NAME}. All rights reserved.</span>
          <span className="lp-contact">
            Contact
            <a href="mailto:whddms@chungbuk.ac.kr">whddms@chungbuk.ac.kr</a>
            <a href="mailto:rahahaha@gmail.com">rahahaha@gmail.com</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
