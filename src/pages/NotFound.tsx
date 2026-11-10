import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center' }}>
      <h1>페이지를 찾을 수 없다</h1>
      <p className="muted">주소가 바뀌었거나 삭제된 과제일 수 있다.</p>
      <Link className="btn" to="/">
        처음으로
      </Link>
    </div>
  )
}
