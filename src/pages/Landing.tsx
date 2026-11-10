import { Link, Navigate } from 'react-router-dom'

import { APP_NAME } from '../App'
import { useAuth } from '../auth'

// 로그인하지 않은 사람이 처음 보는 소개 페이지. 로그인한 사람은 역할별 홈으로 보낸다.
export default function Landing() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">불러오는 중</p>
  if (user) return <Navigate to={user.role === 'professor' ? '/prof' : '/stu'} replace />

  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">AI는 동료가 될 수 있는가, 대학 수업에서</p>
        <h1>{APP_NAME}</h1>
        <p className="lead">
          답을 대신 써 주는 AI가 아니라, 산파술로 되물어 학생이 스스로 과제를 해결하게 돕는 학습 도우미다. 학생의 출발점을 재고,
          부족한 역량을 채우고, 결과물이 만들어지는 과정을 기록해 교수가 과정 전체를 보고 평가할 수 있게 한다.
        </p>
        <div className="row">
          <Link className="btn" to="/login">
            로그인
          </Link>
          <Link className="btn btn-secondary" to="/login?mode=signup">
            회원가입
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>네 단계로 진행된다</h2>
        <div className="steps-grid">
          <div>
            <span className="chip chip-primary">1 사전평가</span>
            <p>교수가 역량마다 낸 문항을 풀어 스펙, 즉 역량별 강점과 약점을 잰다.</p>
          </div>
          <div>
            <span className="chip chip-primary">2 학습</span>
            <p>통과 점수에 못 미친 역량이 학습 목표가 된다. AI가 되묻고 확인 문항으로 점수를 갱신한다.</p>
          </div>
          <div>
            <span className="chip chip-primary">3 과제</span>
            <p>도구로 결과물을 만들며 저장할 때마다 변경 이유와 함께 버전이 남는다. AI는 답을 쓰지 않는다.</p>
          </div>
          <div>
            <span className="chip chip-primary">4 사후평가</span>
            <p>같은 역량의 다른 문항으로 늘어난 역량을 잰다. 마감까지 3단계만 다시 해 재제출할 수 있다.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>어떤 도구로든 같은 기록이 남는다</h2>
        <div className="steps-grid three">
          <div>
            <h3>자리 1, 페이지 안 웹 도구</h3>
            <p>Monaco 편집기와 sql.js처럼 우리 페이지 안에 넣은 도구는 저장할 때마다 결과물을 직접 받는다.</p>
          </div>
          <div>
            <h3>자리 2, API로 연동하는 웹 도구</h3>
            <p>Google 문서는 계정을 연결해 수정 이력을 받고, 학습 AI는 문서 탭 위에 작은 창으로 뜬다.</p>
          </div>
          <div>
            <h3>자리 3, 설치된 프로그램</h3>
            <p>Excel 같은 프로그램은 보조 프로그램이 창을 캡처하고 저장 폴더를 감시하며 AI 창을 항상 위에 띄운다.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>교수가 보는 다섯 가지 결과물</h2>
        <p>
          사전평가 점수, 항목별 AI 학습과정 요약, 결과물 변경 이력, 사후평가 점수, 전체 대화 답변이다. AI는 결과물 수정 이력과 대화에서
          위반 의심 신호만 표시하고 최종 판단은 교수가 한다.
        </p>
        <p className="muted small">
          AI 응답은 Gemini 또는 Claude API를 서버에서 호출해 만들며 자체 모델이나 파인튜닝은 없다. 기록 범위는{' '}
          <Link to="/privacy">개인정보와 기록 범위 안내</Link>에 적혀 있다.
        </p>
      </section>
    </div>
  )
}
