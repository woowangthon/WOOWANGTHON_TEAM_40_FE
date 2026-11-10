import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

// 화면 어딘가에서 예외가 나도 빈 화면 대신 안내와 다시 시도 버튼을 보여 준다.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('화면 오류', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card" style={{ maxWidth: 560, margin: '60px auto' }}>
        <h1>화면을 그리다 문제가 생겼다</h1>
        <p className="muted small">{this.state.error.message}</p>
        <div className="row">
          <button className="btn" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
          <a className="btn btn-ghost" href="/">
            처음으로
          </a>
        </div>
      </div>
    )
  }
}
