# 학습 도우미 프런트엔드

AI 우왕톤 출품작의 화면이다. React와 Vite와 TypeScript로 만들고, 백엔드는 별도의 BE 저장소에 있는 FastAPI 서버다. 서비스 설명과 기술 선택 이유와 아키텍처는 BE 저장소의 README에 있다.

## 화면 구성

- 공통: 로그인과 회원가입, 교수와 학생 역할.
- 교수: 과제 목록, 과제 설정 여섯 구역(기본 정보와 역량과 채점 기준, 사전 사후 문항, 과제 문제, 학습 자료, AI 응답 규칙, 도구 연동), 반 전체 현황, 학생별 상세와 점수 입력.
- 학생: 과제 참여, 사전평가, 학습 단계(역량 상태, 확인 문항, 산파술 대화), 과제 단계(도구 영역, 버전 저장, AI 대화, 제출과 재제출), 사후평가.
- 과제 단계 도구: 자리 0 문서 편집기, 자리 1 Monaco 편집기와 sql.js, 자리 2 Google 문서 연결과 문서 탭 위 AI 창(Document Picture-in-Picture 또는 별도 창), 자리 3 보조 프로그램 연결 토큰.
- 보조 프로그램 AI 패널 `/companion-panel/:eid`와 별도 창 `/stu/enrollments/:eid/chat`.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173, /api 는 http://localhost:8000 으로 프록시
npm run build      # dist/ 를 FastAPI 가 같이 서비스한다
npx tsc -b         # 타입 검사
```

`public/sql-wasm-browser.wasm`은 sql.js 1.15의 브라우저 빌드이며 `node_modules/sql.js/dist/`에서 복사했다.

## 오픈소스 출처

| 항목 | 출처 | 사용 범위 |
|---|---|---|
| React, react-router-dom | https://react.dev, https://reactrouter.com | 화면과 라우팅, MIT |
| Vite | https://vite.dev | 개발 서버와 빌드, MIT |
| @monaco-editor/react, Monaco Editor | https://github.com/suren-atoyan/monaco-react, https://microsoft.github.io/monaco-editor | 자리 1 코드 편집기, 자동 완성 끔, MIT |
| sql.js | https://github.com/sql-js/sql.js | 브라우저 안 SQLite 실행, MIT |
