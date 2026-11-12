import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="auth">
      <div className="auth-box">
        <h1>페이지를 찾을 수 없다</h1>
        <p>주소가 바뀌었거나 삭제된 과제일 수 있다.</p>
        <div className="inline">
          <Link className="btn primary" to="/">
            처음으로
          </Link>
        </div>
      </div>
    </div>
  )
}
