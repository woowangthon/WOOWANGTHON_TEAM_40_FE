import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// 팀원이 만든 과제 단계 화면은 예전 스타일시트 src/styles.css 를 그대로 쓴다.
// 그 규칙이 새 화면에 닿지 않도록 legacy 영역 안에서만 적용되게 감싼다.
// 파일 자체는 고치지 않으므로 팀원의 변경과 합칠 때 스타일시트에서 충돌이 나지 않는다.
function scopeLegacyCss(): Plugin {
  return {
    name: 'scope-legacy-css',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/')
      if (!file.endsWith('/src/styles.css')) return null
      return { code: `@scope (.legacy) {\n${code}\n}\n`, map: null }
    },
  }
}

// 개발 중에는 /api 요청을 FastAPI 서버로 넘긴다. 배포에서는 FastAPI가 빌드 결과를 같이 서비스한다.
export default defineConfig({
  plugins: [scopeLegacyCss(), react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
