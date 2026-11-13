import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  // 이 값이 바뀌면 오류 화면을 걷고 다시 그린다. 주소를 넘기면 다른 화면으로 옮겼을 때 오류가 따라오지 않는다.
  resetKey?: string
}

interface State {
  error: Error | null
  resetKey?: string
}

// 새 버전을 배포하면 화면 조각 파일의 이름이 바뀐다. 열어 둔 탭이 예전 이름을 찾다가 실패하면 브라우저마다 다른 문장으로 알린다.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i

// 화면 어딘가에서 예외가 나도 빈 화면 대신 안내와 다시 불러오기 버튼을 보여 준다.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('화면 오류', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = CHUNK_ERROR.test(error.message)
    return (
      <div className="auth">
        <div className="auth-box">
          <h1>{stale ? '화면을 다시 불러와야 한다' : '화면을 그리다 문제가 생겼다'}</h1>
          <p>{stale ? '서비스가 새 버전으로 바뀌어 이 탭이 받아 둔 화면 파일을 찾지 못했다. 다시 불러오면 이어서 쓸 수 있다' : error.message}</p>
          <div className="inline">
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              다시 불러오기
            </button>
            <a className="btn" href="/">
              처음으로
            </a>
          </div>
        </div>
      </div>
    )
  }
}
