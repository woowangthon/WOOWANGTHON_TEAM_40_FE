import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth'
import { APP_NAME, homePath } from '../nav'
import { Loading, Notice } from '../ui'

// 서버가 돌려보낸 실패 이유를 문장으로 바꾼다.
const REASON: Record<string, string> = {
  denied: '소셜 계정 연결을 취소했다.',
  no_account: '이 이메일로 가입된 계정이 없다. 회원가입 화면에서 역할을 고른 뒤 소셜 계정으로 가입한다.',
  password_account: '이 이메일은 비밀번호로 가입한 계정이다. 이메일과 비밀번호로 로그인한다.',
  email: '소셜 계정에서 확인된 이메일을 받지 못했다.',
  state: '요청이 만료되었다. 처음부터 다시 시도한다.',
  provider: '소셜 계정 서버에서 정보를 받지 못했다. 잠시 뒤 다시 시도한다.',
}

// 소셜 로그인을 마치고 돌아오는 주소. 서버가 준 일회용 표를 로그인 토큰으로 바꾼 뒤 역할별 홈으로 간다.
export default function SocialCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { completeSocial } = useAuth()
  const ticket = params.get('ticket')
  const reason = params.get('error')
  const [error, setError] = useState<string | null>(reason ? (REASON[reason] ?? '소셜 로그인에 실패했다.') : ticket ? null : '잘못된 접근이다.')
  // 개발 모드에서 효과가 두 번 실행되어도 표는 한 번만 쓴다.
  const used = useRef(false)

  useEffect(() => {
    if (!ticket || reason || used.current) return
    used.current = true
    completeSocial(ticket)
      .then((u) => navigate(homePath(u.role), { replace: true }))
      .catch((e: Error) => setError(e.message))
  }, [ticket, reason, completeSocial, navigate])

  if (!error) return <Loading text="로그인하는 중" />
  return (
    <div className="auth">
      <div className="auth-box">
        <span className="brand">{APP_NAME}</span>
        <h1>소셜 로그인</h1>
        <Notice kind="error">{error}</Notice>
        <div className="inline">
          <Link className="btn primary" to="/login">
            로그인 화면으로
          </Link>
          <Link className="btn" to="/signup">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  )
}
