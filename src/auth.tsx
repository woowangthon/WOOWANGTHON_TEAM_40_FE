import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, ApiError, getToken, setToken, type Role, type User } from './api'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (email: string, password: string, name: string, role: Role) => Promise<User>
  // 소셜 로그인 뒤 서버가 준 일회용 표를 로그인 토큰으로 바꾼다.
  completeSocial: (ticket: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return
    api.auth
      .me()
      .then(setUser)
      .catch((e: unknown) => {
        // 서버가 토큰을 거절했을 때만 지운다. 서버가 잠깐 응답하지 않은 것이면 남겨 두어 다시 열었을 때 로그인이 이어지게 한다.
        if (e instanceof ApiError && e.status === 401) setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // api.ts가 401을 받으면 이 이벤트를 보낸다. 사용자 상태를 비워 로그인 화면으로 보낸다.
    const onExpired = () => setUser(null)
    window.addEventListener('woowang-auth-expired', onExpired)
    return () => window.removeEventListener('woowang-auth-expired', onExpired)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const signup = useCallback(async (email: string, password: string, name: string, role: Role) => {
    const res = await api.auth.signup({ email, password, name, role })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const completeSocial = useCallback(async (ticket: string) => {
    const res = await api.auth.socialExchange(ticket)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, signup, completeSocial, logout }),
    [user, loading, login, signup, completeSocial, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 밖에서 useAuth를 썼다')
  return ctx
}
