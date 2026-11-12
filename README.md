# 학습 도우미 프런트엔드

AI 우왕톤 출품작의 화면이다. React와 Vite와 TypeScript로 만들고, 백엔드는 별도의 BE 저장소에 있는 FastAPI 서버다. 서비스 설명과 기술 선택 이유와 아키텍처는 BE 저장소의 README에 있다.

## 화면 구성

| 묶음 | 화면 |
|---|---|
| 공통 | 로그인과 회원가입, Google과 GitHub 소셜 로그인, 개인정보와 기록 범위 안내 |
| 교수 | 과제 목록, 과제 만들기, 과제 설정 일곱 구역, 과제 현황 여섯 하위 페이지, 학생 한 명의 기록 다섯 탭 |
| 학생 | 과제 목록과 과제 코드 참여, 과제 개요, 사전평가, 학습, 과제, 사후평가, 결과 요약 |
| 과제 단계의 별도 창 | 보조 프로그램 AI 패널 `/companion-panel/:eid`, 떠 있는 AI 창 `/stu/enrollments/:eid/chat` |

과제 설정의 일곱 구역은 역량과 채점 기준, 사전 사후 평가, 과제 문제, 학습 자료, AI 응답 규칙, 도구 연동, 점검과 공개다. 과제 현황은 개요, 사전평가, 학습, 과제, 사후평가, 학생으로 나뉘고, 학생 한 명의 기록은 개요, 사전 사후 평가, 학습 과정, 결과물 변경 이력, 전체 대화로 나뉜다.

소셜 로그인 버튼은 서버에 키가 설정된 공급자만 보인다. 설정 방법은 BE 저장소 README의 소셜 로그인 절에 있다.

## 구조

- `src/design.css` 는 색 토큰과 부품 규칙이다. 라이트와 다크 두 모드를 같은 변수 이름으로 다룬다.
- `src/ui.tsx` 는 상태 표시, 막대, 요약 띠, 알림 같은 공용 부품이다.
- `src/shells.tsx` 는 사이드바가 있는 화면 뼈대다. 사이드바의 메뉴는 지금 있는 곳에 따라 바뀐다.
- `src/nav.ts` 는 메뉴와 단계의 이름과 주소와 아이콘 정의다.
- `src/pages` 아래에 화면이 있다.

디자인 기준은 [docs/UI_UX_가이드.md](docs/UI_UX_가이드.md)에 정리했다.

### 과제 단계 화면과 예전 스타일

과제 단계 화면은 다른 팀원이 맡아 예전 스타일시트 `src/styles.css` 를 그대로 쓴다. 두 스타일이 섞이지 않도록 과제 단계 화면은 `legacy` 클래스를 가진 영역으로 감싸고, `vite.config.ts` 의 작은 플러그인이 `src/styles.css` 를 그 영역 안에서만 적용되게 감싼다. 새 부품 규칙은 그 영역 밖에서만 적용된다. `src/styles.css` 파일은 고치지 않았으므로 과제 단계 쪽 변경과 합칠 때 스타일시트에서 충돌이 나지 않는다. 예전 변수 이름은 새 색 토큰에 이어 두어 과제 단계 화면도 다크 모드를 따른다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173, /api 는 http://localhost:8000 으로 프록시
npm run build      # dist/ 를 FastAPI 가 같이 서비스한다
npx tsc -b         # 타입 검사
```

주소 뒤에 `?theme=dark` 나 `?theme=light` 를 붙이면 그 모드로 열린다.

`public/sql-wasm-browser.wasm`은 sql.js 1.15의 브라우저 빌드이며 `node_modules/sql.js/dist/`에서 복사했다.

## 데이터와 오픈소스 출처

확인일은 2026년 11월 12일이다.

| 항목 | 출처 | 사용 범위와 라이선스 |
|---|---|---|
| React, react-router-dom | https://react.dev, https://reactrouter.com | 화면과 라우팅, MIT |
| Vite | https://vite.dev | 개발 서버와 빌드, MIT |
| @monaco-editor/react, Monaco Editor | https://github.com/suren-atoyan/monaco-react, https://microsoft.github.io/monaco-editor | 자리 1 코드 편집기, 자동 완성 끔, MIT |
| sql.js | https://github.com/sql-js/sql.js | 브라우저 안 SQLite 실행, MIT |
| Pretendard 1.3.9 | https://github.com/orioncactus/pretendard | 화면 글꼴, SIL OFL 1.1 |
| lucide-react 0.552.0 | https://lucide.dev | 메뉴와 버튼의 아이콘, ISC |
| 로그인 사진 `public/login/photo-1.webp` | Annie Spratt, https://unsplash.com/photos/QckxruozjRg | 로그인 화면 배경 사진, Unsplash License |
| 로그인 사진 `public/login/photo-2.webp` | Vitaly Gariev, https://unsplash.com/photos/vasBHKO3GSs | 로그인 화면 배경 사진, Unsplash License |
| GitHub 마크 `src/assets/github.svg`, `github-dark.svg` | SVGL, https://github.com/pheralb/svgl | GitHub 로그인 버튼, 저장소는 MIT이고 마크 사용은 GitHub 로고 정책을 따름 |
| Google G 마크 | Google Identity 브랜드 안내, https://developers.google.com/identity/branding-guidelines | Google 로그인 버튼, 문구와 색은 안내를 따름 |

사진은 Unsplash에서 가로 1920픽셀 WebP로 받았다. Unsplash License는 https://unsplash.com/license 에 있다.

## 디자인에 참고한 문서

Vercel Geist, GitHub Primer, Atlassian Design System, Stripe Apps, Linear의 디자인 글을 참고했다. 무엇을 가져왔는지는 `docs/UI_UX_가이드.md` 3장에 적었다.
