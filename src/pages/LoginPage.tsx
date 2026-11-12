import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'

import { api, type Role, type SocialProvider } from '../api'
import githubDark from '../assets/github-dark.svg'
import githubLight from '../assets/github.svg'
import { useAuth } from '../auth'
import { APP_NAME, homePath } from '../nav'
import { Logo, Notice, ThemeToggle, vars } from '../ui'
import './login.css'

function takeExpiredFlag(): boolean {
  try {
    const v = sessionStorage.getItem('woowang_expired') === '1'
    sessionStorage.removeItem('woowang_expired')
    return v
  } catch {
    return false
  }
}

// 로그인 전에 열려던 주소. 그 역할이 볼 수 있는 주소일 때만 로그인 뒤에 그곳으로 돌아간다.
function returnPath(state: unknown, role: Role): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from
  const path = from?.pathname ?? ''
  if (path.startsWith(homePath(role))) return path + (from?.search ?? '')
  return homePath(role)
}

// 로그인 화면 오른쪽 사진. public/login 의 파일만 바꾸면 사진이 교체된다. 출처는 README 에 적었다.
const PHOTOS = ['/login/photo-1.webp', '/login/photo-2.webp']
// 한 장이 머무는 시간. W3C 예제와 Bootstrap 의 기본값 5초를 하한으로 보고 그보다 길게 둔다.
const HOLD_MS = 8000
// 겹쳐 넘어가는 시간. Material 3 가 자동으로 넘어가는 배경 전환에 쓰는 가장 긴 값이다.
const FADE_MS = 1000

function LoginPhotos() {
  const [i, setI] = useState(0)
  // 움직임을 줄이도록 설정한 사용자에게는 자동 전환을 하지 않는다.
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  // 마우스를 올리거나 키보드 초점이 들어와 있는 동안에도 멈춘다.
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (paused || held) return
    const t = setTimeout(() => setI((n) => (n + 1) % PHOTOS.length), HOLD_MS)
    return () => clearTimeout(t)
  }, [i, paused, held])

  return (
    <div
      className="photos"
      style={vars({ '--fade': `${FADE_MS}ms` })}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {PHOTOS.map((src, k) => (
        <img key={src} src={src} alt="" className={k === i ? 'on' : ''} decoding="async" />
      ))}
      <div className="photo-ctl">
        {PHOTOS.map((src, k) => (
          <button key={src} type="button" aria-label={`사진 ${k + 1} 보기`} aria-pressed={k === i} onClick={() => setI(k)}>
            <span className={k === i ? 'bar on' : 'bar'} />
          </button>
        ))}
        <button type="button" aria-label={paused ? '사진 전환 다시 시작' : '사진 전환 멈춤'} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

// Google 로그인 버튼에 쓰는 G 마크. Google 이 버튼 코드로 공개한 SVG 경로다.
// 버튼의 문구와 바탕과 테두리 색은 https://developers.google.com/identity/branding-guidelines 를 따른다.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function LoginPage({ initialMode }: { initialMode?: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mode = initialMode ?? 'login'
  const [expired] = useState(takeExpiredFlag)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 서버에 키가 설정된 소셜 로그인만 버튼으로 보여 준다. 설정이 없으면 버튼이 없다.
  const [providers, setProviders] = useState<SocialProvider[]>([])

  useEffect(() => {
    api.auth
      .socialProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]))
  }, [])

  // 소셜 로그인 화면으로 갔다가 뒤로 오면 브라우저가 떠나기 직전의 화면을 그대로 되살린다.
  // 그때 버튼이 눌린 채 잠겨 있지 않도록 상태를 푼다.
  useEffect(() => {
    const unlock = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', unlock)
    return () => window.removeEventListener('pageshow', unlock)
  }, [])

  if (user) return <Navigate to={returnPath(location.state, user.role)} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'signup' && password !== confirm) {
      setError('비밀번호와 비밀번호 확인이 다르다')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const u = mode === 'login' ? await login(email, password) : await signup(email, password, name, role)
      navigate(returnPath(location.state, u.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패했다')
    } finally {
      setBusy(false)
    }
  }

  async function social(provider: SocialProvider) {
    setBusy(true)
    setError(null)
    try {
      const { url } = await api.auth.socialStart(provider, mode === 'signup' ? { mode, role } : { mode })
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : '소셜 로그인을 시작하지 못했다')
      setBusy(false)
    }
  }

  const social_label = mode === 'login' ? '로 계속하기' : '로 가입하기'
  return (
    <div className="au">
      <Link to="/" className="au-brand">
        <Logo size={26} />
        {APP_NAME}
      </Link>
      <div className="au-main">
        <form className="au-box" key={mode} onSubmit={(e) => void submit(e)}>
          <h1>과정을 위한 AI</h1>
          {expired && <Notice>로그인이 만료되어 다시 로그인한다. 작업 중이던 내용은 저장된 버전까지 남아 있다.</Notice>}

          {mode === 'signup' && (
            <div className="au-role" role="group" aria-label="역할">
              <button type="button" aria-pressed={role === 'student'} onClick={() => setRole('student')}>
                학생
              </button>
              <button type="button" aria-pressed={role === 'professor'} onClick={() => setRole('professor')}>
                교수
              </button>
            </div>
          )}

          {providers.includes('google') && (
            <button type="button" className="au-social" disabled={busy} onClick={() => void social('google')}>
              <GoogleMark />
              Google{social_label}
            </button>
          )}
          {providers.includes('github') && (
            <button type="button" className="au-social" disabled={busy} onClick={() => void social('github')}>
              <img className="only-light" src={githubLight} alt="" />
              <img className="only-dark" src={githubDark} alt="" />
              GitHub{social_label}
            </button>
          )}
          {providers.length > 0 && <div className="au-or">또는</div>}

          {mode === 'signup' && (
            <input className="au-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" placeholder="이름 입력" aria-label="이름" required />
          )}
          <input className="au-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="이메일 입력" aria-label="이메일" required />
          <input
            className="au-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? '비밀번호 입력' : '비밀번호 입력, 8자 이상'}
            aria-label="비밀번호"
            required
          />
          {mode === 'signup' && (
            <input
              className="au-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="비밀번호 다시 입력"
              aria-label="비밀번호 확인"
              required
            />
          )}
          {error && (
            <p className="au-error" role="alert">
              {error}
            </p>
          )}
          <button className="au-submit" type="submit" disabled={busy}>
            {mode === 'login' ? '이메일로 로그인' : '이메일로 가입하기'}
          </button>

          <div className="au-links">
            <span>
              {mode === 'login' ? '계정이 없다면 ' : '이미 계정이 있다면 '}
              <Link to={mode === 'login' ? '/signup' : '/login'} state={location.state}>
                {mode === 'login' ? '회원가입' : '로그인'}
              </Link>
            </span>
            <Link to="/privacy">개인정보와 기록 범위 안내</Link>
          </div>
        </form>
      </div>
      <LoginPhotos />
      <div className="au-theme">
        <ThemeToggle />
      </div>
    </div>
  )
}
