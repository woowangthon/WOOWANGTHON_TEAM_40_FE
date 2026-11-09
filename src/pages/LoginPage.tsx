import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import type { Role } from '../api'
import { useAuth } from '../auth'

export default function LoginPage() {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const u = mode === 'login' ? await login(email, password) : await signup(email, password, name, role)
      navigate(u.role === 'professor' ? '/prof' : '/stu', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패했다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login card">
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
      <p className="muted small">교수와 학생 역할로 나뉜다. 교수는 과제를 만들고 학생은 과제 코드로 참여한다.</p>
      <form onSubmit={(e) => void submit(e)}>
        {mode === 'signup' && (
          <>
            <div className="field">
              <label>이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>역할</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="student">학생</option>
                <option value="professor">교수</option>
              </select>
            </div>
          </>
        )}
        <div className="field">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>비밀번호, 8자 이상</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </div>
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {mode === 'login' ? '로그인' : '가입하고 시작'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError(null)
            }}
          >
            {mode === 'login' ? '계정이 없다면 회원가입' : '이미 계정이 있다면 로그인'}
          </button>
        </div>
      </form>
    </div>
  )
}
